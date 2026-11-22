(function () {
  const pages = {
    "nba-today": {
      title: "NBA Today",
      sections: ["hero", "hub-reward-panels"]
    },
    "injury-watch": {
      title: "Injury Watch",
      sections: ["injuryReportSection"]
    },
    transactions: {
      title: "NBA Transactions",
      sections: ["transactionsSection"]
    },
    schedule: {
      title: "Live Scores & Schedule",
      sections: ["scheduleSection"]
    },
    "game-picks": {
      title: "Game Picks",
      sections: ["gamePicksSection"]
    },
    standings: {
      title: "Standings",
      sections: ["standingsSection"]
    },
    teams: {
      title: "Teams Directory",
      sections: ["teamsSection"]
    }
  };
  const requestedPage = new URLSearchParams(window.location.search).get("page");
  const pageId = Object.hasOwn(pages, requestedPage) ? requestedPage : "nba-today";
  const page = pages[pageId];
  const visibleSections = new Set(page.sections);

  document.body.dataset.hubPage = pageId;
  document.title = `${page.title} | NBA Hub`;
  document.querySelectorAll("body > section").forEach(section => {
    const visible = visibleSections.has(section.id);
    section.hidden = !visible;
    section.style.display = visible ? "" : "none";
  });
  document.querySelectorAll("#hubProfileBanner, .hub-reward-panels").forEach(element => {
    const visible = pageId === "nba-today";
    element.hidden = !visible;
    element.style.display = visible ? "" : "none";
  });
  document.querySelectorAll("[data-hub-page-link]").forEach(link => {
    if (link.dataset.hubPageLink === pageId) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
})();
