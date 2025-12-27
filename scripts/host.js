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
  console.log("Host dashboard loaded for", user.username);

  // 🔜 Next step: fetch host tournaments from backend
});
