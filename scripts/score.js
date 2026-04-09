import { requireAuth, logout } from "./auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;

  document.querySelectorAll(".brand").forEach((el) => {
    el.style.cursor = "pointer";
    el.addEventListener("click", () => (window.location.href = "index.html"));
  });

  const trigger = document.getElementById("score-user-menu-trigger");
  const dropdown = document.getElementById("score-user-menu-dropdown");

  if (trigger) {
    const label = String(user?.name || user?.username || user?.email || "U").trim();
    trigger.textContent = (label[0] || "U").toUpperCase();
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

  hostBtn?.classList.add("is-active");
  playerBtn?.classList.remove("is-active");

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
  });

  const titleEl = document.getElementById("score-title");
  const subEl = document.getElementById("score-sub");
  const backBtn = document.getElementById("back-to-fixtures");
  const saveBtn = document.getElementById("save-score");
  const configWrap = document.getElementById("config-fields");
  const statusPill = document.getElementById("status-pill");
  const winnerPill = document.getElementById("winner-pill");
  const reasonPill = document.getElementById("reason-pill");
  const saveMsg = document.getElementById("save-msg");

  const homeNameEl = document.getElementById("home-name");
  const awayNameEl = document.getElementById("away-name");
  const homeScoreEl = document.getElementById("home-score");
  const awayScoreEl = document.getElementById("away-score");
  const rosterArea = document.getElementById("roster-area");

  const overlay = document.getElementById("stat-overlay");
  const drawer = document.getElementById("stat-drawer");
  const drawerNameEl = document.getElementById("drawer-player-name");
  const drawerTeamEl = document.getElementById("drawer-team-name");
  const drawerFields = document.getElementById("drawer-fields");
  const drawerClose = document.getElementById("drawer-close");

  const settingsPanel = document.getElementById("settings-panel");
  const toggleSettings = document.getElementById("toggle-settings");

  const timerDisplay = document.getElementById("timer-display");
  const timerStartBtn = document.getElementById("timer-start");
  const timerPauseBtn = document.getElementById("timer-pause");
  const timerResetBtn = document.getElementById("timer-reset");

  const teamHomeBtn = document.getElementById("team-home");
  const teamAwayBtn = document.getElementById("team-away");

  const individualScoreShell = document.getElementById("individual-score-shell");
  const teamEventShell = document.getElementById("team-event-shell");
  const lineupReviewPanel = document.getElementById("lineup-review-panel");
  const lineupReviewList = document.getElementById("lineup-review-list");
  const teamCategoryBars = document.getElementById("team-category-bars");
  const teamCategoryHelp = document.getElementById("team-category-help");
  const teamOverallHomeName = document.getElementById("team-overall-home-name");
  const teamOverallAwayName = document.getElementById("team-overall-away-name");
  const teamOverallHomeScore = document.getElementById("team-overall-home-score");
  const teamOverallAwayScore = document.getElementById("team-overall-away-score");
  const teamOverallHomePoints = document.getElementById("team-overall-home-points");
  const teamOverallAwayPoints = document.getElementById("team-overall-away-points");
  const teamOverallSub = document.getElementById("team-overall-sub");
  const toggleLineupReviewBtn = document.getElementById("toggle-lineup-review");
  const teamLineupToggleText = document.getElementById("team-lineup-toggle-text");
  const lockTeamScoresBtn = document.getElementById("lock-team-scores-btn");

  const params = new URLSearchParams(window.location.search);
  const tournamentId = params.get("tournamentId");
  const categoryId = params.get("categoryId");
  const roundIndex = Number(params.get("round"));
  const matchIndex = Number(params.get("match"));
  const scoreIndex = Number(params.get("scoreIndex") ?? 0);

  if (!tournamentId || Number.isNaN(roundIndex) || Number.isNaN(matchIndex)) {
    titleEl.textContent = "Missing required URL params";
    subEl.textContent = "Expected: ?tournamentId=...&round=0&match=0";
    return;
  }

  backBtn?.addEventListener("click", () => {
    window.location.href = `players.html?tournamentId=${encodeURIComponent(tournamentId)}`;
  });

  function getToken() {
    return localStorage.getItem("token") || localStorage.getItem("authToken") || "";
  }

  async function apiGet(url) {
    const res = await fetch(url, {
      headers: { Authorization: "Bearer " + getToken() },
    });

    const raw = await res.text();
    let data = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = { _nonJson: true, raw };
    }

    if (!res.ok) {
      throw new Error(`GET ${url} failed: ${res.status}${data?._nonJson ? " (non-JSON)" : ""}`);
    }
    return data;
  }

  function debounce(fn, wait = 500) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  }

  async function apiPut(url, body) {
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + getToken(),
      },
      body: JSON.stringify(body || {}),
    });

    const raw = await res.text();
    let data = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = { _nonJson: true, raw };
    }

    if (!res.ok) {
      throw new Error(`PUT ${url} failed: ${res.status}${data?._nonJson ? " (non-JSON)" : ""}`);
    }
    return data;
  }

  async function apiPost(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + getToken(),
      },
      body: JSON.stringify(body || {}),
    });

    const raw = await res.text();
    let data = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = { _nonJson: true, raw };
    }

    if (!res.ok) {
      throw new Error(`POST ${url} failed: ${res.status}${data?._nonJson ? " (non-JSON)" : ""}`);
    }
    return data;
  }

  function unwrapFixturesPayload(raw) {
    return raw?.data?.data || raw?.data || raw || null;
  }

  function getTeamAggregateStatus(teamTieState) {
    const categories = toArray(teamTieState?.categories);
    if (!categories.length) return "pending";

    const allCompleted = categories.every((category) => category?.categoryLocked || category?.winnerSide);
    if (allCompleted) return "completed";

    const anyProgress = categories.some((category) => {
      if (!category || typeof category !== "object") return false;
      if (category.lineupStatus === "accepted") return true;
      if (category.categoryLocked) return true;
      if (category.winnerSide) return true;
      if (safeText(category.homePlayer) || safeText(category.awayPlayer)) return true;

      const totals = getCategoryMatchPoints(category);
      if (Number(totals?.home || 0) > 0 || Number(totals?.away || 0) > 0) return true;

      const sportData = category.sportData || {};
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

  function getTeamAggregateWinner(summary, status) {
    if (status !== "completed") return null;

    const homeCategoryWins = Number(summary?.homeCategoryWins ?? summary?.homeWins ?? 0);
    const awayCategoryWins = Number(summary?.awayCategoryWins ?? summary?.awayWins ?? 0);

    if (homeCategoryWins > awayCategoryWins) return homeLabel;
    if (awayCategoryWins > homeCategoryWins) return awayLabel;

    const homeMatchPoints = Number(summary?.homeMatchPoints ?? summary?.homePoints ?? 0);
    const awayMatchPoints = Number(summary?.awayMatchPoints ?? summary?.awayPoints ?? 0);

    if (homeMatchPoints > awayMatchPoints) return homeLabel;
    if (awayMatchPoints > homeMatchPoints) return awayLabel;

    return null;
  }

  async function patchFixtureStatusInBackend({
    explicitCategoryId,
    roundIndex,
    matchIndex,
    status,
    winnerName = null,
    computed = null,
  }) {
    try {
      const rawFixtures = await apiGet(
        `/api/host/tournaments/${encodeURIComponent(tournamentId)}/fixtures`
      );
      const fixturesDoc = unwrapFixturesPayload(rawFixtures);
      if (!fixturesDoc?.categories) return;

      const found = findFirstMatch(fixturesDoc, explicitCategoryId, roundIndex, matchIndex);
      if (!found?.match) return;

      const targetCategoryId = found.categoryId;
      const targetMatch = found.match;

      targetMatch.status = status || "pending";
      if (winnerName) targetMatch.winner = winnerName;
      else delete targetMatch.winner;

      targetMatch.score =
        targetMatch.score && typeof targetMatch.score === "object" ? targetMatch.score : {};
      targetMatch.score.computed = {
        ...(targetMatch.score.computed || {}),
        ...(computed || {}),
        status: status || "pending",
        winnerName: winnerName || null,
      };

      const categoryBucket = fixturesDoc.categories?.[targetCategoryId];
      if (Array.isArray(categoryBucket?.matches) && categoryBucket.matches[matchIndex]) {
        categoryBucket.matches[matchIndex].status = targetMatch.status;
        if (winnerName) categoryBucket.matches[matchIndex].winner = winnerName;
        else delete categoryBucket.matches[matchIndex].winner;

        categoryBucket.matches[matchIndex].score =
          categoryBucket.matches[matchIndex].score &&
          typeof categoryBucket.matches[matchIndex].score === "object"
            ? categoryBucket.matches[matchIndex].score
            : {};

        categoryBucket.matches[matchIndex].score.computed = {
          ...(categoryBucket.matches[matchIndex].score.computed || {}),
          ...(computed || {}),
          status: status || "pending",
          winnerName: winnerName || null,
        };
      }

      await apiPost(
        `/api/host/tournaments/${encodeURIComponent(tournamentId)}/fixtures/update`,
        fixturesDoc
      );
    } catch (err) {
      console.warn("Could not patch fixture status in fixtures backend", err);
    }
  }

  function clear(el) {
    if (el) el.innerHTML = "";
  }

  function splitTeamLabel(label) {
    return label ? String(label).split("+").map((s) => s.trim()).filter(Boolean) : [];
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function safeText(value, fallback = "") {
    const str = String(value ?? "").trim();
    return str || fallback;
  }

  function toArray(value) {
    return Array.isArray(value) ? value : [];
  }

  let teamRosterLookup = new Map();

    function unwrapCaptainsPayload(raw) {
      return raw?.data || raw || {};
    }

    function normalizeTeamRosterNames(raw) {
      return toArray(raw)
        .map((item) =>
          typeof item === "string"
            ? safeText(item)
            : safeText(item?.playerName || item?.name || item?.fullName || item?.username)
        )
        .filter(Boolean);
    }

    function buildTeamRosterLookupFromCaptains(raw) {
      const payload = unwrapCaptainsPayload(raw);
      const confirmedCaptains = Array.isArray(payload?.confirmedCaptains) ? payload.confirmedCaptains : [];
      const lookup = new Map();

      confirmedCaptains.forEach((captain) => {
        const teamName = safeText(captain?.teamName || captain?.playerName);
        if (!teamName) return;

        const roster = normalizeTeamRosterNames(
          captain?.teamPlayers ||
          captain?.players ||
          captain?.members ||
          captain?.submittedPlayers ||
          captain?.roster
        );

        if (roster.length) {
          lookup.set(teamName, roster);
        }
      });

      teamRosterLookup = lookup;
    }

    async function loadTeamRosterLookup() {
      try {
        const captainsRaw = await apiGet(
          `/api/host/tournaments/${encodeURIComponent(tournamentId)}/captains`
        );
        buildTeamRosterLookupFromCaptains(captainsRaw);
      } catch (err) {
        console.warn("Could not load team rosters from captains route", err);
        teamRosterLookup = new Map();
      }
    }

    function isRosterJustTeamLabel(roster, teamLabel) {
      const list = toArray(roster).map((name) => safeText(name)).filter(Boolean);
      const label = safeText(teamLabel);
      return Boolean(label && list.length === 1 && list[0].toLowerCase() === label.toLowerCase());
    }

    function resolveRosterList(roster, fallbackRoster, teamLabel) {
      const list = toArray(roster).map((name) => safeText(name)).filter(Boolean);
      if (list.length && !isRosterJustTeamLabel(list, teamLabel)) return list;
      return toArray(fallbackRoster).map((name) => safeText(name)).filter(Boolean);
    }

  function ordinal(n) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
  }

  function getMatchCategoryMap(rawFixtures) {
    return rawFixtures?.categories || rawFixtures?.fixtureCategories || rawFixtures?.data?.categories || {};
  }

  function findFirstMatch(rawFixtures, explicitCategoryId, rIndex, mIndex) {
    const categoriesMap = getMatchCategoryMap(rawFixtures);

    if (explicitCategoryId && categoriesMap?.[explicitCategoryId]?.rounds?.[rIndex]?.[mIndex]) {
      return {
        categoryId: explicitCategoryId,
        match: categoriesMap[explicitCategoryId].rounds[rIndex][mIndex],
      };
    }

    const categoryEntries = Object.entries(categoriesMap || {});
    for (const [cid, category] of categoryEntries) {
      const candidate = category?.rounds?.[rIndex]?.[mIndex];
      if (candidate) {
        return { categoryId: cid, match: candidate };
      }
    }

    return { categoryId: explicitCategoryId || null, match: null };
  }

  function detectTeamEvent(rawFixtures) {
    const rawType = String(
      rawFixtures?.tournamentType ||
      rawFixtures?.meta?.tournamentType ||
      rawFixtures?.tournament?.tournamentType ||
      rawFixtures?.tournament?.eventType ||
      params.get("tournamentType") ||
      params.get("eventType") ||
      "individual"
    ).toLowerCase();

    return rawType.includes("team");
  }

  function getTeamStorageKey() {
    return `score_team_tie_state::${tournamentId}::${roundIndex}::${matchIndex}`;
  }

  function getTournamentSportName(rawFixtures) {
    return safeText(
      rawFixtures?.sportName ||
      rawFixtures?.meta?.sportName ||
      rawFixtures?.tournament?.sportName ||
      rawFixtures?.meta?.sport ||
      rawFixtures?.tournament?.sport ||
      params.get("sportName") ||
      params.get("sport"),
      ""
    );
  }

  function normalizeSportKey(sportName) {
    const value = safeText(sportName).toLowerCase();
    if (!value) return "";
    if (value.includes("pickle")) return "pickleball";
    if (value.includes("badminton")) return "badminton";
    if (value.includes("tennis")) return "tennis";
    if (value.includes("football") || value.includes("soccer")) return "football";
    if (value.includes("cricket")) return "cricket";
    return value;
  }

    function safeJsonObject(value) {
      if (!value) return {};
      if (typeof value === "object") return value;
      if (typeof value !== "string") return {};
      try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === "object" ? parsed : {};
      } catch {
        return {};
      }
    }

    function detectEffectiveSportKey(rawFixtures) {
      const byName = normalizeSportKey(getTournamentSportName(rawFixtures));
      if (byName) return byName;

      const advanced =
        safeJsonObject(rawFixtures?.meta?.advancedSettings) ||
        safeJsonObject(rawFixtures?.tournament?.advancedSettings) ||
        {};

      const advancedMode = safeText(
        advanced?.advancedMode ||
        rawFixtures?.meta?.advancedMode ||
        rawFixtures?.tournament?.advancedMode ||
        params.get("advancedMode"),
        ""
      ).toLowerCase();

      if (advancedMode.includes("pickle")) return "pickleball";

      const directHint = safeText(
        rawFixtures?.sportKey ||
        rawFixtures?.meta?.sportKey ||
        rawFixtures?.tournament?.sportKey,
        ""
      ).toLowerCase();

      if (directHint.includes("pickle")) return "pickleball";

      return "";
    }

  function getPickleballTargetPoints(rawFixtures) {
    const raw =
      rawFixtures?.meta?.pickleballTargetPoints ||
      rawFixtures?.meta?.pointsToWin ||
      rawFixtures?.meta?.tournamentRules?.pointsPerSet ||
      rawFixtures?.tournament?.pickleballTargetPoints ||
      rawFixtures?.tournament?.pointsToWin ||
      rawFixtures?.tournament?.tournamentRules?.pointsPerSet ||
      rawFixtures?.tournamentRules?.pointsPerSet ||
      params.get("targetPoints") ||
      15;

    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 15;
  }

  function getPickleballTotalSets(rawFixtures) {
    const raw =
      rawFixtures?.meta?.pickleballTotalSets ||
      rawFixtures?.meta?.bestOf ||
      rawFixtures?.meta?.tournamentRules?.bestOfSets ||
      rawFixtures?.tournament?.pickleballTotalSets ||
      rawFixtures?.tournament?.bestOf ||
      rawFixtures?.tournament?.tournamentRules?.bestOfSets ||
      rawFixtures?.tournamentRules?.bestOfSets ||
      params.get("totalSets") ||
      1;

    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  function setsNeededToWin(totalSets) {
    return Math.floor(totalSets / 2) + 1;
  }

  function capturePickleballSetSnapshot(set) {
    return {
      started: Boolean(set.started),
      completed: Boolean(set.completed),
      currentServer: set.currentServer || null,
      currentServerName: set.currentServerName || null,
      currentReceiver: set.currentReceiver || null,
      currentReceiverName: set.currentReceiverName || null,
      currentServerTurn: Number(set.currentServerTurn || 1),
      openingSequenceActive: Boolean(set.openingSequenceActive),
      homePoints: Number(set.homePoints || 0),
      awayPoints: Number(set.awayPoints || 0),
      winnerSide: set.winnerSide || null,
    };
  }

  function createDefaultPickleballTeamData(rawFixtures) {
    const totalSets = getPickleballTotalSets(rawFixtures);
    const targetPoints = getPickleballTargetPoints(rawFixtures);

    return {
      targetPoints,
      totalSets,
      tossWinner: null,
      startingServer: null,
      startingServerPlayer: null,
      startingReceiver: null,
      startingReceiverPlayer: null,

      // Player who should be on RIGHT side when that team's score is even.
      // For the team serving first, this is the chosen starting server.
      // For the team receiving first, this is the chosen starting receiver.
      gameStartingServerBySide: { A: null, B: null },

      

      currentSetIndex: null,
      categoryLocked: false,
      sets: Array.from({ length: totalSets }, (_, index) => ({
        number: index + 1,
        started: false,
        completed: false,
        currentServer: null,
        currentServerName: null,
        currentReceiver: null,
        currentReceiverName: null,
        currentServerTurn: 1,
        openingSequenceActive: false,
        homePoints: 0,
        awayPoints: 0,
        winnerSide: null,
        history: [],
      })),
    };
  }

  function ensurePickleballTeamData(existingData, rawFixtures) {
    const defaults = createDefaultPickleballTeamData(rawFixtures);
    const existing = existingData && typeof existingData === "object" ? existingData : {};

    const totalSets = Number(defaults.totalSets || existing.totalSets || 3);
    const safeTotalSets = Number.isFinite(totalSets) && totalSets > 0 ? totalSets : 3;

    const sets = Array.from({ length: safeTotalSets }, (_, index) => {
      const existingSet = Array.isArray(existing.sets) ? existing.sets[index] : null;
      return {
        number: index + 1,
        started: false,
        completed: false,
        currentServer: null,
        currentServerName: null,
        currentReceiver: null,
        currentReceiverName: null,
        currentServerTurn: 1,
        openingSequenceActive: false,
        homePoints: 0,
        awayPoints: 0,
        winnerSide: null,
        history: [],
        ...(existingSet || {}),
        history: Array.isArray(existingSet?.history) ? existingSet.history : [],
      };
    });

    let currentSetIndex = Number.isInteger(existing.currentSetIndex) ? existing.currentSetIndex : null;
    if (currentSetIndex != null && !sets[currentSetIndex]) currentSetIndex = null;
    if (currentSetIndex != null && sets[currentSetIndex]?.completed) currentSetIndex = null;

    return {
      targetPoints: Number(defaults.targetPoints || existing.targetPoints || 11) || 11,
      totalSets: safeTotalSets,
      tossWinner: existing.tossWinner || null,
      startingServer: existing.startingServer || null,
      startingServerPlayer: existing.startingServerPlayer || null,
      startingReceiver: existing.startingReceiver || null,
      startingReceiverPlayer: existing.startingReceiverPlayer || null,
      gameStartingServerBySide:
        existing.gameStartingServerBySide ||
        defaults.gameStartingServerBySide ||
        { A: null, B: null },
      currentSetIndex,
      categoryLocked: Boolean(existing.categoryLocked),
      sets,
    };
  }

  function hasPresetSportSchema(sportKey) {
    return ["cricket", "badminton", "tennis", "pickleball", "football"].includes(sportKey);
  }

  function createDefaultPresetSportData(sportKey, rawFixtures) {
    if (sportKey === "cricket") {
      return {
        homeRuns: 0,
        awayRuns: 0,
        homeWickets: 0,
        awayWickets: 0,
        homeOvers: "0.0",
        awayOvers: "0.0",
      };
    }

    if (sportKey === "football") {
      return {
        homeGoals: 0,
        awayGoals: 0,
        homeYellow: 0,
        awayYellow: 0,
        homeRed: 0,
        awayRed: 0,
      };
    }

    if (sportKey === "badminton") {
      return {
        bestOf: 3,
        games: [
          { a: 0, b: 0 },
          { a: 0, b: 0 },
          { a: 0, b: 0 },
        ],
      };
    }

    if (sportKey === "pickleball") {
      return createDefaultPickleballTeamData(rawFixtures);
    }

    if (sportKey === "tennis") {
      return {
        bestOf: 3,
        sets: [
          { a: 0, b: 0 },
          { a: 0, b: 0 },
          { a: 0, b: 0 },
        ],
      };
    }

    return null;
  }

  function cloneDefaultPresetSportData(sportKey, rawFixtures) {
    const base = createDefaultPresetSportData(sportKey, rawFixtures);
    return base ? JSON.parse(JSON.stringify(base)) : null;
  }

  function getPickleballSetWins(pickleballData) {
    const sets = toArray(pickleballData?.sets);
    return {
      aWins: sets.filter((set) => set?.winnerSide === "A").length,
      bWins: sets.filter((set) => set?.winnerSide === "B").length,
    };
  }

  function getSelectedPlayers(category, side) {
    const direct = side === "A" ? category?.homePlayersSelected : category?.awayPlayersSelected;
    if (Array.isArray(direct) && direct.length) return direct.map((p) => safeText(p)).filter(Boolean);

    const textValue = side === "A" ? category?.homePlayer : category?.awayPlayer;
    return splitTeamLabel(textValue).map((p) => safeText(p)).filter(Boolean);
  }

  function syncCategoryPlayerStrings(category) {
    category.homePlayersSelected = getSelectedPlayers(category, "A");
    category.awayPlayersSelected = getSelectedPlayers(category, "B");
    category.homePlayer = category.homePlayersSelected.join(" + ");
    category.awayPlayer = category.awayPlayersSelected.join(" + ");
    return category;
  }

  function getCategorySlotCount(category) {
    const exact = Number(category?.slotCount || category?.teamSize || 1);
    return Number.isFinite(exact) && exact > 0 ? exact : 1;
  }

  function isCategoryLineupComplete(category) {
    const slotCount = getCategorySlotCount(category);
    return getSelectedPlayers(category, "A").length >= slotCount && getSelectedPlayers(category, "B").length >= slotCount;
  }

  function getCategoryFormatLabel(category) {
    const count = getCategorySlotCount(category);
    if (count === 1) return "Singles";
    if (count === 2) return "Doubles";
    if (count === 3) return "Triples";
    return `${count} players`;
  }

  function getPickleballPlayerLabels(category, homeTeamLabel, awayTeamLabel) {
    const homePlayers = getSelectedPlayers(category, "A");
    const awayPlayers = getSelectedPlayers(category, "B");
    return {
      homePlayerLabel: homePlayers.length ? homePlayers.join(" + ") : safeText(category?.homePlayer, homeTeamLabel),
      awayPlayerLabel: awayPlayers.length ? awayPlayers.join(" + ") : safeText(category?.awayPlayer, awayTeamLabel),
      homePlayers,
      awayPlayers,
    };
  }

  function getPlayersForPickleballSide(category, side) {
    const labels = getPickleballPlayerLabels(category, "Home", "Away");
    return side === "A" ? labels.homePlayers : labels.awayPlayers;
  }

  function getGameStartingServerForSide(category, pb, side) {
    const players = getPlayersForPickleballSide(category, side);
    const stored = safeText(pb?.gameStartingServerBySide?.[side]);
    if (stored && players.includes(stored)) return stored;
    return players[0] || (side === "A" ? "Home" : "Away");
  }

  function getPartnerForPickleballSide(category, pb, side, playerName) {
    const players = getPlayersForPickleballSide(category, side);
    if (!players.length) return side === "A" ? "Home" : "Away";
    if (players.length === 1) return players[0];

    const partner = players.find((p) => p !== playerName);
    return partner || players[0];
  }

  function getRightCourtPlayerForSide(category, pb, side, teamScore) {
    const starter = getGameStartingServerForSide(category, pb, side);
    const partner = getPartnerForPickleballSide(category, pb, side, starter);
    const players = getPlayersForPickleballSide(category, side);

    if (players.length < 2) return starter;
    return Number(teamScore || 0) % 2 === 0 ? starter : partner;
  }

  function getLeftCourtPlayerForSide(category, pb, side, teamScore) {
    const starter = getGameStartingServerForSide(category, pb, side);
    const partner = getPartnerForPickleballSide(category, pb, side, starter);
    const players = getPlayersForPickleballSide(category, side);

    if (players.length < 2) return starter;
    return Number(teamScore || 0) % 2 === 0 ? partner : starter;
  }

  function getFirstServerNameForSide(category, pb, side, teamScore) {
    return getRightCourtPlayerForSide(category, pb, side, teamScore);
  }

  function getSecondServerNameForSide(category, pb, side, teamScore) {
    return getLeftCourtPlayerForSide(category, pb, side, teamScore);
  }

  function getReceiverNameForServingSide(category, pb, servingSide, servingScore, receivingScore) {
    const receivingSide = servingSide === "A" ? "B" : "A";
    const serverOnRight = Number(servingScore || 0) % 2 === 0;

    return serverOnRight
      ? getRightCourtPlayerForSide(category, pb, receivingSide, receivingScore)
      : getLeftCourtPlayerForSide(category, pb, receivingSide, receivingScore);
  }

  function hasAnyPickleballSetStarted(pickleballData) {
    return toArray(pickleballData?.sets).some((set) => set?.started);
  }

  function getNextUnstartedPickleballSetIndex(pickleballData) {
    return toArray(pickleballData?.sets).findIndex((set) => !set?.started);
  }

  function getCategoryResultInfo(category, homeTeamLabel, awayTeamLabel) {
    if (category.winnerSide === "A") {
      return {
        chipClass: "category-result-chip completed",
        text: `${safeText(category.homePlayer, homeTeamLabel)} won`,
      };
    }
    if (category.winnerSide === "B") {
      return {
        chipClass: "category-result-chip completed",
        text: `${safeText(category.awayPlayer, awayTeamLabel)} won`,
      };
    }

    if (!isCategoryLineupComplete(category)) {
      return { chipClass: "category-result-chip pending", text: "Complete lineup" };
    }

    if (category.sportKey === "pickleball") {
      const pb = ensurePickleballTeamData(category.sportData, fixtures);
      const currentSet =
        Number.isInteger(pb.currentSetIndex) && pb.sets[pb.currentSetIndex]
          ? pb.sets[pb.currentSetIndex]
          : null;

      if (currentSet && currentSet.started && !currentSet.completed) {
        const servingName = safeText(currentSet.currentServerName, currentSet.currentServer === "A" ? homeTeamLabel : awayTeamLabel);
        return {
          chipClass: "category-result-chip pending",
          text: `Set ${currentSet.number} live • Serve ${servingName}`,
        };
      }

      const completedSets = pb.sets.filter((set) => set.completed).length;
      if (completedSets > 0) {
        const { aWins, bWins } = getPickleballSetWins(pb);
        return { chipClass: "category-result-chip pending", text: `Sets ${aWins}-${bWins}` };
      }

      if (
        pb.tossWinner &&
        pb.startingServer &&
        pb.startingServerPlayer &&
        pb.startingReceiver &&
        pb.startingReceiverPlayer
      ) {
        return { chipClass: "category-result-chip pending", text: "Ready to start 1st set" };
      }

      return {
        chipClass: "category-result-chip pending",
        text: "Awaiting toss, first server & first receiver",
      };
    }

    return { chipClass: "category-result-chip pending", text: "Ready to score" };
  }

  function buildPresetScoringMarkup(category, homeTeamLabel, awayTeamLabel) {
    const sportKey = category?.sportKey || "";
    const data = category?.sportData || {};

    if (sportKey === "cricket") {
      return `
        <div class="preset-sport-tag">Preset scoring: Cricket</div>
        <div class="category-scoring-grid">
          <div class="score-mini-card">
            <div class="score-mini-team">${escapeHtml(homeTeamLabel)}</div>
            <div class="helper-text">${escapeHtml(category.homePlayer || "No lineup selected")}</div>
            <div class="preset-metric-row">
              <span>Runs</span>
              <div class="score-stepper">
                <button type="button" class="score-stepper-btn" data-preset-field="homeRuns" data-step="-1">−</button>
                <div class="score-stepper-value">${escapeHtml(data.homeRuns ?? 0)}</div>
                <button type="button" class="score-stepper-btn" data-preset-field="homeRuns" data-step="1">+</button>
              </div>
            </div>
            <div class="preset-metric-row">
              <span>Wickets</span>
              <div class="score-stepper">
                <button type="button" class="score-stepper-btn" data-preset-field="homeWickets" data-step="-1">−</button>
                <div class="score-stepper-value">${escapeHtml(data.homeWickets ?? 0)}</div>
                <button type="button" class="score-stepper-btn" data-preset-field="homeWickets" data-step="1">+</button>
              </div>
            </div>
            <div class="field-stack">
              <label>Overs</label>
              <input type="text" data-preset-input="homeOvers" value="${escapeHtml(data.homeOvers ?? "0.0")}" placeholder="Eg. 20.0" />
            </div>
          </div>

          <div class="score-mini-card">
            <div class="score-mini-team">${escapeHtml(awayTeamLabel)}</div>
            <div class="helper-text">${escapeHtml(category.awayPlayer || "No lineup selected")}</div>
            <div class="preset-metric-row">
              <span>Runs</span>
              <div class="score-stepper">
                <button type="button" class="score-stepper-btn" data-preset-field="awayRuns" data-step="-1">−</button>
                <div class="score-stepper-value">${escapeHtml(data.awayRuns ?? 0)}</div>
                <button type="button" class="score-stepper-btn" data-preset-field="awayRuns" data-step="1">+</button>
              </div>
            </div>
            <div class="preset-metric-row">
              <span>Wickets</span>
              <div class="score-stepper">
                <button type="button" class="score-stepper-btn" data-preset-field="awayWickets" data-step="-1">−</button>
                <div class="score-stepper-value">${escapeHtml(data.awayWickets ?? 0)}</div>
                <button type="button" class="score-stepper-btn" data-preset-field="awayWickets" data-step="1">+</button>
              </div>
            </div>
            <div class="field-stack">
              <label>Overs</label>
              <input type="text" data-preset-input="awayOvers" value="${escapeHtml(data.awayOvers ?? "0.0")}" placeholder="Eg. 20.0" />
            </div>
          </div>
        </div>
      `;
    }

    if (sportKey === "football") {
      return `
        <div class="preset-sport-tag">Preset scoring: Football</div>
        <div class="category-scoring-grid">
          <div class="score-mini-card">
            <div class="score-mini-team">${escapeHtml(homeTeamLabel)}</div>
            <div class="helper-text">${escapeHtml(category.homePlayer || "No lineup selected")}</div>
            <div class="preset-metric-row">
              <span>Goals</span>
              <div class="score-stepper">
                <button type="button" class="score-stepper-btn" data-preset-field="homeGoals" data-step="-1">−</button>
                <div class="score-stepper-value">${escapeHtml(data.homeGoals ?? 0)}</div>
                <button type="button" class="score-stepper-btn" data-preset-field="homeGoals" data-step="1">+</button>
              </div>
            </div>
            <div class="preset-metric-row">
              <span>Yellow cards</span>
              <div class="score-stepper">
                <button type="button" class="score-stepper-btn" data-preset-field="homeYellow" data-step="-1">−</button>
                <div class="score-stepper-value">${escapeHtml(data.homeYellow ?? 0)}</div>
                <button type="button" class="score-stepper-btn" data-preset-field="homeYellow" data-step="1">+</button>
              </div>
            </div>
            <div class="preset-metric-row">
              <span>Red cards</span>
              <div class="score-stepper">
                <button type="button" class="score-stepper-btn" data-preset-field="homeRed" data-step="-1">−</button>
                <div class="score-stepper-value">${escapeHtml(data.homeRed ?? 0)}</div>
                <button type="button" class="score-stepper-btn" data-preset-field="homeRed" data-step="1">+</button>
              </div>
            </div>
          </div>

          <div class="score-mini-card">
            <div class="score-mini-team">${escapeHtml(awayTeamLabel)}</div>
            <div class="helper-text">${escapeHtml(category.awayPlayer || "No lineup selected")}</div>
            <div class="preset-metric-row">
              <span>Goals</span>
              <div class="score-stepper">
                <button type="button" class="score-stepper-btn" data-preset-field="awayGoals" data-step="-1">−</button>
                <div class="score-stepper-value">${escapeHtml(data.awayGoals ?? 0)}</div>
                <button type="button" class="score-stepper-btn" data-preset-field="awayGoals" data-step="1">+</button>
              </div>
            </div>
            <div class="preset-metric-row">
              <span>Yellow cards</span>
              <div class="score-stepper">
                <button type="button" class="score-stepper-btn" data-preset-field="awayYellow" data-step="-1">−</button>
                <div class="score-stepper-value">${escapeHtml(data.awayYellow ?? 0)}</div>
                <button type="button" class="score-stepper-btn" data-preset-field="awayYellow" data-step="1">+</button>
              </div>
            </div>
            <div class="preset-metric-row">
              <span>Red cards</span>
              <div class="score-stepper">
                <button type="button" class="score-stepper-btn" data-preset-field="awayRed" data-step="-1">−</button>
                <div class="score-stepper-value">${escapeHtml(data.awayRed ?? 0)}</div>
                <button type="button" class="score-stepper-btn" data-preset-field="awayRed" data-step="1">+</button>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    if (sportKey === "badminton") {
      const games = Array.isArray(data.games) ? data.games : [];
      return `
        <div class="preset-sport-tag">Preset scoring: Badminton</div>
        <div class="preset-sets-wrap">
          ${games
            .map(
              (game, index) => `
                <div class="preset-set-row">
                  <div class="preset-set-title">Game ${index + 1}</div>
                  <div class="preset-set-score">
                    <span class="preset-side-name">${escapeHtml(homeTeamLabel)}</span>
                    <div class="score-stepper compact">
                      <button type="button" class="score-stepper-btn" data-preset-collection="games" data-index="${index}" data-side="a" data-step="-1">−</button>
                      <div class="score-stepper-value small">${escapeHtml(game?.a ?? 0)}</div>
                      <button type="button" class="score-stepper-btn" data-preset-collection="games" data-index="${index}" data-side="a" data-step="1">+</button>
                    </div>
                  </div>
                  <div class="preset-set-score">
                    <span class="preset-side-name">${escapeHtml(awayTeamLabel)}</span>
                    <div class="score-stepper compact">
                      <button type="button" class="score-stepper-btn" data-preset-collection="games" data-index="${index}" data-side="b" data-step="-1">−</button>
                      <div class="score-stepper-value small">${escapeHtml(game?.b ?? 0)}</div>
                      <button type="button" class="score-stepper-btn" data-preset-collection="games" data-index="${index}" data-side="b" data-step="1">+</button>
                    </div>
                  </div>
                </div>
              `
            )
            .join("")}
        </div>
      `;
    }

    if (sportKey === "tennis") {
      const sets = Array.isArray(data.sets) ? data.sets : [];

      return `
        <div class="preset-sport-tag">Preset scoring: Tennis</div>
        <div class="preset-sets-wrap">
          ${sets
            .map(
              (setRow, index) => `
                <div class="preset-set-row">
                  <div class="preset-set-title">Set ${index + 1}</div>
                  <div class="preset-set-score">
                    <span class="preset-side-name">${escapeHtml(homeTeamLabel)}</span>
                    <div class="score-stepper compact">
                      <button type="button" class="score-stepper-btn" data-preset-collection="sets" data-index="${index}" data-side="a" data-step="-1">−</button>
                      <div class="score-stepper-value small">${escapeHtml(setRow?.a ?? 0)}</div>
                      <button type="button" class="score-stepper-btn" data-preset-collection="sets" data-index="${index}" data-side="a" data-step="1">+</button>
                    </div>
                  </div>
                  <div class="preset-set-score">
                    <span class="preset-side-name">${escapeHtml(awayTeamLabel)}</span>
                    <div class="score-stepper compact">
                      <button type="button" class="score-stepper-btn" data-preset-collection="sets" data-index="${index}" data-side="b" data-step="-1">−</button>
                      <div class="score-stepper-value small">${escapeHtml(setRow?.b ?? 0)}</div>
                      <button type="button" class="score-stepper-btn" data-preset-collection="sets" data-index="${index}" data-side="b" data-step="1">+</button>
                    </div>
                  </div>
                </div>
              `
            )
            .join("")}
        </div>
      `;
    }

    return `
      <div class="preset-sport-tag">Generic team scoring</div>
      <div class="category-scoring-grid">
        <div class="score-mini-card">
          <div class="score-mini-team">${escapeHtml(homeTeamLabel)}</div>
          <div class="helper-text">${escapeHtml(category.homePlayer || "No lineup selected")}</div>
          <div class="score-stepper">
            <button type="button" class="score-stepper-btn" data-action="home-minus">−</button>
            <div class="score-stepper-value">${escapeHtml(category.homeScore)}</div>
            <button type="button" class="score-stepper-btn" data-action="home-plus">+</button>
          </div>
        </div>

        <div class="score-mini-card">
          <div class="score-mini-team">${escapeHtml(awayTeamLabel)}</div>
          <div class="helper-text">${escapeHtml(category.awayPlayer || "No lineup selected")}</div>
          <div class="score-stepper">
            <button type="button" class="score-stepper-btn" data-action="away-minus">−</button>
            <div class="score-stepper-value">${escapeHtml(category.awayScore)}</div>
            <button type="button" class="score-stepper-btn" data-action="away-plus">+</button>
          </div>
        </div>
      </div>
    `;
  }

  function buildPickleballScoringMarkup(category, homeTeamLabel, awayTeamLabel) {
    const pb = ensurePickleballTeamData(category.sportData, fixtures);
    const anySetStarted = hasAnyPickleballSetStarted(pb);
    const setupLocked = anySetStarted || category.categoryLocked;
    const nextSetIndex = getNextUnstartedPickleballSetIndex(pb);
    const currentSet =
      Number.isInteger(pb.currentSetIndex) && pb.sets[pb.currentSetIndex]
        ? pb.sets[pb.currentSetIndex]
        : null;

    const { aWins, bWins } = getPickleballSetWins(pb);
    const neededWins = setsNeededToWin(pb.totalSets);
    const { homePlayerLabel, awayPlayerLabel, homePlayers, awayPlayers } = getPickleballPlayerLabels(category, homeTeamLabel, awayTeamLabel);
    const allServerOptions = [
      ...homePlayers.map((name) => ({ side: "A", name })),
      ...awayPlayers.map((name) => ({ side: "B", name })),
    ];
    const receiverOptions =
      pb.startingServer === "A"
        ? awayPlayers.map((name) => ({ side: "B", name }))
        : pb.startingServer === "B"
          ? homePlayers.map((name) => ({ side: "A", name }))
          : [];

    const declareWinnerRow =
      !pb.categoryLocked && (aWins >= neededWins || bWins >= neededWins)
        ? `
          <div class="pickle-next-set-row">
            ${
              aWins >= neededWins
                ? `<button type="button" class="pickle-start-set-btn" data-pickle-action="declare-category" data-side="A">Declare ${escapeHtml(homePlayerLabel)} winner for this category</button>`
                : ""
            }
            ${
              bWins >= neededWins
                ? `<button type="button" class="pickle-start-set-btn" data-pickle-action="declare-category" data-side="B">Declare ${escapeHtml(awayPlayerLabel)} winner for this category</button>`
                : ""
            }
          </div>
        `
        : "";

    const serverSelectOptions = allServerOptions.length
      ? allServerOptions
          .map((option) => {
            const value = `${option.side}::${option.name}`;
            const selected = pb.startingServer === option.side && pb.startingServerPlayer === option.name ? "selected" : "";
            return `<option value="${escapeHtml(value)}" ${selected}>${escapeHtml(option.name)}</option>`;
          })
          .join("")
      : `<option value="">Select server</option>`;

    const receiverSelectOptions = receiverOptions.length
      ? receiverOptions
          .map((option) => {
            const value = `${option.side}::${option.name}`;
            const selected =
              pb.startingReceiver === option.side && pb.startingReceiverPlayer === option.name
                ? "selected"
                : "";
            return `<option value="${escapeHtml(value)}" ${selected}>${escapeHtml(option.name)}</option>`;
          })
          .join("")
      : `<option value="">Select receiver</option>`;

    return `
      <div class="preset-sport-tag">Team Event Pickleball</div>

      <div class="pickle-config-chips">
        <div class="pickle-config-chip">Points to win: ${escapeHtml(pb.targetPoints)}</div>
        <div class="pickle-config-chip">Best of: ${escapeHtml(pb.totalSets)} sets</div>
        <div class="pickle-config-chip">Sets won: ${escapeHtml(aWins)}-${escapeHtml(bWins)}</div>
      </div>

      <div class="pickle-setup-card">
        <div class="panel-label">Pre-match setup</div>

        <div class="pickle-setup-grid">
          <div class="pickle-choice-group">
            <div class="pickle-choice-label">Who won toss?</div>
            <div class="pickle-choice-row">
              <button
                type="button"
                class="pickle-choice-btn ${pb.tossWinner === "A" ? "active" : ""}"
                data-pickle-action="pick-toss"
                data-side="A"
                ${setupLocked ? "disabled" : ""}
              >
                ${escapeHtml(homePlayerLabel)}
              </button>
              <button
                type="button"
                class="pickle-choice-btn ${pb.tossWinner === "B" ? "active" : ""}"
                data-pickle-action="pick-toss"
                data-side="B"
                ${setupLocked ? "disabled" : ""}
              >
                ${escapeHtml(awayPlayerLabel)}
              </button>
            </div>
          </div>

          <div class="pickle-choice-group pickle-server-picker">
            <div class="pickle-choice-label">Who is serving first?</div>
            <select class="pickle-server-select" data-pickle-action="pick-server-name" ${setupLocked ? "disabled" : ""}>
              <option value="">Select player</option>
              ${serverSelectOptions}
            </select>
          </div>

          <div class="pickle-choice-group pickle-server-picker">
            <div class="pickle-choice-label">Who is receiving first?</div>
            <select
              class="pickle-server-select"
              data-pickle-action="pick-receiver-name"
              ${setupLocked || !pb.startingServer ? "disabled" : ""}
            >
              <option value="">Select player</option>
              ${receiverSelectOptions}
            </select>
          </div>

        </div>

        <div class="pickle-next-set-row">
          ${
            pb.categoryLocked
              ? `<div class="pickle-locked-note">Category locked after winner declaration.</div>`
              : currentSet && currentSet.started && !currentSet.completed
                ? `<div class="pickle-note">${escapeHtml(ordinal(currentSet.number))} set is live.</div>`
                : pb.tossWinner &&
                  pb.startingServer &&
                  pb.startingServerPlayer &&
                  pb.startingReceiver &&
                  pb.startingReceiverPlayer &&
                  nextSetIndex !== -1
                  ? `<button type="button" class="pickle-start-set-btn" data-pickle-action="start-set" data-set-index="${nextSetIndex}">Start ${escapeHtml(ordinal(nextSetIndex + 1))} Set</button>`
                  : `<div class="pickle-note">Select toss winner, first server, and first receiver to begin.</div>`
          }
        </div>
      </div>

      ${
        currentSet && currentSet.started && !currentSet.completed
          ? `
            <div class="pickle-live-card">
              <div class="pickle-live-head">
                <div>
                  <div class="panel-label">${escapeHtml(ordinal(currentSet.number))} set in progress</div>
                  <div class="pickle-note">
                    A point is awarded only when the rally winner is currently serving.
                    If the rally winner was receiving, only the serve changes.
                  </div>
                </div>
                <div class="pickle-current-server">
                  Serve: <strong>${escapeHtml(safeText(currentSet.currentServerName, currentSet.currentServer === "A" ? homePlayerLabel : awayPlayerLabel))}</strong>
                </div>
              </div>

              <div class="pickle-live-scoreboard">
                <div class="pickle-live-team">
                  <span>${escapeHtml(homePlayerLabel)}</span>
                  <strong class="pickle-live-points">${escapeHtml(currentSet.homePoints)}</strong>
                </div>
                <div class="pickle-live-team">
                  <span>${escapeHtml(awayPlayerLabel)}</span>
                  <strong class="pickle-live-points">${escapeHtml(currentSet.awayPoints)}</strong>
                </div>
              </div>

              <div class="pickle-rally-row">
                <button type="button" class="pickle-rally-btn primary" data-pickle-action="rally" data-side="A">
                  Rally won by ${escapeHtml(homePlayerLabel)}
                </button>
                <button type="button" class="pickle-rally-btn primary" data-pickle-action="rally" data-side="B">
                  Rally won by ${escapeHtml(awayPlayerLabel)}
                </button>
              </div>
            </div>
          `
          : ""
      }

      ${declareWinnerRow}

      <div class="pickle-sets-card">
        <div class="panel-label">Set summary</div>
        <div class="pickle-sets-list">
          ${pb.sets
            .map((set, index) => {
              const statusClass = set.completed ? "completed" : set.started ? "live" : "pending";
              const statusText = set.completed
                ? `${set.winnerSide === "A" ? homePlayerLabel : awayPlayerLabel} won`
                : set.started
                  ? `Live • Serve ${escapeHtml(safeText(set.currentServerName, set.currentServer === "A" ? homePlayerLabel : awayPlayerLabel))}`
                  : "Not started";

              const canUndo = set.started && (set.history?.length > 0 || set.completed);
              const canReset = set.started || set.completed;

              return `
                <div class="pickle-set-chip ${statusClass}">
                  <div class="pickle-set-top">
                    <div class="pickle-set-name">${escapeHtml(ordinal(index + 1))} set</div>
                    <div class="pickle-set-status">${statusText}</div>
                  </div>
                  <div class="pickle-set-scoreline">
                    ${escapeHtml(homePlayerLabel)} ${escapeHtml(set.homePoints)} - ${escapeHtml(set.awayPoints)} ${escapeHtml(awayPlayerLabel)}
                  </div>
                  <div class="pickle-set-actions">
                    <button type="button" class="lineup-action-btn" data-pickle-action="undo-set" data-set-index="${index}" ${canUndo ? "" : "disabled"}>
                      Undo
                    </button>
                    <button type="button" class="lineup-action-btn" data-pickle-action="reset-set" data-set-index="${index}" ${canReset ? "" : "disabled"}>
                      Reset
                    </button>
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
      </div>
    `;
  }

    function bindPresetHandlers(card, category, rerender, teamTieState) {
      if (!category || typeof category !== "object") return;

      category.sportData =
        category.sportData && typeof category.sportData === "object"
          ? category.sportData
          : {};

      card.querySelectorAll("[data-preset-field]").forEach((btn) => {
        btn.addEventListener("click", () => {
          if (teamTieState?.tieLocked) return;

          const field = String(btn.dataset.presetField || "").trim();
          const step = Number(btn.dataset.step || 0);

          if (!field || !Number.isFinite(step)) return;

          const currentValue = Number(category.sportData[field] ?? 0);
          const nextValue = Math.max(0, currentValue + step);

          category.sportData[field] = nextValue;
          rerender();
        });
      });

      card.querySelectorAll("[data-preset-input]").forEach((input) => {
        input.addEventListener("change", () => {
          if (teamTieState?.tieLocked) return;

          const field = String(input.dataset.presetInput || "").trim();
          if (!field) return;

          category.sportData[field] = String(input.value ?? "").trim();
          rerender();
        });
      });
    }

  function bindPickleballHandlers(card, category, categoryIndex, teamTieState, rerender) {
    card.querySelectorAll('[data-pickle-action="pick-toss"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const pb = ensurePickleballTeamData(category.sportData, fixtures);
        if (hasAnyPickleballSetStarted(pb) || teamTieState.tieLocked) return;
        pb.tossWinner = btn.dataset.side;
        category.sportData = pb;
        rerender();
      });
    });

    card.querySelectorAll('[data-pickle-action="pick-server-name"]').forEach((select) => {
      select.addEventListener("change", () => {
        const raw = String(select.value || "");
        const pb = ensurePickleballTeamData(category.sportData, fixtures);
        if (hasAnyPickleballSetStarted(pb) || teamTieState.tieLocked) return;

        const [side, ...rest] = raw.split("::");
        const name = rest.join("::");

        pb.startingServer = side || null;
        pb.startingServerPlayer = name || null;

        pb.gameStartingServerBySide = pb.gameStartingServerBySide || { A: null, B: null };
        pb.gameStartingServerBySide[side || "A"] = name || null;

        pb.startingReceiver = null;
        pb.startingReceiverPlayer = null;

        const labels = getPickleballPlayerLabels(category, "Home", "Away");
        const oppositeSide = side === "A" ? "B" : "A";
        const oppositePlayers = oppositeSide === "A" ? labels.homePlayers : labels.awayPlayers;

        if (oppositePlayers.length) {
          pb.startingReceiver = oppositeSide;
          pb.startingReceiverPlayer = oppositePlayers[0];
          pb.gameStartingServerBySide[oppositeSide] = oppositePlayers[0];
        }

        category.sportData = pb;
        rerender();
      });
    });

    card.querySelectorAll('[data-pickle-action="pick-receiver-name"]').forEach((select) => {
      select.addEventListener("change", () => {
        const raw = String(select.value || "");
        const pb = ensurePickleballTeamData(category.sportData, fixtures);
        if (hasAnyPickleballSetStarted(pb) || teamTieState.tieLocked) return;

        const [side, ...rest] = raw.split("::");
        const name = rest.join("::");

        pb.startingReceiver = side || null;
        pb.startingReceiverPlayer = name || null;

        pb.gameStartingServerBySide = pb.gameStartingServerBySide || { A: null, B: null };
        pb.gameStartingServerBySide[side || "A"] = name || null;

        category.sportData = pb;
        rerender();
      });
    });

    card.querySelectorAll('[data-pickle-action="start-set"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        startPickleballSet(category, Number(btn.dataset.setIndex));
        rerender();
      });
    });

    card.querySelectorAll('[data-pickle-action="rally"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        applyPickleballRally(category, btn.dataset.side);
        rerender();
      });
    });

    card.querySelectorAll('[data-pickle-action="declare-category"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        declarePickleballCategoryWinner(category, btn.dataset.side, categoryIndex, teamTieState);
        rerender();
      });
    });

    card.querySelectorAll('[data-pickle-action="undo-set"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        undoPickleballSet(category, Number(btn.dataset.setIndex));
        rerender();
      });
    });

    card.querySelectorAll('[data-pickle-action="reset-set"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        resetPickleballSet(category, Number(btn.dataset.setIndex));
        rerender();
      });
    });
  }

  function inferCategoryDefinitions(rawFixtures) {
    const sources = [
      rawFixtures?.teamCategories,
      rawFixtures?.meta?.teamCategories,
      rawFixtures?.tournament?.categories,
      rawFixtures?.meta?.categories,
      rawFixtures?.categoriesMeta,
    ];

    const raw = sources.find((list) => Array.isArray(list) && list.length) || [];

    const extracted = raw.map((item, index) => {
      const slotCount = Math.max(1, Number(item?.exactTeamSize || item?.teamSize || 1));
      const age = safeText(item?.ageGroup, "");
      const gender = safeText(item?.gender, "");
      const level = safeText(item?.playingLevel, "");
      const explicit = safeText(item?.eventName || item?.name || item?.categoryName || item?.label || item?.title, "");
      const generatedName = [age, gender, level, slotCount === 1 ? "Singles" : slotCount === 2 ? "Doubles" : `${slotCount} players`]
        .filter(Boolean)
        .join(" • ");
      return {
        id: safeText(item?.id || item?.categoryId || item?.key, `cat-${index + 1}`),
        name: explicit || generatedName || `Category ${index + 1}`,
        slotCount,
      };
    });

    if (extracted.length) return extracted;

    const fallbackCount = Math.max(1, Number(params.get("categoryCount") || 3));
    return Array.from({ length: fallbackCount }, (_, index) => ({
      id: `cat-${index + 1}`,
      name: `Category ${index + 1}`,
      slotCount: 1,
    }));
  }

  function inferTeamRoster(matchObj, side) {
    const teamLabel = side === "A" ? matchObj?.home : matchObj?.away;
    const normalizedTeamLabel = safeText(teamLabel);

    const rosterFromCaptains = normalizedTeamLabel
      ? resolveRosterList(teamRosterLookup.get(normalizedTeamLabel), [], normalizedTeamLabel)
      : [];

    if (rosterFromCaptains.length) return rosterFromCaptains;

    const rosterFromMatch = side === "A" ? matchObj?.homePlayers : matchObj?.awayPlayers;
    const fromMatchList = toArray(rosterFromMatch).map((p) => safeText(p)).filter(Boolean);
    if (fromMatchList.length && !isRosterJustTeamLabel(fromMatchList, normalizedTeamLabel)) {
      return fromMatchList;
    }

    const split = splitTeamLabel(teamLabel);
    if (split.length) return split;

    return Array.from({ length: 8 }, (_, index) => `${side === "A" ? "Home" : "Away"} Player ${index + 1}`);
  }

  function buildInitialTeamState(matchObj, rawFixtures) {
    const categories = inferCategoryDefinitions(rawFixtures);
    const homeRoster = inferTeamRoster(matchObj, "A");
    const awayRoster = inferTeamRoster(matchObj, "B");
    const tournamentSportKey = detectEffectiveSportKey(rawFixtures);

    return {
      homeRoster,
      awayRoster,
      tournamentSportKey,
      tieLocked: false,
      categories: categories.map((category, index) => ({
        id: category.id,
        name: category.name,
        slotCount: category.slotCount,
        homePlayersSelected: [],
        awayPlayersSelected: [],
        homePlayer: "",
        awayPlayer: "",
        lineupStatus: "pending",
        notes: "",
        homeScore: 0,
        awayScore: 0,
        winnerSide: null,
        isScoringOpen: false,
        categoryLocked: false,
        sportKey: tournamentSportKey,
        sportData: hasPresetSportSchema(tournamentSportKey)
          ? cloneDefaultPresetSportData(tournamentSportKey, rawFixtures)
          : null,
      })),
      lineupCollapsed: false,
    };
  }

  function getTeamTieStateProgressScore(candidate) {
    if (!candidate || !Array.isArray(candidate.categories)) return -1;

    let score = candidate.tieLocked ? 1000 : 0;

    candidate.categories.forEach((category) => {
      if (!category || typeof category !== "object") return;

      if (isCategoryLineupComplete(category)) score += 5;
      if (safeText(category.homePlayer) || safeText(category.awayPlayer)) score += 2;
      if (category.categoryLocked) score += 15;
      if (category.winnerSide) score += 30;

      const sportData = category.sportData || {};
      if (sportData.currentSetIndex != null) score += 5;

      if (Array.isArray(sportData.sets)) {
        score += sportData.sets.reduce((sum, set) => {
          return sum + Number(set?.homePoints || 0) + Number(set?.awayPoints || 0);
        }, 0);
      }

      score += Number(category.homeScore || 0) + Number(category.awayScore || 0);
    });

    return score;
  }

  function normalizeLoadedTeamTieState(candidate, matchObj, fresh, rawFixtures) {
    if (!candidate || !Array.isArray(candidate.categories)) return null;

    const normalized = { ...candidate };
    const detectedSportKey = detectEffectiveSportKey(rawFixtures);

    normalized.homeRoster = resolveRosterList(normalized.homeRoster, fresh.homeRoster, matchObj?.home);
    normalized.awayRoster = resolveRosterList(normalized.awayRoster, fresh.awayRoster, matchObj?.away);
    normalized.tournamentSportKey =
      detectedSportKey || fresh.tournamentSportKey || normalized.tournamentSportKey || "";
    normalized.lineupCollapsed = Boolean(normalized.lineupCollapsed);
    normalized.tieLocked = Boolean(normalized.tieLocked);

    normalized.categories = fresh.categories.map((baseCategory, index) => {
      const category = normalized.categories[index] || {};
      const merged = {
        ...baseCategory,
        ...category,
        sportKey:
          detectedSportKey ||
          normalized.tournamentSportKey ||
          baseCategory?.sportKey ||
          category?.sportKey ||
          "",
        slotCount: Number(category?.slotCount || baseCategory?.slotCount || 1),
      };

      if (merged.sportKey === "pickleball") {
        merged.sportData = ensurePickleballTeamData(category?.sportData, rawFixtures);
      } else {
        merged.sportData =
          category?.sportData ??
          baseCategory?.sportData ??
          (hasPresetSportSchema(merged.sportKey)
            ? cloneDefaultPresetSportData(merged.sportKey, rawFixtures)
            : null);
      }

      syncCategoryPlayerStrings(merged);
      merged.lineupStatus = isCategoryLineupComplete(merged) ? "accepted" : "pending";

      if (normalized.tieLocked) {
        merged.categoryLocked = Boolean(
          merged.categoryLocked || merged.sportData?.categoryLocked || merged.winnerSide
        );
      }

      return merged;
    });

    return normalized;
  }

  function loadTeamTieState(matchObj, rawFixtures) {
    const key = getTeamStorageKey();
    const fresh = buildInitialTeamState(matchObj, rawFixtures);

    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(key) || "null");
    } catch {}

    const normalizedSaved = normalizeLoadedTeamTieState(saved, matchObj, fresh, rawFixtures);

    const backendCandidate = buildInitialTeamState(matchObj, rawFixtures);
    hydrateTeamTieStateFromMatch(matchObj, backendCandidate, rawFixtures);
    const normalizedBackend = normalizeLoadedTeamTieState(
      backendCandidate,
      matchObj,
      fresh,
      rawFixtures
    );

    const savedScore = getTeamTieStateProgressScore(normalizedSaved);
    const backendScore = getTeamTieStateProgressScore(normalizedBackend);

    if (backendScore >= savedScore && normalizedBackend) return normalizedBackend;
    if (normalizedSaved) return normalizedSaved;
    return fresh;
  }

  function saveTeamTieState(teamState) {
    if (teamState && typeof teamState === "object") {
      teamState.updatedAt = new Date().toISOString();
    }
    localStorage.setItem(getTeamStorageKey(), JSON.stringify(teamState));
  }

  function mergeCategorySnapshot(target, snapshot, rawFixtures) {
    if (!snapshot || typeof snapshot !== "object") return target;

    const forcedSportKey =
      detectEffectiveSportKey(rawFixtures) ||
      target?.sportKey ||
      snapshot?.sportKey ||
      "";

    Object.assign(target, snapshot);

    target.sportKey = forcedSportKey;
    target.slotCount = Number(snapshot.slotCount || target.slotCount || 1);

    if (target.sportKey === "pickleball") {
      target.sportData = ensurePickleballTeamData(snapshot.sportData, rawFixtures);
    } else {
      target.sportData =
        snapshot?.sportData ??
        (hasPresetSportSchema(target.sportKey)
          ? cloneDefaultPresetSportData(target.sportKey, rawFixtures)
          : null);
    }

    syncCategoryPlayerStrings(target);
    target.lineupStatus = isCategoryLineupComplete(target) ? "accepted" : "pending";
    return target;
  }

  function hydrateTeamTieStateFromMatch(matchObj, teamTieState, rawFixtures) {
    if (!matchObj || !teamTieState) return;

    const homeUsage = toArray(matchObj?.lineups?.home?.usage).map((item) => safeText(item?.playerName || item?.name)).filter(Boolean);
    const awayUsage = toArray(matchObj?.lineups?.away?.usage).map((item) => safeText(item?.playerName || item?.name)).filter(Boolean);
    if (homeUsage.length) teamTieState.homeRoster = homeUsage;
    if (awayUsage.length) teamTieState.awayRoster = awayUsage;

    const homeAssignments = toArray(matchObj?.lineups?.home?.assignments);
    const awayAssignments = toArray(matchObj?.lineups?.away?.assignments);

    const forcedSportKey = detectEffectiveSportKey(rawFixtures) || teamTieState.tournamentSportKey || "";

    teamTieState.categories.forEach((category, index) => {
      const homeAssignment = homeAssignments.find((item) => Number(item?.scoreIndex) === index);
      const awayAssignment = awayAssignments.find((item) => Number(item?.scoreIndex) === index);

      category.sportKey = forcedSportKey || category.sportKey || "";

      if (homeAssignment && Array.isArray(homeAssignment.players)) {
        category.homePlayersSelected = homeAssignment.players.map((p) => safeText(p)).filter(Boolean);
      }
      if (awayAssignment && Array.isArray(awayAssignment.players)) {
        category.awayPlayersSelected = awayAssignment.players.map((p) => safeText(p)).filter(Boolean);
      }

      if (category.sportKey === "pickleball") {
        category.sportData = ensurePickleballTeamData(category.sportData, rawFixtures);
      }

      syncCategoryPlayerStrings(category);
    });

    toArray(matchObj?.submatches).forEach((submatch, index) => {
      const snapshot = submatch?.score?.state?.meta?.categorySnapshot;
      if (teamTieState.categories[index] && snapshot) {
        mergeCategorySnapshot(teamTieState.categories[index], snapshot, rawFixtures);
      }
    });

    const aggregateTie = matchObj?.score?.state?.meta?.teamTieState;
    if (aggregateTie && typeof aggregateTie === "object") {
      teamTieState.homeRoster = resolveRosterList(
        aggregateTie.homeRoster,
        teamTieState.homeRoster,
        matchObj?.home
      );
      teamTieState.awayRoster = resolveRosterList(
        aggregateTie.awayRoster,
        teamTieState.awayRoster,
        matchObj?.away
      );
      teamTieState.tournamentSportKey = safeText(
        aggregateTie.tournamentSportKey,
        teamTieState.tournamentSportKey || forcedSportKey || ""
      );
      teamTieState.lineupCollapsed = Boolean(aggregateTie.lineupCollapsed);
      teamTieState.tieLocked = Boolean(aggregateTie.tieLocked || teamTieState.tieLocked);

      if (Array.isArray(aggregateTie.categories)) {
        aggregateTie.categories.forEach((snapshot, index) => {
          if (teamTieState.categories[index]) {
            mergeCategorySnapshot(teamTieState.categories[index], snapshot, rawFixtures);
          }
        });
      }
    }

    teamTieState.categories.forEach((category) => {
      category.sportKey = forcedSportKey || category.sportKey || "";

      if (category.sportKey === "pickleball") {
        category.sportData = ensurePickleballTeamData(category.sportData, rawFixtures);
      }

      syncCategoryPlayerStrings(category);
      category.lineupStatus = isCategoryLineupComplete(category) ? "accepted" : "pending";

      if (teamTieState.tieLocked) {
        category.categoryLocked = true;
        category.isScoringOpen = false;
      }
    });
  }

  function getPickleballCategoryMatchPoints(category) {
    const pb = ensurePickleballTeamData(category?.sportData, fixtures);
    return toArray(pb?.sets).reduce(
      (acc, set) => {
        acc.home += Number(set?.homePoints || 0);
        acc.away += Number(set?.awayPoints || 0);
        return acc;
      },
      { home: 0, away: 0 }
    );
  }

  function startPickleballSet(category, setIndex) {
    const pb = ensurePickleballTeamData(category?.sportData, fixtures);

    if (pb.categoryLocked || category?.categoryLocked) return;
    if (
      !pb.tossWinner ||
      !pb.startingServer ||
      !pb.startingServerPlayer ||
      !pb.startingReceiver ||
      !pb.startingReceiverPlayer
    ) return;
    if (!Number.isInteger(setIndex) || setIndex < 0 || setIndex >= pb.sets.length) return;

    const set = pb.sets[setIndex];
    if (!set || set.started || set.completed) return;

    if (
      Number.isInteger(pb.currentSetIndex) &&
      pb.sets[pb.currentSetIndex] &&
      pb.sets[pb.currentSetIndex].started &&
      !pb.sets[pb.currentSetIndex].completed
    ) {
      return;
    }

    pb.gameStartingServerBySide = pb.gameStartingServerBySide || { A: null, B: null };
    if (pb.startingServer && pb.startingServerPlayer) {
      pb.gameStartingServerBySide[pb.startingServer] = pb.startingServerPlayer;
    }
    if (pb.startingReceiver && pb.startingReceiverPlayer) {
      pb.gameStartingServerBySide[pb.startingReceiver] = pb.startingReceiverPlayer;
    }

    set.history = Array.isArray(set.history) ? set.history : [];
    set.history.push({
      snapshot: capturePickleballSetSnapshot(set),
      pbCurrentSetIndex: pb.currentSetIndex,
    });

    set.started = true;
    set.completed = false;
    set.currentServer = pb.startingServer;
    set.currentServerName = pb.startingServerPlayer;
    set.currentReceiver = pb.startingReceiver;
    set.currentReceiverName = pb.startingReceiverPlayer;
    set.currentServerTurn = 1;
    set.openingSequenceActive = true;
    set.homePoints = Number(set.homePoints || 0);
    set.awayPoints = Number(set.awayPoints || 0);
    set.winnerSide = null;

    pb.currentSetIndex = setIndex;
    category.sportData = pb;
  }

  function applyPickleballRally(category, rallyWinnerSide) {
    const pb = ensurePickleballTeamData(category?.sportData, fixtures);
    const setIndex = pb.currentSetIndex;

    if (pb.categoryLocked || category?.categoryLocked) return;
    if (!Number.isInteger(setIndex) || !pb.sets[setIndex]) return;

    const set = pb.sets[setIndex];
    if (!set.started || set.completed) return;

    set.history = Array.isArray(set.history) ? set.history : [];
    set.history.push({
      snapshot: capturePickleballSetSnapshot(set),
      pbCurrentSetIndex: pb.currentSetIndex,
    });

    const winnerSide = rallyWinnerSide === "B" ? "B" : "A";
    const servingSide = set.currentServer === "B" ? "B" : "A";
    const receivingSide = servingSide === "A" ? "B" : "A";

    if (winnerSide === servingSide) {
      // Serving team won rally => score point, same server continues
      if (servingSide === "A") set.homePoints = Number(set.homePoints || 0) + 1;
      else set.awayPoints = Number(set.awayPoints || 0) + 1;

      const servingScore = servingSide === "A" ? Number(set.homePoints || 0) : Number(set.awayPoints || 0);
      const receivingScore = receivingSide === "A" ? Number(set.homePoints || 0) : Number(set.awayPoints || 0);

      // same server continues, but receiver changes because serve switches court
      set.currentReceiver = receivingSide;
      set.currentReceiverName = getReceiverNameForServingSide(
        category,
        pb,
        servingSide,
        servingScore,
        receivingScore
      );
    } else {
      // Receiving team won rally => serving team faulted
      if (set.openingSequenceActive) {
        // Opening service sequence: immediate side-out
        set.openingSequenceActive = false;
        set.currentServer = receivingSide;
        set.currentServerTurn = 1;

        const newServingScore = receivingSide === "A" ? Number(set.homePoints || 0) : Number(set.awayPoints || 0);
        const newReceivingSide = receivingSide === "A" ? "B" : "A";
        const newReceivingScore = newReceivingSide === "A" ? Number(set.homePoints || 0) : Number(set.awayPoints || 0);

        set.currentServerName = getFirstServerNameForSide(category, pb, receivingSide, newServingScore);
        set.currentReceiver = newReceivingSide;
        set.currentReceiverName = getReceiverNameForServingSide(
          category,
          pb,
          receivingSide,
          newServingScore,
          newReceivingScore
        );
      } else if (Number(set.currentServerTurn || 1) === 1) {
        // First server lost rally => partner becomes second server
        set.currentServerTurn = 2;

        const sameSideScore = servingSide === "A" ? Number(set.homePoints || 0) : Number(set.awayPoints || 0);
        const otherSideScore = receivingSide === "A" ? Number(set.homePoints || 0) : Number(set.awayPoints || 0);

        set.currentServer = servingSide;
        set.currentServerName = getSecondServerNameForSide(category, pb, servingSide, sameSideScore);
        set.currentReceiver = receivingSide;
        set.currentReceiverName = getReceiverNameForServingSide(
          category,
          pb,
          servingSide,
          sameSideScore,
          otherSideScore
        );
      } else {
        // Second server lost rally => side-out
        set.currentServer = receivingSide;
        set.currentServerTurn = 1;

        const newServingScore = receivingSide === "A" ? Number(set.homePoints || 0) : Number(set.awayPoints || 0);
        const newReceivingSide = receivingSide === "A" ? "B" : "A";
        const newReceivingScore = newReceivingSide === "A" ? Number(set.homePoints || 0) : Number(set.awayPoints || 0);

        set.currentServerName = getFirstServerNameForSide(category, pb, receivingSide, newServingScore);
        set.currentReceiver = newReceivingSide;
        set.currentReceiverName = getReceiverNameForServingSide(
          category,
          pb,
          receivingSide,
          newServingScore,
          newReceivingScore
        );
      }
    }

    const target = Number(pb.targetPoints || 11);
    const homePoints = Number(set.homePoints || 0);
    const awayPoints = Number(set.awayPoints || 0);

    if (homePoints >= target || awayPoints >= target) {
      set.completed = true;
      set.winnerSide = homePoints > awayPoints ? "A" : "B";
      pb.currentSetIndex = null;
    }

    category.sportData = pb;
  }

  function undoPickleballSet(category, setIndex) {
    const pb = ensurePickleballTeamData(category?.sportData, fixtures);

    if (!Number.isInteger(setIndex) || !pb.sets[setIndex]) return;

    const set = pb.sets[setIndex];
    set.history = Array.isArray(set.history) ? set.history : [];

    if (!set.history.length) return;

    const previous = set.history.pop();
    if (!previous?.snapshot) return;

    set.started = Boolean(previous.snapshot.started);
    set.completed = Boolean(previous.snapshot.completed);
    set.currentServer = previous.snapshot.currentServer || null;
    set.currentServerName = previous.snapshot.currentServerName || null;
    set.currentReceiver = previous.snapshot.currentReceiver || null;
    set.currentReceiverName = previous.snapshot.currentReceiverName || null;
    set.currentServerTurn = Number(previous.snapshot.currentServerTurn || 1);
    set.openingSequenceActive = Boolean(previous.snapshot.openingSequenceActive);
    set.homePoints = Number(previous.snapshot.homePoints || 0);
    set.awayPoints = Number(previous.snapshot.awayPoints || 0);
    set.winnerSide = previous.snapshot.winnerSide || null;

    pb.currentSetIndex =
      previous.pbCurrentSetIndex === undefined ? null : previous.pbCurrentSetIndex;

    pb.categoryLocked = false;
    category.categoryLocked = false;
    if (category.winnerSide) category.winnerSide = null;

    category.sportData = pb;
  }

  function resetPickleballSet(category, setIndex) {
    const pb = ensurePickleballTeamData(category?.sportData, fixtures);

    if (!Number.isInteger(setIndex) || !pb.sets[setIndex]) return;

    pb.sets[setIndex] = {
      number: setIndex + 1,
      started: false,
      completed: false,
      currentServer: null,
      currentServerName: null,
      currentReceiver: null,
      currentReceiverName: null,
      currentServerTurn: 1,
      openingSequenceActive: false,
      homePoints: 0,
      awayPoints: 0,
      winnerSide: null,
      history: [],
    };

    if (pb.currentSetIndex === setIndex) {
      pb.currentSetIndex = null;
    }

    pb.categoryLocked = false;
    category.categoryLocked = false;
    category.winnerSide = null;

    category.sportData = pb;
  }

  function declarePickleballCategoryWinner(category, side, categoryIndex, teamTieState) {
    const pb = ensurePickleballTeamData(category?.sportData, fixtures);

    if (teamTieState?.tieLocked) return;
    if (pb.currentSetIndex != null) return;

    const winnerSide = side === "B" ? "B" : "A";
    category.winnerSide = winnerSide;
    category.categoryLocked = true;
    category.isScoringOpen = false;

    pb.categoryLocked = true;
    pb.currentSetIndex = null;

    category.sportData = pb;
  }

  function getPresetCategoryMatchPoints(category) {
    const sportKey = category?.sportKey || "";
    const data = category?.sportData || {};

    if (sportKey === "pickleball") {
      return getPickleballCategoryMatchPoints(category);
    }

    if (sportKey === "cricket") {
      return {
        home: Number(data.homeRuns || 0),
        away: Number(data.awayRuns || 0),
      };
    }

    if (sportKey === "football") {
      return {
        home: Number(data.homeGoals || 0),
        away: Number(data.awayGoals || 0),
      };
    }

    if (sportKey === "badminton") {
      return toArray(data.games).reduce(
        (acc, game) => {
          acc.home += Number(game?.a || 0);
          acc.away += Number(game?.b || 0);
          return acc;
        },
        { home: 0, away: 0 }
      );
    }

    if (sportKey === "tennis") {
      return toArray(data.sets).reduce(
        (acc, setRow) => {
          acc.home += Number(setRow?.a || 0);
          acc.away += Number(setRow?.b || 0);
          return acc;
        },
        { home: 0, away: 0 }
      );
    }

    return {
      home: Number(category?.homeScore || 0),
      away: Number(category?.awayScore || 0),
    };
  }

  function getCategoryMatchPoints(category) {
    return getPresetCategoryMatchPoints(category);
  }

  function formatCategoryPointsText(category) {
    const points = getCategoryMatchPoints(category);
    return `${Number(points.home || 0)}-${Number(points.away || 0)} pts`;
  }

  function computeTeamTieSummary(teamState) {
    const homeWins = teamState.categories.filter((c) => c.winnerSide === "A").length;
    const awayWins = teamState.categories.filter((c) => c.winnerSide === "B").length;
    const readyLineups = teamState.categories.filter((c) => isCategoryLineupComplete(c)).length;

    const matchPointTotals = teamState.categories.reduce(
      (acc, category) => {
        const pts = getCategoryMatchPoints(category);
        acc.homeMatchPoints += Number(pts.home || 0);
        acc.awayMatchPoints += Number(pts.away || 0);
        return acc;
      },
      { homeMatchPoints: 0, awayMatchPoints: 0 }
    );

    return {
      homeWins,
      awayWins,
      readyLineups,
      total: teamState.categories.length,
      allAccepted: teamState.categories.length > 0 && readyLineups === teamState.categories.length,
      allCompleted: teamState.categories.length > 0 && teamState.categories.every((c) => Boolean(c.winnerSide)),
      homeMatchPoints: matchPointTotals.homeMatchPoints,
      awayMatchPoints: matchPointTotals.awayMatchPoints,
    };
  }

  function getStatusChipClass(status) {
    if (status === "accepted") return "status-chip accepted";
    if (status === "rejected") return "status-chip rejected";
    return "status-chip pending";
  }

  function showTeamEventShell() {
    individualScoreShell?.classList.add("hidden");
    teamEventShell?.classList.remove("hidden");
    saveBtn?.classList.add("hidden");
    overlay?.classList.remove("show");
    drawer?.classList.remove("open");
  }

  function showIndividualEventShell() {
    teamEventShell?.classList.add("hidden");
    individualScoreShell?.classList.remove("hidden");
    saveBtn?.classList.add("hidden");
  }

  let fixtures = null;
let schema = null;

try {
  let fixturesResp = null;
  let tournamentResp = null;

  const fixtureUrls = [
    `/api/tournaments/${encodeURIComponent(tournamentId)}/fixtures`,
    `/api/host/tournaments/${encodeURIComponent(tournamentId)}/fixtures`,
  ];

  for (const url of fixtureUrls) {
    try {
      fixturesResp = await apiGet(url);
      const parsed = unwrapFixturesPayload(fixturesResp);
      if (parsed?.categories) {
        fixtures = parsed;
        break;
      }
    } catch (err) {
      // try next candidate
    }
  }

  if (!fixtures) {
    throw new Error("Could not load fixtures for this tournament");
  }

  const tournamentUrls = [
    `/api/tournaments/${encodeURIComponent(tournamentId)}`,
    `/api/host/tournaments/${encodeURIComponent(tournamentId)}`,
  ];

  for (const url of tournamentUrls) {
    try {
      tournamentResp = await apiGet(url);
      break;
    } catch (err) {
      // try next candidate
    }
  }

  const tournament =
    tournamentResp?.data?.data ||
    tournamentResp?.data ||
    tournamentResp ||
    {};

  fixtures = {
    ...(fixtures || {}),
    sportName: fixtures?.sportName || tournament?.sportName || "",
    tournamentType: fixtures?.tournamentType || tournament?.tournamentType || "",
    advancedSettings: fixtures?.advancedSettings || tournament?.advancedSettings || null,

    meta: {
      ...(fixtures?.meta || {}),
      sportName:
        fixtures?.meta?.sportName ||
        fixtures?.sportName ||
        tournament?.sportName ||
        "",
      tournamentType:
        fixtures?.meta?.tournamentType ||
        fixtures?.tournamentType ||
        tournament?.tournamentType ||
        "",
      advancedSettings:
        fixtures?.meta?.advancedSettings ||
        fixtures?.advancedSettings ||
        tournament?.advancedSettings ||
        null,
    },

    tournament: {
      ...(fixtures?.tournament || {}),
      ...tournament,
      sportName:
        fixtures?.tournament?.sportName ||
        fixtures?.sportName ||
        tournament?.sportName ||
        "",
      tournamentType:
        fixtures?.tournament?.tournamentType ||
        fixtures?.tournamentType ||
        tournament?.tournamentType ||
        "",
      advancedSettings:
        fixtures?.tournament?.advancedSettings ||
        fixtures?.advancedSettings ||
        tournament?.advancedSettings ||
        null,
    },
  };
} catch (e) {
  console.error(e);
  titleEl.textContent = "Failed to load fixtures";
  subEl.textContent = String(e?.message || e);
  return;
}

  try {
    if (categoryId) {
      const schemaResp = await apiGet(
        `/api/host/tournaments/${encodeURIComponent(tournamentId)}/scoring-schema/active?categoryId=${encodeURIComponent(categoryId)}`
      );
      schema = schemaResp?.ok ? schemaResp.data : schemaResp;
    }
  } catch (e) {
    console.warn("Scoring schema not loaded yet.", e);
    schema = null;
  }

  const { categoryId: resolvedCategoryId, match } = findFirstMatch(fixtures, categoryId, roundIndex, matchIndex);
  const homeLabel = match?.home ?? "Home";
  const awayLabel = match?.away ?? "Away";
  const isTeamEvent = detectTeamEvent(fixtures);

  if (isTeamEvent) {
    await loadTeamRosterLookup();
  }

  if (!match) {
    titleEl.textContent = "Match not found";
    subEl.textContent = "Invalid round / match or category data missing.";
    if (saveBtn) saveBtn.disabled = true;
    return;
  }

  if (String(homeLabel).toUpperCase() === "BYE" || String(awayLabel).toUpperCase() === "BYE") {
    titleEl.textContent = `${homeLabel} vs ${awayLabel}`;
    subEl.textContent = `Round ${roundIndex + 1} • Match ${matchIndex + 1}`;
    if (isTeamEvent) showTeamEventShell();
    statusPill?.classList.add("error");
    if (statusPill) statusPill.innerHTML = `Status: <strong>BYE</strong>`;
    if (winnerPill) winnerPill.innerHTML = `Winner: <strong>-</strong>`;
    if (reasonPill) reasonPill.innerHTML = `Reason: <strong>BYE match — no scoring needed.</strong>`;
    if (saveBtn) saveBtn.disabled = true;
    return;
  }

  if (isTeamEvent) {
    showTeamEventShell();

    titleEl.textContent = `${homeLabel} vs ${awayLabel}`;
    subEl.textContent = `Team event • Round ${roundIndex + 1} • Match ${matchIndex + 1}`;

    if (teamOverallHomeName) teamOverallHomeName.textContent = homeLabel;
    if (teamOverallAwayName) teamOverallAwayName.textContent = awayLabel;
    if (teamOverallSub) {
      teamOverallSub.textContent = "Cumulative match points are shown prominently. Category wins are shown below.";
    }

    const teamTieState = loadTeamTieState(match, fixtures);
    hydrateTeamTieStateFromMatch(match, teamTieState, fixtures);

    let savingTeam = false;
    const scheduleTeamAutoSave = debounce(() => {
      saveTeamEventAggregate({ silent: true });
    }, 550);

    function setCategoryPlayersFromSelects(category, side, row) {
      const values = Array.from(row.querySelectorAll(`[data-side="${side}"]`))
        .map((el) => safeText(el.value))
        .filter(Boolean);
      if (side === "A") category.homePlayersSelected = Array.from(new Set(values));
      else category.awayPlayersSelected = Array.from(new Set(values));
      syncCategoryPlayerStrings(category);
      category.lineupStatus = isCategoryLineupComplete(category) ? "accepted" : "pending";
    }

    function buildPlayerOptions(roster, currentValue, selectedValues = []) {
      return roster
        .map((name) => {
          const selected = String(currentValue) === String(name) ? "selected" : "";
          return `<option value="${escapeHtml(name)}" ${selected}>${escapeHtml(name)}</option>`;
        })
        .join("");
    }

    function syncLineupCollapseUi() {
      if (!lineupReviewPanel || !toggleLineupReviewBtn) return;
      lineupReviewPanel.classList.toggle("collapsed", Boolean(teamTieState.lineupCollapsed));
      if (teamLineupToggleText) teamLineupToggleText.textContent = teamTieState.lineupCollapsed ? "Expand" : "Collapse";
    }

    function syncTeamSummaryUi() {
      const summary = computeTeamTieSummary(teamTieState);
      if (teamOverallHomeScore) teamOverallHomeScore.textContent = String(summary.homeWins);
      if (teamOverallAwayScore) teamOverallAwayScore.textContent = String(summary.awayWins);
      if (teamOverallHomePoints) teamOverallHomePoints.textContent = String(summary.homeMatchPoints);
      if (teamOverallAwayPoints) teamOverallAwayPoints.textContent = String(summary.awayMatchPoints);

      if (teamCategoryHelp) {
        if (teamTieState.tieLocked) {
          teamCategoryHelp.textContent = "Scores locked for this tie.";
        } else if (!summary.allAccepted) {
          teamCategoryHelp.textContent = "Complete both team lineups in every category using dropdowns. Lineups auto-accept once complete.";
        } else if (summary.allCompleted) {
          teamCategoryHelp.textContent = "All category matches are completed. Lock scores to freeze this tie.";
        } else {
          teamCategoryHelp.textContent = "You can start scoring any category once both team lineups are complete.";
        }
      }

      if (lockTeamScoresBtn) {
        lockTeamScoresBtn.classList.toggle("hidden", !(summary.allCompleted || teamTieState.tieLocked));
        lockTeamScoresBtn.disabled = false;
        lockTeamScoresBtn.textContent = teamTieState.tieLocked ? "Unlock scores" : "Lock scores";
      }

      syncLineupCollapseUi();
    }

    function renderLineupReview() {
      if (!lineupReviewList) return;
      clear(lineupReviewList);

      teamTieState.categories.forEach((category, index) => {
        syncCategoryPlayerStrings(category);
        const slotCount = getCategorySlotCount(category);
        const row = document.createElement("div");
        row.className = "lineup-row";
        row.innerHTML = `
          <div class="lineup-row-head">
            <div>
              <div class="lineup-row-title">${escapeHtml(category.name)}</div>
              <div class="helper-text">${escapeHtml(getCategoryFormatLabel(category))} • Auto accepted once both teams are complete</div>
            </div>
            <div class="lineup-row-tools">
              <div class="${getStatusChipClass(isCategoryLineupComplete(category) ? "accepted" : "pending")} lineup-row-status">${isCategoryLineupComplete(category) ? "accepted" : "pending"}</div>
              <button type="button" class="lineup-action-btn" data-action="edit-lineup">Edit</button>
            </div>
          </div>
          <div class="lineup-row-body">
            <div class="lineup-side-grid">
              <div class="lineup-side-card">
                <div class="lineup-side-title">${escapeHtml(homeLabel)}</div>
                <div class="lineup-slot-grid" data-side-wrap="A">
                  ${Array.from({ length: slotCount }, (_, slot) => `
                    <select class="lineup-player-select" data-side="A" data-slot="${slot}" ${teamTieState.tieLocked ? "disabled" : ""}>
                      <option value="">Select player</option>
                      ${buildPlayerOptions(teamTieState.homeRoster, getSelectedPlayers(category, "A")[slot] || "")}
                    </select>
                  `).join("")}
                </div>
              </div>
              <div class="lineup-side-card">
                <div class="lineup-side-title">${escapeHtml(awayLabel)}</div>
                <div class="lineup-slot-grid" data-side-wrap="B">
                  ${Array.from({ length: slotCount }, (_, slot) => `
                    <select class="lineup-player-select" data-side="B" data-slot="${slot}" ${teamTieState.tieLocked ? "disabled" : ""}>
                      <option value="">Select player</option>
                      ${buildPlayerOptions(teamTieState.awayRoster, getSelectedPlayers(category, "B")[slot] || "")}
                    </select>
                  `).join("")}
                </div>
              </div>
            </div>

            <div class="score-notes" style="margin-top: 12px;">
              <label>Host notes</label>
              <textarea data-role="notes" placeholder="Optional notes for this category" ${teamTieState.tieLocked ? "disabled" : ""}>${escapeHtml(category.notes)}</textarea>
            </div>
          </div>
        `;

        row.querySelector('[data-action="edit-lineup"]')?.addEventListener("click", () => {
          row.scrollIntoView({ behavior: "smooth", block: "nearest" });
          row.querySelector('select')?.focus();
        });

        const notesInput = row.querySelector('[data-role="notes"]');
        notesInput?.addEventListener("input", (event) => {
          category.notes = safeText(event.target.value);
          saveTeamTieState(teamTieState);
          scheduleTeamAutoSave();
        });

          row.querySelectorAll('.lineup-player-select').forEach((select) => {
            select.addEventListener("change", () => {
              setCategoryPlayersFromSelects(category, select.dataset.side, row);

              console.log("LINEUP DEBUG", {
                category: category.name,
                slotCount: getCategorySlotCount(category),
                homePlayersSelected: category.homePlayersSelected,
                awayPlayersSelected: category.awayPlayersSelected,
                lineupComplete: isCategoryLineupComplete(category),
                tieLocked: teamTieState.tieLocked,
              });

              saveTeamTieState(teamTieState);
              renderLineupReview();
              renderTeamCategoryBars();
              syncTeamSummaryUi();
              scheduleTeamAutoSave();
            });
          });

        lineupReviewList.appendChild(row);
      });
    }

    function renderTeamCategoryBars() {
      if (!teamCategoryBars) return;
      clear(teamCategoryBars);

      teamTieState.categories.forEach((category, index) => {
        syncCategoryPlayerStrings(category);
        const card = document.createElement("div");
        card.className = `category-card${category.isScoringOpen ? " open" : ""}`;

        const resultInfo = getCategoryResultInfo(category, homeLabel, awayLabel);
        const previousCompleted = true;

        const slotCount = getCategorySlotCount(category);
        const homeSelectedCount = getSelectedPlayers(category, "A").length;
        const awaySelectedCount = getSelectedPlayers(category, "B").length;
        const lineupComplete = isCategoryLineupComplete(category);

        const canScore = lineupComplete && !teamTieState.tieLocked;
        const canToggle = category.categoryLocked || category.isScoringOpen || canScore;

        const debugReason = teamTieState.tieLocked
          ? "LOCKED"
          : !lineupComplete
            ? `Need lineup • A ${homeSelectedCount}/${slotCount} • B ${awaySelectedCount}/${slotCount}`
            : "Ready";

        const buttonLabel = teamTieState.tieLocked
          ? "Locked"
          : category.isScoringOpen
            ? "Hide scoring"
            : category.categoryLocked
              ? "View result"
              : !isCategoryLineupComplete(category)
                ? "Complete lineup first"
                : "Start scoring";

        const categoryBody =
          category.sportKey === "pickleball"
            ? buildPickleballScoringMarkup(category, homeLabel, awayLabel)
            : buildPresetScoringMarkup(category, homeLabel, awayLabel);

        const manualWinnerMarkup =
          category.sportKey === "pickleball"
            ? ""
            : `
                <div class="category-winner-actions" style="margin-top: 14px;">
                  <button type="button" class="category-winner-btn primary" data-action="home-winner" ${teamTieState.tieLocked ? "disabled" : ""}>Mark ${escapeHtml(homeLabel)} winner</button>
                  <button type="button" class="category-winner-btn primary" data-action="away-winner" ${teamTieState.tieLocked ? "disabled" : ""}>Mark ${escapeHtml(awayLabel)} winner</button>
                  <button type="button" class="category-winner-btn" data-action="clear-winner" ${teamTieState.tieLocked ? "disabled" : ""}>Clear result</button>
                </div>
              `;

        card.innerHTML = `
          <div class="category-card-head">
            <div class="category-meta">
              <div class="category-title">${escapeHtml(category.name)}</div>
              <div class="category-matchup">${escapeHtml(category.homePlayer || "TBD")} vs ${escapeHtml(category.awayPlayer || "TBD")} <small>• ${escapeHtml(getCategoryFormatLabel(category))}</small></div>
            </div>
              <div class="category-actions">
                <div class="status-chip ${resultInfo.chipClass}">${escapeHtml(resultInfo.text)}</div>
                <div class="status-chip"><strong>${escapeHtml(formatCategoryPointsText(category))}</strong></div>
                <div class="status-chip">${escapeHtml(debugReason)}</div>
                <button type="button" class="lineup-action-btn primary" data-action="toggle-scoring" ${canToggle ? "" : "disabled"}>
                  ${escapeHtml(buttonLabel)}
                </button>
              </div>
          </div>
          <div class="category-card-body">
            ${categoryBody}
            ${manualWinnerMarkup}
            <div class="score-notes" style="margin-top: 14px;">
              <label>Category scoring notes</label>
              <textarea data-action="score-notes" placeholder="Optional notes for this category" ${teamTieState.tieLocked ? "disabled" : ""}>${escapeHtml(category.notes)}</textarea>
            </div>
          </div>
        `;

        const rerender = (saveNow = true) => {
          saveTeamTieState(teamTieState);
          renderTeamCategoryBars();
          syncTeamSummaryUi();
          if (saveNow) scheduleTeamAutoSave();
        };

        card.querySelector('[data-action="toggle-scoring"]')?.addEventListener("click", () => {
          if (!canToggle) return;
          category.isScoringOpen = !category.isScoringOpen;
          rerender(false);
        });

        if (category.sportKey === "pickleball") {
          bindPickleballHandlers(card, category, index, teamTieState, rerender);
        } else {
          bindPresetHandlers(card, category, rerender, teamTieState);

          card.querySelector('[data-action="home-winner"]')?.addEventListener("click", () => {
            category.winnerSide = "A";
            category.categoryLocked = true;
            category.isScoringOpen = false;
            rerender();
          });

          card.querySelector('[data-action="away-winner"]')?.addEventListener("click", () => {
            category.winnerSide = "B";
            category.categoryLocked = true;
            category.isScoringOpen = false;
            rerender();
          });

          card.querySelector('[data-action="clear-winner"]')?.addEventListener("click", () => {
            category.winnerSide = null;
            category.categoryLocked = false;
            rerender();
          });
        }

        card.querySelector('[data-action="score-notes"]')?.addEventListener("input", (event) => {
          category.notes = safeText(event.target.value);
          saveTeamTieState(teamTieState);
          scheduleTeamAutoSave();
        });

        if (teamTieState.tieLocked) {
          card.insertAdjacentHTML("beforeend", `<div class="category-lock-banner">Scores locked</div>`);
        }

        teamCategoryBars.appendChild(card);
      });
    }

    async function saveTeamEventAggregate({ silent = true } = {}) {
      if (savingTeam) return;
      savingTeam = true;
      const summary = computeTeamTieSummary(teamTieState);
      const candidateUrls = [
        `/api/host/tournaments/${encodeURIComponent(tournamentId)}/matches/score`,
      ];
      const hasSubmatches = Array.isArray(match?.submatches) && match.submatches.length >= teamTieState.categories.length;

      try {
        if (hasSubmatches) {
          for (let index = 0; index < teamTieState.categories.length; index += 1) {
            const category = teamTieState.categories[index];
            const totals = getCategoryMatchPoints(category);
            const targetPoints = Math.max(1, Number(Math.max(totals.home, totals.away) || 1));
            const payload = {
              tournamentId,
              categoryId: resolvedCategoryId,
              roundIndex,
              matchIndex,
              round: roundIndex,
              match: matchIndex,
              scoreIndex: index,
              score: {
                config: { targetPoints, winByTwo: false },
                state: {
                  A: { points: Number(totals.home || 0) },
                  B: { points: Number(totals.away || 0) },
                  meta: {
                    categorySnapshot: {
                      ...category,
                      sportKey: detectEffectiveSportKey(fixtures) || teamTieState.tournamentSportKey || category.sportKey || "",
                      sportData:
                        (detectEffectiveSportKey(fixtures) || teamTieState.tournamentSportKey || category.sportKey || "") === "pickleball"
                          ? ensurePickleballTeamData(category.sportData, fixtures)
                          : category.sportData,
                    },
                    tieLocked: teamTieState.tieLocked,
                  },
                },
                cricket: category.sportKey === "cricket" ? category.sportData : null,
                football: category.sportKey === "football" ? category.sportData : null,
                badminton: category.sportKey === "badminton" ? category.sportData : null,
                pickleball: category.sportKey === "pickleball" ? category.sportData : null,
                computed: {
                  status: category.winnerSide ? "completed" : (isCategoryLineupComplete(category) ? "live" : "pending"),
                  winnerSide: category.winnerSide || null,
                  winnerName: category.winnerSide === "A" ? homeLabel : category.winnerSide === "B" ? awayLabel : null,
                },
              },
            };
            for (const url of candidateUrls) {
              await apiPut(url, payload);
              break;
            }
          }
        }

          if (!hasSubmatches) {
            const aggregatePayload = {
              tournamentId,
              categoryId: resolvedCategoryId,
              roundIndex,
              matchIndex,
              round: roundIndex,
              match: matchIndex,
              scoreIndex: 0,
              score: {
                config: { targetPoints: Math.max(1, Number(Math.max(summary.homeMatchPoints, summary.awayMatchPoints) || 1)), winByTwo: false },
                state: {
                  A: { points: Number(summary.homeMatchPoints || 0) },
                  B: { points: Number(summary.awayMatchPoints || 0) },
                  meta: { teamTieState },
                },
                computed: {
                  status: summary.allCompleted ? "completed" : (summary.readyLineups ? "live" : "pending"),
                  winnerSide: summary.homeWins > summary.awayWins ? "A" : summary.awayWins > summary.homeWins ? "B" : null,
                  winnerName: summary.homeWins > summary.awayWins ? homeLabel : summary.awayWins > summary.homeWins ? awayLabel : null,
                },
              },
            };
            await apiPut(candidateUrls[0], aggregatePayload);
          }

          const aggregateStatus = getTeamAggregateStatus(teamTieState);
          const aggregateWinner = getTeamAggregateWinner(summary, aggregateStatus);

          await patchFixtureStatusInBackend({
            explicitCategoryId: resolvedCategoryId,
            roundIndex,
            matchIndex,
            status: aggregateStatus,
            winnerName: aggregateWinner,
            computed: {
              status: aggregateStatus,
              winnerName: aggregateWinner,
              homeCategoryWins: Number(summary?.homeCategoryWins ?? summary?.homeWins ?? 0),
              awayCategoryWins: Number(summary?.awayCategoryWins ?? summary?.awayWins ?? 0),
              homeMatchPoints: Number(summary?.homeMatchPoints ?? summary?.homePoints ?? 0),
              awayMatchPoints: Number(summary?.awayMatchPoints ?? summary?.awayPoints ?? 0),
              tieLocked: Boolean(teamTieState?.tieLocked),
            },
          });
        } catch (err) {
        console.error(err);
        if (!silent) alert(err?.message || "Could not auto-save tie data.");
      } finally {
        savingTeam = false;
      }
    }

    toggleLineupReviewBtn?.addEventListener("click", () => {
      teamTieState.lineupCollapsed = !teamTieState.lineupCollapsed;
      saveTeamTieState(teamTieState);
      syncLineupCollapseUi();
    });

    lockTeamScoresBtn?.addEventListener("click", async () => {
      const shouldLock = !teamTieState.tieLocked;
      teamTieState.tieLocked = shouldLock;

      teamTieState.categories.forEach((category) => {
        category.categoryLocked = shouldLock ? true : false;
        category.isScoringOpen = false;

        if (category?.sportData && typeof category.sportData === "object") {
          category.sportData.categoryLocked = shouldLock;
        }
      });

      saveTeamTieState(teamTieState);
      renderLineupReview();
      renderTeamCategoryBars();
      syncTeamSummaryUi();
      await saveTeamEventAggregate({ silent: false });
    });

    renderLineupReview();
    renderTeamCategoryBars();
    syncTeamSummaryUi();
    scheduleTeamAutoSave();
    return;
  }

  showIndividualEventShell();

  if (!schema) {
    titleEl.textContent = "No scoring schema found";
    subEl.textContent = "Finalize scoring schema for this category first.";
    if (saveBtn) saveBtn.disabled = true;
    return;
  }

  titleEl.textContent = `${homeLabel} vs ${awayLabel}`;
  subEl.textContent = `${schema?.sport || ""} • Category ${resolvedCategoryId || categoryId || "-"} • Round ${roundIndex + 1} • Match ${matchIndex + 1}`;

  homeNameEl.textContent = homeLabel;
  awayNameEl.textContent = awayLabel;

  const homePlayers = Array.isArray(match.homePlayers) ? match.homePlayers : splitTeamLabel(match.home);
  const awayPlayers = Array.isArray(match.awayPlayers) ? match.awayPlayers : splitTeamLabel(match.away);

  const existing = match.score || null;

  const state = {
    config: {},
    state: {
      A: { players: {} },
      B: { players: {} },
    },
    timer: {
      elapsedMs: existing?.timer?.elapsedMs ?? 0,
      running: false,
      startedAtEpochMs: null,
    },
  };

  if (existing?.cricket) state.cricket = existing.cricket;
  if (existing?.football) state.football = existing.football;
  if (existing?.basketball) state.basketball = existing.basketball;
  if (existing?.badminton) state.badminton = existing.badminton;
  if (existing?.pickleball) state.pickleball = existing.pickleball;

  (schema.inputs || []).forEach((f) => {
    state.config[f.key] = existing?.config?.[f.key] ?? f.default ?? null;
  });

  function ensurePlayer(side, name) {
    if (!state.state[side].players[name]) state.state[side].players[name] = {};
    return state.state[side].players[name];
  }

  function initPlayers(side, roster) {
    roster.forEach((p) => {
      const obj = ensurePlayer(side, p);
      (schema.playerFields || []).forEach((f) => {
        const prev = existing?.state?.[side]?.players?.[p]?.[f.key];
        obj[f.key] = prev ?? f.default ?? (f.type === "text" ? "" : 0);
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
          totals[f.key] = roster.reduce((sum, p) => {
            const v = Number(state.state[side].players?.[p]?.[f.key] ?? 0);
            return sum + (Number.isFinite(v) ? v : 0);
          }, 0);
        }
      });

      Object.assign(state.state[side], totals);
    });
  }

  recomputeTeamTotals();

  function compute() {
    const logic = schema?.winnerLogic || {};
    const A = state.state.A;
    const B = state.state.B;
    const cfg = state.config;

    if (logic.type === "higherScoreWins") {
      const field = logic.field || "score";
      const a = Number(A[field] ?? 0);
      const b = Number(B[field] ?? 0);

      if (a > b) return { status: "completed", winnerName: homeLabel, reason: `${a} > ${b}` };
      if (b > a) return { status: "completed", winnerName: awayLabel, reason: `${b} > ${a}` };
      return { status: "pending", winnerName: null, reason: "Equal scores" };
    }

    if (logic.type === "firstToTarget") {
      const field = logic.field || "points";
      const a = Number(A[field] ?? 0);
      const b = Number(B[field] ?? 0);
      const target = Number(cfg[logic.targetFrom || "targetPoints"] ?? 0);
      const win2 = Boolean(cfg[logic.winByTwoFrom || "winByTwo"]);

      if (!target) return { status: "pending", winnerName: null, reason: "Target not set" };
      if (a >= target && (!win2 || a - b >= 2)) {
        return { status: "completed", winnerName: homeLabel, reason: `Reached ${a}/${target}` };
      }
      if (b >= target && (!win2 || b - a >= 2)) {
        return { status: "completed", winnerName: awayLabel, reason: `Reached ${b}/${target}` };
      }
      return { status: "pending", winnerName: null, reason: "Ongoing" };
    }

    return { status: "pending", winnerName: null, reason: "Unknown logic" };
  }

  function renderPills() {
    const c = compute();
    statusPill.innerHTML = `Status: <strong>${c.status}</strong>`;
    winnerPill.innerHTML = `Winner: <strong>${c.winnerName || "-"}</strong>`;
    reasonPill.innerHTML = `Reason: <strong>${c.reason || "-"}</strong>`;

    const logicField = schema?.winnerLogic?.field;
    if (logicField) {
      homeScoreEl.textContent = Number(state.state.A?.[logicField] ?? 0);
      awayScoreEl.textContent = Number(state.state.B?.[logicField] ?? 0);
    }

    if (individualAutoSaveEnabled && !suppressIndividualAutoSave) {
      if (saveMsg) saveMsg.textContent = "Saving...";
      scheduleIndividualAutoSave();
    }
  }

  let individualAutoSaveEnabled = false;
  let suppressIndividualAutoSave = false;
  const scheduleIndividualAutoSave = debounce(() => saveScore({ silent: true }), 500);

  renderPills();
  individualAutoSaveEnabled = true;

  toggleSettings?.addEventListener("click", () => {
    settingsPanel?.classList.toggle("open");
    toggleSettings.textContent = settingsPanel?.classList.contains("open") ? "✕ Settings" : "⚙ Settings";
  });

  function renderConfigFields() {
    clear(configWrap);

    const inputs = schema.inputs || [];
    if (!inputs.length) {
      configWrap.innerHTML = `<p class="helper-text">No match settings.</p>`;
      return;
    }

    inputs.forEach((f) => {
      const wrap = document.createElement("div");
      wrap.className = "field";

      const label = document.createElement("label");
      label.textContent = f.label || f.key;
      wrap.appendChild(label);

      let input;

      if (f.type === "number") {
        input = document.createElement("input");
        input.type = "number";
        input.value = state.config[f.key] ?? "";
        if (typeof f.min === "number") input.min = String(f.min);
        if (typeof f.max === "number") input.max = String(f.max);

        input.addEventListener("input", () => {
          state.config[f.key] = input.value === "" ? null : Number(input.value);
          renderPills();
        });
      } else if (f.type === "boolean") {
        input = document.createElement("select");
        input.innerHTML = `
          <option value="true">True</option>
          <option value="false">False</option>
        `;
        input.value = String(Boolean(state.config[f.key]));
        input.addEventListener("change", () => {
          state.config[f.key] = input.value === "true";
          renderPills();
        });
      } else {
        input = document.createElement("input");
        input.type = "text";
        input.value = state.config[f.key] ?? "";
        input.addEventListener("input", () => {
          state.config[f.key] = input.value;
          renderPills();
        });
      }

      wrap.appendChild(input);

      if (f.help) {
        const help = document.createElement("div");
        help.className = "helper-text";
        help.textContent = f.help;
        wrap.appendChild(help);
      }

      configWrap.appendChild(wrap);
    });
  }

  renderConfigFields();

  function formatMs(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function refreshTimerUi() {
    let ms = state.timer.elapsedMs;
    if (state.timer.running && state.timer.startedAtEpochMs) {
      ms += Date.now() - state.timer.startedAtEpochMs;
    }
    timerDisplay.textContent = formatMs(ms);
  }

  setInterval(refreshTimerUi, 250);
  refreshTimerUi();

  timerStartBtn?.addEventListener("click", () => {
    if (state.timer.running) return;
    state.timer.running = true;
    state.timer.startedAtEpochMs = Date.now();
    if (saveMsg) saveMsg.textContent = "Saving...";
    scheduleIndividualAutoSave();
  });

  timerPauseBtn?.addEventListener("click", () => {
    if (!state.timer.running) return;
    state.timer.elapsedMs += Date.now() - state.timer.startedAtEpochMs;
    state.timer.running = false;
    state.timer.startedAtEpochMs = null;
    refreshTimerUi();
    if (saveMsg) saveMsg.textContent = "Saving...";
    scheduleIndividualAutoSave();
  });

  timerResetBtn?.addEventListener("click", () => {
    state.timer.elapsedMs = 0;
    state.timer.running = false;
    state.timer.startedAtEpochMs = null;
    refreshTimerUi();
    if (saveMsg) saveMsg.textContent = "Saving...";
    scheduleIndividualAutoSave();
  });

  function closeDrawer() {
    drawer?.classList.remove("open");
    overlay?.classList.remove("show");
    document.body.classList.remove("drawer-lock");
  }

  function openDrawer({ playerName, teamLabel, fields, playerObj, onUpdate }) {
    drawerNameEl.textContent = playerName;
    drawerTeamEl.textContent = teamLabel;

    clear(drawerFields);

    fields.forEach((field) => {
      const row = document.createElement("div");
      row.className = "df-row";

      const lbl = document.createElement("div");
      lbl.className = "df-label";
      lbl.textContent = field.label || field.key;
      row.appendChild(lbl);

      if (field.type === "counter" || field.type === "number") {
        const ctrl = document.createElement("div");
        ctrl.className = "df-counter";

        const minBtn = document.createElement("button");
        minBtn.type = "button";
        minBtn.className = "df-counter-btn";
        minBtn.textContent = "−";

        const valEl = document.createElement("div");
        valEl.className = "df-counter-val";
        valEl.textContent = String(playerObj[field.key] ?? 0);

        const plusBtn = document.createElement("button");
        plusBtn.type = "button";
        plusBtn.className = "df-counter-btn df-counter-plus";
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
        const select = document.createElement("select");
        select.className = "df-select";

        const options = Array.isArray(field.options) ? field.options : [];
        select.innerHTML = options
          .map((opt) => `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`)
          .join("");

        select.value = String(playerObj[field.key] ?? (options[0] ?? ""));
        select.addEventListener("change", () => {
          playerObj[field.key] = select.value;
          onUpdate();
        });

        row.appendChild(select);
      } else {
        const input = document.createElement("input");
        input.className = "df-input";
        input.type = field.type === "number" ? "number" : "text";
        input.value = playerObj[field.key] ?? "";

        input.addEventListener("input", () => {
          playerObj[field.key] =
            field.type === "number"
              ? (input.value === "" ? 0 : Number(input.value))
              : input.value;
          onUpdate();
        });

        row.appendChild(input);
      }

      if (field.help) {
        const help = document.createElement("div");
        help.className = "df-help";
        help.textContent = field.help;
        row.appendChild(help);
      }

      drawerFields.appendChild(row);
    });

    drawer?.classList.add("open");
    overlay?.classList.add("show");
    document.body.classList.add("drawer-lock");
  }

  drawerClose?.addEventListener("click", closeDrawer);
  overlay?.addEventListener("click", closeDrawer);

  const logicField = schema?.winnerLogic?.field || null;
  const playerFields = schema.playerFields || [];

  function buildPanel(side, teamLabel, roster) {
    const panel = document.createElement("div");
    panel.className = "roster-panel";
    panel.dataset.side = side;

    const hdr = document.createElement("div");
    hdr.className = "roster-panel-header";
    hdr.innerHTML = `
      <span class="rp-label">${side === "A" ? "🏠" : "✈️"} ${escapeHtml(teamLabel)}</span>
      <span class="rp-close">✕</span>
    `;

    hdr.querySelector(".rp-close")?.addEventListener("click", () => {
      panel.classList.remove("active");
    });

    panel.appendChild(hdr);

    if (!roster.length) {
      const empty = document.createElement("div");
      empty.className = "rp-empty";
      empty.textContent = "No players available";
      panel.appendChild(empty);
      return panel;
    }

    roster.forEach((name) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "player-chip";

      function refreshChip() {
        const stat =
          logicField != null
            ? state.state[side].players?.[name]?.[logicField] ?? 0
            : null;

        chip.innerHTML = `
          <span class="pc-name">${escapeHtml(name)}</span>
          ${stat !== null ? `<span class="pc-stat">${escapeHtml(stat)}</span>` : ""}
        `;
      }

      refreshChip();

      chip.addEventListener("click", () => {
        ensurePlayer(side, name);
        openDrawer({
          playerName: name,
          teamLabel,
          fields: playerFields,
          playerObj: state.state[side].players[name],
          onUpdate: () => {
            recomputeTeamTotals();
            renderPills();
            refreshChip();
          },
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

  teamHomeBtn?.addEventListener("click", () => {
    homePanel.classList.toggle("active");
    awayPanel.classList.remove("active");
  });

  teamAwayBtn?.addEventListener("click", () => {
    awayPanel.classList.toggle("active");
    homePanel.classList.remove("active");
  });

  async function saveScore(options = {}) {
    const { silent = false } = options;
    if (state.timer.running && state.timer.startedAtEpochMs) {
      state.timer.elapsedMs += Date.now() - state.timer.startedAtEpochMs;
      state.timer.running = false;
      state.timer.startedAtEpochMs = null;
    }

    const computed = compute();

    const payload = {
      tournamentId,
      categoryId: resolvedCategoryId,
      roundIndex,
      matchIndex,
      round: roundIndex,
      match: matchIndex,
      scoreIndex,
      score: {
        config: state.config,
        state: state.state,
        timer: {
          elapsedMs: state.timer.elapsedMs,
        },
        cricket: state.cricket,
        football: state.football,
        basketball: state.basketball,
        badminton: state.badminton,
        pickleball: state.pickleball,
        computed,
      },
    };

    const candidateUrls = [
      `/api/host/tournaments/${encodeURIComponent(tournamentId)}/matches/score`,
      `/api/host/tournaments/${encodeURIComponent(tournamentId)}/score`,
    ];

    let saved = false;
    let lastError = null;

    for (const url of candidateUrls) {
      try {
        await apiPut(url, payload);
        saved = true;
        break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!saved) {
      console.error(lastError);
      if (saveMsg) saveMsg.textContent = "Auto-save failed";
      if (!silent) alert(lastError?.message || "Could not save score.");
      return;
    }

    await patchFixtureStatusInBackend({
      explicitCategoryId: resolvedCategoryId,
      roundIndex,
      matchIndex,
      status: computed?.status || "pending",
      winnerName: computed?.winnerName || null,
      computed,
    });

    if (saveMsg) saveMsg.textContent = "Saved";
    suppressIndividualAutoSave = true;
    renderPills();
    suppressIndividualAutoSave = false;
  }

});