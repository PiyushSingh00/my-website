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

  document.getElementById("back-to-join")?.addEventListener("click", () => {
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
    const hasQuery = url.includes("?");
    const freshUrl = `${url}${hasQuery ? "&" : "?"}_ts=${Date.now()}`;
    const res = await fetch(freshUrl, {
      headers: {
        Authorization: "Bearer " + (localStorage.getItem("token") || ""),
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
      cache: "no-store",
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

  function getSimpleStatus(match) {
    const score = match?.score || {};
    const computedStatus = String(score?.computed?.status || "").toLowerCase();
    if (["completed", "live", "pending"].includes(computedStatus)) return computedStatus;

    const a = getBucketScore(score?.state?.A);
    const b = getBucketScore(score?.state?.B);
    if (a !== null || b !== null) return "live";
    return "pending";
  }

  function getTeamTieStateFromBackend(match) {
    const direct = match?.score?.state?.meta?.teamTieState;
    if (direct && typeof direct === "object") return direct;

    const submatches = Array.isArray(match?.submatches) ? match.submatches : [];
    const categories = submatches
      .map((submatch, index) => {
        const snapshot = getSubmatchSnapshot(submatch);
        if (snapshot && typeof snapshot === "object") return snapshot;

        const home = getBucketScore(submatch?.score?.state?.A);
        const away = getBucketScore(submatch?.score?.state?.B);
        const winnerSide = String(
          submatch?.score?.computed?.winnerSide || submatch?.score?.winnerSide || ""
        ).toUpperCase();

        if (home === null && away === null && !winnerSide && !submatch?.status) return null;

        return {
          name: getSubmatchLabel(submatch, index),
          homePlayer: getSubmatchPlayerLabel(submatch, "A", match?.home || "Home"),
          awayPlayer: getSubmatchPlayerLabel(submatch, "B", match?.away || "Away"),
          homeScore: Number(home || 0),
          awayScore: Number(away || 0),
          winnerSide: winnerSide || null,
          sportKey: String(snapshot?.sportKey || "").trim(),
          sportData: snapshot?.sportData || null,
          categoryLocked: Boolean(snapshot?.categoryLocked),
        };
      })
      .filter(Boolean);

    if (!categories.length) return null;

    return {
      categories,
      tieLocked: Boolean(match?.score?.computed?.tieLocked),
    };
  }

  function getTeamTieCategoryPoints(category) {
    const sportKey = String(category?.sportKey || "").trim().toLowerCase();
    const data = category?.sportData || {};

    if (sportKey === "pickleball") {
      return (Array.isArray(data?.sets) ? data.sets : []).reduce(
        (acc, set) => {
          acc.home += Number(set?.homePoints || 0);
          acc.away += Number(set?.awayPoints || 0);
          return acc;
        },
        { home: 0, away: 0 }
      );
    }

    if (sportKey === "badminton") {
      return (Array.isArray(data?.games) ? data.games : []).reduce(
        (acc, game) => {
          acc.home += Number(game?.a ?? game?.home ?? 0);
          acc.away += Number(game?.b ?? game?.away ?? 0);
          return acc;
        },
        { home: 0, away: 0 }
      );
    }

    if (sportKey === "tennis") {
      return (Array.isArray(data?.sets) ? data.sets : []).reduce(
        (acc, setRow) => {
          acc.home += Number(setRow?.a ?? setRow?.home ?? 0);
          acc.away += Number(setRow?.b ?? setRow?.away ?? 0);
          return acc;
        },
        { home: 0, away: 0 }
      );
    }

    if (sportKey === "football") {
      return {
        home: Number(data?.homeGoals ?? data?.a ?? category?.homeScore ?? 0),
        away: Number(data?.awayGoals ?? data?.b ?? category?.awayScore ?? 0),
      };
    }

    if (sportKey === "cricket") {
      return {
        home: Number(data?.homeRuns ?? data?.a ?? category?.homeScore ?? 0),
        away: Number(data?.awayRuns ?? data?.b ?? category?.awayScore ?? 0),
      };
    }

    return {
      home: Number(category?.homeScore ?? category?.score?.home ?? 0),
      away: Number(category?.awayScore ?? category?.score?.away ?? 0),
    };
  }

  function categoriesFromTeamTieState(teamTieState, match) {
    return (Array.isArray(teamTieState?.categories) ? teamTieState.categories : []).map((category, index) => {
      const totals = getTeamTieCategoryPoints(category);
      const hasProgress =
        Number(totals.home || 0) > 0 ||
        Number(totals.away || 0) > 0 ||
        Number(category?.sportData?.currentSetIndex) >= 0 ||
        Boolean(category?.winnerSide);

      return {
        name: category?.name || category?.eventName || `Submatch ${index + 1}`,
        homePlayer: getSafeJoinedNames(
          category?.homePlayersSelected || category?.homePlayer,
          match?.home || "Home"
        ),
        awayPlayer: getSafeJoinedNames(
          category?.awayPlayersSelected || category?.awayPlayer,
          match?.away || "Away"
        ),
        score: {
          state: {
            A: { points: Number(totals.home || 0) },
            B: { points: Number(totals.away || 0) },
            meta: { categorySnapshot: category },
          },
          computed: {
            status: category?.winnerSide
              ? "completed"
              : (hasProgress ? "live" : "pending"),
            winnerSide: category?.winnerSide || null,
          },
        },
      };
    });
  }

  function deriveTeamTieStatus(teamTieState) {
    const categories = Array.isArray(teamTieState?.categories) ? teamTieState.categories : [];
    if (!categories.length) return "pending";

    const allCompleted = categories.every((category) => category?.categoryLocked || category?.winnerSide);
    if (allCompleted) return "completed";

    const anyProgress = categories.some((category) => {
      if (!category || typeof category !== "object") return false;
      if (category?.lineupStatus === "accepted") return true;
      if (category?.categoryLocked) return true;
      if (category?.winnerSide) return true;
      if (getSafeJoinedNames(category?.homePlayersSelected || category?.homePlayer) || getSafeJoinedNames(category?.awayPlayersSelected || category?.awayPlayer)) {
        return true;
      }

      const totals = getTeamTieCategoryPoints(category);
      if (Number(totals.home || 0) > 0 || Number(totals.away || 0) > 0) return true;

      const sportData = category?.sportData || {};
      if (sportData.currentSetIndex != null) return true;
      if (
        Array.isArray(sportData.sets) &&
        sportData.sets.some(
          (set) =>
            Number(set?.homePoints || 0) > 0 ||
            Number(set?.awayPoints || 0) > 0 ||
            set?.started ||
            set?.completed
        )
      ) {
        return true;
      }

      return false;
    });

    return anyProgress ? "live" : "pending";
  }

  function getSubmatchStatus(submatch) {
    const score = submatch?.score || {};
    const hasPoints = getBucketScore(score?.state?.A) !== null || getBucketScore(score?.state?.B) !== null;
    return String(score?.computed?.status || (hasPoints ? "live" : "pending")).toLowerCase();
  }

  function getTeamScheduleStatus(match) {
    const submatches = Array.isArray(match?.submatches) ? match.submatches : [];
    if (submatches.length) {
      let anyStarted = false;
      let allCompleted = true;

      submatches.forEach((submatch) => {
        const status = getSubmatchStatus(submatch);
        if (status !== "pending") anyStarted = true;
        if (status !== "completed") allCompleted = false;
      });

      if (!anyStarted) return "pending";
      if (allCompleted) return "completed";
      return "live";
    }

    const matchStatus = String(match?.score?.computed?.status || match?.status || "").toLowerCase();
    if (["live", "completed", "pending"].includes(matchStatus)) return matchStatus;

    const backendTieState = getTeamTieStateFromBackend(match);
    return deriveTeamTieStatus(backendTieState);
  }

  function getStatusClass(status) {
    if (status === "completed") return "final";
    if (status === "pending") return "pending";
    return "live";
  }

  function getMatchNumber(match, idx) {
    return match?.matchNo || match?.matchNumber || match?.roundLabel || `Match ${idx + 1}`;
  }

  function getCategoryMetaLabel(categoryId) {
    const cat = normalizeCategories(state.tournamentMeta?.categories).find(
      (item) => String(item?.categoryId || item?.id) === String(categoryId)
    );
    return cat ? categoryLabel(cat) : null;
  }

  function getFixtureCategoryEntries() {
    const categories = state.fixtures?.categories || {};
    const rawEntries = Object.entries(categories).map(([id, cat]) => ({
      id,
      cat,
      label: cat?.label || getCategoryMetaLabel(id) || (id === TEAM_EVENT_CATEGORY_ID ? "Team event" : id),
    }));

    const seenTeamSchedule = new Set();
    const seenLabels = new Set();
    const finalEntries = [];

    rawEntries.forEach((entry) => {
      const displayMode = String(entry?.cat?.displayMode || "").toLowerCase();
      const isTeamSchedule =
        displayMode === "team_schedule" || String(entry.id) === TEAM_EVENT_CATEGORY_ID;

      const labelKey = String(entry.label || "").trim().toLowerCase();

      if (isTeamSchedule) {
        if (seenTeamSchedule.has("team_schedule")) return;
        seenTeamSchedule.add("team_schedule");
        finalEntries.push(entry);
        return;
      }

      if (seenLabels.has(labelKey)) return;
      seenLabels.add(labelKey);
      finalEntries.push(entry);
    });

    return finalEntries;
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

        document.getElementById(getSectionId(state.activeView, entry.id))?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
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
      const isTeamSchedule = displayMode === "team_schedule";

      if (isTeamSchedule) {
        const matches = Array.isArray(entry.cat?.matches) && entry.cat.matches.length
          ? entry.cat.matches
          : rounds.flat();

        const rowsHtml = matches.length
          ? matches.map((match, idx) => {
              const status = getTeamScheduleStatus(match);
              return `
                <tr>
                  <td>${escapeHtml(getMatchNumber(match, idx))}</td>
                  <td>${escapeHtml(match?.home || "BYE")}</td>
                  <td>${escapeHtml(match?.away || "BYE")}</td>
                  <td>${escapeHtml(match?.date || "-")}</td>
                  <td>${escapeHtml(match?.time || "-")}</td>
                  <td>${escapeHtml(match?.court || "-")}</td>
                  <td><span class="schedule-badge ${getStatusClass(status)}">${escapeHtml(status)}</span></td>
                </tr>
              `;
            }).join("")
          : `<tr><td colspan="7" class="muted-small">No schedule found.</td></tr>`;

        const group = document.createElement("section");
        group.className = "schedule-group";
        group.id = getSectionId("bracket", entry.id);
        group.innerHTML = `
          <div class="schedule-group-header">
            <div>
              <h3 class="schedule-group-title">${escapeHtml(entry.label)}</h3>
              <div class="schedule-group-subtitle">Fixtures</div>
            </div>
          </div>
          <div class="schedule-team-table-wrap">
            <table class="schedule-team-table">
              <thead>
                <tr>
                  <th>Match no</th>
                  <th>Team 1</th>
                  <th>Team 2</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Court</th>
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
          const status = getSimpleStatus(match);
          const a = getBucketScore(match?.score?.state?.A);
          const b = getBucketScore(match?.score?.state?.B);
          const metaBadges = [match?.date, match?.time, match?.court]
            .filter(Boolean)
            .map((value) => `<span class="schedule-badge">${escapeHtml(value)}</span>`)
            .join("");
          return `
            <div class="bk-card">
              <div class="schedule-match-meta">
                ${metaBadges}
                <span class="schedule-badge ${getStatusClass(status)}">${escapeHtml(status)}</span>
              </div>
              <div class="fixture-line">
                <span>${escapeHtml(match?.home ?? "BYE")}</span>
                <span class="fixture-score">${a ?? ""}</span>
              </div>
              <div class="fixture-line">
                <span>${escapeHtml(match?.away ?? "BYE")}</span>
                <span class="fixture-score">${b ?? ""}</span>
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


  function getStatusRank(status) {
    if (status === "live") return 0;
    if (status === "completed") return 1;
    return 2;
  }

  function getSafeJoinedNames(value, fallback = "") {
    if (Array.isArray(value)) {
      const names = value.map((item) => String(item || "").trim()).filter(Boolean);
      return names.length ? names.join(" + ") : fallback;
    }
    const str = String(value || "").trim();
    return str || fallback;
  }

  function getSubmatchSnapshot(submatch) {
    return submatch?.score?.state?.meta?.categorySnapshot || null;
  }

  function getSubmatchPlayerLabel(submatch, side, fallbackTeam) {
    const snapshot = getSubmatchSnapshot(submatch) || {};
    const direct = side === "A"
      ? [
          snapshot?.homePlayer,
          submatch?.homePlayer,
          submatch?.homeLineup,
          submatch?.homeName,
          submatch?.homePlayers,
          submatch?.home,
        ]
      : [
          snapshot?.awayPlayer,
          submatch?.awayPlayer,
          submatch?.awayLineup,
          submatch?.awayName,
          submatch?.awayPlayers,
          submatch?.away,
        ];

    for (const candidate of direct) {
      const label = getSafeJoinedNames(candidate, "");
      if (label) return label;
    }
    return fallbackTeam || "-";
  }

  function getSubmatchLabel(submatch, idx) {
    const snapshot = getSubmatchSnapshot(submatch) || {};
    return (
      String(
        snapshot?.name ||
        submatch?.roundLabel ||
        submatch?.label ||
        submatch?.name ||
        `Submatch ${idx + 1}`
      ).trim() || `Submatch ${idx + 1}`
    );
  }

  function getTeamTotals(match) {
    const submatches = Array.isArray(match?.submatches) ? match.submatches : [];
    if (submatches.length) {
      return submatches.reduce(
        (acc, submatch) => {
          const home = getBucketScore(submatch?.score?.state?.A);
          const away = getBucketScore(submatch?.score?.state?.B);
          const winnerSide = String(
            submatch?.score?.computed?.winnerSide || submatch?.score?.winnerSide || ""
          ).toUpperCase();

          if (home !== null) acc.homePoints += home;
          if (away !== null) acc.awayPoints += away;
          if (winnerSide === "A") acc.homeWins += 1;
          if (winnerSide === "B") acc.awayWins += 1;
          return acc;
        },
        { homePoints: 0, awayPoints: 0, homeWins: 0, awayWins: 0 }
      );
    }

    const computed = match?.score?.computed || {};
    const backendTieState = getTeamTieStateFromBackend(match);
    const backendCategories = Array.isArray(backendTieState?.categories) ? backendTieState.categories : [];
    if (backendCategories.length) {
      return backendCategories.reduce((acc, category) => {
        const totals = getTeamTieCategoryPoints(category);
        acc.homePoints += Number(totals.home || 0);
        acc.awayPoints += Number(totals.away || 0);
        if (category?.winnerSide === "A") acc.homeWins += 1;
        if (category?.winnerSide === "B") acc.awayWins += 1;
        return acc;
      }, { homePoints: 0, awayPoints: 0, homeWins: 0, awayWins: 0 });
    }

    return {
      homePoints: Number(computed.homeMatchPoints ?? computed.homePoints ?? 0),
      awayPoints: Number(computed.awayMatchPoints ?? computed.awayPoints ?? 0),
      homeWins: Number(computed.homeCategoryWins ?? computed.homeWins ?? 0),
      awayWins: Number(computed.awayCategoryWins ?? computed.awayWins ?? 0),
    };
  }

  function buildTeamScheduleLiveCard(entry, match, roundIndex, matchIndex, status) {
    const backendTieState = getTeamTieStateFromBackend(match);
    const rawSubmatches = Array.isArray(match?.submatches) ? match.submatches : [];
    const submatches = rawSubmatches.length ? rawSubmatches : categoriesFromTeamTieState(backendTieState, match);
    const totals = getTeamTotals(match);

    const submatchRows = submatches.length
      ? submatches.map((submatch, idx) => {
          const sa = getBucketScore(submatch?.score?.state?.A);
          const sb = getBucketScore(submatch?.score?.state?.B);

          return `
            <div class="live-tv-submatch-row">
              <div class="live-tv-submatch-side live-tv-submatch-side--left">
                <span class="live-tv-submatch-player">${escapeHtml(getSubmatchPlayerLabel(submatch, "A", match?.home || "Home"))}</span>
              </div>
              <div class="live-tv-submatch-center">
                <span class="live-tv-submatch-title">${escapeHtml(getSubmatchLabel(submatch, idx))}</span>
                <span class="live-tv-submatch-score">${escapeHtml(String(sa ?? 0))} - ${escapeHtml(String(sb ?? 0))}</span>
              </div>
              <div class="live-tv-submatch-side live-tv-submatch-side--right">
                <span class="live-tv-submatch-player">${escapeHtml(getSubmatchPlayerLabel(submatch, "B", match?.away || "Away"))}</span>
              </div>
            </div>
          `;
        }).join("")
      : `
          <div class="live-tv-empty-note">No individual match score available yet.</div>
        `;

    return `
      <section class="live-score-card live-tv-card" id="${escapeHtml(`${getSectionId("live", entry.id)}-${match?.matchId || `${roundIndex}-${matchIndex}`}`)}">
        <div class="live-tv-card-head">
          <div class="live-tv-badges">
            <span class="live-badge">${escapeHtml(entry.label)}</span>
            <span class="live-badge">${escapeHtml(getMatchNumber(match, matchIndex))}</span>
            ${match?.court ? `<span class="live-badge">${escapeHtml(match.court)}</span>` : ""}
            ${match?.time ? `<span class="live-badge">${escapeHtml(match.time)}</span>` : ""}
          </div>
          <span class="live-badge ${getStatusClass(status)}">${escapeHtml(status)}</span>
        </div>

        <div class="live-tv-teams">
          <div class="live-tv-team">
            <div class="live-tv-team-name">${escapeHtml(match?.home || "Home")}</div>
            <div class="live-tv-team-total">Total match points ${escapeHtml(String(totals.homePoints || 0))}</div>
          </div>
          <div class="live-tv-tie-score-wrap">
            <div class="live-tv-tie-score-label">Tie score</div>
            <div class="live-tv-tie-score">${escapeHtml(String(totals.homeWins || 0))} - ${escapeHtml(String(totals.awayWins || 0))}</div>
          </div>
          <div class="live-tv-team live-tv-team--right">
            <div class="live-tv-team-name">${escapeHtml(match?.away || "Away")}</div>
            <div class="live-tv-team-total">Total match points ${escapeHtml(String(totals.awayPoints || 0))}</div>
          </div>
        </div>

        <div class="live-tv-submatches">
          ${submatchRows}
        </div>
      </section>
    `;
  }

  function buildSimpleLiveCard(entry, match, roundIndex, matchIndex, status) {
    const homeScore = getBucketScore(match?.score?.state?.A);
    const awayScore = getBucketScore(match?.score?.state?.B);
    const homePlayers = Array.isArray(match?.homePlayers) && match.homePlayers.length
      ? match.homePlayers
      : splitTeamName(match?.home);
    const awayPlayers = Array.isArray(match?.awayPlayers) && match.awayPlayers.length
      ? match.awayPlayers
      : splitTeamName(match?.away);

    return `
      <section class="live-score-card live-tv-card" id="${escapeHtml(`${getSectionId("live", entry.id)}-${match?.matchId || `${roundIndex}-${matchIndex}`}`)}">
        <div class="live-tv-card-head">
          <div class="live-tv-badges">
            <span class="live-badge">${escapeHtml(entry.label)}</span>
            <span class="live-badge">${escapeHtml(match?.roundLabel || `Round ${roundIndex + 1}`)}</span>
            ${match?.court ? `<span class="live-badge">${escapeHtml(match.court)}</span>` : ""}
            ${match?.time ? `<span class="live-badge">${escapeHtml(match.time)}</span>` : ""}
          </div>
          <span class="live-badge ${getStatusClass(status)}">${escapeHtml(status)}</span>
        </div>

        <div class="live-tv-simple-main">
          <div class="live-tv-team-block">
            <div class="live-tv-team-name">${escapeHtml(match?.home || "Home")}</div>
            <div class="live-tv-player-stack" role="list">
              ${(homePlayers.length ? homePlayers : ["-"]).map((name) => `<span class="live-tv-player-row" role="listitem">${escapeHtml(name)}</span>`).join("")}
            </div>
          </div>

          <div class="live-tv-simple-score">${escapeHtml(String(homeScore ?? "-"))} - ${escapeHtml(String(awayScore ?? "-"))}</div>

          <div class="live-tv-team-block live-tv-team-block--right">
            <div class="live-tv-team-name">${escapeHtml(match?.away || "Away")}</div>
            <div class="live-tv-player-stack live-tv-player-stack--right" role="list">
              ${(awayPlayers.length ? awayPlayers : ["-"]).map((name) => `<span class="live-tv-player-row live-tv-player-row--right" role="listitem">${escapeHtml(name)}</span>`).join("")}
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function renderLiveView() {
    liveListEl.innerHTML = "";

    const entries = getFixtureCategoryEntries();
    const cards = [];
    entries.forEach((entry) => {
      const rounds = getRounds(entry.cat);
      rounds.forEach((round, roundIndex) => {
        (Array.isArray(round) ? round : []).forEach((match, matchIndex) => {
          const displayMode = String(entry.cat?.displayMode || "").toLowerCase();
          const isTeamSchedule = displayMode === "team_schedule" || String(entry.id) === TEAM_EVENT_CATEGORY_ID;
          const status = isTeamSchedule ? getTeamScheduleStatus(match) : getSimpleStatus(match);
          if (status === "pending") return;
          cards.push({ entry, roundIndex, matchIndex, match, status, isTeamSchedule });
        });
      });
    });

    cards.sort((a, b) => {
      const byStatus = getStatusRank(a.status) - getStatusRank(b.status);
      if (byStatus !== 0) return byStatus;
      if (a.roundIndex !== b.roundIndex) return a.roundIndex - b.roundIndex;
      return a.matchIndex - b.matchIndex;
    });

    if (!cards.length) {
      liveEmptyEl?.classList.remove("hidden");
      return;
    }

    liveEmptyEl?.classList.add("hidden");

    liveListEl.innerHTML = cards
      .map(({ entry, roundIndex, matchIndex, match, status, isTeamSchedule }) => {
        return isTeamSchedule
          ? buildTeamScheduleLiveCard(entry, match, roundIndex, matchIndex, status)
          : buildSimpleLiveCard(entry, match, roundIndex, matchIndex, status);
      })
      .join("");
  }

  function isTournamentTeamEventSchedule() {
    const rawType = String(
      state.tournamentMeta?.tournamentType ||
      state.fixtures?.tournamentType ||
      state.fixtures?.meta?.tournamentType ||
      state.fixtures?.tournament?.tournamentType ||
      ""
    ).toLowerCase();

    if (rawType.includes("team")) return true;

    const entries = getFixtureCategoryEntries();
    return entries.some((entry) => {
      const displayMode = String(entry?.cat?.displayMode || "").toLowerCase();
      return displayMode === "team_schedule" || String(entry?.id) === TEAM_EVENT_CATEGORY_ID;
    });
  }

  function getTeamEventFixtureBucket() {
    const entries = getFixtureCategoryEntries();
    const found = entries.find((entry) => {
      const displayMode = String(entry?.cat?.displayMode || "").toLowerCase();
      return displayMode === "team_schedule" || String(entry?.id) === TEAM_EVENT_CATEGORY_ID;
    });
    return found?.cat || null;
  }

  function isRealLeaderboardTeamName(name) {
    const value = String(name || "").trim();
    const upper = value.toUpperCase();
    return Boolean(value && upper !== "BYE" && upper !== "TBD");
  }

  function buildTeamLeaderboardRowsFromFixturesSchedule() {
    const cat = getTeamEventFixtureBucket();
    const matches = Array.isArray(cat?.matches)
      ? cat.matches
      : Array.isArray(cat?.rounds?.[0])
        ? cat.rounds[0]
        : [];

    const stats = new Map();

    function ensureTeam(teamName) {
      const key = String(teamName || "").trim();
      if (!isRealLeaderboardTeamName(key)) return null;

      if (!stats.has(key)) {
        stats.set(key, {
          rank: 0,
          teamName: key,
          matchPoints: 0,
          matchesPlayed: 0,
          qualified: false,
        });
      }

      return stats.get(key);
    }

    matches.forEach((match) => {
      const homeTeam = String(match?.home || "").trim();
      const awayTeam = String(match?.away || "").trim();

      const homeRow = ensureTeam(homeTeam);
      const awayRow = ensureTeam(awayTeam);
      const totals = getTeamTotals(match);

      if (homeRow) homeRow.matchPoints += Number(totals.homePoints || 0);
      if (awayRow) awayRow.matchPoints += Number(totals.awayPoints || 0);

      const status = getTeamScheduleStatus(match);
      const countsAsPlayed =
        status !== "pending" &&
        isRealLeaderboardTeamName(homeTeam) &&
        isRealLeaderboardTeamName(awayTeam);

      if (countsAsPlayed) {
        if (homeRow) homeRow.matchesPlayed += 1;
        if (awayRow) awayRow.matchesPlayed += 1;
      }
    });

    const sorted = [...stats.values()].sort((a, b) => {
      if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints;
      if (b.matchesPlayed !== a.matchesPlayed) return b.matchesPlayed - a.matchesPlayed;
      return a.teamName.localeCompare(b.teamName);
    });

    return sorted.map((row, index) => ({
      ...row,
      rank: index + 1,
      qualified: index < 4,
    }));
  }

  async function loadLeaderboardRows(categoryId) {
    if (isTournamentTeamEventSchedule()) {
      return buildTeamLeaderboardRowsFromFixturesSchedule();
    }

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

      const hasMatchesPlayedColumn = rows.some((row) => row?.matchesPlayed != null);

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
                ${hasMatchesPlayedColumn ? '<th>Matches played</th>' : '<th>Ties won</th>'}
                ${hasMatchesPlayedColumn ? '' : '<th>Head-to-head</th>'}
                <th>Qualified</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((row, index) => `
                <tr>
                  <td>${row.rank ?? index + 1}</td>
                  <td>${escapeHtml(row.teamName || row.team || "-")}</td>
                  <td>${row.matchPoints ?? 0}</td>
                  <td>${hasMatchesPlayedColumn ? (row.matchesPlayed ?? 0) : (row.tiesWon ?? 0)}</td>
                  ${hasMatchesPlayedColumn ? '' : `<td>${escapeHtml(row.headToHead ?? "-")}</td>`}
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
    const urls = [
      `/api/host/tournaments/${encodeURIComponent(tournamentId)}/fixtures`,
      `/api/tournaments/${encodeURIComponent(tournamentId)}/fixtures`,
    ];

    for (const url of urls) {
      const response = await apiGet(url);
      if (!response.ok) continue;
      const parsed = response.data?.data || response.data || null;
      if (parsed?.categories) {
        state.fixtures = migrateFixtures(parsed);
        return;
      }
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
    const urls = [
      `/api/host/tournaments/${encodeURIComponent(tournamentId)}/fixtures`,
      `/api/tournaments/${encodeURIComponent(tournamentId)}/fixtures`,
    ];

    for (const url of urls) {
      const response = await apiGet(url);
      if (!response.ok) continue;
      const parsed = response.data?.data || response.data || null;
      if (parsed?.categories) return migrateFixtures(parsed);
    }

    return null;
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
