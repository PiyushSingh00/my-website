// Homepage interactivity
console.debug('ScheduleIt homepage loaded');

document.addEventListener('DOMContentLoaded', () => {
  const signupModal = document.getElementById('signup-modal');
  const signinModal = document.getElementById('signin-modal');

  const createAccountBtn = document.getElementById('create-account-btn');
  const heroSigninBtn = document.getElementById('hero-signin-btn');

  const signupCloseBtn = signupModal
    ? signupModal.querySelector('.modal-close')
    : null;
  const signinCloseBtn = signinModal
    ? signinModal.querySelector('.modal-close')
    : null;

  const signupForm = document.getElementById('signup-form');
  const signinForm = document.getElementById('signin-form');

  const signupSigninLink = document.getElementById('signup-signin-link');
  const signinCreateLink = document.getElementById('signin-create-link');

  // New: username + password elements
  const signupUsernameInput = document.getElementById('signup-username');
  const signupUsernameHint = document.getElementById('signup-username-hint');
  const signupPasswordInput = document.getElementById('signup-password');
  const signinPasswordInput = document.getElementById('signin-password');

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

  if (createAccountBtn && signupModal) {
    createAccountBtn.addEventListener('click', (event) => {
      event.preventDefault();
      openModal(signupModal);
    });
  }

  if (heroSigninBtn && signinModal) {
    heroSigninBtn.addEventListener('click', (event) => {
      event.preventDefault();
      openModal(signinModal);
    });
  }

  // ----- Close buttons -----

  if (signupCloseBtn && signupModal) {
    signupCloseBtn.addEventListener('click', () => closeModal(signupModal));
  }

  if (signinCloseBtn && signinModal) {
    signinCloseBtn.addEventListener('click', () => closeModal(signinModal));
  }

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
  if (signupSigninLink && signupModal && signinModal) {
    signupSigninLink.addEventListener('click', (event) => {
      event.preventDefault();
      closeModal(signupModal);
      openModal(signinModal);
    });
  }

  // "New here? Create account" inside signin modal
  if (signinCreateLink && signupModal && signinModal) {
    signinCreateLink.addEventListener('click', (event) => {
      event.preventDefault();
      closeModal(signinModal);
      openModal(signupModal);
    });
  }

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

  if (signupForm && signupModal) {
    signupForm.addEventListener('submit', (event) => {
      event.preventDefault();

      const formData = new FormData(signupForm);
      const data = Object.fromEntries(formData.entries());

      console.log('Signup form submitted:', data);

      const usernameNorm = normalizeUsername(data.username);
      if (!usernameNorm) {
        alert('Please choose a username.');
        if (signupUsernameInput) signupUsernameInput.focus();
        return;
      }

      if (isUsernameTaken(usernameNorm)) {
        updateUsernameHint();
        alert('This username is already taken. Please choose another one.');
        if (signupUsernameInput) signupUsernameInput.focus();
        return;
      }

      // Mark username as taken (locally)
      storedUsernames.push(usernameNorm);
      saveStoredUsernames(storedUsernames);

      alert('Account created! (Next step: save this to your backend.)');

      // Reset form, keep default role as "player"
      signupForm.reset();
      const roleSelect = signupForm.querySelector('#signup-role');
      if (roleSelect) roleSelect.value = 'player';

      // Clear username hint / validation styles
      if (signupUsernameHint) {
        signupUsernameHint.textContent = '';
        signupUsernameHint.className = 'field-hint';
      }
      if (signupUsernameInput) {
        signupUsernameInput.classList.remove('input-error', 'input-success');
      }

      // Reset password visibility for signup
      const signupToggle = document.querySelector(
        '.password-toggle[data-target="signup-password"]'
      );
      if (signupPasswordInput && signupToggle) {
        resetPasswordField(signupPasswordInput, signupToggle);
      }

      closeModal(signupModal);

      // If you want to automatically open the sign-in modal next, uncomment:
      // openModal(signinModal);
    });
  }

  // ----- Handle signin submit -----

  if (signinForm && signinModal) {
    signinForm.addEventListener('submit', (event) => {
      event.preventDefault();

      const formData = new FormData(signinForm);
      const data = Object.fromEntries(formData.entries());

      console.log('Signin form submitted:', data);

      // TODO: verify username/password with your backend before trusting it.
      // For now we just store the username locally.
      if (data.username) {
        localStorage.setItem('scheduleItUser', data.username);
      }

      signinForm.reset();

      // Reset password visibility for signin
      const signinToggle = document.querySelector(
        '.password-toggle[data-target="signin-password"]'
      );
      if (signinPasswordInput && signinToggle) {
        resetPasswordField(signinPasswordInput, signinToggle);
      }

      closeModal(signinModal);

      // Redirect to the post-sign-in Join page
      window.location.href = 'join.html';
    });
  }
});
