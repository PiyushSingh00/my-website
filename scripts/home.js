// Homepage interactivity
console.debug('ScheduleIt homepage loaded');

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "/api";

  // Buttons
  const createAccountBtn = document.getElementById("create-account-btn");
  const heroSigninBtn = document.getElementById("hero-signin-btn");

  // Modals
  const signupModal = document.getElementById("signup-modal");
  const signinModal = document.getElementById("signin-modal");
  const signupCloseBtn = signupModal.querySelector(".modal-close");
  const signinCloseBtn = signinModal.querySelector(".modal-close");

  // Forms + fields
  const signupForm = document.getElementById("signup-form");
  const signinForm = document.getElementById("signin-form");

  const signupName = document.getElementById("signup-name");
  const signupEmail = document.getElementById("signup-email");
  const signupPhone = document.getElementById("signup-phone");
  const signupRole = document.getElementById("signup-role");
  const signupUsername = document.getElementById("signup-username");
  const signupUsernameHint = document.getElementById("signup-username-hint");
  const signupPassword = document.getElementById("signup-password");
  const signupPhoto = document.getElementById("signup-photo");

  const signinUsername = document.getElementById("signin-username");
  const signinPassword = document.getElementById("signin-password");

  // Links inside modals
  const signupSigninLink = document.getElementById("signup-signin-link");   // "Sign in" inside signup
  const signinCreateLink = document.getElementById("signin-create-link");   // "Create account" inside signin
 

  const modals = [];
  if (signupModal) modals.push(signupModal);
  if (signinModal) modals.push(signinModal);

  function openModal(modal) {
    if (!modal) return;
    modal.classList.add('is-visible');
    modal.setAttribute('aria-hidden', 'false');

    const firstInput = modal.querySelector('input, select');
    if (firstInput) firstInput.focus();
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('is-visible');
    modal.setAttribute('aria-hidden', 'true');
  }

  // ----- Open modals from main buttons -----

  if (createAccountBtn) createAccountBtn.addEventListener("click", (e) => {
    e.preventDefault();
    openSignup();
  });

  if (heroSigninBtn) heroSigninBtn.addEventListener("click", (e) => {
    e.preventDefault();
    openSignin();
  });

  signupCloseBtn.addEventListener("click", closeSignup);
  signinCloseBtn.addEventListener("click", closeSignin);

  signupSigninLink.addEventListener("click", (e) => {
    e.preventDefault();
    openSignin();
  });

  signinCreateLink.addEventListener("click", (e) => {
    e.preventDefault();
    openSignup();
  });

    let usernameCheckTimeout = null;

  function setUsernameHint(status, message) {
    signupUsernameHint.textContent = message || "";
    signupUsernameHint.className = "field-hint"; // reset base

    if (status === "checking") {
      signupUsernameHint.classList.add("hint-checking");
    } else if (status === "available") {
      signupUsernameHint.classList.add("hint-available");
    } else if (status === "taken") {
      signupUsernameHint.classList.add("hint-taken");
    } else if (status === "error") {
      signupUsernameHint.classList.add("hint-error");
    }
  }

  signupUsername.addEventListener("input", () => {
    const value = signupUsername.value.trim();

    if (!value) {
      setUsernameHint(null, "");
      return;
    }

    // Basic length rule to avoid spamming API
    if (value.length < 3) {
      setUsernameHint("error", "Username must be at least 3 characters.");
      return;
    }

    // Debounce
    if (usernameCheckTimeout) {
      clearTimeout(usernameCheckTimeout);
    }

    usernameCheckTimeout = setTimeout(async () => {
      try {
        setUsernameHint("checking", "Checking availability...");
        const resp = await fetch(`${API_BASE}/users/check-username?username=${encodeURIComponent(value)}`);
        const data = await resp.json();

        if (!resp.ok) {
          setUsernameHint("error", data.message || "Could not check username.");
          return;
        }

        if (data.available) {
          setUsernameHint("available", "Username is available ✅");
        } else {
          setUsernameHint("taken", "Username is already taken ❌");
        }
      } catch (err) {
        console.error(err);
        setUsernameHint("error", "Error checking username.");
      }
    }, 400); // 400ms debounce
  });


  function openSignup() {
    signupModal.setAttribute("aria-hidden", "false");
    signupModal.classList.add("open");
    signinModal.setAttribute("aria-hidden", "true");
    signinModal.classList.remove("open");
    signupName.focus();
  }

    function openSignin() {
    signinModal.setAttribute("aria-hidden", "false");
    signinModal.classList.add("open");
    signupModal.setAttribute("aria-hidden", "true");
    signupModal.classList.remove("open");
    signinUsername.focus();
  }

  function closeSignup() {
    signupModal.setAttribute("aria-hidden", "true");
    signupModal.classList.remove("open");
  }

  function closeSignin() {
    signinModal.setAttribute("aria-hidden", "true");
    signinModal.classList.remove("open");
  }


  // ----- Close buttons -----



  // ----- Click outside modal to close -----

  modals.forEach((modal) => {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        closeModal(modal);
      }
    });
  });

  // ----- ESC key closes any open modal -----

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      modals.forEach((modal) => closeModal(modal));
    }
  });

  // ----- Switch between Signup <-> Signin from links -----

  // "Already have an account? Sign in" inside signup modal

  // "New here? Create account" inside signin modal


  // ----- Username uniqueness (local, front-end only) -----

  const USERNAMES_KEY = 'scheduleItUsernames';

  function loadStoredUsernames() {
    try {
      const raw = localStorage.getItem(USERNAMES_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error('Failed to load stored usernames', err);
      return [];
    }
  }

  function saveStoredUsernames(usernames) {
    try {
      localStorage.setItem(USERNAMES_KEY, JSON.stringify(usernames));
    } catch (err) {
      console.error('Failed to save usernames', err);
    }
  }

  function normalizeUsername(value) {
    return (value || '').trim().toLowerCase();
  }

  let storedUsernames = loadStoredUsernames();

  function isUsernameTaken(username) {
    const norm = normalizeUsername(username);
    if (!norm) return false;
    return storedUsernames.includes(norm);
  }

  function updateUsernameHint() {
    if (!signupUsernameInput || !signupUsernameHint) return;

    const raw = signupUsernameInput.value;
    const norm = normalizeUsername(raw);

    signupUsernameHint.textContent = '';
    signupUsernameHint.className = 'field-hint';
    signupUsernameInput.classList.remove('input-error', 'input-success');

    if (!norm) {
      // Empty username, no message
      return;
    }

    if (isUsernameTaken(norm)) {
      signupUsernameHint.textContent = 'Username already taken';
      signupUsernameHint.classList.add('error');
      signupUsernameInput.classList.add('input-error');
    } else {
      signupUsernameHint.textContent = 'Username is available';
      signupUsernameHint.classList.add('success');
      signupUsernameInput.classList.add('input-success');
    }
  }

  if (signupUsernameInput) {
    signupUsernameInput.addEventListener('input', updateUsernameHint);
  }

  // ----- Password show / hide toggles -----

  function resetPasswordField(inputEl, toggleBtn) {
    if (!inputEl || !toggleBtn) return;
    inputEl.type = 'password';
    const textSpan = toggleBtn.querySelector('.password-toggle-text');
    if (textSpan) {
      textSpan.textContent = 'Show';
    }
  }

  const passwordToggleButtons = document.querySelectorAll('.password-toggle');
  passwordToggleButtons.forEach((btn) => {
    const targetId = btn.dataset.target;
    if (!targetId) return;

    const input = document.getElementById(targetId);
    if (!input) return;

    btn.addEventListener('click', () => {
      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';

      const textSpan = btn.querySelector('.password-toggle-text');
      if (textSpan) {
        textSpan.textContent = isHidden ? 'Hide' : 'Show';
      }

      btn.setAttribute(
        'aria-label',
        isHidden ? 'Hide password' : 'Show password'
      );
    });
  });

  // ----- Handle signup submit -----

  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = signupName.value.trim();
      const email = signupEmail.value.trim();
      const phone = signupPhone.value.trim();
      const role = signupRole.value;
      const username = signupUsername.value.trim();
      const password = signupPassword.value;

      if (!name || !phone || !username || !password || !role) {
        alert("Please fill all required fields.");
        return;
      }

      try {
        const payload = {
          name,
          email,
          phone,
          role,
          username,
          password,
          // photoUrl: null // for future, when you add S3
        };

        const resp = await fetch(`${API_BASE}/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await resp.json();

        if (!resp.ok) {
          alert(data.message || "Failed to create account.");
          return;
        }

        alert("Account created successfully! Please sign in.");
        signupForm.reset();
        setUsernameHint(null, "");
        openSignin();
      } catch (err) {
        console.error(err);
        alert("Something went wrong while creating your account.");
      }
    });
  }

  


  // ----- Handle signin submit -----

  if (signinForm) {
    signinForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const username = signinUsername.value.trim();
      const password = signinPassword.value;

      if (!username || !password) {
        alert("Please enter both username and password.");
        return;
      }

      try {
        const resp = await fetch(`${API_BASE}/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });

        const data = await resp.json();

        if (!resp.ok) {
          alert(data.message || "Invalid username or password.");
          return;
        }

        // Save basic session info
        localStorage.setItem("scheduleitUser", data.username || username);
        if (data.role) {
          localStorage.setItem("scheduleitRole", data.role);
        }

        alert("Signed in successfully!");

        // OPTIONAL: redirect based on role
        // if (data.role === "host") {
        //   window.location.href = "/host.html";
        // } else {
        //   window.location.href = "/join.html";
        // }

      } catch (err) {
        console.error(err);
        alert("Something went wrong while signing in.");
      }
    });
  }
});
