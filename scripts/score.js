import { requireAuth, logout } from "./auth.js";
import { initCricket }    from "./sport-cricket.js";
import { initFootball }   from "./sport-football.js";
import { initBasketball } from "./sport-basketball.js";
import { initBadminton }  from "./sport-badminton.js";

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;

  document.querySelectorAll(".brand").forEach((el) => {
    el.style.cursor = "pointer";
    el.addEventListener("click", () => (window.location.href = "index.html"));
  });
  document.getElementById("signout-btn")?.addEventListener("click", logout);

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const titleEl       = document.getElementById("score-title");
  const subEl         = document.getElementById("score-sub");
  const backBtn       = document.getElementById("back-to-fixtures");
  const saveBtn       = document.getElementById("save-score");
  const configWrap    = document.getElementById("config-fields");
  const teamsWrap     = document.getElementById("teams-wrap");
  const statusPill    = document.getElementById("status-pill");
  const winnerPill    = document.getElementById("winner-pill");
  const reasonPill    = document.getElementById("reason-pill");
  const saveMsg       = document.getElementById("save-msg");
  const homeNameEl    = document.getElementById("home-name");
  const awayNameEl    = document.getElementById("away-name");
  const homeScoreEl   = document.getElementById("home-score");
  const awayScoreEl   = document.getElementById("away-score");
  const rosterArea    = document.getElementById("roster-area");
  const overlay       = document.getElementById("stat-overlay");
  const drawer        = document.getElementById("stat-drawer");
  const drawerNameEl  = document.getElementById("drawer-player-name");
  const drawerTeamEl  = document.getElementById("drawer-team-name");
  const drawerFields  = document.getElementById("drawer-fields");
  const drawerClose   = document.getElementById("drawer-close");
  const settingsPanel = document.getElementById("settings-panel");
  const toggleSettings= document.getElementById("toggle-settings");
  const timerDisplay  = document.getElementById("timer-display");
  const timerStartBtn = document.getElementById("timer-start");
  const timerPauseBtn = document.getElementById("timer-pause");
  const timerResetBtn = document.getElementById("timer-reset");

  // ── URL params ────────────────────────────────────────────────────────────
  const params        = new URLSearchParams(window.location.search);
  const tournamentId  = params.get("tournamentId");
  const categoryId    = params.get("categoryId");
  const roundIndex    = Number(params.get("round"));
  const matchIndex    = Number(params.get("match"));
  const scoreIndex    = Number(params.get("scoreIndex") ?? 0);

  if (!tournamentId || !categoryId || Number.isNaN(roundIndex) || Number.isNaN(matchIndex)) {
    if (titleEl) titleEl.textContent = "Missing required URL params";
    if (subEl)   subEl.textContent   = "Expected: ?tournamentId=...&categoryId=...&round=0&match=0";
    return;
  }

  backBtn?.addEventListener("click", () => {
    window.location.href = `fixtures.html?tournamentId=${encodeURIComponent(tournamentId)}`;
  });

  // ── API helpers ───────────────────────────────────────────────────────────
  function getToken() {
    return localStorage.getItem("token") || localStorage.getItem("authToken") || "";
  }

  async function apiGet(url) {
    const res = await fetch(url, { headers: { Authorization: "Bearer " + getToken() } });
    const raw = await res.text();
    let data  = null;
    try   { data = raw ? JSON.parse(raw) : null; }
    catch { data = { _nonJson: true, raw }; }
    if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}${data?._nonJson ? " (non-JSON)" : ""}`);
    return data;
  }

  async function apiPut(url, body) {
    const res = await fetch(url, {
      method:  "PUT",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + getToken() },
      body:    JSON.stringify(body || {}),
    });
    const raw = await res.text();
    let data  = null;
    try   { data = raw ? JSON.parse(raw) : null; }
    catch { data = { _nonJson: true, raw }; }
    if (!res.ok) throw new Error(`PUT ${url} failed: ${res.status}${data?._nonJson ? " (non-JSON)" : ""}`);
    return data;
  }

  function clear(el) { if (el) el.innerHTML = ""; }

  // ── Load data ─────────────────────────────────────────────────────────────
  let schema   = null;
  let fixtures = null;

  try {
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
    if (titleEl) titleEl.textContent = "Failed to load scoring data";
    if (subEl)   subEl.textContent   = String(e?.message || e);
    return;
  }

  if (!schema) {
    if (titleEl) titleEl.textContent = "No scoring schema found";
    if (subEl)   subEl.textContent   = "Finalize scoring schema for this category first.";
    if (saveBtn) saveBtn.disabled    = true;
    return;
  }

  const match = fixtures?.categories?.[categoryId]?.rounds?.[roundIndex]?.[matchIndex] || null;

  if (!match) {
    if (titleEl) titleEl.textContent = "Match not found";
    if (subEl)   subEl.textContent   = "Invalid categoryId/round/match index.";
    if (saveBtn) saveBtn.disabled    = true;
    return;
  }

  const homeLabel = match.home ?? "Home";
  const awayLabel = match.away ?? "Away";

  if (String(homeLabel).toUpperCase() === "BYE" || String(awayLabel).toUpperCase() === "BYE") {
    statusPill?.classList.add("error");
    if (statusPill) statusPill.innerHTML = `Status: <strong>BYE</strong>`;
    if (winnerPill) winnerPill.innerHTML = `Winner: <strong>-</strong>`;
    if (reasonPill) reasonPill.innerHTML = `Reason: <strong>BYE match — no scoring needed.</strong>`;
    if (saveBtn)    saveBtn.disabled     = true;
    return;
  }

  if (titleEl)    titleEl.textContent    = `${homeLabel} vs ${awayLabel}`;
  if (subEl)      subEl.textContent      = `${schema.sport || ""} • Category ${categoryId} • Round ${roundIndex + 1} • Match ${matchIndex + 1}`;
  if (homeNameEl) homeNameEl.textContent = homeLabel;
  if (awayNameEl) awayNameEl.textContent = awayLabel;

  function splitTeamLabel(label) {
    if (!label) return [];
    return String(label).split("+").map((s) => s.trim()).filter(Boolean);
  }

  const homePlayers = Array.isArray(match.homePlayers) ? match.homePlayers : splitTeamLabel(match.home);
  const awayPlayers = Array.isArray(match.awayPlayers) ? match.awayPlayers : splitTeamLabel(match.away);

  // ── Score state ───────────────────────────────────────────────────────────
  const existing = match.score || null;

  const state = {
    config: {},
    state: {
      A: { players: {} },
      B: { players: {} },
    },
    timer: {
      elapsedMs:        existing?.timer?.elapsedMs ?? 0,
      running:          false,
      startedAtEpochMs: null,
    },
  };

  // Restore any sport-specific state from existing score
  if (existing?.cricket)    state.cricket    = existing.cricket;
  if (existing?.football)   state.football   = existing.football;
  if (existing?.basketball) state.basketball = existing.basketball;
  if (existing?.badminton)  state.badminton  = existing.badminton;

  (schema.inputs || []).forEach((f) => {
    state.config[f.key] = existing?.config?.[f.key] ?? f.default ?? null;
  });

  function ensurePlayer(side, playerName) {
    if (!state.state[side].players[playerName]) state.state[side].players[playerName] = {};
    return state.state[side].players[playerName];
  }

  function initPlayers(side, roster) {
    roster.forEach((p) => {
      const pObj = ensurePlayer(side, p);
      (schema.playerFields || []).forEach((f) => {
        const prev  = existing?.state?.[side]?.players?.[p]?.[f.key];
        pObj[f.key] = prev ?? f.default ?? (f.type === "text" ? "" : 0);
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
          let sum = 0;
          roster.forEach((p) => {
            const v = Number(state.state[side].players?.[p]?.[f.key] ?? 0);
            sum += Number.isFinite(v) ? v : 0;
          });
          totals[f.key] = sum;
        }
      });
      Object.keys(totals).forEach((k) => (state.state[side][k] = totals[k]));
    });
  }

  recomputeTeamTotals();

  // ── Winner compute ────────────────────────────────────────────────────────
  function compute(schemaObj, scoreObj) {
    const logic = schemaObj?.winnerLogic || {};
    const A     = scoreObj.state?.A || {};
    const B     = scoreObj.state?.B || {};
    const cfg   = scoreObj.config   || {};

    if (logic.type === "higherScoreWins") {
      const field = logic.field || "score";
      const a = Number(A[field] ?? 0);
      const b = Number(B[field] ?? 0);
      if (a > b) return { status: "completed", winnerName: homeLabel, reason: `${a} > ${b}` };
      if (b > a) return { status: "completed", winnerName: awayLabel, reason: `${b} > ${a}` };
      return { status: "pending", winnerName: null, reason: "Equal scores" };
    }

    if (logic.type === "firstToTarget") {
      const field       = logic.field        || "points";
      const targetKey   = logic.targetFrom   || "targetPoints";
      const winByTwoKey = logic.winByTwoFrom || "winByTwo";
      const a           = Number(A[field] ?? 0);
      const b           = Number(B[field] ?? 0);
      const target      = Number(cfg[targetKey]   ?? 0);
      const winByTwo    = Boolean(cfg[winByTwoKey]);

      if (!target) return { status: "pending", winnerName: null, reason: "Target not set" };
      if (a >= target && (!winByTwo || (a - b) >= 2))
        return { status: "completed", winnerName: homeLabel, reason: `Reached ${a}/${target}` };
      if (b >= target && (!winByTwo || (b - a) >= 2))
        return { status: "completed", winnerName: awayLabel, reason: `Reached ${b}/${target}` };
      return { status: "pending", winnerName: null, reason: "Ongoing" };
    }

    return { status: "pending", winnerName: null, reason: "Unknown winner logic" };
  }

  function renderPills() {
    const c = compute(schema, state);
    if (statusPill) statusPill.innerHTML = `Status: <strong>${c.status}</strong>`;
    if (winnerPill) winnerPill.innerHTML = `Winner: <strong>${c.winnerName || "-"}</strong>`;
    if (reasonPill) reasonPill.innerHTML = `Reason: <strong>${c.reason || "-"}</strong>`;
    // Update top scoreboard numbers from master state
    const logicField = schema?.winnerLogic?.field;
    if (logicField) {
      if (homeScoreEl) homeScoreEl.textContent = Number(state.state.A?.[logicField] ?? 0);
      if (awayScoreEl) awayScoreEl.textContent = Number(state.state.B?.[logicField] ?? 0);
    }
  }

  // ── Settings toggle ───────────────────────────────────────────────────────
  toggleSettings?.addEventListener("click", () => {
    settingsPanel?.classList.toggle("open");
    if (toggleSettings) {
      toggleSettings.textContent = settingsPanel?.classList.contains("open")
        ? "✕ Settings" : "⚙ Settings";
    }
  });

  // ── Config fields ─────────────────────────────────────────────────────────
  function renderConfigFields() {
    clear(configWrap);
    const inputs = schema.inputs || [];
    if (!inputs.length) {
      if (configWrap) configWrap.innerHTML = `<p class="help">No match settings.</p>`;
      return;
    }
    inputs.forEach((f) => {
      const wrap  = document.createElement("div");
      wrap.className = "field";
      const label = document.createElement("label");
      label.textContent = f.label || f.key;
      let inputEl;
      if (f.type === "number") {
        inputEl = document.createElement("input");
        inputEl.type  = "number";
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
        inputEl.type  = "text";
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
        help.className   = "help";
        help.textContent = f.help;
        wrap.appendChild(help);
      }
      configWrap?.appendChild(wrap);
    });
  }

  // ── Generic drawer (for non-sport-specific player fields) ─────────────────
  function closeDrawer() {
    drawer?.classList.remove("open");
    overlay?.classList.remove("show");
    document.body.classList.remove("drawer-lock");
  }
  drawerClose?.addEventListener("click", closeDrawer);
  overlay?.addEventListener("click", closeDrawer);

  function openDrawer({ playerName, teamLabel, fields, playerObj, onUpdate }) {
    if (drawerNameEl) drawerNameEl.textContent = playerName;
    if (drawerTeamEl) drawerTeamEl.textContent = teamLabel;
    clear(drawerFields);
    fields.forEach((field) => {
      const row = document.createElement("div");
      row.className = "df-row";
      const lbl = document.createElement("div");
      lbl.className   = "df-label";
      lbl.textContent = field.label || field.key;
      row.appendChild(lbl);
      if (field.type === "counter" || field.type === "number") {
        const ctrl    = document.createElement("div");
        ctrl.className = "df-counter";
        const minBtn  = document.createElement("button");
        minBtn.type   = "button";
        minBtn.className  = "df-counter-btn";
        minBtn.textContent = "−";
        const valEl   = document.createElement("div");
        valEl.className   = "df-counter-val";
        valEl.textContent = String(playerObj[field.key] ?? 0);
        const plusBtn = document.createElement("button");
        plusBtn.type  = "button";
        plusBtn.className   = "df-counter-btn df-counter-plus";
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
        const sel = document.createElement("select");
        sel.className = "df-select";
        const opts = Array.isArray(field.options) ? field.options : [];
        sel.innerHTML = opts.map((o) => `<option value="${o}">${o}</option>`).join("");
        sel.value = String(playerObj[field.key] ?? (opts[0] ?? ""));
        sel.addEventListener("change", () => { playerObj[field.key] = sel.value; onUpdate(); });
        row.appendChild(sel);
      } else {
        const inp = document.createElement("input");
        inp.className = "df-input";
        inp.type  = field.type === "number" ? "number" : "text";
        inp.value = playerObj[field.key] ?? "";
        inp.addEventListener("input", () => {
          playerObj[field.key] = field.type === "number"
            ? (inp.value === "" ? 0 : Number(inp.value)) : inp.value;
          onUpdate();
        });
        row.appendChild(inp);
      }
      if (field.help) {
        const help = document.createElement("div");
        help.className   = "df-help";
        help.textContent = field.help;
        row.appendChild(help);
      }
      drawerFields?.appendChild(row);
    });
    drawer?.classList.add("open");
    overlay?.classList.add("show");
    document.body.classList.add("drawer-lock");
  }

  // ── Generic roster panels (fallback for unknown sports) ───────────────────
  function buildGenericRosterPanels() {
    if (!rosterArea) return;
    const logicField   = schema?.winnerLogic?.field || null;
    const playerFields = schema.playerFields || [];

    function buildPanel(side, teamLabel, roster) {
      const panel = document.createElement("div");
      panel.className    = "roster-panel";
      panel.dataset.side = side;
      const header = document.createElement("div");
      header.className = "roster-panel-header";
      header.innerHTML = `
        <span class="rp-label">${side === "A" ? "🏠" : "✈️"} ${teamLabel}</span>
        <span class="rp-close">✕</span>`;
      header.querySelector(".rp-close").addEventListener("click", () => panel.classList.remove("active"));
      panel.appendChild(header);

      roster.forEach((playerName) => {
        const chip = document.createElement("button");
        chip.type  = "button";
        chip.className = "player-chip";
        function refreshChip() {
          const stat = logicField ? (state.state[side].players?.[playerName]?.[logicField] ?? 0) : null;
          chip.innerHTML = `<span class="pc-name">${playerName}</span>${stat !== null ? `<span class="pc-stat">${stat}</span>` : ""}`;
        }
        refreshChip();
        chip.addEventListener("click", () => {
          ensurePlayer(side, playerName);
          openDrawer({
            playerName, teamLabel,
            fields: playerFields,
            playerObj: state.state[side].players[playerName],
            onUpdate: () => { recomputeTeamTotals(); renderPills(); refreshChip(); },
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

    document.getElementById("team-home")?.addEventListener("click", () => {
      homePanel.classList.toggle("active");
      awayPanel.classList.remove("active");
    });
    document.getElementById("team-away")?.addEventListener("click", () => {
      awayPanel.classList.toggle("active");
      homePanel.classList.remove("active");
    });
  }

  // ── Sport router ──────────────────────────────────────────────────────────
  const sport = (schema.sport || "").toLowerCase();

  // onSave callback passed to sport modules — queues a debounced autosave
  let saveDebounce = null;
  function onSportUpdate() {
    renderPills();
    clearTimeout(saveDebounce);
    saveDebounce = setTimeout(doSave, 1500);
  }

  const sportCtx = {
    homeLabel, awayLabel, homePlayers, awayPlayers,
    state, onSave: onSportUpdate, renderPills, sport,
  };

  // Hide the generic scoreboard tap-hint for sport-specific UIs
  function hideTapHints() {
    document.querySelectorAll(".team-tap-hint").forEach(el => el.style.display = "none");
    document.querySelectorAll(".team-block").forEach(el => el.style.cursor = "default");
    if (homeScoreEl) homeScoreEl.style.fontSize = "48px";
    if (awayScoreEl) awayScoreEl.style.fontSize = "48px";
  }

  if (sport.includes("cricket")) {
    hideTapHints();
    const ui = initCricket(sportCtx);
    rosterArea?.appendChild(ui);
  } else if (sport.includes("football") || sport.includes("soccer")) {
    hideTapHints();
    // For football, hide the top-level scoreboard since the sport module has its own
    document.getElementById("scoreboard")?.style.setProperty("display", "none");
    const ui = initFootball(sportCtx);
    rosterArea?.appendChild(ui);
  } else if (sport.includes("basketball")) {
    hideTapHints();
    document.getElementById("scoreboard")?.style.setProperty("display", "none");
    const ui = initBasketball(sportCtx);
    rosterArea?.appendChild(ui);
  } else if (sport.includes("badminton") || sport.includes("tennis")) {
    hideTapHints();
    document.getElementById("scoreboard")?.style.setProperty("display", "none");
    const ui = initBadminton(sportCtx);
    rosterArea?.appendChild(ui);
  } else {
    // Generic fallback — original roster/drawer UI
    buildGenericRosterPanels();
    const logicField = schema?.winnerLogic?.field || null;
    if (logicField) {
      if (homeScoreEl) homeScoreEl.textContent = Number(state.state.A?.[logicField] ?? 0);
      if (awayScoreEl) awayScoreEl.textContent = Number(state.state.B?.[logicField] ?? 0);
    }
  }

  // ── Timer ─────────────────────────────────────────────────────────────────
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
    state.timer.elapsedMs        += now - state.timer.startedAtEpochMs;
    state.timer.startedAtEpochMs  = now;
    renderTimer();
  }

  function startTimer() {
    if (state.timer.running) return;
    state.timer.running          = true;
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
    state.timer.running   = false;
    state.timer.startedAtEpochMs = null;
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    renderTimer();
  }

  timerStartBtn?.addEventListener("click", startTimer);
  timerPauseBtn?.addEventListener("click", pauseTimer);
  timerResetBtn?.addEventListener("click", resetTimer);
  renderTimer();

  // ── Config fields + pills ─────────────────────────────────────────────────
  renderConfigFields();
  renderPills();

  // ── Save ──────────────────────────────────────────────────────────────────
  async function doSave() {
    if (saveBtn) saveBtn.disabled = true;
    if (saveMsg) {
      saveMsg.style.display = "inline-flex";
      saveMsg.textContent   = "Saving…";
      saveMsg.classList.remove("error");
    }
    if (state.timer.running) tickTimer();
    try {
      const payload = {
        categoryId, roundIndex, matchIndex, scoreIndex,
        score: {
          config: state.config,
          state:  state.state,
          timer:  { elapsedMs: state.timer.elapsedMs },
          // sport-specific blobs
          ...(state.cricket    && { cricket:    state.cricket    }),
          ...(state.football   && { football:   state.football   }),
          ...(state.basketball && { basketball: state.basketball }),
          ...(state.badminton  && { badminton:  state.badminton  }),
        },
      };
      const resp = await apiPut(
        `/api/host/tournaments/${encodeURIComponent(tournamentId)}/matches/score`,
        payload
      );
      if (saveMsg) { saveMsg.textContent = "Saved ✅"; saveMsg.style.display = "inline-flex"; }
      const computed = resp?.match?.score?.computed || null;
      if (computed) {
        if (statusPill) statusPill.innerHTML = `Status: <strong>${computed.status}</strong>`;
        if (winnerPill) winnerPill.innerHTML = `Winner: <strong>${computed.winnerName || "-"}</strong>`;
        if (reasonPill) reasonPill.innerHTML = `Reason: <strong>${computed.reason || "-"}</strong>`;
      }
    } catch (e) {
      console.error(e);
      if (saveMsg) {
        saveMsg.classList.add("error");
        saveMsg.style.display = "inline-flex";
        saveMsg.textContent   = `Save failed: ${String(e?.message || e)}`;
      }
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  saveBtn?.addEventListener("click", doSave);
});