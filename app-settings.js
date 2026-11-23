(function () {
  const appConfigs = {
    nba_hub: {
      label: "NBA Hub",
      back: "index.html",
      intro: "Choose your default NBA Hub view, appearance, and game-day preferences.",
      defaults: {
        theme: "default",
        favoriteTeam: "",
        defaultSeason: "",
        standingsConference: "Western",
        schedulePhase: "all",
        compactCards: false,
        reduceMotion: false
      }
    },
    trade_machine: {
      label: "Trade Machine",
      back: "trade-machine.html",
      intro: "Set your trade-planning assumptions and choose how roster and salary information appears.",
      defaults: {
        salaryCap: 164961000,
        firstApron: 209015000,
        secondApron: 221686000,
        minimumTeamSalary: 148465000,
        compact: false,
        salaryDisplay: "auto",
        showHeadshots: true,
        salaryMatching: true,
        apronHardCaps: true,
        minimumTeamSalaryFloor: true,
        signAndTradeRules: true,
        protectedPickRules: true,
        rosterSizeRules: true
      }
    },
    build_15: {
      label: "Build a $15 Team",
      back: "cap-space-manager.html",
      intro: "Personalize your player board and choose how much player information to show.",
      defaults: {
        playerSort: "random",
        compactCards: false,
        showStats: true,
        showPlayerImages: true
      }
    }
  };
  const nbaTeams = [
    "Atlanta Hawks", "Boston Celtics", "Brooklyn Nets", "Charlotte Hornets", "Chicago Bulls",
    "Cleveland Cavaliers", "Dallas Mavericks", "Denver Nuggets", "Detroit Pistons", "Golden State Warriors",
    "Houston Rockets", "Indiana Pacers", "Los Angeles Clippers", "Los Angeles Lakers", "Memphis Grizzlies",
    "Miami Heat", "Milwaukee Bucks", "Minnesota Timberwolves", "New Orleans Pelicans", "New York Knicks",
    "Oklahoma City Thunder", "Orlando Magic", "Philadelphia 76ers", "Phoenix Suns", "Portland Trail Blazers",
    "Sacramento Kings", "San Antonio Spurs", "Toronto Raptors", "Utah Jazz", "Washington Wizards"
  ];
  const appId = new URLSearchParams(window.location.search).get("app_id");
  const config = appConfigs[appId];
  const form = document.getElementById("settingsPageForm");
  const profileForm = document.getElementById("settingsProfileForm");
  const sections = document.getElementById("settingsSections");
  const status = document.getElementById("settingsPageStatus");
  const saveButton = document.getElementById("settingsSaveButton");
  const profileStatus = document.getElementById("settingsProfileStatus");
  const profileSaveButton = document.getElementById("settingsProfileSaveButton");
  const signOutButton = document.getElementById("settingsSignOutButton");

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function option(value, label) {
    return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
  }

  function selectField(name, label, options) {
    return `<label class="settings-field">${label}<select name="${name}">${options}</select></label>`;
  }

  function numberField(name, label, value, max = 1000000000) {
    return `<label class="settings-field">${label}<input name="${name}" type="number" min="1000000" max="${max}" step="100000" value="${value}" required></label>`;
  }

  function checkboxField(name, label, description = "") {
    return `<label class="settings-checkbox"><input name="${name}" type="checkbox"><span>${label}${description ? `<small>${description}</small>` : ""}</span></label>`;
  }

  function section(title, description, fields) {
    const fieldMarkup = Array.isArray(fields) ? fields.join("") : fields;
    return `<section class="settings-section"><h2>${title}</h2><p>${description}</p><div class="settings-fields">${fieldMarkup}</div></section>`;
  }

  function currentSeason() {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "numeric"
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type, Number(part.value)]));
    const startYear = values.month >= 7 ? values.year : values.year - 1;
    return `${startYear}-${String(startYear + 1).slice(-2)}`;
  }

  function seasonOptions() {
    const currentStart = Number(currentSeason().slice(0, 4));
    const choices = [option("", "Use current season")];
    for (let year = currentStart; year >= 1999; year -= 1) {
      const value = `${year}-${String(year + 1).slice(-2)}`;
      choices.push(option(value, value.replace("-", "–")));
    }
    return choices.join("");
  }

  function fieldsForApp() {
    if (appId === "nba_hub") {
      return [
        section("Your NBA Hub", "Set the home team and the season views used when you visit the hub.", [
          selectField("favoriteTeam", "Favorite team", [
            option("", "No favorite team"),
            ...nbaTeams.map(team => option(team, team))
          ].join("")),
          selectField("defaultSeason", "Default season", seasonOptions()),
          selectField("standingsConference", "Default standings conference", [
            option("Western", "Western Conference"),
            option("Eastern", "Eastern Conference")
          ].join("")),
          selectField("schedulePhase", "Default schedule phase", [
            option("all", "All games"),
            option("preseason", "Preseason"),
            option("regular", "Regular season"),
            option("playoffs", "Playoffs")
          ].join(""))
        ]),
        section("Appearance & accessibility", "Adjust the hub display without changing your Game Picks rewards.", [
          selectField("theme", "Theme", [
            option("default", "NBA Hub"),
            option("high-contrast", "High contrast")
          ].join("")),
          checkboxField("compactCards", "Compact dashboard cards"),
          checkboxField("reduceMotion", "Reduce animations")
        ])
      ].join("");
    }

    if (appId === "trade_machine") {
      return [
        section("2026–27 cap assumptions", "These are your planning estimates. They do not change official NBA rules.", [
          numberField("salaryCap", "Salary cap (USD)", config.defaults.salaryCap),
          numberField("firstApron", "First apron (USD)", config.defaults.firstApron),
          numberField("secondApron", "Second apron (USD)", config.defaults.secondApron),
          numberField("minimumTeamSalary", "Minimum team salary (USD)", config.defaults.minimumTeamSalary)
        ]),
        section("Roster display", "Choose how salary and player details are shown in trade scenarios.", [
          selectField("salaryDisplay", "Salary figures", [
            option("auto", "Automatic (responsive)"),
            option("full", "Full dollar amounts"),
            option("compact", "Compact amounts (for example, $25.0M)")
          ].join("")),
          checkboxField("compact", "Compact team cards"),
          checkboxField("showHeadshots", "Show player headshots")
        ]),
        section("Trade sliders", "Turn off NBA trade restrictions to explore unrestricted fantasy trade scenarios.", [
          checkboxField("salaryMatching", "Salary matching", "Apply outgoing/incoming salary limits."),
          checkboxField("apronHardCaps", "Apron and hard-cap checks", "Check first- and second-apron limits."),
          checkboxField("minimumTeamSalaryFloor", "Minimum team salary", "Check whether a roster stays above the salary floor."),
          checkboxField("signAndTradeRules", "Sign-and-trade restrictions", "Apply player eligibility and contract estimates."),
          checkboxField("protectedPickRules", "Protected-pick rules", "Require conveyance and protection checks."),
          checkboxField("rosterSizeRules", "Roster size limits", "Limit the number of active players per team.")
        ])
      ].join("");
    }

    return [
      section("Player board", "Choose how players are selected and ordered in each price tier.", [
        selectField("playerSort", "Sort players", [
          option("random", "Random sample"),
          option("name", "Name (A–Z)"),
          option("points", "Points per game (high to low)")
        ].join("")),
        checkboxField("compactCards", "Compact player cards")
      ]),
      section("Player card details", "Keep the information you want visible while building your lineup.", [
        checkboxField("showStats", "Show player stats", "Points, rebounds, assists, games played, and season."),
        checkboxField("showPlayerImages", "Show player portraits and team marks")
      ])
    ].join("");
  }

  function setDisabled(disabled) {
    for (const control of form.elements) control.disabled = disabled;
  }

  function populate(settings) {
    for (const [name, defaultValue] of Object.entries(config.defaults)) {
      const control = form.elements.namedItem(name);
      if (!control) continue;
      const value = settings[name] ?? defaultValue;
      if (control.type === "checkbox") control.checked = value === true;
      else control.value = String(value);
    }
  }

  function readForm() {
    const settings = {};
    for (const control of form.elements) {
      if (!control.name) continue;
      settings[control.name] = control.type === "checkbox"
        ? control.checked
        : control.type === "number"
          ? Number(control.value)
          : control.value;
    }
    return settings;
  }

  function showSignInPrompt(openSignIn = false) {
    setDisabled(true);
    for (const control of profileForm.elements) control.disabled = true;
    document.getElementById("settingsProfileRole").textContent = "Signed out";
    profileStatus.textContent = "Sign in to view and edit your profile.";
    status.textContent = "Sign in to edit and save these settings to your Supabase account.";
    if (openSignIn) window.NBAHubAuth.open("Sign in to edit and save app settings.");
  }

  async function initialize() {
    if (!config) {
      status.className = "settings-page-status is-error";
      status.textContent = "This settings page does not match a supported app.";
      setDisabled(true);
      return;
    }

    document.body.dataset.settingsApp = appId;
    document.title = `${config.label} Settings`;
    document.getElementById("settingsAppLabel").textContent = config.label.toUpperCase();
    document.getElementById("settingsIntroText").textContent = config.intro;
    for (const linkId of ["settingsBackLink", "settingsCancelLink"]) {
      document.getElementById(linkId).href = config.back;
    }
    sections.innerHTML = fieldsForApp();
    document.getElementById("settingsAccountLink").addEventListener("click", event => {
      event.preventDefault();
      window.NBAHubAuth.open();
    });

    await window.NBAHubAuth.ready;
    const refreshAuthState = () => {
      if (!window.NBAHubAuth.isSignedIn()) {
        showSignInPrompt();
        return;
      }
      setDisabled(false);
      for (const control of profileForm.elements) control.disabled = false;
      const session = window.NBAHubAuth.getSession();
      const profileUsername = document.getElementById("settingsProfileUsername");
      const profileDisplayName = document.getElementById("settingsProfileDisplayName");
      const avatarPreview = document.getElementById("settingsProfileAvatarPreview");
      const avatarFallback = document.getElementById("settingsProfileAvatarFallback");
      document.getElementById("settingsProfileEmail").value = session.email || "";
      document.getElementById("settingsProfileRole").textContent =
        session.role === "admin" ? "Administrator" : "User";
      if (document.activeElement !== profileUsername) profileUsername.value = session.username || "";
      if (document.activeElement !== profileDisplayName) {
        profileDisplayName.value = session.display_name || session.username || "";
      }
      if (session.avatar_url) {
        avatarPreview.src = session.avatar_url;
        avatarPreview.hidden = false;
        avatarFallback.hidden = true;
      } else {
        avatarPreview.hidden = true;
        avatarFallback.hidden = false;
        const name = session.display_name || session.username || "Account";
        avatarFallback.textContent = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
      }
      profileStatus.className = "settings-page-status";
      profileStatus.textContent = session.username
        ? "This username belongs to your profile in this app."
        : "Choose a username for this app to make username sign-in available.";
      populate({ ...config.defaults, ...window.NBAHubAuth.getSettings() });
      const accountLink = document.getElementById("settingsAccountLink");
      const accountName = session.display_name || session.username || "Account";
      accountLink.innerHTML = session.avatar_url
        ? `<img class="settings-account-avatar" src="${escapeHtml(session.avatar_url)}" alt=""><span>${escapeHtml(accountName)}</span>`
        : `<span class="settings-account-fallback">${escapeHtml(accountName.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase())}</span><span>${escapeHtml(accountName)}</span>`;
      status.className = "settings-page-status";
      status.textContent = "Settings are saved to your account for this app.";
    };
    window.addEventListener("nba-hub-auth-changed", refreshAuthState);
    refreshAuthState();

    profileForm.addEventListener("submit", async event => {
      event.preventDefault();
      if (!window.NBAHubAuth.isSignedIn()) {
        showSignInPrompt(true);
        return;
      }
      profileSaveButton.disabled = true;
      profileStatus.className = "settings-page-status";
      profileStatus.textContent = "Saving your app profile…";
      try {
        const avatarFile = document.getElementById("settingsProfileAvatar").files?.[0];
        const avatarUrl = await window.NBAHubAuth.uploadProfileAvatar(avatarFile);
        await window.NBAHubAuth.saveProfile({
          username: document.getElementById("settingsProfileUsername").value.trim(),
          display_name: document.getElementById("settingsProfileDisplayName").value.trim(),
          avatar_url: avatarUrl
        });
        profileStatus.className = "settings-page-status is-success";
        profileStatus.textContent = "Profile picture, display name, and username saved.";
      } catch (error) {
        profileStatus.className = "settings-page-status is-error";
        profileStatus.textContent = error instanceof Error ? error.message : "Could not save your username.";
      } finally {
        profileSaveButton.disabled = false;
      }
    });

    signOutButton.addEventListener("click", async () => {
      signOutButton.disabled = true;
      await window.NBAHubAuth.logout();
      window.location.href = config.back;
    });

    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (!window.NBAHubAuth.isSignedIn()) {
        showSignInPrompt(true);
        return;
      }
      saveButton.disabled = true;
      status.className = "settings-page-status";
      status.textContent = "Saving your settings…";
      try {
        await window.NBAHubAuth.saveSettings(readForm());
        status.className = "settings-page-status is-success";
        status.textContent = "Settings saved to your Supabase account.";
      } catch (error) {
        status.className = "settings-page-status is-error";
        status.textContent = error instanceof Error ? error.message : "Could not save your settings.";
      } finally {
        saveButton.disabled = false;
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
