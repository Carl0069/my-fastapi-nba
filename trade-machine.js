const API_URL = "https://my-fastapi-nba.vercel.app";
const API_KEY = "lebron2369";
const MAX_TRADE_TEAMS = 5;
const SAVED_TRADES_KEY = "nba-trade-desk.saved-trades.v1";
const CBA_ESTIMATES = {
  season: "2026–27 estimate",
  salaryCap: 164_961_000,
  firstApron: 209_015_000,
  secondApron: 221_686_000,
  minimumTeamSalary: 148_465_000,
  baseCap: 154_647_000,
  baseSmallOutgoing: 7_500_000,
  baseMediumOutgoing: 29_000_000,
  baseMediumAllowance: 7_500_000,
  baseFixedAllowance: 250_000,
  lastTradeableFirstRoundYear: 2033
};

let teams = [];
let lastTeamsRefreshAt = 0;
let isLoadingTeams = false;
const state = {
  teamIds: [],
  transfers: {},
  pickTransfers: {},
  pickSwaps: {},
  pickProtections: {},
  customPickProtections: {},
  pickSwapTypes: {},
  activeViews: {},
  openTeamPickerSlot: null
};

const teamGridEl = document.getElementById("teamGrid");
const trendingPlayersEl = document.getElementById("trendingPlayers");
const teamCountLabelEl = document.getElementById("teamCountLabel");
const apiStatusEl = document.getElementById("apiStatus");
const addTeamBtn = document.getElementById("addTeamBtn");
const clearTradeBtn = document.getElementById("clearTradeBtn");
const reviewTradeBtn = document.getElementById("reviewTradeBtn");
const reviewDialog = document.getElementById("tradeReviewDialog");
const reviewContentEl = document.getElementById("reviewContent");
const reviewTitleEl = document.getElementById("reviewTitle");
const closeReviewBtn = document.getElementById("closeReviewBtn");
const doneReviewBtn = document.getElementById("doneReviewBtn");
const saveTradeBtn = document.getElementById("saveTradeBtn");
const editSavedTradeBtn = document.getElementById("editSavedTradeBtn");
const savedTradesBtn = document.getElementById("savedTradesBtn");
const savedTradesDialog = document.getElementById("savedTradesDialog");
const savedTradesContentEl = document.getElementById("savedTradesContent");
const closeSavedTradesBtn = document.getElementById("closeSavedTradesBtn");
const playerProfileDialog = document.getElementById("playerProfileDialog");
const playerProfileContentEl = document.getElementById("playerProfileContent");
const toastCloseBtn = document.getElementById("tradeToastClose");
const tradeToastEl = document.getElementById("tradeToast");
let tradeToastTimer = null;
let viewingSavedTrade = false;

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function formatCompactMoney(value) {
  if (!value) return "$0";
  const amount = Math.abs(value / 1_000_000).toFixed(1);
  return `${value < 0 ? "−" : ""}$${amount}M`;
}

function renderTeamMetricAmount(value, prefix = "", className = "") {
  const fullAmount = `${prefix}${formatMoney(value)}`;
  const compactAmount = `${prefix}${formatCompactMoney(value)}`;
  return `<strong class="${className}" aria-label="${escapeHtml(fullAmount)}"><span class="team-metric-value-full" aria-hidden="true">${fullAmount}</span><span class="team-metric-value-compact" aria-hidden="true">${compactAmount}</span></strong>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function getTeamPlayers(team) {
  return [...(team.starters_2026_27 || []), ...(team.bench_2026_27 || [])]
    .sort((left, right) => {
      const leftSalary = Number.isFinite(Number(left.salary)) ? Number(left.salary) : -1;
      const rightSalary = Number.isFinite(Number(right.salary)) ? Number(right.salary) : -1;
      return rightSalary - leftSalary || left.name.localeCompare(right.name, "en", { sensitivity: "base" });
    });
}

function findRosterPlayer(team, playerName) {
  return getTeamPlayers(team).find((player) => player.name.toLocaleLowerCase() === playerName.toLocaleLowerCase());
}

function formatPlayerStats(player) {
  return [
    ["PTS", player.pts],
    ["REB", player.reb],
    ["AST", player.ast]
  ].map(([label, value]) => {
    const stat = Number(value);
    return `${label} ${player.stats_season && value != null && Number.isFinite(stat) ? stat.toFixed(1) : "—"}`;
  }).join(" · ");
}

function getTeamPicks(team) {
  return (team.draft_picks || []).map((pick, index) => ({
    ...pick,
    assetId: `${team.id}:pick:${index}`,
    teamId: team.id
  }));
}

function getSwapCandidates(pick, senderId, slotIndex) {
  if (Number(pick.round) !== 1) return [];
  return state.teamIds
    .filter((teamId, index) => index !== slotIndex && teamId !== null && Number(teamId) !== Number(senderId))
    .map((teamId) => getTeam(teamId))
    .filter(Boolean)
    .flatMap((team) => getTeamPicks(team)
      .filter((otherPick) => Number(otherPick.round) === 1
        && Number(otherPick.year) === Number(pick.year)
        && !isPickFrozen(otherPick)
        && !state.pickTransfers[otherPick.assetId]
        && !Object.entries(state.pickSwaps).some(([swapPickId, swap]) => swapPickId !== pick.assetId && swap.targetPickId === otherPick.assetId))
      .map((otherPick) => ({ team, pick: otherPick })));
}

function getSwapTargetPickId(pickId, swap) {
  if (swap?.targetPickId) return swap.targetPickId;
  if (swap?.toTeamId) {
    const pick = findTransferredPick(pickId);
    if (!pick) return undefined;
    const senderId = Number(pickId.split(":")[0]);
    const target = getSwapCandidates(pick, senderId, state.teamIds.findIndex((id) => Number(id) === senderId))
      .find((candidate) => Number(candidate.team.id) === Number(swap.toTeamId));
    return target?.pick.assetId;
  }
  return undefined;
}

function formatPick(pick) {
  const roundName = pick.round === 1 ? "1st" : "2nd";
  const owner = pick.original_owner ? ` · ${pick.original_owner}` : "";
  const protection = pick.protection ? ` · ${pick.protection}` : "";
  const swap = pick.is_swap ? " · Swap" : "";
  return `${pick.year} ${roundName}${owner}${protection}${swap}`;
}

function isPickFrozen(pick) {
  return /frozen|cannot be traded|not tradable|untradeable|untradable/i.test(`${pick.protection || ""} ${pick.details || ""}`);
}

function showTradeToast(message) {
  tradeToastEl.textContent = message;
  tradeToastEl.hidden = false;
  tradeToastEl.classList.remove("is-visible");
  requestAnimationFrame(() => tradeToastEl.classList.add("is-visible"));
  window.clearTimeout(tradeToastTimer);
  tradeToastTimer = window.setTimeout(() => {
    tradeToastEl.classList.remove("is-visible");
    window.setTimeout(() => { tradeToastEl.hidden = true; }, 220);
  }, 4200);
}

function getPickTradeProtection(pickId) {
  const protection = state.pickProtections[pickId] || "";
  const pick = findTransferredPick(pickId);
  const pairedSwap = state.pickSwaps[pickId];
  const swapLabel = pick?.is_swap || pairedSwap
    ? `Swap right: ${(pairedSwap?.direction || state.pickSwapTypes[pickId]) === "worst" ? "least favorable (worst)" : "most favorable (best)"}`
    : "";
  let protectionLabel;
  if (protection === "custom") {
    const custom = String(state.customPickProtections[pickId] || "").trim();
    protectionLabel = custom ? `Custom: ${custom}` : "Custom protection (details needed)";
  } else {
    protectionLabel = protection || "Unprotected";
  }
  return [protectionLabel, swapLabel].filter(Boolean).join(" · ");
}

function getPickSwapType(pickId) {
  return state.pickSwapTypes[pickId] || "best";
}

function swapDirectionLabel(swap) {
  return swap?.direction === "worst" ? "Least favorable (worst)" : "Most favorable (best)";
}

function getSavedTrades() {
  try {
    const stored = JSON.parse(localStorage.getItem(SAVED_TRADES_KEY) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch (error) {
    console.warn("Saved trades could not be read:", error);
    return [];
  }
}

function storeSavedTrades(savedTrades) {
  try {
    localStorage.setItem(SAVED_TRADES_KEY, JSON.stringify(savedTrades));
    return true;
  } catch (error) {
    console.error("Saved trades could not be stored:", error);
    showTradeToast("This browser could not save the trade. Check available local storage.");
    return false;
  }
}

function buildTradeSnapshot(validation = validateTrade()) {
  const selectedTeams = state.teamIds.filter(Boolean).map(getTeam).filter(Boolean);
  const players = Object.entries(state.transfers).map(([playerId, destinationId]) => {
    const player = findTransferredPlayer(playerId);
    const sender = getTeam(playerId.split(":")[0]);
    const destination = getTeam(destinationId);
    return player && sender && destination ? {
      name: player.name,
      position: player.pos || "",
      salary: Number(player.salary || 0),
      fromTeamId: sender.id,
      fromTeamName: sender.name,
      toTeamId: destination.id,
      toTeamName: destination.name
    } : null;
  }).filter(Boolean);
  const picks = Object.entries(state.pickTransfers).map(([pickId, destinationId]) => {
    const pick = findTransferredPick(pickId);
    const sender = getTeam(pickId.split(":")[0]);
    const destination = getTeam(destinationId);
    return pick && sender && destination ? {
      year: pick.year,
      round: pick.round,
      owner: pick.original_owner,
      details: pick.details,
      baseProtection: pick.protection,
      tradeProtection: getPickTradeProtection(pickId),
      swapType: getPickSwapType(pickId),
      fromTeamId: sender.id,
      fromTeamName: sender.name,
      toTeamId: destination.id,
      toTeamName: destination.name
    } : null;
  }).filter(Boolean);
  const swaps = Object.entries(state.pickSwaps).map(([pickId, swap]) => {
    const pick = findTransferredPick(pickId);
    const sender = getTeam(pickId.split(":")[0]);
    const targetPick = findTransferredPick(getSwapTargetPickId(pickId, swap) || "");
    const destination = targetPick && getTeam(targetPick.teamId);
    return pick && sender && destination && targetPick ? {
      assetType: "swap",
      year: pick.year,
      round: pick.round,
      owner: pick.original_owner,
      details: pick.details,
      tradeProtection: `Swap right · ${swap.direction === "worst" ? "least favorable (worst)" : "most favorable (best)"}`,
      swapType: swap.direction || "best",
      targetPick: formatPick(targetPick),
      fromTeamId: sender.id,
      fromTeamName: sender.name,
      toTeamId: destination.id,
      toTeamName: destination.name
    } : null;
  }).filter(Boolean);
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    verdict: validation.verdict,
    verdictStatus: validation.verdictStatus,
    teams: selectedTeams.map((team) => ({ id: team.id, name: team.name, payroll: Number(team.total_salary || 0) })),
    players,
    picks: [...picks, ...swaps],
    validation: validation.checks.map(({ title, status, detail }) => ({ title, status, detail })),
    tradeState: {
      teamIds: [...state.teamIds],
      transfers: { ...state.transfers },
      pickTransfers: { ...state.pickTransfers },
      pickSwaps: Object.fromEntries(Object.entries(state.pickSwaps).map(([pickId, swap]) => [pickId, { ...swap }])),
      pickProtections: { ...state.pickProtections },
      customPickProtections: { ...state.customPickProtections },
      pickSwapTypes: { ...state.pickSwapTypes }
    }
  };
}

function hasSalary(player) {
  return typeof player.salary === "number" && Number.isFinite(player.salary);
}

function getTeamAbbreviation(team) {
  const abbreviations = {
    "Atlanta Hawks": "ATL", "Boston Celtics": "BOS", "Brooklyn Nets": "BKN",
    "Charlotte Hornets": "CHA", "Chicago Bulls": "CHI", "Cleveland Cavaliers": "CLE",
    "Dallas Mavericks": "DAL", "Denver Nuggets": "DEN", "Detroit Pistons": "DET",
    "Golden State Warriors": "GSW", "Houston Rockets": "HOU", "Indiana Pacers": "IND",
    "LA Clippers": "LAC", "Los Angeles Lakers": "LAL", "Memphis Grizzlies": "MEM",
    "Miami Heat": "MIA", "Milwaukee Bucks": "MIL", "Minnesota Timberwolves": "MIN",
    "New Orleans Pelicans": "NOP", "New York Knicks": "NYK", "Oklahoma City Thunder": "OKC",
    "Orlando Magic": "ORL", "Philadelphia 76ers": "PHI", "Phoenix Suns": "PHX",
    "Portland Trail Blazers": "POR", "Sacramento Kings": "SAC", "San Antonio Spurs": "SAS",
    "Toronto Raptors": "TOR", "Utah Jazz": "UTA", "Washington Wizards": "WAS"
  };
  return abbreviations[team.name] || team.name.slice(0, 3).toUpperCase();
}

function showLogoFallback(image) {
  if (!image.isConnected) return;
  const fallback = document.createElement("span");
  fallback.className = image.classList.contains("team-picker-option__logo")
    ? "team-picker-option__logo team-picker-option__logo--text"
    : "team-picker-trigger__logo team-logo--text";
  fallback.textContent = image.dataset.abbr;
  fallback.setAttribute("aria-hidden", "true");
  image.replaceWith(fallback);
}

function getTeam(teamId) {
  return teams.find((team) => team.id === Number(teamId));
}

function getPickOwnerTeams(pick) {
  const owner = String(pick?.original_owner || pick?.owner || "").trim();
  if (!owner) return [];
  const ownerTokens = owner.split(/[\/,&]+/).map((token) => token.trim().toLocaleLowerCase()).filter(Boolean);
  return ownerTokens
    .map((token) => teams.find((team) =>
      getTeamAbbreviation(team).toLocaleLowerCase() === token
      || team.name.toLocaleLowerCase() === token
    ))
    .filter((team, index, matches) => team && matches.findIndex((match) => match?.id === team.id) === index);
}

function renderPickOwnerBadge(pick) {
  const rawOwner = String(pick?.original_owner || pick?.owner || "").trim();
  const ownerTeams = getPickOwnerTeams(pick);
  const ownerNames = ownerTeams.map((team) => team.name);
  const ownerName = ownerNames.length
    ? ownerNames.join(" / ")
    : rawOwner || "Original team unavailable";
  const fallbackAbbreviation = rawOwner.split(/[\/,&]+/)[0].trim().slice(0, 3).toLocaleUpperCase();
  const logos = ownerTeams.length
    ? ownerTeams.map((team) => {
      const abbreviation = getTeamAbbreviation(team);
      return `<span class="review-pick-owner__item">${team.logo
        ? `<img class="review-pick-owner__logo" src="${escapeHtml(team.logo)}" alt="" aria-hidden="true" data-abbr="${escapeHtml(abbreviation)}"><span class="review-pick-owner__fallback" hidden>${escapeHtml(abbreviation)}</span>`
        : `<span class="review-pick-owner__fallback">${escapeHtml(abbreviation)}</span>`}</span>`;
    }).join("")
    : `<span class="review-pick-owner__fallback">${escapeHtml(fallbackAbbreviation || "NBA")}</span>`;
  return `<span class="review-pick-owner ${ownerTeams.length > 1 ? "review-pick-owner--multiple" : ""}" title="Original pick owner: ${escapeHtml(ownerName)}" aria-label="Original pick owner: ${escapeHtml(ownerName)}">
    ${logos}
  </span>`;
}

function renderReviewPlayerFace(player) {
  return `<span class="review-player-face">
    <img class="review-player-headshot" src="${escapeHtml(getPlayerHeadshotUrl(player.name))}" alt="" loading="lazy">
    <span class="review-player-face__fallback" hidden>${escapeHtml(getPlayerInitials(player.name))}</span>
  </span>`;
}

function renderReviewPlayerAsset(player, salary, direction, otherTeamName) {
  return `<div class="review-asset review-asset--player">
    <div class="review-player-asset">
      ${renderReviewPlayerFace(player)}
      <span class="review-player-asset__identity"><strong>${escapeHtml(player.name)}</strong><small>${escapeHtml(player.pos || "Player")}</small></span>
    </div>
    <strong>${formatMoney(salary)}</strong>
    <em>${direction} ${escapeHtml(otherTeamName || "team")}</em>
  </div>`;
}

function getPlayerId(teamId, playerName) {
  return `${teamId}:${playerName}`;
}

function getTeamFlow(teamId) {
  let outgoing = 0;
  let incoming = 0;

  Object.entries(state.transfers).forEach(([playerId, destinationId]) => {
    const [senderId, ...nameParts] = playerId.split(":");
    const playerName = nameParts.join(":");
    const sender = getTeam(senderId);
    const player = sender && getTeamPlayers(sender).find((item) => item.name === playerName);
    if (!player || !hasSalary(player)) return;
    if (Number(senderId) === Number(teamId)) outgoing += player.salary;
    if (Number(destinationId) === Number(teamId)) incoming += player.salary;
  });

  return { outgoing, incoming };
}

function getTeamPlayerCounts(teamId) {
  let outgoing = 0;
  let incoming = 0;
  Object.entries(state.transfers).forEach(([playerId, destinationId]) => {
    if (Number(playerId.split(":")[0]) === Number(teamId)) outgoing += 1;
    if (Number(destinationId) === Number(teamId)) incoming += 1;
  });
  return { outgoing, incoming };
}

function getApronTier(team) {
  const payroll = Number(team.total_salary || 0);
  const status = String(team.tax_status || "").toLowerCase();
  if (status.includes("2nd apron") || payroll >= CBA_ESTIMATES.secondApron) return 2;
  if (status.includes("1st apron") || payroll >= CBA_ESTIMATES.firstApron) return 1;
  return 0;
}

function getSalaryMatchLimit(team, outgoingSalary) {
  const payroll = Number(team.total_salary || 0);
  const apronTier = getApronTier(team);
  if (apronTier > 0) {
    return { maximum: outgoingSalary, rule: `${apronTier === 2 ? "Second" : "First"}-apron teams cannot take back more salary than they send.` };
  }

  if (payroll < CBA_ESTIMATES.salaryCap) {
    const capRoom = CBA_ESTIMATES.salaryCap - payroll;
    return { maximum: outgoingSalary + capRoom, rule: `Cap room available: ${formatMoney(capRoom)}.` };
  }

  const scale = CBA_ESTIMATES.salaryCap / CBA_ESTIMATES.baseCap;
  const smallOutgoing = CBA_ESTIMATES.baseSmallOutgoing * scale;
  const mediumOutgoing = CBA_ESTIMATES.baseMediumOutgoing * scale;
  const fixedAllowance = CBA_ESTIMATES.baseFixedAllowance * scale;
  const mediumAllowance = CBA_ESTIMATES.baseMediumAllowance * scale;

  if (outgoingSalary <= smallOutgoing) {
    return { maximum: (outgoingSalary * 2) + fixedAllowance, rule: "Small outgoing salary: up to 200% plus the scaled fixed allowance." };
  }
  if (outgoingSalary <= mediumOutgoing) {
    return { maximum: outgoingSalary + mediumAllowance, rule: "Mid-range outgoing salary: outgoing salary plus the scaled mid-range allowance." };
  }
  return { maximum: (outgoingSalary * 1.25) + fixedAllowance, rule: "Large outgoing salary: up to 125% plus the scaled fixed allowance." };
}

function getPickOwnershipByYear(teamId, afterTrade = true) {
  const years = new Set();
  const team = getTeam(teamId);
  if (!team) return years;

  getTeamPicks(team).forEach((pick) => {
    if (pick.round !== 1) return;
    if (afterTrade && state.pickTransfers[pick.assetId]) return;
    years.add(Number(pick.year));
  });

  if (!afterTrade) return years;

  Object.entries(state.pickTransfers).forEach(([pickId, destinationId]) => {
    if (Number(destinationId) !== Number(teamId)) return;
    const pick = findTransferredPick(pickId);
    if (pick?.round === 1) years.add(Number(pick.year));
  });

  return years;
}

function removeTeamTransfers(teamId) {
  Object.entries(state.transfers).forEach(([playerId, destinationId]) => {
    if (Number(playerId.split(":")[0]) === Number(teamId) || Number(destinationId) === Number(teamId)) {
      delete state.transfers[playerId];
    }
  });
  Object.entries(state.pickTransfers).forEach(([pickId, destinationId]) => {
    if (Number(pickId.split(":")[0]) === Number(teamId) || Number(destinationId) === Number(teamId)) {
      delete state.pickTransfers[pickId];
      delete state.pickProtections[pickId];
      delete state.customPickProtections[pickId];
      delete state.pickSwapTypes[pickId];
    }
  });
  Object.entries(state.pickSwaps).forEach(([pickId, swap]) => {
    if (Number(pickId.split(":")[0]) === Number(teamId) || Number(swap.toTeamId) === Number(teamId)) {
      delete state.pickSwaps[pickId];
    }
  });
}

function renderTeamOptions(slotIndex, selectedId) {
  const usedIds = state.teamIds.filter((id, index) => index !== slotIndex && id !== null);
  const availableTeams = teams
    .filter((team) => !usedIds.includes(team.id))
    .sort((left, right) => left.name.localeCompare(right.name, "en", { sensitivity: "base" }));
  const options = availableTeams.map((team) => `
    <button type="button" class="team-picker-option" role="option" data-select-team="${team.id}" data-slot="${slotIndex}" aria-selected="${team.id === selectedId}">
      ${renderTeamLogo(team, "team-picker-option__logo")}
      <span>${escapeHtml(team.name)}</span>
      ${team.id === selectedId ? '<span class="team-picker-option__check" aria-hidden="true">✓</span>' : ""}
    </button>
  `).join("");
  return `<div class="team-picker-menu" id="teamPickerMenu${slotIndex}" role="listbox" aria-label="NBA teams">${options || '<p class="team-picker-empty">No teams available.</p>'}</div>`;
}

function renderTeamLogo(team, className) {
  return team.logo
    ? `<img class="${className}" src="${escapeHtml(team.logo)}" alt="" aria-hidden="true" data-abbr="${getTeamAbbreviation(team)}" data-team="${escapeHtml(team.name)}">`
    : `<span class="${className} team-picker-option__logo--text" aria-hidden="true">${getTeamAbbreviation(team)}</span>`;
}

function chooseTeam(slotIndex, teamId) {
  const previousId = state.teamIds[slotIndex];
  if (previousId !== null && Number(previousId) !== Number(teamId)) removeTeamTransfers(previousId);
  state.teamIds[slotIndex] = teamId === null ? null : Number(teamId);
  state.openTeamPickerSlot = null;
  if (state.teamIds.length === 1 && state.teamIds[0] !== null) state.teamIds.push(null);
  renderTradeBoard();
}

function renderTeamCard(teamId, slotIndex) {
  const team = teamId === null ? null : getTeam(teamId);
  if (!team) {
    return `
      <section class="team-card team-card--empty">
        <div class="team-card__topline"><span>TEAM ${slotIndex + 1}</span><button type="button" class="icon-button remove-team" data-slot="${slotIndex}" aria-label="Remove team slot" title="Remove team">×</button></div>
        <div class="team-card__identity">
          <div class="team-picker">
            <button type="button" class="team-picker-trigger" data-team-picker="${slotIndex}" aria-label="Choose team ${slotIndex + 1}" aria-haspopup="listbox" aria-expanded="${state.openTeamPickerSlot === slotIndex}" aria-controls="teamPickerMenu${slotIndex}">
              <span class="team-picker-trigger__placeholder" aria-hidden="true">NBA</span>
              <span class="team-picker-trigger__name">Choose a team</span>
              <span class="team-picker-trigger__chevron" aria-hidden="true"></span>
            </button>
            ${state.openTeamPickerSlot === slotIndex ? renderTeamOptions(slotIndex, null) : ""}
          </div>
        </div>
        <div class="team-empty"><span class="team-empty__number">${String(slotIndex + 1).padStart(2, "0")}</span><span>Choose a franchise to load its roster, payroll and draft assets.</span></div>
      </section>
    `;
  }

  const flow = getTeamFlow(team.id);
  const payroll = Number(team.total_salary || 0);
  const afterTrade = payroll - flow.outgoing + flow.incoming;
  const capMetrics = [
    { label: "After-trade payroll", value: afterTrade, className: "" },
    { label: "Cap room", value: CBA_ESTIMATES.salaryCap - afterTrade, className: "team-cap-metric--cap" },
    { label: "1st apron room", value: CBA_ESTIMATES.firstApron - afterTrade, className: "team-cap-metric--apron" },
    { label: "2nd apron room", value: CBA_ESTIMATES.secondApron - afterTrade, className: "team-cap-metric--apron" },
    { label: "Above minimum", value: afterTrade - CBA_ESTIMATES.minimumTeamSalary, className: "team-cap-metric--minimum" }
  ];
  const rosterRows = getTeamPlayers(team).map((player, index) => {
    const playerId = getPlayerId(team.id, player.name);
    const destinationId = state.transfers[playerId];
    const salaryLabel = hasSalary(player) ? formatMoney(player.salary) : "Unavailable";
    const headshotId = getPlayerHeadshotId(player.name);
    const portrait = headshotId
      ? `<img class="roster-player__headshot" src="${escapeHtml(getPlayerHeadshotUrl(player.name))}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${DEFAULT_AVATAR_FALLBACK}'">`
      : `<span class="roster-player__headshot roster-player__headshot--fallback" aria-label="Official portrait unavailable">${escapeHtml(getPlayerInitials(player.name))}</span>`;
    const destinations = state.teamIds
      .filter((id, index) => index !== slotIndex && id !== null)
      .map((id) => getTeam(id))
      .filter(Boolean);
    const destinationSelect = destinationId
      ? `<select class="destination-select" data-player="${escapeHtml(playerId)}" aria-label="Trade ${escapeHtml(player.name)} to">${destinations.map((destination) => `<option value="${destination.id}" ${destination.id === Number(destinationId) ? "selected" : ""}>${escapeHtml(destination.name)}</option>`).join("")}</select>`
      : "";

    return `
      <div class="roster-row ${destinationId ? "roster-row--selected" : ""} ${index < 3 ? "roster-row--top-salary" : ""}">
        <div class="roster-player">
          <span class="roster-rank" aria-label="Salary rank ${index + 1}">${String(index + 1).padStart(2, "0")}</span>
          ${portrait}
          <div class="roster-player__details">
            <div class="roster-player__heading">
              <button
                type="button"
                class="roster-player__name roster-player__profile"
                data-player-name="${escapeHtml(player.name)}"
                data-team-id="${team.id}"
                aria-label="View ${escapeHtml(player.name)} player card"
                title="Open ${escapeHtml(player.name)} player card"
              >${escapeHtml(player.name)}</button>
              <span class="roster-player__position">${escapeHtml(player.pos || "-")}</span>
              ${player.contract_type === "Two-Way" ? '<span class="roster-player__contract-type">2-WAY</span>' : ""}
            </div>
            <span class="roster-player__stats" aria-label="${escapeHtml(player.stats_season || "Season stats unavailable")} regular-season per-game stats: ${escapeHtml(formatPlayerStats(player))}">${escapeHtml(formatPlayerStats(player))}</span>
          </div>
        </div>
        <span class="roster-salary" title="${escapeHtml(player.contract_note || "2026–27 salary")}">${salaryLabel}${player.contract_note ? `<span class="contract-note">${escapeHtml(player.contract_label || "Extension signed")}</span>` : ""}</span>
        <div class="roster-action">
          ${destinationSelect}
          <button type="button" class="trade-toggle ${destinationId ? "is-selected" : ""}" data-player="${escapeHtml(playerId)}" ${hasSalary(player) && destinations.length ? "" : "disabled"}>${destinationId ? "Added" : "Trade"}</button>
        </div>
      </div>
    `;
  }).join("");

  const picks = getTeamPicks(team);
  const renderPickRow = (pick) => {
    const destinationId = state.pickTransfers[pick.assetId];
    const destinations = state.teamIds
      .filter((id, index) => index !== slotIndex && id !== null)
      .map((id) => getTeam(id))
      .filter(Boolean);
    const destinationSelect = destinationId
      ? `<select class="destination-select pick-destination-select" data-pick="${escapeHtml(pick.assetId)}" aria-label="Trade ${escapeHtml(formatPick(pick))} to">${destinations.map((destination) => `<option value="${destination.id}" ${destination.id === Number(destinationId) ? "selected" : ""}>${escapeHtml(destination.name)}</option>`).join("")}</select>`
      : "";
    const details = pick.details || "Draft right";
    const frozen = isPickFrozen(pick);
    const protection = state.pickProtections[pick.assetId] || "";
    const swapType = getPickSwapType(pick.assetId);
    const pairedSwap = state.pickSwaps[pick.assetId];
    const isSwapTarget = Object.entries(state.pickSwaps).some(([swapPickId, swap]) => swapPickId !== pick.assetId && swap.targetPickId === pick.assetId);
    const swapCandidates = getSwapCandidates(pick, team.id, slotIndex);
    const swapTargetPickId = pairedSwap ? getSwapTargetPickId(pick.assetId, pairedSwap) : "";
    const swapControls = pairedSwap
      ? `<div class="pick-swap-editor">
          <label><span>Swap with</span><select class="paired-swap-team" data-pick="${escapeHtml(pick.assetId)}">${swapCandidates.map(({ team: candidateTeam, pick: candidatePick }) => `<option value="${escapeHtml(candidatePick.assetId)}" ${candidatePick.assetId === swapTargetPickId ? "selected" : ""}>${escapeHtml(candidateTeam.name)} · ${escapeHtml(formatPick(candidatePick))} (${escapeHtml(candidatePick.original_owner || candidatePick.details || "pick")})</option>`).join("")}</select></label>
          <label><span>Keep</span><select class="paired-swap-direction" data-pick="${escapeHtml(pick.assetId)}"><option value="best" ${pairedSwap.direction === "best" ? "selected" : ""}>Best / most favorable</option><option value="worst" ${pairedSwap.direction === "worst" ? "selected" : ""}>Worst / least favorable</option></select></label>
        </div>`
      : "";
    const protectionOptions = [
      ["", "No added protection"],
      ["top-3", "Top 3 protected"],
      ["top-5", "Top 5 protected"],
      ["top-10", "Top 10 protected"],
      ["lottery", "Lottery protected"],
      ["top-20", "Top 20 protected"],
      ["custom", "Custom protection…"]
    ].map(([value, label]) => `<option value="${value}" ${protection === value ? "selected" : ""}>${label}</option>`).join("");
    const transferOptions = destinationId
      ? `<div class="pick-transfer-options">
          <label class="pick-protection-control"><span>Protection</span><select class="pick-protection-select" data-pick="${escapeHtml(pick.assetId)}">${protectionOptions}</select></label>
          ${pick.is_swap ? `<label class="pick-swap-control"><span>Swap right</span><select class="pick-swap-select" data-pick="${escapeHtml(pick.assetId)}"><option value="best" ${swapType === "best" ? "selected" : ""}>Most favorable (best)</option><option value="worst" ${swapType === "worst" ? "selected" : ""}>Least favorable (worst)</option></select></label>` : ""}
          ${protection === "custom" ? `<label class="pick-custom-control"><span>Protected range / terms</span><input class="pick-custom-input" data-pick="${escapeHtml(pick.assetId)}" type="text" maxlength="80" placeholder="e.g. picks 1–10" value="${escapeHtml(state.customPickProtections[pick.assetId] || "")}"></label>` : ""}
        </div>`
      : "";

    return `
      <div class="pick-entry">
        <div class="roster-row pick-row ${destinationId ? "roster-row--selected" : ""}">
          <div class="roster-player pick-description" title="${escapeHtml(details)}">
            <span class="roster-player__name">${escapeHtml(formatPick(pick))}</span>
            <span class="roster-player__position">${escapeHtml(details)}</span>
          </div>
          <span class="roster-salary">Draft pick</span>
          <div class="roster-action">
            ${destinationSelect}
            <button type="button" class="trade-toggle pick-toggle ${destinationId ? "is-selected" : ""} ${frozen ? "pick-toggle--blocked" : ""}" data-pick="${escapeHtml(pick.assetId)}" ${(frozen || isSwapTarget) ? `disabled aria-label="${escapeHtml(formatPick(pick))} cannot be traded" title="${frozen ? `Unavailable: ${escapeHtml(details)}` : "Remove the paired pick swap before trading this pick"}"` : ""}>${frozen ? "Unavailable" : destinationId ? "Added" : isSwapTarget ? "Swap target" : "Trade"}</button>
            ${swapCandidates.length && !frozen ? `<button type="button" class="trade-toggle swap-toggle ${pairedSwap ? "is-selected" : ""}" data-pick="${escapeHtml(pick.assetId)}">${pairedSwap ? "Swap added" : "Swap"}</button>` : ""}
          </div>
        </div>
        ${transferOptions}
        ${swapControls}
      </div>
    `;
  };

  const firstRoundPicks = picks.filter((pick) => Number(pick.round) === 1);
  const secondRoundPicks = picks.filter((pick) => Number(pick.round) === 2);
  const pickRows = `
    <section class="pick-round-section">
      <header class="pick-round-heading"><h3>First-round picks</h3><span>${firstRoundPicks.length} assets</span></header>
      ${firstRoundPicks.map(renderPickRow).join("") || '<div class="team-empty">No first-round picks listed.</div>'}
    </section>
    <section class="pick-round-section">
      <header class="pick-round-heading"><h3>Second-round picks</h3><span>${secondRoundPicks.length} assets</span></header>
      ${secondRoundPicks.map(renderPickRow).join("") || '<div class="team-empty">No second-round picks listed.</div>'}
    </section>
  `;

  const activeView = state.activeViews[team.id] || "roster";
  const rosterContent = activeView === "roster"
    ? `<div class="roster-table"><div class="roster-row roster-row--header"><span>Player</span><span>2026–27 Salary ↓</span><span>Trade destination</span></div>${rosterRows || '<div class="team-empty">No roster data returned by the API.</div>'}</div>`
    : `<div class="roster-table"><div class="roster-row roster-row--header"><span>Draft asset</span><span>Type</span><span>Trade destination</span></div>${picks.length ? pickRows : '<div class="team-empty">No draft picks returned by the API.</div>'}</div>`;

  return `
    <section class="team-card" data-team-theme="${getTeamAbbreviation(team)}">
      <div class="team-card__topline">
        <span>TEAM ${slotIndex + 1}</span>
        <div class="team-card__topline-actions">
          <button type="button" class="button button--ghost team-clear-button" data-slot="${slotIndex}">Clear</button>
          <button type="button" class="icon-button remove-team" data-slot="${slotIndex}" aria-label="Remove ${escapeHtml(team.name)}" title="Remove team" ${state.teamIds.length <= 2 ? "hidden" : ""}>×</button>
        </div>
      </div>
      <div class="team-card__identity">
        <div class="team-picker">
          <button type="button" class="team-picker-trigger" data-team-picker="${slotIndex}" aria-label="Change team ${slotIndex + 1}, currently ${escapeHtml(team.name)}" aria-haspopup="listbox" aria-expanded="${state.openTeamPickerSlot === slotIndex}" aria-controls="teamPickerMenu${slotIndex}">
            ${renderTeamLogo(team, "team-picker-trigger__logo")}
            <span class="team-picker-trigger__name">${escapeHtml(team.name)}</span>
            <span class="team-picker-trigger__chevron" aria-hidden="true"></span>
          </button>
          ${state.openTeamPickerSlot === slotIndex ? renderTeamOptions(slotIndex, team.id) : ""}
        </div>
      </div>
      <div class="team-metrics">
        <div>${renderTeamMetricAmount(payroll)}<span>Team payroll</span></div>
        <div>${renderTeamMetricAmount(flow.outgoing, "-", "money-out")}<span>Outgoing</span></div>
        <div>${renderTeamMetricAmount(flow.incoming, "+", "money-in")}<span>Incoming</span></div>
        <div>${renderTeamMetricAmount(afterTrade)}<span>After trade</span></div>
      </div>
      <section class="team-cap-outlook" aria-label="${escapeHtml(team.name)} cap outlook after trade">
        <div class="team-cap-outlook__heading">
          <strong>Team cap outlook</strong>
          <span>2026–27 estimates</span>
        </div>
        <div class="team-cap-metrics">
          ${capMetrics.map(({ label, value, className }) => {
            const metricLabel = value >= 0
              ? label
              : label === "Above minimum"
                ? "Below minimum"
                : `Over ${label.replace(" room", "")}`;
            return `
            <div class="team-cap-metric ${className} ${value < 0 ? "is-over" : "has-room"}">
              <strong>${formatCompactMoney(value)}</strong>
              <span>${metricLabel}</span>
            </div>
          `;
          }).join("")}
        </div>
      </section>
      <div class="asset-tabs" role="tablist" aria-label="${escapeHtml(team.name)} assets">
        <button type="button" class="asset-tab ${activeView === "roster" ? "is-active" : ""}" data-view="roster" data-team="${team.id}" role="tab" aria-selected="${activeView === "roster"}">Roster <span>${getTeamPlayers(team).length}</span></button>
        <button type="button" class="asset-tab ${activeView === "picks" ? "is-active" : ""}" data-view="picks" data-team="${team.id}" role="tab" aria-selected="${activeView === "picks"}">Picks <span>${picks.length}</span></button>
        <span class="asset-period">${activeView === "roster" ? "2026–27 salary" : "Tradeable draft assets"}</span>
      </div>
      ${rosterContent}
    </section>
  `;
}

function renderTrendingPlayers() {
  if (!trendingPlayersEl) return;

  const scoringLeaders = teams.flatMap((team) =>
    getTeamPlayers(team)
      .filter((player) => Number(player.gp) > 0 && Number.isFinite(Number(player.pts)))
      .map((player) => ({ player, team }))
  )
    .sort((left, right) => Number(right.player.pts) - Number(left.player.pts))
    .slice(0, 12);

  trendingPlayersEl.innerHTML = scoringLeaders.map(({ player, team }, index) => `
    <button
      type="button"
      class="trending-player"
      data-team-theme="${getTeamAbbreviation(team)}"
      data-player-name="${escapeHtml(player.name)}"
      data-team-id="${team.id}"
      aria-label="View ${escapeHtml(player.name)} player card"
    >
      <span class="trending-player__portrait">
        <img
          class="trending-player__headshot"
          src="${escapeHtml(getPlayerHeadshotUrl(player.name))}"
          alt=""
          loading="${index < 8 ? "eager" : "lazy"}"
          onerror="this.hidden=true;this.nextElementSibling.hidden=false"
        >
        <span class="trending-player__fallback" hidden>${escapeHtml(getPlayerInitials(player.name))}</span>
        <img
          class="trending-player__team"
          src="${escapeHtml(team.logo || "")}"
          alt="${escapeHtml(getTeamAbbreviation(team))}"
          loading="lazy"
          onerror="this.hidden=true"
        >
        <span class="trending-player__rank">${index + 1}</span>
      </span>
      <span class="trending-player__name">${escapeHtml(player.name)}</span>
      <span class="trending-player__team-name">${escapeHtml(team.name)}</span>
      <span class="trending-player__stats">${Number(player.pts).toFixed(1)} PPG</span>
    </button>
  `).join("");

  trendingPlayersEl.querySelectorAll(".trending-player").forEach((button) => {
    button.addEventListener("click", () => openPlayerProfile(button.dataset.playerName, Number(button.dataset.teamId)));
  });
}

function openPlayerProfile(playerName, teamId = null) {
  const rosterEntry = teamId === null
    ? teams.map((team) => ({ team, player: findRosterPlayer(team, playerName) })).find(({ player }) => player)
    : (() => {
      const team = getTeam(teamId);
      return team ? { team, player: findRosterPlayer(team, playerName) } : null;
    })();
  if (!rosterEntry?.player) throw new Error(`Roster data unavailable for player: ${playerName}`);

  const { team, player } = rosterEntry;
  const statValue = (value, suffix = "") => {
    const number = Number(value);
    return player.stats_season && value != null && Number.isFinite(number)
      ? `${number.toFixed(1)}${suffix}`
      : "—";
  };
  const stats = [
    ["PPG", statValue(player.pts)],
    ["RPG", statValue(player.reb)],
    ["APG", statValue(player.ast)],
    ["SPG", statValue(player.stl)],
    ["BPG", statValue(player.blk)],
    ["FG%", statValue(player.fg, "%")],
    ["3P%", statValue(player.fg3, "%")],
    ["FT%", statValue(player.ft, "%")]
  ];
  const salary = hasSalary(player) ? formatMoney(player.salary) : "Unavailable";

  playerProfileDialog.dataset.teamTheme = getTeamAbbreviation(team);
  playerProfileContentEl.innerHTML = `
    <article class="player-profile">
      <header class="player-profile__header">
        <div class="player-profile__team">
          <img class="player-profile__team-logo" src="${escapeHtml(team.logo || "")}" alt="" onerror="this.hidden=true">
          <div>
            <span class="player-profile__eyebrow">PLAYER SCOUT / TRADE MARKET</span>
            <span class="player-profile__team-name">${escapeHtml(team.name)}</span>
          </div>
        </div>
        <button type="button" class="icon-button player-profile__close" aria-label="Close player card" title="Close">×</button>
      </header>

      <div class="player-profile__hero">
        <div class="player-profile__portrait">
          <img src="${escapeHtml(getPlayerHeadshotUrl(player.name))}" alt="${escapeHtml(player.name)}" onerror="this.hidden=true;this.nextElementSibling.hidden=false">
          <span class="player-profile__fallback" hidden>${escapeHtml(getPlayerInitials(player.name))}</span>
          <span class="player-profile__jersey">${escapeHtml(player.pos || "NBA")}</span>
        </div>
        <div class="player-profile__identity">
          <span class="player-profile__eyebrow">${escapeHtml(player.stats_season || "REGULAR SEASON")} REGULAR SEASON</span>
          <h2 id="playerProfileName">${escapeHtml(player.name)}</h2>
          <p>${escapeHtml(player.pos || "Position unavailable")} <span>·</span> ${player.gp != null ? `${escapeHtml(player.gp)} games` : "Games played unavailable"}</p>
          <div class="player-profile__salary">
            <span>2026–27 SALARY</span>
            <strong>${escapeHtml(salary)}</strong>
            ${player.contract_label ? `<small>${escapeHtml(player.contract_label)}</small>` : ""}
          </div>
        </div>
      </div>

      <section class="player-profile__stats" aria-label="${escapeHtml(player.stats_season || "Regular-season")} statistics">
        <div class="player-profile__stats-heading">
          <span>SEASON PRODUCTION</span>
          <span>PER GAME</span>
        </div>
        <div class="player-profile__stat-grid">
          ${stats.map(([label, value]) => `
            <div class="player-profile__stat">
              <span>${label}</span>
              <strong>${value}</strong>
            </div>
          `).join("")}
        </div>
      </section>
      ${player.contract_note ? `<p class="player-profile__contract-note">${escapeHtml(player.contract_note)}</p>` : ""}
    </article>
  `;
  playerProfileContentEl.querySelector(".player-profile__close").addEventListener("click", () => playerProfileDialog.close());
  playerProfileDialog.showModal();
}

function renderTradeBoard() {
  renderTrendingPlayers();
  teamGridEl.innerHTML = state.teamIds.length
    ? state.teamIds.map((teamId, index) => renderTeamCard(teamId, index)).join("")
    : `
      <section class="empty-board">
        <span class="empty-board__mark" aria-hidden="true">+</span>
        <p class="eyebrow">BUILD A TRADE</p>
        <h2>Start with a team</h2>
        <button type="button" class="button button--add empty-board__button" data-add-team>＋ Add first team</button>
      </section>
    `;
  teamCountLabelEl.textContent = `${state.teamIds.filter(Boolean).length} of ${MAX_TRADE_TEAMS} teams`;
  addTeamBtn.disabled = state.teamIds.length >= MAX_TRADE_TEAMS;
  clearTradeBtn.disabled = state.teamIds.length === 0
    && Object.keys(state.transfers).length === 0
    && Object.keys(state.pickTransfers).length === 0
    && Object.keys(state.pickSwaps).length === 0;
  reviewTradeBtn.disabled = state.teamIds.filter(Boolean).length < 2;

  teamGridEl.querySelectorAll("[data-add-team]").forEach((button) => {
    button.addEventListener("click", addTeamSlot);
  });

  teamGridEl.querySelectorAll("img[data-abbr]").forEach((image) => {
    image.addEventListener("error", () => showLogoFallback(image), { once: true });
    if (image.complete && image.naturalWidth === 0) showLogoFallback(image);
  });

  teamGridEl.querySelectorAll(".team-picker-trigger").forEach((button) => {
    button.addEventListener("click", () => {
      const slotIndex = Number(button.dataset.teamPicker);
      state.openTeamPickerSlot = state.openTeamPickerSlot === slotIndex ? null : slotIndex;
      renderTradeBoard();
    });
  });

  teamGridEl.querySelectorAll("[data-select-team]").forEach((button) => {
    button.addEventListener("click", () => chooseTeam(Number(button.dataset.slot), Number(button.dataset.selectTeam)));
  });

  teamGridEl.querySelectorAll(".remove-team").forEach((button) => {
    button.addEventListener("click", () => {
      const slotIndex = Number(button.dataset.slot);
      const removedId = state.teamIds[slotIndex];
      if (removedId !== null) removeTeamTransfers(removedId);
      state.teamIds.splice(slotIndex, 1);
      renderTradeBoard();
    });
  });

  teamGridEl.querySelectorAll(".team-clear-button").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const slotIndex = Number(button.dataset.slot);
      const teamId = state.teamIds[slotIndex];
      if (teamId !== null) {
        removeTeamTransfers(teamId);
        delete state.activeViews[teamId];
      }
      state.teamIds[slotIndex] = null;
      state.openTeamPickerSlot = slotIndex;
      renderTradeBoard();
    });
  });

  teamGridEl.querySelectorAll(".asset-tab").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeViews[button.dataset.team] = button.dataset.view;
      renderTradeBoard();
    });
  });

  teamGridEl.querySelectorAll(".trade-toggle[data-player]").forEach((button) => {
    button.addEventListener("click", () => {
      const playerId = button.dataset.player;
      if (state.transfers[playerId]) {
        delete state.transfers[playerId];
      } else {
        const senderId = Number(playerId.split(":")[0]);
        const defaultDestination = state.teamIds.find((id) => id !== null && Number(id) !== senderId);
        if (defaultDestination !== undefined) state.transfers[playerId] = defaultDestination;
      }
      renderTradeBoard();
    });
  });

  teamGridEl.querySelectorAll(".roster-player__profile").forEach((button) => {
    button.addEventListener("click", () => openPlayerProfile(button.dataset.playerName, Number(button.dataset.teamId)));
  });

  teamGridEl.querySelectorAll(".destination-select[data-player]").forEach((select) => {
    select.addEventListener("change", () => {
      state.transfers[select.dataset.player] = Number(select.value);
      renderTradeBoard();
    });
  });

  teamGridEl.querySelectorAll(".pick-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const pickId = button.dataset.pick;
      const pick = findTransferredPick(pickId);
      if (pick && isPickFrozen(pick)) {
        showTradeToast(`${formatPick(pick)} cannot be traded: ${pick.protection || pick.details || "the pick is marked unavailable"}.`);
        return;
      }
      if (state.pickTransfers[pickId]) {
        delete state.pickTransfers[pickId];
        delete state.pickProtections[pickId];
        delete state.customPickProtections[pickId];
        delete state.pickSwapTypes[pickId];
      } else {
        const senderId = Number(pickId.split(":")[0]);
        const defaultDestination = state.teamIds.find((id) => id !== null && Number(id) !== senderId);
        if (defaultDestination !== undefined) {
          const baseline = validateTrade().checks.find((check) => check.title === "Stepien rule and pick window");
          const existingSwap = state.pickSwaps[pickId];
          delete state.pickSwaps[pickId];
          state.pickTransfers[pickId] = defaultDestination;
          const proposed = validateTrade().checks.find((check) => check.title === "Stepien rule and pick window");
          const newStepienIssue = proposed.status === "fail" && (baseline.status !== "fail" || proposed.detail !== baseline.detail);
          if (newStepienIssue && Number(pick?.round) === 1) {
            delete state.pickTransfers[pickId];
            if (existingSwap) state.pickSwaps[pickId] = existingSwap;
            const blockedPair = proposed.detail.match(/(?:no first-round pick in either|would have no first-round pick in either)\s+(\d{4})\s+or\s+(\d{4})/i);
            showTradeToast(blockedPair
              ? `${formatPick(pick)} cannot be added: it would leave ${getTeam(senderId).name} without a first-round pick in ${blockedPair[1]} and ${blockedPair[2]} (Stepien rule).`
              : `${formatPick(pick)} cannot be added because of the Stepien rule: ${proposed.detail}`);
            renderTradeBoard();
            return;
          }
          if (pick?.is_swap) state.pickSwapTypes[pickId] = "best";
        }
      }
      renderTradeBoard();
    });
  });

  teamGridEl.querySelectorAll(".pick-destination-select").forEach((select) => {
    select.addEventListener("change", () => {
      state.pickTransfers[select.dataset.pick] = Number(select.value);
      renderTradeBoard();
    });
  });

  teamGridEl.querySelectorAll(".pick-protection-select").forEach((select) => {
    select.addEventListener("change", () => {
      const pickId = select.dataset.pick;
      state.pickProtections[pickId] = select.value;
      if (select.value !== "custom") delete state.customPickProtections[pickId];
      renderTradeBoard();
    });
  });

  teamGridEl.querySelectorAll(".pick-custom-input").forEach((input) => {
    input.addEventListener("input", () => {
      state.customPickProtections[input.dataset.pick] = input.value;
    });
  });

  teamGridEl.querySelectorAll(".pick-swap-select").forEach((select) => {
    select.addEventListener("change", () => {
      state.pickSwapTypes[select.dataset.pick] = select.value;
      renderTradeBoard();
    });
  });

  teamGridEl.querySelectorAll(".swap-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const pickId = button.dataset.pick;
      if (state.pickSwaps[pickId]) {
        delete state.pickSwaps[pickId];
      } else {
        const pick = findTransferredPick(pickId);
        const senderId = Number(pickId.split(":")[0]);
        const slotIndex = state.teamIds.findIndex((id) => Number(id) === senderId);
        const firstCandidate = pick && getSwapCandidates(pick, senderId, slotIndex)[0];
        if (firstCandidate) {
          delete state.pickTransfers[pickId];
          state.pickSwaps[pickId] = {
            toTeamId: firstCandidate.team.id,
            targetPickId: firstCandidate.pick.assetId,
            direction: "best"
          };
        } else {
          showTradeToast(`${formatPick(pick)} has no matching first-round pick available from another selected team.`);
        }
      }
      renderTradeBoard();
    });
  });

  teamGridEl.querySelectorAll(".paired-swap-team").forEach((select) => {
    select.addEventListener("change", () => {
      const swap = state.pickSwaps[select.dataset.pick];
      const targetPick = findTransferredPick(select.value);
      if (swap && targetPick) {
        swap.targetPickId = targetPick.assetId;
        swap.toTeamId = targetPick.teamId;
      }
      renderTradeBoard();
    });
  });

  teamGridEl.querySelectorAll(".paired-swap-direction").forEach((select) => {
    select.addEventListener("change", () => {
      const swap = state.pickSwaps[select.dataset.pick];
      if (swap) swap.direction = select.value;
      renderTradeBoard();
    });
  });
}

function findTransferredPlayer(playerId) {
  const [senderId, ...nameParts] = playerId.split(":");
  const sender = getTeam(senderId);
  const playerName = nameParts.join(":");
  return sender && getTeamPlayers(sender).find((player) => player.name === playerName);
}

function findTransferredPick(pickId) {
  const [senderId, , indexText] = pickId.split(":");
  const sender = getTeam(senderId);
  return sender && getTeamPicks(sender)[Number(indexText)];
}

function renderReviewTeam(teamId) {
  const team = getTeam(teamId);
  const flow = getTeamFlow(teamId);
  const originalPayroll = Number(team.total_salary || 0);
  const newPayroll = originalPayroll - flow.outgoing + flow.incoming;
  const outgoingPlayers = Object.entries(state.transfers)
    .filter(([playerId]) => Number(playerId.split(":")[0]) === Number(teamId))
    .map(([playerId, destinationId]) => ({ player: findTransferredPlayer(playerId), destination: getTeam(destinationId) }))
    .filter((entry) => entry.player);
  const incomingPlayers = Object.entries(state.transfers)
    .filter(([, destinationId]) => Number(destinationId) === Number(teamId))
    .map(([playerId]) => ({ player: findTransferredPlayer(playerId), sender: getTeam(playerId.split(":")[0]) }))
    .filter((entry) => entry.player);
  const outgoingPicks = Object.entries(state.pickTransfers)
    .filter(([pickId]) => Number(pickId.split(":")[0]) === Number(teamId))
    .map(([pickId, destinationId]) => ({ pick: findTransferredPick(pickId), destination: getTeam(destinationId) }))
    .filter((entry) => entry.pick);
  const incomingPicks = Object.entries(state.pickTransfers)
    .filter(([, destinationId]) => Number(destinationId) === Number(teamId))
    .map(([pickId]) => ({ pick: findTransferredPick(pickId), sender: getTeam(pickId.split(":")[0]) }))
    .filter((entry) => entry.pick);
  const outgoingSwaps = Object.entries(state.pickSwaps)
    .filter(([pickId]) => Number(pickId.split(":")[0]) === Number(teamId))
    .map(([pickId, swap]) => ({
      pick: findTransferredPick(pickId),
      targetPick: findTransferredPick(getSwapTargetPickId(pickId, swap) || ""),
      destination: getTeam(swap.toTeamId)
    }))
    .filter((entry) => entry.pick && entry.targetPick && entry.destination);
  const incomingSwaps = Object.entries(state.pickSwaps)
    .map(([pickId, swap]) => ({
      pick: findTransferredPick(pickId),
      targetPick: findTransferredPick(getSwapTargetPickId(pickId, swap) || ""),
      sender: getTeam(pickId.split(":")[0])
    }))
    .filter((entry) => entry.targetPick?.teamId === Number(teamId) && entry.pick && entry.sender);

  const pickLabel = (pick) => `<span class="review-pick-title">${renderPickOwnerBadge(pick)}<span>${escapeHtml(formatPick(pick))}</span></span>`;
  const outgoingRows = [
    ...outgoingPlayers.map(({ player, destination }) => renderReviewPlayerAsset(player, player.salary, "To", destination?.name)),
    ...outgoingPicks.map(({ pick, destination }) => `<div class="review-asset review-asset--pick">${pickLabel(pick)}<strong>Draft pick · ${escapeHtml(getPickTradeProtection(pick.assetId))}</strong><em>To ${escapeHtml(destination?.name || "team")}</em></div>`),
    ...outgoingSwaps.map(({ pick, targetPick, destination }) => `<div class="review-asset review-asset--pick">${pickLabel(pick)}<strong>${escapeHtml(swapDirectionLabel(state.pickSwaps[pick.assetId]))} against ${pickLabel(targetPick)}</strong><em>With ${escapeHtml(destination.name)}</em></div>`)
  ].join("");
  const incomingRows = [
    ...incomingPlayers.map(({ player, sender }) => renderReviewPlayerAsset(player, player.salary, "From", sender?.name)),
    ...incomingPicks.map(({ pick, sender }) => `<div class="review-asset review-asset--pick">${pickLabel(pick)}<strong>Draft pick · ${escapeHtml(getPickTradeProtection(pick.assetId))}</strong><em>From ${escapeHtml(sender?.name || "team")}</em></div>`),
    ...incomingSwaps.map(({ pick, targetPick, sender }) => `<div class="review-asset review-asset--pick">${pickLabel(pick)}<strong>${escapeHtml(swapDirectionLabel(state.pickSwaps[pick.assetId]))} against ${pickLabel(targetPick)}</strong><em>From ${escapeHtml(sender.name)}</em></div>`)
  ].join("");

  return `
    <article class="review-team" data-team-theme="${getTeamAbbreviation(team)}">
      <header class="review-team__header">
        <span class="review-team__brand">
          ${team.logo
            ? `<img class="review-team__logo" src="${escapeHtml(team.logo)}" alt="" aria-hidden="true" data-abbr="${getTeamAbbreviation(team)}"><span class="review-team__badge" hidden>${getTeamAbbreviation(team)}</span>`
            : `<span class="review-team__badge">${getTeamAbbreviation(team)}</span>`}
        </span>
        <div class="review-team__identity"><h3>${escapeHtml(team.name)}</h3><span>TEAM ${state.teamIds.indexOf(teamId) + 1}</span></div>
      </header>
      <div class="review-payroll">
        <div><span>Current payroll</span><strong>${formatMoney(originalPayroll)}</strong></div>
        <div><span>After trade</span><strong>${formatMoney(newPayroll)}</strong></div>
        <div><span>Net change</span><strong class="${newPayroll >= originalPayroll ? "money-in" : "money-out"}">${newPayroll >= originalPayroll ? "+" : "−"}${formatMoney(Math.abs(newPayroll - originalPayroll))}</strong></div>
      </div>
      <div class="review-trade-lists">
        <section><h4>Outgoing <span>${outgoingPlayers.length + outgoingPicks.length + outgoingSwaps.length}</span></h4>${outgoingRows || '<p class="review-empty">No outgoing assets</p>'}</section>
        <section><h4>Incoming <span>${incomingPlayers.length + incomingPicks.length + incomingSwaps.length}</span></h4>${incomingRows || '<p class="review-empty">No incoming assets</p>'}</section>
      </div>
    </article>
  `;
}

function validateTrade() {
  const checks = [];
  const participatingTeams = state.teamIds.filter(Boolean).map(getTeam).filter(Boolean);
  const transferredPlayerIds = Object.keys(state.transfers);
  const transferredPickIds = Object.keys(state.pickTransfers);
  const pickSwapIds = Object.keys(state.pickSwaps);
  const transferredAssetCount = transferredPlayerIds.length + transferredPickIds.length + pickSwapIds.length;

  checks.push({
    title: "Trade structure",
    status: participatingTeams.length >= 2 && participatingTeams.length <= MAX_TRADE_TEAMS && transferredAssetCount > 0 ? "pass" : "fail",
    detail: participatingTeams.length < 2
      ? "Select at least two teams."
      : transferredAssetCount === 0
        ? "Add a player, draft pick, or pick swap to the trade."
        : `${participatingTeams.length} teams and ${transferredAssetCount} trade assets are included.`
  });

  const pickSwapIssues = [];
  pickSwapIds.forEach((pickId) => {
    const pick = findTransferredPick(pickId);
    const swap = state.pickSwaps[pickId];
    const targetPickId = getSwapTargetPickId(pickId, swap);
    const targetPick = findTransferredPick(targetPickId || "");
    const senderId = Number(pickId.split(":")[0]);
    const senderSlotIndex = state.teamIds.findIndex((teamId) => Number(teamId) === senderId);
    const validTarget = pick && getSwapCandidates(pick, senderId, senderSlotIndex)
      .some((candidate) => candidate.pick.assetId === targetPickId);
    if (!pick || Number(pick.round) !== 1 || !targetPick
      || Number(targetPick.round) !== 1
      || Number(targetPick.year) !== Number(pick.year)
      || Number(targetPick.teamId) === senderId
      || !validTarget
      || isPickFrozen(pick)
      || isPickFrozen(targetPick)
      || state.pickTransfers[pickId]
      || state.pickTransfers[targetPickId]) {
      pickSwapIssues.push(`${pick ? formatPick(pick) : "A pick swap"} does not have a valid, available matching first-round pick.`);
      return;
    }
    if (Number(pick.year) > CBA_ESTIMATES.lastTradeableFirstRoundYear) {
      pickSwapIssues.push(`${formatPick(pick)} is outside the modeled seven-year first-round pick window.`);
    }
  });
  checks.push({
    title: "Pick swaps",
    status: pickSwapIssues.length ? "fail" : "pass",
    detail: pickSwapIssues.join(" ") || (pickSwapIds.length
      ? `${pickSwapIds.length} first-round pick swap${pickSwapIds.length === 1 ? "" : "s"} included with matching selected-team picks.`
      : "No pick swaps are included.")
  });

  const salaryIssues = [];
  const salaryNotes = [];
  participatingTeams.forEach((team) => {
    const flow = getTeamFlow(team.id);
    if (flow.incoming <= 0) return;
    const match = getSalaryMatchLimit(team, flow.outgoing);
    if (flow.incoming > match.maximum) {
      salaryIssues.push(`${team.name} receives ${formatMoney(flow.incoming)} but may receive up to ${formatMoney(match.maximum)}. ${match.rule}`);
    } else {
      salaryNotes.push(`${team.name}: ${formatMoney(flow.incoming)} incoming / ${formatMoney(match.maximum)} allowed.`);
    }
  });
  checks.push({
    title: "Salary matching",
    status: salaryIssues.length ? "fail" : "pass",
    detail: (salaryIssues.length ? salaryIssues : salaryNotes).join(" ") || "No player salaries are changing hands."
  });

  const hardCapIssues = [];
  participatingTeams.forEach((team) => {
    const tier = getApronTier(team);
    if (!tier) return;
    const flow = getTeamFlow(team.id);
    const afterTrade = Number(team.total_salary || 0) - flow.outgoing + flow.incoming;
    const apronLimit = tier === 2 ? CBA_ESTIMATES.secondApron : CBA_ESTIMATES.firstApron;
    if (flow.incoming > 0 && afterTrade > apronLimit) {
      hardCapIssues.push(`${team.name} would be at ${formatMoney(afterTrade)}, above the estimated ${tier === 2 ? "second" : "first"} apron of ${formatMoney(apronLimit)}.`);
    }
    if (flow.incoming > 0 && flow.incoming > flow.outgoing) {
      hardCapIssues.push(`${team.name} is marked ${tier === 2 ? "second" : "first"} apron and cannot take back more salary than it sends.`);
    }
  });
  checks.push({
    title: "Apron restrictions",
    status: hardCapIssues.length ? "fail" : "pass",
    detail: hardCapIssues.join(" ") || "No configured first- or second-apron restriction is exceeded."
  });

  const aggregationIssues = [];
  participatingTeams.forEach((team) => {
    if (getApronTier(team) !== 2) return;
    const flow = getTeamFlow(team.id);
    const counts = getTeamPlayerCounts(team.id);
    if (flow.incoming > 0 && counts.outgoing > 1) {
      aggregationIssues.push(`${team.name} is a second-apron team and may not aggregate multiple outgoing player salaries.`);
    }
  });
  checks.push({
    title: "Second-apron aggregation",
    status: aggregationIssues.length ? "fail" : "pass",
    detail: aggregationIssues.join(" ") || "No second-apron salary aggregation restriction is triggered."
  });

  const firstRoundTransfers = transferredPickIds
    .map((pickId) => ({ pickId, pick: findTransferredPick(pickId), senderId: Number(pickId.split(":")[0]) }))
    .filter((entry) => entry.pick?.round === 1);
  const stepienIssues = [];
  const stepienWarnings = [];

  transferredPickIds.forEach((pickId) => {
    const pick = findTransferredPick(pickId);
    if (pick && isPickFrozen(pick)) {
      stepienIssues.push(`${formatPick(pick)} is marked frozen in the API pick inventory and cannot be traded.`);
    }
  });

  firstRoundTransfers.forEach(({ pick, senderId }) => {
    if (Number(pick.year) > CBA_ESTIMATES.lastTradeableFirstRoundYear) {
      stepienIssues.push(`${formatPick(pick)} is outside the modeled seven-year first-round pick window.`);
    }
    if (pick.protection || pick.is_swap) {
      stepienWarnings.push(`${formatPick(pick)} has protection or swap language; exact conveyance needs league/legal review.`);
    }
  });

  const yearPairs = [];
  for (let year = 2027; year < CBA_ESTIMATES.lastTradeableFirstRoundYear; year += 1) {
    yearPairs.push([year, year + 1]);
  }
  participatingTeams.forEach((team) => {
    if (!firstRoundTransfers.some((entry) => entry.senderId === Number(team.id))) return;
    const before = getPickOwnershipByYear(team.id, false);
    const after = getPickOwnershipByYear(team.id, true);

    yearPairs.forEach(([year, nextYear]) => {
      const originallyCovered = before.has(year) || before.has(nextYear);
      if (!originallyCovered) {
        if (firstRoundTransfers.some((entry) => entry.senderId === Number(team.id) && [year, nextYear].includes(Number(entry.pick.year)))) {
          stepienWarnings.push(`${team.name}: API pick inventory does not show a first-round pick in either ${year} or ${nextYear}; Stepien status needs manual verification.`);
        }
        return;
      }
      if (!after.has(year) && !after.has(nextYear)) {
        stepienIssues.push(`${team.name} would have no first-round pick in either ${year} or ${nextYear}, violating the Stepien consecutive-year restriction.`);
      }
    });
  });

  checks.push({
    title: "Stepien rule and pick window",
    status: stepienIssues.length ? "fail" : stepienWarnings.length ? "attention" : "pass",
    detail: [...stepienIssues, ...stepienWarnings].join(" ") || (firstRoundTransfers.length ? "First-round picks pass the modeled consecutive-year check." : "No first-round picks are included.")
  });

  const failures = checks.filter((check) => check.status === "fail");
  const warnings = checks.filter((check) => check.status === "attention");
  const verdict = failures.length ? "NOT APPROVED" : warnings.length ? "MANUAL REVIEW REQUIRED" : "APPROVED BY CHECKS";
  const verdictStatus = failures.length ? "fail" : warnings.length ? "attention" : "pass";
  return { checks, verdict, verdictStatus };
}

function reviewTrade() {
  const result = validateTrade();
  reviewTitleEl.textContent = viewingSavedTrade ? "Saved trade details" : "Trade review";
  saveTradeBtn.hidden = viewingSavedTrade;
  editSavedTradeBtn.hidden = !viewingSavedTrade;
  const checkRows = result.checks.map((check) => `
    <article class="approval-check approval-check--${check.status}">
      <span class="approval-icon" aria-hidden="true">${check.status === "pass" ? "✓" : check.status === "fail" ? "×" : "!"}</span>
      <div><h3>${escapeHtml(check.title)}</h3><p>${escapeHtml(check.detail)}</p></div>
      <strong>${check.status === "pass" ? "PASS" : check.status === "fail" ? "FAIL" : "REVIEW"}</strong>
    </article>
  `).join("");
  reviewContentEl.innerHTML = `
    <section class="approval-verdict approval-verdict--${result.verdictStatus}">
      <span class="verdict-mark" aria-hidden="true">${result.verdictStatus === "pass" ? "✓" : result.verdictStatus === "fail" ? "×" : "!"}</span>
      <div><span>TRADE APPROVAL CHECK</span><h2>${result.verdict}</h2></div>
    </section>
    <section class="approval-checks" aria-label="Trade rule checks">${checkRows}</section>
    <p class="cba-estimate-note">Rule model uses 2026–27 thresholds: salary cap ${formatMoney(CBA_ESTIMATES.salaryCap)}, first apron ${formatMoney(CBA_ESTIMATES.firstApron)}, second apron ${formatMoney(CBA_ESTIMATES.secondApron)}, and minimum team salary ${formatMoney(CBA_ESTIMATES.minimumTeamSalary)}, with scaled salary-matching bands. This is a trade-planning estimate, not official NBA approval; protected picks need manual conveyance review.</p>
    <h2 class="review-assets-title">Trade assets by team</h2>
    <div class="review-team-grid">${state.teamIds.filter(Boolean).map(renderReviewTeam).join("")}</div>
  `;
  reviewContentEl.querySelectorAll(".review-team__logo").forEach((image) => {
    image.addEventListener("error", () => {
      image.hidden = true;
      image.nextElementSibling.hidden = false;
    }, { once: true });
    if (image.complete && image.naturalWidth === 0) {
      image.hidden = true;
      image.nextElementSibling.hidden = false;
    }
  });
  reviewContentEl.querySelectorAll(".review-player-headshot").forEach((image) => {
    image.addEventListener("error", () => {
      image.hidden = true;
      image.nextElementSibling.hidden = false;
    }, { once: true });
    if (image.complete && image.naturalWidth === 0) {
      image.hidden = true;
      image.nextElementSibling.hidden = false;
    }
  });
  reviewContentEl.querySelectorAll(".review-pick-owner__logo").forEach((image) => {
    image.addEventListener("error", () => {
      image.hidden = true;
      image.nextElementSibling.hidden = false;
    }, { once: true });
    if (image.complete && image.naturalWidth === 0) {
      image.hidden = true;
      image.nextElementSibling.hidden = false;
    }
  });
  reviewDialog.showModal();
}

function saveCurrentTrade() {
  if (state.teamIds.filter(Boolean).length < 2) {
    showTradeToast("Select at least two teams before saving a trade.");
    return;
  }
  if (!Object.keys(state.transfers).length && !Object.keys(state.pickTransfers).length && !Object.keys(state.pickSwaps).length) {
    showTradeToast("Add at least one player, pick, or pick swap before saving a trade.");
    return;
  }

  const snapshot = buildTradeSnapshot();
  const savedTrades = getSavedTrades();
  savedTrades.unshift(snapshot);
  if (!storeSavedTrades(savedTrades)) return;
  renderSavedTrades();
  saveTradeBtn.textContent = "Saved locally";
  window.setTimeout(() => { saveTradeBtn.textContent = "Submit & save"; }, 1800);
  showTradeToast(`Proposal saved in this browser · ${snapshot.verdict}. Saving does not execute a real NBA transaction.`);
}

function renderSavedTrades() {
  const savedTrades = getSavedTrades();
  if (!savedTrades.length) {
    savedTradesContentEl.innerHTML = '<div class="saved-trades-empty"><span aria-hidden="true">▤</span><h3>No saved trades yet</h3><p>Review a proposal and save it to keep a copy in this browser.</p></div>';
    return;
  }

  savedTradesContentEl.innerHTML = `<div class="saved-trades-list">${savedTrades.map((trade) => {
    const date = new Date(trade.createdAt);
    const dateLabel = Number.isNaN(date.getTime()) ? "Saved trade" : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
    const participants = (trade.teams || []).map((team) => team.name).join(" · ");
    const assetCount = (trade.players || []).length + (trade.picks || []).length;
    const savedAssets = [
      ...(Array.isArray(trade.players) ? trade.players.map((player) => ({
        markup: `<span class="saved-trade-thumb saved-trade-thumb--player" title="${escapeHtml(player.name)}">${renderReviewPlayerFace(player)}</span>`
      })) : []),
      ...(Array.isArray(trade.picks) ? trade.picks.map((pick) => ({
        markup: `<span class="saved-trade-thumb saved-trade-thumb--pick" title="${escapeHtml(`${pick.year} ${pick.round === 1 ? "1st" : "2nd"} · ${pick.owner || "Original owner unavailable"}`)}">${renderPickOwnerBadge(pick)}<small>${escapeHtml(pick.year)} ${pick.round === 1 ? "1st" : "2nd"}</small></span>`
      })) : [])
    ];
    const visibleAssets = savedAssets.slice(0, 8);
    const assetPreview = visibleAssets.length
      ? `<div class="saved-trade-assets" aria-label="Players and picks in this saved trade">${visibleAssets.map((asset) => asset.markup).join("")}${savedAssets.length > visibleAssets.length ? `<span class="saved-trade-assets__more">+${savedAssets.length - visibleAssets.length}</span>` : ""}</div>`
      : "";
    const verdictClass = trade.verdictStatus === "pass" ? "pass" : trade.verdictStatus === "fail" ? "fail" : "attention";
    return `
      <article class="saved-trade-row">
        <div class="saved-trade-main">
          <span class="saved-trade-verdict saved-trade-verdict--${verdictClass}">${escapeHtml(trade.verdict || "Saved")}</span>
          <strong>${escapeHtml(participants || "Trade proposal")}</strong>
          <span class="saved-trade-date">${dateLabel} · ${assetCount} assets</span>
          ${assetPreview}
        </div>
        <div class="saved-trade-actions">
          <button type="button" class="button button--ghost saved-trade-load" data-trade-id="${escapeHtml(trade.id)}">Open</button>
          <button type="button" class="icon-button saved-trade-delete" data-trade-id="${escapeHtml(trade.id)}" aria-label="Delete saved trade" title="Delete saved trade">×</button>
        </div>
      </article>
    `;
  }).join("")}</div>`;
  savedTradesContentEl.querySelectorAll(".review-player-headshot").forEach((image) => {
    image.addEventListener("error", () => {
      image.hidden = true;
      image.nextElementSibling.hidden = false;
    }, { once: true });
    if (image.complete && image.naturalWidth === 0) {
      image.hidden = true;
      image.nextElementSibling.hidden = false;
    }
  });
  savedTradesContentEl.querySelectorAll(".review-pick-owner__logo").forEach((image) => {
    image.addEventListener("error", () => {
      image.hidden = true;
      image.nextElementSibling.hidden = false;
    }, { once: true });
    if (image.complete && image.naturalWidth === 0) {
      image.hidden = true;
      image.nextElementSibling.hidden = false;
    }
  });

  savedTradesContentEl.querySelectorAll(".saved-trade-load").forEach((button) => {
    button.addEventListener("click", () => loadSavedTrade(button.dataset.tradeId));
  });
  savedTradesContentEl.querySelectorAll(".saved-trade-delete").forEach((button) => {
    button.addEventListener("click", () => {
      const remaining = getSavedTrades().filter((trade) => trade.id !== button.dataset.tradeId);
      if (storeSavedTrades(remaining)) renderSavedTrades();
    });
  });
}

function loadSavedTrade(tradeId) {
  const trade = getSavedTrades().find((item) => item.id === tradeId);
  if (!trade?.tradeState) {
    showTradeToast("This saved trade is missing its editable trade details.");
    return;
  }
  state.teamIds = Array.isArray(trade.tradeState.teamIds) ? trade.tradeState.teamIds.slice(0, MAX_TRADE_TEAMS) : [];
  state.transfers = { ...(trade.tradeState.transfers || {}) };
  state.pickTransfers = { ...(trade.tradeState.pickTransfers || {}) };
  state.pickSwaps = Object.fromEntries(Object.entries(trade.tradeState.pickSwaps || {}).map(([pickId, swap]) => [pickId, { ...swap }]));
  state.pickProtections = { ...(trade.tradeState.pickProtections || {}) };
  state.customPickProtections = { ...(trade.tradeState.customPickProtections || {}) };
  state.pickSwapTypes = { ...(trade.tradeState.pickSwapTypes || {}) };
  Object.keys(state.pickTransfers).forEach((pickId) => {
    state.activeViews[pickId.split(":")[0]] = "picks";
  });
  Object.keys(state.pickSwaps).forEach((pickId) => {
    state.activeViews[pickId.split(":")[0]] = "picks";
    const targetPickId = getSwapTargetPickId(pickId, state.pickSwaps[pickId]);
    if (targetPickId) state.activeViews[targetPickId.split(":")[0]] = "picks";
  });
  viewingSavedTrade = true;
  renderTradeBoard();
  savedTradesDialog.close();
  reviewTrade();
}

async function loadTeams({ background = false } = {}) {
  if (isLoadingTeams) return;
  isLoadingTeams = true;
  if (!background) {
    apiStatusEl.textContent = "Connecting to API…";
    teamGridEl.innerHTML = '<div class="loading-state">Loading team data…</div>';
  }

  try {
    const response = await fetch(`${API_URL}/api/v1/teams`, {
      headers: { "x-api-key": API_KEY }
    });
    if (!response.ok) throw new Error(`API request failed (${response.status})`);

    const data = await response.json();
    teams = data.teams || [];
    if (teams.length === 0) throw new Error("The API returned no teams.");
    lastTeamsRefreshAt = Date.now();

    const missingSalaries = teams.reduce((count, team) => count + getTeamPlayers(team).filter((player) => !hasSalary(player)).length, 0);
    const stats = data.stats || {};
    const updatedAt = stats.last_updated
      ? new Date(stats.last_updated).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      : "";
    const salaryStatus = missingSalaries === 0
      ? "API salaries received"
      : `${missingSalaries} salaries unavailable`;
    const roster = data.roster || {};
    const rosterStatus = roster.status === "fresh" ? "Rosters current" : "Rosters may be outdated";
    const statsStatus = stats.status === "fresh"
      ? `${stats.season} stats ${updatedAt}`
      : stats.status === "pending"
        ? `${stats.season || "Current-season"} stats pending`
        : "Live stats unavailable";
    apiStatusEl.textContent = `${rosterStatus} · ${salaryStatus} · ${statsStatus}`;
    apiStatusEl.title = [roster.message, stats.message].filter(Boolean).join(" ");
    apiStatusEl.classList.toggle("pill--warning", roster.status !== "fresh" || missingSalaries > 0 || stats.status !== "fresh");

    renderTradeBoard();
  } catch (error) {
    console.error("Trade machine API load failed:", error);
    if (teams.length) {
      apiStatusEl.textContent = "Stats refresh failed. Showing the last API response; automatic retry in 15 minutes.";
      apiStatusEl.classList.add("pill--warning");
      renderTradeBoard();
    } else {
      apiStatusEl.textContent = "API connection failed";
      teamGridEl.innerHTML = '<div class="loading-state">Could not load teams. Check the API URL, network, and API key.</div>';
    }
  } finally {
    isLoadingTeams = false;
  }
}

function addTeamSlot() {
  if (state.teamIds.length < MAX_TRADE_TEAMS) {
    state.teamIds.push(null);
    renderTradeBoard();
  }
}

addTeamBtn.addEventListener("click", addTeamSlot);

clearTradeBtn.addEventListener("click", () => {
  state.transfers = {};
  state.pickTransfers = {};
  state.pickSwaps = {};
  state.pickProtections = {};
  state.customPickProtections = {};
  state.pickSwapTypes = {};
  state.openTeamPickerSlot = null;
  renderTradeBoard();
});

reviewTradeBtn.addEventListener("click", reviewTrade);
saveTradeBtn.addEventListener("click", saveCurrentTrade);
editSavedTradeBtn.addEventListener("click", () => {
  viewingSavedTrade = false;
  reviewDialog.close();
});
savedTradesBtn.addEventListener("click", () => {
  state.openTeamPickerSlot = null;
  renderTradeBoard();
  renderSavedTrades();
  savedTradesDialog.showModal();
});
closeReviewBtn.addEventListener("click", () => reviewDialog.close());
doneReviewBtn.addEventListener("click", () => reviewDialog.close());
closeSavedTradesBtn.addEventListener("click", () => savedTradesDialog.close());
playerProfileDialog.addEventListener("click", (event) => {
  if (event.target === playerProfileDialog) playerProfileDialog.close();
});
reviewDialog.addEventListener("click", (event) => {
  if (event.target === reviewDialog) reviewDialog.close();
});
reviewDialog.addEventListener("close", () => {
  viewingSavedTrade = false;
});
savedTradesDialog.addEventListener("click", (event) => {
  if (event.target === savedTradesDialog) savedTradesDialog.close();
});
document.addEventListener("click", (event) => {
  if (state.openTeamPickerSlot === null || event.target.closest(".team-picker")) return;
  state.openTeamPickerSlot = null;
  renderTradeBoard();
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || state.openTeamPickerSlot === null) return;
  state.openTeamPickerSlot = null;
  renderTradeBoard();
});
renderTradeBoard();
loadTeams();
window.setInterval(() => loadTeams({ background: true }), 15 * 60 * 1000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && Date.now() - lastTeamsRefreshAt >= 15 * 60 * 1000) {
    loadTeams({ background: true });
  }
});
