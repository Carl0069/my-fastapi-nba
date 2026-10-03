const API_URL = "https://my-fastapi-nba.vercel.app";
const API_KEY = "lebron2369";
const MAX_TRADE_TEAMS = 5;
const SAVED_TRADES_KEY = "nba-trade-desk.saved-trades.v1";
const ROSTER_MOVES = [
  { player: "Buddy Hield", from: "Atlanta Hawks", to: "Chicago Bulls", salary: 9_600_000, sourceSalary: 9_600_000 },
  { player: "Tre Mann", from: "Washington Wizards", to: "Cleveland Cavaliers", salary: 8_000_000, sourceSalary: 8_000_000 },
  { player: "Dorian Finney-Smith", from: "Charlotte Hornets", to: "Atlanta Hawks", salary: 13_335_000, sourceSalary: 13_300_000 },
  { player: "Dennis Schröder", from: "Cleveland Cavaliers", to: "Charlotte Hornets", salary: 14_800_000, sourceSalary: 14_800_000 },
  { player: "Tony Bradley", from: "Atlanta Hawks", to: "New York Knicks", salary: 3_506_659, sourceSalary: 10_215_000 },
  { player: "AJ Johnson", from: "Memphis Grizzlies", to: "New Orleans Pelicans", salary: 3_237_120, sourceSalary: 3_200_000 }
];
const WAIVED_PLAYERS = [{ player: "Rob Dillingham", salary: 6_800_000 }];
const ROSTER_REMOVALS = [
  { team: "Atlanta Hawks", player: "Gabe Vincent", salary: 12_785_000 },
  { team: "Atlanta Hawks", player: "Devin Carter", salary: 5_100_000 },
  { team: "Atlanta Hawks", player: "Keaton Wallace", salary: 7_440_000 },
  { team: "Denver Nuggets", player: "Bruce Brown", salary: 0 },
  { team: "Boston Celtics", player: "Max Shulga", salary: 10_300_000 },
  { team: "Portland Trail Blazers", player: "Blake Wesley", salary: 0 },
  { team: "Utah Jazz", player: "John Konchar", salary: 6_100_000 },
  { team: "Memphis Grizzlies", player: "Kentavious Caldwell-Pope", salary: 21_600_000 },
  { team: "Memphis Grizzlies", player: "Taj Gibson", salary: 3_800_000 },
  { team: "Memphis Grizzlies", player: "D'Angelo Russell", salary: 5_900_000 },
  { team: "LA Clippers", player: "TyTy Washington Jr.", salary: 0 }
];
const PLAYER_SALARY_CORRECTIONS = [
  { team: "San Antonio Spurs", player: "Jordan McLaughlin", salary: 2_449_421 },
  { team: "San Antonio Spurs", player: "Taelon Peter", salary: 2_185_116 },
  { team: "Toronto Raptors", player: "Trey Jemison III", salary: null }
];
const RAPTORS_PAYROLL = {
  "Kawhi Leonard": 50_300_000,
  "Scottie Barnes": 41_754_690,
  "Immanuel Quickley": 32_500_000,
  "RJ Barrett": 29_616_071,
  "Jakob Poeltl": 19_500_000,
  "Collin Murray-Boyles": 6_649_560,
  "Allen Graves": 4_065_720,
  "Ja'Kobe Walter": 3_811_800,
  "Andre Jackson Jr.": 2_537_526,
  "Kyle Anderson": 2_449_421,
  "Trayce Jackson-Davis": 2_406_205,
  "Jamison Battle": 2_296_271,
  "Jamal Shead": 2_296_271,
  "Alijah Martin": 2_185_116,
  "Jaden Bradley": 1_357_763,
  "Nate Bittle": 1_357_763
};
const NUGGETS_PAYROLL = {
  "Nikola Jokić": 59_033_114,
  "Jamal Murray": 50_105_628,
  "Aaron Gordon": 33_658_037,
  "Cameron Johnson": 23_062_500,
  "Christian Braun": 21_551_726,
  "Spencer Jones": 6_000_000,
  "Julian Strawther": 4_826_931,
  "DaRon Holmes II": 3_372_120,
  "Lonnie Walker IV": 3_286_399,
  "Zeke Nnaji": 7_466_667,
  "DeMar DeRozan": 2_449_421,
  "Tyus Jones": 2_449_421,
  "Marvin Bagley III": 2_449_421,
  "Trevon Brazile": 1_357_763
};
const LAKERS_PAYROLL = {
  "Luka Dončić": 49_800_000,
  "Austin Reaves": 41_240_250,
  "Walker Kessler": 30_232_558,
  "Quentin Grimes": 13_953_489,
  "Sandro Mamukelashvili": 13_000_000,
  "Jarred Vanderbilt": 12_428_571,
  "Collin Sexton": 9_366_000,
  "Jake LaRavia": 6_000_000,
  "Jaden Hardy": 6_000_000,
  "Dalton Knecht": 4_201_080,
  "Cameron Carr": 3_315_360,
  "Ziaire Williams": 2_449_421,
  "Kevon Looney": 2_449_421,
  "Matisse Thybulle": 2_449_421,
  "Bronny James": 2_296_271,
  "Adou Thiero": 2_150_917
};
const ROCKETS_PAYROLL = {
  "Kevin Durant": 43_902_439,
  "Alperen Şengün": 35_642_202,
  "Fred VanVleet": 25_000_000,
  "Jabari Smith Jr.": 23_643_411,
  "Tari Eason": 14_051_724,
  "Steven Adams": 13_000_000,
  "Amen Thompson": 12_258_609,
  "Reed Sheppard": 11_108_880,
  "Clint Capela": 7_035_000,
  "Marcus Smart": 6_064_000,
  "Julian Phillips": 2_537_526,
  "Oscar Tshiebwe": 2_537_526,
  "Isaiah Crawford": 2_449_421,
  "Bogdan Bogdanović": 2_449_421,
  "Jae'Sean Tate": 2_449_421,
  "Bruce Thornton": 1_357_763
};
const TIMBERWOLVES_PAYROLL = {
  "Anthony Edwards": 48_924_624,
  "LaMelo Ball": 40_770_520,
  "Rudy Gobert": 36_500_000,
  "Jaden McDaniels": 26_200_001,
  "Ayo Dosunmu": 19_310_345,
  "Donte DiVincenzo": 12_535_000,
  "Jonathan Kuminga": 6_064_000,
  "Cody Williams": 6_015_600,
  "Joan Beringer": 4_411_200,
  "Jaylen Clark": 3_086_420,
  "Bones Hyland": 2_845_883,
  "Terrence Shannon Jr.": 2_801_640,
  "Trey Lyles": 2_449_421,
  "Isaiah Evans": 1_357_763,
  "John Konchar": 2_055_000
};
const SCREENSHOT_PAYROLLS = {
  "Washington Wizards": {
    total: 183_462_525,
    salaries: {
      "Anthony Davis": 58_456_566,
      "Trae Young": 49_488_300,
      "AJ Dybantsa": 14_748_000,
      "Alex Sarr": 12_370_680,
      "Bilal Coulibaly": 9_240_012,
      "Tre Johnson": 8_649_600,
      "Deandre Ayton": 8_104_000,
      "Khris Middleton": 5_591_122,
      "Bub Carrington": 4_900_560,
      "Will Riley": 3_688_320,
      "Kyshawn George": 3_108_000,
      "Justin Champagnie": 2_667_944,
      "Anthony Gill": 2_449_421
    }
  },
  "Dallas Mavericks": {
    total: 177_194_561,
    salaries: {
      "Kyrie Irving": 39_491_282,
      "P.J. Washington": 19_813_044,
      "Daniel Gafford": 17_263_584,
      "Santi Aldama": 17_007_043,
      "Cooper Flagg": 14_517_480,
      "Zaccharie Risacher": 13_826_040,
      "Caleb Martin": 10_001_493,
      "Naji Marshall": 9_428_571,
      "Max Christie": 8_285_714,
      "Dereck Lively II": 7_239_131,
      "Morez Johnson Jr.": 6_754_800,
      "Marcus Sasser": 5_198_983,
      "Sergio de Larrea": 3_182_280,
      "Tarik Biberovic": 3_000_000,
      "Moussa Cisse": 2_185_116
    }
  },
  "Milwaukee Bucks": {
    // Team payroll includes partial-salary rows for Lillard and Micic, outside the active roster.
    total: 193_808_287,
    salaries: {
      "Tyler Herro": 33_000_000,
      "Myles Turner": 26_584_164,
      "Kyle Kuzma": 20_345_152,
      "Gary Trent Jr.": 15_200_000,
      "Caris LeVert": 14_809_200,
      "AJ Green": 10_044_644,
      "Brayden Burries": 6_417_360,
      "Jaime Jaquez Jr.": 5_939_141,
      "Ousmane Dieng": 5_750_000,
      "Nate Ament": 5_502_000,
      "Kevin Porter Jr.": 5_390_700,
      "Kel'el Ware": 4_654_920,
      "Ryan Rollins": 4_000_000,
      "Kasparas Jakučionis": 3_841_680,
      "Jericho Sims": 2_801_346,
      "Pete Nance": 2_537_526,
      "John Butler Jr.": 2_449_421,
      "Bogoljub Markovic": 1_357_763
    }
  },
  "Orlando Magic": {
    total: 223_288_224,
    salaries: {
      "Franz Wagner": 41_754_690,
      "Paolo Banchero": 41_500_000,
      "Desmond Bane": 39_446_090,
      "Jalen Suggs": 32_400_000,
      "Wendell Carter Jr.": 18_102_000,
      "Jonathan Isaac": 10_449_421,
      "Anthony Black": 10_106_316,
      "Goga Bitadze": 7_608_696,
      "Tristan da Silva": 3_991_200,
      "Jase Richardson": 3_132_360,
      "JD Davison": 2_625_627,
      "Jamal Cain": 2_584_539,
      "Malaki Branham": 2_537_526,
      "Jevon Carter": 2_449_421,
      "Nikola Vučević": 2_449_421,
      "Noah Penda": 2_150_917
    }
  },
  "Memphis Grizzlies": {
    total: 133_200_098,
    salaries: {
      "Jerami Grant": 34_206_898,
      "Isaiah Stewart": 15_000_000,
      "Cameron Boozer": 11_849_760,
      "Ty Jerome": 9_220_050,
      "Quinten Post": 8_285_714,
      "Taylor Hendricks": 7_805_900,
      "Jordan Hawkins": 7_021_895,
      "Zach Edey": 6_332_760,
      "Cedric Coward": 6_001_080,
      "Kris Murray": 5_315_004,
      "Walter Clayton Jr.": 4_190_520,
      "Karim Lopez": 3_746_760,
      "Olivier-Maxence Prosper": 2_497_812,
      "Scotty Pippen Jr.": 2_461_462,
      "Cam Spencer": 2_411_090,
      "GG Jackson": 2_406_205,
      "Jaylen Wells": 2_296_271,
      "Micah Peavy": 2_150_917
    }
  },
  "Sacramento Kings": {
    total: 191_795_907,
    salaries: {
      "Zach LaVine": 48_967_380,
      "Domantas Sabonis": 45_472_000,
      "De'Andre Hunter": 24_910_714,
      "Keegan Murray": 24_137_936,
      "Malik Monk": 20_190_035,
      "Darius Acuff Jr.": 8_021_640,
      "Precious Achiuwa": 5_477_000,
      "Nique Clifford": 3_263_400,
      "Alex Karaban": 2_948_280,
      "Daeqwon Plowden": 2_449_421,
      "Ben Simmons": 2_449_421,
      "Maxime Raynaud": 2_150_917,
      "Emanuel Sharp": 1_357_763
    }
  },
  "Phoenix Suns": {
    total: 193_028_455,
    salaries: {
      "Devin Booker": 57_078_728,
      "Jalen Green": 36_251_166,
      "Miles Bridges": 22_826_087,
      "Dillon Brooks": 19_992_727,
      "Mark Williams": 11_728_395,
      "Collin Gillespie": 10_714_286,
      "Khaman Maluach": 6_316_680,
      "Luke Kennard": 6_064_000,
      "Jordan Goodwin": 5_864_198,
      "Haywood Highsmith": 3_449_421,
      "Koa Peat": 2_926_800,
      "Ryan Dunn": 2_784_240,
      "Jamaree Bouyea": 2_584_539,
      "Oso Ighodaro": 2_296_271,
      "Rasheer Fleming": 2_150_917
    }
  },
  "New Orleans Pelicans": {
    total: 204_110_200,
    salaries: {
      "Zion Williamson": 42_166_510,
      "Jordan Poole": 34_044_642,
      "Dejounte Murray": 32_785_071,
      "Trey Murphy III": 27_000_000,
      "Herb Jones": 14_898_786,
      "Jeremiah Fears": 7_896_240,
      "Bennedict Mathurin": 7_804_878,
      "Saddiq Bey": 6_440_678,
      "Derik Queen": 5_416_080,
      "DeAndre Jordan": 3_876_529,
      "Yves Missi": 3_512_760,
      "AJ Johnson": 3_237_120,
      "Christian Koloko": 2_625_627,
      "Caleb Houstan": 2_625_627,
      "Bryce McGowens": 2_584_539,
      "Trendon Watford": 2_449_421,
      "Kobe Bufkin": 2_449_421,
      "Karlo Matković": 2_296_271
    }
  },
  "Golden State Warriors": {
    total: 223_306_506,
    salaries: {
      "Stephen Curry": 62_587_158,
      "Jimmy Butler": 56_832_773,
      "Draymond Green": 27_678_571,
      "Kristaps Porziņģis": 19_512_195,
      "Moses Moody": 12_500_000,
      "Al Horford": 6_822_000,
      "Yaxel Lendeborg": 6_096_240,
      "Brandin Podziemski": 5_679_459,
      "De'Anthony Melton": 5_477_000,
      "Gui Santos": 4_629_630,
      "Charles Bassey": 2_449_421,
      "Georges Niang": 2_449_421,
      "Gary Payton II": 2_449_421,
      "Brandon Williams": 2_449_421,
      "Alex Toohey": 2_185_116,
      "Will Richard": 2_150_917,
      "Dalen Terry": 1_357_763
    }
  }
};
const TWO_WAY_CONTRACTS = {
  "Philadelphia 76ers": ["Caleb Love"]
};
const PLAYER_CONTRACT_OVERRIDES = {
  "Cleveland Cavaliers": {
    "Mario Hezonja": { salary: 2_845_883 }
  },
  "Charlotte Hornets": {
    "Dennis Schröder": { salary: 14_800_000 }
  },
  "Brooklyn Nets": {
    "Moritz Wagner": {
      salary: 9_000_000,
      note: "2-year, $18.45M contract: $9M in 2026–27; $9.45M in 2027–28 (mutual option).",
      label: "2027–28 mutual option"
    }
  },
  "Dallas Mavericks": {
    "Zaccharie Risacher": { salary: 13_800_000 }
  },
  "New York Knicks": {
    "Tony Bradley": { salary: 3_506_659 }
  }
};
const CBA_ESTIMATES = {
  season: "2026–27 estimate",
  salaryCap: 179_500_000,
  firstApron: 227_500_000,
  secondApron: 241_200_000,
  baseCap: 154_647_000,
  baseSmallOutgoing: 7_500_000,
  baseMediumOutgoing: 29_000_000,
  baseMediumAllowance: 7_500_000,
  baseFixedAllowance: 250_000,
  lastTradeableFirstRoundYear: 2033
};

let teams = [];
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

function removeRosterPlayer(team, playerName) {
  const matchesPlayer = (player) => player.name.toLocaleLowerCase() === playerName.toLocaleLowerCase();
  const removed = [...(team.starters_2026_27 || []), ...(team.bench_2026_27 || [])].filter(matchesPlayer);
  team.starters_2026_27 = (team.starters_2026_27 || []).filter((player) => !matchesPlayer(player));
  team.bench_2026_27 = (team.bench_2026_27 || []).filter((player) => !matchesPlayer(player));
  return removed;
}

function adjustTeamPayroll(team, delta) {
  team.total_salary = Math.max(0, Number(team.total_salary || 0) + delta);
}

function applyRosterCorrections() {
  ROSTER_MOVES.forEach((move) => {
    const sourceTeam = teams.find((team) => team.name === move.from);
    const destinationTeam = teams.find((team) => team.name === move.to);
    const destinationPlayer = destinationTeam && findRosterPlayer(destinationTeam, move.player);
    let playerRecord = destinationPlayer || (sourceTeam && findRosterPlayer(sourceTeam, move.player));

    teams.forEach((team) => {
      if (team === destinationTeam) return;
      const removed = removeRosterPlayer(team, move.player);
      if (removed.length > 0) {
        playerRecord ||= removed[0];
        adjustTeamPayroll(team, -(team === sourceTeam ? move.sourceSalary : move.salary));
      }
    });

    if (!destinationTeam) throw new Error(`Roster correction team not found: ${move.to}`);
    if (!playerRecord) throw new Error(`Roster data missing for ${move.player}.`);

    if (destinationPlayer) {
      const previousSalary = Number(destinationPlayer.salary) || 0;
      destinationPlayer.salary = move.salary;
      adjustTeamPayroll(destinationTeam, move.salary - previousSalary);
    } else {
      destinationTeam.bench_2026_27 = destinationTeam.bench_2026_27 || [];
      destinationTeam.bench_2026_27.push({ ...playerRecord, salary: move.salary });
      adjustTeamPayroll(destinationTeam, move.salary);
    }
  });

  const misspelledRisacherEntry = teams.find((team) => team.name === "Atlanta Hawks");
  if (misspelledRisacherEntry) {
    const removed = removeRosterPlayer(misspelledRisacherEntry, "Zacharie Risacher");
    if (removed.length > 0) adjustTeamPayroll(misspelledRisacherEntry, -13_800_000 * removed.length);
  }

  WAIVED_PLAYERS.forEach(({ player, salary }) => {
    teams.forEach((team) => {
      const removed = removeRosterPlayer(team, player);
      if (removed.length > 0) adjustTeamPayroll(team, -salary * removed.length);
    });
  });

  const correctedTaxStatuses = {
    "Atlanta Hawks": "Luxury Tax",
    "Charlotte Hornets": "Under Cap",
    "Chicago Bulls": "Under Cap",
    "Cleveland Cavaliers": "Luxury Tax",
    "New York Knicks": "Luxury Tax",
    "Washington Wizards": "Over Cap"
  };
  teams.forEach((team) => {
    const status = correctedTaxStatuses[team.name];
    if (status) team.tax_status = status;
  });

  ROSTER_REMOVALS.forEach(({ team: teamName, player, salary }) => {
    const team = teams.find((item) => item.name === teamName);
    if (!team) throw new Error(`Roster correction team not found: ${teamName}`);
    const removed = removeRosterPlayer(team, player);
    if (removed.length > 0) adjustTeamPayroll(team, -salary * removed.length);
  });
}

function applyRaptorsPayroll() {
  const raptors = teams.find((team) => team.name === "Toronto Raptors");
  if (!raptors) throw new Error("Roster correction team not found: Toronto Raptors");

  ["Brandon Ingram", "Gradey Dick"].forEach((playerName) => removeRosterPlayer(raptors, playerName));
  Object.entries(RAPTORS_PAYROLL).forEach(([playerName, salary]) => {
    const player = findRosterPlayer(raptors, playerName);
    if (!player) throw new Error(`Raptors payroll player missing: ${playerName}`);
    player.salary = salary;
  });
  raptors.total_salary = 205_084_177;
  raptors.tax_status = "Luxury Tax";
}

function applyPhiladelphiaPayroll() {
  const sixers = teams.find((team) => team.name === "Philadelphia 76ers");
  if (!sixers) throw new Error("Roster correction team not found: Philadelphia 76ers");

  const labaronPhilon = findRosterPlayer(sixers, "Labaron Philon");
  const labaronPhilonJr = findRosterPlayer(sixers, "Labaron Philon Jr.");
  if (labaronPhilon && !labaronPhilonJr) labaronPhilon.name = "Labaron Philon Jr.";
  else if (labaronPhilon) removeRosterPlayer(sixers, "Labaron Philon");

  ["Caleb Love", "Duke Miles", "MarJon Beauchamp", "Rayan Rupert", "Tyrese Martin"].forEach((playerName) => {
    const player = findRosterPlayer(sixers, playerName);
    if (player) player.salary = null;
  });
  sixers.total_salary = 213_165_808;
}

function applyNuggetsPayroll() {
  const nuggets = teams.find((team) => team.name === "Denver Nuggets");
  if (!nuggets) throw new Error("Roster correction team not found: Denver Nuggets");

  removeRosterPlayer(nuggets, "Bruce Brown");
  getTeamPlayers(nuggets).forEach((player) => {
    if (!Object.hasOwn(NUGGETS_PAYROLL, player.name)) player.salary = null;
  });
  Object.entries(NUGGETS_PAYROLL).forEach(([playerName, salary]) => {
    const player = findRosterPlayer(nuggets, playerName);
    if (!player) throw new Error(`Nuggets payroll player missing: ${playerName}`);
    player.salary = salary;
  });
  nuggets.total_salary = 221_069_148;
  nuggets.tax_status = "Luxury Tax";
}

function applyLakersPayroll() {
  const lakers = teams.find((team) => team.name === "Los Angeles Lakers");
  if (!lakers) throw new Error("Roster correction team not found: Los Angeles Lakers");

  Object.entries(LAKERS_PAYROLL).forEach(([playerName, salary]) => {
    const player = findRosterPlayer(lakers, playerName);
    if (!player) throw new Error(`Lakers payroll player missing: ${playerName}`);
    player.salary = salary;
  });
  lakers.total_salary = 201_332_759;
}

function applyRocketsPayroll() {
  const rockets = teams.find((team) => team.name === "Houston Rockets");
  if (!rockets) throw new Error("Roster correction team not found: Houston Rockets");

  const unaccentedBogdan = findRosterPlayer(rockets, "Bogdan Bogdanovic");
  const accentedBogdan = findRosterPlayer(rockets, "Bogdan Bogdanović");
  if (unaccentedBogdan && accentedBogdan) removeRosterPlayer(rockets, "Bogdan Bogdanovic");
  else if (unaccentedBogdan) unaccentedBogdan.name = "Bogdan Bogdanović";

  getTeamPlayers(rockets).forEach((player) => {
    if (!Object.hasOwn(ROCKETS_PAYROLL, player.name)) player.salary = null;
  });
  Object.entries(ROCKETS_PAYROLL).forEach(([playerName, salary]) => {
    const player = findRosterPlayer(rockets, playerName);
    if (!player) throw new Error(`Rockets payroll player missing: ${playerName}`);
    player.salary = salary;
  });
  rockets.total_salary = 205_487_343;
}

function applyTimberwolvesPayroll() {
  const timberwolves = teams.find((team) => team.name === "Minnesota Timberwolves");
  if (!timberwolves) throw new Error("Roster correction team not found: Minnesota Timberwolves");

  getTeamPlayers(timberwolves).forEach((player) => {
    if (!Object.hasOwn(TIMBERWOLVES_PAYROLL, player.name)) player.salary = null;
  });
  Object.entries(TIMBERWOLVES_PAYROLL).forEach(([playerName, salary]) => {
    let player = findRosterPlayer(timberwolves, playerName);
    if (!player && playerName === "John Konchar") {
      player = {
        name: playerName,
        pos: "SG",
        pts: 0,
        reb: 0,
        ast: 0,
        stl: 0,
        blk: 0,
        tov: 0,
        fg: 0,
        fg3: 0,
        ft: 0
      };
      timberwolves.bench_2026_27 = timberwolves.bench_2026_27 || [];
      timberwolves.bench_2026_27.push(player);
    }
    if (!player) throw new Error(`Timberwolves payroll player missing: ${playerName}`);
    player.salary = salary;
  });
  timberwolves.total_salary = 215_327_417;
}

function applyScreenshotPayroll(teamName, payroll, total) {
  const team = teams.find((item) => item.name === teamName);
  if (!team) throw new Error(`Roster correction team not found: ${teamName}`);

  getTeamPlayers(team).forEach((player) => {
    if (!Object.hasOwn(payroll, player.name)) player.salary = null;
  });
  Object.entries(payroll).forEach(([playerName, salary]) => {
    const player = findRosterPlayer(team, playerName);
    if (!player) throw new Error(`${teamName} payroll player missing: ${playerName}`);
    player.salary = salary;
  });
  team.total_salary = total;
}

function applyScreenshotPayrollCorrections() {
  const dallas = teams.find((team) => team.name === "Dallas Mavericks");
  if (!dallas) throw new Error("Roster correction team not found: Dallas Mavericks");
  const morezJohnson = findRosterPlayer(dallas, "Morez Johnson");
  if (morezJohnson) morezJohnson.name = "Morez Johnson Jr.";

  const bucks = teams.find((team) => team.name === "Milwaukee Bucks");
  if (!bucks) throw new Error("Roster correction team not found: Milwaukee Bucks");
  const accentedBogoljub = findRosterPlayer(bucks, "Bogoljub Marković");
  if (accentedBogoljub) accentedBogoljub.name = "Bogoljub Markovic";

  const kings = teams.find((team) => team.name === "Sacramento Kings");
  if (!kings) throw new Error("Roster correction team not found: Sacramento Kings");
  let foundAcuff = false;
  ["starters_2026_27", "bench_2026_27"].forEach((rosterKey) => {
    kings[rosterKey] = (kings[rosterKey] || []).filter((player) => {
      if (player.name !== "Darius Acuff Jr.") return true;
      if (foundAcuff) return false;
      foundAcuff = true;
      return true;
    });
  });

  Object.entries(SCREENSHOT_PAYROLLS).forEach(([teamName, payroll]) => {
    applyScreenshotPayroll(teamName, payroll.salaries, payroll.total);
  });
  PLAYER_SALARY_CORRECTIONS.forEach(({ team: teamName, player: playerName, salary }) => {
    const team = teams.find((item) => item.name === teamName);
    if (!team) throw new Error(`Roster correction team not found: ${teamName}`);
    const player = findRosterPlayer(team, playerName);
    if (!player) throw new Error(`${teamName} payroll player missing: ${playerName}`);
    const previousSalary = Number(player.salary) || 0;
    player.salary = salary;
    adjustTeamPayroll(team, (salary ?? 0) - previousSalary);
  });
}

function applyTwoWayLabels() {
  Object.entries(TWO_WAY_CONTRACTS).forEach(([teamName, playerNames]) => {
    const team = teams.find((item) => item.name === teamName);
    if (!team) throw new Error(`Two-way contract team not found: ${teamName}`);

    playerNames.forEach((playerName) => {
      const player = findRosterPlayer(team, playerName);
      if (!player) throw new Error(`Two-way contract player missing: ${playerName}`);
      player.contract_type = "Two-Way";
    });
  });
}

function formatPlayerStats(player) {
  return [
    ["PTS", player.pts],
    ["REB", player.reb],
    ["AST", player.ast],
    ["STL", player.stl],
    ["BLK", player.blk]
  ].map(([label, value]) => {
    const stat = Number(value);
    return `${label} ${Number.isFinite(stat) ? stat.toFixed(1) : "—"}`;
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
  const rosterRows = getTeamPlayers(team).map((player, index) => {
    const playerId = getPlayerId(team.id, player.name);
    const destinationId = state.transfers[playerId];
    const salaryLabel = hasSalary(player) ? formatMoney(player.salary) : "Unavailable";
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
          <div class="roster-player__details">
            <div class="roster-player__heading">
              <span class="roster-player__name">${escapeHtml(player.name)}</span>
              <span class="roster-player__position">${escapeHtml(player.pos || "-")}</span>
              ${player.contract_type === "Two-Way" ? '<span class="roster-player__contract-type">2-WAY</span>' : ""}
            </div>
            <span class="roster-player__stats" aria-label="Per-game stats: ${escapeHtml(formatPlayerStats(player))}">${escapeHtml(formatPlayerStats(player))}</span>
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
    <section class="team-card">
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
        <div><strong>${formatMoney(payroll)}</strong><span>Team payroll</span></div>
        <div><strong class="money-out">-${formatMoney(flow.outgoing)}</strong><span>Outgoing</span></div>
        <div><strong class="money-in">+${formatMoney(flow.incoming)}</strong><span>Incoming</span></div>
        <div><strong>${formatMoney(afterTrade)}</strong><span>After trade</span></div>
      </div>
      <div class="asset-tabs" role="tablist" aria-label="${escapeHtml(team.name)} assets">
        <button type="button" class="asset-tab ${activeView === "roster" ? "is-active" : ""}" data-view="roster" data-team="${team.id}" role="tab" aria-selected="${activeView === "roster"}">Roster <span>${getTeamPlayers(team).length}</span></button>
        <button type="button" class="asset-tab ${activeView === "picks" ? "is-active" : ""}" data-view="picks" data-team="${team.id}" role="tab" aria-selected="${activeView === "picks"}">Picks <span>${picks.length}</span></button>
        <span class="asset-period">${activeView === "roster" ? "2026–27 salary" : "Tradeable draft assets"}</span>
      </div>
      ${rosterContent}
    </section>
  `;
}

function renderTradeBoard() {
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

  const outgoingRows = [
    ...outgoingPlayers.map(({ player, destination }) => `<div class="review-asset"><span>${escapeHtml(player.name)} <small>${escapeHtml(player.pos || "")}</small></span><strong>${formatMoney(player.salary)}</strong><em>To ${escapeHtml(destination?.name || "team")}</em></div>`),
    ...outgoingPicks.map(({ pick, destination }) => `<div class="review-asset review-asset--pick"><span>${escapeHtml(formatPick(pick))}</span><strong>Draft pick · ${escapeHtml(getPickTradeProtection(pick.assetId))}</strong><em>To ${escapeHtml(destination?.name || "team")}</em></div>`),
    ...outgoingSwaps.map(({ pick, targetPick, destination }) => `<div class="review-asset review-asset--pick"><span>${escapeHtml(formatPick(pick))} swap right</span><strong>${escapeHtml(swapDirectionLabel(state.pickSwaps[pick.assetId]))} against ${escapeHtml(formatPick(targetPick))}</strong><em>With ${escapeHtml(destination.name)}</em></div>`)
  ].join("");
  const incomingRows = [
    ...incomingPlayers.map(({ player, sender }) => `<div class="review-asset"><span>${escapeHtml(player.name)} <small>${escapeHtml(player.pos || "")}</small></span><strong>${formatMoney(player.salary)}</strong><em>From ${escapeHtml(sender?.name || "team")}</em></div>`),
    ...incomingPicks.map(({ pick, sender }) => `<div class="review-asset review-asset--pick"><span>${escapeHtml(formatPick(pick))}</span><strong>Draft pick · ${escapeHtml(getPickTradeProtection(pick.assetId))}</strong><em>From ${escapeHtml(sender?.name || "team")}</em></div>`),
    ...incomingSwaps.map(({ pick, targetPick, sender }) => `<div class="review-asset review-asset--pick"><span>Swap right on ${escapeHtml(formatPick(pick))}</span><strong>${escapeHtml(swapDirectionLabel(state.pickSwaps[pick.assetId]))} against ${escapeHtml(formatPick(targetPick))}</strong><em>From ${escapeHtml(sender.name)}</em></div>`)
  ].join("");

  return `
    <article class="review-team">
      <header class="review-team__header">
        <span class="review-team__badge">${getTeamAbbreviation(team)}</span>
        <div><h3>${escapeHtml(team.name)}</h3><span>TEAM ${state.teamIds.indexOf(teamId) + 1}</span></div>
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
    <p class="cba-estimate-note">Rule model uses estimated 2026–27 cap ${formatMoney(CBA_ESTIMATES.salaryCap)}, first apron ${formatMoney(CBA_ESTIMATES.firstApron)}, second apron ${formatMoney(CBA_ESTIMATES.secondApron)} and scaled salary-matching bands. This is a trade-planning estimate, not official NBA approval; protected picks need manual conveyance review.</p>
    <h2 class="review-assets-title">Trade assets by team</h2>
    <div class="review-team-grid">${state.teamIds.filter(Boolean).map(renderReviewTeam).join("")}</div>
  `;
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
    const verdictClass = trade.verdictStatus === "pass" ? "pass" : trade.verdictStatus === "fail" ? "fail" : "attention";
    return `
      <article class="saved-trade-row">
        <div class="saved-trade-main">
          <span class="saved-trade-verdict saved-trade-verdict--${verdictClass}">${escapeHtml(trade.verdict || "Saved")}</span>
          <strong>${escapeHtml(participants || "Trade proposal")}</strong>
          <span>${dateLabel} · ${assetCount} assets</span>
        </div>
        <div class="saved-trade-actions">
          <button type="button" class="button button--ghost saved-trade-load" data-trade-id="${escapeHtml(trade.id)}">Open</button>
          <button type="button" class="icon-button saved-trade-delete" data-trade-id="${escapeHtml(trade.id)}" aria-label="Delete saved trade" title="Delete saved trade">×</button>
        </div>
      </article>
    `;
  }).join("")}</div>`;

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

async function loadTeams() {
  apiStatusEl.textContent = "Connecting to API…";
  teamGridEl.innerHTML = '<div class="loading-state">Loading team data…</div>';

  try {
    const response = await fetch(`${API_URL}/api/v1/teams`, {
      headers: { "x-api-key": API_KEY }
    });
    if (!response.ok) throw new Error(`API request failed (${response.status})`);

    const data = await response.json();
    teams = data.teams || [];
    if (teams.length === 0) throw new Error("The API returned no teams.");

    applyRosterCorrections();
    applyRaptorsPayroll();
    applyPhiladelphiaPayroll();
    applyNuggetsPayroll();
    applyLakersPayroll();
    applyRocketsPayroll();
    applyTimberwolvesPayroll();
    applyScreenshotPayrollCorrections();
    applyTwoWayLabels();

    teams.forEach((team) => {
      const overrides = PLAYER_CONTRACT_OVERRIDES[team.name] || {};
      getTeamPlayers(team).forEach((player) => {
        const override = overrides[player.name];
        if (override) Object.assign(player, {
          salary: override.salary,
          contract_note: override.note,
          contract_label: override.label
        });
      });
    });

    const missingSalaries = teams.reduce((count, team) => count + getTeamPlayers(team).filter((player) => !hasSalary(player)).length, 0);
    apiStatusEl.textContent = missingSalaries === 0
      ? "API connected · player salaries received"
      : `API connected · ${missingSalaries} salaries unavailable`;
    apiStatusEl.classList.toggle("pill--warning", missingSalaries > 0);

    renderTradeBoard();
  } catch (error) {
    console.error("Trade machine API load failed:", error);
    apiStatusEl.textContent = "API connection failed";
    teamGridEl.innerHTML = '<div class="loading-state">Could not load teams. Check the API URL, network, and API key.</div>';
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
