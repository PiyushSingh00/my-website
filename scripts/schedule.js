import { requireAuth, logout } from "./auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;

  const TEAM_EVENT_CATEGORY_ID = "__team_event__";

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

  const leaderboardGroupsEl = document.getElementById("schedule-leaderboard-groups");
  const leaderboardEmptyEl = document.getElementById("schedule-leaderboard-empty");

  const state = {
    tournamentMeta: null,
    fixtures: null,
    activeCategoryId: null,
    activeView: "bracket",
    refreshHandle: null,
  };

  async function apiGet(url) {
    const res = await fetch(url, {
      headers: {
        Authorization: "Bearer " + (localStorage.getItem("token") || ""),
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

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
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
    return parts.length ? parts.join(" • ") : (c?.eventName || c?.categoryId || c?.id || "Category");
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
    if (!fixturesObj || typeof fixturesObj !== "object") return fixturesObj;
    const categories = fixturesObj.categories || {};
    Object.values(categories).forEach((cat) => {
      if (Array.isArray(cat?.matches)) {
        cat.matches.forEach((m) => ensureMatchMeta(m));
      }
      if (Array.isArray(cat?.rounds)) {
        cat.rounds.forEach((round) => {
          if (!Array.isArray(round)) return;
          round.forEach((m) => ensureMatchMeta(m));
        });
      }
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

  function getBucketScore(bucket) {
    if (!bucket || typeof bucket !== "object") return null;
    const candidateKeys = ["points", "score", "goals", "runs"];
    for (const key of candidateKeys) {
      if (bucket[key] !== undefined && bucket[key] !== null && Number.isFinite(Number(bucket[key]))) {
        return Number(bucket[key]);
      }
    }
    const anyNumeric = Object.entries(bucket).find(([key, value]) => {
      return key !== "players" && key !== "meta" && Number.isFinite(Number(value));
    });
    return anyNumeric ? Number(anyNumeric[1]) : null;
  }

  function getPlayerStateScore(playerState) {
    if (!playerState || typeof playerState !== "object") return null;
    const candidateKeys = ["points", "score", "goals", "runs"];
    for (const key of candidateKeys) {
      if (playerState[key] !== undefined && playerState[key] !== null && Number.isFinite(Number(playerState[key]))) {
        return Number(playerState[key]);
      }
    }
    const anyNumeric = Object.entries(playerState).find(([, value]) => Number.isFinite(Number(value)));
    return anyNumeric ? Number(anyNumeric[1]) : null;
  }

  function getMatchSimpleSummary(match) {
    const score = match?.score || {};
    const a = getBucketScore(score?.state?.A);
    const b = getBucketScore(score?.state?.B);
    const hasAnyScore = a !== null || b !== null;
    const status = String(score?.computed?.status || (hasAnyScore ? "live" : "pending")).toLowerCase();
    return {
      mode: "simple",
      homeScore: a,
      awayScore: b,
      homeAux: null,
      awayAux: null,
      status,
      hasAnyScore,
      rows: [],
    };
  }

  function getMatchTeamSummary(match) {
    const submatches = Array.isArray(match?.submatches) ? match.submatches : [];
    if (submatches.length) {
      let homeWins = 0;
      let awayWins = 0;
      let homePoints = 0;
      let awayPoints = 0;
      const rows = [];
      let anyStarted = false;
      let anyCompleted = false;

      submatches.forEach((submatch, index) => {
        const score = submatch?.score || {};
        const home = getBucketScore(score?.state?.A);
        const away = getBucketScore(score?.state?.B);
        const hasRowScore = home !== null || away !== null;
        if (hasRowScore) anyStarted = true;
        const winnerSide = String(score?.computed?.winnerSide || score?.winnerSide || "").toUpperCase();
        const status = String(score?.computed?.status || (hasRowScore ? "live" : "pending")).toLowerCase();
        if (winnerSide === "A") {
          homeWins += 1;
          anyCompleted = true;
        }
        if (winnerSide === "B") {
          awayWins += 1;
          anyCompleted = true;
        }
        if (home !== null) homePoints += home;
        if (away !== null) awayPoints += away;
        rows.push({
          label: submatch?.roundLabel || submatch?.name || submatch?.label || `Submatch ${index + 1}`,
          homeDisplay: home ?? "-",
          awayDisplay: away ?? "-",
          status,
        });
      });

      return {
        mode: "team",
        homeScore: homeWins,
        awayScore: awayWins,
        homeAux: `${homePoints} pts`,
        awayAux: `${awayPoints} pts`,
        status: anyStarted ? (rows.every((row) => row.status === "completed") ? "completed" : "live") : "pending",
        hasAnyScore: anyStarted,
        rows,
      };
    }

    const simple = getMatchSimpleSummary(match);
    return {
      ...simple,
      mode: "team",
      homeAux: simple.homeScore !== null ? `${simple.homeScore} pts` : null,
      awayAux: simple.awayScore !== null ? `${simple.awayScore} pts` : null,
    };
  }

  function summarizeMatch(match, cat) {
    const displayMode = String(cat?.displayMode || "").toLowerCase();
    const isTeamSchedule = displayMode === "team_schedule" || String(cat?.categoryId || "") === TEAM_EVENT_CATEGORY_ID;
    return isTeamSchedule ? getMatchTeamSummary(match) : getMatchSimpleSummary(match);
  }

  function getCategoryMetaLabel(categoryId) {
    const cat = normalizeCategories(state.tournamentMeta?.categories).find(
      (item) => String(item?.categoryId || item?.id) === String(categoryId)
    );
    return cat ? categoryLabel(cat) : null;
  }

  function getFixtureCategoryEntries() {
    const categories = state.fixtures?.categories || {};
    return Object.entries(categories).map(([id, cat]) => ({
      id,
      cat,
      label: cat?.label || getCategoryMetaLabel(id) || (id === TEAM_EVENT_CATEGORY_ID ? "Team event" : id),
    }));
  }

  function getRounds(cat) {
    if (Array.isArray(cat?.rounds) && cat.rounds.length) return cat.rounds;
    if (Array.isArray(cat?.matches) && cat.matches.length) return [cat.matches];
    return [];
  }

  function getSectionId(view, categoryId) {
    return `schedule-${view}-section-${String(categoryId).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
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

  function renderQuickJump() {
    const entries = getFixtureCategoryEntries();
    categoryToggle.innerHTML = "";

    if (!entries.length) {
      categoryToggle.innerHTML = `<div class="muted-small">No schedule sections available.</div>`;
      return;
    }

    entries.forEach((entry, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "schedule-jump-btn";
      if ((state.activeCategoryId && String(state.activeCategoryId) === String(entry.id)) || (!state.activeCategoryId && index === 0)) {
        btn.classList.add("active");
      }
      btn.textContent = entry.label;
      btn.addEventListener("click", async () => {
        state.activeCategoryId = entry.id;
        categoryToggle.querySelectorAll(".schedule-jump-btn").forEach((chip) => chip.classList.remove("active"));
        btn.classList.add("active");

        if (state.activeView === "leaderboard") {
          await renderLeaderboardView(true);
        } else if (state.activeView === "live") {
          renderLiveView();
        } else {
          renderBracketView();
        }

        const target = document.getElementById(getSectionId(state.activeView, entry.id));
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      categoryToggle.appendChild(btn);
    });
  }

  function renderBracketView() {
    groupsEl.innerHTML = "";

    const entries = getFixtureCategoryEntries();
    if (!entries.length) {
      noneSelectedEl?.classList.remove("hidden");
      return;
    }

    noneSelectedEl?.classList.add("hidden");
    const wrapper = document.createElement("div");
    wrapper.className = "schedule-stack";

    entries.forEach((entry) => {
      const rounds = getRounds(entry.cat);
      const displayMode = String(entry.cat?.displayMode || "").toLowerCase();

      if (displayMode === "team_schedule") {
        const matches = Array.isArray(entry.cat?.matches) && entry.cat.matches.length
          ? entry.cat.matches
          : rounds.flat();

        const rowsHtml = matches.length
          ? matches.map((match, idx) => {
              const summary = summarizeMatch(match, entry.cat);
              const statusClass = summary.status === "completed" ? "final" : summary.status === "pending" ? "pending" : "";
              return `
                <tr>
                  <td>${escapeHtml(match?.roundLabel || `Match ${idx + 1}`)}</td>
                  <td>${escapeHtml(match?.date || "-")}</td>
                  <td>${escapeHtml(match?.time || "-")}</td>
                  <td>${escapeHtml(match?.court || "-")}</td>
                  <td>${escapeHtml(match?.home || "BYE")}</td>
                  <td>${escapeHtml(match?.away || "BYE")}</td>
                  <td>${summary.homeScore ?? "-"} - ${summary.awayScore ?? "-"}</td>
                  <td>${escapeHtml(summary.homeAux && summary.awayAux ? `${summary.homeAux} • ${summary.awayAux}` : "-")}</td>
                  <td><span class="schedule-badge ${statusClass}">${escapeHtml(summary.status || "pending")}</span></td>
                </tr>
              `;
            }).join("")
          : `<tr><td colspan="9" class="muted-small">No schedule found.</td></tr>`;

        const group = document.createElement("section");
        group.className = "schedule-group";
        group.id = getSectionId("bracket", entry.id);
        group.innerHTML = `
          <div class="schedule-group-header">
            <div>
              <h3 class="schedule-group-title">${escapeHtml(entry.label)}</h3>
              <div class="schedule-group-subtitle">Complete league schedule</div>
            </div>
          </div>
          <div class="schedule-team-table-wrap">
            <table class="schedule-team-table">
              <thead>
                <tr>
                  <th>Match</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Court</th>
                  <th>Home</th>
                  <th>Away</th>
                  <th>Category wins</th>
                  <th>Match points</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
        `;
        wrapper.appendChild(group);
        return;
      }

      const group = document.createElement("section");
      group.className = "schedule-group";
      group.id = getSectionId("bracket", entry.id);

      if (!rounds.length) {
        group.innerHTML = `
          <div class="schedule-group-header">
            <h3 class="schedule-group-title">${escapeHtml(entry.label)}</h3>
          </div>
          <div class="empty-state">
            <div class="feature-icon">📅</div>
            <h3>No schedule found</h3>
            <p class="muted">Fixtures are not available for this category yet.</p>
          </div>
        `;
        wrapper.appendChild(group);
        return;
      }

      const roundsHtml = rounds.map((round, roundIndex) => {
        const matches = (Array.isArray(round) ? round : []).map((match) => {
          const summary = summarizeMatch(match, entry.cat);
          const metaBadges = [match?.date, match?.time, match?.court]
            .filter(Boolean)
            .map((value) => `<span class="schedule-badge">${escapeHtml(value)}</span>`)
            .join("");
          return `
            <div class="bk-card">
              <div class="schedule-match-meta">${metaBadges}</div>
              <div class="fixture-line">
                <span>${escapeHtml(match?.home ?? "BYE")}</span>
                <span class="fixture-score">${summary.homeScore ?? ""}</span>
              </div>
              <div class="fixture-line">
                <span>${escapeHtml(match?.away ?? "BYE")}</span>
                <span class="fixture-score">${summary.awayScore ?? ""}</span>
              </div>
            </div>
          `;
        }).join("");

        return `
          <div class="schedule-round-col">
            <div class="round-title">${escapeHtml(getRoundLabel(roundIndex, entry.cat?.totalRounds || rounds.length))}</div>
            ${matches}
          </div>
        `;
      }).join("");

      group.innerHTML = `
        <div class="schedule-group-header">
          <h3 class="schedule-group-title">${escapeHtml(entry.label)}</h3>
        </div>
        <div class="schedule-bracket">
          <div class="schedule-rounds">${roundsHtml}</div>
        </div>
      `;
      wrapper.appendChild(group);
    });

    groupsEl.appendChild(wrapper);
  }

  function renderLiveView() {
    liveListEl.innerHTML = "";

    const entries = getFixtureCategoryEntries();
    const cards = [];
    entries.forEach((entry) => {
      const rounds = getRounds(entry.cat);
      rounds.forEach((round, roundIndex) => {
        (Array.isArray(round) ? round : []).forEach((match, matchIndex) => {
          const summary = summarizeMatch(match, entry.cat);
          if (!summary.hasAnyScore) return;
          cards.push({ entry, roundIndex, matchIndex, match, summary });
        });
      });
    });

    if (!cards.length) {
      liveEmptyEl?.classList.remove("hidden");
      return;
    }

    liveEmptyEl?.classList.add("hidden");

    cards.forEach((item) => {
      const { entry, roundIndex, match, summary } = item;
      const statusClass = summary.status === "completed" ? "final" : summary.status === "pending" ? "pending" : "";

      let detailHtml = "";
      if (summary.mode === "team" && summary.rows.length) {
        detailHtml = `
          <div class="live-submatch-list">
            ${summary.rows.map((row) => `
              <div class="live-submatch-row">
                <span class="live-submatch-label">${escapeHtml(row.label)}</span>
                <span>${escapeHtml(String(row.homeDisplay))} - ${escapeHtml(String(row.awayDisplay))}</span>
              </div>
            `).join("")}
          </div>
        `;
      } else {
        const homePlayers = Array.isArray(match?.homePlayers) && match.homePlayers.length ? match.homePlayers : splitTeamName(match?.home);
        const awayPlayers = Array.isArray(match?.awayPlayers) && match.awayPlayers.length ? match.awayPlayers : splitTeamName(match?.away);
        const homeRows = homePlayers.map((name) => {
          const playerScore = getPlayerStateScore(match?.score?.state?.A?.players?.[name]);
          return `<div class="live-player-row"><span>${escapeHtml(name)}</span><span>${playerScore ?? ""}</span></div>`;
        }).join("");
        const awayRows = awayPlayers.map((name) => {
          const playerScore = getPlayerStateScore(match?.score?.state?.B?.players?.[name]);
          return `<div class="live-player-row"><span>${escapeHtml(name)}</span><span>${playerScore ?? ""}</span></div>`;
        }).join("");
        detailHtml = `
          <div class="live-player-list">${homeRows || `<div class="muted-small">No player stats</div>`}</div>
          __VS_SPLIT__
          <div class="live-player-list">${awayRows || `<div class="muted-small">No player stats</div>`}</div>
        `;
      }

      const card = document.createElement("section");
      card.className = "live-score-card";
      card.id = getSectionId("live", entry.id);
      card.innerHTML = `
        <div class="live-score-top">
          <span class="live-badge">${escapeHtml(entry.label)}</span>
          <span class="live-badge">${escapeHtml(match?.roundLabel || `Round ${roundIndex + 1}`)}</span>
          ${match?.court ? `<span class="live-badge">${escapeHtml(match.court)}</span>` : ""}
          ${match?.time ? `<span class="live-badge">${escapeHtml(match.time)}</span>` : ""}
          <span class="live-badge ${statusClass}">${escapeHtml(summary.status || "live")}</span>
        </div>

        <div class="live-score-main">
          <div class="live-team-block">
            <div class="live-team-name">${escapeHtml(match?.home || "Home")}</div>
            <div class="live-team-score">${summary.homeScore ?? "-"}</div>
            ${summary.homeAux ? `<div class="live-team-subline">${escapeHtml(summary.homeAux)}</div>` : ""}
            ${summary.mode === "team" ? detailHtml : detailHtml.split("__VS_SPLIT__")[0]}
          </div>

          <div class="live-vs">VS</div>

          <div class="live-team-block">
            <div class="live-team-name">${escapeHtml(match?.away || "Away")}</div>
            <div class="live-team-score">${summary.awayScore ?? "-"}</div>
            ${summary.awayAux ? `<div class="live-team-subline">${escapeHtml(summary.awayAux)}</div>` : ""}
            ${summary.mode === "team" ? detailHtml : detailHtml.split("__VS_SPLIT__")[1]}
          </div>
        </div>
      `;
      liveListEl.appendChild(card);
    });
  }

  async function loadLeaderboardRows(categoryId) {
    if (!categoryId) return [];
    const urls = [
      `/api/tournaments/${encodeURIComponent(tournamentId)}/leaderboard?categoryId=${encodeURIComponent(categoryId)}`,
      `/api/host/tournaments/${encodeURIComponent(tournamentId)}/leaderboard?categoryId=${encodeURIComponent(categoryId)}`,
    ];

    for (const url of urls) {
      const response = await apiGet(url);
      if (!response.ok) continue;
      if (Array.isArray(response.data?.rows)) return response.data.rows;
      if (Array.isArray(response.data?.data)) return response.data.data;
      if (Array.isArray(response.data)) return response.data;
    }
    return [];
  }

  async function renderLeaderboardView(forceReload = false) {
    leaderboardGroupsEl.innerHTML = "";

    const entries = getFixtureCategoryEntries();
    if (!entries.length) {
      leaderboardEmptyEl?.classList.remove("hidden");
      return;
    }

    const rowsByCategory = await Promise.all(entries.map(async (entry) => ({
      entry,
      rows: await loadLeaderboardRows(entry.id),
    })));

    const hasAnyRows = rowsByCategory.some((item) => Array.isArray(item.rows) && item.rows.length);
    leaderboardEmptyEl?.classList.toggle("hidden", hasAnyRows);

    rowsByCategory.forEach(({ entry, rows }) => {
      if (!rows.length) return;

      const section = document.createElement("section");
      section.className = "leaderboard-group";
      section.id = getSectionId("leaderboard", entry.id);
      section.innerHTML = `
        <div class="leaderboard-group-header">
          <h3 class="leaderboard-group-title">${escapeHtml(entry.label)}</h3>
        </div>
        <div class="schedule-table-wrap">
          <table class="schedule-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Team</th>
                <th>Match points</th>
                <th>Ties won</th>
                <th>Head-to-head</th>
                <th>Qualified</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((row, index) => `
                <tr>
                  <td>${row.rank ?? index + 1}</td>
                  <td>${escapeHtml(row.teamName || row.team || "-")}</td>
                  <td>${row.matchPoints ?? 0}</td>
                  <td>${row.tiesWon ?? 0}</td>
                  <td>${escapeHtml(row.headToHead ?? "-")}</td>
                  <td>${row.qualified === true || row.qualified === "Yes" ? "Yes" : "No"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
      leaderboardGroupsEl.appendChild(section);
    });

    if (!hasAnyRows && forceReload) {
      leaderboardEmptyEl?.classList.remove("hidden");
    }
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

  async function refreshFixturesOnly() {
    const response = await apiGet(`/api/tournaments/${encodeURIComponent(tournamentId)}/fixtures`);
    if (response.ok) {
      state.fixtures = migrateFixtures(response.data?.data || response.data || null);
    }
  }

  function setRefreshLoop() {
    if (state.refreshHandle) clearInterval(state.refreshHandle);
    state.refreshHandle = setInterval(async () => {
      if (state.activeView !== "live" && state.activeView !== "leaderboard") return;
      await refreshFixturesOnly();
      if (state.activeView === "live") {
        renderLiveView();
      } else if (state.activeView === "leaderboard") {
        await renderLeaderboardView();
      }
    }, 10000);
  }

  document.querySelectorAll(".schedule-view-tab").forEach((btn) => {
    btn.addEventListener("click", async () => {
      switchView(btn.dataset.view);
      if (btn.dataset.view === "bracket") {
        renderBracketView();
      } else if (btn.dataset.view === "live") {
        await refreshFixturesOnly();
        renderLiveView();
      } else if (btn.dataset.view === "leaderboard") {
        await renderLeaderboardView(true);
      }
    });
  });

  async function loadTournamentMeta() {
    const direct = await apiGet(`/api/tournaments/${encodeURIComponent(tournamentId)}`);
    if (direct.ok && direct.data) return direct.data;

    const fallback = await apiGet("/api/tournaments");
    if (!fallback.ok) return null;
    const list = Array.isArray(fallback.data)
      ? fallback.data
      : Array.isArray(fallback.data?.data)
        ? fallback.data.data
        : Array.isArray(fallback.data?.tournaments)
          ? fallback.data.tournaments
          : [];
    return list.find((item) => String(item.tournamentId ?? item.id) === String(tournamentId)) || null;
  }

  async function loadFixtures() {
    const response = await apiGet(`/api/tournaments/${encodeURIComponent(tournamentId)}/fixtures`);
    if (!response.ok) return null;
    return migrateFixtures(response.data?.data || response.data || null);
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
    const fixtureEntries = state.fixtures?.categories ? Object.keys(state.fixtures.categories) : [];
    const firstTournamentCategory = normalizeCategories(state.tournamentMeta?.categories)?.[0];
    state.activeCategoryId = String(
      fixtureEntries[0] ||
      firstTournamentCategory?.categoryId ||
      firstTournamentCategory?.id ||
      (String(state.tournamentMeta?.tournamentType || "").toLowerCase() === "team" ? TEAM_EVENT_CATEGORY_ID : "")
    );

    renderHeader();
    renderQuickJump();

    if (!state.fixtures?.categories || !Object.keys(state.fixtures.categories).length) {
      emptyEl?.classList.remove("hidden");
      contentWrap?.classList.add("hidden");
      return;
    }

    emptyEl?.classList.add("hidden");
    contentWrap?.classList.remove("hidden");

    renderBracketView();
    renderLiveView();
    await renderLeaderboardView();
    switchView("bracket");
    setRefreshLoop();
  }

  await init();
});
