(function () {
  const API_URL = "https://my-fastapi-nba.vercel.app";
  const PAGE_SIZE = 20;
  const communityTradesEl = document.getElementById("communityTrades");
  const statusEl = document.getElementById("communityFeedStatus");
  const accessNoteEl = document.getElementById("communityAccessNote");
  const refreshButton = document.getElementById("refreshCommunityBtn");
  const loadMoreButton = document.getElementById("loadMoreCommunityBtn");
  const NBA_TEAM_INFO = {
    1: { abbreviation: "BOS", nbaId: "1610612738" },
    2: { abbreviation: "BKN", nbaId: "1610612751" },
    3: { abbreviation: "NYK", nbaId: "1610612752" },
    4: { abbreviation: "PHI", nbaId: "1610612755" },
    5: { abbreviation: "TOR", nbaId: "1610612761" },
    6: { abbreviation: "CHI", nbaId: "1610612741" },
    7: { abbreviation: "CLE", nbaId: "1610612739" },
    8: { abbreviation: "DET", nbaId: "1610612765" },
    9: { abbreviation: "IND", nbaId: "1610612754" },
    10: { abbreviation: "MIL", nbaId: "1610612749" },
    11: { abbreviation: "MIA", nbaId: "1610612748" },
    12: { abbreviation: "ATL", nbaId: "1610612737" },
    13: { abbreviation: "CHA", nbaId: "1610612766" },
    14: { abbreviation: "ORL", nbaId: "1610612753" },
    15: { abbreviation: "WAS", nbaId: "1610612764" },
    16: { abbreviation: "DEN", nbaId: "1610612743" },
    17: { abbreviation: "MIN", nbaId: "1610612750" },
    18: { abbreviation: "OKC", nbaId: "1610612760" },
    19: { abbreviation: "POR", nbaId: "1610612757" },
    20: { abbreviation: "UTA", nbaId: "1610612762" },
    21: { abbreviation: "GSW", nbaId: "1610612744" },
    22: { abbreviation: "LAC", nbaId: "1610612746" },
    23: { abbreviation: "LAL", nbaId: "1610612747" },
    24: { abbreviation: "PHX", nbaId: "1610612756" },
    25: { abbreviation: "SAC", nbaId: "1610612758" },
    26: { abbreviation: "DAL", nbaId: "1610612742" },
    27: { abbreviation: "HOU", nbaId: "1610612745" },
    28: { abbreviation: "MEM", nbaId: "1610612763" },
    29: { abbreviation: "NOP", nbaId: "1610612740" },
    30: { abbreviation: "SAS", nbaId: "1610612759" }
  };
  let offset = 0;
  let isLoading = false;
  let hasMore = true;
  const communityTradeById = new Map();

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "Recently"
      : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
  }

  function formatMoney(value) {
    const amount = Number(value);
    return Number.isFinite(amount)
      ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount)
      : "Unavailable";
  }

  function getSeasonLabel(trade) {
    const season = String(trade.season || "2026-27");
    const match = season.match(/^(\d{4})-(\d{2}|\d{4})$/);
    if (!match) return season;
    const endYear = match[2].length === 2 ? String(Number(match[1]) + 1) : match[2];
    return `${match[1]}-${endYear}`;
  }

  function getTeamInfo(team) {
    const info = NBA_TEAM_INFO[Number(team.id)];
    const abbreviation = /^[A-Z0-9]{2,3}$/.test(String(team.abbreviation || ""))
      ? String(team.abbreviation)
      : info?.abbreviation || String(team.name || "NBA").slice(0, 3).toUpperCase();
    const suppliedLogo = String(team.logo || "");
    const logo = /^https:\/\/cdn\.nba\.com\/logos\/nba\/\d{10}\/primary\/L\/logo\.svg$/i.test(suppliedLogo)
      ? suppliedLogo
      : info
        ? `https://cdn.nba.com/logos/nba/${info.nbaId}/primary/L/logo.svg`
        : "";
    return { abbreviation, logo };
  }

  function getPlayerInitials(name) {
    return String(name || "NBA")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toLocaleUpperCase())
      .join("");
  }

  function isIncomingTo(asset, team) {
    if (asset.toTeamId !== undefined && team.id !== undefined) {
      return String(asset.toTeamId) === String(team.id);
    }
    return String(asset.toTeamName || "").trim().toLowerCase()
      === String(team.name || "").trim().toLowerCase();
  }

  function teamRow(team, trade) {
    const info = getTeamInfo(team);
    const incomingPlayers = (Array.isArray(trade.players) ? trade.players : [])
      .filter((player) => isIncomingTo(player, team));
    const incomingPicks = (Array.isArray(trade.picks) ? trade.picks : [])
      .filter((pick) => isIncomingTo(pick, team));
    const frontOfficeActions = (Array.isArray(trade.frontOfficeActions) ? trade.frontOfficeActions : [])
      .filter((action) => Number(action.teamId) === Number(team.id));
    const playerAssets = incomingPlayers.map((player) => {
      const name = String(player.name || "Player");
      const headshot = window.getPlayerHeadshotUrl?.(name) || "";
      const fallbackHeadshot = window.getPlayerFallbackPortraitUrl?.(name) || "";
      return `
        <span class="community-trade-player">
          <img class="community-trade-player__headshot" src="${escapeHtml(headshot)}" data-community-image data-fallback-src="${escapeHtml(fallbackHeadshot)}" alt="" aria-hidden="true" loading="lazy">
          <span class="community-trade-player__fallback" hidden>${escapeHtml(getPlayerInitials(name))}</span>
          <strong>${escapeHtml(name)}</strong>
          ${player.transactionType === "sign-and-trade"
            ? `<small class="community-trade-player__transaction">${Number(player.signAndTradeContract?.years) || 3}-year sign & trade</small>`
            : ""}
        </span>
      `;
    });
    const pickAssets = incomingPicks.map((pick) => {
      const round = Number(pick.round) === 1 ? 1 : 2;
      const pickType = pick.assetType === "swap" ? "swap" : "pick";
      const year = String(pick.year || "Future");
      const roundLabel = round === 1 ? "1st" : "2nd";
      const label = `${year} ${roundLabel}${pickType === "swap" ? " swap" : ""}`;
      return `
        <span class="community-trade-pick" title="${escapeHtml(label)}">
          <span class="community-trade-pick__mark" aria-hidden="true">${round}</span>
          <span>${escapeHtml(label)}</span>
        </span>
      `;
    });
    const actionAssets = frontOfficeActions.map((action) => {
      const label = ({
        waived: "Waived",
        stretched: "Stretched",
        buyout: "Buyout",
        "extension-estimate": "Extension",
        "re-signed": "Re-signed",
        "rights-renounced": "Rights renounced"
      })[action.actionType] || "Front-office action";
      const detail = ["waived", "stretched", "buyout"].includes(action.actionType)
        ? `${formatMoney(action.currentYearDeadMoney)} current-year dead cap`
        : action.actionType === "extension-estimate"
          ? `${Number(action.years) || 1}-year estimate · ${formatMoney(action.schedule?.[0]?.salary)} starting salary`
          : `${formatMoney(action.salary)} cap-hold amount`;
      return `<span class="community-trade-action"><strong>${escapeHtml(label)} · ${escapeHtml(action.playerName || "Player")}</strong><small>${escapeHtml(detail)}</small></span>`;
    });
    const assets = [...playerAssets, ...pickAssets, ...actionAssets].join("")
      || '<span class="community-trade-team__empty">No incoming assets</span>';

    return `
      <div class="community-trade-team" data-team-theme="${escapeHtml(info.abbreviation)}">
        <span class="community-trade-team__brand">
          ${info.logo
            ? `<img src="${escapeHtml(info.logo)}" data-community-image alt="" aria-hidden="true" loading="lazy"><span class="community-trade-team__fallback" hidden>${escapeHtml(info.abbreviation)}</span>`
            : `<span class="community-trade-team__fallback">${escapeHtml(info.abbreviation)}</span>`}
        </span>
        <strong class="community-trade-team__name">${escapeHtml(team.name || info.abbreviation)}</strong>
        <div class="community-trade-team__assets">${assets}</div>
      </div>
    `;
  }

  async function request(path, { method = "GET", body, authenticated = false } = {}) {
    const headers = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (authenticated) {
      const token = window.NBAHubAuth?.getSession()?.access_token;
      if (!token) throw new Error("Sign in to use community features.");
      headers.Authorization = `Bearer ${token}`;
    }
    const response = await fetch(`${API_URL}/api/v1/trade-machine/${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.detail || `Trade service request failed (${response.status}).`);
    return payload;
  }

  function tradeCard(trade) {
    const teams = Array.isArray(trade.teams) ? trade.teams : [];
    const players = Array.isArray(trade.players) ? trade.players : [];
    const picks = Array.isArray(trade.picks) ? trade.picks : [];
    const frontOfficeActions = Array.isArray(trade.frontOfficeActions) ? trade.frontOfficeActions : [];
    const isFrontOfficeOnly = !players.length && !picks.length && frontOfficeActions.length > 0;
    const comments = Array.isArray(trade.comments) ? trade.comments : [];
    const ratingSummary = trade.rating_average !== null && trade.rating_average !== undefined
      && Number.isFinite(Number(trade.rating_average))
      ? `★ ${Number(trade.rating_average).toFixed(1)} · ${Number(trade.rating_count) || 0} ratings`
      : "No ratings yet";
    const verdictClass = trade.verdictStatus === "pass" ? "pass" : trade.verdictStatus === "fail" ? "fail" : "attention";
    const verdictLabel = verdictClass === "pass" ? "Passes" : verdictClass === "fail" ? "Fails" : "Review";
    const postTitle = String(trade.postTitle || "").trim();
    const postExplanation = String(trade.postExplanation || "").trim();
    const creator = String(trade.creator || "NBA fan");
    const creatorInitials = creator.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();
    const verdictDetail = trade.validation && Array.isArray(trade.validation)
      ? trade.validation.find((check) => check.status === "fail")?.detail
        || trade.validation.find((check) => check.status === "attention")?.detail
        || "The trade passed the selected rule checks."
      : "The trade passed the selected rule checks.";
    const verdictIcon = verdictClass === "pass" ? "✓" : verdictClass === "fail" ? "×" : "!";

    return `
      <article class="community-trade-card">
        <header class="community-trade-card__header">
          <div>
            <span class="community-trade-card__avatar" aria-hidden="true">${escapeHtml(creatorInitials)}</span>
            <div>
              <div class="community-trade-card__creator"><strong>${escapeHtml(creator)}</strong></div>
              <p class="community-trade-card__byline">@${escapeHtml(creator.toLowerCase().replace(/[^a-z0-9]/g, "") || "nbafan")} · ${escapeHtml(formatDate(trade.createdAt))}</p>
              <p class="community-trade-card__meta"><span>${isFrontOfficeOnly ? "NBA FRONT OFFICE" : "NBA TRADE"}</span><span>${teams.length || 2}-team · ${escapeHtml(getSeasonLabel(trade))}</span></p>
            </div>
          </div>
        </header>
        ${postTitle || postExplanation ? `
          <section class="community-trade-post">
            ${postTitle ? `<h3>${escapeHtml(postTitle)}</h3>` : ""}
            ${postExplanation ? `<p>${escapeHtml(postExplanation)}</p>` : ""}
          </section>
        ` : ""}
        <section class="community-trade-verdict-panel community-trade-verdict-panel--${verdictClass}">
          <span class="community-trade-verdict-panel__icon" aria-hidden="true">${verdictIcon}</span>
          <div>
            <strong>${escapeHtml(verdictLabel)} <span>${escapeHtml(trade.verdict || "")}</span></strong>
            <p>${escapeHtml(verdictDetail)}</p>
          </div>
          <div class="community-trade-verdict-panel__tools">
            <button type="button" class="community-trade-tool" data-trade-snapshot="${escapeHtml(trade.id)}">Snapshot</button>
          </div>
        </section>
        <div class="community-trade-summary" aria-label="Trade assets and front-office actions by team">
          ${teams.map((team) => teamRow(team, trade)).join("")}
        </div>
        <div class="community-trade-feedback">
          <div class="community-rating">
            <strong>${escapeHtml(ratingSummary)}</strong>
            <div class="community-rating__buttons" aria-label="Rate this trade">
              ${[1, 2, 3, 4, 5].map((rating) => `
                <button type="button" class="community-rating-button" data-trade-rating="${escapeHtml(trade.id)}" data-rating-value="${rating}" aria-label="Rate ${rating} out of 5 stars">${rating}★</button>
              `).join("")}
            </div>
          </div>
          <section class="community-comments" aria-label="Trade comments">
            <h4>Comments <span>${comments.length}</span></h4>
            ${comments.length
              ? `<ul>${comments.map((comment) => `<li><strong>${escapeHtml(comment.creator || "NBA fan")}</strong><span>${escapeHtml(comment.comment || "")}</span></li>`).join("")}</ul>`
              : '<p class="community-comments__empty">No comments yet.</p>'}
            <form class="community-comment-form" data-community-comment-form data-trade-id="${escapeHtml(trade.id)}">
              <label class="sr-only" for="trade-comment-${escapeHtml(trade.id)}">Add a comment</label>
              <input id="trade-comment-${escapeHtml(trade.id)}" name="comment" maxlength="500" placeholder="Add a comment…" required />
              <button type="submit" class="button button--ghost">Post</button>
            </form>
          </section>
        </div>
      </article>
    `;
  }

  function bindImageFallbacks() {
    communityTradesEl.querySelectorAll("img[data-community-image]").forEach((image) => {
      if (image.dataset.fallbackBound) return;
      image.dataset.fallbackBound = "true";
      image.addEventListener("error", () => {
        const fallback = image.dataset.fallbackSrc || "";
        if (fallback && image.getAttribute("src") !== fallback) {
          image.src = fallback;
          return;
        }
        image.hidden = true;
        if (image.nextElementSibling) image.nextElementSibling.hidden = false;
      });
      if (image.complete && !image.naturalWidth) image.dispatchEvent(new Event("error"));
    });
  }

  function roundedRect(context, x, y, width, height, radius) {
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
  }

  function wrapText(context, text, x, y, maxWidth, lineHeight, maxLines) {
    const words = String(text || "").split(/\s+/);
    const lines = [];
    let line = "";
    words.forEach((word) => {
      const test = line ? `${line} ${word}` : word;
      if (context.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    });
    if (line) lines.push(line);
    lines.slice(0, maxLines).forEach((lineText, index) => {
      context.fillText(lineText, x, y + index * lineHeight);
    });
  }

  function loadCanvasImage(url) {
    return new Promise((resolve) => {
      if (!url) return resolve(null);
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = url;
    });
  }

  async function generateTradeSnapshot(trade) {
    const canvas = document.getElementById("tradeSnapshotCanvas");
    const context = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const baseWidth = activeSnapshotSize === "landscape" ? 1200 : 1080;
    const scale = width / baseWidth;
    const sx = (value) => value * scale;
    const sy = (value) => activeSnapshotSize === "landscape"
      ? value * (height / 675)
      : activeSnapshotSize === "square"
        ? value * (height / 1080)
        : value * (height / 1920);

    context.clearRect(0, 0, width, height);
    context.fillStyle = "#09111d";
    context.fillRect(0, 0, width, height);
    context.fillStyle = "#101c2a";
    context.fillRect(0, 0, width, sy(112));
    context.fillStyle = "#203248";
    context.fillRect(0, sy(112), width, sy(3));
    context.fillStyle = "#c9082a";
    context.fillRect(sx(54), sy(112), width - sx(108), sy(4));

    context.fillStyle = "#d7b66a";
    context.font = `700 ${sx(18)}px "IBM Plex Mono", monospace`;
    context.fillText("NBA TRADE DESK", sx(54), sy(38));
    context.fillStyle = "#edf3f4";
    context.font = `800 ${sx(38)}px "Space Grotesk", sans-serif`;
    wrapText(context, trade.postTitle || "Community trade proposal", sx(54), sy(82), sx(980), sx(42), 1);

    const teams = (trade.teams || []).slice(0, 2);
    const story = activeSnapshotSize === "story";
    const square = activeSnapshotSize === "square";
    const margin = sx(54);
    const gap = sx(story ? 18 : 20);
    const cardTop = sy(story ? 170 : square ? 150 : 150);
    const cardWidth = story ? width - sx(108) : (width - margin * 2 - gap) / 2;
    const cardHeight = sy(story ? 610 : square ? 690 : 390);
    const footerTop = height - sy(story ? 190 : square ? 130 : 92);
    const verdictHeight = sy(story ? 120 : square ? 92 : 62);

    for (let index = 0; index < teams.length; index += 1) {
      const team = teams[index];
      const x = story ? margin : margin + index * (cardWidth + gap);
      const y = story ? cardTop + index * (cardHeight + sy(24)) : cardTop;

      roundedRect(context, x, y, cardWidth, cardHeight, sx(14));
      context.fillStyle = "#111d2c";
      context.fill();
      context.strokeStyle = "#2a3d50";
      context.lineWidth = sx(2);
      context.stroke();
      context.fillStyle = "#c9082a";
      context.fillRect(x, y, sx(5), cardHeight);

      const logoUrl = getSnapshotTeamLogo(team);
      const logo = await loadCanvasImage(logoUrl);
      if (logo) {
        context.drawImage(logo, x + sx(24), y + sy(18), sx(62), sy(62));
      } else {
        context.fillStyle = "#1d2d3e";
        roundedRect(context, x + sx(24), y + sy(18), sx(62), sy(62), sx(31));
        context.fill();
      }
      context.fillStyle = "#edf3f4";
      context.font = `800 ${sx(story ? 26 : 23)}px "Space Grotesk", sans-serif`;
      context.fillText(team.name || "NBA Team", x + sx(104), y + sy(54));

      const incoming = (trade.players || []).filter((player) =>
        String(player.toTeamId) === String(team.id)
        || String(player.toTeamName || "").toLowerCase() === String(team.name || "").toLowerCase()
      );
      const outgoing = (trade.players || []).filter((player) =>
        String(player.fromTeamId) === String(team.id)
        || String(player.fromTeamName || "").toLowerCase() === String(team.name || "").toLowerCase()
      );
      const incomingPicks = (trade.picks || []).filter((pick) =>
        String(pick.toTeamId) === String(team.id)
        || String(pick.toTeamName || "").toLowerCase() === String(team.name || "").toLowerCase()
      );
      const incomingSalary = incoming.reduce((total, player) => total + Number(player.salary || 0), 0);
      const outgoingSalary = outgoing.reduce((total, player) => total + Number(player.salary || 0), 0);
      const netPayroll = incomingSalary - outgoingSalary;

      context.fillStyle = "#142438";
      roundedRect(context, x + sx(24), y + sy(92), cardWidth - sx(48), sy(58), sx(8));
      context.fill();
      context.fillStyle = "#91a3b4";
      context.font = `700 ${sx(10)}px "IBM Plex Mono", monospace`;
      context.fillText("NET PAYROLL", x + sx(42), y + sy(112));
      context.fillStyle = netPayroll >= 0 ? "#77dfa9" : "#ff8989";
      context.font = `800 ${sx(16)}px "IBM Plex Mono", monospace`;
      context.fillText(`${netPayroll >= 0 ? "+" : "-"}${formatMoneyForSnapshot(Math.abs(netPayroll))}`, x + sx(42), y + sy(138));

      let rowY = y + sy(178);
      context.fillStyle = "#8ea0ad";
      context.font = `700 ${sx(11)}px "IBM Plex Mono", monospace`;
      context.fillText("RECEIVES", x + sx(24), rowY);
      rowY += sy(24);

      for (const player of incoming.slice(0, story ? 6 : 4)) {
        const headshot = await loadCanvasImage(window.getPlayerHeadshotUrl?.(player.name) || "");
        const cardX = x + sx(24);
        const cardWidthNow = cardWidth - sx(48);
        const cardHeightNow = sy(story ? 68 : 54);
        roundedRect(context, cardX, rowY, cardWidthNow, cardHeightNow, sx(8));
        context.fillStyle = "#162638";
        context.fill();
        context.strokeStyle = "#294158";
        context.lineWidth = sx(1);
        context.stroke();
        context.save();
        context.beginPath();
        context.rect(cardX + sx(6), rowY + sy(5), sx(48), cardHeightNow - sy(10));
        context.clip();
        if (headshot) {
          context.drawImage(headshot, cardX + sx(6), rowY + sy(4), sx(48), cardHeightNow - sy(8));
        } else {
          context.fillStyle = "#24384b";
          context.fillRect(cardX + sx(6), rowY + sy(4), sx(48), cardHeightNow - sy(8));
        }
        context.restore();
        context.fillStyle = "#eef4f6";
        context.font = `800 ${sx(15)}px "Space Grotesk", sans-serif`;
        context.fillText(player.name || "Player", cardX + sx(64), rowY + sy(20));
        context.fillStyle = "#d8c08a";
        context.font = `700 ${sx(14)}px "IBM Plex Mono", monospace`;
        context.fillText(formatMoneyForSnapshot(player.salary), cardX + cardWidthNow - sx(116), rowY + sy(20));
        context.fillStyle = "#91a3b4";
        context.font = `600 ${sx(9)}px "IBM Plex Mono", monospace`;
        const contractYears = Number(player.contract_years_remaining);
        const detail = [
          player.position || "NBA",
          Number.isInteger(contractYears) ? `${contractYears} yr${contractYears === 1 ? "" : "s"} remaining` : "Years unavailable"
        ].join(" · ");
        context.fillText(detail, cardX + sx(64), rowY + sy(38));
        rowY += cardHeightNow + sy(8);
      }
      if (!incoming.length) {
        context.fillStyle = "#71879a";
        context.font = `600 ${sx(13)}px "Space Grotesk", sans-serif`;
        context.fillText("No incoming players", x + sx(24), rowY + sy(10));
      }

      const outgoingY = y + cardHeight - sy(story ? 92 : 82);
      context.fillStyle = "#142438";
      roundedRect(context, x + sx(24), outgoingY, cardWidth - sx(48), sy(story ? 68 : 58), sx(8));
      context.fill();
      context.fillStyle = "#91a3b4";
      context.font = `700 ${sx(9)}px "IBM Plex Mono", monospace`;
      context.fillText("OUTGOING", x + sx(42), outgoingY + sy(17));
      context.fillStyle = "#eef4f6";
      context.font = `800 ${sx(11)}px "Space Grotesk", sans-serif`;
      const outgoingLabels = outgoing.map((player) => player.name);
      (trade.picks || []).filter((pick) =>
        String(pick.fromTeamId) === String(team.id)
      ).forEach((pick) => outgoingLabels.push(`${pick.year} ${pick.round === 1 ? "1st" : "2nd"}`));
      if (!outgoingLabels.length) {
        context.fillText("No outgoing assets", x + sx(42), outgoingY + sy(40));
      } else {
        const outgoingLimit = cardWidth > sx(420) ? 3 : 2;
        const outgoingPlayers = outgoing.slice(0, outgoingLimit);
        let outgoingX = x + sx(42);
        for (const player of outgoingPlayers) {
          const headshot = await loadCanvasImage(window.getPlayerHeadshotUrl?.(player.name) || "");
          context.save();
          context.beginPath();
          context.arc(outgoingX + sx(16), outgoingY + sy(39), sx(16), 0, Math.PI * 2);
          context.clip();
          if (headshot) context.drawImage(headshot, outgoingX, outgoingY + sy(23), sx(32), sx(32));
          else {
            context.fillStyle = "#24384b";
            context.fillRect(outgoingX, outgoingY + sy(23), sx(32), sx(32));
          }
          context.restore();
          context.fillStyle = "#eef4f6";
          context.font = `800 ${sx(8)}px "Space Grotesk", sans-serif`;
          wrapText(context, player.name || "Player", outgoingX + sx(38), outgoingY + sy(36), sx(118), sx(10), 1);
          outgoingX += sx(158);
        }
        const pickLabels = outgoingLabels.filter((label) => !outgoing.some((player) => player.name === label));
        if (pickLabels.length) {
          context.fillStyle = "#d8c08a";
          context.font = `700 ${sx(8)}px "IBM Plex Mono", monospace`;
          wrapText(context, pickLabels.join(" · "), outgoingX, outgoingY + sy(40), cardWidth - (outgoingX - x) - sx(42), sx(10), 1);
        }
      }
    }

    roundedRect(context, sx(54), footerTop, width - sx(108), verdictHeight, sx(10));
    context.fillStyle = trade.verdictStatus === "fail" ? "#28161d" : "#102a25";
    context.fill();
    context.strokeStyle = trade.verdictStatus === "fail" ? "#6a3036" : "#2f6f5e";
    context.lineWidth = sx(2);
    context.stroke();
    context.fillStyle = trade.verdictStatus === "fail" ? "#ff8989" : "#77dfa9";
    context.font = `800 ${sx(18)}px "Space Grotesk", sans-serif`;
    context.fillText(trade.verdict || "TRADE REVIEW", sx(82), footerTop + sy(34));
    context.fillStyle = "#91a3b4";
    context.font = `700 ${sx(10)}px "IBM Plex Mono", monospace`;
    context.fillText(`${teams.length || 2}-TEAM DEAL  ·  ${trade.season || "2026-27"}`, sx(82), footerTop + sy(story ? 68 : 52));
  }

  function getSnapshotTeamLogo(team) {
    const suppliedLogo = String(team?.logo || "");
    if (/^https:\/\/cdn\.nba\.com\/logos\/nba\/\d{10}\/primary\/L\/logo\.svg$/i.test(suppliedLogo)) {
      return suppliedLogo;
    }
    const info = NBA_TEAM_INFO[Number(team?.id)];
    return info
      ? `https://cdn.nba.com/logos/nba/${info.nbaId}/primary/L/logo.svg`
      : "";
  }

  function formatMoneyForSnapshot(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return "";
    return amount >= 1_000_000
      ? `$${(amount / 1_000_000).toFixed(1)}M`
      : `$${amount.toLocaleString("en-US")}`;
  }

  const snapshotDialog = document.getElementById("tradeSnapshotDialog");
  document.getElementById("closeTradeSnapshot")?.addEventListener("click", () => snapshotDialog.close());
  snapshotDialog?.addEventListener("click", (event) => {
    if (event.target === snapshotDialog) snapshotDialog.close();
  });

  let activeSnapshotCanvas = null;
  let activeSnapshotTrade = null;
  let activeSnapshotSize = "landscape";
  document.querySelectorAll("[data-snapshot-size]").forEach((button) => {
    button.addEventListener("click", async () => {
      document.querySelectorAll("[data-snapshot-size]").forEach((item) => item.classList.toggle("is-active", item === button));
      activeSnapshotSize = button.dataset.snapshotSize;
      const canvas = document.getElementById("tradeSnapshotCanvas");
      if (activeSnapshotSize === "square") {
        canvas.width = 1080;
        canvas.height = 1080;
      } else if (activeSnapshotSize === "story") {
        canvas.width = 1080;
        canvas.height = 1920;
      } else {
        canvas.width = 1200;
        canvas.height = 675;
      }
      if (activeSnapshotTrade) await generateTradeSnapshot(activeSnapshotTrade);
    });
  });
  document.getElementById("downloadTradeSnapshot")?.addEventListener("click", () => {
    const canvas = document.getElementById("tradeSnapshotCanvas");
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "nba-trade-snapshot.png";
      link.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  });
  document.getElementById("copyTradeSnapshot")?.addEventListener("click", async () => {
    const canvas = document.getElementById("tradeSnapshotCanvas");
    if (!navigator.clipboard?.write || !window.ClipboardItem) {
      window.alert("Image copying is not supported in this browser. Use Download PNG.");
      return;
    }
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      statusEl.textContent = "Trade snapshot copied";
    }, "image/png");
  });

  communityTradesEl.addEventListener("click", async (event) => {
    const snapshotButton = event.target.closest("[data-trade-snapshot]");
    if (snapshotButton) {
      const trade = communityTradeById.get(snapshotButton.dataset.tradeSnapshot);
      if (!trade) return;
      activeSnapshotTrade = trade;
      await generateTradeSnapshot(trade);
      activeSnapshotCanvas = document.getElementById("tradeSnapshotCanvas");
      snapshotDialog.showModal();
      return;
    }
  });

  function updateAccessNote() {
    if (!accessNoteEl) return;
    accessNoteEl.textContent = window.NBAHubAuth?.isSignedIn()
      ? "Your submitted trades, comments, and ratings are shared with the community."
      : "Browse proposals as a guest. Sign in to submit a trade, comment, or rate a proposal.";
  }

  async function loadTrades({ reset = false } = {}) {
    if (isLoading || (!hasMore && !reset)) return;
    isLoading = true;
    if (reset) {
      offset = 0;
      hasMore = true;
      communityTradeById.clear();
      communityTradesEl.replaceChildren();
    }
    statusEl.textContent = "Loading community proposals…";
    loadMoreButton.disabled = true;
    try {
      const result = await request(`trades?limit=${PAGE_SIZE}&offset=${offset}`);
      if (!Array.isArray(result.trades)) throw new Error("Trade service returned an invalid community feed.");
      if (!result.trades.length && offset === 0) {
        communityTradesEl.innerHTML = '<div class="community-feed-empty"><strong>No community trades yet</strong><span>Build and submit a proposal to start the conversation.</span></div>';
      } else {
        result.trades.forEach((trade) => communityTradeById.set(String(trade.id), trade));
        communityTradesEl.insertAdjacentHTML("beforeend", result.trades.map(tradeCard).join(""));
        bindImageFallbacks();
      }
      offset += result.trades.length;
      hasMore = result.trades.length === PAGE_SIZE;
      statusEl.textContent = `${offset} ${offset === 1 ? "proposal" : "proposals"} shown`;
      loadMoreButton.hidden = !hasMore;
    } catch (error) {
      console.error("Community trade feed failed to load:", error);
      statusEl.textContent = "Community feed unavailable";
      if (!offset) {
        communityTradesEl.innerHTML = `<div class="community-feed-empty">${escapeHtml(error.message || "Trade proposals could not be loaded.")}</div>`;
      }
    } finally {
      loadMoreButton.disabled = false;
      isLoading = false;
    }
  }

  communityTradesEl.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-community-comment-form]");
    if (!form) return;
    event.preventDefault();
    if (!window.NBAHubAuth?.requireSignIn("Sign in to comment on a trade proposal.")) return;
    const submitButton = form.querySelector('button[type="submit"]');
    const comment = String(new FormData(form).get("comment") || "").trim();
    if (!comment) return;
    submitButton.disabled = true;
    try {
      const createdComment = await request(`trades/${encodeURIComponent(form.dataset.tradeId)}/comments`, {
        method: "POST",
        authenticated: true,
        body: { comment }
      });
      const card = form.closest(".community-trade-card");
      const commentsList = card?.querySelector(".community-comments ul");
      const commentsEmpty = card?.querySelector(".community-comments__empty");
      const commentsHeading = card?.querySelector(".community-comments h4 span");
      if (commentsEmpty) commentsEmpty.remove();
      const list = commentsList || document.createElement("ul");
      if (!commentsList) {
        card?.querySelector(".community-comments")?.insertBefore(list, form);
      }
      const item = document.createElement("li");
      item.innerHTML = `<strong>${escapeHtml(createdComment.creator || "NBA fan")}</strong><span>${escapeHtml(createdComment.comment || comment)}</span>`;
      list.appendChild(item);
      if (commentsHeading) {
        commentsHeading.textContent = String((Number(commentsHeading.textContent) || 0) + 1);
      }
      form.reset();
      submitButton.disabled = false;
      statusEl.textContent = "Comment posted";
    } catch (error) {
      console.error("Trade comment submission failed:", error);
      window.alert(error.message || "Your comment could not be posted.");
      submitButton.disabled = false;
    }
  });

  communityTradesEl.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-trade-rating]");
    if (!button) return;
    if (!window.NBAHubAuth?.requireSignIn("Sign in to rate a trade proposal.")) return;
    button.disabled = true;
    try {
      const ratingResult = await request(`trades/${encodeURIComponent(button.dataset.tradeRating)}/rating`, {
        method: "POST",
        authenticated: true,
        body: { rating: Number(button.dataset.ratingValue) }
      });
      const card = button.closest(".community-trade-card");
      const summary = card?.querySelector(".community-rating > strong");
      if (summary && Number.isFinite(Number(ratingResult.rating_average))) {
        summary.textContent = `★ ${Number(ratingResult.rating_average).toFixed(1)} · ${Number(ratingResult.rating_count) || 0} ratings`;
      }
      card?.querySelectorAll("[data-trade-rating]").forEach((ratingButton) => {
        ratingButton.classList.toggle("is-selected", ratingButton === button);
        ratingButton.disabled = false;
      });
      statusEl.textContent = "Rating saved";
    } catch (error) {
      console.error("Trade rating submission failed:", error);
      window.alert(error.message || "Your rating could not be saved.");
      button.disabled = false;
    }
  });

  refreshButton.addEventListener("click", () => loadTrades({ reset: true }));
  loadMoreButton.addEventListener("click", () => loadTrades());
  window.addEventListener("nba-hub-auth-ready", updateAccessNote);
  window.addEventListener("nba-hub-auth-changed", updateAccessNote);
  updateAccessNote();
  loadTrades({ reset: true });
})();
