import unittest

from pydantic import ValidationError

from api import index


def trade_payload(**overrides):
    return {
        "teams": [{"id": 1, "name": "Team A"}, {"id": 2, "name": "Team B"}],
        "players": [{"name": "Example Player"}],
        "picks": [],
        "frontOfficeActions": [],
        "tradeState": {},
        **overrides,
    }


class TradePostFieldsTests(unittest.TestCase):
    def test_title_and_explanation_can_be_omitted(self):
        request = index.TradeMachineSavedTradeCreate(payload=trade_payload())

        self.assertEqual(request.payload["postTitle"], "")
        self.assertEqual(request.payload["postExplanation"], "")

    def test_blank_title_and_explanation_are_normalized(self):
        request = index.TradeMachineSavedTradeCreate(
            payload=trade_payload(postTitle="  ", postExplanation=" \n ")
        )

        self.assertEqual(request.payload["postTitle"], "")
        self.assertEqual(request.payload["postExplanation"], "")

    def test_nonblank_title_and_explanation_keep_minimum_lengths(self):
        for fields in (
            {"postTitle": "ab"},
            {"postExplanation": "too short"},
        ):
            with self.subTest(fields=fields), self.assertRaises(ValidationError):
                index.TradeMachineSavedTradeCreate(payload=trade_payload(**fields))


if __name__ == "__main__":
    unittest.main()
