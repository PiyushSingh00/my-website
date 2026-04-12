// scripts/auth.js

const API_BASE = window.location.origin;
const AUTH_CACHE_KEY = "scheduleit_user";
const AUTH_CACHE_TS_KEY = "scheduleit_user_cached_at";

function readCachedUser() {
  try {
    const raw = localStorage.getItem(AUTH_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function readTokenPayload(token) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length < 2) return null;
    return JSON.parse(atob(parts[1]));
  } catch {
    return null;
  }
}

function cacheUser(user) {
  if (!user || typeof user !== "object") return;
  try {
    localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(user));
    localStorage.setItem(AUTH_CACHE_TS_KEY, String(Date.now()));
  } catch {}
}

async function fetchCurrentUser(token) {
  const res = await fetch(`${API_BASE}/api/me`, {
    headers: {
      Authorization: "Bearer " + token,
    },
  });

  if (!res.ok) {
    throw new Error("Invalid token");
  }

  const user = await res.json();
  cacheUser(user);
  return user;
}

// ✅ Check if user is logged in and get user info
export async function requireAuth() {
  const token = localStorage.getItem("token");

  if (!token) {
    redirectToLogin();
    return null;
  }

  const payload = readTokenPayload(token);
  const expMs = Number(payload?.exp || 0) * 1000;
  if (expMs && Date.now() >= expMs) {
    logout();
    return null;
  }

  try {
    const cachedUser = readCachedUser();
    if (cachedUser) {
      const cachedAt = Number(localStorage.getItem(AUTH_CACHE_TS_KEY) || 0);
      const isFresh = Number.isFinite(cachedAt) && (Date.now() - cachedAt) < 60_000;
      if (!isFresh) {
        fetchCurrentUser(token).catch((err) => {
          console.warn("Background auth refresh failed:", err);
        });
      }
      return cachedUser;
    }

    return await fetchCurrentUser(token);

  } catch (err) {
    console.error("Auth error:", err);
    redirectToLogin();
    return null;
  }
}

// 🚪 Logout everywhere
export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem(AUTH_CACHE_KEY);
  localStorage.removeItem(AUTH_CACHE_TS_KEY);
  redirectToLogin();
}

function redirectToLogin() {
  window.location.href = "index.html";
}
