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

document.addEventListener("DOMContentLoaded", async () => {
  const generateCodeBtn = document.getElementById("generate-code-btn");
  const accessCodeInput = document.getElementById("access-code");
  const viewPlayersBtn = document.getElementById("modalViewPlayers");
  let selectedTournamentId = null;
  const sidebar = document.getElementById("host-sidebar");
  const sidebarToggleBtn = document.getElementById("sidebar-toggle-btn");

  let dashboardMonth = new Date().getMonth();
  let dashboardYear = new Date().getFullYear();

  let categories = [];

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

    tournamentType: "single",
    eventCount: 1,
    eventNames: [],
    eventConfigs: [],

    stageFormat: "",
    groupCount: "",

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
    isPublic: true,
  };

  const wizBackBtn = document.getElementById("wiz-back-btn");
  const wizNextBtn = document.getElementById("wiz-next-btn");
  const wizSubmitBtn = document.getElementById("wiz-submit-btn");
  const wizSaveNowBtn = document.getElementById("wiz-save-now-btn");
  const wizCancelEditBtn = document.getElementById("wiz-cancel-edit-btn");
  const wizViewPlayersBtn = document.getElementById("wiz-view-players-btn");
  const wizEditViewBtn = document.getElementById("wiz-edit-view-btn");
  const wizDots = document.querySelectorAll(".wiz-step-dot");
  const wizLines = document.querySelectorAll(".wiz-progress-line");

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

    if (wizBackBtn) {
      wizBackBtn.classList.toggle("hidden", isViewMode || currentStep === 0);
    }

    if (wizNextBtn) {
      wizNextBtn.classList.toggle("hidden", isViewMode);
    }

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

    if (wizViewPlayersBtn) {
      wizViewPlayersBtn.classList.toggle("hidden", !isViewMode);
    }

    if (wizEditViewBtn) {
      wizEditViewBtn.classList.toggle("hidden", !isViewMode);
    }

    if (generateCodeBtn) {
      generateCodeBtn.classList.toggle("hidden", isViewMode);
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

  function shouldShowLeaguePoints() {
    return wiz.stageFormat === "round_robin" || wiz.stageFormat === "group_knockout";
  }

  function toggleLeaguePointsSection() {
    const wrap = document.getElementById("wiz-league-points-wrap");
    if (!wrap) return;
    wrap.classList.toggle("hidden", !shouldShowLeaguePoints());
  }

  function toggleTeamPlayerLimitsSection() {
    const minWrap = document.getElementById("wiz-min-players-wrap");
    const maxWrap = document.getElementById("wiz-max-players-wrap");
    const show = wiz.tournamentType === "team";

    minWrap?.classList.toggle("hidden", !show);
    maxWrap?.classList.toggle("hidden", !show);
  }

  function openNativeDatePicker(input) {
    if (!input) return;
    if (typeof input.showPicker === "function") {
      input.showPicker();
    } else {
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

  const teamSize = Number(cfg.teamSize || 1);
  const exact = Number(cfg.exactTeamSize || 0);

  let formatText = "";
  if (teamSize === 1) formatText = "Singles";
  else if (teamSize === 2) formatText = "Doubles";
  else if (teamSize === 3) formatText = "Triples";
  else if (teamSize >= 4) formatText = exact ? `Team ${exact}` : "Team";

  return [age, gender, formatText].filter(Boolean).join(" • ");
}
  function renderEventConfig() {
    const wrap = document.getElementById("wiz-event-config");
    if (!wrap) return;

    wrap.innerHTML = "";

    const events = Array.from({ length: wiz.eventCount || 1 }, (_, i) => ({
      name: `Category ${i + 1}`,
    }));

    while (wiz.eventConfigs.length < events.length) {
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
    wiz.eventConfigs = wiz.eventConfigs.slice(0, events.length);

    events.forEach((ev, i) => {
      const cfg = wiz.eventConfigs[i];
      cfg.eventName = buildEventNameFromConfig(cfg);
      const showExactTeamSizeField = cfg.teamSize === "4";

      const card = document.createElement("div");
      card.className = "wiz-event-cfg-card";
      card.innerHTML = `
        <div class="wiz-event-cfg-title">${cfg.eventName || ev.name}</div>
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
              value="${cfg.exactTeamSize || ""}"
            />
          </div>
          `
              : ""
          }
        </div>
      `;

      card.querySelectorAll(".wiz-cfg-sel").forEach((sel) => {
        sel.addEventListener("change", () => {
          const idx = Number(sel.dataset.idx);
          const field = sel.dataset.field;
          wiz.eventConfigs[idx][field] = sel.value;

          if (field === "teamSize") {
            if (sel.value !== "4") {
              wiz.eventConfigs[idx].exactTeamSize = "";
            }
            renderEventConfig();
          }
        });
      });

      card.querySelectorAll(".wiz-cfg-inp").forEach((inp) => {
        inp.addEventListener("input", () => {
          wiz.eventConfigs[Number(inp.dataset.idx)][inp.dataset.field] = inp.value;
        });
      });

      wrap.appendChild(card);
    });

    toggleLeaguePointsSection();
    toggleTeamPlayerLimitsSection();
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
          value="${wiz.courtNames[i] || ""}"
        />
      `;
      wrap.appendChild(div);

      const input = wrap.querySelector(`[data-idx="${i}"]`);
      input?.addEventListener("input", (e) => {
        wiz.courtNames[i] = e.target.value;
      });
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

      if (wiz.eventCount < 1) {
        alert("Please enter number of categories.");
        return false;
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
        const minVal = Number(wiz.tournamentRules.minPlayersPerTeam || 0);
        const maxVal = Number(wiz.tournamentRules.maxPlayersPerTeam || 0);

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

  function collectStep(n) {
    if (n === 0) {
      wiz.name = document.getElementById("w-name")?.value.trim() || "";
      wiz.sport = document.getElementById("w-sport")?.value || "";
      wiz.dateStart = document.getElementById("w-date-start")?.value || "";
      wiz.dateEnd = document.getElementById("w-date-end")?.value || "";
      wiz.venue = document.getElementById("w-venue")?.value.trim() || "";
      wiz.details = document.getElementById("w-details")?.value.trim() || "";
      wiz.isPublic = Boolean(wiz.isPublic);
    }

    if (n === 1) {
      wiz.stageFormat = document.getElementById("w-stage-format")?.value || "";
      wiz.groupCount = document.getElementById("w-group-count")?.value || "";
    }

    if (n === 2) {
      wiz.tournamentRules.maxMatchesPerPlayer = document.getElementById("w-max-matches-per-player")?.value || "";
      wiz.tournamentRules.bestOfSets = document.getElementById("w-best-of-sets")?.value || "";
      wiz.tournamentRules.pointsPerSet = document.getElementById("w-points-per-set")?.value || "";
      wiz.tournamentRules.minPlayersPerTeam = document.getElementById("w-min-players-per-team")?.value || "";
      wiz.tournamentRules.maxPlayersPerTeam = document.getElementById("w-max-players-per-team")?.value || "";

      wiz.leaguePoints.win = document.getElementById("w-points-win")?.value || "";
      wiz.leaguePoints.loss = document.getElementById("w-points-loss")?.value || "";
      wiz.leaguePoints.draw = document.getElementById("w-points-draw")?.value || "";
    }

    if (n === 4) {
      wiz.amount = document.getElementById("w-amount")?.value || "";
    }
  }

  function buildReview() {
    const body = document.getElementById("wiz-review-body");
    if (!body) return;

    const events = Array.from({ length: wiz.eventCount || 1 }, (_, i) => {
      const cfg = wiz.eventConfigs[i] || {};
      return {
        name: buildEventNameFromConfig(cfg) || `Category ${i + 1}`,
        cfg,
      };
    });

    const courtList =
      wiz.courtNames.filter(Boolean).join(", ") ||
      Array.from({ length: wiz.courtCount }, (_, i) => `Court ${i + 1}`).join(", ");

    const evRows = events
      .map((ev) => {
        const c = ev.cfg;
        const tags = [
          c.gender,
          c.ageGroup,
          c.playingLevel,
          c.teamSize === "1"
            ? "Singles"
            : c.teamSize === "2"
              ? "Doubles"
              : c.teamSize === "3"
                ? "Triples"
                : "Team",
          c.teamSize === "4" && c.exactTeamSize ? `${c.exactTeamSize} players/team` : "",
        ]
          .filter(Boolean)
          .join(" · ");

        return `
          <div class="wiz-review-event">
            <span class="wiz-review-event-name">${ev.name}</span>
            ${tags ? `<span class="wiz-review-event-tags">${tags}</span>` : ""}
          </div>
        `;
      })
      .join("");

    body.innerHTML = `
      <div class="wiz-review-section">
        <div class="wiz-review-row"><span class="wiz-review-key">Tournament</span><span class="wiz-review-val">${wiz.name}</span></div>
        <div class="wiz-review-row"><span class="wiz-review-key">Sport</span><span class="wiz-review-val">${wiz.sport}</span></div>
        <div class="wiz-review-row"><span class="wiz-review-key">Dates</span><span class="wiz-review-val">${wiz.dateStart}${wiz.dateEnd ? " → " + wiz.dateEnd : ""}</span></div>
        <div class="wiz-review-row"><span class="wiz-review-key">Venue</span><span class="wiz-review-val">${wiz.venue}</span></div>
        ${wiz.details ? `<div class="wiz-review-row"><span class="wiz-review-key">Notes</span><span class="wiz-review-val">${wiz.details}</span></div>` : ""}
      </div>

      <div class="wiz-review-section">
        <div class="wiz-review-row"><span class="wiz-review-key">Tournament type</span><span class="wiz-review-val">${wiz.tournamentType === "team" ? "Team event" : "Individual event"}</span></div>
        <div class="wiz-review-row"><span class="wiz-review-key">Format</span><span class="wiz-review-val">${
          wiz.stageFormat === "knockout"
            ? "Knockout"
            : wiz.stageFormat === "round_robin"
              ? "Round Robin"
              : wiz.stageFormat === "group_knockout"
                ? "Group + Knockout"
                : "-"
        }</span></div>
        ${wiz.stageFormat === "group_knockout" ? `<div class="wiz-review-row"><span class="wiz-review-key">Groups</span><span class="wiz-review-val">${wiz.groupCount || "-"}</span></div>` : ""}
      </div>

      <div class="wiz-review-section">
        <div class="wiz-review-section-title">Events (${events.length})</div>
        ${evRows}
      </div>

      <div class="wiz-review-section">
        <div class="wiz-review-section-title">Tournament rules</div>
        <div class="wiz-review-row"><span class="wiz-review-key">Max matches per player</span><span class="wiz-review-val">${wiz.tournamentRules.maxMatchesPerPlayer || "-"}</span></div>
        <div class="wiz-review-row"><span class="wiz-review-key">Best of sets</span><span class="wiz-review-val">${wiz.tournamentRules.bestOfSets || "-"}</span></div>
        <div class="wiz-review-row"><span class="wiz-review-key">Points per set</span><span class="wiz-review-val">${wiz.tournamentRules.pointsPerSet || "-"}</span></div>
        ${wiz.tournamentType === "team" ? `<div class="wiz-review-row"><span class="wiz-review-key">Min players/team</span><span class="wiz-review-val">${wiz.tournamentRules.minPlayersPerTeam || "-"}</span></div>` : ""}
        ${wiz.tournamentType === "team" ? `<div class="wiz-review-row"><span class="wiz-review-key">Max players/team</span><span class="wiz-review-val">${wiz.tournamentRules.maxPlayersPerTeam || "-"}</span></div>` : ""}
      </div>

      ${
        shouldShowLeaguePoints()
          ? `
        <div class="wiz-review-section">
          <div class="wiz-review-section-title">League match points</div>
          <div class="wiz-review-row"><span class="wiz-review-key">Win</span><span class="wiz-review-val">${wiz.leaguePoints.win || "-"}</span></div>
          <div class="wiz-review-row"><span class="wiz-review-key">Loss</span><span class="wiz-review-val">${wiz.leaguePoints.loss || "-"}</span></div>
          <div class="wiz-review-row"><span class="wiz-review-key">Draw</span><span class="wiz-review-val">${wiz.leaguePoints.draw || "-"}</span></div>
        </div>
      `
          : ""
      }

      <div class="wiz-review-section">
        <div class="wiz-review-row"><span class="wiz-review-key">Courts</span><span class="wiz-review-val">${courtList}</span></div>
        <div class="wiz-review-row"><span class="wiz-review-key">Payment</span><span class="wiz-review-val">${wiz.requirePayment ? "₹" + wiz.amount : "Free entry"}</span></div>
      </div>
    `;
  }

  function resetWizardStateAndUI() {
    Object.assign(wiz, {
      name: "",
      sport: "",
      dateStart: "",
      dateEnd: "",
      venue: "",
      details: "",
      tournamentType: "single",
      eventCount: 1,
      eventNames: [],
      eventConfigs: [],
      stageFormat: "",
      groupCount: "",
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
      isPublic: true,
    });

    editingTournamentId = null;
    viewOnlyMode = false;
    viewingTournamentId = null;

    document.getElementById("w-name").value = "";
    document.getElementById("w-sport").value = "";
    document.getElementById("w-date-start").value = "";
    document.getElementById("w-date-end").value = "";
    document.getElementById("w-venue").value = "";
    document.getElementById("w-details").value = "";
    document.getElementById("w-public-yes")?.classList.add("active");
document.getElementById("w-public-no")?.classList.remove("active");
    document.getElementById("w-event-count-display").textContent = "1";
    document.getElementById("w-stage-format").value = "";
    document.getElementById("w-group-count").value = "";
    document.getElementById("wiz-group-count-wrap").classList.add("hidden");
    document.getElementById("wiz-league-points-wrap").classList.add("hidden");

    document.getElementById("w-max-matches-per-player").value = "";
    document.getElementById("w-best-of-sets").value = "";
    document.getElementById("w-points-per-set").value = "";
    document.getElementById("w-points-win").value = "";
    document.getElementById("w-points-loss").value = "";
    document.getElementById("w-points-draw").value = "";
    document.getElementById("w-min-players-per-team").value = "";
    document.getElementById("w-max-players-per-team").value = "";
    document.getElementById("wiz-min-players-wrap").classList.add("hidden");
    document.getElementById("wiz-max-players-wrap").classList.add("hidden");

    document.querySelectorAll(".wiz-type-card").forEach((c) => {
      c.classList.toggle("active", c.dataset.type === "single");
    });

    document.getElementById("wiz-event-count-wrap").classList.remove("hidden");

    document.getElementById("w-payment-no").classList.add("active");
    document.getElementById("w-payment-yes").classList.remove("active");
    document.getElementById("wiz-amount-wrap").classList.add("hidden");
    document.getElementById("w-amount").value = "";
    document.getElementById("access-code").value = "";

    if (wizSubmitBtn) {
      wizSubmitBtn.disabled = false;
      wizSubmitBtn.textContent = "🚀 Create tournament";
    }
    if (wizSaveNowBtn) {
      wizSaveNowBtn.disabled = false;
      wizSaveNowBtn.textContent = "💾 Save now";
    }

    renderEventConfig();
    syncCourtCount();
    renderCourtNameFields();
    setWizardModeUI();
  }

  function hydrateWizardFormFromState() {
    document.getElementById("w-name").value = wiz.name || "";
    document.getElementById("w-sport").value = wiz.sport || "";
    document.getElementById("w-date-start").value = wiz.dateStart || "";
    document.getElementById("w-date-end").value = wiz.dateEnd || "";
    document.getElementById("w-venue").value = wiz.venue || "";
    document.getElementById("w-details").value = wiz.details || "";


    document.querySelectorAll(".wiz-type-card").forEach((c) => {
      c.classList.toggle("active", c.dataset.type === wiz.tournamentType);
    });

    document.getElementById("wiz-event-count-wrap")?.classList.remove("hidden");
    document.getElementById("w-event-count-display").textContent = String(wiz.eventCount || 1);

    const stageFormat = document.getElementById("w-stage-format");
    if (stageFormat) stageFormat.value = wiz.stageFormat || "";

    const groupCountInput = document.getElementById("w-group-count");
    const groupWrap = document.getElementById("wiz-group-count-wrap");
    if (groupCountInput) groupCountInput.value = wiz.groupCount || "";
    groupWrap?.classList.toggle("hidden", wiz.stageFormat !== "group_knockout");

    renderEventConfig();

    document.getElementById("w-max-matches-per-player").value = wiz.tournamentRules.maxMatchesPerPlayer || "";
    document.getElementById("w-best-of-sets").value = wiz.tournamentRules.bestOfSets || "";
    document.getElementById("w-points-per-set").value = wiz.tournamentRules.pointsPerSet || "";
    document.getElementById("w-min-players-per-team").value = wiz.tournamentRules.minPlayersPerTeam || "";
    document.getElementById("w-max-players-per-team").value = wiz.tournamentRules.maxPlayersPerTeam || "";

    document.getElementById("w-points-win").value = wiz.leaguePoints.win || "";
    document.getElementById("w-points-loss").value = wiz.leaguePoints.loss || "";
    document.getElementById("w-points-draw").value = wiz.leaguePoints.draw || "";

    toggleLeaguePointsSection();
    toggleTeamPlayerLimitsSection();

    syncCourtCount();
    renderCourtNameFields();

    document.getElementById("w-payment-yes")?.classList.toggle("active", !!wiz.requirePayment);
    document.getElementById("w-payment-no")?.classList.toggle("active", !wiz.requirePayment);
    document.getElementById("w-public-yes")?.classList.toggle("active", !!wiz.isPublic);
    document.getElementById("w-public-no")?.classList.toggle("active", !wiz.isPublic);
    document.getElementById("wiz-amount-wrap")?.classList.toggle("hidden", !wiz.requirePayment);
    document.getElementById("w-amount").value = wiz.amount || "";
  }

  function showCreatedToast(message = "Tournament created successfully") {
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(6, 12, 18, 0.7)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "9999";
    overlay.innerHTML = `
      <div style="background:#0f1b26;padding:24px 32px;border-radius:14px;color:#fff;font-weight:600;letter-spacing:.2px;">
        ${message}
      </div>
    `;
    document.body.appendChild(overlay);
    setTimeout(() => overlay.remove(), 1000);
  }
async function saveTournamentFromWizard() {
  collectStep(0);
  collectStep(1);
  collectStep(2);
  collectStep(4);

  const code = accessCodeInput?.value?.trim() || generateAccessCode();
  if (accessCodeInput && !accessCodeInput.value.trim()) {
    accessCodeInput.value = code;
  }

  const categoriesPayload = (wiz.eventConfigs || []).map((cfg, index) => ({
    categoryId: cfg.categoryId || `CAT-${index + 1}`,
    eventName: buildEventNameFromConfig(cfg),
    gender: cfg.gender || "",
    ageGroup: cfg.ageGroup || "",
    playingLevel: cfg.playingLevel || "",
    teamSize: Number(cfg.teamSize || 1),
    exactTeamSize: cfg.teamSize === "4" ? Number(cfg.exactTeamSize || 0) : null,
  }));

  const payload = {
    tournamentName: wiz.name,
    sportName: wiz.sport,
    tournamentDates: wiz.dateStart + (wiz.dateEnd ? " to " + wiz.dateEnd : ""),
    accessCode: code,
    playerDetails: wiz.details,
    venue: wiz.venue,
    categories: categoriesPayload,

    tournamentType: wiz.tournamentType,
    stageFormat: wiz.stageFormat,
    groupCount: wiz.stageFormat === "group_knockout" ? Number(wiz.groupCount) : null,

    tournamentRules: {
      maxMatchesPerPlayer: wiz.tournamentRules.maxMatchesPerPlayer ? Number(wiz.tournamentRules.maxMatchesPerPlayer) : null,
      bestOfSets: wiz.tournamentRules.bestOfSets ? Number(wiz.tournamentRules.bestOfSets) : null,
      pointsPerSet: wiz.tournamentRules.pointsPerSet ? Number(wiz.tournamentRules.pointsPerSet) : null,
      minPlayersPerTeam: wiz.tournamentRules.minPlayersPerTeam ? Number(wiz.tournamentRules.minPlayersPerTeam) : null,
      maxPlayersPerTeam: wiz.tournamentRules.maxPlayersPerTeam ? Number(wiz.tournamentRules.maxPlayersPerTeam) : null,
    },

    leaguePoints: shouldShowLeaguePoints() ? {
      win: wiz.leaguePoints.win !== "" ? Number(wiz.leaguePoints.win) : null,
      loss: wiz.leaguePoints.loss !== "" ? Number(wiz.leaguePoints.loss) : null,
      draw: wiz.leaguePoints.draw !== "" ? Number(wiz.leaguePoints.draw) : null,
    } : null,

    courtCount: wiz.courtCount,
    courtNames: wiz.courtNames,
    requirePayment: wiz.requirePayment,
    entryFee: wiz.requirePayment ? Number(wiz.amount || 0) : 0,
    isPublic: Boolean(wiz.isPublic),
  };

  const isEditMode = !!editingTournamentId;

  const res = await fetch(
    isEditMode ? `/api/host/tournaments/${editingTournamentId}` : "/api/host/tournaments",
    {
      method: isEditMode ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    throw new Error(isEditMode ? "Failed to update tournament" : "Failed to save tournament");
  }

  return await res.json();
}


  function parseTournamentDateRange(dateStr = "") {
    if (!dateStr) return { start: null, end: null };

    if (dateStr.includes(" to ")) {
      const [startStr, endStr] = dateStr.split(" to ").map((s) => s.trim());
      return {
        start: startStr ? new Date(startStr) : null,
        end: endStr ? new Date(endStr) : null,
      };
    }

    const single = new Date(dateStr);
    return { start: single, end: single };
  }

  function isValidDate(date) {
    return date instanceof Date && !Number.isNaN(date.getTime());
  }

  function formatDateShort(dateInput) {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (!isValidDate(date)) return String(dateInput || "-");

    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function formatTournamentDates(dateStr = "") {
    const { start, end } = parseTournamentDateRange(dateStr);

    if (isValidDate(start) && isValidDate(end)) {
      return `${formatDateShort(start)} - ${formatDateShort(end)}`;
    }
    if (isValidDate(start)) return formatDateShort(start);
    return dateStr || "-";
  }

  function getUpcomingTournaments(tournaments) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return [...tournaments]
      .map((t) => {
        const { start, end } = parseTournamentDateRange(t.tournamentDates || "");
        return { ...t, _startDate: start, _endDate: end };
      })
      .filter((t) => isValidDate(t._endDate || t._startDate) && (t._endDate || t._startDate) >= today)
      .sort((a, b) => (a._startDate || a._endDate) - (b._startDate || b._endDate));
  }

  function getTotalPlayersCount(tournaments) {
    return tournaments.reduce((sum, t) => {
      if (typeof t.totalRegistrations === "number") return sum + t.totalRegistrations;
      if (Array.isArray(t.players)) return sum + t.players.length;
      if (Array.isArray(t.registrations)) return sum + t.registrations.length;
      return sum;
    }, 0);
  }

  function getActiveEventsCount(tournaments) {
    return tournaments.reduce((sum, t) => {
      if (Array.isArray(t.categories) && t.categories.length) return sum + t.categories.length;
      return sum;
    }, 0);
  }

  function getTournamentsForDate(tournaments, dateObj) {
    return tournaments.filter((t) => {
      const { start, end } = parseTournamentDateRange(t.tournamentDates || "");
      if (!isValidDate(start)) return false;

      const startDate = new Date(start);
      startDate.setHours(0, 0, 0, 0);

      const endDate = isValidDate(end) ? new Date(end) : new Date(start);
      endDate.setHours(0, 0, 0, 0);

      const current = new Date(dateObj);
      current.setHours(0, 0, 0, 0);

      return current >= startDate && current <= endDate;
    });
  }

  function renderUpcomingRow(tournaments) {
    const container = document.getElementById("dashboard-upcoming-row");
    if (!container) return;

    const upcoming = getUpcomingTournaments(tournaments).slice(0, 10);

    if (!upcoming.length) {
      container.innerHTML = `<div class="dashboard-empty-card">No upcoming tournaments yet.</div>`;
      return;
    }

    container.innerHTML = upcoming
      .map(
        (t) => `
        <div class="upcoming-tournament-card" data-id="${t.tournamentId}">
          <h3>${t.tournamentName || "Untitled tournament"}</h3>
          <p class="upcoming-meta">${t.sportName || "-"}</p>
          <p class="upcoming-meta">${formatTournamentDates(t.tournamentDates)}</p>
        </div>
      `
      )
      .join("");

    container.querySelectorAll(".upcoming-tournament-card").forEach((card) => {
      card.addEventListener("click", () => {
        const id = card.dataset.id;
        if (!id) return;
        window.location.href = `players.html?tournamentId=${id}`;
      });
    });
  }

  function renderStats(tournaments) {
    const totalTournamentsEl = document.getElementById("stat-total-tournaments");
    const totalPlayersEl = document.getElementById("stat-total-players");
    const activeEventsEl = document.getElementById("stat-active-events");

    if (totalTournamentsEl) totalTournamentsEl.textContent = tournaments.length;
    if (totalPlayersEl) totalPlayersEl.textContent = getTotalPlayersCount(tournaments);
    if (activeEventsEl) activeEventsEl.textContent = getActiveEventsCount(tournaments);
  }

  function renderCalendar(tournaments) {
    const monthLabel = document.getElementById("calendar-month-label");
    const grid = document.getElementById("dashboard-calendar-grid");
    if (!monthLabel || !grid) return;

    const firstDay = new Date(dashboardYear, dashboardMonth, 1);
    const lastDay = new Date(dashboardYear, dashboardMonth + 1, 0);
    const startWeekday = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    monthLabel.textContent = firstDay.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    });

    const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let html = "";

    for (let i = 0; i < totalCells; i++) {
      const dayNumber = i - startWeekday + 1;
      const cellDate = new Date(dashboardYear, dashboardMonth, dayNumber);
      const inCurrentMonth = cellDate.getMonth() === dashboardMonth;
      const isToday = cellDate.getTime() === today.getTime();

      const tournamentsOnDate = inCurrentMonth ? getTournamentsForDate(tournaments, cellDate) : [];
      const visible = tournamentsOnDate.slice(0, 2);
      const extraCount = tournamentsOnDate.length - visible.length;

      html += `
        <div class="calendar-day ${inCurrentMonth ? "" : "is-other-month"} ${isToday ? "is-today" : ""}">
          <div class="calendar-date">${cellDate.getDate()}</div>
          ${visible.map((t) => `<div class="calendar-marker" title="${t.tournamentName}">${t.tournamentName}</div>`).join("")}
          ${extraCount > 0 ? `<div class="calendar-more">+${extraCount} more</div>` : ""}
        </div>
      `;
    }

    grid.innerHTML = html;
  }

  function getSportDistribution(tournaments) {
    const counts = {};

    tournaments.forEach((t) => {
      const sport = (t.sportName || "Other").trim();
      counts[sport] = (counts[sport] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([sport, count]) => ({ sport, count }))
      .sort((a, b) => b.count - a.count);
  }

  function renderSportsPieChart(tournaments) {
    const canvas = document.getElementById("sports-pie-chart");
    const legend = document.getElementById("sports-chart-legend");
    if (!canvas || !legend) return;

    const ctx = canvas.getContext("2d");
    const distribution = getSportDistribution(tournaments);
    const total = distribution.reduce((sum, item) => sum + item.count, 0);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!distribution.length || total === 0) {
      legend.innerHTML = `<div class="dashboard-empty-card" style="min-width:auto;max-width:none;">No tournaments yet.</div>`;
      return;
    }

    const colors = [
      "#4dd0e1",
      "#f25f4c",
      "#ffd166",
      "#7c9cff",
      "#7bd389",
      "#c792ea",
      "#ff9f68",
      "#5eead4"
    ];

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = 82;

    let startAngle = -Math.PI / 2;

    distribution.forEach((item, index) => {
      const sliceAngle = (item.count / total) * Math.PI * 2;
      const color = colors[index % colors.length];

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();

      startAngle += sliceAngle;
    });

    ctx.beginPath();
    ctx.arc(cx, cy, 42, 0, Math.PI * 2);
    ctx.fillStyle = "#0b1422";
    ctx.fill();

    ctx.fillStyle = "#e6eef8";
    ctx.font = "700 18px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(total), cx, cy - 8);

    ctx.fillStyle = "#a9b6cc";
    ctx.font = "12px Inter, sans-serif";
    ctx.fillText("Tournaments", cx, cy + 14);

    legend.innerHTML = distribution.map((item, index) => {
      const color = colors[index % colors.length];
      return `
        <div class="sports-chart-legend-item">
          <div class="sports-chart-legend-left">
            <span class="sports-chart-swatch" style="background:${color}"></span>
            <span class="sports-chart-name">${item.sport}</span>
          </div>
          <span class="sports-chart-value">${item.count}</span>
        </div>
      `;
    }).join("");

    const slices = [];
    let a = -Math.PI / 2;
    distribution.forEach((item, index) => {
      const sweep = (item.count / total) * Math.PI * 2;
      slices.push({ item, color: colors[index % colors.length], start: a, end: a + sweep });
      a += sweep;
    });

    let tip = document.getElementById("pie-tooltip");
    if (!tip) {
      tip = document.createElement("div");
      tip.id = "pie-tooltip";
      tip.className = "pie-tooltip";
      document.body.appendChild(tip);
    }

    if (canvas._pieAbort) canvas._pieAbort.abort();
    const ac = new AbortController();
    canvas._pieAbort = ac;
    const sig = { signal: ac.signal };

    canvas.addEventListener("mousemove", (e) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const px = (e.clientX - rect.left) * scaleX;
      const py = (e.clientY - rect.top) * scaleY;

      const dx = px - cx;
      const dy = py - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 44 || dist > radius) {
        tip.style.display = "none";
        return;
      }

      let angle = Math.atan2(dy, dx);
      if (angle < -Math.PI / 2) angle += Math.PI * 2;

      const hit = slices.find((s) => {
        if (s.end > Math.PI) return angle >= s.start || angle <= (s.end - Math.PI * 2);
        return angle >= s.start && angle < s.end;
      });

      if (hit) {
        const pct = Math.round((hit.item.count / total) * 100);
        tip.textContent = `${hit.item.sport}: ${pct}% (${hit.item.count})`;
        tip.style.display = "block";
        tip.style.left = (e.clientX + 12) + "px";
        tip.style.top = (e.clientY - 28) + "px";
      } else {
        tip.style.display = "none";
      }
    }, sig);

    canvas.addEventListener("mouseleave", () => {
      tip.style.display = "none";
    }, sig);
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
    const filter = document.getElementById("filter-sport");
    const sort = document.getElementById("sort-tournaments");
    if (!filter) return;

    const sports = [...new Set(tournaments.map((t) => t.sportName).filter(Boolean))];

    filter.innerHTML = `<option value="">All sports</option>`;
    sports.forEach((sport) => {
      const opt = document.createElement("option");
      opt.value = sport;
      opt.textContent = sport;
      filter.appendChild(opt);
    });

    filter.value = currentSportFilter;
    if (sort) sort.value = currentSortFilter;

    filter.onchange = () => {
      currentSportFilter = filter.value;
      renderMyTournaments(getFilteredAndSortedTournaments());
    };

    if (sort) {
      sort.onchange = () => {
        currentSortFilter = sort.value;
        renderMyTournaments(getFilteredAndSortedTournaments());
      };
    }
  }

async function shareTournamentCode(t) {
  const joinLink = `${window.location.origin}/join.html?tournamentId=${encodeURIComponent(tournament.tournamentId)}`;
  const shareText = `${tournament.tournamentName}\nCode: ${tournament.accessCode}\nJoin link: ${joinLink}`;

  // 1) Native share first
  if (navigator.share) {
    try {
      await navigator.share({
        title: tournament.tournamentName,
        text: shareText,
        url: joinLink,
      });
      return;
    } catch (err) {
      // user cancel or unsupported behavior -> fall through to copy
      console.warn("navigator.share failed:", err);
    }
  }

  // 2) Clipboard API next
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(shareText);
      alert("Tournament code and join link copied.");
      return;
    } catch (err) {
      console.warn("navigator.clipboard.writeText failed:", err);
    }
  }

  // 3) Final fallback for non-HTTPS / older browsers
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
    textarea.setSelectionRange(0, textarea.value.length);

    const success = document.execCommand("copy");
    document.body.removeChild(textarea);

    if (!success) {
      throw new Error("execCommand copy failed");
    }

    alert("Tournament code and join link copied.");
  } catch (err) {
    console.error("Fallback copy failed:", err);
    prompt("Copy tournament details manually:", shareText);
  }
}

async function toggleRegistrationsForTournament(tournamentId, registrationsOpen) {
  const res = await fetch(`/api/host/tournaments/${encodeURIComponent(tournamentId)}/registrations-open`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + localStorage.getItem("token"),
    },
    body: JSON.stringify({ registrationsOpen }),
  });

  if (!res.ok) {
    throw new Error("Failed to update registration status");
  }

  return await res.json();
}

  function switchHostView(view) {
    const modeCards = document.querySelectorAll(".host-mode-card");
    const dashboardView = document.getElementById("dashboard-view");
    const myView = document.getElementById("my-tournaments-view");
    const newView = document.getElementById("new-tournament-view");

    modeCards.forEach((c) => c.classList.remove("active"));
    dashboardView?.classList.remove("host-view--active");
    myView?.classList.remove("host-view--active");
    newView?.classList.remove("host-view--active");

    if (view === "dashboard") {
      document.querySelector('[data-host-mode="dashboard"]')?.classList.add("active");
      dashboardView?.classList.add("host-view--active");
    } else if (view === "my") {
      document.querySelector('[data-host-mode="my"]')?.classList.add("active");
      myView?.classList.add("host-view--active");
    } else {
      document.querySelector('[data-host-mode="new"]')?.classList.add("active");
      newView?.classList.add("host-view--active");
    }
  }

  function openTournamentForView(t) {
    viewOnlyMode = true;
    editingTournamentId = null;
    viewingTournamentId = t.tournamentId;

    wiz.name = t.tournamentName || "";
    wiz.sport = t.sportName || "";
    wiz.venue = t.venue || "";

    const dateStr = t.tournamentDates || "";
    if (dateStr.includes(" to ")) {
      const [start, end] = dateStr.split(" to ");
      wiz.dateStart = start?.trim() || "";
      wiz.dateEnd = end?.trim() || "";
    } else {
      wiz.dateStart = "";
      wiz.dateEnd = "";
    }

    wiz.details =
      typeof t.playerDetails === "string"
        ? t.playerDetails
        : Array.isArray(t.playerDetails)
          ? t.playerDetails.join(", ")
          : "";

    wiz.tournamentType = t.tournamentType || "single";
    wiz.stageFormat = t.stageFormat || "";
    wiz.groupCount = t.groupCount ? String(t.groupCount) : "";

    wiz.tournamentRules = {
      maxMatchesPerPlayer: t.tournamentRules?.maxMatchesPerPlayer != null ? String(t.tournamentRules.maxMatchesPerPlayer) : "",
      bestOfSets: t.tournamentRules?.bestOfSets != null ? String(t.tournamentRules.bestOfSets) : "",
      pointsPerSet: t.tournamentRules?.pointsPerSet != null ? String(t.tournamentRules.pointsPerSet) : "",
      minPlayersPerTeam: t.tournamentRules?.minPlayersPerTeam != null ? String(t.tournamentRules.minPlayersPerTeam) : "",
      maxPlayersPerTeam: t.tournamentRules?.maxPlayersPerTeam != null ? String(t.tournamentRules.maxPlayersPerTeam) : "",
    };

    wiz.leaguePoints = {
      win: t.leaguePoints?.win != null ? String(t.leaguePoints.win) : "",
      loss: t.leaguePoints?.loss != null ? String(t.leaguePoints.loss) : "",
      draw: t.leaguePoints?.draw != null ? String(t.leaguePoints.draw) : "",
    };

    wiz.courtCount = Number(t.courtCount || 1);
    wiz.courtNames = Array.isArray(t.courtNames) ? [...t.courtNames] : [];
    wiz.requirePayment = !!t.requirePayment;
    wiz.amount = t.entryFee != null ? String(t.entryFee) : "";
    wiz.isPublic = Boolean(t.isPublic);

    const tCats = Array.isArray(t.categories) ? t.categories : [];

    wiz.eventCount = tCats.length || 1;
    wiz.eventNames = Array.from({ length: wiz.eventCount }, (_, i) => `Category ${i + 1}`);

    wiz.eventConfigs = tCats.length
      ? tCats.map((c) => ({
          categoryId: c.categoryId || "",
          gender: c.gender || "",
          ageGroup: c.ageGroup || "",
          playingLevel: c.playingLevel || "",
          teamSize: String(c.teamSize || "1"),
          exactTeamSize: c.exactTeamSize != null ? String(c.exactTeamSize) : "",
          eventName: c.eventName || "",
        }))
      : [{
          categoryId: "",
          gender: "",
          ageGroup: "",
          playingLevel: "",
          teamSize: "1",
          exactTeamSize: "",
          eventName: "",
        }];

    document.getElementById("access-code").value = t.accessCode || "";
    hydrateWizardFormFromState();
    buildReview();
    switchHostView("new");
    showStep(5);
  }

  function openTournamentForEdit(t) {
    viewOnlyMode = false;
    editingTournamentId = t.tournamentId;
    viewingTournamentId = null;

    wiz.name = t.tournamentName || "";
    wiz.sport = t.sportName || "";
    wiz.venue = t.venue || "";

    const dateStr = t.tournamentDates || "";
    if (dateStr.includes(" to ")) {
      const [start, end] = dateStr.split(" to ");
      wiz.dateStart = start?.trim() || "";
      wiz.dateEnd = end?.trim() || "";
    } else {
      wiz.dateStart = "";
      wiz.dateEnd = "";
    }

    wiz.details =
      typeof t.playerDetails === "string"
        ? t.playerDetails
        : Array.isArray(t.playerDetails)
          ? t.playerDetails.join(", ")
          : "";

    wiz.tournamentType = t.tournamentType || "single";
    wiz.stageFormat = t.stageFormat || "";
    wiz.groupCount = t.groupCount ? String(t.groupCount) : "";

    wiz.tournamentRules = {
      maxMatchesPerPlayer: t.tournamentRules?.maxMatchesPerPlayer != null ? String(t.tournamentRules.maxMatchesPerPlayer) : "",
      bestOfSets: t.tournamentRules?.bestOfSets != null ? String(t.tournamentRules.bestOfSets) : "",
      pointsPerSet: t.tournamentRules?.pointsPerSet != null ? String(t.tournamentRules.pointsPerSet) : "",
      minPlayersPerTeam: t.tournamentRules?.minPlayersPerTeam != null ? String(t.tournamentRules.minPlayersPerTeam) : "",
      maxPlayersPerTeam: t.tournamentRules?.maxPlayersPerTeam != null ? String(t.tournamentRules.maxPlayersPerTeam) : "",
    };

    wiz.leaguePoints = {
      win: t.leaguePoints?.win != null ? String(t.leaguePoints.win) : "",
      loss: t.leaguePoints?.loss != null ? String(t.leaguePoints.loss) : "",
      draw: t.leaguePoints?.draw != null ? String(t.leaguePoints.draw) : "",
    };

    wiz.courtCount = Number(t.courtCount || 1);
wiz.courtNames = Array.isArray(t.courtNames) ? [...t.courtNames] : [];
wiz.requirePayment = !!t.requirePayment;
wiz.amount = t.entryFee != null ? String(t.entryFee) : "";
wiz.isPublic = Boolean(t.isPublic);

    const tCats = Array.isArray(t.categories) ? t.categories : [];

    wiz.eventCount = tCats.length || 1;
    wiz.eventNames = Array.from({ length: wiz.eventCount }, (_, i) => `Category ${i + 1}`);

    wiz.eventConfigs = tCats.length
      ? tCats.map((c) => ({
          categoryId: c.categoryId || "",
          gender: c.gender || "",
          ageGroup: c.ageGroup || "",
          playingLevel: c.playingLevel || "",
          teamSize: String(c.teamSize || "1"),
          exactTeamSize: c.exactTeamSize != null ? String(c.exactTeamSize) : "",
          eventName: c.eventName || "",
        }))
      : [{
          categoryId: "",
          gender: "",
          ageGroup: "",
          playingLevel: "",
          teamSize: "1",
          exactTeamSize: "",
          eventName: "",
        }];

    document.getElementById("access-code").value = t.accessCode || "";
    hydrateWizardFormFromState();
    switchHostView("new");
    showStep(0);
  }

function renderMyTournaments(tournaments) {
  const container = document.getElementById("my-tournaments-list");
  if (!container) return;

  container.innerHTML = "";

  if (!tournaments.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="feature-icon">📋</div>
        <h3>No tournaments found</h3>
      </div>
    `;
    return;
  }

  tournaments.forEach((t) => {
    const tCats = (t.categories || [])
      .map((c) => {
        if (c?.eventName) return c.eventName;

        const size = Number(c.teamSize);
        let type = "";
        if (size === 1) type = "Singles";
        else if (size === 2) type = "Doubles";
        else if (size === 3) type = "Triples";
        else if (size >= 4) type = c.exactTeamSize ? `${c.exactTeamSize}-a-side` : "Team";

        return [c.ageGroup, c.gender, type].filter(Boolean).join(" • ");
      })
      .join(", ");

    const card = document.createElement("div");
    card.className = "tournament-card";

    card.innerHTML = `
      <div class="tournament-head">
        <h3>${t.tournamentName}</h3>
        <button type="button" class="code-chip share-code-btn">${t.accessCode || "No code"}</button>
      </div>

      <p class="muted sport-date">${t.sportName} • ${t.tournamentDates}</p>
      <p class="muted">📍 ${t.venue || "-"}</p>

      ${tCats ? `<p class="muted"><strong>Categories:</strong> ${tCats}</p>` : ""}

      ${(() => {
        const details =
          typeof t.playerDetails === "string"
            ? t.playerDetails
            : Array.isArray(t.playerDetails)
              ? t.playerDetails.join(", ")
              : (t.playerDetails ?? "");

        const detailsStr = String(details || "").trim();
        return detailsStr
          ? `
            <p class="muted details-label">Details:</p>
            <p class="muted details-text">${detailsStr}</p>
          `
          : "";
      })()}

      <div class="tournament-meta">
        <span>Status: <strong>${t.registrationsOpen === false ? "Closed" : "Open"}</strong></span>
        <span>Visibility: <strong>${t.isPublic ? "Public" : "Private"}</strong></span>
      </div>

      <div class="tournament-meta tournament-actions">
        <button type="button" class="view-btn" data-id="${t.tournamentId}">View</button>
        <button type="button" class="edit-btn" data-id="${t.tournamentId}">Edit</button>
        <button type="button" class="toggle-registration-btn btn-dark" data-id="${t.tournamentId}">
          ${t.registrationsOpen === false ? "Start" : "Stop"}
        </button>
        <button type="button" class="delete-btn" data-id="${t.tournamentId}">Delete</button>
      </div>
    `;

    card.addEventListener("click", () => {
      window.location.href = `players.html?tournamentId=${t.tournamentId}`;
    });

    card.querySelector(".share-code-btn")?.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        await shareTournamentCode(t);
      } catch {
        alert("Could not copy/share tournament details.");
      }
    });

    card.querySelector(".view-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      openTournamentForView(t);
    });

    card.querySelector(".edit-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      openTournamentForEdit(t);
    });

    card.querySelector(".toggle-registration-btn")?.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        await toggleRegistrationsForTournament(t.tournamentId, t.registrationsOpen === false);
        await loadMyTournaments();
      } catch (err) {
        alert(err.message || "Could not update registration state.");
      }
    });

    card.querySelector(".delete-btn")?.addEventListener("click", async (e) => {
      e.stopPropagation();
      const ok = confirm("Delete this tournament? This cannot be undone.");
      if (!ok) return;

      try {
        const res = await fetch(`/api/host/tournaments/${encodeURIComponent(t.tournamentId)}`, {
          method: "DELETE",
          headers: {
            Authorization: "Bearer " + localStorage.getItem("token"),
          },
        });

        if (!res.ok) throw new Error("Failed to delete tournament");

        await loadMyTournaments();
      } catch (err) {
        alert(err.message || "Could not delete tournament.");
      }
    });

    container.appendChild(card);
  });
}

  async function loadSports() {
    try {
      const res = await fetch("/api/sports");
      if (!res.ok) throw new Error("Failed to load sports");

      const sports = await res.json();
      const sportSelect = document.getElementById("w-sport");
      if (!sportSelect) return;

      sportSelect.innerHTML = `<option value="">Select sport</option>`;

      sports.forEach((sport) => {
        const option = document.createElement("option");
        option.value = sport.sport_name;
        option.textContent = sport.sport_name;
        sportSelect.appendChild(option);
      });

      if (wiz.sport) sportSelect.value = wiz.sport;
    } catch (err) {
      console.error("Error loading sports:", err);
    }
  }

  async function loadMyTournaments() {
    const token = localStorage.getItem("token");

    const res = await fetch("/api/host/tournaments", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      console.error("Failed to load tournaments");
      return;
    }

    allTournaments = await res.json();

    populateSportFilter(allTournaments);
    renderDashboard(allTournaments);
    renderMyTournaments(getFilteredAndSortedTournaments());
  }

  const user = await requireAuth();
  if (!user) return;

  document.querySelectorAll(".brand").forEach((el) => {
    el.addEventListener("click", () => {
      window.location.href = "index.html";
    });
  });

  sidebarToggleBtn?.addEventListener("click", () => {
    sidebar?.classList.toggle("is-collapsed");
  });

  if (generateCodeBtn && accessCodeInput) {
    generateCodeBtn.addEventListener("click", () => {
      accessCodeInput.value = generateAccessCode();
    });
  }

  if (viewPlayersBtn) {
    viewPlayersBtn.addEventListener("click", () => {
      if (!selectedTournamentId) {
        alert("No tournament selected");
        return;
      }
      window.location.href = `players.html?tournamentId=${selectedTournamentId}`;
    });
  }

  const trigger = document.getElementById("host-user-menu-trigger");
  const dropdown = document.getElementById("host-user-menu-dropdown");

  if (trigger) {
    const label = (user?.name || user?.username || user?.email || "U").trim();
    trigger.textContent = label.charAt(0).toUpperCase();
  }

  trigger?.addEventListener("click", () => dropdown?.classList.toggle("is-open"));

  document.getElementById("dropdown-signout")?.addEventListener("click", () => {
    dropdown?.classList.remove("is-open");
    logout();
  });

  const playerBtn = document.getElementById("mode-player-btn");
  const hostBtn = document.getElementById("mode-host-btn");

  hostBtn?.classList.add("is-active");
  playerBtn?.classList.remove("is-active");

  playerBtn?.addEventListener("click", async () => {
    playerBtn.classList.add("is-active");
    hostBtn?.classList.remove("is-active");

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

  hostBtn?.addEventListener("click", () => {
    hostBtn.classList.add("is-active");
    playerBtn?.classList.remove("is-active");
  });

  document.querySelectorAll(".wiz-type-card").forEach((card) => {
  card.addEventListener("click", () => {
    if (viewOnlyMode) return;

    document.querySelectorAll(".wiz-type-card").forEach((c) => c.classList.remove("active"));
      card.classList.add("active");

      wiz.tournamentType = card.dataset.type;

      document.getElementById("wiz-event-count-wrap")?.classList.remove("hidden");

      if (!wiz.eventCount || wiz.eventCount < 1) {
        wiz.eventCount = 1;
      }

      document.getElementById("w-event-count-display").textContent = String(wiz.eventCount);

      while (wiz.eventConfigs.length < wiz.eventCount) {
        wiz.eventConfigs.push({
          categoryId: "",
          gender: "",
          ageGroup: "",
          playingLevel: "",
          teamSize: "1",
          eventName: "",
        });
      }
      wiz.eventConfigs = wiz.eventConfigs.slice(0, wiz.eventCount);

      toggleTeamPlayerLimitsSection();
      renderEventConfig();
    });
  });

  document.getElementById("wiz-event-dec")?.addEventListener("click", () => {
    if (viewOnlyMode) return;
    if (wiz.eventCount > 1) {
      wiz.eventCount--;
      document.getElementById("w-event-count-display").textContent = String(wiz.eventCount);
      wiz.eventConfigs = wiz.eventConfigs.slice(0, wiz.eventCount);
      renderEventConfig();
    }
  });

  document.getElementById("wiz-event-inc")?.addEventListener("click", () => {
    if (viewOnlyMode) return;
    if (wiz.eventCount < 10) {
      wiz.eventCount++;
      document.getElementById("w-event-count-display").textContent = String(wiz.eventCount);
      while (wiz.eventConfigs.length < wiz.eventCount) {
        wiz.eventConfigs.push({
          categoryId: "",
          gender: "",
          ageGroup: "",
          playingLevel: "",
          teamSize: "1",
          eventName: "",
        });
      }
      renderEventConfig();
    }
  });

  const stageFormatSelect = document.getElementById("w-stage-format");
  const groupCountWrap = document.getElementById("wiz-group-count-wrap");

  stageFormatSelect?.addEventListener("change", () => {
    if (viewOnlyMode) return;

    wiz.stageFormat = stageFormatSelect.value;
    const isGroupKnockout = wiz.stageFormat === "group_knockout";
    groupCountWrap?.classList.toggle("hidden", !isGroupKnockout);

    if (!isGroupKnockout) {
      wiz.groupCount = "";
      const groupInput = document.getElementById("w-group-count");
      if (groupInput) groupInput.value = "";
    }

    toggleLeaguePointsSection();
  });

  document.getElementById("w-group-count")?.addEventListener("input", (e) => {
    if (viewOnlyMode) return;
    wiz.groupCount = e.target.value;
  });

  document.querySelectorAll(".wiz-date-trigger").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (viewOnlyMode) return;
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      openNativeDatePicker(input);
    });
  });

  document.getElementById("wiz-court-dec")?.addEventListener("click", () => {
    if (viewOnlyMode) return;
    if (wiz.courtCount > 1) {
      wiz.courtCount--;
      syncCourtCount();
      renderCourtNameFields();
    }
  });

  document.getElementById("wiz-court-inc")?.addEventListener("click", () => {
    if (viewOnlyMode) return;
    if (wiz.courtCount < 20) {
      wiz.courtCount++;
      syncCourtCount();
      renderCourtNameFields();
    }
  });

  document.getElementById("w-payment-no")?.addEventListener("click", () => {
    if (viewOnlyMode) return;
    wiz.requirePayment = false;
    document.getElementById("w-payment-no")?.classList.add("active");
    document.getElementById("w-payment-yes")?.classList.remove("active");
    document.getElementById("wiz-amount-wrap")?.classList.add("hidden");
  });

  document.getElementById("w-public-yes")?.addEventListener("click", () => {
  wiz.isPublic = true;
  document.getElementById("w-public-yes")?.classList.add("active");
  document.getElementById("w-public-no")?.classList.remove("active");
});

document.getElementById("w-public-no")?.addEventListener("click", () => {
  wiz.isPublic = false;
  document.getElementById("w-public-no")?.classList.add("active");
  document.getElementById("w-public-yes")?.classList.remove("active");
});

  document.getElementById("w-payment-yes")?.addEventListener("click", () => {
    if (viewOnlyMode) return;
    wiz.requirePayment = true;
    document.getElementById("w-payment-yes")?.classList.add("active");
    document.getElementById("w-payment-no")?.classList.remove("active");
    document.getElementById("wiz-amount-wrap")?.classList.remove("hidden");
  });

  wizBackBtn?.addEventListener("click", () => {
    if (viewOnlyMode) return;
    if (currentStep > 0) showStep(currentStep - 1);
  });

  wizNextBtn?.addEventListener("click", () => {
    if (viewOnlyMode) return;
    if (!validateStep(currentStep)) return;
    collectStep(currentStep);
    const next = currentStep + 1;
    if (next === 2) renderEventConfig();
    showStep(next);
  });

wizSaveNowBtn?.addEventListener("click", async () => {
  try {
    wizSaveNowBtn.disabled = true;
    wizSaveNowBtn.textContent = "Saving...";
    await saveTournamentFromWizard();
    showCreatedToast("Tournament saved successfully");
    await loadMyTournaments();
  } catch (err) {
    alert(err.message || "Something went wrong");
  } finally {
    if (wizSaveNowBtn) {
      wizSaveNowBtn.disabled = false;
      wizSaveNowBtn.textContent = "💾 Save now";
    }
  }
});

wizSubmitBtn?.addEventListener("click", async () => {
  try {
    wizSubmitBtn.disabled = true;
    wizSubmitBtn.textContent = editingTournamentId ? "Saving..." : "Creating...";
    await saveTournamentFromWizard();
    showCreatedToast(editingTournamentId ? "Tournament updated successfully" : "Tournament created successfully");
    resetWizardStateAndUI();
    showStep(0);
    await loadMyTournaments();
    switchHostView("my");
  } catch (err) {
    alert(err.message || "Something went wrong");
  } finally {
    if (wizSubmitBtn) {
      wizSubmitBtn.disabled = false;
      wizSubmitBtn.textContent = editingTournamentId ? "💾 Save changes" : "🚀 Create tournament";
    }
  }
});

  wizCancelEditBtn?.addEventListener("click", () => {
    resetWizardStateAndUI();
    hydrateWizardFormFromState();
    showStep(0);
    switchHostView("my");
  });

  wizViewPlayersBtn?.addEventListener("click", () => {
    const id = viewingTournamentId || editingTournamentId;
    if (!id) {
      alert("Tournament not found");
      return;
    }
    window.location.href = `players.html?tournamentId=${id}`;
  });

  wizEditViewBtn?.addEventListener("click", () => {
    const id = viewingTournamentId;
    if (!id) {
      alert("Tournament not found");
      return;
    }

    const tournament = allTournaments.find((t) => t.tournamentId === id);
    if (!tournament) {
      alert("Tournament not found");
      return;
    }

    openTournamentForEdit(tournament);
  });

  document.querySelectorAll(".host-mode-card").forEach((card) => {
    card.addEventListener("click", () => {
      const mode = card.dataset.hostMode;

      if (mode === "new") {
        resetWizardStateAndUI();
        hydrateWizardFormFromState();
        showStep(0);
      }

      switchHostView(mode);
    });
  });

  document.getElementById("calendar-prev-btn")?.addEventListener("click", () => {
    dashboardMonth--;
    if (dashboardMonth < 0) {
      dashboardMonth = 11;
      dashboardYear--;
    }
    renderCalendar(allTournaments);
  });

  document.getElementById("calendar-next-btn")?.addEventListener("click", () => {
    dashboardMonth++;
    if (dashboardMonth > 11) {
      dashboardMonth = 0;
      dashboardYear++;
    }
    renderCalendar(allTournaments);
  });

  await loadSports();
  renderCourtNameFields();
  await loadMyTournaments();
  switchHostView("dashboard");
  setWizardModeUI();
});