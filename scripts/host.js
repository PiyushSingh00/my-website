// scripts/host.js
import { requireAuth, logout } from "./auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  const viewPlayersBtn = document.getElementById("modalViewPlayers");
  let selectedTournamentId = null;
  selectedTournamentId = tournament.tournamentId;
  const categoriesContainer = document.getElementById("categories-container");
  const addCategoryBtn = document.getElementById("add-category-btn");
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

  addCategoryBtn.addEventListener("click", () => {
  categories.push({
    ageGroup: "",
    gender: "",
    teamSize: 1
  });
  renderCategories();
  });
  categoriesContainer.addEventListener("input", (e) => {
    const index = e.target.dataset.index;
    const field = e.target.dataset.field;
    if (index !== undefined && field) {
      categories[index][field] = e.target.value;
    }
  });
  const locationBtn = document.getElementById("get-location-btn");
  const venueInput = document.getElementById("tournament-venue");

  let venueLocation = null;

  locationBtn.addEventListener("click", () => {
    if (!navigator.geolocation) {
      alert("Geolocation not supported");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        venueLocation = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        };

        venueInput.value = `Lat ${venueLocation.latitude.toFixed(4)}, Lng ${venueLocation.longitude.toFixed(4)}`;
      },
      () => alert("Location access denied")
    );
  });

categoriesContainer.addEventListener("click", (e) => {
  if (e.target.dataset.remove !== undefined) {
    categories.splice(e.target.dataset.remove, 1);
    renderCategories();
  }
});


  viewPlayersBtn.addEventListener("click", () => {
  if (!selectedTournamentId) {
    alert("No tournament selected");
    return;
  }

  window.location.href = `players.html?tournamentId=${selectedTournamentId}`;
  });


  const user = await requireAuth();
  if (!user) return;

  // Only hosts allowed
  if (user.role !== "host") {
    window.location.href = "join.html";
    return;
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

    // Clear existing options except "Select sport"
    sportSelect.innerHTML = `<option value="">Select sport</option>`;

    sports.forEach(sport => {
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

modeCards.forEach(card => {
  card.addEventListener("click", () => {
    // Remove active from all cards
    modeCards.forEach(c => c.classList.remove("active"));

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

const hostForm = document.getElementById("host-form");

hostForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    tournamentName: document.getElementById("tournament-name").value,
    sportName: document.getElementById("sport-name").value,
    tournamentDates: document.getElementById("tournament-dates").value,
    accessCode: document.getElementById("access-code").value,
    playerDetails: document.getElementById("player-details").value,
    categories: [], // add later if needed
    venue: venueLocation,     // from "Use my location"
    categories: categories    // from "Add category"
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
});



});
