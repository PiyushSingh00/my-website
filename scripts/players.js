// Tournament players page logic

document.addEventListener("DOMContentLoaded", () => {
  // --- Top bar & auth ---
  const usernameLabel = document.getElementById("username-label");
  const signoutBtn = document.getElementById("signout-btn");
  const userMenuTrigger = document.getElementById("host-user-menu-trigger");
  const userMenuDropdown = document.getElementById("host-user-menu-dropdown");
  const switchPlayerModeBtn = document.getElementById("switch-player-mode");
  const backBtn = document.getElementById("players-back-btn");
  const createFixturesBtn = document.getElementById("create-fixtures-btn");


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

  const closeDropdown = () => {
    if (userMenuDropdown) {
      userMenuDropdown.classList.remove("is-open");
    }
  };

  const toggleDropdown = () => {
    if (userMenuDropdown) {
      userMenuDropdown.classList.toggle("is-open");
    }
  };

  if (userMenuTrigger && userMenuDropdown) {
    userMenuTrigger.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleDropdown();
    });

    document.addEventListener("click", () => {
      closeDropdown();
    });
  }

  if (switchPlayerModeBtn) {
    switchPlayerModeBtn.addEventListener("click", () => {
      closeDropdown();
      window.location.href = "join.html";
    });
  }

  if (signoutBtn) {
    signoutBtn.addEventListener("click", () => {
      localStorage.removeItem("scheduleItUser");
      localStorage.removeItem("scheduleitUser");
      window.location.href = "index.html";
    });
  }

    // --- Back to host page ---
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      window.location.href = "host.html";
    });
  }

  // --- Tournament header elements ---
  const titleEl = document.getElementById("players-tournament-name");
  const sportEl = document.getElementById("players-tournament-sport");
  const datesEl = document.getElementById("players-tournament-dates");
  const codeEl = document.getElementById("players-tournament-code");

  // --- Players + UI elements ---
  const tabs = document.querySelectorAll(".players-tab");
  const allCountEl = document.getElementById("all-count");
  const maleCountEl = document.getElementById("male-count");
  const femaleCountEl = document.getElementById("female-count");
  const emptyStateEl = document.getElementById("players-empty-state");
  const tableWrapper = document.getElementById("players-table-wrapper");
  const tableBody = document.getElementById("players-table-body");

  const TOURNAMENT_KEY = "scheduleitTournaments";

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

  // --- Read tournament id from URL ---
  const params = new URLSearchParams(window.location.search);
  const idParam = params.get("tournamentId");

  const allTournaments = loadAllTournaments();
  const tournament = idParam
    ? allTournaments.find((t) => String(t.id) === String(idParam))
    : null;

  if (!tournament) {
    if (titleEl) titleEl.textContent = "No tournament selected";
    if (emptyStateEl) {
      const heading = emptyStateEl.querySelector("h3");
      const body = emptyStateEl.querySelector(".muted");
      if (heading) heading.textContent = "No tournament selected";
      if (body)
        body.textContent =
          "Open this page from the Host dashboard to see players.";
      emptyStateEl.style.display = "flex";
    }
    if (tableWrapper) {
      tableWrapper.style.display = "none";
    }
    return;
  }

    // --- Open fixtures page for this tournament ---
  if (createFixturesBtn && tournament) {
    createFixturesBtn.addEventListener("click", () => {
      const id = tournament.id;
      if (!id && id !== 0) return;

      window.location.href = `fixtures.html?tournamentId=${encodeURIComponent(
        id
      )}`;
    });
  }


  // --- Fill header with tournament info ---
  if (titleEl) {
    titleEl.textContent = tournament.tournamentName || "Tournament";
  }
  if (sportEl) {
    sportEl.textContent = tournament.sportName
      ? tournament.sportName
      : "";
  }
  if (datesEl) {
    datesEl.textContent = tournament.tournamentDates
      ? `• ${tournament.tournamentDates}`
      : "";
  }
  if (codeEl) {
    codeEl.textContent = tournament.accessCode || "—";
  }

  const players = Array.isArray(tournament.players) ? tournament.players : [];

  const totalCount = players.length;
  const maleCount = players.filter(
    (p) => (p.gender || "").toLowerCase() === "male"
  ).length;
  const femaleCount = players.filter(
    (p) => (p.gender || "").toLowerCase() === "female"
  ).length;

  if (allCountEl) allCountEl.textContent = String(totalCount);
  if (maleCountEl) maleCountEl.textContent = String(maleCount);
  if (femaleCountEl) femaleCountEl.textContent = String(femaleCount);

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderPlayers(filter) {
    if (!tableBody || !emptyStateEl || !tableWrapper) return;

    let filtered = players;
    const f = (filter || "all").toLowerCase();

    if (f === "male") {
      filtered = players.filter(
        (p) => (p.gender || "").toLowerCase() === "male"
      );
    } else if (f === "female") {
      filtered = players.filter(
        (p) => (p.gender || "").toLowerCase() === "female"
      );
    }

    if (!filtered.length) {
      tableWrapper.style.display = "none";
      emptyStateEl.style.display = "flex";
      return;
    }

    emptyStateEl.style.display = "none";
    tableWrapper.style.display = "block";

    tableBody.innerHTML = filtered
      .map((p) => {
        const name = p.name || "";
        const age = p.age || "";
        const gender = p.gender || "";
        return `
          <tr>
            <td>${escapeHtml(name)}</td>
            <td>${escapeHtml(age)}</td>
            <td>${escapeHtml(gender)}</td>
          </tr>
        `;
      })
      .join("");
  }

  // --- Tab switching ---
  if (tabs && tabs.length) {
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        const filter = tab.getAttribute("data-player-filter") || "all";
        renderPlayers(filter);
      });
    });
  }

  // Initial render
  renderPlayers("all");
});
