document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "/api";

  // Top bar buttons
  const signInBtn = document.getElementById("signInBtn");
  const createAccountBtn = document.getElementById("createAccountBtn");

  // Optional hero buttons (for now just open modals)
  const heroHostBtn = document.getElementById("heroHostBtn");
  const heroPlayerBtn = document.getElementById("heroPlayerBtn");

  // Modals and forms
  const signUpModal = document.getElementById("signUpModal");
  const signInModal = document.getElementById("signInModal");

  const signUpForm = document.getElementById("signUpForm");
  const signInForm = document.getElementById("signInForm");

  // Sign up fields
  const signupName = document.getElementById("signupName");
  const signupEmail = document.getElementById("signupEmail");
  const signupPhone = document.getElementById("signupPhone");
  const signupRole = document.getElementById("signupRole");
  const signupUsername = document.getElementById("signupUsername");
  const signupUsernameHint = document.getElementById("signupUsernameHint");
  const signupPassword = document.getElementById("signupPassword");
  const signupPhoto = document.getElementById("signupPhoto"); // not used yet

  // Sign in fields
  const signinUsername = document.getElementById("signinUsername");
  const signinPassword = document.getElementById("signinPassword");

  // Links inside modals
  const signupSigninLink = document.getElementById("signupSigninLink");
  const signinCreateLink = document.getElementById("signinCreateLink");

  // Close triggers
  const signUpCloseTriggers = document.querySelectorAll("[data-close-signup]");
  const signInCloseTriggers = document.querySelectorAll("[data-close-signin]");

  // ---------- Modal helpers ----------

  function openSignUp() {
    if (signUpModal) {
      signUpModal.classList.add("open");
      signUpModal.setAttribute("aria-hidden", "false");
    }
    if (signInModal) {
      signInModal.classList.remove("open");
      signInModal.setAttribute("aria-hidden", "true");
    }
    if (signupName) signupName.focus();
  }

  function openSignIn() {
    if (signInModal) {
      signInModal.classList.add("open");
      signInModal.setAttribute("aria-hidden", "false");
    }
    if (signUpModal) {
      signUpModal.classList.remove("open");
      signUpModal.setAttribute("aria-hidden", "true");
    }
    if (signinUsername) signinUsername.focus();
  }

  function closeSignUp() {
    if (signUpModal) {
      signUpModal.classList.remove("open");
      signUpModal.setAttribute("aria-hidden", "true");
    }
  }

  function closeSignIn() {
    if (signInModal) {
      signInModal.classList.remove("open");
      signInModal.setAttribute("aria-hidden", "true");
    }
  }

  // ---------- Attach button handlers ----------

  if (createAccountBtn) {
    createAccountBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openSignUp();
    });
  }

  if (signInBtn) {
    signInBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openSignIn();
    });
  }

  if (heroHostBtn) {
    heroHostBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openSignUp();
    });
  }

  if (heroPlayerBtn) {
    heroPlayerBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openSignIn();
    });
  }

  signUpCloseTriggers.forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      closeSignUp();
    });
  });

  signInCloseTriggers.forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      closeSignIn();
    });
  });

  if (signupSigninLink) {
    signupSigninLink.addEventListener("click", (e) => {
      e.preventDefault();
      openSignIn();
    });
  }

  if (signinCreateLink) {
    signinCreateLink.addEventListener("click", (e) => {
      e.preventDefault();
      openSignUp();
    });
  }

  // ---------- Username availability (live check) ----------

  let usernameCheckTimeout = null;

  function setUsernameHint(status, message) {
    if (!signupUsernameHint) return;
    signupUsernameHint.textContent = message || "";
    signupUsernameHint.className = "field-hint"; // reset base class
    if (!status) return;

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

  if (signupUsername) {
    signupUsername.addEventListener("input", () => {
      const value = signupUsername.value.trim();

      if (!value) {
        setUsernameHint(null, "");
        return;
      }

      if (value.length < 3) {
        setUsernameHint("error", "Username must be at least 3 characters.");
        return;
      }

      if (usernameCheckTimeout) {
        clearTimeout(usernameCheckTimeout);
      }

      usernameCheckTimeout = setTimeout(async () => {
        try {
          setUsernameHint("checking", "Checking availability...");
          const resp = await fetch(
            `${API_BASE}/users/check-username?username=${encodeURIComponent(value)}`
          );
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
      }, 400); // debounce
    });
  }

  // ---------- Sign up submit → /api/register ----------

  if (signUpForm) {
    signUpForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = signupName ? signupName.value.trim() : "";
      const email = signupEmail ? signupEmail.value.trim() : "";
      const phone = signupPhone ? signupPhone.value.trim() : "";
      const role = signupRole ? signupRole.value : "";
      const username = signupUsername ? signupUsername.value.trim() : "";
      const password = signupPassword ? signupPassword.value : "";

      if (!name || !phone || !username || !password || !role) {
        alert("Please fill all required fields (name, phone, role, username, password).");
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
          // photoUrl: null // in future, once you add S3/file upload
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
        signUpForm.reset();
        setUsernameHint(null, "");
        openSignIn();
      } catch (err) {
        console.error(err);
        alert("Something went wrong while creating your account.");
      }
    });
  }

  // ---------- Sign in submit → /api/login ----------

  if (signInForm) {
    signInForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const username = signinUsername ? signinUsername.value.trim() : "";
      const password = signinPassword ? signinPassword.value : "";

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

        const loggedInUsername = data.username || username;
        const role = data.role || null;

        // Save in localStorage for later pages (host/join)
        localStorage.setItem("scheduleitUser", loggedInUsername);
        if (role) {
          localStorage.setItem("scheduleitRole", role);
        }

        alert("Signed in successfully!");

        // Example: redirect based on role (uncomment when backend returns role)
        // if (role === "host") {
        //   window.location.href = "/host.html";
        // } else if (role === "player") {
        //   window.location.href = "/join.html";
        // } else {
        //   closeSignIn();
        // }

        closeSignIn();
      } catch (err) {
        console.error(err);
        alert("Something went wrong while signing in.");
      }
    });
  }
});
