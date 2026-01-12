// scripts/host.js
import { requireAuth, logout } from "./auth.js";

document.addEventListener("DOMContentLoaded", async () => {
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
// 🔹 Fetch tournaments created by this host
const res = await fetch("/api/host/tournaments", {
  headers: {
    Authorization: "Bearer " + localStorage.getItem("token")
  }
});

if (!res.ok) {
  alert("Failed to load tournaments");
  return;
}

const tournaments = await res.json();
console.log("Host tournaments:", tournaments);

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



});
