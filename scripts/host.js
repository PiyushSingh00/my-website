// scripts/host.js
import { requireAuth, logout } from "./auth.js";

let allTournaments = [];

  function generateAccessCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";

    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }

    return code.slice(0, 4) + "-" + code.slice(4);
  }

document.addEventListener("DOMContentLoaded", async () => {
  const generateCodeBtn = document.getElementById("generate-code-btn");
  const accessCodeInput = document.getElementById("access-code");
  const viewPlayersBtn = document.getElementById("modalViewPlayers");
  let selectedTournamentId = null;
  const categoriesContainer = document.getElementById("categories-container");
  const addCategoryBtn = document.getElementById("add-category-btn");
  const hostForm = document.getElementById("host-form");
  let categories = [];
  function renderCategories() {
    categoriesContainer.innerHTML = "";

    categories.forEach((cat, index) => {
      const div = document.createElement("div");
      div.className = "category-card";

      div.innerHTML = `
        <input type="text" placeholder="Age group (e.g. U18 / Open)"
          value="${cat.ageGroup}" data-index="${index}" data-field="ageGroup" />

        <select data-index="${index}" data-field="gender">
          <option value="">Gender</option>
          <option value="Male" ${cat.gender === "Male" ? "selected" : ""}>Male</option>
          <option value="Female" ${cat.gender === "Female" ? "selected" : ""}>Female</option>
          <option value="Mixed" ${cat.gender === "Mixed" ? "selected" : ""}>Mixed</option>
        </select>

        <input type="number" min="1" placeholder="Team size"
          value="${cat.teamSize}" data-index="${index}" data-field="teamSize" />

        <button type="button" data-remove="${index}">✕</button>
      `;

      categoriesContainer.appendChild(div);
    });
  }

  const user = await requireAuth();
  if (!user) return;

  // Only hosts allowed
  if (user.role !== "host") {
    window.location.href = "join.html";
    return;
  }

  if (addCategoryBtn && categoriesContainer) {
    addCategoryBtn.addEventListener("click", () => {
      categories.push({
        ageGroup: "",
        gender: "",
        teamSize: 1
      });
      renderCategories();
    });
  }
  loadMyTournaments();

  if (categoriesContainer) {
    categoriesContainer.addEventListener("input", (e) => {
      const index = e.target.dataset.index;
      const field = e.target.dataset.field;
      if (index !== undefined && field) {
        categories[index][field] = e.target.value;
      }
    });
    categoriesContainer.addEventListener("click", (e) => {
      if (e.target.dataset.remove !== undefined) {
        categories.splice(e.target.dataset.remove, 1);
        renderCategories();
      }
    });
  }
  if (generateCodeBtn && accessCodeInput) {
      generateCodeBtn.addEventListener("click", () => {
      accessCodeInput.value = generateAccessCode();
    });
  }


  if (viewPlayersBtn) {
    viewPlayersBtn.addEventListener("click", () => {
      if (!selectedTournamentId) {
        alert("No tournament selected");
        return;
      }
      window.location.href = `players.html?tournamentId=${selectedTournamentId}`;
    });
  }




  




  // Show username
  const usernameLabel = document.getElementById("username-label");
  if (usernameLabel) {
    usernameLabel.textContent = user.username;
  }

  // Logout
  const signoutBtn = document.getElementById("signout-btn");
  if (signoutBtn) {
    signoutBtn.addEventListener("click", logout);
  }

  // For now: placeholder

  // 🔜 Next step: fetch host tournaments from backend
  // -------- LOAD SPORTS FROM BACKEND --------
  async function loadSports() {
    try {
      const res = await fetch("/api/sports");
      if (!res.ok) throw new Error("Failed to load sports");

      const sports = await res.json();

      const sportSelect = document.getElementById("sport-name");
      if (!sportSelect) return;

      // Clear existing options except "Select sport"
      sportSelect.innerHTML = `<option value="">Select sport</option>`;

      sports.forEach((sport) => {
        const option = document.createElement("option");
        option.value = sport.sport_name;
        option.textContent = sport.sport_name;
        sportSelect.appendChild(option);
      });
    } catch (err) {
      console.error("Error loading sports:", err);
    }
  }

// Call it
  loadSports();

// -------- HOST MODE TOGGLE (My vs New) --------
  const modeCards = document.querySelectorAll(".host-mode-card");
  const myView = document.getElementById("my-tournaments-view");
  const newView = document.getElementById("new-tournament-view");

async function loadMyTournaments() {
  const token = localStorage.getItem("token");

  const res = await fetch("http://51.20.51.85:8080/api/host/tournaments", {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    console.error("Failed to load tournaments");
    return;
  }

  allTournaments = await res.json();
  populateSportFilter(allTournaments);
  renderMyTournaments(allTournaments);

}

function populateSportFilter(tournaments) {
  const filter = document.getElementById("filter-sport");
  if (!filter) return;

  const sports = [...new Set(tournaments.map(t => t.sportName))];

  filter.innerHTML = `<option value="">All sports</option>`;
  sports.forEach(sport => {
    const opt = document.createElement("option");
    opt.value = sport;
    opt.textContent = sport;
    filter.appendChild(opt);
  });

  filter.addEventListener("change", () => {
    const selected = filter.value;
    const filtered = selected
      ? allTournaments.filter(t => t.sportName === selected)
      : allTournaments;

    renderMyTournaments(filtered);
  });
}


function renderMyTournaments(tournaments) {
  const container = document.getElementById("my-tournaments-list");
  container.innerHTML = "";

  if (!tournaments.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="feature-icon">📋</div>
        <h3>No tournaments found</h3>
      </div>`;
    return;
  }

  tournaments.forEach(t => {
    const categories = (t.categories || [])
    .map(c => {
      const size = Number(c.teamSize);

      let type = "";
      if (size === 1) type = "Singles";
      else if (size === 2) type = "Doubles";

      const genderLabel =
        c.gender === "Male" ? "Men's" :
        c.gender === "Female" ? "Women's" :
        c.gender;

      return `${c.ageGroup} ${genderLabel}${type ? " " + type : ""}`;
    })
    .join(", ");


    const card = document.createElement("div");
    card.className = "tournament-card";

    card.innerHTML = `
      <div class="tournament-head">
        <h3>${t.tournamentName}</h3>
        <span class="code-chip">${t.accessCode}</span>
      </div>

      <p class="muted sport-date">${t.sportName} • ${t.tournamentDates}</p>

      <p class="muted">📍 ${t.venue}</p>

      ${categories ? `<p class="muted"><strong>Categories:</strong> ${categories}</p>` : ""}

      ${t.playerDetails && t.playerDetails.trim() !== "" ? `
        <p class="muted details-label">Details:</p>
        <p class="muted details-text">${t.playerDetails}</p>
      ` : ""}


      <div class="tournament-meta">
        <span>Status: <strong>${t.registrationsOpen ? "Open" : "Closed"}</strong></span>
      </div>
    `;

    card.addEventListener("click", () => {
      window.location.href = `players.html?tournamentId=${t.tournamentId}`;
    });

    container.appendChild(card);
  });
}



  if (myView && newView) {
    modeCards.forEach((card) => {
      card.addEventListener("click", () => {
        // Remove active from all cards
        modeCards.forEach((c) => c.classList.remove("active"));

        // Hide all views
        myView.classList.remove("host-view--active");
        newView.classList.remove("host-view--active");

        // Activate clicked card
        card.classList.add("active");

        // Show correct view
        if (card.dataset.hostMode === "my") {
          myView.classList.add("host-view--active");
        } else {
          newView.classList.add("host-view--active");
        }
      });
    });
  }

  if (hostForm) {
    hostForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const payload = {
        tournamentName: document.getElementById("tournament-name").value,
        sportName: document.getElementById("sport-name").value,
        tournamentDates: document.getElementById("tournament-dates").value,
        accessCode: document.getElementById("access-code").value,
        playerDetails: document.getElementById("player-details").value,
        venue: document.getElementById("tournament-venue").value,
        categories: categories
      };

      const res = await fetch("/api/host/tournaments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("token")
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        alert("Failed to save tournament");
        return;
      }

      alert("Tournament created successfully");
      hostForm.reset();
      loadMyTournaments();
    });
  }
});
