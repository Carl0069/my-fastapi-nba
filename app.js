const API_URL = "https://my-fastapi-nba.vercel.app";

let allTeams = [];
let currentHeadlineIndex = 0;
let headlineAutoTimer = null;
let selectedFranchise = "";
let selectedConference = "ALL";
let selectedTxFilter = "ALL";

// TEAM METADATA & FULL CHAMPIONSHIP YEARS ARCHIVE (ALL 30 TEAMS)
const teamMetadata = {
    "Boston Celtics": { logo: "https://cdn.nba.com/logos/nba/1610612738/primary/L/logo.svg", salary: 201437932, status: "Luxury Tax", rings: 18, years: [1957, 1959, 1960, 1961, 1962, 1963, 1964, 1965, 1966, 1968, 1969, 1974, 1976, 1981, 1984, 1986, 2008, 2024] },
    "Brooklyn Nets": { logo: "https://cdn.nba.com/logos/nba/1610612751/primary/L/logo.svg", salary: 160105139, status: "Under Cap", rings: 0, years: [] },
    "New York Knicks": { logo: "https://cdn.nba.com/logos/nba/1610612752/primary/L/logo.svg", salary: 217948756, status: "1st Apron", rings: 2, years: [1970, 1973] },
    "Philadelphia 76ers": { logo: "https://cdn.nba.com/logos/nba/1610612755/primary/L/logo.svg", salary: 206643098, status: "Luxury Tax", rings: 3, years: [1955, 1967, 1983] },
    "Toronto Raptors": { logo: "https://cdn.nba.com/logos/nba/1610612761/primary/L/logo.svg", salary: 202743041, status: "Luxury Tax", rings: 1, years: [2019] },
    "Chicago Bulls": { logo: "https://cdn.nba.com/logos/nba/1610612741/primary/L/logo.svg", salary: 161545080, status: "Under Cap", rings: 6, years: [1991, 1992, 1993, 1996, 1997, 1998] },
    "Cleveland Cavaliers": { logo: "https://cdn.nba.com/logos/nba/1610612739/primary/L/logo.svg", salary: 222920753, status: "2nd Apron", rings: 1, years: [2016] },
    "Detroit Pistons": { logo: "https://cdn.nba.com/logos/nba/1610612765/primary/L/logo.svg", salary: 153163826, status: "Under Cap", rings: 3, years: [1989, 1990, 2004] },
    "Indiana Pacers": { logo: "https://cdn.nba.com/logos/nba/1610612754/primary/L/logo.svg", salary: 203715395, status: "Luxury Tax", rings: 0, years: [] },
    "Milwaukee Bucks": { logo: "https://cdn.nba.com/logos/nba/1610612749/primary/L/logo.svg", salary: 191358866, status: "Over Cap", rings: 2, years: [1971, 2021] },
    "Atlanta Hawks": { logo: "https://cdn.nba.com/logos/nba/1610612737/primary/L/logo.svg", salary: 221278253, status: "1st Apron", rings: 1, years: [1958] },
    "Charlotte Hornets": { logo: "https://cdn.nba.com/logos/nba/1610612766/primary/L/logo.svg", salary: 174870647, status: "Over Cap", rings: 0, years: [] },
    "Miami Heat": { logo: "https://cdn.nba.com/logos/nba/1610612748/primary/L/logo.svg", salary: 204486535, status: "Luxury Tax", rings: 3, years: [2006, 2012, 2013] },
    "Orlando Magic": { logo: "https://cdn.nba.com/logos/nba/1610612753/primary/L/logo.svg", salary: 218125071, status: "1st Apron", rings: 0, years: [] },
    "Washington Wizards": { logo: "https://cdn.nba.com/logos/nba/1610612764/primary/L/logo.svg", salary: 189013104, status: "Over Cap", rings: 1, years: [1978] },
    "Denver Nuggets": { logo: "https://cdn.nba.com/logos/nba/1610612743/primary/L/logo.svg", salary: 215333328, status: "1st Apron", rings: 1, years: [2023] },
    "Minnesota Timberwolves": { logo: "https://cdn.nba.com/logos/nba/1610612750/primary/L/logo.svg", salary: 215871829, status: "1st Apron", rings: 0, years: [] },
    "Oklahoma City Thunder": { logo: "https://cdn.nba.com/logos/nba/1610612760/primary/L/logo.svg", salary: 214798992, status: "1st Apron", rings: 1, years: [1979] },
    "Portland Trail Blazers": { logo: "https://cdn.nba.com/logos/nba/1610612757/primary/L/logo.svg", salary: 194511148, status: "Over Cap", rings: 1, years: [1977] },
    "Utah Jazz": { logo: "https://cdn.nba.com/logos/nba/1610612762/primary/L/logo.svg", salary: 179365019, status: "Over Cap", rings: 0, years: [] },
    "Golden State Warriors": { logo: "https://cdn.nba.com/logos/nba/1610612744/primary/L/logo.svg", salary: 219763627, status: "1st Apron", rings: 7, years: [1947, 1956, 1975, 2015, 2017, 2018, 2022] },
    "LA Clippers": { logo: "https://cdn.nba.com/logos/nba/1610612746/primary/L/logo.svg", salary: 196862414, status: "Over Cap", rings: 0, years: [] },
    "Los Angeles Lakers": { logo: "https://cdn.nba.com/logos/nba/1610612747/primary/L/logo.svg", salary: 201332759, status: "Luxury Tax", rings: 17, years: [1949, 1950, 1952, 1953, 1954, 1972, 1980, 1982, 1985, 1987, 1988, 2000, 2001, 2002, 2009, 2010, 2020] },
    "Phoenix Suns": { logo: "https://cdn.nba.com/logos/nba/1610612756/primary/L/logo.svg", salary: 216225506, status: "1st Apron", rings: 0, years: [] },
    "Sacramento Kings": { logo: "https://cdn.nba.com/logos/nba/1610612758/primary/L/logo.svg", salary: 189346486, status: "Over Cap", rings: 1, years: [1951] },
    "Dallas Mavericks": { logo: "https://cdn.nba.com/logos/nba/1610612742/primary/L/logo.svg", salary: 197866094, status: "Over Cap", rings: 1, years: [2011] },
    "Houston Rockets": { logo: "https://cdn.nba.com/logos/nba/1610612745/primary/L/logo.svg", salary: 205487343, status: "Luxury Tax", rings: 2, years: [1994, 1995] },
    "Memphis Grizzlies": { logo: "https://cdn.nba.com/logos/nba/1610612763/primary/L/logo.svg", salary: 167642677, status: "Over Cap", rings: 0, years: [] },
    "New Orleans Pelicans": { logo: "https://cdn.nba.com/logos/nba/1610612740/primary/L/logo.svg", salary: 202241014, status: "Luxury Tax", rings: 0, years: [] },
    "San Antonio Spurs": { logo: "https://cdn.nba.com/logos/nba/1610612759/primary/L/logo.svg", salary: 198315672, status: "Over Cap", rings: 5, years: [1999, 2003, 2005, 2007, 2014] }
};

// 2025-26 OFFICIAL REGULAR SEASON BENCHMARK STATS (CBS SPORTS)
const playerStatsBenchmark = {
    "Derrick White": { pts: 15.2, reb: 4.2, ast: 5.1, stl: 1.0, blk: 1.3, tov: 1.5, fg: 46.1, fg3: 39.6, ft: 90.1 },
    "Baylor Scheierman": { pts: 6.8, reb: 2.7, ast: 1.6, stl: 0.5, blk: 0.2, tov: 0.8, fg: 42.4, fg3: 38.2, ft: 85.0 },
    "Paul George": { pts: 18.2, reb: 5.4, ast: 4.5, stl: 1.4, blk: 0.5, tov: 2.3, fg: 44.5, fg3: 38.8, ft: 88.5 },
    "Jayson Tatum": { pts: 26.8, reb: 8.4, ast: 5.4, stl: 1.1, blk: 0.6, tov: 2.5, fg: 46.5, fg3: 36.5, ft: 82.5 },
    "Mitchell Robinson": { pts: 6.2, reb: 8.8, ast: 0.7, stl: 1.1, blk: 1.2, tov: 0.9, fg: 66.5, fg3: 0.0, ft: 42.5 },

    "Egor Dëmin": { pts: 11.4, reb: 3.6, ast: 4.1, stl: 0.9, blk: 0.4, tov: 1.8, fg: 44.2, fg3: 36.4, ft: 79.5 },
    "Michael Porter Jr.": { pts: 17.5, reb: 7.1, ast: 1.6, stl: 0.6, blk: 0.7, tov: 1.3, fg: 48.8, fg3: 39.8, ft: 79.2 },
    "Julius Randle": { pts: 23.8, reb: 9.1, ast: 4.8, stl: 0.6, blk: 0.3, tov: 3.1, fg: 47.0, fg3: 31.5, ft: 76.8 },
    "Day'Ron Sharpe": { pts: 7.2, reb: 6.8, ast: 1.5, stl: 0.7, blk: 0.9, tov: 1.1, fg: 58.2, fg3: 0.0, ft: 62.5 },

    "Jalen Brunson": { pts: 26.5, reb: 3.2, ast: 7.3, stl: 0.9, blk: 0.2, tov: 2.4, fg: 48.0, fg3: 38.5, ft: 84.0 },
    "Josh Hart": { pts: 10.1, reb: 8.6, ast: 4.5, stl: 1.1, blk: 0.3, tov: 1.6, fg: 44.2, fg3: 31.8, ft: 79.5 },
    "Mikal Bridges": { pts: 18.2, reb: 4.1, ast: 3.4, stl: 1.2, blk: 0.8, tov: 1.5, fg: 44.5, fg3: 37.8, ft: 82.0 },
    "OG Anunoby": { pts: 15.4, reb: 4.4, ast: 1.8, stl: 1.7, blk: 0.9, tov: 1.2, fg: 49.2, fg3: 38.6, ft: 76.0 },
    "Karl-Anthony Towns": { pts: 24.2, reb: 11.5, ast: 3.1, stl: 0.7, blk: 0.9, tov: 2.6, fg: 51.2, fg3: 42.0, ft: 88.0 },

    "Tyrese Maxey": { pts: 26.3, reb: 3.6, ast: 6.1, stl: 1.1, blk: 0.8, tov: 2.2, fg: 45.4, fg3: 37.5, ft: 87.2 },
    "VJ Edgecombe": { pts: 15.2, reb: 4.8, ast: 3.4, stl: 1.3, blk: 0.6, tov: 2.0, fg: 45.6, fg3: 36.8, ft: 80.2 },
    "Jaylen Brown": { pts: 22.5, reb: 5.6, ast: 3.7, stl: 1.2, blk: 0.6, tov: 2.4, fg: 50.1, fg3: 35.8, ft: 71.0 },
    "LeBron James": { pts: 24.4, reb: 7.8, ast: 8.2, stl: 1.2, blk: 0.6, tov: 3.2, fg: 51.3, fg3: 37.6, ft: 78.2 },
    "Joel Embiid": { pts: 24.9, reb: 8.5, ast: 4.5, stl: 0.9, blk: 1.6, tov: 3.0, fg: 45.4, fg3: 33.3, ft: 86.5 },

    "Immanuel Quickley": { pts: 17.8, reb: 4.6, ast: 6.4, stl: 1.0, blk: 0.2, tov: 1.8, fg: 43.8, fg3: 39.8, ft: 84.5 },
    "RJ Barrett": { pts: 21.4, reb: 6.2, ast: 4.0, stl: 0.7, blk: 0.4, tov: 2.2, fg: 49.8, fg3: 39.0, ft: 63.5 },
    "Kawhi Leonard": { pts: 22.8, reb: 6.0, ast: 3.4, stl: 1.6, blk: 0.8, tov: 1.7, fg: 52.0, fg3: 41.2, ft: 88.0 },
    "Scottie Barnes": { pts: 20.2, reb: 8.4, ast: 5.9, stl: 1.3, blk: 1.5, tov: 2.8, fg: 47.8, fg3: 34.5, ft: 78.5 },
    "Jakob Poeltl": { pts: 11.5, reb: 8.8, ast: 2.6, stl: 0.7, blk: 1.5, tov: 1.4, fg: 65.8, fg3: 0.0, ft: 56.0 },

    "Josh Giddey": { pts: 13.8, reb: 7.2, ast: 5.8, stl: 0.9, blk: 0.6, tov: 2.6, fg: 48.0, fg3: 34.5, ft: 81.2 },
    "Norman Powell": { pts: 14.2, reb: 2.8, ast: 1.3, stl: 0.8, blk: 0.3, tov: 1.4, fg: 48.8, fg3: 43.8, ft: 83.5 },
    "Matas Buzelis": { pts: 12.4, reb: 4.6, ast: 1.5, stl: 0.8, blk: 1.5, tov: 1.3, fg: 46.0, fg3: 35.3, ft: 79.5 },
    "Nic Claxton": { pts: 11.5, reb: 9.6, ast: 2.0, stl: 0.6, blk: 1.1, tov: 1.3, fg: 63.2, fg3: 20.0, ft: 56.0 },

    "James Harden": { pts: 16.8, reb: 5.2, ast: 8.4, stl: 1.2, blk: 0.6, tov: 2.9, fg: 43.0, fg3: 38.5, ft: 88.0 },
    "Donovan Mitchell": { pts: 26.2, reb: 5.0, ast: 5.8, stl: 1.5, blk: 0.4, tov: 2.8, fg: 46.5, fg3: 37.0, ft: 86.8 },
    "Peyton Watson": { pts: 7.8, reb: 3.6, ast: 1.4, stl: 0.7, blk: 1.1, tov: 0.9, fg: 47.5, fg3: 31.5, ft: 68.0 },
    "Evan Mobley": { pts: 17.2, reb: 9.6, ast: 3.4, stl: 0.9, blk: 1.8, tov: 1.8, fg: 58.2, fg3: 37.8, ft: 72.5 },
    "Jarrett Allen": { pts: 16.2, reb: 10.4, ast: 2.5, stl: 0.7, blk: 1.7, tov: 1.5, fg: 63.8, fg3: 0.0, ft: 74.5 },

    "Cade Cunningham": { pts: 23.4, reb: 4.5, ast: 7.8, stl: 1.0, blk: 0.8, tov: 3.4, fg: 45.2, fg3: 36.0, ft: 87.2 },
    "Ausar Thompson": { pts: 9.8, reb: 6.9, ast: 2.4, stl: 1.4, blk: 1.8, tov: 1.5, fg: 49.2, fg3: 21.8, ft: 62.5 },
    "Duncan Robinson": { pts: 11.8, reb: 2.4, ast: 2.6, stl: 0.6, blk: 0.2, tov: 1.1, fg: 44.8, fg3: 39.2, ft: 88.5 },
    "John Collins": { pts: 14.8, reb: 8.2, ast: 1.2, stl: 0.6, blk: 0.7, tov: 1.4, fg: 53.5, fg3: 37.4, ft: 80.0 },
    "Jalen Duren": { pts: 14.2, reb: 11.8, ast: 2.6, stl: 0.6, blk: 0.8, tov: 1.9, fg: 62.4, fg3: 0.0, ft: 79.5 },

    "Tyrese Haliburton": { pts: 18.5, reb: 3.8, ast: 9.2, stl: 1.4, blk: 0.6, tov: 2.3, fg: 46.0, fg3: 35.5, ft: 85.0 },
    "Andrew Nembhard": { pts: 10.2, reb: 2.4, ast: 4.6, stl: 0.9, blk: 0.2, tov: 1.4, fg: 50.2, fg3: 36.2, ft: 81.0 },
    "Aaron Nesmith": { pts: 12.6, reb: 3.9, ast: 1.6, stl: 1.0, blk: 0.4, tov: 1.1, fg: 49.8, fg3: 42.1, ft: 78.5 },
    "Pascal Siakam": { pts: 21.2, reb: 7.0, ast: 4.2, stl: 0.9, blk: 0.4, tov: 1.9, fg: 53.8, fg3: 38.8, ft: 73.5 },
    "Ivica Zubac": { pts: 12.4, reb: 9.8, ast: 1.5, stl: 0.4, blk: 1.3, tov: 1.3, fg: 65.2, fg3: 0.0, ft: 72.8 },

    "Ryan Rollins": { pts: 6.8, reb: 2.1, ast: 2.4, stl: 0.7, blk: 0.2, tov: 1.0, fg: 43.5, fg3: 36.8, ft: 78.5 },
    "Tyler Herro": { pts: 21.2, reb: 5.4, ast: 4.6, stl: 0.8, blk: 0.2, tov: 2.2, fg: 44.5, fg3: 39.8, ft: 86.0 },
    "Jaime Jaquez Jr.": { pts: 12.5, reb: 4.2, ast: 2.8, stl: 1.1, blk: 0.3, tov: 1.5, fg: 49.5, fg3: 33.5, ft: 82.5 },
    "Kyle Kuzma": { pts: 21.8, reb: 6.4, ast: 4.0, stl: 0.5, blk: 0.7, tov: 2.5, fg: 46.0, fg3: 33.2, ft: 77.0 },
    "Myles Turner": { pts: 16.8, reb: 6.8, ast: 1.4, stl: 0.6, blk: 1.6, tov: 1.4, fg: 52.8, fg3: 36.2, ft: 77.8 },

    "C.J. McCollum": { pts: 18.8, reb: 4.1, ast: 4.4, stl: 0.9, blk: 0.5, tov: 1.7, fg: 45.5, fg3: 42.5, ft: 82.0 },
    "Nickeil Alexander-Walker": { pts: 8.8, reb: 2.2, ast: 2.6, stl: 0.9, blk: 0.5, tov: 1.0, fg: 44.2, fg3: 39.5, ft: 80.5 },
    "Dyson Daniels": { pts: 9.5, reb: 5.4, ast: 4.3, stl: 2.4, blk: 0.8, tov: 1.8, fg: 46.8, fg3: 34.2, ft: 70.5 },
    "Jalen Johnson": { pts: 17.5, reb: 9.1, ast: 4.4, stl: 1.3, blk: 0.9, tov: 2.5, fg: 52.0, fg3: 36.1, ft: 74.0 },
    "Onyeka Okongwu": { pts: 10.6, reb: 7.1, ast: 1.4, stl: 0.6, blk: 1.1, tov: 1.0, fg: 61.5, fg3: 33.5, ft: 79.5 },

    "Coby White": { pts: 18.8, reb: 4.4, ast: 4.9, stl: 0.7, blk: 0.2, tov: 2.1, fg: 44.5, fg3: 37.2, ft: 83.5 },
    "Kon Knueppel": { pts: 13.5, reb: 3.9, ast: 2.6, stl: 0.8, blk: 0.3, tov: 1.2, fg: 47.1, fg3: 41.2, ft: 88.5 },
    "Brandon Miller": { pts: 18.5, reb: 4.6, ast: 2.8, stl: 1.0, blk: 0.6, tov: 1.9, fg: 45.2, fg3: 38.0, ft: 83.5 },
    "Naz Reid": { pts: 13.8, reb: 5.4, ast: 1.4, stl: 0.8, blk: 1.0, tov: 1.4, fg: 48.0, fg3: 41.8, ft: 74.0 },
    "Moussa Diabaté": { pts: 5.2, reb: 6.4, ast: 0.8, stl: 0.6, blk: 1.0, tov: 0.7, fg: 59.5, fg3: 0.0, ft: 64.2 },

    "Davion Mitchell": { pts: 6.4, reb: 1.6, ast: 2.7, stl: 0.8, blk: 0.2, tov: 0.9, fg: 46.0, fg3: 37.2, ft: 74.0 },
    "Tim Hardaway Jr.": { pts: 13.8, reb: 3.0, ast: 1.6, stl: 0.5, blk: 0.1, tov: 1.0, fg: 40.0, fg3: 35.0, ft: 85.0 },
    "Andrew Wiggins": { pts: 13.0, reb: 4.4, ast: 1.6, stl: 0.9, blk: 1.0, tov: 1.4, fg: 45.0, fg3: 35.5, ft: 75.0 },
    "Giannis Antetokounmpo": { pts: 30.4, reb: 11.9, ast: 6.1, stl: 1.2, blk: 1.1, tov: 3.4, fg: 60.1, fg3: 24.5, ft: 61.8 },
    "Bam Adebayo": { pts: 19.4, reb: 10.6, ast: 4.1, stl: 1.2, blk: 0.9, tov: 2.3, fg: 52.4, fg3: 35.8, ft: 75.8 },

    "Jalen Suggs": { pts: 13.4, reb: 3.4, ast: 3.2, stl: 1.5, blk: 0.6, tov: 1.9, fg: 47.5, fg3: 40.1, ft: 76.8 },
    "Desmond Bane": { pts: 22.8, reb: 4.5, ast: 5.2, stl: 1.1, blk: 0.5, tov: 2.4, fg: 46.0, fg3: 37.8, ft: 86.5 },
    "Franz Wagner": { pts: 20.4, reb: 5.6, ast: 4.0, stl: 1.2, blk: 0.4, tov: 1.9, fg: 48.8, fg3: 30.5, ft: 85.8 },
    "Paolo Banchero": { pts: 23.5, reb: 7.2, ast: 5.8, stl: 0.9, blk: 0.6, tov: 3.1, fg: 46.2, fg3: 34.8, ft: 73.5 },
    "Wendell Carter Jr.": { pts: 11.2, reb: 7.1, ast: 1.8, stl: 0.6, blk: 1.7, tov: 1.3, fg: 52.8, fg3: 37.6, ft: 70.0 },

    "Trae Young": { pts: 24.5, reb: 3.1, ast: 11.6, stl: 1.3, blk: 0.2, tov: 4.1, fg: 42.5, fg3: 36.0, ft: 86.5 },
    "Kyshawn George": { pts: 9.8, reb: 3.6, ast: 2.5, stl: 0.9, blk: 0.5, tov: 1.3, fg: 42.8, fg3: 36.5, ft: 78.5 },
    "Anthony Davis": { pts: 25.4, reb: 12.1, ast: 3.2, stl: 1.2, blk: 2.3, tov: 2.1, fg: 54.2, fg3: 30.0, ft: 80.5 },
    "Alex Sarr": { pts: 12.5, reb: 6.8, ast: 2.1, stl: 0.7, blk: 1.8, tov: 1.5, fg: 42.8, fg3: 31.5, ft: 72.0 },

    "Jamal Murray": { pts: 20.8, reb: 4.0, ast: 6.2, stl: 1.0, blk: 0.6, tov: 2.1, fg: 47.8, fg3: 41.8, ft: 85.0 },
    "Christian Braun": { pts: 8.9, reb: 4.2, ast: 2.0, stl: 0.8, blk: 0.5, tov: 0.8, fg: 47.8, fg3: 39.5, ft: 72.0 },
    "Cameron Johnson": { pts: 13.6, reb: 4.3, ast: 2.5, stl: 0.8, blk: 0.4, tov: 0.9, fg: 44.8, fg3: 39.4, ft: 79.2 },
    "Aaron Gordon": { pts: 14.2, reb: 6.6, ast: 3.6, stl: 0.8, blk: 0.6, tov: 1.5, fg: 55.8, fg3: 29.5, ft: 66.2 },
    "Nikola Jokić": { pts: 29.6, reb: 12.8, ast: 10.2, stl: 1.5, blk: 0.8, tov: 3.2, fg: 57.6, fg3: 41.2, ft: 80.5 },

    "LaMelo Ball": { pts: 23.5, reb: 5.0, ast: 7.8, stl: 1.4, blk: 0.3, tov: 3.5, fg: 43.0, fg3: 35.2, ft: 86.0 },
    "Anthony Edwards": { pts: 27.2, reb: 5.7, ast: 5.1, stl: 1.4, blk: 0.8, tov: 3.1, fg: 46.5, fg3: 40.2, ft: 84.5 },
    "Jaden McDaniels": { pts: 11.4, reb: 3.5, ast: 1.7, stl: 1.0, blk: 1.0, tov: 1.2, fg: 49.5, fg3: 35.0, ft: 74.0 },
    "Jonathan Kuminga": { pts: 16.8, reb: 5.2, ast: 2.5, stl: 0.8, blk: 0.6, tov: 1.8, fg: 53.4, fg3: 33.0, ft: 75.8 },
    "Rudy Gobert": { pts: 13.8, reb: 12.7, ast: 1.2, stl: 0.6, blk: 1.6, tov: 1.5, fg: 65.8, fg3: 0.0, ft: 63.5 },

    "Shai Gilgeous-Alexander": { pts: 32.7, reb: 5.0, ast: 6.4, stl: 1.8, blk: 0.8, tov: 2.2, fg: 51.9, fg3: 37.5, ft: 89.8 },
    "Cason Wallace": { pts: 8.2, reb: 2.8, ast: 2.1, stl: 1.2, blk: 0.5, tov: 0.7, fg: 50.2, fg3: 42.5, ft: 80.0 },
    "Jalen Williams": { pts: 19.8, reb: 4.3, ast: 4.8, stl: 1.3, blk: 0.7, tov: 1.9, fg: 54.5, fg3: 43.1, ft: 82.0 },
    "Chet Holmgren": { pts: 17.4, reb: 8.4, ast: 2.7, stl: 0.7, blk: 1.9, tov: 1.7, fg: 53.8, fg3: 37.8, ft: 80.5 },
    "Isaiah Hartenstein": { pts: 8.2, reb: 8.6, ast: 2.6, stl: 1.0, blk: 1.1, tov: 1.2, fg: 64.8, fg3: 33.3, ft: 71.0 },

    "Ja Morant": { pts: 24.6, reb: 5.4, ast: 7.8, stl: 1.1, blk: 0.3, tov: 3.0, fg: 46.8, fg3: 28.0, ft: 81.0 },
    "Damian Lillard": { pts: 23.8, reb: 4.2, ast: 6.8, stl: 0.9, blk: 0.2, tov: 2.5, fg: 42.8, fg3: 35.8, ft: 92.2 },
    "Toumani Camara": { pts: 8.6, reb: 5.4, ast: 1.6, stl: 1.2, blk: 0.5, tov: 1.1, fg: 46.2, fg3: 35.0, ft: 77.5 },
    "Deni Avdija": { pts: 15.4, reb: 7.6, ast: 4.1, stl: 0.9, blk: 0.5, tov: 2.1, fg: 51.2, fg3: 38.0, ft: 75.2 },
    "Donovan Clingan": { pts: 9.2, reb: 8.1, ast: 1.4, stl: 0.5, blk: 1.7, tov: 1.3, fg: 59.5, fg3: 25.0, ft: 60.0 },

    "Keyonte George": { pts: 14.5, reb: 3.2, ast: 5.2, stl: 0.7, blk: 0.2, tov: 2.5, fg: 40.8, fg3: 34.9, ft: 79.2 },
    "Lauri Markkanen": { pts: 22.8, reb: 8.0, ast: 2.1, stl: 0.8, blk: 0.6, tov: 1.4, fg: 47.8, fg3: 39.5, ft: 89.5 },
    "Jaren Jackson Jr.": { pts: 22.2, reb: 5.4, ast: 2.2, stl: 1.2, blk: 1.8, tov: 2.1, fg: 44.8, fg3: 32.5, ft: 81.2 },
    "Jusuf Nurkić": { pts: 10.6, reb: 10.8, ast: 3.8, stl: 1.0, blk: 1.1, tov: 2.1, fg: 50.8, fg3: 24.0, ft: 63.8 },

    "Stephen Curry": { pts: 24.2, reb: 4.4, ast: 6.1, stl: 0.8, blk: 0.4, tov: 2.7, fg: 44.8, fg3: 39.8, ft: 92.5 },
    "Brandin Podziemski": { pts: 11.5, reb: 6.2, ast: 4.4, stl: 1.0, blk: 0.2, tov: 1.4, fg: 46.8, fg3: 39.4, ft: 68.0 },
    "Jimmy Butler": { pts: 20.2, reb: 5.1, ast: 4.8, stl: 1.4, blk: 0.4, tov: 1.6, fg: 49.5, fg3: 41.0, ft: 85.5 },
    "Draymond Green": { pts: 8.4, reb: 7.0, ast: 5.8, stl: 1.0, blk: 0.9, tov: 2.1, fg: 49.2, fg3: 39.0, ft: 72.5 },
    "Kristaps Porziņģis": { pts: 19.8, reb: 7.0, ast: 1.9, stl: 0.6, blk: 1.8, tov: 1.6, fg: 51.2, fg3: 37.2, ft: 85.5 },

    "Darius Garland": { pts: 18.4, reb: 2.8, ast: 6.8, stl: 1.1, blk: 0.1, tov: 2.4, fg: 44.8, fg3: 37.5, ft: 83.8 },
    "Kris Dunn": { pts: 5.6, reb: 3.0, ast: 4.0, stl: 1.5, blk: 0.4, tov: 1.2, fg: 47.5, fg3: 37.2, ft: 69.2 },
    "Brandon Ingram": { pts: 20.4, reb: 5.0, ast: 5.6, stl: 0.9, blk: 0.6, tov: 2.4, fg: 49.0, fg3: 35.2, ft: 80.5 },
    "Rui Hachimura": { pts: 13.4, reb: 4.2, ast: 1.3, stl: 0.5, blk: 0.3, tov: 1.0, fg: 53.4, fg3: 42.0, ft: 74.2 },
    "Brook Lopez": { pts: 12.2, reb: 5.0, ast: 1.5, stl: 0.5, blk: 1.2, tov: 1.0, fg: 48.2, fg3: 36.2, ft: 82.5 },

    "Luka Dončić": { pts: 28.2, reb: 8.2, ast: 7.8, stl: 1.4, blk: 0.5, tov: 3.6, fg: 45.2, fg3: 35.5, ft: 78.5 },
    "Austin Reaves": { pts: 16.2, reb: 4.4, ast: 5.7, stl: 0.8, blk: 0.3, tov: 2.0, fg: 48.8, fg3: 37.0, ft: 85.8 },
    "Quentin Grimes": { pts: 8.4, reb: 2.4, ast: 1.6, stl: 0.8, blk: 0.3, tov: 0.9, fg: 40.5, fg3: 36.2, ft: 80.1 },
    "Sandro Mamukelashvili": { pts: 5.8, reb: 3.9, ast: 1.4, stl: 0.4, blk: 0.4, tov: 0.7, fg: 48.5, fg3: 32.1, ft: 76.0 },
    "Walker Kessler": { pts: 9.4, reb: 8.8, ast: 1.1, stl: 0.5, blk: 2.6, tov: 1.2, fg: 66.8, fg3: 21.1, ft: 62.4 },

    "Devin Booker": { pts: 25.8, reb: 4.1, ast: 7.1, stl: 1.0, blk: 0.4, tov: 2.6, fg: 47.0, fg3: 34.5, ft: 89.0 },
    "Jalen Green": { pts: 20.4, reb: 5.4, ast: 3.8, stl: 0.9, blk: 0.3, tov: 2.2, fg: 43.5, fg3: 34.6, ft: 81.5 },
    "Dillon Brooks": { pts: 12.5, reb: 3.3, ast: 1.6, stl: 0.9, blk: 0.2, tov: 1.3, fg: 42.5, fg3: 35.5, ft: 84.0 },
    "Miles Bridges": { pts: 20.6, reb: 7.1, ast: 3.2, stl: 0.9, blk: 0.5, tov: 1.9, fg: 46.0, fg3: 34.5, ft: 82.0 },
    "Mark Williams": { pts: 12.5, reb: 9.5, ast: 1.1, stl: 0.6, blk: 0.9, tov: 1.2, fg: 64.5, fg3: 0.0, ft: 71.5 },

    "Zach LaVine": { pts: 19.2, reb: 5.0, ast: 3.8, stl: 0.8, blk: 0.3, tov: 2.2, fg: 45.0, fg3: 34.5, ft: 85.0 },
    "De'Andre Hunter": { pts: 15.4, reb: 3.8, ast: 1.4, stl: 0.8, blk: 0.3, tov: 1.3, fg: 45.5, fg3: 38.2, ft: 84.2 },
    "Keegan Murray": { pts: 16.1, reb: 5.8, ast: 1.9, stl: 1.0, blk: 0.7, tov: 1.2, fg: 46.2, fg3: 36.8, ft: 84.0 },
    "Domantas Sabonis": { pts: 19.4, reb: 13.9, ast: 8.2, stl: 0.9, blk: 0.6, tov: 3.3, fg: 59.4, fg3: 37.9, ft: 70.4 },

    "Kyrie Irving": { pts: 25.2, reb: 4.8, ast: 5.1, stl: 1.3, blk: 0.5, tov: 1.8, fg: 49.5, fg3: 40.8, ft: 90.2 },
    "Max Christie": { pts: 5.6, reb: 2.5, ast: 1.2, stl: 0.5, blk: 0.3, tov: 0.7, fg: 44.0, fg3: 37.2, ft: 80.0 },
    "Zaccharie Risacher": { pts: 13.5, reb: 4.2, ast: 1.8, stl: 0.9, blk: 0.6, tov: 1.4, fg: 43.5, fg3: 35.2, ft: 74.5 },
    "Cooper Flagg": { pts: 18.7, reb: 8.1, ast: 4.2, stl: 1.4, blk: 0.9, tov: 2.2, fg: 48.6, fg3: 35.1, ft: 81.4 },
    "Dereck Lively II": { pts: 9.8, reb: 7.8, ast: 1.5, stl: 0.7, blk: 1.5, tov: 1.1, fg: 73.2, fg3: 0.0, ft: 54.0 },

    "Fred VanVleet": { pts: 17.2, reb: 3.7, ast: 8.0, stl: 1.4, blk: 0.8, tov: 1.8, fg: 41.8, fg3: 38.5, ft: 86.2 },
    "Amen Thompson": { pts: 12.8, reb: 7.5, ast: 3.8, stl: 1.4, blk: 0.7, tov: 1.8, fg: 54.5, fg3: 17.5, ft: 71.0 },
    "Kevin Durant": { pts: 26.8, reb: 6.3, ast: 4.2, stl: 0.9, blk: 0.9, tov: 2.8, fg: 52.5, fg3: 41.5, ft: 86.5 },
    "Jabari Smith Jr.": { pts: 14.8, reb: 8.6, ast: 1.8, stl: 0.8, blk: 0.9, tov: 1.3, fg: 46.5, fg3: 37.8, ft: 83.5 },
    "Alperen Şengün": { pts: 21.4, reb: 9.5, ast: 5.2, stl: 1.2, blk: 1.1, tov: 2.7, fg: 54.0, fg3: 30.0, ft: 69.8 },

    "Ty Jerome": { pts: 7.8, reb: 1.9, ast: 3.2, stl: 0.7, blk: 0.1, tov: 1.0, fg: 47.5, fg3: 38.8, ft: 88.2 },
    "Jaylen Wells": { pts: 10.2, reb: 3.6, ast: 1.8, stl: 0.7, blk: 0.3, tov: 1.1, fg: 44.8, fg3: 38.5, ft: 83.0 },
    "Cedric Coward": { pts: 7.8, reb: 3.4, ast: 1.4, stl: 0.7, blk: 0.4, tov: 0.9, fg: 44.8, fg3: 35.5, ft: 77.0 },
    "Zach Edey": { pts: 14.2, reb: 9.2, ast: 1.2, stl: 0.4, blk: 1.6, tov: 1.6, fg: 62.5, fg3: 0.0, ft: 72.0 },

    "Dejounte Murray": { pts: 22.2, reb: 5.1, ast: 6.2, stl: 1.5, blk: 0.3, tov: 2.4, fg: 45.6, fg3: 36.0, ft: 79.0 },
    "Trey Murphy III": { pts: 15.6, reb: 5.2, ast: 2.5, stl: 0.9, blk: 0.5, tov: 1.2, fg: 45.1, fg3: 39.2, ft: 83.0 },
    "Herb Jones": { pts: 11.2, reb: 3.7, ast: 2.7, stl: 1.5, blk: 0.9, tov: 1.3, fg: 50.0, fg3: 42.0, ft: 87.0 },
    "Zion Williamson": { pts: 23.2, reb: 5.9, ast: 5.1, stl: 1.0, blk: 0.7, tov: 2.8, fg: 57.4, fg3: 33.5, ft: 70.5 },
    "Derik Queen": { pts: 11.6, reb: 7.2, ast: 2.4, stl: 0.8, blk: 0.9, tov: 1.7, fg: 54.1, fg3: 28.0, ft: 72.8 },

    "De'Aaron Fox": { pts: 26.2, reb: 4.5, ast: 5.4, stl: 1.8, blk: 0.4, tov: 2.6, fg: 46.2, fg3: 36.6, ft: 73.5 },
    "Stephon Castle": { pts: 14.7, reb: 3.7, ast: 4.1, stl: 1.2, blk: 0.4, tov: 2.1, fg: 44.8, fg3: 30.5, ft: 72.9 },
    "Devin Vassell": { pts: 19.2, reb: 3.7, ast: 4.0, stl: 1.1, blk: 0.4, tov: 1.6, fg: 47.0, fg3: 37.0, ft: 80.0 },
    "Tobias Harris": { pts: 16.8, reb: 6.3, ast: 3.0, stl: 0.8, blk: 0.5, tov: 1.3, fg: 48.5, fg3: 35.0, ft: 87.5 },
    "Victor Wembanyama": { pts: 24.3, reb: 11.0, ast: 3.7, stl: 1.3, blk: 3.1, tov: 3.1, fg: 47.5, fg3: 34.5, ft: 82.5 }
};

// HEADLINES
const headlines = [
    {
        category: "BLOCKBUSTER TRADE",
        headline: "Giannis Antetokounmpo & Klay Thompson Unite with Miami Heat",
        story: "In a seismic Eastern Conference shakeup, the Heat acquire Giannis Antetokounmpo from Milwaukee to pair with Bam Adebayo, followed by signing veteran champion Klay Thompson.",
        pills: ["Trade: Giannis to Miami", "Signing: Klay Thompson", "Miami Heat"],
        logo: "https://cdn.nba.com/logos/nba/1610612748/primary/L/logo.svg",
        bgGradient: "radial-gradient(circle at 80% 50%, #98002e 0%, #30000a 100%)"
    },
    {
        category: "WOLVES RESTRUCTURE",
        headline: "Jonathan Kuminga Inks 2-Year Deal with Timberwolves; LaMelo Ball Acquired",
        story: "Minnesota fortifies its core around Anthony Edwards by signing forward Jonathan Kuminga to a 2-year contract, while adding All-Star guard LaMelo Ball, Cody Williams, and John Konchar.",
        pills: ["Signing: 2-Year Deal", "Trade: LaMelo Ball", "Minnesota Timberwolves"],
        logo: "https://cdn.nba.com/logos/nba/1610612750/primary/L/logo.svg",
        bgGradient: "radial-gradient(circle at 80% 50%, #0c2340 0%, #04101e 100%)"
    },
    {
        category: "SUPERTEAM FORMED",
        headline: "LeBron James Signs with 76ers; Jaylen Brown Acquired from Boston",
        story: "Philadelphia executes a historic summer, signing LeBron James in free agency and landing Jaylen Brown via trade to join MVP center Joel Embiid and Tyrese Maxey.",
        pills: ["Signing: LeBron James", "Trade: Jaylen Brown", "Philadelphia 76ers"],
        logo: "https://cdn.nba.com/logos/nba/1610612755/primary/L/logo.svg",
        bgGradient: "radial-gradient(circle at 80% 50%, #006bb6 0%, #041b3d 100%)"
    },
    {
        category: "LAKERS REBUILD",
        headline: "Lakers Acquire Walker Kessler & Re-Sign Austin Reaves",
        story: "Los Angeles completes a targeted retool, acquiring defensive anchor Walker Kessler from Utah, adding Matisse Thybulle and Collin Sexton, while securing Austin Reaves on a long-term deal.",
        pills: ["Trade: Walker Kessler", "Re-Signed: Austin Reaves", "Los Angeles Lakers"],
        logo: "https://cdn.nba.com/logos/nba/1610612747/primary/L/logo.svg",
        bgGradient: "radial-gradient(circle at 80% 50%, #552583 0%, #1e0933 100%)"
    },
    {
        category: "EASTERN CONTENDER",
        headline: "Celtics Acquire Paul George & Sign Center Mitchell Robinson",
        story: "Boston retools around Jayson Tatum and Derrick White, bringing in All-Star Paul George via trade and signing elite rim-protector Mitchell Robinson to anchor the paint.",
        pills: ["Trade: Paul George", "Signing: Mitchell Robinson", "Boston Celtics"],
        logo: "https://cdn.nba.com/logos/nba/1610612738/primary/L/logo.svg",
        bgGradient: "radial-gradient(circle at 80% 50%, #007a33 0%, #02260f 100%)"
    },
    {
        category: "EXPLOSIVE BACKCOURT",
        headline: "Trail Blazers Acquire Ja Morant to Pair with Damian Lillard",
        story: "Portland pulls off a blockbuster deal with Memphis to acquire high-flying superstar Ja Morant, creating one of the most electric guard pairings in basketball history.",
        pills: ["Trade: Ja Morant", "Package: Grant & Murray Out", "Portland Trail Blazers"],
        logo: "https://cdn.nba.com/logos/nba/1610612757/primary/L/logo.svg",
        bgGradient: "radial-gradient(circle at 80% 50%, #e03a3e 0%, #290305 100%)"
    },
    {
        category: "YOUTH MOVEMENT",
        headline: "Mavericks Acquire Zaccharie Risacher & Flank Kyrie with Cooper Flagg",
        story: "Dallas lands #1 overall international standout Zaccharie Risacher from Atlanta alongside top draft prospect Cooper Flagg and Dereck Lively II in a rapid roster revamp.",
        pills: ["Trade: Zaccharie Risacher", "Rookie: Cooper Flagg", "Dallas Mavericks"],
        logo: "https://cdn.nba.com/logos/nba/1610612742/primary/L/logo.svg",
        bgGradient: "radial-gradient(circle at 80% 50%, #00538c 0%, #021a30 100%)"
    },
    {
        category: "DESERT UPGRADE",
        headline: "Suns Acquire Miles Bridges; Re-Sign Dillon Brooks to Extension",
        story: "Phoenix bolsters its forward rotation by acquiring Miles Bridges from Charlotte and securing defensive stopper Dillon Brooks with a multi-year veteran extension.",
        pills: ["Trade: Miles Bridges", "Extension: Dillon Brooks", "Phoenix Suns"],
        logo: "https://cdn.nba.com/logos/nba/1610612756/primary/L/logo.svg",
        bgGradient: "radial-gradient(circle at 80% 50%, #e56020 0%, #240a02 100%)"
    }
];

// TIMELINE TRANSACTIONS DATASET
const rawTimelineTransactions = [
    {
        date: "Friday, August 28, 2026",
        items: [
            { team: "Minnesota Timberwolves", type: "TRADE", text: "Received forward Cody Williams from Utah Jazz." },
            { team: "Minnesota Timberwolves", type: "TRADE", text: "Received guard John Konchar from Utah Jazz." },
            { team: "Utah Jazz", type: "TRADE", text: "Received guard Josh Green from Minnesota Timberwolves." },
            { team: "Cleveland Cavaliers", type: "WAIVED", text: "Waived forward Cam Whitmore." },
            { team: "Denver Nuggets", type: "WAIVED", text: "Waived forward Julian Reese." }
        ]
    },
    {
        date: "Thursday, August 27, 2026",
        items: [
            { team: "Miami Heat", type: "SIGNING", text: "Signed center Nick Richards to a Contract." },
            { team: "Miami Heat", type: "SIGNING", text: "Re-signed forward Keshad Johnson to a Two-Way Contract." }
        ]
    },
    {
        date: "Wednesday, August 26, 2026",
        items: [
            { team: "Houston Rockets", type: "SIGNING", text: "Signed center Rafael Castro to a Two-Way Contract." },
            { team: "Golden State Warriors", type: "SIGNING", text: "Signed guard Brandon Williams to a Contract." },
            { team: "Denver Nuggets", type: "SIGNING", text: "Signed Bryce Hopkins to a Two-Way Contract." },
            { team: "Houston Rockets", type: "WAIVED", text: "Waived guard Tristen Newton." }
        ]
    },
    {
        date: "Tuesday, August 25, 2026",
        items: [
            { team: "Golden State Warriors", type: "SIGNING", text: "Signed forward Georges Niang to a Contract." }
        ]
    },
    {
        date: "Sunday, August 23, 2026",
        items: [
            { team: "Miami Heat", type: "SIGNING", text: "Signed guard Klay Thompson to a Contract." }
        ]
    },
    {
        date: "Friday, August 21, 2026",
        items: [
            { team: "Dallas Mavericks", type: "WAIVED", text: "Waived guard Klay Thompson." }
        ]
    },
    {
        date: "Thursday, August 20, 2026",
        items: [
            { team: "Cleveland Cavaliers", type: "TRADE", text: "Received guard Peyton Watson from Denver Nuggets." },
            { team: "Cleveland Cavaliers", type: "TRADE", text: "Received forward Cam Whitmore from Washington Wizards." },
            { team: "Denver Nuggets", type: "TRADE", text: "Received draft consideration from Cleveland Cavaliers." },
            { team: "LA Clippers", type: "TRADE", text: "Received guard Max Strus from Cleveland Cavaliers." },
            { team: "Washington Wizards", type: "TRADE", text: "Received draft consideration from LA Clippers." },
            { team: "Washington Wizards", type: "TRADE", text: "Received guard Tre Mann from Charlotte Hornets." },
            { team: "Charlotte Hornets", type: "TRADE", text: "Received guard Dennis Schroder from Cleveland Cavaliers." }
        ]
    },
    {
        date: "Tuesday, August 18, 2026",
        items: [
            { team: "New Orleans Pelicans", type: "SIGNING", text: "Signed Malik Dia to a Two-Way Contract." },
            { team: "New Orleans Pelicans", type: "WAIVED", text: "Waived center Hunter Dickinson." }
        ]
    },
    {
        date: "Monday, August 17, 2026",
        items: [
            { team: "Indiana Pacers", type: "SIGNING", text: "Signed guard Braden Smith to a Two-Way Contract." },
            { team: "Houston Rockets", type: "SIGNING", text: "Signed guard Sean Pedulla to a Two-Way Contract." },
            { team: "New Orleans Pelicans", type: "SIGNING", text: "Signed guard Trendon Watford to a Contract." }
        ]
    },
    {
        date: "Thursday, August 13, 2026",
        items: [
            { team: "LA Clippers", type: "EXTENSION", text: "Re-signed guard Bradley Beal to a Contract." },
            { team: "Indiana Pacers", type: "WAIVED", text: "Waived guard Ethan Thompson." }
        ]
    },
    {
        date: "Wednesday, August 12, 2026",
        items: [
            { team: "LA Clippers", type: "SIGNING", text: "Signed guard Jalen Pickett to a Two-Way Contract." },
            { team: "Phoenix Suns", type: "WAIVED", text: "Waived forward Haywood Highsmith." }
        ]
    },
    {
        date: "Saturday, August 08, 2026",
        items: [
            { team: "Phoenix Suns", type: "EXTENSION", text: "Re-signed guard Dillon Brooks to a Veteran Extension." }
        ]
    },
    {
        date: "Thursday, August 06, 2026",
        items: [
            { team: "LA Clippers", type: "SIGNING", text: "Signed center Jamarion Sharp to a Two-Way Contract." },
            { team: "LA Clippers", type: "WAIVED", text: "Waived guard Sean Pedulla." }
        ]
    },
    {
        date: "Wednesday, August 05, 2026",
        items: [
            { team: "Boston Celtics", type: "SIGNING", text: "Signed forward Dillon Mitchell to a Two-Way Contract." },
            { team: "Philadelphia 76ers", type: "SIGNING", text: "Signed guard Kentavious Caldwell-Pope to a Contract." },
            { team: "Houston Rockets", type: "WAIVED", text: "Waived guard JD Davison." }
        ]
    },
    {
        date: "Tuesday, August 04, 2026",
        items: [
            { team: "Toronto Raptors", type: "SIGNING", text: "Signed center Trey Jemison III to a Two-Way Contract." }
        ]
    },
    {
        date: "Sunday, August 02, 2026",
        items: [
            { team: "Dallas Mavericks", type: "EXTENSION", text: "Re-signed forward Naji Marshall to a Veteran Extension." }
        ]
    },
    {
        date: "Saturday, August 01, 2026",
        items: [
            { team: "Golden State Warriors", type: "EXTENSION", text: "Re-signed guard Gary Payton II to a Contract." }
        ]
    },
    {
        date: "Friday, July 31, 2026",
        items: [
            { team: "Denver Nuggets", type: "SIGNING", text: "Signed forward Spencer Jones to a Contract." },
            { team: "Brooklyn Nets", type: "SIGNING", text: "Signed forward Moritz Wagner to a Contract." },
            { team: "Cleveland Cavaliers", type: "SIGNING", text: "Signed forward Mario Hezonja to a Contract." },
            { team: "Golden State Warriors", type: "EXTENSION", text: "Re-signed guard De'Anthony Melton to a Contract." }
        ]
    },
    {
        date: "Thursday, July 30, 2026",
        items: [
            { team: "Charlotte Hornets", type: "WAIVED", text: "Waived forward Mouhamadou Gueye." }
        ]
    },
    {
        date: "Wednesday, July 29, 2026",
        items: [
            { team: "Golden State Warriors", type: "EXTENSION", text: "Re-signed forward Draymond Green to a Contract." },
            { team: "Memphis Grizzlies", type: "DRAFT", text: "Signed forward Karim Lopez to a Rookie Scale Contract." }
        ]
    },
    {
        date: "Tuesday, July 28, 2026",
        items: [
            { team: "LA Clippers", type: "TRADE", text: "Received forward Johni Broome and draft consideration from Philadelphia 76ers." }
        ]
    },
    {
        date: "Monday, July 27, 2026",
        items: [
            { team: "Los Angeles Lakers", type: "SIGNING", text: "Signed guard Matisse Thybulle to a Contract." },
            { team: "Sacramento Kings", type: "WAIVED", text: "Waived guard Isaiah Stevens." }
        ]
    },
    {
        date: "Sunday, July 26, 2026",
        items: [
            { team: "Philadelphia 76ers", type: "SIGNING", text: "Signed forward LeBron James to a Contract." }
        ]
    },
    {
        date: "Saturday, July 25, 2026",
        items: [
            { team: "Memphis Grizzlies", type: "WAIVED", text: "Waived guard Kentavious Caldwell-Pope." },
            { team: "Philadelphia 76ers", type: "WAIVED", text: "Waived forward Dalen Terry." }
        ]
    },
    {
        date: "Friday, July 24, 2026",
        items: [
            { team: "Portland Trail Blazers", type: "SIGNING", text: "Signed guard John Tonje to a Two-Way Contract." }
        ]
    },
    {
        date: "Thursday, July 23, 2026",
        items: [
            { team: "Boston Celtics", type: "EXTENSION", text: "Re-signed guard Jordan Walsh to a Veteran Extension." },
            { team: "Houston Rockets", type: "EXTENSION", text: "Re-signed forward Jae'Sean Tate to a Contract." },
            { team: "New Orleans Pelicans", type: "SIGNING", text: "Signed guard Jaron Pierre Jr. to a Two-Way Contract." }
        ]
    },
    {
        date: "Wednesday, July 22, 2026",
        items: [
            { team: "Indiana Pacers", type: "EXTENSION", text: "Re-signed forward Jalen Slawson to a Two-Way Contract." },
            { team: "Atlanta Hawks", type: "SIGNING", text: "Signed forward Jalen Wilson to a Two-Way Contract." },
            { team: "San Antonio Spurs", type: "EXTENSION", text: "Re-signed guard David Jones Garcia to a Two-Way Contract." },
            { team: "Dallas Mavericks", type: "SIGNING", text: "Signed center Moussa Cisse to a Contract." },
            { team: "Houston Rockets", type: "EXTENSION", text: "Re-signed forward Isaiah Crawford to a Contract." },
            { team: "San Antonio Spurs", type: "WAIVED", text: "Waived forward Emanuel Miller." }
        ]
    },
    {
        date: "Tuesday, July 21, 2026",
        items: [
            { team: "Los Angeles Lakers", type: "SIGNING", text: "Signed forward Arthur Kaluma to a Two-Way Contract." },
            { team: "Los Angeles Lakers", type: "WAIVED", text: "Waived guard Peter Suder." }
        ]
    },
    {
        date: "Monday, July 20, 2026",
        items: [
            { team: "Dallas Mavericks", type: "SIGNING", text: "Signed guard Jett Howard to a Two-Way Contract." },
            { team: "Indiana Pacers", type: "WAIVED", text: "Waived guard Taelon Peter." },
            { team: "Dallas Mavericks", type: "WAIVED", text: "Waived forward Tyler Smith." }
        ]
    },
    {
        date: "Sunday, July 19, 2026",
        items: [
            { team: "Los Angeles Lakers", type: "SIGNING", text: "Signed forward Ziaire Williams to a Contract." },
            { team: "Atlanta Hawks", type: "TRADE", text: "Received guard Ryan Nembhard from Dallas Mavericks & guard Luguentz Dort from Oklahoma City Thunder." },
            { team: "Dallas Mavericks", type: "TRADE", text: "Received forward Zaccharie Risacher & draft consideration from Atlanta Hawks." },
            { team: "Oklahoma City Thunder", type: "TRADE", text: "Received draft considerations from Atlanta Hawks & Dallas Mavericks." }
        ]
    },
    {
        date: "Thursday, July 16, 2026",
        items: [
            { team: "Miami Heat", type: "EXTENSION", text: "Re-signed center Vladislav Goldin to a Two-Way Contract." }
        ]
    },
    {
        date: "Wednesday, July 15, 2026",
        items: [
            { team: "Denver Nuggets", type: "SIGNING", text: "Signed forward Marvin Bagley III to a Contract." },
            { team: "Milwaukee Bucks", type: "EXTENSION", text: "Re-signed guard Gary Trent Jr. to a Contract." }
        ]
    },
    {
        date: "Tuesday, July 14, 2026",
        items: [
            { team: "Phoenix Suns", type: "SIGNING", text: "Signed guard Luke Kennard to a Contract." },
            { team: "Denver Nuggets", type: "EXTENSION", text: "Re-signed guard Tyus Jones to a Contract." }
        ]
    },
    {
        date: "Monday, July 13, 2026",
        items: [
            { team: "Memphis Grizzlies", type: "DRAFT", text: "Signed forward Cameron Boozer to a Rookie Scale Contract." },
            { team: "San Antonio Spurs", type: "EXTENSION", text: "Re-signed guard Jordan McLaughlin to a Contract." },
            { team: "Denver Nuggets", type: "SIGNING", text: "Signed Alpha Diallo to a Contract." },
            { team: "Phoenix Suns", type: "TRADE", text: "Received forward Miles Bridges and draft consideration from Charlotte Hornets." },
            { team: "Charlotte Hornets", type: "TRADE", text: "Received guard Grayson Allen, forward Royce O'Neale & draft consideration from Phoenix Suns." }
        ]
    },
    {
        date: "Sunday, July 12, 2026",
        items: [
            { team: "Los Angeles Lakers", type: "EXTENSION", text: "Re-signed guard Austin Reaves to a Contract." },
            { team: "Los Angeles Lakers", type: "SIGNING", text: "Signed forward Kevon Looney to a Contract." }
        ]
    },
    {
        date: "Saturday, July 11, 2026",
        items: [
            { team: "Minnesota Timberwolves", type: "SIGNING", text: "Signed forward Isaiah Evans to a Contract." },
            { team: "Los Angeles Lakers", type: "SIGNING", text: "Signed guard Collin Sexton to a Contract." }
        ]
    },
    {
        date: "Friday, July 10, 2026",
        items: [
            { team: "Portland Trail Blazers", type: "SIGNING", text: "Claimed center Micah Potter off waivers." },
            { team: "Dallas Mavericks", type: "SIGNING", text: "Signed forward Tarik Biberovic to a Contract." },
            { team: "Utah Jazz", type: "SIGNING", text: "Signed center Mo Bamba to a Contract." },
            { team: "New York Knicks", type: "EXTENSION", text: "Re-signed guard Jordan Clarkson to a Contract." },
            { team: "Houston Rockets", type: "SIGNING", text: "Signed guard Marcus Smart to a Contract." },
            { team: "Minnesota Timberwolves", type: "EXTENSION", text: "Re-signed guard Ayo Dosunmu & guard Jaylen Clark to Contracts." },
            { team: "Brooklyn Nets", type: "DRAFT", text: "Signed forward Joshua Jefferson to a Rookie Scale Contract." },
            { team: "Denver Nuggets", type: "SIGNING", text: "Signed forward Trevon Brazile to a Contract." },
            { team: "Atlanta Hawks", type: "EXTENSION", text: "Re-signed center Jock Landale to a Contract." },
            { team: "San Antonio Spurs", type: "EXTENSION", text: "Re-signed forward Victor Wembanyama to a Rookie Scale Extension." },
            { team: "Chicago Bulls", type: "SIGNING", text: "Signed guard Norman Powell to a Contract." },
            { team: "New Orleans Pelicans", type: "EXTENSION", text: "Re-signed center DeAndre Jordan to a Contract." },
            { team: "Minnesota Timberwolves", type: "SIGNING", text: "Signed forward Trey Lyles to a Contract." },
            { team: "Chicago Bulls", type: "TRADE", text: "Received center Nic Claxton from Brooklyn Nets." },
            { team: "Minnesota Timberwolves", type: "TRADE", text: "Received guard Josh Green & guard LaMelo Ball from Charlotte Hornets." },
            { team: "Brooklyn Nets", type: "TRADE", text: "Received forward Julius Randle from Minnesota Timberwolves." },
            { team: "Charlotte Hornets", type: "TRADE", text: "Received center Naz Reid & draft consideration from Timberwolves, plus forward Mouhamadou Gueye from Bulls." },
            { team: "Brooklyn Nets", type: "WAIVED", text: "Waived guard Malachi Smith." }
        ]
    },
    {
        date: "Thursday, July 09, 2026",
        items: [
            { team: "Indiana Pacers", type: "SIGNING", text: "Signed forward Larry Nance Jr. & re-signed Kobe Brown to a Two-Way Contract." },
            { team: "Houston Rockets", type: "EXTENSION", text: "Re-signed forward Tari Eason to a Contract." },
            { team: "Utah Jazz", type: "EXTENSION", text: "Re-signed center Jusuf Nurkic & signed center Jaxson Hayes and guard Josh Okogie." },
            { team: "Golden State Warriors", type: "EXTENSION", text: "Re-signed center Charles Bassey to a Contract." },
            { team: "Detroit Pistons", type: "EXTENSION", text: "Re-signed guard Kevin Huerter to a Contract." },
            { team: "LA Clippers", type: "SIGNING", text: "Signed forward Baba Miller & re-signed Jordan Miller." },
            { team: "Milwaukee Bucks", type: "EXTENSION", text: "Re-signed forward Ousmane Dieng to a Contract." },
            { team: "Boston Celtics", type: "WAIVED", text: "Waived forward Dalano Banton." }
        ]
    },
    {
        date: "Wednesday, July 08, 2026",
        items: [
            { team: "San Antonio Spurs", type: "EXTENSION", text: "Re-signed forward Harrison Barnes to a Contract." },
            { team: "Houston Rockets", type: "SIGNING", text: "Signed guard Bogdan Bogdanovic to a Contract." },
            { team: "Philadelphia 76ers", type: "SIGNING", text: "Signed guard Rayan Rupert to a Two-Way Contract." },
            { team: "Memphis Grizzlies", type: "SIGNING", text: "Signed center Quinten Post to a Contract." },
            { team: "Milwaukee Bucks", type: "DRAFT", text: "Signed forward Nate Ament to a Rookie Scale Contract." },
            { team: "Cleveland Cavaliers", type: "EXTENSION", text: "Re-signed guard Donovan Mitchell to a Veteran Extension." },
            { team: "Detroit Pistons", type: "EXTENSION", text: "Re-signed guard Javonte Green & signed Elijah Harkless to Two-Way." },
            { team: "Milwaukee Bucks", type: "SIGNING", text: "Signed forward Pete Nance to a Contract." },
            { team: "Dallas Mavericks", type: "TRADE", text: "Received forward Santi Aldama from Grizzlies & guard Marcus Sasser from Pistons." },
            { team: "Milwaukee Bucks", type: "TRADE", text: "Received guard Caris LeVert & draft consideration from Detroit Pistons." },
            { team: "Memphis Grizzlies", type: "TRADE", text: "Received AJ Johnson from Mavericks, D'Angelo Russell from Wizards & Isaiah Stewart from Pistons." },
            { team: "Washington Wizards", type: "TRADE", text: "Received forward Khris Middleton & draft consideration from Dallas Mavericks." },
            { team: "Detroit Pistons", type: "TRADE", text: "Received forward John Collins (Clippers), Taurean Prince & Gary Harris (Bucks)." },
            { team: "Los Angeles Lakers", type: "TRADE", text: "Received center Walker Kessler from Utah Jazz for draft consideration." },
            { team: "Denver Nuggets", type: "WAIVED", text: "Waived center Jonas Valanciunas." },
            { team: "Indiana Pacers", type: "WAIVED", text: "Waived center Micah Potter." }
        ]
    },
    {
        date: "Tuesday, July 07, 2026",
        items: [
            { team: "Houston Rockets", type: "SIGNING", text: "Signed guard Bruce Thornton & guard Quadir Copeland to Contracts." },
            { team: "Cleveland Cavaliers", type: "EXTENSION", text: "Re-signed center Thomas Bryant to a Contract." },
            { team: "Phoenix Suns", type: "EXTENSION", text: "Re-signed center Mark Williams, Jordan Goodwin & Collin Gillespie." },
            { team: "Washington Wizards", type: "SIGNING", text: "Signed center Felix Okpara to a Two-Way Contract." },
            { team: "Sacramento Kings", type: "EXTENSION", text: "Re-signed forward Precious Achiuwa to a Contract." },
            { team: "Utah Jazz", type: "SIGNING", text: "Signed guard Trey Alexander to a Two-Way Contract." },
            { team: "New Orleans Pelicans", type: "EXTENSION", text: "Re-signed center Hunter Dickinson to a Two-Way Contract." },
            { team: "LA Clippers", type: "EXTENSION", text: "Re-signed guard Kobe Sanders to a Contract." },
            { team: "Los Angeles Lakers", type: "SIGNING", text: "Signed forward Sandro Mamukelashvili & guard Quentin Grimes." },
            { team: "Indiana Pacers", type: "SIGNING", text: "Signed forward Kelly Oubre Jr. to a Contract." },
            { team: "Los Angeles Lakers", type: "TRADE", text: "Received guard Jaden Hardy & draft consideration from Washington Wizards." },
            { team: "Washington Wizards", type: "TRADE", text: "Received center Deandre Ayton from Los Angeles Lakers." }
        ]
    },
    {
        date: "Monday, July 06, 2026",
        items: [
            { team: "Charlotte Hornets", type: "DRAFT", text: "Signed forward Hannes Steinbach & guard Christian Anderson to Rookie Scale Contracts." },
            { team: "Philadelphia 76ers", type: "SIGNING", text: "Signed forward Dean Wade, guard Anfernee Simons & center Ariel Hukporti." },
            { team: "Brooklyn Nets", type: "SIGNING", text: "Signed center Day'Ron Sharpe, forward Josh Minott & guard Keon Ellis." },
            { team: "Detroit Pistons", type: "DRAFT", text: "Signed guard Ebuka Okorie to a Rookie Scale Contract." },
            { team: "Boston Celtics", type: "EXTENSION", text: "Re-signed guard Ron Harper Jr. & Neemias Queta to extensions." },
            { team: "Miami Heat", type: "EXTENSION", text: "Re-signed forward Andrew Wiggins to a Veteran Extension & signed Tim Hardaway Jr." },
            { team: "Golden State Warriors", type: "EXTENSION", text: "Re-signed center Al Horford to a Contract." },
            { team: "Phoenix Suns", type: "EXTENSION", text: "Re-signed guard Koby Brea to a Two-Way Contract." },
            { team: "Charlotte Hornets", type: "EXTENSION", text: "Re-signed guard Coby White & signed Michael Ajayi, Kylan Boswell." },
            { team: "Toronto Raptors", type: "SIGNING", text: "Signed forward Kyle Anderson to a Contract." },
            { team: "New York Knicks", type: "EXTENSION", text: "Re-signed Jose Alvarado, Mohamed Diawara, Landry Shamet & signed Andre Drummond." },
            { team: "San Antonio Spurs", type: "SIGNING", text: "Signed forward Tobias Harris to a Contract." },
            { team: "Boston Celtics", type: "SIGNING", text: "Signed center Mitchell Robinson & guard Mike Conley." },
            { team: "LA Clippers", type: "SIGNING", text: "Signed forward Rui Hachimura to a Contract." },
            { team: "Washington Wizards", type: "EXTENSION", text: "Re-signed guard Trae Young to a Contract." },
            { team: "Oklahoma City Thunder", type: "EXTENSION", text: "Re-signed center Isaiah Hartenstein & guard Kenrich Williams." },
            { team: "Atlanta Hawks", type: "TRADE", text: "Received guard Aaron Wiggins from Oklahoma City Thunder." },
            { team: "Miami Heat", type: "TRADE", text: "Received Giannis Antetokounmpo & Bobby Portis Jr. from Milwaukee Bucks." },
            { team: "Milwaukee Bucks", type: "TRADE", text: "Received Tyler Herro, Jaime Jaquez Jr., Kel'el Ware, Kasparas Jakucionis & picks from Heat." },
            { team: "Boston Celtics", type: "TRADE", text: "Received forward Paul George & draft consideration from Philadelphia 76ers." },
            { team: "Philadelphia 76ers", type: "TRADE", text: "Received guard Jaylen Brown from Boston Celtics." },
            { team: "Detroit Pistons", type: "TRADE", text: "Received guard Isaiah Joe from Oklahoma City Thunder." },
            { team: "Charlotte Hornets", type: "TRADE", text: "Received forward Dorian Finney-Smith & draft consideration from Houston Rockets." },
            { team: "Sacramento Kings", type: "WAIVED", text: "Waived guard DeMar DeRozan." },
            { team: "Charlotte Hornets", type: "WAIVED", text: "Waived forward Tosan Evbuomwan." }
        ]
    },
    {
        date: "Sunday, July 05, 2026",
        items: [
            { team: "Boston Celtics", type: "DRAFT", text: "Signed forward Christopher Cenac Jr. to a Rookie Scale Contract." },
            { team: "Philadelphia 76ers", type: "SIGNING", text: "Signed guard Caleb Love to a Two-Way Contract." },
            { team: "LA Clippers", type: "SIGNING", text: "Signed forward Nick Martinelli to a Two-Way Contract." },
            { team: "Milwaukee Bucks", type: "DRAFT", text: "Signed guard Brayden Burries to Rookie Contract & Kam Jones to Two-Way." }
        ]
    },
    {
        date: "Saturday, July 04, 2026",
        items: [
            { team: "Toronto Raptors", type: "SIGNING", text: "Signed guard Jaden Bradley to a Two-Way Contract." }
        ]
    },
    {
        date: "Friday, July 03, 2026",
        items: [
            { team: "Toronto Raptors", type: "EXTENSION", text: "Re-signed guard Alijah Martin to a Contract." },
            { team: "Miami Heat", type: "SIGNING", text: "Signed guard Tre Donaldson to a Two-Way Contract." },
            { team: "San Antonio Spurs", type: "DRAFT", text: "Signed center Tarris Reed Jr. & Jayden Quaintance to Rookie Contracts; Maliq Brown & Ja'Kobi Gillespie to Two-Way." },
            { team: "Oklahoma City Thunder", type: "DRAFT", text: "Signed Bennett Stirtz & Aday Mara to Rookie Contracts; Otega Oweh, Brooks Barnhizer & Josh Dix to Two-Way." },
            { team: "Utah Jazz", type: "SIGNING", text: "Signed guard Tamar Bates to a Two-Way Contract." },
            { team: "Chicago Bulls", type: "DRAFT", text: "Signed forward Caleb Wilson & Dailyn Swain to Rookie Contracts; Tobe Awaka & Jaylin Sellers to Two-Way." },
            { team: "Dallas Mavericks", type: "DRAFT", text: "Signed guard Sergio de Larrea to Rookie Contract & Tobi Lawal to Two-Way." },
            { team: "Minnesota Timberwolves", type: "EXTENSION", text: "Re-signed guard Bones Hyland to a Contract." },
            { team: "Philadelphia 76ers", type: "DRAFT", text: "Signed guard Labaron Philon to a Rookie Scale Contract." },
            { team: "LA Clippers", type: "DRAFT", text: "Signed guard Keaton Wagler to a Rookie Scale Contract." },
            { team: "Los Angeles Lakers", type: "SIGNING", text: "Re-signed Chris Manon & signed Peter Suder and AK Okereke to Two-Ways." },
            { team: "Phoenix Suns", type: "SIGNING", text: "Signed guard Pat Spencer to a Two-Way Contract." },
            { team: "Milwaukee Bucks", type: "WAIVED", text: "Waived forward Pete Nance." }
        ]
    },
    {
        date: "Thursday, July 02, 2026",
        items: [
            { team: "Toronto Raptors", type: "DRAFT", text: "Signed forward Allen Graves to a Rookie Scale Contract." },
            { team: "Washington Wizards", type: "DRAFT", text: "Signed forward AJ Dybantsa to a Rookie Scale Contract." },
            { team: "Atlanta Hawks", type: "DRAFT", text: "Signed guard Kingston Flemings to a Rookie Scale Contract." },
            { team: "Sacramento Kings", type: "SIGNING", text: "Signed forward Jonathan Mogbo & re-signed Daeqwon Plowden." },
            { team: "Miami Heat", type: "EXTENSION", text: "Re-signed forward Simone Fontecchio to a Contract." },
            { team: "Minnesota Timberwolves", type: "EXTENSION", text: "Re-signed forward Enrique Freeman to a Two-Way Contract." },
            { team: "Dallas Mavericks", type: "DRAFT", text: "Signed forward Morez Johnson to a Rookie Scale Contract." },
            { team: "Detroit Pistons", type: "SIGNING", text: "Signed center Ugonna Onyenso to a Two-Way Contract." },
            { team: "Los Angeles Lakers", type: "DRAFT", text: "Signed guard Cameron Carr to a Rookie Scale Contract." },
            { team: "Brooklyn Nets", type: "DRAFT", text: "Signed guard Mikel Brown Jr. to Rookie Contract & Tyler Bilodeau to Two-Way." },
            { team: "Oklahoma City Thunder", type: "WAIVED", text: "Waived forward Payton Sandfort." }
        ]
    },
    {
        date: "Wednesday, July 01, 2026",
        items: [
            { team: "Portland Trail Blazers", type: "SIGNING", text: "Signed center Branden Carlson to a Contract." },
            { team: "Washington Wizards", type: "EXTENSION", text: "Re-signed forward Jamir Watkins to a Two-Way Contract." },
            { team: "Cleveland Cavaliers", type: "SIGNING", text: "Signed guard Meleek Thomas & center Ernest Udeh, Jr." },
            { team: "Orlando Magic", type: "SIGNING", text: "Signed center Nikola Vucevic, forward Jonathan Isaac & re-signed Jevon Carter." },
            { team: "Atlanta Hawks", type: "DRAFT", text: "Signed forward Zuby Ejiofor to Rookie Contract & Henri Veesaar." },
            { team: "Milwaukee Bucks", type: "SIGNING", text: "Signed forward Bogoljub Markovic to a Contract." },
            { team: "Golden State Warriors", type: "DRAFT", text: "Signed forward Yaxel Lendeborg to a Rookie Scale Contract." },
            { team: "Phoenix Suns", type: "DRAFT", text: "Signed forward Koa Peat to a Rookie Scale Contract." },
            { team: "Utah Jazz", type: "DRAFT", text: "Signed guard Darryn Peterson to a Rookie Scale Contract." },
            { team: "Miami Heat", type: "SIGNING", text: "Signed guard Ryan Conwell to a Contract." },
            { team: "Orlando Magic", type: "SIGNING", text: "Re-signed Colin Castleton & signed Izaiyah Nelson to Two-Ways." },
            { team: "Boston Celtics", type: "EXTENSION", text: "Re-signed forward Amari Williams to a Two-Way Contract." },
            { team: "Sacramento Kings", type: "DRAFT", text: "Signed guard Darius Acuff Jr., Alex Karaban & Emanuel Sharp." },
            { team: "Chicago Bulls", type: "WAIVED", text: "Waived guard Kam Jones." },
            { team: "Washington Wizards", type: "WAIVED", text: "Waived forward Leaky Black." }
        ]
    },
    {
        date: "Tuesday, June 30, 2026",
        items: [
            { team: "Portland Trail Blazers", type: "EXTENSION", text: "Re-signed center Robert Williams III to a Veteran Extension." },
            { team: "Golden State Warriors", type: "EXTENSION", text: "Re-signed forward Kristaps Porzingis to a Veteran Extension." },
            { team: "Chicago Bulls", type: "EXTENSION", text: "Re-signed forward Zach Collins to a Veteran Extension." },
            { team: "Atlanta Hawks", type: "TRADE", text: "Received guard Devin Carter & draft consideration from Sacramento Kings." }
        ]
    },
    {
        date: "Monday, June 29, 2026",
        items: [
            { team: "Brooklyn Nets", type: "EXTENSION", text: "Re-signed guard Chaney Johnson to a Two-Way Contract." },
            { team: "San Antonio Spurs", type: "EXTENSION", text: "Re-signed forward Julian Champagnie to a Veteran Extension." },
            { team: "Portland Trail Blazers", type: "TRADE", text: "Received guard Ja Morant from Memphis Grizzlies." },
            { team: "Memphis Grizzlies", type: "TRADE", text: "Received forward Jerami Grant & forward Kris Murray from Portland Trail Blazers." }
        ]
    },
    {
        date: "Saturday, June 27, 2026",
        items: [
            { team: "Orlando Magic", type: "WAIVED", text: "Waived forward Jonathan Isaac." }
        ]
    },
    {
        date: "Thursday, June 25, 2026",
        items: [
            { team: "Toronto Raptors", type: "EXTENSION", text: "Re-signed guard Chucky Hepburn to a Two-Way Contract." }
        ]
    },
    {
        date: "Wednesday, June 24, 2026",
        items: [
            { team: "Chicago Bulls", type: "TRADE", text: "Received guard Kam Jones & draft consideration from Indiana Pacers." }
        ]
    },
    {
        date: "Monday, June 22, 2026",
        items: [
            { team: "Atlanta Hawks", type: "EXTENSION", text: "Re-signed guard CJ McCollum to a Veteran Extension." }
        ]
    }
];

// INITIAL LOAD
async function loadTeams() {
    setupHeadlineDots();
    updateHeadline(0);
    startHeadlineAutoPlay();
    filterTransactions();

    try {
        const response = await fetch(`${API_URL}/teams`);
        const data = await response.json();
        allTeams = data.teams || [];
        displayTeams(allTeams);
    } catch (error) {
        console.error("API load failed:", error);
        document.getElementById("teamGrid").innerHTML = "<p style='grid-column: 1/-1; text-align:center; color:#c9082a; padding: 40px 0;'>Unable to connect to the NBA API.</p>";
    }
}

// HEADLINE SLIDER (DYNAMIC BG GRADIENT)
function updateHeadline(index) {
    currentHeadlineIndex = index;
    const item = headlines[currentHeadlineIndex];

    const heroEl = document.getElementById("hero");
    if (heroEl && item.bgGradient) {
        heroEl.style.background = item.bgGradient;
    }

    document.getElementById("newsCategory").innerText = item.category;
    document.getElementById("newsHeadline").innerText = item.headline;
    document.getElementById("newsStory").innerText = item.story;

    document.getElementById("newsPill1").innerText = item.pills[0];
    document.getElementById("newsPill2").innerText = item.pills[1];
    document.getElementById("newsPill3").innerText = item.pills[2];

    const img = document.getElementById("newsImage");
    img.src = item.logo;
    img.onerror = () => {
        img.src = "https://cdn.nba.com/logos/nba/1610612738/primary/L/logo.svg";
    };

    const dots = document.querySelectorAll(".hero-dot");
    dots.forEach((dot, idx) => {
        dot.classList.toggle("active", idx === currentHeadlineIndex);
    });
}

function prevHeadline() {
    currentHeadlineIndex = (currentHeadlineIndex - 1 + headlines.length) % headlines.length;
    updateHeadline(currentHeadlineIndex);
    resetHeadlineAutoPlay();
}

function nextHeadline() {
    currentHeadlineIndex = (currentHeadlineIndex + 1) % headlines.length;
    updateHeadline(currentHeadlineIndex);
    resetHeadlineAutoPlay();
}

function setupHeadlineDots() {
    const dotsContainer = document.getElementById("heroDots");
    dotsContainer.innerHTML = "";
    headlines.forEach((_, idx) => {
        const dot = document.createElement("div");
        dot.className = `hero-dot ${idx === 0 ? "active" : ""}`;
        dot.onclick = () => {
            updateHeadline(idx);
            resetHeadlineAutoPlay();
        };
        dotsContainer.appendChild(dot);
    });
}

function startHeadlineAutoPlay() {
    headlineAutoTimer = setInterval(() => {
        currentHeadlineIndex = (currentHeadlineIndex + 1) % headlines.length;
        updateHeadline(currentHeadlineIndex);
    }, 6000);
}

function resetHeadlineAutoPlay() {
    clearInterval(headlineAutoTimer);
    startHeadlineAutoPlay();
}

// TRANSACTIONS LIVE SEARCH & FILTER
function setTxFilter(type, element) {
    selectedTxFilter = type;
    document.querySelectorAll(".tx-tab").forEach(tab => tab.classList.remove("active"));
    if (element) element.classList.add("active");
    filterTransactions();
}

function clearTxSearch() {
    document.getElementById("txSearchInput").value = "";
    filterTransactions();
}

function filterTransactions() {
    const query = (document.getElementById("txSearchInput") ? document.getElementById("txSearchInput").value : "").trim().toLowerCase();
    const container = document.getElementById("transactionsTimeline");
    container.innerHTML = "";

    let matchedCount = 0;

    rawTimelineTransactions.forEach(group => {
        const filteredItems = group.items.filter(item => {
            const matchesType = (selectedTxFilter === "ALL") || (item.type === selectedTxFilter);
            if (!matchesType) return false;

            if (!query) return true;

            const fullText = `${group.date} ${item.team} ${item.type} ${item.text}`.toLowerCase();
            return fullText.includes(query);
        });

        if (filteredItems.length > 0) {
            matchedCount += filteredItems.length;
            const groupEl = document.createElement("div");
            groupEl.className = "tx-date-group";

            const dateHeader = document.createElement("div");
            dateHeader.className = "tx-date-header";
            dateHeader.innerText = group.date;
            groupEl.appendChild(dateHeader);

            const itemsGrid = document.createElement("div");
            itemsGrid.className = "tx-items-grid";

            filteredItems.forEach(item => {
                const card = document.createElement("div");
                card.className = "tx-card";

                const meta = teamMetadata[item.team] || { logo: "https://cdn.nba.com/logos/nba/1610612738/primary/L/logo.svg" };

                card.innerHTML = `
                    <img src="${meta.logo}" alt="${item.team}" class="tx-team-logo" onerror="this.src='https://cdn.nba.com/logos/nba/1610612738/primary/L/logo.svg'">
                    <div class="tx-card-right">
                        <div class="tx-meta-row">
                            <span class="tx-badge tx-badge-${item.type}">${item.type.replace('_', ' ')}</span>
                        </div>
                        <h4 class="tx-title">${item.team}</h4>
                        <p class="tx-desc">${item.text}</p>
                    </div>
                `;
                itemsGrid.appendChild(card);
            });

            groupEl.appendChild(itemsGrid);
            container.appendChild(groupEl);
        }
    });

    if (matchedCount === 0) {
        container.innerHTML = `
            <div style="text-align: center; color: #94a3b8; padding: 60px 20px;">
                <p style="font-size: 1.1rem; font-weight: 700;">No transactions found matching "${query}".</p>
                <button class="tx-tab" style="margin-top: 14px;" onclick="clearTxSearch()">Clear Search</button>
            </div>
        `;
    }
}

// TEAMS DIRECTORY GRID
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

        const meta = teamMetadata[team.name] || { salary: team.total_salary || 0, status: team.tax_status || "Over Cap", rings: team.championships || 0, years: team.championship_years || [] };
        const formattedSalary = `$${(meta.salary).toLocaleString()}`;
        const ringsLabel = meta.rings > 0 ? `${meta.rings}x Champion` : `0 Championships`;

        card.innerHTML = `
            <div class="card-top">
                <img src="${team.logo}" alt="${team.name}" onerror="this.src='https://cdn.nba.com/logos/nba/1610612738/primary/L/logo.svg'">
            </div>
            <div class="card-bottom">
                <p class="card-brand">${team.conference} • ${team.division}</p>
                <h4 class="card-title">${team.name}</h4>
                <p class="card-subtitle">Star: ${team.featured_star}</p>
                <p class="card-rings" style="font-size: 0.75rem; font-weight: 700; color: #64748b; margin-top: 4px;">🏆 ${ringsLabel}</p>
                <div style="margin-top: 10px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 0.8rem; font-weight: 800; color: #111827;">${formattedSalary}</span>
                    <span class="tx-badge tx-badge-${meta.status.replace(' ', '_')}">${meta.status}</span>
                </div>
            </div>
        `;

        grid.appendChild(card);
    });
}

// FRANCHISE FILTER TOGGLE
function toggleFranchiseFilter(teamName, element) {
    const isAlreadySelected = element.classList.contains("active");

    document.querySelectorAll(".brand-circle").forEach(btn => btn.classList.remove("active"));
    document.getElementById("searchInput").value = "";

    if (isAlreadySelected) {
        selectedFranchise = "";
    } else {
        selectedFranchise = teamName;
        element.classList.add("active");
    }

    applyFilters();
}

// CONFERENCE TAB FILTER
function filterConference(conf, element) {
    selectedConference = conf;
    selectedFranchise = "";
    document.querySelectorAll(".brand-circle").forEach(btn => btn.classList.remove("active"));

    document.querySelectorAll(".conf-tab").forEach(tab => tab.classList.remove("active"));
    if (element) {
        element.classList.add("active");
    } else {
        document.querySelectorAll(".conf-tab")[0].classList.add("active");
    }

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

    const query = document.getElementById("searchInput").value.trim().toLowerCase();
    if (query) {
        list = list.filter(team => {
            const teamName = team.name.toLowerCase();
            const div = team.division.toLowerCase();
            const conf = team.conference.toLowerCase();
            const star = (team.featured_star || "").toLowerCase();
            const meta = teamMetadata[team.name] || {};
            const taxStatus = (meta.status || "").toLowerCase();
            const playerMatch = team.starters_2026_27.some(p =>
                p.name.toLowerCase().includes(query) || p.pos.toLowerCase() === query
            );
            return teamName.includes(query) || div.includes(query) || conf.includes(query) || star.includes(query) || taxStatus.includes(query) || playerMatch;
        });
    }

    displayTeams(list);
}

function searchTeams() {
    selectedFranchise = "";
    document.querySelectorAll(".brand-circle").forEach(btn => btn.classList.remove("active"));
    applyFilters();
}

// MODAL CONTROLS (FULL 11-COLUMN STATS: PTS, REB, AST, STL, BLK, TOV, FG%, 3P%, FT% + ALL CHAMPIONSHIP YEARS)
function openModal(team) {
    const meta = teamMetadata[team.name] || {
        salary: team.total_salary || 0,
        status: team.tax_status || "Over Cap",
        rings: team.championships || 0,
        years: team.championship_years || []
    };

    const formattedSalary = `$${(meta.salary).toLocaleString()}`;
    const yearsString = (meta.years && meta.years.length > 0) ? meta.years.join(", ") : "None";

    document.getElementById("modalConference").innerText = `${team.conference.toUpperCase()} CONFERENCE • ${team.division.toUpperCase()}`;
    document.getElementById("modalTitle").innerText = team.name;
    document.getElementById("modalStar").innerText = `Featured Star: ${team.featured_star} (${team.headline_stat})`;

    // Left Column Info with All Championship Years
    document.getElementById("modalRecord").innerHTML = `
        <div style="margin-bottom: 6px;">Last Season: <strong>${team.last_season_record}</strong></div>
        <div style="margin-bottom: 6px;">Championships: <strong>${meta.rings}</strong></div>
        <div style="font-size: 0.78rem; line-height: 1.4; color: #475569;">Years: <strong>${yearsString}</strong></div>
    `;

    document.getElementById("modalDescription").innerText = team.description;

    const modalImg = document.getElementById("modalLogo");
    modalImg.src = team.logo;
    modalImg.onerror = () => {
        modalImg.src = "https://cdn.nba.com/logos/nba/1610612738/primary/L/logo.svg";
    };

    // 11-column starter stat row generation using CBS Sports regular season metrics
    const tbody = document.getElementById("modalStartersBody");
    tbody.innerHTML = team.starters_2026_27.map(p => {
        const bm = playerStatsBenchmark[p.name] || {};
        const pts = p.pts ?? bm.pts ?? 0.0;
        const reb = p.reb ?? bm.reb ?? 0.0;
        const ast = p.ast ?? bm.ast ?? 0.0;
        const stl = p.stl ?? bm.stl ?? 0.0;
        const blk = p.blk ?? bm.blk ?? 0.0;
        const tov = p.tov ?? bm.tov ?? 0.0;
        const fg = p.fg ?? bm.fg ?? 0.0;
        const fg3 = p.fg3 ?? bm.fg3 ?? 0.0;
        const ft = p.ft ?? bm.ft ?? 0.0;

        return `
            <tr>
                <td class="pos-tag">${p.pos}</td>
                <td><strong>${p.name}</strong></td>
                <td>${pts.toFixed(1)}</td>
                <td>${reb.toFixed(1)}</td>
                <td>${ast.toFixed(1)}</td>
                <td>${stl.toFixed(1)}</td>
                <td>${blk.toFixed(1)}</td>
                <td>${tov.toFixed(1)}</td>
                <td>${fg.toFixed(1)}%</td>
                <td>${fg3.toFixed(1)}%</td>
                <td>${ft.toFixed(1)}%</td>
            </tr>
        `;
    }).join("");

    const salaryRow = document.getElementById("modalSalaryRow");
    if (salaryRow) {
        salaryRow.innerHTML = `
            <span style="font-size: 0.85rem; font-weight: 800; color: #111827;">2026-27 Payroll: ${formattedSalary}</span>
            <span class="tx-badge tx-badge-${meta.status.replace(' ', '_')}">${meta.status}</span>
        `;
    }

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
