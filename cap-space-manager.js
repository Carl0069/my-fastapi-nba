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
const RULE_LABELS = {
  all: "Any player",
  scorers: "18+ PPG",
  playmakers: "5+ APG",
  rebounders: "8+ RPG",
  guards: "Guards only",
  forwards: "Forwards only",
  bigs: "Frontcourt only",
  defenders: "2+ STL + BLK"
};
const OFFICIAL_CHALLENGES = [
  { id: "best-team", title: "2026–27 Best Team", description: "Draft the best all-around five you can build with the full league pool.", rule_type: "all", difficulty: "Easy", icon: "🏆" },
  { id: "bucket-getters", title: "Five-Star Offense", description: "Every pick is a bucket getter averaging at least 18 points per game.", rule_type: "scorers", difficulty: "Medium", icon: "🔥" },
  { id: "floor-generals", title: "Floor General Five", description: "Build around players averaging at least five assists per game.", rule_type: "playmakers", difficulty: "Medium", icon: "🎯" },
  { id: "paint-control", title: "Own the Paint", description: "Only centers and forwards qualify. Stack size without overspending.", rule_type: "bigs", difficulty: "Hard", icon: "🧱" },
  { id: "defense-first", title: "No Easy Buckets", description: "Every player averages two or more steals plus blocks combined.", rule_type: "defenders", difficulty: "Hard", icon: "🛡️" }
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
  pointsTotal: document.getElementById("pointsTotal"),
  reboundsTotal: document.getElementById("reboundsTotal"),
  assistsTotal: document.getElementById("assistsTotal"),
  activeChallengeOverline: document.getElementById("activeChallengeOverline"),
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
  communityAvailable: false,
  communityError: "",
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
      const id = `${team.id}:${player.name.toLocaleLowerCase()}`;
      if (playersById.has(id)) return;
      const pts = statValue(player.pts);
      const reb = statValue(player.reb);
      const ast = statValue(player.ast);
      const stl = statValue(player.stl);
      const blk = statValue(player.blk);
      const hasSeasonStats = Number(player.gp) > 0;
      playersById.set(id, {
        id,
        name: player.name,
        team: team.name,
        logo: team.logo,
        headshotId: window.NBA_PLAYER_IDS?.[normalizePlayerName(player.name)] || null,
        positionLabel: player.pos || "—",
        gp: player.gp,
        positions,
        pts,
        reb,
        ast,
        stl,
        blk,
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
    default:
      return false;
  }
}

function makeRandomBoard(challenge) {
  const ranked = state.players
    .filter((player) => matchesRule(player, challenge.rule_type))
    .sort((left, right) => right.impact - left.impact || left.name.localeCompare(right.name));
  const tiers = Object.fromEntries([1, 2, 3, 4, 5].map((tier) => [tier, []]));
  ranked.forEach((player, index) => {
    const tier = getTierForRank(index, ranked.length);
    tiers[tier].push({ ...player, tier });
  });
  return [1, 2, 3, 4, 5].map((tier) => ({
    tier,
    players: shuffled(tiers[tier]).slice(0, SAMPLE_PER_TIER)
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
      <div class="challenge-card__footer">
        <span class="challenge-card__rule">${escapeHtml(ruleLabel || "Custom rule")}</span>
        <button type="button" class="start-challenge" data-start-challenge="${escapeHtml(challenge.id)}" data-is-official="${isOfficial}">Start challenge <span aria-hidden="true">→</span></button>
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
  if (!state.communityAvailable) {
    elements.communityChallenges.innerHTML = "";
    elements.communityStatus.textContent = `Community challenges unavailable · ${state.communityError}`;
    elements.openCreateChallenge.disabled = true;
    return;
  }
  elements.openCreateChallenge.disabled = false;
  elements.communityStatus.textContent = state.communityChallenges.length
    ? `${state.communityChallenges.length} public ${state.communityChallenges.length === 1 ? "challenge" : "challenges"} · shared across devices`
    : "No community challenges yet. Be the first to create one.";
  elements.communityChallenges.innerHTML = state.communityChallenges.length
    ? state.communityChallenges.map((challenge) => renderChallengeCard(challenge, false)).join("")
    : '<p class="community-empty">Your challenge could be the first one on the board.</p>';
  attachChallengeStartHandlers(elements.communityChallenges, false);
}

function startChallenge(challenge) {
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
        <span class="player-face__fallback" ${player.headshotId ? "hidden" : ""} aria-hidden="${player.headshotId ? "true" : "false"}">${escapeHtml(getInitials(player.name))}</span>
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

function getGrade(points, rebounds, assists) {
  const score = Math.min(points / 100, 1) * 45
    + Math.min(rebounds / 45, 1) * 30
    + Math.min(assists / 30, 1) * 25;
  const bands = [
    [97, "A+"], [93, "A"], [90, "A-"],
    [87, "B+"], [83, "B"], [80, "B-"],
    [77, "C+"], [73, "C"], [70, "C-"],
    [60, "D"], [0, "F"]
  ];
  return { score, grade: bands.find(([minimum]) => score >= minimum)[1] };
}

function renderGrade() {
  const complete = state.picks.length === TEAM_SIZE;
  elements.gradePanel.hidden = !complete;
  if (!complete) return;
  const points = state.picks.reduce((sum, player) => sum + player.pts, 0);
  const rebounds = state.picks.reduce((sum, player) => sum + player.reb, 0);
  const assists = state.picks.reduce((sum, player) => sum + player.ast, 0);
  const { score, grade } = getGrade(points, rebounds, assists);
  elements.gradeMark.textContent = grade;
  elements.gradeTitle.textContent = score >= 90 ? "Five-star draft" : score >= 80 ? "A strong five" : score >= 70 ? "A solid squad" : "The budget picks are in";
  elements.gradeDescription.textContent = `Team score ${Math.round(score)}/100 · ${formatBudget(getBudgetSpent())} of your $15 budget used.`;
  elements.pointsTotal.textContent = points.toFixed(1);
  elements.reboundsTotal.textContent = rebounds.toFixed(1);
  elements.assistsTotal.textContent = assists.toFixed(1);
}

function render() {
  renderBudget();
  renderTierBoard();
  renderLineup();
  renderGrade();
  elements.activeChallengeOverline.textContent = state.activeChallenge.title.toLocaleUpperCase();
  elements.activeChallengeDescription.textContent = state.activeChallenge.description;
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
    const rosterPlayers = payload.teams.flatMap((team) => getTeamRoster(team));
    if (rosterPlayers.some((player) => player.stats_season !== "2025-26")) {
      throw new Error("The API is not serving 2025-26 regular-season stats yet. Deploy the updated API and reload this page.");
    }
    state.players = createPlayerPool(payload.teams);
    if (state.players.length < 25) {
      throw new Error(`Only ${state.players.length} usable players were returned; need enough for the five price tiers.`);
    }
    state.board = makeRandomBoard(state.activeChallenge);
    render();
    elements.apiStatus.textContent = `NBA PLAYER POOL · ${state.players.length} PLAYERS`;
  } catch (error) {
    showLoadError(error);
  }
}

async function loadCommunityChallenges() {
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
    state.communityChallenges = payload.challenges;
    state.communityLoading = false;
    state.communityAvailable = true;
    state.communityError = "";
    renderCommunityChallenges();
  } catch (error) {
    state.communityLoading = false;
    state.communityAvailable = false;
    const message = error instanceof Error ? error.message : "Unknown community challenge API error.";
    state.communityError = message === "Not Found"
      ? "API route is not deployed yet. Deploy the API and configure Supabase (see SUPABASE.md)."
      : message;
    renderCommunityChallenges();
  }
}

async function createCommunityChallenge(event) {
  event.preventDefault();
  if (!state.communityAvailable) {
    showToast("Community challenge storage is not configured on the API yet.");
    return;
  }

  const formData = new FormData(elements.createChallengeForm);
  const challengeData = Object.fromEntries(formData.entries());
  elements.submitChallenge.disabled = true;
  elements.submitChallenge.textContent = "Publishing…";
  try {
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
    renderCommunityChallenges();
    startChallenge(payload);
    showToast("Challenge published for the community.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown save error.";
    showToast(`Could not publish the challenge: ${message}`);
  } finally {
    elements.submitChallenge.disabled = false;
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
  if (state.communityAvailable) elements.createChallengeDialog.showModal();
});
elements.closeCreateChallenge.addEventListener("click", () => elements.createChallengeDialog.close());
elements.cancelCreateChallenge.addEventListener("click", () => elements.createChallengeDialog.close());
elements.createChallengeForm.addEventListener("submit", createCommunityChallenge);

renderOfficialChallenges();
renderCommunityChallenges();
Promise.all([loadPlayers(), loadCommunityChallenges()]);
