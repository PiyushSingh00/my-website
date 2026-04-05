import { requireAuth, logout } from "./auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;

  // ---------------------------------------------------------------------------
  // TOPBAR
  // ---------------------------------------------------------------------------
  document.querySelectorAll(".brand").forEach((el) => {
    el.style.cursor = "pointer";
    el.addEventListener("click", () => (window.location.href = "index.html"));
  });

  const trigger = document.getElementById("score-user-menu-trigger");
  const dropdown = document.getElementById("score-user-menu-dropdown");

  if (trigger) {
    const label = String(user?.name || user?.username || user?.email || "U").trim();
    trigger.textContent = (label[0] || "U").toUpperCase();
  }

  trigger?.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown?.classList.toggle("is-open");
  });

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

  const playerBtn = document.getElementById("mode-player-btn");
  const hostBtn = document.getElementById("mode-host-btn");

  hostBtn?.classList.add("is-active");
  playerBtn?.classList.remove("is-active");

  playerBtn?.addEventListener("click", async () => {
    try {
      await fetch("/api/user/mode", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + (localStorage.getItem("token") || ""),
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
          Authorization: "Bearer " + (localStorage.getItem("token") || ""),
        },
        body: JSON.stringify({ mode: "host" }),
      });
    } catch {}
  });

  // ---------------------------------------------------------------------------
  // DOM REFS
  // ---------------------------------------------------------------------------
  const titleEl = document.getElementById("score-title");
  const subEl = document.getElementById("score-sub");
  const backBtn = document.getElementById("back-to-fixtures");
  const saveBtn = document.getElementById("save-score");
  const configWrap = document.getElementById("config-fields");
  const statusPill = document.getElementById("status-pill");
  const winnerPill = document.getElementById("winner-pill");
  const reasonPill = document.getElementById("reason-pill");
  const saveMsg = document.getElementById("save-msg");

  const homeNameEl = document.getElementById("home-name");
  const awayNameEl = document.getElementById("away-name");
  const homeScoreEl = document.getElementById("home-score");
  const awayScoreEl = document.getElementById("away-score");
  const rosterArea = document.getElementById("roster-area");

  const overlay = document.getElementById("stat-overlay");
  const drawer = document.getElementById("stat-drawer");
  const drawerNameEl = document.getElementById("drawer-player-name");
  const drawerTeamEl = document.getElementById("drawer-team-name");
  const drawerFields = document.getElementById("drawer-fields");
  const drawerClose = document.getElementById("drawer-close");

  const settingsPanel = document.getElementById("settings-panel");
  const toggleSettings = document.getElementById("toggle-settings");

  const timerDisplay = document.getElementById("timer-display");
  const timerStartBtn = document.getElementById("timer-start");
  const timerPauseBtn = document.getElementById("timer-pause");
  const timerResetBtn = document.getElementById("timer-reset");

  const teamHomeBtn = document.getElementById("team-home");
  const teamAwayBtn = document.getElementById("team-away");

  const individualScoreShell = document.getElementById("individual-score-shell");
  const teamEventShell = document.getElementById("team-event-shell");
  const receiveLineupBtn = document.getElementById("receive-lineup-btn");
  const manualLineupBtn = document.getElementById("manual-lineup-btn");
  const lineupStatePill = document.getElementById("lineup-state-pill");
  const lineupReviewPanel = document.getElementById("lineup-review-panel");
  const lineupReviewList = document.getElementById("lineup-review-list");
  const teamCategoryBars = document.getElementById("team-category-bars");
  const teamCategoryHelp = document.getElementById("team-category-help");
  const teamOverallHomeName = document.getElementById("team-overall-home-name");
  const teamOverallAwayName = document.getElementById("team-overall-away-name");
  const teamOverallHomeScore = document.getElementById("team-overall-home-score");
  const teamOverallAwayScore = document.getElementById("team-overall-away-score");
  const teamOverallSub = document.getElementById("team-overall-sub");

  // ---------------------------------------------------------------------------
  // URL PARAMS
  // ---------------------------------------------------------------------------
  const params = new URLSearchParams(window.location.search);
  const tournamentId = params.get("tournamentId");
  const categoryId = params.get("categoryId");
  const roundIndex = Number(params.get("round"));
  const matchIndex = Number(params.get("match"));
  const scoreIndex = Number(params.get("scoreIndex") ?? 0);

  if (!tournamentId || Number.isNaN(roundIndex) || Number.isNaN(matchIndex)) {
    titleEl.textContent = "Missing required URL params";
    subEl.textContent = "Expected: ?tournamentId=...&round=0&match=0";
    return;
  }

  backBtn?.addEventListener("click", () => {
    window.location.href = `players.html?tournamentId=${encodeURIComponent(tournamentId)}`;
  });

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------
  function getToken() {
    return localStorage.getItem("token") || localStorage.getItem("authToken") || "";
  }

  async function apiGet(url) {
    const res = await fetch(url, {
      headers: { Authorization: "Bearer " + getToken() },
    });

    const raw = await res.text();
    let data = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = { _nonJson: true, raw };
    }

    if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}${data?._nonJson ? " (non-JSON)" : ""}`);
    return data;
  }

  async function apiPut(url, body) {
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + getToken(),
      },
      body: JSON.stringify(body || {}),
    });

    const raw = await res.text();
    let data = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = { _nonJson: true, raw };
    }

    if (!res.ok) throw new Error(`PUT ${url} failed: ${res.status}${data?._nonJson ? " (non-JSON)" : ""}`);
    return data;
  }

  function clear(el) {
    if (el) el.innerHTML = "";
  }

  function splitTeamLabel(label) {
    return label ? String(label).split("+").map((s) => s.trim()).filter(Boolean) : [];
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function safeText(value, fallback = "") {
    const str = String(value ?? "").trim();
    return str || fallback;
  }

  function toArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function getMatchCategoryMap(rawFixtures) {
    return rawFixtures?.categories || rawFixtures?.fixtureCategories || rawFixtures?.data?.categories || {};
  }

  function findFirstMatch(rawFixtures, explicitCategoryId, rIndex, mIndex) {
    const categoriesMap = getMatchCategoryMap(rawFixtures);

    if (explicitCategoryId && categoriesMap?.[explicitCategoryId]?.rounds?.[rIndex]?.[mIndex]) {
      return {
        categoryId: explicitCategoryId,
        match: categoriesMap[explicitCategoryId].rounds[rIndex][mIndex],
      };
    }

    const categoryEntries = Object.entries(categoriesMap || {});
    for (const [cid, category] of categoryEntries) {
      const candidate = category?.rounds?.[rIndex]?.[mIndex];
      if (candidate) {
        return { categoryId: cid, match: candidate };
      }
    }

    return { categoryId: explicitCategoryId || null, match: null };
  }

  function detectTeamEvent(rawFixtures) {
    const rawType = String(
      rawFixtures?.tournamentType ||
        rawFixtures?.meta?.tournamentType ||
        rawFixtures?.tournament?.tournamentType ||
        rawFixtures?.tournament?.eventType ||
        params.get("tournamentType") ||
        params.get("eventType") ||
        "individual"
    ).toLowerCase();

    return rawType.includes("team");
  }

  function getTeamStorageKey() {
    return `score_team_tie_state::${tournamentId}::${roundIndex}::${matchIndex}`;
  }

  function inferCategoryDefinitions(rawFixtures) {
    const sources = [
      rawFixtures?.teamCategories,
      rawFixtures?.meta?.teamCategories,
      rawFixtures?.tournament?.categories,
      rawFixtures?.meta?.categories,
      rawFixtures?.categoriesMeta,
    ];

    const raw = sources.find((list) => Array.isArray(list) && list.length) || [];

    const extracted = raw.map((item, index) => ({
      id: safeText(item?.id || item?.categoryId || item?.key, `cat-${index + 1}`),
      name: safeText(
        item?.name || item?.categoryName || item?.label || item?.title,
        `Category ${index + 1}`
      ),
    }));

    if (extracted.length) return extracted;

    const fallbackCount = Math.max(1, Number(params.get("categoryCount") || 3));
    return Array.from({ length: fallbackCount }, (_, index) => ({
      id: `cat-${index + 1}`,
      name: `Category ${index + 1}`,
    }));
  }

  function inferTeamRoster(matchObj, side) {
    const rosterFromMatch = side === "A" ? matchObj?.homePlayers : matchObj?.awayPlayers;
    const fromMatchList = toArray(rosterFromMatch).map((p) => safeText(p)).filter(Boolean);
    if (fromMatchList.length) return fromMatchList;

    const label = side === "A" ? matchObj?.home : matchObj?.away;
    const split = splitTeamLabel(label);
    if (split.length) return split;

    return Array.from({ length: 8 }, (_, index) => `${side === "A" ? "Home" : "Away"} Player ${index + 1}`);
  }

  function buildInitialTeamState(matchObj, rawFixtures) {
    const categories = inferCategoryDefinitions(rawFixtures);
    const homeRoster = inferTeamRoster(matchObj, "A");
    const awayRoster = inferTeamRoster(matchObj, "B");

    return {
      homeRoster,
      awayRoster,
      categories: categories.map((category, index) => ({
        id: category.id,
        name: category.name,
        homePlayer: homeRoster[index] || "",
        awayPlayer: awayRoster[index] || "",
        lineupStatus: "pending",
        notes: "",
        homeScore: 0,
        awayScore: 0,
        winnerSide: null,
        isScoringOpen: false,
      })),
    };
  }

  function loadTeamTieState(matchObj, rawFixtures) {
    const key = getTeamStorageKey();
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      if (saved && Array.isArray(saved.categories)) {
        return saved;
      }
    } catch {}

    return buildInitialTeamState(matchObj, rawFixtures);
  }

  function saveTeamTieState(teamState) {
    localStorage.setItem(getTeamStorageKey(), JSON.stringify(teamState));
  }

  function computeTeamTieSummary(teamState) {
    const homeWins = teamState.categories.filter((c) => c.winnerSide === "A").length;
    const awayWins = teamState.categories.filter((c) => c.winnerSide === "B").length;
    const acceptedCount = teamState.categories.filter((c) => c.lineupStatus === "accepted").length;
    const rejectedCount = teamState.categories.filter((c) => c.lineupStatus === "rejected").length;
    const allAccepted = teamState.categories.length > 0 && acceptedCount === teamState.categories.length;

    return {
      homeWins,
      awayWins,
      acceptedCount,
      rejectedCount,
      total: teamState.categories.length,
      allAccepted,
    };
  }

  function getStatusChipClass(status) {
    if (status === "accepted") return "status-chip accepted";
    if (status === "rejected") return "status-chip rejected";
    return "status-chip pending";
  }

  function showTeamEventShell() {
    individualScoreShell?.classList.add("hidden");
    teamEventShell?.classList.remove("hidden");
    saveBtn?.classList.add("hidden");
    overlay?.classList.remove("show");
    drawer?.classList.remove("open");
  }

  function showIndividualEventShell() {
    teamEventShell?.classList.add("hidden");
    individualScoreShell?.classList.remove("hidden");
    saveBtn?.classList.remove("hidden");
  }

  // ---------------------------------------------------------------------------
  // LOAD FIXTURES (+ SCHEMA OPTIONAL FOR TEAM EVENT)
  // ---------------------------------------------------------------------------
  let fixtures = null;
  let schema = null;

  try {
    const fixturesResp = await apiGet(`/api/host/tournaments/${encodeURIComponent(tournamentId)}/fixtures`);
    fixtures = fixturesResp?.ok ? fixturesResp.data : fixturesResp;
  } catch (e) {
    console.error(e);
    titleEl.textContent = "Failed to load fixtures";
    subEl.textContent = String(e?.message || e);
    return;
  }

  try {
    if (categoryId) {
      const schemaResp = await apiGet(
        `/api/host/tournaments/${encodeURIComponent(tournamentId)}/scoring-schema/active?categoryId=${encodeURIComponent(categoryId)}`
      );
      schema = schemaResp?.ok ? schemaResp.data : schemaResp;
    }
  } catch (e) {
    console.warn("Scoring schema not loaded yet.", e);
    schema = null;
  }

  const { categoryId: resolvedCategoryId, match } = findFirstMatch(fixtures, categoryId, roundIndex, matchIndex);
  const homeLabel = match?.home ?? "Home";
  const awayLabel = match?.away ?? "Away";
  const isTeamEvent = detectTeamEvent(fixtures);

  if (!match) {
    titleEl.textContent = "Match not found";
    subEl.textContent = "Invalid round / match or category data missing.";
    saveBtn.disabled = true;
    return;
  }

  if (String(homeLabel).toUpperCase() === "BYE" || String(awayLabel).toUpperCase() === "BYE") {
    titleEl.textContent = `${homeLabel} vs ${awayLabel}`;
    subEl.textContent = `Round ${roundIndex + 1} • Match ${matchIndex + 1}`;
    if (isTeamEvent) showTeamEventShell();
    statusPill?.classList.add("error");
    if (statusPill) statusPill.innerHTML = `Status: <strong>BYE</strong>`;
    if (winnerPill) winnerPill.innerHTML = `Winner: <strong>-</strong>`;
    if (reasonPill) reasonPill.innerHTML = `Reason: <strong>BYE match — no scoring needed.</strong>`;
    saveBtn.disabled = true;
    return;
  }

  // ---------------------------------------------------------------------------
  // TEAM EVENT FRONTEND-ONLY FLOW
  // ---------------------------------------------------------------------------
  if (isTeamEvent) {
    showTeamEventShell();

    titleEl.textContent = `${homeLabel} vs ${awayLabel}`;
    subEl.textContent = `Team event • Round ${roundIndex + 1} • Match ${matchIndex + 1}`;

    if (teamOverallHomeName) teamOverallHomeName.textContent = homeLabel;
    if (teamOverallAwayName) teamOverallAwayName.textContent = awayLabel;
    if (teamOverallSub) {
      teamOverallSub.textContent = "Each category is one sub-match. Overall score = number of categories won.";
    }

    const teamTieState = loadTeamTieState(match, fixtures);

    function syncTeamSummaryUi() {
      const summary = computeTeamTieSummary(teamTieState);
      if (teamOverallHomeScore) teamOverallHomeScore.textContent = String(summary.homeWins);
      if (teamOverallAwayScore) teamOverallAwayScore.textContent = String(summary.awayWins);

      if (!lineupStatePill) return;

      lineupStatePill.className = getStatusChipClass(summary.allAccepted ? "accepted" : "pending");
      if (summary.allAccepted) {
        lineupStatePill.textContent = `All ${summary.total} category lineups accepted`;
      } else {
        lineupStatePill.textContent = `${summary.acceptedCount}/${summary.total} category lineups accepted`;
      }

      if (teamCategoryHelp) {
        teamCategoryHelp.textContent = summary.allAccepted
          ? "All category bars are unlocked. Use Start scoring to open each one."
          : "Category bars unlock only after every category lineup is accepted.";
      }
    }

    function renderLineupReview() {
      if (!lineupReviewList) return;
      clear(lineupReviewList);

      teamTieState.categories.forEach((category) => {
        const row = document.createElement("div");
        row.className = "lineup-row";

        const statusClass = getStatusChipClass(category.lineupStatus);

        row.innerHTML = `
          <div class="lineup-row-head">
            <div>
              <div class="lineup-row-title">${escapeHtml(category.name)}</div>
              <div class="helper-text">Review submitted lineup for this category</div>
            </div>
            <div class="${statusClass}">${escapeHtml(category.lineupStatus)}</div>
          </div>
          <div class="lineup-row-body">
            <div class="lineup-entry-grid">
              <div class="field-stack">
                <label>${escapeHtml(homeLabel)} player</label>
                <input type="text" data-role="homePlayer" value="${escapeHtml(category.homePlayer)}" placeholder="Enter player name" />
              </div>
              <div class="lineup-vs">VS</div>
              <div class="field-stack">
                <label>${escapeHtml(awayLabel)} player</label>
                <input type="text" data-role="awayPlayer" value="${escapeHtml(category.awayPlayer)}" placeholder="Enter player name" />
              </div>
            </div>

            <div class="score-notes" style="margin-top: 12px;">
              <label>Host notes</label>
              <textarea data-role="notes" placeholder="Optional notes for accept / reject / edit">${escapeHtml(category.notes)}</textarea>
            </div>

            <div class="lineup-actions" style="margin-top: 12px;">
              <button type="button" class="lineup-action-btn primary" data-action="accept">Accept</button>
              <button type="button" class="lineup-action-btn" data-action="reject">Reject</button>
              <button type="button" class="lineup-action-btn" data-action="edit">Edit</button>
            </div>
          </div>
        `;

        const homeInput = row.querySelector('[data-role="homePlayer"]');
        const awayInput = row.querySelector('[data-role="awayPlayer"]');
        const notesInput = row.querySelector('[data-role="notes"]');

        function syncCategoryDraftFromInputs() {
          category.homePlayer = safeText(homeInput?.value);
          category.awayPlayer = safeText(awayInput?.value);
          category.notes = safeText(notesInput?.value);
          saveTeamTieState(teamTieState);
          renderTeamCategoryBars();
          syncTeamSummaryUi();
        }

        homeInput?.addEventListener("input", syncCategoryDraftFromInputs);
        awayInput?.addEventListener("input", syncCategoryDraftFromInputs);
        notesInput?.addEventListener("input", syncCategoryDraftFromInputs);

        row.querySelector('[data-action="accept"]')?.addEventListener("click", () => {
          syncCategoryDraftFromInputs();
          if (!category.homePlayer || !category.awayPlayer) {
            alert("Please fill both players before accepting the lineup.");
            return;
          }
          category.lineupStatus = "accepted";
          saveTeamTieState(teamTieState);
          renderLineupReview();
          renderTeamCategoryBars();
          syncTeamSummaryUi();
        });

        row.querySelector('[data-action="reject"]')?.addEventListener("click", () => {
          syncCategoryDraftFromInputs();
          category.lineupStatus = "rejected";
          category.isScoringOpen = false;
          category.winnerSide = null;
          saveTeamTieState(teamTieState);
          renderLineupReview();
          renderTeamCategoryBars();
          syncTeamSummaryUi();
        });

        row.querySelector('[data-action="edit"]')?.addEventListener("click", () => {
          category.lineupStatus = "pending";
          saveTeamTieState(teamTieState);
          renderLineupReview();
          renderTeamCategoryBars();
          syncTeamSummaryUi();
        });

        lineupReviewList.appendChild(row);
      });
    }

    function renderTeamCategoryBars() {
      if (!teamCategoryBars) return;
      clear(teamCategoryBars);

      const summary = computeTeamTieSummary(teamTieState);
      if (!summary.allAccepted) {
        const waitingCard = document.createElement("div");
        waitingCard.className = "category-card";
        waitingCard.innerHTML = `
          <div class="category-card-head">
            <div>
              <div class="category-title">Waiting for lineup approvals</div>
              <div class="helper-text">Accept all category lineups first. Then the Start scoring button will appear here for each category.</div>
            </div>
          </div>
        `;
        teamCategoryBars.appendChild(waitingCard);
        return;
      }

      teamTieState.categories.forEach((category) => {
        const card = document.createElement("div");
        card.className = `category-card${category.isScoringOpen ? " open" : ""}`;

        const winnerText =
          category.winnerSide === "A"
            ? `${homeLabel} won`
            : category.winnerSide === "B"
              ? `${awayLabel} won`
              : "Result pending";

        const resultClass = category.winnerSide ? "category-result-chip completed" : "category-result-chip pending";

        card.innerHTML = `
          <div class="category-card-head">
            <div class="category-meta">
              <div class="category-title">${escapeHtml(category.name)}</div>
              <div class="category-matchup">${escapeHtml(category.homePlayer || "TBD")} vs ${escapeHtml(category.awayPlayer || "TBD")}</div>
            </div>
            <div class="category-actions">
              <div class="status-chip ${resultClass}">${escapeHtml(winnerText)}</div>
              <button type="button" class="lineup-action-btn primary" data-action="toggle-scoring">
                ${category.isScoringOpen ? "Hide scoring" : "Start scoring"}
              </button>
            </div>
          </div>
          <div class="category-card-body">
            <div class="category-scoring-grid">
              <div class="score-mini-card">
                <div class="score-mini-team">${escapeHtml(homeLabel)}</div>
                <div class="helper-text">${escapeHtml(category.homePlayer || "No lineup selected")}</div>
                <div class="score-stepper">
                  <button type="button" class="score-stepper-btn" data-action="home-minus">−</button>
                  <div class="score-stepper-value">${escapeHtml(category.homeScore)}</div>
                  <button type="button" class="score-stepper-btn" data-action="home-plus">+</button>
                </div>
              </div>

              <div class="score-mini-card">
                <div class="score-mini-team">${escapeHtml(awayLabel)}</div>
                <div class="helper-text">${escapeHtml(category.awayPlayer || "No lineup selected")}</div>
                <div class="score-stepper">
                  <button type="button" class="score-stepper-btn" data-action="away-minus">−</button>
                  <div class="score-stepper-value">${escapeHtml(category.awayScore)}</div>
                  <button type="button" class="score-stepper-btn" data-action="away-plus">+</button>
                </div>
              </div>
            </div>

            <div class="category-winner-actions">
              <button type="button" class="category-winner-btn primary" data-action="home-winner">Mark ${escapeHtml(homeLabel)} winner</button>
              <button type="button" class="category-winner-btn primary" data-action="away-winner">Mark ${escapeHtml(awayLabel)} winner</button>
              <button type="button" class="category-winner-btn" data-action="clear-winner">Clear result</button>
            </div>

            <div class="score-notes" style="margin-top: 14px;">
              <label>Category scoring notes</label>
              <textarea data-action="score-notes" placeholder="Optional notes for this category">${escapeHtml(category.notes)}</textarea>
            </div>
          </div>
        `;

        const rerender = () => {
          saveTeamTieState(teamTieState);
          renderTeamCategoryBars();
          syncTeamSummaryUi();
        };

        card.querySelector('[data-action="toggle-scoring"]')?.addEventListener("click", () => {
          category.isScoringOpen = !category.isScoringOpen;
          rerender();
        });

        card.querySelector('[data-action="home-minus"]')?.addEventListener("click", () => {
          category.homeScore = Math.max(0, Number(category.homeScore || 0) - 1);
          rerender();
        });

        card.querySelector('[data-action="home-plus"]')?.addEventListener("click", () => {
          category.homeScore = Number(category.homeScore || 0) + 1;
          rerender();
        });

        card.querySelector('[data-action="away-minus"]')?.addEventListener("click", () => {
          category.awayScore = Math.max(0, Number(category.awayScore || 0) - 1);
          rerender();
        });

        card.querySelector('[data-action="away-plus"]')?.addEventListener("click", () => {
          category.awayScore = Number(category.awayScore || 0) + 1;
          rerender();
        });

        card.querySelector('[data-action="home-winner"]')?.addEventListener("click", () => {
          category.winnerSide = "A";
          rerender();
        });

        card.querySelector('[data-action="away-winner"]')?.addEventListener("click", () => {
          category.winnerSide = "B";
          rerender();
        });

        card.querySelector('[data-action="clear-winner"]')?.addEventListener("click", () => {
          category.winnerSide = null;
          rerender();
        });

        card.querySelector('[data-action="score-notes"]')?.addEventListener("input", (event) => {
          category.notes = safeText(event.target.value);
          saveTeamTieState(teamTieState);
        });

        teamCategoryBars.appendChild(card);
      });
    }

    receiveLineupBtn?.addEventListener("click", () => {
      lineupReviewPanel?.classList.remove("hidden");
      renderLineupReview();
      renderTeamCategoryBars();
      syncTeamSummaryUi();
    });

    manualLineupBtn?.addEventListener("click", () => {
      lineupReviewPanel?.classList.remove("hidden");
      teamTieState.categories.forEach((category, index) => {
        if (!category.homePlayer) category.homePlayer = teamTieState.homeRoster[index] || "";
        if (!category.awayPlayer) category.awayPlayer = teamTieState.awayRoster[index] || "";
        if (category.lineupStatus === "rejected") category.lineupStatus = "pending";
      });
      saveTeamTieState(teamTieState);
      renderLineupReview();
      renderTeamCategoryBars();
      syncTeamSummaryUi();
    });

    renderTeamCategoryBars();
    syncTeamSummaryUi();
    return;
  }

  // ---------------------------------------------------------------------------
  // INDIVIDUAL EVENT FLOW (UNCHANGED)
  // ---------------------------------------------------------------------------
  showIndividualEventShell();

  if (!schema) {
    titleEl.textContent = "No scoring schema found";
    subEl.textContent = "Finalize scoring schema for this category first.";
    saveBtn.disabled = true;
    return;
  }

  titleEl.textContent = `${homeLabel} vs ${awayLabel}`;
  subEl.textContent = `${schema?.sport || ""} • Category ${resolvedCategoryId || categoryId || "-"} • Round ${roundIndex + 1} • Match ${matchIndex + 1}`;

  homeNameEl.textContent = homeLabel;
  awayNameEl.textContent = awayLabel;

  const homePlayers = Array.isArray(match.homePlayers) ? match.homePlayers : splitTeamLabel(match.home);
  const awayPlayers = Array.isArray(match.awayPlayers) ? match.awayPlayers : splitTeamLabel(match.away);

  const existing = match.score || null;

  const state = {
    config: {},
    state: {
      A: { players: {} },
      B: { players: {} },
    },
    timer: {
      elapsedMs: existing?.timer?.elapsedMs ?? 0,
      running: false,
      startedAtEpochMs: null,
    },
  };

  if (existing?.cricket) state.cricket = existing.cricket;
  if (existing?.football) state.football = existing.football;
  if (existing?.basketball) state.basketball = existing.basketball;
  if (existing?.badminton) state.badminton = existing.badminton;
  if (existing?.pickleball) state.pickleball = existing.pickleball;

  (schema.inputs || []).forEach((f) => {
    state.config[f.key] = existing?.config?.[f.key] ?? f.default ?? null;
  });

  function ensurePlayer(side, name) {
    if (!state.state[side].players[name]) state.state[side].players[name] = {};
    return state.state[side].players[name];
  }

  function initPlayers(side, roster) {
    roster.forEach((p) => {
      const obj = ensurePlayer(side, p);
      (schema.playerFields || []).forEach((f) => {
        const prev = existing?.state?.[side]?.players?.[p]?.[f.key];
        obj[f.key] = prev ?? f.default ?? (f.type === "text" ? "" : 0);
      });
    });
  }

  initPlayers("A", homePlayers);
  initPlayers("B", awayPlayers);

  function recomputeTeamTotals() {
    ["A", "B"].forEach((side) => {
      const roster = side === "A" ? homePlayers : awayPlayers;
      const totals = {};

      (schema.playerFields || []).forEach((f) => {
        if (f.type === "counter" || f.type === "number") {
          totals[f.key] = roster.reduce((sum, p) => {
            const v = Number(state.state[side].players?.[p]?.[f.key] ?? 0);
            return sum + (Number.isFinite(v) ? v : 0);
          }, 0);
        }
      });

      Object.assign(state.state[side], totals);
    });
  }

  recomputeTeamTotals();

  function compute() {
    const logic = schema?.winnerLogic || {};
    const A = state.state.A;
    const B = state.state.B;
    const cfg = state.config;

    if (logic.type === "higherScoreWins") {
      const field = logic.field || "score";
      const a = Number(A[field] ?? 0);
      const b = Number(B[field] ?? 0);

      if (a > b) return { status: "completed", winnerName: homeLabel, reason: `${a} > ${b}` };
      if (b > a) return { status: "completed", winnerName: awayLabel, reason: `${b} > ${a}` };
      return { status: "pending", winnerName: null, reason: "Equal scores" };
    }

    if (logic.type === "firstToTarget") {
      const field = logic.field || "points";
      const a = Number(A[field] ?? 0);
      const b = Number(B[field] ?? 0);
      const target = Number(cfg[logic.targetFrom || "targetPoints"] ?? 0);
      const win2 = Boolean(cfg[logic.winByTwoFrom || "winByTwo"]);

      if (!target) return { status: "pending", winnerName: null, reason: "Target not set" };
      if (a >= target && (!win2 || a - b >= 2)) {
        return { status: "completed", winnerName: homeLabel, reason: `Reached ${a}/${target}` };
      }
      if (b >= target && (!win2 || b - a >= 2)) {
        return { status: "completed", winnerName: awayLabel, reason: `Reached ${b}/${target}` };
      }
      return { status: "pending", winnerName: null, reason: "Ongoing" };
    }

    return { status: "pending", winnerName: null, reason: "Unknown logic" };
  }

  function renderPills() {
    const c = compute();
    statusPill.innerHTML = `Status: <strong>${c.status}</strong>`;
    winnerPill.innerHTML = `Winner: <strong>${c.winnerName || "-"}</strong>`;
    reasonPill.innerHTML = `Reason: <strong>${c.reason || "-"}</strong>`;

    const logicField = schema?.winnerLogic?.field;
    if (logicField) {
      homeScoreEl.textContent = Number(state.state.A?.[logicField] ?? 0);
      awayScoreEl.textContent = Number(state.state.B?.[logicField] ?? 0);
    }
  }

  renderPills();

  toggleSettings?.addEventListener("click", () => {
    settingsPanel?.classList.toggle("open");
    toggleSettings.textContent = settingsPanel?.classList.contains("open") ? "✕ Settings" : "⚙ Settings";
  });

  function renderConfigFields() {
    clear(configWrap);

    const inputs = schema.inputs || [];
    if (!inputs.length) {
      configWrap.innerHTML = `<p class="helper-text">No match settings.</p>`;
      return;
    }

    inputs.forEach((f) => {
      const wrap = document.createElement("div");
      wrap.className = "field";

      const label = document.createElement("label");
      label.textContent = f.label || f.key;
      wrap.appendChild(label);

      let input;

      if (f.type === "number") {
        input = document.createElement("input");
        input.type = "number";
        input.value = state.config[f.key] ?? "";
        if (typeof f.min === "number") input.min = String(f.min);
        if (typeof f.max === "number") input.max = String(f.max);

        input.addEventListener("input", () => {
          state.config[f.key] = input.value === "" ? null : Number(input.value);
          renderPills();
        });
      } else if (f.type === "boolean") {
        input = document.createElement("select");
        input.innerHTML = `
          <option value="true">True</option>
          <option value="false">False</option>
        `;
        input.value = String(Boolean(state.config[f.key]));
        input.addEventListener("change", () => {
          state.config[f.key] = input.value === "true";
          renderPills();
        });
      } else {
        input = document.createElement("input");
        input.type = "text";
        input.value = state.config[f.key] ?? "";
        input.addEventListener("input", () => {
          state.config[f.key] = input.value;
          renderPills();
        });
      }

      wrap.appendChild(input);

      if (f.help) {
        const help = document.createElement("div");
        help.className = "helper-text";
        help.textContent = f.help;
        wrap.appendChild(help);
      }

      configWrap.appendChild(wrap);
    });
  }

  renderConfigFields();

  function formatMs(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function refreshTimerUi() {
    let ms = state.timer.elapsedMs;
    if (state.timer.running && state.timer.startedAtEpochMs) {
      ms += Date.now() - state.timer.startedAtEpochMs;
    }
    timerDisplay.textContent = formatMs(ms);
  }

  setInterval(refreshTimerUi, 250);
  refreshTimerUi();

  timerStartBtn?.addEventListener("click", () => {
    if (state.timer.running) return;
    state.timer.running = true;
    state.timer.startedAtEpochMs = Date.now();
  });

  timerPauseBtn?.addEventListener("click", () => {
    if (!state.timer.running) return;
    state.timer.elapsedMs += Date.now() - state.timer.startedAtEpochMs;
    state.timer.running = false;
    state.timer.startedAtEpochMs = null;
    refreshTimerUi();
  });

  timerResetBtn?.addEventListener("click", () => {
    state.timer.elapsedMs = 0;
    state.timer.running = false;
    state.timer.startedAtEpochMs = null;
    refreshTimerUi();
  });

  function closeDrawer() {
    drawer?.classList.remove("open");
    overlay?.classList.remove("show");
    document.body.classList.remove("drawer-lock");
  }

  function openDrawer({ playerName, teamLabel, fields, playerObj, onUpdate }) {
    drawerNameEl.textContent = playerName;
    drawerTeamEl.textContent = teamLabel;

    clear(drawerFields);

    fields.forEach((field) => {
      const row = document.createElement("div");
      row.className = "df-row";

      const lbl = document.createElement("div");
      lbl.className = "df-label";
      lbl.textContent = field.label || field.key;
      row.appendChild(lbl);

      if (field.type === "counter" || field.type === "number") {
        const ctrl = document.createElement("div");
        ctrl.className = "df-counter";

        const minBtn = document.createElement("button");
        minBtn.type = "button";
        minBtn.className = "df-counter-btn";
        minBtn.textContent = "−";

        const valEl = document.createElement("div");
        valEl.className = "df-counter-val";
        valEl.textContent = String(playerObj[field.key] ?? 0);

        const plusBtn = document.createElement("button");
        plusBtn.type = "button";
        plusBtn.className = "df-counter-btn df-counter-plus";
        plusBtn.textContent = "+";

        const min = typeof field.min === "number" ? field.min : 0;

        minBtn.addEventListener("click", () => {
          const next = Math.max(min, Number(playerObj[field.key] ?? 0) - 1);
          playerObj[field.key] = next;
          valEl.textContent = String(next);
          onUpdate();
        });

        plusBtn.addEventListener("click", () => {
          const next = Number(playerObj[field.key] ?? 0) + 1;
          playerObj[field.key] = next;
          valEl.textContent = String(next);
          onUpdate();
        });

        ctrl.appendChild(minBtn);
        ctrl.appendChild(valEl);
        ctrl.appendChild(plusBtn);
        row.appendChild(ctrl);
      } else if (field.type === "select") {
        const select = document.createElement("select");
        select.className = "df-select";

        const options = Array.isArray(field.options) ? field.options : [];
        select.innerHTML = options
          .map((opt) => `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`)
          .join("");

        select.value = String(playerObj[field.key] ?? (options[0] ?? ""));
        select.addEventListener("change", () => {
          playerObj[field.key] = select.value;
          onUpdate();
        });

        row.appendChild(select);
      } else {
        const input = document.createElement("input");
        input.className = "df-input";
        input.type = field.type === "number" ? "number" : "text";
        input.value = playerObj[field.key] ?? "";

        input.addEventListener("input", () => {
          playerObj[field.key] =
            field.type === "number"
              ? (input.value === "" ? 0 : Number(input.value))
              : input.value;
          onUpdate();
        });

        row.appendChild(input);
      }

      if (field.help) {
        const help = document.createElement("div");
        help.className = "df-help";
        help.textContent = field.help;
        row.appendChild(help);
      }

      drawerFields.appendChild(row);
    });

    drawer?.classList.add("open");
    overlay?.classList.add("show");
    document.body.classList.add("drawer-lock");
  }

  drawerClose?.addEventListener("click", closeDrawer);
  overlay?.addEventListener("click", closeDrawer);

  const logicField = schema?.winnerLogic?.field || null;
  const playerFields = schema.playerFields || [];

  function buildPanel(side, teamLabel, roster) {
    const panel = document.createElement("div");
    panel.className = "roster-panel";
    panel.dataset.side = side;

    const hdr = document.createElement("div");
    hdr.className = "roster-panel-header";
    hdr.innerHTML = `
      <span class="rp-label">${side === "A" ? "🏠" : "✈️"} ${escapeHtml(teamLabel)}</span>
      <span class="rp-close">✕</span>
    `;

    hdr.querySelector(".rp-close")?.addEventListener("click", () => {
      panel.classList.remove("active");
    });

    panel.appendChild(hdr);

    if (!roster.length) {
      const empty = document.createElement("div");
      empty.className = "rp-empty";
      empty.textContent = "No players available";
      panel.appendChild(empty);
      return panel;
    }

    roster.forEach((name) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "player-chip";

      function refreshChip() {
        const stat =
          logicField != null
            ? state.state[side].players?.[name]?.[logicField] ?? 0
            : null;

        chip.innerHTML = `
          <span class="pc-name">${escapeHtml(name)}</span>
          ${stat !== null ? `<span class="pc-stat">${escapeHtml(stat)}</span>` : ""}
        `;
      }

      refreshChip();

      chip.addEventListener("click", () => {
        ensurePlayer(side, name);
        openDrawer({
          playerName: name,
          teamLabel,
          fields: playerFields,
          playerObj: state.state[side].players[name],
          onUpdate: () => {
            recomputeTeamTotals();
            renderPills();
            refreshChip();
          },
        });
      });

      panel.appendChild(chip);
    });

    return panel;
  }

  const homePanel = buildPanel("A", homeLabel, homePlayers);
  const awayPanel = buildPanel("B", awayLabel, awayPlayers);

  rosterArea.appendChild(homePanel);
  rosterArea.appendChild(awayPanel);

  teamHomeBtn?.addEventListener("click", () => {
    homePanel.classList.toggle("active");
    awayPanel.classList.remove("active");
  });

  teamAwayBtn?.addEventListener("click", () => {
    awayPanel.classList.toggle("active");
    homePanel.classList.remove("active");
  });

  async function saveScore() {
    if (state.timer.running && state.timer.startedAtEpochMs) {
      state.timer.elapsedMs += Date.now() - state.timer.startedAtEpochMs;
      state.timer.running = false;
      state.timer.startedAtEpochMs = null;
    }

    const computed = compute();

    const payload = {
      tournamentId,
      categoryId: resolvedCategoryId,
      round: roundIndex,
      match: matchIndex,
      scoreIndex,

      score: {
        config: state.config,
        state: state.state,
        timer: {
          elapsedMs: state.timer.elapsedMs,
        },

        cricket: state.cricket,
        football: state.football,
        basketball: state.basketball,
        badminton: state.badminton,
        pickleball: state.pickleball,

        computed,
      },
    };

    const candidateUrls = [
      `/api/host/tournaments/${encodeURIComponent(tournamentId)}/matches/score`,
      `/api/host/tournaments/${encodeURIComponent(tournamentId)}/score`,
    ];

    let saved = false;
    let lastError = null;

    for (const url of candidateUrls) {
      try {
        await apiPut(url, payload);
        saved = true;
        break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!saved) {
      console.error(lastError);
      saveMsg.textContent = "Save failed";
      alert(lastError?.message || "Could not save score.");
      return;
    }

    saveMsg.textContent = "Saved and standings updated";
    renderPills();

    homeScoreEl.classList.add("bump");
    awayScoreEl.classList.add("bump");
    setTimeout(() => {
      homeScoreEl.classList.remove("bump");
      awayScoreEl.classList.remove("bump");
    }, 250);
  }

  saveBtn?.addEventListener("click", saveScore);
});