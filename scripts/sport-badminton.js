// ─────────────────────────────────────────────────────────────────────────────
//  sport-badminton.js  —  Set/game structure for Badminton & Tennis
// ─────────────────────────────────────────────────────────────────────────────

export function initBadminton({ homeLabel, awayLabel, homePlayers, awayPlayers, state, onSave, renderPills, sport }) {

  const isTennis = (sport || "").toLowerCase().includes("tennis");

  // Tennis: sets of 6 games, tiebreak at 6-6, best of 3 or 5
  // Badminton: games to 21, best of 3 (or 5)
  const cfg = isTennis
    ? { name: "Tennis",   pointSeq: ["0","15","30","40","AD"], gamesPerSet: 6, setsToWin: 2, tiebreak: true  }
    : { name: "Badminton",pointSeq: null,                      gamesPerSet: 21, setsToWin: 2, tiebreak: false };

  const ts = {
    sets:        [],       // [{ home: N, away: N }]  completed sets
    currentSet:  { home: 0, away: 0 },   // games (tennis) or points (badminton)
    tennisPts:   { home: 0, away: 0 },   // raw point index for tennis
    tiebreak:    false,
    tbPts:       { home: 0, away: 0 },
    server:      null,    // "home" | "away"
    setsWon:     { home: 0, away: 0 },
    phase:       "setup", // setup | playing | complete
    players:     {},
  };

  if (state.badminton) Object.assign(ts, state.badminton);

  [...homePlayers, ...awayPlayers].forEach(p => {
    if (!ts.players[p]) ts.players[p] = { pointsWon: 0, gamesWon: 0, setsWon: 0 };
  });

  function persist() { state.badminton = ts; onSave(); }

  function syncMaster() {
    state.state.A.setsWon = ts.setsWon.home;
    state.state.B.setsWon = ts.setsWon.away;
    renderPills();
  }

  const root = document.createElement("div");
  root.className = "sport-ui badminton-ui";

  function render() {
    root.innerHTML = "";
    if (ts.phase === "setup")    renderSetup();
    else if (ts.phase === "complete") renderComplete();
    else                         renderPlaying();
    syncMaster();
  }

  // ── Setup: pick server ────────────────────────────────────────────────────
  function renderSetup() {
    root.innerHTML = `
      <div class="guided-card">
        <div class="gc-title">🎾 ${cfg.name} — Who serves first?</div>
        <div class="gc-options">
          <button class="gc-opt" data-val="home">${homeLabel}</button>
          <button class="gc-opt" data-val="away">${awayLabel}</button>
        </div>
      </div>`;
    root.querySelectorAll(".gc-opt").forEach(btn => {
      btn.addEventListener("click", () => {
        ts.server = btn.dataset.val;
        ts.phase  = "playing";
        persist();
        render();
      });
    });
  }

  // ── Playing ───────────────────────────────────────────────────────────────
  function renderPlaying() {
    // Header — sets won
    const setsHeader = `
      <div class="bt-header">
        <div class="bt-name">${homeLabel}</div>
        <div class="bt-sets">${ts.setsWon.home}</div>
        <div class="bt-sep">sets</div>
        <div class="bt-sets">${ts.setsWon.away}</div>
        <div class="bt-name">${awayLabel}</div>
      </div>`;

    // Current set/game score
    const curScore = isTennis ? tennisCurScore() : badmintonCurScore();

    // Past sets
    const pastSets = ts.sets.length
      ? `<div class="bt-past-sets">${ts.sets.map((s, i) =>
          `<span class="bt-past-chip">Set ${i+1}: ${s.home}–${s.away}</span>`).join("")}</div>`
      : "";

    root.innerHTML = `
      ${setsHeader}
      ${pastSets}
      <div class="bt-score-row">
        <div class="bt-cur-score home">${curScore.home}</div>
        <div class="bt-cur-sep">${ts.tiebreak ? "TB" : isTennis ? "game" : "pts"}</div>
        <div class="bt-cur-score away">${curScore.away}</div>
      </div>
      <div class="bt-point-btns">
        <button class="bt-pt-btn home" id="pt-home">Point → ${homeLabel}</button>
        <button class="bt-pt-btn away" id="pt-away">Point → ${awayLabel}</button>
      </div>
      ${renderPlayerChips()}`;

    root.querySelector("#pt-home").addEventListener("click", () => addPoint("home"));
    root.querySelector("#pt-away").addEventListener("click", () => addPoint("away"));
  }

  function tennisCurScore() {
    if (ts.tiebreak) return { home: ts.tbPts.home, away: ts.tbPts.away };
    const seq  = cfg.pointSeq;
    const hi   = ts.tennisPts.home;
    const ai   = ts.tennisPts.away;
    const both40 = hi >= 3 && ai >= 3;
    if (!both40) {
      return { home: seq[Math.min(hi, seq.length - 1)], away: seq[Math.min(ai, seq.length - 1)] };
    }
    // Deuce / Advantage
    if (hi === ai) return { home: "Deuce", away: "Deuce" };
    return hi > ai ? { home: "AD", away: "" } : { home: "", away: "AD" };
  }

  function badmintonCurScore() {
    return { home: ts.currentSet.home, away: ts.currentSet.away };
  }

  function addPoint(side) {
    const other = side === "home" ? "away" : "home";

    if (isTennis) {
      addTennisPoint(side, other);
    } else {
      addBadmintonPoint(side, other);
    }

    persist();
    render();
  }

  function addTennisPoint(side, other) {
    if (ts.tiebreak) {
      ts.tbPts[side]++;
      const s = ts.tbPts[side], o = ts.tbPts[other];
      if (s >= 7 && s - o >= 2) {
        ts.currentSet[side]++;
        endGame(side, other);
      }
      return;
    }

    ts.tennisPts[side]++;
    const si = ts.tennisPts[side], oi = ts.tennisPts[other];

    // Both at 3+ = deuce logic
    if (si >= 3 && oi >= 3) {
      if (si - oi >= 2) {
        // won the game
        ts.tennisPts = { home: 0, away: 0 };
        ts.currentSet[side]++;
        checkSetEnd(side, other);
      }
      // else continue (deuce)
      return;
    }

    if (si >= 4) {
      // won the game cleanly
      ts.tennisPts = { home: 0, away: 0 };
      ts.currentSet[side]++;
      checkSetEnd(side, other);
    }
  }

  function checkSetEnd(side, other) {
    const s = ts.currentSet[side], o = ts.currentSet[other];
    // tiebreak at 6-6
    if (s === 6 && o === 6 && cfg.tiebreak) {
      ts.tiebreak = true;
      ts.tbPts    = { home: 0, away: 0 };
      return;
    }
    if (s >= cfg.gamesPerSet && s - o >= 2) {
      endGame(side, other);
    }
  }

  function endGame(side, other) {
    ts.sets.push({ home: ts.currentSet.home, away: ts.currentSet.away });
    ts.setsWon[side]++;
    ts.currentSet = { home: 0, away: 0 };
    ts.tiebreak   = false;
    ts.tbPts      = { home: 0, away: 0 };
    ts.tennisPts  = { home: 0, away: 0 };
    // switch server
    ts.server = other;

    if (ts.setsWon[side] >= cfg.setsToWin) {
      ts.phase = "complete";
    }
  }

  function addBadmintonPoint(side, other) {
    ts.currentSet[side]++;
    const s = ts.currentSet[side], o = ts.currentSet[other];
    const target = cfg.gamesPerSet;
    const win = (s >= target && s - o >= 2) || s >= 30; // max 30 in badminton
    if (win) {
      ts.sets.push({ home: ts.currentSet.home, away: ts.currentSet.away });
      ts.setsWon[side]++;
      ts.currentSet = { home: 0, away: 0 };
      ts.server = other; // serve switches on game win
      if (ts.setsWon[side] >= cfg.setsToWin) ts.phase = "complete";
    }
  }

  function renderPlayerChips() {
    const all = [
      { label: homeLabel, players: homePlayers },
      { label: awayLabel, players: awayPlayers },
    ];
    return `<div class="bt-players">${all.map(({ label, players }) =>
      `<div class="fb-team-section">
        <div class="fb-team-label">${label}</div>
        ${players.map(name => {
          const p = ts.players[name];
          return `<button class="player-chip" onclick=""><span class="pc-name">${name}</span><span class="pc-stat">${p.pointsWon}pts</span></button>`;
        }).join("")}
      </div>`).join("")}</div>`;
  }

  // ── Complete ──────────────────────────────────────────────────────────────
  function renderComplete() {
    const winner = ts.setsWon.home > ts.setsWon.away ? homeLabel : awayLabel;
    root.innerHTML = `
      <div class="guided-card">
        <div class="gc-title">🏆 Match Complete</div>
        <div class="cs-final">
          <div>${homeLabel}: <strong>${ts.setsWon.home} sets</strong></div>
          <div>${awayLabel}: <strong>${ts.setsWon.away} sets</strong></div>
          <div class="cs-winner">Winner: ${winner}</div>
        </div>
        <div class="bt-past-sets">
          ${ts.sets.map((s, i) => `<span class="bt-past-chip">Set ${i+1}: ${s.home}–${s.away}</span>`).join("")}
        </div>
      </div>`;
  }

  render();
  return root;
}