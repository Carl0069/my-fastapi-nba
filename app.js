const API_URL = "https://YOUR-API.vercel.app"; // Update with your deployed URL or http://127.0.0.1:8000 for local dev

// ENTER KEY SEARCH
document.getElementById("searchInput").addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
        searchTeams();
    }
});

// GET ALL TEAMS
async function loadTeams() {
    try {
        const response = await fetch(`${API_URL}/teams`);
        const data = await response.json();
        displayTeams(data.teams);
    } catch (error) {
        console.error(error);
        document.getElementById("teamList").innerHTML = "Unable to connect to the NBA API.";
    }
}

// DISPLAY TEAMS
function displayTeams(teams) {
    const teamList = document.getElementById("teamList");
    teamList.innerHTML = "";

    if (!teams || teams.length === 0) {
        teamList.innerHTML = "<p>No NBA teams found.</p>";
        return;
    }

    teams.forEach(team => {
        const card = document.createElement("div");
        card.className = "team-card";

        // Generate player stat rows
        const rosterHtml = (team.roster || []).map(p => `
            <tr>
                <td><strong>${p.name}</strong></td>
                <td><span class="pos-tag">${p.pos}</span></td>
                <td>${p.ppg}</td>
                <td>${p.rpg}</td>
                <td>${p.apg}</td>
                <td>${p.spg}</td>
                <td>${p.fg_pct}</td>
                <td>${p.fg3_pct}</td>
            </tr>
        `).join("");

        card.innerHTML = `
            <div class="team-division">${team.conference} Conf • ${team.division} Division</div>
            <h3>${team.name}</h3>
            <p class="team-arena"><strong>Arena:</strong> ${team.arena} (${team.city})</p>
            <p class="team-desc">${team.description}</p>
            <p class="team-rings">🏆 <strong>${team.championships}</strong> Championships</p>

            <div class="roster-container">
                <h4>2026–2027 Player Stats</h4>
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
                        ${rosterHtml}
                    </tbody>
                </table>
            </div>

            <button onclick="viewTeam(${team.id})">View Team Details</button>
        `;

        teamList.appendChild(card);
    });
}

// GET ONE TEAM (Alert Breakdown)
async function viewTeam(id) {
    try {
        const response = await fetch(`${API_URL}/teams/${id}`);
        const team = await response.json();

        const rosterList = (team.roster || [])
            .map(p => `- ${p.name} (${p.pos}): ${p.ppg} PPG, ${p.rpg} RPG, ${p.apg} APG`)
            .join("\n");

        alert(`
${team.name}
City: ${team.city}
Conference: ${team.conference}
Division: ${team.division}
Arena: ${team.arena}
Championships: ${team.championships}

2026-2027 Key Players:
${rosterList}
        `);
    } catch (error) {
        console.error(error);
        alert("Unable to retrieve team details.");
    }
}

// SEARCH
async function searchTeams() {
    const query = document.getElementById("searchInput").value.trim();
    if (!query) {
        loadTeams();
        return;
    }
    try {
        const response = await fetch(`${API_URL}/teams/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        displayTeams(data.results);
    } catch (error) {
        console.error(error);
        alert("Search failed.");
    }
}

loadTeams();