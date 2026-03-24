// ─────────────────────────────────────────────────────────────────────────────
//  sport-basketball.js  —  Play-by-play basketball scoring
// ─────────────────────────────────────────────────────────────────────────────

export function initBasketball({ homeLabel, awayLabel, homePlayers, awayPlayers, state, onSave, renderPills }) {

  const bs = {
    score:   { home: 0, away: 0 },
    quarter: 1,
    events:  [],
    players: {},
    phase:   "match",
  };

  if (state.basketball) Object.assign(bs, state.basketball);

  [...homePlayers, ...awayPlayers].forEach(p => {
    if (!bs.players[p]) bs.players[p] = { points: 0, assists: 0, rebounds: 0, steals: 0, blocks: 0, fouls: 0, turnovers: 0 };
  });

  function persist() { state.basketball = bs; onSave(); }

  function syncMaster() {
    state.state.A.points = bs.score.home;
    state.state.B.points = bs.score.away;
    renderPills();
  }

  const PLAY_OPTS = [
    { label: "1pt (Free throw)", val: "ft",      pts: 1  },
    { label: "2pt",              val: "2pt",     pts: 2  },
    { label: "3pt",              val: "3pt",     pts: 3  },
    { label: "Assist",          val: "assist",  pts: 0  },
    { label: "Rebound",         val: "rebound", pts: 0  },
    { label: "Steal",           val: "steal",   pts: 0  },
    { label: "Block",           val: "block",   pts: 0  },
    { label: "Foul",            val: "foul",    pts: 0  },
    { label: "Turnover",        val: "turnover",pts: 0  },
  ];

  const root = document.createElement("div");
  root.className = "sport-ui basketball-ui";

  let modalEl = null;
  function openModal(html, onClose) {
    closeModal();
    modalEl = document.createElement("div");
    modalEl.className = "sport-modal";
    modalEl.innerHTML = `<div class="sport-modal-box">${html}</div>`;
    modalEl.querySelector(".sport-modal-box").addEventListener("click", e => e.stopPropagation());
    modalEl.addEventListener("click", () => { closeModal(); onClose?.(); });
    document.body.appendChild(modalEl);
    requestAnimationFrame(() => modalEl?.classList.add("show"));
  }
  function closeModal() { if (modalEl) { modalEl.remove(); modalEl = null; } }

  function render() {
    root.innerHTML = "";

    // Scoreboard
    const sb = document.createElement("div");
    sb.className = "fb-scoreboard";
    sb.innerHTML = `
      <div class="fb-team">
        <div class="fb-name">${homeLabel}</div>
        <div class="fb-score">${bs.score.home}</div>
      </div>
      <div class="fb-center">
        <div class="fb-vs">Q${bs.quarter}</div>
        ${bs.quarter < 4
          ? `<button class="gc-confirm" style="margin-top:8px;padding:6px 14px;font-size:12px" id="next-q">End Q${bs.quarter}</button>`
          : `<button class="gc-confirm" style="margin-top:8px;padding:6px 14px;font-size:12px" id="next-q">Full time</button>`}
      </div>
      <div class="fb-team">
        <div class="fb-name">${awayLabel}</div>
        <div class="fb-score">${bs.score.away}</div>
      </div>`;
    root.appendChild(sb);

    sb.querySelector("#next-q")?.addEventListener("click", () => {
      if (bs.quarter >= 4) { bs.phase = "complete"; persist(); render(); return; }
      bs.quarter++;
      persist();
      render();
    });

    if (bs.phase === "complete") {
      const winner = bs.score.home > bs.score.away ? homeLabel : bs.score.away > bs.score.home ? awayLabel : "Tie";
      const msg = document.createElement("div");
      msg.className = "guided-card";
      msg.innerHTML = `<div class="gc-title">🏆 Final — ${winner}</div>`;
      root.appendChild(msg);
    }

    // Play log buttons — two team sections
    [{ label: homeLabel, players: homePlayers, team: "home" },
     { label: awayLabel, players: awayPlayers, team: "away" }].forEach(({ label, players, team }) => {
      const section = document.createElement("div");
      section.className = "fb-team-section";
      section.innerHTML = `<div class="fb-team-label">${label}</div>`;
      players.forEach(name => {
        const p    = bs.players[name];
        const chip = document.createElement("button");
        chip.type  = "button";
        chip.className = "player-chip";
        chip.innerHTML = `<span class="pc-name">${name}</span><span class="pc-stat">${p.points}pts</span>`;
        chip.addEventListener("click", () => openPlayPrompt(name, team, label));
        section.appendChild(chip);
      });
      root.appendChild(section);
    });

    syncMaster();
  }

  function openPlayPrompt(playerName, team, teamLabel) {
    const opts = PLAY_OPTS.map(o =>
      `<button class="gc-opt small" data-val="${o.val}" data-pts="${o.pts}">${o.label}</button>`
    ).join("");
    openModal(`
      <div class="sm-title">🏀 ${playerName} <span style="font-size:13px;opacity:.6">${teamLabel}</span></div>
      <div class="gc-options small" style="margin-top:12px">${opts}</div>
      <div class="sm-actions"><button class="sm-cancel" id="bk-cancel">Cancel</button></div>`, null);

    document.getElementById("bk-cancel").addEventListener("click", closeModal);

    document.querySelectorAll("[data-val]").forEach(btn => {
      btn.addEventListener("click", () => {
        const val = btn.dataset.val;
        const pts = Number(btn.dataset.pts);
        const p   = bs.players[playerName];

        if (pts > 0) { p.points += pts; bs.score[team] += pts; }
        if (val === "assist")   p.assists++;
        if (val === "rebound")  p.rebounds++;
        if (val === "steal")    p.steals++;
        if (val === "block")    p.blocks++;
        if (val === "foul")     p.fouls++;
        if (val === "turnover") p.turnovers++;

        bs.events.push({ player: playerName, team: teamLabel, type: val, pts, quarter: bs.quarter });
        closeModal();
        persist();
        render();
      });
    });
  }

  render();
  return root;
}