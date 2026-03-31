// scripts/join.js
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

  // Read body ONCE (prevents "body stream already read")
  const raw = await res.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }

  if (!res.ok) {
  console.error("❌ POST failed", path, res.status, data);

  const msg =
    (typeof data === "object" && data && (data.message || data.error)) ? (data.message || data.error) :
    (typeof data === "string" && data.trim()) ? data :
    `Request failed (${res.status})`;

  alert(`❌ ${path}\n${msg}`); // 👈 this will show the backend reason
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
  document.querySelectorAll("[data-close-modal]").forEach(btn => {
    btn.addEventListener("click", () => {
      closeModal("code-modal");
      closeModal("player-modal");
    });
  });

  // Close on overlay click
  ["code-modal", "player-modal"].forEach(id => {
    const overlay = document.getElementById(id);
    overlay?.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal(id);
    });
  });
}

/* -------------------------
   TABS (All / Mine)
------------------------- */
function wireTabs() {
  const tabBtns = document.querySelectorAll(".join-tab");
  const panels = document.querySelectorAll(".tab-panel");

  function setActive(tabName) {
    tabBtns.forEach(b => b.classList.toggle("is-active", b.dataset.tab === tabName));
    panels.forEach(p => p.classList.toggle("is-active", p.dataset.panel === tabName));

    if (tabName === "mine") {
      loadMyTournaments().catch(err => console.error(err));
    }
  }

  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => setActive(btn.dataset.tab));
  });
}

/* -------------------------
   RENDER: ALL TOURNAMENTS
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

  tournaments.forEach(t => {
    const tournamentId = t.tournamentId ?? t.id; // support either field
    const registrationsOpen = (t.registrationsOpen !== false); // default true

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
        <span>${t.tournamentDates ?? ""}</span>
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

function parseTournamentEndDate(tournamentDates) {
  if (!tournamentDates) return null;

  const raw = String(tournamentDates).trim();

  // handles "2026-04-10 to 2026-04-15"
  if (raw.includes("to")) {
    const parts = raw.split("to").map(p => p.trim());
    const end = new Date(parts[1]);
    return Number.isNaN(end.getTime()) ? null : end;
  }

  // handles single date
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

function renderFilteredTournaments() {
  const bySport = currentSportFilter === "all"
    ? allTournaments
    : allTournaments.filter(t => t.sportName === currentSportFilter);

  const byStatus = currentTournamentStatusFilter === "all"
    ? bySport
    : bySport.filter(t => getTournamentTimeStatus(t) === currentTournamentStatusFilter);

  const term = currentSearchTerm.trim().toLowerCase();
  const byName = term
    ? byStatus.filter(t => String(t.tournamentName || "").toLowerCase().includes(term))
    : byStatus;

  renderTournamentList(byName);
}

function populateSportFilterFromAll(all) {
  const select = document.getElementById("sport-filter");
  if (!select) return;

  const sports = [...new Set((all || []).map(t => t.sportName).filter(Boolean))];

  // Keep first option "All sports"
  select.innerHTML = `<option value="all">All sports</option>`;
  sports.forEach(s => {
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

function populateSportFilterFromMine(list) {
  const select = document.getElementById("my-sport-filter");
  if (!select) return;

  const sports = [...new Set((list || []).map(t => t.sportName).filter(Boolean))];

  select.innerHTML = `<option value="all">All sports</option>`;
  sports.forEach((sport) => {
    const opt = document.createElement("option");
    opt.value = sport;
    opt.textContent = sport;
    select.appendChild(opt);
  });
}


function renderFilteredMyTournaments() {
  const bySport = currentMySportFilter === "all"
    ? myTournaments
    : myTournaments.filter(t => t.sportName === currentMySportFilter);

  const byStatus = currentMyTournamentStatusFilter === "all"
    ? bySport
    : bySport.filter(t => getTournamentTimeStatus(t) === currentMyTournamentStatusFilter);

  const term = currentMySearchTerm.trim().toLowerCase();
  const byName = term
    ? byStatus.filter(t => String(t.tournamentName || "").toLowerCase().includes(term))
    : byStatus;

  renderMyTournaments(byName);
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
   JOIN FLOW: Code Modal -> Player Modal -> Register
------------------------- */
function openCodeModal(t) {
  // reset code UI
  const codeInput = document.getElementById("code-input");
  const codeError = document.getElementById("code-error");
  if (codeInput) codeInput.value = "";
  if (codeError) codeError.style.display = "none";

  // ✅ Populate categories in CODE modal (this dropdown is inside code-modal)
  fillCategoryDropdown(t);

  // update title
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

function openPlayerModal(t, user) {
  const form = document.getElementById("player-form");
  form?.reset();

    // --- Category dropdown ---
  const catSelect = document.getElementById("player-category");


  // ✅ Autofill from /api/me (if available)
  const nameEl = document.getElementById("player-name");
  const phoneEl = document.getElementById("player-phone");
  const ageEl = document.getElementById("player-age");
  const genderEl = document.getElementById("player-gender");

  if (ageEl && user?.age != null) ageEl.value = user.age;

  // gender could be "Male"/"Female"/"Mixed" depending on your dropdown options
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
  code: code,
  accessCode: code,
  tournamentId: selectedTournament.tournamentId
});

if (!result) {
  if (codeError) codeError.style.display = "block";
  return;
}

// If backend returns tournamentId, keep it synced (safe)
if (result.tournamentId && selectedTournament) {
  selectedTournament.tournamentId = result.tournamentId;
}

if (result.tournamentId && selectedTournament?.tournamentId && String(result.tournamentId) !== String(selectedTournament.tournamentId)) {
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
  // route already has tournamentId, but keep for backends that require it
  tournamentId: selectedTournament.tournamentId,

  // send both naming conventions
  playerName: document.getElementById("player-name")?.value?.trim(),
  name: document.getElementById("player-name")?.value?.trim(),

  age: Number(document.getElementById("player-age")?.value),
  gender: document.getElementById("player-gender")?.value,

  phone: document.getElementById("player-phone")?.value?.trim(),
  playerPhone: document.getElementById("player-phone")?.value?.trim(),
  categoryId: document.getElementById("player-category")?.value,
  category: document.getElementById("player-category")?.value,

  // helpful context if backend checks it
  username: user.username,
  accessCode: selectedTournament.accessCode
};


const tid = payload.tournamentId;

const chosenCategoryId = payload.categoryId;
if (!chosenCategoryId) {
  alert("Please select a category.");
  return;
}

// Prevent same user from joining same category more than once
try {
  const existing = await apiGet(`/api/tournaments/${encodeURIComponent(tid)}/players`);
  const players = Array.isArray(existing) ? existing : (existing?.players || existing?.items || []);

  const already = players.some(p => {
    const u = p.username ?? p.userName ?? p.user ?? "";
    const c = p.categoryId ?? p.category ?? p.categoryID ?? "";
    return String(u) === String(user.username) && String(c) === String(chosenCategoryId);
  });

  if (already) {
    alert("You have already joined this category. You can join other categories in the same tournament.");
    return;
  }
} catch (e) {
  console.warn("Could not validate duplicate category join. Backend should enforce this too.", e);
}


const result =
  // ✅ most likely: player-scoped join routes
  (await apiPost(`/api/player/tournaments/${tid}/register`, payload));


    if (!result) {
      alert("Registration failed. Please try again.");
      return;
    }

    alert("Registered successfully!");
    closeModal("player-modal");

    // Refresh "My tournaments"
    await loadMyTournaments();
  });
}

function getLocalCaptainState(tournamentId) {
  try {
    const raw = localStorage.getItem(`scheduleit_captains_${tournamentId}`);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return {
      selectedCaptainIds: Array.isArray(parsed?.selectedCaptainIds) ? parsed.selectedCaptainIds : [],
      confirmedCaptains: Array.isArray(parsed?.confirmedCaptains) ? parsed.confirmedCaptains : [],
      pools: parsed?.pools || null,
    };
  } catch {
    return null;
  }
}

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

function isUserCaptainForTournament(tournament, user) {
  const tournamentId = tournament?.tournamentId ?? tournament?.id;
  if (!tournamentId || !user) return false;

  const captainState = getLocalCaptainState(tournamentId);
  if (!captainState?.confirmedCaptains?.length) return false;

  const userName = normalizeName(user.name);
  const userUsername = normalizeName(user.username);

  return captainState.confirmedCaptains.some((captain) => {
    const captainName = normalizeName(captain.playerName);
    return (
      (userName && captainName === userName) ||
      (userUsername && captainName === userUsername)
    );
  });
}

/* -------------------------
   RENDER: MY TOURNAMENTS
------------------------- */
function renderMyTournaments(tournaments) {
  const list = document.getElementById("my-tournament-list");
  const empty = document.getElementById("my-empty-state");
  if (!list || !empty) return;

  list.innerHTML = "";

  if (!tournaments || tournaments.length === 0) {
    empty.style.display = "block";
    return;
  }

  empty.style.display = "none";

  tournaments.forEach(t => {
    const tournamentId = t.tournamentId ?? t.id;
    const status = normalizeStatus(t.myPlayer || t);
    const isCaptain = isUserCaptainForTournament(t, window.__me);

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
        <span>${t.tournamentDates ?? ""}</span>
        <span>${t.venue ?? ""}</span>
      </div>
      <div class="tournament-actions">
        ${isCaptain ? `<button type="button" class="captain-btn create-team-btn">Create team</button>` : ""}
        <button type="button" class="btn-link leave-btn">Opt out</button>
      </div>
    `;

    // ✅ Click = go to schedule page (or wherever you want)
    card.addEventListener("click", () => {
      if (status === "rejected") {
        alert("You were rejected for this tournament.");
        return;
      }
      window.location.href = `schedule.html?tournamentId=${tournamentId}`;
    });

    const leaveBtn = card.querySelector(".leave-btn");
    leaveBtn?.addEventListener("click", async (e) => {
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

    const createTeamBtn = card.querySelector(".create-team-btn");
      createTeamBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        window.location.href = `team.html?tournamentId=${tournamentId}`;
      });

    list.appendChild(card);
  });
}

async function loadMyTournaments() {
  try {
    const raw = await apiGet("/api/player/tournaments");
    myTournaments = normalizeTournamentList(raw);
    populateSportFilterFromMine(myTournaments);
    renderFilteredMyTournaments();
  } catch (err) {
    console.error("Failed to load player tournaments", err);
    myTournaments = [];
    populateSportFilterFromMine(myTournaments);
    renderFilteredMyTournaments();
  }
}

/* -------------------------
   TOPBAR actions
------------------------- */
function wireTopbar(user) {
  const trigger = document.getElementById("user-menu-trigger");
  const dropdown = document.getElementById("user-menu-dropdown");

  // Set initial inside the circle
  if (trigger) {
    const label = (user?.name || user?.username || user?.email || "U").trim();
    trigger.textContent = label.charAt(0).toUpperCase();
  }

  // Open/close dropdown
  trigger?.addEventListener("click", () => dropdown?.classList.toggle("is-open"));

  // Dropdown: Sign out
  const dropdownSignout = document.getElementById("dropdown-signout");
  dropdownSignout?.addEventListener("click", () => {
    dropdown?.classList.remove("is-open");
    logout();
  });

  // Topbar: mode toggle
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

async function switchToPlayer() {
  await fetch("/api/user/mode", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + localStorage.getItem("token")
    },
    body: JSON.stringify({ mode: "player" })
  });

  window.location.href = "join.html";
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

  await loadAllTournaments(); // ✅ All tournaments tab
});
