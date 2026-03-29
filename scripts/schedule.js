import { requireAuth, logout } from "./auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;

  document.querySelectorAll(".brand").forEach((el) => {
    el.addEventListener("click", () => {
      window.location.href = "index.html";
    });
  });

  // topbar avatar style same as players page
  const trigger = document.getElementById("schedule-user-menu-trigger");
  const dropdown = document.getElementById("schedule-user-menu-dropdown");

  if (trigger) {
    const label = (user?.name || user?.username || user?.email || "U").trim();
    trigger.textContent = label.charAt(0).toUpperCase();
  }

  trigger?.addEventListener("click", () => {
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

  playerBtn?.classList.add("is-active");
  hostBtn?.classList.remove("is-active");

  playerBtn?.addEventListener("click", async () => {
    playerBtn.classList.add("is-active");
    hostBtn?.classList.remove("is-active");

    try {
      await fetch("/api/user/mode", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
        body: JSON.stringify({ mode: "player" }),
      });
    } catch {}

    window.location.href = "join.html";
  });

  hostBtn?.addEventListener("click", async () => {
    hostBtn.classList.add("is-active");
    playerBtn?.classList.remove("is-active");

    try {
      await fetch("/api/user/mode", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
        body: JSON.stringify({ mode: "host" }),
      });
    } catch {}

    window.location.href = "host.html";
  });

  const backBtn = document.getElementById("back-to-join");
  backBtn?.addEventListener("click", () => {
    window.location.href = "join.html";
  });

  const params = new URLSearchParams(window.location.search);
  const tournamentId = params.get("tournamentId");
  if (!tournamentId) return;

  const titleEl = document.getElementById("schedule-tournament-name");
  const metaEl = document.getElementById("schedule-tournament-meta");
  const emptyEl = document.getElementById("schedule-empty");

  const contentWrap = document.getElementById("schedule-content-wrap");
  const bracketWrap = document.getElementById("schedule-bracket-wrap");
  const liveWrap = document.getElementById("schedule-live-wrap");

  const categoryToggle = document.getElementById("schedule-category-toggle");
  const groupsEl = document.getElementById("schedule-groups");
  const noneSelectedEl = document.getElementById("schedule-none-selected");

  const liveListEl = document.getElementById("schedule-live-list");
  const liveEmptyEl = document.getElementById("schedule-live-empty");

  const state = {
    tournamentMeta: null,
    fixtures: null,
    activeCategoryId: null,
    scoringSchema: null,
    activeView: "bracket",
  };

  async function apiGet(url) {
    const res = await fetch(url, {
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
    });

    const raw = await res.text();
    let data = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = raw;
    }

    return { ok: res.ok, status: res.status, data };
  }

  function normalizeCategories(cats) {
    if (!cats) return [];
    if (Array.isArray(cats)) return cats;
    if (typeof cats === "string") {
      try {
        const parsed = JSON.parse(cats);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  function categoryLabel(c) {
    const age = c?.ageGroup ? String(c.ageGroup).trim() : "";
    const gender = c?.gender ? String(c.gender).trim() : "";
    const size = c?.teamSize ? Number(c.teamSize) : null;

    const type =
      size === 1 ? "Singles" : size === 2 ? "Doubles" : size ? `Team ${size}` : "";

    const parts = [age, gender, type].filter(Boolean);
    return parts.length ? parts.join(" • ") : (c?.categoryId || c?.id || "Category");
  }

  function splitTeamName(teamName) {
    const t = String(teamName || "").trim();
    const up = t.toUpperCase();
    if (!t || up === "BYE" || up === "TBD") return [];
    return t.split(" + ").map((x) => x.trim()).filter(Boolean);
  }

  function ensureMatchMeta(m) {
    if (!m || typeof m !== "object") return m;
    if (!m.matchId) {
      if (window.crypto && crypto.randomUUID) {
        m.matchId = "M-" + crypto.randomUUID();
      } else {
        m.matchId = "M-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      }
    }
    if (!Array.isArray(m.homePlayers)) m.homePlayers = splitTeamName(m.home);
    if (!Array.isArray(m.awayPlayers)) m.awayPlayers = splitTeamName(m.away);
    return m;
  }

  function migrateFixtures(fixturesObj) {
    if (!fixturesObj?.categories) return fixturesObj;
    Object.values(fixturesObj.categories).forEach((cat) => {
      if (!cat?.rounds) return;
      cat.rounds.forEach((round) => {
        if (!Array.isArray(round)) return;
        round.forEach((m) => {
          if (m && typeof m === "object") ensureMatchMeta(m);
        });
      });
    });
    return fixturesObj;
  }

  function getRoundLabel(r, totalRounds) {
    if (totalRounds <= 0) return "Round";
    const remaining = totalRounds - r;
    if (remaining === 1) return "Final";
    if (remaining === 2) return "Semi-final";
    if (remaining === 3) return "Quarter-final";
    return `Round ${r + 1}`;
  }

  function getSlotScore(match, side, scoreKey) {
    if (!match?.score?.state) return null;
    const bucket = side === "home" ? match.score.state.A : match.score.state.B;
    if (!bucket) return null;

    if (scoreKey && bucket[scoreKey] !== undefined && bucket[scoreKey] !== null) {
      return bucket[scoreKey];
    }

    if (bucket.points !== undefined && bucket.points !== null) return bucket.points;
    if (bucket.score !== undefined && bucket.score !== null) return bucket.score;
    if (bucket.goals !== undefined && bucket.goals !== null) return bucket.goals;
    if (bucket.runs !== undefined && bucket.runs !== null) return bucket.runs;
    return null;
  }

  function getPlayerLiveScore(match, side, playerName, scoreKey) {
    const teamKey = side === "home" ? "A" : "B";
    const playerState = match?.score?.state?.[teamKey]?.players?.[playerName];
    if (!playerState) return null;

    if (scoreKey && playerState[scoreKey] !== undefined && playerState[scoreKey] !== null) {
      return playerState[scoreKey];
    }

    if (playerState.points !== undefined && playerState.points !== null) return playerState.points;
    if (playerState.goals !== undefined && playerState.goals !== null) return playerState.goals;
    if (playerState.runs !== undefined && playerState.runs !== null) return playerState.runs;
    if (playerState.score !== undefined && playerState.score !== null) return playerState.score;

    return null;
  }

  function setActiveView(view) {
    state.activeView = view;

    document.querySelectorAll(".schedule-view-tab").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === view);
    });

    bracketWrap.style.display = view === "bracket" ? "block" : "none";
    liveWrap.style.display = view === "live" ? "block" : "none";
  }

  function wireViewTabs() {
    document.querySelectorAll(".schedule-view-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        setActiveView(btn.dataset.view || "bracket");
      });
    });
  }

  function renderCategoryToggles(categories) {
    if (!categoryToggle) return;
    categoryToggle.innerHTML = "";

    categories.forEach((c) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "toggle-btn";
      btn.textContent = c.label || "Category";

      if (String(state.activeCategoryId) === String(c.id)) {
        btn.classList.add("active");
      }

      btn.addEventListener("click", () => {
        state.activeCategoryId = c.id;
        noneSelectedEl && (noneSelectedEl.style.display = "none");

        categoryToggle.querySelectorAll(".toggle-btn").forEach((b) => {
          b.classList.remove("active");
        });
        btn.classList.add("active");

        renderCategoryBracket(c.id);
      });

      categoryToggle.appendChild(btn);
    });
  }

  function renderCategoryBracket(categoryId) {
    if (!groupsEl) return;
    groupsEl.innerHTML = "";

    const cat = state.fixtures?.categories?.[categoryId];
    if (!cat || !Array.isArray(cat.rounds) || !cat.rounds.length) {
      groupsEl.innerHTML = `
        <div class="empty-state" style="display:flex;">
          <div class="feature-icon">🧩</div>
          <h3>No fixtures yet</h3>
          <p class="muted">Fixtures have not been published for this category.</p>
        </div>
      `;
      return;
    }

    const scoreKey = state.scoringSchema?.winnerLogic?.field || "points";
    const totalRounds = cat.totalRounds || cat.total_rounds || cat.rounds.length;

    const COL_W = 220;
    const COL_GAP = 56;
    const CARD_H = 132;
    const ROW_GAP = 16;
    const HEADER_H = 32;
    const PAD_V = 12;
    const PAD_H = 12;

    const tops = [];
    const UNIT = CARD_H + ROW_GAP;

    tops.push(cat.rounds[0].map((_, i) => HEADER_H + PAD_V + i * UNIT));

    for (let r = 1; r < cat.rounds.length; r++) {
      const prev = tops[r - 1];
      tops.push(cat.rounds[r].map((_, i) => {
        const f1 = i * 2;
        const f2 = i * 2 + 1;
        const mid1 = (prev[f1] ?? prev[prev.length - 1]) + CARD_H / 2;
        const mid2 = (prev[f2] ?? mid1) + CARD_H / 2;
        return Math.round((mid1 + mid2) / 2 - CARD_H / 2);
      }));
    }

    const canvasH = tops.reduce((max, rt) => {
      const last = rt[rt.length - 1] ?? 0;
      return Math.max(max, last + CARD_H + PAD_V);
    }, 200);

    const canvasW = PAD_H + cat.rounds.length * (COL_W + COL_GAP);

    function slotHtml(name, score, isBye) {
      return `
        <div class="bk-slot${isBye ? " bk-bye" : ""}">
          <span class="bk-slot-name">${name}</span>
          <span class="bk-slot-score ${score === null || score === undefined ? "is-empty" : ""}">
            ${score === null || score === undefined ? "-" : score}
          </span>
        </div>
      `;
    }

    function buildCard(m, r, i) {
      const home = m?.home ?? "TBD";
      const away = m?.away ?? "TBD";
      const homeBye = String(home).toUpperCase() === "BYE";
      const awayBye = String(away).toUpperCase() === "BYE";

      const homeScore = getSlotScore(m, "home", scoreKey);
      const awayScore = getSlotScore(m, "away", scoreKey);

      const scoreSummary =
        homeScore !== null && awayScore !== null ? `${homeScore} – ${awayScore}` : "Score not available";

      return `
        <div class="bk-card" style="width:${COL_W}px;height:${CARD_H}px;">
          <div class="bk-match-label">Match ${i + 1}</div>
          ${slotHtml(home, homeScore, homeBye)}
          ${slotHtml(away, awayScore, awayBye)}
          <div class="bk-footer">
            <span class="bk-score-summary">${scoreSummary}</span>
            ${m?.winner ? `<span class="bk-winner-badge">🏆 ${m.winner}</span>` : ""}
          </div>
        </div>
      `;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "schedule-group";
    wrapper.innerHTML = `
      <div class="schedule-group-header">
        <h2 class="schedule-group-title">${cat.label || "Fixtures"}</h2>
      </div>
    `;

    const bracketOuter = document.createElement("div");
    bracketOuter.className = "schedule-bracket";

    const canvas = document.createElement("div");
    canvas.style.cssText = `position:relative;height:${canvasH}px;width:${canvasW}px;`;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.style.cssText = `position:absolute;top:0;left:0;width:${canvasW}px;height:${canvasH}px;pointer-events:none;overflow:visible;`;

    for (let r = 1; r < cat.rounds.length; r++) {
      cat.rounds[r].forEach((_, i) => {
        const x1 = PAD_H + (r - 1) * (COL_W + COL_GAP) + COL_W;
        const x2 = PAD_H + r * (COL_W + COL_GAP);
        const midX = (x1 + x2) / 2;
        const myMidY = tops[r][i] + CARD_H / 2;
        const prev = tops[r - 1];

        [i * 2, i * 2 + 1].forEach((fi) => {
          if (fi >= prev.length) return;
          const fMidY = prev[fi] + CARD_H / 2;
          const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
          path.setAttribute("d", `M ${x1} ${fMidY} H ${midX} V ${myMidY} H ${x2}`);
          path.setAttribute("fill", "none");
          path.setAttribute("stroke", "rgba(77,208,225,0.40)");
          path.setAttribute("stroke-width", "1.5");
          path.setAttribute("stroke-linecap", "round");
          path.setAttribute("stroke-linejoin", "round");
          svg.appendChild(path);
        });
      });
    }

    canvas.appendChild(svg);

    cat.rounds.forEach((round, r) => {
      const colLeft = PAD_H + r * (COL_W + COL_GAP);

      const lbl = document.createElement("div");
      lbl.className = "round-title";
      lbl.style.cssText = `position:absolute;left:${colLeft}px;top:${PAD_V}px;width:${COL_W}px;height:${HEADER_H}px;display:flex;align-items:center;`;
      lbl.textContent = getRoundLabel(r, totalRounds);
      canvas.appendChild(lbl);

      round.forEach((m, i) => {
        const wrap = document.createElement("div");
        wrap.style.cssText = `position:absolute;left:${colLeft}px;top:${tops[r][i]}px;`;
        wrap.innerHTML = buildCard(m, r, i);
        canvas.appendChild(wrap);
      });
    });

    bracketOuter.appendChild(canvas);
    wrapper.appendChild(bracketOuter);
    groupsEl.appendChild(wrapper);
  }

  function renderLiveScores() {
    if (!liveListEl) return;
    liveListEl.innerHTML = "";

    const scoreKey = state.scoringSchema?.winnerLogic?.field || "points";
    const liveMatches = [];

    const categories = state.fixtures?.categories || {};
    Object.keys(categories).forEach((cid) => {
      const cat = categories[cid];
      const rounds = Array.isArray(cat?.rounds) ? cat.rounds : [];

      rounds.forEach((round, roundIndex) => {
        round.forEach((match, matchIndex) => {
          const hasScore =
            match?.score &&
            match?.score?.state &&
            (
              match?.score?.state?.A ||
              match?.score?.state?.B
            );

          const isActiveLike =
            hasScore &&
            !match?.winner &&
            String(match?.home || "").toUpperCase() !== "BYE" &&
            String(match?.away || "").toUpperCase() !== "BYE" &&
            String(match?.home || "").toUpperCase() !== "TBD" &&
            String(match?.away || "").toUpperCase() !== "TBD";

          if (!isActiveLike) return;

          liveMatches.push({
            categoryLabel: cat?.label || cid,
            roundIndex,
            matchIndex,
            match,
          });
        });
      });
    });

    if (!liveMatches.length) {
      liveEmptyEl.style.display = "flex";
      return;
    }

    liveEmptyEl.style.display = "none";

    liveMatches.forEach((item) => {
      const match = item.match;
      const homeName = match?.home || "Home";
      const awayName = match?.away || "Away";

      const homeScore = getSlotScore(match, "home", scoreKey);
      const awayScore = getSlotScore(match, "away", scoreKey);

      const homePlayers = Array.isArray(match?.homePlayers) ? match.homePlayers : splitTeamName(match?.home);
      const awayPlayers = Array.isArray(match?.awayPlayers) ? match.awayPlayers : splitTeamName(match?.away);

      const homePlayersHtml = homePlayers.length
        ? homePlayers.map((player) => {
            const ps = getPlayerLiveScore(match, "home", player, scoreKey);
            return `
              <div class="live-player-row">
                <span class="live-player-name">${player}</span>
                <span class="live-player-score">${ps === null || ps === undefined ? "-" : ps}</span>
              </div>
            `;
          }).join("")
        : `<div class="live-player-row"><span class="live-player-name">${homeName}</span><span class="live-player-score">${homeScore ?? "-"}</span></div>`;

      const awayPlayersHtml = awayPlayers.length
        ? awayPlayers.map((player) => {
            const ps = getPlayerLiveScore(match, "away", player, scoreKey);
            return `
              <div class="live-player-row">
                <span class="live-player-name">${player}</span>
                <span class="live-player-score">${ps === null || ps === undefined ? "-" : ps}</span>
              </div>
            `;
          }).join("")
        : `<div class="live-player-row"><span class="live-player-name">${awayName}</span><span class="live-player-score">${awayScore ?? "-"}</span></div>`;

      const card = document.createElement("div");
      card.className = "live-score-card";
      card.innerHTML = `
        <div class="live-score-top">
          <div class="live-score-meta">${item.categoryLabel} • Round ${item.roundIndex + 1} • Match ${item.matchIndex + 1}</div>
          <div class="live-pill">Live</div>
        </div>

        <div class="live-scoreboard">
          <div class="live-team">
            <div class="live-team-name">${homeName}</div>
            <div class="live-team-score">${homeScore === null || homeScore === undefined ? "-" : homeScore}</div>
            <div class="live-players">${homePlayersHtml}</div>
          </div>

          <div class="live-vs">vs</div>

          <div class="live-team">
            <div class="live-team-name">${awayName}</div>
            <div class="live-team-score">${awayScore === null || awayScore === undefined ? "-" : awayScore}</div>
            <div class="live-players">${awayPlayersHtml}</div>
          </div>
        </div>
      `;

      liveListEl.appendChild(card);
    });
  }

  async function loadMeta() {
    const res = await apiGet(`/api/tournaments/${encodeURIComponent(tournamentId)}`);
    if (!res.ok || !res.data) return;

    const t = res.data;
    state.tournamentMeta = t;

    if (titleEl) titleEl.textContent = t.tournamentName ?? "Tournament";
    if (metaEl) metaEl.textContent = [t.sportName, t.tournamentDates].filter(Boolean).join(" • ");
  }

  async function loadFixtures() {
    const res = await apiGet(`/api/tournaments/${encodeURIComponent(tournamentId)}/fixtures`);
    if (res.ok && res.data) {
      state.fixtures = migrateFixtures(res.data);
      return;
    }
    state.fixtures = null;
  }

  async function loadScoringSchema() {
    const res = await apiGet(`/api/tournaments/${encodeURIComponent(tournamentId)}/scoring-schema`);
    if (res.ok && res.data) {
      state.scoringSchema = res.data;
    }
  }

  await loadMeta();
  await loadFixtures();
  await loadScoringSchema();

  if (!state.fixtures?.categories || !Object.keys(state.fixtures.categories).length) {
    emptyEl && (emptyEl.style.display = "block");
    contentWrap && (contentWrap.style.display = "none");
    return;
  }

  const categoriesFromMeta = normalizeCategories(state.tournamentMeta?.categories);
  const fixtureCategoryIds = Object.keys(state.fixtures.categories);

  const categoryList = fixtureCategoryIds.map((cid) => {
    const found = categoriesFromMeta.find(
      (c) => String(c.categoryId || c.id) === String(cid)
    );

    return {
      id: cid,
      label: state.fixtures.categories[cid]?.label || categoryLabel(found || { categoryId: cid }),
    };
  });

  emptyEl && (emptyEl.style.display = "none");
  contentWrap && (contentWrap.style.display = "block");

  wireViewTabs();
  renderCategoryToggles(categoryList);
  renderLiveScores();
  setActiveView("bracket");

  if (categoryList.length) {
    state.activeCategoryId = categoryList[0].id;
    const firstBtn = categoryToggle?.querySelector(".toggle-btn");
    firstBtn?.classList.add("active");
    noneSelectedEl && (noneSelectedEl.style.display = "none");
    renderCategoryBracket(state.activeCategoryId);
  }
});