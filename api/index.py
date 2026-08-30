from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="NBA 2026-2027 Teams & Rosters API",
    description="REST API containing all 30 NBA teams with 6-division grouping and 2026-2027 rosters.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

teams = [
    # --- ATLANTIC ---
    {
        "id": 1, "name": "Boston Celtics", "city": "Boston", "conference": "Eastern", "division": "Atlantic",
        "founded": 1946, "championships": 18, "arena": "TD Garden",
        "logo": "https://cdn.nba.com/logos/nba/1610612738/primary/L/logo.svg",
        "description": "Defending contenders with high-volume perimeter shooting and lockdown defense.",
        "roster": [
            {"id": 101, "name": "Jayson Tatum", "pos": "SF", "ppg": 27.4, "rpg": 8.6, "apg": 5.2, "spg": 1.1, "fg_pct": ".475", "fg3_pct": ".380"},
            {"id": 102, "name": "Jaylen Brown", "pos": "SG", "ppg": 24.1, "rpg": 5.8, "apg": 3.9, "spg": 1.2, "fg_pct": ".502", "fg3_pct": ".360"},
            {"id": 103, "name": "Derrick White", "pos": "PG", "ppg": 16.5, "rpg": 4.2, "apg": 5.5, "spg": 1.2, "fg_pct": ".465", "fg3_pct": ".401"},
            {"id": 104, "name": "Kristaps Porzingis", "pos": "C", "ppg": 19.5, "rpg": 7.0, "apg": 2.1, "spg": 0.7, "fg_pct": ".518", "fg3_pct": ".378"},
            {"id": 105, "name": "Jrue Holiday", "pos": "PG", "ppg": 12.0, "rpg": 5.0, "apg": 4.6, "spg": 1.0, "fg_pct": ".478", "fg3_pct": ".415"},
            {"id": 106, "name": "Payton Pritchard", "pos": "PG", "ppg": 11.2, "rpg": 3.4, "apg": 3.8, "spg": 0.6, "fg_pct": ".468", "fg3_pct": ".392"}
        ]
    },
    {
        "id": 2, "name": "Brooklyn Nets", "city": "Brooklyn", "conference": "Eastern", "division": "Atlantic",
        "founded": 1967, "championships": 0, "arena": "Barclays Center",
        "logo": "https://cdn.nba.com/logos/nba/1610612751/primary/L/logo.svg",
        "description": "A rebuilding team driven by perimeter isolation scoring and mobile frontcourt defense.",
        "roster": [
            {"id": 201, "name": "Cam Thomas", "pos": "SG", "ppg": 23.5, "rpg": 3.5, "apg": 3.4, "spg": 0.8, "fg_pct": ".448", "fg3_pct": ".365"},
            {"id": 202, "name": "Nic Claxton", "pos": "C", "ppg": 12.4, "rpg": 10.4, "apg": 2.2, "spg": 0.6, "fg_pct": ".635", "fg3_pct": ".200"},
            {"id": 203, "name": "Noah Clowney", "pos": "PF", "ppg": 11.8, "rpg": 6.5, "apg": 1.6, "spg": 0.7, "fg_pct": ".480", "fg3_pct": ".360"},
            {"id": 204, "name": "Terance Mann", "pos": "SG", "ppg": 9.4, "rpg": 3.8, "apg": 2.4, "spg": 0.7, "fg_pct": ".490", "fg3_pct": ".350"}
        ]
    },
    {
        "id": 3, "name": "New York Knicks", "city": "New York", "conference": "Eastern", "division": "Atlantic",
        "founded": 1946, "championships": 2, "arena": "Madison Square Garden",
        "logo": "https://cdn.nba.com/logos/nba/1610612752/primary/L/logo.svg",
        "description": "A physical contender combining Jalen Brunson's clutch play with floor-stretching bigs.",
        "roster": [
            {"id": 301, "name": "Jalen Brunson", "pos": "PG", "ppg": 28.5, "rpg": 3.7, "apg": 7.2, "spg": 0.9, "fg_pct": ".482", "fg3_pct": ".400"},
            {"id": 302, "name": "Karl-Anthony Towns", "pos": "C", "ppg": 22.8, "rpg": 10.4, "apg": 3.2, "spg": 0.7, "fg_pct": ".515", "fg3_pct": ".415"},
            {"id": 303, "name": "Mikal Bridges", "pos": "SG", "ppg": 18.5, "rpg": 4.6, "apg": 3.8, "spg": 1.2, "fg_pct": ".465", "fg3_pct": ".375"},
            {"id": 304, "name": "OG Anunoby", "pos": "SF", "ppg": 15.6, "rpg": 4.8, "apg": 2.2, "spg": 1.6, "fg_pct": ".490", "fg3_pct": ".380"},
            {"id": 305, "name": "Josh Hart", "pos": "SG", "ppg": 10.5, "rpg": 8.5, "apg": 4.4, "spg": 1.0, "fg_pct": ".495", "fg3_pct": ".325"}
        ]
    },
    {
        "id": 4, "name": "Philadelphia 76ers", "city": "Philadelphia", "conference": "Eastern", "division": "Atlantic",
        "founded": 1946, "championships": 3, "arena": "Xfinity Mobile Arena",
        "logo": "https://cdn.nba.com/logos/nba/1610612755/primary/L/logo.svg",
        "description": "Historic franchise anchored by Joel Embiid's MVP paint control and dynamic guard speed.",
        "roster": [
            {"id": 401, "name": "Joel Embiid", "pos": "C", "ppg": 32.5, "rpg": 11.4, "apg": 5.6, "spg": 1.1, "fg_pct": ".530", "fg3_pct": ".380"},
            {"id": 402, "name": "Tyrese Maxey", "pos": "PG", "ppg": 26.5, "rpg": 3.8, "apg": 6.4, "spg": 1.1, "fg_pct": ".460", "fg3_pct": ".385"},
            {"id": 403, "name": "Paul George", "pos": "SF", "ppg": 21.0, "rpg": 5.2, "apg": 3.6, "spg": 1.4, "fg_pct": ".465", "fg3_pct": ".405"},
            {"id": 404, "name": "Kelly Oubre Jr.", "pos": "SG", "ppg": 13.8, "rpg": 4.6, "apg": 1.4, "spg": 1.2, "fg_pct": ".445", "fg3_pct": ".330"}
        ]
    },
    {
        "id": 5, "name": "Toronto Raptors", "city": "Toronto", "conference": "Eastern", "division": "Atlantic",
        "founded": 1995, "championships": 1, "arena": "Scotiabank Arena",
        "logo": "https://cdn.nba.com/logos/nba/1610612761/primary/L/logo.svg",
        "description": "Canada's team running an unselfish, switchable offensive system led by Scottie Barnes.",
        "roster": [
            {"id": 501, "name": "Scottie Barnes", "pos": "SF", "ppg": 21.2, "rpg": 8.4, "apg": 6.2, "spg": 1.3, "fg_pct": ".480", "fg3_pct": ".350"},
            {"id": 502, "name": "Immanuel Quickley", "pos": "PG", "ppg": 19.5, "rpg": 4.7, "apg": 6.8, "spg": 1.0, "fg_pct": ".440", "fg3_pct": ".395"},
            {"id": 503, "name": "RJ Barrett", "pos": "SG", "ppg": 21.4, "rpg": 6.4, "apg": 4.1, "spg": 0.7, "fg_pct": ".545", "fg3_pct": ".380"},
            {"id": 504, "name": "Jakob Poeltl", "pos": "C", "ppg": 11.5, "rpg": 8.8, "apg": 2.6, "spg": 0.7, "fg_pct": ".655", "fg3_pct": ".000"}
        ]
    },

    # --- CENTRAL ---
    {
        "id": 6, "name": "Chicago Bulls", "city": "Chicago", "conference": "Eastern", "division": "Central",
        "founded": 1966, "championships": 6, "arena": "United Center",
        "logo": "https://cdn.nba.com/logos/nba/1610612741/primary/L/logo.svg",
        "description": "A perimeter-oriented team built on transition passing, playmaking, and young wings.",
        "roster": [
            {"id": 601, "name": "Josh Giddey", "pos": "PG", "ppg": 16.8, "rpg": 7.4, "apg": 7.9, "spg": 1.1, "fg_pct": ".465", "fg3_pct": ".350"},
            {"id": 602, "name": "Coby White", "pos": "SG", "ppg": 20.4, "rpg": 4.6, "apg": 5.1, "spg": 0.8, "fg_pct": ".452", "fg3_pct": ".382"},
            {"id": 603, "name": "Matas Buzelis", "pos": "SF", "ppg": 13.6, "rpg": 5.5, "apg": 2.1, "spg": 0.9, "fg_pct": ".460", "fg3_pct": ".345"},
            {"id": 604, "name": "Patrick Williams", "pos": "PF", "ppg": 10.8, "rpg": 4.4, "apg": 1.8, "spg": 0.9, "fg_pct": ".445", "fg3_pct": ".385"}
        ]
    },
    {
        "id": 7, "name": "Cleveland Cavaliers", "city": "Cleveland", "conference": "Eastern", "division": "Central",
        "founded": 1970, "championships": 1, "arena": "Rocket Mortgage FieldHouse",
        "logo": "https://cdn.nba.com/logos/nba/1610612739/primary/L/logo.svg",
        "description": "High-efficiency squad powered by explosive guard play and an elite defensive frontcourt.",
        "roster": [
            {"id": 701, "name": "Donovan Mitchell", "pos": "SG", "ppg": 27.5, "rpg": 5.2, "apg": 6.2, "spg": 1.6, "fg_pct": ".470", "fg3_pct": ".378"},
            {"id": 702, "name": "Darius Garland", "pos": "PG", "ppg": 20.2, "rpg": 2.8, "apg": 7.4, "spg": 1.2, "fg_pct": ".465", "fg3_pct": ".388"},
            {"id": 703, "name": "Evan Mobley", "pos": "PF", "ppg": 18.2, "rpg": 10.1, "apg": 3.8, "spg": 0.9, "fg_pct": ".550", "fg3_pct": ".340"},
            {"id": 704, "name": "Jarrett Allen", "pos": "C", "ppg": 15.6, "rpg": 10.8, "apg": 2.4, "spg": 0.7, "fg_pct": ".648", "fg3_pct": ".000"}
        ]
    },
    {
        "id": 8, "name": "Detroit Pistons", "city": "Detroit", "conference": "Eastern", "division": "Central",
        "founded": 1941, "championships": 3, "arena": "Little Caesars Arena",
        "logo": "https://cdn.nba.com/logos/nba/1610612765/primary/L/logo.svg",
        "description": "A rising, physical young core built on high-level guard passing and glass crashing.",
        "roster": [
            {"id": 801, "name": "Cade Cunningham", "pos": "PG", "ppg": 24.2, "rpg": 5.1, "apg": 8.2, "spg": 1.0, "fg_pct": ".460", "fg3_pct": ".365"},
            {"id": 802, "name": "Jaden Ivey", "pos": "SG", "ppg": 18.4, "rpg": 4.0, "apg": 4.2, "spg": 0.9, "fg_pct": ".455", "fg3_pct": ".370"},
            {"id": 803, "name": "Jalen Duren", "pos": "C", "ppg": 14.8, "rpg": 12.2, "apg": 2.8, "spg": 0.6, "fg_pct": ".640", "fg3_pct": ".000"},
            {"id": 804, "name": "Ron Holland II", "pos": "SF", "ppg": 11.2, "rpg": 4.4, "apg": 1.8, "spg": 1.2, "fg_pct": ".440", "fg3_pct": ".325"}
        ]
    },
    {
        "id": 9, "name": "Indiana Pacers", "city": "Indianapolis", "conference": "Eastern", "division": "Central",
        "founded": 1967, "championships": 0, "arena": "Gainbridge Fieldhouse",
        "logo": "https://cdn.nba.com/logos/nba/1610612754/primary/L/logo.svg",
        "description": "A historic, high-scoring offense executing lightning-fast pace and elite transition assists.",
        "roster": [
            {"id": 901, "name": "Tyrese Haliburton", "pos": "PG", "ppg": 21.8, "rpg": 4.1, "apg": 11.2, "spg": 1.4, "fg_pct": ".480", "fg3_pct": ".375"},
            {"id": 902, "name": "Pascal Siakam", "pos": "PF", "ppg": 22.1, "rpg": 7.5, "apg": 4.0, "spg": 0.9, "fg_pct": ".535", "fg3_pct": ".365"},
            {"id": 903, "name": "Myles Turner", "pos": "C", "ppg": 16.8, "rpg": 7.1, "apg": 1.4, "spg": 0.5, "fg_pct": ".525", "fg3_pct": ".360"},
            {"id": 904, "name": "Bennedict Mathurin", "pos": "SG", "ppg": 15.6, "rpg": 4.3, "apg": 2.2, "spg": 0.7, "fg_pct": ".455", "fg3_pct": ".370"}
        ]
    },
    {
        "id": 10, "name": "Milwaukee Bucks", "city": "Milwaukee", "conference": "Eastern", "division": "Central",
        "founded": 1968, "championships": 2, "arena": "Fiserv Forum",
        "logo": "https://cdn.nba.com/logos/nba/1610612749/primary/L/logo.svg",
        "description": "A dominant force running through Giannis Antetokounmpo's interior power and deep shooting.",
        "roster": [
            {"id": 1001, "name": "Giannis Antetokounmpo", "pos": "PF", "ppg": 31.0, "rpg": 11.8, "apg": 6.5, "spg": 1.2, "fg_pct": ".610", "fg3_pct": ".280"},
            {"id": 1002, "name": "Damian Lillard", "pos": "PG", "ppg": 24.5, "rpg": 4.3, "apg": 7.1, "spg": 1.0, "fg_pct": ".435", "fg3_pct": ".370"},
            {"id": 1003, "name": "Khris Middleton", "pos": "SF", "ppg": 15.2, "rpg": 4.6, "apg": 5.0, "spg": 0.8, "fg_pct": ".488", "fg3_pct": ".385"},
            {"id": 1004, "name": "Brook Lopez", "pos": "C", "ppg": 12.4, "rpg": 5.1, "apg": 1.5, "spg": 0.5, "fg_pct": ".480", "fg3_pct": ".365"}
        ]
    },

    # --- SOUTHEAST ---
    {
        "id": 11, "name": "Atlanta Hawks", "city": "Atlanta", "conference": "Eastern", "division": "Southeast",
        "founded": 1946, "championships": 1, "arena": "State Farm Arena",
        "logo": "https://cdn.nba.com/logos/nba/1610612737/primary/L/logo.svg",
        "description": "Fast-paced Eastern squad powered by Trae Young's playmaking and versatile athletic wings.",
        "roster": [
            {"id": 1101, "name": "Trae Young", "pos": "PG", "ppg": 26.4, "rpg": 2.8, "apg": 10.8, "spg": 1.3, "fg_pct": ".430", "fg3_pct": ".372"},
            {"id": 1102, "name": "Jalen Johnson", "pos": "PF", "ppg": 18.5, "rpg": 9.2, "apg": 4.6, "spg": 1.2, "fg_pct": ".511", "fg3_pct": ".355"},
            {"id": 1103, "name": "Dyson Daniels", "pos": "SG", "ppg": 13.8, "rpg": 5.4, "apg": 4.1, "spg": 2.6, "fg_pct": ".465", "fg3_pct": ".340"},
            {"id": 1104, "name": "Zaccharie Risacher", "pos": "SF", "ppg": 15.2, "rpg": 4.8, "apg": 2.3, "spg": 0.9, "fg_pct": ".450", "fg3_pct": ".370"}
        ]
    },
    {
        "id": 12, "name": "Charlotte Hornets", "city": "Charlotte", "conference": "Eastern", "division": "Southeast",
        "founded": 1988, "championships": 0, "arena": "Spectrum Center",
        "logo": "https://cdn.nba.com/logos/nba/1610612766/primary/L/logo.svg",
        "description": "Dynamic young franchise with elite guard vision and athletic perimeter scorers.",
        "roster": [
            {"id": 1201, "name": "LaMelo Ball", "pos": "PG", "ppg": 25.4, "rpg": 5.6, "apg": 8.7, "spg": 1.5, "fg_pct": ".435", "fg3_pct": ".370"},
            {"id": 1202, "name": "Brandon Miller", "pos": "SF", "ppg": 21.0, "rpg": 5.1, "apg": 3.2, "spg": 1.1, "fg_pct": ".455", "fg3_pct": ".385"},
            {"id": 1203, "name": "Mark Williams", "pos": "C", "ppg": 13.5, "rpg": 10.1, "apg": 1.4, "spg": 0.5, "fg_pct": ".645", "fg3_pct": ".000"},
            {"id": 1204, "name": "Tre Mann", "pos": "PG", "ppg": 13.8, "rpg": 3.6, "apg": 4.2, "spg": 1.0, "fg_pct": ".450", "fg3_pct": ".375"}
        ]
    },
    {
        "id": 13, "name": "Miami Heat", "city": "Miami", "conference": "Eastern", "division": "Southeast",
        "founded": 1988, "championships": 3, "arena": "Kaseya Center",
        "logo": "https://cdn.nba.com/logos/nba/1610612748/primary/L/logo.svg",
        "description": "Resilient franchise famous for championship culture, tough interior defense, and grit.",
        "roster": [
            {"id": 1301, "name": "Jimmy Butler", "pos": "SF", "ppg": 20.8, "rpg": 5.4, "apg": 5.2, "spg": 1.4, "fg_pct": ".500", "fg3_pct": ".390"},
            {"id": 1302, "name": "Bam Adebayo", "pos": "C", "ppg": 19.8, "rpg": 10.6, "apg": 4.1, "spg": 1.1, "fg_pct": ".525", "fg3_pct": ".340"},
            {"id": 1303, "name": "Tyler Herro", "pos": "SG", "ppg": 21.2, "rpg": 5.2, "apg": 4.6, "spg": 0.8, "fg_pct": ".445", "fg3_pct": ".395"},
            {"id": 1304, "name": "Jaime Jaquez Jr.", "pos": "SF", "ppg": 13.5, "rpg": 4.8, "apg": 2.8, "spg": 1.1, "fg_pct": ".490", "fg3_pct": ".330"}
        ]
    },
    {
        "id": 14, "name": "Orlando Magic", "city": "Orlando", "conference": "Eastern", "division": "Southeast",
        "founded": 1989, "championships": 0, "arena": "Kia Center",
        "logo": "https://cdn.nba.com/logos/nba/1610612753/primary/L/logo.svg",
        "description": "A long, defensive-first team featuring playmaking forwards and relentless rim deterrence.",
        "roster": [
            {"id": 1401, "name": "Paolo Banchero", "pos": "PF", "ppg": 24.5, "rpg": 7.4, "apg": 5.8, "spg": 1.0, "fg_pct": ".470", "fg3_pct": ".350"},
            {"id": 1402, "name": "Franz Wagner", "pos": "SF", "ppg": 20.8, "rpg": 5.6, "apg": 4.1, "spg": 1.1, "fg_pct": ".488", "fg3_pct": ".345"},
            {"id": 1403, "name": "Jalen Suggs", "pos": "PG", "ppg": 14.2, "rpg": 3.6, "apg": 3.4, "spg": 1.5, "fg_pct": ".465", "fg3_pct": ".395"},
            {"id": 1404, "name": "Kentavious Caldwell-Pope", "pos": "SG", "ppg": 10.6, "rpg": 2.5, "apg": 1.8, "spg": 1.3, "fg_pct": ".455", "fg3_pct": ".400"}
        ]
    },
    {
        "id": 15, "name": "Washington Wizards", "city": "Washington", "conference": "Eastern", "division": "Southeast",
        "founded": 1961, "championships": 1, "arena": "Capital One Arena",
        "logo": "https://cdn.nba.com/logos/nba/1610612764/primary/L/logo.svg",
        "description": "Young rebuilding team developing top lottery talent, floor spacing, and defensive length.",
        "roster": [
            {"id": 1501, "name": "Jordan Poole", "pos": "SG", "ppg": 19.5, "rpg": 2.9, "apg": 4.8, "spg": 1.1, "fg_pct": ".425", "fg3_pct": ".345"},
            {"id": 1502, "name": "Kyle Kuzma", "pos": "PF", "ppg": 21.4, "rpg": 6.8, "apg": 4.2, "spg": 0.6, "fg_pct": ".465", "fg3_pct": ".340"},
            {"id": 1503, "name": "Alex Sarr", "pos": "C", "ppg": 13.8, "rpg": 7.6, "apg": 2.4, "spg": 0.8, "fg_pct": ".455", "fg3_pct": ".320"},
            {"id": 1504, "name": "Bub Carrington", "pos": "PG", "ppg": 11.2, "rpg": 3.8, "apg": 4.6, "spg": 0.8, "fg_pct": ".420", "fg3_pct": ".360"}
        ]
    },

    # --- NORTHWEST ---
    {
        "id": 16, "name": "Denver Nuggets", "city": "Denver", "conference": "Western", "division": "Northwest",
        "founded": 1967, "championships": 1, "arena": "Ball Arena",
        "logo": "https://cdn.nba.com/logos/nba/1610612743/primary/L/logo.svg",
        "description": "Perennial title contender operating around Nikola Jokic's historic triple-double engine.",
        "roster": [
            {"id": 1601, "name": "Nikola Jokic", "pos": "C", "ppg": 26.8, "rpg": 12.6, "apg": 9.8, "spg": 1.4, "fg_pct": ".585", "fg3_pct": ".365"},
            {"id": 1602, "name": "Jamal Murray", "pos": "PG", "ppg": 21.6, "rpg": 4.2, "apg": 6.7, "spg": 1.0, "fg_pct": ".478", "fg3_pct": ".410"},
            {"id": 1603, "name": "Michael Porter Jr.", "pos": "SF", "ppg": 17.2, "rpg": 7.1, "apg": 1.7, "spg": 0.6, "fg_pct": ".485", "fg3_pct": ".402"},
            {"id": 1604, "name": "Aaron Gordon", "pos": "PF", "ppg": 14.5, "rpg": 6.7, "apg": 3.6, "spg": 0.8, "fg_pct": ".560", "fg3_pct": ".320"}
        ]
    },
    {
        "id": 17, "name": "Minnesota Timberwolves", "city": "Minneapolis", "conference": "Western", "division": "Northwest",
        "founded": 1989, "championships": 0, "arena": "Target Center",
        "logo": "https://cdn.nba.com/logos/nba/1610612750/primary/L/logo.svg",
        "description": "Top-tier Western force anchored by Anthony Edwards' explosion and interior size.",
        "roster": [
            {"id": 1701, "name": "Anthony Edwards", "pos": "SG", "ppg": 27.8, "rpg": 5.8, "apg": 5.5, "spg": 1.5, "fg_pct": ".475", "fg3_pct": ".385"},
            {"id": 1702, "name": "Julius Randle", "pos": "PF", "ppg": 22.5, "rpg": 8.9, "apg": 4.8, "spg": 0.8, "fg_pct": ".480", "fg3_pct": ".330"},
            {"id": 1703, "name": "Rudy Gobert", "pos": "C", "ppg": 13.5, "rpg": 12.6, "apg": 1.3, "spg": 0.6, "fg_pct": ".650", "fg3_pct": ".000"},
            {"id": 1704, "name": "Jaden McDaniels", "pos": "SF", "ppg": 12.0, "rpg": 3.5, "apg": 1.6, "spg": 1.2, "fg_pct": ".490", "fg3_pct": ".365"}
        ]
    },
    {
        "id": 18, "name": "Oklahoma City Thunder", "city": "Oklahoma City", "conference": "Western", "division": "Northwest",
        "founded": 1967, "championships": 1, "arena": "Paycom Center",
        "logo": "https://cdn.nba.com/logos/nba/1610612760/primary/L/logo.svg",
        "description": "Championship contenders featuring MVP-caliber guard scoring and complete five-out spacing.",
        "roster": [
            {"id": 1801, "name": "Shai Gilgeous-Alexander", "pos": "PG", "ppg": 31.2, "rpg": 5.8, "apg": 6.6, "spg": 2.1, "fg_pct": ".540", "fg3_pct": ".365"},
            {"id": 1802, "name": "Jalen Williams", "pos": "SF", "ppg": 20.4, "rpg": 4.6, "apg": 5.0, "spg": 1.2, "fg_pct": ".545", "fg3_pct": ".420"},
            {"id": 1803, "name": "Chet Holmgren", "pos": "C", "ppg": 18.2, "rpg": 8.8, "apg": 2.8, "spg": 0.8, "fg_pct": ".535", "fg3_pct": ".380"},
            {"id": 1804, "name": "Alex Caruso", "pos": "SG", "ppg": 10.5, "rpg": 3.9, "apg": 3.6, "spg": 1.7, "fg_pct": ".470", "fg3_pct": ".400"}
        ]
    },
    {
        "id": 19, "name": "Portland Trail Blazers", "city": "Portland", "conference": "Western", "division": "Northwest",
        "founded": 1970, "championships": 1, "arena": "Moda Center",
        "logo": "https://cdn.nba.com/logos/nba/1610612757/primary/L/logo.svg",
        "description": "An electric young core built around backcourt speed and physical frontcourt rim running.",
        "roster": [
            {"id": 1901, "name": "Anfernee Simons", "pos": "SG", "ppg": 22.8, "rpg": 3.5, "apg": 5.6, "spg": 0.6, "fg_pct": ".435", "fg3_pct": ".385"},
            {"id": 1902, "name": "Shaedon Sharpe", "pos": "SG", "ppg": 18.2, "rpg": 4.8, "apg": 3.2, "spg": 0.9, "fg_pct": ".450", "fg3_pct": ".360"},
            {"id": 1903, "name": "Scoot Henderson", "pos": "PG", "ppg": 16.5, "rpg": 3.4, "apg": 6.2, "spg": 1.1, "fg_pct": ".425", "fg3_pct": ".345"},
            {"id": 1904, "name": "Deandre Ayton", "pos": "C", "ppg": 16.8, "rpg": 11.2, "apg": 1.6, "spg": 1.0, "fg_pct": ".575", "fg3_pct": ".150"}
        ]
    },
    {
        "id": 20, "name": "Utah Jazz", "city": "Salt Lake City", "conference": "Western", "division": "Northwest",
        "founded": 1974, "championships": 0, "arena": "Delta Center",
        "logo": "https://cdn.nba.com/logos/nba/1610612762/primary/L/logo.svg",
        "description": "High-scoring Northwest squad featuring 7-foot three-point marksmen and emerging guards.",
        "roster": [
            {"id": 2001, "name": "Lauri Markkanen", "pos": "PF", "ppg": 23.8, "rpg": 8.2, "apg": 2.0, "spg": 0.8, "fg_pct": ".485", "fg3_pct": ".400"},
            {"id": 2002, "name": "Collin Sexton", "pos": "SG", "ppg": 19.1, "rpg": 2.7, "apg": 5.1, "spg": 0.8, "fg_pct": ".490", "fg3_pct": ".395"},
            {"id": 2003, "name": "Keyonte George", "pos": "PG", "ppg": 15.8, "rpg": 3.1, "apg": 5.5, "spg": 0.9, "fg_pct": ".410", "fg3_pct": ".350"},
            {"id": 2004, "name": "Walker Kessler", "pos": "C", "ppg": 9.4, "rpg": 8.5, "apg": 1.0, "spg": 0.5, "fg_pct": ".655", "fg3_pct": ".200"}
        ]
    },

    # --- PACIFIC ---
    {
        "id": 21, "name": "Golden State Warriors", "city": "San Francisco", "conference": "Western", "division": "Pacific",
        "founded": 1946, "championships": 7, "arena": "Chase Center",
        "logo": "https://cdn.nba.com/logos/nba/1610612744/primary/L/logo.svg",
        "description": "Iconic perimeter franchise combining Stephen Curry's marksmanship with dynamic wings.",
        "roster": [
            {"id": 2101, "name": "Stephen Curry", "pos": "PG", "ppg": 26.2, "rpg": 4.5, "apg": 5.4, "spg": 0.9, "fg_pct": ".458", "fg3_pct": ".410"},
            {"id": 2102, "name": "Jonathan Kuminga", "pos": "PF", "ppg": 19.8, "rpg": 5.6, "apg": 2.6, "spg": 0.9, "fg_pct": ".525", "fg3_pct": ".340"},
            {"id": 2103, "name": "Draymond Green", "pos": "PF", "ppg": 8.5, "rpg": 7.1, "apg": 6.2, "spg": 1.0, "fg_pct": ".490", "fg3_pct": ".370"},
            {"id": 2104, "name": "Buddy Hield", "pos": "SG", "ppg": 14.8, "rpg": 3.6, "apg": 2.2, "spg": 0.8, "fg_pct": ".445", "fg3_pct": ".405"}
        ]
    },
    {
        "id": 22, "name": "LA Clippers", "city": "Los Angeles", "conference": "Western", "division": "Pacific",
        "founded": 1970, "championships": 0, "arena": "Intuit Dome",
        "logo": "https://cdn.nba.com/logos/nba/1610612746/primary/L/logo.svg",
        "description": "Veteran playoff contender built on isolation shotmaking and physical interior rebounding.",
        "roster": [
            {"id": 2201, "name": "Kawhi Leonard", "pos": "SF", "ppg": 24.2, "rpg": 6.4, "apg": 3.7, "spg": 1.6, "fg_pct": ".520", "fg3_pct": ".415"},
            {"id": 2202, "name": "James Harden", "pos": "PG", "ppg": 18.6, "rpg": 5.4, "apg": 8.8, "spg": 1.2, "fg_pct": ".435", "fg3_pct": ".380"},
            {"id": 2203, "name": "Ivica Zubac", "pos": "C", "ppg": 13.5, "rpg": 10.2, "apg": 1.6, "spg": 0.4, "fg_pct": ".645", "fg3_pct": ".000"},
            {"id": 2204, "name": "Norman Powell", "pos": "SG", "ppg": 15.8, "rpg": 2.8, "apg": 1.5, "spg": 0.8, "fg_pct": ".488", "fg3_pct": ".425"}
        ]
    },
    {
        "id": 23, "name": "Los Angeles Lakers", "city": "Los Angeles", "conference": "Western", "division": "Pacific",
        "founded": 1947, "championships": 17, "arena": "Crypto.com Arena",
        "logo": "https://cdn.nba.com/logos/nba/1610612747/primary/L/logo.svg",
        "description": "Historic franchise anchored by Anthony Davis inside and LeBron James' playmaking brilliance.",
        "roster": [
            {"id": 2301, "name": "Anthony Davis", "pos": "C", "ppg": 25.6, "rpg": 12.8, "apg": 3.4, "spg": 1.2, "fg_pct": ".558", "fg3_pct": ".290"},
            {"id": 2302, "name": "LeBron James", "pos": "SF", "ppg": 24.5, "rpg": 7.2, "apg": 8.0, "spg": 1.2, "fg_pct": ".535", "fg3_pct": ".390"},
            {"id": 2303, "name": "Austin Reaves", "pos": "SG", "ppg": 16.5, "rpg": 4.5, "apg": 5.8, "spg": 0.9, "fg_pct": ".485", "fg3_pct": ".372"},
            {"id": 2304, "name": "Rui Hachimura", "pos": "PF", "ppg": 13.8, "rpg": 4.6, "apg": 1.4, "spg": 0.6, "fg_pct": ".530", "fg3_pct": ".410"},
            {"id": 2305, "name": "Dalton Knecht", "pos": "SG", "ppg": 12.4, "rpg": 3.2, "apg": 1.6, "spg": 0.6, "fg_pct": ".460", "fg3_pct": ".395"}
        ]
    },
    {
        "id": 24, "name": "Phoenix Suns", "city": "Phoenix", "conference": "Western", "division": "Pacific",
        "founded": 1968, "championships": 0, "arena": "Footprint Center",
        "logo": "https://cdn.nba.com/logos/nba/1610612756/primary/L/logo.svg",
        "description": "High-scoring Pacific team featuring elite three-level mid-range and perimeter scoring.",
        "roster": [
            {"id": 2401, "name": "Kevin Durant", "pos": "PF", "ppg": 26.8, "rpg": 6.5, "apg": 5.0, "spg": 0.9, "fg_pct": ".525", "fg3_pct": ".415"},
            {"id": 2402, "name": "Devin Booker", "pos": "SG", "ppg": 27.0, "rpg": 4.5, "apg": 6.8, "spg": 1.0, "fg_pct": ".492", "fg3_pct": ".370"},
            {"id": 2403, "name": "Bradley Beal", "pos": "SG", "ppg": 17.8, "rpg": 4.2, "apg": 4.8, "spg": 1.0, "fg_pct": ".510", "fg3_pct": ".420"},
            {"id": 2404, "name": "Tyus Jones", "pos": "PG", "ppg": 11.5, "rpg": 2.8, "apg": 7.2, "spg": 1.1, "fg_pct": ".485", "fg3_pct": ".410"}
        ]
    },
    {
        "id": 25, "name": "Sacramento Kings", "city": "Sacramento", "conference": "Western", "division": "Pacific",
        "founded": 1923, "championships": 1, "arena": "Golden 1 Center",
        "logo": "https://cdn.nba.com/logos/nba/1610612758/primary/L/logo.svg",
        "description": "High-octane beam-lighting franchise driven by clutch shotmaking and center playmaking.",
        "roster": [
            {"id": 2501, "name": "De'Aaron Fox", "pos": "PG", "ppg": 26.8, "rpg": 4.6, "apg": 5.8, "spg": 2.0, "fg_pct": ".470", "fg3_pct": ".370"},
            {"id": 2502, "name": "Domantas Sabonis", "pos": "C", "ppg": 19.6, "rpg": 13.8, "apg": 8.3, "spg": 0.9, "fg_pct": ".595", "fg3_pct": ".380"},
            {"id": 2503, "name": "DeMar DeRozan", "pos": "SF", "ppg": 22.8, "rpg": 4.2, "apg": 5.3, "spg": 1.1, "fg_pct": ".485", "fg3_pct": ".335"},
            {"id": 2504, "name": "Keegan Murray", "pos": "PF", "ppg": 15.4, "rpg": 5.6, "apg": 1.8, "spg": 1.0, "fg_pct": ".460", "fg3_pct": ".365"}
        ]
    },

    # --- SOUTHWEST ---
    {
        "id": 26, "name": "Dallas Mavericks", "city": "Dallas", "conference": "Western", "division": "Southwest",
        "founded": 1980, "championships": 1, "arena": "American Airlines Center",
        "logo": "https://cdn.nba.com/logos/nba/1610612742/primary/L/logo.svg",
        "description": "Championship contenders powered by Luka Doncic, Kyrie Irving, and vertical lob threats.",
        "roster": [
            {"id": 2601, "name": "Luka Doncic", "pos": "PG", "ppg": 33.2, "rpg": 9.4, "apg": 9.8, "spg": 1.4, "fg_pct": ".488", "fg3_pct": ".382"},
            {"id": 2602, "name": "Kyrie Irving", "pos": "SG", "ppg": 24.8, "rpg": 4.8, "apg": 5.4, "spg": 1.2, "fg_pct": ".495", "fg3_pct": ".410"},
            {"id": 2603, "name": "Klay Thompson", "pos": "SF", "ppg": 16.5, "rpg": 3.4, "apg": 2.0, "spg": 0.7, "fg_pct": ".440", "fg3_pct": ".395"},
            {"id": 2604, "name": "Dereck Lively II", "pos": "C", "ppg": 11.4, "rpg": 8.8, "apg": 2.0, "spg": 0.7, "fg_pct": ".720", "fg3_pct": ".000"}
        ]
    },
    {
        "id": 27, "name": "Houston Rockets", "city": "Houston", "conference": "Western", "division": "Southwest",
        "founded": 1967, "championships": 2, "arena": "Toyota Center",
        "logo": "https://cdn.nba.com/logos/nba/1610612745/primary/L/logo.svg",
        "description": "Aggressive young team combining Turkish pivot Alperen Sengun with athletic transition guards.",
        "roster": [
            {"id": 2701, "name": "Alperen Sengun", "pos": "C", "ppg": 22.0, "rpg": 10.1, "apg": 5.6, "spg": 1.2, "fg_pct": ".540", "fg3_pct": ".310"},
            {"id": 2702, "name": "Jalen Green", "pos": "SG", "ppg": 21.5, "rpg": 5.2, "apg": 3.8, "spg": 0.9, "fg_pct": ".440", "fg3_pct": ".355"},
            {"id": 2703, "name": "Fred VanVleet", "pos": "PG", "ppg": 16.2, "rpg": 3.7, "apg": 8.0, "spg": 1.4, "fg_pct": ".418", "fg3_pct": ".382"},
            {"id": 2704, "name": "Amen Thompson", "pos": "SF", "ppg": 13.5, "rpg": 7.2, "apg": 3.5, "spg": 1.6, "fg_pct": ".545", "fg3_pct": ".220"}
        ]
    },
    {
        "id": 28, "name": "Memphis Grizzlies", "city": "Memphis", "conference": "Western", "division": "Southwest",
        "founded": 1995, "championships": 0, "arena": "FedExForum",
        "logo": "https://cdn.nba.com/logos/nba/1610612763/primary/L/logo.svg",
        "description": "Grit-and-grind powerhouse defined by Ja Morant's rim pressure and 7-foot-4 Zach Edey.",
        "roster": [
            {"id": 2801, "name": "Ja Morant", "pos": "PG", "ppg": 25.8, "rpg": 5.6, "apg": 8.2, "spg": 1.2, "fg_pct": ".475", "fg3_pct": ".330"},
            {"id": 2802, "name": "Desmond Bane", "pos": "SG", "ppg": 23.2, "rpg": 4.5, "apg": 5.2, "spg": 1.1, "fg_pct": ".470", "fg3_pct": ".395"},
            {"id": 2803, "name": "Jaren Jackson Jr.", "pos": "PF", "ppg": 22.4, "rpg": 5.8, "apg": 2.2, "spg": 1.2, "fg_pct": ".460", "fg3_pct": ".345"},
            {"id": 2804, "name": "Zach Edey", "pos": "C", "ppg": 13.8, "rpg": 9.4, "apg": 1.2, "spg": 0.4, "fg_pct": ".615", "fg3_pct": ".000"}
        ]
    },
    {
        "id": 29, "name": "New Orleans Pelicans", "city": "New Orleans", "conference": "Western", "division": "Southwest",
        "founded": 2002, "championships": 0, "arena": "Smoothie King Center",
        "logo": "https://cdn.nba.com/logos/nba/1610612740/primary/L/logo.svg",
        "description": "Athletic, dynamic roster structured around Zion Williamson's unstoppable paint attacks.",
        "roster": [
            {"id": 2901, "name": "Zion Williamson", "pos": "PF", "ppg": 24.2, "rpg": 6.2, "apg": 5.2, "spg": 1.1, "fg_pct": ".585", "fg3_pct": ".300"},
            {"id": 2902, "name": "Brandon Ingram", "pos": "SF", "ppg": 21.5, "rpg": 5.3, "apg": 5.6, "spg": 0.8, "fg_pct": ".490", "fg3_pct": ".360"},
            {"id": 2903, "name": "Dejounte Murray", "pos": "PG", "ppg": 22.1, "rpg": 5.4, "apg": 6.5, "spg": 1.5, "fg_pct": ".465", "fg3_pct": ".368"},
            {"id": 2904, "name": "CJ McCollum", "pos": "SG", "ppg": 18.8, "rpg": 4.0, "apg": 4.5, "spg": 0.9, "fg_pct": ".455", "fg3_pct": ".410"}
        ]
    },
    {
        "id": 30, "name": "San Antonio Spurs", "city": "San Antonio", "conference": "Western", "division": "Southwest",
        "founded": 1967, "championships": 5, "arena": "Frost Bank Center",
        "logo": "https://cdn.nba.com/logos/nba/1610612759/primary/L/logo.svg",
        "description": "Generational squad built around Victor Wembanyama's unmatched defensive length and floor-spacing.",
        "roster": [
            {"id": 3001, "name": "Victor Wembanyama", "pos": "C", "ppg": 26.5, "rpg": 12.4, "apg": 4.8, "spg": 1.3, "fg_pct": ".495", "fg3_pct": ".360"},
            {"id": 3002, "name": "Devin Vassell", "pos": "SG", "ppg": 19.8, "rpg": 3.9, "apg": 4.2, "spg": 1.1, "fg_pct": ".475", "fg3_pct": ".385"},
            {"id": 3003, "name": "Chris Paul", "pos": "PG", "ppg": 10.8, "rpg": 3.8, "apg": 8.5, "spg": 1.3, "fg_pct": ".445", "fg3_pct": ".375"},
            {"id": 3004, "name": "Stephon Castle", "pos": "PG", "ppg": 13.5, "rpg": 4.2, "apg": 4.8, "spg": 1.2, "fg_pct": ".450", "fg3_pct": ".330"}
        ]
    }
]

# Root/Health check
@app.get("/")
@app.get("/api")
def home():
    return {
        "message": "NBA 2026-2027 Teams & Rosters API Live",
        "endpoints": ["/api/teams", "/api/teams/{id}", "/api/teams/search"]
    }

# Get All Teams
@app.get("/teams")
@app.get("/api/teams")
def get_teams():
    return {"count": len(teams), "teams": teams}

# Search
@app.get("/teams/search")
@app.get("/api/teams/search")
def search_teams(q: str = Query(..., min_length=1)):
    q = q.lower().strip()
    results = []
    for team in teams:
        team_text = f"{team['name']} {team['city']} {team['conference']} {team['division']} {team['arena']}".lower()
        player_matches = [p for p in team.get("roster", []) if q in p["name"].lower() or q in p["pos"].lower()]
        if q in team_text or player_matches:
            results.append(team)
    return {"query": q, "count": len(results), "results": results}

# Get One Team
@app.get("/teams/{team_id}")
@app.get("/api/teams/{team_id}")
def get_team(team_id: int):
    for team in teams:
        if team["id"] == team_id:
            return team
    raise HTTPException(status_code=404, detail="NBA team not found.")
