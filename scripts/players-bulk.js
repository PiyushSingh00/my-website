/**
 * players-bulk.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Bulk CSV player-upload modal: parsing, preview table, save.
 * Lazy-loaded — only imported when the "Add players via excel" button is clicked.
 *
 * FIX 12 (module split): extracted from the monolithic players.js
 * FIX  2 (keystroke): input handler only updates model + summary; no full re-render
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  state,
  TEAM_EVENT_CATEGORY_ID,
  escapeHtml,
  categoryLabel,
  isTournamentTeamEvent,
  normalizeStatusPlayersPage,
  apiPost,
} from "./players-utils.js";

// ── DOM refs (resolved once on init) ─────────────────────────────────────────
let _dom = null;
function dom() {
  if (_dom) return _dom;
  _dom = {
    modal:          document.getElementById("host-bulk-player-modal"),
    close:          document.getElementById("host-bulk-player-close"),
    closeFooter:    document.getElementById("host-bulk-player-close-footer"),
    file:           document.getElementById("host-bulk-player-file"),
    previewWrap:    document.getElementById("bulk-player-preview-wrap"),
    previewBody:    document.getElementById("bulk-player-preview-body"),
    selectAll:      document.getElementById("bulk-player-select-all"),
    saveBtn:        document.getElementById("bulk-player-save-btn"),
    clearBtn:       document.getElementById("bulk-player-clear-btn"),
    summary:        document.getElementById("bulk-player-summary"),
  };
  return _dom;
}

// ── Exported entry point (called from players.js on button click) ─────────────
export function openBulkPlayerModal() {
  resetBulkPlayerState();
  const d = dom();
  d.modal?.classList.remove("hidden");
  d.modal?.setAttribute("aria-hidden", "false");
  bindBulkModalListeners();
}

// ── Internal: bind listeners once ────────────────────────────────────────────
let _listenersAttached = false;
function bindBulkModalListeners() {
  if (_listenersAttached) return;
  _listenersAttached = true;
  const d = dom();

  d.close?.addEventListener("click", closeBulkPlayerModal);
  d.closeFooter?.addEventListener("click", closeBulkPlayerModal);
  d.modal?.addEventListener("click", (e) => { if (e.target === d.modal) closeBulkPlayerModal(); });
  d.clearBtn?.addEventListener("click", resetBulkPlayerState);

  d.selectAll?.addEventListener("change", () => {
    state.bulkPlayerRows = state.bulkPlayerRows.map((row) => ({
      ...row,
      __selected: d.selectAll.checked,
    }));
    renderBulkPlayerPreview();
  });

  d.file?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    state.bulkPlayerRows = parseCsvText(text).map((row, idx) =>
      normalizeImportedPlayerRow(row, idx)
    );
    renderBulkPlayerPreview();
  });

  d.saveBtn?.addEventListener("click", handleBulkSave);
}

function closeBulkPlayerModal() {
  const d = dom();
  d.modal?.classList.add("hidden");
  d.modal?.setAttribute("aria-hidden", "true");
}

function resetBulkPlayerState() {
  state.bulkPlayerRows = [];
  const d = dom();
  if (d.file) d.file.value = "";
  if (d.previewBody) d.previewBody.innerHTML = "";
  d.previewWrap?.classList.add("hidden");
  if (d.selectAll) d.selectAll.checked = false;
  if (d.summary) {
    d.summary.textContent =
      "Expected columns: playerName, age, gender, phone, categoryId. For team events, categoryId can be blank.";
  }
}

// ── CSV parsing ───────────────────────────────────────────────────────────────
function splitCsvLine(line) {
  const result = []; let current = ""; let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i], next = line[i + 1];
    if (ch === '"' && inQuotes && next === '"') { current += '"'; i += 1; continue; }
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === "," && !inQuotes) { result.push(current.trim()); current = ""; continue; }
    current += ch;
  }
  result.push(current.trim());
  return result;
}

function parseCsvText(text) {
  const lines = String(text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const values = splitCsvLine(lines[i]);
    const row = {};
    headers.forEach((header, idx) => { row[header] = values[idx] ?? ""; });
    rows.push(row);
  }
  return rows;
}

function normalizeImportedPlayerRow(row, index) {
  const isTeam = isTournamentTeamEvent();
  const rawCategory = String(row.categoryId || row.category || "").trim();
  const normalized = {
    __rowIndex: index,
    __selected: true,
    __valid:    true,
    __message:  "Ready",
    playerName: String(row.playerName || row.name || "").trim(),
    age:        String(row.age || "").trim(),
    gender:     String(row.gender || "").trim(),
    phone:      String(row.phone || row.phoneNumber || "").trim(),
    categoryId: isTeam ? TEAM_EVENT_CATEGORY_ID : rawCategory,
  };
  if (!normalized.playerName)                    { normalized.__valid = false; normalized.__message = "Missing name"; }
  else if (!normalized.phone)                    { normalized.__valid = false; normalized.__message = "Missing phone"; }
  else if (!isTeam && !normalized.categoryId)    { normalized.__valid = false; normalized.__message = "Missing category"; }
  return normalized;
}

function revalidateBulkRow(idx) {
  state.bulkPlayerRows[idx] = normalizeImportedPlayerRow(state.bulkPlayerRows[idx], idx);
}

// ── Summary line (cheap — no DOM rebuild) ────────────────────────────────────
function syncBulkSummary() {
  const d = dom();
  if (!d.summary) return;
  const total    = state.bulkPlayerRows.length;
  const selected = state.bulkPlayerRows.filter((r) => r.__selected).length;
  const valid    = state.bulkPlayerRows.filter((r) => r.__selected && r.__valid).length;
  d.summary.textContent = `${selected} selected out of ${total}. ${valid} selected row(s) are valid.`;
}

// ── Category cell HTML ────────────────────────────────────────────────────────
function renderBulkCategoryCell(row, idx) {
  if (isTournamentTeamEvent()) {
    return `<span class="muted">${escapeHtml(TEAM_EVENT_CATEGORY_ID)}</span>`;
  }
  return `
    <select data-bulk-field="categoryId" data-bulk-idx="${idx}">
      <option value="">Select category</option>
      ${state.tournamentCategories.map((cat) => {
        const value    = String(cat.categoryId || cat.id || "");
        const selected = value === String(row.categoryId || "");
        return `<option value="${escapeHtml(value)}" ${selected ? "selected" : ""}>${escapeHtml(categoryLabel(cat))}</option>`;
      }).join("")}
    </select>`;
}

// ── Preview table (full rebuild — only on file-load or select-all) ────────────
function renderBulkPlayerPreview() {
  const d = dom();
  if (!d.previewBody) return;
  d.previewBody.innerHTML = "";
  if (!state.bulkPlayerRows.length) { d.previewWrap?.classList.add("hidden"); return; }
  d.previewWrap?.classList.remove("hidden");

  state.bulkPlayerRows.forEach((row, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="checkbox" data-bulk-check="${idx}" ${row.__selected ? "checked" : ""} /></td>
      <td><input type="text"   data-bulk-field="playerName" data-bulk-idx="${idx}" value="${escapeHtml(row.playerName)}" /></td>
      <td><input type="number" data-bulk-field="age"        data-bulk-idx="${idx}" value="${escapeHtml(row.age)}" /></td>
      <td>
        <select data-bulk-field="gender" data-bulk-idx="${idx}">
          <option value="">Select</option>
          <option value="Male"   ${row.gender === "Male"   ? "selected" : ""}>Male</option>
          <option value="Female" ${row.gender === "Female" ? "selected" : ""}>Female</option>
          <option value="Other"  ${row.gender === "Other"  ? "selected" : ""}>Other</option>
        </select>
      </td>
      <td><input type="tel" data-bulk-field="phone" data-bulk-idx="${idx}" value="${escapeHtml(row.phone)}" /></td>
      <td>${renderBulkCategoryCell(row, idx)}</td>
      <td>${escapeHtml(row.__message)}</td>`;
    d.previewBody.appendChild(tr);
  });

  // FIX 2: bind listeners after render
  bindBulkPreviewInputs();
  syncBulkSummary();
}

// ── Per-row input listeners (FIX 2 — no full re-render on every keystroke) ───
function bindBulkPreviewInputs() {
  const d = dom();
  d.previewBody?.querySelectorAll("[data-bulk-field]").forEach((el) => {
    // input: only sync model + summary
    el.addEventListener("input", () => {
      const idx = Number(el.dataset.bulkIdx);
      state.bulkPlayerRows[idx][el.dataset.bulkField] = el.value;
      revalidateBulkRow(idx);
      syncBulkSummary();
    });
    // change: sync model + update only the message cell
    el.addEventListener("change", () => {
      const idx = Number(el.dataset.bulkIdx);
      state.bulkPlayerRows[idx][el.dataset.bulkField] = el.value;
      revalidateBulkRow(idx);
      const msgCell = el.closest("tr")?.lastElementChild;
      if (msgCell) msgCell.textContent = state.bulkPlayerRows[idx].__message;
      syncBulkSummary();
    });
  });
  d.previewBody?.querySelectorAll("[data-bulk-check]").forEach((el) => {
    el.addEventListener("change", () => {
      state.bulkPlayerRows[Number(el.dataset.bulkCheck)].__selected = el.checked;
      syncBulkSummary();
    });
  });
}

// ── Save ──────────────────────────────────────────────────────────────────────
function buildBulkSavePayload() {
  return state.bulkPlayerRows
    .filter((row) => row.__selected && row.__valid)
    .map((row) => ({
      playerName:   row.playerName,
      age:          row.age ? Number(row.age) : null,
      gender:       row.gender,
      phone:        row.phone,
      categoryId:   isTournamentTeamEvent() ? TEAM_EVENT_CATEGORY_ID : row.categoryId,
      status:       "accepted",
      addedByHost:  true,
    }));
}

async function handleBulkSave() {
  const players = buildBulkSavePayload();
  if (!players.length) { alert("No valid selected players to save."); return; }

  // Dynamically import loadPlayers from players-core to avoid circular deps
  const { loadPlayers } = await import("./players-core.js");
  const tournamentId = new URLSearchParams(window.location.search).get("tournamentId");

  const r = await apiPost(
    `/api/host/tournaments/${encodeURIComponent(tournamentId)}/players/bulk`,
    { players }
  );
  if (!r.ok) { alert(r.data?.message || "Bulk add backend route is not ready yet."); return; }

  closeBulkPlayerModal();
  await loadPlayers(tournamentId);
}
