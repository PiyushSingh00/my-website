// scripts/schema.js
import { requireAuth } from "./auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;

  // ---- Read query params ----
  const params = new URLSearchParams(window.location.search);
  const tournamentId = params.get("tournamentId");
  const categoryId = params.get("categoryId");

  // ---- DOM refs (IDs MUST match schema.html) ----
  const elTid = document.getElementById("schema-tournament-id");
  const elCid = document.getElementById("schema-category-id");
  const elSport = document.getElementById("schema-sport-name");
  const elMsg = document.getElementById("schema-msg");
  const elEmpty = document.getElementById("schema-empty");
  const elErr = document.getElementById("schema-error");
  const elFields = document.getElementById("schema-fields");

  const btnBack = document.getElementById("btn-back");
  const btnGen = document.getElementById("btn-generate-ai");
  const btnAll = document.getElementById("btn-select-all");
  const btnNone = document.getElementById("btn-select-none");
  const btnFinalize = document.getElementById("btn-finalize");

  const btnAddCustom = document.getElementById("btn-add-custom");
  const btnAddCustomInline = document.getElementById("btn-add-custom-inline");

  const customKey = document.getElementById("custom-key");
  const customLabel = document.getElementById("custom-label");
  const customType = document.getElementById("custom-type");
  const customLevel = document.getElementById("custom-level");

  // ---- Guard: if any are missing, stop with a clear error ----
  const mustExist = [
    ["schema-tournament-id", elTid],
    ["schema-category-id", elCid],
    ["schema-sport-name", elSport],
    ["schema-fields", elFields],
    ["btn-generate-ai", btnGen],
    ["btn-finalize", btnFinalize],
  ];
  for (const [id, node] of mustExist) {
    if (!node) {
      // This avoids your "textContent of null" crash
      alert(`schema.html missing element id="${id}". Fix HTML IDs and reload.`);
      return;
    }
  }

  elTid.textContent = tournamentId || "—";
  elCid.textContent = categoryId || "—";

  if (!tournamentId || !categoryId) {
    showError("Missing tournamentId/categoryId in URL.");
    return;
  }

  btnBack?.addEventListener("click", () => {
    // go back to fixtures with the tournamentId
    window.location.href = `fixtures.html?tournamentId=${encodeURIComponent(tournamentId)}`;
  });

  // ---- State ----
  let draft = null; // { sport, version, playerFields, inputs, winnerLogic }
  let selectedKeys = new Set();

  // ---- Helpers ----
  function showError(msg) {
    elErr.style.display = "block";
    elErr.textContent = msg;
  }
  function clearError() {
    elErr.style.display = "none";
    elErr.textContent = "";
  }
  function setMsg(msg) {
    if (!elMsg) return;
    elMsg.textContent = msg || "";
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

  async function apiPost(url, body) {
    return apiJson(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
  }

  // ---- Render ----
  function render() {
    elFields.innerHTML = "";
    clearError();

    if (!draft) {
      elEmpty.style.display = "block";
      return;
    }
    elEmpty.style.display = "none";

    elSport.textContent = draft.sport || "—";

    const fields = Array.isArray(draft.playerFields) ? draft.playerFields : [];
    if (!fields.length) {
      elFields.innerHTML = `<div class="muted">No playerFields returned. Click “Generate AI Suggestions”.</div>`;
      return;
    }

    for (const f of fields) {
      const key = String(f.key || "").trim();
      const label = String(f.label || key || "Field");
      const type = String(f.type || "counter");
      const level = String(f.level || "basic"); // if your backend doesn’t send level yet, it will show basic
      const help = f.help ? String(f.help) : "";

      const row = document.createElement("div");
      row.className = "field-row";
      row.innerHTML = `
        <input type="checkbox" ${selectedKeys.has(key) ? "checked" : ""} data-key="${key}">
        <div class="field-main">
          <div class="field-title">${label}</div>
          <div class="field-sub">${help || ""}</div>
          <div class="field-tags">
            <span class="tag">${type}</span>
            <span class="tag">${level}</span>
            <span class="tag">${key}</span>
          </div>
        </div>
      `;
      row.querySelector('input[type="checkbox"]').addEventListener("change", (e) => {
        if (e.target.checked) selectedKeys.add(key);
        else selectedKeys.delete(key);
      });

      elFields.appendChild(row);
    }
  }

  // ---- Actions ----
  btnGen.addEventListener("click", async () => {
    setMsg("Generating AI suggestions…");
    clearError();

    // This MUST match your backend route (you already have /scoring-schema/auto)
    const url = `/api/host/tournaments/${encodeURIComponent(tournamentId)}/scoring-schema/auto`;

    const r = await apiPost(url, { context: { categoryId } });

    if (!r.ok) {
      showError(`AI generate failed (${r.status}). Check backend logs.`);
      setMsg("");
      return;
    }

    // Backend returns { ok:true, scoringSchema: generated } in your current code
    draft = r.data?.scoringSchema || null;

    // Default: select everything in draft initially
    selectedKeys = new Set((draft?.playerFields || []).map((x) => x.key).filter(Boolean));

    setMsg("AI suggestions loaded. Review and finalize.");
    render();
  });

  btnAll?.addEventListener("click", () => {
    if (!draft) return;
    selectedKeys = new Set((draft.playerFields || []).map((x) => x.key).filter(Boolean));
    render();
  });

  btnNone?.addEventListener("click", () => {
    selectedKeys = new Set();
    render();
  });

  function addCustomField() {
    if (!draft) {
      draft = { sport: "", version: "1.0", inputs: [], playerFields: [], winnerLogic: {} };
    }
    const key = String(customKey.value || "").trim();
    const label = String(customLabel.value || "").trim();
    const type = String(customType.value || "counter");
    const level = String(customLevel.value || "basic");

    if (!key || !/^[a-z0-9_]+$/.test(key)) {
      showError("Custom key must be lowercase and use only a-z, 0-9, underscore.");
      return;
    }
    if (!label) {
      showError("Custom label is required.");
      return;
    }

    const exists = (draft.playerFields || []).some((x) => x.key === key);
    if (exists) {
      showError("That key already exists in the list.");
      return;
    }

    draft.playerFields = draft.playerFields || [];
    draft.playerFields.push({
      key,
      label,
      type,
      default: type === "counter" ? 0 : null,
      min: type === "counter" ? 0 : null,
      max: null,
      help: null,
      level,
      order: 999,
    });

    selectedKeys.add(key);
    customKey.value = "";
    customLabel.value = "";
    clearError();
    setMsg("Custom field added.");
    render();
  }

  btnAddCustom?.addEventListener("click", addCustomField);
  btnAddCustomInline?.addEventListener("click", addCustomField);

  btnFinalize.addEventListener("click", async () => {
    if (!draft) {
      showError("Generate AI suggestions first.");
      return;
    }
    const filtered = {
      ...draft,
      playerFields: (draft.playerFields || []).filter((f) => selectedKeys.has(f.key)),
    };

    setMsg("Saving selection…");
    clearError();

    // NOTE: this endpoint must exist in backend Step B/C.
    // If you already created: scoringSchemaActiveByCategory map, save there.
    const url = `/api/host/tournaments/${encodeURIComponent(tournamentId)}/scoring-schema/finalize`;
    const r = await apiPost(url, { categoryId, scoringSchema: filtered });

    if (!r.ok) {
      showError(`Finalize failed (${r.status}). If endpoint missing, implement it in backend next.`);
      setMsg("");
      return;
    }

    setMsg("Saved ✅ You can now start scoring from fixtures.");
  });

  // Initial render (no draft yet)
  render();
});
