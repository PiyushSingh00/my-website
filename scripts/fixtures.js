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

  // ---------- TOP BAR ----------
  const switchPlayerModeBtn = document.getElementById("switch-player-mode");
  const backBtn = document.getElementById("fixtures-back-btn");
  const generateBtn = document.getElementById("fixtures-generate-btn");
  const toastEl = document.getElementById("fixtures-toast");

  if (switchPlayerModeBtn) {
    switchPlayerModeBtn.addEventListener("click", () => {
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

  const all = loadAllTournaments();
  const tournament = all.find(t => String(t.id) === String(tournamentId));

  if (!tournament) {
    if (titleEl) titleEl.textContent = "No tournament selected";
    if (generateBtn) generateBtn.disabled = true;
    return;
  }

  if (titleEl) titleEl.textContent = tournament.tournamentName;
  if (sportEl) sportEl.textContent = tournament.sportName || "";
  if (datesEl) datesEl.textContent = tournament.tournamentDates || "";
  if (codeEl) codeEl.textContent = tournament.accessCode || "";

  const players = tournament.players || [];

  const maleNames = players
    .filter(p => (p.gender || "").toLowerCase() === "male")
    .map(p => p.name);

  const femaleNames = players
    .filter(p => (p.gender || "").toLowerCase() === "female")
    .map(p => p.name);

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

  let brackets = loadFixtures(tournament.id) || {
    male: createBracket(maleNames, "male"),
    female: createBracket(femaleNames, "female")
  };

  function render(groupKey) {
    const bracket = brackets[groupKey];
    const groupEl = groupKey === "male" ? maleGroupEl : femaleGroupEl;
    const emptyEl = groupKey === "male" ? maleEmptyEl : femaleEmptyEl;
    const bracketEl = groupKey === "male" ? maleBracketEl : femaleBracketEl;

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
    render(group);
  }

  if (toggleMaleBtn) toggleMaleBtn.onclick = () => show("male");
  if (toggleFemaleBtn) toggleFemaleBtn.onclick = () => show("female");

  if (generateBtn) {
    generateBtn.onclick = () => {
      brackets = {
        male: createBracket(maleNames, "male"),
        female: createBracket(femaleNames, "female")
      };
      saveFixtures(tournament.id, brackets);
      showToast("Fixtures generated");
    };
  }

  if (backBtn) {
    backBtn.onclick = () => {
      window.location.href = `players.html?tournamentId=${tournament.id}`;
    };
  }
});
