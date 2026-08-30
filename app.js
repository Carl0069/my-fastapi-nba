const API_URL = "https://my-fastapi-nba.vercel.app";
let allTeams = [];
let currentFilter = "ALL";

const DIVISION_ORDER = ["Atlantic", "Central", "Southeast", "Northwest", "Pacific", "Southwest"];

async function loadTeams() {
    const container = document.getElementById("teamContainer");
    container.innerHTML = '<p class="loading-text">Loading NBA Teams...</p>';
    document.getElementById("searchInput").value = "";

    try {
        const response = await fetch(`${API_URL}/teams`);
        if (!response.ok) throw new Error("Failed to fetch teams");
        const data = await response.json();
        allTeams = data.teams;
        renderTeamsByDivision(allTeams);
    } catch (error) {
        console.error(error);
        container.innerHTML = `
            <p class="loading-text" style="color: #c9082a;">
                Unable to load data from <code>${API_URL}</code>. Check your Vercel backend deployment.
            </p>
        `;
    }
}

function renderTeamsByDivision(teams) {
    const container = document.getElementById("teamContainer");
    container.innerHTML = "";

    if (teams.length === 0) {
        container.innerHTML = '<p class="loading-text">No teams found.</p>';
        return;
    }

    const grouped = {};
    teams.forEach(team => {
        if (!grouped[team.division]) {
            grouped[team.division] = [];
        }
        grouped[team.division].push(team);
    });

    const activeDivisions = DIVISION_ORDER.filter(div => grouped[div] && grouped[div].length > 0);

    activeDivisions.forEach(divisionName => {
        const col = document.createElement("div");
        col.className = "division-column";

        let teamsHtml = grouped[divisionName].map(team => `
            <div class="team-item">
                <img src="${team.logo}" alt="${team.name}" class="team-logo" loading="lazy" onerror="this.src='https://cdn.nba.com/logos/nba/1610612738/primary/L/logo.svg'">
                <div class="team-info">
                    <div class="team-title">${team.name}</div>
                    <div class="team-record">Last Season: ${team.last_season_record}</div>
                    <div class="team-actions">
                        <span class="action-link" onclick="viewTeam(${team.id})">Starters & Stats &#x2197;</span>
                    </div>
                </div>
            </div>
        `).join("");

        col.innerHTML = `
            <div class="division-header">${divisionName}</div>
            <div class="team-list">${teamsHtml}</div>
        `;

        container.appendChild(col);
    });
}

function filterByConference(conf, element) {
    currentFilter = conf;
    document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
    if (element) element.classList.add("active");

    const heading = document.getElementById("viewHeading");
    if (conf === "ALL") {
        heading.innerText = "ALL TEAMS";
        renderTeamsByDivision(allTeams);
    } else {
        heading.innerText = `${conf.toUpperCase()} CONFERENCE TEAMS`;
        const filtered = allTeams.filter(t => t.conference.toLowerCase() === conf.toLowerCase());
        renderTeamsByDivision(filtered);
    }
}

async function searchTeams() {
    const query = document.getElementById("searchInput").value.trim();
    if (!query) {
        loadTeams();
        return;
    }

    const container = document.getElementById("teamContainer");
    container.innerHTML = '<p class="loading-text">Searching rosters and teams...</p>';

    try {
        const response = await fetch(`${API_URL}/teams/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        document.getElementById("viewHeading").innerText = `SEARCH RESULTS FOR "${query.toUpperCase()}" (${data.count})`;
        renderTeamsByDivision(data.results);
    } catch (error) {
        console.error(error);
        container.innerHTML = '<p class="loading-text" style="color: #c9082a;">Search request failed.</p>';
    }
}

async function viewTeam(teamId) {
    try {
        const response = await fetch(`${API_URL}/teams/${teamId}`);
        const team = await response.json();

        const modalBody = document.getElementById("modalBody");
        const startersHtml = team.starters_2026_27.map(p => `
            <tr>
                <td class="pos-tag">${p.pos}</td>
                <td><strong>${p.name}</strong></td>
                <td>${p.pts.toFixed(1)}</td>
                <td>${p.reb.toFixed(1)}</td>
                <td>${p.ast.toFixed(1)}</td>
                <td>${p.fg.toFixed(1)}%</td>
                <td>${p.fg3.toFixed(1)}%</td>
                <td>${p.ft.toFixed(1)}%</td>
            </tr>
        `).join("");

        modalBody.innerHTML = `
            <div class="modal-team-header">
                <img src="${team.logo}" alt="${team.name}" class="modal-team-logo">
                <div>
                    <h3>${team.name}</h3>
                    <div class="modal-badges">
                        <span class="badge">${team.conference} Conference</span>
                        <span class="badge">${team.division} Division</span>
                        <span class="badge">Last Season: ${team.last_season_record}</span>
                    </div>
                </div>
            </div>
            <h4 style="margin: 15px 0 10px; font-size: 14px; text-transform: uppercase; color: #475569;">
                2026–27 Projected Starting Lineup
            </h4>
            <div style="overflow-x: auto;">
                <table class="stats-table">
                    <thead>
                        <tr>
                            <th>POS</th>
                            <th>PLAYER</th>
                            <th>PTS</th>
                            <th>REB</th>
                            <th>AST</th>
                            <th>FG%</th>
                            <th>3P%</th>
                            <th>FT%</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${startersHtml}
                    </tbody>
                </table>
            </div>
        `;

        document.getElementById("teamModal").style.display = "block";
    } catch (error) {
        console.error(error);
        alert("Unable to fetch team lineup details.");
    }
}

function closeModal() {
    document.getElementById("teamModal").style.display = "none";
}

window.onclick = function(event) {
    const modal = document.getElementById("teamModal");
    if (event.target === modal) {
        closeModal();
    }
};

document.getElementById("searchInput").addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        searchTeams();
    }
});

loadTeams();
