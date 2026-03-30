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
  const viewPlayersBtn  = document.getElementById("modalViewPlayers");
  let selectedTournamentId = null;

  let dashboardMonth = new Date().getMonth();
  let dashboardYear = new Date().getFullYear();

  // ─── Legacy stubs so host.js doesn't crash on refs that no longer exist ───
  const categoriesContainer = document.getElementById("categories-container");
  const addCategoryBtn      = document.getElementById("add-category-btn"); // null in new UI
  let categories = [];

  // ══════════════════════════════════════════════════════════════════════
  //  MULTI-STEP WIZARD
  // ══════════════════════════════════════════════════════════════════════

  const TOTAL_STEPS = 6;
  let currentStep   = 0;
  let editingTournamentId = null;

  // Wizard data model
  const wiz = {
    name:        "",
    sport:       "",
    dateStart:   "",
    dateEnd:     "",
    venue:       "",
    details:     "",

    tournamentType: "single",   // single | team
    eventCount:  1,
    eventNames:  [],
    eventConfigs:[],

    stageFormat: "",            // knockout | round_robin | group_knockout
    groupCount: "",

    tournamentRules: {
      maxMatchesPerPlayer: "",
      bestOfSets: "",
      pointsPerSet: ""
    },

    leaguePoints: {
      win: "",
      loss: "",
      draw: ""
    },

    courtCount:  1,
    courtNames:  [],
    requirePayment: false,
    amount:      "",
  };

  // ── DOM refs ──────────────────────────────────────────────────────────
const wizStepsEl        = document.getElementById("wiz-steps");
const wizBackBtn        = document.getElementById("wiz-back-btn");
const wizNextBtn        = document.getElementById("wiz-next-btn");
const wizSubmitBtn      = document.getElementById("wiz-submit-btn");
const wizSaveNowBtn     = document.getElementById("wiz-save-now-btn");
const wizCancelEditBtn  = document.getElementById("wiz-cancel-edit-btn");
const wizDots           = document.querySelectorAll(".wiz-step-dot");
const wizLines          = document.querySelectorAll(".wiz-progress-line");
  // ── Render progress bar ───────────────────────────────────────────────
  function updateProgress() {
    wizDots.forEach((dot, i) => {
      dot.classList.toggle("active",    i === currentStep);
      dot.classList.toggle("complete",  i <  currentStep);
    });
    wizLines.forEach((line, i) => {
      line.classList.toggle("complete", i < currentStep);
    });
    wizBackBtn.classList.toggle("hidden", currentStep === 0);
    if (currentStep === TOTAL_STEPS - 1) {
      wizNextBtn.classList.add("hidden");
      wizSubmitBtn.classList.remove("hidden");
    } else {
      wizNextBtn.classList.remove("hidden");
      wizSubmitBtn.classList.add("hidden");
    }
  }

  function setWizardModeUI() {
  const isEditMode = !!editingTournamentId;
  const isViewMode = !!viewOnlyMode;

  if (wizSaveNowBtn) {
    wizSaveNowBtn.classList.toggle("hidden", !isEditMode || isViewMode);
  }

  if (wizCancelEditBtn) {
    wizCancelEditBtn.classList.toggle("hidden", !(isEditMode || isViewMode));
    wizCancelEditBtn.textContent = isViewMode ? "← Back to My tournaments" : "Cancel";
  }

  if (wizSubmitBtn) {
    if (isViewMode) {
      wizSubmitBtn.classList.add("hidden");
    } else {
      wizSubmitBtn.textContent = isEditMode ? "💾 Save changes" : "🚀 Create tournament";
    }
  }

  if (wizNextBtn) {
    if (isViewMode) wizNextBtn.classList.add("hidden");
  }

  if (wizBackBtn) {
    if (isViewMode) wizBackBtn.classList.add("hidden");
  }
}

function resetWizardStateAndUI() {
  Object.assign(wiz, {
    name:"", sport:"", dateStart:"", dateEnd:"", venue:"", details:"",
    tournamentType:"single",
    eventCount:1,
    eventNames:[],
    eventConfigs:[],
    stageFormat:"",
    groupCount:"",
    tournamentRules: {
      maxMatchesPerPlayer: "",
      bestOfSets: "",
      pointsPerSet: ""
    },
    leaguePoints: {
      win: "",
      loss: "",
      draw: ""
    },
    courtCount:1,
    courtNames:[],
    requirePayment:false,
    amount:""
  });

  editingTournamentId = null;
  viewOnlyMode = false;

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

  document.querySelectorAll(".wiz-type-card").forEach(c => c.classList.toggle("active", c.dataset.type === "single"));
  document.getElementById("wiz-event-count-wrap").classList.add("hidden");
  document.getElementById("wiz-event-names-wrap").classList.add("hidden");
  document.getElementById("w-payment-no").classList.add("active");
  document.getElementById("w-payment-yes").classList.remove("active");
  document.getElementById("wiz-amount-wrap").classList.add("hidden");
  document.getElementById("access-code").value = "";

  if (wizSubmitBtn) {
    wizSubmitBtn.disabled = false;
    wizSubmitBtn.textContent = "🚀 Create tournament";
  }
  if (wizSaveNowBtn) {
    wizSaveNowBtn.disabled = false;
    wizSaveNowBtn.textContent = "💾 Save now";
  }

  setWizardModeUI();
}

function openTournamentForView(t) {
  viewOnlyMode = true;
  editingTournamentId = null;

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

  const categories = Array.isArray(t.categories) ? t.categories : [];

  if (wiz.tournamentType === "team") {
    const eventNames = categories.map(c => c.eventName || "").filter(Boolean);
    wiz.eventNames = eventNames.length ? eventNames : [""];
    wiz.eventCount = wiz.eventNames.length;
  } else {
    wiz.eventNames = [];
    wiz.eventCount = 1;
  }

  wiz.eventConfigs = categories.length
    ? categories.map(c => ({
        categoryId: c.categoryId || "",
        gender: c.gender || "",
        ageGroup: c.ageGroup || "",
        playingLevel: c.playingLevel || "",
        teamSize: String(c.teamSize || "1"),
        eventName: c.eventName || "",
      }))
    : [{ categoryId: "", gender: "", ageGroup: "", playingLevel: "", teamSize: "1", eventName: "" }];

  document.getElementById("access-code").value = t.accessCode || "";
  hydrateWizardFormFromState();
  buildReview();
  switchHostView("new");
  showStep(5);
  setWizardModeUI();
}

  // ── Show/hide step panels ─────────────────────────────────────────────
  function showStep(n) {
    document.querySelectorAll(".wiz-step").forEach((el, i) => {
      el.classList.toggle("active", i === n);
    });
    currentStep = n;
    updateProgress();
    setWizardModeUI();
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

function openNativeDatePicker(input) {
  if (!input) return;
  if (typeof input.showPicker === "function") {
    input.showPicker();
  } else {
    input.focus();
    input.click();
  }
}

  // ── Step validation ───────────────────────────────────────────────────
  function validateStep(n) {
    if (n === 0) {
      if (!document.getElementById("w-name").value.trim())  { alert("Please enter the tournament name."); return false; }
      if (!document.getElementById("w-sport").value)        { alert("Please select a sport."); return false; }
      if (!document.getElementById("w-date-start").value)   { alert("Please set a start date."); return false; }
      if (!document.getElementById("w-date-end").value)     { alert("Please set an end date."); return false; }
      if (!document.getElementById("w-venue").value.trim()) { alert("Please enter a venue."); return false; }
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

      if (wiz.tournamentType === "team") {
        const anyEmpty = wiz.eventNames.some(name => !name.trim());
        if (anyEmpty) {
          alert("Please name all events.");
          return false;
        }
      }
    }

    if (n === 4) {
      if (wiz.requirePayment && !document.getElementById("w-amount").value) {
        alert("Please enter the entry fee amount.");
        return false;
      }
    }

    return true;
  }

  // ── Collect data from current step ───────────────────────────────────
  function collectStep(n) {
    if (n === 0) {
      wiz.name      = document.getElementById("w-name").value.trim();
      wiz.sport     = document.getElementById("w-sport").value;
      wiz.dateStart = document.getElementById("w-date-start").value;
      wiz.dateEnd   = document.getElementById("w-date-end").value;
      wiz.venue     = document.getElementById("w-venue").value.trim();
      wiz.details   = document.getElementById("w-details").value.trim();
    }

    if (n === 1) {
      wiz.stageFormat = document.getElementById("w-stage-format")?.value || "";
      wiz.groupCount  = document.getElementById("w-group-count")?.value || "";
    }

    if (n === 2) {
      wiz.tournamentRules.maxMatchesPerPlayer = document.getElementById("w-max-matches-per-player")?.value || "";
      wiz.tournamentRules.bestOfSets          = document.getElementById("w-best-of-sets")?.value || "";
      wiz.tournamentRules.pointsPerSet        = document.getElementById("w-points-per-set")?.value || "";

      wiz.leaguePoints.win  = document.getElementById("w-points-win")?.value || "";
      wiz.leaguePoints.loss = document.getElementById("w-points-loss")?.value || "";
      wiz.leaguePoints.draw = document.getElementById("w-points-draw")?.value || "";
    }

    if (n === 4) {
      wiz.amount = document.getElementById("w-amount")?.value || "";
    }
  }

  // ── Step 2: Format ────────────────────────────────────────────────────
  function renderEventNameFields() {
    const wrap = document.getElementById("wiz-event-name-fields");
    if (!wrap) return;
    wrap.innerHTML = "";
    for (let i = 0; i < wiz.eventCount; i++) {
      const div = document.createElement("div");
      div.className = "field-group wiz-event-name-row";
      div.innerHTML = `
        <label>Event ${i + 1}</label>
        <input type="text" class="wiz-event-name-inp" data-idx="${i}"
          placeholder="e.g. Men's Singles"
          value="${wiz.eventNames[i] || ""}" />`;
      wrap.appendChild(div);
    }
    wrap.querySelectorAll(".wiz-event-name-inp").forEach(inp => {
      inp.addEventListener("input", () => {
        wiz.eventNames[Number(inp.dataset.idx)] = inp.value;
      });
    });
  }

  // Type card selection
  document.querySelectorAll(".wiz-type-card").forEach(card => {
    card.addEventListener("click", () => {
      document.querySelectorAll(".wiz-type-card").forEach(c => c.classList.remove("active"));
      card.classList.add("active");

      wiz.tournamentType = card.dataset.type;
      const isTeam = wiz.tournamentType === "team";

      document.getElementById("wiz-event-count-wrap").classList.toggle("hidden", !isTeam);
      document.getElementById("wiz-event-names-wrap").classList.toggle("hidden", !isTeam);

      if (isTeam) {
        wiz.eventCount = 1;
        document.getElementById("w-event-count-display").textContent = "1";
        wiz.eventNames = [wiz.eventNames[0] || ""];
        renderEventNameFields();
      } else {
        wiz.eventCount = 1;
        document.getElementById("w-event-count-display").textContent = "1";
        wiz.eventNames = [];
      }
    });
  });

  // Event count +/−
  document.getElementById("wiz-event-dec")?.addEventListener("click", () => {
    if (wiz.eventCount > 1) { wiz.eventCount--; syncEventCount(); }
  });
  document.getElementById("wiz-event-inc")?.addEventListener("click", () => {
    if (wiz.eventCount < 10) { wiz.eventCount++; syncEventCount(); }
  });
  function syncEventCount() {
    document.getElementById("w-event-count-display").textContent = wiz.eventCount;
    wiz.eventNames = wiz.eventNames.slice(0, wiz.eventCount);
    while (wiz.eventNames.length < wiz.eventCount) wiz.eventNames.push("");
    renderEventNameFields();
  }

  const stageFormatSelect = document.getElementById("w-stage-format");
  const groupCountWrap = document.getElementById("wiz-group-count-wrap");

  stageFormatSelect?.addEventListener("change", () => {
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
    wiz.groupCount = e.target.value;
  });

  document.querySelectorAll(".wiz-date-trigger").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      openNativeDatePicker(input);
    });
  });

  // ── Step 3: Event config ──────────────────────────────────────────────
  function renderEventConfig() {
    const wrap = document.getElementById("wiz-event-config");
    if (!wrap) return;
    wrap.innerHTML = "";

    const events = wiz.tournamentType === "single"
      ? [{ name: wiz.name || "Event 1" }]
      : wiz.eventNames.map((n, i) => ({ name: n || `Event ${i + 1}` }));

    // Ensure configs array is right length
    while (wiz.eventConfigs.length < events.length) wiz.eventConfigs.push({ gender: "", ageGroup: "", playingLevel: "", teamSize: "1" });
    wiz.eventConfigs = wiz.eventConfigs.slice(0, events.length);

    events.forEach((ev, i) => {
      const cfg = wiz.eventConfigs[i];
      const card = document.createElement("div");
      card.className = "wiz-event-cfg-card";
      card.innerHTML = `
        <div class="wiz-event-cfg-title">${ev.name}</div>
        <div class="wiz-cfg-grid">
          <div class="field-group">
            <label>Gender</label>
            <select class="wiz-cfg-sel" data-idx="${i}" data-field="gender">
              <option value="">Any</option>
              <option value="Male"   ${cfg.gender==="Male"   ?"selected":""}>Male</option>
              <option value="Female" ${cfg.gender==="Female" ?"selected":""}>Female</option>
              <option value="Mixed"  ${cfg.gender==="Mixed"  ?"selected":""}>Mixed</option>
            </select>
          </div>
          <div class="field-group">
            <label>Age group</label>
            <select class="wiz-cfg-sel" data-idx="${i}" data-field="ageGroup">
              <option value="">Any</option>
              <option value="U12"  ${cfg.ageGroup==="U12"  ?"selected":""}>U12</option>
              <option value="U14"  ${cfg.ageGroup==="U14"  ?"selected":""}>U14</option>
              <option value="U16"  ${cfg.ageGroup==="U16"  ?"selected":""}>U16</option>
              <option value="U18"  ${cfg.ageGroup==="U18"  ?"selected":""}>U18</option>
              <option value="U21"  ${cfg.ageGroup==="U21"  ?"selected":""}>U21</option>
              <option value="Open" ${cfg.ageGroup==="Open" ?"selected":""}>Open</option>
              <option value="35+"  ${cfg.ageGroup==="35+"  ?"selected":""}>35+</option>
              <option value="50+"  ${cfg.ageGroup==="50+"  ?"selected":""}>50+</option>
            </select>
          </div>
          <div class="field-group">
            <label>Playing level</label>
            <select class="wiz-cfg-sel" data-idx="${i}" data-field="playingLevel">
              <option value="">Any</option>
              <option value="Beginner"      ${cfg.playingLevel==="Beginner"      ?"selected":""}>Beginner</option>
              <option value="Intermediate"  ${cfg.playingLevel==="Intermediate"  ?"selected":""}>Intermediate</option>
              <option value="Advanced"      ${cfg.playingLevel==="Advanced"      ?"selected":""}>Advanced</option>
              <option value="Professional"  ${cfg.playingLevel==="Professional"  ?"selected":""}>Professional</option>
            </select>
          </div>
          <div class="field-group">
            <label>Format</label>
            <select class="wiz-cfg-sel" data-idx="${i}" data-field="teamSize">
              <option value="1" ${cfg.teamSize==="1"?"selected":""}>Singles (1v1)</option>
              <option value="2" ${cfg.teamSize==="2"?"selected":""}>Doubles (2v2)</option>
              <option value="3" ${cfg.teamSize==="3"?"selected":""}>Triples (3v3)</option>
              <option value="4" ${cfg.teamSize==="4"?"selected":""}>Team (4+)</option>
            </select>
          </div>
        </div>`;
      card.querySelectorAll(".wiz-cfg-sel").forEach(sel => {
        sel.addEventListener("change", () => {
          wiz.eventConfigs[Number(sel.dataset.idx)][sel.dataset.field] = sel.value;
        });
      });
      wrap.appendChild(card);
    });

    toggleLeaguePointsSection();
  }

  // ── Step 4: Courts ────────────────────────────────────────────────────
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
        <input type="text" class="wiz-court-inp" data-idx="${i}"
          placeholder="e.g. Court A" value="${wiz.courtNames[i] || ""}" />`;
      wrap.appendChild(div);
      wrap.querySelector(`[data-idx="${i}"]`).addEventListener("input", (e) => {
        wiz.courtNames[i] = e.target.value;
      });
    }
  }

  document.getElementById("wiz-court-dec")?.addEventListener("click", () => {
    if (wiz.courtCount > 1) { wiz.courtCount--; document.getElementById("w-court-count-display").textContent = wiz.courtCount; renderCourtNameFields(); }
  });
  document.getElementById("wiz-court-inc")?.addEventListener("click", () => {
    if (wiz.courtCount < 20) { wiz.courtCount++; document.getElementById("w-court-count-display").textContent = wiz.courtCount; renderCourtNameFields(); }
  });
  renderCourtNameFields();

  // ── Step 5: Payment ───────────────────────────────────────────────────
  document.getElementById("w-payment-no")?.addEventListener("click", () => {
    wiz.requirePayment = false;
    document.getElementById("w-payment-no").classList.add("active");
    document.getElementById("w-payment-yes").classList.remove("active");
    document.getElementById("wiz-amount-wrap").classList.add("hidden");
  });
  document.getElementById("w-payment-yes")?.addEventListener("click", () => {
    wiz.requirePayment = true;
    document.getElementById("w-payment-yes").classList.add("active");
    document.getElementById("w-payment-no").classList.remove("active");
    document.getElementById("wiz-amount-wrap").classList.remove("hidden");
  });

  // ── Step 6: Review ────────────────────────────────────────────────────
  function buildReview() {
    const body = document.getElementById("wiz-review-body");
    if (!body) return;

    const events = wiz.tournamentType === "single"
      ? [{ name: "Single event", cfg: wiz.eventConfigs[0] || {} }]
      : wiz.eventNames.map((n, i) => ({ name: n || `Event ${i+1}`, cfg: wiz.eventConfigs[i] || {} }));

    const courtList = wiz.courtNames.filter(Boolean).join(", ") || Array.from({length:wiz.courtCount},(_,i)=>`Court ${i+1}`).join(", ");

    const evRows = events.map(ev => {
      const c = ev.cfg;
      const tags = [c.gender, c.ageGroup, c.playingLevel, c.teamSize==="1"?"Singles":c.teamSize==="2"?"Doubles":c.teamSize==="3"?"Triples":"Team"].filter(Boolean).join(" · ");
      return `<div class="wiz-review-event"><span class="wiz-review-event-name">${ev.name}</span>${tags?`<span class="wiz-review-event-tags">${tags}</span>`:""}</div>`;
    }).join("");

    body.innerHTML = `
      <div class="wiz-review-section">
        <div class="wiz-review-row"><span class="wiz-review-key">Tournament</span><span class="wiz-review-val">${wiz.name}</span></div>
        <div class="wiz-review-row"><span class="wiz-review-key">Sport</span><span class="wiz-review-val">${wiz.sport}</span></div>
        <div class="wiz-review-row"><span class="wiz-review-key">Dates</span><span class="wiz-review-val">${wiz.dateStart}${wiz.dateEnd ? " → " + wiz.dateEnd : ""}</span></div>
        <div class="wiz-review-row"><span class="wiz-review-key">Venue</span><span class="wiz-review-val">${wiz.venue}</span></div>
        ${wiz.details ? `<div class="wiz-review-row"><span class="wiz-review-key">Notes</span><span class="wiz-review-val">${wiz.details}</span></div>` : ""}
      </div>

      <div class="wiz-review-section">
        <div class="wiz-review-row"><span class="wiz-review-key">Tournament type</span><span class="wiz-review-val">${wiz.tournamentType === "team" ? "Team event" : "Single event"}</span></div>
        <div class="wiz-review-row"><span class="wiz-review-key">Format</span><span class="wiz-review-val">${
          wiz.stageFormat === "knockout" ? "Knockout" :
          wiz.stageFormat === "round_robin" ? "Round Robin" :
          wiz.stageFormat === "group_knockout" ? "Group + Knockout" : "-"
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
      </div>

      ${shouldShowLeaguePoints() ? `
        <div class="wiz-review-section">
          <div class="wiz-review-section-title">League match points</div>
          <div class="wiz-review-row"><span class="wiz-review-key">Win</span><span class="wiz-review-val">${wiz.leaguePoints.win || "-"}</span></div>
          <div class="wiz-review-row"><span class="wiz-review-key">Loss</span><span class="wiz-review-val">${wiz.leaguePoints.loss || "-"}</span></div>
          <div class="wiz-review-row"><span class="wiz-review-key">Draw</span><span class="wiz-review-val">${wiz.leaguePoints.draw || "-"}</span></div>
        </div>
      ` : ""}

      <div class="wiz-review-section">
        <div class="wiz-review-row"><span class="wiz-review-key">Courts</span><span class="wiz-review-val">${courtList}</span></div>
        <div class="wiz-review-row"><span class="wiz-review-key">Payment</span><span class="wiz-review-val">${wiz.requirePayment ? "₹" + wiz.amount : "Free entry"}</span></div>
      </div>
    `;
  }

  // ── Nav buttons ───────────────────────────────────────────────────────
  wizBackBtn?.addEventListener("click", () => {
    if (currentStep > 0) showStep(currentStep - 1);
  });

  wizNextBtn?.addEventListener("click", () => {
    if (!validateStep(currentStep)) return;
    collectStep(currentStep);
    const next = currentStep + 1;
    if (next === 2) renderEventConfig();   // build event config cards fresh
    showStep(next);
  });

  // ── Submit ────────────────────────────────────────────────────────────
async function submitTournament() {
  collectStep(currentStep);

  const code = document.getElementById("access-code").value;
  if (!code) {
    alert("Please generate an access code first.");
    return;
  }

  categories = wiz.eventConfigs.map((cfg, i) => ({
    categoryId: cfg.categoryId || ("CAT-" + Math.random().toString(36).slice(2,8).toUpperCase()),
    ageGroup: cfg.ageGroup || "",
    gender: cfg.gender || "",
    teamSize: cfg.teamSize || "1",
    playingLevel: cfg.playingLevel || "",
    eventName: wiz.tournamentType === "single" ? "" : (wiz.eventNames[i] || cfg.eventName || ""),
  }));

  document.getElementById("tournament-name").value  = wiz.name;
  document.getElementById("sport-name").value       = wiz.sport;
  document.getElementById("tournament-dates").value = wiz.dateStart + (wiz.dateEnd ? " to " + wiz.dateEnd : "");
  document.getElementById("tournament-venue").value = wiz.venue;
  document.getElementById("player-details").value   = wiz.details;

  const payload = {
    tournamentName: wiz.name,
    sportName: wiz.sport,
    tournamentDates: wiz.dateStart + (wiz.dateEnd ? " to " + wiz.dateEnd : ""),
    accessCode: code,
    playerDetails: wiz.details,
    venue: wiz.venue,
    categories,

    tournamentType: wiz.tournamentType,
    eventCount: wiz.eventCount,
    eventNames: wiz.eventNames,
    eventConfigs: categories,

    stageFormat: wiz.stageFormat,
    groupCount: wiz.stageFormat === "group_knockout" ? Number(wiz.groupCount) : null,

    tournamentRules: {
      maxMatchesPerPlayer: wiz.tournamentRules.maxMatchesPerPlayer ? Number(wiz.tournamentRules.maxMatchesPerPlayer) : null,
      bestOfSets: wiz.tournamentRules.bestOfSets ? Number(wiz.tournamentRules.bestOfSets) : null,
      pointsPerSet: wiz.tournamentRules.pointsPerSet ? Number(wiz.tournamentRules.pointsPerSet) : null,
    },

    leaguePoints: shouldShowLeaguePoints() ? {
      win: wiz.leaguePoints.win !== "" ? Number(wiz.leaguePoints.win) : null,
      loss: wiz.leaguePoints.loss !== "" ? Number(wiz.leaguePoints.loss) : null,
      draw: wiz.leaguePoints.draw !== "" ? Number(wiz.leaguePoints.draw) : null,
    } : null,

    courtCount: wiz.courtCount,
    courtNames: wiz.courtNames,
    requirePayment: wiz.requirePayment,
    entryFee: wiz.requirePayment ? Number(wiz.amount) : 0,
  };

  const isEditMode = !!editingTournamentId;

  if (wizSubmitBtn) {
    wizSubmitBtn.disabled = true;
    wizSubmitBtn.textContent = "Saving…";
  }
  if (wizSaveNowBtn) {
    wizSaveNowBtn.disabled = true;
    wizSaveNowBtn.textContent = "Saving…";
  }

  const res = await fetch(
    isEditMode
      ? `/api/host/tournaments/${editingTournamentId}`
      : "/api/host/tournaments",
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
    alert(isEditMode ? "Failed to update tournament" : "Failed to save tournament");

    if (wizSubmitBtn) {
      wizSubmitBtn.disabled = false;
      wizSubmitBtn.textContent = isEditMode ? "💾 Save changes" : "🚀 Create tournament";
    }
    if (wizSaveNowBtn) {
      wizSaveNowBtn.disabled = false;
      wizSaveNowBtn.textContent = "💾 Save now";
    }
    return;
  }

  showCreatedToast(isEditMode ? "Tournament updated successfully" : "Tournament created successfully");

  resetWizardStateAndUI();
  showStep(0);
  await loadMyTournaments();
  switchHostView("my");
}

wizSubmitBtn?.addEventListener("click", submitTournament);
wizSaveNowBtn?.addEventListener("click", submitTournament);

wizCancelEditBtn?.addEventListener("click", () => {
  resetWizardStateAndUI();
  hydrateWizardFormFromState();
  showStep(0);
  switchHostView("my");
});
    // Sync hidden fields so existing host.js submit handler still works
    document.getElementById("tournament-name").value  = wiz.name;
    document.getElementById("sport-name").value       = wiz.sport;
    document.getElementById("tournament-dates").value = wiz.dateStart + (wiz.dateEnd ? " to " + wiz.dateEnd : "");
    document.getElementById("tournament-venue").value = wiz.venue;
    document.getElementById("player-details").value   = wiz.details;

    // Build payload and POST directly (mirrors host.js submit handler)
    const payload = {
      tournamentName:   wiz.name,
      sportName:        wiz.sport,
      tournamentDates:  wiz.dateStart + (wiz.dateEnd ? " to " + wiz.dateEnd : ""),
      accessCode:       code,
      playerDetails:    wiz.details,
      venue:            wiz.venue,
      categories:       categories,

      tournamentType:   wiz.tournamentType,
      stageFormat:      wiz.stageFormat,
      groupCount:       wiz.stageFormat === "group_knockout" ? Number(wiz.groupCount) : null,

      tournamentRules: {
        maxMatchesPerPlayer: wiz.tournamentRules.maxMatchesPerPlayer ? Number(wiz.tournamentRules.maxMatchesPerPlayer) : null,
        bestOfSets:          wiz.tournamentRules.bestOfSets ? Number(wiz.tournamentRules.bestOfSets) : null,
        pointsPerSet:        wiz.tournamentRules.pointsPerSet ? Number(wiz.tournamentRules.pointsPerSet) : null,
      },

      leaguePoints: shouldShowLeaguePoints() ? {
        win:  wiz.leaguePoints.win  !== "" ? Number(wiz.leaguePoints.win)  : null,
        loss: wiz.leaguePoints.loss !== "" ? Number(wiz.leaguePoints.loss) : null,
        draw: wiz.leaguePoints.draw !== "" ? Number(wiz.leaguePoints.draw) : null,
      } : null,

      courtCount:       wiz.courtCount,
      courtNames:       wiz.courtNames,
      requirePayment:   wiz.requirePayment,
      entryFee:         wiz.requirePayment ? Number(wiz.amount) : 0,
    };

    wizSubmitBtn.disabled = true;
    wizSubmitBtn.textContent = "Saving…";

    const isEditMode = !!editingTournamentId;

    const res = await fetch(
      isEditMode
        ? `/api/host/tournaments/${editingTournamentId}`
        : "/api/host/tournaments",
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
      alert(isEditMode ? "Failed to update tournament" : "Failed to save tournament");
      wizSubmitBtn.disabled = false;
      wizSubmitBtn.textContent = isEditMode ? "💾 Save changes" : "🚀 Create tournament";
      return;
    }

    showCreatedToast();

    // Reset wizard
    Object.assign(wiz, {
      name:"", sport:"", dateStart:"", dateEnd:"", venue:"", details:"",
      tournamentType:"single",
      eventCount:1,
      eventNames:[],
      eventConfigs:[],
      stageFormat:"",
      groupCount:"",
      tournamentRules: {
        maxMatchesPerPlayer: "",
        bestOfSets: "",
        pointsPerSet: ""
      },
      leaguePoints: {
        win: "",
        loss: "",
        draw: ""
      },
      courtCount:1,
      courtNames:[],
      requirePayment:false,
      amount:""
    });
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


    document.querySelectorAll(".wiz-type-card").forEach(c => c.classList.toggle("active", c.dataset.type === "single"));
    document.getElementById("wiz-event-count-wrap").classList.add("hidden");
    document.getElementById("wiz-event-names-wrap").classList.add("hidden");
    document.getElementById("w-payment-no").classList.add("active");
    document.getElementById("w-payment-yes").classList.remove("active");
    document.getElementById("wiz-amount-wrap").classList.add("hidden");
    document.getElementById("access-code").value = "";
    wizSubmitBtn.disabled = false;
    wizSubmitBtn.textContent = "🚀 Create tournament";
    
    editingTournamentId = null;
    showStep(0);
    loadMyTournaments();
    switchHostView("dashboard");
  });

  const user = await requireAuth();
  if (!user) return;

  document.querySelectorAll(".brand").forEach((el) => {
    el.addEventListener("click", () => {
      window.location.href = "index.html";
    });
  });

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

  // (category management handled by wizard — no legacy listeners needed)
  loadMyTournaments();
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




  



// ===== Topbar: avatar + dropdown signout + mode toggle =====
const trigger = document.getElementById("host-user-menu-trigger");
const dropdown = document.getElementById("host-user-menu-dropdown");

// Set avatar initial
if (trigger) {
  const label = (user?.name || user?.username || user?.email || "U").trim();
  trigger.textContent = label.charAt(0).toUpperCase();
}

// Dropdown open/close
trigger?.addEventListener("click", () => dropdown?.classList.toggle("is-open"));

// Dropdown: Sign out
const dropdownSignout = document.getElementById("dropdown-signout");
dropdownSignout?.addEventListener("click", () => {
  dropdown?.classList.remove("is-open");
  logout();
});

// Mode toggle: Host active on this page
const playerBtn = document.getElementById("mode-player-btn");
const hostBtn = document.getElementById("mode-host-btn");

hostBtn?.classList.add("is-active");
playerBtn?.classList.remove("is-active");

// Switch to Join mode (reuses your existing backend endpoint)
playerBtn?.addEventListener("click", async () => {
  playerBtn.classList.add("is-active");
  hostBtn?.classList.remove("is-active");

  await fetch("/api/user/mode", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + localStorage.getItem("token")
    },
    body: JSON.stringify({ mode: "player" })
  });

  window.location.href = "join.html";
});

// Clicking Host mode here just keeps the active look
hostBtn?.addEventListener("click", () => {
  hostBtn.classList.add("is-active");
  playerBtn?.classList.remove("is-active");
});

// -------- LOAD SPORTS FROM BACKEND --------
  async function loadSports() {
    try {
      const res = await fetch("/api/sports");
      if (!res.ok) throw new Error("Failed to load sports");

      const sports = await res.json();

      const sportSelect = document.getElementById("w-sport");
      if (!sportSelect) return;

      // Clear existing options except "Select sport"
      sportSelect.innerHTML = `<option value="">Select sport</option>`;

      sports.forEach((sport) => {
        const option = document.createElement("option");
        option.value = sport.sport_name;
        option.textContent = sport.sport_name;
        sportSelect.appendChild(option);
      });
    } catch (err) {
      console.error("Error loading sports:", err);
    }
  }

// Call it
  loadSports();

// -------- HOST MODE TOGGLE (My vs New) --------
  const modeCards = document.querySelectorAll(".host-mode-card");
  const myView = document.getElementById("my-tournaments-view");
  const newView = document.getElementById("new-tournament-view");

async function loadMyTournaments() {
  const token = localStorage.getItem("token");

  const res = await fetch("/api/host/tournaments", {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    console.error("Failed to load tournaments");
    return;
  }

  allTournaments = await res.json();

  populateSportFilter(allTournaments);
  renderDashboard(allTournaments);
renderMyTournaments(getFilteredAndSortedTournaments());}

function parseTournamentDateRange(dateStr = "") {
  if (!dateStr) return { start: null, end: null };

  if (dateStr.includes(" to ")) {
    const [startStr, endStr] = dateStr.split(" to ").map(s => s.trim());
    return {
      start: startStr ? new Date(startStr) : null,
      end: endStr ? new Date(endStr) : null
    };
  }

  const single = new Date(dateStr);
  return { start: single, end: single };
}

function isValidDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

function getUpcomingTournaments(tournaments) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return [...tournaments]
    .map(t => {
      const { start, end } = parseTournamentDateRange(t.tournamentDates || "");
      return { ...t, _startDate: start, _endDate: end };
    })
    .filter(t => isValidDate(t._endDate || t._startDate) && (t._endDate || t._startDate) >= today)
    .sort((a, b) => (a._startDate || a._endDate) - (b._startDate || b._endDate));
}

function formatDateShort(dateStr) {
  const date = new Date(dateStr);
  if (!isValidDate(date)) return dateStr || "-";

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
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

function renderUpcomingRow(tournaments) {
  const container = document.getElementById("dashboard-upcoming-row");
  if (!container) return;

  const upcoming = getUpcomingTournaments(tournaments).slice(0, 10);

  if (!upcoming.length) {
    container.innerHTML = `<div class="dashboard-empty-card">No upcoming tournaments yet.</div>`;
    return;
  }

  container.innerHTML = upcoming.map(t => `
    <div class="upcoming-tournament-card" data-id="${t.tournamentId}">
      <h3>${t.tournamentName || "Untitled tournament"}</h3>
      <p class="upcoming-meta">${t.sportName || "-"}</p>
      <p class="upcoming-meta">${formatTournamentDates(t.tournamentDates)}</p>
    </div>
  `).join("");

  container.querySelectorAll(".upcoming-tournament-card").forEach(card => {
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

function getTournamentsForDate(tournaments, dateObj) {
  return tournaments.filter(t => {
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
    year: "numeric"
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
        ${visible.map(t => `<div class="calendar-marker" title="${t.tournamentName}">${t.tournamentName}</div>`).join("")}
        ${extraCount > 0 ? `<div class="calendar-more">+${extraCount} more</div>` : ""}
      </div>
    `;
  }

  grid.innerHTML = html;
}

function renderDashboard(tournaments) {
  renderUpcomingRow(tournaments);
  renderStats(tournaments);
  renderCalendar(tournaments);
}

function getFilteredAndSortedTournaments() {
  let list = [...allTournaments];

  if (currentSportFilter) {
    list = list.filter(t => t.sportName === currentSportFilter);
  }

  const withDates = list.map(t => {
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

  const sports = [...new Set(tournaments.map(t => t.sportName).filter(Boolean))];

  filter.innerHTML = `<option value="">All sports</option>`;
  sports.forEach(sport => {
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

function syncCourtCount() {
  document.getElementById("w-court-count-display").textContent = wiz.courtCount;
  while (wiz.courtNames.length < wiz.courtCount) wiz.courtNames.push("");
  wiz.courtNames = wiz.courtNames.slice(0, wiz.courtCount);
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

  const isTeam = wiz.tournamentType === "team";
  document.getElementById("wiz-event-count-wrap")?.classList.toggle("hidden", !isTeam);
  document.getElementById("wiz-event-names-wrap")?.classList.toggle("hidden", !isTeam);
  document.getElementById("w-event-count-display").textContent = String(wiz.eventCount || 1);

  if (isTeam) {
    renderEventNameFields();
  }

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

  document.getElementById("w-points-win").value = wiz.leaguePoints.win || "";
  document.getElementById("w-points-loss").value = wiz.leaguePoints.loss || "";
  document.getElementById("w-points-draw").value = wiz.leaguePoints.draw || "";

  toggleLeaguePointsSection();

  syncCourtCount();
  document.getElementById("w-court-count-display").textContent = String(wiz.courtCount || 1);
  renderCourtNameFields();

  document.getElementById("w-payment-yes")?.classList.toggle("active", !!wiz.requirePayment);
  document.getElementById("w-payment-no")?.classList.toggle("active", !wiz.requirePayment);
  document.getElementById("wiz-amount-wrap")?.classList.toggle("hidden", !wiz.requirePayment);
  document.getElementById("w-amount").value = wiz.amount || "";

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

function openTournamentForEdit(t) {
  viewOnlyMode = false;
  editingTournamentId = t.tournamentId;

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

  const categories = Array.isArray(t.categories) ? t.categories : [];

  if (wiz.tournamentType === "team") {
    const eventNames = categories.map(c => c.eventName || "").filter(Boolean);
    wiz.eventNames = eventNames.length ? eventNames : [""];
    wiz.eventCount = wiz.eventNames.length;
  } else {
    wiz.eventNames = [];
    wiz.eventCount = 1;
  }

  wiz.eventConfigs = categories.length
    ? categories.map(c => ({
        categoryId: c.categoryId || "",
        gender: c.gender || "",
        ageGroup: c.ageGroup || "",
        playingLevel: c.playingLevel || "",
        teamSize: String(c.teamSize || "1"),
        eventName: c.eventName || "",
      }))
    : [{ categoryId: "", gender: "", ageGroup: "", playingLevel: "", teamSize: "1", eventName: "" }];

  document.getElementById("access-code").value = t.accessCode || "";
  hydrateWizardFormFromState();
  switchHostView("new");
  showStep(0);
  setWizardModeUI();
}


function renderMyTournaments(tournaments) {
  const container = document.getElementById("my-tournaments-list");
  container.innerHTML = "";

  if (!tournaments.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="feature-icon">📋</div>
        <h3>No tournaments found</h3>
      </div>`;
    return;
  }

  tournaments.forEach(t => {
    const categories = (t.categories || [])
      .map(c => {
        const size = Number(c.teamSize);

        let type = "";
        if (size === 1) type = "Singles";
        else if (size === 2) type = "Doubles";

        const genderLabel =
          c.gender === "Male" ? "Men's" :
          c.gender === "Female" ? "Women's" :
          c.gender;

        return `${c.ageGroup} ${genderLabel}${type ? " " + type : ""}`;
      })
      .join(", ");

    const card = document.createElement("div");
    card.className = "tournament-card";

    card.innerHTML = `
      <div class="tournament-head">
        <h3>${t.tournamentName}</h3>
        <span class="code-chip">${t.accessCode}</span>
      </div>

      <p class="muted sport-date">${t.sportName} • ${t.tournamentDates}</p>
      <p class="muted">📍 ${t.venue}</p>

      ${categories ? `<p class="muted"><strong>Categories:</strong> ${categories}</p>` : ""}

      ${(() => {
        const details =
          typeof t.playerDetails === "string"
            ? t.playerDetails
            : Array.isArray(t.playerDetails)
              ? t.playerDetails.join(", ")
              : (t.playerDetails ?? "");

        const detailsStr = String(details);

        return detailsStr.trim() !== ""
          ? `
            <p class="muted details-label">Details:</p>
            <p class="muted details-text">${detailsStr}</p>
          `
          : "";
      })()}

      <div class="tournament-meta">
        <span>Status: <strong>${t.registrationsOpen ? "Open" : "Closed"}</strong></span>
      </div>

      <div class="tournament-meta tournament-actions">
        <button type="button" class="view-btn" data-id="${t.tournamentId}">View</button>
        <button type="button" class="edit-btn" data-id="${t.tournamentId}">Edit</button>
        <button type="button" class="delete-btn" data-id="${t.tournamentId}">Delete</button>
      </div>
    `;

    card.addEventListener("click", () => {
      window.location.href = `players.html?tournamentId=${t.tournamentId}`;
    });

    const viewBtn = card.querySelector(".view-btn");
    const editBtn = card.querySelector(".edit-btn");
    const deleteBtn = card.querySelector(".delete-btn");

    viewBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      openTournamentForView(t);
    });

    editBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      openTournamentForEdit(t);
    });

    deleteBtn?.addEventListener("click", async (e) => {
      e.stopPropagation();
      const ok = confirm("Delete this tournament? This cannot be undone.");
      if (!ok) return;

      const res = await fetch(`/api/host/tournaments/${t.tournamentId}`, {
        method: "DELETE",
        headers: {
          Authorization: "Bearer " + localStorage.getItem("token")
        }
      });

      if (!res.ok) {
        alert("Failed to delete tournament");
        return;
      }

      loadMyTournaments();
    });

    container.appendChild(card);
  });
}

const dashboardView = document.getElementById("dashboard-view");

if (dashboardView && myView && newView) {
  modeCards.forEach((card) => {
    card.addEventListener("click", () => {
      switchHostView(card.dataset.hostMode);
    });
  });
}

  // (form submit handled by wizard submit button above)

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

