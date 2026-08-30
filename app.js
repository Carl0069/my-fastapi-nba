const API_URL = "/api";

const DIVISIONS = ["Atlantic", "Central", "Southeast", "Northwest", "Pacific", "Southwest"];

async function loadTeams() {
    try {
        const response = await fetch(`${API_URL}/teams`);
        const data = await response.json();
        renderTeamsByDivision(data.teams);
    } catch (error) {
        console.error(error);
        document.getElementById("divisionGrid").innerHTML = "<p>Unable to connect to the NBA API.</p>";
    }
}

function renderTeamsByDivision(teams) {
    const grid = document.getElementById("divisionGrid");
    grid.innerHTML = "";

    // Group teams by their division
    DIVISIONS.forEach(divName => {
        const divTeams = teams.filter(t => t.division.toLowerCase() === divName.toLowerCase());
        if (divTeams.length === 0) return;

        const col = document.createElement("div");
        col.className = "division-column";
        col.innerHTML = `<h3>${divName}</h3>`;

        divTeams.forEach(team => {
            const teamRow = document.createElement("div");
            teamRow.className = "team-entry";
            teamRow.innerHTML = `
                <img class="team-logo" src="${team.logo}" alt="${team.name}" onerror="this.src='https://via.placeholder.com/44'">
                <div class="team-info">
                    <h4>${team.name}</h4>
                    <div class="team-links">
                        <span onclick="viewProfile(${team.id})">Profile ↗</span>
                        <span onclick="viewStats(${team.id})">Stats ↗</span>
                    </div>
                </div>
            `;
            col.appendChild(teamRow);
        });

        grid.appendChild(col);
    });
}

// PROFILE MODAL (Record & Conference)
async function viewProfile(id) {
    try {
        const res = await fetch(`${API_URL}/teams/${id}`);
        const team = await res.json();

        document.getElementById("modalBody").innerHTML = `
            <h2>${team.name}</h2>
            <p><strong>Conference:</strong> ${team.conference}</p>
            <p><strong>Division:</strong> ${team.division}</p>
            <p><strong>Last Season Record (2025-26):</strong> ${team.last_season_record}</p>
        `;
        document.getElementById("teamModal").style.display = "block";
    } catch (err) {
        alert("Failed to load profile.");
    }
}

// STATS MODAL (2026-2027 Starting 5 & Stats)
async function viewStats(id) {
    try {
        const res = await fetch(`${API_URL}/teams/${id}`);
        const team = await res.json();

        let tableRows = team.starters_2026_27.map(p => `
            <tr>
                <td>${p.pos}</td>
                <td><strong>${p.name}</strong></td>
                <td>${p.pts}</td>
                <td>${p.reb}</td>
                <td>${p.ast}</td>
            </tr>
        `).join("");

        document.getElementById("modalBody").innerHTML = `
            <h2>${team.name}</h2>
            <h4>2026-2027 Starting Five & Per Game Stats</h4>
            <table class="stat-table">
                <thead>
                    <tr>
                        <th>POS</th>
                        <th>Player</th>
                        <th>PTS</th>
                        <th>REB</th>
                        <th>AST</th>
                    </tr>
                </thead>
                <tbody>${tableRows}</tbody>
            </table>
        `;
        document.getElementById("teamModal").style.display = "block";
    } catch (err) {
        alert("Failed to load stats.");
    }
}

function closeModal() {
    document.getElementById("teamModal").style.display = "none";
}

// SEARCH LOGIC
async function searchTeams() {
    const query = document.getElementById("searchInput").value.trim();
    if (!query) {
        loadTeams();
        return;
    }

    try {
        const response = await fetch(`${API_URL}/teams/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        renderTeamsByDivision(data.results);
    } catch (error) {
        console.error(error);
        alert("Search failed.");
    }
}

// Close modal when clicking outside the box
window.onclick = function(e) {
    const modal = document.getElementById("teamModal");
    if (e.target === modal) modal.style.display = "none";
}

loadTeams();
