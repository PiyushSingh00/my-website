// scripts/join.js
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


  // 🔜 Next: list tournaments from backend
});
