/**
 * NicheScan Pro — Advanced CT Share & Intelligence Engine
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

      // Update body theme
      document.body.className = `theme-${currentTheme.replace(/_/g, "-")}`;

      // Refresh card if in results
      if (currentScanData && currentScanData.username) {
        scan(currentScanData.username, "theme_change");
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

  // --- Autumn Leaves Toggle ---
  const leavesToggle = $("#leaves-toggle");
  if (leavesToggle) {
    leavesToggle.addEventListener("click", () => {
      const layer = $(".leaves");
      if (layer) {
        if (layer.style.display === "none") {
          layer.style.display = "block";
          leavesToggle.textContent = "🍂 Leaves: On";
        } else {
          layer.style.display = "none";
          leavesToggle.textContent = "🍂 Leaves: Off";
        }
      }
    });
  }

  function escapeHtml(s) {
    return String(s)
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

  // --- Card Preview Update ---
  function updateCardPreview() {
    if (!currentScanData) return;
    const imgEl = $("#rendered-card");
    const dlEl = $("#card-download");
    const src = (currentFormat === "story" && currentScanData.story_card_data_url)
      ? currentScanData.story_card_data_url
      : (currentScanData.card_data_url || "");

    if (imgEl && src) {
      imgEl.src = src;
    }
    if (dlEl && src) {
      dlEl.href = src;
      dlEl.setAttribute("download", `nichescan-${currentScanData.username}-${currentFormat}.png`);
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

    // Concentric polygons
    for (let level = 1; level <= 4; level++) {
      const r = (maxR / 4) * level;
      let polyPts = [];
      for (let i = 0; i < N; i++) {
        const angle = (Math.PI * 2 / N) * i - Math.PI / 2;
        polyPts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
      }
      svg += `<polygon points="${polyPts.join(' ')}" fill="none" stroke="var(--border)" stroke-width="1" stroke-dasharray="${level < 4 ? '3,3' : '0'}"/>`;
    }

    // Radial spokes
    for (let i = 0; i < N; i++) {
      const angle = (Math.PI * 2 / N) * i - Math.PI / 2;
      const x2 = cx + maxR * Math.cos(angle);
      const y2 = cy + maxR * Math.sin(angle);
      svg += `<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="var(--border)" stroke-width="1"/>`;

      // Labels
      const lx = cx + (maxR + 24) * Math.cos(angle);
      const ly = cy + (maxR + 18) * Math.sin(angle) + 4;
      svg += `<text x="${lx}" y="${ly}" fill="var(--muted)" font-family="Space Grotesk" font-size="12" font-weight="700" text-anchor="middle">${keys[i]}</text>`;
    }

    // User data polygon
    let userPts = [];
    keys.forEach((k, i) => {
      const val = Math.max(10, Math.min(100, scores[k] || 50));
      const r = (maxR * (val / 100));
      const angle = (Math.PI * 2 / N) * i - Math.PI / 2;
      userPts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
    });

    svg += `<polygon points="${userPts.join(' ')}" fill="url(#radar-glow)" stroke="var(--theme-bright)" stroke-width="2.5"/>`;
    userPts.forEach((pt) => {
      const [px, py] = pt.split(',');
      svg += `<circle cx="${px}" cy="${py}" r="4" fill="#fff" stroke="var(--theme-primary)" stroke-width="2"/>`;
    });

    svg += `</svg>`;
    container.innerHTML = svg;

    // Legend
    if (legend) {
      legend.innerHTML = keys.map((k) => `
        <div class="radar-stat-badge">
          <span>${k}:</span> <b>${scores[k] || 0}%</b>
        </div>
      `).join("");
    }
  }

  // --- Render Solo Results ---
  function renderResults(data) {
    currentScanData = data;

    $("#display-name").textContent = data.display_name || data.username;
    $("#handle").textContent = "@" + data.username;

    const xUrl = `https://x.com/${data.username}`;
    ["#display-name", "#handle"].forEach((sel) => {
      const a = $(sel);
      if (a) { a.href = xUrl; a.title = `Open @${data.username} on X`; }
    });

    $("#bio").textContent = data.bio || "No bio provided.";

    // Avatar
    const imgEl = $("#avatar-img");
    const initEl = $("#avatar-initials");
    if (data.avatar_url && imgEl) {
      imgEl.src = data.avatar_url;
      imgEl.classList.remove("hidden");
      if (initEl) initEl.classList.add("hidden");
    }

    $("#overall-score").textContent = data.overall_score || "—";
    $("#m-followers").textContent = fmtNum(data.followers);
    const er = Number(data.er_median);
    $("#m-eng").textContent = er > 0 ? (er * 100).toFixed(1) + "%" : "—";
    $("#m-views").textContent = fmtNum(data.impressions);

    // Niches
    const list = $("#niche-list");
    list.innerHTML = "";
    (data.niches || []).forEach((n, i) => {
      const pill = document.createElement("span");
      pill.className = `niche-pill accent-${i % 3}`;
      pill.innerHTML = `<span class="np-label">${escapeHtml(n.label)}</span><span class="np-pct">${Math.round(n.score)}%</span>`;
      list.appendChild(pill);
    });

    // Deep Mind Tab
    $("#roast-text").textContent = `"${data.roast || 'Spends 24/7 on the timeline.'}"`;
    $("#superpower-text").textContent = data.superpower || "Timeline Alpha";
    $("#kryptonite-text").textContent = data.kryptonite || "High-slippage FOMO";

    // Radar Chart
    renderHexagonRadar(data.radar_scores);

    // Audience Health & Vibe
    if (data.vibe) {
      $("#vibe-bullish").textContent = `${data.vibe.bullish_pct}%`;
      $("#meter-bullish").style.width = `${data.vibe.bullish_pct}%`;
      $("#vibe-chaos").textContent = `${data.vibe.chaos_pct}%`;
      $("#meter-chaos").style.width = `${data.vibe.chaos_pct}%`;
      $("#vibe-health").textContent = data.vibe.audience_health || "A Organic";
      $("#vibe-tier").textContent = data.vibe.clout_tier || "Alpha Citizen";
    }

    // Card Previews & Download
    updateCardPreview();

    // Share on X
    const xBtn = $("#share-x");
    if (xBtn) {
      const top = data.niches && data.niches[0] ? data.niches[0].label : "CT Citizen";
      const text = `I'm ${top} with a NicheScan score of ${data.overall_score} 🐧 check yours`;
      const siteUrl = window.location.origin || "https://nichescan.app";
      xBtn.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(siteUrl)}`;
    }

    setView("results");
  }

  // --- Render Battle Results ---
  function renderBattleResults(data) {
    currentBattleData = data;
    const u1 = data.user1;
    const u2 = data.user2;

    $("#p1-avatar").src = u1.avatar_url || `https://unavatar.io/x/${u1.username}`;
    $("#p1-name").textContent = u1.display_name;
    $("#p1-handle").textContent = `@${u1.username}`;
    $("#p1-score").textContent = u1.score;
    $("#p1-niche").textContent = u1.top_niche;
    $("#p1-followers").textContent = u1.followers_str;
    $("#p1-er").textContent = u1.er_str;

    $("#p2-avatar").src = u2.avatar_url || `https://unavatar.io/x/${u2.username}`;
    $("#p2-name").textContent = u2.display_name;
    $("#p2-handle").textContent = `@${u2.username}`;
    $("#p2-score").textContent = u2.score;
    $("#p2-niche").textContent = u2.top_niche;
    $("#p2-followers").textContent = u2.followers_str;
    $("#p2-er").textContent = u2.er_str;

    $("#victor-name").textContent = `@${data.victor.toUpperCase()}`;

    const cardImg = $("#battle-card-img");
    if (cardImg && data.battle_card_data_url) {
      cardImg.src = data.battle_card_data_url;
    }
    const dl = $("#battle-download");
    if (dl && data.battle_card_data_url) {
      dl.href = data.battle_card_data_url;
      dl.setAttribute("download", `nichescan-clash-${u1.username}-vs-${u2.username}.png`);
    }

    const shareX = $("#battle-share-x");
    if (shareX) {
      const text = `⚔️ CT CLASH: @${u1.username} (${u1.score}) vs @${u2.username} (${u2.score})! Victor: @${data.victor} 👑`;
      const siteUrl = window.location.origin || "https://nichescan.app";
      shareX.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(siteUrl)}`;
    }

    setView("battle");
  }

  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  function setStep(text, pct) {
    scanStatus.textContent = text;
    if (pct != null) progressBar.style.width = Math.round(pct) + "%";
  }

  // --- Solo Scan Execution ---
  async function scan(username, src) {
    const handle = normalizeUsername(username);
    if (!handle) { usernameInput.focus(); return; }

    usernameInput.value = handle;
    scanBtn.disabled = true;

    setView("scanning");
    setStep(`Scanning @${handle}...`, 12);

    let data, err;
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
            if (ev.step === "profile") setStep(`Found @${handle} (${fmtNum(ev.followers)} followers)`, 28);
            if (ev.step === "posts") setStep(`Analyzing recent timeline alpha...`, 60);
            if (ev.step === "analyze") setStep(`Computing CT Clout Radar...`, 82);
            if (ev.step === "card") setStep(`Synthesizing high-res card...`, 94);
            if (ev.step === "done" || ev.step === "error") { final = ev; break; }
          }
          if (done) break;
        }
        if (!final || final.step === "error") throw new Error("Could not scan account.");
        data = final.result;
      } else {
        data = await res.json();
      }
    } catch (e) {
      err = e;
    }

    progressBar.style.width = "100%";
    await sleep(200);
    scanBtn.disabled = false;

    if (err) {
      $("#error-message").textContent = err.message || "Failed to scan profile.";
      setView("error");
      return;
    }
    renderResults(data);
  }

  // --- Battle Execution ---
  async function battle(u1, u2) {
    const p1 = normalizeUsername(u1);
    const p2 = normalizeUsername(u2);
    if (!p1 || !p2) return;

    battleBtn.disabled = true;
    setView("scanning");
    setStep(`Clashing @${p1} vs @${p2}...`, 30);
    await sleep(400);
    setStep(`Computing relative clout & dominance...`, 75);

    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user1: p1, user2: p2, theme: currentTheme })
      });
      const data = await res.json();
      progressBar.style.width = "100%";
      await sleep(200);
      battleBtn.disabled = false;
      renderBattleResults(data);
    } catch (e) {
      battleBtn.disabled = false;
      $("#error-message").textContent = "Clash failed. Try again.";
      setView("error");
    }
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
