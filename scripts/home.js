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
  const forgotPasswordModal = document.getElementById("forgot-password-modal");

  // Buttons / links
  const heroSigninBtn = document.getElementById("hero-signin-btn");
  const createAccountBtn = document.getElementById("create-account-btn");
  const signupSigninLink = document.getElementById("signup-signin-link");
  const signinCreateLink = document.getElementById("signin-create-link");
  const forgotPasswordBtn = document.getElementById("forgot-password-btn");
  const forgotBackSigninLink = document.getElementById("forgot-back-signin-link");
  const closeButtons = document.querySelectorAll(".modal-close");
  const startHostingBtn = document.getElementById("start-hosting-btn");
  const browseTournamentsBtn = document.getElementById("browse-tournaments-btn");
  const verifyResetBtn = document.getElementById("verify-reset-btn");

  // Forms
  const signinForm = document.getElementById("signin-form");
  const signupForm = document.getElementById("signup-form");
  const forgotPasswordForm = document.getElementById("forgot-password-form");
  const securityQuestionPanel = document.getElementById("security-question-panel");
  const securityQuestionText = document.getElementById("security-question-text");
  const forgotAnswerGroup = document.getElementById("forgot-answer-group");
  const forgotNewPasswordGroup = document.getElementById("forgot-new-password-group");
  const forgotPasswordStatus = document.getElementById("forgot-password-status");
  const forgotPasswordSubmit = document.getElementById("forgot-password-submit");
  const forgotUsernameInput = document.getElementById("forgot-username");
  const forgotPhoneInput = document.getElementById("forgot-phone");
  const forgotSecurityAnswerInput = document.getElementById("forgot-security-answer");
  const forgotNewPasswordInput = document.getElementById("forgot-new-password");

  let verifiedResetIdentity = null;

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

function resetForgotPasswordState(options = {}) {
  const preserveIdentityInputs = Boolean(options.preserveIdentityInputs);
  const usernameValue = String(forgotUsernameInput?.value || "");
  const phoneValue = String(forgotPhoneInput?.value || "");
  verifiedResetIdentity = null;
  forgotPasswordForm?.reset();
  if (preserveIdentityInputs) {
    if (forgotUsernameInput) forgotUsernameInput.value = usernameValue;
    if (forgotPhoneInput) forgotPhoneInput.value = phoneValue;
  }
  if (forgotPasswordStatus) {
    forgotPasswordStatus.textContent = "";
    forgotPasswordStatus.className = "field-hint";
  }
  if (securityQuestionText) securityQuestionText.textContent = "-";
  securityQuestionPanel?.classList.add("hidden");
  forgotAnswerGroup?.classList.add("hidden");
  forgotNewPasswordGroup?.classList.add("hidden");
  forgotPasswordSubmit?.classList.add("hidden");
  if (forgotSecurityAnswerInput) forgotSecurityAnswerInput.required = false;
  if (forgotNewPasswordInput) forgotNewPasswordInput.required = false;
}

function setForgotPasswordStatus(message = "", type = "") {
  if (!forgotPasswordStatus) return;
  forgotPasswordStatus.textContent = message;
  forgotPasswordStatus.className = `field-hint${type ? ` ${type}` : ""}`;
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

  forgotPasswordBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    resetForgotPasswordState();
    closeModal(signinModal);
    openModal(forgotPasswordModal);
  });

  forgotBackSigninLink?.addEventListener("click", (e) => {
    e.preventDefault();
    closeModal(forgotPasswordModal);
    openModal(signinModal);
  });

  closeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      closeModal(signinModal);
      closeModal(signupModal);
      closeModal(forgotPasswordModal);
      resetForgotPasswordState();
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
  closeModal(forgotPasswordModal);
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

  [forgotUsernameInput, forgotPhoneInput].forEach((input) => {
    input?.addEventListener("input", () => {
      if (!verifiedResetIdentity) return;
      resetForgotPasswordState({ preserveIdentityInputs: true });
    });
  });

  verifyResetBtn?.addEventListener("click", async () => {
    const username = String(forgotUsernameInput?.value || "").trim();
    const phone = String(forgotPhoneInput?.value || "").trim();

    if (!username || !phone) {
      setForgotPasswordStatus("Enter username and phone number first.", "error");
      return;
    }

    setForgotPasswordStatus("Verifying your account...");

    try {
      const res = await fetch("/api/forgot-password/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, phone }),
      });

      const result = await res.json();
      if (!res.ok) {
        setForgotPasswordStatus(result.message || "Could not verify account.", "error");
        return;
      }

      verifiedResetIdentity = {
        username,
        phone,
        securityQuestionKey: result.securityQuestionKey,
      };

      securityQuestionText.textContent = result.securityQuestionLabel || "-";
      securityQuestionPanel?.classList.remove("hidden");
      forgotAnswerGroup?.classList.remove("hidden");
      forgotNewPasswordGroup?.classList.remove("hidden");
      forgotPasswordSubmit?.classList.remove("hidden");
      if (forgotSecurityAnswerInput) forgotSecurityAnswerInput.required = true;
      if (forgotNewPasswordInput) forgotNewPasswordInput.required = true;
      setForgotPasswordStatus("Identity verified. Answer the question and choose a new password.", "success");
    } catch (err) {
      console.error("Forgot password verification error:", err);
      setForgotPasswordStatus("Network error while verifying account.", "error");
    }
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

  if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (!verifiedResetIdentity) {
        setForgotPasswordStatus("Please verify your username and phone first.", "error");
        return;
      }

      const securityAnswer = String(forgotSecurityAnswerInput?.value || "").trim();
      const newPassword = String(forgotNewPasswordInput?.value || "");

      if (!securityAnswer || !newPassword) {
        setForgotPasswordStatus("Enter security answer and new password.", "error");
        return;
      }

      setForgotPasswordStatus("Updating password...");

      try {
        const res = await fetch("/api/forgot-password/reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: verifiedResetIdentity.username,
            phone: verifiedResetIdentity.phone,
            securityAnswer,
            newPassword,
          }),
        });

        const result = await res.json();
        if (!res.ok) {
          setForgotPasswordStatus(result.message || "Could not reset password.", "error");
          return;
        }

        setForgotPasswordStatus("Password updated. You can sign in now.", "success");
        setTimeout(() => {
          closeModal(forgotPasswordModal);
          resetForgotPasswordState();
          openModal(signinModal);
        }, 900);
      } catch (err) {
        console.error("Forgot password reset error:", err);
        setForgotPasswordStatus("Network error while resetting password.", "error");
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
