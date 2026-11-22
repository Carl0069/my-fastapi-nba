import concurrent.futures
import datetime as dt
import argparse
import json
import re
import unicodedata
import urllib.request
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TEAM_CATALOG_SQL = ROOT / "supabase" / "migrations" / "20261114_nba_team_catalog.sql"
SNAPSHOT_SQL = ROOT / "supabase" / "migrations" / "20261115_nba_player_snapshot_20261111_pht.sql"
SETUP_SQL = ROOT / "SUPABASE_COMPLETE_SETUP.sql"
SNAPSHOT_MARKER = "-- BEGIN NBA 2026-27 SNAPSHOT AS OF 2026-11-11 PH"
LEGACY_SNAPSHOT_MARKER = SNAPSHOT_MARKER
ESPN_API = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba"
NBA_MOVEMENT_API = "https://stats.nba.com/js/data/playermovement/NBA_Player_Movement.json"
PLAYER_ABBREVIATIONS = {
    "GS": "GSW",
    "NO": "NOP",
    "NY": "NYK",
    "SA": "SAS",
    "UTAH": "UTA",
    "WSH": "WAS",
}
STAT_FIELDS = ("pts", "reb", "ast", "stl", "blk", "tov", "fg", "fg3", "ft")
ZERO_STATS = {
    "gp": 0,
    "pts": None,
    "reb": None,
    "ast": None,
    "stl": None,
    "blk": None,
    "tov": None,
    "fg": None,
    "fg3": None,
    "ft": None,
}


def fetch_json(url: str) -> dict:
    request = urllib.request.Request(
        url,
        headers={"Accept": "application/json", "User-Agent": "NBAHubSnapshot/1.0"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = json.loads(response.read().decode("utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"Unexpected JSON response from {url}")
    return payload


def normalize_name(value: str) -> str:
    return "".join(
        character
        for character in unicodedata.normalize("NFKD", value).casefold()
        if character.isalnum()
    )


def sql_string(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def parse_seed_catalog() -> tuple[dict[str, int], list[dict]]:
    source = TEAM_CATALOG_SQL.read_text(encoding="utf-8")
    team_rows = re.findall(
        r"^\s*\((\d+), '((?:[^']|'')*)', '([A-Z]+)',",
        source,
        re.MULTILINE,
    )
    team_ids = {
        abbreviation: int(team_id)
        for team_id, _name, abbreviation in team_rows
    }
    if len(team_ids) != 30:
        raise ValueError(f"Expected 30 team rows, found {len(team_ids)}.")

    player_pattern = (
        r"^\s*\('((?:[^']|'')*)',\s*(\d+),\s*"
        r"'((?:[^']|'')*)',\s*'((?:[^']|'')*)',\s*"
        r"'((?:[^']|'')*)',\s*'((?:[^']|'')*)'::jsonb\)"
    )
    player_rows = []
    for row_id, team_id, name, full_name, position, metadata_sql in re.findall(
        player_pattern, source, re.MULTILINE
    ):
        metadata = json.loads(metadata_sql.replace("''", "'"))
        player_rows.append({
            "id": row_id.replace("''", "'"),
            "team_id": int(team_id),
            "name": name.replace("''", "'"),
            "full_name": full_name.replace("''", "'"),
            "position": position.replace("''", "'"),
            "metadata": metadata,
        })
    if not player_rows:
        raise ValueError("No player seed rows could be parsed.")
    return team_ids, player_rows


def fetch_rosters(
    team_ids: dict[str, int],
    roster_as_of: dt.date,
) -> tuple[dict[str, list[dict]], str]:
    teams_payload = fetch_json(f"{ESPN_API}/teams?limit=1000")
    teams = teams_payload["sports"][0]["leagues"][0]["teams"]
    if len(teams) != 30:
        raise ValueError(f"Expected 30 ESPN teams, found {len(teams)}.")

    def fetch_team_roster(team: dict) -> tuple[str, str, list[dict]]:
        team = team["team"]
        roster_payload = fetch_json(f"{ESPN_API}/teams/{team['id']}/roster")
        players = roster_payload.get("athletes")
        if not isinstance(players, list):
            raise ValueError(f"ESPN roster missing players for {team['displayName']}.")
        return (
            team["abbreviation"],
            roster_payload.get("timestamp", ""),
            players,
        )

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        fetched = list(executor.map(fetch_team_roster, teams))

    rosters: dict[str, list[dict]] = {}
    timestamps = set()
    for abbreviation, timestamp, players in fetched:
        database_abbreviation = PLAYER_ABBREVIATIONS.get(
            abbreviation, abbreviation
        )
        if database_abbreviation not in team_ids:
            raise ValueError(f"No database team ID for ESPN team {abbreviation}.")
        timestamps.add(timestamp)
        team_id = team_ids[database_abbreviation]
        normalized_players = []
        for order, player in enumerate(players):
            name = str(player.get("fullName") or "").strip()
            if not name:
                continue
            position = (player.get("position") or {}).get("abbreviation") or "—"
            normalized_players.append({
                "team_id": team_id,
                "name": name,
                "key": normalize_name(name),
                "position": position,
                "roster_order": order,
            })
        rosters[database_abbreviation] = normalized_players

    snapshot_dates = {timestamp[:10] for timestamp in timestamps}
    if len(rosters) != 30 or len(snapshot_dates) != 1:
        raise ValueError("ESPN team rosters were incomplete or from different dates.")

    movement = fetch_json(NBA_MOVEMENT_API)["NBA_Player_Movement"]["rows"]
    removed_post_cutoff = []
    for item in movement:
        transaction_date = str(item.get("TRANSACTION_DATE", ""))[:10]
        if transaction_date < roster_as_of.isoformat():
            continue
        if item.get("Transaction_Type") != "Signing":
            raise ValueError(
                "Unsupported post-cutoff transaction; roster reversal is unsafe: "
                f"{item.get('TRANSACTION_DESCRIPTION')}"
            )
        player_key = normalize_name(str(item.get("PLAYER_SLUG") or "").replace("-", " "))
        matches = [
            (abbreviation, player)
            for abbreviation, players in rosters.items()
            for player in players
            if player["key"] == player_key
        ]
        if len(matches) != 1:
            raise ValueError(
                "Could not uniquely reverse post-cutoff signing: "
                f"{item.get('TRANSACTION_DESCRIPTION')}"
            )
        abbreviation, player = matches[0]
        rosters[abbreviation].remove(player)
        removed_post_cutoff.append(player["name"])

    return rosters, f"{min(timestamps)} to {max(timestamps)}"


def parse_stat_pair(value: object) -> tuple[float, float]:
    try:
        made, attempted = str(value).split("-", 1)
        return float(made), float(attempted)
    except (ValueError, TypeError):
        return 0.0, 0.0


def parse_minutes(value: object) -> float:
    try:
        parts = [float(part) for part in str(value).split(":")]
    except (ValueError, TypeError):
        return 0.0
    if len(parts) == 1:
        return parts[0]
    return parts[0] + parts[1] / 60


def fetch_season_stats(stats_through: dt.date) -> dict[str, dict]:
    game_ids = set()
    date = dt.date(2026, 10, 20)
    while date <= stats_through:
        payload = fetch_json(f"{ESPN_API}/scoreboard?dates={date:%Y%m%d}")
        for event in payload.get("events", []):
            if (
                event.get("season", {}).get("type") == 2
                and event.get("status", {}).get("type", {}).get("name") == "STATUS_FINAL"
            ):
                game_ids.add(str(event["id"]))
        date += dt.timedelta(days=1)
    if not game_ids:
        raise ValueError("No finished regular-season games found before the cutoff.")

    def fetch_summary(game_id: str) -> tuple[str, dict]:
        return game_id, fetch_json(f"{ESPN_API}/summary?event={game_id}")

    totals: dict[str, dict] = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        summaries = executor.map(fetch_summary, sorted(game_ids))
        summary_count = 0
        for _game_id, payload in summaries:
            player_teams = payload.get("boxscore", {}).get("players")
            if not isinstance(player_teams, list) or not player_teams:
                raise ValueError("A final game summary did not contain player box scores.")
            summary_count += 1
            for team in player_teams:
                for group in team.get("statistics", []):
                    keys = group.get("keys", [])
                    for athlete in group.get("athletes", []):
                        if athlete.get("didNotPlay"):
                            continue
                        stats = dict(zip(keys, athlete.get("stats", [])))
                        if parse_minutes(stats.get("minutes")) <= 0:
                            continue
                        player = athlete.get("athlete") or {}
                        name = str(player.get("displayName") or "").strip()
                        if not name:
                            continue
                        entry = totals.setdefault(normalize_name(name), {
                            "name": name,
                            "gp": 0,
                            "pts": 0.0,
                            "reb": 0.0,
                            "ast": 0.0,
                            "stl": 0.0,
                            "blk": 0.0,
                            "tov": 0.0,
                            "fgm": 0.0,
                            "fga": 0.0,
                            "fg3m": 0.0,
                            "fg3a": 0.0,
                            "ftm": 0.0,
                            "fta": 0.0,
                        })
                        entry["gp"] += 1
                        for key, field in (
                            ("points", "pts"),
                            ("rebounds", "reb"),
                            ("assists", "ast"),
                            ("steals", "stl"),
                            ("blocks", "blk"),
                            ("turnovers", "tov"),
                        ):
                            try:
                                entry[field] += float(stats.get(key) or 0)
                            except (TypeError, ValueError):
                                raise ValueError(f"Invalid {key} value for {name}.")
                        for key, made_field, attempted_field in (
                            ("fieldGoalsMade-fieldGoalsAttempted", "fgm", "fga"),
                            ("threePointFieldGoalsMade-threePointFieldGoalsAttempted", "fg3m", "fg3a"),
                            ("freeThrowsMade-freeThrowsAttempted", "ftm", "fta"),
                        ):
                            made, attempted = parse_stat_pair(stats.get(key))
                            entry[made_field] += made
                            entry[attempted_field] += attempted

    if summary_count != len(game_ids):
        raise ValueError("Not every finished game box score was retrieved.")

    result = {}
    for key, totals_for_player in totals.items():
        gp = totals_for_player["gp"]
        player_stats = {"gp": gp}
        for field in ("pts", "reb", "ast", "stl", "blk", "tov"):
            player_stats[field] = round(totals_for_player[field] / gp, 1)
        for field, made_field, attempted_field in (
            ("fg", "fgm", "fga"),
            ("fg3", "fg3m", "fg3a"),
            ("ft", "ftm", "fta"),
        ):
            attempts = totals_for_player[attempted_field]
            player_stats[field] = (
                round(100 * totals_for_player[made_field] / attempts, 1)
                if attempts
                else None
            )
        result[key] = player_stats
    return result


def player_stats(name: str, stats: dict[str, dict]) -> dict:
    return {
        "name": name,
        "stats_season": "2026-27",
        **stats.get(normalize_name(name), ZERO_STATS),
    }


def build_snapshot_sql(stats_through: dt.date) -> tuple[str, dict]:
    team_ids, seed_players = parse_seed_catalog()
    roster_as_of = stats_through + dt.timedelta(days=1)
    rosters, roster_timestamp = fetch_rosters(team_ids, roster_as_of)
    stats = fetch_season_stats(stats_through)
    active_players = [
        player
        for roster in rosters.values()
        for player in roster
    ]
    active_keys = [player["key"] for player in active_players]
    if len(active_keys) != len(set(active_keys)):
        raise ValueError("A player appears on multiple active team rosters.")

    existing_by_name: dict[str, list[dict]] = defaultdict(list)
    existing_by_id = {player["id"]: player for player in seed_players}
    for player in seed_players:
        existing_by_name[normalize_name(player["name"])].append(player)

    chosen_ids: set[str] = set()
    active_by_key: dict[str, dict] = {}
    for player in active_players:
        candidates = existing_by_name.get(player["key"], [])
        same_team = [
            candidate
            for candidate in candidates
            if candidate["team_id"] == player["team_id"]
            and candidate["id"] not in chosen_ids
        ]
        remaining = [
            candidate for candidate in candidates
            if candidate["id"] not in chosen_ids
        ]
        existing = (same_team or remaining or [None])[0]
        if existing:
            chosen_ids.add(existing["id"])
        player["existing"] = existing
        active_by_key[player["key"]] = player

    starters_by_id: dict[str, tuple[bool, int]] = {}
    starters_by_key: dict[str, bool] = {}
    for _abbreviation, roster in rosters.items():
        starter_candidates = [
            player for player in roster
            if player.get("existing")
            and player["existing"]["metadata"].get("is_starter") is True
        ]
        starter_candidates.sort(
            key=lambda player: player["existing"]["metadata"].get("roster_order", 999)
        )
        starters = starter_candidates[:5]
        starter_keys = {player["key"] for player in starters}
        for player in roster:
            if len(starters) >= 5:
                break
            if player["key"] not in starter_keys:
                starters.append(player)
                starter_keys.add(player["key"])
        if len(starters) != 5:
            raise ValueError(f"Could not identify five starters for team {player['team_id']}.")
        order_by_key = {player["key"]: index for index, player in enumerate(roster)}
        for player in roster:
            if player.get("existing"):
                starters_by_id[player["existing"]["id"]] = (
                    player["key"] in starter_keys,
                    order_by_key[player["key"]],
                )
            starters_by_key[player["key"]] = player["key"] in starter_keys

    lines = [
        "-- NBA Hub roster and player-stat snapshot.",
        f"-- Stats: ESPN final 2026-27 regular-season box scores through {stats_through:%B} {stats_through.day}, {stats_through.year} (US).",
        f"-- This cutoff is {roster_as_of:%B} {roster_as_of.day}, {roster_as_of.year} in the Philippines (UTC+8).",
        f"-- Roster source: ESPN team rosters timestamped {roster_timestamp};",
        "-- post-cutoff NBA player-movement feed signings are reversed.",
        "-- Every player already in the Supabase catalog receives this season's stats; players without games have GP 0 and null averages.",
        "BEGIN;",
        "ALTER TABLE public.nba_players",
        "  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;",
        "CREATE INDEX IF NOT EXISTS nba_players_active_team_idx",
        "  ON public.nba_players (is_active, team_id);",
        "UPDATE public.nba_players SET is_active = false;",
        "",
    ]
    for row in seed_players:
        key = normalize_name(row["name"])
        active = active_by_key.get(key)
        stat_values = player_stats(row["name"], stats)
        patch = {
            "stats_season": stat_values["stats_season"],
            "stats_as_of": stats_through.isoformat(),
            "stats_source": "ESPN box scores",
            **{field: stat_values[field] for field in ("gp", *STAT_FIELDS)},
        }
        statements = [
            "UPDATE public.nba_players",
            "SET is_active = " + ("true" if active and active.get("existing") is row else "false"),
        ]
        if active and active.get("existing") is row:
            statements.extend([
                f"    , team_id = {active['team_id']}",
                f"    , name = {sql_string(active['name'])}",
                f"    , full_name = {sql_string(active['name'])}",
            ])
        metadata_expression = (
            "jsonb_set(COALESCE(metadata, '{}'::jsonb), '{player}', "
            "COALESCE(metadata->'player', '{}'::jsonb) || "
            f"{sql_string(json.dumps(patch, ensure_ascii=False, separators=(',', ':')))}::jsonb, true)"
        )
        starter_info = starters_by_id.get(row["id"])
        if active and active.get("existing") is row:
            position = active["position"]
            statements.append(f"    , position = {sql_string(position)}")
            statements.append(
                "    , metadata = jsonb_set("
                f"jsonb_set({metadata_expression}, '{{is_starter}}', "
                f"'{'true' if starter_info and starter_info[0] else 'false'}'::jsonb, true), "
                f"'{{roster_order}}', '{starter_info[1] if starter_info else 0}'::jsonb, true)"
            )
        else:
            statements.append(f"    , metadata = {metadata_expression}")
        statements.extend([
            "    , updated_at = now()",
            f"WHERE id = {sql_string(row['id'])};",
            "",
        ])
        lines.extend(statements)

    for player in active_players:
        if player.get("existing"):
            continue
        stat_payload = {
            "name": player["name"],
            "pos": player["position"],
            "contract_type": None,
            **player_stats(player["name"], stats),
            "stats_as_of": stats_through.isoformat(),
            "stats_source": "ESPN box scores",
            "salary": None,
        }
        metadata = {
            "is_starter": starters_by_key[player["key"]],
            "roster_order": player["roster_order"],
            "player": stat_payload,
        }
        row_id = f"{player['team_id']}:{player['name'].lower()}"
        if row_id in existing_by_id:
            raise ValueError(f"Generated player ID already exists: {row_id}")
        lines.extend([
            "INSERT INTO public.nba_players",
            "  (id, team_id, name, full_name, position, is_active, metadata)",
            "VALUES ("
            f"{sql_string(row_id)}, {player['team_id']}, {sql_string(player['name'])}, "
            f"{sql_string(player['name'])}, {sql_string(player['position'])}, true, "
            f"{sql_string(json.dumps(metadata, ensure_ascii=False, separators=(',', ':')))}::jsonb)",
            "ON CONFLICT (id) DO UPDATE",
            "SET team_id = EXCLUDED.team_id,",
            "    name = EXCLUDED.name,",
            "    full_name = EXCLUDED.full_name,",
            "    position = EXCLUDED.position,",
            "    is_active = true,",
            "    metadata = EXCLUDED.metadata,",
            "    updated_at = now();",
            "",
        ])

    lines.extend([
        "COMMIT;",
        "",
    ])
    details = {
        "players_seeded": len(seed_players),
        "active_roster_players": len(active_players),
        "new_players": sum(1 for player in active_players if not player.get("existing")),
        "inactive_players": len(seed_players) + sum(
            1 for player in active_players if not player.get("existing")
        ) - len(active_players),
        "players_with_stats": len(stats),
        "stats_matched_to_active_roster": sum(
            1 for player in active_players if player["key"] in stats
        ),
        "teams": len(rosters),
        "nique_clifford_team_id": active_by_key[normalize_name("Nique Clifford")]["team_id"],
        "nique_clifford_stats": stats.get(normalize_name("Nique Clifford")),
    }
    return "\n".join(lines), details


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate an NBA player and roster snapshot SQL migration.")
    parser.add_argument(
        "--stats-through",
        type=dt.date.fromisoformat,
        default=dt.date(2026, 11, 10),
        help="Last US game date included in cumulative season statistics (YYYY-MM-DD).",
    )
    args = parser.parse_args()
    stats_through = args.stats_through
    stats_sql_date = stats_through.strftime("%Y%m%d")
    migration_date = (stats_through + dt.timedelta(days=1)).strftime("%Y%m%d")
    migration_path = ROOT / "supabase" / "migrations" / f"{migration_date}_nba_player_snapshot_{stats_sql_date}.sql"
    marker = f"-- BEGIN NBA 2026-27 SNAPSHOT AS OF {stats_through.isoformat()} US"
    snapshot_sql, details = build_snapshot_sql(stats_through)
    migration_path.write_text(snapshot_sql, encoding="utf-8")
    existing_setup = SETUP_SQL.read_text(encoding="utf-8")
    for existing_marker in (SNAPSHOT_MARKER, marker):
        if existing_marker in existing_setup:
            existing_setup = existing_setup.split(existing_marker, 1)[0].rstrip()
    setup_with_snapshot = (
        existing_setup.rstrip()
        + "\n\n"
        + marker
        + "\n"
        + snapshot_sql
    )
    SETUP_SQL.write_text(setup_with_snapshot, encoding="utf-8")
    print(json.dumps(details, indent=2))
    print(f"Generated migration: {migration_path}")
    print("Appended snapshot to SUPABASE_COMPLETE_SETUP.sql")


if __name__ == "__main__":
    main()
