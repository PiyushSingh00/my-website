
import { requireAuth, logout } from "./auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;

  const trigger = document.getElementById("join-user-menu-trigger");
  const dropdown = document.getElementById("join-user-menu-dropdown");
  const hostBtn = document.getElementById("mode-host-btn");
  const playerBtn = document.getElementById("mode-player-btn");

  const sidebar = document.getElementById("join-sidebar");
  const sidebarToggle = document.getElementById("join-sidebar-toggle");

  const browseView = document.getElementById("join-view-browse");
  const myView = document.getElementById("join-view-my");
  const notificationsView = document.getElementById("join-view-notifications");

  const browseList = document.getElementById("browse-tournaments-list");
  const myJoinedList = document.getElementById("my-joined-tournaments");
  const notificationsList = document.getElementById("join-notifications-list");

  const teamInviteSection = document.getElementById("team-invite-section");
  const teamInviteList = document.getElementById("team-invite-list");

  const joinCodeInput = document.getElementById("join-code-input");
  const joinCodeBtn = document.getElementById("join-code-btn");

  let allTournaments = [];
  let myJoinedTournaments = [];
  let myNotifications = [];
  let myTeamInvites = [];

  function getToken() {
    return localStorage.getItem("token") || localStorage.getItem("authToken") || "";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeIdentity(value) {
    return String(value || "").trim().toLowerCase();
  }

  function isSameUserByInviteFields(invite, currentUser) {
    return (
      (invite?.playerId && String(invite.playerId) === String(currentUser?.id || currentUser?.userId || "")) ||
      (invite?.username && normalizeIdentity(invite.username) === normalizeIdentity(currentUser?.username)) ||
      (invite?.inviteeUsername && normalizeIdentity(invite.inviteeUsername) === normalizeIdentity(currentUser?.username)) ||
      (invite?.inviteeName && normalizeIdentity(invite.inviteeName) === normalizeIdentity(currentUser?.name)) ||
      (invite?.playerName && normalizeIdentity(invite.playerName) === normalizeIdentity(currentUser?.name)) ||
      (invite?.name && normalizeIdentity(invite.name) === normalizeIdentity(currentUser?.name))
    );
  }

  function getVisibleInviteForRequest(request) {
    const invitedPlayers = Array.isArray(request?.invitedPlayers) ? request.invitedPlayers : [];
    if (!invitedPlayers.length) return null;
    return invitedPlayers.find((invite) => isSameUserByInviteFields(invite, user)) || invitedPlayers[0] || null;
  }

  function isTeamEvent(tournament) {
    return String(tournament?.tournamentType || "").toLowerCase().includes("team");
  }

    function normalizePhone(value) {
      return String(value || "").replace(/\D/g, "");
    }

    function isTournamentUmpire(tournament) {
      const umpires = Array.isArray(tournament?.umpires) ? tournament.umpires : [];
      if (!umpires.length) return false;

      const myName = normalizeIdentity(user?.name);
      const myUsername = normalizeIdentity(user?.username);
      const myPhone = normalizePhone(user?.phone || user?.mobile || user?.phoneNumber);

      return umpires.some((umpire) => {
        const umpireName = normalizeIdentity(umpire?.name);
        const umpireUsername = normalizeIdentity(umpire?.username);
        const umpirePhone = normalizePhone(umpire?.phone);

        return (
          (myPhone && umpirePhone && myPhone === umpirePhone) ||
          (myUsername && umpireUsername && myUsername === umpireUsername) ||
          (myName && umpireName && myName === umpireName)
        );
      });
    }

  function normalizeTournamentList(raw) {
    if (Array.isArray(raw)) return raw;
    if (!raw || typeof raw !== "object") return [];
    if (Array.isArray(raw.data)) return raw.data;
    if (Array.isArray(raw.items)) return raw.items;
    if (Array.isArray(raw.tournaments)) return raw.tournaments;
    if (Array.isArray(raw.rows)) return raw.rows;
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
    return parts.length ? parts.join(" • ") : (c?.eventName || c?.categoryId || c?.id || "Category");
  }

  function getPreferredCategoryId(tournament) {
    if (isTeamEvent(tournament)) return "__team_event__";
    const cats = normalizeCategories(tournament?.categories);
    return String(cats?.[0]?.categoryId || cats?.[0]?.id || "").trim();
  }

  async function apiJson(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: "Bearer " + getToken(),
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

  async function apiPatch(url, body) {
    return apiJson(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
  }

  function switchView(view) {
    document.querySelectorAll(".join-nav-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === view);
    });

    browseView?.classList.toggle("join-view--active", view === "browse");
    myView?.classList.toggle("join-view--active", view === "my");
    notificationsView?.classList.toggle("join-view--active", view === "notifications");
  }

  async function loadBrowseTournaments() {
    const r = await apiGet("/api/tournaments");
    allTournaments = r.ok ? normalizeTournamentList(r.data) : [];
  }

  async function loadMyTournaments() {
    const candidates = [
      "/api/player/tournaments",
      "/api/tournaments/mine",
    ];

    const merged = new Map();
    const responses = await Promise.all(candidates.map((url) => apiGet(url)));

    responses.forEach((r) => {
      if (!r.ok) return;
      normalizeTournamentList(r.data).forEach((tournament) => {
        const tournamentId = String(tournament?.tournamentId || tournament?.id || "").trim();
        if (!tournamentId) return;
        const existing = merged.get(tournamentId) || {};
        merged.set(tournamentId, {
          ...existing,
          ...tournament,
          tournamentId,
        });
      });
    });

    myJoinedTournaments = [...merged.values()].sort((a, b) =>
      String(b?.createdAt || "").localeCompare(String(a?.createdAt || ""))
    );
  }

  async function loadTeamInvites() {
    const candidates = [
      "/api/player/team-requests",
    ];

    for (const url of candidates) {
      const r = await apiGet(url);
      if (!r.ok) continue;

      const rows = Array.isArray(r.data)
        ? r.data
        : Array.isArray(r.data?.items)
          ? r.data.items
          : Array.isArray(r.data?.requests)
            ? r.data.requests
            : Array.isArray(r.data?.data)
              ? r.data.data
              : [];

      myTeamInvites = rows
        .map((req) => ({
          ...req,
          invitedPlayers: Array.isArray(req?.invitedPlayers) ? req.invitedPlayers : [],
        }))
        .filter((req) => req.invitedPlayers.length > 0);

      return;
    }

    myTeamInvites = [];
  }

  async function loadNotifications() {
    myNotifications = [];
    myTeamInvites.forEach((invite) => {
      const mine = getVisibleInviteForRequest(invite);
      myNotifications.push({
        kind: "team_invite",
        title: `Team invite from ${invite?.captainName || "Captain"}`,
        body: `${invite?.teamName || "Team"} • ${invite?.tournamentName || "Tournament"}`,
        status: mine?.inviteStatus || "pending",
      });
    });
  }

  async function lookupTournamentByCode(code) {
    const attempts = [
      () => apiPost("/api/tournaments/lookup-by-code", { code }),
      () => apiPost("/api/tournaments/validate-code", { code }),
    ];

    for (const attempt of attempts) {
      const r = await attempt();
      if (!r.ok) continue;
      if (r.data?.tournament) return r.data.tournament;
      if (r.data?.tournamentId) {
        const meta = await apiGet(`/api/tournaments/${encodeURIComponent(r.data.tournamentId)}`);
        if (meta.ok) return meta.data;
      }
    }
    return null;
  }

  async function joinTournamentNow(tournament, codeOverride = "") {
    const tournamentId = String(tournament?.tournamentId || tournament?.id || "").trim();
    if (!tournamentId) {
      alert("Tournament not found.");
      return;
    }

    const payload = {
      tournamentId,
      playerName: user?.name || user?.username || "",
      username: user?.username || "",
      accessCode: String(codeOverride || "").trim(),
    };

    if (!isTeamEvent(tournament)) {
      const categoryId = getPreferredCategoryId(tournament);
      if (!categoryId) {
        alert("No category found for this tournament.");
        return;
      }
      payload.categoryId = categoryId;
    }

    const candidates = [
      `/api/player/tournaments/${encodeURIComponent(tournamentId)}/register`,
      `/api/tournaments/${encodeURIComponent(tournamentId)}/join`,
    ];

    let lastError = null;
    for (const url of candidates) {
      const r = await apiPost(url, payload);
      if (r.ok) {
        await loadMyTournaments();
        renderMyJoinedList();
        switchView("my");
        alert("Joined tournament successfully.");
        return;
      }
      lastError = r.data?.message || `Failed with ${r.status}`;
    }

    alert(lastError || "Could not join tournament.");
  }

  async function leaveTournamentNow(tournament) {
    const tournamentId = String(tournament?.tournamentId || tournament?.id || "").trim();
    if (!tournamentId) return;

    const candidates = [
      `/api/player/tournaments/${encodeURIComponent(tournamentId)}/leave`,
      `/api/player/tournaments/${encodeURIComponent(tournamentId)}/register`,
      `/api/tournaments/${encodeURIComponent(tournamentId)}/leave`,
    ];

    for (const url of candidates) {
      const method = url.endsWith("/register") ? "DELETE" : "POST";
      const r = await apiJson(url, { method });
      if (r.ok) {
        await loadMyTournaments();
        renderMyJoinedList();
        return;
      }
    }

    alert("Could not leave tournament.");
  }

  async function updateInviteStatus(request, status) {
    const tournamentId = String(request?.tournamentId || request?.id || "").trim();
    const requestId = String(request?.requestId || request?.teamRequestId || request?.id || "").trim();
    if (!tournamentId || !requestId) {
      alert("Invite data is incomplete.");
      return;
    }

    const candidates = [
      `/api/player/team-requests/${encodeURIComponent(tournamentId)}/${encodeURIComponent(requestId)}`,
      `/api/player/tournaments/${encodeURIComponent(tournamentId)}/team-requests/${encodeURIComponent(requestId)}`,
    ];

    let ok = false;
    for (const url of candidates) {
      const r = await apiPatch(url, { status });
      if (r.ok) {
        ok = true;
        break;
      }
    }

    if (!ok) {
      alert(`Could not ${status} invite.`);
      return;
    }

    await loadTeamInvites();
    await loadNotifications();
    await loadMyTournaments();
    renderNotifications();
    renderTeamInvites();
    renderMyJoinedList();
  }

  function renderBrowseList() {
    if (!browseList) return;
    browseList.innerHTML = "";

    if (!allTournaments.length) {
      browseList.innerHTML = `
        <div class="empty-state">
          <h3>No tournaments available</h3>
          <p class="muted">Once hosts create tournaments, they will appear here.</p>
        </div>
      `;
      return;
    }

    allTournaments.forEach((tournament) => {
      const tournamentId = tournament?.tournamentId || tournament?.id;
      const categories = normalizeCategories(tournament?.categories);
      const categoryMeta = categories.map((c) => `<div class="muted">${escapeHtml(categoryLabel(c))}</div>`).join("");
      const isPrivate = tournament?.isPublic === false || tournament?.accessCodeRequired === true;
      const card = document.createElement("div");
      card.className = "browse-card";
      card.innerHTML = `
        <div class="browse-card-top">
          <div>
            <p class="eyebrow">${escapeHtml(tournament?.sportName || "Tournament")}</p>
            <h3>${escapeHtml(tournament?.tournamentName || "Untitled tournament")}</h3>
          </div>
          <div class="status-pill ${tournament?.registrationsOpen === false ? "status-pill--rejected" : "status-pill--accepted"}">
            ${tournament?.registrationsOpen === false ? "Closed" : (isPrivate ? "Private" : "Public")}
          </div>
        </div>
        <p class="muted">${escapeHtml(tournament?.tournamentDates || "")}</p>
        <p class="muted">${escapeHtml(tournament?.venue || "")}</p>
        <div style="margin-top:10px;">${isTeamEvent(tournament) ? '<div class="muted">Team event</div>' : categoryMeta || '<div class="muted">No categories listed</div>'}</div>
        <div class="browse-actions">
          <button type="button" class="btn-dark" data-action="schedule">View schedule</button>
          <button type="button" class="btn-primary" data-action="join" ${tournament?.registrationsOpen === false ? "disabled" : ""}>Join tournament</button>
        </div>
      `;

      card.querySelector('[data-action="schedule"]')?.addEventListener("click", () => {
        window.location.href = `schedule.html?tournamentId=${encodeURIComponent(tournamentId)}`;
      });

      card.querySelector('[data-action="join"]')?.addEventListener("click", async () => {
        if (isPrivate) {
          const entered = prompt("Enter tournament code");
          if (!entered) return;
          await joinTournamentNow(tournament, entered);
          return;
        }
        await joinTournamentNow(tournament);
      });

      browseList.appendChild(card);
    });
  }

  function renderMyJoinedList() {
    if (!myJoinedList) return;
    myJoinedList.innerHTML = "";

    if (!myJoinedTournaments.length) {
      myJoinedList.innerHTML = `
        <div class="empty-state">
          <h3>No joined tournaments yet</h3>
          <p class="muted">Tournaments you join will appear here.</p>
        </div>
      `;
      return;
    }

        myJoinedTournaments.forEach((tournament) => {
          const tournamentId = tournament?.tournamentId || tournament?.id;
          const myTeams = Array.isArray(tournament?.myTeams) ? tournament.myTeams : [];
          const hasTeam = myTeams.length > 0;
          const teamButtonText = hasTeam ? "View my team" : "View / Create my team";
          const canGoToScoring = isTournamentUmpire(tournament);

          const card = document.createElement("div");
          card.className = "browse-card";
          card.innerHTML = `
            <div class="browse-card-top">
              <div>
                <p class="eyebrow">${escapeHtml(tournament?.sportName || "Tournament")}</p>
                <h3>${escapeHtml(tournament?.tournamentName || "Untitled tournament")}</h3>
              </div>
              <div class="code-chip">${escapeHtml(tournament?.accessCode || (tournament?.isPublic === false ? "Private" : "Public"))}</div>
            </div>
            <p class="muted">${escapeHtml(tournament?.tournamentDates || "")}</p>
            <p class="muted">${escapeHtml(tournament?.venue || "")}</p>
            <div class="browse-actions">
              <button type="button" class="btn-dark" data-action="schedule">View schedule</button>
              <button type="button" class="btn-dark" data-action="team">${teamButtonText}</button>
              ${
                canGoToScoring
                  ? `<button type="button" class="btn-primary" data-action="scoring">Go to scoring</button>`
                  : ""
              }
              <button type="button" class="btn-secondary danger-btn" data-action="leave">Leave tournament</button>
            </div>
          `;

          card.querySelector('[data-action="schedule"]')?.addEventListener("click", () => {
            window.location.href = `schedule.html?tournamentId=${encodeURIComponent(tournamentId)}`;
          });

          card.querySelector('[data-action="team"]')?.addEventListener("click", () => {
            window.location.href = `team.html?tournamentId=${encodeURIComponent(tournamentId)}`;
          });

          card.querySelector('[data-action="scoring"]')?.addEventListener("click", () => {
            window.location.href = `players.html?tournamentId=${encodeURIComponent(tournamentId)}&from=join`;
          });

          card.querySelector('[data-action="leave"]')?.addEventListener("click", async () => {
            if (!confirm("Leave this tournament?")) return;
            await leaveTournamentNow(tournament);
          });

          myJoinedList.appendChild(card);
        });
  }

  function renderNotifications() {
    if (!notificationsList) return;
    notificationsList.innerHTML = "";

    if (!myNotifications.length) {
      notificationsList.innerHTML = `
        <div class="empty-state">
          <h3>No notifications yet</h3>
          <p class="muted">Updates about teams and tournaments will appear here.</p>
        </div>
      `;
      return;
    }

    myNotifications.forEach((item) => {
      const card = document.createElement("div");
      card.className = "browse-card";
      card.innerHTML = `
        <p class="eyebrow">${escapeHtml(item.kind.replaceAll("_", " "))}</p>
        <h3>${escapeHtml(item.title)}</h3>
        <p class="muted">${escapeHtml(item.body)}</p>
      `;
      notificationsList.appendChild(card);
    });
  }

  function renderTeamInvites() {
    if (!teamInviteSection || !teamInviteList) return;
    teamInviteList.innerHTML = "";

    if (!myTeamInvites.length) {
      teamInviteSection.classList.add("hidden");
      return;
    }

    teamInviteSection.classList.remove("hidden");

    myTeamInvites.forEach((request) => {
      const invite = getVisibleInviteForRequest(request);
      const currentStatus = String(invite?.inviteStatus || "pending").toLowerCase();
      const requestId = request?.requestId || request?.teamRequestId || request?.id;
      const tournamentId = request?.tournamentId || "";

      const card = document.createElement("div");
      card.className = "browse-card";
      card.innerHTML = `
        <div class="browse-card-top">
          <div>
            <p class="eyebrow">Team invite</p>
            <h3>${escapeHtml(request?.teamName || "Team")}</h3>
          </div>
          <div class="status-pill ${currentStatus === "accepted" ? "status-pill--accepted" : currentStatus === "rejected" ? "status-pill--rejected" : "status-pill--pending"}">
            ${escapeHtml(currentStatus)}
          </div>
        </div>
        <p class="muted">Captain: ${escapeHtml(request?.captainName || "-")}</p>
        <p class="muted">Tournament: ${escapeHtml(request?.tournamentName || "-")}</p>
        <p class="muted">Request ID: ${escapeHtml(requestId || "-")}</p>
        <div class="browse-actions">
          ${currentStatus === "pending"
            ? `
              <button type="button" class="btn-primary" data-action="accept">Accept</button>
              <button type="button" class="btn-dark" data-action="reject">Reject</button>
            `
            : `
              <button type="button" class="btn-dark" data-action="team">View my team</button>
            `}
        </div>
      `;

      card.querySelector('[data-action="team"]')?.addEventListener("click", () => {
        window.location.href = `team.html?tournamentId=${encodeURIComponent(tournamentId)}`;
      });
      card.querySelector('[data-action="accept"]')?.addEventListener("click", async () => updateInviteStatus(request, "accepted"));
      card.querySelector('[data-action="reject"]')?.addEventListener("click", async () => updateInviteStatus(request, "rejected"));
      teamInviteList.appendChild(card);
    });
  }

  if (trigger) {
    const label = String(user?.name || user?.username || user?.email || "U").trim();
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

  playerBtn?.classList.add("is-active");
  hostBtn?.classList.remove("is-active");

  playerBtn?.addEventListener("click", async () => {
    try {
      await fetch("/api/user/mode", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + getToken(),
        },
        body: JSON.stringify({ mode: "player" }),
      });
    } catch {}
  });

  hostBtn?.addEventListener("click", async () => {
    try {
      await fetch("/api/user/mode", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + getToken(),
        },
        body: JSON.stringify({ mode: "host" }),
      });
    } catch {}
    window.location.href = "host.html";
  });

  sidebarToggle?.addEventListener("click", () => {
    sidebar?.classList.toggle("is-collapsed");
  });

  document.querySelectorAll(".join-nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  joinCodeBtn?.addEventListener("click", async () => {
    const code = String(joinCodeInput?.value || "").trim();
    if (!code) {
      alert("Enter a tournament code.");
      return;
    }

    const tournament = await lookupTournamentByCode(code);
    if (!tournament) {
      alert("No tournament found for this code.");
      return;
    }

    await joinTournamentNow(tournament, code);
  });

  await Promise.all([
    loadBrowseTournaments(),
    loadMyTournaments(),
    loadTeamInvites(),
  ]);
  await loadNotifications();

  renderBrowseList();
  renderMyJoinedList();
  renderNotifications();
  renderTeamInvites();

  const queryTournamentId = new URLSearchParams(window.location.search).get("tournamentId");
  if (queryTournamentId) switchView("browse");
  else switchView("browse");
});
