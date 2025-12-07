// Join page logic: show tournaments from all hosts + code + player registration + "My tournaments"

document.addEventListener("DOMContentLoaded", () => {
  // --- Top bar elements ---
  const usernameLabel = document.getElementById("username-label");
  const signoutBtn = document.getElementById("signout-btn");
  const userMenuTrigger = document.getElementById("user-menu-trigger");
  const userMenuDropdown = document.getElementById("user-menu-dropdown");
  const switchHostModeBtn = document.getElementById("switch-host-mode");

  // --- Tournament list & filter ---
  const tournamentListEl = document.getElementById("tournament-list");
  const sportFilterSelect = document.getElementById("sport-filter");
  const emptyStateEl = document.getElementById("empty-state");

  // --- My tournaments + tabs ---
  const myTournamentListEl = document.getElementById("my-tournament-list");
  const myEmptyStateEl = document.getElementById("my-empty-state");
  const tabButtons = document.querySelectorAll(".join-tab");
  const tabPanels = document.querySelectorAll(".tab-panel");

  // --- Tabs & header text ---
  const tabs = document.querySelectorAll("[data-tab]");
  const browserTitle = document.getElementById("browser-title");
  const browserSubtitle = document.getElementById("browser-subtitle");

  // --- Modals: code & player details ---
  const codeModal = document.getElementById("code-modal");
  const codeForm = document.getElementById("code-form");
  const codeInput = document.getElementById("code-input");
  const codeError = document.getElementById("code-error");
  const codeModalTitle = document.getElementById("code-modal-title");

  const playerModal = document.getElementById("player-modal");
  const playerForm = document.getElementById("player-form");
  const playerNameInput = document.getElementById("player-name");
  const playerAgeInput = document.getElementById("player-age");
  const playerGenderInput = document.getElementById("player-gender");
  const playerPhoneInput = document.getElementById("player-phone");

  const modalCloseButtons = document.querySelectorAll("[data-close-modal]");

  // --- LocalStorage key (same as host.js) ---
  const TOURNAMENT_KEY = "scheduleitTournaments";

  let allTournaments = [];
  let selectedTournament = null;
  let currentTab = "all"; // "all" | "mine"

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
      localStorage.removeItem("scheduleitUser"); // legacy key, just in case
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

    // Prevent closing when clicking inside dropdown
    userMenuDropdown.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    // Close when clicking anywhere else on the page
    document.addEventListener("click", () => {
      closeDropdown();
    });

    // Close on Esc
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

  // ===== LocalStorage helpers =====

  function loadAllTournaments() {
    const raw = localStorage.getItem(TOURNAMENT_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      return [];
    } catch (e) {
      console.error("Failed to parse tournaments", e);
      return [];
    }
  }

  function saveAllTournaments(list) {
    localStorage.setItem(TOURNAMENT_KEY, JSON.stringify(list));
  }

  // ===== Helpers: sports & "My tournaments" =====

  function getUniqueSports(list) {
    const set = new Set();
    list.forEach((t) => {
      if (t && t.sportName) {
        set.add(t.sportName.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  // tournaments where this user is in players[]
  function getMyTournaments(list) {
    if (!storedUsername) return [];
    return list.filter(
      (t) =>
        t &&
        Array.isArray(t.players) &&
        t.players.some((p) => p && p.joinedBy === storedUsername)
    );
  }

  function populateSportFilter() {
    if (!sportFilterSelect) return;
    // Clear everything except "All sports"
    sportFilterSelect.innerHTML = `<option value="all">All sports</option>`;

    const sports = getUniqueSports(allTournaments);
    sports.forEach((sport) => {
      const opt = document.createElement("option");
      opt.value = sport;
      opt.textContent = sport;
      sportFilterSelect.appendChild(opt);
    });
  }

  function updateBrowserHeader() {
    if (!browserTitle || !browserSubtitle) return;

    if (currentTab === "all") {
      browserTitle.textContent = "Available tournaments";
      browserSubtitle.textContent =
        "Showing tournaments created by all hosts.";
    } else {
      browserTitle.textContent = "My tournaments";
      browserSubtitle.textContent =
        "Tournaments you have registered for. Tap to see schedule & scores.";
    }
  }

  // ===== Rendering: tournaments list =====

  function renderTournamentList() {
    if (!tournamentListEl) return;

    tournamentListEl.innerHTML = "";

    const sourceList =
      currentTab === "all"
        ? allTournaments
        : getMyTournaments(allTournaments);

    if (!sourceList.length) {
      if (emptyStateEl) {
        emptyStateEl.style.display = "block";
        emptyStateEl.textContent =
          currentTab === "all"
            ? "No tournaments found yet. Ask a host to create one from the Host page."
            : "You haven't joined any tournaments yet. Join one from the All tournaments tab.";
      }
      return;
    }

    const selectedSport =
      (sportFilterSelect && sportFilterSelect.value) || "all";

    const filtered = sourceList.filter((t) => {
      if (!t) return false;
      if (selectedSport === "all") return true;
      return (t.sportName || "").trim() === selectedSport;
    });

    if (!filtered.length) {
      if (emptyStateEl) {
        emptyStateEl.textContent =
          currentTab === "all"
            ? "No tournaments for this sport yet. Try another filter or ask a host to create one."
            : "You haven't joined any tournaments in this sport yet.";
        emptyStateEl.style.display = "block";
      }
      return;
    } else if (emptyStateEl) {
      emptyStateEl.style.display = "none";
    }

    filtered.forEach((tournament) => {
      const card = document.createElement("article");
      card.className = "tournament-card";

      const isClosed = !!tournament.registrationsClosed;

      const nameLine = document.createElement("div");
      nameLine.className = "tournament-primary-line";

      const nameSpan = document.createElement("span");
      nameSpan.className = "tournament-name";
      nameSpan.textContent =
        tournament.tournamentName || "Untitled tournament";

      const statusSpan = document.createElement("span");
      statusSpan.className =
        "status-pill " +
        (isClosed ? "status-pill--closed" : "status-pill--open");
      statusSpan.textContent = isClosed
        ? "Registrations closed"
        : "Registrations open";

      nameLine.appendChild(nameSpan);
      nameLine.appendChild(statusSpan);

      const metaLine = document.createElement("div");
      metaLine.className = "tournament-meta";

      const sportSpan = document.createElement("span");
      sportSpan.textContent =
        tournament.sportName || "Sport not specified";

      const dateSpan = document.createElement("span");
      dateSpan.textContent =
        tournament.tournamentDates ||
        tournament.tournamentDate ||
        "Date TBC";

      metaLine.appendChild(sportSpan);
      metaLine.appendChild(dateSpan);

      card.appendChild(nameLine);
      card.appendChild(metaLine);

      card.addEventListener("click", () => {
        // If user is on "My tournaments", go to schedule page
        if (currentTab === "mine") {
          if (!tournament.id) {
            alert(
              "We couldn't identify this tournament. Please ask the host to check the setup."
            );
            return;
          }
          // Save selection so schedule.html knows which tournament to show
          localStorage.setItem(
            "scheduleitSelectedTournamentId",
            tournament.id
          );
          window.location.href = "schedule.html";
          return;
        }

        // "All tournaments" behavior: registration
        if (isClosed) {
          alert("Registrations are closed for this tournament.");
          return;
        }
        openCodeModal(tournament);
      });

      tournamentListEl.appendChild(card);
    });
  }

    // ===== "My tournaments" (joined as player) =====

  function getMyTournaments() {
    if (!storedUsername) return [];

    return allTournaments.filter((tournament) => {
      if (!tournament || !Array.isArray(tournament.players)) return false;

      // Joined if any player entry has joinedBy = current username
      return tournament.players.some(
        (p) => p && p.joinedBy === storedUsername
      );
    });
  }

  function renderMyTournamentList() {
    if (!myTournamentListEl) return;

    const mine = getMyTournaments();
    myTournamentListEl.innerHTML = "";

    if (!mine.length) {
      if (myEmptyStateEl) myEmptyStateEl.style.display = "block";
      return;
    }

    if (myEmptyStateEl) myEmptyStateEl.style.display = "none";

    mine.forEach((tournament) => {
      const card = document.createElement("article");
      card.className = "tournament-card";

      const nameLine = document.createElement("div");
      nameLine.className = "tournament-primary-line";

      const nameSpan = document.createElement("span");
      nameSpan.className = "tournament-name";
      nameSpan.textContent =
        tournament.tournamentName || "Untitled tournament";

      const statusSpan = document.createElement("span");
      statusSpan.className = "status-pill status-pill--open";
      statusSpan.textContent = "View schedule";

      nameLine.appendChild(nameSpan);
      nameLine.appendChild(statusSpan);

      const metaLine = document.createElement("div");
      metaLine.className = "tournament-meta";

      const sportSpan = document.createElement("span");
      sportSpan.textContent = tournament.sportName || "Sport not specified";

      const dateSpan = document.createElement("span");
      dateSpan.textContent =
        tournament.tournamentDates ||
        tournament.tournamentDate ||
        "Date TBC";

      metaLine.appendChild(sportSpan);
      metaLine.appendChild(dateSpan);

      card.appendChild(nameLine);
      card.appendChild(metaLine);

      // 🔗 Clicking a "My tournaments" card opens the schedule page
      card.addEventListener("click", () => {
        if (!tournament.id) {
          alert("This tournament is missing an ID, cannot open schedule.");
          return;
        }

        // This is what schedule.js reads
        localStorage.setItem(
          "scheduleitSelectedTournamentId",
          String(tournament.id)
        );

        window.location.href = "schedule.html";
      });

      myTournamentListEl.appendChild(card);
    });
  }

    // ===== Tabs behaviour (All / My) =====

  function activateTab(tabName) {
    tabButtons.forEach((btn) => {
      const isActive = btn.dataset.tab === tabName;
      btn.classList.toggle("is-active", isActive);
    });

    tabPanels.forEach((panel) => {
      const isActive = panel.dataset.panel === tabName;
      panel.classList.toggle("is-active", isActive);
    });
  }

  if (tabButtons.length) {
    tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tab;
        if (!tab) return;

        activateTab(tab);

        if (tab === "all") {
          renderTournamentList();
        } else if (tab === "mine") {
          renderMyTournamentList();
        }
      });
    });
  }

  // ===== Tabs events =====

  if (tabs.length) {
    tabs.forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.getAttribute("data-tab") || "all";
        currentTab = tab === "mine" ? "mine" : "all";

        tabs.forEach((b) => b.classList.remove("tab--active"));
        btn.classList.add("tab--active");

        updateBrowserHeader();
        renderTournamentList();
      });
    });
  }

  // ===== Modals helpers =====

  function openCodeModal(tournament) {
    selectedTournament = tournament;
    if (!codeModal) return;

    if (codeModalTitle && tournament.tournamentName) {
      codeModalTitle.textContent = `Enter code for "${tournament.tournamentName}"`;
    }

    if (codeInput) {
      codeInput.value = "";
      codeInput.focus();
    }
    if (codeError) {
      codeError.style.display = "none";
    }

    codeModal.classList.remove("hidden");
    codeModal.setAttribute("aria-hidden", "false");
  }

  function closeCodeModal() {
    if (!codeModal) return;
    codeModal.classList.add("hidden");
    codeModal.setAttribute("aria-hidden", "true");
    if (codeInput) codeInput.value = "";
    if (codeError) codeError.style.display = "none";
  }

  function openPlayerModal() {
    if (!playerModal) return;

    if (playerForm) {
      playerForm.reset();
    }

    playerModal.classList.remove("hidden");
    playerModal.setAttribute("aria-hidden", "false");
    if (playerNameInput) {
      playerNameInput.focus();
    }
  }

  function closePlayerModal() {
    if (!playerModal) return;
    playerModal.classList.add("hidden");
    playerModal.setAttribute("aria-hidden", "true");
    if (playerForm) playerForm.reset();
  }

  // Close modals on X button
  modalCloseButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      closeCodeModal();
      closePlayerModal();
    });
  });

  // Close on click outside modal
  [codeModal, playerModal].forEach((modalEl) => {
    if (!modalEl) return;
    modalEl.addEventListener("click", (event) => {
      if (event.target === modalEl) {
        closeCodeModal();
        closePlayerModal();
      }
    });
  });

  // Close on ESC
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeCodeModal();
      closePlayerModal();
    }
  });

  // ===== Code form logic =====

  if (codeForm) {
    codeForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!selectedTournament || !codeInput) return;

      const entered = (codeInput.value || "").trim();
      const correct = (selectedTournament.accessCode || "").trim();

      if (!entered || entered !== correct) {
        if (codeError) codeError.style.display = "block";
        return;
      }

      // Correct code
      closeCodeModal();
      openPlayerModal();
    });
  }

  // ===== Player registration logic =====

  function registerPlayerForTournament(formData) {
    if (!selectedTournament) return;

    const list = loadAllTournaments();
    const index = list.findIndex((t) => t.id === selectedTournament.id);

    if (index === -1) {
      alert(
        "This tournament could not be found anymore. Please refresh the page."
      );
      return;
    }

    const playerName = (formData.get("playerName") || "")
      .toString()
      .trim();
    const playerAge = (formData.get("playerAge") || "")
      .toString()
      .trim();
    const playerGender = (formData.get("playerGender") || "")
      .toString()
      .trim();
    const playerPhone = (formData.get("playerPhone") || "")
      .toString()
      .trim();

    if (!Array.isArray(list[index].players)) {
      list[index].players = [];
    }

    list[index].players.push({
      name: playerName,
      age: playerAge,
      gender: playerGender,
      phone: playerPhone,
      joinedBy: storedUsername,
      joinedAt: new Date().toISOString(),
    });

    // Keep host-side totalRegistrations in sync
    const currentCount = Number(list[index].totalRegistrations || 0);
    list[index].totalRegistrations = currentCount + 1;

    saveAllTournaments(list);
    allTournaments = list;
    renderTournamentList();
    renderMyTournamentList(); // 🔄 keep My tournaments in sync

    alert(`You have been registered for "${list[index].tournamentName}".`);

  }

  if (playerForm) {
    playerForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(playerForm);
      registerPlayerForTournament(formData);
      closePlayerModal();
    });
  }

  // ===== Initial load =====

  allTournaments = loadAllTournaments();
  populateSportFilter();
  updateBrowserHeader();
  renderTournamentList();
  renderMyTournamentList();

  if (sportFilterSelect) {
    sportFilterSelect.addEventListener("change", () => {
      renderTournamentList();
    });
  }
});
