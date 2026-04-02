import { requireAuth, logout } from "./auth.js";

let allTournaments = [];
let selectedTournament = null;
let currentSportFilter = "all";
let currentTournamentStatusFilter = "all";
let currentSearchTerm = "";

let myTournaments = [];
let currentMySportFilter = "all";
let currentMyTournamentStatusFilter = "all";
let currentMySearchTerm = "";

let activeTab = "dashboard";
const statFilterState = {
  tournaments: "all",
  titles: "all",
  matches: "all",
  winpct: "all",
};

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

function fillCategoryDropdown(t) {
  const catSelect = document.getElementById("player-category");
  if (!catSelect) return;

  catSelect.innerHTML = `<option value="">Select category</option>`;

  const cats = normalizeCategories(t?.categories).filter(Boolean);

  cats.forEach((c) => {
    const id = c.categoryId || c.id || "";
    const labelParts = [
      c.ageGroup,
      c.gender,
      c.teamSize ? `Team size ${c.teamSize}` : null
    ].filter(Boolean);

    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent =
      (labelParts.join(" • ") || "Category") + (id ? ` (ID: ${id})` : "");
    catSelect.appendChild(opt);
  });

  if (!cats.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No categories found";
    catSelect.appendChild(opt);
  }
}

function normalizeTournamentList(raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object") return [];

  const keys = ["tournaments", "items", "data", "rows", "results", "list", "payload"];
  for (const k of keys) {
    const v = raw[k];
    if (Array.isArray(v)) return v;
    if (v && typeof v === "object") {
      for (const k2 of keys) {
        const v2 = v[k2];
        if (Array.isArray(v2)) return v2;
      }
    }
  }

  return [];
}

function normalizeStatus(p) {
  const raw = p?.status ?? p?.registrationStatus ?? p?.state ?? "accepted";
  const s = String(raw).toLowerCase();
  if (["rejected", "reject", "declined", "denied"].includes(s)) return "rejected";
  if (["pending", "awaiting"].includes(s)) return "pending";
  return "accepted";
}

function normalizeIdentity(value) {
  return String(value || "").trim().toLowerCase();
}

function identitiesMatch(a, b) {
  return normalizeIdentity(a) && normalizeIdentity(a) === normalizeIdentity(b);
}

function parseTournamentEndDate(tournamentDates) {
  if (!tournamentDates) return null;

  const raw = String(tournamentDates).trim();

  if (raw.includes("to")) {
    const parts = raw.split("to").map((p) => p.trim());
    const end = new Date(parts[1]);
    return Number.isNaN(end.getTime()) ? null : end;
  }

  const single = new Date(raw);
  return Number.isNaN(single.getTime()) ? null : single;
}

function parseTournamentStartDate(tournamentDates) {
  if (!tournamentDates) return null;

  const raw = String(tournamentDates).trim();

  if (raw.includes("to")) {
    const parts = raw.split("to").map((p) => p.trim());
    const start = new Date(parts[0]);
    return Number.isNaN(start.getTime()) ? null : start;
  }

  const single = new Date(raw);
  return Number.isNaN(single.getTime()) ? null : single;
}

function getTournamentTimeStatus(t) {
  const endDate = parseTournamentEndDate(t.tournamentDates);
  if (!endDate) return "upcoming";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);

  return endDate < today ? "completed" : "upcoming";
}

function formatTournamentDateForCard(tournamentDates) {
  return tournamentDates || "";
}

async function apiGet(path) {
  const res = await fetch(path, {
    headers: { Authorization: "Bearer " + localStorage.getItem("token") }
  });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + localStorage.getItem("token")
    },
    body: JSON.stringify(body || {})
  });

  const raw = await res.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw;
  }

  if (!res.ok) {
    console.error("POST failed", path, res.status, data);

    const msg =
      (typeof data === "object" && data && (data.message || data.error)) ? (data.message || data.error) :
      (typeof data === "string" && data.trim()) ? data :
      `Request failed (${res.status})`;

    alert(`${msg}`);
    return null;
  }

  return data;
}

/* -------------------------
   MODALS (Code + Player)
------------------------- */
function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
}

function wireModalCloseButtons() {
  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      closeModal("code-modal");
      closeModal("player-modal");
    });
  });

  ["code-modal", "player-modal"].forEach((id) => {
    const overlay = document.getElementById(id);
    overlay?.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal(id);
    });
  });
}

/* -------------------------
   LEFT PANEL TABS
------------------------- */
function setActiveTab(tabName) {
  activeTab = tabName;

  document.querySelectorAll(".join-nav-btn").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.tab === tabName);
  });

  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.panel === tabName);
  });

  if (tabName === "mine" || tabName === "dashboard" || tabName === "notifications") {
    loadMyTournaments().catch((err) => console.error(err));
  }
}

function wireTabs() {
  document.querySelectorAll(".join-nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
  });
}

function wireSidebarToggle() {
  const sidebar = document.getElementById("join-sidebar");
  const toggleBtn = document.getElementById("sidebar-toggle-btn");
  toggleBtn?.addEventListener("click", () => {
    sidebar?.classList.toggle("is-collapsed");
  });
}

/* -------------------------
   ALL TOURNAMENTS
------------------------- */
function renderTournamentList(tournaments) {
  const list = document.getElementById("tournament-list");
  const empty = document.getElementById("empty-state");
  if (!list || !empty) return;

  list.innerHTML = "";

  if (!tournaments || tournaments.length === 0) {
    empty.style.display = "block";
    return;
  }

  empty.style.display = "none";

  tournaments.forEach((t) => {
    const tournamentId = t.tournamentId ?? t.id;
    const registrationsOpen = t.registrationsOpen !== false;

    const card = document.createElement("div");
    card.className = "tournament-card";

    card.innerHTML = `
      <div class="tournament-primary-line">
        <span class="tournament-name">${t.tournamentName ?? "Unnamed tournament"}</span>
        <span class="status-pill ${registrationsOpen ? "status-pill--open" : "status-pill--closed"}">
          ${registrationsOpen ? "Open" : "Closed"}
        </span>
      </div>

      <div class="tournament-meta">
        <span>${t.sportName ?? ""}</span>
        <span>${formatTournamentDateForCard(t.tournamentDates)}</span>
        <span>${t.venue ?? ""}</span>
      </div>
    `;

    card.addEventListener("click", () => {
      if (!registrationsOpen) {
        alert("Registrations are closed for this tournament.");
        return;
      }
      selectedTournament = { ...t, tournamentId };
      openCodeModal(selectedTournament);
    });

    list.appendChild(card);
  });
}

function renderFilteredTournaments() {
  const bySport = currentSportFilter === "all"
    ? allTournaments
    : allTournaments.filter((t) => t.sportName === currentSportFilter);

  const byStatus = currentTournamentStatusFilter === "all"
    ? bySport
    : bySport.filter((t) => getTournamentTimeStatus(t) === currentTournamentStatusFilter);

  const term = currentSearchTerm.trim().toLowerCase();
  const byName = term
    ? byStatus.filter((t) => String(t.tournamentName || "").toLowerCase().includes(term))
    : byStatus;

  renderTournamentList(byName);
}

function populateSportFilterFromAll(all) {
  const select = document.getElementById("sport-filter");
  if (!select) return;

  const sports = [...new Set((all || []).map((t) => t.sportName).filter(Boolean))];

  select.innerHTML = `<option value="all">All sports</option>`;
  sports.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    select.appendChild(opt);
  });
}

function wireSportFilter() {
  const select = document.getElementById("sport-filter");
  if (!select) return;

  select.addEventListener("change", (e) => {
    currentSportFilter = e.target.value;
    renderFilteredTournaments();
  });
}

function wireTournamentStatusFilter() {
  const select = document.getElementById("tournament-status-filter");
  if (!select) return;

  select.addEventListener("change", (e) => {
    currentTournamentStatusFilter = e.target.value;
    renderFilteredTournaments();
  });
}

function wireTournamentSearch() {
  const input = document.getElementById("tournament-search");
  if (!input) return;

  input.addEventListener("input", (e) => {
    currentSearchTerm = e.target.value || "";
    renderFilteredTournaments();
  });
}

async function loadAllTournaments() {
  try {
    const raw = await apiGet("/api/tournaments");
    allTournaments = normalizeTournamentList(raw);
    populateSportFilterFromAll(allTournaments);
    renderFilteredTournaments();
  } catch (err) {
    console.error("Failed to load tournaments", err);
    allTournaments = [];
    populateSportFilterFromAll(allTournaments);
    renderFilteredTournaments();
  }
}

/* -------------------------
   JOIN FLOW
------------------------- */
function openCodeModal(t) {
  const codeInput = document.getElementById("code-input");
  const codeError = document.getElementById("code-error");
  if (codeInput) codeInput.value = "";
  if (codeError) codeError.style.display = "none";

  fillCategoryDropdown(t);

  const title = document.getElementById("code-modal-title");
  if (title) title.textContent = `Enter code for ${t.tournamentName ?? "tournament"}`;

  openModal("code-modal");
}

async function hydrateTournamentMeta(tournamentId) {
  if (!tournamentId) return null;
  try {
    const data = await apiGet(`/api/tournaments/${encodeURIComponent(tournamentId)}`);
    if (data && typeof data === "object") return data;
  } catch (err) {
    console.warn("Failed to load tournament details", err);
  }
  return null;
}

async function openTournamentFromQueryIfPresent() {
  const params = new URLSearchParams(window.location.search);
  const tournamentId = params.get("tournamentId");
  if (!tournamentId) return;

  try {
    const meta = await hydrateTournamentMeta(tournamentId);
    if (!meta) return;

    const normalizedTournament = {
      ...meta,
      tournamentId: meta.tournamentId || meta.id || tournamentId,
    };

    selectedTournament = normalizedTournament;
    openCodeModal(normalizedTournament);
  } catch (err) {
    console.warn("Could not open tournament from shared link", err);
  }
}

function openPlayerModal(t, user) {
  const form = document.getElementById("player-form");
  form?.reset();

  const nameEl = document.getElementById("player-name");
  const phoneEl = document.getElementById("player-phone");
  const ageEl = document.getElementById("player-age");
  const genderEl = document.getElementById("player-gender");

  if (ageEl && user?.age != null) ageEl.value = user.age;
  if (genderEl && user?.gender) genderEl.value = user.gender;
  if (nameEl && user?.name) nameEl.value = user.name;
  if (phoneEl && (user?.phone || user?.phoneNumber)) phoneEl.value = user.phone || user.phoneNumber;

  const title = document.getElementById("player-modal-title");
  if (title) title.textContent = `Register for ${t.tournamentName ?? "tournament"}`;

  openModal("player-modal");
}

function wireCodeForm() {
  const form = document.getElementById("code-form");
  const codeInput = document.getElementById("code-input");
  const codeError = document.getElementById("code-error");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!selectedTournament) return;

    const code = (codeInput?.value || "").trim();
    if (!code) return;

    const result = await apiPost("/api/tournaments/validate-code", {
      code,
      accessCode: code,
      tournamentId: selectedTournament.tournamentId
    });

    if (!result) {
      if (codeError) codeError.style.display = "block";
      return;
    }

    if (result.tournamentId && selectedTournament) {
      selectedTournament.tournamentId = result.tournamentId;
    }

    if (
      result.tournamentId &&
      selectedTournament?.tournamentId &&
      String(result.tournamentId) !== String(selectedTournament.tournamentId)
    ) {
      alert("This code belongs to a different tournament card. Please select the correct tournament from the list.");
      return;
    }

    if ((!selectedTournament.categories || selectedTournament.categories.length === 0) && selectedTournament.tournamentId) {
      const fresh = await hydrateTournamentMeta(selectedTournament.tournamentId);
      if (fresh?.categories) selectedTournament.categories = fresh.categories;
    }

    closeModal("code-modal");
    openPlayerModal(selectedTournament, window.__me);
  });
}

function wirePlayerForm(user) {
  const form = document.getElementById("player-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!selectedTournament) return;

    const payload = {
      tournamentId: selectedTournament.tournamentId,
      playerName: document.getElementById("player-name")?.value?.trim(),
      name: document.getElementById("player-name")?.value?.trim(),
      age: Number(document.getElementById("player-age")?.value),
      gender: document.getElementById("player-gender")?.value,
      phone: document.getElementById("player-phone")?.value?.trim(),
      playerPhone: document.getElementById("player-phone")?.value?.trim(),
      categoryId: document.getElementById("player-category")?.value,
      category: document.getElementById("player-category")?.value,
      username: user.username,
      accessCode: selectedTournament.accessCode
    };

    const tid = payload.tournamentId;
    const chosenCategoryId = payload.categoryId;
    if (!chosenCategoryId) {
      alert("Please select a category.");
      return;
    }

    try {
      const existing = await apiGet(`/api/tournaments/${encodeURIComponent(tid)}/players`);
      const players = Array.isArray(existing) ? existing : (existing?.players || existing?.items || []);

      const already = players.some((p) => {
        const u = p.username ?? p.userName ?? p.user ?? "";
        const c = p.categoryId ?? p.category ?? p.categoryID ?? "";
        return String(u) === String(user.username) && String(c) === String(chosenCategoryId);
      });

      if (already) {
        alert("You have already joined this category. You can join other categories in the same tournament.");
        return;
      }
    } catch (e2) {
      console.warn("Could not validate duplicate category join.", e2);
    }

    const result = await apiPost(`/api/player/tournaments/${tid}/register`, payload);

    if (!result) {
      alert("Registration failed. Please try again.");
      return;
    }

    alert("Registered successfully!");
    closeModal("player-modal");
    await loadMyTournaments();
  });
}

/* -------------------------
   CAPTAIN CHECK
------------------------- */


function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}





/* -------------------------
   MY TOURNAMENTS
------------------------- */
async function renderMyTournaments(tournaments) {
  const list = document.getElementById("my-tournament-list");
  const empty = document.getElementById("my-empty-state");
  if (!list || !empty) return;

  list.innerHTML = "";

  if (!tournaments || tournaments.length === 0) {
    empty.style.display = "block";
    return;
  }

  empty.style.display = "none";

  for (const t of tournaments) {
    const tournamentId = t.tournamentId ?? t.id;
    const status = normalizeStatus(t.myPlayer || t);
    const isCaptain = await isUserCaptainForTournament(t, window.__me);
    const acceptedTeam = await hasAcceptedTeamForTournament(t, window.__me);
    const showTeamButton = isCaptain || acceptedTeam;
    const teamButtonLabel = isCaptain ? "Create/View my team" : "View my team";

    const card = document.createElement("div");
    card.className = "tournament-card";

    card.innerHTML = `
      <div class="tournament-primary-line">
        <span class="tournament-name">${t.tournamentName ?? "Tournament"}</span>
        <span class="status-pill ${status === "rejected" ? "status-pill--closed" : "status-pill--open"}">
          ${status === "rejected" ? "Rejected" : status === "pending" ? "Pending" : "Joined"}
        </span>
      </div>
      <div class="tournament-meta">
        <span>${t.sportName ?? ""}</span>
        <span>${formatTournamentDateForCard(t.tournamentDates)}</span>
        <span>${t.venue ?? ""}</span>
      </div>
      <div class="tournament-actions">
        ${showTeamButton ? `<button type="button" class="captain-btn create-team-btn">${teamButtonLabel}</button>` : ""}
        <button type="button" class="leave-btn">Opt out</button>
      </div>
    `;

    card.addEventListener("click", () => {
      if (status === "rejected") {
        alert("You were rejected for this tournament.");
        return;
      }
      window.location.href = `schedule.html?tournamentId=${tournamentId}`;
    });

    card.querySelector(".leave-btn")?.addEventListener("click", async (e) => {
      e.stopPropagation();
      const ok = confirm("Leave this tournament?");
      if (!ok) return;
      const res = await apiPost(`/api/player/tournaments/${tournamentId}/leave`, {
        tournamentId,
        categoryId: t.myPlayer?.categoryId,
      });
      if (!res) return;
      await loadMyTournaments();
    });

    card.querySelector(".create-team-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      window.location.href = `team.html?tournamentId=${tournamentId}`;
    });

    list.appendChild(card);
  }
}

function populateSportFilterFromMine(list) {
  const select = document.getElementById("my-sport-filter");
  if (!select) return;

  const sports = [...new Set((list || []).map((t) => t.sportName).filter(Boolean))];

  select.innerHTML = `<option value="all">All sports</option>`;
  sports.forEach((sport) => {
    const opt = document.createElement("option");
    opt.value = sport;
    opt.textContent = sport;
    select.appendChild(opt);
  });
}

async function renderFilteredMyTournaments() {
    const bySport = currentMySportFilter === "all"
    ? myTournaments
    : myTournaments.filter((t) => t.sportName === currentMySportFilter);

  const byStatus = currentMyTournamentStatusFilter === "all"
    ? bySport
    : bySport.filter((t) => getTournamentTimeStatus(t) === currentMyTournamentStatusFilter);

  const term = currentMySearchTerm.trim().toLowerCase();
  const byName = term
    ? byStatus.filter((t) => String(t.tournamentName || "").toLowerCase().includes(term))
    : byStatus;

  await renderMyTournaments(byName);
}

function wireMySportFilter() {
  const select = document.getElementById("my-sport-filter");
  if (!select) return;

  select.addEventListener("change", (e) => {
    currentMySportFilter = e.target.value;
    renderFilteredMyTournaments();
  });
}

function wireMyTournamentStatusFilter() {
  const select = document.getElementById("my-tournament-status-filter");
  if (!select) return;

  select.addEventListener("change", (e) => {
    currentMyTournamentStatusFilter = e.target.value;
    renderFilteredMyTournaments();
  });
}

function wireMyTournamentSearch() {
  const input = document.getElementById("my-tournament-search");
  if (!input) return;

  input.addEventListener("input", (e) => {
    currentMySearchTerm = e.target.value || "";
    renderFilteredMyTournaments();
  });
}

async function loadMyTournaments() {
  try {
    const raw = await apiGet("/api/player/tournaments");
    myTournaments = normalizeTournamentList(raw);
    populateSportFilterFromMine(myTournaments);
    await renderFilteredMyTournaments();
renderDashboard();
await renderNotifications(window.__me);
  } catch (err) {
    console.error("Failed to load player tournaments", err);
    myTournaments = [];
    populateSportFilterFromMine(myTournaments);
    await renderFilteredMyTournaments();
renderDashboard();
await renderNotifications(window.__me);
  }
}

/* -------------------------
   NOTIFICATIONS
------------------------- */

async function loadCaptainStateForTournament(tournamentId) {
  try {
    return await apiGet(`/api/host/tournaments/${encodeURIComponent(tournamentId)}/captains`);
  } catch {
    return null;
  }
}

async function loadTeamRequestsForTournament(tournamentId) {
  try {
    return await apiGet(`/api/host/tournaments/${encodeURIComponent(tournamentId)}/team-requests`);
  } catch {
    return [];
  }
}

async function isUserCaptainForTournament(tournament, user) {
  const tournamentId = tournament?.tournamentId ?? tournament?.id;
  if (!tournamentId || !user) return false;

  const captainState = await loadCaptainStateForTournament(tournamentId);
  const confirmed = Array.isArray(captainState?.confirmedCaptains) ? captainState.confirmedCaptains : [];

  return confirmed.some((captain) => {
    return (
      identitiesMatch(captain?.playerName, user?.name) ||
      identitiesMatch(captain?.playerName, user?.username)
    );
  });
}

async function hasAcceptedTeamForTournament(tournament, user) {
  const tournamentId = tournament?.tournamentId ?? tournament?.id;
  if (!tournamentId || !user) return false;

  const requests = await loadTeamRequestsForTournament(tournamentId);
  const arr = Array.isArray(requests) ? requests : [];

  return arr.some((req) => {
    const invitedPlayers = Array.isArray(req?.invitedPlayers) ? req.invitedPlayers : [];
    return invitedPlayers.some((p) => {
      const sameUser =
        identitiesMatch(p?.username, user?.username) ||
        identitiesMatch(p?.playerName, user?.name) ||
        identitiesMatch(p?.playerName, user?.username);

      return sameUser && p.inviteStatus === "accepted";
    });
  });
}

async function renderTeamInvites(user) {
  const section = document.getElementById("team-invite-section");
  const list = document.getElementById("team-invite-list");
  if (!section || !list) return;

  list.innerHTML = "";

  const tournamentIds = myTournaments.map((t) => t.tournamentId ?? t.id).filter(Boolean);
  const cards = [];

  for (const tournamentId of tournamentIds) {
    const requests = await loadTeamRequestsForTournament(tournamentId);
    const arr = Array.isArray(requests) ? requests : [];

    arr.forEach((req) => {
      const invitedPlayers = Array.isArray(req?.invitedPlayers) ? req.invitedPlayers : [];

      invitedPlayers.forEach((p) => {
        const sameUser =
          identitiesMatch(p?.username, user?.username) ||
          identitiesMatch(p?.playerName, user?.name) ||
          identitiesMatch(p?.playerName, user?.username);

        if (!sameUser || p.inviteStatus !== "pending") return;

        cards.push({
          tournamentId,
          requestId: req.requestId,
          playerId: p.playerId,
          teamName: req.teamName,
          captainName: req.captainName,
          tournamentName: req.tournamentName,
          categoryLabel: req.categoryLabel,
        });
      });
    });
  }

  if (!cards.length) {
    section.classList.add("hidden");
    return;
  }

  section.classList.remove("hidden");

  cards.forEach((invite) => {
    const card = document.createElement("div");
    card.className = "team-invite-card";
    card.innerHTML = `
      <div class="team-invite-head">
        <div>
          <h3>${invite.teamName || "Team request"}</h3>
          <p class="helper-text">
            ${invite.captainName || "Captain"} invited you to join team in
            <strong>${invite.tournamentName || "Tournament"}</strong>
          </p>
          ${invite.categoryLabel ? `<p class="helper-text">Category: ${invite.categoryLabel}</p>` : ""}
        </div>
      </div>

      <div class="team-invite-actions">
        <button type="button" class="btn-primary accept-team-invite-btn">Accept</button>
        <button type="button" class="btn-dark reject-team-invite-btn">Reject</button>
      </div>
    `;

    card.querySelector(".accept-team-invite-btn")?.addEventListener("click", async () => {
      const res = await fetch(
        `/api/host/tournaments/${encodeURIComponent(invite.tournamentId)}/team-requests/${encodeURIComponent(invite.requestId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + localStorage.getItem("token"),
          },
          body: JSON.stringify({
            playerId: invite.playerId,
            status: "accepted",
          }),
        }
      );

      if (!res.ok) {
        alert("Could not accept invite.");
        return;
      }

      await renderTeamInvites(user);
      await loadMyTournaments();
      alert("Team invite accepted.");
    });

    card.querySelector(".reject-team-invite-btn")?.addEventListener("click", async () => {
      const res = await fetch(
        `/api/host/tournaments/${encodeURIComponent(invite.tournamentId)}/team-requests/${encodeURIComponent(invite.requestId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + localStorage.getItem("token"),
          },
          body: JSON.stringify({
            playerId: invite.playerId,
            status: "rejected",
          }),
        }
      );

      if (!res.ok) {
        alert("Could not reject invite.");
        return;
      }

      await renderTeamInvites(user);
      alert("Team invite rejected.");
    });

    list.appendChild(card);
  });
}

function updateSidebarNotificationBadgeFromCount(count) {
  const badge = document.getElementById("sidebar-notification-badge");
  if (!badge) return;

  if (!count) {
    badge.classList.add("hidden");
    badge.textContent = "0";
    return;
  }

  badge.classList.remove("hidden");
  badge.textContent = String(count);
}

async function renderNotifications(user) {
  const list = document.getElementById("notification-list");
  const empty = document.getElementById("notification-empty-state");
  if (!list || !empty) return;

  list.innerHTML = "";

  const tournamentIds = myTournaments.map((t) => t.tournamentId ?? t.id).filter(Boolean);
  const cards = [];

  for (const tournamentId of tournamentIds) {
    const requests = await loadTeamRequestsForTournament(tournamentId);
    const arr = Array.isArray(requests) ? requests : [];

    arr.forEach((req) => {
      const invitedPlayers = Array.isArray(req?.invitedPlayers) ? req.invitedPlayers : [];

      invitedPlayers.forEach((p) => {
        const sameUser =
          identitiesMatch(p?.username, user?.username) ||
          identitiesMatch(p?.playerName, user?.name) ||
          identitiesMatch(p?.playerName, user?.username);

        if (!sameUser || p.inviteStatus !== "pending") return;

        cards.push({
          tournamentId,
          requestId: req.requestId,
          playerId: p.playerId,
          teamName: req.teamName,
          captainName: req.captainName,
          tournamentName: req.tournamentName,
          categoryLabel: req.categoryLabel,
          createdAt: req.createdAt || "",
        });
      });
    });
  }

  cards.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (!cards.length) {
    empty.style.display = "block";
    updateSidebarNotificationBadgeFromCount(0);
    return;
  }

  empty.style.display = "none";
  updateSidebarNotificationBadgeFromCount(cards.length);

  cards.forEach((invite) => {
    const card = document.createElement("div");
    card.className = "notification-card";
    card.innerHTML = `
      <h3 class="notification-title">${invite.teamName || "Team join request"}</h3>
      <p class="helper-text">
        ${invite.captainName || "Captain"} invited you to join
        <strong>${invite.tournamentName || "Tournament"}</strong>
      </p>
      ${invite.categoryLabel ? `<p class="helper-text">Category: ${invite.categoryLabel}</p>` : ""}
      <div class="notification-actions">
        <button type="button" class="btn-primary accept-team-invite-btn">Accept</button>
        <button type="button" class="btn-dark reject-team-invite-btn">Reject</button>
      </div>
    `;

    card.querySelector(".accept-team-invite-btn")?.addEventListener("click", async () => {
      const res = await fetch(
        `/api/host/tournaments/${encodeURIComponent(invite.tournamentId)}/team-requests/${encodeURIComponent(invite.requestId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + localStorage.getItem("token"),
          },
          body: JSON.stringify({
            playerId: invite.playerId,
            status: "accepted",
          }),
        }
      );

      if (!res.ok) {
        alert("Could not accept invite.");
        return;
      }

      await renderNotifications(user);
      await renderTeamInvites(user);
      await loadMyTournaments();
      alert("Team invite accepted.");
    });

    card.querySelector(".reject-team-invite-btn")?.addEventListener("click", async () => {
      const res = await fetch(
        `/api/host/tournaments/${encodeURIComponent(invite.tournamentId)}/team-requests/${encodeURIComponent(invite.requestId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + localStorage.getItem("token"),
          },
          body: JSON.stringify({
            playerId: invite.playerId,
            status: "rejected",
          }),
        }
      );

      if (!res.ok) {
        alert("Could not reject invite.");
        return;
      }

      await renderNotifications(user);
      await renderTeamInvites(user);
      alert("Team invite rejected.");
    });

    list.appendChild(card);
  });
}

/* -------------------------
   DASHBOARD
------------------------- */
function getPlayerStatsStorage(user) {
  try {
    const raw = localStorage.getItem(`scheduleit_player_stats_${user?.username || user?.name || "user"}`);
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function getMonthKeyFromDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${month}`;
}

function getAvailableMonthOptions() {
  const months = new Set();

  myTournaments.forEach((t) => {
    const start = parseTournamentStartDate(t.tournamentDates);
    if (start) months.add(getMonthKeyFromDate(start));
  });

  const playerStats = getPlayerStatsStorage(window.__me);
  const buckets = Array.isArray(playerStats.monthly) ? playerStats.monthly : [];
  buckets.forEach((item) => {
    if (item?.month) months.add(item.month);
  });

  return Array.from(months).filter(Boolean).sort().reverse();
}

function monthLabel(monthKey) {
  if (!monthKey || monthKey === "all") return "All time";
  const [year, month] = monthKey.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

function populateStatFilters() {
  const options = getAvailableMonthOptions();
  document.querySelectorAll(".stat-filter").forEach((select) => {
    const statName = select.dataset.statFilter;
    const currentValue = statFilterState[statName] || "all";

    select.innerHTML = `<option value="all">All time</option>`;
    options.forEach((month) => {
      const opt = document.createElement("option");
      opt.value = month;
      opt.textContent = monthLabel(month);
      select.appendChild(opt);
    });

    select.value = options.includes(currentValue) || currentValue === "all" ? currentValue : "all";
  });
}

function wireStatFilters() {
  document.querySelectorAll(".stat-filter").forEach((select) => {
    select.addEventListener("change", () => {
      statFilterState[select.dataset.statFilter] = select.value;
      renderDashboardStats();
    });
  });
}

function getTournamentCountForMonth(monthKey) {
  if (monthKey === "all") return myTournaments.length;

  return myTournaments.filter((t) => {
    const start = parseTournamentStartDate(t.tournamentDates);
    return start && getMonthKeyFromDate(start) === monthKey;
  }).length;
}

function getStatValueFromStorage(metric, monthKey) {
  const stats = getPlayerStatsStorage(window.__me);

  if (monthKey === "all") {
    if (metric === "titles") return Number(stats.totalTitlesWon || 0);
    if (metric === "matches") return Number(stats.totalMatchesPlayed || 0);
    if (metric === "wins") return Number(stats.totalWins || 0);
    return 0;
  }

  const monthly = Array.isArray(stats.monthly) ? stats.monthly : [];
  const bucket = monthly.find((item) => item?.month === monthKey) || {};

  if (metric === "titles") return Number(bucket.titlesWon || 0);
  if (metric === "matches") return Number(bucket.matchesPlayed || 0);
  if (metric === "wins") return Number(bucket.wins || 0);
  return 0;
}

function renderDashboardUpcoming() {
  const list = document.getElementById("dashboard-upcoming-list");
  if (!list) return;

  const upcoming = [...myTournaments]
    .filter((t) => getTournamentTimeStatus(t) === "upcoming")
    .sort((a, b) => {
      const aDate = parseTournamentStartDate(a.tournamentDates);
      const bDate = parseTournamentStartDate(b.tournamentDates);
      return (aDate?.getTime() || 0) - (bDate?.getTime() || 0);
    });

  list.innerHTML = "";

  if (!upcoming.length) {
    list.innerHTML = `<div class="dashboard-empty-card">No upcoming registered tournaments yet.</div>`;
    return;
  }

  upcoming.forEach((t) => {
    const item = document.createElement("div");
    item.className = "dashboard-upcoming-item";
    item.innerHTML = `
      <div class="dashboard-upcoming-title">${t.tournamentName || "Tournament"}</div>
      <div class="tournament-meta">
        <span>${t.sportName || ""}</span>
        <span>${formatTournamentDateForCard(t.tournamentDates)}</span>
      </div>
    `;
    item.addEventListener("click", () => {
      window.location.href = `schedule.html?tournamentId=${t.tournamentId ?? t.id}`;
    });
    list.appendChild(item);
  });
}

function renderDashboardStats() {
  const tournamentsMonth = statFilterState.tournaments || "all";
  const titlesMonth = statFilterState.titles || "all";
  const matchesMonth = statFilterState.matches || "all";
  const winPctMonth = statFilterState.winpct || "all";

  const totalTournamentsPlayed = getTournamentCountForMonth(tournamentsMonth);
  const totalTitlesWon = getStatValueFromStorage("titles", titlesMonth);
  const totalMatchesPlayed = getStatValueFromStorage("matches", matchesMonth);

  const wins = getStatValueFromStorage("wins", winPctMonth);
  const matchesForWinPct = getStatValueFromStorage("matches", winPctMonth);
  const winPct = matchesForWinPct > 0 ? Math.round((wins / matchesForWinPct) * 100) : 0;

  const totalTournamentsEl = document.getElementById("stat-total-tournaments-played");
  const totalTitlesEl = document.getElementById("stat-total-titles-won");
  const totalMatchesEl = document.getElementById("stat-total-matches-played");
  const winPctEl = document.getElementById("stat-win-percent");

  if (totalTournamentsEl) totalTournamentsEl.textContent = String(totalTournamentsPlayed);
  if (totalTitlesEl) totalTitlesEl.textContent = String(totalTitlesWon);
  if (totalMatchesEl) totalMatchesEl.textContent = String(totalMatchesPlayed);
  if (winPctEl) winPctEl.textContent = `${winPct}%`;
}

function renderDashboard() {
  populateStatFilters();
  renderDashboardUpcoming();
  renderDashboardStats();
}

/* -------------------------
   TOPBAR
------------------------- */
function wireTopbar(user) {
  const trigger = document.getElementById("user-menu-trigger");
  const dropdown = document.getElementById("user-menu-dropdown");

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

  const dropdownSignout = document.getElementById("dropdown-signout");
  dropdownSignout?.addEventListener("click", () => {
    dropdown?.classList.remove("is-open");
    logout();
  });

  const playerBtn = document.getElementById("mode-player-btn");
  const hostBtn = document.getElementById("mode-host-btn");

  playerBtn?.classList.add("is-active");

  playerBtn?.addEventListener("click", () => {
    playerBtn.classList.add("is-active");
    hostBtn?.classList.remove("is-active");
  });

  hostBtn?.addEventListener("click", async () => {
    playerBtn?.classList.remove("is-active");
    hostBtn.classList.add("is-active");
    await switchToHost();
  });
}

async function openTournamentFromQueryIfPresent() {
  const params = new URLSearchParams(window.location.search);
  const tournamentId = params.get("tournamentId");
  if (!tournamentId) return;

  try {
    const data = await apiGet(`/api/tournaments/${encodeURIComponent(tournamentId)}`);
    if (!data) return;

    selectedTournament = {
      ...(data.data || data),
      tournamentId,
    };

    if ((!selectedTournament.categories || selectedTournament.categories.length === 0) && tournamentId) {
      const fresh = await hydrateTournamentMeta(tournamentId);
      if (fresh?.categories) selectedTournament.categories = fresh.categories;
    }

    openCodeModal(selectedTournament);
  } catch (err) {
    console.warn("Could not open tournament from shared link", err);
  }
}

async function switchToHost() {
  await fetch("/api/user/mode", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + localStorage.getItem("token")
    },
    body: JSON.stringify({ mode: "host" })
  });

  window.location.href = "host.html";
}

/* -------------------------
   BOOT
------------------------- */
document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  window.__me = user;
  if (!user) return;

  document.querySelectorAll(".brand").forEach((el) => {
    el.addEventListener("click", () => {
      window.location.href = "index.html";
    });
  });

  wireTopbar(user);
  wireSidebarToggle();
  wireTabs();

  wireSportFilter();
  wireTournamentStatusFilter();
  wireTournamentSearch();

  wireMySportFilter();
  wireMyTournamentStatusFilter();
  wireMyTournamentSearch();

  wireModalCloseButtons();
  wireCodeForm();
  wirePlayerForm(user);
  wireStatFilters();

  await loadAllTournaments();
  await loadMyTournaments();
  await openTournamentFromQueryIfPresent();
  await renderTeamInvites(user);
  renderNotifications(user);
  renderDashboard();
  setActiveTab("dashboard");
});