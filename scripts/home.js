// scripts/home.js
console.log("🔥 home.js loaded");

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

  // Forms
  const signinForm = document.getElementById("signin-form");
  const signupForm = document.getElementById("signup-form");

  /* ===============================
     MODAL HELPERS
  =============================== */

  function openModal(modal) {
    if (!modal) return;
    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.style.display = "none";
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

        // Store JWT
        localStorage.setItem("token", result.token);

        // Redirect after login
        window.location.href = "join.html";

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
});
