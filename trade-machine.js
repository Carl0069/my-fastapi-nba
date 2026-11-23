const API_URL = "https://my-fastapi-nba.vercel.app";
const API_KEY = "lebron2369";
const MAX_TRADE_TEAMS = 5;
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

const TRADE_RULES = {
  salaryMatching: true,
  apronHardCaps: true,
  minimumTeamSalaryFloor: true,
  signAndTradeRules: true,
  protectedPickRules: true,
  rosterSizeRules: true
};

let teams = [];
let rumorWatchPlayers = [];
let lastTeamsRefreshAt = 0;
let isLoadingTeams = false;
const state = {
  teamIds: [],
  transfers: {},
  tradeExceptionUses: {},
  signAndTrades: {},
  reSignedCapHolds: {},
  renouncedCapHolds: {},
  rosterActions: {},
  extensions: {},
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
const guestTradeNoticeEl = document.getElementById("guestTradeNotice");
const addTeamBtn = document.getElementById("addTeamBtn");
const clearTradeBtn = document.getElementById("clearTradeBtn");
const reviewTradeBtn = document.getElementById("reviewTradeBtn");
const reviewDialog = document.getElementById("tradeReviewDialog");
const reviewContentEl = document.getElementById("reviewContent");
const reviewTitleEl = document.getElementById("reviewTitle");
const closeReviewBtn = document.getElementById("closeReviewBtn");
const doneReviewBtn = document.getElementById("doneReviewBtn");
const submitTradeBtn = document.getElementById("submitTradeBtn");
const tradePostForm = document.getElementById("tradePostForm");
const playerProfileDialog = document.getElementById("playerProfileDialog");
const playerProfileContentEl = document.getElementById("playerProfileContent");
const playerCompareDialog = document.getElementById("playerCompareDialog");
const playerCompareContentEl = document.getElementById("playerCompareContent");
const frontOfficeDialog = document.getElementById("frontOfficeDialog");
const frontOfficeContentEl = document.getElementById("frontOfficeContent");
const signTradeDialog = document.getElementById("signTradeDialog");
const signTradeContentEl = document.getElementById("signTradeContent");
const toastCloseBtn = document.getElementById("tradeToastClose");
const tradeToastEl = document.getElementById("tradeToast");
let tradeToastTimer = null;
let pendingSignTrade = null;
let playerCompareSelection = null;
let pendingFrontOfficeAction = null;

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
  const rosterPlayers = [...(team.starters_2026_27 || []), ...(team.bench_2026_27 || [])];
  const activeRosterPlayers = rosterPlayers.filter((player) =>
    !state.rosterActions[getPlayerId(team.id, player.name)]
  ).map((player) => (
    player.contract_type === "Two-Way" && !hasSalary(player)
      ? { ...player, salary: 0 }
      : player
  ));
  const resignedHolds = (team.cap_holds || [])
    .filter((hold) => state.reSignedCapHolds[getPlayerId(team.id, hold.name)])
    .filter((hold) => !rosterPlayers.some((player) => player.name.toLocaleLowerCase() === hold.name.toLocaleLowerCase()))
    .map((hold) => ({
      name: hold.name,
      salary: Number(hold.amount),
      pos: "Cap hold",
      contract_note: "Re-signed in this simulation"
    }));

  return [...activeRosterPlayers, ...resignedHolds]
    .sort((left, right) => {
      const leftSalary = Number.isFinite(Number(left.salary)) ? Number(left.salary) : -1;
      const rightSalary = Number.isFinite(Number(right.salary)) ? Number(right.salary) : -1;
      return rightSalary - leftSalary || left.name.localeCompare(right.name, "en", { sensitivity: "base" });
    });
}

function findRosterPlayer(team, playerName) {
  return getTeamPlayers(team).find((player) => player.name.toLocaleLowerCase() === playerName.toLocaleLowerCase());
}

function isTwoWayPlayer(player) {
  return String(player?.contract_type || "").toLocaleLowerCase().includes("two-way");
}

function getTeamActiveRosterPlayers(team) {
  return getTeamPlayers(team).filter((player) => !isTwoWayPlayer(player));
}

function getTeamTwoWayPlayers(team) {
  return getTeamPlayers(team).filter((player) => isTwoWayPlayer(player));
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

function isPlayerCapHold(item) {
  return Number(item.amount) > 0
    && typeof item.name === "string"
    && !/^(round\s+\d+|pick\b|draft pick\b)/i.test(item.name);
}

function getSignTradeDestinations(senderId) {
  return state.teamIds
    .filter((teamId) => teamId !== null && Number(teamId) !== Number(senderId))
    .map((teamId) => getTeam(teamId))
    .filter(Boolean);
}

function renderCapAssetRow(item, view, team) {
  const primaryLabel = view === "exceptions"
    ? [item.type, item.name].filter(Boolean).join(" · ")
    : item.name || item.type || "Cap hold";
  const details = [
    item.description,
    item.expires_on ? `Expires ${item.expires_on}` : null
  ].filter(Boolean);
  const exceptionIndex = view === "exceptions" ? (team.cap_exceptions || []).indexOf(item) : -1;
  const exceptionId = exceptionIndex >= 0 ? `${team.id}:tpe:${exceptionIndex}` : "";
  const assignedTpeSalary = exceptionId && /trade exception/i.test(String(item.type || ""))
    ? getTeamTradeExceptionUse(team.id, exceptionId)
    : 0;
  if (assignedTpeSalary > 0) details.push(`Assigned in this proposal: ${formatMoney(assignedTpeSalary)}`);
  const amount = item.amount !== null && item.amount !== undefined && item.amount !== ""
    && Number.isFinite(Number(item.amount))
    ? formatMoney(Number(item.amount))
    : "Not reported";
  const playerId = view === "cap_holds" && isPlayerCapHold(item)
    ? getPlayerId(team.id, item.name)
    : "";
  const signTrade = playerId ? state.signAndTrades[playerId] : null;
  const resigned = playerId && state.reSignedCapHolds[playerId];
  const renounced = playerId && state.renouncedCapHolds[playerId];
  const actions = playerId
    ? `<details class="asset-action-menu">
        <summary aria-label="Actions for ${escapeHtml(item.name)}">Actions</summary>
        <div class="asset-action-menu__items" role="group" aria-label="${escapeHtml(item.name)} actions">
          <button type="button" class="cap-hold-action" data-action="sign-trade" data-player="${escapeHtml(playerId)}" ${resigned || renounced ? "disabled" : ""}>${signTrade ? "Edit contract" : "Sign & trade"}</button>
          <button type="button" class="cap-hold-action" data-action="resign" data-player="${escapeHtml(playerId)}" ${signTrade || renounced ? "disabled" : ""}>${resigned ? "Undo re-sign" : "Re-sign at hold amount"}</button>
          <button type="button" class="cap-hold-action" data-action="renounce" data-player="${escapeHtml(playerId)}" ${signTrade || resigned ? "disabled" : ""}>${renounced ? "Restore rights" : "Renounce rights"}</button>
          <button type="button" class="cap-hold-action" data-action="profile" data-player="${escapeHtml(playerId)}">Player profile</button>
          <button type="button" class="cap-hold-action" data-action="compare" data-player="${escapeHtml(playerId)}">Compare players</button>
        </div>
      </details>`
    : "";

  return `
    <article class="cap-asset-row ${signTrade || resigned ? "cap-asset-row--selected" : ""}">
      <div class="cap-asset-row__detail">
        <strong>${escapeHtml(primaryLabel)}</strong>
        ${details.length || resigned || renounced ? `<span>${[
          ...details,
          resigned ? "Re-signed in this simulation" : null,
          renounced ? "Rights renounced in this simulation" : null
        ].filter(Boolean).map(escapeHtml).join(" · ")}</span>` : ""}
      </div>
      <div class="cap-asset-row__actions">
        <strong class="cap-asset-row__amount">${escapeHtml(amount)}</strong>
        ${actions}
      </div>
    </article>
  `;
}

function renderCapAssetPanel(team, view) {
  const isExceptionPanel = view === "exceptions";
  const entries = isExceptionPanel
    ? (Array.isArray(team.cap_exceptions) ? team.cap_exceptions : [])
    : (Array.isArray(team.cap_holds) ? team.cap_holds : []);
  const status = team.cap_data_status?.[view] || "unavailable";
  const title = isExceptionPanel ? "Salary-cap exceptions" : "Cap holds";
  const explanation = isExceptionPanel
    ? "Select an active trade exception for an incoming player. Other listed exception balances are informational."
    : "Unsigned-player rights holds count against the cap but are not signed salaries.";
  const emptyMessage = status === "none"
    ? `No active ${isExceptionPanel ? "exceptions" : "cap holds"} are listed for this team.`
    : status === "verified"
      ? `No ${isExceptionPanel ? "exceptions" : "cap holds"} are listed for this team in the verified snapshot.`
      : `Verified ${isExceptionPanel ? "exception" : "cap-hold"} details are not available for this team.`;
  const asOf = team.cap_data_as_of
    ? `2026–27 snapshot · As of ${team.cap_data_as_of}`
    : "2026–27 snapshot";

  return `
    <section class="cap-assets" role="tabpanel" aria-label="${escapeHtml(team.name)} ${escapeHtml(title)}">
      <header class="cap-assets__heading">
        <div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(explanation)}</p></div>
        <span>${escapeHtml(asOf)}</span>
      </header>
      <div class="cap-assets__list">
        ${entries.length
          ? entries.map((item) => renderCapAssetRow(item, view, team)).join("")
          : `<div class="team-empty">${escapeHtml(emptyMessage)}</div>`}
      </div>
    </section>
  `;
}

function renderTradeExceptionControls(team, incomingEntries) {
  const controls = incomingEntries
    .filter(({ player }) => player && !player.signAndTrade && !isTwoWayPlayer(player) && hasSalary(player) && player.salary > 0)
    .map(({ playerId, player }) => {
      const assignedId = state.tradeExceptionUses[playerId] || "";
      const options = getAvailableTeamTradeExceptions(team.id, playerId);
      if (assignedId && !options.some((exception) => exception.id === assignedId)) {
        const selectedException = getTeamTradeExceptions(team.id).find((exception) => exception.id === assignedId);
        options.unshift({
          ...(selectedException || { id: assignedId, name: "Selected trade exception", amount: 0 }),
          remainingAmount: selectedException
            ? Number(selectedException.amount) - getTeamTradeExceptionUse(team.id, assignedId, playerId)
            : 0,
          unavailable: true
        });
      }
      if (!options.length) return "";
      return `
        <label>
          <span>TPE for ${escapeHtml(player.name)}</span>
          <select class="destination-select tpe-use-select" data-tpe-player="${escapeHtml(playerId)}" aria-label="Apply a trade exception to ${escapeHtml(player.name)}">
            <option value="" ${assignedId ? "" : "selected"}>Use cap room / salary matching</option>
            ${options.map((exception) => {
              const label = [
                exception.name || "Trade exception",
                `${formatCompactMoney(exception.remainingAmount)} available`,
                exception.expires_on ? `expires ${exception.expires_on}` : "",
                exception.unavailable ? "unavailable" : ""
              ].filter(Boolean).join(" · ");
              return `<option value="${escapeHtml(exception.id)}" ${assignedId === exception.id ? "selected" : ""} ${exception.unavailable ? "disabled" : ""}>${escapeHtml(label)}</option>`;
            }).join("")}
          </select>
        </label>
      `;
    })
    .filter(Boolean)
    .join("");

  return controls ? `<div class="team-tpe-controls">${controls}</div>` : "";
}

function getSignTradeRaiseLimit(rightsType) {
  return /^(early )?bird$/i.test(String(rightsType || "").trim()) ? 8 : 5;
}

function getSignTradeSchedule(firstYearSalary, years, raisePercent) {
  const annualRaise = Math.round(firstYearSalary * raisePercent / 100);
  return Array.from({ length: years }, (_, index) => {
    const startYear = 2026 + index;
    return {
      season: `${startYear}–${String(startYear + 1).slice(-2)}`,
      salary: firstYearSalary + annualRaise * index,
      increase: annualRaise
    };
  });
}

function renderSignTradeSchedule(schedule) {
  return schedule.map((season, index) => `
    <div class="sign-trade-schedule__row">
      <span>${escapeHtml(season.season)}</span>
      <strong>${formatMoney(season.salary)}</strong>
      <small>${index ? `+${formatMoney(season.increase)}` : "First season"}</small>
    </div>
  `).join("");
}

function updateSignTradePreview(form) {
  const salary = Math.round(Number(form.elements.firstYearSalary.value));
  const years = Number(form.elements.years.value);
  const raisePercent = Number(form.elements.raisePercent.value);
  const destination = getTeam(form.elements.destination.value);
  const schedule = Number.isInteger(salary) && salary > 0
    ? getSignTradeSchedule(salary, years, raisePercent)
    : [];
  const total = schedule.reduce((sum, season) => sum + season.salary, 0);
  const playerId = getPlayerId(pendingSignTrade.teamId, pendingSignTrade.hold.name);
  const existingContract = state.signAndTrades[playerId];
  const flow = destination ? getTeamFlow(destination.id) : null;
  const existingIncoming = existingContract && destination
    && Number(existingContract.toTeamId) === Number(destination.id)
    ? Number(existingContract.firstYearSalary)
    : 0;
  const projectedCapPayroll = destination && flow
    ? getTeamCapPayroll(destination.id) - flow.payrollOutgoing + flow.incoming - existingIncoming + salary
    : null;
  const projectedApronSalary = destination && flow
    ? getTeamSalaryExcludingCapHolds(destination.id) - flow.payrollOutgoing + flow.incoming - existingIncoming + salary
    : null;

  form.querySelector("[data-snt-schedule]").innerHTML = schedule.length
    ? renderSignTradeSchedule(schedule)
    : '<p class="sign-trade-empty">Enter a positive first-year salary to preview the contract.</p>';
  signTradeContentEl.querySelector("[data-snt-total]").textContent = `${years} seasons · ${formatMoney(total)} total`;
  form.querySelector("[data-snt-trade-salary]").textContent = formatMoney(salary || 0);
  form.querySelector("[data-snt-destination-payroll]").textContent = projectedCapPayroll === null
    ? "Choose a destination"
    : formatMoney(projectedCapPayroll);
  form.querySelector("[data-snt-apron-room]").textContent = projectedApronSalary === null
    ? "—"
    : `${projectedApronSalary <= CBA_ESTIMATES.firstApron ? "" : "Over "}${formatMoney(Math.abs(CBA_ESTIMATES.firstApron - projectedApronSalary))}`;
  form.querySelector("[data-snt-apron-room]").classList.toggle(
    "is-over",
    projectedApronSalary !== null && projectedApronSalary > CBA_ESTIMATES.firstApron
  );
}

function renderSignTradeDialog(teamId, hold) {
  const team = getTeam(teamId);
  const destinations = getSignTradeDestinations(teamId);
  if (!team || !destinations.length) {
    showTradeToast("Choose another trade team before creating a sign-and-trade.");
    return;
  }

  const playerId = getPlayerId(teamId, hold.name);
  const existing = state.signAndTrades[playerId];
  const maxSalary = Math.floor(CBA_ESTIMATES.salaryCap * 0.35);
  const firstYearSalary = Math.min(
    existing?.firstYearSalary || Number(hold.amount) || 1,
    maxSalary
  );
  const raiseLimit = getSignTradeRaiseLimit(hold.type);
  const destinationId = existing?.toTeamId && destinations.some((item) => item.id === Number(existing.toTeamId))
    ? Number(existing.toTeamId)
    : destinations[0].id;
  const destinationOptions = destinations.map((destination) => `
    <option value="${destination.id}" ${destination.id === destinationId ? "selected" : ""}>${escapeHtml(destination.name)}</option>
  `).join("");
  const raiseEnabled = Number(existing?.raisePercent ?? raiseLimit) > 0;

  pendingSignTrade = { teamId: Number(teamId), hold };
  signTradeContentEl.innerHTML = `
    <header class="sign-trade-header" data-team-theme="${getTeamAbbreviation(team)}">
      <div class="sign-trade-header__portrait">
        <img src="${escapeHtml(getPlayerHeadshotUrl(hold.name))}" alt="" aria-hidden="true" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false">
        <span class="sign-trade-header__fallback" hidden>${escapeHtml(getPlayerInitials(hold.name))}</span>
      </div>
      <div class="sign-trade-header__identity">
          <span>${escapeHtml(team.name)}</span>
          <h2>Sign &amp; trade: ${escapeHtml(hold.name)}</h2>
          <p>${escapeHtml(hold.type)} rights · cap hold ${formatMoney(Number(hold.amount) || 0)}</p>
      </div>
      <div class="sign-trade-header__team-logo">${renderTeamLogo(team, "sign-trade-team-logo")}</div>
      <button type="button" class="icon-button sign-trade-close" aria-label="Close sign-and-trade">×</button>
    </header>
    <form class="sign-trade-form" id="signTradeForm">
      <section class="sign-trade-rights" aria-label="Player rights">
        <h3 class="sign-trade-section-label">SIGNED USING</h3>
        <div class="sign-trade-rights-card" role="note">
          <strong>${escapeHtml(hold.type)} rights</strong>
          <span>Listed hold ${formatMoney(Number(hold.amount) || 0)} · manual contract estimate</span>
        </div>
      </section>
      <label class="sign-trade-destination">
        <span>TRADE TO</span>
        <select name="destination" required>${destinationOptions}</select>
      </label>
      <section class="sign-trade-terms" aria-label="Proposed contract terms">
        <div class="sign-trade-control sign-trade-control--seasons">
          <span class="sign-trade-section-label">SEASONS</span>
          <div class="sign-trade-years" role="group" aria-label="Contract length">
            ${[3, 4].map((years) => `<button type="button" class="sign-trade-year ${Number(existing?.years || 3) === years ? "is-active" : ""}" data-snt-years-choice="${years}" aria-pressed="${Number(existing?.years || 3) === years}">${years} years</button>`).join("")}
          </div>
          <input type="hidden" name="years" value="${existing?.years === 4 ? 4 : 3}">
        </div>
        <label class="sign-trade-control sign-trade-control--salary">
          <span class="sign-trade-section-label">FIRST-SEASON SALARY · MAX ${formatMoney(maxSalary)}</span>
          <input class="sign-trade-salary-range" type="range" name="salaryRange" min="1" max="${maxSalary}" step="1000" value="${firstYearSalary}" aria-label="First-season salary slider">
          <input class="sign-trade-salary-input" type="number" name="firstYearSalary" min="1" max="${maxSalary}" step="1" value="${firstYearSalary}" required>
        </label>
        <div class="sign-trade-raise-control">
          <input type="hidden" name="raisePercent" value="${raiseEnabled ? raiseLimit : 0}">
          <label class="sign-trade-raise-toggle">
            <input type="checkbox" name="maxRaises" ${raiseEnabled ? "checked" : ""}>
            <span class="sign-trade-raise-toggle__switch" aria-hidden="true"></span>
            <span>Max raises (${raiseLimit}%)</span>
          </label>
          <span class="sign-trade-raise-note">Applied annually to the first-year salary</span>
        </div>
      </section>
      <div class="sign-trade-estimate" role="note">Manual estimate — prior salary, years of service, player-specific maximum, and signing eligibility are not verified.</div>
      <section class="sign-trade-preview" aria-label="Contract preview">
        <h3 class="sign-trade-section-label">SCHEDULE</h3>
        <div class="sign-trade-schedule" data-snt-schedule></div>
        <div class="sign-trade-preview__totals">
          <div><span>First-year trade salary</span><strong data-snt-trade-salary></strong></div>
          <div><span>Destination cap payroll</span><strong data-snt-destination-payroll></strong></div>
          <div><span>Room below first apron</span><strong data-snt-apron-room></strong></div>
        </div>
      </section>
      <p class="sign-trade-form__error" role="alert" hidden></p>
    </form>
    <footer class="sign-trade-footer">
      <span data-snt-total></span>
      <div>
        ${existing ? '<button type="button" class="button button--ghost sign-trade-remove">Remove from trade</button>' : ""}
        <button type="button" class="button button--ghost sign-trade-cancel">Cancel</button>
        <button type="submit" class="button button--add" form="signTradeForm">Sign, then trade</button>
      </div>
    </footer>
  `;

  const form = signTradeContentEl.querySelector("#signTradeForm");
  const range = form.elements.salaryRange;
  const salaryInput = form.elements.firstYearSalary;
  form.querySelectorAll("[data-snt-years-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      form.elements.years.value = button.dataset.sntYearsChoice;
      form.querySelectorAll("[data-snt-years-choice]").forEach((yearButton) => {
        const selected = yearButton === button;
        yearButton.classList.toggle("is-active", selected);
        yearButton.setAttribute("aria-pressed", String(selected));
      });
      updateSignTradePreview(form);
    });
  });
  range.addEventListener("input", () => {
    salaryInput.value = range.value;
    updateSignTradePreview(form);
  });
  salaryInput.addEventListener("input", () => {
    const value = Number(salaryInput.value);
    if (Number.isFinite(value)) range.value = String(Math.min(maxSalary, Math.max(1, value)));
    updateSignTradePreview(form);
  });
  form.elements.destination.addEventListener("change", () => updateSignTradePreview(form));
  form.elements.maxRaises.addEventListener("change", () => {
    form.elements.raisePercent.value = form.elements.maxRaises.checked ? raiseLimit : 0;
    updateSignTradePreview(form);
  });
  form.addEventListener("submit", saveSignTrade);
  signTradeContentEl.querySelector(".sign-trade-close").addEventListener("click", () => signTradeDialog.close());
  signTradeContentEl.querySelector(".sign-trade-cancel").addEventListener("click", () => signTradeDialog.close());
  signTradeContentEl.querySelector(".sign-trade-remove")?.addEventListener("click", () => {
    delete state.transfers[playerId];
    delete state.tradeExceptionUses[playerId];
    delete state.signAndTrades[playerId];
    signTradeDialog.close();
    pendingSignTrade = null;
    renderTradeBoard();
  });
  updateSignTradePreview(form);
  signTradeDialog.showModal();
}

function saveSignTrade(event) {
  event.preventDefault();
  if (!pendingSignTrade) return;

  const form = event.currentTarget;
  const teamId = pendingSignTrade.teamId;
  const hold = pendingSignTrade.hold;
  const playerId = getPlayerId(teamId, hold.name);
  const destinationId = Number(form.elements.destination.value);
  const firstYearSalary = Number(form.elements.firstYearSalary.value);
  const years = Number(form.elements.years.value);
  const raisePercent = Number(form.elements.raisePercent.value);
  const maxSalary = Math.floor(CBA_ESTIMATES.salaryCap * 0.35);
  const raiseLimit = getSignTradeRaiseLimit(hold.type);
  const validDestination = getSignTradeDestinations(teamId)
    .some((destination) => destination.id === destinationId);
  const errorEl = form.querySelector(".sign-trade-form__error");

  if (!validDestination || !Number.isInteger(firstYearSalary) || firstYearSalary < 1
    || firstYearSalary > maxSalary || ![3, 4].includes(years)
    || ![0, raiseLimit].includes(raisePercent)) {
    errorEl.textContent = "Choose a trade destination, a valid 3- or 4-year term, a positive salary under the league maximum, and an available raise option.";
    errorEl.hidden = false;
    return;
  }

  const schedule = getSignTradeSchedule(firstYearSalary, years, raisePercent);
  state.signAndTrades[playerId] = {
    fromTeamId: teamId,
    toTeamId: destinationId,
    rightsType: hold.type,
    capHold: Number(hold.amount) || 0,
    firstYearSalary,
    years,
    raisePercent,
    schedule,
    totalValue: schedule.reduce((sum, season) => sum + season.salary, 0)
  };
  state.transfers[playerId] = destinationId;
  signTradeDialog.close();
  pendingSignTrade = null;
  renderTradeBoard();
  showTradeToast(`${hold.name} added as a ${years}-year sign-and-trade proposal.`);
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

async function tradeApiRequest(path, { method = "GET", body, authenticated = false } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (authenticated) {
    const token = window.NBAHubAuth?.getSession()?.access_token;
    if (!token) throw new Error("Sign in to use cloud trade features.");
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${API_URL}/api/v1/trade-machine/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.detail || `Trade service request failed (${response.status}).`);
  }
  return payload;
}

function getFrontOfficeActions() {
  const actions = [];
  Object.entries(state.rosterActions).forEach(([playerId, playerAction]) => {
    const [teamId, ...nameParts] = playerId.split(":");
    const team = getTeam(teamId);
    if (!team) return;
    actions.push({
      actionType: playerAction.label === "Stretched"
        ? "stretched"
        : playerAction.label === "Buyout" ? "buyout" : "waived",
      teamId: team.id,
      teamName: team.name,
      playerName: nameParts.join(":"),
      currentYearDeadMoney: playerAction.currentYearDeadMoney,
      totalGuaranteed: playerAction.totalGuaranteed,
      chargeYears: playerAction.chargeYears,
      buyoutPercent: playerAction.buyoutPercent,
      buyoutAmount: playerAction.buyoutAmount,
      setOffCredit: playerAction.setOffCredit,
      stretchRemaining: playerAction.stretchRemaining,
      schedule: playerAction.schedule
    });
  });
  Object.entries(state.extensions).forEach(([playerId, extension]) => {
    const [teamId, ...nameParts] = playerId.split(":");
    const team = getTeam(teamId);
    if (!team) return;
    actions.push({
      actionType: "extension-estimate",
      teamId: team.id,
      teamName: team.name,
      playerName: nameParts.join(":"),
      years: extension.years,
      raisePercent: extension.raisePercent,
      schedule: extension.schedule
    });
  });
  teams.forEach((team) => {
    (team.cap_holds || []).forEach((hold) => {
      const playerId = getPlayerId(team.id, hold.name);
      if (state.reSignedCapHolds[playerId]) {
        actions.push({
          actionType: "re-signed",
          teamId: team.id,
          teamName: team.name,
          playerName: hold.name,
          salary: Number(hold.amount)
        });
      } else if (state.renouncedCapHolds[playerId]) {
        actions.push({
          actionType: "rights-renounced",
          teamId: team.id,
          teamName: team.name,
          playerName: hold.name,
          salary: Number(hold.amount)
        });
      }
    });
  });
  return actions;
}

function getFrontOfficeActionLabel(actionType) {
  return ({
    waived: "Waived",
    stretched: "Stretched",
    buyout: "Buyout",
    "extension-estimate": "Extension estimate",
    "re-signed": "Re-signed",
    "rights-renounced": "Rights renounced"
  })[actionType] || "Front-office action";
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
      contract_years_remaining: player.contract_years_remaining ?? null,
      transactionType: player.signAndTrade ? "sign-and-trade" : "trade",
      signAndTradeContract: player.signAndTrade ? player.signAndTradeContract : undefined,
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
    season: "2026-27",
    verdict: validation.verdict,
    verdictStatus: validation.verdictStatus,
    teams: selectedTeams.map((team) => ({
      id: team.id,
      name: team.name,
      abbreviation: getTeamAbbreviation(team),
      logo: team.logo,
      payroll: Number(team.total_salary || 0)
    })),
    players,
    picks: [...picks, ...swaps],
    frontOfficeActions: getFrontOfficeActions(),
    validation: validation.checks.map(({ title, status, detail }) => ({ title, status, detail })),
    tradeState: {
      teamIds: [...state.teamIds],
      transfers: { ...state.transfers },
      tradeExceptionUses: { ...state.tradeExceptionUses },
      signAndTrades: Object.fromEntries(
        Object.entries(state.signAndTrades).map(([playerId, contract]) => [playerId, { ...contract }])
      ),
      reSignedCapHolds: { ...state.reSignedCapHolds },
      renouncedCapHolds: { ...state.renouncedCapHolds },
      rosterActions: Object.fromEntries(
        Object.entries(state.rosterActions).map(([playerId, action]) => [playerId, { ...action }])
      ),
      extensions: Object.fromEntries(
        Object.entries(state.extensions).map(([playerId, extension]) => [playerId, { ...extension }])
      ),
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

function getTeamCapHoldsTotal(teamId) {
  const team = getTeam(teamId);
  if (!team) return 0;
  return (team.cap_holds || []).reduce((total, hold) => {
    const playerId = getPlayerId(team.id, hold.name);
    if (state.signAndTrades[playerId] || state.renouncedCapHolds[playerId] || state.reSignedCapHolds[playerId]) return total;
    const amount = Number(hold.amount);
    return total + (Number.isFinite(amount) ? amount : 0);
  }, 0);
}

function getTeamTradeExceptions(teamId) {
  const team = getTeam(teamId);
  if (!team) return [];
  return (team.cap_exceptions || [])
    .map((exception, index) => ({
      ...exception,
      id: `${team.id}:tpe:${index}`
    }))
    .filter((exception) =>
      /trade exception/i.test(String(exception.type || ""))
      && Number.isFinite(Number(exception.amount))
      && Number(exception.amount) > 0
    );
}

function getActiveTeamTradeExceptions(teamId) {
  const today = new Date().toISOString().slice(0, 10);
  return getTeamTradeExceptions(teamId).filter((exception) =>
    !exception.expires_on || exception.expires_on >= today
  );
}

function getTeamTradeExceptionUse(teamId, exceptionId, excludePlayerId = "") {
  return Object.entries(state.tradeExceptionUses).reduce((total, [playerId, assignedExceptionId]) => {
    if (assignedExceptionId !== exceptionId
      || playerId === excludePlayerId
      || Number(state.transfers[playerId]) !== Number(teamId)) return total;
    const player = findTransferredPlayer(playerId);
    const salary = Number(player?.salary);
    return total + (Number.isFinite(salary) && salary > 0 ? salary : 0);
  }, 0);
}

function getTeamBaseCapPayroll(teamId) {
  const team = getTeam(teamId);
  return Number(team?.total_salary || 0)
    + Number(team?.dead_money_total || 0)
    + getTeamCapHoldsTotal(teamId)
    + getTeamResignedCapHoldsTotal(teamId)
    + getTeamRosterActionAdjustment(teamId);
}

function isTeamTradeExceptionAvailable(teamId) {
  const exceptions = getActiveTeamTradeExceptions(teamId);
  const exceptionTotal = exceptions.reduce((total, exception) => total + Number(exception.amount), 0);
  if (exceptionTotal <= 0) return false;
  const basePayroll = getTeamBaseCapPayroll(teamId);
  return basePayroll >= CBA_ESTIMATES.salaryCap
    || CBA_ESTIMATES.salaryCap - basePayroll < exceptionTotal;
}

function getAvailableTeamTradeExceptions(teamId, excludePlayerId = "") {
  if (!isTeamTradeExceptionAvailable(teamId)) return [];
  return getActiveTeamTradeExceptions(teamId)
    .map((exception) => ({
      ...exception,
      remainingAmount: Number(exception.amount) - getTeamTradeExceptionUse(teamId, exception.id, excludePlayerId)
    }))
    .filter((exception) => exception.remainingAmount > 0);
}

function getTeamTradeExceptionIncomingSalary(teamId) {
  return Object.entries(state.tradeExceptionUses).reduce((total, [playerId, exceptionId]) => {
    if (!exceptionId || Number(state.transfers[playerId]) !== Number(teamId)) return total;
    const player = findTransferredPlayer(playerId);
    const salary = Number(player?.salary);
    return total + (Number.isFinite(salary) && salary > 0 ? salary : 0);
  }, 0);
}

function getTeamTradeExceptionCapHold(teamId, basePayroll) {
  const exceptions = getActiveTeamTradeExceptions(teamId);
  const originalTotal = exceptions.reduce((total, exception) => total + Number(exception.amount), 0);
  if (basePayroll >= CBA_ESTIMATES.salaryCap
    || CBA_ESTIMATES.salaryCap - basePayroll >= originalTotal) return 0;
  return exceptions.reduce((total, exception) => (
    total + Math.max(0, Number(exception.amount) - getTeamTradeExceptionUse(teamId, exception.id))
  ), 0);
}

function getTeamResignedCapHoldsTotal(teamId) {
  const team = getTeam(teamId);
  if (!team) return 0;
  return (team.cap_holds || []).reduce((total, hold) => {
    if (!state.reSignedCapHolds[getPlayerId(team.id, hold.name)]) return total;
    const amount = Number(hold.amount);
    return total + (Number.isFinite(amount) ? amount : 0);
  }, 0);
}

function getTeamRosterActionAdjustment(teamId) {
  return Object.entries(state.rosterActions).reduce((total, [playerId, action]) => {
    if (Number(playerId.split(":")[0]) !== Number(teamId)) return total;
    const team = getTeam(teamId);
    const playerName = playerId.slice(playerId.indexOf(":") + 1);
    const player = team
      ? [...(team.starters_2026_27 || []), ...(team.bench_2026_27 || [])]
          .find((rosterPlayer) => rosterPlayer.name === playerName)
      : null;
    const salary = Number(player?.salary);
    return total - (Number.isFinite(salary) ? salary : 0) + Number(action.currentYearDeadMoney || 0);
  }, 0);
}

function getTeamCapPayroll(teamId) {
  const basePayroll = getTeamBaseCapPayroll(teamId);
  return basePayroll + getTeamTradeExceptionCapHold(teamId, basePayroll);
}

function getTeamSalaryExcludingCapHolds(teamId) {
  const team = getTeam(teamId);
  if (!team) return 0;
  return getTeamBaseCapPayroll(teamId) - getTeamCapHoldsTotal(teamId);
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
  const contractLabel = player.signAndTrade
    ? `${player.signAndTradeContract.years}-year sign & trade · ${player.signAndTradeContract.raisePercent}% raises`
    : player.pos || "Player";
  return `<div class="review-asset review-asset--player">
    <div class="review-player-asset">
      ${renderReviewPlayerFace(player)}
      <span class="review-player-asset__identity"><strong>${escapeHtml(player.name)}</strong><small>${escapeHtml(contractLabel)}</small></span>
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
  let payrollOutgoing = 0;
  let incoming = 0;

  Object.entries(state.transfers).forEach(([playerId, destinationId]) => {
    const [senderId] = playerId.split(":");
    const player = findTransferredPlayer(playerId);
    if (!player || !hasSalary(player)) return;
    if (Number(senderId) === Number(teamId)) {
      outgoing += player.salary;
      if (!player.signAndTrade) payrollOutgoing += player.salary;
    }
    if (Number(destinationId) === Number(teamId)) incoming += player.salary;
  });

  return { outgoing, payrollOutgoing, incoming };
}

function getTeamPlayerCounts(teamId) {
  let outgoing = 0;
  let incoming = 0;
  Object.entries(state.transfers).forEach(([playerId, destinationId]) => {
    const player = findTransferredPlayer(playerId);
    if (isTwoWayPlayer(player)) return;
    if (Number(playerId.split(":")[0]) === Number(teamId)) outgoing += 1;
    if (Number(destinationId) === Number(teamId)) incoming += 1;
  });
  return { outgoing, incoming };
}

function getApronTier(team) {
  const salary = getTeamSalaryExcludingCapHolds(team.id);
  if (salary >= CBA_ESTIMATES.secondApron) return 2;
  if (salary >= CBA_ESTIMATES.firstApron) return 1;
  return 0;
}

function getSalaryMatchLimit(team, outgoingSalary) {
  if (!TRADE_RULES.salaryMatching) {
    return { maximum: Number.MAX_SAFE_INTEGER, rule: "Salary matching is disabled by your trade sliders." };
  }
  const payroll = getTeamCapPayroll(team.id);
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
      delete state.tradeExceptionUses[playerId];
      delete state.signAndTrades[playerId];
    }
  });
  for (const actions of [state.reSignedCapHolds, state.renouncedCapHolds, state.rosterActions, state.extensions]) {
    Object.keys(actions).forEach((playerId) => {
      if (Number(playerId.split(":")[0]) === Number(teamId)) delete actions[playerId];
    });
  }
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
  const afterTrade = getTeamCapPayroll(team.id) - flow.payrollOutgoing + flow.incoming;
  const salaryAfterTrade = getTeamSalaryExcludingCapHolds(team.id) - flow.payrollOutgoing + flow.incoming;
  const capMetrics = [
    { label: "Cap payroll after trade", value: afterTrade, className: "" },
    { label: "Cap room", value: CBA_ESTIMATES.salaryCap - afterTrade, className: "team-cap-metric--cap" },
    { label: "1st apron room", value: CBA_ESTIMATES.firstApron - salaryAfterTrade, className: "team-cap-metric--apron" },
    { label: "2nd apron room", value: CBA_ESTIMATES.secondApron - salaryAfterTrade, className: "team-cap-metric--apron" },
    { label: "Above minimum", value: salaryAfterTrade - CBA_ESTIMATES.minimumTeamSalary, className: "team-cap-metric--minimum" }
  ];
  const renderRosterRow = (player, index) => {
    const playerId = getPlayerId(team.id, player.name);
    const destinationId = state.transfers[playerId];
    const rosterAction = state.rosterActions[playerId];
    const extension = state.extensions[playerId];
    const salaryLabel = hasSalary(player) ? formatMoney(player.salary) : "Unavailable";
    const salaryTitle = [player.salary_source, player.contract_note].filter(Boolean).join(" · ") || "2026–27 salary";
    const yearsRemaining = getContractYearsRemaining(player);
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
    const salaryNote = rosterAction
      ? `${rosterAction.label} · Dead cap ${formatMoney(rosterAction.currentYearDeadMoney)}`
      : extension
        ? `Extension estimate · ${formatMoney(extension.schedule[0].salary)} in 2027–28`
        : "";

    return `
      <div class="roster-row ${destinationId ? "roster-row--selected" : ""} ${rosterAction ? "roster-row--waived" : ""} ${index < 3 ? "roster-row--top-salary" : ""}">
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
        <span class="roster-salary" title="${escapeHtml(salaryTitle)}">${salaryLabel}<span class="contract-years-label">${yearsRemaining === null ? "Years unavailable" : `${yearsRemaining} yr${yearsRemaining === 1 ? "" : "s"} remaining`}</span>${salaryNote ? `<span class="contract-note">${escapeHtml(salaryNote)}</span>` : ""}</span>
        <div class="roster-action">
          ${destinationSelect}
          <button type="button" class="trade-toggle ${destinationId ? "is-selected" : ""}" data-player="${escapeHtml(playerId)}" ${hasSalary(player) && destinations.length && !rosterAction ? "" : "disabled"}>${destinationId ? "Added" : "Trade"}</button>
          <details class="asset-action-menu roster-action-menu">
            <summary aria-label="Actions for ${escapeHtml(player.name)}">Actions</summary>
            <div class="asset-action-menu__items" role="group" aria-label="${escapeHtml(player.name)} actions">
              ${rosterAction
                ? `<button type="button" class="roster-player-action" data-action="undo-waive" data-player="${escapeHtml(playerId)}">Undo ${escapeHtml(rosterAction.label.toLowerCase())}</button>`
                : `<button type="button" class="roster-player-action" data-action="waive" data-player="${escapeHtml(playerId)}">Waive, stretch or buy out</button>`}
              <button type="button" class="roster-player-action" data-action="extend" data-player="${escapeHtml(playerId)}">${extension ? "Edit extension estimate" : "Extend contract"}</button>
              <button type="button" class="roster-player-action" data-action="profile" data-player="${escapeHtml(playerId)}">Player profile</button>
              <button type="button" class="roster-player-action" data-action="compare" data-player="${escapeHtml(playerId)}">Compare players</button>
            </div>
          </details>
        </div>
      </div>
    `;
  };
  const rosterRows = getTeamActiveRosterPlayers(team).map(renderRosterRow).join("");
  const twoWayRows = getTeamTwoWayPlayers(team).map((player, index) =>
    renderRosterRow(player, getTeamActiveRosterPlayers(team).length + index)
  ).join("");

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
  const capExceptions = Array.isArray(team.cap_exceptions) ? team.cap_exceptions : [];
  const capHolds = Array.isArray(team.cap_holds) ? team.cap_holds : [];
  const assetContent = activeView === "picks"
    ? `<div class="roster-table"><div class="roster-row roster-row--header"><span>Draft asset</span><span>Type</span><span>Trade destination</span></div>${picks.length ? pickRows : '<div class="team-empty">No draft picks returned by the API.</div>'}</div>`
    : activeView === "exceptions" || activeView === "cap_holds"
      ? renderCapAssetPanel(team, activeView)
      : `<div class="roster-table">
          <div class="roster-row roster-row--header"><span>Player</span><span>2026–27 Salary ↓</span><span>Trade destination</span></div>
          ${rosterRows || '<div class="team-empty">No standard roster players returned by the API.</div>'}
          ${twoWayRows ? `<div class="two-way-section-heading"><span>TWO-WAY</span><small>Outside the standard 15-man roster count</small></div>${twoWayRows}` : ""}
        </div>`;
  const assetPeriod = {
    roster: "2026–27 salary",
    picks: "Tradeable draft assets",
    exceptions: "Exception balances",
    cap_holds: "Unsigned player holds"
  }[activeView] || "2026–27 salary";
  const outgoingPlayers = Object.keys(state.transfers)
    .filter((playerId) => Number(playerId.split(":")[0]) === Number(team.id))
    .map(findTransferredPlayer)
    .filter(Boolean);
  const incomingPlayers = Object.entries(state.transfers)
    .filter(([, destinationId]) => Number(destinationId) === Number(team.id))
    .map(([playerId]) => findTransferredPlayer(playerId))
    .filter(Boolean);
  const incomingEntries = Object.entries(state.transfers)
    .filter(([, destinationId]) => Number(destinationId) === Number(team.id))
    .map(([playerId]) => ({ playerId, player: findTransferredPlayer(playerId) }))
    .filter(({ player }) => player);
  const renderMovePills = (players) => players.length
    ? players.slice(0, 4).map((player) => `<span>${escapeHtml(player.name)} · ${escapeHtml(formatCompactMoney(Number(player.salary) || 0))}</span>`).join("")
      + (players.length > 4 ? `<span>+${players.length - 4} more</span>` : "")
    : '<small>No players selected</small>';
  const payrollScaleMax = CBA_ESTIMATES.secondApron * 1.15;
  const currentSalary = getTeamSalaryExcludingCapHolds(team.id);
  const payrollFillPercent = Math.min(100, Math.max(0, salaryAfterTrade / payrollScaleMax * 100));
  const apronStatus = salaryAfterTrade <= CBA_ESTIMATES.firstApron
    ? `${formatMoney(CBA_ESTIMATES.firstApron - salaryAfterTrade)} below the 1st apron`
    : salaryAfterTrade <= CBA_ESTIMATES.secondApron
      ? `${formatMoney(CBA_ESTIMATES.secondApron - salaryAfterTrade)} below the 2nd apron`
      : `${formatMoney(salaryAfterTrade - CBA_ESTIMATES.secondApron)} above the 2nd apron`;
  const teamMovementSummary = outgoingPlayers.length || incomingPlayers.length
    ? `<div class="team-move-summary">
        <section><span>Sending</span><div>${renderMovePills(outgoingPlayers)}</div></section>
        <section><span>Receiving</span><div>${renderMovePills(incomingPlayers)}</div>${renderTradeExceptionControls(team, incomingEntries)}</section>
      </div>`
    : "";

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
        <div>${renderTeamMetricAmount(payroll)}<span>Roster salary</span></div>
        <div>${renderTeamMetricAmount(flow.outgoing, "-", "money-out")}<span>Outgoing</span></div>
        <div>${renderTeamMetricAmount(flow.incoming, "+", "money-in")}<span>Incoming</span></div>
        <div>${renderTeamMetricAmount(afterTrade)}<span>Cap payroll</span></div>
      </div>
      <section class="team-payroll-track" aria-label="${escapeHtml(team.name)} apron salary movement">
        <div class="team-payroll-track__heading"><span>APRON SALARY MOVEMENT</span><strong>${escapeHtml(formatCompactMoney(currentSalary))} <i aria-hidden="true">→</i> ${escapeHtml(formatCompactMoney(salaryAfterTrade))}</strong></div>
        <div class="team-payroll-track__bar" role="img" aria-label="Apron salary after trade at ${Math.round(payrollFillPercent)} percent of the displayed scale">
          <span style="width:${payrollFillPercent}%"></span>
          <i class="team-payroll-track__mark team-payroll-track__mark--first" style="left:${CBA_ESTIMATES.firstApron / payrollScaleMax * 100}%"></i>
          <i class="team-payroll-track__mark team-payroll-track__mark--second" style="left:${CBA_ESTIMATES.secondApron / payrollScaleMax * 100}%"></i>
        </div>
        <p>After this deal: ${escapeHtml(apronStatus)}</p>
      </section>
      ${teamMovementSummary}
      <section class="team-cap-outlook" aria-label="${escapeHtml(team.name)} cap outlook after trade">
        <div class="team-cap-outlook__heading">
          <strong>Team cap outlook</strong>
          <span>2026–27 · holds/TPEs affect cap room, not apron salary</span>
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
        <button type="button" class="asset-tab ${activeView === "roster" ? "is-active" : ""}" data-view="roster" data-team="${team.id}" role="tab" aria-selected="${activeView === "roster"}">Roster <span>${getTeamActiveRosterPlayers(team).length}</span></button>
        <button type="button" class="asset-tab ${activeView === "picks" ? "is-active" : ""}" data-view="picks" data-team="${team.id}" role="tab" aria-selected="${activeView === "picks"}">Picks <span>${picks.length}</span></button>
        <button type="button" class="asset-tab ${activeView === "exceptions" ? "is-active" : ""}" data-view="exceptions" data-team="${team.id}" role="tab" aria-selected="${activeView === "exceptions"}">Exceptions <span>${capExceptions.length}</span></button>
        <button type="button" class="asset-tab ${activeView === "cap_holds" ? "is-active" : ""}" data-view="cap_holds" data-team="${team.id}" role="tab" aria-selected="${activeView === "cap_holds"}">Cap holds <span>${capHolds.length}</span></button>
        <span class="asset-period">${escapeHtml(assetPeriod)}</span>
      </div>
      ${assetContent}
    </section>
  `;
}

async function loadRumorWatch() {
  try {
    const response = await fetch(`${API_URL}/api/v1/trade-machine/rumors`);
    const payload = await response.json();
    if (response.ok && Array.isArray(payload.players)) {
      rumorWatchPlayers = payload.players;
      renderTrendingPlayers();
    }
  } catch (error) {
    console.warn("Trade rumor watch could not be loaded.", error);
  }
}

function renderTrendingPlayers() {
  if (!trendingPlayersEl) return;
  const fallbackRumoredNames = [
    "Dejounte Murray",
    "Anthony Davis",
    "Trey Murphy III",
    "Naz Reid",
    "Wendell Carter Jr.",
    "Paolo Banchero",
    "Kyrie Irving",
    "Jalen Green",
    "Herbert Jones",
    "Tre Jones",
    "Zion Williamson",
    "Kristaps Porzingis",
    "Isaiah Collier",
    "Lauri Markkanen"
  ];
  const rumoredNames = rumorWatchPlayers.length
    ? rumorWatchPlayers.map((rumor) => rumor.player_name)
    : fallbackRumoredNames;
  const rumoredPlayers = rumoredNames.map((name) => {
    const normalizedName = normalizePlayerName(name);
    for (const team of teams) {
      const player = getTeamPlayers(team).find((item) =>
        normalizePlayerName(item.name) === normalizedName
      );
      if (player) return { player, team };
    }
    return null;
  }).filter(Boolean);

  trendingPlayersEl.innerHTML = rumoredPlayers.map(({ player, team }, index) => `
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
      <span class="trending-player__stats">TRADE WATCH</span>
    </button>
  `).join("");

  trendingPlayersEl.querySelectorAll(".trending-player").forEach((button) => {
    button.addEventListener("click", () => openPlayerProfile(button.dataset.playerName, Number(button.dataset.teamId)));
  });
}

function getRosterOrCapHoldPlayer(teamId, playerName) {
  const team = getTeam(teamId);
  if (!team) return null;
  const rosterPlayer = findRosterPlayer(team, playerName);
  if (rosterPlayer) return { team, player: rosterPlayer };
  const hold = (team.cap_holds || []).find((item) => item.name === playerName);
  if (!hold) return null;
  return {
    team,
    player: {
      name: hold.name,
      salary: Number(hold.amount),
      pos: "Cap hold",
      contract_note: hold.description || "Unsigned-player rights hold"
    }
  };
}

function getContractYearsRemaining(player) {
  const rawYears = player?.contract_years_remaining;
  if (rawYears === null || rawYears === undefined || rawYears === "") return null;
  const years = Number(rawYears);
  return Number.isInteger(years) && years >= 0 && years <= 15 ? years : null;
}

function formatSeasonMetric(value, digits = 1, suffix = "") {
  const number = Number(value);
  return value !== null && value !== undefined && Number.isFinite(number)
    ? `${number.toFixed(digits)}${suffix}`
    : "—";
}

function openPlayerProfile(playerName, teamId = null) {
  const rosterEntry = teamId === null
    ? teams.map((team) => getRosterOrCapHoldPlayer(team.id, playerName)).find(Boolean)
    : getRosterOrCapHoldPlayer(teamId, playerName);
  if (!rosterEntry?.player) throw new Error(`Roster or cap-hold data unavailable for player: ${playerName}`);

  const { team, player } = rosterEntry;
  const hasSeasonStats = Number(player.gp) > 0 && Boolean(player.stats_season);
  const season = player.stats_season || "Current season";
  const statsAsOf = player.stats_as_of ? ` · through ${player.stats_as_of}` : "";
  const stats = [
    ["GP", player.gp, 0, ""],
    ["PTS", player.pts, 1, ""],
    ["REB", player.reb, 1, ""],
    ["AST", player.ast, 1, ""],
    ["STL", player.stl, 1, ""],
    ["BLK", player.blk, 1, ""],
    ["TOV", player.tov, 1, ""],
    ["FG%", player.fg, 1, "%"],
    ["3P%", player.fg3, 1, "%"],
    ["FT%", player.ft, 1, "%"]
  ];

  playerProfileDialog.dataset.teamTheme = getTeamAbbreviation(team);
  playerProfileContentEl.innerHTML = `
    <article class="player-career-profile">
      <header class="player-career-profile__header">
        <img class="player-career-profile__headshot" src="${escapeHtml(getPlayerHeadshotUrl(player.name))}" alt="" onerror="this.hidden=true">
        <div class="player-career-profile__identity">
          <span>${escapeHtml(team.name.toUpperCase())}</span>
          <h2 id="playerProfileName">${escapeHtml(player.name)}</h2>
          <p>${escapeHtml(player.pos || "Position unavailable")} · ${escapeHtml(season)} regular season</p>
        </div>
        <img class="player-career-profile__logo" src="${escapeHtml(team.logo || "")}" alt="" onerror="this.hidden=true">
        <button type="button" class="icon-button player-career-profile__close" aria-label="Close player card" title="Close">×</button>
      </header>
      <section class="player-career-profile__summary" aria-label="${escapeHtml(season)} regular-season stats">
        ${stats.map(([label, value, digits, suffix]) => `
          <div><strong>${escapeHtml(hasSeasonStats ? formatSeasonMetric(value, digits, suffix) : "—")}</strong><span>${label}</span></div>
        `).join("")}
      </section>
      <footer class="player-career-profile__footer">
        <span>${escapeHtml(`${season} static stats${statsAsOf}`)}</span>
        <button type="button" class="button button--primary player-career-profile__done">Done</button>
      </footer>
    </article>
  `;
  playerProfileContentEl.querySelector(".player-career-profile__close").addEventListener("click", () => playerProfileDialog.close());
  playerProfileContentEl.querySelector(".player-career-profile__done").addEventListener("click", () => playerProfileDialog.close());
  playerProfileDialog.showModal();
}

function getPlayerRef(playerId) {
  const [teamId, ...nameParts] = playerId.split(":");
  return getRosterOrCapHoldPlayer(Number(teamId), nameParts.join(":"));
}

function getPlayerCompareOptions() {
  return teams.flatMap((team) => {
    const roster = getTeamPlayers(team).map((player) => ({ team, player }));
    const holds = (team.cap_holds || [])
      .filter((hold) => isPlayerCapHold(hold))
      .map((hold) => getRosterOrCapHoldPlayer(team.id, hold.name))
      .filter(Boolean);
    const players = [...roster, ...holds];
    return players
      .filter(({ player }, index) => players.findIndex((entry) => entry.player.name === player.name) === index)
      .map(({ player }) => ({ id: getPlayerId(team.id, player.name), name: player.name, team }));
  });
}

function renderPlayerCompare() {
  const first = getPlayerRef(playerCompareSelection.firstId);
  const second = getPlayerRef(playerCompareSelection.secondId);
  if (!first?.player || !second?.player) throw new Error("Player comparison data is unavailable.");
  const stats = [
    ["2026–27 salary", (player) => hasSalary(player) ? formatMoney(player.salary) : "Unavailable"],
    ["PPG", (player) => player.stats_season && Number.isFinite(Number(player.pts)) ? Number(player.pts).toFixed(1) : "—"],
    ["RPG", (player) => player.stats_season && Number.isFinite(Number(player.reb)) ? Number(player.reb).toFixed(1) : "—"],
    ["APG", (player) => player.stats_season && Number.isFinite(Number(player.ast)) ? Number(player.ast).toFixed(1) : "—"],
    ["SPG", (player) => player.stats_season && Number.isFinite(Number(player.stl)) ? Number(player.stl).toFixed(1) : "—"],
    ["BPG", (player) => player.stats_season && Number.isFinite(Number(player.blk)) ? Number(player.blk).toFixed(1) : "—"]
  ];
  const options = getPlayerCompareOptions();
  playerCompareContentEl.innerHTML = `
    <article class="player-profile player-compare">
      <header class="player-profile__header">
        <div><span class="player-profile__eyebrow">TRADE DESK</span><h2>Compare players</h2></div>
        <button type="button" class="icon-button player-compare__close" aria-label="Close comparison" title="Close">×</button>
      </header>
      <label class="player-compare__select">
        <span>Compare ${escapeHtml(first.player.name)} with</span>
        <select class="player-compare__opponent">${options
          .filter((option) => option.id !== playerCompareSelection.firstId)
          .map((option) => `<option value="${escapeHtml(option.id)}" ${option.id === playerCompareSelection.secondId ? "selected" : ""}>${escapeHtml(option.name)} · ${escapeHtml(option.team.name)}</option>`)
          .join("")}</select>
      </label>
      <div class="player-compare__teams">
        <div><strong>${escapeHtml(first.player.name)}</strong><span>${escapeHtml(first.team.name)}</span></div>
        <div><strong>${escapeHtml(second.player.name)}</strong><span>${escapeHtml(second.team.name)}</span></div>
      </div>
      <div class="player-compare__stats">
        ${stats.map(([label, format]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(format(first.player))}</strong><strong>${escapeHtml(format(second.player))}</strong></div>`).join("")}
      </div>
    </article>
  `;
  playerCompareContentEl.querySelector(".player-compare__close").addEventListener("click", () => playerCompareDialog.close());
  playerCompareContentEl.querySelector(".player-compare__opponent").addEventListener("change", (event) => {
    playerCompareSelection.secondId = event.currentTarget.value;
    renderPlayerCompare();
  });
  if (!playerCompareDialog.open) playerCompareDialog.showModal();
}

function openPlayerCompare(playerId) {
  const first = getPlayerRef(playerId);
  const options = getPlayerCompareOptions().filter((option) => option.id !== playerId);
  if (!first?.player || !options.length) {
    showTradeToast("There is no second player available to compare.");
    return;
  }
  playerCompareSelection = { firstId: playerId, secondId: options[0].id };
  renderPlayerCompare();
}

function getExtensionSchedule(firstYearSalary, years, raisePercent) {
  const annualRaise = Math.round(firstYearSalary * raisePercent / 100);
  return Array.from({ length: years }, (_, index) => ({
    season: `${2027 + index}–${String(2028 + index).slice(-2)}`,
    salary: firstYearSalary + annualRaise * index
  }));
}

function getSeasonLabel(offset = 0) {
  const firstYear = Number(CBA_ESTIMATES.season.slice(0, 4)) + offset;
  return `${firstYear}–${String((firstYear + 1) % 100).padStart(2, "0")}`;
}

function calculateWaivePreview(form, currentSalary) {
  const totalGuaranteed = Math.min(300_000_000, Math.max(0, Math.round(Number(form.elements.guaranteedAmount.value) || 0)));
  const guaranteedSeasons = Math.min(5, Math.max(0, Math.floor(Number(form.elements.guaranteedSeasons.value) || 0)));
  const move = form.elements.move.value;
  const buyoutPercent = move === "buyout" ? Math.min(100, Math.max(0, Number(form.elements.buyoutPercent.value) || 0)) : 0;
  const setOffCredit = form.elements.setOffEnabled.checked
    ? Math.min(totalGuaranteed, Math.max(0, Math.round(Number(form.elements.setOffCredit.value) || 0)))
    : 0;
  const buyoutAmount = Math.round(totalGuaranteed * buyoutPercent / 100);
  const deadMoney = Math.max(0, totalGuaranteed - buyoutAmount - setOffCredit);
  const stretchRemaining = move === "stretched"
    || (move === "buyout" && form.elements.stretchRemaining.checked);
  const seasonsOwed = Math.max(1, guaranteedSeasons);
  const chargeYears = stretchRemaining ? Math.min(11, 2 * seasonsOwed + 1) : seasonsOwed;
  const baseCharge = Math.floor(deadMoney / chargeYears);
  const remainder = deadMoney - baseCharge * chargeYears;
  const schedule = Array.from({ length: chargeYears }, (_, index) => ({
    season: getSeasonLabel(index),
    salary: baseCharge + (index === 0 ? remainder : 0)
  }));
  return {
    move,
    totalGuaranteed,
    guaranteedSeasons,
    buyoutPercent,
    buyoutAmount,
    setOffCredit,
    stretchRemaining,
    chargeYears,
    currentYearDeadMoney: schedule[0]?.salary || 0,
    totalDeadMoney: deadMoney,
    schedule,
    savings: currentSalary - (schedule[0]?.salary || 0)
  };
}

function updateWaivePreview(form, currentSalary) {
  const preview = calculateWaivePreview(form, currentSalary);
  const isBuyout = preview.move === "buyout";
  const isStretched = preview.stretchRemaining;
  form.querySelector(".buyout-control").hidden = !isBuyout;
  form.querySelector(".buyout-stretch-control").hidden = !isBuyout;

  const percentLabel = form.querySelector("[data-buyout-percent-label]");
  percentLabel.textContent = `PLAYER GIVES BACK ${preview.buyoutPercent}% (${formatMoney(preview.buyoutAmount)})`;
  form.querySelector("[data-dead-money-rows]").innerHTML = preview.schedule.map((item, index) => `
    <tr><th scope="row">${escapeHtml(index === 0 ? `${item.season} · this season` : item.season)}</th><td>${formatMoney(item.salary)}</td><td>${formatMoney(item.salary)}</td></tr>
  `).join("");
  form.querySelector("[data-waive-current]").textContent = formatMoney(preview.currentYearDeadMoney);
  form.querySelector("[data-waive-total]").textContent = formatMoney(preview.totalDeadMoney);
  form.querySelector("[data-waive-years]").textContent = String(preview.chargeYears);
  form.querySelector("[data-waive-savings]").textContent = `${preview.savings >= 0 ? "saves " : "adds "}${formatMoney(Math.abs(preview.savings))}`;
  form.querySelector("[data-waive-total-note]").textContent = isBuyout
    ? `after ${formatMoney(preview.buyoutAmount)} given back${preview.setOffCredit ? ` and ${formatMoney(preview.setOffCredit)} estimated set-off` : ""}`
    : "based on the amount entered";
  form.querySelector("[data-waive-method-note]").textContent = isStretched
    ? `Stretch estimate: ${formatMoney(preview.totalDeadMoney)} spread over ${preview.chargeYears} seasons. Actual eligibility and timing are not verified.`
    : "Waived without stretching: guaranteed money stays on the books in the season schedule shown above.";
  form.querySelector("[data-waive-setoff-note]").textContent = form.elements.setOffEnabled.checked
    ? "Set-off is a user-entered estimate and applies only if the player signs elsewhere."
    : "Set-off would reduce what is owed only if the player signs elsewhere.";
  form.querySelector(".front-office-submit").textContent = isBuyout
    ? "Apply buyout"
    : preview.move === "stretched" ? "Waive & stretch" : "Waive";
  return preview;
}

function renderFrontOfficeForm() {
  const playerRef = getPlayerRef(pendingFrontOfficeAction.playerId);
  if (!playerRef?.player) throw new Error("Player data is unavailable for this action.");
  const { player, team } = playerRef;
  const extension = state.extensions[pendingFrontOfficeAction.playerId];
  const isExtension = pendingFrontOfficeAction.action === "extend";
  const salary = hasSalary(player) ? Math.round(player.salary) : 0;
  const contractYearsRemaining = getContractYearsRemaining(player);
  frontOfficeDialog.dataset.teamTheme = getTeamAbbreviation(team);
  frontOfficeContentEl.innerHTML = `
    <form class="front-office-form" id="frontOfficeForm" data-action="${isExtension ? "extend" : "waive"}">
      <header class="sign-trade-header ${isExtension ? "" : "waive-dialog-header"}">
        ${isExtension ? "" : `<img class="waive-dialog-header__player" src="${escapeHtml(getPlayerHeadshotUrl(player.name))}" alt="" onerror="this.hidden=true">`}
        <div class="sign-trade-header__identity">
          <span>${escapeHtml(team.name)} · FRONT OFFICE</span>
          <h2>${escapeHtml(isExtension ? `Extend ${player.name}` : `Release ${player.name}`)}</h2>
          ${isExtension ? "" : `<p>${escapeHtml(formatMoney(salary))} this season · guarantee details not reported</p>`}
        </div>
        ${isExtension || !team.logo ? "" : `<img class="waive-dialog-header__logo" src="${escapeHtml(team.logo)}" alt="" onerror="this.hidden=true">`}
        <button type="button" class="icon-button front-office-close" aria-label="Close action dialog">×</button>
      </header>
      <div class="front-office-form__body">
        ${isExtension
          ? `<p class="front-office-form__note">${contractYearsRemaining === null
            ? "ESPN has not reported this player's remaining contract years. "
            : `ESPN reports ${contractYearsRemaining} season${contractYearsRemaining === 1 ? "" : "s"} remaining. `
          }Years remaining alone do not confirm extension eligibility; bonuses, guarantees, and CBA limits are not verified. This is a what-if estimate and current-season salary does not change.</p>
            <label><span>Extension length</span><select name="years">${[1, 2, 3, 4].map((years) => `<option value="${years}" ${(extension?.years || 2) === years ? "selected" : ""}>${years} year${years === 1 ? "" : "s"}</option>`).join("")}</select></label>
            <label><span>2027–28 starting salary</span><input name="firstYearSalary" type="number" min="0" max="100000000" step="1000" required value="${extension?.schedule?.[0]?.salary ?? Math.round(salary * 1.05)}"></label>
            <label><span>Annual raise (%)</span><select name="raisePercent">${[0, 5, 8].map((percent) => `<option value="${percent}" ${(extension?.raisePercent ?? 5) === percent ? "selected" : ""}>${percent}%</option>`).join("")}</select></label>`
          : `<div class="waive-simulation-body">
              <p class="front-office-form__note">Simulation only. Enter the remaining guarantee and seasons; ESPN does not provide verified guarantee schedules, buyout terms, or stretch eligibility.</p>
              <fieldset class="waive-action-options">
                <legend class="sr-only">Choose a roster action</legend>
                <label class="waive-action-card"><input type="radio" name="move" value="waived" checked><span><strong>Waive</strong><small>Guaranteed money stays on the books in the seasons owed.</small></span></label>
                <label class="waive-action-card"><input type="radio" name="move" value="stretched"><span><strong>Waive &amp; stretch</strong><small>Spread the remaining amount over twice the owed seasons plus one.</small></span></label>
                <label class="waive-action-card"><input type="radio" name="move" value="buyout"><span><strong>Buyout</strong><small>Player gives back part of the guarantee; stretch the rest if selected.</small></span></label>
              </fieldset>
              <div class="waive-guarantee-fields">
                <label><span>Remaining guaranteed amount</span><input name="guaranteedAmount" type="number" min="0" max="300000000" step="1000" required value="0"></label>
                <label><span>Seasons owed (0 = this season)</span><input name="guaranteedSeasons" type="number" min="0" max="5" step="1" value="0"></label>
              </div>
              <label class="waive-buyout-control buyout-control" hidden>
                <span data-buyout-percent-label>PLAYER GIVES BACK 20% ($0)</span>
                <input name="buyoutPercent" type="range" min="0" max="100" step="1" value="20">
              </label>
              <label class="waive-setoff-toggle"><input name="setOffEnabled" type="checkbox"><span>What if he signs elsewhere? <strong>Set-off</strong></span></label>
              <label class="waive-setoff-credit" hidden><span>Estimated set-off credit</span><input name="setOffCredit" type="number" min="0" max="300000000" step="1000" value="0"></label>
              <label class="waive-buyout-stretch buyout-stretch-control" hidden><input name="stretchRemaining" type="checkbox"><span>Stretch the rest</span></label>
              <section class="waive-dead-money">
                <h3>Dead money by season</h3>
                <div class="waive-dead-money__table"><table><thead><tr><th>Season</th><th>Owed</th><th>On the books</th></tr></thead><tbody data-dead-money-rows></tbody></table></div>
              </section>
              <section class="waive-summary">
                <div><span>This season</span><strong data-waive-current>$0</strong><small data-waive-savings>saves ${formatMoney(salary)}</small></div>
                <div><span>Total dead money</span><strong data-waive-total>$0</strong><small data-waive-total-note>based on the amount entered</small></div>
                <div><span>Seasons</span><strong data-waive-years>1</strong><small>on the books</small></div>
              </section>
              <p class="waive-method-note" data-waive-method-note>Waived without stretching: guaranteed money stays on the books in the season schedule shown above.</p>
              <p class="waive-setoff-note" data-waive-setoff-note>Set-off would reduce what is owed only if the player signs elsewhere.</p>
            </div>`
        }
      </div>
      <footer class="sign-trade-footer">
        ${isExtension ? "" : '<span class="waive-footer-note">This is a roster and cap simulation; verify the final charge before submitting.</span>'}
        <button type="button" class="button button--ghost front-office-cancel">Cancel</button>
        <button type="submit" class="button button--primary front-office-submit">${isExtension ? "Save estimate" : "Waive"}</button>
      </footer>
    </form>
  `;
  frontOfficeContentEl.querySelector(".front-office-close").addEventListener("click", () => frontOfficeDialog.close());
  frontOfficeContentEl.querySelector(".front-office-cancel").addEventListener("click", () => frontOfficeDialog.close());
  const form = frontOfficeContentEl.querySelector("form");
  form.addEventListener("submit", saveFrontOfficeAction);
  if (!isExtension) {
    const updatePreview = () => updateWaivePreview(form, salary);
    form.addEventListener("input", updatePreview);
    form.addEventListener("change", (event) => {
      if (event.target.name === "setOffEnabled") {
        form.querySelector(".waive-setoff-credit").hidden = !event.target.checked;
      }
      updatePreview();
    });
    updatePreview();
  }
  frontOfficeDialog.showModal();
}

function openFrontOfficeAction(playerId, action) {
  pendingFrontOfficeAction = { playerId, action };
  renderFrontOfficeForm();
}

function saveFrontOfficeAction(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const { playerId, action } = pendingFrontOfficeAction;
  const playerRef = getPlayerRef(playerId);
  if (!playerRef?.player) throw new Error("Player data is unavailable for this action.");

  if (action === "extend") {
    const firstYearSalary = Math.round(Number(form.elements.firstYearSalary.value));
    const years = Number(form.elements.years.value);
    const raisePercent = Number(form.elements.raisePercent.value);
    state.extensions[playerId] = {
      firstYearSalary,
      years,
      raisePercent,
      schedule: getExtensionSchedule(firstYearSalary, years, raisePercent)
    };
    showTradeToast(`${playerRef.player.name} extension estimate saved for ${years} season${years === 1 ? "" : "s"}.`);
  } else {
    const preview = calculateWaivePreview(form, Number(playerRef.player.salary) || 0);
    const move = preview.move;
    state.rosterActions[playerId] = {
      label: move === "stretched" ? "Stretched" : move === "buyout" ? "Buyout" : "Waived",
      totalGuaranteed: preview.totalGuaranteed,
      chargeYears: preview.chargeYears,
      currentYearDeadMoney: preview.currentYearDeadMoney,
      buyoutPercent: preview.buyoutPercent,
      buyoutAmount: preview.buyoutAmount,
      setOffCredit: preview.setOffCredit,
      stretchRemaining: preview.stretchRemaining,
      schedule: preview.schedule
    };
    delete state.transfers[playerId];
    delete state.tradeExceptionUses[playerId];
    delete state.signAndTrades[playerId];
    showTradeToast(`${playerRef.player.name} ${move === "stretched" ? "stretch" : move === "buyout" ? "buyout" : "waiver"} simulation applied.`);
  }

  frontOfficeDialog.close();
  pendingFrontOfficeAction = null;
  renderTradeBoard();
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

  teamGridEl.querySelectorAll(".asset-action-menu").forEach((menu) => {
    menu.addEventListener("toggle", () => {
      menu.closest(".roster-row, .cap-asset-row")?.classList.toggle("asset-menu-row-open", menu.open);
      if (!menu.open) return;
      const bounds = menu.getBoundingClientRect();
      const menuHeight = menu.querySelector(".asset-action-menu__items")?.scrollHeight || 0;
      const fitsBelow = window.innerHeight - bounds.bottom >= menuHeight + 12;
      const fitsAbove = bounds.top >= menuHeight + 12;
      menu.classList.toggle("asset-action-menu--above", !fitsBelow && fitsAbove);
      menu.classList.toggle("asset-action-menu--mobile", window.innerWidth <= 650);
    });
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

  teamGridEl.querySelectorAll(".cap-hold-action").forEach((button) => {
    button.addEventListener("click", () => {
      const playerRef = getPlayerRef(button.dataset.player);
      const player = playerRef?.player;
      const [teamId] = button.dataset.player.split(":");
      const team = getTeam(teamId);
      const action = button.dataset.action;
      if (!team || !player) throw new Error("Cap-hold action data is unavailable.");
      const hold = team.cap_holds?.find((item) => item.name === player.name);
      if (!hold) throw new Error(`Cap hold not found for ${player.name}.`);
      if (action === "sign-trade") {
        renderSignTradeDialog(team.id, hold);
      } else if (action === "resign") {
        if (state.reSignedCapHolds[button.dataset.player]) {
          delete state.reSignedCapHolds[button.dataset.player];
          showTradeToast(`${player.name} re-sign simulation removed.`);
        } else {
          state.reSignedCapHolds[button.dataset.player] = true;
          delete state.renouncedCapHolds[button.dataset.player];
          showTradeToast(`${player.name} added to ${team.name} at the listed cap-hold amount.`);
        }
        renderTradeBoard();
      } else if (action === "renounce") {
        if (state.renouncedCapHolds[button.dataset.player]) {
          delete state.renouncedCapHolds[button.dataset.player];
          showTradeToast(`${player.name} rights restored.`);
        } else {
          state.renouncedCapHolds[button.dataset.player] = true;
          delete state.signAndTrades[button.dataset.player];
          delete state.transfers[button.dataset.player];
          delete state.tradeExceptionUses[button.dataset.player];
          showTradeToast(`${player.name} cap hold removed from the simulation.`);
        }
        renderTradeBoard();
      } else if (action === "profile") {
        openPlayerProfile(player.name, team.id);
      } else if (action === "compare") {
        openPlayerCompare(button.dataset.player);
      }
    });
  });

  teamGridEl.querySelectorAll(".trade-toggle[data-player]").forEach((button) => {
    button.addEventListener("click", () => {
      const playerId = button.dataset.player;
      if (state.transfers[playerId]) {
        delete state.transfers[playerId];
        delete state.tradeExceptionUses[playerId];
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

  teamGridEl.querySelectorAll(".roster-player-action").forEach((button) => {
    button.addEventListener("click", () => {
      const playerId = button.dataset.player;
      const action = button.dataset.action;
      const playerRef = getPlayerRef(playerId);
      if (!playerRef?.player) throw new Error("Roster action data is unavailable.");
      if (action === "waive") {
        openFrontOfficeAction(playerId, "waive");
      } else if (action === "extend") {
        openFrontOfficeAction(playerId, "extend");
      } else if (action === "profile") {
        openPlayerProfile(playerRef.player.name, playerRef.team.id);
      } else if (action === "compare") {
        openPlayerCompare(playerId);
      } else if (action === "undo-waive") {
        delete state.rosterActions[playerId];
        renderTradeBoard();
        showTradeToast(`${playerRef.player.name} waiver/buyout simulation removed.`);
      }
    });
  });

  teamGridEl.querySelectorAll(".destination-select[data-player]").forEach((select) => {
    select.addEventListener("change", () => {
      const playerId = select.dataset.player;
      if (Number(state.transfers[playerId]) !== Number(select.value)) {
        delete state.tradeExceptionUses[playerId];
      }
      state.transfers[playerId] = Number(select.value);
      if (state.signAndTrades[playerId]) {
        state.signAndTrades[playerId].toTeamId = Number(select.value);
      }
      renderTradeBoard();
    });
  });

  teamGridEl.querySelectorAll(".tpe-use-select[data-tpe-player]").forEach((select) => {
    select.addEventListener("change", () => {
      const playerId = select.dataset.tpePlayer;
      if (select.value) {
        state.tradeExceptionUses[playerId] = select.value;
      } else {
        delete state.tradeExceptionUses[playerId];
      }
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

function updateGuestTradeNotice() {
  const signedIn = Boolean(window.NBAHubAuth?.isSignedIn());
  if (guestTradeNoticeEl) guestTradeNoticeEl.hidden = signedIn;
}

window.addEventListener("nba-hub-auth-ready", updateGuestTradeNotice);
window.addEventListener("nba-hub-auth-changed", updateGuestTradeNotice);

function findTransferredPlayer(playerId) {
  const [senderId, ...nameParts] = playerId.split(":");
  const sender = getTeam(senderId);
  const playerName = nameParts.join(":");
  const rosterPlayer = sender && getTeamPlayers(sender).find((player) => player.name === playerName);
  if (rosterPlayer) return rosterPlayer;

  const contract = state.signAndTrades[playerId];
  const hold = sender?.cap_holds?.find((item) => item.name === playerName);
  if (!contract || !hold) return null;
  return {
    name: hold.name,
    pos: "Sign-and-trade",
    salary: contract.firstYearSalary,
    salary_source: "Manual sign-and-trade proposal",
    signAndTrade: true,
    signAndTradeContract: contract
  };
}

function findTransferredPick(pickId) {
  const [senderId, , indexText] = pickId.split(":");
  const sender = getTeam(senderId);
  return sender && getTeamPicks(sender)[Number(indexText)];
}

function renderReviewTeam(teamId) {
  const team = getTeam(teamId);
  const flow = getTeamFlow(teamId);
  const originalPayroll = getTeamCapPayroll(team.id);
  const newPayroll = originalPayroll - flow.payrollOutgoing + flow.incoming;
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
        <div><span>Current cap payroll</span><strong>${formatMoney(originalPayroll)}</strong></div>
        <div><span>After-trade cap payroll</span><strong>${formatMoney(newPayroll)}</strong></div>
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

  const signAndTradeIssues = [];
  const maxSignTradeSalary = Math.floor(CBA_ESTIMATES.salaryCap * 0.35);
  Object.entries(state.signAndTrades).forEach(([playerId, contract]) => {
    const hold = findTransferredPlayer(playerId);
    if (!hold?.signAndTrade
      || Number(state.transfers[playerId]) !== Number(contract.toTeamId)
      || !Number.isInteger(contract.firstYearSalary)
      || contract.firstYearSalary < 1
      || contract.firstYearSalary > maxSignTradeSalary
      || ![3, 4].includes(contract.years)
      || ![0, getSignTradeRaiseLimit(contract.rightsType)].includes(contract.raisePercent)) {
      signAndTradeIssues.push(`The sign-and-trade terms for ${contract.name || "a cap-hold player"} are incomplete or invalid.`);
    }
  });
  checks.push({
    title: "Sign-and-trade terms",
    status: !TRADE_RULES.signAndTradeRules ? "pass" : signAndTradeIssues.length ? "fail" : "pass",
    detail: !TRADE_RULES.signAndTradeRules
      ? "Sign-and-trade restrictions are disabled by your trade sliders."
      : signAndTradeIssues.join(" ") || (Object.keys(state.signAndTrades).length
      ? "Proposed terms are included; player-specific rights limits and signing eligibility are not verified."
      : "No sign-and-trade contracts are included.")
  });

  const tradeExceptionIssues = [];
  const tradeExceptionUses = new Map();
  Object.entries(state.tradeExceptionUses).forEach(([playerId, exceptionId]) => {
    const destinationId = Number(state.transfers[playerId]);
    const player = findTransferredPlayer(playerId);
    const team = getTeam(destinationId);
    if (!destinationId || !team || !player || !hasSalary(player) || player.salary <= 0 || isTwoWayPlayer(player)) {
      tradeExceptionIssues.push("A selected trade exception is not attached to a valid incoming player.");
      return;
    }
    if (player.signAndTrade) {
      tradeExceptionIssues.push(`${player.name} cannot use a traded player exception in this sign-and-trade proposal.`);
      return;
    }
    const exception = getActiveTeamTradeExceptions(team.id)
      .find((item) => item.id === exceptionId);
    if (!exception) {
      tradeExceptionIssues.push(`${team.name}'s selected trade exception is unavailable or expired.`);
      return;
    }
    if (!isTeamTradeExceptionAvailable(team.id)) {
      tradeExceptionIssues.push(`${team.name} has enough cap room to use cap space instead of a trade exception.`);
      return;
    }
    const key = `${team.id}:${exception.id}`;
    const use = tradeExceptionUses.get(key) || { team, exception, amount: 0 };
    use.amount += player.salary;
    tradeExceptionUses.set(key, use);
  });
  tradeExceptionUses.forEach(({ team, exception, amount }) => {
    if (amount > Number(exception.amount)) {
      tradeExceptionIssues.push(`${team.name} assigns ${formatMoney(amount)} to a ${formatMoney(Number(exception.amount))} trade exception.`);
    }
  });
  checks.push({
    title: "Trade exceptions",
    status: tradeExceptionIssues.length ? "fail" : "pass",
    detail: tradeExceptionIssues.join(" ")
      || (tradeExceptionUses.size
        ? "Assigned incoming salaries fit within active team trade exceptions."
        : "No trade exceptions are assigned. Listed standard TPEs can be applied to incoming salaries.")
  });

  const salaryIssues = [];
  const salaryNotes = [];
  participatingTeams.forEach((team) => {
    const flow = getTeamFlow(team.id);
    const incomingForMatching = Math.max(0, flow.incoming - getTeamTradeExceptionIncomingSalary(team.id));
    if (incomingForMatching <= 0) return;
    const match = getSalaryMatchLimit(team, flow.outgoing);
    if (incomingForMatching > match.maximum) {
      salaryIssues.push(`${team.name} receives ${formatMoney(incomingForMatching)} not covered by a selected TPE but may receive up to ${formatMoney(match.maximum)} through salary matching. ${match.rule}`);
    } else {
      salaryNotes.push(`${team.name}: ${formatMoney(incomingForMatching)} salary-matched incoming / ${formatMoney(match.maximum)} allowed.`);
    }
  });
  checks.push({
    title: "Salary matching",
    status: !TRADE_RULES.salaryMatching ? "pass" : salaryIssues.length ? "fail" : "pass",
    detail: !TRADE_RULES.salaryMatching
      ? "Salary matching is disabled by your trade sliders."
      : (salaryIssues.length ? salaryIssues : salaryNotes).join(" ") || (Object.keys(state.tradeExceptionUses).length
        ? "TPE-assigned salary is evaluated separately."
        : "No player salaries are changing hands.")
  });

  const minimumSalaryIssues = [];
  if (TRADE_RULES.minimumTeamSalaryFloor) {
    participatingTeams.forEach((team) => {
      const flow = getTeamFlow(team.id);
      const afterTrade = getTeamSalaryExcludingCapHolds(team.id) - flow.payrollOutgoing + flow.incoming;
      if (afterTrade < CBA_ESTIMATES.minimumTeamSalary) {
        minimumSalaryIssues.push(`${team.name} would be at ${formatMoney(afterTrade)}, below the modeled minimum team salary of ${formatMoney(CBA_ESTIMATES.minimumTeamSalary)}.`);
      }
    });
  }
  checks.push({
    title: "Minimum team salary",
    status: !TRADE_RULES.minimumTeamSalaryFloor ? "pass" : minimumSalaryIssues.length ? "fail" : "pass",
    detail: !TRADE_RULES.minimumTeamSalaryFloor
      ? "Minimum team salary is disabled by your trade sliders."
      : minimumSalaryIssues.join(" ") || "Participating teams remain above the modeled salary floor."
  });

  const rosterSizeIssues = [];
  if (TRADE_RULES.rosterSizeRules) {
    participatingTeams.forEach((team) => {
      const counts = getTeamPlayerCounts(team.id);
      const finalCount = getTeamActiveRosterPlayers(team).length - counts.outgoing + counts.incoming;
      if (finalCount > 15) rosterSizeIssues.push(`${team.name} would have ${finalCount} roster players, above the 15-player limit.`);
    });
  }
  checks.push({
    title: "Roster size",
    status: !TRADE_RULES.rosterSizeRules ? "pass" : rosterSizeIssues.length ? "fail" : "pass",
    detail: !TRADE_RULES.rosterSizeRules
      ? "Roster size limits are disabled by your trade sliders."
      : rosterSizeIssues.join(" ") || "Participating rosters remain within the 15-player limit."
  });

  const hardCapIssues = [];
  participatingTeams.forEach((team) => {
    const tier = getApronTier(team);
    const flow = getTeamFlow(team.id);
    const afterTrade = getTeamSalaryExcludingCapHolds(team.id) - flow.payrollOutgoing + flow.incoming;
    const incomingForMatching = Math.max(0, flow.incoming - getTeamTradeExceptionIncomingSalary(team.id));
    const receivesSignAndTrade = Object.values(state.signAndTrades)
      .some((contract) => Number(contract.toTeamId) === Number(team.id));
    if (receivesSignAndTrade && afterTrade > CBA_ESTIMATES.firstApron) {
      hardCapIssues.push(`${team.name} would exceed the estimated first-apron hard cap triggered by receiving a sign-and-trade player.`);
    } else if (tier && incomingForMatching > 0) {
      const apronLimit = tier === 2 ? CBA_ESTIMATES.secondApron : CBA_ESTIMATES.firstApron;
      const afterTradeWithoutTpeIncoming = afterTrade - getTeamTradeExceptionIncomingSalary(team.id);
      if (afterTradeWithoutTpeIncoming > apronLimit) {
        hardCapIssues.push(`${team.name} would be at ${formatMoney(afterTradeWithoutTpeIncoming)}, above the estimated ${tier === 2 ? "second" : "first"} apron of ${formatMoney(apronLimit)} outside its TPE-acquired salary.`);
      }
    }
    if (tier && incomingForMatching > 0 && incomingForMatching > flow.outgoing) {
      hardCapIssues.push(`${team.name} is marked ${tier === 2 ? "second" : "first"} apron and cannot take back more salary than it sends.`);
    }
  });
  checks.push({
    title: "Apron restrictions",
    status: !TRADE_RULES.apronHardCaps ? "pass" : hardCapIssues.length ? "fail" : "pass",
    detail: !TRADE_RULES.apronHardCaps
      ? "Apron and hard-cap restrictions are disabled by your trade sliders."
      : hardCapIssues.join(" ") || "No configured first- or second-apron restriction is exceeded."
  });

  const aggregationIssues = [];
  participatingTeams.forEach((team) => {
    if (getApronTier(team) !== 2) return;
    const flow = getTeamFlow(team.id);
    const incomingForMatching = Math.max(0, flow.incoming - getTeamTradeExceptionIncomingSalary(team.id));
    const counts = getTeamPlayerCounts(team.id);
    if (incomingForMatching > 0 && counts.outgoing > 1) {
      aggregationIssues.push(`${team.name} is a second-apron team and may not aggregate multiple outgoing player salaries.`);
    }
  });
  checks.push({
    title: "Second-apron aggregation",
    status: !TRADE_RULES.apronHardCaps ? "pass" : aggregationIssues.length ? "fail" : "pass",
    detail: !TRADE_RULES.apronHardCaps
      ? "Second-apron aggregation is disabled by your trade sliders."
      : aggregationIssues.join(" ") || "No second-apron salary aggregation restriction is triggered."
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
    status: !TRADE_RULES.protectedPickRules ? "pass" : stepienIssues.length ? "fail" : stepienWarnings.length ? "attention" : "pass",
    detail: !TRADE_RULES.protectedPickRules
      ? "Protected-pick, Stepien, and pick-window restrictions are disabled."
      : [...stepienIssues, ...stepienWarnings].join(" ") || (firstRoundTransfers.length ? "First-round picks pass the modeled consecutive-year check." : "No first-round picks are included.")
  });

  const failures = checks.filter((check) => check.status === "fail");
  const warnings = checks.filter((check) => check.status === "attention");
  const verdict = failures.length ? "NOT APPROVED" : warnings.length ? "MANUAL REVIEW REQUIRED" : "APPROVED BY CHECKS";
  const verdictStatus = failures.length ? "fail" : warnings.length ? "attention" : "pass";
  return { checks, verdict, verdictStatus };
}

function reviewTrade() {
  const result = validateTrade();
  const frontOfficeActions = getFrontOfficeActions();
  const frontOfficeRows = frontOfficeActions.map((action) => {
    const detail = ["waived", "stretched", "buyout"].includes(action.actionType)
      ? `${formatMoney(action.currentYearDeadMoney)} current-season dead cap`
      : action.actionType === "extension-estimate"
        ? `${action.years}-year estimate · ${formatMoney(action.schedule[0]?.salary || 0)} starting in 2027–28`
        : `${formatMoney(action.salary || 0)} cap hold`;
    return `<li><strong>${escapeHtml(getFrontOfficeActionLabel(action.actionType))} · ${escapeHtml(action.playerName)}</strong><span>${escapeHtml(action.teamName)} · ${escapeHtml(detail)}</span></li>`;
  }).join("");
  reviewTitleEl.textContent = "Trade review";
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
    <p class="cba-estimate-note">Rule model uses your saved 2026–27 assumptions: salary cap ${formatMoney(CBA_ESTIMATES.salaryCap)}, first apron ${formatMoney(CBA_ESTIMATES.firstApron)}, second apron ${formatMoney(CBA_ESTIMATES.secondApron)}, and minimum team salary ${formatMoney(CBA_ESTIMATES.minimumTeamSalary)}, with scaled salary-matching bands. This is a trade-planning estimate, not official NBA approval; protected picks need manual conveyance review.</p>
    <h2 class="review-assets-title">Trade assets by team</h2>
    <div class="review-team-grid">${state.teamIds.filter(Boolean).map(renderReviewTeam).join("")}</div>
    ${frontOfficeRows ? `<section class="review-front-office"><h2 class="review-assets-title">Front-office actions</h2><ul>${frontOfficeRows}</ul><p>These are proposal simulations only; they do not execute roster transactions.</p></section>` : ""}
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

async function submitTradeProposal() {
  if (!window.NBAHubAuth?.isSignedIn()) {
    window.NBAHubAuth?.requireSignIn("Sign in to submit a community trade proposal.");
    return;
  }
  if (state.teamIds.filter(Boolean).length < 2) {
    showTradeToast("Select at least two teams before submitting a proposal.");
    return;
  }
  if (!Object.keys(state.transfers).length && !Object.keys(state.pickTransfers).length
    && !Object.keys(state.pickSwaps).length && !getFrontOfficeActions().length) {
    showTradeToast("Add at least one player, pick, pick swap, or front-office action before submitting a proposal.");
    return;
  }

  const snapshot = buildTradeSnapshot();
  const postTitle = document.getElementById("tradePostTitle")?.value.trim() || "";
  const postExplanation = document.getElementById("tradePostExplanation")?.value.trim() || "";
  if (postTitle && postTitle.length < 3) {
    showTradeToast("A post title must contain at least 3 characters.");
    document.getElementById("tradePostTitle")?.focus();
    return;
  }
  if (postExplanation && postExplanation.length < 10) {
    showTradeToast("An explanation must contain at least 10 characters.");
    document.getElementById("tradePostExplanation")?.focus();
    return;
  }
  snapshot.postTitle = postTitle;
  snapshot.postExplanation = postExplanation;
  submitTradeBtn.disabled = true;
  submitTradeBtn.textContent = "Submitting…";
  try {
    const result = await tradeApiRequest("trades", {
      method: "POST",
      authenticated: true,
      body: { payload: snapshot }
    });
    if (!result.trade) throw new Error("Trade service did not return the saved proposal.");
    submitTradeBtn.textContent = "Submitted";
    document.getElementById("tradePostTitle").value = "";
    document.getElementById("tradePostExplanation").value = "";
    showTradeToast(`Proposal submitted to the community · ${snapshot.verdict}. This does not execute a real NBA transaction.`);
  } catch (error) {
    console.error("Trade submission failed:", error);
    showTradeToast(error.message || "The trade could not be submitted. Please try again.");
  } finally {
    submitTradeBtn.disabled = false;
    window.setTimeout(() => { submitTradeBtn.textContent = "Submit proposal"; }, 1800);
  }
}

async function loadTeams({ background = false } = {}) {
  if (isLoadingTeams) return;
  isLoadingTeams = true;
  if (!background) {
    teamGridEl.innerHTML = '<div class="loading-state">Loading team data…</div>';
  }

  try {
    const response = await fetch(`${API_URL}/api/v1/trade-machine/teams`, {
      headers: { "x-api-key": API_KEY }
    });
    if (!response.ok) throw new Error(`API request failed (${response.status})`);

    const data = await response.json();
    teams = data.teams || [];
    if (teams.length === 0) throw new Error("The API returned no teams.");
    lastTeamsRefreshAt = Date.now();

    renderTradeBoard();
  } catch (error) {
    console.error("Trade machine API load failed:", error);
    if (teams.length) {
      renderTradeBoard();
    } else {
      teamGridEl.innerHTML = '<div class="loading-state">Could not load teams. Check the API URL, network, and API key.</div>';
    }
  } finally {
    isLoadingTeams = false;
  }
}

function addTeamSlot() {
  const signedIn = Boolean(window.NBAHubAuth?.isSignedIn());
  if (!signedIn && state.teamIds.length >= 2) {
    window.NBAHubAuth?.requireSignIn(
      "Sign in or create an account to add a third team. Guests can build and review two-team trades."
    );
    return;
  }
  if (state.teamIds.length < MAX_TRADE_TEAMS) {
    state.teamIds.push(null);
    renderTradeBoard();
  }
}

addTeamBtn.addEventListener("click", addTeamSlot);

clearTradeBtn.addEventListener("click", () => {
  state.transfers = {};
  state.tradeExceptionUses = {};
  state.signAndTrades = {};
  state.reSignedCapHolds = {};
  state.renouncedCapHolds = {};
  state.rosterActions = {};
  state.extensions = {};
  state.pickTransfers = {};
  state.pickSwaps = {};
  state.pickProtections = {};
  state.customPickProtections = {};
  state.pickSwapTypes = {};
  state.openTeamPickerSlot = null;
  renderTradeBoard();
});

reviewTradeBtn.addEventListener("click", reviewTrade);
tradePostForm.addEventListener("submit", (event) => {
  event.preventDefault();
  submitTradeProposal();
});
closeReviewBtn.addEventListener("click", () => reviewDialog.close());
doneReviewBtn.addEventListener("click", () => reviewDialog.close());
playerProfileDialog.addEventListener("click", (event) => {
  if (event.target === playerProfileDialog) playerProfileDialog.close();
});
playerCompareDialog.addEventListener("click", (event) => {
  if (event.target === playerCompareDialog) playerCompareDialog.close();
});
frontOfficeDialog.addEventListener("click", (event) => {
  if (event.target === frontOfficeDialog) frontOfficeDialog.close();
});
reviewDialog.addEventListener("click", (event) => {
  if (event.target === reviewDialog) reviewDialog.close();
});
signTradeDialog.addEventListener("click", (event) => {
  if (event.target === signTradeDialog) signTradeDialog.close();
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
loadRumorWatch();
window.setInterval(() => loadTeams({ background: true }), 15 * 60 * 1000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && Date.now() - lastTeamsRefreshAt >= 15 * 60 * 1000) {
    loadTeams({ background: true });
  }
});

const tradeSlidersBtn = document.getElementById("tradeSlidersBtn");
const tradeSlidersDialog = document.getElementById("tradeSlidersDialog");
const tradeSlidersForm = document.getElementById("tradeSlidersForm");
const closeTradeSlidersBtn = document.getElementById("closeTradeSlidersBtn");
const resetTradeSlidersBtn = document.getElementById("resetTradeSlidersBtn");

function populateTradeSliders() {
  if (!tradeSlidersForm) return;
  Object.entries(TRADE_RULES).forEach(([name, enabled]) => {
    const control = tradeSlidersForm.elements.namedItem(name);
    if (control) control.checked = enabled;
  });
}

tradeSlidersBtn?.addEventListener("click", () => {
  populateTradeSliders();
  tradeSlidersDialog?.showModal();
});
closeTradeSlidersBtn?.addEventListener("click", () => tradeSlidersDialog?.close());
tradeSlidersDialog?.addEventListener("click", (event) => {
  if (event.target === tradeSlidersDialog) tradeSlidersDialog.close();
});
resetTradeSlidersBtn?.addEventListener("click", () => {
  Object.keys(TRADE_RULES).forEach((name) => {
    const control = tradeSlidersForm.elements.namedItem(name);
    if (control) control.checked = true;
  });
});
tradeSlidersForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(tradeSlidersForm);
  Object.keys(TRADE_RULES).forEach((name) => {
    TRADE_RULES[name] = formData.has(name);
  });
  document.body.dataset.tradeRules = JSON.stringify(TRADE_RULES);

  if (window.NBAHubAuth?.isSignedIn() && window.NBAHubAuth?.saveSettings) {
    const current = window.NBAHubAppSettings?.get() || {};
    try {
      await window.NBAHubAuth.saveSettings({ ...current, ...TRADE_RULES });
    } catch (error) {
      console.warn("Trade sliders could not be saved to the account.", error);
    }
  } else {
    localStorage.setItem("nba-hub.trade-rules.trade_machine.v1", JSON.stringify(TRADE_RULES));
  }
  renderTradeBoard();
  tradeSlidersDialog?.close();
});

try {
  const savedRules = JSON.parse(localStorage.getItem("nba-hub.trade-rules.trade_machine.v1") || "null");
  if (savedRules && typeof savedRules === "object") {
    Object.keys(TRADE_RULES).forEach((key) => {
      if (typeof savedRules[key] === "boolean") TRADE_RULES[key] = savedRules[key];
    });
  }
} catch {}

function setupTradeAdminControls() {
  const dialog = document.getElementById("tradeAdminDialog");
  if (!dialog) return;
  const status = document.getElementById("tradeAdminStatus");
  const communityPanel = document.getElementById("tradeAdminCommunity");
  const rumorsPanel = document.getElementById("tradeAdminRumors");
  const auditPanel = document.getElementById("tradeAdminAudit");
  const addButton = () => {
    const existing = document.getElementById("tradeAdminBtn");
    if (existing) existing.remove();
    if (!window.NBAHubAuth?.isAdmin()) return;
    const container = document.querySelector(".topbar__info");
    if (!container) return;
    const button = document.createElement("button");
    button.type = "button";
    button.id = "tradeAdminBtn";
    button.className = "button button--ghost";
    button.textContent = "Admin";
    button.addEventListener("click", async () => {
      dialog.showModal();
      await loadCommunity();
    });
    container.appendChild(button);
  };
  const sessionHeaders = () => {
    const token = window.NBAHubAuth?.getSession()?.access_token;
    return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
  };
  const loadCommunity = async () => {
    status.textContent = "Loading community trades…";
    try {
      const response = await fetch(`${API_URL}/api/v1/trade-machine/trades?limit=50&offset=0`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || "Could not load community trades.");
      communityPanel.innerHTML = (payload.trades || []).length
        ? payload.trades.map((trade) => `
          <article class="trade-admin-card" data-admin-trade="${escapeHtml(trade.id)}">
            <div>
              <strong>${escapeHtml(trade.creator || "NBA fan")}</strong>
              <small>${escapeHtml(trade.moderationStatus || "active")} · ${escapeHtml(trade.verdict || "Review")}</small>
            </div>
            <div class="trade-admin-card__actions">
              <button type="button" data-moderate="featured">Feature</button>
              <button type="button" data-moderate="verified">Verify</button>
              <button type="button" data-moderate="locked">Lock comments</button>
              <button type="button" data-moderate="rejected">Reject</button>
              <button type="button" data-moderate="active">Restore</button>
              <button type="button" class="is-danger" data-delete-trade>Remove</button>
            </div>
          </article>
        `).join("")
        : '<p class="trade-admin-empty">No community trades found.</p>';
      status.textContent = `${payload.trades?.length || 0} community trades`;
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Could not load community trades.";
    }
  };
  const loadRumors = async () => {
    status.textContent = "Loading trade watch…";
    try {
      const response = await fetch(`${API_URL}/api/v1/trade-machine/rumors`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || "Could not load trade watch.");
      rumorsPanel.innerHTML = `
        <form class="trade-admin-rumor-form" id="tradeAdminRumorForm">
          <label>Player name<input name="player_name" minlength="2" maxlength="80" required placeholder="Player name"></label>
          <label>Current team<input name="team_name" maxlength="80" placeholder="Team name"></label>
          <label>Team abbreviation<input name="team_abbreviation" maxlength="3" placeholder="LAL"></label>
          <label>Rank<input name="rank" type="number" min="1" max="100" value="${(payload.players?.length || 0) + 1}"></label>
          <button type="submit" class="button button--add">Add player</button>
        </form>
        <div class="trade-admin-rumor-list">
          ${(payload.players || []).map((rumor) => `
            <article class="trade-admin-rumor" data-rumor-id="${escapeHtml(rumor.id)}">
              <span class="trade-admin-rumor__rank">${escapeHtml(rumor.rank)}</span>
              <div><strong>${escapeHtml(rumor.player_name)}</strong><small>${escapeHtml(rumor.team_name || "Team unavailable")}</small></div>
              <button type="button" class="is-danger" data-remove-rumor>Remove</button>
            </article>
          `).join("") || '<p class="trade-admin-empty">No players on the trade watch.</p>'}
        </div>
      `;
      status.textContent = `${payload.players?.length || 0} trade watch players`;
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Could not load trade watch.";
    }
  };
  const loadAudit = async () => {
    status.textContent = "Loading audit history…";
    try {
      const response = await fetch(`${API_URL}/api/v1/admin/audit-log?limit=100`, { headers: sessionHeaders() });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || "Could not load audit history.");
      auditPanel.innerHTML = (payload.entries || []).length
        ? payload.entries.map((entry) => `
          <article class="trade-admin-audit">
            <strong>${escapeHtml(entry.action)} · ${escapeHtml(entry.entity_type)}</strong>
            <small>${escapeHtml(entry.entity_id || "—")} · ${escapeHtml(entry.created_at || "")}</small>
          </article>
        `).join("")
        : '<p class="trade-admin-empty">No admin actions recorded.</p>';
      status.textContent = `${payload.entries?.length || 0} audit entries`;
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Could not load audit history.";
    }
  };
  document.getElementById("closeTradeAdminBtn")?.addEventListener("click", () => dialog.close());
  dialog.querySelectorAll("[data-admin-tab]").forEach((tab) => {
    tab.addEventListener("click", async () => {
      dialog.querySelectorAll("[data-admin-tab]").forEach((item) => item.classList.toggle("is-active", item === tab));
      communityPanel.hidden = tab.dataset.adminTab !== "community";
      rumorsPanel.hidden = tab.dataset.adminTab !== "rumors";
      auditPanel.hidden = tab.dataset.adminTab !== "audit";
      if (tab.dataset.adminTab === "community") await loadCommunity();
      else if (tab.dataset.adminTab === "rumors") await loadRumors();
      else await loadAudit();
    });
  });
  rumorsPanel.addEventListener("submit", async (event) => {
    const form = event.target.closest("#tradeAdminRumorForm");
    if (!form) return;
    event.preventDefault();
    const formData = new FormData(form);
    const body = {
      player_name: String(formData.get("player_name") || "").trim(),
      team_name: String(formData.get("team_name") || "").trim(),
      team_abbreviation: String(formData.get("team_abbreviation") || "").trim(),
      rank: Number(formData.get("rank") || 1)
    };
    const response = await fetch(`${API_URL}/api/v1/admin/trade-machine/rumors`, {
      method: "POST",
      headers: sessionHeaders(),
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      status.textContent = payload.detail || "Trade watch player could not be added.";
      return;
    }
    await loadRumors();
    await loadRumorWatch();
  });
  rumorsPanel.addEventListener("click", async (event) => {
    const removeButton = event.target.closest("[data-remove-rumor]");
    if (!removeButton) return;
    const card = removeButton.closest("[data-rumor-id]");
    if (!card || !window.confirm("Remove this player from the trade watch?")) return;
    const response = await fetch(`${API_URL}/api/v1/admin/trade-machine/rumors/${encodeURIComponent(card.dataset.rumorId)}`, {
      method: "DELETE",
      headers: sessionHeaders()
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      status.textContent = payload.detail || "Trade watch player could not be removed.";
      return;
    }
    await loadRumors();
    await loadRumorWatch();
  });
  communityPanel.addEventListener("click", async (event) => {
    const card = event.target.closest("[data-admin-trade]");
    if (!card) return;
    const tradeId = card.dataset.adminTrade;
    if (event.target.closest("[data-moderate]")) {
      const statusValue = event.target.closest("[data-moderate]").dataset.moderate;
      const response = await fetch(`${API_URL}/api/v1/admin/trade-machine/trades/${encodeURIComponent(tradeId)}`, {
        method: "PATCH",
        headers: sessionHeaders(),
        body: JSON.stringify({ moderation_status: statusValue })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) window.alert(payload.detail || "Trade moderation failed.");
      else await loadCommunity();
    }
    if (event.target.closest("[data-delete-trade]")) {
      if (!window.confirm("Remove this community trade?")) return;
      const response = await fetch(`${API_URL}/api/v1/admin/trade-machine/trades/${encodeURIComponent(tradeId)}`, {
        method: "DELETE",
        headers: sessionHeaders()
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) window.alert(payload.detail || "Trade could not be removed.");
      else await loadCommunity();
    }
  });
  window.addEventListener("nba-hub-auth-ready", addButton);
  window.addEventListener("nba-hub-auth-changed", addButton);
  addButton();
}

setupTradeAdminControls();

window.NBAHubAppSettings = {
  appId: "trade_machine",
  get() {
    return {
      salaryCap: CBA_ESTIMATES.salaryCap,
      firstApron: CBA_ESTIMATES.firstApron,
      secondApron: CBA_ESTIMATES.secondApron,
      minimumTeamSalary: CBA_ESTIMATES.minimumTeamSalary,
      compact: document.body.dataset.settingsCompact === "true",
      salaryDisplay: document.body.dataset.salaryDisplay || "auto",
      showHeadshots: document.body.dataset.settingsHeadshots !== "false",
      salaryMatching: TRADE_RULES.salaryMatching,
      apronHardCaps: TRADE_RULES.apronHardCaps,
      minimumTeamSalaryFloor: TRADE_RULES.minimumTeamSalaryFloor,
      signAndTradeRules: TRADE_RULES.signAndTradeRules,
      protectedPickRules: TRADE_RULES.protectedPickRules,
      rosterSizeRules: TRADE_RULES.rosterSizeRules
    };
  },
  apply(settings = {}) {
    for (const key of ["salaryCap", "firstApron", "secondApron", "minimumTeamSalary"]) {
      if (Number.isSafeInteger(settings[key])) CBA_ESTIMATES[key] = settings[key];
    }
    for (const key of ["salaryMatching", "apronHardCaps", "minimumTeamSalaryFloor", "signAndTradeRules", "protectedPickRules", "rosterSizeRules"]) {
      if (typeof settings[key] === "boolean") TRADE_RULES[key] = settings[key];
    }
    document.body.dataset.settingsCompact = String(settings.compact === true);
    document.body.dataset.salaryDisplay = ["auto", "full", "compact"].includes(settings.salaryDisplay)
      ? settings.salaryDisplay
      : "auto";
    document.body.dataset.settingsHeadshots = String(settings.showHeadshots !== false);
    renderTradeBoard();
  }
};
