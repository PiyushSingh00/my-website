// scripts/fixtures.js
import { requireAuth, logout } from "./auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;

// ---------- TOPBAR (aligned with host.html) ----------
const brandLink = document.querySelector(".brand-link");
brandLink?.addEventListener("click", (e) => {
  // keep anchor behavior, but ensure consistent navigation
  e.preventDefault();
  window.location.href = "index.html";
});

// Avatar initial + dropdown
const trigger = document.getElementById("host-user-menu-trigger");
const dropdown = document.getElementById("host-user-menu-dropdown");

if (trigger) {
  const label = String(user?.username || user?.name || user?.email || "U").trim();
  trigger.textContent = (label[0] || "U").toUpperCase();
}

trigger?.addEventListener("click", (e) => {
  e.stopPropagation();
  dropdown?.classList.toggle("is-open");
});

document.addEventListener("click", () => dropdown?.classList.remove("is-open"));

// Sign out
document.getElementById("dropdown-signout")?.addEventListener("click", () => {
  dropdown?.classList.remove("is-open");
  logout();
});

// Mode toggle
const playerBtn = document.getElementById("mode-player-btn");
const hostBtn = document.getElementById("mode-host-btn");

// This page is Host side (fixtures are host-only)
hostBtn?.classList.add("is-active");
playerBtn?.classList.remove("is-active");

playerBtn?.addEventListener("click", async () => {
  playerBtn.classList.add("is-active");
  hostBtn?.classList.remove("is-active");

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

hostBtn?.addEventListener("click", async () => {
  hostBtn.classList.add("is-active");
  playerBtn?.classList.remove("is-active");

  // optional: persist host mode like other pages
  try {
    await fetch("/api/user/mode", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
      body: JSON.stringify({ mode: "host" }),
    });
  } catch {}
});

  // ---------- READ TOURNAMENT ID ----------
  const params = new URLSearchParams(window.location.search);
  const tournamentId = params.get("tournamentId");
  if (!tournamentId) {
    alert("Missing tournamentId in URL");
    return;
  }

  // ---------- ELEMENTS ----------
  const titleEl = document.getElementById("fixtures-tournament-name");
  const sportEl = document.getElementById("fixtures-tournament-sport");
  const datesEl = document.getElementById("fixtures-tournament-dates");
  const codeEl = document.getElementById("fixtures-tournament-code");
const genSchemaBtn = document.getElementById("fixtures-generate-schema-btn");

  const backBtn = document.getElementById("fixtures-back-btn");
  const generateBtn = document.getElementById("fixtures-generate-btn");
  const toastEl = document.getElementById("fixtures-toast");

  const noneSelectedEl = document.getElementById("fixtures-none-selected");
  const toggleWrap = document.getElementById("fixtures-toggle");
  const groupsEl = document.getElementById("fixtures-groups");

  // Start scoring -> scoring.html (placeholder)
  groupsEl?.addEventListener("click", (e) => {
    const btn = e.target.closest(".start-scoring-btn");
    if (!btn) return;

    const tId = btn.dataset.tournamentId || "";
    const cId = btn.dataset.categoryId || "";
    const round = btn.dataset.round || "0";
    const match = btn.dataset.match || "0";

    window.location.href =
      `score.html?tournamentId=${tId}&categoryId=${cId}&round=${round}&match=${match}`;
  });

  backBtn?.addEventListener("click", () => {
    window.location.href = `players.html?tournamentId=${encodeURIComponent(tournamentId)}`;
  });

  // Inject Edit/Save buttons into toolbar (so you don’t have to edit fixtures.html)
  const toolbar = document.querySelector(".fixtures-toolbar");
  let editBtn = document.getElementById("fixtures-edit-btn");

  if (toolbar && !editBtn) {
    editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn-dark";
    editBtn.id = "fixtures-edit-btn";
    editBtn.style.display = "none";
    editBtn.textContent = "Edit fixtures";
    toolbar.appendChild(editBtn);
  }

  // ---------- STATE ----------
  let tournamentMeta = null;
  let categories = []; // [{categoryId, ...}]
  let players = []; // all registrations
  let acceptedByCategory = {}; // { categoryId: [names...] }

  let fixtures = null; // { categories: { [cid]: {rounds,totalRounds,label,...}} }
  let activeCategoryId = null;
  let editMode = false;
  let scoringSchema = null; // ✅ NEW: will store schema fetched from backend

  // ---------- HELPERS ----------
  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg || "✓ Done";
    toastEl.style.display = "block";
    setTimeout(() => (toastEl.style.display = "none"), 1800);
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
    return p.categoryId ?? p.categoryID ?? p.category ?? p.category_id ?? null;
  }

  function normalizeStatus(p) {
    const raw =
      p?.status ??
      p?.registrationStatus ??
      p?.inviteStatus ??
      p?.registration_status ??
      p?.playerStatus ??
      p?.state ??
      "accepted";

    const s = String(raw).trim().toLowerCase();

    if (["rejected", "reject", "declined", "denied"].includes(s)) return "rejected";
    if (["pending", "awaiting"].includes(s)) return "pending";
    return "accepted";
  }

  function getPlayerName(p) {
    return p.playerName ?? p.name ?? p.fullName ?? p.username ?? "-";
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

function buildEntrants(names, teamSize) {
  const size = Math.max(1, Number(teamSize || 1));
  const shuffled = shuffle(names);

  const entrants = [];
  const dropped = [];
  const teamMap = {}; // teamName -> [players...]

  if (size === 1) {
    shuffled.forEach((n) => (teamMap[n] = [n]));
    return { entrants: shuffled, dropped: [], teamMap };
  }

  for (let i = 0; i < shuffled.length; i += size) {
    const chunk = shuffled.slice(i, i + size);
    if (chunk.length < size) {
      dropped.push(...chunk);
      continue;
    }
    const teamName = chunk.join(" + ");
    entrants.push(teamName);
    teamMap[teamName] = chunk;
  }

  return { entrants, dropped, teamMap };
}



  function nextPow2(n) {
    let p = 1;
    while (p < n) p *= 2;
    return p;
  }

  function getRoundLabel(r, totalRounds) {
    if (totalRounds <= 0) return "Round";
    const remaining = totalRounds - r;
    if (remaining === 1) return "Final";
    if (remaining === 2) return "Semi-final";
    if (remaining === 3) return "Quarter-final";
    return `Round ${r + 1}`;
  }

  // Create single-elim bracket from names (random order)
  function createBracket(names, teamMap = {}) {
  const list = shuffle(names.filter(Boolean));
  if (list.length < 2) return null;

  const size = nextPow2(list.length);
  while (list.length < size) list.push("BYE");

  const totalRounds = Math.log2(size);
  const rounds = [];

  const getRoster = (teamName) => {
    const t = String(teamName || "").trim();
    const up = t.toUpperCase();
    if (!t || up === "BYE" || up === "TBD") return [];
    if (Array.isArray(teamMap[t])) return teamMap[t];
    // fallback (in case it was stored as string)
    return t.split(" + ").map((x) => x.trim()).filter(Boolean);
  };

  // Round 1 matches
  const r1 = [];
  for (let i = 0; i < list.length; i += 2) {
    const home = list[i];
    const away = list[i + 1];

    r1.push({
      home,
      away,
      homePlayers: getRoster(home),
      awayPlayers: getRoster(away),
    });
  }
  rounds.push(r1);

  // Future rounds placeholders
  for (let r = 1; r < totalRounds; r++) {
    const prevMatchCount = rounds[r - 1].length;
    const matchCount = Math.ceil(prevMatchCount / 2);
    const rr = [];
    for (let i = 0; i < matchCount; i++) {
      rr.push({ home: "TBD", away: "TBD", homePlayers: [], awayPlayers: [] });
    }
    rounds.push(rr);
  }

  return { rounds, totalRounds };
}


  async function apiJson(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
    });

    const raw = await res.text();
    let data = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = raw;
    }
    return { ok: res.ok, status: res.status, data };
  }

  async function apiGet(url) {
    return apiJson(url, { method: "GET" });
  }

  async function apiPost(url, body) {
    return apiJson(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
  }

  // ---------- LOAD TOURNAMENT META ----------
  async function loadTournamentMeta() {
    // Host tournaments list
    const host = await apiGet("/api/host/tournaments");
    if (host.ok && Array.isArray(host.data)) {
      const t = host.data.find(
        (x) => String(x.tournamentId ?? x.id) === String(tournamentId)
      );
      if (t) return t;
    }

    // Fallback: public list
    const pub = await apiGet("/api/tournaments");
    if (pub.ok && Array.isArray(pub.data)) {
      const t = pub.data.find(
        (x) => String(x.tournamentId ?? x.id) === String(tournamentId)
      );
      if (t) return t;
    }

    return null;
  }

  // ---------- LOAD PLAYERS (registrations) ----------
  async function loadPlayers() {
    const candidates = [
      `/api/host/tournaments/${encodeURIComponent(tournamentId)}/players`,
      `/api/host/tournaments/${encodeURIComponent(tournamentId)}/registrations`,
      `/api/tournaments/${encodeURIComponent(tournamentId)}/players`,
    ];

    for (const url of candidates) {
      const r = await apiGet(url);
      if (r.ok && Array.isArray(r.data)) return r.data;
    }
    return [];
  }

  // ---------- LOAD FIXTURES (DB only) ----------
  async function loadFixturesFromDb() {
    const r = await apiGet(`/api/host/tournaments/${encodeURIComponent(tournamentId)}/fixtures`);
    if (r.ok) return r.data || null;
    return null;
  }

  // ---------- UI: toggles + bracket ----------
  function ensureEmptyState(show) {
    if (!noneSelectedEl) return;
    noneSelectedEl.style.display = show ? "flex" : "none";
  }

  function setEditUI() {
    if (!editBtn) return;

    if (!fixtures?.__locked) {
      editBtn.style.display = "none";
      return;
    }

    editBtn.style.display = "inline-flex";
    editBtn.textContent = editMode ? "Save changes" : "Edit fixtures";
    editBtn.className = editMode ? "btn-primary" : "btn-dark";
  }


  function renderCategoryToggles() {
    if (!toggleWrap) return;

    toggleWrap.innerHTML = "";
    const catList = categories.map((c) => ({
      id: c.categoryId || c.id,
      label: categoryLabel(c),
    })).filter((x) => x.id);

    if (!catList.length) {
      toggleWrap.innerHTML = `<div class="muted">No categories found.</div>`;
      return;
    }

    catList.forEach((c) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "toggle-btn";
      btn.textContent = c.label;

      if (String(activeCategoryId) === String(c.id)) btn.classList.add("active");

      btn.addEventListener("click", () => {
        activeCategoryId = c.id;
        ensureEmptyState(false);

        toggleWrap.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        renderCategoryBracket(c.id);
      });

      toggleWrap.appendChild(btn);
    });
  }

  function renderCategoryBracket(categoryId) {
    if (!groupsEl) return;
    groupsEl.innerHTML = "";

    const cat = fixtures?.categories?.[categoryId];
    if (!cat || !Array.isArray(cat.rounds) || !cat.rounds.length) {
      const acceptedNames = acceptedByCategory[categoryId] || [];
      const catMeta = categories.find((x) => String(x.categoryId || x.id) === String(categoryId));
      const teamSize = Math.max(1, Number(catMeta?.teamSize || 1));
      groupsEl.innerHTML = `
        <div class="empty-state" style="display:flex;">
          <div class="feature-icon">🧩</div>
          <h3>No fixtures yet</h3>
          <p class="muted">
            ${acceptedNames.length < 2
              ? "Not enough accepted players to generate fixtures."
              : "Click “Generate fixtures” to create the bracket."}
          </p>
        </div>
      `;
      return;
    }

    const allowedNames = acceptedByCategory[categoryId] || [];
    const options = ["BYE", ...allowedNames];

    const baseGap = 16; // controls how "tall" the tree looks

const roundsHtml = cat.rounds
  .map((round, r) => {
    const isRound1 = r === 0;

    // Increase vertical spacing per round so it looks like a tree
    const gap = baseGap * Math.pow(2, r);        // 16, 32, 64, ...
    const offset = r === 0 ? 0 : gap / 2;        // push later rounds down a bit

    const matchesHtml = round
      .map((m, i) => {
        const home = m?.home ?? "BYE";
        const away = m?.away ?? "BYE";

        const homeBye = String(home).toUpperCase() === "BYE";
        const awayBye = String(away).toUpperCase() === "BYE";

        const catMeta = categories.find((x) => String(x.categoryId || x.id) === String(categoryId));
const teamSize = Math.max(1, Number(catMeta?.teamSize || 1));

const splitTeam = (t) =>
  String(t || "")
    .split(" + ")
    .map((x) => x.trim())
    .filter(Boolean);

const homePlayers = Array.isArray(m?.homePlayers) ? m.homePlayers : splitTeam(home);
const awayPlayers = Array.isArray(m?.awayPlayers) ? m.awayPlayers : splitTeam(away);

const renderPlayerSelects = (side, playersArr) => {
  const byeSelected = String((playersArr?.[0] || "")).toUpperCase() === "BYE";

  const selects = [];
  for (let k = 0; k < teamSize; k++) {
    const current = playersArr?.[k] || "";
    const isFirst = k === 0;

    selects.push(`
      <select
        class="fixture-player-select"
        data-side="${side}"
        data-round="${r}"
        data-match="${i}"
        data-player-index="${k}"
      >
        ${isFirst ? `<option value="__BYE__" ${byeSelected ? "selected" : ""}>BYE</option>` : ""}
        <option value="" ${(!current && !byeSelected) ? "selected" : ""}>Select player</option>
        ${options
          .filter(n => n !== "BYE")  // BYE handled via __BYE__ only
          .map((n) => `<option value="${n}" ${n === current ? "selected" : ""}>${n}</option>`)
          .join("")}
      </select>
    `);
  }

  return `<div class="fixture-player-grid">${selects.join("")}</div>`;
};

const homeCell =
  fixtures.__locked && editMode && isRound1
    ? renderPlayerSelects("home", homePlayers)
    : `<span class="player-name">${home}</span>`;

const awayCell =
  fixtures.__locked && editMode && isRound1
    ? renderPlayerSelects("away", awayPlayers)
    : `<span class="player-name">${away}</span>`;


        const scoreKey = scoringSchema?.winnerLogic?.field || "points";
        const aVal = m?.score?.state?.A?.[scoreKey];
        const bVal = m?.score?.state?.B?.[scoreKey];

        const scoreLine =
          aVal !== undefined && bVal !== undefined
            ? `Score: <strong>${aVal}</strong> - <strong>${bVal}</strong>`
            : `Score: <strong>-</strong>`;

        const winnerLine =
          m?.winner ? `Winner: <strong>${m.winner}</strong>` : `Winner: <strong>-</strong>`;

        return `
          <div class="bracket-match">
            <div class="match-label">Match ${i + 1}</div>

            <div class="player-slot ${homeBye ? "bye" : ""}">${homeCell}</div>
            <div class="player-slot ${awayBye ? "bye" : ""}">${awayCell}</div>

            <div class="match-actions" style="display:flex; flex-direction:column; gap:8px; align-items:flex-start;">
              <button
                type="button"
                class="btn-dark start-scoring-btn"
                data-tournament-id="${encodeURIComponent(tournamentId)}"
                data-category-id="${encodeURIComponent(categoryId)}"
                data-round="${r}"
                data-match="${i}"
                ${homeBye || awayBye ? "disabled" : ""}
              >
                Start scoring
              </button>

              <div class="muted" style="font-size:13px;">${scoreLine}</div>
              <div class="muted" style="font-size:13px;">${winnerLine}</div>
            </div>
          </div>
        `;


      })
      .join("");

    return `
      <div class="bracket-round" style="--round-gap:${gap}px; --round-offset:${offset}px" data-round="${r}">
        <div class="round-title">${getRoundLabel(r, cat.totalRounds || cat.total_rounds || 0)}</div>
        ${matchesHtml}
      </div>
    `;
  })
  .join("");

const wrapper = document.createElement("div");
wrapper.className = "fixtures-group";
wrapper.innerHTML = `
  <div class="fixtures-group-header">
    <h2>${cat.label || "Fixtures"}</h2>
    ${fixtures.__locked ? `<p class="muted">Fixtures locked (edit Round 1 if needed).</p>` : ""}
  </div>

  <div class="fixtures-bracket">
    <div class="bracket-rounds">
      ${roundsHtml}
    </div>
  </div>
`;

    groupsEl.appendChild(wrapper);
  }


  // ---------- Build accepted-by-category ----------
  function rebuildAcceptedByCategory() {
    acceptedByCategory = {};
    categories.forEach((c) => {
      const cid = c.categoryId || c.id;
      if (cid) acceptedByCategory[cid] = [];
    });

    players.forEach((p) => {
      const cid = getPlayerCategoryId(p);
      if (!cid) return;
      if (normalizeStatus(p) !== "accepted") return; // ✅ rejected excluded
      acceptedByCategory[cid] = acceptedByCategory[cid] || [];
      acceptedByCategory[cid].push(getPlayerName(p));
    });
  }

function rebuildAcceptedFromFixturesRound1() {
  acceptedByCategory = {};
  const cats = fixtures?.categories || {};

  const splitTeam = (t) =>
    String(t || "")
      .split(" + ")
      .map((x) => x.trim())
      .filter(Boolean);

  Object.keys(cats).forEach((cid) => {
    const round1 = cats[cid]?.rounds?.[0] || [];
    const set = new Set();

    round1.forEach((m) => {
      const homePlayers = Array.isArray(m?.homePlayers) ? m.homePlayers : splitTeam(m?.home);
      const awayPlayers = Array.isArray(m?.awayPlayers) ? m.awayPlayers : splitTeam(m?.away);

      [...homePlayers, ...awayPlayers].forEach((name) => {
        const n = String(name || "").trim();
        if (!n) return;
        const up = n.toUpperCase();
        if (up === "BYE" || up === "TBD") return;
        set.add(n);
      });
    });

    acceptedByCategory[cid] = Array.from(set);
  });
}


// ---------- INIT LOAD ----------
tournamentMeta = await loadTournamentMeta();
if (tournamentMeta) {
  titleEl && (titleEl.textContent = tournamentMeta.tournamentName ?? "Tournament");
  sportEl && (sportEl.textContent = tournamentMeta.sportName ?? "");
  datesEl && (datesEl.textContent = tournamentMeta.tournamentDates ?? "");
  codeEl && (codeEl.textContent = tournamentMeta.accessCode ?? "");
  categories = normalizeCategories(tournamentMeta.categories);
} else {
  titleEl && (titleEl.textContent = "Tournament");
}

// Load fixtures from DB FIRST
const existing = await loadFixturesFromDb();

if (existing) {
  fixtures = existing;
  fixtures.__locked = true;
  generateBtn && (generateBtn.disabled = true);
  setEditUI();

  // ✅ NEW: build accepted list from fixtures Round 1 (no players API needed)
  rebuildAcceptedFromFixturesRound1();

} else {
  // Only if fixtures do NOT exist, load players (needed to generate fixtures)
  players = await loadPlayers();
  rebuildAcceptedByCategory();

  // Create empty shells (do NOT randomize until Generate)
  fixtures = { categories: {} };
  categories.forEach((c) => {
    const cid = c.categoryId || c.id;
    if (!cid) return;
    fixtures.categories[cid] = {
      categoryId: cid,
      label: categoryLabel(c),
      rounds: [],
      totalRounds: 0,
    };
  });
  fixtures.__locked = false;
  setEditUI();
}


  // ✅ NEW: Load scoring schema (optional; may be null if not set yet)
  const schemaResp = await apiGet(
    `/api/host/tournaments/${encodeURIComponent(tournamentId)}/scoring-schema`
  );
  scoringSchema = schemaResp.ok ? schemaResp.data : null;

  renderCategoryToggles();
  ensureEmptyState(true);

  // ---------- GENERATE (DB only, once) ----------
  generateBtn?.addEventListener("click", async () => {
    if (!fixtures || fixtures.__locked) return;

    const newFixtures = { categories: {} };
    let createdAny = false;

    categories.forEach((c) => {
      const cid = c.categoryId || c.id;
      if (!cid) return;

      const names = acceptedByCategory[cid] || [];
const teamSize = Number(c.teamSize || 1);

const { entrants, dropped, teamMap } = buildEntrants(names, teamSize);
if (dropped.length) {
  showToast(`⚠️ ${dropped.length} player(s) left out (need teams of ${teamSize})`);
}

const bracket = createBracket(entrants, teamMap);


      newFixtures.categories[cid] = {
        categoryId: cid,
        label: categoryLabel(c),
        ...(bracket ? bracket : { rounds: [], totalRounds: 0 }),
      };

      if (bracket) createdAny = true;
    });

    if (!createdAny) {
      showToast("Not enough accepted players to generate fixtures");
      return;
    }

    // Save to DB (backend enforces generate-once via ConditionExpression)
    const r = await apiPost(
      `/api/host/tournaments/${encodeURIComponent(tournamentId)}/fixtures`,
      newFixtures
    );

    if (!r.ok) {
      if (r.status === 409) {
        showToast("Fixtures already generated");
        const again = await loadFixturesFromDb();
        if (again) {
          fixtures = again;
          fixtures.__locked = true;
          generateBtn.disabled = true;
          setEditUI();
        }
        return;
      }
      showToast("Failed to save fixtures to DB");
      console.error("Save fixtures failed:", r);
      return;
    }

    fixtures = r.data || newFixtures;
    fixtures.__locked = true;
    generateBtn.disabled = true;
    setEditUI();
    showToast("Fixtures generated");

    // Refresh UI
    renderCategoryToggles();
    if (activeCategoryId) renderCategoryBracket(activeCategoryId);
  });


genSchemaBtn?.addEventListener("click", async () => {
  genSchemaBtn.disabled = true;
  try {
    const resp = await apiPost(
      `/api/host/tournaments/${encodeURIComponent(tournamentId)}/scoring-schema/auto`,
      { context: { matchType: "auto" } }
    );
    showToast(`Scoring schema generated ✅ (${resp?.scoringSchema?.sport || "sport"})`);
  } catch (e) {
    alert("Failed to generate schema: " + (e?.message || e));
  } finally {
    genSchemaBtn.disabled = false;
  }
});

  // ---------- EDIT / SAVE (Round 1 only) ----------
  editBtn?.addEventListener("click", async () => {
  if (!fixtures?.__locked) return;

  // If currently not editing -> enter edit mode
  if (!editMode) {
    editMode = true;
    setEditUI();
    if (activeCategoryId) renderCategoryBracket(activeCategoryId);
    return;
  }

  // If currently editing -> SAVE
  if (!activeCategoryId) return;

  // Apply dropdown selections to fixtures object (Round 1 only)
const catMeta = categories.find((x) => String(x.categoryId || x.id) === String(activeCategoryId));
const teamSize = Math.max(1, Number(catMeta?.teamSize || 1));

const round1 = fixtures.categories[activeCategoryId].rounds?.[0] || [];
const chosen = []; // all selected players for uniqueness check

// Build per-match rosters from per-player selects
for (let m = 0; m < round1.length; m++) {
  const match = round1[m];

  const readSideRoster = (side) => {
    const sels = Array.from(
      document.querySelectorAll(
        `.fixture-player-select[data-round="0"][data-match="${m}"][data-side="${side}"]`
      )
    ).sort((a, b) => Number(a.dataset.playerIndex) - Number(b.dataset.playerIndex));

    // Singles fallback: if old UI remains somehow
    if (!sels.length && teamSize === 1) {
      const legacy = document.querySelector(
        `.fixture-select[data-round="0"][data-match="${m}"][data-side="${side}"]`
      );
      const val = legacy?.value || "";
      if (String(val).toUpperCase() === "BYE") return { team: "BYE", roster: [] };
      return { team: val, roster: val ? [val] : [] };
    }

    const vals = sels.map((s) => s.value);

    // Team BYE if first select is "__BYE__"
    if (vals[0] === "__BYE__") return { team: "BYE", roster: [] };

    const roster = vals.map((v) => String(v || "").trim()).filter(Boolean);

    // Must fill exactly teamSize players
    if (roster.length !== teamSize) {
      return { error: `Please select ${teamSize} players for ${side.toUpperCase()} in Match ${m + 1}` };
    }

    // No duplicates within same team
    const set = new Set(roster);
    if (set.size !== roster.length) {
      return { error: `Duplicate player selected in ${side.toUpperCase()} team in Match ${m + 1}` };
    }

    const teamName = roster.join(" + ");
    return { team: teamName, roster };
  };

  const A = readSideRoster("home");
  if (A.error) { showToast(A.error); return; }
  const B = readSideRoster("away");
  if (B.error) { showToast(B.error); return; }

  // If both BYE -> invalid
  if (A.team === "BYE" && B.team === "BYE") {
    showToast(`Both sides cannot be BYE (Match ${m + 1})`);
    return;
  }

  // Track chosen players for global uniqueness (exclude BYE)
  chosen.push(...A.roster, ...B.roster);

  // Apply to match
  match.home = A.team;
  match.away = B.team;
  match.homePlayers = A.roster;
  match.awayPlayers = B.roster;
}

// Global uniqueness check: a player can’t be in two teams in Round 1
const allSet = new Set(chosen);
if (allSet.size !== chosen.length) {
  showToast("A player is selected in multiple teams. Fix duplicates in Round 1.");
  return;
}


  const r = await apiPost(
    `/api/host/tournaments/${encodeURIComponent(tournamentId)}/fixtures/update`,
    fixtures
  );

  if (!r.ok) {
    showToast("Failed to save changes to DB");
    console.error("Update fixtures failed:", r);
    return;
  }

  fixtures = r.data || fixtures;
  fixtures.__locked = true;

  editMode = false;
  setEditUI();
  showToast("Fixtures updated");
  renderCategoryBracket(activeCategoryId);
});
  
});
