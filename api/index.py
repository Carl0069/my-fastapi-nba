from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional

app = FastAPI(
    title="NBA Teams & Starters API",
    description="REST API containing NBA team profiles, salaries, luxury tax status, championship history, and 2026-27 starting lineups.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2026-27 Cap: $164.96M | Luxury Tax: $200.43M | 1st Apron: $209.02M | 2nd Apron: $221.69M
teams = [
    # ==================== EASTERN CONFERENCE ====================
    # --- Atlantic Division ---
    {
        "id": 1,
        "name": "Boston Celtics",
        "conference": "Eastern",
        "division": "Atlantic",
        "featured_star": "Jayson Tatum",
        "headline_stat": "26.8 PPG | 8.4 RPG",
        "total_salary": 201437932,
        "tax_status": "Luxury Tax",
        "championships": 18,
        "championship_years": [1957, 1959, 1960, 1961, 1962, 1963, 1964, 1965, 1966, 1968, 1969, 1974, 1976, 1981, 1984, 1986, 2008, 2024],
        "last_season_record": "56-26",
        "description": "The defending Eastern powerhouse built around two-way wing dominance and perimeter shooting depth.",
        "logo": "https://cdn.nba.com/logos/nba/1610612738/primary/L/logo.svg",
        "starters_2026_27": [
            {"pos": "PG", "name": "Derrick White", "pts": 15.2, "reb": 4.2, "ast": 5.1, "stl": 1.0, "blk": 1.3, "tov": 1.5, "fg": 46.1, "fg3": 39.6, "ft": 90.1},
            {"pos": "SG", "name": "Baylor Scheierman", "pts": 6.8, "reb": 2.7, "ast": 1.6, "stl": 0.5, "blk": 0.2, "tov": 0.8, "fg": 42.4, "fg3": 38.2, "ft": 85.0},
            {"pos": "SF", "name": "Paul George", "pts": 18.2, "reb": 5.4, "ast": 4.5, "stl": 1.4, "blk": 0.5, "tov": 2.3, "fg": 44.5, "fg3": 38.8, "ft": 88.5},
            {"pos": "PF", "name": "Jayson Tatum", "pts": 26.8, "reb": 8.4, "ast": 5.4, "stl": 1.1, "blk": 0.6, "tov": 2.5, "fg": 46.5, "fg3": 36.5, "ft": 82.5},
            {"pos": "C", "name": "Mitchell Robinson", "pts": 6.2, "reb": 8.8, "ast": 0.7, "stl": 1.1, "blk": 1.2, "tov": 0.9, "fg": 66.5, "fg3": 0.0, "ft": 42.5}
        ]
    },
    {
        "id": 2,
        "name": "Brooklyn Nets",
        "conference": "Eastern",
        "division": "Atlantic",
        "featured_star": "Julius Randle",
        "headline_stat": "23.8 PPG | 9.1 RPG",
        "total_salary": 160105139,
        "tax_status": "Under Cap",
        "championships": 0,
        "championship_years": [],
        "last_season_record": "20-62",
        "description": "A rebuilding squad anchored by frontcourt scoring and rising young international talent.",
        "logo": "https://cdn.nba.com/logos/nba/1610612751/primary/L/logo.svg",
        "starters_2026_27": [
            {"pos": "PG", "name": "Mikel Brown Jr.", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"pos": "SG", "name": "Egor Dëmin", "pts": 11.4, "reb": 3.6, "ast": 4.1, "stl": 0.9, "blk": 0.4, "tov": 1.8, "fg": 44.2, "fg3": 36.4, "ft": 79.5},
            {"pos": "SF", "name": "Michael Porter Jr.", "pts": 17.5, "reb": 7.1, "ast": 1.6, "stl": 0.6, "blk": 0.7, "tov": 1.3, "fg": 48.8, "fg3": 39.8, "ft": 79.2},
            {"pos": "PF", "name": "Julius Randle", "pts": 23.8, "reb": 9.1, "ast": 4.8, "stl": 0.6, "blk": 0.3, "tov": 3.1, "fg": 47.0, "fg3": 31.5, "ft": 76.8},
            {"pos": "C", "name": "Day'Ron Sharpe", "pts": 7.2, "reb": 6.8, "ast": 1.5, "stl": 0.7, "blk": 0.9, "tov": 1.1, "fg": 58.2, "fg3": 0.0, "ft": 62.5}
        ]
    },
    {
        "id": 3,
        "name": "New York Knicks",
        "conference": "Eastern",
        "division": "Atlantic",
        "featured_star": "Jalen Brunson",
        "headline_stat": "26.5 PPG | 7.3 APG",
        "total_salary": 217948756,
        "tax_status": "1st Apron",
        "championships": 3,
        "championship_years": [1970, 1973, 2026],
        "last_season_record": "53-29",
        "description": "The reigning 2026 NBA Champions featuring MVP orchestrator Jalen Brunson and elite perimeter lockdown defense.",
        "logo": "https://cdn.nba.com/logos/nba/1610612752/primary/L/logo.svg",
        "starters_2026_27": [
            {"pos": "PG", "name": "Jalen Brunson", "pts": 26.5, "reb": 3.2, "ast": 7.3, "stl": 0.9, "blk": 0.2, "tov": 2.4, "fg": 48.0, "fg3": 38.5, "ft": 84.0},
            {"pos": "SG", "name": "Josh Hart", "pts": 10.1, "reb": 8.6, "ast": 4.5, "stl": 1.1, "blk": 0.3, "tov": 1.6, "fg": 44.2, "fg3": 31.8, "ft": 79.5},
            {"pos": "SF", "name": "Mikal Bridges", "pts": 18.2, "reb": 4.1, "ast": 3.4, "stl": 1.2, "blk": 0.8, "tov": 1.5, "fg": 44.5, "fg3": 37.8, "ft": 82.0},
            {"pos": "PF", "name": "OG Anunoby", "pts": 15.4, "reb": 4.4, "ast": 1.8, "stl": 1.7, "blk": 0.9, "tov": 1.2, "fg": 49.2, "fg3": 38.6, "ft": 76.0},
            {"pos": "C", "name": "Karl-Anthony Towns", "pts": 24.2, "reb": 11.5, "ast": 3.1, "stl": 0.7, "blk": 0.9, "tov": 2.6, "fg": 51.2, "fg3": 42.0, "ft": 88.0}
        ]
    },
    {
        "id": 4,
        "name": "Philadelphia 76ers",
        "conference": "Eastern",
        "division": "Atlantic",
        "featured_star": "Tyrese Maxey",
        "headline_stat": "26.3 PPG | 6.1 APG",
        "total_salary": 206643098,
        "tax_status": "Luxury Tax",
        "championships": 3,
        "championship_years": [1955, 1967, 1983],
        "last_season_record": "45-37",
        "description": "A star-studded veteran roster pairing blistering guard speed with dominant low-post presence.",
        "logo": "https://cdn.nba.com/logos/nba/1610612755/primary/L/logo.svg",
        "starters_2026_27": [
            {"pos": "PG", "name": "Tyrese Maxey", "pts": 26.3, "reb": 3.6, "ast": 6.1, "stl": 1.1, "blk": 0.8, "tov": 2.2, "fg": 45.4, "fg3": 37.5, "ft": 87.2},
            {"pos": "SG", "name": "VJ Edgecombe", "pts": 15.2, "reb": 4.8, "ast": 3.4, "stl": 1.3, "blk": 0.6, "tov": 2.0, "fg": 45.6, "fg3": 36.8, "ft": 80.2},
            {"pos": "SF", "name": "Jaylen Brown", "pts": 22.5, "reb": 5.6, "ast": 3.7, "stl": 1.2, "blk": 0.6, "tov": 2.4, "fg": 50.1, "fg3": 35.8, "ft": 71.0},
            {"pos": "PF", "name": "LeBron James", "pts": 24.4, "reb": 7.8, "ast": 8.2, "stl": 1.2, "blk": 0.6, "tov": 3.2, "fg": 51.3, "fg3": 37.6, "ft": 78.2},
            {"pos": "C", "name": "Joel Embiid", "pts": 24.9, "reb": 8.5, "ast": 4.5, "stl": 0.9, "blk": 1.6, "tov": 3.0, "fg": 45.4, "fg3": 33.3, "ft": 86.5}
        ]
    },
    {
        "id": 5,
        "name": "Toronto Raptors",
        "conference": "Eastern",
        "division": "Atlantic",
        "featured_star": "Scottie Barnes",
        "headline_stat": "20.2 PPG | 8.4 RPG",
        "total_salary": 202743041,
        "tax_status": "Luxury Tax",
        "championships": 1,
        "championship_years": [2019],
        "last_season_record": "46-36",
        "description": "A versatile, length-heavy team playing fast-paced positional basketball.",
        "logo": "https://cdn.nba.com/logos/nba/1610612761/primary/L/logo.svg",
        "starters_2026_27": [
            {"pos": "PG", "name": "Immanuel Quickley", "pts": 17.8, "reb": 4.6, "ast": 6.4, "stl": 1.0, "blk": 0.2, "tov": 1.8, "fg": 43.8, "fg3": 39.8, "ft": 84.5},
            {"pos": "SG", "name": "RJ Barrett", "pts": 21.4, "reb": 6.2, "ast": 4.0, "stl": 0.7, "blk": 0.4, "tov": 2.2, "fg": 49.8, "fg3": 39.0, "ft": 63.5},
            {"pos": "SF", "name": "Kawhi Leonard", "pts": 22.8, "reb": 6.0, "ast": 3.4, "stl": 1.6, "blk": 0.8, "tov": 1.7, "fg": 52.0, "fg3": 41.2, "ft": 88.0},
            {"pos": "PF", "name": "Scottie Barnes", "pts": 20.2, "reb": 8.4, "ast": 5.9, "stl": 1.3, "blk": 1.5, "tov": 2.8, "fg": 47.8, "fg3": 34.5, "ft": 78.5},
            {"pos": "C", "name": "Jakob Poeltl", "pts": 11.5, "reb": 8.8, "ast": 2.6, "stl": 0.7, "blk": 1.5, "tov": 1.4, "fg": 65.8, "fg3": 0.0, "ft": 56.0}
        ]
    },

    # --- Central Division ---
    {
        "id": 6,
        "name": "Chicago Bulls",
        "conference": "Eastern",
        "division": "Central",
        "featured_star": "Josh Giddey",
        "headline_stat": "13.8 PPG | 7.2 RPG",
        "total_salary": 161545080,
        "tax_status": "Under Cap",
        "championships": 6,
        "championship_years": [1991, 1992, 1993, 1996, 1997, 1998],
        "last_season_record": "31-51",
        "description": "A transition-focused unit looking to empower young perimeter playmakers and athletic rim runners.",
        "logo": "https://cdn.nba.com/logos/nba/1610612741/primary/L/logo.svg",
        "starters_2026_27": [
            {"pos": "PG", "name": "Josh Giddey", "pts": 13.8, "reb": 7.2, "ast": 5.8, "stl": 0.9, "blk": 0.6, "tov": 2.6, "fg": 48.0, "fg3": 34.5, "ft": 81.2},
            {"pos": "SG", "name": "Norman Powell", "pts": 14.2, "reb": 2.8, "ast": 1.3, "stl": 0.8, "blk": 0.3, "tov": 1.4, "fg": 48.8, "fg3": 43.8, "ft": 83.5},
            {"pos": "SF", "name": "Matas Buzelis", "pts": 12.4, "reb": 4.6, "ast": 1.5, "stl": 0.8, "blk": 1.5, "tov": 1.3, "fg": 46.0, "fg3": 35.3, "ft": 79.5},
            {"pos": "PF", "name": "Caleb Wilson", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"pos": "C", "name": "Nic Claxton", "pts": 11.5, "reb": 9.6, "ast": 2.0, "stl": 0.6, "blk": 1.1, "tov": 1.3, "fg": 63.2, "fg3": 20.0, "ft": 56.0}
        ]
    },
    {
        "id": 7,
        "name": "Cleveland Cavaliers",
        "conference": "Eastern",
        "division": "Central",
        "featured_star": "Donovan Mitchell",
        "headline_stat": "26.2 PPG | 5.8 APG",
        "total_salary": 222920753,
        "tax_status": "2nd Apron",
        "championships": 1,
        "championship_years": [2016],
        "last_season_record": "52-30",
        "description": "A well-balanced contender pairing an explosive backcourt with an elite defensive twin-towers frontcourt.",
        "logo": "https://cdn.nba.com/logos/nba/1610612739/primary/L/logo.svg",
        "starters_2026_27": [
            {"pos": "PG", "name": "James Harden", "pts": 16.8, "reb": 5.2, "ast": 8.4, "stl": 1.2, "blk": 0.6, "tov": 2.9, "fg": 43.0, "fg3": 38.5, "ft": 88.0},
            {"pos": "SG", "name": "Donovan Mitchell", "pts": 26.2, "reb": 5.0, "ast": 5.8, "stl": 1.5, "blk": 0.4, "tov": 2.8, "fg": 46.5, "fg3": 37.0, "ft": 86.8},
            {"pos": "SF", "name": "Peyton Watson", "pts": 7.8, "reb": 3.6, "ast": 1.4, "stl": 0.7, "blk": 1.1, "tov": 0.9, "fg": 47.5, "fg3": 31.5, "ft": 68.0},
            {"pos": "PF", "name": "Evan Mobley", "pts": 17.2, "reb": 9.6, "ast": 3.4, "stl": 0.9, "blk": 1.8, "tov": 1.8, "fg": 58.2, "fg3": 37.8, "ft": 72.5},
            {"pos": "C", "name": "Jarrett Allen", "pts": 16.2, "reb": 10.4, "ast": 2.5, "stl": 0.7, "blk": 1.7, "tov": 1.5, "fg": 63.8, "fg3": 0.0, "ft": 74.5}
        ]
    },
    {
        "id": 8,
        "name": "Detroit Pistons",
        "conference": "Eastern",
        "division": "Central",
        "featured_star": "Cade Cunningham",
        "headline_stat": "23.4 PPG | 7.8 APG",
        "total_salary": 153163826,
        "tax_status": "Under Cap",
        "championships": 3,
        "championship_years": [1989, 1990, 2004],
        "last_season_record": "60-22",
        "description": "An ascending powerhouse coming off a 60-win campaign fueled by dynamic young playmakers.",
        "logo": "https://cdn.nba.com/logos/nba/1610612765/primary/L/logo.svg",
        "starters_2026_27": [
            {"pos": "PG", "name": "Cade Cunningham", "pts": 23.4, "reb": 4.5, "ast": 7.8, "stl": 1.0, "blk": 0.8, "tov": 3.4, "fg": 45.2, "fg3": 36.0, "ft": 87.2},
            {"pos": "SG", "name": "Ausar Thompson", "pts": 9.8, "reb": 6.9, "ast": 2.4, "stl": 1.4, "blk": 1.8, "tov": 1.5, "fg": 49.2, "fg3": 21.8, "ft": 62.5},
            {"pos": "SF", "name": "Duncan Robinson", "pts": 11.8, "reb": 2.4, "ast": 2.6, "stl": 0.6, "blk": 0.2, "tov": 1.1, "fg": 44.8, "fg3": 39.2, "ft": 88.5},
            {"pos": "PF", "name": "John Collins", "pts": 14.8, "reb": 8.2, "ast": 1.2, "stl": 0.6, "blk": 0.7, "tov": 1.4, "fg": 53.5, "fg3": 37.4, "ft": 80.0},
            {"pos": "C", "name": "Jalen Duren", "pts": 14.2, "reb": 11.8, "ast": 2.6, "stl": 0.6, "blk": 0.8, "tov": 1.9, "fg": 62.4, "fg3": 0.0, "ft": 79.5}
        ]
    },
    {
        "id": 9,
        "name": "Indiana Pacers",
        "conference": "Eastern",
        "division": "Central",
        "featured_star": "Pascal Siakam",
        "headline_stat": "21.2 PPG | 7.0 RPG",
        "total_salary": 203715395,
        "tax_status": "Luxury Tax",
        "championships": 0,
        "championship_years": [],
        "last_season_record": "19-63",
        "description": "A high-octane offensive unit pushing the pace behind crisp ball movement.",
        "logo": "https://cdn.nba.com/logos/nba/1610612754/primary/L/logo.svg",
        "starters_2026_27": [
            {"pos": "PG", "name": "Tyrese Haliburton", "pts": 18.5, "reb": 3.8, "ast": 9.2, "stl": 1.4, "blk": 0.6, "tov": 2.3, "fg": 46.0, "fg3": 35.5, "ft": 85.0},
            {"pos": "SG", "name": "Andrew Nembhard", "pts": 10.2, "reb": 2.4, "ast": 4.6, "stl": 0.9, "blk": 0.2, "tov": 1.4, "fg": 50.2, "fg3": 36.2, "ft": 81.0},
            {"pos": "SF", "name": "Aaron Nesmith", "pts": 12.6, "reb": 3.9, "ast": 1.6, "stl": 1.0, "blk": 0.4, "tov": 1.1, "fg": 49.8, "fg3": 42.1, "ft": 78.5},
            {"pos": "PF", "name": "Pascal Siakam", "pts": 21.2, "reb": 7.0, "ast": 4.2, "stl": 0.9, "blk": 0.4, "tov": 1.9, "fg": 53.8, "fg3": 38.8, "ft": 73.5},
            {"pos": "C", "name": "Ivica Zubac", "pts": 12.4, "reb": 9.8, "ast": 1.5, "stl": 0.4, "blk": 1.3, "tov": 1.3, "fg": 65.2, "fg3": 0.0, "ft": 72.8}
        ]
    },
    {
        "id": 10,
        "name": "Milwaukee Bucks",
        "conference": "Eastern",
        "division": "Central",
        "featured_star": "Tyler Herro",
        "headline_stat": "21.2 PPG | 4.6 APG",
        "total_salary": 191358866,
        "tax_status": "Over Cap",
        "championships": 2,
        "championship_years": [1971, 2021],
        "last_season_record": "32-50",
        "description": "A re-tooled scoring lineup featuring floor-spacing bigs and three-level shot creators.",
        "logo": "https://cdn.nba.com/logos/nba/1610612749/primary/L/logo.svg",
        "starters_2026_27": [
            {"pos": "PG", "name": "Ryan Rollins", "pts": 6.8, "reb": 2.1, "ast": 2.4, "stl": 0.7, "blk": 0.2, "tov": 1.0, "fg": 43.5, "fg3": 36.8, "ft": 78.5},
            {"pos": "SG", "name": "Tyler Herro", "pts": 21.2, "reb": 5.4, "ast": 4.6, "stl": 0.8, "blk": 0.2, "tov": 2.2, "fg": 44.5, "fg3": 39.8, "ft": 86.0},
            {"pos": "SF", "name": "Jaime Jaquez Jr.", "pts": 12.5, "reb": 4.2, "ast": 2.8, "stl": 1.1, "blk": 0.3, "tov": 1.5, "fg": 49.5, "fg3": 33.5, "ft": 82.5},
            {"pos": "PF", "name": "Kyle Kuzma", "pts": 21.8, "reb": 6.4, "ast": 4.0, "stl": 0.5, "blk": 0.7, "tov": 2.5, "fg": 46.0, "fg3": 33.2, "ft": 77.0},
            {"pos": "C", "name": "Myles Turner", "pts": 16.8, "reb": 6.8, "ast": 1.4, "stl": 0.6, "blk": 1.6, "tov": 1.4, "fg": 52.8, "fg3": 36.2, "ft": 77.8}
        ]
    },

    # --- Southeast Division ---
    {
        "id": 11,
        "name": "Atlanta Hawks",
        "conference": "Eastern",
        "division": "Southeast",
        "featured_star": "Jalen Johnson",
        "headline_stat": "17.5 PPG | 9.1 RPG",
        "total_salary": 221278253,
        "tax_status": "1st Apron",
        "championships": 1,
        "championship_years": [1958],
        "last_season_record": "46-36",
        "description": "A switchable perimeter lineup backed by disruptive perimeter defense and passing.",
        "logo": "https://cdn.nba.com/logos/nba/1610612737/primary/L/logo.svg",
        "starters_2026_27": [
            {"pos": "PG", "name": "C.J. McCollum", "pts": 18.8, "reb": 4.1, "ast": 4.4, "stl": 0.9, "blk": 0.5, "tov": 1.7, "fg": 45.5, "fg3": 42.5, "ft": 82.0},
            {"pos": "SG", "name": "Nickeil Alexander-Walker", "pts": 8.8, "reb": 2.2, "ast": 2.6, "stl": 0.9, "blk": 0.5, "tov": 1.0, "fg": 44.2, "fg3": 39.5, "ft": 80.5},
            {"pos": "SF", "name": "Dyson Daniels", "pts": 9.5, "reb": 5.4, "ast": 4.3, "stl": 2.4, "blk": 0.8, "tov": 1.8, "fg": 46.8, "fg3": 34.2, "ft": 70.5},
            {"pos": "PF", "name": "Jalen Johnson", "pts": 17.5, "reb": 9.1, "ast": 4.4, "stl": 1.3, "blk": 0.9, "tov": 2.5, "fg": 52.0, "fg3": 36.1, "ft": 74.0},
            {"pos": "C", "name": "Onyeka Okongwu", "pts": 10.6, "reb": 7.1, "ast": 1.4, "stl": 0.6, "blk": 1.1, "tov": 1.0, "fg": 61.5, "fg3": 33.5, "ft": 79.5}
        ]
    },
    {
        "id": 12,
        "name": "Charlotte Hornets",
        "conference": "Eastern",
        "division": "Southeast",
        "featured_star": "Brandon Miller",
        "headline_stat": "18.5 PPG | 4.6 RPG",
        "total_salary": 174870647,
        "tax_status": "Over Cap",
        "championships": 0,
        "championship_years": [],
        "last_season_record": "44-38",
        "description": "A rising, sweet-shooting group focused on high volume three-point creation.",
        "logo": "https://cdn.nba.com/logos/nba/1610612766/primary/L/logo.svg",
        "starters_2026_27": [
            {"pos": "PG", "name": "Coby White", "pts": 18.8, "reb": 4.4, "ast": 4.9, "stl": 0.7, "blk": 0.2, "tov": 2.1, "fg": 44.5, "fg3": 37.2, "ft": 83.5},
            {"pos": "SG", "name": "Kon Knueppel", "pts": 13.5, "reb": 3.9, "ast": 2.6, "stl": 0.8, "blk": 0.3, "tov": 1.2, "fg": 47.1, "fg3": 41.2, "ft": 88.5},
            {"pos": "SF", "name": "Brandon Miller", "pts": 18.5, "reb": 4.6, "ast": 2.8, "stl": 1.0, "blk": 0.6, "tov": 1.9, "fg": 45.2, "fg3": 38.0, "ft": 83.5},
            {"pos": "PF", "name": "Naz Reid", "pts": 13.8, "reb": 5.4, "ast": 1.4, "stl": 0.8, "blk": 1.0, "tov": 1.4, "fg": 48.0, "fg3": 41.8, "ft": 74.0},
            {"pos": "C", "name": "Moussa Diabaté", "pts": 5.2, "reb": 6.4, "ast": 0.8, "stl": 0.6, "blk": 1.0, "tov": 0.7, "fg": 59.5, "fg3": 0.0, "ft": 64.2}
        ]
    },
    {
        "id": 13,
        "name": "Miami Heat",
        "conference": "Eastern",
        "division": "Southeast",
        "featured_star": "Giannis Antetokounmpo",
        "headline_stat": "30.4 PPG | 11.9 RPG",
        "total_salary": 204486535,
        "tax_status": "Luxury Tax",
        "championships": 3,
        "championship_years": [2006, 2012, 2013],
        "last_season_record": "43-39",
        "description": "A dominant defensive juggernaut anchored by two of the most athletic bigs in the sport.",
        "logo": "https://cdn.nba.com/logos/nba/1610612748/primary/L/logo.svg",
        "starters_2026_27": [
            {"pos": "PG", "name": "Davion Mitchell", "pts": 6.4, "reb": 1.6, "ast": 2.7, "stl": 0.8, "blk": 0.2, "tov": 0.9, "fg": 46.0, "fg3": 37.2, "ft": 74.0},
            {"pos": "SG", "name": "Tim Hardaway Jr.", "pts": 13.8, "reb": 3.0, "ast": 1.6, "stl": 0.5, "blk": 0.1, "tov": 1.0, "fg": 40.0, "fg3": 35.0, "ft": 85.0},
            {"pos": "SF", "name": "Andrew Wiggins", "pts": 13.0, "reb": 4.4, "ast": 1.6, "stl": 0.9, "blk": 1.0, "tov": 1.4, "fg": 45.0, "fg3": 35.5, "ft": 75.0},
            {"pos": "PF", "name": "Giannis Antetokounmpo", "pts": 30.4, "reb": 11.9, "ast": 6.1, "stl": 1.2, "blk": 1.1, "tov": 3.4, "fg": 60.1, "fg3": 24.5, "ft": 61.8},
            {"pos": "C", "name": "Bam Adebayo", "pts": 19.4, "reb": 10.6, "ast": 4.1, "stl": 1.2, "blk": 0.9, "tov": 2.3, "fg": 52.4, "fg3": 35.8, "ft": 75.8}
        ]
    },
    {
        "id": 14,
        "name": "Orlando Magic",
        "conference": "Eastern",
        "division": "Southeast",
        "featured_star": "Paolo Banchero",
        "headline_stat": "23.5 PPG | 7.2 RPG",
        "total_salary": 218125071,
        "tax_status": "1st Apron",
        "championships": 0,
        "championship_years": [],
        "last_season_record": "45-37",
        "description": "An imposing, modern physical squad built around point forwards and elite perimeter lock-down guards.",
        "logo": "https://cdn.nba.com/logos/nba/1610612753/primary/L/logo.svg",
        "starters_2026_27": [
            {"pos": "PG", "name": "Jalen Suggs", "pts": 13.4, "reb": 3.4, "ast": 3.2, "stl": 1.5, "blk": 0.6, "tov": 1.9, "fg": 47.5, "fg3": 40.1, "ft": 76.8},
            {"pos": "SG", "name": "Desmond Bane", "pts": 22.8, "reb": 4.5, "ast": 5.2, "stl": 1.1, "blk": 0.5, "tov": 2.4, "fg": 46.0, "fg3": 37.8, "ft": 86.5},
            {"pos": "SF", "name": "Franz Wagner", "pts": 20.4, "reb": 5.6, "ast": 4.0, "stl": 1.2, "blk": 0.4, "tov": 1.9, "fg": 48.8, "fg3": 30.5, "ft": 85.8},
            {"pos": "PF", "name": "Paolo Banchero", "pts": 23.5, "reb": 7.2, "ast": 5.8, "stl": 0.9, "blk": 0.6, "tov": 3.1, "fg": 46.2, "fg3": 34.8, "ft": 73.5},
            {"pos": "C", "name": "Wendell Carter Jr.", "pts": 11.2, "reb": 7.1, "ast": 1.8, "stl": 0.6, "blk": 1.7, "tov": 1.3, "fg": 52.8, "fg3": 37.6, "ft": 70.0}
        ]
    },
    {
        "id": 15,
        "name": "Washington Wizards",
        "conference": "Eastern",
        "division": "Southeast",
        "featured_star": "Anthony Davis",
        "headline_stat": "25.4 PPG | 12.1 RPG",
        "total_salary": 189013104,
        "tax_status": "Over Cap",
        "championships": 1,
        "championship_years": [1978],
        "last_season_record": "17-65",
        "description": "An electric offensive backcourt paired with a premier rim protector and defensive anchor.",
        "logo": "https://cdn.nba.com/logos/nba/1610612764/primary/L/logo.svg",
        "starters_2026_27": [
            {"pos": "PG", "name": "Trae Young", "pts": 24.5, "reb": 3.1, "ast": 11.6, "stl": 1.3, "blk": 0.2, "tov": 4.1, "fg": 42.5, "fg3": 36.0, "ft": 86.5},
            {"pos": "SG", "name": "Kyshawn George", "pts": 9.8, "reb": 3.6, "ast": 2.5, "stl": 0.9, "blk": 0.5, "tov": 1.3, "fg": 42.8, "fg3": 36.5, "ft": 78.5},
            {"pos": "SF", "name": "AJ Dybantsa", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"pos": "PF", "name": "Anthony Davis", "pts": 25.4, "reb": 12.1, "ast": 3.2, "stl": 1.2, "blk": 2.3, "tov": 2.1, "fg": 54.2, "fg3": 30.0, "ft": 80.5},
            {"pos": "C", "name": "Alex Sarr", "pts": 12.5, "reb": 6.8, "ast": 2.1, "stl": 0.7, "blk": 1.8, "tov": 1.5, "fg": 42.8, "fg3": 31.5, "ft": 72.0}
        ]
    },

    # ==================== WESTERN CONFERENCE ====================
    # --- Northwest Division ---
    {
        "id": 16,
        "name": "Denver Nuggets",
        "conference": "Western",
        "division": "Northwest",
        "featured_star": "Nikola Jokić",
        "headline_stat": "29.6 PPG | 10.2 APG",
        "total_salary": 215333328,
        "tax_status": "1st Apron",
        "championships": 1,
        "championship_years": [2023],
        "last_season_record": "54-28",
        "description": "The quintessential half-court clinic ran by arguably the most gifted passing center in basketball history.",
        "logo": "https://cdn.nba.com/logos/nba/1610612743/primary/L/logo.svg",
        "starters_2026_27": [
            {"pos": "PG", "name": "Jamal Murray", "pts": 20.8, "reb": 4.0, "ast": 6.2, "stl": 1.0, "blk": 0.6, "tov": 2.1, "fg": 47.8, "fg3": 41.8, "ft": 85.0},
            {"pos": "SG", "name": "Christian Braun", "pts": 8.9, "reb": 4.2, "ast": 2.0, "stl": 0.8, "blk": 0.5, "tov": 0.8, "fg": 47.8, "fg3": 39.5, "ft": 72.0},
            {"pos": "SF", "name": "Cameron Johnson", "pts": 13.6, "reb": 4.3, "ast": 2.5, "stl": 0.8, "blk": 0.4, "tov": 0.9, "fg": 44.8, "fg3": 39.4, "ft": 79.2},
            {"pos": "PF", "name": "Aaron Gordon", "pts": 14.2, "reb": 6.6, "ast": 3.6, "stl": 0.8, "blk": 0.6, "tov": 1.5, "fg": 55.8, "fg3": 29.5, "ft": 66.2},
            {"pos": "C", "name": "Nikola Jokić", "pts": 29.6, "reb": 12.8, "ast": 10.2, "stl": 1.5, "blk": 0.8, "tov": 3.2, "fg": 57.6, "fg3": 41.2, "ft": 80.5}
        ]
    },
    {
        "id": 17,
        "name": "Minnesota Timberwolves",
        "conference": "Western",
        "division": "Northwest",
        "featured_star": "Anthony Edwards",
        "headline_stat": "27.2 PPG | 5.7 RPG",
        "total_salary": 215871829,
        "tax_status": "1st Apron",
        "championships": 0,
        "championship_years": [],
        "last_season_record": "49-33",
        "description": "An aggressive, athletic title contender built on elite point-of-attack harassment and high-flying scoring.",
        "logo": "https://cdn.nba.com/logos/nba/1610612750/primary/L/logo.svg",
        "starters_2026_27": [
            {"pos": "PG", "name": "LaMelo Ball", "pts": 23.5, "reb": 5.0, "ast": 7.8, "stl": 1.4, "blk": 0.3, "tov": 3.5, "fg": 43.0, "fg3": 35.2, "ft": 86.0},
            {"pos": "SG", "name": "Anthony Edwards", "pts": 27.2, "reb": 5.7, "ast": 5.1, "stl": 1.4, "blk": 0.8, "tov": 3.1, "fg": 46.5, "fg3": 40.2, "ft": 84.5},
            {"pos": "SF", "name": "Jaden McDaniels", "pts": 11.4, "reb": 3.5, "ast": 1.7, "stl": 1.0, "blk": 1.0, "tov": 1.2, "fg": 49.5, "fg3": 35.0, "ft": 74.0},
            {"pos": "PF", "name": "Jonathan Kuminga", "pts": 16.8, "reb": 5.2, "ast": 2.5, "stl": 0.8, "blk": 0.6, "tov": 1.8, "fg": 53.4, "fg3": 33.0, "ft": 75.8},
            {"pos": "C", "name": "Rudy Gobert", "pts": 13.8, "reb": 12.7, "ast": 1.2, "stl": 0.6, "blk": 1.6, "tov": 1.5, "fg": 65.8, "fg3": 0.0, "ft": 63.5}
        ]
    },
    {
        "id": 18,
        "name": "Oklahoma City Thunder",
        "conference": "Western",
        "division": "Northwest",
        "featured_star": "Shai Gilgeous-Alexander",
        "headline_stat": "32.7 PPG | 6.4 APG",
        "total_salary": 214798992,
        "tax_status": "1st Apron",
        "championships": 2,
        "championship_years": [1979, 2025],
        "last_season_record": "64-18",
        "description": "The 2025 NBA Champions boasting an all-around dominant core with Shai Gilgeous-Alexander and Chet Holmgren.",
        "logo": "https://cdn.nba.com/logos/nba/1610612760/primary/L/logo.svg",
        "starters_2026_27": [
            {"pos": "PG", "name": "Shai Gilgeous-Alexander", "pts": 32.7, "reb": 5.0, "ast": 6.4, "stl": 1.8, "blk": 0.8, "tov": 2.2, "fg": 51.9, "fg3": 37.5, "ft": 89.8},
            {"pos": "SG", "name": "Cason Wallace", "pts": 8.2, "reb": 2.8, "ast": 2.1, "stl": 1.2, "blk": 0.5, "tov": 0.7, "fg": 50.2, "fg3": 42.5, "ft": 80.0},
            {"pos": "SF", "name": "Jalen Williams", "pts": 19.8, "reb": 4.3, "ast": 4.8, "stl": 1.3, "blk": 0.7, "tov": 1.9, "fg": 54.5, "fg3": 43.1, "ft": 82.0},
            {"pos": "PF", "name": "Chet Holmgren", "pts": 17.4, "reb": 8.4, "ast": 2.7, "stl": 0.7, "blk": 1.9, "tov": 1.7, "fg": 53.8, "fg3": 37.8, "ft": 80.5},
            {"pos": "C", "name": "Isaiah Hartenstein", "pts": 8.2, "reb": 8.6, "ast": 2.6, "stl": 1.0, "blk": 1.1, "tov": 1.2, "fg": 64.8, "fg3": 33.3, "ft": 71.0}
        ]
    },
    {
        "id": 19,
        "name": "Portland Trail Blazers",
        "conference": "Western",
        "division": "Northwest",
        "featured_star": "Ja Morant",
        "headline_stat": "24.6 PPG | 7.8 APG",
        "total_salary": 194511148,
        "tax_status": "Over Cap",
        "championships": 1,
        "championship_years": [1977],
        "last_season_record": "42-40",
        "description": "A high-flying backcourt pairing explosive rim attacks with clutch deep-range shooting.",
        "logo": "https://cdn.nba.com/logos/nba/1610612757/primary/L/logo.svg",
        "starters_2026_27": [
            {"pos": "PG", "name": "Ja Morant", "pts": 24.6, "reb": 5.4, "ast": 7.8, "stl": 1.1, "blk": 0.3, "tov": 3.0, "fg": 46.8, "fg3": 28.0, "ft": 81.0},
            {"pos": "SG", "name": "Damian Lillard", "pts": 23.8, "reb": 4.2, "ast": 6.8, "stl": 0.9, "blk": 0.2, "tov": 2.5, "fg": 42.8, "fg3": 35.8, "ft": 92.2},
            {"pos": "SF", "name": "Toumani Camara", "pts": 8.6, "reb": 5.4, "ast": 1.6, "stl": 1.2, "blk": 0.5, "tov": 1.1, "fg": 46.2, "fg3": 35.0, "ft": 77.5},
            {"pos": "PF", "name": "Deni Avdija", "pts": 15.4, "reb": 7.6, "ast": 4.1, "stl": 0.9, "blk": 0.5, "tov": 2.1, "fg": 51.2, "fg3": 38.0, "ft": 75.2},
            {"pos": "C", "name": "Donovan Clingan", "pts": 9.2, "reb": 8.1, "ast": 1.4, "stl": 0.5, "blk": 1.7, "tov": 1.3, "fg": 59.5, "fg3": 25.0, "ft": 60.0}
        ]
    },
    {
        "id": 20,
        "name": "Utah Jazz",
        "conference": "Western",
        "division": "Northwest",
        "featured_star": "Lauri Markkanen",
        "headline_stat": "22.8 PPG | 8.0 RPG",
        "total_salary": 179365019,
        "tax_status": "Over Cap",
        "championships": 0,
        "championship_years": [],
        "last_season_record": "22-60",
        "description": "A seven-foot forward-led shooting squad with premier interior shot-blocking.",
        "logo": "https://cdn.nba.com/logos/nba/1610612762/primary/L/logo.svg",
        "starters_2026_27": [
            {"pos": "PG", "name": "Keyonte George", "pts": 14.5, "reb": 3.2, "ast": 5.2, "stl": 0.7, "blk": 0.2, "tov": 2.5, "fg": 40.8, "fg3": 34.9, "ft": 79.2},
            {"pos": "SG", "name": "Darryn Peterson", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"pos": "SF", "name": "Lauri Markkanen", "pts": 22.8, "reb": 8.0, "ast": 2.1, "stl": 0.8, "blk": 0.6, "tov": 1.4, "fg": 47.8, "fg3": 39.5, "ft": 89.5},
            {"pos": "PF", "name": "Jaren Jackson Jr.", "pts": 22.2, "reb": 5.4, "ast": 2.2, "stl": 1.2, "blk": 1.8, "tov": 2.1, "fg": 44.8, "fg3": 32.5, "ft": 81.2},
            {"pos": "C", "name": "Jusuf Nurkić", "pts": 10.6, "reb": 10.8, "ast": 3.8, "stl": 1.0, "blk": 1.1, "tov": 2.1, "fg": 50.8, "fg3": 24.0, "ft": 63.8}
        ]
    },

    # --- Pacific Division ---
    {
        "id": 21,
        "name": "Golden State Warriors",
        "conference": "Western",
        "division": "Pacific",
        "featured_star": "Stephen Curry",
        "headline_stat": "24.2 PPG | 4.4 RPG",
        "total_salary": 219763627,
        "tax_status": "1st Apron",
        "championships": 7,
        "championship_years": [1947, 1956, 1975, 2015, 2017, 2018, 2022],
        "last_season_record": "37-45",
        "description": "The golden standard of motion basketball and perimeter gravity featuring veteran championship DNA.",
        "logo": "https://cdn.nba.com/logos/nba/1610612744/primary/L/logo.svg",
        "starters_2026_27": [
            {"pos": "PG", "name": "Stephen Curry", "pts": 24.2, "reb": 4.4, "ast": 6.1, "stl": 0.8, "blk": 0.4, "tov": 2.7, "fg": 44.8, "fg3": 39.8, "ft": 92.5},
            {"pos": "SG", "name": "Brandin Podziemski", "pts": 11.5, "reb": 6.2, "ast": 4.4, "stl": 1.0, "blk": 0.2, "tov": 1.4, "fg": 46.8, "fg3": 39.4, "ft": 68.0},
            {"pos": "SF", "name": "Jimmy Butler", "pts": 20.2, "reb": 5.1, "ast": 4.8, "stl": 1.4, "blk": 0.4, "tov": 1.6, "fg": 49.5, "fg3": 41.0, "ft": 85.5},
            {"pos": "PF", "name": "Draymond Green", "pts": 8.4, "reb": 7.0, "ast": 5.8, "stl": 1.0, "blk": 0.9, "tov": 2.1, "fg": 49.2, "fg3": 39.0, "ft": 72.5},
            {"pos": "C", "name": "Kristaps Porziņģis", "pts": 19.8, "reb": 7.0, "ast": 1.9, "stl": 0.6, "blk": 1.8, "tov": 1.6, "fg": 51.2, "fg3": 37.2, "ft": 85.5}
        ]
    },
    {
        "id": 22,
        "name": "LA Clippers",
        "conference": "Western",
        "division": "Pacific",
        "featured_star": "Brandon Ingram",
        "headline_stat": "20.4 PPG | 5.6 APG",
        "total_salary": 196862414,
        "tax_status": "Over Cap",
        "championships": 0,
        "championship_years": [],
        "last_season_record": "42-40",
        "description": "A methodical wing-oriented scoring unit surrounded by stretch shooting and rim defense.",
        "logo": "https://cdn.nba.com/logos/nba/1610612746/primary/L/logo.svg",
        "starters_2026_27": [
            {"pos": "PG", "name": "Darius Garland", "pts": 18.4, "reb": 2.8, "ast": 6.8, "stl": 1.1, "blk": 0.1, "tov": 2.4, "fg": 44.8, "fg3": 37.5, "ft": 83.8},
            {"pos": "SG", "name": "Kris Dunn", "pts": 5.6, "reb": 3.0, "ast": 4.0, "stl": 1.5, "blk": 0.4, "tov": 1.2, "fg": 47.5, "fg3": 37.2, "ft": 69.2},
            {"pos": "SF", "name": "Brandon Ingram", "pts": 20.4, "reb": 5.0, "ast": 5.6, "stl": 0.9, "blk": 0.6, "tov": 2.4, "fg": 49.0, "fg3": 35.2, "ft": 80.5},
            {"pos": "PF", "name": "Rui Hachimura", "pts": 13.4, "reb": 4.2, "ast": 1.3, "stl": 0.5, "blk": 0.3, "tov": 1.0, "fg": 53.4, "fg3": 42.0, "ft": 74.2},
            {"pos": "C", "name": "Brook Lopez", "pts": 12.2, "reb": 5.0, "ast": 1.5, "stl": 0.5, "blk": 1.2, "tov": 1.0, "fg": 48.2, "fg3": 36.2, "ft": 82.5}
        ]
    },
    {
        "id": 23,
        "name": "Los Angeles Lakers",
        "conference": "Western",
        "division": "Pacific",
        "featured_star": "Luka Dončić",
        "headline_stat": "28.2 PPG | 8.2 RPG",
        "total_salary": 201332759,
        "tax_status": "Luxury Tax",
        "championships": 17,
        "championship_years": [1949, 1950, 1952, 1953, 1954, 1972, 1980, 1982, 1985, 1987, 1988, 2000, 2001, 2002, 2009, 2010, 2020],
        "last_season_record": "53-29",
        "description": "An elite heliocentric powerhouse led by generational court vision and offensive control.",
        "logo": "https://cdn.nba.com/logos/nba/1610612747/primary/L/logo.svg",
        "starters_2026_27": [
            {"pos": "PG", "name": "Luka Dončić", "pts": 28.2, "reb": 8.2, "ast": 7.8, "stl": 1.4, "blk": 0.5, "tov": 3.6, "fg": 45.2, "fg3": 35.5, "ft": 78.5},
            {"pos": "SG", "name": "Austin Reaves", "pts": 16.2, "reb": 4.4, "ast": 5.7, "stl": 0.8, "blk": 0.3, "tov": 2.0, "fg": 48.8, "fg3": 37.0, "ft": 85.8},
            {"pos": "SF", "name": "Quentin Grimes", "pts": 8.4, "reb": 2.4, "ast": 1.6, "stl": 0.8, "blk": 0.3, "tov": 0.9, "fg": 40.5, "fg3": 36.2, "ft": 80.1},
            {"pos": "PF", "name": "Sandro Mamukelashvili", "pts": 5.8, "reb": 3.9, "ast": 1.4, "stl": 0.4, "blk": 0.4, "tov": 0.7, "fg": 48.5, "fg3": 32.1, "ft": 76.0},
            {"pos": "C", "name": "Walker Kessler", "pts": 9.4, "reb": 8.8, "ast": 1.1, "stl": 0.5, "blk": 2.6, "tov": 1.2, "fg": 66.8, "fg3": 21.1, "ft": 62.4}
        ]
    },
    {
        "id": 24,
        "name": "Phoenix Suns",
        "conference": "Western",
        "division": "Pacific",
        "featured_star": "Devin Booker",
        "headline_stat": "25.8 PPG | 7.1 APG",
        "total_salary": 216225506,
        "tax_status": "1st Apron",
        "championships": 0,
        "championship_years": [],
        "last_season_record": "45-37",
        "description": "A high-scoring perimeter core featuring lethal isolation shot-making and transition pace.",
        "logo": "https://cdn.nba.com/logos/nba/1610612756/primary/L/logo.svg",
        "starters_2026_27": [
            {"pos": "PG", "name": "Devin Booker", "pts": 25.8, "reb": 4.1, "ast": 7.1, "stl": 1.0, "blk": 0.4, "tov": 2.6, "fg": 47.0, "fg3": 34.5, "ft": 89.0},
            {"pos": "SG", "name": "Jalen Green", "pts": 20.4, "reb": 5.4, "ast": 3.8, "stl": 0.9, "blk": 0.3, "tov": 2.2, "fg": 43.5, "fg3": 34.6, "ft": 81.5},
            {"pos": "SF", "name": "Dillon Brooks", "pts": 12.5, "reb": 3.3, "ast": 1.6, "stl": 0.9, "blk": 0.2, "tov": 1.3, "fg": 42.5, "fg3": 35.5, "ft": 84.0},
            {"pos": "PF", "name": "Miles Bridges", "pts": 20.6, "reb": 7.1, "ast": 3.2, "stl": 0.9, "blk": 0.5, "tov": 1.9, "fg": 46.0, "fg3": 34.5, "ft": 82.0},
            {"pos": "C", "name": "Mark Williams", "pts": 12.5, "reb": 9.5, "ast": 1.1, "stl": 0.6, "blk": 0.9, "tov": 1.2, "fg": 64.5, "fg3": 0.0, "ft": 71.5}
        ]
    },
    {
        "id": 25,
        "name": "Sacramento Kings",
        "conference": "Western",
        "division": "Pacific",
        "featured_star": "Domantas Sabonis",
        "headline_stat": "19.4 PPG | 13.9 RPG",
        "total_salary": 189346486,
        "tax_status": "Over Cap",
        "championships": 1,
        "championship_years": [1951],
        "last_season_record": "22-60",
        "description": "A fast-paced dribble-handoff machine anchored by an All-NBA triple-double center.",
        "logo": "https://cdn.nba.com/logos/nba/1610612758/primary/L/logo.svg",
        "starters_2026_27": [
            {"pos": "PG", "name": "Darius Acuff Jr.", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"pos": "SG", "name": "Zach LaVine", "pts": 19.2, "reb": 5.0, "ast": 3.8, "stl": 0.8, "blk": 0.3, "tov": 2.2, "fg": 45.0, "fg3": 34.5, "ft": 85.0},
            {"pos": "SF", "name": "De'Andre Hunter", "pts": 15.4, "reb": 3.8, "ast": 1.4, "stl": 0.8, "blk": 0.3, "tov": 1.3, "fg": 45.5, "fg3": 38.2, "ft": 84.2},
            {"pos": "PF", "name": "Keegan Murray", "pts": 16.1, "reb": 5.8, "ast": 1.9, "stl": 1.0, "blk": 0.7, "tov": 1.2, "fg": 46.2, "fg3": 36.8, "ft": 84.0},
            {"pos": "C", "name": "Domantas Sabonis", "pts": 19.4, "reb": 13.9, "ast": 8.2, "stl": 0.9, "blk": 0.6, "tov": 3.3, "fg": 59.4, "fg3": 37.9, "ft": 70.4}
        ]
    },

    # --- Southwest Division ---
    {
        "id": 26,
        "name": "Dallas Mavericks",
        "conference": "Western",
        "division": "Southwest",
        "featured_star": "Kyrie Irving",
        "headline_stat": "25.2 PPG | 5.1 APG",
        "total_salary": 197866094,
        "tax_status": "Over Cap",
        "championships": 1,
        "championship_years": [2011],
        "last_season_record": "26-56",
        "description": "A dynamic offensive unit fusing legendary handles with the top incoming forward prospect.",
        "logo": "https://cdn.nba.com/logos/nba/1610612742/primary/L/logo.svg",
        "starters_2026_27": [
            {"pos": "PG", "name": "Kyrie Irving", "pts": 25.2, "reb": 4.8, "ast": 5.1, "stl": 1.3, "blk": 0.5, "tov": 1.8, "fg": 49.5, "fg3": 40.8, "ft": 90.2},
            {"pos": "SG", "name": "Max Christie", "pts": 5.6, "reb": 2.5, "ast": 1.2, "stl": 0.5, "blk": 0.3, "tov": 0.7, "fg": 44.0, "fg3": 37.2, "ft": 80.0},
            {"pos": "SF", "name": "Zaccharie Risacher", "pts": 13.5, "reb": 4.2, "ast": 1.8, "stl": 0.9, "blk": 0.6, "tov": 1.4, "fg": 43.5, "fg3": 35.2, "ft": 74.5},
            {"pos": "PF", "name": "Cooper Flagg", "pts": 18.7, "reb": 8.1, "ast": 4.2, "stl": 1.4, "blk": 0.9, "tov": 2.2, "fg": 48.6, "fg3": 35.1, "ft": 81.4},
            {"pos": "C", "name": "Dereck Lively II", "pts": 9.8, "reb": 7.8, "ast": 1.5, "stl": 0.7, "blk": 1.5, "tov": 1.1, "fg": 73.2, "fg3": 0.0, "ft": 54.0}
        ]
    },
    {
        "id": 27,
        "name": "Houston Rockets",
        "conference": "Western",
        "division": "Southwest",
        "featured_star": "Kevin Durant",
        "headline_stat": "26.8 PPG | 6.3 RPG",
        "total_salary": 205487343,
        "tax_status": "Luxury Tax",
        "championships": 2,
        "championship_years": [1994, 1995],
        "last_season_record": "52-30",
        "description": "A deep, long-limbed playoff squad combining unguardable scoring with relentless offensive rebounding.",
        "logo": "https://cdn.nba.com/logos/nba/1610612745/primary/L/logo.svg",
        "starters_2026_27": [
            {"pos": "PG", "name": "Fred VanVleet", "pts": 17.2, "reb": 3.7, "ast": 8.0, "stl": 1.4, "blk": 0.8, "tov": 1.8, "fg": 41.8, "fg3": 38.5, "ft": 86.2},
            {"pos": "SG", "name": "Amen Thompson", "pts": 12.8, "reb": 7.5, "ast": 3.8, "stl": 1.4, "blk": 0.7, "tov": 1.8, "fg": 54.5, "fg3": 17.5, "ft": 71.0},
            {"pos": "SF", "name": "Kevin Durant", "pts": 26.8, "reb": 6.3, "ast": 4.2, "stl": 0.9, "blk": 0.9, "tov": 2.8, "fg": 52.5, "fg3": 41.5, "ft": 86.5},
            {"pos": "PF", "name": "Jabari Smith Jr.", "pts": 14.8, "reb": 8.6, "ast": 1.8, "stl": 0.8, "blk": 0.9, "tov": 1.3, "fg": 46.5, "fg3": 37.8, "ft": 83.5},
            {"pos": "C", "name": "Alperen Şengün", "pts": 21.4, "reb": 9.5, "ast": 5.2, "stl": 1.2, "blk": 1.1, "tov": 2.7, "fg": 54.0, "fg3": 30.0, "ft": 69.8}
        ]
    },
    {
        "id": 28,
        "name": "Memphis Grizzlies",
        "conference": "Western",
        "division": "Southwest",
        "featured_star": "Zach Edey",
        "headline_stat": "14.2 PPG | 9.2 RPG",
        "total_salary": 167642677,
        "tax_status": "Over Cap",
        "championships": 0,
        "championship_years": [],
        "last_season_record": "25-57",
        "description": "A bruising, interior-heavy squad with massive frontcourt presence.",
        "logo": "https://cdn.nba.com/logos/nba/1610612763/primary/L/logo.svg",
        "starters_2026_27": [
            {"pos": "PG", "name": "Ty Jerome", "pts": 7.8, "reb": 1.9, "ast": 3.2, "stl": 0.7, "blk": 0.1, "tov": 1.0, "fg": 47.5, "fg3": 38.8, "ft": 88.2},
            {"pos": "SG", "name": "Jaylen Wells", "pts": 10.2, "reb": 3.6, "ast": 1.8, "stl": 0.7, "blk": 0.3, "tov": 1.1, "fg": 44.8, "fg3": 38.5, "ft": 83.0},
            {"pos": "SF", "name": "Cedric Coward", "pts": 7.8, "reb": 3.4, "ast": 1.4, "stl": 0.7, "blk": 0.4, "tov": 0.9, "fg": 44.8, "fg3": 35.5, "ft": 77.0},
            {"pos": "PF", "name": "Cameron Boozer", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"pos": "C", "name": "Zach Edey", "pts": 14.2, "reb": 9.2, "ast": 1.2, "stl": 0.4, "blk": 1.6, "tov": 1.6, "fg": 62.5, "fg3": 0.0, "ft": 72.0}
        ]
    },
    {
        "id": 29,
        "name": "New Orleans Pelicans",
        "conference": "Western",
        "division": "Southwest",
        "featured_star": "Zion Williamson",
        "headline_stat": "23.2 PPG | 5.9 RPG",
        "total_salary": 202241014,
        "tax_status": "Luxury Tax",
        "championships": 0,
        "championship_years": [],
        "last_season_record": "26-56",
        "description": "An unstoppable rim-wrecking offense surrounded by two-way wing perimeter stoppers.",
        "logo": "https://cdn.nba.com/logos/nba/1610612740/primary/L/logo.svg",
        "starters_2026_27": [
            {"pos": "PG", "name": "Dejounte Murray", "pts": 22.2, "reb": 5.1, "ast": 6.2, "stl": 1.5, "blk": 0.3, "tov": 2.4, "fg": 45.6, "fg3": 36.0, "ft": 79.0},
            {"pos": "SG", "name": "Trey Murphy III", "pts": 15.6, "reb": 5.2, "ast": 2.5, "stl": 0.9, "blk": 0.5, "tov": 1.2, "fg": 45.1, "fg3": 39.2, "ft": 83.0},
            {"pos": "SF", "name": "Herb Jones", "pts": 11.2, "reb": 3.7, "ast": 2.7, "stl": 1.5, "blk": 0.9, "tov": 1.3, "fg": 50.0, "fg3": 42.0, "ft": 87.0},
            {"pos": "PF", "name": "Zion Williamson", "pts": 23.2, "reb": 5.9, "ast": 5.1, "stl": 1.0, "blk": 0.7, "tov": 2.8, "fg": 57.4, "fg3": 33.5, "ft": 70.5},
            {"pos": "C", "name": "Derik Queen", "pts": 11.6, "reb": 7.2, "ast": 2.4, "stl": 0.8, "blk": 0.9, "tov": 1.7, "fg": 54.1, "fg3": 28.0, "ft": 72.8}
        ]
    },
    {
        "id": 30,
        "name": "San Antonio Spurs",
        "conference": "Western",
        "division": "Southwest",
        "featured_star": "Victor Wembanyama",
        "headline_stat": "24.3 PPG | 11.0 RPG",
        "total_salary": 198315672,
        "tax_status": "Over Cap",
        "championships": 5,
        "championship_years": [1999, 2003, 2005, 2007, 2014],
        "last_season_record": "62-20",
        "description": "A 62-win rising juggernaut built around the most game-altering two-way talent on the planet.",
        "logo": "https://cdn.nba.com/logos/nba/1610612759/primary/L/logo.svg",
        "starters_2026_27": [
            {"pos": "PG", "name": "De'Aaron Fox", "pts": 26.2, "reb": 4.5, "ast": 5.4, "stl": 1.8, "blk": 0.4, "tov": 2.6, "fg": 46.2, "fg3": 36.6, "ft": 73.5},
            {"pos": "SG", "name": "Stephon Castle", "pts": 14.7, "reb": 3.7, "ast": 4.1, "stl": 1.2, "blk": 0.4, "tov": 2.1, "fg": 44.8, "fg3": 30.5, "ft": 72.9},
            {"pos": "SF", "name": "Devin Vassell", "pts": 19.2, "reb": 3.7, "ast": 4.0, "stl": 1.1, "blk": 0.4, "tov": 1.6, "fg": 47.0, "fg3": 37.0, "ft": 80.0},
            {"pos": "PF", "name": "Tobias Harris", "pts": 16.8, "reb": 6.3, "ast": 3.0, "stl": 0.8, "blk": 0.5, "tov": 1.3, "fg": 48.5, "fg3": 35.0, "ft": 87.5},
            {"pos": "C", "name": "Victor Wembanyama", "pts": 24.3, "reb": 11.0, "ast": 3.7, "stl": 1.3, "blk": 3.1, "tov": 3.1, "fg": 47.5, "fg3": 34.5, "ft": 82.5}
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
def search_teams(q: str = Query(default="", min_length=0)):
    search_query = q.lower().strip()
    if not search_query:
        return {"query": q, "count": len(teams), "results": teams}

    results = []
    for team in teams:
        starters_str = " ".join([f"{p.get('name', '')} {p.get('pos', '')}" for p in team.get("starters_2026_27", [])]).lower()
        searchable_text = f"{team.get('name', '')} {team.get('conference', '')} {team.get('division', '')} {team.get('tax_status', '')} {starters_str}".lower()

        if search_query in searchable_text:
            results.append(team)

    return {
        "query": q,
        "count": len(results),
        "results": results
    }
