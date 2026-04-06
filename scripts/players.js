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

  const playersTabs = document.getElementById("players-tabs");

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
  const leaderboardTableBody = document.getElementById("leaderboard-table-body");

  const fixturesEmbed = document.getElementById("fixtures-embed");
  const fixturesGenerateBtn = document.getElementById("fixtures-generate-btn");
  const fixturesConfigureBtn = document.getElementById("fixtures-configure-fields-btn");
  const fixturesEditBtn = document.getElementById("fixtures-edit-btn");
  const fixturesToggle = document.getElementById("fixtures-toggle");
  const fixturesGroups = document.getElementById("fixtures-groups");
  const fixturesNoneSelected = document.getElementById("fixtures-none-selected");
  const fixturesToast = document.getElementById("fixtures-toast");
  const createFixturesBtn = document.getElementById("create-fixtures-btn");
  const fixturesTournamentNameEl = document.getElementById("fixtures-tournament-name");
  const fixturesTournamentSportEl = document.getElementById("fixtures-tournament-sport");
  const fixturesTournamentDatesEl = document.getElementById("fixtures-tournament-dates");
  const fixturesTournamentCodeEl = document.getElementById("fixtures-tournament-code");
  const embeddedFixturesHelperTextEl = document.getElementById("embedded-fixtures-helper-text");

  let allPlayers = [];
  let activeFilter = "all";
  let tournamentCategories = [];
  let tournamentMetaCache = null;
  let isTeamSetupCollapsed = false;

  let captainState = {
    selectedCaptainIds: [],
    confirmedCaptains: [],
    pools: null,
  };

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
    if (activeFilter === "all") return players;
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

  function syncTeamSetupUi() {
    if (teamSetupContent) teamSetupContent.classList.toggle("hidden", isTeamSetupCollapsed);
    if (teamSetupToggleBtn) {
      teamSetupToggleBtn.textContent = isTeamSetupCollapsed ? "▸" : "▾";
      teamSetupToggleBtn.setAttribute("aria-expanded", String(!isTeamSetupCollapsed));
    }
  }

  teamSetupToggleBtn?.addEventListener("click", () => {
    isTeamSetupCollapsed = !isTeamSetupCollapsed;
    syncTeamSetupUi();
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

  function getTeamEventFixtureBucket() {
    const categories = fixturesState.fixtures?.categories || {};
    return categories[TEAM_EVENT_CATEGORY_ID] || Object.values(categories)[0] || null;
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

    if (isTournamentTeamEvent() && isLeagueKnockoutFormat()) {
      embeddedFixturesHelperTextEl.textContent =
        "For team events, the fixture list shows team vs team ties. Categories act as submatches inside each tie. League schedules are shown as editable match tables.";
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
    const host = await apiGet("/api/host/tournaments");
    if (host.ok) {
      const list = normalizeTournamentList(host.data);
      const found = list.find((x) => String(x.tournamentId ?? x.id) === String(tournamentId));
      if (found) {
        tournamentMetaCache = found;
        hydrateTournamentMetaUi(found);
        return;
      }
    }

    const pub = await apiGet("/api/tournaments");
    if (pub.ok) {
      const list = normalizeTournamentList(pub.data);
      const found = list.find((x) => String(x.tournamentId ?? x.id) === String(tournamentId));
      if (found) {
        tournamentMetaCache = found;
        hydrateTournamentMetaUi(found);
      }
    }
  }

  function hydrateTournamentMetaUi(tournament) {
    titleEl.textContent = tournament?.tournamentName || "Tournament";
    sportEl.textContent = tournament?.sportName || "";
    datesEl.textContent = tournament?.tournamentDates || "";
    codeEl.textContent = tournament?.accessCode || "";
    tournamentCategories = normalizeCategories(tournament?.categories);
    updateEmbeddedFixturesHeader();
    refreshStageSpecificUi();
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
    addPlayerCategory.innerHTML = `<option value="">Select category</option>`;
    tournamentCategories.forEach((c) => {
      const id = c.categoryId || c.id;
      if (!id) return;
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = categoryLabel(c);
      addPlayerCategory.appendChild(opt);
    });
  }

  function openAddPlayerModal() {
    populateAddPlayerCategoryOptions();
    addPlayerForm?.reset();
    addPlayerModal?.classList.remove("hidden");
    addPlayerModal?.setAttribute("aria-hidden", "false");
  }

  function closeAddPlayerModal() {
    addPlayerModal?.classList.add("hidden");
    addPlayerModal?.setAttribute("aria-hidden", "true");
  }

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
      categoryId: addPlayerCategory?.value || "",
      status: "accepted",
      addedByHost: true,
    };

    if (!payload.playerName || !payload.age || !payload.gender || !payload.phone || !payload.categoryId) {
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

  async function updateCaptainTeamStatus(playerId, nextStatus) {
    const captain = captainState.confirmedCaptains.find((c) => String(c.playerId) === String(playerId));
    if (!captain) return;
    captain.teamStatus = nextStatus;
    await saveCaptainStateToDb();
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
            <div class="captain-pick-meta">${escapeHtml(getCategoryNameById(getPlayerCategoryId(player)))}</div>
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
            <div class="confirm-captain-category">${escapeHtml(getCategoryNameById(getPlayerCategoryId(player)))}</div>
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
      };
    });

    try {
      await saveCaptainStateToDb();
      closeConfirmCaptainsModal();
      renderCaptainsSummary();
      refreshStageSpecificUi();
    } catch (err) {
      alert(err.message || "Could not save captains.");
    }
  });

  function renderCaptainsSummary() {
    if (!captainsSummarySection) return;
    captainsSummarySection.classList.remove("hidden");
    captainsSummaryList.innerHTML = "";
    syncTeamSetupUi();

    if (!captainState.confirmedCaptains.length) {
      captainsSummaryEmpty?.classList.remove("hidden");
      return;
    }

    captainsSummaryEmpty?.classList.add("hidden");

    captainState.confirmedCaptains.forEach((captain) => {
      const playerId = String(captain.playerId || "");
      const expanded = expandedTeamIds.has(playerId);
      const teamPlayers = getCaptainSubmittedPlayers(captain);
      const teamStatus = String(captain.teamStatus || "pending");
      const statusChipClass = teamStatus === "accepted"
        ? "status-pill status-pill--accepted"
        : teamStatus === "rejected"
          ? "status-pill status-pill--rejected"
          : "status-pill status-pill--pending";
      const statusChipText = teamStatus === "accepted"
        ? "Team accepted"
        : teamStatus === "rejected"
          ? "Team rejected"
          : "Team pending";

      const card = document.createElement("div");
      card.className = "captain-summary-card team-setup-card";
      card.innerHTML = `
        <button type="button" class="captain-summary-head-btn" data-team-card-toggle="${escapeHtml(playerId)}">
          <div class="captain-summary-left">
            <div class="captain-summary-name">${escapeHtml(captain.teamName || captain.playerName || "Team")}</div>
            <div class="captain-summary-meta">Captain: ${escapeHtml(captain.playerName || "—")}</div>
          </div>
          <div class="row-actions team-setup-head-actions">
            <span class="${statusChipClass}">${escapeHtml(statusChipText)}</span>
            <span class="team-name-chip team-toggle-chip">${expanded ? "▾" : "▸"}</span>
          </div>
        </button>
        <div class="team-setup-details${expanded ? "" : " hidden"}" data-team-card-body="${escapeHtml(playerId)}">
          <div class="helper-text team-setup-helper">Players submitted by captain</div>
          ${teamPlayers.length
            ? `<div class="team-player-list">${teamPlayers.map((name, idx) => `<div class="team-player-row"><span class="team-player-index">${idx + 1}</span><span class="team-player-name">${escapeHtml(name)}</span></div>`).join("")}</div>`
            : `<div class="empty-state compact-empty team-setup-empty"><div class="feature-icon">👥</div><h3>No team list yet</h3><p class="muted">Team players from captain submission on join mode will appear here once linked.</p></div>`}
          <div class="row-actions team-setup-actions">
            <button type="button" class="action-btn accept" data-team-status="accepted" data-team-player-id="${escapeHtml(playerId)}">Accept team</button>
            <button type="button" class="action-btn reject" data-team-status="rejected" data-team-player-id="${escapeHtml(playerId)}">Reject team</button>
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
    const categoryId = isTournamentTeamEvent()
      ? TEAM_EVENT_CATEGORY_ID
      : String(activeFilter === "all" ? (tournamentCategories?.[0]?.categoryId || tournamentCategories?.[0]?.id || "") : activeFilter);

    if (!categoryId) {
      leaderboardState.rows = [];
      return;
    }

    const r = await apiGet(`/api/host/tournaments/${encodeURIComponent(tournamentId)}/leaderboard?categoryId=${encodeURIComponent(categoryId)}`);
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
    leaderboardTableBody.innerHTML = "";
    if (!leaderboardState.rows.length) {
      leaderboardTableBody.innerHTML = `<tr><td colspan="6" class="muted">No leaderboard data yet.</td></tr>`;
      return;
    }
    leaderboardState.rows.forEach((row, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${escapeHtml(row.teamName || "—")}</td>
        <td>${escapeHtml(row.matchPoints ?? 0)}</td>
        <td>${escapeHtml(row.tiesWon ?? 0)}</td>
        <td>${escapeHtml(row.headToHead ?? "—")}</td>
        <td>${escapeHtml(row.qualified ? "Yes" : "No")}</td>
      `;
      leaderboardTableBody.appendChild(tr);
    });
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
    const r = await apiGet(`/api/host/tournaments/${encodeURIComponent(tournamentId)}/fixtures`);
    if (!r.ok) return null;
    return r.data?.data || r.data;
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

  function renderTeamEventScheduleTable(cat) {
    const matches = Array.isArray(cat?.matches)
      ? cat.matches
      : Array.isArray(cat?.rounds?.[0])
        ? cat.rounds[0]
        : [];

    if (!matches.length) {
      fixturesUi.groupsEl.innerHTML = `
        <div class="empty-state" style="display:flex;">
          <div class="feature-icon">🗓️</div>
          <h3>No team fixtures yet</h3>
          <p class="muted">Click “Regenerate fixtures” to create the team match schedule.</p>
        </div>
      `;
      updateFixturesEditButtonState();
      return;
    }

    const editing = Boolean(fixturesState.bulkEditMode);

    fixturesUi.groupsEl.innerHTML = `
      <div class="fixtures-group">
        <h3 class="fixtures-group-title">${escapeHtml(cat?.label || "Team fixtures")}</h3>
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
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${matches.map((match, index) => {
                const team1Cell = editing
                  ? `<input class="schedule-edit-input" type="text" data-edit-field="home" data-index="${index}" value="${escapeHtml(match.home || "")}" placeholder="Team 1" />`
                  : escapeHtml(match.home || "—");
                const team2Cell = editing
                  ? `<input class="schedule-edit-input" type="text" data-edit-field="away" data-index="${index}" value="${escapeHtml(match.away || "")}" placeholder="Team 2" />`
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
                return `
                  <tr>
                    <td>${escapeHtml(match.matchNo || index + 1)}</td>
                    <td>${team1Cell}</td>
                    <td>${team2Cell}</td>
                    <td>${dateCell}</td>
                    <td>${timeCell}</td>
                    <td>${courtCell}</td>
                    <td>
                      <div class="row-actions">
                        ${editing
                          ? `<span class="captain-summary-meta">Editing…</span>`
                          : `<button type="button" class="action-btn accept start-scoring-btn" data-tournament-id="${escapeHtml(tournamentId)}" data-category-id="${escapeHtml(TEAM_EVENT_CATEGORY_ID)}" data-round="0" data-match="${index}">Start scoring</button>`}
                      </div>
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
    updateFixturesEditButtonState();
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
      const home = root?.querySelector(`input[data-edit-field="home"][data-index="${index}"]`)?.value?.trim() || match.home || "";
      const away = root?.querySelector(`input[data-edit-field="away"][data-index="${index}"]`)?.value?.trim() || match.away || "";
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
  }

  function renderCategoryBracket(categoryId) {
    if (isTournamentTeamEvent()) {
      renderTeamEventFixtures();
      return;
    }
    renderIndividualCategoryFixtures(categoryId);
  }

  async function generateAndSaveFixtures() {
    if (isTournamentTeamEvent()) {
      const teams = getConfirmedTeams().filter((team) => team.teamStatus !== "rejected");
      if (teams.length < 2) {
        fixturesState.bulkEditMode = false;
        showToast("Not enough confirmed teams to regenerate fixtures");
        return;
      }

      if (isLeagueKnockoutFormat()) {
        const requestedRounds = getRequestedLeagueRounds() || 1;
        const { pairs, matchesPerTeam } = buildBalancedLeaguePairs(teams.map((team) => team.teamName), requestedRounds);
        if (!pairs.length) {
          showToast("Could not build league fixtures for the selected number of rounds");
          return;
        }

        const scheduledMatches = scheduleLeaguePairs(pairs, shuffle(getAvailableCourtNames()), getTournamentStartDate());
        fixturesState.bulkEditMode = false;
        fixturesState.bulkEditMode = false;
      fixturesState.fixtures = migrateFixtures({
          tournamentType: "team",
          teamCategories: tournamentCategories,
          categories: {
            [TEAM_EVENT_CATEGORY_ID]: {
              categoryId: TEAM_EVENT_CATEGORY_ID,
              label: `League schedule • ${matchesPerTeam} matches per team`,
              displayMode: "team_schedule",
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

      const teamMap = {};
      const entrants = teams.map((team) => {
        teamMap[team.teamName] = [team.teamName];
        return team.teamName;
      });
      const bracket = createBracket(entrants, teamMap);
      if (!bracket) {
        showToast("Not enough confirmed teams to regenerate fixtures");
        return;
      }

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

    const newFixtures = { categories: {} };
    let createdAny = false;
    fixturesState.categories.forEach((category) => {
      const cid = category.categoryId || category.id;
      if (!cid) return;
      const { entrants, teamMap } = getFixtureEntrantsForCategory(category);
      const bracket = createBracket(entrants, teamMap);
      newFixtures.categories[cid] = {
        categoryId: cid,
        label: categoryLabel(category),
        ...(bracket ? bracket : { rounds: [], totalRounds: 0 }),
      };
      if (bracket) createdAny = true;
    });

    if (!createdAny) {
      showToast("Not enough accepted players to regenerate fixtures");
      return;
    }

    const r = await apiPost(`/api/host/tournaments/${encodeURIComponent(tournamentId)}/fixtures/update`, newFixtures);
    if (!r.ok) {
      showToast("Failed to regenerate fixtures");
      return;
    }

    fixturesState.bulkEditMode = false;
    fixturesState.fixtures = migrateFixtures(r.data || newFixtures);
    showToast("Fixtures regenerated");
    renderCategoryToggles();
    if (fixturesState.activeCategoryId) renderIndividualCategoryFixtures(fixturesState.activeCategoryId);
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
      updateFixturesEditButtonState();
      fixturesUi.wrap?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    fixturesState.activeCategoryId = fixturesState.activeCategoryId || String(fixturesState.categories?.[0]?.categoryId || fixturesState.categories?.[0]?.id || "");
    renderCategoryToggles();

    if (fixturesState.activeCategoryId) {
      if (fixturesUi.noneSelectedEl) fixturesUi.noneSelectedEl.style.display = "none";
      renderIndividualCategoryFixtures(fixturesState.activeCategoryId);
    } else if (fixturesUi.noneSelectedEl) {
      fixturesUi.noneSelectedEl.style.display = "flex";
    }

    updateFixturesEditButtonState();
    fixturesUi.wrap?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  createFixturesBtn?.addEventListener("click", openAndLoadFixtures);

  await loadTournamentMeta();
  await loadPlayers();
  await loadCaptainStateFromDb();
  await loadPoolsFromDb();
  await loadLeaderboardFromDb();

  renderPlayers();
  renderCaptainsSummary();
  renderLeaderboard();
  refreshStageSpecificUi();
  syncTeamSetupUi();
});
