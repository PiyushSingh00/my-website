import { requireAuth, logout } from "./auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;

  document.querySelectorAll(".brand").forEach((el) => {
    el.style.cursor = "pointer";
    el.addEventListener("click", () => (window.location.href = "index.html"));
  });
  document.getElementById("signout-btn")?.addEventListener("click", logout);

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const titleEl        = document.getElementById("score-title");
  const subEl          = document.getElementById("score-sub");
  const backBtn        = document.getElementById("back-to-fixtures");
  const saveBtn        = document.getElementById("save-score");
  const configWrap     = document.getElementById("config-fields");
  const teamsWrap      = document.getElementById("teams-wrap");
  const statusPill     = document.getElementById("status-pill");
  const winnerPill     = document.getElementById("winner-pill");
  const reasonPill     = document.getElementById("reason-pill");
  const saveMsg        = document.getElementById("save-msg");
  const homeNameEl     = document.getElementById("home-name");
  const awayNameEl     = document.getElementById("away-name");
  const homeScoreEl    = document.getElementById("home-score");
  const awayScoreEl    = document.getElementById("away-score");
  const rosterArea     = document.getElementById("roster-area");
  const overlay        = document.getElementById("stat-overlay");
  const drawer         = document.getElementById("stat-drawer");
  const drawerNameEl   = document.getElementById("drawer-player-name");
  const drawerTeamEl   = document.getElementById("drawer-team-name");
  const drawerFields   = document.getElementById("drawer-fields");
  const drawerClose    = document.getElementById("drawer-close");
  const settingsPanel  = document.getElementById("settings-panel");
  const toggleSettings = document.getElementById("toggle-settings");
  const timerDisplay   = document.getElementById("timer-display");
  const timerStartBtn  = document.getElementById("timer-start");
  const timerPauseBtn  = document.getElementById("timer-pause");
  const timerResetBtn  = document.getElementById("timer-reset");

  // ── URL params ────────────────────────────────────────────────────────────
  const params       = new URLSearchParams(window.location.search);
  const tournamentId = params.get("tournamentId");
  const categoryId   = params.get("categoryId");
  const roundIndex   = Number(params.get("round"));
  const matchIndex   = Number(params.get("match"));
  const scoreIndex   = Number(params.get("scoreIndex") ?? 0);

  if (!tournamentId || !categoryId || Number.isNaN(roundIndex) || Number.isNaN(matchIndex)) {
    if (titleEl) titleEl.textContent = "Missing required URL params";
    if (subEl)   subEl.textContent   = "Expected: ?tournamentId=...&categoryId=...&round=0&match=0";
    return;
  }

  backBtn?.addEventListener("click", () => {
    window.location.href = `fixtures.html?tournamentId=${encodeURIComponent(tournamentId)}`;
  });

  // ── API helpers ───────────────────────────────────────────────────────────
  function getToken() {
    return localStorage.getItem("token") || localStorage.getItem("authToken") || "";
  }
  async function apiGet(url) {
    const res = await fetch(url, { headers: { Authorization: "Bearer " + getToken() } });
    const raw = await res.text();
    let data = null;
    try   { data = raw ? JSON.parse(raw) : null; }
    catch { data = { _nonJson: true, raw }; }
    if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}${data?._nonJson ? " (non-JSON)" : ""}`);
    return data;
  }
  async function apiPut(url, body) {
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + getToken() },
      body: JSON.stringify(body || {}),
    });
    const raw = await res.text();
    let data = null;
    try   { data = raw ? JSON.parse(raw) : null; }
    catch { data = { _nonJson: true, raw }; }
    if (!res.ok) throw new Error(`PUT ${url} failed: ${res.status}${data?._nonJson ? " (non-JSON)" : ""}`);
    return data;
  }
  function clear(el) { if (el) el.innerHTML = ""; }

  // ── Load schema + fixtures ────────────────────────────────────────────────
  let schema = null, fixtures = null;
  try {
    const sr = await apiGet(`/api/host/tournaments/${encodeURIComponent(tournamentId)}/scoring-schema/active?categoryId=${encodeURIComponent(categoryId)}`);
    schema = sr?.ok ? sr.data : sr;
    const fr = await apiGet(`/api/host/tournaments/${encodeURIComponent(tournamentId)}/fixtures`);
    fixtures = fr?.ok ? fr.data : fr;
  } catch (e) {
    console.error(e);
    if (titleEl) titleEl.textContent = "Failed to load scoring data";
    if (subEl)   subEl.textContent   = String(e?.message || e);
    return;
  }

  if (!schema) {
    if (titleEl) titleEl.textContent = "No scoring schema found";
    if (subEl)   subEl.textContent   = "Finalize scoring schema for this category first.";
    if (saveBtn) saveBtn.disabled = true;
    return;
  }

  const match = fixtures?.categories?.[categoryId]?.rounds?.[roundIndex]?.[matchIndex] || null;
  if (!match) {
    if (titleEl) titleEl.textContent = "Match not found";
    if (subEl)   subEl.textContent   = "Invalid categoryId/round/match index.";
    if (saveBtn) saveBtn.disabled = true;
    return;
  }

  const homeLabel = match.home ?? "Home";
  const awayLabel = match.away ?? "Away";

  if (String(homeLabel).toUpperCase() === "BYE" || String(awayLabel).toUpperCase() === "BYE") {
    statusPill?.classList.add("error");
    if (statusPill) statusPill.innerHTML = `Status: <strong>BYE</strong>`;
    if (winnerPill) winnerPill.innerHTML = `Winner: <strong>-</strong>`;
    if (reasonPill) reasonPill.innerHTML = `Reason: <strong>BYE match — no scoring needed.</strong>`;
    if (saveBtn)    saveBtn.disabled = true;
    return;
  }

  if (titleEl)    titleEl.textContent    = `${homeLabel} vs ${awayLabel}`;
  if (subEl)      subEl.textContent      = `${schema.sport || ""} • Category ${categoryId} • Round ${roundIndex + 1} • Match ${matchIndex + 1}`;
  if (homeNameEl) homeNameEl.textContent = homeLabel;
  if (awayNameEl) awayNameEl.textContent = awayLabel;

  function splitTeamLabel(label) {
    return label ? String(label).split("+").map(s => s.trim()).filter(Boolean) : [];
  }
  const homePlayers = Array.isArray(match.homePlayers) ? match.homePlayers : splitTeamLabel(match.home);
  const awayPlayers = Array.isArray(match.awayPlayers) ? match.awayPlayers : splitTeamLabel(match.away);

  // ── Score state ───────────────────────────────────────────────────────────
  const existing = match.score || null;
  const state = {
    config: {},
    state:  { A: { players: {} }, B: { players: {} } },
    timer:  { elapsedMs: existing?.timer?.elapsedMs ?? 0, running: false, startedAtEpochMs: null },
  };
  if (existing?.cricket)    state.cricket    = existing.cricket;
  if (existing?.football)   state.football   = existing.football;
  if (existing?.basketball) state.basketball = existing.basketball;
  if (existing?.badminton)  state.badminton  = existing.badminton;

  (schema.inputs || []).forEach(f => { state.config[f.key] = existing?.config?.[f.key] ?? f.default ?? null; });

  function ensurePlayer(side, name) {
    if (!state.state[side].players[name]) state.state[side].players[name] = {};
    return state.state[side].players[name];
  }
  function initPlayers(side, roster) {
    roster.forEach(p => {
      const obj = ensurePlayer(side, p);
      (schema.playerFields || []).forEach(f => {
        const prev = existing?.state?.[side]?.players?.[p]?.[f.key];
        obj[f.key] = prev ?? f.default ?? (f.type === "text" ? "" : 0);
      });
    });
  }
  initPlayers("A", homePlayers);
  initPlayers("B", awayPlayers);

  function recomputeTeamTotals() {
    ["A","B"].forEach(side => {
      const roster = side === "A" ? homePlayers : awayPlayers;
      const totals = {};
      (schema.playerFields || []).forEach(f => {
        if (f.type === "counter" || f.type === "number") {
          totals[f.key] = roster.reduce((s, p) => {
            const v = Number(state.state[side].players?.[p]?.[f.key] ?? 0);
            return s + (Number.isFinite(v) ? v : 0);
          }, 0);
        }
      });
      Object.assign(state.state[side], totals);
    });
  }
  recomputeTeamTotals();

  // ── Winner compute ────────────────────────────────────────────────────────
  function compute() {
    const logic = schema?.winnerLogic || {};
    const A = state.state.A, B = state.state.B, cfg = state.config;
    if (logic.type === "higherScoreWins") {
      const a = Number(A[logic.field||"score"] ?? 0), b = Number(B[logic.field||"score"] ?? 0);
      if (a > b) return { status:"completed", winnerName:homeLabel, reason:`${a} > ${b}` };
      if (b > a) return { status:"completed", winnerName:awayLabel, reason:`${b} > ${a}` };
      return { status:"pending", winnerName:null, reason:"Equal scores" };
    }
    if (logic.type === "firstToTarget") {
      const field = logic.field||"points";
      const a = Number(A[field]??0), b = Number(B[field]??0);
      const target = Number(cfg[logic.targetFrom||"targetPoints"]??0);
      const win2   = Boolean(cfg[logic.winByTwoFrom||"winByTwo"]);
      if (!target) return { status:"pending", winnerName:null, reason:"Target not set" };
      if (a>=target&&(!win2||(a-b)>=2)) return { status:"completed", winnerName:homeLabel, reason:`Reached ${a}/${target}` };
      if (b>=target&&(!win2||(b-a)>=2)) return { status:"completed", winnerName:awayLabel, reason:`Reached ${b}/${target}` };
      return { status:"pending", winnerName:null, reason:"Ongoing" };
    }
    return { status:"pending", winnerName:null, reason:"Unknown logic" };
  }

  function renderPills() {
    const c = compute();
    if (statusPill) statusPill.innerHTML = `Status: <strong>${c.status}</strong>`;
    if (winnerPill) winnerPill.innerHTML = `Winner: <strong>${c.winnerName||"-"}</strong>`;
    if (reasonPill) reasonPill.innerHTML = `Reason: <strong>${c.reason||"-"}</strong>`;
    const lf = schema?.winnerLogic?.field;
    if (lf) {
      if (homeScoreEl) homeScoreEl.textContent = Number(state.state.A?.[lf]??0);
      if (awayScoreEl) awayScoreEl.textContent = Number(state.state.B?.[lf]??0);
    }
  }

  // ── Settings toggle ───────────────────────────────────────────────────────
  toggleSettings?.addEventListener("click", () => {
    settingsPanel?.classList.toggle("open");
    if (toggleSettings) toggleSettings.textContent = settingsPanel?.classList.contains("open") ? "✕ Settings" : "⚙ Settings";
  });

  // ── Config fields ─────────────────────────────────────────────────────────
  function renderConfigFields() {
    clear(configWrap);
    const inputs = schema.inputs || [];
    if (!inputs.length) { if (configWrap) configWrap.innerHTML = `<p class="help">No match settings.</p>`; return; }
    inputs.forEach(f => {
      const wrap = document.createElement("div"); wrap.className = "field";
      const label = document.createElement("label"); label.textContent = f.label||f.key;
      let inp;
      if (f.type==="number") {
        inp = document.createElement("input"); inp.type="number"; inp.value=state.config[f.key]??"";
        if (typeof f.min==="number") inp.min=String(f.min);
        if (typeof f.max==="number") inp.max=String(f.max);
        inp.addEventListener("input", () => { state.config[f.key]=inp.value===""?null:Number(inp.value); renderPills(); });
      } else if (f.type==="boolean") {
        inp = document.createElement("select"); inp.innerHTML=`<option value="true">True</option><option value="false">False</option>`;
        inp.value=String(Boolean(state.config[f.key]));
        inp.addEventListener("change", () => { state.config[f.key]=inp.value==="true"; renderPills(); });
      } else {
        inp = document.createElement("input"); inp.type="text"; inp.value=state.config[f.key]??"";
        inp.addEventListener("input", () => { state.config[f.key]=inp.value; renderPills(); });
      }
      wrap.appendChild(label); wrap.appendChild(inp);
      if (f.help) { const h=document.createElement("div"); h.className="help"; h.textContent=f.help; wrap.appendChild(h); }
      configWrap?.appendChild(wrap);
    });
  }

  // ── Generic drawer ────────────────────────────────────────────────────────
  function closeDrawer() {
    drawer?.classList.remove("open"); overlay?.classList.remove("show"); document.body.classList.remove("drawer-lock");
  }
  drawerClose?.addEventListener("click", closeDrawer);
  overlay?.addEventListener("click", closeDrawer);

  function openDrawer({ playerName, teamLabel, fields, playerObj, onUpdate }) {
    if (drawerNameEl) drawerNameEl.textContent = playerName;
    if (drawerTeamEl) drawerTeamEl.textContent = teamLabel;
    clear(drawerFields);
    fields.forEach(field => {
      const row = document.createElement("div"); row.className = "df-row";
      const lbl = document.createElement("div"); lbl.className="df-label"; lbl.textContent=field.label||field.key;
      row.appendChild(lbl);
      if (field.type==="counter"||field.type==="number") {
        const ctrl=document.createElement("div"); ctrl.className="df-counter";
        const minBtn=document.createElement("button"); minBtn.type="button"; minBtn.className="df-counter-btn"; minBtn.textContent="−";
        const valEl=document.createElement("div"); valEl.className="df-counter-val"; valEl.textContent=String(playerObj[field.key]??0);
        const plusBtn=document.createElement("button"); plusBtn.type="button"; plusBtn.className="df-counter-btn df-counter-plus"; plusBtn.textContent="+";
        const min=typeof field.min==="number"?field.min:0;
        minBtn.addEventListener("click",()=>{ const n=Math.max(min,Number(playerObj[field.key]??0)-1); playerObj[field.key]=n; valEl.textContent=String(n); onUpdate(); });
        plusBtn.addEventListener("click",()=>{ const n=Number(playerObj[field.key]??0)+1; playerObj[field.key]=n; valEl.textContent=String(n); onUpdate(); });
        ctrl.appendChild(minBtn); ctrl.appendChild(valEl); ctrl.appendChild(plusBtn); row.appendChild(ctrl);
      } else if (field.type==="select") {
        const sel=document.createElement("select"); sel.className="df-select";
        const opts=Array.isArray(field.options)?field.options:[];
        sel.innerHTML=opts.map(o=>`<option value="${o}">${o}</option>`).join("");
        sel.value=String(playerObj[field.key]??(opts[0]??""));
        sel.addEventListener("change",()=>{ playerObj[field.key]=sel.value; onUpdate(); });
        row.appendChild(sel);
      } else {
        const inp=document.createElement("input"); inp.className="df-input"; inp.type=field.type==="number"?"number":"text"; inp.value=playerObj[field.key]??"";
        inp.addEventListener("input",()=>{ playerObj[field.key]=field.type==="number"?(inp.value===""?0:Number(inp.value)):inp.value; onUpdate(); });
        row.appendChild(inp);
      }
      if (field.help) { const h=document.createElement("div"); h.className="df-help"; h.textContent=field.help; row.appendChild(h); }
      drawerFields?.appendChild(row);
    });
    drawer?.classList.add("open"); overlay?.classList.add("show"); document.body.classList.add("drawer-lock");
  }

  // ── Generic roster panels (fallback for unknown sports) ───────────────────
  function buildGenericRosterPanels() {
    const logicField   = schema?.winnerLogic?.field||null;
    const playerFields = schema.playerFields||[];
    function buildPanel(side, teamLabel, roster) {
      const panel=document.createElement("div"); panel.className="roster-panel"; panel.dataset.side=side;
      const hdr=document.createElement("div"); hdr.className="roster-panel-header";
      hdr.innerHTML=`<span class="rp-label">${side==="A"?"🏠":"✈️"} ${teamLabel}</span><span class="rp-close">✕</span>`;
      hdr.querySelector(".rp-close").addEventListener("click",()=>panel.classList.remove("active"));
      panel.appendChild(hdr);
      roster.forEach(name => {
        const chip=document.createElement("button"); chip.type="button"; chip.className="player-chip";
        function refresh() {
          const stat=logicField?(state.state[side].players?.[name]?.[logicField]??0):null;
          chip.innerHTML=`<span class="pc-name">${name}</span>${stat!==null?`<span class="pc-stat">${stat}</span>`:""}`;
        }
        refresh();
        chip.addEventListener("click",()=>{ ensurePlayer(side,name); openDrawer({ playerName:name, teamLabel, fields:playerFields, playerObj:state.state[side].players[name], onUpdate:()=>{ recomputeTeamTotals(); renderPills(); refresh(); } }); });
        panel.appendChild(chip);
      });
      return panel;
    }
    const hp=buildPanel("A",homeLabel,homePlayers), ap=buildPanel("B",awayLabel,awayPlayers);
    rosterArea?.appendChild(hp); rosterArea?.appendChild(ap);
    document.getElementById("team-home")?.addEventListener("click",()=>{ hp.classList.toggle("active"); ap.classList.remove("active"); });
    document.getElementById("team-away")?.addEventListener("click",()=>{ ap.classList.toggle("active"); hp.classList.remove("active"); });
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  SPORT WORKFLOWS
  // ══════════════════════════════════════════════════════════════════════════

  // ── Shared modal helper ───────────────────────────────────────────────────
  let _modal = null;
  function openModal(html, onBgClick) {
    closeModal();
    _modal = document.createElement("div"); _modal.className="sport-modal";
    _modal.innerHTML=`<div class="sport-modal-box">${html}</div>`;
    _modal.querySelector(".sport-modal-box").addEventListener("click",e=>e.stopPropagation());
    _modal.addEventListener("click",()=>{ closeModal(); onBgClick?.(); });
    document.body.appendChild(_modal);
    requestAnimationFrame(()=>_modal?.classList.add("show"));
  }
  function closeModal() { if(_modal){ _modal.remove(); _modal=null; } }

  // ── Shared dropdown builder ───────────────────────────────────────────────
  function dropdown(id, players, selected) {
    return `<select class="gc-select" id="${id}">${players.map(p=>`<option value="${p}"${p===selected?" selected":""}>${p}</option>`).join("")}</select>`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  CRICKET
  // ─────────────────────────────────────────────────────────────────────────
  function initCricket() {
    const cs = Object.assign({
      tossWinner:null, tossChoice:null, innings:1, battingTeam:null, bowlingTeam:null,
      striker:null, nonStriker:null, bowler:null, over:0, ball:0,
      phase:"toss", batting:{}, bowling:{},
      extras:{wide:0,noBall:0,bye:0,legBye:0},
      totalRuns:{home:0,away:0}, totalWickets:{home:0,away:0}, fallOfWickets:[],
    }, state.cricket || {});

    function persist() { state.cricket=cs; scheduleAutoSave(); }
    function tl(s) { return s==="home"?homeLabel:awayLabel; }
    function tp(s) { return s==="home"?homePlayers:awayPlayers; }
    function eb(n) { if(!cs.batting[n]) cs.batting[n]={runs:0,balls:0,fours:0,sixes:0,dismissal:null,dismissed:false}; return cs.batting[n]; }
    function ebw(n){ if(!cs.bowling[n]) cs.bowling[n]={overs:0,balls:0,runs:0,wickets:0}; return cs.bowling[n]; }

    function availBatters(side) {
      const dismissed=Object.entries(cs.batting).filter(([,v])=>v.dismissed).map(([k])=>k);
      const cur=[cs.striker,cs.nonStriker].filter(Boolean);
      return tp(side).filter(p=>!dismissed.includes(p)&&!cur.includes(p));
    }
    function scoreStr(s) { return `${cs.totalRuns[s]}/${cs.totalWickets[s]}`; }

    function addRunsToBatter(runs) {
      if(!cs.striker) return;
      const b=eb(cs.striker); b.runs+=runs; b.balls++; if(runs===4)b.fours++; if(runs===6)b.sixes++;
    }
    function addRunsToBowler(runs,wkt) {
      if(!cs.bowler) return;
      const b=ebw(cs.bowler); b.runs+=runs; b.balls++; if(wkt)b.wickets++;
      if(b.balls>=6){b.overs++;b.balls=0;}
    }
    function swapStrike() { [cs.striker,cs.nonStriker]=[cs.nonStriker,cs.striker]; }

    function advanceBall(legal=true) {
      if(!legal) return false;
      cs.ball++;
      if(cs.ball>=6){ cs.ball=0; cs.over++; swapStrike(); cs.phase="bowler"; render(); return true; }
      return false;
    }

    function syncMaster() {
      state.state.A.runs=cs.totalRuns.home; state.state.A.wickets=cs.totalWickets.home;
      state.state.B.runs=cs.totalRuns.away; state.state.B.wickets=cs.totalWickets.away;
      renderPills();
    }

    const root=document.createElement("div"); root.className="sport-ui cricket-ui";

    function render() {
      root.innerHTML="";
      ({ toss:rToss, openers:rOpeners, bowler:rBowler, delivery:rDelivery, wicket:rWicket, next_batter:rNextBatter, innings_break:rInningsBreak, complete:rComplete })[cs.phase]?.();
      syncMaster();
    }

    function scorecardHdr() {
      if(!cs.battingTeam) return "";
      return `<div class="cricket-scoreboard">
        <div class="cs-team${cs.battingTeam==="home"?" cs-batting":""}"><div class="cs-name">${homeLabel}</div><div class="cs-score">${scoreStr("home")}</div></div>
        <div class="cs-center"><div class="cs-overs">${cs.over}.${cs.ball} ov</div><div class="cs-vs">vs</div></div>
        <div class="cs-team${cs.battingTeam==="away"?" cs-batting":""}"><div class="cs-name">${awayLabel}</div><div class="cs-score">${scoreStr("away")}</div></div>
      </div>
      <div class="cs-live-bar">
        ${cs.striker?`<span class="cs-pill bat">🏏 ${cs.striker} (${eb(cs.striker).runs})</span>`:""}
        ${cs.nonStriker?`<span class="cs-pill">⚡ ${cs.nonStriker} (${eb(cs.nonStriker).runs})</span>`:""}
        ${cs.bowler?`<span class="cs-pill bowl">⚾ ${cs.bowler} ${ebw(cs.bowler).overs}.${ebw(cs.bowler).balls}-${ebw(cs.bowler).runs}-${ebw(cs.bowler).wickets}</span>`:""}
      </div>`;
    }

    function rToss() {
      root.innerHTML=`<div class="guided-card"><div class="gc-step">Step 1 of 3</div><div class="gc-title">🪙 Toss — Who won?</div><div class="gc-options"><button class="gc-opt" data-val="home">${homeLabel}</button><button class="gc-opt" data-val="away">${awayLabel}</button></div></div>`;
      root.querySelectorAll(".gc-opt").forEach(b=>b.addEventListener("click",()=>{ cs.tossWinner=b.dataset.val; rTossChoice(); }));
    }
    function rTossChoice() {
      root.innerHTML=`<div class="guided-card"><div class="gc-step">Step 2 of 3</div><div class="gc-title">🪙 ${tl(cs.tossWinner)} won — choose to…</div><div class="gc-options"><button class="gc-opt" data-val="bat">🏏 Bat</button><button class="gc-opt" data-val="bowl">⚾ Bowl</button></div></div>`;
      root.querySelectorAll(".gc-opt").forEach(b=>b.addEventListener("click",()=>{
        cs.tossChoice=b.dataset.val;
        cs.battingTeam=cs.tossChoice==="bat"?cs.tossWinner:(cs.tossWinner==="home"?"away":"home");
        cs.bowlingTeam=cs.battingTeam==="home"?"away":"home";
        cs.phase="openers"; persist(); render();
      }));
    }

    function rOpeners() {
      const pl=tp(cs.battingTeam);
      root.innerHTML=`<div class="guided-card"><div class="gc-step">Step 3 of 3 — ${tl(cs.battingTeam)} batting</div><div class="gc-title">🏏 Opening Batsmen</div>
        <div class="gc-label">Striker</div>${dropdown("str-sel",pl,cs.striker)}
        <div class="gc-label" style="margin-top:10px">Non-striker</div>${dropdown("nstr-sel",pl,cs.nonStriker)}
        <button class="gc-confirm" id="conf-op">Confirm & pick bowler →</button></div>`;
      root.querySelector("#conf-op").addEventListener("click",()=>{
        cs.striker=root.querySelector("#str-sel").value; cs.nonStriker=root.querySelector("#nstr-sel").value;
        if(cs.striker===cs.nonStriker){alert("Must be different players.");return;}
        eb(cs.striker); eb(cs.nonStriker); cs.phase="bowler"; persist(); render();
      });
    }

    function rBowler() {
      const pl=tp(cs.bowlingTeam);
      root.innerHTML=`${scorecardHdr()}<div class="guided-card"><div class="gc-title">⚾ Over ${cs.over+1} — Who is bowling?</div>
        ${dropdown("bwl-sel",pl,cs.bowler)}<button class="gc-confirm" id="conf-bwl">Start over →</button></div>`;
      root.querySelector("#conf-bwl").addEventListener("click",()=>{ cs.bowler=root.querySelector("#bwl-sel").value; ebw(cs.bowler); cs.phase="delivery"; persist(); render(); });
    }

    const DELIVERIES=[
      {label:"0 (dot)",val:"dot",runs:0,legal:true},{label:"1",val:"1",runs:1,legal:true},
      {label:"2",val:"2",runs:2,legal:true},{label:"3",val:"3",runs:3,legal:true},
      {label:"4 ▸",val:"4",runs:4,legal:true},{label:"6 ▸▸",val:"6",runs:6,legal:true},
      {label:"Wide",val:"wide",runs:1,legal:false},{label:"No Ball",val:"noball",runs:1,legal:false},
      {label:"Bye",val:"bye",runs:0,legal:true},{label:"Leg Bye",val:"legbye",runs:0,legal:true},
      {label:"🎯 Wicket",val:"wicket",runs:0,legal:true},
    ];

    function rDelivery() {
      root.innerHTML=`${scorecardHdr()}<div class="guided-card"><div class="gc-title">Ball ${cs.over}.${cs.ball+1} — What happened?</div>
        <div class="delivery-grid">${DELIVERIES.map(o=>`<button class="del-btn${o.val==="wicket"?" del-wicket":o.val==="wide"||o.val==="noball"?" del-extra":""}" data-val="${o.val}">${o.label}</button>`).join("")}</div></div>`;
      root.querySelectorAll(".del-btn").forEach(b=>b.addEventListener("click",()=>handleDelivery(DELIVERIES.find(o=>o.val===b.dataset.val))));
    }

    function handleDelivery(opt) {
      if(opt.val==="wicket"){cs.phase="wicket";render();return;}
      if(opt.val==="wide"){cs.extras.wide++;cs.totalRuns[cs.battingTeam]++;addRunsToBowler(1,false);}
      else if(opt.val==="noball"){cs.extras.noBall++;cs.totalRuns[cs.battingTeam]++;addRunsToBowler(1,false);}
      else if(opt.val==="bye"){cs.extras.bye++;}
      else if(opt.val==="legbye"){cs.extras.legBye++;}
      else { addRunsToBatter(opt.runs); cs.totalRuns[cs.battingTeam]+=opt.runs; addRunsToBowler(opt.runs,false); if(opt.runs%2!==0)swapStrike(); }
      const eoo=advanceBall(opt.legal);
      persist(); if(!eoo)render();
    }

    const DISMISSALS=["Bowled","Caught","LBW","Run Out","Stumped","Hit Wicket"];
    function rWicket() {
      root.innerHTML=`${scorecardHdr()}<div class="guided-card"><div class="gc-title">🎯 Wicket!</div>
        <div class="gc-label">Who is out?</div><div class="gc-options">
          ${cs.striker?`<button class="gc-opt" data-batter="${cs.striker}">${cs.striker} (striker)</button>`:""}
          ${cs.nonStriker?`<button class="gc-opt" data-batter="${cs.nonStriker}">${cs.nonStriker} (non-striker)</button>`:""}
        </div>
        <div class="gc-label" style="margin-top:12px">Dismissal type</div>
        <div class="gc-options small">${DISMISSALS.map(d=>`<button class="gc-opt small" data-dismissal="${d}">${d}</button>`).join("")}</div></div>`;
      let selBatter=cs.striker, selDismiss=null;
      root.querySelectorAll("[data-batter]").forEach(b=>b.addEventListener("click",()=>{ root.querySelectorAll("[data-batter]").forEach(x=>x.classList.remove("selected")); b.classList.add("selected"); selBatter=b.dataset.batter; tryConfirm(); }));
      root.querySelectorAll("[data-dismissal]").forEach(b=>b.addEventListener("click",()=>{ root.querySelectorAll("[data-dismissal]").forEach(x=>x.classList.remove("selected")); b.classList.add("selected"); selDismiss=b.dataset.dismissal; tryConfirm(); }));
      function tryConfirm(){ if(selBatter&&selDismiss) applyWicket(selBatter,selDismiss); }
    }

    function applyWicket(batter,dismissal) {
      const b=eb(batter); b.dismissed=true; b.dismissal=dismissal; b.balls++;
      addRunsToBowler(0,true); cs.totalWickets[cs.battingTeam]++;
      cs.fallOfWickets.push({wicket:cs.totalWickets[cs.battingTeam],score:cs.totalRuns[cs.battingTeam],over:`${cs.over}.${cs.ball}`,batter});
      if(batter===cs.striker) cs.striker=null; else cs.nonStriker=null;
      const allOut=cs.totalWickets[cs.battingTeam]>=tp(cs.battingTeam).length-1;
      const eoo=advanceBall(true);
      if(allOut){ cs.phase=cs.innings===1?"innings_break":"complete"; persist(); render(); return; }
      cs.phase="next_batter"; persist(); if(!eoo)render();
    }

    function rNextBatter() {
      const avail=availBatters(cs.battingTeam);
      if(!avail.length){ cs.phase=cs.innings===1?"innings_break":"complete"; render(); return; }
      root.innerHTML=`${scorecardHdr()}<div class="guided-card"><div class="gc-title">🏏 Next Batsman</div>
        ${dropdown("nxt-bat",avail,avail[0])}<button class="gc-confirm" id="conf-nb">Confirm →</button></div>`;
      root.querySelector("#conf-nb").addEventListener("click",()=>{
        const name=root.querySelector("#nxt-bat").value; eb(name);
        if(!cs.striker) cs.striker=name; else cs.nonStriker=name;
        cs.phase=cs.ball===0?"bowler":"delivery"; persist(); render();
      });
    }

    function rInningsBreak() {
      root.innerHTML=`<div class="guided-card"><div class="gc-title">🔄 End of Innings 1</div>
        <div class="gc-summary"><strong>${tl(cs.battingTeam)}</strong> scored <strong>${scoreStr(cs.battingTeam)}</strong><br/>Target: <strong>${cs.totalRuns[cs.battingTeam]+1}</strong> runs</div>
        <button class="gc-confirm" id="start-inn2">Start Innings 2 →</button></div>`;
      root.querySelector("#start-inn2").addEventListener("click",()=>{
        cs.innings=2; const prev=cs.battingTeam; cs.battingTeam=cs.bowlingTeam; cs.bowlingTeam=prev;
        cs.striker=null; cs.nonStriker=null; cs.bowler=null; cs.over=0; cs.ball=0; cs.phase="openers";
        persist(); render();
      });
    }

    function rComplete() {
      const hr=cs.totalRuns.home, ar=cs.totalRuns.away;
      const winner=hr>ar?homeLabel:ar>hr?awayLabel:"Tie";
      const rows=Object.entries(cs.batting).map(([n,s])=>`<tr><td>${n}</td><td>${s.runs}</td><td>${s.balls}</td><td>${s.fours}</td><td>${s.sixes}</td><td>${s.dismissed?s.dismissal:"not out"}</td></tr>`).join("");
      root.innerHTML=`<div class="guided-card"><div class="gc-title">🏆 Match Complete — ${winner}</div>
        <div class="cs-final"><div>${homeLabel}: <strong>${scoreStr("home")}</strong></div><div>${awayLabel}: <strong>${scoreStr("away")}</strong></div></div>
        <div class="scorecard-table-wrap"><table class="scorecard-table"><thead><tr><th>Batter</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>How out</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
    }

    render();
    return root;
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  FOOTBALL
  // ─────────────────────────────────────────────────────────────────────────
  function initFootball() {
    const fs = Object.assign({ goals:{home:0,away:0}, events:[], players:{} }, state.football||{});
    [...homePlayers,...awayPlayers].forEach(p=>{ if(!fs.players[p]) fs.players[p]={goals:0,assists:0,fouls:0,yellowCards:0,redCards:0,minutesPlayed:0}; });
    function persist(){ state.football=fs; scheduleAutoSave(); }
    function syncMaster(){ state.state.A.goals=fs.goals.home; state.state.B.goals=fs.goals.away; renderPills(); }

    const root=document.createElement("div"); root.className="sport-ui football-ui";

    function render() {
      root.innerHTML="";
      // Scoreboard
      const sb=document.createElement("div"); sb.className="fb-scoreboard";
      sb.innerHTML=`
        <div class="fb-team"><div class="fb-name">${homeLabel}</div><div class="fb-score">${fs.goals.home}</div><button class="fb-goal-btn" data-team="home">+ Goal</button></div>
        <div class="fb-center"><div class="fb-vs">VS</div></div>
        <div class="fb-team"><div class="fb-name">${awayLabel}</div><div class="fb-score">${fs.goals.away}</div><button class="fb-goal-btn" data-team="away">+ Goal</button></div>`;
      sb.querySelectorAll(".fb-goal-btn").forEach(b=>b.addEventListener("click",()=>promptGoal(b.dataset.team)));
      root.appendChild(sb);

      // Event log
      if(fs.events.length) {
        const log=document.createElement("div"); log.className="fb-event-log";
        log.innerHTML=`<div class="fb-log-title">Match events</div>`+[...fs.events].reverse().map(e=>`<div class="fb-event-row"><span class="fb-event-icon">${{goal:"⚽",assist:"🅰️",foul:"⚠️",yellow:"🟨",red:"🟥"}[e.type]||"•"}</span><span class="fb-event-desc">${e.player||"—"} <em>(${e.team})</em></span><span class="fb-event-min">${e.minute?e.minute+"′":""}</span></div>`).join("");
        root.appendChild(log);
      }

      // Player chips
      [{label:homeLabel,players:homePlayers},{label:awayLabel,players:awayPlayers}].forEach(({label,players})=>{
        const sec=document.createElement("div"); sec.className="fb-team-section";
        sec.innerHTML=`<div class="fb-team-label">${label}</div>`;
        players.forEach(name=>{
          const p=fs.players[name], chip=document.createElement("button"); chip.type="button"; chip.className="player-chip";
          chip.innerHTML=`<span class="pc-name">${name}</span><span class="pc-stat">${p.goals}G ${p.assists}A</span>`;
          chip.addEventListener("click",()=>openPlayerEdit(name,label));
          sec.appendChild(chip);
        });
        root.appendChild(sec);
      });
      syncMaster();
    }

    function promptGoal(team) {
      const pl=team==="home"?homePlayers:awayPlayers, lbl=team==="home"?homeLabel:awayLabel;
      const opts=pl.map(p=>`<option value="${p}">${p}</option>`).join("");
      openModal(`<div class="sm-title">⚽ Goal — ${lbl}</div>
        <label class="sm-label">Scored by</label><select class="gc-select" id="gs">${opts}</select>
        <label class="sm-label" style="margin-top:10px">Assisted by</label><select class="gc-select" id="ga"><option value="">— None —</option>${opts}</select>
        <label class="sm-label" style="margin-top:10px">Minute</label><input class="gc-select" type="number" id="gm" min="1" max="120" placeholder="e.g. 45"/>
        <div class="sm-actions"><button class="gc-confirm" id="sm-ok">Confirm goal</button><button class="sm-cancel" id="sm-cx">Cancel</button></div>`);
      document.getElementById("sm-ok").addEventListener("click",()=>{
        const scorer=document.getElementById("gs").value, assist=document.getElementById("ga").value, min=document.getElementById("gm").value;
        fs.goals[team]++; fs.players[scorer].goals++;
        fs.events.push({type:"goal",team:lbl,player:scorer,minute:min});
        if(assist&&assist!==scorer){ fs.players[assist].assists++; fs.events.push({type:"assist",team:lbl,player:assist,minute:min}); }
        closeModal(); persist(); render();
      });
      document.getElementById("sm-cx").addEventListener("click",closeModal);
    }

    function smStat(label,key,val) {
      return `<div class="sm-stat-row"><span class="sm-stat-label">${label}</span>
        <div class="df-counter">
          <button type="button" class="df-counter-btn" onclick="(function(){var e=document.getElementById('st-${key}');e.value=Math.max(0,+e.value-1);})()">−</button>
          <input class="df-counter-val" id="st-${key}" type="number" value="${val}" style="width:50px;text-align:center;background:transparent;border:none;color:#fff;font-family:'Bebas Neue',sans-serif;font-size:28px"/>
          <button type="button" class="df-counter-btn df-counter-plus" onclick="(function(){var e=document.getElementById('st-${key}');e.value=+e.value+1;})()">+</button>
        </div></div>`;
    }

    function openPlayerEdit(name, teamLabel) {
      const p=fs.players[name];
      openModal(`<div class="sm-title">👤 ${name} <span style="font-size:13px;opacity:.6">${teamLabel}</span></div>
        ${smStat("Goals","goals",p.goals)}${smStat("Assists","assists",p.assists)}
        ${smStat("Fouls","fouls",p.fouls)}${smStat("Yellow cards","yellowCards",p.yellowCards)}
        ${smStat("Red cards","redCards",p.redCards)}${smStat("Minutes played","minutesPlayed",p.minutesPlayed)}
        <div class="sm-actions"><button class="gc-confirm" id="sm-sv">Save</button><button class="sm-cancel" id="sm-cx">Cancel</button></div>`);
      document.getElementById("sm-sv").addEventListener("click",()=>{
        ["goals","assists","fouls","yellowCards","redCards","minutesPlayed"].forEach(k=>{ const el=document.getElementById(`st-${k}`); if(el) p[k]=Number(el.value)||0; });
        closeModal(); persist(); render();
      });
      document.getElementById("sm-cx").addEventListener("click",closeModal);
    }

    render(); return root;
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  BASKETBALL
  // ─────────────────────────────────────────────────────────────────────────
  function initBasketball() {
    const bs = Object.assign({ score:{home:0,away:0}, quarter:1, events:[], players:{}, phase:"match" }, state.basketball||{});
    [...homePlayers,...awayPlayers].forEach(p=>{ if(!bs.players[p]) bs.players[p]={points:0,assists:0,rebounds:0,steals:0,blocks:0,fouls:0,turnovers:0}; });
    function persist(){ state.basketball=bs; scheduleAutoSave(); }
    function syncMaster(){ state.state.A.points=bs.score.home; state.state.B.points=bs.score.away; renderPills(); }

    const PLAYS=[
      {label:"Free throw (1pt)",val:"ft",pts:1},{label:"2-pointer",val:"2pt",pts:2},{label:"3-pointer",val:"3pt",pts:3},
      {label:"Assist",val:"assist",pts:0},{label:"Rebound",val:"rebound",pts:0},{label:"Steal",val:"steal",pts:0},
      {label:"Block",val:"block",pts:0},{label:"Foul",val:"foul",pts:0},{label:"Turnover",val:"turnover",pts:0},
    ];

    const root=document.createElement("div"); root.className="sport-ui basketball-ui";

    function render() {
      root.innerHTML="";
      const sb=document.createElement("div"); sb.className="fb-scoreboard";
      sb.innerHTML=`
        <div class="fb-team"><div class="fb-name">${homeLabel}</div><div class="fb-score">${bs.score.home}</div></div>
        <div class="fb-center"><div class="fb-vs">Q${bs.quarter}</div>
          ${bs.phase!=="complete"?`<button class="gc-confirm" style="margin-top:8px;padding:6px 14px;font-size:12px" id="next-q">${bs.quarter<4?`End Q${bs.quarter}`:"Full time"}</button>`:""}</div>
        <div class="fb-team"><div class="fb-name">${awayLabel}</div><div class="fb-score">${bs.score.away}</div></div>`;
      root.appendChild(sb);
      sb.querySelector("#next-q")?.addEventListener("click",()=>{ if(bs.quarter>=4){bs.phase="complete";}else{bs.quarter++;} persist(); render(); });

      if(bs.phase==="complete"){
        const winner=bs.score.home>bs.score.away?homeLabel:bs.score.away>bs.score.home?awayLabel:"Tie";
        const msg=document.createElement("div"); msg.className="guided-card"; msg.innerHTML=`<div class="gc-title">🏆 Final — ${winner}</div>`; root.appendChild(msg);
      }

      [{label:homeLabel,players:homePlayers,team:"home"},{label:awayLabel,players:awayPlayers,team:"away"}].forEach(({label,players,team})=>{
        const sec=document.createElement("div"); sec.className="fb-team-section";
        sec.innerHTML=`<div class="fb-team-label">${label}</div>`;
        players.forEach(name=>{
          const p=bs.players[name], chip=document.createElement("button"); chip.type="button"; chip.className="player-chip";
          chip.innerHTML=`<span class="pc-name">${name}</span><span class="pc-stat">${p.points}pts</span>`;
          chip.addEventListener("click",()=>openPlayPrompt(name,team,label));
          sec.appendChild(chip);
        });
        root.appendChild(sec);
      });
      syncMaster();
    }

    function openPlayPrompt(playerName,team,teamLabel) {
      openModal(`<div class="sm-title">🏀 ${playerName} <span style="font-size:13px;opacity:.6">${teamLabel}</span></div>
        <div class="gc-options small" style="margin-top:12px">${PLAYS.map(o=>`<button class="gc-opt small" data-val="${o.val}" data-pts="${o.pts}">${o.label}</button>`).join("")}</div>
        <div class="sm-actions"><button class="sm-cancel" id="bk-cx">Cancel</button></div>`);
      document.getElementById("bk-cx").addEventListener("click",closeModal);
      document.querySelectorAll("[data-val]").forEach(btn=>btn.addEventListener("click",()=>{
        const val=btn.dataset.val, pts=Number(btn.dataset.pts), p=bs.players[playerName];
        if(pts>0){p.points+=pts; bs.score[team]+=pts;}
        if(val==="assist")   p.assists++;
        if(val==="rebound")  p.rebounds++;
        if(val==="steal")    p.steals++;
        if(val==="block")    p.blocks++;
        if(val==="foul")     p.fouls++;
        if(val==="turnover") p.turnovers++;
        bs.events.push({player:playerName,team:teamLabel,type:val,pts,quarter:bs.quarter});
        closeModal(); persist(); render();
      }));
    }

    render(); return root;
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  BADMINTON / TENNIS
  // ─────────────────────────────────────────────────────────────────────────
  function initBadminton(sportName) {
    const isTennis=sportName.includes("tennis");
    const cfg=isTennis
      ?{name:"Tennis",  pointSeq:["0","15","30","40","AD"],gamesPerSet:6,setsToWin:2,tiebreak:true}
      :{name:"Badminton",pointSeq:null,gamesPerSet:21,setsToWin:2,tiebreak:false};

    const ts = Object.assign({
      sets:[], currentSet:{home:0,away:0}, tennisPts:{home:0,away:0},
      tiebreak:false, tbPts:{home:0,away:0}, server:null,
      setsWon:{home:0,away:0}, phase:"setup", players:{},
    }, state.badminton||{});

    [...homePlayers,...awayPlayers].forEach(p=>{ if(!ts.players[p]) ts.players[p]={pointsWon:0}; });
    function persist(){ state.badminton=ts; scheduleAutoSave(); }
    function syncMaster(){ state.state.A.setsWon=ts.setsWon.home; state.state.B.setsWon=ts.setsWon.away; renderPills(); }

    const root=document.createElement("div"); root.className="sport-ui badminton-ui";

    function render() {
      root.innerHTML="";
      if(ts.phase==="setup")     rSetup();
      else if(ts.phase==="complete") rComplete();
      else                       rPlaying();
      syncMaster();
    }

    function rSetup() {
      root.innerHTML=`<div class="guided-card"><div class="gc-title">🎾 ${cfg.name} — Who serves first?</div>
        <div class="gc-options"><button class="gc-opt" data-val="home">${homeLabel}</button><button class="gc-opt" data-val="away">${awayLabel}</button></div></div>`;
      root.querySelectorAll(".gc-opt").forEach(b=>b.addEventListener("click",()=>{ ts.server=b.dataset.val; ts.phase="playing"; persist(); render(); }));
    }

    function curScore() {
      if(!isTennis) return {home:ts.currentSet.home,away:ts.currentSet.away};
      if(ts.tiebreak) return {home:ts.tbPts.home,away:ts.tbPts.away};
      const seq=cfg.pointSeq, hi=ts.tennisPts.home, ai=ts.tennisPts.away;
      if(hi>=3&&ai>=3){ if(hi===ai) return {home:"Deuce",away:"Deuce"}; return hi>ai?{home:"AD",away:""}:{home:"",away:"AD"}; }
      return {home:seq[Math.min(hi,seq.length-1)],away:seq[Math.min(ai,seq.length-1)]};
    }

    function rPlaying() {
      const sc=curScore();
      root.innerHTML=`
        <div class="bt-header">
          <div class="bt-name">${homeLabel}</div><div class="bt-sets">${ts.setsWon.home}</div>
          <div class="bt-sep">sets</div>
          <div class="bt-sets">${ts.setsWon.away}</div><div class="bt-name">${awayLabel}</div>
        </div>
        ${ts.sets.length?`<div class="bt-past-sets">${ts.sets.map((s,i)=>`<span class="bt-past-chip">Set ${i+1}: ${s.home}–${s.away}</span>`).join("")}</div>`:""}
        <div class="bt-score-row">
          <div class="bt-cur-score home">${sc.home}</div>
          <div class="bt-cur-sep">${ts.tiebreak?"TB":isTennis?"game":"pts"}</div>
          <div class="bt-cur-score away">${sc.away}</div>
        </div>
        <div class="bt-point-btns">
          <button class="bt-pt-btn home" id="pt-home">Point → ${homeLabel}</button>
          <button class="bt-pt-btn away" id="pt-away">Point → ${awayLabel}</button>
        </div>`;
      root.querySelector("#pt-home").addEventListener("click",()=>{addPoint("home","away");persist();render();});
      root.querySelector("#pt-away").addEventListener("click",()=>{addPoint("away","home");persist();render();});
    }

    function addPoint(side,other) {
      if(isTennis) addTennisPoint(side,other); else addBadmintonPoint(side,other);
    }

    function addTennisPoint(side,other) {
      if(ts.tiebreak){ ts.tbPts[side]++; const s=ts.tbPts[side],o=ts.tbPts[other]; if(s>=7&&s-o>=2){ts.currentSet[side]++;endSet(side,other);} return; }
      ts.tennisPts[side]++;
      const si=ts.tennisPts[side],oi=ts.tennisPts[other];
      if(si>=3&&oi>=3){ if(si-oi>=2){ts.tennisPts={home:0,away:0};ts.currentSet[side]++;checkSetEnd(side,other);} return; }
      if(si>=4){ts.tennisPts={home:0,away:0};ts.currentSet[side]++;checkSetEnd(side,other);}
    }
    function checkSetEnd(side,other) {
      const s=ts.currentSet[side],o=ts.currentSet[other];
      if(s===6&&o===6&&cfg.tiebreak){ts.tiebreak=true;ts.tbPts={home:0,away:0};return;}
      if(s>=cfg.gamesPerSet&&s-o>=2) endSet(side,other);
    }
    function endSet(side,other) {
      ts.sets.push({home:ts.currentSet.home,away:ts.currentSet.away}); ts.setsWon[side]++;
      ts.currentSet={home:0,away:0}; ts.tiebreak=false; ts.tbPts={home:0,away:0}; ts.tennisPts={home:0,away:0}; ts.server=other;
      if(ts.setsWon[side]>=cfg.setsToWin) ts.phase="complete";
    }
    function addBadmintonPoint(side,other) {
      ts.currentSet[side]++; const s=ts.currentSet[side],o=ts.currentSet[other];
      if((s>=cfg.gamesPerSet&&s-o>=2)||s>=30){ts.sets.push({home:ts.currentSet.home,away:ts.currentSet.away});ts.setsWon[side]++;ts.currentSet={home:0,away:0};ts.server=other;if(ts.setsWon[side]>=cfg.setsToWin)ts.phase="complete";}
    }

    function rComplete() {
      const winner=ts.setsWon.home>ts.setsWon.away?homeLabel:awayLabel;
      root.innerHTML=`<div class="guided-card"><div class="gc-title">🏆 Match Complete</div>
        <div class="cs-final"><div>${homeLabel}: <strong>${ts.setsWon.home} sets</strong></div><div>${awayLabel}: <strong>${ts.setsWon.away} sets</strong></div><div class="cs-winner">Winner: ${winner}</div></div>
        <div class="bt-past-sets">${ts.sets.map((s,i)=>`<span class="bt-past-chip">Set ${i+1}: ${s.home}–${s.away}</span>`).join("")}</div></div>`;
    }

    render(); return root;
  }

  // ── Sport router ──────────────────────────────────────────────────────────
  const sport = (schema.sport||"").toLowerCase();

  function hideTapHints() {
    document.querySelectorAll(".team-tap-hint").forEach(el=>el.style.display="none");
    document.querySelectorAll(".team-block").forEach(el=>el.style.cursor="default");
  }

  if(sport.includes("cricket")) {
    hideTapHints();
    rosterArea?.appendChild(initCricket());
  } else if(sport.includes("football")||sport.includes("soccer")) {
    hideTapHints();
    document.getElementById("scoreboard")?.style.setProperty("display","none");
    rosterArea?.appendChild(initFootball());
  } else if(sport.includes("basketball")) {
    hideTapHints();
    document.getElementById("scoreboard")?.style.setProperty("display","none");
    rosterArea?.appendChild(initBasketball());
  } else if(sport.includes("badminton")||sport.includes("tennis")) {
    hideTapHints();
    document.getElementById("scoreboard")?.style.setProperty("display","none");
    rosterArea?.appendChild(initBadminton(sport));
  } else {
    buildGenericRosterPanels();
    const lf=schema?.winnerLogic?.field;
    if(lf){ if(homeScoreEl) homeScoreEl.textContent=Number(state.state.A?.[lf]??0); if(awayScoreEl) awayScoreEl.textContent=Number(state.state.B?.[lf]??0); }
  }

  // ── Timer ─────────────────────────────────────────────────────────────────
  let timerInterval=null;
  function formatMs(ms){ const t=Math.max(0,Math.floor(ms/1000)); return `${String(Math.floor(t/60)).padStart(2,"0")}:${String(t%60).padStart(2,"0")}`; }
  function renderTimer(){ if(timerDisplay) timerDisplay.textContent=formatMs(state.timer.elapsedMs); }
  function tickTimer(){ if(!state.timer.running||state.timer.startedAtEpochMs==null) return; const now=Date.now(); state.timer.elapsedMs+=now-state.timer.startedAtEpochMs; state.timer.startedAtEpochMs=now; renderTimer(); }
  function startTimer(){ if(state.timer.running) return; state.timer.running=true; state.timer.startedAtEpochMs=Date.now(); if(timerInterval) clearInterval(timerInterval); timerInterval=setInterval(tickTimer,250); }
  function pauseTimer(){ if(!state.timer.running) return; tickTimer(); state.timer.running=false; state.timer.startedAtEpochMs=null; if(timerInterval) clearInterval(timerInterval); timerInterval=null; }
  function resetTimer(){ state.timer.elapsedMs=0; state.timer.running=false; state.timer.startedAtEpochMs=null; if(timerInterval) clearInterval(timerInterval); timerInterval=null; renderTimer(); }
  timerStartBtn?.addEventListener("click",startTimer);
  timerPauseBtn?.addEventListener("click",pauseTimer);
  timerResetBtn?.addEventListener("click",resetTimer);
  renderTimer();

  // ── Config fields + pills ─────────────────────────────────────────────────
  renderConfigFields();
  renderPills();

  // ── Save (manual + auto) ──────────────────────────────────────────────────
  let _saveDebounce=null;
  function scheduleAutoSave(){ clearTimeout(_saveDebounce); _saveDebounce=setTimeout(doSave,1500); }

  async function doSave() {
    if(saveBtn) saveBtn.disabled=true;
    if(saveMsg){ saveMsg.style.display="inline-flex"; saveMsg.textContent="Saving…"; saveMsg.classList.remove("error"); }
    if(state.timer.running) tickTimer();
    try {
      const payload={
        categoryId,roundIndex,matchIndex,scoreIndex,
        score:{
          config:state.config, state:state.state, timer:{elapsedMs:state.timer.elapsedMs},
          ...(state.cricket    &&{cricket:state.cricket}),
          ...(state.football   &&{football:state.football}),
          ...(state.basketball &&{basketball:state.basketball}),
          ...(state.badminton  &&{badminton:state.badminton}),
        },
      };
      const resp=await apiPut(`/api/host/tournaments/${encodeURIComponent(tournamentId)}/matches/score`,payload);
      if(saveMsg){ saveMsg.textContent="Saved ✅"; saveMsg.style.display="inline-flex"; }
      const computed=resp?.match?.score?.computed||null;
      if(computed){
        if(statusPill) statusPill.innerHTML=`Status: <strong>${computed.status}</strong>`;
        if(winnerPill) winnerPill.innerHTML=`Winner: <strong>${computed.winnerName||"-"}</strong>`;
        if(reasonPill) reasonPill.innerHTML=`Reason: <strong>${computed.reason||"-"}</strong>`;
      }
    } catch(e) {
      console.error(e);
      if(saveMsg){ saveMsg.classList.add("error"); saveMsg.style.display="inline-flex"; saveMsg.textContent=`Save failed: ${String(e?.message||e)}`; }
    } finally {
      if(saveBtn) saveBtn.disabled=false;
    }
  }

  saveBtn?.addEventListener("click",doSave);
});