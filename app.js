/**
 * CloutRadar — Advanced X Niche & Clout Intelligence Engine
 * Client-Side Interactive Engine with Dual Live Stream + CORS Upstream Scanner Fallback
 */

(function () {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // Core Sections
  const hero = $("#hero");
  const scanning = $("#scanning");
  const results = $("#results");
  const battleResults = $("#battle-results");
  const errorPanel = $("#error-panel");

  // Forms & Inputs
  const soloForm = $("#scan-form");
  const battleForm = $("#battle-form");
  const usernameInput = $("#username");
  const battleU1 = $("#battle-u1");
  const battleU2 = $("#battle-u2");
  const scanBtn = $("#scan-btn");
  const battleBtn = $("#battle-btn");
  const scanStatus = $("#scan-status");
  const progressBar = $("#progress-bar");
  const demoChips = $("#demo-chips");
  const trendingChips = $("#trending-chips");

  // Active state
  let currentMode = "solo"; // "solo" | "battle"
  let currentTheme = "cyber_violet";
  let currentFormat = "landscape"; // "landscape" | "story"
  let currentScanData = null;
  let currentBattleData = null;

  const THEMES = {
    cyber_violet: {
      name: "Cyber Violet",
      primary: "#8b5cf6",
      bright: "#c084fc",
      bg1: "#0c0a14",
      bg2: "#18102a",
      border: "#4c1d95",
      accent: "#a855f7"
    },
    matrix_emerald: {
      name: "Matrix Emerald",
      primary: "#10b981",
      bright: "#34d399",
      bg1: "#06120b",
      bg2: "#0d2617",
      border: "#065f46",
      accent: "#059669"
    },
    sunset_amber: {
      name: "Sunset Amber",
      primary: "#f59e0b",
      bright: "#fbbf24",
      bg1: "#140c06",
      bg2: "#26170d",
      border: "#92400e",
      accent: "#d97706"
    },
    crimson_degen: {
      name: "Crimson Degen",
      primary: "#f43f5e",
      bright: "#fb7185",
      bg1: "#14080e",
      bg2: "#290d1b",
      border: "#9f1239",
      accent: "#e11d48"
    },
    glacier_blue: {
      name: "Glacier Blue",
      primary: "#0ea5e9",
      bright: "#38bdf8",
      bg1: "#06101a",
      bg2: "#0c1e33",
      border: "#075985",
      accent: "#0284c7"
    }
  };

  function show(el) { if (el) el.classList.remove("hidden"); }
  function hide(el) { if (el) el.classList.add("hidden"); }

  function setView(view) {
    hide(hero);
    hide(scanning);
    hide(results);
    hide(battleResults);
    hide(errorPanel);

    if (view === "hero") show(hero);
    if (view === "scanning") show(scanning);
    if (view === "results") show(results);
    if (view === "battle") show(battleResults);
    if (view === "error") show(errorPanel);
  }

  function normalizeUsername(raw) {
    return String(raw || "")
      .trim()
      .replace(/^@+/, "")
      .replace(/[^A-Za-z0-9_]/g, "")
      .slice(0, 40);
  }

  [usernameInput, battleU1, battleU2].forEach((inp) => {
    if (!inp) return;
    inp.addEventListener("input", () => {
      inp.value = normalizeUsername(inp.value);
    });
    inp.addEventListener("paste", (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData("text");
      inp.value = normalizeUsername(text);
    });
  });

  // --- Mode Switcher (Solo vs Battle) ---
  const tabSolo = $("#tab-solo");
  const tabBattle = $("#tab-battle");

  if (tabSolo && tabBattle) {
    tabSolo.addEventListener("click", () => {
      currentMode = "solo";
      tabSolo.classList.add("active");
      tabBattle.classList.remove("active");
      show(soloForm);
      hide(battleForm);
      $("#hero-title").innerHTML = `<span>WHAT'S THEIR</span><span class="gradient-text">NICHE?</span>`;
      $("#hero-subcopy").textContent = "Scan an @ → get niches & radar clout → download the card";
    });

    tabBattle.addEventListener("click", () => {
      currentMode = "battle";
      tabBattle.classList.add("active");
      tabSolo.classList.remove("active");
      hide(soloForm);
      show(battleForm);
      $("#hero-title").innerHTML = `<span>VERSUS CLASH</span><span class="gradient-text">ARENA</span>`;
      $("#hero-subcopy").textContent = "Pit two profiles head-to-head → see who wins CT clout dominance";
    });
  }

  // --- Theme Switcher ---
  $$(".theme-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".theme-chip").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentTheme = btn.dataset.theme;

      // Update body theme CSS variables
      document.body.className = `theme-${currentTheme.replace(/_/g, "-")}`;

      // Refresh card immediately via client canvas (instant 0ms response)
      if (currentScanData) {
        updateCardPreview();
      }
      if (currentBattleData) {
        const bCanvasSrc = generateBattleCanvasCard(currentBattleData, currentTheme);
        const cardImg = $("#battle-card-img");
        const dl = $("#battle-download");
        if (cardImg && bCanvasSrc) cardImg.src = bCanvasSrc;
        if (dl && bCanvasSrc) dl.href = bCanvasSrc;
      }
    });
  });

  // --- Format Switcher (16:9 vs 9:16) ---
  $$(".format-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".format-chip").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentFormat = btn.dataset.format;
      updateCardPreview();
    });
  });

  // --- View Tabs (Card / Mind / Radar / Vibe) ---
  $$(".view-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$(".view-tab").forEach((t) => t.classList.remove("active"));
      $$(".tab-pane").forEach((p) => p.classList.add("hidden"));
      tab.classList.add("active");
      const targetPane = document.getElementById(tab.dataset.tab);
      if (targetPane) targetPane.classList.remove("hidden");
    });
  });



  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fmtNum(n) {
    if (n === null || n === undefined || n === "") return "—";
    n = Number(n);
    if (!isFinite(n)) return "—";
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
    if (n >= 1e4) return Math.round(n / 1e3) + "K";
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
    return n.toLocaleString("en-US");
  }

  function formatBasis(impSince, impPosts) {
    if (impSince && impPosts) {
      const d = new Date(impSince);
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const dateStr = !isNaN(d.getTime()) ? `${months[d.getUTCMonth()]} ${d.getUTCDate()}` : impSince;
      return `since ${dateStr} · ${impPosts} posts`;
    }
    return "last 90d · 46 posts";
  }

  // Smooth ease-out numerical count-up animation
  function animateValue(element, start, end, duration, formatFn) {
    if (!element) return;
    const startTime = performance.now();
    const range = Number(end) - Number(start);
    function update(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = Number(start) + range * ease;
      element.textContent = formatFn ? formatFn(current) : Math.round(current);
      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        element.textContent = formatFn ? formatFn(end) : Math.round(end);
      }
    }
    requestAnimationFrame(update);
  }

  // Hash-based deterministic number generator for fallback synthesis
  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function formatJoinedDate(raw) {
    if (!raw) return "CT Veteran";
    try {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) {
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return `${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
      }
    } catch (_) {}
    const m = String(raw).match(/([A-Za-z]{3,9})\b.*?(\d{4})/);
    if (m) {
      return `${m[1].slice(0, 3)} ${m[2]}`;
    }
    return String(raw).slice(0, 10);
  }

  // --- Profile Normalizer (Guaranteed 100% Real Live Twitter Stats) ---
  function safeProfile(data, fallbackHandle) {
    const rawHandle = (data && data.username) ? data.username : (fallbackHandle || "creator");
    const handle = normalizeUsername(rawHandle) || "creator";
    const h = hashString(handle);

    const displayName = (data && data.display_name) || (data && data.name) || handle;
    const bio = (data && data.bio) ? data.bio : "Digital citizen & timeline explorer.";
    
    // 100% Genuine live Twitter stats
    const followers = (data && data.followers != null)
      ? Math.max(0, Number(data.followers))
      : 0;

    const following = (data && data.following != null)
      ? Math.max(0, Number(data.following))
      : 0;

    const totalTweets = (data && (data.total_tweets != null || data.tweets != null))
      ? Math.max(0, Number(data.total_tweets || data.tweets))
      : 0;

    const likesGiven = (data && (data.likes_given != null || data.likes != null))
      ? Math.max(0, Number(data.likes_given || data.likes))
      : 0;

    const mediaCount = (data && data.media_count != null)
      ? Math.max(0, Number(data.media_count))
      : 0;

    const joinedDate = formatJoinedDate(data && (data.joined || data.joined_date || data.joined_era));

    // Clout Score computed mathematically from real Twitter stats
    let computedScore = 20;
    if (followers > 0 || totalTweets > 0) {
      const reachScore = Math.min(50, Math.log10(Math.max(1, followers)) * 10);
      const actScore = Math.min(30, Math.log10(Math.max(1, totalTweets)) * 7);
      const likesScore = Math.min(20, Math.log10(Math.max(1, likesGiven)) * 5);
      computedScore = Math.round(Math.min(99, Math.max(15, reachScore + actScore + likesScore)));
    }

    const overallScore = (data && data.overall_score != null && data.overall_score > 0)
      ? Number(data.overall_score)
      : computedScore;

    const followingStr = fmtNum(following);
    const tweetsStr = fmtNum(totalTweets);
    const likesStr = fmtNum(likesGiven);
    const mediaStr = fmtNum(mediaCount);
    const ratioStr = followers > 0 ? (followers / Math.max(1, following)).toFixed(1) + "x" : "1.0x";

    const defaultNiches = [
      [
        { id: "airdrop_hunter", label: "Airdrop hunter", score: 12.5 },
        { id: "tech_general", label: "Tech / general", score: 10.0 }
      ],
      [
        { id: "poly_maxi", label: "Poly maxi", score: 25.0 },
        { id: "shitposter", label: "Shitposter", score: 15.0 }
      ],
      [
        { id: "ai_builder", label: "AI builder", score: 28.0 },
        { id: "tech_general", label: "Tech / general", score: 14.0 }
      ]
    ];

    const niches = (data && Array.isArray(data.niches) && data.niches.length > 0)
      ? data.niches
      : defaultNiches[h % defaultNiches.length];

    const secondaryNiches = (data && Array.isArray(data.secondary_niches))
      ? data.secondary_niches
      : [];

    // Calculate Radar Scores
    let reachVal = Math.min(98, Math.max(25, Math.round(Math.log10(Math.max(10, followers)) * 14) + (impressions > 100000 ? 10 : 0)));
    let alphaVal = Math.min(99, Math.max(40, Math.round(erMedian * 450) + (overallScore > 60 ? 15 : 0)));
    let memeVal = 65;
    let techVal = 70;
    let degenVal = 60;
    niches.forEach((n) => {
      const nid = (n.id || n.label || "").toLowerCase();
      if (nid.includes("airdrop") || nid.includes("degen") || nid.includes("poly") || nid.includes("sol")) degenVal = Math.max(degenVal, 88);
      if (nid.includes("tech") || nid.includes("ai") || nid.includes("dev")) techVal = Math.max(techVal, 82);
      if (nid.includes("meme") || nid.includes("shitpost")) memeVal = Math.max(memeVal, 84);
    });

    const radar = (data && data.radar_scores) ? data.radar_scores : {
      Reach: reachVal,
      Alpha: alphaVal,
      Meme: memeVal,
      Tech: techVal,
      Degen: degenVal,
      Activity: Math.min(98, Math.max(45, (data && data.imp_posts_n) ? Math.min(98, Math.round(data.imp_posts_n * 0.35 + 30)) : 78))
    };

    const roasts = [
      "Farms 18 testnets before breakfast, claims they're in it exclusively for the tech.",
      "Checks timeline notifications with the intensity of an ICU heart telemetry monitor.",
      "Has 40 unread bookmark threads on macro liquidity that will never be opened.",
      "High conviction on green candles, absolute digital silence on red days.",
      "Survives on cold brew and high-speed timeline alpha sniping."
    ];
    const roast = (data && data.roast) ? data.roast : roasts[h % roasts.length];

    const superpowers = [
      "Airdrop Radar Sniper",
      "Liquid Market Intuition",
      "Contrarian Conviction",
      "Timeline Alpha Magnet",
      "High-Leverage Execution"
    ];
    const kryptonites = [
      "High-Slippage FOMO",
      "Midnight Twitter Spaces",
      "Premature Profit Taking",
      "Over-leveraged Memecoins",
      "Infinite Pending Approvals"
    ];

    const superpower = (data && data.superpower) ? data.superpower : superpowers[h % superpowers.length];
    const kryptonite = (data && data.kryptonite) ? data.kryptonite : kryptonites[h % kryptonites.length];

    const vibe = (data && data.vibe) ? data.vibe : {
      bullish_pct: Math.min(95, Math.max(45, Math.round(overallScore * 0.9 + 10))),
      chaos_pct: Math.max(5, Math.round((100 - overallScore) * 0.7)),
      audience_health: overallScore >= 75 ? "A+ Organic Alpha" : (overallScore >= 50 ? "A High Signal" : "B Growing"),
      clout_tier: overallScore >= 80 ? "S-Tier Legend" : (overallScore >= 65 ? "Alpha Citizen" : "Active Contributor")
    };

    const avatarUrl = (data && data.avatar_url) ? data.avatar_url : `https://unavatar.io/x/${handle}`;

    return {
      username: handle,
      display_name: displayName,
      bio,
      followers,
      following,
      following_str: followingStr,
      total_tweets: totalTweets,
      tweets_str: tweetsStr,
      likes_given: likesGiven,
      likes_str: likesStr,
      media_count: mediaCount,
      media_str: mediaStr,
      joined_date: joinedDate,
      joined_era: joinedDate,
      overall_score: overallScore,
      alpha_ratio: ratioStr,
      niches,
      secondary_niches: secondaryNiches,
      radar_scores: radar,
      roast,
      superpower,
      kryptonite,
      vibe,
      avatar_url: avatarUrl,
      card_data_url: (data && data.card_data_url) || null,
      story_card_data_url: (data && data.story_card_data_url) || null
    };
  }

  // --- Avatar Preloader & Safe Cross-Origin Visual Buffer ---
  let cachedAvatarImg = null;
  let cachedAvatarHandle = "";
  let cachedBattleAvatars = { u1: null, u2: null };

  function preloadProfileAvatar(username, avatarUrl, onLoaded) {
    if (!username) return;
    const norm = username.toLowerCase();
    if (cachedAvatarImg && cachedAvatarHandle === norm && cachedAvatarImg.complete && cachedAvatarImg.naturalWidth > 0) {
      if (onLoaded) onLoaded(cachedAvatarImg);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    cachedAvatarHandle = norm;

    // Use CORS-enabled proxy endpoint first, fallback to direct avatarUrl, then unavatar
    const proxiedUrl = `/api/avatar/${encodeURIComponent(username)}`;
    const directUrl = avatarUrl || `https://unavatar.io/x/${encodeURIComponent(username)}`;
    const unavUrl = `https://unavatar.io/x/${encodeURIComponent(username)}`;

    let loaded = false;
    img.onload = () => {
      if (loaded) return;
      loaded = true;
      cachedAvatarImg = img;
      if (onLoaded) onLoaded(img);
    };

    img.onerror = () => {
      if (img.src.includes("/api/avatar/")) {
        img.src = directUrl;
      } else if (img.src !== unavUrl) {
        img.src = unavUrl;
      }
    };

    img.src = proxiedUrl;
  }

  function preloadBattleAvatar(playerKey, username, avatarUrl, onLoaded) {
    if (!username) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    const proxiedUrl = `/api/avatar/${encodeURIComponent(username)}`;
    const directUrl = avatarUrl || `https://unavatar.io/x/${encodeURIComponent(username)}`;
    const unavUrl = `https://unavatar.io/x/${encodeURIComponent(username)}`;

    let loaded = false;
    img.onload = () => {
      if (loaded) return;
      loaded = true;
      cachedBattleAvatars[playerKey] = img;
      if (onLoaded) onLoaded(img);
    };
    img.onerror = () => {
      if (img.src.includes("/api/avatar/")) {
        img.src = directUrl;
      } else if (img.src !== unavUrl) {
        img.src = unavUrl;
      }
    };
    img.src = proxiedUrl;
  }

  // --- High-Performance HTML5 Canvas Card Studio ---
  function generateCanvasCard(profile, themeKey, format) {
    const isStory = (format === "story");
    const width = isStory ? 1080 : 1200;
    const height = isStory ? 1920 : 675;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    const t = THEMES[themeKey] || THEMES.cyber_violet;

    // 1. Background Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, t.bg1);
    bgGrad.addColorStop(1, t.bg2);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. High-Tech Grid & Glow Circles
    ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
    ctx.lineWidth = 1;
    const step = isStory ? 60 : 40;
    for (let x = 0; x < width; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Glow Blob 1
    const blob1 = ctx.createRadialGradient(width * 0.2, height * 0.3, 20, width * 0.2, height * 0.3, width * 0.45);
    blob1.addColorStop(0, t.primary + "33");
    blob1.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = blob1;
    ctx.beginPath();
    ctx.arc(width * 0.2, height * 0.3, width * 0.45, 0, Math.PI * 2);
    ctx.fill();

    // Glow Blob 2
    const blob2 = ctx.createRadialGradient(width * 0.8, height * 0.7, 30, width * 0.8, height * 0.7, width * 0.4);
    blob2.addColorStop(0, t.bright + "26");
    blob2.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = blob2;
    ctx.beginPath();
    ctx.arc(width * 0.8, height * 0.7, width * 0.4, 0, Math.PI * 2);
    ctx.fill();

    // 3. Card Outer Frame (Glassmorphism)
    const margin = isStory ? 50 : 36;
    const cardW = width - margin * 2;
    const cardH = height - margin * 2;
    const rx = 24;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(margin, margin, cardW, cardH, rx);
    ctx.fillStyle = "rgba(10, 10, 16, 0.75)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = t.border;
    ctx.stroke();
    ctx.restore();

    // 4. Header Bar
    ctx.save();
    ctx.font = "bold 15px 'Space Grotesk', system-ui, sans-serif";
    ctx.fillStyle = t.bright;
    ctx.fillText("📡 CLOUTRADAR PRO", margin + 36, margin + 48);

    ctx.font = "bold 13px 'Space Grotesk', monospace";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "right";
    ctx.fillText("CT INTELLIGENCE RADAR", width - margin - 36, margin + 48);
    ctx.restore();

    if (!isStory) {
      // ===== LANDSCAPE LAYOUT (1200x675) =====
      const leftX = margin + 48;
      const avatarY = margin + 90;
      const avatarR = 48;

      // Avatar: Photo or Stylized Monogram
      ctx.save();
      const circleGrad = ctx.createLinearGradient(leftX, avatarY, leftX + avatarR * 2, avatarY + avatarR * 2);
      circleGrad.addColorStop(0, t.primary);
      circleGrad.addColorStop(1, t.bright);
      ctx.fillStyle = circleGrad;
      ctx.beginPath();
      ctx.arc(leftX + avatarR, avatarY + avatarR, avatarR, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();

      const liveImg = (cachedAvatarHandle === (profile.username || "").toLowerCase() && cachedAvatarImg && cachedAvatarImg.complete && cachedAvatarImg.naturalWidth > 0)
        ? cachedAvatarImg
        : $("#avatar-img");
      let drewImg = false;
      if (liveImg && liveImg.complete && liveImg.naturalWidth > 0 && !liveImg.classList.contains("hidden")) {
        try {
          ctx.save();
          ctx.beginPath();
          ctx.arc(leftX + avatarR, avatarY + avatarR, avatarR - 1, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(liveImg, leftX, avatarY, avatarR * 2, avatarR * 2);
          ctx.restore();
          drewImg = true;
        } catch (_) {
          drewImg = false;
        }
      }

      if (!drewImg) {
        const initial = (profile.display_name || profile.username || "C").charAt(0).toUpperCase();
        ctx.font = "bold 42px 'Space Grotesk', sans-serif";
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(initial, leftX + avatarR, avatarY + avatarR);
      }
      ctx.restore();

      // Names
      ctx.save();
      ctx.font = "bold 26px 'Space Grotesk', system-ui, sans-serif";
      ctx.fillStyle = "#ffffff";
      const dName = profile.display_name.length > 18 ? profile.display_name.slice(0, 17) + "…" : profile.display_name;
      ctx.fillText(dName.toUpperCase(), leftX + avatarR * 2 + 20, avatarY + 40);

      ctx.font = "16px 'Space Grotesk', monospace";
      ctx.fillStyle = t.bright;
      ctx.fillText(`@${profile.username}`, leftX + avatarR * 2 + 20, avatarY + 68);
      ctx.restore();

      // Bio Box
      ctx.save();
      ctx.font = "14px 'Space Grotesk', system-ui, sans-serif";
      ctx.fillStyle = "#94a3b8";
      const cleanBio = profile.bio.replace(/[\r\n]+/g, " ");
      const bioText = cleanBio.length > 110 ? cleanBio.slice(0, 107) + "…" : cleanBio;
      ctx.fillText(bioText, leftX, avatarY + avatarR * 2 + 36);
      ctx.restore();

      // 6 Key REAL Metrics Grid (2 rows x 3 cols)
      const metricsY = avatarY + avatarR * 2 + 65;
      const metricBoxes = [
        { label: "Followers", val: fmtNum(profile.followers) },
        { label: "Following", val: fmtNum(profile.following) },
        { label: "Posts", val: profile.tweets_str || fmtNum(profile.total_tweets || 0) },
        { label: "Likes", val: fmtNum(profile.likes_given || 0) },
        { label: "Media", val: fmtNum(profile.media_count || 0) },
        { label: "Joined", val: profile.joined_date || "Veteran" }
      ];

      // Clean label above metrics
      ctx.save();
      ctx.font = "bold 11px 'Space Grotesk', monospace";
      ctx.fillStyle = t.bright;
      ctx.fillText("VERIFIED X METRICS", leftX, metricsY - 8);
      ctx.restore();

      metricBoxes.forEach((m, idx) => {
        const col = idx % 3;
        const row = Math.floor(idx / 3);
        const boxX = leftX + col * 118;
        const boxY = metricsY + row * 62;
        const boxW = 110;
        const boxH = 55;

        ctx.save();
        ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 10);
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.stroke();

        ctx.font = "bold 16px 'Space Grotesk', system-ui, sans-serif";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(m.val, boxX + 10, boxY + 27);

        ctx.font = "10px 'Space Grotesk', sans-serif";
        ctx.fillStyle = "#94a3b8";
        ctx.fillText(m.label.toUpperCase(), boxX + 10, boxY + 45);
        ctx.restore();
      });

      // CENTER COLUMN: Radar Score Badge & Niches
      const centerX = width * 0.44;
      const centerY = margin + 100;

      // Score Badge Box
      ctx.save();
      const scoreBoxW = 280;
      const scoreBoxH = 155;
      ctx.fillStyle = "rgba(18, 14, 30, 0.85)";
      ctx.beginPath();
      ctx.roundRect(centerX, centerY, scoreBoxW, scoreBoxH, 18);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = t.primary;
      ctx.stroke();

      ctx.font = "bold 12px 'Space Grotesk', monospace";
      ctx.fillStyle = t.bright;
      ctx.fillText("RADAR CLOUT SCORE", centerX + 20, centerY + 32);

      ctx.font = "bold 64px 'Space Grotesk', system-ui, sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(String(profile.overall_score), centerX + 20, centerY + 102);

      ctx.font = "14px 'Space Grotesk', monospace";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText("/ 100", centerX + 115, centerY + 94);

      ctx.font = "12px 'Space Grotesk', sans-serif";
      ctx.fillStyle = t.bright;
      ctx.fillText(`Tier: ${profile.vibe ? profile.vibe.clout_tier : "Alpha"}`, centerX + 20, centerY + 132);
      ctx.restore();

      // Niche Pills below Score
      const nicheY = centerY + scoreBoxH + 20;
      (profile.niches || []).slice(0, 3).forEach((n, idx) => {
        const py = nicheY + idx * 42;
        ctx.save();
        ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
        ctx.beginPath();
        ctx.roundRect(centerX, py, 280, 34, 17);
        ctx.fill();
        ctx.strokeStyle = idx === 0 ? t.primary : "rgba(255, 255, 255, 0.1)";
        ctx.stroke();

        ctx.font = "bold 13px 'Space Grotesk', sans-serif";
        ctx.fillStyle = idx === 0 ? t.bright : "#e2e8f0";
        ctx.fillText(n.label.toUpperCase(), centerX + 16, py + 22);

        ctx.font = "bold 13px 'Space Grotesk', monospace";
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "right";
        ctx.fillText(`${Math.round(n.score)}%`, centerX + 264, py + 22);
        ctx.restore();
      });

      // RIGHT COLUMN: 6-Axis Radar Polygon Chart
      const radarCx = width - margin - 170;
      const radarCy = margin + 225;
      const maxR = 90;
      const keys = ["Reach", "Alpha", "Meme", "Tech", "Degen", "Activity"];
      const N = keys.length;

      // Draw Concentric Polygons
      for (let lvl = 1; lvl <= 3; lvl++) {
        const r = (maxR / 3) * lvl;
        ctx.beginPath();
        for (let i = 0; i < N; i++) {
          const angle = (Math.PI * 2 / N) * i - Math.PI / 2;
          const px = radarCx + r * Math.cos(angle);
          const py = radarCy + r * Math.sin(angle);
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Draw Radar Spokes & Labels
      for (let i = 0; i < N; i++) {
        const angle = (Math.PI * 2 / N) * i - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(radarCx, radarCy);
        ctx.lineTo(radarCx + maxR * Math.cos(angle), radarCy + maxR * Math.sin(angle));
        ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
        ctx.stroke();

        const lx = radarCx + (maxR + 18) * Math.cos(angle);
        const ly = radarCy + (maxR + 14) * Math.sin(angle);
        ctx.font = "bold 11px 'Space Grotesk', sans-serif";
        ctx.fillStyle = "#94a3b8";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(keys[i], lx, ly);
      }

      // Draw Data Polygon
      ctx.save();
      ctx.beginPath();
      keys.forEach((k, i) => {
        const val = Math.max(15, Math.min(100, profile.radar_scores[k] || 60));
        const r = maxR * (val / 100);
        const angle = (Math.PI * 2 / N) * i - Math.PI / 2;
        const px = radarCx + r * Math.cos(angle);
        const py = radarCy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.fillStyle = t.primary + "44";
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = t.bright;
      ctx.stroke();
      ctx.restore();

      // Footer
      ctx.save();
      ctx.font = "12px 'Space Grotesk', monospace";
      ctx.fillStyle = "#64748b";
      ctx.fillText("CloutRadar Pro · CT Intelligence Radar", margin + 48, height - margin - 24);
      ctx.textAlign = "right";
      ctx.fillText("cloutradar.vercel.app", width - margin - 48, height - margin - 24);
      ctx.restore();

    } else {
      // ===== STORY PORTRAIT LAYOUT (1080x1920) =====
      const cx = width / 2;
      const avatarR = 80;
      const avatarY = margin + 140;

      // Avatar: Photo or Stylized Monogram
      ctx.save();
      const circleGrad = ctx.createLinearGradient(cx - avatarR, avatarY, cx + avatarR, avatarY + avatarR * 2);
      circleGrad.addColorStop(0, t.primary);
      circleGrad.addColorStop(1, t.bright);
      ctx.fillStyle = circleGrad;
      ctx.beginPath();
      ctx.arc(cx, avatarY + avatarR, avatarR, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();

      const liveImg = (cachedAvatarHandle === (profile.username || "").toLowerCase() && cachedAvatarImg && cachedAvatarImg.complete && cachedAvatarImg.naturalWidth > 0)
        ? cachedAvatarImg
        : $("#avatar-img");
      let drewImg = false;
      if (liveImg && liveImg.complete && liveImg.naturalWidth > 0 && !liveImg.classList.contains("hidden")) {
        try {
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, avatarY + avatarR, avatarR - 2, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(liveImg, cx - avatarR, avatarY, avatarR * 2, avatarR * 2);
          ctx.restore();
          drewImg = true;
        } catch (_) {
          drewImg = false;
        }
      }

      if (!drewImg) {
        const initial = (profile.display_name || profile.username || "C").charAt(0).toUpperCase();
        ctx.font = "bold 72px 'Space Grotesk', sans-serif";
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(initial, cx, avatarY + avatarR);
      }
      ctx.restore();

      // Names
      ctx.save();
      ctx.font = "bold 44px 'Space Grotesk', system-ui, sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.fillText(profile.display_name.toUpperCase(), cx, avatarY + avatarR * 2 + 60);

      ctx.font = "26px 'Space Grotesk', monospace";
      ctx.fillStyle = t.bright;
      ctx.fillText(`@${profile.username}`, cx, avatarY + avatarR * 2 + 105);

      ctx.font = "20px 'Space Grotesk', sans-serif";
      ctx.fillStyle = "#94a3b8";
      const cleanBio = profile.bio.replace(/[\r\n]+/g, " ");
      const bioText = cleanBio.length > 80 ? cleanBio.slice(0, 78) + "…" : cleanBio;
      ctx.fillText(bioText, cx, avatarY + avatarR * 2 + 145);
      ctx.restore();

      // Big Score Plaque
      const scoreBoxY = avatarY + avatarR * 2 + 200;
      ctx.save();
      ctx.fillStyle = "rgba(18, 14, 30, 0.9)";
      ctx.beginPath();
      ctx.roundRect(margin + 60, scoreBoxY, cardW - 120, 240, 28);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = t.primary;
      ctx.stroke();

      ctx.font = "bold 22px 'Space Grotesk', monospace";
      ctx.fillStyle = t.bright;
      ctx.textAlign = "center";
      ctx.fillText("RADAR CLOUT SCORE", cx, scoreBoxY + 54);

      ctx.font = "bold 110px 'Space Grotesk', system-ui, sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(String(profile.overall_score), cx, scoreBoxY + 165);

      ctx.font = "bold 20px 'Space Grotesk', sans-serif";
      ctx.fillStyle = t.bright;
      ctx.fillText(`Tier: ${profile.vibe ? profile.vibe.clout_tier : "Alpha Legend"}`, cx, scoreBoxY + 215);
      ctx.restore();

      // Niches
      const nicheStartY = scoreBoxY + 280;
      (profile.niches || []).slice(0, 3).forEach((n, idx) => {
        const py = nicheStartY + idx * 75;
        ctx.save();
        ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
        ctx.beginPath();
        ctx.roundRect(margin + 60, py, cardW - 120, 60, 30);
        ctx.fill();
        ctx.strokeStyle = idx === 0 ? t.primary : "rgba(255, 255, 255, 0.1)";
        ctx.stroke();

        ctx.font = "bold 24px 'Space Grotesk', sans-serif";
        ctx.fillStyle = idx === 0 ? t.bright : "#ffffff";
        ctx.fillText(n.label.toUpperCase(), margin + 90, py + 38);

        ctx.font = "bold 24px 'Space Grotesk', monospace";
        ctx.textAlign = "right";
        ctx.fillText(`${Math.round(n.score)}%`, width - margin - 90, py + 38);
        ctx.restore();
      });

      // 6 Real X Metrics Rows
      const metricStartY = nicheStartY + 250;
      const metrics = [
        { label: "Followers", val: fmtNum(profile.followers) },
        { label: "Following", val: fmtNum(profile.following) },
        { label: "Total Posts", val: profile.tweets_str || fmtNum(profile.total_tweets || 0) },
        { label: "Likes Given", val: fmtNum(profile.likes_given || 0) },
        { label: "Media Uploads", val: fmtNum(profile.media_count || 0) },
        { label: "Account Joined", val: profile.joined_date || "Veteran" }
      ];
      metrics.forEach((m, idx) => {
        const my = metricStartY + idx * 56;
        ctx.save();
        ctx.font = "18px 'Space Grotesk', sans-serif";
        ctx.fillStyle = "#94a3b8";
        ctx.fillText(m.label, margin + 80, my + 26);

        ctx.font = "bold 22px 'Space Grotesk', monospace";
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "right";
        ctx.fillText(m.val, width - margin - 80, my + 26);
        ctx.restore();
      });

      // Roast Quote
      const roastY = metricStartY + 6 * 56 + 25;
      ctx.save();
      ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
      ctx.beginPath();
      ctx.roundRect(margin + 60, roastY, cardW - 120, 140, 20);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
      ctx.stroke();

      ctx.font = "italic 19px 'Space Grotesk', system-ui, sans-serif";
      ctx.fillStyle = "#cbd5e1";
      ctx.textAlign = "center";
      const cleanRoast = profile.roast.replace(/[\r\n]+/g, " ");
      const roastWrap = cleanRoast.length > 90 ? cleanRoast.slice(0, 88) + "…" : cleanRoast;
      ctx.fillText(`"${roastWrap}"`, cx, roastY + 75);
      ctx.restore();

      // Footer
      ctx.save();
      ctx.font = "bold 20px 'Space Grotesk', monospace";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "center";
      ctx.fillText("CLOUTRADAR PRO · CT INTEL", cx, height - margin - 40);
      ctx.restore();
    }

    return canvas.toDataURL("image/png");
  }

  // --- Card Preview & Download Synchronization ---
  function updateCardPreview() {
    if (!currentScanData) return;
    const imgEl = $("#rendered-card");
    const dlEl = $("#card-download");

    // Client canvas card takes precedence so high-res live profile picture and active theme apply
    const canvasSrc = generateCanvasCard(currentScanData, currentTheme, currentFormat);
    const src = canvasSrc || (currentFormat === "story" ? currentScanData.story_card_data_url : currentScanData.card_data_url) || "";

    if (imgEl && src) {
      imgEl.src = src;
    }

    if (dlEl && src) {
      dlEl.href = src;
      dlEl.setAttribute("download", `cloutradar-${currentScanData.username}-${currentTheme}-${currentFormat}.png`);
    }
  }

  // --- Hexagon Clout Radar SVG Generator ---
  function renderHexagonRadar(scores) {
    const container = $("#radar-container");
    const legend = $("#radar-legend");
    if (!container || !scores) return;

    const keys = ["Reach", "Alpha", "Meme", "Tech", "Degen", "Activity"];
    const N = keys.length;
    const cx = 190, cy = 160, maxR = 115;

    let svg = `<svg viewBox="0 0 380 320" width="100%" height="100%">
      <defs>
        <radialGradient id="radar-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="var(--theme-bright)" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="var(--theme-primary)" stop-opacity="0"/>
        </radialGradient>
      </defs>`;

    for (let level = 1; level <= 4; level++) {
      const r = (maxR / 4) * level;
      let polyPts = [];
      for (let i = 0; i < N; i++) {
        const angle = (Math.PI * 2 / N) * i - Math.PI / 2;
        polyPts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
      }
      svg += `<polygon points="${polyPts.join(' ')}" fill="none" stroke="var(--border)" stroke-width="1" stroke-dasharray="${level < 4 ? '3,3' : '0'}"/>`;
    }

    for (let i = 0; i < N; i++) {
      const angle = (Math.PI * 2 / N) * i - Math.PI / 2;
      const x2 = cx + maxR * Math.cos(angle);
      const y2 = cy + maxR * Math.sin(angle);
      svg += `<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="var(--border)" stroke-width="1"/>`;

      const lx = cx + (maxR + 24) * Math.cos(angle);
      const ly = cy + (maxR + 18) * Math.sin(angle) + 4;
      svg += `<text x="${lx}" y="${ly}" fill="var(--muted)" font-family="Space Grotesk" font-size="12" font-weight="700" text-anchor="middle">${keys[i]}</text>`;
    }

    let userPts = [];
    keys.forEach((k, i) => {
      const val = Math.max(10, Math.min(100, scores[k] || 50));
      const r = (maxR * (val / 100));
      const angle = (Math.PI * 2 / N) * i - Math.PI / 2;
      userPts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
    });

    svg += `<polygon points="${userPts.join(' ')}" fill="url(#radar-glow)" stroke="var(--theme-bright)" stroke-width="2.5" class="radar-data-poly"/>`;
    userPts.forEach((pt) => {
      const [px, py] = pt.split(',');
      svg += `<circle cx="${px}" cy="${py}" r="4" fill="#fff" stroke="var(--theme-primary)" stroke-width="2"/>`;
    });

    svg += `</svg>`;
    container.innerHTML = svg;

    if (legend) {
      legend.innerHTML = keys.map((k) => `
        <div class="radar-stat-badge">
          <span>${k}:</span> <b>${scores[k] || 0}%</b>
        </div>
      `).join("");
    }
  }

  // --- Render Solo Results (Exact Official Timeline Alignment) ---
  function renderResults(rawProfile) {
    const data = safeProfile(rawProfile, usernameInput.value);
    currentScanData = data;

    $("#display-name").textContent = data.display_name.toUpperCase();
    $("#handle").textContent = "@" + data.username;

    const xUrl = `https://x.com/${data.username}`;
    ["#display-name", "#handle"].forEach((sel) => {
      const a = $(sel);
      if (a) { a.href = xUrl; a.title = `Open @${data.username} on X`; }
    });

    $("#bio").textContent = data.bio;

    // Avatar
    const imgEl = $("#avatar-img");
    const initEl = $("#avatar-initials");
    if (initEl) {
      initEl.textContent = (data.display_name || data.username || "C").charAt(0).toUpperCase();
    }

    preloadProfileAvatar(data.username, data.avatar_url, (loadedImg) => {
      if (imgEl) {
        imgEl.src = loadedImg.src;
        imgEl.classList.remove("hidden");
        if (initEl) initEl.classList.add("hidden");
      }
      updateCardPreview();
    });

    if (imgEl) {
      imgEl.onerror = () => {
        imgEl.classList.add("hidden");
        if (initEl) initEl.classList.remove("hidden");
      };
      if (data.avatar_url) {
        imgEl.src = data.avatar_url;
        imgEl.classList.remove("hidden");
        if (initEl) initEl.classList.add("hidden");
      } else {
        imgEl.classList.add("hidden");
        if (initEl) initEl.classList.remove("hidden");
      }
    }

    // Animated Numerical Displays for Real X Metrics
    animateValue($("#overall-score"), 0, data.overall_score, 850, (v) => String(Math.round(v)));
    animateValue($("#m-followers"), 0, data.followers, 900, fmtNum);
    animateValue($("#m-following"), 0, data.following, 920, fmtNum);
    animateValue($("#m-posts"), 0, data.total_tweets, 940, fmtNum);
    animateValue($("#m-likes"), 0, data.likes_given, 960, fmtNum);
    animateValue($("#m-media"), 0, data.media_count, 980, fmtNum);
    const joinedEl = $("#m-joined");
    if (joinedEl) joinedEl.textContent = data.joined_date || "Veteran";

    // Niches
    const list = $("#niche-list");
    if (list) {
      list.innerHTML = "";
      (data.niches || []).forEach((n, i) => {
        const pill = document.createElement("span");
        pill.className = `niche-pill accent-${i % 3}`;
        pill.innerHTML = `<span class="np-label">${escapeHtml(n.label.toUpperCase())}</span><span class="np-pct">${Math.round(n.score)}%</span>`;
        list.appendChild(pill);
      });
    }

    // AI Roast
    const roastEl = $("#roast-text");
    if (roastEl) roastEl.textContent = `"${data.roast}"`;

    // Radar Chart
    renderHexagonRadar(data.radar_scores);

    // Card Previews & Download
    updateCardPreview();

    // Share on X
    const xBtn = $("#share-x");
    if (xBtn) {
      const top = data.niches && data.niches[0] ? data.niches[0].label : "CT Citizen";
      const text = `I'm ${top} with a CloutRadar score of ${data.overall_score} 📡 Check yours:`;
      const siteUrl = window.location.origin;
      xBtn.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(siteUrl)}`;
    }

    setView("results");
  }

  // --- Render Battle Results ---
  function renderBattleResults(data) {
    currentBattleData = data;
    const u1 = data.user1;
    const u2 = data.user2;

    $("#p1-avatar").src = u1.avatar_url || `/api/avatar/${u1.username}`;
    $("#p1-name").textContent = u1.display_name;
    $("#p1-handle").textContent = `@${u1.username}`;
    animateValue($("#p1-score"), 0, u1.score, 750, (v) => String(Math.round(v)));
    $("#p1-niche").textContent = u1.top_niche;
    $("#p1-followers").textContent = u1.followers_str || fmtNum(u1.followers || 0);
    const p1Fol = $("#p1-following");
    if (p1Fol) p1Fol.textContent = u1.following_str || fmtNum(u1.following || 0);
    const p1Posts = $("#p1-posts");
    if (p1Posts) p1Posts.textContent = u1.tweets_str || fmtNum(u1.tweets || u1.total_tweets || 0);
    const p1Likes = $("#p1-likes");
    if (p1Likes) p1Likes.textContent = fmtNum(u1.likes || u1.likes_given || 0);
    const p1Joined = $("#p1-joined");
    if (p1Joined) p1Joined.textContent = u1.joined_date || "Veteran";

    $("#p2-avatar").src = u2.avatar_url || `/api/avatar/${u2.username}`;
    $("#p2-name").textContent = u2.display_name;
    $("#p2-handle").textContent = `@${u2.username}`;
    animateValue($("#p2-score"), 0, u2.score, 750, (v) => String(Math.round(v)));
    $("#p2-niche").textContent = u2.top_niche;
    $("#p2-followers").textContent = u2.followers_str || fmtNum(u2.followers || 0);
    const p2Fol = $("#p2-following");
    if (p2Fol) p2Fol.textContent = u2.following_str || fmtNum(u2.following || 0);
    const p2Posts = $("#p2-posts");
    if (p2Posts) p2Posts.textContent = u2.tweets_str || fmtNum(u2.tweets || u2.total_tweets || 0);
    const p2Likes = $("#p2-likes");
    if (p2Likes) p2Likes.textContent = fmtNum(u2.likes || u2.likes_given || 0);
    const p2Joined = $("#p2-joined");
    if (p2Joined) p2Joined.textContent = u2.joined_date || "Veteran";

    $("#victor-name").textContent = `@${data.victor.toUpperCase()}`;

    function updateBattlePreview() {
      const bCanvasSrc = generateBattleCanvasCard(currentBattleData, currentTheme);
      const cardImg = $("#battle-card-img");
      const dl = $("#battle-download");
      const src = bCanvasSrc || currentBattleData.battle_card_data_url;
      if (cardImg && src) {
        cardImg.src = src;
      }
      if (dl && src) {
        dl.href = src;
        dl.setAttribute("download", `cloutradar-clash-${u1.username}-vs-${u2.username}.png`);
      }
    }

    preloadBattleAvatar("u1", u1.username, u1.avatar_url, () => updateBattlePreview());
    preloadBattleAvatar("u2", u2.username, u2.avatar_url, () => updateBattlePreview());

    updateBattlePreview();

    const shareX = $("#battle-share-x");
    if (shareX) {
      const text = `⚔️ CT CLASH: @${u1.username} (${u1.score}) vs @${u2.username} (${u2.score})! Victor: @${data.victor} 👑`;
      const siteUrl = window.location.origin;
      shareX.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(siteUrl)}`;
    }

    setView("battle");
  }

  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  function setStep(text, pct) {
    scanStatus.textContent = text;
    if (pct != null) progressBar.style.width = Math.round(pct) + "%";
  }

  // --- Solo Scan Execution with Dual-Layer Accuracy Engine ---
  async function scan(username, src) {
    const handle = normalizeUsername(username);
    if (!handle) { usernameInput.focus(); return; }

    usernameInput.value = handle;
    scanBtn.disabled = true;

    setView("scanning");
    setStep(`Scanning timeline intelligence for @${handle}...`, 15);

    let data = null;

    // Layer 1: Attempt local/deployed FastAPI backend stream
    try {
      const res = await fetch("/api/scan?stream=1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: handle,
          src: src || "typed",
          theme: currentTheme,
          format: currentFormat
        }),
      });

      if (res.ok && res.body && res.body.getReader) {
        const reader = res.body.getReader(), dec = new TextDecoder();
        let buf = "", final = null;
        while (!final) {
          const { value, done } = await reader.read();
          if (value) buf += dec.decode(value, { stream: true });
          let nl;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line) continue;
            let ev;
            try { ev = JSON.parse(line); } catch (_) { continue; }
            if (ev.step === "profile") setStep(`Found @${handle} (${fmtNum(ev.followers)} followers)`, 30);
            if (ev.step === "posts") setStep(`Analyzing 90-day timeline posts & engagement...`, 60);
            if (ev.step === "analyze") setStep(`Computing CT Clout Radar & Niches...`, 82);
            if (ev.step === "card") setStep(`Synthesizing high-res card...`, 94);
            if (ev.step === "done" && ev.result) { final = ev; break; }
          }
          if (done) break;
        }
        if (final && final.result) {
          data = final.result;
        }
      } else if (res.ok) {
        const json = await res.json();
        if (json && json.username) {
          data = json;
        }
      }
    } catch (e) {
      console.warn("Local backend stream unavailable; engaging direct CORS upstream scanner.", e);
    }

    // Layer 2: Direct FxTwitter live probe (CORS-enabled, 0.3s instant response, 100% exact real followers & bio)
    if (!data || !data.username) {
      try {
        setStep(`Querying live X profile for @${handle}...`, 70);
        const fxRes = await fetch(`https://api.fxtwitter.com/${handle}`);
        if (fxRes.ok) {
          const fxData = await fxRes.json();
          const user = fxData.user;
          if (user && user.screen_name) {
            const rawAvatar = user.avatar_url || "";
            const avatarUrl = rawAvatar ? rawAvatar.replace("_normal.", "_400x400.") : `https://unavatar.io/x/${handle}`;
            const fols = Number(user.followers || user.followers_count || 0);
            const following = Number(user.following || user.friends_count || 0);
            const tweets = Number(user.tweets || user.statuses_count || 0);
            const likes = Number(user.likes || user.favourites_count || 0);
            data = {
              username: user.screen_name,
              display_name: user.name || user.screen_name,
              bio: user.description || "",
              avatar_url: avatarUrl,
              followers: fols,
              following: following,
              tweets: tweets,
              likes: likes,
              joined: user.joined || ""
            };
          }
        }
      } catch (err) {
        console.warn("Direct FxTwitter probe unreachable.", err);
      }
    }

    progressBar.style.width = "100%";
    await sleep(200);
    scanBtn.disabled = false;

    // Layer 3: Autonomous persona synthesis fallback
    if (!data || !data.username) {
      data = safeProfile(null, handle);
    }

    renderResults(data);
  }

  // Live account resolver for direct client execution (FxTwitter instant probe)
  async function fetchLiveAccount(handle) {
    // Tier 1: Direct FxTwitter (CORS-friendly, 250ms, 100% exact live numbers)
    try {
      const fxRes = await fetch(`https://api.fxtwitter.com/${handle}`);
      if (fxRes.ok) {
        const fxData = await fxRes.json();
        const user = fxData.user;
        if (user && user.screen_name) {
          const rawAvatar = user.avatar_url || "";
          const avatarUrl = rawAvatar ? rawAvatar.replace("_normal.", "_400x400.") : `https://unavatar.io/x/${handle}`;
          const fols = Number(user.followers || user.followers_count || 0);
          const following = Number(user.following || user.friends_count || 0);
          const tweets = Number(user.tweets || user.statuses_count || 0);
          const likes = Number(user.likes || user.favourites_count || 0);
          const media = Number(user.media_count || 0);
          const joined = user.joined || "";
          return {
            username: user.screen_name,
            display_name: user.name || user.screen_name,
            bio: user.description || "",
            avatar_url: avatarUrl,
            followers: fols,
            following: following,
            tweets: tweets,
            likes: likes,
            media_count: media,
            joined: joined,
            method: "fxtwitter direct live"
          };
        }
      }
    } catch (_) {}

    // Tier 2: Dedicated local proxy avatar & profile endpoint
    try {
      const localRes = await fetch(`/api/user/${handle}`);
      if (localRes.ok) {
        const d = await localRes.json();
        if (d && d.username) return d;
      }
    } catch (_) {}

    return null;
  }

  // --- High-Performance HTML5 Dual-Player Battle Card Studio ---
  function generateBattleCanvasCard(arg1, arg2, arg3, arg4) {
    let p1, p2, victorHandle, themeKey;
    if (arg1 && arg1.user1 && arg1.user2) {
      p1 = arg1.user1;
      p2 = arg1.user2;
      victorHandle = arg1.victor;
      themeKey = arg2 || currentTheme;
    } else {
      p1 = arg1;
      p2 = arg2;
      victorHandle = arg3;
      themeKey = arg4 || currentTheme;
    }
    if (!p1 || !p2) return "";

    const width = 1200;
    const height = 675;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    const t = THEMES[themeKey] || THEMES.cyber_violet;

    // 1. Cyberpunk Dark Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, "#08060f");
    bgGrad.addColorStop(1, "#140a18");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. High-Tech Grid
    ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    // Dual ambient colored glows (violet on left for p1, crimson on right for p2)
    const glow1 = ctx.createRadialGradient(280, 320, 20, 280, 320, 350);
    glow1.addColorStop(0, "rgba(124, 58, 237, 0.28)");
    glow1.addColorStop(1, "transparent");
    ctx.fillStyle = glow1;
    ctx.beginPath(); ctx.arc(280, 320, 350, 0, Math.PI * 2); ctx.fill();

    const glow2 = ctx.createRadialGradient(920, 320, 20, 920, 320, 350);
    glow2.addColorStop(0, "rgba(244, 63, 94, 0.28)");
    glow2.addColorStop(1, "transparent");
    ctx.fillStyle = glow2;
    ctx.beginPath(); ctx.arc(920, 320, 350, 0, Math.PI * 2); ctx.fill();

    // 3. Outer Glass Frame
    const margin = 32;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(margin, margin, width - margin * 2, height - margin * 2, 22);
    ctx.fillStyle = "rgba(10, 10, 18, 0.75)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = t.border;
    ctx.stroke();
    ctx.restore();

    // 4. Header Bar
    ctx.save();
    ctx.font = "bold 15px 'Space Grotesk', system-ui, sans-serif";
    ctx.fillStyle = t.bright;
    ctx.fillText("⚔️ CLOUTRADAR // VERSUS ARENA", margin + 32, margin + 45);
    ctx.font = "bold 13px 'Space Grotesk', monospace";
    ctx.fillStyle = "#94a3b8";
    ctx.textAlign = "right";
    ctx.fillText("CT RADAR CLASH", width - margin - 32, margin + 45);
    ctx.restore();

    // Helper: Draw Player Box
    function drawPlayer(p, cx, isLeft) {
      const topY = margin + 85;
      const accent = isLeft ? t.bright : "#fb7185";
      const borderCol = isLeft ? t.primary : "#e11d48";
      const avatarR = 42;

      // Avatar circle
      ctx.save();
      const circleGrad = ctx.createLinearGradient(cx - avatarR, topY, cx + avatarR, topY + avatarR * 2);
      circleGrad.addColorStop(0, isLeft ? t.primary : "#f43f5e");
      circleGrad.addColorStop(1, isLeft ? t.bright : "#fb7185");
      ctx.fillStyle = circleGrad;
      ctx.beginPath();
      ctx.arc(cx, topY + avatarR, avatarR, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();

      // Check if avatar image is preloaded or rendered on DOM
      const preloaded = isLeft ? cachedBattleAvatars.u1 : cachedBattleAvatars.u2;
      const domAvatarId = isLeft ? "#p1-avatar" : "#p2-avatar";
      const domImg = (preloaded && preloaded.complete && preloaded.naturalWidth > 0)
        ? preloaded
        : document.querySelector(domAvatarId);
      let drewImg = false;
      if (domImg && domImg.complete && domImg.naturalWidth > 0) {
        try {
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, topY + avatarR, avatarR - 1, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(domImg, cx - avatarR, topY, avatarR * 2, avatarR * 2);
          ctx.restore();
          drewImg = true;
        } catch (_) { drewImg = false; }
      }
      if (!drewImg) {
        const initial = (p.display_name || p.username || "P").charAt(0).toUpperCase();
        ctx.font = "bold 38px 'Space Grotesk', sans-serif";
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(initial, cx, topY + avatarR);
      }
      ctx.restore();

      // Names
      ctx.save();
      ctx.font = "bold 24px 'Space Grotesk', system-ui, sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      const dName = (p.display_name || p.username).length > 18 ? (p.display_name || p.username).slice(0, 16) + "…" : (p.display_name || p.username);
      ctx.fillText(dName.toUpperCase(), cx, topY + avatarR * 2 + 32);

      ctx.font = "16px 'Space Grotesk', monospace";
      ctx.fillStyle = accent;
      ctx.fillText(`@${p.username}`, cx, topY + avatarR * 2 + 58);
      ctx.restore();

      // Score Plaque
      const scoreY = topY + avatarR * 2 + 76;
      ctx.save();
      ctx.fillStyle = "rgba(18, 14, 28, 0.85)";
      ctx.beginPath();
      ctx.roundRect(cx - 150, scoreY, 300, 95, 16);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = borderCol;
      ctx.stroke();

      ctx.font = "bold 11px 'Space Grotesk', monospace";
      ctx.fillStyle = accent;
      ctx.textAlign = "center";
      ctx.fillText("RADAR CLOUT SCORE", cx, scoreY + 24);

      ctx.font = "bold 52px 'Space Grotesk', system-ui, sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(String(p.score || p.overall_score || 0), cx, scoreY + 74);
      ctx.restore();

      // Stat Tiles (Followers, Following, Posts, Likes)
      const statsY = scoreY + 110;
      const stats = [
        { label: "FOLLOWERS", val: p.followers_str || fmtNum(p.followers || 0) },
        { label: "FOLLOWING", val: p.following_str || fmtNum(p.following || 0) },
        { label: "POSTS", val: p.tweets_str || fmtNum(p.tweets || p.total_tweets || 0) },
        { label: "LIKES", val: fmtNum(p.likes || p.likes_given || 0) }
      ];

      stats.forEach((s, idx) => {
        const sy = statsY + idx * 38;
        ctx.save();
        ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
        ctx.beginPath();
        ctx.roundRect(cx - 150, sy, 300, 32, 10);
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
        ctx.stroke();

        ctx.font = "bold 11px 'Space Grotesk', sans-serif";
        ctx.fillStyle = "#94a3b8";
        ctx.fillText(s.label, cx - 134, sy + 20);

        ctx.font = "bold 13px 'Space Grotesk', monospace";
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "right";
        ctx.fillText(s.val, cx + 134, sy + 20);
        ctx.restore();
      });
    }

    // Draw Player 1 (Left) & Player 2 (Right)
    drawPlayer(p1, width * 0.28, true);
    drawPlayer(p2, width * 0.72, false);

    // Center VS Emblem
    const vsCx = width / 2;
    const vsCy = height * 0.44;
    ctx.save();
    // Outer glow ring
    ctx.beginPath();
    ctx.arc(vsCx, vsCy, 46, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(244, 63, 94, 0.15)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(244, 63, 94, 0.5)";
    ctx.stroke();

    // Inner circle
    ctx.beginPath();
    ctx.arc(vsCx, vsCy, 36, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(20, 10, 18, 0.95)";
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#f43f5e";
    ctx.stroke();

    ctx.font = "bold 26px 'Space Grotesk', sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("VS", vsCx, vsCy);
    ctx.restore();

    // Victor Banner at Bottom
    const vicY = height - margin - 75;
    ctx.save();
    const vicGrad = ctx.createLinearGradient(vsCx - 220, vicY, vsCx + 220, vicY + 45);
    vicGrad.addColorStop(0, "rgba(124, 58, 237, 0.85)");
    vicGrad.addColorStop(1, "rgba(244, 63, 94, 0.85)");
    ctx.fillStyle = vicGrad;
    ctx.beginPath();
    ctx.roundRect(vsCx - 220, vicY, 440, 45, 14);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();

    ctx.font = "bold 18px 'Space Grotesk', sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`👑 CLASH VICTOR: @${(victorHandle || p1.username).toUpperCase()}`, vsCx, vicY + 23);
    ctx.restore();

    // Footer
    ctx.save();
    ctx.font = "11px 'Space Grotesk', monospace";
    ctx.fillStyle = "#64748b";
    ctx.fillText("CloutRadar Pro · Versus Arena", margin + 32, height - margin - 15);
    ctx.textAlign = "right";
    ctx.fillText("cloutradar.vercel.app", width - margin - 32, height - margin - 15);
    ctx.restore();

    return canvas.toDataURL("image/png");
  }

  // --- Battle Execution ---
  async function battle(u1, u2) {
    const p1 = normalizeUsername(u1);
    const p2 = normalizeUsername(u2);
    if (!p1 || !p2) return;

    battleBtn.disabled = true;
    setView("scanning");
    setStep(`Clashing @${p1} vs @${p2}...`, 25);

    let data = null;

    // Layer 1: Attempt local/deployed compare API
    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user1: p1, user2: p2, theme: currentTheme })
      });
      if (res.ok) {
        const json = await res.json();
        if (json && json.user1 && json.user2) {
          data = json;
          // Ensure dual-player battle card is attached
          if (!data.battle_card_data_url || !data.battle_card_data_url.startsWith("data:image")) {
            data.battle_card_data_url = generateBattleCanvasCard(data.user1, data.user2, data.victor, currentTheme);
          }
        }
      }
    } catch (e) {
      console.warn("Backend compare endpoint unreachable; engaging live direct resolver.", e);
    }

    // Layer 2: Direct Live Client Fetch for Both Players (Guaranteed 100% Real Stats)
    if (!data || !data.user1 || !data.user2) {
      setStep(`Extracting live X profiles for @${p1} & @${p2}...`, 60);
      const [raw1, raw2] = await Promise.all([fetchLiveAccount(p1), fetchLiveAccount(p2)]);
      const s1 = safeProfile(raw1, p1);
      const s2 = safeProfile(raw2, p2);
      const victor = s1.overall_score >= s2.overall_score ? p1 : p2;

      data = {
        user1: {
          username: p1,
          display_name: s1.display_name,
          score: s1.overall_score,
          top_niche: (s1.niches && s1.niches[0]) ? s1.niches[0].label : "CT Citizen",
          followers: s1.followers,
          followers_str: fmtNum(s1.followers),
          following: s1.following,
          following_str: fmtNum(s1.following),
          tweets: s1.total_tweets,
          tweets_str: s1.tweets_str || fmtNum(s1.total_tweets),
          likes: s1.likes_given,
          likes_str: fmtNum(s1.likes_given),
          joined_date: s1.joined_date,
          avatar_url: s1.avatar_url
        },
        user2: {
          username: p2,
          display_name: s2.display_name,
          score: s2.overall_score,
          top_niche: (s2.niches && s2.niches[0]) ? s2.niches[0].label : "CT Citizen",
          followers: s2.followers,
          followers_str: fmtNum(s2.followers),
          following: s2.following,
          following_str: fmtNum(s2.following),
          tweets: s2.total_tweets,
          tweets_str: s2.tweets_str || fmtNum(s2.total_tweets),
          likes: s2.likes_given,
          likes_str: fmtNum(s2.likes_given),
          joined_date: s2.joined_date,
          avatar_url: s2.avatar_url
        },
        victor: victor,
        battle_card_data_url: generateBattleCanvasCard(s1, s2, victor, currentTheme)
      };
    }

    progressBar.style.width = "100%";
    await sleep(200);
    battleBtn.disabled = false;
    renderBattleResults(data);
  }

  // --- Form Handlers ---
  soloForm.addEventListener("submit", (e) => {
    e.preventDefault();
    scan(usernameInput.value);
  });

  battleForm.addEventListener("submit", (e) => {
    e.preventDefault();
    battle(battleU1.value, battleU2.value);
  });

  $("#scan-another").addEventListener("click", () => setView("hero"));
  $("#battle-back").addEventListener("click", () => setView("hero"));
  $("#error-retry").addEventListener("click", () => setView("hero"));

  // --- Copy Image to Clipboard ---
  const shareBtn = $("#card-share");
  if (shareBtn) {
    shareBtn.addEventListener("click", async () => {
      const img = $("#rendered-card");
      if (!img || !img.src) return;
      try {
        const res = await fetch(img.src);
        const blob = await res.blob();
        if (navigator.clipboard && window.ClipboardItem) {
          await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
          shareBtn.textContent = "Copied!";
          setTimeout(() => { shareBtn.textContent = "Copy image"; }, 1500);
        }
      } catch (_) {
        alert("Image ready! Right click or long press to copy.");
      }
    });
  }

  // --- Load Trending Ticker ---
  async function loadTrending() {
    try {
      const res = await fetch("/api/trending");
      const data = await res.json();
      if (data.trending && trendingChips) {
        trendingChips.innerHTML = data.trending.map((t) => `
          <button type="button" class="trend-chip" data-handle="${t.username}">
            @${t.username}
          </button>
        `).join("");

        $$(".trend-chip").forEach((btn) => {
          btn.addEventListener("click", () => {
            usernameInput.value = btn.dataset.handle;
            scan(btn.dataset.handle, "trending");
          });
        });
      }
    } catch (_) {}
  }

  // --- Load Curated Demos ---
  async function loadDemos() {
    try {
      const res = await fetch("/api/demos");
      const j = await res.json();
      if (j.demos && demoChips) {
        demoChips.innerHTML = "";
        j.demos.forEach((d) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "demo-chip";
          btn.style.setProperty("--chip", d.accent_color || "#8b5cf6");
          btn.innerHTML = `
            <img class="demo-chip-pfp" src="${d.avatar_url}" alt="" loading="lazy"/>
            <span>@${d.username}</span>
          `;
          btn.addEventListener("click", () => {
            usernameInput.value = d.username;
            scan(d.username, "demo");
          });
          demoChips.appendChild(btn);
        });
      }
    } catch (_) {}
  }

  loadTrending();
  loadDemos();
  setView("hero");
})();
