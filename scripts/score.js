// scripts/score.js
import { requireAuth, logout } from "./auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;

  // Topbar actions
  document.querySelectorAll(".brand").forEach((el) => {
    el.style.cursor = "pointer";
    el.addEventListener("click", () => (window.location.href = "index.html"));
  });

  document.getElementById("signout-btn")?.addEventListener("click", logout);

  const titleEl = document.getElementById("score-title");
  const subEl = document.getElementById("score-sub");
  const backBtn = document.getElementById("back-to-fixtures");
  const saveBtn = document.getElementById("save-score");

  const configWrap = document.getElementById("config-fields");
  const aWrap = document.getElementById("playerA-fields");
  const bWrap = document.getElementById("playerB-fields");

  const statusPill = document.getElementById("status-pill");
  const winnerPill = document.getElementById("winner-pill");
  const reasonPill = document.getElementById("reason-pill");
  const saveMsg = document.getElementById("save-msg");

  const params = new URLSearchParams(window.location.search);
  const tournamentId = params.get("tournamentId");
  const categoryId = params.get("categoryId");
  const roundIndex = Number(params.get("round"));
  const matchIndex = Number(params.get("match"));

  if (!tournamentId || !categoryId || Number.isNaN(roundIndex) || Number.isNaN(matchIndex)) {
    titleEl.textContent = "Missing required URL params";
    subEl.textContent = "Expected: ?tournamentId=...&categoryId=...&round=0&match=0";
    return;
  }

  backBtn?.addEventListener("click", () => {
    window.location.href = `fixtures.html?tournamentId=${encodeURIComponent(tournamentId)}`;
  });

  function getToken() {
    return (
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      ""
    );
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

    if (!res.ok) {
      const extra = data?._nonJson ? " (non-JSON response)" : "";
      throw new Error(`GET ${url} failed: ${res.status}${extra}`);
    }
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

    if (!res.ok) {
      const extra = data?._nonJson ? " (non-JSON response)" : "";
      throw new Error(`PUT ${url} failed: ${res.status}${extra}`);
    }
    return data;
  }

  // ---- Load schema + fixtures ----
  let schema = null;
  let fixtures = null;

  try {
    const schemaResp = await apiGet(
      `/api/host/tournaments/${encodeURIComponent(tournamentId)}/scoring-schema`
    );
    schema = schemaResp?.ok ? schemaResp.data : schemaResp; // supports both styles

    const fixturesResp = await apiGet(
      `/api/host/tournaments/${encodeURIComponent(tournamentId)}/fixtures`
    );
    fixtures = fixturesResp?.ok ? fixturesResp.data : fixturesResp;
  } catch (e) {
    console.error(e);
    titleEl.textContent = "Failed to load scoring data";
    subEl.textContent = String(e?.message || e);
    return;
  }

  if (!schema) {
    titleEl.textContent = "No scoring schema found";
    subEl.textContent = "Set scoring schema first (you already did).";
    saveBtn.disabled = true;
    return;
  }

  const match = fixtures?.categories?.[categoryId]?.rounds?.[roundIndex]?.[matchIndex] || null;

  if (!match) {
    titleEl.textContent = "Match not found";
    subEl.textContent = "Invalid categoryId/round/match index.";
    saveBtn.disabled = true;
    return;
  }

  const homeName = match.home ?? "Player A";
  const awayName = match.away ?? "Player B";

  titleEl.textContent = `${homeName} vs ${awayName}`;
  subEl.textContent = `${schema.sport || ""} • Category ${categoryId} • Round ${roundIndex + 1} • Match ${matchIndex + 1}`;

  // Prevent scoring BYE matches
  if (String(homeName).toUpperCase() === "BYE" || String(awayName).toUpperCase() === "BYE") {
    statusPill.classList.add("error");
    statusPill.innerHTML = `Status: <strong>BYE</strong>`;
    winnerPill.innerHTML = `Winner: <strong>-</strong>`;
    reasonPill.innerHTML = `Reason: <strong>This match contains BYE, no scoring needed.</strong>`;
    saveBtn.disabled = true;
    return;
  }

  // ---- Local state ----
  const existing = match.score || null;

  const state = {
    config: {},
    state: { A: {}, B: {} },
  };

  (schema.inputs || []).forEach((f) => {
    state.config[f.key] = existing?.config?.[f.key] ?? f.default ?? null;
  });

  (schema.playerFields || []).forEach((f) => {
    state.state.A[f.key] = existing?.state?.A?.[f.key] ?? f.default ?? 0;
    state.state.B[f.key] = existing?.state?.B?.[f.key] ?? f.default ?? 0;
  });

  function compute(schemaObj, scoreObj) {
    const logic = schemaObj?.winnerLogic || {};
    const A = scoreObj.state?.A || {};
    const B = scoreObj.state?.B || {};
    const cfg = scoreObj.config || {};

    if (logic.type === "higherScoreWins") {
      const field = logic.field || "score";
      const a = Number(A[field] ?? 0);
      const b = Number(B[field] ?? 0);
      if (a > b) return { status: "completed", winnerName: homeName, reason: `${a} > ${b}` };
      if (b > a) return { status: "completed", winnerName: awayName, reason: `${b} > ${a}` };
      return { status: "pending", winnerName: null, reason: "Equal scores" };
    }

    if (logic.type === "firstToTarget") {
      const field = logic.field || "points";
      const targetKey = logic.targetFrom || "targetPoints";
      const winByTwoKey = logic.winByTwoFrom || "winByTwo";
      const a = Number(A[field] ?? 0);
      const b = Number(B[field] ?? 0);
      const target = Number(cfg[targetKey] ?? 0);
      const winByTwo = Boolean(cfg[winByTwoKey]);

      if (!target) return { status: "pending", winnerName: null, reason: "Target not set" };

      const diffA = a - b;
      const diffB = b - a;

      if (a >= target && (!winByTwo || diffA >= 2)) {
        return { status: "completed", winnerName: homeName, reason: `Reached ${a}/${target}` };
      }
      if (b >= target && (!winByTwo || diffB >= 2)) {
        return { status: "completed", winnerName: awayName, reason: `Reached ${b}/${target}` };
      }
      return { status: "pending", winnerName: null, reason: "Ongoing" };
    }

    return { status: "pending", winnerName: null, reason: "Unknown winner logic" };
  }

  function renderPills() {
    const c = compute(schema, state);
    statusPill.innerHTML = `Status: <strong>${c.status}</strong>`;
    winnerPill.innerHTML = `Winner: <strong>${c.winnerName || "-"}</strong>`;
    reasonPill.innerHTML = `Reason: <strong>${c.reason || "-"}</strong>`;
  }

  function clear(el) {
    if (el) el.innerHTML = "";
  }

  function renderConfigFields() {
    clear(configWrap);
    const inputs = schema.inputs || [];
    if (!inputs.length) {
      configWrap.innerHTML = `<p class="help">No match settings.</p>`;
      return;
    }

    inputs.forEach((f) => {
      const wrap = document.createElement("div");
      wrap.className = "field";

      const label = document.createElement("label");
      label.textContent = f.label || f.key;

      let inputEl;

      if (f.type === "number") {
        inputEl = document.createElement("input");
        inputEl.type = "number";
        inputEl.value = state.config[f.key] ?? "";
        if (typeof f.min === "number") inputEl.min = String(f.min);
        if (typeof f.max === "number") inputEl.max = String(f.max);
        inputEl.addEventListener("input", () => {
          state.config[f.key] = inputEl.value === "" ? null : Number(inputEl.value);
          renderPills();
        });
      } else if (f.type === "boolean") {
        inputEl = document.createElement("select");
        inputEl.innerHTML = `<option value="true">True</option><option value="false">False</option>`;
        inputEl.value = String(Boolean(state.config[f.key]));
        inputEl.addEventListener("change", () => {
          state.config[f.key] = inputEl.value === "true";
          renderPills();
        });
      } else {
        inputEl = document.createElement("input");
        inputEl.type = "text";
        inputEl.value = state.config[f.key] ?? "";
        inputEl.addEventListener("input", () => {
          state.config[f.key] = inputEl.value;
          renderPills();
        });
      }

      wrap.appendChild(label);
      wrap.appendChild(inputEl);

      if (f.help) {
        const help = document.createElement("div");
        help.className = "help";
        help.textContent = f.help;
        wrap.appendChild(help);
      }

      configWrap.appendChild(wrap);
    });
  }

  function renderPlayerFields(side, container, playerName) {
    clear(container);
    const fields = schema.playerFields || [];
    if (!fields.length) {
      container.innerHTML = `<p class="help">No player fields.</p>`;
      return;
    }

    fields.forEach((f) => {
      const wrap = document.createElement("div");
      wrap.className = "field";

      const label = document.createElement("label");
      label.textContent = `${playerName} — ${f.label || f.key}`;
      wrap.appendChild(label);

      if (f.type === "counter") {
        const row = document.createElement("div");
        row.className = "counter";

        const minus = document.createElement("button");
        minus.className = "mini-btn";
        minus.type = "button";
        minus.textContent = "–";

        const plus = document.createElement("button");
        plus.className = "mini-btn";
        plus.type = "button";
        plus.textContent = "+";

        const value = document.createElement("div");
        value.className = "value";
        value.textContent = String(state.state[side][f.key] ?? 0);

        const min = typeof f.min === "number" ? f.min : 0;

        minus.addEventListener("click", () => {
          const cur = Number(state.state[side][f.key] ?? 0);
          const next = Math.max(min, cur - 1);
          state.state[side][f.key] = next;
          value.textContent = String(next);
          renderPills();
        });

        plus.addEventListener("click", () => {
          const cur = Number(state.state[side][f.key] ?? 0);
          const next = cur + 1;
          state.state[side][f.key] = next;
          value.textContent = String(next);
          renderPills();
        });

        row.appendChild(minus);
        row.appendChild(value);
        row.appendChild(plus);
        wrap.appendChild(row);
      } else if (f.type === "number") {
        const inputEl = document.createElement("input");
        inputEl.type = "number";
        inputEl.value = state.state[side][f.key] ?? 0;
        inputEl.addEventListener("input", () => {
          state.state[side][f.key] = inputEl.value === "" ? 0 : Number(inputEl.value);
          renderPills();
        });
        wrap.appendChild(inputEl);
      } else {
        const inputEl = document.createElement("input");
        inputEl.type = "text";
        inputEl.value = state.state[side][f.key] ?? "";
        inputEl.addEventListener("input", () => {
          state.state[side][f.key] = inputEl.value;
          renderPills();
        });
        wrap.appendChild(inputEl);
      }

      if (f.help) {
        const help = document.createElement("div");
        help.className = "help";
        help.textContent = f.help;
        wrap.appendChild(help);
      }

      container.appendChild(wrap);
    });
  }

  renderConfigFields();
  renderPlayerFields("A", aWrap, homeName);
  renderPlayerFields("B", bWrap, awayName);
  renderPills();

  // ---- Save ----
  saveBtn?.addEventListener("click", async () => {
    saveBtn.disabled = true;
    if (saveMsg) {
      saveMsg.style.display = "inline-flex";
      saveMsg.textContent = "Saving…";
      saveMsg.classList.remove("error");
    }

    try {
      const payload = {
        categoryId,
        roundIndex,
        matchIndex,
        score: {
          config: state.config,
          state: state.state,
        },
      };

      const resp = await apiPut(
        `/api/host/tournaments/${encodeURIComponent(tournamentId)}/matches/score`,
        payload
      );

      if (saveMsg) {
        saveMsg.textContent = "Saved ✅";
        saveMsg.style.display = "inline-flex";
      }

      const serverMatch = resp?.match || null;
      const computed = serverMatch?.score?.computed || null;
      if (computed) {
        statusPill.innerHTML = `Status: <strong>${computed.status}</strong>`;
        winnerPill.innerHTML = `Winner: <strong>${computed.winnerName || "-"}</strong>`;
        reasonPill.innerHTML = `Reason: <strong>${computed.reason || "-"}</strong>`;
      }
    } catch (e) {
      console.error(e);
      if (saveMsg) {
        saveMsg.classList.add("error");
        saveMsg.textContent = `Save failed: ${String(e?.message || e)}`;
        saveMsg.style.display = "inline-flex";
      }
    } finally {
      saveBtn.disabled = false;
    }
  });
});
