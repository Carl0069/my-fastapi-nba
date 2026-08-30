const API_URL = "https://my-fastapi-nba.vercel.app";

let allTeams = [];
let featuredTeams = [];
let currentHeroIndex = 0;
let selectedFranchise = "";
let selectedConference = "ALL";

// GET ALL TEAMS
async function loadTeams() {
    try {
        const response = await fetch(`${API_URL}/teams`);
        const data = await response.json();
        allTeams = data.teams || [];

        // Pick top marquee teams for the hero slider
        const heroTeamNames = [
            "Denver Nuggets",
            "Oklahoma City Thunder",
            "Boston Celtics",
            "Los Angeles Lakers",
            "San Antonio Spurs",
            "Miami Heat"
        ];
        featuredTeams = allTeams.filter(t => heroTeamNames.includes(t.name));
        if (featuredTeams.length === 0) {
            featuredTeams = allTeams.slice(0, 5);
        }

        displayTeams(allTeams);
        if (featuredTeams.length > 0) {
            updateHero(0);
        }
    } catch (error) {
        console.error(error);
        document.getElementById("teamGrid").innerHTML = "<p style='grid-column: 1/-1; text-align:center; color:#c9082a; padding: 40px 0;'>Unable to connect to the NBA API.</p>";
    }
}

// RENDER GRID CARDS
function displayTeams(teams) {
    const grid = document.getElementById("teamGrid");
    grid.innerHTML = "";

    if (!teams || teams.length === 0) {
        grid.innerHTML = "<p style='grid-column: 1/-1; text-align:center; color:#64748b; padding: 40px 0;'>No teams or players found matching your selection.</p>";
        return;
    }

    teams.forEach(team => {
        const card = document.createElement("div");
        card.className = "watch-card";
        card.onclick = () => openModal(team);

        card.innerHTML = `
            <div class="card-top">
                <img src="${team.logo}" alt="${team.name}" onerror="this.src='https://cdn.nba.com/logos/nba/1610612738/primary/L/logo.svg'">
            </div>
            <div class="card-bottom">
                <p class="card-brand">${team.conference} • ${team.division}</p>
                <h4 class="card-title">${team.name}</h4>
                <p class="card-subtitle">Star: ${team.featured_star}</p>
            </div>
        `;

        grid.appendChild(card);
    });
}

// HERO DISPLAY CONTROLS
function updateHero(index) {
    if (!featuredTeams || featuredTeams.length === 0) return;
    currentHeroIndex = index;
    const team = featuredTeams[currentHeroIndex];

    document.getElementById("heroConference").innerText = `${team.conference.toUpperCase()} CONFERENCE • ${team.division.toUpperCase()} DIVISION`;
    document.getElementById("heroTitle").innerText = team.name;
    document.getElementById("heroStar").innerText = `Featured Star: ${team.featured_star}`;
    document.getElementById("heroDesc").innerText = team.description;
    document.getElementById("heroStat").innerText = team.headline_stat;
    document.getElementById("heroRecord").innerText = `${team.last_season_record} Last Season`;

    const heroImg = document.getElementById("heroImage");
    heroImg.src = team.logo;
    heroImg.onerror = () => {
        heroImg.src = "https://cdn.nba.com/logos/nba/1610612738/primary/L/logo.svg";
    };
}

function prevHeroTeam() {
    if (featuredTeams.length === 0) return;
    currentHeroIndex = (currentHeroIndex - 1 + featuredTeams.length) % featuredTeams.length;
    updateHero(currentHeroIndex);
}

function nextHeroTeam() {
    if (featuredTeams.length === 0) return;
    currentHeroIndex = (currentHeroIndex + 1) % featuredTeams.length;
    updateHero(currentHeroIndex);
}

// SEARCH FILTER
function searchTeams() {
    const query = document.getElementById("searchInput").value.trim().toLowerCase();

    document.querySelectorAll(".brand-circle").forEach(btn => btn.classList.remove("active"));
    selectedFranchise = "";

    let filtered = allTeams;
    if (selectedConference !== "ALL") {
        filtered = filtered.filter(t => t.conference.toLowerCase() === selectedConference.toLowerCase());
    }

    if (!query) {
        displayTeams(filtered);
        return;
    }

    const results = filtered.filter(team => {
        const teamName = team.name.toLowerCase();
        const div = team.division.toLowerCase();
        const conf = team.conference.toLowerCase();
        const star = team.featured_star.toLowerCase();
        const playerMatch = team.starters_2026_27.some(p =>
            p.name.toLowerCase().includes(query) || p.pos.toLowerCase() === query
        );

        return teamName.includes(query) || div.includes(query) || conf.includes(query) || star.includes(query) || playerMatch;
    });

    displayTeams(results);
}

// FRANCHISE QUICK SELECT FILTER
function toggleFranchiseFilter(teamName, element) {
    const isAlreadySelected = element.classList.contains("active");

    document.querySelectorAll(".brand-circle").forEach(btn => btn.classList.remove("active"));
    document.getElementById("searchInput").value = "";

    if (isAlreadySelected) {
        selectedFranchise = "";
        applyFilters();
    } else {
        selectedFranchise = teamName;
        element.classList.add("active");
        const filtered = allTeams.filter(t => t.name.toLowerCase() === teamName.toLowerCase());
        displayTeams(filtered);
    }
}

// CONFERENCE TAB FILTER
function filterConference(conf, element) {
    selectedConference = conf;
    document.querySelectorAll(".conf-tab").forEach(tab => tab.classList.remove("active"));
    if (element) element.classList.add("active");
    applyFilters();
}

function applyFilters() {
    let list = allTeams;
    if (selectedConference !== "ALL") {
        list = list.filter(t => t.conference.toLowerCase() === selectedConference.toLowerCase());
    }
    if (selectedFranchise) {
        list = list.filter(t => t.name.toLowerCase() === selectedFranchise.toLowerCase());
    }
    displayTeams(list);
}

// MODAL CONTROLS
function openModal(team) {
    document.getElementById("modalConference").innerText = `${team.conference.toUpperCase()} CONFERENCE • ${team.division.toUpperCase()}`;
    document.getElementById("modalTitle").innerText = team.name;
    document.getElementById("modalStar").innerText = `Featured Star: ${team.featured_star} (${team.headline_stat})`;
    document.getElementById("modalRecord").innerText = `Last Season: ${team.last_season_record}`;
    document.getElementById("modalDescription").innerText = team.description;

    const modalImg = document.getElementById("modalLogo");
    modalImg.src = team.logo;
    modalImg.onerror = () => {
        modalImg.src = "https://cdn.nba.com/logos/nba/1610612738/primary/L/logo.svg";
    };

    const tbody = document.getElementById("modalStartersBody");
    tbody.innerHTML = team.starters_2026_27.map(p => `
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

// EVENT LISTENERS
const searchInput = document.getElementById("searchInput");
searchInput.addEventListener("input", searchTeams);
searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") searchTeams();
});

loadTeams();
