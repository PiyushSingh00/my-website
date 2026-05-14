/**
 * players-core.js  ← replaces the old monolithic players.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Entry point loaded by players.html. Handles:
 *   • Auth + mode toggle
 *   • All shared DOM refs + shared state
 *   • Tournament meta loading
 *   • Player table (render, filter tabs, accept/reject)
 *   • Add-player manually modal + umpire modal
 *   • Leaderboard render
 *   • Section collapse/expand
 *   • Coordinates lazy imports of players-bulk, players-captains, players-fixtures
 *
 * FIX 12 (module split): this file replaces the monolithic players.js
 * All other FIX numbers (1–11) are preserved in this file and the sub-modules.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { requireAuth, logout } from "./auth.js";

// ── Sub-module imports (captains loads at startup; bulk + fixtures are lazy) ──
import {
  initCaptains,
  loadCaptainStateFromDb,
  loadTeamsFromDb,
  refreshTeamSetupState,
  renderCaptainsSummary,
  loadPoolsFromDb,
} from "./players-captains.js";

// ── Shared utilities ──────────────────────────────────────────────────────────
import {
  state,
  TEAM_EVENT_CATEGORY_ID,
  setAuthToken,
  escapeHtml,
  safeJson,
  normalizeTournamentList,
  normalizeCategories,
  categoryLabel,
  getPlayerCategoryId,
  getPlayerId,
  getPlayerDisplayName,
  normalizeStatusPlayersPage,
  statusLabel,
  statusClass,
  normalizeIdentity,
  normalizePhone,
  resetAdvancedSettingsCache,
  getAdvancedSettings,
  isTournamentTeamEvent,
  isGroupKnockoutFormat,
  isLeagueKnockoutFormat,
  computeCounts,
  applyFilter,
  getAcceptedPlayers,
  getCategoryNameById,
  apiJson,
  apiGet,
  apiPost,
  apiPut,
  apiPatch,
  getSortedLeaderboardRows,
  getQualifiedLeaderboardRows,
  getTeamEventFixtureBucket,
  getConfirmedTeams,
  getMatchStatus,
  getFixtureMatchPoints,
  firstFiniteNumber,
} from "./players-utils.js";

// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;

  // FIX 1: Cache auth token once — no repeated localStorage reads
  const AUTH_TOKEN = localStorage.getItem("token") || "";
  setAuthToken(AUTH_TOKEN);

  // ── Brand / mode toggle ─────────────────────────────────────────────────────
  document.querySelectorAll(".brand").forEach((el) => {
    el.addEventListener("click", () => { window.location.href = "index.html"; });
  });

  const trigger  = document.getElementById("host-user-menu-trigger");
  const dropdown = document.getElementById("host-user-menu-dropdown");
  if (trigger) {
    trigger.textContent = (user?.name || user?.username || user?.email || "U").trim().charAt(0).toUpperCase();
  }
  trigger?.addEventListener("click", (e) => { e.stopPropagation(); dropdown?.classList.toggle("is-open"); });
  document.addEventListener("click", (e) => {
    if (!dropdown || !trigger) return;
    if (!dropdown.contains(e.target) && !trigger.contains(e.target)) dropdown.classList.remove("is-open");
  });
  document.getElementById("dropdown-signout")?.addEventListener("click", () => {
    dropdown?.classList.remove("is-open"); logout();
  });

  const playerBtn = document.getElementById("mode-player-btn");
  const hostBtn   = document.getElementById("mode-host-btn");
  hostBtn?.classList.add("is-active");
  playerBtn?.classList.remove("is-active");

  playerBtn?.addEventListener("click", async () => {
    try {
      await fetch("/api/user/mode", { method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + AUTH_TOKEN },
        body: JSON.stringify({ mode: "player" }) });
    } catch {}
    window.location.href = "join.html";
  });
  hostBtn?.addEventListener("click", async () => {
    try {
      await fetch("/api/user/mode", { method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + AUTH_TOKEN },
        body: JSON.stringify({ mode: "host" }) });
    } catch {}
  });

  // ── Tournament ID ───────────────────────────────────────────────────────────
  const params       = new URLSearchParams(window.location.search);
  const tournamentId = params.get("tournamentId");
  if (!tournamentId) { alert("Missing tournamentId in URL"); return; }

  document.getElementById("players-back-btn")?.addEventListener("click", () => {
    const from = params.get("from");
    if (from === "join" || isLoggedInUserUmpire()) {
      window.location.href = `join.html?tournamentId=${encodeURIComponent(tournamentId)}`;
      return;
    }
    window.location.href = "host.html";
  });

  // ── DOM refs ────────────────────────────────────────────────────────────────
  const tableWrapper  = document.getElementById("players-table-wrapper");
  const tableBody     = document.getElementById("players-table-body");
  const emptyState    = document.getElementById("players-empty-state");
  const titleEl       = document.getElementById("players-tournament-name");
  const sportEl       = document.getElementById("players-tournament-sport");
  const datesEl       = document.getElementById("players-tournament-dates");
  const codeEl        = document.getElementById("players-tournament-code");
  const playersToolbar        = document.querySelector(".players-toolbar");
  const playersListSection    = document.getElementById("players-list-section");
  const playersTabs           = document.getElementById("players-tabs");
  const playersListToggleBtn  = document.getElementById("players-list-toggle-btn");
  const playersListContent    = document.getElementById("players-list-content");
  const addPlayerBtn          = document.getElementById("add-player-btn");
  const addPlayerModal        = document.getElementById("host-add-player-modal");
  const addPlayerClose        = document.getElementById("host-add-player-close");
  const addPlayerForm         = document.getElementById("host-add-player-form");
  const addPlayerCategory     = document.getElementById("host-player-category");
  const makeCaptainsBtn       = document.getElementById("make-captains-btn"); // owned by players-captains
  const createPoolsBtn        = document.getElementById("create-pools-btn");
  const captainsSummarySection= document.getElementById("captains-summary-section");
  const poolsSection          = document.getElementById("pools-section");
  const leaderboardSection    = document.getElementById("leaderboard-section");
  const leaderboardToggleBtn  = document.getElementById("leaderboard-toggle-btn");
  const leaderboardContent    = document.getElementById("leaderboard-content");
  const leaderboardTableBody  = document.getElementById("leaderboard-table-body");
  const fixturesEmbed         = document.getElementById("fixtures-embed");
  const fixturesGenerateBtn   = document.getElementById("fixtures-generate-btn");
  const fixturesGoKnockoutBtn = document.getElementById("fixtures-go-knockout-btn");
  const fixturesConfigureBtn  = document.getElementById("fixtures-configure-fields-btn");
  const fixturesEditBtn       = document.getElementById("fixtures-edit-btn");
  const fixturesCollapseToggleBtn = document.getElementById("fixtures-toggle-btn");
  const fixturesContent       = document.getElementById("fixtures-content");
  const fixturesToggle        = document.getElementById("fixtures-toggle");
  const fixturesGroups        = document.getElementById("fixtures-groups");
  const fixturesNoneSelected  = document.getElementById("fixtures-none-selected");
  const fixturesToast         = document.getElementById("fixtures-toast");
  const addPlayersExcelBtn    = document.getElementById("add-players-excel-btn");
  const makeUmpireBtn         = document.getElementById("make-umpire-btn");
  const addUmpireModal        = document.getElementById("host-add-umpire-modal");
  const addUmpireClose        = document.getElementById("host-add-umpire-close");
  const addUmpireForm         = document.getElementById("host-add-umpire-form");
  const fixturesTournamentNameEl  = document.getElementById("fixtures-tournament-name");
  const fixturesTournamentSportEl = document.getElementById("fixtures-tournament-sport");
  const fixturesTournamentDatesEl = document.getElementById("fixtures-tournament-dates");
  const fixturesTournamentCodeEl  = document.getElementById("fixtures-tournament-code");
  const embeddedFixturesHelperTextEl = document.getElementById("embedded-fixtures-helper-text");

  // ── fixturesUi object (shared with players-fixtures) ───────────────────────
  const fixturesUi = {
    wrap:           fixturesEmbed,
    generateBtn:    fixturesGenerateBtn,
    configureBtn:   fixturesConfigureBtn,
    editBtn:        fixturesEditBtn,
    toggleWrap:     fixturesToggle,
    groupsEl:       fixturesGroups,
    noneSelectedEl: fixturesNoneSelected,
    toastEl:        fixturesToast,
    didInit:        false,
  };

  // ── Toast (local — uses fixturesUi.toastEl) ─────────────────────────────────
  function showToast(message) {
    if (!fixturesUi.toastEl) return;
    fixturesUi.toastEl.textContent = message;
    fixturesUi.toastEl.style.display = "inline-flex";
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { if (fixturesUi.toastEl) fixturesUi.toastEl.style.display = "none"; }, 2200);
  }

  // ── Umpire helpers ──────────────────────────────────────────────────────────
  function getTournamentUmpires(tournament = state.tournamentMetaCache) {
    return Array.isArray(tournament?.umpires) ? tournament.umpires : [];
  }
  function isLoggedInUserUmpire(tournament = state.tournamentMetaCache) {
    const umpires = getTournamentUmpires(tournament);
    if (!umpires.length) return false;
    const myName     = normalizeIdentity(user?.name);
    const myUsername = normalizeIdentity(user?.username);
    const myPhone    = normalizePhone(user?.phone || user?.mobile || user?.phoneNumber);
    return umpires.some((u) => {
      const uName  = normalizeIdentity(u?.name);
      const uUser  = normalizeIdentity(u?.username);
      const uPhone = normalizePhone(u?.phone);
      return (myPhone && uPhone && myPhone === uPhone) ||
             (myUsername && uUser && myUsername === uUser) ||
             (myName && uName && myName === uName);
    });
  }

  function applyUmpireViewMode() {
    if (!isLoggedInUserUmpire()) return;
    playerBtn?.classList.add("is-active");
    hostBtn?.classList.remove("is-active");
    if (playersToolbar) {
      playersToolbar.querySelectorAll("button").forEach((btn) => {
        if (btn.id !== "players-back-btn") { btn.classList.add("hidden"); btn.style.display = "none"; }
      });
    }
    playersListSection?.classList.add("hidden");
    captainsSummarySection?.classList.add("hidden");
    poolsSection?.classList.add("hidden");
    leaderboardSection?.classList.add("hidden");
    fixturesEmbed?.classList.remove("hidden");
    state.isFixturesCollapsed = false;
    syncFixturesUi();
    fixturesGenerateBtn?.classList.add("hidden");
    fixturesGenerateBtn && (fixturesGenerateBtn.style.display = "none");
    fixturesGoKnockoutBtn?.classList.add("hidden");
    fixturesGoKnockoutBtn && (fixturesGoKnockoutBtn.style.display = "none");
    fixturesConfigureBtn?.classList.add("hidden");
    fixturesConfigureBtn && (fixturesConfigureBtn.style.display = "none");
    fixturesEditBtn?.classList.add("hidden");
    fixturesEditBtn && (fixturesEditBtn.style.display = "none");
  }

  // ── Umpire modal ────────────────────────────────────────────────────────────
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
  makeUmpireBtn?.addEventListener("click", openAddUmpireModal);
  addUmpireClose?.addEventListener("click", closeAddUmpireModal);
  addUmpireModal?.addEventListener("click", (e) => { if (e.target === addUmpireModal) closeAddUmpireModal(); });
  addUmpireForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      name:  document.getElementById("host-umpire-name")?.value?.trim() || "",
      phone: document.getElementById("host-umpire-phone")?.value?.trim() || "",
    };
    if (!payload.name || !payload.phone) { alert("Please fill umpire name and phone number."); return; }
    const attempts = [
      () => apiPost(`/api/host/tournaments/${encodeURIComponent(tournamentId)}/umpires`, payload),
      () => apiPost(`/api/host/tournaments/${encodeURIComponent(tournamentId)}/officials`, { ...payload, role: "umpire" }),
    ];
    for (const attempt of attempts) {
      const r = await attempt();
      if (r.ok) { closeAddUmpireModal(); await loadTournamentMeta(); alert("Umpire added successfully."); return; }
    }
    alert("Could not save umpire. Backend umpire route is not ready yet.");
  });

  // ── Section sync ────────────────────────────────────────────────────────────
  function syncPlayersListUi() {
    if (playersListContent) playersListContent.classList.toggle("hidden", state.isPlayersListCollapsed);
    if (playersListToggleBtn) {
      playersListToggleBtn.textContent = state.isPlayersListCollapsed ? "▸" : "▾";
      playersListToggleBtn.setAttribute("aria-expanded", String(!state.isPlayersListCollapsed));
    }
  }
  function syncTeamSetupUi() {
    const teamSetupContent    = document.getElementById("team-setup-content");
    const teamSetupToggleBtn  = document.getElementById("team-setup-toggle-btn");
    if (teamSetupContent)   teamSetupContent.classList.toggle("hidden", state.isTeamSetupCollapsed);
    if (teamSetupToggleBtn) {
      teamSetupToggleBtn.textContent = state.isTeamSetupCollapsed ? "▸" : "▾";
      teamSetupToggleBtn.setAttribute("aria-expanded", String(!state.isTeamSetupCollapsed));
    }
  }
  function syncLeaderboardUi() {
    if (leaderboardContent)   leaderboardContent.classList.toggle("hidden", state.isLeaderboardCollapsed);
    if (leaderboardToggleBtn) {
      leaderboardToggleBtn.textContent = state.isLeaderboardCollapsed ? "▸" : "▾";
      leaderboardToggleBtn.setAttribute("aria-expanded", String(!state.isLeaderboardCollapsed));
    }
  }
  function syncFixturesUi() {
    if (fixturesContent)            fixturesContent.classList.toggle("hidden", state.isFixturesCollapsed);
    if (fixturesCollapseToggleBtn) {
      fixturesCollapseToggleBtn.textContent = state.isFixturesCollapsed ? "▸" : "▾";
      fixturesCollapseToggleBtn.setAttribute("aria-expanded", String(!state.isFixturesCollapsed));
    }
  }
  function syncAddPlayerCategoryUi() {
    if (!addPlayerCategory) return;
    const wrap = addPlayerCategory.closest(".field-group");
    if (isTournamentTeamEvent()) {
      addPlayerCategory.required = false; addPlayerCategory.value = ""; wrap?.classList.add("hidden");
    } else {
      addPlayerCategory.required = true; wrap?.classList.remove("hidden");
    }
  }

  playersListToggleBtn?.addEventListener("click", () => {
    state.isPlayersListCollapsed = !state.isPlayersListCollapsed; syncPlayersListUi();
  });
  leaderboardToggleBtn?.addEventListener("click", () => {
    state.isLeaderboardCollapsed = !state.isLeaderboardCollapsed; syncLeaderboardUi();
  });

  // FIX 10: Lazy-load fixtures — only on first panel open
  let _fixturesLoaded = false;
  fixturesCollapseToggleBtn?.addEventListener("click", async () => {
    state.isFixturesCollapsed = !state.isFixturesCollapsed;
    syncFixturesUi();
    if (!state.isFixturesCollapsed && !_fixturesLoaded) {
      _fixturesLoaded = true;
      const { openAndLoadFixtures } = await import("./players-fixtures.js");
      await openAndLoadFixtures();
    }
  });

  // ── Refresh stage-specific UI ───────────────────────────────────────────────
  function refreshStageSpecificUi() {
    const hasConfirmed = state.captainState.confirmedCaptains.length > 0;
    if (!isGroupKnockoutFormat()) {
      createPoolsBtn?.classList.add("hidden");
      poolsSection?.classList.add("hidden");
    } else {
      createPoolsBtn?.classList.toggle("hidden", !hasConfirmed);
    }
    if (leaderboardSection) {
      const shouldShow =
        state.tournamentMetaCache?.stageFormat === "round_robin" ||
        isGroupKnockoutFormat() || isLeagueKnockoutFormat();
      leaderboardSection.classList.toggle("hidden", !shouldShow);
    }
  }

  // ── Tournament meta ─────────────────────────────────────────────────────────
  async function loadTournamentMeta() {
    const directCandidates = [`/api/tournaments/${encodeURIComponent(tournamentId)}`];
    for (const url of directCandidates) {
      const resp = await apiGet(url);
      if (!resp.ok) continue;
      const found = resp.data?.data || resp.data || null;
      if (found && String(found.tournamentId ?? found.id) === String(tournamentId)) {
        state.tournamentMetaCache = found;
        hydrateTournamentMetaUi(found);
        applyUmpireViewMode();
        return found;
      }
    }
    for (const url of ["/api/player/tournaments", "/api/host/tournaments", "/api/tournaments"]) {
      const r = await apiGet(url);
      if (!r.ok) continue;
      const found = normalizeTournamentList(r.data).find((x) => String(x.tournamentId ?? x.id) === String(tournamentId));
      if (found) { state.tournamentMetaCache = found; hydrateTournamentMetaUi(found); return found; }
    }
    return null;
  }

  function hydrateTournamentMetaUi(tournament) {
    resetAdvancedSettingsCache(); // FIX 11
    titleEl.textContent  = tournament?.tournamentName  || "Tournament";
    sportEl.textContent  = tournament?.sportName       || "";
    datesEl.textContent  = tournament?.tournamentDates || "";
    codeEl.textContent   = tournament?.accessCode      || "";
    state.tournamentCategories = normalizeCategories(tournament?.categories);
    // Lazily update fixtures header if already loaded
    import("./players-fixtures.js").then(({ updateEmbeddedFixturesHeader }) => updateEmbeddedFixturesHeader()).catch(() => {});
    refreshStageSpecificUi();
    syncAddPlayerCategoryUi();
    renderPlayerTabs();
  }

  // ── Player table ────────────────────────────────────────────────────────────
  function renderPlayerTabs() {
    if (!playersTabs) return;
    if (isTournamentTeamEvent()) {
      state.activeFilter = "all"; playersTabs.innerHTML = ""; playersTabs.classList.add("hidden"); return;
    }
    playersTabs.classList.remove("hidden");
    const counts = computeCounts(state.allPlayers);
    const tabs = [
      { key: "all", label: "All players", count: counts.all },
      ...state.tournamentCategories.map((c) => ({
        key:   String(c.categoryId || c.id),
        label: categoryLabel(c),
        count: counts.byCategory[String(c.categoryId || c.id)] || 0,
      })),
    ];
    playersTabs.innerHTML = "";
    tabs.forEach((tab) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `players-tab ${state.activeFilter === tab.key ? "active" : ""}`;
      btn.innerHTML = `<span>${escapeHtml(tab.label)}</span><span class="tab-count">${tab.count}</span>`;
      btn.addEventListener("click", async () => {
        state.activeFilter = tab.key;
        renderPlayerTabs(); renderPlayers();
        await loadLeaderboardFromDb(); renderLeaderboard();
      });
      playersTabs.appendChild(btn);
    });
  }

  // FIX 6: Single delegated listener — no per-row listeners
  tableBody.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    if (action !== "accept" && action !== "reject") return;
    const playerIdx = Number(btn.closest("tr")?.dataset.playerIdx ?? -1);
    const player    = applyFilter(state.allPlayers)[playerIdx];
    if (!player) return;
    try {
      await updateRegistrationStatus(player, action === "accept" ? "accepted" : "rejected");
      await loadPlayers();
    } catch (err) { alert(err.message || `Could not ${action} player.`); }
  });

  function renderPlayers() {
    const filtered = applyFilter(state.allPlayers);
    tableBody.innerHTML = "";
    if (!state.allPlayers.length) {
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
    filtered.forEach((player, idx) => {
      const s  = normalizeStatusPlayersPage(player);
      const tr = document.createElement("tr");
      tr.dataset.playerIdx = idx;
      tr.innerHTML = `
        <td>${escapeHtml(getPlayerDisplayName(player))}</td>
        <td>${escapeHtml(player.age ?? "—")}</td>
        <td>${escapeHtml(player.gender ?? "—")}</td>
        <td><span class="status-pill ${statusClass(s)}">${statusLabel(s)}</span></td>
        <td>
          <div class="row-actions">
            <button type="button" class="action-btn accept" data-action="accept" ${s === "accepted" ? "disabled" : ""}>Accept</button>
            <button type="button" class="action-btn reject" data-action="reject" ${s === "rejected" ? "disabled" : ""}>Reject</button>
          </div>
        </td>`;
      tableBody.appendChild(tr);
    });
  }

  // Export for players-bulk.js callback
  export async function loadPlayers(tid = tournamentId) {
    const candidates = [
      `/api/host/tournaments/${tid}/players`,
      `/api/host/tournaments/${tid}/registrations`,
      `/api/tournaments/${tid}/players`,
      `/api/tournaments/${tid}/registrations`,
    ];
    for (const url of candidates) {
      const r = await apiGet(url);
      if (!r.ok) continue;
      let rows = [];
      if (Array.isArray(r.data)) rows = r.data;
      else if (Array.isArray(r.data?.data)) rows = r.data.data;
      else if (Array.isArray(r.data?.players)) rows = r.data.players;
      else if (Array.isArray(r.data?.registrations)) rows = r.data.registrations;
      if (Array.isArray(rows)) { state.allPlayers = rows; renderPlayerTabs(); renderPlayers(); return; }
    }
    state.allPlayers = []; renderPlayerTabs(); renderPlayers();
  }

  async function updateRegistrationStatus(player, nextStatus) {
    const playerId = getPlayerId(player);
    const body     = JSON.stringify({ status: nextStatus });
    const candidates = [
      { method: "PATCH", url: `/api/host/tournaments/${tournamentId}/players/${playerId}`, body },
      { method: "POST",  url: `/api/host/tournaments/${tournamentId}/players/${playerId}/${nextStatus}`, body: null },
      { method: "PATCH", url: `/api/tournaments/${tournamentId}/players/${playerId}`, body },
      { method: "PATCH", url: `/api/host/tournaments/${tournamentId}/registrations/${playerId}`, body },
      { method: "POST",  url: `/api/host/tournaments/${tournamentId}/registrations/${playerId}/${nextStatus}`, body: null },
    ].filter((c) => c.url && !c.url.includes("null") && !c.url.includes("undefined"));
    if (!playerId) {
      candidates.unshift({ method: "PATCH", url: `/api/host/tournaments/${tournamentId}/players`,
        body: JSON.stringify({ status: nextStatus, playerName: player.playerName ?? player.name,
          phone: player.phone ?? player.playerPhone, username: player.username }) });
    }
    for (const c of candidates) {
      const r = await apiJson(c.url, { method: c.method,
        headers: c.body ? { "Content-Type": "application/json" } : undefined,
        body: c.body || undefined });
      if (r.ok) return r.data;
    }
    throw new Error("No matching accept/reject API route responded successfully.");
  }

  // ── Add-player modal ────────────────────────────────────────────────────────
  function populateAddPlayerCategoryOptions() {
    if (!addPlayerCategory) return;
    if (isTournamentTeamEvent()) {
      addPlayerCategory.innerHTML = `<option value="${TEAM_EVENT_CATEGORY_ID}">Not applicable for team event</option>`;
      addPlayerCategory.value = TEAM_EVENT_CATEGORY_ID;
      syncAddPlayerCategoryUi(); return;
    }
    addPlayerCategory.innerHTML = `<option value="">Select category</option>`;
    state.tournamentCategories.forEach((c) => {
      const id = c.categoryId || c.id; if (!id) return;
      const opt = document.createElement("option");
      opt.value = id; opt.textContent = categoryLabel(c);
      addPlayerCategory.appendChild(opt);
    });
    syncAddPlayerCategoryUi();
  }
  function openAddPlayerModal() {
    populateAddPlayerCategoryOptions(); addPlayerForm?.reset();
    if (isTournamentTeamEvent() && addPlayerCategory) addPlayerCategory.value = TEAM_EVENT_CATEGORY_ID;
    syncAddPlayerCategoryUi();
    addPlayerModal?.classList.remove("hidden"); addPlayerModal?.setAttribute("aria-hidden", "false");
  }
  function closeAddPlayerModal() {
    addPlayerModal?.classList.add("hidden"); addPlayerModal?.setAttribute("aria-hidden", "true");
  }
  addPlayerBtn?.addEventListener("click", openAddPlayerModal);
  addPlayerClose?.addEventListener("click", closeAddPlayerModal);
  addPlayerModal?.addEventListener("click", (e) => { if (e.target === addPlayerModal) closeAddPlayerModal(); });
  addPlayerForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      playerName: document.getElementById("host-player-name")?.value?.trim() || "",
      age:        Number(document.getElementById("host-player-age")?.value || 0),
      gender:     document.getElementById("host-player-gender")?.value || "",
      phone:      document.getElementById("host-player-phone")?.value?.trim() || "",
      categoryId: isTournamentTeamEvent() ? TEAM_EVENT_CATEGORY_ID : (addPlayerCategory?.value || ""),
      status: "accepted", addedByHost: true,
    };
    if (!payload.playerName || !payload.age || !payload.gender || !payload.phone ||
        (!isTournamentTeamEvent() && !payload.categoryId)) {
      alert("Please fill all player details."); return;
    }
    for (const fn of [
      () => apiPost(`/api/host/tournaments/${tournamentId}/players/add`, payload),
      () => apiPost(`/api/host/tournaments/${tournamentId}/players`, payload),
      () => apiPost(`/api/host/tournaments/${tournamentId}/registrations`, payload),
    ]) {
      const r = await fn(); if (r.ok) { closeAddPlayerModal(); await loadPlayers(); return; }
    }
    alert("Could not add player. Check backend route.");
  });

  // ── Lazy-load bulk upload ────────────────────────────────────────────────────
  addPlayersExcelBtn?.addEventListener("click", async () => {
    const { openBulkPlayerModal } = await import("./players-bulk.js");
    openBulkPlayerModal();
  });

  // ── Leaderboard ─────────────────────────────────────────────────────────────
  function isRealLeaderboardTeamName(name) {
    const v = String(name || "").trim().toUpperCase();
    return Boolean(v && v !== "BYE" && v !== "TBD");
  }

  function buildTeamLeaderboardRowsFromFixtures() {
    const { fixturesState } = state;
    const cat = getTeamEventFixtureBucket();
    if (!cat) return [];

    const isTeamGroupKO = String(state.tournamentMetaCache?.stageFormat || "") === "group_knockout";
    if (isTeamGroupKO && Array.isArray(cat.groups) && cat.groups.length) {
      const { computeGroupLeaderboardRows } = require("./players-utils.js"); // static at parse time
      const mergedRows = [];
      cat.groups.forEach((group) => {
        const rows = computeGroupLeaderboardRows(cat, group.roundIndex).map((row, idx) => ({
          ...row, rank: idx + 1,
          qualified: idx < Number(group.qualifierCount || 2),
          groupName: group.groupName,
        }));
        mergedRows.push(...rows);
      });
      return mergedRows;
    }

    const leagueSource = Array.isArray(cat?.rounds?.[0]) ? cat.rounds[0]
      : Array.isArray(cat?.matches) ? cat.matches : [];
    const matches = leagueSource.filter((m) => String(m?.stage || "league").toLowerCase() !== "knockout");
    const statsMap = new Map();
    const ensureTeam = (n) => {
      const key = String(n || "").trim();
      if (!isRealLeaderboardTeamName(key)) return null;
      if (!statsMap.has(key)) statsMap.set(key, { rank: 0, teamName: key, matchPoints: 0, matchesPlayed: 0, qualified: false });
      return statsMap.get(key);
    };
    matches.forEach((match, idx) => {
      const home = ensureTeam(match?.home), away = ensureTeam(match?.away);
      if (!home || !away || getMatchStatus(match, 0, idx) !== "completed") return;
      home.matchesPlayed++; away.matchesPlayed++;
      home.matchPoints += Number(getFixtureMatchPoints(match, "home") || 0);
      away.matchPoints += Number(getFixtureMatchPoints(match, "away") || 0);
    });
    const rows = [...statsMap.values()].sort((a, b) =>
      (b.matchPoints - a.matchPoints) || (b.matchesPlayed - a.matchesPlayed) ||
      String(a.teamName).localeCompare(String(b.teamName)));
    const qualCount = Number(getAdvancedSettings()?.qualifierCount || 0) || Math.min(4, rows.length);
    return rows.map((row, idx) => ({ ...row, rank: idx + 1, qualified: idx < qualCount }));
  }

  async function loadLeaderboardFromDb() {
    if (isTournamentTeamEvent()) {
      state.leaderboardState.rows = buildTeamLeaderboardRowsFromFixtures(); return;
    }
    const categoryId = String(
      state.activeFilter === "all"
        ? (state.tournamentCategories?.[0]?.categoryId || state.tournamentCategories?.[0]?.id || "")
        : state.activeFilter
    );
    if (!categoryId) { state.leaderboardState.rows = []; return; }
    const r = await apiGet(`/api/host/tournaments/${encodeURIComponent(tournamentId)}/leaderboard?categoryId=${encodeURIComponent(categoryId)}`);
    state.leaderboardState.rows = r.ok
      ? (Array.isArray(r.data?.rows) ? r.data.rows : Array.isArray(r.data) ? r.data : [])
      : [];
  }

  function renderLeaderboard() {
    if (!leaderboardSection || !leaderboardTableBody) return;
    if (isTournamentTeamEvent()) state.leaderboardState.rows = buildTeamLeaderboardRowsFromFixtures();
    leaderboardTableBody.innerHTML = "";
    if (!state.leaderboardState.rows.length) {
      leaderboardTableBody.innerHTML = `<tr><td colspan="5" class="muted">No leaderboard data yet.</td></tr>`;
      return;
    }
    state.leaderboardState.rows.forEach((row, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(row.rank ?? idx + 1)}</td>
        <td>${escapeHtml(row.teamName || row.team || "—")}</td>
        <td>${escapeHtml(row.matchPoints ?? 0)}</td>
        <td>${escapeHtml(row.matchesPlayed ?? 0)}</td>
        <td>${escapeHtml(row.qualified ? "Yes" : "No")}</td>`;
      leaderboardTableBody.appendChild(tr);
    });
  }

  // ── Init captains module ────────────────────────────────────────────────────
  initCaptains(tournamentId, {
    renderCaptainsSummary,
    refreshStageSpecificUi,
    syncTeamSetupUi,
    loadPlayers,
  });

  // ── Init fixtures module (deferred — pass refs it needs) ──────────────────
  // We import players-fixtures lazily, but pre-configure it so it's ready when loaded
  import("./players-fixtures.js").then(({ initFixtures, updateGoToKnockoutButton }) => {
    initFixtures(tournamentId, fixturesUi, {
      renderLeaderboard,
      loadLeaderboardFromDb,
      showToast,
    });
  }).catch(() => {});

  // FIX 7: Parallel startup fetches
  await loadTournamentMeta();
  await Promise.all([
    loadPlayers(),
    refreshTeamSetupState(),
    loadPoolsFromDb(),
    loadLeaderboardFromDb(),
  ]);

  // FIX 10: Umpires always see fixtures — load eagerly for them
  if (isLoggedInUserUmpire()) {
    _fixturesLoaded = true;
    const { openAndLoadFixtures } = await import("./players-fixtures.js");
    await openAndLoadFixtures();
  }

  // FIX 3: applyUmpireViewMode already called inside loadTournamentMeta — not duplicated here

  renderPlayers();
  renderCaptainsSummary();
  renderLeaderboard();
  refreshStageSpecificUi();
  syncAddPlayerCategoryUi();
  syncPlayersListUi();
  syncTeamSetupUi();
  syncLeaderboardUi();
  syncFixturesUi();

  // Start polling only after fixtures module is ready
  import("./players-fixtures.js")
    .then(({ startFixturesBackendPolling }) => startFixturesBackendPolling())
    .catch(() => {});
});
