// Improved app.js — resolve API URL automatically and add defensive handling for Vercel

// Use the current origin + /api so the front-end will call the same deployment's /api
// If your API is hosted on a different domain, set window.API_BASE_OVERRIDE = 'https://api.example.com'
const API_URL = (window.API_BASE_OVERRIDE || `${window.location.origin}/api`).replace(/\/+$/,'');

const DIVISIONS = ["Atlantic", "Central", "Southeast", "Northwest", "Pacific", "Southwest"];

// Helper: normalize teams array from different API shapes
function normalizeTeamsPayload(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.teams)) return payload.teams;
    if (Array.isArray(payload.results)) return payload.results;
    return [];
}

// FETCH ALL TEAMS
async function loadTeams() {
    try {
        const response = await fetch(`${API_URL}/teams`);
        if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw new Error(`API call failed: ${response.status} ${text}`);
        }

        const data = await response.json();
        const teams = normalizeTeamsPayload(data);

        if (!teams || teams.length === 0) {
            document.getElementById("divisionGrid").innerHTML = "<p>No teams found from the API.</p>";
            return;
        }

        renderTeamsByDivision(teams);
    } catch (error) {
        console.error(error);
        const grid = document.getElementById("divisionGrid");
        if (grid) grid.innerHTML = "<p>Unable to connect to the NBA API.</p>";
    }
}

// RENDER 6-DIVISION GRID
function renderTeamsByDivision(teams) {
    if (!Array.isArray(teams)) teams = normalizeTeamsPayload(teams);

    const grid = document.getElementById("divisionGrid");
    if (!grid) return console.warn('No #divisionGrid element found in DOM');
    grid.innerHTML = "";

    DIVISIONS.forEach(divName => {
        const divTeams = teams.filter(t => (t.division || '').toLowerCase() === divName.toLowerCase());
        if (divTeams.length === 0) return;

        const col = document.createElement("div");
        col.className = "division-column";
        col.innerHTML = `<h3>${divName}</h3>`;

        divTeams.forEach(team => {
            const teamRow = document.createElement("div");
            teamRow.className = "team-entry";
            const logo = team.logo || 'https://via.placeholder.com/44';
            const name = team.name || 'Unknown Team';
            const id = team.id || team.team_id || 0;

            teamRow.innerHTML = `
                <img class="team-logo" src="${logo}" alt="${name}" onerror="this.src='https://via.placeholder.com/44'">
                <div class="team-info">
                    <h4>${name}</h4>
                    <div class="team-links">
                        <span onclick="viewProfile(${id})">Profile ↗</span>
                        <span onclick="viewStats(${id})">Stats ↗</span>
                    </div>
                </div>
            `;
            col.appendChild(teamRow);
        });

        grid.appendChild(col);
    });
}

// PROFILE POPUP MODAL
async function viewProfile(id) {
    try {
        const res = await fetch(`${API_URL}/teams/${id}`);
        if (!res.ok) throw new Error('Failed to fetch team');
        const team = await res.json();

        const modal = document.getElementById("teamModal");
        const body = document.getElementById("modalBody");
        if (body) {
            body.innerHTML = `
                <h2>${team.name || 'Team'}</h2>
                <p><strong>Conference:</strong> ${team.conference || ''}</p>
                <p><strong>Division:</strong> ${team.division || ''}</p>
                <p><strong>Last Season Record (2025-26):</strong> ${team.last_season_record || team.record || 'N/A'}</p>
            `;
        }
        if (modal) modal.style.display = "block";
    } catch (err) {
        console.error(err);
        alert("Failed to load profile.");
    }
}

// STATS & STARTING 5 POPUP MODAL
async function viewStats(id) {
    try {
        const res = await fetch(`${API_URL}/teams/${id}`);
        if (!res.ok) throw new Error('Failed to fetch team');
        const team = await res.json();

        const starters = Array.isArray(team.starters_2026_27) ? team.starters_2026_27 : (team.starters || []);

        let tableRows = starters.map(p => `
            <tr>
                <td><strong>${p.pos || ''}</strong></td>
                <td>${p.name || ''}</td>
                <td>${p.pts != null ? p.pts : ''}</td>
                <td>${p.reb != null ? p.reb : ''}</td>
                <td>${p.ast != null ? p.ast : ''}</td>
            </tr>
        `).join("");

        if (!tableRows) tableRows = `<tr><td colspan="5">No starters available.</td></tr>`;

        const modal = document.getElementById("teamModal");
        const body = document.getElementById("modalBody");
        if (body) {
            body.innerHTML = `
                <h2>${team.name || 'Team'}</h2>
                <p><strong>2025-26 Season Record:</strong> ${team.last_season_record || team.record || 'N/A'}</p>
                <h4>2026-2027 Starting Lineup & Stats</h4>
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
        }
        if (modal) modal.style.display = "block";
    } catch (err) {
        console.error(err);
        alert("Failed to load stats.");
    }
}

function closeModal() {
    const modal = document.getElementById("teamModal");
    if (modal) modal.style.display = "none";
}

// SEARCH FUNCTION
async function searchTeams() {
    const queryEl = document.getElementById("searchInput");
    const query = queryEl ? queryEl.value.trim() : '';
    if (!query) {
        loadTeams();
        return;
    }

    try {
        const response = await fetch(`${API_URL}/teams/search?q=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error('Search API call failed');
        const data = await response.json();
        const teams = normalizeTeamsPayload(data);

        if (!teams || teams.length === 0) {
            const grid = document.getElementById("divisionGrid");
            if (grid) grid.innerHTML = `<p>No results for "${query}"</p>`;
            return;
        }

        renderTeamsByDivision(teams);
    } catch (error) {
        console.error(error);
        alert("Search failed.");
    }
}

// CLOSE MODAL ON OUTSIDE CLICK
window.onclick = function(e) {
    const modal = document.getElementById("teamModal");
    if (e.target === modal) modal.style.display = "none";
}

// Expose functions to window so inline onclick in generated HTML works
window.viewProfile = viewProfile;
window.viewStats = viewStats;
window.closeModal = closeModal;
window.searchTeams = searchTeams;

// Initialize once DOM loaded
window.addEventListener('DOMContentLoaded', () => {
    loadTeams();
});
