import { requireAuth, logout } from "./auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;

  document.querySelectorAll(".brand").forEach((el) => {
    el.addEventListener("click", () => {
      window.location.href = "index.html";
    });
  });

  const trigger = document.getElementById("host-user-menu-trigger");
  const dropdown = document.getElementById("host-user-menu-dropdown");

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

  const params = new URLSearchParams(window.location.search);
  const tournamentId = params.get("tournamentId");
  if (!tournamentId) {
    alert("Missing tournamentId in URL");
    return;
  }

  document.getElementById("players-back-btn")?.addEventListener("click", () => {
    const from = params.get("from");

    if (from === "join" || isLoggedInUserUmpire()) {
      window.location.href = `join.html?tournamentId=${encodeURIComponent(tournamentId)}`;
      return;
    }

    window.location.href = "host.html";
  });

  const TEAM_EVENT_CATEGORY_ID = "__team_event__";
  const expandedTeamIds = new Set();

  const tableWrapper = document.getElementById("players-table-wrapper");
  const tableBody = document.getElementById("players-table-body");
  const emptyState = document.getElementById("players-empty-state");

  const titleEl = document.getElementById("players-tournament-name");
  const sportEl = document.getElementById("players-tournament-sport");
  const datesEl = document.getElementById("players-tournament-dates");
  const codeEl = document.getElementById("players-tournament-code");

  const playersToolbar = document.querySelector(".players-toolbar");
const playersListSection = document.getElementById("players-list-section");

  const playersTabs = document.getElementById("players-tabs");
  const playersListToggleBtn = document.getElementById("players-list-toggle-btn");
  const playersListContent = document.getElementById("players-list-content");

  const addPlayerBtn = document.getElementById("add-player-btn");
  const addPlayerModal = document.getElementById("host-add-player-modal");
  const addPlayerClose = document.getElementById("host-add-player-close");
  const addPlayerForm = document.getElementById("host-add-player-form");
  const addPlayerCategory = document.getElementById("host-player-category");

  const makeCaptainsBtn = document.getElementById("make-captains-btn");
  const createPoolsBtn = document.getElementById("create-pools-btn");

  const makeCaptainsModal = document.getElementById("make-captains-modal");
  const makeCaptainsClose = document.getElementById("make-captains-close");
  const makeCaptainsCancelBtn = document.getElementById("make-captains-cancel-btn");
  const makeCaptainsSaveBtn = document.getElementById("make-captains-save-btn");
  const makeCaptainsList = document.getElementById("make-captains-list");
  const makeCaptainsEmpty = document.getElementById("make-captains-empty");

  const confirmCaptainsModal = document.getElementById("confirm-captains-modal");
  const confirmCaptainsClose = document.getElementById("confirm-captains-close");
  const confirmCaptainsCancelBtn = document.getElementById("confirm-captains-cancel-btn");
  const confirmCaptainsForm = document.getElementById("confirm-captains-form");
  const confirmCaptainsList = document.getElementById("confirm-captains-list");
  const confirmCaptainsEmpty = document.getElementById("confirm-captains-empty");

  const captainsSummarySection = document.getElementById("captains-summary-section");
  const captainsSummaryEmpty = document.getElementById("captains-summary-empty");
  const captainsSummaryList = document.getElementById("captains-summary-list");
  const teamSetupToggleBtn = document.getElementById("team-setup-toggle-btn");
  const teamSetupContent = document.getElementById("team-setup-content");

  const poolsSection = document.getElementById("pools-section");
  const poolsGrid = document.getElementById("pools-grid");
  const unassignedTeams = document.getElementById("unassigned-teams");
  const resetPoolsBtn = document.getElementById("reset-pools-btn");
  const randomizePoolsBtn = document.getElementById("randomize-pools-btn");

  const leaderboardSection = document.getElementById("leaderboard-section");
  const leaderboardToggleBtn = document.getElementById("leaderboard-toggle-btn");
  const leaderboardContent = document.getElementById("leaderboard-content");
  const leaderboardTableBody = document.getElementById("leaderboard-table-body");

  const fixturesEmbed = document.getElementById("fixtures-embed");
  const fixturesGenerateBtn = document.getElementById("fixtures-generate-btn");
  const fixturesGoKnockoutBtn = document.getElementById("fixtures-go-knockout-btn");
  const fixturesConfigureBtn = document.getElementById("fixtures-configure-fields-btn");
  const fixturesEditBtn = document.getElementById("fixtures-edit-btn");
  const fixturesCollapseToggleBtn = document.getElementById("fixtures-toggle-btn");
  const fixturesContent = document.getElementById("fixtures-content");
  const fixturesToggle = document.getElementById("fixtures-toggle");
  const fixturesGroups = document.getElementById("fixtures-groups");
  const fixturesNoneSelected = document.getElementById("fixtures-none-selected");
  const fixturesToast = document.getElementById("fixtures-toast");
  const addPlayersExcelBtn = document.getElementById("add-players-excel-btn");
  const makeUmpireBtn = document.getElementById("make-umpire-btn");
  const addUmpireModal = document.getElementById("host-add-umpire-modal");
  const addUmpireClose = document.getElementById("host-add-umpire-close");
  const addUmpireForm = document.getElementById("host-add-umpire-form");
  const fixturesTournamentNameEl = document.getElementById("fixtures-tournament-name");
  const fixturesTournamentSportEl = document.getElementById("fixtures-tournament-sport");
  const fixturesTournamentDatesEl = document.getElementById("fixtures-tournament-dates");
  const fixturesTournamentCodeEl = document.getElementById("fixtures-tournament-code");
  const embeddedFixturesHelperTextEl = document.getElementById("embedded-fixtures-helper-text");
  const bulkPlayerModal = document.getElementById("host-bulk-player-modal");
const bulkPlayerClose = document.getElementById("host-bulk-player-close");
const bulkPlayerCloseFooter = document.getElementById("host-bulk-player-close-footer");
const bulkPlayerFile = document.getElementById("host-bulk-player-file");
const bulkPlayerPreviewWrap = document.getElementById("bulk-player-preview-wrap");
const bulkPlayerPreviewBody = document.getElementById("bulk-player-preview-body");
const bulkPlayerSelectAll = document.getElementById("bulk-player-select-all");
const bulkPlayerSaveBtn = document.getElementById("bulk-player-save-btn");
const bulkPlayerClearBtn = document.getElementById("bulk-player-clear-btn");
const bulkPlayerSummary = document.getElementById("bulk-player-summary");

  let allPlayers = [];
  let activeFilter = "all";
  let tournamentCategories = [];
  let tournamentMetaCache = null;
  let isPlayersListCollapsed = true;
  let isTeamSetupCollapsed = true;
  let isLeaderboardCollapsed = true;
  let isFixturesCollapsed = true;

  let captainState = {
    selectedCaptainIds: [],
    confirmedCaptains: [],
    pools: null,
  };
  let canonicalTeams = [];
  let leaderboardState = {
    rows: [],
  };

  const fixturesUi = {
    wrap: fixturesEmbed,
    generateBtn: fixturesGenerateBtn,
    configureBtn: fixturesConfigureBtn,
    editBtn: fixturesEditBtn,
    toggleWrap: fixturesToggle,
    groupsEl: fixturesGroups,
    noneSelectedEl: fixturesNoneSelected,
    toastEl: fixturesToast,
    didInit: false,
  };

  const fixturesState = {
    fixtures: null,
    categories: [],
    acceptedByCategory: {},
    activeCategoryId: null,
    bulkEditMode: false,
  };
  let bulkPlayerRows = [];
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
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

    function normalizeIdentity(value) {
      return String(value || "").trim().toLowerCase();
    }

    function normalizePhone(value) {
      return String(value || "").replace(/\D/g, "");
    }

    function getTournamentUmpires(tournament = tournamentMetaCache) {
      return Array.isArray(tournament?.umpires) ? tournament.umpires : [];
    }

    function isLoggedInUserUmpire(tournament = tournamentMetaCache) {
      const umpires = getTournamentUmpires(tournament);
      if (!umpires.length) return false;

      const myName = normalizeIdentity(user?.name);
      const myUsername = normalizeIdentity(user?.username);
      const myPhone = normalizePhone(user?.phone || user?.mobile || user?.phoneNumber);

      return umpires.some((umpire) => {
        const umpireName = normalizeIdentity(umpire?.name);
        const umpireUsername = normalizeIdentity(umpire?.username);
        const umpirePhone = normalizePhone(umpire?.phone);

        return (
          (myPhone && umpirePhone && myPhone === umpirePhone) ||
          (myUsername && umpireUsername && myUsername === umpireUsername) ||
          (myName && umpireName && myName === umpireName)
        );
      });
    }

    function applyUmpireViewMode() {
  if (!isLoggedInUserUmpire()) return;

  // Keep join mode visually active for umpire
  playerBtn?.classList.add("is-active");
  hostBtn?.classList.remove("is-active");

  // Hide host toolbar actions except Back
  if (playersToolbar) {
    playersToolbar.querySelectorAll("button").forEach((btn) => {
      if (btn.id !== "players-back-btn") {
        btn.classList.add("hidden");
        btn.style.display = "none";
      }
    });
  }

  // Hide non-fixture sections
  playersListSection?.classList.add("hidden");
  captainsSummarySection?.classList.add("hidden");
  poolsSection?.classList.add("hidden");
  leaderboardSection?.classList.add("hidden");

  // Show fixtures only
  fixturesEmbed?.classList.remove("hidden");
  isFixturesCollapsed = false;
  syncFixturesUi();

  // Optional: hide host-only fixture actions too
  fixturesGenerateBtn?.classList.add("hidden");
  fixturesGenerateBtn && (fixturesGenerateBtn.style.display = "none");

  fixturesGoKnockoutBtn?.classList.add("hidden");
  fixturesGoKnockoutBtn && (fixturesGoKnockoutBtn.style.display = "none");

  fixturesConfigureBtn?.classList.add("hidden");
  fixturesConfigureBtn && (fixturesConfigureBtn.style.display = "none");

  fixturesEditBtn?.classList.add("hidden");
  fixturesEditBtn && (fixturesEditBtn.style.display = "none");
}

    function openAddUmpireModal() {
      addUmpireModal?.classList.remove("hidden");
      addUmpireModal?.setAttribute("aria-hidden", "false");
      document.getElementById("host-umpire-name")?.focus();
    }

    function closeAddUmpireModal() {
      addUmpireModal?.classList.add("hidden");
      addUmpireModal?.setAttribute("aria-hidden", "true");
      addUmpireForm?.reset();
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

  function getPlayerCategoryId(p) {
    return p.categoryId ?? p.categoryID ?? p.category ?? p.category_id ?? null;
  }

  function getPlayerId(p) {
    return p.playerId ?? p.registrationId ?? p.id ?? p._id ?? p.pk ?? null;
  }

  function getPlayerDisplayName(p) {
    return p.playerName ?? p.name ?? p.fullName ?? p.username ?? "Player";
  }

  function normalizeStatusPlayersPage(p) {
    const raw = p.status ?? p.registrationStatus ?? p.inviteStatus ?? p.state ?? "accepted";
    const s = String(raw).toLowerCase();
    if (["accepted", "approve", "approved"].includes(s)) return "accepted";
    if (["rejected", "reject", "declined", "denied"].includes(s)) return "rejected";
    return "pending";
  }

  function statusLabel(status) {
    if (status === "accepted") return "Accepted";
    if (status === "rejected") return "Rejected";
    return "Pending";
  }

  function statusClass(status) {
    if (status === "accepted") return "status-pill--accepted";
    if (status === "rejected") return "status-pill--rejected";
    return "status-pill--pending";
  }

  function showToast(message) {
    if (!fixturesUi.toastEl) return;
    fixturesUi.toastEl.textContent = message;
    fixturesUi.toastEl.style.display = "inline-flex";
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      if (fixturesUi.toastEl) fixturesUi.toastEl.style.display = "none";
    }, 2200);
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function normalizeTournamentList(raw) {
    if (Array.isArray(raw)) return raw;
    if (!raw || typeof raw !== "object") return [];
    if (Array.isArray(raw.data)) return raw.data;
    if (Array.isArray(raw.tournaments)) return raw.tournaments;
    if (Array.isArray(raw.items)) return raw.items;
    return [];
  }

  async function apiJson(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
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

  async function apiGet(url) {
    return apiJson(url, { method: "GET" });
  }

  async function apiPost(url, body) {
    return apiJson(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
  }

  async function apiPut(url, body) {
    return apiJson(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
  }

  async function apiPatch(url, body) {
    return apiJson(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
  }

  function computeCounts(players) {
    const counts = { all: players.length, byCategory: {} };
    players.forEach((p) => {
      const cid = getPlayerCategoryId(p) || "uncategorized";
      counts.byCategory[cid] = (counts.byCategory[cid] || 0) + 1;
    });
    return counts;
  }

  function applyFilter(players) {
    if (isTournamentTeamEvent() || activeFilter === "all") return players;
    return players.filter((p) => String(getPlayerCategoryId(p) || "") === String(activeFilter));
  }

  function getAcceptedPlayers() {
    return allPlayers.filter((p) => normalizeStatusPlayersPage(p) === "accepted");
  }

  function getCategoryNameById(categoryId) {
    const cat = tournamentCategories.find(
      (c) => String(c.categoryId || c.id) === String(categoryId)
    );
    return cat ? categoryLabel(cat) : "Category";
  }

  function getAdvancedSettings() {
    return safeJson(tournamentMetaCache?.advancedSettings, tournamentMetaCache?.advancedSettings) || {};
  }

  function getAdvancedMode() {
    return getAdvancedSettings()?.advancedMode || "";
  }

  function isTournamentTeamEvent() {
    return String(tournamentMetaCache?.tournamentType || "").toLowerCase() === "team";
  }

  function isGroupKnockoutFormat() {
    return String(tournamentMetaCache?.stageFormat || "") === "group_knockout";
  }

  function isLeagueKnockoutFormat() {
    return String(tournamentMetaCache?.stageFormat || "") === "round_robin_knockout";
  }

  function isPickleballTeamLeagueMode() {
    return getAdvancedMode() === "pickleball_team_league";
  }

  function getRequestedLeagueRounds() {
    const raw = Number(getAdvancedSettings()?.roundRobinMatches || 0);
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  }

  function getTournamentStartDate() {
    const raw = String(tournamentMetaCache?.tournamentDates || "").trim();
    const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      const dt = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T09:00:00`);
      if (!Number.isNaN(dt.getTime())) return dt;
    }

    const dmy = raw.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (dmy) {
      const day = dmy[1].padStart(2, "0");
      const month = dmy[2].padStart(2, "0");
      const year = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
      const dt = new Date(`${year}-${month}-${day}T09:00:00`);
      if (!Number.isNaN(dt.getTime())) return dt;
    }

    const dt = new Date();
    dt.setHours(9, 0, 0, 0);
    return dt;
  }

  function getAvailableCourtNames() {
    const meta = tournamentMetaCache || {};
    const advanced = getAdvancedSettings();
    const desiredCount = Math.max(
      1,
      Number(meta.courtCount || advanced.courtCount || 0) || 0
    );

    const normalizeCourtList = (value) => {
      if (Array.isArray(value) && value.length) {
        const arr = value.map((x, i) => String(x || `Court ${i + 1}`).trim()).filter(Boolean);
        while (desiredCount && arr.length < desiredCount) arr.push(`Court ${arr.length + 1}`);
        return [...new Set(arr)];
      }
      if (typeof value === "string" && value.trim()) {
        const arr = value.split(",").map((x) => x.trim()).filter(Boolean);
        while (desiredCount && arr.length < desiredCount) arr.push(`Court ${arr.length + 1}`);
        return [...new Set(arr)];
      }
      return [];
    };

    const options = [meta.courtNames, advanced.courtNames, advanced.courts, meta.courts];
    for (const value of options) {
      const arr = normalizeCourtList(value);
      if (arr.length) return arr;
    }

    const fallbackCount = desiredCount || 3;
    return Array.from({ length: fallbackCount }, (_, i) => `Court ${i + 1}`);
  }

  function formatDateInputValue(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function formatTimeInputValue(date) {
    const h = String(date.getHours()).padStart(2, "0");
    const m = String(date.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  }

  function syncPlayersListUi() {
    if (playersListContent) playersListContent.classList.toggle("hidden", isPlayersListCollapsed);
    if (playersListToggleBtn) {
      playersListToggleBtn.textContent = isPlayersListCollapsed ? "▸" : "▾";
      playersListToggleBtn.setAttribute("aria-expanded", String(!isPlayersListCollapsed));
    }
  }

  function syncTeamSetupUi() {
    if (teamSetupContent) teamSetupContent.classList.toggle("hidden", isTeamSetupCollapsed);
    if (teamSetupToggleBtn) {
      teamSetupToggleBtn.textContent = isTeamSetupCollapsed ? "▸" : "▾";
      teamSetupToggleBtn.setAttribute("aria-expanded", String(!isTeamSetupCollapsed));
    }
  }

  function syncLeaderboardUi() {
    if (leaderboardContent) leaderboardContent.classList.toggle("hidden", isLeaderboardCollapsed);
    if (leaderboardToggleBtn) {
      leaderboardToggleBtn.textContent = isLeaderboardCollapsed ? "▸" : "▾";
      leaderboardToggleBtn.setAttribute("aria-expanded", String(!isLeaderboardCollapsed));
    }
  }

  function syncFixturesUi() {
    if (fixturesContent) fixturesContent.classList.toggle("hidden", isFixturesCollapsed);
    if (fixturesCollapseToggleBtn) {
      fixturesCollapseToggleBtn.textContent = isFixturesCollapsed ? "▸" : "▾";
      fixturesCollapseToggleBtn.setAttribute("aria-expanded", String(!isFixturesCollapsed));
    }
  }

  function syncAddPlayerCategoryUi() {
    if (!addPlayerCategory) return;
    const wrap = addPlayerCategory.closest(".field-group");
    if (isTournamentTeamEvent()) {
      addPlayerCategory.required = false;
      addPlayerCategory.value = "";
      wrap?.classList.add("hidden");
    } else {
      addPlayerCategory.required = true;
      wrap?.classList.remove("hidden");
    }
  }

  playersListToggleBtn?.addEventListener("click", () => {
    isPlayersListCollapsed = !isPlayersListCollapsed;
    syncPlayersListUi();
  });

  teamSetupToggleBtn?.addEventListener("click", () => {
    isTeamSetupCollapsed = !isTeamSetupCollapsed;
    syncTeamSetupUi();
  });

  leaderboardToggleBtn?.addEventListener("click", () => {
    isLeaderboardCollapsed = !isLeaderboardCollapsed;
    syncLeaderboardUi();
  });

  fixturesCollapseToggleBtn?.addEventListener("click", () => {
    isFixturesCollapsed = !isFixturesCollapsed;
    syncFixturesUi();
  });

  function getCaptainSubmittedPlayers(captain) {
    const raw = captain?.teamPlayers || captain?.players || captain?.members || captain?.submittedPlayers || captain?.roster || [];
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => typeof item === "string" ? item : (item?.playerName || item?.name || item?.fullName || item?.username || ""))
      .map((name) => String(name || "").trim())
      .filter(Boolean);
  }

  function getConfirmedTeams() {
    return captainState.confirmedCaptains.map((captain) => ({
      teamKey: `captain:${captain.playerId}`,
      captainId: captain.playerId,
      captainName: captain.playerName,
      teamName: captain.teamName || captain.playerName,
      categoryId: captain.categoryId,
      teamStatus: captain.teamStatus || "pending",
      teamPlayers: getCaptainSubmittedPlayers(captain),
    }));
  }

  function getEditableTeamNameOptions(currentValue = "") {
    const names = [...new Set(
      getConfirmedTeams()
        .map((team) => String(team?.teamName || "").trim())
        .filter(Boolean)
    )];

    const current = String(currentValue || "").trim();
    if (current && !names.includes(current)) names.unshift(current);

    return names;
  }

  function buildTeamNameSelectOptions(selectedValue = "") {
    const selected = String(selectedValue || "").trim();
    return getEditableTeamNameOptions(selected)
      .map((name) => `
        <option value="${escapeHtml(name)}"${name === selected ? " selected" : ""}>
          ${escapeHtml(name)}
        </option>
      `)
      .join("");
  }

  function getTeamEventFixtureBucket() {
    const categories = fixturesState.fixtures?.categories || {};
    return categories[TEAM_EVENT_CATEGORY_ID] || Object.values(categories)[0] || null;
  }

  function firstFiniteNumber(...values) {
    for (const value of values) {
      const num = Number(value);
      if (Number.isFinite(num)) return num;
    }
    return null;
  }

  function hasLiveCategoryProgress(category) {
    if (!category || typeof category !== "object") return false;
    if (category.lineupStatus === "accepted") return true;
    if (category.categoryLocked) return true;
    if (category.winnerSide) return true;
    if (category.homePlayer || category.awayPlayer) return true;

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

    const preset = category.presetState || category.score || {};
    return Object.values(preset || {}).some((value) => typeof value === "number" && Number(value) > 0);
  }

  function getTeamTieStatusFromState(teamTieState) {
    if (!teamTieState || !Array.isArray(teamTieState.categories) || !teamTieState.categories.length) {
      return "pending";
    }

    const categories = teamTieState.categories;
    const completed = categories.length > 0 && categories.every((category) => category?.categoryLocked || category?.winnerSide);
    if (completed) return "completed";
    if (categories.some((category) => hasLiveCategoryProgress(category))) return "live";
    return "pending";
  }

  function getCategoryMatchPointsFromSnapshot(category) {
    if (!category || typeof category !== "object") return { home: 0, away: 0 };

    const sportData = category.sportData || {};
    if (Array.isArray(sportData.sets) && sportData.sets.length) {
      return sportData.sets.reduce(
        (acc, set) => ({
          home: acc.home + Number(set?.homePoints || 0),
          away: acc.away + Number(set?.awayPoints || 0),
        }),
        { home: 0, away: 0 }
      );
    }

    const preset = category.presetState || category.score || {};
    return {
      home: firstFiniteNumber(
        category?.homeMatchPoints,
        category?.homePoints,
        category?.matchPointsHome,
        category?.pointsHome,
        category?.homeScore,
        sportData?.homePoints,
        sportData?.homeScore,
        preset?.home,
        preset?.A,
        preset?.pointsA,
        preset?.teamA,
        0
      ) || 0,
      away: firstFiniteNumber(
        category?.awayMatchPoints,
        category?.awayPoints,
        category?.matchPointsAway,
        category?.pointsAway,
        category?.awayScore,
        sportData?.awayPoints,
        sportData?.awayScore,
        preset?.away,
        preset?.B,
        preset?.pointsB,
        preset?.teamB,
        0
      ) || 0,
    };
  }

  function buildTeamTieStateFromSubmatches(match) {
    const submatches = Array.isArray(match?.submatches) ? match.submatches : [];
    const categories = submatches
      .map((submatch) => submatch?.score?.state?.meta?.categorySnapshot)
      .filter((snapshot) => snapshot && typeof snapshot === "object");

    return categories.length ? { categories } : null;
  }

  function getBackendTeamTieState(match) {
    const direct = match?.score?.state?.meta?.teamTieState;
    if (direct && typeof direct === "object") return direct;
    return buildTeamTieStateFromSubmatches(match);
  }

  function getTeamTieMatchPointsFromState(teamTieState) {
    const categories = Array.isArray(teamTieState?.categories) ? teamTieState.categories : [];
    return categories.reduce(
      (acc, category) => {
        const totals = getCategoryMatchPointsFromSnapshot(category);
        acc.home += Number(totals?.home || 0);
        acc.away += Number(totals?.away || 0);
        return acc;
      },
      { home: 0, away: 0 }
    );
  }

  function getMatchStatus(match, roundIndex = 0, matchIndex = 0) {
    const raw = String(match?.status || match?.score?.computed?.status || "").trim().toLowerCase();
    if (["completed", "complete", "done", "finished"].includes(raw) || match?.winner) return "completed";
    if (["live", "in_progress", "in-progress", "ongoing", "started"].includes(raw)) return "live";

    const teamTieState = getBackendTeamTieState(match);
    if (teamTieState) return getTeamTieStatusFromState(teamTieState);

    if (match?.score?.state) return "live";
    return "pending";
  }

  function getStatusPillMarkup(status) {
    const key = status === "completed" ? "accepted" : status === "live" ? "live" : "pending";
    const label = status === "completed" ? "Completed" : status === "live" ? "Live" : "Pending";
    return `<span class="status-pill status-pill--${key}">${escapeHtml(label)}</span>`;
  }

  function getSortedLeaderboardRows() {
    return [...(leaderboardState.rows || [])].sort((a, b) => {
      const rankA = Number(a?.rank || 9999);
      const rankB = Number(b?.rank || 9999);
      return rankA - rankB;
    });
  }

  function getQualifiedLeaderboardRows() {
    const sorted = getSortedLeaderboardRows();
    const explicitlyQualified = sorted.filter((row) => {
      const value = row?.qualified;
      if (value === true) return true;
      const text = String(value || "").trim().toLowerCase();
      return text === "yes" || text === "qualified" || text === "true";
    });

    if (explicitlyQualified.length) return explicitlyQualified;

    const fallbackCount = Number(getAdvancedSettings()?.qualifierCount || 0) || Math.min(4, sorted.length);
    return sorted.slice(0, fallbackCount);
  }

    function isRealLeaderboardTeamName(name) {
      const value = String(name || "").trim();
      const upper = value.toUpperCase();
      return Boolean(value && upper !== "BYE" && upper !== "TBD");
    }

    function getFixtureMatchPoints(match, side) {
      const computed = match?.score?.computed || {};
      const state = match?.score?.state || {};

      const directValue = firstFiniteNumber(
        ...(side === "home"
          ? [
              computed.homeMatchPoints,
              computed.homePoints,
              state?.A?.points,
              state?.home?.points,
            ]
          : [
              computed.awayMatchPoints,
              computed.awayPoints,
              state?.B?.points,
              state?.away?.points,
            ])
      );

      if (directValue !== null) return directValue;

      const teamTieState = getBackendTeamTieState(match);
      if (teamTieState) {
        const totals = getTeamTieMatchPointsFromState(teamTieState);
        return side === "home" ? Number(totals.home || 0) : Number(totals.away || 0);
      }

      return 0;
    }

    function buildTeamLeaderboardRowsFromFixtures() {
      const cat = getTeamEventFixtureBucket();
      if (!cat) return [];

      // GROUP + KNOCKOUT => show grouped leaderboard rows
      if (isTeamGroupKnockoutFormat() && Array.isArray(cat.groups) && cat.groups.length) {
        const mergedRows = [];

        cat.groups.forEach((group) => {
          const rows = getGroupLeaderboardRows(cat, group.roundIndex).map((row, index) => ({
            ...row,
            rank: index + 1,
            qualified: index < Number(group.qualifierCount || 2),
            groupName: group.groupName,
          }));
          mergedRows.push(...rows);
        });

        return mergedRows;
      }

      // ROUND ROBIN / ROUND ROBIN + KNOCKOUT => one common league table
      const leagueSource = Array.isArray(cat?.rounds?.[0])
        ? cat.rounds[0]
        : Array.isArray(cat?.matches)
          ? cat.matches
          : [];

      const matches = leagueSource.filter(
        (match) => String(match?.stage || "league").toLowerCase() !== "knockout"
      );

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

      matches.forEach((match, index) => {
        const home = ensureTeam(match?.home);
        const away = ensureTeam(match?.away);
        if (!home || !away) return;

        const status = getMatchStatus(match, 0, index);
        if (status !== "completed") return;

        home.matchesPlayed += 1;
        away.matchesPlayed += 1;

        home.matchPoints += Number(getFixtureMatchPoints(match, "home") || 0);
        away.matchPoints += Number(getFixtureMatchPoints(match, "away") || 0);
      });

      const rows = [...stats.values()].sort((a, b) => {
        if (Number(b.matchPoints || 0) !== Number(a.matchPoints || 0)) {
          return Number(b.matchPoints || 0) - Number(a.matchPoints || 0);
        }
        if (Number(b.matchesPlayed || 0) !== Number(a.matchesPlayed || 0)) {
          return Number(b.matchesPlayed || 0) - Number(a.matchesPlayed || 0);
        }
        return String(a.teamName || "").localeCompare(String(b.teamName || ""));
      });

      const qualifierCount =
        Number(getAdvancedSettings()?.qualifierCount || 0) || Math.min(4, rows.length);

      return rows.map((row, index) => ({
        ...row,
        rank: index + 1,
        qualified: index < qualifierCount,
      }));
    }

  function getSemifinalPairingRule() {
    return String(getAdvancedSettings()?.semifinalPairing || "1v4_2v3").trim().toLowerCase() || "1v4_2v3";
  }

  function buildQualifiedKnockoutEntrants(teamNames) {
    const seeded = [...teamNames].map((name) => String(name || "").trim()).filter(Boolean);
    if (seeded.length < 2) return [];
    if (seeded.length > 4) return seeded;
    if (seeded.length >= 4) {
      const top4 = seeded.slice(0, 4);
      if (getSemifinalPairingRule() === "1v3_2v4") {
        return [top4[0], top4[2], top4[1], top4[3]].filter(Boolean);
      }
      return [top4[0], top4[3], top4[1], top4[2]].filter(Boolean);
    }
    return seeded.slice(0, 2);
  }

  function buildSeededKnockoutRounds(teamNames) {
    const entrants = buildQualifiedKnockoutEntrants(teamNames);
    if (entrants.length < 2) return null;

    const size = nextPow2(Math.max(2, entrants.length));
    while (entrants.length < size) entrants.push("BYE");

    const firstRound = [];
    for (let index = 0; index < size / 2; index += 1) {
      const home = entrants[index];
      const away = entrants[size - 1 - index];
      firstRound.push(ensureMatchMeta({
        home,
        away,
        homePlayers: home && home !== "BYE" ? [home] : [],
        awayPlayers: away && away !== "BYE" ? [away] : [],
        stage: "knockout",
        roundLabel: size / 2 === 1 ? "Final" : null,
        status: home === "BYE" || away === "BYE" ? "completed" : "pending",
        winner: home === "BYE" ? away : away === "BYE" ? home : null,
      }));
    }

    const rounds = [firstRound];
    let currentCount = firstRound.length;
    while (currentCount > 1) {
      const nextRound = [];
      for (let index = 0; index < Math.ceil(currentCount / 2); index += 1) {
        nextRound.push(ensureMatchMeta({
          home: "TBD",
          away: "TBD",
          homePlayers: [],
          awayPlayers: [],
          stage: "knockout",
          status: "pending",
          winner: null,
        }));
      }
      rounds.push(nextRound);
      currentCount = nextRound.length;
    }

    return { rounds, totalRounds: rounds.length };
  }

  function propagateKnockoutWinnerIntoRounds(knockout, roundIndex, matchIndex, winnerName) {
    if (!knockout || !Array.isArray(knockout.rounds) || !winnerName || winnerName === "BYE") return;
    const nextRoundIndex = roundIndex + 1;
    const nextRound = knockout.rounds[nextRoundIndex];
    if (!Array.isArray(nextRound)) return;

    const nextMatchIndex = Math.floor(matchIndex / 2);
    const nextMatch = nextRound[nextMatchIndex];
    if (!nextMatch) return;

    const targetSlot = matchIndex % 2 === 0 ? "home" : "away";
    nextMatch[targetSlot] = winnerName;
    nextMatch[targetSlot === "home" ? "homePlayers" : "awayPlayers"] = [winnerName];
  }

  function autoAdvanceKnockoutByes(knockout) {
    if (!knockout || !Array.isArray(knockout.rounds)) return;
    knockout.rounds.forEach((round, roundIndex) => {
      round.forEach((match, matchIndex) => {
        const home = String(match?.home || "").trim();
        const away = String(match?.away || "").trim();
        if (match?.winner) {
          propagateKnockoutWinnerIntoRounds(knockout, roundIndex, matchIndex, match.winner);
          return;
        }
        if (home === "BYE" && away && away !== "BYE" && away !== "TBD") {
          match.status = "completed";
          match.winner = away;
          propagateKnockoutWinnerIntoRounds(knockout, roundIndex, matchIndex, away);
        } else if (away === "BYE" && home && home !== "BYE" && home !== "TBD") {
          match.status = "completed";
          match.winner = home;
          propagateKnockoutWinnerIntoRounds(knockout, roundIndex, matchIndex, home);
        }
      });
    });
  }

  function canGenerateKnockout(cat) {
    if (!cat || !isLeagueKnockoutFormat()) return false;
    const matches = Array.isArray(cat.matches) ? cat.matches : Array.isArray(cat.rounds?.[0]) ? cat.rounds[0] : [];
    if (!matches.length || cat.knockout) return false;
    return matches.every((match, index) => getMatchStatus(match, 0, index) === "completed");
  }

  function updateGoToKnockoutButton(cat = getTeamEventFixtureBucket()) {
    if (!fixturesGoKnockoutBtn) return;

    const show = Boolean(
      isTournamentTeamEvent() &&
      (
        (isLeagueKnockoutFormat() && canGenerateKnockout(cat)) ||
        (isTeamGroupKnockoutFormat() && canGenerateGroupKnockout(cat))
      )
    );

    fixturesGoKnockoutBtn.classList.toggle("hidden", !show);
  }

  function updateFixturesEditButtonState() {
    if (!fixturesEditBtn) return;
    const cat = getTeamEventFixtureBucket();
    const canEdit = Boolean(
      isTournamentTeamEvent() &&
      cat &&
      cat.displayMode === "team_schedule" &&
      ((Array.isArray(cat.matches) && cat.matches.length) || (Array.isArray(cat.rounds?.[0]) && cat.rounds[0].length))
    );

    fixturesEditBtn.style.display = canEdit ? "inline-flex" : "none";
    fixturesEditBtn.textContent = fixturesState.bulkEditMode ? "Save fixtures" : "Edit fixtures";
  }

  function updateEmbeddedFixturesHeader() {
    if (fixturesTournamentNameEl) fixturesTournamentNameEl.textContent = tournamentMetaCache?.tournamentName || "Tournament";
    if (fixturesTournamentSportEl) fixturesTournamentSportEl.textContent = tournamentMetaCache?.sportName || "";
    if (fixturesTournamentDatesEl) fixturesTournamentDatesEl.textContent = tournamentMetaCache?.tournamentDates || "";
    if (fixturesTournamentCodeEl) fixturesTournamentCodeEl.textContent = tournamentMetaCache?.accessCode || "";

    if (!embeddedFixturesHelperTextEl) return;

    if (isTournamentTeamEvent() && isTeamGroupKnockoutFormat()) {
      embeddedFixturesHelperTextEl.textContent =
        "For team events in Group + Knockout, teams are divided into groups first. Each group plays round robin team vs team ties, and the top 2 teams from each group qualify for knockout. Categories act as submatches inside each tie.";
      return;
    }

    if (isTournamentTeamEvent() && isLeagueKnockoutFormat()) {
      embeddedFixturesHelperTextEl.textContent =
        "For team events, the fixture list shows team vs team ties. Categories act as submatches inside each tie. League schedules are shown as editable match tables.";
      return;
    }

    if (isTournamentTeamEvent() && isTeamRoundRobinFormat()) {
      embeddedFixturesHelperTextEl.textContent =
        "For team events in Round Robin, each team plays against the other teams in one common league table. Categories act as submatches inside each tie.";
      return;
    }

    if (isTournamentTeamEvent()) {
      embeddedFixturesHelperTextEl.textContent =
        "For team events, the fixture list shows team vs team ties. Categories act as submatches inside each tie and are handled later on the score page.";
      return;
    }

    if (isLeagueKnockoutFormat()) {
      embeddedFixturesHelperTextEl.textContent =
        "View generated fixtures for each category. League + knockout formats will show league rounds first, followed by knockout progression.";
      return;
    }

    if (isGroupKnockoutFormat()) {
      embeddedFixturesHelperTextEl.textContent =
        "View generated fixtures for each category. Group + knockout uses the created pools first and knockout progression follows later.";
      return;
    }

    embeddedFixturesHelperTextEl.textContent =
      "Fixtures are auto-generated in random order for each category. BYE indicates a free pass to the next round.";
  }

  async function loadTournamentMeta() {
  const directCandidates = [
    `/api/tournaments/${encodeURIComponent(tournamentId)}`,
  ];

  for (const url of directCandidates) {
    const resp = await apiGet(url);
    if (!resp.ok) continue;

    const found = resp.data?.data || resp.data || null;
    if (found && String(found.tournamentId ?? found.id) === String(tournamentId)) {
      tournamentMetaCache = found;
      hydrateTournamentMetaUi(found);
      applyUmpireViewMode();
      return found;
    }
  }

  const mine = await apiGet("/api/player/tournaments");
  if (mine.ok) {
    const list = normalizeTournamentList(mine.data);
    const found = list.find((x) => String(x.tournamentId ?? x.id) === String(tournamentId));
    if (found) {
      tournamentMetaCache = found;
      hydrateTournamentMetaUi(found);
      return found;
    }
  }

  const host = await apiGet("/api/host/tournaments");
  if (host.ok) {
    const list = normalizeTournamentList(host.data);
    const found = list.find((x) => String(x.tournamentId ?? x.id) === String(tournamentId));
    if (found) {
      tournamentMetaCache = found;
      hydrateTournamentMetaUi(found);
      return found;
    }
  }

  const pub = await apiGet("/api/tournaments");
  if (pub.ok) {
    const list = normalizeTournamentList(pub.data);
    const found = list.find((x) => String(x.tournamentId ?? x.id) === String(tournamentId));
    if (found) {
      tournamentMetaCache = found;
      hydrateTournamentMetaUi(found);
      return found;
    }
  }

  return null;
}

  function hydrateTournamentMetaUi(tournament) {
    titleEl.textContent = tournament?.tournamentName || "Tournament";
    sportEl.textContent = tournament?.sportName || "";
    datesEl.textContent = tournament?.tournamentDates || "";
    codeEl.textContent = tournament?.accessCode || "";
    tournamentCategories = normalizeCategories(tournament?.categories);
    updateEmbeddedFixturesHeader();
    refreshStageSpecificUi();
    syncAddPlayerCategoryUi();
    renderPlayerTabs();
  }

  function refreshStageSpecificUi() {
    const hasConfirmed = captainState.confirmedCaptains.length > 0;

    if (!isGroupKnockoutFormat()) {
      createPoolsBtn?.classList.add("hidden");
      poolsSection?.classList.add("hidden");
    } else {
      createPoolsBtn?.classList.toggle("hidden", !hasConfirmed);
    }

    if (leaderboardSection) {
      const shouldShow =
        tournamentMetaCache?.stageFormat === "round_robin" ||
        isGroupKnockoutFormat() ||
        isLeagueKnockoutFormat();
      leaderboardSection.classList.toggle("hidden", !shouldShow);
    }
  }

  function renderPlayerTabs() {
    if (!playersTabs) return;

    if (isTournamentTeamEvent()) {
      activeFilter = "all";
      playersTabs.innerHTML = "";
      playersTabs.classList.add("hidden");
      return;
    }

    playersTabs.classList.remove("hidden");
    const counts = computeCounts(allPlayers);
    const tabs = [
      { key: "all", label: "All players", count: counts.all },
      ...tournamentCategories.map((c) => ({
        key: String(c.categoryId || c.id),
        label: categoryLabel(c),
        count: counts.byCategory[String(c.categoryId || c.id)] || 0,
      })),
    ];

    playersTabs.innerHTML = "";
    tabs.forEach((tab) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `players-tab ${activeFilter === tab.key ? "active" : ""}`;
      btn.innerHTML = `<span>${escapeHtml(tab.label)}</span><span class="tab-count">${tab.count}</span>`;
      btn.addEventListener("click", async () => {
        activeFilter = tab.key;
        renderPlayerTabs();
        renderPlayers();
        await loadLeaderboardFromDb();
        renderLeaderboard();
      });
      playersTabs.appendChild(btn);
    });
  }

  function renderPlayers() {
    const filtered = applyFilter(allPlayers);
    tableBody.innerHTML = "";

    if (!allPlayers.length) {
      emptyState?.classList.remove("hidden");
      if (tableWrapper) tableWrapper.style.display = "none";
      return;
    }

    emptyState?.classList.add("hidden");
    if (tableWrapper) tableWrapper.style.display = filtered.length ? "block" : "none";

    if (!filtered.length) {
      tableBody.innerHTML = `<tr><td colspan="5" class="muted">No players in this category.</td></tr>`;
      return;
    }

    filtered.forEach((player) => {
      const status = normalizeStatusPlayersPage(player);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(getPlayerDisplayName(player))}</td>
        <td>${escapeHtml(player.age ?? "—")}</td>
        <td>${escapeHtml(player.gender ?? "—")}</td>
        <td><span class="status-pill ${statusClass(status)}">${statusLabel(status)}</span></td>
        <td>
          <div class="row-actions">
            <button type="button" class="action-btn accept" data-action="accept" ${status === "accepted" ? "disabled" : ""}>Accept</button>
            <button type="button" class="action-btn reject" data-action="reject" ${status === "rejected" ? "disabled" : ""}>Reject</button>
          </div>
        </td>
      `;

      tr.querySelector('[data-action="accept"]')?.addEventListener("click", async () => {
        try {
          await updateRegistrationStatus(player, "accepted");
          await loadPlayers();
        } catch (err) {
          alert(err.message || "Could not accept player.");
        }
      });

      tr.querySelector('[data-action="reject"]')?.addEventListener("click", async () => {
        try {
          await updateRegistrationStatus(player, "rejected");
          await loadPlayers();
        } catch (err) {
          alert(err.message || "Could not reject player.");
        }
      });

      tableBody.appendChild(tr);
    });
  }

  async function updateRegistrationStatus(player, nextStatus) {
    const playerId = getPlayerId(player);
    const body = JSON.stringify({ status: nextStatus });

    const candidates = [
      { method: "PATCH", url: `/api/host/tournaments/${tournamentId}/players/${playerId}`, body },
      { method: "POST", url: `/api/host/tournaments/${tournamentId}/players/${playerId}/${nextStatus}`, body: null },
      { method: "PATCH", url: `/api/tournaments/${tournamentId}/players/${playerId}`, body },
      { method: "PATCH", url: `/api/host/tournaments/${tournamentId}/registrations/${playerId}`, body },
      { method: "POST", url: `/api/host/tournaments/${tournamentId}/registrations/${playerId}/${nextStatus}`, body: null },
    ].filter((c) => c.url && !c.url.includes("null") && !c.url.includes("undefined"));

    if (!playerId) {
      candidates.unshift({
        method: "PATCH",
        url: `/api/host/tournaments/${tournamentId}/players`,
        body: JSON.stringify({
          status: nextStatus,
          playerName: player.playerName ?? player.name,
          phone: player.phone ?? player.playerPhone,
          username: player.username,
        }),
      });
    }

    for (const c of candidates) {
      const r = await apiJson(c.url, {
        method: c.method,
        headers: c.body ? { "Content-Type": "application/json" } : undefined,
        body: c.body || undefined,
      });
      if (r.ok) return r.data;
    }

    throw new Error("No matching accept/reject API route responded successfully.");
  }

  async function loadPlayers() {
    const candidates = [
      `/api/host/tournaments/${tournamentId}/players`,
      `/api/host/tournaments/${tournamentId}/registrations`,
      `/api/tournaments/${tournamentId}/players`,
      `/api/tournaments/${tournamentId}/registrations`,
    ];

    for (const url of candidates) {
      const r = await apiGet(url);
      if (!r.ok) continue;

      let rows = [];
      if (Array.isArray(r.data)) rows = r.data;
      else if (Array.isArray(r.data?.data)) rows = r.data.data;
      else if (Array.isArray(r.data?.players)) rows = r.data.players;
      else if (Array.isArray(r.data?.registrations)) rows = r.data.registrations;

      if (Array.isArray(rows)) {
        allPlayers = rows;
        renderPlayerTabs();
        renderPlayers();
        return;
      }
    }

    allPlayers = [];
    renderPlayerTabs();
    renderPlayers();
  }

  function populateAddPlayerCategoryOptions() {
    if (!addPlayerCategory) return;

    if (isTournamentTeamEvent()) {
      addPlayerCategory.innerHTML = `<option value="${TEAM_EVENT_CATEGORY_ID}">Not applicable for team event</option>`;
      addPlayerCategory.value = TEAM_EVENT_CATEGORY_ID;
      syncAddPlayerCategoryUi();
      return;
    }

    addPlayerCategory.innerHTML = `<option value="">Select category</option>`;
    tournamentCategories.forEach((c) => {
      const id = c.categoryId || c.id;
      if (!id) return;
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = categoryLabel(c);
      addPlayerCategory.appendChild(opt);
    });
    syncAddPlayerCategoryUi();
  }

  function openAddPlayerModal() {
    populateAddPlayerCategoryOptions();
    addPlayerForm?.reset();
    if (isTournamentTeamEvent() && addPlayerCategory) {
      addPlayerCategory.value = TEAM_EVENT_CATEGORY_ID;
    }
    syncAddPlayerCategoryUi();
    addPlayerModal?.classList.remove("hidden");
    addPlayerModal?.setAttribute("aria-hidden", "false");
  }

  function closeAddPlayerModal() {
    addPlayerModal?.classList.add("hidden");
    addPlayerModal?.setAttribute("aria-hidden", "true");
  }

  function openBulkPlayerModal() {
  resetBulkPlayerState();
  bulkPlayerModal?.classList.remove("hidden");
  bulkPlayerModal?.setAttribute("aria-hidden", "false");
}

function closeBulkPlayerModal() {
  bulkPlayerModal?.classList.add("hidden");
  bulkPlayerModal?.setAttribute("aria-hidden", "true");
}

function resetBulkPlayerState() {
  bulkPlayerRows = [];
  if (bulkPlayerFile) bulkPlayerFile.value = "";
  if (bulkPlayerPreviewBody) bulkPlayerPreviewBody.innerHTML = "";
  bulkPlayerPreviewWrap?.classList.add("hidden");
  if (bulkPlayerSummary) {
    bulkPlayerSummary.textContent =
      "Expected columns: playerName, age, gender, phone, categoryId. For team events, categoryId can be blank.";
  }
  if (bulkPlayerSelectAll) bulkPlayerSelectAll.checked = false;
}

function splitCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += ch;
  }

  result.push(current.trim());
  return result;
}

function parseCsvText(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i += 1) {
    const values = splitCsvLine(lines[i]);
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? "";
    });
    rows.push(row);
  }

  return rows;
}

function normalizeImportedPlayerRow(row, index) {
  const isTeam = isTournamentTeamEvent();
  const rawCategory = String(row.categoryId || row.category || "").trim();

  const normalized = {
    __rowIndex: index,
    __selected: true,
    __valid: true,
    __message: "Ready",
    playerName: String(row.playerName || row.name || "").trim(),
    age: String(row.age || "").trim(),
    gender: String(row.gender || "").trim(),
    phone: String(row.phone || row.phoneNumber || "").trim(),
    categoryId: isTeam ? TEAM_EVENT_CATEGORY_ID : rawCategory,
  };

  if (!normalized.playerName) {
    normalized.__valid = false;
    normalized.__message = "Missing name";
  } else if (!normalized.phone) {
    normalized.__valid = false;
    normalized.__message = "Missing phone";
  } else if (!isTeam && !normalized.categoryId) {
    normalized.__valid = false;
    normalized.__message = "Missing category";
  }

  return normalized;
}

function renderBulkCategoryCell(row, idx) {
  if (isTournamentTeamEvent()) {
    return `<span class="muted">${escapeHtml(TEAM_EVENT_CATEGORY_ID)}</span>`;
  }

  return `
    <select data-bulk-field="categoryId" data-bulk-idx="${idx}">
      <option value="">Select category</option>
      ${tournamentCategories.map((cat) => {
        const value = String(cat.categoryId || cat.id || "");
        const selected = value === String(row.categoryId || "");
        return `<option value="${escapeHtml(value)}" ${selected ? "selected" : ""}>${escapeHtml(categoryLabel(cat))}</option>`;
      }).join("")}
    </select>
  `;
}

function syncBulkSummary() {
  if (!bulkPlayerSummary) return;
  const total = bulkPlayerRows.length;
  const selected = bulkPlayerRows.filter((r) => r.__selected).length;
  const valid = bulkPlayerRows.filter((r) => r.__selected && r.__valid).length;
  bulkPlayerSummary.textContent = `${selected} selected out of ${total}. ${valid} selected row(s) are valid.`;
}

function revalidateBulkRow(idx) {
  bulkPlayerRows[idx] = normalizeImportedPlayerRow(bulkPlayerRows[idx], idx);
}

function bindBulkPreviewInputs() {
  bulkPlayerPreviewBody?.querySelectorAll("[data-bulk-field]").forEach((el) => {
    el.addEventListener("input", () => {
      const idx = Number(el.dataset.bulkIdx);
      const field = el.dataset.bulkField;
      bulkPlayerRows[idx][field] = el.value;
      revalidateBulkRow(idx);
      renderBulkPlayerPreview();
    });

    el.addEventListener("change", () => {
      const idx = Number(el.dataset.bulkIdx);
      const field = el.dataset.bulkField;
      bulkPlayerRows[idx][field] = el.value;
      revalidateBulkRow(idx);
      renderBulkPlayerPreview();
    });
  });

  bulkPlayerPreviewBody?.querySelectorAll("[data-bulk-check]").forEach((el) => {
    el.addEventListener("change", () => {
      const idx = Number(el.dataset.bulkCheck);
      bulkPlayerRows[idx].__selected = el.checked;
      syncBulkSummary();
    });
  });
}

function renderBulkPlayerPreview() {
  if (!bulkPlayerPreviewBody) return;

  bulkPlayerPreviewBody.innerHTML = "";

  if (!bulkPlayerRows.length) {
    bulkPlayerPreviewWrap?.classList.add("hidden");
    return;
  }

  bulkPlayerPreviewWrap?.classList.remove("hidden");

  bulkPlayerRows.forEach((row, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <input type="checkbox" data-bulk-check="${idx}" ${row.__selected ? "checked" : ""} />
      </td>
      <td><input type="text" data-bulk-field="playerName" data-bulk-idx="${idx}" value="${escapeHtml(row.playerName)}" /></td>
      <td><input type="number" data-bulk-field="age" data-bulk-idx="${idx}" value="${escapeHtml(row.age)}" /></td>
      <td>
        <select data-bulk-field="gender" data-bulk-idx="${idx}">
          <option value="">Select</option>
          <option value="Male" ${row.gender === "Male" ? "selected" : ""}>Male</option>
          <option value="Female" ${row.gender === "Female" ? "selected" : ""}>Female</option>
          <option value="Other" ${row.gender === "Other" ? "selected" : ""}>Other</option>
        </select>
      </td>
      <td><input type="tel" data-bulk-field="phone" data-bulk-idx="${idx}" value="${escapeHtml(row.phone)}" /></td>
      <td>${renderBulkCategoryCell(row, idx)}</td>
      <td>${escapeHtml(row.__message)}</td>
    `;
    bulkPlayerPreviewBody.appendChild(tr);
  });

  bindBulkPreviewInputs();
  syncBulkSummary();
}

function buildBulkSavePayload() {
  return bulkPlayerRows
    .filter((row) => row.__selected && row.__valid)
    .map((row) => ({
      playerName: row.playerName,
      age: row.age ? Number(row.age) : null,
      gender: row.gender,
      phone: row.phone,
      categoryId: isTournamentTeamEvent() ? TEAM_EVENT_CATEGORY_ID : row.categoryId,
      status: "accepted",
      addedByHost: true,
    }));
}

bulkPlayerClose?.addEventListener("click", closeBulkPlayerModal);
bulkPlayerCloseFooter?.addEventListener("click", closeBulkPlayerModal);

bulkPlayerModal?.addEventListener("click", (e) => {
  if (e.target === bulkPlayerModal) closeBulkPlayerModal();
});

bulkPlayerClearBtn?.addEventListener("click", resetBulkPlayerState);

bulkPlayerSelectAll?.addEventListener("change", () => {
  bulkPlayerRows = bulkPlayerRows.map((row) => ({
    ...row,
    __selected: bulkPlayerSelectAll.checked,
  }));
  renderBulkPlayerPreview();
});

bulkPlayerFile?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const text = await file.text();
  const parsed = parseCsvText(text);

  bulkPlayerRows = parsed.map((row, idx) => normalizeImportedPlayerRow(row, idx));
  renderBulkPlayerPreview();
});

bulkPlayerSaveBtn?.addEventListener("click", async () => {
  const players = buildBulkSavePayload();

  if (!players.length) {
    alert("No valid selected players to save.");
    return;
  }

  const r = await apiPost(
    `/api/host/tournaments/${encodeURIComponent(tournamentId)}/players/bulk`,
    { players }
  );

  if (!r.ok) {
    alert(r.data?.message || "Bulk add backend route is not ready yet.");
    return;
  }

  closeBulkPlayerModal();
  await loadPlayers();
});

  makeUmpireBtn?.addEventListener("click", openAddUmpireModal);
  addUmpireClose?.addEventListener("click", closeAddUmpireModal);

  addUmpireModal?.addEventListener("click", (e) => {
    if (e.target === addUmpireModal) closeAddUmpireModal();
  });

  addUmpireForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
      name: document.getElementById("host-umpire-name")?.value?.trim() || "",
      phone: document.getElementById("host-umpire-phone")?.value?.trim() || "",
    };

    if (!payload.name || !payload.phone) {
      alert("Please fill umpire name and phone number.");
      return;
    }

    const attempts = [
      () => apiPost(`/api/host/tournaments/${encodeURIComponent(tournamentId)}/umpires`, payload),
      () => apiPost(`/api/host/tournaments/${encodeURIComponent(tournamentId)}/officials`, { ...payload, role: "umpire" }),
    ];

    for (const attempt of attempts) {
      const r = await attempt();
      if (r.ok) {
        closeAddUmpireModal();
        await loadTournamentMeta();
        alert("Umpire added successfully.");
        return;
      }
    }

    alert("Could not save umpire. Backend umpire route is not ready yet.");
  });

  addPlayerBtn?.addEventListener("click", openAddPlayerModal);
  addPlayerClose?.addEventListener("click", closeAddPlayerModal);
  addPlayerModal?.addEventListener("click", (e) => {
    if (e.target === addPlayerModal) closeAddPlayerModal();
  });

  addPlayerForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      playerName: document.getElementById("host-player-name")?.value?.trim() || "",
      age: Number(document.getElementById("host-player-age")?.value || 0),
      gender: document.getElementById("host-player-gender")?.value || "",
      phone: document.getElementById("host-player-phone")?.value?.trim() || "",
      categoryId: isTournamentTeamEvent() ? TEAM_EVENT_CATEGORY_ID : (addPlayerCategory?.value || ""),
      status: "accepted",
      addedByHost: true,
    };

    if (!payload.playerName || !payload.age || !payload.gender || !payload.phone || (!isTournamentTeamEvent() && !payload.categoryId)) {
      alert("Please fill all player details.");
      return;
    }

    const attempts = [
      () => apiPost(`/api/host/tournaments/${tournamentId}/players/add`, payload),
      () => apiPost(`/api/host/tournaments/${tournamentId}/players`, payload),
      () => apiPost(`/api/host/tournaments/${tournamentId}/registrations`, payload),
    ];

    for (const attempt of attempts) {
      const r = await attempt();
      if (r.ok) {
        closeAddPlayerModal();
        await loadPlayers();
        return;
      }
    }

    alert("Could not add player. Check backend route.");
  });

  function getDefaultCaptainState() {
    return {
      selectedCaptainIds: [],
      confirmedCaptains: [],
      pools: null,
    };
  }

  async function loadCaptainStateFromDb() {
    const r = await apiGet(`/api/host/tournaments/${encodeURIComponent(tournamentId)}/captains`);
    if (r.ok && r.data) {
      captainState.selectedCaptainIds = Array.isArray(r.data.selectedCaptainIds) ? r.data.selectedCaptainIds : [];
      captainState.confirmedCaptains = Array.isArray(r.data.confirmedCaptains) ? r.data.confirmedCaptains : [];
    } else {
      captainState = getDefaultCaptainState();
    }
  }

  async function saveCaptainStateToDb() {
    const r = await apiPut(`/api/host/tournaments/${encodeURIComponent(tournamentId)}/captains`, {
      selectedCaptainIds: captainState.selectedCaptainIds,
      confirmedCaptains: captainState.confirmedCaptains,
    });
    if (!r.ok) throw new Error("Could not save captains");
  }

  async function loadTeamsFromDb() {
  const r = await apiGet(`/api/host/tournaments/${encodeURIComponent(tournamentId)}/teams`);
  if (r.ok) {
    canonicalTeams = Array.isArray(r.data?.teams)
      ? r.data.teams
      : Array.isArray(r.data)
        ? r.data
        : [];
  } else {
    canonicalTeams = [];
  }
}

async function refreshTeamSetupState() {
  await loadCaptainStateFromDb();
  await loadTeamsFromDb();
}

function getCanonicalTeamForCaptain(captainPlayerId) {
  const target = String(captainPlayerId || "").trim();
  if (!target) return null;

  return canonicalTeams.find((team) => {
    return String(team?.captainPlayerId || "").trim() === target;
  }) || null;
}

function canonicalTeamPlayersOverlap(a = {}, b = {}) {
  const aId = String(a?.playerId || "").trim();
  const bId = String(b?.playerId || "").trim();
  const aUsername = String(a?.username || "").trim().toLowerCase();
  const bUsername = String(b?.username || "").trim().toLowerCase();
  const aPhone = String(a?.phone || "").trim();
  const bPhone = String(b?.phone || "").trim();
  const aName = String(a?.playerName || "").trim().toLowerCase();
  const bName = String(b?.playerName || "").trim().toLowerCase();

  if (aId && bId && aId === bId) return true;
  if (aUsername && bUsername && aUsername === bUsername) return true;
  if (aPhone && bPhone && aPhone === bPhone) return true;
  if (aName && bName && aName === bName) return true;

  return false;
}

function getCanonicalTeamPlayers(teamOrCaptain) {
  const rawPlayers = Array.isArray(teamOrCaptain?.players)
    ? teamOrCaptain.players
    : Array.isArray(teamOrCaptain?.teamRoster)
      ? teamOrCaptain.teamRoster
      : [];

  const out = [];
  rawPlayers
    .map((player) => {
      if (typeof player === "string") {
        return { playerName: String(player).trim(), isCaptain: false };
      }
      return {
        playerId: String(player?.playerId || "").trim(),
        playerName: String(player?.playerName || player?.name || player?.username || "").trim(),
        username: String(player?.username || "").trim(),
        phone: String(player?.phone || "").trim(),
        inviteStatus: String(player?.inviteStatus || "accepted").trim(),
        isCaptain: Boolean(player?.isCaptain),
      };
    })
    .filter((player) => player.playerName || player.playerId || player.username)
    .forEach((player) => {
      const existing = out.find((candidate) => canonicalTeamPlayersOverlap(candidate, player));
      if (!existing) {
        out.push(player);
        return;
      }

      if (!existing.playerId && player.playerId) existing.playerId = player.playerId;
      if (!existing.username && player.username) existing.username = player.username;
      if (!existing.phone && player.phone) existing.phone = player.phone;
      if ((!existing.playerName || existing.playerName === "Player") && player.playerName) {
        existing.playerName = player.playerName;
      }
      existing.isCaptain = Boolean(existing.isCaptain || player.isCaptain);

      const existingStatus = String(existing.inviteStatus || "pending").toLowerCase();
      const incomingStatus = String(player.inviteStatus || "pending").toLowerCase();
      if (incomingStatus === "accepted" || (incomingStatus === "pending" && existingStatus === "rejected")) {
        existing.inviteStatus = player.inviteStatus;
      }
    });

  return out;
}

  async function updateCaptainTeamStatus(playerId, nextStatus) {
  const captain = captainState.confirmedCaptains.find((c) => String(c.playerId) === String(playerId));
  if (!captain) return;

  const r = await apiPatch(
    `/api/host/tournaments/${encodeURIComponent(tournamentId)}/teams/by-captain/${encodeURIComponent(playerId)}`,
    {
      teamStatus: nextStatus,
      categoryId: captain?.categoryId || TEAM_EVENT_CATEGORY_ID,
      teamName: captain?.teamName || captain?.playerName || "Team",
      captainName: captain?.playerName || "",
      captainUsername: captain?.username || captain?.captainUsername || "",
    }
  );

  if (!r.ok) {
    throw new Error(r.data?.message || "Could not update team status");
  }

  await refreshTeamSetupState();
}

function getManualAddEligiblePlayers(captainPlayerId) {
  const captainIds = new Set([
    ...(captainState.selectedCaptainIds || []).map((id) => String(id)),
    ...(captainState.confirmedCaptains || []).map((c) => String(c?.playerId || "")),
  ]);

  const team = getCanonicalTeamForCaptain(captainPlayerId);
  const existingRoster = getCanonicalTeamPlayers(team);

  const existingKeys = new Set(
    existingRoster.map((player) =>
      String(player?.playerId || "").trim() ||
      String(player?.username || "").trim().toLowerCase() ||
      String(player?.phone || "").trim() ||
      String(player?.playerName || "").trim().toLowerCase()
    ).filter(Boolean)
  );

  return (allPlayers || []).filter((player) => {
    const playerId = String(getPlayerId(player) || "");
    const playerName = String(getPlayerDisplayName(player) || "").trim();
    const playerUsername = String(player?.username || "").trim().toLowerCase();
    const playerPhone = String(player?.phone || player?.playerPhone || "").trim();

    if (!playerId || !playerName) return false;
    if (captainIds.has(playerId)) return false;
    if (normalizeStatusPlayersPage(player) === "rejected") return false;

    const key =
      playerId ||
      playerUsername ||
      playerPhone ||
      playerName.toLowerCase();

    if (existingKeys.has(key)) return false;

    return true;
  });
}

async function addManualPlayerToCaptainTeam(captainPlayerId, addedPlayerId) {
  const captain = captainState.confirmedCaptains.find(
    (c) => String(c.playerId) === String(captainPlayerId)
  );
  if (!captain) throw new Error("Team not found.");

  const player = (allPlayers || []).find(
    (p) => String(getPlayerId(p)) === String(addedPlayerId)
  );
  if (!player) throw new Error("Player not found.");

  const payload = {
    categoryId: captain?.categoryId || TEAM_EVENT_CATEGORY_ID,
    teamName: captain?.teamName || captain?.playerName || "Team",
    captainName: captain?.playerName || "",
    captainUsername: captain?.username || captain?.captainUsername || "",
    addPlayer: {
      playerId: String(getPlayerId(player) || "").trim(),
      playerName: String(getPlayerDisplayName(player) || "").trim(),
      username: String(player?.username || "").trim(),
      phone: String(player?.phone || player?.playerPhone || "").trim(),
      inviteStatus: "accepted",
    },
  };

  const r = await apiPatch(
    `/api/host/tournaments/${encodeURIComponent(tournamentId)}/teams/by-captain/${encodeURIComponent(captainPlayerId)}`,
    payload
  );

  if (!r.ok) {
    throw new Error(r.data?.message || "Could not add player manually.");
  }

  await refreshTeamSetupState();
}
  function openMakeCaptainsModal() {
    renderCaptainPickList();
    makeCaptainsModal?.classList.remove("hidden");
    makeCaptainsModal?.setAttribute("aria-hidden", "false");
  }

  function closeMakeCaptainsModal() {
    makeCaptainsModal?.classList.add("hidden");
    makeCaptainsModal?.setAttribute("aria-hidden", "true");
  }

  function openConfirmCaptainsModal() {
    renderConfirmCaptainsForm();
    confirmCaptainsModal?.classList.remove("hidden");
    confirmCaptainsModal?.setAttribute("aria-hidden", "false");
  }

  function closeConfirmCaptainsModal() {
    confirmCaptainsModal?.classList.add("hidden");
    confirmCaptainsModal?.setAttribute("aria-hidden", "true");
  }

  makeCaptainsBtn?.addEventListener("click", openMakeCaptainsModal);
  makeCaptainsClose?.addEventListener("click", closeMakeCaptainsModal);
  makeCaptainsCancelBtn?.addEventListener("click", closeMakeCaptainsModal);
  makeCaptainsModal?.addEventListener("click", (e) => {
    if (e.target === makeCaptainsModal) closeMakeCaptainsModal();
  });
  confirmCaptainsClose?.addEventListener("click", closeConfirmCaptainsModal);
  confirmCaptainsCancelBtn?.addEventListener("click", closeConfirmCaptainsModal);
  confirmCaptainsModal?.addEventListener("click", (e) => {
    if (e.target === confirmCaptainsModal) closeConfirmCaptainsModal();
  });

  function renderCaptainPickList() {
    const acceptedPlayers = getAcceptedPlayers();
    makeCaptainsList.innerHTML = "";

    if (!acceptedPlayers.length) {
      makeCaptainsEmpty?.classList.remove("hidden");
      return;
    }

    makeCaptainsEmpty?.classList.add("hidden");
    acceptedPlayers.forEach((player) => {
      const playerId = String(getPlayerId(player));
      const checked = captainState.selectedCaptainIds.includes(playerId);
      const row = document.createElement("label");
      row.className = "captain-pick-row";
      row.innerHTML = `
        <div class="captain-pick-left">
          <input class="captain-checkbox" type="checkbox" value="${escapeHtml(playerId)}" ${checked ? "checked" : ""} />
          <div>
            <div class="captain-pick-name">${escapeHtml(getPlayerDisplayName(player))}</div>
            ${isTournamentTeamEvent() ? "" : `<div class="captain-pick-meta">${escapeHtml(getCategoryNameById(getPlayerCategoryId(player)))}</div>`}
          </div>
        </div>
      `;
      makeCaptainsList.appendChild(row);
    });
  }

  makeCaptainsSaveBtn?.addEventListener("click", () => {
    captainState.selectedCaptainIds = Array.from(makeCaptainsList.querySelectorAll(".captain-checkbox:checked")).map((el) => String(el.value));
    closeMakeCaptainsModal();
    openConfirmCaptainsModal();
  });

  function renderConfirmCaptainsForm() {
    confirmCaptainsList.innerHTML = "";
    const selectedPlayers = captainState.selectedCaptainIds
      .map((id) => allPlayers.find((p) => String(getPlayerId(p)) === String(id)))
      .filter(Boolean);

    if (!selectedPlayers.length) {
      confirmCaptainsEmpty?.classList.remove("hidden");
      return;
    }

    confirmCaptainsEmpty?.classList.add("hidden");
    selectedPlayers.forEach((player) => {
      const playerId = String(getPlayerId(player));
      const existing = captainState.confirmedCaptains.find((c) => String(c.playerId) === playerId);
      const card = document.createElement("div");
      card.className = "confirm-captain-card";
      card.innerHTML = `
        <div class="confirm-captain-head">
          <div>
            <div class="confirm-captain-name">${escapeHtml(getPlayerDisplayName(player))}</div>
            ${isTournamentTeamEvent() ? "" : `<div class="confirm-captain-category">${escapeHtml(getCategoryNameById(getPlayerCategoryId(player)))}</div>`}
          </div>
        </div>
        <div class="field-group">
          <label>Team name (optional)</label>
          <input
            type="text"
            class="confirm-team-name-input"
            data-player-id="${escapeHtml(playerId)}"
            placeholder="e.g. Team Alpha"
            value="${escapeHtml(existing?.teamName || "")}"
          />
        </div>
      `;
      confirmCaptainsList.appendChild(card);
    });
  }

  confirmCaptainsForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const selectedPlayers = captainState.selectedCaptainIds
      .map((id) => allPlayers.find((p) => String(getPlayerId(p)) === String(id)))
      .filter(Boolean);

    captainState.confirmedCaptains = selectedPlayers.map((player, index) => {
      const playerId = String(getPlayerId(player));
      const existing = captainState.confirmedCaptains.find((c) => String(c.playerId) === playerId) || {};
      const teamNameInput = confirmCaptainsList.querySelector(`.confirm-team-name-input[data-player-id="${CSS.escape(playerId)}"]`);

      return {
        ...existing,
        playerId,
        playerName: getPlayerDisplayName(player),
        categoryId: getPlayerCategoryId(player),
        teamName: teamNameInput?.value?.trim() || existing.teamName || `Team ${index + 1}`,
        teamStatus: existing.teamStatus || "pending",
        teamPlayers: Array.isArray(existing.teamPlayers)
          ? existing.teamPlayers
          : Array.isArray(existing.players)
            ? existing.players
            : Array.isArray(existing.members)
              ? existing.members
              : Array.isArray(existing.submittedPlayers)
                ? existing.submittedPlayers
                : Array.isArray(existing.roster)
                  ? existing.roster
                  : [],
      };
    });

    try {
  await saveCaptainStateToDb();
  await refreshTeamSetupState();
  closeConfirmCaptainsModal();
  renderCaptainsSummary();
  refreshStageSpecificUi();
} catch (err) {
  alert(err.message || "Could not save captains.");
}
  });

function renderCaptainsSummary() {
  if (!captainsSummaryList) return;

  captainsSummaryList.innerHTML = "";

  if (!Array.isArray(captainState.confirmedCaptains) || !captainState.confirmedCaptains.length) {
    captainsSummarySection?.classList.add("hidden");
    captainsSummaryEmpty?.classList.remove("hidden");
    return;
  }

  captainsSummarySection?.classList.remove("hidden");
  captainsSummaryEmpty?.classList.add("hidden");

  captainState.confirmedCaptains.forEach((captain) => {
    const playerId = String(captain.playerId || "");
    const expanded = expandedTeamIds.has(playerId);

    const canonicalTeam = getCanonicalTeamForCaptain(playerId);
    const teamPlayers = getCanonicalTeamPlayers(canonicalTeam || captain);
    const eligiblePlayers = getManualAddEligiblePlayers(playerId);

    const effectiveTeamName =
      canonicalTeam?.teamName ||
      captain.teamName ||
      captain.playerName ||
      "Team";

    const effectiveCaptainName =
      canonicalTeam?.captainName ||
      captain.playerName ||
      "—";

    const teamStatus = String(
      canonicalTeam?.teamStatus ||
      captain.teamStatus ||
      "pending"
    ).toLowerCase();

    const statusChipClass =
      teamStatus === "accepted"
        ? "status-pill status-pill--accepted"
        : teamStatus === "rejected"
          ? "status-pill status-pill--rejected"
          : "status-pill status-pill--pending";

    const statusChipText =
      teamStatus === "accepted"
        ? "Team accepted"
        : teamStatus === "rejected"
          ? "Team rejected"
          : "Team pending";

    const card = document.createElement("div");
    card.className = "captain-summary-card team-setup-card";
    card.innerHTML = `
      <button type="button" class="captain-summary-head-btn" data-team-card-toggle="${escapeHtml(playerId)}">
        <div class="captain-summary-left">
          <div class="captain-summary-name">${escapeHtml(effectiveTeamName)}</div>
          <div class="captain-summary-meta">Captain: ${escapeHtml(effectiveCaptainName)}</div>
        </div>
        <div class="row-actions team-setup-head-actions">
          <span class="${statusChipClass}">${escapeHtml(statusChipText)}</span>
          <span class="team-name-chip team-toggle-chip">${expanded ? "▾" : "▸"}</span>
        </div>
      </button>

      <div class="team-setup-details${expanded ? "" : " hidden"}" data-team-card-body="${escapeHtml(playerId)}">
        <div class="helper-text team-setup-helper">Current team roster</div>

        ${
          teamPlayers.length
            ? `
              <div class="team-player-list">
                ${teamPlayers
                  .map(
                    (player, idx) => `
                      <div class="team-player-row">
                        <div class="team-player-main">
                          <span class="team-player-index">${idx + 1}</span>
                          <span class="team-player-name">${escapeHtml(player?.playerName || "Player")}</span>
                        </div>
                        <div class="team-player-meta">
                          ${
                            player?.isCaptain
                              ? `<span class="status-pill status-pill--accepted">Captain</span>`
                              : `<span class="status-pill ${String(player?.inviteStatus || "accepted").toLowerCase() === "accepted"
                                  ? "status-pill--accepted"
                                  : String(player?.inviteStatus || "pending").toLowerCase() === "rejected"
                                    ? "status-pill--rejected"
                                    : "status-pill--pending"}">${escapeHtml(String(player?.inviteStatus || "accepted"))}</span>`
                          }
                        </div>
                      </div>
                    `
                  )
                  .join("")}
              </div>
            `
            : `
              <div class="empty-state compact-empty team-setup-empty">
                <div class="feature-icon">👥</div>
                <h3>No team list yet</h3>
                <p class="muted">Captain-side and host-side team changes will appear here from the same backend team data.</p>
              </div>
            `
        }

        <div class="row-actions team-setup-actions">
          <button
            type="button"
            class="action-btn accept"
            data-team-status="accepted"
            data-team-player-id="${escapeHtml(playerId)}"
          >
            Accept team
          </button>

          <button
            type="button"
            class="action-btn reject"
            data-team-status="rejected"
            data-team-player-id="${escapeHtml(playerId)}"
          >
            Reject team
          </button>

          <button
            type="button"
            class="action-btn"
            data-manual-toggle="${escapeHtml(playerId)}"
          >
            Add manually
          </button>
        </div>

        <div class="team-manual-add hidden" data-manual-wrap="${escapeHtml(playerId)}">
          <select class="team-manual-select" data-manual-select="${escapeHtml(playerId)}">
            <option value="">Select player</option>
            ${
              eligiblePlayers.length
                ? eligiblePlayers
                    .map((player) => {
                      const eligibleId = String(getPlayerId(player) || "");
                      const eligibleName = String(getPlayerDisplayName(player) || "").trim();
                      return `<option value="${escapeHtml(eligibleId)}">${escapeHtml(eligibleName)}</option>`;
                    })
                    .join("")
                : `<option value="" disabled>No players available</option>`
            }
          </select>

          <button
            type="button"
            class="action-btn"
            data-manual-add="${escapeHtml(playerId)}"
            ${eligiblePlayers.length ? "" : "disabled"}
          >
            Add
          </button>
        </div>
      </div>
    `;

    captainsSummaryList.appendChild(card);
  });

  captainsSummaryList.querySelectorAll("[data-team-card-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const playerId = String(btn.getAttribute("data-team-card-toggle") || "");
      if (!playerId) return;

      if (expandedTeamIds.has(playerId)) expandedTeamIds.delete(playerId);
      else expandedTeamIds.add(playerId);

      renderCaptainsSummary();
    });
  });

  captainsSummaryList.querySelectorAll("[data-team-status]").forEach((btn) => {
    btn.addEventListener("click", async (event) => {
      event.stopPropagation();

      const playerId = String(btn.getAttribute("data-team-player-id") || "");
      const nextStatus = String(btn.getAttribute("data-team-status") || "pending");
      if (!playerId) return;

      try {
        await updateCaptainTeamStatus(playerId, nextStatus);
        renderCaptainsSummary();
      } catch (err) {
        alert(err.message || "Could not update team status.");
      }
    });
  });

  captainsSummaryList.querySelectorAll("[data-manual-toggle]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();

      const playerId = String(btn.getAttribute("data-manual-toggle") || "");
      if (!playerId) return;

      const wrap = captainsSummaryList.querySelector(
        `[data-manual-wrap="${CSS.escape(playerId)}"]`
      );
      wrap?.classList.toggle("hidden");
    });
  });

  captainsSummaryList.querySelectorAll("[data-manual-add]").forEach((btn) => {
    btn.addEventListener("click", async (event) => {
      event.stopPropagation();

      const playerId = String(btn.getAttribute("data-manual-add") || "");
      if (!playerId) return;

      const select = captainsSummaryList.querySelector(
        `[data-manual-select="${CSS.escape(playerId)}"]`
      );
      const addedPlayerId = String(select?.value || "");

      if (!addedPlayerId) {
        alert("Please select a player first.");
        return;
      }

      try {
        await addManualPlayerToCaptainTeam(playerId, addedPlayerId);
        renderCaptainsSummary();
      } catch (err) {
        alert(err.message || "Could not add player manually.");
      }
    });
  });
}

  async function loadPoolsFromDb() {
    const r = await apiGet(`/api/host/tournaments/${encodeURIComponent(tournamentId)}/pools`);
    captainState.pools = r.ok ? (r.data || null) : null;
  }

  async function savePoolsToDb() {
    const r = await apiPut(`/api/host/tournaments/${encodeURIComponent(tournamentId)}/pools`, {
      pools: captainState.pools,
    });
    if (!r.ok) throw new Error("Could not save pools");
  }

  function buildEmptyPools() {
    const pools = { groups: {}, unassigned: [] };
    const groupCount = Number(tournamentMetaCache?.groupCount || 0);
    for (let i = 1; i <= groupCount; i += 1) {
      pools.groups[`Pool ${i}`] = [];
    }
    return pools;
  }

  function buildRandomPools(teams, groupCount) {
    const pools = buildEmptyPools();
    const shuffledTeams = shuffle([...teams]);
    const poolNames = Object.keys(pools.groups);
    shuffledTeams.forEach((team, index) => {
      const poolName = poolNames[index % groupCount];
      pools.groups[poolName].push(team.teamKey);
    });
    return pools;
  }

  function ensurePoolsState() {
    const teams = getConfirmedTeams();
    const validKeys = new Set(teams.map((t) => t.teamKey));
    const groupCount = Number(tournamentMetaCache?.groupCount || 0);

    if (!captainState.pools || !captainState.pools.groups || Object.keys(captainState.pools.groups).length !== groupCount) {
      captainState.pools = buildEmptyPools();
    }

    const placed = new Set();
    Object.keys(captainState.pools.groups).forEach((poolName) => {
      captainState.pools.groups[poolName] = (captainState.pools.groups[poolName] || []).filter((teamKey) => {
        const ok = validKeys.has(teamKey) && !placed.has(teamKey);
        if (ok) placed.add(teamKey);
        return ok;
      });
    });

    captainState.pools.unassigned = (captainState.pools.unassigned || []).filter((teamKey) => {
      const ok = validKeys.has(teamKey) && !placed.has(teamKey);
      if (ok) placed.add(teamKey);
      return ok;
    });

    teams.forEach((team) => {
      if (!placed.has(team.teamKey)) captainState.pools.unassigned.push(team.teamKey);
    });
  }

  function openPoolsSection() {
    if (!isGroupKnockoutFormat()) return;
    if (!captainState.confirmedCaptains.length) {
      alert("Please confirm captains first.");
      return;
    }
    ensurePoolsState();
    poolsSection?.classList.remove("hidden");
    renderPools();
    poolsSection?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  createPoolsBtn?.addEventListener("click", openPoolsSection);

  randomizePoolsBtn?.addEventListener("click", async () => {
    if (!isGroupKnockoutFormat()) return;
    const teams = getConfirmedTeams();
    if (!teams.length) {
      alert("Please confirm captains first.");
      return;
    }
    const groupCount = Number(tournamentMetaCache?.groupCount || 0);
    if (!groupCount) {
      alert("Number of pools not found.");
      return;
    }
    captainState.pools = buildRandomPools(teams, groupCount);
    try {
      await savePoolsToDb();
      renderPools();
    } catch (err) {
      alert(err.message || "Could not save pools.");
    }
  });

  resetPoolsBtn?.addEventListener("click", async () => {
    if (!isGroupKnockoutFormat()) return;
    const teams = getConfirmedTeams();
    if (!teams.length) {
      alert("Please confirm captains first.");
      return;
    }
    captainState.pools = buildEmptyPools();
    teams.forEach((team) => captainState.pools.unassigned.push(team.teamKey));
    try {
      await savePoolsToDb();
      renderPools();
    } catch (err) {
      alert(err.message || "Could not save pools.");
    }
  });

  function moveTeamToZone(teamKey, zoneName) {
    Object.keys(captainState.pools.groups).forEach((poolName) => {
      captainState.pools.groups[poolName] = captainState.pools.groups[poolName].filter((key) => key !== teamKey);
    });
    captainState.pools.unassigned = captainState.pools.unassigned.filter((key) => key !== teamKey);
    if (zoneName === "unassigned") captainState.pools.unassigned.push(teamKey);
    else {
      captainState.pools.groups[zoneName] = captainState.pools.groups[zoneName] || [];
      captainState.pools.groups[zoneName].push(teamKey);
    }
  }

  function renderPools() {
    if (!isGroupKnockoutFormat()) return;
    ensurePoolsState();
    if (!poolsGrid || !unassignedTeams) return;

    const teams = getConfirmedTeams();
    const teamMap = new Map(teams.map((team) => [team.teamKey, team]));
    unassignedTeams.innerHTML = "";
    poolsGrid.innerHTML = "";

    function createTeamCard(teamKey) {
      const team = teamMap.get(teamKey);
      if (!team) return null;
      const card = document.createElement("div");
      card.className = "team-card";
      card.draggable = true;
      card.dataset.teamKey = team.teamKey;
      card.innerHTML = `
        <div class="team-card-name">${escapeHtml(team.teamName)}</div>
        <div class="team-card-meta">Captain: ${escapeHtml(team.captainName)}</div>
      `;
      card.addEventListener("dragstart", () => card.classList.add("dragging"));
      card.addEventListener("dragend", () => card.classList.remove("dragging"));
      return card;
    }

    function wireDropzone(dropzone, zoneName) {
      dropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropzone.classList.add("drag-over");
      });
      dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag-over"));
      dropzone.addEventListener("drop", async (e) => {
        e.preventDefault();
        dropzone.classList.remove("drag-over");
        const dragging = document.querySelector(".team-card.dragging");
        const teamKey = dragging?.dataset.teamKey;
        if (!teamKey) return;
        moveTeamToZone(teamKey, zoneName);
        try {
          await savePoolsToDb();
          renderPools();
        } catch (err) {
          alert(err.message || "Could not save pool movement.");
        }
      });
    }

    wireDropzone(unassignedTeams, "unassigned");
    (captainState.pools.unassigned || []).forEach((teamKey) => {
      const card = createTeamCard(teamKey);
      if (card) unassignedTeams.appendChild(card);
    });

    Object.keys(captainState.pools.groups).forEach((poolName) => {
      const col = document.createElement("div");
      col.className = "pool-column";
      col.innerHTML = `<h3>${escapeHtml(poolName)}</h3><div class="team-dropzone" data-pool="${escapeHtml(poolName)}"></div>`;
      const dropzone = col.querySelector(".team-dropzone");
      wireDropzone(dropzone, poolName);
      (captainState.pools.groups[poolName] || []).forEach((teamKey) => {
        const card = createTeamCard(teamKey);
        if (card) dropzone.appendChild(card);
      });
      poolsGrid.appendChild(col);
    });
  }

    async function loadLeaderboardFromDb() {
      if (isTournamentTeamEvent()) {
        leaderboardState.rows = buildTeamLeaderboardRowsFromFixtures();
        return;
      }

      const categoryId = String(
        activeFilter === "all"
          ? (tournamentCategories?.[0]?.categoryId || tournamentCategories?.[0]?.id || "")
          : activeFilter
      );

      if (!categoryId) {
        leaderboardState.rows = [];
        return;
      }

      const r = await apiGet(
        `/api/host/tournaments/${encodeURIComponent(tournamentId)}/leaderboard?categoryId=${encodeURIComponent(categoryId)}`
      );

      leaderboardState.rows = r.ok
        ? Array.isArray(r.data?.rows)
          ? r.data.rows
          : Array.isArray(r.data)
            ? r.data
            : []
        : [];
    }

    function renderLeaderboard() {
      if (!leaderboardSection || !leaderboardTableBody) return;

      if (isTournamentTeamEvent()) {
        leaderboardState.rows = buildTeamLeaderboardRowsFromFixtures();
      }

      leaderboardTableBody.innerHTML = "";

      if (!leaderboardState.rows.length) {
        leaderboardTableBody.innerHTML = `<tr><td colspan="5" class="muted">No leaderboard data yet.</td></tr>`;
        updateGoToKnockoutButton();
        return;
      }

      leaderboardState.rows.forEach((row, idx) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${escapeHtml(row.rank ?? idx + 1)}</td>
          <td>${escapeHtml(row.teamName || row.team || "—")}</td>
          <td>${escapeHtml(row.matchPoints ?? 0)}</td>
          <td>${escapeHtml(row.matchesPlayed ?? 0)}</td>
          <td>${escapeHtml(row.qualified ? "Yes" : "No")}</td>
        `;
        leaderboardTableBody.appendChild(tr);
      });

      updateGoToKnockoutButton();
    }

  function makeMatchId() {
    if (window.crypto && crypto.randomUUID) return "M-" + crypto.randomUUID();
    return "M-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function splitTeamName(teamName) {
    const t = String(teamName || "").trim();
    const up = t.toUpperCase();
    if (!t || up === "BYE" || up === "TBD") return [];
    return t.split(" + ").map((x) => x.trim()).filter(Boolean);
  }

  function ensureMatchMeta(match) {
    if (!match || typeof match !== "object") return match;
    if (!match.matchId) match.matchId = makeMatchId();
    if (!Array.isArray(match.homePlayers)) match.homePlayers = splitTeamName(match.home);
    if (!Array.isArray(match.awayPlayers)) match.awayPlayers = splitTeamName(match.away);
    return match;
  }

  function nextPow2(n) {
    let p = 1;
    while (p < n) p *= 2;
    return p;
  }

  function getRoundLabel(r, totalRounds) {
    if (totalRounds <= 0) return "Round";
    const remaining = totalRounds - r;
    if (remaining === 1) return "Final";
    if (remaining === 2) return "Semi-final";
    if (remaining === 3) return "Quarter-final";
    return `Round ${r + 1}`;
  }

  function buildEntrants(names, teamSize) {
    const size = Math.max(1, Number(teamSize || 1));
    const shuffled = shuffle(names);
    const entrants = [];
    const teamMap = {};

    if (size === 1) {
      shuffled.forEach((name) => {
        teamMap[name] = [name];
      });
      return { entrants: shuffled, teamMap };
    }

    for (let i = 0; i < shuffled.length; i += size) {
      const chunk = shuffled.slice(i, i + size);
      if (chunk.length < size) continue;
      const teamName = chunk.join(" + ");
      entrants.push(teamName);
      teamMap[teamName] = chunk;
    }

    return { entrants, teamMap };
  }

  function createBracket(names, teamMap = {}) {
    const list = shuffle(names.filter(Boolean));
    if (list.length < 2) return null;

    const size = nextPow2(list.length);
    while (list.length < size) list.push("BYE");

    const totalRounds = Math.log2(size);
    const rounds = [];

    function rosterOf(name) {
      if (!name || name === "BYE" || name === "TBD") return [];
      return teamMap[name] || splitTeamName(name);
    }

    const round1 = [];
    for (let i = 0; i < list.length; i += 2) {
      round1.push(ensureMatchMeta({
        home: list[i],
        away: list[i + 1],
        homePlayers: rosterOf(list[i]),
        awayPlayers: rosterOf(list[i + 1]),
      }));
    }
    rounds.push(round1);

    for (let r = 1; r < totalRounds; r += 1) {
      const prev = rounds[r - 1];
      const next = [];
      for (let i = 0; i < prev.length; i += 2) {
        next.push(ensureMatchMeta({ home: "TBD", away: "TBD", homePlayers: [], awayPlayers: [] }));
      }
      rounds.push(next);
    }

    return { rounds, totalRounds };
  }

  function computeAcceptedByCategory() {
    const accepted = getAcceptedPlayers();
    const map = {};
    tournamentCategories.forEach((c) => {
      const cid = c.categoryId || c.id;
      map[cid] = accepted
        .filter((p) => String(getPlayerCategoryId(p)) === String(cid))
        .map((p) => getPlayerDisplayName(p));
    });
    fixturesState.acceptedByCategory = map;
  }

  function getFixtureEntrantsForCategory(categoryMeta) {
    const cid = categoryMeta?.categoryId || categoryMeta?.id;
    if (!cid) return { entrants: [], teamMap: {}, sourceCount: 0 };

    if (isTournamentTeamEvent()) {
      const teams = getConfirmedTeams().filter((team) => team.teamStatus !== "rejected");
      const entrants = teams.map((team) => team.teamName).filter(Boolean);
      const teamMap = {};
      teams.forEach((team) => { teamMap[team.teamName] = [team.teamName]; });
      return { entrants, teamMap, sourceCount: entrants.length };
    }

    const names = fixturesState.acceptedByCategory[cid] || [];
    const teamSize = Number(categoryMeta?.teamSize || 1);
    const { entrants, teamMap } = buildEntrants(names, teamSize);
    return { entrants, teamMap, sourceCount: names.length };
  }

  async function loadFixturesFromDb() {
  const urls = [
    `/api/tournaments/${encodeURIComponent(tournamentId)}/fixtures`,
    `/api/host/tournaments/${encodeURIComponent(tournamentId)}/fixtures`,
  ];

  for (const url of urls) {
    const r = await apiGet(url);
    if (!r.ok) continue;

    const parsed = r.data?.data || r.data;
    if (parsed?.categories) return parsed;
  }

  return null;
}

  async function persistFixturesState() {
    const r = await apiPost(`/api/host/tournaments/${encodeURIComponent(tournamentId)}/fixtures/update`, fixturesState.fixtures || { categories: {} });
    if (!r.ok) throw new Error(r.data?.message || "Failed to save fixtures");
    fixturesState.fixtures = migrateFixtures(r.data || fixturesState.fixtures || { categories: {} });
  }

  function migrateFixtures(fixturesObj) {
    if (!fixturesObj?.categories) return fixturesObj;
    Object.values(fixturesObj.categories).forEach((cat) => {
      if (!cat) return;
      if (Array.isArray(cat.matches)) {
        cat.matches = cat.matches.map((m) => ensureMatchMeta(m));
      }
      if (Array.isArray(cat.rounds)) {
        cat.rounds.forEach((round) => {
          if (!Array.isArray(round)) return;
          round.forEach((match) => ensureMatchMeta(match));
        });
      }
    });
    return fixturesObj;
  }

  function renderCategoryToggles() {
    if (!fixturesUi.toggleWrap) return;
    if (isTournamentTeamEvent()) {
      fixturesUi.toggleWrap.innerHTML = "";
      fixturesUi.toggleWrap.classList.add("hidden");
      return;
    }

    fixturesUi.toggleWrap.classList.remove("hidden");
    fixturesUi.toggleWrap.innerHTML = "";
    const catList = fixturesState.categories
      .map((c) => ({ id: c.categoryId || c.id, label: categoryLabel(c) }))
      .filter((x) => x.id);

    if (!catList.length) {
      fixturesUi.toggleWrap.innerHTML = `<div class="muted">No categories found.</div>`;
      return;
    }

    catList.forEach((cat) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `toggle-btn ${String(fixturesState.activeCategoryId) === String(cat.id) ? "active" : ""}`;
      btn.textContent = cat.label;
      btn.addEventListener("click", () => {
        fixturesState.activeCategoryId = cat.id;
        renderCategoryToggles();
        fixturesUi.noneSelectedEl.style.display = "none";
        renderCategoryBracket(cat.id);
      });
      fixturesUi.toggleWrap.appendChild(btn);
    });
  }

  function buildFixtureCard(match, roundIndex, matchIndex, categoryId) {
    const home = match?.home ?? "BYE";
    const away = match?.away ?? "BYE";
    const homeBye = String(home).toUpperCase() === "BYE";
    const awayBye = String(away).toUpperCase() === "BYE";
    return `
      <div class="bk-card">
        <div class="fixture-line"><span>${escapeHtml(home)}</span></div>
        <div class="fixture-line"><span>${escapeHtml(away)}</span></div>
        <div class="fixture-actions">
          ${!homeBye && !awayBye ? `
            <button
              type="button"
              class="start-scoring-btn btn-dark"
              data-tournament-id="${escapeHtml(tournamentId)}"
              data-category-id="${escapeHtml(categoryId)}"
              data-round="${roundIndex}"
              data-match="${matchIndex}"
            >Start scoring</button>` : ""}
        </div>
      </div>
    `;
  }

  function getDisplayRoundLabel(cat, round, roundIndex) {
    const explicit = Array.isArray(round) ? round.find((m) => m?.roundLabel)?.roundLabel : "";
    if (explicit) return explicit;
    return getRoundLabel(roundIndex, cat?.totalRounds || cat?.rounds?.length || 0);
  }

  function renderIndividualCategoryFixtures(categoryId) {
    fixturesUi.groupsEl.innerHTML = "";
    const cat = fixturesState.fixtures?.categories?.[categoryId];
    const categoryMeta = fixturesState.categories.find((c) => String(c.categoryId || c.id) === String(categoryId));

    if (!cat || !Array.isArray(cat.rounds) || !cat.rounds.length) {
      const entrantInfo = categoryMeta ? getFixtureEntrantsForCategory(categoryMeta) : { sourceCount: 0 };
      fixturesUi.groupsEl.innerHTML = `
        <div class="empty-state" style="display:flex;">
          <div class="feature-icon">🧩</div>
          <h3>No fixtures yet</h3>
          <p class="muted">${entrantInfo.sourceCount < 2 ? "Not enough accepted players to generate fixtures." : "Click “Regenerate fixtures” to create the fixtures."}</p>
        </div>
      `;
      updateFixturesEditButtonState();
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "fixtures-group";
    const title = document.createElement("h3");
    title.className = "fixtures-group-title";
    title.textContent = cat.label || categoryLabel(categoryMeta || {}) || "Category";
    wrapper.appendChild(title);

    const roundsWrap = document.createElement("div");
    roundsWrap.className = "fixtures-rounds";
    cat.rounds.forEach((round, roundIndex) => {
      const col = document.createElement("div");
      col.className = "fixtures-round-col";
      col.innerHTML = `<div class="round-title">${escapeHtml(getDisplayRoundLabel(cat, round, roundIndex))}</div>`;
      round.forEach((match, matchIndex) => {
        const item = document.createElement("div");
        item.className = "fixtures-round-match";
        item.innerHTML = buildFixtureCard(match, roundIndex, matchIndex, categoryId);
        col.appendChild(item);
      });
      roundsWrap.appendChild(col);
    });

    wrapper.appendChild(roundsWrap);
    fixturesUi.groupsEl.appendChild(wrapper);
    updateFixturesEditButtonState();
  }

  function getPairKey(a, b) {
    return [a, b].sort().join("::");
  }

  function buildBalancedLeaguePairs(teamNames, requestedMatches) {
    const names = shuffle(teamNames.filter(Boolean));
    const teamCount = names.length;
    if (teamCount < 2) return { pairs: [], matchesPerTeam: 0 };

    let matchesPerTeam = Math.min(Math.max(1, Number(requestedMatches || 0)), teamCount - 1);
    if ((teamCount * matchesPerTeam) % 2 !== 0) matchesPerTeam -= 1;
    if (matchesPerTeam < 1) return { pairs: [], matchesPerTeam: 0 };

    const allPairs = [];
    for (let i = 0; i < names.length; i += 1) {
      for (let j = i + 1; j < names.length; j += 1) {
        allPairs.push([names[i], names[j]]);
      }
    }

    let bestPairs = [];
    let bestScore = -1;
    for (let attempt = 0; attempt < 500; attempt += 1) {
      const counts = Object.fromEntries(names.map((name) => [name, 0]));
      const selected = [];
      const seen = new Set();
      for (const [a, b] of shuffle(allPairs)) {
        const key = getPairKey(a, b);
        if (seen.has(key)) continue;
        if (counts[a] >= matchesPerTeam || counts[b] >= matchesPerTeam) continue;
        selected.push({ home: a, away: b });
        counts[a] += 1;
        counts[b] += 1;
        seen.add(key);
      }
      const score = names.reduce((sum, name) => sum + counts[name], 0);
      if (score > bestScore) {
        bestScore = score;
        bestPairs = selected;
      }
      if (names.every((name) => counts[name] === matchesPerTeam)) break;
    }

    return { pairs: bestPairs, matchesPerTeam };
  }

  function scheduleLeaguePairs(pairs, courtNames, baseDate) {
    const matchDurationMs = 2 * 60 * 60 * 1000;
    const courts = [...new Set((courtNames || []).filter(Boolean))];
    const usableCourts = courts.length ? courts : ["Court 1"];
    const teamNext = new Map();
    const courtNext = new Map();
    const teamCourtHistory = new Map();
    const teamLastCourt = new Map();
    const courtUsageCounts = new Map();
    const baseTs = baseDate.getTime();

    usableCourts.forEach((court) => {
      courtNext.set(court, baseTs);
      courtUsageCounts.set(court, 0);
    });

    return pairs.map((pair, index) => {
      let bestChoice = null;

      usableCourts.forEach((court, courtIdx) => {
        const start = Math.max(
          baseTs,
          teamNext.get(pair.home) || baseTs,
          teamNext.get(pair.away) || baseTs,
          courtNext.get(court) || baseTs
        );

        const homeHistory = teamCourtHistory.get(pair.home) || new Set();
        const awayHistory = teamCourtHistory.get(pair.away) || new Set();
        const homeLastCourt = teamLastCourt.get(pair.home) || "";
        const awayLastCourt = teamLastCourt.get(pair.away) || "";

        let penalty = 0;
        if (homeHistory.has(court)) penalty += 2;
        if (awayHistory.has(court)) penalty += 2;
        if (homeLastCourt === court) penalty += 1;
        if (awayLastCourt === court) penalty += 1;

        const candidate = {
          court,
          start,
          penalty,
          usage: courtUsageCounts.get(court) || 0,
          courtIdx,
        };

        if (
          !bestChoice ||
          candidate.penalty < bestChoice.penalty ||
          (candidate.penalty === bestChoice.penalty && candidate.start < bestChoice.start) ||
          (candidate.penalty === bestChoice.penalty && candidate.start === bestChoice.start && candidate.usage < bestChoice.usage) ||
          (candidate.penalty === bestChoice.penalty && candidate.start === bestChoice.start && candidate.usage === bestChoice.usage && candidate.courtIdx < bestChoice.courtIdx)
        ) {
          bestChoice = candidate;
        }
      });

      const chosenCourt = bestChoice?.court || usableCourts[0];
      const chosenStart = bestChoice?.start || baseTs;
      const end = chosenStart + matchDurationMs;

      teamNext.set(pair.home, end);
      teamNext.set(pair.away, end);
      courtNext.set(chosenCourt, end);
      courtUsageCounts.set(chosenCourt, (courtUsageCounts.get(chosenCourt) || 0) + 1);

      if (!teamCourtHistory.has(pair.home)) teamCourtHistory.set(pair.home, new Set());
      if (!teamCourtHistory.has(pair.away)) teamCourtHistory.set(pair.away, new Set());
      teamCourtHistory.get(pair.home).add(chosenCourt);
      teamCourtHistory.get(pair.away).add(chosenCourt);
      teamLastCourt.set(pair.home, chosenCourt);
      teamLastCourt.set(pair.away, chosenCourt);

      const dt = new Date(chosenStart);
      return ensureMatchMeta({
        matchId: makeMatchId(),
        matchNo: index + 1,
        home: pair.home,
        away: pair.away,
        homePlayers: [pair.home],
        awayPlayers: [pair.away],
        date: formatDateInputValue(dt),
        time: formatTimeInputValue(dt),
        court: chosenCourt,
        stage: "league",
        roundLabel: `League Match ${index + 1}`,
      });
    });
  }

  function chunkTeamsNearlyEqual(teamNames, groupCount) {
    const teams = shuffle([...teamNames].filter(Boolean));
    const groups = Array.from({ length: groupCount }, (_, idx) => ({
      groupIndex: idx,
      groupName: `Group ${String.fromCharCode(65 + idx)}`,
      teams: [],
    }));

    teams.forEach((team, idx) => {
      groups[idx % groupCount].teams.push(team);
    });

    return groups;
  }

  function buildFullRoundRobinPairs(teamNames) {
    const names = [...teamNames].filter(Boolean);
    const pairs = [];

    for (let i = 0; i < names.length; i += 1) {
      for (let j = i + 1; j < names.length; j += 1) {
        pairs.push({ home: names[i], away: names[j] });
      }
    }

    return shuffle(pairs);
  }

  function buildGroupRoundRobinSchedule(groups, courtNames, baseDate) {
    const allRounds = [];
    const groupMeta = [];

    let runningBase = new Date(baseDate.getTime());

    groups.forEach((group) => {
      const pairs = buildFullRoundRobinPairs(group.teams);
      const scheduledMatches = scheduleLeaguePairs(
        pairs,
        shuffle(courtNames),
        runningBase
      );

      allRounds.push(scheduledMatches);

      groupMeta.push({
        groupIndex: group.groupIndex,
        groupName: group.groupName,
        teamNames: [...group.teams],
        roundIndex: allRounds.length - 1,
        qualifierCount: 2,
      });

      if (scheduledMatches.length) {
        const latestStart = scheduledMatches.reduce((maxTs, match) => {
          const dt = new Date(`${match.matchDate}T${match.matchTime || "09:00"}`);
          const ts = dt.getTime();
          return Number.isFinite(ts) ? Math.max(maxTs, ts) : maxTs;
        }, runningBase.getTime());

        runningBase = new Date(latestStart + 24 * 60 * 60 * 1000);
      }
    });

    return { rounds: allRounds, groupMeta };
  }

  function isTeamRoundRobinFormat() {
    return String(tournamentMetaCache?.stageFormat || "") === "round_robin";
  }

  function isTeamGroupKnockoutFormat() {
    return String(tournamentMetaCache?.stageFormat || "") === "group_knockout";
  }

  function getGroupLeaderboardRows(cat, roundIndex) {
    const roundMatches = Array.isArray(cat?.rounds?.[roundIndex]) ? cat.rounds[roundIndex] : [];
    const stats = new Map();

    function ensureTeam(teamName) {
      const key = String(teamName || "").trim();
      if (!key || key === "BYE" || key === "TBD") return null;

      if (!stats.has(key)) {
        stats.set(key, {
          teamName: key,
          rank: 0,
          matchPoints: 0,
          matchesPlayed: 0,
          qualified: false,
        });
      }

      return stats.get(key);
    }

    roundMatches.forEach((match, matchIndex) => {
      const home = ensureTeam(match?.home);
      const away = ensureTeam(match?.away);
      if (!home || !away) return;

      const status = getMatchStatus(match, roundIndex, matchIndex);
      if (status !== "completed") return;

      home.matchesPlayed += 1;
      away.matchesPlayed += 1;

      home.matchPoints += Number(getFixtureMatchPoints(match, "home") || 0);
      away.matchPoints += Number(getFixtureMatchPoints(match, "away") || 0);
    });

    const rows = [...stats.values()].sort((a, b) => {
      if (Number(b.matchPoints || 0) !== Number(a.matchPoints || 0)) {
        return Number(b.matchPoints || 0) - Number(a.matchPoints || 0);
      }
      if (Number(b.matchesPlayed || 0) !== Number(a.matchesPlayed || 0)) {
        return Number(b.matchesPlayed || 0) - Number(a.matchesPlayed || 0);
      }
      return String(a.teamName || "").localeCompare(String(b.teamName || ""));
    });

    return rows.map((row, index) => ({
      ...row,
      rank: index + 1,
    }));
  }

  function getQualifiedTeamsFromGroups(cat) {
    const groups = Array.isArray(cat?.groups) ? cat.groups : [];
    const qualified = [];

    groups.forEach((group) => {
      const rows = getGroupLeaderboardRows(cat, group.roundIndex);
      const top = rows.slice(0, Number(group.qualifierCount || 2));
      top.forEach((row) => {
        if (row?.teamName) qualified.push(row.teamName);
      });
    });

    return qualified;
  }

  function canGenerateGroupKnockout(cat) {
    if (!cat || !isTeamGroupKnockoutFormat()) return false;
    const groups = Array.isArray(cat?.groups) ? cat.groups : [];
    if (!groups.length || cat.knockout) return false;

    return groups.every((group) => {
      const matches = Array.isArray(cat.rounds?.[group.roundIndex]) ? cat.rounds[group.roundIndex] : [];
      return matches.length && matches.every((match, index) => getMatchStatus(match, group.roundIndex, index) === "completed");
    });
  }

  function buildKnockoutBracketMarkup(knockout, categoryId = TEAM_EVENT_CATEGORY_ID) {
    if (!knockout || !Array.isArray(knockout.rounds) || !knockout.rounds.length) return "";

    const roundsHtml = knockout.rounds.map((round, roundIndex) => `
      <div class="fixtures-round-col">
        <div class="round-title">${escapeHtml(getRoundLabel(roundIndex, knockout.totalRounds || knockout.rounds.length))}</div>
        ${(Array.isArray(round) ? round : []).map((match, matchIndex) => `
          <div class="fixtures-round-match">
            <div class="bk-card">
              <div class="fixture-line"><span>${escapeHtml(match?.home || "TBD")}</span></div>
              <div class="fixture-line"><span>${escapeHtml(match?.away || "TBD")}</span></div>
              <div class="fixture-line"><span>Status</span><span>${getStatusPillMarkup(getMatchStatus(match, roundIndex + 1, matchIndex))}</span></div>
              <div class="fixture-actions">
                ${(String(match?.home || '').toUpperCase() !== 'BYE' && String(match?.away || '').toUpperCase() !== 'BYE' && String(match?.home || '').toUpperCase() !== 'TBD' && String(match?.away || '').toUpperCase() !== 'TBD')
                  ? `<button type="button" class="action-btn accept start-scoring-btn" data-tournament-id="${escapeHtml(tournamentId)}" data-category-id="${escapeHtml(categoryId)}" data-round="${roundIndex + 1}" data-match="${matchIndex}">Start scoring</button>`
                  : ''}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `).join('');

    return `
      <div class="fixtures-group" style="margin-top: 18px;">
        <h3 class="fixtures-group-title">Knockout schedule</h3>
        <div class="fixtures-rounds">${roundsHtml}</div>
      </div>
    `;
  }

  function renderTeamEventScheduleTable(cat) {
    const sourceMatches = Array.isArray(cat?.matches)
      ? cat.matches
      : Array.isArray(cat?.rounds?.[0])
        ? cat.rounds[0]
        : [];

    const matches = sourceMatches.filter(
      (match) => String(match?.stage || "league").toLowerCase() !== "knockout"
    );

    if (!matches.length) {
      fixturesUi.groupsEl.innerHTML = `
        <div class="empty-state" style="display:flex;">
          <div class="feature-icon">🗓️</div>
          <h3>No team fixtures yet</h3>
          <p class="muted">Click “Regenerate fixtures” to create the team match schedule.</p>
        </div>
      `;
      updateFixturesEditButtonState();
      updateGoToKnockoutButton(cat);
      return;
    }

    const editing = Boolean(fixturesState.bulkEditMode);

    console.log("TEAM CAT FULL", cat);
    console.log("TEAM CAT KNOCKOUT", cat?.knockout);
    
    const knockoutSource =
      cat?.knockout ||
      (
        Array.isArray(cat?.rounds) && cat.rounds.length > 1
          ? {
              rounds: cat.rounds.slice(1),
              totalRounds: Math.max(0, cat.rounds.length - 1),
              label: "Knockout",
            }
          : null
      );

    const knockoutMarkup = buildKnockoutBracketMarkup(knockoutSource, TEAM_EVENT_CATEGORY_ID);

    fixturesUi.groupsEl.innerHTML = `
      <div class="fixtures-group">
        <h3 class="fixtures-group-title">${escapeHtml(cat?.label || "League schedule")}</h3>
        <div class="players-table-wrapper">
          <table class="players-table">
            <thead>
              <tr>
                <th>Match no</th>
                <th>Team 1</th>
                <th>Team 2</th>
                <th>Date</th>
                <th>Time</th>
                <th>Court</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${matches.map((match, index) => {
                const team1Cell = editing
                  ? `
                    <select class="schedule-edit-input" data-edit-field="home" data-index="${index}">
                      <option value="">Select team</option>
                      ${buildTeamNameSelectOptions(match.home || "")}
                    </select>
                  `
                  : escapeHtml(match.home || "—");

                const team2Cell = editing
                  ? `
                    <select class="schedule-edit-input" data-edit-field="away" data-index="${index}">
                      <option value="">Select team</option>
                      ${buildTeamNameSelectOptions(match.away || "")}
                    </select>
                  `
                  : escapeHtml(match.away || "—");
                const dateCell = editing
                  ? `<input class="schedule-edit-input" type="date" data-edit-field="date" data-index="${index}" value="${escapeHtml(match.date || "")}" />`
                  : escapeHtml(match.date || "—");
                const timeCell = editing
                  ? `<input class="schedule-edit-input" type="time" data-edit-field="time" data-index="${index}" value="${escapeHtml(match.time || "")}" />`
                  : escapeHtml(match.time || "—");
                const courtCell = editing
                  ? `<input class="schedule-edit-input" type="text" data-edit-field="court" data-index="${index}" value="${escapeHtml(match.court || "")}" placeholder="Court name" />`
                  : escapeHtml(match.court || "—");
                const status = getMatchStatus(match, 0, index);
                const canScore = !editing && String(match.home || '').toUpperCase() !== 'BYE' && String(match.away || '').toUpperCase() !== 'BYE' && String(match.home || '').toUpperCase() !== 'TBD' && String(match.away || '').toUpperCase() !== 'TBD';
                return `
                  <tr>
                    <td>${escapeHtml(match.matchNo || index + 1)}</td>
                    <td>${team1Cell}</td>
                    <td>${team2Cell}</td>
                    <td>${dateCell}</td>
                    <td>${timeCell}</td>
                    <td>${courtCell}</td>
                    <td>${getStatusPillMarkup(status)}</td>
                    <td>
                      <div class="row-actions">
                        ${editing
                          ? `<span class="captain-summary-meta">Editing…</span>`
                          : canScore
                            ? `<button type="button" class="action-btn accept start-scoring-btn" data-tournament-id="${escapeHtml(tournamentId)}" data-category-id="${escapeHtml(TEAM_EVENT_CATEGORY_ID)}" data-round="0" data-match="${index}">Start scoring</button>`
                            : `<span class="captain-summary-meta">—</span>`}
                      </div>
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>
      ${knockoutMarkup}
    `;
    updateFixturesEditButtonState();
    updateGoToKnockoutButton(cat);
  }

  async function saveAllTeamScheduleEdits() {
    const cat = getTeamEventFixtureBucket();
    if (!cat) return;

    const matches = Array.isArray(cat.matches)
      ? cat.matches
      : Array.isArray(cat.rounds?.[0])
        ? cat.rounds[0]
        : [];

    matches.forEach((match, index) => {
      const root = fixturesUi.groupsEl;
      const home = root?.querySelector(`[data-edit-field="home"][data-index="${index}"]`)?.value?.trim() || match.home || "";
      const away = root?.querySelector(`[data-edit-field="away"][data-index="${index}"]`)?.value?.trim() || match.away || "";
      const date = root?.querySelector(`input[data-edit-field="date"][data-index="${index}"]`)?.value || match.date || "";
      const time = root?.querySelector(`input[data-edit-field="time"][data-index="${index}"]`)?.value || match.time || "";
      const court = root?.querySelector(`input[data-edit-field="court"][data-index="${index}"]`)?.value?.trim() || match.court || "";

      match.home = home;
      match.away = away;
      match.homePlayers = home ? [home] : [];
      match.awayPlayers = away ? [away] : [];
      match.date = date;
      match.time = time;
      match.court = court;
    });

    cat.matches = matches;
    cat.rounds = [matches];

    await persistFixturesState();
    fixturesState.bulkEditMode = false;
    renderTeamEventScheduleTable(getTeamEventFixtureBucket());
    showToast("Fixtures updated");
  }

  async function handleTeamScheduleAction(action, index) {
    if (action === "save_all") {
      try {
        await saveAllTeamScheduleEdits();
      } catch (err) {
        alert(err.message || "Could not save fixtures.");
      }
    }
  }

  function renderTeamEventFixtures() {
    fixturesUi.groupsEl.innerHTML = "";
    const cat = getTeamEventFixtureBucket();
    if (!cat) {
      const teams = getConfirmedTeams().filter((team) => team.teamStatus !== "rejected");
      fixturesUi.groupsEl.innerHTML = `
        <div class="empty-state" style="display:flex;">
          <div class="feature-icon">🧩</div>
          <h3>No fixtures yet</h3>
          <p class="muted">${teams.length < 2 ? "Not enough confirmed teams to generate fixtures." : "Click “Regenerate fixtures” to create the team fixtures."}</p>
        </div>
      `;
      updateFixturesEditButtonState();
      updateGoToKnockoutButton(cat);
      return;
    }

    if (cat.displayMode === "team_schedule") {
      renderTeamEventScheduleTable(cat);
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "fixtures-group";
    const title = document.createElement("h3");
    title.className = "fixtures-group-title";
    title.textContent = cat.label || "Team fixtures";
    wrapper.appendChild(title);

    const roundsWrap = document.createElement("div");
    roundsWrap.className = "fixtures-rounds";
    (cat.rounds || []).forEach((round, roundIndex) => {
      const col = document.createElement("div");
      col.className = "fixtures-round-col";
      col.innerHTML = `<div class="round-title">${escapeHtml(getDisplayRoundLabel(cat, round, roundIndex))}</div>`;
      round.forEach((match, matchIndex) => {
        const item = document.createElement("div");
        item.className = "fixtures-round-match";
        item.innerHTML = buildFixtureCard(match, roundIndex, matchIndex, TEAM_EVENT_CATEGORY_ID);
        col.appendChild(item);
      });
      roundsWrap.appendChild(col);
    });

    wrapper.appendChild(roundsWrap);
    fixturesUi.groupsEl.appendChild(wrapper);
    updateFixturesEditButtonState();
    updateGoToKnockoutButton(cat);
  }

  function renderCategoryBracket(categoryId) {
    if (isTournamentTeamEvent()) {
      renderTeamEventFixtures();
      return;
    }
    renderIndividualCategoryFixtures(categoryId);
  }

  async function generateAndSaveFixtures() {
    if (!fixturesState.categories.length && !isTournamentTeamEvent()) {
      showToast("No categories found");
      return;
    }

    // TEAM EVENT LOGIC
    if (isTournamentTeamEvent()) {
      const teams = getConfirmedTeams();
      if (teams.length < 2) {
        showToast("Not enough confirmed teams to regenerate fixtures");
        return;
      }

      const teamNames = teams.map((team) => team.teamName).filter(Boolean);
      const courtNames = shuffle(getAvailableCourtNames());
      const startDate = getTournamentStartDate();
      const stageFormat = String(tournamentMetaCache?.stageFormat || "").trim();

      // TEAM + ROUND ROBIN
      if (stageFormat === "round_robin") {
        const pairs = buildFullRoundRobinPairs(teamNames);
        if (!pairs.length) {
          showToast("Could not build round robin fixtures");
          return;
        }

        const scheduledMatches = scheduleLeaguePairs(pairs, courtNames, startDate);

        fixturesState.bulkEditMode = false;
        fixturesState.fixtures = migrateFixtures({
          tournamentType: "team",
          teamCategories: tournamentCategories,
          categories: {
            [TEAM_EVENT_CATEGORY_ID]: {
              categoryId: TEAM_EVENT_CATEGORY_ID,
              label: "League schedule",
              displayMode: "team_schedule",
              stageFormat: "round_robin",
              rounds: [scheduledMatches],
              matches: scheduledMatches,
              totalRounds: 1,
            },
          },
        });

        try {
          await persistFixturesState();
          showToast("Round robin fixtures generated");
          renderTeamEventFixtures();
        } catch (err) {
          alert(err.message || "Could not save round robin fixtures.");
        }
        return;
      }

      // TEAM + GROUP + KNOCKOUT
      if (stageFormat === "group_knockout") {
        const requestedGroupCount = Math.max(
          2,
          Number(tournamentMetaCache?.groupCount || 0) || 2
        );

        const groups = chunkTeamsNearlyEqual(teamNames, requestedGroupCount)
          .filter((group) => group.teams.length >= 2);

        if (!groups.length) {
          showToast("Not enough teams to create group fixtures");
          return;
        }

        const { rounds, groupMeta } = buildGroupRoundRobinSchedule(groups, courtNames, startDate);

        fixturesState.bulkEditMode = false;
        fixturesState.fixtures = migrateFixtures({
          tournamentType: "team",
          teamCategories: tournamentCategories,
          categories: {
            [TEAM_EVENT_CATEGORY_ID]: {
              categoryId: TEAM_EVENT_CATEGORY_ID,
              label: "Group fixtures",
              displayMode: "team_schedule",
              stageFormat: "group_knockout",
              rounds,
              matches: rounds[0] || [],
              totalRounds: rounds.length,
              groups: groupMeta,
              knockout: null,
            },
          },
        });

        try {
          await persistFixturesState();
          showToast("Group fixtures generated");
          renderTeamEventFixtures();
        } catch (err) {
          alert(err.message || "Could not save group fixtures.");
        }
        return;
      }

      // TEAM + ROUND ROBIN + KNOCKOUT
      if (stageFormat === "round_robin_knockout") {
        const requestedRounds = getRequestedLeagueRounds() || 1;
        const { pairs, matchesPerTeam } = buildBalancedLeaguePairs(teamNames, requestedRounds);
        if (!pairs.length) {
          showToast("Could not build league fixtures for the selected number of rounds");
          return;
        }

        const scheduledMatches = scheduleLeaguePairs(pairs, courtNames, startDate);

        fixturesState.bulkEditMode = false;
        fixturesState.fixtures = migrateFixtures({
          tournamentType: "team",
          teamCategories: tournamentCategories,
          categories: {
            [TEAM_EVENT_CATEGORY_ID]: {
              categoryId: TEAM_EVENT_CATEGORY_ID,
              label: `League schedule • ${matchesPerTeam} matches per team`,
              displayMode: "team_schedule",
              stageFormat: "round_robin_knockout",
              rounds: [scheduledMatches],
              matches: scheduledMatches,
              totalRounds: 1,
            },
          },
        });

        try {
          await persistFixturesState();
          showToast("League fixtures generated");
          renderTeamEventFixtures();
        } catch (err) {
          alert(err.message || "Could not save league fixtures.");
        }
        return;
      }

      // TEAM FALLBACK => bracket
      const teamMap = {};
      const entrants = teamNames.map((teamName) => {
        teamMap[teamName] = [teamName];
        return teamName;
      });

      const bracket = createBracket(entrants, teamMap);
      if (!bracket) {
        showToast("Not enough confirmed teams to regenerate fixtures");
        return;
      }

      fixturesState.bulkEditMode = false;
      fixturesState.fixtures = migrateFixtures({
        tournamentType: "team",
        teamCategories: tournamentCategories,
        categories: {
          [TEAM_EVENT_CATEGORY_ID]: {
            categoryId: TEAM_EVENT_CATEGORY_ID,
            label: "Team fixtures",
            displayMode: "team_bracket",
            ...bracket,
          },
        },
      });

      try {
        await persistFixturesState();
        showToast("Team fixtures regenerated");
        renderTeamEventFixtures();
      } catch (err) {
        alert(err.message || "Could not save fixtures.");
      }
      return;
    }

    // INDIVIDUAL EVENT LOGIC (keep category-wise brackets)
    const categoriesPayload = {};
    const teamMap = buildPartnerTeamsFromAcceptedPlayers();

    fixturesState.categories.forEach((category) => {
      const entrants = getFixtureEntrantsForCategory(category);
      const bracket = createBracket(entrants, teamMap);
      if (!bracket) return;

      categoriesPayload[category.categoryId] = {
        categoryId: category.categoryId,
        label: category.label,
        ...bracket,
      };
    });

    if (!Object.keys(categoriesPayload).length) {
      showToast("Not enough accepted players to generate fixtures");
      return;
    }

    fixturesState.bulkEditMode = false;
    fixturesState.fixtures = migrateFixtures({
      tournamentType: "single",
      categories: categoriesPayload,
    });

    try {
      await persistFixturesState();
      showToast("Fixtures regenerated");
      renderFixtures();
    } catch (err) {
      alert(err.message || "Could not save fixtures.");
    }
  }

  async function generateKnockoutFromLeaderboard() {
    const cat = getTeamEventFixtureBucket();
    if (!cat) {
      showToast("Fixtures not found");
      return;
    }

    let teamNames = [];

    if (isTeamGroupKnockoutFormat()) {
      if (!canGenerateGroupKnockout(cat)) {
        showToast("Complete all group matches first");
        return;
      }

      teamNames = getQualifiedTeamsFromGroups(cat);
    } else {
      if (!cat || !canGenerateKnockout(cat)) {
        showToast("Complete all league matches first");
        return;
      }

      const qualifiedRows = getQualifiedLeaderboardRows();
      teamNames = qualifiedRows
        .map((row) => String(row?.teamName || row?.team || "").trim())
        .filter(Boolean);
    }

    if (teamNames.length < 2) {
      showToast("Not enough qualified teams for knockout");
      return;
    }

    const knockout = buildSeededKnockoutRounds(teamNames);
    if (!knockout) {
      showToast("Could not generate knockout schedule");
      return;
    }

    knockout.label = `Knockout • ${teamNames.length} qualified teams`;
    knockout.qualifiedTeams = teamNames;
    autoAdvanceKnockoutByes(knockout);

    cat.knockout = knockout;

    if (isTeamGroupKnockoutFormat()) {
      cat.rounds = [...(cat.rounds || []), ...knockout.rounds];
    } else {
      const leagueMatches = Array.isArray(cat.matches)
        ? cat.matches
        : Array.isArray(cat.rounds?.[0])
          ? cat.rounds[0]
          : [];
      cat.rounds = [leagueMatches, ...knockout.rounds];
    }

    cat.totalRounds = cat.rounds.length;

    await persistFixturesState();
    renderTeamEventFixtures();
    showToast("Knockout schedule created");
  }

  async function initFixturesIfNeeded() {
    if (fixturesUi.didInit) return;
    fixturesUi.didInit = true;

    fixturesUi.groupsEl?.addEventListener("click", async (e) => {
      const btn = e.target.closest(".start-scoring-btn");
      if (!btn) return;
      const tId = btn.dataset.tournamentId || "";
      const cId = btn.dataset.categoryId || "";
      const round = btn.dataset.round || "0";
      const match = btn.dataset.match || "0";
      window.location.href = `score.html?tournamentId=${tId}&categoryId=${cId}&round=${round}&match=${match}`;
    });

    fixturesUi.configureBtn?.addEventListener("click", () => {
      const targetCategoryId = isTournamentTeamEvent() ? TEAM_EVENT_CATEGORY_ID : fixturesState.activeCategoryId;
      if (!targetCategoryId) {
        showToast("Select a category first");
        return;
      }
      window.location.href = `schema.html?tournamentId=${encodeURIComponent(tournamentId)}&categoryId=${encodeURIComponent(targetCategoryId)}`;
    });

    fixturesUi.generateBtn?.addEventListener("click", async () => {
      await generateAndSaveFixtures();
    });

    fixturesGoKnockoutBtn?.addEventListener("click", async () => {
      try {
        await generateKnockoutFromLeaderboard();
      } catch (err) {
        alert(err.message || "Could not create knockout schedule.");
      }
    });

    fixturesUi.editBtn?.addEventListener("click", async () => {
      const cat = getTeamEventFixtureBucket();
      if (!cat || cat.displayMode !== "team_schedule") {
        showToast("Edit fixtures is available for the team schedule table.");
        return;
      }

      if (!fixturesState.bulkEditMode) {
        fixturesState.bulkEditMode = true;
        renderTeamEventScheduleTable(cat);
        showToast("Edit mode enabled");
        return;
      }

      await handleTeamScheduleAction("save_all", -1);
    });
  }

  let fixturesBackendPollTimer = null;

    async function refreshFixturesFromBackendSilently() {
      if (fixturesState.bulkEditMode) return;

      const existing = await loadFixturesFromDb();
      if (!existing) return;

      fixturesState.fixtures = migrateFixtures(existing);

      if (isTournamentTeamEvent()) {
        fixturesState.activeCategoryId = TEAM_EVENT_CATEGORY_ID;
        renderCategoryToggles();
        if (fixturesUi.noneSelectedEl) fixturesUi.noneSelectedEl.style.display = "none";
        renderTeamEventFixtures();
        await loadLeaderboardFromDb();
        renderLeaderboard();
        updateFixturesEditButtonState();
        return;
      }

      renderCategoryToggles();

      if (fixturesState.activeCategoryId) {
        if (fixturesUi.noneSelectedEl) fixturesUi.noneSelectedEl.style.display = "none";
        renderIndividualCategoryFixtures(fixturesState.activeCategoryId);
      } else if (fixturesUi.noneSelectedEl) {
        fixturesUi.noneSelectedEl.style.display = "flex";
      }

      await loadLeaderboardFromDb();
      renderLeaderboard();
      updateFixturesEditButtonState();
    }

  function startFixturesBackendPolling() {
    if (fixturesBackendPollTimer) clearInterval(fixturesBackendPollTimer);

    fixturesBackendPollTimer = setInterval(async () => {
      if (document.hidden) return;
      if (isFixturesCollapsed) return;
      if (fixturesState.bulkEditMode) return;
      if (!fixturesUi.wrap || fixturesUi.wrap.classList.contains("hidden")) return;

      try {
        await refreshFixturesFromBackendSilently();
      } catch (err) {
        console.warn("Fixture polling failed", err);
      }
    }, 4000);
  }

    async function openAndLoadFixtures() {
      fixturesUi.wrap?.classList.remove("hidden");
      await initFixturesIfNeeded();
      updateEmbeddedFixturesHeader();

      fixturesState.categories = tournamentCategories || [];
      computeAcceptedByCategory();

      const existing = await loadFixturesFromDb();
      fixturesState.fixtures = existing ? migrateFixtures(existing) : { categories: {} };

      if (isTournamentTeamEvent()) {
        fixturesState.activeCategoryId = TEAM_EVENT_CATEGORY_ID;
        renderCategoryToggles();
        if (fixturesUi.noneSelectedEl) fixturesUi.noneSelectedEl.style.display = "none";
        renderTeamEventFixtures();
        await loadLeaderboardFromDb();
        renderLeaderboard();
        updateFixturesEditButtonState();
        return;
      }

      fixturesState.activeCategoryId =
        fixturesState.activeCategoryId ||
        String(fixturesState.categories?.[0]?.categoryId || fixturesState.categories?.[0]?.id || "");

      renderCategoryToggles();

      if (fixturesState.activeCategoryId) {
        if (fixturesUi.noneSelectedEl) fixturesUi.noneSelectedEl.style.display = "none";
        renderIndividualCategoryFixtures(fixturesState.activeCategoryId);
      } else if (fixturesUi.noneSelectedEl) {
        fixturesUi.noneSelectedEl.style.display = "flex";
      }

      await loadLeaderboardFromDb();
      renderLeaderboard();
      updateFixturesEditButtonState();
    }

  addPlayersExcelBtn?.addEventListener("click", () => {
  openBulkPlayerModal();
});

await loadTournamentMeta();
await loadPlayers();
await refreshTeamSetupState();
await loadPoolsFromDb();
await loadLeaderboardFromDb();
await openAndLoadFixtures();

applyUmpireViewMode();

renderPlayers();
renderCaptainsSummary();
renderLeaderboard();
refreshStageSpecificUi();
syncAddPlayerCategoryUi();
syncPlayersListUi();
syncTeamSetupUi();
syncLeaderboardUi();
syncFixturesUi();
startFixturesBackendPolling();
});
