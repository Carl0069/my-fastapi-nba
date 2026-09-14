from datetime import datetime
from typing import List, Optional, Literal
from fastapi import FastAPI, HTTPException, Header, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


API_KEY = "student-api-key-123"
API_VERSION = "1.0"

app = FastAPI(
    title="NBA Hub API",
    description="Enterprise-style REST API providing NBA team rosters, stats, and records.",
    version=API_VERSION,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==============================================================================
# DATA MODEL (PYDANTIC SCHEMAS)
# ==============================================================================
class PlayerStat(BaseModel):
    name: str = Field(..., min_length=1, description="Player full name")
    pos: str = Field(..., description="Court position")
    pts: float = Field(..., ge=0.0, le=100.0, description="Points per game")
    reb: float = Field(..., ge=0.0, le=50.0, description="Rebounds per game")
    ast: float = Field(..., ge=0.0, le=30.0, description="Assists per game")
    stl: float = Field(..., ge=0.0, le=10.0, description="Steals per game")
    blk: float = Field(..., ge=0.0, le=15.0, description="Blocks per game")
    tov: float = Field(..., ge=0.0, le=15.0, description="Turnovers per game")
    fg: float = Field(..., ge=0.0, le=100.0, description="Field goal percentage")
    fg3: float = Field(..., ge=0.0, le=100.0, description="Three-point percentage")
    ft: float = Field(..., ge=0.0, le=100.0, description="Free throw percentage")

class Team(BaseModel):
    id: int = Field(..., ge=1, le=30, description="Unique team identifier")
    name: str = Field(..., min_length=2, description="Team full name")
    conference: Literal["Eastern", "Western"] = Field(..., description="NBA Conference")
    division: Literal["Atlantic", "Central", "Southeast", "Northwest", "Pacific", "Southwest"] = Field(..., description="NBA Division")
    featured_star: str = Field(..., min_length=1, description="Franchise marquee player")
    headline_stat: str = Field(..., min_length=1, description="Key season metric")
    last_season_record: str = Field(..., min_length=3, description="Previous season record")
    total_salary: int = Field(..., gt=0, description="Total active payroll in USD")
    tax_status: Literal["Under Cap", "Over Cap", "Luxury Tax", "1st Apron", "2nd Apron"] = Field(..., description="CBA Tax Tier")
    championships: int = Field(..., ge=0, le=50, description="Total championship rings")
    championship_years: List[int] = Field(default_factory=list, description="Championship year archive")
    logo: str = Field(..., min_length=10, description="Vector/high-res logo URL")
    description: str = Field(..., min_length=10, description="Roster overview and team summary")
    starters_2026_27: List[PlayerStat] = Field(..., min_length=5, max_length=5, description="Projected starting five")
    bench_2026_27: List[PlayerStat] = Field(default_factory=list, description="Bench rotation and reserves")

# ==============================================================================
# DATASET
# ==============================================================================
teams = [
    {
        "id": 1,
        "name": "Boston Celtics",
        "conference": "Eastern",
        "division": "Atlantic",
        "featured_star": "Jayson Tatum",
        "headline_stat": "26.8 PPG, 8.4 RPG",
        "last_season_record": "56-26",
        "total_salary": 201437932,
        "tax_status": "Luxury Tax",
        "championships": 18,
        "championship_years": [1957, 1959, 1960, 1961, 1962, 1963, 1964, 1965, 1966, 1968, 1969, 1974, 1976, 1981, 1984, 1986, 2008, 2024],
        "logo": "https://cdn.nba.com/logos/nba/1610612738/primary/L/logo.svg",
        "description": "Retooled Eastern front-runner featuring Jayson Tatum, Derrick White, and newly acquired Paul George alongside Mitchell Robinson.",
        "starters_2026_27": [
            {"name": "Derrick White", "pos": "PG", "pts": 15.2, "reb": 4.2, "ast": 5.1, "stl": 1.0, "blk": 1.3, "tov": 1.5, "fg": 46.1, "fg3": 39.6, "ft": 90.1},
            {"name": "Baylor Scheierman", "pos": "SG", "pts": 6.8, "reb": 2.7, "ast": 1.6, "stl": 0.5, "blk": 0.2, "tov": 0.8, "fg": 42.4, "fg3": 38.2, "ft": 85.0},
            {"name": "Paul George", "pos": "SF", "pts": 18.2, "reb": 5.4, "ast": 4.5, "stl": 1.4, "blk": 0.5, "tov": 2.3, "fg": 44.5, "fg3": 38.8, "ft": 88.5},
            {"name": "Jayson Tatum", "pos": "PF", "pts": 26.8, "reb": 8.4, "ast": 5.4, "stl": 1.1, "blk": 0.6, "tov": 2.5, "fg": 46.5, "fg3": 36.5, "ft": 82.5},
            {"name": "Mitchell Robinson", "pos": "C", "pts": 6.2, "reb": 8.8, "ast": 0.7, "stl": 1.1, "blk": 1.2, "tov": 0.9, "fg": 66.5, "fg3": 0.0, "ft": 42.5}
        ],
        "bench_2026_27": [
            {"name": "Payton Pritchard", "pos": "PG", "pts": 9.6, "reb": 3.2, "ast": 3.4, "stl": 0.5, "blk": 0.1, "tov": 0.8, "fg": 46.8, "fg3": 38.5, "ft": 82.1},
            {"name": "Ron Harper Jr.", "pos": "SG", "pts": 4.5, "reb": 1.6, "ast": 1.1, "stl": 0.4, "blk": 0.2, "tov": 0.6, "fg": 41.2, "fg3": 34.0, "ft": 76.5},
            {"name": "Jordan Walsh", "pos": "SG", "pts": 4.8, "reb": 2.2, "ast": 0.9, "stl": 0.6, "blk": 0.4, "tov": 0.7, "fg": 42.0, "fg3": 33.5, "ft": 75.0},
            {"name": "Hugo González", "pos": "SG", "pts": 5.2, "reb": 2.0, "ast": 1.3, "stl": 0.5, "blk": 0.3, "tov": 0.8, "fg": 43.1, "fg3": 35.0, "ft": 77.2},
            {"name": "Sam Hauser", "pos": "SF", "pts": 9.0, "reb": 3.5, "ast": 1.0, "stl": 0.5, "blk": 0.3, "tov": 0.5, "fg": 44.6, "fg3": 42.4, "ft": 89.5},
            {"name": "Max Shulga", "pos": "SG", "pts": 4.2, "reb": 1.5, "ast": 1.4, "stl": 0.4, "blk": 0.1, "tov": 0.7, "fg": 41.5, "fg3": 36.2, "ft": 81.0},
            {"name": "Mike Conley", "pos": "PG", "pts": 11.4, "reb": 2.9, "ast": 5.9, "stl": 1.2, "blk": 0.2, "tov": 1.3, "fg": 45.7, "fg3": 44.2, "ft": 91.1},
            {"name": "Luka Garza", "pos": "C", "pts": 6.8, "reb": 3.4, "ast": 0.6, "stl": 0.2, "blk": 0.4, "tov": 0.6, "fg": 48.0, "fg3": 32.5, "ft": 78.4},
            {"name": "Amari Williams", "pos": "C", "pts": 3.8, "reb": 4.1, "ast": 0.8, "stl": 0.3, "blk": 1.1, "tov": 0.7, "fg": 56.4, "fg3": 0.0, "ft": 61.5},
            {"name": "Neemias Queta", "pos": "C", "pts": 5.5, "reb": 4.4, "ast": 0.7, "stl": 0.5, "blk": 0.8, "tov": 0.6, "fg": 64.4, "fg3": 0.0, "ft": 71.4},
            {"name": "Chris Cenac Jr.", "pos": "PF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Tucker DeVries", "pos": "SG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Dillon Mitchell", "pos": "SF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Milos Uzan", "pos": "PG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0}
        ]
    },
    {
        "id": 2,
        "name": "Brooklyn Nets",
        "conference": "Eastern",
        "division": "Atlantic",
        "featured_star": "Julius Randle",
        "headline_stat": "23.8 PPG, 9.1 RPG",
        "last_season_record": "20-62",
        "total_salary": 160105139,
        "tax_status": "Under Cap",
        "championships": 0,
        "championship_years": [],
        "logo": "https://cdn.nba.com/logos/nba/1610612751/primary/L/logo.svg",
        "description": "Rebuilding franchise centered around Julius Randle, Michael Porter Jr., Egor Demin, and Moritz Wagner.",
        "starters_2026_27": [
            {"name": "Egor Dëmin", "pos": "PG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Michael Porter Jr.", "pos": "SG", "pts": 17.5, "reb": 7.1, "ast": 1.6, "stl": 0.6, "blk": 0.7, "tov": 1.3, "fg": 48.8, "fg3": 39.8, "ft": 79.2},
            {"name": "Julius Randle", "pos": "SF", "pts": 23.8, "reb": 9.1, "ast": 4.8, "stl": 0.6, "blk": 0.3, "tov": 3.1, "fg": 47.0, "fg3": 31.5, "ft": 76.8},
            {"name": "Day'Ron Sharpe", "pos": "PF", "pts": 7.2, "reb": 6.8, "ast": 1.5, "stl": 0.7, "blk": 0.9, "tov": 1.1, "fg": 58.2, "fg3": 0.0, "ft": 62.5},
            {"name": "Moritz Wagner", "pos": "C", "pts": 10.9, "reb": 4.3, "ast": 1.2, "stl": 0.5, "blk": 0.3, "tov": 1.1, "fg": 52.8, "fg3": 33.0, "ft": 81.0}
        ],
        "bench_2026_27": [
            {"name": "Josh Minott", "pos": "SF", "pts": 3.5, "reb": 2.1, "ast": 0.5, "stl": 0.3, "blk": 0.2, "tov": 0.4, "fg": 44.0, "fg3": 32.0, "ft": 70.0},
            {"name": "Mikel Brown Jr.", "pos": "PG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Danny Wolf", "pos": "PF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Drake Powell", "pos": "SG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Joshua Jefferson", "pos": "PF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Nolan Traore", "pos": "PG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Keon Ellis", "pos": "SG", "pts": 5.4, "reb": 1.7, "ast": 1.0, "stl": 0.9, "blk": 0.4, "tov": 0.5, "fg": 43.1, "fg3": 38.2, "ft": 76.0},
            {"name": "Terance Mann", "pos": "SG", "pts": 8.8, "reb": 3.2, "ast": 1.6, "stl": 0.6, "blk": 0.2, "tov": 0.8, "fg": 51.0, "fg3": 34.8, "ft": 78.0},
            {"name": "Grant Nelson", "pos": "PF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Noah Clowney", "pos": "PF", "pts": 5.8, "reb": 3.5, "ast": 0.8, "stl": 0.3, "blk": 0.7, "tov": 0.6, "fg": 43.5, "fg3": 35.0, "ft": 71.0},
            {"name": "Chaney Johnson", "pos": "SF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Tyler Bilodeau", "pos": "PF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Ben Saraf", "pos": "PG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0}
        ]
    },
    {
        "id": 3,
        "name": "New York Knicks",
        "conference": "Eastern",
        "division": "Atlantic",
        "featured_star": "Jalen Brunson",
        "headline_stat": "26.5 PPG, 7.3 APG",
        "last_season_record": "53-29",
        "total_salary": 217948756,
        "tax_status": "1st Apron",
        "championships": 3,
        "championship_years": [1970, 1973, 2026],
        "logo": "https://cdn.nba.com/logos/nba/1610612752/primary/L/logo.svg",
        "description": "High-powered Manhattan roster boasting Jalen Brunson, Karl-Anthony Towns, Mikal Bridges, and OG Anunoby.",
        "starters_2026_27": [
            {"name": "Jalen Brunson", "pos": "PG", "pts": 26.5, "reb": 3.2, "ast": 7.3, "stl": 0.9, "blk": 0.2, "tov": 2.4, "fg": 48.0, "fg3": 38.5, "ft": 84.0},
            {"name": "Josh Hart", "pos": "SG", "pts": 10.1, "reb": 8.6, "ast": 4.5, "stl": 1.1, "blk": 0.3, "tov": 1.6, "fg": 44.2, "fg3": 31.8, "ft": 79.5},
            {"name": "Mikal Bridges", "pos": "SF", "pts": 18.2, "reb": 4.1, "ast": 3.4, "stl": 1.2, "blk": 0.8, "tov": 1.5, "fg": 44.5, "fg3": 37.8, "ft": 82.0},
            {"name": "OG Anunoby", "pos": "PF", "pts": 15.4, "reb": 4.4, "ast": 1.8, "stl": 1.7, "blk": 0.9, "tov": 1.2, "fg": 49.2, "fg3": 38.6, "ft": 76.0},
            {"name": "Karl-Anthony Towns", "pos": "C", "pts": 24.2, "reb": 11.5, "ast": 3.1, "stl": 0.7, "blk": 0.9, "tov": 2.6, "fg": 51.2, "fg3": 42.0, "ft": 88.0}
        ],
        "bench_2026_27": [
            {"name": "Jack Kayil", "pos": "PG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Tyler Nickel", "pos": "SF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Andre Drummond", "pos": "C", "pts": 8.4, "reb": 9.0, "ast": 0.5, "stl": 0.9, "blk": 0.6, "tov": 1.2, "fg": 55.6, "fg3": 0.0, "ft": 59.0},
            {"name": "Jordan Clarkson", "pos": "SG", "pts": 17.1, "reb": 3.4, "ast": 3.4, "stl": 0.6, "blk": 0.1, "tov": 2.1, "fg": 42.0, "fg3": 35.0, "ft": 88.0},
            {"name": "Miles McBride", "pos": "PG", "pts": 8.3, "reb": 1.5, "ast": 1.7, "stl": 0.6, "blk": 0.1, "tov": 0.6, "fg": 45.2, "fg3": 41.0, "ft": 86.0},
            {"name": "Pacôme Dadiet", "pos": "SF", "pts": 3.2, "reb": 1.1, "ast": 0.4, "stl": 0.2, "blk": 0.1, "tov": 0.4, "fg": 41.0, "fg3": 33.0, "ft": 75.0},
            {"name": "Jose Alvarado", "pos": "PG", "pts": 7.1, "reb": 2.3, "ast": 3.1, "stl": 1.1, "blk": 0.1, "tov": 1.1, "fg": 41.0, "fg3": 36.0, "ft": 82.0},
            {"name": "Kevin McCullar Jr.", "pos": "SG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Tyler Kolek", "pos": "PG", "pts": 3.0, "reb": 1.0, "ast": 1.5, "stl": 0.3, "blk": 0.0, "tov": 0.5, "fg": 40.0, "fg3": 32.0, "ft": 80.0},
            {"name": "Landry Shamet", "pos": "SG", "pts": 7.1, "reb": 1.3, "ast": 1.2, "stl": 0.5, "blk": 0.1, "tov": 0.6, "fg": 43.0, "fg3": 38.0, "ft": 85.0},
            {"name": "Mohamed Diawara", "pos": "SF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0}
        ]
    },
    {
        "id": 4,
        "name": "Philadelphia 76ers",
        "conference": "Eastern",
        "division": "Atlantic",
        "featured_star": "Joel Embiid",
        "headline_stat": "24.9 PPG, 8.5 RPG",
        "last_season_record": "45-37",
        "total_salary": 206643098,
        "tax_status": "Luxury Tax",
        "championships": 3,
        "championship_years": [1955, 1967, 1983],
        "logo": "https://cdn.nba.com/logos/nba/1610612755/primary/L/logo.svg",
        "description": "Powerhouse contender uniting LeBron James and Jaylen Brown alongside franchise pillars Joel Embiid and Tyrese Maxey.",
        "starters_2026_27": [
            {"name": "Tyrese Maxey", "pos": "PG", "pts": 26.3, "reb": 3.6, "ast": 6.1, "stl": 1.1, "blk": 0.8, "tov": 2.2, "fg": 45.4, "fg3": 37.5, "ft": 87.2},
            {"name": "Jaylen Brown", "pos": "SG", "pts": 22.5, "reb": 5.6, "ast": 3.7, "stl": 1.2, "blk": 0.6, "tov": 2.4, "fg": 50.1, "fg3": 35.8, "ft": 71.0},
            {"name": "VJ Edgecombe", "pos": "SF", "pts": 15.2, "reb": 4.8, "ast": 3.4, "stl": 1.3, "blk": 0.6, "tov": 2.0, "fg": 45.6, "fg3": 36.8, "ft": 80.2},
            {"name": "LeBron James", "pos": "PF", "pts": 24.4, "reb": 7.8, "ast": 8.2, "stl": 1.2, "blk": 0.6, "tov": 3.2, "fg": 51.3, "fg3": 37.6, "ft": 78.2},
            {"name": "Joel Embiid", "pos": "C", "pts": 24.9, "reb": 8.5, "ast": 4.5, "stl": 0.9, "blk": 1.6, "tov": 3.0, "fg": 45.4, "fg3": 33.3, "ft": 86.5}
        ],
        "bench_2026_27": [
            {"name": "Labaron Philon", "pos": "PG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Caleb Love", "pos": "SG", "pts": 4.2, "reb": 1.6, "ast": 1.8, "stl": 0.5, "blk": 0.1, "tov": 0.9, "fg": 41.2, "fg3": 34.5, "ft": 79.5},
            {"name": "Kentavious Caldwell-Pope", "pos": "SG", "pts": 9.8, "reb": 2.4, "ast": 1.3, "stl": 1.1, "blk": 0.4, "tov": 0.8, "fg": 43.8, "fg3": 38.6, "ft": 86.2},
            {"name": "Justin Edwards", "pos": "SF", "pts": 5.2, "reb": 2.4, "ast": 1.1, "stl": 0.6, "blk": 0.3, "tov": 0.7, "fg": 42.8, "fg3": 35.1, "ft": 76.5},
            {"name": "MarJon Beauchamp", "pos": "SF", "pts": 4.4, "reb": 2.1, "ast": 0.7, "stl": 0.4, "blk": 0.3, "tov": 0.6, "fg": 41.5, "fg3": 33.0, "ft": 75.0},
            {"name": "Rayan Rupert", "pos": "SG", "pts": 4.0, "reb": 2.3, "ast": 1.6, "stl": 0.6, "blk": 0.2, "tov": 0.8, "fg": 40.5, "fg3": 33.2, "ft": 78.0},
            {"name": "Anfernee Simons", "pos": "PG", "pts": 17.8, "reb": 2.9, "ast": 4.7, "stl": 0.8, "blk": 0.2, "tov": 2.1, "fg": 44.2, "fg3": 38.5, "ft": 89.2},
            {"name": "Tyrese Martin", "pos": "SG", "pts": 3.8, "reb": 1.9, "ast": 0.8, "stl": 0.4, "blk": 0.1, "tov": 0.5, "fg": 40.0, "fg3": 32.5, "ft": 75.0},
            {"name": "Dominick Barlow", "pos": "PF", "pts": 5.6, "reb": 4.1, "ast": 0.9, "stl": 0.5, "blk": 0.7, "tov": 0.6, "fg": 51.5, "fg3": 30.0, "ft": 72.0},
            {"name": "Adem Bona", "pos": "C", "pts": 4.6, "reb": 3.8, "ast": 0.5, "stl": 0.3, "blk": 1.1, "tov": 0.7, "fg": 58.2, "fg3": 0.0, "ft": 66.5},
            {"name": "Dean Wade", "pos": "PF", "pts": 6.4, "reb": 4.2, "ast": 1.1, "stl": 0.7, "blk": 0.4, "tov": 0.6, "fg": 44.0, "fg3": 38.2, "ft": 75.0},
            {"name": "Jabari Walker", "pos": "PF", "pts": 8.2, "reb": 6.5, "ast": 1.0, "stl": 0.6, "blk": 0.4, "tov": 0.9, "fg": 46.5, "fg3": 31.0, "ft": 76.5},
            {"name": "Ariel Hukporti", "pos": "C", "pts": 3.4, "reb": 3.9, "ast": 0.4, "stl": 0.3, "blk": 0.9, "tov": 0.5, "fg": 60.0, "fg3": 0.0, "ft": 62.0},
            {"name": "Tacko Fall", "pos": "C", "pts": 2.8, "reb": 3.1, "ast": 0.2, "stl": 0.1, "blk": 1.2, "tov": 0.4, "fg": 64.0, "fg3": 0.0, "ft": 40.0},
            {"name": "Jameer Nelson Jr.", "pos": "PG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Saint Thomas", "pos": "SF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Duke Miles", "pos": "PG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Dillon Jones", "pos": "SF", "pts": 5.4, "reb": 3.6, "ast": 1.9, "stl": 0.7, "blk": 0.2, "tov": 1.1, "fg": 43.5, "fg3": 32.8, "ft": 77.0}
        ]
    },
    {
        "id": 5,
        "name": "Toronto Raptors",
        "conference": "Eastern",
        "division": "Atlantic",
        "featured_star": "Scottie Barnes",
        "headline_stat": "20.2 PPG, 8.4 RPG, 5.9 APG",
        "last_season_record": "46-36",
        "total_salary": 202743041,
        "tax_status": "Luxury Tax",
        "championships": 1,
        "championship_years": [2019],
        "logo": "https://cdn.nba.com/logos/nba/1610612761/primary/L/logo.svg",
        "description": "Dynamic young Eastern roster built around All-Star forward Scottie Barnes, RJ Barrett, Immanuel Quickley, and Kawhi Leonard.",
        "starters_2026_27": [
            {"name": "Immanuel Quickley", "pos": "PG", "pts": 17.8, "reb": 4.6, "ast": 6.4, "stl": 1.0, "blk": 0.2, "tov": 1.8, "fg": 43.8, "fg3": 39.8, "ft": 84.5},
            {"name": "RJ Barrett", "pos": "SG", "pts": 21.4, "reb": 6.2, "ast": 4.0, "stl": 0.7, "blk": 0.4, "tov": 2.2, "fg": 49.8, "fg3": 39.0, "ft": 63.5},
            {"name": "Kawhi Leonard", "pos": "SF", "pts": 22.8, "reb": 6.0, "ast": 3.4, "stl": 1.6, "blk": 0.8, "tov": 1.7, "fg": 52.0, "fg3": 41.2, "ft": 88.0},
            {"name": "Scottie Barnes", "pos": "PF", "pts": 20.2, "reb": 8.4, "ast": 5.9, "stl": 1.3, "blk": 1.5, "tov": 2.8, "fg": 47.8, "fg3": 34.5, "ft": 78.5},
            {"name": "Jakob Poeltl", "pos": "C", "pts": 11.5, "reb": 8.8, "ast": 2.6, "stl": 0.7, "blk": 1.5, "tov": 1.4, "fg": 65.8, "fg3": 0.0, "ft": 56.0}
        ],
        "bench_2026_27": [
            {"name": "Kyle Anderson", "pos": "F", "pts": 6.4, "reb": 3.5, "ast": 2.5, "stl": 0.8, "blk": 0.6, "tov": 1.1, "fg": 46.0, "fg3": 33.0, "ft": 74.0},
            {"name": "Trey Jemison III", "pos": "C", "pts": 3.5, "reb": 3.2, "ast": 0.4, "stl": 0.3, "blk": 0.8, "tov": 0.6, "fg": 58.0, "fg3": 0.0, "ft": 60.0},
            {"name": "Chucky Hepburn", "pos": "PG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Nate Bittle", "pos": "C", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Jaden Bradley", "pos": "PG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "A.J. Lawson", "pos": "SG", "pts": 3.2, "reb": 1.2, "ast": 0.5, "stl": 0.3, "blk": 0.1, "tov": 0.4, "fg": 41.0, "fg3": 33.0, "ft": 75.0},
            {"name": "Ja'Kobe Walter", "pos": "SG", "pts": 5.5, "reb": 2.0, "ast": 0.9, "stl": 0.4, "blk": 0.1, "tov": 0.6, "fg": 40.0, "fg3": 34.0, "ft": 80.0},
            {"name": "Malachi Smith", "pos": "SG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Allen Graves", "pos": "PF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Jamal Shead", "pos": "PG", "pts": 4.1, "reb": 1.2, "ast": 2.2, "stl": 0.8, "blk": 0.1, "tov": 0.8, "fg": 41.0, "fg3": 31.0, "ft": 76.0},
            {"name": "Collin Murray-Boyles", "pos": "PF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Trayce Jackson-Davis", "pos": "PF", "pts": 7.9, "reb": 5.0, "ast": 1.2, "stl": 0.4, "blk": 1.1, "tov": 0.8, "fg": 60.2, "fg3": 0.0, "ft": 56.0},
            {"name": "Andre Jackson Jr.", "pos": "SG", "pts": 3.2, "reb": 2.1, "ast": 0.9, "stl": 0.5, "blk": 0.2, "tov": 0.5, "fg": 45.0, "fg3": 32.0, "ft": 70.0},
            {"name": "Alijah Martin", "pos": "SG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Jamison Battle", "pos": "SF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0}
        ]
    },
    {
        "id": 6,
        "name": "Chicago Bulls",
        "conference": "Eastern",
        "division": "Central",
        "featured_star": "Josh Giddey",
        "headline_stat": "13.8 PPG, 7.2 RPG, 5.8 APG",
        "last_season_record": "31-51",
        "total_salary": 161545080,
        "tax_status": "Under Cap",
        "championships": 6,
        "championship_years": [1991, 1992, 1993, 1996, 1997, 1998],
        "logo": "https://cdn.nba.com/logos/nba/1610612741/primary/L/logo.svg",
        "description": "Transitioning core featuring Josh Giddey, Matas Buzelis, Nic Claxton, and veteran Norman Powell.",
        "starters_2026_27": [
            {"name": "Josh Giddey", "pos": "PG", "pts": 13.8, "reb": 7.2, "ast": 5.8, "stl": 0.9, "blk": 0.6, "tov": 2.6, "fg": 48.0, "fg3": 34.5, "ft": 81.2},
            {"name": "Norman Powell", "pos": "SG", "pts": 14.2, "reb": 2.8, "ast": 1.3, "stl": 0.8, "blk": 0.3, "tov": 1.4, "fg": 48.8, "fg3": 43.8, "ft": 83.5},
            {"name": "Matas Buzelis", "pos": "SF", "pts": 12.4, "reb": 4.6, "ast": 1.5, "stl": 0.8, "blk": 1.5, "tov": 1.3, "fg": 46.0, "fg3": 35.3, "ft": 79.5},
            {"name": "Patrick Williams", "pos": "PF", "pts": 10.0, "reb": 4.1, "ast": 1.6, "stl": 0.9, "blk": 0.8, "tov": 1.2, "fg": 44.3, "fg3": 39.9, "ft": 78.8},
            {"name": "Nic Claxton", "pos": "C", "pts": 11.5, "reb": 9.6, "ast": 2.0, "stl": 0.6, "blk": 1.1, "tov": 1.3, "fg": 63.2, "fg3": 20.0, "ft": 56.0}
        ],
        "bench_2026_27": [
            {"name": "Rob Dillingham", "pos": "PG", "pts": 9.6, "reb": 3.0, "ast": 2.8, "stl": 0.9, "blk": 0.1, "tov": 2.1, "fg": 42.8, "fg3": 30.0, "ft": 74.3},
            {"name": "Caleb Wilson", "pos": "PF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Leonard Miller", "pos": "PF", "pts": 6.2, "reb": 3.8, "ast": 0.9, "stl": 0.6, "blk": 0.4, "tov": 0.8, "fg": 48.5, "fg3": 33.3, "ft": 75.0},
            {"name": "Zach Collins", "pos": "C", "pts": 11.2, "reb": 5.4, "ast": 2.8, "stl": 0.5, "blk": 0.8, "tov": 1.8, "fg": 48.4, "fg3": 32.0, "ft": 74.7},
            {"name": "Noa Essengue", "pos": "SF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.5, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Jalen Smith", "pos": "C", "pts": 9.9, "reb": 5.5, "ast": 1.0, "stl": 0.3, "blk": 0.6, "tov": 0.9, "fg": 59.2, "fg3": 42.4, "ft": 69.2},
            {"name": "Tre Jones", "pos": "PG", "pts": 10.0, "reb": 3.8, "ast": 6.2, "stl": 1.0, "blk": 0.1, "tov": 1.5, "fg": 50.5, "fg3": 33.5, "ft": 85.6},
            {"name": "Isaac Okoro", "pos": "SF", "pts": 9.4, "reb": 3.0, "ast": 1.9, "stl": 0.8, "blk": 0.5, "tov": 0.9, "fg": 49.0, "fg3": 39.1, "ft": 67.9},
            {"name": "Dailyn Swain", "pos": "SF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Tobe Awaka", "pos": "PF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Jaylin Sellers", "pos": "SG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0}
        ]
    },
    {
        "id": 7,
        "name": "Cleveland Cavaliers",
        "conference": "Eastern",
        "division": "Central",
        "featured_star": "Donovan Mitchell",
        "headline_stat": "26.2 PPG, 5.8 APG",
        "last_season_record": "52-30",
        "total_salary": 222920753,
        "tax_status": "2nd Apron",
        "championships": 1,
        "championship_years": [2016],
        "logo": "https://cdn.nba.com/logos/nba/1610612739/primary/L/logo.svg",
        "description": "Perennial Eastern heavyweight equipped with Donovan Mitchell, James Harden, Evan Mobley, and Jarrett Allen.",
        "starters_2026_27": [
            {"name": "James Harden", "pos": "PG", "pts": 16.8, "reb": 5.2, "ast": 8.4, "stl": 1.2, "blk": 0.6, "tov": 2.9, "fg": 43.0, "fg3": 38.5, "ft": 88.0},
            {"name": "Donovan Mitchell", "pos": "SG", "pts": 26.2, "reb": 5.0, "ast": 5.8, "stl": 1.5, "blk": 0.4, "tov": 2.8, "fg": 46.5, "fg3": 37.0, "ft": 86.8},
            {"name": "Peyton Watson", "pos": "SF", "pts": 7.8, "reb": 3.6, "ast": 1.4, "stl": 0.7, "blk": 1.1, "tov": 0.9, "fg": 47.5, "fg3": 31.5, "ft": 68.0},
            {"name": "Evan Mobley", "pos": "PF", "pts": 17.2, "reb": 9.6, "ast": 3.4, "stl": 0.9, "blk": 1.8, "tov": 1.8, "fg": 58.2, "fg3": 37.8, "ft": 72.5},
            {"name": "Jarrett Allen", "pos": "C", "pts": 16.2, "reb": 10.4, "ast": 2.5, "stl": 0.7, "blk": 1.7, "tov": 1.5, "fg": 63.8, "fg3": 0.0, "ft": 74.5}
        ],
        "bench_2026_27": [
            {"name": "Thomas Bryant", "pos": "C", "pts": 6.5, "reb": 4.1, "ast": 0.7, "stl": 0.3, "blk": 0.4, "tov": 0.7, "fg": 55.0, "fg3": 32.0, "ft": 75.0},
            {"name": "Sam Merrill", "pos": "SG", "pts": 6.0, "reb": 1.8, "ast": 1.4, "stl": 0.5, "blk": 0.1, "tov": 0.5, "fg": 41.0, "fg3": 40.0, "ft": 88.0},
            {"name": "Craig Porter Jr.", "pos": "PG", "pts": 4.3, "reb": 1.9, "ast": 2.3, "stl": 0.6, "blk": 0.3, "tov": 0.8, "fg": 45.0, "fg3": 31.0, "ft": 76.0},
            {"name": "Riley Minix", "pos": "SF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Meleek Thomas", "pos": "SG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Khalifa Diop", "pos": "C", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Jaylon Tyson", "pos": "SG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Tristan Enaruna", "pos": "SF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Tyrese Proctor", "pos": "PG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Mario Hezonja", "pos": "SF", "pts": 8.5, "reb": 3.2, "ast": 1.2, "stl": 0.6, "blk": 0.2, "tov": 1.0, "fg": 44.0, "fg3": 36.0, "ft": 78.0},
            {"name": "Nae'Qwan Tomlin", "pos": "PF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Ernest Udeh, Jr.", "pos": "C", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0}
        ]
    },
    {
        "id": 8,
        "name": "Detroit Pistons",
        "conference": "Eastern",
        "division": "Central",
        "featured_star": "Cade Cunningham",
        "headline_stat": "23.4 PPG, 7.8 APG",
        "last_season_record": "60-22",
        "total_salary": 153163826,
        "tax_status": "Under Cap",
        "championships": 3,
        "championship_years": [1989, 1990, 2004],
        "logo": "https://cdn.nba.com/logos/nba/1610612765/primary/L/logo.svg",
        "description": "Rising core powered by Cade Cunningham, Ausar Thompson, John Collins, and center Jalen Duren.",
        "starters_2026_27": [
            {"name": "Cade Cunningham", "pos": "PG", "pts": 23.4, "reb": 4.5, "ast": 7.8, "stl": 1.0, "blk": 0.8, "tov": 3.4, "fg": 45.2, "fg3": 36.0, "ft": 87.2},
            {"name": "Duncan Robinson", "pos": "SG", "pts": 11.8, "reb": 2.4, "ast": 2.6, "stl": 0.6, "blk": 0.2, "tov": 1.1, "fg": 44.8, "fg3": 39.2, "ft": 88.5},
            {"name": "Ausar Thompson", "pos": "SF", "pts": 9.8, "reb": 6.9, "ast": 2.4, "stl": 1.4, "blk": 1.8, "tov": 1.5, "fg": 49.2, "fg3": 21.8, "ft": 62.5},
            {"name": "John Collins", "pos": "PF", "pts": 14.8, "reb": 8.2, "ast": 1.2, "stl": 0.6, "blk": 0.7, "tov": 1.4, "fg": 53.5, "fg3": 37.4, "ft": 80.0},
            {"name": "Jalen Duren", "pos": "C", "pts": 14.2, "reb": 11.8, "ast": 2.6, "stl": 0.6, "blk": 0.8, "tov": 1.9, "fg": 62.4, "fg3": 0.0, "ft": 79.5}
        ],
        "bench_2026_27": [
            {"name": "Ugonna Onyenso", "pos": "C", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Ebuka Okorie", "pos": "SG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Isaac Jones", "pos": "PF", "pts": 3.8, "reb": 2.4, "ast": 0.5, "stl": 0.3, "blk": 0.4, "tov": 0.5, "fg": 51.0, "fg3": 25.0, "ft": 68.0},
            {"name": "Ronald Holland II", "pos": "SF", "pts": 6.2, "reb": 2.8, "ast": 1.1, "stl": 0.7, "blk": 0.4, "tov": 1.0, "fg": 43.0, "fg3": 24.0, "ft": 69.0},
            {"name": "Paul Reed", "pos": "PF", "pts": 4.8, "reb": 4.1, "ast": 0.8, "stl": 0.8, "blk": 0.6, "tov": 0.7, "fg": 52.0, "fg3": 28.0, "ft": 66.0},
            {"name": "Isaiah Joe", "pos": "SG", "pts": 9.2, "reb": 2.3, "ast": 1.3, "stl": 0.8, "blk": 0.2, "tov": 0.7, "fg": 44.5, "fg3": 41.2, "ft": 86.0},
            {"name": "Gary Harris", "pos": "SG", "pts": 6.8, "reb": 1.7, "ast": 1.2, "stl": 0.9, "blk": 0.2, "tov": 0.6, "fg": 44.0, "fg3": 37.1, "ft": 77.0},
            {"name": "Taurean Prince", "pos": "SF", "pts": 8.9, "reb": 2.9, "ast": 1.5, "stl": 0.7, "blk": 0.4, "tov": 0.8, "fg": 44.2, "fg3": 39.5, "ft": 81.0},
            {"name": "Wendell Moore Jr.", "pos": "SG", "pts": 2.1, "reb": 1.1, "ast": 0.6, "stl": 0.3, "blk": 0.1, "tov": 0.4, "fg": 39.0, "fg3": 31.0, "ft": 70.0},
            {"name": "Elijah Harkless", "pos": "SG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Chaz Lanier", "pos": "SG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Daniss Jenkins", "pos": "PG", "pts": 3.1, "reb": 1.2, "ast": 1.8, "stl": 0.4, "blk": 0.1, "tov": 0.6, "fg": 41.0, "fg3": 33.0, "ft": 75.0},
            {"name": "Kevin Huerter", "pos": "SG", "pts": 10.5, "reb": 3.4, "ast": 2.6, "stl": 0.9, "blk": 0.4, "tov": 1.1, "fg": 44.0, "fg3": 36.5, "ft": 78.0},
            {"name": "Javonte Green", "pos": "SG", "pts": 6.4, "reb": 3.2, "ast": 0.7, "stl": 0.9, "blk": 0.4, "tov": 0.5, "fg": 52.0, "fg3": 33.0, "ft": 74.0},
            {"name": "Tolu Smith", "pos": "C", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0}
        ]
    },
    {
        "id": 9,
        "name": "Indiana Pacers",
        "conference": "Eastern",
        "division": "Central",
        "featured_star": "Tyrese Haliburton",
        "headline_stat": "18.5 PPG, 9.2 APG",
        "last_season_record": "19-63",
        "total_salary": 203715395,
        "tax_status": "Luxury Tax",
        "championships": 0,
        "championship_years": [],
        "logo": "https://cdn.nba.com/logos/nba/1610612754/primary/L/logo.svg",
        "description": "High-octane transition offense directed by Tyrese Haliburton alongside Pascal Siakam and Ivica Zubac.",
        "starters_2026_27": [
            {"name": "Tyrese Haliburton", "pos": "PG", "pts": 18.5, "reb": 3.8, "ast": 9.2, "stl": 1.4, "blk": 0.6, "tov": 2.3, "fg": 46.0, "fg3": 35.5, "ft": 85.0},
            {"name": "Andrew Nembhard", "pos": "SG", "pts": 10.2, "reb": 2.4, "ast": 4.6, "stl": 0.9, "blk": 0.2, "tov": 1.4, "fg": 50.2, "fg3": 36.2, "ft": 81.0},
            {"name": "Aaron Nesmith", "pos": "SF", "pts": 12.6, "reb": 3.9, "ast": 1.6, "stl": 1.0, "blk": 0.4, "tov": 1.1, "fg": 49.8, "fg3": 42.1, "ft": 78.5},
            {"name": "Pascal Siakam", "pos": "PF", "pts": 21.2, "reb": 7.0, "ast": 4.2, "stl": 0.9, "blk": 0.4, "tov": 1.9, "fg": 53.8, "fg3": 38.8, "ft": 73.5},
            {"name": "Ivica Zubac", "pos": "C", "pts": 12.4, "reb": 9.8, "ast": 1.5, "stl": 0.4, "blk": 1.3, "tov": 1.3, "fg": 65.2, "fg3": 0.0, "ft": 72.8}
        ],
        "bench_2026_27": [
            {"name": "Obi Toppin", "pos": "PF", "pts": 10.3, "reb": 3.9, "ast": 1.6, "stl": 0.6, "blk": 0.4, "tov": 0.8, "fg": 57.0, "fg3": 40.3, "ft": 77.0},
            {"name": "Braden Smith", "pos": "PG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Jarace Walker", "pos": "PF", "pts": 3.6, "reb": 1.9, "ast": 1.2, "stl": 0.4, "blk": 0.3, "tov": 0.5, "fg": 40.9, "fg3": 33.0, "ft": 68.0},
            {"name": "T.J. McConnell", "pos": "PG", "pts": 10.2, "reb": 2.7, "ast": 5.5, "stl": 1.0, "blk": 0.1, "tov": 1.3, "fg": 55.6, "fg3": 40.9, "ft": 79.0},
            {"name": "Kelly Oubre Jr.", "pos": "SF", "pts": 15.4, "reb": 5.0, "ast": 1.5, "stl": 1.1, "blk": 0.3, "tov": 1.2, "fg": 44.1, "fg3": 31.1, "ft": 75.0},
            {"name": "Johnny Furphy", "pos": "SG", "pts": 5.8, "reb": 2.8, "ast": 1.0, "stl": 0.4, "blk": 0.2, "tov": 0.5, "fg": 45.2, "fg3": 35.2, "ft": 77.0},
            {"name": "Jalen Slawson", "pos": "SF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Larry Nance Jr.", "pos": "PF", "pts": 5.7, "reb": 5.0, "ast": 1.9, "stl": 0.8, "blk": 0.4, "tov": 0.7, "fg": 57.3, "fg3": 41.5, "ft": 75.0},
            {"name": "Kobe Brown", "pos": "PF", "pts": 2.0, "reb": 1.4, "ast": 0.6, "stl": 0.3, "blk": 0.2, "tov": 0.4, "fg": 41.0, "fg3": 31.0, "ft": 70.0},
            {"name": "Ben Sheppard", "pos": "SG", "pts": 4.4, "reb": 1.6, "ast": 0.9, "stl": 0.5, "blk": 0.1, "tov": 0.4, "fg": 42.2, "fg3": 31.4, "ft": 78.0},
            {"name": "Quenton Jackson", "pos": "SG", "pts": 2.5, "reb": 0.8, "ast": 0.7, "stl": 0.4, "blk": 0.1, "tov": 0.4, "fg": 48.0, "fg3": 33.0, "ft": 80.0},
            {"name": "Jay Huff", "pos": "C", "pts": 3.8, "reb": 1.7, "ast": 0.3, "stl": 0.1, "blk": 0.7, "tov": 0.3, "fg": 58.0, "fg3": 41.0, "ft": 75.0}
        ]
    },
    {
        "id": 10,
        "name": "Milwaukee Bucks",
        "conference": "Eastern",
        "division": "Central",
        "featured_star": "Tyler Herro",
        "headline_stat": "21.2 PPG, 5.4 RPG",
        "last_season_record": "32-50",
        "total_salary": 191358866,
        "tax_status": "Over Cap",
        "championships": 2,
        "championship_years": [1971, 2021],
        "logo": "https://cdn.nba.com/logos/nba/1610612749/primary/L/logo.svg",
        "description": "Restructured lineup commanded by Ryan Rollins, Myles Turner, Tyler Herro, and Jaime Jaquez Jr.",
        "starters_2026_27": [
            {"name": "Ryan Rollins", "pos": "PG", "pts": 6.8, "reb": 2.1, "ast": 2.4, "stl": 0.7, "blk": 0.2, "tov": 1.0, "fg": 43.5, "fg3": 36.8, "ft": 78.5},
            {"name": "Tyler Herro", "pos": "SG", "pts": 21.2, "reb": 5.4, "ast": 4.6, "stl": 0.8, "blk": 0.2, "tov": 2.2, "fg": 44.5, "fg3": 39.8, "ft": 86.0},
            {"name": "Jaime Jaquez Jr.", "pos": "SF", "pts": 12.5, "reb": 4.2, "ast": 2.8, "stl": 1.1, "blk": 0.3, "tov": 1.5, "fg": 49.5, "fg3": 33.5, "ft": 82.5},
            {"name": "Kyle Kuzma", "pos": "PF", "pts": 21.8, "reb": 6.4, "ast": 4.0, "stl": 0.5, "blk": 0.7, "tov": 2.5, "fg": 46.0, "fg3": 33.2, "ft": 77.0},
            {"name": "Myles Turner", "pos": "C", "pts": 16.8, "reb": 6.8, "ast": 1.4, "stl": 0.6, "blk": 1.6, "tov": 1.4, "fg": 52.8, "fg3": 36.2, "ft": 77.8}
        ],
        "bench_2026_27": [
            {"name": "Malique Lewis", "pos": "SF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Nate Ament", "pos": "SF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Brayden Burries", "pos": "SG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Jericho Sims", "pos": "C", "pts": 2.0, "reb": 3.3, "ast": 0.6, "stl": 0.2, "blk": 0.4, "tov": 0.4, "fg": 65.0, "fg3": 0.0, "ft": 55.0},
            {"name": "Gary Trent Jr.", "pos": "SG", "pts": 13.7, "reb": 2.6, "ast": 1.7, "stl": 1.1, "blk": 0.2, "tov": 0.9, "fg": 42.0, "fg3": 39.0, "ft": 84.0},
            {"name": "Kevin Porter Jr.", "pos": "SG", "pts": 14.5, "reb": 4.5, "ast": 4.9, "stl": 1.1, "blk": 0.3, "tov": 2.6, "fg": 43.0, "fg3": 34.0, "ft": 77.0},
            {"name": "Kam Jones", "pos": "SG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Caris LeVert", "pos": "SG", "pts": 14.0, "reb": 4.1, "ast": 4.2, "stl": 1.1, "blk": 0.3, "tov": 1.8, "fg": 43.1, "fg3": 34.2, "ft": 76.5},
            {"name": "Kel'el Ware", "pos": "C", "pts": 7.4, "reb": 5.6, "ast": 0.9, "stl": 0.4, "blk": 1.1, "tov": 0.8, "fg": 55.0, "fg3": 33.0, "ft": 68.0},
            {"name": "John Butler Jr.", "pos": "C", "pts": 2.1, "reb": 1.5, "ast": 0.2, "stl": 0.2, "blk": 0.5, "tov": 0.3, "fg": 42.0, "fg3": 30.0, "ft": 70.0},
            {"name": "AJ Green", "pos": "SG", "pts": 4.5, "reb": 1.1, "ast": 0.6, "stl": 0.3, "blk": 0.1, "tov": 0.3, "fg": 42.0, "fg3": 40.5, "ft": 85.0},
            {"name": "Ousmane Dieng", "pos": "SF", "pts": 4.0, "reb": 2.2, "ast": 1.1, "stl": 0.4, "blk": 0.2, "tov": 0.7, "fg": 41.0, "fg3": 33.0, "ft": 74.0},
            {"name": "Bogoljub Marković", "pos": "PF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Kasparas Jakučionis", "pos": "PG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Cormac Ryan", "pos": "SG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Pete Nance", "pos": "PF", "pts": 1.8, "reb": 1.2, "ast": 0.3, "stl": 0.1, "blk": 0.2, "tov": 0.3, "fg": 42.0, "fg3": 31.0, "ft": 70.0}
        ]
    },
    {
        "id": 11,
        "name": "Miami Heat",
        "conference": "Eastern",
        "division": "Southeast",
        "featured_star": "Giannis Antetokounmpo",
        "headline_stat": "30.4 PPG, 11.9 RPG, 6.1 APG",
        "last_season_record": "43-39",
        "total_salary": 204486535,
        "tax_status": "Luxury Tax",
        "championships": 3,
        "championship_years": [2006, 2012, 2013],
        "logo": "https://cdn.nba.com/logos/nba/1610612748/primary/L/logo.svg",
        "description": "Championship front-runner after landing superstar Giannis Antetokounmpo to join Bam Adebayo and Jimmy Butler.",
        "starters_2026_27": [
            {"name": "Davion Mitchell", "pos": "PG", "pts": 6.4, "reb": 1.6, "ast": 2.7, "stl": 0.8, "blk": 0.2, "tov": 0.9, "fg": 46.0, "fg3": 37.2, "ft": 74.0},
            {"name": "Tim Hardaway Jr.", "pos": "SG", "pts": 13.8, "reb": 3.0, "ast": 1.6, "stl": 0.5, "blk": 0.1, "tov": 1.0, "fg": 40.0, "fg3": 35.0, "ft": 85.0},
            {"name": "Andrew Wiggins", "pos": "SF", "pts": 13.0, "reb": 4.4, "ast": 1.6, "stl": 0.9, "blk": 1.0, "tov": 1.4, "fg": 45.0, "fg3": 35.5, "ft": 75.0},
            {"name": "Giannis Antetokounmpo", "pos": "PF", "pts": 30.4, "reb": 11.9, "ast": 6.1, "stl": 1.2, "blk": 1.1, "tov": 3.4, "fg": 60.1, "fg3": 24.5, "ft": 61.8},
            {"name": "Bam Adebayo", "pos": "C", "pts": 19.4, "reb": 10.6, "ast": 4.1, "stl": 1.2, "blk": 0.9, "tov": 2.3, "fg": 52.4, "fg3": 35.8, "ft": 75.8}
        ],
        "bench_2026_27": [
            {"name": "J'Vonne Hadley", "pos": "SF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Simone Fontecchio", "pos": "SF", "pts": 7.8, "reb": 3.2, "ast": 1.1, "stl": 0.5, "blk": 0.2, "tov": 0.6, "fg": 44.0, "fg3": 37.0, "ft": 80.0},
            {"name": "Trevor Keels", "pos": "SG", "pts": 2.0, "reb": 1.0, "ast": 0.5, "stl": 0.2, "blk": 0.1, "tov": 0.4, "fg": 38.0, "fg3": 30.0, "ft": 70.0},
            {"name": "Ryan Conwell", "pos": "SG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Nikola Jović", "pos": "PF", "pts": 7.6, "reb": 4.2, "ast": 2.0, "stl": 0.5, "blk": 0.3, "tov": 1.1, "fg": 46.0, "fg3": 38.0, "ft": 75.0},
            {"name": "Nick Richards", "pos": "C", "pts": 7.2, "reb": 5.8, "ast": 0.6, "stl": 0.4, "blk": 1.1, "tov": 0.9, "fg": 65.0, "fg3": 0.0, "ft": 70.0},
            {"name": "Pelle Larsson", "pos": "SG", "pts": 4.5, "reb": 1.8, "ast": 1.2, "stl": 0.5, "blk": 0.2, "tov": 0.6, "fg": 43.0, "fg3": 34.0, "ft": 78.0},
            {"name": "Klay Thompson", "pos": "SG", "pts": 17.5, "reb": 3.3, "ast": 2.3, "stl": 0.6, "blk": 0.4, "tov": 1.5, "fg": 43.2, "fg3": 38.7, "ft": 90.0},
            {"name": "Dru Smith", "pos": "PG", "pts": 3.1, "reb": 1.5, "ast": 1.6, "stl": 0.8, "blk": 0.2, "tov": 0.6, "fg": 41.0, "fg3": 35.0, "ft": 78.0},
            {"name": "Myron Gardner", "pos": "SF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Keshad Johnson", "pos": "PF", "pts": 3.0, "reb": 2.0, "ast": 0.5, "stl": 0.4, "blk": 0.2, "tov": 0.4, "fg": 45.0, "fg3": 32.0, "ft": 70.0},
            {"name": "Jahmir Young", "pos": "PG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Tre Donaldson", "pos": "PG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Vladislav Goldin", "pos": "C", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Bobby Portis Jr.", "pos": "PF", "pts": 13.8, "reb": 7.4, "ast": 1.3, "stl": 0.8, "blk": 0.4, "tov": 1.1, "fg": 49.0, "fg3": 38.0, "ft": 78.0}
        ]
    },
    {
        "id": 12,
        "name": "Atlanta Hawks",
        "conference": "Eastern",
        "division": "Southeast",
        "featured_star": "Jalen Johnson",
        "headline_stat": "17.5 PPG, 9.1 RPG, 4.4 APG",
        "last_season_record": "46-36",
        "total_salary": 221278253,
        "tax_status": "1st Apron",
        "championships": 1,
        "championship_years": [1958],
        "logo": "https://cdn.nba.com/logos/nba/1610612737/primary/L/logo.svg",
        "description": "Athletic retool driven by Dyson Daniels, Jalen Johnson, Onyeka Okongwu, and veteran C.J. McCollum.",
        "starters_2026_27": [
            {"name": "C.J. McCollum", "pos": "PG", "pts": 18.8, "reb": 4.1, "ast": 4.4, "stl": 0.9, "blk": 0.5, "tov": 1.7, "fg": 45.5, "fg3": 42.5, "ft": 82.0},
            {"name": "Nickeil Alexander-Walker", "pos": "SG", "pts": 8.8, "reb": 2.2, "ast": 2.6, "stl": 0.9, "blk": 0.5, "tov": 1.0, "fg": 44.2, "fg3": 39.5, "ft": 80.5},
            {"name": "Dyson Daniels", "pos": "SF", "pts": 9.5, "reb": 5.4, "ast": 4.3, "stl": 2.4, "blk": 0.8, "tov": 1.8, "fg": 46.8, "fg3": 34.2, "ft": 70.5},
            {"name": "Jalen Johnson", "pos": "PF", "pts": 17.5, "reb": 9.1, "ast": 4.4, "stl": 1.3, "blk": 0.9, "tov": 2.5, "fg": 52.0, "fg3": 36.1, "ft": 74.0},
            {"name": "Onyeka Okongwu", "pos": "C", "pts": 10.6, "reb": 7.1, "ast": 1.4, "stl": 0.6, "blk": 1.1, "tov": 1.0, "fg": 61.5, "fg3": 33.5, "ft": 79.5}
        ],
        "bench_2026_27": [
            {"name": "Keshon Gilbert", "pos": "PG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "RayJ Dennis", "pos": "PG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Keaton Wallace", "pos": "SG", "pts": 2.5, "reb": 0.9, "ast": 0.9, "stl": 0.4, "blk": 0.1, "tov": 0.4, "fg": 42.0, "fg3": 33.0, "ft": 75.0},
            {"name": "Gabe Vincent", "pos": "PG", "pts": 6.1, "reb": 1.1, "ast": 1.6, "stl": 0.5, "blk": 0.1, "tov": 0.6, "fg": 39.0, "fg3": 32.5, "ft": 80.0},
            {"name": "Kingston Flemings", "pos": "PG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Luguentz Dort", "pos": "SG", "pts": 10.9, "reb": 3.6, "ast": 1.4, "stl": 0.9, "blk": 0.6, "tov": 1.1, "fg": 43.2, "fg3": 39.4, "ft": 82.6},
            {"name": "Buddy Hield", "pos": "SG", "pts": 12.1, "reb": 3.2, "ast": 1.8, "stl": 0.6, "blk": 0.3, "tov": 1.2, "fg": 43.0, "fg3": 38.5, "ft": 84.0},
            {"name": "Ryan Nembhard", "pos": "PG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Henri Veesaar", "pos": "C", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Tony Bradley", "pos": "C", "pts": 3.5, "reb": 3.4, "ast": 0.4, "stl": 0.2, "blk": 0.4, "tov": 0.5, "fg": 58.0, "fg3": 0.0, "ft": 65.0},
            {"name": "Asa Newell", "pos": "PF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Mouhamed Gueye", "pos": "PF", "pts": 2.4, "reb": 2.1, "ast": 0.3, "stl": 0.3, "blk": 0.4, "tov": 0.4, "fg": 43.0, "fg3": 28.0, "ft": 65.0},
            {"name": "Zuby Ejiofor", "pos": "PF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Aaron Wiggins", "pos": "SG", "pts": 6.9, "reb": 2.4, "ast": 1.1, "stl": 0.6, "blk": 0.3, "tov": 0.6, "fg": 50.1, "fg3": 39.2, "ft": 77.0},
            {"name": "Jalen Wilson", "pos": "SF", "pts": 5.3, "reb": 2.0, "ast": 0.7, "stl": 0.3, "blk": 0.1, "tov": 0.5, "fg": 42.4, "fg3": 32.4, "ft": 82.0},
            {"name": "Corey Kispert", "pos": "SF", "pts": 11.0, "reb": 2.7, "ast": 1.2, "stl": 0.5, "blk": 0.2, "tov": 0.7, "fg": 48.0, "fg3": 38.3, "ft": 83.5},
            {"name": "Jock Landale", "pos": "C", "pts": 4.9, "reb": 3.1, "ast": 0.8, "stl": 0.3, "blk": 0.4, "tov": 0.5, "fg": 49.0, "fg3": 31.0, "ft": 78.0}
        ]
    },
    {
        "id": 13,
        "name": "Charlotte Hornets",
        "conference": "Eastern",
        "division": "Southeast",
        "featured_star": "Brandon Miller",
        "headline_stat": "18.5 PPG, 4.6 RPG",
        "last_season_record": "44-38",
        "total_salary": 174870647,
        "tax_status": "Over Cap",
        "championships": 0,
        "championship_years": [],
        "logo": "https://cdn.nba.com/logos/nba/1610612766/primary/L/logo.svg",
        "description": "Revamped perimeter group featuring Brandon Miller, Coby White, and stretch big Naz Reid.",
        "starters_2026_27": [
            {"name": "Coby White", "pos": "PG", "pts": 18.8, "reb": 4.4, "ast": 4.9, "stl": 0.7, "blk": 0.2, "tov": 2.1, "fg": 44.5, "fg3": 37.2, "ft": 83.5},
            {"name": "Kon Knueppel", "pos": "SG", "pts": 13.5, "reb": 3.9, "ast": 2.6, "stl": 0.8, "blk": 0.3, "tov": 1.2, "fg": 47.1, "fg3": 41.2, "ft": 88.5},
            {"name": "Brandon Miller", "pos": "SF", "pts": 18.5, "reb": 4.6, "ast": 2.8, "stl": 1.0, "blk": 0.6, "tov": 1.9, "fg": 45.2, "fg3": 38.0, "ft": 83.5},
            {"name": "Naz Reid", "pos": "PF", "pts": 13.8, "reb": 5.4, "ast": 1.4, "stl": 0.8, "blk": 1.0, "tov": 1.4, "fg": 48.0, "fg3": 41.8, "ft": 74.0},
            {"name": "Moussa Diabaté", "pos": "C", "pts": 5.2, "reb": 6.4, "ast": 0.8, "stl": 0.6, "blk": 1.0, "tov": 0.7, "fg": 59.5, "fg3": 0.0, "ft": 64.2}
        ],
        "bench_2026_27": [
            {"name": "Michael Ajayi", "pos": "SG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Kylan Boswell", "pos": "PG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Royce O'Neale", "pos": "PF", "pts": 7.7, "reb": 4.8, "ast": 2.8, "stl": 0.8, "blk": 0.6, "tov": 0.9, "fg": 41.0, "fg3": 38.2, "ft": 81.0},
            {"name": "Dorian Finney-Smith", "pos": "SF", "pts": 8.5, "reb": 4.7, "ast": 1.6, "stl": 0.8, "blk": 0.6, "tov": 0.8, "fg": 42.5, "fg3": 34.8, "ft": 74.0},
            {"name": "Grant Williams", "pos": "PF", "pts": 8.1, "reb": 3.6, "ast": 1.7, "stl": 0.5, "blk": 0.4, "tov": 0.9, "fg": 48.0, "fg3": 38.0, "ft": 76.5},
            {"name": "Sion James", "pos": "SG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Christian Anderson", "pos": "PG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Grayson Allen", "pos": "SG", "pts": 13.5, "reb": 3.9, "ast": 3.0, "stl": 0.9, "blk": 0.3, "tov": 1.1, "fg": 46.5, "fg3": 46.1, "ft": 87.8},
            {"name": "Dennis Schröder", "pos": "PG", "pts": 14.0, "reb": 3.0, "ast": 6.0, "stl": 0.9, "blk": 0.2, "tov": 2.2, "fg": 44.0, "fg3": 37.5, "ft": 85.0},
            {"name": "Ryan Kalkbrenner", "pos": "C", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Antonio Reeves", "pos": "SG", "pts": 3.2, "reb": 1.0, "ast": 0.4, "stl": 0.2, "blk": 0.1, "tov": 0.3, "fg": 42.0, "fg3": 39.0, "ft": 80.0},
            {"name": "PJ Hall", "pos": "C", "pts": 2.5, "reb": 1.5, "ast": 0.3, "stl": 0.2, "blk": 0.4, "tov": 0.4, "fg": 48.0, "fg3": 31.0, "ft": 75.0},
            {"name": "Pat Connaughton", "pos": "SG", "pts": 5.4, "reb": 3.1, "ast": 1.2, "stl": 0.5, "blk": 0.2, "tov": 0.5, "fg": 43.0, "fg3": 35.0, "ft": 76.0},
            {"name": "Bez Mbeng", "pos": "SG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Hannes Steinbach", "pos": "PF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Xavier Tillman", "pos": "PF", "pts": 3.5, "reb": 2.7, "ast": 1.0, "stl": 0.7, "blk": 0.5, "tov": 0.5, "fg": 48.0, "fg3": 25.0, "ft": 65.0},
            {"name": "Tidjane Salaün", "pos": "PF", "pts": 5.5, "reb": 4.1, "ast": 0.8, "stl": 0.4, "blk": 0.3, "tov": 0.8, "fg": 38.0, "fg3": 31.0, "ft": 70.0},
            {"name": "Liam McNeeley", "pos": "SF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0}
        ]
    },
    {
        "id": 14,
        "name": "Orlando Magic",
        "conference": "Eastern",
        "division": "Southeast",
        "featured_star": "Paolo Banchero",
        "headline_stat": "23.5 PPG, 7.2 RPG, 5.8 APG",
        "last_season_record": "45-37",
        "total_salary": 218125071,
        "tax_status": "1st Apron",
        "championships": 0,
        "championship_years": [],
        "logo": "https://cdn.nba.com/logos/nba/1610612753/primary/L/logo.svg",
        "description": "Elite defensive squad with forward versatility led by Paolo Banchero and Franz Wagner.",
        "starters_2026_27": [
            {"name": "Jalen Suggs", "pos": "PG", "pts": 13.4, "reb": 3.4, "ast": 3.2, "stl": 1.5, "blk": 0.6, "tov": 1.9, "fg": 47.5, "fg3": 40.1, "ft": 76.8},
            {"name": "Desmond Bane", "pos": "SG", "pts": 22.8, "reb": 4.5, "ast": 5.2, "stl": 1.1, "blk": 0.5, "tov": 2.4, "fg": 46.0, "fg3": 37.8, "ft": 86.5},
            {"name": "Franz Wagner", "pos": "SF", "pts": 20.4, "reb": 5.6, "ast": 4.0, "stl": 1.2, "blk": 0.4, "tov": 1.9, "fg": 48.8, "fg3": 30.5, "ft": 85.8},
            {"name": "Paolo Banchero", "pos": "PF", "pts": 23.5, "reb": 7.2, "ast": 5.8, "stl": 0.9, "blk": 0.6, "tov": 3.1, "fg": 46.2, "fg3": 34.8, "ft": 73.5},
            {"name": "Wendell Carter Jr.", "pos": "C", "pts": 11.2, "reb": 7.1, "ast": 1.8, "stl": 0.6, "blk": 1.7, "tov": 1.3, "fg": 52.8, "fg3": 37.6, "ft": 70.0}
        ],
        "bench_2026_27": [
            {"name": "Anthony Black", "pos": "PG", "pts": 4.5, "reb": 2.0, "ast": 2.2, "stl": 0.7, "blk": 0.3, "tov": 0.9, "fg": 45.0, "fg3": 31.0, "ft": 70.0},
            {"name": "Jonathan Isaac", "pos": "PF", "pts": 6.8, "reb": 4.5, "ast": 0.5, "stl": 0.8, "blk": 1.2, "tov": 0.7, "fg": 50.0, "fg3": 37.0, "ft": 72.0},
            {"name": "Jevon Carter", "pos": "PG", "pts": 5.0, "reb": 1.3, "ast": 1.4, "stl": 0.7, "blk": 0.2, "tov": 0.5, "fg": 40.0, "fg3": 35.0, "ft": 80.0},
            {"name": "JD Davison", "pos": "PG", "pts": 3.0, "reb": 1.0, "ast": 1.5, "stl": 0.4, "blk": 0.1, "tov": 0.6, "fg": 41.0, "fg3": 32.0, "ft": 75.0},
            {"name": "Malaki Branham", "pos": "SG", "pts": 7.8, "reb": 2.0, "ast": 1.2, "stl": 0.4, "blk": 0.1, "tov": 0.9, "fg": 43.0, "fg3": 35.0, "ft": 80.0},
            {"name": "Jamal Cain", "pos": "SF", "pts": 4.5, "reb": 2.5, "ast": 0.4, "stl": 0.4, "blk": 0.2, "tov": 0.4, "fg": 48.0, "fg3": 33.0, "ft": 75.0},
            {"name": "Nikola Vučević", "pos": "C", "pts": 18.0, "reb": 10.5, "ast": 3.3, "stl": 0.7, "blk": 0.8, "tov": 1.5, "fg": 51.0, "fg3": 35.0, "ft": 82.0},
            {"name": "Jase Richardson", "pos": "SG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Colin Castleton", "pos": "C", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Tristan da Silva", "pos": "SF", "pts": 6.5, "reb": 3.0, "ast": 1.0, "stl": 0.5, "blk": 0.3, "tov": 0.6, "fg": 47.0, "fg3": 36.0, "ft": 78.0},
            {"name": "Izaiyah Nelson", "pos": "PF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Alex Morales", "pos": "SG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Goga Bitadze", "pos": "C", "pts": 5.0, "reb": 4.5, "ast": 1.0, "stl": 0.5, "blk": 1.0, "tov": 0.7, "fg": 55.0, "fg3": 25.0, "ft": 70.0},
            {"name": "Noah Penda", "pos": "SF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0}
        ]
    },
    {
        "id": 15,
        "name": "Washington Wizards",
        "conference": "Eastern",
        "division": "Southeast",
        "featured_star": "Trae Young",
        "headline_stat": "24.5 PPG, 11.6 APG",
        "last_season_record": "17-65",
        "total_salary": 189013104,
        "tax_status": "Over Cap",
        "championships": 1,
        "championship_years": [1978],
        "logo": "https://cdn.nba.com/logos/nba/1610612764/primary/L/logo.svg",
        "description": "Revitalized attack featuring elite playmaker Trae Young, rim protector Anthony Davis, and Alex Sarr.",
        "starters_2026_27": [
            {"name": "Trae Young", "pos": "PG", "pts": 24.5, "reb": 3.1, "ast": 11.6, "stl": 1.3, "blk": 0.2, "tov": 4.1, "fg": 42.5, "fg3": 36.0, "ft": 86.5},
            {"name": "Kyshawn George", "pos": "SG", "pts": 9.8, "reb": 3.6, "ast": 2.5, "stl": 0.9, "blk": 0.5, "tov": 1.3, "fg": 42.8, "fg3": 36.5, "ft": 78.5},
            {"name": "Bilal Coulibaly", "pos": "SF", "pts": 8.4, "reb": 4.1, "ast": 1.7, "stl": 0.9, "blk": 0.8, "tov": 1.1, "fg": 43.5, "fg3": 34.6, "ft": 75.0},
            {"name": "Alex Sarr", "pos": "PF", "pts": 12.5, "reb": 6.8, "ast": 2.1, "stl": 0.7, "blk": 1.8, "tov": 1.5, "fg": 42.8, "fg3": 31.5, "ft": 72.0},
            {"name": "Anthony Davis", "pos": "C", "pts": 25.4, "reb": 12.1, "ast": 3.2, "stl": 1.2, "blk": 2.3, "tov": 2.1, "fg": 54.2, "fg3": 30.0, "ft": 80.5}
        ],
        "bench_2026_27": [
            {"name": "Felix Okpara", "pos": "C", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Tristan Vukcevic", "pos": "PF", "pts": 4.5, "reb": 2.1, "ast": 0.5, "stl": 0.2, "blk": 0.4, "tov": 0.6, "fg": 43.0, "fg3": 34.0, "ft": 70.0},
            {"name": "AJ Dybantsa", "pos": "SF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Jamir Watkins", "pos": "SF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Deandre Ayton", "pos": "C", "pts": 14.5, "reb": 10.2, "ast": 1.6, "stl": 0.6, "blk": 1.0, "tov": 1.5, "fg": 57.0, "fg3": 10.0, "ft": 73.0},
            {"name": "Bub Carrington", "pos": "PG", "pts": 6.8, "reb": 2.4, "ast": 3.1, "stl": 0.5, "blk": 0.2, "tov": 1.4, "fg": 40.0, "fg3": 32.5, "ft": 78.0},
            {"name": "Justin Champagnie", "pos": "SF", "pts": 3.0, "reb": 2.0, "ast": 0.4, "stl": 0.4, "blk": 0.2, "tov": 0.3, "fg": 45.0, "fg3": 33.0, "ft": 72.0},
            {"name": "Tre Johnson", "pos": "SG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Sharife Cooper", "pos": "PG", "pts": 2.5, "reb": 1.0, "ast": 2.0, "stl": 0.3, "blk": 0.0, "tov": 0.8, "fg": 38.0, "fg3": 28.0, "ft": 75.0},
            {"name": "Anthony Gill", "pos": "PF", "pts": 3.5, "reb": 1.9, "ast": 0.6, "stl": 0.3, "blk": 0.2, "tov": 0.4, "fg": 48.0, "fg3": 31.0, "ft": 78.0},
            {"name": "Khris Middleton", "pos": "SF", "pts": 15.0, "reb": 4.2, "ast": 4.5, "stl": 0.9, "blk": 0.2, "tov": 2.0, "fg": 46.0, "fg3": 37.5, "ft": 89.0},
            {"name": "Tre Mann", "pos": "SG", "pts": 9.5, "reb": 2.2, "ast": 2.8, "stl": 0.8, "blk": 0.2, "tov": 1.2, "fg": 44.0, "fg3": 36.0, "ft": 81.0},
            {"name": "Will Riley", "pos": "SF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0}
        ]
    },
    {
        "id": 16,
        "name": "Denver Nuggets",
        "conference": "Western",
        "division": "Northwest",
        "featured_star": "Nikola Jokić",
        "headline_stat": "29.6 PPG, 12.8 RPG, 10.2 APG",
        "last_season_record": "54-28",
        "total_salary": 215333328,
        "tax_status": "1st Apron",
        "championships": 1,
        "championship_years": [2023],
        "logo": "https://cdn.nba.com/logos/nba/1610612743/primary/L/logo.svg",
        "description": "Championship contender orchestrated by 3-time MVP Nikola Jokic, Jamal Murray, and DeMar DeRozan.",
        "starters_2026_27": [
            {"name": "Jamal Murray", "pos": "PG", "pts": 20.8, "reb": 4.0, "ast": 6.2, "stl": 1.0, "blk": 0.6, "tov": 2.1, "fg": 47.8, "fg3": 41.8, "ft": 85.0},
            {"name": "Christian Braun", "pos": "SG", "pts": 8.9, "reb": 4.2, "ast": 2.0, "stl": 0.8, "blk": 0.5, "tov": 0.8, "fg": 47.8, "fg3": 39.5, "ft": 72.0},
            {"name": "DeMar DeRozan", "pos": "SF", "pts": 24.0, "reb": 4.3, "ast": 5.3, "stl": 1.1, "blk": 0.4, "tov": 2.0, "fg": 48.0, "fg3": 33.0, "ft": 85.0},
            {"name": "Aaron Gordon", "pos": "PF", "pts": 14.2, "reb": 6.6, "ast": 3.6, "stl": 0.8, "blk": 0.6, "tov": 1.5, "fg": 55.8, "fg3": 29.5, "ft": 66.2},
            {"name": "Nikola Jokić", "pos": "C", "pts": 29.6, "reb": 12.8, "ast": 10.2, "stl": 1.5, "blk": 0.8, "tov": 3.2, "fg": 57.6, "fg3": 41.2, "ft": 80.5}
        ],
        "bench_2026_27": [
            {"name": "Trevon Brazile", "pos": "PF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Bryce Hopkins", "pos": "PF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Alpha Diallo", "pos": "SF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Curtis Jones", "pos": "SG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Julian Strawther", "pos": "SG", "pts": 5.8, "reb": 1.8, "ast": 0.9, "stl": 0.4, "blk": 0.2, "tov": 0.6, "fg": 43.0, "fg3": 36.0, "ft": 80.0},
            {"name": "Tyus Jones", "pos": "PG", "pts": 10.0, "reb": 2.7, "ast": 7.3, "stl": 1.0, "blk": 0.1, "tov": 1.0, "fg": 49.0, "fg3": 38.0, "ft": 87.0},
            {"name": "Bruce Brown", "pos": "SG", "pts": 10.8, "reb": 4.2, "ast": 3.1, "stl": 1.1, "blk": 0.5, "tov": 1.4, "fg": 47.8, "fg3": 35.8, "ft": 75.0},
            {"name": "DaRon Holmes II", "pos": "PF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Lonnie Walker IV", "pos": "SG", "pts": 9.8, "reb": 2.2, "ast": 1.3, "stl": 0.5, "blk": 0.3, "tov": 0.9, "fg": 42.5, "fg3": 36.0, "ft": 78.0},
            {"name": "Spencer Jones", "pos": "SF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Zeke Nnaji", "pos": "C", "pts": 3.2, "reb": 2.4, "ast": 0.4, "stl": 0.2, "blk": 0.4, "tov": 0.4, "fg": 46.0, "fg3": 28.0, "ft": 70.0},
            {"name": "Cameron Johnson", "pos": "SF", "pts": 13.6, "reb": 4.3, "ast": 2.5, "stl": 0.8, "blk": 0.4, "tov": 0.9, "fg": 44.8, "fg3": 39.4, "ft": 79.2},
            {"name": "KJ Simpson", "pos": "PG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Marvin Bagley III", "pos": "PF", "pts": 10.2, "reb": 6.1, "ast": 0.9, "stl": 0.5, "blk": 0.6, "tov": 1.1, "fg": 53.0, "fg3": 29.0, "ft": 70.0},
            {"name": "David Roddy", "pos": "SF", "pts": 4.5, "reb": 2.8, "ast": 0.8, "stl": 0.4, "blk": 0.2, "tov": 0.6, "fg": 41.0, "fg3": 30.0, "ft": 68.0}
        ]
    },
    {
        "id": 17,
        "name": "Minnesota Timberwolves",
        "conference": "Western",
        "division": "Northwest",
        "featured_star": "Anthony Edwards",
        "headline_stat": "27.2 PPG, 5.7 RPG, 5.1 APG",
        "last_season_record": "49-33",
        "total_salary": 215871829,
        "tax_status": "1st Apron",
        "championships": 0,
        "championship_years": [],
        "logo": "https://cdn.nba.com/logos/nba/1610612750/primary/L/logo.svg",
        "description": "Star-loaded contender pairing superstar Anthony Edwards with LaMelo Ball and Jonathan Kuminga.",
        "starters_2026_27": [
            {"name": "LaMelo Ball", "pos": "PG", "pts": 23.5, "reb": 5.0, "ast": 7.8, "stl": 1.4, "blk": 0.3, "tov": 3.5, "fg": 43.0, "fg3": 35.2, "ft": 86.0},
            {"name": "Anthony Edwards", "pos": "SG", "pts": 27.2, "reb": 5.7, "ast": 5.1, "stl": 1.4, "blk": 0.8, "tov": 3.1, "fg": 46.5, "fg3": 40.2, "ft": 84.5},
            {"name": "Jaden McDaniels", "pos": "SF", "pts": 11.4, "reb": 3.5, "ast": 1.7, "stl": 1.0, "blk": 1.0, "tov": 1.2, "fg": 49.5, "fg3": 35.0, "ft": 74.0},
            {"name": "Jonathan Kuminga", "pos": "PF", "pts": 16.8, "reb": 5.2, "ast": 2.5, "stl": 0.8, "blk": 0.6, "tov": 1.8, "fg": 53.4, "fg3": 33.0, "ft": 75.8},
            {"name": "Rudy Gobert", "pos": "C", "pts": 13.8, "reb": 12.7, "ast": 1.2, "stl": 0.6, "blk": 1.6, "tov": 1.5, "fg": 65.8, "fg3": 0.0, "ft": 63.5}
        ],
        "bench_2026_27": [
            {"name": "Donte DiVincenzo", "pos": "SG", "pts": 15.5, "reb": 3.7, "ast": 3.5, "stl": 1.3, "blk": 0.3, "tov": 1.5, "fg": 44.0, "fg3": 39.5, "ft": 77.0},
            {"name": "Terance Shannon Jr", "pos": "SG", "pts": 5.5, "reb": 1.8, "ast": 0.9, "stl": 0.5, "blk": 0.2, "tov": 0.7, "fg": 43.0, "fg3": 33.0, "ft": 75.0},
            {"name": "Cody Williams", "pos": "SF", "pts": 5.2, "reb": 2.1, "ast": 1.0, "stl": 0.5, "blk": 0.4, "tov": 0.8, "fg": 40.0, "fg3": 30.0, "ft": 70.0},
            {"name": "Jaylen Clark", "pos": "SG", "pts": 2.0, "reb": 1.0, "ast": 0.5, "stl": 0.6, "blk": 0.1, "tov": 0.3, "fg": 41.0, "fg3": 31.0, "ft": 65.0},
            {"name": "Bones Hyland", "pos": "PG", "pts": 8.5, "reb": 1.7, "ast": 2.2, "stl": 0.7, "blk": 0.1, "tov": 1.2, "fg": 40.5, "fg3": 35.0, "ft": 81.0},
            {"name": "Ayo Dosunmu", "pos": "SG", "pts": 12.2, "reb": 2.8, "ast": 3.2, "stl": 1.0, "blk": 0.5, "tov": 1.1, "fg": 50.1, "fg3": 40.3, "ft": 81.0},
            {"name": "Trey Kaufman-Renn", "pos": "PF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Zyon Pullin", "pos": "PG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Joan Beringer", "pos": "PF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Enrique Freeman", "pos": "PF", "pts": 1.5, "reb": 1.8, "ast": 0.2, "stl": 0.1, "blk": 0.2, "tov": 0.3, "fg": 50.0, "fg3": 0.0, "ft": 60.0},
            {"name": "Isaiah Evans", "pos": "SF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Trey Lyles", "pos": "PF", "pts": 7.2, "reb": 4.4, "ast": 1.2, "stl": 0.5, "blk": 0.3, "tov": 0.7, "fg": 44.5, "fg3": 38.4, "ft": 76.5},
            {"name": "Rocco Zikarsky", "pos": "C", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0}
        ]
    },
    {
        "id": 18,
        "name": "Oklahoma City Thunder",
        "conference": "Western",
        "division": "Northwest",
        "featured_star": "Shai Gilgeous-Alexander",
        "headline_stat": "32.7 PPG, 6.4 APG, 1.8 SPG",
        "last_season_record": "64-18",
        "total_salary": 214798992,
        "tax_status": "1st Apron",
        "championships": 2,
        "championship_years": [1979, 2025],
        "logo": "https://cdn.nba.com/logos/nba/1610612760/primary/L/logo.svg",
        "description": "Championship favorite led by Shai Gilgeous-Alexander, Chet Holmgren, and Jalen Williams.",
        "starters_2026_27": [
            {"name": "Shai Gilgeous-Alexander", "pos": "PG", "pts": 32.7, "reb": 5.0, "ast": 6.4, "stl": 1.8, "blk": 0.8, "tov": 2.2, "fg": 51.9, "fg3": 37.5, "ft": 89.8},
            {"name": "Cason Wallace", "pos": "SG", "pts": 8.2, "reb": 2.8, "ast": 2.1, "stl": 1.2, "blk": 0.5, "tov": 0.7, "fg": 50.2, "fg3": 42.5, "ft": 80.0},
            {"name": "Jalen Williams", "pos": "SF", "pts": 19.8, "reb": 4.3, "ast": 4.8, "stl": 1.3, "blk": 0.7, "tov": 1.9, "fg": 54.5, "fg3": 43.1, "ft": 82.0},
            {"name": "Chet Holmgren", "pos": "PF", "pts": 17.4, "reb": 8.4, "ast": 2.7, "stl": 0.7, "blk": 1.9, "tov": 1.7, "fg": 53.8, "fg3": 37.8, "ft": 80.5},
            {"name": "Isaiah Hartenstein", "pos": "C", "pts": 8.2, "reb": 8.6, "ast": 2.6, "stl": 1.0, "blk": 1.1, "tov": 1.2, "fg": 64.8, "fg3": 33.3, "ft": 71.0}
        ],
        "bench_2026_27": [
            {"name": "Josh Dix", "pos": "SG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Jared McCain", "pos": "SG", "pts": 13.5, "reb": 2.5, "ast": 1.8, "stl": 0.8, "blk": 0.2, "tov": 1.1, "fg": 44.0, "fg3": 39.0, "ft": 85.0},
            {"name": "Jaylin Williams", "pos": "PF", "pts": 4.5, "reb": 3.4, "ast": 1.6, "stl": 0.5, "blk": 0.4, "tov": 0.7, "fg": 43.0, "fg3": 36.0, "ft": 72.0},
            {"name": "Alex Caruso", "pos": "SG", "pts": 10.1, "reb": 3.1, "ast": 3.5, "stl": 1.7, "blk": 1.0, "tov": 1.1, "fg": 46.8, "fg3": 40.8, "ft": 79.0},
            {"name": "Thomas Sorber", "pos": "C", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Otega Oweh", "pos": "SG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Bennett Stirtz", "pos": "PG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Aday Mara", "pos": "C", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Brooks Barnhizer", "pos": "SG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Ajay Mitchell", "pos": "PG", "pts": 5.2, "reb": 1.1, "ast": 1.5, "stl": 0.5, "blk": 0.1, "tov": 0.6, "fg": 46.0, "fg3": 36.0, "ft": 78.0},
            {"name": "Kenrich Williams", "pos": "SF", "pts": 4.7, "reb": 3.0, "ast": 1.3, "stl": 0.6, "blk": 0.3, "tov": 0.5, "fg": 46.0, "fg3": 36.5, "ft": 70.0},
            {"name": "Nikola Topić", "pos": "PG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0}
        ]
    },
    {
        "id": 19,
        "name": "Portland Trail Blazers",
        "conference": "Western",
        "division": "Northwest",
        "featured_star": "Ja Morant",
        "headline_stat": "24.6 PPG, 7.8 APG",
        "last_season_record": "42-40",
        "total_salary": 194511148,
        "tax_status": "Over Cap",
        "championships": 1,
        "championship_years": [1977],
        "logo": "https://cdn.nba.com/logos/nba/1610612757/primary/L/logo.svg",
        "description": "Explosive backcourt unit featuring Ja Morant, Damian Lillard, Deni Avdija, Jrue Holiday, and center Donovan Clingan.",
        "starters_2026_27": [
            {"name": "Damian Lillard", "pos": "PG", "pts": 23.8, "reb": 4.2, "ast": 6.8, "stl": 0.9, "blk": 0.2, "tov": 2.5, "fg": 42.8, "fg3": 35.8, "ft": 92.2},
            {"name": "Ja Morant", "pos": "SG", "pts": 24.6, "reb": 5.4, "ast": 7.8, "stl": 1.1, "blk": 0.3, "tov": 3.0, "fg": 46.8, "fg3": 28.0, "ft": 81.0},
            {"name": "Deni Avdija", "pos": "SF", "pts": 15.4, "reb": 7.6, "ast": 4.1, "stl": 0.9, "blk": 0.5, "tov": 2.1, "fg": 51.2, "fg3": 38.0, "ft": 75.2},
            {"name": "Jeremy Sochan", "pos": "PF", "pts": 11.6, "reb": 6.4, "ast": 3.4, "stl": 0.8, "blk": 0.5, "tov": 1.6, "fg": 46.5, "fg3": 31.0, "ft": 71.0},
            {"name": "Donovan Clingan", "pos": "C", "pts": 9.2, "reb": 8.1, "ast": 1.4, "stl": 0.5, "blk": 1.7, "tov": 1.3, "fg": 59.5, "fg3": 25.0, "ft": 60.0}
        ],
        "bench_2026_27": [
            {"name": "Jayson Kent", "pos": "SF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Scoot Henderson", "pos": "PG", "pts": 14.0, "reb": 3.1, "ast": 5.4, "stl": 0.9, "blk": 0.2, "tov": 3.1, "fg": 38.5, "fg3": 32.0, "ft": 81.0},
            {"name": "Blake Wesley", "pos": "SG", "pts": 4.5, "reb": 1.5, "ast": 1.8, "stl": 0.6, "blk": 0.1, "tov": 1.0, "fg": 41.0, "fg3": 30.0, "ft": 72.0},
            {"name": "Chris Youngblood", "pos": "SG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Jrue Holiday", "pos": "PG", "pts": 12.5, "reb": 3.6, "ast": 4.8, "stl": 1.2, "blk": 0.5, "tov": 1.5, "fg": 48.0, "fg3": 38.0, "ft": 83.0},
            {"name": "John Tonje", "pos": "SG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Micah Potter", "pos": "C", "pts": 3.5, "reb": 2.5, "ast": 0.5, "stl": 0.2, "blk": 0.4, "tov": 0.4, "fg": 47.0, "fg3": 36.0, "ft": 75.0},
            {"name": "Branden Carlson", "pos": "C", "pts": 2.5, "reb": 1.8, "ast": 0.4, "stl": 0.1, "blk": 0.5, "tov": 0.3, "fg": 45.0, "fg3": 33.0, "ft": 70.0},
            {"name": "Yang Hansen", "pos": "C", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Shaedon Sharpe", "pos": "SG", "pts": 15.9, "reb": 4.1, "ast": 2.3, "stl": 0.9, "blk": 0.4, "tov": 1.8, "fg": 45.2, "fg3": 36.5, "ft": 76.0},
            {"name": "Vít Krejčí", "pos": "PG", "pts": 4.2, "reb": 1.5, "ast": 2.1, "stl": 0.5, "blk": 0.1, "tov": 0.6, "fg": 44.0, "fg3": 39.0, "ft": 75.0},
            {"name": "Toumani Camara", "pos": "SF", "pts": 8.6, "reb": 5.4, "ast": 1.6, "stl": 1.2, "blk": 0.5, "tov": 1.1, "fg": 46.2, "fg3": 35.0, "ft": 77.5},
            {"name": "Robert Williams III", "pos": "C", "pts": 10.0, "reb": 6.9, "ast": 1.2, "stl": 0.9, "blk": 2.1, "tov": 1.0, "fg": 68.0, "fg3": 0.0, "ft": 63.0},
            {"name": "Sidy Cissoko", "pos": "SG", "pts": 2.0, "reb": 1.2, "ast": 0.8, "stl": 0.3, "blk": 0.2, "tov": 0.5, "fg": 39.0, "fg3": 28.0, "ft": 65.0}
        ]
    },
    {
        "id": 20,
        "name": "Utah Jazz",
        "conference": "Western",
        "division": "Northwest",
        "featured_star": "Lauri Markkanen",
        "headline_stat": "22.8 PPG, 8.0 RPG",
        "last_season_record": "22-60",
        "total_salary": 179365019,
        "tax_status": "Over Cap",
        "championships": 0,
        "championship_years": [],
        "logo": "https://cdn.nba.com/logos/nba/1610612762/primary/L/logo.svg",
        "description": "Floor-spacing lineup keyed by Lauri Markkanen, Keyonte George, and defensive anchor Jusuf Nurkic.",
        "starters_2026_27": [
            {"name": "Keyonte George", "pos": "PG", "pts": 14.5, "reb": 3.2, "ast": 5.2, "stl": 0.7, "blk": 0.2, "tov": 2.5, "fg": 40.8, "fg3": 34.9, "ft": 79.2},
            {"name": "Josh Green", "pos": "SG", "pts": 8.2, "reb": 3.2, "ast": 2.3, "stl": 0.8, "blk": 0.2, "tov": 1.1, "fg": 47.9, "fg3": 38.5, "ft": 75.5},
            {"name": "Lauri Markkanen", "pos": "SF", "pts": 22.8, "reb": 8.0, "ast": 2.1, "stl": 0.8, "blk": 0.6, "tov": 1.4, "fg": 47.8, "fg3": 39.5, "ft": 89.5},
            {"name": "Jaren Jackson Jr.", "pos": "PF", "pts": 22.2, "reb": 5.4, "ast": 2.2, "stl": 1.2, "blk": 1.8, "tov": 2.1, "fg": 44.8, "fg3": 32.5, "ft": 81.2},
            {"name": "Jusuf Nurkić", "pos": "C", "pts": 10.6, "reb": 10.8, "ast": 3.8, "stl": 1.0, "blk": 1.1, "tov": 2.1, "fg": 50.8, "fg3": 24.0, "ft": 63.8}
        ],
        "bench_2026_27": [
            {"name": "Hayden Gray", "pos": "G", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Kyle Filipowski", "pos": "C", "pts": 7.4, "reb": 5.8, "ast": 1.8, "stl": 0.4, "blk": 0.9, "tov": 0.9, "fg": 52.5, "fg3": 29.0, "ft": 71.5},
            {"name": "Blake Hinson", "pos": "F", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Tamar Bates", "pos": "G", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Isaiah Collier", "pos": "PG", "pts": 8.3, "reb": 2.7, "ast": 4.1, "stl": 0.8, "blk": 0.1, "tov": 1.3, "fg": 44.2, "fg3": 34.8, "ft": 80.5},
            {"name": "Svi Mykhailiuk", "pos": "G-F", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Jaxson Hayes", "pos": "C", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Mo Bamba", "pos": "C", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Ace Bailey", "pos": "G-F", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Josh Okogie", "pos": "G", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Darron Peterson", "pos": "G", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Trey Alexander", "pos": "G", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Brice Sensabaugh", "pos": "F", "pts": 7.6, "reb": 3.2, "ast": 0.9, "stl": 0.5, "blk": 0.3, "tov": 0.7, "fg": 45.8, "fg3": 35.5, "ft": 76.0},
            {"name": "Harrison Ingram", "pos": "F", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0}
        ]
    },
    {
        "id": 21,
        "name": "Golden State Warriors",
        "conference": "Western",
        "division": "Pacific",
        "featured_star": "Stephen Curry",
        "headline_stat": "24.2 PPG, 6.1 APG",
        "last_season_record": "37-45",
        "total_salary": 219763627,
        "tax_status": "1st Apron",
        "championships": 7,
        "championship_years": [1947, 1956, 1975, 2015, 2017, 2018, 2022],
        "logo": "https://cdn.nba.com/logos/nba/1610612744/primary/L/logo.svg",
        "description": "Veteran championship contender orchestrated by Stephen Curry, Draymond Green, Jimmy Butler, and Kristaps Porzingis.",
        "starters_2026_27": [
            {"name": "Stephen Curry", "pos": "PG", "pts": 24.2, "reb": 4.4, "ast": 6.1, "stl": 0.8, "blk": 0.4, "tov": 2.7, "fg": 44.8, "fg3": 39.8, "ft": 92.5},
            {"name": "Brandin Podziemski", "pos": "SG", "pts": 11.5, "reb": 6.2, "ast": 4.4, "stl": 1.0, "blk": 0.2, "tov": 1.4, "fg": 46.8, "fg3": 39.4, "ft": 68.0},
            {"name": "Jimmy Butler", "pos": "SF", "pts": 20.2, "reb": 5.1, "ast": 4.8, "stl": 1.4, "blk": 0.4, "tov": 1.6, "fg": 49.5, "fg3": 41.0, "ft": 85.5},
            {"name": "Draymond Green", "pos": "PF", "pts": 8.4, "reb": 7.0, "ast": 5.8, "stl": 1.0, "blk": 0.9, "tov": 2.1, "fg": 49.2, "fg3": 39.0, "ft": 72.5},
            {"name": "Kristaps Porziņģis", "pos": "C", "pts": 19.8, "reb": 7.0, "ast": 1.9, "stl": 0.6, "blk": 1.8, "tov": 1.6, "fg": 51.2, "fg3": 37.2, "ft": 85.5}
        ],
        "bench_2026_27": [
            {"name": "Gary Payton II", "pos": "SG", "pts": 5.5, "reb": 2.6, "ast": 1.1, "stl": 0.9, "blk": 0.3, "tov": 0.5, "fg": 53.0, "fg3": 36.0, "ft": 65.0},
            {"name": "Yaxel Lendeborg", "pos": "PF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Will Richard", "pos": "SG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Moses Moody", "pos": "SG", "pts": 8.1, "reb": 2.5, "ast": 0.9, "stl": 0.6, "blk": 0.4, "tov": 0.6, "fg": 46.2, "fg3": 36.0, "ft": 78.5},
            {"name": "De'Anthony Melton", "pos": "SG", "pts": 11.1, "reb": 3.7, "ast": 3.0, "stl": 1.6, "blk": 0.5, "tov": 1.3, "fg": 40.0, "fg3": 36.0, "ft": 79.0},
            {"name": "Brandon Williams", "pos": "PG", "pts": 3.5, "reb": 1.0, "ast": 1.2, "stl": 0.4, "blk": 0.1, "tov": 0.6, "fg": 40.0, "fg3": 32.0, "ft": 75.0},
            {"name": "Gui Santos", "pos": "SF", "pts": 3.6, "reb": 2.1, "ast": 0.6, "stl": 0.3, "blk": 0.1, "tov": 0.4, "fg": 50.0, "fg3": 34.0, "ft": 70.0},
            {"name": "LJ Cryer", "pos": "PG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Nate Williams", "pos": "SG", "pts": 2.8, "reb": 1.2, "ast": 0.4, "stl": 0.3, "blk": 0.1, "tov": 0.3, "fg": 45.0, "fg3": 33.0, "ft": 70.0},
            {"name": "Al Horford", "pos": "C", "pts": 8.5, "reb": 6.2, "ast": 2.5, "stl": 0.6, "blk": 1.0, "tov": 0.8, "fg": 51.0, "fg3": 41.0, "ft": 80.0},
            {"name": "Dalen Terry", "pos": "SF", "pts": 3.1, "reb": 1.9, "ast": 1.1, "stl": 0.5, "blk": 0.2, "tov": 0.5, "fg": 42.0, "fg3": 30.0, "ft": 72.0},
            {"name": "Alex Toohey", "pos": "SF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Lajae Jones", "pos": "SG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Charles Bassey", "pos": "C", "pts": 3.5, "reb": 4.0, "ast": 0.5, "stl": 0.3, "blk": 0.8, "tov": 0.5, "fg": 60.0, "fg3": 0.0, "ft": 60.0},
            {"name": "Seth Curry", "pos": "SG", "pts": 5.1, "reb": 1.2, "ast": 0.9, "stl": 0.3, "blk": 0.1, "tov": 0.4, "fg": 45.0, "fg3": 41.0, "ft": 90.0},
            {"name": "Georges Niang", "pos": "PF", "pts": 8.5, "reb": 3.4, "ast": 1.0, "stl": 0.3, "blk": 0.2, "tov": 0.6, "fg": 45.0, "fg3": 38.0, "ft": 85.0},
            {"name": "Malevy Leons", "pos": "PF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0}
        ]
    },
    {
        "id": 22,
        "name": "LA Clippers",
        "conference": "Western",
        "division": "Pacific",
        "featured_star": "Darius Garland",
        "headline_stat": "18.4 PPG, 6.8 APG",
        "last_season_record": "42-40",
        "total_salary": 196862414,
        "tax_status": "Over Cap",
        "championships": 0,
        "championship_years": [],
        "logo": "https://cdn.nba.com/logos/nba/1610612746/primary/L/logo.svg",
        "description": "Disciplined Western squad leaning into Darius Garland, Brandon Ingram, Gradey Dick, and center Brook Lopez.",
        "starters_2026_27": [
            {"name": "Kris Dunn", "pos": "PG", "pts": 5.6, "reb": 3.0, "ast": 4.0, "stl": 1.5, "blk": 0.4, "tov": 1.2, "fg": 47.5, "fg3": 37.2, "ft": 69.2},
            {"name": "Darius Garland", "pos": "SG", "pts": 18.4, "reb": 2.8, "ast": 6.8, "stl": 1.1, "blk": 0.1, "tov": 2.4, "fg": 44.8, "fg3": 37.5, "ft": 83.8},
            {"name": "Brandon Ingram", "pos": "SF", "pts": 20.4, "reb": 5.0, "ast": 5.6, "stl": 0.9, "blk": 0.6, "tov": 2.4, "fg": 49.0, "fg3": 35.2, "ft": 80.5},
            {"name": "Rui Hachimura", "pos": "PF", "pts": 13.4, "reb": 4.2, "ast": 1.3, "stl": 0.5, "blk": 0.3, "tov": 1.0, "fg": 53.4, "fg3": 42.0, "ft": 74.2},
            {"name": "Brook Lopez", "pos": "C", "pts": 12.2, "reb": 5.0, "ast": 1.5, "stl": 0.5, "blk": 1.2, "tov": 1.0, "fg": 48.2, "fg3": 36.2, "ft": 82.5}
        ],
        "bench_2026_27": [
            {"name": "Gradey Dick", "pos": "SG", "pts": 10.5, "reb": 2.2, "ast": 1.1, "stl": 0.5, "blk": 0.2, "tov": 0.8, "fg": 42.5, "fg3": 36.5, "ft": 85.0},
            {"name": "Norchad Omier", "pos": "PF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Baba Miller", "pos": "PF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Nick Martinelli", "pos": "SF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Narcisse Ngoy", "pos": "C", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Bradley Beal", "pos": "SG", "pts": 18.2, "reb": 3.3, "ast": 4.0, "stl": 1.0, "blk": 0.4, "tov": 2.0, "fg": 47.0, "fg3": 38.0, "ft": 81.0},
            {"name": "Keaton Wagler", "pos": "SG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Max Strus", "pos": "SG", "pts": 12.2, "reb": 4.8, "ast": 2.2, "stl": 0.9, "blk": 0.3, "tov": 1.1, "fg": 41.8, "fg3": 35.0, "ft": 79.0},
            {"name": "Kobe Sanders", "pos": "SG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Derrick Jones Jr.", "pos": "SF", "pts": 8.6, "reb": 3.3, "ast": 1.0, "stl": 1.0, "blk": 0.7, "tov": 0.8, "fg": 48.4, "fg3": 34.3, "ft": 71.3},
            {"name": "Yuki Kawamura", "pos": "PG", "pts": 3.2, "reb": 0.8, "ast": 2.5, "stl": 0.4, "blk": 0.0, "tov": 0.8, "fg": 37.0, "fg3": 31.0, "ft": 80.0},
            {"name": "TyTy Washington Jr.", "pos": "PG", "pts": 4.7, "reb": 1.2, "ast": 1.5, "stl": 0.5, "blk": 0.1, "tov": 0.8, "fg": 43.0, "fg3": 33.0, "ft": 75.0},
            {"name": "Yanic Konan Niederhäuser", "pos": "C", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Jordan Miller", "pos": "SG", "pts": 3.1, "reb": 1.2, "ast": 0.5, "stl": 0.3, "blk": 0.1, "tov": 0.4, "fg": 45.0, "fg3": 33.0, "ft": 76.0},
            {"name": "Johni Broome", "pos": "PF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Isaiah Jackson", "pos": "PF", "pts": 6.5, "reb": 4.1, "ast": 0.8, "stl": 0.5, "blk": 1.3, "tov": 0.8, "fg": 62.0, "fg3": 0.0, "ft": 65.0},
            {"name": "Cam Christie", "pos": "SG", "pts": 3.5, "reb": 1.5, "ast": 0.6, "stl": 0.3, "blk": 0.2, "tov": 0.4, "fg": 40.0, "fg3": 35.0, "ft": 78.0},
            {"name": "Jalen Pickett", "pos": "PG", "pts": 2.5, "reb": 1.2, "ast": 1.8, "stl": 0.3, "blk": 0.1, "tov": 0.5, "fg": 42.0, "fg3": 33.0, "ft": 75.0},
            {"name": "Nicolas Batum", "pos": "SF", "pts": 5.5, "reb": 4.2, "ast": 2.2, "stl": 0.8, "blk": 0.6, "tov": 0.7, "fg": 46.0, "fg3": 39.0, "ft": 78.0},
            {"name": "Jamarion Sharp", "pos": "C", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0}
        ]
    },
    {
        "id": 23,
        "name": "Los Angeles Lakers",
        "conference": "Western",
        "division": "Pacific",
        "featured_star": "Luka Dončić",
        "headline_stat": "28.2 PPG, 8.2 RPG, 7.8 APG",
        "last_season_record": "53-29",
        "total_salary": 201332759,
        "tax_status": "Luxury Tax",
        "championships": 17,
        "championship_years": [1949, 1950, 1952, 1953, 1954, 1972, 1980, 1982, 1985, 1987, 1988, 2000, 2001, 2002, 2009, 2010, 2020],
        "logo": "https://cdn.nba.com/logos/nba/1610612747/primary/L/logo.svg",
        "description": "Restructured marquee franchise revolving around Luka Doncic, Austin Reaves, and defensive anchor Walker Kessler.",
        "starters_2026_27": [
            {"name": "Luka Dončić", "pos": "PG", "pts": 28.2, "reb": 8.2, "ast": 7.8, "stl": 1.4, "blk": 0.5, "tov": 3.6, "fg": 45.2, "fg3": 35.5, "ft": 78.5},
            {"name": "Austin Reaves", "pos": "SG", "pts": 16.2, "reb": 4.4, "ast": 5.7, "stl": 0.8, "blk": 0.3, "tov": 2.0, "fg": 48.8, "fg3": 37.0, "ft": 85.8},
            {"name": "Quentin Grimes", "pos": "SF", "pts": 8.4, "reb": 2.4, "ast": 1.6, "stl": 0.8, "blk": 0.3, "tov": 0.9, "fg": 40.5, "fg3": 36.2, "ft": 80.1},
            {"name": "Sandro Mamukelashvili", "pos": "PF", "pts": 5.8, "reb": 3.9, "ast": 1.4, "stl": 0.4, "blk": 0.4, "tov": 0.7, "fg": 48.5, "fg3": 32.1, "ft": 76.0},
            {"name": "Walker Kessler", "pos": "C", "pts": 9.4, "reb": 8.8, "ast": 1.1, "stl": 0.5, "blk": 2.6, "tov": 1.2, "fg": 66.8, "fg3": 21.1, "ft": 62.4}
        ],
        "bench_2026_27": [
            {"name": "Arthur Kaluma", "pos": "PF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Adou Thiero", "pos": "SG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Jarred Vanderbilt", "pos": "PF", "pts": 5.2, "reb": 4.8, "ast": 1.2, "stl": 1.1, "blk": 0.4, "tov": 0.8, "fg": 52.0, "fg3": 28.0, "ft": 65.0},
            {"name": "Matisse Thybulle", "pos": "SG", "pts": 5.8, "reb": 1.6, "ast": 1.1, "stl": 1.5, "blk": 0.5, "tov": 0.6, "fg": 43.0, "fg3": 35.0, "ft": 75.0},
            {"name": "Dalton Knecht", "pos": "SF", "pts": 9.2, "reb": 2.5, "ast": 1.0, "stl": 0.5, "blk": 0.2, "tov": 0.8, "fg": 43.5, "fg3": 38.0, "ft": 80.0},
            {"name": "Jaden Hardy", "pos": "SG", "pts": 7.5, "reb": 1.8, "ast": 1.5, "stl": 0.4, "blk": 0.1, "tov": 1.0, "fg": 41.5, "fg3": 35.5, "ft": 82.0},
            {"name": "Bronny James", "pos": "PG", "pts": 2.1, "reb": 0.8, "ast": 0.9, "stl": 0.3, "blk": 0.1, "tov": 0.5, "fg": 36.0, "fg3": 27.0, "ft": 68.0},
            {"name": "Collin Sexton", "pos": "PG", "pts": 18.2, "reb": 2.6, "ast": 4.9, "stl": 0.9, "blk": 0.1, "tov": 2.1, "fg": 48.0, "fg3": 39.0, "ft": 85.0},
            {"name": "Ziaire Williams", "pos": "SF", "pts": 8.1, "reb": 3.4, "ast": 1.5, "stl": 0.7, "blk": 0.4, "tov": 0.9, "fg": 43.0, "fg3": 34.0, "ft": 80.0},
            {"name": "Jake LaRavia", "pos": "SF", "pts": 4.2, "reb": 2.1, "ast": 1.0, "stl": 0.4, "blk": 0.2, "tov": 0.5, "fg": 42.0, "fg3": 34.0, "ft": 78.0},
            {"name": "Chris Mañon", "pos": "SG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "AK Okereke", "pos": "PF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Cameron Carr", "pos": "SG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Kevon Looney", "pos": "C", "pts": 4.8, "reb": 5.7, "ast": 1.6, "stl": 0.5, "blk": 0.4, "tov": 0.6, "fg": 60.0, "fg3": 0.0, "ft": 62.0}
        ]
    },
    {
        "id": 24,
        "name": "Phoenix Suns",
        "conference": "Western",
        "division": "Pacific",
        "featured_star": "Devin Booker",
        "headline_stat": "25.8 PPG, 7.1 APG",
        "last_season_record": "45-37",
        "total_salary": 216225506,
        "tax_status": "1st Apron",
        "championships": 0,
        "championship_years": [],
        "logo": "https://cdn.nba.com/logos/nba/1610612756/primary/L/logo.svg",
        "description": "Potent perimeter scoring group featuring Devin Booker, Miles Bridges, Dillon Brooks, and Mark Williams.",
        "starters_2026_27": [
            {"name": "Devin Booker", "pos": "PG", "pts": 25.8, "reb": 4.1, "ast": 7.1, "stl": 1.0, "blk": 0.4, "tov": 2.6, "fg": 47.0, "fg3": 34.5, "ft": 89.0},
            {"name": "Jalen Green", "pos": "SG", "pts": 20.4, "reb": 5.4, "ast": 3.8, "stl": 0.9, "blk": 0.3, "tov": 2.2, "fg": 43.5, "fg3": 34.6, "ft": 81.5},
            {"name": "Dillon Brooks", "pos": "SF", "pts": 12.5, "reb": 3.3, "ast": 1.6, "stl": 0.9, "blk": 0.2, "tov": 1.3, "fg": 42.5, "fg3": 35.5, "ft": 84.0},
            {"name": "Miles Bridges", "pos": "PF", "pts": 20.6, "reb": 7.1, "ast": 3.2, "stl": 0.9, "blk": 0.5, "tov": 1.9, "fg": 46.0, "fg3": 34.5, "ft": 82.0},
            {"name": "Mark Williams", "pos": "C", "pts": 12.5, "reb": 9.5, "ast": 1.1, "stl": 0.6, "blk": 0.9, "tov": 1.2, "fg": 64.5, "fg3": 0.0, "ft": 71.5}
        ],
        "bench_2026_27": [
            {"name": "Ryan Dunn", "pos": "PF", "pts": 3.0, "reb": 2.5, "ast": 0.5, "stl": 0.5, "blk": 0.5, "tov": 0.4, "fg": 40.0, "fg3": 30.0, "ft": 70.0},
            {"name": "Amir Coffey", "pos": "SG", "pts": 6.5, "reb": 1.8, "ast": 1.1, "stl": 0.4, "blk": 0.2, "tov": 0.5, "fg": 47.0, "fg3": 38.0, "ft": 80.0},
            {"name": "Haywood Highsmith", "pos": "PF", "pts": 6.1, "reb": 3.2, "ast": 1.1, "stl": 0.8, "blk": 0.5, "tov": 0.6, "fg": 44.0, "fg3": 39.0, "ft": 74.0},
            {"name": "Luke Kennard", "pos": "SG", "pts": 11.0, "reb": 2.7, "ast": 3.5, "stl": 0.5, "blk": 0.1, "tov": 1.0, "fg": 45.0, "fg3": 44.0, "ft": 90.0},
            {"name": "Khaman Maluach", "pos": "C", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Oso Ighodaro", "pos": "PF", "pts": 3.5, "reb": 3.0, "ast": 0.8, "stl": 0.3, "blk": 0.5, "tov": 0.6, "fg": 55.0, "fg3": 0.0, "ft": 65.0},
            {"name": "Collin Gillespie", "pos": "PG", "pts": 3.6, "reb": 1.1, "ast": 1.5, "stl": 0.3, "blk": 0.1, "tov": 0.5, "fg": 41.0, "fg3": 37.0, "ft": 82.0},
            {"name": "Koby Brea", "pos": "SG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Jamaree Bouyea", "pos": "PG", "pts": 2.0, "reb": 1.0, "ast": 1.0, "stl": 0.2, "blk": 0.1, "tov": 0.3, "fg": 42.0, "fg3": 33.0, "ft": 75.0},
            {"name": "Isaiah Livers", "pos": "PF", "pts": 6.5, "reb": 4.1, "ast": 0.9, "stl": 0.5, "blk": 0.4, "tov": 0.6, "fg": 41.0, "fg3": 36.0, "ft": 80.0},
            {"name": "Koa Peat", "pos": "PF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Rasheer Fleming", "pos": "PF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "CJ Huntley", "pos": "PF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Jordan Goodwin", "pos": "SG", "pts": 6.5, "reb": 4.0, "ast": 2.7, "stl": 1.0, "blk": 0.3, "tov": 1.0, "fg": 41.0, "fg3": 30.0, "ft": 72.0},
            {"name": "Pat Spencer", "pos": "PG", "pts": 2.0, "reb": 1.0, "ast": 1.5, "stl": 0.4, "blk": 0.1, "tov": 0.5, "fg": 45.0, "fg3": 33.0, "ft": 75.0}
        ]
    },
    {
        "id": 25,
        "name": "Sacramento Kings",
        "conference": "Western",
        "division": "Pacific",
        "featured_star": "Domantas Sabonis",
        "headline_stat": "19.4 PPG, 13.9 RPG, 8.2 APG",
        "last_season_record": "22-60",
        "total_salary": 189346486,
        "tax_status": "Over Cap",
        "championships": 1,
        "championship_years": [1951],
        "logo": "https://cdn.nba.com/logos/nba/1610612758/primary/L/logo.svg",
        "description": "High-IQ passing and scoring unit led by triple-double machine Domantas Sabonis and Zach LaVine.",
        "starters_2026_27": [
            {"name": "Darius Acuff Jr.", "pos": "PG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "De'Andre Hunter", "pos": "SG", "pts": 15.4, "reb": 3.8, "ast": 1.4, "stl": 0.8, "blk": 0.3, "tov": 1.3, "fg": 45.5, "fg3": 38.2, "ft": 84.2},
            {"name": "Keegan Murray", "pos": "SF", "pts": 16.1, "reb": 5.8, "ast": 1.9, "stl": 1.0, "blk": 0.7, "tov": 1.2, "fg": 46.2, "fg3": 36.8, "ft": 84.0},
            {"name": "Zach LaVine", "pos": "PF", "pts": 19.2, "reb": 5.0, "ast": 3.8, "stl": 0.8, "blk": 0.3, "tov": 2.2, "fg": 45.0, "fg3": 34.5, "ft": 85.0},
            {"name": "Domantas Sabonis", "pos": "C", "pts": 19.4, "reb": 13.9, "ast": 8.2, "stl": 0.9, "blk": 0.6, "tov": 3.3, "fg": 59.4, "fg3": 37.9, "ft": 70.4}
        ],
        "bench_2026_27": [
            {"name": "Malik Monk", "pos": "SG", "pts": 15.4, "reb": 2.9, "ast": 5.1, "stl": 0.6, "blk": 0.1, "tov": 2.1, "fg": 44.3, "fg3": 35.0, "ft": 82.9},
            {"name": "Jonathan Mogbo", "pos": "PF", "pts": 3.8, "reb": 3.0, "ast": 0.8, "stl": 0.5, "blk": 0.4, "tov": 0.6, "fg": 53.0, "fg3": 0.0, "ft": 65.0},
            {"name": "Darius Acuff Jr.", "pos": "PG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Precious Achiuwa", "pos": "PF", "pts": 7.6, "reb": 6.0, "ast": 1.1, "stl": 0.6, "blk": 0.9, "tov": 1.0, "fg": 51.0, "fg3": 25.0, "ft": 61.0},
            {"name": "Nique Clifford", "pos": "SG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Adam Flagler", "pos": "PG", "pts": 2.0, "reb": 0.5, "ast": 0.8, "stl": 0.2, "blk": 0.0, "tov": 0.4, "fg": 38.0, "fg3": 35.0, "ft": 75.0},
            {"name": "Ben Simmons", "pos": "PG", "pts": 6.1, "reb": 7.9, "ast": 5.7, "stl": 1.3, "blk": 0.6, "tov": 2.1, "fg": 56.0, "fg3": 0.0, "ft": 53.0},
            {"name": "Daeqwon Plowden", "pos": "SG", "pts": 1.5, "reb": 1.0, "ast": 0.2, "stl": 0.1, "blk": 0.1, "tov": 0.3, "fg": 40.0, "fg3": 30.0, "ft": 70.0},
            {"name": "Dylan Cardwell", "pos": "C", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Alex Karaban", "pos": "SF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Emanuel Sharp", "pos": "SG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Maxime Raynaud", "pos": "C", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0}
        ]
    },
    {
        "id": 26,
        "name": "Dallas Mavericks",
        "conference": "Western",
        "division": "Southwest",
        "featured_star": "Kyrie Irving",
        "headline_stat": "25.2 PPG, 5.1 APG",
        "last_season_record": "26-56",
        "total_salary": 197866094,
        "tax_status": "Over Cap",
        "championships": 1,
        "championship_years": [2011],
        "logo": "https://cdn.nba.com/logos/nba/1610612742/primary/L/logo.svg",
        "description": "Electrifying roster revolving around Kyrie Irving, #1 pick Zaccharie Risacher, and top draft standout Cooper Flagg.",
        "starters_2026_27": [
            {"name": "Kyrie Irving", "pos": "PG", "pts": 25.2, "reb": 4.8, "ast": 5.1, "stl": 1.3, "blk": 0.5, "tov": 1.8, "fg": 49.5, "fg3": 40.8, "ft": 90.2},
            {"name": "Max Christie", "pos": "SG", "pts": 5.6, "reb": 2.5, "ast": 1.2, "stl": 0.5, "blk": 0.3, "tov": 0.7, "fg": 44.0, "fg3": 37.2, "ft": 80.0},
            {"name": "Zaccharie Risacher", "pos": "SF", "pts": 13.5, "reb": 4.2, "ast": 1.8, "stl": 0.9, "blk": 0.6, "tov": 1.4, "fg": 43.5, "fg3": 35.2, "ft": 74.5},
            {"name": "Cooper Flagg", "pos": "PF", "pts": 18.7, "reb": 8.1, "ast": 4.2, "stl": 1.4, "blk": 0.9, "tov": 2.2, "fg": 48.6, "fg3": 35.1, "ft": 81.4},
            {"name": "Dereck Lively II", "pos": "C", "pts": 9.8, "reb": 7.8, "ast": 1.5, "stl": 0.7, "blk": 1.5, "tov": 1.1, "fg": 73.2, "fg3": 0.0, "ft": 54.0}
        ],
        "bench_2026_27": [
            {"name": "Tarik Biberovic", "pos": "SF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Vsevolod Ishchenko", "pos": "SG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "John Poulakidas", "pos": "SG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Naji Marshall", "pos": "SF", "pts": 7.1, "reb": 3.2, "ast": 1.5, "stl": 0.6, "blk": 0.2, "tov": 0.9, "fg": 46.0, "fg3": 35.0, "ft": 79.0},
            {"name": "Dwight Powell", "pos": "C", "pts": 3.3, "reb": 3.4, "ast": 1.1, "stl": 0.5, "blk": 0.3, "tov": 0.6, "fg": 70.0, "fg3": 0.0, "ft": 71.0},
            {"name": "Marcus Sasser", "pos": "PG", "pts": 8.3, "reb": 1.8, "ast": 3.3, "stl": 0.6, "blk": 0.2, "tov": 1.1, "fg": 42.8, "fg3": 37.5, "ft": 80.0},
            {"name": "Jett Howard", "pos": "SF", "pts": 5.2, "reb": 1.2, "ast": 0.9, "stl": 0.3, "blk": 0.1, "tov": 0.7, "fg": 41.0, "fg3": 36.0, "ft": 82.0},
            {"name": "Morez Johnson", "pos": "PF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Caleb Martin", "pos": "SF", "pts": 10.0, "reb": 4.4, "ast": 2.2, "stl": 1.0, "blk": 0.5, "tov": 1.1, "fg": 43.1, "fg3": 35.0, "ft": 77.8},
            {"name": "Daniel Gafford", "pos": "C", "pts": 11.0, "reb": 7.6, "ast": 1.6, "stl": 0.6, "blk": 2.1, "tov": 1.2, "fg": 71.0, "fg3": 0.0, "ft": 70.0},
            {"name": "P.J. Washington", "pos": "PF", "pts": 12.9, "reb": 5.6, "ast": 1.9, "stl": 0.9, "blk": 0.8, "tov": 1.2, "fg": 43.5, "fg3": 32.0, "ft": 74.5},
            {"name": "Moussa Cisse", "pos": "C", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Tobi Lawal", "pos": "SF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Santi Aldama", "pos": "PF", "pts": 8.5, "reb": 5.8, "ast": 2.3, "stl": 0.7, "blk": 0.9, "tov": 1.0, "fg": 43.2, "fg3": 35.0, "ft": 72.0},
            {"name": "Sergio de Larrea", "pos": "PG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0}
        ]
    },
    {
        "id": 27,
        "name": "Houston Rockets",
        "conference": "Western",
        "division": "Southwest",
        "featured_star": "Alperen Şengün",
        "headline_stat": "21.4 PPG, 9.5 RPG, 5.2 APG",
        "last_season_record": "52-30",
        "total_salary": 205487343,
        "tax_status": "Luxury Tax",
        "championships": 2,
        "championship_years": [1994, 1995],
        "logo": "https://cdn.nba.com/logos/nba/1610612745/primary/L/logo.svg",
        "description": "Western contender driven by veteran champion Kevin Durant alongside playmaking big Alperen Sengun.",
        "starters_2026_27": [
            {"name": "Fred VanVleet", "pos": "PG", "pts": 17.2, "reb": 3.7, "ast": 8.0, "stl": 1.4, "blk": 0.8, "tov": 1.8, "fg": 41.8, "fg3": 38.5, "ft": 86.2},
            {"name": "Amen Thompson", "pos": "SG", "pts": 12.8, "reb": 7.5, "ast": 3.8, "stl": 1.4, "blk": 0.7, "tov": 1.8, "fg": 54.5, "fg3": 17.5, "ft": 71.0},
            {"name": "Kevin Durant", "pos": "SF", "pts": 26.8, "reb": 6.3, "ast": 4.2, "stl": 0.9, "blk": 0.9, "tov": 2.8, "fg": 52.5, "fg3": 41.5, "ft": 86.5},
            {"name": "Jabari Smith Jr.", "pos": "PF", "pts": 14.8, "reb": 8.6, "ast": 1.8, "stl": 0.8, "blk": 0.9, "tov": 1.3, "fg": 46.5, "fg3": 37.8, "ft": 83.5},
            {"name": "Alperen Şengün", "pos": "C", "pts": 21.4, "reb": 9.5, "ast": 5.2, "stl": 1.2, "blk": 1.1, "tov": 2.7, "fg": 54.0, "fg3": 30.0, "ft": 69.8}
        ],
        "bench_2026_27": [
            {"name": "Sean Pedulla", "pos": "PG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Bruce Thornton", "pos": "PG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Rafael Castro", "pos": "C", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Quadir Copeland", "pos": "SG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Aaron Holiday", "pos": "PG", "pts": 6.5, "reb": 1.6, "ast": 1.8, "stl": 0.5, "blk": 0.2, "tov": 0.8, "fg": 44.0, "fg3": 38.0, "ft": 82.0},
            {"name": "Julian Phillips", "pos": "SF", "pts": 2.3, "reb": 1.4, "ast": 0.3, "stl": 0.3, "blk": 0.2, "tov": 0.3, "fg": 41.0, "fg3": 31.0, "ft": 75.0},
            {"name": "Jae'Sean Tate", "pos": "SF", "pts": 6.2, "reb": 4.4, "ast": 1.3, "stl": 0.8, "blk": 0.4, "tov": 0.8, "fg": 47.0, "fg3": 30.0, "ft": 71.0},
            {"name": "Steven Adams", "pos": "C", "pts": 8.0, "reb": 11.5, "ast": 2.3, "stl": 1.0, "blk": 1.1, "tov": 1.5, "fg": 60.0, "fg3": 0.0, "ft": 55.0},
            {"name": "Reed Sheppard", "pos": "SG", "pts": 8.5, "reb": 2.2, "ast": 3.0, "stl": 1.1, "blk": 0.3, "tov": 1.2, "fg": 44.0, "fg3": 39.0, "ft": 80.0},
            {"name": "Tari Eason", "pos": "SF", "pts": 9.8, "reb": 5.5, "ast": 1.1, "stl": 1.4, "blk": 0.9, "tov": 1.1, "fg": 46.5, "fg3": 36.0, "ft": 75.0},
            {"name": "Isaiah Crawford", "pos": "SF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Clint Capela", "pos": "C", "pts": 11.5, "reb": 10.5, "ast": 1.2, "stl": 0.8, "blk": 1.5, "tov": 1.3, "fg": 58.0, "fg3": 0.0, "ft": 62.0},
            {"name": "Bogdan Bogdanovic", "pos": "SG", "pts": 16.5, "reb": 3.4, "ast": 3.1, "stl": 1.1, "blk": 0.3, "tov": 1.5, "fg": 43.0, "fg3": 37.5, "ft": 92.0},
            {"name": "Jeff Green", "pos": "PF", "pts": 6.4, "reb": 2.3, "ast": 0.9, "stl": 0.3, "blk": 0.3, "tov": 0.6, "fg": 45.0, "fg3": 33.0, "ft": 78.0},
            {"name": "Oscar Tshiebwe", "pos": "C", "pts": 2.5, "reb": 3.0, "ast": 0.2, "stl": 0.2, "blk": 0.2, "tov": 0.4, "fg": 55.0, "fg3": 0.0, "ft": 65.0},
            {"name": "Marcus Smart", "pos": "PG", "pts": 11.5, "reb": 2.7, "ast": 4.3, "stl": 1.5, "blk": 0.3, "tov": 1.8, "fg": 41.0, "fg3": 33.0, "ft": 77.0}
        ]
    },
    {
        "id": 28,
        "name": "Memphis Grizzlies",
        "conference": "Western",
        "division": "Southwest",
        "featured_star": "Zach Edey",
        "headline_stat": "14.2 PPG, 9.2 RPG, 1.6 BPG",
        "last_season_record": "25-57",
        "total_salary": 167642677,
        "tax_status": "Over Cap",
        "championships": 0,
        "championship_years": [],
        "logo": "https://cdn.nba.com/logos/nba/1610612763/primary/L/logo.svg",
        "description": "Youth-oriented squad anchored by 7-foot-4 center Zach Edey, Jaylen Wells, and Cedric Coward.",
        "starters_2026_27": [
            {"name": "Ty Jerome", "pos": "PG", "pts": 7.8, "reb": 1.9, "ast": 3.2, "stl": 0.7, "blk": 0.1, "tov": 1.0, "fg": 47.5, "fg3": 38.8, "ft": 88.2},
            {"name": "Jaylen Wells", "pos": "SG", "pts": 10.2, "reb": 3.6, "ast": 1.8, "stl": 0.7, "blk": 0.3, "tov": 1.1, "fg": 44.8, "fg3": 38.5, "ft": 83.0},
            {"name": "Cedric Coward", "pos": "SF", "pts": 7.8, "reb": 3.4, "ast": 1.4, "stl": 0.7, "blk": 0.4, "tov": 0.9, "fg": 44.8, "fg3": 35.5, "ft": 77.0},
            {"name": "Cameron Boozer", "pos": "PF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Zach Edey", "pos": "C", "pts": 14.2, "reb": 9.2, "ast": 1.2, "stl": 0.4, "blk": 1.6, "tov": 1.6, "fg": 62.5, "fg3": 0.0, "ft": 72.0}
        ],
        "bench_2026_27": [
            {"name": "Jahmai Mashack", "pos": "SG", "pts": 2.1, "reb": 1.1, "ast": 0.5, "stl": 0.4, "blk": 0.1, "tov": 0.4, "fg": 40.0, "fg3": 30.0, "ft": 70.0},
            {"name": "Richie Saunders", "pos": "SG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Scotty Pippen Jr.", "pos": "PG", "pts": 12.9, "reb": 3.2, "ast": 4.8, "stl": 1.6, "blk": 0.4, "tov": 1.9, "fg": 43.1, "fg3": 35.0, "ft": 74.5},
            {"name": "Walter Clayton Jr.", "pos": "PG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "D'Angelo Russell", "pos": "PG", "pts": 17.5, "reb": 2.9, "ast": 6.1, "stl": 0.9, "blk": 0.4, "tov": 2.5, "fg": 45.0, "fg3": 36.5, "ft": 82.8},
            {"name": "Jerami Grant", "pos": "SF", "pts": 21.0, "reb": 3.5, "ast": 2.8, "stl": 0.8, "blk": 0.6, "tov": 2.1, "fg": 45.1, "fg3": 40.2, "ft": 81.7},
            {"name": "Javon Small", "pos": "PG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Micah Peavy", "pos": "SF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Olivier-Maxence Prosper", "pos": "PF", "pts": 4.1, "reb": 2.0, "ast": 0.5, "stl": 0.4, "blk": 0.3, "tov": 0.5, "fg": 44.0, "fg3": 30.0, "ft": 71.0},
            {"name": "Quinten Post", "pos": "C", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Taylor Hendricks", "pos": "PF", "pts": 7.3, "reb": 6.0, "ast": 0.8, "stl": 0.6, "blk": 0.8, "tov": 0.8, "fg": 45.0, "fg3": 37.0, "ft": 73.0},
            {"name": "Jordan Hawkins", "pos": "SG", "pts": 7.8, "reb": 2.2, "ast": 1.1, "stl": 0.5, "blk": 0.2, "tov": 0.8, "fg": 41.5, "fg3": 36.5, "ft": 85.0},
            {"name": "Cam Spencer", "pos": "SG", "pts": 3.5, "reb": 1.4, "ast": 1.2, "stl": 0.4, "blk": 0.1, "tov": 0.4, "fg": 43.0, "fg3": 39.0, "ft": 80.0},
            {"name": "Kris Murray", "pos": "PF", "pts": 4.5, "reb": 2.6, "ast": 0.9, "stl": 0.5, "blk": 0.4, "tov": 0.6, "fg": 40.0, "fg3": 33.0, "ft": 74.0},
            {"name": "Isaiah Stewart", "pos": "C", "pts": 7.8, "reb": 6.6, "ast": 1.6, "stl": 0.4, "blk": 0.8, "tov": 1.0, "fg": 48.0, "fg3": 35.0, "ft": 73.0},
            {"name": "Karim Lopez", "pos": "SF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "GG Jackson", "pos": "PF", "pts": 14.6, "reb": 4.1, "ast": 1.2, "stl": 0.6, "blk": 0.5, "tov": 1.6, "fg": 42.8, "fg3": 35.7, "ft": 82.5}
        ]
    },
    {
        "id": 29,
        "name": "New Orleans Pelicans",
        "conference": "Western",
        "division": "Southwest",
        "featured_star": "Zion Williamson",
        "headline_stat": "23.2 PPG, 5.9 RPG, 5.1 APG",
        "last_season_record": "26-56",
        "total_salary": 202241014,
        "tax_status": "Luxury Tax",
        "championships": 0,
        "championship_years": [],
        "logo": "https://cdn.nba.com/logos/nba/1610612740/primary/L/logo.svg",
        "description": "High-powered offense revolving around Zion Williamson, Dejounte Murray, and defensive specialist Herb Jones.",
        "starters_2026_27": [
            {"name": "Dejounte Murray", "pos": "PG", "pts": 22.2, "reb": 5.1, "ast": 6.2, "stl": 1.5, "blk": 0.3, "tov": 2.4, "fg": 45.6, "fg3": 36.0, "ft": 79.0},
            {"name": "Trey Murphy III", "pos": "SG", "pts": 15.6, "reb": 5.2, "ast": 2.5, "stl": 0.9, "blk": 0.5, "tov": 1.2, "fg": 45.1, "fg3": 39.2, "ft": 83.0},
            {"name": "Herb Jones", "pos": "SF", "pts": 11.2, "reb": 3.7, "ast": 2.7, "stl": 1.5, "blk": 0.9, "tov": 1.3, "fg": 50.0, "fg3": 42.0, "ft": 87.0},
            {"name": "Zion Williamson", "pos": "PF", "pts": 23.2, "reb": 5.9, "ast": 5.1, "stl": 1.0, "blk": 0.7, "tov": 2.8, "fg": 57.4, "fg3": 33.5, "ft": 70.5},
            {"name": "Derik Queen", "pos": "C", "pts": 11.6, "reb": 7.2, "ast": 2.4, "stl": 0.8, "blk": 0.9, "tov": 1.7, "fg": 54.1, "fg3": 28.0, "ft": 72.8}
        ],
        "bench_2026_27": [
            {"name": "Jeremiah Fears", "pos": "PG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Jordan Poole", "pos": "SG", "pts": 17.5, "reb": 2.7, "ast": 4.4, "stl": 1.1, "blk": 0.3, "tov": 3.1, "fg": 41.3, "fg3": 32.6, "ft": 87.7},
            {"name": "Kobe Bufkin", "pos": "SG", "pts": 5.8, "reb": 1.8, "ast": 1.9, "stl": 0.4, "blk": 0.2, "tov": 0.9, "fg": 39.0, "fg3": 31.0, "ft": 75.0},
            {"name": "DeAndre Jordan", "pos": "C", "pts": 4.2, "reb": 5.0, "ast": 0.6, "stl": 0.3, "blk": 0.6, "tov": 0.7, "fg": 65.0, "fg3": 0.0, "ft": 50.0},
            {"name": "AJ Johnson", "pos": "SG", "pts": 2.5, "reb": 0.8, "ast": 1.0, "stl": 0.3, "blk": 0.1, "tov": 0.6, "fg": 40.0, "fg3": 32.0, "ft": 72.0},
            {"name": "Malik Dia", "pos": "PF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Trendon Watford", "pos": "SF", "pts": 6.8, "reb": 3.1, "ast": 1.3, "stl": 0.5, "blk": 0.3, "tov": 0.8, "fg": 50.0, "fg3": 31.0, "ft": 72.0},
            {"name": "Bennedict Mathurin", "pos": "SF", "pts": 14.5, "reb": 4.0, "ast": 2.0, "stl": 0.6, "blk": 0.2, "tov": 1.5, "fg": 44.8, "fg3": 36.5, "ft": 82.1},
            {"name": "Jaron Pierre Jr.", "pos": "SG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Bryce McGowens", "pos": "SG", "pts": 5.1, "reb": 1.5, "ast": 0.9, "stl": 0.4, "blk": 0.1, "tov": 0.6, "fg": 41.0, "fg3": 33.0, "ft": 77.0},
            {"name": "Karlo Matković", "pos": "C", "pts": 4.0, "reb": 3.5, "ast": 0.5, "stl": 0.2, "blk": 0.6, "tov": 0.5, "fg": 54.0, "fg3": 25.0, "ft": 70.0},
            {"name": "Yves Missi", "pos": "C", "pts": 6.5, "reb": 5.8, "ast": 0.8, "stl": 0.5, "blk": 1.2, "tov": 0.9, "fg": 58.0, "fg3": 0.0, "ft": 63.0},
            {"name": "Caleb Houstan", "pos": "SF", "pts": 4.2, "reb": 1.8, "ast": 0.5, "stl": 0.3, "blk": 0.1, "tov": 0.4, "fg": 40.5, "fg3": 36.0, "ft": 75.0},
            {"name": "Christian Koloko", "pos": "C", "pts": 3.1, "reb": 2.9, "ast": 0.4, "stl": 0.3, "blk": 1.0, "tov": 0.5, "fg": 55.0, "fg3": 0.0, "ft": 62.0},
            {"name": "Saddiq Bey", "pos": "SF", "pts": 13.5, "reb": 6.5, "ast": 1.5, "stl": 0.8, "blk": 0.3, "tov": 1.1, "fg": 42.0, "fg3": 32.5, "ft": 83.0}
        ]
    },
    {
        "id": 30,
        "name": "San Antonio Spurs",
        "conference": "Western",
        "division": "Southwest",
        "featured_star": "Victor Wembanyama",
        "headline_stat": "24.3 PPG, 11.0 RPG, 3.1 BPG",
        "last_season_record": "62-20",
        "total_salary": 198315672,
        "tax_status": "Over Cap",
        "championships": 5,
        "championship_years": [1999, 2003, 2005, 2007, 2014],
        "logo": "https://cdn.nba.com/logos/nba/1610612759/primary/L/logo.svg",
        "description": "Rapidly climbing Western powerhouse engineered around transcendent center Victor Wembanyama and Stephon Castle.",
        "starters_2026_27": [
            {"name": "De'Aaron Fox", "pos": "PG", "pts": 26.2, "reb": 4.5, "ast": 5.4, "stl": 1.8, "blk": 0.4, "tov": 2.6, "fg": 46.2, "fg3": 36.6, "ft": 73.5},
            {"name": "Stephon Castle", "pos": "SG", "pts": 14.7, "reb": 3.7, "ast": 4.1, "stl": 1.2, "blk": 0.4, "tov": 2.1, "fg": 44.8, "fg3": 30.5, "ft": 72.9},
            {"name": "Devin Vassell", "pos": "SF", "pts": 19.2, "reb": 3.7, "ast": 4.0, "stl": 1.1, "blk": 0.4, "tov": 1.6, "fg": 47.0, "fg3": 37.0, "ft": 80.0},
            {"name": "Julian Champagnie", "pos": "PF", "pts": 9.3, "reb": 3.6, "ast": 1.4, "stl": 0.6, "blk": 0.4, "tov": 0.7, "fg": 45.0, "fg3": 38.0, "ft": 81.2},
            {"name": "Victor Wembanyama", "pos": "C", "pts": 24.3, "reb": 11.0, "ast": 3.7, "stl": 1.3, "blk": 3.1, "tov": 3.1, "fg": 47.5, "fg3": 34.5, "ft": 82.5}
        ],
        "bench_2026_27": [
            {"name": "Jordan McLaughlin", "pos": "PG", "pts": 3.5, "reb": 1.3, "ast": 2.5, "stl": 0.7, "blk": 0.1, "tov": 0.7, "fg": 43.0, "fg3": 35.0, "ft": 75.0},
            {"name": "Dylan Harper", "pos": "SG", "pts": 11.8, "reb": 3.4, "ast": 3.9, "stl": 1.0, "blk": 0.3, "tov": 1.8, "fg": 44.0, "fg3": 34.5, "ft": 78.0},
            {"name": "Keldon Johnson", "pos": "SF", "pts": 13.2, "reb": 5.4, "ast": 1.4, "stl": 0.7, "blk": 0.3, "tov": 1.2, "fg": 45.2, "fg3": 34.6, "ft": 78.8},
            {"name": "Taelon Peter", "pos": "SG", "pts": 4.5, "reb": 1.6, "ast": 1.1, "stl": 0.4, "blk": 0.2, "tov": 0.6, "fg": 41.0, "fg3": 33.0, "ft": 74.0},
            {"name": "Luke Kornet", "pos": "C", "pts": 6.5, "reb": 6.1, "ast": 1.9, "stl": 0.5, "blk": 1.0, "tov": 0.7, "fg": 65.0, "fg3": 25.0, "ft": 70.0},
            {"name": "Tarris Reed Jr.", "pos": "C", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Carter Bryant", "pos": "SF", "pts": 4.2, "reb": 2.5, "ast": 0.7, "stl": 0.4, "blk": 0.3, "tov": 0.5, "fg": 42.0, "fg3": 33.0, "ft": 72.0},
            {"name": "Jayden Quaintance", "pos": "PF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Tobias Harris", "pos": "PF", "pts": 13.3, "reb": 5.1, "ast": 2.5, "stl": 0.8, "blk": 0.5, "tov": 1.1, "fg": 48.0, "fg3": 35.0, "ft": 87.0},
            {"name": "David Jones Garcia", "pos": "SG", "pts": 2.9, "reb": 1.2, "ast": 1.6, "stl": 0.4, "blk": 0.1, "tov": 0.6, "fg": 39.0, "fg3": 30.0, "ft": 70.0},
            {"name": "Harrison Barnes", "pos": "PF", "pts": 9.9, "reb": 2.8, "ast": 1.9, "stl": 0.6, "blk": 0.2, "tov": 0.7, "fg": 47.0, "fg3": 38.0, "ft": 80.0},
            {"name": "Maliq Brown", "pos": "PF", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0},
            {"name": "Ja'Kobi Gillespie", "pos": "PG", "pts": 0.0, "reb": 0.0, "ast": 0.0, "stl": 0.0, "blk": 0.0, "tov": 0.0, "fg": 0.0, "fg3": 0.0, "ft": 0.0}
        ]
    }
]

# ==============================================================================
# ON-BOOT VALIDATION ROUTINE
# ==============================================================================
validated_teams = [Team(**team).model_dump() for team in teams]
teams = validated_teams

# ==============================================================================
# API KEY AUTHENTICATION
# ==============================================================================
def verify_api_key(x_api_key: Optional[str] = Header(default=None)):
    if x_api_key != API_KEY:
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing API key."
        )
    return True

# ==============================================================================
# ROUTE ENDPOINTS
# ==============================================================================
@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "NBA Hub API",
        "version": API_VERSION,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }

@app.get("/api/v1/teams/search", dependencies=[Depends(verify_api_key)])
def search_teams(q: str = Query(..., min_length=1)):
    query = q.lower()
    results = []
    for team in teams:
        starter_names = " ".join([p["name"] for p in team.get("starters_2026_27", [])])
        bench_names = " ".join([p["name"] for p in team.get("bench_2026_27", [])])
        searchable_text = (
            f"{team['name']} {team['conference']} {team['division']} "
            f"{team['featured_star']} {team['tax_status']} {team['last_season_record']} "
            f"{starter_names} {bench_names} {team['description']}"
        ).lower()
        if query in searchable_text:
            results.append(team)

    return {
        "query": q,
        "count": len(results),
        "results": results
    }

@app.get("/api/v1/teams", dependencies=[Depends(verify_api_key)])
def get_teams():
    return {
        "count": len(teams),
        "teams": teams
    }

@app.get("/api/v1/teams/{team_id}", dependencies=[Depends(verify_api_key)])
def get_team(team_id: int):
    for team in teams:
        if team["id"] == team_id:
            return team
    raise HTTPException(status_code=404, detail="Team not found.")

@app.get("/teams")
def get_teams_legacy():
    return {"teams": teams}

@app.get("/api/v1/health")
def health_check_v1():
    return health_check()
