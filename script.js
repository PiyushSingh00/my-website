document.addEventListener("DOMContentLoaded", () => {
  // Top bar buttons
  const signInBtn = document.getElementById("signInBtn");
  const createAccountBtn = document.getElementById("createAccountBtn");

  // Actions gating
  const actionsGrid = document.getElementById("actionsGrid");
  const lockedBanner = document.getElementById("lockedBanner");

  // Modal elements
  const signInModal = document.getElementById("signInModal");
  const signInForm = document.getElementById("signInForm");
  const usernameInput = document.getElementById("usernameInput");
  const passwordInput = document.getElementById("passwordInput");
  const modalCloseTriggers = document.querySelectorAll("[data-close-modal]");

  const actionButtons = document.querySelectorAll(".action-btn");
  const actionRoutes = {
    "host-tournament": "host.html",
    "join-tournament": "join.html",
  };

  // Host page + join page elements
  const generateCodeBtn = document.getElementById("generateCodeBtn");
  const tournamentCodeInput = document.getElementById("tournamentCode");
  const hostForm = document.getElementById("hostForm");
  const tournamentList = document.getElementById("tournamentList");
  const joinCodeForm = document.getElementById("joinCodeForm");
  const joinCodeInput = document.getElementById("joinCodeInput");
  const joinPlayerModal = document.getElementById("joinPlayerModal");
  const joinPlayerForm = document.getElementById("joinPlayerForm");
  const joinPlayerTitle = document.getElementById("joinPlayerTitle");
  const joinPlayerSubtitle = document.getElementById("joinPlayerSubtitle");
  const joinPlayerName = document.getElementById("joinPlayerName");
  const joinPlayerAge = document.getElementById("joinPlayerAge");
  const joinPlayerPhone = document.getElementById("joinPlayerPhone");
  const joinPlayerCaptain = document.getElementById("joinPlayerCaptain");
  const joinTeamName = document.getElementById("joinTeamName");
  const joinTeamLogo = document.getElementById("joinTeamLogo");
  const joinPayment = document.getElementById("joinPayment");
  const joinStepOne = document.getElementById("joinStepOne");
  const joinStepTwo = document.getElementById("joinStepTwo");
  const joinSubmitBtn = document.getElementById("joinSubmitBtn");
  const joinModalClose = document.querySelectorAll("[data-close-join]");
  const signUpModal = document.getElementById("signUpModal");
  const signUpForm = document.getElementById("signUpForm");
  const signUpUsername = document.getElementById("signUpUsername");
  const signUpPassword = document.getElementById("signUpPassword");
  const signUpCloseTriggers = document.querySelectorAll("[data-close-signup]");

  let currentUser = null; // <--- add this
  let joinStep = 1;



  // Restore auth state
  const storedUser = localStorage.getItem("scheduleitUser");
  if (storedUser) {
    setSignedIn(storedUser);
  } else {
    setSignedOut();
  }

  // Sign in modal controls
  if (signInBtn) {
    signInBtn.addEventListener("click", () => {
      if (signInBtn.disabled) return;
      openModal();
    });
  }

// Action buttons routing
  actionButtons.forEach((btn) => {
    // Make sure buttons are always enabled and have no leftover tooltip
    btn.disabled = false;
    btn.removeAttribute("title");

    btn.addEventListener("click", () => {
      const action = btn.dataset.action;

      // 1) If user is NOT signed in, open sign-in modal
      if (!currentUser) {
        openModal();
        return;
      }

      // 2) If signed in, go to the relevant page (if we have one)
      const route = actionRoutes[action];
      if (route) {
        window.location.href = route;
        return;
      }

      // Fallback for actions not wired yet (e.g. profile/performance placeholders)
      alert(`You clicked: "${btn.textContent.trim()}" (action: ${action})`);
    });
  });


  // Sign in submit
if (signInForm) {
  signInForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
      alert("Please enter both username and password.");
      return;
    }

    try {
      const resp = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        alert(errData.message || "Login failed");
        return;
      }

      const data = await resp.json();
      // data.username is from backend
      setSignedIn(data.username);
      closeModal();
      signInForm.reset();
      alert("Signed in successfully.");
    } catch (err) {
      console.error("Login error", err);
      alert("Something went wrong. Please try again.");
    }
  });
}

if (signUpForm) {
  signUpForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = signUpUsername.value.trim();
    const password = signUpPassword.value.trim();

    if (!username || !password) {
      alert("Please enter both username and password.");
      return;
    }

    try {
      const resp = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        alert(data.message || "Signup failed");
        return;
      }

      alert("Account created. You can now sign in.");
      signUpForm.reset();
      closeSignUpModal();
      openModal(); // open sign-in modal so they can login
    } catch (err) {
      console.error("Signup error", err);
      alert("Something went wrong. Please try again.");
    }
  });
}

  // Modal close handlers
  modalCloseTriggers.forEach((el) => el.addEventListener("click", closeModal));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
  // *** NEW: close sign-up modal when clicking backdrop or X ***
signUpCloseTriggers.forEach((el) =>
  el.addEventListener("click", closeSignUpModal)
);




  // Host page: code generation
  if (generateCodeBtn && tournamentCodeInput) {
    generateCodeBtn.addEventListener("click", () => {
      tournamentCodeInput.value = generateTournamentCode();
      tournamentCodeInput.focus();
      tournamentCodeInput.select();
    });
  }

  // Host page: save tournament
  if (hostForm) {
    hostForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const payload = {
        tournamentName: document.getElementById("tournamentName")?.value.trim(),
        sportName: document.getElementById("sportName")?.value.trim(),
        tournamentCode: document.getElementById("tournamentCode")?.value.trim(),
        tournamentDate: document.getElementById("tournamentDate")?.value.trim(),
        playerDetails: document.getElementById("playerDetails")?.value.trim(),
        createdAt: new Date().toISOString(),
      };

      if (!payload.tournamentName || !payload.sportName) {
        alert("Please fill tournament name and sport name.");
        return;
      }

      if (!payload.tournamentCode) {
        payload.tournamentCode = generateTournamentCode();
        if (tournamentCodeInput) tournamentCodeInput.value = payload.tournamentCode;
      }

      saveTournament(payload);
      alert("Tournament saved. Share the generated code with your players.");
      hostForm.reset();
    });
  }

  // Join page: initial state only shows code box
  if (tournamentList) {
    hideTournamentList();
  }

  if (joinCodeForm) {
    joinCodeForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const code = joinCodeInput?.value.trim();
      if (!code) {
        alert("Please enter the access code to view the tournament.");
        return;
      }
      renderTournamentList(code);
    });
  }

  if (joinPlayerForm) {
    joinPlayerForm.addEventListener("submit", (event) => {
      event.preventDefault();
      handleJoinSubmit();
    });
  }

  joinModalClose.forEach((el) => el.addEventListener("click", closeJoinModal));

  // Helpers
  function generateTournamentCode() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i += 1) {
      const index = Math.floor(Math.random() * alphabet.length);
      code += alphabet[index];
    }
    return code;
  }

  function saveTournament(data) {
    const key = "scheduleitTournaments";
    const existingRaw = localStorage.getItem(key);
    const list = existingRaw ? JSON.parse(existingRaw) : [];
    list.push({
      id: Date.now(),
      ...data,
    });
    localStorage.setItem(key, JSON.stringify(list));
  }

  function renderTournamentList(filterCode) {
    const key = "scheduleitTournaments";
    const existingRaw = localStorage.getItem(key);
    let list = existingRaw ? JSON.parse(existingRaw) : [];
    const target = (filterCode || "").trim().toUpperCase();

    if (target) {
      list = list.filter(
        (item) =>
          typeof item.tournamentCode === "string" &&
          item.tournamentCode.toUpperCase() === target
      );
    }

    if (!tournamentList) return;

    tournamentList.style.display = "grid";

    if (!list.length) {
      tournamentList.classList.add("empty");
      const message = target
        ? `No tournament found for code "${target}".`
        : "Enter a code to view a tournament.";
      tournamentList.innerHTML = `
        <div class="empty-state">
          <div class="feature-icon">🔍</div>
          <h4>No tournaments yet</h4>
          <p class="muted">${message}</p>
        </div>
      `;
      return;
    }

    tournamentList.classList.remove("empty");
    tournamentList.innerHTML = list
      .map(
        (item) => `
        <div class="tournament-card">
          <div class="tournament-head">
            <div>
              <p class="eyebrow">${item.sportName || "Sport"}</p>
              <h3>${item.tournamentName || "Tournament"}</h3>
            </div>
          </div>
          <p class="muted">${item.playerDetails || "Details will be shared by the host."}</p>
          <div class="tournament-meta">
            <span>${item.tournamentDate ? `Dates: ${item.tournamentDate}` : ""}</span>
          </div>
          <div class="tournament-meta">
            <span>Created: ${new Date(item.createdAt).toLocaleString()}</span>
          </div>
          <button class="primary-btn action-btn join-btn" data-join-id="${item.id}">Next</button>
        </div>
      `
      )
      .join("");

    attachJoinHandlers(list);
  }

  function hideTournamentList() {
    if (!tournamentList) return;
    tournamentList.style.display = "none";
    tournamentList.classList.add("empty");
    tournamentList.innerHTML = `
      <div class="empty-state">
        <div class="feature-icon">🔍</div>
        <h4>Enter a code to view a tournament</h4>
        <p class="muted">Provide the access code to see details.</p>
      </div>
    `;
  }

  function attachJoinHandlers(list) {
    if (!tournamentList) return;
    const buttons = tournamentList.querySelectorAll(".join-btn");
    buttons.forEach((btn) => {
      const id = btn.getAttribute("data-join-id");
      const item = list.find((t) => String(t.id) === String(id));
      if (!item) return;
      btn.addEventListener("click", () => openJoinModal(item));
    });
  }

  function openJoinModal(tournament) {
    if (!joinPlayerModal) return;
    joinPlayerModal.classList.add("open");
    joinPlayerModal.setAttribute("aria-hidden", "false");
    if (joinPlayerTitle) joinPlayerTitle.textContent = tournament.tournamentName || "Tournament";
    if (joinPlayerSubtitle) {
      const bits = [];
      if (tournament.sportName) bits.push(tournament.sportName);
      if (tournament.tournamentDate) bits.push(tournament.tournamentDate);
      joinPlayerSubtitle.textContent = bits.join(" • ");
    }
    if (joinPlayerCaptain) joinPlayerCaptain.checked = false;
    if (joinTeamName) joinTeamName.value = "";
    if (joinTeamLogo) joinTeamLogo.value = "";
    if (joinPayment) joinPayment.value = "";
    if (joinPlayerName) joinPlayerName.value = "";
    if (joinPlayerAge) joinPlayerAge.value = "";
    if (joinPlayerPhone) joinPlayerPhone.value = "";
    setJoinStep(1);
    if (joinPlayerName) joinPlayerName.focus();
    joinPlayerForm.dataset.tournamentId = tournament.id;
  }

  function closeJoinModal() {
    if (!joinPlayerModal) return;
    joinPlayerModal.classList.remove("open");
    joinPlayerModal.setAttribute("aria-hidden", "true");
  }

  function setJoinStep(step) {
    joinStep = step;
    if (joinStepOne) joinStepOne.classList.toggle("hidden", step !== 1);
    if (joinStepTwo) joinStepTwo.classList.toggle("hidden", step !== 2);
    if (joinSubmitBtn) joinSubmitBtn.textContent = step === 2 ? "Finish" : "Next";
  }

  function handleJoinSubmit() {
    if (joinStep === 1) {
      if (!joinPlayerName?.value.trim() || !joinPlayerPhone?.value.trim()) {
        alert("Please fill your name and phone number.");
        return;
      }
      if (joinPlayerCaptain?.checked) {
        setJoinStep(2);
        if (joinTeamName) joinTeamName.focus();
        return;
      }
      alert("You have joined the tournament!");
      joinPlayerForm.reset();
      closeJoinModal();
      return;
    }

    if (joinStep === 2) {
      if (!joinTeamName?.value.trim()) {
        alert("Please enter your team name.");
        return;
      }
      alert("You have joined the tournament!");
      joinPlayerForm.reset();
      closeJoinModal();
      setJoinStep(1);
    }
  }

  function lockActions() {
    // Just add the "locked" style (slight dimming) – keep buttons clickable
    if (actionsGrid) actionsGrid.classList.add("locked");
  }

  function unlockActions() {
    // Remove the dimmed style; buttons stay clickable
    if (actionsGrid) actionsGrid.classList.remove("locked");
    // Clean up any old title attributes if present
    document.querySelectorAll(".action-btn").forEach((btn) => {
      btn.removeAttribute("title");
    });
  }



  function setSignedIn(username) {
    localStorage.setItem("scheduleitUser", username);
    currentUser = username;          // <--- remember who is signed in
    unlockActions();

    if (signInBtn) {
      signInBtn.textContent = `Signed in as ${username}`;
      signInBtn.disabled = true;
      signInBtn.classList.add("secondary-btn");
    }
    if (createAccountBtn) {
      createAccountBtn.textContent = "Sign Out";
      createAccountBtn.onclick = handleSignOut;
      createAccountBtn.classList.remove("primary-btn");
      createAccountBtn.classList.add("secondary-btn");
    }
  }

  function setSignedOut() {
    localStorage.removeItem("scheduleitUser");
    currentUser = null;              // <--- clear user
    lockActions();

    if (signInBtn) {
      signInBtn.textContent = "Sign In";
      signInBtn.disabled = false;
      signInBtn.classList.remove("secondary-btn");
    }
    if (createAccountBtn) {
      createAccountBtn.textContent = "Create Account";
      createAccountBtn.onclick = openSignUpModal;
      createAccountBtn.classList.remove("secondary-btn");
      createAccountBtn.classList.add("primary-btn");
    }
  }

  function openSignUpModal() {
  if (!signUpModal) return;
  signUpModal.classList.add("open");
  signUpModal.setAttribute("aria-hidden", "false");
  if (signUpUsername) signUpUsername.focus();
  }

function closeSignUpModal() {
  if (!signUpModal) return;
  signUpModal.classList.remove("open");
  signUpModal.setAttribute("aria-hidden", "true");
  }


  function handleSignOut() {
    setSignedOut();
    alert("Signed out.");
  }

  function openModal() {
    if (!signInModal) return;
    signInModal.classList.add("open");
    signInModal.setAttribute("aria-hidden", "false");
    if (usernameInput) usernameInput.focus();
  }

  function closeModal() {
    if (!signInModal) return;
    signInModal.classList.remove("open");
    signInModal.setAttribute("aria-hidden", "true");
  }
});
