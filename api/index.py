from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
import html as html_lib
import json
import logging
import math
import os
import re
import time
import unicodedata
from pathlib import Path
from threading import Lock
from typing import List, Optional, Literal
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, quote
from urllib.request import Request, urlopen
from fastapi import FastAPI, HTTPException, Header, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from supabase import Client, create_client

try:
    from supabase import create_client, Client
except ImportError:  # pragma: no cover - optional dependency for community-challenge endpoints
    create_client = None
    Client = None



logger = logging.getLogger(__name__)
API_KEY = "lebron2369"
API_VERSION = "1.3"

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
    contract_type: Optional[str] = Field(default=None, description="Contract type label, such as Two-Way")
    stats_season: str = Field(default="2026-27", description="Season represented by the player stats")
    gp: Optional[int] = Field(default=None, ge=0, description="Regular-season games played")
    pts: Optional[float] = Field(default=None, ge=0.0, le=100.0, description="Points per game")
    reb: Optional[float] = Field(default=None, ge=0.0, le=50.0, description="Rebounds per game")
    ast: Optional[float] = Field(default=None, ge=0.0, le=30.0, description="Assists per game")
    stl: Optional[float] = Field(default=None, ge=0.0, le=10.0, description="Steals per game")
    blk: Optional[float] = Field(default=None, ge=0.0, le=15.0, description="Blocks per game")
    tov: Optional[float] = Field(default=None, ge=0.0, le=15.0, description="Turnovers per game")
    fg: Optional[float] = Field(default=None, ge=0.0, le=100.0, description="Field goal percentage")
    fg3: Optional[float] = Field(default=None, ge=0.0, le=100.0, description="Three-point percentage")
    ft: Optional[float] = Field(default=None, ge=0.0, le=100.0, description="Free throw percentage")
    salary: Optional[int] = Field(
        default=None,
        ge=0,
        description="Verified 2026-27 salary when available",
    )

class DraftPick(BaseModel):
    year: int = Field(..., ge=2026, le=2040, description="Draft year")
    round: Literal[1, 2] = Field(..., description="Draft round (1 or 2)")
    original_owner: str = Field(..., description="Abbreviation or name of original team (e.g., 'ATL', 'MIL')")
    current_owner_id: int = Field(..., description="Team ID currently holding the pick")
    is_swap: bool = Field(default=False, description="Whether pick is subject to pick swap rights")
    protection: Optional[str] = Field(default=None, description="Pick protection conditions")
    details: str = Field(..., description="Readable conditions and trade pathway details")

class CommunityChallengeCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=48)
    description: str = Field(default="", max_length=220)
    creator: str = Field(..., min_length=2, max_length=24)
    rule_type: Literal[
        "all", "scorers", "playmakers", "rebounders", "guards",
        "forwards", "bigs", "defenders"
    ]
    selected_player_ids: List[str] = Field(..., min_length=5, max_length=590)

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
    draft_picks: List[DraftPick] = Field(default_factory=list, description="Future draft pick assets")
    
def generate_standard_picks(team_id: int, team_abbr: str) -> List[dict]:
    picks = []

    for yr in range(2027, 2034):
        picks.append({
            "year": yr,
            "round": 1,
            "original_owner": team_abbr,
            "current_owner_id": team_id,
            "is_swap": False,
            "protection": None,
            "details": "Own",
        })

        picks.append({
            "year": yr,
            "round": 2,
            "original_owner": team_abbr,
            "current_owner_id": team_id,
            "is_swap": False,
            "protection": None,
            "details": "Own",
        })

    return picks


atlanta_draft_picks = [
    {
        "year": 2027,
        "round": 1,
        "original_owner": "MIL/NOP",
        "current_owner_id": 12,
        "is_swap": False,
        "protection": "Protected 1-4",
        "details": "To SAN; Less favorable of MIL and NOP if either or both 5-30 (via NOP)",
    },
    {
        "year": 2027,
        "round": 2,
        "original_owner": "ATL",
        "current_owner_id": 12,
        "is_swap": False,
        "protection": "Protected 56-60",
        "details": "31-55 Own; 56-60 to DAL",
    },
    {
        "year": 2028,
        "round": 1,
        "original_owner": "ATL",
        "current_owner_id": 12,
        "is_swap": True,
        "protection": None,
        "details": "More favorable of (i) ATL and (ii) less favorable of UTH and CLE then least favorable of all to CLE (via UTH swap for CLE; via ATL swap for CLE or UTH)",
    },
    {
        "year": 2029,
        "round": 1,
        "original_owner": "ATL",
        "current_owner_id": 12,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2029,
        "round": 2,
        "original_owner": "CLE",
        "current_owner_id": 12,
        "is_swap": False,
        "protection": None,
        "details": "CLE (More favorable of ATL and MIA to CHA then other to OKC)",
    },
    {
        "year": 2030,
        "round": 1,
        "original_owner": "ATL",
        "current_owner_id": 12,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2030,
        "round": 2,
        "original_owner": "NYK",
        "current_owner_id": 12,
        "is_swap": False,
        "protection": None,
        "details": "NYK (via POR; Own to OKC)",
    },
    {
        "year": 2031,
        "round": 1,
        "original_owner": "ATL",
        "current_owner_id": 12,
        "is_swap": False,
        "protection": None,
        "details": "Own (Own 2nd to OKC/HOU)",
    },
    {
        "year": 2032,
        "round": 1,
        "original_owner": "ATL",
        "current_owner_id": 12,
        "is_swap": False,
        "protection": None,
        "details": "Own (Own 2nd to OKC)",
    },
    {
        "year": 2033,
        "round": 1,
        "original_owner": "ATL",
        "current_owner_id": 12,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2033,
        "round": 2,
        "original_owner": "ATL",
        "current_owner_id": 12,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2033,
        "round": 2,
        "original_owner": "SAC",
        "current_owner_id": 12,
        "is_swap": False,
        "protection": None,
        "details": "SAC",
    },
]


brooklyn_draft_picks = [
    # 2027
    {
        "year": 2027,
        "round": 1,
        "original_owner": "BRK/HOU",
        "current_owner_id": 2,
        "is_swap": True,
        "protection": None,
        "details": "Own or HOU (via HOU swap for BRK)",
    },
    {
        "year": 2027,
        "round": 1,
        "original_owner": "NYK",
        "current_owner_id": 2,
        "is_swap": False,
        "protection": None,
        "details": "NYK",
    },
    {
        "year": 2027,
        "round": 2,
        "original_owner": "BRK/DAL",
        "current_owner_id": 2,
        "is_swap": True,
        "protection": None,
        "details": "More favorable of BRK and DAL to WAS, then other to MIL (via DAL to BRK to DET to MIL; via DET to WAS)",
    },

    # 2028
    {
        "year": 2028,
        "round": 1,
        "original_owner": "BRK/PHI/PHX/NYK",
        "current_owner_id": 2,
        "is_swap": True,
        "protection": "PHL 9-30 conditional",
        "details": "If (I) PHL 9-30 is third most favorable and (II) NYK is most or second most favorable of BRK, PHL 9-30, PHX and NYK, then most and third most favorable to BRK; or most/two most favorable to BRK in all other scenarios; least favorable of BRK, PHX and NYK to NYK if PHL 9-30 is less favorable than BRK and PHX; or second most favorable of BRK, PHX and NYK to NYK in all other scenarios. More favorable of (I) WAS and (II) least/less favorable of BRK, PHL 9-30 and PHX to WAS then least favorable of all to PHX (WAS can then swap with MIL).",
    },
    {
        "year": 2028,
        "round": 2,
        "original_owner": "BRK",
        "current_owner_id": 2,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2028,
        "round": 2,
        "original_owner": "ATL",
        "current_owner_id": 2,
        "is_swap": False,
        "protection": None,
        "details": "ATL (via GOS)",
    },
    {
        "year": 2028,
        "round": 2,
        "original_owner": "MEM",
        "current_owner_id": 2,
        "is_swap": False,
        "protection": None,
        "details": "MEM (via PHX)",
    },
    {
        "year": 2028,
        "round": 2,
        "original_owner": "PHL",
        "current_owner_id": 2,
        "is_swap": False,
        "protection": None,
        "details": "PHL 1-8 in 2028",
    },

    # 2029
    {
        "year": 2029,
        "round": 1,
        "original_owner": "BRK",
        "current_owner_id": 2,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2029,
        "round": 1,
        "original_owner": "DAL/PHX/HOU",
        "current_owner_id": 2,
        "is_swap": True,
        "protection": None,
        "details": "Least favorable of DAL, PHX and HOU (via DAL and PHX to BRK; via DAL or PHX to HOU; via HOU swap for DAL or PHX)",
    },
    {
        "year": 2029,
        "round": 1,
        "original_owner": "NYK",
        "current_owner_id": 2,
        "is_swap": False,
        "protection": None,
        "details": "NYK",
    },
    {
        "year": 2029,
        "round": 2,
        "original_owner": "BRK",
        "current_owner_id": 2,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2029,
        "round": 2,
        "original_owner": "DAL",
        "current_owner_id": 2,
        "is_swap": False,
        "protection": None,
        "details": "DAL",
    },
    {
        "year": 2029,
        "round": 2,
        "original_owner": "GOS",
        "current_owner_id": 2,
        "is_swap": False,
        "protection": None,
        "details": "GOS",
    },
    {
        "year": 2029,
        "round": 2,
        "original_owner": "MEM",
        "current_owner_id": 2,
        "is_swap": False,
        "protection": None,
        "details": "MEM (via PHX)",
    },

    # 2030
    {
        "year": 2030,
        "round": 1,
        "original_owner": "BRK",
        "current_owner_id": 2,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2030,
        "round": 2,
        "original_owner": "BRK",
        "current_owner_id": 2,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2030,
        "round": 2,
        "original_owner": "BOS",
        "current_owner_id": 2,
        "is_swap": False,
        "protection": None,
        "details": "BOS (via HOU)",
    },
    {
        "year": 2030,
        "round": 2,
        "original_owner": "DAL",
        "current_owner_id": 2,
        "is_swap": False,
        "protection": None,
        "details": "DAL (via BOS to MEM)",
    },
    {
        "year": 2030,
        "round": 2,
        "original_owner": "LAL",
        "current_owner_id": 2,
        "is_swap": False,
        "protection": None,
        "details": "LAL",
    },

    # 2031
    {
        "year": 2031,
        "round": 1,
        "original_owner": "BRK",
        "current_owner_id": 2,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2031,
        "round": 1,
        "original_owner": "NYK",
        "current_owner_id": 2,
        "is_swap": False,
        "protection": None,
        "details": "NYK",
    },
    {
        "year": 2031,
        "round": 2,
        "original_owner": "BRK",
        "current_owner_id": 2,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2031,
        "round": 2,
        "original_owner": "LAL",
        "current_owner_id": 2,
        "is_swap": False,
        "protection": None,
        "details": "LAL",
    },

    # 2032
    {
        "year": 2032,
        "round": 1,
        "original_owner": "BRK",
        "current_owner_id": 2,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2032,
        "round": 1,
        "original_owner": "DEN",
        "current_owner_id": 2,
        "is_swap": False,
        "protection": None,
        "details": "DEN",
    },
    {
        "year": 2032,
        "round": 2,
        "original_owner": "BRK",
        "current_owner_id": 2,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2032,
        "round": 2,
        "original_owner": "DEN",
        "current_owner_id": 2,
        "is_swap": False,
        "protection": None,
        "details": "DEN",
    },
    {
        "year": 2032,
        "round": 2,
        "original_owner": "MIA",
        "current_owner_id": 2,
        "is_swap": False,
        "protection": None,
        "details": "MIA",
    },
    {
        "year": 2032,
        "round": 2,
        "original_owner": "TOR",
        "current_owner_id": 2,
        "is_swap": False,
        "protection": None,
        "details": "TOR",
    },

    # 2033
    {
        "year": 2033,
        "round": 1,
        "original_owner": "BRK",
        "current_owner_id": 2,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2033,
        "round": 2,
        "original_owner": "BRK",
        "current_owner_id": 2,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
]

boston_draft_picks = [
    # 2027
    {
        "year": 2027,
        "round": 1,
        "original_owner": "BOS",
        "current_owner_id": 1,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    # 2028
    {
        "year": 2028,
        "round": 1,
        "original_owner": "BOS/SAN",
        "current_owner_id": 1,
        "is_swap": True,
        "protection": "Protected 1",
        "details": "1 Own; 2-30 Own or SAN via SAN swap for BOS; BOS then has a complex swap right with PHL",
    },
    {
        "year": 2028,
        "round": 1,
        "original_owner": "LAC/PHI",
        "current_owner_id": 1,
        "is_swap": True,
        "protection": "LAC 17-30; PHI 1-8",
        "details": "LAC 17-30 or, by swap from BOS, more favorable of (i) less favorable of BOS and SAN and (ii) more favorable of PHL 1-8 and LAC 1-16; if PHL 9-30, then LAC 1-16. Least favorable of all goes to PHL.",
    },
    {
        "year": 2028,
        "round": 2,
        "original_owner": "BOS/SAN/NYK",
        "current_owner_id": 1,
        "is_swap": False,
        "protection": "31-45 to SAN if BOS 1",
        "details": "31-45 to SAN if BOS picks 1st in 2028; 46-60 to NYK (via ORL to PHX)",
    },
    {
        "year": 2028,
        "round": 2,
        "original_owner": "GSW/MIL/OKC",
        "current_owner_id": 1,
        "is_swap": False,
        "protection": None,
        "details": "Most favorable of GSW, MIL and OKC (via GSW to POR to WAS to PHL; via MIL to BRK to HOU to OKC to PHL; via OKC to PHL)",
    },

    # 2029
    # 2030
    {
        "year": 2030,
        "round": 1,
        "original_owner": "BOS",
        "current_owner_id": 1,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2030,
        "round": 2,
        "original_owner": "CHA",
        "current_owner_id": 1,
        "is_swap": False,
        "protection": "Protected 31-55",
        "details": "CHA 56-60",
    },
    {
        "year": 2030,
        "round": 2,
        "original_owner": "PHX/POR/WAS",
        "current_owner_id": 1,
        "is_swap": False,
        "protection": None,
        "details": "Most favorable of PHX, POR and WAS (via PHX and POR to WAS to PHL)",
    },

    # 2031
    {
        "year": 2031,
        "round": 1,
        "original_owner": "BOS",
        "current_owner_id": 1,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2031,
        "round": 1,
        "original_owner": "PHI",
        "current_owner_id": 1,
        "is_swap": False,
        "protection": None,
        "details": "PHI",
    },
    {
        "year": 2031,
        "round": 2,
        "original_owner": "BOS/CLE",
        "current_owner_id": 1,
        "is_swap": True,
        "protection": "HOU 56-60",
        "details": "Less favorable of BOS and CLE then other to UTH (via CLE to ATL to BOS); HOU 56-60",
    },
    {
        "year": 2031,
        "round": 2,
        "original_owner": "HOU",
        "current_owner_id": 1,
        "is_swap": False,
        "protection": "Protected 56-60",
        "details": "HOU 56-60",
    },
    # 2032
    {
        "year": 2032,
        "round": 1,
        "original_owner": "BOS",
        "current_owner_id": 1,
        "is_swap": False,
        "protection": "Frozen through 2027-28",
        "details": "Frozen (through 2027-28)",
    },
    {
        "year": 2032,
        "round": 2,
        "original_owner": "BOS",
        "current_owner_id": 1,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },

    # 2033
    {
        "year": 2033,
        "round": 1,
        "original_owner": "BOS",
        "current_owner_id": 1,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2033,
        "round": 2,
        "original_owner": "BOS",
        "current_owner_id": 1,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
]
chicago_draft_picks = [
    # 2027
    {
        "year": 2027,
        "round": 1,
        "original_owner": "CHI",
        "current_owner_id": 6,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2027,
        "round": 2,
        "original_owner": "CLE",
        "current_owner_id": 6,
        "is_swap": False,
        "protection": None,
        "details": "CLE (via ATL to MIN)",
    },
    # 2028
    {
        "year": 2028,
        "round": 1,
        "original_owner": "CHI",
        "current_owner_id": 6,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2028,
        "round": 2,
        "original_owner": "CHI/IND/PHX",
        "current_owner_id": 6,
        "is_swap": True,
        "protection": None,
        "details": "Most favorable of CHI, IND and PHX; less favorable of (I) CHI and (II) more favorable of IND and PHX to IND (via PHX to IND; via CHI swap for IND or PHX)",
    },
    # 2029
    {
        "year": 2029,
        "round": 1,
        "original_owner": "CHI",
        "current_owner_id": 6,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2029,
        "round": 2,
        "original_owner": "CHI",
        "current_owner_id": 6,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2029,
        "round": 2,
        "original_owner": "DET/MIL/NYK",
        "current_owner_id": 6,
        "is_swap": True,
        "protection": None,
        "details": "Least favorable of DET, MIL and NYK (via MIL to BRK to DET; via NYK to DET; via SAC to CHI)",
    },
    # 2030
    {
        "year": 2030,
        "round": 1,
        "original_owner": "CHI",
        "current_owner_id": 6,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2030,
        "round": 2,
        "original_owner": "CHI/IND",
        "current_owner_id": 6,
        "is_swap": True,
        "protection": None,
        "details": "Own or swap for IND",
    },
    # 2031
    {
        "year": 2031,
        "round": 1,
        "original_owner": "CHI",
        "current_owner_id": 6,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2031,
        "round": 2,
        "original_owner": "CHI",
        "current_owner_id": 6,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2031,
        "round": 2,
        "original_owner": "DEN",
        "current_owner_id": 6,
        "is_swap": False,
        "protection": None,
        "details": "DEN (via PHX to CHA)",
    },
    {
        "year": 2031,
        "round": 2,
        "original_owner": "MIN/GOS",
        "current_owner_id": 6,
        "is_swap": True,
        "protection": None,
        "details": "More favorable of MIN and GOS (via MIN swap for GOS)",
    },
    {
        "year": 2031,
        "round": 2,
        "original_owner": "NYK",
        "current_owner_id": 6,
        "is_swap": False,
        "protection": None,
        "details": "NYK (via CHA)",
    },
    # 2032
    {
        "year": 2032,
        "round": 1,
        "original_owner": "CHI",
        "current_owner_id": 6,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2032,
        "round": 2,
        "original_owner": "CHI",
        "current_owner_id": 6,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2032,
        "round": 2,
        "original_owner": "PHX/HOU",
        "current_owner_id": 6,
        "is_swap": True,
        "protection": None,
        "details": "More favorable of PHX and HOU (via PHX to MIN)",
    },
    # 2033
    {
        "year": 2033,
        "round": 1,
        "original_owner": "CHI",
        "current_owner_id": 6,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2033,
        "round": 2,
        "original_owner": "CHI",
        "current_owner_id": 6,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
]

cleveland_draft_picks = [
    # 2028
    {
        "year": 2028,
        "round": 1,
        "original_owner": "CLE/UTH/ATL",
        "current_owner_id": 7,
        "is_swap": True,
        "protection": None,
        "details": "Least favorable of CLE, UTH and ATL; less favorable of (I) more favorable of CLE and UTH and (II) LAL to LAL then most favorable of all to UTH; more favorable of (I) ATL and (II) less favorable of CLE and UTH to ATL (via UTH swap for CLE; via UTH swap of UTH or CLE for LAL; via ATL swap for CLE or UTH)",
    },
    # 2030
    {
        "year": 2030,
        "round": 1,
        "original_owner": "CLE",
        "current_owner_id": 7,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    # 2032
    {
        "year": 2032,
        "round": 1,
        "original_owner": "CLE",
        "current_owner_id": 7,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    # 2033
    {
        "year": 2033,
        "round": 1,
        "original_owner": "CLE",
        "current_owner_id": 7,
        "is_swap": False,
        "protection": "Frozen through 2028-29",
        "details": "Frozen (through 2028-29)",
    },
    {
        "year": 2033,
        "round": 2,
        "original_owner": "CLE",
        "current_owner_id": 7,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
]

charlotte_draft_picks = [
    # 2027
    {
        "year": 2027,
        "round": 1,
        "original_owner": "CHA",
        "current_owner_id": 13,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2027,
        "round": 1,
        "original_owner": "DAL",
        "current_owner_id": 13,
        "is_swap": False,
        "protection": "Protected 1-2",
        "details": "DAL 3-30",
    },
    {
        "year": 2027,
        "round": 1,
        "original_owner": "MIA",
        "current_owner_id": 13,
        "is_swap": False,
        "protection": "Protected 1-14",
        "details": "MIA 15-30",
    },
    {
        "year": 2027,
        "round": 2,
        "original_owner": "MEM",
        "current_owner_id": 13,
        "is_swap": False,
        "protection": None,
        "details": "MEM (via LAC to HOU)",
    },
    {
        "year": 2027,
        "round": 2,
        "original_owner": "POR/NOP",
        "current_owner_id": 13,
        "is_swap": True,
        "protection": None,
        "details": "More favorable of POR and NOP (via POR)",
    },
    # 2028
    {
        "year": 2028,
        "round": 1,
        "original_owner": "CHA/MIN",
        "current_owner_id": 13,
        "is_swap": True,
        "protection": None,
        "details": "Own or swap for MIN",
    },
    {
        "year": 2028,
        "round": 1,
        "original_owner": "MIA",
        "current_owner_id": 13,
        "is_swap": False,
        "protection": "Conditional",
        "details": "MIA if not already settled",
    },
    {
        "year": 2028,
        "round": 2,
        "original_owner": "CHA/LAC",
        "current_owner_id": 13,
        "is_swap": True,
        "protection": None,
        "details": "More favorable of CHA and LAC then other to DET [DET may convey to UTH] (via CHA to DAL)",
    },
    {
        "year": 2028,
        "round": 2,
        "original_owner": "HOU",
        "current_owner_id": 13,
        "is_swap": False,
        "protection": None,
        "details": "HOU",
    },
    {
        "year": 2028,
        "round": 2,
        "original_owner": "MIA",
        "current_owner_id": 13,
        "is_swap": False,
        "protection": "Conditional",
        "details": "MIA if DAL does not convey 1st round pick to CHA in 2027 (via SAN to DAL)",
    },
    {
        "year": 2028,
        "round": 2,
        "original_owner": "ORL",
        "current_owner_id": 13,
        "is_swap": False,
        "protection": None,
        "details": "ORL",
    },
    # 2029
    {
        "year": 2029,
        "round": 1,
        "original_owner": "CHA",
        "current_owner_id": 13,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2029,
        "round": 1,
        "original_owner": "UTH/CLE/MIN",
        "current_owner_id": 13,
        "is_swap": True,
        "protection": "Protected 1-5 (MIN)",
        "details": "Least / less favorable of UTH, CLE and MIN 6-30 (via UTH to PHX); CHA will also have a complex swap right with MIN and PHX will receive a least favorable pick",
    },
    {
        "year": 2029,
        "round": 2,
        "original_owner": "CHA",
        "current_owner_id": 13,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2029,
        "round": 2,
        "original_owner": "ATL/MIA",
        "current_owner_id": 13,
        "is_swap": True,
        "protection": None,
        "details": "More favorable of ATL and MIA (via OKC)",
    },
    {
        "year": 2029,
        "round": 2,
        "original_owner": "DEN",
        "current_owner_id": 13,
        "is_swap": False,
        "protection": "Conditional",
        "details": "DEN if DEN has conveyed a first potential 1st round pick to OKC by 2029",
    },
    {
        "year": 2029,
        "round": 2,
        "original_owner": "MIN",
        "current_owner_id": 13,
        "is_swap": False,
        "protection": "Conditional",
        "details": "MIN if MIN conveys 1st round pick to UTH in 2029",
    },
    # 2030
    {
        "year": 2030,
        "round": 1,
        "original_owner": "CHA",
        "current_owner_id": 13,
        "is_swap": True,
        "protection": None,
        "details": "Own; CHA will have a complex swap right with MIN, receiving MIN, SAN or DAL",
    },
    {
        "year": 2030,
        "round": 2,
        "original_owner": "CHA",
        "current_owner_id": 13,
        "is_swap": False,
        "protection": "Protected 31-55",
        "details": "31-55 Own; 56-60 to BOS",
    },
    {
        "year": 2030,
        "round": 2,
        "original_owner": "UTH/LAC",
        "current_owner_id": 13,
        "is_swap": True,
        "protection": None,
        "details": "More favorable of UTH and LAC (via UTH)",
    },
    # 2031
    {
        "year": 2031,
        "round": 1,
        "original_owner": "CHA",
        "current_owner_id": 13,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2031,
        "round": 2,
        "original_owner": "CHA",
        "current_owner_id": 13,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2031,
        "round": 2,
        "original_owner": "MIL",
        "current_owner_id": 13,
        "is_swap": False,
        "protection": None,
        "details": "MIL",
    },
    {
        "year": 2031,
        "round": 2,
        "original_owner": "PHX",
        "current_owner_id": 13,
        "is_swap": False,
        "protection": None,
        "details": "PHX",
    },
    # 2032
    {
        "year": 2032,
        "round": 1,
        "original_owner": "CHA",
        "current_owner_id": 13,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2032,
        "round": 2,
        "original_owner": "CHA",
        "current_owner_id": 13,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2032,
        "round": 2,
        "original_owner": "MIL",
        "current_owner_id": 13,
        "is_swap": False,
        "protection": None,
        "details": "MIL",
    },
    {
        "year": 2032,
        "round": 2,
        "original_owner": "MIN",
        "current_owner_id": 13,
        "is_swap": False,
        "protection": None,
        "details": "MIN",
    },
    # 2033
    {
        "year": 2033,
        "round": 1,
        "original_owner": "CHA",
        "current_owner_id": 13,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2033,
        "round": 1,
        "original_owner": "MIN",
        "current_owner_id": 13,
        "is_swap": False,
        "protection": None,
        "details": "MIN",
    },
    {
        "year": 2033,
        "round": 1,
        "original_owner": "PHX",
        "current_owner_id": 13,
        "is_swap": False,
        "protection": None,
        "details": "PHX",
    },
    {
        "year": 2033,
        "round": 2,
        "original_owner": "CHA",
        "current_owner_id": 13,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2033,
        "round": 2,
        "original_owner": "HOU",
        "current_owner_id": 13,
        "is_swap": False,
        "protection": None,
        "details": "HOU",
    },
    {
        "year": 2033,
        "round": 2,
        "original_owner": "MIN",
        "current_owner_id": 13,
        "is_swap": False,
        "protection": None,
        "details": "MIN",
    },
]

dallas_draft_picks = [
    # 2027
    {
        "year": 2027,
        "round": 1,
        "original_owner": "DAL",
        "current_owner_id": 26,
        "is_swap": False,
        "protection": "Protected 1-2",
        "details": "1-2 Own; 3-30 to CHA",
    },
    {
        "year": 2027,
        "round": 2,
        "original_owner": "ATL",
        "current_owner_id": 26,
        "is_swap": False,
        "protection": "Protected 56-60",
        "details": "ATL 56-60",
    },
    # 2028
    {
        "year": 2028,
        "round": 1,
        "original_owner": "DAL/OKC",
        "current_owner_id": 26,
        "is_swap": True,
        "protection": None,
        "details": "Own or OKC (via OKC swap for DAL)",
    },
    # 2029
    {
        "year": 2029,
        "round": 1,
        "original_owner": "LAL",
        "current_owner_id": 26,
        "is_swap": False,
        "protection": None,
        "details": "LAL",
    },
    # 2030
    {
        "year": 2030,
        "round": 1,
        "original_owner": "DAL/SAN/MIN",
        "current_owner_id": 26,
        "is_swap": True,
        "protection": None,
        "details": "Own or SAN (via SAN swap for DAL); less favorable of (I) MIN 2-30 and (II) more favorable of DAL and SAN [or MIN if MIN not conveyable] to MIN then most / more favorable of all to SAN [MIN may convey to CHA] (via SAN swap for DAL; via SAN swap of SAN or DAL for MIN)",
    },
    # 2031
    {
        "year": 2031,
        "round": 1,
        "original_owner": "DAL",
        "current_owner_id": 26,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    # 2032
    {
        "year": 2032,
        "round": 1,
        "original_owner": "DAL",
        "current_owner_id": 26,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    # 2033
    {
        "year": 2033,
        "round": 1,
        "original_owner": "DAL",
        "current_owner_id": 26,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
]

denver_draft_picks = [
    # 2027
    {
        "year": 2027,
        "round": 1,
        "original_owner": "DEN",
        "current_owner_id": 16,
        "is_swap": True,
        "protection": "Protected 1-5",
        "details": "1-5 Own; two most / more favorable of DEN 6-30, OKC and LAC to OKC; more favorable of (I) least / less favorable of DEN 6-30, OKC and LAC and (II) TOR to LAC then least favorable of all to TOR (via OKC swap of OKC or DEN for LAC; via LAC swap of DEN, OKC or LAC for TOR)",
    },
    # 2028
    {
        "year": 2028,
        "round": 1,
        "original_owner": "DEN",
        "current_owner_id": 16,
        "is_swap": False,
        "protection": "Protected 1-5",
        "details": "1-5 Own; 6-30 to OKC if not already settled",
    },
    {
        "year": 2028,
        "round": 2,
        "original_owner": "DEN",
        "current_owner_id": 16,
        "is_swap": False,
        "protection": "Protected 31-33",
        "details": "31-33 Own; 34-60 to WAS (via SAN to SAC)",
    },
    {
        "year": 2028,
        "round": 2,
        "original_owner": "MIN",
        "current_owner_id": 16,
        "is_swap": False,
        "protection": None,
        "details": "MIN (via SAN)",
    },
    # 2029
    {
        "year": 2029,
        "round": 1,
        "original_owner": "DEN",
        "current_owner_id": 16,
        "is_swap": False,
        "protection": "Protected 1-5",
        "details": "1-5 Own; 6-30 to OKC if not already settled; or 1-5 Own; 6-30 to OKC if DEN conveys a first potential 1st round pick to OKC in 2027",
    },
    # 2030
    {
        "year": 2030,
        "round": 1,
        "original_owner": "DEN",
        "current_owner_id": 16,
        "is_swap": False,
        "protection": "Protected 1-5",
        "details": "1-5 Own; 6-30 to OKC if not already settled and if DEN has conveyed a first potential 1st round pick to OKC by 2028",
    },
    # 2031
    {
        "year": 2031,
        "round": 1,
        "original_owner": "DEN",
        "current_owner_id": 16,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2031,
        "round": 1,
        "original_owner": "CLE",
        "current_owner_id": 16,
        "is_swap": False,
        "protection": None,
        "details": "CLE",
    },
    {
        "year": 2031,
        "round": 2,
        "original_owner": "SAC",
        "current_owner_id": 16,
        "is_swap": False,
        "protection": None,
        "details": "SAC (via SAN)",
    },
    # 2032
    {
        "year": 2032,
        "round": 2,
        "original_owner": "SAC",
        "current_owner_id": 16,
        "is_swap": False,
        "protection": None,
        "details": "SAC (via CLE)",
    },
    # 2033
    {
        "year": 2033,
        "round": 1,
        "original_owner": "DEN",
        "current_owner_id": 16,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2033,
        "round": 2,
        "original_owner": "DEN",
        "current_owner_id": 16,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
]

detroit_draft_picks = [
    # 2027
    {
        "year": 2027,
        "round": 1,
        "original_owner": "DET",
        "current_owner_id": 8,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2027,
        "round": 2,
        "original_owner": "DET",
        "current_owner_id": 8,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    # 2028
    {
        "year": 2028,
        "round": 1,
        "original_owner": "DET",
        "current_owner_id": 8,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2028,
        "round": 2,
        "original_owner": "DET",
        "current_owner_id": 8,
        "is_swap": False,
        "protection": "Protected 31-55",
        "details": "31-55 Own; 56-60 to PHL",
    },
    {
        "year": 2028,
        "round": 2,
        "original_owner": "CHA/LAC",
        "current_owner_id": 8,
        "is_swap": True,
        "protection": None,
        "details": "Less favorable of CHA and LAC (via CHA to DAL; least / less favorable of these to UTH)",
    },
    {
        "year": 2028,
        "round": 2,
        "original_owner": "NYK",
        "current_owner_id": 8,
        "is_swap": False,
        "protection": None,
        "details": "NYK (least / less favorable of these to UTH)",
    },
    {
        "year": 2028,
        "round": 2,
        "original_owner": "MIA",
        "current_owner_id": 8,
        "is_swap": False,
        "protection": "Conditional",
        "details": "MIA if DAL conveys 1st round pick to CHA in 2027 (via SAN to DAL; least / less favorable of these to UTH)",
    },
    # 2029
    {
        "year": 2029,
        "round": 1,
        "original_owner": "DET",
        "current_owner_id": 8,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2029,
        "round": 2,
        "original_owner": "DET/MIL/NYK",
        "current_owner_id": 8,
        "is_swap": True,
        "protection": None,
        "details": "Most favorable of DET, MIL and NYK (via MIL to BRK to DET; via NYK to DET; via SAC to CHI)",
    },
    {
        "year": 2029,
        "round": 2,
        "original_owner": "DET/MIL/NYK",
        "current_owner_id": 8,
        "is_swap": True,
        "protection": None,
        "details": "Second most favorable of DET, MIL and NYK then other to CHI (via MIL to BRK to DET; via NYK to DET; via DET to MEM; via MEM to DET; via SAC to CHI)",
    },
    # 2030
    {
        "year": 2030,
        "round": 1,
        "original_owner": "DET",
        "current_owner_id": 8,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2030,
        "round": 2,
        "original_owner": "DET",
        "current_owner_id": 8,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    # 2031
    {
        "year": 2031,
        "round": 1,
        "original_owner": "DET",
        "current_owner_id": 8,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2031,
        "round": 2,
        "original_owner": "DAL",
        "current_owner_id": 8,
        "is_swap": False,
        "protection": None,
        "details": "DAL (via PHL to DET to MEM)",
    },
    {
        "year": 2031,
        "round": 2,
        "original_owner": "GOS/MIN",
        "current_owner_id": 8,
        "is_swap": True,
        "protection": None,
        "details": "Less favorable of GOS and MIN (via MIN swap for GOS)",
    },
    # 2032
    {
        "year": 2032,
        "round": 1,
        "original_owner": "DET",
        "current_owner_id": 8,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2032,
        "round": 2,
        "original_owner": "DET",
        "current_owner_id": 8,
        "is_swap": False,
        "protection": None,
        "details": "Own (via MEM)",
    },
    # 2033
    {
        "year": 2033,
        "round": 1,
        "original_owner": "DET",
        "current_owner_id": 8,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2033,
        "round": 2,
        "original_owner": "DET",
        "current_owner_id": 8,
        "is_swap": False,
        "protection": "Heavily protected",
        "details": "Own (DET heavily protected and unspecified 2nd round pick to LAC)",
    },
]

golden_state_draft_picks = [
    # 2027
    {
        "year": 2027,
        "round": 1,
        "original_owner": "GSW",
        "current_owner_id": 21,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    # 2028
    {
        "year": 2028,
        "round": 1,
        "original_owner": "GSW",
        "current_owner_id": 21,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    # 2029
    {
        "year": 2029,
        "round": 1,
        "original_owner": "GSW",
        "current_owner_id": 21,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    # 2030
    {
        "year": 2030,
        "round": 1,
        "original_owner": "GSW",
        "current_owner_id": 21,
        "is_swap": False,
        "protection": "Protected 1-20",
        "details": "1-20 Own; 21-30 to MEM (via WAS to DAL)",
    },
    {
        "year": 2030,
        "round": 2,
        "original_owner": "GSW",
        "current_owner_id": 21,
        "is_swap": False,
        "protection": "Conditional",
        "details": "Own; To MEM if GOS does not convey 1st round pick to MEM in 2030 (via WAS to DAL)",
    },
    # 2031
    {
        "year": 2031,
        "round": 1,
        "original_owner": "GSW",
        "current_owner_id": 21,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    # 2032
    {
        "year": 2032,
        "round": 1,
        "original_owner": "GSW",
        "current_owner_id": 21,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2032,
        "round": 2,
        "original_owner": "GSW",
        "current_owner_id": 21,
        "is_swap": False,
        "protection": "Protected 31-50",
        "details": "31-50 Own; 51-60 to MEM",
    },
    # 2033
    {
        "year": 2033,
        "round": 1,
        "original_owner": "GSW",
        "current_owner_id": 21,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2033,
        "round": 2,
        "original_owner": "GSW",
        "current_owner_id": 21,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
]

houston_draft_picks = [
    # 2027
    {
        "year": 2027,
        "round": 1,
        "original_owner": "HOU/BRK",
        "current_owner_id": 27,
        "is_swap": True,
        "protection": None,
        "details": "Own or swap for BRK",
    },
    {
        "year": 2027,
        "round": 1,
        "original_owner": "PHX",
        "current_owner_id": 27,
        "is_swap": False,
        "protection": None,
        "details": "PHX (via BRK)",
    },
    {
        "year": 2027,
        "round": 2,
        "original_owner": "POR/NOP",
        "current_owner_id": 27,
        "is_swap": True,
        "protection": "Protected 56-60",
        "details": "Less favorable of POR and NOP if 56-60 (via POR to BOS)",
    },
    # 2028
    {
        "year": 2028,
        "round": 1,
        "original_owner": "HOU",
        "current_owner_id": 27,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    # 2029
    {
        "year": 2029,
        "round": 1,
        "original_owner": "HOU/DAL/PHX",
        "current_owner_id": 27,
        "is_swap": True,
        "protection": None,
        "details": "Most favorable of HOU, DAL and PHX (via DAL and PHX to BRK; via DAL or PHX to HOU; via HOU swap for DAL or PHX)",
    },
    {
        "year": 2029,
        "round": 1,
        "original_owner": "HOU/DAL/PHX",
        "current_owner_id": 27,
        "is_swap": True,
        "protection": None,
        "details": "Second most favorable of HOU, DAL and PHX then other to BRK (via DAL and PHX to BRK; via DAL or PHX to HOU; via HOU swap for DAL or PHX)",
    },
    # 2030
    {
        "year": 2030,
        "round": 1,
        "original_owner": "HOU",
        "current_owner_id": 27,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    # 2031
    {
        "year": 2031,
        "round": 1,
        "original_owner": "HOU",
        "current_owner_id": 27,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2031,
        "round": 2,
        "original_owner": "HOU/ATL",
        "current_owner_id": 27,
        "is_swap": True,
        "protection": "Protected 31-55",
        "details": "Less favorable of HOU 31-55 and ATL then other [or ATL if HOU 56-60] to OKC (via ATL swap for HOU); 56-60 to BOS",
    },
    # 2032
    {
        "year": 2032,
        "round": 1,
        "original_owner": "HOU",
        "current_owner_id": 27,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    # 2033
    {
        "year": 2033,
        "round": 1,
        "original_owner": "HOU",
        "current_owner_id": 27,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
]

indiana_draft_picks = [
    # 2027
    {
        "year": 2027,
        "round": 1,
        "original_owner": "IND",
        "current_owner_id": 9,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2027,
        "round": 2,
        "original_owner": "UTH",
        "current_owner_id": 9,
        "is_swap": False,
        "protection": None,
        "details": "UTH (via CLE)",
    },
    # 2028
    {
        "year": 2028,
        "round": 1,
        "original_owner": "IND",
        "current_owner_id": 9,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2028,
        "round": 2,
        "original_owner": "IND/PHX/CHI",
        "current_owner_id": 9,
        "is_swap": True,
        "protection": None,
        "details": "Less favorable of (i) more favorable of IND and PHX and (ii) CHI then most favorable of all to CHI; less favorable of IND and PHX to NYK (via PHX to IND; via CHI swap for IND or PHX)",
    },
    # 2029
    {
        "year": 2029,
        "round": 2,
        "original_owner": "IND/WAS",
        "current_owner_id": 9,
        "is_swap": True,
        "protection": None,
        "details": "More favorable of IND and WAS then other to POR (via IND to NYK)",
    },
    # 2030
    {
        "year": 2030,
        "round": 1,
        "original_owner": "IND",
        "current_owner_id": 9,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2030,
        "round": 2,
        "original_owner": "IND/CHI",
        "current_owner_id": 9,
        "is_swap": True,
        "protection": None,
        "details": "Own or CHI (via CHI swap for IND)",
    },
    # 2031
    {
        "year": 2031,
        "round": 1,
        "original_owner": "IND",
        "current_owner_id": 9,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2031,
        "round": 2,
        "original_owner": "IND/MIA/MEM",
        "current_owner_id": 9,
        "is_swap": True,
        "protection": None,
        "details": "Least favorable of IND, MIA and MEM; more favorable of IND and MIA to WAS; more favorable of (i) MEM and (ii) less favorable of IND and MIA to MEM (via MIA swap for IND; via UTH to WAS; via MEM swap for IND or MIA)",
    },
    # 2032
    {
        "year": 2032,
        "round": 1,
        "original_owner": "IND",
        "current_owner_id": 9,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2032,
        "round": 2,
        "original_owner": "IND",
        "current_owner_id": 9,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    # 2033
    {
        "year": 2033,
        "round": 1,
        "original_owner": "IND",
        "current_owner_id": 9,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2033,
        "round": 2,
        "original_owner": "IND",
        "current_owner_id": 9,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
]

clippers_draft_picks = [
    # 2027
    {
        "year": 2027,
        "round": 1,
        "original_owner": "LAC/DEN/OKC/TOR",
        "current_owner_id": 22,
        "is_swap": True,
        "protection": None,
        "details": "More favorable of (i) least / less favorable of LAC, DEN 6-30 and OKC and (ii) TOR then least favorable of all to TOR; two most / more favorable of LAC, DEN 6-30 and OKC to OKC (via OKC swap of OKC or DEN for LAC; via LAC swap of LAC, DEN or OKC for TOR)",
    },
    # 2028
    {
        "year": 2028,
        "round": 2,
        "original_owner": "DAL",
        "current_owner_id": 22,
        "is_swap": False,
        "protection": None,
        "details": "DAL (via SAC to IND)",
    },
    # 2029
    {
        "year": 2029,
        "round": 1,
        "original_owner": "LAC/PHL",
        "current_owner_id": 22,
        "is_swap": True,
        "protection": "Protected 1-3",
        "details": "1-3 Own; 4-30 Own or PHL (via PHL swap for LAC); Forfeited by LAC: IND",
    },
    # 2030
    {
        "year": 2030,
        "round": 2,
        "original_owner": "TOR",
        "current_owner_id": 22,
        "is_swap": False,
        "protection": None,
        "details": "TOR (More favorable of LAC and UTH to CHA then other to LAC via LAC to UTH)",
    },
    # 2031
    {
        "year": 2031,
        "round": 1,
        "original_owner": "TOR",
        "current_owner_id": 22,
        "is_swap": False,
        "protection": None,
        "details": "TOR (Own forfeited)",
    },
    {
        "year": 2031,
        "round": 2,
        "original_owner": "LAC",
        "current_owner_id": 22,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    # 2032
    {
        "year": 2032,
        "round": 2,
        "original_owner": "LAC",
        "current_owner_id": 22,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    # 2033
    {
        "year": 2033,
        "round": 1,
        "original_owner": "TOR",
        "current_owner_id": 22,
        "is_swap": False,
        "protection": None,
        "details": "TOR (Own forfeited)",
    },
    {
        "year": 2033,
        "round": 2,
        "original_owner": "LAC",
        "current_owner_id": 22,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2033,
        "round": 2,
        "original_owner": "TOR",
        "current_owner_id": 22,
        "is_swap": False,
        "protection": None,
        "details": "TOR (DET heavily protected and unspecified 2nd round pick to LAC)",
    },
]

lakers_draft_picks = [
    # 2027
    {
        "year": 2027,
        "round": 1,
        "original_owner": "LAL",
        "current_owner_id": 23,
        "is_swap": False,
        "protection": "Protected 1-4",
        "details": "1-4 Own; 5-30 to MEM (via UTH)",
    },
    # 2028
    {
        "year": 2028,
        "round": 1,
        "original_owner": "LAL/UTH/CLE",
        "current_owner_id": 23,
        "is_swap": True,
        "protection": None,
        "details": "Less favorable of (i) LAL and (ii) more favorable of UTH and CLE then most favorable of all to UTH (via UTH swap for CLE; via UTH swap of UTH or CLE for LAL)",
    },
    # 2030
    {
        "year": 2030,
        "round": 1,
        "original_owner": "LAL/UTH",
        "current_owner_id": 23,
        "is_swap": True,
        "protection": None,
        "details": "Own or UTH (via UTH swap for LAL)",
    },
    # 2031
    {
        "year": 2031,
        "round": 2,
        "original_owner": "WAS",
        "current_owner_id": 23,
        "is_swap": False,
        "protection": None,
        "details": "WAS (Own to BRK)",
    },
    # 2032
    {
        "year": 2032,
        "round": 1,
        "original_owner": "LAL",
        "current_owner_id": 23,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2032,
        "round": 2,
        "original_owner": "WAS",
        "current_owner_id": 23,
        "is_swap": False,
        "protection": None,
        "details": "WAS (Own to OKC via ATL)",
    },
    # 2033
    {
        "year": 2033,
        "round": 2,
        "original_owner": "LAL",
        "current_owner_id": 23,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
]

memphis_draft_picks = [
    # 2027
    {
        "year": 2027,
        "round": 1,
        "original_owner": "MEM",
        "current_owner_id": 28,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2027,
        "round": 1,
        "original_owner": "LAL",
        "current_owner_id": 28,
        "is_swap": False,
        "protection": "Protected 1-4",
        "details": "LAL 5-30 (via UTH)",
    },
    {
        "year": 2027,
        "round": 1,
        "original_owner": "UTH/CLE/MIN",
        "current_owner_id": 28,
        "is_swap": True,
        "protection": "Protected 1-5 (UTH)",
        "details": "Most favorable of UTH (cannot be 1-5), CLE and MIN (via UTH)",
    },
    {
        "year": 2027,
        "round": 2,
        "original_owner": "LAL",
        "current_owner_id": 28,
        "is_swap": False,
        "protection": "Conditional",
        "details": "LAL if LAL does not convey 1st round pick to MEM in 2027 (via UTH)",
    },
    # 2028
    {
        "year": 2028,
        "round": 1,
        "original_owner": "MEM",
        "current_owner_id": 28,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    # 2029
    {
        "year": 2029,
        "round": 1,
        "original_owner": "MEM/ORL",
        "current_owner_id": 28,
        "is_swap": True,
        "protection": "Protected 1-2 (ORL)",
        "details": "Own or swap for ORL 3-30",
    },
    {
        "year": 2029,
        "round": 2,
        "original_owner": "HOU",
        "current_owner_id": 28,
        "is_swap": False,
        "protection": None,
        "details": "HOU (via OKC to WAS to DAL)",
    },
    {
        "year": 2029,
        "round": 2,
        "original_owner": "LAL",
        "current_owner_id": 28,
        "is_swap": False,
        "protection": None,
        "details": "LAL (via WAS)",
    },
    {
        "year": 2029,
        "round": 2,
        "original_owner": "ORL",
        "current_owner_id": 28,
        "is_swap": False,
        "protection": "Conditional",
        "details": "ORL if ORL 1-2 in 2029",
    },
    {
        "year": 2029,
        "round": 2,
        "original_owner": "POR",
        "current_owner_id": 28,
        "is_swap": False,
        "protection": None,
        "details": "POR (via PHL to IND)",
    },
    # 2030
    {
        "year": 2030,
        "round": 1,
        "original_owner": "MEM/PHX/WAS",
        "current_owner_id": 28,
        "is_swap": True,
        "protection": None,
        "details": "More favorable of (I) MEM and (II) less favorable of PHX and WAS then least favorable of all to PHX (via WAS swap for PHX; via MEM swap for PHX or WAS)",
    },
    {
        "year": 2030,
        "round": 1,
        "original_owner": "GOS",
        "current_owner_id": 28,
        "is_swap": False,
        "protection": "Protected 1-20",
        "details": "GOS 21-30 (via WAS to DAL)",
    },
    {
        "year": 2030,
        "round": 1,
        "original_owner": "ORL",
        "current_owner_id": 28,
        "is_swap": False,
        "protection": None,
        "details": "ORL",
    },
    {
        "year": 2030,
        "round": 2,
        "original_owner": "MEM",
        "current_owner_id": 28,
        "is_swap": False,
        "protection": "Protected 31-50",
        "details": "31-50 Own; 51-60 to MIN",
    },
    {
        "year": 2030,
        "round": 2,
        "original_owner": "DEN/HOU/MIA",
        "current_owner_id": 28,
        "is_swap": True,
        "protection": None,
        "details": "Most favorable of DEN, HOU and MIA (via DEN to CHA to OKC or DEN to OKC; via OKC to MEM)",
    },
    {
        "year": 2030,
        "round": 2,
        "original_owner": "GOS",
        "current_owner_id": 28,
        "is_swap": False,
        "protection": "Conditional",
        "details": "GOS if GOS does not convey 1st round pick to MEM in 2030 (via WAS to DAL)",
    },
    # 2031
    {
        "year": 2031,
        "round": 1,
        "original_owner": "MEM",
        "current_owner_id": 28,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2031,
        "round": 1,
        "original_owner": "PHX",
        "current_owner_id": 28,
        "is_swap": False,
        "protection": None,
        "details": "PHX (via UTH)",
    },
    {
        "year": 2031,
        "round": 2,
        "original_owner": "MEM/IND/MIA",
        "current_owner_id": 28,
        "is_swap": True,
        "protection": None,
        "details": "More favorable of (I) MEM and (II) less favorable of IND and MIA then least favorable of all to IND (via MIA swap for IND; via MEM swap for IND or MIA)",
    },
    # 2032
    {
        "year": 2032,
        "round": 1,
        "original_owner": "MEM",
        "current_owner_id": 28,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2032,
        "round": 2,
        "original_owner": "MEM/PHL/UTH",
        "current_owner_id": 28,
        "is_swap": True,
        "protection": None,
        "details": "Most favorable of MEM, PHL and UTH; less favorable of (I) more favorable of MEM and PHL and (II) UTH to WAS; less favorable of MEM and PHL to PHL (via MEM swap for PHL; via UTH to WAS; via MEM swap of MEM or PHL for UTH)",
    },
    {
        "year": 2032,
        "round": 2,
        "original_owner": "GOS",
        "current_owner_id": 28,
        "is_swap": False,
        "protection": "Protected 1-50",
        "details": "GOS 51-60",
    },
    # 2033
    {
        "year": 2033,
        "round": 1,
        "original_owner": "MEM",
        "current_owner_id": 28,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2033,
        "round": 2,
        "original_owner": "MEM",
        "current_owner_id": 28,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2033,
        "round": 2,
        "original_owner": "OKC",
        "current_owner_id": 28,
        "is_swap": False,
        "protection": None,
        "details": "OKC",
    },
    {
        "year": 2033,
        "round": 2,
        "original_owner": "WAS",
        "current_owner_id": 28,
        "is_swap": False,
        "protection": None,
        "details": "WAS (NOP unspecified 2nd round pick to MEM; NOP unspecified 2nd round pick swap to MEM)",
    },
]

miami_draft_picks = [
    # 2027
    {
        "year": 2027,
        "round": 1,
        "original_owner": "MIA",
        "current_owner_id": 11,
        "is_swap": False,
        "protection": "Protected 1-14",
        "details": "1-14 Own; 15-30 to CHA",
    },
    {
        "year": 2027,
        "round": 2,
        "original_owner": "MIA/OKC/HOU/IND/SAN",
        "current_owner_id": 11,
        "is_swap": True,
        "protection": None,
        "details": "Least favorable of MIA, OKC, HOU, IND and SAN; most favorable of MIA, OKC, HOU and IND to PHL; second most favorable to NOP and third most favorable to NYK; more favorable of (I) SAN and (II) least favorable of MIA, OKC, HOU and IND to SAN (via MIA and IND to OKC to UTH to SAN to MIA; via HOU to DET to OKC to NYK to NOP; via OKC to PHL)",
    },
    # 2028
    {
        "year": 2028,
        "round": 1,
        "original_owner": "MIA",
        "current_owner_id": 11,
        "is_swap": False,
        "protection": "Conditional",
        "details": "To CHA if not already settled; Own if settled in 2027",
    },
    # 2029
    {
        "year": 2029,
        "round": 1,
        "original_owner": "MIA",
        "current_owner_id": 11,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    # 2030
    {
        "year": 2030,
        "round": 1,
        "original_owner": "MIA/MIL/POR",
        "current_owner_id": 11,
        "is_swap": True,
        "protection": None,
        "details": "Least favorable of MIA, MIL and POR; more favorable of (I) MIA and (ii) less favorable MIL and POR to MIL (via POR swap for MIL; via MIL swap of MIL or POR for MIA)",
    },
    # 2032
    {
        "year": 2032,
        "round": 1,
        "original_owner": "MIA",
        "current_owner_id": 11,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
]

milwaukee_draft_picks = [
    # 2027
    {
        "year": 2027,
        "round": 2,
        "original_owner": "MIL",
        "current_owner_id": 10,
        "is_swap": False,
        "protection": None,
        "details": "Own (via PHL to DET)",
    },
    {
        "year": 2027,
        "round": 2,
        "original_owner": "BRK/DAL",
        "current_owner_id": 10,
        "is_swap": True,
        "protection": None,
        "details": "Less favorable of BRK and DAL (via DAL to BRK to DET to MIL)",
    },
    # 2028
    {
        "year": 2028,
        "round": 1,
        "original_owner": "MIL/POR/WAS/BRK/PHL/PHX",
        "current_owner_id": 10,
        "is_swap": True,
        "protection": "PHL 9-30 conditional",
        "details": "Less favorable of (I) less favorable of MIL and POR and (II) more favorable of (a) WAS and (b) least / less favorable of BRK, PHL 9-30 and PHX then more favorable of (I) and (II) to WAS (via POR swap for MIL; via BRK swap of BRK or PHL for PHX; via WAS swap for PHX, BRK or PHL; via WAS swap of WAS, BRK, PHL or PHX for MIL or POR)",
    },
    # 2030
    {
        "year": 2030,
        "round": 1,
        "original_owner": "MIL/POR/MIA",
        "current_owner_id": 10,
        "is_swap": True,
        "protection": None,
        "details": "More favorable of (I) less favorable MIL and POR and (II) MIA then least favorable of all to MIA; more favorable of MIL and POR to POR (via POR swap for MIL; via MIL swap of MIL or POR for MIA)",
    },
    # 2031
    {
        "year": 2031,
        "round": 1,
        "original_owner": "MIL",
        "current_owner_id": 10,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2031,
        "round": 1,
        "original_owner": "MIA",
        "current_owner_id": 10,
        "is_swap": False,
        "protection": None,
        "details": "MIA",
    },
    # 2032
    {
        "year": 2032,
        "round": 1,
        "original_owner": "MIL",
        "current_owner_id": 10,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    # 2033
    {
        "year": 2033,
        "round": 1,
        "original_owner": "MIL",
        "current_owner_id": 10,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2033,
        "round": 1,
        "original_owner": "MIA",
        "current_owner_id": 10,
        "is_swap": False,
        "protection": None,
        "details": "MIA",
    },
    {
        "year": 2033,
        "round": 2,
        "original_owner": "MIL",
        "current_owner_id": 10,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2033,
        "round": 2,
        "original_owner": "MIA",
        "current_owner_id": 10,
        "is_swap": False,
        "protection": None,
        "details": "MIA",
    },
]

minnesota_draft_picks = [
    # 2028
    {
        "year": 2028,
        "round": 1,
        "original_owner": "MIN/CHA",
        "current_owner_id": 17,
        "is_swap": True,
        "protection": None,
        "details": "Own or CHA (via CHA swap for MIN)",
    },
    # 2029
    {
        "year": 2029,
        "round": 1,
        "original_owner": "MIN",
        "current_owner_id": 17,
        "is_swap": True,
        "protection": "Protected 1-5",
        "details": "1-5 Own; most / two most favorable of MIN 6-30, CLE and UTH to UTH then other to CHA (via CLE and MIN to UTH; via UTH to PHX to CHA; via CHA swap of CHA, CLE or UTH for MIN); CHA will also have a complex swap right with MIN and PHX will receive a least favorable pick",
    },
    # 2030
    {
        "year": 2030,
        "round": 1,
        "original_owner": "MIN/SAN/DAL",
        "current_owner_id": 17,
        "is_swap": True,
        "protection": "Protected 1",
        "details": "1 Own; less favorable of (I) MIN 2-30 and (II) more favorable of SAN and DAL then most / more favorable of all to SAN [MIN may convey to CHA] (via SAN swap for DAL; via SAN swap of SAN or DAL for MIN); CHA will have a complex swap right with MIN, receiving MIN, SAN or DAL",
    },
    {
        "year": 2030,
        "round": 2,
        "original_owner": "MEM",
        "current_owner_id": 17,
        "is_swap": False,
        "protection": "Protected 1-50",
        "details": "MEM 51-60 (Own to OKC via DET)",
    },
    # 2032
    {
        "year": 2032,
        "round": 1,
        "original_owner": "MIN",
        "current_owner_id": 17,
        "is_swap": False,
        "protection": "Frozen through 2027-28",
        "details": "Frozen (through 2027-28)",
    },
]

new_orleans_draft_picks = [
    # 2027
    {
        "year": 2027,
        "round": 1,
        "original_owner": "NOP/MIL",
        "current_owner_id": 29,
        "is_swap": True,
        "protection": None,
        "details": "More favorable of NOP and MIL then other to ATL if 5-30 or NOP and MIL if both 1-4 (via NOP)",
    },
    {
        "year": 2027,
        "round": 1,
        "original_owner": "NOP/MIL",
        "current_owner_id": 29,
        "is_swap": False,
        "protection": "Protected 1-4 (MIL & NOP)",
        "details": "Less favorable of NOP and MIL if both 1-4 (via NOP)",
    },
    {
        "year": 2027,
        "round": 2,
        "original_owner": "OKC/HOU/IND/MIA",
        "current_owner_id": 29,
        "is_swap": True,
        "protection": None,
        "details": "Second most favorable of OKC, HOU, IND and MIA (via HOU to DET to OKC to NYK)",
    },
    # 2028
    {
        "year": 2028,
        "round": 1,
        "original_owner": "NOP",
        "current_owner_id": 29,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    # 2029
    {
        "year": 2029,
        "round": 1,
        "original_owner": "NOP",
        "current_owner_id": 29,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    # 2030
    {
        "year": 2030,
        "round": 1,
        "original_owner": "NOP",
        "current_owner_id": 29,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2030,
        "round": 2,
        "original_owner": "NOP/ORL",
        "current_owner_id": 29,
        "is_swap": True,
        "protection": None,
        "details": "Own or ORL (via ORL swap for NOP)",
    },
    # 2031
    {
        "year": 2031,
        "round": 1,
        "original_owner": "NOP",
        "current_owner_id": 29,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2031,
        "round": 2,
        "original_owner": "TOR",
        "current_owner_id": 29,
        "is_swap": False,
        "protection": None,
        "details": "TOR (More favorable of NOP and ORL to ORL then other to OKC via ORL swap for NOP)",
    },
    # 2032
    {
        "year": 2032,
        "round": 1,
        "original_owner": "NOP",
        "current_owner_id": 29,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2032,
        "round": 2,
        "original_owner": "NOP",
        "current_owner_id": 29,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    # 2033
    {
        "year": 2033,
        "round": 1,
        "original_owner": "NOP",
        "current_owner_id": 29,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2033,
        "round": 2,
        "original_owner": "NOP",
        "current_owner_id": 29,
        "is_swap": False,
        "protection": None,
        "details": "Own (NOP unspecified 2nd round pick and pick swap to MEM)",
    },
]

new_york_draft_picks = [
    # 2027
    {
        "year": 2027,
        "round": 2,
        "original_owner": "NYK",
        "current_owner_id": 3,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2027,
        "round": 2,
        "original_owner": "OKC/HOU/IND/MIA",
        "current_owner_id": 3,
        "is_swap": True,
        "protection": None,
        "details": "Third most favorable of OKC, HOU, IND and MIA (via HOU to DET to OKC)",
    },
    {
        "year": 2027,
        "round": 2,
        "original_owner": "WAS",
        "current_owner_id": 3,
        "is_swap": False,
        "protection": None,
        "details": "WAS (via HOU to OKC)",
    },
    # 2028
    {
        "year": 2028,
        "round": 1,
        "original_owner": "NYK/BRK/PHX",
        "current_owner_id": 3,
        "is_swap": True,
        "protection": "PHL 9-30 conditional",
        "details": "Least favorable of NYK, BRK and PHX if NYK and / or if PHL 9-30 is less favorable than BRK and PHX; or second most favorable of NYK, BRK and PHX in all other scenarios; If (I) PHL 9-30 is third most favorable and (II) NYK is most or second most favorable of NYK, BRK, PHL 9-30 and PHX, then most and third most favorable to BRK; or most / two most favorable to BRK in all other scenarios (via BRK swap of BRK or PHL for PHX; via BRK swap of BRK or PHX for NYK; via WAS swap for PHX, BRK or PHL)",
    },
    {
        "year": 2028,
        "round": 2,
        "original_owner": "BOS",
        "current_owner_id": 3,
        "is_swap": False,
        "protection": "Protected 1-45",
        "details": "BOS 46-60 (via ORL to PHX; Own to DET)",
    },
    {
        "year": 2028,
        "round": 2,
        "original_owner": "IND/PHX",
        "current_owner_id": 3,
        "is_swap": True,
        "protection": None,
        "details": "Less favorable of IND and PHX (via IND)",
    },
    # 2029
    {
        "year": 2029,
        "round": 2,
        "original_owner": "PHX",
        "current_owner_id": 3,
        "is_swap": False,
        "protection": None,
        "details": "PHX (Two most favorable of NYK, DET and MIL to DET then other to CHI via MIL to BRK to DET; via NYK to DET; via DET to MEM; via MEM to DET; via SAC to CHI)",
    },
    {
        "year": 2029,
        "round": 2,
        "original_owner": "SAC",
        "current_owner_id": 3,
        "is_swap": False,
        "protection": None,
        "details": "SAC (via WAS to HOU)",
    },
    # 2030
    {
        "year": 2030,
        "round": 1,
        "original_owner": "NYK",
        "current_owner_id": 3,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2030,
        "round": 2,
        "original_owner": "PHL",
        "current_owner_id": 3,
        "is_swap": False,
        "protection": None,
        "details": "PHL (via DAL; Own to ATL via POR)",
    },
    # 2032
    {
        "year": 2032,
        "round": 1,
        "original_owner": "NYK",
        "current_owner_id": 3,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2032,
        "round": 2,
        "original_owner": "NYK",
        "current_owner_id": 3,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2032,
        "round": 2,
        "original_owner": "DAL",
        "current_owner_id": 3,
        "is_swap": False,
        "protection": None,
        "details": "DAL",
    },
    # 2033
    {
        "year": 2033,
        "round": 1,
        "original_owner": "NYK",
        "current_owner_id": 3,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2033,
        "round": 2,
        "original_owner": "NYK",
        "current_owner_id": 3,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2033,
        "round": 2,
        "original_owner": "PHX",
        "current_owner_id": 3,
        "is_swap": False,
        "protection": None,
        "details": "PHX",
    },
]

oklahoma_city_draft_picks = [
    # 2027
    {
        "year": 2027,
        "round": 1,
        "original_owner": "OKC/DEN/LAC",
        "current_owner_id": 18,
        "is_swap": True,
        "protection": "DEN 6-30 conditional",
        "details": "Most favorable of OKC, DEN 6-30 and LAC (via OKC swap of OKC or DEN for LAC; via LAC swap of DEN, OKC or LAC for TOR)",
    },
    {
        "year": 2027,
        "round": 1,
        "original_owner": "OKC/DEN/LAC",
        "current_owner_id": 18,
        "is_swap": True,
        "protection": "DEN 6-30 conditional",
        "details": "Second most favorable of OKC, DEN 6-30 and LAC (via OKC swap of OKC or DEN for LAC; via LAC swap of DEN, OKC or LAC for TOR)",
    },
    {
        "year": 2027,
        "round": 1,
        "original_owner": "SAN",
        "current_owner_id": 18,
        "is_swap": False,
        "protection": "Protected 1-16",
        "details": "SAN 17-30 (via SAC)",
    },
    {
        "year": 2027,
        "round": 2,
        "original_owner": "CHI",
        "current_owner_id": 18,
        "is_swap": False,
        "protection": None,
        "details": "CHI (via WAS to NOP to WAS to DAL)",
    },
    {
        "year": 2027,
        "round": 2,
        "original_owner": "CHA",
        "current_owner_id": 18,
        "is_swap": False,
        "protection": "SAN 1-16 conditional",
        "details": "CHA if SAN 1-16 in 2027 (via SAC)",
    },
    {
        "year": 2027,
        "round": 2,
        "original_owner": "SAC",
        "current_owner_id": 18,
        "is_swap": False,
        "protection": "SAN 1-16 conditional",
        "details": "SAC if SAN 1-16 in 2027",
    },
    # 2028
    {
        "year": 2028,
        "round": 1,
        "original_owner": "OKC/DAL",
        "current_owner_id": 18,
        "is_swap": True,
        "protection": None,
        "details": "Own or swap for DAL",
    },
    {
        "year": 2028,
        "round": 1,
        "original_owner": "DEN",
        "current_owner_id": 18,
        "is_swap": False,
        "protection": "Protected 1-5",
        "details": "DEN 6-30 if not already settled",
    },
    {
        "year": 2028,
        "round": 2,
        "original_owner": "UTH",
        "current_owner_id": 18,
        "is_swap": False,
        "protection": None,
        "details": "UTH (Most favorable of OKC, GOS and MIL to BOS then others to PHL via OKC to PHL; GOS to POR to WAS to PHL; via MIL to BRK to HOU to OKC to PHL)",
    },
    # 2029
    {
        "year": 2029,
        "round": 1,
        "original_owner": "OKC",
        "current_owner_id": 18,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2029,
        "round": 1,
        "original_owner": "DEN",
        "current_owner_id": 18,
        "is_swap": False,
        "protection": "Protected 1-5",
        "details": "DEN 6-30 if not already settled; or DEN 6-30 if DEN conveys a first potential 1st round pick to OKC in 2027",
    },
    {
        "year": 2029,
        "round": 2,
        "original_owner": "OKC",
        "current_owner_id": 18,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2029,
        "round": 2,
        "original_owner": "ATL/MIA",
        "current_owner_id": 18,
        "is_swap": True,
        "protection": None,
        "details": "Less favorable of ATL and MIA",
    },
    {
        "year": 2029,
        "round": 2,
        "original_owner": "BOS",
        "current_owner_id": 18,
        "is_swap": False,
        "protection": None,
        "details": "BOS",
    },
    {
        "year": 2029,
        "round": 2,
        "original_owner": "DEN",
        "current_owner_id": 18,
        "is_swap": False,
        "protection": "Conditional",
        "details": "DEN if DEN has not conveyed a first potential 1st round pick to OKC by 2029",
    },
    # 2030
    {
        "year": 2030,
        "round": 1,
        "original_owner": "OKC",
        "current_owner_id": 18,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2030,
        "round": 1,
        "original_owner": "DEN",
        "current_owner_id": 18,
        "is_swap": False,
        "protection": "Protected 1-5",
        "details": "DEN 6-30 if not already settled and if DEN has conveyed a first potential 1st round pick to OKC by 2028",
    },
    {
        "year": 2030,
        "round": 2,
        "original_owner": "OKC",
        "current_owner_id": 18,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2030,
        "round": 2,
        "original_owner": "ATL",
        "current_owner_id": 18,
        "is_swap": False,
        "protection": None,
        "details": "ATL",
    },
    {
        "year": 2030,
        "round": 2,
        "original_owner": "DEN/HOU/MIA",
        "current_owner_id": 18,
        "is_swap": True,
        "protection": None,
        "details": "Second most favorable of DEN, HOU and MIA (via DEN to CHA to OKC or DEN to OKC)",
    },
    {
        "year": 2030,
        "round": 2,
        "original_owner": "DEN/HOU/MIA",
        "current_owner_id": 18,
        "is_swap": True,
        "protection": None,
        "details": "Least favorable of DEN, HOU and MIA (via DEN to CHA to OKC or DEN to OKC)",
    },
    {
        "year": 2030,
        "round": 2,
        "original_owner": "MIN",
        "current_owner_id": 18,
        "is_swap": False,
        "protection": None,
        "details": "MIN (via DET)",
    },
    # 2031
    {
        "year": 2031,
        "round": 1,
        "original_owner": "OKC",
        "current_owner_id": 18,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2031,
        "round": 2,
        "original_owner": "OKC",
        "current_owner_id": 18,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2031,
        "round": 2,
        "original_owner": "ATL/HOU",
        "current_owner_id": 18,
        "is_swap": True,
        "protection": None,
        "details": "More favorable of ATL and HOU 31-55 [or ATL if HOU 56-60] (via ATL swap for HOU)",
    },
    {
        "year": 2031,
        "round": 2,
        "original_owner": "DET",
        "current_owner_id": 18,
        "is_swap": False,
        "protection": None,
        "details": "DET",
    },
    {
        "year": 2031,
        "round": 2,
        "original_owner": "NOP/ORL",
        "current_owner_id": 18,
        "is_swap": True,
        "protection": None,
        "details": "Less favorable of NOP and ORL (via ORL swap for NOP)",
    },
    # 2032
    {
        "year": 2032,
        "round": 1,
        "original_owner": "OKC",
        "current_owner_id": 18,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2032,
        "round": 2,
        "original_owner": "OKC",
        "current_owner_id": 18,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2032,
        "round": 2,
        "original_owner": "ATL",
        "current_owner_id": 18,
        "is_swap": False,
        "protection": None,
        "details": "ATL (via LAL to ATL; via LAL to ATL)",
    },
    {
        "year": 2032,
        "round": 2,
        "original_owner": "LAL",
        "current_owner_id": 18,
        "is_swap": False,
        "protection": None,
        "details": "LAL (via ATL; via ATL)",
    },
    # 2033
    {
        "year": 2033,
        "round": 1,
        "original_owner": "OKC",
        "current_owner_id": 18,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
]

orlando_draft_picks = [
    # 2027
    {
        "year": 2027,
        "round": 1,
        "original_owner": "ORL",
        "current_owner_id": 14,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    # 2028
    {
        "year": 2028,
        "round": 2,
        "original_owner": "LAL/WAS",
        "current_owner_id": 14,
        "is_swap": True,
        "protection": None,
        "details": "More favorable of LAL and WAS (via LAL; Own 1st to POR via MEM; Own 2nd to CHA)",
    },
    # 2029
    {
        "year": 2029,
        "round": 1,
        "original_owner": "ORL/MEM",
        "current_owner_id": 14,
        "is_swap": True,
        "protection": "Protected 1-2",
        "details": "1-2 Own; 3-30 Own or MEM (via MEM swap for ORL)",
    },
    {
        "year": 2029,
        "round": 2,
        "original_owner": "ORL",
        "current_owner_id": 14,
        "is_swap": False,
        "protection": "Conditional",
        "details": "Own (To MEM if ORL 1-2 in 2029)",
    },
    # 2030
    {
        "year": 2030,
        "round": 2,
        "original_owner": "ORL/NOP",
        "current_owner_id": 14,
        "is_swap": True,
        "protection": None,
        "details": "Own or swap for NOP (Own 1st to MEM)",
    },
    {
        "year": 2030,
        "round": 2,
        "original_owner": "MIL",
        "current_owner_id": 14,
        "is_swap": False,
        "protection": None,
        "details": "MIL",
    },
    # 2031
    {
        "year": 2031,
        "round": 1,
        "original_owner": "ORL",
        "current_owner_id": 14,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2031,
        "round": 2,
        "original_owner": "ORL/NOP",
        "current_owner_id": 14,
        "is_swap": True,
        "protection": None,
        "details": "More favorable of ORL and NOP then other to OKC (via ORL swap for NOP)",
    },
    # 2032
    {
        "year": 2032,
        "round": 1,
        "original_owner": "ORL",
        "current_owner_id": 14,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2032,
        "round": 2,
        "original_owner": "ORL",
        "current_owner_id": 14,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    # 2033
    {
        "year": 2033,
        "round": 1,
        "original_owner": "ORL",
        "current_owner_id": 14,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2033,
        "round": 2,
        "original_owner": "ORL",
        "current_owner_id": 14,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
]

philadelphia_draft_picks = [
    # 2027
    {
        "year": 2027,
        "round": 1,
        "original_owner": "PHI",
        "current_owner_id": 4,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2027,
        "round": 2,
        "original_owner": "PHI/GOS/PHX/OKC/HOU/IND/MIA",
        "current_owner_id": 4,
        "is_swap": True,
        "protection": None,
        "details": "Most favorable of (I) PHI, (II) more favorable of GOS and PHX, and (III) most favorable of OKC, HOU, IND and MIA; second most favorable of these to WAS (via WAS; via HOU to DET to OKC; via IND and MIA to OKC; via OKC to PHL)",
    },
    {
        "year": 2027,
        "round": 2,
        "original_owner": "PHI/GOS/PHX/OKC/HOU/IND/MIA",
        "current_owner_id": 4,
        "is_swap": True,
        "protection": None,
        "details": "Least favorable of (I) PHI, (II) more favorable of GOS and PHX, and (III) most favorable of OKC, HOU, IND and MIA; second most favorable of these to WAS (via WAS; via HOU to DET to OKC; via IND and MIA to OKC; via OKC to PHL)",
    },
    # 2028
    {
        "year": 2028,
        "round": 1,
        "original_owner": "PHI/LAC/BOS/SAN",
        "current_owner_id": 4,
        "is_swap": True,
        "protection": "Protected 1-8",
        "details": "1-8 Own if LAC 17-30; or [via swap from BOS] least favorable of (I) PHL 1-8, LAC 1-16, BOS and SAN or (II) LAC 1-16, BOS and SAN; more favorable of (I) more favorable of PHL 1-8 and LAC 1-16 [or (i) LAC 1-16 if PHL 9-30] and (II) less favorable of BOS and SAN to BOS (via SAN swap for BOS; via BOS swap of BOS or SAN for PHL or LAC)",
    },
    {
        "year": 2028,
        "round": 2,
        "original_owner": "PHI",
        "current_owner_id": 4,
        "is_swap": False,
        "protection": "Conditional",
        "details": "Own if PHL 9-30 in 2028; To BRK if PHL 1-8 in 2028",
    },
    {
        "year": 2028,
        "round": 2,
        "original_owner": "DET",
        "current_owner_id": 4,
        "is_swap": False,
        "protection": "Protected 1-55",
        "details": "DET 56-60",
    },
    {
        "year": 2028,
        "round": 2,
        "original_owner": "GOS/MIL/OKC",
        "current_owner_id": 4,
        "is_swap": True,
        "protection": None,
        "details": "Second most favorable of GOS, MIL and OKC (via GOS to POR to WAS; via MIL to BRK to HOU to OKC; most favorable to BOS)",
    },
    {
        "year": 2028,
        "round": 2,
        "original_owner": "GOS/MIL/OKC",
        "current_owner_id": 4,
        "is_swap": True,
        "protection": None,
        "details": "Least favorable of GOS, MIL and OKC (via GOS to POR to WAS; via MIL to BRK to HOU to OKC; most favorable to BOS)",
    },
    # 2029
    {
        "year": 2029,
        "round": 1,
        "original_owner": "PHI/LAC",
        "current_owner_id": 4,
        "is_swap": True,
        "protection": "Protected 1-3 (LAC)",
        "details": "Own or swap for LAC 4-30",
    },
    {
        "year": 2029,
        "round": 2,
        "original_owner": "PHI",
        "current_owner_id": 4,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    # 2030
    {
        "year": 2030,
        "round": 1,
        "original_owner": "PHI",
        "current_owner_id": 4,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2030,
        "round": 2,
        "original_owner": "PHX/POR/WAS",
        "current_owner_id": 4,
        "is_swap": True,
        "protection": None,
        "details": "Less favorable of (i) more favorable of PHX and POR and (ii) WAS (via PHX and POR to WAS; Own to NYK via DAL)",
    },
    # 2031
    {
        "year": 2031,
        "round": 2,
        "original_owner": "PHI",
        "current_owner_id": 4,
        "is_swap": False,
        "protection": None,
        "details": "Own (Own 1st to BOS)",
    },
    # 2032
    {
        "year": 2032,
        "round": 1,
        "original_owner": "PHI",
        "current_owner_id": 4,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2032,
        "round": 2,
        "original_owner": "PHI/MEM/UTH",
        "current_owner_id": 4,
        "is_swap": True,
        "protection": None,
        "details": "Less favorable of PHL and MEM; less favorable of (I) more favorable of PHL and MEM and (II) UTH to WAS then most favorable of all to MEM (via MEM swap for PHL; via UTH to WAS; via MEM swap of MEM or PHL for UTH)",
    },
    # 2033
    {
        "year": 2033,
        "round": 1,
        "original_owner": "PHI",
        "current_owner_id": 4,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2033,
        "round": 2,
        "original_owner": "PHI",
        "current_owner_id": 4,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
]

phoenix_draft_picks = [
    # 2027
    {
        "year": 2027,
        "round": 1,
        "original_owner": "UTH/CLE/MIN",
        "current_owner_id": 24,
        "is_swap": True,
        "protection": "Protected 1-5 (UTH)",
        "details": "Least favorable of UTH (cannot be 1-5), CLE and MIN (via UTH; Own to HOU via BRK)",
    },
    {
        "year": 2027,
        "round": 2,
        "original_owner": "BOS/ORL",
        "current_owner_id": 24,
        "is_swap": True,
        "protection": None,
        "details": "Less favorable of BOS and ORL (via BOS to ORL to CHA)",
    },
    # 2028
    {
        "year": 2028,
        "round": 1,
        "original_owner": "PHX/PHI/WAS/BRK/NYK",
        "current_owner_id": 24,
        "is_swap": True,
        "protection": "PHL 9-30 conditional",
        "details": "Least favorable of PHX, PHL 9-30, WAS and BRK; more favorable of (I) WAS and (II) least / less favorable of PHX, PHL 9-30 and BRK to WAS [WAS can then swap with MIL]; If (I) PHL 9-30 is third most favorable and (II) NYK is most or second most favorable of PHX, PHL 9-30, BRK and NYK, then most and third most favorable to BRK; or most / two most favorable to BRK in all other scenarios; least favorable of PHX, BRK and NYK to NYK if NYK and / or if PHL 9-30 is less favorable than PHX and BRK; or second most favorable of PHX, BRK and NYK to NYK in all other scenarios (via BRK swap of BRK or PHL for PHX; via BRK swap of BRK or PHX for NYK; via WAS swap for PHX, BRK or PHL)",
    },
    # 2029
    {
        "year": 2029,
        "round": 1,
        "original_owner": "CHA/MIN/CLE/UTH",
        "current_owner_id": 24,
        "is_swap": True,
        "protection": None,
        "details": "PHX will receive a least favorable pick from a complex CHA-MIN conveyance, including CHA's swap right",
    },
    # 2030
    {
        "year": 2030,
        "round": 1,
        "original_owner": "PHX/WAS/MEM",
        "current_owner_id": 24,
        "is_swap": True,
        "protection": None,
        "details": "Least favorable of PHX, WAS and MEM; more favorable of (I) MEM and (II) less favorable of PHX and WAS to MEM; more favorable of PHX and WAS to WAS (via WAS swap for PHX; via MEM swap for PHX or WAS)",
    },
    # 2032
    {
        "year": 2032,
        "round": 1,
        "original_owner": "PHX",
        "current_owner_id": 24,
        "is_swap": False,
        "protection": "Frozen through 2027-28",
        "details": "Frozen (through 2027-28)",
    },
    {
        "year": 2032,
        "round": 2,
        "original_owner": "PHX/HOU",
        "current_owner_id": 24,
        "is_swap": True,
        "protection": None,
        "details": "Less favorable of PHX and HOU then other to CHI (via PHX to MIN)",
    },
]

portland_draft_picks = [
    # 2027
    {
        "year": 2027,
        "round": 1,
        "original_owner": "POR",
        "current_owner_id": 19,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2027,
        "round": 2,
        "original_owner": "POR/NOP",
        "current_owner_id": 19,
        "is_swap": True,
        "protection": "Protected 56-60",
        "details": "Less favorable of POR and NOP then other to CHA [POR may convey to HOU]; then less favorable of POR and NOP to HOU if 56-60 (via POR to NOP to CHA; via POR to BOS to HOU)",
    },
    {
        "year": 2027,
        "round": 2,
        "original_owner": "MIN",
        "current_owner_id": 19,
        "is_swap": False,
        "protection": None,
        "details": "MIN (via HOU to OKC to NYK)",
    },
    # 2028
    {
        "year": 2028,
        "round": 1,
        "original_owner": "POR/MIL",
        "current_owner_id": 19,
        "is_swap": True,
        "protection": None,
        "details": "Own or swap for MIL [WAS then has a complex swap right with MIL]",
    },
    {
        "year": 2028,
        "round": 1,
        "original_owner": "ORL",
        "current_owner_id": 19,
        "is_swap": False,
        "protection": None,
        "details": "ORL (via MEM)",
    },
    {
        "year": 2028,
        "round": 2,
        "original_owner": "POR",
        "current_owner_id": 19,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2028,
        "round": 2,
        "original_owner": "SAC",
        "current_owner_id": 19,
        "is_swap": False,
        "protection": None,
        "details": "SAC (via CHI to SAC to MEM)",
    },
    # 2029
    {
        "year": 2029,
        "round": 1,
        "original_owner": "POR/BOS/MIL",
        "current_owner_id": 19,
        "is_swap": True,
        "protection": None,
        "details": "Most favorable of POR, BOS and MIL (via BOS to POR; via MIL to POR; via POR to WAS)",
    },
    {
        "year": 2029,
        "round": 1,
        "original_owner": "POR/BOS/MIL",
        "current_owner_id": 19,
        "is_swap": True,
        "protection": None,
        "details": "Least favorable of POR, BOS and MIL (via BOS to POR; via MIL to POR; via POR to WAS)",
    },
    {
        "year": 2029,
        "round": 2,
        "original_owner": "IND/WAS",
        "current_owner_id": 19,
        "is_swap": True,
        "protection": None,
        "details": "Less favorable of IND and WAS (via IND to NYK; Own to MEM via PHL to IND)",
    },
    # 2030
    {
        "year": 2030,
        "round": 1,
        "original_owner": "POR/MIL/MIA",
        "current_owner_id": 19,
        "is_swap": True,
        "protection": None,
        "details": "Own or swap for MIL; more favorable of (I) less favorable MIL and POR and (II) MIA to MIL then least favorable of all to MIA (via POR swap for MIL; via MIL swap of MIL or POR for MIA)",
    },
    # 2031
    {
        "year": 2031,
        "round": 1,
        "original_owner": "POR",
        "current_owner_id": 19,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2031,
        "round": 2,
        "original_owner": "POR",
        "current_owner_id": 19,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    # 2032
    {
        "year": 2032,
        "round": 1,
        "original_owner": "POR",
        "current_owner_id": 19,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2032,
        "round": 2,
        "original_owner": "POR",
        "current_owner_id": 19,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    # 2033
    {
        "year": 2033,
        "round": 1,
        "original_owner": "POR",
        "current_owner_id": 19,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2033,
        "round": 2,
        "original_owner": "POR",
        "current_owner_id": 19,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
]

sacramento_draft_picks = [
    # 2027
    {
        "year": 2027,
        "round": 1,
        "original_owner": "SAC",
        "current_owner_id": 25,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2027,
        "round": 1,
        "original_owner": "SAN",
        "current_owner_id": 25,
        "is_swap": False,
        "protection": "Protected 17-30",
        "details": "SAN 1-16",
    },
    {
        "year": 2027,
        "round": 2,
        "original_owner": "SAC",
        "current_owner_id": 25,
        "is_swap": False,
        "protection": "SAN 1-16 conditional",
        "details": "Own (To OKC if SAN 1-16 in 2027; Own if SAN 17-30 in 2027)",
    },
    {
        "year": 2027,
        "round": 2,
        "original_owner": "CHA",
        "current_owner_id": 25,
        "is_swap": False,
        "protection": "SAN 17-30 conditional",
        "details": "CHA if SAN 17-30 in 2027 (via NYK to ATL to SAN)",
    },
    # 2028
    {
        "year": 2028,
        "round": 1,
        "original_owner": "SAC",
        "current_owner_id": 25,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    # 2029
    {
        "year": 2029,
        "round": 1,
        "original_owner": "SAC",
        "current_owner_id": 25,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    # 2030
    {
        "year": 2030,
        "round": 1,
        "original_owner": "SAC",
        "current_owner_id": 25,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    # 2031
    {
        "year": 2031,
        "round": 1,
        "original_owner": "SAC/SAN",
        "current_owner_id": 25,
        "is_swap": True,
        "protection": None,
        "details": "Own or SAN (via SAN swap for SAC)",
    },
    {
        "year": 2031,
        "round": 1,
        "original_owner": "MIN",
        "current_owner_id": 25,
        "is_swap": False,
        "protection": None,
        "details": "MIN (via SAN)",
    },
    # 2032
    {
        "year": 2032,
        "round": 1,
        "original_owner": "SAC",
        "current_owner_id": 25,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    # 2033
    {
        "year": 2033,
        "round": 1,
        "original_owner": "SAC",
        "current_owner_id": 25,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
]

san_antonio_draft_picks = [
    # 2027
    {
        "year": 2027,
        "round": 1,
        "original_owner": "ATL",
        "current_owner_id": 30,
        "is_swap": False,
        "protection": None,
        "details": "ATL (1-16 to SAC; 17-30 to OKC via SAC)",
    },
    {
        "year": 2027,
        "round": 2,
        "original_owner": "SAN/OKC/HOU/IND/MIA",
        "current_owner_id": 30,
        "is_swap": True,
        "protection": None,
        "details": "More favorable of (I) SAN and (II) least favorable of OKC, HOU, IND and MIA then least favorable of all to MIA (via HOU to DET to OKC; via MIA to OKC to UTH to SAN to MIA)",
    },
    # 2028
    {
        "year": 2028,
        "round": 1,
        "original_owner": "SAN/BOS",
        "current_owner_id": 30,
        "is_swap": True,
        "protection": "Protected 1 (BOS)",
        "details": "Own or swap for BOS 2-30 [BOS then has a complex swap right with PHL]",
    },
    {
        "year": 2028,
        "round": 2,
        "original_owner": "SAN",
        "current_owner_id": 30,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2028,
        "round": 2,
        "original_owner": "BOS",
        "current_owner_id": 30,
        "is_swap": False,
        "protection": "Conditional",
        "details": "BOS 31-45 if BOS 1 in 2028",
    },
    {
        "year": 2028,
        "round": 2,
        "original_owner": "NOP",
        "current_owner_id": 30,
        "is_swap": False,
        "protection": None,
        "details": "NOP",
    },
    # 2029
    {
        "year": 2029,
        "round": 1,
        "original_owner": "SAN",
        "current_owner_id": 30,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2029,
        "round": 2,
        "original_owner": "SAN",
        "current_owner_id": 30,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2029,
        "round": 2,
        "original_owner": "LAC",
        "current_owner_id": 30,
        "is_swap": False,
        "protection": None,
        "details": "LAC (via PHL)",
    },
    {
        "year": 2029,
        "round": 2,
        "original_owner": "NOP",
        "current_owner_id": 30,
        "is_swap": False,
        "protection": None,
        "details": "NOP",
    },
    # 2030
    {
        "year": 2030,
        "round": 1,
        "original_owner": "SAN/DAL/MIN",
        "current_owner_id": 30,
        "is_swap": True,
        "protection": "MIN 1 protected",
        "details": "Most / more favorable of SAN, DAL and MIN 2-30; less favorable of (I) more favorable of SAN and DAL and (II) MIN 2-30 [or MIN if MIN not conveyable] to MIN [MIN may convey to CHA]; less favorable of SAN and DAL to DAL (via SAN swap for DAL; via SAN swap of SAN or DAL for MIN)",
    },
    {
        "year": 2030,
        "round": 2,
        "original_owner": "SAN",
        "current_owner_id": 30,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2030,
        "round": 2,
        "original_owner": "CLE",
        "current_owner_id": 30,
        "is_swap": False,
        "protection": None,
        "details": "CLE",
    },
    {
        "year": 2030,
        "round": 2,
        "original_owner": "SAC",
        "current_owner_id": 30,
        "is_swap": False,
        "protection": None,
        "details": "SAC (via IND)",
    },
    # 2031
    {
        "year": 2031,
        "round": 1,
        "original_owner": "SAN/SAC",
        "current_owner_id": 30,
        "is_swap": True,
        "protection": None,
        "details": "Own or swap for SAC",
    },
    {
        "year": 2031,
        "round": 2,
        "original_owner": "SAN",
        "current_owner_id": 30,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    # 2032
    {
        "year": 2032,
        "round": 1,
        "original_owner": "SAN",
        "current_owner_id": 30,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2032,
        "round": 2,
        "original_owner": "SAN",
        "current_owner_id": 30,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    # 2033
    {
        "year": 2033,
        "round": 1,
        "original_owner": "SAN",
        "current_owner_id": 30,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2033,
        "round": 2,
        "original_owner": "SAN",
        "current_owner_id": 30,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
]

toronto_draft_picks = [
    # 2027
    {
        "year": 2027,
        "round": 1,
        "original_owner": "TOR/LAC/DEN/OKC",
        "current_owner_id": 5,
        "is_swap": True,
        "protection": None,
        "details": "Least / less favorable of TOR, LAC, DEN 6-30 and OKC; more favorable of (I) TOR and (II) least / less favorable of LAC, DEN 6-30 and OKC to LAC (via OKC swap of OKC or DEN for LAC; via LAC swap of LAC, DEN or OKC for TOR)",
    },
    {
        "year": 2027,
        "round": 2,
        "original_owner": "TOR",
        "current_owner_id": 5,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    # 2028
    {
        "year": 2028,
        "round": 1,
        "original_owner": "TOR",
        "current_owner_id": 5,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2028,
        "round": 2,
        "original_owner": "TOR",
        "current_owner_id": 5,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    # 2029
    {
        "year": 2029,
        "round": 1,
        "original_owner": "TOR",
        "current_owner_id": 5,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2029,
        "round": 2,
        "original_owner": "TOR",
        "current_owner_id": 5,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    # 2030
    {
        "year": 2030,
        "round": 1,
        "original_owner": "TOR",
        "current_owner_id": 5,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    # 2032
    {
        "year": 2032,
        "round": 1,
        "original_owner": "TOR",
        "current_owner_id": 5,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
]

utah_draft_picks = [
    # 2027
    {
        "year": 2027,
        "round": 1,
        "original_owner": "UTH/CLE/MIN",
        "current_owner_id": 20,
        "is_swap": True,
        "protection": "Protected 1-5",
        "details": "Second most favorable of UTH (cannot be 1-5), CLE and MIN; most favorable to MEM and least favorable to PHX (via UTH)",
    },
    {
        "year": 2027,
        "round": 2,
        "original_owner": "BOS/ORL",
        "current_owner_id": 20,
        "is_swap": True,
        "protection": None,
        "details": "More favorable of BOS and ORL (via BOS to ORL to BOS)",
    },
    {
        "year": 2027,
        "round": 2,
        "original_owner": "DEN",
        "current_owner_id": 20,
        "is_swap": False,
        "protection": None,
        "details": "DEN (via CLE to CHI to BOS)",
    },
    {
        "year": 2027,
        "round": 2,
        "original_owner": "LAC",
        "current_owner_id": 20,
        "is_swap": False,
        "protection": None,
        "details": "LAC (via ATL to LAC)",
    },
    # 2028
    {
        "year": 2028,
        "round": 1,
        "original_owner": "UTH/CLE/LAL",
        "current_owner_id": 20,
        "is_swap": True,
        "protection": None,
        "details": "Most favorable of UTH, CLE and LAL; less favorable of (I) more favorable of UTH and CLE and (II) LAL to LAL; less favorable of UTH and CLE to CLE [CLE may convey UTH to ATL] (via UTH swap for CLE; via UTH swap of UTH or CLE for LAL)",
    },
    {
        "year": 2028,
        "round": 2,
        "original_owner": "CLE",
        "current_owner_id": 20,
        "is_swap": False,
        "protection": None,
        "details": "CLE",
    },
    {
        "year": 2028,
        "round": 2,
        "original_owner": "DET/CHA/LAC/MIA/NYK",
        "current_owner_id": 20,
        "is_swap": True,
        "protection": None,
        "details": "Least / less favorable of (i) DET 31-55, (ii) less favorable of CHA and LAC (via CHA to DAL), (iii) MIA if DAL conveys 1st round pick to CHA in 2027 (via SAN to DAL) and (iv) NYK",
    },
    # 2029
    {
        "year": 2029,
        "round": 1,
        "original_owner": "UTH/CLE/MIN",
        "current_owner_id": 20,
        "is_swap": True,
        "protection": "Protected 1-5 (MIN)",
        "details": "Most / two most favorable of UTH, CLE and MIN 6-30 to UTH; least / less favorable to CHA (via CLE and MIN to UTH; via UTH to PHX to CHA; via CHA swap of CHA, CLE or UTH for MIN)",
    },
    {
        "year": 2029,
        "round": 1,
        "original_owner": "UTH/CLE/MIN",
        "current_owner_id": 20,
        "is_swap": True,
        "protection": "Protected 1-5 (MIN)",
        "details": "Second most favorable of UTH, CLE and MIN 6-30 to UTH (via CLE and MIN to UTH; via UTH to PHX to CHA; via CHA swap of CHA, CLE or UTH for MIN)",
    },
    {
        "year": 2029,
        "round": 2,
        "original_owner": "UTH",
        "current_owner_id": 20,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2029,
        "round": 2,
        "original_owner": "MIN",
        "current_owner_id": 20,
        "is_swap": False,
        "protection": "Conditional",
        "details": "MIN if MIN does not convey 1st round pick to UTH in 2029",
    },
    # 2030
    {
        "year": 2030,
        "round": 1,
        "original_owner": "UTH/LAL",
        "current_owner_id": 20,
        "is_swap": True,
        "protection": None,
        "details": "Own or swap for LAL",
    },
    {
        "year": 2030,
        "round": 2,
        "original_owner": "UTH/LAC",
        "current_owner_id": 20,
        "is_swap": True,
        "protection": None,
        "details": "Less favorable of UTH and LAC then other to CHA (via LAC to UTH)",
    },
    # 2031
    {
        "year": 2031,
        "round": 1,
        "original_owner": "UTH",
        "current_owner_id": 20,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2031,
        "round": 1,
        "original_owner": "LAL",
        "current_owner_id": 20,
        "is_swap": False,
        "protection": None,
        "details": "LAL",
    },
    {
        "year": 2031,
        "round": 2,
        "original_owner": "UTH",
        "current_owner_id": 20,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2031,
        "round": 2,
        "original_owner": "BOS/CLE",
        "current_owner_id": 20,
        "is_swap": True,
        "protection": None,
        "details": "More favorable of BOS and CLE (via CLE to ATL to BOS)",
    },
    # 2032
    {
        "year": 2032,
        "round": 1,
        "original_owner": "UTH",
        "current_owner_id": 20,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2032,
        "round": 2,
        "original_owner": "CLE",
        "current_owner_id": 20,
        "is_swap": False,
        "protection": None,
        "details": "CLE (Less favorable of UTH and more favorable of MEM and PHL to WAS then most favorable to MEM)",
    },
    # 2033
    {
        "year": 2033,
        "round": 1,
        "original_owner": "UTH",
        "current_owner_id": 20,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2033,
        "round": 1,
        "original_owner": "LAL",
        "current_owner_id": 20,
        "is_swap": False,
        "protection": None,
        "details": "LAL",
    },
    {
        "year": 2033,
        "round": 2,
        "original_owner": "UTH",
        "current_owner_id": 20,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
]

washington_draft_picks = [
    # 2027
    {
        "year": 2027,
        "round": 1,
        "original_owner": "WAS",
        "current_owner_id": 15,
        "is_swap": False,
        "protection": "Protected 1",
        "details": "Own (cannot be 1)",
    },
    {
        "year": 2027,
        "round": 2,
        "original_owner": "BRK/DAL",
        "current_owner_id": 15,
        "is_swap": True,
        "protection": None,
        "details": "More favorable of BRK and DAL (via DAL to BRK to DET to WAS)",
    },
    {
        "year": 2027,
        "round": 2,
        "original_owner": "GOS/PHX",
        "current_owner_id": 15,
        "is_swap": True,
        "protection": None,
        "details": "Less favorable of GOS and PHX",
    },
    {
        "year": 2027,
        "round": 2,
        "original_owner": "PHL/GOS/PHX/OKC/HOU/IND/MIA",
        "current_owner_id": 15,
        "is_swap": True,
        "protection": None,
        "details": "Second most favorable of (i) PHL (via LAC), (ii) more favorable of GOS and PHX (via WAS to LAC) and (iii) most favorable of OKC, HOU, IND and MIA (via HOU to DET to OKC to LAC; via IND and MIA to OKC to LAC)",
    },
    # 2028
    {
        "year": 2028,
        "round": 1,
        "original_owner": "WAS/BRK/PHL/PHX/MIL/POR",
        "current_owner_id": 15,
        "is_swap": True,
        "protection": "PHL 9-30 conditional",
        "details": "More favorable of (I) more favorable of (a) WAS and (b) least / less favorable of BRK, PHL 9-30 and PHX and (II) less favorable of MIL and POR then less favorable of (I) and (II) to MIL; least favorable of WAS, PHL 9-30, BRK and PHX to PHX (via POR swap for MIL; via BRK swap of BRK or PHL for PHX; via WAS swap for PHX, BRK or PHL; via WAS swap of WAS, BRK, PHL or PHX for MIL or POR)",
    },
    {
        "year": 2028,
        "round": 2,
        "original_owner": "WAS/LAL",
        "current_owner_id": 15,
        "is_swap": True,
        "protection": None,
        "details": "Less favorable of WAS and LAL then other to ORL (via WAS to LAL to ORL; via LAL to WAS)",
    },
    {
        "year": 2028,
        "round": 2,
        "original_owner": "DEN",
        "current_owner_id": 15,
        "is_swap": False,
        "protection": "Protected 1-33",
        "details": "DEN 34-60 (via SAN to SAC)",
    },
    # 2029
    {
        "year": 2029,
        "round": 1,
        "original_owner": "WAS",
        "current_owner_id": 15,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2029,
        "round": 1,
        "original_owner": "POR/BOS/MIL",
        "current_owner_id": 15,
        "is_swap": True,
        "protection": None,
        "details": "Second most favorable of POR, BOS and MIL (via BOS to POR; via MIL to POR; via POR to WAS)",
    },
    # 2030
    {
        "year": 2030,
        "round": 1,
        "original_owner": "WAS/PHX/MEM",
        "current_owner_id": 15,
        "is_swap": True,
        "protection": None,
        "details": "More favorable of WAS and PHX; more favorable of (I) MEM and (II) less favorable of WAS and PHX to MEM then least favorable of all to PHX (via WAS swap for PHX; via MEM swap for WAS or PHX)",
    },
    {
        "year": 2030,
        "round": 2,
        "original_owner": "PHX/POR",
        "current_owner_id": 15,
        "is_swap": True,
        "protection": None,
        "details": "Less favorable of PHX and POR (Less favorable of WAS and more favorable of PHX and POR to PHL then most favorable to BOS via PHX and POR to WAS to PHL)",
    },
    # 2031
    {
        "year": 2031,
        "round": 1,
        "original_owner": "WAS",
        "current_owner_id": 15,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2031,
        "round": 2,
        "original_owner": "MIA/IND",
        "current_owner_id": 15,
        "is_swap": True,
        "protection": None,
        "details": "More favorable of MIA and IND (via MIA swap for IND; via UTH; Own to LAL)",
    },
    # 2032
    {
        "year": 2032,
        "round": 1,
        "original_owner": "WAS",
        "current_owner_id": 15,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2032,
        "round": 2,
        "original_owner": "UTH/MEM/PHL",
        "current_owner_id": 15,
        "is_swap": True,
        "protection": None,
        "details": "Less favorable of (i) UTH and (ii) more favorable of MEM and PHL (via MEM swap for PHL; via MEM swap of MEM or PHL for UTH; via UTH to WAS; Own to LAL)",
    },
    # 2033
    {
        "year": 2033,
        "round": 1,
        "original_owner": "WAS",
        "current_owner_id": 15,
        "is_swap": False,
        "protection": None,
        "details": "Own",
    },
    {
        "year": 2033,
        "round": 2,
        "original_owner": "DAL",
        "current_owner_id": 15,
        "is_swap": False,
        "protection": None,
        "details": "DAL (Own to MEM)",
    },
]

# ==============================================================================
#DATASET
# ==============================================================================
# The roster snapshot retains prior-season reference stats as source data, but the API
# response only exposes player stats fetched for the current NBA season.
# Available 2026-27 salaries are stored directly on each player.
teams = [
    {
        "id": 1,
        "name": "Boston Celtics",
        "conference": "Eastern",
        "division": "Atlantic",
        "featured_star": "Jayson Tatum",
        "headline_stat": "26.8 PPG, 8.4 RPG",
        "last_season_record": "56-26",
        "total_salary": 191137932,
        "tax_status": "Luxury Tax",
        "championships": 18,
        "championship_years": [1957, 1959, 1960, 1961, 1962, 1963, 1964, 1965, 1966, 1968, 1969, 1974, 1976, 1981, 1984, 1986, 2008, 2024],
        "logo": "https://cdn.nba.com/logos/nba/1610612738/primary/L/logo.svg",
        "description": "Retooled Eastern front-runner featuring Jayson Tatum, Derrick White, and newly acquired Paul George alongside Mitchell Robinson.",
        "starters_2026_27": [
            {"name":"Derrick White","pos":"PG","stats_season":"2025-26","gp":77,"pts":16.5,"reb":4.4,"ast":5.4,"stl":1.1,"blk":1.3,"tov":1.7,"fg":39.4,"fg3":32.7,"ft":90.2,"salary":28400000},
            {"name":"Baylor Scheierman","pos":"SG","stats_season":"2025-26","gp":77,"pts":5.5,"reb":3.5,"ast":1.5,"stl":0.5,"blk":0.1,"tov":0.6,"fg":45.3,"fg3":39.9,"ft":90.3,"salary":2700000},
            {"name":"Paul George","pos":"SF","stats_season":"2025-26","gp":37,"pts":17.3,"reb":5.3,"ast":3.6,"stl":1.7,"blk":0.4,"tov":1.7,"fg":43.9,"fg3":39.2,"ft":82,"salary":54100000},
            {"name":"Jayson Tatum","pos":"PF","stats_season":"2025-26","gp":16,"pts":21.8,"reb":10,"ast":5.3,"stl":1.4,"blk":0.2,"tov":2.4,"fg":41.1,"fg3":32.9,"ft":82.3,"salary":58400000},
            {"name":"Mitchell Robinson","pos":"C","stats_season":"2025-26","gp":60,"pts":5.7,"reb":8.8,"ast":0.9,"stl":0.9,"blk":1.2,"tov":0.7,"fg":72.3,"fg3":0,"ft":40.8,"salary":15000000},
        ],
        "bench_2026_27": [
            {"name":"Payton Pritchard","pos":"PG","stats_season":"2025-26","gp":79,"pts":17,"reb":3.9,"ast":5.2,"stl":0.7,"blk":0.1,"tov":1.4,"fg":46.4,"fg3":37.7,"ft":89,"salary":7700000},
            {"name":"Ron Harper Jr.","pos":"SG","stats_season":"2025-26","gp":29,"pts":4.2,"reb":1.7,"ast":0.8,"stl":0.3,"blk":0.3,"tov":0.3,"fg":41.8,"fg3":35,"ft":75,"salary":3100000},
            {"name":"Jordan Walsh","pos":"SG","stats_season":"2025-26","gp":68,"pts":5.4,"reb":4,"ast":0.8,"stl":0.7,"blk":0.5,"tov":0.5,"fg":50.9,"fg3":38.4,"ft":77.2,"salary":2400000},
            {"name":"Hugo González","pos":"SG","stats_season":"2025-26","gp":74,"pts":3.9,"reb":3.3,"ast":0.5,"stl":0.6,"blk":0.3,"tov":0.5,"fg":47.6,"fg3":36.2,"ft":50,"salary":2900000},
            {"name":"Sam Hauser","pos":"SF","stats_season":"2025-26","gp":78,"pts":9.2,"reb":3.8,"ast":1.5,"stl":0.5,"blk":0.3,"tov":0.4,"fg":41.9,"fg3":39.3,"ft":85,"salary":10800000},
            {"name":"Mike Conley","pos":"PG","stats_season":"2025-26","gp":54,"pts":4.5,"reb":1.7,"ast":2.9,"stl":0.6,"blk":0.3,"tov":0.6,"fg":33.5,"fg3":33.7,"ft":90,"salary":3800000},
            {"name":"Luka Garza","pos":"C","stats_season":"2025-26","gp":69,"pts":8.1,"reb":4.1,"ast":1,"stl":0.4,"blk":0.4,"tov":0.7,"fg":57.7,"fg3":43.3,"ft":76.9,"salary":2800000},
            {"name":"Amari Williams","pos":"C","stats_season":"2025-26","gp":22,"pts":1.4,"reb":1.8,"ast":0.5,"stl":0.1,"blk":0.5,"tov":0.5,"fg":50,"fg3":0,"ft":71.4,"salary":2400000},
            {"name":"Neemias Queta","pos":"C","stats_season":"2025-26","gp":76,"pts":10.2,"reb":8.4,"ast":1.7,"stl":0.8,"blk":1.3,"tov":1,"fg":65.3,"fg3":12.5,"ft":70.3,"salary":2600000},
            {"name":"Chris Cenac Jr.","pos":"PF","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":2900000},
            {"name":"Tucker DeVries","pos":"SG","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":None},
            {"name":"Dillon Mitchell","pos":"SF","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":None},
            {"name":"Milos Uzan","pos":"PG","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":None},
        ],
        "draft_picks": boston_draft_picks
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
            {"name":"Egor Dëmin","pos":"PG","stats_season":"2025-26","gp":52,"pts":10.3,"reb":3.2,"ast":3.3,"stl":0.8,"blk":0.3,"tov":1.7,"fg":39.9,"fg3":38.5,"ft":83.1,"salary":7200000},
            {"name":"Michael Porter Jr.","pos":"SG","stats_season":"2025-26","gp":52,"pts":24.2,"reb":7.1,"ast":3,"stl":1.1,"blk":0.3,"tov":2.3,"fg":46.3,"fg3":36.3,"ft":85.9,"salary":40800000},
            {"name":"Julius Randle","pos":"SF","stats_season":"2025-26","gp":79,"pts":21.1,"reb":6.7,"ast":5,"stl":1.1,"blk":0.2,"tov":2.7,"fg":48.1,"fg3":31.5,"ft":80.2,"salary":33300000},
            {"name":"Day'Ron Sharpe","pos":"PF","stats_season":"2025-26","gp":62,"pts":8.7,"reb":6.7,"ast":2.3,"stl":1.1,"blk":0.4,"tov":1.7,"fg":60.1,"fg3":23.1,"ft":67.8,"salary":10000000},
            {"name":"Moritz Wagner","pos":"C","stats_season":"2025-26","gp":36,"pts":6.9,"reb":3.2,"ast":0.8,"stl":0.4,"blk":0.1,"tov":0.5,"fg":42.6,"fg3":31.4,"ft":81.9,"salary":9000000},
        ],
        "bench_2026_27": [
            {"name":"Josh Minott","pos":"SF","stats_season":"2025-26","gp":49,"pts":7.4,"reb":3.2,"ast":0.9,"stl":0.9,"blk":0.5,"tov":0.9,"fg":50,"fg3":41.8,"ft":78.7,"salary":4500000},
            {"name":"Mikel Brown Jr.","pos":"PG","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":8700000},
            {"name":"Danny Wolf","pos":"PF","stats_season":"2025-26","gp":57,"pts":8.9,"reb":4.9,"ast":2.2,"stl":0.5,"blk":0.6,"tov":1.3,"fg":40.5,"fg3":32.2,"ft":77.1,"salary":2900000},
            {"name":"Drake Powell","pos":"SG","stats_season":"2025-26","gp":63,"pts":6.5,"reb":1.8,"ast":1.4,"stl":0.6,"blk":0.2,"tov":1,"fg":40.2,"fg3":28,"ft":89.6,"salary":3500000},
            {"name":"Joshua Jefferson","pos":"PF","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":2900000},
            {"name":"Nolan Traore","pos":"PG","stats_season":"2025-26","gp":56,"pts":8.9,"reb":1.8,"ast":3.8,"stl":0.8,"blk":0.4,"tov":2.3,"fg":38,"fg3":31.8,"ft":78.7,"salary":4000000},
            {"name":"Keon Ellis","pos":"SG","stats_season":"2025-26","gp":72,"pts":6.7,"reb":1.9,"ast":1,"stl":1.2,"blk":0.6,"tov":0.6,"fg":44,"fg3":36.3,"ft":72.9,"salary":9000000},
            {"name":"Terance Mann","pos":"SG","stats_season":"2025-26","gp":63,"pts":7.2,"reb":3.2,"ast":3,"stl":0.7,"blk":0.2,"tov":1.1,"fg":45.7,"fg3":36.4,"ft":78.8,"salary":15500000},
            {"name":"Grant Nelson","pos":"PF","stats_season":"2025-26","gp":4,"pts":4.3,"reb":1.5,"ast":1.3,"stl":0.3,"blk":1.3,"tov":1,"fg":55.6,"fg3":0,"ft":70,"salary":None},
            {"name":"Noah Clowney","pos":"PF","stats_season":"2025-26","gp":66,"pts":12.3,"reb":4.1,"ast":1.6,"stl":0.8,"blk":0.7,"tov":1.5,"fg":39.6,"fg3":32.9,"ft":80.4,"salary":5400000},
            {"name":"Chaney Johnson","pos":"SF","stats_season":"2025-26","gp":17,"pts":8.2,"reb":4.6,"ast":2.1,"stl":0.9,"blk":0.5,"tov":1.2,"fg":54.3,"fg3":30,"ft":80,"salary":0},
            {"name":"Tyler Bilodeau","pos":"PF","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":None},
            {"name":"Ben Saraf","pos":"PG","stats_season":"2025-26","gp":44,"pts":7.5,"reb":2.1,"ast":3.3,"stl":0.9,"blk":0.2,"tov":2.3,"fg":39.6,"fg3":21.1,"ft":83,"salary":3000000},
        ],
        "draft_picks": brooklyn_draft_picks

    },
    {
        "id": 3,
        "name": "New York Knicks",
        "conference": "Eastern",
        "division": "Atlantic",
        "featured_star": "Jalen Brunson",
        "headline_stat": "26.5 PPG, 7.3 APG",
        "last_season_record": "53-29",
        "total_salary": 221455415,
        "tax_status": "Luxury Tax",
        "championships": 3,
        "championship_years": [1970, 1973, 2026],
        "logo": "https://cdn.nba.com/logos/nba/1610612752/primary/L/logo.svg",
        "description": "High-powered Manhattan roster boasting Jalen Brunson, Karl-Anthony Towns, Mikal Bridges, and OG Anunoby.",
        "starters_2026_27": [
            {"name":"Jalen Brunson","pos":"PG","stats_season":"2025-26","gp":74,"pts":26,"reb":3.3,"ast":6.8,"stl":0.8,"blk":0.1,"tov":2.4,"fg":46.7,"fg3":36.9,"ft":84.1,"salary":37700000},
            {"name":"Josh Hart","pos":"SG","stats_season":"2025-26","gp":66,"pts":12,"reb":7.4,"ast":4.8,"stl":1.1,"blk":0.3,"tov":1.9,"fg":50.8,"fg3":41.3,"ft":72,"salary":20900000},
            {"name":"Mikal Bridges","pos":"SF","stats_season":"2025-26","gp":82,"pts":14.4,"reb":3.8,"ast":3.7,"stl":1.3,"blk":0.8,"tov":1,"fg":49,"fg3":37.1,"ft":82.7,"salary":33400000},
            {"name":"OG Anunoby","pos":"PF","stats_season":"2025-26","gp":67,"pts":16.7,"reb":5.2,"ast":2.2,"stl":1.6,"blk":0.7,"tov":1.8,"fg":48.4,"fg3":38.6,"ft":82.8,"salary":42500000},
            {"name":"Karl-Anthony Towns","pos":"C","stats_season":"2025-26","gp":75,"pts":20.1,"reb":11.9,"ast":3,"stl":0.9,"blk":0.5,"tov":2.5,"fg":50.1,"fg3":36.8,"ft":85.8,"salary":57000000},
        ],
        "bench_2026_27": [
            {"name":"Jack Kayil","pos":"PG","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":None},
            {"name":"Tyler Nickel","pos":"SF","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":None},
            {"name":"Andre Drummond","pos":"C","stats_season":"2025-26","gp":63,"pts":6.4,"reb":8.4,"ast":1.3,"stl":0.6,"blk":0.8,"tov":1,"fg":47.2,"fg3":35.6,"ft":63.1,"salary":3800000},
            {"name":"Jordan Clarkson","pos":"SG","stats_season":"2025-26","gp":72,"pts":8.6,"reb":1.8,"ast":1.3,"stl":0.4,"blk":0.1,"tov":0.9,"fg":45.1,"fg3":32.7,"ft":83,"salary":3800000},
            {"name":"Miles McBride","pos":"PG","stats_season":"2025-26","gp":41,"pts":12,"reb":2.4,"ast":2.6,"stl":0.9,"blk":0.2,"tov":0.8,"fg":42.3,"fg3":41.3,"ft":78.7,"salary":3900000},
            {"name":"Pacôme Dadiet","pos":"SF","stats_season":"2025-26","gp":29,"pts":1.7,"reb":0.9,"ast":0.4,"stl":0.1,"blk":0,"tov":0.1,"fg":33.3,"fg3":21.9,"ft":81.8,"salary":2900000},
            {"name":"Jose Alvarado","pos":"PG","stats_season":"2025-26","gp":69,"pts":7.4,"reb":2.5,"ast":3.4,"stl":1,"blk":0.1,"tov":1.1,"fg":41.6,"fg3":35.2,"ft":76.1,"salary":4400000},
            {"name":"Kevin McCullar Jr.","pos":"SG","stats_season":"2025-26","gp":21,"pts":2.4,"reb":1.3,"ast":1,"stl":0.4,"blk":0,"tov":0.6,"fg":42.6,"fg3":33.3,"ft":40,"salary":None},
            {"name":"Tyler Kolek","pos":"PG","stats_season":"2025-26","gp":62,"pts":4.4,"reb":1.6,"ast":2.7,"stl":0.4,"blk":0.1,"tov":0.9,"fg":43.5,"fg3":38.6,"ft":70,"salary":2200000},
            {"name":"Landry Shamet","pos":"SG","stats_season":"2025-26","gp":51,"pts":9.3,"reb":1.8,"ast":1.4,"stl":0.6,"blk":0.2,"tov":0.6,"fg":43.7,"fg3":39.2,"ft":71.1,"salary":5400000},
            {"name":"Mohamed Diawara","pos":"SF","stats_season":"2025-26","gp":69,"pts":3.6,"reb":1.4,"ast":0.8,"stl":0.2,"blk":0.1,"tov":0.4,"fg":42.3,"fg3":36.9,"ft":75,"salary":2600000},
            {"name":"Tony Bradley","pos":"C","stats_season":"2025-26","gp":41,"pts":4,"reb":2.8,"ast":0.5,"stl":0.1,"blk":0.2,"tov":0.4,"fg":54.7,"fg3":50,"ft":74.4,"salary":3506659},
        ],
        "draft_picks": new_york_draft_picks
    },
    {
        "id": 4,
        "name": "Philadelphia 76ers",
        "conference": "Eastern",
        "division": "Atlantic",
        "featured_star": "Joel Embiid",
        "headline_stat": "24.9 PPG, 8.5 RPG",
        "last_season_record": "45-37",
        "total_salary": 213165808,
        "tax_status": "Luxury Tax",
        "championships": 3,
        "championship_years": [1955, 1967, 1983],
        "logo": "https://cdn.nba.com/logos/nba/1610612755/primary/L/logo.svg",
        "description": "Powerhouse contender uniting LeBron James and Jaylen Brown alongside franchise pillars Joel Embiid and Tyrese Maxey.",
        "starters_2026_27": [
            {"name":"Tyrese Maxey","pos":"PG","stats_season":"2025-26","gp":70,"pts":28.3,"reb":4.1,"ast":6.6,"stl":1.9,"blk":0.8,"tov":2.4,"fg":46.2,"fg3":36.7,"ft":89.2,"salary":40770520},
            {"name":"Jaylen Brown","pos":"SG","stats_season":"2025-26","gp":71,"pts":28.7,"reb":6.9,"ast":5.1,"stl":1,"blk":0.4,"tov":3.6,"fg":47.7,"fg3":34.7,"ft":79.5,"salary":57078728},
            {"name":"VJ Edgecombe","pos":"SF","stats_season":"2025-26","gp":75,"pts":16,"reb":5.6,"ast":4.2,"stl":1.4,"blk":0.5,"tov":1.8,"fg":43.8,"fg3":35.4,"ft":81.8,"salary":11663880},
            {"name":"LeBron James","pos":"PF","stats_season":"2025-26","gp":60,"pts":20.9,"reb":6.1,"ast":7.2,"stl":1.2,"blk":0.6,"tov":3,"fg":51.5,"fg3":31.7,"ft":73.7,"salary":3876529},
            {"name":"Joel Embiid","pos":"C","stats_season":"2025-26","gp":38,"pts":26.9,"reb":7.7,"ast":3.9,"stl":0.6,"blk":1.2,"tov":2.9,"fg":48.9,"fg3":33.3,"ft":85.4,"salary":58100000},
        ],
        "bench_2026_27": [
            {"name":"Labaron Philon Jr.","pos":"PG","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":3597120},
            {"name":"Caleb Love","pos":"SG","stats_season":"2025-26","gp":49,"pts":10.4,"reb":2.3,"ast":2.5,"stl":0.6,"blk":0.1,"tov":1.3,"fg":38.8,"fg3":31.8,"ft":73.5,"salary":None,"contract_type":"Two-Way"},
            {"name":"Kentavious Caldwell-Pope","pos":"SG","stats_season":"2025-26","gp":51,"pts":8.4,"reb":2.5,"ast":2.7,"stl":0.8,"blk":0.2,"tov":1.2,"fg":41,"fg3":31.6,"ft":91.3,"salary":2449421},
            {"name":"Justin Edwards","pos":"SF","stats_season":"2025-26","gp":64,"pts":6,"reb":1.5,"ast":1.3,"stl":0.8,"blk":0.2,"tov":0.6,"fg":44.7,"fg3":37.2,"ft":84.6,"salary":2411090},
            {"name":"MarJon Beauchamp","pos":"SF","stats_season":"2025-26","gp":14,"pts":6.8,"reb":2.3,"ast":1.1,"stl":0.6,"blk":0.3,"tov":0.9,"fg":43.4,"fg3":34,"ft":68.4,"salary":None},
            {"name":"Rayan Rupert","pos":"SG","stats_season":"2025-26","gp":64,"pts":5.2,"reb":2.9,"ast":1.1,"stl":0.9,"blk":0.1,"tov":0.9,"fg":39.3,"fg3":32.4,"ft":77.8,"salary":None},
            {"name":"Anfernee Simons","pos":"PG","stats_season":"2025-26","gp":55,"pts":14.3,"reb":2.5,"ast":2.4,"stl":0.5,"blk":0.1,"tov":1.2,"fg":44,"fg3":38.5,"ft":89.6,"salary":6000000},
            {"name":"Tyrese Martin","pos":"SG","stats_season":"2025-26","gp":46,"pts":6.3,"reb":2.5,"ast":1.7,"stl":0.5,"blk":0.1,"tov":0.9,"fg":39.4,"fg3":32.1,"ft":67.9,"salary":None},
            {"name":"Dominick Barlow","pos":"PF","stats_season":"2025-26","gp":71,"pts":7.7,"reb":4.8,"ast":1.2,"stl":0.9,"blk":0.7,"tov":0.8,"fg":53.9,"fg3":25.6,"ft":71.8,"salary":3415000},
            {"name":"Adem Bona","pos":"C","stats_season":"2025-26","gp":71,"pts":4.8,"reb":4.3,"ast":0.5,"stl":0.4,"blk":1.2,"tov":0.8,"fg":59.5,"fg3":33.3,"ft":70.8,"salary":2296271},
            {"name":"Dean Wade","pos":"PF","stats_season":"2025-26","gp":59,"pts":5.8,"reb":4.2,"ast":1.5,"stl":0.7,"blk":0.4,"tov":0.3,"fg":43.9,"fg3":36.2,"ft":71.1,"salary":9000000},
            {"name":"Jabari Walker","pos":"PF","stats_season":"2025-26","gp":64,"pts":4.3,"reb":3,"ast":0.5,"stl":0.4,"blk":0.2,"tov":0.4,"fg":45.5,"fg3":33.7,"ft":73.5,"salary":2584539},
            {"name":"Ariel Hukporti","pos":"C","stats_season":"2025-26","gp":54,"pts":2.2,"reb":2.9,"ast":0.5,"stl":0.2,"blk":0.5,"tov":0.6,"fg":56.3,"fg3":25,"ft":78.8,"salary":3400000},
            {"name":"Tacko Fall","pos":"C","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":1357763},
            {"name":"Jameer Nelson Jr.","pos":"PG","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":1357763},
            {"name":"Saint Thomas","pos":"SF","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":1357763},
            {"name":"Duke Miles","pos":"PG","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":None},
            {"name":"Dillon Jones","pos":"SF","stats_season":"2025-26","gp":7,"pts":1.3,"reb":1,"ast":0.6,"stl":0.4,"blk":0,"tov":0,"fg":22.2,"fg3":20,"ft":100,"salary":2449421},
        ],
        "draft_picks": philadelphia_draft_picks
    },
    {
        "id": 5,
        "name": "Toronto Raptors",
        "conference": "Eastern",
        "division": "Atlantic",
        "featured_star": "Scottie Barnes",
        "headline_stat": "20.2 PPG, 8.4 RPG, 5.9 APG",
        "last_season_record": "46-36",
        "total_salary": 205084177,
        "tax_status": "Luxury Tax",
        "championships": 1,
        "championship_years": [2019],
        "logo": "https://cdn.nba.com/logos/nba/1610612761/primary/L/logo.svg",
        "description": "Dynamic young Eastern roster built around All-Star forward Scottie Barnes, RJ Barrett, Immanuel Quickley, and Kawhi Leonard.",
        "starters_2026_27": [
            {"name":"Immanuel Quickley","pos":"PG","stats_season":"2025-26","gp":70,"pts":16.4,"reb":4,"ast":5.9,"stl":1.3,"blk":0.1,"tov":1.5,"fg":44.3,"fg3":37.4,"ft":82.1,"salary":32500000},
            {"name":"RJ Barrett","pos":"SG","stats_season":"2025-26","gp":57,"pts":19.3,"reb":5.3,"ast":3.3,"stl":0.7,"blk":0.3,"tov":1.7,"fg":49.1,"fg3":33.9,"ft":71.7,"salary":29616071},
            {"name":"Kawhi Leonard","pos":"SF","stats_season":"2025-26","gp":65,"pts":27.9,"reb":6.4,"ast":3.6,"stl":1.9,"blk":0.4,"tov":2,"fg":50.5,"fg3":38.7,"ft":89.2,"salary":50300000},
            {"name":"Scottie Barnes","pos":"PF","stats_season":"2025-26","gp":80,"pts":18.1,"reb":7.5,"ast":5.9,"stl":1.4,"blk":1.5,"tov":2.6,"fg":50.7,"fg3":30.4,"ft":81.5,"salary":41754690},
            {"name":"Jakob Poeltl","pos":"C","stats_season":"2025-26","gp":46,"pts":10.7,"reb":7,"ast":2,"stl":0.9,"blk":0.7,"tov":1.2,"fg":70,"fg3":0,"ft":60.2,"salary":19500000},
        ],
        "bench_2026_27": [
            {"name":"Kyle Anderson","pos":"F","stats_season":"2025-26","gp":43,"pts":6.2,"reb":3.5,"ast":2.9,"stl":1,"blk":0.6,"tov":0.9,"fg":53,"fg3":36.4,"ft":70.6,"salary":2449421},
            {"name":"Trey Jemison III","pos":"C","stats_season":"2025-26","gp":13,"pts":1,"reb":1.4,"ast":0.4,"stl":0.1,"blk":0.2,"tov":0.8,"fg":60,"fg3":0,"ft":100,"salary":None},
            {"name":"Chucky Hepburn","pos":"PG","stats_season":"2025-26","gp":2,"pts":0,"reb":0.5,"ast":1,"stl":0.5,"blk":0,"tov":0.5,"fg":0,"fg3":0,"ft":0,"salary":None},
            {"name":"Nate Bittle","pos":"C","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":1357763},
            {"name":"Jaden Bradley","pos":"PG","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":1357763},
            {"name":"A.J. Lawson","pos":"SG","stats_season":"2025-26","gp":24,"pts":4.2,"reb":1.8,"ast":0.3,"stl":0.5,"blk":0.2,"tov":0.3,"fg":43.6,"fg3":42.2,"ft":77.8,"salary":None},
            {"name":"Ja'Kobe Walter","pos":"SG","stats_season":"2025-26","gp":72,"pts":7.5,"reb":2.6,"ast":1.2,"stl":1,"blk":0.2,"tov":0.5,"fg":44.6,"fg3":40.9,"ft":78.9,"salary":3811800},
            {"name":"Malachi Smith","pos":"SG","stats_season":"2025-26","gp":15,"pts":8.3,"reb":3.4,"ast":3.3,"stl":0.8,"blk":0.3,"tov":0.9,"fg":48.5,"fg3":43.5,"ft":100,"salary":None},
            {"name":"Allen Graves","pos":"PF","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":4065720},
            {"name":"Jamal Shead","pos":"PG","stats_season":"2025-26","gp":82,"pts":6.6,"reb":1.7,"ast":5.4,"stl":0.9,"blk":0.2,"tov":1.4,"fg":36.7,"fg3":32.1,"ft":78.4,"salary":2296271},
            {"name":"Collin Murray-Boyles","pos":"PF","stats_season":"2025-26","gp":57,"pts":8.5,"reb":5,"ast":1.9,"stl":0.9,"blk":0.9,"tov":1,"fg":57.9,"fg3":34,"ft":65.7,"salary":6649560},
            {"name":"Trayce Jackson-Davis","pos":"PF","stats_season":"2025-26","gp":53,"pts":3.4,"reb":2.7,"ast":0.7,"stl":0.3,"blk":0.5,"tov":0.4,"fg":57.3,"fg3":100,"ft":51.4,"salary":2406205},
            {"name":"Andre Jackson Jr.","pos":"SG","stats_season":"2025-26","gp":48,"pts":2.4,"reb":1.5,"ast":0.9,"stl":0.4,"blk":0.1,"tov":0.6,"fg":32.8,"fg3":25,"ft":62.5,"salary":2537526},
            {"name":"Alijah Martin","pos":"SG","stats_season":"2025-26","gp":23,"pts":2.2,"reb":0.9,"ast":0.5,"stl":0.3,"blk":0.2,"tov":0.3,"fg":32,"fg3":19,"ft":78.9,"salary":2185116},
            {"name":"Jamison Battle","pos":"SF","stats_season":"2025-26","gp":61,"pts":3.1,"reb":1.5,"ast":0.4,"stl":0.1,"blk":0,"tov":0.3,"fg":51,"fg3":41.2,"ft":64.3,"salary":2296271},
        ],
        "draft_picks": toronto_draft_picks
    },
    {
        "id": 6,
        "name": "Chicago Bulls",
        "conference": "Eastern",
        "division": "Central",
        "featured_star": "Josh Giddey",
        "headline_stat": "13.8 PPG, 7.2 RPG, 5.8 APG",
        "last_season_record": "31-51",
        "total_salary": 164345080,
        "tax_status": "Under Cap",
        "championships": 6,
        "championship_years": [1991, 1992, 1993, 1996, 1997, 1998],
        "logo": "https://cdn.nba.com/logos/nba/1610612741/primary/L/logo.svg",
        "description": "Transitioning core featuring Josh Giddey, Matas Buzelis, Nic Claxton, and veteran Norman Powell.",
        "starters_2026_27": [
            {"name":"Josh Giddey","pos":"PG","stats_season":"2025-26","gp":54,"pts":17,"reb":8.3,"ast":9.1,"stl":1,"blk":0.5,"tov":3.6,"fg":44.8,"fg3":36.4,"ft":76.3,"salary":25000000},
            {"name":"Norman Powell","pos":"SG","stats_season":"2025-26","gp":58,"pts":21.7,"reb":3.5,"ast":2.5,"stl":1.1,"blk":0.2,"tov":1.9,"fg":47,"fg3":38,"ft":82.7,"salary":21500000},
            {"name":"Matas Buzelis","pos":"SF","stats_season":"2025-26","gp":77,"pts":16.3,"reb":5.8,"ast":2.1,"stl":0.7,"blk":1.5,"tov":2.1,"fg":46.3,"fg3":34.9,"ft":78.6,"salary":5700000},
            {"name":"Patrick Williams","pos":"PF","stats_season":"2025-26","gp":72,"pts":7,"reb":3,"ast":1.5,"stl":0.7,"blk":0.4,"tov":1,"fg":37.2,"fg3":34.7,"ft":72,"salary":18000000},
            {"name":"Nic Claxton","pos":"C","stats_season":"2025-26","gp":69,"pts":11.7,"reb":6.9,"ast":3.7,"stl":0.7,"blk":1.1,"tov":1.4,"fg":57.1,"fg3":15.8,"ft":61.6,"salary":23100000},
        ],
        "bench_2026_27": [
            {"name":"Caleb Wilson","pos":"PF","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":10600000},
            {"name":"Buddy Hield","pos":"SG","stats_season":"2025-26","gp":51,"pts":7.6,"reb":2.3,"ast":1.4,"stl":0.8,"blk":0.2,"tov":0.9,"fg":43.7,"fg3":34.9,"ft":81.1,"salary":9600000},
            {"name":"Leonard Miller","pos":"PF","stats_season":"2025-26","gp":46,"pts":7.8,"reb":3.9,"ast":0.9,"stl":0.4,"blk":0.3,"tov":0.8,"fg":55.3,"fg3":32.3,"ft":73.6,"salary":2400000},
            {"name":"Zach Collins","pos":"C","stats_season":"2025-26","gp":10,"pts":9.7,"reb":5.6,"ast":1.5,"stl":0.2,"blk":0.4,"tov":1,"fg":57.8,"fg3":42.9,"ft":70,"salary":8500000},
            {"name":"Noa Essengue","pos":"SF","stats_season":"2025-26","gp":2,"pts":0,"reb":0,"ast":0,"stl":0.5,"blk":0,"tov":0,"fg":0,"fg3":0,"ft":0,"salary":5700000},
            {"name":"Jalen Smith","pos":"C","stats_season":"2025-26","gp":53,"pts":10.2,"reb":6.7,"ast":1.2,"stl":0.5,"blk":0.8,"tov":1,"fg":48.3,"fg3":37.3,"ft":74.2,"salary":9400000},
            {"name":"Tre Jones","pos":"PG","stats_season":"2025-26","gp":65,"pts":14.1,"reb":3.1,"ast":5.4,"stl":1.2,"blk":0.2,"tov":1.4,"fg":55.3,"fg3":31.5,"ft":84.1,"salary":8000000},
            {"name":"Isaac Okoro","pos":"SF","stats_season":"2025-26","gp":63,"pts":9.3,"reb":2.7,"ast":1.6,"stl":0.7,"blk":0.5,"tov":0.7,"fg":46,"fg3":33,"ft":79.5,"salary":11800000},
            {"name":"Dailyn Swain","pos":"SF","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":4900000},
            {"name":"Tobe Awaka","pos":"PF","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":None},
            {"name":"Jaylin Sellers","pos":"SG","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":None},
        ],
        "draft_picks": chicago_draft_picks
    },
    {
        "id": 7,
        "name": "Cleveland Cavaliers",
        "conference": "Eastern",
        "division": "Central",
        "featured_star": "Donovan Mitchell",
        "headline_stat": "26.2 PPG, 5.8 APG",
        "last_season_record": "52-30",
        "total_salary": 216120753,
        "tax_status": "Luxury Tax",
        "championships": 1,
        "championship_years": [2016],
        "logo": "https://cdn.nba.com/logos/nba/1610612739/primary/L/logo.svg",
        "description": "Perennial Eastern heavyweight equipped with Donovan Mitchell, James Harden, Evan Mobley, and Jarrett Allen.",
        "starters_2026_27": [
            {"name":"James Harden","pos":"PG","stats_season":"2025-26","gp":70,"pts":23.6,"reb":4.8,"ast":8,"stl":1.1,"blk":0.4,"tov":3.5,"fg":43.4,"fg3":37.5,"ft":88.4,"salary":30647619},
            {"name":"Donovan Mitchell","pos":"SG","stats_season":"2025-26","gp":70,"pts":27.9,"reb":4.5,"ast":5.7,"stl":1.5,"blk":0.3,"tov":2.8,"fg":48.3,"fg3":36.4,"ft":86.5,"salary":50100000},
            {"name":"Peyton Watson","pos":"SF","stats_season":"2025-26","gp":54,"pts":14.6,"reb":4.9,"ast":2.1,"stl":0.9,"blk":1.1,"tov":1.7,"fg":49.1,"fg3":41.1,"ft":73,"salary":20465116},
            {"name":"Evan Mobley","pos":"PF","stats_season":"2025-26","gp":65,"pts":18.2,"reb":9,"ast":3.6,"stl":0.7,"blk":1.7,"tov":1.9,"fg":54.6,"fg3":29.7,"ft":60.6,"salary":50100000},
            {"name":"Jarrett Allen","pos":"C","stats_season":"2025-26","gp":56,"pts":15.4,"reb":8.5,"ast":1.8,"stl":1,"blk":0.8,"tov":1.3,"fg":63.8,"fg3":10,"ft":70.9,"salary":28000000},
        ],
        "bench_2026_27": [
            {"name":"Thomas Bryant","pos":"C","stats_season":"2025-26","gp":60,"pts":6.2,"reb":3.4,"ast":0.6,"stl":0.3,"blk":0.4,"tov":0.5,"fg":50.6,"fg3":35.9,"ft":80.3,"salary":3500000},
            {"name":"Sam Merrill","pos":"SG","stats_season":"2025-26","gp":52,"pts":12.8,"reb":2.6,"ast":2.4,"stl":0.6,"blk":0.1,"tov":0.8,"fg":46.1,"fg3":42.1,"ft":85.5,"salary":9100000},
            {"name":"Craig Porter Jr.","pos":"PG","stats_season":"2025-26","gp":64,"pts":4.5,"reb":3.4,"ast":3.2,"stl":0.9,"blk":0.6,"tov":0.9,"fg":45,"fg3":35.5,"ft":60,"salary":2400000},
            {"name":"Riley Minix","pos":"SF","stats_season":"2025-26","gp":9,"pts":3.9,"reb":0.7,"ast":0.6,"stl":0.2,"blk":0.1,"tov":0.3,"fg":60.9,"fg3":33.3,"ft":100,"salary":0},
            {"name":"Meleek Thomas","pos":"SG","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":None},
            {"name":"Khalifa Diop","pos":"C","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":None},
            {"name":"Jaylon Tyson","pos":"SG","stats_season":"2025-26","gp":66,"pts":13.2,"reb":5.1,"ast":2.2,"stl":0.8,"blk":0.4,"tov":1.5,"fg":49.3,"fg3":44.6,"ft":73.8,"salary":3600000},
            {"name":"Tristan Enaruna","pos":"SF","stats_season":"2025-26","gp":9,"pts":4.1,"reb":1.6,"ast":0.8,"stl":0.6,"blk":0,"tov":0.3,"fg":50,"fg3":30,"ft":75,"salary":0},
            {"name":"Tyrese Proctor","pos":"PG","stats_season":"2025-26","gp":50,"pts":5.4,"reb":1.3,"ast":1.5,"stl":0.5,"blk":0,"tov":0.8,"fg":41.3,"fg3":35.1,"ft":88.9,"salary":2100000},
            {"name":"Mario Hezonja","pos":"SF","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":2845883},
            {"name":"Tre Mann","pos":"SG","stats_season":"2025-26","gp":53,"pts":5.5,"reb":1.7,"ast":1.6,"stl":0.5,"blk":0.1,"tov":1,"fg":36,"fg3":32.3,"ft":85.2,"salary":8000000},
            {"name":"Nae'Qwan Tomlin","pos":"PF","stats_season":"2025-26","gp":64,"pts":5.8,"reb":2.9,"ast":0.8,"stl":0.6,"blk":0.5,"tov":0.5,"fg":47.8,"fg3":23.5,"ft":77,"salary":2400000},
            {"name":"Ernest Udeh, Jr.","pos":"C","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":None},
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
        "total_salary": 188382759,
        "tax_status": "Under Cap",
        "championships": 3,
        "championship_years": [1989, 1990, 2004],
        "logo": "https://cdn.nba.com/logos/nba/1610612765/primary/L/logo.svg",
        "description": "Rising core powered by Cade Cunningham, Ausar Thompson, John Collins, and center Jalen Duren.",
        "starters_2026_27": [
            {"name":"Cade Cunningham","pos":"PG","stats_season":"2025-26","gp":64,"pts":23.9,"reb":5.5,"ast":9.9,"stl":1.4,"blk":0.8,"tov":3.7,"fg":46.1,"fg3":34.2,"ft":81.2,"salary":50100000},
            {"name":"Duncan Robinson","pos":"SG","stats_season":"2025-26","gp":77,"pts":12.2,"reb":2.7,"ast":2.1,"stl":0.6,"blk":0.3,"tov":0.7,"fg":45.6,"fg3":41,"ft":75.5,"salary":15900000},
            {"name":"Ausar Thompson","pos":"SF","stats_season":"2025-26","gp":73,"pts":9.9,"reb":5.7,"ast":3.1,"stl":2,"blk":0.9,"tov":1.5,"fg":52.5,"fg3":25,"ft":57.1,"salary":11100000},
            {"name":"John Collins","pos":"PF","stats_season":"2025-26","gp":69,"pts":13.6,"reb":5.3,"ast":1,"stl":0.9,"blk":0.7,"tov":1.4,"fg":55.2,"fg3":40.6,"ft":76.6,"salary":17000000},
            {"name":"Jalen Duren","pos":"C","stats_season":"2025-26","gp":70,"pts":19.5,"reb":10.5,"ast":2,"stl":0.8,"blk":0.8,"tov":1.9,"fg":65,"fg3":0,"ft":74.7,"salary":34482759},
        ],
        "bench_2026_27": [
            {"name":"Ugonna Onyenso","pos":"C","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":None},
            {"name":"Ebuka Okorie","pos":"SG","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":4400000},
            {"name":"Isaac Jones","pos":"PF","stats_season":"2025-26","gp":7,"pts":1.3,"reb":0.7,"ast":0.1,"stl":0,"blk":0.1,"tov":0.1,"fg":42.9,"fg3":0,"ft":75,"salary":0},
            {"name":"Ronald Holland II","pos":"SF","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":9000000},
            {"name":"Paul Reed","pos":"PF","stats_season":"2025-26","gp":65,"pts":7.8,"reb":4.5,"ast":1.2,"stl":0.9,"blk":0.9,"tov":0.9,"fg":61.7,"fg3":32.5,"ft":66.4,"salary":5600000},
            {"name":"Isaiah Joe","pos":"SG","stats_season":"2025-26","gp":71,"pts":11.1,"reb":2.5,"ast":1.3,"stl":0.7,"blk":0.2,"tov":0.6,"fg":45.5,"fg3":42.3,"ft":89.4,"salary":11300000},
            {"name":"Taurean Prince","pos":"SF","stats_season":"2025-26","gp":26,"pts":9.2,"reb":3.1,"ast":1.8,"stl":0.6,"blk":0.2,"tov":1.2,"fg":45,"fg3":43.6,"ft":100,"salary":3800000},
            {"name":"Wendell Moore Jr.","pos":"SG","stats_season":"2025-26","gp":6,"pts":1.7,"reb":1,"ast":0.7,"stl":0.3,"blk":0.3,"tov":0.2,"fg":57.1,"fg3":0,"ft":100,"salary":None},
            {"name":"Elijah Harkless","pos":"SG","stats_season":"2025-26","gp":26,"pts":6.8,"reb":2,"ast":2.9,"stl":1.2,"blk":0.2,"tov":1,"fg":33.5,"fg3":23.9,"ft":76.6,"salary":0},
            {"name":"Chaz Lanier","pos":"SG","stats_season":"2025-26","gp":34,"pts":2.4,"reb":0.7,"ast":0.5,"stl":0.2,"blk":0,"tov":0.1,"fg":31.5,"fg3":28.4,"ft":83.3,"salary":2100000},
            {"name":"Daniss Jenkins","pos":"PG","stats_season":"2025-26","gp":72,"pts":9.3,"reb":2.3,"ast":3.9,"stl":0.9,"blk":0.2,"tov":1.6,"fg":40.8,"fg3":37.4,"ft":83.2,"salary":4000000},
            {"name":"Kevin Huerter","pos":"SG","stats_season":"2025-26","gp":69,"pts":10,"reb":3.5,"ast":2.6,"stl":0.9,"blk":0.5,"tov":1,"fg":45.1,"fg3":30.8,"ft":77.5,"salary":9500000},
            {"name":"Javonte Green","pos":"SG","stats_season":"2025-26","gp":82,"pts":6.9,"reb":2.8,"ast":0.7,"stl":1.2,"blk":0.3,"tov":0.5,"fg":44.7,"fg3":38.1,"ft":84,"salary":3900000},
            {"name":"Tolu Smith","pos":"C","stats_season":"2025-26","gp":15,"pts":3.7,"reb":3.3,"ast":0.9,"stl":0.1,"blk":0.4,"tov":0.5,"fg":50,"fg3":0,"ft":66.7,"salary":2400000},
        ],
        "draft_picks": detroit_draft_picks
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
            {"name":"Tyrese Haliburton","pos":"PG","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":48900000},
            {"name":"Andrew Nembhard","pos":"SG","stats_season":"2025-26","gp":57,"pts":16.9,"reb":2.8,"ast":7.7,"stl":0.9,"blk":0.1,"tov":2.4,"fg":44.2,"fg3":36.1,"ft":82.5,"salary":19500000},
            {"name":"Aaron Nesmith","pos":"SF","stats_season":"2025-26","gp":45,"pts":13.8,"reb":4.2,"ast":1.9,"stl":0.6,"blk":0.5,"tov":1.4,"fg":41.4,"fg3":37.9,"ft":82.9,"salary":11000000},
            {"name":"Pascal Siakam","pos":"PF","stats_season":"2025-26","gp":62,"pts":24,"reb":6.6,"ast":3.8,"stl":1.1,"blk":0.4,"tov":2.2,"fg":48.4,"fg3":35.8,"ft":69.3,"salary":48900000},
            {"name":"Ivica Zubac","pos":"C","stats_season":"2025-26","gp":48,"pts":14.1,"reb":10.6,"ast":2.2,"stl":0.4,"blk":0.8,"tov":1.8,"fg":59.8,"fg3":0,"ft":71.1,"salary":19500000},
        ],
        "bench_2026_27": [
            {"name":"Obi Toppin","pos":"PF","stats_season":"2025-26","gp":24,"pts":11.6,"reb":4.4,"ast":2.3,"stl":0.5,"blk":0,"tov":1.2,"fg":50.3,"fg3":35.2,"ft":91.3,"salary":15000000},
            {"name":"Braden Smith","pos":"PG","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":None},
            {"name":"Jarace Walker","pos":"PF","stats_season":"2025-26","gp":76,"pts":11.6,"reb":5.1,"ast":2.5,"stl":0.8,"blk":0.3,"tov":1.8,"fg":41.9,"fg3":37.4,"ft":74.9,"salary":8400000},
            {"name":"T.J. McConnell","pos":"PG","stats_season":"2025-26","gp":56,"pts":9.4,"reb":2.2,"ast":5.1,"stl":1,"blk":0.2,"tov":1.1,"fg":53.8,"fg3":32,"ft":86.2,"salary":11000000},
            {"name":"Kelly Oubre Jr.","pos":"SF","stats_season":"2025-26","gp":50,"pts":14.1,"reb":5,"ast":1.6,"stl":1.4,"blk":0.5,"tov":1.4,"fg":46.7,"fg3":36,"ft":76.6,"salary":8000000},
            {"name":"Johnny Furphy","pos":"SG","stats_season":"2025-26","gp":35,"pts":5.1,"reb":4.4,"ast":1.2,"stl":0.6,"blk":0.2,"tov":0.8,"fg":47,"fg3":32.4,"ft":48.6,"salary":2200000},
            {"name":"Jalen Slawson","pos":"SF","stats_season":"2025-26","gp":13,"pts":7.3,"reb":4.4,"ast":2.8,"stl":1.5,"blk":1.1,"tov":1.3,"fg":44.2,"fg3":37.5,"ft":70.6,"salary":None},
            {"name":"Larry Nance Jr.","pos":"PF","stats_season":"2025-26","gp":35,"pts":3.7,"reb":2.7,"ast":1,"stl":0.6,"blk":0.2,"tov":0.6,"fg":41.9,"fg3":33.3,"ft":46.2,"salary":3800000},
            {"name":"Kobe Brown","pos":"PF","stats_season":"2025-26","gp":61,"pts":5.8,"reb":3,"ast":1.3,"stl":0.4,"blk":0.2,"tov":0.9,"fg":46.9,"fg3":37.4,"ft":79.7,"salary":0},
            {"name":"Ben Sheppard","pos":"SG","stats_season":"2025-26","gp":65,"pts":7.1,"reb":3,"ast":1.8,"stl":0.6,"blk":0.1,"tov":0.6,"fg":43.4,"fg3":36.2,"ft":76.5,"salary":5000000},
            {"name":"Quenton Jackson","pos":"SG","stats_season":"2025-26","gp":49,"pts":9.1,"reb":2.3,"ast":2.9,"stl":0.6,"blk":0.1,"tov":1.3,"fg":47,"fg3":35.6,"ft":82.4,"salary":2500000},
            {"name":"Jay Huff","pos":"C","stats_season":"2025-26","gp":82,"pts":9.5,"reb":4,"ast":1.5,"stl":0.5,"blk":1.9,"tov":0.9,"fg":47.6,"fg3":31.9,"ft":82.8,"salary":2600000},
            {"name":"Ethan Thompson","pos":"F","stats_season":"2025-26","gp":32,"pts":7,"reb":2.2,"ast":1.8,"stl":0.6,"blk":0.3,"tov":0.8,"fg":37.8,"fg3":32.8,"ft":78.7,"salary":0},
            {"name":"Taelon Peter","pos":"F","stats_season":"2025-26","gp":38,"pts":4.5,"reb":1.6,"ast":1.1,"stl":0.7,"blk":0.1,"tov":0.7,"fg":38,"fg3":32.8,"ft":62.5,"salary":0},
        ],
        "draft_picks": indiana_draft_picks
    },
    {
        "id": 10,
        "name": "Milwaukee Bucks",
        "conference": "Eastern",
        "division": "Central",
        "featured_star": "Tyler Herro",
        "headline_stat": "21.2 PPG, 5.4 RPG",
        "last_season_record": "32-50",
        # Total includes partial salary rows for players outside the active roster.
        "total_salary": 193808287,
        "tax_status": "Over Cap",
        "championships": 2,
        "championship_years": [1971, 2021],
        "logo": "https://cdn.nba.com/logos/nba/1610612749/primary/L/logo.svg",
        "description": "Restructured lineup commanded by Ryan Rollins, Myles Turner, Tyler Herro, and Jaime Jaquez Jr.",
        "starters_2026_27": [
            {"name":"Ryan Rollins","pos":"PG","stats_season":"2025-26","gp":74,"pts":17.3,"reb":4.6,"ast":5.6,"stl":1.5,"blk":0.4,"tov":2.7,"fg":47.2,"fg3":40.6,"ft":79.6,"salary":4000000},
            {"name":"Tyler Herro","pos":"SG","stats_season":"2025-26","gp":33,"pts":20.5,"reb":4.8,"ast":4.1,"stl":0.7,"blk":0.4,"tov":1.9,"fg":48,"fg3":37.8,"ft":91.7,"salary":33000000},
            {"name":"Jaime Jaquez Jr.","pos":"SF","stats_season":"2025-26","gp":75,"pts":15.4,"reb":5,"ast":4.7,"stl":0.7,"blk":0.3,"tov":2,"fg":50.7,"fg3":31.7,"ft":76.9,"salary":5939141},
            {"name":"Kyle Kuzma","pos":"PF","stats_season":"2025-26","gp":69,"pts":13,"reb":4.5,"ast":2.7,"stl":0.7,"blk":0.4,"tov":1.7,"fg":49.2,"fg3":34.7,"ft":72.6,"salary":20345152},
            {"name":"Myles Turner","pos":"C","stats_season":"2025-26","gp":71,"pts":11.9,"reb":5.3,"ast":1.5,"stl":0.7,"blk":1.6,"tov":1.2,"fg":44,"fg3":38.3,"ft":74,"salary":26584164},
        ],
        "bench_2026_27": [
            {"name":"Malique Lewis","pos":"SF","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":None},
            {"name":"Nate Ament","pos":"SF","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":5502000},
            {"name":"Brayden Burries","pos":"SG","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":6417360},
            {"name":"Jericho Sims","pos":"C","stats_season":"2025-26","gp":67,"pts":5,"reb":5.5,"ast":1.6,"stl":0.3,"blk":0.3,"tov":1.1,"fg":78.4,"fg3":0,"ft":62,"salary":2801346},
            {"name":"Gary Trent Jr.","pos":"SG","stats_season":"2025-26","gp":65,"pts":8.1,"reb":1,"ast":1.2,"stl":0.5,"blk":0,"tov":0.6,"fg":38.7,"fg3":36,"ft":76.9,"salary":15200000},
            {"name":"Kevin Porter Jr.","pos":"SG","stats_season":"2025-26","gp":38,"pts":17.4,"reb":5.2,"ast":7.4,"stl":2.2,"blk":0.5,"tov":2.9,"fg":46.5,"fg3":32.2,"ft":87.8,"salary":5390700},
            {"name":"Kam Jones","pos":"SG","stats_season":"2025-26","gp":37,"pts":4.4,"reb":1.6,"ast":3.2,"stl":0.5,"blk":0,"tov":1,"fg":40.2,"fg3":29.3,"ft":50,"salary":None},
            {"name":"Caris LeVert","pos":"SG","stats_season":"2025-26","gp":60,"pts":7.4,"reb":2,"ast":2.7,"stl":0.9,"blk":0.7,"tov":1.4,"fg":41.7,"fg3":33.3,"ft":67.9,"salary":14809200},
            {"name":"Kel'el Ware","pos":"C","stats_season":"2025-26","gp":77,"pts":11.1,"reb":9,"ast":0.7,"stl":0.8,"blk":1.1,"tov":0.8,"fg":53,"fg3":39.5,"ft":74,"salary":4654920},
            {"name":"John Butler Jr.","pos":"C","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":2449421},
            {"name":"AJ Green","pos":"SG","stats_season":"2025-26","gp":78,"pts":10.4,"reb":2.7,"ast":1.9,"stl":0.5,"blk":0.1,"tov":1,"fg":42.4,"fg3":41.9,"ft":85.5,"salary":10044644},
            {"name":"Ousmane Dieng","pos":"SF","stats_season":"2025-26","gp":57,"pts":7.6,"reb":3.2,"ast":2.4,"stl":0.4,"blk":0.3,"tov":1.3,"fg":42.2,"fg3":34.1,"ft":71.1,"salary":5750000},
            {"name":"Bogoljub Markovic","pos":"PF","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":1357763},
            {"name":"Kasparas Jakučionis","pos":"PG","stats_season":"2025-26","gp":53,"pts":6.2,"reb":2.6,"ast":2.6,"stl":0.6,"blk":0.1,"tov":0.9,"fg":42.9,"fg3":42.3,"ft":87.9,"salary":3841680},
            {"name":"Cormac Ryan","pos":"SG","stats_season":"2025-26","gp":11,"pts":14.3,"reb":2.5,"ast":1.7,"stl":1,"blk":0.3,"tov":1.5,"fg":52,"fg3":45.8,"ft":92.3,"salary":None},
            {"name":"Pete Nance","pos":"PF","stats_season":"2025-26","gp":47,"pts":5.4,"reb":2.7,"ast":1,"stl":0.3,"blk":0.3,"tov":0.6,"fg":51.5,"fg3":42,"ft":36.4,"salary":2537526},
        ],
        "draft_picks": milwaukee_draft_picks
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
            {"name":"Davion Mitchell","pos":"PG","stats_season":"2025-26","gp":70,"pts":9.3,"reb":2.7,"ast":6.5,"stl":1,"blk":0.2,"tov":1.5,"fg":49,"fg3":39.5,"ft":64.6,"salary":12400000},
            {"name":"Tim Hardaway Jr.","pos":"SG","stats_season":"2025-26","gp":80,"pts":13.5,"reb":2.6,"ast":1.4,"stl":0.5,"blk":0.1,"tov":0.5,"fg":44.7,"fg3":40.7,"ft":81.1,"salary":6500000},
            {"name":"Andrew Wiggins","pos":"SF","stats_season":"2025-26","gp":68,"pts":15.4,"reb":4.8,"ast":2.7,"stl":1.1,"blk":1,"tov":1.5,"fg":47.5,"fg3":41.4,"ft":78.4,"salary":30169644},
            {"name":"Giannis Antetokounmpo","pos":"PF","stats_season":"2025-26","gp":36,"pts":27.6,"reb":9.8,"ast":5.4,"stl":0.9,"blk":0.7,"tov":3.2,"fg":62.4,"fg3":33.3,"ft":65,"salary":58456566},
            {"name":"Bam Adebayo","pos":"C","stats_season":"2025-26","gp":73,"pts":20.1,"reb":10,"ast":3.2,"stl":1.2,"blk":0.7,"tov":1.6,"fg":44.2,"fg3":31.8,"ft":77.8,"salary":49800000},
        ],
        "bench_2026_27": [
            {"name":"J'Vonne Hadley","pos":"SF","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":1357763},
            {"name":"Simone Fontecchio","pos":"SF","stats_season":"2025-26","gp":70,"pts":8.5,"reb":3,"ast":1.4,"stl":0.5,"blk":0.1,"tov":0.7,"fg":41.2,"fg3":37.5,"ft":84.3,"salary":2449421},
            {"name":"Trevor Keels","pos":"SG","stats_season":"2025-26","gp":8,"pts":1,"reb":0.3,"ast":0,"stl":0.1,"blk":0,"tov":0,"fg":25,"fg3":22.2,"ft":0,"salary":None},
            {"name":"Ryan Conwell","pos":"SG","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":1357763},
            {"name":"Nikola Jović","pos":"PF","stats_season":"2025-26","gp":47,"pts":7.3,"reb":3.3,"ast":2.2,"stl":0.6,"blk":0.4,"tov":1.4,"fg":36.6,"fg3":26.9,"ft":68.3,"salary":16200000},
            {"name":"Nick Richards","pos":"C","stats_season":"2025-26","gp":48,"pts":5.8,"reb":5.1,"ast":0.3,"stl":0.2,"blk":0.7,"tov":1.2,"fg":51.2,"fg3":27.8,"ft":64.4,"salary":2449421},
            {"name":"Pelle Larsson","pos":"SG","stats_season":"2025-26","gp":70,"pts":11.4,"reb":3.5,"ast":3.4,"stl":0.7,"blk":0.2,"tov":1.4,"fg":49.6,"fg3":32.3,"ft":79.7,"salary":2296271},
            {"name":"Klay Thompson","pos":"SG","stats_season":"2025-26","gp":69,"pts":11.7,"reb":2.1,"ast":1.4,"stl":0.5,"blk":0.3,"tov":0.9,"fg":39.3,"fg3":38.3,"ft":76.6,"salary":5600000},
            {"name":"Dru Smith","pos":"PG","stats_season":"2025-26","gp":70,"pts":5.6,"reb":2.5,"ast":2.6,"stl":1.4,"blk":0.3,"tov":0.8,"fg":41.5,"fg3":29.5,"ft":82.9,"salary":2584539},
            {"name":"Myron Gardner","pos":"SF","stats_season":"2025-26","gp":45,"pts":3.6,"reb":2.7,"ast":1,"stl":0.4,"blk":0.2,"tov":0.4,"fg":48,"fg3":40.6,"ft":73.1,"salary":2150917},
            {"name":"Keshad Johnson","pos":"PF","stats_season":"2025-26","gp":32,"pts":4.3,"reb":1.9,"ast":0.3,"stl":0.5,"blk":0.3,"tov":0.4,"fg":49,"fg3":29.5,"ft":72.4,"salary":None},
            {"name":"Jahmir Young","pos":"PG","stats_season":"2025-26","gp":14,"pts":1.8,"reb":0.3,"ast":0.6,"stl":0.1,"blk":0,"tov":0.2,"fg":40,"fg3":33.3,"ft":100,"salary":None},
            {"name":"Tre Donaldson","pos":"PG","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":None},
            {"name":"Vladislav Goldin","pos":"C","stats_season":"2025-26","gp":9,"pts":0.8,"reb":1,"ast":0.3,"stl":0,"blk":0.3,"tov":0.3,"fg":75,"fg3":0,"ft":100,"salary":None},
            {"name":"Bobby Portis Jr.","pos":"PF","stats_season":"2025-26","gp":67,"pts":13.7,"reb":6.4,"ast":1.6,"stl":0.6,"blk":0.2,"tov":1,"fg":48.8,"fg3":45.6,"ft":70.6,"salary":14521414},
            {"name":"Bez Mbeng","pos":"F","stats_season":"2025-26","gp":15,"pts":8.1,"reb":3.8,"ast":4.1,"stl":2.3,"blk":0.3,"tov":1.5,"fg":50,"fg3":19.4,"ft":64,"salary":2185116},
        ],
        "draft_picks": miami_draft_picks
    },
    {
        "id": 12,
        "name": "Atlanta Hawks",
        "conference": "Eastern",
        "division": "Southeast",
        "featured_star": "Jalen Johnson",
        "headline_stat": "17.5 PPG, 9.1 RPG, 4.4 APG",
        "last_season_record": "46-36",
        "total_salary": 175673253,
        "tax_status": "Luxury Tax",
        "championships": 1,
        "championship_years": [1958],
        "logo": "https://cdn.nba.com/logos/nba/1610612737/primary/L/logo.svg",
        "description": "Athletic retool driven by Dyson Daniels, Jalen Johnson, Onyeka Okongwu, and veteran C.J. McCollum.",
        "starters_2026_27": [
            {"name":"C.J. McCollum","pos":"PG","stats_season":"2025-26","gp":76,"pts":18.7,"reb":3.3,"ast":3.9,"stl":0.8,"blk":0.5,"tov":1.8,"fg":45.5,"fg3":37.5,"ft":77.2,"salary":21000000},
            {"name":"Nickeil Alexander-Walker","pos":"SG","stats_season":"2025-26","gp":78,"pts":20.8,"reb":3.4,"ast":3.7,"stl":1.3,"blk":0.5,"tov":2.1,"fg":45.9,"fg3":39.9,"ft":90.2,"salary":14400000},
            {"name":"Dyson Daniels","pos":"SF","stats_season":"2025-26","gp":76,"pts":11.9,"reb":6.8,"ast":5.9,"stl":2,"blk":0.4,"tov":1.8,"fg":51.7,"fg3":18.8,"ft":61.5,"salary":25000000},
            {"name":"Jalen Johnson","pos":"PF","stats_season":"2025-26","gp":72,"pts":22.5,"reb":10.3,"ast":7.9,"stl":1.2,"blk":0.4,"tov":3.4,"fg":48.9,"fg3":35.2,"ft":78.8,"salary":30000000},
            {"name":"Onyeka Okongwu","pos":"C","stats_season":"2025-26","gp":74,"pts":15.2,"reb":7.6,"ast":3.1,"stl":1.1,"blk":1.1,"tov":1.7,"fg":48,"fg3":37.6,"ft":75.7,"salary":16100000},
        ],
        "bench_2026_27": [
            {"name":"Keshon Gilbert","pos":"PG","stats_season":"2025-26","gp":4,"pts":4.3,"reb":1.3,"ast":3,"stl":0.8,"blk":1,"tov":2,"fg":41.7,"fg3":0,"ft":100,"salary":0},
            {"name":"RayJ Dennis","pos":"PG","stats_season":"2025-26","gp":17,"pts":4.4,"reb":1.5,"ast":1.9,"stl":0.2,"blk":0.2,"tov":1,"fg":31.3,"fg3":31.1,"ft":88.9,"salary":0},
            {"name":"Kingston Flemings","pos":"PG","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":7300000},
            {"name":"Dorian Finney-Smith","pos":"SF","stats_season":"2025-26","gp":37,"pts":3.3,"reb":2.5,"ast":1,"stl":0.4,"blk":0.2,"tov":0.6,"fg":33.3,"fg3":27,"ft":88.9,"salary":13335000},
            {"name":"Ryan Nembhard","pos":"PG","stats_season":"2025-26","gp":60,"pts":6.6,"reb":2.2,"ast":5.3,"stl":0.4,"blk":0,"tov":1.4,"fg":41.5,"fg3":35.6,"ft":80.6,"salary":None},
            {"name":"Henri Veesaar","pos":"C","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":None},
            {"name":"Asa Newell","pos":"PF","stats_season":"2025-26","gp":44,"pts":5.2,"reb":2.2,"ast":0.6,"stl":0.4,"blk":0.3,"tov":0.5,"fg":53.8,"fg3":38.7,"ft":55.2,"salary":3300000},
            {"name":"Mouhamed Gueye","pos":"PF","stats_season":"2025-26","gp":77,"pts":4.4,"reb":3.6,"ast":0.9,"stl":0.8,"blk":0.5,"tov":0.4,"fg":45.2,"fg3":30.8,"ft":64.5,"salary":2400000},
            {"name":"Zuby Ejiofor","pos":"PF","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":3400000},
            {"name":"Aaron Wiggins","pos":"SG","stats_season":"2025-26","gp":65,"pts":9.4,"reb":3.1,"ast":1.7,"stl":0.9,"blk":0.4,"tov":1.2,"fg":43.1,"fg3":35.6,"ft":73.6,"salary":8800000},
            {"name":"Jalen Wilson","pos":"SF","stats_season":"2025-26","gp":54,"pts":6.4,"reb":2.1,"ast":0.9,"stl":0.4,"blk":0,"tov":0.7,"fg":39.6,"fg3":35.5,"ft":71.9,"salary":None},
            {"name":"Corey Kispert","pos":"SF","stats_season":"2025-26","gp":58,"pts":9.2,"reb":2.3,"ast":1.6,"stl":0.3,"blk":0.2,"tov":0.8,"fg":46.7,"fg3":36.7,"ft":79.4,"salary":13900000},
            {"name":"Jock Landale","pos":"C","stats_season":"2025-26","gp":68,"pts":10.6,"reb":5.7,"ast":1.7,"stl":0.5,"blk":0.5,"tov":0.9,"fg":51.5,"fg3":38.3,"ft":63.5,"salary":14100000},
            {"name":"Jonathan Kuminga","pos":"F","stats_season":"2025-26","gp":36,"pts":12.2,"reb":5.6,"ast":2.3,"stl":0.6,"blk":0.3,"tov":1.9,"fg":46.3,"fg3":33.3,"ft":72.4,"salary":0},
            {"name":"Luguentz Dort","pos":"SG","stats_season":"2025-26","gp":69,"pts":8.3,"reb":3.6,"ast":1.2,"stl":0.9,"blk":0.4,"tov":0.8,"fg":38.5,"fg3":34.4,"ft":75.9,"salary":18222222},
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
        "total_salary": 153570647,
        "tax_status": "Under Cap",
        "championships": 0,
        "championship_years": [],
        "logo": "https://cdn.nba.com/logos/nba/1610612766/primary/L/logo.svg",
        "description": "Revamped perimeter group featuring Brandon Miller, Coby White, and stretch big Naz Reid.",
        "starters_2026_27": [
            {"name":"Coby White","pos":"PG","stats_season":"2025-26","gp":50,"pts":17.4,"reb":3.4,"ast":4,"stl":0.5,"blk":0.1,"tov":2.6,"fg":44.6,"fg3":36.2,"ft":81.7,"salary":26800000},
            {"name":"Kon Knueppel","pos":"SG","stats_season":"2025-26","gp":81,"pts":18.5,"reb":5.3,"ast":3.4,"stl":0.7,"blk":0.2,"tov":2,"fg":47.5,"fg3":42.5,"ft":86.3,"salary":10500000},
            {"name":"Brandon Miller","pos":"SF","stats_season":"2025-26","gp":65,"pts":20.2,"reb":4.9,"ast":3.3,"stl":1,"blk":0.7,"tov":2.5,"fg":43.5,"fg3":38.3,"ft":89.2,"salary":15100000},
            {"name":"Naz Reid","pos":"PF","stats_season":"2025-26","gp":77,"pts":13.6,"reb":6.2,"ast":2.2,"stl":1,"blk":1,"tov":1.6,"fg":45.6,"fg3":36.2,"ft":73.2,"salary":23300000},
            {"name":"Moussa Diabaté","pos":"C","stats_season":"2025-26","gp":73,"pts":7.9,"reb":8.7,"ast":1.9,"stl":0.8,"blk":1,"tov":1,"fg":63.1,"fg3":50,"ft":65.9,"salary":2400000},
        ],
        "bench_2026_27": [
            {"name":"Michael Ajayi","pos":"SG","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":None},
            {"name":"Kylan Boswell","pos":"PG","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":None},
            {"name":"Royce O'Neale","pos":"PF","stats_season":"2025-26","gp":78,"pts":9.8,"reb":4.8,"ast":2.7,"stl":1.1,"blk":0.4,"tov":1.3,"fg":42.1,"fg3":40.8,"ft":71.1,"salary":10800000},
            {"name":"Grant Williams","pos":"PF","stats_season":"2025-26","gp":36,"pts":7,"reb":3.9,"ast":1.6,"stl":0.5,"blk":0.5,"tov":0.9,"fg":42.6,"fg3":38.8,"ft":81.5,"salary":14200000},
            {"name":"Sion James","pos":"SG","stats_season":"2025-26","gp":82,"pts":5.4,"reb":3.5,"ast":2,"stl":0.6,"blk":0.2,"tov":0.8,"fg":37.1,"fg3":35.2,"ft":83.7,"salary":2400000},
            {"name":"Christian Anderson","pos":"PG","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":4200000},
            {"name":"Grayson Allen","pos":"SG","stats_season":"2025-26","gp":51,"pts":16.5,"reb":3,"ast":3.8,"stl":1.4,"blk":0.3,"tov":1.6,"fg":40.3,"fg3":34.9,"ft":85.7,"salary":18100000},
            {"name":"Dennis Schröder","pos":"PG","stats_season":"2025-26","gp":70,"pts":10.8,"reb":2.7,"ast":4.9,"stl":0.8,"blk":0.2,"tov":1.8,"fg":40.5,"fg3":32.9,"ft":83.4,"salary":14800000},
            {"name":"Ryan Kalkbrenner","pos":"C","stats_season":"2025-26","gp":69,"pts":7.6,"reb":5.5,"ast":0.8,"stl":0.5,"blk":1.5,"tov":0.9,"fg":75.3,"fg3":0,"ft":71.6,"salary":2400000},
            {"name":"Antonio Reeves","pos":"SG","stats_season":"2025-26","gp":10,"pts":2.7,"reb":0.8,"ast":0.3,"stl":0.1,"blk":0,"tov":0.1,"fg":50,"fg3":53.8,"ft":0,"salary":None},
            {"name":"PJ Hall","pos":"C","stats_season":"2025-26","gp":19,"pts":4.5,"reb":3.9,"ast":0.5,"stl":0.2,"blk":0.5,"tov":0.8,"fg":50.8,"fg3":60,"ft":79.3,"salary":0},
            {"name":"Pat Connaughton","pos":"SG","stats_season":"2025-26","gp":42,"pts":2.6,"reb":1.5,"ast":0.4,"stl":0.3,"blk":0,"tov":0.3,"fg":44.7,"fg3":40.4,"ft":65,"salary":3800000},
            {"name":"Bez Mbeng","pos":"SG","stats_season":"2025-26","gp":15,"pts":8.1,"reb":3.8,"ast":4.1,"stl":2.3,"blk":0.3,"tov":1.5,"fg":50,"fg3":19.4,"ft":64,"salary":None},
            {"name":"Hannes Steinbach","pos":"PF","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":5200000},
            {"name":"Xavier Tillman","pos":"PF","stats_season":"2025-26","gp":30,"pts":1.5,"reb":1.4,"ast":0.4,"stl":0.3,"blk":0.2,"tov":0.3,"fg":43.5,"fg3":16.7,"ft":25,"salary":None},
            {"name":"Tidjane Salaün","pos":"PF","stats_season":"2025-26","gp":37,"pts":6,"reb":4,"ast":0.7,"stl":0.4,"blk":0.2,"tov":0.7,"fg":50.3,"fg3":43.4,"ft":65,"salary":8200000},
            {"name":"Liam McNeeley","pos":"SF","stats_season":"2025-26","gp":31,"pts":4.3,"reb":2.4,"ast":0.8,"stl":0.2,"blk":0.1,"tov":0.4,"fg":40,"fg3":40,"ft":82.1,"salary":2900000},
            {"name":"Mouhamadou Gueye","pos":"F","stats_season":"2025-26","gp":2,"pts":8,"reb":3,"ast":3,"stl":1,"blk":0.5,"tov":1.5,"fg":54.5,"fg3":20,"ft":75,"salary":2400000},
        ],
        "draft_picks": charlotte_draft_picks
    },
    {
        "id": 14,
        "name": "Orlando Magic",
        "conference": "Eastern",
        "division": "Southeast",
        "featured_star": "Paolo Banchero",
        "headline_stat": "23.5 PPG, 7.2 RPG, 5.8 APG",
        "last_season_record": "45-37",
        "total_salary": 223288224,
        "tax_status": "1st Apron",
        "championships": 0,
        "championship_years": [],
        "logo": "https://cdn.nba.com/logos/nba/1610612753/primary/L/logo.svg",
        "description": "Elite defensive squad with forward versatility led by Paolo Banchero and Franz Wagner.",
        "starters_2026_27": [
            {"name":"Jalen Suggs","pos":"PG","stats_season":"2025-26","gp":57,"pts":13.8,"reb":3.9,"ast":5.5,"stl":1.8,"blk":0.7,"tov":2.7,"fg":43.5,"fg3":33.9,"ft":85.5,"salary":32400000},
            {"name":"Desmond Bane","pos":"SG","stats_season":"2025-26","gp":82,"pts":20.1,"reb":4.1,"ast":4.1,"stl":1,"blk":0.5,"tov":2,"fg":48.4,"fg3":39.1,"ft":90.8,"salary":39446090},
            {"name":"Franz Wagner","pos":"SF","stats_season":"2025-26","gp":34,"pts":20.6,"reb":5.2,"ast":3.3,"stl":0.9,"blk":0.3,"tov":1.7,"fg":48.1,"fg3":34.5,"ft":82.3,"salary":41754690},
            {"name":"Paolo Banchero","pos":"PF","stats_season":"2025-26","gp":72,"pts":22.2,"reb":8.4,"ast":5.2,"stl":0.7,"blk":0.6,"tov":3.1,"fg":45.9,"fg3":30.5,"ft":77.5,"salary":41500000},
            {"name":"Wendell Carter Jr.","pos":"C","stats_season":"2025-26","gp":78,"pts":11.8,"reb":7.4,"ast":2,"stl":0.8,"blk":0.6,"tov":1.3,"fg":51.2,"fg3":31.9,"ft":79.2,"salary":18102000},
        ],
        "bench_2026_27": [
            {"name":"Anthony Black","pos":"PG","stats_season":"2025-26","gp":64,"pts":15,"reb":3.8,"ast":3.7,"stl":1.4,"blk":0.7,"tov":2.1,"fg":44.7,"fg3":33.3,"ft":73.2,"salary":10106316},
            {"name":"Jonathan Isaac","pos":"PF","stats_season":"2025-26","gp":52,"pts":2.6,"reb":2.5,"ast":0.4,"stl":0.4,"blk":0.6,"tov":0.3,"fg":42.2,"fg3":18.4,"ft":60.3,"salary":10449421},
            {"name":"Jevon Carter","pos":"PG","stats_season":"2025-26","gp":53,"pts":6.4,"reb":1.7,"ast":1.6,"stl":0.8,"blk":0.2,"tov":0.7,"fg":40.1,"fg3":36.3,"ft":78.9,"salary":2449421},
            {"name":"JD Davison","pos":"PG","stats_season":"2025-26","gp":28,"pts":2.5,"reb":1.2,"ast":1.3,"stl":0.2,"blk":0.2,"tov":0.3,"fg":37.5,"fg3":25,"ft":68.4,"salary":2625627},
            {"name":"Malaki Branham","pos":"SG","stats_season":"2025-26","gp":28,"pts":4.6,"reb":1.6,"ast":0.8,"stl":0.4,"blk":0.1,"tov":0.5,"fg":47.3,"fg3":37.8,"ft":82.4,"salary":2537526},
            {"name":"Jamal Cain","pos":"SF","stats_season":"2025-26","gp":40,"pts":5.4,"reb":2,"ast":0.7,"stl":0.3,"blk":0.1,"tov":0.5,"fg":48.7,"fg3":38.4,"ft":84.8,"salary":2584539},
            {"name":"Nikola Vučević","pos":"C","stats_season":"2025-26","gp":64,"pts":15.1,"reb":8.4,"ast":3.3,"stl":0.6,"blk":0.6,"tov":1.3,"fg":49.3,"fg3":36.9,"ft":82.8,"salary":2449421},
            {"name":"Jase Richardson","pos":"SG","stats_season":"2025-26","gp":54,"pts":4.4,"reb":1.2,"ast":1.1,"stl":0.4,"blk":0,"tov":0.5,"fg":47.3,"fg3":35.4,"ft":71.7,"salary":3132360},
            {"name":"Colin Castleton","pos":"C","stats_season":"2025-26","gp":4,"pts":1.3,"reb":2,"ast":0.3,"stl":0.3,"blk":0,"tov":0.5,"fg":40,"fg3":0,"ft":100,"salary":None},
            {"name":"Tristan da Silva","pos":"SF","stats_season":"2025-26","gp":77,"pts":9.9,"reb":3.7,"ast":1.6,"stl":0.9,"blk":0.3,"tov":0.9,"fg":45,"fg3":37.4,"ft":88.4,"salary":3991200},
            {"name":"Izaiyah Nelson","pos":"PF","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":None},
            {"name":"Alex Morales","pos":"SG","stats_season":"2025-26","gp":4,"pts":2,"reb":0.8,"ast":1,"stl":0,"blk":0,"tov":1,"fg":42.9,"fg3":0,"ft":100,"salary":None},
            {"name":"Goga Bitadze","pos":"C","stats_season":"2025-26","gp":64,"pts":5.9,"reb":5,"ast":1.3,"stl":0.6,"blk":1,"tov":0.7,"fg":67.6,"fg3":18.2,"ft":71.1,"salary":7608696},
            {"name":"Noah Penda","pos":"SF","stats_season":"2025-26","gp":59,"pts":3.8,"reb":3.2,"ast":1.2,"stl":0.5,"blk":0.3,"tov":0.7,"fg":40.4,"fg3":32.3,"ft":68.8,"salary":2150917},
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
        "total_salary": 183462525,
        "tax_status": "Over Cap",
        "championships": 1,
        "championship_years": [1978],
        "logo": "https://cdn.nba.com/logos/nba/1610612764/primary/L/logo.svg",
        "description": "Revitalized attack featuring elite playmaker Trae Young, rim protector Anthony Davis, and Alex Sarr.",
        "starters_2026_27": [
            {"name":"Trae Young","pos":"PG","stats_season":"2025-26","gp":15,"pts":17.9,"reb":2,"ast":8,"stl":0.9,"blk":0.1,"tov":2.6,"fg":45.8,"fg3":33.8,"ft":82.5,"salary":49488300},
            {"name":"Kyshawn George","pos":"SG","stats_season":"2025-26","gp":48,"pts":14.8,"reb":5.1,"ast":4.5,"stl":1,"blk":0.9,"tov":2.6,"fg":43.8,"fg3":38.1,"ft":80.2,"salary":3108000},
            {"name":"Bilal Coulibaly","pos":"SF","stats_season":"2025-26","gp":56,"pts":11.7,"reb":4.3,"ast":2.6,"stl":1.3,"blk":1,"tov":1.4,"fg":42.5,"fg3":31.9,"ft":74.6,"salary":9240012},
            {"name":"Alex Sarr","pos":"PF","stats_season":"2025-26","gp":48,"pts":16.3,"reb":7.4,"ast":2.7,"stl":0.8,"blk":2,"tov":1.7,"fg":48.2,"fg3":33.3,"ft":69.2,"salary":12370680},
            {"name":"Anthony Davis","pos":"C","stats_season":"2025-26","gp":20,"pts":20.4,"reb":11.1,"ast":2.8,"stl":1.1,"blk":1.7,"tov":2.1,"fg":50.6,"fg3":27,"ft":72.8,"salary":58456566},
        ],
        "bench_2026_27": [
            {"name":"Felix Okpara","pos":"C","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":None},
            {"name":"Tristan Vukcevic","pos":"PF","stats_season":"2025-26","gp":49,"pts":9,"reb":3,"ast":1.1,"stl":0.5,"blk":0.7,"tov":1.3,"fg":47.9,"fg3":34.7,"ft":78.4,"salary":None},
            {"name":"AJ Dybantsa","pos":"SF","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":14748000},
            {"name":"Jamir Watkins","pos":"SF","stats_season":"2025-26","gp":50,"pts":7.4,"reb":3.9,"ast":1.3,"stl":1.1,"blk":0.5,"tov":0.8,"fg":44.6,"fg3":29.7,"ft":69.5,"salary":None},
            {"name":"Deandre Ayton","pos":"C","stats_season":"2025-26","gp":72,"pts":12.5,"reb":8,"ast":0.8,"stl":0.6,"blk":1,"tov":1.2,"fg":67.1,"fg3":0,"ft":64.5,"salary":8104000},
            {"name":"Bub Carrington","pos":"PG","stats_season":"2025-26","gp":82,"pts":10.7,"reb":3.4,"ast":4.6,"stl":0.6,"blk":0.2,"tov":2.3,"fg":42.4,"fg3":40.8,"ft":73,"salary":4900560},
            {"name":"Justin Champagnie","pos":"SF","stats_season":"2025-26","gp":69,"pts":8.7,"reb":5.6,"ast":1.2,"stl":0.9,"blk":0.6,"tov":0.7,"fg":50.2,"fg3":31.9,"ft":78.4,"salary":2667944},
            {"name":"Tre Johnson","pos":"SG","stats_season":"2025-26","gp":60,"pts":12.2,"reb":2.8,"ast":2,"stl":0.6,"blk":0.3,"tov":1.6,"fg":41.9,"fg3":35.8,"ft":87.4,"salary":8649600},
            {"name":"Sharife Cooper","pos":"PG","stats_season":"2025-26","gp":41,"pts":8.1,"reb":2.1,"ast":3,"stl":0.4,"blk":0.1,"tov":1.5,"fg":51.4,"fg3":38.2,"ft":83.3,"salary":None},
            {"name":"Anthony Gill","pos":"PF","stats_season":"2025-26","gp":55,"pts":5.8,"reb":2.9,"ast":1.3,"stl":0.6,"blk":0.4,"tov":0.7,"fg":62.8,"fg3":35.4,"ft":73.9,"salary":2449421},
            {"name":"Khris Middleton","pos":"SF","stats_season":"2025-26","gp":63,"pts":10.2,"reb":3.7,"ast":2.8,"stl":0.7,"blk":0.1,"tov":1.7,"fg":42,"fg3":36,"ft":87.5,"salary":5591122},
            {"name":"Will Riley","pos":"SF","stats_season":"2025-26","gp":74,"pts":10.3,"reb":2.9,"ast":2,"stl":0.7,"blk":0.1,"tov":1.3,"fg":43.9,"fg3":31.6,"ft":80,"salary":3688320},
        ],
        "draft_picks": washington_draft_picks
    },
    {
        "id": 16,
        "name": "Denver Nuggets",
        "conference": "Western",
        "division": "Northwest",
        "featured_star": "Nikola Jokić",
        "headline_stat": "29.6 PPG, 12.8 RPG, 10.2 APG",
        "last_season_record": "54-28",
        "total_salary": 221069148,
        "tax_status": "Luxury Tax",
        "championships": 1,
        "championship_years": [2023],
        "logo": "https://cdn.nba.com/logos/nba/1610612743/primary/L/logo.svg",
        "description": "Championship contender orchestrated by 3-time MVP Nikola Jokic, Jamal Murray, and DeMar DeRozan.",
        "starters_2026_27": [
            {"name":"Jamal Murray","pos":"PG","stats_season":"2025-26","gp":75,"pts":25.4,"reb":4.4,"ast":7.1,"stl":0.9,"blk":0.4,"tov":2.3,"fg":48.3,"fg3":43.5,"ft":88.7,"salary":50105628},
            {"name":"Christian Braun","pos":"SG","stats_season":"2025-26","gp":44,"pts":12,"reb":4.8,"ast":2.7,"stl":0.7,"blk":0.3,"tov":1,"fg":51.9,"fg3":30.1,"ft":78.2,"salary":21551726},
            {"name":"DeMar DeRozan","pos":"SF","stats_season":"2025-26","gp":77,"pts":18.4,"reb":2.9,"ast":4.1,"stl":1,"blk":0.3,"tov":1.2,"fg":49.7,"fg3":32,"ft":86.8,"salary":2449421},
            {"name":"Aaron Gordon","pos":"PF","stats_season":"2025-26","gp":36,"pts":16.2,"reb":5.8,"ast":2.7,"stl":0.6,"blk":0.3,"tov":1.1,"fg":49.7,"fg3":38.9,"ft":76.7,"salary":33658037},
            {"name":"Nikola Jokić","pos":"C","stats_season":"2025-26","gp":65,"pts":27.7,"reb":12.9,"ast":10.7,"stl":1.4,"blk":0.8,"tov":3.7,"fg":56.9,"fg3":38,"ft":83.1,"salary":59033114},
        ],
        "bench_2026_27": [
            {"name":"Trevon Brazile","pos":"PF","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":1357763},
            {"name":"Bryce Hopkins","pos":"PF","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":None},
            {"name":"Alpha Diallo","pos":"SF","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":None},
            {"name":"Curtis Jones","pos":"SG","stats_season":"2025-26","gp":10,"pts":2.9,"reb":1.1,"ast":1,"stl":0.4,"blk":0,"tov":0.2,"fg":40.7,"fg3":33.3,"ft":50,"salary":None},
            {"name":"Julian Strawther","pos":"SG","stats_season":"2025-26","gp":57,"pts":7.2,"reb":2,"ast":1.1,"stl":0.4,"blk":0.1,"tov":0.6,"fg":46.7,"fg3":38.7,"ft":81.4,"salary":4826931},
            {"name":"Tyus Jones","pos":"PG","stats_season":"2025-26","gp":67,"pts":3,"reb":1.1,"ast":2.4,"stl":0.6,"blk":0,"tov":0.4,"fg":34.9,"fg3":29.2,"ft":77.8,"salary":2449421},
            {"name":"DaRon Holmes II","pos":"PF","stats_season":"2025-26","gp":25,"pts":3.7,"reb":1.4,"ast":0.6,"stl":0,"blk":0.2,"tov":0.5,"fg":50.8,"fg3":44.4,"ft":78.6,"salary":3372120},
            {"name":"Lonnie Walker IV","pos":"SG","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":3286399},
            {"name":"Spencer Jones","pos":"SF","stats_season":"2025-26","gp":64,"pts":5.5,"reb":3.3,"ast":0.8,"stl":0.8,"blk":0.5,"tov":0.5,"fg":50.4,"fg3":39.6,"ft":60.8,"salary":6000000},
            {"name":"Zeke Nnaji","pos":"C","stats_season":"2025-26","gp":52,"pts":3.7,"reb":2.6,"ast":0.6,"stl":0.3,"blk":0.5,"tov":0.5,"fg":47,"fg3":25.9,"ft":77.3,"salary":7466667},
            {"name":"Cameron Johnson","pos":"SF","stats_season":"2025-26","gp":54,"pts":12.2,"reb":3.8,"ast":2.4,"stl":0.7,"blk":0.4,"tov":0.9,"fg":48,"fg3":43,"ft":83.9,"salary":23062500},
            {"name":"KJ Simpson","pos":"PG","stats_season":"2025-26","gp":20,"pts":4.6,"reb":1.9,"ast":2.2,"stl":0.8,"blk":0,"tov":1.3,"fg":34.3,"fg3":30,"ft":61.1,"salary":None},
            {"name":"Marvin Bagley III","pos":"PF","stats_season":"2025-26","gp":60,"pts":10.5,"reb":6.1,"ast":1.4,"stl":0.5,"blk":0.7,"tov":1,"fg":61.8,"fg3":46.2,"ft":66,"salary":2449421},
            {"name":"David Roddy","pos":"SF","stats_season":"2025-26","gp":5,"pts":8,"reb":4,"ast":0.8,"stl":0.8,"blk":0.2,"tov":0.4,"fg":50,"fg3":27.3,"ft":100,"salary":None},
        ],
        "draft_picks": denver_draft_picks
    },
    {
        "id": 17,
        "name": "Minnesota Timberwolves",
        "conference": "Western",
        "division": "Northwest",
        "featured_star": "Anthony Edwards",
        "headline_stat": "27.2 PPG, 5.7 RPG, 5.1 APG",
        "last_season_record": "49-33",
        "total_salary": 215327417,
        "tax_status": "1st Apron",
        "championships": 0,
        "championship_years": [],
        "logo": "https://cdn.nba.com/logos/nba/1610612750/primary/L/logo.svg",
        "description": "Star-loaded contender pairing superstar Anthony Edwards with LaMelo Ball and Jonathan Kuminga.",
        "starters_2026_27": [
            {"name":"LaMelo Ball","pos":"PG","stats_season":"2025-26","gp":72,"pts":20.1,"reb":4.8,"ast":7.1,"stl":1.2,"blk":0.2,"tov":2.8,"fg":40.7,"fg3":36.8,"ft":89.9,"salary":40770520},
            {"name":"Anthony Edwards","pos":"SG","stats_season":"2025-26","gp":61,"pts":28.8,"reb":5,"ast":3.7,"stl":1.4,"blk":0.8,"tov":2.9,"fg":48.9,"fg3":39.9,"ft":79.6,"salary":48924624},
            {"name":"Jaden McDaniels","pos":"SF","stats_season":"2025-26","gp":73,"pts":14.8,"reb":4.2,"ast":2.7,"stl":1.1,"blk":1,"tov":1.8,"fg":51.5,"fg3":41.2,"ft":83.5,"salary":26200001},
            {"name":"Jonathan Kuminga","pos":"PF","stats_season":"2025-26","gp":36,"pts":12.2,"reb":5.6,"ast":2.3,"stl":0.6,"blk":0.3,"tov":1.9,"fg":46.3,"fg3":33.3,"ft":72.4,"salary":6064000},
            {"name":"Rudy Gobert","pos":"C","stats_season":"2025-26","gp":76,"pts":10.9,"reb":11.5,"ast":1.7,"stl":0.8,"blk":1.6,"tov":1.4,"fg":68.2,"fg3":0,"ft":52.6,"salary":36500000},
        ],
        "bench_2026_27": [
            {"name":"Donte DiVincenzo","pos":"SG","stats_season":"2025-26","gp":82,"pts":12.2,"reb":4.1,"ast":3.8,"stl":1.3,"blk":0.4,"tov":1.4,"fg":40.6,"fg3":37.9,"ft":74.3,"salary":12535000},
            {"name":"Terance Shannon Jr","pos":"SG","stats_season":"2025-26","gp":43,"pts":5.6,"reb":1.1,"ast":0.9,"stl":0.3,"blk":0,"tov":0.6,"fg":45,"fg3":40.8,"ft":80,"salary":None},
            {"name":"Cody Williams","pos":"SF","stats_season":"2025-26","gp":67,"pts":8.8,"reb":3,"ast":2,"stl":0.8,"blk":0.4,"tov":1.1,"fg":46.8,"fg3":21.4,"ft":70.6,"salary":6015600},
            {"name":"Jaylen Clark","pos":"SG","stats_season":"2025-26","gp":68,"pts":4,"reb":1.8,"ast":0.6,"stl":0.7,"blk":0.1,"tov":0.3,"fg":43.4,"fg3":32.7,"ft":65.7,"salary":3086420},
            {"name":"Bones Hyland","pos":"PG","stats_season":"2025-26","gp":71,"pts":8.5,"reb":1.8,"ast":2.6,"stl":0.6,"blk":0.2,"tov":1,"fg":45.3,"fg3":38.8,"ft":78,"salary":2845883},
            {"name":"Ayo Dosunmu","pos":"SG","stats_season":"2025-26","gp":69,"pts":14.8,"reb":3.4,"ast":3.6,"stl":0.8,"blk":0.3,"tov":1.4,"fg":51.7,"fg3":43.9,"ft":87.6,"salary":19310345},
            {"name":"Trey Kaufman-Renn","pos":"PF","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":None},
            {"name":"Zyon Pullin","pos":"PG","stats_season":"2025-26","gp":5,"pts":4.6,"reb":0.6,"ast":1.8,"stl":0.2,"blk":0,"tov":0.6,"fg":69.2,"fg3":33.3,"ft":100,"salary":None},
            {"name":"Joan Beringer","pos":"PF","stats_season":"2025-26","gp":40,"pts":3.9,"reb":2.3,"ast":0.3,"stl":0.2,"blk":0.7,"tov":0.3,"fg":66.3,"fg3":0,"ft":70.3,"salary":4411200},
            {"name":"Enrique Freeman","pos":"PF","stats_season":"2025-26","gp":4,"pts":3.3,"reb":2.5,"ast":0.5,"stl":0.5,"blk":0.8,"tov":0.5,"fg":50,"fg3":50,"ft":75,"salary":None},
            {"name":"Isaiah Evans","pos":"SF","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":1357763},
            {"name":"Trey Lyles","pos":"PF","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":2449421},
            {"name":"Rocco Zikarsky","pos":"C","stats_season":"2025-26","gp":5,"pts":2.8,"reb":2.8,"ast":0.4,"stl":0,"blk":1,"tov":0.2,"fg":62.5,"fg3":0,"ft":100,"salary":None},
            {"name":"John Konchar","pos":"SG","stats_season":"2025-26","gp":56,"pts":4.4,"reb":4.3,"ast":2.1,"stl":1.5,"blk":0.7,"tov":0.6,"fg":47.2,"fg3":28.3,"ft":72.7,"salary":2055000},
            {"name":"Terrence Shannon Jr.","pos":"F","stats_season":"2025-26","gp":43,"pts":5.6,"reb":1.1,"ast":0.9,"stl":0.3,"blk":0,"tov":0.6,"fg":45,"fg3":40.8,"ft":80,"salary":2801640},
        ],
        "draft_picks": minnesota_draft_picks
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
            {"name":"Shai Gilgeous-Alexander","pos":"PG","stats_season":"2025-26","gp":68,"pts":31.1,"reb":4.3,"ast":6.6,"stl":1.4,"blk":0.8,"tov":2.2,"fg":55.3,"fg3":38.6,"ft":87.9,"salary":40800000},
            {"name":"Cason Wallace","pos":"SG","stats_season":"2025-26","gp":77,"pts":8.6,"reb":3.1,"ast":2.6,"stl":1.9,"blk":0.4,"tov":0.9,"fg":43.2,"fg3":35.1,"ft":80.9,"salary":7400000},
            {"name":"Jalen Williams","pos":"SF","stats_season":"2025-26","gp":33,"pts":17.1,"reb":4.6,"ast":5.5,"stl":1.2,"blk":0.3,"tov":1.9,"fg":48.4,"fg3":29.9,"ft":83.7,"salary":41200000},
            {"name":"Chet Holmgren","pos":"PF","stats_season":"2025-26","gp":69,"pts":17.1,"reb":8.9,"ast":1.7,"stl":0.6,"blk":1.9,"tov":1.6,"fg":55.7,"fg3":36.2,"ft":79.2,"salary":41200000},
            {"name":"Isaiah Hartenstein","pos":"C","stats_season":"2025-26","gp":47,"pts":9.2,"reb":9.4,"ast":3.5,"stl":1,"blk":0.8,"tov":1.7,"fg":62.2,"fg3":0,"ft":61,"salary":23100000},
        ],
        "bench_2026_27": [
            {"name":"Josh Dix","pos":"SG","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":None},
            {"name":"Jared McCain","pos":"SG","stats_season":"2025-26","gp":67,"pts":8.3,"reb":2,"ast":1.3,"stl":0.5,"blk":0.1,"tov":0.8,"fg":42.5,"fg3":38.5,"ft":86.4,"salary":4400000},
            {"name":"Jaylin Williams","pos":"PF","stats_season":"2025-26","gp":65,"pts":7.2,"reb":5.5,"ast":2.4,"stl":0.5,"blk":0.6,"tov":1,"fg":42.3,"fg3":38.3,"ft":79.3,"salary":7700000},
            {"name":"Alex Caruso","pos":"SG","stats_season":"2025-26","gp":56,"pts":6.2,"reb":2.8,"ast":2,"stl":1.3,"blk":0.3,"tov":0.9,"fg":42.3,"fg3":29.3,"ft":80.4,"salary":19500000},
            {"name":"Thomas Sorber","pos":"C","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":4800000},
            {"name":"Otega Oweh","pos":"SG","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":None},
            {"name":"Bennett Stirtz","pos":"PG","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":4700000},
            {"name":"Aday Mara","pos":"C","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":5700000},
            {"name":"Brooks Barnhizer","pos":"SG","stats_season":"2025-26","gp":40,"pts":1.7,"reb":2,"ast":0.6,"stl":0.3,"blk":0.1,"tov":0.3,"fg":38,"fg3":29.2,"ft":70,"salary":0},
            {"name":"Ajay Mitchell","pos":"PG","stats_season":"2025-26","gp":57,"pts":13.6,"reb":3.3,"ast":3.6,"stl":1.2,"blk":0.3,"tov":1.4,"fg":48.5,"fg3":34.7,"ft":87,"salary":2800000},
            {"name":"Kenrich Williams","pos":"SF","stats_season":"2025-26","gp":56,"pts":6.5,"reb":3.3,"ast":1.4,"stl":0.6,"blk":0.1,"tov":0.8,"fg":47.3,"fg3":38.8,"ft":63.5,"salary":5000000},
            {"name":"Nikola Topić","pos":"PG","stats_season":"2025-26","gp":10,"pts":5.2,"reb":1.9,"ast":4.4,"stl":0.5,"blk":0,"tov":2.5,"fg":43.1,"fg3":40,"ft":40,"salary":5400000},
        ],
        "draft_picks": oklahoma_city_draft_picks
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
            {"name":"Damian Lillard","pos":"PG","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":13300000},
            {"name":"Ja Morant","pos":"SG","stats_season":"2025-26","gp":20,"pts":19.5,"reb":3.3,"ast":8.1,"stl":1,"blk":0.3,"tov":3.6,"fg":41,"fg3":23.5,"ft":89.7,"salary":42100000},
            {"name":"Deni Avdija","pos":"SF","stats_season":"2025-26","gp":66,"pts":24.2,"reb":6.9,"ast":6.7,"stl":0.8,"blk":0.6,"tov":3.8,"fg":46.2,"fg3":31.8,"ft":80.2,"salary":13100000},
            {"name":"Jeremy Sochan","pos":"PF","stats_season":"2025-26","gp":44,"pts":3.6,"reb":2.4,"ast":0.9,"stl":0.4,"blk":0.2,"tov":0.5,"fg":49.6,"fg3":24.4,"ft":73.1,"salary":None},
            {"name":"Donovan Clingan","pos":"C","stats_season":"2025-26","gp":77,"pts":12.1,"reb":11.6,"ast":2.1,"stl":0.6,"blk":1.7,"tov":1.2,"fg":52,"fg3":34.1,"ft":68,"salary":7500000},
        ],
        "bench_2026_27": [
            {"name":"Jayson Kent","pos":"SF","stats_season":"2025-26","gp":5,"pts":2,"reb":1,"ast":0,"stl":0.2,"blk":0.2,"tov":0,"fg":57.1,"fg3":25,"ft":100,"salary":None},
            {"name":"Scoot Henderson","pos":"PG","stats_season":"2025-26","gp":30,"pts":14.2,"reb":2.7,"ast":3.7,"stl":0.9,"blk":0.3,"tov":2.4,"fg":41.8,"fg3":35.2,"ft":84,"salary":13500000},
            {"name":"Chris Youngblood","pos":"SG","stats_season":"2025-26","gp":34,"pts":2.1,"reb":0.8,"ast":0.4,"stl":0.1,"blk":0.1,"tov":0.1,"fg":34.9,"fg3":33.3,"ft":90,"salary":0},
            {"name":"Jrue Holiday","pos":"PG","stats_season":"2025-26","gp":53,"pts":16.3,"reb":4.6,"ast":6.1,"stl":1,"blk":0.1,"tov":2.8,"fg":45.1,"fg3":37.8,"ft":83.8,"salary":34800000},
            {"name":"John Tonje","pos":"SG","stats_season":"2025-26","gp":6,"pts":2.5,"reb":1,"ast":0.3,"stl":0.3,"blk":0,"tov":0,"fg":28.6,"fg3":30,"ft":100,"salary":None},
            {"name":"Micah Potter","pos":"C","stats_season":"2025-26","gp":47,"pts":9.7,"reb":5,"ast":1.5,"stl":0.5,"blk":0.3,"tov":1,"fg":51.5,"fg3":42.3,"ft":84.2,"salary":2800000},
            {"name":"Branden Carlson","pos":"C","stats_season":"2025-26","gp":42,"pts":5.8,"reb":3,"ast":0.7,"stl":0.2,"blk":0.6,"tov":0.4,"fg":52.7,"fg3":36,"ft":57.7,"salary":2400000},
            {"name":"Yang Hansen","pos":"C","stats_season":"2025-26","gp":43,"pts":2.2,"reb":1.5,"ast":0.5,"stl":0.1,"blk":0.2,"tov":0.7,"fg":31,"fg3":11.9,"ft":82.4,"salary":4600000},
            {"name":"Shaedon Sharpe","pos":"SG","stats_season":"2025-26","gp":50,"pts":20.8,"reb":4.3,"ast":2.6,"stl":1.4,"blk":0.1,"tov":2.9,"fg":45.2,"fg3":33.7,"ft":78.7,"salary":20000000},
            {"name":"Vít Krejčí","pos":"PG","stats_season":"2025-26","gp":65,"pts":8.5,"reb":2.3,"ast":1.5,"stl":0.7,"blk":0.3,"tov":0.6,"fg":44.8,"fg3":39,"ft":74.5,"salary":2600000},
            {"name":"Toumani Camara","pos":"SF","stats_season":"2025-26","gp":82,"pts":13.4,"reb":5.1,"ast":2.5,"stl":1.1,"blk":0.4,"tov":1.8,"fg":44,"fg3":37,"ft":70.8,"salary":18000000},
            {"name":"Robert Williams III","pos":"C","stats_season":"2025-26","gp":59,"pts":6.7,"reb":7,"ast":1,"stl":0.6,"blk":1.5,"tov":0.8,"fg":70.8,"fg3":39.1,"ft":59.6,"salary":14000000},
            {"name":"Sidy Cissoko","pos":"SG","stats_season":"2025-26","gp":75,"pts":5.1,"reb":2.2,"ast":1.5,"stl":0.7,"blk":0.3,"tov":0.9,"fg":39.8,"fg3":29.8,"ft":65.9,"salary":2400000},
        ],
        "draft_picks": portland_draft_picks
    },
    {
        "id": 20,
        "name": "Utah Jazz",
        "conference": "Western",
        "division": "Northwest",
        "featured_star": "Lauri Markkanen",
        "headline_stat": "22.8 PPG, 8.0 RPG",
        "last_season_record": "22-60",
        "total_salary": 173265019,
        "tax_status": "Over Cap",
        "championships": 0,
        "championship_years": [],
        "logo": "https://cdn.nba.com/logos/nba/1610612762/primary/L/logo.svg",
        "description": "Floor-spacing lineup keyed by Lauri Markkanen, Keyonte George, and defensive anchor Jusuf Nurkic.",
        "starters_2026_27": [
            {"name":"Keyonte George","pos":"PG","stats_season":"2025-26","gp":54,"pts":23.6,"reb":3.7,"ast":6.1,"stl":1.1,"blk":0.3,"tov":3.1,"fg":45.6,"fg3":37.1,"ft":89.2,"salary":6500000},
            {"name":"Josh Green","pos":"SG","stats_season":"2025-26","gp":58,"pts":4.3,"reb":1.8,"ast":0.8,"stl":0.6,"blk":0.1,"tov":0.6,"fg":45.9,"fg3":42,"ft":89.3,"salary":None},
            {"name":"Lauri Markkanen","pos":"SF","stats_season":"2025-26","gp":42,"pts":26.7,"reb":6.9,"ast":2.1,"stl":1,"blk":0.5,"tov":1.5,"fg":47.7,"fg3":35.5,"ft":89.6,"salary":46100000},
            {"name":"Jaren Jackson Jr.","pos":"PF","stats_season":"2025-26","gp":48,"pts":19.4,"reb":5.7,"ast":2,"stl":1.1,"blk":1.4,"tov":2.2,"fg":47.6,"fg3":35.7,"ft":80.3,"salary":49000000},
            {"name":"Jusuf Nurkić","pos":"C","stats_season":"2025-26","gp":41,"pts":10.9,"reb":10.4,"ast":4.8,"stl":1.3,"blk":0.5,"tov":2.5,"fg":50.3,"fg3":35.2,"ft":54.9,"salary":11400000},
        ],
        "bench_2026_27": [
            {"name":"Hayden Gray","pos":"G","stats_season":"2025-26","gp":1,"pts":6,"reb":0,"ast":1,"stl":1,"blk":1,"tov":1,"fg":66.7,"fg3":0,"ft":100,"salary":None},
            {"name":"Kyle Filipowski","pos":"C","stats_season":"2025-26","gp":77,"pts":11.4,"reb":7.2,"ast":2.6,"stl":0.9,"blk":0.5,"tov":1.6,"fg":49.2,"fg3":32.5,"ft":75,"salary":3000000},
            {"name":"Blake Hinson","pos":"F","stats_season":"2025-26","gp":14,"pts":11.9,"reb":2.4,"ast":1.1,"stl":0.4,"blk":0.1,"tov":0.4,"fg":51.3,"fg3":46.8,"ft":75,"salary":0},
            {"name":"Tamar Bates","pos":"G","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":0},
            {"name":"Isaiah Collier","pos":"PG","stats_season":"2025-26","gp":59,"pts":11.7,"reb":2.5,"ast":7.2,"stl":1.1,"blk":0.3,"tov":2.5,"fg":49.5,"fg3":27,"ft":72.2,"salary":2700000},
            {"name":"Svi Mykhailiuk","pos":"G-F","stats_season":"2025-26","gp":50,"pts":9.4,"reb":2.5,"ast":1.9,"stl":0.5,"blk":0.1,"tov":0.8,"fg":47.8,"fg3":40.8,"ft":89.3,"salary":3800000},
            {"name":"Jaxson Hayes","pos":"C","stats_season":"2025-26","gp":66,"pts":7.5,"reb":4.1,"ast":0.9,"stl":0.4,"blk":0.8,"tov":0.5,"fg":75.6,"fg3":100,"ft":65.3,"salary":6000000},
            {"name":"Mo Bamba","pos":"C","stats_season":"2025-26","gp":4,"pts":2.5,"reb":5.5,"ast":0.3,"stl":0,"blk":0.8,"tov":0.5,"fg":45.5,"fg3":0,"ft":0,"salary":3500000},
            {"name":"Ace Bailey","pos":"G-F","stats_season":"2025-26","gp":72,"pts":13.8,"reb":4.2,"ast":1.8,"stl":0.8,"blk":0.7,"tov":1.5,"fg":44.3,"fg3":34.4,"ft":75,"salary":9500000},
            {"name":"Josh Okogie","pos":"G","stats_season":"2025-26","gp":78,"pts":4.5,"reb":2.6,"ast":0.9,"stl":0.8,"blk":0.2,"tov":0.5,"fg":42.5,"fg3":38.5,"ft":59.4,"salary":6000000},
            {"name":"Darron Peterson","pos":"G","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":None},
            {"name":"Trey Alexander","pos":"G","stats_season":"2025-26","gp":9,"pts":5.2,"reb":1.2,"ast":1,"stl":0.7,"blk":0.2,"tov":0.3,"fg":51.4,"fg3":50,"ft":60,"salary":0},
            {"name":"Brice Sensabaugh","pos":"F","stats_season":"2025-26","gp":75,"pts":14.9,"reb":3.1,"ast":1.9,"stl":0.7,"blk":0.2,"tov":1.7,"fg":46,"fg3":36.7,"ft":82.6,"salary":4800000},
            {"name":"Harrison Ingram","pos":"F","stats_season":"2025-26","gp":7,"pts":1.6,"reb":0.4,"ast":0.1,"stl":0,"blk":0,"tov":0.1,"fg":83.3,"fg3":100,"ft":0,"salary":None},
            {"name":"Darryn Peterson","pos":"F","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":13100000},
            {"name":"Cody Williams","pos":"F","stats_season":"2025-26","gp":67,"pts":8.8,"reb":3,"ast":2,"stl":0.8,"blk":0.4,"tov":1.1,"fg":46.8,"fg3":21.4,"ft":70.6,"salary":6000000},
        ],
        "draft_picks": utah_draft_picks
    },
    {
        "id": 21,
        "name": "Golden State Warriors",
        "conference": "Western",
        "division": "Pacific",
        "featured_star": "Stephen Curry",
        "headline_stat": "24.2 PPG, 6.1 APG",
        "last_season_record": "37-45",
        "total_salary": 223306506,
        "tax_status": "1st Apron",
        "championships": 7,
        "championship_years": [1947, 1956, 1975, 2015, 2017, 2018, 2022],
        "logo": "https://cdn.nba.com/logos/nba/1610612744/primary/L/logo.svg",
        "description": "Veteran championship contender orchestrated by Stephen Curry, Draymond Green, Jimmy Butler, and Kristaps Porzingis.",
        "starters_2026_27": [
            {"name":"Stephen Curry","pos":"PG","stats_season":"2025-26","gp":43,"pts":26.6,"reb":3.6,"ast":4.7,"stl":1.1,"blk":0.4,"tov":2.8,"fg":46.8,"fg3":39.3,"ft":92.3,"salary":62587158},
            {"name":"Brandin Podziemski","pos":"SG","stats_season":"2025-26","gp":82,"pts":13.8,"reb":5.1,"ast":3.7,"stl":1.1,"blk":0.2,"tov":1.6,"fg":45.5,"fg3":37.1,"ft":79.7,"salary":5679459},
            {"name":"Jimmy Butler","pos":"SF","stats_season":"2025-26","gp":38,"pts":20,"reb":5.6,"ast":4.9,"stl":1.4,"blk":0.2,"tov":1.6,"fg":51.9,"fg3":37.6,"ft":86.4,"salary":56832773},
            {"name":"Draymond Green","pos":"PF","stats_season":"2025-26","gp":68,"pts":8.4,"reb":5.5,"ast":5.5,"stl":0.9,"blk":0.6,"tov":2.7,"fg":41.8,"fg3":32.6,"ft":70.2,"salary":27678571},
            {"name":"Kristaps Porziņģis","pos":"C","stats_season":"2025-26","gp":32,"pts":16.7,"reb":5.2,"ast":2.5,"stl":0.6,"blk":1.2,"tov":1.3,"fg":44.6,"fg3":33.8,"ft":84.2,"salary":19512195},
        ],
        "bench_2026_27": [
            {"name":"Gary Payton II","pos":"SG","stats_season":"2025-26","gp":73,"pts":7.5,"reb":3.6,"ast":1.7,"stl":0.9,"blk":0.3,"tov":0.8,"fg":58.3,"fg3":29.1,"ft":65,"salary":2449421},
            {"name":"Yaxel Lendeborg","pos":"PF","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":6096240},
            {"name":"Will Richard","pos":"SG","stats_season":"2025-26","gp":69,"pts":6.4,"reb":2.5,"ast":1.3,"stl":1.2,"blk":0.1,"tov":0.8,"fg":46.8,"fg3":33.5,"ft":85.2,"salary":2150917},
            {"name":"Moses Moody","pos":"SG","stats_season":"2025-26","gp":60,"pts":12.1,"reb":3.3,"ast":1.6,"stl":1,"blk":0.6,"tov":1,"fg":44,"fg3":40.1,"ft":77,"salary":12500000},
            {"name":"De'Anthony Melton","pos":"SG","stats_season":"2025-26","gp":49,"pts":12.3,"reb":3.2,"ast":2.6,"stl":1.6,"blk":0.4,"tov":1.9,"fg":40.7,"fg3":29.4,"ft":82.6,"salary":5477000},
            {"name":"Brandon Williams","pos":"PG","stats_season":"2025-26","gp":66,"pts":13,"reb":2.9,"ast":3.9,"stl":0.9,"blk":0.3,"tov":1.9,"fg":47.2,"fg3":23.2,"ft":79.3,"salary":2449421},
            {"name":"Gui Santos","pos":"SF","stats_season":"2025-26","gp":68,"pts":9.2,"reb":3.9,"ast":2.3,"stl":0.9,"blk":0.3,"tov":1.5,"fg":50,"fg3":35.1,"ft":72.5,"salary":4629630},
            {"name":"LJ Cryer","pos":"PG","stats_season":"2025-26","gp":18,"pts":8.2,"reb":1.6,"ast":1,"stl":0.2,"blk":0,"tov":0.8,"fg":40.2,"fg3":39.4,"ft":89.5,"salary":None},
            {"name":"Nate Williams","pos":"SG","stats_season":"2025-26","gp":14,"pts":8,"reb":2.1,"ast":1,"stl":0.4,"blk":0,"tov":1.1,"fg":48.9,"fg3":43.3,"ft":86.7,"salary":None},
            {"name":"Al Horford","pos":"C","stats_season":"2025-26","gp":45,"pts":8.3,"reb":4.9,"ast":2.6,"stl":0.7,"blk":1.1,"tov":0.9,"fg":42.6,"fg3":36.1,"ft":84.6,"salary":6822000},
            {"name":"Dalen Terry","pos":"SF","stats_season":"2025-26","gp":48,"pts":3.7,"reb":1.8,"ast":1.4,"stl":0.6,"blk":0.3,"tov":0.5,"fg":43.9,"fg3":36.4,"ft":53.3,"salary":1357763},
            {"name":"Alex Toohey","pos":"SF","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":2185116},
            {"name":"Lajae Jones","pos":"SG","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":None},
            {"name":"Charles Bassey","pos":"C","stats_season":"2025-26","gp":13,"pts":5.8,"reb":4.4,"ast":0.5,"stl":0.3,"blk":0.8,"tov":0.5,"fg":66,"fg3":0,"ft":70,"salary":2449421},
            {"name":"Seth Curry","pos":"SG","stats_season":"2025-26","gp":10,"pts":7.1,"reb":1.2,"ast":1,"stl":0.3,"blk":0,"tov":0.2,"fg":49,"fg3":48,"ft":91.7,"salary":None},
            {"name":"Georges Niang","pos":"PF","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":2449421},
            {"name":"Malevy Leons","pos":"PF","stats_season":"2025-26","gp":25,"pts":3.3,"reb":2.1,"ast":0.9,"stl":0.6,"blk":0.4,"tov":0.5,"fg":44.4,"fg3":25,"ft":78.9,"salary":None},
        ],
        "draft_picks": golden_state_draft_picks
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
            {"name":"Kris Dunn","pos":"PG","stats_season":"2025-26","gp":82,"pts":7.3,"reb":3.3,"ast":3.6,"stl":1.6,"blk":0.2,"tov":1.4,"fg":47.6,"fg3":37.4,"ft":76.5,"salary":5684800},
            {"name":"Darius Garland","pos":"SG","stats_season":"2025-26","gp":45,"pts":18.8,"reb":2.4,"ast":6.7,"stl":1,"blk":0.2,"tov":2.9,"fg":46,"fg3":39.6,"ft":86.1,"salary":42166510},
            {"name":"Brandon Ingram","pos":"SF","stats_season":"2025-26","gp":77,"pts":21.5,"reb":5.6,"ast":3.7,"stl":0.8,"blk":0.7,"tov":2.4,"fg":47.7,"fg3":38.2,"ft":82,"salary":40000000},
            {"name":"Rui Hachimura","pos":"PF","stats_season":"2025-26","gp":68,"pts":11.5,"reb":3.3,"ast":0.8,"stl":0.6,"blk":0.3,"tov":0.6,"fg":51.4,"fg3":44.3,"ft":69.4,"salary":14000000},
            {"name":"Brook Lopez","pos":"C","stats_season":"2025-26","gp":75,"pts":8.5,"reb":3.6,"ast":1.3,"stl":0.6,"blk":1.2,"tov":0.8,"fg":42.8,"fg3":36,"ft":75.7,"salary":9187500},
        ],
        "bench_2026_27": [
            {"name":"Gradey Dick","pos":"SG","stats_season":"2025-26","gp":76,"pts":6,"reb":1.9,"ast":0.7,"stl":0.6,"blk":0.1,"tov":0.6,"fg":41.9,"fg3":30.1,"ft":87.5,"salary":7131511},
            {"name":"Norchad Omier","pos":"PF","stats_season":"2025-26","gp":6,"pts":2.8,"reb":1.2,"ast":0.3,"stl":0.2,"blk":0,"tov":0,"fg":70,"fg3":0,"ft":100,"salary":None},
            {"name":"Baba Miller","pos":"PF","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":1705630},
            {"name":"Nick Martinelli","pos":"SF","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":0},
            {"name":"Narcisse Ngoy","pos":"C","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":None},
            {"name":"Bradley Beal","pos":"SG","stats_season":"2025-26","gp":6,"pts":8.2,"reb":0.8,"ast":1.7,"stl":0.5,"blk":0,"tov":1.5,"fg":37.5,"fg3":36.8,"ft":75,"salary":6424800},
            {"name":"Keaton Wagler","pos":"SG","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":9674760},
            {"name":"Max Strus","pos":"SG","stats_season":"2025-26","gp":12,"pts":11.2,"reb":5.4,"ast":2,"stl":0.3,"blk":0,"tov":0.8,"fg":44.3,"fg3":40.2,"ft":77.8,"salary":16660836},
            {"name":"Kobe Sanders","pos":"SG","stats_season":"2025-26","gp":68,"pts":7.3,"reb":2.3,"ast":1.6,"stl":0.7,"blk":0.1,"tov":1.2,"fg":46.6,"fg3":40.8,"ft":82.6,"salary":2622139},
            {"name":"Derrick Jones Jr.","pos":"SF","stats_season":"2025-26","gp":50,"pts":10.1,"reb":3.5,"ast":1.4,"stl":0.9,"blk":1,"tov":0.8,"fg":49.9,"fg3":35.9,"ft":76.3,"salary":10476190},
            {"name":"Yuki Kawamura","pos":"PG","stats_season":"2025-26","gp":18,"pts":3.4,"reb":1.8,"ast":2.6,"stl":0.5,"blk":0,"tov":0.8,"fg":32.7,"fg3":29.7,"ft":89.5,"salary":2449421},
            {"name":"Yanic Konan Niederhäuser","pos":"C","stats_season":"2025-26","gp":41,"pts":4.3,"reb":2.9,"ast":0.3,"stl":0.1,"blk":0.7,"tov":0.6,"fg":64,"fg3":20,"ft":75.8,"salary":2880960},
            {"name":"Jordan Miller","pos":"SG","stats_season":"2025-26","gp":60,"pts":10,"reb":3,"ast":2.3,"stl":0.8,"blk":0.2,"tov":1.1,"fg":53.1,"fg3":34.5,"ft":77.7,"salary":5300000},
            {"name":"Johni Broome","pos":"PF","stats_season":"2025-26","gp":11,"pts":0.9,"reb":1.5,"ast":0.4,"stl":0.3,"blk":0.2,"tov":0.3,"fg":16.7,"fg3":0,"ft":33.3,"salary":None},
            {"name":"Isaiah Jackson","pos":"PF","stats_season":"2025-26","gp":55,"pts":6.7,"reb":5.3,"ast":0.9,"stl":0.7,"blk":0.9,"tov":1.1,"fg":63.7,"fg3":0,"ft":64.8,"salary":7000000},
            {"name":"Cam Christie","pos":"SG","stats_season":"2025-26","gp":55,"pts":2.8,"reb":1.4,"ast":0.6,"stl":0.3,"blk":0.1,"tov":0.4,"fg":38.1,"fg3":24.5,"ft":76,"salary":2296271},
            {"name":"Jalen Pickett","pos":"PG","stats_season":"2025-26","gp":50,"pts":5.2,"reb":2.3,"ast":2.3,"stl":0.3,"blk":0.1,"tov":0.7,"fg":42.2,"fg3":38.6,"ft":78.9,"salary":0},
            {"name":"Nicolas Batum","pos":"SF","stats_season":"2025-26","gp":74,"pts":4,"reb":2.5,"ast":0.9,"stl":0.6,"blk":0.3,"tov":0.5,"fg":40.3,"fg3":40.4,"ft":81.8,"salary":5881680},
            {"name":"Jamarion Sharp","pos":"C","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":None},
            {"name":"Fletcher Loyer","pos":"F","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":0},
        ],
        "draft_picks": clippers_draft_picks
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
            {"name":"Luka Dončić","pos":"PG","stats_season":"2025-26","gp":64,"pts":33.5,"reb":7.7,"ast":8.3,"stl":1.6,"blk":0.5,"tov":4,"fg":47.6,"fg3":36.6,"ft":78,"salary":49800000},
            {"name":"Austin Reaves","pos":"SG","stats_season":"2025-26","gp":51,"pts":23.3,"reb":4.7,"ast":5.5,"stl":1.1,"blk":0.4,"tov":3,"fg":49,"fg3":36,"ft":87.1,"salary":41240250},
            {"name":"Quentin Grimes","pos":"SF","stats_season":"2025-26","gp":75,"pts":13.4,"reb":3.6,"ast":3.3,"stl":0.9,"blk":0.4,"tov":1.8,"fg":45,"fg3":33.4,"ft":84,"salary":13953489},
            {"name":"Sandro Mamukelashvili","pos":"PF","stats_season":"2025-26","gp":80,"pts":11.2,"reb":4.9,"ast":1.9,"stl":0.8,"blk":0.5,"tov":0.8,"fg":52.3,"fg3":38.9,"ft":74.7,"salary":13000000},
            {"name":"Walker Kessler","pos":"C","stats_season":"2025-26","gp":5,"pts":14.4,"reb":10.8,"ast":3,"stl":1.4,"blk":1.8,"tov":3.2,"fg":70.3,"fg3":75,"ft":70,"salary":30232558},
        ],
        "bench_2026_27": [
            {"name":"Arthur Kaluma","pos":"PF","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":None},
            {"name":"Adou Thiero","pos":"SG","stats_season":"2025-26","gp":25,"pts":1.9,"reb":1.1,"ast":0.4,"stl":0.3,"blk":0.1,"tov":0.4,"fg":51.6,"fg3":33.3,"ft":63.6,"salary":2150917},
            {"name":"Jarred Vanderbilt","pos":"PF","stats_season":"2025-26","gp":65,"pts":4.4,"reb":4.5,"ast":1.3,"stl":0.8,"blk":0.3,"tov":0.9,"fg":47.1,"fg3":29.3,"ft":58.9,"salary":12428571},
            {"name":"Matisse Thybulle","pos":"SG","stats_season":"2025-26","gp":30,"pts":5.8,"reb":2,"ast":0.9,"stl":2,"blk":0.5,"tov":0.9,"fg":43.3,"fg3":39.8,"ft":84,"salary":2449421},
            {"name":"Dalton Knecht","pos":"SF","stats_season":"2025-26","gp":54,"pts":4.2,"reb":1.4,"ast":0.4,"stl":0.2,"blk":0.2,"tov":0.4,"fg":45.5,"fg3":34.2,"ft":72.7,"salary":4201080},
            {"name":"Jaden Hardy","pos":"SG","stats_season":"2025-26","gp":57,"pts":9.2,"reb":1.5,"ast":1,"stl":0.3,"blk":0.1,"tov":1.1,"fg":42.4,"fg3":39.7,"ft":73.3,"salary":6000000},
            {"name":"Bronny James","pos":"PG","stats_season":"2025-26","gp":42,"pts":2.9,"reb":0.5,"ast":1.2,"stl":0.5,"blk":0.1,"tov":0.6,"fg":40.9,"fg3":38.6,"ft":85.7,"salary":2296271},
            {"name":"Collin Sexton","pos":"PG","stats_season":"2025-26","gp":68,"pts":15.4,"reb":2.3,"ast":3.3,"stl":1.1,"blk":0.1,"tov":2.1,"fg":48.5,"fg3":40.1,"ft":85.5,"salary":9366000},
            {"name":"Ziaire Williams","pos":"SF","stats_season":"2025-26","gp":56,"pts":10.2,"reb":2.4,"ast":1.1,"stl":1.4,"blk":0.4,"tov":1.1,"fg":42.5,"fg3":34.3,"ft":85,"salary":2449421},
            {"name":"Jake LaRavia","pos":"SF","stats_season":"2025-26","gp":82,"pts":8.2,"reb":4,"ast":1.8,"stl":1.3,"blk":0.5,"tov":1.1,"fg":45.9,"fg3":32.1,"ft":76.3,"salary":6000000},
            {"name":"Chris Mañon","pos":"SG","stats_season":"2025-26","gp":9,"pts":0.8,"reb":1.1,"ast":0.3,"stl":0.6,"blk":0.2,"tov":0.1,"fg":33.3,"fg3":0,"ft":75,"salary":None},
            {"name":"AK Okereke","pos":"PF","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":None},
            {"name":"Cameron Carr","pos":"SG","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":3315360},
            {"name":"Kevon Looney","pos":"C","stats_season":"2025-26","gp":21,"pts":2.8,"reb":5.6,"ast":1.6,"stl":0.4,"blk":0.5,"tov":0.4,"fg":41.7,"fg3":15.4,"ft":70,"salary":2449421},
        ],
        "draft_picks": lakers_draft_picks
    },
    {
        "id": 24,
        "name": "Phoenix Suns",
        "conference": "Western",
        "division": "Pacific",
        "featured_star": "Devin Booker",
        "headline_stat": "25.8 PPG, 7.1 APG",
        "last_season_record": "45-37",
        "total_salary": 193028455,
        "tax_status": "1st Apron",
        "championships": 0,
        "championship_years": [],
        "logo": "https://cdn.nba.com/logos/nba/1610612756/primary/L/logo.svg",
        "description": "Potent perimeter scoring group featuring Devin Booker, Miles Bridges, Dillon Brooks, and Mark Williams.",
        "starters_2026_27": [
            {"name":"Devin Booker","pos":"PG","stats_season":"2025-26","gp":64,"pts":26.1,"reb":3.9,"ast":6,"stl":0.8,"blk":0.3,"tov":3.1,"fg":45.6,"fg3":33,"ft":87.3,"salary":57078728},
            {"name":"Jalen Green","pos":"SG","stats_season":"2025-26","gp":32,"pts":17.8,"reb":3.6,"ast":2.8,"stl":1.1,"blk":0.3,"tov":2.3,"fg":42.2,"fg3":31.3,"ft":74.7,"salary":36251166},
            {"name":"Dillon Brooks","pos":"SF","stats_season":"2025-26","gp":56,"pts":20.2,"reb":3.6,"ast":1.8,"stl":1,"blk":0.2,"tov":1.8,"fg":43.5,"fg3":34.4,"ft":84.2,"salary":19992727},
            {"name":"Miles Bridges","pos":"PF","stats_season":"2025-26","gp":77,"pts":17.1,"reb":5.8,"ast":3.2,"stl":0.6,"blk":0.4,"tov":1.4,"fg":46,"fg3":33.3,"ft":82.2,"salary":22826087},
            {"name":"Mark Williams","pos":"C","stats_season":"2025-26","gp":60,"pts":11.7,"reb":8,"ast":1,"stl":0.9,"blk":0.9,"tov":1.1,"fg":64.4,"fg3":100,"ft":77.1,"salary":11728395},
        ],
        "bench_2026_27": [
            {"name":"Ryan Dunn","pos":"PF","stats_season":"2025-26","gp":70,"pts":5.8,"reb":4.2,"ast":1.5,"stl":0.9,"blk":0.4,"tov":0.8,"fg":45.3,"fg3":33.1,"ft":48.9,"salary":2784240},
            {"name":"Amir Coffey","pos":"SG","stats_season":"2025-26","gp":46,"pts":3.2,"reb":1.2,"ast":0.6,"stl":0.2,"blk":0.1,"tov":0.2,"fg":48.7,"fg3":34.7,"ft":78.6,"salary":None},
            {"name":"Haywood Highsmith","pos":"PF","stats_season":"2025-26","gp":7,"pts":5.4,"reb":1.9,"ast":1,"stl":0.6,"blk":0,"tov":0,"fg":52.2,"fg3":57.1,"ft":85.7,"salary":3449421},
            {"name":"Luke Kennard","pos":"SG","stats_season":"2025-26","gp":78,"pts":8.4,"reb":2.3,"ast":2.2,"stl":0.7,"blk":0.1,"tov":0.8,"fg":53.3,"fg3":47.8,"ft":91.3,"salary":6064000},
            {"name":"Khaman Maluach","pos":"C","stats_season":"2025-26","gp":46,"pts":3,"reb":2.9,"ast":0.1,"stl":0.1,"blk":0.7,"tov":0.5,"fg":53.3,"fg3":23.8,"ft":71,"salary":6316680},
            {"name":"Oso Ighodaro","pos":"PF","stats_season":"2025-26","gp":82,"pts":6.5,"reb":5.1,"ast":2.3,"stl":0.9,"blk":0.7,"tov":1.2,"fg":65.3,"fg3":0,"ft":45.3,"salary":2296271},
            {"name":"Collin Gillespie","pos":"PG","stats_season":"2025-26","gp":80,"pts":12.7,"reb":4.1,"ast":4.6,"stl":1.2,"blk":0.2,"tov":1.6,"fg":41.8,"fg3":40.1,"ft":87.4,"salary":10714286},
            {"name":"Koby Brea","pos":"SG","stats_season":"2025-26","gp":12,"pts":3.8,"reb":0.7,"ast":0.8,"stl":0.1,"blk":0,"tov":0.3,"fg":41.7,"fg3":43.3,"ft":100,"salary":None},
            {"name":"Jamaree Bouyea","pos":"PG","stats_season":"2025-26","gp":46,"pts":5.7,"reb":1.8,"ast":1.8,"stl":0.6,"blk":0.3,"tov":0.7,"fg":45.8,"fg3":29.5,"ft":68.6,"salary":2584539},
            {"name":"Isaiah Livers","pos":"PF","stats_season":"2025-26","gp":36,"pts":1.8,"reb":1.7,"ast":0.6,"stl":0.4,"blk":0.2,"tov":0.3,"fg":34.4,"fg3":30,"ft":75,"salary":None},
            {"name":"Koa Peat","pos":"PF","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":2926800},
            {"name":"Rasheer Fleming","pos":"PF","stats_season":"2025-26","gp":55,"pts":4.3,"reb":2.3,"ast":0.3,"stl":0.4,"blk":0.4,"tov":0.5,"fg":40.5,"fg3":34.6,"ft":55.9,"salary":2150917},
            {"name":"CJ Huntley","pos":"PF","stats_season":"2025-26","gp":4,"pts":3,"reb":1.3,"ast":0.5,"stl":0.3,"blk":0,"tov":0,"fg":54.5,"fg3":0,"ft":0,"salary":None},
            {"name":"Jordan Goodwin","pos":"SG","stats_season":"2025-26","gp":70,"pts":8.7,"reb":4.9,"ast":2.2,"stl":1.5,"blk":0.2,"tov":1,"fg":41.3,"fg3":37.1,"ft":69.6,"salary":5864198},
            {"name":"Pat Spencer","pos":"PG","stats_season":"2025-26","gp":66,"pts":7.2,"reb":2.4,"ast":3.5,"stl":0.7,"blk":0.1,"tov":1.3,"fg":42.7,"fg3":35.7,"ft":77.2,"salary":None},
        ],
        "draft_picks": phoenix_draft_picks
    },
    {
        "id": 25,
        "name": "Sacramento Kings",
        "conference": "Western",
        "division": "Pacific",
        "featured_star": "Domantas Sabonis",
        "headline_stat": "19.4 PPG, 13.9 RPG, 8.2 APG",
        "last_season_record": "22-60",
        "total_salary": 191795907,
        "tax_status": "Over Cap",
        "championships": 1,
        "championship_years": [1951],
        "logo": "https://cdn.nba.com/logos/nba/1610612758/primary/L/logo.svg",
        "description": "High-IQ passing and scoring unit led by triple-double machine Domantas Sabonis and Zach LaVine.",
        "starters_2026_27": [
            {"name":"Darius Acuff Jr.","pos":"PG","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":8021640},
            {"name":"De'Andre Hunter","pos":"SG","stats_season":"2025-26","gp":45,"pts":13.7,"reb":4.1,"ast":2,"stl":0.7,"blk":0.1,"tov":1.7,"fg":41.5,"fg3":30.5,"ft":86.7,"salary":24910714},
            {"name":"Keegan Murray","pos":"SF","stats_season":"2025-26","gp":23,"pts":14,"reb":5.7,"ast":1.7,"stl":1,"blk":1.6,"tov":1.2,"fg":42,"fg3":27.7,"ft":77.6,"salary":24137936},
            {"name":"Zach LaVine","pos":"PF","stats_season":"2025-26","gp":39,"pts":19.2,"reb":2.8,"ast":2.3,"stl":0.7,"blk":0.3,"tov":1.9,"fg":47.9,"fg3":39,"ft":88,"salary":48967380},
            {"name":"Domantas Sabonis","pos":"C","stats_season":"2025-26","gp":19,"pts":15.8,"reb":11.4,"ast":4.1,"stl":0.9,"blk":0.2,"tov":2.7,"fg":54.3,"fg3":18.5,"ft":72.7,"salary":45472000},
        ],
        "bench_2026_27": [
            {"name":"Malik Monk","pos":"SG","stats_season":"2025-26","gp":62,"pts":12.5,"reb":1.9,"ast":3,"stl":0.6,"blk":0.4,"tov":1.5,"fg":43.8,"fg3":39.5,"ft":87.9,"salary":20190035},
            {"name":"Jonathan Mogbo","pos":"PF","stats_season":"2025-26","gp":40,"pts":1.5,"reb":1.7,"ast":0.6,"stl":0.3,"blk":0.2,"tov":0.4,"fg":59.1,"fg3":0,"ft":64.3,"salary":None},
            {"name":"Precious Achiuwa","pos":"PF","stats_season":"2025-26","gp":73,"pts":10.1,"reb":6.7,"ast":1.4,"stl":0.9,"blk":0.7,"tov":0.9,"fg":52.8,"fg3":27.8,"ft":55.4,"salary":5477000},
            {"name":"Nique Clifford","pos":"SG","stats_season":"2025-26","gp":75,"pts":8.6,"reb":3.8,"ast":2.4,"stl":0.9,"blk":0.3,"tov":1.5,"fg":41.8,"fg3":33.3,"ft":72.2,"salary":3263400},
            {"name":"Adam Flagler","pos":"PG","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":None},
            {"name":"Ben Simmons","pos":"PG","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":2449421},
            {"name":"Daeqwon Plowden","pos":"SG","stats_season":"2025-26","gp":32,"pts":10.8,"reb":3,"ast":1.3,"stl":0.7,"blk":0.2,"tov":0.8,"fg":43,"fg3":33.3,"ft":85.7,"salary":2449421},
            {"name":"Dylan Cardwell","pos":"C","stats_season":"2025-26","gp":44,"pts":5.4,"reb":7.5,"ast":1.4,"stl":0.7,"blk":1.5,"tov":0.9,"fg":58.7,"fg3":50,"ft":51,"salary":None},
            {"name":"Alex Karaban","pos":"SF","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":2948280},
            {"name":"Emanuel Sharp","pos":"SG","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":1357763},
            {"name":"Maxime Raynaud","pos":"C","stats_season":"2025-26","gp":74,"pts":12.5,"reb":7.5,"ast":1.4,"stl":0.5,"blk":0.5,"tov":1.3,"fg":57.1,"fg3":32.4,"ft":78.6,"salary":2150917},
        ],
        "draft_picks": sacramento_draft_picks
    },
    {
        "id": 26,
        "name": "Dallas Mavericks",
        "conference": "Western",
        "division": "Southwest",
        "featured_star": "Kyrie Irving",
        "headline_stat": "25.2 PPG, 5.1 APG",
        "last_season_record": "26-56",
        "total_salary": 177194561,
        "tax_status": "Over Cap",
        "championships": 1,
        "championship_years": [2011],
        "logo": "https://cdn.nba.com/logos/nba/1610612742/primary/L/logo.svg",
        "description": "Electrifying roster revolving around Kyrie Irving, #1 pick Zaccharie Risacher, and top draft standout Cooper Flagg.",
        "starters_2026_27": [
            {"name":"Kyrie Irving","pos":"PG","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":39491282},
            {"name":"Max Christie","pos":"SG","stats_season":"2025-26","gp":77,"pts":12.3,"reb":3.2,"ast":2,"stl":0.6,"blk":0.4,"tov":1.2,"fg":44.1,"fg3":40.4,"ft":89.9,"salary":8285714},
            {"name":"Zaccharie Risacher","pos":"SF","stats_season":"2025-26","gp":67,"pts":9.6,"reb":3.8,"ast":1.1,"stl":0.9,"blk":0.5,"tov":0.9,"fg":45.5,"fg3":36.8,"ft":64.4,"salary":13826040},
            {"name":"Cooper Flagg","pos":"PF","stats_season":"2025-26","gp":70,"pts":21,"reb":6.7,"ast":4.5,"stl":1.2,"blk":0.9,"tov":2.3,"fg":46.8,"fg3":29.5,"ft":82.7,"salary":14517480},
            {"name":"Dereck Lively II","pos":"C","stats_season":"2025-26","gp":7,"pts":4.3,"reb":5.3,"ast":1.9,"stl":0.6,"blk":1.6,"tov":1.4,"fg":61.1,"fg3":0,"ft":80,"salary":7239131},
        ],
        "bench_2026_27": [
            {"name":"Tarik Biberovic","pos":"SF","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":3000000},
            {"name":"Vsevolod Ishchenko","pos":"SG","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":None},
            {"name":"John Poulakidas","pos":"SG","stats_season":"2025-26","gp":13,"pts":8.8,"reb":2.3,"ast":0.8,"stl":0.5,"blk":0.3,"tov":0.3,"fg":42.9,"fg3":40.3,"ft":85.7,"salary":None},
            {"name":"Naji Marshall","pos":"SF","stats_season":"2025-26","gp":74,"pts":15.2,"reb":4.7,"ast":3.3,"stl":1.1,"blk":0.1,"tov":1.6,"fg":51,"fg3":29.1,"ft":76,"salary":9428571},
            {"name":"Dwight Powell","pos":"C","stats_season":"2025-26","gp":63,"pts":3.3,"reb":4.1,"ast":1.1,"stl":0.5,"blk":0.3,"tov":0.7,"fg":64.4,"fg3":28.6,"ft":69.6,"salary":None},
            {"name":"Marcus Sasser","pos":"PG","stats_season":"2025-26","gp":38,"pts":5.2,"reb":1,"ast":2,"stl":0.5,"blk":0.1,"tov":0.8,"fg":39,"fg3":41.5,"ft":83.3,"salary":5198983},
            {"name":"Jett Howard","pos":"SF","stats_season":"2025-26","gp":55,"pts":5.5,"reb":1.6,"ast":0.8,"stl":0.2,"blk":0.2,"tov":0.3,"fg":41.8,"fg3":37.2,"ft":94.9,"salary":None},
            {"name":"Morez Johnson Jr.","pos":"PF","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":6754800},
            {"name":"Caleb Martin","pos":"SF","stats_season":"2025-26","gp":58,"pts":3.9,"reb":2.5,"ast":1.4,"stl":0.7,"blk":0.3,"tov":0.7,"fg":45,"fg3":35.1,"ft":60.7,"salary":10001493},
            {"name":"Daniel Gafford","pos":"C","stats_season":"2025-26","gp":55,"pts":9.5,"reb":6.9,"ast":1.1,"stl":0.8,"blk":1.3,"tov":1.1,"fg":65.5,"fg3":0,"ft":68.3,"salary":17263584},
            {"name":"P.J. Washington","pos":"PF","stats_season":"2025-26","gp":56,"pts":14.2,"reb":7,"ast":1.8,"stl":1,"blk":1.1,"tov":1.7,"fg":45,"fg3":32.5,"ft":68.7,"salary":19813044},
            {"name":"Moussa Cisse","pos":"C","stats_season":"2025-26","gp":38,"pts":4.5,"reb":5.7,"ast":0.2,"stl":0.5,"blk":1.2,"tov":0.8,"fg":57.4,"fg3":0,"ft":46.9,"salary":2185116},
            {"name":"Tobi Lawal","pos":"SF","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":None},
            {"name":"Santi Aldama","pos":"PF","stats_season":"2025-26","gp":43,"pts":14,"reb":6.7,"ast":2.9,"stl":0.9,"blk":0.7,"tov":1.3,"fg":47.9,"fg3":35,"ft":66.7,"salary":17007043},
            {"name":"Sergio de Larrea","pos":"PG","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":3182280},
        ],
        "draft_picks": dallas_draft_picks
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
            {"name":"Fred VanVleet","pos":"PG","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":25000000},
            {"name":"Amen Thompson","pos":"SG","stats_season":"2025-26","gp":79,"pts":18.3,"reb":7.8,"ast":5.3,"stl":1.5,"blk":0.6,"tov":2.4,"fg":53.4,"fg3":21.6,"ft":77.9,"salary":12258609},
            {"name":"Kevin Durant","pos":"SF","stats_season":"2025-26","gp":78,"pts":26,"reb":5.5,"ast":4.8,"stl":0.8,"blk":0.9,"tov":3.2,"fg":52,"fg3":41.3,"ft":87.4,"salary":43902439},
            {"name":"Jabari Smith Jr.","pos":"PF","stats_season":"2025-26","gp":77,"pts":15.8,"reb":6.9,"ast":1.9,"stl":0.7,"blk":0.9,"tov":1.4,"fg":45,"fg3":36.3,"ft":77.5,"salary":23643411},
            {"name":"Alperen Şengün","pos":"C","stats_season":"2025-26","gp":72,"pts":20.4,"reb":8.9,"ast":6.2,"stl":1.2,"blk":1.1,"tov":3.2,"fg":51.9,"fg3":30.5,"ft":69.1,"salary":35642202},
        ],
        "bench_2026_27": [
            {"name":"Sean Pedulla","pos":"PG","stats_season":"2025-26","gp":7,"pts":1.9,"reb":0.4,"ast":0.7,"stl":0,"blk":0,"tov":0.1,"fg":33.3,"fg3":30,"ft":0,"salary":None},
            {"name":"Bruce Thornton","pos":"PG","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":1357763},
            {"name":"Rafael Castro","pos":"C","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":None},
            {"name":"Quadir Copeland","pos":"SG","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":None},
            {"name":"Aaron Holiday","pos":"PG","stats_season":"2025-26","gp":57,"pts":5.5,"reb":1,"ast":1.1,"stl":0.5,"blk":0.1,"tov":0.7,"fg":41.7,"fg3":39.4,"ft":85.4,"salary":None},
            {"name":"Julian Phillips","pos":"SF","stats_season":"2025-26","gp":48,"pts":2.9,"reb":1,"ast":0.2,"stl":0.5,"blk":0.1,"tov":0.2,"fg":42.1,"fg3":30.8,"ft":78.3,"salary":2537526},
            {"name":"Jae'Sean Tate","pos":"SF","stats_season":"2025-26","gp":46,"pts":2.8,"reb":1.6,"ast":0.5,"stl":0.2,"blk":0.1,"tov":0.3,"fg":51.4,"fg3":31.3,"ft":63.6,"salary":2449421},
            {"name":"Steven Adams","pos":"C","stats_season":"2025-26","gp":32,"pts":5.8,"reb":8.6,"ast":1.5,"stl":0.7,"blk":0.6,"tov":1.1,"fg":50.4,"fg3":0,"ft":58,"salary":13000000},
            {"name":"Reed Sheppard","pos":"SG","stats_season":"2025-26","gp":82,"pts":13.5,"reb":2.9,"ast":3.4,"stl":1.5,"blk":0.7,"tov":1.5,"fg":43,"fg3":39.4,"ft":80.2,"salary":11108880},
            {"name":"Tari Eason","pos":"SF","stats_season":"2025-26","gp":60,"pts":10.5,"reb":6.3,"ast":1.5,"stl":1.2,"blk":0.5,"tov":1.4,"fg":41.6,"fg3":35.8,"ft":77.6,"salary":14051724},
            {"name":"Isaiah Crawford","pos":"SF","stats_season":"2025-26","gp":14,"pts":2,"reb":1.1,"ast":0.4,"stl":0.1,"blk":0.2,"tov":0.3,"fg":41.7,"fg3":23.1,"ft":83.3,"salary":2449421},
            {"name":"Clint Capela","pos":"C","stats_season":"2025-26","gp":75,"pts":3.8,"reb":4.6,"ast":0.7,"stl":0.5,"blk":0.8,"tov":0.5,"fg":52,"fg3":50,"ft":57.7,"salary":7035000},
            {"name":"Bogdan Bogdanović","pos":"SG","stats_season":"2025-26","gp":23,"pts":7.4,"reb":2.6,"ast":2.2,"stl":0.4,"blk":0.1,"tov":1.2,"fg":38.8,"fg3":34.7,"ft":80,"salary":2449421},
            {"name":"Jeff Green","pos":"PF","stats_season":"2025-26","gp":30,"pts":2.2,"reb":0.8,"ast":0.3,"stl":0.1,"blk":0.1,"tov":0.1,"fg":36.8,"fg3":27.3,"ft":100,"salary":None},
            {"name":"Oscar Tshiebwe","pos":"C","stats_season":"2025-26","gp":27,"pts":7.8,"reb":6.6,"ast":1.2,"stl":0.6,"blk":0.2,"tov":0.8,"fg":63.4,"fg3":0,"ft":55.1,"salary":2537526},
            {"name":"Marcus Smart","pos":"PG","stats_season":"2025-26","gp":62,"pts":9.3,"reb":2.8,"ast":3,"stl":1.4,"blk":0.4,"tov":1.5,"fg":39.5,"fg3":33.1,"ft":82.2,"salary":6064000},
        ],
        "draft_picks": houston_draft_picks
    },
    {
        "id": 28,
        "name": "Memphis Grizzlies",
        "conference": "Western",
        "division": "Southwest",
        "featured_star": "Zach Edey",
        "headline_stat": "14.2 PPG, 9.2 RPG, 1.6 BPG",
        "last_season_record": "25-57",
        "total_salary": 133200098,
        "tax_status": "Over Cap",
        "championships": 0,
        "championship_years": [],
        "logo": "https://cdn.nba.com/logos/nba/1610612763/primary/L/logo.svg",
        "description": "Youth-oriented squad anchored by 7-foot-4 center Zach Edey, Jaylen Wells, and Cedric Coward.",
        "starters_2026_27": [
            {"name":"Ty Jerome","pos":"PG","stats_season":"2025-26","gp":15,"pts":19.7,"reb":2.8,"ast":5.7,"stl":1.1,"blk":0.3,"tov":1.8,"fg":47.4,"fg3":42,"ft":87.5,"salary":9220050},
            {"name":"Jaylen Wells","pos":"SG","stats_season":"2025-26","gp":69,"pts":12.5,"reb":3.2,"ast":1.6,"stl":0.9,"blk":0.1,"tov":1.1,"fg":43.1,"fg3":35.3,"ft":78.4,"salary":2296271},
            {"name":"Cedric Coward","pos":"SF","stats_season":"2025-26","gp":62,"pts":13.6,"reb":5.9,"ast":2.8,"stl":0.6,"blk":0.4,"tov":1.7,"fg":47.1,"fg3":33.8,"ft":84.3,"salary":6001080},
            {"name":"Cameron Boozer","pos":"PF","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":11849760},
            {"name":"Zach Edey","pos":"C","stats_season":"2025-26","gp":11,"pts":13.6,"reb":11.1,"ast":1.1,"stl":0.6,"blk":1.9,"tov":2.4,"fg":63.3,"fg3":20,"ft":78.1,"salary":6332760},
        ],
        "bench_2026_27": [
            {"name":"Jahmai Mashack","pos":"SG","stats_season":"2025-26","gp":31,"pts":6.2,"reb":2.6,"ast":2.2,"stl":1.2,"blk":0.5,"tov":1.6,"fg":39.5,"fg3":25.3,"ft":54.3,"salary":None},
            {"name":"Richie Saunders","pos":"SG","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":None},
            {"name":"Scotty Pippen Jr.","pos":"PG","stats_season":"2025-26","gp":10,"pts":11.4,"reb":2.2,"ast":4.7,"stl":1.9,"blk":0.4,"tov":2.7,"fg":44.8,"fg3":31.3,"ft":78.3,"salary":2461462},
            {"name":"Walter Clayton Jr.","pos":"PG","stats_season":"2025-26","gp":69,"pts":7.8,"reb":2,"ast":4,"stl":0.6,"blk":0.3,"tov":1.7,"fg":38.4,"fg3":30.7,"ft":90.1,"salary":4190520},
            {"name":"Jerami Grant","pos":"SF","stats_season":"2025-26","gp":57,"pts":18.6,"reb":3.5,"ast":2.1,"stl":0.7,"blk":0.6,"tov":2.1,"fg":45.3,"fg3":38.9,"ft":81.4,"salary":34206898},
            {"name":"Javon Small","pos":"PG","stats_season":"2025-26","gp":41,"pts":9.7,"reb":3.1,"ast":3.7,"stl":0.8,"blk":0.2,"tov":1.4,"fg":46.5,"fg3":42.3,"ft":82.9,"salary":None},
            {"name":"Micah Peavy","pos":"SF","stats_season":"2025-26","gp":61,"pts":4.3,"reb":1.9,"ast":1,"stl":0.7,"blk":0.1,"tov":0.3,"fg":38.5,"fg3":25.9,"ft":75.9,"salary":2150917},
            {"name":"Olivier-Maxence Prosper","pos":"PF","stats_season":"2025-26","gp":53,"pts":10,"reb":3.5,"ast":1,"stl":0.8,"blk":0.2,"tov":0.9,"fg":54.9,"fg3":40.5,"ft":75.4,"salary":2497812},
            {"name":"Quinten Post","pos":"C","stats_season":"2025-26","gp":67,"pts":7.7,"reb":4,"ast":1.4,"stl":0.4,"blk":0.5,"tov":0.8,"fg":44,"fg3":33.6,"ft":79.1,"salary":8285714},
            {"name":"Taylor Hendricks","pos":"PF","stats_season":"2025-26","gp":59,"pts":7.4,"reb":3.7,"ast":0.9,"stl":0.8,"blk":0.5,"tov":0.8,"fg":45.9,"fg3":34.2,"ft":68.1,"salary":7805900},
            {"name":"Jordan Hawkins","pos":"SG","stats_season":"2025-26","gp":51,"pts":5.1,"reb":1.7,"ast":0.8,"stl":0.3,"blk":0.2,"tov":0.7,"fg":36.6,"fg3":34.8,"ft":85.2,"salary":7021895},
            {"name":"Cam Spencer","pos":"SG","stats_season":"2025-26","gp":72,"pts":11.1,"reb":2.5,"ast":5.6,"stl":0.7,"blk":0.2,"tov":1.3,"fg":47.3,"fg3":44.9,"ft":94,"salary":2411090},
            {"name":"Kris Murray","pos":"PF","stats_season":"2025-26","gp":57,"pts":5.8,"reb":3.6,"ast":1.4,"stl":0.9,"blk":0.4,"tov":0.8,"fg":46.7,"fg3":27.9,"ft":68.4,"salary":5315004},
            {"name":"Isaiah Stewart","pos":"C","stats_season":"2025-26","gp":58,"pts":10,"reb":5,"ast":1.1,"stl":0.3,"blk":1.6,"tov":1.2,"fg":55,"fg3":33.3,"ft":75.6,"salary":15000000},
            {"name":"Karim Lopez","pos":"SF","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":3746760},
            {"name":"GG Jackson","pos":"PF","stats_season":"2025-26","gp":55,"pts":12.5,"reb":4.3,"ast":1.5,"stl":0.6,"blk":0.8,"tov":1.5,"fg":49.6,"fg3":33.2,"ft":74.2,"salary":2406205},
        ],
        "draft_picks": memphis_draft_picks
    },
    {
        "id": 29,
        "name": "New Orleans Pelicans",
        "conference": "Western",
        "division": "Southwest",
        "featured_star": "Zion Williamson",
        "headline_stat": "23.2 PPG, 5.9 RPG, 5.1 APG",
        "last_season_record": "26-56",
        "total_salary": 204110200,
        "tax_status": "Luxury Tax",
        "championships": 0,
        "championship_years": [],
        "logo": "https://cdn.nba.com/logos/nba/1610612740/primary/L/logo.svg",
        "description": "High-powered offense revolving around Zion Williamson, Dejounte Murray, and defensive specialist Herb Jones.",
        "starters_2026_27": [
            {"name":"Dejounte Murray","pos":"PG","stats_season":"2025-26","gp":14,"pts":16.7,"reb":5.4,"ast":6.4,"stl":1.6,"blk":0.2,"tov":3.4,"fg":48.4,"fg3":30.6,"ft":86.7,"salary":32785071},
            {"name":"Trey Murphy III","pos":"SG","stats_season":"2025-26","gp":66,"pts":21.5,"reb":5.7,"ast":3.8,"stl":1.5,"blk":0.4,"tov":1.8,"fg":47,"fg3":37.9,"ft":88.6,"salary":27000000},
            {"name":"Herb Jones","pos":"SF","stats_season":"2025-26","gp":56,"pts":8.9,"reb":3.4,"ast":2.8,"stl":1.6,"blk":0.5,"tov":1.3,"fg":38.3,"fg3":30.9,"ft":80.6,"salary":14898786},
            {"name":"Zion Williamson","pos":"PF","stats_season":"2025-26","gp":62,"pts":21,"reb":5.7,"ast":3.2,"stl":1,"blk":0.5,"tov":2,"fg":60,"fg3":25,"ft":71.6,"salary":42166510},
            {"name":"Derik Queen","pos":"C","stats_season":"2025-26","gp":81,"pts":11.7,"reb":7.1,"ast":3.7,"stl":1,"blk":0.9,"tov":2.3,"fg":47.3,"fg3":26.1,"ft":79.5,"salary":5416080},
        ],
        "bench_2026_27": [
            {"name":"Jeremiah Fears","pos":"PG","stats_season":"2025-26","gp":82,"pts":14.3,"reb":3.7,"ast":3.4,"stl":1.2,"blk":0.4,"tov":2.2,"fg":43.4,"fg3":33,"ft":78.9,"salary":7896240},
            {"name":"Jordan Poole","pos":"SG","stats_season":"2025-26","gp":39,"pts":13.4,"reb":2,"ast":3.1,"stl":0.6,"blk":0.4,"tov":1.8,"fg":37.2,"fg3":33.3,"ft":86,"salary":34044642},
            {"name":"Kobe Bufkin","pos":"SG","stats_season":"2025-26","gp":16,"pts":2.9,"reb":0.8,"ast":0.6,"stl":0.1,"blk":0.2,"tov":0.3,"fg":30,"fg3":19.2,"ft":91.7,"salary":2449421},
            {"name":"DeAndre Jordan","pos":"C","stats_season":"2025-26","gp":12,"pts":4.4,"reb":6.3,"ast":0.9,"stl":0.3,"blk":0.8,"tov":0.8,"fg":65.6,"fg3":0,"ft":64.7,"salary":3876529},
            {"name":"AJ Johnson","pos":"SG","stats_season":"2025-26","gp":48,"pts":3.3,"reb":1.1,"ast":1,"stl":0.2,"blk":0.1,"tov":0.6,"fg":32.4,"fg3":21.1,"ft":85,"salary":3237120},
            {"name":"Malik Dia","pos":"PF","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":None},
            {"name":"Trendon Watford","pos":"SF","stats_season":"2025-26","gp":53,"pts":6.5,"reb":3.3,"ast":2.5,"stl":0.3,"blk":0.4,"tov":1.2,"fg":51.5,"fg3":20,"ft":77.9,"salary":2449421},
            {"name":"Bennedict Mathurin","pos":"SF","stats_season":"2025-26","gp":54,"pts":17.6,"reb":5.4,"ast":2.4,"stl":0.8,"blk":0.2,"tov":2.2,"fg":43,"fg3":31.5,"ft":86.9,"salary":7804878},
            {"name":"Jaron Pierre Jr.","pos":"SG","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":None},
            {"name":"Bryce McGowens","pos":"SG","stats_season":"2025-26","gp":42,"pts":8.1,"reb":2.1,"ast":1.5,"stl":0.6,"blk":0.2,"tov":0.4,"fg":48.1,"fg3":40.9,"ft":77.9,"salary":2584539},
            {"name":"Karlo Matković","pos":"C","stats_season":"2025-26","gp":62,"pts":5.7,"reb":3.7,"ast":0.8,"stl":0.4,"blk":0.9,"tov":0.5,"fg":60.4,"fg3":42.2,"ft":73.2,"salary":2296271},
            {"name":"Yves Missi","pos":"C","stats_season":"2025-26","gp":66,"pts":5.7,"reb":5.8,"ast":1.3,"stl":0.3,"blk":1.5,"tov":0.8,"fg":54.4,"fg3":0,"ft":55.9,"salary":3512760},
            {"name":"Caleb Houstan","pos":"SF","stats_season":"2025-26","gp":18,"pts":2.3,"reb":0.6,"ast":0.2,"stl":0.1,"blk":0.1,"tov":0.2,"fg":53.8,"fg3":52.4,"ft":100,"salary":2625627},
            {"name":"Christian Koloko","pos":"C","stats_season":"2025-26","gp":27,"pts":2.7,"reb":3,"ast":0.7,"stl":0.5,"blk":0.9,"tov":0.6,"fg":41.9,"fg3":11.1,"ft":66.7,"salary":2625627},
            {"name":"Saddiq Bey","pos":"SF","stats_season":"2025-26","gp":72,"pts":17.7,"reb":5.6,"ast":2.5,"stl":0.9,"blk":0.1,"tov":0.9,"fg":45.1,"fg3":36.7,"ft":84.1,"salary":6440678},
        ],
        "draft_picks": new_orleans_draft_picks
    },
    {
        "id": 30,
        "name": "San Antonio Spurs",
        "conference": "Western",
        "division": "Southwest",
        "featured_star": "Victor Wembanyama",
        "headline_stat": "24.3 PPG, 11.0 RPG, 3.1 BPG",
        "last_season_record": "62-20",
        "total_salary": 182110209,
        "tax_status": "Over Cap",
        "championships": 5,
        "championship_years": [1999, 2003, 2005, 2007, 2014],
        "logo": "https://cdn.nba.com/logos/nba/1610612759/primary/L/logo.svg",
        "description": "Rapidly climbing Western powerhouse engineered around transcendent center Victor Wembanyama and Stephon Castle.",
        "starters_2026_27": [
            {"name":"De'Aaron Fox","pos":"PG","stats_season":"2025-26","gp":72,"pts":18.6,"reb":3.8,"ast":6.2,"stl":1.2,"blk":0.3,"tov":2.3,"fg":48.6,"fg3":33.2,"ft":76,"salary":49400000},
            {"name":"Stephon Castle","pos":"SG","stats_season":"2025-26","gp":68,"pts":16.7,"reb":5.3,"ast":7.4,"stl":1.1,"blk":0.3,"tov":3.2,"fg":47.1,"fg3":33.2,"ft":73.4,"salary":10000000},
            {"name":"Devin Vassell","pos":"SF","stats_season":"2025-26","gp":67,"pts":13.9,"reb":4,"ast":2.5,"stl":0.9,"blk":0.4,"tov":0.9,"fg":43.7,"fg3":38.4,"ft":81.5,"salary":27000000},
            {"name":"Julian Champagnie","pos":"PF","stats_season":"2025-26","gp":82,"pts":11.1,"reb":5.8,"ast":1.5,"stl":0.8,"blk":0.5,"tov":0.8,"fg":43.7,"fg3":38.1,"ft":84.4,"salary":15300000},
            {"name":"Victor Wembanyama","pos":"C","stats_season":"2025-26","gp":64,"pts":25,"reb":11.5,"ast":3.1,"stl":1,"blk":3.1,"tov":2.4,"fg":51.2,"fg3":34.9,"ft":82.7,"salary":16800000},
        ],
        "bench_2026_27": [
            {"name":"Jordan McLaughlin","pos":"PG","stats_season":"2025-26","gp":44,"pts":2,"reb":0.7,"ast":0.9,"stl":0.5,"blk":0,"tov":0.3,"fg":41.8,"fg3":42.5,"ft":85.7,"salary":2449421},
            {"name":"Dylan Harper","pos":"SG","stats_season":"2025-26","gp":69,"pts":11.8,"reb":3.4,"ast":3.9,"stl":0.8,"blk":0.3,"tov":1.4,"fg":50.5,"fg3":34.3,"ft":75.6,"salary":12900000},
            {"name":"Keldon Johnson","pos":"SF","stats_season":"2025-26","gp":82,"pts":13.2,"reb":5.4,"ast":1.4,"stl":0.6,"blk":0.1,"tov":0.9,"fg":51.9,"fg3":36.3,"ft":79.4,"salary":17500000},
            {"name":"Taelon Peter","pos":"SG","stats_season":"2025-26","gp":38,"pts":4.5,"reb":1.6,"ast":1.1,"stl":0.7,"blk":0.1,"tov":0.7,"fg":38,"fg3":32.8,"ft":62.5,"salary":2185116},
            {"name":"Luke Kornet","pos":"C","stats_season":"2025-26","gp":68,"pts":6.5,"reb":6.1,"ast":1.9,"stl":0.5,"blk":1,"tov":0.4,"fg":64.3,"fg3":0,"ft":82.5,"salary":10400000},
            {"name":"Tarris Reed Jr.","pos":"C","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":3000000},
            {"name":"Carter Bryant","pos":"SF","stats_season":"2025-26","gp":71,"pts":4.2,"reb":2.5,"ast":0.7,"stl":0.2,"blk":0.3,"tov":0.5,"fg":40.8,"fg3":33.5,"ft":71.4,"salary":5100000},
            {"name":"Jayden Quaintance","pos":"PF","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":3900000},
            {"name":"Tobias Harris","pos":"PF","stats_season":"2025-26","gp":63,"pts":13.3,"reb":5.1,"ast":2.5,"stl":0.9,"blk":0.4,"tov":1,"fg":46.9,"fg3":36.8,"ft":86.6,"salary":15000000},
            {"name":"David Jones Garcia","pos":"SG","stats_season":"2025-26","gp":11,"pts":2.9,"reb":1.2,"ast":1.6,"stl":0.5,"blk":0.1,"tov":0.5,"fg":52,"fg3":60,"ft":50,"salary":None},
            {"name":"Harrison Barnes","pos":"PF","stats_season":"2025-26","gp":77,"pts":9.9,"reb":2.8,"ast":1.9,"stl":0.6,"blk":0.2,"tov":0.8,"fg":45.6,"fg3":38.8,"ft":82.9,"salary":8000000},
            {"name":"Maliq Brown","pos":"PF","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":None},
            {"name":"Ja'Kobi Gillespie","pos":"PG","stats_season":"2025-26","gp":None,"pts":None,"reb":None,"ast":None,"stl":None,"blk":None,"tov":None,"fg":None,"fg3":None,"ft":None,"salary":None},
            {"name":"Emanuel Miller","pos":"F","stats_season":"2025-26","gp":5,"pts":3,"reb":0.6,"ast":0.8,"stl":0.4,"blk":0,"tov":0,"fg":46.2,"fg3":33.3,"ft":50,"salary":0},
        ],
        "draft_picks": san_antonio_draft_picks
    }
]

# ==============================================================================
# ON-BOOT VALIDATION ROUTINE
# ==============================================================================
validated_teams = [Team(**team).model_dump() for team in teams]
teams = validated_teams

payroll_contract_notes = {
    ("Atlanta Hawks", "Luguentz Dort"): (
        "2026-27 salary: $18,222,222 (Basketball-Reference)."
    ),
    ("Brooklyn Nets", "Moritz Wagner"): (
        "2-year, $18.45M contract: $9M in 2026-27; $9.45M in 2027-28 (mutual option)."
    ),
    ("Detroit Pistons", "Jalen Duren"): (
        "2026-27 base salary: $34,482,759. His five-year, $200M extension averages $40M per year; actual future-year salaries vary."
    ),
}

for team in teams:
    for player in team["starters_2026_27"] + team["bench_2026_27"]:
        contract_note = payroll_contract_notes.get((team["name"], player["name"]))
        if contract_note:
            player["contract_note"] = contract_note
            if player["name"] == "Moritz Wagner":
                player["contract_label"] = "2027-28 mutual option"

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

def supabase_rest_request(path: str, method: str = "GET", payload: Optional[dict] = None):
    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not supabase_url or not service_key:
        raise HTTPException(
            status_code=503,
            detail="Community challenges are not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the API deployment."
        )

    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = Request(
        f"{supabase_url}/rest/v1/{path.lstrip('/')}",
        data=body,
        method=method,
        headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }
    )
    try:
        with urlopen(request, timeout=10) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        upstream_message = error.read().decode("utf-8", errors="replace")[:500]
        logger.error("Supabase community challenge request failed (%s): %s", error.code, upstream_message)
        raise HTTPException(status_code=502, detail="Community challenge storage rejected the request.") from error
    except URLError as error:
        logger.error("Supabase community challenge storage is unreachable: %s", error.reason)
        raise HTTPException(status_code=503, detail="Community challenge storage is unreachable.") from error
    except json.JSONDecodeError as error:
        logger.error("Supabase returned invalid JSON for community challenge request.")
        raise HTTPException(status_code=502, detail="Community challenge storage returned an invalid response.") from error


def supabase_cache_available() -> bool:
    return bool(
        os.environ.get("SUPABASE_URL", "").strip()
        and os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    )


def _supabase_team_abbreviation(team_name: str) -> str:
    abbreviation_map = {
        "Atlanta Hawks": "ATL",
        "Boston Celtics": "BOS",
        "Brooklyn Nets": "BKN",
        "Charlotte Hornets": "CHA",
        "Chicago Bulls": "CHI",
        "Cleveland Cavaliers": "CLE",
        "Dallas Mavericks": "DAL",
        "Denver Nuggets": "DEN",
        "Detroit Pistons": "DET",
        "Golden State Warriors": "GSW",
        "Houston Rockets": "HOU",
        "Indiana Pacers": "IND",
        "Los Angeles Clippers": "LAC",
        "Los Angeles Lakers": "LAL",
        "Memphis Grizzlies": "MEM",
        "Miami Heat": "MIA",
        "Milwaukee Bucks": "MIL",
        "Minnesota Timberwolves": "MIN",
        "New Orleans Pelicans": "NOP",
        "New York Knicks": "NYK",
        "Oklahoma City Thunder": "OKC",
        "Orlando Magic": "ORL",
        "Philadelphia 76ers": "PHI",
        "Phoenix Suns": "PHX",
        "Portland Trail Blazers": "POR",
        "Sacramento Kings": "SAC",
        "San Antonio Spurs": "SAS",
        "Toronto Raptors": "TOR",
        "Utah Jazz": "UTA",
        "Washington Wizards": "WAS",
    }
    return abbreviation_map.get(team_name, team_name[:3].upper())


def sync_supabase_nba_catalog() -> None:
    if not supabase_cache_available():
        return

    try:
        team_rows = []
        for team in teams:
            team_rows.append({
                "id": int(team["id"]),
                "name": team["name"],
                "abbreviation": _supabase_team_abbreviation(team["name"]),
                "conference": team["conference"],
                "division": team["division"],
                "city": team["name"].split(" ", 1)[0] if " " in team["name"] else team["name"],
                "is_active": True,
                "metadata": {
                    "featured_star": team.get("featured_star"),
                    "logo": team.get("logo"),
                    "tax_status": team.get("tax_status"),
                    "last_season_record": team.get("last_season_record"),
                    "championship_years": team.get("championship_years", []),
                },
            })
        if team_rows:
            supabase_rest_request("nba_teams?on_conflict=id", method="POST", payload=team_rows)

        player_rows = []
        for team in teams:
            for player in team.get("starters_2026_27", []) + team.get("bench_2026_27", []):
                player_rows.append({
                    "id": f"{team['id']}:{normalize_player_name(player['name'])}",
                    "team_id": int(team["id"]),
                    "name": player["name"],
                    "full_name": player["name"],
                    "position": player.get("pos", ""),
                    "jersey_number": "",
                    "metadata": {
                        "team_name": team["name"],
                        "stats_season": player.get("stats_season"),
                        "salary": player.get("salary"),
                        "contract_type": player.get("contract_type"),
                    },
                })
        if player_rows:
            supabase_rest_request("nba_players?on_conflict=id", method="POST", payload=player_rows)
    except Exception as exc:  # pragma: no cover - defensive sync for optional Supabase deployment
        logger.warning("Supabase NBA catalog sync failed: %s", exc)


def supabase_cache_read(resource_type: str, cache_key: str) -> Optional[dict]:
    if not supabase_cache_available():
        return None
    try:
        encoded_type = quote(resource_type, safe="")
        encoded_key = quote(str(cache_key), safe="")
        rows = supabase_rest_request(
            f"api_cache?select=id,payload,expires_at&resource_type=eq.{encoded_type}&cache_key=eq.{encoded_key}"
        )
        if not isinstance(rows, list) or not rows:
            return None
        record = rows[0]
        expires_at = record.get("expires_at")
        if expires_at and isinstance(expires_at, str):
            try:
                expires_datetime = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            except ValueError:
                expires_datetime = None
            if expires_datetime is not None and expires_datetime <= datetime.now(timezone.utc):
                return None
        payload = record.get("payload")
        return payload if isinstance(payload, dict) else {"value": payload}
    except HTTPException:
        return None
    except Exception as exc:  # pragma: no cover - external service failure should be non-blocking
        logger.warning("Supabase API cache read failed for %s/%s: %s", resource_type, cache_key, exc)
        return None


def supabase_cache_write(resource_type: str, cache_key: str, payload: dict, ttl_seconds: int = 1800) -> bool:
    if not supabase_cache_available():
        return False
    try:
        encoded_type = quote(resource_type, safe="")
        encoded_key = quote(str(cache_key), safe="")
        existing = supabase_rest_request(
            f"api_cache?select=id&resource_type=eq.{encoded_type}&cache_key=eq.{encoded_key}"
        )
        expires_at = (datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)).isoformat().replace("+00:00", "Z")
        record = {
            "resource_type": resource_type,
            "cache_key": cache_key,
            "payload": payload,
            "expires_at": expires_at,
        }
        if isinstance(existing, list) and existing:
            record_id = existing[0].get("id")
            if record_id:
                supabase_rest_request(
                    f"api_cache?id=eq.{record_id}",
                    method="PATCH",
                    payload=record,
                )
                return True
        supabase_rest_request("api_cache", method="POST", payload=record)
        return True
    except HTTPException:
        return False
    except Exception as exc:  # pragma: no cover - external service failure should be non-blocking
        logger.warning("Supabase API cache write failed for %s/%s: %s", resource_type, cache_key, exc)
        return False


NBA_STATS_CACHE_TTL_SECONDS = 900
NBA_STATS_CACHE: dict = {}
NBA_STATS_LOCK = Lock()
NBA_ROSTER_CACHE_TTL_SECONDS = 21600
NBA_ROSTER_CACHE: dict = {}
NBA_ROSTER_LOCK = Lock()
NBA_ROSTER_TEAM_OVERRIDES = {"luguentz dort": 12}
NBA_ROSTER_SALARY_OVERRIDES = {"luguentz dort": 18_222_222}
NBA_SCHEDULE_CACHE_TTL_SECONDS = 21600
NBA_SCHEDULE_CACHE: dict = {}
NBA_SCHEDULE_LOCK = Lock()
NBA_SCOREBOARD_CACHE_TTL_SECONDS = 45
NBA_SCOREBOARD_CACHE: dict = {}
NBA_SCOREBOARD_LOCK = Lock()
NBA_TRANSACTIONS_CACHE_TTL_SECONDS = 300
NBA_TRANSACTIONS_CACHE: dict = {}
NBA_TRANSACTIONS_LOCK = Lock()
NBA_STANDINGS_CACHE_TTL_SECONDS = 300
NBA_STANDINGS_CACHE: dict = {}
NBA_STANDINGS_LOCK = Lock()
NBA_ODDS_CACHE_TTL_SECONDS = 300
NBA_ODDS_CACHE: dict = {}
NBA_ODDS_LOCK = Lock()
NBA_BOX_SCORE_CACHE_TTL_SECONDS = 30
NBA_BOX_SCORE_CACHE: dict = {}
NBA_BOX_SCORE_LOCK = Lock()
NBA_PLAY_BY_PLAY_CACHE: dict = {}
NBA_PLAY_BY_PLAY_LOCK = Lock()
NBA_TEAM_JERSEY_CACHE_TTL_SECONDS = 21600
NBA_TEAM_JERSEY_CACHE: dict = {}
NBA_TEAM_JERSEY_LOCK = Lock()
ESPN_TEAM_JERSEY_CACHE: dict = {}
ESPN_TEAM_JERSEY_LOCK = Lock()


def current_nba_season(now: Optional[datetime] = None) -> str:
    current = now or datetime.now(timezone.utc)
    season_start = current.year if current.month >= 7 else current.year - 1
    return f"{season_start}-{str(season_start + 1)[-2:]}"


def _validated_nba_season(season: Optional[str]) -> str:
    selected = season or current_nba_season()
    if not re.fullmatch(r"\d{4}-\d{2}", selected):
        raise HTTPException(status_code=422, detail="Season must use the YYYY-YY format.")
    start_year = int(selected[:4])
    if start_year < 1999 or selected != f"{start_year}-{str(start_year + 1)[-2:]}":
        raise HTTPException(status_code=422, detail="Season must be a valid NBA season from 1999 onward.")
    if start_year > int(current_nba_season()[:4]):
        raise HTTPException(status_code=422, detail="Future NBA seasons are not available.")
    return selected


def _nba_season_from_game_id(game_id: str) -> str:
    if not re.fullmatch(r"\d{10}", game_id):
        raise HTTPException(status_code=422, detail="Game ID must be a 10-digit NBA game ID.")
    season_start = 2000 + int(game_id[3:5])
    return f"{season_start}-{str(season_start + 1)[-2:]}"


def normalize_player_name(name: str) -> str:
    return "".join(
        character
        for character in unicodedata.normalize("NFKD", name).casefold()
        if character.isalnum()
    )


def fetch_current_nba_player_stats() -> dict:
    with NBA_STATS_LOCK:
        return _fetch_current_nba_player_stats()


def fetch_current_nba_rosters() -> dict:
    with NBA_ROSTER_LOCK:
        return _fetch_current_nba_rosters()


def _request_nba_json(url: str, timeout: float = 12) -> dict:
    headers = {
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/131.0.0.0 Safari/537.36"
        ),
    }
    if "nba.com" in url:
        headers.update({
            "Origin": "https://www.nba.com",
            "Referer": "https://www.nba.com/schedule",
        })
    if "stats.nba.com" in url:
        headers.update({
            "x-nba-stats-origin": "stats",
            "x-nba-stats-token": "true",
        })
    request = Request(
        url,
        headers=headers,
    )
    with urlopen(request, timeout=timeout) as response:
        payload = json.loads(response.read().decode("utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("NBA returned an unexpected JSON response.")
    return payload


def _value_by_key(data: dict, *names: str):
    if not isinstance(data, dict):
        return None
    normalized = {str(key).casefold(): value for key, value in data.items()}
    for name in names:
        if name.casefold() in normalized:
            return normalized[name.casefold()]
    return None


def _canonical_nba_tricode(value: object) -> str:
    tricode = str(value or "").strip().upper()
    aliases = {
        "BRK": "BKN",
        "NJ": "BKN",
        "NJN": "BKN",
        "GS": "GSW",
        "NO": "NOP",
        "NOH": "NOP",
        "NOK": "NOP",
        "NY": "NYK",
        "PHO": "PHX",
        "SA": "SAS",
        "SEA": "OKC",
        "UTAH": "UTA",
        "VAN": "MEM",
        "WSH": "WAS",
    }
    return aliases.get(tricode, tricode)


def _normalize_espn_scoreboard(payload: dict) -> list[dict]:
    events = payload.get("events")
    if not isinstance(events, list):
        raise ValueError("ESPN scoreboard response is missing events.")

    games = []
    status_codes = {"pre": 1, "in": 2, "post": 3}
    for event in events:
        if not isinstance(event, dict):
            continue
        competitions = event.get("competitions")
        if not isinstance(competitions, list) or not competitions:
            continue
        competition = competitions[0]
        if not isinstance(competition, dict):
            continue
        competitors = competition.get("competitors")
        if not isinstance(competitors, list):
            continue
        teams = {}
        for competitor in competitors:
            if not isinstance(competitor, dict):
                continue
            side = str(competitor.get("homeAway") or "").casefold()
            team = competitor.get("team")
            if side in ("home", "away") and isinstance(team, dict):
                teams[side] = {
                    "teamTricode": _canonical_nba_tricode(team.get("abbreviation")),
                    "score": competitor.get("score"),
                }
        if "home" not in teams or "away" not in teams:
            continue

        status = event.get("status")
        if not isinstance(status, dict):
            status = competition.get("status")
        if not isinstance(status, dict):
            status = {}
        status_type = status.get("type")
        if not isinstance(status_type, dict):
            status_type = {}
        state = str(status_type.get("state") or "").casefold()
        if state not in status_codes and status_type.get("completed") is True:
            state = "post"
        status_code = status_codes.get(state)
        status_text = (
            "Scheduled" if status_code == 1
            else status_type.get("shortDetail")
            or status_type.get("detail")
            or ("Final" if status_code == 3 else "In Progress")
        )
        event_id = str(event.get("id") or "")
        games.append({
            "gameId": f"espn:{event_id}" if event_id else "",
            "date": str(event.get("date") or ""),
            "gameStatus": status_code,
            "gameStatusText": str(status_text),
            "period": status.get("period"),
            "gameClock": status.get("displayClock"),
            "homeTeam": teams["home"],
            "awayTeam": teams["away"],
        })
    return games


def _as_schedule_date(value: object) -> str:
    text = str(value or "").strip()
    if not text:
        raise ValueError("NBA schedule game is missing its date.")
    if "T" in text:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date().isoformat()
    for date_format in ("%m/%d/%Y %H:%M:%S", "%m/%d/%Y", "%Y-%m-%d", "%a, %b %d, %Y"):
        try:
            return datetime.strptime(text, date_format).date().isoformat()
        except ValueError:
            continue
    raise ValueError(f"NBA schedule returned an unsupported game date: {text}.")


def _display_game_time(game: dict) -> str:
    for field in ("gameEt", "gameTimeEst", "gameTimeUTC"):
        value = _value_by_key(game, field)
        if not value:
            continue
        try:
            parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except ValueError:
            continue
        if field == "gameTimeUTC":
            parsed = parsed.astimezone(timezone.utc)
            time_label = f"{parsed.strftime('%I').lstrip('0')}:{parsed.strftime('%M %p')} UTC"
            return time_label
        return f"{parsed.strftime('%I').lstrip('0')}:{parsed.strftime('%M %p')} ET"
    return "Time TBD"


def _normalize_nba_schedule(payload: dict, season: str) -> list:
    league_schedule = payload.get("leagueSchedule") or payload.get("LeagueSchedule")
    if not isinstance(league_schedule, dict):
        raise ValueError("NBA schedule response is missing leagueSchedule.")
    response_season = str(_value_by_key(league_schedule, "seasonYear") or "")
    if response_season and response_season != season:
        raise ValueError(
            f"NBA schedule returned season {response_season}; expected {season}."
        )
    game_dates = _value_by_key(league_schedule, "gameDates")
    if not isinstance(game_dates, list):
        raise ValueError("NBA schedule response is missing gameDates.")

    nba_team_names = {}
    nba_team_logos = {}
    for team in teams:
        logo_parts = team.get("logo", "").split("/")
        try:
            nba_team_id = int(logo_parts[logo_parts.index("nba") + 1])
        except (ValueError, IndexError):
            continue
        nba_team_names[nba_team_id] = team["name"]
        nba_team_logos[nba_team_id] = team["logo"]

    games = []
    for game_date in game_dates:
        if not isinstance(game_date, dict):
            continue
        date_label = _as_schedule_date(_value_by_key(game_date, "gameDate"))
        date_games = _value_by_key(game_date, "games")
        if not isinstance(date_games, list):
            continue
        for game in date_games:
            if not isinstance(game, dict):
                continue
            home = _value_by_key(game, "homeTeam")
            away = _value_by_key(game, "awayTeam")
            if not isinstance(home, dict) or not isinstance(away, dict):
                continue
            home_id = _value_by_key(home, "teamId")
            away_id = _value_by_key(away, "teamId")
            try:
                home_id, away_id = int(home_id), int(away_id)
            except (TypeError, ValueError):
                continue
            game_id = str(_value_by_key(game, "gameId") or "").strip()
            if not game_id:
                continue

            game_label = str(_value_by_key(game, "gameLabel", "gameSubtype") or "").strip()
            game_id_prefix = game_id[:3]
            if not game_label:
                game_label = "Preseason" if game_id_prefix == "001" else "Regular Season"
            venue = str(_value_by_key(game, "arenaName") or "Venue TBD").strip()
            city = str(_value_by_key(game, "arenaCity") or "").strip()
            if city and city.casefold() not in venue.casefold():
                venue = f"{venue} · {city}"

            status_code = _value_by_key(game, "gameStatus")
            status_text = str(_value_by_key(game, "gameStatusText") or "").strip()
            try:
                status_code_number = int(status_code) if status_code is not None else None
            except (TypeError, ValueError):
                status_code_number = None
            if status_code_number == 1:
                status_text = "Scheduled"
            if not status_text:
                status_text = "Final" if status_code_number == 3 else "In Progress"
            games.append({
                "id": game_id,
                "date": _as_schedule_date(
                    _value_by_key(game, "gameDateEst", "gameDate") or date_label
                ),
                "time": _display_game_time(game),
                "stage": game_label,
                "venue": venue,
                "status": status_text,
                "status_code": status_code,
                "period": _value_by_key(game, "period"),
                "clock": _value_by_key(game, "gameClock"),
                "home": nba_team_names.get(home_id, str(_value_by_key(home, "teamName") or "NBA team")),
                "home_tricode": str(_value_by_key(home, "teamTricode") or ""),
                "home_logo": nba_team_logos.get(home_id, ""),
                "home_score": _value_by_key(home, "score"),
                "away": nba_team_names.get(away_id, str(_value_by_key(away, "teamName") or "NBA team")),
                "away_tricode": str(_value_by_key(away, "teamTricode") or ""),
                "away_logo": nba_team_logos.get(away_id, ""),
                "away_score": _value_by_key(away, "score"),
            })

    unique_games = {game["id"]: game for game in games}
    normalized_games = sorted(unique_games.values(), key=lambda game: (game["date"], game["time"], game["id"]))
    if len(normalized_games) < 1230:
        raise ValueError(f"NBA schedule was incomplete ({len(normalized_games)} games returned).")
    return normalized_games


def _fetch_nba_schedule(season: Optional[str] = None) -> dict:
    now = time.monotonic()
    season = _validated_nba_season(season)
    cached = NBA_SCHEDULE_CACHE.get(season)
    if cached and cached["expires_at"] > now:
        return cached["snapshot"]

    try:
        season_file_version = int(season[:4]) % 100
        payload = _request_nba_json(
            f"https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_{season_file_version}.json"
        )
        games = _normalize_nba_schedule(payload, season)
        snapshot = {
            "status": "fresh",
            "source": "NBA.com season schedule",
            "season": season,
            "last_updated": datetime.now(timezone.utc).isoformat(),
            "message": "",
            "games": games,
        }
        NBA_SCHEDULE_CACHE[season] = {
            "expires_at": now + NBA_SCHEDULE_CACHE_TTL_SECONDS,
            "snapshot": snapshot,
        }
        return snapshot
    except (HTTPError, URLError, TimeoutError, OSError, ValueError, json.JSONDecodeError) as error:
        logger.warning("NBA schedule refresh failed for %s: %s", season, error)
        previous = cached["snapshot"] if cached else None
        if previous and previous.get("games"):
            snapshot = {
                **previous,
                "status": "stale",
                "message": (
                    f"NBA.com schedule refresh failed ({type(error).__name__}: {error}); "
                    "showing the last complete schedule."
                ),
            }
        else:
            fallback_path = (
                Path(__file__).resolve().parent
                / "data"
                / f"nba_schedule_{season}.json"
            )
            try:
                fallback = json.loads(fallback_path.read_text(encoding="utf-8"))
                fallback_games = fallback.get("games")
                if fallback.get("season") != season or not isinstance(fallback_games, list):
                    raise ValueError("Bundled NBA schedule has an invalid season or game list.")
                if len(fallback_games) < 1230:
                    raise ValueError(
                        f"Bundled NBA schedule is incomplete ({len(fallback_games)} games)."
                    )
                snapshot = {
                    "status": "stale",
                    "source": "NBA.com season schedule (bundled fallback)",
                    "season": season,
                    "last_updated": datetime.fromtimestamp(
                        fallback_path.stat().st_mtime,
                        timezone.utc,
                    ).isoformat(),
                    "message": (
                        "NBA.com blocked the live schedule refresh; showing the bundled "
                        f"full-season schedule instead ({type(error).__name__}: {error})."
                    ),
                    "games": fallback_games,
                }
            except (OSError, ValueError, json.JSONDecodeError) as fallback_error:
                logger.error("Bundled NBA schedule could not be loaded: %s", fallback_error)
                snapshot = {
                    "status": "unavailable",
                    "source": "NBA.com season schedule",
                    "season": season,
                    "last_updated": None,
                    "message": (
                        f"The full NBA schedule could not be loaded from NBA.com "
                        f"({type(error).__name__}: {error}), and the bundled fallback "
                        f"is unavailable ({type(fallback_error).__name__}: {fallback_error})."
                    ),
                    "games": [],
                }
        NBA_SCHEDULE_CACHE[season] = {
            "expires_at": now + 900,
            "snapshot": snapshot,
        }
        return snapshot


def _fetch_nba_scoreboard() -> dict:
    now = time.monotonic()
    cached = NBA_SCOREBOARD_CACHE.get("today")
    if cached and cached["expires_at"] > now:
        return cached["snapshot"]

    try:
        payload = _request_nba_json(
            "https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json"
        )
        scoreboard = payload.get("scoreboard")
        games = _value_by_key(scoreboard, "games") if isinstance(scoreboard, dict) else None
        if not isinstance(games, list):
            raise ValueError("NBA daily scoreboard response is missing games.")
        snapshot = {
            "status": "fresh",
            "source": "NBA.com live scoreboard",
            "last_updated": _value_by_key(payload.get("meta", {}), "time")
            or datetime.now(timezone.utc).isoformat(),
            "games": games,
        }
    except (HTTPError, URLError, TimeoutError, OSError, ValueError, json.JSONDecodeError) as error:
        logger.warning("NBA scoreboard refresh failed; trying ESPN fallback: %s", error)
        try:
            payload = _request_nba_json(
                "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard"
            )
            games = _normalize_espn_scoreboard(payload)
            snapshot = {
                "status": "fresh",
                "source": "ESPN scoreboard fallback",
                "last_updated": datetime.now(timezone.utc).isoformat(),
                "games": games,
                "message": "Live scores are being provided by ESPN because NBA.com is unavailable.",
            }
        except (HTTPError, URLError, TimeoutError, OSError, ValueError, json.JSONDecodeError) as fallback_error:
            logger.warning("ESPN scoreboard fallback failed: %s", fallback_error)
            previous = cached["snapshot"] if cached else None
            if previous and previous.get("games"):
                snapshot = {
                    **previous,
                    "status": "stale",
                    "message": (
                        f"NBA scoreboard refresh failed ({type(error).__name__}: {error}); "
                        f"ESPN fallback failed ({type(fallback_error).__name__}: {fallback_error}); "
                        "showing the last successful score update."
                    ),
                }
            else:
                snapshot = {
                    "status": "unavailable",
                    "source": "NBA.com / ESPN live scoreboards",
                    "last_updated": None,
                    "message": (
                        f"NBA scoreboard is unavailable ({type(error).__name__}: {error}); "
                        f"ESPN fallback is also unavailable "
                        f"({type(fallback_error).__name__}: {fallback_error}). "
                        "The full schedule remains available."
                    ),
                    "games": [],
                }
    NBA_SCOREBOARD_CACHE["today"] = {
        "expires_at": now + NBA_SCOREBOARD_CACHE_TTL_SECONDS,
        "snapshot": snapshot,
    }
    return snapshot


def _fetch_espn_archive_date_range(
    season_type: int,
    start_date: str,
    end_date: str,
) -> list[dict]:
    date_range = f"{start_date}-{end_date}"
    query = urlencode({
        "dates": start_date if start_date == end_date else date_range,
        "limit": "100",
        "seasontype": str(season_type),
    })
    url = f"https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?{query}"
    last_error = None
    for attempt in range(2):
        try:
            return [_request_nba_json(url, 10)]
        except HTTPError as error:
            if error.code != 400 and not 500 <= error.code < 600:
                raise
            last_error = error
            if error.code == 400:
                break
        except (URLError, TimeoutError, OSError) as error:
            last_error = error
        if attempt == 0:
            logger.warning(
                "ESPN archive request failed for season type %s range %s (%s); retrying.",
                season_type,
                date_range,
                last_error,
            )

    if start_date == end_date:
        if isinstance(last_error, HTTPError) and last_error.code == 400:
            logger.warning(
                "ESPN rejected season type %s archive date %s; treating it as an empty date.",
                season_type,
                start_date,
            )
            return [{"events": []}]
        raise last_error

    range_start = datetime.strptime(start_date, "%Y%m%d")
    range_end = datetime.strptime(end_date, "%Y%m%d")
    midpoint = range_start + (range_end - range_start) // 2
    left_end = midpoint.strftime("%Y%m%d")
    right_start = (midpoint + timedelta(days=1)).strftime("%Y%m%d")
    logger.warning(
        "ESPN archive request failed for season type %s range %s (%s); splitting range.",
        season_type,
        date_range,
        last_error,
    )
    return (
        _fetch_espn_archive_date_range(season_type, start_date, left_end)
        + _fetch_espn_archive_date_range(season_type, right_start, end_date)
    )


def _fetch_espn_season_schedule(season: str) -> dict:
    now = time.monotonic()
    cached = NBA_SCHEDULE_CACHE.get(season)
    if cached and cached["expires_at"] > now:
        return cached["snapshot"]

    season_start = int(season[:4])
    season_end = season_start + 1

    def month_range(year: int, month: int) -> tuple[str, str]:
        following_month = (
            datetime(year + 1, 1, 1)
            if month == 12
            else datetime(year, month + 1, 1)
        )
        month_end = (following_month - timedelta(days=1)).day
        return f"{year}{month:02d}01", f"{year}{month:02d}{month_end:02d}"

    def split_into_week_ranges(start_date: str, end_date: str) -> list[tuple[str, str]]:
        range_start = datetime.strptime(start_date, "%Y%m%d")
        range_end = datetime.strptime(end_date, "%Y%m%d")
        date_ranges = []
        while range_start <= range_end:
            window_end = min(range_start + timedelta(days=6), range_end)
            date_ranges.append((
                range_start.strftime("%Y%m%d"),
                window_end.strftime("%Y%m%d"),
            ))
            range_start = window_end + timedelta(days=1)
        return date_ranges

    regular_months = [(season_start, month) for month in range(10, 13)]
    regular_months.extend((season_end, month) for month in range(1, 6))
    preseason_months = [(season_start, month) for month in range(9, 13)]
    playoff_months = [(season_end, month) for month in range(4, 8)]

    # The 2019-20 season resumed in July 2020 and its playoffs ended in October.
    if season_start == 2019:
        regular_months.extend((season_end, month) for month in (7, 8))
        playoff_months.extend((season_end, month) for month in range(8, 11))

    ranges_by_type = {
        1: [
            window
            for year, month in preseason_months
            for window in split_into_week_ranges(*month_range(year, month))
        ],
        2: [
            window
            for year, month in regular_months
            for window in split_into_week_ranges(*month_range(year, month))
        ],
        3: [
            window
            for year, month in playoff_months
            for window in split_into_week_ranges(*month_range(year, month))
        ],
    }
    event_records = {}

    try:
        archive_requests = []
        for season_type, ranges in ranges_by_type.items():
            for start_date, end_date in ranges:
                archive_requests.append((season_type, start_date, end_date))

        def add_archive_events(payload: dict, season_type: int) -> None:
            events = payload.get("events")
            if not isinstance(events, list):
                raise ValueError("ESPN archive scoreboard response is missing events.")
            for event in events:
                if isinstance(event, dict) and event.get("id"):
                    event_type = season_type
                    season_data = event.get("season")
                    if isinstance(season_data, dict):
                        try:
                            reported_type = int(season_data.get("type"))
                        except (TypeError, ValueError):
                            reported_type = season_type
                        if reported_type in (1, 2, 3):
                            event_type = reported_type
                    event_records[str(event["id"])] = (event, event_type)

        with ThreadPoolExecutor(max_workers=8) as executor:
            futures = {
                executor.submit(
                    _fetch_espn_archive_date_range,
                    season_type,
                    start_date,
                    end_date,
                ): season_type
                for season_type, start_date, end_date in archive_requests
            }
            for future in as_completed(futures):
                season_type = futures[future]
                for payload in future.result():
                    add_archive_events(payload, season_type)

        normalized = []
        teams_by_name = {
            normalize_player_name(str(team.get("name") or "")): team
            for team in teams
            if team.get("name")
        }
        for event_id, (event, season_type) in event_records.items():
            competitions = event.get("competitions")
            if not isinstance(competitions, list) or not competitions or not isinstance(competitions[0], dict):
                continue
            competition = competitions[0]
            competitors = competition.get("competitors")
            if not isinstance(competitors, list):
                continue
            sides = {
                str(competitor.get("homeAway") or "").casefold(): competitor
                for competitor in competitors
                if isinstance(competitor, dict)
            }
            home = sides.get("home", {})
            away = sides.get("away", {})
            home_data = home.get("team") if isinstance(home.get("team"), dict) else {}
            away_data = away.get("team") if isinstance(away.get("team"), dict) else {}
            home_tricode = _canonical_nba_tricode(home_data.get("abbreviation"))
            away_tricode = _canonical_nba_tricode(away_data.get("abbreviation"))
            if not home_tricode or not away_tricode:
                continue
            start = str(event.get("date") or competition.get("date") or "")
            if not start:
                continue
            try:
                utc_start = datetime.fromisoformat(start.replace("Z", "+00:00"))
                if utc_start.tzinfo is None:
                    utc_start = utc_start.replace(tzinfo=timezone.utc)
                utc_start = utc_start.astimezone(timezone.utc)
            except ValueError:
                continue
            competition_status = competition.get("status")
            if not isinstance(competition_status, dict):
                competition_status = {}
            status = competition_status.get("type")
            if not isinstance(status, dict):
                status = {}
            state = str(status.get("state") or "").casefold()
            status_code = 3 if state == "post" else 2 if state == "in" else 1
            stage = {1: "Preseason", 2: "Regular Season", 3: "Playoffs"}[season_type]
            if season_type == 3:
                notes = competition.get("notes")
                note_text = " ".join(
                    str(note.get(key) or "")
                    for note in notes
                    if isinstance(note, dict)
                    for key in ("headline", "shortLinkText", "text")
                ) if isinstance(notes, list) else ""
                event_text = " ".join(
                    str(event.get(key) or "")
                    for key in ("name", "shortName")
                )
                if re.search(r"play[\s-]?in", f"{note_text} {event_text}", re.IGNORECASE):
                    stage = "Play-In Tournament"
            home_name = str(home_data.get("displayName") or home_data.get("name") or "NBA team")
            away_name = str(away_data.get("displayName") or away_data.get("name") or "NBA team")
            home_team = teams_by_name.get(normalize_player_name(home_name), {})
            away_team = teams_by_name.get(normalize_player_name(away_name), {})
            venue = competition.get("venue")
            if not isinstance(venue, dict):
                venue = {}
            normalized.append({
                "id": f"espn:{event_id}",
                "date": utc_start.date().isoformat(),
                "time": f"{utc_start.strftime('%I').lstrip('0')}:{utc_start.strftime('%M %p')} UTC",
                "stage": stage,
                "venue": str(venue.get("fullName") or "Venue TBD"),
                "status": str(status.get("shortDetail") or status.get("description") or "Scheduled"),
                "status_code": status_code,
                "period": competition_status.get("period"),
                "clock": competition_status.get("displayClock"),
                "home": home_team.get("name") or home_name,
                "home_tricode": home_tricode,
                "home_logo": home_team.get("logo") or home_data.get("logo") or "",
                "home_score": home.get("score"),
                "away": away_team.get("name") or away_name,
                "away_tricode": away_tricode,
                "away_logo": away_team.get("logo") or away_data.get("logo") or "",
                "away_score": away.get("score"),
            })

        regular_games = sum(game["stage"] == "Regular Season" for game in normalized)
        if regular_games < 700:
            raise ValueError(f"ESPN returned an incomplete regular-season archive ({regular_games} games).")
        snapshot = {
            "status": "fresh",
            "source": "ESPN archived NBA schedule",
            "season": season,
            "last_updated": datetime.now(timezone.utc).isoformat(),
            "message": "",
            "regular_game_count": regular_games,
            "games": sorted(normalized, key=lambda game: (game["date"], game["time"], game["id"])),
        }
        NBA_SCHEDULE_CACHE[season] = {
            "expires_at": now + 86400,
            "snapshot": snapshot,
        }
        return snapshot
    except (HTTPError, URLError, TimeoutError, OSError, ValueError, json.JSONDecodeError) as error:
        logger.warning("ESPN archived schedule refresh failed for %s: %s", season, error)
        snapshot = {
            "status": "unavailable",
            "source": "ESPN archived NBA schedule",
            "season": season,
            "last_updated": None,
            "message": f"The {season} schedule could not be loaded from ESPN ({type(error).__name__}: {error}).",
            "games": [],
        }
        NBA_SCHEDULE_CACHE[season] = {
            "expires_at": now + 300,
            "snapshot": snapshot,
        }
        return snapshot


def fetch_current_nba_schedule(season: Optional[str] = None) -> dict:
    selected_season = _validated_nba_season(season)
    cache_key = f"schedule:{selected_season}"
    cached_snapshot = supabase_cache_read("schedule", cache_key)
    if cached_snapshot:
        return cached_snapshot
    if selected_season == current_nba_season():
        with NBA_SCHEDULE_LOCK:
            schedule = _fetch_nba_schedule(selected_season)
    else:
        with NBA_SCHEDULE_LOCK:
            schedule = _fetch_espn_season_schedule(selected_season)
    scoreboard = {"games": []}
    if selected_season == current_nba_season():
        with NBA_SCOREBOARD_LOCK:
            scoreboard = _fetch_nba_scoreboard()
    else:
        scoreboard = {
            "status": "archived",
            "source": schedule["source"],
            "last_updated": schedule["last_updated"],
            "message": "Historical game scores are included in the archived season schedule.",
            "games": [],
        }

    live_games = {}
    for game in scoreboard["games"]:
        if not isinstance(game, dict):
            continue
        game_id = str(_value_by_key(game, "gameId") or "").strip()
        if game_id:
            live_games[game_id] = game
    live_games_by_matchup = {}
    for game in scoreboard["games"]:
        if not isinstance(game, dict):
            continue
        home = _value_by_key(game, "homeTeam")
        away = _value_by_key(game, "awayTeam")
        home_tricode = str(_value_by_key(home, "teamTricode") or "").casefold()
        away_tricode = str(_value_by_key(away, "teamTricode") or "").casefold()
        if home_tricode and away_tricode:
            live_games_by_matchup.setdefault(f"{home_tricode}:{away_tricode}", []).append(game)
    games = []
    for scheduled_game in schedule["games"]:
        game = dict(scheduled_game)
        matchup = (
            f"{str(game.get('home_tricode') or '').casefold()}:"
            f"{str(game.get('away_tricode') or '').casefold()}"
        )
        candidates = live_games_by_matchup.get(matchup, [])
        live = live_games.get(game["id"])
        if not live and candidates:
            dated_candidates = []
            for candidate in candidates:
                candidate_date = str(_value_by_key(candidate, "date") or "")[:10]
                if not candidate_date:
                    continue
                try:
                    distance = abs(
                        (datetime.fromisoformat(game["date"]) - datetime.fromisoformat(candidate_date)).days
                    )
                except (TypeError, ValueError):
                    continue
                if distance <= 1:
                    dated_candidates.append((distance, candidate))
            if dated_candidates:
                live = min(dated_candidates, key=lambda item: item[0])[1]
            elif len(candidates) == 1 and not _value_by_key(candidates[0], "date"):
                live = candidates[0]
        if live:
            game_status = _value_by_key(live, "gameStatus")
            status_text = _value_by_key(live, "gameStatusText")
            home = _value_by_key(live, "homeTeam")
            away = _value_by_key(live, "awayTeam")
            if game_status is not None:
                try:
                    game["status_code"] = int(game_status)
                except (TypeError, ValueError):
                    game["status_code"] = game_status
            if game.get("status_code") == 1:
                game["status"] = "Scheduled"
            elif status_text:
                game["status"] = str(status_text)
            if home:
                game["home_score"] = _value_by_key(home, "score")
            if away:
                game["away_score"] = _value_by_key(away, "score")
            game["period"] = _value_by_key(live, "period")
            game["clock"] = _value_by_key(live, "gameClock")
        games.append(game)

    response = {
        "status": schedule["status"],
        "source": schedule["source"],
        "season": schedule["season"],
        "last_updated": schedule["last_updated"],
        "message": schedule["message"],
        "count": len(games),
        "regular_game_count": schedule.get("regular_game_count"),
        "games": games,
        "scores": {
            "status": scoreboard["status"],
            "source": scoreboard["source"],
            "last_updated": scoreboard["last_updated"],
            "message": scoreboard.get("message", ""),
        },
    }
    supabase_cache_write("schedule", cache_key, response, ttl_seconds=1800)
    return response


def fetch_current_nba_scores() -> dict:
    with NBA_SCOREBOARD_LOCK:
        scoreboard = _fetch_nba_scoreboard()
    normalized_games = []
    for game in scoreboard["games"]:
        if not isinstance(game, dict):
            continue
        home = _value_by_key(game, "homeTeam")
        away = _value_by_key(game, "awayTeam")
        if not isinstance(home, dict) or not isinstance(away, dict):
            continue
        status_code = _value_by_key(game, "gameStatus")
        try:
            status_code_number = int(status_code) if status_code is not None else None
        except (TypeError, ValueError):
            status_code_number = None
        status = str(_value_by_key(game, "gameStatusText") or "")
        if status_code_number == 1:
            status = "Scheduled"
        elif not status:
            status = "Final" if status_code_number == 3 else "In Progress"
        normalized_games.append({
            "id": str(_value_by_key(game, "gameId") or ""),
            "date": str(_value_by_key(game, "date") or ""),
            "status": status,
            "status_code": status_code_number,
            "period": _value_by_key(game, "period"),
            "clock": _value_by_key(game, "gameClock"),
            "home_score": _value_by_key(home, "score"),
            "away_score": _value_by_key(away, "score"),
            "home_tricode": str(_value_by_key(home, "teamTricode") or ""),
            "away_tricode": str(_value_by_key(away, "teamTricode") or ""),
        })
    return {
        "status": scoreboard["status"],
        "source": scoreboard["source"],
        "last_updated": scoreboard["last_updated"],
        "message": scoreboard.get("message", ""),
        "games": normalized_games,
    }


def _espn_standings_stats(entry: dict) -> dict[str, object]:
    raw_stats = entry.get("stats")
    if isinstance(raw_stats, dict):
        return raw_stats
    if not isinstance(raw_stats, list):
        return {}
    stats = {}
    for stat in raw_stats:
        if not isinstance(stat, dict):
            continue
        key = str(
            stat.get("name")
            or stat.get("abbreviation")
            or stat.get("type")
            or ""
        ).strip().casefold()
        if key:
            stats[key] = next(
                (
                    stat[field]
                    for field in ("displayValue", "value", "summary")
                    if stat.get(field) is not None and str(stat[field]).strip()
                ),
                None,
            )
    return stats


def _standing_value(stats: dict[str, object], *keys: str) -> object:
    for key in keys:
        value = stats.get(key.casefold())
        if value is not None and str(value).strip():
            return value
    return None


def _historical_standing_brand(team_name: str, season: str) -> dict[str, str | bool]:
    start_year = int(season[:4])
    historical_brands = {
        "Toronto Raptors": (
            1999,
            2014,
            "Toronto Raptors",
            "https://cdn.nba.com/logos/nba/1610612761/primary/L/logo.svg",
            False,
        ),
        "Brooklyn Nets": (
            1999,
            2011,
            "New Jersey Nets",
            "https://cdn.nba.com/logos/nba/1610612751/primary/L/logo.svg",
            False,
        ),
        "Oklahoma City Thunder": (
            1999,
            2007,
            "Seattle SuperSonics",
            "https://upload.wikimedia.org/wikipedia/en/a/a4/Seattle_SuperSonics_logo.svg",
            False,
        ),
        "Memphis Grizzlies": (
            1999,
            2000,
            "Vancouver Grizzlies",
            "https://upload.wikimedia.org/wikipedia/en/1/1e/Vancouver_Grizzlies_logo.svg",
            False,
        ),
        "New Orleans Pelicans": (
            2002,
            2012,
            "New Orleans Hornets",
            "https://upload.wikimedia.org/wikipedia/en/2/2f/NOKC_Hornets_logo.gif",
            False,
        ),
    }
    brand = historical_brands.get(team_name)
    if brand is None:
        return {}
    first_year, last_year, display_name, logo, wordmark = brand
    if not first_year <= start_year <= last_year:
        return {}
    if team_name == "New Orleans Pelicans" and 2005 <= start_year <= 2006:
        display_name = "New Orleans/Oklahoma City Hornets"
    return {
        "team": display_name,
        "logo": logo,
        "historical_logo": True,
        "historical_logo_wordmark": wordmark,
    }


def _fetch_espn_standings_page(
    season: str, season_type: Literal["preseason", "regular"]
) -> dict:
    season_end_year = int(season[:4]) + 1
    espn_season_type = 1 if season_type == "preseason" else 2
    url = (
        "https://www.espn.ph/nba/table/_/"
        f"season/{season_end_year}/seasontype/{espn_season_type}"
    )
    request = Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0",
        },
    )
    with urlopen(request, timeout=8) as response:
        html = response.read().decode("utf-8")

    marker = '"groups":{"headers":'
    marker_index = html.find(marker)
    if marker_index < 0:
        raise ValueError("ESPN Philippines standings page did not include its standings data.")
    groups_start = marker_index + len('"groups":')
    try:
        groups_data, _ = json.JSONDecoder().raw_decode(html, groups_start)
    except json.JSONDecodeError as error:
        raise ValueError("ESPN Philippines standings data was not valid JSON.") from error

    headers = groups_data.get("headers")
    groups = groups_data.get("groups")
    if not isinstance(headers, dict) or not isinstance(groups, list):
        raise ValueError("ESPN Philippines standings data is missing team tables.")

    children = []
    for group in groups:
        if not isinstance(group, dict):
            continue
        standings = group.get("standings")
        if not isinstance(standings, list):
            continue
        entries = []
        for row in standings:
            if not isinstance(row, dict):
                continue
            team_data = row.get("team")
            values = row.get("stats")
            if not isinstance(team_data, dict) or not isinstance(values, list):
                continue
            stats = {}
            for stat_name, header in headers.items():
                if not isinstance(header, dict):
                    continue
                try:
                    stat_index = int(header.get("i"))
                except (TypeError, ValueError):
                    continue
                if 0 <= stat_index < len(values):
                    stats[stat_name] = values[stat_index]
            entries.append({"team": team_data, "stats": stats})
        children.append({
            "name": str(group.get("name") or ""),
            "standings": {"entries": entries},
        })

    return {"children": children}


def _normalize_espn_standings(
    payload: dict, season: str, season_type: Literal["preseason", "regular"]
) -> list[dict]:
    team_by_name = {
        normalize_player_name(str(team.get("name") or "")): team
        for team in teams
    }
    team_aliases = {
        "charlottebobcats": "Charlotte Hornets",
        "losangelesclippers": "LA Clippers",
        "newjerseynets": "Brooklyn Nets",
        "neworleanshornets": "New Orleans Pelicans",
        "nooklahomacityhornets": "New Orleans Pelicans",
        "seattlesupersonics": "Oklahoma City Thunder",
        "vancouvergrizzlies": "Memphis Grizzlies",
    }
    entries = []

    def collect(node: object, conference_hint: str = "") -> None:
        if isinstance(node, list):
            for item in node:
                collect(item, conference_hint)
            return
        if not isinstance(node, dict):
            return
        node_name = str(
            node.get("name") or node.get("displayName") or node.get("shortName") or ""
        ).casefold()
        if "eastern" in node_name:
            conference_hint = "Eastern"
        elif "western" in node_name:
            conference_hint = "Western"
        node_standings = node.get("standings")
        if isinstance(node_standings, dict):
            raw_entries = node_standings.get("entries")
            if isinstance(raw_entries, list):
                for entry in raw_entries:
                    if isinstance(entry, dict):
                        entries.append((entry, conference_hint))
        raw_entries = node.get("entries")
        if isinstance(raw_entries, list):
            for entry in raw_entries:
                if isinstance(entry, dict):
                    entries.append((entry, conference_hint))
        collect(node.get("children"), conference_hint)

    collect(payload.get("children"))
    collect(payload.get("standings"))
    if not entries and isinstance(payload.get("entries"), list):
        entries.extend(
            (entry, "") for entry in payload["entries"] if isinstance(entry, dict)
        )

    normalized = []
    seen = set()
    for entry, conference_hint in entries:
        team_data = entry.get("team")
        if not isinstance(team_data, dict):
            continue
        team_name = str(
            team_data.get("displayName")
            or team_data.get("name")
            or team_data.get("shortDisplayName")
            or ""
        ).strip()
        normalized_team_name = normalize_player_name(team_name)
        configured_team = team_by_name.get(
            normalize_player_name(team_aliases.get(normalized_team_name, team_name))
        )
        if configured_team is None:
            abbreviation = str(
                team_data.get("abbreviation") or team_data.get("shortName") or ""
            ).strip().casefold()
            configured_team = next(
                (
                    team for team in teams
                    if abbreviation and (
                        str(team.get("abbreviation") or "").casefold() == abbreviation
                        or normalize_player_name(str(team.get("name") or ""))
                        == normalize_player_name(team_name)
                    )
                ),
                None,
            )
        if configured_team is None:
            continue
        team_key = normalize_player_name(configured_team["name"])
        if team_key in seen:
            continue
        seen.add(team_key)

        historical_brand = _historical_standing_brand(
            configured_team["name"], season
        )
        stats = _espn_standings_stats(entry)
        conference = configured_team.get("conference") or conference_hint
        conference = conference_hint or conference
        normalized.append({
            "team_id": configured_team["id"],
            "team": historical_brand.get("team", configured_team["name"]),
            "conference_rank": None,
            "abbreviation": _canonical_nba_tricode(
                team_data.get("abbreviation")
                or team_data.get("abbrev")
                or team_data.get("shortName")
            ),
            "conference": conference,
            "division": configured_team["division"],
            "division_champion": (
                str(stats.get("clinchery") or "").strip().casefold()
                in {"y", "yes", "true"}
                or str(stats.get("clincherz") or "").strip().casefold()
                in {"z", "yes", "true"}
            ),
            "logo": historical_brand.get("logo", configured_team["logo"]),
            "historical_logo": historical_brand.get("historical_logo", False),
            "historical_logo_wordmark": historical_brand.get(
                "historical_logo_wordmark", False
            ),
            "wins": _standing_value(stats, "wins", "w"),
            "losses": _standing_value(stats, "losses", "l"),
            "win_pct": _standing_value(stats, "winpercent", "win_pct", "pct", "winningpercentage"),
            "games_behind": _standing_value(stats, "gamesbehind", "games_behind", "gb"),
            "conference_record": _standing_value(stats, "vsconf", "conference", "conference_record"),
            "division_record": _standing_value(stats, "vsdiv", "vsdivision", "division", "division_record"),
            "home_record": _standing_value(stats, "home", "homerecord", "home_record"),
            "away_record": _standing_value(stats, "road", "away", "roadrecord", "away_record"),
            "last10": _standing_value(stats, "lasttengames", "last10", "lastten", "last_10"),
            "streak": _standing_value(stats, "streak", "streakstr", "streak_string"),
            "points_for": _standing_value(stats, "pointsfor", "avgpointsfor", "ppg", "points_per_game"),
            "points_against": _standing_value(stats, "pointsagainst", "avgpointsagainst", "oppppg", "opp_ppg"),
            "point_differential": _standing_value(stats, "pointdifferential", "differential", "diff"),
            "season": season,
            "season_type": season_type,
        })
    if not normalized:
        raise ValueError("ESPN standings response did not contain recognizable NBA teams.")

    def numeric_standing(value: object, fallback: float = float("-inf")) -> float:
        try:
            return float(str(value).replace(",", "").strip())
        except (TypeError, ValueError):
            return fallback

    def record_percentage(value: object) -> float:
        match = re.fullmatch(r"\s*(\d+)\s*-\s*(\d+)\s*", str(value or ""))
        if not match:
            return float("-inf")
        wins, losses = (int(part) for part in match.groups())
        return wins / (wins + losses) if wins + losses else float("-inf")

    for conference in ("Eastern", "Western"):
        conference_teams = [
            team for team in normalized if team["conference"] == conference
        ]
        # ESPN's table is grouped rather than conference-ranked; don't mistake
        # its concatenated row index for a seed or standings position.
        conference_teams.sort(
            key=lambda team: (
                numeric_standing(team["win_pct"]),
                numeric_standing(team["wins"]),
                record_percentage(team["conference_record"]),
                numeric_standing(team["point_differential"]),
            ),
            reverse=True,
        )
        for rank, team in enumerate(conference_teams, start=1):
            team["conference_rank"] = rank

    conference_order = {"Eastern": 0, "Western": 1}
    normalized.sort(
        key=lambda team: (
            conference_order.get(team["conference"], 2),
            team["conference_rank"] or float("inf"),
        )
    )
    return normalized


def fetch_current_nba_standings(
    season_type: Literal["preseason", "regular"] = "regular",
    season: Optional[str] = None,
) -> dict:
    selected_season = _validated_nba_season(season)
    cache_key = f"standings:{selected_season}:{season_type}"
    cached_snapshot = supabase_cache_read("standings", cache_key)
    if cached_snapshot:
        return cached_snapshot
    with NBA_STANDINGS_LOCK:
        now = time.monotonic()
        cache_key = f"{selected_season}:{season_type}"
        cached = NBA_STANDINGS_CACHE.get(cache_key)
        if cached and cached["expires_at"] > now:
            return cached["snapshot"]

        try:
            payload = _fetch_espn_standings_page(selected_season, season_type)
            standings = _normalize_espn_standings(payload, selected_season, season_type)
            expected_team_count = 29 if int(selected_season[:4]) < 2004 else 30
            if len(standings) != expected_team_count:
                raise ValueError(
                    f"ESPN standings returned {len(standings)} of "
                    f"{expected_team_count} NBA teams."
                )
            snapshot = {
                "status": "fresh",
                "source": "ESPN NBA standings",
                "season": selected_season,
                "season_type": season_type,
                "last_updated": datetime.now(timezone.utc).isoformat(),
                "message": "",
                "standings": standings,
            }
            NBA_STANDINGS_CACHE[cache_key] = {
                "expires_at": now + NBA_STANDINGS_CACHE_TTL_SECONDS,
                "snapshot": snapshot,
            }
            supabase_cache_write("standings", f"standings:{selected_season}:{season_type}", snapshot, ttl_seconds=900)
            return snapshot
        except (
            HTTPError,
            URLError,
            TimeoutError,
            OSError,
            ValueError,
            json.JSONDecodeError,
        ) as error:
            logger.warning("NBA standings refresh failed: %s", error)
            previous = cached["snapshot"] if cached else None
            if previous and previous.get("standings"):
                snapshot = {
                    **previous,
                    "status": "stale",
                    "message": "Standings refresh failed; showing the last successful update.",
                }
            else:
                snapshot = {
                    "status": "unavailable",
                    "source": "ESPN NBA standings",
                    "season": selected_season,
                    "season_type": season_type,
                    "last_updated": None,
                    "message": "Current NBA standings are temporarily unavailable.",
                    "standings": [],
                }
            NBA_STANDINGS_CACHE[cache_key] = {
                "expires_at": now + 60,
                "snapshot": snapshot,
            }
            supabase_cache_write("standings", f"standings:{selected_season}:{season_type}", snapshot, ttl_seconds=300)
            return snapshot


def _team_period_scores(team_data: dict) -> list:
    raw_periods = _value_by_key(
        team_data, "period_scores", "periods", "linescores"
    )
    if not isinstance(raw_periods, list):
        return []
    period_scores = []
    for period in raw_periods:
        if isinstance(period, dict):
            period_scores.append(
                _value_by_key(period, "score", "points", "value", "displayValue")
            )
        else:
            period_scores.append(period)
    return period_scores


def _jersey_number_string(*values: object) -> str:
    for value in values:
        if value is not None:
            jersey_number = str(value).strip()
            if jersey_number:
                return jersey_number
    return ""


def _normalize_box_score_team(team_data: dict, nba_team_names: dict, nba_team_logos: dict) -> dict:
    team_id = _value_by_key(team_data, "teamId")
    try:
        team_id = int(team_id)
    except (TypeError, ValueError):
        team_id = None
    players = _value_by_key(team_data, "players")
    if not isinstance(players, list):
        raise ValueError("NBA box score is missing a team player list.")
    normalized_players = []
    for player in players:
        if not isinstance(player, dict):
            continue
        stats = _value_by_key(player, "statistics")
        if not isinstance(stats, dict):
            stats = {}
        name = (
            _value_by_key(player, "name")
            or _value_by_key(player, "nameI")
            or "Unknown player"
        )
        normalized_players.append({
            "id": _value_by_key(player, "personId", "playerId"),
            "name": str(name),
            "headshot_url": str(_value_by_key(player, "headshot_url") or ""),
            "jersey_number": _jersey_number_string(
                _value_by_key(player, "jerseyNum", "jerseyNumber", "jersey")
            ),
            "position": str(_value_by_key(player, "position") or ""),
            "starter": bool(_value_by_key(player, "starter")),
            "played": bool(_value_by_key(player, "played")),
            "statistics": {
                "minutes": _value_by_key(stats, "minutes"),
                "points": _value_by_key(stats, "points"),
                "rebounds": _value_by_key(stats, "reboundsTotal", "rebounds"),
                "assists": _value_by_key(stats, "assists"),
                "steals": _value_by_key(stats, "steals"),
                "blocks": _value_by_key(stats, "blocks"),
                "turnovers": _value_by_key(stats, "turnovers"),
                "field_goals": _value_by_key(stats, "fieldGoalsMade"),
                "field_goals_attempted": _value_by_key(stats, "fieldGoalsAttempted"),
                "three_pointers": _value_by_key(stats, "threePointersMade"),
                "three_pointers_attempted": _value_by_key(stats, "threePointersAttempted"),
                "free_throws": _value_by_key(stats, "freeThrowsMade"),
                "free_throws_attempted": _value_by_key(stats, "freeThrowsAttempted"),
                "plus_minus": _value_by_key(stats, "plusMinusPoints", "plusMinus"),
                "fouls": _value_by_key(stats, "foulsPersonal", "fouls"),
            },
        })
    team_stat_fields = (
        "rebounds",
        "assists",
        "steals",
        "blocks",
        "turnovers",
        "field_goals",
        "field_goals_attempted",
        "three_pointers",
        "three_pointers_attempted",
        "free_throws",
        "free_throws_attempted",
        "fouls",
    )
    team_stats = {field: 0.0 for field in team_stat_fields}
    for player in normalized_players:
        for field in team_stat_fields:
            raw_value = player["statistics"].get(field)
            if raw_value is None:
                continue
            try:
                team_stats[field] += float(raw_value)
            except (TypeError, ValueError):
                continue
    period_scores = _team_period_scores(team_data)
    return {
        "id": team_id,
        "espn_team_id": str(_value_by_key(team_data, "espnTeamId") or ""),
        "name": nba_team_names.get(
            team_id,
            str(_value_by_key(team_data, "teamCity") or "") + " "
            + str(_value_by_key(team_data, "teamName") or "NBA team"),
        ).strip(),
        "abbreviation": str(_value_by_key(team_data, "teamTricode") or ""),
        "logo": nba_team_logos.get(team_id, ""),
        "score": _value_by_key(team_data, "score"),
        "team_stats": {
            field: int(value) if value.is_integer() else round(value, 1)
            for field, value in team_stats.items()
        },
        "period_scores": period_scores,
        "players": normalized_players,
    }


def _fetch_nba_team_jersey_numbers(team_id: int) -> dict[str, str]:
    season = current_nba_season()
    cache_key = (season, team_id)
    with NBA_TEAM_JERSEY_LOCK:
        now = time.monotonic()
        cached = NBA_TEAM_JERSEY_CACHE.get(cache_key)
        if cached and cached["expires_at"] > now:
            return cached["jersey_numbers"]

        parameters = urlencode({
            "LeagueID": "00",
            "Season": season,
            "TeamID": team_id,
        })
        try:
            payload = _request_nba_json(
                f"https://stats.nba.com/stats/commonteamroster?{parameters}"
            )
            result_sets = payload.get("resultSets") or payload.get("resultSet")
            if not isinstance(result_sets, list) or not result_sets:
                raise ValueError("NBA team roster response is missing result sets.")
            result_set = result_sets[0]
            if not isinstance(result_set, dict):
                raise ValueError("NBA team roster response has an invalid result set.")
            headers = result_set.get("headers")
            rows = result_set.get("rowSet")
            if not isinstance(headers, list) or not isinstance(rows, list):
                raise ValueError("NBA team roster response is missing player rows.")
            header_indexes = {
                str(header).casefold(): index
                for index, header in enumerate(headers)
            }
            player_id_index = header_indexes.get("player_id")
            jersey_index = header_indexes.get("num")
            player_name_index = header_indexes.get("player")
            if player_id_index is None or jersey_index is None:
                raise ValueError(
                    "NBA team roster response is missing player ID or jersey number columns."
                )
            jersey_numbers = {}
            jersey_numbers_by_name = {}
            for row in rows:
                if (
                    not isinstance(row, list)
                    or len(row) <= max(player_id_index, jersey_index)
                ):
                    continue
                player_id = str(row[player_id_index] or "").strip()
                jersey_number = _jersey_number_string(row[jersey_index])
                if player_id and jersey_number:
                    jersey_numbers[player_id] = jersey_number
                if player_name_index is not None and len(row) > player_name_index:
                    player_name = normalize_player_name(
                        str(row[player_name_index] or "")
                    )
                    if player_name and jersey_number:
                        jersey_numbers_by_name[player_name] = jersey_number
        except (
            HTTPError,
            URLError,
            TimeoutError,
            OSError,
            ValueError,
            json.JSONDecodeError,
        ) as error:
            logger.warning(
                "NBA jersey roster refresh failed for team %s: %s",
                team_id,
                error,
            )
            return {}

        NBA_TEAM_JERSEY_CACHE[cache_key] = {
            "expires_at": now + NBA_TEAM_JERSEY_CACHE_TTL_SECONDS,
            "jersey_numbers": jersey_numbers,
            "jersey_numbers_by_name": jersey_numbers_by_name,
        }
        return jersey_numbers


def _resolve_espn_team_id(
    game_id: str, event_id: str, team_abbreviation: str
) -> str:
    with NBA_SCHEDULE_LOCK:
        schedule = _fetch_nba_schedule()
    scheduled_game = next(
        (game for game in schedule["games"] if game["id"] == game_id),
        None,
    )
    if scheduled_game is None:
        raise ValueError("NBA schedule has no matching game for jersey lookup.")
    game_date = str(scheduled_game["date"]).replace("-", "")
    payload = _request_nba_json(
        f"https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates={game_date}"
    )
    events = payload.get("events")
    if not isinstance(events, list):
        raise ValueError("ESPN scoreboard response is missing events.")
    event = next(
        (
            item for item in events
            if isinstance(item, dict) and str(item.get("id") or "") == event_id
        ),
        None,
    )
    if event is None:
        raise ValueError("ESPN scoreboard has no matching event for jersey lookup.")
    competitions = event.get("competitions")
    competition = competitions[0] if isinstance(competitions, list) and competitions else {}
    competitors = competition.get("competitors", [])
    if not isinstance(competitors, list):
        raise ValueError("ESPN scoreboard event is missing competitors.")
    for competitor in competitors:
        if not isinstance(competitor, dict):
            continue
        team_data = competitor.get("team")
        if not isinstance(team_data, dict):
            continue
        if _canonical_nba_tricode(team_data.get("abbreviation")) == _canonical_nba_tricode(team_abbreviation):
            team_id = str(team_data.get("id") or "").strip()
            if team_id:
                return team_id
    raise ValueError("ESPN scoreboard could not match the team for jersey lookup.")


def _fetch_espn_team_jersey_numbers(
    team_id: str, nba_team_id: int | str, team_abbreviation: str
) -> tuple[dict[str, str], dict[str, str]]:
    cache_key = (
        current_nba_season(),
        nba_team_id if isinstance(nba_team_id, int) else f"espn:{nba_team_id}",
    )
    with ESPN_TEAM_JERSEY_LOCK:
        now = time.monotonic()
        cached = ESPN_TEAM_JERSEY_CACHE.get(cache_key)
        if cached and cached["expires_at"] > now:
            return cached["jersey_numbers"], cached["jersey_numbers_by_name"]
        payload = _request_nba_json(
            f"https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/{team_id}/roster"
        )
        team = payload.get("team")
        if isinstance(team, dict) and _canonical_nba_tricode(
            team.get("abbreviation")
        ) != _canonical_nba_tricode(team_abbreviation):
            raise ValueError("ESPN roster response was for a different team.")
        raw_athletes = payload.get("athletes")
        if not isinstance(raw_athletes, list):
            raise ValueError("ESPN roster response is missing player data.")
        athletes = []
        for group in raw_athletes:
            if not isinstance(group, dict):
                continue
            items = group.get("items")
            if isinstance(items, list):
                athletes.extend(item for item in items if isinstance(item, dict))
            elif group.get("id") or group.get("fullName"):
                athletes.append(group)
        jersey_numbers = {}
        jersey_numbers_by_name = {}
        for athlete in athletes:
            jersey_number = _jersey_number_string(
                athlete.get("jersey"),
                athlete.get("jerseyNumber"),
                athlete.get("uniform"),
            )
            if not jersey_number:
                continue
            player_id = str(athlete.get("id") or "").strip()
            if player_id:
                jersey_numbers[player_id] = jersey_number
            player_name = normalize_player_name(
                str(athlete.get("displayName") or athlete.get("fullName") or "")
            )
            if player_name:
                jersey_numbers_by_name[player_name] = jersey_number
        ESPN_TEAM_JERSEY_CACHE[cache_key] = {
            "expires_at": now + NBA_TEAM_JERSEY_CACHE_TTL_SECONDS,
            "jersey_numbers": jersey_numbers,
            "jersey_numbers_by_name": jersey_numbers_by_name,
        }
        return jersey_numbers, jersey_numbers_by_name


def _apply_team_jersey_numbers(
    team: dict, game_id: str, espn_event_id: str
) -> None:
    players = [
        player for player in team.get("players", [])
        if isinstance(player, dict)
    ]
    missing_players = [
        player for player in players if not player.get("jersey_number")
    ]
    if not missing_players:
        return

    jersey_numbers = {}
    jersey_numbers_by_name = {}
    team_id = team.get("id")
    if isinstance(team_id, int):
        jersey_numbers = _fetch_nba_team_jersey_numbers(team_id)
        roster_entry = NBA_TEAM_JERSEY_CACHE.get(
            (current_nba_season(), team_id)
        )
        jersey_numbers_by_name = (
            roster_entry["jersey_numbers_by_name"] if roster_entry else {}
        )
    for player in missing_players:
        player_id = str(player.get("id") or "").strip()
        jersey_number = jersey_numbers.get(player_id)
        if jersey_number is None:
            jersey_number = jersey_numbers_by_name.get(
                normalize_player_name(str(player.get("name") or ""))
            )
        if jersey_number:
            player["jersey_number"] = jersey_number

    missing_players = [
        player for player in players if not player.get("jersey_number")
    ]
    if not missing_players:
        return
    try:
        espn_team_id = str(team.get("espn_team_id") or "").strip()
        if not espn_team_id:
            if not espn_event_id:
                espn_event_id = _resolve_espn_event_id(game_id)
            espn_team_id = _resolve_espn_team_id(
                game_id, espn_event_id, str(team.get("abbreviation") or "")
            )
        espn_jerseys, espn_jerseys_by_name = _fetch_espn_team_jersey_numbers(
            espn_team_id,
            team_id if isinstance(team_id, int) else f"espn:{espn_team_id}",
            str(team.get("abbreviation") or ""),
        )
    except (
        HTTPError,
        URLError,
        TimeoutError,
        OSError,
        ValueError,
        json.JSONDecodeError,
    ) as error:
        logger.warning(
            "ESPN jersey roster refresh failed for %s: %s",
            team.get("abbreviation") or team.get("name"),
            error,
        )
        return
    for player in missing_players:
        player_id = str(player.get("id") or "").strip()
        jersey_number = espn_jerseys.get(player_id)
        if jersey_number is None:
            jersey_number = espn_jerseys_by_name.get(
                normalize_player_name(str(player.get("name") or ""))
            )
        if jersey_number:
            player["jersey_number"] = jersey_number


def _resolve_espn_event_id(
    game_id: str, timeout: float = 12, season: Optional[str] = None
) -> str:
    if re.fullmatch(r"espn:\d+", game_id):
        return game_id.partition(":")[2]
    selected_season = _validated_nba_season(season or _nba_season_from_game_id(game_id))
    with NBA_SCHEDULE_LOCK:
        schedule = (
            _fetch_espn_season_schedule(selected_season)
            if selected_season != current_nba_season()
            else _fetch_nba_schedule(selected_season)
        )
    scheduled_game = next(
        (game for game in schedule["games"] if game["id"] == game_id),
        None,
    )
    if scheduled_game is None:
        raise ValueError("Game is not present in the current NBA schedule.")

    expected_teams = {
        _canonical_nba_tricode(scheduled_game.get("home_tricode")),
        _canonical_nba_tricode(scheduled_game.get("away_tricode")),
    }

    cached_entry = NBA_SCOREBOARD_CACHE.get("today", {})
    cached_scores = (
        cached_entry.get("snapshot", {})
        if cached_entry.get("expires_at", 0) > time.monotonic()
        else {}
    )
    cached_games = cached_scores.get("games", [])
    if isinstance(cached_games, list):
        for score_game in cached_games:
            if not isinstance(score_game, dict):
                continue
            home = _value_by_key(score_game, "homeTeam")
            away = _value_by_key(score_game, "awayTeam")
            event_teams = {
                _canonical_nba_tricode(_value_by_key(home, "teamTricode")),
                _canonical_nba_tricode(_value_by_key(away, "teamTricode")),
            }
            event_id = str(_value_by_key(score_game, "gameId") or "")
            if event_teams == expected_teams and event_id.startswith("espn:"):
                return event_id.partition(":")[2]

    game_date = str(scheduled_game["date"]).replace("-", "")
    payload = _request_nba_json(
        f"https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates={game_date}",
        timeout=timeout,
    )
    events = payload.get("events")
    if not isinstance(events, list):
        raise ValueError("ESPN scoreboard response is missing events.")
    for event in events:
        competitions = event.get("competitions") if isinstance(event, dict) else None
        if not isinstance(competitions, list) or not competitions:
            continue
        competition = competitions[0]
        if not isinstance(competition, dict):
            continue
        competitors = competition.get("competitors", [])
        event_teams = {
            _canonical_nba_tricode(
                (competitor.get("team") or {}).get("abbreviation")
            )
            for competitor in competitors
            if isinstance(competitor, dict)
        }
        event_id = str(event.get("id") or "")
        if expected_teams == event_teams and event_id:
            return event_id
    raise ValueError("ESPN could not match this NBA game to a box-score event.")


def _normalize_espn_box_score(payload: dict, game_id: str) -> dict:
    boxscore = payload.get("boxscore")
    teams_data = _value_by_key(boxscore, "players")
    if not isinstance(teams_data, list):
        raise ValueError("ESPN box-score response is missing player data.")

    def stat_key(name: object) -> str:
        normalized = re.sub(r"[^a-z0-9]", "", str(name or "").casefold())
        aliases = {
            "min": "minutes",
            "pts": "points",
            "reb": "reboundsTotal",
            "totreb": "reboundsTotal",
            "ast": "assists",
            "stl": "steals",
            "blk": "blocks",
            "to": "turnovers",
            "fgm": "fieldGoalsMade",
            "fga": "fieldGoalsAttempted",
            "3pm": "threePointersMade",
            "3pa": "threePointersAttempted",
            "ftm": "freeThrowsMade",
            "fta": "freeThrowsAttempted",
            "plusminus": "plusMinusPoints",
            "pf": "foulsPersonal",
        }
        return aliases.get(normalized, {
            "minute": "minutes",
            "minutes": "minutes",
            "points": "points",
            "rebounds": "reboundsTotal",
            "totalrebounds": "reboundsTotal",
            "assists": "assists",
            "steals": "steals",
            "blocks": "blocks",
            "turnovers": "turnovers",
            "fieldgoalsmade": "fieldGoalsMade",
            "fieldgoalsattempted": "fieldGoalsAttempted",
            "threepointfieldgoalsmade": "threePointersMade",
            "threepointfieldgoalsattempted": "threePointersAttempted",
            "freethrowsmade": "freeThrowsMade",
            "freethrowsattempted": "freeThrowsAttempted",
            "plusminuspoints": "plusMinusPoints",
            "foulspersonal": "foulsPersonal",
        }.get(normalized, str(name or "")))

    def map_stats(keys: list, values: object) -> dict:
        if isinstance(values, dict):
            pairs = values.items()
        elif isinstance(values, list):
            pairs = zip(keys, values)
        else:
            return {}
        mapped = {}
        for name, value in pairs:
            name_text = str(name or "")
            combined = re.fullmatch(
                r"(fieldGoalsMade|threePointFieldGoalsMade|freeThrowsMade)"
                r"-(fieldGoalsAttempted|threePointFieldGoalsAttempted|freeThrowsAttempted)",
                name_text,
                re.IGNORECASE,
            )
            combined_aliases = {
                "fg": ("fieldGoalsMade", "fieldGoalsAttempted"),
                "3pt": ("threePointFieldGoalsMade", "threePointFieldGoalsAttempted"),
                "ft": ("freeThrowsMade", "freeThrowsAttempted"),
            }
            alias_pair = combined_aliases.get(re.sub(r"[^a-z0-9]", "", name_text.casefold()))
            if combined is None and alias_pair:
                made_key, attempted_key = alias_pair
            elif combined:
                made_key, attempted_key = combined.group(1), combined.group(2)
            else:
                made_key = attempted_key = None
            if made_key and attempted_key and isinstance(value, str) and "-" in value:
                made, attempted = value.split("-", 1)
                mapped[stat_key(made_key)] = made
                mapped[stat_key(attempted_key)] = attempted
                continue
            normalized = stat_key(name_text)
            if normalized:
                mapped[normalized] = value
        return mapped

    competitors = _value_by_key(payload.get("header", {}), "competitions")
    competition = competitors[0] if isinstance(competitors, list) and competitors else {}
    header_competitors = competition.get("competitors", [])
    if not isinstance(header_competitors, list):
        header_competitors = []
    scores = {
        _canonical_nba_tricode(
            (competitor.get("team") or {}).get("abbreviation")
        ).casefold(): competitor.get("score")
        for competitor in header_competitors
        if isinstance(competitor, dict)
    }

    teams_by_name = {
        normalize_player_name(str(team.get("name") or "")): team
        for team in teams
    }
    normalized_teams = []
    for team_group in teams_data:
        if not isinstance(team_group, dict):
            continue
        team_data = team_group.get("team") or {}
        abbreviation = _canonical_nba_tricode(team_data.get("abbreviation"))
        name = str(team_data.get("displayName") or team_data.get("name") or "NBA team")
        nba_team = teams_by_name.get(normalize_player_name(name), {})
        nba_team_id_match = re.search(r"/logos/nba/(\d+)/", nba_team.get("logo", ""))
        nba_team_id = int(nba_team_id_match.group(1)) if nba_team_id_match else None
        players_by_id = {}

        def add_player(entry: dict, keys: list, values: object) -> None:
            athlete = entry.get("athlete") if isinstance(entry.get("athlete"), dict) else entry
            athlete_id = str(athlete.get("id") or athlete.get("displayName") or len(players_by_id))
            headshot = athlete.get("headshot") or athlete.get("image")
            if isinstance(headshot, dict):
                headshot = headshot.get("href") or headshot.get("url")
            headshot_url = (
                headshot.strip()
                if isinstance(headshot, str) and headshot.strip().startswith("https://")
                else ""
            )
            if not headshot_url and re.fullmatch(r"\d+", str(athlete.get("id") or "")):
                headshot_url = (
                    "https://a.espncdn.com/i/headshots/nba/players/full/"
                    f"{athlete['id']}.png"
                )
            row = players_by_id.setdefault(athlete_id, {
                "personId": athlete.get("id"),
                "name": athlete.get("displayName") or athlete.get("fullName") or "Unknown player",
                "headshot_url": headshot_url,
                "jersey_number": _jersey_number_string(
                    athlete.get("jersey"),
                    athlete.get("jerseyNumber"),
                    athlete.get("uniform"),
                ),
                "position": (athlete.get("position") or {}).get("abbreviation", "")
                if isinstance(athlete.get("position"), dict) else "",
                "starter": bool(entry.get("starter")),
                "played": not bool(entry.get("didNotPlay")),
                "statistics": {},
            })
            row["statistics"].update(map_stats(keys, values))
            row["played"] = row["played"] and bool(values)

        statistics = team_group.get("statistics", [])
        if isinstance(statistics, list):
            for stat_group in statistics:
                if not isinstance(stat_group, dict):
                    continue
                keys = stat_group.get("keys") or []
                if not isinstance(keys, list):
                    keys = []
                if not keys and stat_group.get("name"):
                    keys = [stat_group["name"]]
                stat_athletes = stat_group.get("athletes")
                if isinstance(stat_athletes, list):
                    for entry in stat_athletes:
                        if isinstance(entry, dict):
                            add_player(entry, keys, entry.get("stats"))

        direct_athletes = team_group.get("athletes")
        if isinstance(direct_athletes, list):
            direct_keys = [
                str(stat.get("name") or stat.get("key") or "")
                for stat in statistics
                if isinstance(stat, dict)
            ]
            for entry in direct_athletes:
                if isinstance(entry, dict):
                    add_player(entry, direct_keys, entry.get("stats"))

        normalized_teams.append({
            "teamId": nba_team_id,
            "espnTeamId": team_data.get("id"),
            "teamCity": name.rsplit(" ", 1)[0] if " " in name else "",
            "teamName": name.rsplit(" ", 1)[-1],
            "teamTricode": abbreviation,
            "score": scores.get(abbreviation.casefold()),
            "players": list(players_by_id.values()),
        })

    if len(normalized_teams) != 2:
        raise ValueError("ESPN box-score response did not contain exactly two teams.")

    teams_by_abbreviation = {
        _canonical_nba_tricode(team.get("teamTricode")).casefold(): team
        for team in normalized_teams
    }
    by_home_away = {
        competitor.get("homeAway"): teams_by_abbreviation.get(
            _canonical_nba_tricode(
                (competitor.get("team") or {}).get("abbreviation")
            ).casefold()
        )
        for competitor in header_competitors
        if isinstance(competitor, dict)
    }
    for competitor in header_competitors:
        if not isinstance(competitor, dict):
            continue
        abbreviation = _canonical_nba_tricode(
            (competitor.get("team") or {}).get("abbreviation")
        )
        normalized_team = teams_by_abbreviation.get(abbreviation.casefold())
        if normalized_team is None:
            continue
        raw_linescores = _value_by_key(competitor, "linescores", "lineScores")
        normalized_team["period_scores"] = []
        if isinstance(raw_linescores, list):
            for period in raw_linescores:
                if not isinstance(period, dict):
                    continue
                normalized_team["period_scores"].append(
                    _value_by_key(period, "value", "displayValue", "score", "points")
                )
    for side, team in by_home_away.items():
        if team is None:
            continue
        abbreviation = _canonical_nba_tricode(
            next(
                (
                    (competitor.get("team") or {}).get("abbreviation")
                    for competitor in header_competitors
                    if isinstance(competitor, dict)
                    and competitor.get("homeAway") == side
                ),
                "",
            )
        ).casefold()
        team["score"] = scores.get(abbreviation, team["score"])
    status = competition.get("status", {}).get("type", {})
    state = str(status.get("state") or "").casefold()
    return {
        "gameId": game_id,
        "gameStatus": 2 if state == "in" else 3 if state == "post" else 1,
        "gameStatusText": str(status.get("shortDetail") or status.get("description") or "Status unavailable"),
        "period": competition.get("status", {}).get("period"),
        "gameClock": competition.get("status", {}).get("displayClock"),
        "homeTeam": by_home_away.get("home") or normalized_teams[0],
        "awayTeam": by_home_away.get("away") or normalized_teams[1],
    }


def _fetch_espn_period_scores(
    game_id: str,
    event_id: str,
    timeout: float = 12,
    season: Optional[str] = None,
) -> dict[str, list]:
    selected_season = _validated_nba_season(season or _nba_season_from_game_id(game_id))
    with NBA_SCHEDULE_LOCK:
        schedule = (
            _fetch_espn_season_schedule(selected_season)
            if selected_season != current_nba_season()
            else _fetch_nba_schedule(selected_season)
        )
    scheduled_game = next(
        (game for game in schedule["games"] if game["id"] == game_id),
        None,
    )
    if scheduled_game is None:
        raise ValueError("NBA schedule has no matching game for quarter-score lookup.")

    game_date = str(scheduled_game["date"]).replace("-", "")
    payload = _request_nba_json(
        f"https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates={game_date}",
        timeout=timeout,
    )
    events = payload.get("events")
    if not isinstance(events, list):
        raise ValueError("ESPN scoreboard response is missing events.")
    event = next(
        (
            item for item in events
            if isinstance(item, dict) and str(item.get("id") or "") == event_id
        ),
        None,
    )
    if event is None:
        raise ValueError("ESPN scoreboard has no matching event for quarter-score lookup.")
    competitions = event.get("competitions")
    competition = competitions[0] if isinstance(competitions, list) and competitions else {}
    competitors = competition.get("competitors", [])
    if not isinstance(competitors, list):
        raise ValueError("ESPN scoreboard event is missing competitors.")

    period_scores = {}
    for competitor in competitors:
        if not isinstance(competitor, dict):
            continue
        team = competitor.get("team")
        abbreviation = _canonical_nba_tricode(
            team.get("abbreviation") if isinstance(team, dict) else ""
        )
        linescores = _value_by_key(competitor, "linescores", "lineScores")
        if not abbreviation or not isinstance(linescores, list):
            continue
        period_scores[abbreviation] = [
            _value_by_key(period, "value", "displayValue", "score", "points")
            for period in linescores
            if isinstance(period, dict)
        ]
    return period_scores


def fetch_nba_box_score(game_id: str, season: Optional[str] = None) -> dict:
    if re.fullmatch(r"\d{10}", game_id):
        selected_season = _validated_nba_season(season or _nba_season_from_game_id(game_id))
    elif re.fullmatch(r"espn:\d+", game_id) and season:
        selected_season = _validated_nba_season(season)
    else:
        raise HTTPException(status_code=422, detail="Game ID must be a 10-digit NBA ID or an ESPN archive ID with a season.")

    cache_key = f"boxscore:{selected_season}:{game_id}"
    cached_snapshot = supabase_cache_read("boxscore", cache_key)
    if cached_snapshot:
        return cached_snapshot

    with NBA_BOX_SCORE_LOCK:
        now = time.monotonic()
        cached = NBA_BOX_SCORE_CACHE.get(game_id)
        if cached and cached["expires_at"] > now:
            return cached["snapshot"]

        nba_error = None
        espn_event_id = ""
        try:
            if game_id.startswith("espn:"):
                espn_event_id = _resolve_espn_event_id(game_id, timeout=3, season=selected_season)
                payload = _request_nba_json(
                    f"https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event={espn_event_id}",
                    timeout=5,
                )
                game = _normalize_espn_box_score(payload, game_id)
            else:
                payload = _request_nba_json(
                    f"https://cdn.nba.com/static/json/liveData/boxscore/boxscore_{game_id}.json",
                    timeout=4,
                )
                game = payload.get("game") or payload.get("boxScore")
                if not isinstance(game, dict):
                    raise ValueError("NBA box-score response is missing game data.")
        except (HTTPError, URLError, TimeoutError, OSError, ValueError, json.JSONDecodeError) as error:
            nba_error = error
            try:
                espn_event_id = _resolve_espn_event_id(game_id, timeout=3, season=selected_season)
                payload = _request_nba_json(
                    f"https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event={espn_event_id}",
                    timeout=4,
                )
                game = _normalize_espn_box_score(payload, game_id)
            except (HTTPError, URLError, TimeoutError, OSError, ValueError, json.JSONDecodeError) as fallback_error:
                logger.warning(
                    "NBA box-score request failed (%s); ESPN fallback failed (%s).",
                    error,
                    fallback_error,
                )
                nba_error = fallback_error
                game = None
                payload = {}

        try:
            if not isinstance(game, dict):
                raise ValueError("Neither NBA.com nor ESPN could provide this game's box score.")
            nba_team_names = {}
            nba_team_logos = {}
            for team in teams:
                logo_parts = team.get("logo", "").split("/")
                try:
                    nba_team_id = int(logo_parts[logo_parts.index("nba") + 1])
                except (ValueError, IndexError):
                    continue
                nba_team_names[nba_team_id] = team["name"]
                nba_team_logos[nba_team_id] = team["logo"]
            home = _value_by_key(game, "homeTeam")
            away = _value_by_key(game, "awayTeam")
            if not isinstance(home, dict) or not isinstance(away, dict):
                raise ValueError("NBA box-score response is missing a home or away team.")
            home_periods = _team_period_scores(home)
            away_periods = _team_period_scores(away)
            try:
                game_status = int(_value_by_key(game, "gameStatus") or 0)
            except (TypeError, ValueError):
                game_status = 0
            try:
                current_period = int(_value_by_key(game, "period") or 0)
            except (TypeError, ValueError):
                current_period = 0
            expected_period_count = (
                max(4, len(home_periods), len(away_periods))
                if game_status == 3
                else max(1, current_period, len(home_periods), len(away_periods))
                if game_status == 2
                else 0
            )
            teams_missing_period_scores = [
                periods
                for periods in (home_periods, away_periods)
                if expected_period_count
                and (
                    len(periods) < expected_period_count
                    or any(
                        score is None or not str(score).strip()
                        for score in periods[:expected_period_count]
                    )
                )
            ]
            if teams_missing_period_scores:
                try:
                    if not espn_event_id:
                        espn_event_id = _resolve_espn_event_id(game_id, timeout=3, season=selected_season)
                    scoreboard_periods = _fetch_espn_period_scores(
                        game_id, espn_event_id, timeout=3, season=selected_season
                    )
                except (
                    HTTPError,
                    URLError,
                    TimeoutError,
                    OSError,
                    ValueError,
                    json.JSONDecodeError,
                ) as period_error:
                    logger.warning(
                        "ESPN quarter-score lookup failed for game %s: %s",
                        game_id,
                        period_error,
                    )
                else:
                    for team in (home, away):
                        abbreviation = _canonical_nba_tricode(
                            _value_by_key(team, "teamTricode", "abbreviation")
                        )
                        fallback_periods = scoreboard_periods.get(abbreviation, [])
                        existing_periods = _team_period_scores(team)
                        merged_periods = [
                            (
                                existing_periods[index]
                                if index < len(existing_periods)
                                and existing_periods[index] is not None
                                and str(existing_periods[index]).strip()
                                else fallback_periods[index]
                                if index < len(fallback_periods)
                                else None
                            )
                            for index in range(max(
                                len(existing_periods), len(fallback_periods)
                            ))
                        ]
                        team["period_scores"] = merged_periods
            normalized_home = _normalize_box_score_team(
                home, nba_team_names, nba_team_logos
            )
            normalized_away = _normalize_box_score_team(
                away, nba_team_names, nba_team_logos
            )
            snapshot = {
                "status": "fresh",
                "source": (
                    "ESPN archived box score"
                    if game_id.startswith("espn:")
                    else "NBA.com live box score"
                    if nba_error is None
                    else "ESPN box score fallback"
                ),
                "last_updated": _value_by_key(payload.get("meta", {}), "time")
                or datetime.now(timezone.utc).isoformat(),
                "game_id": game_id,
                "game_status": str(_value_by_key(game, "gameStatusText") or "Status unavailable"),
                "status_code": _value_by_key(game, "gameStatus"),
                "period": _value_by_key(game, "period"),
                "clock": _value_by_key(game, "gameClock"),
                "home": normalized_home,
                "away": normalized_away,
            }
            NBA_BOX_SCORE_CACHE[game_id] = {
                "expires_at": now + NBA_BOX_SCORE_CACHE_TTL_SECONDS,
                "snapshot": snapshot,
            }
            supabase_cache_write("boxscore", cache_key, snapshot, ttl_seconds=900)
            return snapshot
        except (HTTPError, URLError, TimeoutError, OSError, ValueError, json.JSONDecodeError) as error:
            logger.warning("NBA box-score refresh failed for game %s: %s", game_id, error)
            previous = cached["snapshot"] if cached else None
            if previous and previous.get("home") and previous.get("away"):
                snapshot = {
                    **previous,
                    "status": "stale",
                    "message": "Live box-score refresh failed; showing the last successful update.",
                }
            else:
                snapshot = {
                    "status": "unavailable",
                    "source": "NBA.com live box score",
                    "last_updated": None,
                    "game_id": game_id,
                    "message": "This box score is not available yet, or the live score feed is unreachable.",
                    "home": None,
                    "away": None,
                }
            NBA_BOX_SCORE_CACHE[game_id] = {
                "expires_at": now + 15,
                "snapshot": snapshot,
            }
            supabase_cache_write("boxscore", cache_key, snapshot, ttl_seconds=300)
            return snapshot


def _period_label(period_number: int) -> str:
    if period_number <= 4:
        return f"Q{period_number}"
    return f"OT{period_number - 4}"


def _normalize_espn_play_by_play(payload: dict, game_id: str) -> dict:
    plays = payload.get("plays")
    if not isinstance(plays, list):
        raise ValueError("ESPN play-by-play response is missing plays.")

    normalized_plays = []
    for index, play in enumerate(plays):
        if not isinstance(play, dict):
            continue
        period = play.get("period")
        if isinstance(period, dict):
            period_number = period.get("number")
            period_label = str(period.get("displayValue") or "")
        else:
            period_number = period
            period_label = ""
        try:
            period_number = int(period_number)
        except (TypeError, ValueError):
            period_number = 0
        clock = play.get("clock")
        if isinstance(clock, dict):
            clock = clock.get("displayValue")
        play_type = play.get("type")
        if isinstance(play_type, dict):
            play_type = play_type.get("text") or play_type.get("abbreviation")
        team = play.get("team")
        if not isinstance(team, dict):
            team = {}
        participants = play.get("participants")
        player_names = []
        if isinstance(participants, list):
            for participant in participants:
                if not isinstance(participant, dict):
                    continue
                athlete = participant.get("athlete")
                if isinstance(athlete, dict):
                    player_name = athlete.get("displayName") or athlete.get("fullName")
                else:
                    player_name = participant.get("name")
                if player_name:
                    player_names.append(str(player_name))
        text = str(play.get("text") or play.get("description") or "").strip()
        if not text and player_names:
            text = ", ".join(player_names)
        if not text:
            continue
        normalized_plays.append({
            "id": str(play.get("id") or play.get("sequenceNumber") or index),
            "period": period_number,
            "period_label": period_label or _period_label(period_number),
            "clock": str(clock or ""),
            "type": str(play_type or "Play"),
            "text": text,
            "team_tricode": _canonical_nba_tricode(
                team.get("abbreviation") or team.get("shortDisplayName")
            ),
            "home_score": play.get("homeScore"),
            "away_score": play.get("awayScore"),
        })

    header = payload.get("header")
    competitions = header.get("competitions") if isinstance(header, dict) else None
    competition = competitions[0] if isinstance(competitions, list) and competitions else {}
    status = competition.get("status") if isinstance(competition, dict) else {}
    status_type = status.get("type") if isinstance(status, dict) else {}
    state = str(status_type.get("state") or "").casefold() if isinstance(status_type, dict) else ""
    return {
        "game_id": game_id,
        "status": "fresh",
        "source": "ESPN play-by-play",
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "status_code": {"pre": 1, "in": 2, "post": 3}.get(state),
        "game_status": str(
            status_type.get("shortDetail") or status_type.get("description") or ""
        ) if isinstance(status_type, dict) else "",
        "count": len(normalized_plays),
        "plays": normalized_plays,
    }


def _normalize_nba_play_by_play(payload: dict, game_id: str) -> dict:
    game = payload.get("game")
    if not isinstance(game, dict):
        game = payload
    actions = game.get("actions")
    if not isinstance(actions, list):
        raise ValueError("NBA play-by-play response is missing actions.")
    normalized_plays = []
    for index, action in enumerate(actions):
        if not isinstance(action, dict):
            continue
        try:
            period_number = int(action.get("period") or 0)
        except (TypeError, ValueError):
            period_number = 0
        raw_clock = str(action.get("clock") or "")
        clock_match = re.fullmatch(r"PT(?:(\d+)M)?([\d.]+)S", raw_clock)
        clock = (
            f"{int(clock_match.group(1) or 0):02d}:{int(float(clock_match.group(2))):02d}"
            if clock_match else raw_clock
        )
        text = str(action.get("description") or "").strip()
        if not text:
            text = " ".join(
                str(action.get(field) or "").strip()
                for field in ("playerNameI", "subType")
                if action.get(field)
            )
        if not text:
            continue
        normalized_plays.append({
            "id": str(action.get("actionNumber") or action.get("actionId") or index),
            "period": period_number,
            "period_label": _period_label(period_number),
            "clock": clock,
            "type": str(action.get("actionType") or "Play").replace("_", " ").title(),
            "text": text,
            "team_tricode": _canonical_nba_tricode(action.get("teamTricode")),
            "home_score": action.get("scoreHome"),
            "away_score": action.get("scoreAway"),
        })
    status_code = game.get("gameStatus")
    try:
        status_code = int(status_code) if status_code is not None else None
    except (TypeError, ValueError):
        status_code = None
    return {
        "game_id": game_id,
        "status": "fresh",
        "source": "NBA.com play-by-play",
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "status_code": status_code,
        "game_status": str(game.get("gameStatusText") or ""),
        "count": len(normalized_plays),
        "plays": normalized_plays,
    }


def fetch_nba_play_by_play(game_id: str, season: Optional[str] = None) -> dict:
    if re.fullmatch(r"\d{10}", game_id):
        selected_season = _validated_nba_season(
            season or _nba_season_from_game_id(game_id)
        )
    elif re.fullmatch(r"espn:\d+", game_id) and season:
        selected_season = _validated_nba_season(season)
    else:
        raise HTTPException(
            status_code=422,
            detail="Game ID must be a 10-digit NBA ID or an ESPN archive ID with a season.",
        )

    cache_key = (game_id, selected_season)
    now = time.monotonic()
    with NBA_PLAY_BY_PLAY_LOCK:
        cached = NBA_PLAY_BY_PLAY_CACHE.get(cache_key)
        if cached and cached["expires_at"] > now:
            return cached["snapshot"]

    errors = []
    snapshot = None
    if re.fullmatch(r"\d{10}", game_id):
        try:
            nba_payload = _request_nba_json(
                f"https://cdn.nba.com/static/json/liveData/playbyplay/playbyplay_{game_id}.json",
                timeout=5,
            )
            snapshot = _normalize_nba_play_by_play(nba_payload, game_id)
        except (HTTPError, URLError, TimeoutError, OSError, ValueError, json.JSONDecodeError) as error:
            errors.append(error)

    if snapshot is None or not snapshot["plays"]:
        try:
            event_id = _resolve_espn_event_id(game_id, timeout=4, season=selected_season)
            espn_payload = _request_nba_json(
                f"https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event={event_id}",
                timeout=6,
            )
            espn_snapshot = _normalize_espn_play_by_play(espn_payload, game_id)
            if espn_snapshot["plays"] or snapshot is None:
                snapshot = espn_snapshot
        except (HTTPError, URLError, TimeoutError, OSError, ValueError, json.JSONDecodeError) as error:
            errors.append(error)

    if snapshot is None:
        logger.warning(
            "Play-by-play refresh failed for game %s: %s",
            game_id,
            "; ".join(str(error) for error in errors),
        )
        with NBA_PLAY_BY_PLAY_LOCK:
            cached = NBA_PLAY_BY_PLAY_CACHE.get(cache_key)
        if cached and cached["snapshot"].get("plays"):
            snapshot = {
                **cached["snapshot"],
                "status": "stale",
                "message": "Play-by-play refresh failed; showing the last successful update.",
            }
        else:
            snapshot = {
                "game_id": game_id,
                "status": "unavailable",
                "source": None,
                "last_updated": None,
                "status_code": None,
                "game_status": "",
                "count": 0,
                "plays": [],
                "message": "Play-by-play is unavailable for this game right now.",
            }

    ttl = 15 if selected_season == current_nba_season() else 3600
    with NBA_PLAY_BY_PLAY_LOCK:
        NBA_PLAY_BY_PLAY_CACHE[cache_key] = {
            "expires_at": time.monotonic() + ttl,
            "snapshot": snapshot,
        }
    return snapshot


def fetch_nba_box_score_jersey_numbers(
    game_id: str, season: Optional[str] = None
) -> dict:
    if re.fullmatch(r"\d{10}", game_id):
        selected_season = _validated_nba_season(
            season or _nba_season_from_game_id(game_id)
        )
    elif re.fullmatch(r"espn:\d+", game_id) and season:
        selected_season = _validated_nba_season(season)
    else:
        raise HTTPException(status_code=422, detail="Game ID must be a 10-digit NBA ID or an ESPN archive ID with a season.")
    snapshot = fetch_nba_box_score(game_id, season)
    if not snapshot.get("home") or not snapshot.get("away"):
        return {"home": [], "away": []}

    home = snapshot["home"]
    away = snapshot["away"]
    if selected_season == current_nba_season():
        _apply_team_jersey_numbers(home, game_id, "")
        _apply_team_jersey_numbers(away, game_id, "")

    def player_jerseys(team: dict) -> list[dict]:
        return [
            {
                "id": str(player.get("id") or ""),
                "name": str(player.get("name") or ""),
                "jersey_number": str(player.get("jersey_number") or ""),
            }
            for player in team.get("players", [])
            if isinstance(player, dict) and player.get("jersey_number")
        ]

    return {
        "home": player_jerseys(home),
        "away": player_jerseys(away),
    }


def _normalize_transaction_type(value: object, description: str) -> str:
    if isinstance(value, dict):
        value = value.get("name") or value.get("abbreviation") or value.get("description")
    text = f"{value or ''} {description}".casefold()
    if "trade" in text:
        return "TRADE"
    if "waiv" in text or "release" in text:
        return "WAIVED"
    if "draft" in text or "select" in text:
        return "DRAFT"
    if "extension" in text or re.search(r"\bextend(?:s|ed)?\b", text):
        return "EXTENSION"
    if "sign" in text or "contract" in text or "free agent" in text:
        return "SIGNING"
    return "OTHER"


def _format_transaction_date(value: object) -> tuple[str, str]:
    if isinstance(value, (int, float)):
        parsed = datetime.fromtimestamp(value / 1000 if value > 10_000_000_000 else value, timezone.utc)
    else:
        text = str(value or "").strip()
        try:
            parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
        except ValueError as error:
            raise ValueError(f"NBA transaction has an invalid date: {text}.") from error
    return parsed.date().isoformat(), parsed.strftime("%A, %B %d, %Y")


def _parse_nba_transactions(payload: dict) -> list:
    movement_data = payload.get("NBA_Player_Movement")
    if not isinstance(movement_data, dict):
        raise ValueError("NBA transactions page data is missing NBA_Player_Movement.")
    raw_items = movement_data.get("rows")
    if not isinstance(raw_items, list):
        raise ValueError("NBA transactions page data has no movement rows.")

    nba_team_names = {}
    nba_team_logos = {}
    for team in teams:
        match = re.search(r"/logos/nba/(\d+)/", team.get("logo", ""))
        if match:
            team_id = int(match.group(1))
            nba_team_names[team_id] = team["name"]
            nba_team_logos[team_id] = team["logo"]
    parsed_items = []
    for index, raw_item in enumerate(raw_items):
        if not isinstance(raw_item, dict):
            continue
        description = str(raw_item.get("TRANSACTION_DESCRIPTION") or "").strip()
        if not description:
            continue
        date_key, date_label = _format_transaction_date(raw_item.get("TRANSACTION_DATE"))
        try:
            team_id = int(float(raw_item.get("TEAM_ID")))
        except (TypeError, ValueError):
            team_id = None
        team_name = nba_team_names.get(team_id, "NBA")
        transaction_type = str(raw_item.get("Transaction_Type") or "")
        parsed_items.append({
            "id": f"{date_key}:{index}:{description[:48]}",
            "date": date_label,
            "date_key": date_key,
            "team": team_name,
            "logo": nba_team_logos.get(team_id, ""),
            "type": _normalize_transaction_type(transaction_type, description),
            "text": description,
        })
    return parsed_items


def fetch_current_nba_transactions() -> dict:
    with NBA_TRANSACTIONS_LOCK:
        now = time.monotonic()
        cached = NBA_TRANSACTIONS_CACHE.get("latest")
        if cached and cached["expires_at"] > now:
            return cached["snapshot"]

        try:
            payload = _request_nba_json(
                "https://stats.nba.com/js/data/playermovement/NBA_Player_Movement.json"
            )
            season_start_year = int(current_nba_season()[:4])
            season_start = f"{season_start_year}-06-01"
            season_end = f"{season_start_year + 1}-06-30"
            transactions = [
                transaction
                for transaction in _parse_nba_transactions(payload)
                if season_start <= transaction["date_key"] <= season_end
            ]
            transactions.sort(
                key=lambda item: (item["date_key"], item["id"]),
                reverse=True,
            )
            grouped = {}
            for transaction in transactions:
                grouped.setdefault(transaction["date_key"], {
                    "date": transaction["date"],
                    "items": [],
                })["items"].append({
                    "team": transaction["team"],
                    "logo": transaction["logo"],
                    "type": transaction["type"],
                    "text": transaction["text"],
                })
            snapshot = {
                "status": "fresh",
                "source": "NBA.com transactions",
                "last_updated": datetime.now(timezone.utc).isoformat(),
                "message": (
                    "Transactions are loaded from the official NBA player-movement records shown on NBA.com."
                ),
                "count": len(transactions),
                "transactions": list(grouped.values()),
            }
            NBA_TRANSACTIONS_CACHE["latest"] = {
                "expires_at": now + NBA_TRANSACTIONS_CACHE_TTL_SECONDS,
                "snapshot": snapshot,
            }
            return snapshot
        except (HTTPError, URLError, TimeoutError, OSError, ValueError, json.JSONDecodeError) as error:
            logger.warning("NBA transaction refresh failed: %s", error)
            previous = cached["snapshot"] if cached else None
            if previous and previous.get("transactions"):
                snapshot = {
                    **previous,
                    "status": "stale",
                    "message": (
                        f"NBA transactions page refresh failed ({type(error).__name__}: {error}); "
                        "showing the last successful reported feed."
                    ),
                }
            else:
                snapshot = {
                    "status": "unavailable",
                    "source": "NBA.com transactions",
                    "last_updated": None,
                    "message": (
                        f"NBA.com transactions are unavailable "
                        f"({type(error).__name__}: {error}). No unverified transaction list is being shown."
                    ),
                    "count": 0,
                    "transactions": [],
                }
            NBA_TRANSACTIONS_CACHE["latest"] = {
                "expires_at": now + 900,
                "snapshot": snapshot,
            }
            return snapshot


def _fetch_current_nba_rosters() -> dict:
    now = time.monotonic()
    season = current_nba_season()
    cached = NBA_ROSTER_CACHE.get(season)
    if cached and cached["expires_at"] > now:
        return cached["snapshot"]

    try:
        nba_team_ids = {}
        for team in teams:
            match = re.search(r"/logos/nba/(\d+)/", team.get("logo", ""))
            if not match:
                raise ValueError(f"NBA team ID is missing from the logo URL for {team['name']}.")
            nba_team_ids[int(match.group(1))] = team["id"]
        if len(nba_team_ids) != 30 or len(set(nba_team_ids.values())) != 30:
            raise ValueError("The configured NBA team IDs are incomplete or duplicated.")

        parameters = urlencode({
            "IsOnlyCurrentSeason": 1,
            "LeagueID": "00",
            "Season": season,
        })
        request = Request(
            f"https://stats.nba.com/stats/commonallplayers?{parameters}",
            headers={
                "Accept": "application/json, text/plain, */*",
                "Origin": "https://www.nba.com",
                "Referer": "https://www.nba.com/",
                "x-nba-stats-origin": "stats",
                "x-nba-stats-token": "true",
                "User-Agent": "Mozilla/5.0 (compatible; NBAStatsRefresh/1.0)",
            },
        )
        with urlopen(request, timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8"))

        result_sets = payload.get("resultSets")
        if not isinstance(result_sets, list) or not result_sets:
            raise ValueError("NBA active-roster response did not contain resultSets.")
        headers = result_sets[0].get("headers")
        rows = result_sets[0].get("rowSet")
        if not isinstance(headers, list) or not isinstance(rows, list):
            raise ValueError("NBA active-roster response did not contain player rows.")
        indexes = {name: index for index, name in enumerate(headers)}
        required = {"DISPLAY_FIRST_LAST", "ROSTERSTATUS", "TEAM_ID"}
        if not required.issubset(indexes):
            raise ValueError("NBA active-roster response is missing required player columns.")

        roster_by_team = {team["id"]: [] for team in teams}
        for row in rows:
            try:
                roster_status = int(row[indexes["ROSTERSTATUS"]])
                nba_team_id = int(row[indexes["TEAM_ID"]])
            except (TypeError, ValueError):
                continue
            team_id = nba_team_ids.get(nba_team_id)
            name = str(row[indexes["DISPLAY_FIRST_LAST"]] or "").strip()
            if roster_status != 1 or team_id is None or not name:
                continue
            roster_by_team[team_id].append(name)

        for player_name, team_id in NBA_ROSTER_TEAM_OVERRIDES.items():
            for roster in roster_by_team.values():
                roster[:] = [
                    name for name in roster
                    if normalize_player_name(name) != normalize_player_name(player_name)
                ]
            roster_by_team[team_id].append(player_name.title())

        if any(len(roster) < 5 for roster in roster_by_team.values()):
            raise ValueError("NBA active-roster response did not include at least five players for every team.")

        base_players_by_name = {}
        base_players_by_team_and_name = {}
        for team in teams:
            for player in team["starters_2026_27"] + team["bench_2026_27"]:
                player_key = normalize_player_name(player["name"])
                base_players_by_name.setdefault(player_key, player)
                base_players_by_team_and_name[(team["id"], player_key)] = player

        response_teams = json.loads(json.dumps(teams))
        for team in response_teams:
            roster_players = []
            for name in roster_by_team[team["id"]]:
                player_key = normalize_player_name(name)
                base_player = (
                    base_players_by_team_and_name.get((team["id"], player_key))
                    or base_players_by_name.get(player_key)
                )
                if base_player:
                    player = {**base_player, "name": name}
                else:
                    player = {
                        "name": name,
                        "pos": "—",
                        "contract_type": None,
                        "stats_season": f"{int(season[:4]) - 1}-{season[2:4]}",
                        "gp": None,
                        "pts": None,
                        "reb": None,
                        "ast": None,
                        "stl": None,
                        "blk": None,
                        "tov": None,
                        "fg": None,
                        "fg3": None,
                        "ft": None,
                        "salary": None,
                    }
                salary_override = NBA_ROSTER_SALARY_OVERRIDES.get(player_key)
                if salary_override is not None:
                    player["salary"] = salary_override
                roster_players.append(player)

            active_players_by_name = {
                normalize_player_name(player["name"]): player
                for player in roster_players
            }
            preferred_order = team["starters_2026_27"] + team["bench_2026_27"]
            starters = []
            starter_names = set()
            for preferred_player in preferred_order:
                player_key = normalize_player_name(preferred_player["name"])
                active_player = active_players_by_name.get(player_key)
                if active_player and player_key not in starter_names:
                    starters.append(active_player)
                    starter_names.add(player_key)
                if len(starters) == 5:
                    break
            if len(starters) < 5:
                for player in roster_players:
                    player_key = normalize_player_name(player["name"])
                    if player_key not in starter_names:
                        starters.append(player)
                        starter_names.add(player_key)
                    if len(starters) == 5:
                        break
            if len(starters) != 5:
                raise ValueError(f"Could not build five unique projected starters for {team['name']}.")
            team["roster_2026_27"] = roster_players
            team["starters_2026_27"] = starters
            team["bench_2026_27"] = [
                player for player in roster_players
                if normalize_player_name(player["name"]) not in starter_names
            ]

        snapshot = {
            "status": "fresh",
            "source": "NBA.com Stats",
            "season": season,
            "last_updated": datetime.now(timezone.utc).isoformat(),
            "message": (
                "Roster membership refreshed from NBA.com Stats. The feed does not publish game-day starting "
                "lineups; projected starters follow saved team depth order and may not match the next game. "
                "Its active-player feed does not identify two-way contract status; unmatched players have no "
                "verified position or salary. "
                "User-configured team assignments are retained."
            ),
            "teams": response_teams,
        }
        NBA_ROSTER_CACHE[season] = {
            "expires_at": now + NBA_ROSTER_CACHE_TTL_SECONDS,
            "snapshot": snapshot,
        }
        return snapshot
    except (HTTPError, URLError, TimeoutError, OSError, ValueError, json.JSONDecodeError) as error:
        logger.warning("NBA roster refresh failed for %s: %s", season, error)
        previous = cached["snapshot"] if cached else None
        if previous and previous.get("teams"):
            snapshot = {
                **previous,
                "status": "stale",
                "message": f"NBA.com Stats rosters are unavailable; showing the last complete {season} roster refresh.",
            }
        else:
            snapshot = {
                "status": "stale",
                "source": "API snapshot",
                "season": season,
                "last_updated": None,
                "message": "NBA.com Stats rosters are unavailable; showing the saved API roster snapshot, which may be outdated.",
                "teams": None,
            }
        NBA_ROSTER_CACHE[season] = {
            "expires_at": now + 900,
            "snapshot": snapshot,
        }
        return snapshot


def _fetch_current_nba_player_stats() -> dict:
    now = time.monotonic()
    season = current_nba_season()
    cached = NBA_STATS_CACHE.get(season)
    if cached and cached["expires_at"] > now:
        return cached["snapshot"]

    parameters = {
        "College": "",
        "Conference": "",
        "Country": "",
        "DateFrom": "",
        "DateTo": "",
        "Division": "",
        "DraftPick": "",
        "DraftYear": "",
        "GameScope": "",
        "GameSegment": "",
        "Height": "",
        "LastNGames": 0,
        "LeagueID": "00",
        "Location": "",
        "MeasureType": "Base",
        "Month": 0,
        "OpponentTeamID": 0,
        "Outcome": "",
        "PORound": 0,
        "PaceAdjust": "N",
        "PerMode": "PerGame",
        "Period": 0,
        "PlayerExperience": "",
        "PlayerPosition": "",
        "PlusMinus": "N",
        "Rank": "N",
        "Season": season,
        "SeasonSegment": "",
        "SeasonType": "Regular Season",
        "ShotClockRange": "",
        "TeamID": 0,
        "VsConference": "",
        "VsDivision": "",
    }
    try:
        payload = _request_nba_json(
            "https://stats.nba.com/stats/leaguedashplayerstats?"
            + urlencode(parameters)
        )
        result_sets = payload.get("resultSets")
        if not isinstance(result_sets, list) or not result_sets:
            raise ValueError("NBA stats response did not contain resultSets.")
        headers = result_sets[0].get("headers")
        rows = result_sets[0].get("rowSet")
        if not isinstance(headers, list) or not isinstance(rows, list):
            raise ValueError("NBA stats response did not contain player rows.")
        indexes = {name: index for index, name in enumerate(headers)}
        required = {"PLAYER_NAME", "GP", "PTS", "REB", "AST", "STL", "BLK", "TOV", "FG_PCT", "FG3_PCT", "FT_PCT"}
        if not required.issubset(indexes):
            raise ValueError("NBA stats response is missing required player-stat columns.")

        def value(row: list, column: str):
            raw = row[indexes[column]]
            if raw is None or raw == "":
                return None
            return float(raw)

        def percentage(row: list, column: str):
            raw = value(row, column)
            return round(raw * 100, 1) if raw is not None else None

        players = {}
        for row in rows:
            name = str(row[indexes["PLAYER_NAME"]]).strip()
            if not name:
                continue
            gp = value(row, "GP")
            players[normalize_player_name(name)] = {
                "stats_season": season,
                "gp": int(gp) if gp is not None else None,
                "pts": value(row, "PTS"),
                "reb": value(row, "REB"),
                "ast": value(row, "AST"),
                "stl": value(row, "STL"),
                "blk": value(row, "BLK"),
                "tov": value(row, "TOV"),
                "fg": percentage(row, "FG_PCT"),
                "fg3": percentage(row, "FG3_PCT"),
                "ft": percentage(row, "FT_PCT"),
            }

        updated_at = datetime.now(timezone.utc).isoformat()
        status = "fresh" if players else "pending"
        snapshot = {
            "status": status,
            "source": "NBA.com Stats",
            "season": season,
            "last_updated": updated_at,
            "message": "" if players else f"No {season} regular-season player stats have been published yet.",
            "players": players,
        }
        NBA_STATS_CACHE[season] = {
            "expires_at": now + NBA_STATS_CACHE_TTL_SECONDS,
            "snapshot": snapshot,
        }
        return snapshot
    except (HTTPError, URLError, TimeoutError, OSError, ValueError, json.JSONDecodeError) as error:
        logger.warning("NBA stats refresh failed for %s: %s", season, error)
        previous = cached["snapshot"] if cached else None
        if previous and previous.get("players"):
            snapshot = {
                **previous,
                "status": "stale",
                "message": f"NBA.com Stats is unavailable; showing the last successful {season} update.",
            }
        else:
            snapshot = {
                "status": "unavailable",
                "source": "NBA.com Stats",
                "season": season,
                "last_updated": None,
                "message": (
                    f"NBA.com Stats could not provide {season} player stats; "
                    "prior-season stats are not being substituted."
                ),
                "players": {},
            }
        NBA_STATS_CACHE[season] = {
            "expires_at": now + 60,
            "snapshot": snapshot,
        }
        return snapshot


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


def _canonical_odds_team_name(name: object) -> str:
    normalized_name = normalize_player_name(str(name or ""))
    aliases = {
        "losangelesclippers": "LA Clippers",
        "lalakers": "Los Angeles Lakers",
    }
    configured_teams = {
        normalize_player_name(str(team.get("name") or "")): str(team["name"])
        for team in teams
    }
    if normalized_name in aliases:
        return aliases[normalized_name]
    return configured_teams.get(normalized_name, str(name or "").strip())


def _american_odds_to_decimal(value: object) -> Optional[float]:
    try:
        price = float(value)
    except (TypeError, ValueError):
        return None
    if price == 0 or not math.isfinite(price):
        return None
    return 1 + (price / 100 if price > 0 else 100 / abs(price))


def _normalize_odds_events(payload: object) -> list[dict]:
    if not isinstance(payload, list):
        raise ValueError("The Odds API returned an invalid event list.")

    normalized_events = []
    for event in payload:
        if not isinstance(event, dict):
            continue
        event_id = str(event.get("id") or "").strip()
        home = _canonical_odds_team_name(event.get("home_team"))
        away = _canonical_odds_team_name(event.get("away_team"))
        commence_time = str(event.get("commence_time") or "").strip()
        if not event_id or not home or not away or not commence_time:
            continue

        best_prices = {home: None, away: None}
        for bookmaker in event.get("bookmakers") or []:
            if not isinstance(bookmaker, dict):
                continue
            bookmaker_title = str(bookmaker.get("title") or bookmaker.get("key") or "Sportsbook")
            for market in bookmaker.get("markets") or []:
                if not isinstance(market, dict) or market.get("key") != "h2h":
                    continue
                last_updated = market.get("last_update")
                for outcome in market.get("outcomes") or []:
                    if not isinstance(outcome, dict):
                        continue
                    outcome_team = _canonical_odds_team_name(outcome.get("name"))
                    if outcome_team not in best_prices:
                        continue
                    try:
                        american_price = float(outcome.get("price"))
                    except (TypeError, ValueError):
                        continue
                    decimal_price = _american_odds_to_decimal(american_price)
                    if decimal_price is None:
                        continue
                    current_best = best_prices[outcome_team]
                    if current_best is None or decimal_price > current_best["decimal"]:
                        best_prices[outcome_team] = {
                            "american": int(american_price),
                            "decimal": decimal_price,
                            "bookmaker": bookmaker_title,
                            "last_updated": last_updated,
                        }

        normalized_events.append({
            "id": event_id,
            "commence_time": commence_time,
            "home": home,
            "away": away,
            "home_odds": best_prices[home],
            "away_odds": best_prices[away],
        })
    return normalized_events


def fetch_current_nba_odds() -> dict:
    with NBA_ODDS_LOCK:
        now = time.monotonic()
        cached = NBA_ODDS_CACHE.get("latest")
        if cached and cached["expires_at"] > now:
            return cached["snapshot"]

        api_key = os.environ.get("THE_ODDS_API_KEY", "").strip()
        if not api_key:
            return {
                "status": "unavailable",
                "source": "The Odds API",
                "last_updated": None,
                "message": "Live odds are not configured. Add THE_ODDS_API_KEY to the API deployment environment.",
                "events": [],
            }

        query = urlencode({
            "apiKey": api_key,
            "regions": "us",
            "markets": "h2h",
            "oddsFormat": "american",
            "dateFormat": "iso",
        })
        request = Request(
            f"https://api.the-odds-api.com/v4/sports/basketball_nba/odds?{query}",
            headers={"Accept": "application/json", "User-Agent": "NBAHubOdds/1.0"},
        )
        try:
            with urlopen(request, timeout=10) as response:
                payload = json.loads(response.read().decode("utf-8"))
                events = _normalize_odds_events(payload)
                snapshot = {
                    "status": "fresh",
                    "source": "The Odds API",
                    "last_updated": datetime.now(timezone.utc).isoformat(),
                    "requests_remaining": response.headers.get("x-requests-remaining"),
                    "message": (
                        "No upcoming NBA moneyline odds have been published yet."
                        if not events
                        else ""
                    ),
                    "events": events,
                }
                NBA_ODDS_CACHE["latest"] = {
                    "expires_at": now + NBA_ODDS_CACHE_TTL_SECONDS,
                    "snapshot": snapshot,
                }
                return snapshot
        except (HTTPError, URLError, TimeoutError, OSError, UnicodeDecodeError, json.JSONDecodeError, ValueError) as error:
            if isinstance(error, HTTPError):
                logger.warning("The Odds API request failed with HTTP %s.", error.code)
                failure_message = f"The Odds API request failed (HTTP {error.code})."
            else:
                logger.warning("The Odds API request could not be completed (%s).", type(error).__name__)
                failure_message = "The Odds API could not be reached or returned invalid data."
            previous = cached["snapshot"] if cached else None
            if previous and previous.get("events"):
                return {
                    **previous,
                    "status": "stale",
                    "message": f"{failure_message} Showing the last successful odds snapshot.",
                }
            return {
                "status": "unavailable",
                "source": "The Odds API",
                "last_updated": None,
                "message": failure_message,
                "events": [],
            }


def build_teams_response() -> dict:
    try:
        sync_supabase_nba_catalog()
    except Exception as exc:  # pragma: no cover - catalog sync is optional
        logger.warning("Optional Supabase catalog sync failed during teams response build: %s", exc)

    stats_snapshot = fetch_current_nba_player_stats()
    roster_snapshot = fetch_current_nba_rosters()
    response_teams = json.loads(json.dumps(roster_snapshot["teams"] or teams))
    season = stats_snapshot["season"]
    current_season_stat_fields = (
        "gp", "pts", "reb", "ast", "stl", "blk", "tov", "fg", "fg3", "ft"
    )
    for team in response_teams:
        team_players = team.get("starters_2026_27", []) + team.get("bench_2026_27", [])
        for player in team_players:
            live_stats = stats_snapshot["players"].get(
                normalize_player_name(player["name"])
            )
            player["stats_season"] = season
            player["stats_status"] = stats_snapshot["status"]
            for field in current_season_stat_fields:
                player[field] = live_stats.get(field) if live_stats else None

        featured_player = next(
            (
                player for player in team_players
                if normalize_player_name(player["name"])
                == normalize_player_name(team["featured_star"])
            ),
            None,
        )
        if (
            featured_player
            and featured_player.get("stats_status") in ("fresh", "stale")
            and stats_snapshot["players"].get(
                normalize_player_name(featured_player["name"])
            )
        ):
            points = featured_player.get("pts")
            rebounds = featured_player.get("reb")
            team["headline_stat"] = (
                f"{points:.1f} PPG, {rebounds:.1f} RPG"
                if isinstance(points, (int, float))
                and isinstance(rebounds, (int, float))
                else f"{season} stats available"
            )
        elif stats_snapshot["status"] == "pending":
            team["headline_stat"] = f"{season} stats pending"
        else:
            team["headline_stat"] = f"{season} stats unavailable"

    return {
        "count": len(response_teams),
        "teams": response_teams,
        "stats": {key: value for key, value in stats_snapshot.items() if key != "players"},
        "roster": {key: value for key, value in roster_snapshot.items() if key != "teams"},
    }


@app.get("/api/v1/database/catalog", dependencies=[Depends(verify_api_key)])
def get_database_catalog():
    if not supabase_cache_available():
        raise HTTPException(status_code=503, detail="Supabase is not configured for NBA catalog storage.")
    try:
        teams_rows = supabase_rest_request("nba_teams?select=id,name,abbreviation,conference,division,metadata")
        players_rows = supabase_rest_request("nba_players?select=id,team_id,name,position,metadata")
        return {
            "status": "fresh",
            "teams": teams_rows if isinstance(teams_rows, list) else [],
            "players": players_rows if isinstance(players_rows, list) else [],
        }
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - database read failure is surfaced to caller
        logger.warning("Supabase NBA catalog read failed: %s", exc)
        raise HTTPException(status_code=502, detail="Supabase could not load the NBA catalog.") from exc


@app.get("/api/v1/teams/search", dependencies=[Depends(verify_api_key)])
def search_teams(q: str = Query(..., min_length=1)):
    query = q.lower()
    results = []
    team_data = build_teams_response()
    for team in team_data["teams"]:
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
        "results": results,
        "stats": team_data["stats"],
        "roster": team_data["roster"],
    }

@app.get("/api/v1/teams", dependencies=[Depends(verify_api_key)])
def get_teams():
    return build_teams_response()

@app.get("/api/v1/schedule", dependencies=[Depends(verify_api_key)])
def get_schedule(season: Optional[str] = Query(default=None)):
    return fetch_current_nba_schedule(season)

@app.get("/api/v1/schedule/scores", dependencies=[Depends(verify_api_key)])
def get_schedule_scores():
    return fetch_current_nba_scores()

def _normalize_espn_nba_news_item(article: dict, fallback_now_iso: str):
    if not isinstance(article, dict):
        return None
    headline = str(article.get("headline") or "").strip()
    description = str(article.get("description") or "").strip()
    if not headline:
        return None
    story = description or headline
    if not story:
        return None
    image_url = ""
    for image in article.get("images") or []:
        if isinstance(image, dict) and image.get("url"):
            image_url = str(image["url"])
            break
    link_payload = article.get("links") or {}
    href = ""
    if isinstance(link_payload, dict):
        href = str((link_payload.get("web") or {}).get("href") or (link_payload.get("mobile") or {}).get("href") or "")
    category = "NBA NEWS"
    categories = article.get("categories") or []
    if isinstance(categories, list):
        for category_data in categories:
            if isinstance(category_data, dict) and category_data.get("description"):
                category = str(category_data["description"]).strip() or category
                break
    return {
        "headline": headline,
        "story": story,
        "source": "ESPN",
        "category": category,
        "url": href or "https://www.espn.com/nba/",
        "published": article.get("published") or article.get("lastModified") or fallback_now_iso,
        "kind": "story",
        "teamName": article.get("teamName") or "NBA",
        "teamLogo": image_url,
    }


def fetch_live_espn_nba_news(limit: int = 6):
    endpoint = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news"
    request = Request(
        endpoint,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; NBA Hub/1.0; +https://github.com/)",
            "Accept": "application/json",
        },
    )
    with urlopen(request, timeout=15) as response:
        payload = json.loads(response.read().decode("utf-8"))
    articles = payload.get("articles") or []
    normalized = []
    fallback_now_iso = datetime.now(timezone.utc).isoformat()
    for article in articles:
        item = _normalize_espn_nba_news_item(article, fallback_now_iso)
        if item:
            normalized.append(item)
        if len(normalized) >= limit:
            break
    if not normalized:
        return []
    daily_offset = int(datetime.now(timezone.utc).strftime("%Y%m%d")) % len(normalized)
    if len(normalized) > 1:
        normalized = normalized[daily_offset:] + normalized[:daily_offset]
    return normalized


@app.get("/api/v1/news", dependencies=[Depends(verify_api_key)])
def get_nba_news():
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        items = fetch_live_espn_nba_news(limit=6)
        if items:
            last_updated = max(item.get("published") or now_iso for item in items)
            return {
                "status": "fresh",
                "source": "ESPN",
                "last_updated": last_updated,
                "message": "NBA live headlines are provided by ESPN and rotate with the current daily feed.",
                "items": items,
            }
    except Exception as exc:  # pragma: no cover - fallback when live fetch fails
        logger.warning("ESPN NBA news fetch failed; using scoreboard fallback: %s", exc)

    try:
        scoreboard = fetch_current_nba_scores()
        games = scoreboard.get("games") or []
        items = []
        for game in games[:6]:
            if not isinstance(game, dict):
                continue
            home_tricode = str(game.get("home_tricode") or "").strip()
            away_tricode = str(game.get("away_tricode") or "").strip()
            home_score = game.get("home_score")
            away_score = game.get("away_score")
            status = str(game.get("status") or "").strip() or "NBA game"
            if not home_tricode or not away_tricode:
                continue
            if status.lower() == "scheduled":
                headline = f"{away_tricode} at {home_tricode} · {status}"
                story = f"{away_tricode} visits {home_tricode} on the next NBA slate. Follow the live box score and team notes throughout the night."
                kind = "story"
            elif status.lower() == "final":
                home_int = home_score if isinstance(home_score, (int, float)) else 0
                away_int = away_score if isinstance(away_score, (int, float)) else 0
                headline = f"{home_tricode} {int(home_int)}-{int(away_int)} {away_tricode}"
                story = f"{home_tricode} closed out against {away_tricode} in the latest NBA result. Check the full scoreboard for the night’s key storylines."
                kind = "score"
            else:
                headline = f"{home_tricode} lead {away_tricode} · {status}"
                story = f"{home_tricode} and {away_tricode} are battling live. Keep an eye on the scoreboard for momentum swings and late-game adjustments."
                kind = "score"
            items.append({
                "headline": headline,
                "story": story,
                "source": "ESPN",
                "category": "Game day",
                "url": "https://www.espn.com/nba/",
                "published": scoreboard.get("last_updated") or now_iso,
                "kind": kind,
                "teamName": home_tricode,
            })
        if not items:
            items.append({
                "headline": "NBA scores and storylines are updating live",
                "story": "Check the scoreboard, standings, and team pages for the latest league updates.",
                "source": "NBA Hub",
                "category": "League",
                "url": "https://www.espn.com/nba/",
                "published": now_iso,
                "kind": "story",
            })
        return {
            "status": "fresh" if items else "stale",
            "source": "ESPN",
            "last_updated": scoreboard.get("last_updated") or now_iso,
            "message": scoreboard.get("message") or "NBA live headlines and score highlights are available.",
            "items": items,
        }
    except Exception as exc:  # pragma: no cover - fallback when live fetch fails
        logger.warning("NBA news fallback triggered: %s", exc)
        return {
            "status": "stale",
            "source": "NBA Hub",
            "last_updated": now_iso,
            "message": "Live headlines are unavailable. Showing the latest NBA Hub fallback feed.",
            "items": [{
                "headline": "NBA headlines are temporarily unavailable",
                "story": "Live scores and standings remain available below while the league feed refreshes.",
                "source": "NBA Hub",
                "category": "League",
                "url": "https://www.espn.com/nba/",
                "published": now_iso,
                "kind": "story",
            }],
        }

NBA_INJURY_TEAM_NAMES = [
    "Atlanta Hawks",
    "Boston Celtics",
    "Brooklyn Nets",
    "Charlotte Hornets",
    "Chicago Bulls",
    "Cleveland Cavaliers",
    "Dallas Mavericks",
    "Denver Nuggets",
    "Detroit Pistons",
    "Golden State Warriors",
    "Houston Rockets",
    "Indiana Pacers",
    "Los Angeles Clippers",
    "Los Angeles Lakers",
    "Memphis Grizzlies",
    "Miami Heat",
    "Milwaukee Bucks",
    "Minnesota Timberwolves",
    "New Orleans Pelicans",
    "New York Knicks",
    "Oklahoma City Thunder",
    "Orlando Magic",
    "Philadelphia 76ers",
    "Phoenix Suns",
    "Portland Trail Blazers",
    "Sacramento Kings",
    "San Antonio Spurs",
    "Toronto Raptors",
    "Utah Jazz",
    "Washington Wizards",
]


@app.get("/api/v1/injuries", dependencies=[Depends(verify_api_key)])
def get_nba_injuries():
    now_iso = datetime.now(timezone.utc).isoformat()
    all_teams = {team_name: [] for team_name in NBA_INJURY_TEAM_NAMES}
    try:
        endpoint = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries"
        request = Request(
            endpoint,
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; NBA Hub/1.0; +https://github.com/)",
                "Accept": "application/json",
            },
        )
        with urlopen(request, timeout=15) as response:
            payload = json.loads(response.read().decode("utf-8"))

        for team_entry in payload.get("injuries") or []:
            if not isinstance(team_entry, dict):
                continue
            team_name = str(team_entry.get("displayName") or "").strip()
            if not team_name:
                continue
            players = []
            for item in team_entry.get("injuries") or []:
                if not isinstance(item, dict):
                    continue
                athlete = item.get("athlete") or {}
                name = str(
                    athlete.get("displayName")
                    or athlete.get("fullName")
                    or athlete.get("shortName")
                    or "Player"
                ).strip()
                if not name:
                    continue
                status = str(item.get("status") or "Unknown").strip() or "Unknown"
                note = str(item.get("shortComment") or item.get("longComment") or status).strip() or status
                players.append({
                    "player": name,
                    "status": status,
                    "note": note,
                    "date": item.get("date") or now_iso,
                })
            if team_name in all_teams:
                all_teams[team_name] = players
            else:
                all_teams[team_name] = players

        team_rows = [{"team": team_name, "players": all_teams[team_name]} for team_name in NBA_INJURY_TEAM_NAMES]
        return {
            "status": "fresh",
            "source": "ESPN",
            "last_updated": payload.get("timestamp") or now_iso,
            "message": "Live NBA injury notes are provided by ESPN.",
            "teams": team_rows,
        }
    except Exception as exc:  # pragma: no cover - live injury fallback when ESPN is unavailable
        logger.warning("ESPN NBA injury feed failed; returning all teams without live injuries: %s", exc)

    return {
        "status": "stale",
        "source": "ESPN",
        "last_updated": now_iso,
        "message": "The ESPN injury report is temporarily unavailable. Check back shortly for the latest availability updates.",
        "teams": [{"team": team_name, "players": []} for team_name in NBA_INJURY_TEAM_NAMES],
    }

@app.get("/api/v1/odds", dependencies=[Depends(verify_api_key)])
def get_nba_odds():
    return fetch_current_nba_odds()

@app.get("/api/v1/standings", dependencies=[Depends(verify_api_key)])
def get_standings(
    season_type: Literal["preseason", "regular"] = Query(default="regular"),
    season: Optional[str] = Query(default=None),
):
    return fetch_current_nba_standings(season_type, season)

@app.get("/api/v1/games/{game_id}/boxscore", dependencies=[Depends(verify_api_key)])
def get_game_box_score(game_id: str, season: Optional[str] = Query(default=None)):
    return fetch_nba_box_score(game_id, season)

@app.get("/api/v1/games/{game_id}/play-by-play", dependencies=[Depends(verify_api_key)])
def get_game_play_by_play(game_id: str, season: Optional[str] = Query(default=None)):
    return fetch_nba_play_by_play(game_id, season)

@app.get("/api/v1/games/{game_id}/jerseys", dependencies=[Depends(verify_api_key)])
def get_game_box_score_jersey_numbers(
    game_id: str, season: Optional[str] = Query(default=None)
):
    return fetch_nba_box_score_jersey_numbers(game_id, season)

@app.get("/api/v1/transactions", dependencies=[Depends(verify_api_key)])
def get_transactions():
    return fetch_current_nba_transactions()

@app.get("/api/v1/teams/{team_id}", dependencies=[Depends(verify_api_key)])
def get_team(team_id: int):
    response = build_teams_response()
    for team in response["teams"]:
        if team["id"] == team_id:
            team["stats_update"] = response["stats"]
            team["roster_update"] = response["roster"]
            return team
    raise HTTPException(status_code=404, detail="Team not found.")

@app.get("/api/v1/community-challenges", dependencies=[Depends(verify_api_key)])
def get_community_challenges():
    result = supabase_rest_request(
        "community_challenges?select=id,title,description,creator,rule_type,selected_player_ids,created_at"
        "&order=created_at.desc&limit=100"
    )
    if not isinstance(result, list):
        raise HTTPException(status_code=502, detail="Community challenge storage returned an unexpected response.")
    return {"count": len(result), "challenges": result}

@app.post("/api/v1/community-challenges", dependencies=[Depends(verify_api_key)], status_code=201)
def create_community_challenge(challenge: CommunityChallengeCreate):
    if len(set(challenge.selected_player_ids)) != len(challenge.selected_player_ids):
        raise HTTPException(status_code=422, detail="Selected player IDs must be unique.")
    valid_player_ids = {
        f"{team['id']}:{player['name'].lower()}"
        for team in teams
        for player in team["starters_2026_27"] + team["bench_2026_27"]
    }
    if any(player_id not in valid_player_ids for player_id in challenge.selected_player_ids):
        raise HTTPException(status_code=422, detail="One or more selected player IDs are not in the NBA player pool.")
    result = supabase_rest_request(
        "community_challenges",
        method="POST",
        payload=challenge.model_dump()
    )
    if not isinstance(result, list) or not result:
        raise HTTPException(status_code=502, detail="Community challenge was not saved.")
    return result[0]

@app.get("/teams")
def get_teams_legacy():
    response = build_teams_response()
    return {"teams": response["teams"], "stats": response["stats"], "roster": response["roster"]}

@app.get("/api/v1/player-career", dependencies=[Depends(verify_api_key)])
def get_player_career(player_id: int = Query(..., ge=1), player_name: str = Query(default="")):
    """Fetch the ESPN player stats page and return a season-by-season career summary."""
    try:
        request = Request(
            f"https://www.espn.com/nba/player/stats/_/id/{player_id}",
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; NBA Hub/1.0; +https://github.com/)",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
        )
        with urlopen(request, timeout=20) as response:
            page_html = response.read().decode("utf-8", errors="ignore")
    except (HTTPError, URLError, TimeoutError, OSError) as exc:
        logger.warning("ESPN player career fetch failed for id %s: %s", player_id, exc)
        return {
            "status": "unavailable",
            "source": "ESPN",
            "player_id": player_id,
            "player_name": player_name,
            "history": [],
            "message": "Player career stats are unavailable right now.",
        }

    rows = re.findall(r"<tr[^>]*>(.*?)</tr>", page_html, re.S | re.I)
    season_labels = []
    season_teams = {}
    for row in rows:
        cells = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, re.S | re.I)
        values = []
        for cell in cells:
            text = re.sub(r"<.*?>", " ", cell)
            text = html_lib.unescape(text)
            values.append(" ".join(text.split()))
        values = [value for value in values if value]
        if not values:
            continue
        if re.fullmatch(r"\d{4}-\d{2}", values[0]):
            season_labels.append(values[0])
            season_teams[values[0]] = values[1] if len(values) > 1 else ""

    stat_rows = []
    header_seen = False
    for row in rows:
        if "GP" in row and "PTS" in row and "Table__TH" in row:
            header_seen = True
            continue
        if not header_seen:
            continue
        cells = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, re.S | re.I)
        values = []
        for cell in cells:
            text = re.sub(r"<.*?>", " ", cell)
            text = html_lib.unescape(text)
            values.append(" ".join(text.split()))
        values = [value for value in values if value]
        if not values:
            continue
        first = values[0]
        if first.lower() == "career":
            continue
        if not re.fullmatch(r"\d{1,3}", first) and not re.fullmatch(r"\d{1,3}\.\d", first):
            continue
        stat_rows.append(values)

    if not season_labels or not stat_rows:
        return {
            "status": "fresh",
            "source": "ESPN",
            "player_id": player_id,
            "player_name": player_name,
            "history": [],
            "message": "No career history was found for this player.",
        }

    ordered_stat_rows = list(reversed(stat_rows[-len(season_labels):]))
    history = []
    for season_name, row in zip(season_labels, ordered_stat_rows):
        if len(row) < 18:
            continue
        try:
            history.append({
                "season": season_name,
                "team": season_teams.get(season_name, ""),
                "gp": int(row[0]) if row[0].isdigit() else None,
                "gs": int(row[1]) if len(row) > 1 and row[1].isdigit() else None,
                "min": float(row[2]) if len(row) > 2 and row[2] not in ("", "-") else None,
                "fg": row[3] if len(row) > 3 else None,
                "fg_pct": float(row[4]) if len(row) > 4 and row[4] not in ("", "-") else None,
                "fg3": row[5] if len(row) > 5 else None,
                "fg3_pct": float(row[6]) if len(row) > 6 and row[6] not in ("", "-") else None,
                "ft": row[7] if len(row) > 7 else None,
                "ft_pct": float(row[8]) if len(row) > 8 and row[8] not in ("", "-") else None,
                "reb": float(row[11]) if len(row) > 11 and row[11] not in ("", "-") else None,
                "ast": float(row[12]) if len(row) > 12 and row[12] not in ("", "-") else None,
                "blk": float(row[13]) if len(row) > 13 and row[13] not in ("", "-") else None,
                "stl": float(row[14]) if len(row) > 14 and row[14] not in ("", "-") else None,
                "tov": float(row[16]) if len(row) > 16 and row[16] not in ("", "-") else None,
                "pts": float(row[17]) if len(row) > 17 and row[17] not in ("", "-") else None,
            })
        except ValueError:
            continue

    return {
        "status": "fresh",
        "source": "ESPN",
        "player_id": player_id,
        "player_name": player_name or None,
        "history": history,
    }

@app.get("/api/v1/health")
def health_check_v1():
    return health_check()

@app.post("/api/community-challenges")
def create_challenge(payload: CommunityChallengeCreate, authorized: bool = Depends(verify_api_key)):
    try:
        result = supabase_rest_request(
            "community_challenges",
            method="POST",
            payload=payload.model_dump(),
        )
        if not isinstance(result, list) or not result:
            raise HTTPException(status_code=502, detail="Community challenge was not saved.")
        return {"status": "success", "data": result[0]}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Supabase insert failed: %s", exc)
        raise HTTPException(status_code=500, detail="Database insert error") from exc

@app.get("/api/community-challenges")
def list_challenges(authorized: bool = Depends(verify_api_key)):
    try:
        result = supabase_rest_request(
            "community_challenges?select=id,title,description,creator,rule_type,selected_player_ids,created_at&order=created_at.desc&limit=20"
        )
        if not isinstance(result, list):
            raise HTTPException(status_code=502, detail="Community challenge storage returned an unexpected response.")
        return {"status": "success", "challenges": result}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Supabase query failed: %s", exc)
        raise HTTPException(status_code=500, detail="Database query error") from exc

FRONTEND_ROOT = Path(__file__).resolve().parent.parent
FRONTEND_ASSETS = {
    filename: FRONTEND_ROOT / filename
    for filename in (
        "app.js",
        "cap-space-manager.css",
        "cap-space-manager.html",
        "cap-space-manager.js",
        "index.html",
        "nba-player-ids.js",
        "player-headshots.js",
        "style.css",
        "trade-machine.css",
        "trade-machine.html",
        "trade-machine.js",
    )
}


@app.get("/", include_in_schema=False)
def serve_frontend():
    return FileResponse(FRONTEND_ASSETS["index.html"])


@app.get("/{asset_name}", include_in_schema=False)
def serve_frontend_asset(asset_name: str):
    asset_path = FRONTEND_ASSETS.get(asset_name)
    if asset_path is None or not asset_path.is_file():
        raise HTTPException(status_code=404, detail="Not Found")
    return FileResponse(asset_path)
