// scripts/host.js
import { requireAuth, logout } from "./auth.js";

let allTournaments = [];

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

  // ─── Legacy stubs so host.js doesn't crash on refs that no longer exist ───
  const categoriesContainer = document.getElementById("categories-container");
  const addCategoryBtn      = document.getElementById("add-category-btn"); // null in new UI
  let categories = [];

  // ══════════════════════════════════════════════════════════════════════
  //  MULTI-STEP WIZARD
  // ══════════════════════════════════════════════════════════════════════

  const TOTAL_STEPS = 6;
  let currentStep   = 0;

  // Wizard data model
  const wiz = {
    name:        "",
    sport:       "",
    dateStart:   "",
    dateEnd:     "",
    venue:       "",
    details:     "",
    tournamentType: "single",  // "single" | "team"
    eventCount:  1,
    eventNames:  [],           // ["Men's Singles", "Women's Doubles", …]
    eventConfigs:[],           // [{ gender, ageGroup, playingLevel, teamSize }, …]
    courtCount:  1,
    courtNames:  [],
    requirePayment: false,
    amount:      "",
  };

  // ── DOM refs ──────────────────────────────────────────────────────────
  const wizStepsEl   = document.getElementById("wiz-steps");
  const wizBackBtn   = document.getElementById("wiz-back-btn");
  const wizNextBtn   = document.getElementById("wiz-next-btn");
  const wizSubmitBtn = document.getElementById("wiz-submit-btn");
  const wizDots      = document.querySelectorAll(".wiz-step-dot");
  const wizLines     = document.querySelectorAll(".wiz-progress-line");

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

  // ── Show/hide step panels ─────────────────────────────────────────────
  function showStep(n) {
    document.querySelectorAll(".wiz-step").forEach((el, i) => {
      el.classList.toggle("active", i === n);
    });
    currentStep = n;
    updateProgress();
    if (n === TOTAL_STEPS - 1) buildReview();
  }

  // ── Step validation ───────────────────────────────────────────────────
  function validateStep(n) {
    if (n === 0) {
      if (!document.getElementById("w-name").value.trim())       { alert("Please enter the tournament name.");    return false; }
      if (!document.getElementById("w-sport").value)             { alert("Please select a sport.");               return false; }
      if (!document.getElementById("w-date-start").value)        { alert("Please set a start date.");             return false; }
      if (!document.getElementById("w-date-end").value)          { alert("Please set an end date.");              return false; }
      if (!document.getElementById("w-venue").value.trim())      { alert("Please enter a venue.");                return false; }
    }
    if (n === 1) {
      if (wiz.tournamentType === "team") {
        const anyEmpty = wiz.eventNames.some(n => !n.trim());
        if (anyEmpty) { alert("Please name all events."); return false; }
      }
    }
    if (n === 4) {
      if (wiz.requirePayment && !document.getElementById("w-amount").value) {
        alert("Please enter the entry fee amount."); return false;
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
      // eventNames already kept in sync by input listeners
    }
    if (n === 2) {
      // eventConfigs synced by select listeners
    }
    if (n === 3) {
      // courtNames synced by input listeners
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
      if (isTeam) renderEventNameFields();
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
        <div class="wiz-review-section-title">Events (${events.length})</div>
        ${evRows}
      </div>
      <div class="wiz-review-section">
        <div class="wiz-review-row"><span class="wiz-review-key">Courts</span><span class="wiz-review-val">${courtList}</span></div>
        <div class="wiz-review-row"><span class="wiz-review-key">Payment</span><span class="wiz-review-val">${wiz.requirePayment ? "₹" + wiz.amount : "Free entry"}</span></div>
      </div>`;
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
  wizSubmitBtn?.addEventListener("click", async () => {
    const code = document.getElementById("access-code").value;
    if (!code) { alert("Please generate an access code first."); return; }

    // Build categories array from event configs (matches existing backend schema)
    categories = wiz.eventConfigs.map((cfg, i) => ({
      categoryId: "CAT-" + Math.random().toString(36).slice(2,8).toUpperCase(),
      ageGroup:   cfg.ageGroup   || "",
      gender:     cfg.gender     || "",
      teamSize:   cfg.teamSize   || "1",
      playingLevel: cfg.playingLevel || "",
      eventName:  wiz.tournamentType === "single" ? "" : (wiz.eventNames[i] || ""),
    }));

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
      courtCount:       wiz.courtCount,
      courtNames:       wiz.courtNames,
      requirePayment:   wiz.requirePayment,
      entryFee:         wiz.requirePayment ? Number(wiz.amount) : 0,
    };

    wizSubmitBtn.disabled = true;
    wizSubmitBtn.textContent = "Saving…";

    const res = await fetch("/api/host/tournaments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      alert("Failed to save tournament");
      wizSubmitBtn.disabled = false;
      wizSubmitBtn.textContent = "🚀 Create tournament";
      return;
    }

    showCreatedToast();

    // Reset wizard
    Object.assign(wiz, { name:"", sport:"", dateStart:"", dateEnd:"", venue:"", details:"",
      tournamentType:"single", eventCount:1, eventNames:[], eventConfigs:[],
      courtCount:1, courtNames:[], requirePayment:false, amount:"" });
    document.querySelectorAll(".wiz-type-card").forEach(c => c.classList.toggle("active", c.dataset.type === "single"));
    document.getElementById("wiz-event-count-wrap").classList.add("hidden");
    document.getElementById("wiz-event-names-wrap").classList.add("hidden");
    document.getElementById("w-payment-no").classList.add("active");
    document.getElementById("w-payment-yes").classList.remove("active");
    document.getElementById("wiz-amount-wrap").classList.add("hidden");
    document.getElementById("access-code").value = "";
    wizSubmitBtn.disabled = false;
    wizSubmitBtn.textContent = "🚀 Create tournament";
    showStep(0);

    loadMyTournaments();
  });

  const user = await requireAuth();
  if (!user) return;

  document.querySelectorAll(".brand").forEach((el) => {
    el.addEventListener("click", () => {
      window.location.href = "index.html";
    });
  });

  function showCreatedToast() {
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
        Tournament created successfully
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

      const sportSelect = document.getElementById("sport-name");
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
  renderMyTournaments(allTournaments);

}

function populateSportFilter(tournaments) {
  const filter = document.getElementById("filter-sport");
  if (!filter) return;

  const sports = [...new Set(tournaments.map(t => t.sportName))];

  filter.innerHTML = `<option value="">All sports</option>`;
  sports.forEach(sport => {
    const opt = document.createElement("option");
    opt.value = sport;
    opt.textContent = sport;
    filter.appendChild(opt);
  });

  filter.addEventListener("change", () => {
    const selected = filter.value;
    const filtered = selected
      ? allTournaments.filter(t => t.sportName === selected)
      : allTournaments;

    renderMyTournaments(filtered);
  });
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
      <div class="tournament-meta">
        <button type="button" class="delete-btn" data-id="${t.tournamentId}">Delete tournament</button>
      </div>
    `;

    card.addEventListener("click", () => {
      window.location.href = `players.html?tournamentId=${t.tournamentId}`;
    });

    const deleteBtn = card.querySelector(".delete-btn");
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



  if (myView && newView) {
    modeCards.forEach((card) => {
      card.addEventListener("click", () => {
        // Remove active from all cards
        modeCards.forEach((c) => c.classList.remove("active"));

        // Hide all views
        myView.classList.remove("host-view--active");
        newView.classList.remove("host-view--active");

        // Activate clicked card
        card.classList.add("active");

        // Show correct view
        if (card.dataset.hostMode === "my") {
          myView.classList.add("host-view--active");
        } else {
          newView.classList.add("host-view--active");
        }
      });
    });
  }

  // (form submit handled by wizard submit button above)
});