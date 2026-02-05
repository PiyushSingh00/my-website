// scripts/players.js
import { requireAuth, logout } from "./auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;

  // ---------- TOPBAR ----------
  const usernameLabel = document.getElementById("username-label");
  if (usernameLabel) usernameLabel.textContent = user.username;

  const signoutBtn = document.getElementById("signout-btn");
  signoutBtn?.addEventListener("click", logout);

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

  const allCount = document.getElementById("all-count");
  const maleCount = document.getElementById("male-count");
  const femaleCount = document.getElementById("female-count");

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

  // ---------- HELPERS ----------
  function getPlayerId(p) {
    return p.playerId ?? p.registrationId ?? p.id ?? p._id ?? p.pk ?? null;
  }

  function normalizeStatus(p) {
    const raw =
      p.status ?? p.registrationStatus ?? p.inviteStatus ?? p.state ?? "pending";
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
      }
    }
  }

  // ---------- RENDER ----------
  function computeCounts(players) {
    const male = players.filter(
      (p) => String(p.gender || "").toLowerCase() === "male"
    ).length;
    const female = players.filter(
      (p) => String(p.gender || "").toLowerCase() === "female"
    ).length;
    return { all: players.length, male, female };
  }

  function applyFilter(players) {
    if (activeFilter === "male")
      return players.filter(
        (p) => String(p.gender || "").toLowerCase() === "male"
      );
    if (activeFilter === "female")
      return players.filter(
        (p) => String(p.gender || "").toLowerCase() === "female"
      );
    return players;
  }

  function render() {
    const filtered = applyFilter(allPlayers);
    const counts = computeCounts(allPlayers);

    allCount && (allCount.textContent = String(counts.all));
    maleCount && (maleCount.textContent = String(counts.male));
    femaleCount && (femaleCount.textContent = String(counts.female));

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

      const isFinal = status !== "pending";

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
            <button type="button" class="action-btn accept" ${
              isFinal ? "disabled" : ""
            } data-action="accept">Accept</button>
            <button type="button" class="action-btn reject" ${
              isFinal ? "disabled" : ""
            } data-action="reject">Reject</button>
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
    const tabs = Array.from(document.querySelectorAll(".players-tab"));
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

  wireTabs();
  await loadTournamentMeta();
  await loadPlayers();
});
