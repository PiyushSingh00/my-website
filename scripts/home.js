// scripts/home.js

document.addEventListener("DOMContentLoaded", () => {
  const signinForm = document.getElementById("signin-form");
  const signupForm = document.getElementById("signup-form");

  // ---------- SIGN IN ----------
  if (signinForm) {
    signinForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const data = Object.fromEntries(new FormData(signinForm));

      try {
        const res = await fetch("http://51.20.51.85/api/login", {
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

        // ✅ Store ONLY token
        localStorage.setItem("token", result.token);

        window.location.href = "join.html";

      } catch (err) {
        console.error(err);
        alert("Network error");
      }
    });
  }

  // ---------- SIGN UP ----------
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const data = Object.fromEntries(new FormData(signupForm));

      try {
        const res = await fetch("http://51.20.51.85/api/register", {
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

      } catch (err) {
        console.error(err);
        alert("Network error");
      }
    });
  }
});
