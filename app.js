const API_URL = "https://my-fastapi-nba.vercel.app";
const API_KEY = "lebron2369";
const GAME_PICKS_STORAGE_KEY = "nba-hub-game-picks-v1";
const DAILY_GAME_TOKEN_CLAIM = 1000;

let allTeams = [];
let currentHeadlineIndex = 0;
let headlineAutoTimer = null;
let headlineItems = [];
let newsItems = [];
let headlineScoreItems = [];
let lastNewsRefreshAt = 0;
let isRefreshingNews = false;
let selectedDivision = "";
let selectedConference = "ALL";
let selectedStandingsConference = "Western";
let selectedStandingsPhase = "preseason";
let selectedStandingsSeason = "";
let currentStandings = [];
const standingsByPhase = new Map();
let gamePicksState = { balance: 0, lastClaimDate: "", slip: [], bets: [] };
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
        ? "Current roster membership · projected starters"
        : "Roster snapshot may be outdated · projected starters";
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

function initializeSeasonPickers() {
    const currentStartYear = Number(currentNbaSeason().slice(0, 4));
    const seasons = Array.from({ length: currentStartYear - 1999 }, (_, index) => {
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
        GS: "GSW",
        NO: "NOP",
        NY: "NYK",
        PHO: "PHX",
        SA: "SAS",
        UTAH: "UTA",
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
        const minimumRegularGames = selectedScheduleSeason === currentNbaSeason()
            ? 1230
            : 900;
        const regularGameCount = Number(schedulePayload.regular_game_count ?? schedulePayload.games?.length ?? 0);
        if (!Array.isArray(schedulePayload.games) || regularGameCount < minimumRegularGames) {
            throw new Error(schedulePayload.message || `The API did not return the full ${selectedScheduleSeason} schedule.`);
        }
        if (requestSequence !== scheduleRequestSequence) return;
        scheduleLoadMessage = "";
        scheduleRouteMissing = false;
        scheduleGames = schedulePayload.games.map(scheduleGameInPhilippines);
        if (selectedScheduleSeason === currentNbaSeason()) {
            gamePicksScheduleGames = scheduleGames;
            gamePicksScheduleMessage = "";
            settleGamePicksBets();
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

function playoffSeriesGameNumber(game) {
    if (
        schedulePhaseForGame(game) !== "playoffs"
        || /play.?in/i.test(String(game.stage || ""))
        || /cancelled|canceled|abandoned/i.test(String(game.status || ""))
    ) return null;

    const matchup = [game.home_tricode || game.home, game.away_tricode || game.away]
        .map(team => String(team || "").trim().toLocaleLowerCase())
        .sort()
        .join(":");
    const seriesGames = scheduleGames
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
                .map(team => String(team || "").trim().toLocaleLowerCase())
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

function formatGamePicksAmericanOdds(price) {
    const value = Number(price);
    if (!Number.isFinite(value) || value === 0) return "—";
    return value > 0 ? `+${Math.round(value)}` : String(Math.round(value));
}

function gamePicksDecimalToAmerican(decimalOdds) {
    if (!Number.isFinite(decimalOdds) || decimalOdds <= 1) return null;
    return decimalOdds >= 2
        ? Math.round((decimalOdds - 1) * 100)
        : -Math.round(100 / (decimalOdds - 1));
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
        if (
            !Number.isSafeInteger(balance)
            || balance < 0
            || typeof parsed?.lastClaimDate !== "string"
            || !Array.isArray(parsed?.slip)
            || !Array.isArray(parsed?.bets)
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
            bets: parsed.bets
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

function claimDailyGameTokens() {
    const today = localDateKey();
    if (gamePicksState.lastClaimDate === today) {
        setGamePicksWalletStatus("You have already claimed today’s 1,000 tokens.", true);
        return;
    }
    const nextState = {
        ...gamePicksState,
        balance: gamePicksState.balance + DAILY_GAME_TOKEN_CLAIM,
        lastClaimDate: today
    };
    if (saveGamePicksState(nextState)) {
        setGamePicksWalletStatus("1,000 virtual tokens added to your balance.");
        renderGamePicks();
    } else {
        setGamePicksWalletStatus(gamePicksStorageMessage, true);
    }
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
        settleGamePicksBets();
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
    if (!slipList || !slipCount || !placeButton || !clearButton || !stakeInput) return;

    const slip = gamePicksState.slip;
    slipCount.textContent = `${slip.length} pick${slip.length === 1 ? "" : "s"}`;
    slipList.innerHTML = slip.length
        ? slip.map(leg => `
            <article class="game-picks-slip-leg">
                <div>
                    <strong>${escapeMarkup(leg.selected_team)}</strong>
                    <span>${escapeMarkup(leg.away)} at ${escapeMarkup(leg.home)}</span>
                    <small>${escapeMarkup(leg.bookmaker || "Sportsbook")} · ${escapeMarkup(formatGamePicksAmericanOdds(leg.american_odds))} · updated ${escapeMarkup(formatGamePicksQuoteTime({ last_updated: leg.odds_updated_at }))} PHT</small>
                </div>
                <button type="button" data-game-picks-remove="${escapeMarkup(leg.event_id)}" aria-label="Remove ${escapeMarkup(leg.selected_team)} pick">Remove</button>
            </article>
        `).join("")
        : '<p class="game-picks-empty">Choose a team from one or more upcoming games to build your slip.</p>';

    const combinedDecimal = gamePicksSlipDecimalOdds();
    const combinedAmerican = slip.length ? gamePicksDecimalToAmerican(combinedDecimal) : null;
    const stake = Number(stakeInput.value);
    const validStake = Number.isSafeInteger(stake) && stake > 0 && stake <= gamePicksState.balance;
    const canPlace = slip.length > 0
        && validStake
        && slip.every(gamePicksLegIsBettable);
    if (combinedOddsElement) {
        combinedOddsElement.textContent = combinedAmerican == null
            ? "—"
            : `${formatGamePicksAmericanOdds(combinedAmerican)} (${combinedDecimal.toFixed(2)}x)`;
    }
    if (potentialReturnElement) {
        potentialReturnElement.textContent = validStake && slip.length
            ? `${Math.round(stake * combinedDecimal).toLocaleString()} tokens`
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

    const combinedDecimal = gamePicksSlipDecimalOdds();
    const bet = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        legs: gamePicksState.slip.map(leg => ({ ...leg })),
        stake,
        combined_decimal_odds: combinedDecimal,
        combined_american_odds: gamePicksDecimalToAmerican(combinedDecimal),
        status: "open",
        payout: null,
        placed_at: new Date().toISOString(),
        settled_at: null
    };
    const nextState = {
        ...gamePicksState,
        balance: gamePicksState.balance - stake,
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
        if (legs.some(leg => leg.result === "lost")) {
            return { ...bet, legs, status: "lost", payout: 0, settled_at: new Date().toISOString() };
        }
        if (legs.every(leg => leg.result !== "pending")) {
            const winningLegs = legs.filter(leg => leg.result === "won");
            const payout = winningLegs.length
                ? Math.round(bet.stake * winningLegs.reduce(
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
                            <span>${escapeMarkup(leg.selected_team)} ${escapeMarkup(formatGamePicksAmericanOdds(leg.american_odds))}</span>
                            <span>${escapeMarkup(leg.result === "pending" ? "Pending" : leg.result)}</span>
                        </li>
                    `).join("")}
                </ul>
                <p>${Number(bet.stake).toLocaleString()} tokens · Combined ${escapeMarkup(formatGamePicksAmericanOdds(bet.combined_american_odds))} · Potential return ${Math.round(bet.stake * bet.combined_decimal_odds).toLocaleString()} tokens</p>
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
                ? `${formatGamePicksAmericanOdds(quote.american)} · ${quote.bookmaker || "Sportsbook"}`
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
        return `
            <article class="game-picks-game-card">
                <div class="game-picks-game-card__meta">
                    <span>${escapeMarkup(startLabel)} PHT</span>
                    <span>Moneyline</span>
                </div>
                <h3>${escapeMarkup(event.away)} <span>at</span> ${escapeMarkup(event.home)}</h3>
                <div class="game-picks-options">${pickOptions}</div>
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
        claimButton.textContent = claimed ? "Claimed today" : "Claim 1,000 daily tokens";
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
            oddsStatus.textContent = `Real odds from The Odds API · checked ${checkedAt || "just now"} PHT · refreshes every 5 minutes.`;
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
    settleGamePicksBets();
    renderGamePicksSlip();
    renderGamePicksGames();
    renderGamePicksBets();
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
    document.getElementById("gamePicksGamesGrid").addEventListener("click", event => {
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

function renderStandings(standings) {
    const tbody = document.getElementById("standingsTableBody");
    const panel = document.getElementById("standings-panel");
    if (!tbody || !panel) return;

    const conferenceStandings = standings
        .filter(team => team.conference === selectedStandingsConference)
        .sort((left, right) => {
            const pctDifference = Number(right.win_pct ?? -1) - Number(left.win_pct ?? -1);
            if (Number.isFinite(pctDifference) && pctDifference !== 0) return pctDifference;
            const winDifference = Number(right.wins ?? -1) - Number(left.wins ?? -1);
            if (Number.isFinite(winDifference) && winDifference !== 0) return winDifference;
            return String(left.team || "").localeCompare(String(right.team || ""));
        });

    if (!conferenceStandings.length) {
        tbody.innerHTML = '<tr><td colspan="14" class="standings-empty">No standings are available for this conference yet.</td></tr>';
        return;
    }

    tbody.innerHTML = conferenceStandings.map((team, index) => `
        <tr>
            <td>
                <div class="standings-team-cell">
                    <span class="standings-rank">${index + 1}</span>
                    ${team.logo ? `<img src="${escapeMarkup(team.logo)}" alt="" loading="lazy">` : ""}
                    <span class="standings-team-info">
                        <span class="standings-team-name">${escapeMarkup(team.team || "NBA team")}</span>
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
            ${periodTable}
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
        const headshot = getPlayerHeadshotUrl(player.name);
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
                    <img src="${escapeMarkup(headshot)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${DEFAULT_AVATAR_FALLBACK}'">
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
        ? playoffSeriesGameNumber(activeBoxScoreGame)
        : null;
    try {
        const response = await fetch(`${API_URL}/api/v1/games/${encodeURIComponent(gameId)}/boxscore?season=${encodeURIComponent(activeBoxScoreSeason)}`, {
            headers: { "x-api-key": API_KEY }
        });
        if (!response.ok) throw new Error(`Box score request failed (${response.status}).`);
        const payload = await response.json();
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

function openBoxScore(gameId) {
    const game = scheduleGames.find(item => item.id === gameId);
    const dialog = document.getElementById("boxScoreDialog");
    if (!game || !dialog) return;
    activeBoxScoreGameId = gameId;
    activeBoxScoreGame = game;
    activeBoxScoreSeason = selectedScheduleSeason;
    document.getElementById("boxScoreTitle").textContent =
        `${game.away} at ${game.home} · ${activeBoxScoreSeason.replace("-", "–")}`;
    document.getElementById("boxScoreBadge").textContent =
        activeBoxScoreSeason === currentNbaSeason()
            ? "LIVE GAME CENTER"
            : "HISTORICAL GAME CENTER";
    const statusElement = document.getElementById("boxScoreStatus");
    const content = document.getElementById("boxScoreContent");
    const gameContext = `${activeBoxScoreSeason.replace("-", "–")} season · ${formatScheduleDate(game.date, { month: "long", day: "numeric", year: "numeric" })}`;
    const seriesGame = playoffSeriesGameNumber(game);
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
    headlineItems = [...headlineScoreItems, ...newsItems];
    if (!headlineItems.length) {
        headlineItems = [{
            id: "news-loading",
            kind: "article",
            category: "NBA NEWS",
            headline: "The latest from around the NBA",
            story: "Headlines, game results and league stories will appear here as soon as the live feeds load.",
            url: "https://www.espn.ph/nba/",
            published: null,
            source: "ESPN"
        }];
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
        statsSeason: p.stats_season || "Stats unavailable"
    };

    const salary = typeof p.salary === "number"
        ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(p.salary)
        : "Salary unavailable";
    const headshotId = getPlayerHeadshotId(p.name);
    const photoUrl = headshotId ? getPlayerHeadshotUrl(p.name) : "";
    const safeName = p.name.replace(/'/g, "\\'");
    const portrait = headshotId
        ? `<img src="${photoUrl}" alt="${p.name}" class="card-player-headshot" loading="lazy" onerror="this.onerror=null;this.src='${DEFAULT_AVATAR_FALLBACK}'">`
        : `<span class="card-player-headshot-fallback" aria-label="Official portrait unavailable">${getPlayerInitials(p.name)}</span>`;

    return `
        <div class="nba-player-card" onclick="selectSearchedPlayer('${safeName}', ${team.id})">
            <div>
                <div class="card-header-row">
                    <div class="card-player-identity">
                        <div class="card-player-name">${p.name}</div>
                        <div class="card-player-pos">${info.pos}</div>
                    </div>
                </div>

                <div class="card-center-row single-visual-layout">
                    <div class="card-headshot-box">
                        ${portrait}
                    </div>
                </div>
            </div>

            <div>
                <div class="card-stats-strip">
                    <div class="stat-cell"><span class="stat-title">SEASON</span><span class="stat-num">${info.statsSeason}</span></div>
                    <div class="stat-cell"><span class="stat-title">GP</span><span class="stat-num">${info.gp}</span></div>
                    <div class="stat-cell"><span class="stat-title">PPG</span><span class="stat-num">${info.ppg}</span></div>
                    <div class="stat-cell"><span class="stat-title">APG</span><span class="stat-num">${info.apg}</span></div>
                    <div class="stat-cell"><span class="stat-title">RPG</span><span class="stat-num">${info.rpg}</span></div>
                </div>
                <div class="card-player-salary">${salary}</div>
            </div>
        </div>
    `;
}

function openModal(team) {
    activeTeamId = team.id;
    document.querySelector(".modal-body").scrollTop = 0;
    document.querySelector(".modal-image-col").scrollTop = 0;
    document.querySelector(".modal-info-col").scrollTop = 0;
    const modalCard = document.querySelector(".modal-card");
    applyTeamThemeToElement(modalCard, team.name);

    const formattedSalary = typeof team.total_salary === "number" ? `$${team.total_salary.toLocaleString()}` : "Payroll unavailable";
    const yearsString = team.championship_years?.length ? team.championship_years.join(", ") : "None";

    const teamTxContainer = document.getElementById("modalTeamTransactions");
    const teamTxList = getTeamTransactions(team.name);

    document.getElementById("modalConference").innerText = `${team.conference.toUpperCase()} CONFERENCE • ${team.division.toUpperCase()}`;
    document.getElementById("modalTitle").innerText = team.name;
    document.getElementById("modalStar").innerText = `Featured Star: ${team.featured_star} (${team.headline_stat})`;

    document.getElementById("modalRecord").innerHTML = `
        <div class="modal-record__line"><span>Last season</span><strong>${team.last_season_record}</strong></div>
        <div class="modal-record__line"><span>Championships</span><strong>${team.championships ?? "—"}</strong></div>
        <div class="modal-record__years">Title years <strong>${yearsString}</strong></div>
        <div class="modal-season-stats-grid">
            <div class="modal-season-stat-box"><span>Featured player</span><strong>${team.headline_stat || "Stats unavailable"}</strong></div>
        </div>
    `;

    document.getElementById("modalDescription").innerText = team.description;

    const modalImg = document.getElementById("modalLogo");
    modalImg.src = team.logo;
    modalImg.onerror = () => {
        modalImg.src = "https://cdn.nba.com/logos/nba/1610612738/primary/L/logo.svg";
    };

    const cleanStarters = Array.isArray(team.starters_2026_27) ? team.starters_2026_27 : [];
    const cleanBench = Array.isArray(team.bench_2026_27) ? team.bench_2026_27 : [];

    // Populate Cards Grids
    const startersGrid = document.getElementById("modalStartersGrid");
    startersGrid.innerHTML = cleanStarters.map(p => renderPlayerCard(p, team)).join("");

    const benchGrid = document.getElementById("modalBenchGrid");
    const benchCount = document.getElementById("modalBenchCount");
    if (benchGrid) {
        if (benchCount) benchCount.textContent = `${cleanBench.length} players`;
        if (cleanBench && cleanBench.length > 0) {
            benchGrid.innerHTML = cleanBench.map(p => renderPlayerCard(p, team)).join("");
        } else {
            benchGrid.innerHTML = `<p style="color:#94a3b8; font-size:0.85rem; padding: 12px 0;">No bench players currently registered.</p>`;
        }
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

    document.querySelector(".modal-body").scrollTop = 0;
    document.querySelector(".modal-image-col").scrollTop = 0;
    document.querySelector(".modal-info-col").scrollTop = 0;
    document.getElementById("detailModal").classList.add("open");
}

function closeModal() {
    document.getElementById("detailModal").classList.remove("open");
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
filterTransactions();
updateScheduleDateBounds(true);
renderSchedule();
initializeGamePicks();
loadTeams();
loadSchedule();
loadLiveScores();
loadTransactions();
loadStandings();
document.querySelectorAll(".standings-phase-tab").forEach(tab => {
    tab.addEventListener("click", () => setStandingsPhase(tab.dataset.seasonType));
});
document.querySelectorAll(".standings-tab").forEach(tab => {
    tab.addEventListener("click", () => setStandingsConference(tab.dataset.conference));
});
document.getElementById("standingsSeasonPicker").addEventListener("change", event => {
    selectStandingsSeason(event.target.value);
});
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
document.addEventListener("visibilitychange", () => {
    if (!document.hidden && Date.now() - lastTeamsRefreshAt >= 15 * 60 * 1000) loadTeams();
});
document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    if (Date.now() - lastScheduleRefreshAt >= 24 * 60 * 60 * 1000) loadSchedule();
    if (Date.now() - lastStandingsRefreshAt >= 5 * 60 * 1000) loadStandings({ background: true });
    if (Date.now() - lastGamePicksOddsRefreshAt >= 5 * 60 * 1000) loadGamePicksOdds();
    if (Date.now() - lastNewsRefreshAt >= 15 * 60 * 1000) loadHeadlines({ background: true });
    loadLiveScores({ background: true });
    if (activeBoxScoreGameId) loadBoxScore(activeBoxScoreGameId, { background: true });
});
window.addEventListener("focus", () => {
    if (Date.now() - lastStandingsRefreshAt >= 5 * 60 * 1000) loadStandings({ background: true });
    if (Date.now() - lastNewsRefreshAt >= 15 * 60 * 1000) loadHeadlines({ background: true });
    loadLiveScores({ background: true });
    if (activeBoxScoreGameId) loadBoxScore(activeBoxScoreGameId, { background: true });
    if (Date.now() - lastTransactionsRefreshAt >= 60 * 60 * 1000) loadTransactions({ background: true });
});
