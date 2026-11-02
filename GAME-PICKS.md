![alt text](image.png)# Game Picks

Game Picks uses simulated tokens stored in the current browser. A user can claim
1,000 tokens once per calendar day in the Asia/Manila time zone. Tokens have no
cash value and cannot be deposited, transferred, or redeemed. Clearing browser
storage removes that browser's balance and pick history.

## Live odds setup

1. Create an account and API key with [The Odds API](https://the-odds-api.com/).
2. Add `THE_ODDS_API_KEY` to the Vercel project's server-side environment
   variables. Do not put the key in `app.js`, HTML, or any other browser asset.
3. Redeploy the FastAPI app.

The API requests US-region head-to-head (moneyline) prices in American odds
format. The API caches odds for five minutes, and the page refreshes them every
five minutes while open. Prices display as decimal multipliers (for example,
1.91x); sportsbook names are not shown. Parlay returns are estimates made by
multiplying the displayed prices; they are not sportsbook-issued parlay quotes.
Pick placement is disabled when odds are unavailable, stale, or the game is no
longer pre-game.

## Parlays and settlement

A slip can contain one pick (a straight pick) or picks from multiple games (a
parlay). Parlay decimal odds are the product of the leg prices. Every leg must
win for the parlay to win; a losing leg loses the ticket. A tied/pushed leg is
voided and removed from the combined price. If every leg pushes, the stake is
returned. Completed tickets are settled from NBA game results.

The browser stores balances and picks locally; they are not accounts or
server-verified balances. Game Picks is for entertainment only and does not
accept or pay real money.

## Prize Shop

Prize Shop purchases are usable in the game flow:

- **Parlay Safety Net (20,000 tokens):** select it on a slip with at least two
  picks. If exactly one leg loses and the others win or push, the full stake is
  returned. It is consumed when the parlay is placed.
- **2× Payout Boost (50,000 tokens):** select it before placing a pick or parlay.
  It doubles the ticket's return if the ticket wins and is consumed when placed.
  A losing ticket receives no payout; a push returns the original stake.
- **7-Day Daily Boost (10,000 tokens):** buy it to add 2,000 tokens to each of
  the next seven successful daily claims, for 3,000 tokens per boosted claim.
- **Franchise Challenge Pass (100,000 tokens):** choose an NBA team to highlight its
  matchups and unlock Franchise Challenge. For each upcoming game involving
  that team, choose Win or Lose once before tip-off. A correct call earns 2,000
  tokens, increasing by 500 for each consecutive correct call up to 5,000; a
  wrong call resets the streak. Equipping the pass applies the chosen
  franchise-color theme across the NBA Hub.
- **Site-wide themes:** Neon Arena (20,000), Courtside After Dark (35,000),
  Hardwood Throwback (45,000), and Playoff Spotlight (75,000) are separate
  unlocks. These recolor the NBA Hub's navigation, headline hero, transaction,
  schedule, standings, directory, and Game Picks sections. Buy a theme once,
  equip another owned theme at any time, or restore the default hardwood look.
- **Player Spotlight (25,000 tokens):** pin a player and their API-provided
  season averages to the top of NBA Today.
- **Player Card Collection (15,000 tokens):** unlock the collection on the
  Teams Directory page. Each selected player card costs 2,500 tokens and uses
  current roster and season-stat data from the API.
- **Stat Card Studio (20,000 tokens):** choose Classic, Broadcast Panel, or
  Spotlight layouts for player cards in team rosters.
- **Franchise History Gallery (30,000 tokens):** browse API-provided team
  records, championship totals, and championship years.
- **Hub Profile Studio (20,000 tokens):** select a fan title and banner shown
  site-wide.

Token balances, purchases, and picks are stored in the browser and are not
server-verified. Tokens and perks have no cash or real-world prize value.
