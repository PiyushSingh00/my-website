/**
 * players-utils.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared utilities, API helpers, pure-data functions, and state containers.
 * No DOM reads/writes. Imported by every other players-*.js module.
 *
 * FIX 12 (module split): extracted from the monolithic players.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Auth token (set once at startup by players.js) ───────────────────────────
export let AUTH_TOKEN = "";
export function setAuthToken(token) {
  AUTH_TOKEN = token || "";
}

// ── Shared mutable state ──────────────────────────────────────────────────────
// All modules read/write these objects by reference — no copying needed.
export const state = {
  allPlayers: [],
  activeFilter: "all",
  tournamentCategories: [],
  tournamentMetaCache: null,
  isPlayersListCollapsed: true,
  isTeamSetupCollapsed: true,
  isLeaderboardCollapsed: true,
  isFixturesCollapsed: true,
  captainState: {
    selectedCaptainIds: [],
    confirmedCaptains: [],
    pools: null,
  },
  canonicalTeams: [],
  leaderboardState: { rows: [] },
  fixturesState: {
    fixtures: null,
    categories: [],
    acceptedByCategory: {},
    activeCategoryId: null,
    bulkEditMode: false,
  },
  bulkPlayerRows: [],
  // FIX 11: advanced settings cache
  _cachedAdvancedSettings: null,
  // FIX 10: fixture lazy-load flag
  _fixturesLoaded: false,
};

export const TEAM_EVENT_CATEGORY_ID = "__team_event__";

// ── String / DOM helpers ──────────────────────────────────────────────────────
export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function safeJson(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function normalizeTournamentList(raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object") return [];
  if (Array.isArray(raw.data)) return raw.data;
  if (Array.isArray(raw.tournaments)) return raw.tournaments;
  if (Array.isArray(raw.items)) return raw.items;
  return [];
}

// ── Player field normalizers ──────────────────────────────────────────────────
export function normalizeCategories(cats) {
  if (!cats) return [];
  if (Array.isArray(cats)) return cats;
  if (typeof cats === "string") {
    try { const p = JSON.parse(cats); return Array.isArray(p) ? p : []; }
    catch { return []; }
  }
  return [];
}

export function categoryLabel(c) {
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

export function getPlayerCategoryId(p) {
  return p.categoryId ?? p.categoryID ?? p.category ?? p.category_id ?? null;
}
export function getPlayerId(p) {
  return p.playerId ?? p.registrationId ?? p.id ?? p._id ?? p.pk ?? null;
}
export function getPlayerDisplayName(p) {
  return p.playerName ?? p.name ?? p.fullName ?? p.username ?? "Player";
}

export function normalizeStatusPlayersPage(p) {
  const raw = p.status ?? p.registrationStatus ?? p.inviteStatus ?? p.state ?? "accepted";
  const s = String(raw).toLowerCase();
  if (["accepted", "approve", "approved"].includes(s)) return "accepted";
  if (["rejected", "reject", "declined", "denied"].includes(s)) return "rejected";
  return "pending";
}
export function statusLabel(status) {
  if (status === "accepted") return "Accepted";
  if (status === "rejected") return "Rejected";
  return "Pending";
}
export function statusClass(status) {
  if (status === "accepted") return "status-pill--accepted";
  if (status === "rejected") return "status-pill--rejected";
  return "status-pill--pending";
}

export function normalizeIdentity(value) {
  return String(value || "").trim().toLowerCase();
}
export function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

// ── Tournament meta helpers ───────────────────────────────────────────────────
// FIX 11: cache advancedSettings; reset on every loadTournamentMeta call
export function resetAdvancedSettingsCache() {
  state._cachedAdvancedSettings = null;
}

export function getAdvancedSettings() {
  if (state._cachedAdvancedSettings) return state._cachedAdvancedSettings;
  state._cachedAdvancedSettings = safeJson(
    state.tournamentMetaCache?.advancedSettings,
    state.tournamentMetaCache?.advancedSettings
  ) || {};
  return state._cachedAdvancedSettings;
}
export function getAdvancedMode() { return getAdvancedSettings()?.advancedMode || ""; }
export function isTournamentTeamEvent() {
  return String(state.tournamentMetaCache?.tournamentType || "").toLowerCase() === "team";
}
export function isGroupKnockoutFormat() {
  return String(state.tournamentMetaCache?.stageFormat || "") === "group_knockout";
}
export function isLeagueKnockoutFormat() {
  return String(state.tournamentMetaCache?.stageFormat || "") === "round_robin_knockout";
}
export function isPickleballTeamLeagueMode() { return getAdvancedMode() === "pickleball_team_league"; }
export function getRequestedLeagueRounds() {
  const raw = Number(getAdvancedSettings()?.roundRobinMatches || 0);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

export function getTournamentStartDate() {
  const raw = String(state.tournamentMetaCache?.tournamentDates || "").trim();
  const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const dt = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T09:00:00`);
    if (!Number.isNaN(dt.getTime())) return dt;
  }
  const dmy = raw.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (dmy) {
    const day   = dmy[1].padStart(2, "0");
    const month = dmy[2].padStart(2, "0");
    const year  = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    const dt = new Date(`${year}-${month}-${day}T09:00:00`);
    if (!Number.isNaN(dt.getTime())) return dt;
  }
  const dt = new Date(); dt.setHours(9, 0, 0, 0); return dt;
}

export function getAvailableCourtNames() {
  const meta     = state.tournamentMetaCache || {};
  const advanced = getAdvancedSettings();
  const desiredCount = Math.max(1, Number(meta.courtCount || advanced.courtCount || 0) || 0);

  const normalizeCourtList = (value) => {
    if (Array.isArray(value) && value.length) {
      const arr = value.map((x, i) => String(x || `Court ${i + 1}`).trim()).filter(Boolean);
      while (desiredCount && arr.length < desiredCount) arr.push(`Court ${arr.length + 1}`);
      return [...new Set(arr)];
    }
    if (typeof value === "string" && value.trim()) {
      const arr = value.split(",").map((x) => x.trim()).filter(Boolean);
      while (desiredCount && arr.length < desiredCount) arr.push(`Court ${arr.length + 1}`);
      return [...new Set(arr)];
    }
    return [];
  };

  for (const value of [meta.courtNames, advanced.courtNames, advanced.courts, meta.courts]) {
    const arr = normalizeCourtList(value);
    if (arr.length) return arr;
  }
  const fallbackCount = desiredCount || 3;
  return Array.from({ length: fallbackCount }, (_, i) => `Court ${i + 1}`);
}

export function formatDateInputValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
export function formatTimeInputValue(date) {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

// ── Player filter/count helpers ───────────────────────────────────────────────
export function computeCounts(players) {
  const counts = { all: players.length, byCategory: {} };
  players.forEach((p) => {
    const cid = getPlayerCategoryId(p) || "uncategorized";
    counts.byCategory[cid] = (counts.byCategory[cid] || 0) + 1;
  });
  return counts;
}

export function applyFilter(players) {
  if (isTournamentTeamEvent() || state.activeFilter === "all") return players;
  return players.filter(
    (p) => String(getPlayerCategoryId(p) || "") === String(state.activeFilter)
  );
}

export function getAcceptedPlayers() {
  return state.allPlayers.filter((p) => normalizeStatusPlayersPage(p) === "accepted");
}

export function getCategoryNameById(categoryId) {
  const cat = state.tournamentCategories.find(
    (c) => String(c.categoryId || c.id) === String(categoryId)
  );
  return cat ? categoryLabel(cat) : "Category";
}

// ── Team/captain helpers ──────────────────────────────────────────────────────
export function getCaptainSubmittedPlayers(captain) {
  const raw =
    captain?.teamPlayers ||
    captain?.players ||
    captain?.members ||
    captain?.submittedPlayers ||
    captain?.roster ||
    [];
  if (!Array.isArray(raw)) return [];
  return raw.map((p) => (typeof p === "string" ? { playerName: p } : p));
}

export function getConfirmedTeams() {
  return state.captainState.confirmedCaptains.map((captain) => ({
    teamKey:    `captain:${captain.playerId}`,
    captainId:  captain.playerId,
    captainName: captain.playerName,
    teamName:   captain.teamName || captain.playerName,
    categoryId: captain.categoryId,
    teamStatus: captain.teamStatus || "pending",
    teamPlayers: getCaptainSubmittedPlayers(captain),
  }));
}

export function getEditableTeamNameOptions(currentValue = "") {
  const names = [...new Set(
    getConfirmedTeams()
      .map((team) => String(team?.teamName || "").trim())
      .filter(Boolean)
  )];
  const current = String(currentValue || "").trim();
  if (current && !names.includes(current)) names.unshift(current);
  return names;
}

export function buildTeamNameSelectOptions(selectedValue = "") {
  const selected = String(selectedValue || "").trim();
  return getEditableTeamNameOptions(selected)
    .map((name) => `<option value="${escapeHtml(name)}"${name === selected ? " selected" : ""}>${escapeHtml(name)}</option>`)
    .join("");
}

export function getTeamEventFixtureBucket() {
  const categories = state.fixturesState.fixtures?.categories || {};
  return categories[TEAM_EVENT_CATEGORY_ID] || Object.values(categories)[0] || null;
}

export function firstFiniteNumber(...values) {
  for (const value of values) {
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return null;
}

// ── Fixture/match status helpers ──────────────────────────────────────────────
export function getMatchStatus(match, roundIndex = 0, matchIndex = 0) {
  const raw = match?.status ?? match?.matchStatus ?? "";
  const s = String(raw).toLowerCase();
  if (["completed", "done", "finished", "played"].includes(s)) return "completed";
  if (["in_progress", "live", "ongoing"].includes(s)) return "in_progress";
  if (match?.home && match?.away && match.home !== "BYE" && match.away !== "BYE") return "pending";
  return "pending";
}

export function getStatusPillMarkup(status) {
  const cls =
    status === "completed"   ? "pill-completed" :
    status === "in_progress" ? "pill-live"       : "pill-pending";
  const label =
    status === "completed"   ? "Done"  :
    status === "in_progress" ? "Live"  : "Pending";
  return `<span class="fixture-status-pill ${cls}">${label}</span>`;
}

export function hasLiveCategoryProgress(category) {
  const rounds = Array.isArray(category?.rounds) ? category.rounds : [];
  return rounds.some((round) =>
    Array.isArray(round) &&
    round.some((match) => {
      const s = getMatchStatus(match);
      return s === "completed" || s === "in_progress";
    })
  );
}

export function getFixtureMatchPoints(match, side) {
  const v = side === "home"
    ? (match?.homeScore ?? match?.homePoints ?? match?.home_score ?? null)
    : (match?.awayScore ?? match?.awayPoints ?? match?.away_score ?? null);
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function getTeamTieStatusFromState(teamTieState) {
  if (!teamTieState) return "pending";
  const { home, away } = teamTieState;
  if (!home || !away) return "pending";
  const hP = Number(home.matchPoints || 0), aP = Number(away.matchPoints || 0);
  if (hP === 0 && aP === 0) return "pending";
  return "completed";
}

export function getCategoryMatchPointsFromSnapshot(category) {
  const snap = category?.matchPointsSnapshot;
  if (!snap) return { home: 0, away: 0 };
  return {
    home: Number(snap.home || snap.homeMatchPoints || 0),
    away: Number(snap.away || snap.awayMatchPoints || 0),
  };
}

export function buildTeamTieStateFromSubmatches(match) {
  const submatches = Array.isArray(match?.submatches) ? match.submatches : [];
  let hP = 0, aP = 0, hW = 0, aW = 0;
  submatches.forEach((sm) => {
    hP += Number(sm?.homeScore ?? sm?.homePoints ?? 0);
    aP += Number(sm?.awayScore ?? sm?.awayPoints ?? 0);
    const hs = Number(sm?.homeScore ?? 0), as_ = Number(sm?.awayScore ?? 0);
    if (hs > as_) hW++;
    else if (as_ > hs) aW++;
  });
  return {
    home: { matchPoints: hP, categoryWins: hW },
    away: { matchPoints: aP, categoryWins: aW },
  };
}

export function getBackendTeamTieState(match) {
  return match?.teamTieState || match?.tieState || null;
}

export function getTeamTieMatchPointsFromState(teamTieState) {
  if (!teamTieState) return { home: 0, away: 0 };
  return {
    home: Number(teamTieState?.home?.matchPoints || 0),
    away: Number(teamTieState?.away?.matchPoints || 0),
  };
}

export function getSortedLeaderboardRows() {
  return [...(state.leaderboardState.rows || [])].sort(
    (a, b) =>
      (Number(b.matchPoints || 0) - Number(a.matchPoints || 0)) ||
      (Number(b.matchesPlayed || 0) - Number(a.matchesPlayed || 0)) ||
      String(a.teamName || "").localeCompare(String(b.teamName || ""))
  );
}

export function getQualifiedLeaderboardRows() {
  return getSortedLeaderboardRows().filter((r) => r.qualified);
}

// ── Fixture leaderboard (deduped — FIX 8) ────────────────────────────────────
export function computeGroupLeaderboardRows(cat, roundIndex) {
  const roundMatches = Array.isArray(cat?.rounds?.[roundIndex]) ? cat.rounds[roundIndex] : [];
  const stats = new Map();

  const ensureEntry = (name) => {
    const key = String(name || "").trim();
    if (!key || key === "BYE" || key === "TBD") return null;
    if (!stats.has(key)) {
      stats.set(key, { teamName: key, rank: 0, matchPoints: 0, matchesPlayed: 0, qualified: false });
    }
    return stats.get(key);
  };

  roundMatches.forEach((match, matchIndex) => {
    const home = ensureEntry(match?.home);
    const away = ensureEntry(match?.away);
    if (!home || !away) return;
    if (getMatchStatus(match, roundIndex, matchIndex) !== "completed") return;
    home.matchesPlayed += 1; away.matchesPlayed += 1;
    home.matchPoints += getFixtureMatchPoints(match, "home");
    away.matchPoints += getFixtureMatchPoints(match, "away");
  });

  return [...stats.values()]
    .sort((a, b) =>
      (Number(b.matchPoints || 0) - Number(a.matchPoints || 0)) ||
      (Number(b.matchesPlayed || 0) - Number(a.matchesPlayed || 0)) ||
      String(a.teamName || "").localeCompare(String(b.teamName || ""))
    )
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

// Aliases kept for any call sites that use the old names
export const getGenericGroupLeaderboardRows = computeGroupLeaderboardRows;
export const getGroupLeaderboardRows        = computeGroupLeaderboardRows;

// ── API helpers ───────────────────────────────────────────────────────────────
export async function apiJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: "Bearer " + AUTH_TOKEN,
    },
  });
  const raw = await res.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  return { ok: res.ok, status: res.status, data };
}
export async function apiGet(url)        { return apiJson(url, { method: "GET" }); }
export async function apiPost(url, body) {
  return apiJson(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
}
export async function apiPut(url, body) {
  return apiJson(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
}
export async function apiPatch(url, body) {
  return apiJson(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
}
