import { requireAuth, logout } from "./auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;

  document.querySelectorAll(".brand").forEach((el) => {
    el.addEventListener("click", () => {
      window.location.href = "index.html";
    });
  });

  const trigger = document.getElementById("schedule-user-menu-trigger");
  const dropdown = document.getElementById("schedule-user-menu-dropdown");

  if (trigger) {
    const label = (user?.name || user?.username || user?.email || "U").trim();
    trigger.textContent = label.charAt(0).toUpperCase();
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

  playerBtn?.classList.add("is-active");
  hostBtn?.classList.remove("is-active");

  playerBtn?.addEventListener("click", async () => {
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
  if (!tournamentId) {
    alert("Missing tournamentId in URL");
    return;
  }

  const titleEl = document.getElementById("schedule-tournament-name");
  const metaEl = document.getElementById("schedule-tournament-meta");
  const emptyEl = document.getElementById("schedule-empty");

  const contentWrap = document.getElementById("schedule-content-wrap");
  const bracketWrap = document.getElementById("schedule-bracket-wrap");
  const liveWrap = document.getElementById("schedule-live-wrap");
  const leaderboardWrap = document.getElementById("schedule-leaderboard-wrap");

  const categoryToggle = document.getElementById("schedule-category-toggle");
  const groupsEl = document.getElementById("schedule-groups");
  const noneSelectedEl = document.getElementById("schedule-none-selected");

  const liveListEl = document.getElementById("schedule-live-list");
  const liveEmptyEl = document.getElementById("schedule-live-empty");

  const leaderboardBody = document.getElementById("schedule-leaderboard-body");
  const leaderboardTableWrap = document.getElementById("schedule-leaderboard-table-wrap");
  const leaderboardEmptyEl = document.getElementById("schedule-leaderboard-empty");

  const state = {
    tournamentMeta: null,
    fixtures: null,
    activeCategoryId: null,
    scoringSchema: null,
    leaderboard: [],
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

  function safeJson(value, fallback = null) {
    if (value == null) return fallback;
    if (typeof value === "object") return value;
    if (typeof value !== "string") return fallback;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
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
    const level = c?.playingLevel ? String(c.playingLevel).trim() : "";
    const size = c?.teamSize ? Number(c.teamSize) : null;
    const exact = c?.exactTeamSize ? Number(c.exactTeamSize) : null;

    let type = "";
    if (size === 1) type = "Singles";
    else if (size === 2) type = "Doubles";
    else if (size === 3) type = "Triples";
    else if (size >= 4) type = exact ? `Team ${exact}` : "Team";

    const parts = [age, gender, level, type].filter(Boolean);
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

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function switchView(view) {
    state.activeView = view;

    document.querySelectorAll(".schedule-view-tab").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === view);
    });

    bracketWrap?.classList.toggle("hidden", view !== "bracket");
    liveWrap?.classList.toggle("hidden", view !== "live");
    leaderboardWrap?.classList.toggle("hidden", view !== "leaderboard");
  }

  document.querySelectorAll(".schedule-view-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchView(btn.dataset.view);
    });
  });

  async function loadTournamentMeta() {
    const r = await apiGet("/api/tournaments");
    if (!r.ok) return null;

    const list = Array.isArray(r.data)
      ? r.data
      : Array.isArray(r.data?.data)
        ? r.data.data
        : Array.isArray(r.data?.tournaments)
          ? r.data.tournaments
          : [];

    return list.find((x) => String(x.tournamentId ?? x.id) === String(tournamentId)) || null;
  }

  async function loadFixtures() {
    const r = await apiGet(`/api/tournaments/${encodeURIComponent(tournamentId)}/fixtures`);
    if (!r.ok) return null;
    return migrateFixtures(r.data?.data || r.data || null);
  }

  async function loadScoringSchema() {
    const r = await apiGet(`/api/tournaments/${encodeURIComponent(tournamentId)}/scoring-schema`);
    if (!r.ok) return null;
    return r.data?.data || r.data || null;
  }

  async function loadLeaderboard() {
    const candidates = [
      `/api/tournaments/${encodeURIComponent(tournamentId)}/leaderboard`,
      `/api/host/tournaments/${encodeURIComponent(tournamentId)}/leaderboard`,
    ];

    for (const url of candidates) {
      const r = await apiGet(url);
      if (!r.ok) continue;

      if (Array.isArray(r.data)) return r.data;
      if (Array.isArray(r.data?.rows)) return r.data.rows;
      if (Array.isArray(r.data?.data)) return r.data.data;
    }

    return [];
  }

  function renderHeader() {
    titleEl.textContent = state.tournamentMeta?.tournamentName || "Tournament schedule";
    metaEl.textContent = [
      state.tournamentMeta?.sportName || "",
      state.tournamentMeta?.tournamentDates || "",
      state.tournamentMeta?.venue || "",
    ]
      .filter(Boolean)
      .join(" • ");
  }

  function renderCategoryToggles() {
    categoryToggle.innerHTML = "";

    const categories = normalizeCategories(state.tournamentMeta?.categories);
    if (!categories.length) {
      categoryToggle.innerHTML = `<div class="muted">No categories found.</div>`;
      return;
    }

    categories.forEach((category) => {
      const id = category.categoryId || category.id;
      if (!id) return;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "toggle-btn";
      btn.textContent = categoryLabel(category);

      if (String(state.activeCategoryId) === String(id)) btn.classList.add("active");

      btn.addEventListener("click", () => {
        state.activeCategoryId = id;
        categoryToggle.querySelectorAll(".toggle-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        noneSelectedEl.style.display = "none";
        renderBracketView();
      });

      categoryToggle.appendChild(btn);
    });
  }

  function renderLeaguePlaceholder() {
    groupsEl.innerHTML = `
      <div class="schedule-group">
        <div class="schedule-group-header">
          <h3 class="schedule-group-title">Advanced league / tie mode</h3>
        </div>
        <div class="empty-state">
          <div class="feature-icon">🏓</div>
          <h3>League tie rendering pending</h3>
          <p class="muted">
            This tournament is using the advanced league + knockout format.
            Schedule page is ready to show leaderboard and public updates, but full tie-round rendering
            still depends on backend tie-generation and public tie endpoints.
          </p>
        </div>
      </div>
    `;
  }

  function renderBracketView() {
    groupsEl.innerHTML = "";

    if (!state.activeCategoryId) {
      noneSelectedEl.style.display = "flex";
      return;
    }

    const advanced = safeJson(state.tournamentMeta?.advancedSettings, state.tournamentMeta?.advancedSettings) || {};
    const isLeagueMode =
      state.tournamentMeta?.stageFormat === "number_draw_league_knockout" ||
      advanced?.advancedMode === "pickleball_team_league";

    if (isLeagueMode) {
      renderLeaguePlaceholder();
      return;
    }

    const cat = state.fixtures?.categories?.[state.activeCategoryId];
    if (!cat || !Array.isArray(cat.rounds) || !cat.rounds.length) {
      groupsEl.innerHTML = `
        <div class="empty-state">
          <div class="feature-icon">📅</div>
          <h3>No schedule found</h3>
          <p class="muted">Fixtures are not available for this category yet.</p>
        </div>
      `;
      return;
    }

    const roundsHtml = cat.rounds
      .map((round, r) => {
        const matches = round
          .map((m) => {
            const homeScore = getSlotScore(m, "home", state.scoringSchema?.winnerLogic?.field);
            const awayScore = getSlotScore(m, "away", state.scoringSchema?.winnerLogic?.field);

            return `
              <div class="bk-card">
                <div class="fixture-line">
                  <span>${escapeHtml(m?.home ?? "BYE")}</span>
                  <span class="fixture-score">${homeScore ?? ""}</span>
                </div>
                <div class="fixture-line">
                  <span>${escapeHtml(m?.away ?? "BYE")}</span>
                  <span class="fixture-score">${awayScore ?? ""}</span>
                </div>
              </div>
            `;
          })
          .join("");

        return `
          <div class="schedule-round-col">
            <div class="round-title">${escapeHtml(getRoundLabel(r, cat.totalRounds || cat.rounds.length))}</div>
            ${matches}
          </div>
        `;
      })
      .join("");

    groupsEl.innerHTML = `
      <div class="schedule-group">
        <div class="schedule-group-header">
          <h3 class="schedule-group-title">${escapeHtml(cat.label || "Category")}</h3>
        </div>
        <div class="schedule-bracket">
          <div class="schedule-rounds">${roundsHtml}</div>
        </div>
      </div>
    `;
  }

  function renderLiveView() {
    liveListEl.innerHTML = "";

    const categories = state.fixtures?.categories || {};
    const liveCards = [];

    Object.keys(categories).forEach((cid) => {
      const cat = categories[cid];
      (cat.rounds || []).forEach((round, roundIndex) => {
        round.forEach((match, matchIndex) => {
          if (!match?.score?.state) return;

          const homeScore = getSlotScore(match, "home", state.scoringSchema?.winnerLogic?.field);
          const awayScore = getSlotScore(match, "away", state.scoringSchema?.winnerLogic?.field);

          const homePlayers = Array.isArray(match.homePlayers) ? match.homePlayers : splitTeamName(match.home);
          const awayPlayers = Array.isArray(match.awayPlayers) ? match.awayPlayers : splitTeamName(match.away);

          liveCards.push({
            categoryLabel: cat.label || cid,
            roundIndex,
            matchIndex,
            home: match.home || "Home",
            away: match.away || "Away",
            homeScore,
            awayScore,
            homePlayers,
            awayPlayers,
            match,
          });
        });
      });
    });

    if (!liveCards.length) {
      liveEmptyEl.classList.remove("hidden");
      return;
    }

    liveEmptyEl.classList.add("hidden");

    liveCards.forEach((item) => {
      const homePlayerRows = item.homePlayers
        .map((name) => {
          const playerScore = getPlayerLiveScore(item.match, "home", name, state.scoringSchema?.winnerLogic?.field);
          return `<div class="live-player-row"><span>${escapeHtml(name)}</span><span>${playerScore ?? ""}</span></div>`;
        })
        .join("");

      const awayPlayerRows = item.awayPlayers
        .map((name) => {
          const playerScore = getPlayerLiveScore(item.match, "away", name, state.scoringSchema?.winnerLogic?.field);
          return `<div class="live-player-row"><span>${escapeHtml(name)}</span><span>${playerScore ?? ""}</span></div>`;
        })
        .join("");

      const card = document.createElement("div");
      card.className = "live-score-card";
      card.innerHTML = `
        <div class="live-score-top">
          <span class="live-badge">${escapeHtml(item.categoryLabel)}</span>
          <span class="live-badge">Round ${item.roundIndex + 1}</span>
        </div>

        <div class="live-score-main">
          <div class="live-team-block">
            <div class="live-team-name">${escapeHtml(item.home)}</div>
            <div class="live-team-score">${item.homeScore ?? "-"}</div>
            <div class="live-player-list">${homePlayerRows || `<div class="muted">No players</div>`}</div>
          </div>

          <div class="live-vs">VS</div>

          <div class="live-team-block">
            <div class="live-team-name">${escapeHtml(item.away)}</div>
            <div class="live-team-score">${item.awayScore ?? "-"}</div>
            <div class="live-player-list">${awayPlayerRows || `<div class="muted">No players</div>`}</div>
          </div>
        </div>
      `;
      liveListEl.appendChild(card);
    });
  }

  function renderLeaderboard() {
    leaderboardBody.innerHTML = "";

    if (!state.leaderboard.length) {
      leaderboardEmptyEl.classList.remove("hidden");
      leaderboardTableWrap.classList.add("hidden");
      return;
    }

    leaderboardEmptyEl.classList.add("hidden");
    leaderboardTableWrap.classList.remove("hidden");

    state.leaderboard.forEach((row, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${escapeHtml(row.teamName || "—")}</td>
        <td>${escapeHtml(row.matchPoints ?? 0)}</td>
        <td>${escapeHtml(row.tiesWon ?? 0)}</td>
        <td>${escapeHtml(row.headToHead ?? "—")}</td>
        <td>${escapeHtml(row.qualified ? "Yes" : "No")}</td>
      `;
      leaderboardBody.appendChild(tr);
    });
  }

  async function init() {
    state.tournamentMeta = await loadTournamentMeta();

    if (!state.tournamentMeta) {
      contentWrap?.classList.add("hidden");
      emptyEl?.classList.remove("hidden");
      titleEl.textContent = "Tournament not found";
      metaEl.textContent = "Could not load tournament metadata.";
      return;
    }

    state.fixtures = await loadFixtures();
    state.scoringSchema = await loadScoringSchema();
    state.leaderboard = await loadLeaderboard();

    const categories = normalizeCategories(state.tournamentMeta?.categories);
    state.activeCategoryId = String(categories?.[0]?.categoryId || categories?.[0]?.id || "");

    renderHeader();
    renderCategoryToggles();
    renderBracketView();
    renderLiveView();
    renderLeaderboard();

    if (!state.fixtures?.categories) {
      emptyEl?.classList.remove("hidden");
    } else {
      emptyEl?.classList.add("hidden");
    }

    switchView("bracket");
  }

  await init();
});