// Fixtures (knockout bracket) page with persistent fixtures per tournament
document.addEventListener("DOMContentLoaded", () => {
  // --- Top bar & auth ---
  const usernameLabel = document.getElementById("username-label");
  const signoutBtn = document.getElementById("signout-btn");
  const userMenuTrigger = document.getElementById("host-user-menu-trigger");
  const userMenuDropdown = document.getElementById("host-user-menu-dropdown");
  const switchPlayerModeBtn = document.getElementById("switch-player-mode");
  const backBtn = document.getElementById("fixtures-back-btn");
  const generateBtn = document.getElementById("fixtures-generate-btn");
  const toastEl = document.getElementById("fixtures-toast");

  const storedUsername =
    localStorage.getItem("scheduleItUser") ||
    localStorage.getItem("scheduleitUser");

  if (!storedUsername) {
    window.location.href = "index.html";
    return;
  }

  if (usernameLabel) {
    usernameLabel.textContent = storedUsername;
  }

  const closeDropdown = () => {
    if (userMenuDropdown) {
      userMenuDropdown.classList.remove("is-open");
    }
  };

  const toggleDropdown = () => {
    if (userMenuDropdown) {
      userMenuDropdown.classList.toggle("is-open");
    }
  };

  if (userMenuTrigger && userMenuDropdown) {
    userMenuTrigger.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleDropdown();
    });

    document.addEventListener("click", () => {
      closeDropdown();
    });
  }

  if (switchPlayerModeBtn) {
    switchPlayerModeBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      closeDropdown();
      window.location.href = "join.html";
    });
  }

  if (signoutBtn) {
    signoutBtn.addEventListener("click", () => {
      localStorage.removeItem("scheduleItUser");
      localStorage.removeItem("scheduleitUser");
      window.location.href = "index.html";
    });
  }

  // --- Toast helper ---
  let toastTimeoutId = null;
  function showToast(message) {
    if (!toastEl) return;
    toastEl.textContent = `✓ ${message}`;
    toastEl.style.display = "inline-flex";
    if (toastTimeoutId) {
      clearTimeout(toastTimeoutId);
    }
    toastTimeoutId = setTimeout(() => {
      toastEl.style.display = "none";
    }, 2500);
  }

  // --- Tournament header elements ---
  const titleEl = document.getElementById("fixtures-tournament-name");
  const sportEl = document.getElementById("fixtures-tournament-sport");
  const datesEl = document.getElementById("fixtures-tournament-dates");
  const codeEl = document.getElementById("fixtures-tournament-code");

  // Group containers & empty states
  const maleGroupEl = document.getElementById("fixtures-group-male");
  const femaleGroupEl = document.getElementById("fixtures-group-female");

  const maleEmptyEl = document.getElementById("fixtures-empty-state-male");
  const maleBracketEl = document.getElementById("fixtures-bracket-male");
  const femaleEmptyEl = document.getElementById("fixtures-empty-state-female");
  const femaleBracketEl = document.getElementById("fixtures-bracket-female");

  const noneSelectedEl = document.getElementById("fixtures-none-selected");

  // Toggle buttons
  const toggleMaleBtn = document.getElementById("fixtures-toggle-male");
  const toggleFemaleBtn = document.getElementById("fixtures-toggle-female");

  const TOURNAMENT_KEY = "scheduleitTournaments";
  const FIXTURES_KEY_PREFIX = "scheduleitFixtures_";

  function loadAllTournaments() {
    const raw = localStorage.getItem(TOURNAMENT_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error("Failed to parse tournaments", err);
      return [];
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function shuffle(array) {
    const arr = array.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // --- Fixtures persistence helpers ---
  function getFixturesStorageKey(tournamentId) {
    if (!tournamentId && tournamentId !== 0) return null;
    return `${FIXTURES_KEY_PREFIX}${String(tournamentId)}`;
  }

  function saveFixturesToStorage(tournamentId, bracketsByGroup) {
    const key = getFixturesStorageKey(tournamentId);
    if (!key) return;
    try {
      const payload = {
        male: bracketsByGroup.male,
        female: bracketsByGroup.female,
      };
      localStorage.setItem(key, JSON.stringify(payload));
    } catch (err) {
      console.error("Failed to save fixtures", err);
    }
  }

  function loadFixturesFromStorage(tournamentId) {
    const key = getFixturesStorageKey(tournamentId);
    if (!key) return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      return {
        male: parsed.male || null,
        female: parsed.female || null,
      };
    } catch (err) {
      console.error("Failed to parse fixtures from storage", err);
      return null;
    }
  }

  // --- Bracket data + helpers ---

  const bracketDataByGroup = {
    male: null,
    female: null,
  };

  // Whether fixtures exist for this tournament (generated now or loaded)
  let fixturesGenerated = false;

  function createEmptyMatch(groupKey, roundIndex, matchIndex) {
    return {
      id: `${groupKey}-r${roundIndex}-m${matchIndex}`,
      roundIndex,
      matchIndex,
      home: { name: "", isBye: false },
      away: { name: "", isBye: false },
      homeScore: "",
      awayScore: "",
      winnerSide: null,
    };
  }

  function setMatchWinner(bracket, roundIndex, matchIndex, side, opts = {}) {
    const match = bracket.rounds[roundIndex][matchIndex];
    if (!match) return;

    if (opts.homeScore !== undefined) {
      match.homeScore = opts.homeScore;
    }
    if (opts.awayScore !== undefined) {
      match.awayScore = opts.awayScore;
    }

    match.winnerSide = side;

    const winnerPlayer = match[side];
    const winnerName = winnerPlayer.name;

    // Final round: nothing to propagate
    if (roundIndex >= bracket.totalRounds - 1) {
      return;
    }

    // Push winner to the next round
    const nextRoundIndex = roundIndex + 1;
    const nextMatchIndex = Math.floor(matchIndex / 2);
    const nextSide = matchIndex % 2 === 0 ? "home" : "away";

    const nextMatch = bracket.rounds[nextRoundIndex][nextMatchIndex];
    if (!nextMatch) return;

    nextMatch[nextSide].name = winnerName;
    nextMatch[nextSide].isBye = winnerName === "BYE";

    // If the opponent in next round is BYE and winner is real, auto-advance again
    if (winnerName !== "BYE") {
      const other =
        nextSide === "home" ? nextMatch.away : nextMatch.home;
      if (other.name === "BYE" && !nextMatch.winnerSide) {
        setMatchWinner(bracket, nextRoundIndex, nextMatchIndex, nextSide, {});
      }
    }
  }

  function autoAdvanceByes(bracket) {
    for (let r = 0; r < bracket.totalRounds; r++) {
      const matches = bracket.rounds[r];
      for (let m = 0; m < matches.length; m++) {
        const match = matches[m];
        const hName = match.home.name;
        const aName = match.away.name;
        const hBye = hName === "BYE";
        const aBye = aName === "BYE";

        if (hBye && !aBye) {
          setMatchWinner(bracket, r, m, "away", {});
        } else if (!hBye && aBye) {
          setMatchWinner(bracket, r, m, "home", {});
        }
      }
    }
  }

  function createBracketData(names, groupKey) {
    if (!names || !names.length) {
      return {
        groupKey,
        totalRounds: 0,
        rounds: [],
        N: 0,
        P: 0,
      };
    }

    const shuffledPlayers = shuffle(names);
    const N = shuffledPlayers.length;

    let P = 1;
    while (P < N) P *= 2; // next power of 2
    const byes = P - N;
    const matchCountRound0 = P / 2;
    const totalRounds = Math.log2(P);

    const rounds = [];

    // Allocate first round slots with BYEs distributed (no BYE vs BYE)
    const slots = new Array(P).fill(null);

    const allMatchIndices = Array.from(
      { length: matchCountRound0 },
      (_, i) => i
    );
    const shuffledMatchIndices = shuffle(allMatchIndices);
    const byeMatchIndices = shuffledMatchIndices.slice(0, byes);

    // Put BYEs into random side of selected matches
    byeMatchIndices.forEach((matchIndex) => {
      const side = Math.random() < 0.5 ? 0 : 1;
      const slotIndex = matchIndex * 2 + side;
      slots[slotIndex] = "BYE";
    });

    // Fill remaining slots with players
    let playerIdx = 0;
    for (let i = 0; i < P; i++) {
      if (slots[i] === null) {
        slots[i] = shuffledPlayers[playerIdx];
        playerIdx++;
      }
    }

    // Round 1 matches
    const round0 = [];
    for (let i = 0; i < P; i += 2) {
      const homeName = slots[i];
      const awayName = slots[i + 1];

      const matchIndex = i / 2;
      round0.push({
        id: `${groupKey}-r0-m${matchIndex}`,
        roundIndex: 0,
        matchIndex,
        home: { name: homeName, isBye: homeName === "BYE" },
        away: { name: awayName, isBye: awayName === "BYE" },
        homeScore: "",
        awayScore: "",
        winnerSide: null,
      });
    }
    rounds.push(round0);

    // Subsequent rounds (empty matches, to be filled by winners)
    let prevMatchCount = matchCountRound0;
    for (let r = 1; r < totalRounds; r++) {
      const matchCount = prevMatchCount / 2;
      const roundMatches = [];
      for (let m = 0; m < matchCount; m++) {
        roundMatches.push(createEmptyMatch(groupKey, r, m));
      }
      rounds.push(roundMatches);
      prevMatchCount = matchCount;
    }

    const bracket = {
      groupKey,
      totalRounds,
      rounds,
      N,
      P,
    };

    // Auto-advance players who get a BYE
    autoAdvanceByes(bracket);

    return bracket;
  }

  function getRoundLabel(roundIndex, totalRounds) {
    if (totalRounds === 1) return "Final";
    if (roundIndex === totalRounds - 1) return "Final";
    if (roundIndex === totalRounds - 2) return "Semi final";
    return `Round ${roundIndex + 1}`;
  }

    // --- Sync fixtures into the tournament object for player schedule view ---
  function syncFixturesIntoTournament(tournamentId, bracketsByGroup) {
    if (tournamentId === null || tournamentId === undefined) return;

    const all = loadAllTournaments();
    const idx = all.findIndex(
      (t) => t && String(t.id) === String(tournamentId)
    );
    if (idx === -1) return;

    const flatFixtures = [];

    ["male", "female"].forEach((groupKey) => {
      const bracket = bracketsByGroup[groupKey];
      if (!bracket || !Array.isArray(bracket.rounds)) return;

      const totalRounds =
        typeof bracket.totalRounds === "number"
          ? bracket.totalRounds
          : bracket.rounds.length;

      bracket.rounds.forEach((roundMatches, roundIndex) => {
        const roundLabel = getRoundLabel(roundIndex, totalRounds);

        roundMatches.forEach((match, matchIndex) => {
          if (!match) return;

          const player1 = match.home?.name || "";
          const player2 = match.away?.name || "";

          const score1 =
            match.homeScore !== undefined ? match.homeScore : "";
          const score2 =
            match.awayScore !== undefined ? match.awayScore : "";

          const score =
            score1 !== "" || score2 !== ""
              ? `${score1 ?? ""}-${score2 ?? ""}`
              : "";

          flatFixtures.push({
            group: groupKey,
            round: roundLabel,
            roundIndex,
            matchIndex,
            matchLabel: `${roundLabel} • Match ${matchIndex + 1}`,
            player1,
            player2,
            score1,
            score2,
            score,
          });
        });
      });
    });

    // Store fixtures on the tournament itself so schedule.js can read it
    all[idx].fixtures = flatFixtures;
    localStorage.setItem(TOURNAMENT_KEY, JSON.stringify(all));
  }


  function renderBracketForGroup(groupKey) {
    const bracket = bracketDataByGroup[groupKey];
    const cfg =
      groupKey === "male"
        ? { bracketEl: maleBracketEl, emptyEl: maleEmptyEl }
        : { bracketEl: femaleBracketEl, emptyEl: femaleEmptyEl };

    if (!cfg.bracketEl || !cfg.emptyEl) return;

    if (!bracket || !bracket.rounds.length || bracket.N < 2) {
      cfg.bracketEl.innerHTML = "";
      cfg.bracketEl.style.display = "none";
      cfg.emptyEl.style.display = "flex";
      return;
    }

    const { rounds, totalRounds } = bracket;

    const htmlRounds = rounds
      .map((roundMatches, roundIndex) => {
        const roundLabel = getRoundLabel(roundIndex, totalRounds);

        const matchesHtml = roundMatches
          .map((match, matchIndex) => {
            const label = `${roundLabel} • Match ${matchIndex + 1}`;
            const winner = match.winnerSide;

            const home = match.home;
            const away = match.away;

            const homeScore =
              match.homeScore !== undefined ? match.homeScore : "";
            const awayScore =
              match.awayScore !== undefined ? match.awayScore : "";

            const homeClasses = [
              "player-slot",
              home.name === "BYE" ? "bye" : "",
              winner === "home" ? "winner" : "",
            ]
              .filter(Boolean)
              .join(" ");

            const awayClasses = [
              "player-slot",
              away.name === "BYE" ? "bye" : "",
              winner === "away" ? "winner" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return `
              <div class="bracket-match"
                   data-group="${groupKey}"
                   data-round="${roundIndex}"
                   data-match="${matchIndex}">
                <div class="match-label">${escapeHtml(label)}</div>

                <div class="${homeClasses}">
                  <span class="player-name">${escapeHtml(
                    home.name || ""
                  )}</span>
                  <input
                    type="number"
                    class="player-score-input"
                    data-side="home"
                    min="0"
                    placeholder="0"
                    value="${
                      home.name === "BYE" ? "" : escapeHtml(homeScore)
                    }"
                    ${home.name === "BYE" ? "disabled" : ""}
                  />
                  <button
                    type="button"
                    class="winner-button"
                    data-side="home"
                    ${home.name === "BYE" ? "disabled" : ""}
                  >
                    ✓
                  </button>
                </div>

                <div class="${awayClasses}">
                  <span class="player-name">${escapeHtml(
                    away.name || ""
                  )}</span>
                  <input
                    type="number"
                    class="player-score-input"
                    data-side="away"
                    min="0"
                    placeholder="0"
                    value="${
                      away.name === "BYE" ? "" : escapeHtml(awayScore)
                    }"
                    ${away.name === "BYE" ? "disabled" : ""}
                  />
                  <button
                    type="button"
                    class="winner-button"
                    data-side="away"
                    ${away.name === "BYE" ? "disabled" : ""}
                  >
                    ✓
                  </button>
                </div>
              </div>
            `;
          })
          .join("");

        return `
          <div class="bracket-round" data-round="${roundIndex}">
            <div class="round-title">${escapeHtml(roundLabel)}</div>
            ${matchesHtml}
          </div>
        `;
      })
      .join("");

    cfg.bracketEl.innerHTML = `<div class="bracket-rounds">${htmlRounds}</div>`;
    cfg.emptyEl.style.display = "none";
    cfg.bracketEl.style.display = "block";
  }

  function showNoFixturesMessage() {
    if (!noneSelectedEl) return;
    noneSelectedEl.style.display = "flex";
    const h = noneSelectedEl.querySelector("h3");
    const p = noneSelectedEl.querySelector(".muted");
    if (h) h.textContent = "No fixtures generated yet";
    if (p) {
      p.innerHTML =
        'Click <strong>"Generate fixtures"</strong> to create the draw for this category.';
    }
    if (maleGroupEl) maleGroupEl.style.display = "none";
    if (femaleGroupEl) femaleGroupEl.style.display = "none";
  }

  function attachBracketEvents(groupKey, bracketEl, getTournamentIdForStorage) {
    if (!bracketEl) return;

    bracketEl.addEventListener("click", (event) => {
      const btn = event.target.closest(".winner-button");
      if (!btn) return;

      const matchEl = btn.closest(".bracket-match");
      if (!matchEl) return;

      const side = btn.dataset.side;
      const roundIndex = Number(matchEl.dataset.round);
      const matchIndex = Number(matchEl.dataset.match);

      const bracket = bracketDataByGroup[groupKey];
      if (!bracket) return;

      const homeInput = matchEl.querySelector(
        '.player-score-input[data-side="home"]'
      );
      const awayInput = matchEl.querySelector(
        '.player-score-input[data-side="away"]'
      );

      const homeScore =
        homeInput && homeInput.value !== ""
          ? Number(homeInput.value)
          : "";
      const awayScore =
        awayInput && awayInput.value !== ""
          ? Number(awayInput.value)
          : "";

      setMatchWinner(bracket, roundIndex, matchIndex, side, {
        homeScore,
        awayScore,
      });

      renderBracketForGroup(groupKey);

    const tid = getTournamentIdForStorage();
      if (tid !== null && tid !== undefined) {
        saveFixturesToStorage(tid, bracketDataByGroup);
        syncFixturesIntoTournament(tid, bracketDataByGroup);
      }

    });
  }

  function clearToggleActive() {
    if (toggleMaleBtn) toggleMaleBtn.classList.remove("active");
    if (toggleFemaleBtn) toggleFemaleBtn.classList.remove("active");
  }

  function hideAllGroups() {
    if (maleGroupEl) maleGroupEl.style.display = "none";
    if (femaleGroupEl) femaleGroupEl.style.display = "none";
  }

  // --- Read tournament id from URL ---
  const params = new URLSearchParams(window.location.search);
  const idParam = params.get("tournamentId");

  const allTournaments = loadAllTournaments();
  const tournament = idParam
    ? allTournaments.find((t) => String(t.id) === String(idParam))
    : null;

  const tournamentIdForStorage =
    tournament && tournament.id !== undefined && tournament.id !== null
      ? tournament.id
      : idParam;

  // Back button
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      if (idParam) {
        window.location.href = `players.html?tournamentId=${encodeURIComponent(
          idParam
        )}`;
      } else {
        window.location.href = "players.html";
      }
    });
  }

  // No tournament found
  if (!tournament) {
    if (titleEl) titleEl.textContent = "No tournament selected";

    if (noneSelectedEl) noneSelectedEl.style.display = "none";

    if (maleGroupEl) maleGroupEl.style.display = "block";
    if (femaleGroupEl) femaleGroupEl.style.display = "block";

    if (maleEmptyEl) {
      maleEmptyEl.style.display = "flex";
      const h = maleEmptyEl.querySelector("h3");
      const p = maleEmptyEl.querySelector(".muted");
      if (h) h.textContent = "No tournament selected";
      if (p)
        p.textContent =
          "Open this fixtures page from the Players list on the Host side.";
    }

    if (femaleEmptyEl) {
      femaleEmptyEl.style.display = "flex";
      const h = femaleEmptyEl.querySelector("h3");
      const p = femaleEmptyEl.querySelector(".muted");
      if (h) h.textContent = "No tournament selected";
      if (p)
        p.textContent =
          "Open this fixtures page from the Players list on the Host side.";
    }

    if (toggleMaleBtn) toggleMaleBtn.disabled = true;
    if (toggleFemaleBtn) toggleFemaleBtn.disabled = true;
    if (generateBtn) generateBtn.disabled = true;

    return;
  }

  // --- Fill header with tournament info ---
  if (titleEl) {
    titleEl.textContent = tournament.tournamentName || "Tournament";
  }
  if (sportEl) {
    sportEl.textContent = tournament.sportName || "";
  }
  if (datesEl) {
    datesEl.textContent = tournament.tournamentDates
      ? `• ${tournament.tournamentDates}`
      : "";
  }
  if (codeEl) {
    codeEl.textContent = tournament.accessCode || "—";
  }

  const players = Array.isArray(tournament.players) ? tournament.players : [];

  // Split by gender
  const maleNames = players
    .filter((p) => (p.gender || "").toLowerCase() === "male")
    .map((p, idx) => p.name || `Player M${idx + 1}`);

  const femaleNames = players
    .filter((p) => (p.gender || "").toLowerCase() === "female")
    .map((p, idx) => p.name || `Player F${idx + 1}`);

  // Try to load existing fixtures
  const storedFixtures = loadFixturesFromStorage(tournamentIdForStorage);
  if (storedFixtures && (storedFixtures.male || storedFixtures.female)) {
    bracketDataByGroup.male = storedFixtures.male;
    bracketDataByGroup.female = storedFixtures.female;
    fixturesGenerated = true;

    // Hide the large message – user already has draws
    if (noneSelectedEl) {
      noneSelectedEl.style.display = "none";
    }
  }

  function generateAllBrackets() {
    // Reset existing brackets in memory
    bracketDataByGroup.male = null;
    bracketDataByGroup.female = null;

    // Create brand-new brackets from player lists
    bracketDataByGroup.male = createBracketData(maleNames, "male");
    bracketDataByGroup.female = createBracketData(femaleNames, "female");
    fixturesGenerated = true;

    // Hide the big info box once draws exist
    if (noneSelectedEl) {
      noneSelectedEl.style.display = "none";
    }

    // Persist new fixtures
    saveFixturesToStorage(tournamentIdForStorage, bracketDataByGroup);
    syncFixturesIntoTournament(tournamentIdForStorage, bracketDataByGroup);
    showToast("Draws generated");
  }


  function showGroup(group) {
    clearToggleActive();

    if (group === "male" && toggleMaleBtn) {
      toggleMaleBtn.classList.add("active");
    }
    if (group === "female" && toggleFemaleBtn) {
      toggleFemaleBtn.classList.add("active");
    }

    if (!fixturesGenerated || !bracketDataByGroup[group]) {
      showNoFixturesMessage();
      return;
    }

    if (noneSelectedEl) {
      noneSelectedEl.style.display = "none";
    }

    hideAllGroups();

    if (group === "male" && maleGroupEl) {
      maleGroupEl.style.display = "block";
    } else if (group === "female" && femaleGroupEl) {
      femaleGroupEl.style.display = "block";
    }

    renderBracketForGroup(group);
  }

  if (toggleMaleBtn) {
    toggleMaleBtn.addEventListener("click", () => {
      showGroup("male");
    });
  }

  if (toggleFemaleBtn) {
    toggleFemaleBtn.addEventListener("click", () => {
      showGroup("female");
    });
  }

  if (generateBtn) {
    generateBtn.addEventListener("click", () => {
      const ok = window.confirm(
        "Generate fixtures for this tournament?\n\nThis will reset existing draws and results and create a fresh random draw (BYEs recalculated)."
      );
      if (!ok) return;

      // Build fresh brackets
      generateAllBrackets();

      // Decide which group to show immediately
      let groupToShow = null;

      // 1) If a view was already active, keep that
      if (toggleMaleBtn && toggleMaleBtn.classList.contains("active")) {
        groupToShow = "male";
      } else if (
        toggleFemaleBtn &&
        toggleFemaleBtn.classList.contains("active")
      ) {
        groupToShow = "female";
      } else {
        // 2) Otherwise default to first group that has a valid bracket
        const maleBracket = bracketDataByGroup.male;
        const femaleBracket = bracketDataByGroup.female;
        if (maleBracket && maleBracket.N >= 2) {
          groupToShow = "male";
        } else if (femaleBracket && femaleBracket.N >= 2) {
          groupToShow = "female";
        }
      }

      if (groupToShow) {
        showGroup(groupToShow);
      } else {
        clearToggleActive();
        showNoFixturesMessage();
      }
    });
  }

  const getTid = () => tournamentIdForStorage;
  attachBracketEvents("male", maleBracketEl, getTid);
  attachBracketEvents("female", femaleBracketEl, getTid);
});
