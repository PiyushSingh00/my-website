// scripts/schedule.js
import { requireAuth, logout } from "./auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;

  document.querySelectorAll(".brand").forEach((el) => {
    el.addEventListener("click", () => {
      window.location.href = "index.html";
    });
  });

  const usernameLabel = document.getElementById("username-label");
  if (usernameLabel) {
    usernameLabel.textContent = user.username;
  }

  const signoutBtn = document.getElementById("signout-btn");
  if (signoutBtn) {
    signoutBtn.addEventListener("click", logout);
  }

  const switchHostModeBtn = document.getElementById("switch-host-mode");
  switchHostModeBtn?.addEventListener("click", async () => {
    await fetch("/api/user/mode", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("token")
      },
      body: JSON.stringify({ mode: "host" })
    });
    window.location.href = "host.html";
  });

  const backBtn = document.getElementById("back-to-join");
  backBtn?.addEventListener("click", () => {
    window.location.href = "join.html";
  });

  const params = new URLSearchParams(window.location.search);
  const tournamentId = params.get("tournamentId");
  if (!tournamentId) return;

  const titleEl = document.getElementById("schedule-tournament-name");
  const metaEl = document.getElementById("schedule-tournament-meta");
  const emptyEl = document.getElementById("schedule-empty");
  const tableWrapper = document.getElementById("schedule-table-wrapper");
  const tableBody = document.getElementById("schedule-table-body");

  async function apiGet(url) {
    const res = await fetch(url, {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") }
    });
    const raw = await res.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
    return { ok: res.ok, data };
  }

function renderRows(fixtures) {
  if (!tableBody) return;
  tableBody.innerHTML = "";

  const cats = fixtures?.categories || {};
  const catIds = Object.keys(cats);

  const rows = [];

  catIds.forEach((cid) => {
    const bracket = cats[cid];
    if (!bracket?.rounds) return;

    const label = bracket.label || cid;

    bracket.rounds.forEach((round, r) => {
      round.forEach((match, i) => {
        rows.push({
          roundLabel: `${label} • ${r + 1}`,
          matchLabel: `Match ${i + 1}`,
          home: match?.home || "-",
          away: match?.away || "-",
        });
      });
    });
  });

  if (!rows.length) return;

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.roundLabel}</td>
      <td>${row.matchLabel}</td>
      <td>${row.home}</td>
      <td>${row.away}</td>
      <td>-</td>
      <td>-</td>
      <td>-</td>
    `;
    tableBody.appendChild(tr);
  });
}


  async function loadMeta() {
    const res = await apiGet(`/api/tournaments/${encodeURIComponent(tournamentId)}`);
    if (!res.ok || !res.data) return;
    const t = res.data;
    if (titleEl) titleEl.textContent = t.tournamentName ?? "Tournament";
    if (metaEl) metaEl.textContent = [t.sportName, t.tournamentDates].filter(Boolean).join(" • ");
  }

  async function loadFixtures() {
    const res = await apiGet(`/api/tournaments/${encodeURIComponent(tournamentId)}/fixtures`);
    if (res.ok && res.data) return res.data;
    try {
      const raw = localStorage.getItem(`scheduleitFixtures_${tournamentId}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  await loadMeta();
  const fixtures = await loadFixtures();

  if (!fixtures) {
    emptyEl && (emptyEl.style.display = "block");
    tableWrapper && (tableWrapper.style.display = "none");
    return;
  }

  emptyEl && (emptyEl.style.display = "none");
  tableWrapper && (tableWrapper.style.display = "block");
  renderRows(fixtures);
});
