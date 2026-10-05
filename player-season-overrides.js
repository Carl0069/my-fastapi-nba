(() => {
  // Per-game totals are from Basketball-Reference's 2024-25 NBA table.
  const overrides = {
    "kyrieirving": {
      stats_season: "2024-25",
      gp: 50,
      pts: 24.7,
      reb: 4.8,
      ast: 4.6,
      stl: 1.3,
      blk: 0.5,
      tov: 2.0,
      fg: 47.3,
      fg3: 40.1,
      ft: 91.6
    },
    "damianlillard": {
      stats_season: "2024-25",
      gp: 58,
      pts: 24.9,
      reb: 4.7,
      ast: 7.1,
      stl: 1.2,
      blk: 0.2,
      tov: 2.8,
      fg: 44.8,
      fg3: 37.6,
      ft: 92.1
    },
    "tyresehaliburton": {
      stats_season: "2024-25",
      gp: 73,
      pts: 18.6,
      reb: 3.5,
      ast: 9.2,
      stl: 1.4,
      blk: 0.7,
      tov: 1.3,
      fg: 47.3,
      fg3: 38.8,
      ft: 85.1
    }
  };

  const normalizeName = (name) => String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]/g, "");

  window.PLAYER_SEASON_STAT_OVERRIDES = overrides;
  window.applyPlayerSeasonStatsOverrides = (teams) => {
    if (!Array.isArray(teams)) throw new TypeError("Expected an array of teams for player stat overrides.");

    const applied = new Set();
    teams.forEach((team) => {
      ["starters_2026_27", "bench_2026_27"].forEach((rosterKey) => {
        (Array.isArray(team[rosterKey]) ? team[rosterKey] : []).forEach((player) => {
          const playerKey = normalizeName(player.name);
          const stats = overrides[playerKey];
          if (!stats) return;
          Object.assign(player, stats);
          applied.add(playerKey);
        });
      });
    });

    const missing = Object.keys(overrides).filter((playerKey) => !applied.has(playerKey));
    if (missing.length) {
      throw new Error(`Player stat override roster entries missing: ${missing.join(", ")}`);
    }
    return teams;
  };
})();
