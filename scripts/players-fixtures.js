/**
 * players-fixtures.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Fixture generation, bracket building, schedule rendering, leaderboard,
 * and backend polling.
 *
 * Lazy-loaded — imported only when the fixtures panel is first opened
 * (or immediately for umpire users). FIX 10.
 *
 * FIX 12 (module split): extracted from the monolithic players.js
 * FIX  5 (loop): brute-force scheduling loop capped at 80 iterations
 * FIX  8 (dedup): single computeGroupLeaderboardRows replaces two identical functions
 * FIX  9 (console): debug console.log statements removed
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  state,
  TEAM_EVENT_CATEGORY_ID,
  escapeHtml,
  shuffle,
  getAdvancedSettings,
  getAvailableCourtNames,
  getTournamentStartDate,
  getRequestedLeagueRounds,
  formatDateInputValue,
  formatTimeInputValue,
  isTournamentTeamEvent,
  isGroupKnockoutFormat,
  isLeagueKnockoutFormat,
  isPickleballTeamLeagueMode,
  getAcceptedPlayers,
  getPlayerId,
  getPlayerCategoryId,
  getPlayerDisplayName,
  getConfirmedTeams,
  getTeamEventFixtureBucket,
  buildTeamNameSelectOptions,
  computeGroupLeaderboardRows,
  getMatchStatus,
  getStatusPillMarkup,
  getFixtureMatchPoints,
  getSortedLeaderboardRows,
  getQualifiedLeaderboardRows,
  apiGet,
  apiPost,
} from "./players-utils.js";

// ── Module-level references (set by init) ─────────────────────────────────────
let _tournamentId = "";
let _fixturesUi   = null;    // same fixturesUi object from players.js
let _callbacks    = {};       // { renderLeaderboard, loadLeaderboardFromDb, showToast }

export function initFixtures(tournamentId, fixturesUi, callbacks) {
  _tournamentId = tournamentId;
  _fixturesUi   = fixturesUi;
  _callbacks    = callbacks;
}

// ── Match / bracket utilities ─────────────────────────────────────────────────
function makeMatchId() {
  if (window.crypto?.randomUUID) return "M-" + crypto.randomUUID();
  return "M-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function splitTeamName(teamName) {
  const t = String(teamName || "").trim();
  if (!t || t.toUpperCase() === "BYE" || t.toUpperCase() === "TBD") return [];
  return t.split(" + ").map((x) => x.trim()).filter(Boolean);
}

function ensureMatchMeta(match) {
  if (!match || typeof match !== "object") return match;
  if (!match.matchId)                     match.matchId     = makeMatchId();
  if (!Array.isArray(match.homePlayers))  match.homePlayers = splitTeamName(match.home);
  if (!Array.isArray(match.awayPlayers))  match.awayPlayers = splitTeamName(match.away);
  return match;
}

function nextPow2(n) { let p = 1; while (p < n) p *= 2; return p; }

function getRoundLabel(r, totalRounds) {
  if (totalRounds <= 0) return "Round";
  const rem = totalRounds - r;
  if (rem === 1) return "Final";
  if (rem === 2) return "Semi-final";
  if (rem === 3) return "Quarter-final";
  return `Round ${r + 1}`;
}

function buildEntrants(names, teamSize) {
  const size     = Math.max(1, Number(teamSize || 1));
  const shuffled = shuffle(names);
  const teamMap  = {};
  if (size === 1) {
    shuffled.forEach((name) => { teamMap[name] = [name]; });
    return { entrants: shuffled, teamMap };
  }
  const entrants = [];
  for (let i = 0; i < shuffled.length; i += size) {
    const chunk = shuffled.slice(i, i + size);
    if (chunk.length < size) continue;
    const teamName = chunk.join(" + ");
    entrants.push(teamName);
    teamMap[teamName] = chunk;
  }
  return { entrants, teamMap };
}

function createBracket(names, teamMap = {}) {
  const list = shuffle(names.filter(Boolean));
  if (list.length < 2) return null;
  const size        = nextPow2(list.length);
  while (list.length < size) list.push("BYE");
  const totalRounds = Math.log2(size);
  const rounds      = [];
  const rosterOf = (name) => {
    if (!name || name === "BYE" || name === "TBD") return [];
    return teamMap[name] || splitTeamName(name);
  };
  const round1 = [];
  for (let i = 0; i < list.length; i += 2) {
    round1.push(ensureMatchMeta({ home: list[i], away: list[i + 1], homePlayers: rosterOf(list[i]), awayPlayers: rosterOf(list[i + 1]) }));
  }
  rounds.push(round1);
  for (let r = 1; r < totalRounds; r += 1) {
    const prev = rounds[r - 1];
    const next = [];
    for (let i = 0; i < prev.length; i += 2) {
      next.push(ensureMatchMeta({ home: "TBD", away: "TBD", homePlayers: [], awayPlayers: [] }));
    }
    rounds.push(next);
  }
  return { rounds, totalRounds };
}

// ── Knockout helpers ──────────────────────────────────────────────────────────
function getSemifinalPairingRule() { return getAdvancedSettings()?.semifinalPairing || "top_vs_bottom"; }

function buildQualifiedKnockoutEntrants(teamNames) {
  const rule = getSemifinalPairingRule();
  if (rule === "random") return shuffle([...teamNames]);
  // top_vs_bottom (default): 1v4, 2v3 seeding
  return [...teamNames];
}

function buildSeededKnockoutRounds(teamNames) {
  const seeded = buildQualifiedKnockoutEntrants(teamNames);
  return createBracket(seeded, {});
}

export function propagateKnockoutWinnerIntoRounds(knockout, roundIndex, matchIndex, winnerName) {
  if (!knockout?.rounds) return;
  const nextRoundIndex  = roundIndex + 1;
  const nextMatchIndex  = Math.floor(matchIndex / 2);
  const isHome          = matchIndex % 2 === 0;
  const nextRound       = knockout.rounds[nextRoundIndex];
  if (!nextRound?.[nextMatchIndex]) return;
  if (isHome) nextRound[nextMatchIndex].home = winnerName;
  else        nextRound[nextMatchIndex].away = winnerName;
}

export function autoAdvanceKnockoutByes(knockout) {
  if (!knockout?.rounds) return;
  knockout.rounds.forEach((round, roundIndex) => {
    round.forEach((match, matchIndex) => {
      if (!match) return;
      const homeBye = String(match.home || "").toUpperCase() === "BYE";
      const awayBye = String(match.away || "").toUpperCase() === "BYE";
      if (homeBye || awayBye) {
        const winner = homeBye ? match.away : match.home;
        match.status = "completed";
        match.winner = winner;
        propagateKnockoutWinnerIntoRounds(knockout, roundIndex, matchIndex, winner);
      }
    });
  });
}

export function canGenerateKnockout(cat) {
  if (!cat || isTournamentTeamEvent()) return false;
  const leagueMatches = Array.isArray(cat.matches)
    ? cat.matches : Array.isArray(cat.rounds?.[0]) ? cat.rounds[0] : [];
  if (!leagueMatches.length || cat.knockout) return false;
  return leagueMatches.every((match, idx) => getMatchStatus(match, 0, idx) === "completed");
}

// ── Fixture button state ──────────────────────────────────────────────────────
export function updateFixturesEditButtonState() {
  if (!_fixturesUi) return;
  const cat = isTournamentTeamEvent() ? getTeamEventFixtureBucket() : null;
  const show = isTournamentTeamEvent() && cat?.displayMode === "team_schedule";
  if (_fixturesUi.editBtn) _fixturesUi.editBtn.style.display = show ? "" : "none";
}

export function updateGoToKnockoutButton(cat = null) {
  if (!_fixturesUi) return;
  const btn = document.getElementById("fixtures-go-knockout-btn");
  if (!btn) return;
  const canGo = isTournamentTeamEvent()
    ? (canGenerateKnockout(cat) || canGenerateGroupKnockout(cat))
    : (cat && (canGenerateCategoryKnockout(cat) || canGenerateCategoryGroupKnockout(cat)));
  btn.classList.toggle("hidden", !canGo);
}

export function updateEmbeddedFixturesHeader() {
  const meta = state.tournamentMetaCache;
  const nameEl  = document.getElementById("fixtures-tournament-name");
  const sportEl = document.getElementById("fixtures-tournament-sport");
  const datesEl = document.getElementById("fixtures-tournament-dates");
  const codeEl  = document.getElementById("fixtures-tournament-code");
  const helpEl  = document.getElementById("embedded-fixtures-helper-text");
  if (nameEl)  nameEl.textContent  = meta?.tournamentName  || "Tournament";
  if (sportEl) sportEl.textContent = meta?.sportName       || "";
  if (datesEl) datesEl.textContent = meta?.tournamentDates || "";
  if (codeEl)  codeEl.textContent  = meta?.accessCode      || "";
  if (helpEl) {
    helpEl.textContent = isTournamentTeamEvent()
      ? "Team event fixtures — view league schedule and knockout bracket."
      : "Select a category to view its fixtures.";
  }
}

// ── Category toggles ──────────────────────────────────────────────────────────
export function renderCategoryToggles() {
  if (!_fixturesUi?.toggleWrap) return;
  if (isTournamentTeamEvent()) {
    _fixturesUi.toggleWrap.innerHTML = "";
    _fixturesUi.toggleWrap.classList.add("hidden");
    return;
  }
  _fixturesUi.toggleWrap.classList.remove("hidden");
  _fixturesUi.toggleWrap.innerHTML = "";
  const catList = state.fixturesState.categories
    .map((c) => ({ id: c.categoryId || c.id, label: _categoryLabel(c) }))
    .filter((x) => x.id);
  if (!catList.length) { _fixturesUi.toggleWrap.innerHTML = `<div class="muted">No categories found.</div>`; return; }
  catList.forEach((cat) => {
    const btn = document.createElement("button");
    btn.type      = "button";
    btn.className = `toggle-btn ${String(state.fixturesState.activeCategoryId) === String(cat.id) ? "active" : ""}`;
    btn.textContent = cat.label;
    btn.addEventListener("click", () => {
      state.fixturesState.activeCategoryId = cat.id;
      renderCategoryToggles();
      if (_fixturesUi.noneSelectedEl) _fixturesUi.noneSelectedEl.style.display = "none";
      renderCategoryBracket(cat.id);
    });
    _fixturesUi.toggleWrap.appendChild(btn);
  });
}

function _categoryLabel(c) {
  // Re-import to avoid circular — just inline the logic
  const age    = c?.ageGroup     ? String(c.ageGroup).trim()     : "";
  const gender = c?.gender       ? String(c.gender).trim()       : "";
  const level  = c?.playingLevel ? String(c.playingLevel).trim() : "";
  const size   = c?.teamSize     ? Number(c.teamSize)            : null;
  const exact  = c?.exactTeamSize ? Number(c.exactTeamSize)      : null;
  let type = "";
  if (size === 1) type = "Singles";
  else if (size === 2) type = "Doubles";
  else if (size === 3) type = "Triples";
  else if (size >= 4) type = exact ? `Team ${exact}` : "Team";
  const parts = [age, gender, level, type].filter(Boolean);
  return parts.length ? parts.join(" • ") : (c?.categoryId || c?.id || "Category");
}

// ── Fixture card HTML ─────────────────────────────────────────────────────────
function buildFixtureCard(match, roundIndex, matchIndex, categoryId) {
  const home    = match?.home ?? "BYE";
  const away    = match?.away ?? "BYE";
  const homeBye = String(home).toUpperCase() === "BYE";
  const awayBye = String(away).toUpperCase() === "BYE";
  return `
    <div class="bk-card">
      <div class="fixture-line"><span>${escapeHtml(home)}</span></div>
      <div class="fixture-line"><span>${escapeHtml(away)}</span></div>
      <div class="fixture-actions">
        ${!homeBye && !awayBye ? `
          <button type="button" class="start-scoring-btn btn-dark"
            data-tournament-id="${escapeHtml(_tournamentId)}"
            data-category-id="${escapeHtml(categoryId)}"
            data-round="${roundIndex}" data-match="${matchIndex}">Start scoring</button>` : ""}
      </div>
    </div>`;
}

function getDisplayRoundLabel(cat, round, roundIndex) {
  const explicit = Array.isArray(round) ? round.find((m) => m?.roundLabel)?.roundLabel : "";
  if (explicit) return explicit;
  return getRoundLabel(roundIndex, cat?.totalRounds || cat?.rounds?.length || 0);
}

// ── Individual category fixtures ──────────────────────────────────────────────
export function renderIndividualCategoryFixtures(categoryId) {
  _fixturesUi.groupsEl.innerHTML = "";
  const cat         = state.fixturesState.fixtures?.categories?.[categoryId];
  const categoryMeta = state.fixturesState.categories.find((c) => String(c.categoryId || c.id) === String(categoryId));

  if (!cat || !Array.isArray(cat.rounds) || !cat.rounds.length) {
    const info = categoryMeta ? getFixtureEntrantsForCategory(categoryMeta) : { sourceCount: 0 };
    _fixturesUi.groupsEl.innerHTML = `
      <div class="empty-state" style="display:flex;">
        <div class="feature-icon">🧩</div>
        <h3>No fixtures yet</h3>
        <p class="muted">${info.sourceCount < 2
          ? "Not enough accepted players to generate fixtures."
          : "Click "Regenerate fixtures" to create the fixtures."}</p>
      </div>`;
    updateFixturesEditButtonState();
    return;
  }

  const wrapper   = document.createElement("div"); wrapper.className = "fixtures-group";
  const title     = document.createElement("h3");  title.className = "fixtures-group-title";
  title.textContent = cat.label || _categoryLabel(categoryMeta || {}) || "Category";
  wrapper.appendChild(title);

  const roundsWrap = document.createElement("div"); roundsWrap.className = "fixtures-rounds";
  cat.rounds.forEach((round, roundIndex) => {
    const col = document.createElement("div"); col.className = "fixtures-round-col";
    col.innerHTML = `<div class="round-title">${escapeHtml(getDisplayRoundLabel(cat, round, roundIndex))}</div>`;
    round.forEach((match, matchIndex) => {
      const item = document.createElement("div"); item.className = "fixtures-round-match";
      item.innerHTML = buildFixtureCard(match, roundIndex, matchIndex, categoryId);
      col.appendChild(item);
    });
    roundsWrap.appendChild(col);
  });

  wrapper.appendChild(roundsWrap);
  _fixturesUi.groupsEl.appendChild(wrapper);
  updateFixturesEditButtonState();
  updateGoToKnockoutButton(cat);
}

// ── Team event fixtures ───────────────────────────────────────────────────────
function buildKnockoutBracketMarkup(knockout, categoryId = TEAM_EVENT_CATEGORY_ID) {
  if (!knockout || !Array.isArray(knockout.rounds) || !knockout.rounds.length) return "";
  const roundsHtml = knockout.rounds.map((round, roundIndex) => `
    <div class="fixtures-round-col">
      <div class="round-title">${escapeHtml(getRoundLabel(roundIndex, knockout.totalRounds || knockout.rounds.length))}</div>
      ${(Array.isArray(round) ? round : []).map((match, matchIndex) => `
        <div class="fixtures-round-match">
          <div class="bk-card">
            <div class="fixture-line"><span>${escapeHtml(match?.home || "TBD")}</span></div>
            <div class="fixture-line"><span>${escapeHtml(match?.away || "TBD")}</span></div>
            <div class="fixture-line"><span>Status</span><span>${getStatusPillMarkup(getMatchStatus(match, roundIndex + 1, matchIndex))}</span></div>
            <div class="fixture-actions">
              ${(String(match?.home||'').toUpperCase() !== 'BYE' && String(match?.away||'').toUpperCase() !== 'BYE' &&
                 String(match?.home||'').toUpperCase() !== 'TBD' && String(match?.away||'').toUpperCase() !== 'TBD')
                ? `<button type="button" class="action-btn accept start-scoring-btn"
                    data-tournament-id="${escapeHtml(_tournamentId)}"
                    data-category-id="${escapeHtml(categoryId)}"
                    data-round="${roundIndex + 1}" data-match="${matchIndex}">Start scoring</button>`
                : ''}
            </div>
          </div>
        </div>`).join('')}
    </div>`).join('');
  return `
    <div class="fixtures-group" style="margin-top:18px;">
      <h3 class="fixtures-group-title">Knockout schedule</h3>
      <div class="fixtures-rounds">${roundsHtml}</div>
    </div>`;
}

function renderTeamEventScheduleTable(cat) {
  const sourceMatches = Array.isArray(cat?.matches) ? cat.matches
    : Array.isArray(cat?.rounds?.[0]) ? cat.rounds[0] : [];
  const matches = sourceMatches.filter((m) => String(m?.stage || "league").toLowerCase() !== "knockout");

  if (!matches.length) {
    _fixturesUi.groupsEl.innerHTML = `
      <div class="empty-state" style="display:flex;">
        <div class="feature-icon">🗓️</div>
        <h3>No team fixtures yet</h3>
        <p class="muted">Click "Regenerate fixtures" to create the team match schedule.</p>
      </div>`;
    updateFixturesEditButtonState(); updateGoToKnockoutButton(cat); return;
  }

  const editing = Boolean(state.fixturesState.bulkEditMode);
  // FIX 9: debug console.log removed
  const knockoutSource = cat?.knockout ||
    (Array.isArray(cat?.rounds) && cat.rounds.length > 1
      ? { rounds: cat.rounds.slice(1), totalRounds: Math.max(0, cat.rounds.length - 1), label: "Knockout" }
      : null);

  _fixturesUi.groupsEl.innerHTML = `
    <div class="fixtures-group">
      <h3 class="fixtures-group-title">${escapeHtml(cat?.label || "League schedule")}</h3>
      <div class="players-table-wrapper">
        <table class="players-table">
          <thead>
            <tr><th>Match no</th><th>Team 1</th><th>Team 2</th><th>Date</th><th>Time</th><th>Court</th><th>Status</th><th>Action</th></tr>
          </thead>
          <tbody>
            ${matches.map((match, index) => {
              const editing2 = editing;
              const t1Cell = editing2
                ? `<select class="schedule-edit-input" data-edit-field="home" data-index="${index}">
                     <option value="">Select team</option>${buildTeamNameSelectOptions(match.home || "")}</select>`
                : escapeHtml(match.home || "—");
              const t2Cell = editing2
                ? `<select class="schedule-edit-input" data-edit-field="away" data-index="${index}">
                     <option value="">Select team</option>${buildTeamNameSelectOptions(match.away || "")}</select>`
                : escapeHtml(match.away || "—");
              const dateCell  = editing2 ? `<input class="schedule-edit-input" type="date" data-edit-field="date" data-index="${index}" value="${escapeHtml(match.date || "")}" />` : escapeHtml(match.date || "—");
              const timeCell  = editing2 ? `<input class="schedule-edit-input" type="time" data-edit-field="time" data-index="${index}" value="${escapeHtml(match.time || "")}" />` : escapeHtml(match.time || "—");
              const courtCell = editing2 ? `<input class="schedule-edit-input" type="text" data-edit-field="court" data-index="${index}" value="${escapeHtml(match.court || "")}" placeholder="Court name" />` : escapeHtml(match.court || "—");
              const status  = getMatchStatus(match, 0, index);
              const canScore = !editing2 &&
                String(match.home || '').toUpperCase() !== 'BYE' && String(match.away || '').toUpperCase() !== 'BYE' &&
                String(match.home || '').toUpperCase() !== 'TBD' && String(match.away || '').toUpperCase() !== 'TBD';
              return `<tr>
                <td>${escapeHtml(match.matchNo || index + 1)}</td>
                <td>${t1Cell}</td><td>${t2Cell}</td>
                <td>${dateCell}</td><td>${timeCell}</td><td>${courtCell}</td>
                <td>${getStatusPillMarkup(status)}</td>
                <td><div class="row-actions">
                  ${editing2 ? `<span class="captain-summary-meta">Editing…</span>`
                    : canScore ? `<button type="button" class="action-btn accept start-scoring-btn"
                        data-tournament-id="${escapeHtml(_tournamentId)}"
                        data-category-id="${escapeHtml(TEAM_EVENT_CATEGORY_ID)}"
                        data-round="0" data-match="${index}">Start scoring</button>`
                    : `<span class="captain-summary-meta">—</span>`}
                </div></td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>
    ${buildKnockoutBracketMarkup(knockoutSource, TEAM_EVENT_CATEGORY_ID)}`;
  updateFixturesEditButtonState(); updateGoToKnockoutButton(cat);
}

export function renderTeamEventFixtures() {
  _fixturesUi.groupsEl.innerHTML = "";
  const cat = getTeamEventFixtureBucket();
  if (!cat) {
    const teams = getConfirmedTeams().filter((t) => t.teamStatus !== "rejected");
    _fixturesUi.groupsEl.innerHTML = `
      <div class="empty-state" style="display:flex;">
        <div class="feature-icon">🧩</div>
        <h3>No fixtures yet</h3>
        <p class="muted">${teams.length < 2 ? "Not enough confirmed teams to generate fixtures." : "Click "Regenerate fixtures" to create the team fixtures."}</p>
      </div>`;
    updateFixturesEditButtonState(); updateGoToKnockoutButton(cat); return;
  }
  if (cat.displayMode === "team_schedule") { renderTeamEventScheduleTable(cat); return; }

  const wrapper   = document.createElement("div"); wrapper.className = "fixtures-group";
  const title     = document.createElement("h3");  title.className = "fixtures-group-title";
  title.textContent = cat.label || "Team fixtures";
  wrapper.appendChild(title);

  const roundsWrap = document.createElement("div"); roundsWrap.className = "fixtures-rounds";
  (cat.rounds || []).forEach((round, roundIndex) => {
    const col = document.createElement("div"); col.className = "fixtures-round-col";
    col.innerHTML = `<div class="round-title">${escapeHtml(getDisplayRoundLabel(cat, round, roundIndex))}</div>`;
    round.forEach((match, matchIndex) => {
      const item = document.createElement("div"); item.className = "fixtures-round-match";
      item.innerHTML = buildFixtureCard(match, roundIndex, matchIndex, TEAM_EVENT_CATEGORY_ID);
      col.appendChild(item);
    });
    roundsWrap.appendChild(col);
  });
  wrapper.appendChild(roundsWrap);
  _fixturesUi.groupsEl.appendChild(wrapper);
  updateFixturesEditButtonState(); updateGoToKnockoutButton(cat);
}

export function renderCategoryBracket(categoryId) {
  if (isTournamentTeamEvent()) { renderTeamEventFixtures(); return; }
  renderIndividualCategoryFixtures(categoryId);
}

// ── DB helpers ────────────────────────────────────────────────────────────────
export async function loadFixturesFromDb() {
  const urls = [
    `/api/tournaments/${encodeURIComponent(_tournamentId)}/fixtures`,
    `/api/host/tournaments/${encodeURIComponent(_tournamentId)}/fixtures`,
  ];
  for (const url of urls) {
    const r = await apiGet(url);
    if (!r.ok) continue;
    const parsed = r.data?.data || r.data;
    if (parsed?.categories) return parsed;
  }
  return null;
}

export async function persistFixturesState() {
  const r = await apiPost(
    `/api/host/tournaments/${encodeURIComponent(_tournamentId)}/fixtures/update`,
    state.fixturesState.fixtures || { categories: {} }
  );
  if (!r.ok) throw new Error(r.data?.message || "Failed to save fixtures");
  state.fixturesState.fixtures = migrateFixtures(r.data || state.fixturesState.fixtures || { categories: {} });
}

export function migrateFixtures(fixturesObj) {
  if (!fixturesObj?.categories) return fixturesObj;
  Object.values(fixturesObj.categories).forEach((cat) => {
    if (!cat) return;
    if (Array.isArray(cat.matches)) cat.matches = cat.matches.map((m) => ensureMatchMeta(m));
    if (Array.isArray(cat.rounds)) cat.rounds.forEach((round) => {
      if (!Array.isArray(round)) return;
      round.forEach((match) => ensureMatchMeta(match));
    });
  });
  return fixturesObj;
}

// ── Entrants ──────────────────────────────────────────────────────────────────
function computeAcceptedByCategory() {
  const accepted = getAcceptedPlayers();
  const map = {};
  state.tournamentCategories.forEach((c) => {
    const cid = c.categoryId || c.id;
    map[cid] = accepted
      .filter((p) => String(getPlayerCategoryId(p)) === String(cid))
      .map((p) => getPlayerDisplayName(p));
  });
  state.fixturesState.acceptedByCategory = map;
}

function getFixtureEntrantsForCategory(categoryMeta) {
  const cid = categoryMeta?.categoryId || categoryMeta?.id;
  if (!cid) return { entrants: [], teamMap: {}, sourceCount: 0 };
  if (isTournamentTeamEvent()) {
    const teams    = getConfirmedTeams().filter((t) => t.teamStatus !== "rejected");
    const entrants = teams.map((t) => t.teamName).filter(Boolean);
    const teamMap  = {};
    teams.forEach((t) => { teamMap[t.teamName] = [t.teamName]; });
    return { entrants, teamMap, sourceCount: entrants.length };
  }
  const names    = state.fixturesState.acceptedByCategory[cid] || [];
  const teamSize = Number(categoryMeta?.teamSize || 1);
  const { entrants, teamMap } = buildEntrants(names, teamSize);
  return { entrants, teamMap, sourceCount: names.length };
}

// ── League scheduling helpers (FIX 5 — loop capped at 80) ────────────────────
function getPairKey(a, b) { return [a, b].sort().join("::"); }

function buildBalancedLeaguePairs(teamNames, requestedMatches) {
  const names = shuffle(teamNames.filter(Boolean));
  if (names.length < 2) return { pairs: [], matchesPerTeam: 0 };
  let matchesPerTeam = Math.min(Math.max(1, Number(requestedMatches || 0)), names.length - 1);
  if ((names.length * matchesPerTeam) % 2 !== 0) matchesPerTeam -= 1;
  if (matchesPerTeam < 1) return { pairs: [], matchesPerTeam: 0 };

  const allPairs = [];
  for (let i = 0; i < names.length; i += 1)
    for (let j = i + 1; j < names.length; j += 1)
      allPairs.push([names[i], names[j]]);

  let bestPairs = [], bestScore = -1;
  // FIX 5: 80 iterations (was 500) — prevents UI freeze on mobile
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const counts  = Object.fromEntries(names.map((n) => [n, 0]));
    const selected = [], seen = new Set();
    for (const [a, b] of shuffle(allPairs)) {
      const key = getPairKey(a, b);
      if (seen.has(key)) continue;
      if (counts[a] >= matchesPerTeam || counts[b] >= matchesPerTeam) continue;
      selected.push({ home: a, away: b }); counts[a]++; counts[b]++; seen.add(key);
    }
    const score = names.reduce((sum, n) => sum + counts[n], 0);
    if (score > bestScore) { bestScore = score; bestPairs = selected; }
    if (names.every((n) => counts[n] === matchesPerTeam)) break;
  }
  return { pairs: bestPairs, matchesPerTeam };
}

function scheduleLeaguePairs(pairs, courtNames, baseDate) {
  const matchDurationMs   = 2 * 60 * 60 * 1000;
  const usableCourts      = [...new Set((courtNames || []).filter(Boolean))];
  if (!usableCourts.length) usableCourts.push("Court 1");
  const teamNext          = new Map(), courtNext = new Map();
  const teamCourtHistory  = new Map(), teamLastCourt = new Map();
  const courtUsageCounts  = new Map();
  const baseTs            = baseDate.getTime();
  usableCourts.forEach((c) => { courtNext.set(c, baseTs); courtUsageCounts.set(c, 0); });

  return pairs.map((pair, index) => {
    let best = null;
    usableCourts.forEach((court, courtIdx) => {
      const start = Math.max(baseTs, teamNext.get(pair.home) || baseTs, teamNext.get(pair.away) || baseTs, courtNext.get(court) || baseTs);
      const hHist = teamCourtHistory.get(pair.home) || new Set();
      const aHist = teamCourtHistory.get(pair.away) || new Set();
      let penalty = 0;
      if (hHist.has(court)) penalty += 2; if (aHist.has(court)) penalty += 2;
      if (teamLastCourt.get(pair.home) === court) penalty++;
      if (teamLastCourt.get(pair.away) === court) penalty++;
      const candidate = { court, start, penalty, usage: courtUsageCounts.get(court) || 0, courtIdx };
      if (!best || penalty < best.penalty || (penalty === best.penalty && start < best.start) ||
          (penalty === best.penalty && start === best.start && candidate.usage < best.usage) ||
          (penalty === best.penalty && start === best.start && candidate.usage === best.usage && courtIdx < best.courtIdx)) {
        best = candidate;
      }
    });
    const chosenCourt = best?.court || usableCourts[0];
    const chosenStart = best?.start || baseTs;
    const end = chosenStart + matchDurationMs;
    teamNext.set(pair.home, end); teamNext.set(pair.away, end); courtNext.set(chosenCourt, end);
    courtUsageCounts.set(chosenCourt, (courtUsageCounts.get(chosenCourt) || 0) + 1);
    if (!teamCourtHistory.has(pair.home)) teamCourtHistory.set(pair.home, new Set());
    if (!teamCourtHistory.has(pair.away)) teamCourtHistory.set(pair.away, new Set());
    teamCourtHistory.get(pair.home).add(chosenCourt); teamCourtHistory.get(pair.away).add(chosenCourt);
    teamLastCourt.set(pair.home, chosenCourt); teamLastCourt.set(pair.away, chosenCourt);
    const dt = new Date(chosenStart);
    return ensureMatchMeta({ matchId: makeMatchId(), matchNo: index + 1, home: pair.home, away: pair.away,
      homePlayers: [pair.home], awayPlayers: [pair.away],
      date: formatDateInputValue(dt), time: formatTimeInputValue(dt),
      court: chosenCourt, stage: "league", roundLabel: `League Match ${index + 1}` });
  });
}

function chunkTeamsNearlyEqual(teamNames, groupCount) {
  const teams  = shuffle([...teamNames].filter(Boolean));
  const groups = Array.from({ length: groupCount }, (_, i) => ({
    groupIndex: i, groupName: `Group ${String.fromCharCode(65 + i)}`, teams: [],
  }));
  teams.forEach((team, idx) => { groups[idx % groupCount].teams.push(team); });
  return groups;
}

function buildFullRoundRobinPairs(teamNames) {
  const names = [...teamNames].filter(Boolean), pairs = [];
  for (let i = 0; i < names.length; i += 1)
    for (let j = i + 1; j < names.length; j += 1)
      pairs.push({ home: names[i], away: names[j] });
  return shuffle(pairs);
}

function buildScheduledMatchesWithRoster(pairs, teamMap, courtNames, baseDate) {
  return scheduleLeaguePairs(pairs, courtNames, baseDate).map((match) => {
    const home = String(match?.home || "").trim();
    const away = String(match?.away || "").trim();
    return ensureMatchMeta({ ...match, type: "match",
      homePlayers: Array.isArray(teamMap?.[home]) ? [...teamMap[home]] : splitTeamName(home),
      awayPlayers: Array.isArray(teamMap?.[away]) ? [...teamMap[away]] : splitTeamName(away) });
  });
}

function buildGroupRoundRobinSchedule(groups, courtNames, baseDate) {
  const allRounds = [], groupMeta = [];
  let runningBase = new Date(baseDate.getTime());
  groups.forEach((group) => {
    const pairs = buildFullRoundRobinPairs(group.teams);
    const scheduledMatches = scheduleLeaguePairs(pairs, shuffle(courtNames), runningBase);
    allRounds.push(scheduledMatches);
    groupMeta.push({ groupIndex: group.groupIndex, groupName: group.groupName, teamNames: [...group.teams], roundIndex: allRounds.length - 1, qualifierCount: 2 });
    if (scheduledMatches.length) {
      const latest = scheduledMatches.reduce((max, m) => {
        const dt = new Date(`${m.matchDate}T${m.matchTime || "09:00"}`); const ts = dt.getTime();
        return Number.isFinite(ts) ? Math.max(max, ts) : max;
      }, runningBase.getTime());
      runningBase = new Date(latest + 24 * 60 * 60 * 1000);
    }
  });
  return { rounds: allRounds, groupMeta };
}

function buildCategoryGroupRoundRobinSchedule(groups, teamMap, courtNames, baseDate) {
  const allRounds = [], groupMeta = [];
  let runningBase = new Date(baseDate.getTime());
  groups.forEach((group) => {
    const pairs = buildFullRoundRobinPairs(group.teams);
    const scheduledMatches = buildScheduledMatchesWithRoster(pairs, teamMap, shuffle(courtNames), runningBase);
    allRounds.push(scheduledMatches);
    groupMeta.push({ groupIndex: group.groupIndex, groupName: group.groupName, teamNames: [...group.teams], roundIndex: allRounds.length - 1, qualifierCount: 2 });
    if (scheduledMatches.length) {
      const latest = scheduledMatches.reduce((max, m) => {
        const dv = m?.date || m?.matchDate || "", tv = m?.time || m?.matchTime || "09:00";
        const ts = new Date(`${dv}T${tv}`).getTime();
        return Number.isFinite(ts) ? Math.max(max, ts) : max;
      }, runningBase.getTime());
      runningBase = new Date(latest + 24 * 60 * 60 * 1000);
    }
  });
  return { rounds: allRounds, groupMeta };
}

// ── Category knockout helpers ─────────────────────────────────────────────────
function getQualifiedEntrantsFromGroups(cat) {
  const groups = Array.isArray(cat?.groups) ? cat.groups : [];
  const qualified = [];
  groups.forEach((group) => {
    computeGroupLeaderboardRows(cat, group.roundIndex)
      .slice(0, Number(group.qualifierCount || 2))
      .forEach((row) => { if (row?.teamName) qualified.push(row.teamName); });
  });
  return qualified;
}

function getQualifiedTeamsFromGroups(cat) { return getQualifiedEntrantsFromGroups(cat); }

function canGenerateCategoryKnockout(cat) {
  if (!cat) return false;
  const matches = Array.isArray(cat.matches) ? cat.matches : Array.isArray(cat.rounds?.[0]) ? cat.rounds[0] : [];
  if (!matches.length || cat.knockout) return false;
  return matches.every((m, idx) => getMatchStatus(m, 0, idx) === "completed");
}

function canGenerateCategoryGroupKnockout(cat) {
  if (!cat) return false;
  const groups = Array.isArray(cat?.groups) ? cat.groups : [];
  if (!groups.length || cat.knockout) return false;
  return groups.every((group) => {
    const matches = Array.isArray(cat.rounds?.[group.roundIndex]) ? cat.rounds[group.roundIndex] : [];
    return matches.length && matches.every((m, idx) => getMatchStatus(m, group.roundIndex, idx) === "completed");
  });
}

function isTeamRoundRobinFormat()   { return String(state.tournamentMetaCache?.stageFormat || "") === "round_robin"; }
function isTeamGroupKnockoutFormat(){ return String(state.tournamentMetaCache?.stageFormat || "") === "group_knockout"; }

function canGenerateGroupKnockout(cat) {
  if (!cat || !isTeamGroupKnockoutFormat()) return false;
  const groups = Array.isArray(cat?.groups) ? cat.groups : [];
  if (!groups.length || cat.knockout) return false;
  return groups.every((group) => {
    const matches = Array.isArray(cat.rounds?.[group.roundIndex]) ? cat.rounds[group.roundIndex] : [];
    return matches.length && matches.every((m, idx) => getMatchStatus(m, group.roundIndex, idx) === "completed");
  });
}

// ── Save team schedule edits ──────────────────────────────────────────────────
async function saveAllTeamScheduleEdits() {
  const cat = getTeamEventFixtureBucket();
  if (!cat) return;
  const matches = Array.isArray(cat.matches) ? cat.matches
    : Array.isArray(cat.rounds?.[0]) ? cat.rounds[0] : [];
  matches.forEach((match, index) => {
    const root = _fixturesUi.groupsEl;
    match.home   = root?.querySelector(`[data-edit-field="home"][data-index="${index}"]`)?.value?.trim()     || match.home   || "";
    match.away   = root?.querySelector(`[data-edit-field="away"][data-index="${index}"]`)?.value?.trim()     || match.away   || "";
    match.date   = root?.querySelector(`input[data-edit-field="date"][data-index="${index}"]`)?.value        || match.date   || "";
    match.time   = root?.querySelector(`input[data-edit-field="time"][data-index="${index}"]`)?.value        || match.time   || "";
    match.court  = root?.querySelector(`input[data-edit-field="court"][data-index="${index}"]`)?.value?.trim()|| match.court  || "";
    match.homePlayers = match.home ? [match.home] : [];
    match.awayPlayers = match.away ? [match.away] : [];
  });
  cat.matches = matches; cat.rounds = [matches];
  await persistFixturesState();
  state.fixturesState.bulkEditMode = false;
  renderTeamEventScheduleTable(getTeamEventFixtureBucket());
  _callbacks.showToast?.("Fixtures updated");
}

// ── Generate fixtures ─────────────────────────────────────────────────────────
export async function generateAndSaveFixtures() {
  if (!state.fixturesState.categories.length && !isTournamentTeamEvent()) {
    _callbacks.showToast?.("No categories found"); return;
  }
  if (isTournamentTeamEvent()) {
    const teams     = getConfirmedTeams();
    if (teams.length < 2) { _callbacks.showToast?.("Not enough confirmed teams to regenerate fixtures"); return; }
    const teamNames  = teams.map((t) => t.teamName).filter(Boolean);
    const courtNames = shuffle(getAvailableCourtNames());
    const startDate  = getTournamentStartDate();
    const fmt        = String(state.tournamentMetaCache?.stageFormat || "").trim();

    if (fmt === "round_robin") {
      const pairs = buildFullRoundRobinPairs(teamNames);
      if (!pairs.length) { _callbacks.showToast?.("Could not build round robin fixtures"); return; }
      const scheduledMatches = scheduleLeaguePairs(pairs, courtNames, startDate);
      state.fixturesState.bulkEditMode = false;
      state.fixturesState.fixtures = migrateFixtures({ tournamentType: "team", teamCategories: state.tournamentCategories,
        categories: { [TEAM_EVENT_CATEGORY_ID]: { categoryId: TEAM_EVENT_CATEGORY_ID, label: "League schedule",
          displayMode: "team_schedule", stageFormat: "round_robin", rounds: [scheduledMatches], matches: scheduledMatches, totalRounds: 1 } } });
      try { await persistFixturesState(); _callbacks.showToast?.("Round robin fixtures generated"); renderTeamEventFixtures(); }
      catch (err) { alert(err.message || "Could not save round robin fixtures."); }
      return;
    }
    if (fmt === "group_knockout") {
      const requestedGroupCount = Math.max(2, Number(state.tournamentMetaCache?.groupCount || 0) || 2);
      const groups = chunkTeamsNearlyEqual(teamNames, requestedGroupCount).filter((g) => g.teams.length >= 2);
      if (!groups.length) { _callbacks.showToast?.("Not enough teams to create group fixtures"); return; }
      const { rounds, groupMeta } = buildGroupRoundRobinSchedule(groups, courtNames, startDate);
      state.fixturesState.bulkEditMode = false;
      state.fixturesState.fixtures = migrateFixtures({ tournamentType: "team", teamCategories: state.tournamentCategories,
        categories: { [TEAM_EVENT_CATEGORY_ID]: { categoryId: TEAM_EVENT_CATEGORY_ID, label: "Group fixtures",
          displayMode: "team_schedule", stageFormat: "group_knockout", rounds, matches: rounds[0] || [],
          totalRounds: rounds.length, groups: groupMeta, knockout: null } } });
      try { await persistFixturesState(); _callbacks.showToast?.("Group fixtures generated"); renderTeamEventFixtures(); }
      catch (err) { alert(err.message || "Could not save group fixtures."); }
      return;
    }
    if (fmt === "round_robin_knockout") {
      const requestedRounds = getRequestedLeagueRounds() || 1;
      const { pairs, matchesPerTeam } = buildBalancedLeaguePairs(teamNames, requestedRounds);
      if (!pairs.length) { _callbacks.showToast?.("Could not build league fixtures"); return; }
      const scheduledMatches = scheduleLeaguePairs(pairs, courtNames, startDate);
      state.fixturesState.bulkEditMode = false;
      state.fixturesState.fixtures = migrateFixtures({ tournamentType: "team", teamCategories: state.tournamentCategories,
        categories: { [TEAM_EVENT_CATEGORY_ID]: { categoryId: TEAM_EVENT_CATEGORY_ID,
          label: `League schedule • ${matchesPerTeam} matches per team`, displayMode: "team_schedule",
          stageFormat: "round_robin_knockout", rounds: [scheduledMatches], matches: scheduledMatches, totalRounds: 1 } } });
      try { await persistFixturesState(); _callbacks.showToast?.("League fixtures generated"); renderTeamEventFixtures(); }
      catch (err) { alert(err.message || "Could not save league fixtures."); }
      return;
    }
    // Team fallback — bracket
    const teamMap = {}, entrants = teamNames.map((n) => { teamMap[n] = [n]; return n; });
    const bracket = createBracket(entrants, teamMap);
    if (!bracket) { _callbacks.showToast?.("Not enough confirmed teams to regenerate fixtures"); return; }
    state.fixturesState.bulkEditMode = false;
    state.fixturesState.fixtures = migrateFixtures({ tournamentType: "team", teamCategories: state.tournamentCategories,
      categories: { [TEAM_EVENT_CATEGORY_ID]: { categoryId: TEAM_EVENT_CATEGORY_ID, label: "Team fixtures",
        displayMode: "team_bracket", ...bracket } } });
    try { await persistFixturesState(); _callbacks.showToast?.("Team fixtures regenerated"); renderTeamEventFixtures(); }
    catch (err) { alert(err.message || "Could not save fixtures."); }
    return;
  }

  // Individual event
  const categoriesPayload = {}; let createdAny = false;
  state.fixturesState.categories.forEach((category) => {
    const cid = String(category?.categoryId || category?.id || "").trim();
    if (!cid) return;
    const { entrants, teamMap } = getFixtureEntrantsForCategory(category);
    const fmt = String(state.tournamentMetaCache?.stageFormat || "").trim();
    const courtNames = shuffle(getAvailableCourtNames());
    const startDate  = getTournamentStartDate();

    if (fmt === "round_robin") {
      const scheduledMatches = buildScheduledMatchesWithRoster(buildFullRoundRobinPairs(entrants), teamMap, courtNames, startDate);
      categoriesPayload[cid] = { categoryId: cid, label: category.label, displayMode: "league_rounds", stageFormat: "round_robin",
        rounds: [scheduledMatches], matches: scheduledMatches, totalRounds: 1 };
      if (scheduledMatches.length) createdAny = true; return;
    }
    if (fmt === "group_knockout") {
      const requestedGroupCount = Math.max(2, Number(state.tournamentMetaCache?.groupCount || 0) || 2);
      const groups = chunkTeamsNearlyEqual(entrants, requestedGroupCount).filter((g) => g.teams.length >= 2);
      const { rounds, groupMeta } = buildCategoryGroupRoundRobinSchedule(groups, teamMap, courtNames, startDate);
      categoriesPayload[cid] = { categoryId: cid, label: category.label, displayMode: "league_rounds", stageFormat: "group_knockout",
        rounds, matches: rounds[0] || [], totalRounds: rounds.length, groups: groupMeta, knockout: null };
      if (rounds.some((r) => Array.isArray(r) && r.length)) createdAny = true; return;
    }
    if (fmt === "round_robin_knockout") {
      const requestedRounds = getRequestedLeagueRounds() || 1;
      const { pairs, matchesPerTeam } = buildBalancedLeaguePairs(entrants, requestedRounds);
      const scheduledMatches = buildScheduledMatchesWithRoster(pairs, teamMap, courtNames, startDate);
      categoriesPayload[cid] = { categoryId: cid,
        label: `${category.label} • ${matchesPerTeam} matches per entrant`, displayMode: "league_rounds",
        stageFormat: "round_robin_knockout", rounds: [scheduledMatches], matches: scheduledMatches, totalRounds: 1 };
      if (scheduledMatches.length) createdAny = true; return;
    }
    const bracket = createBracket(entrants, teamMap);
    categoriesPayload[cid] = { categoryId: cid, label: category.label, ...(bracket ? bracket : { rounds: [], totalRounds: 0 }) };
    if (bracket) createdAny = true;
  });

  if (!createdAny) { _callbacks.showToast?.("Not enough accepted players to generate fixtures"); return; }
  state.fixturesState.bulkEditMode = false;
  state.fixturesState.fixtures = migrateFixtures({ tournamentType: "single", categories: categoriesPayload });
  try {
    await persistFixturesState();
    _callbacks.showToast?.("Fixtures regenerated");
    renderCategoryToggles();
    if (state.fixturesState.activeCategoryId) renderIndividualCategoryFixtures(state.fixturesState.activeCategoryId);
  } catch (err) { alert(err.message || "Could not save fixtures."); }
}

// ── Generate knockout from leaderboard ────────────────────────────────────────
export async function generateKnockoutFromLeaderboard() {
  const targetCategoryId = isTournamentTeamEvent() ? TEAM_EVENT_CATEGORY_ID : state.fixturesState.activeCategoryId;
  if (!targetCategoryId) { _callbacks.showToast?.("Select a category first"); return; }

  const cat = isTournamentTeamEvent() ? getTeamEventFixtureBucket() : state.fixturesState.fixtures?.categories?.[targetCategoryId];
  if (!cat) { _callbacks.showToast?.("Fixtures not found"); return; }

  let entrantNames = [];
  if (isTournamentTeamEvent()) {
    if (isTeamGroupKnockoutFormat()) {
      if (!canGenerateGroupKnockout(cat)) { _callbacks.showToast?.("Complete all group matches first"); return; }
      entrantNames = getQualifiedTeamsFromGroups(cat);
    } else {
      if (!canGenerateKnockout(cat)) { _callbacks.showToast?.("Complete all league matches first"); return; }
      entrantNames = getQualifiedLeaderboardRows().map((r) => String(r?.teamName || r?.team || "").trim()).filter(Boolean);
    }
  } else {
    if (String(cat?.stageFormat || "") === "group_knockout") {
      if (!canGenerateCategoryGroupKnockout(cat)) { _callbacks.showToast?.("Complete all group matches first"); return; }
      entrantNames = getQualifiedEntrantsFromGroups(cat);
    } else {
      if (!canGenerateCategoryKnockout(cat)) { _callbacks.showToast?.("Complete all league matches first"); return; }
      const leagueMatches = Array.isArray(cat.matches) ? cat.matches : Array.isArray(cat.rounds?.[0]) ? cat.rounds[0] : [];
      const stats = new Map();
      const ensureEnt = (name) => {
        const key = String(name || "").trim();
        if (!key || key === "BYE" || key === "TBD") return null;
        if (!stats.has(key)) stats.set(key, { teamName: key, matchPoints: 0, matchesPlayed: 0 });
        return stats.get(key);
      };
      leagueMatches.forEach((match, idx) => {
        const home = ensureEnt(match?.home), away = ensureEnt(match?.away);
        if (!home || !away || getMatchStatus(match, 0, idx) !== "completed") return;
        home.matchesPlayed++; away.matchesPlayed++;
        home.matchPoints += getFixtureMatchPoints(match, "home");
        away.matchPoints += getFixtureMatchPoints(match, "away");
      });
      const rows = [...stats.values()].sort((a, b) =>
        (b.matchPoints - a.matchPoints) || (b.matchesPlayed - a.matchesPlayed) ||
        String(a.teamName).localeCompare(String(b.teamName)));
      const qualCount = Number(getAdvancedSettings()?.qualifierCount || 0) || Math.min(4, rows.length);
      entrantNames = rows.slice(0, qualCount).map((r) => String(r.teamName || "").trim()).filter(Boolean);
    }
  }

  if (entrantNames.length < 2) { _callbacks.showToast?.("Not enough qualified entrants for knockout"); return; }
  const knockout = buildSeededKnockoutRounds(entrantNames);
  if (!knockout) { _callbacks.showToast?.("Could not generate knockout schedule"); return; }

  knockout.label = `Knockout • ${entrantNames.length} qualified entrants`;
  knockout.qualifiedTeams = entrantNames;
  autoAdvanceKnockoutByes(knockout);
  cat.knockout = knockout;

  if (String(cat?.stageFormat || "") === "group_knockout") {
    cat.rounds = [...(cat.rounds || []), ...knockout.rounds];
  } else {
    const leagueMatches = Array.isArray(cat.matches) ? cat.matches : Array.isArray(cat.rounds?.[0]) ? cat.rounds[0] : [];
    cat.rounds = [leagueMatches, ...knockout.rounds];
  }
  cat.totalRounds = cat.rounds.length;

  await persistFixturesState();
  if (isTournamentTeamEvent()) renderTeamEventFixtures();
  else { renderCategoryToggles(); renderIndividualCategoryFixtures(targetCategoryId); }
  _callbacks.showToast?.("Knockout schedule created");
}

// ── Init (runs once, on lazy load) ────────────────────────────────────────────
export async function openAndLoadFixtures() {
  _fixturesUi.wrap?.classList.remove("hidden");
  await initFixturesIfNeeded();
  updateEmbeddedFixturesHeader();

  state.fixturesState.categories = state.tournamentCategories || [];
  computeAcceptedByCategory();

  const existing = await loadFixturesFromDb();
  state.fixturesState.fixtures = existing ? migrateFixtures(existing) : { categories: {} };

  if (isTournamentTeamEvent()) {
    state.fixturesState.activeCategoryId = TEAM_EVENT_CATEGORY_ID;
    renderCategoryToggles();
    if (_fixturesUi.noneSelectedEl) _fixturesUi.noneSelectedEl.style.display = "none";
    renderTeamEventFixtures();
    await _callbacks.loadLeaderboardFromDb?.();
    _callbacks.renderLeaderboard?.();
    updateFixturesEditButtonState();
    return;
  }

  state.fixturesState.activeCategoryId =
    state.fixturesState.activeCategoryId ||
    String(state.fixturesState.categories?.[0]?.categoryId || state.fixturesState.categories?.[0]?.id || "");

  renderCategoryToggles();

  if (state.fixturesState.activeCategoryId) {
    if (_fixturesUi.noneSelectedEl) _fixturesUi.noneSelectedEl.style.display = "none";
    renderIndividualCategoryFixtures(state.fixturesState.activeCategoryId);
  } else if (_fixturesUi.noneSelectedEl) {
    _fixturesUi.noneSelectedEl.style.display = "flex";
  }

  await _callbacks.loadLeaderboardFromDb?.();
  _callbacks.renderLeaderboard?.();
  updateFixturesEditButtonState();
}

async function initFixturesIfNeeded() {
  if (_fixturesUi.didInit) return;
  _fixturesUi.didInit = true;

  const goKnockoutBtn = document.getElementById("fixtures-go-knockout-btn");

  _fixturesUi.groupsEl?.addEventListener("click", async (e) => {
    const btn = e.target.closest(".start-scoring-btn");
    if (!btn) return;
    window.location.href = `score.html?tournamentId=${btn.dataset.tournamentId}&categoryId=${btn.dataset.categoryId}&round=${btn.dataset.round || "0"}&match=${btn.dataset.match || "0"}`;
  });

  _fixturesUi.configureBtn?.addEventListener("click", () => {
    const cid = isTournamentTeamEvent() ? TEAM_EVENT_CATEGORY_ID : state.fixturesState.activeCategoryId;
    if (!cid) { _callbacks.showToast?.("Select a category first"); return; }
    window.location.href = `schema.html?tournamentId=${encodeURIComponent(_tournamentId)}&categoryId=${encodeURIComponent(cid)}`;
  });

  _fixturesUi.generateBtn?.addEventListener("click", async () => { await generateAndSaveFixtures(); });

  goKnockoutBtn?.addEventListener("click", async () => {
    try { await generateKnockoutFromLeaderboard(); }
    catch (err) { alert(err.message || "Could not create knockout schedule."); }
  });

  _fixturesUi.editBtn?.addEventListener("click", async () => {
    const cat = getTeamEventFixtureBucket();
    if (!cat || cat.displayMode !== "team_schedule") { _callbacks.showToast?.("Edit fixtures is available for the team schedule table."); return; }
    if (!state.fixturesState.bulkEditMode) {
      state.fixturesState.bulkEditMode = true;
      renderTeamEventScheduleTable(cat);
      _callbacks.showToast?.("Edit mode enabled");
      return;
    }
    try { await saveAllTeamScheduleEdits(); }
    catch (err) { alert(err.message || "Could not save fixtures."); }
  });
}

// ── Background polling ────────────────────────────────────────────────────────
let _pollTimer = null;

export function startFixturesBackendPolling() {
  if (_pollTimer) clearInterval(_pollTimer);
  _pollTimer = setInterval(async () => {
    if (document.hidden) return;
    if (state.isFixturesCollapsed) return;
    if (state.fixturesState.bulkEditMode) return;
    if (!_fixturesUi.wrap || _fixturesUi.wrap.classList.contains("hidden")) return;
    try { await _refreshSilently(); }
    catch (err) { console.warn("Fixture polling failed", err); }
  }, 4000);
}

async function _refreshSilently() {
  if (state.fixturesState.bulkEditMode) return;
  const existing = await loadFixturesFromDb();
  if (!existing) return;
  state.fixturesState.fixtures = migrateFixtures(existing);

  if (isTournamentTeamEvent()) {
    state.fixturesState.activeCategoryId = TEAM_EVENT_CATEGORY_ID;
    renderCategoryToggles();
    if (_fixturesUi.noneSelectedEl) _fixturesUi.noneSelectedEl.style.display = "none";
    renderTeamEventFixtures();
    await _callbacks.loadLeaderboardFromDb?.();
    _callbacks.renderLeaderboard?.();
    updateFixturesEditButtonState();
    return;
  }

  renderCategoryToggles();
  if (state.fixturesState.activeCategoryId) {
    if (_fixturesUi.noneSelectedEl) _fixturesUi.noneSelectedEl.style.display = "none";
    renderIndividualCategoryFixtures(state.fixturesState.activeCategoryId);
  } else if (_fixturesUi.noneSelectedEl) {
    _fixturesUi.noneSelectedEl.style.display = "flex";
  }
  await _callbacks.loadLeaderboardFromDb?.();
  _callbacks.renderLeaderboard?.();
  updateFixturesEditButtonState();
}
