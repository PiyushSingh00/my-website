// scripts/fixtures.js
import { requireAuth, logout } from "./auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  // ---------- AUTH ----------
  const usernameLabel = document.getElementById("username-label");
  const signoutBtn = document.getElementById("signout-btn");

  const user = await requireAuth();
  if (!user) return;

  if (usernameLabel) {
    usernameLabel.textContent = user.username;
  }

  if (signoutBtn) {
    signoutBtn.addEventListener("click", logout);
  }

  document.querySelectorAll(".brand").forEach((el) => {
    el.addEventListener("click", () => {
      window.location.href = "index.html";
    });
  });

  // ---------- TOP BAR ----------
  const switchPlayerModeBtn = document.getElementById("switch-player-mode");
  const backBtn = document.getElementById("fixtures-back-btn");
  const generateBtn = document.getElementById("fixtures-generate-btn");
  const toastEl = document.getElementById("fixtures-toast");

  if (switchPlayerModeBtn) {
    switchPlayerModeBtn.addEventListener("click", async () => {
  await fetch("/api/user/mode", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + localStorage.getItem("token")
    },
    body: JSON.stringify({ mode: "player" })
  });
  window.location.href = "join.html";
});

  }

  // ---------- TOAST ----------
  let toastTimeoutId = null;
  function showToast(message) {
    if (!toastEl) return;
    toastEl.textContent = `✓ ${message}`;
    toastEl.style.display = "inline-flex";
    clearTimeout(toastTimeoutId);
    toastTimeoutId = setTimeout(() => {
      toastEl.style.display = "none";
    }, 2500);
  }

  // ---------- HEADER ELEMENTS ----------
  const titleEl = document.getElementById("fixtures-tournament-name");
  const sportEl = document.getElementById("fixtures-tournament-sport");
  const datesEl = document.getElementById("fixtures-tournament-dates");
  const codeEl = document.getElementById("fixtures-tournament-code");

  // ---------- GROUP ELEMENTS ----------
// ---------- GROUP ELEMENTS (dynamic categories) ----------
  const noneSelectedEl = document.getElementById("fixtures-none-selected");
  const toggleWrap = document.getElementById("fixtures-toggle"); // NEW in fixtures.html
  const groupsWrap = document.getElementById("fixtures-groups"); // NEW in fixtures.html


  if (toggleWrap) {
    toggleMixedBtn = document.createElement("button");
    toggleMixedBtn.className = "fixtures-toggle-btn";
    toggleMixedBtn.id = "fixtures-toggle-mixed";
    toggleMixedBtn.type = "button";
    toggleMixedBtn.textContent = "Mixed fixtures";
    toggleWrap.appendChild(toggleMixedBtn);
  }

  if (maleGroupEl?.parentElement) {
    mixedGroupEl = document.createElement("div");
    mixedGroupEl.className = "fixtures-group";
    mixedGroupEl.id = "fixtures-group-mixed";
    mixedGroupEl.style.display = "none";
    mixedGroupEl.innerHTML = `
      <h2 class="fixtures-group-title">Mixed fixtures</h2>
      <div id="fixtures-empty-state-mixed" class="empty-state">
        <div class="feature-icon">🏳️‍🌈</div>
        <h3>No mixed players available</h3>
        <p>Add at least two mixed players to generate a knockout bracket.</p>
      </div>
      <div id="fixtures-bracket-mixed" class="fixtures-bracket"></div>
    `;
    maleGroupEl.parentElement.appendChild(mixedGroupEl);
    mixedEmptyEl = mixedGroupEl.querySelector("#fixtures-empty-state-mixed");
    mixedBracketEl = mixedGroupEl.querySelector("#fixtures-bracket-mixed");
  }

  // ---------- STORAGE ----------
  const TOURNAMENT_KEY = "scheduleitTournaments";
  const FIXTURES_KEY_PREFIX = "scheduleitFixtures_";

  function loadAllTournaments() {
    try {
      return JSON.parse(localStorage.getItem(TOURNAMENT_KEY)) || [];
    } catch {
      return [];
    }
  }

  function getFixturesKey(tid) {
    return `${FIXTURES_KEY_PREFIX}${String(tid)}`;
  }

  function saveFixtures(tid, data) {
    localStorage.setItem(getFixturesKey(tid), JSON.stringify(data));
  }

  function loadFixtures(tid) {
    const raw = localStorage.getItem(getFixturesKey(tid));
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  // ---------- HELPERS ----------
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function getRoundLabel(r, total) {
    if (total === 1) return "Final";
    if (r === total - 1) return "Final";
    if (r === total - 2) return "Semi Final";
    return `Round ${r + 1}`;
  }

  // ---------- READ TOURNAMENT ----------

const params = new URLSearchParams(window.location.search);
const tournamentId = params.get("tournamentId");

if (!tournamentId) {
  if (titleEl) titleEl.textContent = "Missing tournamentId";
  if (generateBtn) generateBtn.disabled = true;
  return;
}

async function apiGet(url) {
  const res = await fetch(url, {
    headers: { Authorization: "Bearer " + localStorage.getItem("token") }
  });
  const raw = await res.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return data;
}

async function apiPost(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + localStorage.getItem("token")
    },
    body: JSON.stringify(body || {})
  });
  const raw = await res.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!res.ok) throw new Error(`POST ${url} failed: ${res.status}`);
  return data;
}
// 1) tournament meta (try host list first, fallback public)
let tournament = null;
try {
    const hostList = await apiGet("/api/host/tournaments");
  tournament = (hostList || []).find(t => String(t.tournamentId ?? t.id) === String(tournamentId)) || null;
} catch {}

if (!tournament) {
  try {
    const pubList = await apiGet("/api/tournaments");
    tournament = (pubList || []).find(t => String(t.tournamentId ?? t.id) === String(tournamentId)) || null;
  } catch {}
}

if (!tournament) {
  if (titleEl) titleEl.textContent = "Tournament not found";
  if (generateBtn) generateBtn.disabled = true;
  return;
}

if (titleEl) titleEl.textContent = tournament.tournamentName ?? "Tournament";
if (sportEl) sportEl.textContent = tournament.sportName ?? "";
if (datesEl) datesEl.textContent = tournament.tournamentDates ?? "";
if (codeEl) codeEl.textContent = tournament.accessCode ?? "";

// 2) players from API
const playersRaw = await apiGet(`/api/tournaments/${encodeURIComponent(tournamentId)}/players`);
const players = Array.isArray(playersRaw)
  ? playersRaw
  : (playersRaw?.players || playersRaw?.items || []);

// ✅ only accepted
function normalizeStatus(p) {
  const raw = p.status ?? p.registrationStatus ?? p.state ?? "accepted";
  const s = String(raw).toLowerCase();
  if (["rejected","reject","declined","denied"].includes(s)) return "rejected";
  return "accepted";
}
const acceptedPlayers = players.filter(p => normalizeStatus(p) === "accepted");


// ---------- CATEGORIES ----------
function normalizeCategories(cats) {
  if (!cats) return [];
  if (Array.isArray(cats)) return cats;
  if (typeof cats === "string") {
    try {
      const parsed = JSON.parse(cats);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function categoryLabel(c) {
  const age = c?.ageGroup ? String(c.ageGroup).trim() : "";
  const gender = c?.gender ? String(c.gender).trim() : "";
  const size = c?.teamSize ? Number(c.teamSize) : null;

  const type =
    size === 1 ? "Singles" :
    size === 2 ? "Doubles" :
    size ? `Team ${size}` : "";

  const parts = [age, gender, type].filter(Boolean);
  return parts.length ? parts.join(" • ") : (c?.categoryId || "Category");
}

function getPlayerCategoryId(p) {
  return p.categoryId ?? p.category ?? p.categoryID ?? p.category_id ?? null;
}

const categories = normalizeCategories(tournament.categories);

// group accepted players by categoryId
const acceptedByCategory = {};
acceptedPlayers.forEach((p) => {
  const cid = getPlayerCategoryId(p);
  if (!cid) return;
  const name = p.name ?? p.playerName ?? p.username ?? "Player";
  if (!acceptedByCategory[cid]) acceptedByCategory[cid] = [];
  acceptedByCategory[cid].push(name);
});



  // ---------- BRACKET LOGIC ----------

function createBracket(names) {
  if (!names || names.length < 2) return null;

  const shuffled = shuffle(names);
  let P = 1;
  while (P < shuffled.length) P *= 2;

  const totalRounds = Math.log2(P);
  const rounds = [];

  const slots = Array(P).fill("BYE");
  shuffled.forEach((n, i) => slots[i] = n);

  rounds.push(
    Array.from({ length: P / 2 }, (_, i) => ({
      round: 0,
      match: i,
      home: slots[i * 2],
      away: slots[i * 2 + 1],
    }))
  );

  for (let r = 1; r < totalRounds; r++) {
    rounds.push(Array.from({ length: rounds[r - 1].length / 2 }));
  }

  return { rounds, totalRounds };
}


let fixtures = null;
try {
  fixtures = await apiGet(`/api/host/tournaments/${encodeURIComponent(tournamentId)}/fixtures`);
} catch {}

if (!fixtures) {
  fixtures = loadFixtures(tournamentId) || null;
}

// build new fixtures if none saved
if (!fixtures) {
  fixtures = { categories: {} };

  categories.forEach((c) => {
    const cid = c.categoryId || c.id;
    if (!cid) return;

    const names = acceptedByCategory[cid] || [];
    const bracket = createBracket(names);
    if (!bracket) return;

    fixtures.categories[cid] = {
      categoryId: cid,
      label: categoryLabel(c),
      ...bracket
    };
  });
} else {
  fixtures.__locked = true;
  if (generateBtn) generateBtn.disabled = true;
}

function renderCategoryBracket(categoryId) {
  if (!groupsWrap) return;
  groupsWrap.innerHTML = "";

  const cat = fixtures?.categories?.[categoryId];
  if (!cat) return;

  const group = document.createElement("div");
  group.className = "fixtures-group";
  group.style.display = "block";

  // if bracket missing (less than 2 players)
  if (!cat.rounds || cat.rounds.length === 0) {
    group.innerHTML = `
      <h2 class="fixtures-group-title">${cat.label || categoryId}</h2>
      <div class="empty-state" style="display:flex;">
        <div class="feature-icon">🧩</div>
        <h3>Not enough players</h3>
        <p class="muted">Add at least two accepted players in this category.</p>
      </div>
    `;
    groupsWrap.appendChild(group);
    return;
  }

  group.innerHTML = `
    <h2 class="fixtures-group-title">${cat.label || categoryId}</h2>
    <div class="fixtures-bracket">
      ${cat.rounds.map((round, r) => `
        <div class="round">
          <h4>${getRoundLabel(r, cat.totalRounds)}</h4>
          ${round.map((m, i) => `
            <div class="match">
              <span>${m?.home || "-"}</span> vs <span>${m?.away || "-"}</span>
            </div>
          `).join("")}
        </div>
      `).join("")}
    </div>
  `;

  groupsWrap.appendChild(group);
}

function renderCategoryToggles() {
  if (!toggleWrap) return;
  toggleWrap.innerHTML = "";

  const ids = Object.keys(fixtures?.categories || {});
  if (!ids.length) return;

  ids.forEach((cid, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fixtures-toggle-btn";
    btn.textContent = fixtures.categories[cid].label || cid;

    btn.addEventListener("click", () => {
      if (noneSelectedEl) noneSelectedEl.style.display = "none";
      toggleWrap.querySelectorAll(".fixtures-toggle-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderCategoryBracket(cid);
    });

    toggleWrap.appendChild(btn);

    // auto-open first tab
    if (idx === 0) btn.click();
  });
}

renderCategoryToggles();


if (generateBtn) {
  generateBtn.onclick = async () => {
    if (fixtures && fixtures.__locked) return;

    fixtures = { categories: {} };

    categories.forEach((c) => {
      const cid = c.categoryId || c.id;
      if (!cid) return;

      const names = acceptedByCategory[cid] || [];
      const bracket = createBracket(names);
      if (!bracket) return;

      fixtures.categories[cid] = {
        categoryId: cid,
        label: categoryLabel(c),
        ...bracket
      };
    });

    try {
      const saved = await apiPost(
        `/api/host/tournaments/${encodeURIComponent(tournamentId)}/fixtures`,
        fixtures
      );
      fixtures = saved || fixtures;
      fixtures.__locked = true;
    } catch {
      saveFixtures(tournamentId, fixtures);
    }

    generateBtn.disabled = true;
    showToast("Fixtures generated");
    renderCategoryToggles();
  };
}


  if (backBtn) {
    backBtn.onclick = () => {
      window.location.href = `players.html?tournamentId=${tournament.tournamentId ?? tournament.id}`;
    };
  }
});
