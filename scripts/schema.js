const schemaListEl = document.getElementById("schemaList");
const schemaSubEl = document.getElementById("schemaSub");
const pillCategory = document.getElementById("pillCategory");
const pillSport = document.getElementById("pillSport");

const btnSuggest = document.getElementById("btnSuggest");
const btnSelectAll = document.getElementById("btnSelectAll");
const btnSelectNone = document.getElementById("btnSelectNone");
const btnFinalize = document.getElementById("btnFinalize");
const btnAddField = document.getElementById("btnAddField");

const modalBackdrop = document.getElementById("modalBackdrop");
const btnCloseModal = document.getElementById("btnCloseModal");
const btnSaveField = document.getElementById("btnSaveField");

const fLabel = document.getElementById("fLabel");
const fKey = document.getElementById("fKey");
const fType = document.getElementById("fType");
const fGroup = document.getElementById("fGroup");
const fLevel = document.getElementById("fLevel");
const fOrder = document.getElementById("fOrder");
const fDefault = document.getElementById("fDefault");
const fHelp = document.getElementById("fHelp");

const qs = new URLSearchParams(window.location.search);
const tournamentId = qs.get("tournamentId") || "";
const categoryId = qs.get("categoryId") || "";

let draft = null;
let activeByCategory = {};
let customFields = []; // added by host

function authHeader() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiGet(path) {
  const r = await fetch(path, { headers: { ...authHeader() } });
  const data = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, data };
}
async function apiPost(path, body) {
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify(body || {})
  });
  const data = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, data };
}

function render() {
  schemaListEl.innerHTML = "";
  if (!draft?.playerFields?.length) {
    schemaListEl.innerHTML = `<div class="schema-meta">No draft schema yet. Click “Generate AI Suggestions”.</div>`;
    return;
  }

  const fields = [...draft.playerFields];

  // sort basic -> pro, then order
  const levelRank = { basic: 0, intermediate: 1, advanced: 2, pro: 3 };
  fields.sort((a, b) => {
    const la = levelRank[a.level] ?? 99;
    const lb = levelRank[b.level] ?? 99;
    if (la !== lb) return la - lb;
    return (a.order ?? 999) - (b.order ?? 999);
  });

  const selectedSet = new Set(
    (activeByCategory?.[categoryId]?.playerFields || []).map((f) => f.key)
  );

  fields.forEach((f) => {
    const checked = selectedSet.has(f.key);

    const div = document.createElement("div");
    div.className = "schema-item";
    div.innerHTML = `
      <input class="chk" type="checkbox" data-key="${f.key}" ${checked ? "checked" : ""} style="margin-top:4px;">
      <div style="flex:1;">
        <div class="row" style="justify-content:space-between;">
          <h4>${f.label} <span class="schema-meta">(${f.key})</span></h4>
          <div class="row">
            <span class="pill">${f.group}</span>
            <span class="pill">${f.level}</span>
            <span class="pill">${f.type}</span>
          </div>
        </div>
        <div class="schema-meta">${f.help || ""}</div>
      </div>
    `;
    schemaListEl.appendChild(div);
  });
}

function getSelectedKeysFromUI() {
  const keys = [];
  document.querySelectorAll(".chk").forEach((c) => {
    if (c.checked) keys.push(c.dataset.key);
  });
  return keys;
}

btnSelectAll?.addEventListener("click", () => {
  document.querySelectorAll(".chk").forEach((c) => (c.checked = true));
});
btnSelectNone?.addEventListener("click", () => {
  document.querySelectorAll(".chk").forEach((c) => (c.checked = false));
});

btnAddField?.addEventListener("click", () => {
  modalBackdrop.style.display = "flex";
  fLabel.value = "";
  fKey.value = "";
  fType.value = "counter";
  fGroup.value = "custom";
  fLevel.value = "pro";
  fOrder.value = "999";
  fDefault.value = "0";
  fHelp.value = "";
});

btnCloseModal?.addEventListener("click", () => {
  modalBackdrop.style.display = "none";
});

function slugKey(label) {
  const s = String(label || "").trim();
  if (!s) return "";
  const parts = s.replace(/[^a-zA-Z0-9 ]/g, " ").split(" ").filter(Boolean);
  if (!parts.length) return "";
  return parts[0].toLowerCase() + parts.slice(1).map(p => p[0].toUpperCase() + p.slice(1).toLowerCase()).join("");
}

btnSaveField?.addEventListener("click", () => {
  const label = String(fLabel.value || "").trim();
  let key = String(fKey.value || "").trim();
  if (!key) key = slugKey(label);

  if (!label || !key) {
    alert("Label and key required");
    return;
  }

  customFields.push({
    label,
    key,
    type: fType.value,
    group: fGroup.value || "custom",
    level: fLevel.value || "pro",
    order: Number(fOrder.value || 999),
    default: (() => {
      if (fType.value === "boolean") return false;
      if (fType.value === "text") return "";
      if (fType.value === "select") return null;
      return Number(fDefault.value || 0);
    })(),
    min: 0,
    max: null,
    help: fHelp.value || null
  });

  modalBackdrop.style.display = "none";
  alert("Custom field added. It will be included when you click Finalize & Save.");
});

btnSuggest?.addEventListener("click", async () => {
  if (!tournamentId) return alert("Missing tournamentId");
  btnSuggest.disabled = true;
  try {
    const resp = await apiPost(`/api/host/tournaments/${encodeURIComponent(tournamentId)}/scoring-schema/suggest`, {
      context: { matchType: "auto" }
    });
    if (!resp.ok) return alert(resp.data?.message || "Failed");

    // refresh everything
    const g = await apiGet(`/api/host/tournaments/${encodeURIComponent(tournamentId)}/scoring-schema`);
    draft = g.data?.draft || resp.data?.draft || null;
    activeByCategory = g.data?.activeByCategory || {};
    render();
  } finally {
    btnSuggest.disabled = false;
  }
});

btnFinalize?.addEventListener("click", async () => {
  if (!tournamentId || !categoryId) return alert("Missing tournamentId/categoryId");
  const selectedKeys = getSelectedKeysFromUI();
  if (!selectedKeys.length && !customFields.length) return alert("Select at least 1 field or add a custom field.");

  btnFinalize.disabled = true;
  try {
    const resp = await apiPost(`/api/host/tournaments/${encodeURIComponent(tournamentId)}/scoring-schema/finalize`, {
      categoryId,
      selectedKeys,
      customFields
    });

    if (!resp.ok) return alert(resp.data?.message || "Failed to finalize");

    alert("✅ Scoring fields saved for this category");
    // redirect back to fixtures
    window.location.href = `fixtures.html?tournamentId=${encodeURIComponent(tournamentId)}`;
  } finally {
    btnFinalize.disabled = false;
  }
});

(async function init() {
  if (!tournamentId || !categoryId) {
    schemaSubEl.textContent = "Missing tournamentId or categoryId";
    return;
  }

  pillCategory.textContent = `Category: ${categoryId}`;
  schemaSubEl.textContent = `Tournament: ${tournamentId}`;
  const g = await apiGet(`/api/host/tournaments/${encodeURIComponent(tournamentId)}/scoring-schema`);
  draft = g.data?.draft || null;
  activeByCategory = g.data?.activeByCategory || {};

  // best effort: show sport name from draft if exists
  pillSport.textContent = `Sport: ${draft?.sport || "—"}`;

  render();
})();
