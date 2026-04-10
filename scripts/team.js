
import { requireAuth, logout } from "./auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;

  const TEAM_EVENT_CATEGORY_ID = "__team_event__";

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
    mode: "range",
    min: 1,
    max: 1,
    exact: 1,
    text: "Select players.",
  };

  let currentUserIsCaptain = false;
  let currentAcceptedInvite = null;
  let currentCaptainSubmission = null;
  let teamRequestsCache = [];
  let canonicalTeams = [];
  let currentCanonicalTeam = null;
  let myMatchesPayload = { matches: [], posterSettings: null };
  let activeSharePoster = null;

  const draftKey = `scheduleit_team_draft_${tournamentId}_${user.username || user.name || "user"}`;

  const trigger = document.getElementById("team-user-menu-trigger");
  const dropdown = document.getElementById("team-user-menu-dropdown");
  const playerBtn = document.getElementById("mode-player-btn");
  const hostBtn = document.getElementById("mode-host-btn");
  const backBtn = document.getElementById("team-back-btn");

  const teamTabs = document.querySelectorAll(".team-tab");
  const teamPanels = document.querySelectorAll(".team-tab-panel");
  const myMatchesTabBtn = document.getElementById("my-matches-tab-btn");
  const createTeamTabBtn = document.getElementById("create-team-tab-btn");
  const lineupTabBtn = document.getElementById("lineup-tab-btn");

  const teamForm = document.getElementById("team-form");
  const categoryWrap = document.getElementById("team-category-wrap");
  const categorySelect = document.getElementById("team-category-select");
  const teamRowsWrap = document.getElementById("team-player-rows");
  const addPlayerRowBtn = document.getElementById("add-player-row-btn");
  const saveDraftBtn = document.getElementById("save-draft-btn");
  const teamNameInput = document.getElementById("team-name-input");

  const tournamentNameEl = document.getElementById("team-tournament-name");
  const tournamentSportEl = document.getElementById("team-tournament-sport");
  const tournamentDatesEl = document.getElementById("team-tournament-dates");
  const pageTitleEl = document.getElementById("team-page-title");
  const pageSubtitleEl = document.getElementById("team-page-subtitle");
  const ruleTextEl = document.getElementById("team-rule-text");
  const ruleValueEl = document.getElementById("team-size-rule");
  const selectedCountEl = document.getElementById("selected-count");
  const requiredCountEl = document.getElementById("required-count");

  const myTeamNameEl = document.getElementById("my-team-name");
  const myTeamCaptainEl = document.getElementById("my-team-captain");
  const myTeamRoleEl = document.getElementById("my-team-role");
  const myTeamCategoryEl = document.getElementById("my-team-category");
  const myTeamPlayerListEl = document.getElementById("my-team-player-list");
  const myTeamEmptyStateEl = document.getElementById("my-team-empty-state");
  const myTeamEmptyTextEl = document.getElementById("my-team-empty-text");
  const myMatchesListEl = document.getElementById("my-matches-list");
  const myMatchesEmptyStateEl = document.getElementById("my-matches-empty-state");
  const myMatchesEmptyTextEl = document.getElementById("my-matches-empty-text");

  const lineupStatusEl = document.getElementById("team-lineup-status");
  const lineupHelpTextEl = document.getElementById("lineup-help-text");
  const lineupEmptyStateEl = document.getElementById("lineup-empty-state");
  const lineupParticipationSummaryEl = document.getElementById("lineup-participation-summary");
  const lineupMatchesListEl = document.getElementById("lineup-matches-list");
  const matchShareModal = document.getElementById("match-share-modal");
  const matchSharePreviewEl = document.getElementById("match-share-preview");
  const matchShareCloseBtn = document.getElementById("match-share-close-btn");
  const matchShareDownloadBtn = document.getElementById("match-share-download-btn");
  const matchShareNativeBtn = document.getElementById("match-share-native-btn");

  function normalizeIdentity(value) {
    return String(value || "").trim().toLowerCase();
  }

  function normalizePhone(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.length === 10) return `91${digits}`;
    return digits;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function identitiesMatch(a, b) {
    return normalizeIdentity(a) && normalizeIdentity(a) === normalizeIdentity(b);
  }

  function safeJson(value, fallback = null) {
    if (value == null) return fallback;
    if (typeof value === "object") return value;
    if (typeof value !== "string") return fallback;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
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

  function getAdvancedSettingsSafe() {
    return safeJson(tournamentMeta?.advancedSettings, tournamentMeta?.advancedSettings) || {};
  }

  function isPickleballLeagueMode() {
    return String(getAdvancedSettingsSafe()?.advancedMode || "") === "pickleball_team_league";
  }

  function getTeamEventCategoryId() {
    return TEAM_EVENT_CATEGORY_ID;
  }

  function normalizeTeamRequest(req) {
    if (!req || typeof req !== "object") return null;
    const normalized = { ...req };
    if (tournamentMeta?.tournamentType === "team" && !String(normalized.categoryId || "").trim()) {
      normalized.categoryId = TEAM_EVENT_CATEGORY_ID;
      normalized.categoryLabel = normalized.categoryLabel || "Team event";
    }
    return normalized;
  }

  function getMyTournamentPlayerRecords() {
    const authUserIds = new Set(
      [
        user?.id,
        user?.userId,
        user?.sub,
      ]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    );

    const authPhone = normalizePhone(
      user?.phone ||
      user?.phoneNumber ||
      user?.mobile ||
      ""
    );

    return allPlayers.filter((player) => {
      const playerRecordId = String(player?.userId || "").trim();
      const playerPhone = normalizePhone(player?.phone || player?.playerPhone || "");

      return (
        (playerRecordId && authUserIds.has(playerRecordId)) ||
        (authPhone && playerPhone && authPhone === playerPhone) ||
        identitiesMatch(player?.username, user?.username) ||
        identitiesMatch(player?.playerName, user?.name) ||
        identitiesMatch(player?.playerName, user?.username) ||
        identitiesMatch(player?.name, user?.name) ||
        identitiesMatch(player?.name, user?.username)
      );
    });
  }

  function isSameUserByInviteFields(invite, currentUser = user) {
    const myPlayerRecords = getMyTournamentPlayerRecords();
    const myPlayerIds = new Set(
      myPlayerRecords
        .map((p) => String(p?.playerId || p?.registrationId || p?.id || ""))
        .filter(Boolean)
    );

    return (
      (invite?.playerId && myPlayerIds.has(String(invite.playerId))) ||
      (invite?.inviteePlayerId && myPlayerIds.has(String(invite.inviteePlayerId))) ||
      identitiesMatch(invite?.inviteeUsername, currentUser?.username) ||
      identitiesMatch(invite?.username, currentUser?.username) ||
      identitiesMatch(invite?.inviteeName, currentUser?.name) ||
      identitiesMatch(invite?.inviteeName, currentUser?.username) ||
      identitiesMatch(invite?.playerName, currentUser?.name) ||
      identitiesMatch(invite?.playerName, currentUser?.username) ||
      identitiesMatch(invite?.name, currentUser?.name) ||
      identitiesMatch(invite?.name, currentUser?.username)
    );
  }

  function isSameCaptain(submission, currentUser = user) {
    const myPlayerIds = getMyTournamentPlayerIds();
    return (
      (submission?.captainPlayerId && myPlayerIds.has(String(submission.captainPlayerId))) ||
      identitiesMatch(submission?.captainUsername, currentUser?.username) ||
      identitiesMatch(submission?.captainName, currentUser?.name) ||
      identitiesMatch(submission?.captainName, currentUser?.username) ||
      identitiesMatch(submission?.createdBy, currentUser?.username) ||
      identitiesMatch(submission?.createdBy, currentUser?.name)
    );
  }

  function requestMatchesCurrentUser(req) {
    if (!req || typeof req !== "object") return false;
    if (isSameCaptain(req, user)) return true;

    const invited = Array.isArray(req?.invitedPlayers) ? req.invitedPlayers : [];
    return invited.some((invite) => isSameUserByInviteFields(invite, user));
  }

  function requestHasAcceptedInviteForCurrentUser(req) {
    if (!req || typeof req !== "object") return false;

    const invited = Array.isArray(req?.invitedPlayers) ? req.invitedPlayers : [];
    return invited.some(
      (invite) =>
        isSameUserByInviteFields(invite, user) &&
        String(invite?.inviteStatus || invite?.status || "").toLowerCase() === "accepted"
    );
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

  function categoryLabel(c) {
    const age = c?.ageGroup ? String(c.ageGroup).trim() : "";
    const gender = c?.gender ? String(c.gender).trim() : "";
    const level = c?.playingLevel ? String(c.playingLevel).trim() : "";
    const size = c?.teamSize ? Number(c.teamSize) : null;
    const exact = c?.exactTeamSize ? Number(c.exactTeamSize) : null;

    let type = "";
    if (size === 1) type = "Singles";
    else if (size === 2) type = "Doubles";
    else if (size === 3) type = "Triples";
    else if (size >= 4) type = exact ? `Team ${exact}` : "Team";

    const parts = [age, gender, level, type].filter(Boolean);
    return parts.length ? parts.join(" • ") : (c?.categoryId || c?.id || "Category");
  }

  function getAcceptedPlayers() {
    return allPlayers.filter((p) => normalizeStatus(p) === "accepted");
  }

  function getCurrentCategory() {
    const categories = normalizeCategories(tournamentMeta?.categories);
    if (tournamentMeta?.tournamentType === "team") return null;
    return categories.find((c) => String(c.categoryId || c.id) === String(categorySelect.value)) || null;
  }

  function getPlayersForCategory(categoryId) {
    const accepted = getAcceptedPlayers();
    if (tournamentMeta?.tournamentType === "team") return accepted;
    return accepted.filter((p) => String(getPlayerCategoryId(p)) === String(categoryId));
  }

  function getCurrentTeamCategoryId() {
    const fromCaptain = String(currentCaptainSubmission?.categoryId || "").trim();
    const fromInvite = String(currentAcceptedInvite?.categoryId || "").trim();
    if (fromCaptain) return fromCaptain;
    if (fromInvite) return fromInvite;
    if (tournamentMeta?.tournamentType === "team") return TEAM_EVENT_CATEGORY_ID;
    return "";
  }

  function getCaptainIdentity() {
    return {
      username: user.username || "",
      name: user.name || user.username || "",
    };
  }

  function getTournamentCaptainState() {
    return tournamentMeta?.captainState || tournamentMeta?.captains || {};
  }

  function getOtherCaptainNamesForTournament() {
    const captainState = getTournamentCaptainState();
    const confirmed = Array.isArray(captainState?.confirmedCaptains) ? captainState.confirmedCaptains : [];
    return confirmed
      .map((c) => normalizeIdentity(c?.playerName || c?.captainName || c?.username))
      .filter(Boolean)
      .filter((name) => name !== normalizeIdentity(user?.name) && name !== normalizeIdentity(user?.username));
  }

  function isCaptainPlayerRecord(player) {
    const captain = getCaptainIdentity();
    return (
      identitiesMatch(player?.username, captain.username) ||
      identitiesMatch(player?.playerName, captain.name) ||
      identitiesMatch(player?.name, captain.name)
    );
  }

  function isOtherCaptainPlayerRecord(player) {
    const otherCaptainNames = getOtherCaptainNamesForTournament();
    const playerName =
      normalizeIdentity(player?.playerName) ||
      normalizeIdentity(player?.name) ||
      normalizeIdentity(player?.username);
    return otherCaptainNames.includes(playerName);
  }

  function getSelectablePlayersForTeam(categoryId) {
    const pool =
      tournamentMeta?.tournamentType === "team"
        ? getAcceptedPlayers()
        : getPlayersForCategory(categoryId);

    return pool.filter((player) => {
      if (isCaptainPlayerRecord(player)) return false;
      if (isOtherCaptainPlayerRecord(player)) return false;
      return true;
    });
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

  async function apiPost(url, body) {
    return apiJson(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
  }

  function getStatusClass(status) {
    const normalized = normalizeIdentity(status);
    if (normalized === "live") return "live-status--live";
    if (normalized === "completed") return "live-status--completed";
    return "live-status--pending";
  }

  function splitTeamName(value) {
    const text = String(value || "").trim();
    const upper = text.toUpperCase();
    if (!text || upper === "BYE" || upper === "TBD") return [];
    return text.split(" + ").map((item) => item.trim()).filter(Boolean);
  }

  function getBucketScore(bucket) {
    if (bucket == null) return "-";
    if (typeof bucket === "number") return bucket;
    if (typeof bucket === "string" && bucket.trim()) return bucket.trim();
    if (typeof bucket?.value === "number") return bucket.value;
    if (typeof bucket?.score === "number") return bucket.score;
    if (typeof bucket?.points === "number") return bucket.points;
    return 0;
  }

  function getSubmatchLabel(submatch, index) {
    return String(
      submatch?.label ||
      submatch?.title ||
      submatch?.categoryName ||
      submatch?.eventName ||
      `Submatch ${index + 1}`
    ).trim();
  }

  function getSubmatchPlayerLabel(submatch, side, fallback) {
    const key = side === "A" ? "homePlayers" : "awayPlayers";
    const values = Array.isArray(submatch?.[key]) ? submatch[key] : [];
    return values.length ? values.join(" + ") : fallback;
  }

  function getTeamTotals(match) {
    const totals = {
      homeWins: 0,
      awayWins: 0,
      homePoints: Number(match?.matchPointsHome || 0) || 0,
      awayPoints: Number(match?.matchPointsAway || 0) || 0,
    };

    const submatches = Array.isArray(match?.submatches) ? match.submatches : [];
    submatches.forEach((submatch) => {
      const winnerSide = normalizeIdentity(submatch?.winnerSide || submatch?.score?.computed?.winnerSide || "");
      if (winnerSide === "a" || winnerSide === "home") totals.homeWins += 1;
      if (winnerSide === "b" || winnerSide === "away") totals.awayWins += 1;
    });

    return totals;
  }

  function buildSimpleLiveCard(match) {
    const homeScore = getBucketScore(match?.score?.state?.A);
    const awayScore = getBucketScore(match?.score?.state?.B);
    const homePlayers = Array.isArray(match?.homePlayers) && match.homePlayers.length
      ? match.homePlayers
      : splitTeamName(match?.home);
    const awayPlayers = Array.isArray(match?.awayPlayers) && match.awayPlayers.length
      ? match.awayPlayers
      : splitTeamName(match?.away);

    return `
      <section class="live-score-card live-tv-card">
        <div class="live-tv-card-head">
          <div class="live-tv-badges">
            <span class="live-badge">${escapeHtml(match?.categoryLabel || "Match")}</span>
            <span class="live-badge">${escapeHtml(match?.roundLabel || `Round ${Number(match?.roundIndex || 0) + 1}`)}</span>
            ${match?.court ? `<span class="live-badge">${escapeHtml(match.court)}</span>` : ""}
            ${match?.time ? `<span class="live-badge">${escapeHtml(match.time)}</span>` : ""}
          </div>
          <span class="live-badge ${getStatusClass(match?.status)}">${escapeHtml(match?.status || "pending")}</span>
        </div>

        <div class="live-tv-simple-main">
          <div class="live-tv-team-block">
            <div class="live-tv-team-name">${escapeHtml(match?.home || "Home")}</div>
            <div class="live-tv-player-stack" role="list">
              ${(homePlayers.length ? homePlayers : ["-"]).map((name) => `<span class="live-tv-player-row" role="listitem">${escapeHtml(name)}</span>`).join("")}
            </div>
          </div>

          <div class="live-tv-simple-score">${escapeHtml(String(homeScore))} - ${escapeHtml(String(awayScore))}</div>

          <div class="live-tv-team-block live-tv-team-block--right">
            <div class="live-tv-team-name">${escapeHtml(match?.away || "Away")}</div>
            <div class="live-tv-player-stack live-tv-player-stack--right" role="list">
              ${(awayPlayers.length ? awayPlayers : ["-"]).map((name) => `<span class="live-tv-player-row live-tv-player-row--right" role="listitem">${escapeHtml(name)}</span>`).join("")}
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function buildTeamScheduleLiveCard(match) {
    const submatches = Array.isArray(match?.submatches) ? match.submatches : [];
    const totals = getTeamTotals(match);

    const submatchRows = submatches.length
      ? submatches.map((submatch, index) => {
          const homeScore = getBucketScore(submatch?.score?.state?.A);
          const awayScore = getBucketScore(submatch?.score?.state?.B);
          return `
            <div class="live-tv-submatch-row${submatch?.isMine ? " live-tv-submatch-row--mine" : ""}">
              <div class="live-tv-submatch-side live-tv-submatch-side--left">
                <span class="live-tv-submatch-player">${escapeHtml(getSubmatchPlayerLabel(submatch, "A", match?.home || "Home"))}</span>
                ${submatch?.mySide === "home" ? '<span class="live-tv-submatch-tag">You played</span>' : ""}
              </div>
              <div class="live-tv-submatch-center">
                <span class="live-tv-submatch-title">${escapeHtml(getSubmatchLabel(submatch, index))}</span>
                <span class="live-tv-submatch-score">${escapeHtml(String(homeScore))} - ${escapeHtml(String(awayScore))}</span>
              </div>
              <div class="live-tv-submatch-side live-tv-submatch-side--right">
                <span class="live-tv-submatch-player">${escapeHtml(getSubmatchPlayerLabel(submatch, "B", match?.away || "Away"))}</span>
                ${submatch?.mySide === "away" ? '<span class="live-tv-submatch-tag">You played</span>' : ""}
              </div>
            </div>
          `;
        }).join("")
      : '<div class="live-tv-empty-note">No player-level submatch score is available yet.</div>';

    return `
      <section class="live-score-card live-tv-card">
        <div class="live-tv-card-head">
          <div class="live-tv-badges">
            <span class="live-badge">${escapeHtml(match?.categoryLabel || "Team match")}</span>
            <span class="live-badge">${escapeHtml(match?.roundLabel || `Match ${Number(match?.matchIndex || 0) + 1}`)}</span>
            ${match?.court ? `<span class="live-badge">${escapeHtml(match.court)}</span>` : ""}
            ${match?.time ? `<span class="live-badge">${escapeHtml(match.time)}</span>` : ""}
          </div>
          <span class="live-badge ${getStatusClass(match?.status)}">${escapeHtml(match?.status || "pending")}</span>
        </div>

        <div class="live-tv-teams">
          <div class="live-tv-team">
            <div class="live-tv-team-name">${escapeHtml(match?.home || "Home")}</div>
            <div class="live-tv-team-total">Total match points ${escapeHtml(String(totals.homePoints || 0))}</div>
          </div>
          <div class="live-tv-tie-score-wrap">
            <div class="live-tv-tie-score-label">Tie score</div>
            <div class="live-tv-tie-score">${escapeHtml(String(totals.homeWins || 0))} - ${escapeHtml(String(totals.awayWins || 0))}</div>
          </div>
          <div class="live-tv-team live-tv-team--right">
            <div class="live-tv-team-name">${escapeHtml(match?.away || "Away")}</div>
            <div class="live-tv-team-total">Total match points ${escapeHtml(String(totals.awayPoints || 0))}</div>
          </div>
        </div>

        <div class="live-tv-submatches">${submatchRows}</div>
      </section>
    `;
  }

  function buildMyMatchCard(match, index) {
    const cardHtml = match?.isTeamSchedule ? buildTeamScheduleLiveCard(match) : buildSimpleLiveCard(match);
    return `
      <div class="my-match-card-shell" data-match-card="${escapeHtml(String(index))}">
        ${cardHtml}
        <div class="my-match-actions">
          <button type="button" class="btn-primary" data-share-match="${escapeHtml(String(index))}">Share story card</button>
        </div>
      </div>
    `;
  }

  function renderMyMatchesTab() {
    if (!myMatchesListEl || !myMatchesEmptyStateEl || !myMatchesEmptyTextEl) return;

    const matches = Array.isArray(myMatchesPayload?.matches) ? myMatchesPayload.matches : [];
    myMatchesListEl.innerHTML = "";

    if (!matches.length) {
      myMatchesEmptyStateEl.classList.remove("hidden");
      myMatchesEmptyTextEl.textContent = "As soon as you appear in a match lineup or player list, your scorecard will show up here.";
      return;
    }

    myMatchesEmptyStateEl.classList.add("hidden");
    myMatchesListEl.innerHTML = matches.map((match, index) => buildMyMatchCard(match, index)).join("");

    myMatchesListEl.querySelectorAll("[data-share-match]").forEach((button) => {
      button.addEventListener("click", async () => {
        const index = Number(button.getAttribute("data-share-match"));
        const match = matches[index];
        if (match) await openMatchShareModal(match);
      });
    });
  }

  async function loadMyMatches() {
    const resp = await apiGet(`/api/player/tournaments/${encodeURIComponent(tournamentId)}/my-matches`);
    if (!resp.ok) {
      myMatchesPayload = { matches: [], posterSettings: null };
      renderMyMatchesTab();
      return;
    }

    myMatchesPayload = {
      matches: Array.isArray(resp.data?.matches) ? resp.data.matches : [],
      posterSettings: resp.data?.posterSettings || null,
    };
    renderMyMatchesTab();
  }

  function closeMatchShareModal() {
    matchShareModal?.classList.add("hidden");
    matchShareModal?.setAttribute("aria-hidden", "true");
    activeSharePoster = null;
    if (matchSharePreviewEl) matchSharePreviewEl.src = "";
  }

  function getPosterMetaLines(settings) {
    if (!settings || typeof settings !== "object") return { top: [], bottom: [] };
    const linesTop = [];
    const linesBottom = [];
    const visibility = settings.visibility || {};

    if (visibility.organizerName && settings.organizerName) linesTop.push(`Hosted by ${settings.organizerName}`);
    if (visibility.tagline && settings.tagline) linesTop.push(settings.tagline);

    (Array.isArray(settings.customFields) ? settings.customFields : [])
      .filter((field) => field?.enabled !== false && field?.label && field?.value)
      .forEach((field) => {
        const line = `${field.label}: ${field.value}`;
        if (String(field.position || "bottom").toLowerCase() === "top") linesTop.push(line);
        else linesBottom.push(line);
      });

    if (visibility.sponsorNames && Array.isArray(settings.sponsorNames) && settings.sponsorNames.length) {
      linesBottom.push(`Sponsors: ${settings.sponsorNames.join(" • ")}`);
    }

    const footerBits = [];
    if (visibility.venueLabel && settings.venueLabel) footerBits.push(settings.venueLabel);
    if (visibility.cityName && settings.cityName) footerBits.push(settings.cityName);
    if (visibility.socialHandle && settings.socialHandle) footerBits.push(settings.socialHandle);
    if (footerBits.length) linesBottom.push(footerBits.join(" • "));

    return { top: linesTop, bottom: linesBottom };
  }

  function drawRoundedRect(ctx, x, y, width, height, radius, fillStyle, strokeStyle = null) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
    ctx.fillStyle = fillStyle;
    ctx.fill();
    if (strokeStyle) {
      ctx.strokeStyle = strokeStyle;
      ctx.stroke();
    }
  }

  function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
    const words = String(text || "").split(/\s+/).filter(Boolean);
    if (!words.length) return y;

    let line = "";
    let linesDrawn = 0;
    for (let index = 0; index < words.length; index += 1) {
      const testLine = line ? `${line} ${words[index]}` : words[index];
      if (ctx.measureText(testLine).width <= maxWidth || !line) {
        line = testLine;
        continue;
      }

      ctx.fillText(line, x, y);
      y += lineHeight;
      linesDrawn += 1;
      line = words[index];
      if (linesDrawn >= maxLines - 1) break;
    }

    if (line && linesDrawn < maxLines) {
      let finalLine = line;
      while (ctx.measureText(finalLine).width > maxWidth && finalLine.length > 1) {
        finalLine = `${finalLine.slice(0, -2)}…`;
      }
      ctx.fillText(finalLine, x, y);
      y += lineHeight;
    }

    return y;
  }

  async function buildMatchSharePoster(match) {
    const width = 1080;
    const height = 1920;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create poster canvas");

    if (document.fonts?.ready) {
      try {
        await document.fonts.ready;
      } catch {}
    }

    const background = ctx.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, "#08111f");
    background.addColorStop(0.5, "#0b1730");
    background.addColorStop(1, "#050b18");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "rgba(77, 208, 225, 0.16)";
    ctx.beginPath();
    ctx.arc(220, 260, 260, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(242, 95, 76, 0.12)";
    ctx.beginPath();
    ctx.arc(880, 1540, 300, 0, Math.PI * 2);
    ctx.fill();

    const posterMeta = getPosterMetaLines(myMatchesPayload?.posterSettings || null);

    ctx.fillStyle = "#7dd3fc";
    ctx.font = '700 34px "Space Grotesk", sans-serif';
    let cursorY = 120;
    posterMeta.top.forEach((line) => {
      cursorY = drawWrappedText(ctx, line, 84, cursorY, 912, 42, 2);
    });

    ctx.fillStyle = "#e6eef8";
    ctx.font = '700 70px "Space Grotesk", sans-serif';
    cursorY = drawWrappedText(ctx, tournamentMeta?.tournamentName || "ScheduleIt", 84, cursorY + 34, 912, 82, 3);

    ctx.fillStyle = "rgba(230, 238, 248, 0.82)";
    ctx.font = '500 30px "Inter", sans-serif';
    const metaLine = [match?.categoryLabel, match?.roundLabel, match?.court].filter(Boolean).join(" • ");
    cursorY = drawWrappedText(ctx, metaLine, 84, cursorY + 10, 912, 40, 2);

    drawRoundedRect(ctx, 64, 360, 952, match?.isTeamSchedule ? 960 : 760, 44, "rgba(10, 16, 30, 0.88)", "rgba(255,255,255,0.08)");

    ctx.fillStyle = "#f8fafc";
    ctx.font = '700 54px "Space Grotesk", sans-serif';
    drawWrappedText(ctx, match?.home || "Home", 116, 470, 300, 60, 2);
    ctx.textAlign = "right";
    drawWrappedText(ctx, match?.away || "Away", 964, 470, 300, 60, 2);
    ctx.textAlign = "left";

    if (match?.isTeamSchedule) {
      const totals = getTeamTotals(match);
      ctx.fillStyle = "#4dd0e1";
      ctx.font = '700 110px "Space Grotesk", sans-serif';
      ctx.textAlign = "center";
      ctx.fillText(`${totals.homeWins} - ${totals.awayWins}`, width / 2, 590);
      ctx.fillStyle = "rgba(230, 238, 248, 0.8)";
      ctx.font = '600 24px "Inter", sans-serif';
      ctx.fillText("Tie score", width / 2, 640);
      ctx.textAlign = "left";

      let y = 760;
      const submatches = Array.isArray(match?.submatches) ? match.submatches : [];
      submatches.slice(0, 6).forEach((submatch, index) => {
        const highlight = Boolean(submatch?.isMine);
        drawRoundedRect(
          ctx,
          108,
          y - 48,
          864,
          112,
          26,
          highlight ? "rgba(77, 208, 225, 0.12)" : "rgba(255,255,255,0.03)",
          highlight ? "rgba(77, 208, 225, 0.36)" : "rgba(255,255,255,0.06)"
        );

        ctx.fillStyle = "#e6eef8";
        ctx.font = '700 26px "Inter", sans-serif';
        drawWrappedText(ctx, getSubmatchPlayerLabel(submatch, "A", match?.home || "Home"), 136, y, 280, 30, 2);
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(230,238,248,0.78)";
        ctx.font = '700 18px "Inter", sans-serif';
        ctx.fillText(getSubmatchLabel(submatch, index), width / 2, y - 6);
        ctx.fillStyle = "#ffffff";
        ctx.font = '700 34px "Space Grotesk", sans-serif';
        ctx.fillText(`${getBucketScore(submatch?.score?.state?.A)} - ${getBucketScore(submatch?.score?.state?.B)}`, width / 2, y + 32);
        ctx.textAlign = "right";
        ctx.fillStyle = "#e6eef8";
        ctx.font = '700 26px "Inter", sans-serif';
        drawWrappedText(ctx, getSubmatchPlayerLabel(submatch, "B", match?.away || "Away"), 944, y, 280, 30, 2);
        ctx.textAlign = "left";

        if (highlight) {
          ctx.fillStyle = "#4dd0e1";
          ctx.font = '700 18px "Inter", sans-serif';
          ctx.fillText("YOU PLAYED", 136, y + 52);
        }

        y += 130;
      });
    } else {
      const homePlayers = Array.isArray(match?.homePlayers) && match.homePlayers.length ? match.homePlayers : splitTeamName(match?.home);
      const awayPlayers = Array.isArray(match?.awayPlayers) && match.awayPlayers.length ? match.awayPlayers : splitTeamName(match?.away);

      ctx.fillStyle = "rgba(230, 238, 248, 0.92)";
      ctx.font = '600 30px "Inter", sans-serif';
      let leftY = 580;
      homePlayers.forEach((player) => {
        leftY = drawWrappedText(ctx, player, 116, leftY, 280, 38, 2);
      });

      ctx.textAlign = "right";
      let rightY = 580;
      awayPlayers.forEach((player) => {
        rightY = drawWrappedText(ctx, player, 964, rightY, 280, 38, 2);
      });
      ctx.textAlign = "left";

      ctx.fillStyle = "#4dd0e1";
      ctx.font = '700 130px "Space Grotesk", sans-serif';
      ctx.textAlign = "center";
      ctx.fillText(`${getBucketScore(match?.score?.state?.A)} - ${getBucketScore(match?.score?.state?.B)}`, width / 2, 760);
      ctx.textAlign = "left";
    }

    ctx.fillStyle = "rgba(230,238,248,0.86)";
    ctx.font = '600 24px "Inter", sans-serif';
    const footerYStart = height - 240;
    let footerY = footerYStart;
    posterMeta.bottom.forEach((line) => {
      footerY = drawWrappedText(ctx, line, 84, footerY, 912, 34, 3);
    });

    ctx.fillStyle = "#7dd3fc";
    ctx.font = '700 24px "Inter", sans-serif';
    ctx.fillText("Built on ScheduleIt", 84, height - 88);

    return canvas.toDataURL("image/png");
  }

  async function openMatchShareModal(match) {
    if (!matchShareModal || !matchSharePreviewEl) return;
    const dataUrl = await buildMatchSharePoster(match);
    activeSharePoster = {
      dataUrl,
      fileName: `scheduleit-match-${String(match?.matchId || "card").replace(/[^a-z0-9_-]+/gi, "-").toLowerCase()}.png`,
      match,
    };
    matchSharePreviewEl.src = dataUrl;
    matchShareModal.classList.remove("hidden");
    matchShareModal.setAttribute("aria-hidden", "false");
  }

  async function dataUrlToFile(dataUrl, fileName) {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    return new File([blob], fileName, { type: blob.type || "image/png" });
  }

  async function downloadActiveSharePoster() {
    if (!activeSharePoster?.dataUrl) return;
    const link = document.createElement("a");
    link.href = activeSharePoster.dataUrl;
    link.download = activeSharePoster.fileName || "scheduleit-match.png";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function shareActivePoster() {
    if (!activeSharePoster?.dataUrl) return;

    const file = await dataUrlToFile(
      activeSharePoster.dataUrl,
      activeSharePoster.fileName || "scheduleit-match.png"
    );

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: `${tournamentMeta?.tournamentName || "Tournament"} match card`,
        text: "Generated from ScheduleIt",
      });
      return;
    }

    await downloadActiveSharePoster();
    alert("Image downloaded. Open Instagram and add it to your story.");
  }

  if (trigger) {
    const label = String(user?.username || user?.name || user?.email || "U").trim();
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

  matchShareCloseBtn?.addEventListener("click", closeMatchShareModal);
  matchShareDownloadBtn?.addEventListener("click", downloadActiveSharePoster);
  matchShareNativeBtn?.addEventListener("click", async () => {
    try {
      await shareActivePoster();
    } catch (err) {
      alert(err?.message || "Could not share this image.");
    }
  });
  matchShareModal?.querySelectorAll("[data-share-close]")?.forEach((element) => {
    element.addEventListener("click", closeMatchShareModal);
  });

  function wireTeamTabs() {
    teamTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const target = tab.dataset.tab;
        if (!target) return;

        teamTabs.forEach((btn) => btn.classList.toggle("is-active", btn === tab));
        teamPanels.forEach((panel) => {
          panel.classList.toggle("is-active", panel.dataset.panel === target);
        });
      });
    });
  }
  wireTeamTabs();

  async function loadTournamentMeta() {
    const direct = await apiGet(`/api/tournaments/${encodeURIComponent(tournamentId)}`);
    if (direct.ok && direct.data) return direct.data;

    const hostResp = await apiGet("/api/host/tournaments");
    if (hostResp.ok && Array.isArray(hostResp.data)) {
      const found = hostResp.data.find((t) => String(t.tournamentId ?? t.id) === String(tournamentId));
      if (found) return found;
    }

    const publicResp = await apiGet("/api/tournaments");
    if (publicResp.ok && Array.isArray(publicResp.data)) {
      const found = publicResp.data.find((t) => String(t.tournamentId ?? t.id) === String(tournamentId));
      if (found) return found;
    }

    return null;
  }

  async function loadPlayers() {
    const candidates = [
      `/api/tournaments/${encodeURIComponent(tournamentId)}/players`,
      `/api/host/tournaments/${encodeURIComponent(tournamentId)}/players`,
    ];

    for (const url of candidates) {
      const resp = await apiGet(url);
      if (!resp.ok) continue;
      if (Array.isArray(resp.data)) return resp.data;
      if (Array.isArray(resp.data?.players)) return resp.data.players;
      if (Array.isArray(resp.data?.items)) return resp.data.items;
    }

    alert("Could not load tournament players.");
    return [];
  }

  async function loadTeamRequestsForTournament() {
    const candidates = [
      `/api/player/tournaments/${encodeURIComponent(tournamentId)}/team-requests`,
      `/api/player/team-requests`,
      `/api/tournaments/${encodeURIComponent(tournamentId)}/team-requests`,
    ];

    for (const url of candidates) {
      const resp = await apiGet(url);
      if (!resp.ok) continue;

      let rows = [];
      if (Array.isArray(resp.data)) rows = resp.data;
      else if (Array.isArray(resp.data?.items)) rows = resp.data.items;
      else if (Array.isArray(resp.data?.requests)) rows = resp.data.requests;

      if (!Array.isArray(rows)) continue;

      if (url === `/api/player/team-requests`) {
        rows = rows.filter((req) => String(req?.tournamentId || "").trim() === String(tournamentId));
      }

      return rows
        .map(normalizeTeamRequest)
        .filter(Boolean)
        .filter((req) => requestMatchesCurrentUser(req));
    }

    return [];
  }

  async function loadCaptainStateForTournament() {
    const candidates = [
      `/api/host/tournaments/${encodeURIComponent(tournamentId)}/captains`,
      `/api/tournaments/${encodeURIComponent(tournamentId)}`,
    ];

    for (const url of candidates) {
      const resp = await apiGet(url);
      if (!resp.ok) continue;

      if (url.includes("/captains")) return resp.data || null;

      const t = resp.data || null;
      if (t?.captains) return t.captains;
      if (t?.captainState) return t.captainState;
    }

    return tournamentMeta?.captains || tournamentMeta?.captainState || null;
  }

  async function loadCanonicalTeamsForTournament() {
    const candidates = [
      `/api/player/tournaments/${encodeURIComponent(tournamentId)}/teams`,
      `/api/tournaments/${encodeURIComponent(tournamentId)}`,
    ];

    for (const url of candidates) {
      const resp = await apiGet(url);
      if (!resp.ok) continue;

      if (url.includes("/teams")) {
        if (Array.isArray(resp.data?.teams)) {
          return resp.data.teams;
        }
        if (Array.isArray(resp.data)) {
          return resp.data;
        }
      }

      const t = resp.data || null;
      if (Array.isArray(t?.teams)) {
        return t.teams.filter((team) => teamContainsCurrentUser(team));
      }
    }

    return [];
  }
function getMyTournamentPlayerIds() {
  return new Set(
    getMyTournamentPlayerRecords()
      .map((p) => String(getPlayerId(p) || "").trim())
      .filter(Boolean)
  );
}

function normalizeCanonicalTeamPlayer(player = {}) {
  return {
    playerId: String(player?.playerId || "").trim(),
    playerName: String(player?.playerName || player?.name || player?.username || "").trim(),
    username: String(player?.username || "").trim(),
    phone: String(player?.phone || "").trim(),
    inviteStatus: String(player?.inviteStatus || "accepted").trim().toLowerCase(),
    isCaptain: Boolean(player?.isCaptain),
  };
}

function canonicalPlayersOverlap(a = {}, b = {}) {
  const aId = String(a?.playerId || "").trim();
  const bId = String(b?.playerId || "").trim();
  const aUsername = normalizeIdentity(a?.username || "");
  const bUsername = normalizeIdentity(b?.username || "");
  const aPhone = String(a?.phone || "").trim();
  const bPhone = String(b?.phone || "").trim();
  const aName = normalizeIdentity(a?.playerName || "");
  const bName = normalizeIdentity(b?.playerName || "");

  if (aId && bId && aId === bId) return true;
  if (aUsername && bUsername && aUsername === bUsername) return true;
  if (aPhone && bPhone && aPhone === bPhone) return true;
  if (aName && bName && aName === bName) return true;

  return false;
}

function getCanonicalTeamPlayers(team) {
  const rawPlayers = Array.isArray(team?.players) ? team.players : [];
  const out = [];

  rawPlayers
    .map(normalizeCanonicalTeamPlayer)
    .filter((p) => p.playerName || p.playerId || p.username)
    .forEach((player) => {
      const existing = out.find((candidate) => canonicalPlayersOverlap(candidate, player));
      if (!existing) {
        out.push(player);
        return;
      }

      if (!existing.playerId && player.playerId) existing.playerId = player.playerId;
      if (!existing.username && player.username) existing.username = player.username;
      if (!existing.phone && player.phone) existing.phone = player.phone;
      if ((!existing.playerName || existing.playerName === "Player") && player.playerName) {
        existing.playerName = player.playerName;
      }
      existing.isCaptain = Boolean(existing.isCaptain || player.isCaptain);

      const existingStatus = String(existing.inviteStatus || "pending").toLowerCase();
      const incomingStatus = String(player.inviteStatus || "pending").toLowerCase();
      if (incomingStatus === "accepted" || (incomingStatus === "pending" && existingStatus === "rejected")) {
        existing.inviteStatus = incomingStatus;
      }
    });

  return out;
}

function teamMatchesCurrentCaptain(team) {
  const myPlayerIds = getMyTournamentPlayerIds();
  return (
    myPlayerIds.has(String(team?.captainPlayerId || "").trim()) ||
    identitiesMatch(team?.captainUsername, user?.username) ||
    identitiesMatch(team?.captainName, user?.name) ||
    identitiesMatch(team?.captainName, user?.username)
  );
}

function teamContainsCurrentUser(team) {
  const myPlayerIds = getMyTournamentPlayerIds();

  const myUsernames = new Set(
    getMyTournamentPlayerRecords()
      .map((p) => normalizeIdentity(p?.username || ""))
      .filter(Boolean)
  );

  const myPhones = new Set(
    getMyTournamentPlayerRecords()
      .map((p) => normalizePhone(p?.phone || p?.playerPhone || ""))
      .filter(Boolean)
  );

  const authPhone = normalizePhone(
    user?.phone ||
    user?.phoneNumber ||
    user?.mobile ||
    ""
  );
  if (authPhone) myPhones.add(authPhone);

  const players = getCanonicalTeamPlayers(team);

  if (teamMatchesCurrentCaptain(team)) return true;

  return players.some((player) => {
    return (
      (player.playerId && myPlayerIds.has(player.playerId)) ||
      (player.username && myUsernames.has(normalizeIdentity(player.username))) ||
      (player.phone && myPhones.has(normalizePhone(player.phone)))
    );
  });
}

function findMyCanonicalCaptainTeam() {
  return canonicalTeams.find((team) => teamMatchesCurrentCaptain(team)) || null;
}

function findMyCanonicalTeam() {
  const acceptedRequestId = String(currentAcceptedInvite?.requestId || "").trim();
  if (acceptedRequestId) {
    const byRequest = canonicalTeams.find(
      (team) => String(team?.requestId || "").trim() === acceptedRequestId
    );
    if (byRequest) return byRequest;
  }

  return canonicalTeams.find((team) => teamContainsCurrentUser(team)) || null;
}

function getActiveDisplayTeam() {
  return currentCanonicalTeam || currentCaptainSubmission || currentAcceptedInvite || null;
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

  function saveDraft(showMessage = true) {
    const payload = {
      teamName: teamNameInput.value.trim(),
      categoryId: tournamentMeta?.tournamentType === "team" ? TEAM_EVENT_CATEGORY_ID : categorySelect.value,
      playerIds: getSelectedValues(),
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem(draftKey, JSON.stringify(payload));
    if (showMessage) alert("Draft saved.");
  }

  async function hydrateSubmissionState() {
  teamRequestsCache = await loadTeamRequestsForTournament();
  canonicalTeams = await loadCanonicalTeamsForTournament();

  const captainState = await loadCaptainStateForTournament();

  if (captainState && tournamentMeta) {
    tournamentMeta.captainState = captainState;
  }

  const confirmedCaptains = Array.isArray(captainState?.confirmedCaptains)
    ? captainState.confirmedCaptains
    : [];

  const myCaptainRequest = teamRequestsCache.find((req) => isSameCaptain(req, user));

  const myPlayerIds = getMyTournamentPlayerIds();

  const myConfirmedCaptain = confirmedCaptains.find((c) => {
    return (
      (c?.playerId && myPlayerIds.has(String(c.playerId))) ||
      (c?.captainPlayerId && myPlayerIds.has(String(c.captainPlayerId))) ||
      identitiesMatch(c?.username, user?.username) ||
      identitiesMatch(c?.captainUsername, user?.username) ||
      identitiesMatch(c?.playerName, user?.name) ||
      identitiesMatch(c?.playerName, user?.username)
    );
  });

  if (myCaptainRequest) {
    currentUserIsCaptain = true;
    currentCaptainSubmission = normalizeTeamRequest(myCaptainRequest);
  } else if (myConfirmedCaptain) {
    currentUserIsCaptain = true;
    currentCaptainSubmission = normalizeTeamRequest({
      captainName: myConfirmedCaptain.playerName || user.name || user.username || "Captain",
      captainUsername: myConfirmedCaptain.username || user.username || "",
      captainPlayerId: myConfirmedCaptain.playerId || "",
      categoryId: myConfirmedCaptain.categoryId || "",
      teamName: myConfirmedCaptain.teamName || "",
      invitedPlayers: [],
      categoryLabel: tournamentMeta?.tournamentType === "team" ? "Team event" : "",
    });
  } else {
    currentUserIsCaptain = false;
    currentCaptainSubmission = null;
  }

  const acceptedInvite = teamRequestsCache.find((req) => requestHasAcceptedInviteForCurrentUser(req));

  currentAcceptedInvite = acceptedInvite ? normalizeTeamRequest(acceptedInvite) : null;
  if (currentUserIsCaptain) {
    currentCanonicalTeam = findMyCanonicalCaptainTeam();
  } else {
    currentCanonicalTeam = findMyCanonicalTeam();
  }
}

  function getRuleForCategory(category) {
    if (!tournamentMeta) {
      return {
        mode: "range",
        min: 1,
        max: 1,
        exact: 1,
        text: "Select players.",
      };
    }

    const rules = safeJson(tournamentMeta?.tournamentRules, tournamentMeta?.tournamentRules) || {};
    const minPlayersPerTeam = Number(rules.minPlayersPerTeam || 1);
    const maxPlayersPerTeam = Number(rules.maxPlayersPerTeam || 1);

    if (tournamentMeta?.tournamentType === "team") {
      return {
        mode: minPlayersPerTeam === maxPlayersPerTeam ? "exact" : "range",
        min: minPlayersPerTeam,
        max: maxPlayersPerTeam,
        exact: minPlayersPerTeam,
        text:
          minPlayersPerTeam === maxPlayersPerTeam
            ? `Select exactly ${minPlayersPerTeam} players including captain.`
            : `Select ${minPlayersPerTeam} to ${maxPlayersPerTeam} players including captain.`,
      };
    }

    const teamSize = Number(category?.teamSize || 1);
    const exactTeamSize = Number(category?.exactTeamSize || 0);

    if (teamSize >= 4 && exactTeamSize >= 4) {
      return {
        mode: "exact",
        min: exactTeamSize,
        max: exactTeamSize,
        exact: exactTeamSize,
        text: `Select exactly ${exactTeamSize} players including captain.`,
      };
    }

    return {
      mode: "exact",
      min: teamSize,
      max: teamSize,
      exact: teamSize,
      text: `Select exactly ${teamSize} players including captain.`,
    };
  }

  function updateRuleUi() {
    if (!ruleTextEl || !ruleValueEl || !selectedCountEl || !requiredCountEl) return;

    ruleTextEl.textContent = currentRule.text || "Choose players to continue.";

    if (currentRule.mode === "exact") {
      ruleValueEl.textContent = `Exactly ${currentRule.exact}`;
      requiredCountEl.textContent = String(currentRule.exact);
    } else {
      ruleValueEl.textContent = `${currentRule.min} to ${currentRule.max}`;
      requiredCountEl.textContent = `${currentRule.min}-${currentRule.max}`;
    }

    const selected = getSelectedValues().length + 1;
    selectedCountEl.textContent = String(selected);
  }

  function makePlayerOptions(categoryId, currentValue = "") {
    const players = getSelectablePlayersForTeam(categoryId);
    const selected = new Set(getSelectedValues());

    return players
      .filter((p) => {
        const id = String(getPlayerId(p));
        return !selected.has(id) || id === String(currentValue);
      })
      .map((p) => {
        const id = String(getPlayerId(p));
        return `<option value="${escapeHtml(id)}">${escapeHtml(getPlayerName(p))}</option>`;
      })
      .join("");
  }

  function getSelectedValues() {
    return Array.from(teamRowsWrap.querySelectorAll(".team-player-select"))
      .map((select) => select.value)
      .filter(Boolean);
  }

  function renderPlayerRows(values = []) {
    teamRowsWrap.innerHTML = "";

    let categoryId = "";
    if (tournamentMeta?.tournamentType === "team") {
      categoryId = TEAM_EVENT_CATEGORY_ID;
    } else {
      const category = getCurrentCategory();
      categoryId = category ? String(category.categoryId || category.id) : "";
    }

    values.forEach((value, idx) => {
      const row = document.createElement("div");
      row.className = "team-player-row";

      row.innerHTML = `
        <div class="player-slot-label">Player ${idx + 2}</div>
        <div class="player-slot">
          <select class="team-player-select">
            <option value="">Select player</option>
            ${makePlayerOptions(categoryId, value)}
          </select>
        </div>
        <button type="button" class="row-remove-btn" aria-label="Remove player">✕</button>
      `;

      const select = row.querySelector(".team-player-select");
      const removeBtn = row.querySelector(".row-remove-btn");

      select.value = value || "";
      select.addEventListener("change", () => refreshAllPlayerDropdowns());
      removeBtn.addEventListener("click", () => {
        const nextValues = getSelectedValues().filter((_, i) => i !== idx);
        if (currentRule.mode === "range" && nextValues.length + 1 < currentRule.min) {
          alert(`Minimum ${currentRule.min} players are required.`);
          return;
        }
        renderPlayerRows(nextValues);
        updateRuleUi();
      });

      teamRowsWrap.appendChild(row);
    });

    refreshAllPlayerDropdowns();
    updateRuleUi();
  }

  function refreshAllPlayerDropdowns() {
    const category = getCurrentCategory();
    const categoryId =
      tournamentMeta?.tournamentType === "team"
        ? TEAM_EVENT_CATEGORY_ID
        : (category ? String(category.categoryId || category.id) : "");

    if (!categoryId && tournamentMeta?.tournamentType !== "team") return;

    const selects = Array.from(teamRowsWrap.querySelectorAll(".team-player-select"));
    selects.forEach((select) => {
      const current = select.value;
      select.innerHTML = `
        <option value="">Select player</option>
        ${makePlayerOptions(categoryId, current)}
      `;
      select.value = current;
    });

    selectedCountEl.textContent = String(getSelectedValues().length + 1);
  }

  function populateCategoryDropdown() {
    if (!categorySelect) return;
    const categories = normalizeCategories(tournamentMeta?.categories);
    const seenIds = new Set();
    const seenLabels = new Set();

    categorySelect.innerHTML = `<option value="">Select category</option>`;

    categories.forEach((category) => {
      const id = String(category.categoryId || category.id || "").trim();
      if (!id || seenIds.has(id)) return;

      const label = categoryLabel(category);
      const labelKey = label.trim().toLowerCase();
      if (seenLabels.has(labelKey)) return;

      seenIds.add(id);
      seenLabels.add(labelKey);

      const option = document.createElement("option");
      option.value = id;
      option.textContent = label;
      categorySelect.appendChild(option);
    });
  }

  function getCaptainPlayerIdForPayload() {
    const mine = getMyTournamentPlayerRecords();
    const exact = mine.find((p) => identitiesMatch(p?.username, user?.username));
    return String(getPlayerId(exact || mine[0] || "") || "");
  }

  function buildMemberCards(activeTeam) {
  const cards = [];
  const canonicalPlayers = getCanonicalTeamPlayers(activeTeam);

  const captainCard =
    canonicalPlayers.find((player) => player.isCaptain) || {
      playerName: activeTeam?.captainName || "-",
      inviteStatus: "accepted",
      isCaptain: true,
    };

  cards.push(`
    <div class="my-team-player-card">
      <div class="my-team-player-left">
        <div class="my-team-player-name">${escapeHtml(captainCard.playerName || "-")}</div>
        <div class="my-team-player-meta">Captain</div>
      </div>
      <div class="status-pill status-pill--accepted">captain</div>
    </div>
  `);

  const nonCaptainPlayers = canonicalPlayers.filter((player) => {
    if (player.isCaptain) return false;
    return !canonicalPlayersOverlap(player, captainCard);
  });

  if (nonCaptainPlayers.length) {
    nonCaptainPlayers.forEach((player) => {
      const status = String(player?.inviteStatus || "accepted").toLowerCase();
      const statusClass =
        status === "accepted"
          ? "status-pill status-pill--accepted"
          : status === "rejected"
            ? "status-pill status-pill--rejected"
            : "status-pill status-pill--pending";

      cards.push(`
        <div class="my-team-player-card">
          <div class="my-team-player-left">
            <div class="my-team-player-name">${escapeHtml(player.playerName || "Player")}</div>
            <div class="my-team-player-meta">${escapeHtml(player.phone || "")}</div>
          </div>
          <div class="${statusClass}">${escapeHtml(status)}</div>
        </div>
      `);
    });

    return cards.join("");
  }

  const invitedPlayers = (Array.isArray(activeTeam?.invitedPlayers) ? activeTeam.invitedPlayers : []).filter((player) => {
    const playerName = player?.playerName || player?.inviteeName || player?.name || player?.username || "";
    const playerUsername = player?.username || player?.inviteeUsername || "";
    return !(
      identitiesMatch(playerName, activeTeam?.captainName) ||
      identitiesMatch(playerUsername, activeTeam?.captainUsername)
    );
  });
  invitedPlayers.forEach((player) => {
    const status = String(player?.inviteStatus || "pending").toLowerCase();
    const statusClass =
      status === "accepted"
        ? "status-pill status-pill--accepted"
        : status === "rejected"
          ? "status-pill status-pill--rejected"
          : "status-pill status-pill--pending";

    cards.push(`
      <div class="my-team-player-card">
        <div class="my-team-player-left">
          <div class="my-team-player-name">${escapeHtml(player.playerName || player.inviteeName || player.name || player.username || "Player")}</div>
          <div class="my-team-player-meta">${escapeHtml(player.phone || player.playerPhone || "")}</div>
        </div>
        <div class="${statusClass}">${escapeHtml(status)}</div>
      </div>
    `);
  });

  return cards.join("");
}

function renderMyTeamPanel() {
  myTeamPlayerListEl.innerHTML = "";

  const activeTeam = getActiveDisplayTeam();

  if (!activeTeam) {
    myTeamNameEl.textContent = "-";
    myTeamCaptainEl.textContent = "-";
    myTeamRoleEl.textContent = currentUserIsCaptain ? "Captain" : "Player";
    myTeamCategoryEl.textContent = "-";
    myTeamEmptyStateEl.classList.remove("hidden");
    myTeamEmptyTextEl.textContent = currentUserIsCaptain
      ? "You have not submitted a team for this tournament yet."
      : "You are not part of any accepted team for this tournament yet.";
    return;
  }

  myTeamEmptyStateEl.classList.add("hidden");
  myTeamNameEl.textContent = activeTeam.teamName || "-";
  myTeamCaptainEl.textContent = activeTeam.captainName || "-";
  myTeamRoleEl.textContent = currentUserIsCaptain ? "Captain" : "Player";
  myTeamCategoryEl.textContent =
    activeTeam.categoryLabel ||
    (tournamentMeta?.tournamentType === "team" ? "Team event" : "-");

  myTeamPlayerListEl.innerHTML = buildMemberCards(activeTeam);
}

  function hydratePage() {
    tournamentNameEl.textContent = tournamentMeta?.tournamentName || "-";
    tournamentSportEl.textContent = tournamentMeta?.sportName || "-";
    tournamentDatesEl.textContent = tournamentMeta?.tournamentDates || "-";

const draft = loadDraft();

const hydratedTeamName =
  draft?.teamName ||
  currentCanonicalTeam?.teamName ||
  currentCaptainSubmission?.teamName ||
  currentAcceptedInvite?.teamName ||
  "";

if (teamNameInput) {
  teamNameInput.value = hydratedTeamName;
}


    if (tournamentMeta?.tournamentType === "team") {
      categoryWrap?.classList.add("hidden");
    } else {
      categoryWrap?.classList.remove("hidden");
      populateCategoryDropdown();
      if (draft?.categoryId) categorySelect.value = draft.categoryId;
    }

    const category = getCurrentCategory();
    currentRule = getRuleForCategory(category);
    updateRuleUi();

    if (tournamentMeta?.tournamentType === "team") {
      renderPlayerRows(Array.isArray(draft?.playerIds) ? draft.playerIds : []);
    } else if (draft?.categoryId && category) {
      renderPlayerRows(Array.isArray(draft.playerIds) ? draft.playerIds : []);
    } else {
      teamRowsWrap.innerHTML = "";
      updateRuleUi();
    }

    if (currentUserIsCaptain) {
  const rosterCount = getCanonicalTeamPlayers(currentCanonicalTeam).filter((player) => !player.isCaptain).length;
  pageTitleEl.textContent = rosterCount ? "Create / Manage team" : "Create team";
  pageSubtitleEl.textContent = "Invite players to your team and manage pending team requests.";
  createTeamTabBtn?.classList.remove("hidden");
  lineupTabBtn?.classList.toggle("hidden", !isPickleballLeagueMode());
} else if (currentCanonicalTeam || currentAcceptedInvite) {
  pageTitleEl.textContent = "My team";
  pageSubtitleEl.textContent = "View the team you are part of for this tournament.";
  createTeamTabBtn?.classList.add("hidden");
  lineupTabBtn?.classList.add("hidden");
} else {
  pageTitleEl.textContent = "My team";
  pageSubtitleEl.textContent = "View your team or manage invites if you are the captain.";
  createTeamTabBtn?.classList.add("hidden");
  lineupTabBtn?.classList.add("hidden");
}

    renderMyTeamPanel();
    renderMyMatchesTab();
  }

  categorySelect?.addEventListener("change", () => {
    if (tournamentMeta?.tournamentType === "team") return;
    const category = getCurrentCategory();
    currentRule = getRuleForCategory(category);
    renderPlayerRows([]);
    updateRuleUi();
  });

  addPlayerRowBtn?.addEventListener("click", () => {
    let categoryId = "";

    if (tournamentMeta?.tournamentType === "team") {
      categoryId = TEAM_EVENT_CATEGORY_ID;
    } else {
      const category = getCurrentCategory();
      categoryId = category ? String(category.categoryId || category.id) : "";
      if (!categoryId) {
        alert("Please select a category first.");
        return;
      }
    }

    const selectedValues = getSelectedValues();
    const currentTotal = selectedValues.length + 1;
    if (currentTotal >= currentRule.max) {
      alert(`You can add maximum ${currentRule.max} players including captain.`);
      return;
    }

    renderPlayerRows([...selectedValues, ""]);
    updateRuleUi();
  });

  saveDraftBtn?.addEventListener("click", () => {
    saveDraft(true);
  });

  teamForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!currentUserIsCaptain) {
      alert("Only captains can create or edit a team.");
      return;
    }

    let categoryId = "";
    let category = null;

    if (tournamentMeta?.tournamentType === "team") {
      categoryId = TEAM_EVENT_CATEGORY_ID;
    } else {
      category = getCurrentCategory();
      categoryId = category ? String(category.categoryId || category.id) : "";
      if (!categoryId) {
        alert("Please select a category.");
        return;
      }
    }

    const selectedValues = getSelectedValues();
    if (new Set(selectedValues).size !== selectedValues.length) {
      alert("Same player cannot be selected twice.");
      return;
    }

    if (currentRule.mode === "exact") {
      if (selectedValues.length !== currentRule.exact - 1) {
        alert(`Please select exactly ${currentRule.exact - 1} other players. Captain is already included.`);
        return;
      }
    } else {
      const totalWithCaptain = selectedValues.length + 1;
      if (totalWithCaptain < currentRule.min) {
        alert(`Please select at least ${currentRule.min - 1} other players.`);
        return;
      }
      if (totalWithCaptain > currentRule.max) {
        alert(`Please select at most ${currentRule.max - 1} other players.`);
        return;
      }
    }

    const playerPool =
      tournamentMeta?.tournamentType === "team"
        ? getAcceptedPlayers()
        : getPlayersForCategory(categoryId);

    const selectedPlayers = selectedValues
      .map((id) => playerPool.find((p) => String(getPlayerId(p)) === String(id)))
      .filter(Boolean);

    const captainName = user.name || user.username || "";
    const captainUsername = user.username || "";
    const captainPlayerId = getCaptainPlayerIdForPayload();

    const invitedPlayers = selectedPlayers.map((player) => ({
      playerId: String(getPlayerId(player)),
      playerName: getPlayerName(player),
      inviteeName: getPlayerName(player),
      username: player.username || "",
      inviteeUsername: player.username || "",
      phone: player.phone || player.playerPhone || "",
      inviteStatus: "pending",
    }));

    const payload = {
      tournamentId,
      teamName:
  teamNameInput.value.trim() ||
  currentCanonicalTeam?.teamName ||
  currentCaptainSubmission?.teamName ||
  currentAcceptedInvite?.teamName ||
  "My Team",
      categoryId,
      categoryLabel:
        tournamentMeta?.tournamentType === "team"
          ? "Team event"
          : (category ? categoryLabel(category) : ""),
      captainName,
      captainUsername,
      captainPlayerId,
      createdBy: captainUsername || captainName,
      invitedPlayers,
      tournamentName: tournamentMeta?.tournamentName || "",
    };

    const candidates = [
      `/api/host/tournaments/${encodeURIComponent(tournamentId)}/team-requests`,
      `/api/tournaments/${encodeURIComponent(tournamentId)}/team-requests`,
    ];

    for (const url of candidates) {
      const result = await apiPost(url, payload);
      if (result.ok) {
        localStorage.removeItem(draftKey);
        alert("Team request created successfully.");
        await hydrateSubmissionState();
        await loadMyMatches();
        hydratePage();
        await renderLineupTab();
        return;
      }
    }

    alert("Could not create team request. Please verify backend route.");
  });

  function getMyActiveTeamForLineup() {
  return currentCanonicalTeam || currentCaptainSubmission || currentAcceptedInvite || null;
}

 function getTeamRosterForLineup(payloadTeam = null) {
  const rosterNames = [];
  const activeTeam = getMyActiveTeamForLineup();

  const canonicalPlayers = getCanonicalTeamPlayers(payloadTeam || currentCanonicalTeam);

  if (canonicalPlayers.length) {
    canonicalPlayers.forEach((player) => {
      if (player.isCaptain || player.inviteStatus === "accepted") {
        const name = String(player.playerName || "").trim();
        if (name) rosterNames.push(name);
      }
    });
  } else {
    if (activeTeam?.captainName) rosterNames.unshift(String(activeTeam.captainName).trim());

    const invited = Array.isArray(activeTeam?.invitedPlayers) ? activeTeam.invitedPlayers : [];
    invited.forEach((player) => {
      if (String(player?.inviteStatus || "").toLowerCase() !== "accepted") return;
      const name = String(
        player?.playerName || player?.inviteeName || player?.name || player?.username || ""
      ).trim();
      if (name) rosterNames.push(name);
    });
  }

  const seen = new Set();
  return rosterNames.filter((name) => {
    const key = normalizeIdentity(name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

  function getCategoryDefinitionsForLineup() {
    const categories = normalizeCategories(tournamentMeta?.categories);
    if (categories.length) return categories;
    const count = Math.max(1, Number(getAdvancedSettingsSafe()?.tieSubmatchCount || 1));
    return Array.from({ length: count }, (_, index) => ({
      categoryId: `CAT-${index + 1}`,
      eventName: `Category ${index + 1}`,
      teamSize: 1,
    }));
  }

  function getRequiredSlotsForCategory(categoryDef) {
    const teamSize = Number(categoryDef?.teamSize || 1);
    const exactTeamSize = Number(categoryDef?.exactTeamSize || 0);
    if (teamSize >= 4 && exactTeamSize >= 4) return exactTeamSize;
    return Math.max(1, teamSize);
  }

  function getMaxMatchesPerPlayer() {
    const rules = safeJson(tournamentMeta?.tournamentRules, tournamentMeta?.tournamentRules) || {};
    const raw = Number(rules?.maxMatchesPerPlayer || 0);
    return Number.isFinite(raw) && raw > 0 ? raw : null;
  }

  function getParticipationRuleText() {
    const rule = String(getAdvancedSettingsSafe()?.participationRule || "").trim();
    if (!rule) return "";
    if (rule === "all_bench_must_play_once") {
      return "Each player should appear at least once across all league matches.";
    }
    return rule.replace(/_/g, " ");
  }

  function getMySideForTie(tie) {
    return tie?.mySide === "away" ? "away" : "home";
  }

  function getSavedAssignmentsForTie(tie) {
    const side = getMySideForTie(tie);
    const assignments = tie?.lineups?.[side]?.assignments;
    return Array.isArray(assignments) ? assignments : [];
  }

  function extractPlayersFromAssignment(assignment) {
    if (!assignment || typeof assignment !== "object") return [];
    if (Array.isArray(assignment.players)) return assignment.players.filter(Boolean).map(String);
    if (Array.isArray(assignment.playerNames)) return assignment.playerNames.filter(Boolean).map(String);
    return [];
  }

  function buildParticipationCounts(ties, currentTieId = "", currentDraftAssignments = null) {
    const counts = new Map();

    ties.forEach((tie) => {
      const assignments =
        currentTieId && String(tie.tieId || tie.matchId || "") === String(currentTieId) && Array.isArray(currentDraftAssignments)
          ? currentDraftAssignments
          : getSavedAssignmentsForTie(tie);

      assignments.forEach((assignment) => {
        extractPlayersFromAssignment(assignment).forEach((playerName) => {
          const key = normalizeIdentity(playerName);
          counts.set(key, (counts.get(key) || 0) + 1);
        });
      });
    });

    return counts;
  }

  function allMyTiesHaveLineup(ties, currentTieId = "", currentDraftAssignments = null) {
    return ties.every((tie) => {
      const isCurrent = currentTieId && String(tie.tieId || tie.matchId || "") === String(currentTieId);
      const assignments = isCurrent && Array.isArray(currentDraftAssignments)
        ? currentDraftAssignments
        : getSavedAssignmentsForTie(tie);

      return Array.isArray(assignments) && assignments.some((assignment) => extractPlayersFromAssignment(assignment).length > 0);
    });
  }

  function validateTieAssignments(tie, draftAssignments, categoryDefs, rosterNames, allTies) {
    const maxMatchesPerPlayer = getMaxMatchesPerPlayer();
    const appearanceCountsThisTie = new Map();

    for (let i = 0; i < draftAssignments.length; i += 1) {
      const assignment = draftAssignments[i];
      const players = extractPlayersFromAssignment(assignment);
      const requiredSlots = getRequiredSlotsForCategory(categoryDefs[i] || {});
      const dedupSet = new Set(players.map(normalizeIdentity));

      if (players.length !== requiredSlots) {
        return { ok: false, message: `Submatch ${i + 1} needs exactly ${requiredSlots} player(s).` };
      }

      if (dedupSet.size !== players.length) {
        return { ok: false, message: `Same player cannot be repeated inside submatch ${i + 1}.` };
      }

      for (const playerName of players) {
        const key = normalizeIdentity(playerName);
        if (!rosterNames.some((name) => normalizeIdentity(name) === key)) {
          return { ok: false, message: `${playerName} is not part of your accepted team roster.` };
        }
        appearanceCountsThisTie.set(key, (appearanceCountsThisTie.get(key) || 0) + 1);
      }
    }

    if (maxMatchesPerPlayer) {
      for (const [playerKey, count] of appearanceCountsThisTie.entries()) {
        if (count > maxMatchesPerPlayer) {
          const actualName = rosterNames.find((name) => normalizeIdentity(name) === playerKey) || "Player";
          return {
            ok: false,
            message: `${actualName} can play maximum ${maxMatchesPerPlayer} submatch(es) against this team.`,
          };
        }
      }
    }

    const participationCounts = buildParticipationCounts(
      allTies,
      String(tie.tieId || tie.matchId || ""),
      draftAssignments
    );

    const ifFinalSave = allMyTiesHaveLineup(
      allTies,
      String(tie.tieId || tie.matchId || ""),
      draftAssignments
    );

    if (ifFinalSave && isPickleballLeagueMode()) {
      const missing = rosterNames.filter((name) => (participationCounts.get(normalizeIdentity(name)) || 0) < 1);
      if (missing.length) {
        return {
          ok: false,
          message: `Before completing all league lineups, every player should play at least once. Missing: ${missing.join(", ")}`,
        };
      }
    }

    return { ok: true };
  }

  function buildPlayerSelectHtml(options, selectedValue = "", label = "Player") {
    return `
      <div class="field-group">
        <label>${escapeHtml(label)}</label>
        <select class="lineup-player-select">
          <option value="">Select player</option>
          ${options
            .map((name) => {
              const selected = normalizeIdentity(name) === normalizeIdentity(selectedValue);
              return `<option value="${escapeHtml(name)}" ${selected ? "selected" : ""}>${escapeHtml(name)}</option>`;
            })
            .join("")}
        </select>
      </div>
    `;
  }

  function formatPlayersInline(players) {
    const cleaned = (Array.isArray(players) ? players : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    return cleaned.length ? cleaned.join(" + ") : "Not submitted yet";
  }

  function formatSubmittedAt(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const dt = new Date(raw);
    if (Number.isNaN(dt.getTime())) return "";
    return dt.toLocaleString([], {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function renderParticipationSummary(ties, rosterNames) {
    if (!lineupParticipationSummaryEl) return;

    const counts = buildParticipationCounts(ties);
    const participationRule = getParticipationRuleText();

    if (!rosterNames.length) {
      lineupParticipationSummaryEl.classList.add("hidden");
      lineupParticipationSummaryEl.innerHTML = "";
      return;
    }

    lineupParticipationSummaryEl.classList.remove("hidden");
    lineupParticipationSummaryEl.innerHTML = `
      <div class="rules-box">
        <h3>League participation tracker</h3>
        <p class="helper-text">${escapeHtml(participationRule || "Track how many times each player has appeared across all submitted match lineups.")}</p>
      </div>
      ${rosterNames.map((name) => {
        const count = counts.get(normalizeIdentity(name)) || 0;
        const pill = count > 0 ? "status-pill status-pill--accepted" : "status-pill status-pill--pending";
        return `
          <div class="my-team-player-card">
            <div class="my-team-player-left">
              <div class="my-team-player-name">${escapeHtml(name)}</div>
              <div class="my-team-player-meta">${count} appearance(s) submitted so far</div>
            </div>
            <div class="${pill}">${count > 0 ? "covered" : "pending"}</div>
          </div>
        `;
      }).join("")}
    `;
  }

  function getTieCategoryDefs(tie) {
    const defs = getCategoryDefinitionsForLineup();
    const submatchCount = Array.isArray(tie?.submatches) && tie.submatches.length
      ? tie.submatches.length
      : defs.length;
    return Array.from({ length: submatchCount }, (_, index) => defs[index] || {
      categoryId: `CAT-${index + 1}`,
      eventName: `Category ${index + 1}`,
      teamSize: 1,
    });
  }

  function renderLineupMatches(payload) {
    if (!lineupMatchesListEl) return;

    const team = payload?.team || null;
    const ties = Array.isArray(payload?.ties) ? payload.ties : [];
    const rosterNames = getTeamRosterForLineup(team);

    renderParticipationSummary(ties, rosterNames);

    if (!currentUserIsCaptain) {
      lineupEmptyStateEl?.classList.remove("hidden");
      lineupMatchesListEl.innerHTML = "";
      if (lineupHelpTextEl) lineupHelpTextEl.textContent = "Only the captain can submit match lineups.";
      return;
    }

    if (!ties.length) {
      lineupEmptyStateEl?.classList.remove("hidden");
      lineupMatchesListEl.innerHTML = "";
      return;
    }

    lineupEmptyStateEl?.classList.add("hidden");

    lineupMatchesListEl.innerHTML = ties.map((tie, tieIndex) => {
      const tieId = String(tie.tieId || tie.matchId || `tie-${tieIndex + 1}`);
      const categoryDefs = getTieCategoryDefs(tie);
      const savedAssignments = getSavedAssignmentsForTie(tie);
      const savedAssignmentCount = savedAssignments.filter((item) => extractPlayersFromAssignment(item).length > 0).length;
      const mySide = getMySideForTie(tie);
      const submittedAt = formatSubmittedAt(tie?.lineups?.[mySide]?.submittedAt);

      const slotCards = categoryDefs.map((categoryDef, idx) => {
        const requiredSlots = getRequiredSlotsForCategory(categoryDef);
        const savedAssignment = savedAssignments.find((item) => Number(item?.scoreIndex) === idx) || savedAssignments[idx] || {};
        const savedPlayers = extractPlayersFromAssignment(savedAssignment);
        const selectsHtml = Array.from({ length: requiredSlots }, (_, slotIndex) => {
          return buildPlayerSelectHtml(
            rosterNames,
            savedPlayers[slotIndex] || "",
            requiredSlots === 1 ? "Player" : `Player ${slotIndex + 1}`
          );
        }).join("");

        return `
          <div class="lineup-slot-card" data-submatch-index="${idx}">
            <div class="lineup-slot-title">${escapeHtml(categoryLabel(categoryDef) || categoryDef.eventName || `Submatch ${idx + 1}`)}</div>
            <div class="helper-text">Pick exactly ${requiredSlots} player(s) for this category.</div>
            <div class="lineup-saved-preview ${savedPlayers.length ? '' : 'is-empty'}">
              <strong>Saved lineup:</strong> ${escapeHtml(formatPlayersInline(savedPlayers))}
            </div>
            <div class="lineup-two-col">${selectsHtml}</div>
          </div>
        `;
      }).join("");

      return `
        <div class="lineup-review-card" data-tie-card-id="${escapeHtml(tieId)}">
          <div class="lineup-review-head">
            <div>
              <h3>${escapeHtml(tie.home || "Home")} vs ${escapeHtml(tie.away || "Away")}</h3>
              <p class="helper-text">
                ${escapeHtml(tie.roundLabel || `Match ${tieIndex + 1}`)}
                ${tie.date ? ` • ${escapeHtml(tie.date)}` : ""}
                ${tie.time ? ` • ${escapeHtml(tie.time)}` : ""}
                ${tie.court ? ` • ${escapeHtml(tie.court)}` : ""}
              </p>
              <div class="lineup-match-summary">
                ${savedAssignmentCount}/${categoryDefs.length} submatch lineups saved
                ${submittedAt ? ` • Saved ${escapeHtml(submittedAt)}` : ""}
              </div>
            </div>
            <div class="team-name-chip">${tie.lineupLocked ? "Locked" : savedAssignmentCount ? "Saved" : "Open"}</div>
          </div>

          <div class="lineup-builder-wrap">
            ${slotCards}
          </div>

          <div class="row-actions">
            <button
              type="button"
              class="action-btn accept"
              data-save-lineup="${escapeHtml(tieId)}"
              ${tie.lineupLocked ? "disabled" : ""}
            >
              Save lineup
            </button>
          </div>
        </div>
      `;
    }).join("");

    lineupMatchesListEl.querySelectorAll("[data-save-lineup]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const tieId = btn.getAttribute("data-save-lineup");
        const tie = ties.find((item) => String(item.tieId || item.matchId || "") === String(tieId));
        if (!tie) return;

        const tieCard = lineupMatchesListEl.querySelector(`[data-tie-card-id="${CSS.escape(String(tieId))}"]`);
        if (!tieCard) return;

        const categoryDefs = getTieCategoryDefs(tie);
        const draftAssignments = Array.from(tieCard.querySelectorAll("[data-submatch-index]")).map((card, idx) => {
          const players = Array.from(card.querySelectorAll(".lineup-player-select"))
            .map((select) => String(select.value || "").trim())
            .filter(Boolean);

          return {
            scoreIndex: idx,
            players,
          };
        });

        const rosterNames = getTeamRosterForLineup(payload?.team || null);
        const validation = validateTieAssignments(tie, draftAssignments, categoryDefs, rosterNames, ties);
        if (!validation.ok) {
          if (lineupStatusEl) lineupStatusEl.textContent = validation.message;
          alert(validation.message);
          return;
        }

        const resp = await apiPost(
          `/api/player/tournaments/${encodeURIComponent(tournamentId)}/lineups`,
          {
            categoryId: getCurrentTeamCategoryId(),
            tieId,
            assignments: draftAssignments,
          }
        );

        if (!resp.ok) {
          const message = resp.data?.message || "Failed to save lineup.";
          if (lineupStatusEl) lineupStatusEl.textContent = message;
          alert(message);
          return;
        }

        if (lineupStatusEl) {
          lineupStatusEl.textContent = `Lineup saved for ${tie.home || "Home"} vs ${tie.away || "Away"}.`;
        }
        await renderLineupTab();
      });
    });
  }

  async function renderLineupTab() {
    if (!lineupMatchesListEl || !lineupTabBtn) return;

    lineupMatchesListEl.innerHTML = "";
    if (lineupStatusEl) lineupStatusEl.textContent = "";

    if (!currentUserIsCaptain || !isPickleballLeagueMode()) {
      lineupTabBtn.classList.add("hidden");
      lineupEmptyStateEl?.classList.remove("hidden");
      if (lineupParticipationSummaryEl) {
        lineupParticipationSummaryEl.classList.add("hidden");
        lineupParticipationSummaryEl.innerHTML = "";
      }
      if (lineupHelpTextEl) {
        lineupHelpTextEl.textContent = currentUserIsCaptain
          ? "This lineup flow is enabled only for pickleball team league."
          : "Only captains can submit match lineups.";
      }
      return;
    }

    lineupTabBtn.classList.remove("hidden");
    if (lineupHelpTextEl) {
      lineupHelpTextEl.textContent =
        "Captain sees all scheduled matches here. Under each match, submit category-wise submatch lineups.";
    }

    const categoryId = getCurrentTeamCategoryId() || TEAM_EVENT_CATEGORY_ID;
    const resp = await apiGet(
      `/api/player/tournaments/${encodeURIComponent(tournamentId)}/lineups?categoryId=${encodeURIComponent(categoryId)}`
    );

    if (!resp.ok) {
      lineupEmptyStateEl?.classList.remove("hidden");
      if (lineupStatusEl) {
        lineupStatusEl.textContent = resp.data?.message || "Host has not generated league fixtures yet.";
      }
      return;
    }

    renderLineupMatches(resp.data || {});
  }

  tournamentMeta = await loadTournamentMeta();
  if (!tournamentMeta) {
    alert("Could not load tournament.");
    window.location.href = "join.html";
    return;
  }

  allPlayers = await loadPlayers();
  await hydrateSubmissionState();
  await loadMyMatches();
  hydratePage();
  await renderLineupTab();
});
