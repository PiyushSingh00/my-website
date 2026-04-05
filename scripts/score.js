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
  const receiveLineupBtn = document.getElementById("receive-lineup-btn");
  const manualLineupBtn = document.getElementById("manual-lineup-btn");
  const lineupStatePill = document.getElementById("lineup-state-pill");
  const lineupReviewPanel = document.getElementById("lineup-review-panel");
  const lineupReviewList = document.getElementById("lineup-review-list");
  const teamCategoryBars = document.getElementById("team-category-bars");
  const teamCategoryHelp = document.getElementById("team-category-help");
  const teamOverallHomeName = document.getElementById("team-overall-home-name");
  const teamOverallAwayName = document.getElementById("team-overall-away-name");
  const teamOverallHomeScore = document.getElementById("team-overall-home-score");
  const teamOverallAwayScore = document.getElementById("team-overall-away-score");
  const teamOverallSub = document.getElementById("team-overall-sub");
  const toggleLineupReviewBtn = document.getElementById("toggle-lineup-review");

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

  function getPickleballTargetPoints(rawFixtures) {
    const raw =
      rawFixtures?.meta?.pickleballTargetPoints ||
      rawFixtures?.meta?.pointsToWin ||
      rawFixtures?.tournament?.pickleballTargetPoints ||
      rawFixtures?.tournament?.pointsToWin ||
      params.get("targetPoints") ||
      11;

    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 11;
  }

  function getPickleballTotalSets(rawFixtures) {
    const raw =
      rawFixtures?.meta?.pickleballTotalSets ||
      rawFixtures?.meta?.bestOf ||
      rawFixtures?.tournament?.pickleballTotalSets ||
      rawFixtures?.tournament?.bestOf ||
      params.get("totalSets") ||
      3;

    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 3;
  }

  function setsNeededToWin(totalSets) {
    return Math.floor(totalSets / 2) + 1;
  }

  function capturePickleballSetSnapshot(set) {
    return {
      started: Boolean(set.started),
      completed: Boolean(set.completed),
      currentServer: set.currentServer || null,
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
      currentSetIndex: null,
      categoryLocked: false,
      sets: Array.from({ length: totalSets }, (_, index) => ({
        number: index + 1,
        started: false,
        completed: false,
        currentServer: null,
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

    const totalSets = Number(existing.totalSets || defaults.totalSets);
    const safeTotalSets = Number.isFinite(totalSets) && totalSets > 0 ? totalSets : defaults.totalSets;

    const sets = Array.from({ length: safeTotalSets }, (_, index) => {
      const existingSet = Array.isArray(existing.sets) ? existing.sets[index] : null;
      return {
        number: index + 1,
        started: false,
        completed: false,
        currentServer: null,
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
      targetPoints: Number(existing.targetPoints || defaults.targetPoints) || defaults.targetPoints,
      totalSets: safeTotalSets,
      tossWinner: existing.tossWinner || null,
      startingServer: existing.startingServer || null,
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

  function getPickleballPlayerLabels(category, homeTeamLabel, awayTeamLabel) {
    return {
      homePlayerLabel: safeText(category?.homePlayer, homeTeamLabel),
      awayPlayerLabel: safeText(category?.awayPlayer, awayTeamLabel),
    };
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

    if (category.sportKey === "pickleball") {
      const pb = ensurePickleballTeamData(category.sportData, fixtures);
      const currentSet =
        Number.isInteger(pb.currentSetIndex) && pb.sets[pb.currentSetIndex]
          ? pb.sets[pb.currentSetIndex]
          : null;

      const { homePlayerLabel, awayPlayerLabel } = getPickleballPlayerLabels(category, homeTeamLabel, awayTeamLabel);

      if (currentSet && currentSet.started && !currentSet.completed) {
        const servingName = currentSet.currentServer === "A" ? homePlayerLabel : awayPlayerLabel;
        return {
          chipClass: "category-result-chip pending",
          text: `Set ${currentSet.number} live • Serve ${servingName}`,
        };
      }

      const completedSets = pb.sets.filter((set) => set.completed).length;
      if (completedSets > 0) {
        const { aWins, bWins } = getPickleballSetWins(pb);
        return {
          chipClass: "category-result-chip pending",
          text: `Sets ${aWins}-${bWins}`,
        };
      }

      if (pb.tossWinner || pb.startingServer) {
        return {
          chipClass: "category-result-chip pending",
          text: "Ready to start 1st set",
        };
      }

      return {
        chipClass: "category-result-chip pending",
        text: "Awaiting toss & first server",
      };
    }

    return { chipClass: "category-result-chip pending", text: "Result pending" };
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
    const setupLocked = anySetStarted;
    const nextSetIndex = getNextUnstartedPickleballSetIndex(pb);
    const currentSet =
      Number.isInteger(pb.currentSetIndex) && pb.sets[pb.currentSetIndex]
        ? pb.sets[pb.currentSetIndex]
        : null;
    const { aWins, bWins } = getPickleballSetWins(pb);

    return `
      <div class="preset-sport-tag">Team Event Pickleball</div>

      <div class="pickle-config-chips">
        <div class="pickle-config-chip">Points to win: ${escapeHtml(pb.targetPoints)}</div>
        <div class="pickle-config-chip">Total sets: ${escapeHtml(pb.totalSets)}</div>
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
                ${escapeHtml(homeTeamLabel)}
              </button>
              <button
                type="button"
                class="pickle-choice-btn ${pb.tossWinner === "B" ? "active" : ""}"
                data-pickle-action="pick-toss"
                data-side="B"
                ${setupLocked ? "disabled" : ""}
              >
                ${escapeHtml(awayTeamLabel)}
              </button>
            </div>
          </div>

          <div class="pickle-choice-group">
            <div class="pickle-choice-label">Who is serving first?</div>
            <div class="pickle-choice-row">
              <button
                type="button"
                class="pickle-choice-btn ${pb.startingServer === "A" ? "active" : ""}"
                data-pickle-action="pick-server"
                data-side="A"
                ${setupLocked ? "disabled" : ""}
              >
                ${escapeHtml(homeTeamLabel)}
              </button>
              <button
                type="button"
                class="pickle-choice-btn ${pb.startingServer === "B" ? "active" : ""}"
                data-pickle-action="pick-server"
                data-side="B"
                ${setupLocked ? "disabled" : ""}
              >
                ${escapeHtml(awayTeamLabel)}
              </button>
            </div>
          </div>
        </div>

        <div class="pickle-next-set-row">
          ${
            pb.categoryLocked
              ? `<div class="pickle-locked-note">Category locked after all sets are completed.</div>`
              : currentSet && currentSet.started && !currentSet.completed
                ? `<div class="pickle-note">Set ${escapeHtml(currentSet.number)} is live.</div>`
                : pb.tossWinner && pb.startingServer && nextSetIndex !== -1
                  ? `<button
                      type="button"
                      class="pickle-start-set-btn"
                      data-pickle-action="start-set"
                      data-set-index="${nextSetIndex}"
                    >
                      Start ${escapeHtml(ordinal(nextSetIndex + 1))} Set
                    </button>`
                  : `<div class="pickle-note">Select toss winner and first server to begin.</div>`
          }
        </div>
      </div>

      ${
        currentSet && currentSet.started && !currentSet.completed
          ? `
            <div class="pickle-live-card">
              <div class="pickle-live-head">
                <div>
                  <div class="panel-label">Set ${escapeHtml(currentSet.number)} in progress</div>
                  <div class="pickle-note">
                    A point is awarded only when the rally winner is currently serving.
                    If the rally winner was receiving, only the serve changes.
                  </div>
                </div>
                <div class="pickle-current-server">
                  Serve: <strong>${escapeHtml(currentSet.currentServer === "A" ? homeTeamLabel : awayTeamLabel)}</strong>
                </div>
              </div>

              <div class="pickle-live-scoreboard">
                <div class="pickle-live-team">
                  <span>${escapeHtml(homeTeamLabel)}</span>
                  <strong class="pickle-live-points">${escapeHtml(currentSet.homePoints)}</strong>
                </div>
                <div class="pickle-live-team">
                  <span>${escapeHtml(awayTeamLabel)}</span>
                  <strong class="pickle-live-points">${escapeHtml(currentSet.awayPoints)}</strong>
                </div>
              </div>

              <div class="pickle-rally-row">
                <button type="button" class="pickle-rally-btn primary" data-pickle-action="rally" data-side="A">
                  Rally won by ${escapeHtml(homeTeamLabel)}
                </button>
                <button type="button" class="pickle-rally-btn primary" data-pickle-action="rally" data-side="B">
                  Rally won by ${escapeHtml(awayTeamLabel)}
                </button>
              </div>
            </div>
          `
          : ""
      }

      <div class="pickle-sets-card">
        <div class="panel-label">Set summary</div>
        <div class="pickle-sets-list">
          ${pb.sets
            .map((set) => {
              const statusClass = set.completed
                ? "completed"
                : set.started
                  ? "live"
                  : "pending";

              const statusText = set.completed
                ? `${set.winnerSide === "A" ? homeTeamLabel : awayTeamLabel} won`
                : set.started
                  ? "Live"
                  : "Not started";

              return `
                <div class="pickle-set-chip ${statusClass}">
                  <div class="pickle-set-top">
                    <div class="pickle-set-name">Set ${escapeHtml(set.number)}</div>
                    <div class="pickle-set-status">${escapeHtml(statusText)}</div>
                  </div>
                  <div class="pickle-set-scoreline">
                    ${escapeHtml(homeTeamLabel)} ${escapeHtml(set.homePoints)} - ${escapeHtml(set.awayPoints)} ${escapeHtml(awayTeamLabel)}
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
    const sportKey = category?.sportKey || "";

    if (sportKey === "cricket" || sportKey === "football") {
      card.querySelectorAll("[data-preset-field]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const field = btn.dataset.presetField;
          const step = Number(btn.dataset.step || 0);
          category.sportData[field] = Math.max(0, Number(category.sportData?.[field] || 0) + step);
          rerender();
        });
      });

      card.querySelectorAll("[data-preset-input]").forEach((input) => {
        input.addEventListener("input", (event) => {
          const field = event.target.dataset.presetInput;
          category.sportData[field] = event.target.value;
          saveTeamTieState(teamTieState);
        });
      });

      return;
    }

    if (sportKey === "badminton" || sportKey === "tennis") {
      card.querySelectorAll("[data-preset-collection]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const collection = btn.dataset.presetCollection;
          const index = Number(btn.dataset.index);
          const side = btn.dataset.side;
          const step = Number(btn.dataset.step || 0);

          if (!Array.isArray(category.sportData?.[collection])) return;
          const row = category.sportData[collection][index];
          if (!row) return;

          row[side] = Math.max(0, Number(row[side] || 0) + step);
          rerender();
        });
      });

      return;
    }

    card.querySelector('[data-action="home-minus"]')?.addEventListener("click", () => {
      category.homeScore = Math.max(0, Number(category.homeScore || 0) - 1);
      rerender();
    });

    card.querySelector('[data-action="home-plus"]')?.addEventListener("click", () => {
      category.homeScore = Number(category.homeScore || 0) + 1;
      rerender();
    });

    card.querySelector('[data-action="away-minus"]')?.addEventListener("click", () => {
      category.awayScore = Math.max(0, Number(category.awayScore || 0) - 1);
      rerender();
    });

    card.querySelector('[data-action="away-plus"]')?.addEventListener("click", () => {
      category.awayScore = Number(category.awayScore || 0) + 1;
      rerender();
    });
  }


  function clearPickleballSet(set) {
    set.started = false;
    set.completed = false;
    set.currentServer = null;
    set.homePoints = 0;
    set.awayPoints = 0;
    set.winnerSide = null;
    set.history = [];
  }

  function clearPickleballFromSetIndex(pb, startIndex) {
    for (let i = startIndex; i < pb.sets.length; i += 1) {
      clearPickleballSet(pb.sets[i]);
    }
    pb.currentSetIndex = null;
    pb.categoryLocked = false;
  }

  function unlockNextCategory(teamTieState, currentIndex) {
    const nextIndex = teamTieState.categories.findIndex(
      (item, idx) => idx > currentIndex && item.lineupStatus === "accepted" && !item.categoryLocked
    );
    if (nextIndex !== -1) {
      teamTieState.categories[nextIndex].isScoringOpen = true;
    }
  }

  function lockPickleballCategory(category, winnerSide) {
    const pb = ensurePickleballTeamData(category.sportData, fixtures);
    pb.categoryLocked = true;
    pb.currentSetIndex = null;
    category.sportData = pb;
    category.winnerSide = winnerSide;
    category.categoryLocked = true;
    category.isScoringOpen = false;
  }

  function startPickleballSet(category, setIndex) {
    const pb = ensurePickleballTeamData(category.sportData, fixtures);
    const set = pb.sets[setIndex];
    if (!set || set.started || pb.categoryLocked) return;
    if (!pb.tossWinner || !pb.startingServer) return;

    set.started = true;
    set.completed = false;
    set.currentServer = pb.startingServer;
    set.homePoints = 0;
    set.awayPoints = 0;
    set.winnerSide = null;
    set.history = [];
    pb.currentSetIndex = setIndex;
    category.sportData = pb;
    category.isScoringOpen = true;
  }

  function applyPickleballRally(category, winnerSide) {
    const pb = ensurePickleballTeamData(category.sportData, fixtures);
    const currentSet =
      Number.isInteger(pb.currentSetIndex) && pb.sets[pb.currentSetIndex]
        ? pb.sets[pb.currentSetIndex]
        : null;

    if (!currentSet || !currentSet.started || currentSet.completed || pb.categoryLocked) return;

    currentSet.history.push(capturePickleballSetSnapshot(currentSet));

    if (currentSet.currentServer === winnerSide) {
      if (winnerSide === "A") currentSet.homePoints += 1;
      if (winnerSide === "B") currentSet.awayPoints += 1;
    } else {
      currentSet.currentServer = winnerSide;
    }

    const targetPoints = Number(pb.targetPoints || 11);
    if (currentSet.homePoints >= targetPoints || currentSet.awayPoints >= targetPoints) {
      currentSet.completed = true;
      currentSet.winnerSide = currentSet.homePoints > currentSet.awayPoints ? "A" : "B";
      pb.currentSetIndex = null;
    }

    category.sportData = pb;
  }

  function declarePickleballCategoryWinner(category, winnerSide, categoryIndex, teamTieState) {
    lockPickleballCategory(category, winnerSide);
    unlockNextCategory(teamTieState, categoryIndex);
  }

  function undoPickleballSet(category, setIndex) {
    const pb = ensurePickleballTeamData(category.sportData, fixtures);
    const set = pb.sets[setIndex];
    if (!set || !set.started) return;

    clearPickleballFromSetIndex(pb, setIndex + 1);

    if (set.history.length > 0) {
      const snapshot = set.history.pop();
      set.started = snapshot.started;
      set.completed = snapshot.completed;
      set.currentServer = snapshot.currentServer;
      set.homePoints = snapshot.homePoints;
      set.awayPoints = snapshot.awayPoints;
      set.winnerSide = snapshot.winnerSide;
      pb.currentSetIndex = set.started && !set.completed ? setIndex : null;
    } else {
      clearPickleballSet(set);
      pb.currentSetIndex = null;
    }

    category.winnerSide = null;
    category.categoryLocked = false;
    category.isScoringOpen = true;
    category.sportData = pb;
  }

  function resetPickleballSet(category, setIndex) {
    const pb = ensurePickleballTeamData(category.sportData, fixtures);
    clearPickleballFromSetIndex(pb, setIndex);
    category.winnerSide = null;
    category.categoryLocked = false;
    category.isScoringOpen = true;
    category.sportData = pb;
  }

  function bindPickleballHandlers(card, category, categoryIndex, teamTieState, rerender) {
    card.querySelectorAll('[data-pickle-action="pick-toss"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const pb = ensurePickleballTeamData(category.sportData, fixtures);
        if (hasAnyPickleballSetStarted(pb)) return;
        pb.tossWinner = btn.dataset.side;
        category.sportData = pb;
        rerender();
      });
    });

    card.querySelectorAll('[data-pickle-action="pick-server"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const pb = ensurePickleballTeamData(category.sportData, fixtures);
        if (hasAnyPickleballSetStarted(pb)) return;
        pb.startingServer = btn.dataset.side;
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

    const extracted = raw.map((item, index) => ({
      id: safeText(item?.id || item?.categoryId || item?.key, `cat-${index + 1}`),
      name: safeText(
        item?.name || item?.categoryName || item?.label || item?.title,
        `Category ${index + 1}`
      ),
    }));

    if (extracted.length) return extracted;

    const fallbackCount = Math.max(1, Number(params.get("categoryCount") || 3));
    return Array.from({ length: fallbackCount }, (_, index) => ({
      id: `cat-${index + 1}`,
      name: `Category ${index + 1}`,
    }));
  }

  function inferTeamRoster(matchObj, side) {
    const rosterFromMatch = side === "A" ? matchObj?.homePlayers : matchObj?.awayPlayers;
    const fromMatchList = toArray(rosterFromMatch).map((p) => safeText(p)).filter(Boolean);
    if (fromMatchList.length) return fromMatchList;

    const label = side === "A" ? matchObj?.home : matchObj?.away;
    const split = splitTeamLabel(label);
    if (split.length) return split;

    return Array.from({ length: 8 }, (_, index) => `${side === "A" ? "Home" : "Away"} Player ${index + 1}`);
  }

  function buildInitialTeamState(matchObj, rawFixtures) {
    const categories = inferCategoryDefinitions(rawFixtures);
    const homeRoster = inferTeamRoster(matchObj, "A");
    const awayRoster = inferTeamRoster(matchObj, "B");
    const tournamentSportKey = normalizeSportKey(getTournamentSportName(rawFixtures));

    return {
      homeRoster,
      awayRoster,
      tournamentSportKey,
      categories: categories.map((category, index) => ({
        id: category.id,
        name: category.name,
        homePlayer: homeRoster[index] || "",
        awayPlayer: awayRoster[index] || "",
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

  function loadTeamTieState(matchObj, rawFixtures) {
    const key = getTeamStorageKey();
    const fresh = buildInitialTeamState(matchObj, rawFixtures);

    try {
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      if (saved && Array.isArray(saved.categories)) {
        saved.homeRoster = Array.isArray(saved.homeRoster) ? saved.homeRoster : fresh.homeRoster;
        saved.awayRoster = Array.isArray(saved.awayRoster) ? saved.awayRoster : fresh.awayRoster;
        saved.tournamentSportKey = saved.tournamentSportKey || fresh.tournamentSportKey;
        saved.lineupCollapsed = Boolean(saved.lineupCollapsed);

        saved.categories = saved.categories.map((category, index) => {
          const merged = {
            ...fresh.categories[index],
            ...category,
            sportKey: category?.sportKey || fresh.categories[index]?.sportKey || saved.tournamentSportKey,
          };

          if (merged.sportKey === "pickleball") {
            merged.sportData = ensurePickleballTeamData(category?.sportData, rawFixtures);
          } else {
            merged.sportData =
              category?.sportData ??
              fresh.categories[index]?.sportData ??
              (hasPresetSportSchema(merged.sportKey)
                ? cloneDefaultPresetSportData(merged.sportKey, rawFixtures)
                : null);
          }

          merged.categoryLocked = Boolean(merged.categoryLocked || merged.sportData?.categoryLocked);
          return merged;
        });

        return saved;
      }
    } catch {}

    return fresh;
  }

  function saveTeamTieState(teamState) {
    localStorage.setItem(getTeamStorageKey(), JSON.stringify(teamState));
  }

  function computeTeamTieSummary(teamState) {
    const homeWins = teamState.categories.filter((c) => c.winnerSide === "A").length;
    const awayWins = teamState.categories.filter((c) => c.winnerSide === "B").length;
    const acceptedCount = teamState.categories.filter((c) => c.lineupStatus === "accepted").length;
    const rejectedCount = teamState.categories.filter((c) => c.lineupStatus === "rejected").length;
    const allAccepted = teamState.categories.length > 0 && acceptedCount === teamState.categories.length;

    return {
      homeWins,
      awayWins,
      acceptedCount,
      rejectedCount,
      total: teamState.categories.length,
      allAccepted,
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
    saveBtn?.classList.remove("hidden");
  }

  let fixtures = null;
  let schema = null;

  try {
    const fixturesResp = await apiGet(`/api/host/tournaments/${encodeURIComponent(tournamentId)}/fixtures`);
    fixtures = fixturesResp?.ok ? fixturesResp.data : fixturesResp;
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

  if (!match) {
    titleEl.textContent = "Match not found";
    subEl.textContent = "Invalid round / match or category data missing.";
    saveBtn.disabled = true;
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
    saveBtn.disabled = true;
    return;
  }

  if (isTeamEvent) {
    showTeamEventShell();

    titleEl.textContent = `${homeLabel} vs ${awayLabel}`;
    subEl.textContent = `Team event • Round ${roundIndex + 1} • Match ${matchIndex + 1}`;

    if (teamOverallHomeName) teamOverallHomeName.textContent = homeLabel;
    if (teamOverallAwayName) teamOverallAwayName.textContent = awayLabel;
    if (teamOverallSub) {
      teamOverallSub.textContent = "Overall score updates category wins between the two teams.";
    }

    const teamTieState = loadTeamTieState(match, fixtures);

    function syncLineupCollapseUi() {
      if (!lineupReviewPanel || !toggleLineupReviewBtn) return;
      lineupReviewPanel.classList.toggle("collapsed", Boolean(teamTieState.lineupCollapsed));
      toggleLineupReviewBtn.textContent = teamTieState.lineupCollapsed ? "Expand lineup" : "Collapse lineup";
    }

    function syncTeamSummaryUi() {
      const summary = computeTeamTieSummary(teamTieState);
      if (teamOverallHomeScore) teamOverallHomeScore.textContent = String(summary.homeWins);
      if (teamOverallAwayScore) teamOverallAwayScore.textContent = String(summary.awayWins);

      if (!lineupStatePill) return;

      lineupStatePill.className = getStatusChipClass(summary.allAccepted ? "accepted" : "pending");
      if (summary.allAccepted) {
        lineupStatePill.textContent = `All ${summary.total} category lineups accepted`;
      } else {
        lineupStatePill.textContent = `${summary.acceptedCount}/${summary.total} category lineups accepted`;
      }

      const firstUnlockedIndex = teamTieState.categories.findIndex(
        (item) => item.lineupStatus === "accepted" && !item.categoryLocked
      );

      if (teamCategoryHelp) {
        if (!summary.allAccepted) {
          teamCategoryHelp.textContent = "Category bars unlock only after every category lineup is accepted.";
        } else if (firstUnlockedIndex === -1) {
          teamCategoryHelp.textContent = "All category matches are completed and locked.";
        } else {
          teamCategoryHelp.textContent = `Complete ${teamTieState.categories[firstUnlockedIndex].name} to unlock the next category.`;
        }
      }

      syncLineupCollapseUi();
    }

    function renderLineupReview() {
      if (!lineupReviewList) return;
      clear(lineupReviewList);

      teamTieState.categories.forEach((category) => {
        const row = document.createElement("div");
        row.className = "lineup-row";
        const statusClass = getStatusChipClass(category.lineupStatus);

        row.innerHTML = `
          <div class="lineup-row-head">
            <div>
              <div class="lineup-row-title">${escapeHtml(category.name)}</div>
              <div class="helper-text">Review submitted lineup for this category</div>
            </div>
            <div class="${statusClass}">${escapeHtml(category.lineupStatus)}</div>
          </div>
          <div class="lineup-row-body">
            <div class="lineup-entry-grid">
              <div class="field-stack">
                <label>${escapeHtml(homeLabel)} player</label>
                <input type="text" data-role="homePlayer" value="${escapeHtml(category.homePlayer)}" placeholder="Enter player name" />
              </div>
              <div class="lineup-vs">VS</div>
              <div class="field-stack">
                <label>${escapeHtml(awayLabel)} player</label>
                <input type="text" data-role="awayPlayer" value="${escapeHtml(category.awayPlayer)}" placeholder="Enter player name" />
              </div>
            </div>

            <div class="score-notes" style="margin-top: 12px;">
              <label>Host notes</label>
              <textarea data-role="notes" placeholder="Optional notes for accept / reject / edit">${escapeHtml(category.notes)}</textarea>
            </div>

            <div class="lineup-actions" style="margin-top: 12px;">
              <button type="button" class="lineup-action-btn primary" data-action="accept">Accept</button>
              <button type="button" class="lineup-action-btn" data-action="reject">Reject</button>
              <button type="button" class="lineup-action-btn" data-action="edit">Edit</button>
            </div>
          </div>
        `;

        const homeInput = row.querySelector('[data-role="homePlayer"]');
        const awayInput = row.querySelector('[data-role="awayPlayer"]');
        const notesInput = row.querySelector('[data-role="notes"]');

        function syncCategoryDraftFromInputs() {
          category.homePlayer = safeText(homeInput?.value);
          category.awayPlayer = safeText(awayInput?.value);
          category.notes = safeText(notesInput?.value);
          saveTeamTieState(teamTieState);
          renderTeamCategoryBars();
          syncTeamSummaryUi();
        }

        homeInput?.addEventListener("input", syncCategoryDraftFromInputs);
        awayInput?.addEventListener("input", syncCategoryDraftFromInputs);
        notesInput?.addEventListener("input", syncCategoryDraftFromInputs);

        row.querySelector('[data-action="accept"]')?.addEventListener("click", () => {
          syncCategoryDraftFromInputs();
          if (!category.homePlayer || !category.awayPlayer) {
            alert("Please fill both players before accepting the lineup.");
            return;
          }
          category.lineupStatus = "accepted";
          saveTeamTieState(teamTieState);
          renderLineupReview();
          renderTeamCategoryBars();
          syncTeamSummaryUi();
        });

        row.querySelector('[data-action="reject"]')?.addEventListener("click", () => {
          syncCategoryDraftFromInputs();
          category.lineupStatus = "rejected";
          category.isScoringOpen = false;
          category.winnerSide = null;
          category.categoryLocked = false;
          saveTeamTieState(teamTieState);
          renderLineupReview();
          renderTeamCategoryBars();
          syncTeamSummaryUi();
        });

        row.querySelector('[data-action="edit"]')?.addEventListener("click", () => {
          category.lineupStatus = "pending";
          category.isScoringOpen = false;
          saveTeamTieState(teamTieState);
          renderLineupReview();
          renderTeamCategoryBars();
          syncTeamSummaryUi();
        });

        lineupReviewList.appendChild(row);
      });
    }

    function renderTeamCategoryBars() {
      if (!teamCategoryBars) return;
      clear(teamCategoryBars);

      const summary = computeTeamTieSummary(teamTieState);
      if (!summary.allAccepted) {
        const waitingCard = document.createElement("div");
        waitingCard.className = "category-card";
        waitingCard.innerHTML = `
          <div class="category-card-head">
            <div>
              <div class="category-title">Waiting for lineup approvals</div>
              <div class="helper-text">Accept all category lineups first. Then category-wise scoring will unlock.</div>
            </div>
          </div>
        `;
        teamCategoryBars.appendChild(waitingCard);
        return;
      }

      const firstUnlockedIndex = teamTieState.categories.findIndex(
        (item) => item.lineupStatus === "accepted" && !item.categoryLocked
      );

      teamTieState.categories.forEach((category, index) => {
        const card = document.createElement("div");
        card.className = `category-card${category.isScoringOpen ? " open" : ""}`;

        const resultInfo = getCategoryResultInfo(category, homeLabel, awayLabel);
        const isUnlocked = category.categoryLocked || firstUnlockedIndex === -1 || index === firstUnlockedIndex;
        const canToggle = category.categoryLocked || isUnlocked;

        const buttonLabel = category.isScoringOpen
          ? "Hide scoring"
          : category.categoryLocked
            ? "View result"
            : isUnlocked
              ? "Start scoring"
              : "Complete previous category first";

        const categoryBody =
          category.sportKey === "pickleball"
            ? buildPickleballScoringMarkup(category, homeLabel, awayLabel)
            : buildPresetScoringMarkup(category, homeLabel, awayLabel);

        const manualWinnerMarkup =
          category.sportKey === "pickleball"
            ? ""
            : `
                <div class="category-winner-actions" style="margin-top: 14px;">
                  <button type="button" class="category-winner-btn primary" data-action="home-winner">Mark ${escapeHtml(homeLabel)} winner</button>
                  <button type="button" class="category-winner-btn primary" data-action="away-winner">Mark ${escapeHtml(awayLabel)} winner</button>
                  <button type="button" class="category-winner-btn" data-action="clear-winner">Clear result</button>
                </div>
              `;

        card.innerHTML = `
          <div class="category-card-head">
            <div class="category-meta">
              <div class="category-title">${escapeHtml(category.name)}</div>
              <div class="category-matchup">${escapeHtml(category.homePlayer || "TBD")} vs ${escapeHtml(category.awayPlayer || "TBD")}</div>
            </div>
            <div class="category-actions">
              <div class="status-chip ${resultInfo.chipClass}">${escapeHtml(resultInfo.text)}</div>
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
              <textarea data-action="score-notes" placeholder="Optional notes for this category">${escapeHtml(category.notes)}</textarea>
            </div>
          </div>
        `;

        const rerender = () => {
          saveTeamTieState(teamTieState);
          renderTeamCategoryBars();
          syncTeamSummaryUi();
        };

        card.querySelector('[data-action="toggle-scoring"]')?.addEventListener("click", () => {
          if (!canToggle) return;
          category.isScoringOpen = !category.isScoringOpen;
          rerender();
        });

        if (category.sportKey === "pickleball") {
          bindPickleballHandlers(card, category, index, teamTieState, rerender);
        } else {
          bindPresetHandlers(card, category, rerender, teamTieState);

          card.querySelector('[data-action="home-winner"]')?.addEventListener("click", () => {
            category.winnerSide = "A";
            category.categoryLocked = true;
            category.isScoringOpen = false;
            unlockNextCategory(teamTieState, index);
            rerender();
          });

          card.querySelector('[data-action="away-winner"]')?.addEventListener("click", () => {
            category.winnerSide = "B";
            category.categoryLocked = true;
            category.isScoringOpen = false;
            unlockNextCategory(teamTieState, index);
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
        });

        teamCategoryBars.appendChild(card);
      });
    }

    receiveLineupBtn?.addEventListener("click", () => {
      lineupReviewPanel?.classList.remove("hidden");
      renderLineupReview();
      renderTeamCategoryBars();
      syncTeamSummaryUi();
    });

    manualLineupBtn?.addEventListener("click", () => {
      lineupReviewPanel?.classList.remove("hidden");
      teamTieState.categories.forEach((category, index) => {
        if (!category.homePlayer) category.homePlayer = teamTieState.homeRoster[index] || "";
        if (!category.awayPlayer) category.awayPlayer = teamTieState.awayRoster[index] || "";
        if (category.lineupStatus === "rejected") category.lineupStatus = "pending";
      });
      saveTeamTieState(teamTieState);
      renderLineupReview();
      renderTeamCategoryBars();
      syncTeamSummaryUi();
    });

    toggleLineupReviewBtn?.addEventListener("click", () => {
      teamTieState.lineupCollapsed = !teamTieState.lineupCollapsed;
      saveTeamTieState(teamTieState);
      syncLineupCollapseUi();
    });

    renderTeamCategoryBars();
    syncTeamSummaryUi();
    return;
  }

  showIndividualEventShell();

  if (!schema) {
    titleEl.textContent = "No scoring schema found";
    subEl.textContent = "Finalize scoring schema for this category first.";
    saveBtn.disabled = true;
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
  }

  renderPills();

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
  });

  timerPauseBtn?.addEventListener("click", () => {
    if (!state.timer.running) return;
    state.timer.elapsedMs += Date.now() - state.timer.startedAtEpochMs;
    state.timer.running = false;
    state.timer.startedAtEpochMs = null;
    refreshTimerUi();
  });

  timerResetBtn?.addEventListener("click", () => {
    state.timer.elapsedMs = 0;
    state.timer.running = false;
    state.timer.startedAtEpochMs = null;
    refreshTimerUi();
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

  async function saveScore() {
    if (state.timer.running && state.timer.startedAtEpochMs) {
      state.timer.elapsedMs += Date.now() - state.timer.startedAtEpochMs;
      state.timer.running = false;
      state.timer.startedAtEpochMs = null;
    }

    const computed = compute();

    const payload = {
      tournamentId,
      categoryId: resolvedCategoryId,
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
      saveMsg.textContent = "Save failed";
      alert(lastError?.message || "Could not save score.");
      return;
    }

    saveMsg.textContent = "Saved and standings updated";
    renderPills();

    homeScoreEl.classList.add("bump");
    awayScoreEl.classList.add("bump");
    setTimeout(() => {
      homeScoreEl.classList.remove("bump");
      awayScoreEl.classList.remove("bump");
    }, 250);
  }

  saveBtn?.addEventListener("click", saveScore);
});