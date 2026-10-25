# NicheScan 🐧

> **Scan an X account · Get their niches · Share the card**  
> A high-fidelity, production-grade 1:1 clone and implementation of [NicheScan](https://nichescan-mu.vercel.app/).

![NicheScan Preview](penguin.webp)

---

## ⚡ Features

- **Live Twitter / X Intelligence**:
  - Live profile lookup & real-time metric analysis via FxTwitter / FixTweet.
  - Heuristic & neural niche scoring across CT Trader, Poly Maxi, Shitposter, Solana Degen, AI Builder, Dev / Builder, Airdrop Hunter, Alpha Caller, and more.
  - Overall Creator Score (0–100) calculated from reach, engagement rate, post frequency, and content consistency.

- **Rotating Demo Creator Chips**:
  - 7 curated sets of 5 creator accounts (total 35 top personalities).
  - Synchronized server-side 180-second rotation window with automatic client-side updates.

- **Real-Time Streaming Scanner**:
  - NDJSON streaming events (`profile` → `posts` → `analyze` → `card` → `done`).
  - Radar sweep scanner with glowing rings, scanline animation, and mascot penguin loader.

- **High-Resolution Card Generator (1200x675 PNG)**:
  - Pixel-perfect server-side rendering via **Pillow (PIL)** matching the 16:9 Twitter/X card standard.
  - Zone 1: Account (Avatar, Name, Handle, Bio).
  - Zone 2: Niche Intelligence (Score, Niche Pills, percentages).
  - Zone 3: Metrics (Followers, Engagement Rate, Impressions).

- **Modern Web Sharing & Downloads**:
  - 1-click **Copy Image** directly to system clipboard via `navigator.clipboard`.
  - Smart **Download** handling: native share sheet on iOS/iPadOS, direct download on desktop/Android, and long-press save overlay for in-app browsers (X, Instagram, Facebook).
  - 1-click **Share on X** with pre-filled dynamic score and profile stats.

- **Ambient Visuals**:
  - Ambient falling autumn leaves with sway, spin, and 3D flip physics that pause on tab blur.
  - Cyberpunk dark purple / metallic theme with glassmorphism and subtle SVG noise texture.

- **Private Analytics & Admin Dashboard**:
  - Access `/stats` (or `/stats/{key}`) to view total scans, card downloads, unique visitors, and conversion rate.
  - `/api/stats.csv` export for detailed event history.

---

## 🛠️ Tech Stack

- **Backend**: Python 3.10+, [FastAPI](https://fastapi.tiangolo.com/), [Pydantic v2](https://docs.pydantic.dev/), [Uvicorn](https://www.uvicorn.org/), [Pillow (PIL)](https://pillow.readthedocs.io/).
- **Frontend**: Clean Vanilla JavaScript (ES6+), Modern Semantic HTML5, CSS3 Custom Properties, SVG filters.
- **Deployment**: [Vercel](https://vercel.com/) Serverless Functions (`@vercel/python`) with `vercel.json` rewrites.

---

## 🚀 Quickstart & Local Setup

### 1. Prerequisites
Ensure you have **Python 3.10+** installed.

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Run Development Server
```bash
python server.py
```
Open your browser and navigate to:
```
http://localhost:8000
```

---

## 🧪 Running Automated Tests

A comprehensive test suite is included to verify all API endpoints, streaming responses, card image generation, and static file serving:

```bash
python test_backend.py
```

Expected output:
```
Ran 9 tests in 4.6s
OK
```

---

## ☁️ Vercel Deployment

This project is configured out-of-the-box for instant zero-config deployment on Vercel:

1. Push to your GitHub repository (already pushed to `SifatHossain456/nichescan`).
2. Import the repository in [Vercel](https://vercel.com/new).
3. Vercel automatically detects `vercel.json` and configures the Python serverless runtime and static assets.
4. Click **Deploy**!

---

## 📄 License

MIT License. Crafted for high performance and visual fidelity.
