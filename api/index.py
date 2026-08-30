from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional

app = FastAPI(
    title="NBA Teams & Starters API",
    description="REST API for NBA teams, divisions, and 2026-27 starting lineups.",
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
    {
        "id": 1,
        "name": "Boston Celtics",
        "conference": "Eastern",
        "division": "Atlantic",
        "logo": "https://cdn.nba.com/logos/nba/1610612738/primary/L/logo.svg",
        "last_season_record": "56-26",
        "starters_2026_27": [
            {"pos": "PG", "name": "Derrick White", "pts": 15.2, "reb": 4.2, "ast": 5.1, "fg": 46.1, "fg3": 39.6, "ft": 90.1},
            {"pos": "SG", "name": "Baylor Scheierman", "pts": 5.5, "reb": 2.1, "ast": 1.2, "fg": 41.2, "fg3": 37.0, "ft": 84.0},
            {"pos": "SF", "name": "Paul George", "pts": 22.6, "reb": 5.2, "ast": 3.5, "fg": 47.1, "fg3": 41.3, "ft": 90.7},
            {"pos": "PF", "name": "Jayson Tatum", "pts": 26.9, "reb": 8.1, "ast": 4.9, "fg": 47.1, "fg3": 37.6, "ft": 83.3},
            {"pos": "C", "name": "Mitchell Robinson", "pts": 5.6, "reb": 8.5, "ast": 0.6, "fg": 67.5, "fg3": 0.0, "ft": 40.9}
        ]
    },
    {
        "id": 2,
        "name": "Brooklyn Nets",
        "conference": "Eastern",
        "division": "Atlantic",
        "logo": "https://cdn.nba.com/logos/nba/1610612751/primary/L/logo.svg",
        "last_season_record": "20-62",
        "starters_2026_27": [
            {"pos": "PG", "name": "Mikel Brown Jr.", "pts": 0.0, "reb": 0.0, "ast": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"pos": "SG", "name": "Egor Dëmin", "pts": 0.0, "reb": 0.0, "ast": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"pos": "SF", "name": "Michael Porter Jr.", "pts": 16.7, "reb": 7.0, "ast": 1.5, "fg": 48.4, "fg3": 39.7, "ft": 78.6},
            {"pos": "PF", "name": "Julius Randle", "pts": 24.0, "reb": 9.2, "ast": 5.0, "fg": 47.2, "fg3": 31.1, "ft": 76.5},
            {"pos": "C", "name": "Day'Ron Sharpe", "pts": 6.8, "reb": 6.4, "ast": 1.4, "fg": 57.1, "fg3": 0.0, "ft": 61.0}
        ]
    },
    {
        "id": 3,
        "name": "New York Knicks",
        "conference": "Eastern",
        "division": "Atlantic",
        "logo": "https://cdn.nba.com/logos/nba/1610612752/primary/L/logo.svg",
        "last_season_record": "53-29",
        "starters_2026_27": [
            {"pos": "PG", "name": "Jalen Brunson", "pts": 28.7, "reb": 3.6, "ast": 6.7, "fg": 47.9, "fg3": 40.1, "ft": 84.7},
            {"pos": "SG", "name": "Josh Hart", "pts": 9.4, "reb": 8.3, "ast": 4.1, "fg": 43.4, "fg3": 31.0, "ft": 79.1},
            {"pos": "SF", "name": "Mikal Bridges", "pts": 19.6, "reb": 4.5, "ast": 3.6, "fg": 43.6, "fg3": 37.2, "ft": 81.4},
            {"pos": "PF", "name": "OG Anunoby", "pts": 14.7, "reb": 4.2, "ast": 1.5, "fg": 48.9, "fg3": 38.2, "ft": 75.3},
            {"pos": "C", "name": "Karl-Anthony Towns", "pts": 21.8, "reb": 8.3, "ast": 3.0, "fg": 50.4, "fg3": 41.6, "ft": 87.3}
        ]
    },
    {
        "id": 4,
        "name": "Philadelphia 76ers",
        "conference": "Eastern",
        "division": "Atlantic",
        "logo": "https://cdn.nba.com/logos/nba/1610612755/primary/L/logo.svg",
        "last_season_record": "45-37",
        "starters_2026_27": [
            {"pos": "PG", "name": "Tyrese Maxey", "pts": 25.9, "reb": 3.7, "ast": 6.2, "fg": 45.0, "fg3": 37.3, "ft": 86.8},
            {"pos": "SG", "name": "VJ Edgecombe", "pts": 0.0, "reb": 0.0, "ast": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"pos": "SF", "name": "Jaylen Brown", "pts": 23.0, "reb": 5.5, "ast": 3.6, "fg": 49.9, "fg3": 35.4, "ft": 70.3},
            {"pos": "PF", "name": "LeBron James", "pts": 25.7, "reb": 7.3, "ast": 8.3, "fg": 54.0, "fg3": 41.0, "ft": 75.0},
            {"pos": "C", "name": "Joel Embiid", "pts": 34.7, "reb": 11.0, "ast": 5.6, "fg": 52.9, "fg3": 38.8, "ft": 88.3}
        ]
    },
    {
        "id": 5,
        "name": "Toronto Raptors",
        "conference": "Eastern",
        "division": "Atlantic",
        "logo": "https://cdn.nba.com/logos/nba/1610612761/primary/L/logo.svg",
        "last_season_record": "46-36",
        "starters_2026_27": [
            {"pos": "PG", "name": "Immanuel Quickley", "pts": 18.6, "reb": 4.8, "ast": 6.8, "fg": 43.4, "fg3": 39.5, "ft": 84.1},
            {"pos": "SG", "name": "RJ Barrett", "pts": 21.8, "reb": 6.4, "ast": 4.1, "fg": 49.5, "fg3": 39.2, "ft": 62.9},
            {"pos": "SF", "name": "Kawhi Leonard", "pts": 23.7, "reb": 6.1, "ast": 3.6, "fg": 52.5, "fg3": 41.7, "ft": 88.5},
            {"pos": "PF", "name": "Scottie Barnes", "pts": 19.9, "reb": 8.2, "ast": 6.1, "fg": 47.5, "fg3": 34.1, "ft": 78.1},
            {"pos": "C", "name": "Jakob Poeltl", "pts": 11.1, "reb": 8.6, "ast": 2.5, "fg": 65.6, "fg3": 0.0, "ft": 55.1}
        ]
    },
    {
        "id": 6,
        "name": "Chicago Bulls",
        "conference": "Eastern",
        "division": "Central",
        "logo": "https://cdn.nba.com/logos/nba/1610612741/primary/L/logo.svg",
        "last_season_record": "31-51",
        "starters_2026_27": [
            {"pos": "PG", "name": "Josh Giddey", "pts": 12.3, "reb": 6.4, "ast": 4.8, "fg": 47.5, "fg3": 33.7, "ft": 80.6},
            {"pos": "SG", "name": "Norman Powell", "pts": 13.9, "reb": 2.6, "ast": 1.1, "fg": 48.6, "fg3": 43.5, "ft": 83.1},
            {"pos": "SF", "name": "Matas Buzelis", "pts": 10.4, "reb": 4.5, "ast": 1.8, "fg": 43.0, "fg3": 34.0, "ft": 76.0},
            {"pos": "PF", "name": "Caleb Wilson", "pts": 0.0, "reb": 0.0, "ast": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"pos": "C", "name": "Nic Claxton", "pts": 11.8, "reb": 9.9, "ast": 2.1, "fg": 62.9, "fg3": 20.0, "ft": 55.1}
        ]
    },
    {
        "id": 7,
        "name": "Cleveland Cavaliers",
        "conference": "Eastern",
        "division": "Central",
        "logo": "https://cdn.nba.com/logos/nba/1610612739/primary/L/logo.svg",
        "last_season_record": "52-30",
        "starters_2026_27": [
            {"pos": "PG", "name": "James Harden", "pts": 16.6, "reb": 5.1, "ast": 8.5, "fg": 42.8, "fg3": 38.1, "ft": 87.8},
            {"pos": "SG", "name": "Donovan Mitchell", "pts": 26.6, "reb": 5.1, "ast": 6.1, "fg": 46.2, "fg3": 36.8, "ft": 86.5},
            {"pos": "SF", "name": "Peyton Watson", "pts": 6.7, "reb": 3.2, "ast": 1.1, "fg": 46.5, "fg3": 29.6, "ft": 67.0},
            {"pos": "PF", "name": "Evan Mobley", "pts": 15.7, "reb": 9.4, "ast": 3.2, "fg": 57.9, "fg3": 37.3, "ft": 71.9},
            {"pos": "C", "name": "Jarrett Allen", "pts": 16.5, "reb": 10.5, "ast": 2.7, "fg": 63.4, "fg3": 0.0, "ft": 74.2}
        ]
    },
    {
        "id": 8,
        "name": "Detroit Pistons",
        "conference": "Eastern",
        "division": "Central",
        "logo": "https://cdn.nba.com/logos/nba/1610612765/primary/L/logo.svg",
        "last_season_record": "60-22",
        "starters_2026_27": [
            {"pos": "PG", "name": "Cade Cunningham", "pts": 22.7, "reb": 4.3, "ast": 7.5, "fg": 44.9, "fg3": 35.5, "ft": 86.9},
            {"pos": "SG", "name": "Ausar Thompson", "pts": 8.8, "reb": 6.4, "ast": 1.9, "fg": 48.3, "fg3": 18.6, "ft": 59.7},
            {"pos": "SF", "name": "Duncan Robinson", "pts": 12.9, "reb": 2.5, "ast": 2.8, "fg": 45.0, "fg3": 39.5, "ft": 88.9},
            {"pos": "PF", "name": "John Collins", "pts": 15.1, "reb": 8.5, "ast": 1.1, "fg": 53.2, "fg3": 37.1, "ft": 79.5},
            {"pos": "C", "name": "Jalen Duren", "pts": 13.8, "reb": 11.6, "ast": 2.4, "fg": 61.9, "fg3": 0.0, "ft": 79.0}
        ]
    },
    {
        "id": 9,
        "name": "Indiana Pacers",
        "conference": "Eastern",
        "division": "Central",
        "logo": "https://cdn.nba.com/logos/nba/1610612754/primary/L/logo.svg",
        "last_season_record": "19-63",
        "starters_2026_27": [
            {"pos": "PG", "name": "Tyrese Haliburton", "pts": 20.1, "reb": 3.9, "ast": 10.9, "fg": 47.7, "fg3": 36.4, "ft": 85.5},
            {"pos": "SG", "name": "Andrew Nembhard", "pts": 9.2, "reb": 2.1, "ast": 4.1, "fg": 49.8, "fg3": 35.7, "ft": 80.4},
            {"pos": "SF", "name": "Aaron Nesmith", "pts": 12.2, "reb": 3.8, "ast": 1.5, "fg": 49.6, "fg3": 41.9, "ft": 78.1},
            {"pos": "PF", "name": "Pascal Siakam", "pts": 21.7, "reb": 7.1, "ast": 4.3, "fg": 53.6, "fg3": 38.6, "ft": 73.2},
            {"pos": "C", "name": "Ivica Zubac", "pts": 11.7, "reb": 9.2, "ast": 1.4, "fg": 64.9, "fg3": 0.0, "ft": 72.3}
        ]
    },
    {
        "id": 10,
        "name": "Milwaukee Bucks",
        "conference": "Eastern",
        "division": "Central",
        "logo": "https://cdn.nba.com/logos/nba/1610612749/primary/L/logo.svg",
        "last_season_record": "32-50",
        "starters_2026_27": [
            {"pos": "PG", "name": "Ryan Rollins", "pts": 6.2, "reb": 1.8, "ast": 2.1, "fg": 43.1, "fg3": 36.2, "ft": 78.0},
            {"pos": "SG", "name": "Tyler Herro", "pts": 20.8, "reb": 5.3, "ast": 4.5, "fg": 44.1, "fg3": 39.6, "ft": 85.6},
            {"pos": "SF", "name": "Jaime Jaquez Jr.", "pts": 11.9, "reb": 3.8, "ast": 2.6, "fg": 48.9, "fg3": 32.2, "ft": 81.1},
            {"pos": "PF", "name": "Kyle Kuzma", "pts": 22.2, "reb": 6.6, "ast": 4.2, "fg": 46.3, "fg3": 33.6, "ft": 77.5},
            {"pos": "C", "name": "Myles Turner", "pts": 17.1, "reb": 6.9, "ast": 1.3, "fg": 52.4, "fg3": 35.8, "ft": 77.3}
        ]
    },
    {
        "id": 11,
        "name": "Atlanta Hawks",
        "conference": "Eastern",
        "division": "Southeast",
        "logo": "https://cdn.nba.com/logos/nba/1610612737/primary/L/logo.svg",
        "last_season_record": "46-36",
        "starters_2026_27": [
            {"pos": "PG", "name": "C.J. McCollum", "pts": 20.0, "reb": 4.3, "ast": 4.6, "fg": 45.9, "fg3": 42.9, "ft": 82.7},
            {"pos": "SG", "name": "Nickeil Alexander-Walker", "pts": 8.0, "reb": 2.0, "ast": 2.5, "fg": 43.9, "fg3": 39.1, "ft": 80.0},
            {"pos": "SF", "name": "Dyson Daniels", "pts": 5.8, "reb": 3.9, "ast": 2.7, "fg": 44.7, "fg3": 31.1, "ft": 64.2},
            {"pos": "PF", "name": "Jalen Johnson", "pts": 16.0, "reb": 8.7, "ast": 3.6, "fg": 51.1, "fg3": 35.5, "ft": 72.8},
            {"pos": "C", "name": "Onyeka Okongwu", "pts": 10.2, "reb": 6.8, "ast": 1.3, "fg": 61.1, "fg3": 33.3, "ft": 79.3}
        ]
    },
    {
        "id": 12,
        "name": "Charlotte Hornets",
        "conference": "Eastern",
        "division": "Southeast",
        "logo": "https://cdn.nba.com/logos/nba/1610612766/primary/L/logo.svg",
        "last_season_record": "44-38",
        "starters_2026_27": [
            {"pos": "PG", "name": "Coby White", "pts": 19.1, "reb": 4.5, "ast": 5.1, "fg": 44.7, "fg3": 37.6, "ft": 83.8},
            {"pos": "SG", "name": "Kon Knueppel", "pts": 0.0, "reb": 0.0, "ast": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"pos": "SF", "name": "Brandon Miller", "pts": 17.3, "reb": 4.3, "ast": 2.4, "fg": 44.0, "fg3": 37.3, "ft": 82.0},
            {"pos": "PF", "name": "Naz Reid", "pts": 13.5, "reb": 5.2, "ast": 1.3, "fg": 47.7, "fg3": 41.4, "ft": 73.6},
            {"pos": "C", "name": "Moussa Diabaté", "pts": 4.5, "reb": 5.8, "ast": 0.6, "fg": 58.0, "fg3": 0.0, "ft": 62.0}
        ]
    },
    {
        "id": 13,
        "name": "Miami Heat",
        "conference": "Eastern",
        "division": "Southeast",
        "logo": "https://cdn.nba.com/logos/nba/1610612748/primary/L/logo.svg",
        "last_season_record": "43-39",
        "starters_2026_27": [
            {"pos": "PG", "name": "Davion Mitchell", "pts": 5.3, "reb": 1.3, "ast": 1.9, "fg": 45.2, "fg3": 36.1, "ft": 71.4},
            {"pos": "SG", "name": "Tim Hardaway Jr.", "pts": 14.4, "reb": 3.2, "ast": 1.8, "fg": 40.2, "fg3": 35.3, "ft": 85.2},
            {"pos": "SF", "name": "Andrew Wiggins", "pts": 13.2, "reb": 4.5, "ast": 1.7, "fg": 45.3, "fg3": 35.8, "ft": 75.1},
            {"pos": "PF", "name": "Giannis Antetokounmpo", "pts": 30.4, "reb": 11.5, "ast": 6.5, "fg": 61.1, "fg3": 27.4, "ft": 65.7},
            {"pos": "C", "name": "Bam Adebayo", "pts": 19.3, "reb": 10.4, "ast": 3.9, "fg": 52.1, "fg3": 35.7, "ft": 75.5}
        ]
    },
    {
        "id": 14,
        "name": "Orlando Magic",
        "conference": "Eastern",
        "division": "Southeast",
        "logo": "https://cdn.nba.com/logos/nba/1610612753/primary/L/logo.svg",
        "last_season_record": "45-37",
        "starters_2026_27": [
            {"pos": "PG", "name": "Jalen Suggs", "pts": 12.6, "reb": 3.1, "ast": 2.7, "fg": 47.1, "fg3": 39.7, "ft": 75.0},
            {"pos": "SG", "name": "Desmond Bane", "pts": 23.7, "reb": 4.4, "ast": 5.5, "fg": 46.4, "fg3": 38.1, "ft": 87.0},
            {"pos": "SF", "name": "Franz Wagner", "pts": 19.7, "reb": 5.3, "ast": 3.7, "fg": 48.2, "fg3": 28.1, "ft": 85.0},
            {"pos": "PF", "name": "Paolo Banchero", "pts": 22.6, "reb": 6.9, "ast": 5.4, "fg": 45.5, "fg3": 33.9, "ft": 72.5},
            {"pos": "C", "name": "Wendell Carter Jr.", "pts": 11.0, "reb": 6.9, "ast": 1.7, "fg": 52.5, "fg3": 37.4, "ft": 69.4}
        ]
    },
    {
        "id": 15,
        "name": "Washington Wizards",
        "conference": "Eastern",
        "division": "Southeast",
        "logo": "https://cdn.nba.com/logos/nba/1610612764/primary/L/logo.svg",
        "last_season_record": "17-65",
        "starters_2026_27": [
            {"pos": "PG", "name": "Trae Young", "pts": 25.7, "reb": 2.8, "ast": 10.8, "fg": 43.0, "fg3": 37.3, "ft": 85.5},
            {"pos": "SG", "name": "Kyshawn George", "pts": 8.5, "reb": 3.2, "ast": 2.1, "fg": 41.5, "fg3": 35.0, "ft": 77.0},
            {"pos": "SF", "name": "AJ Dybantsa", "pts": 0.0, "reb": 0.0, "ast": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"pos": "PF", "name": "Anthony Davis", "pts": 24.7, "reb": 12.6, "ast": 3.5, "fg": 55.6, "fg3": 27.1, "ft": 81.6},
            {"pos": "C", "name": "Alex Sarr", "pts": 11.5, "reb": 6.8, "ast": 1.9, "fg": 42.5, "fg3": 31.0, "ft": 71.0}
        ]
    },
    {
        "id": 16,
        "name": "Denver Nuggets",
        "conference": "Western",
        "division": "Northwest",
        "logo": "https://cdn.nba.com/logos/nba/1610612743/primary/L/logo.svg",
        "last_season_record": "54-28",
        "starters_2026_27": [
            {"pos": "PG", "name": "Jamal Murray", "pts": 21.2, "reb": 4.1, "ast": 6.5, "fg": 48.1, "fg3": 42.5, "ft": 85.3},
            {"pos": "SG", "name": "Christian Braun", "pts": 7.3, "reb": 3.7, "ast": 1.6, "fg": 46.0, "fg3": 38.4, "ft": 69.4},
            {"pos": "SF", "name": "Cameron Johnson", "pts": 13.4, "reb": 4.4, "ast": 2.4, "fg": 44.6, "fg3": 39.1, "ft": 78.9},
            {"pos": "PF", "name": "Aaron Gordon", "pts": 13.9, "reb": 6.5, "ast": 3.5, "fg": 55.6, "fg3": 29.0, "ft": 65.8},
            {"pos": "C", "name": "Nikola Jokić", "pts": 26.4, "reb": 12.4, "ast": 9.0, "fg": 58.3, "fg3": 35.9, "ft": 81.7}
        ]
    },
    {
        "id": 17,
        "name": "Minnesota Timberwolves",
        "conference": "Western",
        "division": "Northwest",
        "logo": "https://cdn.nba.com/logos/nba/1610612750/primary/L/logo.svg",
        "last_season_record": "49-33",
        "starters_2026_27": [
            {"pos": "PG", "name": "LaMelo Ball", "pts": 23.9, "reb": 5.1, "ast": 8.0, "fg": 43.3, "fg3": 35.5, "ft": 86.5},
            {"pos": "SG", "name": "Anthony Edwards", "pts": 25.9, "reb": 5.4, "ast": 5.1, "fg": 46.1, "fg3": 35.7, "ft": 83.6},
            {"pos": "SF", "name": "Jaden McDaniels", "pts": 10.5, "reb": 3.1, "ast": 1.4, "fg": 48.9, "fg3": 33.7, "ft": 72.2},
            {"pos": "PF", "name": "Jonathan Kuminga", "pts": 16.1, "reb": 4.8, "ast": 2.2, "fg": 52.9, "fg3": 32.1, "ft": 74.6},
            {"pos": "C", "name": "Rudy Gobert", "pts": 14.0, "reb": 12.9, "ast": 1.3, "fg": 66.1, "fg3": 0.0, "ft": 63.8}
        ]
    },
    {
        "id": 18,
        "name": "Oklahoma City Thunder",
        "conference": "Western",
        "division": "Northwest",
        "logo": "https://cdn.nba.com/logos/nba/1610612760/primary/L/logo.svg",
        "last_season_record": "64-18",
        "starters_2026_27": [
            {"pos": "PG", "name": "Shai Gilgeous-Alexander", "pts": 30.1, "reb": 5.5, "ast": 6.2, "fg": 53.5, "fg3": 35.3, "ft": 87.4},
            {"pos": "SG", "name": "Cason Wallace", "pts": 6.8, "reb": 2.3, "ast": 1.5, "fg": 49.1, "fg3": 41.9, "ft": 78.4},
            {"pos": "SF", "name": "Jalen Williams", "pts": 19.1, "reb": 4.0, "ast": 4.5, "fg": 54.0, "fg3": 42.7, "ft": 81.4},
            {"pos": "PF", "name": "Chet Holmgren", "pts": 16.5, "reb": 7.9, "ast": 2.4, "fg": 53.0, "fg3": 37.0, "ft": 79.3},
            {"pos": "C", "name": "Isaiah Hartenstein", "pts": 7.8, "reb": 8.3, "ast": 2.5, "fg": 64.4, "fg3": 33.3, "ft": 70.7}
        ]
    },
    {
        "id": 19,
        "name": "Portland Trail Blazers",
        "conference": "Western",
        "division": "Northwest",
        "logo": "https://cdn.nba.com/logos/nba/1610612757/primary/L/logo.svg",
        "last_season_record": "42-40",
        "starters_2026_27": [
            {"pos": "PG", "name": "Ja Morant", "pts": 25.1, "reb": 5.6, "ast": 8.1, "fg": 47.1, "fg3": 27.5, "ft": 81.3},
            {"pos": "SG", "name": "Damian Lillard", "pts": 24.3, "reb": 4.4, "ast": 7.0, "fg": 42.4, "fg3": 35.4, "ft": 92.0},
            {"pos": "SF", "name": "Toumani Camara", "pts": 7.5, "reb": 4.9, "ast": 1.2, "fg": 45.0, "fg3": 33.7, "ft": 75.8},
            {"pos": "PF", "name": "Deni Avdija", "pts": 14.7, "reb": 7.2, "ast": 3.8, "fg": 50.6, "fg3": 37.4, "ft": 74.0},
            {"pos": "C", "name": "Donovan Clingan", "pts": 8.5, "reb": 7.8, "ast": 1.2, "fg": 59.0, "fg3": 25.0, "ft": 58.0}
        ]
    },
    {
        "id": 20,
        "name": "Utah Jazz",
        "conference": "Western",
        "division": "Northwest",
        "logo": "https://cdn.nba.com/logos/nba/1610612762/primary/L/logo.svg",
        "last_season_record": "22-60",
        "starters_2026_27": [
            {"pos": "PG", "name": "Keyonte George", "pts": 13.0, "reb": 2.8, "ast": 4.4, "fg": 39.1, "fg3": 33.4, "ft": 77.7},
            {"pos": "SG", "name": "Darryn Peterson", "pts": 0.0, "reb": 0.0, "ast": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"pos": "SF", "name": "Lauri Markkanen", "pts": 23.2, "reb": 8.2, "ast": 2.0, "fg": 48.0, "fg3": 39.9, "ft": 89.9},
            {"pos": "PF", "name": "Jaren Jackson Jr.", "pts": 22.5, "reb": 5.5, "ast": 2.3, "fg": 44.4, "fg3": 32.0, "ft": 80.8},
            {"pos": "C", "name": "Jusuf Nurkić", "pts": 10.9, "reb": 11.0, "ast": 4.0, "fg": 51.0, "fg3": 24.4, "ft": 64.0}
        ]
    },
    {
        "id": 21,
        "name": "Golden State Warriors",
        "conference": "Western",
        "division": "Pacific",
        "logo": "https://cdn.nba.com/logos/nba/1610612744/primary/L/logo.svg",
        "last_season_record": "37-45",
        "starters_2026_27": [
            {"pos": "PG", "name": "Stephen Curry", "pts": 26.4, "reb": 4.5, "ast": 5.1, "fg": 45.0, "fg3": 40.8, "ft": 92.3},
            {"pos": "SG", "name": "Brandin Podziemski", "pts": 9.2, "reb": 5.8, "ast": 3.7, "fg": 45.4, "fg3": 38.5, "ft": 63.3},
            {"pos": "SF", "name": "Jimmy Butler", "pts": 20.8, "reb": 5.3, "ast": 5.0, "fg": 49.9, "fg3": 41.4, "ft": 85.8},
            {"pos": "PF", "name": "Draymond Green", "pts": 8.6, "reb": 7.2, "ast": 6.0, "fg": 49.7, "fg3": 39.5, "ft": 73.0},
            {"pos": "C", "name": "Kristaps Porziņģis", "pts": 20.1, "reb": 7.2, "ast": 2.0, "fg": 51.6, "fg3": 37.5, "ft": 85.8}
        ]
    },
    {
        "id": 22,
        "name": "LA Clippers",
        "conference": "Western",
        "division": "Pacific",
        "logo": "https://cdn.nba.com/logos/nba/1610612746/primary/L/logo.svg",
        "last_season_record": "42-40",
        "starters_2026_27": [
            {"pos": "PG", "name": "Darius Garland", "pts": 18.0, "reb": 2.7, "ast": 6.5, "fg": 44.6, "fg3": 37.1, "ft": 83.4},
            {"pos": "SG", "name": "Kris Dunn", "pts": 5.4, "reb": 2.9, "ast": 3.8, "fg": 47.0, "fg3": 36.9, "ft": 68.8},
            {"pos": "SF", "name": "Brandon Ingram", "pts": 20.8, "reb": 5.1, "ast": 5.7, "fg": 49.2, "fg3": 35.5, "ft": 80.1},
            {"pos": "PF", "name": "Rui Hachimura", "pts": 13.6, "reb": 4.3, "ast": 1.2, "fg": 53.7, "fg3": 42.2, "ft": 73.9},
            {"pos": "C", "name": "Brook Lopez", "pts": 12.5, "reb": 5.2, "ast": 1.6, "fg": 48.5, "fg3": 36.6, "ft": 82.1}
        ]
    },
    {
        "id": 23,
        "name": "Los Angeles Lakers",
        "conference": "Western",
        "division": "Pacific",
        "logo": "https://cdn.nba.com/logos/nba/1610612747/primary/L/logo.svg",
        "last_season_record": "53-29",
        "starters_2026_27": [
            {"pos": "PG", "name": "Luka Dončić", "pts": 33.9, "reb": 9.2, "ast": 9.8, "fg": 48.7, "fg3": 38.2, "ft": 77.6},
            {"pos": "SG", "name": "Austin Reaves", "pts": 15.9, "reb": 4.3, "ast": 5.5, "fg": 48.6, "fg3": 36.7, "ft": 85.3},
            {"pos": "SF", "name": "Quentin Grimes", "pts": 7.0, "reb": 2.0, "ast": 1.3, "fg": 37.2, "fg3": 33.8, "ft": 77.6},
            {"pos": "PF", "name": "Sandro Mamukelashvili", "pts": 4.1, "reb": 3.2, "ast": 1.1, "fg": 47.1, "fg3": 29.7, "ft": 73.5},
            {"pos": "C", "name": "Walker Kessler", "pts": 8.1, "reb": 7.5, "ast": 0.9, "fg": 65.4, "fg3": 21.1, "ft": 60.2}
        ]
    },
    {
        "id": 24,
        "name": "Phoenix Suns",
        "conference": "Western",
        "division": "Pacific",
        "logo": "https://cdn.nba.com/logos/nba/1610612756/primary/L/logo.svg",
        "last_season_record": "45-37",
        "starters_2026_27": [
            {"pos": "PG", "name": "Devin Booker", "pts": 27.1, "reb": 4.5, "ast": 6.9, "fg": 49.2, "fg3": 36.4, "ft": 88.6},
            {"pos": "SG", "name": "Jalen Green", "pts": 19.6, "reb": 5.2, "ast": 3.5, "fg": 42.3, "fg3": 33.2, "ft": 80.4},
            {"pos": "SF", "name": "Dillon Brooks", "pts": 12.7, "reb": 3.4, "ast": 1.7, "fg": 42.8, "fg3": 35.9, "ft": 84.4},
            {"pos": "PF", "name": "Miles Bridges", "pts": 21.0, "reb": 7.3, "ast": 3.3, "fg": 46.2, "fg3": 34.9, "ft": 82.5},
            {"pos": "C", "name": "Mark Williams", "pts": 12.7, "reb": 9.7, "ast": 1.2, "fg": 64.9, "fg3": 0.0, "ft": 71.9}
        ]
    },
    {
        "id": 25,
        "name": "Sacramento Kings",
        "conference": "Western",
        "division": "Pacific",
        "logo": "https://cdn.nba.com/logos/nba/1610612758/primary/L/logo.svg",
        "last_season_record": "22-60",
        "starters_2026_27": [
            {"pos": "PG", "name": "Darius Acuff Jr.", "pts": 0.0, "reb": 0.0, "ast": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"pos": "SG", "name": "Zach LaVine", "pts": 19.5, "reb": 5.2, "ast": 3.9, "fg": 45.2, "fg3": 34.9, "ft": 85.4},
            {"pos": "SF", "name": "De'Andre Hunter", "pts": 15.6, "reb": 3.9, "ast": 1.5, "fg": 45.9, "fg3": 38.5, "ft": 84.7},
            {"pos": "PF", "name": "Keegan Murray", "pts": 15.2, "reb": 5.5, "ast": 1.7, "fg": 45.4, "fg3": 35.8, "ft": 83.1},
            {"pos": "C", "name": "Domantas Sabonis", "pts": 19.4, "reb": 13.7, "ast": 8.2, "fg": 59.4, "fg3": 37.9, "ft": 70.4}
        ]
    },
    {
        "id": 26,
        "name": "Dallas Mavericks",
        "conference": "Western",
        "division": "Southwest",
        "logo": "https://cdn.nba.com/logos/nba/1610612742/primary/L/logo.svg",
        "last_season_record": "26-56",
        "starters_2026_27": [
            {"pos": "PG", "name": "Kyrie Irving", "pts": 25.6, "reb": 5.0, "ast": 5.2, "fg": 49.7, "fg3": 41.1, "ft": 90.5},
            {"pos": "SG", "name": "Max Christie", "pts": 4.2, "reb": 2.1, "ast": 0.9, "fg": 42.7, "fg3": 35.6, "ft": 78.3},
            {"pos": "SF", "name": "Zaccharie Risacher", "pts": 11.2, "reb": 3.9, "ast": 1.5, "fg": 42.5, "fg3": 33.8, "ft": 72.0},
            {"pos": "PF", "name": "Cooper Flagg", "pts": 0.0, "reb": 0.0, "ast": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"pos": "C", "name": "Dereck Lively II", "pts": 8.8, "reb": 6.9, "ast": 1.1, "fg": 74.7, "fg3": 0.0, "ft": 50.6}
        ]
    },
    {
        "id": 27,
        "name": "Houston Rockets",
        "conference": "Western",
        "division": "Southwest",
        "logo": "https://cdn.nba.com/logos/nba/1610612745/primary/L/logo.svg",
        "last_season_record": "52-30",
        "starters_2026_27": [
            {"pos": "PG", "name": "Fred VanVleet", "pts": 17.4, "reb": 3.8, "ast": 8.1, "fg": 41.6, "fg3": 38.7, "ft": 86.0},
            {"pos": "SG", "name": "Amen Thompson", "pts": 9.5, "reb": 6.6, "ast": 2.6, "fg": 53.6, "fg3": 13.8, "ft": 68.4},
            {"pos": "SF", "name": "Kevin Durant", "pts": 27.1, "reb": 6.6, "ast": 5.0, "fg": 52.3, "fg3": 41.3, "ft": 85.6},
            {"pos": "PF", "name": "Jabari Smith Jr.", "pts": 13.7, "reb": 8.1, "ast": 1.6, "fg": 45.4, "fg3": 36.3, "ft": 82.2},
            {"pos": "C", "name": "Alperen Şengün", "pts": 21.1, "reb": 9.3, "ast": 5.0, "fg": 53.7, "fg3": 29.7, "ft": 69.3}
        ]
    },
    {
        "id": 28,
        "name": "Memphis Grizzlies",
        "conference": "Western",
        "division": "Southwest",
        "logo": "https://cdn.nba.com/logos/nba/1610612763/primary/L/logo.svg",
        "last_season_record": "25-57",
        "starters_2026_27": [
            {"pos": "PG", "name": "Ty Jerome", "pts": 7.5, "reb": 1.8, "ast": 3.0, "fg": 47.3, "fg3": 38.5, "ft": 88.0},
            {"pos": "SG", "name": "Jaylen Wells", "pts": 8.5, "reb": 3.1, "ast": 1.5, "fg": 43.5, "fg3": 37.0, "ft": 81.0},
            {"pos": "SF", "name": "Cedric Coward", "pts": 0.0, "reb": 0.0, "ast": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"pos": "PF", "name": "Cameron Boozer", "pts": 0.0, "reb": 0.0, "ast": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"pos": "C", "name": "Zach Edey", "pts": 13.5, "reb": 8.9, "ast": 1.1, "fg": 62.0, "fg3": 0.0, "ft": 71.0}
        ]
    },
    {
        "id": 29,
        "name": "New Orleans Pelicans",
        "conference": "Western",
        "division": "Southwest",
        "logo": "https://cdn.nba.com/logos/nba/1610612740/primary/L/logo.svg",
        "last_season_record": "26-56",
        "starters_2026_27": [
            {"pos": "PG", "name": "Dejounte Murray", "pts": 22.5, "reb": 5.3, "ast": 6.4, "fg": 45.9, "fg3": 36.3, "ft": 79.4},
            {"pos": "SG", "name": "Trey Murphy III", "pts": 14.8, "reb": 4.9, "ast": 2.2, "fg": 44.3, "fg3": 38.0, "ft": 81.5},
            {"pos": "SF", "name": "Herb Jones", "pts": 11.0, "reb": 3.6, "ast": 2.6, "fg": 49.8, "fg3": 41.8, "ft": 86.7},
            {"pos": "PF", "name": "Zion Williamson", "pts": 22.9, "reb": 5.8, "ast": 5.0, "fg": 57.0, "fg3": 33.3, "ft": 70.2},
            {"pos": "C", "name": "Derik Queen", "pts": 0.0, "reb": 0.0, "ast": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0}
        ]
    },
    {
        "id": 30,
        "name": "San Antonio Spurs",
        "conference": "Western",
        "division": "Southwest",
        "logo": "https://cdn.nba.com/logos/nba/1610612759/primary/L/logo.svg",
        "last_season_record": "62-20",
        "starters_2026_27": [
            {"pos": "PG", "name": "De'Aaron Fox", "pts": 26.6, "reb": 4.6, "ast": 5.6, "fg": 46.5, "fg3": 36.9, "ft": 73.8},
            {"pos": "SG", "name": "Stephon Castle", "pts": 12.8, "reb": 3.6, "ast": 3.9, "fg": 44.0, "fg3": 32.5, "ft": 76.0},
            {"pos": "SF", "name": "Devin Vassell", "pts": 19.5, "reb": 3.8, "ast": 4.1, "fg": 47.2, "fg3": 37.2, "ft": 80.1},
            {"pos": "PF", "name": "Tobias Harris", "pts": 17.2, "reb": 6.5, "ast": 3.1, "fg": 48.7, "fg3": 35.3, "ft": 87.8},
            {"pos": "C", "name": "Victor Wembanyama", "pts": 21.4, "reb": 10.6, "ast": 3.9, "fg": 46.5, "fg3": 32.5, "ft": 79.6}
        ]
    }
]

@app.get("/")
def home():
    return {
        "message": "Welcome to the NBA Teams & Starters REST API!",
        "endpoints": [
            "/teams",
            "/teams/{team_id}",
            "/teams/search?q={query}"
        ]
    }

@app.get("/teams")
def get_teams(conference: Optional[str] = None, division: Optional[str] = None):
    results = teams
    if conference:
        results = [t for t in results if t["conference"].lower() == conference.lower()]
    if division:
        results = [t for t in results if t["division"].lower() == division.lower()]
    return {
        "count": len(results),
        "teams": results
    }

@app.get("/teams/{team_id}")
def get_team(team_id: int):
    for team in teams:
        if team["id"] == team_id:
            return team
    raise HTTPException(status_code=404, detail="Team not found.")

@app.get("/teams/search")
def search_teams(q: str = Query(..., min_length=1)):
    q = q.lower().strip()
    results = []
    for team in teams:
        starters_str = " ".join([p["name"] for p in team["starters_2026_27"]]).lower()
        searchable_text = f"{team['name']} {team['conference']} {team['division']} {starters_str}".lower()
        if q in searchable_text:
            results.append(team)
    return {
        "query": q,
        "count": len(results),
        "results": results
    }
