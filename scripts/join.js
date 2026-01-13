// scripts/join.js
import { requireAuth, logout } from "./auth.js";

async function validateAccessCode(code) {
  const res = await fetch("/api/tournaments/validate-code", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + localStorage.getItem("token")
    },
    body: JSON.stringify({ code })
  });

  return res.ok ? await res.json() : null;
}

async function loadMyTournaments() {
  const res = await fetch("/api/player/tournaments", {
    headers: {
      Authorization: "Bearer " + localStorage.getItem("token")
    }
  });

  const tournaments = await res.json();
  renderMyTournaments(tournaments);
}


async function submitPlayerRegistration(payload) {
  const res = await fetch(`/api/tournaments/${payload.tournamentId}/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + localStorage.getItem("token")
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    alert("Registration failed");
    return false;
  }

  return true;
}

  async function loadAllTournaments() {
    const res = await fetch("/api/tournaments", {
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token")
      }
    });

    if (!res.ok) {
      console.error("Failed to load tournaments");
      return;
    }

    const tournaments = await res.json();
    renderTournamentList(tournaments);
  }

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;
  loadAllTournaments();
  document.getElementById("sport-filter").addEventListener("change", e => {
  const selected = e.target.value;
  const filtered = selected === "all"
    ? allTournaments
    : allTournaments.filter(t => t.sportName === selected);

  renderTournamentList(filtered);
});

  const usernameLabel = document.getElementById("username-label");
  if (usernameLabel) {
    usernameLabel.textContent = user.username;
  }

  const signoutBtn = document.getElementById("signout-btn");
  if (signoutBtn) {
    signoutBtn.addEventListener("click", logout);
  }

  console.log("Join page loaded for", user.username);
  const addCategoryBtn = document.getElementById("add-category-btn");
  const categoriesContainer = document.getElementById("categories-container");

  addCategoryBtn.addEventListener("click", () => {
    const div = document.createElement("div");
    div.className = "category-card";

    div.innerHTML = `
      <input type="text" placeholder="Category name (e.g. U18 Boys)" />
      <input type="number" placeholder="Max players" />
    `;

    categoriesContainer.appendChild(div);
  });
  function readCategories() {
  const cards = document.querySelectorAll(".category-card");
  return Array.from(cards).map(card => {
    const inputs = card.querySelectorAll("input");
    return {
      name: inputs[0].value,
      maxPlayers: Number(inputs[1].value)
    };
  }).filter(c => c.name);
}



  function renderTournamentList(tournaments) {
  const list = document.getElementById("tournament-list");
  const empty = document.getElementById("empty-state");

  list.innerHTML = "";

  if (tournaments.length === 0) {
    empty.style.display = "block";
    return;
  }

  empty.style.display = "none";

  tournaments.forEach(t => {
    const card = document.createElement("div");
    card.className = "tournament-card";

    card.innerHTML = `
      <div class="tournament-primary-line">
        <span class="tournament-name">${t.tournamentName}</span>
        <span class="status-pill ${t.registrationsOpen ? "status-pill--open" : "status-pill--closed"}">
          ${t.registrationsOpen ? "Open" : "Closed"}
        </span>
      </div>

      <div class="tournament-meta">
        <span>${t.sportName}</span>
        <span>${t.tournamentDates}</span>
        <span>${t.venue}</span>
      </div>
    `;

    card.onclick = () => openCodeModal(t);
    list.appendChild(card);
  });
}


  const generateCodeBtn = document.getElementById("generate-code-btn");
  const accessCodeInput = document.getElementById("access-code");

  function generateAccessCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code.slice(0,4) + "-" + code.slice(4);
  }

  generateCodeBtn.addEventListener("click", () => {
    accessCodeInput.value = generateAccessCode();
  });

const hostForm = document.getElementById("host-form");

hostForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const data = {
    tournamentName: document.getElementById("tournament-name").value,
    sportName: document.getElementById("sport-name").value,
    tournamentDates: document.getElementById("tournament-dates").value,
    venue: document.getElementById("tournament-venue").value,
    accessCode: document.getElementById("access-code").value,
    playerDetails: document.getElementById("player-details").value,
    categories: readCategories()
  };

  console.log("📦 Tournament payload:", data);
});

const res = await fetch("/api/tournaments");
const tournaments = await res.json();

  // 🔜 Next: list tournaments from backend
});
