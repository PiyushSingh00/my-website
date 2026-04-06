// scripts/host.js
import { requireAuth, logout } from "./auth.js";

let allTournaments = [];
let currentSportFilter = "";
let currentSortFilter = "newest";
let viewOnlyMode = false;

function generateAccessCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code.slice(0, 4) + "-" + code.slice(4);
}

function getToken() {
  return localStorage.getItem("token") || localStorage.getItem("authToken") || "";
}

function isValidDate(d) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

function safeJsonParse(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeTournamentList(raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object") return [];

  const keys = ["tournaments", "items", "data", "rows", "results", "list", "payload"];
  for (const k of keys) {
    const v = raw[k];
    if (Array.isArray(v)) return v;
    if (v && typeof v === "object") {
      for (const k2 of keys) {
        const v2 = v[k2];
        if (Array.isArray(v2)) return v2;
      }
    }
  }

  return [];
}

function normalizeSingleTournament(raw) {
  if (!raw) return null;
  if (raw.tournamentId || raw.id) return raw;
  if (raw.data && (raw.data.tournamentId || raw.data.id)) return raw.data;
  if (raw.item && (raw.item.tournamentId || raw.item.id)) return raw.item;
  return raw;
}

function parseTournamentDateRange(raw) {
  const value = String(raw || "").trim();
  if (!value) return { start: null, end: null };

  const separators = [" to ", " - ", " – ", " — ", "to", "-", "–", "—"];
  for (const sep of separators) {
    if (!value.includes(sep)) continue;

    const parts = value.split(sep).map((x) => x.trim()).filter(Boolean);
    if (parts.length < 2) continue;

    const start = new Date(parts[0]);
    const end = new Date(parts[1]);

    return {
      start: isValidDate(start) ? start : null,
      end: isValidDate(end) ? end : null,
    };
  }

  const single = new Date(value);
  return {
    start: isValidDate(single) ? single : null,
    end: isValidDate(single) ? single : null,
  };
}

function formatDateRange(start, end) {
  if (!start && !end) return "";
  if (start && end) return `${start} to ${end}`;
  return start || end || "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function numberOrBlank(v) {
  if (v === "" || v == null) return "";
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : "";
}

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;

  // ---------------------------------------------------------------------------
  // DOM REFS
  // ---------------------------------------------------------------------------
  const generateCodeBtn = document.getElementById("generate-code-btn");
  const accessCodeInput = document.getElementById("access-code");
  const viewPlayersBtn = document.getElementById("modalViewPlayers");
  const sidebar = document.getElementById("host-sidebar");
  const sidebarToggleBtn = document.getElementById("sidebar-toggle-btn");

  const playerBtn = document.getElementById("mode-player-btn");
  const hostBtn = document.getElementById("mode-host-btn");

  const userMenuTrigger = document.getElementById("host-user-menu-trigger");
  const userMenuDropdown = document.getElementById("host-user-menu-dropdown");
  const signoutBtn = document.getElementById("dropdown-signout");

  const dashboardView = document.getElementById("dashboard-view");
  const myTournamentsView = document.getElementById("my-tournaments-view");
  const newTournamentView = document.getElementById("new-tournament-view");

  const dashboardUpcomingRow = document.getElementById("dashboard-upcoming-row");
  const monthLabel = document.getElementById("calendar-month-label");
  const calendarGrid = document.getElementById("dashboard-calendar-grid");
  const calendarPrevBtn = document.getElementById("calendar-prev-btn");
  const calendarNextBtn = document.getElementById("calendar-next-btn");

  const statTotalTournaments = document.getElementById("stat-total-tournaments");
  const statTotalPlayers = document.getElementById("stat-total-players");
  const statActiveEvents = document.getElementById("stat-active-events");

  const sportsPieCanvas = document.getElementById("sports-pie-chart");
  const sportsChartLegend = document.getElementById("sports-chart-legend");

  const filterSport = document.getElementById("filter-sport");
  const sortTournaments = document.getElementById("sort-tournaments");
  const myTournamentsList = document.getElementById("my-tournaments-list");
  const tournamentDetail = document.getElementById("tournament-detail");
  const detailTournamentName = document.getElementById("detail-tournament-name");
  const detailTournamentCode = document.getElementById("detail-tournament-code");
  const detailTotalRegistrations = document.getElementById("detail-total-registrations");
  const stopRegistrationsBtn = document.getElementById("stop-registrations-btn");

  const wizBackBtn = document.getElementById("wiz-back-btn");
  const wizNextBtn = document.getElementById("wiz-next-btn");
  const wizSubmitBtn = document.getElementById("wiz-submit-btn");
  const wizSaveNowBtn = document.getElementById("wiz-save-now-btn");
  const wizCancelEditBtn = document.getElementById("wiz-cancel-edit-btn");
  const wizViewPlayersBtn = document.getElementById("wiz-view-players-btn");
  const wizEditViewBtn = document.getElementById("wiz-edit-view-btn");
  const wizDots = document.querySelectorAll(".wiz-step-dot");
  const wizLines = document.querySelectorAll(".wiz-progress-line");

  const publicYesBtn = document.getElementById("w-public-yes");
  const publicNoBtn = document.getElementById("w-public-no");
  const paymentYesBtn = document.getElementById("w-payment-yes");
  const paymentNoBtn = document.getElementById("w-payment-no");
  const amountWrap = document.getElementById("wiz-amount-wrap");

  const tournamentTypeSelect = document.getElementById("w-tournament-type");
  const stageFormatSelect = document.getElementById("w-stage-format");
  const groupCountWrap = document.getElementById("wiz-group-count-wrap");
  const groupCountInput = document.getElementById("w-group-count");
  const eventCountInput = document.getElementById("w-event-count");
  const stageFormatNoteWrap = document.getElementById("w-stage-format-note");
  const stageFormatNoteText = document.getElementById("w-stage-format-note-text");
  const advancedFormatNoteWrap = document.getElementById("w-advanced-format-note");
  const advancedFormatNoteText = document.getElementById("w-advanced-format-note-text");
  const reviewBody = document.getElementById("wiz-review-body");
  const leaguePointsInputsWrap = document.getElementById("wiz-league-points-inputs");
  const leaguePointsNoteWrap = document.getElementById("wiz-league-points-note-wrap");

  // Advanced settings inputs
  const advancedModeInput = document.getElementById("w-advanced-mode");
  const rrRoundsInput = document.getElementById("w-rr-rounds");
  const qualifierCountInput = document.getElementById("w-qualifier-count");
  const tieSubmatchCountInput = document.getElementById("w-tie-submatch-count");
  const tieSubmatchWrap = document.getElementById("wiz-tie-submatch-wrap");
  const lineupLockRuleInput = document.getElementById("w-lineup-lock-rule");
  const participationRuleInput = document.getElementById("w-participation-rule");
  const tiebreakRuleInput = document.getElementById("w-tiebreak-rule");
  const semifinalPairingInput = document.getElementById("w-semifinal-pairing");

  let selectedTournamentId = null;
  let dashboardMonth = new Date().getMonth();
  let dashboardYear = new Date().getFullYear();

  const TOTAL_STEPS = 6;
  let currentStep = 0;
  let editingTournamentId = null;
  let viewingTournamentId = null;

  const wiz = {
    name: "",
    sport: "",
    dateStart: "",
    dateEnd: "",
    venue: "",
    details: "",
    accessCode: "",
    isPublic: true,

    tournamentType: "single",
    eventCount: 1,
    eventConfigs: [],

    stageFormat: "",
    groupCount: "",
    advancedSettings: {
      advancedMode: "",
      roundRobinMatches: "",
      qualifierCount: "",
      tieSubmatchCount: "",
      lineupLockRule: "",
      participationRule: "",
      tiebreakRule: "",
      semifinalPairing: "",
    },

    tournamentRules: {
      maxMatchesPerPlayer: "",
      bestOfSets: "",
      pointsPerSet: "",
      minPlayersPerTeam: "",
      maxPlayersPerTeam: "",
    },

    leaguePoints: {
      win: "",
      loss: "",
      draw: "",
    },

    courtCount: 1,
    courtNames: [],
    requirePayment: false,
    amount: "",
  };

  // ---------------------------------------------------------------------------
  // API HELPERS
  // ---------------------------------------------------------------------------
  async function apiJson(url, options = {}) {
    const headers = {
      ...(options.headers || {}),
    };

    if (!headers.Authorization) {
      const token = getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(url, { ...options, headers });
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

  async function apiPost(url, body) {
    return apiJson(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
  }

  async function apiPut(url, body) {
    return apiJson(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
  }

  async function apiPatch(url, body) {
    return apiJson(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
  }

  async function apiDelete(url) {
    return apiJson(url, { method: "DELETE" });
  }

  // ---------------------------------------------------------------------------
  // TOPBAR / MODE / SIDEBAR
  // ---------------------------------------------------------------------------
  function initUserMenu() {
    if (userMenuTrigger) {
      const label = String(user?.name || user?.username || user?.email || "U").trim();
      userMenuTrigger.textContent = (label[0] || "U").toUpperCase();
    }

    userMenuTrigger?.addEventListener("click", (e) => {
      e.stopPropagation();
      userMenuDropdown?.classList.toggle("is-open");
    });

    document.addEventListener("click", (e) => {
      if (!userMenuDropdown || !userMenuTrigger) return;
      if (!userMenuDropdown.contains(e.target) && !userMenuTrigger.contains(e.target)) {
        userMenuDropdown.classList.remove("is-open");
      }
    });

    signoutBtn?.addEventListener("click", () => {
      userMenuDropdown?.classList.remove("is-open");
      logout();
    });
  }

  function initModeToggle() {
    hostBtn?.classList.add("is-active");
    playerBtn?.classList.remove("is-active");

    playerBtn?.addEventListener("click", async () => {
      try {
        await apiPost("/api/user/mode", { mode: "player" });
      } catch {}
      window.location.href = "join.html";
    });

    hostBtn?.addEventListener("click", async () => {
      try {
        await apiPost("/api/user/mode", { mode: "host" });
      } catch {}
    });
  }

  function initSidebar() {
    sidebarToggleBtn?.addEventListener("click", () => {
      sidebar?.classList.toggle("is-collapsed");
    });

    document.querySelectorAll(".host-mode-card").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.hostMode;
        if (mode === "dashboard") switchHostView("dashboard");
        else if (mode === "my") switchHostView("my");
        else switchHostView("new");
      });
    });
  }

  // ---------------------------------------------------------------------------
  // VIEW SWITCHING
  // ---------------------------------------------------------------------------
  function switchHostView(view) {
    document.querySelectorAll(".host-mode-card").forEach((c) => c.classList.remove("active"));
    dashboardView?.classList.remove("host-view--active");
    myTournamentsView?.classList.remove("host-view--active");
    newTournamentView?.classList.remove("host-view--active");

    if (view === "dashboard") {
      document.querySelector('[data-host-mode="dashboard"]')?.classList.add("active");
      dashboardView?.classList.add("host-view--active");
    } else if (view === "my") {
      document.querySelector('[data-host-mode="my"]')?.classList.add("active");
      myTournamentsView?.classList.add("host-view--active");
    } else {
      document.querySelector('[data-host-mode="new"]')?.classList.add("active");
      newTournamentView?.classList.add("host-view--active");
    }
  }

  // ---------------------------------------------------------------------------
  // WIZARD UI
  // ---------------------------------------------------------------------------
  function updateProgress() {
    wizDots.forEach((dot, i) => {
      dot.classList.toggle("active", i === currentStep);
      dot.classList.toggle("complete", i < currentStep);
    });

    wizLines.forEach((line, i) => {
      line.classList.toggle("complete", i < currentStep);
    });

    if (wizBackBtn) {
      wizBackBtn.classList.toggle("hidden", currentStep === 0 || viewOnlyMode);
    }

    setWizardModeUI();
  }

  function setWizardModeUI() {
    const isEditMode = !!editingTournamentId;
    const isViewMode = !!viewOnlyMode;

    wizBackBtn?.classList.toggle("hidden", isViewMode || currentStep === 0);
    wizNextBtn?.classList.toggle("hidden", isViewMode);

    if (wizSaveNowBtn) {
      wizSaveNowBtn.classList.toggle("hidden", !isEditMode || isViewMode);
    }

    if (wizSubmitBtn) {
      if (isViewMode) {
        wizSubmitBtn.classList.add("hidden");
      } else {
        wizSubmitBtn.classList.toggle("hidden", currentStep !== TOTAL_STEPS - 1);
        wizSubmitBtn.textContent = isEditMode ? "💾 Save changes" : "🚀 Create tournament";
      }
    }

    if (wizCancelEditBtn) {
      wizCancelEditBtn.classList.toggle("hidden", !(isEditMode || isViewMode));
      wizCancelEditBtn.textContent = isViewMode ? "← Back to My tournaments" : "Cancel";
    }

    wizViewPlayersBtn?.classList.toggle("hidden", !isViewMode);
    wizEditViewBtn?.classList.toggle("hidden", !isViewMode);

    if (generateCodeBtn && accessCodeInput) {
      generateCodeBtn.classList.toggle("hidden", isViewMode);
      accessCodeInput.toggleAttribute("readonly", true);
    }
  }

  function showStep(n) {
    document.querySelectorAll(".wiz-step").forEach((el, i) => {
      el.classList.toggle("active", i === n);
    });
    currentStep = n;
    updateProgress();
    if (n === TOTAL_STEPS - 1) buildReview();
  }

  function isPowerOfTwo(value) {
    const num = Number(value);
    return num > 0 && (num & (num - 1)) === 0;
  }

  function shouldShowLeaguePointsBlock() {
    return (
      wiz.stageFormat === "round_robin" ||
      wiz.stageFormat === "group_knockout" ||
      wiz.stageFormat === "round_robin_knockout"
    );
  }

  function shouldUseMatchPointStandings() {
    return wiz.advancedSettings.advancedMode === "pickleball_team_league";
  }

  function updateFormatNotes() {
    const stageNote = {
      knockout: "Straight elimination bracket. Lose once and the team or player is out.",
      round_robin: "Everyone plays everyone in one league table.",
      group_knockout: "Teams are divided into groups first, then top teams move to knockout.",
      round_robin_knockout: "All teams play in one common league table. No groups are created. Top teams qualify for knockout.",
    }[wiz.stageFormat] || "";

    if (stageFormatNoteWrap && stageFormatNoteText) {
      stageFormatNoteText.textContent = stageNote;
      stageFormatNoteWrap.classList.toggle("hidden", !stageNote);
    }

    const advancedNote = wiz.advancedSettings.advancedMode === "pickleball_team_league"
      ? "Pickleball team league defaults: 5 league ties per team, submatches per tie will match number of categories for team events, leaderboard is based on cumulative actual points scored across all submatches, top 4 go to semifinals, tiebreak: head-to-head → ties won → decider tie, semifinals 1 vs 4 and 2 vs 3."
      : "";

    if (advancedFormatNoteWrap && advancedFormatNoteText) {
      advancedFormatNoteText.textContent = advancedNote;
      advancedFormatNoteWrap.classList.toggle("hidden", !advancedNote);
    }
  }

  function toggleLeaguePointsSection() {
    const wrap = document.getElementById("wiz-league-points-wrap");
    if (!wrap) return;

    const showBlock = shouldShowLeaguePointsBlock();
    wrap.classList.toggle("hidden", !showBlock);

    if (leaguePointsInputsWrap) {
      leaguePointsInputsWrap.classList.toggle("hidden", shouldUseMatchPointStandings());
    }
    if (leaguePointsNoteWrap) {
      leaguePointsNoteWrap.classList.toggle("hidden", !shouldUseMatchPointStandings());
    }
  }

  function toggleTeamPlayerLimitsSection() {
    const minWrap = document.getElementById("wiz-min-players-wrap");
    const maxWrap = document.getElementById("wiz-max-players-wrap");
    const show = wiz.tournamentType === "team";
    minWrap?.classList.toggle("hidden", !show);
    maxWrap?.classList.toggle("hidden", !show);
  }

  function getEffectiveTieSubmatchCount() {
    if (wiz.tournamentType === "team") {
      return Math.max(1, Number(wiz.eventCount || 1));
    }

    const manual = Number(tieSubmatchCountInput?.value || wiz.advancedSettings.tieSubmatchCount || 0);
    return manual > 0 ? manual : Math.max(1, Number(wiz.eventCount || 1));
  }

  function toggleTieSubmatchField() {
    const isTeamEvent = wiz.tournamentType === "team";
    tieSubmatchWrap?.classList.toggle("hidden", isTeamEvent);

    if (isTeamEvent) {
      const derived = String(getEffectiveTieSubmatchCount());
      wiz.advancedSettings.tieSubmatchCount = derived;
      if (tieSubmatchCountInput) tieSubmatchCountInput.value = derived;
    }
  }

  function toggleGroupCountSection() {
    const show = wiz.stageFormat === "group_knockout";
    groupCountWrap?.classList.toggle("hidden", !show);
  }

  function toggleAmountSection() {
    amountWrap?.classList.toggle("hidden", !wiz.requirePayment);
  }

  function openNativeDatePicker(input) {
    if (!input) return;
    if (typeof input.showPicker === "function") input.showPicker();
    else {
      input.focus();
      input.click();
    }
  }

  function syncCourtCount() {
    const display = document.getElementById("w-court-count-display");
    if (display) display.textContent = String(wiz.courtCount);
    while (wiz.courtNames.length < wiz.courtCount) wiz.courtNames.push("");
    wiz.courtNames = wiz.courtNames.slice(0, wiz.courtCount);
  }

  function buildEventNameFromConfig(cfg = {}) {
    const age = String(cfg.ageGroup || "").trim();
    const gender = String(cfg.gender || "").trim();
    const level = String(cfg.playingLevel || "").trim();

    const teamSize = Number(cfg.teamSize || 1);
    const exact = Number(cfg.exactTeamSize || 0);

    let formatText = "";
    if (teamSize === 1) formatText = "Singles";
    else if (teamSize === 2) formatText = "Doubles";
    else if (teamSize === 3) formatText = "Triples";
    else if (teamSize >= 4) formatText = exact ? `Team ${exact}` : "Team";

    return [age, gender, level, formatText].filter(Boolean).join(" • ");
  }

  function renderEventConfig() {
    const wrap = document.getElementById("wiz-event-config");
    if (!wrap) return;

    wrap.innerHTML = "";
    const count = Math.max(1, Number(wiz.eventCount || 1));

    while (wiz.eventConfigs.length < count) {
      wiz.eventConfigs.push({
        categoryId: "",
        gender: "",
        ageGroup: "",
        playingLevel: "",
        teamSize: "1",
        exactTeamSize: "",
        eventName: "",
      });
    }
    wiz.eventConfigs = wiz.eventConfigs.slice(0, count);

    for (let i = 0; i < count; i++) {
      const cfg = wiz.eventConfigs[i];
      cfg.eventName = buildEventNameFromConfig(cfg) || `Category ${i + 1}`;
      const showExactTeamSizeField = cfg.teamSize === "4";

      const card = document.createElement("div");
      card.className = "wiz-event-cfg-card";
      card.innerHTML = `
        <div class="wiz-event-cfg-title">${escapeHtml(cfg.eventName || `Category ${i + 1}`)}</div>
        <div class="wiz-cfg-grid">
          <div class="field-group">
            <label>Gender</label>
            <select class="wiz-cfg-sel" data-idx="${i}" data-field="gender">
              <option value="">Any</option>
              <option value="Male" ${cfg.gender === "Male" ? "selected" : ""}>Male</option>
              <option value="Female" ${cfg.gender === "Female" ? "selected" : ""}>Female</option>
              <option value="Mixed" ${cfg.gender === "Mixed" ? "selected" : ""}>Mixed</option>
            </select>
          </div>

          <div class="field-group">
            <label>Age group</label>
            <select class="wiz-cfg-sel" data-idx="${i}" data-field="ageGroup">
              <option value="">Any</option>
              <option value="U12" ${cfg.ageGroup === "U12" ? "selected" : ""}>U12</option>
              <option value="U14" ${cfg.ageGroup === "U14" ? "selected" : ""}>U14</option>
              <option value="U16" ${cfg.ageGroup === "U16" ? "selected" : ""}>U16</option>
              <option value="U18" ${cfg.ageGroup === "U18" ? "selected" : ""}>U18</option>
              <option value="U21" ${cfg.ageGroup === "U21" ? "selected" : ""}>U21</option>
              <option value="Open" ${cfg.ageGroup === "Open" ? "selected" : ""}>Open</option>
              <option value="35+" ${cfg.ageGroup === "35+" ? "selected" : ""}>35+</option>
              <option value="50+" ${cfg.ageGroup === "50+" ? "selected" : ""}>50+</option>
            </select>
          </div>

          <div class="field-group">
            <label>Playing level</label>
            <select class="wiz-cfg-sel" data-idx="${i}" data-field="playingLevel">
              <option value="">Any</option>
              <option value="Beginner" ${cfg.playingLevel === "Beginner" ? "selected" : ""}>Beginner</option>
              <option value="Intermediate" ${cfg.playingLevel === "Intermediate" ? "selected" : ""}>Intermediate</option>
              <option value="Advanced" ${cfg.playingLevel === "Advanced" ? "selected" : ""}>Advanced</option>
              <option value="Professional" ${cfg.playingLevel === "Professional" ? "selected" : ""}>Professional</option>
            </select>
          </div>

          <div class="field-group">
            <label>Format</label>
            <select class="wiz-cfg-sel" data-idx="${i}" data-field="teamSize">
              <option value="1" ${cfg.teamSize === "1" ? "selected" : ""}>Singles (1v1)</option>
              <option value="2" ${cfg.teamSize === "2" ? "selected" : ""}>Doubles (2v2)</option>
              <option value="3" ${cfg.teamSize === "3" ? "selected" : ""}>Triples (3v3)</option>
              <option value="4" ${cfg.teamSize === "4" ? "selected" : ""}>Team (4+)</option>
            </select>
          </div>

          ${
            showExactTeamSizeField
              ? `
          <div class="field-group">
            <label>Exact team size</label>
            <input
              type="number"
              min="4"
              class="wiz-cfg-inp"
              data-idx="${i}"
              data-field="exactTeamSize"
              placeholder="e.g. 11"
              value="${escapeHtml(cfg.exactTeamSize || "")}"
            />
          </div>
          `
              : ""
          }
        </div>
      `;

      wrap.appendChild(card);
    }

    wrap.querySelectorAll(".wiz-cfg-sel").forEach((sel) => {
      sel.addEventListener("change", () => {
        const idx = Number(sel.dataset.idx);
        const field = sel.dataset.field;
        wiz.eventConfigs[idx][field] = sel.value;

        if (field === "teamSize" && sel.value !== "4") {
          wiz.eventConfigs[idx].exactTeamSize = "";
        }
        renderEventConfig();
      });
    });

    wrap.querySelectorAll(".wiz-cfg-inp").forEach((inp) => {
      inp.addEventListener("input", () => {
        wiz.eventConfigs[Number(inp.dataset.idx)][inp.dataset.field] = inp.value;
      });
    });

    toggleLeaguePointsSection();
    toggleTeamPlayerLimitsSection();
    toggleTieSubmatchField();
  }

  function renderCourtNameFields() {
    const wrap = document.getElementById("wiz-court-name-fields");
    if (!wrap) return;

    wrap.innerHTML = "";
    while (wiz.courtNames.length < wiz.courtCount) wiz.courtNames.push("");
    wiz.courtNames = wiz.courtNames.slice(0, wiz.courtCount);

    for (let i = 0; i < wiz.courtCount; i++) {
      const div = document.createElement("div");
      div.className = "field-group";
      div.innerHTML = `
        <label>Court ${i + 1}</label>
        <input
          type="text"
          class="wiz-court-inp"
          data-idx="${i}"
          placeholder="e.g. Court A"
          value="${escapeHtml(wiz.courtNames[i] || "")}"
        />
      `;
      wrap.appendChild(div);
    }

    wrap.querySelectorAll(".wiz-court-inp").forEach((input) => {
      input.addEventListener("input", (e) => {
        const idx = Number(e.target.dataset.idx);
        wiz.courtNames[idx] = e.target.value;
      });
    });
  }

  function syncFormFromState() {
    const setVal = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.value = value ?? "";
    };

    setVal("w-name", wiz.name);
    setVal("w-sport", wiz.sport);
    setVal("w-date-start", wiz.dateStart);
    setVal("w-date-end", wiz.dateEnd);
    setVal("w-venue", wiz.venue);
    setVal("w-details", wiz.details);
    setVal("access-code", wiz.accessCode);
    setVal("w-tournament-type", wiz.tournamentType);
    setVal("w-stage-format", wiz.stageFormat);
    setVal("w-group-count", wiz.groupCount);
    setVal("w-event-count", wiz.eventCount);

    setVal("w-max-matches-per-player", wiz.tournamentRules.maxMatchesPerPlayer);
    setVal("w-best-of-sets", wiz.tournamentRules.bestOfSets);
    setVal("w-points-per-set", wiz.tournamentRules.pointsPerSet);
    setVal("w-min-players-per-team", wiz.tournamentRules.minPlayersPerTeam);
    setVal("w-max-players-per-team", wiz.tournamentRules.maxPlayersPerTeam);

    setVal("w-points-win", wiz.leaguePoints.win);
    setVal("w-points-loss", wiz.leaguePoints.loss);
    setVal("w-points-draw", wiz.leaguePoints.draw);

    setVal("w-amount", wiz.amount);

    setVal("w-advanced-mode", wiz.advancedSettings.advancedMode);
    setVal("w-rr-rounds", wiz.advancedSettings.roundRobinMatches);
    setVal("w-qualifier-count", wiz.advancedSettings.qualifierCount);
    setVal("w-tie-submatch-count", wiz.advancedSettings.tieSubmatchCount);
    setVal("w-lineup-lock-rule", wiz.advancedSettings.lineupLockRule);
    setVal("w-participation-rule", wiz.advancedSettings.participationRule);
    setVal("w-tiebreak-rule", wiz.advancedSettings.tiebreakRule);
    setVal("w-semifinal-pairing", wiz.advancedSettings.semifinalPairing);

    publicYesBtn?.classList.toggle("active", !!wiz.isPublic);
    publicNoBtn?.classList.toggle("active", !wiz.isPublic);

    paymentYesBtn?.classList.toggle("active", !!wiz.requirePayment);
    paymentNoBtn?.classList.toggle("active", !wiz.requirePayment);

    syncCourtCount();
    renderCourtNameFields();
    renderEventConfig();
    toggleGroupCountSection();
    toggleLeaguePointsSection();
    toggleTeamPlayerLimitsSection();
    toggleTieSubmatchField();
    toggleAmountSection();
    updateFormatNotes();
  }

  function resetWizardState() {
    wiz.name = "";
    wiz.sport = "";
    wiz.dateStart = "";
    wiz.dateEnd = "";
    wiz.venue = "";
    wiz.details = "";
    wiz.accessCode = "";
    wiz.isPublic = true;

    wiz.tournamentType = "single";
    wiz.eventCount = 1;
    wiz.eventConfigs = [];

    wiz.stageFormat = "";
    wiz.groupCount = "";

    wiz.advancedSettings = {
      advancedMode: "",
      roundRobinMatches: "",
      qualifierCount: "",
      tieSubmatchCount: "",
      lineupLockRule: "",
      participationRule: "",
      tiebreakRule: "",
      semifinalPairing: "",
    };

    wiz.tournamentRules = {
      maxMatchesPerPlayer: "",
      bestOfSets: "",
      pointsPerSet: "",
      minPlayersPerTeam: "",
      maxPlayersPerTeam: "",
    };

    wiz.leaguePoints = {
      win: "",
      loss: "",
      draw: "",
    };

    wiz.courtCount = 1;
    wiz.courtNames = [];
    wiz.requirePayment = false;
    wiz.amount = "";

    editingTournamentId = null;
    viewingTournamentId = null;
    viewOnlyMode = false;

    syncFormFromState();
    showStep(0);
    setWizardModeUI();
  }

  function collectStep(n) {
    if (n === 0) {
      wiz.name = document.getElementById("w-name")?.value.trim() || "";
      wiz.sport = document.getElementById("w-sport")?.value || "";
      wiz.dateStart = document.getElementById("w-date-start")?.value || "";
      wiz.dateEnd = document.getElementById("w-date-end")?.value || "";
      wiz.venue = document.getElementById("w-venue")?.value.trim() || "";
      wiz.details = document.getElementById("w-details")?.value.trim() || "";
      wiz.accessCode = document.getElementById("access-code")?.value.trim() || "";
    }

    if (n === 1) {
      wiz.tournamentType = tournamentTypeSelect?.value || "single";
      wiz.stageFormat = stageFormatSelect?.value || "";
      wiz.groupCount = groupCountInput?.value || "";
      wiz.eventCount = Math.max(1, Number(eventCountInput?.value || 1));

      wiz.advancedSettings.advancedMode = advancedModeInput?.value || "";
      wiz.advancedSettings.roundRobinMatches = rrRoundsInput?.value || "";
      wiz.advancedSettings.qualifierCount = qualifierCountInput?.value || "";
      wiz.advancedSettings.tieSubmatchCount = String(getEffectiveTieSubmatchCount());
      wiz.advancedSettings.lineupLockRule = lineupLockRuleInput?.value || "";
      wiz.advancedSettings.participationRule = participationRuleInput?.value || "";
      wiz.advancedSettings.tiebreakRule = tiebreakRuleInput?.value || "";
      wiz.advancedSettings.semifinalPairing = semifinalPairingInput?.value || "";
    }

    if (n === 2) {
      wiz.tournamentRules.maxMatchesPerPlayer =
        document.getElementById("w-max-matches-per-player")?.value || "";
      wiz.tournamentRules.bestOfSets =
        document.getElementById("w-best-of-sets")?.value || "";
      wiz.tournamentRules.pointsPerSet =
        document.getElementById("w-points-per-set")?.value || "";
      wiz.tournamentRules.minPlayersPerTeam =
        document.getElementById("w-min-players-per-team")?.value || "";
      wiz.tournamentRules.maxPlayersPerTeam =
        document.getElementById("w-max-players-per-team")?.value || "";

    }

    if (n === 4) {
      wiz.amount = document.getElementById("w-amount")?.value || "";
    }
  }

  function validateStep(n) {
    if (n === 0) {
      if (!document.getElementById("w-name")?.value.trim()) {
        alert("Please enter the tournament name.");
        return false;
      }
      if (!document.getElementById("w-sport")?.value) {
        alert("Please select a sport.");
        return false;
      }
      if (!document.getElementById("w-date-start")?.value) {
        alert("Please set a start date.");
        return false;
      }
      if (!document.getElementById("w-date-end")?.value) {
        alert("Please set an end date.");
        return false;
      }
      if (!document.getElementById("w-venue")?.value.trim()) {
        alert("Please enter a venue.");
        return false;
      }
    }

    if (n === 1) {
      const stageFormat = document.getElementById("w-stage-format")?.value || "";
      if (!stageFormat) {
        alert("Please select the format of tournament.");
        return false;
      }

      if (stageFormat === "group_knockout") {
        const groupCount = document.getElementById("w-group-count")?.value;
        if (!groupCount) {
          alert("Please enter number of groups.");
          return false;
        }
        if (!isPowerOfTwo(groupCount)) {
          alert("Number of groups must be a power of 2, like 2, 4, 8 or 16.");
          return false;
        }
      }

      const eventCount = Number(document.getElementById("w-event-count")?.value || 0);
      if (!eventCount || eventCount < 1) {
        alert("Please enter number of categories.");
        return false;
      }

      const advancedMode = advancedModeInput?.value || "";
        if (advancedMode === "pickleball_team_league" || stageFormat === "round_robin_knockout") {
          const rrRounds = Number(rrRoundsInput?.value || 0);
          const qualifiers = Number(qualifierCountInput?.value || 0);
          const submatches = getEffectiveTieSubmatchCount();

          if (!rrRounds || rrRounds < 1) {
            alert("Please enter the number of league rounds.");
            return false;
          }
          if (!qualifiers || qualifiers < 2) {
            alert("Please enter how many teams qualify.");
            return false;
          }
          if (!submatches || submatches < 1) {
            alert("Please enter number of submatches per tie.");
            return false;
          }
        }
    }

    if (n === 2) {
      const missingExactTeamSize = wiz.eventConfigs.some(
        (cfg) => cfg.teamSize === "4" && !String(cfg.exactTeamSize || "").trim()
      );
      if (missingExactTeamSize) {
        alert('Please enter the exact team size for every event where format is "Team (4+)".');
        return false;
      }

      if (wiz.tournamentType === "team") {
        const minVal = Number(document.getElementById("w-min-players-per-team")?.value || 0);
        const maxVal = Number(document.getElementById("w-max-players-per-team")?.value || 0);

        if (!minVal || !maxVal || minVal > maxVal) {
          alert("Please enter valid minimum and maximum players per team.");
          return false;
        }
      }
    }

    if (n === 4) {
      if (wiz.requirePayment && !document.getElementById("w-amount")?.value) {
        alert("Please enter the entry fee amount.");
        return false;
      }
    }

    return true;
  }

  function buildReview() {
    if (!reviewBody) return;

    const courtList =
      wiz.courtNames.filter(Boolean).join(", ") ||
      Array.from({ length: wiz.courtCount }, (_, i) => `Court ${i + 1}`).join(", ");

    const eventRows = wiz.eventConfigs
      .map((cfg, i) => {
        const label = buildEventNameFromConfig(cfg) || `Category ${i + 1}`;
        const extras =
          cfg.teamSize === "4" && cfg.exactTeamSize
            ? ` • Exact team size: ${escapeHtml(cfg.exactTeamSize)}`
            : "";
        return `<li>${escapeHtml(label)}${extras}</li>`;
      })
      .join("");

    reviewBody.innerHTML = `
      <div class="review-section">
        <h3>Basics</h3>
        <p><strong>Name:</strong> ${escapeHtml(wiz.name)}</p>
        <p><strong>Sport:</strong> ${escapeHtml(wiz.sport)}</p>
        <p><strong>Dates:</strong> ${escapeHtml(formatDateRange(wiz.dateStart, wiz.dateEnd))}</p>
        <p><strong>Venue:</strong> ${escapeHtml(wiz.venue)}</p>
        <p><strong>Visibility:</strong> ${wiz.isPublic ? "Public" : "Private"}</p>
        <p><strong>Details:</strong> ${escapeHtml(wiz.details || "—")}</p>
      </div>

      <div class="review-section">
        <h3>Format</h3>
        <p><strong>Tournament type:</strong> ${escapeHtml(wiz.tournamentType)}</p>
        <p><strong>Stage format:</strong> ${escapeHtml(wiz.stageFormat || "—")}</p>
        <p><strong>Group count:</strong> ${escapeHtml(wiz.groupCount || "—")}</p>
        <p><strong>Categories:</strong> ${escapeHtml(String(wiz.eventCount))}</p>
      </div>

      <div class="review-section">
        <h3>Advanced settings</h3>
        <p><strong>Advanced mode:</strong> ${escapeHtml(wiz.advancedSettings.advancedMode || "—")}</p>
        <p><strong>League rounds:</strong> ${escapeHtml(wiz.advancedSettings.roundRobinMatches || "—")}</p>
        <p><strong>Qualifier count:</strong> ${escapeHtml(wiz.advancedSettings.qualifierCount || "—")}</p>
        <p><strong>Submatches per tie:</strong> ${escapeHtml(String(getEffectiveTieSubmatchCount()))}</p>
        <p><strong>Lineup lock rule:</strong> ${escapeHtml(wiz.advancedSettings.lineupLockRule || "—")}</p>
        <p><strong>Participation rule:</strong> ${escapeHtml(wiz.advancedSettings.participationRule || "—")}</p>
        <p><strong>Tiebreak rule:</strong> ${escapeHtml(wiz.advancedSettings.tiebreakRule || "—")}</p>
        <p><strong>Semifinal pairing:</strong> ${escapeHtml(wiz.advancedSettings.semifinalPairing || "—")}</p>
      </div>

      <div class="review-section">
        <h3>Categories</h3>
        <ul>${eventRows || "<li>—</li>"}</ul>
      </div>

      <div class="review-section">
        <h3>Rules</h3>
        <p><strong>Max matches per player:</strong> ${escapeHtml(wiz.tournamentRules.maxMatchesPerPlayer || "—")}</p>
        <p><strong>Best of sets:</strong> ${escapeHtml(wiz.tournamentRules.bestOfSets || "—")}</p>
        <p><strong>Points per set:</strong> ${escapeHtml(wiz.tournamentRules.pointsPerSet || "—")}</p>
        <p><strong>Min players per team:</strong> ${escapeHtml(wiz.tournamentRules.minPlayersPerTeam || "—")}</p>
        <p><strong>Max players per team:</strong> ${escapeHtml(wiz.tournamentRules.maxPlayersPerTeam || "—")}</p>
        <p><strong>Standings rule:</strong> ${shouldUseMatchPointStandings() ? "Calculated from cumulative actual points scored across all submatches" : `Win ${escapeHtml(wiz.leaguePoints.win || "—")}, Loss ${escapeHtml(wiz.leaguePoints.loss || "—")}, Draw ${escapeHtml(wiz.leaguePoints.draw || "—")}`}</p>
      </div>

      <div class="review-section">
        <h3>Courts & payment</h3>
        <p><strong>Courts:</strong> ${escapeHtml(String(wiz.courtCount))}</p>
        <p><strong>Court names:</strong> ${escapeHtml(courtList)}</p>
        <p><strong>Payment required:</strong> ${wiz.requirePayment ? "Yes" : "No"}</p>
        <p><strong>Amount:</strong> ${escapeHtml(wiz.amount || "—")}</p>
      </div>
    `;
  }

  function buildTournamentPayload() {
    return {
      tournamentName: wiz.name,
      sportName: wiz.sport,
      tournamentDates: formatDateRange(wiz.dateStart, wiz.dateEnd),
      venue: wiz.venue,
      playerDetails: wiz.details,
      accessCode: wiz.accessCode || generateAccessCode(),
      isPublic: wiz.isPublic,
      registrationsOpen: true,

      tournamentType: wiz.tournamentType,
      stageFormat: wiz.stageFormat,
      groupCount: wiz.groupCount ? Number(wiz.groupCount) : null,

      advancedSettings: {
        advancedMode: wiz.advancedSettings.advancedMode || null,
        roundRobinMatches: wiz.advancedSettings.roundRobinMatches
          ? Number(wiz.advancedSettings.roundRobinMatches)
          : null,
        qualifierCount: wiz.advancedSettings.qualifierCount
          ? Number(wiz.advancedSettings.qualifierCount)
          : null,
        tieSubmatchCount: getEffectiveTieSubmatchCount(),
        lineupLockRule: wiz.advancedSettings.lineupLockRule || null,
        participationRule: wiz.advancedSettings.participationRule || null,
        tiebreakRule: wiz.advancedSettings.tiebreakRule || null,
        semifinalPairing: wiz.advancedSettings.semifinalPairing || null,
      },

      categories: wiz.eventConfigs.map((cfg, idx) => ({
        categoryId: cfg.categoryId || `CAT-${idx + 1}`,
        eventName: buildEventNameFromConfig(cfg) || `Category ${idx + 1}`,
        gender: cfg.gender || "",
        ageGroup: cfg.ageGroup || "",
        playingLevel: cfg.playingLevel || "",
        teamSize: Number(cfg.teamSize || 1),
        exactTeamSize: cfg.exactTeamSize ? Number(cfg.exactTeamSize) : null,
      })),

      tournamentRules: {
        maxMatchesPerPlayer: wiz.tournamentRules.maxMatchesPerPlayer
          ? Number(wiz.tournamentRules.maxMatchesPerPlayer)
          : null,
        bestOfSets: wiz.tournamentRules.bestOfSets
          ? Number(wiz.tournamentRules.bestOfSets)
          : null,
        pointsPerSet: wiz.tournamentRules.pointsPerSet
          ? Number(wiz.tournamentRules.pointsPerSet)
          : null,
        minPlayersPerTeam: wiz.tournamentRules.minPlayersPerTeam
          ? Number(wiz.tournamentRules.minPlayersPerTeam)
          : null,
        maxPlayersPerTeam: wiz.tournamentRules.maxPlayersPerTeam
          ? Number(wiz.tournamentRules.maxPlayersPerTeam)
          : null,
      },

      leaguePoints: shouldUseMatchPointStandings()
        ? null
        : shouldShowLeaguePointsBlock()
          ? {
              win: wiz.leaguePoints.win ? Number(wiz.leaguePoints.win) : null,
              loss: wiz.leaguePoints.loss ? Number(wiz.leaguePoints.loss) : null,
              draw: wiz.leaguePoints.draw ? Number(wiz.leaguePoints.draw) : null,
            }
          : null,

      courtCount: Number(wiz.courtCount || 1),
      courtNames: wiz.courtNames.filter(Boolean),
      requirePayment: !!wiz.requirePayment,
      entryFee: wiz.amount ? Number(wiz.amount) : 0,
    };
  }

  // ---------------------------------------------------------------------------
  // TOURNAMENT CRUD / DATA LOAD
  // ---------------------------------------------------------------------------
  async function loadSports() {
    const sportSelect = document.getElementById("w-sport");
    if (!sportSelect) return;

    try {
      const res = await fetch("/api/sports");
      if (!res.ok) throw new Error("Failed to load sports");

      const raw = await res.json();
      const sports = Array.isArray(raw) ? raw : normalizeTournamentList(raw);

      sportSelect.innerHTML = `<option value="">Select sport</option>`;

      if (Array.isArray(sports) && sports.length) {
        sports.forEach((sport) => {
          const name =
            sport?.sport_name || sport?.sportName || sport?.name || sport?.title || "";
          if (!name) return;
          const option = document.createElement("option");
          option.value = name;
          option.textContent = name;
          sportSelect.appendChild(option);
        });
      }

      if (wiz.sport) sportSelect.value = wiz.sport;
    } catch (err) {
      console.warn("Error loading sports. Using existing HTML options.", err);
    }
  }

  async function loadMyTournaments() {
    const res = await apiGet("/api/host/tournaments");
    if (!res.ok) {
      console.error("Failed to load tournaments", res.status, res.data);
      allTournaments = [];
      renderDashboard([]);
      populateSportFilter([]);
      renderMyTournaments([]);
      return;
    }

    allTournaments = normalizeTournamentList(res.data);
    populateSportFilter(allTournaments);
    renderDashboard(getFilteredAndSortedTournaments());
    renderMyTournaments(getFilteredAndSortedTournaments());
  }

  function openTournamentForView(t) {
    viewOnlyMode = true;
    editingTournamentId = null;
    viewingTournamentId = t.tournamentId ?? t.id ?? null;

    hydrateWizardFromTournament(t);
    syncFormFromState();
    showStep(TOTAL_STEPS - 1);
    switchHostView("new");
  }

  function openTournamentForEdit(t) {
    viewOnlyMode = false;
    viewingTournamentId = null;
    editingTournamentId = t.tournamentId ?? t.id ?? null;

    hydrateWizardFromTournament(t);
    syncFormFromState();
    showStep(0);
    switchHostView("new");
  }

  function hydrateWizardFromTournament(t) {
    const tournament = normalizeSingleTournament(t) || {};

    wiz.name = tournament.tournamentName || "";
    wiz.sport = tournament.sportName || "";
    wiz.venue = tournament.venue || "";
    wiz.details =
      typeof tournament.playerDetails === "string"
        ? tournament.playerDetails
        : Array.isArray(tournament.playerDetails)
          ? tournament.playerDetails.join(", ")
          : "";
    wiz.accessCode = tournament.accessCode || "";
    wiz.isPublic = tournament.isPublic !== false;

    const dateStr = tournament.tournamentDates || "";
    if (dateStr.includes(" to ")) {
      const [start, end] = dateStr.split(" to ");
      wiz.dateStart = start?.trim() || "";
      wiz.dateEnd = end?.trim() || "";
    } else {
      wiz.dateStart = "";
      wiz.dateEnd = "";
    }

    wiz.tournamentType = tournament.tournamentType || "single";
    wiz.stageFormat = tournament.stageFormat || "";
    wiz.groupCount = tournament.groupCount != null ? String(tournament.groupCount) : "";
    wiz.requirePayment = !!tournament.requirePayment;
    wiz.amount = numberOrBlank(tournament.entryFee ?? tournament.amount);
    wiz.courtCount = Number(tournament.courtCount || 1);
    wiz.courtNames = Array.isArray(tournament.courtNames) ? [...tournament.courtNames] : [];

    const advanced = safeJsonParse(tournament.advancedSettings, tournament.advancedSettings) || {};
    wiz.advancedSettings = {
      advancedMode: advanced.advancedMode || "",
      roundRobinMatches: numberOrBlank(advanced.roundRobinMatches),
      qualifierCount: numberOrBlank(advanced.qualifierCount),
      tieSubmatchCount: numberOrBlank(advanced.tieSubmatchCount),
      lineupLockRule: advanced.lineupLockRule || "",
      participationRule: advanced.participationRule || "",
      tiebreakRule: advanced.tiebreakRule || "",
      semifinalPairing: advanced.semifinalPairing || "",
    };

    const rules = safeJsonParse(tournament.tournamentRules, tournament.tournamentRules) || {};
    wiz.tournamentRules = {
      maxMatchesPerPlayer: numberOrBlank(rules.maxMatchesPerPlayer),
      bestOfSets: numberOrBlank(rules.bestOfSets),
      pointsPerSet: numberOrBlank(rules.pointsPerSet),
      minPlayersPerTeam: numberOrBlank(rules.minPlayersPerTeam),
      maxPlayersPerTeam: numberOrBlank(rules.maxPlayersPerTeam),
    };

    const league = safeJsonParse(tournament.leaguePoints, tournament.leaguePoints) || {};
    wiz.leaguePoints = {
      win: numberOrBlank(league.win),
      loss: numberOrBlank(league.loss),
      draw: numberOrBlank(league.draw),
    };

    const cats = safeJsonParse(tournament.categories, tournament.categories);
    if (Array.isArray(cats) && cats.length) {
      wiz.eventConfigs = cats.map((c, idx) => ({
        categoryId: c.categoryId || `CAT-${idx + 1}`,
        gender: c.gender || "",
        ageGroup: c.ageGroup || "",
        playingLevel: c.playingLevel || "",
        teamSize: String(c.teamSize ?? 1),
        exactTeamSize: numberOrBlank(c.exactTeamSize),
        eventName: c.eventName || "",
      }));
      wiz.eventCount = wiz.eventConfigs.length;
    } else {
      wiz.eventConfigs = [];
      wiz.eventCount = 1;
    }

    setWizardModeUI();
  }

  async function createTournament() {
    const payload = buildTournamentPayload();
    const res = await apiPost("/api/host/tournaments", payload);

    if (!res.ok) {
      console.error("Create tournament failed", res.status, res.data);
      alert(
        (typeof res.data === "object" && (res.data?.message || res.data?.error)) ||
        "Could not create tournament."
      );
      return;
    }

    const created = normalizeSingleTournament(res.data);
    const createdId = created?.tournamentId ?? created?.id ?? null;

    alert("Tournament created successfully.");
    await loadMyTournaments();

    if (createdId) {
      editingTournamentId = createdId;
      viewingTournamentId = null;
      viewOnlyMode = true;
      wizViewPlayersBtn?.classList.remove("hidden");
      switchHostView("my");
    } else {
      resetWizardState();
      switchHostView("my");
    }
  }

  async function updateTournament() {
    if (!editingTournamentId) return;

    const payload = buildTournamentPayload();
    const res = await apiPut(`/api/host/tournaments/${encodeURIComponent(editingTournamentId)}`, payload);

    if (!res.ok) {
      console.error("Update tournament failed", res.status, res.data);
      alert(
        (typeof res.data === "object" && (res.data?.message || res.data?.error)) ||
        "Could not update tournament."
      );
      return;
    }

    alert("Tournament updated successfully.");
    await loadMyTournaments();
    switchHostView("my");
  }

  async function stopRegistrationsForSelectedTournament() {
    if (!selectedTournamentId) {
      alert("No tournament selected.");
      return;
    }

    const match = allTournaments.find(
      (t) => String(t.tournamentId ?? t.id) === String(selectedTournamentId)
    );

    const currentlyOpen = match?.registrationsOpen !== false;
    const nextOpen = !currentlyOpen;
    const actionText = nextOpen ? "re-open" : "stop";

    const ok = confirm(`Are you sure you want to ${actionText} registrations?`);
    if (!ok) return;

    const attempts = [
  () =>
    apiPatch(
      `/api/host/tournaments/${encodeURIComponent(selectedTournamentId)}/registrations-open`,
      { registrationsOpen: nextOpen }
    ),
  () =>
    apiPatch(`/api/host/tournaments/${encodeURIComponent(selectedTournamentId)}`, {
      registrationsOpen: nextOpen,
    }),
];

    for (const attempt of attempts) {
      const res = await attempt();
      if (res.ok) {
        await loadMyTournaments();
        const updated = allTournaments.find(
          (t) => String(t.tournamentId ?? t.id) === String(selectedTournamentId)
        );
        if (updated) renderTournamentDetail(updated);
        return;
      }
    }

    alert("Could not update registrations state.");
  }

  async function shareTournamentCode(t) {
    if (!t) {
      alert("Tournament details not found.");
      return;
    }

    const tournamentId = t.tournamentId ?? t.id;
    const joinLink = `${window.location.origin}/join.html?tournamentId=${encodeURIComponent(tournamentId)}`;
    const shareText = `${t.tournamentName}\nCode: ${t.accessCode}\nJoin link: ${joinLink}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: t.tournamentName,
          text: shareText,
          url: joinLink,
        });
        return;
      } catch (err) {
        console.warn("navigator.share failed:", err);
      }
    }

    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(shareText);
        alert("Tournament code and join link copied.");
        return;
      } catch (err) {
        console.warn("navigator.clipboard.writeText failed:", err);
      }
    }

    try {
      const textarea = document.createElement("textarea");
      textarea.value = shareText;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);

      if (ok) {
        alert("Tournament code and join link copied.");
        return;
      }
    } catch (err) {
      console.warn("execCommand copy failed:", err);
    }

    window.prompt("Copy tournament code and join link:", shareText);
  }

  // ---------------------------------------------------------------------------
  // RENDERING
  // ---------------------------------------------------------------------------
  function renderTournamentDetail(t, anchorCard = null) {
    if (!tournamentDetail) return;

    selectedTournamentId = t.tournamentId ?? t.id ?? null;

    detailTournamentName.textContent = t.tournamentName || "Tournament name";
    detailTournamentCode.textContent = t.accessCode || "—";
    detailTotalRegistrations.textContent = String(
      t.totalRegistrations ??
      t.registrationCount ??
      t.playersCount ??
      0
    );

    if (stopRegistrationsBtn) {
      stopRegistrationsBtn.textContent =
        t.registrationsOpen === false ? "Re-open registrations" : "Stop registrations";
    }

    tournamentDetail.classList.remove("hidden");

    if (anchorCard) {
      anchorCard.insertAdjacentElement("afterend", tournamentDetail);
    }
  }

  function renderMyTournaments(tournaments) {
    if (!myTournamentsList) return;

    myTournamentsList.innerHTML = "";

    if (!tournaments.length) {
      myTournamentsList.innerHTML = `
        <div class="empty-state">
          <div class="feature-icon">📋</div>
          <h3>No tournaments yet</h3>
          <p class="muted">Once you host tournaments, you’ll see them listed here.</p>
        </div>
      `;
      tournamentDetail?.classList.add("hidden");
      return;
    }

    tournaments.forEach((t) => {
      const card = document.createElement("div");
      card.className = "tournament-card";

      const dateText = t.tournamentDates || "—";
      const categories = safeJsonParse(t.categories, t.categories);
      const categoryText = Array.isArray(categories)
        ? categories
            .slice(0, 2)
            .map((c) => buildEventNameFromConfig({
              ageGroup: c.ageGroup,
              gender: c.gender,
              playingLevel: c.playingLevel,
              teamSize: String(c.teamSize ?? 1),
              exactTeamSize: c.exactTeamSize,
            }))
            .filter(Boolean)
            .join(" • ")
        : "";

      card.innerHTML = `
        <p class="eyebrow">${escapeHtml(t.sportName || "Tournament")}</p>
        <div class="tournament-head">
          <h3>${escapeHtml(t.tournamentName || "Untitled tournament")}</h3>
          <button type="button" class="code-chip">${escapeHtml(t.accessCode || "CODE")}</button>
        </div>

        <div class="tournament-meta">
          <span>${escapeHtml(dateText)}</span>
          <span>${escapeHtml(t.venue || "")}</span>
        </div>

        ${categoryText ? `<div class="tournament-meta"><span>${escapeHtml(categoryText)}</span></div>` : ""}

        <div class="tournament-meta">
          <span>Status: <strong>${t.registrationsOpen === false ? "Closed" : "Open"}</strong></span>
        </div>

        <div class="tournament-meta tournament-actions">
          <button type="button" class="view-btn">View</button>
          <button type="button" class="edit-btn">Edit</button>
          <button type="button" class="delete-btn">Delete</button>
        </div>
      `;

      card.addEventListener("click", () => renderTournamentDetail(t, card));

      card.querySelector(".code-chip")?.addEventListener("click", async (e) => {
        e.stopPropagation();
        await shareTournamentCode(t);
      });

      card.querySelector(".view-btn")?.addEventListener("click", (e) => {
        e.stopPropagation();
        openTournamentForView(t);
      });

      card.querySelector(".edit-btn")?.addEventListener("click", (e) => {
        e.stopPropagation();
        openTournamentForEdit(t);
      });

      card.querySelector(".delete-btn")?.addEventListener("click", async (e) => {
        e.stopPropagation();
        const ok = confirm("Delete this tournament? This cannot be undone.");
        if (!ok) return;

        const res = await apiDelete(`/api/host/tournaments/${encodeURIComponent(t.tournamentId ?? t.id)}`);
        if (!res.ok) {
          alert("Failed to delete tournament");
          return;
        }

        await loadMyTournaments();
      });

      myTournamentsList.appendChild(card);
    });
  }

  function renderUpcomingRow(tournaments) {
  if (!dashboardUpcomingRow) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = [...tournaments]
    .map((t) => {
      const { start, end } = parseTournamentDateRange(t.tournamentDates || "");
      return { ...t, _start: start, _end: end || start };
    })
    .filter((t) => {
      if (!t._start) return false;
      const end = new Date(t._end || t._start);
      end.setHours(0, 0, 0, 0);
      return end >= today;
    })
    .sort((a, b) => {
      const aTime = a._start ? a._start.getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b._start ? b._start.getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    })
    .slice(0, 8);

  dashboardUpcomingRow.innerHTML = "";

  if (!upcoming.length) {
    dashboardUpcomingRow.innerHTML = `<div class="dashboard-empty-card">No upcoming tournaments yet.</div>`;
    return;
  }

  upcoming.forEach((t) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "upcoming-card";
    card.innerHTML = `
      <div class="upcoming-card-top">
        <p class="eyebrow">${escapeHtml(t.sportName || "Tournament")}</p>
      </div>
      <h3>${escapeHtml(t.tournamentName || "Tournament")}</h3>
      <p class="muted">${escapeHtml(t.tournamentDates || "")}</p>
      <p class="muted">${escapeHtml(t.venue || "")}</p>
    `;
    card.addEventListener("click", () => renderTournamentDetail(t));
    dashboardUpcomingRow.appendChild(card);
  });
}

  function renderStats(tournaments) {
    if (statTotalTournaments) statTotalTournaments.textContent = String(tournaments.length);

    const totalPlayers = tournaments.reduce((sum, t) => {
      const count = Number(t.totalRegistrations ?? t.registrationCount ?? t.playersCount ?? 0);
      return sum + (Number.isFinite(count) ? count : 0);
    }, 0);

    const active = tournaments.filter((t) => t.registrationsOpen !== false).length;

    if (statTotalPlayers) statTotalPlayers.textContent = String(totalPlayers);
    if (statActiveEvents) statActiveEvents.textContent = String(active);
  }

  function renderCalendar(tournaments) {
  if (!calendarGrid || !monthLabel) return;

  const monthStart = new Date(dashboardYear, dashboardMonth, 1);
  const monthEnd = new Date(dashboardYear, dashboardMonth + 1, 0);
  const firstDayIndex = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();

  monthLabel.textContent = monthStart.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });

  calendarGrid.innerHTML = "";

  for (let i = 0; i < firstDayIndex; i++) {
    const blank = document.createElement("div");
    blank.className = "calendar-day calendar-day--blank";
    calendarGrid.appendChild(blank);
  }

  const normalized = tournaments.map((t) => {
    const { start, end } = parseTournamentDateRange(t.tournamentDates || "");
    return {
      ...t,
      _startDate: isValidDate(start) ? start : null,
      _endDate: isValidDate(end) ? end : null,
    };
  });

  for (let day = 1; day <= daysInMonth; day++) {
    const cellDate = new Date(dashboardYear, dashboardMonth, day);
    cellDate.setHours(0, 0, 0, 0);

    const events = normalized.filter((t) => {
      if (!t._startDate) return false;
      const start = new Date(t._startDate);
      const end = new Date(t._endDate || t._startDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      return cellDate >= start && cellDate <= end;
    });

    const cell = document.createElement("div");
    cell.className = `calendar-day${events.length ? " has-event" : ""}`;

    const namesHtml = events
      .slice(0, 2)
      .map(
        (ev) =>
          `<div class="calendar-event-name" title="${escapeHtml(ev.tournamentName || "Tournament")}">${escapeHtml(
            ev.tournamentName || "Tournament"
          )}</div>`
      )
      .join("");

    const moreHtml =
      events.length > 2
        ? `<div class="calendar-event-more">+${events.length - 2} more</div>`
        : "";

    cell.innerHTML = `
      <div class="calendar-day-num">${day}</div>
      <div class="calendar-day-events">
        ${namesHtml}
        ${moreHtml}
      </div>
    `;

    if (events.length) {
      cell.addEventListener("click", () => {
        const first = events[0];
        if (first) renderTournamentDetail(first);
      });
    }

    calendarGrid.appendChild(cell);
  }
}
  function renderSportsPieChart(tournaments) {
    if (!sportsPieCanvas || !sportsChartLegend) return;

    const counts = new Map();
    tournaments.forEach((t) => {
      const sport = String(t.sportName || "").trim();
      if (!sport) return;
      counts.set(sport, (counts.get(sport) || 0) + 1);
    });

    const distribution = [...counts.entries()].map(([sport, count]) => ({ sport, count }));
    sportsChartLegend.innerHTML = "";

    if (!distribution.length) {
      const ctx = sportsPieCanvas.getContext("2d");
      ctx.clearRect(0, 0, sportsPieCanvas.width, sportsPieCanvas.height);
      sportsChartLegend.innerHTML = `<div class="muted">No sports data yet.</div>`;
      return;
    }

    const colors = [
      "#4dd0e1",
      "#f25f4c",
      "#22c55e",
      "#f59e0b",
      "#8b5cf6",
      "#ec4899",
      "#3b82f6",
      "#14b8a6",
    ];

    const total = distribution.reduce((sum, x) => sum + x.count, 0);
    const ctx = sportsPieCanvas.getContext("2d");
    ctx.clearRect(0, 0, sportsPieCanvas.width, sportsPieCanvas.height);

    const cx = sportsPieCanvas.width / 2;
    const cy = sportsPieCanvas.height / 2;
    const radius = Math.min(cx, cy) - 14;

    let angle = -Math.PI / 2;
    distribution.forEach((item, idx) => {
      const sweep = (item.count / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, angle, angle + sweep);
      ctx.closePath();
      ctx.fillStyle = colors[idx % colors.length];
      ctx.fill();
      angle += sweep;
    });

    ctx.beginPath();
    ctx.fillStyle = "#0b1325";
    ctx.arc(cx, cy, radius * 0.42, 0, Math.PI * 2);
    ctx.fill();

    distribution.forEach((item, idx) => {
      const row = document.createElement("div");
      row.className = "legend-row";
      row.innerHTML = `
        <span class="legend-dot" style="background:${colors[idx % colors.length]}"></span>
        <span>${escapeHtml(item.sport)} (${item.count})</span>
      `;
      sportsChartLegend.appendChild(row);
    });
  }

  function renderDashboard(tournaments) {
    renderUpcomingRow(tournaments);
    renderStats(tournaments);
    renderCalendar(tournaments);
    renderSportsPieChart(tournaments);
  }

  function getFilteredAndSortedTournaments() {
    let list = [...allTournaments];

    if (currentSportFilter) {
      list = list.filter((t) => t.sportName === currentSportFilter);
    }

    const withDates = list.map((t) => {
      const { start, end } = parseTournamentDateRange(t.tournamentDates || "");
      return {
        ...t,
        _startDate: isValidDate(start) ? start : null,
        _endDate: isValidDate(end) ? end : null,
        _createdAt: t.createdAt ? new Date(t.createdAt) : null,
      };
    });

    if (currentSortFilter === "newest") {
      withDates.sort((a, b) => {
        const aTime = a._createdAt && isValidDate(a._createdAt) ? a._createdAt.getTime() : 0;
        const bTime = b._createdAt && isValidDate(b._createdAt) ? b._createdAt.getTime() : 0;
        return bTime - aTime;
      });
    } else if (currentSortFilter === "oldest") {
      withDates.sort((a, b) => {
        const aTime = a._createdAt && isValidDate(a._createdAt) ? a._createdAt.getTime() : 0;
        const bTime = b._createdAt && isValidDate(b._createdAt) ? b._createdAt.getTime() : 0;
        return aTime - bTime;
      });
    } else if (currentSortFilter === "active") {
      withDates.sort((a, b) => Number(b.registrationsOpen === true) - Number(a.registrationsOpen === true));
    } else if (currentSortFilter === "inactive") {
      withDates.sort((a, b) => Number(a.registrationsOpen === false) - Number(b.registrationsOpen === false));
    } else if (currentSortFilter === "upcoming") {
      withDates.sort((a, b) => {
        const aTime = a._startDate ? a._startDate.getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b._startDate ? b._startDate.getTime() : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      });
    } else if (currentSortFilter === "name_asc") {
      withDates.sort((a, b) => String(a.tournamentName || "").localeCompare(String(b.tournamentName || "")));
    } else if (currentSortFilter === "name_desc") {
      withDates.sort((a, b) => String(b.tournamentName || "").localeCompare(String(a.tournamentName || "")));
    }

    return withDates;
  }

  function populateSportFilter(tournaments) {
    if (!filterSport) return;

    const sports = [...new Set(tournaments.map((t) => t.sportName).filter(Boolean))];

    filterSport.innerHTML = `<option value="">All sports</option>`;
    sports.forEach((sport) => {
      const opt = document.createElement("option");
      opt.value = sport;
      opt.textContent = sport;
      filterSport.appendChild(opt);
    });

    filterSport.value = currentSportFilter;
    if (sortTournaments) sortTournaments.value = currentSortFilter;
  }

  // ---------------------------------------------------------------------------
  // EVENT WIRING
  // ---------------------------------------------------------------------------
  function initDatePickerButtons() {
    document.querySelectorAll("[data-open-picker]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetId = btn.getAttribute("data-open-picker");
        openNativeDatePicker(document.getElementById(targetId));
      });
    });
  }

  function initWizardButtons() {
    wizBackBtn?.addEventListener("click", () => {
      if (currentStep > 0) showStep(currentStep - 1);
    });

    wizNextBtn?.addEventListener("click", () => {
      collectStep(currentStep);
      if (!validateStep(currentStep)) return;
      if (currentStep < TOTAL_STEPS - 1) showStep(currentStep + 1);
    });

    wizSubmitBtn?.addEventListener("click", async () => {
      collectStep(currentStep);
      if (!validateStep(currentStep)) return;
      if (editingTournamentId) await updateTournament();
      else await createTournament();
    });

    wizSaveNowBtn?.addEventListener("click", async () => {
      if (!editingTournamentId) return;
      collectStep(currentStep);
      await updateTournament();
    });

    wizCancelEditBtn?.addEventListener("click", () => {
      resetWizardState();
      switchHostView("my");
    });

    wizViewPlayersBtn?.addEventListener("click", () => {
      const id = viewingTournamentId || editingTournamentId;
      if (id) window.location.href = `players.html?tournamentId=${encodeURIComponent(id)}`;
    });

    wizEditViewBtn?.addEventListener("click", () => {
      if (!viewingTournamentId) return;
      const t = allTournaments.find(
        (x) => String(x.tournamentId ?? x.id) === String(viewingTournamentId)
      );
      if (t) openTournamentForEdit(t);
    });
  }

  function initHostViewActions() {
    viewPlayersBtn?.addEventListener("click", () => {
      if (!selectedTournamentId) {
        alert("Select a tournament first.");
        return;
      }
      window.location.href = `players.html?tournamentId=${encodeURIComponent(selectedTournamentId)}`;
    });

  generateCodeBtn?.addEventListener("click", async (e) => {
  e.preventDefault();
  e.stopPropagation();

  const isWizardMode =
    !!newTournamentView?.classList.contains("host-view--active") &&
    !viewOnlyMode &&
    !viewingTournamentId;

  if (isWizardMode) {
    const code = generateAccessCode();

    wiz.accessCode = code;

    if (accessCodeInput) {
      accessCodeInput.removeAttribute("readonly");
      accessCodeInput.value = code;
      accessCodeInput.defaultValue = code;
      accessCodeInput.setAttribute("value", code);
      accessCodeInput.readOnly = true;
    }

    syncFormFromState();

    if (accessCodeInput) {
      accessCodeInput.removeAttribute("readonly");
      accessCodeInput.value = code;
      accessCodeInput.defaultValue = code;
      accessCodeInput.setAttribute("value", code);
      accessCodeInput.readOnly = true;
    }

    console.log("Generated access code:", code, "Input now:", accessCodeInput?.value);
    return;
  }

  const tournament = allTournaments.find(
    (t) => String(t.tournamentId ?? t.id) === String(selectedTournamentId)
  );
  if (tournament) await shareTournamentCode(tournament);
});

    stopRegistrationsBtn?.addEventListener("click", stopRegistrationsForSelectedTournament);

    filterSport?.addEventListener("change", (e) => {
      currentSportFilter = e.target.value;
      renderMyTournaments(getFilteredAndSortedTournaments());
    });

    sortTournaments?.addEventListener("change", (e) => {
      currentSortFilter = e.target.value;
      renderMyTournaments(getFilteredAndSortedTournaments());
    });
  }

  function initWizardInputs() {
    tournamentTypeSelect?.addEventListener("change", () => {
      wiz.tournamentType = tournamentTypeSelect.value;
      toggleTeamPlayerLimitsSection();
      toggleTieSubmatchField();
      renderEventConfig();
    });

    stageFormatSelect?.addEventListener("change", () => {
      wiz.stageFormat = stageFormatSelect.value;
      toggleGroupCountSection();
      toggleLeaguePointsSection();
      updateFormatNotes();
    });

    eventCountInput?.addEventListener("input", () => {
      wiz.eventCount = Math.max(1, Number(eventCountInput.value || 1));
      if (wiz.tournamentType === "team") {
        const derived = String(getEffectiveTieSubmatchCount());
        wiz.advancedSettings.tieSubmatchCount = derived;
        if (tieSubmatchCountInput) tieSubmatchCountInput.value = derived;
      }
      renderEventConfig();
    });

    publicYesBtn?.addEventListener("click", () => {
      wiz.isPublic = true;
      publicYesBtn.classList.add("active");
      publicNoBtn?.classList.remove("active");
    });

    publicNoBtn?.addEventListener("click", () => {
      wiz.isPublic = false;
      publicNoBtn.classList.add("active");
      publicYesBtn?.classList.remove("active");
    });

    paymentYesBtn?.addEventListener("click", () => {
      wiz.requirePayment = true;
      paymentYesBtn.classList.add("active");
      paymentNoBtn?.classList.remove("active");
      toggleAmountSection();
    });

    paymentNoBtn?.addEventListener("click", () => {
      wiz.requirePayment = false;
      paymentNoBtn.classList.add("active");
      paymentYesBtn?.classList.remove("active");
      toggleAmountSection();
    });

    document.getElementById("w-court-plus")?.addEventListener("click", () => {
      wiz.courtCount += 1;
      syncCourtCount();
      renderCourtNameFields();
    });

    document.getElementById("w-court-minus")?.addEventListener("click", () => {
      wiz.courtCount = Math.max(1, wiz.courtCount - 1);
      syncCourtCount();
      renderCourtNameFields();
    });

    // Soft defaults for pickleball advanced mode
    advancedModeInput?.addEventListener("change", () => {
      const val = advancedModeInput.value;
      wiz.advancedSettings.advancedMode = val;

      if (val === "pickleball_team_league") {
        stageFormatSelect.value = "round_robin_knockout";
        wiz.stageFormat = stageFormatSelect.value;

        if (!rrRoundsInput.value) rrRoundsInput.value = "5";
        if (!qualifierCountInput.value) qualifierCountInput.value = "4";

        if (wiz.tournamentType === "team") {
          const derived = String(getEffectiveTieSubmatchCount());
          wiz.advancedSettings.tieSubmatchCount = derived;
          if (tieSubmatchCountInput) tieSubmatchCountInput.value = derived;
        } else if (!tieSubmatchCountInput.value) {
          tieSubmatchCountInput.value = "5";
        }

        if (!lineupLockRuleInput.value) lineupLockRuleInput.value = "captain_submit_host_lock";
        if (!participationRuleInput.value) participationRuleInput.value = "all_bench_must_play_once";
        if (!tiebreakRuleInput.value) {
          tiebreakRuleInput.value = "points_head_to_head_ties_won_decider";
        }
        if (!semifinalPairingInput.value) semifinalPairingInput.value = "1v4_2v3";
      }

      toggleGroupCountSection();
      toggleTieSubmatchField();
      toggleLeaguePointsSection();
      updateFormatNotes();
    });
  }

  function initCalendarNav() {
    calendarPrevBtn?.addEventListener("click", () => {
      dashboardMonth -= 1;
      if (dashboardMonth < 0) {
        dashboardMonth = 11;
        dashboardYear -= 1;
      }
      renderCalendar(allTournaments);
    });

    calendarNextBtn?.addEventListener("click", () => {
      dashboardMonth += 1;
      if (dashboardMonth > 11) {
        dashboardMonth = 0;
        dashboardYear += 1;
      }
      renderCalendar(allTournaments);
    });
  }

  // ---------------------------------------------------------------------------
  // INITIALIZE
  // ---------------------------------------------------------------------------
  initUserMenu();
  initModeToggle();
  initSidebar();
  initDatePickerButtons();
  initWizardButtons();
  initHostViewActions();
  initWizardInputs();
  initCalendarNav();

  document.querySelectorAll(".brand").forEach((el) => {
    el.addEventListener("click", () => {
      window.location.href = "index.html";
    });
  });

  resetWizardState();
  await loadSports();
  await loadMyTournaments();
});