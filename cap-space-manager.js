const API_URL = "https://my-fastapi-nba.vercel.app";
const API_KEY = "lebron2369";
const BUDGET = 15;
const TEAM_SIZE = 5;
const SAMPLE_PER_TIER = 5;
const TIER_NAMES = {
  1: "Sleeper",
  2: "Role player",
  3: "Starter",
  4: "All-star",
  5: "Superstar"
};
const LOCAL_CHALLENGES_KEY = "cap-space-manager.community-challenges.v1";
const RULE_LABELS = {
  all: "Any player",
  scorers: "18+ PPG",
  playmakers: "5+ APG",
  rebounders: "8+ RPG",
  guards: "Guards only",
  forwards: "Forwards only",
  bigs: "Frontcourt only",
  defenders: "2+ STL + BLK",
  triple_threat: "15 / 5 / 5 club",
  sharpshooters: "37.5%+ from three",
  ironmen: "60+ games played",
  stocks: "2.5+ steals + blocks",
  low_turnovers: "1.5 or fewer turnovers",
  balanced: "12 / 4 / 3 club"
};
const RULE_INSTRUCTIONS = {
  all: "Any player in the selected pool qualifies. Draft 5 players and keep your total at $15 or less.",
  scorers: "Each of your 5 players must average at least 18.0 points per game.",
  playmakers: "Each of your 5 players must average at least 5.0 assists per game.",
  rebounders: "Each of your 5 players must average at least 8.0 rebounds per game.",
  guards: "All 5 players must be eligible at point guard (PG) or shooting guard (SG).",
  forwards: "All 5 players must be eligible at small forward (SF) or power forward (PF).",
  bigs: "All 5 players must be eligible at SF, PF, or center (C).",
  defenders: "Each of your 5 players must average at least 2.0 steals plus blocks combined.",
  triple_threat: "Every player must average at least 15.0 points, 5.0 rebounds, and 5.0 assists.",
  sharpshooters: "Every player must have played this season and shot at least 37.5% from three.",
  ironmen: "Every player must have appeared in at least 60 regular-season games.",
  stocks: "Every player must average at least 2.5 steals plus blocks combined.",
  low_turnovers: "Every player must have played this season and average no more than 1.5 turnovers.",
  balanced: "Every player must have played this season and average at least 12.0 points, 4.0 rebounds, and 3.0 assists."
};
const VERIFIED_HEADSHOT_OVERRIDES = {
  herbjones: "1630529",
  jimmybutler: "202710",
  khalifadiop: "1631215",
  teranceshannonjr: "1630545"
};
const OFFICIAL_CHALLENGES = [
  { id: "best-team", title: "2026–27 Best Team", description: "Draft the best all-around five you can build with the full league pool.", rule_type: "all", difficulty: "Easy", icon: "🏆" },
  { id: "bucket-getters", title: "Five-Star Offense", description: "Every pick is a bucket getter averaging at least 18 points per game.", rule_type: "scorers", difficulty: "Medium", icon: "🔥" },
  { id: "floor-generals", title: "Floor General Five", description: "Build around players averaging at least five assists per game.", rule_type: "playmakers", difficulty: "Medium", icon: "🎯" },
  { id: "paint-control", title: "Own the Paint", description: "Only centers and forwards qualify. Stack size without overspending.", rule_type: "bigs", difficulty: "Hard", icon: "🧱" },
  { id: "defense-first", title: "No Easy Buckets", description: "Every player averages two or more steals plus blocks combined.", rule_type: "defenders", difficulty: "Hard", icon: "🛡️" },
  { id: "triple-threat-club", title: "Triple-Threat Club", description: "No one-stat wonders: every pick scores, rebounds, and creates.", rule_type: "triple_threat", difficulty: "Hard", icon: "🎩" },
  { id: "splash-squad", title: "Splash Squad", description: "Build a five-man deep-range crew. Every player is a proven 3-point shooter.", rule_type: "sharpshooters", difficulty: "Medium", icon: "💦" },
  { id: "iron-five", title: "Iron Five", description: "Durability is the superpower. Draft players who showed up all season.", rule_type: "ironmen", difficulty: "Medium", icon: "🦾" },
  { id: "stock-exchange", title: "Stock Exchange", description: "Collect defensive stocks: every player disrupts at least 2.5 shots a game.", rule_type: "stocks", difficulty: "Hard", icon: "📈" },
  { id: "clean-game", title: "Clean Game", description: "Take care of the ball. Every pick averages 1.5 turnovers or fewer.", rule_type: "low_turnovers", difficulty: "Medium", icon: "🧼" },
  { id: "do-it-all", title: "Swiss Army Five", description: "Draft complete players who contribute in every major box-score category.", rule_type: "balanced", difficulty: "Medium", icon: "🔧" }
];

const elements = {
  apiStatus: document.getElementById("apiStatus"),
  remainingAmount: document.getElementById("remainingAmount"),
  spentAmount: document.getElementById("spentAmount"),
  budgetProgress: document.getElementById("budgetProgress"),
  budgetFill: document.getElementById("budgetFill"),
  budgetBox: document.querySelector(".scoreboard__budget"),
  lineupCount: document.getElementById("lineupCount"),
  officialChallenges: document.getElementById("officialChallenges"),
  communityChallenges: document.getElementById("communityChallenges"),
  communityStatus: document.getElementById("communityStatus"),
  openCreateChallenge: document.getElementById("openCreateChallenge"),
  createChallengeDialog: document.getElementById("createChallengeDialog"),
  createChallengeForm: document.getElementById("createChallengeForm"),
  challengePlayerSearch: document.getElementById("challengePlayerSearch"),
  challengePlayerOptions: document.getElementById("challengePlayerOptions"),
  challengePlayerCount: document.getElementById("challengePlayerCount"),
  challengePlayerFeedback: document.getElementById("challengePlayerFeedback"),
  submitChallenge: document.getElementById("submitChallenge"),
  closeCreateChallenge: document.getElementById("closeCreateChallenge"),
  cancelCreateChallenge: document.getElementById("cancelCreateChallenge"),
  tierBoard: document.getElementById("tierBoard"),
  lineupBoard: document.getElementById("lineupBoard"),
  newBoard: document.getElementById("newBoard"),
  footerNewBoard: document.getElementById("footerNewBoard"),
  clearLineup: document.getElementById("clearLineup"),
  gradePanel: document.getElementById("gradePanel"),
  gradeMark: document.getElementById("gradeMark"),
  gradeTitle: document.getElementById("gradeTitle"),
  gradeDescription: document.getElementById("gradeDescription"),
  gradeBreakdown: document.getElementById("gradeBreakdown"),
  pointsTotal: document.getElementById("pointsTotal"),
  reboundsTotal: document.getElementById("reboundsTotal"),
  assistsTotal: document.getElementById("assistsTotal"),
  activeChallengeOverline: document.getElementById("activeChallengeOverline"),
  activeChallengeRule: document.getElementById("activeChallengeRule"),
  activeChallengeDescription: document.getElementById("activeChallengeDescription"),
  toast: document.getElementById("toast")
};

const state = {
  players: [],
  board: [],
  picks: [],
  communityChallenges: [],
  activeChallenge: OFFICIAL_CHALLENGES[0],
  communityLoading: true,
  communityMode: "loading",
  communityError: "",
  localStorageError: "",
  localChallengeCount: 0,
  challengeSelectedPlayerIds: new Set(),
  challengeSubmitting: false,
  challengeSelectionValid: false,
  toastTimer: null
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function statValue(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function getPositions(position) {
  const normalized = String(position || "").toUpperCase();
  const tokens = normalized.split(/[\s,/&-]+/).filter(Boolean);
  const eligible = new Set();
  const has = (...values) => values.some((value) => tokens.includes(value));
  if (has("PG", "POINT")) eligible.add("PG");
  if (has("SG", "SHOOTING")) eligible.add("SG");
  if (has("G", "GUARD")) {
    eligible.add("PG");
    eligible.add("SG");
  }
  if (has("SF", "SMALL")) eligible.add("SF");
  if (has("PF", "POWER")) eligible.add("PF");
  if (has("F", "FORWARD")) {
    eligible.add("SF");
    eligible.add("PF");
  }
  if (has("C", "CENTER", "CENTRE")) eligible.add("C");
  return [...eligible];
}

function getTeamRoster(team) {
  return [
    ...(Array.isArray(team.starters_2026_27) ? team.starters_2026_27 : []),
    ...(Array.isArray(team.bench_2026_27) ? team.bench_2026_27 : [])
  ];
}

function normalizePlayerName(name) {
  return String(name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
}

function createPlayerPool(teams) {
  const playersById = new Map();
  teams.forEach((team) => {
    getTeamRoster(team).forEach((player) => {
      if (!player.name) return;
      const positions = getPositions(player.pos);
      if (!positions.length) return;
      const id = `${team.id}:${player.name.toLowerCase()}`;
      if (playersById.has(id)) return;
      const pts = statValue(player.pts);
      const reb = statValue(player.reb);
      const ast = statValue(player.ast);
      const stl = statValue(player.stl);
      const blk = statValue(player.blk);
      const tov = statValue(player.tov);
      const fg3 = statValue(player.fg3);
      const hasSeasonStats = Number(player.gp) > 0;
      playersById.set(id, {
        id,
        name: player.name,
        team: team.name,
        logo: team.logo,
        headshotId: VERIFIED_HEADSHOT_OVERRIDES[normalizePlayerName(player.name)]
          || window.NBA_PLAYER_IDS?.[normalizePlayerName(player.name)]
          || null,
        positionLabel: player.pos || "—",
        statsSeason: player.stats_season || "Unavailable",
        gp: player.gp,
        positions,
        pts,
        reb,
        ast,
        stl,
        blk,
        tov,
        fg3,
        hasSeasonStats,
        impact: pts * 1.3 + reb * 1.15 + ast * 1.5 + stl * 2 + blk * 2.3
      });
    });
  });
  return [...playersById.values()];
}

function shuffled(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function getTierForRank(rank, playerCount) {
  const percentile = rank / playerCount;
  if (percentile < 0.08) return 5;
  if (percentile < 0.2) return 4;
  if (percentile < 0.4) return 3;
  if (percentile < 0.66) return 2;
  return 1;
}

function matchesRule(player, ruleType) {
  switch (ruleType) {
    case "all":
      return true;
    case "scorers":
      return player.pts >= 18;
    case "playmakers":
      return player.ast >= 5;
    case "rebounders":
      return player.reb >= 8;
    case "guards":
      return player.positions.some((position) => ["PG", "SG"].includes(position));
    case "forwards":
      return player.positions.some((position) => ["SF", "PF"].includes(position));
    case "bigs":
      return player.positions.some((position) => ["SF", "PF", "C"].includes(position));
    case "defenders":
      return player.stl + player.blk >= 2;
    case "triple_threat":
      return player.hasSeasonStats && player.pts >= 15 && player.reb >= 5 && player.ast >= 5;
    case "sharpshooters":
      return player.hasSeasonStats && player.fg3 >= 37.5;
    case "ironmen":
      return player.hasSeasonStats && Number(player.gp) >= 60;
    case "stocks":
      return player.hasSeasonStats && player.stl + player.blk >= 2.5;
    case "low_turnovers":
      return player.hasSeasonStats && player.tov <= 1.5;
    case "balanced":
      return player.hasSeasonStats && player.pts >= 12 && player.reb >= 4 && player.ast >= 3;
    default:
      return false;
  }
}

function getTieredChallengePlayers(challenge) {
  const ranked = state.players
    .filter((player) => matchesRule(player, challenge.rule_type))
    .sort((left, right) => right.impact - left.impact || left.name.localeCompare(right.name));
  const tiers = Object.fromEntries([1, 2, 3, 4, 5].map((tier) => [tier, []]));
  ranked.forEach((player, index) => {
    const tier = getTierForRank(index, ranked.length);
    tiers[tier].push({ ...player, tier });
  });
  return tiers;
}

function makeRandomBoard(challenge) {
  if (challenge.creator && !challenge.selected_player_ids?.length) {
    return [1, 2, 3, 4, 5].map((tier) => ({ tier, players: [] }));
  }
  const tiers = getTieredChallengePlayers(challenge);
  const selectedPlayerIds = Array.isArray(challenge.selected_player_ids)
    ? new Set(challenge.selected_player_ids)
    : null;
  return [1, 2, 3, 4, 5].map((tier) => ({
    tier,
    players: selectedPlayerIds?.size
      ? tiers[tier].filter((player) => selectedPlayerIds.has(player.id))
      : shuffled(tiers[tier]).slice(0, SAMPLE_PER_TIER)
  }));
}

function getPickedPlayerIds() {
  return new Set(state.picks.map((player) => player.id));
}

function getBudgetSpent() {
  return state.picks.reduce((sum, player) => sum + player.tier, 0);
}

function formatBudget(amount) {
  return `$${amount}`;
}

function renderChallengeCard(challenge, isOfficial) {
  const ruleLabel = RULE_LABELS[challenge.rule_type];
  const ruleInstruction = RULE_INSTRUCTIONS[challenge.rule_type] || "Follow the challenge creator’s player-pool rule.";
  const selectedPlayers = Array.isArray(challenge.selected_player_ids)
    ? challenge.selected_player_ids.map((id) => state.players.find((player) => player.id === id)).filter(Boolean)
    : [];
  const poolSummary = challenge.selected_player_ids?.length
    ? `${challenge.selected_player_ids.length} selected players${selectedPlayers.length ? ` · ${selectedPlayers.slice(0, 4).map((player) => escapeHtml(player.name)).join(", ")}${selectedPlayers.length > 4 ? ` +${selectedPlayers.length - 4} more` : ""}` : ""}`
    : "No fixed player list. Create a new challenge to choose its players.";
  const missingFixedPool = !isOfficial && !challenge.selected_player_ids?.length;
  const icon = isOfficial ? challenge.icon : "✳";
  const difficulty = challenge.difficulty || "Community";
  return `
    <article class="challenge-card ${isOfficial ? "challenge-card--official" : "challenge-card--community"}">
      <div class="challenge-card__top">
        <span class="challenge-card__icon" aria-hidden="true">${icon}</span>
        <span class="challenge-card__tag">${isOfficial ? "OFFICIAL" : "COMMUNITY"}</span>
        <span class="challenge-card__difficulty challenge-card__difficulty--${difficulty.toLowerCase()}">${escapeHtml(difficulty)}</span>
      </div>
      <h3>${escapeHtml(challenge.title)}</h3>
      ${isOfficial ? "" : `<p class="challenge-card__creator">Created by <strong>${escapeHtml(challenge.creator)}</strong></p>`}
      <p class="challenge-card__description">${escapeHtml(challenge.description || "Create your own rules and see what kind of five you can draft.")}</p>
      <p class="challenge-card__rule-description"><strong>RULE:</strong> ${escapeHtml(ruleInstruction)}</p>
      ${isOfficial ? "" : `<p class="challenge-card__player-pool"><strong>PLAYER POOL:</strong> ${poolSummary}</p>`}
      <div class="challenge-card__footer">
        <span class="challenge-card__rule">${escapeHtml(ruleLabel || "Custom rule")}</span>
        <button type="button" class="start-challenge" data-start-challenge="${escapeHtml(challenge.id)}" data-is-official="${isOfficial}" ${missingFixedPool ? "disabled title=\"This older challenge has no saved player selection. Create a new challenge with a fixed player pool.\"" : ""}>${missingFixedPool ? "Pool not set" : "Start challenge"} <span aria-hidden="true">→</span></button>
      </div>
    </article>
  `;
}

function attachChallengeStartHandlers(container, isOfficial) {
  container.querySelectorAll("[data-start-challenge]").forEach((button) => {
    button.addEventListener("click", () => {
      const challengeList = isOfficial ? OFFICIAL_CHALLENGES : state.communityChallenges;
      const challenge = challengeList.find((item) => String(item.id) === button.dataset.startChallenge);
      if (challenge) startChallenge(challenge);
    });
  });
}

function getChallengeSelectionStatus(ruleType, selectedIds) {
  if (!state.players.length) {
    return { valid: false, message: "Waiting for the NBA player pool to load." };
  }
  if (selectedIds.size < TEAM_SIZE) {
    return { valid: false, message: `Select at least ${TEAM_SIZE} players. ${selectedIds.size} selected.` };
  }

  const tiers = getTieredChallengePlayers({ rule_type: ruleType });
  const eligiblePlayers = Object.values(tiers).flat();
  const chosenPlayers = eligiblePlayers.filter((player) => selectedIds.has(player.id));
  if (chosenPlayers.length !== selectedIds.size) {
    return { valid: false, message: "One or more selected players do not match this category. Review your selection." };
  }
  if (chosenPlayers.length < TEAM_SIZE) {
    return { valid: false, message: `This category has fewer than ${TEAM_SIZE} selected eligible players.` };
  }

  const minimumCost = chosenPlayers
    .map((player) => player.tier)
    .sort((left, right) => left - right)
    .slice(0, TEAM_SIZE)
    .reduce((sum, tier) => sum + tier, 0);
  if (minimumCost > BUDGET) {
    return { valid: false, message: `Your selected players cannot form a five under $${BUDGET}; the cheapest five cost $${minimumCost}.` };
  }
  return { valid: true, message: `Pool ready: ${chosenPlayers.length} players. At least one five fits under the $${BUDGET} budget.` };
}

function updateChallengePlayerPicker() {
  if (!elements.challengePlayerOptions) return;
  const scrollPosition = elements.challengePlayerOptions.scrollTop;
  const ruleType = elements.createChallengeForm.elements.rule_type.value;
  const searchTerm = elements.challengePlayerSearch.value.trim().toLocaleLowerCase();
  const selectedIds = state.challengeSelectedPlayerIds;
  const candidates = state.players
    .filter((player) => matchesRule(player, ruleType))
    .filter((player) => !searchTerm
      || player.name.toLocaleLowerCase().includes(searchTerm)
      || player.team.toLocaleLowerCase().includes(searchTerm))
    .sort((left, right) => left.name.localeCompare(right.name) || left.team.localeCompare(right.team));

  elements.challengePlayerOptions.innerHTML = candidates.length
    ? candidates.map((player) => {
      const selected = selectedIds.has(player.id);
      return `<button type="button" class="challenge-player-option ${selected ? "is-selected" : ""}" data-challenge-player="${escapeHtml(player.id)}" aria-pressed="${selected}">
        <span class="challenge-player-option__check" aria-hidden="true">${selected ? "✓" : "+"}</span>
        <span class="challenge-player-option__identity"><strong>${escapeHtml(player.name)}</strong><small>${escapeHtml(player.team)} · ${escapeHtml(player.positionLabel)}</small></span>
        <span class="challenge-player-option__stats">${player.hasSeasonStats ? `${player.pts.toFixed(1)} PTS · ${escapeHtml(player.statsSeason)}` : "No stats available"}</span>
      </button>`;
    }).join("")
    : `<p class="challenge-player-picker__empty">${state.players.length ? "No players match this category or search." : "The player pool is still loading."}</p>`;
  elements.challengePlayerOptions.scrollTop = scrollPosition;

  elements.challengePlayerCount.textContent = `${selectedIds.size} selected`;
  const status = getChallengeSelectionStatus(ruleType, selectedIds);
  state.challengeSelectionValid = status.valid;
  elements.challengePlayerFeedback.textContent = status.message;
  elements.challengePlayerFeedback.classList.toggle("is-valid", status.valid);
  elements.challengePlayerFeedback.classList.toggle("is-invalid", !status.valid);
  elements.submitChallenge.disabled = state.challengeSubmitting || !status.valid;

  elements.challengePlayerOptions.querySelectorAll("[data-challenge-player]").forEach((button) => {
    button.addEventListener("click", () => {
      const playerId = button.dataset.challengePlayer;
      if (selectedIds.has(playerId)) selectedIds.delete(playerId);
      else selectedIds.add(playerId);
      updateChallengePlayerPicker();
    });
  });
}

function renderOfficialChallenges() {
  elements.officialChallenges.innerHTML = OFFICIAL_CHALLENGES.map((challenge) => renderChallengeCard(challenge, true)).join("");
  attachChallengeStartHandlers(elements.officialChallenges, true);
}

function renderCommunityChallenges() {
  if (state.communityLoading) {
    elements.communityChallenges.innerHTML = "";
    elements.communityStatus.textContent = "Loading shared challenges…";
    elements.openCreateChallenge.disabled = true;
    return;
  }
  elements.openCreateChallenge.disabled = false;
  const localOnly = state.communityMode === "local";
  const sharedChallengeCount = state.communityChallenges.length - state.localChallengeCount;
  const sharedStatus = sharedChallengeCount
    ? `${sharedChallengeCount} shared ${sharedChallengeCount === 1 ? "challenge" : "challenges"} · shared across devices`
    : "No shared challenges yet. Be the first to create one.";
  elements.communityStatus.textContent = localOnly
    ? `Shared challenges are unavailable${state.communityError ? ` · ${state.communityError.trim().replace(/[.!]+$/, "")}` : ""}. You can still create and play challenges saved in this browser only.${state.localStorageError ? ` Browser storage issue: ${state.localStorageError}. Unsaved challenges will not persist.` : ""}`
    : `${sharedStatus}${state.localChallengeCount ? ` · ${state.localChallengeCount} saved only here` : ""}`;
  elements.communityChallenges.innerHTML = state.communityChallenges.length
    ? state.communityChallenges.map((challenge) => renderChallengeCard(challenge, false)).join("")
    : '<p class="community-empty">Your challenge could be the first one on the board.</p>';
  attachChallengeStartHandlers(elements.communityChallenges, false);
}

function startChallenge(challenge) {
  if (challenge.creator && !challenge.selected_player_ids?.length) {
    showToast("This older community challenge has no saved player selection. Create a new challenge and choose its player pool.");
    return;
  }
  state.activeChallenge = challenge;
  state.picks = [];
  state.board = makeRandomBoard(challenge);
  render();
  document.getElementById("marketTitle").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderBudget() {
  const spent = getBudgetSpent();
  const remaining = BUDGET - spent;
  const percentage = (spent / BUDGET) * 100;
  elements.remainingAmount.textContent = formatBudget(remaining);
  elements.spentAmount.textContent = `${formatBudget(spent)} SPENT`;
  elements.lineupCount.textContent = `${state.picks.length} / ${TEAM_SIZE} PICKS`;
  elements.budgetFill.style.width = `${percentage}%`;
  elements.budgetProgress.setAttribute("aria-valuenow", String(spent));
  elements.budgetBox.classList.toggle("is-low", remaining <= 3);
  elements.clearLineup.disabled = state.picks.length === 0;
}

function getInitials(name) {
  return String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function formatPlayerStat(value, hasSeasonStats) {
  return hasSeasonStats ? value.toFixed(1) : "—";
}

function renderTierPlayer(player, pickedIds) {
  const isPicked = pickedIds.has(player.id);
  const fullLineup = state.picks.length >= TEAM_SIZE;
  const exceedsBudget = getBudgetSpent() + player.tier > BUDGET;
  const disabled = isPicked || fullLineup || exceedsBudget;
  const portrait = player.headshotId
    ? `<img class="player-face__portrait" src="https://cdn.nba.com/headshots/nba/latest/1040x760/${player.headshotId}.png" alt="${escapeHtml(player.name)}" loading="lazy" />`
    : "";
  return `
    <article class="market-player ${isPicked ? "is-picked" : ""} ${player.headshotId ? "" : "has-no-portrait"}">
      <div class="player-face__photo">
        ${portrait}
        <span class="player-face__fallback" ${player.headshotId ? "hidden" : ""} aria-hidden="${player.headshotId ? "true" : "false"}"><b>${escapeHtml(getInitials(player.name))}</b><small>PORTRAIT UNAVAILABLE</small></span>
        <span class="player-face__team-mark">
          <img class="player-face__team-logo" src="${escapeHtml(player.logo)}" alt="" loading="lazy" />
          <span ${player.logo ? "hidden" : ""}>${escapeHtml(getInitials(player.team))}</span>
        </span>
        <span class="player-face__position">${escapeHtml(player.positionLabel)}</span>
      </div>
      <div class="player-face__identity">
        <strong class="market-player__name" title="${escapeHtml(player.name)}">${escapeHtml(player.name)}</strong>
        <span class="market-player__team">${escapeHtml(player.team)}</span>
      </div>
      <div class="market-player__stats">
        <span><b>${formatPlayerStat(player.pts, player.hasSeasonStats)}</b> PTS</span>
        <span><b>${formatPlayerStat(player.reb, player.hasSeasonStats)}</b> REB</span>
        <span><b>${formatPlayerStat(player.ast, player.hasSeasonStats)}</b> AST</span>
        <span><b>${player.hasSeasonStats ? player.gp : "—"}</b> GP</span>
      </div>
      <small class="market-player__season">${escapeHtml(player.statsSeason)} regular season</small>
      <button type="button" class="market-add ${isPicked ? "is-picked" : ""}" data-pick-player="${escapeHtml(player.id)}" ${disabled ? "disabled" : ""} aria-label="${isPicked ? "Picked" : exceedsBudget ? "Over budget" : `Draft ${player.name} for ${player.tier} dollars`}">
        ${isPicked ? "✓ Picked" : exceedsBudget ? "Over budget" : fullLineup ? "Five picked" : "+ Pick"}
      </button>
    </article>
  `;
}

function renderTierBoard() {
  const pickedIds = getPickedPlayerIds();
  elements.tierBoard.innerHTML = state.board.map(({ tier, players }) => `
    <section class="tier-column" data-tier="${tier}">
      <header class="tier-heading">
        <div class="tier-price"><strong>$${tier}</strong><span>pick</span></div>
        <span class="tier-name">${TIER_NAMES[tier]}</span>
        <span class="tier-player-count">${players.length} ${players.length === 1 ? "player" : "players"}</span>
      </header>
      <div class="tier-players">
        ${players.length
          ? players.map((player) => renderTierPlayer(player, pickedIds)).join("")
          : '<div class="empty-tier">Not enough eligible players in this price tier. Try another challenge.</div>'}
      </div>
    </section>
  `).join("");

  elements.tierBoard.querySelectorAll("[data-pick-player]").forEach((button) => {
    button.addEventListener("click", () => pickPlayer(button.dataset.pickPlayer));
  });
  elements.tierBoard.querySelectorAll(".player-face__portrait").forEach((image) => {
    image.addEventListener("error", () => {
      image.hidden = true;
      const fallback = image.parentElement.querySelector(".player-face__fallback");
      fallback.hidden = false;
      fallback.setAttribute("aria-hidden", "false");
    }, { once: true });
    if (image.complete && image.naturalWidth === 0) {
      image.hidden = true;
      const fallback = image.parentElement.querySelector(".player-face__fallback");
      fallback.hidden = false;
      fallback.setAttribute("aria-hidden", "false");
    }
  });
  elements.tierBoard.querySelectorAll(".player-face__team-logo").forEach((image) => {
    image.addEventListener("error", () => {
      image.hidden = true;
      image.nextElementSibling.hidden = false;
    }, { once: true });
    if (image.complete && image.naturalWidth === 0) {
      image.hidden = true;
      image.nextElementSibling.hidden = false;
    }
  });
}

function renderLineup() {
  const pickSlots = Array.from({ length: TEAM_SIZE }, (_, index) => {
    const player = state.picks[index];
    return `
      <article class="lineup-pick ${player ? "has-player" : ""}">
        ${player
          ? `<button type="button" class="remove-pick" data-remove-pick="${escapeHtml(player.id)}" aria-label="Remove ${escapeHtml(player.name)}">×</button>
             <span class="lineup-pick__number">0${index + 1}</span>
             <strong class="lineup-pick__name">${escapeHtml(player.name)}</strong>
             <span class="lineup-pick__meta">${escapeHtml(player.team)}</span>
             <span class="lineup-pick__price">$${player.tier}</span>`
          : `<span class="lineup-pick__number">0${index + 1}</span>
             <span class="lineup-pick__meta">Waiting for a pick</span>
             <span class="lineup-pick__price">—</span>`
        }
      </article>
    `;
  }).join("");
  elements.lineupBoard.innerHTML = pickSlots;
  elements.lineupBoard.querySelectorAll("[data-remove-pick]").forEach((button) => {
    button.addEventListener("click", () => {
      state.picks = state.picks.filter((player) => player.id !== button.dataset.removePick);
      render();
    });
  });
}

function getLineupPositionCoverage(players) {
  const roles = ["PG", "SG", "SF", "PF", "C"];
  let bestAssignment = {};

  const assignRole = (roleIndex, usedPlayers, assignment) => {
    if (roleIndex >= roles.length) {
      if (Object.keys(assignment).length > Object.keys(bestAssignment).length) bestAssignment = { ...assignment };
      return;
    }
    assignRole(roleIndex + 1, usedPlayers, assignment);
    players.forEach((player, playerIndex) => {
      if (usedPlayers.has(playerIndex) || !player.positions.includes(roles[roleIndex])) return;
      usedPlayers.add(playerIndex);
      assignment[roles[roleIndex]] = player.name;
      assignRole(roleIndex + 1, usedPlayers, assignment);
      delete assignment[roles[roleIndex]];
      usedPlayers.delete(playerIndex);
    });
  };

  assignRole(0, new Set(), {});
  return { roles, assignment: bestAssignment };
}

function getLineupFit(players, budgetSpent) {
  const totals = players.reduce((sum, player) => ({
    points: sum.points + player.pts,
    rebounds: sum.rebounds + player.reb,
    assists: sum.assists + player.ast,
    stocks: sum.stocks + player.stl + player.blk
  }), { points: 0, rebounds: 0, assists: 0, stocks: 0 });
  const { roles, assignment } = getLineupPositionCoverage(players);
  const coveredRoles = Object.keys(assignment);
  const challengePlayers = players.filter((player) => matchesRule(player, state.activeChallenge.rule_type)).length;
  const categories = [
    { label: "Position coverage", value: coveredRoles.length, target: 5, weight: 30 },
    { label: "Scoring", value: totals.points, target: 100, weight: 15 },
    { label: "Playmaking", value: totals.assists, target: 25, weight: 15 },
    { label: "Rebounding", value: totals.rebounds, target: 40, weight: 15 },
    { label: "Defense · steals + blocks", value: totals.stocks, target: 10, weight: 10 },
    { label: "Challenge fit", value: challengePlayers, target: TEAM_SIZE, weight: 10 },
    { label: "Budget used", value: budgetSpent, target: BUDGET, weight: 5 }
  ].map((category) => ({
    ...category,
    ratio: Math.min(category.value / category.target, 1),
    score: Math.min(category.value / category.target, 1) * category.weight
  }));
  const score = categories.reduce((sum, category) => sum + category.score, 0);
  const uncoveredRoles = roles.filter((role) => !assignment[role]);
  const fitCategories = categories.filter((category) =>
    ["Position coverage", "Scoring", "Playmaking", "Rebounding", "Defense · steals + blocks"].includes(category.label)
  );
  const weakestFit = fitCategories.reduce((weakest, category) =>
    category.ratio < weakest.ratio ? category : weakest
  );
  const grade = [
    [95, "A+"], [90, "A"], [85, "A-"],
    [80, "B+"], [75, "B"], [70, "B-"],
    [65, "C+"], [60, "C"], [55, "C-"],
    [45, "D"], [0, "F"]
  ].find(([minimum]) => score >= minimum)[1];
  return { score, grade, categories, totals, assignment, uncoveredRoles, challengePlayers, weakestFit };
}

function formatFitValue(category) {
  if (category.label === "Position coverage" || category.label === "Challenge fit") {
    return `${Math.round(category.value)}/${category.target}`;
  }
  if (category.label === "Budget used") {
    return `${formatBudget(category.value)}/${formatBudget(category.target)}`;
  }
  return `${category.value.toFixed(1)}/${category.target}`;
}

function renderGrade() {
  const complete = state.picks.length === TEAM_SIZE;
  elements.gradePanel.hidden = !complete;
  if (!complete) return;

  const budgetSpent = getBudgetSpent();
  const fit = getLineupFit(state.picks, budgetSpent);
  const title = fit.uncoveredRoles.length
    ? fit.score >= 85
      ? "Strong stats · position gap"
      : fit.score >= 65
        ? "Adjust the position mix"
        : "Build a more balanced five"
    : fit.challengePlayers < TEAM_SIZE
      ? "Challenge rule needs attention"
      : fit.score >= 90
        ? "Excellent team fit"
        : fit.score >= 80
          ? "Well-balanced lineup"
          : fit.score >= 70
            ? "Good core, room to improve"
            : fit.score >= 55
              ? "Some role gaps to address"
              : "The budget picks are in";
  const roleSummary = fit.uncoveredRoles.length
    ? `Positions covered: ${Object.keys(fit.assignment).join(", ")} · gap: ${fit.uncoveredRoles.join(", ")}.`
    : "All five lineup roles are covered.";
  const weakness = fit.weakestFit.ratio < 0.9
    ? ` Biggest opportunity: improve ${fit.weakestFit.label.toLocaleLowerCase()}.`
    : "";
  elements.gradeMark.textContent = fit.grade;
  elements.gradeTitle.textContent = title;
  elements.gradeDescription.textContent = `${Math.round(fit.score)}/100 team fit · ${roleSummary}${weakness} ${fit.challengePlayers}/${TEAM_SIZE} picks fit this challenge · ${formatBudget(budgetSpent)} of ${formatBudget(BUDGET)} used.`;
  elements.gradeBreakdown.innerHTML = fit.categories.map((category) => `
    <div class="grade-fit__item">
      <div class="grade-fit__label"><span>${escapeHtml(category.label)}</span><strong>${formatFitValue(category)}</strong></div>
      <span class="grade-fit__track" role="meter" aria-label="${escapeHtml(category.label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(category.ratio * 100)}"><span style="width:${Math.round(category.ratio * 100)}%"></span></span>
    </div>
  `).join("");
  elements.pointsTotal.textContent = fit.totals.points.toFixed(1);
  elements.reboundsTotal.textContent = fit.totals.rebounds.toFixed(1);
  elements.assistsTotal.textContent = fit.totals.assists.toFixed(1);
}

function render() {
  renderBudget();
  renderTierBoard();
  renderLineup();
  renderGrade();
  elements.activeChallengeOverline.textContent = state.activeChallenge.title.toLocaleUpperCase();
  elements.activeChallengeRule.textContent = RULE_INSTRUCTIONS[state.activeChallenge.rule_type]
    || "Follow the challenge creator’s player-pool rule.";
  elements.activeChallengeDescription.textContent = state.activeChallenge.description || "Draft five players and stay within the $15 budget.";
}

function pickPlayer(playerId) {
  const player = state.board.flatMap((tier) => tier.players).find((item) => item.id === playerId);
  if (!player) {
    showToast("That player is no longer on this board. Shuffle for a fresh set of players.");
    return;
  }
  if (state.picks.some((pick) => pick.id === player.id)) {
    showToast(`${player.name} is already on your team.`);
    return;
  }
  if (state.picks.length >= TEAM_SIZE) {
    showToast("Your five-player team is full. Remove a pick to make a change.");
    return;
  }
  const remaining = BUDGET - getBudgetSpent();
  if (remaining - player.tier < 0) {
    showToast(`${player.name} costs $${player.tier}, but you only have $${remaining} left.`);
    return;
  }
  state.picks.push(player);
  render();
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  window.clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, 2800);
}

function newRandomBoard() {
  if (!state.players.length) return;
  state.picks = [];
  state.board = makeRandomBoard(state.activeChallenge);
  render();
  document.getElementById("marketTitle").scrollIntoView({ behavior: "smooth", block: "start" });
}

function showLoadError(error) {
  const message = error instanceof Error ? error.message : "Unexpected API error.";
  elements.apiStatus.textContent = `Player API error · ${message}`;
  elements.apiStatus.classList.add("is-error");
  elements.tierBoard.innerHTML = `<div class="loading-message">Could not load the NBA player pool: ${escapeHtml(message)}<br />Refresh the page to try again.</div>`;
}

async function loadPlayers() {
  try {
    const response = await fetch(`${API_URL}/api/v1/teams`, {
      headers: { "X-API-Key": API_KEY }
    });
    if (!response.ok) throw new Error(`Request failed (${response.status} ${response.statusText}).`);
    const payload = await response.json();
    if (!Array.isArray(payload.teams) || payload.teams.length === 0) {
      throw new Error("The API returned no NBA teams.");
    }
    window.applyPlayerSeasonStatsOverrides(payload.teams);
    const rosterPlayers = payload.teams.flatMap((team) => getTeamRoster(team));
    if (rosterPlayers.some((player) =>
      player.stats_season !== "2025-26" && !window.PLAYER_SEASON_STAT_OVERRIDES[normalizePlayerName(player.name)]
    )) {
      throw new Error("The API is not serving current regular-season stats yet. Deploy the updated API and reload this page.");
    }
    state.players = createPlayerPool(payload.teams);
    if (state.players.length < 25) {
      throw new Error(`Only ${state.players.length} usable players were returned; need enough for the five price tiers.`);
    }
    state.board = makeRandomBoard(state.activeChallenge);
    render();
    elements.apiStatus.textContent = `NBA PLAYER POOL · ${state.players.length} PLAYERS`;
    renderCommunityChallenges();
    updateChallengePlayerPicker();
  } catch (error) {
    showLoadError(error);
  }
}

async function loadCommunityChallenges() {
  let localChallenges = [];
  try {
    const savedChallenges = localStorage.getItem(LOCAL_CHALLENGES_KEY);
    if (savedChallenges) {
      const parsedChallenges = JSON.parse(savedChallenges);
      if (!Array.isArray(parsedChallenges)) {
        throw new Error("Saved community challenges are not a list.");
      }
      localChallenges = parsedChallenges;
    }
  } catch (error) {
    state.localStorageError = error instanceof Error ? error.message : "Could not read saved challenges.";
  }

  try {
    const response = await fetch(`${API_URL}/api/v1/community-challenges`, {
      headers: { "X-API-Key": API_KEY }
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.detail || `Request failed (${response.status} ${response.statusText}).`);
    }
    if (!Array.isArray(payload.challenges)) {
      throw new Error("The challenge endpoint returned an unexpected response.");
    }
    state.communityChallenges = [...localChallenges, ...payload.challenges];
    state.localChallengeCount = localChallenges.length;
    state.communityLoading = false;
    state.communityMode = "shared";
    state.communityError = "";
    renderCommunityChallenges();
  } catch (error) {
    state.communityLoading = false;
    state.communityMode = "local";
    state.communityChallenges = localChallenges;
    state.localChallengeCount = localChallenges.length;
    const message = error instanceof Error ? error.message : "Unknown community challenge API error.";
    state.communityError = message === "Not Found"
      ? "API route is not deployed yet"
      : message;
    renderCommunityChallenges();
  }
}

async function createCommunityChallenge(event) {
  event.preventDefault();
  const ruleType = elements.createChallengeForm.elements.rule_type.value;
  const selectionStatus = getChallengeSelectionStatus(ruleType, state.challengeSelectedPlayerIds);
  if (!selectionStatus.valid) {
    showToast(selectionStatus.message);
    updateChallengePlayerPicker();
    return;
  }
  const formData = new FormData(elements.createChallengeForm);
  const challengeData = {
    ...Object.fromEntries(formData.entries()),
    selected_player_ids: [...state.challengeSelectedPlayerIds]
  };
  state.challengeSubmitting = true;
  updateChallengePlayerPicker();
  elements.submitChallenge.textContent = state.communityMode === "local" ? "Saving…" : "Publishing…";
  try {
    if (state.communityMode === "local") {
      const localChallenge = {
        ...challengeData,
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`
      };
      state.communityChallenges = [localChallenge, ...state.communityChallenges];
      state.localChallengeCount = state.communityChallenges.length;
      try {
        localStorage.setItem(LOCAL_CHALLENGES_KEY, JSON.stringify(state.communityChallenges));
        state.localStorageError = "";
      } catch (error) {
        state.localStorageError = error instanceof Error ? error.message : "Could not save challenges in this browser.";
      }
      elements.createChallengeDialog.close();
      elements.createChallengeForm.reset();
      state.challengeSelectedPlayerIds.clear();
      elements.challengePlayerSearch.value = "";
      renderCommunityChallenges();
      updateChallengePlayerPicker();
      startChallenge(localChallenge);
      showToast(state.localStorageError
        ? `Challenge is playable now, but could not be saved: ${state.localStorageError}`
        : "Challenge saved in this browser only. It is not shared with other players.");
      return;
    }

    const response = await fetch(`${API_URL}/api/v1/community-challenges`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY
      },
      body: JSON.stringify(challengeData)
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.detail || `Request failed (${response.status} ${response.statusText}).`);
    }
    state.communityChallenges = [payload, ...state.communityChallenges];
    elements.createChallengeDialog.close();
    elements.createChallengeForm.reset();
    state.challengeSelectedPlayerIds.clear();
    elements.challengePlayerSearch.value = "";
    renderCommunityChallenges();
    updateChallengePlayerPicker();
    startChallenge(payload);
    showToast("Challenge published for the community.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown save error.";
    showToast(`Could not publish the challenge: ${message}`);
  } finally {
    state.challengeSubmitting = false;
    updateChallengePlayerPicker();
    elements.submitChallenge.textContent = "Publish Challenge";
  }
}

elements.newBoard.addEventListener("click", newRandomBoard);
elements.footerNewBoard.addEventListener("click", newRandomBoard);
elements.clearLineup.addEventListener("click", () => {
  state.picks = [];
  render();
});
elements.openCreateChallenge.addEventListener("click", () => {
  if (!state.communityLoading) {
    state.challengeSelectedPlayerIds.clear();
    elements.challengePlayerSearch.value = "";
    elements.createChallengeDialog.showModal();
    updateChallengePlayerPicker();
  }
});
elements.closeCreateChallenge.addEventListener("click", () => elements.createChallengeDialog.close());
elements.cancelCreateChallenge.addEventListener("click", () => elements.createChallengeDialog.close());
elements.createChallengeForm.addEventListener("submit", createCommunityChallenge);
elements.challengePlayerSearch.addEventListener("input", updateChallengePlayerPicker);
elements.createChallengeForm.elements.rule_type.addEventListener("change", () => {
  const eligibleIds = new Set(state.players
    .filter((player) => matchesRule(player, elements.createChallengeForm.elements.rule_type.value))
    .map((player) => player.id));
  let removed = 0;
  for (const playerId of state.challengeSelectedPlayerIds) {
    if (!eligibleIds.has(playerId)) {
      state.challengeSelectedPlayerIds.delete(playerId);
      removed += 1;
    }
  }
  updateChallengePlayerPicker();
  if (removed) showToast(`${removed} selected ${removed === 1 ? "player no longer matches" : "players no longer match"} the chosen category and ${removed === 1 ? "was" : "were"} removed.`);
});

renderOfficialChallenges();
renderCommunityChallenges();
Promise.all([loadPlayers(), loadCommunityChallenges()]);
