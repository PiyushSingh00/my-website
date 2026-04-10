import { requireAuth, logout } from "./auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;

  const TEAM_EVENT_CATEGORY_ID = "__team_event__";
  const REFRESH_MS = 5000;

  const trigger = document.getElementById("liveboard-user-menu-trigger");
  const dropdown = document.getElementById("liveboard-user-menu-dropdown");
  const playerBtn = document.getElementById("mode-player-btn");
  const hostBtn = document.getElementById("mode-host-btn");
  const backBtn = document.getElementById("back-btn");
  const manualRefreshBtn = document.getElementById("manual-refresh");

  const titleEl = document.getElementById("page-title");
  const subtitleEl = document.getElementById("page-subtitle");
  const autoRefreshPill = document.getElementById("auto-refresh-pill");
  const lastSyncPill = document.getElementById("last-sync-pill");
  const categoryFilter = document.getElementById("category-filter");
  const liveListEl = document.getElementById("live-list");
  const liveEmptyEl = document.getElementById("live-empty");
  const leaderboardListEl = document.getElementById("leaderboard-list");
  const leaderboardEmptyEl = document.getElementById("leaderboard-empty");

  const params = new URLSearchParams(window.location.search);
  const tournamentId = params.get("tournamentId");

  if (!tournamentId) {
    titleEl.textContent = "Missing tournamentId";
    subtitleEl.textContent = "Open this page with ?tournamentId=...";
    return;
  }

  const state = {
    tournamentMeta: null,
    fixtures: null,
    activeCategoryId: null,
    refreshHandle: null,
    isRefreshing: false,
  };

  document.querySelectorAll(".brand").forEach((el) => {
    el.addEventListener("click", () => {
      window.location.href = "index.html";
    });
  });

  if (trigger) {
    const label = String(user?.name || user?.username || user?.email || "U").trim();
    trigger.textContent = (label[0] || "U").toUpperCase();
  }

  trigger?.addEventListener("click", (event) => {
    event.stopPropagation();
    dropdown?.classList.toggle("is-open");
  });

  document.addEventListener("click", (event) => {
    if (!dropdown || !trigger) return;
    if (!dropdown.contains(event.target) && !trigger.contains(event.target)) {
      dropdown.classList.remove("is-open");
    }
  });

  document.getElementById("dropdown-signout")?.addEventListener("click", () => {
    dropdown?.classList.remove("is-open");
    logout();
  });

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
    window.location.href = "host.html";
  });

  backBtn?.addEventListener("click", () => {
    window.location.href = `players.html?tournamentId=${encodeURIComponent(tournamentId)}`;
  });

  manualRefreshBtn?.addEventListener("click", async () => {
    await refreshAll({ silent: false, forceMeta: true });
  });

  function getToken() {
    return localStorage.getItem("token") || localStorage.getItem("authToken") || "";
  }

  async function apiGet(url) {
    const hasQuery = url.includes("?");
    const freshUrl = `${url}${hasQuery ? "&" : "?"}_ts=${Date.now()}`;
    const res = await fetch(freshUrl, {
      headers: {
        Authorization: "Bearer " + getToken(),
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

  function unwrapPayload(raw) {
    let current = raw;
    for (let i = 0; i < 5; i += 1) {
      if (!current || typeof current !== "object") break;
      if (current.categories || current.rows || Array.isArray(current)) break;
      if (current.data !== undefined) {
        current = current.data;
        continue;
      }
      break;
    }
    return current;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function safeText(value, fallback = "") {
    const str = String(value ?? "").trim();
    return str || fallback;
  }

  function toArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function formatTime(date = new Date()) {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    }).format(date);
  }

  function setLastSync(text) {
    if (lastSyncPill) lastSyncPill.textContent = text;
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
    return parts.length ? parts.join(" • ") : (c?.eventName || c?.categoryId || c?.id || "Category");
  }

  function splitTeamName(teamName) {
    const t = String(teamName || "").trim();
    const up = t.toUpperCase();
    if (!t || up === "BYE" || up === "TBD") return [];
    return t.split(" + ").map((item) => item.trim()).filter(Boolean);
  }

  function ensureMatchMeta(match) {
    if (!match || typeof match !== "object") return match;
    if (!match.matchId) {
      if (window.crypto && crypto.randomUUID) {
        match.matchId = "M-" + crypto.randomUUID();
      } else {
        match.matchId = "M-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      }
    }
    if (!Array.isArray(match.homePlayers)) match.homePlayers = splitTeamName(match.home);
    if (!Array.isArray(match.awayPlayers)) match.awayPlayers = splitTeamName(match.away);
    return match;
  }

  function migrateFixtures(fixturesObj) {
    if (!fixturesObj || typeof fixturesObj !== "object") return fixturesObj;
    const categories = fixturesObj.categories || {};

    Object.values(categories).forEach((cat) => {
      if (Array.isArray(cat?.matches)) {
        cat.matches.forEach((match) => ensureMatchMeta(match));
      }
      if (Array.isArray(cat?.rounds)) {
        cat.rounds.forEach((round) => {
          if (!Array.isArray(round)) return;
          round.forEach((match) => ensureMatchMeta(match));
        });
      }
    });

    return fixturesObj;
  }

  function getRounds(cat) {
    if (Array.isArray(cat?.rounds) && cat.rounds.length) return cat.rounds;
    if (Array.isArray(cat?.matches) && cat.matches.length) return [cat.matches];
    return [];
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

  function getSimpleStatus(match) {
    const score = match?.score || {};
    const computedStatus = String(score?.computed?.status || match?.status || "").toLowerCase();
    if (["completed", "live", "pending"].includes(computedStatus)) return computedStatus;

    const a = getBucketScore(score?.state?.A);
    const b = getBucketScore(score?.state?.B);
    if (a !== null || b !== null) return "live";
    return "pending";
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
    return submatch?.score?.state?.meta?.categorySnapshot || submatch?.categorySnapshot || null;
  }

  function getSubmatchPlayerLabel(submatch, side, fallbackTeam) {
    const snapshot = getSubmatchSnapshot(submatch) || {};
    const direct = side === "A"
      ? [
          snapshot?.homePlayer,
          snapshot?.homePlayersSelected,
          submatch?.homePlayer,
          submatch?.homeLineup,
          submatch?.homeName,
          submatch?.homePlayers,
          submatch?.home,
        ]
      : [
          snapshot?.awayPlayer,
          snapshot?.awayPlayersSelected,
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

  function getSubmatchLabel(submatch, index) {
    const snapshot = getSubmatchSnapshot(submatch) || {};
    return (
      String(
        snapshot?.name ||
        snapshot?.categoryName ||
        submatch?.roundLabel ||
        submatch?.label ||
        submatch?.name ||
        `Submatch ${index + 1}`
      ).trim() || `Submatch ${index + 1}`
    );
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
      const isTeamSchedule = displayMode === "team_schedule" || String(entry.id) === TEAM_EVENT_CATEGORY_ID;
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

  function getSubmatchStatus(submatch) {
    const score = submatch?.score || {};
    const hasPoints = getBucketScore(score?.state?.A) !== null || getBucketScore(score?.state?.B) !== null;
    const status = String(score?.computed?.status || submatch?.status || (hasPoints ? "live" : "pending")).toLowerCase();
    if (["live", "completed", "pending"].includes(status)) return status;
    return hasPoints ? "live" : "pending";
  }

  function getTeamTieStateFromBackend(match) {
    const direct = match?.score?.state?.meta?.teamTieState;
    if (direct && typeof direct === "object") return direct;

    const submatches = toArray(match?.submatches);
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
          sportKey: safeText(snapshot?.sportKey, ""),
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
    const sportKey = safeText(category?.sportKey, "").toLowerCase();
    const data = category?.sportData || {};

    if (sportKey === "pickleball") {
      return toArray(data?.sets).reduce(
        (acc, set) => {
          acc.home += Number(set?.homePoints || 0);
          acc.away += Number(set?.awayPoints || 0);
          return acc;
        },
        { home: 0, away: 0 }
      );
    }

    if (sportKey === "badminton") {
      return toArray(data?.games).reduce(
        (acc, game) => {
          acc.home += Number(game?.a ?? game?.home ?? 0);
          acc.away += Number(game?.b ?? game?.away ?? 0);
          return acc;
        },
        { home: 0, away: 0 }
      );
    }

    if (sportKey === "tennis") {
      return toArray(data?.sets).reduce(
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
        home: Number(data?.homeGoals ?? data?.a ?? 0),
        away: Number(data?.awayGoals ?? data?.b ?? 0),
      };
    }

    if (sportKey === "cricket") {
      return {
        home: Number(data?.homeRuns ?? data?.a ?? 0),
        away: Number(data?.awayRuns ?? data?.b ?? 0),
      };
    }

    return {
      home: Number(category?.homeScore ?? category?.score?.home ?? 0),
      away: Number(category?.awayScore ?? category?.score?.away ?? 0),
    };
  }

  function categoriesFromTeamTieState(teamTieState, match) {
    return toArray(teamTieState?.categories).map((category, index) => {
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
    const categories = toArray(teamTieState?.categories);
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

  function getTeamScheduleStatus(match, roundIndex, matchIndex) {
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

  function getTeamTotals(match, roundIndex, matchIndex) {
    const submatches = toArray(match?.submatches);
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
    const backendCategories = toArray(backendTieState?.categories);
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

  function pickFeaturedSubmatch(match, roundIndex, matchIndex) {
    const submatches = toArray(match?.submatches);
    if (submatches.length) {
      const live = submatches.find((submatch) => getSubmatchStatus(submatch) === "live");
      if (live) return live;

      const completedWithPoints = submatches.find((submatch) => {
        return getBucketScore(submatch?.score?.state?.A) !== null || getBucketScore(submatch?.score?.state?.B) !== null;
      });
      if (completedWithPoints) return completedWithPoints;

      return submatches[0] || null;
    }

    const backendTieState = getTeamTieStateFromBackend(match);
    const backendSubmatches = categoriesFromTeamTieState(backendTieState, match);
    if (backendSubmatches.length) {
      const live = backendSubmatches.find((submatch) => getSubmatchStatus(submatch) === "live");
      if (live) return live;

      const withPoints = backendSubmatches.find((submatch) => {
        return getBucketScore(submatch?.score?.state?.A) !== null || getBucketScore(submatch?.score?.state?.B) !== null;
      });
      if (withPoints) return withPoints;

      return backendSubmatches[0];
    }

    const computed = match?.score?.computed || {};
    const fallbackHome = Number(computed.homeMatchPoints ?? computed.homePoints ?? 0);
    const fallbackAway = Number(computed.awayMatchPoints ?? computed.awayPoints ?? 0);
    return {
      name: "Current tie total",
      homePlayer: match?.home || "Home",
      awayPlayer: match?.away || "Away",
      score: {
        state: {
          A: { points: fallbackHome },
          B: { points: fallbackAway },
        },
        computed: {
          status: computed.status || match?.status || "live",
        },
      },
    };
  }

  async function loadTournamentMeta() {
    const direct = await apiGet(`/api/tournaments/${encodeURIComponent(tournamentId)}`);
    const directParsed = unwrapPayload(direct.data);
    if (direct.ok && directParsed) return directParsed;

    const fallback = await apiGet("/api/tournaments");
    if (!fallback.ok) return null;
    const parsed = unwrapPayload(fallback.data);
    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.tournaments)
        ? parsed.tournaments
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
      const parsed = unwrapPayload(response.data);
      if (parsed?.categories) return migrateFixtures(parsed);
    }

    return null;
  }

    function isTournamentTeamEventLiveboard() {
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

  function getFixtureMatchPoints(match, side) {
    const computed = match?.score?.computed || {};
    const stateScore = match?.score?.state || {};

    const candidates = side === "home"
      ? [
          computed.homeMatchPoints,
          computed.homePoints,
          stateScore?.A?.points,
          stateScore?.home?.points,
        ]
      : [
          computed.awayMatchPoints,
          computed.awayPoints,
          stateScore?.B?.points,
          stateScore?.away?.points,
        ];

    for (const value of candidates) {
      const num = Number(value);
      if (Number.isFinite(num)) return num;
    }

    return 0;
  }

  function buildTeamLeaderboardRowsFromFixturesLiveboard() {
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

    matches.forEach((match, matchIndex) => {
      const homeTeam = String(match?.home || "").trim();
      const awayTeam = String(match?.away || "").trim();

      const homeRow = ensureTeam(homeTeam);
      const awayRow = ensureTeam(awayTeam);

      const totals = getTeamTotals(match, 0, matchIndex);

      if (homeRow) {
        homeRow.matchPoints += Number(totals.homePoints || 0);
      }

      if (awayRow) {
        awayRow.matchPoints += Number(totals.awayPoints || 0);
      }

      const status = getTeamScheduleStatus(match, 0, matchIndex);
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
    if (isTournamentTeamEventLiveboard()) {
      return buildTeamLeaderboardRowsFromFixturesLiveboard();
    }

    if (!categoryId) return [];

    const response = await apiGet(
      `/api/host/tournaments/${encodeURIComponent(tournamentId)}/leaderboard?categoryId=${encodeURIComponent(categoryId)}`
    );

    if (!response.ok) return [];

    const parsed = unwrapPayload(response.data);
    if (Array.isArray(parsed?.rows)) return parsed.rows;
    if (Array.isArray(parsed?.data)) return parsed.data;
    if (Array.isArray(parsed)) return parsed;
    return [];
  }

  function getStatusClass(status) {
    if (status === "completed") return "final";
    if (status === "pending") return "pending";
    return "live";
  }

  function getLiveEntries() {
    const entries = getFixtureCategoryEntries();
    const cards = [];

    entries.forEach((entry) => {
      const rounds = getRounds(entry.cat);
      rounds.forEach((round, roundIndex) => {
        toArray(round).forEach((match, matchIndex) => {
          const displayMode = String(entry.cat?.displayMode || "").toLowerCase();
          const isTeamSchedule = displayMode === "team_schedule" || String(entry.id) === TEAM_EVENT_CATEGORY_ID;
          const status = isTeamSchedule
            ? getTeamScheduleStatus(match, roundIndex, matchIndex)
            : getSimpleStatus(match);
          if (status === "pending") return;

          cards.push({
            entry,
            match,
            roundIndex,
            matchIndex,
            isTeamSchedule,
            status,
          });
        });
      });
    });

    cards.sort((a, b) => {
      const rankA = a.status === "live" ? 0 : 1;
      const rankB = b.status === "live" ? 0 : 1;
      if (rankA !== rankB) return rankA - rankB;
      if (a.roundIndex !== b.roundIndex) return a.roundIndex - b.roundIndex;
      return a.matchIndex - b.matchIndex;
    });

    return cards;
  }

  function renderCategoryFilter() {
    const entries = getFixtureCategoryEntries();
    categoryFilter.innerHTML = "";

    const allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.className = `category-chip ${!state.activeCategoryId ? "active" : ""}`;
    allBtn.textContent = "All categories";
    allBtn.addEventListener("click", () => {
      state.activeCategoryId = null;
      renderLiveBoard();
      renderLeaderboardBoard();
      renderCategoryFilter();
    });
    categoryFilter.appendChild(allBtn);

    entries.forEach((entry) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `category-chip ${String(state.activeCategoryId) === String(entry.id) ? "active" : ""}`;
      button.textContent = entry.label;
      button.addEventListener("click", () => {
        state.activeCategoryId = entry.id;
        renderLiveBoard();
        renderLeaderboardBoard();
        renderCategoryFilter();
      });
      categoryFilter.appendChild(button);
    });
  }

  function renderLiveBoard() {
    const allCards = getLiveEntries();
    const cards = state.activeCategoryId
      ? allCards.filter((card) => String(card.entry.id) === String(state.activeCategoryId))
      : allCards;

    liveListEl.innerHTML = "";

    if (!cards.length) {
      liveEmptyEl?.classList.remove("hidden");
      return;
    }

    liveEmptyEl?.classList.add("hidden");

    liveListEl.innerHTML = cards
      .map(({ entry, match, isTeamSchedule, status, roundIndex, matchIndex }) => {
        if (isTeamSchedule) {
          const featuredSubmatch = pickFeaturedSubmatch(match, roundIndex, matchIndex);
          const totals = getTeamTotals(match, roundIndex, matchIndex);
          const featuredStatus = getSubmatchStatus(featuredSubmatch);
          const featuredHomeScore = getBucketScore(featuredSubmatch?.score?.state?.A);
          const featuredAwayScore = getBucketScore(featuredSubmatch?.score?.state?.B);
          const featuredHomePlayer = getSubmatchPlayerLabel(featuredSubmatch, "A", match?.home || "Home");
          const featuredAwayPlayer = getSubmatchPlayerLabel(featuredSubmatch, "B", match?.away || "Away");
          const featuredTitle = featuredSubmatch ? getSubmatchLabel(featuredSubmatch, 0) : "Submatch";

          return `
            <article class="live-card live-card--team">
              <div class="live-card-head">
                <div class="live-card-badges">
                  <span class="badge">${escapeHtml(entry.label)}</span>
                  <span class="badge">${escapeHtml(match?.matchNo || match?.matchNumber || `Match ${matchIndex + 1}`)}</span>
                  ${match?.court ? `<span class="badge">${escapeHtml(match.court)}</span>` : ""}
                  ${match?.time ? `<span class="badge">${escapeHtml(match.time)}</span>` : ""}
                </div>
                <span class="badge badge--${getStatusClass(status)}">${escapeHtml(status)}</span>
              </div>

              <div class="match-teams-row">
                <div class="match-team-name">${escapeHtml(match?.home || "Home")}</div>
                <div class="match-vs">VS</div>
                <div class="match-team-name match-team-name--right">${escapeHtml(match?.away || "Away")}</div>
              </div>

              <div class="featured-submatch-wrap">
                <div class="featured-submatch-top">
                  <div>
                    <div class="featured-label">Current submatch</div>
                    <div class="featured-title">${escapeHtml(featuredTitle)}</div>
                  </div>
                  <span class="badge badge--${getStatusClass(featuredStatus)}">${escapeHtml(featuredStatus)}</span>
                </div>

                <div class="featured-scoreboard">
                  <div class="featured-side">
                    <div class="featured-player">${escapeHtml(featuredHomePlayer)}</div>
                    <div class="featured-score">${escapeHtml(String(featuredHomeScore ?? 0))}</div>
                  </div>

                  <div class="featured-score-center">-</div>

                  <div class="featured-side featured-side--right">
                    <div class="featured-player">${escapeHtml(featuredAwayPlayer)}</div>
                    <div class="featured-score">${escapeHtml(String(featuredAwayScore ?? 0))}</div>
                  </div>
                </div>
              </div>

              <div class="summary-strip-grid">
                <div class="summary-chip">
                  <span class="summary-label">Tie score</span>
                  <strong>${escapeHtml(String(totals.homeWins))} - ${escapeHtml(String(totals.awayWins))}</strong>
                </div>
                <div class="summary-chip">
                  <span class="summary-label">Cumulative match points</span>
                  <strong>${escapeHtml(String(totals.homePoints))} - ${escapeHtml(String(totals.awayPoints))}</strong>
                </div>
                <div class="summary-chip">
                  <span class="summary-label">Players</span>
                  <strong>${escapeHtml(featuredHomePlayer)} vs ${escapeHtml(featuredAwayPlayer)}</strong>
                </div>
              </div>
            </article>
          `;
        }

        const homeScore = getBucketScore(match?.score?.state?.A);
        const awayScore = getBucketScore(match?.score?.state?.B);
        const homePlayers = Array.isArray(match?.homePlayers) && match.homePlayers.length
          ? match.homePlayers.join(" + ")
          : (match?.home || "Home");
        const awayPlayers = Array.isArray(match?.awayPlayers) && match.awayPlayers.length
          ? match.awayPlayers.join(" + ")
          : (match?.away || "Away");

        return `
          <article class="live-card">
            <div class="live-card-head">
              <div class="live-card-badges">
                <span class="badge">${escapeHtml(entry.label)}</span>
                ${match?.court ? `<span class="badge">${escapeHtml(match.court)}</span>` : ""}
                ${match?.time ? `<span class="badge">${escapeHtml(match.time)}</span>` : ""}
              </div>
              <span class="badge badge--${getStatusClass(status)}">${escapeHtml(status)}</span>
            </div>

            <div class="featured-submatch-wrap">
              <div class="featured-submatch-top">
                <div>
                  <div class="featured-label">Current match</div>
                  <div class="featured-title">${escapeHtml(match?.home || "Home")} vs ${escapeHtml(match?.away || "Away")}</div>
                </div>
              </div>

              <div class="featured-scoreboard">
                <div class="featured-side">
                  <div class="featured-player">${escapeHtml(homePlayers)}</div>
                  <div class="featured-score">${escapeHtml(String(homeScore ?? 0))}</div>
                </div>

                <div class="featured-score-center">-</div>

                <div class="featured-side featured-side--right">
                  <div class="featured-player">${escapeHtml(awayPlayers)}</div>
                  <div class="featured-score">${escapeHtml(String(awayScore ?? 0))}</div>
                </div>
              </div>
            </div>

            <div class="summary-strip-grid summary-strip-grid--single">
              <div class="summary-chip">
                <span class="summary-label">Teams</span>
                <strong>${escapeHtml(match?.home || "Home")} vs ${escapeHtml(match?.away || "Away")}</strong>
              </div>
              <div class="summary-chip">
                <span class="summary-label">Players</span>
                <strong>${escapeHtml(homePlayers)} vs ${escapeHtml(awayPlayers)}</strong>
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }

    function getRowTeamName(row) {
      return row.teamName || row.team || "—";
    }

    function getRowMatchPoints(row) {
      return Number(row.matchPoints ?? 0);
    }

    function getRowMatchesPlayed(row) {
      return Number(row.matchesPlayed ?? 0);
    }

    function getRowQualified(row) {
      return row.qualified === true || row.qualified === "Yes";
    }

    async function renderLeaderboardBoard() {
      leaderboardListEl.innerHTML = "";

      const entries = getFixtureCategoryEntries();
      const filteredEntries = state.activeCategoryId
        ? entries.filter((entry) => String(entry.id) === String(state.activeCategoryId))
        : entries;

      if (!filteredEntries.length) {
        leaderboardEmptyEl?.classList.remove("hidden");
        return;
      }

      const rowsByCategory = await Promise.all(
        filteredEntries.map(async (entry) => ({
          entry,
          rows: await loadLeaderboardRows(entry.id),
        }))
      );

      const populated = rowsByCategory.filter(
        (item) => Array.isArray(item.rows) && item.rows.length
      );

      leaderboardEmptyEl?.classList.toggle("hidden", populated.length > 0);

      if (!populated.length) return;

      leaderboardListEl.innerHTML = populated
        .map(({ entry, rows }) => `
          <section class="leaderboard-card">
            <div class="leaderboard-head">
              <div>
                <p class="section-label">${escapeHtml(entry.label)}</p>
                <h3 class="leaderboard-title">Current standings</h3>
              </div>
            </div>

            <div class="leaderboard-table-wrap">
              <table class="leaderboard-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Team</th>
                    <th>Match points</th>
                    <th>Matches played</th>
                    <th>Qualified</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows.map((row, index) => {
                    const qualified = getRowQualified(row);
                    return `
                      <tr>
                        <td>${escapeHtml(String(row.rank ?? index + 1))}</td>
                        <td>${escapeHtml(getRowTeamName(row))}</td>
                        <td>${escapeHtml(String(getRowMatchPoints(row)))}</td>
                        <td>${escapeHtml(String(getRowMatchesPlayed(row)))}</td>
                        <td>
                          <span class="qualified-pill ${qualified ? "qualified-pill--yes" : "qualified-pill--no"}">
                            ${qualified ? "Yes" : "No"}
                          </span>
                        </td>
                      </tr>
                    `;
                  }).join("")}
                </tbody>
              </table>
            </div>
          </section>
        `)
        .join("");
    }

  function renderHeader() {
    titleEl.textContent = state.tournamentMeta?.tournamentName || "Live board";
    subtitleEl.textContent = [
      state.tournamentMeta?.sportName || "",
      state.tournamentMeta?.tournamentDates || "",
      state.tournamentMeta?.venue || "",
    ]
      .filter(Boolean)
      .join(" • ") || "Live scores and leaderboard update automatically.";

    if (autoRefreshPill) autoRefreshPill.textContent = `Auto refresh every ${Math.round(REFRESH_MS / 1000)}s`;
  }

  async function refreshAll({ silent = true, forceMeta = false } = {}) {
    if (state.isRefreshing) return;
    state.isRefreshing = true;

    if (!silent) {
      setLastSync("Refreshing...");
    }

    try {
      if (!state.tournamentMeta || forceMeta) {
        state.tournamentMeta = await loadTournamentMeta();
      }

      state.fixtures = await loadFixtures();

      if (!state.tournamentMeta) {
        titleEl.textContent = "Tournament not found";
        subtitleEl.textContent = "Could not load tournament metadata.";
        liveListEl.innerHTML = "";
        leaderboardListEl.innerHTML = "";
        liveEmptyEl?.classList.add("hidden");
        leaderboardEmptyEl?.classList.add("hidden");
        setLastSync("Could not load tournament");
        return;
      }

      renderHeader();
      renderCategoryFilter();

      if (!state.fixtures?.categories || !Object.keys(state.fixtures.categories).length) {
        liveListEl.innerHTML = "";
        leaderboardListEl.innerHTML = "";
        liveEmptyEl?.classList.remove("hidden");
        leaderboardEmptyEl?.classList.remove("hidden");
        setLastSync(`Updated ${formatTime()}`);
        return;
      }

      renderLiveBoard();
      await renderLeaderboardBoard();
      setLastSync(`Updated ${formatTime()}`);
    } catch (error) {
      console.error(error);
      setLastSync("Refresh failed");
      if (!silent) {
        alert(error?.message || "Could not refresh live board.");
      }
    } finally {
      state.isRefreshing = false;
    }
  }

  function setRefreshLoop() {
    if (state.refreshHandle) clearInterval(state.refreshHandle);
    state.refreshHandle = setInterval(() => {
      refreshAll({ silent: true, forceMeta: false });
    }, REFRESH_MS);
  }

  await refreshAll({ silent: false, forceMeta: true });
  setRefreshLoop();
});
