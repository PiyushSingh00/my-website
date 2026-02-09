// scripts/fixtures.js
import { requireAuth, logout } from "./auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  // ---------- AUTH ----------
  const usernameLabel = document.getElementById("username-label");
  const signoutBtn = document.getElementById("signout-btn");

  const user = await requireAuth();
  if (!user) return;

  if (usernameLabel) usernameLabel.textContent = user.username;
  if (signoutBtn) signoutBtn.addEventListener("click", logout);

  // Brand click -> index
  document.querySelectorAll(".brand").forEach((el) => {
    el.style.cursor = "pointer";
    el.addEventListener("click", () => (window.location.href = "index.html"));
  });

  // Switch to player mode
  const switchPlayerModeBtn = document.getElementById("switch-player-mode");
  if (switchPlayerModeBtn) {
    switchPlayerModeBtn.addEventListener("click", async () => {
      try {
        await fetch("/api/user/mode", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + localStorage.getItem("token"),
          },
          body: JSON.stringify({ mode: "player" }),
        });
      } catch {}
      window.location.href = "join.html";
    });
  }

  // ---------- ELEMENTS ----------
  const backBtn = document.getElementById("fixtures-back-btn");
  const generateBtn = document.getElementById("fixtures-generate-btn");
  const toastEl = document.getElementById("fixtures-toast");

  const titleEl = document.getElementById("fixtures-tournament-name");
  const sportEl = document.getElementById("fixtures-tournament-sport");
  const datesEl = document.getElementById("fixtures-tournament-dates");
  const codeEl = document.getElementById("fixtures-tournament-code");

  const noneSelectedEl = document.getElementById("fixtures-none-selected");
  const toggleWrap = document.getElementById("fixtures-toggle");
  const groupsWrap = document.getElementById("fixtures-groups");

  // ---------- TOURNAMENT ID ----------
  const params = new URLSearchParams(window.location.search);
  const tournamentId = params.get("tournamentId");

  if (!tournamentId) {
    if (titleEl) titleEl.textContent = "Missing tournamentId";
    if (generateBtn) generateBtn.disabled = true;
    return;
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

  // ---------- API HELPERS ----------
  async function apiGet(url) {
    const res = await fetch(url, {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") },
    });
    const raw = await res.text();
    let data = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = raw;
    }
    if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
    return data;
  }

  async function apiPost(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
      body: JSON.stringify(body || {}),
    });
    const raw = await res.text();
    let data = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = raw;
    }
    if (!res.ok) throw new Error(`POST ${url} failed: ${res.status}`);
    return data;
  }

  // ---------- LOCAL STORAGE ----------
  const FIXTURES_KEY_PREFIX = "scheduleitFixtures_";
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
      size === 1 ? "Singles" : size === 2 ? "Doubles" : size ? `Team ${size}` : "";

    const parts = [age, gender, type].filter(Boolean);
    return parts.length ? parts.join(" • ") : c?.categoryId || c?.id || "Category";
  }

  function getPlayerCategoryId(p) {
    return p.categoryId ?? p.category ?? p.categoryID ?? p.category_id ?? null;
  }

  function normalizeStatus(p) {
    const raw = p.status ?? p.registrationStatus ?? p.state ?? "accepted";
    const s = String(raw).toLowerCase();
    if (["rejected", "reject", "declined", "denied"].includes(s)) return "rejected";
    return "accepted"; // default accepted
  }

  function getRoundLabel(r, total) {
    if (total === 1) return "Final";
    if (r === total - 1) return "Final";
    if (r === total - 2) return "Semi Final";
    return `Round ${r + 1}`;
  }

  // Creates a knockout bracket structure (with BYEs) from a list of names
  function createBracket(names) {
    if (!names || names.length < 2) return null;

    const shuffled = shuffle(names);
    let P = 1;
    while (P < shuffled.length) P *= 2;

    const totalRounds = Math.log2(P);
    const rounds = [];

    // Fill first round slots with players + BYE
    const slots = Array(P).fill("BYE");
    shuffled.forEach((n, i) => (slots[i] = n));

    // Round 1 matches
    rounds.push(
      Array.from({ length: P / 2 }, (_, i) => ({
        round: 0,
        match: i,
        home: slots[i * 2],
        away: slots[i * 2 + 1],
      }))
    );

    // Next rounds placeholders
    for (let r = 1; r < totalRounds; r++) {
      rounds.push(
        Array.from({ length: rounds[r - 1].length / 2 }, (_, i) => ({
          round: r,
          match: i,
          home: null,
          away: null,
        }))
      );
    }

    return { rounds, totalRounds };
  }

  // ---------- LOAD TOURNAMENT META ----------
  let tournament = null;
  try {
    const hostList = await apiGet("/api/host/tournaments");
    tournament =
      (hostList || []).find(
        (t) => String(t.tournamentId ?? t.id) === String(tournamentId)
      ) || null;
  } catch {}

  if (!tournament) {
    try {
      const pubList = await apiGet("/api/tournaments");
      tournament =
        (pubList || []).find(
          (t) => String(t.tournamentId ?? t.id) === String(tournamentId)
        ) || null;
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

  // ---------- LOAD PLAYERS ----------
  const playersRaw = await apiGet(
    `/api/tournaments/${encodeURIComponent(tournamentId)}/players`
  );
  const players = Array.isArray(playersRaw)
    ? playersRaw
    : playersRaw?.players || playersRaw?.items || [];

  const acceptedPlayers = players.filter((p) => normalizeStatus(p) === "accepted");

  // ---------- GROUP PLAYERS BY CATEGORY ----------
  const categories = normalizeCategories(tournament.categories);
  const acceptedByCategory = {};
  acceptedPlayers.forEach((p) => {
    const cid = getPlayerCategoryId(p);
    if (!cid) return;
    const name = p.playerName ?? p.name ?? p.username ?? "Player";
    if (!acceptedByCategory[cid]) acceptedByCategory[cid] = [];
    acceptedByCategory[cid].push(name);
  });

  // ---------- LOAD EXISTING FIXTURES ----------
  let fixtures = null;
  try {
    fixtures = await apiGet(
      `/api/host/tournaments/${encodeURIComponent(tournamentId)}/fixtures`
    );
  } catch {}

  if (!fixtures) fixtures = loadFixtures(tournamentId);

  // If fixtures exist, lock generation
  if (fixtures) {
    fixtures.__locked = true;
    if (generateBtn) generateBtn.disabled = true;
  } else {
    fixtures = { categories: {} };
    // Create initial fixtures in-memory (not locked until user clicks Generate)
    categories.forEach((c) => {
      const cid = c.categoryId || c.id;
      if (!cid) return;
      const names = acceptedByCategory[cid] || [];
      const bracket = createBracket(names);
      fixtures.categories[cid] = {
        categoryId: cid,
        label: categoryLabel(c),
        ...(bracket ? bracket : { rounds: [], totalRounds: 0 }),
      };
    });
  }

  // ---------- RENDER ----------
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
        toggleWrap
          .querySelectorAll(".fixtures-toggle-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        renderCategoryBracket(cid);
      });

      toggleWrap.appendChild(btn);

      // Auto-open first
      if (idx === 0) btn.click();
    });
  }

  function renderCategoryBracket(categoryId) {
    if (!groupsWrap) return;
    groupsWrap.innerHTML = "";

    const cat = fixtures?.categories?.[categoryId];
    if (!cat) return;

    const group = document.createElement("div");
    group.className = "fixtures-group";

    // Not enough players / no bracket
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

    const roundsHtml = cat.rounds
      .map((round, r) => {
        const matchesHtml = round
          .map((m, i) => {
            const home = m?.home ?? "-";
            const away = m?.away ?? "-";

            const homeBye = String(home).toUpperCase() === "BYE";
            const awayBye = String(away).toUpperCase() === "BYE";

            return `
              <div class="bracket-match">
                <div class="match-label">Match ${i + 1}</div>

                <div class="player-slot ${homeBye ? "bye" : ""}">
                  <span class="player-name">${home}</span>
                </div>

                <div class="player-slot ${awayBye ? "bye" : ""}">
                  <span class="player-name">${away}</span>
                </div>
              </div>
            `;
          })
          .join("");

        return `
          <div class="bracket-round">
            <div class="round-title">${getRoundLabel(r, cat.totalRounds)}</div>
            ${matchesHtml}
          </div>
        `;
      })
      .join("");

    group.innerHTML = `
      <h2 class="fixtures-group-title">${cat.label || categoryId}</h2>
      <div class="fixtures-bracket">
        <div class="bracket-rounds">
          ${roundsHtml}
        </div>
      </div>
    `;

    groupsWrap.appendChild(group);
  }

  renderCategoryToggles();

  // ---------- GENERATE FIXTURES (LOCK + SAVE) ----------
  if (generateBtn) {
    generateBtn.onclick = async () => {
      if (fixtures && fixtures.__locked) return;

      const newFixtures = { categories: {} };

      categories.forEach((c) => {
        const cid = c.categoryId || c.id;
        if (!cid) return;

        const names = acceptedByCategory[cid] || [];
        const bracket = createBracket(names);

        newFixtures.categories[cid] = {
          categoryId: cid,
          label: categoryLabel(c),
          ...(bracket ? bracket : { rounds: [], totalRounds: 0 }),
        };
      });

      // Try saving to backend; fallback to localStorage
      try {
        const saved = await apiPost(
          `/api/host/tournaments/${encodeURIComponent(tournamentId)}/fixtures`,
          newFixtures
        );
        fixtures = saved || newFixtures;
      } catch {
        fixtures = newFixtures;
        saveFixtures(tournamentId, fixtures);
      }

      fixtures.__locked = true;
      generateBtn.disabled = true;
      showToast("Fixtures generated");
      renderCategoryToggles();
    };
  }

  // ---------- BACK BUTTON ----------
  if (backBtn) {
    backBtn.onclick = () => {
      window.location.href = `players.html?tournamentId=${encodeURIComponent(
        tournament.tournamentId ?? tournament.id ?? tournamentId
      )}`;
    };
  }
});