// scripts/players.js
import { requireAuth, logout } from "./auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;

  // ---------- TOPBAR ----------
  document.querySelectorAll(".brand").forEach((el) => {
    el.addEventListener("click", () => {
      window.location.href = "index.html";
    });
  });

  // ===== Topbar: avatar + dropdown signout + mode toggle =====
const trigger = document.getElementById("players-user-menu-trigger");
const dropdown = document.getElementById("players-user-menu-dropdown");

// Set avatar initial
if (trigger) {
  const label = (user?.name || user?.username || user?.email || "U").trim();
  trigger.textContent = label.charAt(0).toUpperCase();
}

// Dropdown open/close
trigger?.addEventListener("click", () => dropdown?.classList.toggle("is-open"));

// Dropdown: Sign out
document.getElementById("dropdown-signout")?.addEventListener("click", () => {
  dropdown?.classList.remove("is-open");
  logout();
});

// Mode toggle
const playerBtn = document.getElementById("mode-player-btn");
const hostBtn = document.getElementById("mode-host-btn");

playerBtn?.classList.add("is-active");
hostBtn?.classList.remove("is-active");

// clicking Join mode stays here
playerBtn?.addEventListener("click", () => {
  playerBtn.classList.add("is-active");
  hostBtn?.classList.remove("is-active");
});

// clicking Host mode: set mode + go host page
hostBtn?.addEventListener("click", async () => {
  hostBtn.classList.add("is-active");
  playerBtn?.classList.remove("is-active");

  await fetch("/api/user/mode", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + localStorage.getItem("token"),
    },
    body: JSON.stringify({ mode: "host" }),
  });

  window.location.href = "host.html";
});

function formatCategoryLabel(c) {
  const size = Number(c.teamSize);
  let type = "";
  if (size === 1) type = "Singles";
  else if (size === 2) type = "Doubles";

  const genderLabel =
    c.gender === "Male" ? "Men's" :
    c.gender === "Female" ? "Women's" :
    (c.gender || "");

  // e.g. "U18 Men's Singles"
  return `${c.ageGroup || ""} ${genderLabel}${type ? " " + type : ""}`.trim().replace(/\s+/g, " ");
}

function renderCategoryTabs(categories, players) {
  const tabs = document.getElementById("players-tabs");
  if (!tabs) return;

  tabs.innerHTML = "";

  // "All categories" tab
  const allBtn = document.createElement("button");
  allBtn.className = "players-tab active";
  allBtn.dataset.cat = "all";
  allBtn.innerHTML = `All categories <span class="tab-count">${players.length}</span>`;
  tabs.appendChild(allBtn);

  // One tab per category from host setup
  categories.forEach((c) => {
    const catId = c.categoryId;
    const label = formatCategoryLabel(c);

    const count = players.filter(p => String(p.categoryId) === String(catId)).length;

    const btn = document.createElement("button");
    btn.className = "players-tab";
    btn.dataset.cat = catId;
    btn.innerHTML = `${label} <span class="tab-count">${count}</span>`;
    tabs.appendChild(btn);
  });

  // click behavior
  tabs.addEventListener("click", (e) => {
    const btn = e.target.closest(".players-tab");
    if (!btn) return;

    tabs.querySelectorAll(".players-tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const cat = btn.dataset.cat;
    const filtered = (cat === "all")
      ? players
      : players.filter(p => String(p.categoryId) === String(cat));

    renderPlayersTable(filtered); // use your existing table render function
  }, { once: true });
}

  // Host dropdown (same IDs as host.html)
  const trigger =
    document.getElementById("host-user-menu-trigger") ||
    document.getElementById("user-menu-trigger");
  const dropdown =
    document.getElementById("host-user-menu-dropdown") ||
    document.getElementById("user-menu-dropdown");
  trigger?.addEventListener("click", () => dropdown?.classList.toggle("is-open"));

  const switchPlayerBtn = document.getElementById("switch-player-mode");
  switchPlayerBtn?.addEventListener("click", async () => {
    await fetch("/api/user/mode", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
      body: JSON.stringify({ mode: "player" }),
    });
    window.location.href = "join.html";
  });

  // ---------- READ TOURNAMENT ID ----------
  const params = new URLSearchParams(window.location.search);
  const tournamentId = params.get("tournamentId");

  if (!tournamentId) {
    console.warn("No tournamentId in URL");
    alert("Missing tournamentId in URL");
    return;
  }

  // ---------- ELEMENTS ----------
  const tableWrapper = document.getElementById("players-table-wrapper");
  const tableBody = document.getElementById("players-table-body");
  const emptyState = document.getElementById("players-empty-state");


  const titleEl = document.getElementById("players-tournament-name");
  const sportEl = document.getElementById("players-tournament-sport");
  const datesEl = document.getElementById("players-tournament-dates");
  const codeEl = document.getElementById("players-tournament-code");

  const backBtn = document.getElementById("players-back-btn");
  backBtn?.addEventListener("click", () => (window.location.href = "host.html"));

  const fixturesBtn = document.getElementById("create-fixtures-btn");
  fixturesBtn?.addEventListener("click", () => {
    window.location.href = `fixtures.html?tournamentId=${encodeURIComponent(
      tournamentId
    )}`;
  });

  // ---------- STATE ----------
  let allPlayers = [];
  let activeFilter = "all";
  let tournamentCategories = []; // [{categoryId, ageGroup, gender, teamSize}]


  // ---------- HELPERS ----------
  function normalizeCategories(cats) {
  if (!cats) return [];
  if (Array.isArray(cats)) return cats;
  if (typeof cats === "string") {
    try {
      const parsed = JSON.parse(cats);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
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
  return p.categoryId ?? p.categoryID ?? p.category ?? p.category_id ?? null;
}

  
  function getPlayerId(p) {
    return p.playerId ?? p.registrationId ?? p.id ?? p._id ?? p.pk ?? null;
  }

function normalizeStatus(p) {
  const raw =
    p.status ?? p.registrationStatus ?? p.inviteStatus ?? p.state ?? "accepted";
  const s = String(raw).toLowerCase();
    if (["accepted", "approve", "approved"].includes(s)) return "accepted";
    if (["rejected", "reject", "declined", "denied"].includes(s))
      return "rejected";
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
      (c) =>
        c.url &&
        !c.url.includes("null") &&
        !c.url.includes("undefined")
    );

    // If no ID exists, try a generic endpoint with player identifying info
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

    throw new Error(
      "No matching accept/reject API route responded successfully."
    );
  }

  // ---------- LOAD TOURNAMENT META ----------
  async function loadTournamentMeta() {
    // Host tournaments list
    const host = await apiJson("/api/host/tournaments");
    if (host.ok && Array.isArray(host.data)) {
      const t = host.data.find(
        (x) => String(x.tournamentId ?? x.id) === String(tournamentId)
      );
      if (t) {
        titleEl && (titleEl.textContent = t.tournamentName ?? "Tournament");
        sportEl && (sportEl.textContent = t.sportName ?? "");
        datesEl && (datesEl.textContent = t.tournamentDates ?? "");
        codeEl && (codeEl.textContent = t.accessCode ?? "");
        tournamentCategories = normalizeCategories(t.categories);
        return;
      }
    }

    // Fallback: public list
    const pub = await apiJson("/api/tournaments");
    if (pub.ok && Array.isArray(pub.data)) {
      const t = pub.data.find(
        (x) => String(x.tournamentId ?? x.id) === String(tournamentId)
      );
      if (t) {
        titleEl && (titleEl.textContent = t.tournamentName ?? "Tournament");
        sportEl && (sportEl.textContent = t.sportName ?? "");
        datesEl && (datesEl.textContent = t.tournamentDates ?? "");
        codeEl && (codeEl.textContent = t.accessCode ?? "");
        tournamentCategories = normalizeCategories(t.categories);

      }
    }
  }

  // ---------- RENDER ----------
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


  function render() {
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
      const status = normalizeStatus(p);

      const name = p.playerName ?? p.name ?? p.fullName ?? "-";
      const age = p.age ?? p.playerAge ?? "-";
      const gender = p.gender ?? "-";


      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${name}</td>
        <td>${age}</td>
        <td>${gender}</td>
        <td><span class="status-pill ${statusClass(status)}">${statusLabel(
        status
      )}</span></td>
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
            // Update local state and re-render
            p.status = nextStatus;
            p.registrationStatus = nextStatus;
            render();
          } catch (e) {
            console.error(e);
            alert(
              "Could not update player status. If this keeps happening, the backend accept/reject route is missing."
            );
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

  // All tab
  const allBtn = document.createElement("button");
  allBtn.type = "button";
  allBtn.className = "players-tab active";
  allBtn.dataset.playerFilter = "all";
  allBtn.innerHTML = `All players <span class="tab-count" id="tab-count-all">0</span>`;
  tabsWrap.appendChild(allBtn);

  // Category tabs
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

  // Click wiring
  const tabs = Array.from(tabsWrap.querySelectorAll(".players-tab"));
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      activeFilter = tab.dataset.playerFilter || "all";
      render();
    });
  });
}



  // ---------- FETCH PLAYERS ----------
  async function loadPlayers() {
    // This is the route your app already uses historically:
    const primary = await apiJson(`/api/tournaments/${tournamentId}/players`);

    if (!primary.ok) {
      console.error("Failed to fetch players", primary.status, primary.data);
      alert("Could not load players for this tournament.");
      allPlayers = [];
      render();
      return;
    }

    const players = Array.isArray(primary.data)
      ? primary.data
      : primary.data?.players || primary.data?.items || [];

    allPlayers = players;
    render();
  }

await loadTournamentMeta();
wireTabs();
await loadPlayers();

});
