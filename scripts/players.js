// scripts/players.js
import { requireAuth, logout } from "./auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;

  // ===== Topbar wiring (same as before) =====
  document.querySelectorAll(".brand").forEach((el) => {
    el.addEventListener("click", () => {
      window.location.href = "index.html";
    });
  });

  const trigger = document.getElementById("host-user-menu-trigger");
  const dropdown = document.getElementById("host-user-menu-dropdown");

  if (trigger) {
    const label = (user?.name || user?.username || user?.email || "U").trim();
    trigger.textContent = label.charAt(0).toUpperCase();
  }

  trigger?.addEventListener("click", () => dropdown?.classList.toggle("is-open"));

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

  hostBtn?.addEventListener("click", () => {
    hostBtn.classList.add("is-active");
    playerBtn?.classList.remove("is-active");
  });

  // ---------- READ TOURNAMENT ID ----------
  const params = new URLSearchParams(window.location.search);
  const tournamentId = params.get("tournamentId");
  if (!tournamentId) {
    alert("Missing tournamentId in URL");
    return;
  }

  // ---------- PLAYERS ELEMENTS ----------
  const tableWrapper = document.getElementById("players-table-wrapper");
  const tableBody = document.getElementById("players-table-body");
  const emptyState = document.getElementById("players-empty-state");

  const titleEl = document.getElementById("players-tournament-name");
  const sportEl = document.getElementById("players-tournament-sport");
  const datesEl = document.getElementById("players-tournament-dates");
  const codeEl = document.getElementById("players-tournament-code");

  document
    .getElementById("players-back-btn")
    ?.addEventListener("click", () => (window.location.href = "host.html"));

  // ---------- SHARED HELPERS ----------
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
    return parts.length ? parts.join(" • ") : (c?.categoryId || c?.id || "Category");
  }

  function getPlayerCategoryId(p) {
    return p.categoryId ?? p.categoryID ?? p.category ?? p.category_id ?? null;
  }

  function getPlayerId(p) {
    return p.playerId ?? p.registrationId ?? p.id ?? p._id ?? p.pk ?? null;
  }

  function normalizeStatusPlayersPage(p) {
    const raw =
      p.status ?? p.registrationStatus ?? p.inviteStatus ?? p.state ?? "accepted";
    const s = String(raw).toLowerCase();
    if (["accepted", "approve", "approved"].includes(s)) return "accepted";
    if (["rejected", "reject", "declined", "denied"].includes(s)) return "rejected";
    return "pending";
  }

  function statusLabel(status) {
    if (status === "accepted") return "Accepted";
    if (status === "rejected") return "Rejected";
    return "Pending";
  }

  function statusClass(status) {
    if (status === "accepted") return "status-pill--accepted";
    if (status === "rejected") return "status-pill--rejected";
    return "status-pill--pending";
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

  // Try multiple possible backend routes so it works across versions.
  async function updateRegistrationStatus(player, nextStatus) {
    const playerId = getPlayerId(player);
    const body = JSON.stringify({ status: nextStatus });

    const candidates = [
      { method: "PATCH", url: `/api/host/tournaments/${tournamentId}/players/${playerId}`, body },
      { method: "POST",  url: `/api/host/tournaments/${tournamentId}/players/${playerId}/${nextStatus}`, body: null },
      { method: "PATCH", url: `/api/tournaments/${tournamentId}/players/${playerId}`, body },
      { method: "PATCH", url: `/api/host/tournaments/${tournamentId}/registrations/${playerId}`, body },
      { method: "POST",  url: `/api/host/tournaments/${tournamentId}/registrations/${playerId}/${nextStatus}`, body: null },
    ].filter(
      (c) => c.url && !c.url.includes("null") && !c.url.includes("undefined")
    );

    if (!playerId) {
      candidates.unshift({
        method: "PATCH",
        url: `/api/host/tournaments/${tournamentId}/players`,
        body: JSON.stringify({
          status: nextStatus,
          playerName: player.playerName ?? player.name,
          phone: player.phone ?? player.playerPhone,
          username: player.username,
        }),
      });
    }

    for (const c of candidates) {
      const opts = {
        method: c.method,
        headers: c.body ? { "Content-Type": "application/json" } : undefined,
        body: c.body || undefined,
      };
      const r = await apiJson(c.url, opts);
      if (r.ok) return r.data;
    }

    throw new Error("No matching accept/reject API route responded successfully.");
  }

  // ---------- STATE (Players) ----------
  let allPlayers = [];
  let activeFilter = "all";
  let tournamentCategories = [];
  let tournamentMetaCache = null;

  // ---------- LOAD TOURNAMENT META ----------
  async function loadTournamentMeta() {
    // Host tournaments list
    const host = await apiGet("/api/host/tournaments");
    if (host.ok && Array.isArray(host.data)) {
      const t = host.data.find((x) => String(x.tournamentId ?? x.id) === String(tournamentId));
      if (t) {
        tournamentMetaCache = t;
        titleEl && (titleEl.textContent = t.tournamentName ?? "Tournament");
        sportEl && (sportEl.textContent = t.sportName ?? "");
        datesEl && (datesEl.textContent = t.tournamentDates ?? "");
        codeEl && (codeEl.textContent = t.accessCode ?? "");
        tournamentCategories = normalizeCategories(t.categories);
        return;
      }
    }

    // Fallback: public list
    const pub = await apiGet("/api/tournaments");
    if (pub.ok && Array.isArray(pub.data)) {
      const t = pub.data.find((x) => String(x.tournamentId ?? x.id) === String(tournamentId));
      if (t) {
        tournamentMetaCache = t;
        titleEl && (titleEl.textContent = t.tournamentName ?? "Tournament");
        sportEl && (sportEl.textContent = t.sportName ?? "");
        datesEl && (datesEl.textContent = t.tournamentDates ?? "");
        codeEl && (codeEl.textContent = t.accessCode ?? "");
        tournamentCategories = normalizeCategories(t.categories);
      }
    }
  }

  // ---------- RENDER (Players) ----------
  function computeCounts(players) {
    const counts = { all: players.length, byCategory: {} };
    players.forEach((p) => {
      const cid = getPlayerCategoryId(p) || "uncategorized";
      counts.byCategory[cid] = (counts.byCategory[cid] || 0) + 1;
    });
    return counts;
  }

  function applyFilter(players) {
    if (activeFilter === "all") return players;
    return players.filter((p) => String(getPlayerCategoryId(p) || "") === String(activeFilter));
  }

  function renderPlayers() {
    const filtered = applyFilter(allPlayers);
    const counts = computeCounts(allPlayers);

    const allCountEl = document.getElementById("tab-count-all");
    if (allCountEl) allCountEl.textContent = String(counts.all);

    document.querySelectorAll("[data-count-for]").forEach((el) => {
      const cid = el.getAttribute("data-count-for");
      el.textContent = String(counts.byCategory[cid] || 0);
    });

    if (!filtered.length) {
      emptyState && (emptyState.style.display = "block");
      tableWrapper && (tableWrapper.style.display = "none");
      return;
    }

    emptyState && (emptyState.style.display = "none");
    tableWrapper && (tableWrapper.style.display = "block");

    if (!tableBody) return;
    tableBody.innerHTML = "";

    filtered.forEach((p) => {
      const status = normalizeStatusPlayersPage(p);
      const name = p.playerName ?? p.name ?? p.fullName ?? "-";
      const age = p.age ?? p.playerAge ?? "-";
      const gender = p.gender ?? "-";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${name}</td>
        <td>${age}</td>
        <td>${gender}</td>
        <td><span class="status-pill ${statusClass(status)}">${statusLabel(status)}</span></td>
        <td>
          <div class="row-actions">
            ${
              status === "rejected"
                ? `<button type="button" class="action-btn accept" data-action="accept">Accept</button>`
                : `<button type="button" class="action-btn reject" data-action="reject">Reject</button>`
            }
          </div>
        </td>
      `;

      tr.querySelectorAll("button[data-action]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const action = btn.getAttribute("data-action");
          const nextStatus = action === "accept" ? "accepted" : "rejected";

          btn.disabled = true;
          try {
            await updateRegistrationStatus(p, nextStatus);
            p.status = nextStatus;
            p.registrationStatus = nextStatus;
            renderPlayers();

            // if fixtures are open and not locked (not yet generated), refresh accepted pool
            if (fixturesUi.isOpen && !fixturesState.fixtures?.__locked) {
              fixturesState.players = allPlayers;
              rebuildAcceptedByCategory();
              if (fixturesState.activeCategoryId) renderCategoryBracket(fixturesState.activeCategoryId);
            }
          } catch (e) {
            console.error(e);
            alert("Could not update player status.");
            btn.disabled = false;
          }
        });
      });

      tableBody.appendChild(tr);
    });
  }

  function wireTabs() {
    const tabsWrap = document.getElementById("players-tabs");
    if (!tabsWrap) return;

    tabsWrap.innerHTML = "";

    const allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.className = "players-tab active";
    allBtn.dataset.playerFilter = "all";
    allBtn.innerHTML = `All players <span class="tab-count" id="tab-count-all">0</span>`;
    tabsWrap.appendChild(allBtn);

    (tournamentCategories || []).forEach((c) => {
      const id = c.categoryId || c.id;
      if (!id) return;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "players-tab";
      btn.dataset.playerFilter = id;
      btn.innerHTML = `${categoryLabel(c)} <span class="tab-count" data-count-for="${id}">0</span>`;
      tabsWrap.appendChild(btn);
    });

    const tabs = Array.from(tabsWrap.querySelectorAll(".players-tab"));
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        activeFilter = tab.dataset.playerFilter || "all";
        renderPlayers();
      });
    });
  }

  // ---------- FETCH PLAYERS ----------
  async function loadPlayers() {
    const primary = await apiGet(`/api/tournaments/${encodeURIComponent(tournamentId)}/players`);
    if (!primary.ok) {
      console.error("Failed to fetch players", primary.status, primary.data);
      alert("Could not load players for this tournament.");
      allPlayers = [];
      renderPlayers();
      return;
    }

    const players = Array.isArray(primary.data)
      ? primary.data
      : primary.data?.players || primary.data?.items || [];

    allPlayers = players;
    renderPlayers();
  }

  // =========================================================
  // ✅ EMBEDDED FIXTURES (copied from fixtures.js behaviour)
  // =========================================================

  const fixturesUi = {
    wrap: document.getElementById("fixtures-embed"),
    openBtn: document.getElementById("create-fixtures-btn"),
    titleEl: document.getElementById("fixtures-tournament-name"),
    sportEl: document.getElementById("fixtures-tournament-sport"),
    datesEl: document.getElementById("fixtures-tournament-dates"),
    codeEl: document.getElementById("fixtures-tournament-code"),
    generateBtn: document.getElementById("fixtures-generate-btn"),
    toastEl: document.getElementById("fixtures-toast"),
    noneSelectedEl: document.getElementById("fixtures-none-selected"),
    toggleWrap: document.getElementById("fixtures-toggle"),
    groupsEl: document.getElementById("fixtures-groups"),
    editBtn: document.getElementById("fixtures-edit-btn"),
    configureBtn: document.getElementById("fixtures-configure-fields-btn"),
    isOpen: false,
    didInit: false,
  };

  const fixturesState = {
    tournamentMeta: null,
    categories: [],
    players: [],
    acceptedByCategory: {},
    fixtures: null,
    activeCategoryId: null,
    editMode: false,
    scoringSchema: null,
  };

  function showToast(msg) {
    if (!fixturesUi.toastEl) return;
    fixturesUi.toastEl.textContent = msg || "✓ Done";
    fixturesUi.toastEl.style.display = "inline-flex";
    setTimeout(() => (fixturesUi.toastEl.style.display = "none"), 1800);
  }

  function ensureEmptyState(show) {
    if (!fixturesUi.noneSelectedEl) return;
    fixturesUi.noneSelectedEl.style.display = show ? "flex" : "none";
  }

  function setEditUI() {
    if (!fixturesUi.editBtn) return;

    if (!fixturesState.fixtures?.__locked) {
      fixturesUi.editBtn.style.display = "none";
      return;
    }

    fixturesUi.editBtn.style.display = "inline-flex";
    fixturesUi.editBtn.textContent = fixturesState.editMode ? "Save changes" : "Edit fixtures";
    fixturesUi.editBtn.className = fixturesState.editMode ? "btn-primary" : "btn-dark";
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
      return splitTeamName(t);
    };

    const r1 = [];
    for (let i = 0; i < list.length; i += 2) {
      const home = list[i];
      const away = list[i + 1];
      r1.push(
        ensureMatchMeta({
          home,
          away,
          homePlayers: getRoster(home),
          awayPlayers: getRoster(away),
        })
      );
    }
    rounds.push(r1);

    for (let r = 1; r < totalRounds; r++) {
      const prevMatchCount = rounds[r - 1].length;
      const matchCount = Math.ceil(prevMatchCount / 2);
      const rr = [];
      for (let i = 0; i < matchCount; i++) {
        rr.push(
          ensureMatchMeta({
            home: "TBD",
            away: "TBD",
            homePlayers: [],
            awayPlayers: [],
          })
        );
      }
      rounds.push(rr);
    }

    return { rounds, totalRounds };
  }

  function normalizeStatusFixtures(p) {
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

  function rebuildAcceptedByCategory() {
    fixturesState.acceptedByCategory = {};
    fixturesState.categories.forEach((c) => {
      const cid = c.categoryId || c.id;
      if (cid) fixturesState.acceptedByCategory[cid] = [];
    });

    fixturesState.players.forEach((p) => {
      const cid = getPlayerCategoryId(p);
      if (!cid) return;
      if (normalizeStatusFixtures(p) !== "accepted") return; // only accepted
      fixturesState.acceptedByCategory[cid] = fixturesState.acceptedByCategory[cid] || [];
      fixturesState.acceptedByCategory[cid].push(getPlayerName(p));
    });
  }

  function rebuildAcceptedFromFixturesRound1() {
    fixturesState.acceptedByCategory = {};
    const cats = fixturesState.fixtures?.categories || {};

    Object.keys(cats).forEach((cid) => {
      const round1 = cats[cid]?.rounds?.[0] || [];
      const set = new Set();

      round1.forEach((m) => {
        const homePlayers = Array.isArray(m?.homePlayers) ? m.homePlayers : splitTeamName(m?.home);
        const awayPlayers = Array.isArray(m?.awayPlayers) ? m.awayPlayers : splitTeamName(m?.away);

        [...homePlayers, ...awayPlayers].forEach((name) => {
          const n = String(name || "").trim();
          if (!n) return;
          const up = n.toUpperCase();
          if (up === "BYE" || up === "TBD") return;
          set.add(n);
        });
      });

      fixturesState.acceptedByCategory[cid] = Array.from(set);
    });
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

  async function loadFixturesFromDb() {
    const r = await apiGet(`/api/host/tournaments/${encodeURIComponent(tournamentId)}/fixtures`);
    if (r.ok) return r.data || null;
    return null;
  }

  function renderCategoryToggles() {
    if (!fixturesUi.toggleWrap) return;

    fixturesUi.toggleWrap.innerHTML = "";
    const catList = fixturesState.categories
      .map((c) => ({ id: c.categoryId || c.id, label: categoryLabel(c) }))
      .filter((x) => x.id);

    if (!catList.length) {
      fixturesUi.toggleWrap.innerHTML = `<div class="muted">No categories found.</div>`;
      return;
    }

    catList.forEach((c) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "toggle-btn";
      btn.textContent = c.label;

      if (String(fixturesState.activeCategoryId) === String(c.id)) btn.classList.add("active");

      btn.addEventListener("click", () => {
        fixturesState.activeCategoryId = c.id;
        ensureEmptyState(false);

        fixturesUi.toggleWrap.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        renderCategoryBracket(c.id);
      });

      fixturesUi.toggleWrap.appendChild(btn);
    });
  }

  function renderCategoryBracket(categoryId) {
    if (!fixturesUi.groupsEl) return;
    fixturesUi.groupsEl.innerHTML = "";

    const cat = fixturesState.fixtures?.categories?.[categoryId];
    if (!cat || !Array.isArray(cat.rounds) || !cat.rounds.length) {
      const acceptedNames = fixturesState.acceptedByCategory[categoryId] || [];
      const catMeta = fixturesState.categories.find(
        (x) => String(x.categoryId || x.id) === String(categoryId)
      );
      const teamSize = Math.max(1, Number(catMeta?.teamSize || 1));

      fixturesUi.groupsEl.innerHTML = `
        <div class="empty-state" style="display:flex;">
          <div class="feature-icon">🧩</div>
          <h3>No fixtures yet</h3>
          <p class="muted">
            ${
              acceptedNames.length < 2
                ? "Not enough accepted players to generate fixtures."
                : "Click “Regenerate fixtures” to create the bracket."
            }
          </p>
        </div>
      `;
      return;
    }

    const allowedNames = fixturesState.acceptedByCategory[categoryId] || [];
    const options = ["BYE", ...allowedNames];

    const baseGap = 16;

    const roundsHtml = cat.rounds
      .map((round, r) => {
        const isRound1 = r === 0;
        const gap = baseGap * Math.pow(2, r);
        const offset = r === 0 ? 0 : gap / 2;

        const matchesHtml = round
          .map((m, i) => {
            const home = m?.home ?? "BYE";
            const away = m?.away ?? "BYE";

            const homeBye = String(home).toUpperCase() === "BYE";
            const awayBye = String(away).toUpperCase() === "BYE";

            const catMeta = fixturesState.categories.find(
              (x) => String(x.categoryId || x.id) === String(categoryId)
            );
            const teamSize = Math.max(1, Number(catMeta?.teamSize || 1));

            const homePlayers = Array.isArray(m?.homePlayers) ? m.homePlayers : splitTeamName(home);
            const awayPlayers = Array.isArray(m?.awayPlayers) ? m.awayPlayers : splitTeamName(away);

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
                    ${
                      isFirst
                        ? `<option value="__BYE__" ${byeSelected ? "selected" : ""}>BYE</option>`
                        : ""
                    }
                    <option value="" ${(!current && !byeSelected) ? "selected" : ""}>Select player</option>
                    ${options
                      .filter((n) => n !== "BYE")
                      .map((n) => `<option value="${n}" ${n === current ? "selected" : ""}>${n}</option>`)
                      .join("")}
                  </select>
                `);
              }

              return `<div class="fixture-player-grid">${selects.join("")}</div>`;
            };

            const homeCell =
              fixturesState.fixtures.__locked && fixturesState.editMode && isRound1
                ? renderPlayerSelects("home", homePlayers)
                : `<span class="player-name">${home}</span>`;

            const awayCell =
              fixturesState.fixtures.__locked && fixturesState.editMode && isRound1
                ? renderPlayerSelects("away", awayPlayers)
                : `<span class="player-name">${away}</span>`;

            const scoreKey = fixturesState.scoringSchema?.winnerLogic?.field || "points";
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
                    class="toggle-btn start-scoring-btn"
                    data-tournament-id="${tournamentId}"
                    data-category-id="${categoryId}"
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
        <div class="fixtures-group-header-left">
          <h2 class="fixtures-group-title">${cat.label || "Fixtures"}</h2>
          ${fixturesState.fixtures.__locked ? `<p class="muted">Fixtures locked (edit Round 1 if needed).</p>` : ""}
        </div>
      </div>

      <div class="fixtures-bracket">
        <div class="bracket-rounds">
          ${roundsHtml}
        </div>
      </div>
    `;

    fixturesUi.groupsEl.appendChild(wrapper);
  }

  async function generateAndSaveFixtures() {
    if (!fixturesState.fixtures || fixturesState.fixtures.__locked) return;

    const newFixtures = { categories: {} };
    let createdAny = false;

    fixturesState.categories.forEach((c) => {
      const cid = c.categoryId || c.id;
      if (!cid) return;

      const names = fixturesState.acceptedByCategory[cid] || [];
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

    const r = await apiPost(
      `/api/host/tournaments/${encodeURIComponent(tournamentId)}/fixtures`,
      newFixtures
    );

    if (!r.ok) {
      if (r.status === 409) {
        showToast("Fixtures already generated");
        const again = await loadFixturesFromDb();
        if (again) {
          fixturesState.fixtures = migrateFixtures(again);
          fixturesState.fixtures.__locked = true;
        if (fixturesUi.generateBtn) {
        fixturesUi.generateBtn.disabled = false;
        fixturesUi.generateBtn.textContent = "Regenerate fixtures";
      }
          setEditUI();
        }
        return;
      }
      showToast("Failed to save fixtures to DB");
      console.error("Save fixtures failed:", r);
      return;
    }

    fixturesState.fixtures = r.data || newFixtures;
    fixturesState.fixtures.__locked = true;
    if (fixturesUi.generateBtn) {
    fixturesUi.generateBtn.disabled = false;
    fixturesUi.generateBtn.textContent = "Regenerate fixtures";
  }
    setEditUI();
    showToast("Fixtures generated");

    renderCategoryToggles();
    if (fixturesState.activeCategoryId) renderCategoryBracket(fixturesState.activeCategoryId);
  }

  async function forceRegenerateFixtures() {
  // Always rebuild from latest accepted players
  rebuildAcceptedByCategory();

  const newFixtures = { categories: {} };
  let createdAny = false;

  fixturesState.categories.forEach((c) => {
    const cid = c.categoryId || c.id;
    if (!cid) return;

    const names = fixturesState.acceptedByCategory[cid] || [];
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
    showToast("Not enough accepted players to regenerate fixtures");
    return;
  }

  try {
    // 🔥 overwrite existing fixtures (same endpoint)
    const r = await apiPost(
      `/api/host/tournaments/${encodeURIComponent(tournamentId)}/fixtures/update`,
      newFixtures
    );

    if (!r.ok) {
      showToast("Failed to regenerate fixtures");
      console.error("Regenerate failed:", r);
      return;
    }

    // ✅ replace state completely (old scores gone automatically)
    fixturesState.fixtures = r.data || newFixtures;
    fixturesState.fixtures.__locked = true;

    fixturesState.editMode = false;

    showToast("Fixtures regenerated");

    renderCategoryToggles();
    if (fixturesState.activeCategoryId) {
      renderCategoryBracket(fixturesState.activeCategoryId);
    }

  } catch (e) {
    console.error(e);
    showToast("Something went wrong while regenerating");
  }
}

  
  async function initFixturesIfNeeded() {
    if (fixturesUi.didInit) return;
    fixturesUi.didInit = true;

    // Wire "start scoring" click delegation (same as fixtures.js)
    fixturesUi.groupsEl?.addEventListener("click", (e) => {
      const btn = e.target.closest(".start-scoring-btn");
      if (!btn) return;

      const tId = btn.dataset.tournamentId || "";
      const cId = btn.dataset.categoryId || "";
      const round = btn.dataset.round || "0";
      const match = btn.dataset.match || "0";

      window.location.href = `score.html?tournamentId=${tId}&categoryId=${cId}&round=${round}&match=${match}`;
    });

    // Configure scoring fields button (same redirect behaviour)
    fixturesUi.configureBtn?.addEventListener("click", () => {
      if (!fixturesState.activeCategoryId) {
        showToast("Select a category first");
        return;
      }
      window.location.href =
        `schema.html?tournamentId=${encodeURIComponent(tournamentId)}` +
        `&categoryId=${encodeURIComponent(fixturesState.activeCategoryId)}`;
    });

    // Generate button
    fixturesUi.generateBtn?.addEventListener("click", async () => {
    const alreadyGenerated = fixturesState.fixtures?.__locked;

    if (alreadyGenerated) {
      const confirmReset = window.confirm(
        "Are you sure you want to regenerate fixtures?\n\nIt will erase all scores and results of the current tournament."
      );

      if (!confirmReset) return;

      await forceRegenerateFixtures(); // new function
    } else {
      await generateAndSaveFixtures();
    }
  });

    // Edit / Save (Round 1 only) — same logic as fixtures.js
    fixturesUi.editBtn?.addEventListener("click", async () => {
      if (!fixturesState.fixtures?.__locked) return;

      if (!fixturesState.editMode) {
        fixturesState.editMode = true;
        setEditUI();
        if (fixturesState.activeCategoryId) renderCategoryBracket(fixturesState.activeCategoryId);
        return;
      }

      if (!fixturesState.activeCategoryId) return;

      const catMeta = fixturesState.categories.find(
        (x) => String(x.categoryId || x.id) === String(fixturesState.activeCategoryId)
      );
      const teamSize = Math.max(1, Number(catMeta?.teamSize || 1));

      const round1 = fixturesState.fixtures.categories[fixturesState.activeCategoryId].rounds?.[0] || [];
      const chosen = [];

      for (let m = 0; m < round1.length; m++) {
        const match = round1[m];

        const readSideRoster = (side) => {
          const sels = Array.from(
            document.querySelectorAll(
              `.fixture-player-select[data-round="0"][data-match="${m}"][data-side="${side}"]`
            )
          ).sort((a, b) => Number(a.dataset.playerIndex) - Number(b.dataset.playerIndex));

          const vals = sels.map((s) => s.value);

          if (vals[0] === "__BYE__") return { team: "BYE", roster: [] };

          const roster = vals.map((v) => String(v || "").trim()).filter(Boolean);

          if (roster.length !== teamSize) {
            return { error: `Please select ${teamSize} players for ${side.toUpperCase()} in Match ${m + 1}` };
          }

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

        if (A.team === "BYE" && B.team === "BYE") {
          showToast(`Both sides cannot be BYE (Match ${m + 1})`);
          return;
        }

        chosen.push(...A.roster, ...B.roster);

        match.home = A.team;
        match.away = B.team;
        match.homePlayers = A.roster;
        match.awayPlayers = B.roster;
        ensureMatchMeta(match);
      }

      const allSet = new Set(chosen);
      if (allSet.size !== chosen.length) {
        showToast("A player is selected in multiple teams. Fix duplicates in Round 1.");
        return;
      }

      const r = await apiPost(
        `/api/host/tournaments/${encodeURIComponent(tournamentId)}/fixtures/update`,
        fixturesState.fixtures
      );

      if (!r.ok) {
        showToast("Failed to save changes to DB");
        console.error("Update fixtures failed:", r);
        return;
      }

      fixturesState.fixtures = r.data || fixturesState.fixtures;
      fixturesState.fixtures.__locked = true;

      fixturesState.editMode = false;
      setEditUI();
      showToast("Fixtures updated");
      renderCategoryBracket(fixturesState.activeCategoryId);
    });
  }

  async function openAndLoadFixtures(autoGenerateIfMissing = true) {
    fixturesUi.wrap?.classList.remove("hidden");
    fixturesUi.isOpen = true;

    // Fill fixtures header from already loaded tournament meta / DOM
    fixturesUi.titleEl && (fixturesUi.titleEl.textContent = titleEl?.textContent || "Tournament");
    fixturesUi.sportEl && (fixturesUi.sportEl.textContent = sportEl?.textContent || "");
    fixturesUi.datesEl && (fixturesUi.datesEl.textContent = datesEl?.textContent || "");
    fixturesUi.codeEl && (fixturesUi.codeEl.textContent = codeEl?.textContent || "");

    await initFixturesIfNeeded();

    fixturesState.categories = tournamentCategories || [];
    fixturesState.players = allPlayers || [];

    // Load existing fixtures first
    const existing = await loadFixturesFromDb();
    if (existing) {
      fixturesState.fixtures = migrateFixtures(existing);
      fixturesState.fixtures.__locked = true;
    if (fixturesUi.generateBtn) {
      fixturesUi.generateBtn.disabled = false;
      fixturesUi.generateBtn.textContent = "Regenerate fixtures";
    }
      setEditUI();
      rebuildAcceptedFromFixturesRound1();
    } else {
      fixturesState.fixtures = { categories: {} };
      fixturesState.categories.forEach((c) => {
        const cid = c.categoryId || c.id;
        if (!cid) return;
        fixturesState.fixtures.categories[cid] = {
          categoryId: cid,
          label: categoryLabel(c),
          rounds: [],
          totalRounds: 0,
        };
      });
      fixturesState.fixtures.__locked = false;
      if (fixturesUi.generateBtn) {
      fixturesUi.generateBtn.disabled = false;
      fixturesUi.generateBtn.textContent = "Generate fixtures";
    }
      setEditUI();
      rebuildAcceptedByCategory();
    }

    // Load scoring schema (same endpoint)
    const schemaResp = await apiGet(
      `/api/host/tournaments/${encodeURIComponent(tournamentId)}/scoring-schema`
    );
    fixturesState.scoringSchema = schemaResp.ok ? schemaResp.data : null;

    renderCategoryToggles();
    ensureEmptyState(true);

    // ✅ requirement: clicking "Create tournament fixtures" should create them here
    if (autoGenerateIfMissing && fixturesState.fixtures && !fixturesState.fixtures.__locked) {
      await generateAndSaveFixtures();
    }

    // Scroll into view nicely
    fixturesUi.wrap?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Hook "Create tournament fixtures" on players page
  fixturesUi.openBtn?.addEventListener("click", async () => {
    await openAndLoadFixtures(true);
  });

  // ---------- INIT ----------
  await loadTournamentMeta();
  wireTabs();
  await loadPlayers();
});