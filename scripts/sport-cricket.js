// ─────────────────────────────────────────────────────────────────────────────
//  sport-cricket.js  —  Guided cricket scoring workflow
//  Called by score.js when schema.sport === "cricket"
// ─────────────────────────────────────────────────────────────────────────────

export function initCricket({ homeLabel, awayLabel, homePlayers, awayPlayers, state, onSave, renderPills }) {

  // ── State ──────────────────────────────────────────────────────────────────
  const cs = {
    tossWinner:   null,   // "home" | "away"
    tossChoice:   null,   // "bat" | "bowl"
    innings:      1,      // 1 or 2
    battingTeam:  null,   // "home" | "away"
    bowlingTeam:  null,
    striker:      null,
    nonStriker:   null,
    bowler:       null,
    over:         0,
    ball:         0,      // balls in current over (0-5)
    phase:        "toss", // toss | openers | bowler | delivery | innings_break | complete
    // per-player stats
    batting: {},  // { playerName: { runs, balls, fours, sixes, dismissal, dismissed } }
    bowling: {},  // { playerName: { overs, balls, runs, wickets } }
    extras: { wide: 0, noBall: 0, bye: 0, legBye: 0 },
    totalRuns:    { home: 0, away: 0 },
    totalWickets: { home: 0, away: 0 },
    fallOfWickets: [],
  };

  // Restore from existing state if present
  if (state.cricket) Object.assign(cs, state.cricket);

  function persist() {
    state.cricket = cs;
    onSave();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function teamLabel(side) { return side === "home" ? homeLabel : awayLabel; }
  function teamPlayers(side) { return side === "home" ? homePlayers : awayPlayers; }

  function ensureBatter(name) {
    if (!cs.batting[name]) cs.batting[name] = { runs: 0, balls: 0, fours: 0, sixes: 0, dismissal: null, dismissed: false };
    return cs.batting[name];
  }
  function ensureBowler(name) {
    if (!cs.bowling[name]) cs.bowling[name] = { overs: 0, balls: 0, runs: 0, wickets: 0 };
    return cs.bowling[name];
  }

  function availableBatters(side) {
    const all = teamPlayers(side);
    const dismissed = Object.entries(cs.batting).filter(([, v]) => v.dismissed).map(([k]) => k);
    const current = [cs.striker, cs.nonStriker].filter(Boolean);
    return all.filter(p => !dismissed.includes(p) && !current.includes(p));
  }

  function scoreString(side) {
    return `${cs.totalRuns[side]}/${cs.totalWickets[side]}`;
  }

  function oversString() {
    return `${cs.over}.${cs.ball}`;
  }

  function addRunsToBatter(runs) {
    if (!cs.striker) return;
    const b = ensureBatter(cs.striker);
    b.runs  += runs;
    b.balls += 1;
    if (runs === 4) b.fours++;
    if (runs === 6) b.sixes++;
  }

  function addRunsToBowler(runs, isWicket) {
    if (!cs.bowler) return;
    const b = ensureBowler(cs.bowler);
    b.runs += runs;
    b.balls++;
    if (isWicket) b.wickets++;
    if (b.balls >= 6) { b.overs++; b.balls = 0; }
  }

  function addRunsToTeam(runs) {
    cs.totalRuns[cs.battingTeam] += runs;
  }

  function swapStrike() {
    [cs.striker, cs.nonStriker] = [cs.nonStriker, cs.striker];
  }

  function advanceBall(isLegal = true) {
    if (!isLegal) return; // wides/no-balls don't count
    cs.ball++;
    if (cs.ball >= 6) {
      cs.ball = 0;
      cs.over++;
      swapStrike(); // end of over, strike swaps
      cs.phase = "bowler";
      render();
      return true; // signals end of over
    }
    return false;
  }

  // ── Sync master state for save/winner logic ────────────────────────────────
  function syncMasterState() {
    const A = state.state.A;
    const B = state.state.B;
    const hSide = cs.battingTeam === "home" ? A : B;
    const aSide = cs.battingTeam === "home" ? B : A;
    hSide.runs    = cs.totalRuns.home;
    hSide.wickets = cs.totalWickets.home;
    aSide.runs    = cs.totalRuns.away;
    aSide.wickets = cs.totalWickets.away;
    renderPills();
  }

  // ── UI root ────────────────────────────────────────────────────────────────
  const root = document.createElement("div");
  root.className = "sport-ui cricket-ui";

  function render() {
    root.innerHTML = "";
    switch (cs.phase) {
      case "toss":          renderToss();         break;
      case "openers":       renderOpeners();      break;
      case "bowler":        renderBowlerPick();   break;
      case "delivery":      renderDelivery();     break;
      case "wicket":        renderWicket();       break;
      case "next_batter":   renderNextBatter();   break;
      case "innings_break": renderInningsBreak(); break;
      case "complete":      renderComplete();     break;
    }
    syncMasterState();
  }

  // ── Scorecard header (shown during match) ──────────────────────────────────
  function scorecardHeader() {
    if (!cs.battingTeam) return "";
    return `
      <div class="cricket-scoreboard">
        <div class="cs-team ${cs.battingTeam === "home" ? "cs-batting" : ""}">
          <div class="cs-name">${homeLabel}</div>
          <div class="cs-score">${scoreString("home")}</div>
        </div>
        <div class="cs-center">
          <div class="cs-overs">${oversString()} ov</div>
          <div class="cs-vs">vs</div>
        </div>
        <div class="cs-team ${cs.battingTeam === "away" ? "cs-batting" : ""}">
          <div class="cs-name">${awayLabel}</div>
          <div class="cs-score">${scoreString("away")}</div>
        </div>
      </div>
      <div class="cs-live-bar">
        ${cs.striker ? `<span class="cs-pill bat">🏏 ${cs.striker} (${ensureBatter(cs.striker).runs})</span>` : ""}
        ${cs.nonStriker ? `<span class="cs-pill">⚡ ${cs.nonStriker} (${ensureBatter(cs.nonStriker).runs})</span>` : ""}
        ${cs.bowler ? `<span class="cs-pill bowl">⚾ ${cs.bowler} ${ensureBowler(cs.bowler).overs}.${ensureBowler(cs.bowler).balls}-${ensureBowler(cs.bowler).runs}-${ensureBowler(cs.bowler).wickets}</span>` : ""}
      </div>`;
  }

  // ── Toss ───────────────────────────────────────────────────────────────────
  function renderToss() {
    root.innerHTML = `
      <div class="guided-card">
        <div class="gc-step">Step 1 of 3</div>
        <div class="gc-title">🪙 Toss</div>
        <div class="gc-label">Who won the toss?</div>
        <div class="gc-options">
          <button class="gc-opt" data-val="home">${homeLabel}</button>
          <button class="gc-opt" data-val="away">${awayLabel}</button>
        </div>
      </div>`;
    root.querySelectorAll(".gc-opt").forEach(btn => {
      btn.addEventListener("click", () => {
        cs.tossWinner = btn.dataset.val;
        renderTossChoice();
      });
    });
  }

  function renderTossChoice() {
    root.innerHTML = `
      <div class="guided-card">
        <div class="gc-step">Step 2 of 3</div>
        <div class="gc-title">🪙 Toss — ${teamLabel(cs.tossWinner)} won</div>
        <div class="gc-label">Choose to…</div>
        <div class="gc-options">
          <button class="gc-opt" data-val="bat">🏏 Bat</button>
          <button class="gc-opt" data-val="bowl">⚾ Bowl</button>
        </div>
      </div>`;
    root.querySelectorAll(".gc-opt").forEach(btn => {
      btn.addEventListener("click", () => {
        cs.tossChoice   = btn.dataset.val;
        cs.battingTeam  = cs.tossChoice === "bat" ? cs.tossWinner : (cs.tossWinner === "home" ? "away" : "home");
        cs.bowlingTeam  = cs.battingTeam === "home" ? "away" : "home";
        cs.phase        = "openers";
        persist();
        render();
      });
    });
  }

  // ── Opening batsmen ────────────────────────────────────────────────────────
  function renderOpeners() {
    const players = teamPlayers(cs.battingTeam);
    root.innerHTML = `
      <div class="guided-card">
        <div class="gc-step">Step 3 of 3 — ${teamLabel(cs.battingTeam)} batting</div>
        <div class="gc-title">🏏 Opening Batsmen</div>
        <div class="gc-label">Striker</div>
        ${dropdown("striker-sel", players, cs.striker)}
        <div class="gc-label" style="margin-top:10px">Non-striker</div>
        ${dropdown("nonstriker-sel", players, cs.nonStriker)}
        <button class="gc-confirm" id="confirm-openers">Confirm & pick bowler →</button>
      </div>`;
    root.getElementById?.("confirm-openers") || root.querySelector("#confirm-openers");
    root.querySelector("#confirm-openers").addEventListener("click", () => {
      cs.striker    = root.querySelector("#striker-sel").value;
      cs.nonStriker = root.querySelector("#nonstriker-sel").value;
      if (cs.striker === cs.nonStriker) { alert("Striker and non-striker must be different players."); return; }
      ensureBatter(cs.striker);
      ensureBatter(cs.nonStriker);
      cs.phase = "bowler";
      persist();
      render();
    });
  }

  // ── Bowler pick ────────────────────────────────────────────────────────────
  function renderBowlerPick() {
    const players = teamPlayers(cs.bowlingTeam);
    root.innerHTML = `
      ${scorecardHeader()}
      <div class="guided-card">
        <div class="gc-title">⚾ Over ${cs.over + 1} — Who is bowling?</div>
        ${dropdown("bowler-sel", players, cs.bowler)}
        <button class="gc-confirm" id="confirm-bowler">Start over →</button>
      </div>`;
    root.querySelector("#confirm-bowler").addEventListener("click", () => {
      cs.bowler = root.querySelector("#bowler-sel").value;
      ensureBowler(cs.bowler);
      cs.phase  = "delivery";
      persist();
      render();
    });
  }

  // ── Delivery ───────────────────────────────────────────────────────────────
  const DELIVERY_OPTS = [
    { label: "0",       val: "dot",    runs: 0,  legal: true  },
    { label: "1",       val: "1",      runs: 1,  legal: true  },
    { label: "2",       val: "2",      runs: 2,  legal: true  },
    { label: "3",       val: "3",      runs: 3,  legal: true  },
    { label: "4 ▸",     val: "4",      runs: 4,  legal: true  },
    { label: "6 ▸▸",    val: "6",      runs: 6,  legal: true  },
    { label: "Wide",    val: "wide",   runs: 1,  legal: false },
    { label: "No Ball", val: "noball", runs: 1,  legal: false },
    { label: "Bye",     val: "bye",    runs: 0,  legal: true  },
    { label: "Leg Bye", val: "legbye", runs: 0,  legal: true  },
    { label: "🎯 Wicket", val: "wicket", runs: 0, legal: true },
  ];

  function renderDelivery() {
    root.innerHTML = `
      ${scorecardHeader()}
      <div class="guided-card">
        <div class="gc-title">Ball ${cs.over}.${cs.ball + 1} — What happened?</div>
        <div class="delivery-grid">
          ${DELIVERY_OPTS.map(o => `<button class="del-btn ${o.val === "wicket" ? "del-wicket" : o.val === "wide" || o.val === "noball" ? "del-extra" : ""}" data-val="${o.val}">${o.label}</button>`).join("")}
        </div>
      </div>`;

    root.querySelectorAll(".del-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const opt = DELIVERY_OPTS.find(o => o.val === btn.dataset.val);
        handleDelivery(opt);
      });
    });
  }

  function handleDelivery(opt) {
    if (opt.val === "wicket") {
      cs.phase = "wicket";
      render();
      return;
    }

    let runs = opt.runs;

    // extras handling
    if (opt.val === "wide")   { cs.extras.wide++;   addRunsToTeam(1); addRunsToBowler(1, false); }
    else if (opt.val === "noball") { cs.extras.noBall++; addRunsToTeam(1); addRunsToBowler(1, false); }
    else if (opt.val === "bye")    { cs.extras.bye++;  }
    else if (opt.val === "legbye") { cs.extras.legBye++; }
    else {
      addRunsToBatter(runs);
      addRunsToTeam(runs);
      addRunsToBowler(runs, false);
      // odd runs = strike rotates
      if (runs % 2 !== 0) swapStrike();
    }

    const endOfOver = advanceBall(opt.legal);
    persist();
    if (!endOfOver) render();
  }

  // ── Wicket ────────────────────────────────────────────────────────────────
  const DISMISSAL_TYPES = ["Bowled", "Caught", "LBW", "Run Out", "Stumped", "Hit Wicket"];

  function renderWicket() {
    root.innerHTML = `
      ${scorecardHeader()}
      <div class="guided-card">
        <div class="gc-title">🎯 Wicket!</div>
        <div class="gc-label">Who is out?</div>
        <div class="gc-options">
          ${cs.striker    ? `<button class="gc-opt" data-batter="${cs.striker}">${cs.striker} (striker)</button>` : ""}
          ${cs.nonStriker ? `<button class="gc-opt" data-batter="${cs.nonStriker}">${cs.nonStriker} (non-striker)</button>` : ""}
        </div>
        <div class="gc-label" style="margin-top:12px">Dismissal type</div>
        <div class="gc-options small">
          ${DISMISSAL_TYPES.map(d => `<button class="gc-opt small" data-dismissal="${d}">${d}</button>`).join("")}
        </div>
      </div>`;

    let selectedBatter  = cs.striker;
    let selectedDismiss = null;

    root.querySelectorAll("[data-batter]").forEach(btn => {
      btn.addEventListener("click", () => {
        root.querySelectorAll("[data-batter]").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        selectedBatter = btn.dataset.batter;
        checkConfirm();
      });
    });

    root.querySelectorAll("[data-dismissal]").forEach(btn => {
      btn.addEventListener("click", () => {
        root.querySelectorAll("[data-dismissal]").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        selectedDismiss = btn.dataset.dismissal;
        checkConfirm();
      });
    });

    function checkConfirm() {
      if (!selectedBatter || !selectedDismiss) return;
      applyWicket(selectedBatter, selectedDismiss);
    }
  }

  function applyWicket(batter, dismissal) {
    const b = ensureBatter(batter);
    b.dismissed = true;
    b.dismissal = dismissal;
    b.balls++;

    addRunsToBowler(0, true);
    cs.totalWickets[cs.battingTeam]++;
    cs.fallOfWickets.push({ wicket: cs.totalWickets[cs.battingTeam], score: cs.totalRuns[cs.battingTeam], over: `${cs.over}.${cs.ball}`, batter });

    // if striker out, non-striker becomes striker
    if (batter === cs.striker) cs.striker = null;
    else cs.nonStriker = null;

    const available = availableBatters(cs.battingTeam);
    const allOut    = cs.totalWickets[cs.battingTeam] >= teamPlayers(cs.battingTeam).length - 1;

    const endOfOver = advanceBall(true);

    if (allOut) {
      if (cs.innings === 1) { cs.phase = "innings_break"; }
      else                  { cs.phase = "complete"; }
      persist();
      render();
      return;
    }

    cs.phase = "next_batter";
    persist();
    if (!endOfOver) render();
  }

  // ── Next batter ────────────────────────────────────────────────────────────
  function renderNextBatter() {
    const available = availableBatters(cs.battingTeam);
    if (!available.length) {
      cs.phase = cs.innings === 1 ? "innings_break" : "complete";
      render(); return;
    }
    const which = !cs.striker ? "Striker" : "Non-striker";
    root.innerHTML = `
      ${scorecardHeader()}
      <div class="guided-card">
        <div class="gc-title">🏏 Next Batsman (${which})</div>
        ${dropdown("next-bat-sel", available, available[0])}
        <button class="gc-confirm" id="confirm-next-bat">Confirm →</button>
      </div>`;
    root.querySelector("#confirm-next-bat").addEventListener("click", () => {
      const name = root.querySelector("#next-bat-sel").value;
      ensureBatter(name);
      if (!cs.striker) cs.striker = name;
      else cs.nonStriker = name;
      cs.phase = cs.ball === 0 ? "bowler" : "delivery";
      persist();
      render();
    });
  }

  // ── Innings break ─────────────────────────────────────────────────────────
  function renderInningsBreak() {
    const newBatting = cs.bowlingTeam;
    root.innerHTML = `
      <div class="guided-card">
        <div class="gc-title">🔄 End of Innings 1</div>
        <div class="gc-summary">
          <strong>${teamLabel(cs.battingTeam)}</strong> scored <strong>${scoreString(cs.battingTeam)}</strong><br/>
          Target: <strong>${cs.totalRuns[cs.battingTeam] + 1}</strong> runs
        </div>
        <button class="gc-confirm" id="start-innings2">Start Innings 2 →</button>
      </div>`;
    root.querySelector("#start-innings2").addEventListener("click", () => {
      cs.innings      = 2;
      const prev      = cs.battingTeam;
      cs.battingTeam  = cs.bowlingTeam;
      cs.bowlingTeam  = prev;
      cs.striker      = null;
      cs.nonStriker   = null;
      cs.bowler       = null;
      cs.over         = 0;
      cs.ball         = 0;
      cs.phase        = "openers";
      persist();
      render();
    });
  }

  // ── Complete ──────────────────────────────────────────────────────────────
  function renderComplete() {
    const homeRuns = cs.totalRuns.home;
    const awayRuns = cs.totalRuns.away;
    const winner   = homeRuns > awayRuns ? homeLabel : awayRuns > homeRuns ? awayLabel : "Tie";
    root.innerHTML = `
      <div class="guided-card">
        <div class="gc-title">🏆 Match Complete</div>
        <div class="cs-final">
          <div>${homeLabel}: <strong>${scoreString("home")}</strong></div>
          <div>${awayLabel}: <strong>${scoreString("away")}</strong></div>
          <div class="cs-winner">Winner: ${winner}</div>
        </div>
        ${renderScorecardTable()}
      </div>`;
  }

  function renderScorecardTable() {
    const batting = Object.entries(cs.batting).map(([name, s]) =>
      `<tr><td>${name}</td><td>${s.runs}</td><td>${s.balls}</td><td>${s.fours}</td><td>${s.sixes}</td><td>${s.dismissed ? s.dismissal : "not out"}</td></tr>`
    ).join("");
    return `
      <div class="scorecard-table-wrap">
        <table class="scorecard-table">
          <thead><tr><th>Batter</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>How out</th></tr></thead>
          <tbody>${batting}</tbody>
        </table>
      </div>`;
  }

  // ── Dropdown helper ────────────────────────────────────────────────────────
  function dropdown(id, players, selected) {
    return `<select class="gc-select" id="${id}">
      ${players.map(p => `<option value="${p}" ${p === selected ? "selected" : ""}>${p}</option>`).join("")}
    </select>`;
  }

  // ── Mount ──────────────────────────────────────────────────────────────────
  render();
  return root;
}