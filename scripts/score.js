import { requireAuth, logout } from "./auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;

  // ---------------------------------------------------------------------------
  // TOPBAR
  // ---------------------------------------------------------------------------
  document.querySelectorAll(".brand").forEach((el) => {
    el.style.cursor = "pointer";
    el.addEventListener("click", () => (window.location.href = "index.html"));
  });

  const trigger = document.getElementById("score-user-menu-trigger");
  const dropdown = document.getElementById("score-user-menu-dropdown");

  if (trigger) {
    const label = String(user?.name || user?.username || user?.email || "U").trim();
    trigger.textContent = (label[0] || "U").toUpperCase();
  }

  trigger?.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown?.classList.toggle("is-open");
  });

  document.addEventListener("click", (e) => {
    if (!dropdown || !trigger) return;
    if (!dropdown.contains(e.target) && !trigger.contains(e.target)) {
      dropdown.classList.remove("is-open");
    }
  });

  document.getElementById("dropdown-signout")?.addEventListener("click", () => {
    dropdown?.classList.remove("is-open");
    logout();
  });

  const playerBtn = document.getElementById("mode-player-btn");
  const hostBtn = document.getElementById("mode-host-btn");

  hostBtn?.classList.add("is-active");
  playerBtn?.classList.remove("is-active");

  playerBtn?.addEventListener("click", async () => {
    try {
      await fetch("/api/user/mode", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + (localStorage.getItem("token") || ""),
        },
        body: JSON.stringify({ mode: "player" }),
      });
    } catch {}

    window.location.href = "join.html";
  });

  hostBtn?.addEventListener("click", async () => {
    try {
      await fetch("/api/user/mode", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + (localStorage.getItem("token") || ""),
        },
        body: JSON.stringify({ mode: "host" }),
      });
    } catch {}
  });

  // ---------------------------------------------------------------------------
  // DOM REFS
  // ---------------------------------------------------------------------------
  const titleEl = document.getElementById("score-title");
  const subEl = document.getElementById("score-sub");
  const backBtn = document.getElementById("back-to-fixtures");
  const saveBtn = document.getElementById("save-score");
  const configWrap = document.getElementById("config-fields");
  const statusPill = document.getElementById("status-pill");
  const winnerPill = document.getElementById("winner-pill");
  const reasonPill = document.getElementById("reason-pill");
  const saveMsg = document.getElementById("save-msg");

  const homeNameEl = document.getElementById("home-name");
  const awayNameEl = document.getElementById("away-name");
  const homeScoreEl = document.getElementById("home-score");
  const awayScoreEl = document.getElementById("away-score");
  const rosterArea = document.getElementById("roster-area");

  const overlay = document.getElementById("stat-overlay");
  const drawer = document.getElementById("stat-drawer");
  const drawerNameEl = document.getElementById("drawer-player-name");
  const drawerTeamEl = document.getElementById("drawer-team-name");
  const drawerFields = document.getElementById("drawer-fields");
  const drawerClose = document.getElementById("drawer-close");

  const settingsPanel = document.getElementById("settings-panel");
  const toggleSettings = document.getElementById("toggle-settings");

  const timerDisplay = document.getElementById("timer-display");
  const timerStartBtn = document.getElementById("timer-start");
  const timerPauseBtn = document.getElementById("timer-pause");
  const timerResetBtn = document.getElementById("timer-reset");

  const teamHomeBtn = document.getElementById("team-home");
  const teamAwayBtn = document.getElementById("team-away");

  // ---------------------------------------------------------------------------
  // URL PARAMS
  // ---------------------------------------------------------------------------
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
    window.location.href = `players.html?tournamentId=${encodeURIComponent(tournamentId)}`;
  });

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------
  function getToken() {
    return localStorage.getItem("token") || localStorage.getItem("authToken") || "";
  }

  async function apiGet(url) {
    const res = await fetch(url, {
      headers: { Authorization: "Bearer " + getToken() },
    });

    const raw = await res.text();
    let data = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = { _nonJson: true, raw };
    }

    if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}${data?._nonJson ? " (non-JSON)" : ""}`);
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

    if (!res.ok) throw new Error(`PUT ${url} failed: ${res.status}${data?._nonJson ? " (non-JSON)" : ""}`);
    return data;
  }

  function clear(el) {
    if (el) el.innerHTML = "";
  }

  function splitTeamLabel(label) {
    return label ? String(label).split("+").map((s) => s.trim()).filter(Boolean) : [];
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ---------------------------------------------------------------------------
  // LOAD SCHEMA + FIXTURES
  // ---------------------------------------------------------------------------
  let schema = null;
  let fixtures = null;

  try {
    const schemaResp = await apiGet(
      `/api/host/tournaments/${encodeURIComponent(tournamentId)}/scoring-schema/active?categoryId=${encodeURIComponent(categoryId)}`
    );
    schema = schemaResp?.ok ? schemaResp.data : schemaResp;

    const fixturesResp = await apiGet(`/api/host/tournaments/${encodeURIComponent(tournamentId)}/fixtures`);
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

  const match = fixtures?.categories?.[categoryId]?.rounds?.[roundIndex]?.[matchIndex] || null;
  if (!match) {
    titleEl.textContent = "Match not found";
    subEl.textContent = "Invalid categoryId / round / match.";
    saveBtn.disabled = true;
    return;
  }

  const homeLabel = match.home ?? "Home";
  const awayLabel = match.away ?? "Away";

  if (String(homeLabel).toUpperCase() === "BYE" || String(awayLabel).toUpperCase() === "BYE") {
    statusPill.classList.add("error");
    statusPill.innerHTML = `Status: <strong>BYE</strong>`;
    winnerPill.innerHTML = `Winner: <strong>-</strong>`;
    reasonPill.innerHTML = `Reason: <strong>BYE match — no scoring needed.</strong>`;
    saveBtn.disabled = true;
    titleEl.textContent = `${homeLabel} vs ${awayLabel}`;
    subEl.textContent = `Category ${categoryId} • Round ${roundIndex + 1} • Match ${matchIndex + 1}`;
    return;
  }

  titleEl.textContent = `${homeLabel} vs ${awayLabel}`;
  subEl.textContent = `${schema?.sport || ""} • Category ${categoryId} • Round ${roundIndex + 1} • Match ${matchIndex + 1}`;

  homeNameEl.textContent = homeLabel;
  awayNameEl.textContent = awayLabel;

  const homePlayers = Array.isArray(match.homePlayers) ? match.homePlayers : splitTeamLabel(match.home);
  const awayPlayers = Array.isArray(match.awayPlayers) ? match.awayPlayers : splitTeamLabel(match.away);

  // ---------------------------------------------------------------------------
  // SCORE STATE
  // ---------------------------------------------------------------------------
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

  if (existing?.cricket) state.cricket = existing.cricket;
  if (existing?.football) state.football = existing.football;
  if (existing?.basketball) state.basketball = existing.basketball;
  if (existing?.badminton) state.badminton = existing.badminton;
  if (existing?.pickleball) state.pickleball = existing.pickleball;

  (schema.inputs || []).forEach((f) => {
    state.config[f.key] = existing?.config?.[f.key] ?? f.default ?? null;
  });

  function ensurePlayer(side, name) {
    if (!state.state[side].players[name]) state.state[side].players[name] = {};
    return state.state[side].players[name];
  }

  function initPlayers(side, roster) {
    roster.forEach((p) => {
      const obj = ensurePlayer(side, p);
      (schema.playerFields || []).forEach((f) => {
        const prev = existing?.state?.[side]?.players?.[p]?.[f.key];
        obj[f.key] = prev ?? f.default ?? (f.type === "text" ? "" : 0);
      });
    });
  }

  initPlayers("A", homePlayers);
  initPlayers("B", awayPlayers);

  function recomputeTeamTotals() {
    ["A", "B"].forEach((side) => {
      const roster = side === "A" ? homePlayers : awayPlayers;
      const totals = {};

      (schema.playerFields || []).forEach((f) => {
        if (f.type === "counter" || f.type === "number") {
          totals[f.key] = roster.reduce((sum, p) => {
            const v = Number(state.state[side].players?.[p]?.[f.key] ?? 0);
            return sum + (Number.isFinite(v) ? v : 0);
          }, 0);
        }
      });

      Object.assign(state.state[side], totals);
    });
  }

  recomputeTeamTotals();

  // ---------------------------------------------------------------------------
  // WINNER COMPUTE
  // ---------------------------------------------------------------------------
  function compute() {
    const logic = schema?.winnerLogic || {};
    const A = state.state.A;
    const B = state.state.B;
    const cfg = state.config;

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
      const a = Number(A[field] ?? 0);
      const b = Number(B[field] ?? 0);
      const target = Number(cfg[logic.targetFrom || "targetPoints"] ?? 0);
      const win2 = Boolean(cfg[logic.winByTwoFrom || "winByTwo"]);

      if (!target) return { status: "pending", winnerName: null, reason: "Target not set" };
      if (a >= target && (!win2 || a - b >= 2)) {
        return { status: "completed", winnerName: homeLabel, reason: `Reached ${a}/${target}` };
      }
      if (b >= target && (!win2 || b - a >= 2)) {
        return { status: "completed", winnerName: awayLabel, reason: `Reached ${b}/${target}` };
      }
      return { status: "pending", winnerName: null, reason: "Ongoing" };
    }

    return { status: "pending", winnerName: null, reason: "Unknown logic" };
  }

  function renderPills() {
    const c = compute();
    statusPill.innerHTML = `Status: <strong>${c.status}</strong>`;
    winnerPill.innerHTML = `Winner: <strong>${c.winnerName || "-"}</strong>`;
    reasonPill.innerHTML = `Reason: <strong>${c.reason || "-"}</strong>`;

    const logicField = schema?.winnerLogic?.field;
    if (logicField) {
      homeScoreEl.textContent = Number(state.state.A?.[logicField] ?? 0);
      awayScoreEl.textContent = Number(state.state.B?.[logicField] ?? 0);
    }
  }

  renderPills();

  // ---------------------------------------------------------------------------
  // SETTINGS TOGGLE
  // ---------------------------------------------------------------------------
  toggleSettings?.addEventListener("click", () => {
    settingsPanel?.classList.toggle("open");
    toggleSettings.textContent = settingsPanel?.classList.contains("open")
      ? "✕ Settings"
      : "⚙ Settings";
  });

  // ---------------------------------------------------------------------------
  // CONFIG FIELDS
  // ---------------------------------------------------------------------------
  function renderConfigFields() {
    clear(configWrap);

    const inputs = schema.inputs || [];
    if (!inputs.length) {
      configWrap.innerHTML = `<p class="helper-text">No match settings.</p>`;
      return;
    }

    inputs.forEach((f) => {
      const wrap = document.createElement("div");
      wrap.className = "field";

      const label = document.createElement("label");
      label.textContent = f.label || f.key;
      wrap.appendChild(label);

      let input;

      if (f.type === "number") {
        input = document.createElement("input");
        input.type = "number";
        input.value = state.config[f.key] ?? "";
        if (typeof f.min === "number") input.min = String(f.min);
        if (typeof f.max === "number") input.max = String(f.max);

        input.addEventListener("input", () => {
          state.config[f.key] = input.value === "" ? null : Number(input.value);
          renderPills();
        });
      } else if (f.type === "boolean") {
        input = document.createElement("select");
        input.innerHTML = `
          <option value="true">True</option>
          <option value="false">False</option>
        `;
        input.value = String(Boolean(state.config[f.key]));
        input.addEventListener("change", () => {
          state.config[f.key] = input.value === "true";
          renderPills();
        });
      } else {
        input = document.createElement("input");
        input.type = "text";
        input.value = state.config[f.key] ?? "";
        input.addEventListener("input", () => {
          state.config[f.key] = input.value;
          renderPills();
        });
      }

      wrap.appendChild(input);

      if (f.help) {
        const help = document.createElement("div");
        help.className = "helper-text";
        help.textContent = f.help;
        wrap.appendChild(help);
      }

      configWrap.appendChild(wrap);
    });
  }

  renderConfigFields();

  // ---------------------------------------------------------------------------
  // TIMER
  // ---------------------------------------------------------------------------
  function formatMs(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function refreshTimerUi() {
    let ms = state.timer.elapsedMs;
    if (state.timer.running && state.timer.startedAtEpochMs) {
      ms += Date.now() - state.timer.startedAtEpochMs;
    }
    timerDisplay.textContent = formatMs(ms);
  }

  setInterval(refreshTimerUi, 250);
  refreshTimerUi();

  timerStartBtn?.addEventListener("click", () => {
    if (state.timer.running) return;
    state.timer.running = true;
    state.timer.startedAtEpochMs = Date.now();
  });

  timerPauseBtn?.addEventListener("click", () => {
    if (!state.timer.running) return;
    state.timer.elapsedMs += Date.now() - state.timer.startedAtEpochMs;
    state.timer.running = false;
    state.timer.startedAtEpochMs = null;
    refreshTimerUi();
  });

  timerResetBtn?.addEventListener("click", () => {
    state.timer.elapsedMs = 0;
    state.timer.running = false;
    state.timer.startedAtEpochMs = null;
    refreshTimerUi();
  });

  // ---------------------------------------------------------------------------
  // DRAWER
  // ---------------------------------------------------------------------------
  function closeDrawer() {
    drawer?.classList.remove("open");
    overlay?.classList.remove("show");
    document.body.classList.remove("drawer-lock");
  }

  function openDrawer({ playerName, teamLabel, fields, playerObj, onUpdate }) {
    drawerNameEl.textContent = playerName;
    drawerTeamEl.textContent = teamLabel;

    clear(drawerFields);

    fields.forEach((field) => {
      const row = document.createElement("div");
      row.className = "df-row";

      const lbl = document.createElement("div");
      lbl.className = "df-label";
      lbl.textContent = field.label || field.key;
      row.appendChild(lbl);

      if (field.type === "counter" || field.type === "number") {
        const ctrl = document.createElement("div");
        ctrl.className = "df-counter";

        const minBtn = document.createElement("button");
        minBtn.type = "button";
        minBtn.className = "df-counter-btn";
        minBtn.textContent = "−";

        const valEl = document.createElement("div");
        valEl.className = "df-counter-val";
        valEl.textContent = String(playerObj[field.key] ?? 0);

        const plusBtn = document.createElement("button");
        plusBtn.type = "button";
        plusBtn.className = "df-counter-btn df-counter-plus";
        plusBtn.textContent = "+";

        const min = typeof field.min === "number" ? field.min : 0;

        minBtn.addEventListener("click", () => {
          const next = Math.max(min, Number(playerObj[field.key] ?? 0) - 1);
          playerObj[field.key] = next;
          valEl.textContent = String(next);
          onUpdate();
        });

        plusBtn.addEventListener("click", () => {
          const next = Number(playerObj[field.key] ?? 0) + 1;
          playerObj[field.key] = next;
          valEl.textContent = String(next);
          onUpdate();
        });

        ctrl.appendChild(minBtn);
        ctrl.appendChild(valEl);
        ctrl.appendChild(plusBtn);
        row.appendChild(ctrl);
      } else if (field.type === "select") {
        const select = document.createElement("select");
        select.className = "df-select";

        const options = Array.isArray(field.options) ? field.options : [];
        select.innerHTML = options
          .map((opt) => `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`)
          .join("");

        select.value = String(playerObj[field.key] ?? (options[0] ?? ""));
        select.addEventListener("change", () => {
          playerObj[field.key] = select.value;
          onUpdate();
        });

        row.appendChild(select);
      } else {
        const input = document.createElement("input");
        input.className = "df-input";
        input.type = field.type === "number" ? "number" : "text";
        input.value = playerObj[field.key] ?? "";

        input.addEventListener("input", () => {
          playerObj[field.key] =
            field.type === "number"
              ? (input.value === "" ? 0 : Number(input.value))
              : input.value;
          onUpdate();
        });

        row.appendChild(input);
      }

      if (field.help) {
        const help = document.createElement("div");
        help.className = "df-help";
        help.textContent = field.help;
        row.appendChild(help);
      }

      drawerFields.appendChild(row);
    });

    drawer?.classList.add("open");
    overlay?.classList.add("show");
    document.body.classList.add("drawer-lock");
  }

  drawerClose?.addEventListener("click", closeDrawer);
  overlay?.addEventListener("click", closeDrawer);

  // ---------------------------------------------------------------------------
  // ROSTER PANELS
  // ---------------------------------------------------------------------------
  const logicField = schema?.winnerLogic?.field || null;
  const playerFields = schema.playerFields || [];

  function buildPanel(side, teamLabel, roster) {
    const panel = document.createElement("div");
    panel.className = "roster-panel";
    panel.dataset.side = side;

    const hdr = document.createElement("div");
    hdr.className = "roster-panel-header";
    hdr.innerHTML = `
      <span class="rp-label">${side === "A" ? "🏠" : "✈️"} ${escapeHtml(teamLabel)}</span>
      <span class="rp-close">✕</span>
    `;

    hdr.querySelector(".rp-close")?.addEventListener("click", () => {
      panel.classList.remove("active");
    });

    panel.appendChild(hdr);

    if (!roster.length) {
      const empty = document.createElement("div");
      empty.className = "rp-empty";
      empty.textContent = "No players available";
      panel.appendChild(empty);
      return panel;
    }

    roster.forEach((name) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "player-chip";

      function refreshChip() {
        const stat =
          logicField != null
            ? state.state[side].players?.[name]?.[logicField] ?? 0
            : null;

        chip.innerHTML = `
          <span class="pc-name">${escapeHtml(name)}</span>
          ${stat !== null ? `<span class="pc-stat">${escapeHtml(stat)}</span>` : ""}
        `;
      }

      refreshChip();

      chip.addEventListener("click", () => {
        ensurePlayer(side, name);
        openDrawer({
          playerName: name,
          teamLabel,
          fields: playerFields,
          playerObj: state.state[side].players[name],
          onUpdate: () => {
            recomputeTeamTotals();
            renderPills();
            refreshChip();
          },
        });
      });

      panel.appendChild(chip);
    });

    return panel;
  }

  const homePanel = buildPanel("A", homeLabel, homePlayers);
  const awayPanel = buildPanel("B", awayLabel, awayPlayers);

  rosterArea.appendChild(homePanel);
  rosterArea.appendChild(awayPanel);

  teamHomeBtn?.addEventListener("click", () => {
    homePanel.classList.toggle("active");
    awayPanel.classList.remove("active");
  });

  teamAwayBtn?.addEventListener("click", () => {
    awayPanel.classList.toggle("active");
    homePanel.classList.remove("active");
  });

  // ---------------------------------------------------------------------------
  // SAVE
  // ---------------------------------------------------------------------------
  async function saveScore() {
    if (state.timer.running && state.timer.startedAtEpochMs) {
      state.timer.elapsedMs += Date.now() - state.timer.startedAtEpochMs;
      state.timer.running = false;
      state.timer.startedAtEpochMs = null;
    }

    const computed = compute();

    const payload = {
      tournamentId,
      categoryId,
      round: roundIndex,
      match: matchIndex,
      scoreIndex,

      score: {
        config: state.config,
        state: state.state,
        timer: {
          elapsedMs: state.timer.elapsedMs,
        },

        cricket: state.cricket,
        football: state.football,
        basketball: state.basketball,
        badminton: state.badminton,
        pickleball: state.pickleball,

        computed,
      },
    };

    const candidateUrls = [
      `/api/host/tournaments/${encodeURIComponent(tournamentId)}/matches/score`,
      `/api/host/tournaments/${encodeURIComponent(tournamentId)}/score`,
    ];

    let saved = false;
    let lastError = null;

    for (const url of candidateUrls) {
      try {
        await apiPut(url, payload);
        saved = true;
        break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!saved) {
      console.error(lastError);
      saveMsg.textContent = "Save failed";
      alert(lastError?.message || "Could not save score.");
      return;
    }

    saveMsg.textContent = "Saved and standings updated";
    renderPills();

    homeScoreEl.classList.add("bump");
    awayScoreEl.classList.add("bump");
    setTimeout(() => {
      homeScoreEl.classList.remove("bump");
      awayScoreEl.classList.remove("bump");
    }, 250);
  }

  saveBtn?.addEventListener("click", saveScore);
});