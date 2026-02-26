// scripts/home.js
console.log("🔥 home.js loaded");
console.log("🚨 HOME.JS VERSION = PROD_NO_8080");


document.addEventListener("DOMContentLoaded", () => {
  /* ===============================
     ELEMENTS
  =============================== */

  // Modals
  const signinModal = document.getElementById("signin-modal");
  const signupModal = document.getElementById("signup-modal");

  // Buttons / links
  const heroSigninBtn = document.getElementById("hero-signin-btn");
  const createAccountBtn = document.getElementById("create-account-btn");
  const signupSigninLink = document.getElementById("signup-signin-link");
  const signinCreateLink = document.getElementById("signin-create-link");
  const closeButtons = document.querySelectorAll(".modal-close");
  const startHostingBtn = document.getElementById("start-hosting-btn");
  const browseTournamentsBtn = document.getElementById("browse-tournaments-btn");

  // Forms
  const signinForm = document.getElementById("signin-form");
  const signupForm = document.getElementById("signup-form");

  /* ===============================
     MODAL HELPERS
  =============================== */

function openModal(modal) {
  if (!modal) return;
  modal.classList.add("is-visible");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal(modal) {
  if (!modal) return;
  modal.classList.remove("is-visible");
  modal.setAttribute("aria-hidden", "true");
}


  /* ===============================
     MODAL OPEN / CLOSE LOGIC
  =============================== */

  heroSigninBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    openModal(signinModal);
  });

  createAccountBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    openModal(signupModal);
  });

  signupSigninLink?.addEventListener("click", (e) => {
    e.preventDefault();
    closeModal(signupModal);
    openModal(signinModal);
  });

  signinCreateLink?.addEventListener("click", (e) => {
    e.preventDefault();
    closeModal(signinModal);
    openModal(signupModal);
  });

  closeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      closeModal(signinModal);
      closeModal(signupModal);
    });
  });

  // Gate these CTAs behind login
  function routeOrLogin(targetPath) {
    const token = localStorage.getItem("token");
    if (token) {
      window.location.href = targetPath;
      return;
    }

  // user is not signed in -> open login modal
  closeModal(signupModal);
  closeModal(signinModal);
  openModal(signinModal);
  }

  startHostingBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    routeOrLogin("host.html");
  });

  browseTournamentsBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    routeOrLogin("join.html");
  });

  document.querySelectorAll('.password-toggle').forEach((btn) => {
  const targetId = btn.getAttribute('data-target');
  const input = targetId ? document.getElementById(targetId) : null;
  if (!input) return;

  btn.addEventListener('click', () => {
    const makeVisible = input.type === 'password';
    input.type = makeVisible ? 'text' : 'password';
    btn.classList.toggle('is-visible', makeVisible);
    btn.setAttribute('aria-label', makeVisible ? 'Hide password' : 'Show password');
  });
});


  /* ===============================
     SIGN IN
  =============================== */

  if (signinForm) {
    signinForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      console.log("🚀 LOGIN SUBMIT FIRED");

      const data = Object.fromEntries(new FormData(signinForm));

      try {
        const res = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: data.username,
            password: data.password
          })
        });

        const result = await res.json();

        if (!res.ok) {
          alert(result.message || "Login failed");
          return;
        }

        localStorage.setItem("token", result.token);

        // 🔍 Ask backend who the user is
        const meRes = await fetch("/api/me", {
          headers: {
            Authorization: "Bearer " + result.token
          }
        });

        const me = await meRes.json();

        // 🚦 Role-based redirect
        if (me.mode === "host") window.location.href = "host.html";
        else window.location.href = "join.html";


        

      } catch (err) {
        console.error("Login error:", err);
        alert("Network error during login");
      }
    });
  }

  /* ===============================
     SIGN UP
  =============================== */

  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      console.log("📝 SIGNUP SUBMIT FIRED");

      const data = Object.fromEntries(new FormData(signupForm));

      try {
        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data)
        });

        const result = await res.json();

        if (!res.ok) {
          alert(result.message || "Signup failed");
          return;
        }

        alert("Account created! Please sign in.");
        signupForm.reset();

        // Switch to sign-in modal
        closeModal(signupModal);
        openModal(signinModal);

      } catch (err) {
        console.error("Signup error:", err);
        alert("Network error during signup");
      }
    });
  }
  const signinBtn = document.querySelector(
  "#signin-form button[type='submit']"
);

if (signinBtn) {
  signinBtn.addEventListener("click", () => {
    console.log("🟢 SIGNIN BUTTON CLICKED");
  });
}


});
