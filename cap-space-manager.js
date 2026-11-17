const API_URL = "https://my-fastapi-nba.vercel.app";
const API_KEY = "lebron2369";
const BUDGET = 15;
const TEAM_SIZE = 5;
const SAMPLE_PER_TIER = 5;
const AUTH_SESSION_KEY = "cap-space-manager.supabase-auth-session.v1";
let supabaseAuthConfig;
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
  challengeAuthStatus: document.getElementById("challengeAuthStatus"),
  challengeAuthEmail: document.getElementById("challengeAuthEmail"),
  challengeAuthPassword: document.getElementById("challengeAuthPassword"),
  challengeSignIn: document.getElementById("challengeSignIn"),
  challengeSignUp: document.getElementById("challengeSignUp"),
  challengeSignOut: document.getElementById("challengeSignOut"),
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
  toast: document.getElementById("toast"),
  guestRestrictedBanner: document.getElementById("guestRestrictedBanner"),
  mastheadAuthBtn: document.getElementById("mastheadAuthBtn"),
  bannerSignInBtn: document.getElementById("bannerSignInBtn"),
  challengeCreationFields: document.getElementById("challengeCreationFields")
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
  authSession: null,
  toastTimer: null
};

// --- AUTH & GUEST HELPERS (Global Scope) ---
function isUserLoggedIn() {
  return Boolean(state.authSession?.access_token);
}

function requireAuthOrPrompt(actionDescription = "perform this action") {
  if (!isUserLoggedIn()) {
    showToast(`🔒 Guest Mode: Please sign in to ${actionDescription}.`);
    if (elements.challengeCreationFields) elements.challengeCreationFields.hidden = true;
    elements.createChallengeDialog.showModal();
    return false;
  }
  return true;
}

function setAuthStatus(message, isError = false) {
  elements.challengeAuthStatus.textContent = message;
  elements.challengeAuthStatus.classList.toggle("is-error", isError);
}

function updateAuthControls() {
  const signedIn = isUserLoggedIn();
  if (elements.guestRestrictedBanner) {
    elements.guestRestrictedBanner.hidden = signedIn;
  }
  if (elements.mastheadAuthBtn) {
    elements.mastheadAuthBtn.textContent = signedIn ? "Sign Out" : "Sign In";
  }

  elements.challengeAuthStatus.textContent = signedIn
    ? `Signed in${state.authSession.email ? ` as ${state.authSession.email}` : ""}.`
    : "Sign in or create an account to unlock gameplay and publish challenges.";

  elements.challengeAuthEmail.parentElement.hidden = signedIn;
  elements.challengeAuthPassword.parentElement.hidden = signedIn;
  elements.challengeSignIn.hidden = signedIn;
  elements.challengeSignUp.hidden = signedIn;
  elements.challengeSignOut.hidden = !signedIn;
}

function loadStoredAuthSession() {
  try {
    const saved = sessionStorage.getItem(AUTH_SESSION_KEY);
    if (!saved) return null;
    const session = JSON.parse(saved);
    if (typeof session.access_token !== "string" || typeof session.refresh_token !== "string") {
      throw new Error("Stored sign-in data is incomplete.");
    }
    return session;
  } catch (error) {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    setAuthStatus(error instanceof Error ? error.message : "Could not read the saved sign-in.", true);
    return null;
  }
}

function storeAuthSession(session) {
  const expiresAt = Number(session.expires_at)
    ? Number(session.expires_at) * 1000
    : Date.now() + Number(session.expires_in || 3600) * 1000;
  state.authSession = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: expiresAt,
    email: session.user?.email || ""
  };
  try {
    sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(state.authSession));
  } catch {
    state.authSession = null;
    throw new Error("Could not save your sign-in for this browser session.");
  }
  updateAuthControls();
}

async function getSupabaseAuthConfig() {
  if (supabaseAuthConfig) return supabaseAuthConfig;
  const response = await fetch(`${API_URL}/api/v1/auth/config`);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.detail || `Sign-in configuration unavailable (${response.status}).`);
  }
  if (!payload.supabase_url || !payload.publishable_key) {
    throw new Error("The API returned incomplete Supabase sign-in configuration.");
  }
  supabaseAuthConfig = payload;
  return supabaseAuthConfig;
}

async function supabaseAuthRequest(path, body, accessToken = "") {
  const config = await getSupabaseAuthConfig();
  const headers = {
    "Content-Type": "application/json",
    apikey: config.publishable_key
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const response = await fetch(`${config.supabase_url}/auth/v1/${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(
      payload.msg || payload.message || payload.error_description
      || "Supabase sign-in request failed."
    );
  }
  return payload;
}

async function signInToSupabase(createAccount = false) {
  const email = elements.challengeAuthEmail.value.trim();
  const password = elements.challengeAuthPassword.value;
  if (!email || !elements.challengeAuthEmail.validity.valid || password.length < 8) {
    setAuthStatus("Enter a valid email address and a password of at least 8 characters.", true);
    return;
  }
  elements.challengeSignIn.disabled = true;
  elements.challengeSignUp.disabled = true;
  setAuthStatus(createAccount ? "Creating your account…" : "Signing in…");
  try {
    const path = createAccount ? "signup" : "token?grant_type=password";
    const payload = await supabaseAuthRequest(path, { email, password });
    if (!payload.access_token || !payload.refresh_token) {
      setAuthStatus("Account created. Check your email to confirm it, then sign in.");
      return;
    }
    storeAuthSession(payload);
    elements.challengeAuthPassword.value = "";
    setAuthStatus(`Signed in${payload.user?.email ? ` as ${payload.user.email}` : ""}.`);
    showToast("Successfully signed in!");
    elements.createChallengeDialog.close();
  } catch (error) {
    setAuthStatus(error instanceof Error ? error.message : "Could not sign in.", true);
  } finally {
    elements.challengeSignIn.disabled = false;
    elements.challengeSignUp.disabled = false;
  }
}

async function getValidSupabaseAccessToken() {
  if (!state.authSession) {
    throw new Error("Sign in or create an account before publishing a challenge.");
  }
  if (state.authSession.expires_at > Date.now() + 60_000) {
    return state.authSession.access_token;
  }
  try {
    const refreshed = await supabaseAuthRequest("token?grant_type=refresh_token", {
      refresh_token: state.authSession.refresh_token
    });
    storeAuthSession(refreshed);
    return state.authSession.access_token;
  } catch (error) {
    state.authSession = null;
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    updateAuthControls();
    throw new Error(error instanceof Error
      ? `Your sign-in expired. Please sign in again. ${error.message}`
      : "Your sign-in expired. Please sign in again.");
  }
}

async function signOutFromSupabase() {
  const token = state.authSession?.access_token;
  state.authSession = null;
  sessionStorage.removeItem(AUTH_SESSION_KEY);
  updateAuthControls();
  showToast("Signed out successfully.");
  if (!token) return;
  try {
    await supabaseAuthRequest("logout", {}, token);
  } catch (error) {
    console.error("Remote signout warning:", error);
  }
}

state.authSession = loadStoredAuthSession();
updateAuthControls();

function escapeHtml(value) {
  const map = {
    '&': '&',
    '<': '<',
    '>': '>',
    '"': '"',
  };
  return String(value ?? "").replace(/[&<>"']/g, (char) => map[char]);
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
        headshotId: window.NBA_PLAYER_IDS?.[normalizePlayerName(player.name)] || null,
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
    case "all": return true;
    case "scorers": return player.pts >= 18;
    case "playmakers": return player.ast >= 5;
    case "rebounders": return player.reb >= 8;
    case "guards": return player.positions.some((position) => ["PG", "SG"].includes(position));
    case "forwards": return player.positions.some((position) => ["SF", "PF"].includes(position));
    case "bigs": return player.positions.some((position) => ["SF", "PF", "C"].includes(position));
    case "defenders": return player.stl + player.blk >= 2;
    case "triple_threat": return player.hasSeasonStats && player.pts >= 15 && player.reb >= 5 && player.ast >= 5;
    case "sharpshooters": return player.hasSeasonStats && player.fg3 >= 37.5;
    case "ironmen": return player.hasSeasonStats && Number(player.gp) >= 60;
    case "stocks": return player.hasSeasonStats && player.stl + player.blk >= 2.5;
    case "low_turnovers": return player.hasSeasonStats && player.tov <= 1.5;
    case "balanced": return player.hasSeasonStats && player.pts >= 12 && player.reb >= 4 && player.ast >= 3;
    default: return false;
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
        <button type="button" class="start-challenge" data-start-challenge="${escapeHtml(challenge.id)}" data-is-official="${isOfficial}" ${missingFixedPool ? "disabled title=\"This older challenge has no saved player selection.\"" : ""}>${missingFixedPool ? "Pool not set" : "Start challenge"} <span aria-hidden="true">→</span></button>
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
    return { valid: false, message: "One or more selected players do not match this category." };
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
    return { valid: false, message: `Selected players cannot form a five under $${BUDGET}; cheapest five cost $${minimumCost}.` };
  }
  return { valid: true, message: `Pool ready: ${chosenPlayers.length} players.` };
}

function updateChallengePlayerPicker() {
  if (!elements.challengePlayerOptions) return;
  const scrollPosition = elements.challengePlayerOptions.scrollTop;
  const ruleType = elements.createChallengeForm.elements.rule_type?.value || "all";
  const searchTerm = elements.challengePlayerSearch.value.trim().toLocaleLowerCase();
  const selectedIds = state.challengeSelectedPlayerIds;
  const candidates = state.players
    .filter((player) => matchesRule(player, ruleType))
    .filter((player) => !searchTerm || player.name.toLocaleLowerCase().includes(searchTerm) || player.team.toLocaleLowerCase().includes(searchTerm))
    .sort((left, right) => left.name.localeCompare(right.name));

  elements.challengePlayerOptions.innerHTML = candidates.length
    ? candidates.map((player) => {
      const selected = selectedIds.has(player.id);
      return `<button type="button" class="challenge-player-option ${selected ? "is-selected" : ""}" data-challenge-player="${escapeHtml(player.id)}" aria-pressed="${selected}">
        <span class="challenge-player-option__check" aria-hidden="true">${selected ? "✓" : "+"}</span>
        <span class="challenge-player-option__identity"><strong>${escapeHtml(player.name)}</strong><small>${escapeHtml(player.team)} · ${escapeHtml(player.positionLabel)}</small></span>
        <span class="challenge-player-option__stats">${player.hasSeasonStats ? `${player.pts.toFixed(1)} PTS` : ""}</span>
      </button>`;
    }).join("")
    : `<p class="challenge-player-picker__empty">No players match this category or search.</p>`;
  elements.challengePlayerOptions.scrollTop = scrollPosition;

  elements.challengePlayerCount.textContent = `${selectedIds.size} selected`;
  const status = getChallengeSelectionStatus(ruleType, selectedIds);
  elements.challengePlayerFeedback.textContent = status.message;
  elements.challengePlayerFeedback.classList.toggle("is-valid", status.valid);
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
  elements.communityStatus.textContent = state.communityMode === "local" ? "Shared challenges unavailable. Showing browser-saved challenges." : "Shared challenges loaded across devices.";
  elements.communityChallenges.innerHTML = state.communityChallenges.length
    ? state.communityChallenges.map((challenge) => renderChallengeCard(challenge, false)).join("")
    : '<p class="community-empty">No community challenges yet. Create one!</p>';
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
  const meetsChallenge = matchesRule(player, state.activeChallenge.rule_type);
  const disabled = isPicked || fullLineup || exceedsBudget || !meetsChallenge;
  const buttonLabel = isPicked ? "✓ Picked" : exceedsBudget ? "Over budget" : !meetsChallenge ? "No match" : fullLineup ? "Full" : "+ Pick";

  const portrait = player.headshotId
    ? `<img class="player-face__portrait" src="https://cdn.nba.com/headshots/nba/latest/1040x760/${player.headshotId}.png" alt="${escapeHtml(player.name)}" loading="lazy" />`
    : "";
  return `
    <article class="market-player ${isPicked ? "is-picked" : ""}">
      <div class="player-face__photo">
        ${portrait}
        <span class="player-face__fallback" ${player.headshotId ? "hidden" : ""}><b>${escapeHtml(getInitials(player.name))}</b></span>
        <span class="player-face__position">${escapeHtml(player.positionLabel)}</span>
      </div>
      <div class="player-face__identity">
        <strong class="market-player__name" title="${escapeHtml(player.name)}">${escapeHtml(player.name)}</strong>
        <span class="market-player__team">${escapeHtml(player.team)}</span>
      </div>
      <div class="market-player__stats">
        <span><b>${formatPlayerStat(player.pts, player.hasSeasonStats)}</b><small>PTS</small></span>
        <span><b>${formatPlayerStat(player.reb, player.hasSeasonStats)}</b><small>REB</small></span>
        <span><b>${formatPlayerStat(player.ast, player.hasSeasonStats)}</b><small>AST</small></span>
      </div>
      <button type="button" class="market-add ${isPicked ? "is-picked" : ""}" data-pick-player="${escapeHtml(player.id)}" ${disabled ? "disabled" : ""}>
        ${buttonLabel}
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
        ${players.length ? players.map((player) => renderTierPlayer(player, pickedIds)).join("") : '<div class="empty-tier">No eligible players in this tier.</div>'}
      </div>
    </section>
  `).join("");

  elements.tierBoard.querySelectorAll("[data-pick-player]").forEach((button) => {
    button.addEventListener("click", () => pickPlayer(button.dataset.pickPlayer));
  });
}

function renderLineup() {
  elements.lineupBoard.innerHTML = Array.from({ length: TEAM_SIZE }, (_, index) => {
    const player = state.picks[index];
    return `
      <article class="lineup-pick ${player ? "has-player" : ""}">
        ${player
        ? `<button type="button" class="remove-pick" data-remove-pick="${escapeHtml(player.id)}">×</button>
             <span class="lineup-pick__number">0${index + 1}</span>
             <strong class="lineup-pick__name">${escapeHtml(player.name)}</strong>
             <span class="lineup-pick__price">$${player.tier}</span>`
        : `<span class="lineup-pick__number">0${index + 1}</span><span class="lineup-pick__meta">Empty</span>`
      }
      </article>
    `;
  }).join("");

  elements.lineupBoard.querySelectorAll("[data-remove-pick]").forEach((button) => {
    button.addEventListener("click", () => {
      state.picks = state.picks.filter((player) => player.id !== button.dataset.removePick);
      render();
    });
  });
}

function getLineupFit(players, budgetSpent) {
  const totals = players.reduce((sum, player) => ({
    points: sum.points + Number(player.pts || 0),
    rebounds: sum.rebounds + Number(player.reb || 0),
    assists: sum.assists + Number(player.ast || 0),
    stocks: sum.stocks + Number(player.stl || 0) + Number(player.blk || 0)
  }), { points: 0, rebounds: 0, assists: 0, stocks: 0 });

  const { roles, assignment } = getLineupPositionCoverage(players);
  const coveredRoles = Object.keys(assignment).length;
  const challengePlayers = players.filter((player) => matchesRule(player, state.activeChallenge.rule_type)).length;

  const categories = [
    { label: "Position coverage", value: coveredRoles, target: 5, weight: 25 },
    { label: "Scoring (PPG)", value: totals.points, target: 60.0, weight: 25 },
    { label: "Playmaking (APG)", value: totals.assists, target: 15.0, weight: 15 },
    { label: "Rebounding (RPG)", value: totals.rebounds, target: 20.0, weight: 15 },
    { label: "Defense (STL+BLK)", value: totals.stocks, target: 4.0, weight: 10 },
    { label: "Challenge fit", value: challengePlayers, target: TEAM_SIZE, weight: 10 }
  ].map((category) => ({
    ...category,
    ratio: Math.min(category.value / category.target, 1),
    score: Math.min(category.value / category.target, 1) * category.weight
  }));

  const score = categories.reduce((sum, category) => sum + category.score, 0);

  const grade = score >= 90 ? "S"
    : score >= 82 ? "A+"
      : score >= 75 ? "A"
        : score >= 68 ? "B+"
          : score >= 60 ? "B"
            : score >= 50 ? "C"
              : score >= 35 ? "D"
                : "F";

  return { score, grade, categories, totals, assignment, challengePlayers };
}

function renderGrade() {
  const complete = state.picks.length === TEAM_SIZE;
  elements.gradePanel.hidden = !complete;
  if (!complete) return;

  const budgetSpent = getBudgetSpent();
  const fit = getLineupFit(state.picks, budgetSpent);

  let title = "Solid Lineup Assembled!";
  if (fit.grade === "S" || fit.grade === "A+") title = "Elite Championship Core!";
  else if (fit.grade === "D" || fit.grade === "F") title = "Statistically Weak Lineup";

  elements.gradeMark.textContent = fit.grade;
  elements.gradeTitle.textContent = title;
  elements.gradeDescription.textContent = `Score: ${Math.round(fit.score)}/100 · Budget used: $${budgetSpent}/$${BUDGET} · ${fit.challengePlayers}/${TEAM_SIZE} players fit the challenge rule.`;

  if (elements.gradeBreakdown) {
    elements.gradeBreakdown.innerHTML = fit.categories.map((category) => {
      const percentage = Math.round(category.ratio * 100);
      const displayVal = category.label.includes("Scoring") || category.label.includes("Playmaking") || category.label.includes("Rebounding") || category.label.includes("Defense")
        ? category.value.toFixed(1)
        : `${Math.round(category.value)}/${category.target}`;

      return `
        <div class="grade-fit__item">
          <div class="grade-fit__label"><span>${escapeHtml(category.label)}</span><strong>${displayVal}</strong></div>
          <span class="grade-fit__track" role="meter" aria-valuenow="${percentage}"><span style="width:${percentage}%"></span></span>
        </div>
      `;
    }).join("");
  }

  elements.pointsTotal.textContent = fit.totals.points.toFixed(1);
  elements.reboundsTotal.textContent = fit.totals.rebounds.toFixed(1);
  elements.assistsTotal.textContent = fit.totals.assists.toFixed(1);
}
function renderGrade() {
  const complete = state.picks.length === TEAM_SIZE;
  elements.gradePanel.hidden = !complete;
  if (!complete) return;

  const budgetSpent = getBudgetSpent();
  const fit = getLineupFit(state.picks, budgetSpent);

  let title = "Solid Lineup Assembled!";
  if (fit.grade === "S" || fit.grade === "A+") title = "Elite Championship Core!";
  else if (fit.grade === "D" || fit.grade === "F") title = "Statistically Weak Lineup";

  elements.gradeMark.textContent = fit.grade;
  elements.gradeTitle.textContent = title;
  elements.gradeDescription.textContent = `Score: ${Math.round(fit.score)}/100 · Budget used: $${budgetSpent}/$${BUDGET} · ${fit.challengePlayers}/${TEAM_SIZE} players fit the challenge rule.`;

  if (elements.gradeBreakdown) {
    elements.gradeBreakdown.innerHTML = fit.categories.map((category) => `
      <div class="grade-fit__item">
        <div class="grade-fit__label"><span>${escapeHtml(category.label)}</span><strong>${category.label.includes("Scoring") || category.label.includes("Playmaking") || category.label.includes("Rebounding") || category.label.includes("Defense") ? category.value.toFixed(1) : `${Math.round(category.value)}/${category.target}`}</strong></div>
        <span class="grade-fit__track" role="meter" aria-valuenow="${Math.round(category.ratio * 100)}"><span style="width:${Math.round(category.ratio * 100)}%"></span></span>
      </div>
    `).join("");
  }

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
  elements.activeChallengeRule.textContent = RULE_INSTRUCTIONS[state.activeChallenge.rule_type] || "Follow the rule.";
  elements.activeChallengeDescription.textContent = state.activeChallenge.description;
}

// 👉 RESTRICTED GUEST CHECK FOR DRAFTING
function pickPlayer(playerId) {
  if (!requireAuthOrPrompt("draft players and play the game")) return;

  const player = state.board.flatMap((tier) => tier.players).find((item) => item.id === playerId);
  if (!player || state.picks.some((p) => p.id === player.id) || state.picks.length >= TEAM_SIZE) return;
  if (getBudgetSpent() + player.tier > BUDGET) {
    showToast("Exceeds $15 budget limit!");
    return;
  }
  state.picks.push(player);
  render();
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  window.clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => { elements.toast.hidden = true; }, 3000);
}

function newRandomBoard() {
  if (!state.players.length) return;
  state.picks = [];
  state.board = makeRandomBoard(state.activeChallenge);
  render();
}

async function loadPlayers() {
  try {
    const response = await fetch(`${API_URL}/api/v1/teams`, { headers: { "X-API-Key": API_KEY } });
    const payload = await response.json();
    state.players = createPlayerPool(payload.teams);
    state.board = makeRandomBoard(state.activeChallenge);
    render();
    elements.apiStatus.textContent = `${state.players.length} NBA players loaded`;
  } catch (error) {
    elements.apiStatus.textContent = "Failed to load player API";
  }
}

async function loadCommunityChallenges() {
  try {
    const response = await fetch(`${API_URL}/api/v1/community-challenges`, { headers: { "X-API-Key": API_KEY } });
    const payload = await response.json();
    state.communityChallenges = payload.challenges || [];
    state.communityLoading = false;
    renderCommunityChallenges();
  } catch (error) {
    state.communityLoading = false;
    state.communityMode = "local";
    renderCommunityChallenges();
  }
}

async function createCommunityChallenge(event) {
  event.preventDefault();
  if (!requireAuthOrPrompt("publish a community challenge")) return;

  const formData = new FormData(elements.createChallengeForm);
  const challengeData = {
    ...Object.fromEntries(formData.entries()),
    selected_player_ids: [...state.challengeSelectedPlayerIds]
  };
  try {
    const response = await fetch(`${API_URL}/api/v1/community-challenges`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await getValidSupabaseAccessToken()}`
      },
      body: JSON.stringify(challengeData)
    });
    if (!response.ok) throw new Error("Failed to save challenge");
    const payload = await response.json();
    state.communityChallenges = [payload, ...state.communityChallenges];
    elements.createChallengeDialog.close();
    renderCommunityChallenges();
    showToast("Challenge published successfully!");
  } catch (error) {
    showToast(error.message || "Error publishing challenge");
  }
}

// UI Event Listeners
elements.newBoard.addEventListener("click", newRandomBoard);
elements.footerNewBoard.addEventListener("click", newRandomBoard);
elements.clearLineup.addEventListener("click", () => { state.picks = []; render(); });

// 👉 Restricted guest check for challenge creation button
elements.openCreateChallenge.addEventListener("click", () => {
  if (!requireAuthOrPrompt("create a custom challenge")) return;
  if (elements.challengeCreationFields) elements.challengeCreationFields.hidden = false;
  state.challengeSelectedPlayerIds.clear();
  elements.createChallengeDialog.showModal();
  updateChallengePlayerPicker();
});

// 👉 Masthead Sign In / Sign Out toggle
elements.mastheadAuthBtn?.addEventListener("click", () => {
  if (isUserLoggedIn()) {
    signOutFromSupabase();
  } else {
    if (elements.challengeCreationFields) elements.challengeCreationFields.hidden = true; // Show login only
    elements.createChallengeDialog.showModal();
  }
});

// 👉 Guest Banner Sign In button
elements.bannerSignInBtn?.addEventListener("click", () => {
  if (elements.challengeCreationFields) elements.challengeCreationFields.hidden = true; // Show login only
  elements.createChallengeDialog.showModal();
});

elements.closeCreateChallenge.addEventListener("click", () => elements.createChallengeDialog.close());
elements.cancelCreateChallenge.addEventListener("click", () => elements.createChallengeDialog.close());
elements.createChallengeForm.addEventListener("submit", createCommunityChallenge);
elements.challengeSignIn.addEventListener("click", () => signInToSupabase(false));
elements.challengeSignUp.addEventListener("click", () => signInToSupabase(true));
elements.challengeSignOut.addEventListener("click", signOutFromSupabase);
elements.challengePlayerSearch.addEventListener("input", updateChallengePlayerPicker);

renderOfficialChallenges();
renderCommunityChallenges();
loadPlayers();
loadCommunityChallenges();