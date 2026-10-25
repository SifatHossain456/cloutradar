/**
 * NicheScan — dark CT share-tool frontend
 */

(function () {
  const $ = (sel) => document.querySelector(sel);

  const hero = $("#hero");
  const scanning = $("#scanning");
  const results = $("#results");
  const errorPanel = $("#error-panel");
  const form = $("#scan-form");
  const input = $("#username");
  const scanBtn = $("#scan-btn");
  const scanStatus = $("#scan-status");
  const progressBar = $("#progress-bar");
  const demoChips = $("#demo-chips");

  function show(el) {
    if (el) el.classList.remove("hidden");
  }
  function hide(el) {
    if (el) el.classList.add("hidden");
  }

  function setView(view) {
    hide(hero);
    hide(scanning);
    hide(results);
    hide(errorPanel);
    if (view === "hero") show(hero);
    if (view === "scanning") show(scanning);
    if (view === "results") show(results);
    if (view === "error") show(errorPanel);
  }

  function normalizeUsername(raw) {
    return String(raw || "")
      .trim()
      .replace(/^@+/, "")
      .replace(/[^A-Za-z0-9_]/g, "")
      .slice(0, 40);
  }

  input.addEventListener("input", () => {
    const cleaned = normalizeUsername(input.value);
    if (input.value !== cleaned) {
      const pos = input.selectionStart;
      input.value = cleaned;
      try {
        input.setSelectionRange(Math.max(0, pos - 1), Math.max(0, pos - 1));
      } catch (_) {}
    }
  });

  input.addEventListener("paste", (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData("text");
    input.value = normalizeUsername(text);
  });

  function initials(name) {
    const parts = String(name || "?")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setAvatar(data) {
    const initialsEl = $("#avatar-initials");
    const imgEl = $("#avatar-img");
    const init = initials(data.display_name || data.username);
    if (initialsEl) {
      initialsEl.textContent = init;
      initialsEl.classList.remove("hidden");
    }
    if (!imgEl) return;
    imgEl.classList.add("hidden");
    imgEl.removeAttribute("src");
    if (!data.avatar_url) return;
    imgEl.onload = () => {
      imgEl.classList.remove("hidden");
      if (initialsEl) initialsEl.classList.add("hidden");
    };
    imgEl.onerror = () => {
      imgEl.classList.add("hidden");
      if (initialsEl) initialsEl.classList.remove("hidden");
    };
    imgEl.alt = data.display_name || data.username;
    imgEl.src = data.avatar_url;
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

  function renderResults(data) {
    $("#display-name").textContent = data.display_name || data.username;
    $("#handle").textContent = "@" + data.username;
    // Name + @handle open the X profile (canonical casing from the scan) in a new tab.
    const xUrl = /^[A-Za-z0-9_]{1,15}$/.test(data.username || "")
      ? "https://x.com/" + data.username : "";
    ["#display-name", "#handle"].forEach((sel) => {
      const a = $(sel);
      if (!a) return;
      if (xUrl) {
        a.href = xUrl;
        a.title = "Open @" + data.username + " on X";
      } else {
        a.removeAttribute("href");
        a.removeAttribute("title");
      }
    });
    const bioEl = $("#bio");
    if (bioEl) bioEl.textContent = data.bio || "";
    setAvatar(data);

    const scoreEl = $("#overall-score");
    if (scoreEl) {
      const raw = Number(data.overall_score);
      scoreEl.textContent = isFinite(raw) && raw > 0
        ? String(Math.max(1, Math.round(raw)))
        : "—";
    }

    $("#m-followers").textContent = data.followers ? fmtNum(data.followers) : "—";
    const er = Number(data.er_median);
    $("#m-eng").textContent = er > 0
      ? ((er * 100) >= 10 ? (er * 100).toFixed(1) : (er * 100).toFixed(2)).replace(/\.?0+$/, "") + "%"
      : "—";
    $("#m-views").textContent = data.impressions != null ? fmtNum(data.impressions) : "—";
    const basisEl = $("#m-basis");
    if (basisEl) {
      const n = Number(data.imp_posts_n) || 0;
      let label = "";
      if (n) {
        if (data.imp_full_window) label = "last 90d · " + n + " posts";
        else {
          const d = data.imp_since ? new Date(data.imp_since + "T00:00:00Z") : null;
          const sd = d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "?";
          label = "since " + sd + " · " + n + " posts";
        }
      } else if (Number(data.sample_n)) {
        label = "last " + data.sample_n + " posts";
      }
      basisEl.textContent = label;
    }

    const list = $("#niche-list");
    list.innerHTML = "";
    const niches = data.niches || [];
    if (!niches.length) {
      const span = document.createElement("span");
      span.className = "niche-pill empty";
      span.textContent = "No strong niche signal";
      list.appendChild(span);
    } else {
      niches.forEach((n, i) => {
        const pill = document.createElement("span");
        pill.className = "niche-pill accent-" + (i % 3) + ((n.id === "gooner" || n.id === "video_creator" || n.id === "content_creator") ? " niche-" + n.id : "");
        pill.innerHTML =
          '<span class="np-label">' + escapeHtml(n.label) +
          '</span><span class="np-pct">' + Math.round(n.score) + "%</span>";
        list.appendChild(pill);
      });
    }

    const lockEl = $("#lock-note");
    if (lockEl) {
      const at = Number(data.scanned_at), exp = Number(data.lock_expires_at);
      if (at > 0 && exp > 0) {
        const nowS = Date.now() / 1000;
        const ago = Math.max(0, nowS - at), left = Math.max(0, exp - nowS);
        const fmt = (s) => s < 3600 ? Math.max(1, Math.round(s / 60)) + "m"
          : s < 48 * 3600 ? Math.round(s / 3600) + "h" : Math.round(s / 86400) + "d";
        lockEl.textContent = (ago < 60 ? "Updated just now" : "Updated " + fmt(ago) + " ago") +
          " · refreshes in " + fmt(left);
      } else {
        lockEl.textContent = "Updated just now · refreshes in 24h";
      }
    }

    const shareBlock = $("#share-block");
    const preview = $("#card-preview");
    const dl = $("#card-download");
    const cardSrc = data.card_data_url || data.card_url || "";
    if (cardSrc && preview && dl) {
      preview.src = cardSrc;
      dl.href = cardSrc;
      dl.setAttribute("download", "nichescan-" + data.username + ".png");
      show(shareBlock);
    } else if (shareBlock) {
      hide(shareBlock);
    }

    const xBtn = $("#share-x");
    if (xBtn) {
      const top = niches[0];
      const sc = scoreEl ? scoreEl.textContent : "";
      const text = top
        ? "I'm " + top.label + " " + Math.round(top.score) + "% with a NicheScan score of " + sc + " \u{1F427} check yours"
        : "My NicheScan score is " + sc + " \u{1F427} check yours";
      const siteUrl = window.location.origin || "https://nichescan-mu.vercel.app";
      xBtn.href = "https://twitter.com/intent/tweet?text=" + encodeURIComponent(text) +
        "&url=" + encodeURIComponent(siteUrl);
    }

    document.body.classList.add("is-results");
    setView("results");
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  const demoAvatars = {};
  function setLoaderPfp(handle) {
    const img = document.getElementById("loader-pfp");
    const stage = document.querySelector(".peng-stage");
    if (!img || !stage) return;
    stage.classList.remove("has-pfp");
    img.onload = null;
    img.onerror = null;
    img.removeAttribute("src");
    if (!handle) return;
    const stored = demoAvatars[handle.toLowerCase()];
    img.onload = () => stage.classList.add("has-pfp");
    img.onerror = () => {
      if (img.dataset.fallback !== "1") {
        img.dataset.fallback = "1";
        img.src = "https://unavatar.io/x/" + encodeURIComponent(handle) + "?fallback=false";
      } else {
        stage.classList.remove("has-pfp"); // keep the penguin
      }
    };
    img.dataset.fallback = "0";
    img.src = stored || "/api/pfp?u=" + encodeURIComponent(handle);
  }

  // Loading screen: real steps streamed from the scan
  let loaderTimer = null;
  function setStep(text, pct) {
    scanStatus.classList.remove("tick");
    void scanStatus.offsetWidth;
    scanStatus.classList.add("tick");
    scanStatus.textContent = text;
    if (pct != null) progressBar.style.width = Math.round(pct) + "%";
  }
  const fmtN = (n) => n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M"
    : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K" : String(n);

  function onProgress(ev, handle, st) {
    if (ev.step === "profile") {
      setStep("Found @" + handle + (ev.followers ? " · " + fmtN(ev.followers) + " followers" : ""), 15);
      st.pct = 15;
    } else if (ev.step === "posts") {
      st.pct = Math.min(80, Math.max(st.pct, 15) + 2.5);
      setStep("Reading posts · " + fmtN(ev.n) + " fetched", st.pct);
    } else if (ev.step === "analyze") {
      setStep("Detecting niches", 85);
    } else if (ev.step === "card") {
      setStep("Calculating score", 92);
    }
  }

  async function runScanAnimation(handle) {
    setLoaderPfp(handle);
    setView("scanning");
    if (loaderTimer) { clearInterval(loaderTimer); loaderTimer = null; }
    setStep("Looking up @" + (handle || "account"), 6);
    await sleep(400);
  }

  // Anonymous visitor id for private usage stats.
  function visitorId() {
    try {
      let v = localStorage.getItem("ns_vid");
      if (!v || !/^[A-Za-z0-9_-]{8,64}$/.test(v)) {
        v = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
          : Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 10)).join("");
        localStorage.setItem("ns_vid", v);
      }
      return v;
    } catch (_) { return ""; }
  }

  function track(payload) {
    try {
      const body = JSON.stringify(Object.assign({ vid: visitorId() }, payload));
      if (navigator.sendBeacon && navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }))) return;
      fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    } catch (_) {}
  }

  async function scan(username, src) {
    const handle = normalizeUsername(username);
    if (!handle) {
      input.focus();
      return;
    }
    input.value = handle;
    scanBtn.disabled = true;

    const anim = runScanAnimation(handle);

    let data;
    let err;
    try {
      const res = await fetch("/api/scan?stream=1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: handle, src: src === "demo" ? "demo" : "typed", vid: visitorId() }),
      });
      let status = res.status, body = {};
      const ctype = res.headers.get("content-type") || "";
      if (res.ok && ctype.includes("ndjson") && res.body && res.body.getReader) {
        const reader = res.body.getReader(), dec = new TextDecoder();
        const st = { pct: 6 };
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
            if (ev.step === "done" || ev.step === "error") { final = ev; break; }
            onProgress(ev, handle, st);
          }
          if (done) break;
        }
        if (!final) throw new Error("Scan interrupted. Please retry.");
        status = final.status || 500;
        body = final.step === "done" ? final.result : { detail: final.detail };
      } else {
        body = await res.json().catch(() => ({}));
      }
      if (status < 200 || status >= 300) {
        let msg = body.detail || "Scan failed";
        if (Array.isArray(msg)) {
          msg = msg.map((x) => x.msg || JSON.stringify(x)).join("; ");
        }
        throw new Error(msg);
      }
      data = body;
    } catch (e) {
      err = e;
    }

    await anim;
    progressBar.style.width = "100%";
    await sleep(150);
    scanBtn.disabled = false;

    if (err) {
      $("#error-message").textContent =
        err.message || "Could not reach NicheScan.";
      setView("error");
      return;
    }
    renderResults(data);
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    scan(input.value);
  });

  $("#scan-another").addEventListener("click", () => {
    document.body.classList.remove("is-results");
    setView("hero");
    input.focus();
  });

  $("#error-retry").addEventListener("click", () => {
    setView("hero");
    input.focus();
  });

  function dataUrlToBlob(src) {
    const [head, b64] = src.split(",");
    const mime = (head.match(/data:([^;]+)/) || [])[1] || "image/png";
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }
  const isTouch = () =>
    (window.matchMedia && matchMedia("(pointer: coarse)").matches) ||
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const isIOS = () =>
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isInApp = () => /; wv\)|Twitter|FBAN|FBAV|Instagram/i.test(navigator.userAgent);

  function showSaveOverlay(blob) {
    const old = document.getElementById("ns-save-overlay");
    if (old) old.remove();
    const url = URL.createObjectURL(blob);
    const o = document.createElement("div");
    o.id = "ns-save-overlay";
    o.style.cssText = "position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.92);display:flex;" +
      "flex-direction:column;align-items:center;justify-content:center;padding:16px;color:#f5f3ff;" +
      "font:600 15px system-ui;text-align:center";
    o.innerHTML = '<p style="margin:0 0 12px">Long-press the image \u2192 Save image</p>' +
      '<img alt="NicheScan card" style="max-width:100%;max-height:75vh;height:auto;display:block;border-radius:8px">' +
      '<button type="button" style="margin-top:16px;padding:10px 22px;border-radius:999px;border:1px solid #7c3aed;' +
      'background:#12101c;color:#f5f3ff;font:600 14px system-ui;cursor:pointer">Close</button>';
    o.querySelector("img").src = url;
    const close = () => { o.remove(); URL.revokeObjectURL(url); };
    o.querySelector("button").addEventListener("click", close);
    o.addEventListener("click", (e) => { if (e.target === o) close(); });
    document.body.appendChild(o);
    window.__nsDownloadPath = "overlay";
  }

  const dlBtn = $("#card-download");
  if (dlBtn) {
    dlBtn.addEventListener("click", (ev) => {
      const src = dlBtn.getAttribute("href") || "";
      const dlName = (dlBtn.getAttribute("download") || "").replace(/^nichescan-|\.png$/g, "");
      if (src) track({ event: "download", handle: dlName });
      if (!src || !isTouch()) return;
      const name = dlBtn.getAttribute("download") || "nichescan-card.png";
      let blob;
      try {
        blob = src.startsWith("data:") ? dataUrlToBlob(src) : null;
      } catch (_) { blob = null; }
      if (!blob) return;
      if (isInApp()) { ev.preventDefault(); showSaveOverlay(blob); return; }
      if (!isIOS()) { window.__nsDownloadPath = "anchor"; return; }
      const file = new File([blob], name, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
        ev.preventDefault();
        navigator.share({ files: [file], title: "My NicheScan card" }).catch((err) => {
          if (err && err.name === "AbortError") return;
          window.__nsLastShareError = String(err);
          showSaveOverlay(blob);
        });
        window.__nsDownloadPath = "share";
        return;
      }
      if (isIOS()) {
        ev.preventDefault();
        const url = URL.createObjectURL(blob);
        const w = window.open("", "_blank");
        if (w) {
          w.document.write(
            '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">' +
            '<title>NicheScan card</title><body style="margin:0;background:#000;color:#f5f3ff;font:600 15px system-ui;text-align:center">' +
            '<p style="padding:18px 12px 6px">Long-press the image \u2192 Save to Photos</p>' +
            '<img src="' + url + '" style="width:100%;height:auto;display:block" alt="NicheScan card"></body>'
          );
          w.document.close();
          window.__nsDownloadPath = "ios-tab";
        } else {
          URL.revokeObjectURL(url);
          showSaveOverlay(blob);
        }
        return;
      }
    });
  }

  const shareBtn = $("#card-share");
  if (shareBtn) {
    shareBtn.addEventListener("click", async () => {
      const preview = $("#card-preview");
      const url = preview && preview.src;
      if (!url) return;
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        if (navigator.clipboard && window.ClipboardItem) {
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob }),
          ]);
          shareBtn.textContent = "Copied";
          setTimeout(() => { shareBtn.textContent = "Copy image"; }, 1500);
          return;
        }
      } catch (_) {}
      try {
        const a = document.createElement("a");
        a.href = url;
        a.download = "nichescan-card.png";
        a.click();
      } catch (_) {}
    });
  }

  // Demo pills rotate server-side
  let demoTimer = null;
  let demoNextRotation = 0;
  let demoClockSkew = 0;

  async function loadDemos() {
    let demos = [{ username: "xlee_istheking", display_name: "xlee" }];
    let next = 0;
    try {
      const res = await fetch("/api/demos", { cache: "no-cache" });
      if (res.ok) {
        const j = await res.json();
        if (j.demos && j.demos.length) demos = j.demos;
        if (j.server_time) demoClockSkew = j.server_time - Date.now() / 1000;
        next = Number(j.next_rotation) || 0;
      }
    } catch (_) {}

    demos.forEach((d) => {
      if (d.avatar_url) demoAvatars[String(d.username).toLowerCase()] = d.avatar_url;
    });
    demoChips.innerHTML = "";
    demos.forEach((d) => {
      const btn = document.createElement("button");
      btn.type = "button";
      const solid = d.username.toLowerCase() === "xlee_istheking";
      btn.className = "demo-chip" + (solid ? " demo-chip--solid" : "");
      const accent = /^#[0-9a-f]{6}$/i.test(d.accent_color || "") ? d.accent_color : "#8b5cf6";
      btn.style.setProperty("--chip", accent);
      btn.style.animationDelay = (Math.random() * 2).toFixed(2) + "s";
      const av = d.avatar_url
        ? '<img class="demo-chip-pfp" src="' + escapeHtml(d.avatar_url) + '" alt="" loading="lazy" referrerpolicy="no-referrer" />'
        : '<span class="demo-chip-pfp demo-chip-pfp--empty"></span>';
      btn.innerHTML = av + '<span class="demo-chip-handle">@' + escapeHtml(d.username) + "</span>";
      btn.title = d.display_name || d.username;
      btn.addEventListener("click", () => {
        input.value = normalizeUsername(d.username);
        scan(d.username, "demo");
      });
      demoChips.appendChild(btn);
    });
    scheduleDemoRotation(next);
  }

  function scheduleDemoRotation(next) {
    if (demoTimer) clearTimeout(demoTimer);
    demoNextRotation = next || 0;
    const wait = next
      ? Math.max(1000, (next - (Date.now() / 1000 + demoClockSkew)) * 1000 + 1500)
      : 60000;
    demoTimer = setTimeout(loadDemos, Math.min(wait, 2147483000));
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && demoNextRotation &&
        Date.now() / 1000 + demoClockSkew >= demoNextRotation) {
      loadDemos();
    }
  });

  loadDemos();
  setView("hero");
})();
