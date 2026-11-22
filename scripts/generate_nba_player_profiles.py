import argparse
import concurrent.futures
import datetime as dt
import json
import random
import re
import threading
import time
import unicodedata
from html.parser import HTMLParser
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PLAYER_IDS_PATH = ROOT / "nba-player-ids.js"
CURRENT_STATS_PATH = ROOT / "api" / "data" / "nba_player_stats_20261120.json"
OUTPUT_PATH = ROOT / "api" / "data" / "nba_player_profiles_20261122.json"
MIGRATION_PATH = ROOT / "supabase" / "migrations" / "20261122_nba_player_profiles.sql"
SETUP_PATH = ROOT / "SUPABASE_COMPLETE_SETUP.sql"
ESPN_API_URL = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba"
NBA_SOURCE = "Basketball-Reference"
ESPN_SOURCE = "ESPN NBA roster contract feed"
BREF_ROOT = "https://www.basketball-reference.com"
SNAPSHOT_MARKER_START = "-- BEGIN STATIC NBA PLAYER PROFILE SNAPSHOT"
SNAPSHOT_MARKER_END = "-- END STATIC NBA PLAYER PROFILE SNAPSHOT"
ESPN_HEADERS = {
    "Accept": "application/json",
    "User-Agent": "NBAHubStaticSnapshot/1.0",
}
BREF_HEADERS = {
    "Accept": "text/html,application/xhtml+xml",
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
}
BREF_REQUEST_LOCK = threading.Lock()
BREF_RATE_LIMITED = threading.Event()


def normalize_name(value: str) -> str:
    return "".join(
        character
        for character in unicodedata.normalize("NFKD", value).casefold()
        if character.isalnum()
    )


def read_json(path: Path) -> dict:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"{path.name} must contain a JSON object.")
    return value


class BasketballReferenceTableParser(HTMLParser):
    def __init__(self, table_id: str):
        super().__init__()
        self.table_id = table_id
        self.in_table = False
        self.row = None
        self.cell = None
        self.rows = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        if tag == "table" and attributes.get("id") == self.table_id:
            self.in_table = True
        elif self.in_table and tag == "tr":
            self.row = {}
        elif self.in_table and tag in ("td", "th") and self.row is not None:
            self.cell = (attributes.get("data-stat"), [])

    def handle_data(self, data: str) -> None:
        if self.cell is not None:
            self.cell[1].append(data)

    def handle_comment(self, data: str) -> None:
        if self.rows:
            return
        comment_parser = BasketballReferenceTableParser(self.table_id)
        comment_parser.feed(data)
        self.rows.extend(comment_parser.rows)

    def handle_endtag(self, tag: str) -> None:
        if self.in_table and tag in ("td", "th") and self.cell is not None:
            key, parts = self.cell
            if key and self.row is not None:
                self.row[key] = "".join(parts).strip()
            self.cell = None
        elif self.in_table and tag == "tr" and self.row is not None:
            if self.row:
                self.rows.append(self.row)
            self.row = None
        elif tag == "table" and self.in_table:
            self.in_table = False


def bref_table(url: str, table_id: str) -> list[dict]:
    last_error = None
    for attempt in range(4):
        request = urllib.request.Request(url, headers=BREF_HEADERS)
        try:
            with BREF_REQUEST_LOCK:
                if BREF_RATE_LIMITED.is_set():
                    raise RuntimeError(
                        "Basketball-Reference rate-limited this run; wait before retrying the snapshot."
                    )
                try:
                    with urllib.request.urlopen(request, timeout=30) as response:
                        html = response.read().decode("utf-8", "replace")
                finally:
                    time.sleep(1.4)
            parser = BasketballReferenceTableParser(table_id)
            parser.feed(html)
            if not parser.rows:
                raise ValueError(f"{url} contained no {table_id} rows.")
            return parser.rows
        except urllib.error.HTTPError as error:
            if error.code == 404:
                raise
            if error.code == 429:
                BREF_RATE_LIMITED.set()
                raise RuntimeError(
                    "Basketball-Reference returned HTTP 429; wait before retrying the snapshot."
                ) from error
            last_error = error
            if attempt == 3:
                raise
        except (urllib.error.URLError, TimeoutError, OSError, UnicodeDecodeError, ValueError) as error:
            last_error = error
            if attempt == 3:
                raise
        time.sleep((1.5 ** attempt) + random.uniform(0.1, 0.5))
    raise RuntimeError(f"Could not read the Basketball-Reference table at {url}.") from last_error


def canonical_person_key(value: str) -> str:
    key = normalize_name(value)
    for suffix in ("junior", "senior", "iii", "ii", "iv", "jr", "sr"):
        if key.endswith(suffix) and len(key) > len(suffix):
            return key[:-len(suffix)]
    return key


def active_key_for_name(value: str, active_keys: set[str], aliases: dict[str, list[str]]) -> str | None:
    key = normalize_name(value)
    if key in active_keys:
        return key
    candidates = aliases.get(canonical_person_key(value), [])
    return candidates[0] if len(candidates) == 1 else None


def build_active_aliases(active_keys: set[str]) -> dict[str, list[str]]:
    aliases: dict[str, list[str]] = {}
    for key in active_keys:
        aliases.setdefault(canonical_person_key(key), []).append(key)
    return aliases


def fetch_bref_player_directory(active_keys: set[str], workers: int) -> dict[str, dict]:
    aliases = build_active_aliases(active_keys)
    urls = [
        (f"{BREF_ROOT}/players/{letter}/", "players")
        for letter in "abcdefghijklmnopqrstuvwxyz"
    ]
    directory = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(bref_table, url, table_id): url
            for url, table_id in urls
        }
        for future in concurrent.futures.as_completed(futures):
            rows = future.result()
            for row in rows:
                name = str(row.get("player") or "").strip()
                key = active_key_for_name(name, active_keys, aliases)
                if key is None:
                    continue
                directory[key] = {
                    "from_year": row.get("year_min"),
                    "to_year": row.get("year_max"),
                    "player_name": name,
                }
    return directory


def parse_stat_value(value: object) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(str(value).replace(",", ""))
    except (TypeError, ValueError):
        return None


def normalize_bref_row(row: dict, year: int, postseason: bool, totals: bool) -> dict:
    suffix = "" if totals else "_per_g"
    gp_key = "g" if postseason else "games"
    gs_key = "gs" if postseason else "games_started"
    team_key = "team_id" if postseason else "team_name_abbr"
    name_key = "player" if postseason else "name_display"

    def value(column: str):
        return parse_stat_value(row.get(f"{column}{suffix}"))

    return {
        "season": f"{year - 1}-{str(year)[-2:]}",
        "team": str(row.get(team_key) or ""),
        "gp": parse_stat_value(row.get(gp_key)),
        "gs": parse_stat_value(row.get(gs_key)),
        "min": value("mp"),
        "fgm": value("fg"),
        "fga": value("fga"),
        "fg_pct": parse_stat_value(row.get("fg_pct")),
        "fg3": value("fg3"),
        "fg3a": value("fg3a"),
        "fg3_pct": parse_stat_value(row.get("fg3_pct")),
        "fg2": value("fg2"),
        "fg2a": value("fg2a"),
        "fg2_pct": parse_stat_value(row.get("fg2_pct")),
        "efg_pct": parse_stat_value(row.get("efg_pct")),
        "ftm": value("ft"),
        "fta": value("fta"),
        "ft_pct": parse_stat_value(row.get("ft_pct")),
        "oreb": value("orb"),
        "dreb": value("drb"),
        "reb": value("trb"),
        "ast": value("ast"),
        "stl": value("stl"),
        "blk": value("blk"),
        "tov": value("tov"),
        "pf": value("pf"),
        "pts": value("pts"),
        "plus_minus": parse_stat_value(row.get("plus_minus")),
        "double_doubles": parse_stat_value(row.get("dd2")),
        "triple_doubles": parse_stat_value(row.get("tpl_dbl")),
        "_player_name": str(row.get(name_key) or ""),
    }


def fetch_bref_season_stats(
    active_keys: set[str],
    current_year: int,
    first_year: int,
    workers: int,
) -> tuple[dict[str, dict], list[dict]]:
    aliases = build_active_aliases(active_keys)
    requests = []
    for year in range(first_year, current_year + 1):
        requests.append(
            (year, "regular", f"{BREF_ROOT}/leagues/NBA_{year}_totals.html", "totals_stats")
        )
        if year < current_year:
            requests.append(
                (year, "postseason", f"{BREF_ROOT}/playoffs/NBA_{year}_totals.html", "totals_stats")
            )

    stats_by_key = {
        key: {
            "history": [],
            "postseason": [],
            "history_totals": [],
            "postseason_totals": [],
            "raw": {
                "regular_totals": [],
                "postseason_totals": [],
            },
        }
        for key in active_keys
    }
    failures = []
    completed = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(bref_table, url, table_id): (year, season_type, url)
            for year, season_type, url, table_id in requests
        }
        for future in concurrent.futures.as_completed(futures):
            year, season_type, url = futures[future]
            try:
                rows = future.result()
                for row in rows:
                    player_name = str(row.get("player") or row.get("name_display") or "").strip()
                    key = active_key_for_name(player_name, active_keys, aliases)
                    if key is None:
                        continue
                    normalized = normalize_bref_row(
                        row,
                        year,
                        postseason=season_type == "postseason",
                        totals=True,
                    )
                    bucket_key = (
                        "postseason_totals" if season_type == "postseason"
                        else "history_totals"
                    )
                    game_row = dict(normalized)
                    games = normalized.get("gp")
                    for field in (
                        "min", "fgm", "fga", "fg3", "fg3a", "fg2", "fg2a", "ftm",
                        "fta", "oreb", "dreb", "reb", "ast", "stl", "blk", "tov",
                        "pf", "pts",
                    ):
                        value = normalized.get(field)
                        game_row[field] = (
                            value / games
                            if isinstance(value, (int, float)) and games
                            else None
                        )
                    game_row["plus_minus"] = None
                    bucket_per_game = "postseason" if season_type == "postseason" else "history"
                    raw_key = f"{season_type}_totals"
                    stats_by_key[key][bucket_key].append(normalized)
                    stats_by_key[key][bucket_per_game].append(game_row)
                    stats_by_key[key]["raw"][raw_key].append(row)
            except urllib.error.HTTPError as error:
                failures.append({"url": url, "error": f"HTTP {error.code}"})
            except Exception as error:
                failures.append({"url": url, "error": f"{type(error).__name__}: {error}"})
            completed += 1
            if completed % 10 == 0 or completed == len(requests):
                print(f"Downloaded {completed}/{len(requests)} Basketball-Reference season tables.", flush=True)
    return stats_by_key, failures


def total_rows_for_career(rows: list[dict]) -> list[dict]:
    rows_by_season = {}
    for row in rows:
        rows_by_season.setdefault(row["season"], []).append(row)
    result = []
    for season_rows in rows_by_season.values():
        total_rows = [
            row for row in season_rows
            if re.fullmatch(r"(?:TOT|(?:\d+)?TM)", str(row.get("team") or "").upper())
        ]
        result.extend(total_rows if total_rows else season_rows)
    return result


def aggregate_career_totals(rows: list[dict]) -> tuple[dict, dict]:
    rows = total_rows_for_career(rows)
    sum_fields = (
        "gp", "gs", "min", "fgm", "fga", "fg3", "fg3a", "fg2", "fg2a", "ftm",
        "fta", "oreb", "dreb", "reb", "ast", "stl", "blk", "tov", "pf", "pts",
        "plus_minus", "double_doubles", "triple_doubles",
    )
    totals = {}
    for field in sum_fields:
        values = [
            float(row[field]) for row in rows
            if isinstance(row.get(field), (int, float))
        ]
        totals[field] = sum(values) if values else None
    totals["fg_pct"] = totals["fgm"] / totals["fga"] if totals["fga"] and totals["fgm"] is not None else None
    totals["fg3_pct"] = totals["fg3"] / totals["fg3a"] if totals["fg3a"] and totals["fg3"] is not None else None
    totals["fg2_pct"] = totals["fg2"] / totals["fg2a"] if totals["fg2a"] and totals["fg2"] is not None else None
    totals["efg_pct"] = (
        (totals["fgm"] + 0.5 * totals["fg3"]) / totals["fga"]
        if totals["fga"] and totals["fgm"] is not None and totals["fg3"] is not None else None
    )
    totals["ft_pct"] = totals["ftm"] / totals["fta"] if totals["fta"] and totals["ftm"] is not None else None

    games = totals["gp"]
    averages = {
        field: totals[field] / games if games and totals[field] is not None else None
        for field in sum_fields
    }
    for field in ("fg_pct", "fg3_pct", "fg2_pct", "efg_pct", "ft_pct"):
        averages[field] = totals[field]
    return totals, averages


def build_bref_career_payload(
    player: dict,
    stats: dict,
    directory: dict | None,
    as_of: str,
) -> dict:
    history = sorted(stats["history"], key=lambda row: (row["season"], row["team"]))
    postseason = sorted(stats["postseason"], key=lambda row: (row["season"], row["team"]))
    regular_totals, career = aggregate_career_totals(stats["history_totals"])
    playoff_totals, postseason_career = aggregate_career_totals(stats["postseason_totals"])
    teams = list(dict.fromkeys(
        row["team"] for row in history
        if row.get("team") and not re.fullmatch(r"(?:TOT|(?:\d+)?TM)", row["team"].upper())
    ))
    has_career = bool(history or postseason)
    return {
        "status": "fresh" if has_career else "unavailable",
        "source": NBA_SOURCE,
        "source_url": BREF_ROOT,
        "data_as_of": as_of,
        "player_id": player.get("nba_player_id"),
        "player_name": player["player_name"],
        "history": history,
        "history_totals": stats["history_totals"],
        "postseason": postseason,
        "postseason_totals": stats["postseason_totals"],
        "career": career,
        "career_totals": regular_totals,
        "postseason_career": postseason_career,
        "postseason_career_totals": playoff_totals,
        "profile": {
            "from_year": directory.get("from_year") if directory else None,
            "to_year": directory.get("to_year") if directory else None,
        },
        "awards": [],
        "teams": teams,
        "all_star": {},
        "college": {},
        "raw": stats["raw"],
        "details_status": "partial",
        "details_message": (
            "This static snapshot contains season box-score tables; detailed biography, awards, and plus-minus "
            "are not supplied by those tables."
        ),
        "message": (
            "Season per-game values are calculated from Basketball-Reference's season-total tables. "
            "Plus-minus, detailed biography, and full award records are not included in this source snapshot."
            if has_career
            else "No Basketball-Reference season rows were found for this player; no statistics were invented."
        ),
    }


def read_player_ids() -> dict[str, int]:
    source = PLAYER_IDS_PATH.read_text(encoding="utf-8")
    match = re.search(
        r"window\.NBA_PLAYER_IDS\s*=\s*Object\.freeze\((\{.*?\})\);",
        source,
        re.DOTALL,
    )
    if not match:
        raise ValueError("Could not read the NBA player ID map.")
    parsed = json.loads(match.group(1))
    return {
        str(key): int(value)
        for key, value in parsed.items()
        if str(value).isdigit()
    }


def request_json(url: str, headers: dict[str, str], timeout: float = 18) -> dict:
    last_error = None
    for attempt in range(4):
        request = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                payload = json.loads(response.read().decode("utf-8"))
            if not isinstance(payload, dict):
                raise ValueError(f"Unexpected JSON response from {url}")
            return payload
        except urllib.error.HTTPError as error:
            last_error = error
            if error.code not in (408, 425, 429, 500, 502, 503, 504) or attempt == 3:
                raise
        except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError) as error:
            last_error = error
            if attempt == 3:
                raise
        time.sleep((1.5 ** attempt) + random.uniform(0.1, 0.6))
    raise RuntimeError("Request retries were exhausted.") from last_error


def espn_request(path: str) -> dict:
    return request_json(f"{ESPN_API_URL}/{path.lstrip('/')}", ESPN_HEADERS)


def fetch_espn_contracts(active_keys: set[str]) -> tuple[dict[str, dict], str]:
    teams_payload = espn_request("teams?limit=1000")
    sports = teams_payload.get("sports")
    leagues = sports[0].get("leagues") if isinstance(sports, list) and sports else None
    teams = leagues[0].get("teams") if isinstance(leagues, list) and leagues else None
    if not isinstance(teams, list) or len(teams) != 30:
        raise ValueError("ESPN did not return all 30 NBA teams.")

    requests = []
    for entry in teams:
        team = entry.get("team") if isinstance(entry, dict) else None
        if isinstance(team, dict) and team.get("id"):
            requests.append((str(team["id"]), str(team.get("abbreviation") or "")))

    def fetch_roster(item: tuple[str, str]):
        team_id, abbreviation = item
        payload = espn_request(f"teams/{team_id}/roster")
        roster = payload.get("athletes")
        if not isinstance(roster, list):
            raise ValueError(f"ESPN roster for team {team_id} is missing athletes.")
        return abbreviation, payload.get("timestamp"), roster

    contracts = {}
    timestamps = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        for abbreviation, timestamp, roster in executor.map(fetch_roster, requests):
            if isinstance(timestamp, str) and timestamp:
                timestamps.append(timestamp)
            for athlete in roster:
                if not isinstance(athlete, dict):
                    continue
                name = str(athlete.get("displayName") or athlete.get("fullName") or "").strip()
                key = normalize_name(name)
                if not name or key not in active_keys:
                    continue
                raw_contract = athlete.get("contract")
                contracts[key] = {
                    "player_name": name,
                    "team_abbreviation": abbreviation,
                    "espn_athlete_id": str(athlete.get("id") or ""),
                    "contract_type": (
                        athlete.get("contractType")
                        or athlete.get("contract_type")
                        or (raw_contract.get("contractType") if isinstance(raw_contract, dict) else None)
                    ),
                    "salary": raw_contract.get("salary") if isinstance(raw_contract, dict) else None,
                    "salary_remaining": raw_contract.get("salaryRemaining") if isinstance(raw_contract, dict) else None,
                    "years_remaining": raw_contract.get("yearsRemaining") if isinstance(raw_contract, dict) else None,
                    "option_type": raw_contract.get("optionType") if isinstance(raw_contract, dict) else None,
                    "contract": raw_contract if isinstance(raw_contract, dict) else None,
                    "status": "reported" if isinstance(raw_contract, dict) else "not_reported",
                    "source": ESPN_SOURCE,
                    "source_url": "https://www.espn.com/nba/teams",
                    "data_as_of": timestamp,
                }

    contract_as_of = max(timestamps) if timestamps else dt.datetime.now(dt.timezone.utc).isoformat()
    return contracts, contract_as_of


def sql_text(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def sql_json(value: dict) -> str:
    encoded = json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    return sql_text(encoded) + "::jsonb"


def build_sql(snapshot: dict) -> str:
    as_of = snapshot["data_as_of"]
    contract_as_of = snapshot["contract_as_of"]
    lines = [
        "-- Static player career and contract snapshot.",
        f"-- Career data sourced from {NBA_SOURCE} as of {as_of}.",
        f"-- Contract data sourced from ESPN roster feeds as of {contract_as_of}.",
        "BEGIN;",
        "CREATE TABLE IF NOT EXISTS public.nba_player_profiles (",
        "  nba_player_id bigint UNIQUE CHECK (nba_player_id > 0),",
        "  player_name text NOT NULL,",
        "  player_name_key text PRIMARY KEY,",
        "  career_payload jsonb NOT NULL DEFAULT '{}'::jsonb,",
        "  contract_payload jsonb NOT NULL DEFAULT '{}'::jsonb,",
        "  career_as_of date NOT NULL,",
        "  contract_as_of timestamptz NOT NULL,",
        "  updated_at timestamptz NOT NULL DEFAULT now()",
        ");",
        "ALTER TABLE public.nba_player_profiles ENABLE ROW LEVEL SECURITY;",
        "REVOKE ALL ON TABLE public.nba_player_profiles FROM anon, authenticated;",
        "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.nba_player_profiles TO service_role;",
    ]

    players = list(snapshot["players"].values())
    for start in range(0, len(players), 20):
        chunk = players[start:start + 20]
        lines.append(
            "INSERT INTO public.nba_player_profiles "
            "(nba_player_id, player_name, player_name_key, career_payload, contract_payload, career_as_of, contract_as_of) VALUES"
        )
        values = []
        for player in chunk:
            contract = player.get("contract_payload") or {}
            values.append(
                f"({int(player['nba_player_id']) if player.get('nba_player_id') is not None else 'NULL'}, {sql_text(player['player_name'])}, "
                f"{sql_text(player['player_name_key'])}, {sql_json(player['career_payload'])}, "
                f"{sql_json(contract)}, {sql_text(as_of)}::date, {sql_text(contract_as_of)}::timestamptz)"
            )
        lines.append(",\n".join(values))
        lines.append(
            "ON CONFLICT (player_name_key) DO UPDATE SET "
            "player_name = EXCLUDED.player_name, "
            "player_name_key = EXCLUDED.player_name_key, "
            "career_payload = EXCLUDED.career_payload, "
            "contract_payload = EXCLUDED.contract_payload, "
            "career_as_of = EXCLUDED.career_as_of, "
            "contract_as_of = EXCLUDED.contract_as_of, "
            "updated_at = now();"
        )
    lines.append("COMMIT;")
    return "\n".join(lines) + "\n"


def write_setup_sql(migration_sql: str) -> None:
    existing = SETUP_PATH.read_text(encoding="utf-8")
    start = existing.find(SNAPSHOT_MARKER_START)
    end = existing.find(SNAPSHOT_MARKER_END)
    block = f"{SNAPSHOT_MARKER_START}\n{migration_sql.rstrip()}\n{SNAPSHOT_MARKER_END}"
    if start >= 0 and end >= start:
        end += len(SNAPSHOT_MARKER_END)
        updated = existing[:start] + block + existing[end:]
    else:
        updated = existing.rstrip() + "\n\n" + block + "\n"
    SETUP_PATH.write_text(updated, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate static NBA player career and contract SQL.")
    parser.add_argument("--workers", type=int, default=1)
    args = parser.parse_args()
    if not 1 <= args.workers <= 10:
        raise ValueError("--workers must be between 1 and 10.")

    current_stats = read_json(CURRENT_STATS_PATH)
    current_players = current_stats.get("players")
    if not isinstance(current_players, dict) or not current_players:
        raise ValueError("The bundled active-player snapshot is empty.")
    active_keys = set(current_players)
    season = str(current_stats.get("season") or "")
    if not re.fullmatch(r"\d{4}-\d{2}", season):
        raise ValueError(f"The current player snapshot has an invalid season: {season!r}")
    current_year = int(season[:4]) + 1

    contract_by_key, contract_as_of = fetch_espn_contracts(active_keys)
    roster_name_by_key = {
        key: str(contract.get("player_name") or "")
        for key, contract in contract_by_key.items()
    }
    as_of = dt.date.today().isoformat()
    directory = fetch_bref_player_directory(active_keys, args.workers)
    if not directory:
        raise ValueError("Basketball-Reference player directories did not match any active roster names.")
    first_year = min(
        int(player["from_year"])
        for player in directory.values()
        if str(player.get("from_year") or "").isdigit()
    )
    print(
        f"Matched {len(directory)} of {len(active_keys)} active names in Basketball-Reference directories; "
        f"fetching season tables from {first_year} through {current_year}.",
        flush=True,
    )
    stats_by_key, failures = fetch_bref_season_stats(
        active_keys,
        current_year,
        first_year,
        args.workers,
    )
    if failures:
        details = "; ".join(f"{item['url']}: {item['error']}" for item in failures[:5])
        raise RuntimeError(f"Basketball-Reference snapshot is incomplete ({len(failures)} failed tables): {details}")

    missing_career = sorted(
        key for key in active_keys
        if float(current_players[key].get("gp") or 0) > 0
        and not stats_by_key[key]["history"]
    )
    if missing_career:
        raise ValueError(
            "Basketball-Reference season tables did not match active players with games played: "
            + ", ".join(missing_career[:20])
        )

    fallback_ids = read_player_ids()
    id_aliases = {}
    for key, player_id in fallback_ids.items():
        id_aliases.setdefault(canonical_person_key(key), set()).add(player_id)
    players = {}
    assigned_ids = {
        fallback_ids[key]
        for key in active_keys
        if key in fallback_ids
    }
    for key in sorted(active_keys):
        directory_row = directory.get(key)
        name = roster_name_by_key.get(key) or (
            directory_row.get("player_name") if directory_row else None
        ) or key
        player_id = fallback_ids.get(key)
        if player_id is None:
            candidate_ids = id_aliases.get(canonical_person_key(key), set()) - assigned_ids
            player_id = next(iter(candidate_ids)) if len(candidate_ids) == 1 else None
            if player_id is not None:
                assigned_ids.add(player_id)
        contract = contract_by_key.get(key) or {
            "player_name": name,
            "salary": None,
            "salary_remaining": None,
            "years_remaining": None,
            "contract_type": None,
            "contract": None,
            "source": ESPN_SOURCE,
            "source_url": "https://www.espn.com/nba/teams",
            "data_as_of": contract_as_of,
            "status": "not_reported",
        }
        player = {
            "nba_player_id": player_id,
            "player_name": name,
            "player_name_key": key,
        }
        players[key] = {
            **player,
            "career_payload": build_bref_career_payload(
                player,
                stats_by_key[key],
                directory_row,
                as_of,
            ),
            "contract_payload": contract,
        }

    snapshot = {
        "data_as_of": as_of,
        "contract_as_of": contract_as_of,
        "history_from_year": first_year,
        "sources": {"career": NBA_SOURCE, "contracts": ESPN_SOURCE},
        "players": players,
    }
    OUTPUT_PATH.write_text(
        json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    migration_sql = build_sql(snapshot)
    MIGRATION_PATH.write_text(migration_sql, encoding="utf-8")
    write_setup_sql(migration_sql)
    print(
        f"Wrote {len(players)} player profiles to {OUTPUT_PATH.relative_to(ROOT)}, "
        f"{MIGRATION_PATH.relative_to(ROOT)}, and {SETUP_PATH.name}."
    )


if __name__ == "__main__":
    main()
