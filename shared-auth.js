(function () {
  const API_URL = "https://my-fastapi-nba.vercel.app";
  const path = window.location.pathname.toLowerCase();
  const appContexts = {
    nba_hub: { id: "nba_hub", name: "NBA Hub", label: "NBA Hub" },
    trade_machine: { id: "trade_machine", name: "NBA Trade Machine", label: "Trade Machine" },
    build_15: { id: "build_15", name: "Build a $15 Team", label: "Build a $15 Game" }
  };
  const requestedAppId = new URLSearchParams(window.location.search).get("app_id");
  const appContext = appContexts[requestedAppId]
    ||     (path.includes("trade-machine") || path.includes("trade-community") || path.includes("trade-home")
    ? { id: "trade_machine", name: "NBA Trade Machine", label: "Trade Machine" }
    : path.includes("cap-space-manager")
      ? { id: "build_15", name: "Build a $15 Team", label: "Build a $15 Game" }
      : appContexts.nba_hub);
  const SESSION_KEY = `nba-hub.auth-session.${appContext.id}.v1`;
  const GUEST_KEY = `nba-hub.guest-mode.${appContext.id}.v1`;
  const LEGACY_GUEST_KEY = `nba-hub.auth-mode.${appContext.id}.v1`;
  const ADMIN_SESSION_KEY = "nba-hub.admin-auth-session.v1";
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }
  function getInitials(value) {
    return String(value).trim().split(/\s+/).filter(Boolean).slice(0, 2)
      .map(part => part[0].toUpperCase()).join("") || "A";
  }
  let authConfig = null;
  let session = null;
  let guest = false;
  let resolveReady;
  const ready = new Promise(resolve => {
    resolveReady = resolve;
  });

  function loadStoredMode() {
    try {
      const savedSession = localStorage.getItem(SESSION_KEY)
        || localStorage.getItem(ADMIN_SESSION_KEY);
      if (savedSession) {
        session = JSON.parse(savedSession);
        if (!session.access_token || !session.refresh_token) session = null;
        if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      }
      const savedGuest = localStorage.getItem(GUEST_KEY) === "guest";
      const legacyGuest = localStorage.getItem(LEGACY_GUEST_KEY) === "guest"
        || sessionStorage.getItem(LEGACY_GUEST_KEY) === "guest";
      guest = !session && (savedGuest || legacyGuest);
      if (legacyGuest) localStorage.setItem(GUEST_KEY, "guest");
      localStorage.removeItem(LEGACY_GUEST_KEY);
      sessionStorage.removeItem(LEGACY_GUEST_KEY);
    } catch {
      session = null;
      guest = false;
    }
  }

  function saveSession(payload) {
    const expiresAt = Number(payload.expires_at)
      ? Number(payload.expires_at) * 1000
      : Date.now() + Number(payload.expires_in || 3600) * 1000;
    session = {
      id: payload.user?.id || session?.id || "",
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
      expires_at: expiresAt,
      username: payload.user?.user_metadata?.username || session?.username || "",
      display_name: session?.display_name || payload.user?.user_metadata?.display_name || "",
      avatar_url: session?.avatar_url || payload.user?.user_metadata?.avatar_url || "",
      role: session?.role || "user",
      email: payload.user?.email || session?.email || "",
      settings: session?.settings || {}
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    localStorage.removeItem(LEGACY_GUEST_KEY);
    sessionStorage.removeItem(LEGACY_GUEST_KEY);
    guest = false;

    if (appContext.id === "build_15") {
      sessionStorage.setItem("cap-space-manager.supabase-auth-session.v1", JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        email: payload.user?.email || ""
      }));
    }
    window.dispatchEvent(new CustomEvent("nba-hub-auth-changed"));
  }

  async function getAuthConfig() {
    if (authConfig) return authConfig;
    const response = await fetch(`${API_URL}/api/v1/auth/config`);
    const payload = await response.json();
    if (!response.ok || !payload.supabase_url || !payload.publishable_key) {
      throw new Error(payload.detail || "Sign-in is unavailable.");
    }
    authConfig = payload;
    return authConfig;
  }

  async function authRequest(path, body, accessToken = "") {
    const config = await getAuthConfig();
    const headers = {
      "Content-Type": "application/json",
      apikey: config.publishable_key
    };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const response = await fetch(`${config.supabase_url}/auth/v1/${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.msg || payload.message || payload.error_description || "Authentication failed.");
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  async function refreshSession() {
    if (!session?.refresh_token) return false;
    try {
      const payload = await authRequest("token?grant_type=refresh_token", {
        refresh_token: session.refresh_token
      });
      if (!payload.access_token || !payload.refresh_token) {
        throw new Error("Supabase did not return a refreshed session.");
      }
      saveSession(payload);
      return true;
    } catch (error) {
      if (error.status === 400 || error.status === 401) {
        localStorage.removeItem(SESSION_KEY);
        session = null;
        return false;
      }
      console.warn("Could not refresh the Supabase session; keeping the stored session for retry.", error);
      return false;
    }
  }

  async function loadSessionRole() {
    if (!session?.access_token) return null;
    if (Number(session.expires_at) && session.expires_at <= Date.now() + 60_000) {
      await refreshSession();
      if (!session?.access_token) return null;
    }
    try {
      let response = await fetch(`${API_URL}/api/v1/auth/session?app_id=${encodeURIComponent(appContext.id)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      let refreshedSession = false;
      if (response.status === 401) {
        refreshedSession = await refreshSession();
        if (refreshedSession) {
          response = await fetch(`${API_URL}/api/v1/auth/session?app_id=${encodeURIComponent(appContext.id)}`, {
            headers: { Authorization: `Bearer ${session.access_token}` }
          });
        } else if (session?.access_token) {
          console.warn("Could not verify the current Supabase session; keeping it for retry.");
          return session;
        }
      }
      if (!response.ok) {
        if (response.status === 401 && (!session?.access_token || refreshedSession)) {
          localStorage.removeItem(SESSION_KEY);
          session = null;
          guest = localStorage.getItem(GUEST_KEY) === "guest";
          applyAppSettings(appSettingsDefaults());
          return null;
        }
        console.warn(`Could not load the ${appContext.id} profile (${response.status}); keeping the current session.`);
        return session;
      }
      const payload = await response.json();
      session.id = payload.id || session.id || "";
      session.email = payload.email;
      session.role = payload.role;
      session.username = payload.username || session.username || "";
      session.display_name = payload.display_name || session.display_name || "";
      session.avatar_url = payload.avatar_url || session.avatar_url || "";
      session.settings = payload.settings && typeof payload.settings === "object" ? payload.settings : {};
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      if (payload.role === "admin") {
        localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
      } else if (session.role !== "admin") {
        localStorage.removeItem(ADMIN_SESSION_KEY);
      }
      applyAppSettings(session.settings);
    } catch (error) {
      console.warn(`Could not load the ${appContext.id} profile; keeping the current session.`, error);
    }
    return session;
  }

  function ensureStyles() {
    if (document.querySelector('link[href^="shared-auth.css"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "shared-auth.css";
    document.head.appendChild(link);
  }

  function ensureOverlay() {
    const existing = document.getElementById("sharedAuthOverlay");
    if (existing) return existing;
    const overlay = document.createElement("div");
    overlay.className = `shared-auth-overlay shared-auth-overlay--${appContext.id}`;
    overlay.id = "sharedAuthOverlay";
    overlay.hidden = true;
    overlay.innerHTML = `
      <section class="shared-auth-card" role="dialog" aria-modal="true" aria-labelledby="sharedAuthTitle">
        <header class="shared-auth-header">
          <span class="shared-auth-kicker">${appContext.label}</span>
          <button class="shared-auth-close" id="sharedAuthClose" type="button" aria-label="Close account panel" title="Close" hidden>×</button>
          <h2 id="sharedAuthTitle">Welcome to ${appContext.name}</h2>
          <p>Sign in with your username, or create an account to save your profile.</p>
        </header>
        <div class="shared-auth-tabs" role="tablist">
          <button class="shared-auth-tab is-active" type="button" data-auth-mode="signin">Sign in</button>
          <button class="shared-auth-tab" type="button" data-auth-mode="signup">Create account</button>
        </div>
        <form class="shared-auth-form" id="sharedAuthForm">
          <label id="sharedAuthSignupUsernameLabel" hidden>Username
            <input id="sharedAuthSignupUsername" type="text" autocomplete="nickname" minlength="3" maxlength="24" pattern="[A-Za-z0-9][A-Za-z0-9_-]{2,23}" />
          </label>
          <label id="sharedAuthIdentifierLabel">Username
            <input id="sharedAuthIdentifier" type="text" autocomplete="username" minlength="2" maxlength="254" placeholder="Username" required />
          </label>
          <p class="shared-auth-hint" id="sharedAuthLoginHint">Existing accounts without a username can sign in once with their email to set one.</p>
          <label id="sharedAuthEmailLabel" hidden>Email
            <input id="sharedAuthEmail" type="email" autocomplete="email" maxlength="254" />
          </label>
          <label>Password
            <input id="sharedAuthPassword" type="password" autocomplete="current-password" minlength="8" maxlength="128" required />
          </label>
          <p class="shared-auth-status" id="sharedAuthStatus" role="status"></p>
          <button class="shared-auth-primary" id="sharedAuthSubmit" type="submit">Sign in</button>
          <button class="shared-auth-guest" id="sharedAuthGuest" type="button">Continue as Guest</button>
        </form>
        <section class="shared-auth-profile" id="sharedAuthProfile" hidden>
          <p class="shared-auth-status" id="sharedAuthProfileStatus" role="status"></p>
          <div class="shared-auth-profile__identity">
            <img id="sharedAuthProfileAvatarPreview" class="shared-auth-profile__avatar" alt="Profile picture" hidden>
            <span id="sharedAuthProfileAvatarFallback" class="shared-auth-profile__avatar shared-auth-profile__avatar--fallback">A</span>
          </div>
          <label>Profile picture
            <input id="sharedAuthProfileAvatar" type="file" accept="image/jpeg,image/png,image/webp,image/gif" />
          </label>
          <label>Display name
            <input id="sharedAuthProfileDisplayName" type="text" autocomplete="name" minlength="2" maxlength="48" />
          </label>
          <label>Username
            <input id="sharedAuthProfileUsername" type="text" autocomplete="nickname" minlength="3" maxlength="24" pattern="[A-Za-z0-9][A-Za-z0-9_-]{2,23}" />
          </label>
          <button class="shared-auth-primary" id="sharedAuthSaveUsername" type="button">Save username</button>
          <button class="shared-auth-logout" id="sharedAuthLogout" type="button">Sign out</button>
        </section>
      </section>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#sharedAuthClose").addEventListener("click", () => {
      overlay.hidden = true;
    });

    let mode = "signin";
    const tabs = overlay.querySelectorAll("[data-auth-mode]");
    const submit = overlay.querySelector("#sharedAuthSubmit");
    const status = overlay.querySelector("#sharedAuthStatus");
    const form = overlay.querySelector("#sharedAuthForm");
    const signupUsername = overlay.querySelector("#sharedAuthSignupUsername");
    const signupUsernameLabel = overlay.querySelector("#sharedAuthSignupUsernameLabel");
    const identifierLabel = overlay.querySelector("#sharedAuthIdentifierLabel");
    const identifier = overlay.querySelector("#sharedAuthIdentifier");
    const emailLabel = overlay.querySelector("#sharedAuthEmailLabel");
    const emailInput = overlay.querySelector("#sharedAuthEmail");
    const loginHint = overlay.querySelector("#sharedAuthLoginHint");
    const profileUsername = overlay.querySelector("#sharedAuthProfileUsername");
    const profileDisplayName = overlay.querySelector("#sharedAuthProfileDisplayName");
    const profileAvatar = overlay.querySelector("#sharedAuthProfileAvatar");
    const profileStatus = overlay.querySelector("#sharedAuthProfileStatus");
    overlay.querySelector("#sharedAuthLogout").addEventListener("click", () => {
      window.NBAHubAuth.logout();
    });
    overlay.querySelector("#sharedAuthSaveUsername").addEventListener("click", async () => {
      const username = profileUsername.value.trim();
      const displayName = profileDisplayName.value.trim();
      const avatarFile = profileAvatar.files?.[0];
      profileStatus.className = "shared-auth-status";
      profileStatus.textContent = avatarFile ? "Uploading profile picture…" : "Saving profile…";
      try {
        const avatarUrl = await uploadProfileAvatar(avatarFile);
        await saveProfile({
          username,
          display_name: displayName,
          avatar_url: avatarUrl
        });
        profileStatus.className = "shared-auth-status is-success";
        profileStatus.textContent = "Profile picture, display name, and username saved.";
        updateAccountButton();
      } catch (error) {
        profileStatus.className = "shared-auth-status is-error";
        profileStatus.textContent = error instanceof Error ? error.message : "Could not save username.";
      }
    });

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        mode = tab.dataset.authMode;
        tabs.forEach((item) => item.classList.toggle("is-active", item === tab));
        submit.textContent = mode === "signup" ? "Create account" : "Sign in";
        signupUsernameLabel.hidden = mode !== "signup";
        signupUsername.required = mode === "signup";
        identifierLabel.hidden = mode === "signup";
        identifier.required = mode !== "signup";
        emailLabel.hidden = mode !== "signup";
        emailInput.required = mode === "signup";
        loginHint.hidden = mode === "signup";
        status.textContent = "";
        status.className = "shared-auth-status";
      });
    });

    overlay.querySelector("#sharedAuthGuest").addEventListener("click", () => {
      guest = true;
      localStorage.setItem(GUEST_KEY, "guest");
      localStorage.removeItem(LEGACY_GUEST_KEY);
      sessionStorage.removeItem(LEGACY_GUEST_KEY);
      overlay.hidden = true;
      updateAccountButton();
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = emailInput.value.trim();
      const password = overlay.querySelector("#sharedAuthPassword").value;
      const username = signupUsername.value.trim();
      const loginName = identifier.value.trim();
      if (mode === "signup" && username.length < 3) {
        status.className = "shared-auth-status is-error";
        status.textContent = "Username must contain at least 2 non-space characters.";
        return;
      }
      submit.disabled = true;
      status.className = "shared-auth-status";
      status.textContent = mode === "signup" ? "Creating your account…" : "Signing in…";
      try {
        const endpoint = mode === "signup" ? "signup" : "login";
        const body = mode === "signup"
          ? { username, email, password }
          : { username: loginName, password };
        const response = await fetch(
          `${API_URL}/api/v1/auth/${endpoint}?app_id=${encodeURIComponent(appContext.id)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
          }
        );
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.detail || `Authentication failed (${response.status}).`);
        if (mode === "signup" && (!payload.access_token || !payload.refresh_token)) {
          status.className = "shared-auth-status is-success";
          status.textContent = "Account created. Check your email, confirm it, then sign in.";
          return;
        }
        if (!payload.access_token || !payload.refresh_token) {
          throw new Error("Supabase did not return a complete sign-in session.");
        }
        saveSession(payload);
        const loadedSession = await loadSessionRole();
        if (!loadedSession) throw new Error("Could not load your Supabase profile. Please sign in again.");
        overlay.hidden = true;
        updateAccountButton();
        emitAuthChanged();
      } catch (error) {
        status.className = "shared-auth-status is-error";
        status.textContent = error instanceof Error ? error.message : "Authentication failed.";
      } finally {
        submit.disabled = false;
      }
    });

    return overlay;
  }

  function ensureAccountButton() {
    if (document.getElementById("sharedAuthAccount")) return;
    if (window.location.pathname.toLowerCase().endsWith("/app-settings.html")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.id = "sharedAuthAccount";
    button.className = `shared-auth-account shared-auth-account--${appContext.id}`;
    button.addEventListener("click", () => {
      const overlay = document.getElementById("sharedAuthOverlay");
      if (overlay) overlay.hidden = false;
    });
    const container = appContext.id === "trade_machine"
      ? document.querySelector(".topbar")
      : appContext.id === "build_15"
        ? document.querySelector(".masthead__right")
        : document.querySelector(".nav-container");
    if (container) container.appendChild(button);
    else document.body.appendChild(button);
  }

  function appSettingsDefaults() {
    if (appContext.id === "nba_hub") {
      return {
        theme: "default",
        favoriteTeam: "",
        defaultSeason: "",
        standingsConference: "Western",
        schedulePhase: "all",
        compactCards: false,
        reduceMotion: false
      };
    }
    if (appContext.id === "trade_machine") {
      return {
        salaryCap: 164961000,
        firstApron: 209015000,
        secondApron: 221686000,
        minimumTeamSalary: 148465000,
        compact: false,
        salaryDisplay: "auto",
        showHeadshots: true
      };
    }
    return {
      playerSort: "random",
      compactCards: false,
      showStats: true,
      showPlayerImages: true
    };
  }

  function applyAppSettings(settings = {}) {
    if (appContext.id === "nba_hub") {
      window.NBAHubAppSettings?.apply(settings);
      return;
    }
    const appSettings = window.NBAHubAppSettings;
    if (appSettings && appSettings.appId === appContext.id) appSettings.apply(settings);
  }

  async function saveSettings(settings) {
    if (!session?.access_token) throw new Error("Sign in to save app settings.");
    const response = await fetch(
      `${API_URL}/api/v1/auth/settings?app_id=${encodeURIComponent(appContext.id)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ settings })
      }
    );
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || `Could not save settings (${response.status}).`);
    session.settings = payload.settings;
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    applyAppSettings(session.settings);
    return session.settings;
  }

  async function uploadProfileAvatar(file) {
    if (!session?.access_token) throw new Error("Sign in to update your profile.");
    if (!file) return session.avatar_url || "";
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      throw new Error("Choose a JPG, PNG, WebP, or GIF image.");
    }
    if (file.size > 3145728) throw new Error("Profile pictures must be 3 MB or smaller.");
    const config = await getAuthConfig();
    const extension = ({
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif"
    })[file.type];
    const userId = session.id;
    if (!userId) throw new Error("Your user ID could not be loaded. Sign in again.");
    const path = `${userId}/${appContext.id}.${extension}`;
    const response = await fetch(
      `${config.supabase_url}/storage/v1/object/profile-pictures/${encodeURIComponent(path).replace(/%2F/g, "/")}`,
      {
        method: "POST",
        headers: {
          apikey: config.publishable_key,
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": file.type,
          "Cache-Control": "3600",
          "x-upsert": "true"
        },
        body: file
      }
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || payload.error || "Could not upload your profile picture.");
    return `${config.supabase_url}/storage/v1/object/public/profile-pictures/${encodeURIComponent(path).replace(/%2F/g, "/")}`;
  }

  async function saveProfile(profile) {
    if (!session?.access_token) throw new Error("Sign in to update your profile.");
    const username = profile.username;
    const displayName = String(profile.display_name || "").trim();
    const avatarUrl = String(profile.avatar_url || "").trim();
    const response = await fetch(
      `${API_URL}/api/v1/auth/profile?app_id=${encodeURIComponent(appContext.id)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          username,
          display_name: displayName,
          avatar_url: avatarUrl
        })
      }
    );
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || `Could not save username (${response.status}).`);
    session.username = payload.username;
    session.display_name = payload.display_name || displayName || payload.username;
    session.avatar_url = payload.avatar_url || avatarUrl || "";
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    updateAccountButton();
    emitAuthChanged();
    return payload;
  }

  async function saveUsername(username) {
    return saveProfile({
      username,
      display_name: session.display_name || username,
      avatar_url: session.avatar_url || ""
    });
  }

  function ensureSettingsButton() {
    if (document.getElementById("sharedSettingsTrigger")) return;
    const container = appContext.id === "trade_machine"
      ? document.querySelector(".topbar__info")
      : appContext.id === "build_15"
        ? document.querySelector(".masthead__right")
        : document.querySelector(".nav-container");
    if (!container) return;
    const button = document.createElement("button");
    button.id = "sharedSettingsTrigger";
    button.type = "button";
    button.className = `shared-settings-trigger shared-settings-trigger--${appContext.id}`;
    button.textContent = "Settings";
    button.addEventListener("click", () => {
      window.location.href = `app-settings.html?app_id=${encodeURIComponent(appContext.id)}`;
    });
    container.appendChild(button);
  }

  function updateAccountButton() {
    ensureAccountButton();
    ensureSettingsButton();
    const button = document.getElementById("sharedAuthAccount");
    if (session) {
      const label = session.role === "admin" ? "Admin" : "Account";
      const name = session.display_name || session.username || session.email || "";
      button.innerHTML = session.avatar_url
        ? `<img class="shared-auth-account__avatar" src="${escapeHtml(session.avatar_url)}" alt=""><span>${escapeHtml(name)}</span>`
        : `<span class="shared-auth-account__fallback">${escapeHtml(getInitials(name))}</span><span>${escapeHtml(name)}</span>`;
    } else if (guest) {
      button.textContent = "Guest · Sign in";
    } else {
      button.textContent = "Sign in";
    }

    const overlay = document.getElementById("sharedAuthOverlay");
    if (!overlay) return;
    const tabs = overlay.querySelector(".shared-auth-tabs");
    const form = overlay.querySelector("#sharedAuthForm");
    const profile = overlay.querySelector("#sharedAuthProfile");
    const status = overlay.querySelector("#sharedAuthStatus");
    if (session) {
      tabs.hidden = true;
      form.hidden = true;
      profile.hidden = false;
      overlay.querySelector("#sharedAuthClose").hidden = false;
      overlay.querySelector("#sharedAuthProfileUsername").value = session.username || "";
      overlay.querySelector("#sharedAuthProfileDisplayName").value =
        session.display_name || session.username || "";
      const avatarPreview = overlay.querySelector("#sharedAuthProfileAvatarPreview");
      const avatarFallback = overlay.querySelector("#sharedAuthProfileAvatarFallback");
      if (session.avatar_url) {
        avatarPreview.src = session.avatar_url;
        avatarPreview.hidden = false;
        avatarFallback.hidden = true;
      } else {
        avatarPreview.hidden = true;
        avatarFallback.hidden = false;
        avatarFallback.textContent = getInitials(session.display_name || session.username || "Account");
      }
      overlay.querySelector("#sharedAuthProfileStatus").className = "shared-auth-status";
      overlay.querySelector("#sharedAuthProfileStatus").textContent = session.username
        ? `${session.role === "admin" ? "Administrator" : "Signed in"}${session.email ? ` · ${session.email}` : ""}.`
        : "Choose a username for this app. It will be saved to Supabase.";
    } else {
      tabs.hidden = false;
      form.hidden = false;
      profile.hidden = true;
      overlay.querySelector("#sharedAuthClose").hidden = true;
      status.textContent = guest ? "Guest mode is active." : "";
      status.className = "shared-auth-status";
    }
  }

  function emitAuthChanged() {
    window.dispatchEvent(new CustomEvent("nba-hub-auth-changed"));
  }

  async function initialize() {
    try {
      ensureStyles();
      loadStoredMode();
      const overlay = ensureOverlay();
      ensureAccountButton();
      applyGuestRestrictions();
      if (session) await loadSessionRole();
      overlay.hidden = true;
      updateAccountButton();
    } finally {
      resolveReady(session);
      window.dispatchEvent(new CustomEvent("nba-hub-auth-ready"));
    }
  }

  function getGuestRestrictionMessage(target) {
    if (appContext.id === "build_15") return "Sign in or create an account to draft players and create challenges. Guests can browse the game.";
    if (appContext.id === "trade_machine") return "Sign in to add more teams or submit a community trade proposal. Guests can build and review two-team trades.";
    if (target.closest("#gamePicksGamesGrid, #placeGamePicksBet, #claimDailyGameTokens, #gamePicksRewardGrid, #collectPlayerCard, #saveStandingsPrediction, #standingsPredictionGrid, #clearStandingsPrediction")) {
      return "Sign in or create an account to play Game Picks, claim rewards, and save predictions. Guests can browse NBA Hub.";
    }
    return "Sign in or create an account to use this feature. Guests can browse NBA Hub.";
  }

  function requireSignIn(message) {
    if (session?.access_token) return true;
    open(message);
    return false;
  }

  function open(message = "") {
    const overlay = document.getElementById("sharedAuthOverlay");
    if (!overlay) return;
    overlay.hidden = false;
    const status = overlay.querySelector(
      session ? "#sharedAuthProfileStatus" : "#sharedAuthStatus"
    );
    if (message && status) {
      status.className = "shared-auth-status";
      status.textContent = message;
    }
  }

  function applyGuestRestrictions() {
    const selectors = appContext.id === "build_15"
      ? ["[data-pick-player]", "[data-remove-pick]", "#newBoard", "#footerNewBoard", "#clearLineup", "[data-start-challenge]", "#openCreateChallenge", "#createChallengeForm"]
      : appContext.id === "trade_machine"
        ? ["#savedTradesBtn", "#saveTradeBtn", "#editSavedTradeBtn", ".saved-trade-load", ".saved-trade-delete"]
        : [
          "#claimDailyGameTokens", "#placeGamePicksBet", "#gamePicksGamesGrid [data-game-picks-event]",
          "#gamePicksGamesGrid [data-game-picks-challenge]", "#gamePicksRewardGrid [data-game-picks-reward]",
          "#collectPlayerCard", "#resetGamePicksReward", "#saveStandingsPrediction",
          "#standingsPredictionGrid", "#clearStandingsPrediction"
        ];
    const isRestricted = (target) => selectors.some((selector) => target.closest(selector));
    document.addEventListener("click", (event) => {
      if (!isRestricted(event.target) || session?.access_token) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      requireSignIn(getGuestRestrictionMessage(event.target));
    }, true);
    document.addEventListener("submit", (event) => {
      if (!isRestricted(event.target) || session?.access_token) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      requireSignIn(getGuestRestrictionMessage(event.target));
    }, true);
  }

  window.NBAHubAuth = {
    ready,
    getSession: () => session,
    getSettings: () => session?.settings || appSettingsDefaults(),
    isGuest: () => guest || !session?.access_token,
    isAdmin: () => Boolean(session && session.role === "admin"),
    isSignedIn: () => Boolean(session?.access_token),
    requireSignIn,
    open,
    saveSettings,
    saveUsername,
    saveProfile,
    uploadProfileAvatar,
    logout: async () => {
      const wasAdmin = Boolean(session?.role === "admin");
      if (session?.access_token) {
        try {
          await authRequest("logout", {}, session.access_token);
        } catch {}
      }
      localStorage.removeItem(SESSION_KEY);
      if (wasAdmin) {
        localStorage.removeItem(ADMIN_SESSION_KEY);
        Object.keys(appContexts).forEach((id) => {
          localStorage.removeItem(`nba-hub.auth-session.${id}.v1`);
        });
      }
      localStorage.removeItem(LEGACY_GUEST_KEY);
      sessionStorage.removeItem(LEGACY_GUEST_KEY);
      sessionStorage.removeItem("cap-space-manager.supabase-auth-session.v1");
      session = null;
      guest = localStorage.getItem(GUEST_KEY) === "guest";
      applyAppSettings(appSettingsDefaults());
      emitAuthChanged();
      ensureOverlay().hidden = guest;
      updateAccountButton();
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();
