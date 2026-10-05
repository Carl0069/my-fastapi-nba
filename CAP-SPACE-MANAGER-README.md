# Cap Space Manager

The Cap Space Manager is a five-player NBA roster-building game. Draft one player from each price tier, stay within the $15 budget, and see how well the finished group fits together.

## Run it

Open `cap-space-manager.html` in a browser, or serve the project directory with a local static web server and open that file. The app loads its NBA player pool and community challenges from the configured NBA API, so an internet connection is needed for live data.

## How to play

1. Choose an official challenge or a community challenge.
2. Pick five players from the randomized price board. Each player costs $1–$5.
3. Keep the lineup total at or below $15. Remove picks or start a fresh board to try another lineup.
4. Read the team-fit grade after the fifth player is selected.

Community challenges can define their own player pool and rule. The challenge creator selects the players included in that pool.

## Team-fit grading

The completed lineup receives a grade from 0–100. Its score is composed of:

| Category | Weight | What it measures |
|---|---:|---|
| Position coverage | 30 | Whether five different players can cover PG, SG, SF, PF, and C. A player cannot fill two positions in this calculation. |
| Scoring | 20 | Combined points per game, up to a 100-point team target. |
| Playmaking | 15 | Combined assists per game, up to a 25-assist target. |
| Rebounding | 15 | Combined rebounds per game, up to a 40-rebound target. |
| Defense | 10 | Combined steals and blocks per game, up to a 10-stock target. |
| Challenge fit | 5 | The share of drafted players who meet the active challenge rule. |
| Budget used | 5 | The share of the $15 budget spent. |

Each category is capped at its maximum weight. The grade panel shows the category scores, position gaps, challenge-rule match count, stat totals, and a suggested area to improve. This is a lineup-planning score, not a prediction of real-game performance.

## Player data

The player pool uses roster and regular-season statistics from the configured NBA API. Each player card identifies the regular-season season available for that player. Kyrie Irving, Damian Lillard, and Tyrese Haliburton use 2024–25 statistics because their 2025–26 season statistics are unavailable; their other roster fields remain sourced as before.

## Main files

- `cap-space-manager.html` — page structure and external script loading.
- `cap-space-manager.js` — player pool, challenges, budget rules, draft state, and team-fit grading.
- `cap-space-manager.css` — responsive interface and visual styles.
- `player-season-overrides.js` — shared season-stat corrections for players without 2025–26 statistics.


