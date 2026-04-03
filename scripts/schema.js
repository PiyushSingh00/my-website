import { requireAuth, logout } from "./auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;

  const params = new URLSearchParams(window.location.search);
  const tournamentId = params.get("tournamentId");
  const categoryId = params.get("categoryId");

  if (!tournamentId || !categoryId) {
    alert("Missing tournamentId or categoryId in URL.");
    return;
  }

  // topbar
  const trigger = document.getElementById("schema-user-menu-trigger");
  const dropdown = document.getElementById("schema-user-menu-dropdown");
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

  document.getElementById("mode-player-btn")?.addEventListener("click", async () => {
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

  document.getElementById("mode-host-btn")?.classList.add("is-active");

  const titleEl = document.getElementById("schema-title");
  const metaEl = document.getElementById("schema-meta");
  const statusEl = document.getElementById("schema-status");

  const configList = document.getElementById("config-fields-list");
  const playerList = document.getElementById("player-fields-list");
  const logicBox = document.getElementById("winner-logic-box");

  const backBtn = document.getElementById("schema-back-btn");
  const refreshBtn = document.getElementById("schema-refresh-btn");
  const finalizeBtn = document.getElementById("schema-finalize-btn");

  let tournamentMeta = null;
  let categoryMeta = null;
  let draftSchema = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async function apiJson(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: "Bearer " + (localStorage.getItem("token") || ""),
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

  function defaultSchemaForSport(sportName = "") {
    const sport = String(sportName).toLowerCase();

    if (sport.includes("badminton") || sport.includes("pickleball")) {
      return {
        sport: sportName,
        inputs: [
          { key: "targetPoints", label: "Target points", type: "number", default: 11, min: 1 },
          { key: "winByTwo", label: "Win by two", type: "boolean", default: true },
        ],
        playerFields: [
          { key: "points", label: "Points", type: "counter", default: 0, min: 0 },
          { key: "aces", label: "Aces", type: "counter", default: 0, min: 0 },
        ],
        winnerLogic: {
          type: "firstToTarget",
          field: "points",
          targetFrom: "targetPoints",
          winByTwoFrom: "winByTwo",
        },
      };
    }

    if (sport.includes("football")) {
      return {
        sport: sportName,
        inputs: [],
        playerFields: [
          { key: "goals", label: "Goals", type: "counter", default: 0, min: 0 },
          { key: "assists", label: "Assists", type: "counter", default: 0, min: 0 },
        ],
        winnerLogic: {
          type: "higherScoreWins",
          field: "goals",
        },
      };
    }

    if (sport.includes("cricket")) {
      return {
        sport: sportName,
        inputs: [],
        playerFields: [
          { key: "runs", label: "Runs", type: "counter", default: 0, min: 0 },
          { key: "wickets", label: "Wickets", type: "counter", default: 0, min: 0 },
        ],
        winnerLogic: {
          type: "higherScoreWins",
          field: "runs",
        },
      };
    }

    return {
      sport: sportName,
      inputs: [],
      playerFields: [{ key: "score", label: "Score", type: "counter", default: 0, min: 0 }],
      winnerLogic: {
        type: "higherScoreWins",
        field: "score",
      },
    };
  }

  async function loadTournamentMeta() {
    const r = await apiGet("/api/host/tournaments");
    if (!r.ok) return null;

    const list = Array.isArray(r.data)
      ? r.data
      : Array.isArray(r.data?.data)
        ? r.data.data
        : Array.isArray(r.data?.tournaments)
          ? r.data.tournaments
          : [];

    return list.find((x) => String(x.tournamentId ?? x.id) === String(tournamentId)) || null;
  }

  function renderFieldRow(field, listName, index) {
    return `
      <div class="field-row" data-list="${escapeHtml(listName)}" data-index="${index}">
        <input type="checkbox" class="field-enabled" checked />
        <div class="field-main">
          <div class="field-title">${escapeHtml(field.label || field.key)}</div>
          <div class="field-sub">${escapeHtml(field.type || "field")} • key: ${escapeHtml(field.key)}</div>
          <div class="field-tags">
            ${field.default !== undefined ? `<span class="tag">default ${escapeHtml(field.default)}</span>` : ""}
            ${field.min !== undefined ? `<span class="tag">min ${escapeHtml(field.min)}</span>` : ""}
          </div>
        </div>
      </div>
    `;
  }

  function renderSchema() {
    if (!draftSchema) return;

    titleEl.textContent = `Configure scoring schema`;
    metaEl.textContent = `${tournamentMeta?.tournamentName || "Tournament"} • ${categoryLabel(categoryMeta || {})}`;
    statusEl.textContent = "Draft loaded. Review and finalize.";

    configList.innerHTML = "";
    playerList.innerHTML = "";
    logicBox.innerHTML = "";

    const inputs = Array.isArray(draftSchema.inputs) ? draftSchema.inputs : [];
    const playerFields = Array.isArray(draftSchema.playerFields) ? draftSchema.playerFields : [];

    if (!inputs.length) {
      configList.innerHTML = `<div class="muted">No match config fields.</div>`;
    } else {
      configList.innerHTML = inputs.map((f, i) => renderFieldRow(f, "inputs", i)).join("");
    }

    if (!playerFields.length) {
      playerList.innerHTML = `<div class="muted">No player fields.</div>`;
    } else {
      playerList.innerHTML = playerFields.map((f, i) => renderFieldRow(f, "playerFields", i)).join("");
    }

    logicBox.innerHTML = `
      <div class="tag">type: ${escapeHtml(draftSchema.winnerLogic?.type || "-")}</div>
      <div class="tag">field: ${escapeHtml(draftSchema.winnerLogic?.field || "-")}</div>
      ${draftSchema.winnerLogic?.targetFrom ? `<div class="tag">target: ${escapeHtml(draftSchema.winnerLogic.targetFrom)}</div>` : ""}
      ${draftSchema.winnerLogic?.winByTwoFrom ? `<div class="tag">winByTwo: ${escapeHtml(draftSchema.winnerLogic.winByTwoFrom)}</div>` : ""}
    `;
  }

  function collectSelectedSchema() {
    const clone = JSON.parse(JSON.stringify(draftSchema || {}));

    ["inputs", "playerFields"].forEach((listName) => {
      const rows = Array.from(document.querySelectorAll(`.field-row[data-list="${listName}"]`));
      const source = Array.isArray(clone[listName]) ? clone[listName] : [];
      clone[listName] = rows
        .map((row, idx) => {
          const enabled = row.querySelector(".field-enabled")?.checked;
          return enabled ? source[idx] : null;
        })
        .filter(Boolean);
    });

    return clone;
  }

  async function refreshSuggestion() {
    statusEl.textContent = "Fetching schema suggestion...";

    const body = {
      tournamentId,
      categoryId,
      sportName: tournamentMeta?.sportName || "",
      categoryLabel: categoryLabel(categoryMeta || {}),
      tournamentType: tournamentMeta?.tournamentType || "",
      advancedSettings: tournamentMeta?.advancedSettings || null,
    };

    const candidates = [
      `/api/host/tournaments/${encodeURIComponent(tournamentId)}/scoring-schema/suggest`,
      `/api/host/tournaments/${encodeURIComponent(tournamentId)}/scoring-schema`,
    ];

    let loaded = null;

    for (const url of candidates) {
      const r = await apiPost(url, body);
      if (!r.ok) continue;

      loaded =
        r.data?.draft ||
        r.data?.scoringSchema ||
        r.data?.data?.draft ||
        r.data?.data?.scoringSchema ||
        r.data?.data ||
        r.data;

      if (loaded) break;
    }

    if (!loaded) {
      loaded = defaultSchemaForSport(tournamentMeta?.sportName || "");
      statusEl.textContent = "Could not fetch backend suggestion. Loaded default schema.";
    } else {
      statusEl.textContent = "Suggestion refreshed from backend.";
    }

    draftSchema = loaded;
    renderSchema();
  }

  async function loadExistingOrSuggestedSchema() {
    statusEl.textContent = "Loading schema...";

    const existingCandidates = [
      `/api/host/tournaments/${encodeURIComponent(tournamentId)}/scoring-schema/active?categoryId=${encodeURIComponent(categoryId)}`,
      `/api/host/tournaments/${encodeURIComponent(tournamentId)}/scoring-schema?categoryId=${encodeURIComponent(categoryId)}`,
    ];

    for (const url of existingCandidates) {
      const r = await apiGet(url);
      if (!r.ok) continue;

      const loaded = r.data?.data || r.data;
      if (loaded) {
        draftSchema = loaded;
        statusEl.textContent = "Loaded existing active schema.";
        renderSchema();
        return;
      }
    }

    await refreshSuggestion();
  }

  refreshBtn?.addEventListener("click", refreshSuggestion);

  finalizeBtn?.addEventListener("click", async () => {
  const schemaToSave = collectSelectedSchema();
  statusEl.textContent = "Saving finalized schema...";

  const payload = {
    categoryId,
    scoringSchema: schemaToSave,
  };

  const candidates = [
    `/api/host/tournaments/${encodeURIComponent(tournamentId)}/scoring-schema/finalize`,
    `/api/host/tournaments/${encodeURIComponent(tournamentId)}/scoring-schema`,
  ];

  for (const url of candidates) {
    const r = await apiPost(url, url.includes("/finalize") ? payload : { schema: schemaToSave });
    if (r.ok) {
      statusEl.textContent = "Schema finalized successfully.";
      alert("Scoring schema finalized.");
      return;
    }
  }

  statusEl.textContent = "Could not finalize schema.";
  alert("Could not finalize schema. Check backend route.");
});

  backBtn?.addEventListener("click", () => {
    window.location.href = `fixtures.html?tournamentId=${encodeURIComponent(tournamentId)}`;
  });

  tournamentMeta = await loadTournamentMeta();
  if (!tournamentMeta) {
    statusEl.textContent = "Could not load tournament.";
    return;
  }

  const categories = normalizeCategories(tournamentMeta.categories);
  categoryMeta = categories.find((c) => String(c.categoryId || c.id) === String(categoryId)) || null;

  await loadExistingOrSuggestedSchema();
});