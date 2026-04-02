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
  const createTeamPanel = document.getElementById("create-team-panel");

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
    try {
      const raw = localStorage.getItem(`scheduleit_captains_${tournamentId}`);
      const parsed = JSON.parse(raw || "null");
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
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

    if (tournamentMeta.tournamentType === "team") {
      const min = Number(tournamentMeta?.tournamentRules?.minPlayersPerTeam || 1);
      const max = Number(tournamentMeta?.tournamentRules?.maxPlayersPerTeam || min || 1);

      return {
        mode: "range",
        min,
        max,
        exact: null,
        text: `You must select minimum ${min} and maximum ${max} players.`,
      };
    }

    if (!category) {
      return {
        mode: "exact",
        min: 1,
        max: 1,
        exact: 1,
        text: "Select a category to continue.",
      };
    }

    const teamSize = Number(category.teamSize || 1);
    const exactTeamSize =
      teamSize >= 4
        ? Number(category.exactTeamSize || teamSize || 4)
        : teamSize;

    return {
      mode: "exact",
      min: exactTeamSize,
      max: exactTeamSize,
      exact: exactTeamSize,
      text: `You must select exactly ${exactTeamSize} player${exactTeamSize > 1 ? "s" : ""} for this format.`,
    };
  }

  function updateRuleUi() {
    ruleTextEl.textContent = currentRule.text;

    if (currentRule.mode === "exact") {
      ruleValueEl.textContent = `Exactly ${currentRule.exact}`;
      requiredCountEl.textContent = String(currentRule.exact);
    } else {
      ruleValueEl.textContent = `${currentRule.min} to ${currentRule.max}`;
      requiredCountEl.textContent = `${currentRule.min} - ${currentRule.max}`;
    }

    const otherSelected = getSelectedValues().length;
    const totalSelected = currentUserIsCaptain ? otherSelected + 1 : otherSelected;
    selectedCountEl.textContent = String(totalSelected);
  }

  function makePlayerOptions(categoryId, selectedValue = "") {
    const categoryPlayers = getSelectablePlayersForTeam(categoryId);
    const selectedValues = new Set(getSelectedValues());

    return categoryPlayers
      .map((player) => {
        const value = String(getPlayerId(player));
        const disabled = selectedValues.has(value) && value !== selectedValue;
        return `
          <option value="${escapeHtml(value)}" ${value === selectedValue ? "selected" : ""} ${disabled ? "disabled" : ""}>
            ${escapeHtml(getPlayerName(player))}
          </option>
        `;
      })
        .join("");
  }

  function renderPlayerRows(savedValues = []) {
    const category = getCurrentCategory();
    const categoryId =
      tournamentMeta?.tournamentType === "team"
        ? "__team_event__"
        : (category ? String(category.categoryId || category.id) : "");

    teamRowsWrap.innerHTML = "";

    if (!categoryId) {
      updateRuleUi();
      return;
    }

    const captainRow = document.createElement("div");
    captainRow.className = "team-player-row captain-locked-row";
    captainRow.innerHTML = `
      <div class="player-slot-label">Player 1</div>

      <div class="field-group" style="margin-bottom:0;">
        <label>Captain</label>
        <input type="text" value="${escapeHtml(getCaptainDisplayName())}" disabled />
      </div>

      <button type="button" class="row-remove-btn" disabled>Locked</button>
    `;
    teamRowsWrap.appendChild(captainRow);

    const totalRequired =
      currentRule.mode === "exact" ? currentRule.exact : currentRule.min;

    const otherPlayersCount = Math.max(
      savedValues.length,
      Math.max(totalRequired - 1, 0)
    );

    for (let i = 0; i < otherPlayersCount; i++) {
      const selectedValue = savedValues[i] || "";

      const row = document.createElement("div");
      row.className = "team-player-row";
      row.innerHTML = `
        <div class="player-slot-label">Player ${i + 2}</div>

        <div class="field-group" style="margin-bottom:0;">
          <label>Select player</label>
          <select class="team-player-select" data-row-index="${i}">
            <option value="">Select player</option>
            ${makePlayerOptions(categoryId, selectedValue)}
          </select>
        </div>

        <button type="button" class="row-remove-btn">Remove</button>
      `;

      const select = row.querySelector(".team-player-select");
      if (select) select.value = selectedValue;

      select?.addEventListener("change", () => {
        refreshAllPlayerDropdowns();
        updateRuleUi();
      });

      row.querySelector(".row-remove-btn")?.addEventListener("click", () => {
        const currentValues = getSelectedValues();
        const rowValue = select?.value || "";
        const nextValues = currentValues.filter((v) => v !== rowValue);

        const minimumOthers =
          currentRule.mode === "exact"
            ? Math.max(currentRule.exact - 1, 0)
            : Math.max(currentRule.min - 1, 0);

        if (nextValues.length < minimumOthers) {
          alert(`Captain plus at least ${minimumOthers} other player(s) are required.`);
          return;
        }

        renderPlayerRows(nextValues);
        updateRuleUi();
      });

      teamRowsWrap.appendChild(row);
    }

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

    selectedCountEl.textContent = String(getSelectedValues().length);
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

  function getAllInvitesForTournament() {
    try {
      const raw = localStorage.getItem(`scheduleit_team_invites_${tournamentId}`);
      const parsed = JSON.parse(raw || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function getAllTeamSubmissionsForTournament() {
    const submissions = [];
    const prefix = `scheduleit_team_submission_${tournamentId}_`;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(prefix)) continue;

      try {
        const parsed = JSON.parse(localStorage.getItem(key) || "null");
        if (parsed && typeof parsed === "object") submissions.push(parsed);
      } catch {}
    }

    return submissions;
  }

  function findCaptainSubmissionForCurrentUser() {
    const submissions = getAllTeamSubmissionsForTournament();
    return submissions.find((submission) => isSameCaptain(submission, user)) || null;
  }

  function findAcceptedInviteForCurrentUser() {
    const invites = getAllInvitesForTournament();
    return invites.find((invite) => invite.status === "accepted" && isSameUserByInviteFields(invite, user)) || null;
  }

  function findSubmissionByInvite(invite) {
    if (!invite) return null;
    const submissions = getAllTeamSubmissionsForTournament();

    return (
      submissions.find((submission) => {
        const captainMatch =
          (invite.captainUsername && identitiesMatch(submission.captainUsername || submission.createdBy, invite.captainUsername)) ||
          (invite.captainName && identitiesMatch(submission.captainName || submission.createdBy, invite.captainName));

        const teamMatch = invite.teamName
          ? identitiesMatch(submission.teamName, invite.teamName)
          : true;

        return captainMatch && teamMatch;
      }) || null
    );
  }

  function getInviteStatusForPlayer(player, captainSubmission) {
    const invites = getAllInvitesForTournament();

    const relevant = invites.find((invite) => {
      const sameCaptain =
        (captainSubmission?.captainUsername && identitiesMatch(invite.captainUsername, captainSubmission.captainUsername)) ||
        (captainSubmission?.captainName && identitiesMatch(invite.captainName, captainSubmission.captainName)) ||
        (captainSubmission?.createdBy && identitiesMatch(invite.captainUsername || invite.captainName, captainSubmission.createdBy));

      const samePlayer =
        (player?.playerId && String(invite.inviteePlayerId) === String(player.playerId)) ||
        identitiesMatch(invite.inviteeName, player?.playerName) ||
        identitiesMatch(invite.inviteeUsername, player?.username);

      return sameCaptain && samePlayer;
    });

    if (!relevant) return "accepted";
    if (relevant.status === "accepted") return "accepted";
    if (relevant.status === "pending") return "pending";
    return "other";
  }

  function setActiveTeamTab(tabName) {
    teamTabs.forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.tab === tabName);
    });

    teamPanels.forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.panel === tabName);
    });
  }

  function wireTeamTabs() {
    teamTabs.forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.classList.contains("hidden")) return;
        setActiveTeamTab(btn.dataset.tab);
      });
    });
  }

  function renderMyTeamTab() {
    const invites = getAllInvitesForTournament();
    currentCaptainSubmission = findCaptainSubmissionForCurrentUser();
    currentAcceptedInvite = findAcceptedInviteForCurrentUser();
    currentUserIsCaptain = !!currentCaptainSubmission;

    myTeamPlayerListEl.innerHTML = "";
    myTeamEmptyStateEl.classList.add("hidden");

    if (currentUserIsCaptain) {
      const submission = currentCaptainSubmission;
      const captainLabel = submission.captainName || user.name || user.username || "Captain";
      const teamName = submission.teamName || "Untitled team";

      myTeamNameEl.textContent = teamName;
      myTeamCaptainEl.textContent = captainLabel;
      myTeamRoleEl.textContent = "Captain";
      myTeamCategoryEl.textContent = submission.categoryLabel || "—";

      const players = Array.isArray(submission.players) ? submission.players : [];

      const captainRow = document.createElement("div");
      captainRow.className = "my-team-player-card";
      captainRow.innerHTML = `
        <div class="my-team-player-left">
          <div class="my-team-player-name">${escapeHtml(captainLabel)}</div>
          <div class="my-team-player-sub">You</div>
        </div>
        <span class="member-status-pill member-status-pill--captain">Captain</span>
      `;
      myTeamPlayerListEl.appendChild(captainRow);

      players.forEach((player) => {
        const status = getInviteStatusForPlayer(player, submission);
        if (status === "other") return;

        const card = document.createElement("div");
        card.className = "my-team-player-card";
        card.innerHTML = `
          <div class="my-team-player-left">
            <div class="my-team-player-name">${escapeHtml(player.playerName || "Player")}</div>
            <div class="my-team-player-sub">${escapeHtml(player.username || "")}</div>
          </div>
          <span class="member-status-pill ${status === "accepted" ? "member-status-pill--accepted" : "member-status-pill--pending"}">
            ${status === "accepted" ? "Accepted" : "Request sent"}
          </span>
        `;
        myTeamPlayerListEl.appendChild(card);
      });

      createTeamTabBtn.classList.remove("hidden");
      createTeamPanel.classList.remove("hidden");
      pageTitleEl.textContent = "My team";
      pageSubtitleEl.textContent = "View your team or manage invites if you are the captain.";
      return;
    }

    if (currentAcceptedInvite) {
      const invite = currentAcceptedInvite;
      const linkedSubmission = findSubmissionByInvite(invite);
      const teamName = invite.teamName || linkedSubmission?.teamName || "Untitled team";
      const captainName = invite.captainName || linkedSubmission?.captainName || "Captain";

      myTeamNameEl.textContent = teamName;
      myTeamCaptainEl.textContent = captainName;
      myTeamRoleEl.textContent = "Player";
      myTeamCategoryEl.textContent = invite.categoryLabel || linkedSubmission?.categoryLabel || "—";

      const captainRow = document.createElement("div");
      captainRow.className = "my-team-player-card";
      captainRow.innerHTML = `
        <div class="my-team-player-left">
          <div class="my-team-player-name">${escapeHtml(captainName)}</div>
          <div class="my-team-player-sub">Captain</div>
        </div>
        <span class="member-status-pill member-status-pill--captain">Captain</span>
      `;
      myTeamPlayerListEl.appendChild(captainRow);

      const sourcePlayers = Array.isArray(linkedSubmission?.players) && linkedSubmission.players.length
        ? linkedSubmission.players
        : Array.isArray(invite.allPlayers) ? invite.allPlayers : [];

      sourcePlayers.forEach((player) => {
        const isCurrent =
          (player?.username && identitiesMatch(player.username, user.username)) ||
          (player?.playerName && identitiesMatch(player.playerName, user.name)) ||
          (player?.playerName && identitiesMatch(player.playerName, user.username));

        const status = isCurrent
          ? "accepted"
          : (() => {
              const matchingInvite = invites.find((row) => {
                const sameCaptain =
                  (invite.captainUsername && identitiesMatch(row.captainUsername, invite.captainUsername)) ||
                  (invite.captainName && identitiesMatch(row.captainName, invite.captainName));

                const samePlayer =
                  (player?.playerId && String(row.inviteePlayerId) === String(player.playerId)) ||
                  identitiesMatch(row.inviteeName, player?.playerName) ||
                  identitiesMatch(row.inviteeUsername, player?.username);

                return sameCaptain && samePlayer;
              });

              return matchingInvite?.status === "accepted" ? "accepted" : "pending";
            })();

        const card = document.createElement("div");
        card.className = "my-team-player-card";
        card.innerHTML = `
          <div class="my-team-player-left">
            <div class="my-team-player-name">${escapeHtml(player.playerName || "Player")}</div>
            <div class="my-team-player-sub">${isCurrent ? "You" : escapeHtml(player.username || "")}</div>
          </div>
          <span class="member-status-pill ${status === "accepted" ? "member-status-pill--accepted" : "member-status-pill--pending"}">
            ${status === "accepted" ? "Accepted" : "Request sent"}
          </span>
        `;
        myTeamPlayerListEl.appendChild(card);
      });

      createTeamTabBtn.classList.add("hidden");
      createTeamPanel.classList.add("hidden");
      pageTitleEl.textContent = "My team";
      pageSubtitleEl.textContent = "View your accepted team.";
      return;
    }

    myTeamNameEl.textContent = "—";
    myTeamCaptainEl.textContent = "—";
    myTeamRoleEl.textContent = currentUserIsCaptain ? "Captain" : "Player";
    myTeamCategoryEl.textContent = "—";
    myTeamEmptyStateEl.classList.remove("hidden");

    if (currentUserIsCaptain) {
      myTeamEmptyTextEl.textContent = "No team created yet. Use Create team to invite players.";
      createTeamTabBtn.classList.remove("hidden");
      createTeamPanel.classList.remove("hidden");
    } else {
      myTeamEmptyTextEl.textContent = "You have not accepted any team invite for this tournament yet.";
      createTeamTabBtn.classList.add("hidden");
      createTeamPanel.classList.add("hidden");
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

  function hydrateCreateTab() {
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
    }
  }

  function hydratePage() {
    tournamentNameEl.textContent = tournamentMeta?.tournamentName || "-";
    tournamentSportEl.textContent = tournamentMeta?.sportName || "-";
    tournamentDatesEl.textContent = tournamentMeta?.tournamentDates || "-";

    hydrateCreateTab();
    renderMyTeamTab();
    setActiveTeamTab("my-team");
  }

  if (trigger) {
    const label = (user?.name || user?.username || user?.email || "U").trim();
    trigger.textContent = label.charAt(0).toUpperCase();
  }

  trigger?.addEventListener("click", () => dropdown?.classList.toggle("is-open"));

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

  teamForm?.addEventListener("submit", (e) => {
    e.preventDefault();

    if (!currentUserIsCaptain) {
      alert("Only captain can create or update a team.");
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

    const totalSelected = selectedValues.length + 1; // captain included

    if (currentRule.mode === "exact") {
      if (totalSelected !== currentRule.exact) {
        alert(`Please select exactly ${currentRule.exact} players including captain.`);
        return;
      }
    } else {
      if (totalSelected < currentRule.min) {
        alert(`Please select at least ${currentRule.min} players including captain.`);
        return;
      }
      if (totalSelected > currentRule.max) {
        alert(`Please select at most ${currentRule.max} players including captain.`);
        return;
      }
    }

    const playerPool = getSelectablePlayersForTeam(categoryId);

    const selectedOtherPlayers = selectedValues
      .map((id) => playerPool.find((p) => String(getPlayerId(p)) === String(id)))
      .filter(Boolean);

    const captainPlayer = {
      playerId: user.username || user.name || "captain",
      playerName: user.name || user.username || "Captain",
      username: user.username || "",
      categoryId,
    };

    const selectedPlayers = [
      captainPlayer,
      ...selectedOtherPlayers.map((p) => ({
        playerId: getPlayerId(p),
        playerName: getPlayerName(p),
        username: p.username || p.userName || "",
        categoryId: getPlayerCategoryId(p),
      })),
    ];

    const captainName = user.name || user.username || "";
    const captainUsername = user.username || "";
    const normalizedCaptainName = normalizeIdentity(captainName);
    const normalizedCaptainUsername = normalizeIdentity(captainUsername);

    const payload = {
      tournamentId,
      tournamentName: tournamentMeta?.tournamentName || "",
      teamName: teamNameInput.value.trim(),
      categoryId,
      categoryLabel: category ? categoryLabel(category) : "",
      createdBy: captainUsername || captainName,
      captainName,
      captainUsername,
      players: selectedPlayers,
      savedAt: new Date().toISOString(),
    };

    localStorage.setItem(
      draftKey,
      JSON.stringify({
        teamName: payload.teamName,
        categoryId: payload.categoryId,
        playerIds: payload.players.map((p) => String(p.playerId)),
        updatedAt: payload.savedAt,
      })
    );

    localStorage.setItem(
      `scheduleit_team_submission_${tournamentId}_${user.username || user.name || "user"}`,
      JSON.stringify(payload)
    );

    const invitesKey = `scheduleit_team_invites_${tournamentId}`;
    let existingInvites = [];
    try {
      existingInvites = JSON.parse(localStorage.getItem(invitesKey) || "[]");
      if (!Array.isArray(existingInvites)) existingInvites = [];
    } catch {
      existingInvites = [];
    }

    const now = new Date().toISOString();

    const newInvites = payload.players
      .filter((player) => {
        const playerName = normalizeIdentity(player.playerName || "");
        const playerUsername = normalizeIdentity(player.username || "");

        const isCaptainByName = playerName && playerName === normalizedCaptainName;
        const isCaptainByUsername = playerUsername && normalizedCaptainUsername && playerUsername === normalizedCaptainUsername;

        return !isCaptainByName && !isCaptainByUsername;
      })
      .map((player) => ({
        requestId:
          "invite_" + tournamentId + "_" + String(player.playerId || Math.random().toString(36).slice(2)),
        tournamentId,
        tournamentName: payload.tournamentName,
        teamName: payload.teamName || captainName,
        categoryId: payload.categoryId,
        categoryLabel: payload.categoryLabel,
        captainName,
        captainUsername,
        inviteePlayerId: player.playerId,
        inviteeName: player.playerName || "",
        inviteeUsername: player.username || "",
        allPlayers: payload.players,
        status: "pending",
        createdAt: now,
      }));

    const filteredExisting = existingInvites.filter((invite) => {
      return !newInvites.some(
        (newInvite) =>
          String(newInvite.inviteePlayerId) === String(invite.inviteePlayerId) &&
          String(newInvite.tournamentId) === String(invite.tournamentId) &&
          String(newInvite.captainUsername || newInvite.captainName) ===
            String(invite.captainUsername || invite.captainName) &&
          String(invite.status) === "pending"
      );
    });

    localStorage.setItem(invitesKey, JSON.stringify([...filteredExisting, ...newInvites]));

    alert("Team invites sent in browser for now.");
    renderMyTeamTab();
    setActiveTeamTab("my-team");
  });

  tournamentMeta = await loadTournamentMeta();
  if (!tournamentMeta) {
    alert("Tournament not found.");
    window.location.href = "join.html";
    return;
  }

  allPlayers = await loadPlayers();
  hydratePage();
});