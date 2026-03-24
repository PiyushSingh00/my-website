import { requireAuth, logout } from "./auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;

  // Topbar actions
  document.querySelectorAll(".brand").forEach((el) => {
    el.style.cursor = "pointer";
    el.addEventListener("click", () => (window.location.href = "index.html"));
  });
  document.getElementById("signout-btn")?.addEventListener("click", logout);

  const titleEl = document.getElementById("score-title");
  const subEl = document.getElementById("score-sub");
  const backBtn = document.getElementById("back-to-fixtures");
  const saveBtn = document.getElementById("save-score");

  const configWrap = document.getElementById("config-fields");
  const teamsWrap = document.getElementById("teams-wrap");

  const statusPill = document.getElementById("status-pill");
  const winnerPill = document.getElementById("winner-pill");
  const reasonPill = document.getElementById("reason-pill");
  const saveMsg = document.getElementById("save-msg");

  // Timer UI
  const timerDisplay = document.getElementById("timer-display");
  const timerStartBtn = document.getElementById("timer-start");
  const timerPauseBtn = document.getElementById("timer-pause");
  const timerResetBtn = document.getElementById("timer-reset");

  const params = new URLSearchParams(window.location.search);
  const tournamentId = params.get("tournamentId");
  const categoryId = params.get("categoryId");
  const roundIndex = Number(params.get("round"));
  const matchIndex = Number(params.get("match"));
const scoreIndex = Number(params.get("scoreIndex") ?? 0);

  if (!tournamentId || !categoryId || Number.isNaN(roundIndex) || Number.isNaN(matchIndex)) {
    titleEl.textContent = "Missing required URL params";
    subEl.textContent = "Expected: ?tournamentId=...&categoryId=...&round=0&match=0";
    return;
  }

  backBtn?.addEventListener("click", () => {
    window.location.href = `fixtures.html?tournamentId=${encodeURIComponent(tournamentId)}`;
  });

  function getToken() {
    return localStorage.getItem("token") || localStorage.getItem("authToken") || "";
  }

  async function apiGet(url) {
    const res = await fetch(url, { headers: { Authorization: "Bearer " + getToken() } });
    const raw = await res.text();
    let data = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = { _nonJson: true, raw };
    }
    if (!res.ok) {
      const extra = data?._nonJson ? " (non-JSON response)" : "";
      throw new Error(`GET ${url} failed: ${res.status}${extra}`);
    }
    return data;
  }

  async function apiPut(url, body) {
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + getToken(),
      },
      body: JSON.stringify(body || {}),
    });
    const raw = await res.text();
    let data = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = { _nonJson: true, raw };
    }
    if (!res.ok) {
      const extra = data?._nonJson ? " (non-JSON response)" : "";
      throw new Error(`PUT ${url} failed: ${res.status}${extra}`);
    }
    return data;
  }

  function clear(el) {
    if (el) el.innerHTML = "";
  }

  // ---- Load schema + fixtures ----
  let schema = null;
  let fixtures = null;

  try {
    // IMPORTANT: this endpoint should return category-aware schema (your Step B)
    const schemaResp = await apiGet(
  `/api/host/tournaments/${encodeURIComponent(tournamentId)}/scoring-schema/active?categoryId=${encodeURIComponent(categoryId)}`

    );
    schema = schemaResp?.ok ? schemaResp.data : schemaResp;

    const fixturesResp = await apiGet(
      `/api/host/tournaments/${encodeURIComponent(tournamentId)}/fixtures`
    );
    fixtures = fixturesResp?.ok ? fixturesResp.data : fixturesResp;
  } catch (e) {
    console.error(e);
    titleEl.textContent = "Failed to load scoring data";
    subEl.textContent = String(e?.message || e);
    return;
  }

  if (!schema) {
    titleEl.textContent = "No scoring schema found";
    subEl.textContent = "Finalize scoring schema for this category first.";
    saveBtn.disabled = true;
    return;
  }

  const match =
    fixtures?.categories?.[categoryId]?.rounds?.[roundIndex]?.[matchIndex] || null;

  if (!match) {
    titleEl.textContent = "Match not found";
    subEl.textContent = "Invalid categoryId/round/match index.";
    saveBtn.disabled = true;
    return;
  }

  // Prevent scoring BYE matches
  const homeLabel = match.home ?? "Home";
  const awayLabel = match.away ?? "Away";
  if (String(homeLabel).toUpperCase() === "BYE" || String(awayLabel).toUpperCase() === "BYE") {
    statusPill.classList.add("error");
    statusPill.innerHTML = `Status: <strong>BYE</strong>`;
    winnerPill.innerHTML = `Winner: <strong>-</strong>`;
    reasonPill.innerHTML = `Reason: <strong>This match contains BYE, no scoring needed.</strong>`;
    saveBtn.disabled = true;
    return;
  }

  titleEl.textContent = `${homeLabel} vs ${awayLabel}`;
  subEl.textContent = `${schema.sport || ""} • Category ${categoryId} • Round ${roundIndex + 1} • Match ${matchIndex + 1}`;

  // ---- Resolve roster arrays (preferred: homePlayers/awayPlayers) ----
  function splitTeamLabel(label) {
    if (!label) return [];
    // supports: "A + B" OR "A+B"
    return String(label)
      .split("+")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const homePlayers = Array.isArray(match.homePlayers) ? match.homePlayers : splitTeamLabel(match.home);
  const awayPlayers = Array.isArray(match.awayPlayers) ? match.awayPlayers : splitTeamLabel(match.away);

  // ---- Local score state (supports per-player + team totals) ----
  // We keep team totals at:
  //   state.state.A[fieldKey]  (sum)
  //   state.state.B[fieldKey]  (sum)
  // and per-player breakdown at:
  //   state.state.A.players[playerName][fieldKey]
  // This keeps your existing winner logic compatible.
  const existing = match.score || null;

  const state = {
    config: {},
    state: {
      A: { players: {} },
      B: { players: {} },
    },
    timer: {
      elapsedMs: existing?.timer?.elapsedMs ?? 0,
      running: false,
      startedAtEpochMs: null,
    },
  };

  // Init config fields
  (schema.inputs || []).forEach((f) => {
    state.config[f.key] = existing?.config?.[f.key] ?? f.default ?? null;
  });

  // Init per-player maps
  function ensurePlayer(side, playerName) {
    if (!state.state[side].players[playerName]) state.state[side].players[playerName] = {};
    return state.state[side].players[playerName];
  }

  function initPlayers(side, roster) {
    roster.forEach((p) => {
      const pObj = ensurePlayer(side, p);
      (schema.playerFields || []).forEach((f) => {
        const prev = existing?.state?.[side]?.players?.[p]?.[f.key];
        pObj[f.key] = prev ?? f.default ?? (f.type === "text" ? "" : 0);
      });
    });
  }

  initPlayers("A", homePlayers);
  initPlayers("B", awayPlayers);

  // Recompute team totals for numeric-like fields
  function recomputeTeamTotals() {
    ["A", "B"].forEach((side) => {
      const totals = {};
      const roster = side === "A" ? homePlayers : awayPlayers;
      const fields = schema.playerFields || [];

      fields.forEach((f) => {
        // sum only for counters/numbers
        if (f.type === "counter" || f.type === "number") {
          let sum = 0;
          roster.forEach((p) => {
            const v = Number(state.state[side].players?.[p]?.[f.key] ?? 0);
            sum += Number.isFinite(v) ? v : 0;
          });
          totals[f.key] = sum;
        }
      });

      // write totals into the same place your old code expects
      Object.keys(totals).forEach((k) => (state.state[side][k] = totals[k]));
    });
  }

  recomputeTeamTotals();

  // ---- Winner compute (unchanged behavior: uses team totals) ----
  function compute(schemaObj, scoreObj) {
    const logic = schemaObj?.winnerLogic || {};
    const A = scoreObj.state?.A || {};
    const B = scoreObj.state?.B || {};
    const cfg = scoreObj.config || {};

    if (logic.type === "higherScoreWins") {
      const field = logic.field || "score";
      const a = Number(A[field] ?? 0);
      const b = Number(B[field] ?? 0);
      if (a > b) return { status: "completed", winnerName: homeLabel, reason: `${a} > ${b}` };
      if (b > a) return { status: "completed", winnerName: awayLabel, reason: `${b} > ${a}` };
      return { status: "pending", winnerName: null, reason: "Equal scores" };
    }

    if (logic.type === "firstToTarget") {
      const field = logic.field || "points";
      const targetKey = logic.targetFrom || "targetPoints";
      const winByTwoKey = logic.winByTwoFrom || "winByTwo";
      const a = Number(A[field] ?? 0);
      const b = Number(B[field] ?? 0);
      const target = Number(cfg[targetKey] ?? 0);
      const winByTwo = Boolean(cfg[winByTwoKey]);

      if (!target) return { status: "pending", winnerName: null, reason: "Target not set" };

      const diffA = a - b;
      const diffB = b - a;

      if (a >= target && (!winByTwo || diffA >= 2)) {
        return { status: "completed", winnerName: homeLabel, reason: `Reached ${a}/${target}` };
      }
      if (b >= target && (!winByTwo || diffB >= 2)) {
        return { status: "completed", winnerName: awayLabel, reason: `Reached ${b}/${target}` };
      }
      return { status: "pending", winnerName: null, reason: "Ongoing" };
    }

    return { status: "pending", winnerName: null, reason: "Unknown winner logic" };
  }

  function renderPills() {
    const c = compute(schema, state);
    statusPill.innerHTML = `Status: <strong>${c.status}</strong>`;
    winnerPill.innerHTML = `Winner: <strong>${c.winnerName || "-"}</strong>`;
    reasonPill.innerHTML = `Reason: <strong>${c.reason || "-"}</strong>`;
  }

  // ---- Render config fields ----
  function renderConfigFields() {
    clear(configWrap);
    const inputs = schema.inputs || [];
    if (!inputs.length) {
      configWrap.innerHTML = `<p class="help">No match settings.</p>`;
      return;
    }

    inputs.forEach((f) => {
      const wrap = document.createElement("div");
      wrap.className = "field";

      const label = document.createElement("label");
      label.textContent = f.label || f.key;

      let inputEl;

      if (f.type === "number") {
        inputEl = document.createElement("input");
        inputEl.type = "number";
        inputEl.value = state.config[f.key] ?? "";
        if (typeof f.min === "number") inputEl.min = String(f.min);
        if (typeof f.max === "number") inputEl.max = String(f.max);
        inputEl.addEventListener("input", () => {
          state.config[f.key] = inputEl.value === "" ? null : Number(inputEl.value);
          renderPills();
        });
      } else if (f.type === "boolean") {
        inputEl = document.createElement("select");
        inputEl.innerHTML = `<option value="true">True</option><option value="false">False</option>`;
        inputEl.value = String(Boolean(state.config[f.key]));
        inputEl.addEventListener("change", () => {
          state.config[f.key] = inputEl.value === "true";
          renderPills();
        });
      } else {
        inputEl = document.createElement("input");
        inputEl.type = "text";
        inputEl.value = state.config[f.key] ?? "";
        inputEl.addEventListener("input", () => {
          state.config[f.key] = inputEl.value;
          renderPills();
        });
      }

      wrap.appendChild(label);
      wrap.appendChild(inputEl);

      if (f.help) {
        const help = document.createElement("div");
        help.className = "help";
        help.textContent = f.help;
        wrap.appendChild(help);
      }

      configWrap.appendChild(wrap);
    });
  }

  // ---- Render per-player fields ----
  function renderPlayerFieldControl({ side, playerName, field }) {
    const wrap = document.createElement("div");
    wrap.className = "field";

    const label = document.createElement("label");
    label.textContent = `${field.label || field.key}`;
    wrap.appendChild(label);

    const playerObj = ensurePlayer(side, playerName);

    if (field.type === "counter") {
      const row = document.createElement("div");
      row.className = "counter";

      const minus = document.createElement("button");
      minus.className = "mini-btn";
      minus.type = "button";
      minus.textContent = "–";

      const plus = document.createElement("button");
      plus.className = "mini-btn";
      plus.type = "button";
      plus.textContent = "+";

      const value = document.createElement("div");
      value.className = "value";
      value.textContent = String(playerObj[field.key] ?? 0);

      const min = typeof field.min === "number" ? field.min : 0;

      minus.addEventListener("click", () => {
        const cur = Number(playerObj[field.key] ?? 0);
        const next = Math.max(min, cur - 1);
        playerObj[field.key] = next;
        value.textContent = String(next);
        recomputeTeamTotals();
        renderPills();
      });

      plus.addEventListener("click", () => {
        const cur = Number(playerObj[field.key] ?? 0);
        const next = cur + 1;
        playerObj[field.key] = next;
        value.textContent = String(next);
        recomputeTeamTotals();
        renderPills();
      });

      row.appendChild(minus);
      row.appendChild(value);
      row.appendChild(plus);
      wrap.appendChild(row);
    } else if (field.type === "number") {
      const inputEl = document.createElement("input");
      inputEl.type = "number";
      inputEl.value = playerObj[field.key] ?? 0;
      inputEl.addEventListener("input", () => {
        playerObj[field.key] = inputEl.value === "" ? 0 : Number(inputEl.value);
        recomputeTeamTotals();
        renderPills();
      });
      wrap.appendChild(inputEl);
    } else if (field.type === "select") {
      const sel = document.createElement("select");
      const opts = Array.isArray(field.options) ? field.options : [];
      sel.innerHTML = opts.map((o) => `<option value="${String(o)}">${String(o)}</option>`).join("");
      sel.value = String(playerObj[field.key] ?? (opts[0] ?? ""));
      sel.addEventListener("change", () => {
        playerObj[field.key] = sel.value;
        renderPills();
      });
      wrap.appendChild(sel);
    } else {
      const inputEl = document.createElement("input");
      inputEl.type = "text";
      inputEl.value = playerObj[field.key] ?? "";
      inputEl.addEventListener("input", () => {
        playerObj[field.key] = inputEl.value;
        renderPills();
      });
      wrap.appendChild(inputEl);
    }

    if (field.help) {
      const help = document.createElement("div");
      help.className = "help";
      help.textContent = field.help;
      wrap.appendChild(help);
    }

    return wrap;
  }

  function renderTeams() {
    clear(teamsWrap);

    const fields = schema.playerFields || [];
    if (!fields.length) {
      teamsWrap.innerHTML = `<p class="help">No player fields.</p>`;
      return;
    }

    const teams = [
      { side: "A", title: "Home", label: homeLabel, roster: homePlayers },
      { side: "B", title: "Away", label: awayLabel, roster: awayPlayers },
    ];

    teams.forEach((t) => {
      const teamCard = document.createElement("div");
      teamCard.className = "team-card";

      const header = document.createElement("div");
      header.className = "team-title";
      header.innerHTML = `<h3>${t.title}</h3><div class="team-sub">${t.label}</div>`;
      teamCard.appendChild(header);

      // Show team totals for main winner field (if exists)
      const logicField = schema?.winnerLogic?.field;
      if (logicField) {
        const total = Number(state.state[t.side]?.[logicField] ?? 0);
        const totalPill = document.createElement("div");
        totalPill.className = "pill";
        totalPill.style.marginTop = "8px";
        totalPill.innerHTML = `Team ${logicField}: <strong>${total}</strong>`;
        teamCard.appendChild(totalPill);
      }

      (t.roster || []).forEach((playerName) => {
        const playerCard = document.createElement("div");
        playerCard.className = "player-card";
        playerCard.innerHTML = `<h4>${playerName}</h4>`;

        fields.forEach((f) => {
          playerCard.appendChild(
            renderPlayerFieldControl({ side: t.side, playerName, field: f })
          );
        });

        teamCard.appendChild(playerCard);
      });

      teamsWrap.appendChild(teamCard);
    });
  }

  // ---- Timer ----
  let timerInterval = null;

  function formatMs(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const m = String(Math.floor(totalSec / 60)).padStart(2, "0");
    const s = String(totalSec % 60).padStart(2, "0");
    return `${m}:${s}`;
  }

  function renderTimer() {
    if (timerDisplay) timerDisplay.textContent = formatMs(state.timer.elapsedMs);
  }

  function tickTimer() {
    if (!state.timer.running || state.timer.startedAtEpochMs == null) return;
    const now = Date.now();
    const delta = now - state.timer.startedAtEpochMs;
    state.timer.startedAtEpochMs = now;
    state.timer.elapsedMs += delta;
    renderTimer();
  }

  function startTimer() {
    if (state.timer.running) return;
    state.timer.running = true;
    state.timer.startedAtEpochMs = Date.now();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(tickTimer, 250);
  }

  function pauseTimer() {
    if (!state.timer.running) return;
    tickTimer();
    state.timer.running = false;
    state.timer.startedAtEpochMs = null;
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
  }

  function resetTimer() {
    state.timer.elapsedMs = 0;
    state.timer.running = false;
    state.timer.startedAtEpochMs = null;
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    renderTimer();
  }

  timerStartBtn?.addEventListener("click", startTimer);
  timerPauseBtn?.addEventListener("click", pauseTimer);
  timerResetBtn?.addEventListener("click", resetTimer);

  // Hydrate timer from existing score
  renderTimer();

  // ---- Initial render ----
  renderConfigFields();
  renderTeams();
  renderPills();

  // ---- Notify new UI layer ----
  document.dispatchEvent(new CustomEvent("scoreReady", {
    detail: {
      state, schema, homeLabel, awayLabel,
      homePlayers, awayPlayers,
      recomputeTeamTotals, renderPills,
    }
  }));

  // ---- Save ----
  saveBtn?.addEventListener("click", async () => {
    saveBtn.disabled = true;
    if (saveMsg) {
      saveMsg.style.display = "inline-flex";
      saveMsg.textContent = "Saving…";
      saveMsg.classList.remove("error");
    }

    // ensure timer is not leaking running timestamp
    if (state.timer.running) tickTimer();

    try {
      const payload = {
        categoryId,
        roundIndex,
        matchIndex,
          scoreIndex,
        score: {
          config: state.config,
          state: state.state, // includes team totals + players map
          timer: { elapsedMs: state.timer.elapsedMs },
        },
      };

      const resp = await apiPut(
        `/api/host/tournaments/${encodeURIComponent(tournamentId)}/matches/score`,
        payload
      );

      if (saveMsg) {
        saveMsg.textContent = "Saved ✅";
        saveMsg.style.display = "inline-flex";
      }

      const serverMatch = resp?.match || null;
      const computed = serverMatch?.score?.computed || null;
      if (computed) {
        statusPill.innerHTML = `Status: <strong>${computed.status}</strong>`;
        winnerPill.innerHTML = `Winner: <strong>${computed.winnerName || "-"}</strong>`;
        reasonPill.innerHTML = `Reason: <strong>${computed.reason || "-"}</strong>`;
      }
    } catch (e) {
      console.error(e);
      if (saveMsg) {
        saveMsg.classList.add("error");
        saveMsg.textContent = `Save failed: ${String(e?.message || e)}`;
        saveMsg.style.display = "inline-flex";
      }
    } finally {
      saveBtn.disabled = false;
    }
  });
});