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

  // --- Schedule elements ---
  const emptyEl = document.getElementById("schedule-empty");
  const tableWrapperEl = document.getElementById("schedule-table-wrapper");
  const tableBodyEl = document.getElementById("schedule-table-body");

  // ===== Auth: ensure user is signed in =====

  const storedUsername = localStorage.getItem("scheduleItUser");

  if (!storedUsername) {
    window.location.href = "index.html";
    return;
  }

  if (usernameLabel) {
    usernameLabel.textContent = storedUsername;
  }

  // ===== Sign out =====

  if (signoutBtn) {
    signoutBtn.addEventListener("click", () => {
      localStorage.removeItem("scheduleItUser");
      localStorage.removeItem("scheduleitUser");
      window.location.href = "index.html";
    });
  }

  // ===== User menu dropdown =====

  if (userMenuTrigger && userMenuDropdown) {
    const closeDropdown = () => {
      userMenuDropdown.classList.remove("is-open");
    };

    const toggleDropdown = () => {
      userMenuDropdown.classList.toggle("is-open");
    };

    userMenuTrigger.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleDropdown();
    });

    userMenuDropdown.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    document.addEventListener("click", () => {
      closeDropdown();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeDropdown();
      }
    });
  }

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
  const tournament = allTournaments.find((t) => t && t.id === selectedId);

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
      match.player1 ||
      match.team1 ||
      match.sideA ||
      match.playerA ||
      "";
    const playerB =
      match.player2 ||
      match.team2 ||
      match.sideB ||
      match.playerB ||
      "";

    const score =
      match.score ||
      match.scoreline ||
      (match.score1 != null || match.score2 != null
        ? `${match.score1 ?? ""} - ${match.score2 ?? ""}`
        : "");

    const court = match.court || match.venue || "";
    const time =
      match.time || match.startTime || match.slot || match.session || "";

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
