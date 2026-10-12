const API_URL = "https://my-fastapi-nba.vercel.app";
const API_KEY = "lebron2369";

let allTeams = [];
let currentHeadlineIndex = 0;
let headlineAutoTimer = null;
let selectedDivision = "";
let selectedConference = "ALL";
let selectedTxFilter = "ALL";
let selectedScheduleDate = "";
let lastScheduleRefreshAt = 0;
let lastScoreRefreshAt = 0;
let lastTransactionsRefreshAt = 0;
let lastTeamsRefreshAt = 0;
let scheduleLoadMessage = "";
let scheduleRouteMissing = false;
let activeTeamId = null;
let isRefreshingTeams = false;
let isRefreshingSchedule = false;
let isRefreshingScores = false;
let isRefreshingTransactions = false;
let transactionsFeedStatus = null;
let boxScoreRefreshInterval = null;
let activeBoxScoreGameId = "";

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
                    type: item.type,
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

const headlines = [
    {
        category: "BLOCKBUSTER TRADE",
        headline: "Giannis Antetokounmpo & Klay Thompson Unite with Miami Heat",
        story: "In a seismic Eastern Conference shakeup, the Heat acquire Giannis Antetokounmpo from Milwaukee to pair with Bam Adebayo, followed by signing veteran champion Klay Thompson.",
        pills: ["Trade: Giannis to Miami", "Signing: Klay Thompson", "Miami Heat"],
        logo: "https://cdn.nba.com/logos/nba/1610612748/primary/L/logo.svg",
        bgGradient: "radial-gradient(circle at 80% 50%, #98002e 0%, #30000a 100%)"
    },
    {
        category: "WOLVES RESTRUCTURE",
        headline: "Jonathan Kuminga Inks 2-Year Deal with Timberwolves; LaMelo Ball Acquired",
        story: "Minnesota fortifies its core around Anthony Edwards by signing forward Jonathan Kuminga to a 2-year contract, while adding All-Star guard LaMelo Ball, Cody Williams, and John Konchar.",
        pills: ["Signing: 2-Year Deal", "Trade: LaMelo Ball", "Minnesota Timberwolves"],
        logo: "https://cdn.nba.com/logos/nba/1610612750/primary/L/logo.svg",
        bgGradient: "radial-gradient(circle at 80% 50%, #0c2340 0%, #04101e 100%)"
    },
    {
        category: "SUPERTEAM FORMED",
        headline: "LeBron James Signs with 76ers; Jaylen Brown Acquired from Boston",
        story: "Philadelphia executes a historic summer, signing LeBron James in free agency and landing Jaylen Brown via trade to join MVP center Joel Embiid and Tyrese Maxey.",
        pills: ["Signing: LeBron James", "Trade: Jaylen Brown", "Philadelphia 76ers"],
        logo: "https://cdn.nba.com/logos/nba/1610612755/primary/L/logo.svg",
        bgGradient: "radial-gradient(circle at 80% 50%, #006bb6 0%, #041b3d 100%)"
    },
    {
        category: "LAKERS REBUILD",
        headline: "Lakers Acquire Walker Kessler & Re-Sign Austin Reaves",
        story: "Los Angeles completes a targeted retool, acquiring defensive anchor Walker Kessler from Utah, adding Matisse Thybulle and Collin Sexton, while securing Austin Reaves on a long-term deal.",
        pills: ["Trade: Walker Kessler", "Re-Signed: Austin Reaves", "Los Angeles Lakers"],
        logo: "https://cdn.nba.com/logos/nba/1610612747/primary/L/logo.svg",
        bgGradient: "radial-gradient(circle at 80% 50%, #552583 0%, #1e0933 100%)"
    },
    {
        category: "EASTERN CONTENDER",
        headline: "Celtics Acquire Paul George & Sign Center Mitchell Robinson",
        story: "Boston retools around Jayson Tatum and Derrick White, bringing in All-Star Paul George via trade and signing elite rim-protector Mitchell Robinson to anchor the paint.",
        pills: ["Trade: Paul George", "Signing: Mitchell Robinson", "Boston Celtics"],
        logo: "https://cdn.nba.com/logos/nba/1610612738/primary/L/logo.svg",
        bgGradient: "radial-gradient(circle at 80% 50%, #007a33 0%, #02260f 100%)"
    },
    {
        category: "EXPLOSIVE BACKCOURT",
        headline: "Trail Blazers Acquire Ja Morant to Pair with Damian Lillard",
        story: "Portland pulls off a blockbuster deal with Memphis to acquire high-flying superstar Ja Morant, creating one of the most electric guard pairings in basketball history.",
        pills: ["Trade: Ja Morant", "Package: Grant & Murray Out", "Portland Trail Blazers"],
        logo: "https://cdn.nba.com/logos/nba/1610612757/primary/L/logo.svg",
        bgGradient: "radial-gradient(circle at 80% 50%, #e03a3e 0%, #290305 100%)"
    },
    {
        category: "YOUTH MOVEMENT",
        headline: "Mavericks Acquire Zaccharie Risacher & Flank Kyrie with Cooper Flagg",
        story: "Dallas lands #1 overall international standout Zaccharie Risacher from Atlanta alongside top draft prospect Cooper Flagg and Dereck Lively II in a rapid roster revamp.",
        pills: ["Trade: Zaccharie Risacher", "Rookie: Cooper Flagg", "Dallas Mavericks"],
        logo: "https://cdn.nba.com/logos/nba/1610612742/primary/L/logo.svg",
        bgGradient: "radial-gradient(circle at 80% 50%, #00538c 0%, #021a30 100%)"
    },
    {
        category: "DESERT UPGRADE",
        headline: "Suns Acquire Miles Bridges; Re-Sign Dillon Brooks to Extension",
        story: "Phoenix bolsters its forward rotation by acquiring Miles Bridges from Charlotte and securing defensive stopper Dillon Brooks with a multi-year veteran extension.",
        pills: ["Trade: Miles Bridges", "Extension: Dillon Brooks", "Phoenix Suns"],
        logo: "https://cdn.nba.com/logos/nba/1610612756/primary/L/logo.svg",
        bgGradient: "radial-gradient(circle at 80% 50%, #e56020 0%, #240a02 100%)"
    }
];

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
        lastTeamsRefreshAt = Date.now();
        renderStatsUpdateStatus(data.stats, data.roster);
        applyFilters();

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
        ? new Date(stats.last_updated).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
        : "";
    const season = stats?.season || "current-season";
    const rosterLabel = roster?.status === "fresh"
        ? "NBA roster current"
        : "NBA roster may be outdated";
    status.title = [roster?.message, stats?.message].filter(Boolean).join(" ");
    if (stats?.status === "fresh") {
        status.textContent = `${rosterLabel} · ${season} stats refreshed ${updatedAt} · auto-refresh every 15 minutes`;
        status.classList.toggle("is-warning", roster?.status !== "fresh");
    } else if (stats?.status === "pending") {
        status.textContent = `${rosterLabel} · ${season} regular-season stats are not published yet. Showing the season stats supplied by the API.`;
        status.classList.add("is-warning");
    } else {
        status.textContent = `${rosterLabel} · ${stats?.message || "Live stats are unavailable."} Showing the latest stats supplied by the API.`;
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
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function formatScheduleDate(dateKey, options = { weekday: "long", month: "long", day: "numeric", year: "numeric" }) {
    if (!dateKey) return "";
    return new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, options);
}

function updateScheduleStatus(payload = {}) {
    const statusElement = document.getElementById("scheduleUpdateStatus");
    if (!statusElement) return;
    const scheduleUpdatedAt = payload.last_updated
        ? new Date(payload.last_updated).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
        : "";
    const scoreUpdatedAt = payload.scores?.last_updated
        ? new Date(payload.scores.last_updated).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
        : "";
    const schedulePart = scheduleRouteMissing
        ? "The deployed API is missing the schedule route. Publish the latest api/index.py to Vercel."
        : scheduleLoadMessage
            ? scheduleLoadMessage
            : payload.status === "fresh"
                ? `${Number(payload.count || scheduleGames.length).toLocaleString()} games · schedule checked ${scheduleUpdatedAt}`
                : payload.status === "stale"
                    ? "Showing the last saved full schedule"
                    : payload.message || "The full season schedule is unavailable.";
    const scorePart = payload.scores?.status === "fresh"
        ? `Scores refreshed ${scoreUpdatedAt}`
        : payload.scores?.message || "Live scores unavailable";
    statusElement.textContent = `${schedulePart} · ${scorePart} · live scores auto-refresh every minute`;
    statusElement.title = [scheduleLoadMessage, payload.message, payload.scores?.message].filter(Boolean).join(" ");
    statusElement.classList.toggle("is-warning", payload.status !== "fresh" || payload.scores?.status !== "fresh");
}

async function loadSchedule() {
    if (isRefreshingSchedule) return;
    isRefreshingSchedule = true;
    const statusElement = document.getElementById("scheduleUpdateStatus");
    let schedulePayload = null;
    try {
        const response = await fetch(`${API_URL}/api/v1/schedule`, {
            headers: { "x-api-key": API_KEY }
        });
        if (!response.ok) throw new Error(`Schedule request failed (${response.status}).`);
        schedulePayload = await response.json();
        if (!Array.isArray(schedulePayload.games) || schedulePayload.games.length < 1230) {
            throw new Error(schedulePayload.message || "The API did not return the full 2026–27 schedule.");
        }
        scheduleLoadMessage = "";
        scheduleRouteMissing = false;
        scheduleGames = schedulePayload.games;
        lastScheduleRefreshAt = Date.now();
        const datePicker = document.getElementById("scheduleDatePicker");
        const dates = scheduleGames.map(game => game.date).filter(Boolean).sort();
        datePicker.min = dates[0] || "";
        datePicker.max = dates[dates.length - 1] || "";
        if (!selectedScheduleDate || !dates.includes(selectedScheduleDate)) {
            const today = localDateKey();
            selectedScheduleDate = dates.includes(today)
                ? today
                : dates.find(date => date >= today) || dates[0] || today;
        }
        updateScheduleStatus(schedulePayload);
        renderSchedule();
        loadLiveScores({ background: true });
    } catch (error) {
        console.error("Full season schedule load failed:", error);
        const message = error instanceof Error ? error.message : String(error);
        scheduleRouteMissing = message.includes("(404)");
        scheduleLoadMessage = scheduleRouteMissing
            ? "The deployed API is missing the schedule route. Publish the latest api/index.py to Vercel."
            : schedulePayload?.status === "unavailable" || schedulePayload?.status === "stale"
                ? message
                : scheduleGames.length
                ? "Schedule refresh failed. Showing the last loaded full season schedule."
                : "Could not load the full season schedule. Check the API connection and try again.";
        if (statusElement) {
            statusElement.textContent = scheduleLoadMessage;
            statusElement.classList.add("is-warning");
        }
        renderSchedule();
    } finally {
        isRefreshingSchedule = false;
    }
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
        if (payload.status === "fresh" && Array.isArray(payload.games)) {
            const liveScores = new Map(payload.games.map(game => [game.id, game]));
            const scoresByMatchup = new Map();
            payload.games.forEach(game => {
                if (!game.home_tricode || !game.away_tricode) return;
                const key = `${game.home_tricode.toLowerCase()}:${game.away_tricode.toLowerCase()}`;
                scoresByMatchup.set(key, [...(scoresByMatchup.get(key) || []), game]);
            });
            scheduleGames = scheduleGames.map(game => {
                const matchup = `${String(game.home_tricode || "").toLowerCase()}:${String(game.away_tricode || "").toLowerCase()}`;
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
                const score = liveScores.get(game.id)
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
        const statusElement = document.getElementById("scheduleUpdateStatus");
        const schedulePayload = {
            status: scheduleGames.length ? "fresh" : "unavailable",
            count: scheduleGames.length,
            last_updated: lastScheduleRefreshAt ? new Date(lastScheduleRefreshAt).toISOString() : null,
            scores: payload
        };
        updateScheduleStatus(schedulePayload);
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
    const dayGames = scheduleGames.filter(game => game.date === selectedScheduleDate);
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
        empty.textContent = `No NBA games scheduled for ${formatScheduleDate(selectedScheduleDate)}.`;
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
        const awayScore = hasScores ? `<strong class="game-team-score">${escapeMarkup(game.away_score)}</strong>` : "";
        const homeScore = hasScores ? `<strong class="game-team-score">${escapeMarkup(game.home_score)}</strong>` : "";

        const card = document.createElement("article");
        card.className = "game-card";
        card.dataset.gameId = game.id;
        card.tabIndex = 0;
        card.setAttribute("role", "button");
        card.setAttribute("aria-label", `Open box score: ${game.away} at ${game.home}, ${statusText}`);
        card.style.animation = `heroSlideIn 0.38s var(--ease-out-expo) forwards`;
        card.style.animationDelay = `${Math.min(index * 0.04, 0.45)}s`;

        card.innerHTML = `
            <div class="game-type-tag">${escapeMarkup(game.stage || "NBA")} · ${escapeMarkup(game.venue || "Venue TBD")}</div>
            <div class="game-main-row">
                <div class="game-teams-col">
                    <div class="game-team-row">
                        ${awayLogo ? `<img src="${escapeMarkup(awayLogo)}" alt="" class="game-team-logo">` : ""}
                        <span class="game-team-name">${escapeMarkup(game.away)}</span>${awayScore}
                    </div>
                    <div class="game-team-row">
                        ${homeLogo ? `<img src="${escapeMarkup(homeLogo)}" alt="" class="game-team-logo">` : ""}
                        <span class="game-team-name">${escapeMarkup(game.home)}</span>${homeScore}
                    </div>
                </div>
                <div class="game-divider"></div>
                <div class="game-time-col">
                    <div class="game-live-status is-${liveState}">${escapeMarkup(statusText)}</div>
                    <div class="game-time-label">${escapeMarkup(game.time || "Time TBD")}</div>
                </div>
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

function formatBoxScoreStat(value) {
    return value == null || value === "" ? "—" : String(value);
}

function shootingLine(statistics, madeKey, attemptKey) {
    return `${formatBoxScoreStat(statistics[madeKey])}-${formatBoxScoreStat(statistics[attemptKey])}`;
}

function renderBoxScoreTeam(team) {
    const players = Array.isArray(team.players) ? team.players : [];
    const rows = players.map(player => {
        const stats = player.statistics || {};
        const status = player.played ? formatBoxScoreStat(stats.minutes) : "DNP";
        return `
            <tr class="${player.starter ? "is-starter" : ""}">
                <th scope="row">${escapeMarkup(player.name)}<small>${escapeMarkup(player.position || "")}</small></th>
                <td>${escapeMarkup(status)}</td>
                <td>${escapeMarkup(formatBoxScoreStat(stats.points))}</td>
                <td>${escapeMarkup(formatBoxScoreStat(stats.rebounds))}</td>
                <td>${escapeMarkup(formatBoxScoreStat(stats.assists))}</td>
                <td>${escapeMarkup(formatBoxScoreStat(stats.steals))}</td>
                <td>${escapeMarkup(formatBoxScoreStat(stats.blocks))}</td>
                <td>${escapeMarkup(formatBoxScoreStat(stats.turnovers))}</td>
                <td>${escapeMarkup(shootingLine(stats, "field_goals", "field_goals_attempted"))}</td>
                <td>${escapeMarkup(shootingLine(stats, "three_pointers", "three_pointers_attempted"))}</td>
                <td>${escapeMarkup(shootingLine(stats, "free_throws", "free_throws_attempted"))}</td>
            </tr>
        `;
    }).join("");
    return `
        <section class="box-score-team">
            <h3>${team.logo ? `<img src="${escapeMarkup(team.logo)}" alt="">` : ""}${escapeMarkup(team.name)} <strong>${escapeMarkup(formatBoxScoreStat(team.score))}</strong></h3>
            <div class="box-score-table-wrap">
                <table class="box-score-table">
                    <thead><tr><th scope="col">Player</th><th scope="col">MIN</th><th scope="col">PTS</th><th scope="col">REB</th><th scope="col">AST</th><th scope="col">STL</th><th scope="col">BLK</th><th scope="col">TO</th><th scope="col">FG</th><th scope="col">3P</th><th scope="col">FT</th></tr></thead>
                    <tbody>${rows || '<tr><td colspan="11">Player box-score data is not available.</td></tr>'}</tbody>
                </table>
            </div>
        </section>
    `;
}

async function loadBoxScore(gameId, { background = false } = {}) {
    if (!gameId || activeBoxScoreGameId !== gameId) return;
    const statusElement = document.getElementById("boxScoreStatus");
    const content = document.getElementById("boxScoreContent");
    try {
        const response = await fetch(`${API_URL}/api/v1/games/${encodeURIComponent(gameId)}/boxscore`, {
            headers: { "x-api-key": API_KEY }
        });
        if (!response.ok) throw new Error(`Box score request failed (${response.status}).`);
        const payload = await response.json();
        if (payload.status === "unavailable" || !payload.home || !payload.away) {
            if (!background) {
                statusElement.textContent = payload.message || "The box score is not available yet.";
                content.innerHTML = "";
            }
            return;
        }

        const updatedAt = payload.last_updated
            ? new Date(payload.last_updated).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
            : "";
        statusElement.textContent = `${payload.game_status || "Game"}${updatedAt ? ` · Updated ${updatedAt}` : ""}${payload.status === "stale" ? " · Showing last available box score" : ""}`;
        content.innerHTML = `${renderBoxScoreTeam(payload.away)}${renderBoxScoreTeam(payload.home)}`;
        const isLive = Number(payload.status_code) === 2
            || /(live|q[1-4]|half|ot|in progress)/i.test(payload.game_status || "");
        if (boxScoreRefreshInterval) {
            window.clearInterval(boxScoreRefreshInterval);
            boxScoreRefreshInterval = null;
        }
        if (isLive) {
            boxScoreRefreshInterval = window.setInterval(() => loadBoxScore(gameId, { background: true }), 30 * 1000);
        }
    } catch (error) {
        console.error("Game box score load failed:", error);
        if (!background) {
            statusElement.textContent = "Could not load this box score. Check the API connection and try again.";
            content.innerHTML = "";
        }
    }
}

function openBoxScore(gameId) {
    const game = scheduleGames.find(item => item.id === gameId);
    const dialog = document.getElementById("boxScoreDialog");
    if (!game || !dialog) return;
    activeBoxScoreGameId = gameId;
    document.getElementById("boxScoreTitle").textContent = `${game.away} at ${game.home}`;
    const statusElement = document.getElementById("boxScoreStatus");
    const content = document.getElementById("boxScoreContent");
    const hasStarted = Number(game.status_code) > 1
        || /final|in progress|q[1-4]|half|ot|live/i.test(game.status || "");
    if (!hasStarted) {
        statusElement.textContent = `Tipoff ${game.date} · ${game.time}. Player box scores appear after the game begins.`;
        content.innerHTML = "";
    } else {
        statusElement.textContent = "Loading player box score…";
        content.innerHTML = '<p class="box-score-loading">Loading player statistics…</p>';
    }
    if (!dialog.open) dialog.showModal();
    if (hasStarted) loadBoxScore(gameId);
}

function closeBoxScore() {
    const dialog = document.getElementById("boxScoreDialog");
    if (dialog?.open) dialog.close();
    activeBoxScoreGameId = "";
    if (boxScoreRefreshInterval) {
        window.clearInterval(boxScoreRefreshInterval);
        boxScoreRefreshInterval = null;
    }
}

function updateHeadline(index) {
    currentHeadlineIndex = index;
    const item = headlines[currentHeadlineIndex];

    const heroEl = document.getElementById("hero");
    const content = document.querySelector(".hero-content");

    if (heroEl && item.bgGradient) {
        heroEl.style.background = item.bgGradient;
    }

    if (content) {
        content.style.animation = 'none';
        void content.offsetWidth;
        content.style.animation = 'heroSlideIn 0.45s var(--ease-out-expo) forwards';
    }

    document.getElementById("newsCategory").innerText = item.category;
    document.getElementById("newsHeadline").innerText = item.headline;
    document.getElementById("newsStory").innerText = item.story;

    document.getElementById("newsPill1").innerText = item.pills[0];
    document.getElementById("newsPill2").innerText = item.pills[1];
    document.getElementById("newsPill3").innerText = item.pills[2];

    const img = document.getElementById("newsImage");
    img.src = item.logo;
    img.onerror = () => {
        img.src = "https://cdn.nba.com/logos/nba/1610612738/primary/L/logo.svg";
    };

    const dots = document.querySelectorAll(".hero-dot");
    dots.forEach((dot, idx) => {
        dot.classList.toggle("active", idx === currentHeadlineIndex);
    });
}

function prevHeadline() {
    currentHeadlineIndex = (currentHeadlineIndex - 1 + headlines.length) % headlines.length;
    updateHeadline(currentHeadlineIndex);
    resetHeadlineAutoPlay();
}

function nextHeadline() {
    currentHeadlineIndex = (currentHeadlineIndex + 1) % headlines.length;
    updateHeadline(currentHeadlineIndex);
    resetHeadlineAutoPlay();
}

function setupHeadlineDots() {
    const dotsContainer = document.getElementById("heroDots");
    dotsContainer.innerHTML = "";
    headlines.forEach((_, idx) => {
        const dot = document.createElement("div");
        dot.className = `hero-dot ${idx === 0 ? "active" : ""}`;
        dot.onclick = () => {
            updateHeadline(idx);
            resetHeadlineAutoPlay();
        };
        dotsContainer.appendChild(dot);
    });
}

function startHeadlineAutoPlay() {
    headlineAutoTimer = setInterval(() => {
        currentHeadlineIndex = (currentHeadlineIndex + 1) % headlines.length;
        updateHeadline(currentHeadlineIndex);
    }, 6000);
}

function resetHeadlineAutoPlay() {
    clearInterval(headlineAutoTimer);
    startHeadlineAutoPlay();
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
            return (selectedTxFilter === "ALL") || (item.type === selectedTxFilter);
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

                const team = allTeams.find(candidate => candidate.name === item.team);
                const logo = team?.logo || "https://cdn.nba.com/logos/nba/1610612738/primary/L/logo.svg";

                card.innerHTML = `
                    <img src="${escapeMarkup(logo)}" alt="${escapeMarkup(item.team)}" class="tx-team-logo" onerror="this.src='https://cdn.nba.com/logos/nba/1610612738/primary/L/logo.svg'">
                    <div class="tx-card-right">
                        <div class="tx-meta-row">
                            <span class="tx-badge tx-badge-${escapeMarkup(item.type)}">${escapeMarkup(item.type.replace('_', ' '))}</span>
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
        <div style="margin-bottom: 6px;">Last Season: <strong>${team.last_season_record}</strong></div>
        <div style="margin-bottom: 6px;">Championships: <strong>${team.championships ?? "—"}</strong></div>
        <div style="font-size: 0.78rem; line-height: 1.4; color: #475569; margin-bottom: 14px;">Years: <strong>${yearsString}</strong></div>
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
            <span style="font-size: 0.85rem; font-weight: 800; color: #111827;">Payroll: ${formattedSalary}</span>
            <span class="tx-badge tx-badge-${taxStatus.replace(' ', '_')}">${taxStatus}</span>
        `;
    }

    if (teamTxContainer) {
        teamTxContainer.innerHTML = teamTxList.length > 0 ? teamTxList.map(t => `
            <div class="modal-tx-item">
                <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
                    <span class="tx-badge tx-badge-${t.type}">${t.type}</span>
                    <span style="font-size:0.72rem; color:#64748b; font-weight:700;">${t.date}</span>
                </div>
                <div>${t.text}</div>
            </div>
        `).join("") : `<p style="font-size:0.8rem; color:#64748b;">No major offseason transactions recorded.</p>`;
    }

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

setupHeadlineDots();
updateHeadline(0);
startHeadlineAutoPlay();
filterTransactions();
renderSchedule();
loadTeams();
loadSchedule();
loadLiveScores();
loadTransactions();
document.getElementById("schedulePreviousDay").addEventListener("click", () => changeScheduleDate(-1));
document.getElementById("scheduleNextDay").addEventListener("click", () => changeScheduleDate(1));
document.getElementById("scheduleToday").addEventListener("click", () => {
    selectedScheduleDate = localDateKey();
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
document.getElementById("closeBoxScore").addEventListener("click", closeBoxScore);
document.getElementById("boxScoreDialog").addEventListener("close", () => {
    activeBoxScoreGameId = "";
    if (boxScoreRefreshInterval) {
        window.clearInterval(boxScoreRefreshInterval);
        boxScoreRefreshInterval = null;
    }
});
window.setInterval(loadTeams, 15 * 60 * 1000);
window.setInterval(loadSchedule, 24 * 60 * 60 * 1000);
window.setInterval(() => loadLiveScores({ background: true }), 60 * 1000);
window.setInterval(() => loadTransactions({ background: true }), 60 * 60 * 1000);
document.addEventListener("visibilitychange", () => {
    if (!document.hidden && Date.now() - lastTeamsRefreshAt >= 15 * 60 * 1000) loadTeams();
});
document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    if (Date.now() - lastScheduleRefreshAt >= 24 * 60 * 60 * 1000) loadSchedule();
    if (Date.now() - lastScoreRefreshAt >= 60 * 1000) loadLiveScores({ background: true });
    if (Date.now() - lastTransactionsRefreshAt >= 60 * 60 * 1000) loadTransactions({ background: true });
});
