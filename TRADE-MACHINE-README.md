# NBA Trade Machine

The NBA Trade Machine is a multi-team trade-planning workspace for NBA rosters, salaries, draft picks, and pick swaps. It is a planning aid; its modeled CBA checks are not official NBA approval or legal advice.

## Run it

Open `trade-machine.html` in a browser, or serve the project directory with a local static web server and open that file. The page loads team rosters, salaries, and draft-pick data from the configured NBA API, so an internet connection is needed for live data.

## Build and review a trade

1. Add at least two teams and select the NBA teams involved.
2. Use each team card's roster and draft-pick tabs to inspect its assets.
3. Use the Trade controls to transfer players and picks. For picks, add available protection or swap terms as needed.
4. Review the trade to see salary changes, transferred assets, and rule checks.
5. Save a trade from the review screen. Open **Saved trades** to inspect it later or continue editing it.

The builder supports up to five teams. Player cards open from player names and show the rostered team, available statistics, and salary. Trending players also open in-app player cards.

## Modeled checks

Trade review reports checks for trade structure, pick swaps, salary matching, configured apron restrictions, second-apron aggregation, first-round pick windows, and the Stepien rule. The model uses 2026–27 estimates shown in the review and the pick inventory returned by the API. Protected-pick language and incomplete or stale API data can require manual review.

## Saved trades and data

Saved trades are stored in the current browser's local storage under `nba-trade-desk.saved-trades.v1`. They are not synchronized between browsers or devices. Clearing browser storage can remove them.

The Trade Machine uses roster, salary, and draft-pick data from the configured NBA API, plus local corrections for selected roster and contract details. Player cards label the season associated with displayed statistics. Kyrie Irving, Damian Lillard, and Tyrese Haliburton use their 2024–25 regular-season stats because their 2025–26 season statistics are unavailable.

## Main files

- `trade-machine.html` — page structure and external script loading.
- `trade-machine.js` — team selection, trade state, asset transfers, saved trades, player cards, and modeled validation.
- `trade-machine.css` — Trade Desk design, team themes, and responsive layouts.
- `player-headshots.js` — player headshot lookup.
- `player-season-overrides.js` — shared season-stat corrections.
