// scripts/join.js
import { requireAuth, logout } from "./auth.js";

let allTournaments = [];
let selectedTournament = null;

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
    const selected = e.target.value;
    const filtered = selected === "all"
      ? allTournaments
      : allTournaments.filter(t => t.sportName === selected);

    renderTournamentList(filtered);
  });
}

async function loadAllTournaments() {
  allTournaments = await apiGet("/api/tournaments");
  populateSportFilterFromAll(allTournaments);
  renderTournamentList(allTournaments);
}

/* -------------------------
   JOIN FLOW: Code Modal -> Player Modal -> Register
------------------------- */
function openCodeModal(t) {
  // Reset code UI
  const codeInput = document.getElementById("code-input");
  const codeError = document.getElementById("code-error");
  if (codeInput) codeInput.value = "";
  if (codeError) codeError.style.display = "none";

  // Update modal title if you want
  const title = document.getElementById("code-modal-title");
  if (title) title.textContent = `Enter code for ${t.tournamentName ?? "tournament"}`;

  openModal("code-modal");
}

function openPlayerModal(t, user) {
  const form = document.getElementById("player-form");
  form?.reset();

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


    // Optional: ensure returned tournament matches selectedTournament
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

  // helpful context if backend checks it
  username: user.username,
  accessCode: selectedTournament.accessCode
};


const tid = payload.tournamentId;

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

    const card = document.createElement("div");
    card.className = "tournament-card";

    card.innerHTML = `
      <div class="tournament-primary-line">
        <span class="tournament-name">${t.tournamentName ?? "Tournament"}</span>
        <span class="status-pill status-pill--open">Joined</span>
      </div>
      <div class="tournament-meta">
        <span>${t.sportName ?? ""}</span>
        <span>${t.tournamentDates ?? ""}</span>
        <span>${t.venue ?? ""}</span>
      </div>
    `;

    // ✅ Click = go to schedule page (or wherever you want)
    card.addEventListener("click", () => {
      window.location.href = `schedule.html?tournamentId=${tournamentId}`;
    });

    list.appendChild(card);
  });
}

async function loadMyTournaments() {
  const tournaments = await apiGet("/api/player/tournaments");
  renderMyTournaments(tournaments);
}

/* -------------------------
   TOPBAR actions
------------------------- */
function wireTopbar(user) {
  const usernameLabel = document.getElementById("username-label");
  if (usernameLabel) usernameLabel.textContent = user.username;

  const signoutBtn = document.getElementById("signout-btn");
  signoutBtn?.addEventListener("click", logout);

  // user dropdown toggle (optional)
  const trigger = document.getElementById("user-menu-trigger");
  const dropdown = document.getElementById("user-menu-dropdown");
  trigger?.addEventListener("click", () => dropdown?.classList.toggle("is-open"));

  // switch to host
  const switchHostModeBtn = document.getElementById("switch-host-mode");
  switchHostModeBtn?.addEventListener("click", () => {
    localStorage.removeItem("token");
    window.location.href = "host.html";
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

  wireTopbar(user);
  wireTabs();
  wireSportFilter();
  wireModalCloseButtons();
  wireCodeForm();
  wirePlayerForm(user);

  await loadAllTournaments(); // ✅ All tournaments tab
});
