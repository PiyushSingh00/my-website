// Host mode page logic

document.addEventListener("DOMContentLoaded", () => {
  // --- Top bar & existing elements ---
  const usernameLabel = document.getElementById("username-label");
  const signoutBtn = document.getElementById("signout-btn");
  const generateCodeBtn = document.getElementById("generate-code-btn");
  const accessCodeInput = document.getElementById("access-code");
  const hostForm = document.getElementById("host-form");

  const userMenuTrigger = document.getElementById("host-user-menu-trigger");
  const userMenuDropdown = document.getElementById("host-user-menu-dropdown");
  const userMenu = document.querySelector(".user-menu");
  const switchPlayerModeBtn = document.getElementById("switch-player-mode");

  // Dashboard toggle + list elements
  const myTab = document.querySelector('[data-host-mode="my"]');
  const newTab = document.querySelector('[data-host-mode="new"]');
  const myView = document.getElementById("my-tournaments-view");
  const newView = document.getElementById("new-tournament-view");
  const myList = document.getElementById("my-tournaments-list");

  // NEW: details panel elements
  const detailSection = document.getElementById("tournament-detail");
  const detailName = document.getElementById("detail-tournament-name");
  const detailCode = document.getElementById("detail-tournament-code");
  const detailRegistrations = document.getElementById(
    "detail-total-registrations"
  );
  const stopRegistrationsBtn = document.getElementById(
    "stop-registrations-btn"
  );

  // --- Load username from localStorage (support both key names) ---
  const storedUsername =
    localStorage.getItem("scheduleitUser") ||
    localStorage.getItem("scheduleItUser");

    // ----- Tournament details modal -----
    const detailsModal = document.getElementById("tournament-details-modal");
    const detailsName = document.getElementById("modalTournamentName");
    const detailsCode = document.getElementById("modalTournamentCode");
    const detailsRegistrations = document.getElementById("modalTournamentRegistrations");
    const detailsStopBtn = document.getElementById("modalStopRegistrations");
    const detailsViewPlayersBtn = document.getElementById("modalViewPlayers");




    function openDetailsModal(tournament) {
        if (!detailsModal) return;

        if (detailsName) {
            detailsName.textContent = tournament.tournamentName || "Tournament";
        }
        if (detailsCode) {
            detailsCode.textContent = tournament.accessCode || "—";
        }
        if (detailsRegistrations) {
            detailsRegistrations.textContent =
            typeof tournament.totalRegistrations === "number"
                ? tournament.totalRegistrations
                : 0;
        }

        // Set Stop / Accept button based on current registration state
        const isClosed = !!tournament.registrationsClosed;

        if (detailsStopBtn) {
            detailsStopBtn.dataset.tournamentId = String(tournament.id);
            detailsStopBtn.textContent = isClosed
            ? "Accept registrations"
            : "Stop registrations";
            detailsStopBtn.classList.toggle("accept-mode", isClosed);
        }

        // NEW: show "View players" only when registrations are closed
        if (detailsViewPlayersBtn) {
            detailsViewPlayersBtn.dataset.tournamentId = String(tournament.id);
            detailsViewPlayersBtn.style.display = isClosed ? "inline-flex" : "none";
        }

        detailsModal.classList.add("is-visible");
        detailsModal.setAttribute("aria-hidden", "false");
    }




    function closeDetailsModal() {
        if (!detailsModal) return;
        detailsModal.classList.remove("is-visible");
        detailsModal.setAttribute("aria-hidden", "true");
    }

    // Close on X button
    if (detailsModal) {
        const closeBtn = detailsModal.querySelector(".modal-close");
        if (closeBtn) {
        closeBtn.addEventListener("click", closeDetailsModal);
        }

        // Close if user clicks on the dark background
        detailsModal.addEventListener("click", (event) => {
        if (event.target === detailsModal) {
            closeDetailsModal();
        }
        });
    }

    if (detailsStopBtn) {
        detailsStopBtn.addEventListener("click", () => {
            const id = Number(detailsStopBtn.dataset.tournamentId);
            if (!id) return;

            const all = loadAllTournaments();
            const idx = all.findIndex((t) => t.id === id);
            if (idx === -1) return;

            const t = all[idx];

            // Toggle closed/open
            const newClosed = !t.registrationsClosed;
            t.registrationsClosed = newClosed;

            // Save back to localStorage
            saveAllTournaments(all);

            // Update button text + style in the modal
            detailsStopBtn.textContent = newClosed
            ? "Accept registrations"
            : "Stop registrations";
            detailsStopBtn.classList.toggle("accept-mode", newClosed);

            // NEW: show / hide "View players" based on closed state
            if (detailsViewPlayersBtn) {
            detailsViewPlayersBtn.style.display = newClosed
                ? "inline-flex"
                : "none";
            }

            // 🔄 Refresh list so status text updates on the cards
            renderMyTournaments();
        });
    }

    // --- View players for this tournament ---
    if (detailsViewPlayersBtn) {
        detailsViewPlayersBtn.addEventListener("click", () => {
            const id = detailsViewPlayersBtn.dataset.tournamentId;
            if (!id) return;

            // Go to the players page, passing the tournament id in the URL
            window.location.href = `players.html?tournamentId=${encodeURIComponent(id)}`;
        });
    }


  if (!storedUsername) {
    // Not signed in -> go back to landing
    window.location.href = "index.html";
    return;
  }

  if (usernameLabel) {
    usernameLabel.textContent = storedUsername;
  }

  // --- User menu dropdown (click-only) ---

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
    // Click to toggle
    userMenuTrigger.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleDropdown();
    });

    // Close when clicking outside
    document.addEventListener("click", () => {
      closeDropdown();
    });

    // Prevent closing when clicking inside dropdown
    userMenuDropdown.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    // Close on Esc
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeDropdown();
      }
    });
  }

  // --- Switch to player mode (e.g. Join page) ---
  if (switchPlayerModeBtn) {
    switchPlayerModeBtn.addEventListener("click", () => {
      closeDropdown();
      window.location.href = "join.html";
    });
  }

  // --- Generate access code ---
  function generateCode() {
    const letters = "ABCDEFGHJKMNPQRSTUVWXYZ";
    const digits = "23456789";

    let part1 = "";
    let part2 = "";

    for (let i = 0; i < 4; i++) {
      part1 += letters[Math.floor(Math.random() * letters.length)];
      part2 += digits[Math.floor(Math.random() * digits.length)];
    }

    return `${part1}-${part2}`;
  }

  if (generateCodeBtn && accessCodeInput) {
    generateCodeBtn.addEventListener("click", () => {
      const code = generateCode();
      accessCodeInput.value = code;
      accessCodeInput.focus();
      accessCodeInput.select();
    });
  }

  // ===== Tournament storage + helpers ============================

  const TOURNAMENT_KEY = "scheduleitTournaments";

  function loadAllTournaments() {
    const raw = localStorage.getItem(TOURNAMENT_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.error("Failed to parse tournaments", e);
      return [];
    }
  }

  function saveAllTournaments(list) {
    localStorage.setItem(TOURNAMENT_KEY, JSON.stringify(list));
  }

  function saveTournament(tournament) {
    const list = loadAllTournaments();
    list.push(tournament);
    saveAllTournaments(list);
  }

  function setRegistrationsClosed(id) {
    const list = loadAllTournaments();
    const index = list.findIndex((t) => t.id === id);
    if (index === -1) return null;

    list[index].registrationsClosed = true;
    saveAllTournaments(list);
    return list[index];
  }

  // ===== My tournaments list + details ===========================

  function showTournamentDetails(tournament) {
    if (!detailSection) return;

    detailSection.classList.remove("hidden");

    if (detailName) {
      detailName.textContent =
        tournament.tournamentName || "Untitled tournament";
    }
    if (detailCode) {
      detailCode.textContent = tournament.accessCode || "";
    }
    if (detailRegistrations) {
      detailRegistrations.textContent =
        tournament.totalRegistrations ?? 0;
    }

    if (stopRegistrationsBtn) {
      const closed = !!tournament.registrationsClosed;
      stopRegistrationsBtn.disabled = closed;
      stopRegistrationsBtn.textContent = closed
        ? "Registrations stopped"
        : "Stop registrations";

      stopRegistrationsBtn.onclick = () => {
        if (closed) return;
        const updated = setRegistrationsClosed(tournament.id);
        if (updated) {
          renderMyTournaments();
          showTournamentDetails(updated);
        }
      };
    }
  }

  function renderMyTournaments() {
    if (!myList) return;

    const all = loadAllTournaments();
    const mine = all.filter((t) => t.hostUsername === storedUsername);

    if (!storedUsername) {
      myList.innerHTML = `
        <div class="empty-state">
          <div class="feature-icon">🔑</div>
          <h3>Sign in to see your tournaments</h3>
          <p class="muted">Once you are signed in and host tournaments, they will appear here.</p>
        </div>
      `;
      if (detailSection) detailSection.classList.add("hidden");
      return;
    }

    if (!mine.length) {
      myList.innerHTML = `
        <div class="empty-state">
          <div class="feature-icon">📋</div>
          <h3>No tournaments yet</h3>
          <p class="muted">Use "Host new tournament" to create your first tournament.</p>
        </div>
      `;
      if (detailSection) detailSection.classList.add("hidden");
      return;
    }

    myList.innerHTML = mine
      .map(
        (t, index) => `
        <article class="tournament-card" data-index="${index}">
          <header class="tournament-head">
            <div>
              <p class="eyebrow">${t.sportName || "Sport"}</p>
              <h3>${t.tournamentName || "Untitled tournament"}</h3>
            </div>
            <span class="code-chip">${t.accessCode || ""}</span>
          </header>

          <p class="muted">
            ${t.playerDetails || "Player details and fixtures will show here."}
          </p>

        <div class="tournament-meta">
            ${
                t.tournamentDates
                ? `<span>Dates: ${t.tournamentDates}</span>`
                : ""
            }
            <span>
            ${
                t.registrationsClosed
                ? "Registrations closed"
                : "Registrations open"
            }
            </span>
            <span>Total registrations: ${t.totalRegistrations ?? 0}</span>
        </div>

        </article>
      `
      )
      .join("");

    // Make each card clickable – open details popup
    myList.querySelectorAll(".tournament-card").forEach((card) => {
        const index = Number(card.dataset.index);
        const tournament = mine[index];
        if (!tournament) return;

        card.addEventListener("click", () => {
            openDetailsModal(tournament);
        });
    });

  }

  // ===== Host form behaviour =====================================

  if (hostForm) {
    hostForm.addEventListener("submit", (event) => {
      event.preventDefault();

      const formData = new FormData(hostForm);
      const data = Object.fromEntries(formData.entries());

      let tournamentName = (data.tournamentName || "").trim();
      let sportName = (data.sportName || "").trim();
      let tournamentDates =
        (data.tournamentDates || data.tournamentDate || "").trim();
      let accessCode = (data.accessCode || "").trim();
      const playerDetails = (data.playerDetails || "").trim();

      if (!tournamentName || !sportName || !tournamentDates) {
        alert(
          "Please fill tournament name, sport name and tournament dates."
        );
        return;
      }

      if (!accessCode) {
        accessCode = generateCode();
        if (accessCodeInput) accessCodeInput.value = accessCode;
      }

      const tournament = {
        id: Date.now(),
        hostUsername: storedUsername,
        tournamentName,
        sportName,
        tournamentDates,
        accessCode,
        playerDetails,
        createdAt: new Date().toISOString(),
        totalRegistrations: 0,
        registrationsClosed: false,
      };

      saveTournament(tournament);

      alert(
        `Tournament saved!\n\nShare this access code with players:\n${accessCode}`
      );

      hostForm.reset();
      if (accessCodeInput) {
        accessCodeInput.value = accessCode;
      }

      // Refresh list so new tournament appears
      renderMyTournaments();
    });
  }

  // --- Sign out ---
  if (signoutBtn) {
    signoutBtn.addEventListener("click", () => {
      localStorage.removeItem("scheduleitUser");
      localStorage.removeItem("scheduleItUser");
      window.location.href = "index.html";
    });
  }

  // ===== Tab switching logic =====================================

  function switchMode(mode) {
    if (!myTab || !newTab || !myView || !newView) return;

    if (mode === "my") {
      myTab.classList.add("active");
      newTab.classList.remove("active");

      myView.classList.add("host-view--active");
      newView.classList.remove("host-view--active");

      renderMyTournaments();
    } else {
      newTab.classList.add("active");
      myTab.classList.remove("active");

      newView.classList.add("host-view--active");
      myView.classList.remove("host-view--active");
    }
  }

  if (myTab && newTab) {
    myTab.addEventListener("click", () => switchMode("my"));
    newTab.addEventListener("click", () => switchMode("new"));
  }

  // Default view when entering host mode = My tournaments
  switchMode("my");
});
