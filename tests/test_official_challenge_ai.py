import json
import os
import unittest
from unittest.mock import patch
from uuid import uuid4

from fastapi import HTTPException

from api import index


PLAYERS = [
    {
        "id": "1:player one",
        "name": "Player One",
        "team": "Team A",
        "position": "PG",
        "gp": 70,
        "pts": 20,
        "reb": 4,
        "ast": 7,
        "stl": 1,
        "blk": 0,
    },
    {
        "id": "2:player two",
        "name": "Player Two",
        "team": "Team B",
        "position": "C",
        "gp": 60,
        "pts": 12,
        "reb": 9,
        "ast": 2,
        "stl": 1,
        "blk": 2,
    },
]
AI_DRAFT = {
    "title": "Paint Protectors",
    "description": "Build a defensive-minded lineup.",
    "rule_type": "defenders",
    "difficulty": "Hard",
    "icon": "🛡️",
    "player_tiers": {"1:player one": 4, "2:player two": 5},
}


class FakeResponse:
    def __init__(self, value):
        self.value = value

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self):
        return json.dumps(self.value).encode("utf-8")


class OfficialChallengeAITests(unittest.TestCase):
    def setUp(self):
        self.request_data = index.OfficialChallengeAIGenerate(
            prompt="Create a defensive challenge"
        )

    def _openai_response(self, draft):
        return FakeResponse({"choices": [{"message": {"content": json.dumps(draft)}}]})

    def test_generate_returns_validated_challenge_and_all_tiers(self):
        with (
            patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}, clear=True),
            patch.object(index, "_official_challenge_player_pool", return_value=PLAYERS),
            patch.object(index, "urlopen", return_value=self._openai_response(AI_DRAFT)),
        ):
            result = index.generate_official_challenge(self.request_data)

        self.assertEqual(result["rule_type"], "defenders")
        self.assertEqual(result["player_tiers"], AI_DRAFT["player_tiers"])

    def test_generate_rejects_incomplete_player_tier_maps(self):
        incomplete_draft = {
            **AI_DRAFT,
            "player_tiers": {"1:player one": 4},
        }
        with (
            patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}, clear=True),
            patch.object(index, "_official_challenge_player_pool", return_value=PLAYERS),
            patch.object(index, "urlopen", return_value=self._openai_response(incomplete_draft)),
        ):
            with self.assertRaises(HTTPException) as raised:
                index.generate_official_challenge(self.request_data)

        self.assertEqual(raised.exception.status_code, 502)

    def test_generate_requires_server_side_api_key(self):
        with (
            patch.dict(os.environ, {}, clear=True),
            patch.object(index, "urlopen") as open_url,
        ):
            with self.assertRaises(HTTPException) as raised:
                index.generate_official_challenge(self.request_data)

        self.assertEqual(raised.exception.status_code, 503)
        open_url.assert_not_called()

    def test_publish_rejects_player_ids_outside_current_pool(self):
        challenge = index.OfficialChallengeCreate(
            **{**AI_DRAFT, "player_tiers": {"unknown player": 3}}
        )
        with (
            patch.object(index, "_official_challenge_player_pool", return_value=PLAYERS),
            patch.object(index, "supabase_rest_request") as save_challenge,
        ):
            with self.assertRaises(HTTPException) as raised:
                index.create_official_challenge(challenge, uuid4())

        self.assertEqual(raised.exception.status_code, 422)
        save_challenge.assert_not_called()

    def test_admin_dependency_rejects_missing_credentials(self):
        with self.assertRaises(HTTPException) as raised:
            index.verify_supabase_admin(None)

        self.assertEqual(raised.exception.status_code, 401)

    def test_generate_route_has_admin_dependency(self):
        route = next(
            route
            for route in index.app.routes
            if getattr(route, "path", None) == "/api/v1/admin/official-challenges/generate"
        )
        self.assertIn(
            index.verify_supabase_admin,
            [dependency.call for dependency in route.dependant.dependencies],
        )

    def test_player_pool_deduplicates_roster_ids(self):
        player = {"name": "Player One", "pos": "PG"}
        team = {
            "id": 1,
            "name": "Team A",
            "starters_2026_27": [player],
            "bench_2026_27": [player],
        }
        with patch.object(index, "build_teams_response", return_value={"teams": [team]}):
            players = index._official_challenge_player_pool()

        self.assertEqual([player["id"] for player in players], ["1:player one"])


if __name__ == "__main__":
    unittest.main()
