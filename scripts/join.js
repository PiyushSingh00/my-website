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
          Authorization: "Bearer " + (localStorage.getItem("token") || ""),
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
          Authorization: "Bearer " + (localStorage.getItem("token") || ""),
        },
        body: JSON.stringify({ mode: "host" }),
      });
    } catch {}

    window.location.href = "host.html";
  });

  sidebarToggle?.addEventListener("click", () => {
    sidebar?.classList.toggle("is-collapsed");
  });

  function switchView(view) {
    document.querySelectorAll(".join-nav-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === view);
    });

    browseView.classList.toggle("join-view--active", view === "browse");
    myView.classList.toggle("join-view--active", view === "my");
    notificationsView.classList.toggle("join-view--active", view === "notifications");
  }

  document.querySelectorAll(".join-nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeIdentity(value) {
    return String(value || "").trim().toLowerCase();
  }

  function isSameUserByInviteFields(invite, currentUser) {
    return (
      (invite?.inviteeUsername &&
        normalizeIdentity(invite.inviteeUsername) === normalizeIdentity(currentUser?.username)) ||
      (invite?.inviteeName &&
        normalizeIdentity(invite.inviteeName) === normalizeIdentity(currentUser?.name)) ||
      (invite?.inviteeName &&
        normalizeIdentity(invite.inviteeName) === normalizeIdentity(currentUser?.username))
    );
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

  function normalizeTournamentList(raw) {
    if (Array.isArray(raw)) return raw;
    if (!raw || typeof raw !== "object") return [];
    if (Array.isArray(raw.data)) return raw.data;
    if (Array.isArray(raw.items)) return raw.items;
    if (Array.isArray(raw.tournaments)) return raw.tournaments;
    return [];
  }

  async function loadBrowseTournaments() {
    const r = await apiGet("/api/tournaments");
    allTournaments = r.ok ? normalizeTournamentList(r.data) : [];
  }

  async function loadMyTournaments() {
    const candidates = [
      `/api/player/tournaments`,
      `/api/tournaments/mine`,
    ];

    for (const url of candidates) {
      const r = await apiGet(url);
      if (!r.ok) continue;

      const rows = normalizeTournamentList(r.data);
      if (rows.length || Array.isArray(rows)) {
        myJoinedTournaments = rows;
        return;
      }
    }

    myJoinedTournaments = [];
  }

  async function loadTeamInvites() {
    const candidates = [
      `/api/player/team-requests`,
      `/api/team-requests`,
    ];

    let requests = [];

    for (const url of candidates) {
      const r = await apiGet(url);
      if (!r.ok) continue;

      requests = Array.isArray(r.data)
        ? r.data
        : Array.isArray(r.data?.items)
          ? r.data.items
          : Array.isArray(r.data?.requests)
            ? r.data.requests
            : Array.isArray(r.data?.data)
              ? r.data.data
              : [];

      if (requests.length || Array.isArray(requests)) break;
    }

    myTeamInvites = requests.filter((req) => {
      const invitedPlayers = Array.isArray(req?.invitedPlayers) ? req.invitedPlayers : [];
      return invitedPlayers.some((invite) => isSameUserByInviteFields(invite, user));
    });
  }

  async function loadNotifications() {
    myNotifications = [];

    myTeamInvites.forEach((invite) => {
      myNotifications.push({
        kind: "team_invite",
        title: `Team invite from ${invite?.captainName || "Captain"}`,
        body: `${invite?.teamName || "A team"} • ${invite?.tournamentName || "Tournament"}`,
      });
    });
  }

  function renderBrowseList() {
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

  allTournaments.forEach((t) => {
    const tournamentId = t.tournamentId ?? t.id;

    const categories = Array.isArray(t.categories)
      ? t.categories
      : (() => {
          try {
            return typeof t.categories === "string" ? JSON.parse(t.categories) : [];
          } catch {
            return [];
          }
        })();

    const categoryOptions = categories
      .map((c) => {
        const id = c.categoryId || c.id || "";
        if (!id) return "";
        const label = [
          c.eventName || "",
          c.ageGroup || "",
          c.gender || "",
          c.playingLevel || "",
          c.teamSize === 1 ? "Singles" :
          c.teamSize === 2 ? "Doubles" :
          c.teamSize === 3 ? "Triples" :
          c.teamSize >= 4 ? `Team ${c.exactTeamSize || ""}`.trim() : ""
        ].filter(Boolean).join(" • ");
        return `<option value="${escapeHtml(id)}">${escapeHtml(label || id)}</option>`;
      })
      .filter(Boolean)
      .join("");

    const card = document.createElement("div");
    card.className = "browse-card";
    card.innerHTML = `
      <div class="browse-card-top">
        <div>
          <p class="eyebrow">${escapeHtml(t.sportName || "Tournament")}</p>
          <h3>${escapeHtml(t.tournamentName || "Untitled tournament")}</h3>
        </div>
      </div>

      <p class="muted">${escapeHtml(t.tournamentDates || "")}</p>
      <p class="muted">${escapeHtml(t.venue || "")}</p>

      <div class="field-group" style="margin-top:10px;">
        <label>Select category</label>
        <select class="join-category-select">
          <option value="">Select category</option>
          ${categoryOptions}
        </select>
      </div>

      <div class="browse-actions">
        <button type="button" class="btn-dark" data-action="schedule">View schedule</button>
        <button type="button" class="btn-primary" data-action="join">Join tournament</button>
      </div>
    `;

    card.querySelector('[data-action="schedule"]')?.addEventListener("click", () => {
      window.location.href = `schedule.html?tournamentId=${encodeURIComponent(tournamentId)}`;
    });

    card.querySelector('[data-action="join"]')?.addEventListener("click", async () => {
      const selectedCategoryId = card.querySelector(".join-category-select")?.value || "";
      if (!selectedCategoryId) {
        alert("Please select a category first.");
        return;
      }

      const validateBody = {
        tournamentId,
        code: t.accessCode || "",
        accessCode: t.accessCode || "",
      };

      const validateCandidates = [
        `/api/tournaments/validate-code`,
        `/api/tournaments/${encodeURIComponent(tournamentId)}/validate-code`,
      ];

      let validated = false;
      for (const url of validateCandidates) {
        const r = await apiPost(url, validateBody);
        if (r.ok) {
          validated = true;
          break;
        }
      }

      if (!validated) {
        alert("Could not validate join code for this tournament.");
        return;
      }

      const registerPayload = {
        categoryId: selectedCategoryId,
        playerName: user.name || user.username || "",
        phone: user.phone || "",
        age: user.age || "",
        gender: user.gender || "",
        teamName: "",
      };

      const registerCandidates = [
        `/api/player/tournaments/${encodeURIComponent(tournamentId)}/register`,
        `/api/tournaments/${encodeURIComponent(tournamentId)}/join`,
      ];

      for (const url of registerCandidates) {
        const r = await apiPost(url, registerPayload);
        if (r.ok) {
          alert("Joined tournament successfully.");
          await loadMyTournaments();
          renderMyJoinedList();
          return;
        }
      }

      alert("Could not join tournament. Check backend registration route.");
    });

    browseList.appendChild(card);
  });
}

  function renderMyJoinedList() {
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

    myJoinedTournaments.forEach((t) => {
      const card = document.createElement("div");
      card.className = "browse-card";
      card.innerHTML = `
        <div class="browse-card-top">
          <div>
            <p class="eyebrow">${escapeHtml(t.sportName || "Tournament")}</p>
            <h3>${escapeHtml(t.tournamentName || "Untitled tournament")}</h3>
          </div>
          <div class="code-chip">${escapeHtml(t.accessCode || "—")}</div>
        </div>

        <p class="muted">${escapeHtml(t.tournamentDates || "")}</p>
        <p class="muted">${escapeHtml(t.venue || "")}</p>

        <div class="browse-actions">
          <button type="button" class="btn-dark" data-action="schedule">View schedule</button>
          <button type="button" class="btn-dark" data-action="team">View / Create my team</button>
          <button type="button" class="btn-secondary danger-btn" data-action="leave">Leave tournament</button>
        </div>
      `;

      card.querySelector('[data-action="schedule"]')?.addEventListener("click", () => {
        window.location.href = `schedule.html?tournamentId=${encodeURIComponent(t.tournamentId ?? t.id)}`;
      });

      card.querySelector('[data-action="team"]')?.addEventListener("click", () => {
        window.location.href = `team.html?tournamentId=${encodeURIComponent(t.tournamentId ?? t.id)}`;
      });

      card.querySelector('[data-action="leave"]')?.addEventListener("click", async () => {
        const ok = confirm("Leave this tournament?");
        if (!ok) return;

        const candidates = [
          `/api/player/tournaments/${encodeURIComponent(t.tournamentId ?? t.id)}/leave`,
          `/api/tournaments/${encodeURIComponent(t.tournamentId ?? t.id)}/leave`,
        ];

        for (const url of candidates) {
          const r = await apiPost(url, {});
          if (r.ok) {
            await loadMyTournaments();
            renderMyJoinedList();
            return;
          }
        }

        alert("Could not leave tournament.");
      });

      myJoinedList.appendChild(card);
    });
  }

  function renderNotifications() {
    notificationsList.innerHTML = "";

    if (!myNotifications.length) {
      notificationsList.innerHTML = `
        <div class="empty-state">
          <h3>No notifications yet</h3>
          <p class="muted">Updates about teams and tournaments will appear here.</p>
        </div>
      `;
    } else {
      myNotifications.forEach((n) => {
        const card = document.createElement("div");
        card.className = "browse-card";
        card.innerHTML = `
          <p class="eyebrow">${escapeHtml(n.kind.replaceAll("_", " "))}</p>
          <h3>${escapeHtml(n.title)}</h3>
          <p class="muted">${escapeHtml(n.body)}</p>
        `;
        notificationsList.appendChild(card);
      });
    }
  }

  function renderTeamInvites() {
    teamInviteList.innerHTML = "";

    if (!myTeamInvites.length) {
      teamInviteSection.classList.add("hidden");
      return;
    }

    teamInviteSection.classList.remove("hidden");

    myTeamInvites.forEach((req) => {
      const invite = (Array.isArray(req.invitedPlayers) ? req.invitedPlayers : []).find((p) =>
        isSameUserByInviteFields(p, user)
      );

      const currentStatus = invite?.inviteStatus || "pending";

      const card = document.createElement("div");
      card.className = "browse-card";
      card.innerHTML = `
        <div class="browse-card-top">
          <div>
            <p class="eyebrow">Team invite</p>
            <h3>${escapeHtml(req.teamName || "Team")}</h3>
          </div>
          <div class="status-pill ${
            currentStatus === "accepted"
              ? "status-pill--accepted"
              : currentStatus === "rejected"
                ? "status-pill--rejected"
                : "status-pill--pending"
          }">${escapeHtml(currentStatus)}</div>
        </div>

        <p class="muted">Captain: ${escapeHtml(req.captainName || "-")}</p>
        <p class="muted">Tournament: ${escapeHtml(req.tournamentName || "-")}</p>
        <p class="muted">Category: ${escapeHtml(req.categoryLabel || "-")}</p>

        <div class="browse-actions">
          ${
            currentStatus === "pending"
              ? `
            <button type="button" class="btn-primary" data-action="accept">Accept</button>
            <button type="button" class="btn-dark" data-action="reject">Reject</button>
          `
              : `
            <button type="button" class="btn-dark" data-action="team">View my team</button>
          `
          }
        </div>
      `;

      card.querySelector('[data-action="team"]')?.addEventListener("click", () => {
        window.location.href = `team.html?tournamentId=${encodeURIComponent(req.tournamentId || req.id || "")}`;
      });

      card.querySelector('[data-action="accept"]')?.addEventListener("click", async () => {
        await updateInviteStatus(req, "accepted");
      });

      card.querySelector('[data-action="reject"]')?.addEventListener("click", async () => {
        await updateInviteStatus(req, "rejected");
      });

      teamInviteList.appendChild(card);
    });
  }

  async function updateInviteStatus(request, status) {
  const invite = (Array.isArray(request?.invitedPlayers) ? request.invitedPlayers : []).find((p) =>
    isSameUserByInviteFields(p, user)
  );

  if (!invite?.playerId) {
    alert("Could not identify invited player record.");
    return;
  }

  const r = await apiPost(
    `/api/host/tournaments/${encodeURIComponent(request.tournamentId)}/team-requests/${encodeURIComponent(request.requestId || request.teamRequestId || request.id)}`,
    null
  );

  // fallback because apiPost always POST, but this endpoint is PATCH
  const patchRes = await apiJson(
    `/api/host/tournaments/${encodeURIComponent(request.tournamentId)}/team-requests/${encodeURIComponent(request.requestId || request.teamRequestId || request.id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerId: invite.playerId,
        status,
      }),
    }
  );

  if (!patchRes.ok) {
    alert(`Could not ${status} invite.`);
    return;
  }

  await loadTeamInvites();
  await loadNotifications();
  renderNotifications();
  renderTeamInvites();
  await loadMyTournaments();
  renderMyJoinedList();
}

  joinCodeBtn?.addEventListener("click", async () => {
    const code = joinCodeInput.value.trim();
    if (!code) {
      alert("Enter a tournament code.");
      return;
    }

    const validateCandidates = [
      `/api/tournaments/validate-code`,
      `/api/player/validate-code`,
    ];

    let validatedTournament = null;

    for (const url of validateCandidates) {
      const r = await apiPost(url, { code });
      if (!r.ok) continue;

      validatedTournament =
        r.data?.tournament ||
        r.data?.data?.tournament ||
        r.data?.data ||
        r.data;

      if (validatedTournament) break;
    }

    if (!validatedTournament) {
      alert("Invalid code or tournament not found.");
      return;
    }

    const registerPayload = {
      tournamentId: validatedTournament.tournamentId || validatedTournament.id,
      code,
      playerName: user.name || user.username || "",
      username: user.username || "",
    };

    const registerCandidates = [
      `/api/player/tournaments/${encodeURIComponent(validatedTournament.tournamentId || validatedTournament.id)}/register`,
      `/api/tournaments/${encodeURIComponent(validatedTournament.tournamentId || validatedTournament.id)}/join`,
    ];

    for (const url of registerCandidates) {
      const r = await apiPost(url, registerPayload);
      if (r.ok) {
        alert("Joined tournament successfully.");
        joinCodeInput.value = "";
        await loadMyTournaments();
        renderMyJoinedList();
        switchView("my");
        return;
      }
    }

    alert("Could not join tournament with this code.");
  });

  const queryTournamentId = new URLSearchParams(window.location.search).get("tournamentId");
  if (queryTournamentId) {
    switchView("browse");
  }

  await loadBrowseTournaments();
  await loadMyTournaments();
  await loadTeamInvites();
  await loadNotifications();

  renderBrowseList();
  renderMyJoinedList();
  renderNotifications();
  renderTeamInvites();
});