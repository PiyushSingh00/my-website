// scripts/fixtures.js
import { requireAuth, logout } from "./auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;

  // ---------------------------------------------------------------------------
  // TOPBAR
  // ---------------------------------------------------------------------------
  const brandLink = document.querySelector(".brand-link");
  brandLink?.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = "index.html";
  });

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

  document.addEventListener("click", (e) => {
    if (!dropdown || !trigger) return;
    if (!dropdown.contains(e.target) && !trigger.contains(e.target)) {
      dropdown.classList.remove("is-open");
    }
  });

  document.getElementById("dropdown-signout")?.addEventListener("click", () => {
    dropdown?.classList.remove("is-open");
    logout();
  });

  const playerBtn = document.getElementById("mode-player-btn");
  const hostBtn = document.getElementById("mode-host-btn");

  hostBtn?.classList.add("is-active");
  playerBtn?.classList.remove("is-active");

  playerBtn?.addEventListener("click", async () => {
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

  // ---------------------------------------------------------------------------
  // URL / DOM
  // ---------------------------------------------------------------------------
  const params = new URLSearchParams(window.location.search);
  const tournamentId = params.get("tournamentId");
  if (!tournamentId) {
    alert("Missing tournamentId in URL");
    return;
  }

  const titleEl = document.getElementById("fixtures-tournament-name");
  const sportEl = document.getElementById("fixtures-tournament-sport");
  const datesEl = document.getElementById("fixtures-tournament-dates");
  const codeEl = document.getElementById("fixtures-tournament-code");
  const kickerEl = document.getElementById("fixtures-page-kicker");
  const helperTextEl = document.getElementById("fixtures-helper-text");

  const backBtn = document.getElementById("fixtures-back-btn");
  const generateBtn = document.getElementById("fixtures-generate-btn");
  const toastEl = document.getElementById("fixtures-toast");
  const noneSelectedEl = document.getElementById("fixtures-none-selected");
  const toggleWrap = document.getElementById("fixtures-toggle");
  const groupsEl = document.getElementById("fixtures-groups");
  const configureFieldsBtn = document.getElementById("fixtures-configure-fields-btn");
  const editBtn = document.getElementById("fixtures-edit-btn");

  backBtn?.addEventListener("click", () => {
    window.location.href = `players.html?tournamentId=${encodeURIComponent(tournamentId)}`;
  });

  // ---------------------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------------------
  let tournamentMeta = null;
  let categories = [];
  let players = [];
  let acceptedByCategory = {};
  let fixtures = null;
  let activeCategoryId = null;
  let editMode = false;
  let scoringSchema = null;

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------
  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg || "✓ Done";
    toastEl.style.display = "inline-flex";
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      toastEl.style.display = "none";
    }, 1800);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function safeJson(value, fallback = null) {
    if (value == null) return fallback;
    if (typeof value === "object") return value;
    if (typeof value !== "string") return fallback;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  async function apiJson(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: "Bearer " + (localStorage.getItem("token") || ""),
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

  async function apiPut(url, body) {
    return apiJson(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
  }

  function normalizeTournamentList(raw) {
    if (Array.isArray(raw)) return raw;
    if (!raw || typeof raw !== "object") return [];
    if (Array.isArray(raw.data)) return raw.data;
    if (Array.isArray(raw.items)) return raw.items;
    if (Array.isArray(raw.tournaments)) return raw.tournaments;
    return [];
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
    const level = c?.playingLevel ? String(c.playingLevel).trim() : "";
    const size = c?.teamSize ? Number(c.teamSize) : null;
    const exact = c?.exactTeamSize ? Number(c.exactTeamSize) : null;

    let type = "";
    if (size === 1) type = "Singles";
    else if (size === 2) type = "Doubles";
    else if (size === 3) type = "Triples";
    else if (size >= 4) type = exact ? `Team ${exact}` : "Team";

    const parts = [age, gender, level, type].filter(Boolean);
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

  function makeMatchId() {
    if (window.crypto && crypto.randomUUID) return "M-" + crypto.randomUUID();
    return "M-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function splitTeamName(teamName) {
    const t = String(teamName || "").trim();
    const up = t.toUpperCase();
    if (!t || up === "BYE" || up === "TBD") return [];
    return t.split(" + ").map((x) => x.trim()).filter(Boolean);
  }

  function ensureMatchMeta(m) {
    if (!m || typeof m !== "object") return m;
    if (!m.matchId) m.matchId = makeMatchId();
    if (!Array.isArray(m.homePlayers)) m.homePlayers = splitTeamName(m.home);
    if (!Array.isArray(m.awayPlayers)) m.awayPlayers = splitTeamName(m.away);
    return m;
  }

  function buildEntrants(names, teamSize) {
    const size = Math.max(1, Number(teamSize || 1));
    const shuffled = shuffle(names);
    const entrants = [];
    const dropped = [];
    const teamMap = {};

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
      return teamMap[t] || splitTeamName(t);
    };

    const round1 = [];
    for (let i = 0; i < list.length; i += 2) {
      const home = list[i];
      const away = list[i + 1];
      round1.push(
        ensureMatchMeta({
          home,
          away,
          homePlayers: getRoster(home),
          awayPlayers: getRoster(away),
        })
      );
    }
    rounds.push(round1);

    for (let r = 1; r < totalRounds; r++) {
      const prev = rounds[r - 1];
      const next = [];
      for (let i = 0; i < prev.length; i += 2) {
        next.push(
          ensureMatchMeta({
            home: "TBD",
            away: "TBD",
            homePlayers: [],
            awayPlayers: [],
          })
        );
      }
      rounds.push(next);
    }

    return { rounds, totalRounds };
  }

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

  function updatePageModeCopy() {
    const advanced = safeJson(tournamentMeta?.advancedSettings, tournamentMeta?.advancedSettings) || {};
    const isLeagueMode =
      tournamentMeta?.stageFormat === "number_draw_league_knockout" ||
      advanced?.advancedMode === "pickleball_team_league";

    if (kickerEl) kickerEl.textContent = isLeagueMode ? "League & knockout fixtures" : "Knockout fixtures";
    if (helperTextEl) {
      helperTextEl.textContent = isLeagueMode
        ? "For advanced league mode, this page can display tie-based rounds and later knockout stages once backend tie/leaderboard support is ready."
        : "Fixtures are auto-generated in random order for each category. BYE indicates a free pass to the next round.";
    }
  }

  // ---------------------------------------------------------------------------
  // LOADERS
  // ---------------------------------------------------------------------------
  async function loadTournamentMeta() {
    const host = await apiGet("/api/host/tournaments");
    if (host.ok) {
      const list = normalizeTournamentList(host.data);
      const t = list.find((x) => String(x.tournamentId ?? x.id) === String(tournamentId));
      if (t) return t;
    }

    const pub = await apiGet("/api/tournaments");
    if (pub.ok) {
      const list = normalizeTournamentList(pub.data);
      const t = list.find((x) => String(x.tournamentId ?? x.id) === String(tournamentId));
      if (t) return t;
    }

    return null;
  }

  async function loadPlayers() {
    const candidates = [
      `/api/host/tournaments/${encodeURIComponent(tournamentId)}/players`,
      `/api/host/tournaments/${encodeURIComponent(tournamentId)}/registrations`,
      `/api/tournaments/${encodeURIComponent(tournamentId)}/players`,
    ];

    for (const url of candidates) {
      const r = await apiGet(url);
      if (!r.ok) continue;
      if (Array.isArray(r.data)) return r.data;
      if (Array.isArray(r.data?.data)) return r.data.data;
      if (Array.isArray(r.data?.players)) return r.data.players;
      if (Array.isArray(r.data?.registrations)) return r.data.registrations;
    }
    return [];
  }

  async function loadFixturesFromDb() {
    const r = await apiGet(`/api/host/tournaments/${encodeURIComponent(tournamentId)}/fixtures`);
    if (!r.ok) return null;
    return r.data?.data || r.data || null;
  }

  async function loadScoringSchema() {
    const schemaResp = await apiGet(
      `/api/host/tournaments/${encodeURIComponent(tournamentId)}/scoring-schema`
    );
    scoringSchema = schemaResp.ok ? schemaResp.data : null;
  }

  function computeAcceptedByCategory() {
    const map = {};
    categories.forEach((c) => {
      const cid = c.categoryId || c.id;
      if (!cid) return;

      map[cid] = players
        .filter((p) => normalizeStatus(p) === "accepted")
        .filter((p) => String(getPlayerCategoryId(p)) === String(cid))
        .map((p) => getPlayerName(p));
    });
    acceptedByCategory = map;
  }

  function migrateFixtures(fixturesObj) {
    if (!fixturesObj?.categories) return fixturesObj;
    Object.values(fixturesObj.categories).forEach((cat) => {
      if (!cat?.rounds) return;
      cat.rounds.forEach((round) => {
        if (!Array.isArray(round)) return;
        round.forEach((m) => {
          if (m && typeof m === "object") ensureMatchMeta(m);
        });
      });
    });
    return fixturesObj;
  }

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  function renderHeader() {
    titleEl.textContent = tournamentMeta?.tournamentName || "Tournament";
    sportEl.textContent = tournamentMeta?.sportName || "";
    datesEl.textContent = tournamentMeta?.tournamentDates || "";
    codeEl.textContent = tournamentMeta?.accessCode || "";
    updatePageModeCopy();
  }

  function renderCategoryToggles() {
    if (!toggleWrap) return;

    toggleWrap.innerHTML = "";
    const catList = categories
      .map((c) => ({
        id: c.categoryId || c.id,
        label: categoryLabel(c),
      }))
      .filter((x) => x.id);

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

  function renderLeaguePlaceholder(categoryId) {
    const catMeta = categories.find((x) => String(x.categoryId || x.id) === String(categoryId));
    groupsEl.innerHTML = `
      <div class="empty-state" style="display:flex;">
        <div class="feature-icon">🏓</div>
        <h3>Advanced league mode selected</h3>
        <p class="muted">
          ${escapeHtml(categoryLabel(catMeta || {}))} is configured under the advanced league/tie model.
          This page can show tie-based rounds once backend tie-generation and leaderboard endpoints are added.
        </p>
      </div>
    `;
  }

  function renderCategoryBracket(categoryId) {
    if (!groupsEl) return;
    groupsEl.innerHTML = "";

    const advanced = safeJson(tournamentMeta?.advancedSettings, tournamentMeta?.advancedSettings) || {};
    const isLeagueMode =
      tournamentMeta?.stageFormat === "number_draw_league_knockout" ||
      advanced?.advancedMode === "pickleball_team_league";

    if (isLeagueMode) {
      renderLeaguePlaceholder(categoryId);
      return;
    }

    const cat = fixtures?.categories?.[categoryId];
    if (!cat || !Array.isArray(cat.rounds) || !cat.rounds.length) {
      const acceptedNames = acceptedByCategory[categoryId] || [];
      groupsEl.innerHTML = `
        <div class="empty-state" style="display:flex;">
          <div class="feature-icon">🧩</div>
          <h3>No fixtures yet</h3>
          <p class="muted">
            ${acceptedNames.length < 2
              ? "Not enough accepted players to generate fixtures."
              : "Click “Regenerate fixtures” to create the bracket."}
          </p>
        </div>
      `;
      return;
    }

    const roundsHtml = cat.rounds
      .map((round, r) => {
        const matchesHtml = round
          .map((m, i) => {
            const home = m?.home ?? "BYE";
            const away = m?.away ?? "BYE";

            const homeBye = String(home).toUpperCase() === "BYE";
            const awayBye = String(away).toUpperCase() === "BYE";

            return `
              <div class="bk-card">
                <div class="fixture-line">
                  <span>${escapeHtml(home)}</span>
                </div>
                <div class="fixture-line">
                  <span>${escapeHtml(away)}</span>
                </div>
                <div class="fixture-actions">
                  ${
                    !homeBye && !awayBye
                      ? `
                    <button
                      type="button"
                      class="start-scoring-btn btn-dark"
                      data-tournament-id="${escapeHtml(tournamentId)}"
                      data-category-id="${escapeHtml(categoryId)}"
                      data-round="${r}"
                      data-match="${i}"
                    >
                      Start scoring
                    </button>
                  `
                      : ""
                  }
                </div>
              </div>
            `;
          })
          .join("");

        return `
          <div class="fixtures-round-col">
            <div class="round-title">${escapeHtml(getRoundLabel(r, cat.totalRounds || cat.rounds.length))}</div>
            ${matchesHtml}
          </div>
        `;
      })
      .join("");

    groupsEl.innerHTML = `
      <div class="fixtures-group">
        <h3 class="fixtures-group-title">${escapeHtml(cat.label || "Category")}</h3>
        <div class="fixtures-rounds">${roundsHtml}</div>
      </div>
    `;
  }

  // ---------------------------------------------------------------------------
  // GENERATE / EDIT / SAVE
  // ---------------------------------------------------------------------------
  generateBtn?.addEventListener("click", async () => {
    const advanced = safeJson(tournamentMeta?.advancedSettings, tournamentMeta?.advancedSettings) || {};
    const isLeagueMode =
      tournamentMeta?.stageFormat === "number_draw_league_knockout" ||
      advanced?.advancedMode === "pickleball_team_league";

    if (isLeagueMode) {
      showToast("Advanced league mode needs tie-generation backend, not knockout generation.");
      return;
    }

    if (!fixtures) fixtures = { categories: {} };
    if (fixtures.__locked) {
      showToast("Fixtures already generated");
      return;
    }

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

    const attempts = [
      () => apiPost(`/api/host/tournaments/${encodeURIComponent(tournamentId)}/fixtures`, newFixtures),
      () => apiPost(`/api/host/tournaments/${encodeURIComponent(tournamentId)}/fixtures/update`, newFixtures),
      () => apiPut(`/api/host/tournaments/${encodeURIComponent(tournamentId)}/fixtures`, newFixtures),
    ];

    let saved = null;
    let conflict = false;

    for (const attempt of attempts) {
      const r = await attempt();
      if (r.ok) {
        saved = r.data || newFixtures;
        break;
      }
      if (r.status === 409) {
        conflict = true;
        break;
      }
    }

    if (conflict) {
      showToast("Fixtures already generated");
      const again = await loadFixturesFromDb();
      if (again) {
        fixtures = again;
        fixtures.__locked = true;
        setEditUI();
        renderCategoryToggles();
        if (activeCategoryId) renderCategoryBracket(activeCategoryId);
      }
      return;
    }

    if (!saved) {
      showToast("Failed to save fixtures to DB");
      return;
    }

    fixtures = saved;
    fixtures.__locked = true;
    generateBtn.disabled = true;
    editMode = false;
    setEditUI();
    showToast("Fixtures generated");

    renderCategoryToggles();
    if (activeCategoryId) renderCategoryBracket(activeCategoryId);
  });

  editBtn?.addEventListener("click", async () => {
    if (!fixtures?.__locked) return;

    const advanced = safeJson(tournamentMeta?.advancedSettings, tournamentMeta?.advancedSettings) || {};
    const isLeagueMode =
      tournamentMeta?.stageFormat === "number_draw_league_knockout" ||
      advanced?.advancedMode === "pickleball_team_league";

    if (isLeagueMode) {
      showToast("Edit flow for league ties is not enabled yet.");
      return;
    }

    if (!editMode) {
      editMode = true;
      setEditUI();
      if (activeCategoryId) renderCategoryBracket(activeCategoryId);
      showToast("Round-1 editing UI is not enabled in this simplified version.");
      return;
    }

    // simplified save path
    editMode = false;
    setEditUI();
    if (activeCategoryId) renderCategoryBracket(activeCategoryId);
  });

  configureFieldsBtn?.addEventListener("click", () => {
    if (!activeCategoryId) {
      showToast("Select a category first");
      return;
    }
    window.location.href =
      `schema.html?tournamentId=${encodeURIComponent(tournamentId)}` +
      `&categoryId=${encodeURIComponent(activeCategoryId)}`;
  });

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

  // ---------------------------------------------------------------------------
  // INITIAL LOAD
  // ---------------------------------------------------------------------------
  tournamentMeta = await loadTournamentMeta();
  if (!tournamentMeta) {
    alert("Could not load tournament.");
    return;
  }

  categories = normalizeCategories(tournamentMeta.categories);
  players = await loadPlayers();
  computeAcceptedByCategory();

  fixtures = await loadFixturesFromDb();
  if (fixtures) {
    fixtures = migrateFixtures(fixtures);
  } else {
    fixtures = { categories: {} };
  }

  await loadScoringSchema();

  activeCategoryId = String(categories?.[0]?.categoryId || categories?.[0]?.id || "");
  renderHeader();
  renderCategoryToggles();

  if (!categories.length) {
    ensureEmptyState(true);
    groupsEl.innerHTML = "";
  } else {
    ensureEmptyState(false);
    renderCategoryBracket(activeCategoryId);
  }

  if (fixtures?.__locked) {
    generateBtn.disabled = true;
  }
  setEditUI();
});