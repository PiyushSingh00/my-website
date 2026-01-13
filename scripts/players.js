// scripts/players.js
import { requireAuth, logout } from "./auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;

  const usernameLabel = document.getElementById("username-label");
  if (usernameLabel) {
    usernameLabel.textContent = user.username;
  }

  const signoutBtn = document.getElementById("signout-btn");
  if (signoutBtn) {
    signoutBtn.addEventListener("click", logout);
  }

  console.log("Players page loaded");

  // ---------- READ TOURNAMENT ID ----------
const params = new URLSearchParams(window.location.search);
const tournamentId = params.get("tournamentId");

if (!tournamentId) {
  console.warn("No tournamentId in URL");
  return;
}

// ---------- ELEMENTS ----------
const tableWrapper = document.getElementById("players-table-wrapper");
const tableBody = document.getElementById("players-table-body");
const emptyState = document.getElementById("players-empty-state");

const allCount = document.getElementById("all-count");
const maleCount = document.getElementById("male-count");
const femaleCount = document.getElementById("female-count");

// ---------- FETCH PLAYERS ----------
async function loadPlayers() {
  try {
    const res = await fetch(`/api/tournaments/${tournamentId}/players`, {
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token")
      }
    });

    if (!res.ok) throw new Error("Failed to fetch players");

    const players = await res.json();

    if (players.length === 0) {
      emptyState.style.display = "block";
      tableWrapper.style.display = "none";
      return;
    }

    emptyState.style.display = "none";
    tableWrapper.style.display = "block";

    tableBody.innerHTML = "";

    let male = 0, female = 0;

    players.forEach(p => {
      if ((p.gender || "").toLowerCase() === "male") male++;
      if ((p.gender || "").toLowerCase() === "female") female++;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${p.playerName}</td>
        <td>${p.age}</td>
        <td>${p.gender}</td>
      `;
      tableBody.appendChild(tr);
    });

    allCount.textContent = players.length;
    maleCount.textContent = male;
    femaleCount.textContent = female;

  } catch (err) {
    console.error(err);
    alert("Could not load players");
  }
}

loadPlayers();


});
