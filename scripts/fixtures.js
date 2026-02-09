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
  const maleGroupEl = document.getElementById("fixtures-group-male");
  const femaleGroupEl = document.getElementById("fixtures-group-female");
  const maleEmptyEl = document.getElementById("fixtures-empty-state-male");
  const femaleEmptyEl = document.getElementById("fixtures-empty-state-female");
  const maleBracketEl = document.getElementById("fixtures-bracket-male");
  const femaleBracketEl = document.getElementById("fixtures-bracket-female");
  const noneSelectedEl = document.getElementById("fixtures-none-selected");

  const toggleMaleBtn = document.getElementById("fixtures-toggle-male");
  const toggleFemaleBtn = document.getElementById("fixtures-toggle-female");
  const toggleWrap = document.querySelector(".fixtures-toggle");

  let mixedGroupEl = null;
  let mixedEmptyEl = null;
  let mixedBracketEl = null;
  let toggleMixedBtn = null;

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


function getGroupKey(p) {
  const categoryGender = p.categoryGender ?? p.category?.gender ?? p.categoryType;
  const raw = categoryGender || p.gender || p.playerGender || "";
  const s = String(raw).toLowerCase();
  if (s === "mixed") return "mixed";
  if (s === "female") return "female";
  return "male";
}

const maleNames = acceptedPlayers
  .filter(p => getGroupKey(p) === "male")
  .map(p => p.name ?? p.playerName);

const femaleNames = acceptedPlayers
  .filter(p => getGroupKey(p) === "female")
  .map(p => p.name ?? p.playerName);

const mixedNames = acceptedPlayers
  .filter(p => getGroupKey(p) === "mixed")
  .map(p => p.name ?? p.playerName);


  // ---------- BRACKET LOGIC ----------
  function createBracket(names, groupKey) {
    if (names.length < 2) return null;

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

    return { groupKey, rounds, totalRounds };
  }

  let brackets = null;
  try {
    brackets = await apiGet(`/api/host/tournaments/${encodeURIComponent(tournamentId)}/fixtures`);
  } catch {}

  if (!brackets) {
    brackets = loadFixtures(tournamentId) || null;
  }

  if (!brackets) {
    brackets = {
      male: createBracket(maleNames, "male"),
      female: createBracket(femaleNames, "female"),
      mixed: createBracket(mixedNames, "mixed")
    };
  } else {
    brackets.__locked = true;
    if (generateBtn) generateBtn.disabled = true;
  }

  function render(groupKey) {
    const bracket = brackets[groupKey];
    const groupEl =
      groupKey === "male" ? maleGroupEl :
      groupKey === "female" ? femaleGroupEl :
      mixedGroupEl;
    const emptyEl =
      groupKey === "male" ? maleEmptyEl :
      groupKey === "female" ? femaleEmptyEl :
      mixedEmptyEl;
    const bracketEl =
      groupKey === "male" ? maleBracketEl :
      groupKey === "female" ? femaleBracketEl :
      mixedBracketEl;

    if (!bracket) {
      groupEl.style.display = "block";
      emptyEl.style.display = "flex";
      bracketEl.style.display = "none";
      return;
    }

    emptyEl.style.display = "none";
    bracketEl.style.display = "block";

    bracketEl.innerHTML = bracket.rounds.map((round, r) => `
      <div class="round">
        <h4>${getRoundLabel(r, bracket.totalRounds)}</h4>
        ${round.map(m => `
          <div class="match">
            <span>${m?.home || "-"}</span> vs <span>${m?.away || "-"}</span>
          </div>
        `).join("")}
      </div>
    `).join("");
  }

  function show(group) {
    noneSelectedEl.style.display = "none";
    maleGroupEl.style.display = group === "male" ? "block" : "none";
    femaleGroupEl.style.display = group === "female" ? "block" : "none";
    if (mixedGroupEl) mixedGroupEl.style.display = group === "mixed" ? "block" : "none";
    render(group);
  }

  if (toggleMaleBtn) toggleMaleBtn.onclick = () => show("male");
  if (toggleFemaleBtn) toggleFemaleBtn.onclick = () => show("female");
  if (toggleMixedBtn) toggleMixedBtn.onclick = () => show("mixed");

  if (generateBtn) {
    generateBtn.onclick = async () => {
      if (brackets && brackets.__locked) return;

      brackets = {
        male: createBracket(maleNames, "male"),
        female: createBracket(femaleNames, "female"),
        mixed: createBracket(mixedNames, "mixed")
      };

      try {
        const saved = await apiPost(`/api/host/tournaments/${encodeURIComponent(tournamentId)}/fixtures`, brackets);
        brackets = saved || brackets;
        brackets.__locked = true;
      } catch {
        saveFixtures(tournamentId, brackets);
      }

      generateBtn.disabled = true;
      showToast("Fixtures generated");
    };
  }

  if (backBtn) {
    backBtn.onclick = () => {
      window.location.href = `players.html?tournamentId=${tournament.tournamentId ?? tournament.id}`;
    };
  }
});
