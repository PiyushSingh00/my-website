// scripts/auth.js

const API_BASE = window.location.origin;

// ✅ Check if user is logged in and get user info
export async function requireAuth() {
  const token = localStorage.getItem("token");

  if (!token) {
    redirectToLogin();
    return null;
  }

  try {
    const res = await fetch(`${API_BASE}/api/me`, {
      headers: {
        "Authorization": "Bearer " + token
      }
    });

    if (!res.ok) {
      throw new Error("Invalid token");
    }

    return await res.json(); // { username, role, name, ... }

  } catch (err) {
    console.error("Auth error:", err);
    localStorage.removeItem("token");
    redirectToLogin();
    return null;
  }
}

// 🚪 Logout everywhere
export function logout() {
  localStorage.removeItem("token");
  redirectToLogin();
}

function redirectToLogin() {
  window.location.href = "index.html";
}
