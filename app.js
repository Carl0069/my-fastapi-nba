const API_URL = "https:my-fastapi-nba.vercel.app"; // Update with your deployed URL or http://127.0.0.1:8000 for local dev

const DIVISION_ORDER = ["Atlantic", "Central", "Southeast", "Northwest", "Pacific", "Southwest"];

document.getElementById("searchInput").addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
        searchTeams();
    }
});

async function loadTeams() {
    const container = document.getElementById("divisionsContainer");
    container.innerHTML = "<p>Loading NBA teams...</p>";

    try {
        const response = await fetch(`${API_URL}/teams`);
        if (!response.ok) throw new Error("Failed to load teams.");
        const data = await response.json();
        renderDivisions(data.teams);
    } catch (error) {
        console.error(error);
        container.innerHTML = "<p style='color:red;'>Unable to connect to the NBA API.</p>";
    }
}

async function searchTeams() {
    const query = document.getElementById("searchInput").value.trim();
    if (!query) {
        loadTeams();
        return;
    }

    const container = document.getElementById("divisionsContainer");
    container.innerHTML = "<p>Searching...</p>";

    try {
        const response = await fetch(`${API_URL}/teams/search?q=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error("Search failed.");
        const data = await response.json();
        renderDivisions(data.results);
    } catch (error) {
        console.error(error);
        container.innerHTML = "<p style='color:red;'>Search request failed.</p>";
    }
}

function renderDivisions(teams) {
    const container = document.getElementById("divisionsContainer");
    container.innerHTML = "";

    if (!teams || teams.length === 0) {
        container.innerHTML = "<p>No matching NBA teams or players found.</p>";
        return;
    }

    // Group teams by division
    const grouped = {};
    DIVISION_ORDER.forEach(div => grouped[div] = []);

    teams.forEach(team => {
        if (!grouped[team.division]) {
            grouped[team.division] = [];
        }
        grouped[team.division].push(team);
    });

    // Render each division column (Atlantic, Central, etc.)
    DIVISION_ORDER.forEach(divisionName => {
        const divisionTeams = grouped[divisionName] || [];
        if (divisionTeams.length === 0) return;

        const col = document.createElement("div");
        col.className = "division-column";

        const teamsListHtml = divisionTeams.map(team => `
            <div class="team-row">
                <img src="${team.logo}" alt="${team.name}" class="team-logo" onerror="this.src='https://cdn.nba.com/logos/leagues/L/logo-nba.svg'">
                <div class="team-info-group">
                    <button class="team-title-btn" onclick="openTeamModal(${team.id})">
                        ${team.name} <span class="external-icon">↗</span>
                    </button>
                    <div class="team-links">
                        <a onclick="openTeamModal(${team.id})">Profile</a>
                        <a onclick="openTeamModal(${team.id})">Stats</a>
                        <a onclick="alert('Viewing 2026-2027 Schedule for ${team.name}')">Schedule ↗</a>
                        <a onclick="alert('Tickets for ${team.arena}')">Tickets ↗</a>
                    </div>
                </div>
            </div>
        `).join("");

        col.innerHTML = `
            <h2>${divisionName}</h2>
            <div class="teams-list">
                ${teamsListHtml}
            </div>
        `;

        container.appendChild(col);
    });
}

async function openTeamModal(teamId) {
    try {
        const response = await fetch(`${API_URL}/teams/${teamId}`);
        if (!response.ok) throw new Error("Team not found.");
        const team = await response.json();

        const playerRows = (team.roster || []).map(p => `
            <tr>
                <td><strong>${p.name}</strong></td>
                <td><span class="pos-tag">${p.pos}</span></td>
                <td><strong>${p.ppg}</strong></td>
                <td>${p.rpg}</td>
                <td>${p.apg}</td>
                <td>${p.spg}</td>
                <td>${p.fg_pct}</td>
                <td>${p.fg3_pct}</td>
            </tr>
        `).join("");

        const modalContent = document.getElementById("modalContent");
        modalContent.innerHTML = `
            <div class="modal-header-section">
                <img src="${team.logo}" alt="${team.name}">
                <div>
                    <h2>${team.name}</h2>
                    <p class="modal-sub">${team.conference} Conference • ${team.division} Division</p>
                </div>
            </div>

            <p><strong>Arena:</strong> ${team.arena} (${team.city}) &nbsp;|&nbsp; <strong>Founded:</strong> ${team.founded} &nbsp;|&nbsp; <strong>Championships:</strong> 🏆 ${team.championships}</p>
            <p style="color:#555; font-size:0.9rem;">${team.description}</p>

            <h3 style="margin-top:20px; font-size:1.05rem;">2026–2027 Player Roster & Projected Stats</h3>
            <div style="overflow-x: auto;">
                <table class="roster-table">
                    <thead>
                        <tr>
                            <th>Player</th>
                            <th>Pos</th>
                            <th>PTS</th>
                            <th>REB</th>
                            <th>AST</th>
                            <th>STL</th>
                            <th>FG%</th>
                            <th>3P%</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${playerRows}
                    </tbody>
                </table>
            </div>
        `;

        document.getElementById("teamModal").style.display = "flex";
    } catch (err) {
        console.error(err);
        alert("Failed to load team details.");
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

loadTeams();
