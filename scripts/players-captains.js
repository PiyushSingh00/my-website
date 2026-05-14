/**
 * players-captains.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Make-captains modal, confirm-captains modal, team summary cards,
 * and pool drag-and-drop section.
 *
 * Loaded at startup (host users need it immediately), but all rendering
 * is deferred until the user interacts.
 *
 * FIX 12 (module split): extracted from the monolithic players.js
 * FIX  4 (card toggle): expand/collapse only touches the clicked card
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  state,
  TEAM_EVENT_CATEGORY_ID,
  escapeHtml,
  shuffle,
  isTournamentTeamEvent,
  isGroupKnockoutFormat,
  getAcceptedPlayers,
  getPlayerId,
  getPlayerDisplayName,
  getPlayerCategoryId,
  getCategoryNameById,
  getConfirmedTeams,
  getCaptainSubmittedPlayers,
  getCanonicalTeamForCaptain,
  getCanonicalTeamPlayers,
  getManualAddEligiblePlayers,
  apiGet,
  apiPut,
  apiPatch,
  apiPost,
} from "./players-utils.js";

// Needed for after-captain-save side-effects
let _tournamentId = "";
let _callbacks    = {};          // { renderCaptainsSummary, refreshStageSpecificUi, loadPlayers }
const expandedTeamIds = new Set();

// ── Public init (called from players.js once) ─────────────────────────────────
export function initCaptains(tournamentId, callbacks) {
  _tournamentId = tournamentId;
  _callbacks    = callbacks;
  _bindStaticListeners();
}

// ── DB helpers ────────────────────────────────────────────────────────────────
export async function loadCaptainStateFromDb() {
  const r = await apiGet(`/api/host/tournaments/${encodeURIComponent(_tournamentId)}/captains`);
  if (r.ok && r.data) {
    state.captainState.selectedCaptainIds = Array.isArray(r.data.selectedCaptainIds) ? r.data.selectedCaptainIds : [];
    state.captainState.confirmedCaptains  = Array.isArray(r.data.confirmedCaptains)  ? r.data.confirmedCaptains  : [];
  } else {
    state.captainState = { selectedCaptainIds: [], confirmedCaptains: [], pools: null };
  }
}

export async function saveCaptainStateToDb() {
  const r = await apiPut(`/api/host/tournaments/${encodeURIComponent(_tournamentId)}/captains`, {
    selectedCaptainIds: state.captainState.selectedCaptainIds,
    confirmedCaptains:  state.captainState.confirmedCaptains,
  });
  if (!r.ok) throw new Error("Could not save captains");
}

export async function loadTeamsFromDb() {
  const r = await apiGet(`/api/host/tournaments/${encodeURIComponent(_tournamentId)}/teams`);
  state.canonicalTeams = r.ok
    ? (Array.isArray(r.data?.teams) ? r.data.teams : Array.isArray(r.data) ? r.data : [])
    : [];
}

export async function refreshTeamSetupState() {
  await loadCaptainStateFromDb();
  await loadTeamsFromDb();
}

export async function updateCaptainTeamStatus(playerId, nextStatus) {
  const captain = state.captainState.confirmedCaptains.find(
    (c) => String(c.playerId) === String(playerId)
  );
  if (!captain) return;
  const r = await apiPatch(
    `/api/host/tournaments/${encodeURIComponent(_tournamentId)}/teams/by-captain/${encodeURIComponent(playerId)}`,
    {
      teamStatus:      nextStatus,
      categoryId:      captain?.categoryId || TEAM_EVENT_CATEGORY_ID,
      teamName:        captain?.teamName   || captain?.playerName || "Team",
      captainName:     captain?.playerName || "",
      captainUsername: captain?.username   || captain?.captainUsername || "",
    }
  );
  if (!r.ok) throw new Error(r.data?.message || "Could not update team status");
  await refreshTeamSetupState();
}

export async function addManualPlayerToCaptainTeam(captainPlayerId, addedPlayerId) {
  const captain = state.captainState.confirmedCaptains.find(
    (c) => String(c.playerId) === String(captainPlayerId)
  );
  if (!captain) throw new Error("Team not found.");

  const player = (state.allPlayers || []).find(
    (p) => String(getPlayerId(p)) === String(addedPlayerId)
  );
  if (!player) throw new Error("Player not found.");

  const r = await apiPatch(
    `/api/host/tournaments/${encodeURIComponent(_tournamentId)}/teams/by-captain/${encodeURIComponent(captainPlayerId)}`,
    {
      categoryId:      captain?.categoryId || TEAM_EVENT_CATEGORY_ID,
      teamName:        captain?.teamName   || captain?.playerName || "Team",
      captainName:     captain?.playerName || "",
      captainUsername: captain?.username   || captain?.captainUsername || "",
      addPlayer: {
        playerId:    String(getPlayerId(player)           || "").trim(),
        playerName:  String(getPlayerDisplayName(player)  || "").trim(),
        username:    String(player?.username              || "").trim(),
        phone:       String(player?.phone || player?.playerPhone || "").trim(),
        inviteStatus: "accepted",
      },
    }
  );
  if (!r.ok) throw new Error(r.data?.message || "Could not add player manually.");
  await refreshTeamSetupState();
}

export function getManualAddEligiblePlayers(captainPlayerId) {
  const captainIds = new Set([
    ...(state.captainState.selectedCaptainIds || []).map((id) => String(id)),
    ...(state.captainState.confirmedCaptains  || []).map((c) => String(c?.playerId || "")),
  ]);
  const team = getCanonicalTeamForCaptain(captainPlayerId);
  const existingRoster = getCanonicalTeamPlayers(team);
  const existingKeys = new Set(
    existingRoster.map((p) =>
      String(p?.playerId || "").trim() ||
      String(p?.username || "").trim().toLowerCase() ||
      String(p?.phone    || "").trim() ||
      String(p?.playerName || "").trim().toLowerCase()
    ).filter(Boolean)
  );

  return (state.allPlayers || []).filter((player) => {
    const playerId    = String(getPlayerId(player) || "");
    const playerName  = String(getPlayerDisplayName(player) || "").trim();
    const playerUsername = String(player?.username || "").trim().toLowerCase();
    const playerPhone = String(player?.phone || player?.playerPhone || "").trim();
    if (!playerId || !playerName) return false;
    if (captainIds.has(playerId)) return false;
    if (state.normalizeStatusPlayersPage?.(player) === "rejected") return false;
    const key = playerId || playerUsername || playerPhone || playerName.toLowerCase();
    return !existingKeys.has(key);
  });
}

// ── Make-captains modal ───────────────────────────────────────────────────────
function _makeCaptainsEl(id) { return document.getElementById(id); }

function openMakeCaptainsModal() {
  renderCaptainPickList();
  _makeCaptainsEl("make-captains-modal")?.classList.remove("hidden");
  _makeCaptainsEl("make-captains-modal")?.setAttribute("aria-hidden", "false");
}
function closeMakeCaptainsModal() {
  _makeCaptainsEl("make-captains-modal")?.classList.add("hidden");
  _makeCaptainsEl("make-captains-modal")?.setAttribute("aria-hidden", "true");
}

function openConfirmCaptainsModal() {
  renderConfirmCaptainsForm();
  _makeCaptainsEl("confirm-captains-modal")?.classList.remove("hidden");
  _makeCaptainsEl("confirm-captains-modal")?.setAttribute("aria-hidden", "false");
}
function closeConfirmCaptainsModal() {
  _makeCaptainsEl("confirm-captains-modal")?.classList.add("hidden");
  _makeCaptainsEl("confirm-captains-modal")?.setAttribute("aria-hidden", "true");
}

function renderCaptainPickList() {
  const list  = _makeCaptainsEl("make-captains-list");
  const empty = _makeCaptainsEl("make-captains-empty");
  if (!list) return;
  list.innerHTML = "";
  const accepted = getAcceptedPlayers();
  if (!accepted.length) { empty?.classList.remove("hidden"); return; }
  empty?.classList.add("hidden");
  accepted.forEach((player) => {
    const playerId = String(getPlayerId(player));
    const checked  = state.captainState.selectedCaptainIds.includes(playerId);
    const row = document.createElement("label");
    row.className = "captain-pick-row";
    row.innerHTML = `
      <div class="captain-pick-left">
        <input class="captain-checkbox" type="checkbox" value="${escapeHtml(playerId)}" ${checked ? "checked" : ""} />
        <div>
          <div class="captain-pick-name">${escapeHtml(getPlayerDisplayName(player))}</div>
          ${isTournamentTeamEvent() ? "" : `<div class="captain-pick-meta">${escapeHtml(getCategoryNameById(getPlayerCategoryId(player)))}</div>`}
        </div>
      </div>`;
    list.appendChild(row);
  });
}

function renderConfirmCaptainsForm() {
  const list  = _makeCaptainsEl("confirm-captains-list");
  const empty = _makeCaptainsEl("confirm-captains-empty");
  if (!list) return;
  list.innerHTML = "";
  const selected = state.captainState.selectedCaptainIds
    .map((id) => state.allPlayers.find((p) => String(getPlayerId(p)) === String(id)))
    .filter(Boolean);
  if (!selected.length) { empty?.classList.remove("hidden"); return; }
  empty?.classList.add("hidden");
  selected.forEach((player) => {
    const playerId = String(getPlayerId(player));
    const existing = state.captainState.confirmedCaptains.find((c) => String(c.playerId) === playerId);
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
        <input type="text" class="confirm-team-name-input" data-player-id="${escapeHtml(playerId)}"
          placeholder="e.g. Team Alpha" value="${escapeHtml(existing?.teamName || "")}" />
      </div>`;
    list.appendChild(card);
  });
}

// ── Captain summary cards ─────────────────────────────────────────────────────
export function renderCaptainsSummary() {
  const listEl   = document.getElementById("captains-summary-list");
  const section  = document.getElementById("captains-summary-section");
  const emptyEl  = document.getElementById("captains-summary-empty");
  if (!listEl) return;

  listEl.innerHTML = "";
  if (!Array.isArray(state.captainState.confirmedCaptains) || !state.captainState.confirmedCaptains.length) {
    section?.classList.add("hidden");
    emptyEl?.classList.remove("hidden");
    return;
  }
  section?.classList.remove("hidden");
  emptyEl?.classList.add("hidden");

  state.captainState.confirmedCaptains.forEach((captain) => {
    const playerId         = String(captain.playerId || "");
    const expanded         = expandedTeamIds.has(playerId);
    const canonicalTeam    = getCanonicalTeamForCaptain(playerId);
    const teamPlayers      = getCanonicalTeamPlayers(canonicalTeam || captain);
    const eligiblePlayers  = getManualAddEligiblePlayers(playerId);
    const effectiveTeamName = canonicalTeam?.teamName || captain.teamName || captain.playerName || "Team";
    const effectiveCaptain  = canonicalTeam?.captainName || captain.playerName || "—";
    const teamStatus        = String(canonicalTeam?.teamStatus || captain.teamStatus || "pending").toLowerCase();

    const statusClass = teamStatus === "accepted" ? "status-pill--accepted"
      : teamStatus === "rejected" ? "status-pill--rejected" : "status-pill--pending";
    const statusText = teamStatus === "accepted" ? "Team accepted"
      : teamStatus === "rejected" ? "Team rejected" : "Team pending";

    const card = document.createElement("div");
    card.className = "captain-summary-card team-setup-card";
    card.innerHTML = `
      <button type="button" class="captain-summary-head-btn" data-team-card-toggle="${escapeHtml(playerId)}">
        <div class="captain-summary-left">
          <div class="captain-summary-name">${escapeHtml(effectiveTeamName)}</div>
          <div class="captain-summary-meta">Captain: ${escapeHtml(effectiveCaptain)}</div>
        </div>
        <div class="row-actions team-setup-head-actions">
          <span class="status-pill ${statusClass}">${escapeHtml(statusText)}</span>
          <span class="team-name-chip team-toggle-chip">${expanded ? "▾" : "▸"}</span>
        </div>
      </button>
      <div class="team-setup-details${expanded ? "" : " hidden"}" data-team-card-body="${escapeHtml(playerId)}">
        <div class="helper-text team-setup-helper">Current team roster</div>
        ${teamPlayers.length
          ? `<div class="team-player-list">${teamPlayers.map((p, idx) => `
              <div class="team-player-row">
                <div class="team-player-main">
                  <span class="team-player-index">${idx + 1}</span>
                  <span class="team-player-name">${escapeHtml(p?.playerName || "Player")}</span>
                </div>
                <div class="team-player-meta">
                  ${p?.isCaptain
                    ? `<span class="status-pill status-pill--accepted">Captain</span>`
                    : `<span class="status-pill ${String(p?.inviteStatus || "accepted").toLowerCase() === "accepted" ? "status-pill--accepted"
                        : String(p?.inviteStatus || "pending").toLowerCase() === "rejected" ? "status-pill--rejected"
                        : "status-pill--pending"}">${escapeHtml(String(p?.inviteStatus || "accepted"))}</span>`}
                </div>
              </div>`).join("")}</div>`
          : `<div class="empty-state compact-empty team-setup-empty">
               <div class="feature-icon">👥</div>
               <h3>No team list yet</h3>
               <p class="muted">Captain-side and host-side team changes will appear here.</p>
             </div>`}
        <div class="row-actions team-setup-actions">
          <button type="button" class="action-btn accept" data-team-status="accepted" data-team-player-id="${escapeHtml(playerId)}">Accept team</button>
          <button type="button" class="action-btn reject" data-team-status="rejected" data-team-player-id="${escapeHtml(playerId)}">Reject team</button>
          <button type="button" class="action-btn" data-manual-toggle="${escapeHtml(playerId)}">Add manually</button>
        </div>
        <div class="team-manual-add hidden" data-manual-wrap="${escapeHtml(playerId)}">
          <select class="team-manual-select" data-manual-select="${escapeHtml(playerId)}">
            <option value="">Select player</option>
            ${eligiblePlayers.length
              ? eligiblePlayers.map((p) => `<option value="${escapeHtml(String(getPlayerId(p) || ""))}">${escapeHtml(String(getPlayerDisplayName(p) || ""))}</option>`).join("")
              : `<option value="" disabled>No players available</option>`}
          </select>
          <button type="button" class="action-btn" data-manual-add="${escapeHtml(playerId)}" ${eligiblePlayers.length ? "" : "disabled"}>Add</button>
        </div>
      </div>`;
    listEl.appendChild(card);
  });

  // FIX 4: Only toggle the clicked card — no full re-render
  listEl.querySelectorAll("[data-team-card-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const pid = String(btn.getAttribute("data-team-card-toggle") || "");
      if (!pid) return;
      if (expandedTeamIds.has(pid)) expandedTeamIds.delete(pid); else expandedTeamIds.add(pid);
      listEl.querySelector(`[data-team-card-body="${CSS.escape(pid)}"]`)?.classList.toggle("hidden");
      const chip = btn.querySelector(".team-toggle-chip");
      if (chip) chip.textContent = expandedTeamIds.has(pid) ? "▾" : "▸";
    });
  });

  listEl.querySelectorAll("[data-team-status]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const pid        = String(btn.getAttribute("data-team-player-id") || "");
      const nextStatus = String(btn.getAttribute("data-team-status") || "pending");
      if (!pid) return;
      try { await updateCaptainTeamStatus(pid, nextStatus); renderCaptainsSummary(); }
      catch (err) { alert(err.message || "Could not update team status."); }
    });
  });

  listEl.querySelectorAll("[data-manual-toggle]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const pid = String(btn.getAttribute("data-manual-toggle") || "");
      if (!pid) return;
      listEl.querySelector(`[data-manual-wrap="${CSS.escape(pid)}"]`)?.classList.toggle("hidden");
    });
  });

  listEl.querySelectorAll("[data-manual-add]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const pid    = String(btn.getAttribute("data-manual-add") || "");
      const select = listEl.querySelector(`[data-manual-select="${CSS.escape(pid)}"]`);
      const addedId = String(select?.value || "");
      if (!addedId) { alert("Please select a player first."); return; }
      try { await addManualPlayerToCaptainTeam(pid, addedId); renderCaptainsSummary(); }
      catch (err) { alert(err.message || "Could not add player manually."); }
    });
  });
}

// ── Pools ─────────────────────────────────────────────────────────────────────
export async function loadPoolsFromDb() {
  const r = await apiGet(`/api/host/tournaments/${encodeURIComponent(_tournamentId)}/pools`);
  state.captainState.pools = r.ok ? (r.data || null) : null;
}

export async function savePoolsToDb() {
  const r = await apiPut(
    `/api/host/tournaments/${encodeURIComponent(_tournamentId)}/pools`,
    { pools: state.captainState.pools }
  );
  if (!r.ok) throw new Error("Could not save pools");
}

function buildEmptyPools() {
  const pools = { groups: {}, unassigned: [] };
  const groupCount = Number(state.tournamentMetaCache?.groupCount || 0);
  for (let i = 1; i <= groupCount; i += 1) pools.groups[`Pool ${i}`] = [];
  return pools;
}

function buildRandomPools(teams, groupCount) {
  const pools = buildEmptyPools();
  const shuffled = shuffle([...teams]);
  const poolNames = Object.keys(pools.groups);
  shuffled.forEach((team, idx) => { pools.groups[poolNames[idx % groupCount]].push(team.teamKey); });
  return pools;
}

function ensurePoolsState() {
  const teams      = getConfirmedTeams();
  const validKeys  = new Set(teams.map((t) => t.teamKey));
  const groupCount = Number(state.tournamentMetaCache?.groupCount || 0);

  if (!state.captainState.pools || !state.captainState.pools.groups ||
      Object.keys(state.captainState.pools.groups).length !== groupCount) {
    state.captainState.pools = buildEmptyPools();
  }

  const placed = new Set();
  Object.keys(state.captainState.pools.groups).forEach((poolName) => {
    state.captainState.pools.groups[poolName] = (state.captainState.pools.groups[poolName] || [])
      .filter((k) => { const ok = validKeys.has(k) && !placed.has(k); if (ok) placed.add(k); return ok; });
  });
  state.captainState.pools.unassigned = (state.captainState.pools.unassigned || [])
    .filter((k) => { const ok = validKeys.has(k) && !placed.has(k); if (ok) placed.add(k); return ok; });
  teams.forEach((team) => { if (!placed.has(team.teamKey)) state.captainState.pools.unassigned.push(team.teamKey); });
}

export function renderPools() {
  const poolsGrid     = document.getElementById("pools-grid");
  const unassignedEl  = document.getElementById("unassigned-teams");
  if (!poolsGrid || !unassignedEl) return;

  const teams    = getConfirmedTeams();
  const teamMap  = Object.fromEntries(teams.map((t) => [t.teamKey, t]));

  const renderZone = (teams_in_zone, zoneName) => `
    <div class="team-dropzone" data-zone="${escapeHtml(zoneName)}">
      ${teams_in_zone.map((key) => {
        const t = teamMap[key];
        if (!t) return "";
        return `<div class="team-drag-chip" draggable="true" data-team-key="${escapeHtml(key)}">${escapeHtml(t.teamName)}</div>`;
      }).join("")}
    </div>`;

  unassignedEl.innerHTML = renderZone(state.captainState.pools?.unassigned || [], "unassigned");
  poolsGrid.innerHTML = "";

  Object.entries(state.captainState.pools?.groups || {}).forEach(([poolName, teamKeys]) => {
    const col = document.createElement("div");
    col.className = "pool-column";
    col.innerHTML = `
      <h3 class="pool-name">${escapeHtml(poolName)}</h3>
      ${renderZone(teamKeys, poolName)}`;
    poolsGrid.appendChild(col);
  });

  _bindPoolDragListeners();
}

function _moveTeamToZone(teamKey, zoneName) {
  const pools = state.captainState.pools;
  if (!pools) return;
  Object.keys(pools.groups).forEach((n) => {
    pools.groups[n] = pools.groups[n].filter((k) => k !== teamKey);
  });
  pools.unassigned = (pools.unassigned || []).filter((k) => k !== teamKey);
  if (zoneName === "unassigned") pools.unassigned.push(teamKey);
  else if (pools.groups[zoneName]) pools.groups[zoneName].push(teamKey);
}

function _bindPoolDragListeners() {
  let dragged = null;
  document.querySelectorAll(".team-drag-chip").forEach((chip) => {
    chip.addEventListener("dragstart", (e) => {
      dragged = chip.dataset.teamKey;
      e.dataTransfer.effectAllowed = "move";
    });
  });
  document.querySelectorAll(".team-dropzone").forEach((zone) => {
    zone.addEventListener("dragover",  (e) => { e.preventDefault(); zone.classList.add("drag-over"); });
    zone.addEventListener("dragleave", ()  => zone.classList.remove("drag-over"));
    zone.addEventListener("drop",      async (e) => {
      e.preventDefault();
      zone.classList.remove("drag-over");
      if (!dragged) return;
      _moveTeamToZone(dragged, zone.dataset.zone);
      dragged = null;
      renderPools();
      try { await savePoolsToDb(); } catch { /* silent */ }
    });
  });
}

// ── Static event listeners (bound once at init) ───────────────────────────────
function _bindStaticListeners() {
  // Make captains button
  document.getElementById("make-captains-btn")?.addEventListener("click", openMakeCaptainsModal);
  document.getElementById("make-captains-close")?.addEventListener("click", closeMakeCaptainsModal);
  document.getElementById("make-captains-cancel-btn")?.addEventListener("click", closeMakeCaptainsModal);
  document.getElementById("make-captains-modal")?.addEventListener("click", (e) => {
    if (e.target === document.getElementById("make-captains-modal")) closeMakeCaptainsModal();
  });

  document.getElementById("make-captains-save-btn")?.addEventListener("click", () => {
    state.captainState.selectedCaptainIds = Array.from(
      document.querySelectorAll("#make-captains-list .captain-checkbox:checked")
    ).map((el) => String(el.value));
    closeMakeCaptainsModal();
    openConfirmCaptainsModal();
  });

  // Confirm captains
  document.getElementById("confirm-captains-close")?.addEventListener("click", closeConfirmCaptainsModal);
  document.getElementById("confirm-captains-cancel-btn")?.addEventListener("click", closeConfirmCaptainsModal);
  document.getElementById("confirm-captains-modal")?.addEventListener("click", (e) => {
    if (e.target === document.getElementById("confirm-captains-modal")) closeConfirmCaptainsModal();
  });

  document.getElementById("confirm-captains-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const list     = document.getElementById("confirm-captains-list");
    const selected = state.captainState.selectedCaptainIds
      .map((id) => state.allPlayers.find((p) => String(getPlayerId(p)) === String(id)))
      .filter(Boolean);

    state.captainState.confirmedCaptains = selected.map((player, idx) => {
      const playerId     = String(getPlayerId(player));
      const existing     = state.captainState.confirmedCaptains.find((c) => String(c.playerId) === playerId) || {};
      const nameInput    = list?.querySelector(`.confirm-team-name-input[data-player-id="${CSS.escape(playerId)}"]`);
      return {
        ...existing,
        playerId,
        playerName: getPlayerDisplayName(player),
        categoryId: getPlayerCategoryId(player),
        teamName:   nameInput?.value?.trim() || existing.teamName || `Team ${idx + 1}`,
        teamStatus: existing.teamStatus || "pending",
        teamPlayers: Array.isArray(existing.teamPlayers) ? existing.teamPlayers
          : Array.isArray(existing.players) ? existing.players
          : Array.isArray(existing.members) ? existing.members
          : Array.isArray(existing.submittedPlayers) ? existing.submittedPlayers
          : Array.isArray(existing.roster) ? existing.roster
          : [],
      };
    });

    try {
      await saveCaptainStateToDb();
      await refreshTeamSetupState();
      closeConfirmCaptainsModal();
      renderCaptainsSummary();
      _callbacks.refreshStageSpecificUi?.();
    } catch (err) {
      alert(err.message || "Could not save captains.");
    }
  });

  // Pools section
  document.getElementById("create-pools-btn")?.addEventListener("click", _openPoolsSection);
  document.getElementById("reset-pools-btn")?.addEventListener("click", async () => {
    state.captainState.pools = buildEmptyPools();
    ensurePoolsState();
    renderPools();
    try { await savePoolsToDb(); } catch { /* silent */ }
  });
  document.getElementById("randomize-pools-btn")?.addEventListener("click", async () => {
    const teams = getConfirmedTeams();
    const groupCount = Number(state.tournamentMetaCache?.groupCount || 0);
    if (!groupCount) { alert("No groups configured."); return; }
    state.captainState.pools = buildRandomPools(teams, groupCount);
    renderPools();
    try { await savePoolsToDb(); } catch { /* silent */ }
  });

  // Team-setup section toggle
  document.getElementById("team-setup-toggle-btn")?.addEventListener("click", () => {
    state.isTeamSetupCollapsed = !state.isTeamSetupCollapsed;
    _callbacks.syncTeamSetupUi?.();
  });
}

function _openPoolsSection() {
  if (!isGroupKnockoutFormat()) return;
  if (!state.captainState.confirmedCaptains.length) {
    alert("Please confirm captains first.");
    return;
  }
  ensurePoolsState();
  document.getElementById("pools-section")?.classList.remove("hidden");
  renderPools();
  document.getElementById("pools-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
}
