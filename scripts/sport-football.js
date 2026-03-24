// ─────────────────────────────────────────────────────────────────────────────
//  sport-football.js  —  Guided football scoring workflow
// ─────────────────────────────────────────────────────────────────────────────

export function initFootball({ homeLabel, awayLabel, homePlayers, awayPlayers, state, onSave, renderPills }) {

  // ── State ──────────────────────────────────────────────────────────────────
  const fs = {
    goals:   { home: 0, away: 0 },
    events:  [],   // { type, team, player, minute }
    players: {},   // { name: { goals, assists, fouls, yellowCards, redCards, minutesPlayed } }
    phase:   "match",
  };

  if (state.football) Object.assign(fs, state.football);

  // ensure all players are initialised
  [...homePlayers, ...awayPlayers].forEach(p => {
    if (!fs.players[p]) fs.players[p] = { goals: 0, assists: 0, fouls: 0, yellowCards: 0, redCards: 0, minutesPlayed: 0 };
  });

  function persist() { state.football = fs; onSave(); }

  function syncMaster() {
    state.state.A.goals = fs.goals.home;
    state.state.B.goals = fs.goals.away;
    renderPills();
  }

  // ── UI root ────────────────────────────────────────────────────────────────
  const root = document.createElement("div");
  root.className = "sport-ui football-ui";

  // Active modal overlay
  let modalEl = null;
  function openModal(content, onClose) {
    closeModal();
    modalEl = document.createElement("div");
    modalEl.className = "sport-modal";
    modalEl.innerHTML = `<div class="sport-modal-box">${content}</div>`;
    modalEl.querySelector(".sport-modal-box").addEventListener("click", e => e.stopPropagation());
    modalEl.addEventListener("click", () => { closeModal(); onClose?.(); });
    document.body.appendChild(modalEl);
    requestAnimationFrame(() => modalEl?.classList.add("show"));
  }
  function closeModal() {
    if (modalEl) { modalEl.remove(); modalEl = null; }
  }

  // ── Main render ────────────────────────────────────────────────────────────
  function render() {
    root.innerHTML = "";

    // Scoreboard
    const sb = document.createElement("div");
    sb.className = "fb-scoreboard";
    sb.innerHTML = `
      <div class="fb-team">
        <div class="fb-name">${homeLabel}</div>
        <div class="fb-score" id="fb-home-score">${fs.goals.home}</div>
        <button class="fb-goal-btn" data-team="home">+ Goal</button>
      </div>
      <div class="fb-center">
        <div class="fb-vs">VS</div>
      </div>
      <div class="fb-team">
        <div class="fb-name">${awayLabel}</div>
        <div class="fb-score" id="fb-away-score">${fs.goals.away}</div>
        <button class="fb-goal-btn" data-team="away">+ Goal</button>
      </div>`;
    root.appendChild(sb);

    sb.querySelectorAll(".fb-goal-btn").forEach(btn => {
      btn.addEventListener("click", () => promptGoal(btn.dataset.team));
    });

    // Event log
    if (fs.events.length) {
      const log = document.createElement("div");
      log.className = "fb-event-log";
      log.innerHTML = `<div class="fb-log-title">Match events</div>` +
        [...fs.events].reverse().map(e => `
          <div class="fb-event-row">
            <span class="fb-event-icon">${eventIcon(e.type)}</span>
            <span class="fb-event-desc">${e.player || "—"} <em>(${e.team})</em></span>
            <span class="fb-event-min">${e.minute ? e.minute + "′" : ""}</span>
          </div>`).join("");
      root.appendChild(log);
    }

    // Player stats panel
    const statsPanel = document.createElement("div");
    statsPanel.className = "fb-stats-panel";
    statsPanel.innerHTML = `<div class="fb-stats-title">Player stats</div>`;

    const teamsData = [
      { label: homeLabel, players: homePlayers },
      { label: awayLabel, players: awayPlayers },
    ];

    teamsData.forEach(({ label, players }) => {
      const section = document.createElement("div");
      section.className = "fb-team-section";
      section.innerHTML = `<div class="fb-team-label">${label}</div>`;
      players.forEach(name => {
        const p   = fs.players[name];
        const chip = document.createElement("button");
        chip.type  = "button";
        chip.className = "player-chip";
        chip.innerHTML = `
          <span class="pc-name">${name}</span>
          <span class="pc-stat">${p.goals}G ${p.assists}A</span>`;
        chip.addEventListener("click", () => openPlayerEdit(name, label));
        section.appendChild(chip);
      });
      statsPanel.appendChild(section);
    });

    root.appendChild(statsPanel);
    syncMaster();
  }

  function eventIcon(type) {
    return { goal: "⚽", assist: "🅰️", foul: "⚠️", yellow: "🟨", red: "🟥" }[type] || "•";
  }

  // ── Goal prompt ────────────────────────────────────────────────────────────
  function promptGoal(team) {
    const players = team === "home" ? homePlayers : awayPlayers;
    const label   = team === "home" ? homeLabel : awayLabel;
    const opts    = players.map(p => `<option value="${p}">${p}</option>`).join("");

    openModal(`
      <div class="sm-title">⚽ Goal — ${label}</div>
      <label class="sm-label">Scored by</label>
      <select class="gc-select" id="goal-scorer">${opts}</select>
      <label class="sm-label" style="margin-top:10px">Assisted by</label>
      <select class="gc-select" id="goal-assist">
        <option value="">— None —</option>${opts}
      </select>
      <label class="sm-label" style="margin-top:10px">Minute</label>
      <input class="gc-select" type="number" id="goal-min" min="1" max="120" placeholder="e.g. 45"/>
      <div class="sm-actions">
        <button class="gc-confirm" id="sm-confirm">Confirm goal</button>
        <button class="sm-cancel" id="sm-cancel">Cancel</button>
      </div>`, null);

    document.getElementById("sm-confirm").addEventListener("click", () => {
      const scorer  = document.getElementById("goal-scorer").value;
      const assist  = document.getElementById("goal-assist").value;
      const minute  = document.getElementById("goal-min").value;

      fs.goals[team]++;
      fs.players[scorer].goals++;
      fs.events.push({ type: "goal", team: label, player: scorer, minute });

      if (assist && assist !== scorer) {
        fs.players[assist].assists++;
        fs.events.push({ type: "assist", team: label, player: assist, minute });
      }

      closeModal();
      persist();
      render();
    });

    document.getElementById("sm-cancel").addEventListener("click", () => { closeModal(); });
  }

  // ── Player stat editor ─────────────────────────────────────────────────────
  function openPlayerEdit(name, teamLabel) {
    const p = fs.players[name];
    openModal(`
      <div class="sm-title">👤 ${name} <span style="font-size:13px;opacity:.6">${teamLabel}</span></div>
      ${statRow("Goals",         "goals",         p.goals)}
      ${statRow("Assists",       "assists",        p.assists)}
      ${statRow("Fouls",         "fouls",          p.fouls)}
      ${statRow("Yellow cards",  "yellowCards",    p.yellowCards)}
      ${statRow("Red cards",     "redCards",       p.redCards)}
      ${statRow("Minutes played","minutesPlayed",  p.minutesPlayed)}
      <div class="sm-actions">
        <button class="gc-confirm" id="sm-save-player">Save</button>
        <button class="sm-cancel"  id="sm-cancel-player">Cancel</button>
      </div>`, null);

    document.getElementById("sm-save-player").addEventListener("click", () => {
      ["goals","assists","fouls","yellowCards","redCards","minutesPlayed"].forEach(k => {
        const el = document.getElementById(`stat-${k}`);
        if (el) p[k] = Number(el.value) || 0;
      });
      closeModal();
      persist();
      render();
    });
    document.getElementById("sm-cancel-player").addEventListener("click", () => closeModal());
  }

  function statRow(label, key, val) {
    return `
      <div class="sm-stat-row">
        <span class="sm-stat-label">${label}</span>
        <div class="df-counter">
          <button type="button" class="df-counter-btn" onclick="(function(){var el=document.getElementById('stat-${key}');el.value=Math.max(0,+el.value-1);})()">−</button>
          <input class="df-counter-val" id="stat-${key}" type="number" value="${val}" style="width:50px;text-align:center;background:transparent;border:none;color:#fff;font-family:'Bebas Neue',sans-serif;font-size:28px"/>
          <button type="button" class="df-counter-btn df-counter-plus" onclick="(function(){var el=document.getElementById('stat-${key}');el.value=+el.value+1;})()">+</button>
        </div>
      </div>`;
  }

  render();
  return root;
}