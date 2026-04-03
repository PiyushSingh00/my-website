import { requireAuth, logout } from "./auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;

  const params = new URLSearchParams(window.location.search);
  const tournamentId = params.get("tournamentId");

  if (!tournamentId) {
    alert("Missing tournamentId in URL.");
    window.location.href = "join.html";
    return;
  }

  let tournamentMeta = null;
  let allPlayers = [];
  let currentRule = {
    mode: "range",
    min: 1,
    max: 1,
    exact: 1,
    text: "Select players.",
  };

  let currentUserIsCaptain = false;
  let currentAcceptedInvite = null;
  let currentCaptainSubmission = null;

  const draftKey = `scheduleit_team_draft_${tournamentId}_${user.username || user.name || "user"}`;

  const trigger = document.getElementById("team-user-menu-trigger");
  const dropdown = document.getElementById("team-user-menu-dropdown");
  const playerBtn = document.getElementById("mode-player-btn");
  const hostBtn = document.getElementById("mode-host-btn");

  const backBtn = document.getElementById("team-back-btn");

  const teamTabs = document.querySelectorAll(".team-tab");
  const teamPanels = document.querySelectorAll(".team-tab-panel");
  const createTeamTabBtn = document.getElementById("create-team-tab-btn");
  const lineupTabBtn = document.getElementById("lineup-tab-btn");

  const teamForm = document.getElementById("team-form");
  const categoryWrap = document.getElementById("team-category-wrap");
  const categorySelect = document.getElementById("team-category-select");
  const teamRowsWrap = document.getElementById("team-player-rows");
  const addPlayerRowBtn = document.getElementById("add-player-row-btn");
  const saveDraftBtn = document.getElementById("save-draft-btn");
  const teamNameInput = document.getElementById("team-name-input");

  const tournamentNameEl = document.getElementById("team-tournament-name");
  const tournamentSportEl = document.getElementById("team-tournament-sport");
  const tournamentDatesEl = document.getElementById("team-tournament-dates");
  const pageTitleEl = document.getElementById("team-page-title");
  const pageSubtitleEl = document.getElementById("team-page-subtitle");
  const ruleTextEl = document.getElementById("team-rule-text");
  const ruleValueEl = document.getElementById("team-size-rule");
  const selectedCountEl = document.getElementById("selected-count");
  const requiredCountEl = document.getElementById("required-count");

  const myTeamNameEl = document.getElementById("my-team-name");
  const myTeamCaptainEl = document.getElementById("my-team-captain");
  const myTeamRoleEl = document.getElementById("my-team-role");
  const myTeamCategoryEl = document.getElementById("my-team-category");
  const myTeamPlayerListEl = document.getElementById("my-team-player-list");
  const myTeamEmptyStateEl = document.getElementById("my-team-empty-state");
  const myTeamEmptyTextEl = document.getElementById("my-team-empty-text");

  // ---------------------------------------------------------------------------
  // TOPBAR
  // ---------------------------------------------------------------------------
  if (trigger) {
    const label = String(user?.username || user?.name || user?.email || "U").trim();
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

  backBtn?.addEventListener("click", () => {
    window.location.href = "join.html";
  });

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------
  function normalizeIdentity(value) {
    return String(value || "").trim().toLowerCase();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function identitiesMatch(a, b) {
    return normalizeIdentity(a) && normalizeIdentity(a) === normalizeIdentity(b);
  }

  function isSameUserByInviteFields(invite, currentUser) {
    return (
      (invite?.inviteeUsername && identitiesMatch(invite.inviteeUsername, currentUser?.username)) ||
      (invite?.inviteeName && identitiesMatch(invite.inviteeName, currentUser?.name)) ||
      (invite?.inviteeName && identitiesMatch(invite.inviteeName, currentUser?.username))
    );
  }

  function isSameCaptain(submission, currentUser) {
    return (
      (submission?.captainUsername && identitiesMatch(submission.captainUsername, currentUser?.username)) ||
      (submission?.captainName && identitiesMatch(submission.captainName, currentUser?.name)) ||
      (submission?.createdBy && identitiesMatch(submission.createdBy, currentUser?.username)) ||
      (submission?.createdBy && identitiesMatch(submission.createdBy, currentUser?.name))
    );
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

  function getPlayerId(p) {
    return p.playerId ?? p.registrationId ?? p.id ?? p._id ?? p.pk ?? null;
  }

  function getPlayerName(p) {
    return p.playerName ?? p.name ?? p.fullName ?? p.username ?? "Player";
  }

  function getPlayerCategoryId(p) {
    return p.categoryId ?? p.category ?? p.categoryID ?? p.category_id ?? "";
  }

  function normalizeStatus(p) {
    const raw = p?.status ?? p?.registrationStatus ?? p?.state ?? "accepted";
    const s = String(raw).toLowerCase();
    if (["rejected", "reject", "declined", "denied"].includes(s)) return "rejected";
    if (["pending", "awaiting"].includes(s)) return "pending";
    return "accepted";
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

  function categoryLabel(c) {
    const age = c?.ageGroup ? String(c.ageGroup).trim() : "";
    const gender = c?.gender ? String(c.gender).trim() : "";
    const size = c?.teamSize ? Number(c.teamSize) : null;
    const exact = c?.exactTeamSize ? Number(c.exactTeamSize) : null;

    let type = "";
    if (size === 1) type = "Singles";
    else if (size === 2) type = "Doubles";
    else if (size === 3) type = "Triples";
    else if (size >= 4) type = exact ? `Team ${exact}` : "Team";

    const eventName = c?.eventName ? String(c.eventName).trim() : "";
    const parts = [eventName, age, gender, type].filter(Boolean);
    return parts.length ? parts.join(" • ") : (c?.categoryId || c?.id || "Category");
  }

  function getAcceptedPlayers() {
    return allPlayers.filter((p) => normalizeStatus(p) === "accepted");
  }

  function getCaptainDisplayName() {
    return currentCaptainSubmission?.captainName || user.name || user.username || "Captain";
  }

  function getCaptainIdentity() {
    return {
      username: user.username || "",
      name: user.name || user.username || "",
    };
  }

  function getTournamentCaptainState() {
    return tournamentMeta?.captainState || tournamentMeta?.captains || {};
  }

  function getOtherCaptainNamesForTournament() {
    const captainState = getTournamentCaptainState();
    const confirmed = Array.isArray(captainState?.confirmedCaptains) ? captainState.confirmedCaptains : [];

    return confirmed
      .map((c) => normalizeIdentity(c?.playerName))
      .filter(Boolean)
      .filter((name) => {
        const meByName = normalizeIdentity(user?.name);
        const meByUsername = normalizeIdentity(user?.username);
        return name !== meByName && name !== meByUsername;
      });
  }

  function isCaptainPlayerRecord(player) {
    const captain = getCaptainIdentity();

    return (
      (player?.username && identitiesMatch(player.username, captain.username)) ||
      (player?.playerName && identitiesMatch(player.playerName, captain.name)) ||
      (player?.name && identitiesMatch(player.name, captain.name))
    );
  }

  function isOtherCaptainPlayerRecord(player) {
    const otherCaptainNames = getOtherCaptainNamesForTournament();
    const playerName =
      normalizeIdentity(player?.playerName) ||
      normalizeIdentity(player?.name) ||
      normalizeIdentity(player?.username);

    return otherCaptainNames.includes(playerName);
  }

  function getSelectablePlayersForTeam(categoryId) {
    const pool =
      tournamentMeta?.tournamentType === "team"
        ? getAcceptedPlayers()
        : getPlayersForCategory(categoryId);

    return pool.filter((player) => {
      if (isCaptainPlayerRecord(player)) return false;
      if (isOtherCaptainPlayerRecord(player)) return false;
      return true;
    });
  }

  function getCurrentCategory() {
    const categories = normalizeCategories(tournamentMeta?.categories);

    if (tournamentMeta?.tournamentType === "team") {
      return null;
    }

    return categories.find(
      (c) => String(c.categoryId || c.id) === String(categorySelect.value)
    ) || null;
  }

  function getPlayersForCategory(categoryId) {
    const accepted = getAcceptedPlayers();

    if (tournamentMeta?.tournamentType === "team") {
      return accepted;
    }

    return accepted.filter(
      (p) => String(getPlayerCategoryId(p)) === String(categoryId)
    );
  }

  function getSelectedValues() {
    return Array.from(teamRowsWrap.querySelectorAll(".team-player-select"))
      .map((select) => select.value)
      .filter(Boolean);
  }

  function getRuleForCategory(category) {
    if (!tournamentMeta) {
      return {
        mode: "range",
        min: 1,
        max: 1,
        exact: 1,
        text: "Select players.",
      };
    }

    const rules = tournamentMeta?.tournamentRules || {};
    const minPlayersPerTeam = Number(rules.minPlayersPerTeam || 1);
    const maxPlayersPerTeam = Number(rules.maxPlayersPerTeam || 1);

    if (tournamentMeta?.tournamentType === "team") {
      return {
        mode: minPlayersPerTeam === maxPlayersPerTeam ? "exact" : "range",
        min: minPlayersPerTeam,
        max: maxPlayersPerTeam,
        exact: minPlayersPerTeam,
        text:
          minPlayersPerTeam === maxPlayersPerTeam
            ? `Select exactly ${minPlayersPerTeam} players including captain.`
            : `Select ${minPlayersPerTeam} to ${maxPlayersPerTeam} players including captain.`,
      };
    }

    const teamSize = Number(category?.teamSize || 1);
    const exactTeamSize = Number(category?.exactTeamSize || 0);

    if (teamSize >= 4 && exactTeamSize >= 4) {
      return {
        mode: "exact",
        min: exactTeamSize,
        max: exactTeamSize,
        exact: exactTeamSize,
        text: `Select exactly ${exactTeamSize} players including captain.`,
      };
    }

    return {
      mode: "exact",
      min: teamSize,
      max: teamSize,
      exact: teamSize,
      text: `Select exactly ${teamSize} players including captain.`,
    };
  }

  function updateRuleUi() {
    if (!ruleTextEl || !ruleValueEl || !selectedCountEl || !requiredCountEl) return;

    ruleTextEl.textContent = currentRule.text || "Choose players to continue.";

    if (currentRule.mode === "exact") {
      ruleValueEl.textContent = `Exactly ${currentRule.exact}`;
      requiredCountEl.textContent = String(currentRule.exact);
    } else {
      ruleValueEl.textContent = `${currentRule.min} to ${currentRule.max}`;
      requiredCountEl.textContent = `${currentRule.min}-${currentRule.max}`;
    }

    const selected = getSelectedValues().length + 1; // include captain
    selectedCountEl.textContent = String(selected);
  }

  function makePlayerOptions(categoryId, currentValue = "") {
    const players = getSelectablePlayersForTeam(categoryId);
    const selected = new Set(getSelectedValues());

    return players
      .filter((p) => {
        const id = String(getPlayerId(p));
        return !selected.has(id) || id === String(currentValue);
      })
      .map((p) => {
        const id = String(getPlayerId(p));
        return `<option value="${escapeHtml(id)}">${escapeHtml(getPlayerName(p))}</option>`;
      })
      .join("");
  }

  function renderPlayerRows(values = []) {
    teamRowsWrap.innerHTML = "";

    let categoryId = "";

    if (tournamentMeta?.tournamentType === "team") {
      categoryId = "__team_event__";
    } else {
      const category = getCurrentCategory();
      categoryId = category ? String(category.categoryId || category.id) : "";
    }

    values.forEach((value, idx) => {
      const row = document.createElement("div");
      row.className = "team-player-row";

      row.innerHTML = `
        <div class="player-slot-label">Player ${idx + 2}</div>
        <div class="player-slot">
          <select class="team-player-select">
            <option value="">Select player</option>
            ${makePlayerOptions(categoryId, value)}
          </select>
        </div>
        <button type="button" class="row-remove-btn" aria-label="Remove player">✕</button>
      `;

      const select = row.querySelector(".team-player-select");
      const removeBtn = row.querySelector(".row-remove-btn");

      select.value = value || "";

      select.addEventListener("change", () => {
        refreshAllPlayerDropdowns();
      });

      removeBtn.addEventListener("click", () => {
        const nextValues = getSelectedValues().filter((_, i) => i !== idx);

        if (currentRule.mode === "range" && nextValues.length + 1 < currentRule.min) {
          alert(`Minimum ${currentRule.min} players are required.`);
          return;
        }

        renderPlayerRows(nextValues);
        updateRuleUi();
      });

      teamRowsWrap.appendChild(row);
    });

    refreshAllPlayerDropdowns();
    updateRuleUi();
  }

  function refreshAllPlayerDropdowns() {
    const category = getCurrentCategory();
    const categoryId =
      tournamentMeta?.tournamentType === "team"
        ? "__team_event__"
        : (category ? String(category.categoryId || category.id) : "");

    if (!categoryId) return;

    const selects = Array.from(teamRowsWrap.querySelectorAll(".team-player-select"));

    selects.forEach((select) => {
      const current = select.value;
      select.innerHTML = `
        <option value="">Select player</option>
        ${makePlayerOptions(categoryId, current)}
      `;
      select.value = current;
    });

    selectedCountEl.textContent = String(getSelectedValues().length + 1);
  }

  function populateCategoryDropdown() {
    const categories = normalizeCategories(tournamentMeta?.categories);

    categorySelect.innerHTML = `<option value="">Select category</option>`;

    categories.forEach((category) => {
      const id = category.categoryId || category.id;
      if (!id) return;

      const option = document.createElement("option");
      option.value = id;
      option.textContent = categoryLabel(category);
      categorySelect.appendChild(option);
    });
  }

  function saveDraft(showMessage = true) {
    const payload = {
      teamName: teamNameInput.value.trim(),
      categoryId: tournamentMeta?.tournamentType === "team" ? "" : categorySelect.value,
      playerIds: getSelectedValues(),
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem(draftKey, JSON.stringify(payload));
    if (showMessage) alert("Team draft saved in browser.");
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function loadTournamentMeta() {
    const hostResp = await apiGet("/api/host/tournaments");
    if (hostResp.ok && Array.isArray(hostResp.data)) {
      const found = hostResp.data.find(
        (t) => String(t.tournamentId ?? t.id) === String(tournamentId)
      );
      if (found) return found;
    }

    const publicResp = await apiGet("/api/tournaments");
    if (publicResp.ok && Array.isArray(publicResp.data)) {
      const found = publicResp.data.find(
        (t) => String(t.tournamentId ?? t.id) === String(tournamentId)
      );
      if (found) return found;
    }

    return null;
  }

  async function loadPlayers() {
    const resp = await apiGet(`/api/tournaments/${encodeURIComponent(tournamentId)}/players`);
    if (!resp.ok) {
      alert("Could not load tournament players.");
      return [];
    }

    return Array.isArray(resp.data)
      ? resp.data
      : resp.data?.players || resp.data?.items || [];
  }

  async function loadTeamRequestsForTournament() {
    const candidates = [
      `/api/host/tournaments/${encodeURIComponent(tournamentId)}/team-requests`,
      `/api/tournaments/${encodeURIComponent(tournamentId)}/team-requests`,
    ];

    for (const url of candidates) {
      const resp = await apiGet(url);
      if (!resp.ok) continue;

      if (Array.isArray(resp.data)) return resp.data;
      if (Array.isArray(resp.data?.items)) return resp.data.items;
      if (Array.isArray(resp.data?.requests)) return resp.data.requests;
      if (Array.isArray(resp.data?.data)) return resp.data.data;
    }

    return [];
  }

  async function loadCaptainStateForTournament() {
    const resp = await apiGet(`/api/host/tournaments/${encodeURIComponent(tournamentId)}/captains`);
    if (!resp.ok) return null;
    return resp.data || null;
  }

  async function hydrateSubmissionState() {
    const requests = await loadTeamRequestsForTournament();
    const captainState = await loadCaptainStateForTournament();

    if (captainState) {
      tournamentMeta.captainState = captainState;
    }

    const myCaptainRequest = requests.find((req) => isSameCaptain(req, user));
    if (myCaptainRequest) {
      currentUserIsCaptain = true;
      currentCaptainSubmission = myCaptainRequest;
    } else {
      currentUserIsCaptain = false;
      currentCaptainSubmission = null;
    }

    const acceptedInvite = requests.find((req) => {
      const invited = Array.isArray(req?.invitedPlayers) ? req.invitedPlayers : [];
      return invited.some((invite) => {
        const sameUser = isSameUserByInviteFields(invite, user);
        return sameUser && invite.inviteStatus === "accepted";
      });
    });

    currentAcceptedInvite = acceptedInvite || null;
  }

  function hydratePage() {
    tournamentNameEl.textContent = tournamentMeta?.tournamentName || "-";
    tournamentSportEl.textContent = tournamentMeta?.sportName || "-";
    tournamentDatesEl.textContent = tournamentMeta?.tournamentDates || "-";

    const draft = loadDraft();
    if (draft?.teamName) teamNameInput.value = draft.teamName;

    if (tournamentMeta?.tournamentType === "team") {
      categoryWrap?.classList.add("hidden");
    } else {
      categoryWrap?.classList.remove("hidden");
      populateCategoryDropdown();
      if (draft?.categoryId) categorySelect.value = draft.categoryId;
    }

    const category = getCurrentCategory();
    currentRule = getRuleForCategory(category);
    updateRuleUi();

    if (tournamentMeta?.tournamentType === "team") {
      renderPlayerRows(Array.isArray(draft?.playerIds) ? draft.playerIds : []);
    } else if (draft?.categoryId && category) {
      renderPlayerRows(Array.isArray(draft.playerIds) ? draft.playerIds : []);
    } else {
      teamRowsWrap.innerHTML = "";
      updateRuleUi();
    }

    if (currentUserIsCaptain) {
      pageTitleEl.textContent = "Create / Manage team";
      pageSubtitleEl.textContent = "Invite players to your team and manage pending team requests.";
      createTeamTabBtn?.classList.remove("hidden");
      lineupTabBtn?.classList.remove("hidden");
    } else if (currentAcceptedInvite) {
      pageTitleEl.textContent = "My team";
      pageSubtitleEl.textContent = "View the team you are part of for this tournament.";
      createTeamTabBtn?.classList.add("hidden");
      lineupTabBtn?.classList.add("hidden");
    } else {
      pageTitleEl.textContent = "My team";
      pageSubtitleEl.textContent = "View your team or manage invites if you are the captain.";
      createTeamTabBtn?.classList.add("hidden");
      lineupTabBtn?.classList.add("hidden");
    }

    renderMyTeamPanel();
  }

  function renderMyTeamPanel() {
    myTeamPlayerListEl.innerHTML = "";

    const activeTeam = currentCaptainSubmission || currentAcceptedInvite;

    if (!activeTeam) {
      myTeamNameEl.textContent = "-";
      myTeamCaptainEl.textContent = "-";
      myTeamRoleEl.textContent = currentUserIsCaptain ? "Captain" : "Player";
      myTeamCategoryEl.textContent = "-";
      myTeamEmptyStateEl.classList.remove("hidden");
      myTeamEmptyTextEl.textContent = currentUserIsCaptain
        ? "You have not submitted a team for this tournament yet."
        : "You are not part of any accepted team for this tournament yet.";
      return;
    }

    myTeamEmptyStateEl.classList.add("hidden");

    myTeamNameEl.textContent = activeTeam.teamName || "-";
    myTeamCaptainEl.textContent = activeTeam.captainName || "-";
    myTeamRoleEl.textContent = currentUserIsCaptain ? "Captain" : "Player";
    myTeamCategoryEl.textContent = activeTeam.categoryLabel || "-";

    const invitedPlayers = Array.isArray(activeTeam.invitedPlayers) ? activeTeam.invitedPlayers : [];

    if (!invitedPlayers.length) {
      myTeamPlayerListEl.innerHTML = `
        <div class="empty-state-card">
          <h3>No invited players yet</h3>
          <p class="helper-text">Once players are invited, they will appear here.</p>
        </div>
      `;
      return;
    }

    invitedPlayers.forEach((player) => {
      const card = document.createElement("div");
      card.className = "my-team-player-card";

      const status = player?.inviteStatus || "pending";
      const statusClass =
        status === "accepted"
          ? "status-pill status-pill--accepted"
          : status === "rejected"
            ? "status-pill status-pill--rejected"
            : "status-pill status-pill--pending";

      card.innerHTML = `
        <div class="my-team-player-left">
          <div class="my-team-player-name">${escapeHtml(player.playerName || player.name || "Player")}</div>
          <div class="my-team-player-meta">${escapeHtml(player.phone || player.playerPhone || "")}</div>
        </div>
        <div class="${statusClass}">${escapeHtml(status)}</div>
      `;
      myTeamPlayerListEl.appendChild(card);
    });
  }

  function wireTeamTabs() {
    teamTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const target = tab.dataset.tab;
        if (!target) return;

        teamTabs.forEach((btn) => btn.classList.toggle("is-active", btn === tab));
        teamPanels.forEach((panel) => {
          panel.classList.toggle("is-active", panel.dataset.panel === target);
        });
      });
    });
  }

  // ---------------------------------------------------------------------------
  // CATEGORY / ROW EVENTS
  // ---------------------------------------------------------------------------
  wireTeamTabs();

  categorySelect?.addEventListener("change", () => {
    if (tournamentMeta?.tournamentType === "team") return;

    const category = getCurrentCategory();
    currentRule = getRuleForCategory(category);
    renderPlayerRows([]);
    updateRuleUi();
  });

  addPlayerRowBtn?.addEventListener("click", () => {
    let categoryId = "";

    if (tournamentMeta?.tournamentType === "team") {
      categoryId = "__team_event__";
    } else {
      const category = getCurrentCategory();
      categoryId = category ? String(category.categoryId || category.id) : "";
      if (!categoryId) {
        alert("Please select a category first.");
        return;
      }
    }

    const selectedValues = getSelectedValues();
    const currentTotal = selectedValues.length + 1; // captain included

    if (currentTotal >= currentRule.max) {
      alert(`You can add maximum ${currentRule.max} players including captain.`);
      return;
    }

    renderPlayerRows([...selectedValues, ""]);
    updateRuleUi();
  });

  saveDraftBtn?.addEventListener("click", () => {
    saveDraft(true);
  });

  // ---------------------------------------------------------------------------
  // SUBMIT TEAM
  // ---------------------------------------------------------------------------
  teamForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!currentUserIsCaptain) {
      alert("Only captains can create or edit a team.");
      return;
    }

    let categoryId = "";
    let category = null;

    if (tournamentMeta?.tournamentType === "team") {
      categoryId = "";
    } else {
      category = getCurrentCategory();
      categoryId = category ? String(category.categoryId || category.id) : "";
      if (!categoryId) {
        alert("Please select a category.");
        return;
      }
    }

    const selectedValues = getSelectedValues();

    if (new Set(selectedValues).size !== selectedValues.length) {
      alert("Same player cannot be selected twice.");
      return;
    }

    if (currentRule.mode === "exact") {
      if (selectedValues.length !== currentRule.exact - 1) {
        alert(`Please select exactly ${currentRule.exact - 1} other players. Captain is already included.`);
        return;
      }
    } else {
      const totalWithCaptain = selectedValues.length + 1;
      if (totalWithCaptain < currentRule.min) {
        alert(`Please select at least ${currentRule.min - 1} other players.`);
        return;
      }
      if (totalWithCaptain > currentRule.max) {
        alert(`Please select at most ${currentRule.max - 1} other players.`);
        return;
      }
    }

    const playerPool =
      tournamentMeta?.tournamentType === "team"
        ? getAcceptedPlayers()
        : getPlayersForCategory(categoryId);

    const selectedPlayers = selectedValues
      .map((id) => playerPool.find((p) => String(getPlayerId(p)) === String(id)))
      .filter(Boolean);

    const captainName = user.name || user.username || "";
    const captainUsername = user.username || "";

    const invitedPlayers = selectedPlayers.map((player) => ({
      playerId: String(getPlayerId(player)),
      playerName: getPlayerName(player),
      username: player.username || "",
      phone: player.phone || player.playerPhone || "",
      inviteStatus: "pending",
    }));

    const payload = {
      tournamentId,
      teamName: teamNameInput.value.trim() || "My Team",
      categoryId,
      categoryLabel:
        tournamentMeta?.tournamentType === "team"
          ? "Team event"
          : (category ? categoryLabel(category) : ""),
      captainName,
      captainUsername,
      createdBy: captainUsername || captainName,
      invitedPlayers,
      tournamentName: tournamentMeta?.tournamentName || "",
    };

    const candidates = [
      `/api/host/tournaments/${encodeURIComponent(tournamentId)}/team-requests`,
      `/api/tournaments/${encodeURIComponent(tournamentId)}/team-requests`,
    ];

    for (const url of candidates) {
      const result = await apiPost(url, payload);
      if (result.ok) {
        saveDraft(false);
        localStorage.removeItem(draftKey);
        alert("Team request created successfully.");
        await hydrateSubmissionState();
        hydratePage();
        return;
      }
    }

    alert("Could not create team request. Please verify backend route.");
  });

    // ---------------------------------------------------------------------------
  // LINEUP TAB
  // ---------------------------------------------------------------------------
  const lineupEmptyStateEl = document.getElementById("lineup-empty-state");
  const lineupBuilderEl = document.getElementById("lineup-builder");
  const lineupExistingListEl = document.getElementById("lineup-existing-list");
  const lineupTieLabelInput = document.getElementById("lineup-tie-label");
  const lineupCategorySelect = document.getElementById("lineup-category-select");
  const lineupSubmatchesWrap = document.getElementById("lineup-submatches-wrap");
  const lineupSaveBtn = document.getElementById("lineup-save-btn");
  const lineupHelpTextEl = document.getElementById("lineup-help-text");

  let lineupStateLocal = {
    existing: [],
    myRequest: null,
  };

  function getAdvancedSettingsSafe() {
    const raw = tournamentMeta?.advancedSettings;
    if (!raw) return {};
    if (typeof raw === "object") return raw;
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  function getSubmatchCount() {
    const adv = getAdvancedSettingsSafe();
    return Math.max(1, Number(adv.tieSubmatchCount || 5));
  }

  async function loadMyTeamRequestForLineup() {
    const r = await apiGet(`/api/host/tournaments/${encodeURIComponent(tournamentId)}/team-requests`);
    const requests = Array.isArray(r.data) ? r.data : [];

    lineupStateLocal.myRequest =
      requests.find((req) => isSameCaptain(req, user)) ||
      requests.find((req) => {
        const invited = Array.isArray(req?.invitedPlayers) ? req.invitedPlayers : [];
        return invited.some((p) => isSameUserByInviteFields(p, user) && p.inviteStatus === "accepted");
      }) ||
      null;
  }

  async function loadExistingLineupsForMe() {
    const r = await apiGet(`/api/host/tournaments/${encodeURIComponent(tournamentId)}/lineups`);
    lineupStateLocal.existing = Array.isArray(r.data?.ties) ? r.data.ties : [];
  }

  function getMyTeamRoster() {
    const req = lineupStateLocal.myRequest;
    if (!req) return [];

    const roster = [];
    const captainName = req.captainName || user.name || user.username || "Captain";
    const captainUsername = req.captainUsername || user.username || "";

    roster.push({
      playerId: req.captainPlayerId || captainUsername || captainName,
      playerName: captainName,
    });

    const invited = Array.isArray(req.invitedPlayers) ? req.invitedPlayers : [];
    invited.forEach((p) => {
      if (String(p.inviteStatus || "").toLowerCase() !== "accepted") return;
      roster.push({
        playerId: p.playerId,
        playerName: p.inviteeName || p.playerName || p.name || p.username || "Player",
      });
    });

    const seen = new Set();
    return roster.filter((p) => {
      const id = String(p.playerId || p.playerName);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  function buildLineupPlayerOptions(currentValue = "") {
    const players = getMyTeamRoster();
    return players
      .map((p) => {
        const v = String(p.playerId || "");
        return `<option value="${escapeHtml(v)}" ${v === String(currentValue) ? "selected" : ""}>${escapeHtml(p.playerName || "Player")}</option>`;
      })
      .join("");
  }

  function populateLineupCategories() {
    if (!lineupCategorySelect) return;
    lineupCategorySelect.innerHTML = `<option value="">Select category</option>`;

    normalizeCategories(tournamentMeta?.categories).forEach((c) => {
      const id = String(c.categoryId || c.id || "");
      if (!id) return;
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = categoryLabel(c);
      lineupCategorySelect.appendChild(opt);
    });

    if (lineupStateLocal.myRequest?.categoryId) {
      lineupCategorySelect.value = String(lineupStateLocal.myRequest.categoryId);
    }
  }

  function renderLineupSubmatches(savedSubmatches = []) {
    if (!lineupSubmatchesWrap) return;
    lineupSubmatchesWrap.innerHTML = "";

    const count = getSubmatchCount();
    for (let i = 0; i < count; i++) {
      const row = savedSubmatches[i] || {};
      const card = document.createElement("div");
      card.className = "lineup-slot-card";
      card.innerHTML = `
        <div class="lineup-slot-title">Submatch ${i + 1}</div>
        <div class="lineup-two-col">
          <div class="field-group">
            <label>Player 1</label>
            <select class="lineup-player-a" data-index="${i}">
              <option value="">Select player</option>
              ${buildLineupPlayerOptions(row.playerIds?.[0] || "")}
            </select>
          </div>
          <div class="field-group">
            <label>Player 2</label>
            <select class="lineup-player-b" data-index="${i}">
              <option value="">Select player</option>
              ${buildLineupPlayerOptions(row.playerIds?.[1] || "")}
            </select>
          </div>
        </div>
      `;
      lineupSubmatchesWrap.appendChild(card);
    }
  }

  function collectLineupPayload() {
    const req = lineupStateLocal.myRequest;
    const rosterMap = new Map(getMyTeamRoster().map((p) => [String(p.playerId), p.playerName]));

    const submatches = Array.from(lineupSubmatchesWrap.querySelectorAll(".lineup-slot-card")).map((card, idx) => {
      const a = card.querySelector(".lineup-player-a")?.value || "";
      const b = card.querySelector(".lineup-player-b")?.value || "";

      return {
        slot: idx + 1,
        playerIds: [a, b].filter(Boolean),
        playerNames: [rosterMap.get(a), rosterMap.get(b)].filter(Boolean),
      };
    });

    return {
      tieId: req?.requestId || undefined,
      tieLabel: lineupTieLabelInput?.value?.trim() || `Tie ${req?.teamName || ""}`.trim(),
      teamA: req?.teamName || "My Team",
      teamB: "",
      teamKey: req?.requestId || "",
      categoryId: lineupCategorySelect?.value || req?.categoryId || "",
      captainUsername: req?.captainUsername || user.username || "",
      captainName: req?.captainName || user.name || user.username || "",
      submatches,
      locked: false,
    };
  }

  function renderExistingLineups() {
    if (!lineupExistingListEl) return;
    lineupExistingListEl.innerHTML = "";

    if (!lineupStateLocal.existing.length) {
      lineupExistingListEl.innerHTML = `<div class="helper-text">No lineup submitted yet.</div>`;
      return;
    }

    lineupStateLocal.existing.forEach((tie) => {
      const card = document.createElement("div");
      card.className = "meta-chip";
      card.innerHTML = `
        <strong>${escapeHtml(tie.tieLabel || "Tie")}</strong>
        <span class="helper-text">${escapeHtml(tie.teamA || "")}</span>
        <span class="helper-text">${tie.locked ? "Locked" : "Pending"}</span>
      `;
      lineupExistingListEl.appendChild(card);
    });
  }

  async function setupLineupTab() {
    if (!lineupTabBtn) return;

    const adv = getAdvancedSettingsSafe();
    const isPickleballLeague = adv.advancedMode === "pickleball_team_league";

    if (!isPickleballLeague) {
      lineupTabBtn.classList.add("hidden");
      return;
    }

    await loadMyTeamRequestForLineup();
    await loadExistingLineupsForMe();

    if (!lineupStateLocal.myRequest) {
      lineupTabBtn.classList.add("hidden");
      return;
    }

    lineupTabBtn.classList.remove("hidden");
    populateLineupCategories();
    renderLineupSubmatches();
    renderExistingLineups();

    const isCaptain =
      (lineupStateLocal.myRequest?.captainUsername && identitiesMatch(lineupStateLocal.myRequest.captainUsername, user.username)) ||
      (lineupStateLocal.myRequest?.captainName && identitiesMatch(lineupStateLocal.myRequest.captainName, user.name)) ||
      (lineupStateLocal.myRequest?.captainName && identitiesMatch(lineupStateLocal.myRequest.captainName, user.username));

    if (isCaptain) {
      lineupEmptyStateEl?.classList.add("hidden");
      lineupBuilderEl?.classList.remove("hidden");
      if (lineupHelpTextEl) {
        lineupHelpTextEl.textContent = "Submit your team lineup for this tie.";
      }
    } else {
      lineupEmptyStateEl?.classList.add("hidden");
      lineupBuilderEl?.classList.add("hidden");
      if (lineupHelpTextEl) {
        lineupHelpTextEl.textContent = "You can view submitted lineups here.";
      }
    }
  }

  lineupSaveBtn?.addEventListener("click", async () => {
    const payload = collectLineupPayload();

    if (!payload.categoryId) {
      alert("Select category first.");
      return;
    }

    const hasAtLeastOne = payload.submatches.some((m) => (m.playerIds || []).length > 0);
    if (!hasAtLeastOne) {
      alert("Add at least one submatch lineup.");
      return;
    }

    const r = await apiPost(`/api/host/tournaments/${encodeURIComponent(tournamentId)}/lineups`, payload);
    if (!r.ok) {
      alert("Could not save lineup.");
      return;
    }

    alert("Lineup saved.");
    await loadExistingLineupsForMe();
    renderExistingLineups();
  });

  await setupLineupTab();

  // ---------------------------------------------------------------------------
  // INITIAL LOAD
  // ---------------------------------------------------------------------------
  tournamentMeta = await loadTournamentMeta();
  if (!tournamentMeta) {
    alert("Could not load tournament.");
    window.location.href = "join.html";
    return;
  }

  allPlayers = await loadPlayers();
  await hydrateSubmissionState();
  hydratePage();


});