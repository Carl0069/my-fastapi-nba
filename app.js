const API_URL = "https://my-fastapi-nba.vercel.app";
const API_KEY = "lebron2369";
const GAME_PICKS_STORAGE_KEY = "nba-hub-game-picks-v1";
const STANDINGS_PREDICTION_STORAGE_KEY = "nba-hub-standings-prediction-v1";
const DAILY_GAME_TOKEN_CLAIM = 1000;
const DAILY_GAME_TOKEN_BOOST = 2000;
const GAME_PICKS_ARENA_STYLES = ["hardwood", "franchise", "neon", "courtside", "retro", "playoffs"];
const GAME_PICKS_STAT_CARD_STYLES = ["classic", "broadcast", "spotlight"];
const GAME_PICKS_PROFILE_TITLES = ["Sixth Player", "Stat Head", "Franchise Voice", "League Historian"];
const GAME_PICKS_PROFILE_BANNERS = ["classic", "midnight", "gold", "court"];
const GAME_PICKS_REWARDS = [
    { id: "parlay-insurance", title: "Parlay Safety Net", kind: "consumable", inventoryKey: "parlayInsuranceCount", inventoryLabel: "Safety Nets", purchaseLabel: "Buy Safety Net", cost: 20000, category: "One-use protection", style: "", description: "Use on a parlay. If exactly one leg loses and the others win or push, your full stake is returned." },
    { id: "payout-boost", title: "2× Payout Boost", kind: "consumable", inventoryKey: "payoutBoostCount", inventoryLabel: "boosts", purchaseLabel: "Buy 2× Boost", cost: 50000, category: "One-use power-up", style: "", description: "Double the return on one winning pick or parlay. Choose it on your slip before placing." },
    { id: "daily-boost", title: "7-Day Daily Boost", kind: "consumable", inventoryKey: "dailyBoostClaims", inventoryLabel: "boosted claims", inventoryAmount: 7, purchaseLabel: "Buy 7-Day Boost", cost: 10000, category: "7-day token boost", style: "", description: "Your next seven daily claims each add 2,000 bonus tokens (3,000 tokens total per claim)." },
    { id: "team-colors", title: "Franchise Challenge Pass", category: "Team challenge mode", cost: 100000, style: "team-colors", description: "Choose a franchise, predict its game results for streak rewards, and apply its team colors across the NBA Hub." },
    { id: "arena-neon", title: "Neon Arena", kind: "arena-theme", arenaStyle: "neon", category: "Site-wide theme", cost: 20000, style: "", description: "Turn the whole NBA Hub into a bright, electric night-game arena." },
    { id: "arena-courtside", title: "Courtside After Dark", kind: "arena-theme", arenaStyle: "courtside", category: "Site-wide theme", cost: 35000, style: "", description: "Give every section a dramatic, late-night courtside look." },
    { id: "arena-retro", title: "Hardwood Throwback", kind: "arena-theme", arenaStyle: "retro", category: "Site-wide theme", cost: 45000, style: "", description: "Restyle the whole hub with classic hardwood and vintage scoreboard colors." },
    { id: "arena-playoffs", title: "Playoff Spotlight", kind: "arena-theme", arenaStyle: "playoffs", category: "Site-wide theme", cost: 75000, style: "", description: "Bring postseason spotlight colors to every page section." },
    { id: "player-spotlight", title: "Player Spotlight", kind: "feature", category: "Hub feature", cost: 25000, style: "", description: "Pin a player from the live NBA roster API to a stat panel on the NBA Today page." },
    { id: "player-collectibles", title: "Player Card Collection", kind: "feature", category: "Collectibles", cost: 15000, style: "", description: "Collect API-backed player stat cards. Choose players from current NBA team rosters." },
    { id: "stat-card-studio", title: "Stat Card Studio", kind: "feature", category: "Layout studio", cost: 20000, style: "", description: "Choose a broadcast, classic, or spotlight layout for player stat cards across the site." },
    { id: "franchise-history", title: "Franchise History Gallery", kind: "feature", category: "History gallery", cost: 30000, style: "", description: "Browse each team's API-backed records, championship totals, and title years." },
    { id: "profile-studio", title: "Hub Profile Studio", kind: "feature", category: "Profile customization", cost: 20000, style: "", description: "Pick a fan title and profile banner shown across the NBA Hub." },
    { id: "rising-star", title: "Rising Star", category: "Collector badge", cost: 25000, style: "rising-star", description: "Add a Rising Star badge to your Game Picks header.", available: false },
    { id: "court-lights", title: "Court Lights", category: "Slip theme", cost: 40000, style: "court-lights", description: "Make your pick slip shine with a premium court-light trim.", available: false },
    { id: "hot-streak", title: "Hot Streak", category: "Collector badge", cost: 65000, style: "hot-streak", description: "Show off a fiery Hot Streak badge and glowing section accent.", available: false },
    { id: "franchise-banner", title: "Franchise Banner", category: "Header banner", cost: 100000, style: "franchise-banner", description: "Add a bold banner above your Game Picks title.", available: false },
    { id: "all-star", title: "All-Star", category: "Profile title", cost: 150000, style: "all-star", description: "Display the All-Star title across your Game Picks hub.", available: false },
    { id: "home-court", title: "Home Court", category: "Background theme", cost: 225000, style: "home-court", description: "Unlock a deeper arena-inspired background and gold court lines.", available: false },
    { id: "hall-of-fame", title: "Hall of Fame", category: "Elite frame", cost: 350000, style: "hall-of-fame", description: "Frame Game Picks with a Hall of Fame gold finish.", available: false }
];

let allTeams = [];
let currentHeadlineIndex = 0;
let headlineAutoTimer = null;
let headlineItems = [];
let newsItems = [];
let headlineScoreItems = [];
const DEFAULT_HEADLINE_STORIES = [
    {
        headline: "Boston storms back in the fourth",
        story: "The Celtics turned a sober midway-game deficit into a decisive late run with pace, rim pressure, and sharp shooting.",
        source: "ESPN",
        url: "https://www.espn.com/nba/",
        published: new Date().toISOString(),
        kind: "news",
        teamName: "Boston Celtics",
        teamLogo: "https://cdn.nba.com/logos/leagues/logo-nba.svg"
    },
    {
        headline: "The West race keeps tightening",
        story: "A handful of teams are stacking wins and losses at the exact same pace, setting up a late-season scramble for seeding.",
        source: "NBA",
        url: "https://www.nba.com/",
        published: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        kind: "news",
        teamName: "Western Conference",
        teamLogo: "https://cdn.nba.com/logos/leagues/logo-nba.svg"
    },
    {
        headline: "Rising stars are taking over the spotlight",
        story: "Young wings and high-leverage guards are creating a new wave of matchup problems every night across the league.",
        source: "NBA",
        url: "https://www.nba.com/news",
        published: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
        kind: "news",
        teamName: "NBA News",
        teamLogo: "https://cdn.nba.com/logos/leagues/logo-nba.svg"
    },
    {
        headline: "Trade chatter is heating up again",
        story: "Front offices are checking the market, with bench depth, cap flexibility, and playoff fit becoming the biggest priorities.",
        source: "NBA",
        url: "https://www.nba.com/transactions",
        published: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
        kind: "news",
        teamName: "NBA Transactions",
        teamLogo: "https://cdn.nba.com/logos/leagues/logo-nba.svg"
    }
];
let lastNewsRefreshAt = 0;
let isRefreshingNews = false;
let selectedDivision = "";
let selectedConference = "ALL";
let selectedStandingsConference = "Western";
let selectedStandingsPhase = "regular";
let selectedStandingsSeason = "";
let currentStandings = [];
const standingsByPhase = new Map();
const playoffScheduleBySeason = new Map();
let playoffBracketRequestSequence = 0;
let standingsPrediction = null;
let gamePicksState = {
    balance: 0,
    lastClaimDate: "",
    slip: [],
    bets: [],
    ownedRewards: [],
    equippedRewardId: "",
    teamColorsTeam: "",
    arenaStyle: "hardwood",
    spotlightPlayerKey: "",
    playerCollection: [],
    statCardStyle: "classic",
    historyTeamName: "",
    profileTitle: "Sixth Player",
    profileBanner: "classic",
    franchiseChallengePicks: [],
    franchiseChallengeStreak: 0,
    parlayInsuranceCount: 0,
    payoutBoostCount: 0,
    dailyBoostClaims: 0
};
let gamePicksStorageMessage = "";
let gamePicksOddsSnapshot = null;
let gamePicksScheduleGames = [];
let gamePicksScheduleMessage = "";
let gamePicksRequestSequence = 0;
let gamePicksScheduleRequest = null;
let lastGamePicksOddsRefreshAt = 0;
let selectedTxFilter = "ALL";
let selectedScheduleDate = "";
let selectedScheduleSeason = "";
let selectedSchedulePhase = "all";
let lastScheduleRefreshAt = 0;
let lastScoreRefreshAt = 0;
let lastTransactionsRefreshAt = 0;
let lastTeamsRefreshAt = 0;
let scheduleLoadMessage = "";
let scheduleRouteMissing = false;
let activeTeamId = null;
let isRefreshingTeams = false;
let scheduleRequestController = null;
let scheduleRequestSequence = 0;
let isRefreshingScores = false;
let isRefreshingTransactions = false;
let lastStandingsRefreshAt = 0;
let standingsRequestController = null;
let standingsRequestSequence = 0;
let transactionsFeedStatus = null;
let boxScoreRefreshInterval = null;
let playByPlayRefreshInterval = null;
let activeBoxScoreGameId = "";
let activeBoxScoreGame = null;
let activeBoxScoreSeason = "";
const boxScoreJerseyResults = new Map();
const boxScoreJerseyRequests = new Set();
const boxScoreJerseyLoaded = new Set();
const boxScorePlayByPlayCache = new Map();
const boxScorePlayByPlayRequests = new Set();

const DIVISION_CONF_MAP = {
    "Atlantic": "Eastern",
    "Central": "Eastern",
    "Southeast": "Eastern",
    "Northwest": "Western",
    "Pacific": "Western",
    "Southwest": "Western"
};

const teamColors = {
    "Boston Celtics":         { primary: "#007A33", dark: "#00471e" },
    "Brooklyn Nets":           { primary: "#000000", dark: "#1a1a1a" },
    "New York Knicks":         { primary: "#006BB6", dark: "#004170" },
    "Philadelphia 76ers":      { primary: "#006BB6", dark: "#003b66" },
    "Toronto Raptors":         { primary: "#CE1141", dark: "#7a0521" },
    "Chicago Bulls":           { primary: "#CE1141", dark: "#70041d" },
    "Cleveland Cavaliers":     { primary: "#6F263D", dark: "#3d101e" },
    "Detroit Pistons":         { primary: "#1D42BA", dark: "#0c2370" },
    "Indiana Pacers":          { primary: "#002D62", dark: "#001733" },
    "Milwaukee Bucks":         { primary: "#00471B", dark: "#00240d" },
    "Atlanta Hawks":           { primary: "#C8102E", dark: "#6e0414" },
    "Charlotte Hornets":       { primary: "#1D1160", dark: "#0c0530" },
    "Miami Heat":              { primary: "#98002E", dark: "#4a0017" },
    "Orlando Magic":           { primary: "#0077C0", dark: "#004169" },
    "Washington Wizards":      { primary: "#002B5C", dark: "#001630" },
    "Denver Nuggets":          { primary: "#0E2240", dark: "#060f1c" },
    "Minnesota Timberwolves":  { primary: "#0C2340", dark: "#040d1a" },
    "Oklahoma City Thunder":   { primary: "#007AC1", dark: "#004770" },
    "Portland Trail Blazers":  { primary: "#E03A3E", dark: "#78181b" },
    "Utah Jazz":               { primary: "#002B5C", dark: "#00142e" },
    "Golden State Warriors":   { primary: "#1D428A", dark: "#0e244d" },
    "LA Clippers":             { primary: "#C8102E", dark: "#6e0717" },
    "Los Angeles Lakers":      { primary: "#552583", dark: "#2a1042" },
    "Phoenix Suns":            { primary: "#1D1160", dark: "#0f0833" },
    "Sacramento Kings":        { primary: "#5A2D81", dark: "#2f1445" },
    "Dallas Mavericks":        { primary: "#00538C", dark: "#002e4f" },
    "Houston Rockets":         { primary: "#CE1141", dark: "#69041d" },
    "Memphis Grizzlies":       { primary: "#5D76A9", dark: "#2a3754" },
    "New Orleans Pelicans":    { primary: "#0C2340", dark: "#040c17" },
    "San Antonio Spurs":       { primary: "#000000", dark: "#1f1f1f" }
};

function getTeamTransactions(teamName) {
    const normalizedTeamName = teamName.toLowerCase();
    const directMatches = [];

    rawTimelineTransactions.forEach(group => {
        group.items.forEach(item => {
            const isDirectTeamMatch = item.team && item.team.toLowerCase() === normalizedTeamName;
            const isReferencedInText = item.text && item.text.toLowerCase().includes(normalizedTeamName);

            if (isDirectTeamMatch || isReferencedInText) {
                directMatches.push({
                    date: group.date,
                    type: getTransactionType(item),
                    text: item.text
                });
            }
        });
    });

    if (directMatches.length > 0) {
        return directMatches;
    }

    return [{
        date: "Offseason 2026",
        type: "STATUS",
        text: `${teamName} has not announced a major offseason transaction yet.`
    }];
}

let rawTimelineTransactions = [];
let scheduleGames = [];

function animateNumber(element, targetValue, duration = 650) {
    if (!element) return;
    const isPercent = String(targetValue).includes('%');
    const target = parseFloat(targetValue);
    if (isNaN(target)) {
        element.innerText = targetValue;
        return;
    }

    const startTime = performance.now();

    function update(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const current = (target * easeOut).toFixed(1);

        element.innerText = isPercent ? `${current}%` : current;

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.innerText = isPercent ? `${target.toFixed(1)}%` : target.toFixed(1);
        }
    }
    requestAnimationFrame(update);
}

function formatSeasonStat(value, suffix = "") {
    const number = Number(value);
    return value == null || !Number.isFinite(number) ? "—" : `${number.toFixed(1)}${suffix}`;
}

function formatPlayerSeasonStat(player, field, suffix = "") {
    return player.stats_season ? formatSeasonStat(player[field], suffix) : "—";
}

async function loadTeams() {
    if (isRefreshingTeams) return;
    isRefreshingTeams = true;
    try {
        const response = await fetch(`${API_URL}/api/v1/teams`, {
            headers: {
                "x-api-key": API_KEY
            }
        });
        if (!response.ok) throw new Error(`API request failed (${response.status})`);
        const data = await response.json();
        if (!Array.isArray(data.teams) || data.teams.length === 0) {
            throw new Error("The API returned no NBA teams.");
        }
        allTeams = data.teams;
        renderHubRewards();
        renderStandingsPrediction();
        hydrateScoreHeadlineTeams();
        if (headlineItems.length) updateHeadline(currentHeadlineIndex);
        lastTeamsRefreshAt = Date.now();
        renderStatsUpdateStatus(data.stats, data.roster);
        applyFilters();
        if (rawTimelineTransactions.length) filterTransactions();

        if (activeTeamId !== null && document.getElementById("detailModal").classList.contains("open")) {
            const refreshedTeam = allTeams.find(team => team.id === activeTeamId);
            if (refreshedTeam) openModal(refreshedTeam);
        }
    } catch (error) {
        console.error("API load failed:", error);
        const status = document.getElementById("statsUpdateStatus");
        if (allTeams.length) {
            if (status) status.textContent = "Stats refresh failed. Showing the last API response; automatic retry in 15 minutes.";
        } else {
            document.getElementById("teamGrid").innerHTML = "<p style='grid-column: 1/-1; text-align:center; color:#c9082a; padding: 40px 0;'>Unable to connect to the NBA API.</p>";
            if (status) status.textContent = "Unable to load NBA data. Check the API connection and refresh the page.";
        }
    } finally {
        isRefreshingTeams = false;
    }
}

function renderStatsUpdateStatus(stats, roster) {
    const status = document.getElementById("statsUpdateStatus");
    if (!status) return;
    const updatedAt = stats?.last_updated
        ? new Date(stats.last_updated).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
            timeZone: "Asia/Manila"
        })
        : "";
    const season = stats?.season || "current-season";
    const rosterLabel = roster?.status === "fresh"
        ? "Current roster membership"
        : "Roster snapshot may be outdated";
    status.title = [roster?.message, stats?.message].filter(Boolean).join(" ");
    if (stats?.status === "fresh") {
        status.textContent = `${rosterLabel} · ${season} stats refreshed ${updatedAt} · auto-refresh every 15 minutes`;
        status.classList.toggle("is-warning", roster?.status !== "fresh");
    } else if (stats?.status === "pending") {
        status.textContent = `${rosterLabel} · ${season} regular-season stats have not been published yet; no prior-season stats are shown.`;
        status.classList.add("is-warning");
    } else {
        status.textContent = `${rosterLabel} · ${stats?.message || `${season} player stats are unavailable.`} No prior-season stats are shown.`;
        status.classList.add("is-warning");
    }
}

function escapeMarkup(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function localDateKey(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
}

function currentNbaSeason() {
    const dateParts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "numeric"
    }).formatToParts(new Date());
    const values = Object.fromEntries(dateParts.map(part => [part.type, Number(part.value)]));
    const seasonStart = values.month >= 7 ? values.year : values.year - 1;
    return `${seasonStart}-${String(seasonStart + 1).slice(-2)}`;
}

function minimumScheduleRegularGames(season) {
    if (season === currentNbaSeason()) return 1230;
    return season === "1999-00" ? 700 : 900;
}

function initializeSeasonPickers() {
    const currentStartYear = Number(currentNbaSeason().slice(0, 4));
    const seasons = Array.from({ length: currentStartYear - 1998 }, (_, index) => {
        const startYear = currentStartYear - index;
        return `${startYear}-${String(startYear + 1).slice(-2)}`;
    });
    const schedulePicker = document.getElementById("scheduleSeasonPicker");
    const standingsPicker = document.getElementById("standingsSeasonPicker");
    [schedulePicker, standingsPicker].forEach(picker => {
        if (!picker) return;
        picker.innerHTML = seasons.map(season =>
            `<option value="${season}">${season.replace("-", "–")}</option>`
        ).join("");
        picker.value = currentNbaSeason();
    });
    selectedScheduleSeason = currentNbaSeason();
    selectedStandingsSeason = currentNbaSeason();
}

function formatScheduleDate(dateKey, options = { weekday: "long", month: "long", day: "numeric", year: "numeric" }) {
    if (!dateKey) return "";
    return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString(undefined, {
        ...options,
        timeZone: "Asia/Manila"
    });
}

function dateKeyInPhilippines(date) {
    if (!date || !Number.isFinite(date.getTime())) return "";
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
}

function canonicalNbaTricode(value) {
    const tricode = String(value || "").trim().toUpperCase();
    const aliases = {
        BRK: "BKN",
        GS: "GSW",
        NO: "NOP",
        NJ: "BKN",
        NJN: "BKN",
        NOH: "NOP",
        NOK: "NOP",
        NY: "NYK",
        PHO: "PHX",
        SA: "SAS",
        SEA: "OKC",
        UTAH: "UTA",
        VAN: "MEM",
        WSH: "WAS"
    };
    return aliases[tricode] || tricode;
}

function convertEasternTipoffToPhilippines(dateKey, timeLabel) {
    const match = String(timeLabel || "").match(/^(\d{1,2}):(\d{2})\s*(AM|PM)\s*(ET|UTC)$/i);
    if (!match || !dateKey) return { date: dateKey, time: timeLabel };

    let hour = Number(match[1]) % 12;
    if (match[3].toUpperCase() === "PM") hour += 12;
    const minute = Number(match[2]);
    const sourceTimeZone = match[4].toUpperCase() === "ET" ? "America/New_York" : "UTC";
    const assumedUtc = Date.parse(`${dateKey}T${String(hour).padStart(2, "0")}:${match[2]}:00Z`);
    let instant = assumedUtc;

    if (sourceTimeZone !== "UTC") {
        const sourceFormatter = new Intl.DateTimeFormat("en-US", {
            timeZone: sourceTimeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hourCycle: "h23"
        });
        for (let attempt = 0; attempt < 2; attempt += 1) {
            const sourceParts = Object.fromEntries(
                sourceFormatter.formatToParts(new Date(instant)).map(part => [part.type, part.value])
            );
            const sourceAsUtc = Date.UTC(
                Number(sourceParts.year),
                Number(sourceParts.month) - 1,
                Number(sourceParts.day),
                Number(sourceParts.hour),
                Number(sourceParts.minute),
                Number(sourceParts.second)
            );
            instant = assumedUtc - (sourceAsUtc - instant);
        }
    }

    const gameInstant = new Date(instant);
    const philippinesTime = gameInstant.toLocaleTimeString("en-PH", {
        timeZone: "Asia/Manila",
        hour: "numeric",
        minute: "2-digit"
    });
    return {
        date: dateKeyInPhilippines(gameInstant),
        time: `${philippinesTime} PHT`
    };
}

function scheduleGameInPhilippines(game) {
    const localizedTipoff = convertEasternTipoffToPhilippines(game.date, game.time);
    return { ...game, ...localizedTipoff };
}

function updateScheduleStatus(payload = {}) {
    const statusElement = document.getElementById("scheduleUpdateStatus");
    if (!statusElement) return;
    const scheduleUpdatedAt = payload.last_updated
        ? new Date(payload.last_updated).toLocaleString([], {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Asia/Manila"
        })
        : "";
    const scoreUpdatedAt = payload.scores?.last_updated
        ? new Date(payload.scores.last_updated).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
            timeZone: "Asia/Manila"
        })
        : "";
    const schedulePart = scheduleRouteMissing
        ? "The deployed API is missing the schedule route. Publish the latest api/index.py to Vercel."
        : scheduleLoadMessage
            ? scheduleLoadMessage
            : payload.status === "fresh"
                ? `${Number(payload.count || scheduleGames.length).toLocaleString()} games · schedule checked ${scheduleUpdatedAt}`
                : payload.status === "stale"
                    ? payload.message || "Showing the last saved full schedule"
                    : payload.message || "The full season schedule is unavailable.";
    const scoreSource = payload.scores?.source === "ESPN scoreboard fallback"
        ? " · ESPN backup"
        : "";
    const scorePart = payload.scores?.status === "fresh"
        ? `Scores refreshed ${scoreUpdatedAt}${scoreSource}`
        : payload.scores?.message || "Live scores unavailable";
    statusElement.textContent = `${schedulePart} · ${scorePart} · live scores auto-refresh every minute`;
    statusElement.title = [scheduleLoadMessage, payload.message, payload.scores?.message].filter(Boolean).join(" ");
    statusElement.classList.toggle("is-warning", payload.status !== "fresh" || payload.scores?.status !== "fresh");
}

async function loadSchedule() {
    if (scheduleRequestController) scheduleRequestController.abort();
    const controller = new AbortController();
    scheduleRequestController = controller;
    const requestSequence = ++scheduleRequestSequence;
    const statusElement = document.getElementById("scheduleUpdateStatus");
    let schedulePayload = null;
    try {
        const response = await fetch(
            `${API_URL}/api/v1/schedule?season=${encodeURIComponent(selectedScheduleSeason)}`,
            {
                headers: { "x-api-key": API_KEY },
                signal: controller.signal
            }
        );
        if (!response.ok) throw new Error(`Schedule request failed (${response.status}).`);
        schedulePayload = await response.json();
        if (schedulePayload.season !== selectedScheduleSeason) {
            throw new Error(
                `The deployed API returned the ${schedulePayload.season || "current"} season instead of ${selectedScheduleSeason.replace("-", "–")}. Publish the latest api/index.py to enable historical schedules and playoff games.`
            );
        }
        const minimumRegularGames = minimumScheduleRegularGames(selectedScheduleSeason);
        const regularGameCount = Number(schedulePayload.regular_game_count ?? schedulePayload.games?.length ?? 0);
        if (!Array.isArray(schedulePayload.games) || regularGameCount < minimumRegularGames) {
            throw new Error(schedulePayload.message || `The API did not return the full ${selectedScheduleSeason} schedule.`);
        }
        if (requestSequence !== scheduleRequestSequence) return;
        scheduleLoadMessage = "";
        scheduleRouteMissing = false;
        scheduleGames = schedulePayload.games.map(scheduleGameInPhilippines);
        playoffScheduleBySeason.set(selectedScheduleSeason, scheduleGames);
        refreshPlayoffBracketFromCache(selectedScheduleSeason);
        if (selectedScheduleSeason === currentNbaSeason()) {
            gamePicksScheduleGames = scheduleGames;
            gamePicksScheduleMessage = "";
            settleFranchiseChallenges();
            settleGamePicksBets();
            renderFranchiseChallenge();
            renderGamePicks();
        }
        hydrateScoreHeadlineTeams();
        if (headlineItems.length) refreshHeadlineSlides();
        lastScheduleRefreshAt = Date.now();
        updateScheduleDateBounds(true);
        if (selectedScheduleSeason === currentNbaSeason()) {
            updateScheduleStatus(schedulePayload);
            loadLiveScores({ background: true });
        } else if (statusElement) {
            statusElement.textContent = `${Number(schedulePayload.count || scheduleGames.length).toLocaleString()} games · ${selectedScheduleSeason.replace("-", "–")} archive${schedulePayload.source ? ` · ${schedulePayload.source}` : ""}`;
            statusElement.classList.toggle("is-warning", schedulePayload.status !== "fresh");
        }
        renderSchedule();
    } catch (error) {
        if (controller.signal.aborted || requestSequence !== scheduleRequestSequence) return;
        console.error(`NBA ${selectedScheduleSeason} schedule load failed:`, error);
        const message = error instanceof Error ? error.message : String(error);
        scheduleRouteMissing = message.includes("(404)");
        scheduleLoadMessage = scheduleRouteMissing
            ? "The deployed API is missing the schedule route. Publish the latest api/index.py to Vercel."
            : message;
        if (statusElement) {
            statusElement.textContent = scheduleLoadMessage;
            statusElement.classList.add("is-warning");
        }
        renderSchedule();
    } finally {
        if (requestSequence === scheduleRequestSequence) {
            scheduleRequestController = null;
        }
    }
}

function schedulePhaseForGame(game) {
    const stage = String(game.stage || "").toLowerCase();
    if (/play.?in|playoff|finals/.test(stage) || String(game.id || "").startsWith("004")) return "playoffs";
    if (/pre.?season/.test(stage) || String(game.id || "").startsWith("001")) return "preseason";
    return "regular";
}

function gamesInSelectedSchedulePhase() {
    return selectedSchedulePhase === "all"
        ? scheduleGames
        : scheduleGames.filter(game => schedulePhaseForGame(game) === selectedSchedulePhase);
}

function isCompletedScheduleGame(game) {
    return (Number(game.status_code) === 3 || /final/i.test(String(game.status || "")))
        && game.home_score != null
        && game.away_score != null;
}

function teamRecordForGame(teamName, game) {
    const phase = schedulePhaseForGame(game);
    const recordPhase = phase === "playoffs" ? "regular" : phase;
    const includeRegularSeasonThroughEnd = phase === "playoffs";
    const currentSeason = currentNbaSeason();
    const authoritativeStandings = selectedScheduleSeason === currentSeason
        ? standingsByPhase.get(`${currentSeason}:${recordPhase}`)
        : null;
    const currentStanding = authoritativeStandings?.find(team =>
        String(team.team || "").trim().toLocaleLowerCase()
            === String(teamName || "").trim().toLocaleLowerCase()
    );
    if (
        currentStanding?.wins != null
        && currentStanding?.losses != null
        && String(currentStanding.wins).trim() !== ""
        && String(currentStanding.losses).trim() !== ""
    ) {
        const label = phase === "playoffs"
            ? "Regular-season record"
            : phase === "preseason"
                ? "Current preseason record"
                : "Current season record";
        return {
            text: `${currentStanding.wins}-${currentStanding.losses}`,
            label
        };
    }

    let wins = 0;
    let losses = 0;
    const teamKey = String(teamName || "").trim().toLocaleLowerCase();

    scheduleGames.forEach(previousGame => {
        if (
            schedulePhaseForGame(previousGame) !== recordPhase
            || !isCompletedScheduleGame(previousGame)
            || (!includeRegularSeasonThroughEnd && previousGame.date > game.date)
        ) return;

        const homeKey = String(previousGame.home || "").trim().toLocaleLowerCase();
        const awayKey = String(previousGame.away || "").trim().toLocaleLowerCase();
        if (homeKey !== teamKey && awayKey !== teamKey) return;

        const homeScore = Number(previousGame.home_score);
        const awayScore = Number(previousGame.away_score);
        if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore) || homeScore === awayScore) return;
        const teamWon = homeKey === teamKey ? homeScore > awayScore : awayScore > homeScore;
        if (teamWon) wins += 1;
        else losses += 1;
    });

    const label = phase === "playoffs"
        ? "Regular-season record"
        : phase === "preseason"
            ? "Preseason record"
            : "Season record";
    return { text: `${wins}-${losses}`, label };
}

function recordTextToWinPct(recordText) {
    const match = String(recordText || "").match(/(\d+)\s*[-–]\s*(\d+)/);
    if (!match) return null;
    const wins = Number(match[1]);
    const losses = Number(match[2]);
    if (!Number.isFinite(wins) || !Number.isFinite(losses) || wins < 0 || losses < 0) return null;
    const total = wins + losses;
    if (!total) return null;
    return wins / total;
}

function buildGameWinProbability(game) {
    if (!game || typeof game !== "object") return { away: 50, home: 50, label: "Even odds" };
    const names = normalizeGameTeamNames(game);
    const awayRecord = teamRecordForGame(names.away, game);
    const homeRecord = teamRecordForGame(names.home, game);
    const awayPct = recordTextToWinPct(awayRecord.text) ?? 0.5;
    const homePct = recordTextToWinPct(homeRecord.text) ?? 0.5;
    const homeCourtAdjustment = 0.04;
    const ratingGap = (homePct - awayPct) + homeCourtAdjustment;
    const homeChance = Math.min(Math.max(0.5 + ratingGap * 0.55, 0.12), 0.88);
    const awayChance = 1 - homeChance;
    const awayWinPct = Math.round(awayChance * 100);
    const homeWinPct = Math.round(homeChance * 100);
    const favorite = homeWinPct >= awayWinPct ? game.home : game.away;
    return {
        away: awayWinPct,
        home: homeWinPct,
        label: `${favorite} favored`
    };
}

function renderGameWinProbability(game) {
    const normalized = normalizeGameTeamNames(game);
    const probability = buildGameWinProbability(game);
    return `
        <div class="game-win-probability" aria-label="Win probability for ${escapeMarkup(normalized.away)} vs ${escapeMarkup(normalized.home)}">
            <div class="game-win-probability__header">
                <span>Win probability</span>
                <strong>${escapeMarkup(probability.label)}</strong>
            </div>
            <div class="game-win-probability__meter" aria-hidden="true">
                <span class="game-win-probability__segment is-away" style="flex:${probability.away};"></span>
                <span class="game-win-probability__segment is-home" style="flex:${probability.home};"></span>
            </div>
            <div class="game-win-probability__labels">
                <span>${escapeMarkup(normalized.away)} ${escapeMarkup(probability.away)}%</span>
                <span>${escapeMarkup(normalized.home)} ${escapeMarkup(probability.home)}%</span>
            </div>
        </div>
    `;
}

const NBA_TEAM_INFO = {
    "Atlanta Hawks": { code: "atl", logo: "https://a.espncdn.com/i/teamlogos/nba/500/atl.png" },
    "Boston Celtics": { code: "bos", logo: "https://a.espncdn.com/i/teamlogos/nba/500/bos.png" },
    "Brooklyn Nets": { code: "bkn", logo: "https://a.espncdn.com/i/teamlogos/nba/500/bkn.png" },
    "Charlotte Hornets": { code: "cha", logo: "https://a.espncdn.com/i/teamlogos/nba/500/cha.png" },
    "Chicago Bulls": { code: "chi", logo: "https://a.espncdn.com/i/teamlogos/nba/500/chi.png" },
    "Cleveland Cavaliers": { code: "cle", logo: "https://a.espncdn.com/i/teamlogos/nba/500/cle.png" },
    "Dallas Mavericks": { code: "dal", logo: "https://a.espncdn.com/i/teamlogos/nba/500/dal.png" },
    "Denver Nuggets": { code: "den", logo: "https://a.espncdn.com/i/teamlogos/nba/500/den.png" },
    "Detroit Pistons": { code: "det", logo: "https://a.espncdn.com/i/teamlogos/nba/500/det.png" },
    "Golden State Warriors": { code: "gsw", logo: "https://a.espncdn.com/i/teamlogos/nba/500/gsw.png" },
    "Houston Rockets": { code: "hou", logo: "https://a.espncdn.com/i/teamlogos/nba/500/hou.png" },
    "Indiana Pacers": { code: "ind", logo: "https://a.espncdn.com/i/teamlogos/nba/500/ind.png" },
    "Los Angeles Clippers": { code: "lac", logo: "https://a.espncdn.com/i/teamlogos/nba/500/lac.png" },
    "Los Angeles Lakers": { code: "lal", logo: "https://a.espncdn.com/i/teamlogos/nba/500/lal.png" },
    "Memphis Grizzlies": { code: "mem", logo: "https://a.espncdn.com/i/teamlogos/nba/500/mem.png" },
    "Miami Heat": { code: "mia", logo: "https://a.espncdn.com/i/teamlogos/nba/500/mia.png" },
    "Milwaukee Bucks": { code: "mil", logo: "https://a.espncdn.com/i/teamlogos/nba/500/mil.png" },
    "Minnesota Timberwolves": { code: "min", logo: "https://a.espncdn.com/i/teamlogos/nba/500/min.png" },
    "New Orleans Pelicans": { code: "no", logo: "https://a.espncdn.com/i/teamlogos/nba/500/no.png" },
    "New York Knicks": { code: "nyk", logo: "https://a.espncdn.com/i/teamlogos/nba/500/nyk.png" },
    "Oklahoma City Thunder": { code: "okc", logo: "https://a.espncdn.com/i/teamlogos/nba/500/okc.png" },
    "Orlando Magic": { code: "orl", logo: "https://a.espncdn.com/i/teamlogos/nba/500/orl.png" },
    "Philadelphia 76ers": { code: "phi", logo: "https://a.espncdn.com/i/teamlogos/nba/500/phi.png" },
    "Phoenix Suns": { code: "phx", logo: "https://a.espncdn.com/i/teamlogos/nba/500/phx.png" },
    "Portland Trail Blazers": { code: "por", logo: "https://a.espncdn.com/i/teamlogos/nba/500/por.png" },
    "Sacramento Kings": { code: "sac", logo: "https://a.espncdn.com/i/teamlogos/nba/500/sac.png" },
    "San Antonio Spurs": { code: "sa", logo: "https://a.espncdn.com/i/teamlogos/nba/500/sa.png" },
    "Toronto Raptors": { code: "tor", logo: "https://a.espncdn.com/i/teamlogos/nba/500/tor.png" },
    "Utah Jazz": { code: "utah", logo: "https://a.espncdn.com/i/teamlogos/nba/500/utah.png" },
    "Washington Wizards": { code: "was", logo: "https://a.espncdn.com/i/teamlogos/nba/500/was.png" }
};

const NBA_TEAM_NAME_ALIASES = {
    "LA Clippers": "Los Angeles Clippers",
    "Los Angeles Clippers": "Los Angeles Clippers",
    "New Orleans Pelicans": "New Orleans Pelicans",
    "NO Pelicans": "New Orleans Pelicans",
    "Pelicans": "New Orleans Pelicans"
};

function normalizeNbaTeamName(teamName) {
    const raw = String(teamName || "").trim();
    if (!raw) return "";
    if (NBA_TEAM_NAME_ALIASES[raw]) return NBA_TEAM_NAME_ALIASES[raw];
    return raw;
}

const ALL_NBA_TEAM_NAMES = Object.keys(NBA_TEAM_INFO);

const INJURY_REPORT_CACHE = {
    byTeam: {},
    lastUpdated: 0
};

async function loadLiveInjuryReports({ background = false } = {}) {
    const statusElement = document.getElementById("injuryReportStatus");
    try {
        const response = await fetch(`${API_URL}/api/v1/injuries`, {
            headers: { "x-api-key": API_KEY }
        });
        if (!response.ok) throw new Error(`Injury report request failed (${response.status}).`);
        const payload = await response.json();
        const byTeam = {};
        for (const teamName of ALL_NBA_TEAM_NAMES) {
            byTeam[teamName] = [];
        }
        for (const teamEntry of Array.isArray(payload.teams) ? payload.teams : []) {
            if (!teamEntry || typeof teamEntry.team !== "string") continue;
            const teamName = normalizeNbaTeamName(teamEntry.team);
            const players = Array.isArray(teamEntry.players)
                ? teamEntry.players.map(player => ({
                    player: String(player.player || player.name || "Player").trim(),
                    status: String(player.status || "Unknown").trim() || "Unknown",
                    note: String(player.note || player.details || player.shortComment || player.longComment || "No update available").trim() || "No update available",
                    details: player.details || "",
                    position: String(player.position || player.pos || "-").trim() || "-",
                    returnDate: String(player.returnDate || player.estReturnDate || player.date || "-").trim() || "-",
                    updatedAt: player.updatedAt || player.date || ""
                })).filter(player => player.player)
                : [];
            byTeam[teamName] = players;
        }
        INJURY_REPORT_CACHE.byTeam = byTeam;
        INJURY_REPORT_CACHE.lastUpdated = Date.now();
        if (statusElement) {
            const updatedAt = payload.last_updated ? new Date(payload.last_updated).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
                timeZone: "Asia/Manila"
            }) : "just now";
            statusElement.textContent = `Updated ${updatedAt} · live from ESPN`;
        }
        renderInjuryReportSection();
        const filter = document.getElementById("injuryTeamFilter");
        if (filter && !filter.value) filter.value = "All teams";
        return byTeam;
    } catch (error) {
        console.warn("Live NBA injury reports are unavailable.", error);
        if (statusElement) {
            statusElement.textContent = "Injury report is temporarily unavailable. Checking ESPN again shortly.";
        }
        renderInjuryReportSection();
        return INJURY_REPORT_CACHE.byTeam;
    }
}

function formatInjuryStatusClass(status) {
    const cleaned = String(status || "unknown").trim().toLowerCase();
    if (!cleaned) return "status-unknown";
    const normalized = cleaned.replace(/[^a-z]+/g, "-");
    return `status-${normalized}`;
}

function bindInjuryReportFilter() {
    const filter = document.getElementById("injuryTeamFilter");
    if (!filter || filter.dataset.bound === "true") return;
    filter.dataset.bound = "true";
    filter.addEventListener("change", () => {
        renderInjuryReportSection();
    });
}

function renderInjuryReportSection() {
    const grid = document.getElementById("injuryReportGrid");
    const filter = document.getElementById("injuryTeamFilter");
    if (!grid) return;

    const teams = ALL_NBA_TEAM_NAMES.map(team => {
        const players = Array.isArray(INJURY_REPORT_CACHE.byTeam?.[team]) ? INJURY_REPORT_CACHE.byTeam[team] : [];
        return {
            team,
            players,
            logo: NBA_TEAM_INFO[team]?.logo || "https://cdn.nba.com/logos/leagues/logo-nba.svg"
        };
    }).filter(team => team.players.length);

    if (filter) {
        bindInjuryReportFilter();
        const selected = filter.value || "All teams";
        const available = new Set(teams.map(team => team.team));
        const existingOptions = [...filter.querySelectorAll("option")].map(option => option.value);
        const expected = ["All teams", ...ALL_NBA_TEAM_NAMES];
        if (JSON.stringify(existingOptions) !== JSON.stringify(expected)) {
            filter.innerHTML = expected.map(value => `<option value="${escapeMarkup(value)}">${escapeMarkup(value)}</option>`).join("");
        }

        if (selected === "All teams" || available.has(selected)) {
            filter.value = selected;
        } else {
            filter.value = "All teams";
        }
    }

    const selectedTeam = filter?.value || "All teams";
    const visibleTeams = selectedTeam === "All teams" ? teams : teams.filter(team => team.team === selectedTeam);

    if (!visibleTeams.length) {
        grid.innerHTML = '<div class="injury-report-empty">Loading live ESPN injury updates…</div>';
        return;
    }

    grid.innerHTML = visibleTeams.map(team => `
        <div class="injury-team-block">
            <div class="injury-team-block__header">
                <div class="injury-team-block__brand">
                    <img src="${team.logo}" alt="${escapeMarkup(team.team)} logo" class="injury-team-block__logo" loading="lazy" />
                    <h3>${escapeMarkup(team.team)}</h3>
                </div>
            </div>
            <div class="injury-team-table-wrap">
                <table class="injury-team-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Pos</th>
                            <th>Est. Return Date</th>
                            <th>Status</th>
                            <th>Comment</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${team.players.map(player => {
                            const status = String(player.status || "Unknown").trim() || "Unknown";
                            const position = String(player.position || player.pos || "-").trim() || "-";
                            const returnDate = String(player.returnDate || player.estReturnDate || player.date || "-").trim() || "-";
                            const comment = String(player.note || player.longComment || player.details || "No update available.").trim() || "No update available.";
                            const dateLabel = returnDate === "-" ? "-" : new Date(returnDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                            return `
                                <tr>
                                    <td class="injury-player-name">${escapeMarkup(player.player)}</td>
                                    <td class="injury-player-position">${escapeMarkup(position)}</td>
                                    <td class="injury-player-date">${escapeMarkup(dateLabel)}</td>
                                    <td class="injury-player-status">
                                        <span class="injury-status-badge ${formatInjuryStatusClass(status)}">
                                            ${escapeMarkup(status)}
                                        </span>
                                    </td>
                                    <td class="injury-player-comment">${escapeMarkup(comment)}</td>
                                </tr>
                            `;
                        }).join("")}
                    </tbody>
                </table>
            </div>
        </div>
    `).join("");
}

function normalizeGameTeamNames(game) {
    const awayName = typeof game?.away === "string"
        ? game.away
        : game?.away?.name || game?.awayTeam?.teamTricode || "Away";
    const homeName = typeof game?.home === "string"
        ? game.home
        : game?.home?.name || game?.homeTeam?.teamTricode || "Home";
    return { away: awayName, home: homeName };
}

function getGameInjuryReport(game) {
    if (!game || typeof game !== "object") return [];
    const teamNames = normalizeGameTeamNames(game);
    const awayTeam = INJURY_REPORT_CACHE.byTeam[teamNames.away] || [];
    const homeTeam = INJURY_REPORT_CACHE.byTeam[teamNames.home] || [];
    return [
        { team: teamNames.away, players: awayTeam },
        { team: teamNames.home, players: homeTeam }
    ].filter(teamEntry => Array.isArray(teamEntry.players) && teamEntry.players.length);
}

function renderGameInjuryReport(game) {
    const report = getGameInjuryReport(game);
    if (!report.length) {
        return `
            <section class="game-injury-report">
                <div class="game-injury-report__header">
                    <span>Injury report</span>
                    <strong>Not available</strong>
                </div>
                <p class="game-injury-report__empty">No injury notes are available for this matchup.</p>
            </section>
        `;
    }
    const injuryCount = report.reduce((count, teamEntry) => count + teamEntry.players.length, 0);
    return `
        <section class="game-injury-report">
            <div class="game-injury-report__header">
                <span>Injury report</span>
                <strong>${escapeMarkup(injuryCount)} active</strong>
            </div>
            <div class="game-injury-report__teams">
                ${report.map(teamEntry => `
                    <div class="game-injury-report__team">
                        <h4>${escapeMarkup(teamEntry.team)}</h4>
                        <ul>
                            ${teamEntry.players.map(player => `
                                <li>
                                    <span>${escapeMarkup(player.player)}</span>
                                    <strong class="severity-${String(player.status).toLowerCase().replace(/[^a-z]+/g, "-") || "status"}">${escapeMarkup(player.status)}</strong>
                                    <small>${escapeMarkup(player.note)}</small>
                                </li>
                            `).join("")}
                        </ul>
                    </div>
                `).join("")}
            </div>
        </section>
    `;
}

function playoffSeriesGameNumber(game, season = selectedScheduleSeason) {
    if (
        schedulePhaseForGame(game) !== "playoffs"
        || /play.?in/i.test(String(game.stage || ""))
        || /cancelled|canceled|abandoned/i.test(String(game.status || ""))
    ) return null;

    const matchup = [game.home_tricode || game.home, game.away_tricode || game.away]
        .map(team => canonicalNbaTricode(team))
        .sort()
        .join(":");
    const seasonGames = playoffScheduleBySeason.get(season)
        || (season === selectedScheduleSeason ? scheduleGames : []);
    const seriesGames = seasonGames
        .filter(candidate => {
            if (
                schedulePhaseForGame(candidate) !== "playoffs"
                || /play.?in/i.test(String(candidate.stage || ""))
                || /cancelled|canceled|abandoned/i.test(String(candidate.status || ""))
            ) return false;
            const candidateMatchup = [
                candidate.home_tricode || candidate.home,
                candidate.away_tricode || candidate.away
            ]
                .map(team => canonicalNbaTricode(team))
                .sort()
                .join(":");
            return candidateMatchup === matchup;
        })
        .sort((left, right) =>
            `${left.date || ""} ${left.time || ""} ${left.id || ""}`
                .localeCompare(`${right.date || ""} ${right.time || ""} ${right.id || ""}`)
        );
    const index = seriesGames.findIndex(candidate => candidate.id === game.id);
    return index < 0 ? null : index + 1;
}

function gamePicksTeamKey(teamName) {
    const key = String(teamName || "").trim().toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
    if (key === "losangelesclippers") return "laclippers";
    if (key === "lalakers") return "losangeleslakers";
    return key;
}

function gamePicksMatchupKey(home, away) {
    return `${gamePicksTeamKey(home)}:${gamePicksTeamKey(away)}`;
}

function formatGamePicksMultiplier(decimalOdds) {
    const value = Number(decimalOdds);
    return Number.isFinite(value) && value > 1 ? `${value.toFixed(2)}x` : "—";
}

function gamePicksQuoteIsFresh(quote) {
    const updatedAt = Date.parse(quote?.last_updated || "");
    if (!Number.isFinite(updatedAt)) return false;
    const age = Date.now() - updatedAt;
    return age >= -60_000 && age <= 15 * 60_000;
}

function formatGamePicksQuoteTime(quote) {
    const updatedAt = Date.parse(quote?.last_updated || "");
    return Number.isFinite(updatedAt)
        ? new Date(updatedAt).toLocaleTimeString("en-PH", {
            timeZone: "Asia/Manila",
            hour: "numeric",
            minute: "2-digit"
        })
        : "time unavailable";
}

function loadGamePicksState() {
    try {
        const savedState = localStorage.getItem(GAME_PICKS_STORAGE_KEY);
        if (!savedState) return;
        const parsed = JSON.parse(savedState);
        const balance = Number(parsed?.balance);
        const ownedRewards = parsed?.ownedRewards ?? [];
        const equippedRewardId = parsed?.equippedRewardId ?? "";
        const teamColorsTeam = parsed?.teamColorsTeam ?? "";
        const arenaStyle = parsed?.arenaStyle ?? "hardwood";
        const spotlightPlayerKey = parsed?.spotlightPlayerKey ?? "";
        const playerCollection = parsed?.playerCollection ?? [];
        const statCardStyle = parsed?.statCardStyle ?? "classic";
        const historyTeamName = parsed?.historyTeamName ?? "";
        const profileTitle = parsed?.profileTitle ?? "Sixth Player";
        const profileBanner = parsed?.profileBanner ?? "classic";
        const franchiseChallengePicks = parsed?.franchiseChallengePicks ?? [];
        const franchiseChallengeStreak = parsed?.franchiseChallengeStreak ?? 0;
        const parlayInsuranceCount = parsed?.parlayInsuranceCount ?? 0;
        const payoutBoostCount = parsed?.payoutBoostCount ?? 0;
        const dailyBoostClaims = parsed?.dailyBoostClaims ?? 0;
        if (
            !Number.isSafeInteger(balance)
            || balance < 0
            || typeof parsed?.lastClaimDate !== "string"
            || !Array.isArray(parsed?.slip)
            || !Array.isArray(parsed?.bets)
            || !Array.isArray(ownedRewards)
            || ownedRewards.some(id => !GAME_PICKS_REWARDS.some(reward => reward.id === id))
            || new Set(ownedRewards).size !== ownedRewards.length
            || (equippedRewardId !== "" && !ownedRewards.includes(equippedRewardId))
            || (teamColorsTeam !== "" && !Object.prototype.hasOwnProperty.call(teamColors, teamColorsTeam))
            || !GAME_PICKS_ARENA_STYLES.includes(arenaStyle)
            || typeof spotlightPlayerKey !== "string"
            || !Array.isArray(playerCollection)
            || playerCollection.some(card => typeof card !== "string")
            || new Set(playerCollection).size !== playerCollection.length
            || !GAME_PICKS_STAT_CARD_STYLES.includes(statCardStyle)
            || (historyTeamName !== "" && typeof historyTeamName !== "string")
            || !GAME_PICKS_PROFILE_TITLES.includes(profileTitle)
            || !GAME_PICKS_PROFILE_BANNERS.includes(profileBanner)
            || !Array.isArray(franchiseChallengePicks)
            || franchiseChallengePicks.some(pick =>
                !pick
                || typeof pick !== "object"
                || typeof pick.event_id !== "string"
                || typeof pick.home !== "string"
                || typeof pick.away !== "string"
                || typeof pick.team !== "string"
                || !["win", "loss"].includes(pick.prediction)
                || !["pending", "correct", "incorrect"].includes(pick.result)
            )
            || !Number.isSafeInteger(franchiseChallengeStreak)
            || franchiseChallengeStreak < 0
            || !Number.isSafeInteger(parlayInsuranceCount)
            || parlayInsuranceCount < 0
            || !Number.isSafeInteger(payoutBoostCount)
            || payoutBoostCount < 0
            || !Number.isSafeInteger(dailyBoostClaims)
            || dailyBoostClaims < 0
            || parsed.slip.some(leg => !leg || typeof leg !== "object")
            || parsed.bets.some(bet =>
                !bet
                || typeof bet !== "object"
                || !Array.isArray(bet.legs)
                || bet.legs.some(leg => !leg || typeof leg !== "object")
            )
        ) {
            throw new Error("Saved Game Picks data is not in a supported format.");
        }
        gamePicksState = {
            balance,
            lastClaimDate: parsed.lastClaimDate,
            slip: parsed.slip,
            bets: parsed.bets,
            ownedRewards,
            equippedRewardId,
            teamColorsTeam,
            arenaStyle,
            spotlightPlayerKey,
            playerCollection,
            statCardStyle,
            historyTeamName,
            profileTitle,
            profileBanner,
            franchiseChallengePicks,
            franchiseChallengeStreak,
            parlayInsuranceCount,
            payoutBoostCount,
            dailyBoostClaims
        };
    } catch (error) {
        console.error("Saved Game Picks data could not be loaded:", error);
        gamePicksStorageMessage =
            "Saved Game Picks data could not be read. Browser storage may be blocked or corrupted.";
    }
}

function saveGamePicksState(nextState) {
    try {
        localStorage.setItem(GAME_PICKS_STORAGE_KEY, JSON.stringify(nextState));
    } catch (error) {
        console.error("Game Picks data could not be saved:", error);
        gamePicksStorageMessage =
            "Game Picks could not save to this browser. Check browser storage settings and try again.";
        return false;
    }
    gamePicksState = nextState;
    gamePicksStorageMessage = "";
    return true;
}

function setGamePicksWalletStatus(message, isError = false) {
    const status = document.getElementById("gamePicksWalletStatus");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("is-warning", isError);
}

function franchiseChallengeRewardForStreak(streak) {
    return 2000 + Math.min(Math.max(0, streak), 6) * 500;
}

function setFranchiseChallengePick(eventId, prediction) {
    if (
        !gamePicksState.ownedRewards.includes("team-colors")
        || !gamePicksState.teamColorsTeam
        || !["win", "loss"].includes(prediction)
    ) return;
    const event = gamePicksOddsSnapshot?.events?.find(item => item.id === eventId);
    const scheduleGame = event && findGamePicksScheduleGame(event);
    const team = gamePicksState.teamColorsTeam;
    const isFavoriteTeamPlaying = event && (
        gamePicksTeamKey(event.home) === gamePicksTeamKey(team)
        || gamePicksTeamKey(event.away) === gamePicksTeamKey(team)
    );
    if (
        !event
        || !scheduleGame
        || Number(scheduleGame.status_code) !== 1
        || Date.parse(event.commence_time) <= Date.now()
        || !isFavoriteTeamPlaying
    ) {
        setGamePicksWalletStatus("That franchise challenge is no longer available.", true);
        return;
    }
    if (gamePicksState.franchiseChallengePicks.some(pick => pick.event_id === eventId)) {
        return;
    }
    const pick = {
        event_id: event.id,
        game_id: scheduleGame.id,
        home: event.home,
        away: event.away,
        team,
        prediction,
        commence_time: event.commence_time,
        result: "pending",
        payout: 0,
        placed_at: new Date().toISOString(),
        settled_at: null
    };
    const nextState = {
        ...gamePicksState,
        franchiseChallengePicks: [...gamePicksState.franchiseChallengePicks, pick].slice(-100)
    };
    if (saveGamePicksState(nextState)) {
        setGamePicksWalletStatus(
            `Franchise Challenge locked: ${team} to ${prediction === "win" ? "win" : "lose"}.`
        );
        renderGamePicks();
    } else {
        setGamePicksWalletStatus(gamePicksStorageMessage, true);
    }
}

function settleFranchiseChallenges() {
    if (!gamePicksState.ownedRewards.includes("team-colors")) return;
    let balance = gamePicksState.balance;
    let streak = gamePicksState.franchiseChallengeStreak;
    let changed = false;
    let rewardsEarned = 0;
    const picks = [...gamePicksState.franchiseChallengePicks]
        .map((pick, index) => ({ pick, index }))
        .sort((left, right) =>
            Date.parse(left.pick.commence_time || left.pick.placed_at)
                - Date.parse(right.pick.commence_time || right.pick.placed_at)
        );
    const settledPicks = [...gamePicksState.franchiseChallengePicks];
    let blockedByEarlierPendingPick = false;
    for (const { pick, index } of picks) {
        if (pick.result !== "pending") continue;
        if (blockedByEarlierPendingPick) continue;
        const game = gamePicksScheduleGames.find(item => item.id === pick.game_id)
            || gamePicksScheduleGames.find(item =>
                gamePicksMatchupKey(item.home, item.away)
                    === gamePicksMatchupKey(pick.home, pick.away)
                && Math.abs(
                    Date.parse(`${String(item.date || "").slice(0, 10)}T12:00:00Z`)
                    - Date.parse(`${dateKeyInPhilippines(new Date(pick.commence_time))}T12:00:00Z`)
                ) <= 24 * 60 * 60 * 1000
            );
        if (!game || !isCompletedScheduleGame(game)) {
            blockedByEarlierPendingPick = true;
            continue;
        }
        const homeScore = Number(game.home_score);
        const awayScore = Number(game.away_score);
        if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) {
            blockedByEarlierPendingPick = true;
            continue;
        }
        const favoriteWon = gamePicksTeamKey(pick.team) === gamePicksTeamKey(game.home)
            ? homeScore > awayScore
            : awayScore > homeScore;
        const correct = (pick.prediction === "win") === favoriteWon;
        const payout = correct ? franchiseChallengeRewardForStreak(streak) : 0;
        streak = correct ? streak + 1 : 0;
        balance += payout;
        rewardsEarned += payout;
        settledPicks[index] = {
            ...pick,
            result: correct ? "correct" : "incorrect",
            payout,
            settled_at: new Date().toISOString()
        };
        changed = true;
    }
    if (!changed) return;
    const nextState = {
        ...gamePicksState,
        balance,
        franchiseChallengeStreak: streak,
        franchiseChallengePicks: settledPicks
    };
    if (saveGamePicksState(nextState)) {
        setGamePicksWalletStatus(
            rewardsEarned
                ? `Franchise Challenge earned ${rewardsEarned.toLocaleString()} tokens. Current streak: ${streak}.`
                : `Franchise Challenge missed. Your streak is now ${streak}.`
        );
    } else {
        setGamePicksWalletStatus(gamePicksStorageMessage, true);
    }
}

function renderFranchiseChallenge() {
    const panel = document.getElementById("gamePicksChallengePanel");
    const teamLabel = document.getElementById("gamePicksChallengeTeam");
    const streakLabel = document.getElementById("gamePicksChallengeStreak");
    const nextReward = document.getElementById("gamePicksChallengeReward");
    const history = document.getElementById("gamePicksChallengeHistory");
    if (!panel || !teamLabel || !streakLabel || !nextReward || !history) return;
    const available = gamePicksState.ownedRewards.includes("team-colors")
        && Boolean(gamePicksState.teamColorsTeam);
    panel.hidden = !available;
    if (!available) return;
    teamLabel.textContent = gamePicksState.teamColorsTeam;
    streakLabel.textContent = String(gamePicksState.franchiseChallengeStreak);
    nextReward.textContent = `${franchiseChallengeRewardForStreak(gamePicksState.franchiseChallengeStreak).toLocaleString()} tokens`;
    const recentPicks = gamePicksState.franchiseChallengePicks.slice(-5).reverse();
    history.innerHTML = recentPicks.length
        ? `<strong>Recent calls</strong><ul>${recentPicks.map(pick => `
            <li>
                <span>${escapeMarkup(pick.away)} at ${escapeMarkup(pick.home)} · ${escapeMarkup(pick.team)} to ${pick.prediction === "win" ? "win" : "lose"}</span>
                <span>${pick.result === "pending"
                    ? "Pending"
                    : pick.result === "correct"
                        ? `Correct · +${Number(pick.payout).toLocaleString()}`
                        : "Incorrect"}</span>
            </li>
        `).join("")}</ul>`
        : "<p>Choose Win or Lose on one of your team's upcoming game cards to start a challenge.</p>";
}

function applyGamePicksSiteTheme() {
    const root = document.documentElement;
    const activeStyle = gamePicksState.arenaStyle || "hardwood";
    const requiredRewardId = activeStyle === "franchise"
        ? "team-colors"
        : activeStyle === "hardwood"
            ? ""
            : GAME_PICKS_REWARDS.find(reward =>
                reward.kind === "arena-theme" && reward.arenaStyle === activeStyle
            )?.id;
    const themeIsOwned = !requiredRewardId
        || gamePicksState.ownedRewards.includes(requiredRewardId);
    const theme = themeIsOwned && GAME_PICKS_ARENA_STYLES.includes(activeStyle)
        ? activeStyle
        : "hardwood";
    root.dataset.siteTheme = theme;
    if (theme === "franchise") {
        const selected = teamColors[gamePicksState.teamColorsTeam];
        const accent = selected?.primary === "#000000" || selected?.primary === "#1f1f1f"
            ? "#aeb8c4"
            : selected?.primary || "#007a33";
        root.style.setProperty("--site-theme-accent", accent);
    } else {
        root.style.removeProperty("--site-theme-accent");
    }
    return theme;
}

function getApiRosterPlayers(team) {
    const players = [
        ...(Array.isArray(team?.starters_2026_27) ? team.starters_2026_27 : []),
        ...(Array.isArray(team?.bench_2026_27) ? team.bench_2026_27 : [])
    ];
    return players
        .filter(player => player && typeof player.name === "string" && player.name.trim())
        .map(player => ({ ...player, name: player.name.trim() }));
}

function apiPlayerKey(team, player) {
    return `${team.id}:${player.name}`;
}

function findApiPlayerByKey(key) {
    for (const team of allTeams) {
        const player = getApiRosterPlayers(team).find(
            candidate => apiPlayerKey(team, candidate) === key
        );
        if (player) return { team, player };
    }
    return null;
}

function renderApiPlayerOptions(selectedKey = "") {
    return allTeams.map(team => {
        const players = getApiRosterPlayers(team);
        if (!players.length) return "";
        return `<optgroup label="${escapeMarkup(team.name)}">${players
            .map(player => {
                const key = apiPlayerKey(team, player);
                const label = player.stats_season
                    ? `${player.name} · ${formatPlayerSeasonStat(player, "pts")} PPG`
                    : player.name;
                return `<option value="${escapeMarkup(key)}" ${key === selectedKey ? "selected" : ""}>${escapeMarkup(label)}</option>`;
            }).join("")}</optgroup>`;
    }).join("");
}

function renderHubProfile() {
    const banner = document.getElementById("hubProfileBanner");
    const title = document.getElementById("hubProfileTitle");
    const styleSelect = document.getElementById("hubProfileBannerSelect");
    const titleSelect = document.getElementById("hubProfileTitleSelect");
    const studio = document.getElementById("profileStudioPanel");
    const unlocked = gamePicksState.ownedRewards.includes("profile-studio");
    if (!banner || !title || !styleSelect || !titleSelect || !studio) return;
    banner.hidden = !unlocked;
    studio.hidden = !unlocked;
    title.textContent = gamePicksState.profileTitle;
    banner.dataset.profileBanner = gamePicksState.profileBanner;
    styleSelect.value = gamePicksState.profileBanner;
    titleSelect.value = gamePicksState.profileTitle;
}

function renderPlayerSpotlight() {
    const panel = document.getElementById("playerSpotlightPanel");
    const select = document.getElementById("playerSpotlightSelect");
    const content = document.getElementById("playerSpotlightContent");
    if (!panel || !select || !content) return;
    const unlocked = gamePicksState.ownedRewards.includes("player-spotlight");
    panel.hidden = !unlocked;
    if (!unlocked) return;
    const currentKey = gamePicksState.spotlightPlayerKey;
    select.innerHTML = `<option value="">Choose a player</option>${renderApiPlayerOptions(currentKey)}`;
    const selected = findApiPlayerByKey(currentKey);
    if (!selected) {
        content.innerHTML = `<p class="hub-reward-empty">${allTeams.length
            ? "Choose a player from the live API roster to pin their season stats here."
            : "Loading player choices from the NBA roster API…"}</p>`;
        return;
    }
    const { team, player } = selected;
    const headshot = getPlayerHeadshotUrl(player.name);
    content.innerHTML = `
        <article class="hub-spotlight-card" style="--team-primary:${escapeMarkup(teamColors[team.name]?.primary || "#c9082a")}">
            <img src="${escapeMarkup(headshot)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${DEFAULT_AVATAR_FALLBACK}'">
            <div>
                <span>${escapeMarkup(team.name)} · ${escapeMarkup(player.pos || "—")}</span>
                <h3>${escapeMarkup(player.name)}</h3>
                <p>${escapeMarkup(player.stats_season || "Season stats unavailable from API")}</p>
            </div>
            <div class="hub-spotlight-card__stats">
                <span><strong>${escapeMarkup(formatPlayerSeasonStat(player, "pts"))}</strong> PPG</span>
                <span><strong>${escapeMarkup(formatPlayerSeasonStat(player, "reb"))}</strong> RPG</span>
                <span><strong>${escapeMarkup(formatPlayerSeasonStat(player, "ast"))}</strong> APG</span>
            </div>
            <button type="button" data-spotlight-open-player="${escapeMarkup(apiPlayerKey(team, player))}">View player profile</button>
        </article>
    `;
}

function renderPlayerCollection() {
    const section = document.getElementById("playerCollectionPanel");
    const select = document.getElementById("collectPlayerSelect");
    const cards = document.getElementById("playerCollectionCards");
    const button = document.getElementById("collectPlayerCard");
    const status = document.getElementById("playerCollectionStatus");
    if (!section || !select || !cards || !button || !status) return;
    const unlocked = gamePicksState.ownedRewards.includes("player-collectibles");
    section.hidden = !unlocked;
    if (!unlocked) return;
    const selectedKey = select.value;
    select.innerHTML = `<option value="">Choose a player to collect</option>${renderApiPlayerOptions(selectedKey)}`;
    const selectedPlayer = findApiPlayerByKey(select.value);
    const alreadyCollected = selectedPlayer
        && gamePicksState.playerCollection.includes(apiPlayerKey(selectedPlayer.team, selectedPlayer.player));
    button.disabled = !selectedPlayer || alreadyCollected || gamePicksState.balance < 2500;
    button.textContent = alreadyCollected ? "Already collected" : "Collect card · 2,500 tokens";
    if (!allTeams.length) {
        status.textContent = "Player cards load from the NBA teams API.";
    } else if (!gamePicksState.playerCollection.length) {
        status.textContent = "Choose an NBA player above to add your first stat card.";
    } else {
        status.textContent = `${gamePicksState.playerCollection.length} player card${gamePicksState.playerCollection.length === 1 ? "" : "s"} collected.`;
    }
    cards.innerHTML = gamePicksState.playerCollection.map(key => {
        const entry = findApiPlayerByKey(key);
        if (!entry) {
            return `<article class="hub-collectible-card"><p>Player no longer appears in the current roster API response.</p></article>`;
        }
        const { team, player } = entry;
        return `
            <article class="hub-collectible-card" style="--team-primary:${escapeMarkup(teamColors[team.name]?.primary || "#c9082a")}">
                <span class="hub-collectible-card__team">${escapeMarkup(team.name)} · ${escapeMarkup(player.stats_season || "Stats unavailable")}</span>
                <h3>${escapeMarkup(player.name)}</h3>
                <div><span>PPG <strong>${escapeMarkup(formatPlayerSeasonStat(player, "pts"))}</strong></span><span>RPG <strong>${escapeMarkup(formatPlayerSeasonStat(player, "reb"))}</strong></span><span>APG <strong>${escapeMarkup(formatPlayerSeasonStat(player, "ast"))}</strong></span></div>
                <span class="hub-collectible-card__seal">NBA API STAT CARD</span>
            </article>
        `;
    }).join("") || '<p class="hub-reward-empty">Your collection is empty. Choose a player and collect a stat card.</p>';
}

function renderFranchiseHistory() {
    const section = document.getElementById("franchiseHistoryPanel");
    const select = document.getElementById("franchiseHistoryTeam");
    const content = document.getElementById("franchiseHistoryContent");
    if (!section || !select || !content) return;
    const unlocked = gamePicksState.ownedRewards.includes("franchise-history");
    section.hidden = !unlocked;
    if (!unlocked) return;
    select.innerHTML = `<option value="">Choose a franchise</option>${allTeams.map(team =>
        `<option value="${escapeMarkup(team.name)}" ${gamePicksState.historyTeamName === team.name ? "selected" : ""}>${escapeMarkup(team.name)}</option>`
    ).join("")}`;
    const team = allTeams.find(candidate => candidate.name === gamePicksState.historyTeamName);
    if (!team) {
        content.innerHTML = `<p class="hub-reward-empty">${allTeams.length
            ? "Select a franchise to browse its records and championship years."
            : "Franchise history loads from the NBA teams API."}</p>`;
        return;
    }
    const years = Array.isArray(team.championship_years) ? team.championship_years : [];
    content.innerHTML = `
        <div class="hub-franchise-history__summary">
            <span><strong>${escapeMarkup(team.championships ?? "—")}</strong> championships</span>
            <span><strong>${escapeMarkup(team.last_season_record || "—")}</strong> last season</span>
            <span><strong>${escapeMarkup(team.conference || "—")}</strong> conference</span>
        </div>
        <h3>${escapeMarkup(team.name)} championship timeline</h3>
        <p>${years.length
            ? years.map(year => `<span class="hub-history-year">${escapeMarkup(year)}</span>`).join("")
            : "No championship years are listed in the team API response."}</p>
        <small>Team history supplied by the NBA Hub teams API.</small>
    `;
}

function renderHubRewards() {
    const root = document.documentElement;
    const hasCardStudio = gamePicksState.ownedRewards.includes("stat-card-studio");
    const cardStudio = document.getElementById("statCardStudioPanel");
    const styleSelect = document.getElementById("statCardStyleSelect");
    if (cardStudio) cardStudio.hidden = !hasCardStudio;
    if (styleSelect) styleSelect.value = gamePicksState.statCardStyle;
    root.dataset.statCardStyle = hasCardStudio
        ? gamePicksState.statCardStyle
        : "classic";
    renderHubProfile();
    renderPlayerSpotlight();
    renderPlayerCollection();
    renderFranchiseHistory();
}

function claimDailyGameTokens() {
    const today = localDateKey();
    if (gamePicksState.lastClaimDate === today) {
        setGamePicksWalletStatus("You have already claimed today’s daily tokens.", true);
        return;
    }
    const boosted = gamePicksState.dailyBoostClaims > 0;
    const claimAmount = DAILY_GAME_TOKEN_CLAIM + (boosted ? DAILY_GAME_TOKEN_BOOST : 0);
    const nextState = {
        ...gamePicksState,
        balance: gamePicksState.balance + claimAmount,
        lastClaimDate: today,
        dailyBoostClaims: Math.max(0, gamePicksState.dailyBoostClaims - (boosted ? 1 : 0))
    };
    if (saveGamePicksState(nextState)) {
        setGamePicksWalletStatus(
            boosted
                ? `3,000 virtual tokens claimed, including a 2,000-token daily boost. ${nextState.dailyBoostClaims} boosted claims remain.`
                : "1,000 virtual tokens added to your balance."
        );
        renderGamePicks();
    } else {
        setGamePicksWalletStatus(gamePicksStorageMessage, true);
    }
}

function purchaseOrEquipGamePicksReward(rewardId) {
    const reward = GAME_PICKS_REWARDS.find(item => item.id === rewardId);
    if (!reward || reward.available === false) return;
    if (reward.kind === "consumable") {
        if (gamePicksState.balance < reward.cost) {
            setGamePicksShopStatus(
                `You need ${(reward.cost - gamePicksState.balance).toLocaleString()} more tokens to buy ${reward.title}.`,
                true
            );
            return;
        }
        const amount = reward.inventoryAmount || 1;
        const count = gamePicksState[reward.inventoryKey] || 0;
        const nextState = {
            ...gamePicksState,
            balance: gamePicksState.balance - reward.cost,
            [reward.inventoryKey]: count + amount
        };
        if (saveGamePicksState(nextState)) {
            renderGamePicks();
            setGamePicksShopStatus(`${reward.title} purchased.`);
        } else {
            setGamePicksShopStatus(gamePicksStorageMessage, true);
        }
        return;
    }
    if (reward.kind === "feature") {
        const ownedRewards = gamePicksState.ownedRewards || [];
        if (ownedRewards.includes(reward.id)) return;
        if (gamePicksState.balance < reward.cost) {
            setGamePicksShopStatus(
                `You need ${(reward.cost - gamePicksState.balance).toLocaleString()} more tokens to unlock ${reward.title}.`,
                true
            );
            return;
        }
        if (saveGamePicksState({
            ...gamePicksState,
            balance: gamePicksState.balance - reward.cost,
            ownedRewards: [...ownedRewards, reward.id]
        })) {
            renderGamePicks();
            setGamePicksShopStatus(`${reward.title} unlocked. It is now available in its NBA Hub section.`);
        } else {
            setGamePicksShopStatus(gamePicksStorageMessage, true);
        }
        return;
    }
    if (reward.id === "team-colors" && !gamePicksState.teamColorsTeam) {
        setGamePicksShopStatus("Choose your favorite NBA team before unlocking or equipping Team Colors.", true);
        return;
    }
    const ownedRewards = gamePicksState.ownedRewards || [];
    if (ownedRewards.includes(reward.id)) {
        const isEquipped = reward.kind === "arena-theme"
            ? gamePicksState.arenaStyle === reward.arenaStyle
            : gamePicksState.equippedRewardId === reward.id;
        if (isEquipped) return;
        const nextState = {
            ...gamePicksState,
            equippedRewardId: reward.id,
            ...(reward.kind === "arena-theme" ? { arenaStyle: reward.arenaStyle } : {}),
            ...(reward.id === "team-colors" ? { arenaStyle: "franchise" } : {})
        };
        if (saveGamePicksState(nextState)) {
            renderGamePicks();
            setGamePicksShopStatus(`${reward.title} equipped.`);
        } else {
            setGamePicksShopStatus(gamePicksStorageMessage, true);
        }
        return;
    }
    if (gamePicksState.balance < reward.cost) {
        setGamePicksShopStatus(
            `You need ${(reward.cost - gamePicksState.balance).toLocaleString()} more tokens to unlock ${reward.title}.`,
            true
        );
        return;
    }
    const nextState = {
        ...gamePicksState,
        balance: gamePicksState.balance - reward.cost,
        ownedRewards: [...ownedRewards, reward.id],
        equippedRewardId: reward.id,
        ...(reward.kind === "arena-theme" ? { arenaStyle: reward.arenaStyle } : {}),
        ...(reward.id === "team-colors" ? { arenaStyle: "franchise" } : {})
    };
    if (saveGamePicksState(nextState)) {
        renderGamePicks();
        setGamePicksShopStatus(`${reward.title} unlocked and equipped.`);
    } else {
        setGamePicksShopStatus(gamePicksStorageMessage, true);
    }
}

function setGamePicksShopStatus(message, isError = false) {
    const status = document.getElementById("gamePicksShopStatus");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("is-warning", isError);
}

function renderGamePicksShop() {
    const section = document.getElementById("gamePicksSection");
    const grid = document.getElementById("gamePicksRewardGrid");
    const title = document.getElementById("gamePicksRewardTitle");
    const resetButton = document.getElementById("resetGamePicksReward");
    if (!section || !grid || !title || !resetButton) return;

    const activeSiteTheme = applyGamePicksSiteTheme();
    const equipped = GAME_PICKS_REWARDS.find(
        reward => reward.id === gamePicksState.equippedRewardId
    );
    section.dataset.rewardStyle = equipped?.style || "default";
    const teamColorSelection = gamePicksState.teamColorsTeam;
    const selectedTeamColors = teamColors[teamColorSelection];
    section.dataset.arenaStyle = activeSiteTheme;
    if (gamePicksState.ownedRewards.includes("team-colors") && selectedTeamColors) {
        section.style.setProperty("--game-picks-team-primary", selectedTeamColors.primary);
        section.style.setProperty("--game-picks-team-dark", selectedTeamColors.dark);
        section.dataset.rewardTeam = teamColorSelection;
    } else {
        section.style.removeProperty("--game-picks-team-primary");
        section.style.removeProperty("--game-picks-team-dark");
        delete section.dataset.rewardTeam;
    }
    title.textContent = equipped
        ? `${equipped.title}${equipped.id === "team-colors" && teamColorSelection ? ` · ${teamColorSelection}` : ""}`
        : "";
    title.hidden = !equipped;
    resetButton.hidden = !equipped;

    grid.innerHTML = GAME_PICKS_REWARDS
        .filter(reward => reward.available !== false)
        .map(reward => {
        if (reward.kind === "consumable") {
            const count = gamePicksState[reward.inventoryKey] || 0;
            const canBuy = gamePicksState.balance >= reward.cost && !gamePicksStorageMessage;
            return `
                <article class="game-picks-reward-card game-picks-reward-card--perk">
                    <span class="game-picks-reward-card__category">${escapeMarkup(reward.category)}</span>
                    <h4>${escapeMarkup(reward.title)}</h4>
                    <p>${escapeMarkup(reward.description)}</p>
                    <span class="game-picks-reward-inventory">${count} ${escapeMarkup(reward.inventoryLabel)} available</span>
                    <button type="button" data-game-picks-reward="${escapeMarkup(reward.id)}" ${canBuy ? "" : "disabled"}>
                        ${escapeMarkup(reward.purchaseLabel)} · ${reward.cost.toLocaleString()}
                    </button>
                </article>
            `;
        }
        const owned = (gamePicksState.ownedRewards || []).includes(reward.id);
        if (reward.kind === "feature") {
            return `
                <article class="game-picks-reward-card game-picks-reward-card--feature${owned ? " is-owned" : ""}">
                    <span class="game-picks-reward-card__category">${escapeMarkup(reward.category)}</span>
                    <h4>${escapeMarkup(reward.title)}</h4>
                    <p>${escapeMarkup(reward.description)}</p>
                    <button type="button" data-game-picks-reward="${escapeMarkup(reward.id)}" ${owned || gamePicksState.balance < reward.cost || Boolean(gamePicksStorageMessage) ? "disabled" : ""}>
                        ${owned ? "Unlocked · see hub section" : `Unlock · ${reward.cost.toLocaleString()}`}
                    </button>
                </article>
            `;
        }
        const isEquipped = reward.kind === "arena-theme"
            ? gamePicksState.arenaStyle === reward.arenaStyle
            : gamePicksState.equippedRewardId === reward.id;
        const disabled = isEquipped || Boolean(gamePicksStorageMessage)
            || (!owned && gamePicksState.balance < reward.cost)
            || (reward.id === "team-colors" && !teamColorSelection);
        const buttonLabel = isEquipped
            ? "Equipped"
            : owned
                ? "Equip"
                : `Unlock · ${reward.cost.toLocaleString()}`;
        const teamSelector = reward.id === "team-colors"
            ? `
                <label class="game-picks-team-selector">
                    Your team
                    <select data-game-picks-team-select aria-label="Choose your favorite NBA team">
                        <option value="">Choose a team</option>
                        ${Object.keys(teamColors).sort().map(teamName => `
                            <option value="${escapeMarkup(teamName)}" ${teamName === teamColorSelection ? "selected" : ""}>${escapeMarkup(teamName)}</option>
                        `).join("")}
                    </select>
                </label>
            `
            : "";
        return `
            <article class="game-picks-reward-card${owned ? " is-owned" : ""}${isEquipped ? " is-equipped" : ""}">
                <span class="game-picks-reward-card__category">${escapeMarkup(reward.category)}</span>
                <h4>${escapeMarkup(reward.title)}</h4>
                <p>${escapeMarkup(reward.description)}</p>
                ${teamSelector}
                <button type="button" data-game-picks-reward="${escapeMarkup(reward.id)}" ${disabled ? "disabled" : ""}>
                    ${buttonLabel}
                </button>
            </article>
        `;
    }).join("");
}

async function loadGamePicksSchedule() {
    if (gamePicksScheduleRequest) gamePicksScheduleRequest.abort();
    const controller = new AbortController();
    gamePicksScheduleRequest = controller;
    const season = currentNbaSeason();
    try {
        const response = await fetch(
            `${API_URL}/api/v1/schedule?season=${encodeURIComponent(season)}`,
            { headers: { "x-api-key": API_KEY }, signal: controller.signal }
        );
        if (!response.ok) throw new Error(`Current NBA schedule request failed (${response.status}).`);
        const payload = await response.json();
        if (payload.season !== season || !Array.isArray(payload.games)) {
            throw new Error("The API did not return a valid schedule for the current NBA season.");
        }
        gamePicksScheduleGames = payload.games.map(scheduleGameInPhilippines);
        gamePicksScheduleMessage = "";
        settleFranchiseChallenges();
        settleGamePicksBets();
        renderFranchiseChallenge();
        renderGamePicks();
    } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Game Picks schedule load failed:", error);
        gamePicksScheduleMessage = error instanceof Error
            ? error.message
            : "The current NBA schedule could not be loaded for bet settlement.";
        renderGamePicks();
    } finally {
        if (gamePicksScheduleRequest === controller) gamePicksScheduleRequest = null;
    }
}

async function loadGamePicksOdds() {
    const requestSequence = ++gamePicksRequestSequence;
    const status = document.getElementById("gamePicksOddsStatus");
    if (status) status.textContent = "Refreshing real NBA moneyline odds…";
    try {
        const response = await fetch(`${API_URL}/api/v1/odds`, {
            headers: { "x-api-key": API_KEY }
        });
        let payload;
        try {
            payload = await response.json();
        } catch {
            throw new Error("The odds service returned an invalid response.");
        }
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error(
                    "Odds are not enabled in this deployment yet. Deploy the backend version with the /api/v1/odds route."
                );
            }
            throw new Error(payload.detail || `Odds request failed (${response.status}).`);
        }
        if (
            !payload
            || !["fresh", "stale", "unavailable"].includes(payload.status)
            || !Array.isArray(payload.events)
        ) {
            throw new Error("The odds service returned an unsupported response.");
        }
        if (requestSequence !== gamePicksRequestSequence) return;
        gamePicksOddsSnapshot = payload;
        lastGamePicksOddsRefreshAt = Date.now();
        updateGamePicksSlipQuotes();
        renderGamePicks();
    } catch (error) {
        if (requestSequence !== gamePicksRequestSequence) return;
        console.error("Live NBA odds refresh failed:", error);
        gamePicksOddsSnapshot = {
            status: "unavailable",
            source: "The Odds API",
            last_updated: null,
            message: error instanceof Error ? error.message : "Live odds could not be loaded.",
            events: []
        };
        renderGamePicks();
    }
}

function findGamePicksScheduleGame(event) {
    const eventTime = Date.parse(event?.commence_time || "");
    if (!Number.isFinite(eventTime)) return null;
    const eventDate = dateKeyInPhilippines(new Date(eventTime));
    const matchup = gamePicksMatchupKey(event.home, event.away);
    return gamePicksScheduleGames.find(game => {
        if (gamePicksMatchupKey(game.home, game.away) !== matchup) return false;
        const gameDay = Date.parse(`${String(game.date || "").slice(0, 10)}T12:00:00Z`);
        const eventDay = Date.parse(`${eventDate}T12:00:00Z`);
        return Number.isFinite(gameDay) && Math.abs(gameDay - eventDay) <= 24 * 60 * 60 * 1000;
    }) || null;
}

function gamePicksQuoteForTeam(event, teamName) {
    if (gamePicksTeamKey(event?.home) === gamePicksTeamKey(teamName)) return event.home_odds;
    if (gamePicksTeamKey(event?.away) === gamePicksTeamKey(teamName)) return event.away_odds;
    return null;
}

function updateGamePicksSlipQuotes() {
    if (gamePicksOddsSnapshot?.status !== "fresh" || !gamePicksState.slip.length) return;
    const eventsById = new Map(gamePicksOddsSnapshot.events.map(event => [event.id, event]));
    let changed = false;
    const slip = gamePicksState.slip.map(leg => {
        const event = eventsById.get(leg.event_id);
        const quote = event && gamePicksQuoteForTeam(event, leg.selected_team);
        if (!event || !quote || !gamePicksQuoteIsFresh(quote)) return leg;
        if (
            leg.american_odds === quote.american
            && leg.decimal_odds === quote.decimal
            && leg.bookmaker === quote.bookmaker
            && leg.odds_updated_at === quote.last_updated
        ) return leg;
        changed = true;
        return {
            ...leg,
            american_odds: quote.american,
            decimal_odds: quote.decimal,
            bookmaker: quote.bookmaker,
            odds_updated_at: quote.last_updated
        };
    });
    if (changed && !saveGamePicksState({ ...gamePicksState, slip })) {
        setGamePicksWalletStatus(gamePicksStorageMessage, true);
    }
}

function gamePicksLegIsBettable(leg) {
    if (gamePicksOddsSnapshot?.status !== "fresh") return false;
    const event = gamePicksOddsSnapshot.events.find(item => item.id === leg.event_id);
    const quote = event && gamePicksQuoteForTeam(event, leg.selected_team);
    const scheduleGame = event && findGamePicksScheduleGame(event);
    return Boolean(
        event
        && Date.parse(event.commence_time) > Date.now()
        && scheduleGame
        && Number(scheduleGame.status_code) === 1
        && quote
        && gamePicksQuoteIsFresh(quote)
    );
}

function toggleGamePicksLeg(eventId, selectedTeam) {
    const event = gamePicksOddsSnapshot?.events.find(item => item.id === eventId);
    if (!event) return;
    const existing = gamePicksState.slip.find(leg => leg.event_id === eventId);
    if (existing?.selected_team === selectedTeam) {
        const slip = gamePicksState.slip.filter(leg => leg.event_id !== eventId);
        if (saveGamePicksState({ ...gamePicksState, slip })) renderGamePicks();
        return;
    }
    const quote = gamePicksQuoteForTeam(event, selectedTeam);
    const scheduleGame = findGamePicksScheduleGame(event);
    if (
        gamePicksOddsSnapshot.status !== "fresh"
        || Date.parse(event.commence_time) <= Date.now()
        || !scheduleGame
        || Number(scheduleGame.status_code) !== 1
        || !quote
        || !gamePicksQuoteIsFresh(quote)
    ) {
        setGamePicksWalletStatus(
            "This game does not have fresh, verified pre-game odds and a matching NBA schedule entry.",
            true
        );
        return;
    }

    const leg = {
        event_id: event.id,
        game_id: scheduleGame.id,
        commence_time: event.commence_time,
        home: event.home,
        away: event.away,
        selected_team: selectedTeam,
        american_odds: quote.american,
        decimal_odds: quote.decimal,
        bookmaker: quote.bookmaker,
        odds_updated_at: quote.last_updated,
        result: "pending"
    };
    const slip = [
        ...gamePicksState.slip.filter(item => item.event_id !== eventId),
        leg
    ].sort((left, right) => left.commence_time.localeCompare(right.commence_time));
    if (saveGamePicksState({ ...gamePicksState, slip })) {
        setGamePicksWalletStatus("");
        renderGamePicks();
    } else {
        setGamePicksWalletStatus(gamePicksStorageMessage, true);
    }
}

function gamePicksSlipDecimalOdds() {
    return gamePicksState.slip.reduce(
        (combined, leg) => combined * Number(leg.decimal_odds),
        1
    );
}

function renderGamePicksSlip() {
    const slipList = document.getElementById("gamePicksSlipList");
    const slipCount = document.getElementById("gamePicksSlipCount");
    const combinedOddsElement = document.getElementById("gamePicksCombinedOdds");
    const potentialReturnElement = document.getElementById("gamePicksPotentialReturn");
    const placeButton = document.getElementById("placeGamePicksBet");
    const clearButton = document.getElementById("clearGamePicksSlip");
    const stakeInput = document.getElementById("gamePicksStake");
    const insuranceCheckbox = document.getElementById("gamePicksUseInsurance");
    const insuranceCount = document.getElementById("gamePicksInsuranceCount");
    const payoutBoostCheckbox = document.getElementById("gamePicksUsePayoutBoost");
    const payoutBoostCount = document.getElementById("gamePicksPayoutBoostCount");
    if (!slipList || !slipCount || !placeButton || !clearButton || !stakeInput) return;

    const slip = gamePicksState.slip;
    slipCount.textContent = `${slip.length} pick${slip.length === 1 ? "" : "s"}`;
    slipList.innerHTML = slip.length
        ? slip.map(leg => `
            <article class="game-picks-slip-leg">
                <div>
                    <strong>${escapeMarkup(leg.selected_team)}</strong>
                    <span>${escapeMarkup(leg.away)} at ${escapeMarkup(leg.home)}</span>
                    <small>${escapeMarkup(formatGamePicksMultiplier(leg.decimal_odds))} multiplier · updated ${escapeMarkup(formatGamePicksQuoteTime({ last_updated: leg.odds_updated_at }))} PHT</small>
                </div>
                <button type="button" data-game-picks-remove="${escapeMarkup(leg.event_id)}" aria-label="Remove ${escapeMarkup(leg.selected_team)} pick">Remove</button>
            </article>
        `).join("")
        : '<p class="game-picks-empty">Choose a team from one or more upcoming games to build your slip.</p>';

    const combinedDecimal = gamePicksSlipDecimalOdds();
    const stake = Number(stakeInput.value);
    const validStake = Number.isSafeInteger(stake) && stake > 0 && stake <= gamePicksState.balance;
    const canPlace = slip.length > 0
        && validStake
        && slip.every(gamePicksLegIsBettable);
    if (insuranceCount) {
        const count = gamePicksState.parlayInsuranceCount || 0;
        insuranceCount.textContent = `${count} ${count === 1 ? "available" : "available"}`;
    }
    if (insuranceCheckbox) {
        insuranceCheckbox.disabled = slip.length < 2 || !(gamePicksState.parlayInsuranceCount > 0);
        if (slip.length < 2 || gamePicksState.parlayInsuranceCount < 1) {
            insuranceCheckbox.checked = false;
        }
    }
    if (payoutBoostCount) {
        const count = gamePicksState.payoutBoostCount || 0;
        payoutBoostCount.textContent = `${count} available`;
    }
    if (payoutBoostCheckbox) {
        payoutBoostCheckbox.disabled = slip.length < 1 || !(gamePicksState.payoutBoostCount > 0);
        if (slip.length < 1 || gamePicksState.payoutBoostCount < 1) {
            payoutBoostCheckbox.checked = false;
        }
    }
    if (combinedOddsElement) {
        combinedOddsElement.textContent = slip.length
            ? formatGamePicksMultiplier(combinedDecimal)
            : "—";
    }
    if (potentialReturnElement) {
        potentialReturnElement.textContent = validStake && slip.length
            ? `${Math.round(stake * combinedDecimal * (payoutBoostCheckbox?.checked ? 2 : 1)).toLocaleString()} tokens`
            : "—";
    }
    placeButton.disabled = !canPlace;
    placeButton.textContent = slip.length > 1 ? "Place parlay" : "Place pick";
    clearButton.disabled = slip.length === 0;
}

function placeGamePicksWager() {
    const stake = Number(document.getElementById("gamePicksStake")?.value);
    if (!Number.isSafeInteger(stake) || stake <= 0) {
        setGamePicksWalletStatus("Enter a whole-number token stake greater than zero.", true);
        return;
    }
    if (stake > gamePicksState.balance) {
        setGamePicksWalletStatus("Your token balance is too low for this stake.", true);
        return;
    }
    if (
        gamePicksState.slip.length === 0
        || !gamePicksState.slip.every(gamePicksLegIsBettable)
    ) {
        setGamePicksWalletStatus("Refresh and review every leg before placing this pick.", true);
        return;
    }
    const useInsurance = Boolean(document.getElementById("gamePicksUseInsurance")?.checked);
    const usePayoutBoost = Boolean(document.getElementById("gamePicksUsePayoutBoost")?.checked);
    if (useInsurance && (
        gamePicksState.slip.length < 2
        || gamePicksState.parlayInsuranceCount < 1
    )) {
        setGamePicksWalletStatus("Parlay Safety Net requires an available coupon and at least two picks.", true);
        return;
    }
    if (usePayoutBoost && gamePicksState.payoutBoostCount < 1) {
        setGamePicksWalletStatus("Buy a 2× Payout Boost before applying it to a ticket.", true);
        return;
    }

    const combinedDecimal = gamePicksSlipDecimalOdds();
    const bet = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        legs: gamePicksState.slip.map(leg => ({ ...leg })),
        stake,
        combined_decimal_odds: combinedDecimal,
        insured: useInsurance,
        payout_boosted: usePayoutBoost,
        status: "open",
        payout: null,
        placed_at: new Date().toISOString(),
        settled_at: null
    };
    const nextState = {
        ...gamePicksState,
        balance: gamePicksState.balance - stake,
        parlayInsuranceCount: (gamePicksState.parlayInsuranceCount || 0) - (useInsurance ? 1 : 0),
        payoutBoostCount: (gamePicksState.payoutBoostCount || 0) - (usePayoutBoost ? 1 : 0),
        slip: [],
        bets: [bet, ...gamePicksState.bets]
    };
    if (saveGamePicksState(nextState)) {
        setGamePicksWalletStatus(
            `${bet.legs.length > 1 ? "Parlay" : "Pick"} placed for ${stake.toLocaleString()} tokens.`
        );
        renderGamePicks();
    } else {
        setGamePicksWalletStatus(gamePicksStorageMessage, true);
    }
}

function settleGamePicksBets() {
    if (!gamePicksState.bets.some(bet => bet.status === "open")) return;
    let balance = gamePicksState.balance;
    let changed = false;
    const bets = gamePicksState.bets.map(bet => {
        if (bet.status !== "open") return bet;
        const legs = bet.legs.map(leg => {
            if (leg.result !== "pending") return leg;
            const game = gamePicksScheduleGames.find(item => item.id === leg.game_id)
                || gamePicksScheduleGames.find(item =>
                    gamePicksMatchupKey(item.home, item.away)
                        === gamePicksMatchupKey(leg.home, leg.away)
                    && Math.abs(
                        Date.parse(`${String(item.date || "").slice(0, 10)}T12:00:00Z`)
                        - Date.parse(`${dateKeyInPhilippines(new Date(leg.commence_time))}T12:00:00Z`)
                    ) <= 24 * 60 * 60 * 1000
                );
            if (!game || !isCompletedScheduleGame(game)) return leg;
            const homeScore = Number(game.home_score);
            const awayScore = Number(game.away_score);
            if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return leg;
            const winner = homeScore === awayScore
                ? null
                : homeScore > awayScore ? game.home : game.away;
            changed = true;
            return {
                ...leg,
                result: winner == null
                    ? "push"
                    : gamePicksTeamKey(winner) === gamePicksTeamKey(leg.selected_team)
                        ? "won"
                        : "lost"
            };
        });
        const losses = legs.filter(leg => leg.result === "lost").length;
        const hasPendingLegs = legs.some(leg => leg.result === "pending");
        if (losses && (!bet.insured || losses > 1)) {
            return { ...bet, legs, status: "lost", payout: 0, settled_at: new Date().toISOString() };
        }
        if (bet.insured && losses === 1 && !hasPendingLegs) {
            balance += bet.stake;
            changed = true;
            return {
                ...bet,
                legs,
                status: "protected",
                payout: bet.stake,
                settled_at: new Date().toISOString()
            };
        }
        if (legs.every(leg => leg.result !== "pending")) {
            const winningLegs = legs.filter(leg => leg.result === "won");
            const payout = winningLegs.length
                ? Math.round(bet.stake * (bet.payout_boosted ? 2 : 1) * winningLegs.reduce(
                    (combined, leg) => combined * Number(leg.decimal_odds),
                    1
                ))
                : bet.stake;
            balance += payout;
            changed = true;
            return {
                ...bet,
                legs,
                status: winningLegs.length ? "won" : "push",
                payout,
                settled_at: new Date().toISOString()
            };
        }
        return { ...bet, legs };
    });
    if (!changed) return;
    if (saveGamePicksState({ ...gamePicksState, balance, bets })) {
        const latest = bets.find(bet => bet.status !== "open");
        if (latest) {
            const outcome = latest.status === "won"
                ? `A Game Picks wager won ${latest.payout.toLocaleString()} tokens.`
                : latest.status === "push"
                    ? `A Game Picks wager pushed and returned ${latest.payout.toLocaleString()} tokens.`
                    : "A Game Picks parlay lost.";
            setGamePicksWalletStatus(outcome);
        }
    } else {
        setGamePicksWalletStatus(gamePicksStorageMessage, true);
    }
}

function renderGamePicksBets() {
    const list = document.getElementById("gamePicksBetsList");
    if (!list) return;
    const bets = gamePicksState.bets.slice(0, 25);
    if (!bets.length) {
        list.innerHTML = '<p class="game-picks-empty">Your placed picks will appear here.</p>';
        return;
    }
    list.innerHTML = bets.map(bet => {
        const statusLabel = bet.status === "open"
            ? "Open"
            : bet.status === "won"
                ? `Won · ${Number(bet.payout || 0).toLocaleString()} returned`
                : bet.status === "protected"
                    ? `Safety Net · ${Number(bet.payout || 0).toLocaleString()} stake returned`
                : bet.status === "push"
                    ? `Push · ${Number(bet.payout || 0).toLocaleString()} returned`
                    : "Lost";
        return `
            <article class="game-picks-bet-card">
                <div class="game-picks-bet-card__header">
                    <strong>${bet.legs.length > 1 ? `${bet.legs.length}-leg parlay` : "Single pick"}</strong>
                    <span class="game-picks-bet-status is-${escapeMarkup(bet.status)}">${escapeMarkup(statusLabel)}</span>
                </div>
                <ul>
                    ${bet.legs.map(leg => `
                        <li>
                            <span>${escapeMarkup(leg.selected_team)} ${escapeMarkup(formatGamePicksMultiplier(leg.decimal_odds))}</span>
                            <span>${escapeMarkup(leg.result === "pending" ? "Pending" : leg.result)}</span>
                        </li>
                    `).join("")}
                </ul>
                ${bet.insured ? '<span class="game-picks-insured-label">Parlay Safety Net used</span>' : ""}
                ${bet.payout_boosted ? '<span class="game-picks-boosted-label">2× Payout Boost used</span>' : ""}
                <p>${Number(bet.stake).toLocaleString()} tokens · Combined ${escapeMarkup(formatGamePicksMultiplier(bet.combined_decimal_odds))} · Potential return ${Math.round(bet.stake * bet.combined_decimal_odds * (bet.payout_boosted ? 2 : 1)).toLocaleString()} tokens</p>
            </article>
        `;
    }).join("");
}

function renderGamePicksGames() {
    const grid = document.getElementById("gamePicksGamesGrid");
    if (!grid) return;
    const snapshot = gamePicksOddsSnapshot;
    const events = (snapshot?.events || [])
        .filter(event => Date.parse(event.commence_time) > Date.now())
        .sort((left, right) => Date.parse(left.commence_time) - Date.parse(right.commence_time))
        .slice(0, 12);
    if (!events.length) {
        const message = snapshot?.message
            || (snapshot?.status === "unavailable"
                ? "Live odds are unavailable. Configure the odds feed to see verified pre-game prices."
                : "There are no upcoming NBA odds available right now.");
        grid.innerHTML = `<p class="game-picks-empty">${escapeMarkup(message)}</p>`;
        return;
    }

    grid.innerHTML = events.map(event => {
        const scheduleGame = findGamePicksScheduleGame(event);
        const selectedLeg = gamePicksState.slip.find(leg => leg.event_id === event.id);
        const startLabel = new Date(event.commence_time).toLocaleString("en-PH", {
            timeZone: "Asia/Manila",
            dateStyle: "medium",
            timeStyle: "short"
        });
        const pickOptions = [event.away, event.home].map(teamName => {
            const quote = gamePicksQuoteForTeam(event, teamName);
            const selected = selectedLeg?.selected_team === teamName;
            const available = Boolean(
                gamePicksOddsSnapshot.status === "fresh"
                && Date.parse(event.commence_time) > Date.now()
                && scheduleGame
                && Number(scheduleGame.status_code) === 1
                && quote
                && gamePicksQuoteIsFresh(quote)
            );
            const quoteText = quote
                ? formatGamePicksMultiplier(quote.decimal)
                : "No current price";
            return `
                <button type="button"
                    class="game-picks-option${selected ? " is-selected" : ""}"
                    data-game-picks-event="${escapeMarkup(event.id)}"
                    data-game-picks-team="${escapeMarkup(teamName)}"
                    ${!available && !selected ? "disabled" : ""}>
                    <span>${escapeMarkup(teamName)}</span>
                    <strong>${escapeMarkup(quoteText)}</strong>
                    <small>${quote ? `Updated ${escapeMarkup(formatGamePicksQuoteTime(quote))} PHT` : "Price unavailable"} · ${selected ? "Selected" : "Add pick"}</small>
                </button>
            `;
        }).join("");
        const disabledReason = !scheduleGame
            ? "NBA schedule match unavailable; picks are disabled."
            : Number(scheduleGame.status_code) !== 1
                ? "This game is no longer pre-game."
                : gamePicksOddsSnapshot.status !== "fresh"
                    ? "Odds are stale; refresh before selecting."
                    : !gamePicksQuoteIsFresh(event.home_odds)
                        || !gamePicksQuoteIsFresh(event.away_odds)
                        ? "One or more sportsbook prices are missing or stale."
                        : "";
        const favoriteTeam = gamePicksState.ownedRewards.includes("team-colors")
            ? gamePicksState.teamColorsTeam
            : "";
        const featuresFavorite = Boolean(
            favoriteTeam
            && (
                gamePicksTeamKey(event.home) === gamePicksTeamKey(favoriteTeam)
                || gamePicksTeamKey(event.away) === gamePicksTeamKey(favoriteTeam)
            )
        );
        const challengePick = featuresFavorite
            ? gamePicksState.franchiseChallengePicks.find(pick => pick.event_id === event.id)
            : null;
        const challengeAvailable = Boolean(
            featuresFavorite
            && scheduleGame
            && Number(scheduleGame.status_code) === 1
            && Date.parse(event.commence_time) > Date.now()
        );
        const challengeResult = challengePick
            ? challengePick.result === "pending"
                ? `Locked: ${challengePick.team} to ${challengePick.prediction === "win" ? "win" : "lose"}`
                : challengePick.result === "correct"
                    ? `Correct · +${Number(challengePick.payout).toLocaleString()} tokens`
                    : "Incorrect · streak reset"
            : "";
        const challengeControls = featuresFavorite
            ? `
                <div class="game-picks-franchise-challenge">
                    <strong>Franchise Challenge</strong>
                    ${challengePick
                        ? `<p>${escapeMarkup(challengeResult)}</p>`
                        : `
                            <p>Will ${escapeMarkup(favoriteTeam)} win this game?</p>
                            <div>
                                <button type="button" data-game-picks-challenge="${escapeMarkup(event.id)}" data-game-picks-prediction="win" ${challengeAvailable ? "" : "disabled"}>Win</button>
                                <button type="button" data-game-picks-challenge="${escapeMarkup(event.id)}" data-game-picks-prediction="loss" ${challengeAvailable ? "" : "disabled"}>Lose</button>
                            </div>
                        `}
                </div>
            `
            : "";
        return `
            <article class="game-picks-game-card"${featuresFavorite ? ' data-favorite-team="true"' : ""}>
                <div class="game-picks-game-card__meta">
                    <span>${escapeMarkup(startLabel)} PHT</span>
                    ${featuresFavorite
                        ? `<span class="game-picks-favorite-tag">Your team · ${escapeMarkup(favoriteTeam)}</span>`
                        : "<span>Moneyline</span>"}
                </div>
                <h3>${escapeMarkup(event.away)} <span>at</span> ${escapeMarkup(event.home)}</h3>
                <div class="game-picks-options">${pickOptions}</div>
                ${challengeControls}
                ${disabledReason ? `<p class="game-picks-game-card__notice">${escapeMarkup(disabledReason)}</p>` : ""}
            </article>
        `;
    }).join("");
}

function renderGamePicks() {
    const balance = document.getElementById("gamePicksBalance");
    const claimButton = document.getElementById("claimDailyGameTokens");
    const oddsStatus = document.getElementById("gamePicksOddsStatus");
    if (balance) balance.textContent = gamePicksState.balance.toLocaleString();
    if (claimButton) {
        const claimed = gamePicksState.lastClaimDate === localDateKey();
        claimButton.disabled = claimed || Boolean(gamePicksStorageMessage);
        claimButton.textContent = claimed
            ? "Claimed today"
            : gamePicksState.dailyBoostClaims > 0
                ? "Claim 3,000 tokens · boosted"
                : "Claim 1,000 daily tokens";
    }
    if (gamePicksStorageMessage) {
        setGamePicksWalletStatus(gamePicksStorageMessage, true);
    }
    if (oddsStatus) {
        const checkedAt = gamePicksOddsSnapshot?.last_updated
            ? new Date(gamePicksOddsSnapshot.last_updated).toLocaleTimeString("en-PH", {
                timeZone: "Asia/Manila",
                hour: "numeric",
                minute: "2-digit"
            })
            : "";
        if (gamePicksOddsSnapshot?.status === "fresh") {
            oddsStatus.textContent = `Live odds · checked ${checkedAt || "just now"} PHT · refreshes every 5 minutes.`;
        } else if (gamePicksOddsSnapshot?.status === "stale") {
            oddsStatus.textContent = `${gamePicksOddsSnapshot.message || "Showing stale odds"}${checkedAt ? ` Last checked ${checkedAt} PHT.` : ""}`;
        } else if (gamePicksOddsSnapshot?.status === "unavailable") {
            oddsStatus.textContent = gamePicksOddsSnapshot.message || "Real NBA odds are currently unavailable.";
        } else {
            oddsStatus.textContent = "Loading real NBA moneyline odds…";
        }
        oddsStatus.classList.toggle("is-warning", gamePicksOddsSnapshot?.status !== "fresh");
    }
    if (gamePicksScheduleMessage) {
        setGamePicksWalletStatus(gamePicksScheduleMessage, true);
    }
    settleFranchiseChallenges();
    settleGamePicksBets();
    renderFranchiseChallenge();
    renderGamePicksSlip();
    renderGamePicksGames();
    renderGamePicksBets();
    renderGamePicksShop();
    renderHubRewards();
}

function initializeGamePicks() {
    loadGamePicksState();
    document.getElementById("claimDailyGameTokens").addEventListener("click", claimDailyGameTokens);
    document.getElementById("refreshGamePicksOdds").addEventListener("click", loadGamePicksOdds);
    document.getElementById("placeGamePicksBet").addEventListener("click", placeGamePicksWager);
    document.getElementById("clearGamePicksSlip").addEventListener("click", () => {
        if (saveGamePicksState({ ...gamePicksState, slip: [] })) renderGamePicks();
        else setGamePicksWalletStatus(gamePicksStorageMessage, true);
    });
    document.getElementById("gamePicksStake").addEventListener("input", renderGamePicksSlip);
    document.getElementById("gamePicksUseInsurance").addEventListener("change", renderGamePicksSlip);
    document.getElementById("gamePicksUsePayoutBoost").addEventListener("change", renderGamePicksSlip);
    document.getElementById("gamePicksGamesGrid").addEventListener("click", event => {
        const challengeButton = event.target.closest("[data-game-picks-challenge]");
        if (challengeButton) {
            setFranchiseChallengePick(
                challengeButton.dataset.gamePicksChallenge,
                challengeButton.dataset.gamePicksPrediction
            );
            return;
        }
        const option = event.target.closest("[data-game-picks-event]");
        if (option) {
            toggleGamePicksLeg(option.dataset.gamePicksEvent, option.dataset.gamePicksTeam);
        }
    });
    document.getElementById("gamePicksSlipList").addEventListener("click", event => {
        const removeButton = event.target.closest("[data-game-picks-remove]");
        if (!removeButton) return;
        const slip = gamePicksState.slip.filter(
            leg => leg.event_id !== removeButton.dataset.gamePicksRemove
        );
        if (saveGamePicksState({ ...gamePicksState, slip })) renderGamePicks();
        else setGamePicksWalletStatus(gamePicksStorageMessage, true);
    });
    document.getElementById("gamePicksRewardGrid").addEventListener("click", event => {
        const button = event.target.closest("[data-game-picks-reward]");
        if (button) purchaseOrEquipGamePicksReward(button.dataset.gamePicksReward);
    });
    document.getElementById("gamePicksRewardGrid").addEventListener("change", event => {
        const select = event.target.closest("[data-game-picks-team-select]");
        if (!select) return;
        const teamName = select.value;
        if (!Object.prototype.hasOwnProperty.call(teamColors, teamName)) {
            renderGamePicksShop();
            return;
        }
        if (saveGamePicksState({ ...gamePicksState, teamColorsTeam: teamName })) {
            renderGamePicksShop();
            renderGamePicksGames();
            renderFranchiseChallenge();
            setGamePicksShopStatus(
                gamePicksState.ownedRewards.includes("team-colors")
                    ? `${teamName} colors selected.`
                    : `${teamName} selected. Unlock Team Colors to apply them.`
            );
        } else {
            setGamePicksShopStatus(gamePicksStorageMessage, true);
        }
    });
    document.getElementById("playerSpotlightSelect").addEventListener("change", event => {
        const key = event.target.value;
        if (key && !findApiPlayerByKey(key)) {
            renderPlayerSpotlight();
            return;
        }
        if (saveGamePicksState({ ...gamePicksState, spotlightPlayerKey: key })) {
            renderPlayerSpotlight();
        } else {
            setGamePicksWalletStatus(gamePicksStorageMessage, true);
        }
    });
    document.getElementById("playerSpotlightContent").addEventListener("click", event => {
        const button = event.target.closest("[data-spotlight-open-player]");
        if (!button) return;
        const entry = findApiPlayerByKey(button.dataset.spotlightOpenPlayer);
        if (entry) openPlayerModal(entry.player, entry.team);
    });
    document.getElementById("collectPlayerSelect").addEventListener("change", event => {
        const selected = findApiPlayerByKey(event.target.value);
        const alreadyCollected = selected
            && gamePicksState.playerCollection.includes(apiPlayerKey(selected.team, selected.player));
        const button = document.getElementById("collectPlayerCard");
        button.disabled = !selected || Boolean(alreadyCollected) || gamePicksState.balance < 2500;
        button.textContent = alreadyCollected ? "Already collected" : "Collect card · 2,500 tokens";
    });
    document.getElementById("collectPlayerCard").addEventListener("click", () => {
        const select = document.getElementById("collectPlayerSelect");
        const selected = findApiPlayerByKey(select.value);
        if (!selected) {
            document.getElementById("playerCollectionStatus").textContent =
                "Choose a current player from the NBA roster API first.";
            return;
        }
        const key = apiPlayerKey(selected.team, selected.player);
        if (gamePicksState.playerCollection.includes(key)) return;
        if (gamePicksState.balance < 2500) {
            document.getElementById("playerCollectionStatus").textContent =
                "You need 2,500 tokens to collect this player card.";
            return;
        }
        if (saveGamePicksState({
            ...gamePicksState,
            balance: gamePicksState.balance - 2500,
            playerCollection: [...gamePicksState.playerCollection, key]
        })) {
            renderGamePicks();
            document.getElementById("playerCollectionStatus").textContent =
                `${selected.player.name} added to your collection.`;
        } else {
            setGamePicksWalletStatus(gamePicksStorageMessage, true);
        }
    });
    document.getElementById("franchiseHistoryTeam").addEventListener("change", event => {
        const teamName = event.target.value;
        if (teamName && !allTeams.some(team => team.name === teamName)) {
            renderFranchiseHistory();
            return;
        }
        if (saveGamePicksState({ ...gamePicksState, historyTeamName: teamName })) {
            renderFranchiseHistory();
        } else {
            setGamePicksWalletStatus(gamePicksStorageMessage, true);
        }
    });
    document.getElementById("hubProfileTitleSelect").addEventListener("change", event => {
        if (!GAME_PICKS_PROFILE_TITLES.includes(event.target.value)) return;
        if (saveGamePicksState({ ...gamePicksState, profileTitle: event.target.value })) {
            renderHubProfile();
        } else {
            setGamePicksWalletStatus(gamePicksStorageMessage, true);
        }
    });
    document.getElementById("hubProfileBannerSelect").addEventListener("change", event => {
        if (!GAME_PICKS_PROFILE_BANNERS.includes(event.target.value)) return;
        if (saveGamePicksState({ ...gamePicksState, profileBanner: event.target.value })) {
            renderHubProfile();
        } else {
            setGamePicksWalletStatus(gamePicksStorageMessage, true);
        }
    });
    document.getElementById("statCardStyleSelect").addEventListener("change", event => {
        if (!GAME_PICKS_STAT_CARD_STYLES.includes(event.target.value)) return;
        if (saveGamePicksState({ ...gamePicksState, statCardStyle: event.target.value })) {
            renderHubRewards();
        } else {
            setGamePicksWalletStatus(gamePicksStorageMessage, true);
        }
    });
    document.getElementById("resetGamePicksReward").addEventListener("click", () => {
        if (saveGamePicksState({
            ...gamePicksState,
            equippedRewardId: "",
            arenaStyle: "hardwood"
        })) {
            renderGamePicks();
            setGamePicksShopStatus("Default NBA Hub theme restored. Your rewards remain unlocked.");
        } else {
            setGamePicksShopStatus(gamePicksStorageMessage, true);
        }
    });

    renderGamePicks();
    void loadGamePicksSchedule();
    void loadGamePicksOdds();
    window.setInterval(loadGamePicksOdds, 5 * 60 * 1000);
}

function mergeLiveScoresIntoSchedule(games, liveGames) {
    const liveById = new Map(liveGames.map(game => [String(game.id), game]));
    const scoresByMatchup = new Map();
    liveGames.forEach(game => {
        if (!game.home_tricode || !game.away_tricode) return;
        const matchup = `${canonicalNbaTricode(game.home_tricode)}:${canonicalNbaTricode(game.away_tricode)}`;
        const scoreDate = game.date && game.date.includes("T")
            ? dateKeyInPhilippines(new Date(game.date))
            : game.date;
        const localizedScore = { ...game, date: scoreDate };
        scoresByMatchup.set(matchup, [...(scoresByMatchup.get(matchup) || []), localizedScore]);
    });

    return games.map(game => {
        const matchup = `${canonicalNbaTricode(game.home_tricode)}:${canonicalNbaTricode(game.away_tricode)}`;
        const candidates = scoresByMatchup.get(matchup) || [];
        const datedCandidates = candidates
            .map(score => ({
                score,
                distance: Math.abs(
                    Date.parse(`${game.date}T12:00:00Z`) - Date.parse(`${score.date}T12:00:00Z`)
                )
            }))
            .filter(candidate => Number.isFinite(candidate.distance) && candidate.distance <= 24 * 60 * 60 * 1000)
            .sort((left, right) => left.distance - right.distance);
        const score = liveById.get(String(game.id))
            || datedCandidates[0]?.score
            || (candidates.length === 1 && !candidates[0].date ? candidates[0] : null);
        return score ? {
            ...game,
            status: score.status,
            status_code: score.status_code,
            period: score.period,
            clock: score.clock,
            home_score: score.home_score,
            away_score: score.away_score
        } : game;
    });
}

function updateScheduleDateBounds(resetDate = false) {
    const datePicker = document.getElementById("scheduleDatePicker");
    if (!datePicker) return;
    const seasonStart = Number(selectedScheduleSeason.slice(0, 4));
    const seasonEndMonthDay = seasonStart === 2019
        ? "10-31"
        : seasonStart === 2020
            ? "07-31"
            : "06-30";
    const seasonEndDate = `${seasonStart + 1}-${seasonEndMonthDay}`;
    datePicker.min = `${seasonStart}-07-01`;
    datePicker.max = seasonEndDate;
    const latestButton = document.getElementById("scheduleToday");
    if (latestButton) {
        const isCurrentSeason = selectedScheduleSeason === currentNbaSeason();
        latestButton.textContent = isCurrentSeason ? "Today" : "Latest";
        latestButton.setAttribute(
            "aria-label",
            isCurrentSeason ? "Jump to today" : "Jump to the latest game in this season"
        );
    }
    const dates = gamesInSelectedSchedulePhase().map(game => game.date).filter(Boolean).sort();
    if (resetDate || !selectedScheduleDate
        || selectedScheduleDate < datePicker.min
        || selectedScheduleDate > datePicker.max) {
        if (selectedScheduleSeason === currentNbaSeason()) {
            const today = localDateKey();
            selectedScheduleDate = dates.includes(today)
                ? today
                : dates.find(date => date >= today) || dates[0] || today;
        } else {
            selectedScheduleDate = dates[dates.length - 1] || seasonEndDate;
        }
    }
}

function selectScheduleSeason(season) {
    if (!season || season === selectedScheduleSeason) return;
    selectedScheduleSeason = season;
    selectedScheduleDate = "";
    scheduleGames = [];
    scheduleLoadMessage = "";
    updateScheduleDateBounds(true);
    const heading = document.querySelector("#scheduleSection .section-heading");
    if (heading) heading.textContent = `${season.replace("-", "–")} SEASON SCHEDULE & SCORES`;
    const status = document.getElementById("scheduleUpdateStatus");
    if (status) status.textContent = `Loading the ${season.replace("-", "–")} schedule…`;
    renderSchedule();
    void loadSchedule();
}

function selectSchedulePhase(phase) {
    selectedSchedulePhase = phase;
    updateScheduleDateBounds(true);
    renderSchedule();
}

async function loadLiveScores({ background = false } = {}) {
    if (isRefreshingScores) return;
    isRefreshingScores = true;
    try {
        const response = await fetch(`${API_URL}/api/v1/schedule/scores`, {
            headers: { "x-api-key": API_KEY }
        });
        if (!response.ok) throw new Error(`Live score request failed (${response.status}).`);
        const payload = await response.json();
        lastScoreRefreshAt = Date.now();
        let newlyFinalGame = null;
        if (payload.status === "fresh" && Array.isArray(payload.games)) {
            headlineScoreItems = payload.games
                .filter(game => [2, 3].includes(Number(game.status_code))
                    && game.home_score != null && game.away_score != null)
                .sort((left, right) => Number(left.status_code) - Number(right.status_code))
                .slice(0, 6)
                .map(game => {
                    const isLive = Number(game.status_code) === 2;
                    const homeScore = Number(game.home_score);
                    const awayScore = Number(game.away_score);
                    const isHomeWinner = homeScore > awayScore;
                    const isAwayWinner = awayScore > homeScore;
                    const homeTeam = findNbaTeamByTricode(game.home_tricode);
                    const awayTeam = findNbaTeamByTricode(game.away_tricode);
                    const winningTeam = isHomeWinner ? homeTeam : isAwayWinner ? awayTeam : null;
                    const winningTeamName = winningTeam?.name || "";
                    const period = Number(game.period);
                    const periodLabel = period > 4
                        ? `OT${period - 4 || ""}`
                        : period > 0 ? `Q${period}` : "";
                    const gameClock = String(game.clock || "").trim();
                    const status = isLive
                        ? [periodLabel, gameClock].filter(Boolean).join(" · ") || "In progress"
                        : "Final";
                    const leaderTricode = isHomeWinner
                        ? canonicalNbaTricode(game.home_tricode)
                        : isAwayWinner ? canonicalNbaTricode(game.away_tricode) : "";
                    const leader = isHomeWinner ? homeTeam : isAwayWinner ? awayTeam : null;
                    const leaderName = leader?.name || leaderTricode;
                    const winnerScore = Math.max(homeScore, awayScore);
                    const otherScore = Math.min(homeScore, awayScore);
                    const headline = isLive
                        ? `${leader ? `${leader.name} lead` : "Game tied"} · ${game.away_score}–${game.home_score}`
                        : winningTeamName
                            ? `${winningTeamName} win ${winnerScore}–${otherScore}`
                            : `${game.away_tricode} ${game.away_score} — ${game.home_tricode} ${game.home_score}`;
                    return {
                        id: `score-${game.id}`,
                        kind: "score",
                        category: isLive ? "LIVE SCORE" : "FINAL SCORE",
                        headline,
                        story: isLive
                            ? `${leader ? `${leaderName} lead ${winnerScore}–${otherScore}` : `The score is tied ${game.away_score}–${game.home_score}`}${periodLabel ? ` in ${periodLabel}` : ""}${gameClock ? ` with ${gameClock} remaining` : ""}. Follow the live box score.`
                            : winningTeamName
                                ? `${winningTeamName} defeated ${(isHomeWinner ? awayTeam : homeTeam)?.name || "their opponent"} ${winnerScore}–${otherScore}. Final score.`
                                : `${status}. Follow the full box score and today's NBA schedule.`,
                        teamName: winningTeamName,
                        teamLogo: winningTeam?.logo || "",
                        homeTricode: canonicalNbaTricode(game.home_tricode),
                        awayTricode: canonicalNbaTricode(game.away_tricode),
                        homeScore,
                        awayScore,
                        leadingTricode: leaderTricode,
                        url: "#scheduleSection",
                        published: null,
                        source: "NBA scoreboard"
                    };
                });
            refreshHeadlineSlides();
            if (selectedScheduleSeason === currentNbaSeason()) {
                const previousFinalScores = new Map(
                    scheduleGames
                        .filter(isCompletedScheduleGame)
                        .map(game => [game.id, `${game.home_score}-${game.away_score}`])
                );
                scheduleGames = mergeLiveScoresIntoSchedule(scheduleGames, payload.games);
                playoffScheduleBySeason.set(selectedScheduleSeason, scheduleGames);
                refreshPlayoffBracketFromCache(selectedScheduleSeason);
                newlyFinalGame = scheduleGames.find(game =>
                    isCompletedScheduleGame(game)
                    && previousFinalScores.get(game.id)
                        !== `${game.home_score}-${game.away_score}`
                );
            }
            if (gamePicksScheduleGames.length) {
                const previousPicksFinalScores = new Map(
                    gamePicksScheduleGames
                        .filter(isCompletedScheduleGame)
                        .map(game => [game.id, `${game.home_score}-${game.away_score}`])
                );
                gamePicksScheduleGames = mergeLiveScoresIntoSchedule(gamePicksScheduleGames, payload.games);
                newlyFinalGame ||= gamePicksScheduleGames.find(game =>
                    isCompletedScheduleGame(game)
                    && previousPicksFinalScores.get(game.id)
                        !== `${game.home_score}-${game.away_score}`
                );
                settleGamePicksBets();
                renderGamePicks();
            }
            if (newlyFinalGame) {
                const gamePhase = schedulePhaseForGame(newlyFinalGame);
                const recordPhase = gamePhase === "playoffs" ? "regular" : gamePhase;
                void loadStandings({
                    background: true,
                    seasonType: recordPhase,
                    season: currentNbaSeason()
                });
            }
        }
        if (selectedScheduleSeason === currentNbaSeason()) {
            const schedulePayload = {
                status: scheduleGames.length ? "fresh" : "unavailable",
                count: scheduleGames.length,
                last_updated: lastScheduleRefreshAt ? new Date(lastScheduleRefreshAt).toISOString() : null,
                scores: payload
            };
            updateScheduleStatus(schedulePayload);
        }
        renderSchedule();
    } catch (error) {
        console.error("Live score refresh failed:", error);
        if (!background && !scheduleGames.length) {
            const statusElement = document.getElementById("scheduleUpdateStatus");
            if (statusElement) {
                statusElement.textContent = "Live scores could not be reached. The full schedule will still load when available.";
                statusElement.classList.add("is-warning");
            }
        }
    } finally {
        isRefreshingScores = false;
    }
}

function changeScheduleDate(offset) {
    const current = new Date(`${selectedScheduleDate || localDateKey()}T12:00:00`);
    current.setDate(current.getDate() + offset);
    selectedScheduleDate = localDateKey(current);
    renderSchedule();
}

function renderSchedule() {
    const grid = document.getElementById("scheduleGrid");
    if (!grid) return;
    grid.innerHTML = "";
    const datePicker = document.getElementById("scheduleDatePicker");
    if (datePicker && selectedScheduleDate) datePicker.value = selectedScheduleDate;
    const phaseGames = gamesInSelectedSchedulePhase();
    const dayGames = phaseGames.filter(game => game.date === selectedScheduleDate);
    const previousButton = document.getElementById("schedulePreviousDay");
    const nextButton = document.getElementById("scheduleNextDay");
    if (previousButton) previousButton.disabled = Boolean(datePicker?.min && selectedScheduleDate <= datePicker.min);
    if (nextButton) nextButton.disabled = Boolean(datePicker?.max && selectedScheduleDate >= datePicker.max);
    if (!scheduleGames.length) {
        const empty = document.createElement("p");
        empty.className = "schedule-empty";
        empty.textContent = scheduleLoadMessage || "Loading the full NBA schedule…";
        grid.appendChild(empty);
        return;
    }
    if (!dayGames.length) {
        const empty = document.createElement("p");
        empty.className = "schedule-empty";
        empty.textContent = phaseGames.length
            ? `No ${selectedSchedulePhase === "all" ? "NBA games" : selectedSchedulePhase} scheduled for ${formatScheduleDate(selectedScheduleDate)}.`
            : `No ${selectedSchedulePhase} games are available for the ${selectedScheduleSeason.replace("-", "–")} season.`;
        grid.appendChild(empty);
        return;
    }

    dayGames.forEach((game, index) => {
        const homeTeam = allTeams.find(team => team.name === game.home);
        const awayTeam = allTeams.find(team => team.name === game.away);
        const homeLogo = game.home_logo || homeTeam?.logo || "";
        const awayLogo = game.away_logo || awayTeam?.logo || "";
        const statusCode = Number(game.status_code);
        const statusText = game.status || "Scheduled";
        const liveState = statusCode === 3 || /final/i.test(statusText)
            ? "final"
            : statusCode === 2 || /(live|q[1-4]|half|ot|in progress)/i.test(statusText)
                ? "live"
                : "upcoming";
        const hasScores = liveState !== "upcoming"
            && game.home_score != null && game.away_score != null;
        const awayScore = hasScores
            ? `<strong class="game-team-score">${escapeMarkup(game.away_score)}</strong>`
            : '<span class="game-team-score is-empty" aria-hidden="true"></span>';
        const homeScore = hasScores
            ? `<strong class="game-team-score">${escapeMarkup(game.home_score)}</strong>`
            : '<span class="game-team-score is-empty" aria-hidden="true"></span>';
        const awayRecord = teamRecordForGame(game.away, game);
        const homeRecord = teamRecordForGame(game.home, game);
        const seriesGame = playoffSeriesGameNumber(game);
        const gameTag = [
            game.stage || "NBA",
            seriesGame ? `Game ${seriesGame}` : "",
            game.venue || "Venue TBD"
        ].filter(Boolean).join(" · ");

        const card = document.createElement("article");
        card.className = "game-card";
        card.dataset.gameId = game.id;
        card.tabIndex = 0;
        card.setAttribute("role", "button");
        card.setAttribute("aria-label", `Open box score: ${game.away} at ${game.home}, ${statusText}`);
        card.style.animation = `heroSlideIn 0.38s var(--ease-out-expo) forwards`;
        card.style.animationDelay = `${Math.min(index * 0.04, 0.45)}s`;

        card.innerHTML = `
            <div class="game-type-tag">${escapeMarkup(gameTag)}</div>
            <div class="game-matchup">
                <div class="game-matchup-team game-matchup-team--away">
                    ${awayLogo ? `<img src="${escapeMarkup(awayLogo)}" alt="" class="game-team-logo">` : ""}
                    <span class="game-team-identity">
                        <span class="game-team-name">${escapeMarkup(game.away)}</span>
                        <span class="game-team-record" aria-label="${escapeMarkup(awayRecord.label)}" title="${escapeMarkup(awayRecord.label)}">${escapeMarkup(awayRecord.text)}</span>
                    </span>
                </div>
                ${awayScore}
                <span class="game-matchup-separator" aria-hidden="true">AT</span>
                ${homeScore}
                <div class="game-matchup-team game-matchup-team--home">
                    ${homeLogo ? `<img src="${escapeMarkup(homeLogo)}" alt="" class="game-team-logo">` : ""}
                    <span class="game-team-identity">
                        <span class="game-team-name">${escapeMarkup(game.home)}</span>
                        <span class="game-team-record" aria-label="${escapeMarkup(homeRecord.label)}" title="${escapeMarkup(homeRecord.label)}">${escapeMarkup(homeRecord.text)}</span>
                    </span>
                </div>
            </div>
            ${renderGameWinProbability(game)}
            <div class="game-card-footer">
                <div class="game-live-status is-${liveState}">${escapeMarkup(statusText)}</div>
                <div class="game-time-label">${escapeMarkup(game.time || "Time TBD")}</div>
            </div>
        `;
        grid.appendChild(card);
    });
}

async function loadTransactions() {
    if (isRefreshingTransactions) return;
    isRefreshingTransactions = true;
    try {
        const response = await fetch(`${API_URL}/api/v1/transactions`, {
            headers: { "x-api-key": API_KEY }
        });
        if (!response.ok) {
            const detail = response.status === 404
                ? "The deployed API is missing the transactions route. Publish the latest api/index.py to Vercel."
                : `Transaction request failed (${response.status}).`;
            throw new Error(detail);
        }
        const payload = await response.json();
        if (payload.source !== "NBA.com transactions") {
            throw new Error("The deployed API is outdated and is still using the old transaction feed. Redeploy the updated api/index.py to load NBA transactions.");
        }
        rawTimelineTransactions = Array.isArray(payload.transactions) ? payload.transactions : [];
        transactionsFeedStatus = payload;
        lastTransactionsRefreshAt = Date.now();
        filterTransactions();
    } catch (error) {
        console.error("NBA transaction feed refresh failed:", error);
        transactionsFeedStatus = {
            ...transactionsFeedStatus,
            status: rawTimelineTransactions.length ? "stale" : "unavailable",
            message: rawTimelineTransactions.length
                ? "Transaction refresh failed. Showing the last loaded reported feed."
                : error instanceof Error
                    ? error.message
                    : "The transaction feed is unavailable; no unverified transaction list is shown."
        };
        filterTransactions();
    } finally {
        isRefreshingTransactions = false;
    }
}

function formatStandingValue(value, fallback = "—") {
    return value == null || String(value).trim() === "" ? fallback : String(value);
}

function formatTeamStandingRecord(team) {
    if (team.wins == null || team.losses == null) return "—";
    return `${formatStandingValue(team.wins)}-${formatStandingValue(team.losses)}`;
}

function usesHistoricalPlayoffSeeding() {
    return selectedStandingsPhase === "regular"
        && Number(selectedStandingsSeason.slice(0, 4)) < 2015;
}

function compareConferenceStandings(left, right) {
    const leftPct = Number(left.win_pct);
    const rightPct = Number(right.win_pct);
    if (Number.isFinite(leftPct) && Number.isFinite(rightPct) && leftPct !== rightPct) {
        return rightPct - leftPct;
    }
    const leftWins = Number(left.wins);
    const rightWins = Number(right.wins);
    if (Number.isFinite(leftWins) && Number.isFinite(rightWins) && leftWins !== rightWins) {
        return rightWins - leftWins;
    }

    const leftRank = Number(left.conference_rank);
    const rightRank = Number(right.conference_rank);
    if (
        left.conference_rank != null
        && right.conference_rank != null
        && Number.isFinite(leftRank)
        && Number.isFinite(rightRank)
        && leftRank !== rightRank
    ) return leftRank - rightRank;

    const recordPercentage = record => {
        const match = String(record || "").match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
        if (!match) return null;
        const wins = Number(match[1]);
        const losses = Number(match[2]);
        return wins + losses ? wins / (wins + losses) : null;
    };
    const leftConferencePct = recordPercentage(left.conference_record);
    const rightConferencePct = recordPercentage(right.conference_record);
    if (
        leftConferencePct != null
        && rightConferencePct != null
        && leftConferencePct !== rightConferencePct
    ) return rightConferencePct - leftConferencePct;

    const leftDifferential = Number(left.point_differential);
    const rightDifferential = Number(right.point_differential);
    if (
        Number.isFinite(leftDifferential)
        && Number.isFinite(rightDifferential)
        && leftDifferential !== rightDifferential
    ) return rightDifferential - leftDifferential;
    return 0;
}

function rankConferenceStandings(standings, conference, season, historicalSeeding) {
    const ranked = standings
        .filter(team => team.conference === conference)
        .sort(compareConferenceStandings);
    if (!historicalSeeding) return ranked;

    const seasonStart = Number(season.slice(0, 4));
    const protectedSeedCount = seasonStart < 2005 ? 3 : 4;
    const divisionWinners = ranked
        .filter(team => team.division_champion)
        .slice(0, protectedSeedCount);
    for (const divisionWinner of divisionWinners) {
        const currentIndex = ranked.indexOf(divisionWinner);
        if (currentIndex < protectedSeedCount) continue;

        let replaceIndex = -1;
        for (let index = protectedSeedCount - 1; index >= 0; index--) {
            if (!ranked[index].division_champion) {
                replaceIndex = index;
                break;
            }
        }
        if (replaceIndex < 0) continue;

        ranked.splice(currentIndex, 1);
        ranked.splice(replaceIndex, 0, divisionWinner);
    }
    return ranked;
}

function renderStandings(standings) {
    const tbody = document.getElementById("standingsTableBody");
    const panel = document.getElementById("standings-panel");
    if (!tbody || !panel) return;
    const historicalSeeding = usesHistoricalPlayoffSeeding();
    const historicalRuleNote = document.getElementById("standingsHistoricalRule");
    if (historicalRuleNote) historicalRuleNote.hidden = !historicalSeeding;

    const conferenceStandings = rankConferenceStandings(
        standings,
        selectedStandingsConference,
        selectedStandingsSeason,
        historicalSeeding
    );

    if (!conferenceStandings.length) {
        tbody.innerHTML = '<tr><td colspan="14" class="standings-empty">No standings are available for this conference yet.</td></tr>';
        return;
    }

    tbody.innerHTML = conferenceStandings.map((team, index) => `
        <tr>
            <td>
                <div class="standings-team-cell">
                    <span class="standings-rank">${index + 1}</span>
                    ${playoffTeamLogo(team) ? `<img src="${escapeMarkup(playoffTeamLogo(team))}" alt="" loading="lazy">` : ""}
                    <span class="standings-team-info">
                        <span class="standings-team-name">
                            ${escapeMarkup(team.team || "NBA team")}
                            ${historicalSeeding && team.division_champion ? '<span class="standings-division-champion">Division champion</span>' : ""}
                        </span>
                        <span class="standings-team-record">${escapeMarkup(formatTeamStandingRecord(team))}</span>
                    </span>
                </div>
            </td>
            <td>${escapeMarkup(formatStandingValue(team.wins))}</td>
            <td>${escapeMarkup(formatStandingValue(team.losses))}</td>
            <td class="standings-pct">${escapeMarkup(formatStandingValue(team.win_pct))}</td>
            <td>${escapeMarkup(formatStandingValue(team.games_behind, "—"))}</td>
            <td>${escapeMarkup(formatStandingValue(team.home_record))}</td>
            <td>${escapeMarkup(formatStandingValue(team.away_record))}</td>
            <td>${escapeMarkup(formatStandingValue(team.division_record))}</td>
            <td>${escapeMarkup(formatStandingValue(team.conference_record))}</td>
            <td>${escapeMarkup(formatStandingValue(team.points_for))}</td>
            <td>${escapeMarkup(formatStandingValue(team.points_against))}</td>
            <td>${escapeMarkup(formatStandingValue(team.point_differential))}</td>
            <td>${escapeMarkup(formatStandingValue(team.last10))}</td>
            <td>${escapeMarkup(formatStandingValue(team.streak, "—"))}</td>
        </tr>
    `).join("");
}

function loadStandingsPrediction() {
    if (standingsPrediction) return standingsPrediction;
    try {
        const stored = localStorage.getItem(STANDINGS_PREDICTION_STORAGE_KEY);
        standingsPrediction = stored ? JSON.parse(stored) : {};
        if (!standingsPrediction || typeof standingsPrediction !== "object" || Array.isArray(standingsPrediction)) {
            throw new Error("Saved standings prediction has an invalid format.");
        }
    } catch (error) {
        console.error("Standings prediction could not be loaded:", error);
        standingsPrediction = {};
    }
    return standingsPrediction;
}

function renderStandingsPrediction() {
    const grid = document.getElementById("standingsPredictionGrid");
    if (!grid) return;
    if (!allTeams.length) {
        grid.innerHTML = '<p class="standings-prediction-status">NBA teams are unavailable. The prediction form will appear when the team API is available.</p>';
        updateStandingsPredictionValidity();
        return;
    }
    const saved = loadStandingsPrediction();
    grid.innerHTML = ["Eastern", "Western"].map(conference => {
        const conferenceTeams = allTeams.filter(team => team.conference === conference);
        const teams = orderedPredictionTeams(conferenceTeams, saved[conference]);
        if (teams.length !== 15) {
            return `<fieldset class="standings-prediction-conference">
                <legend>${conference} Conference</legend>
                <p class="standings-prediction-status">Expected 15 API teams; received ${teams.length}. Predictions are disabled until the roster is complete.</p>
            </fieldset>`;
        }
        return `<fieldset class="standings-prediction-conference">
            <legend>${conference} Conference</legend>
            <ol class="standings-prediction-list" data-prediction-list="${conference}" aria-label="${conference} Conference predicted order">
                ${teams.map((team, index) => `
                    <li class="standings-prediction-team" draggable="true" data-prediction-team="${escapeMarkup(team.id)}">
                        <span class="standings-prediction-rank">${index + 1}</span>
                        ${team.logo ? `<img src="${escapeMarkup(team.logo)}" alt="" loading="lazy">` : ""}
                        <span class="standings-prediction-name">${escapeMarkup(team.name)}</span>
                        <span class="standings-prediction-move">
                            <button type="button" data-prediction-move="up" aria-label="Move ${escapeMarkup(team.name)} up">↑</button>
                            <button type="button" data-prediction-move="down" aria-label="Move ${escapeMarkup(team.name)} down">↓</button>
                        </span>
                    </li>
                `).join("")}
            </ol>
        </fieldset>`;
    }).join("");
    updateStandingsPredictionValidity();
}

function orderedPredictionTeams(teams, savedOrder) {
    const byId = new Map(teams.map(team => [String(team.id), team]));
    let orderedIds = [];
    if (Array.isArray(savedOrder)) {
        orderedIds = savedOrder.map(String);
    } else if (savedOrder && typeof savedOrder === "object") {
        orderedIds = Object.entries(savedOrder)
            .sort((left, right) => Number(left[1]) - Number(right[1]))
            .map(([teamId]) => String(teamId));
    }
    const ordered = orderedIds.map(teamId => byId.get(teamId)).filter(Boolean);
    const seenIds = new Set(ordered.map(team => String(team.id)));
    return [
        ...ordered,
        ...teams
            .filter(team => !seenIds.has(String(team.id)))
            .sort((left, right) => String(left.name).localeCompare(String(right.name)))
    ];
}

function updateStandingsPredictionValidity() {
    const status = document.getElementById("standingsPredictionStatus");
    const saveButton = document.getElementById("saveStandingsPrediction");
    const grid = document.getElementById("standingsPredictionGrid");
    if (!grid || !status || !saveButton) return;
    const conferences = ["Eastern", "Western"];
    const valid = allTeams.length === 30 && conferences.every(conference => {
        const list = grid.querySelector(`[data-prediction-list="${conference}"]`);
        const teamIds = list ? [...list.querySelectorAll("[data-prediction-team]")]
            .map(team => team.dataset.predictionTeam) : [];
        return teamIds.length === 15 && new Set(teamIds).size === 15;
    });
    status.textContent = valid
        ? "Drag the teams into your 1–15 order, then save your prediction."
        : "The team list is incomplete. Load all 30 teams before saving.";
    saveButton.disabled = !valid;
}

function saveStandingsPrediction(event) {
    event.preventDefault();
    updateStandingsPredictionValidity();
    const status = document.getElementById("standingsPredictionStatus");
    const grid = document.getElementById("standingsPredictionGrid");
    if (!grid || !status || document.getElementById("saveStandingsPrediction").disabled) return;
    const prediction = { season: "2026-27" };
    for (const conference of ["Eastern", "Western"]) {
        prediction[conference] = [...grid.querySelectorAll(`[data-prediction-list="${conference}"] [data-prediction-team]`)]
            .map(team => Number(team.dataset.predictionTeam));
    }
    try {
        localStorage.setItem(STANDINGS_PREDICTION_STORAGE_KEY, JSON.stringify(prediction));
        standingsPrediction = prediction;
        status.textContent = "Your 2026–27 standings prediction is saved in this browser.";
    } catch (error) {
        console.error("Standings prediction could not be saved:", error);
        status.textContent = "Your prediction could not be saved. Check this browser's storage settings and try again.";
    }
}

function updateStandingsPredictionOrder(list) {
    if (!list) return;
    [...list.querySelectorAll("[data-prediction-team]")].forEach((team, index, teams) => {
        team.querySelector(".standings-prediction-rank").textContent = String(index + 1);
        team.querySelector('[data-prediction-move="up"]').disabled = index === 0;
        team.querySelector('[data-prediction-move="down"]').disabled = index === teams.length - 1;
    });
    updateStandingsPredictionValidity();
}

function moveStandingsPredictionTeam(event) {
    const button = event.target.closest("[data-prediction-move]");
    if (!button) return;
    const team = button.closest("[data-prediction-team]");
    const list = team?.parentElement;
    if (!team || !list) return;
    if (button.dataset.predictionMove === "up" && team.previousElementSibling) {
        list.insertBefore(team, team.previousElementSibling);
    } else if (button.dataset.predictionMove === "down" && team.nextElementSibling) {
        list.insertBefore(team.nextElementSibling, team);
    }
    updateStandingsPredictionOrder(list);
}

function startStandingsPredictionDrag(event) {
    const team = event.target.closest("[data-prediction-team]");
    if (!team) return;
    team.classList.add("is-dragging");
    if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", team.dataset.predictionTeam);
    }
}

function dragOverStandingsPrediction(event) {
    const target = event.target.closest("[data-prediction-team]");
    const dragged = document.querySelector("#standingsPredictionGrid .is-dragging");
    if (!target || !dragged || target === dragged || target.parentElement !== dragged.parentElement) return;
    event.preventDefault();
    const bounds = target.getBoundingClientRect();
    const insertBeforeTarget = event.clientY < bounds.top + bounds.height / 2;
    target.parentElement.insertBefore(dragged, insertBeforeTarget ? target : target.nextElementSibling);
    updateStandingsPredictionOrder(target.parentElement);
}

function endStandingsPredictionDrag(event) {
    const team = event.target.closest("[data-prediction-team]");
    if (!team) return;
    team.classList.remove("is-dragging");
    updateStandingsPredictionOrder(team.parentElement);
}

function clearStandingsPrediction() {
    try {
        localStorage.removeItem(STANDINGS_PREDICTION_STORAGE_KEY);
        standingsPrediction = {};
        renderStandingsPrediction();
        const status = document.getElementById("standingsPredictionStatus");
        if (status) status.textContent = "Your saved prediction was cleared.";
    } catch (error) {
        console.error("Standings prediction could not be cleared:", error);
        const status = document.getElementById("standingsPredictionStatus");
        if (status) status.textContent = "Your prediction could not be cleared. Check this browser's storage settings and try again.";
    }
}

function sortedStandingsForBracket(standings, conference, season) {
    const historicalSeeding = Number(season.slice(0, 4)) < 2015;
    return rankConferenceStandings(standings, conference, season, historicalSeeding)
        .slice(0, 10)
        .map((team, index) => ({ ...team, playoffSeed: index + 1 }));
}

function actualFirstRoundOpponent(team, lowerSeed, rankedConferenceTeams, gamesByPair) {
    if (!team) return null;
    const teamCode = canonicalNbaTricode(team.abbreviation);
    const teamByCode = new Map(rankedConferenceTeams.map(candidate => [
        canonicalNbaTricode(candidate.abbreviation),
        candidate
    ]));
    let earliestGame = null;
    for (const [pairKey, games] of gamesByPair) {
        if (!pairKey.split(":").includes(teamCode)) continue;
        for (const game of games) {
            if (!earliestGame || String(game.date).localeCompare(String(earliestGame.date)) < 0) {
                earliestGame = game;
            }
        }
    }
    if (!earliestGame) return null;
    const opponentCode = canonicalNbaTricode(
        canonicalNbaTricode(earliestGame.home_tricode) === teamCode
            ? earliestGame.away_tricode
            : earliestGame.home_tricode
    );
    const opponent = teamByCode.get(opponentCode);
    if (!opponent || opponent.playoffSeed < 5 || opponent.playoffSeed > 10) return null;
    return { ...opponent, playoffSeed: lowerSeed };
}

function playoffSeriesForTeams(firstTeam, secondTeam, gamesByPair, winsNeeded = 4) {
    if (!firstTeam || !secondTeam) return null;
    const firstCode = canonicalNbaTricode(firstTeam.abbreviation);
    const secondCode = canonicalNbaTricode(secondTeam.abbreviation);
    const pairKey = [firstCode, secondCode].sort().join(":");
    const games = gamesByPair.get(pairKey) || [];
    let firstWins = 0;
    let secondWins = 0;
    for (const game of games) {
        if (!isCompletedScheduleGame(game)) continue;
        const homeScore = Number(game.home_score);
        const awayScore = Number(game.away_score);
        if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore) || homeScore === awayScore) continue;
        const winnerCode = canonicalNbaTricode(
            homeScore > awayScore ? game.home_tricode : game.away_tricode
        );
        if (winnerCode === firstCode) firstWins++;
        else if (winnerCode === secondCode) secondWins++;
    }
    const winner = firstWins >= winsNeeded
        ? firstTeam
        : secondWins >= winsNeeded
            ? secondTeam
            : null;
    const completedGames = games.filter(isCompletedScheduleGame);
    return {
        firstTeam,
        secondTeam,
        firstWins,
        secondWins,
        winsNeeded,
        winner,
        games,
        gamesPlayed: completedGames.length,
        latestFinal: completedGames.at(-1) || null
    };
}

function playoffRoundDateRange(seriesList) {
    const dates = seriesList.flatMap(series =>
        series?.games.map(game => String(game.date || "").slice(0, 10)).filter(Boolean) || []
    ).sort();
    if (!dates.length) return "Dates TBD";
    const format = date => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        timeZone: "UTC"
    });
    return dates[0] === dates[dates.length - 1]
        ? format(dates[0])
        : `${format(dates[0])} – ${format(dates[dates.length - 1])}`;
}

function playoffTeamDisplayName(team) {
    const fullName = String(team?.team || "NBA team");
    const nicknames = {
        "Portland Trail Blazers": "Trail Blazers",
        "New Orleans/Oklahoma City Hornets": "Hornets"
    };
    return nicknames[fullName] || fullName.split(/\s+/).at(-1);
}

function playoffTeamLogo(team) {
    const historicalFranchiseLogos = {
        "Toronto Raptors": "https://cdn.nba.com/logos/nba/1610612761/primary/L/logo.svg",
        "New Jersey Nets": "https://cdn.nba.com/logos/nba/1610612751/primary/L/logo.svg"
    };
    const historicalFranchiseLogo = historicalFranchiseLogos[String(team?.team || "")];
    if (historicalFranchiseLogo) return historicalFranchiseLogo;
    if (team.logo) return team.logo;
    const configuredTeam = allTeams.find(candidate =>
        Number(candidate.id) === Number(team.team_id)
    );
    return configuredTeam?.logo
        || (team.team_id
            ? `https://cdn.nba.com/logos/nba/${encodeURIComponent(team.team_id)}/primary/L/logo.svg`
            : "");
}

function renderPlayoffSeriesCard(series, round, season) {
    if (!series) {
        return `<article class="playoff-series-card is-pending"><span>${escapeMarkup(round)}</span><p>Matchup to be determined</p></article>`;
    }
    const { firstTeam, secondTeam, firstWins, secondWins, winner, gamesPlayed, latestFinal } = series;
    const orderedGames = [...series.games].sort((left, right) =>
        `${left.date || ""} ${left.time || ""} ${left.id || ""}`
            .localeCompare(`${right.date || ""} ${right.time || ""} ${right.id || ""}`)
    );
    const seriesLabel = winner
        ? `${winner.team} wins series ${series.winsNeeded}-${winner === firstTeam ? secondWins : firstWins}`
        : gamesPlayed
            ? `${firstWins === secondWins ? "Series tied" : `${firstWins > secondWins ? firstTeam.team : secondTeam.team} leads`} ${Math.max(firstWins, secondWins)}-${Math.min(firstWins, secondWins)}`
            : "Series not started";
    const seriesGameList = orderedGames.length
        ? `<details class="playoff-series-games">
            <summary>Game box scores <span>${orderedGames.length}</span></summary>
            <ol>
                ${orderedGames.map((game, index) => {
                    const completed = isCompletedScheduleGame(game);
                    const awayScore = game.away_score == null ? "—" : game.away_score;
                    const homeScore = game.home_score == null ? "—" : game.home_score;
                    const gameLabel = `Game ${index + 1}`;
                    const matchup = `${game.away_tricode || game.away || secondTeam.team} ${awayScore} – ${game.home_tricode || game.home || firstTeam.team} ${homeScore}`;
                    return `<li>
                        <span class="playoff-series-game-meta">
                            <strong>${gameLabel}</strong>
                            <span>${escapeMarkup(game.date ? formatScheduleDate(String(game.date).slice(0, 10), { month: "short", day: "numeric", year: "numeric" }) : "Date TBD")}</span>
                        </span>
                        <span class="playoff-series-game-score">${escapeMarkup(completed ? matchup : game.status || "Scheduled")}</span>
                        ${completed || Number(game.status_code) === 2
                            ? `<button type="button" class="playoff-series-box-score-button" data-playoff-game-id="${escapeMarkup(game.id)}" data-playoff-season="${escapeMarkup(season)}" aria-label="View ${gameLabel} player box score">Box score</button>`
                            : '<span class="playoff-series-game-pending">Not final</span>'}
                    </li>`;
                }).join("")}
            </ol>
        </details>`
        : "";
    const renderTeam = (team, wins) => {
        const logo = playoffTeamLogo(team);
        const fallbackLogo = team.team_id
            ? `https://cdn.nba.com/logos/nba/${encodeURIComponent(team.team_id)}/primary/L/logo.svg`
            : "";
        const historicalWordmark = Boolean(team.historical_logo_wordmark);
        return `
            <div class="playoff-series-team${winner === team ? " is-series-winner" : ""}${historicalWordmark ? " has-historical-wordmark" : ""}">
                ${logo
                    ? `<img src="${escapeMarkup(logo)}" alt="" loading="lazy"${fallbackLogo && logo !== fallbackLogo ? ` onerror="this.onerror=null;this.src='${escapeMarkup(fallbackLogo)}'"` : ""}>`
                    : '<span class="playoff-series-logo-placeholder" aria-hidden="true"></span>'}
                <span class="playoff-series-seed">${team.playoffSeed}</span>
                <span class="playoff-series-name">${escapeMarkup(playoffTeamDisplayName(team))}</span>
                <strong>${wins}</strong>
            </div>`;
    };
    return `<article class="playoff-series-card">
        <span class="playoff-series-status">${escapeMarkup(seriesLabel)}</span>
        ${renderTeam(firstTeam, firstWins)}
        ${renderTeam(secondTeam, secondWins)}
        ${latestFinal ? `<div class="playoff-series-last-score">
            Latest · ${escapeMarkup(latestFinal.away_tricode || "")} ${escapeMarkup(latestFinal.away_score)}
            – ${escapeMarkup(latestFinal.home_tricode || "")} ${escapeMarkup(latestFinal.home_score)}
        </div>` : ""}
        ${seriesGameList}
    </article>`;
}

function renderPlayoffBracket(season, standings, schedule) {
    const bracket = document.getElementById("playoffBracket");
    const status = document.getElementById("playoffBracketStatus");
    const label = document.getElementById("playoffBracketSeason");
    if (!bracket || !status || !label) return;
    label.textContent = `${season.replace("-", "–")} SEASON`;
    const playoffGames = schedule.filter(game =>
        schedulePhaseForGame(game) === "playoffs"
        && !/play.?in/i.test(String(game.stage || ""))
        && !/cancelled|canceled|abandoned/i.test(String(game.status || ""))
        && game.home_tricode
        && game.away_tricode
    );
    const gamesByPair = new Map();
    for (const game of playoffGames) {
        const key = [
            canonicalNbaTricode(game.home_tricode),
            canonicalNbaTricode(game.away_tricode)
        ].sort().join(":");
        if (!gamesByPair.has(key)) gamesByPair.set(key, []);
        gamesByPair.get(key).push(game);
    }
    for (const games of gamesByPair.values()) games.sort((left, right) => String(left.date).localeCompare(String(right.date)));

    const eastern = sortedStandingsForBracket(standings, "Eastern", season);
    const western = sortedStandingsForBracket(standings, "Western", season);
    if (eastern.length < 8 || western.length < 8) {
        bracket.innerHTML = "";
        status.textContent = "Playoff scores are available, but complete regular-season standings are required to seed the bracket.";
        return;
    }
    const makeConferenceRounds = teams => {
        const bySeed = new Map(teams.map(team => [team.playoffSeed, team]));
        const firstRoundWinsNeeded = Number(season.slice(0, 4)) <= 2001 ? 3 : 4;
        const firstRound = [[1, 8], [4, 5], [3, 6], [2, 7]]
            .map(([first, second]) => {
                const firstTeam = bySeed.get(first);
                const opponent = actualFirstRoundOpponent(firstTeam, second, teams, gamesByPair);
                return playoffSeriesForTeams(
                    firstTeam,
                    opponent || bySeed.get(second),
                    gamesByPair,
                    firstRoundWinsNeeded
                );
            });
        const secondRound = [
            playoffSeriesForTeams(firstRound[0]?.winner, firstRound[1]?.winner, gamesByPair),
            playoffSeriesForTeams(firstRound[2]?.winner, firstRound[3]?.winner, gamesByPair)
        ];
        const conferenceFinal = playoffSeriesForTeams(secondRound[0]?.winner, secondRound[1]?.winner, gamesByPair);
        return [firstRound, secondRound, [conferenceFinal]];
    };
    const eastRounds = makeConferenceRounds(eastern);
    const westRounds = makeConferenceRounds(western);
    const eastChampion = eastRounds[2][0]?.winner;
    const westChampion = westRounds[2][0]?.winner;
    const finals = playoffSeriesForTeams(eastChampion, westChampion, gamesByPair);
    const roundLabels = [
        ["1st Round", westRounds[0]],
        ["Conf. Semifinals", westRounds[1]],
        ["Conf. Finals", westRounds[2]],
        ["NBA Finals", finals ? [finals] : []],
        ["Conf. Finals", eastRounds[2]],
        ["Conf. Semifinals", eastRounds[1]],
        ["1st Round", eastRounds[0]]
    ];
    const renderRoundColumn = (labelText, seriesList, className, side, round) => `
        <section class="playoff-round-column ${className}" data-side="${side}" data-round="${round}">
            <div class="playoff-round-cards">
                ${seriesList.map(series => renderPlayoffSeriesCard(series, labelText, season)).join("")}
            </div>
        </section>`;
    bracket.innerHTML = `
        <div class="playoff-bracket-board">
            <div class="playoff-bracket-conference-labels">
                <h4>Western Conference</h4>
                <h4>Eastern Conference</h4>
            </div>
            <div class="playoff-bracket-round-headings">
                ${roundLabels.map(([labelText, seriesList]) => `
                    <div>
                        <strong>${labelText}</strong>
                        <span>${escapeMarkup(playoffRoundDateRange(seriesList))}</span>
                    </div>
                `).join("")}
            </div>
            <div class="playoff-bracket-rounds">
                ${renderRoundColumn("1st Round", westRounds[0], "is-first-round", "west", "1")}
                ${renderRoundColumn("Conf. Semifinals", westRounds[1], "is-second-round", "west", "2")}
                ${renderRoundColumn("Conf. Finals", westRounds[2], "is-conference-final", "west", "3")}
                <section class="playoff-finals-column">
                    <div class="playoff-finals-card">
                        <strong>Championship</strong>
                        <span>NBA Finals</span>
                        ${renderPlayoffSeriesCard(finals, "NBA Finals", season)}
                    </div>
                    ${finals?.winner ? `<div class="playoff-champion-banner">
                        <span>${escapeMarkup(season.replace("-", "–"))}</span>
                        ${playoffTeamLogo(finals.winner) ? `<img src="${escapeMarkup(playoffTeamLogo(finals.winner))}" alt="" loading="lazy">` : ""}
                        <strong>${escapeMarkup(finals.winner.team)}</strong>
                        <span>NBA CHAMPIONS</span>
                    </div>` : ""}
                </section>
                ${renderRoundColumn("Conf. Finals", eastRounds[2], "is-conference-final", "east", "3")}
                ${renderRoundColumn("Conf. Semifinals", eastRounds[1], "is-second-round", "east", "2")}
                ${renderRoundColumn("1st Round", eastRounds[0], "is-first-round", "east", "1")}
            </div>
        </div>`;
    status.textContent = playoffGames.length
        ? `Showing playoff series from the ${season.replace("-", "–")} regular-season seeds.`
        : `Full bracket shown for ${season.replace("-", "–")}; playoff games have not started or are unavailable yet.`;
    status.classList.remove("is-warning");
}

function refreshPlayoffBracketFromCache(season) {
    if (season !== selectedStandingsSeason) return;
    const standings = standingsByPhase.get(`${season}:regular`);
    const schedule = playoffScheduleBySeason.get(season);
    if (standings && schedule) renderPlayoffBracket(season, standings, schedule);
}

async function loadPlayoffBracket(season = selectedStandingsSeason) {
    const status = document.getElementById("playoffBracketStatus");
    const bracket = document.getElementById("playoffBracket");
    if (!status || !bracket || !season) return;
    const requestSequence = ++playoffBracketRequestSequence;
    status.textContent = `Loading ${season.replace("-", "–")} playoff games and seeds…`;
    status.classList.remove("is-warning");
    try {
        let schedule = playoffScheduleBySeason.get(season);
        let standings = standingsByPhase.get(`${season}:regular`);
        const requests = [];
        if (!schedule) {
            if (selectedScheduleSeason === season && scheduleGames.length) {
                schedule = scheduleGames;
                playoffScheduleBySeason.set(season, schedule);
            } else {
                requests.push(fetch(
                    `${API_URL}/api/v1/schedule?season=${encodeURIComponent(season)}`,
                    { headers: { "x-api-key": API_KEY } }
                ).then(async response => {
                    if (!response.ok) throw new Error(`Playoff schedule request failed (${response.status}).`);
                    const payload = await response.json();
                    if (
                        payload.season !== season
                        || !Array.isArray(payload.games)
                        || Number(payload.regular_game_count ?? payload.games.length) < minimumScheduleRegularGames(season)
                    ) throw new Error(payload.message || `The complete ${season.replace("-", "–")} schedule is unavailable.`);
                    schedule = payload.games.map(scheduleGameInPhilippines);
                    playoffScheduleBySeason.set(season, schedule);
                }));
            }
        }
        if (!standings) {
            requests.push(fetch(
                `${API_URL}/api/v1/standings?season_type=regular&season=${encodeURIComponent(season)}`,
                { headers: { "x-api-key": API_KEY } }
            ).then(async response => {
                if (!response.ok) throw new Error(`Playoff seeding request failed (${response.status}).`);
                const payload = await response.json();
                if (payload.season !== season || !Array.isArray(payload.standings) || payload.status === "unavailable") {
                    throw new Error(payload.message || `Regular-season seeds for ${season.replace("-", "–")} are unavailable.`);
                }
                standings = payload.standings;
                standingsByPhase.set(`${season}:regular`, standings);
            }));
        }
        await Promise.all(requests);
        if (requestSequence !== playoffBracketRequestSequence) return;
        renderPlayoffBracket(season, standings || [], schedule || []);
    } catch (error) {
        if (requestSequence !== playoffBracketRequestSequence) return;
        console.error(`NBA ${season} playoff bracket load failed:`, error);
        bracket.innerHTML = "";
        status.textContent = error instanceof Error
            ? `${error.message} The bracket will retry when you change seasons.`
            : "The playoff bracket could not be loaded. Try selecting another season.";
        status.classList.add("is-warning");
    }
}

function setStandingsConference(conference) {
    selectedStandingsConference = conference;
    document.querySelectorAll(".standings-tab").forEach(tab => {
        const selected = tab.dataset.conference === conference;
        tab.classList.toggle("active", selected);
        tab.setAttribute("aria-selected", String(selected));
    });
    updateStandingsPanelLabel();
    renderStandings(currentStandings);
}

function updateStandingsPanelLabel() {
    const panel = document.getElementById("standings-panel");
    const phaseTab = document.querySelector(
        `.standings-phase-tab[data-season-type="${selectedStandingsPhase}"]`
    );
    const conferenceTab = document.querySelector(
        `.standings-tab[data-conference="${selectedStandingsConference}"]`
    );
    if (panel && phaseTab && conferenceTab) {
        panel.setAttribute("aria-labelledby", `${phaseTab.id} ${conferenceTab.id}`);
    }
}

function setStandingsPhase(seasonType) {
    selectedStandingsPhase = seasonType;
    document.querySelectorAll(".standings-phase-tab").forEach(tab => {
        const selected = tab.dataset.seasonType === seasonType;
        tab.classList.toggle("active", selected);
        tab.setAttribute("aria-selected", String(selected));
    });
    currentStandings = standingsByPhase.get(`${selectedStandingsSeason}:${seasonType}`) || [];
    updateStandingsPanelLabel();
    renderStandings(currentStandings);
    if (!currentStandings.length) {
        document.getElementById("standingsUpdateStatus").textContent =
            `Loading ${seasonType === "preseason" ? "preseason" : "regular-season"} records…`;
        document.getElementById("standingsTableBody").innerHTML =
            '<tr><td colspan="14" class="standings-empty">Loading selected season records…</td></tr>';
    }
    void loadStandings({ seasonType, season: selectedStandingsSeason, background: true });
}

function selectStandingsSeason(season) {
    if (!season || season === selectedStandingsSeason) return;
    selectedStandingsSeason = season;
    const seasonHeading = document.querySelector("#standingsSection .section-heading");
    if (seasonHeading) seasonHeading.textContent = `${season.replace("-", "–")} NBA STANDINGS`;
    currentStandings = standingsByPhase.get(`${season}:${selectedStandingsPhase}`) || [];
    renderStandings(currentStandings);
    void loadPlayoffBracket(season);
    const statusElement = document.getElementById("standingsUpdateStatus");
    statusElement.textContent = `Loading ${season.replace("-", "–")} ${selectedStandingsPhase} standings…`;
    void loadStandings({ seasonType: selectedStandingsPhase, season, background: true });
}

async function loadStandings({
    background = false,
    seasonType = selectedStandingsPhase,
    season = selectedStandingsSeason
} = {}) {
    if (standingsRequestController) standingsRequestController.abort();
    const controller = new AbortController();
    standingsRequestController = controller;
    const requestSequence = ++standingsRequestSequence;
    const statusElement = document.getElementById("standingsUpdateStatus");
    const tbody = document.getElementById("standingsTableBody");
    try {
        const response = await fetch(
            `${API_URL}/api/v1/standings?season_type=${encodeURIComponent(seasonType)}&season=${encodeURIComponent(season)}`,
            {
                headers: { "x-api-key": API_KEY },
                signal: controller.signal
            }
        );
        if (!response.ok) throw new Error(`Standings request failed (${response.status}).`);
        const payload = await response.json();
        if (payload.season !== season) {
            throw new Error(
                `The deployed API returned the ${payload.season || "current"} season instead of ${season.replace("-", "–")}. Publish the latest api/index.py to enable historical standings.`
            );
        }
        if (!Array.isArray(payload.standings) || payload.standings.length === 0) {
            throw new Error(payload.message || `No ${seasonType} standings are available yet.`);
        }
        if (payload.status === "unavailable") {
            throw new Error(payload.message || `Current ${seasonType} standings are unavailable.`);
        }
        if (requestSequence !== standingsRequestSequence) return;

        standingsByPhase.set(`${season}:${seasonType}`, payload.standings);
        if (seasonType === "regular") refreshPlayoffBracketFromCache(season);
        if (seasonType === selectedStandingsPhase && season === selectedStandingsSeason) {
            currentStandings = payload.standings;
            renderStandings(currentStandings);
            const seasonHeading = document.querySelector("#standingsSection .section-heading");
            if (seasonHeading && payload.season) {
                seasonHeading.textContent = `${payload.season.replace("-", "–")} NBA STANDINGS`;
            }
            const checkedAt = payload.last_updated
                ? new Date(payload.last_updated).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                    timeZone: "Asia/Manila"
                })
                : "";
            const phaseLabel = seasonType === "preseason" ? "Preseason" : "Regular-season";
            const status = payload.status === "stale"
                ? `Showing last available ${phaseLabel.toLowerCase()} standings for ${season.replace("-", "–")}`
                : `${phaseLabel} standings updated for ${season.replace("-", "–")}`;
            statusElement.textContent = `${status}${checkedAt ? ` · ${checkedAt} PHT` : ""}${payload.source ? ` · ${payload.source}` : ""}`;
            statusElement.classList.toggle("is-warning", payload.status !== "fresh");
            statusElement.title = payload.message || "";
        }
        if (season === currentNbaSeason() && selectedScheduleSeason === season) {
            renderSchedule();
            const boxScoreDialog = document.getElementById("boxScoreDialog");
            if (activeBoxScoreGameId && boxScoreDialog?.open) {
                void loadBoxScore(activeBoxScoreGameId, { background: true });
            }
        }
        if (season === currentNbaSeason()) {
            const companionPhase = seasonType === "preseason" ? "regular" : "preseason";
            if (!standingsByPhase.has(`${season}:${companionPhase}`)) {
                window.setTimeout(() => {
                    void loadStandings({
                        background: true,
                        seasonType: companionPhase,
                        season
                    });
                }, 0);
            }
        }
        lastStandingsRefreshAt = Date.now();
    } catch (error) {
        if (controller.signal.aborted || requestSequence !== standingsRequestSequence) return;
        console.error("NBA standings refresh failed:", error);
        statusElement.textContent = error instanceof Error
            ? `${error.message} Standings will retry automatically.`
            : "Standings are unavailable. They will retry automatically.";
        statusElement.classList.add("is-warning");
        statusElement.title = error instanceof Error ? error.message : "";
        if (!background && tbody && !tbody.querySelector(".standings-team-cell")) {
            tbody.innerHTML = `<tr><td colspan="14" class="standings-empty">${escapeMarkup(error instanceof Error ? error.message : "Current standings could not be loaded.")}</td></tr>`;
        }
    } finally {
        if (requestSequence === standingsRequestSequence) {
            standingsRequestController = null;
        }
    }
}

function formatBoxScoreStat(value) {
    return value == null || value === "" ? "—" : String(value);
}

function shootingLine(statistics, madeKey, attemptKey) {
    return `${formatBoxScoreStat(statistics[madeKey])}-${formatBoxScoreStat(statistics[attemptKey])}`;
}

function findBoxScoreTeamLogo(team) {
    if (team.logo) return team.logo;
    const teamName = String(team.name || "").trim().toLocaleLowerCase();
    const match = allTeams.find(candidate =>
        candidate.name?.trim().toLocaleLowerCase() === teamName
    );
    return match?.logo || "";
}

function renderBoxScoreScoreboard(payload) {
    const home = payload.home || {};
    const away = payload.away || {};
    const homeLogo = findBoxScoreTeamLogo(home);
    const awayLogo = findBoxScoreTeamLogo(away);
    const status = payload.game_status || "Game";
    const isLive = Number(payload.status_code) === 2
        || /(live|q[1-4]|half|ot|in progress)/i.test(status);
    const periodScores = [away.period_scores || [], home.period_scores || []];
    const periodCount = Math.max(4, ...periodScores.map(scores => scores.length));
    const periods = Array.from({ length: periodCount }, (_, index) => ({
        label: index < 4 ? `Q${index + 1}` : `OT${index - 3}`,
        away: periodScores[0][index],
        home: periodScores[1][index]
    }));
    const periodTable = periods.length ? `
        <div class="box-score-scoreboard__periods-wrap">
            <table class="box-score-period-table">
                <thead><tr>
                    <th scope="col">TEAM</th>
                    ${periods.map(period => `<th scope="col">${period.label}</th>`).join("")}
                    <th scope="col">T</th>
                </tr></thead>
                <tbody>
                    <tr>
                        <th scope="row">${escapeMarkup(away.abbreviation || away.name || "Away")}</th>
                        ${periods.map(period => `<td>${escapeMarkup(formatBoxScoreStat(period.away))}</td>`).join("")}
                        <td class="is-total">${escapeMarkup(formatBoxScoreStat(away.score))}</td>
                    </tr>
                    <tr>
                        <th scope="row">${escapeMarkup(home.abbreviation || home.name || "Home")}</th>
                        ${periods.map(period => `<td>${escapeMarkup(formatBoxScoreStat(period.home))}</td>`).join("")}
                        <td class="is-total">${escapeMarkup(formatBoxScoreStat(home.score))}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    ` : "";

    const matchup = activeBoxScoreGame || payload;
    return `
        <section class="box-score-scoreboard${isLive ? " is-live" : ""}" aria-label="Game score summary">
            <div class="box-score-scoreboard__topline">
                <span class="box-score-scoreboard__league">NBA · ${escapeMarkup(payload.stage || "GAME CENTER")}</span>
                <span class="box-score-scoreboard__status">${escapeMarkup(status)}</span>
            </div>
            <div class="box-score-scoreboard__matchup">
                <div class="box-score-scoreboard__team">
                    ${awayLogo ? `<img src="${escapeMarkup(awayLogo)}" alt="" loading="lazy">` : ""}
                    <span class="box-score-scoreboard__identity">
                        <span>${escapeMarkup(away.name || "Away team")}</span>
                        ${away.record ? `<span class="box-score-scoreboard__record">${escapeMarkup(away.record.text)} · ${escapeMarkup(away.record.label)}</span>` : ""}
                    </span>
                </div>
                <strong class="box-score-scoreboard__score">${escapeMarkup(formatBoxScoreStat(away.score))}</strong>
                <span class="box-score-scoreboard__separator">AT</span>
                <strong class="box-score-scoreboard__score">${escapeMarkup(formatBoxScoreStat(home.score))}</strong>
                <div class="box-score-scoreboard__team box-score-scoreboard__team--home">
                    ${homeLogo ? `<img src="${escapeMarkup(homeLogo)}" alt="" loading="lazy">` : ""}
                    <span class="box-score-scoreboard__identity">
                        <span>${escapeMarkup(home.name || "Home team")}</span>
                        ${home.record ? `<span class="box-score-scoreboard__record">${escapeMarkup(home.record.text)} · ${escapeMarkup(home.record.label)}</span>` : ""}
                    </span>
                </div>
            </div>
            ${payload.series_game ? `<p class="box-score-scoreboard__series">Game ${escapeMarkup(payload.series_game)}</p>` : ""}
            ${renderGameWinProbability(matchup)}
            ${periodTable}
            ${renderGameInjuryReport(matchup)}
        </section>
    `;
}

function renderBoxScoreTeam(team, side) {
    const players = Array.isArray(team.players) ? team.players : [];
    const teamLogo = findBoxScoreTeamLogo(team);
    const teamPrimaryColor = teamColors[team.name]?.primary || "#64748b";
    const playerRows = players.map(player => {
        const stats = player.statistics || {};
        const status = player.played ? formatBoxScoreStat(stats.minutes) : "DNP";
        const headshot = player.headshot_url || getPlayerHeadshotUrl(player.name);
        const fallbackPortrait = getPlayerFallbackPortraitUrl(player.name);
        const jerseyNumber = [
            player.jersey_number,
            player.jerseyNum,
            player.jerseyNumber,
            player.jersey,
            player.uniform
        ].find(value => value != null && String(value).trim() !== "");
        const playerId = String(player.id ?? player.player_id ?? "").trim();
        return `
            <tr class="box-score-row${player.starter ? " is-starter" : ""}${player.played ? "" : " is-dnp"}"
                data-player-id="${escapeMarkup(playerId)}"
                data-player-name="${escapeMarkup(player.name || "")}">
                <td class="box-score-player-cell">
                    <img src="${escapeMarkup(headshot)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${escapeMarkup(fallbackPortrait)}'">
                    <span class="box-score-player-cell__jersey" aria-label="${jerseyNumber !== undefined ? `Jersey number ${escapeMarkup(jerseyNumber)}` : "Jersey number unavailable"}"${jerseyNumber === undefined ? " hidden" : ""}>${jerseyNumber !== undefined ? `#${escapeMarkup(jerseyNumber)}` : ""}</span>
                    <span class="box-score-player-cell__name">${escapeMarkup(player.name)}</span>
                    ${player.starter ? '<span class="box-score-starter-badge">STARTER</span>' : ""}
                </td>
                <td>${escapeMarkup(player.position || "—")}</td>
                <td>${escapeMarkup(player.played ? status : "DNP")}</td>
                <td class="is-highlight">${escapeMarkup(formatBoxScoreStat(stats.points))}</td>
                <td>${escapeMarkup(formatBoxScoreStat(stats.rebounds))}</td>
                <td>${escapeMarkup(formatBoxScoreStat(stats.assists))}</td>
                <td>${escapeMarkup(shootingLine(stats, "field_goals", "field_goals_attempted"))}</td>
                <td>${escapeMarkup(shootingLine(stats, "three_pointers", "three_pointers_attempted"))}</td>
                <td>${escapeMarkup(shootingLine(stats, "free_throws", "free_throws_attempted"))}</td>
                <td>${escapeMarkup(formatBoxScoreStat(stats.steals))}</td>
                <td>${escapeMarkup(formatBoxScoreStat(stats.blocks))}</td>
                <td>${escapeMarkup(formatBoxScoreStat(stats.turnovers))}</td>
                <td>${escapeMarkup(formatBoxScoreStat(stats.fouls))}</td>
                <td>${escapeMarkup(formatBoxScoreStat(stats.plus_minus))}</td>
            </tr>
        `;
    }).join("");
    return `
        <section class="box-score-team box-score-team--${side}" style="--box-score-team-primary: ${escapeMarkup(teamPrimaryColor)}">
            <header class="box-score-team__heading">
                <div class="box-score-team__identity">
                    <span class="box-score-team__side">${side === "away" ? "AWAY TEAM" : "HOME TEAM"}</span>
                    <h3>${teamLogo ? `<img src="${escapeMarkup(teamLogo)}" alt="" class="box-score-team__logo" loading="lazy">` : ""}${escapeMarkup(team.name)}</h3>
                </div>
            </header>
            <div class="box-score-table-wrap" role="region" aria-label="${escapeMarkup(team.name)} player stats" tabindex="0">
                <table class="box-score-player-table">
                    <thead>
                        <tr>
                            <th scope="col">PLAYER</th>
                            <th scope="col">POS</th>
                            <th scope="col">MIN</th>
                            <th scope="col">PTS</th>
                            <th scope="col">REB</th>
                            <th scope="col">AST</th>
                            <th scope="col">FG</th>
                            <th scope="col">3P</th>
                            <th scope="col">FT</th>
                            <th scope="col">STL</th>
                            <th scope="col">BLK</th>
                            <th scope="col">TO</th>
                            <th scope="col">PF</th>
                            <th scope="col">+/-</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${playerRows || '<tr><td colspan="14" class="box-score-player-empty">Player box-score data is not available.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </section>
    `;
}

function boxScorePercentage(made, attempted) {
    const attempts = Number(attempted);
    const makes = Number(made);
    return Number.isFinite(makes) && Number.isFinite(attempts) && attempts > 0
        ? `${(makes / attempts * 100).toFixed(1)}%`
        : "—";
}

function renderBoxScoreTeamStats(away, home) {
    const awayStats = away.team_stats || {};
    const homeStats = home.team_stats || {};
    const awayLogo = findBoxScoreTeamLogo(away);
    const homeLogo = findBoxScoreTeamLogo(home);
    const rows = [
        ["Points", formatBoxScoreStat(away.score), formatBoxScoreStat(home.score)],
        [
            "Field goals",
            `${shootingLine(awayStats, "field_goals", "field_goals_attempted")} · ${boxScorePercentage(awayStats.field_goals, awayStats.field_goals_attempted)}`,
            `${shootingLine(homeStats, "field_goals", "field_goals_attempted")} · ${boxScorePercentage(homeStats.field_goals, homeStats.field_goals_attempted)}`
        ],
        [
            "3-pointers",
            `${shootingLine(awayStats, "three_pointers", "three_pointers_attempted")} · ${boxScorePercentage(awayStats.three_pointers, awayStats.three_pointers_attempted)}`,
            `${shootingLine(homeStats, "three_pointers", "three_pointers_attempted")} · ${boxScorePercentage(homeStats.three_pointers, homeStats.three_pointers_attempted)}`
        ],
        [
            "Free throws",
            `${shootingLine(awayStats, "free_throws", "free_throws_attempted")} · ${boxScorePercentage(awayStats.free_throws, awayStats.free_throws_attempted)}`,
            `${shootingLine(homeStats, "free_throws", "free_throws_attempted")} · ${boxScorePercentage(homeStats.free_throws, homeStats.free_throws_attempted)}`
        ],
        ["Total rebounds", formatBoxScoreStat(awayStats.rebounds), formatBoxScoreStat(homeStats.rebounds)],
        ["Assists", formatBoxScoreStat(awayStats.assists), formatBoxScoreStat(homeStats.assists)],
        ["Blocks", formatBoxScoreStat(awayStats.blocks), formatBoxScoreStat(homeStats.blocks)],
        ["Steals", formatBoxScoreStat(awayStats.steals), formatBoxScoreStat(homeStats.steals)],
        ["Turnovers", formatBoxScoreStat(awayStats.turnovers), formatBoxScoreStat(homeStats.turnovers)],
        ["Personal fouls", formatBoxScoreStat(awayStats.fouls), formatBoxScoreStat(homeStats.fouls)]
    ];
    return `
        <section class="box-score-comparison" aria-label="Team stats comparison">
            <div class="box-score-comparison__teams">
                <div class="box-score-comparison__team">
                    ${awayLogo ? `<img src="${escapeMarkup(awayLogo)}" alt="" loading="lazy">` : ""}
                    <span>${escapeMarkup(away.name || "Away team")}</span>
                </div>
                <h3>TEAM STATS</h3>
                <div class="box-score-comparison__team box-score-comparison__team--home">
                    <span>${escapeMarkup(home.name || "Home team")}</span>
                    ${homeLogo ? `<img src="${escapeMarkup(homeLogo)}" alt="" loading="lazy">` : ""}
                </div>
            </div>
            <div class="box-score-comparison__rows">
                ${rows.map(([label, awayValue, homeValue], index) => `
                    <div class="box-score-comparison__row${[1, 2, 3].includes(index) ? " is-shooting" : ""}">
                        <span class="box-score-comparison__value">${escapeMarkup(awayValue)}</span>
                        <span class="box-score-comparison__label">${label}</span>
                        <span class="box-score-comparison__value">${escapeMarkup(homeValue)}</span>
                    </div>
                `).join("")}
            </div>
        </section>
    `;
}

function renderBoxScorePlayByPlay(payload) {
    if (!payload) {
        return '<p class="box-score-play-by-play__message">Loading play-by-play…</p>';
    }
    if (payload.status === "unavailable") {
        const message = Number(payload.status_code) === 1
            ? "Play-by-play will appear once the game begins."
            : payload.message || "Play-by-play is unavailable for this game.";
        return `<p class="box-score-play-by-play__message">${escapeMarkup(message)}</p>`;
    }
    const plays = Array.isArray(payload.plays) ? [...payload.plays].reverse() : [];
    if (!plays.length) {
        const message = Number(payload.status_code) === 1
            ? "Play-by-play will appear once the game begins."
            : "No play-by-play is available for this game.";
        return `<p class="box-score-play-by-play__message">${escapeMarkup(message)}</p>`;
    }

    const periods = new Map();
    plays.forEach(play => {
        const label = play.period_label || `Period ${play.period || ""}`.trim();
        if (!periods.has(label)) periods.set(label, []);
        periods.get(label).push(play);
    });
    return `
        ${payload.status === "stale"
            ? `<p class="box-score-play-by-play__notice">${escapeMarkup(payload.message || "Showing the last available update.")}</p>`
            : ""}
        <div class="box-score-play-by-play">
            ${[...periods.entries()].map(([period, periodPlays]) => `
                <section class="box-score-play-by-play__period" aria-label="${escapeMarkup(period)}">
                    <h3>${escapeMarkup(period)}</h3>
                    <ol class="box-score-play-by-play__list">
                        ${periodPlays.map(play => `
                            <li class="box-score-play-by-play__item">
                                <div class="box-score-play-by-play__meta">
                                    <span>${escapeMarkup(play.clock || "")}</span>
                                    ${play.team_tricode
                                        ? `<span class="box-score-play-by-play__team">${escapeMarkup(play.team_tricode)}</span>`
                                        : ""}
                                    ${play.home_score != null && play.away_score != null
                                        ? `<span class="box-score-play-by-play__score">${escapeMarkup(play.away_score)}–${escapeMarkup(play.home_score)}</span>`
                                        : ""}
                                </div>
                                <div class="box-score-play-by-play__detail">
                                    <strong>${escapeMarkup(play.type || "Play")}</strong>
                                    <p>${escapeMarkup(play.text || "")}</p>
                                </div>
                            </li>
                        `).join("")}
                    </ol>
                </section>
            `).join("")}
        </div>
        <p class="box-score-play-by-play__source">${escapeMarkup(payload.source || "Play-by-play")}${payload.last_updated
            ? ` · Updated ${escapeMarkup(new Date(payload.last_updated).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }))}`
            : ""}</p>
    `;
}

function renderBoxScoreTabs(payload, activeTab = "home", playByPlay = null) {
    const away = payload.away || {};
    const home = payload.home || {};
    const tabs = [
        { id: "home", team: home, label: home.name || "Home" },
        { id: "away", team: away, label: away.name || "Away" },
        { id: "stats", label: "Stats" },
        { id: "plays", label: "Play-by-play" }
    ];
    return `
        <div class="box-score-sections">
            <div class="box-score-tabs" role="tablist" aria-label="Box score sections">
                ${tabs.map(tab => {
                    const selected = tab.id === activeTab;
                    const logo = tab.team ? findBoxScoreTeamLogo(tab.team) : "";
                    return `
                        <button
                            id="box-score-tab-${tab.id}"
                            class="box-score-tabs__tab"
                            type="button"
                            role="tab"
                            aria-selected="${selected}"
                            aria-controls="box-score-panel-${tab.id}"
                            tabindex="${selected ? "0" : "-1"}"
                            data-box-score-tab="${tab.id}"
                        >
                            ${logo ? `<img src="${escapeMarkup(logo)}" alt="" loading="lazy">` : ""}
                            <span>${escapeMarkup(tab.label)}</span>
                        </button>
                    `;
                }).join("")}
            </div>
            <section id="box-score-panel-home" class="box-score-tab-panel" role="tabpanel" aria-labelledby="box-score-tab-home" tabindex="0"${activeTab === "home" ? "" : " hidden"}>
                ${renderBoxScoreTeam(home, "home")}
            </section>
            <section id="box-score-panel-away" class="box-score-tab-panel" role="tabpanel" aria-labelledby="box-score-tab-away" tabindex="0"${activeTab === "away" ? "" : " hidden"}>
                ${renderBoxScoreTeam(away, "away")}
            </section>
            <section id="box-score-panel-stats" class="box-score-tab-panel" role="tabpanel" aria-labelledby="box-score-tab-stats" tabindex="0"${activeTab === "stats" ? "" : " hidden"}>
                ${renderBoxScoreTeamStats(away, home)}
            </section>
            <section id="box-score-panel-plays" class="box-score-tab-panel" role="tabpanel" aria-labelledby="box-score-tab-plays" tabindex="0"${activeTab === "plays" ? "" : " hidden"}>
                ${renderBoxScorePlayByPlay(playByPlay)}
            </section>
        </div>
    `;
}

function setActiveBoxScoreTab(content, tabId) {
    content.querySelectorAll("[data-box-score-tab]").forEach(tab => {
        const selected = tab.dataset.boxScoreTab === tabId;
        tab.setAttribute("aria-selected", String(selected));
        tab.tabIndex = selected ? 0 : -1;
    });
    content.querySelectorAll(".box-score-tab-panel").forEach(panel => {
        panel.hidden = panel.id !== `box-score-panel-${tabId}`;
    });
}

async function loadBoxScorePlayByPlay(gameId, { background = false } = {}) {
    if (
        !gameId
        || activeBoxScoreGameId !== gameId
        || boxScorePlayByPlayRequests.has(gameId)
    ) return;

    boxScorePlayByPlayRequests.add(gameId);
    try {
        const response = await fetch(
            `${API_URL}/api/v1/games/${encodeURIComponent(gameId)}/play-by-play?season=${encodeURIComponent(activeBoxScoreSeason)}`,
            { headers: { "x-api-key": API_KEY } }
        );
        if (!response.ok) throw new Error(`Play-by-play request failed (${response.status}).`);
        const payload = await response.json();
        if (activeBoxScoreGameId !== gameId) return;
        boxScorePlayByPlayCache.set(gameId, payload);
        const panel = document.getElementById("box-score-panel-plays");
        if (panel) panel.innerHTML = renderBoxScorePlayByPlay(payload);

        if (playByPlayRefreshInterval) {
            window.clearInterval(playByPlayRefreshInterval);
            playByPlayRefreshInterval = null;
        }
        const isLive = Number(payload.status_code) === 2
            || /(live|in progress|q[1-4]|ot|half)/i.test(payload.game_status || "");
        if (isLive) {
            playByPlayRefreshInterval = window.setInterval(
                () => loadBoxScorePlayByPlay(gameId, { background: true }),
                15 * 1000
            );
        }
    } catch (error) {
        console.error("Play-by-play load failed:", error);
        if (activeBoxScoreGameId !== gameId) return;
        const panel = document.getElementById("box-score-panel-plays");
        if (panel && !background) {
            panel.innerHTML = `<p class="box-score-play-by-play__message">Could not load play-by-play. Please try again.</p>`;
        }
        if (playByPlayRefreshInterval) {
            window.clearInterval(playByPlayRefreshInterval);
            playByPlayRefreshInterval = null;
        }
    } finally {
        boxScorePlayByPlayRequests.delete(gameId);
    }
}

function applyBoxScoreJerseyNumbers(gameId, jerseyData) {
    const content = document.getElementById("boxScoreContent");
    if (!content || activeBoxScoreGameId !== gameId || !jerseyData) return;

    const jerseys = [...(jerseyData.home || []), ...(jerseyData.away || [])];
    const rows = [...content.querySelectorAll(".box-score-row")];
    for (const jersey of jerseys) {
        const jerseyNumber = String(jersey.jersey_number ?? "").trim();
        if (!jerseyNumber) continue;
        const jerseyId = String(jersey.id ?? "").trim();
        const jerseyName = String(jersey.name ?? "").trim().toLocaleLowerCase();
        const row = rows.find(candidate =>
            (jerseyId && candidate.dataset.playerId === jerseyId)
            || (jerseyName
                && candidate.dataset.playerName?.trim().toLocaleLowerCase() === jerseyName)
        );
        const badge = row?.querySelector(".box-score-player-cell__jersey");
        if (!badge) continue;
        badge.textContent = `#${jerseyNumber}`;
        badge.setAttribute("aria-label", `Jersey number ${jerseyNumber}`);
        badge.hidden = false;
    }
}

async function loadBoxScoreJerseyNumbers(gameId) {
    const content = document.getElementById("boxScoreContent");
    if (
        !content
        || activeBoxScoreGameId !== gameId
        || boxScoreJerseyLoaded.has(gameId)
        || boxScoreJerseyRequests.has(gameId)
        || !content.querySelector(".box-score-player-cell__jersey[hidden]")
    ) return;

    boxScoreJerseyRequests.add(gameId);
    try {
        const response = await fetch(`${API_URL}/api/v1/games/${encodeURIComponent(gameId)}/jerseys?season=${encodeURIComponent(activeBoxScoreSeason)}`, {
            headers: { "x-api-key": API_KEY }
        });
        if (!response.ok) throw new Error(`Jersey lookup failed (${response.status}).`);
        const jerseyData = await response.json();
        boxScoreJerseyResults.set(gameId, jerseyData);
        boxScoreJerseyLoaded.add(gameId);
        applyBoxScoreJerseyNumbers(gameId, jerseyData);
    } catch (error) {
        console.warn("Box-score jersey lookup failed:", error);
    } finally {
        boxScoreJerseyRequests.delete(gameId);
    }
}

async function loadBoxScore(gameId, { background = false } = {}) {
    if (!gameId || activeBoxScoreGameId !== gameId) return;
    const isHistoricalGame = activeBoxScoreSeason !== currentNbaSeason();
    const statusElement = document.getElementById("boxScoreStatus");
    const content = document.getElementById("boxScoreContent");
    const gameContext = activeBoxScoreGame
        ? `${activeBoxScoreSeason.replace("-", "–")} season · ${formatScheduleDate(activeBoxScoreGame.date, { month: "long", day: "numeric", year: "numeric" })}`
        : activeBoxScoreSeason.replace("-", "–");
    const seriesGame = activeBoxScoreGame
        ? playoffSeriesGameNumber(activeBoxScoreGame, activeBoxScoreSeason)
        : null;
    try {
        const response = await fetch(`${API_URL}/api/v1/games/${encodeURIComponent(gameId)}/boxscore?season=${encodeURIComponent(activeBoxScoreSeason)}`, {
            headers: { "x-api-key": API_KEY }
        });
        if (!response.ok) throw new Error(`Box score request failed (${response.status}).`);
        const payload = await response.json();
        if (activeBoxScoreGameId !== gameId) return;
        if (payload.status === "unavailable" || !payload.home || !payload.away) {
            statusElement.textContent = `${gameContext} · ${payload.message || "Player box-score data is not available yet. Checking again shortly."}`;
            if (!background) content.innerHTML = "";
            if (boxScoreRefreshInterval) window.clearInterval(boxScoreRefreshInterval);
            if (!isHistoricalGame) {
                boxScoreRefreshInterval = window.setInterval(
                    () => loadBoxScore(gameId, { background: true }),
                    20 * 1000
                );
            }
            return;
        }

        const updatedAt = payload.last_updated
            ? new Date(payload.last_updated).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
                timeZone: "Asia/Manila"
            })
            : "";
        statusElement.textContent = `${gameContext}${seriesGame ? ` · Game ${seriesGame}` : ""} · ${payload.game_status || "Game"}${updatedAt ? ` · Updated ${updatedAt}` : ""}${payload.status === "stale" ? " · Showing last available box score" : ""}`;
        const selectedTab = content.querySelector('[data-box-score-tab][aria-selected="true"]')
            ?.dataset.boxScoreTab || "home";
        const scrollPositions = background
            ? {
                content: content.scrollTop,
                teams: [...content.querySelectorAll(".box-score-table-wrap")].map(table => table.scrollTop)
            }
            : null;
        const gamePayload = activeBoxScoreGame
            ? {
                ...payload,
                stage: activeBoxScoreGame.stage || payload.stage,
                series_game: seriesGame,
                home: {
                    ...payload.home,
                    record: teamRecordForGame(activeBoxScoreGame.home, activeBoxScoreGame)
                },
                away: {
                    ...payload.away,
                    record: teamRecordForGame(activeBoxScoreGame.away, activeBoxScoreGame)
                }
            }
            : payload;
        content.innerHTML = [
            renderBoxScoreScoreboard(gamePayload),
            renderBoxScoreTabs(
                gamePayload,
                selectedTab,
                boxScorePlayByPlayCache.get(gameId) || null
            )
        ].join("");
        content.scrollTop = scrollPositions?.content || 0;
        content.querySelectorAll(".box-score-table-wrap").forEach((table, index) => {
            table.scrollTop = scrollPositions?.teams[index] || 0;
        });
        applyBoxScoreJerseyNumbers(gameId, boxScoreJerseyResults.get(gameId));
        void loadBoxScoreJerseyNumbers(gameId);
        const isLive = Number(payload.status_code) === 2
            || /(live|q[1-4]|half|ot|in progress)/i.test(payload.game_status || "");
        if (boxScoreRefreshInterval) {
            window.clearInterval(boxScoreRefreshInterval);
            boxScoreRefreshInterval = null;
        }
        if (isLive || Number(payload.status_code) === 1) {
            boxScoreRefreshInterval = window.setInterval(
                () => loadBoxScore(gameId, { background: true }),
                20 * 1000
            );
        }
    } catch (error) {
        if (activeBoxScoreGameId !== gameId) return;
        console.error("Game box score load failed:", error);
        statusElement.textContent = `${gameContext} · ${isHistoricalGame
            ? "Could not load this archived box score. Please try again later."
            : "Could not refresh this box score. Retrying shortly."}`;
        if (!background) content.innerHTML = "";
        if (boxScoreRefreshInterval) window.clearInterval(boxScoreRefreshInterval);
        if (!isHistoricalGame) {
            boxScoreRefreshInterval = window.setInterval(
                () => loadBoxScore(gameId, { background: true }),
                20 * 1000
            );
        }
    }
}

function openBoxScore(gameId, season = selectedScheduleSeason) {
    const seasonGames = playoffScheduleBySeason.get(season)
        || (season === selectedScheduleSeason ? scheduleGames : []);
    const game = seasonGames.find(item => item.id === gameId);
    const dialog = document.getElementById("boxScoreDialog");
    if (!game || !dialog) return;
    if (boxScoreRefreshInterval) {
        window.clearInterval(boxScoreRefreshInterval);
        boxScoreRefreshInterval = null;
    }
    if (playByPlayRefreshInterval) {
        window.clearInterval(playByPlayRefreshInterval);
        playByPlayRefreshInterval = null;
    }
    activeBoxScoreGameId = gameId;
    activeBoxScoreGame = game;
    activeBoxScoreSeason = season;
    document.getElementById("boxScoreTitle").textContent =
        `${game.away} at ${game.home} · ${activeBoxScoreSeason.replace("-", "–")}`;
    document.getElementById("boxScoreBadge").textContent =
        activeBoxScoreSeason === currentNbaSeason()
            ? "LIVE GAME CENTER"
            : "HISTORICAL GAME CENTER";
    const statusElement = document.getElementById("boxScoreStatus");
    const content = document.getElementById("boxScoreContent");
    const gameContext = `${activeBoxScoreSeason.replace("-", "–")} season · ${formatScheduleDate(game.date, { month: "long", day: "numeric", year: "numeric" })}`;
    const seriesGame = playoffSeriesGameNumber(game, season);
    statusElement.textContent = `${gameContext}${seriesGame ? ` · Game ${seriesGame}` : ""} · ${activeBoxScoreSeason === currentNbaSeason()
        ? "Checking for the latest score and player stats…"
        : "Archived box score"}`;
    content.innerHTML = '<p class="box-score-loading">Loading player box score…</p>';
    if (!dialog.open) dialog.showModal();
    loadBoxScore(gameId);
    loadBoxScorePlayByPlay(gameId);
    if (activeBoxScoreSeason === currentNbaSeason()) {
        loadLiveScores({ background: true });
    }
}

function closeBoxScore() {
    const dialog = document.getElementById("boxScoreDialog");
    if (dialog?.open) dialog.close();
    activeBoxScoreGameId = "";
    activeBoxScoreGame = null;
    activeBoxScoreSeason = "";
    if (boxScoreRefreshInterval) {
        window.clearInterval(boxScoreRefreshInterval);
        boxScoreRefreshInterval = null;
    }
    if (playByPlayRefreshInterval) {
        window.clearInterval(playByPlayRefreshInterval);
        playByPlayRefreshInterval = null;
    }
}

function refreshHeadlineSlides() {
    const staticStories = DEFAULT_HEADLINE_STORIES.map((story, index) => ({
        ...story,
        id: `default-story-${index}`,
        kind: story.kind || "news",
        category: story.category || "NBA NEWS"
    }));

    headlineItems = [...headlineScoreItems, ...newsItems];
    if (!headlineItems.length) {
        headlineItems = staticStories;
    }
    currentHeadlineIndex = Math.min(currentHeadlineIndex, headlineItems.length - 1);
    setupHeadlineDots();
    updateHeadline(currentHeadlineIndex);
}

function findNbaTeamByTricode(tricode) {
    const canonicalTricode = canonicalNbaTricode(tricode);
    const scheduledGame = scheduleGames.find(game =>
        canonicalNbaTricode(game.home_tricode) === canonicalTricode
        || canonicalNbaTricode(game.away_tricode) === canonicalTricode
    );
    if (!scheduledGame) return null;
    const isHomeTeam = canonicalNbaTricode(scheduledGame.home_tricode) === canonicalTricode;
    const teamName = isHomeTeam ? scheduledGame.home : scheduledGame.away;
    const team = allTeams.find(candidate => candidate.name === teamName);
    return {
        name: teamName,
        logo: (isHomeTeam ? scheduledGame.home_logo : scheduledGame.away_logo)
            || team?.logo
            || ""
    };
}

function hydrateScoreHeadlineTeams() {
    headlineScoreItems = headlineScoreItems.map(item => {
        const homeTeam = findNbaTeamByTricode(item.homeTricode);
        const awayTeam = findNbaTeamByTricode(item.awayTricode);
        const featuredTeam = findNbaTeamByTricode(item.leadingTricode);
        const isFinal = item.category === "FINAL SCORE";
        if (isFinal && featuredTeam) {
            const otherTeam = item.leadingTricode === item.homeTricode ? awayTeam : homeTeam;
            const winnerScore = Math.max(item.homeScore, item.awayScore);
            const otherScore = Math.min(item.homeScore, item.awayScore);
            return {
                ...item,
                teamName: featuredTeam.name,
                teamLogo: featuredTeam.logo,
                headline: `${featuredTeam.name} win ${winnerScore}–${otherScore}`,
                story: `${featuredTeam.name} defeated ${otherTeam?.name || "their opponent"} ${winnerScore}–${otherScore}. Final score.`
            };
        }
        if (featuredTeam) {
            const winnerScore = Math.max(item.homeScore, item.awayScore);
            const otherScore = Math.min(item.homeScore, item.awayScore);
            return {
                ...item,
                teamName: featuredTeam.name,
                teamLogo: featuredTeam.logo,
                headline: `${featuredTeam.name} lead · ${item.awayScore}–${item.homeScore}`,
                story: `${featuredTeam.name} lead ${winnerScore}–${otherScore}. ${item.story.split(". Follow")[0]}. Follow the live box score.`
            };
        }
        return item;
    });
}

function headlineTeamLogo(item) {
    if (item.teamLogo) return item.teamLogo;
    if (item.leadingTricode) {
        const scoreTeam = findNbaTeamByTricode(item.leadingTricode);
        if (scoreTeam) {
            item.teamName = scoreTeam.name;
            item.teamLogo = scoreTeam.logo;
            return scoreTeam.logo || "https://cdn.nba.com/logos/leagues/logo-nba.svg";
        }
    }
    const findTeam = text => {
        const matches = [];
        const knownTeams = new Map();
        allTeams.forEach(team => knownTeams.set(team.name, team));
        scheduleGames.forEach(game => {
            if (game.home) knownTeams.set(game.home, { name: game.home, logo: game.home_logo });
            if (game.away) knownTeams.set(game.away, { name: game.away, logo: game.away_logo });
        });
        [...knownTeams.values()].forEach(team => {
            const words = String(team.name || "").split(/\s+/).filter(Boolean);
            const aliases = [
                team.name,
                words.slice(-1).join(" "),
                words.slice(-2).join(" ")
            ].filter(Boolean);
            aliases.forEach(alias => {
                const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                const match = new RegExp(`\\b${escapedAlias}\\b`, "i").exec(text);
                if (match) {
                    matches.push({ team, index: match.index, aliasLength: alias.length });
                }
            });
        });
        return matches.sort((left, right) =>
            left.index - right.index || right.aliasLength - left.aliasLength
        )[0]?.team;
    };
    const headlineTeam = findTeam(String(item.headline || ""))
        || findTeam(String(item.story || ""));
    if (headlineTeam) {
        item.teamName = headlineTeam.name;
        item.teamLogo = headlineTeam.logo;
    }
    return item.teamLogo || "https://cdn.nba.com/logos/leagues/logo-nba.svg";
}

function updateHeadline(index) {
    if (!headlineItems.length) return;
    currentHeadlineIndex = index;
    const item = headlineItems[currentHeadlineIndex];

    const content = document.querySelector(".hero-content");

    if (content) {
        content.style.animation = 'none';
        void content.offsetWidth;
        content.style.animation = 'heroSlideIn 0.45s var(--ease-out-expo) forwards';
    }

    document.getElementById("newsCategory").textContent = item.category || "NBA NEWS";
    document.getElementById("newsHeadline").textContent = item.headline || "NBA headlines";
    document.getElementById("newsStory").textContent = item.story || "";
    const publishedAt = item.published
        ? new Date(item.published).toLocaleDateString([], {
            month: "short",
            day: "numeric",
            year: "numeric",
            timeZone: "Asia/Manila"
        })
        : item.kind === "score" ? "Updated live" : "";
    document.getElementById("newsPill1").textContent = item.source || "NBA";
    document.getElementById("newsPill2").textContent = publishedAt;
    document.getElementById("newsPill3").textContent = item.kind === "score"
        ? "Today's score"
        : "Latest story";
    document.getElementById("newsPill2").hidden = !publishedAt;

    const img = document.getElementById("newsImage");
    img.alt = item.teamName
        ? `${item.teamName} logo`
        : item.kind === "score" ? "NBA score highlight" : "NBA logo";
    img.src = headlineTeamLogo(item);
    img.onerror = () => {
        img.onerror = null;
        img.hidden = true;
    };
    img.hidden = false;
    const articleLink = document.getElementById("newsArticleLink");
    articleLink.href = item.url || "https://www.espn.ph/nba/";
    articleLink.textContent = item.kind === "score" ? "View scores" : "Read on ESPN";
    articleLink.setAttribute("aria-label", `${articleLink.textContent}: ${item.headline}`);
    articleLink.target = item.kind === "score" ? "" : "_blank";
    articleLink.rel = item.kind === "score" ? "" : "noopener noreferrer";

    const dots = document.querySelectorAll(".hero-dot");
    dots.forEach((dot, idx) => {
        dot.classList.toggle("active", idx === currentHeadlineIndex);
        dot.setAttribute("aria-current", idx === currentHeadlineIndex ? "true" : "false");
    });
}

function prevHeadline() {
    currentHeadlineIndex = (currentHeadlineIndex - 1 + headlineItems.length) % headlineItems.length;
    updateHeadline(currentHeadlineIndex);
    resetHeadlineAutoPlay();
}

function nextHeadline() {
    currentHeadlineIndex = (currentHeadlineIndex + 1) % headlineItems.length;
    updateHeadline(currentHeadlineIndex);
    resetHeadlineAutoPlay();
}

function setupHeadlineDots() {
    const dotsContainer = document.getElementById("heroDots");
    if (!dotsContainer) return;
    dotsContainer.innerHTML = "";
    headlineItems.forEach((item, idx) => {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = `hero-dot ${idx === 0 ? "active" : ""}`;
        dot.setAttribute("aria-label", `Show headline ${idx + 1}: ${item.headline}`);
        dot.setAttribute("aria-current", idx === 0 ? "true" : "false");
        dot.onclick = () => {
            updateHeadline(idx);
            resetHeadlineAutoPlay();
        };
        dotsContainer.appendChild(dot);
    });
}

function startHeadlineAutoPlay() {
    headlineAutoTimer = setInterval(() => {
        if (document.hidden || headlineItems.length < 2) return;
        currentHeadlineIndex = (currentHeadlineIndex + 1) % headlineItems.length;
        updateHeadline(currentHeadlineIndex);
    }, 9000);
}

function resetHeadlineAutoPlay() {
    clearInterval(headlineAutoTimer);
    startHeadlineAutoPlay();
}

async function loadHeadlines({ background = false } = {}) {
    if (isRefreshingNews) return;
    isRefreshingNews = true;
    const statusElement = document.getElementById("newsFeedStatus");
    try {
        const response = await fetch(`${API_URL}/api/v1/news`, {
            headers: { "x-api-key": API_KEY }
        });
        if (!response.ok) throw new Error(`NBA news request failed (${response.status}).`);
        const payload = await response.json();
        if (!Array.isArray(payload.items) || !payload.items.length) {
            throw new Error(payload.message || "The NBA news feed is empty.");
        }

        newsItems = payload.items;
        lastNewsRefreshAt = Date.now();
        refreshHeadlineSlides();

        const refreshedAt = payload.last_updated
            ? new Date(payload.last_updated).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
                timeZone: "Asia/Manila"
            })
            : "";

        statusElement.textContent = payload.status === "stale"
            ? "ESPN refresh is delayed · showing the last available NBA headlines"
            : `NBA news from ESPN · updated ${refreshedAt} · refreshes automatically`;
        statusElement.classList.toggle("is-warning", payload.status === "stale");
    } catch (error) {
        console.error("NBA headlines could not be refreshed:", error);
        if (!background || !newsItems.length) {
            const message = error instanceof Error ? error.message : String(error);
            statusElement.textContent = message.includes("(404)")
                ? "The live news API is not deployed yet. Publish the updated api/index.py to enable current headlines."
                : newsItems.length
                    ? "Could not refresh NBA news · showing the last available headlines"
                    : "NBA headlines are temporarily unavailable. Live scores and standings remain available below.";
            statusElement.classList.add("is-warning");
        }
        if (!newsItems.length) {
            newsItems = DEFAULT_HEADLINE_STORIES.map((story, index) => ({
                ...story,
                id: `default-story-${index}`,
                category: story.category || "NBA NEWS",
                kind: story.kind || "news"
            }));
            refreshHeadlineSlides();
        }
    } finally {
        isRefreshingNews = false;
    }
}

function handleGlobalSearch() {
    const input = document.getElementById("globalSearchInput");
    const query = input.value.trim().toLowerCase();
    const dropdown = document.getElementById("globalSearchResults");

    if (!query) {
        dropdown.classList.remove("open");
        dropdown.innerHTML = "";
        return;
    }

    const matchedTeams = allTeams.filter(t => 
        t.name.toLowerCase().includes(query) ||
        t.division.toLowerCase().includes(query) ||
        t.conference.toLowerCase().includes(query)
    );

    const matchedPlayers = [];
    allTeams.forEach(team => {
        const roster = [...(team.starters_2026_27 || []), ...(team.bench_2026_27 || [])];
        roster.forEach(player => {
            if (player.name.toLowerCase().includes(query) || player.pos.toLowerCase() === query) {
                matchedPlayers.push({
                    player: player,
                    team: team
                });
            }
        });
    });

    if (matchedTeams.length === 0 && matchedPlayers.length === 0) {
        dropdown.innerHTML = `<div style="padding: 16px; text-align: center; color: #94a3b8; font-size: 0.85rem;">No players or teams found matching "${query}".</div>`;
        dropdown.classList.add("open");
        return;
    }

    let html = "";

    if (matchedPlayers.length > 0) {
        html += `<div class="dropdown-section-title">Players (${matchedPlayers.length})</div>`;
        matchedPlayers.slice(0, 8).forEach(item => {
            const photoUrl = getPlayerHeadshotUrl(item.player.name);
            const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.player.name)}&background=082138&color=facc15&bold=true`;
            const ppg = formatPlayerSeasonStat(item.player, "pts");
            const rpg = formatPlayerSeasonStat(item.player, "reb");

            html += `
                <div class="dropdown-item" onclick="selectSearchedPlayer('${item.player.name.replace(/'/g, "\\'")}', ${item.team.id})">
                    <img src="${photoUrl}" alt="${item.player.name}" class="dropdown-player-img" onerror="this.src='${DEFAULT_AVATAR_FALLBACK}'">
                    <div class="dropdown-item-info">
                        <div class="dropdown-item-title">${item.player.name} <span style="font-size:0.75rem; color:var(--nba-red); font-weight:800;">${item.player.pos}</span></div>
                        <div class="dropdown-item-subtitle">${item.team.name} • ${ppg} PPG, ${rpg} RPG</div>
                    </div>
                </div>
            `;
        });
    }

    if (matchedTeams.length > 0) {
        html += `<div class="dropdown-section-title">Teams (${matchedTeams.length})</div>`;
        matchedTeams.slice(0, 4).forEach(team => {
            html += `
                <div class="dropdown-item" onclick="selectSearchedTeam(${team.id})">
                    <img src="${team.logo}" alt="${team.name}" class="dropdown-team-logo" onerror="this.src='https://cdn.nba.com/logos/nba/1610612738/primary/L/logo.svg'">
                    <div class="dropdown-item-info">
                        <div class="dropdown-item-title">${team.name}</div>
                        <div class="dropdown-item-subtitle">${team.conference} • ${team.division} Division</div>
                    </div>
                </div>
            `;
        });
    }

    dropdown.innerHTML = html;
    dropdown.classList.add("open");
}

function clearGlobalSearch() {
    const input = document.getElementById("globalSearchInput");
    input.value = "";
    document.getElementById("globalSearchResults").classList.remove("open");
}

function selectSearchedTeam(teamId) {
    clearGlobalSearch();
    const team = allTeams.find(t => t.id === teamId);
    if (team) {
        openModal(team);
    }
}

function selectSearchedPlayer(playerName, teamId) {
    clearGlobalSearch();
    const team = allTeams.find(t => t.id === teamId);
    if (!team) return;
    const roster = [...(team.starters_2026_27 || []), ...(team.bench_2026_27 || [])];
    const player = roster.find(p => p.name.toLowerCase() === playerName.toLowerCase());
    if (player) {
        openPlayerModal(player, team);
    }
}

document.addEventListener("click", function(event) {
    const container = document.querySelector(".nav-search-container");
    if (container && !container.contains(event.target)) {
        const dropdown = document.getElementById("globalSearchResults");
        if (dropdown) dropdown.classList.remove("open");
    }
});

function getTransactionType(item) {
    const details = `${item?.type || ""} ${item?.text || ""}`.toLocaleLowerCase();
    if (details.includes("trade")) return "TRADE";
    if (details.includes("waiv") || details.includes("release")) return "WAIVED";
    if (details.includes("draft") || details.includes("select")) return "DRAFT";
    if (/\bextension\b|\bextend(?:s|ed)?\b/.test(details)) return "EXTENSION";
    if (/\bsign(?:s|ed|ing)?\b|\bcontract\b|\bfree agent\b/.test(details)) return "SIGNING";
    return item?.type || "OTHER";
}

function setTxFilter(type, element) {
    selectedTxFilter = type;
    document.querySelectorAll(".tx-tab").forEach(tab => tab.classList.remove("active"));
    if (element) element.classList.add("active");
    filterTransactions();
}

function updateTransactionsStatus() {
    const statusElement = document.getElementById("transactionsUpdateStatus");
    if (!statusElement) return;
    const status = transactionsFeedStatus?.status || "unavailable";
    const refreshedAt = transactionsFeedStatus?.last_updated
        ? new Date(transactionsFeedStatus.last_updated).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
        : "";
    if (status === "fresh") {
        statusElement.textContent = `${transactionsFeedStatus.count || 0} NBA transactions · checked ${refreshedAt}.`;
    } else if (status === "stale") {
        statusElement.textContent = `Showing the last successful NBA transaction update${refreshedAt ? ` from ${refreshedAt}` : ""}.`;
    } else {
        statusElement.textContent = transactionsFeedStatus?.message || "The transaction feed is unavailable; no unverified transaction list is shown.";
    }
    statusElement.title = transactionsFeedStatus?.message || "";
    statusElement.classList.toggle("is-warning", status !== "fresh");
}

function filterTransactions() {
    const container = document.getElementById("transactionsTimeline");
    container.innerHTML = "";
    updateTransactionsStatus();

    rawTimelineTransactions.forEach(group => {
        const filteredItems = group.items.filter(item => {
            return selectedTxFilter === "ALL" || getTransactionType(item) === selectedTxFilter;
        });

        if (filteredItems.length > 0) {
            const groupEl = document.createElement("div");
            groupEl.className = "tx-date-group";

            const dateHeader = document.createElement("div");
            dateHeader.className = "tx-date-header";
            dateHeader.innerText = group.date;
            groupEl.appendChild(dateHeader);

            const itemsGrid = document.createElement("div");
            itemsGrid.className = "tx-items-grid";

            filteredItems.forEach((item, itemIdx) => {
                const card = document.createElement("div");
                card.className = "tx-card";
                card.style.animation = `heroSlideIn 0.38s var(--ease-out-expo) forwards`;
                card.style.animationDelay = `${Math.min(itemIdx * 0.035, 0.4)}s`;

                const teamName = String(item.team || "").trim().toLocaleLowerCase();
                const team = allTeams.find(candidate =>
                    String(candidate.name || "").trim().toLocaleLowerCase() === teamName
                );
                const logo = item.logo || team?.logo || "";
                const logoMarkup = logo
                    ? `<img src="${escapeMarkup(logo)}" alt="" class="tx-team-logo" onerror="this.remove()">`
                    : "";
                const transactionType = getTransactionType(item);

                card.innerHTML = `
                    ${logoMarkup}
                    <div class="tx-card-right">
                        <div class="tx-meta-row">
                            <span class="tx-badge tx-badge-${escapeMarkup(transactionType)}">${escapeMarkup(transactionType.replace('_', ' '))}</span>
                        </div>
                        <h4 class="tx-title">${escapeMarkup(item.team)}</h4>
                        <p class="tx-desc">${escapeMarkup(item.text)}</p>
                    </div>
                `;
                itemsGrid.appendChild(card);
            });

            groupEl.appendChild(itemsGrid);
            container.appendChild(groupEl);
        }
    });
    if (!container.childElementCount) {
        const empty = document.createElement("p");
        empty.className = "transactions-empty";
        empty.textContent = transactionsFeedStatus?.status === "unavailable"
            ? "No verified transaction updates are available right now."
            : "No transactions match this filter.";
        container.appendChild(empty);
    }
}

function applyTeamThemeToElement(element, teamName) {
    const colors = teamColors[teamName] || { primary: "#c9082a", dark: "#051c2d" };
    if (!element) return;

    element.style.setProperty("--team-primary", colors.primary);
    element.style.setProperty("--team-dark", colors.dark);
}

function displayTeams(teams) {
    const grid = document.getElementById("teamGrid");
    grid.innerHTML = "";

    if (!teams || teams.length === 0) {
        grid.innerHTML = "<p style='grid-column: 1/-1; text-align:center; color:#64748b; padding: 40px 0;'>No teams found matching your selection.</p>";
        return;
    }

    teams.forEach((team, index) => {
        const card = document.createElement("div");
        card.className = "watch-card";
        card.style.animation = `heroSlideIn 0.42s var(--ease-out-expo) forwards`;
        card.style.animationDelay = `${Math.min(index * 0.035, 0.45)}s`;
        card.onclick = () => openModal(team);
        applyTeamThemeToElement(card, team.name);

        const formattedSalary = typeof team.total_salary === "number" ? `$${team.total_salary.toLocaleString()}` : "Payroll unavailable";
        const yearsString = team.championship_years?.length ? team.championship_years.join(", ") : "None";
        const taxStatus = team.tax_status || "Unavailable";

        card.innerHTML = `
            <div class="card-top">
                <img src="${team.logo}" alt="${team.name}" onerror="this.src='https://cdn.nba.com/logos/nba/1610612738/primary/L/logo.svg'">
            </div>
            <div class="card-bottom">
                <p class="card-brand">${team.conference} • ${team.division}</p>
                <h4 class="card-title">${team.name}</h4>
                <p class="card-subtitle">Star: ${team.featured_star}</p>
                <div style="font-size: 0.78rem; font-weight: 700; color: #64748b; margin-top: 6px; line-height: 1.4;">
                    <div>Last Season: <strong style="color:#111827;">${team.last_season_record}</strong></div>
                    <div>Championships: <strong style="color:#111827;">${team.championships ?? "—"}</strong></div>
                    <div>Years: <strong style="color:#111827;">${yearsString}</strong></div>
                </div>
                <div style="margin-top: 10px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 0.8rem; font-weight: 800; color: #111827;">${formattedSalary}</span>
                    <span class="tx-badge tx-badge-${taxStatus.replace(' ', '_')}">${taxStatus}</span>
                </div>
            </div>
        `;

        grid.appendChild(card);
    });
}

function toggleDivisionFilter(divisionName, element) {
    const isAlreadySelected = element.classList.contains("active");

    document.querySelectorAll(".division-btn").forEach(btn => btn.classList.remove("active"));

    if (isAlreadySelected) {
        selectedDivision = "";
    } else {
        selectedDivision = divisionName;
        element.classList.add("active");

        const matchingConf = DIVISION_CONF_MAP[divisionName];
        if (matchingConf) {
            selectedConference = matchingConf;
            document.querySelectorAll(".conf-tab").forEach(tab => {
                tab.classList.toggle("active", tab.innerText.toLowerCase().includes(matchingConf.toLowerCase()));
            });
        }
    }

    applyFilters();
}

function filterConference(conf, element) {
    selectedConference = conf;

    if (selectedDivision && conf !== "ALL") {
        if (DIVISION_CONF_MAP[selectedDivision] !== conf) {
            selectedDivision = "";
            document.querySelectorAll(".division-btn").forEach(btn => btn.classList.remove("active"));
        }
    } else if (conf === "ALL") {
        selectedDivision = "";
        document.querySelectorAll(".division-btn").forEach(btn => btn.classList.remove("active"));
    }

    document.querySelectorAll(".conf-tab").forEach(tab => tab.classList.remove("active"));
    if (element) {
        element.classList.add("active");
    } else {
        document.querySelectorAll(".conf-tab")[0].classList.add("active");
    }

    applyFilters();
}

function applyFilters() {
    let list = allTeams;

    if (selectedConference !== "ALL") {
        list = list.filter(t => t.conference.toLowerCase() === selectedConference.toLowerCase());
    }

    if (selectedDivision) {
        list = list.filter(t => t.division.toLowerCase() === selectedDivision.toLowerCase());
    }

    displayTeams(list);
}

function renderPlayerCard(p, team) {
    const info = {
        pos: p.pos || "—",
        gp: p.gp ?? "—",
        ppg: formatPlayerSeasonStat(p, "pts"),
        apg: formatPlayerSeasonStat(p, "ast"),
        rpg: formatPlayerSeasonStat(p, "reb"),
        statsSeason: p.stats_season || "Stats unavailable",
        jersey: p.jersey_number ?? p.jersey ?? p.number ?? ""
    };

    const salary = typeof p.salary === "number"
        ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(p.salary)
        : "";
    const headshotId = getPlayerHeadshotId(p.name);
    const photoUrl = headshotId ? getPlayerHeadshotUrl(p.name) : "";
    const safeName = p.name.replace(/'/g, "\\'");
    const portrait = headshotId
        ? `<img src="${photoUrl}" alt="${p.name}" class="card-player-headshot" loading="lazy" onerror="this.onerror=null;this.src='${DEFAULT_AVATAR_FALLBACK}'">`
        : `<span class="card-player-headshot-fallback" aria-label="Official portrait unavailable">${getPlayerInitials(p.name)}</span>`;

    return `
        <div class="nba-player-card roster-player-card" onclick="selectSearchedPlayer('${safeName}', ${team.id})">
            <div class="roster-card-header">
                <div class="card-player-identity">
                    <div class="card-player-name">${p.name}</div>
                    <div class="card-player-pos">${info.pos}</div>
                </div>
                <div class="roster-player-jersey">${info.jersey || "—"}</div>
            </div>

            <div class="card-headshot-box">
                ${portrait}
            </div>

            <div class="roster-card-meta">
                <div class="roster-card-stat"><span>Season</span><strong>${info.statsSeason}</strong></div>
                <div class="roster-card-stat"><span>GP</span><strong>${info.gp}</strong></div>
                <div class="roster-card-stat"><span>PPG</span><strong>${info.ppg}</strong></div>
                <div class="roster-card-stat"><span>APG</span><strong>${info.apg}</strong></div>
                <div class="roster-card-stat"><span>RPG</span><strong>${info.rpg}</strong></div>
            </div>

            ${salary ? `<div class="card-player-salary">${salary}</div>` : ""}
        </div>
    `;
}

function openModal(team) {
    if (!team) return;
    activeTeamId = team.id;

    const modalBody = document.querySelector(".modal-body");
    const modalImageCol = document.querySelector(".modal-image-col");
    const modalInfoCol = document.querySelector(".modal-info-col");
    const modalCard = document.querySelector(".modal-card");
    const detailModal = document.getElementById("detailModal");
    if (!detailModal || !modalBody || !modalImageCol || !modalInfoCol || !modalCard) return;

    modalBody.scrollTop = 0;
    modalImageCol.scrollTop = 0;
    modalInfoCol.scrollTop = 0;
    applyTeamThemeToElement(modalCard, team.name);

    const formattedSalary = typeof team.total_salary === "number" ? `$${team.total_salary.toLocaleString()}` : "Payroll unavailable";
    const yearsString = team.championship_years?.length ? team.championship_years.join(", ") : "None";

    const teamTxContainer = document.getElementById("modalTeamTransactions");
    const teamTxList = getTeamTransactions(team.name);

    const modalConference = document.getElementById("modalConference");
    const modalTitle = document.getElementById("modalTitle");
    const modalStar = document.getElementById("modalStar");
    const modalRecord = document.getElementById("modalRecord");
    const modalDescription = document.getElementById("modalDescription");
    const modalImg = document.getElementById("modalLogo");
    if (modalConference) modalConference.innerText = `${team.conference.toUpperCase()} CONFERENCE • ${team.division.toUpperCase()}`;
    if (modalTitle) modalTitle.innerText = team.name;
    if (modalStar) modalStar.innerText = `Featured Star: ${team.featured_star} (${team.headline_stat})`;
    if (modalRecord) {
        modalRecord.innerHTML = `
            <div class="modal-record__line"><span>Last season</span><strong>${team.last_season_record}</strong></div>
            <div class="modal-record__line"><span>Championships</span><strong>${team.championships ?? "—"}</strong></div>
            <div class="modal-record__years">Title years <strong>${yearsString}</strong></div>
            <div class="modal-season-stats-grid">
                <div class="modal-season-stat-box"><span>Featured player</span><strong>${team.headline_stat || "Stats unavailable"}</strong></div>
            </div>
        `;
    }
    if (modalDescription) modalDescription.innerText = team.description;
    if (modalImg) {
        modalImg.src = team.logo;
        modalImg.onerror = () => {
            modalImg.src = "https://cdn.nba.com/logos/nba/1610612738/primary/L/logo.svg";
        };
    }

    const rosterPlayers = Array.isArray(team.roster_2026_27)
        ? team.roster_2026_27
        : [
            ...(Array.isArray(team.starters_2026_27) ? team.starters_2026_27 : []),
            ...(Array.isArray(team.bench_2026_27) ? team.bench_2026_27 : [])
        ];

    const playersGrid = document.getElementById("modalPlayersGrid");
    if (playersGrid) {
        playersGrid.innerHTML = rosterPlayers.length
            ? rosterPlayers.map(p => renderPlayerCard(p, team)).join("")
            : `<p style="color:#94a3b8; font-size:0.85rem; padding: 12px 0;">No players currently registered for this team.</p>`;
    }

    const salaryRow = document.getElementById("modalSalaryRow");
    if (salaryRow) {
        const taxStatus = team.tax_status || "Unavailable";
        salaryRow.innerHTML = `
            <span class="modal-payroll"><span>TEAM PAYROLL</span><strong>${formattedSalary}</strong></span>
            <span class="tx-badge tx-badge-${taxStatus.replace(' ', '_')}">${taxStatus}</span>
        `;
    }

    if (teamTxContainer) {
        teamTxContainer.innerHTML = teamTxList.length > 0 ? teamTxList.map(t => `
            <div class="modal-tx-item">
                <div class="modal-tx-item__meta">
                    <span class="tx-badge tx-badge-${t.type}">${t.type}</span>
                    <span class="modal-tx-item__date">${t.date}</span>
                </div>
                <div>${t.text}</div>
            </div>
        `).join("") : `<p style="font-size:0.8rem; color:#64748b;">No major offseason transactions recorded.</p>`;
    }

    detailModal.classList.add("open");
}

function closeModal() {
    const detailModal = document.getElementById("detailModal");
    if (detailModal) detailModal.classList.remove("open");
}

function renderPlayerCareerHistory(history) {
    const panel = document.getElementById("playerCareerPanel");
    const grid = document.getElementById("playerCareerHistory");
    const labelEl = document.getElementById("playerCareerLabel");
    if (!panel || !grid || !labelEl) return;

    const items = Array.isArray(history) ? history : [];
    if (!items.length) {
        panel.hidden = true;
        labelEl.textContent = "Career timeline";
        grid.innerHTML = "";
        return;
    }

    panel.hidden = false;
    labelEl.textContent = `${items.length} seasons`;
    grid.innerHTML = items
        .slice()
        .reverse()
        .map(item => {
            const season = escapeMarkup(item.season || "Season");
            const team = escapeMarkup(item.team || "Team");
            const pts = item.pts != null ? Number(item.pts).toFixed(1) : "—";
            const reb = item.reb != null ? Number(item.reb).toFixed(1) : "—";
            const ast = item.ast != null ? Number(item.ast).toFixed(1) : "—";
            const fgPct = item.fg_pct != null ? `${Number(item.fg_pct).toFixed(1)}%` : "—";
            const gp = item.gp != null ? Number(item.gp) : "—";
            return `
                <div class="player-career-season">
                    <span>${season}</span>
                    <strong>${escapeMarkup(pts)}</strong>
                    <small>${team}<br>GP ${escapeMarkup(String(gp))} · RPG ${escapeMarkup(String(reb))} · APG ${escapeMarkup(String(ast))}<br>FG ${escapeMarkup(fgPct)}</small>
                </div>
            `;
        })
        .join("");
}

async function loadPlayerCareerHistory(player) {
    const playerId = Number(player?.id ?? player?.player_id ?? player?.nba_id ?? "");
    const panel = document.getElementById("playerCareerPanel");
    const grid = document.getElementById("playerCareerHistory");
    const labelEl = document.getElementById("playerCareerLabel");
    if (!panel || !grid || !labelEl) return;
    if (!Number.isFinite(playerId) || playerId <= 0) {
        panel.hidden = true;
        labelEl.textContent = "Career timeline";
        grid.innerHTML = "";
        return;
    }

    panel.hidden = false;
    labelEl.textContent = "Loading…";
    grid.innerHTML = `
        <div class="player-career-season">
            <span>Career</span>
            <strong>…</strong>
            <small>Loading rookie-to-now stats…</small>
        </div>
    `;

    try {
        const response = await fetch(
            `${API_URL}/api/v1/player-career?player_id=${encodeURIComponent(playerId)}&player_name=${encodeURIComponent(player?.name || "")}`,
            { headers: { "x-api-key": API_KEY } }
        );
        if (!response.ok) throw new Error(`Career stats request failed (${response.status}).`);
        const payload = await response.json();
        const history = Array.isArray(payload?.history) ? payload.history : [];
        renderPlayerCareerHistory(history);
    } catch (error) {
        console.warn("Player career history is unavailable.", error);
        panel.hidden = true;
        labelEl.textContent = "Career timeline";
        grid.innerHTML = "";
    }
}

function handleBackdropClick(event) {
    if (event.target.id === "detailModal") {
        closeModal();
    }
}

function openPlayerModal(player, team) {
    closeModal();

    const colors = teamColors[team.name] || { primary: "#051c2d", dark: "#031320" };
    document.getElementById("playerHeroBanner").style.backgroundColor = colors.primary;
    document.getElementById("playerHeroTape").style.backgroundColor = colors.dark;

    const logoSrc = team.logo || "https://cdn.nba.com/logos/nba/1610612738/primary/L/logo.svg";
    document.getElementById("playerHeroWatermark").style.backgroundImage = `url('${logoSrc}')`;
    document.getElementById("playerModalTeamLogo").src = logoSrc;

    const nameParts = player.name.trim().split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";
    document.getElementById("playerModalName").innerHTML = `${firstName}<br>${lastName}`;
    document.getElementById("playerModalSubtitle").innerText = `${team.name} | ${player.pos} · ${player.stats_season || "Stats unavailable"}`;

    const photoUrl = getPlayerHeadshotUrl(player.name);
    const photoEl = document.getElementById("playerModalPhoto");
    photoEl.src = photoUrl;
    photoEl.onerror = function() {
        this.src = DEFAULT_AVATAR_FALLBACK;
    };

    const pts = formatPlayerSeasonStat(player, "pts");
    const reb = formatPlayerSeasonStat(player, "reb");
    const ast = formatPlayerSeasonStat(player, "ast");
    const stl = formatPlayerSeasonStat(player, "stl");
    const blk = formatPlayerSeasonStat(player, "blk");
    const tov = formatPlayerSeasonStat(player, "tov");
    const fg = formatPlayerSeasonStat(player, "fg", "%");
    const fg3 = formatPlayerSeasonStat(player, "fg3", "%");
    const ft = formatPlayerSeasonStat(player, "ft", "%");

    document.getElementById("playerStatsSeason").innerText = player.stats_season || "Unavailable";
    animateNumber(document.getElementById("playerStatPpg"), pts);
    animateNumber(document.getElementById("playerStatRpg"), reb);
    animateNumber(document.getElementById("playerStatApg"), ast);

    animateNumber(document.getElementById("playerStatStl"), stl);
    animateNumber(document.getElementById("playerStatBlk"), blk);
    animateNumber(document.getElementById("playerStatFg"), fg);
    animateNumber(document.getElementById("playerStatFg3"), fg3);
    animateNumber(document.getElementById("playerStatFt"), ft);
    animateNumber(document.getElementById("playerStatTov"), tov);

    loadPlayerCareerHistory(player);

    const viewTeamBtn = document.getElementById("playerModalViewTeamBtn");
    viewTeamBtn.onclick = function() {
        closePlayerModal();
        openModal(team);
    };

    document.getElementById("playerModal").classList.add("open");
}

function closePlayerModal() {
    document.getElementById("playerModal").classList.remove("open");
}

function handlePlayerBackdropClick(event) {
    if (event.target.id === "playerModal") {
        closePlayerModal();
    }
}

refreshHeadlineSlides();
startHeadlineAutoPlay();
initializeSeasonPickers();
document.querySelector("#scheduleSection .section-heading").textContent =
    `${selectedScheduleSeason.replace("-", "–")} SEASON SCHEDULE & SCORES`;
document.querySelector("#standingsSection .section-heading").textContent =
    `${selectedStandingsSeason.replace("-", "–")} NBA STANDINGS`;
loadHeadlines();
loadLiveInjuryReports({ background: true });
filterTransactions();
updateScheduleDateBounds(true);
renderSchedule();
initializeGamePicks();
loadTeams();
loadSchedule();
loadLiveScores();
loadTransactions();
loadStandings();
loadPlayoffBracket();
document.querySelectorAll(".standings-phase-tab").forEach(tab => {
    tab.addEventListener("click", () => setStandingsPhase(tab.dataset.seasonType));
});
document.querySelectorAll(".standings-tab").forEach(tab => {
    tab.addEventListener("click", () => setStandingsConference(tab.dataset.conference));
});
document.getElementById("standingsSeasonPicker").addEventListener("change", event => {
    selectStandingsSeason(event.target.value);
});
document.getElementById("playoffBracket").addEventListener("click", event => {
    const button = event.target.closest("[data-playoff-game-id][data-playoff-season]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    openBoxScore(button.dataset.playoffGameId, button.dataset.playoffSeason);
});
document.getElementById("standingsPredictionForm").addEventListener("submit", saveStandingsPrediction);
document.getElementById("standingsPredictionGrid").addEventListener("click", moveStandingsPredictionTeam);
document.getElementById("standingsPredictionGrid").addEventListener("dragstart", startStandingsPredictionDrag);
document.getElementById("standingsPredictionGrid").addEventListener("dragover", dragOverStandingsPrediction);
document.getElementById("standingsPredictionGrid").addEventListener("dragend", endStandingsPredictionDrag);
document.getElementById("clearStandingsPrediction").addEventListener("click", clearStandingsPrediction);
updateStandingsPanelLabel();
document.getElementById("scheduleSeasonPicker").addEventListener("change", event => {
    selectScheduleSeason(event.target.value);
});
document.getElementById("schedulePhasePicker").addEventListener("change", event => {
    selectSchedulePhase(event.target.value);
});
document.getElementById("schedulePreviousDay").addEventListener("click", () => changeScheduleDate(-1));
document.getElementById("scheduleNextDay").addEventListener("click", () => changeScheduleDate(1));
document.getElementById("scheduleToday").addEventListener("click", () => {
    const dates = gamesInSelectedSchedulePhase().map(game => game.date).filter(Boolean).sort();
    const today = localDateKey();
    selectedScheduleDate = selectedScheduleSeason === currentNbaSeason()
        ? dates.includes(today)
            ? today
            : dates.find(date => date >= today) || dates[0] || today
        : dates[dates.length - 1] || document.getElementById("scheduleDatePicker").max;
    renderSchedule();
});
document.getElementById("scheduleDatePicker").addEventListener("change", event => {
    selectedScheduleDate = event.target.value;
    renderSchedule();
});
document.getElementById("scheduleGrid").addEventListener("click", event => {
    const gameCard = event.target.closest(".game-card[data-game-id]");
    if (gameCard) openBoxScore(gameCard.dataset.gameId);
});
document.getElementById("scheduleGrid").addEventListener("keydown", event => {
    const gameCard = event.target.closest(".game-card[data-game-id]");
    if (gameCard && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        openBoxScore(gameCard.dataset.gameId);
    }
});
const boxScoreContent = document.getElementById("boxScoreContent");
boxScoreContent.addEventListener("click", event => {
    const tab = event.target.closest("[data-box-score-tab]");
    if (!tab) return;
    setActiveBoxScoreTab(boxScoreContent, tab.dataset.boxScoreTab);
    if (tab.dataset.boxScoreTab === "plays" && !boxScorePlayByPlayCache.has(activeBoxScoreGameId)) {
        loadBoxScorePlayByPlay(activeBoxScoreGameId);
    }
});
boxScoreContent.addEventListener("keydown", event => {
    const currentTab = event.target.closest("[data-box-score-tab]");
    if (!currentTab || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const tabs = [...boxScoreContent.querySelectorAll("[data-box-score-tab]")];
    const currentIndex = tabs.indexOf(currentTab);
    const nextIndex = event.key === "Home"
        ? 0
        : event.key === "End"
            ? tabs.length - 1
            : (currentIndex + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
    event.preventDefault();
    tabs[nextIndex].focus();
    tabs[nextIndex].click();
});
document.getElementById("closeBoxScore").addEventListener("click", closeBoxScore);
document.getElementById("boxScoreDialog").addEventListener("close", () => {
    activeBoxScoreGameId = "";
    activeBoxScoreGame = null;
    activeBoxScoreSeason = "";
    if (boxScoreRefreshInterval) {
        window.clearInterval(boxScoreRefreshInterval);
        boxScoreRefreshInterval = null;
    }
    if (playByPlayRefreshInterval) {
        window.clearInterval(playByPlayRefreshInterval);
        playByPlayRefreshInterval = null;
    }
});
window.setInterval(loadTeams, 15 * 60 * 1000);
window.setInterval(loadSchedule, 24 * 60 * 60 * 1000);
window.setInterval(() => loadLiveScores({ background: true }), 30 * 1000);
window.setInterval(() => loadTransactions({ background: true }), 60 * 60 * 1000);
window.setInterval(() => loadStandings({ background: true }), 5 * 60 * 1000);
window.setInterval(() => loadHeadlines({ background: true }), 15 * 60 * 1000);
window.setInterval(() => loadLiveInjuryReports({ background: true }), 15 * 60 * 1000);
document.addEventListener("visibilitychange", () => {
    if (!document.hidden && Date.now() - lastTeamsRefreshAt >= 15 * 60 * 1000) loadTeams();
});
document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    if (Date.now() - lastScheduleRefreshAt >= 24 * 60 * 60 * 1000) loadSchedule();
    if (Date.now() - lastStandingsRefreshAt >= 5 * 60 * 1000) loadStandings({ background: true });
    if (Date.now() - lastGamePicksOddsRefreshAt >= 5 * 60 * 1000) loadGamePicksOdds();
    if (Date.now() - lastNewsRefreshAt >= 15 * 60 * 1000) loadHeadlines({ background: true });
    if (Date.now() - INJURY_REPORT_CACHE.lastUpdated >= 15 * 60 * 1000) loadLiveInjuryReports({ background: true });
    loadLiveScores({ background: true });
    if (activeBoxScoreGameId) loadBoxScore(activeBoxScoreGameId, { background: true });
});
window.addEventListener("focus", () => {
    if (Date.now() - lastStandingsRefreshAt >= 5 * 60 * 1000) loadStandings({ background: true });
    if (Date.now() - lastNewsRefreshAt >= 15 * 60 * 1000) loadHeadlines({ background: true });
    if (Date.now() - INJURY_REPORT_CACHE.lastUpdated >= 15 * 60 * 1000) loadLiveInjuryReports({ background: true });
    loadLiveScores({ background: true });
    if (activeBoxScoreGameId) loadBoxScore(activeBoxScoreGameId, { background: true });
    if (Date.now() - lastTransactionsRefreshAt >= 60 * 60 * 1000) loadTransactions({ background: true });
});