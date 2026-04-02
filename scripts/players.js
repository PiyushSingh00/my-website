import { requireAuth, logout } from "./auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;

  // ===========================================================================
  // TOPBAR / MODE / BASIC PAGE STATE
  // ===========================================================================
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
  });

  const params = new URLSearchParams(window.location.search);
  const tournamentId = params.get("tournamentId");
  if (!tournamentId) {
    alert("Missing tournamentId in URL");
    return;
  }

  document
    .getElementById("players-back-btn")
    ?.addEventListener("click", () => (window.location.href = "host.html"));

  // ===========================================================================
  // DOM REFS
  // ===========================================================================
  const tableWrapper = document.getElementById("players-table-wrapper");
  const tableBody = document.getElementById("players-table-body");
  const emptyState = document.getElementById("players-empty-state");

  const titleEl = document.getElementById("players-tournament-name");
  const sportEl = document.getElementById("players-tournament-sport");
  const datesEl = document.getElementById("players-tournament-dates");
  const codeEl = document.getElementById("players-tournament-code");

  const playersTabs = document.getElementById("players-tabs");

  // Add player modal
  const addPlayerBtn = document.getElementById("add-player-btn");
  const addPlayerModal = document.getElementById("host-add-player-modal");
  const addPlayerClose = document.getElementById("host-add-player-close");
  const addPlayerForm = document.getElementById("host-add-player-form");
  const addPlayerCategory = document.getElementById("host-player-category");

  // Captain modals
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

  // Pools
  const poolsSection = document.getElementById("pools-section");
  const poolsGrid = document.getElementById("pools-grid");
  const unassignedTeams = document.getElementById("unassigned-teams");
  const resetPoolsBtn = document.getElementById("reset-pools-btn");
  const randomizePoolsBtn = document.getElementById("randomize-pools-btn");

  // Embedded fixtures
  const fixturesEmbed = document.getElementById("fixtures-embed");
  const fixturesGenerateBtn = document.getElementById("fixtures-generate-btn");
  const fixturesConfigureBtn = document.getElementById("fixtures-configure-fields-btn");
  const fixturesEditBtn = document.getElementById("fixtures-edit-btn");
  const fixturesToggle = document.getElementById("fixtures-toggle");
  const fixturesGroups = document.getElementById("fixtures-groups");
  const fixturesNoneSelected = document.getElementById("fixtures-none-selected");
  const fixturesToast = document.getElementById("fixtures-toast");
  const createFixturesBtn = document.getElementById("create-fixtures-btn");

  // Optional future blocks
  const teamNumberSection = document.getElementById("team-number-section");
  const teamNumberList = document.getElementById("team-number-list");
  const randomizeTeamNumbersBtn = document.getElementById("randomize-team-numbers-btn");
  const saveTeamNumbersBtn = document.getElementById("save-team-numbers-btn");
  const lockTeamNumbersBtn = document.getElementById("lock-team-numbers-btn");

  const lineupReviewSection = document.getElementById("lineup-review-section");
  const lineupReviewList = document.getElementById("lineup-review-list");

  const leaderboardSection = document.getElementById("leaderboard-section");
  const leaderboardTableBody = document.getElementById("leaderboard-table-body");

  // ===========================================================================
  // STATE
  // ===========================================================================
  let allPlayers = [];
  let activeFilter = "all";
  let tournamentCategories = [];
  let tournamentMetaCache = null;

  let captainState = {
    selectedCaptainIds: [],
    confirmedCaptains: [],
    pools: null,
  };

  let teamNumberState = {
    assignments: [],
    locked: false,
  };

  let lineupState = {
    ties: [],
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
    isOpen: false,
    didInit: false,
  };

  const fixturesState = {
    categories: [],
    players: [],
    acceptedByCategory: {},
    fixtures: null,
    activeCategoryId: null,
    editMode: false,
  };

  // ===========================================================================
  // HELPERS
  // ===========================================================================
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
    for (let i = a.length - 1; i > 0; i--) {
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

  // ===========================================================================
  // TOURNAMENT META
  // ===========================================================================
  async function loadTournamentMeta() {
    const host = await apiGet("/api/host/tournaments");
    if (host.ok) {
      const list = normalizeTournamentList(host.data);
      const t = list.find((x) => String(x.tournamentId ?? x.id) === String(tournamentId));
      if (t) {
        tournamentMetaCache = t;
        hydrateTournamentMetaUi(t);
        return;
      }
    }

    const pub = await apiGet("/api/tournaments");
    if (pub.ok) {
      const list = normalizeTournamentList(pub.data);
      const t = list.find((x) => String(x.tournamentId ?? x.id) === String(tournamentId));
      if (t) {
        tournamentMetaCache = t;
        hydrateTournamentMetaUi(t);
      }
    }
  }

  function hydrateTournamentMetaUi(t) {
    titleEl && (titleEl.textContent = t.tournamentName ?? "Tournament");
    sportEl && (sportEl.textContent = t.sportName ?? "");
    datesEl && (datesEl.textContent = t.tournamentDates ?? "");
    codeEl && (codeEl.textContent = t.accessCode ?? "");
    tournamentCategories = normalizeCategories(t.categories);
    refreshStageSpecificUi();
    renderPlayerTabs();
  }

  function refreshStageSpecificUi() {
    const isGroupKnockout = tournamentMetaCache?.stageFormat === "group_knockout";
    const hasConfirmed = captainState.confirmedCaptains.length > 0;

    if (!isGroupKnockout) {
      createPoolsBtn?.classList.add("hidden");
      poolsSection?.classList.add("hidden");
    } else {
      createPoolsBtn?.classList.toggle("hidden", !hasConfirmed);
    }

    if (teamNumberSection) {
      const advancedMode =
        tournamentMetaCache?.advancedSettings?.advancedMode ||
        safeJson(tournamentMetaCache?.advancedSettings, {})?.advancedMode ||
        "";
      const showTeamNumbers =
        tournamentMetaCache?.stageFormat === "number_draw_league_knockout" ||
        advancedMode === "pickleball_team_league";
      teamNumberSection.classList.toggle("hidden", !showTeamNumbers);
    }

    if (lineupReviewSection) {
      lineupReviewSection.classList.toggle("hidden", !hasConfirmed);
    }

    if (leaderboardSection) {
      const shouldShow =
        tournamentMetaCache?.stageFormat === "round_robin" ||
        tournamentMetaCache?.stageFormat === "group_knockout" ||
        tournamentMetaCache?.stageFormat === "number_draw_league_knockout";
      leaderboardSection.classList.toggle("hidden", !shouldShow);
    }
  }

  // ===========================================================================
  // PLAYERS TABLE / FILTERS
  // ===========================================================================
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
      btn.dataset.playerFilter = tab.key;
      btn.innerHTML = `
        <span>${escapeHtml(tab.label)}</span>
        <span class="tab-count">${tab.count}</span>
      `;
      btn.addEventListener("click", () => {
        activeFilter = tab.key;
        renderPlayerTabs();
        renderPlayers();
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
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" class="muted">No players in this category.</td>
        </tr>
      `;
      return;
    }

    filtered.forEach((player) => {
      const status = normalizeStatusPlayersPage(player);
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${escapeHtml(getPlayerDisplayName(player))}</td>
        <td>${escapeHtml(player.age ?? "—")}</td>
        <td>${escapeHtml(player.gender ?? "—")}</td>
        <td>
          <span class="status-pill ${statusClass(status)}">${statusLabel(status)}</span>
        </td>
        <td>
          <div class="row-actions">
            <button
              type="button"
              class="action-btn accept"
              data-action="accept"
              ${status === "accepted" ? "disabled" : ""}
            >
              Accept
            </button>
            <button
              type="button"
              class="action-btn reject"
              data-action="reject"
              ${status === "rejected" ? "disabled" : ""}
            >
              Reject
            </button>
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
      const opts = {
        method: c.method,
        headers: c.body ? { "Content-Type": "application/json" } : undefined,
        body: c.body || undefined,
      };
      const r = await apiJson(c.url, opts);
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

  // ===========================================================================
  // ADD PLAYER MODAL
  // ===========================================================================
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
    if (!addPlayerModal) return;
    populateAddPlayerCategoryOptions();
    addPlayerForm?.reset();
    addPlayerModal.classList.remove("hidden");
    addPlayerModal.setAttribute("aria-hidden", "false");
  }

  function closeAddPlayerModal() {
    if (!addPlayerModal) return;
    addPlayerModal.classList.add("hidden");
    addPlayerModal.setAttribute("aria-hidden", "true");
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

  // ===========================================================================
  // CAPTAINS
  // ===========================================================================
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
      const categoryId = getPlayerCategoryId(player);

      const row = document.createElement("label");
      row.className = "captain-pick-row";
      row.innerHTML = `
        <div class="captain-pick-left">
          <input class="captain-checkbox" type="checkbox" value="${escapeHtml(playerId)}" ${checked ? "checked" : ""} />
          <div>
            <div class="captain-pick-name">${escapeHtml(getPlayerDisplayName(player))}</div>
            <div class="captain-pick-meta">${escapeHtml(getCategoryNameById(categoryId))}</div>
          </div>
        </div>
      `;
      makeCaptainsList.appendChild(row);
    });
  }

  makeCaptainsSaveBtn?.addEventListener("click", () => {
    const selected = Array.from(makeCaptainsList.querySelectorAll(".captain-checkbox:checked")).map((el) =>
      String(el.value)
    );
    captainState.selectedCaptainIds = selected;
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
      const teamNameInput = confirmCaptainsList.querySelector(
        `.confirm-team-name-input[data-player-id="${CSS.escape(playerId)}"]`
      );

      return {
        playerId,
        playerName: getPlayerDisplayName(player),
        categoryId: getPlayerCategoryId(player),
        teamName: teamNameInput?.value?.trim() || `Team ${index + 1}`,
      };
    });

    try {
      await saveCaptainStateToDb();
      closeConfirmCaptainsModal();
      renderCaptainsSummary();
      refreshStageSpecificUi();
      renderTeamNumberAssignment();
    } catch (err) {
      alert(err.message || "Could not save captains.");
    }
  });

  function renderCaptainsSummary() {
    if (!captainsSummarySection) return;

    captainsSummarySection.classList.remove("hidden");
    captainsSummaryList.innerHTML = "";

    if (!captainState.confirmedCaptains.length) {
      captainsSummaryEmpty?.classList.remove("hidden");
      return;
    }

    captainsSummaryEmpty?.classList.add("hidden");

    captainState.confirmedCaptains.forEach((captain) => {
      const card = document.createElement("div");
      card.className = "captain-summary-card";
      card.innerHTML = `
        <div class="captain-summary-left">
          <div class="captain-summary-name">${escapeHtml(captain.playerName)}</div>
          <div class="captain-summary-meta">${escapeHtml(getCategoryNameById(captain.categoryId))}</div>
        </div>
        <div class="team-name-chip">${escapeHtml(captain.teamName || "—")}</div>
      `;
      captainsSummaryList.appendChild(card);
    });
  }

  // ===========================================================================
  // POOLS
  // ===========================================================================
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

  function getConfirmedTeams() {
    return captainState.confirmedCaptains.map((captain) => ({
      teamKey: `captain:${captain.playerId}`,
      captainId: captain.playerId,
      captainName: captain.playerName,
      teamName: captain.teamName || captain.playerName,
      categoryId: captain.categoryId,
    }));
  }

  function buildEmptyPools() {
    const pools = { groups: {}, unassigned: [] };
    const groupCount = Number(tournamentMetaCache?.groupCount || 0);
    for (let i = 1; i <= groupCount; i++) {
      pools.groups[`Pool ${i}`] = [];
    }
    return pools;
  }

  function buildRandomPools(teams, groupCount) {
    const pools = buildEmptyPools();
    const shuffledTeams = shuffle([...teams]);
    const poolNames = Object.keys(pools.groups);

    shuffledTeams.forEach((team, index) => {
      const poolIndex = index % groupCount;
      const poolName = poolNames[poolIndex];
      pools.groups[poolName].push(team.teamKey);
    });

    return pools;
  }

  function ensurePoolsState() {
    const teams = getConfirmedTeams();
    const validKeys = new Set(teams.map((t) => t.teamKey));
    const groupCount = Number(tournamentMetaCache?.groupCount || 0);

    if (
      !captainState.pools ||
      !captainState.pools.groups ||
      Object.keys(captainState.pools.groups).length !== groupCount
    ) {
      captainState.pools = buildEmptyPools();
    }

    const allPlaced = new Set();

    Object.keys(captainState.pools.groups).forEach((poolName) => {
      captainState.pools.groups[poolName] = (captainState.pools.groups[poolName] || []).filter((teamKey) => {
        const ok = validKeys.has(teamKey) && !allPlaced.has(teamKey);
        if (ok) allPlaced.add(teamKey);
        return ok;
      });
    });

    captainState.pools.unassigned = (captainState.pools.unassigned || []).filter((teamKey) => {
      const ok = validKeys.has(teamKey) && !allPlaced.has(teamKey);
      if (ok) allPlaced.add(teamKey);
      return ok;
    });

    teams.forEach((team) => {
      if (!allPlaced.has(team.teamKey)) {
        captainState.pools.unassigned.push(team.teamKey);
      }
    });
  }

  function openPoolsSection() {
    if (tournamentMetaCache?.stageFormat !== "group_knockout") return;

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
    if (tournamentMetaCache?.stageFormat !== "group_knockout") return;

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
    if (tournamentMetaCache?.stageFormat !== "group_knockout") return;

    const teams = getConfirmedTeams();
    if (!teams.length) {
      alert("Please confirm captains first.");
      return;
    }

    captainState.pools = buildEmptyPools();
    teams.forEach((team) => {
      captainState.pools.unassigned.push(team.teamKey);
    });

    try {
      await savePoolsToDb();
      renderPools();
    } catch (err) {
      alert(err.message || "Could not save pools.");
    }
  });

  function moveTeamToZone(teamKey, zoneName) {
    Object.keys(captainState.pools.groups).forEach((poolName) => {
      captainState.pools.groups[poolName] = captainState.pools.groups[poolName].filter(
        (key) => key !== teamKey
      );
    });

    captainState.pools.unassigned = captainState.pools.unassigned.filter((key) => key !== teamKey);

    if (zoneName === "unassigned") {
      captainState.pools.unassigned.push(teamKey);
    } else {
      captainState.pools.groups[zoneName] = captainState.pools.groups[zoneName] || [];
      captainState.pools.groups[zoneName].push(teamKey);
    }
  }

  function renderPools() {
    if (tournamentMetaCache?.stageFormat !== "group_knockout") return;
    if (!captainState.pools) ensurePoolsState();
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

      card.addEventListener("dragstart", () => {
        card.classList.add("dragging");
      });

      card.addEventListener("dragend", () => {
        card.classList.remove("dragging");
      });

      return card;
    }

    function wireDropzone(dropzone, zoneName) {
      dropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropzone.classList.add("drag-over");
      });

      dropzone.addEventListener("dragleave", () => {
        dropzone.classList.remove("drag-over");
      });

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
      col.innerHTML = `
        <h3>${escapeHtml(poolName)}</h3>
        <div class="team-dropzone" data-pool="${escapeHtml(poolName)}"></div>
      `;

      const dropzone = col.querySelector(".team-dropzone");
      wireDropzone(dropzone, poolName);

      (captainState.pools.groups[poolName] || []).forEach((teamKey) => {
        const card = createTeamCard(teamKey);
        if (card) dropzone.appendChild(card);
      });

      poolsGrid.appendChild(col);
    });
  }

  // ===========================================================================
  // TEAM NUMBER ASSIGNMENT (OPTIONAL NEW BLOCK)
  // ===========================================================================
  async function loadTeamNumbersFromDb() {
    const r = await apiGet(`/api/host/tournaments/${encodeURIComponent(tournamentId)}/team-numbers`);
    if (r.ok && r.data) {
      teamNumberState.assignments = Array.isArray(r.data.assignments) ? r.data.assignments : [];
      teamNumberState.locked = !!r.data.locked;
    } else {
      teamNumberState.assignments = [];
      teamNumberState.locked = false;
    }
  }

  async function saveTeamNumbersToDb() {
    const r = await apiPut(`/api/host/tournaments/${encodeURIComponent(tournamentId)}/team-numbers`, {
      assignments: teamNumberState.assignments,
      locked: teamNumberState.locked,
    });
    if (!r.ok) throw new Error("Could not save team numbers.");
  }

  function buildDefaultTeamNumberAssignments() {
    const teams = getConfirmedTeams();
    const fixedCount =
      Number(tournamentMetaCache?.advancedSettings?.fixedTeamCount) ||
      Number(safeJson(tournamentMetaCache?.advancedSettings, {})?.fixedTeamCount) ||
      teams.length;

    teamNumberState.assignments = teams.slice(0, fixedCount).map((team, idx) => ({
      teamNumber: idx + 1,
      teamKey: team.teamKey,
      teamName: team.teamName,
      captainName: team.captainName,
    }));
  }

  function renderTeamNumberAssignment() {
    if (!teamNumberSection || !teamNumberList) return;

    const teams = getConfirmedTeams();
    if (!teams.length) {
      teamNumberList.innerHTML = `<div class="muted">Confirm captains first.</div>`;
      return;
    }

    if (!teamNumberState.assignments.length) {
      buildDefaultTeamNumberAssignments();
    }

    teamNumberList.innerHTML = "";

    teamNumberState.assignments.forEach((row, idx) => {
      const wrapper = document.createElement("div");
      wrapper.className = "team-number-row";

      const options = teams
        .map(
          (team) => `
            <option value="${escapeHtml(team.teamKey)}" ${team.teamKey === row.teamKey ? "selected" : ""}>
              ${escapeHtml(team.teamName)} — ${escapeHtml(team.captainName)}
            </option>
          `
        )
        .join("");

      wrapper.innerHTML = `
        <div class="team-number-chip">Team ${idx + 1}</div>
        <select class="team-number-select" data-index="${idx}" ${teamNumberState.locked ? "disabled" : ""}>
          ${options}
        </select>
      `;

      teamNumberList.appendChild(wrapper);
    });

    teamNumberList.querySelectorAll(".team-number-select").forEach((sel) => {
      sel.addEventListener("change", () => {
        const index = Number(sel.dataset.index);
        const picked = teams.find((t) => t.teamKey === sel.value);
        if (!picked) return;
        teamNumberState.assignments[index] = {
          teamNumber: index + 1,
          teamKey: picked.teamKey,
          teamName: picked.teamName,
          captainName: picked.captainName,
        };
      });
    });
  }

  randomizeTeamNumbersBtn?.addEventListener("click", () => {
    const teams = shuffle(getConfirmedTeams());
    teamNumberState.assignments = teams.map((team, idx) => ({
      teamNumber: idx + 1,
      teamKey: team.teamKey,
      teamName: team.teamName,
      captainName: team.captainName,
    }));
    renderTeamNumberAssignment();
  });

  saveTeamNumbersBtn?.addEventListener("click", async () => {
    try {
      await saveTeamNumbersToDb();
      alert("Team numbers saved.");
    } catch (err) {
      alert(err.message || "Could not save team numbers.");
    }
  });

  lockTeamNumbersBtn?.addEventListener("click", async () => {
    teamNumberState.locked = true;
    try {
      await saveTeamNumbersToDb();
      renderTeamNumberAssignment();
      alert("Team numbers locked.");
    } catch (err) {
      alert(err.message || "Could not lock team numbers.");
    }
  });

  // ===========================================================================
  // LINEUP REVIEW (OPTIONAL NEW BLOCK)
  // ===========================================================================
  async function loadLineupsFromDb() {
    const r = await apiGet(`/api/host/tournaments/${encodeURIComponent(tournamentId)}/lineups`);
    lineupState.ties = r.ok && Array.isArray(r.data?.ties) ? r.data.ties : [];
  }

  function renderLineupReview() {
    if (!lineupReviewSection || !lineupReviewList) return;

    lineupReviewList.innerHTML = "";

    if (!lineupState.ties.length) {
      lineupReviewList.innerHTML = `<div class="muted">No lineup submissions yet.</div>`;
      return;
    }

    lineupState.ties.forEach((tie) => {
      const card = document.createElement("div");
      card.className = "lineup-review-card";
      card.innerHTML = `
        <div class="lineup-review-head">
          <strong>${escapeHtml(tie.teamA || "Team A")} vs ${escapeHtml(tie.teamB || "Team B")}</strong>
          <span class="status-pill ${tie.locked ? "status-pill--accepted" : "status-pill--pending"}">
            ${tie.locked ? "Locked" : "Pending"}
          </span>
        </div>
      `;
      lineupReviewList.appendChild(card);
    });
  }

  // ===========================================================================
  // LEADERBOARD (OPTIONAL NEW BLOCK)
  // ===========================================================================
  async function loadLeaderboardFromDb() {
    const r = await apiGet(`/api/host/tournaments/${encodeURIComponent(tournamentId)}/leaderboard`);
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
      leaderboardTableBody.innerHTML = `
        <tr><td colspan="6" class="muted">No leaderboard data yet.</td></tr>
      `;
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

  // ===========================================================================
  // FIXTURES EMBED
  // ===========================================================================
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

  function ensureMatchMeta(m) {
    if (!m || typeof m !== "object") return m;
    if (!m.matchId) m.matchId = makeMatchId();
    if (!Array.isArray(m.homePlayers)) m.homePlayers = splitTeamName(m.home);
    if (!Array.isArray(m.awayPlayers)) m.awayPlayers = splitTeamName(m.away);
    return m;
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
    const dropped = [];
    const teamMap = {};

    if (size === 1) {
      shuffled.forEach((n) => (teamMap[n] = [n]));
      return { entrants: shuffled, dropped: [], teamMap };
    }

    for (let i = 0; i < shuffled.length; i += size) {
      const chunk = shuffled.slice(i, i + size);
      if (chunk.length < size) {
        dropped.push(...chunk);
        continue;
      }
      const teamName = chunk.join(" + ");
      entrants.push(teamName);
      teamMap[teamName] = chunk;
    }

    return { entrants, dropped, teamMap };
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
      const home = list[i];
      const away = list[i + 1];
      round1.push(
        ensureMatchMeta({
          home,
          away,
          homePlayers: rosterOf(home),
          awayPlayers: rosterOf(away),
        })
      );
    }
    rounds.push(round1);

    for (let r = 1; r < totalRounds; r++) {
      const prev = rounds[r - 1];
      const next = [];
      for (let i = 0; i < prev.length; i += 2) {
        next.push(
          ensureMatchMeta({
            home: "TBD",
            away: "TBD",
            homePlayers: [],
            awayPlayers: [],
          })
        );
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

  async function loadFixturesFromDb() {
    const r = await apiGet(`/api/host/tournaments/${encodeURIComponent(tournamentId)}/fixtures`);
    if (!r.ok) return null;
    return r.data?.data || r.data;
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

  function renderCategoryToggles() {
    if (!fixturesUi.toggleWrap) return;

    fixturesUi.toggleWrap.innerHTML = "";
    const catList = fixturesState.categories
      .map((c) => ({
        id: c.categoryId || c.id,
        label: categoryLabel(c),
      }))
      .filter((x) => x.id);

    if (!catList.length) {
      fixturesUi.toggleWrap.innerHTML = `<div class="muted">No categories found.</div>`;
      return;
    }

    catList.forEach((c) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "toggle-btn";
      btn.textContent = c.label;

      if (String(fixturesState.activeCategoryId) === String(c.id)) {
        btn.classList.add("active");
      }

      btn.addEventListener("click", () => {
        fixturesState.activeCategoryId = c.id;
        fixturesUi.toggleWrap
          .querySelectorAll("button")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        if (fixturesUi.noneSelectedEl) fixturesUi.noneSelectedEl.style.display = "none";
        renderCategoryBracket(c.id);
      });

      fixturesUi.toggleWrap.appendChild(btn);
    });
  }

  function buildFixtureCard(m, r, i) {
    const home = m?.home ?? "BYE";
    const away = m?.away ?? "BYE";
    const homeBye = String(home).toUpperCase() === "BYE";
    const awayBye = String(away).toUpperCase() === "BYE";

    return `
      <div class="bk-card">
        <div class="fixture-line">
          <span>${escapeHtml(home)}</span>
        </div>
        <div class="fixture-line">
          <span>${escapeHtml(away)}</span>
        </div>
        <div class="fixture-actions">
          ${
            !homeBye && !awayBye
              ? `
            <button
              type="button"
              class="start-scoring-btn btn-dark"
              data-tournament-id="${escapeHtml(tournamentId)}"
              data-category-id="${escapeHtml(fixturesState.activeCategoryId || "")}"
              data-round="${r}"
              data-match="${i}"
            >
              Start scoring
            </button>
          `
              : ""
          }
        </div>
      </div>
    `;
  }

  function renderCategoryBracket(categoryId) {
    if (!fixturesUi.groupsEl) return;
    fixturesUi.groupsEl.innerHTML = "";

    const cat = fixturesState.fixtures?.categories?.[categoryId];
    if (!cat || !Array.isArray(cat.rounds) || !cat.rounds.length) {
      const acceptedNames = fixturesState.acceptedByCategory[categoryId] || [];
      fixturesUi.groupsEl.innerHTML = `
        <div class="empty-state" style="display:flex;">
          <div class="feature-icon">🧩</div>
          <h3>No fixtures yet</h3>
          <p class="muted">
            ${acceptedNames.length < 2
              ? "Not enough accepted players to generate fixtures."
              : "Click “Regenerate fixtures” to create the bracket."}
          </p>
        </div>
      `;
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "fixtures-group";

    const title = document.createElement("h3");
    title.className = "fixtures-group-title";
    title.textContent = cat.label || "Category";
    wrapper.appendChild(title);

    const roundsWrap = document.createElement("div");
    roundsWrap.className = "fixtures-rounds";

    cat.rounds.forEach((round, r) => {
      const col = document.createElement("div");
      col.className = "fixtures-round-col";
      col.innerHTML = `<div class="round-title">${escapeHtml(getRoundLabel(r, cat.totalRounds || cat.rounds.length))}</div>`;

      round.forEach((m, i) => {
        const item = document.createElement("div");
        item.className = "fixtures-round-match";
        item.innerHTML = buildFixtureCard(m, r, i);
        col.appendChild(item);
      });

      roundsWrap.appendChild(col);
    });

    wrapper.appendChild(roundsWrap);
    fixturesUi.groupsEl.appendChild(wrapper);
  }

  async function generateAndSaveFixtures() {
    const newFixtures = { categories: {} };
    let createdAny = false;

    fixturesState.categories.forEach((c) => {
      const cid = c.categoryId || c.id;
      if (!cid) return;

      const names = fixturesState.acceptedByCategory[cid] || [];
      const teamSize = Number(c.teamSize || 1);

      const { entrants } = buildEntrants(names, teamSize);
      const bracket = createBracket(entrants);

      newFixtures.categories[cid] = {
        categoryId: cid,
        label: categoryLabel(c),
        ...(bracket ? bracket : { rounds: [], totalRounds: 0 }),
      };

      if (bracket) createdAny = true;
    });

    if (!createdAny) {
      showToast("Not enough accepted players to regenerate fixtures");
      return;
    }

    const r = await apiPost(
      `/api/host/tournaments/${encodeURIComponent(tournamentId)}/fixtures/update`,
      newFixtures
    );

    if (!r.ok) {
      showToast("Failed to regenerate fixtures");
      return;
    }

    fixturesState.fixtures = r.data || newFixtures;
    fixturesState.editMode = false;

    showToast("Fixtures regenerated");
    renderCategoryToggles();
    if (fixturesState.activeCategoryId) renderCategoryBracket(fixturesState.activeCategoryId);
  }

  async function initFixturesIfNeeded() {
    if (fixturesUi.didInit) return;
    fixturesUi.didInit = true;

    fixturesUi.groupsEl?.addEventListener("click", (e) => {
      const btn = e.target.closest(".start-scoring-btn");
      if (!btn) return;

      const tId = btn.dataset.tournamentId || "";
      const cId = btn.dataset.categoryId || "";
      const round = btn.dataset.round || "0";
      const match = btn.dataset.match || "0";

      window.location.href = `score.html?tournamentId=${tId}&categoryId=${cId}&round=${round}&match=${match}`;
    });

    fixturesUi.configureBtn?.addEventListener("click", () => {
      if (!fixturesState.activeCategoryId) {
        showToast("Select a category first");
        return;
      }
      window.location.href =
        `schema.html?tournamentId=${encodeURIComponent(tournamentId)}` +
        `&categoryId=${encodeURIComponent(fixturesState.activeCategoryId)}`;
    });

    fixturesUi.generateBtn?.addEventListener("click", async () => {
      await generateAndSaveFixtures();
    });

    fixturesUi.editBtn?.addEventListener("click", () => {
      showToast("Edit fixtures flow is not enabled in this version.");
    });
  }

  async function openAndLoadFixtures() {
    fixturesUi.wrap?.classList.remove("hidden");
    fixturesUi.isOpen = true;

    await initFixturesIfNeeded();

    fixturesState.categories = tournamentCategories || [];
    fixturesState.players = allPlayers || [];
    computeAcceptedByCategory();

    const existing = await loadFixturesFromDb();
    if (existing) {
      fixturesState.fixtures = migrateFixtures(existing);
    } else {
      fixturesState.fixtures = { categories: {} };
    }

    fixturesState.activeCategoryId =
      fixturesState.activeCategoryId ||
      String(fixturesState.categories?.[0]?.categoryId || fixturesState.categories?.[0]?.id || "");

    renderCategoryToggles();

    if (fixturesState.activeCategoryId) {
      if (fixturesUi.noneSelectedEl) fixturesUi.noneSelectedEl.style.display = "none";
      renderCategoryBracket(fixturesState.activeCategoryId);
    } else if (fixturesUi.noneSelectedEl) {
      fixturesUi.noneSelectedEl.style.display = "flex";
    }

    fixturesUi.wrap?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  createFixturesBtn?.addEventListener("click", openAndLoadFixtures);

  // ===========================================================================
  // LOAD EVERYTHING
  // ===========================================================================
  await loadTournamentMeta();
  await loadPlayers();
  await loadCaptainStateFromDb();
  await loadPoolsFromDb();
  await loadTeamNumbersFromDb();
  await loadLineupsFromDb();
  await loadLeaderboardFromDb();

  renderPlayers();
  renderCaptainsSummary();
  renderTeamNumberAssignment();
  renderLineupReview();
  renderLeaderboard();
  refreshStageSpecificUi();
});