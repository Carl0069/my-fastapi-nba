const DEFAULT_FALLBACK_HEADSHOT = "https://cdn.nba.com/headshots/nba/latest/1040x760/1643410.png";
const DEFAULT_AVATAR_FALLBACK = DEFAULT_FALLBACK_HEADSHOT;

const playerHeadshotIds = {
    "Donovan Mitchell": "1628378", "James Harden": "201935", "Evan Mobley": "1630596", "Jarrett Allen": "1628386",
    "Peyton Watson": "1631212", "Thomas Bryant": "1628418", "Sam Merrill": "1630241", "Craig Porter Jr.": "1641854",
    "Jaylon Tyson": "1642274", "Mario Hezonja": "1626209", "Khalifa Diop": "1631215", "Riley Minix": "1642436",
    "Nae'Qwan Tomlin": "1642531", "Tyrese Proctor": "1642289", "Meleek Thomas": "1642950", "Tristan Enaruna": "1642468",
    "Ernest Udeh, Jr.": "1642951", "VJ Edgecombe": "1642845", "Tyrese Maxey": "1630178", "Jaylen Brown": "1627759",
    "LeBron James": "2544", "Joel Embiid": "203954", "Kentavious Caldwell-Pope": "203484", "Anfernee Simons": "1629014",
    "Dean Wade": "1629731", "Rayan Rupert": "1641712", "Caleb Love": "1630584", "Tacko Fall": "1629605",
    "MarJon Beauchamp": "1630699", "Justin Edwards": "1642261", "Dillon Jones": "1642262", "Adem Bona": "1642364",
    "Jabari Walker": "1631133", "Dominick Barlow": "1631230", "Ariel Hukporti": "1630575", "Tyrese Martin": "1631213",
    "Josh Giddey": "1630581", "Nic Claxton": "1629651", "Matas Buzelis": "1641824", "Norman Powell": "1626181",
    "Patrick Williams": "1630172", "Rob Dillingham": "1642265", "Zach Collins": "1628380", "Jalen Smith": "1630188",
    "Tre Jones": "1630200", "Isaac Okoro": "1630171", "Leonard Miller": "1641757", "Derrick White": "1628401",
    "Baylor Scheierman": "1642260", "Paul George": "202331", "Jayson Tatum": "1628369", "Mitchell Robinson": "1629011",
    "Payton Pritchard": "1630202", "Ron Harper Jr.": "1631199", "Jordan Walsh": "1641775", "Hugo González": "1642855",
    "Sam Hauser": "1630573", "Mike Conley": "201144", "Luka Garza": "1630568", "Neemias Queta": "1629674",
    "Michael Porter Jr.": "1629008", "Julius Randle": "203944", "Day'Ron Sharpe": "1630549", "Moritz Wagner": "1629021",
    "Jalen Brunson": "1628973", "Josh Hart": "1628404", "Mikal Bridges": "1628969", "OG Anunoby": "1628384",
    "Karl-Anthony Towns": "1626157", "Immanuel Quickley": "1630193", "RJ Barrett": "1629628", "Kawhi Leonard": "202695",
    "Scottie Barnes": "1630567", "Jakob Poeltl": "1627751", "Cade Cunningham": "1630595", "Duncan Robinson": "1629130",
    "Ausar Thompson": "1641709", "John Collins": "1628381", "Jalen Duren": "1631105", "Tyrese Haliburton": "1630169",
    "Andrew Nembhard": "1629614", "Aaron Nesmith": "1630174", "Pascal Siakam": "1627783", "Ivica Zubac": "1627826",
    "Ryan Rollins": "1631157", "Tyler Herro": "1629639", "Jaime Jaquez Jr.": "1631170", "Kyle Kuzma": "1628398",
    "Myles Turner": "1626167", "Davion Mitchell": "1630558", "Tim Hardaway Jr.": "203501", "Andrew Wiggins": "203952",
    "Giannis Antetokounmpo": "203507", "Bam Adebayo": "1628389", "Klay Thompson": "202691", "C.J. McCollum": "203468",
    "Nickeil Alexander-Walker": "1629638", "Dyson Daniels": "1630700", "Jalen Johnson": "1630552", "Onyeka Okongwu": "1630168",
    "Coby White": "1629632", "Brandon Miller": "1641706", "Naz Reid": "1629675", "Moussa Diabaté": "1631217",
    "Jalen Suggs": "1630591", "Desmond Bane": "1630217", "Franz Wagner": "1630532", "Paolo Banchero": "1631094",
    "Wendell Carter Jr.": "1628976", "Trae Young": "1629027", "Kyshawn George": "1642267", "Bilal Coulibaly": "1641731",
    "Alex Sarr": "1642259", "Anthony Davis": "203076", "Jamal Murray": "1627750", "Christian Braun": "1631128",
    "DeMar DeRozan": "201942", "Aaron Gordon": "203932", "Nikola Jokić": "203999", "LaMelo Ball": "1630163",
    "Anthony Edwards": "1630162", "Jaden McDaniels": "1630183", "Jonathan Kuminga": "1630228", "Rudy Gobert": "203497",
    "Shai Gilgeous-Alexander": "1628983", "Cason Wallace": "1641717", "Jalen Williams": "1631114", "Chet Holmgren": "1631096",
    "Isaiah Hartenstein": "1628392", "Damian Lillard": "203081", "Ja Morant": "1629630", "Deni Avdija": "1630166",
    "Jeremy Sochan": "1631110", "Donovan Clingan": "1642270", "Keyonte George": "1641718", "Josh Green": "1630182",
    "Lauri Markkanen": "1628374", "Jaren Jackson Jr.": "1628991", "Jusuf Nurkić": "203994", "Stephen Curry": "201939",
    "Brandin Podziemski": "1641764", "Jimmy Butler": "202710", "Draymond Green": "203110", "Kristaps Porziņģis": "204001",
    "Kris Dunn": "1627739", "Darius Garland": "1629636", "Brandon Ingram": "1627742", "Rui Hachimura": "1629060",
    "Brook Lopez": "201572", "Luka Dončić": "1629029", "Austin Reaves": "1630559", "Quentin Grimes": "1629656",
    "Sandro Mamukelashvili": "1630572", "Walker Kessler": "1631117", "Devin Booker": "1626164", "Jalen Green": "1630224",
    "Dillon Brooks": "1628415", "Miles Bridges": "1628970", "Mark Williams": "1631109", "Zach LaVine": "203897",
    "De'Andre Hunter": "1629631", "Keegan Murray": "1631105", "Harrison Barnes": "203084", "Domantas Sabonis": "1627734",
    "Kyrie Irving": "202681", "Max Christie": "1631108", "Zaccharie Risacher": "1642258", "Cooper Flagg": "1642257",
    "Dereck Lively II": "1641726", "Fred VanVleet": "1627832", "Amen Thompson": "1641708", "Kevin Durant": "201142",
    "Jabari Smith Jr.": "1631095", "Alperen Şengün": "1630578", "Ty Jerome": "1629660", "Jaylen Wells": "1642377",
    "Zach Edey": "1641744", "Dejounte Murray": "1627749", "Trey Murphy III": "1630530", "Herb Jones": "1630529",
    "Zion Williamson": "1629627", "De'Aaron Fox": "1628368", "Stephon Castle": "1642264", "Devin Vassell": "1630170",
    "Julian Champagnie": "1630577", "Victor Wembanyama": "1641705"
};

const playerCustomPhotos = {
    "VJ Edgecombe": "https://cdn.nba.com/headshots/nba/latest/1040x760/1642845.png"
};

const playerHeadshotAliases = {
    teranceshannonjr: "terrenceshannonjr"
};

function normalizeHeadshotKey(playerName) {
    return String(playerName || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase()
        .replace(/[^a-z0-9]/g, "");
}

function normalizePlayerName(playerName) {
    if (!playerName) return "";
    return String(playerName)
        .replace(/\s+/g, " ")
        .replace(/\s+(Jr\.|Sr\.|II|III|IV)$/i, "")
        .replace(/[,']/g, "")
        .trim();
}

function getPlayerHeadshotId(playerName) {
    const key = normalizeHeadshotKey(playerName);
    if (!key) return null;

    const lookupKey = playerHeadshotAliases[key] || key;
    const nbaPlayerId = window.NBA_PLAYER_IDS?.[lookupKey];
    if (nbaPlayerId) return String(nbaPlayerId);

    const legacyEntry = Object.entries(playerHeadshotIds).find(
        ([name]) => normalizeHeadshotKey(name) === key
    );
    return legacyEntry ? String(legacyEntry[1]) : null;
}

function buildHeadshotUrlById(playerId) {
    if (!playerId) return DEFAULT_AVATAR_FALLBACK;
    return `https://cdn.nba.com/headshots/nba/latest/1040x760/${playerId}.png`;
}

function buildInitialsPortraitUrl(playerName) {
    const initials = getPlayerInitials(playerName).replace(/[^A-Z0-9]/g, "") || "NBA";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 400"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#183b56"/><stop offset="1" stop-color="#071725"/></linearGradient></defs><rect width="320" height="400" rx="24" fill="url(#bg)"/><circle cx="160" cy="145" r="82" fill="#ffffff" fill-opacity=".07"/><text x="160" y="177" fill="#facc15" font-family="Arial,sans-serif" font-size="74" font-weight="700" text-anchor="middle">${initials}</text><text x="160" y="342" fill="#cbd5e1" font-family="Arial,sans-serif" font-size="17" font-weight="700" letter-spacing="2" text-anchor="middle">PORTRAIT UNAVAILABLE</text></svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function getPlayerHeadshotUrl(playerName) {
    if (!playerName) return DEFAULT_AVATAR_FALLBACK;

    const namedPlayer = String(playerName).trim();
    const customPhoto = playerCustomPhotos[namedPlayer];
    if (customPhoto) return customPhoto;
    const playerId = getPlayerHeadshotId(namedPlayer);
    return playerId ? buildHeadshotUrlById(playerId) : buildInitialsPortraitUrl(namedPlayer);
}

function getPlayerInitials(playerName) {
    return String(playerName || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toLocaleUpperCase())
        .join("");
}

window.getPlayerHeadshotUrl = getPlayerHeadshotUrl;
window.getPlayerHeadshotId = getPlayerHeadshotId;
window.getPlayerInitials = getPlayerInitials;
