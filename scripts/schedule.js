// Read-only schedule view for players

document.addEventListener("DOMContentLoaded", () => {
  // --- Top bar elements ---
  const usernameLabel = document.getElementById("username-label");
  const signoutBtn = document.getElementById("signout-btn");
  const userMenuTrigger = document.getElementById("user-menu-trigger");
  const userMenuDropdown = document.getElementById("user-menu-dropdown");
  const switchHostModeBtn = document.getElementById("switch-host-mode");

  const TOURNAMENT_KEY = "scheduleitTournaments";

  // --- Header elements ---
  const backToJoinBtn = document.getElementById("back-to-join");
  const titleEl = document.getElementById("schedule-tournament-name");
  const metaEl = document.getElementById("schedule-tournament-meta");

  // --- Schedule table elements ---
  const emptyEl = document.getElementById("schedule-empty-state");
  const tableWrapperEl = document.getElementById("schedule-table-wrapper");
  const tableBodyEl = document.getElementById("schedule-table-body");

  // ===== Auth =====

  const storedUsername =
    localStorage.getItem("scheduleItUser") ||
    localStorage.getItem("scheduleitUser");

  if (!storedUsername) {
    window.location.href = "index.html";
    return;
  }

  if (usernameLabel) {
    usernameLabel.textContent = storedUsername;
  }

  // ===== User menu =====

  function setupUserMenu(trigger, dropdown) {
    if (!trigger || !dropdown) return;

    const userMenu = document.querySelector(".user-menu");

    const closeDropdown = () => {
      dropdown.classList.remove("show");
      if (userMenu) {
        userMenu.classList.remove("user-menu--open");
      }
    };

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdown.classList.toggle("show");
      if (userMenu) {
        userMenu.classList.toggle("user-menu--open");
      }
    });

    document.addEventListener("click", (e) => {
      if (
        !dropdown.contains(e.target) &&
        !trigger.contains(e.target) &&
        dropdown.classList.contains("show")
      ) {
        closeDropdown();
      }
    });
  }

  setupUserMenu(userMenuTrigger, userMenuDropdown);

  // ===== Sign out =====
  if (signoutBtn) {
    signoutBtn.addEventListener("click", () => {
      localStorage.removeItem("scheduleItUser");
      localStorage.removeItem("scheduleitUser");
      window.location.href = "index.html";
    });
  }

  // ===== Switch to host mode =====
  if (switchHostModeBtn) {
    switchHostModeBtn.addEventListener("click", () => {
      window.location.href = "host.html";
    });
  }

  // ===== Back button =====

  if (backToJoinBtn) {
    backToJoinBtn.addEventListener("click", () => {
      window.location.href = "join.html";
    });
  }

  // ===== LocalStorage helpers =====

  function loadAllTournaments() {
    const raw = localStorage.getItem(TOURNAMENT_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error("Failed to parse tournaments", err);
      return [];
    }
  }

  // ===== Load selected tournament =====

  const selectedId = localStorage.getItem("scheduleitSelectedTournamentId");

  if (!selectedId) {
    alert("No tournament selected. Returning to tournaments list.");
    window.location.href = "join.html";
    return;
  }

  const allTournaments = loadAllTournaments();

  // Debug log so you can SEE what schedule.js is doing
  console.log("SCHEDULE DEBUG → selectedId:", selectedId, "type:", typeof selectedId);
  console.log(
    "SCHEDULE DEBUG → Summary:",
    allTournaments.map((t) => ({
      id: t && t.id,
      idType: t && typeof t.id,
      name: t && t.tournamentName,
      fixturesCount: t && Array.isArray(t.fixtures) ? t.fixtures.length : 0,
    }))
  );

  // 🔴 THIS is the critical line: use String() comparison
  const tournament = allTournaments.find(
    (t) => t && String(t.id) === String(selectedId)
  );

  console.log("SCHEDULE DEBUG → Tournament found in schedule.js:", tournament);

  if (!tournament) {
    alert(
      "This tournament could not be found. It may have been removed by the host."
    );
    window.location.href = "join.html";
    return;
  }

  // ===== Fill header =====

  if (titleEl) {
    titleEl.textContent =
      tournament.tournamentName || "Unnamed tournament";
  }

  if (metaEl) {
    const sport = tournament.sportName || "Sport not specified";
    const date =
      tournament.tournamentDates ||
      tournament.tournamentDate ||
      "Dates TBC";
    const isClosed = !!tournament.registrationsClosed;
    const regStatus = isClosed ? "Registrations closed" : "Registrations open";

    metaEl.textContent = `${sport} • ${date} • ${regStatus}`;
  }

  // ===== Render schedule =====

  const rawSchedule =
    (Array.isArray(tournament.schedule) && tournament.schedule) ||
    (Array.isArray(tournament.matches) && tournament.matches) ||
    (Array.isArray(tournament.fixtures) && tournament.fixtures) ||
    [];

  if (!rawSchedule.length) {
    if (emptyEl) emptyEl.style.display = "block";
    if (tableWrapperEl) tableWrapperEl.style.display = "none";
    return;
  }

  if (emptyEl) emptyEl.style.display = "none";
  if (tableWrapperEl) tableWrapperEl.style.display = "block";

  if (!tableBodyEl) return;

  rawSchedule.forEach((match, index) => {
    const tr = document.createElement("tr");

    const round =
      match.round || match.stage || match.phase || "";
    const matchLabel =
      match.matchLabel ||
      (match.matchNumber != null
        ? `Match ${match.matchNumber}`
        : `Match ${index + 1}`);

    const playerA =
      match.playerA ||
      match.player1 ||
      match.homePlayer ||
      match.home ||
      match.player1Name ||
      "";
    const playerB =
      match.playerB ||
      match.player2 ||
      match.awayPlayer ||
      match.away ||
      match.player2Name ||
      "";

    const score =
      match.score ||
      (match.score1 != null || match.score2 != null
        ? `${match.score1 ?? ""}-${match.score2 ?? ""}`
        : "") ||
      (match.homeScore != null || match.awayScore != null
        ? `${match.homeScore ?? ""}-${match.awayScore ?? ""}`
        : "");

    const court = match.court || match.venue || match.location || "";
    const time =
      match.time ||
      match.startTime ||
      (match.dateTime
        ? new Date(match.dateTime).toLocaleString()
        : "");

    tr.innerHTML = `
      <td>${round || "-"}</td>
      <td>${matchLabel}</td>
      <td>${playerA || "-"}</td>
      <td>${playerB || "-"}</td>
      <td>${score || "-"}</td>
      <td>${court || "-"}</td>
      <td>${time || "-"}</td>
    `;

    tableBodyEl.appendChild(tr);
  });
});
