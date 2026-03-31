import { requireAuth, logout } from "./auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;

  const params = new URLSearchParams(window.location.search);
  const tournamentId = params.get("tournamentId");

  if (!tournamentId) {
    alert("Missing tournamentId in URL.");
    window.location.href = "join.html";
    return;
  }

  let tournamentMeta = null;
  let allPlayers = [];
  let currentRule = {
    mode: "range", // "range" | "exact"
    min: 1,
    max: 1,
    exact: 1,
    text: "Select players."
  };

  const draftKey = `scheduleit_team_draft_${tournamentId}_${user.username || user.name || "user"}`;

  const trigger = document.getElementById("team-user-menu-trigger");
  const dropdown = document.getElementById("team-user-menu-dropdown");
  const playerBtn = document.getElementById("mode-player-btn");
  const hostBtn = document.getElementById("mode-host-btn");

  const backBtn = document.getElementById("team-back-btn");
  const teamForm = document.getElementById("team-form");
  const categorySelect = document.getElementById("team-category-select");
  const teamRowsWrap = document.getElementById("team-player-rows");
  const addPlayerRowBtn = document.getElementById("add-player-row-btn");
  const saveDraftBtn = document.getElementById("save-draft-btn");
  const teamNameInput = document.getElementById("team-name-input");

  const tournamentNameEl = document.getElementById("team-tournament-name");
  const tournamentSportEl = document.getElementById("team-tournament-sport");
  const tournamentDatesEl = document.getElementById("team-tournament-dates");
  const pageTitleEl = document.getElementById("team-page-title");
  const ruleTextEl = document.getElementById("team-rule-text");
  const ruleValueEl = document.getElementById("team-size-rule");
  const selectedCountEl = document.getElementById("selected-count");
  const requiredCountEl = document.getElementById("required-count");

  if (trigger) {
    const label = (user?.name || user?.username || user?.email || "U").trim();
    trigger.textContent = label.charAt(0).toUpperCase();
  }

  trigger?.addEventListener("click", () => dropdown?.classList.toggle("is-open"));

  document.addEventListener("click", (e) => {
    if (!dropdown || !trigger) return;
    if (!dropdown.contains(e.target) && !trigger.contains(e.target)) {
      dropdown.classList.remove("is-open");
    }
  });

  document.getElementById("dropdown-signout")?.addEventListener("click", () => {
    dropdown?.classList.remove("is-open");
    logout();
  });

  playerBtn?.classList.add("is-active");
  hostBtn?.classList.remove("is-active");

  playerBtn?.addEventListener("click", async () => {
    try {
      await fetch("/api/user/mode", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
        body: JSON.stringify({ mode: "player" }),
      });
    } catch {}
    window.location.href = "join.html";
  });

  hostBtn?.addEventListener("click", async () => {
    try {
      await fetch("/api/user/mode", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
        body: JSON.stringify({ mode: "host" }),
      });
    } catch {}
    window.location.href = "host.html";
  });

  backBtn?.addEventListener("click", () => {
    window.location.href = "join.html";
  });

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeCategories(cats) {
    if (!cats) return [];
    if (Array.isArray(cats)) return cats;
    if (typeof cats === "string") {
      try {
        const parsed = JSON.parse(cats);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  function getPlayerId(p) {
    return p.playerId ?? p.registrationId ?? p.id ?? p._id ?? p.pk ?? null;
  }

  function getPlayerName(p) {
    return p.playerName ?? p.name ?? p.fullName ?? p.username ?? "Player";
  }

  function getPlayerCategoryId(p) {
    return p.categoryId ?? p.category ?? p.categoryID ?? p.category_id ?? "";
  }

  function normalizeStatus(p) {
    const raw = p?.status ?? p?.registrationStatus ?? p?.state ?? "accepted";
    const s = String(raw).toLowerCase();
    if (["rejected", "reject", "declined", "denied"].includes(s)) return "rejected";
    if (["pending", "awaiting"].includes(s)) return "pending";
    return "accepted";
  }

  async function apiJson(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
    });

    const raw = await res.text();
    let data = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = raw;
    }

    return { ok: res.ok, status: res.status, data };
  }

  async function apiGet(url) {
    return apiJson(url, { method: "GET" });
  }

  function categoryLabel(c) {
    const age = c?.ageGroup ? String(c.ageGroup).trim() : "";
    const gender = c?.gender ? String(c.gender).trim() : "";
    const size = c?.teamSize ? Number(c.teamSize) : null;
    const exact = c?.exactTeamSize ? Number(c.exactTeamSize) : null;

    let type = "";
    if (size === 1) type = "Singles";
    else if (size === 2) type = "Doubles";
    else if (size === 3) type = "Triples";
    else if (size >= 4) type = exact ? `Team ${exact}` : "Team";

    const eventName = c?.eventName ? String(c.eventName).trim() : "";
    const parts = [eventName, age, gender, type].filter(Boolean);
    return parts.length ? parts.join(" • ") : (c?.categoryId || c?.id || "Category");
  }

  function getAcceptedPlayers() {
    return allPlayers.filter((p) => normalizeStatus(p) === "accepted");
  }

  function getPlayersForCategory(categoryId) {
    return getAcceptedPlayers().filter(
      (p) => String(getPlayerCategoryId(p)) === String(categoryId)
    );
  }

  function getSelectedValues() {
    return Array.from(teamRowsWrap.querySelectorAll(".team-player-select"))
      .map((select) => select.value)
      .filter(Boolean);
  }

  function getCurrentCategory() {
    const categories = normalizeCategories(tournamentMeta?.categories);
    return categories.find(
      (c) => String(c.categoryId || c.id) === String(categorySelect.value)
    ) || null;
  }

  function getRuleForCategory(category) {
    if (!category || !tournamentMeta) {
      return {
        mode: "range",
        min: 1,
        max: 1,
        exact: 1,
        text: "Select a category to continue.",
      };
    }

    if (tournamentMeta.tournamentType === "team") {
      const min = Number(tournamentMeta?.tournamentRules?.minPlayersPerTeam || 1);
      const max = Number(tournamentMeta?.tournamentRules?.maxPlayersPerTeam || min || 1);

      return {
        mode: "range",
        min,
        max,
        exact: null,
        text: `You must select minimum ${min} and maximum ${max} players.`,
      };
    }

    const teamSize = Number(category.teamSize || 1);
    const exactTeamSize =
      teamSize >= 4
        ? Number(category.exactTeamSize || teamSize || 4)
        : teamSize;

    return {
      mode: "exact",
      min: exactTeamSize,
      max: exactTeamSize,
      exact: exactTeamSize,
      text: `You must select exactly ${exactTeamSize} player${exactTeamSize > 1 ? "s" : ""} for this format.`,
    };
  }

  function updateRuleUi() {
    ruleTextEl.textContent = currentRule.text;

    if (currentRule.mode === "exact") {
      ruleValueEl.textContent = `Exactly ${currentRule.exact}`;
      requiredCountEl.textContent = String(currentRule.exact);
    } else {
      ruleValueEl.textContent = `${currentRule.min} to ${currentRule.max}`;
      requiredCountEl.textContent = `${currentRule.min} - ${currentRule.max}`;
    }

    selectedCountEl.textContent = String(getSelectedValues().length);
  }

  function makePlayerOptions(categoryId, selectedValue = "") {
    const categoryPlayers = getPlayersForCategory(categoryId);
    const selectedValues = new Set(getSelectedValues());

    return categoryPlayers.map((player) => {
      const value = String(getPlayerId(player));
      const disabled = selectedValues.has(value) && value !== selectedValue;
      return `
        <option value="${escapeHtml(value)}" ${value === selectedValue ? "selected" : ""} ${disabled ? "disabled" : ""}>
          ${escapeHtml(getPlayerName(player))}
        </option>
      `;
    }).join("");
  }

  function renderPlayerRows(savedValues = []) {
    const categoryId = categorySelect.value;
    teamRowsWrap.innerHTML = "";

    const count = savedValues.length || (currentRule.mode === "exact" ? currentRule.exact : currentRule.min);

    for (let i = 0; i < count; i++) {
      const selectedValue = savedValues[i] || "";

      const row = document.createElement("div");
      row.className = "team-player-row";
      row.innerHTML = `
        <div class="player-slot-label">Player ${i + 1}</div>

        <div class="field-group" style="margin-bottom:0;">
          <label>Select player</label>
          <select class="team-player-select" data-row-index="${i}" ${!categoryId ? "disabled" : ""}>
            <option value="">Select player</option>
            ${categoryId ? makePlayerOptions(categoryId, selectedValue) : ""}
          </select>
        </div>

        <button type="button" class="row-remove-btn">Remove</button>
      `;

      const select = row.querySelector(".team-player-select");
      if (select) select.value = selectedValue;

      select?.addEventListener("change", () => {
        refreshAllPlayerDropdowns();
        updateRuleUi();
      });

      row.querySelector(".row-remove-btn")?.addEventListener("click", () => {
        const currentValues = getSelectedValues();
        const rowValue = select?.value || "";
        const nextValues = currentValues.filter((v) => v !== rowValue);

        if (currentRule.mode === "exact" && nextValues.length < currentRule.exact) {
          alert(`This format requires exactly ${currentRule.exact} players.`);
          return;
        }

        if (currentRule.mode === "range" && nextValues.length < currentRule.min) {
          alert(`Minimum ${currentRule.min} players are required.`);
          return;
        }

        renderPlayerRows(nextValues);
        updateRuleUi();
      });

      teamRowsWrap.appendChild(row);
    }

    refreshAllPlayerDropdowns();
    updateRuleUi();
  }

  function refreshAllPlayerDropdowns() {
    const categoryId = categorySelect.value;
    if (!categoryId) return;

    const selects = Array.from(teamRowsWrap.querySelectorAll(".team-player-select"));

    selects.forEach((select) => {
      const current = select.value;
      select.innerHTML = `
        <option value="">Select player</option>
        ${makePlayerOptions(categoryId, current)}
      `;
      select.value = current;
    });

    selectedCountEl.textContent = String(getSelectedValues().length);
  }

  function populateCategoryDropdown() {
    const categories = normalizeCategories(tournamentMeta?.categories);

    categorySelect.innerHTML = `<option value="">Select category</option>`;

    categories.forEach((category) => {
      const id = category.categoryId || category.id;
      if (!id) return;

      const option = document.createElement("option");
      option.value = id;
      option.textContent = categoryLabel(category);
      categorySelect.appendChild(option);
    });
  }

  function saveDraft(showMessage = true) {
    const payload = {
      teamName: teamNameInput.value.trim(),
      categoryId: categorySelect.value,
      playerIds: getSelectedValues(),
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem(draftKey, JSON.stringify(payload));
    if (showMessage) alert("Team draft saved in browser.");
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function loadTournamentMeta() {
    const hostResp = await apiGet("/api/host/tournaments");
    if (hostResp.ok && Array.isArray(hostResp.data)) {
      const found = hostResp.data.find(
        (t) => String(t.tournamentId ?? t.id) === String(tournamentId)
      );
      if (found) return found;
    }

    const publicResp = await apiGet("/api/tournaments");
    if (publicResp.ok && Array.isArray(publicResp.data)) {
      const found = publicResp.data.find(
        (t) => String(t.tournamentId ?? t.id) === String(tournamentId)
      );
      if (found) return found;
    }

    return null;
  }

  async function loadPlayers() {
    const resp = await apiGet(`/api/tournaments/${encodeURIComponent(tournamentId)}/players`);
    if (!resp.ok) {
      alert("Could not load tournament players.");
      return [];
    }

    return Array.isArray(resp.data)
      ? resp.data
      : resp.data?.players || resp.data?.items || [];
  }

  function hydratePage() {
    pageTitleEl.textContent = `Create team`;
    tournamentNameEl.textContent = tournamentMeta?.tournamentName || "-";
    tournamentSportEl.textContent = tournamentMeta?.sportName || "-";
    tournamentDatesEl.textContent = tournamentMeta?.tournamentDates || "-";

    populateCategoryDropdown();

    const draft = loadDraft();
    if (draft?.teamName) teamNameInput.value = draft.teamName;
    if (draft?.categoryId) categorySelect.value = draft.categoryId;

    const category = getCurrentCategory();
    currentRule = getRuleForCategory(category);
    updateRuleUi();

    if (draft?.categoryId && category) {
      renderPlayerRows(Array.isArray(draft.playerIds) ? draft.playerIds : []);
    } else {
      teamRowsWrap.innerHTML = "";
    }
  }

  categorySelect?.addEventListener("change", () => {
    const category = getCurrentCategory();
    currentRule = getRuleForCategory(category);
    renderPlayerRows([]);
    updateRuleUi();
  });

  addPlayerRowBtn?.addEventListener("click", () => {
    const categoryId = categorySelect.value;
    if (!categoryId) {
      alert("Please select a category first.");
      return;
    }

    const selectedValues = getSelectedValues();

    if (selectedValues.length >= currentRule.max) {
      alert(`You can add maximum ${currentRule.max} players.`);
      return;
    }

    renderPlayerRows([...selectedValues, ""]);
    updateRuleUi();
  });

  saveDraftBtn?.addEventListener("click", () => {
    saveDraft(true);
  });

  teamForm?.addEventListener("submit", (e) => {
    e.preventDefault();

    const categoryId = categorySelect.value;
    if (!categoryId) {
      alert("Please select a category.");
      return;
    }

    const selectedValues = getSelectedValues();

    if (new Set(selectedValues).size !== selectedValues.length) {
      alert("Same player cannot be selected twice.");
      return;
    }

    if (currentRule.mode === "exact") {
      if (selectedValues.length !== currentRule.exact) {
        alert(`Please select exactly ${currentRule.exact} players.`);
        return;
      }
    } else {
      if (selectedValues.length < currentRule.min) {
        alert(`Please select at least ${currentRule.min} players.`);
        return;
      }
      if (selectedValues.length > currentRule.max) {
        alert(`Please select at most ${currentRule.max} players.`);
        return;
      }
    }

    const categoryPlayers = getPlayersForCategory(categoryId);
    const selectedPlayers = selectedValues
      .map((id) => categoryPlayers.find((p) => String(getPlayerId(p)) === String(id)))
      .filter(Boolean);

    const payload = {
      tournamentId,
      tournamentName: tournamentMeta?.tournamentName || "",
      teamName: teamNameInput.value.trim(),
      categoryId,
      categoryLabel: categoryLabel(getCurrentCategory()),
      createdBy: user.username || user.name || "",
      players: selectedPlayers.map((p) => ({
        playerId: getPlayerId(p),
        playerName: getPlayerName(p),
        categoryId: getPlayerCategoryId(p),
      })),
      savedAt: new Date().toISOString(),
    };

    localStorage.setItem(draftKey, JSON.stringify({
      teamName: payload.teamName,
      categoryId: payload.categoryId,
      playerIds: payload.players.map((p) => String(p.playerId)),
      updatedAt: payload.savedAt,
    }));

    localStorage.setItem(
      `scheduleit_team_submission_${tournamentId}_${user.username || user.name || "user"}`,
      JSON.stringify(payload)
    );

    alert("Team saved in browser for now. Backend can be connected later.");
  });

  tournamentMeta = await loadTournamentMeta();
  if (!tournamentMeta) {
    alert("Tournament not found.");
    window.location.href = "join.html";
    return;
  }

  allPlayers = await loadPlayers();
  hydratePage();
});