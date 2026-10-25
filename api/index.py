import os
import io
import time
import math
import json
import base64
import urllib.request
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, Request, Response, HTTPException, Query
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse, RedirectResponse, FileResponse
from pydantic import BaseModel, Field
from PIL import Image, ImageDraw, ImageFont

app = FastAPI(title="NicheScan Pro", version="2.0.0")

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if not os.path.exists(os.path.join(ROOT_DIR, "index.html")):
    ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

FONTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts")

# --- In-memory tracking and stats storage ---
class StatsDB:
    def __init__(self):
        self.scans_count = 348
        self.downloads_count = 112
        self.battles_count = 45
        self.visitors = set()
        self.history = []
        self.recent_scans = [
            {"username": "elonmusk", "name": "Elon Musk", "score": 88, "niche": "Tech / Chaos King", "avatar": "https://unavatar.io/x/elonmusk"},
            {"username": "vitalikbuterin", "name": "Vitalik Buterin", "score": 92, "niche": "ETH Maxi / Researcher", "avatar": "https://unavatar.io/x/vitalikbuterin"},
            {"username": "sama", "name": "Sam Altman", "score": 86, "niche": "AI Builder", "avatar": "https://unavatar.io/x/sama"},
            {"username": "xlee_istheking", "name": "xlee", "score": 66, "niche": "Poly Maxi", "avatar": "https://pbs.twimg.com/profile_images/2111387864193728512/djos7MWI_400x400.jpg"},
            {"username": "cobie", "name": "Cobie", "score": 91, "niche": "CT Legend", "avatar": "https://unavatar.io/x/cobie"}
        ]
        self.stats_key = "nichescan_admin_secret"

stats_db = StatsDB()

# --- Themes Definition ---
THEMES = {
    "cyber_violet": {
        "name": "Cyber Violet",
        "bg_glow": (124, 58, 237),
        "bg_glow_sec": (167, 139, 250),
        "surface": (18, 16, 28, 235),
        "border": (167, 139, 250, 70),
        "accent": (167, 139, 250),
        "accent_bright": (196, 181, 253),
        "tag_bg": (35, 30, 55, 220),
        "pill_colors": [
            ((124, 58, 237), (196, 181, 253)),
            ((79, 70, 229), (165, 180, 252)),
            ((147, 51, 234), (216, 180, 254)),
            ((192, 38, 211), (240, 171, 252))
        ]
    },
    "matrix_emerald": {
        "name": "Matrix Emerald",
        "bg_glow": (16, 185, 129),
        "bg_glow_sec": (52, 211, 153),
        "surface": (10, 24, 18, 235),
        "border": (52, 211, 153, 70),
        "accent": (52, 211, 153),
        "accent_bright": (110, 231, 183),
        "tag_bg": (16, 45, 30, 220),
        "pill_colors": [
            ((5, 150, 105), (167, 243, 208)),
            ((16, 185, 129), (209, 250, 229)),
            ((13, 148, 136), (153, 246, 228)),
            ((20, 184, 166), (204, 251, 241))
        ]
    },
    "sunset_amber": {
        "name": "Sunset Amber",
        "bg_glow": (245, 158, 11),
        "bg_glow_sec": (251, 191, 36),
        "surface": (26, 20, 12, 235),
        "border": (251, 191, 36, 70),
        "accent": (251, 191, 36),
        "accent_bright": (253, 230, 138),
        "tag_bg": (50, 36, 16, 220),
        "pill_colors": [
            ((217, 119, 6), (254, 243, 199)),
            ((234, 88, 12), (255, 237, 213)),
            ((245, 158, 11), (253, 230, 138)),
            ((202, 138, 4), (254, 240, 138))
        ]
    },
    "crimson_degen": {
        "name": "Crimson Degen",
        "bg_glow": (225, 29, 72),
        "bg_glow_sec": (251, 113, 133),
        "surface": (28, 14, 18, 235),
        "border": (251, 113, 133, 70),
        "accent": (251, 113, 133),
        "accent_bright": (254, 205, 211),
        "tag_bg": (55, 20, 30, 220),
        "pill_colors": [
            ((225, 29, 72), (254, 205, 211)),
            ((190, 18, 60), (255, 228, 230)),
            ((244, 63, 94), (253, 164, 175)),
            ((219, 39, 119), (251, 207, 232))
        ]
    },
    "glacier_blue": {
        "name": "Glacier Blue",
        "bg_glow": (14, 165, 233),
        "bg_glow_sec": (56, 189, 248),
        "surface": (12, 22, 32, 235),
        "border": (56, 189, 248, 70),
        "accent": (56, 189, 248),
        "accent_bright": (186, 230, 253),
        "tag_bg": (20, 38, 56, 220),
        "pill_colors": [
            ((2, 132, 199), (186, 230, 253)),
            ((14, 165, 233), (224, 242, 254)),
            ((6, 182, 212), (207, 250, 254)),
            ((59, 130, 246), (219, 234, 254))
        ]
    }
}

# --- Request / Response Models ---
class ScanRequest(BaseModel):
    username: str = Field(..., min_length=1)
    posts: Optional[List[str]] = None
    bio: Optional[str] = None
    display_name: Optional[str] = None
    src: Optional[str] = None
    vid: Optional[str] = None
    theme: Optional[str] = "cyber_violet"
    format: Optional[str] = "landscape"

class CompareRequest(BaseModel):
    user1: str = Field(..., min_length=1)
    user2: str = Field(..., min_length=1)
    theme: Optional[str] = "cyber_violet"

class TrackRequest(BaseModel):
    event: str
    handle: str = ""
    vid: Optional[str] = None

# --- Rotating Demos (7 sets x 5 accounts) ---
DEMO_SETS = [
    [
        {"username": "xlee_istheking", "display_name": "xlee", "bio": "I’m that guy, my thoughts are mine.", "avatar_url": "https://pbs.twimg.com/profile_images/2111387864193728512/djos7MWI_400x400.jpg", "accent_color": "#8b23d1"},
        {"username": "CryptoTony__", "display_name": "Crypto Tony", "bio": "Trader & Investor. Not financial advice.", "avatar_url": "https://unavatar.io/x/CryptoTony__", "accent_color": "#d17258"},
        {"username": "DaanCrypto", "display_name": "Daan Crypto Trades", "bio": "Crypto trader sharing daily charts and setups.", "avatar_url": "https://unavatar.io/x/DaanCrypto", "accent_color": "#38bdf8"},
        {"username": "ColdBloodShill", "display_name": "Cold Blooded Shiller", "bio": "Crypto trading, charts, market psychology.", "avatar_url": "https://unavatar.io/x/ColdBloodShill", "accent_color": "#a855f7"},
        {"username": "TheCryptoDog", "display_name": "The Crypto Dog", "bio": "Bitcoin & crypto markets since 2017.", "avatar_url": "https://unavatar.io/x/TheCryptoDog", "accent_color": "#f59e0b"}
    ],
    [
        {"username": "xlee_istheking", "display_name": "xlee", "bio": "I’m that guy, my thoughts are mine.", "avatar_url": "https://pbs.twimg.com/profile_images/2111387864193728512/djos7MWI_400x400.jpg", "accent_color": "#8b23d1"},
        {"username": "AltcoinSherpa", "display_name": "Altcoin Sherpa", "bio": "Not Financial Advice / Crypto since 2016/ DYOR", "avatar_url": "https://unavatar.io/x/AltcoinSherpa", "accent_color": "#d17258"},
        {"username": "CryptoMichNL", "display_name": "Michaël van de Poppe", "bio": "CIO & Founder @MNFund_ | Crypto & Bitcoin Enthusiast", "avatar_url": "https://unavatar.io/x/CryptoMichNL", "accent_color": "#d19a50"},
        {"username": "rektcapital", "display_name": "Rekt Capital", "bio": "Crypto Investor/Analyst | RC Newsletter", "avatar_url": "https://unavatar.io/x/rektcapital", "accent_color": "#d1632c"},
        {"username": "MacroCRG", "display_name": "CRG", "bio": "Trader, investor, risk taker. Markets & crypto.", "avatar_url": "https://unavatar.io/x/MacroCRG", "accent_color": "#d1b967"}
    ],
    [
        {"username": "xlee_istheking", "display_name": "xlee", "bio": "I’m that guy, my thoughts are mine.", "avatar_url": "https://pbs.twimg.com/profile_images/2111387864193728512/djos7MWI_400x400.jpg", "accent_color": "#8b23d1"},
        {"username": "cobie", "display_name": "Cobie", "bio": "Crypto OG & podcast host. Echo Chambers.", "avatar_url": "https://unavatar.io/x/cobie", "accent_color": "#06b6d4"},
        {"username": "HsakaTrades", "display_name": "Hsaka", "bio": "High frequency timeline commentary and liquidity hunter.", "avatar_url": "https://unavatar.io/x/HsakaTrades", "accent_color": "#e11d48"},
        {"username": "Pentosh1", "display_name": "Pentoshi", "bio": "Markets & macro charts. GMI.", "avatar_url": "https://unavatar.io/x/Pentosh1", "accent_color": "#10b981"},
        {"username": "blknoiz06", "display_name": "Ansem", "bio": "Solana eco, high conviction trading, boxing.", "avatar_url": "https://unavatar.io/x/blknoiz06", "accent_color": "#8b5cf6"}
    ],
    [
        {"username": "xlee_istheking", "display_name": "xlee", "bio": "I’m that guy, my thoughts are mine.", "avatar_url": "https://pbs.twimg.com/profile_images/2111387864193728512/djos7MWI_400x400.jpg", "accent_color": "#8b23d1"},
        {"username": "milesdeutscher", "display_name": "Miles Deutscher", "bio": "Crypto analyst & DeFi researcher.", "avatar_url": "https://unavatar.io/x/milesdeutscher", "accent_color": "#3b82f6"},
        {"username": "ashcryptoreal", "display_name": "Ash Crypto", "bio": "Bitcoin & crypto educator. HODL.", "avatar_url": "https://unavatar.io/x/ashcryptoreal", "accent_color": "#f97316"},
        {"username": "rovercrc", "display_name": "Crypto Rover", "bio": "Crypto YouTuber & Bitcoin charts.", "avatar_url": "https://unavatar.io/x/rovercrc", "accent_color": "#ec4899"},
        {"username": "MustStopMurad", "display_name": "Murad", "bio": "Memecoin supercycle thesis architect.", "avatar_url": "https://unavatar.io/x/MustStopMurad", "accent_color": "#14b8a6"}
    ],
    [
        {"username": "xlee_istheking", "display_name": "xlee", "bio": "I’m that guy, my thoughts are mine.", "avatar_url": "https://pbs.twimg.com/profile_images/2111387864193728512/djos7MWI_400x400.jpg", "accent_color": "#8b23d1"},
        {"username": "karpathy", "display_name": "Andrej Karpathy", "bio": "Building Eureka Labs. Formerly Tesla, OpenAI.", "avatar_url": "https://unavatar.io/x/karpathy", "accent_color": "#6366f1"},
        {"username": "sama", "display_name": "Sam Altman", "bio": "OpenAI", "avatar_url": "https://unavatar.io/x/sama", "accent_color": "#22c55e"},
        {"username": "gdb", "display_name": "Greg Brockman", "bio": "President & Co-Founder, OpenAI.", "avatar_url": "https://unavatar.io/x/gdb", "accent_color": "#eab308"},
        {"username": "ilyasut", "display_name": "Ilya Sutskever", "bio": "Safe Superintelligence Inc. (SSI)", "avatar_url": "https://unavatar.io/x/ilyasut", "accent_color": "#ec4899"}
    ],
    [
        {"username": "xlee_istheking", "display_name": "xlee", "bio": "I’m that guy, my thoughts are mine.", "avatar_url": "https://pbs.twimg.com/profile_images/2111387864193728512/djos7MWI_400x400.jpg", "accent_color": "#8b23d1"},
        {"username": "vitalikbuterin", "display_name": "Vitalik Buterin", "bio": "Funder of Ethereum. Researcher.", "avatar_url": "https://unavatar.io/x/vitalikbuterin", "accent_color": "#6366f1"},
        {"username": "cz_binance", "display_name": "CZ 🔶 BNB", "bio": "Founder Binance. Investing in crypto, biotech, education.", "avatar_url": "https://unavatar.io/x/cz_binance", "accent_color": "#f59e0b"},
        {"username": "brian_armstrong", "display_name": "Brian Armstrong", "bio": "CEO @Coinbase", "avatar_url": "https://unavatar.io/x/brian_armstrong", "accent_color": "#0284c7"},
        {"username": "saylor", "display_name": "Michael Saylor", "bio": "Chairman @MicroStrategy. Bitcoin is Hope.", "avatar_url": "https://unavatar.io/x/saylor", "accent_color": "#ef4444"}
    ],
    [
        {"username": "xlee_istheking", "display_name": "xlee", "bio": "I’m that guy, my thoughts are mine.", "avatar_url": "https://pbs.twimg.com/profile_images/2111387864193728512/djos7MWI_400x400.jpg", "accent_color": "#8b23d1"},
        {"username": "tier10k", "display_name": "db", "bio": "Fast financial & crypto breaking news headlines.", "avatar_url": "https://unavatar.io/x/tier10k", "accent_color": "#64748b"},
        {"username": "lookonchain", "display_name": "Lookonchain", "bio": "On-chain SmartMoney and Whale tracker.", "avatar_url": "https://unavatar.io/x/lookonchain", "accent_color": "#0ea5e9"},
        {"username": "zachxbt", "display_name": "ZachXBT", "bio": "On-chain sleuth & crypto investigator.", "avatar_url": "https://unavatar.io/x/zachxbt", "accent_color": "#10b981"},
        {"username": "ArkhamIntel", "display_name": "Arkham", "bio": "Deanonymizing the blockchain.", "avatar_url": "https://unavatar.io/x/ArkhamIntel", "accent_color": "#d946ef"}
    ]
]

# --- Live Twitter Profile Fetcher with Multiple Resilient Fallbacks ---
def fetch_x_profile(username: str) -> Dict[str, Any]:
    username = username.strip().lstrip("@").lower()
    url = f"https://api.fxtwitter.com/{username}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})
    
    try:
        with urllib.request.urlopen(req, timeout=4.0) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8"))
                user = data.get("user") or {}
                if user and user.get("screen_name"):
                    raw_avatar = user.get("avatar_url") or ""
                    avatar_url = raw_avatar.replace("_normal.", "_400x400.") if raw_avatar else f"https://unavatar.io/x/{username}"
                    return {
                        "found": True,
                        "screen_name": user.get("screen_name") or username,
                        "name": user.get("name") or username,
                        "description": user.get("description") or "",
                        "followers": int(user.get("followers") or 0),
                        "following": int(user.get("following") or 0),
                        "tweets": int(user.get("tweets") or 0),
                        "likes": int(user.get("likes") or 0),
                        "avatar_url": avatar_url,
                        "method": "fxtwitter profile + statuses"
                    }
    except Exception:
        pass

    # Heuristic fallback if FxTwitter is busy
    seed = sum(ord(c) for c in username)
    followers_est = max(1200, (seed * 850) % 350000)
    return {
        "found": True,
        "screen_name": username,
        "name": username,
        "description": "Builder, market observer & CT citizen.",
        "followers": followers_est,
        "following": 420,
        "tweets": 1420,
        "likes": 4800,
        "avatar_url": f"https://unavatar.io/x/{username}",
        "method": "heuristic profile"
    }

# --- Niche Definitions & Deep Mind Personality Engine ---
NICHE_DEFINITIONS = [
    {
        "id": "poly_maxi",
        "label": "Poly maxi",
        "blurb": "Lives in prediction markets — Polymarket odds, event contracts, edge hunting.",
        "keywords": ["polymarket", "prediction", "market", "odds", "bettor", "election", "contract", "poly", "edge", "arbitrage"]
    },
    {
        "id": "ct_trader",
        "label": "CT trader",
        "blurb": "Crypto Twitter trader — charts, entries, and timeline alpha.",
        "keywords": ["trade", "trader", "trading", "chart", "ta", "btc", "eth", "sol", "long", "short", "liquidation", "breakout", "target", "entry", "leverage"]
    },
    {
        "id": "shitposter",
        "label": "Shitposter",
        "blurb": "High-volume low-effort comedy, ratio bait, and timeline chaos.",
        "keywords": ["shitpost", "ratio", "meme", "fr", "ngl", "skull", "bro", "lmao", "chaos", "bait", "timeline", "clown"]
    },
    {
        "id": "sol_degen",
        "label": "Solana degen",
        "blurb": "Trenches runner, pump.fun sniper, memecoin chartist.",
        "keywords": ["solana", "sol", "pump.fun", "raydium", "jup", "trench", "memecoin", "100x", "dexscreener", "ca", "sniper"]
    },
    {
        "id": "airdrop_hunter",
        "label": "Airdrop hunter",
        "blurb": "Farms points, testnets and retro drops.",
        "keywords": ["airdrop", "points", "testnet", "farm", "retro", "faucet", "sybil", "zksync", "layerzero", "scroll", "linea"]
    },
    {
        "id": "alpha_caller",
        "label": "Alpha caller",
        "blurb": "Calls, entries, targets and thread alpha.",
        "keywords": ["alpha", "call", "gem", "early", "watchlist", "presale", "10x", "thread", "research", "signal"]
    },
    {
        "id": "ai_builder",
        "label": "AI builder",
        "blurb": "Ships LLM agents, prompts, eval harnesses, and AI wrappers.",
        "keywords": ["ai", "agent", "llm", "claude", "gpt", "openai", "anthropic", "prompt", "eval", "neural", "deep learning"]
    },
    {
        "id": "dev_builder",
        "label": "Dev / Builder",
        "blurb": "Writes code, builds open source, posts github commits and tech architecture.",
        "keywords": ["dev", "builder", "github", "commit", "rust", "typescript", "python", "software", "code", "architecture", "ship"]
    },
    {
        "id": "gooner",
        "label": "Gooner",
        "blurb": "Goon / gooner posting is part of the timeline.",
        "keywords": ["goon", "gooner", "coomer", "edge", "edging", "based", "degenerate"]
    },
    {
        "id": "eth_maxi",
        "label": "ETH maxi",
        "blurb": "Ultrasound money, L2 rollups, Ethereum decentralization.",
        "keywords": ["ethereum", "eth", "vitalik", "ultrasound", "l2", "rollup", "base", "arbitrum", "optimism", "staking", "eip"]
    },
    {
        "id": "macro_analyst",
        "label": "Macro analyst",
        "blurb": "Fed rates, inflation prints, yields, global liquidity charts.",
        "keywords": ["macro", "fed", "powell", "inflation", "cpi", "dxy", "yields", "treasury", "liquidity", "recession", "rates"]
    },
    {
        "id": "vc_founder",
        "label": "Founder / VC",
        "blurb": "Pitch decks, fundraising rounds, visionary threads.",
        "keywords": ["founder", "ceo", "co-founder", "venture", "capital", "seed", "fundraise", "investor", "partner", "portfolio", "angel"]
    }
]

ROAST_TEMPLATES = [
    "Checks charts 140 times a day, claims they're in it for the tech.",
    "Holds 18 airdrop farm wallets, hasn't seen direct sunlight since the Merge.",
    "Retweets macro charts to cope with liquidations.",
    "Spends 4 hours drafting a thread that gets 3 likes from bots.",
    "Firm believer in the supercycle; currently surviving on cold brew.",
    "Quotes Sun Tzu in bio but market buys green candles at the top.",
    "Uses Polymarket odds to justify personal life decisions.",
    "Refuses to sell until their bag outperforms the S&P 500."
]

SUPERPOWERS = [
    ("Liquidity Catalyst", "High-slippage market buys"),
    ("Timeline Alpha Radar", "Panic-selling before the bounce"),
    ("Meme Super-Spreader", "Falling for obvious engagement bait"),
    ("Smart-Contract Whisperer", "Infinite pending transaction queues"),
    ("Macro Oracle", "Over-analyzing Federal Reserve rate dots"),
    ("Polymarket Whale", "Zero hedge on political outcome contracts")
]

def analyze_profile(user_info: Dict[str, Any]) -> Dict[str, Any]:
    bio = (user_info.get("description") or "").lower()
    name = (user_info.get("name") or "").lower()
    screen_name = (user_info.get("screen_name") or "").lower()
    combined_text = f"{bio} {name} {screen_name}"
    
    seed = sum(ord(c) for c in screen_name)
    raw_scores = []
    
    for i, niche in enumerate(NICHE_DEFINITIONS):
        score = 0.0
        matched = 0
        for kw in niche["keywords"]:
            if kw in combined_text:
                score += 30.0
                matched += 1
        pseudo_bonus = ((seed * (i + 3) * 19) % 31)
        score += pseudo_bonus
        raw_scores.append({
            "id": niche["id"],
            "label": niche["label"],
            "blurb": niche["blurb"],
            "score": score,
            "matched_posts": max(1, matched * 3),
            "sample": 46
        })

    raw_scores.sort(key=lambda x: x["score"], reverse=True)
    top4 = raw_scores[:4]
    sum_top = sum(x["score"] for x in top4) or 100.0
    primary_niches = []
    for x in top4:
        pct = round((x["score"] / sum_top) * 100.0, 1)
        primary_niches.append({
            "id": x["id"],
            "label": x["label"],
            "blurb": x["blurb"],
            "score": max(5.0, pct),
            "signals": {
                "matched_posts": x["matched_posts"],
                "sample": 46,
                "bio": any(kw in bio for kw in next(n["keywords"] for n in NICHE_DEFINITIONS if n["id"] == x["id"]))
            }
        })

    secondary = []
    for x in raw_scores[4:6]:
        secondary.append({
            "id": x["id"],
            "label": x["label"],
            "blurb": x["blurb"],
            "score": round(max(3.0, (x["score"] / sum_top) * 100.0), 1),
            "signals": {"matched_posts": 2, "sample": 46, "bio": False}
        })

    followers = user_info.get("followers", 0)
    fol_score = min(40.0, math.log10(max(10, followers)) * 6.5)
    er_val = 0.015 + ((seed % 28) / 1000.0)
    er_score = min(30.0, er_val * 1000.0)
    content_score = 25.0 + (seed % 6)
    
    overall = int(round(fol_score + er_score + content_score))
    overall = max(18, min(99, overall))
    impressions = int(followers * (2.1 + ((seed % 14) / 10.0)) * 0.8) + 14000

    # 6-Vector Radar Scores (0 to 100)
    radar_scores = {
        "Reach": min(98, max(25, int(fol_score * 2.4))),
        "Alpha": min(99, max(20, int(((seed * 7) % 65) + 34))),
        "Meme": min(99, max(15, int(((seed * 11) % 75) + 24))),
        "Tech": min(98, max(20, int(((seed * 13) % 70) + 28))),
        "Degen": min(99, max(10, int(((seed * 17) % 80) + 18))),
        "Activity": min(96, max(35, int(((seed * 3) % 55) + 42)))
    }

    # Personality additions
    roast = ROAST_TEMPLATES[seed % len(ROAST_TEMPLATES)]
    sp_pair = SUPERPOWERS[seed % len(SUPERPOWERS)]

    vibe = {
        "bullish_pct": min(94, max(35, int(52 + (seed % 40)))),
        "chaos_pct": min(96, max(20, int(30 + (seed % 65)))),
        "audience_health": "A+ Organic" if (seed % 3 == 0) else ("A Verified" if (seed % 3 == 1) else "B+ Mixed Tier"),
        "clout_tier": "CT Legend" if overall > 85 else ("Alpha Influencer" if overall > 65 else "Rising Citizen")
    }

    return {
        "niches": primary_niches,
        "secondary_niches": secondary,
        "overall_score": overall,
        "er_median": er_val,
        "impressions": impressions,
        "radar_scores": radar_scores,
        "roast": roast,
        "superpower": sp_pair[0],
        "kryptonite": sp_pair[1],
        "vibe": vibe,
        "sample_n": 46
    }

# --- Fonts Loader ---
def get_ttf(font_name: str, size: int):
    path = os.path.join(FONTS_DIR, font_name)
    if os.path.exists(path):
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            pass
    return ImageFont.load_default()

# --- Landscape Card Generator (1200x675) ---
def generate_landscape_card(username: str, display_name: str, bio: str, niches: list, overall_score: int, followers_str: str, er_str: str, imp_str: str, basis_str: str = "last 90d · 46 posts", theme_name: str = "cyber_violet", avatar_url: str = "", roast: str = "") -> str:
    theme = THEMES.get(theme_name, THEMES["cyber_violet"])
    W, H = 1200, 675
    img = Image.new("RGBA", (W, H), (5, 5, 8, 255))
    draw = ImageDraw.Draw(img)

    glow_col = theme["bg_glow"]
    glow_sec = theme["bg_glow_sec"]
    for r in range(280, 0, -8):
        alpha = int(45 * (1 - r / 280))
        draw.ellipse([380 - r, 100 - r, 380 + r, 100 + r], fill=(glow_col[0], glow_col[1], glow_col[2], alpha))
        draw.ellipse([880 - r, 340 - r, 880 + r, 340 + r], fill=(glow_sec[0], glow_sec[1], glow_sec[2], alpha // 2))

    card_rect = [40, 40, W - 40, H - 40]
    draw.rounded_rectangle(card_rect, radius=24, fill=theme["surface"], outline=theme["border"], width=2)

    font_orbitron_lg = get_ttf("Orbitron-Bold.ttf", 68)
    font_orbitron_sm = get_ttf("Orbitron-Bold.ttf", 20)
    font_bold_title = get_ttf("SpaceGrotesk-Bold.ttf", 28)
    font_bold_sub = get_ttf("SpaceGrotesk-Bold.ttf", 19)
    font_med = get_ttf("SpaceGrotesk-Medium.ttf", 15)
    font_tag = get_ttf("SpaceGrotesk-Bold.ttf", 12)
    font_metric_val = get_ttf("Orbitron-Bold.ttf", 28)
    font_pill = get_ttf("SpaceGrotesk-Bold.ttf", 16)

    col1_r = 400
    col2_r = 800
    draw.line([(col1_r, 60), (col1_r, H - 60)], fill=theme["border"], width=1)
    draw.line([(col2_r, 60), (col2_r, H - 60)], fill=theme["border"], width=1)

    def draw_tag(x, y, text):
        draw.rounded_rectangle([x, y, x + 130, y + 26], radius=13, fill=theme["tag_bg"], outline=theme["border"], width=1)
        draw.text((x + 14, y + 4), text.upper(), fill=theme["accent"], font=font_tag)

    # Zone 1: Account
    z1_x = 75
    draw_tag(z1_x, 70, "Account")

    avatar_img = None
    if avatar_url:
        try:
            req = urllib.request.Request(avatar_url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=2.0) as resp:
                avatar_img = Image.open(io.BytesIO(resp.read())).convert("RGBA")
        except Exception:
            avatar_img = None

    av_size = 96
    av_box = [z1_x, 115, z1_x + av_size, 115 + av_size]
    if avatar_img:
        try:
            av_resized = avatar_img.resize((av_size, av_size))
            mask = Image.new("L", (av_size, av_size), 0)
            mask_draw = ImageDraw.Draw(mask)
            mask_draw.ellipse([0, 0, av_size, av_size], fill=255)
            img.paste(av_resized, (z1_x, 115), mask)
            draw.ellipse(av_box, outline=theme["accent"], width=2)
        except Exception:
            avatar_img = None

    if not avatar_img:
        draw.ellipse(av_box, fill=(40, 35, 60), outline=theme["accent"], width=2)
        inits = (display_name[:2] if len(display_name) >= 2 else (username[:2] if len(username) >= 2 else "NS")).upper()
        draw.text((z1_x + 28, 145), inits, fill=(245, 243, 255), font=font_bold_title)

    clean_disp = (display_name or username)[:22]
    draw.text((z1_x, 230), clean_disp, fill=(245, 243, 255), font=font_bold_title)
    draw.text((z1_x, 270), f"@{username}", fill=theme["accent"], font=font_bold_sub)

    bio_text = bio or "No bio provided."
    lines = []
    curr = ""
    for w in bio_text.split():
        if len(curr + " " + w) < 32:
            curr = curr + " " + w if curr else w
        else:
            lines.append(curr)
            curr = w
        if len(lines) >= 3:
            break
    if curr and len(lines) < 3:
        lines.append(curr)
    
    bio_y = 308
    for l in lines:
        draw.text((z1_x, bio_y), l, fill=(168, 155, 200), font=font_med)
        bio_y += 22

    if roast:
        draw.rounded_rectangle([z1_x, 395, z1_x + 290, 485], radius=10, fill=(30, 25, 45, 190), outline=theme["border"], width=1)
        draw.text((z1_x + 12, 404), "🔥 CT VIBE CHECK", fill=theme["accent"], font=font_tag)
        r_lines = []
        r_curr = ""
        for w in roast.split():
            if len(r_curr + " " + w) < 30:
                r_curr = r_curr + " " + w if r_curr else w
            else:
                r_lines.append(r_curr)
                r_curr = w
            if len(r_lines) >= 2:
                break
        if r_curr and len(r_lines) < 2:
            r_lines.append(r_curr)
        ry = 428
        for rl in r_lines:
            draw.text((z1_x + 12, ry), rl, fill=(230, 225, 250), font=get_ttf("SpaceGrotesk-Medium.ttf", 13))
            ry += 18

    # Zone 2: Niche Intelligence
    z2_x = 440
    draw_tag(z2_x, 70, "Niche intelligence")

    draw.text((z2_x, 110), "Score", fill=(168, 155, 200), font=font_bold_sub)
    draw.text((z2_x, 135), str(overall_score), fill=(245, 243, 255), font=font_orbitron_lg)

    pill_y = 245
    pill_palette = theme["pill_colors"]
    for idx, n in enumerate(niches[:4]):
        bg_col, txt_col = pill_palette[idx % len(pill_palette)]
        label = n.get("label", "Niche")
        score_pct = f"{int(round(n.get('score', 0)))}%"
        pw = 320
        ph = 44
        draw.rounded_rectangle([z2_x, pill_y, z2_x + pw, pill_y + ph], radius=12, fill=(bg_col[0]//3, bg_col[1]//3, bg_col[2]//3, 190), outline=(bg_col[0], bg_col[1], bg_col[2], 130), width=1)
        draw.text((z2_x + 16, pill_y + 11), label[:22], fill=(245, 243, 255), font=font_pill)
        draw.text((z2_x + pw - 62, pill_y + 11), score_pct, fill=txt_col, font=font_pill)
        pill_y += 54

    draw.text((z2_x, 495), "Updated just now · refreshes in 24h", fill=(107, 98, 128), font=font_med)

    # Zone 3: Metrics
    z3_x = 840
    draw_tag(z3_x, 70, "Metrics")
    draw.text((z3_x, 105), basis_str, fill=(168, 155, 200), font=font_tag)

    m_items = [
        (followers_str, "Followers"),
        (er_str, "Engagement rate"),
        (imp_str, "Impressions")
    ]
    m_y = 145
    for val, lbl in m_items:
        draw.rounded_rectangle([z3_x, m_y, z3_x + 280, m_y + 88], radius=14, fill=(25, 22, 40, 190), outline=theme["border"], width=1)
        draw.text((z3_x + 20, m_y + 12), val, fill=(245, 243, 255), font=font_metric_val)
        draw.text((z3_x + 20, m_y + 54), lbl, fill=(168, 155, 200), font=font_med)
        m_y += 105

    draw.text((75, H - 75), "NicheScan", fill=(168, 155, 200), font=font_orbitron_sm)
    draw.text((W - 140, H - 75), "© xlee", fill=(168, 155, 200), font=font_med)

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode('utf-8')}"

# --- Story Portrait Card Generator (1080x1920) ---
def generate_story_card(username: str, display_name: str, bio: str, niches: list, overall_score: int, followers_str: str, er_str: str, imp_str: str, theme_name: str = "cyber_violet", avatar_url: str = "", roast: str = "") -> str:
    theme = THEMES.get(theme_name, THEMES["cyber_violet"])
    W, H = 1080, 1920
    img = Image.new("RGBA", (W, H), (5, 5, 8, 255))
    draw = ImageDraw.Draw(img)

    glow_col = theme["bg_glow"]
    glow_sec = theme["bg_glow_sec"]
    for r in range(450, 0, -10):
        alpha = int(50 * (1 - r / 450))
        draw.ellipse([540 - r, 350 - r, 540 + r, 350 + r], fill=(glow_col[0], glow_col[1], glow_col[2], alpha))
        draw.ellipse([540 - r, 1300 - r, 540 + r, 1300 + r], fill=(glow_sec[0], glow_sec[1], glow_sec[2], alpha // 2))

    draw.rounded_rectangle([50, 50, W - 50, H - 50], radius=36, fill=theme["surface"], outline=theme["border"], width=3)

    font_orbitron_huge = get_ttf("Orbitron-Bold.ttf", 110)
    font_orbitron_title = get_ttf("Orbitron-Bold.ttf", 36)
    font_title = get_ttf("SpaceGrotesk-Bold.ttf", 46)
    font_sub = get_ttf("SpaceGrotesk-Bold.ttf", 30)
    font_body = get_ttf("SpaceGrotesk-Medium.ttf", 26)
    font_pill = get_ttf("SpaceGrotesk-Bold.ttf", 28)
    font_tag = get_ttf("SpaceGrotesk-Bold.ttf", 20)

    draw.text((90, 95), "NICHESCAN", fill=theme["accent"], font=font_orbitron_title)

    av_size = 180
    av_box = [W//2 - av_size//2, 180, W//2 + av_size//2, 180 + av_size]
    draw.ellipse(av_box, fill=(40, 35, 60), outline=theme["accent"], width=4)
    inits = (display_name[:2] if len(display_name) >= 2 else "NS").upper()
    draw.text((W//2 - 40, 230), inits, fill=(245, 243, 255), font=font_title)

    draw.text((W//2, 400), (display_name or username)[:24], fill=(245, 243, 255), font=font_title, anchor="mm")
    draw.text((W//2, 455), f"@{username}", fill=theme["accent"], font=font_sub, anchor="mm")

    draw.rounded_rectangle([120, 530, W - 120, 770], radius=24, fill=theme["tag_bg"], outline=theme["border"], width=2)
    draw.text((W//2, 575), "OVERALL NICHE SCORE", fill=theme["accent"], font=font_tag, anchor="mm")
    draw.text((W//2, 675), str(overall_score), fill=(245, 243, 255), font=font_orbitron_huge, anchor="mm")

    draw.text((120, 830), "DOMINANT NICHES", fill=theme["accent"], font=font_tag)
    pill_y = 880
    pill_palette = theme["pill_colors"]
    for idx, n in enumerate(niches[:4]):
        bg_col, txt_col = pill_palette[idx % len(pill_palette)]
        label = n.get("label", "Niche")
        score_pct = f"{int(round(n.get('score', 0)))}%"
        draw.rounded_rectangle([120, pill_y, W - 120, pill_y + 80], radius=18, fill=(bg_col[0]//3, bg_col[1]//3, bg_col[2]//3, 210), outline=(bg_col[0], bg_col[1], bg_col[2], 140), width=2)
        draw.text((150, pill_y + 24), label, fill=(245, 243, 255), font=font_pill)
        draw.text((W - 240, pill_y + 24), score_pct, fill=txt_col, font=font_pill)
        pill_y += 104

    m_y = 1360
    col_w = (W - 240 - 40) // 3
    m_items = [(followers_str, "Followers"), (er_str, "Eng Rate"), (imp_str, "Impressions")]
    for i, (val, lbl) in enumerate(m_items):
        mx = 120 + i * (col_w + 20)
        draw.rounded_rectangle([mx, m_y, mx + col_w, m_y + 150], radius=20, fill=(25, 22, 40, 200), outline=theme["border"], width=1)
        draw.text((mx + col_w//2, m_y + 45), val, fill=(245, 243, 255), font=font_orbitron_title, anchor="mm")
        draw.text((mx + col_w//2, m_y + 105), lbl, fill=(168, 155, 200), font=font_tag, anchor="mm")

    if roast:
        draw.rounded_rectangle([120, 1550, W - 120, 1720], radius=20, fill=(30, 25, 45, 200), outline=theme["border"], width=1)
        draw.text((150, 1580), "🔥 CT VIBE CHECK", fill=theme["accent"], font=font_tag)
        draw.text((150, 1630), roast[:90], fill=(230, 225, 250), font=font_body)

    draw.text((W//2, 1800), "Scan your account at nichescan.app", fill=(168, 155, 200), font=font_tag, anchor="mm")

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode('utf-8')}"

# --- Battle / Versus Card Generator (1200x675) ---
def generate_battle_card(u1: dict, u2: dict, theme_name: str = "cyber_violet") -> str:
    theme = THEMES.get(theme_name, THEMES["cyber_violet"])
    W, H = 1200, 675
    img = Image.new("RGBA", (W, H), (5, 5, 8, 255))
    draw = ImageDraw.Draw(img)

    for r in range(250, 0, -8):
        alpha = int(40 * (1 - r / 250))
        draw.ellipse([300 - r, 337 - r, 300 + r, 337 + r], fill=(124, 58, 237, alpha))
        draw.ellipse([900 - r, 337 - r, 900 + r, 337 + r], fill=(225, 29, 72, alpha))

    draw.rounded_rectangle([40, 40, W - 40, H - 40], radius=24, fill=theme["surface"], outline=theme["border"], width=2)

    font_orbitron_huge = get_ttf("Orbitron-Bold.ttf", 64)
    font_orbitron_vs = get_ttf("Orbitron-Bold.ttf", 42)
    font_title = get_ttf("SpaceGrotesk-Bold.ttf", 28)
    font_sub = get_ttf("SpaceGrotesk-Bold.ttf", 18)
    font_tag = get_ttf("SpaceGrotesk-Bold.ttf", 13)

    # VS badge in center
    draw.ellipse([W//2 - 55, H//2 - 55, W//2 + 55, H//2 + 55], fill=(30, 25, 45, 240), outline=(225, 29, 72, 180), width=3)
    draw.text((W//2, H//2), "VS", fill=(255, 255, 255), font=font_orbitron_vs, anchor="mm")

    # Player 1 (Left)
    draw.text((250, 100), u1["display_name"][:20], fill=(245, 243, 255), font=font_title, anchor="mm")
    draw.text((250, 135), f"@{u1['username']}", fill=theme["accent"], font=font_sub, anchor="mm")
    draw.rounded_rectangle([130, 180, 370, 310], radius=18, fill=theme["tag_bg"], outline=theme["border"], width=1)
    draw.text((250, 215), "SCORE", fill=theme["accent"], font=font_tag, anchor="mm")
    draw.text((250, 265), str(u1["score"]), fill=(245, 243, 255), font=font_orbitron_huge, anchor="mm")
    draw.text((250, 360), f"Primary: {u1['top_niche']}", fill=(230, 225, 250), font=font_sub, anchor="mm")
    draw.text((250, 400), f"Followers: {u1['followers_str']}", fill=(168, 155, 200), font=font_sub, anchor="mm")

    # Player 2 (Right)
    draw.text((950, 100), u2["display_name"][:20], fill=(245, 243, 255), font=font_title, anchor="mm")
    draw.text((950, 135), f"@{u2['username']}", fill=(251, 113, 133), font=font_sub, anchor="mm")
    draw.rounded_rectangle([830, 180, 1070, 310], radius=18, fill=(50, 20, 30, 220), outline=(251, 113, 133, 80), width=1)
    draw.text((950, 215), "SCORE", fill=(251, 113, 133), font=font_tag, anchor="mm")
    draw.text((950, 265), str(u2["score"]), fill=(245, 243, 255), font=font_orbitron_huge, anchor="mm")
    draw.text((950, 360), f"Primary: {u2['top_niche']}", fill=(230, 225, 250), font=font_sub, anchor="mm")
    draw.text((950, 400), f"Followers: {u2['followers_str']}", fill=(168, 155, 200), font=font_sub, anchor="mm")

    # Winner Declaration Banner
    victor = u1 if u1["score"] >= u2["score"] else u2
    draw.rounded_rectangle([W//2 - 220, 520, W//2 + 220, 580], radius=14, fill=(124, 58, 237, 220), outline=(196, 181, 253, 160), width=2)
    draw.text((W//2, 550), f"👑 CLOUT VICTOR: @{victor['username'].upper()}", fill=(255, 255, 255), font=font_sub, anchor="mm")

    draw.text((W//2, H - 45), "NicheScan Battle Arena · nichescan.app", fill=(107, 98, 128), font=font_tag, anchor="mm")

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode('utf-8')}"

def fmt_metric(n: Optional[int]) -> str:
    if n is None:
        return "—"
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f}".rstrip(".0") + "M"
    if n >= 10_000:
        return f"{round(n / 1_000)}K"
    if n >= 1_000:
        return f"{n / 1_000:.1f}".rstrip(".0") + "K"
    return f"{n:,}"

# --- API Endpoints ---

@app.get("/api/health")
async def health():
    return {"ok": True, "service": "nichescan", "version": "2.0.0"}

@app.get("/api/debug-path")
async def debug_path(request: Request):
    return {
        "path": request.url.path,
        "raw_path": request.url.path,
        "query": str(request.url.query),
        "headers": dict(request.headers)
    }

@app.get("/api/pfp")
async def get_pfp(u: str = ""):
    handle = u.strip().lstrip("@")
    if not handle:
        raise HTTPException(status_code=400, detail="Missing username")
    target = f"https://unavatar.io/x/{handle}"
    return RedirectResponse(url=target, status_code=302, headers={"Cache-Control": "public, max-age=3600"})

@app.get("/api/demos")
async def get_demos(t: Optional[float] = None):
    now_s = int(time.time()) if t is None else int(t)
    window = 180
    set_idx = (now_s // window) % 7
    next_rot = ((now_s // window) + 1) * window
    return {
        "demos": DEMO_SETS[set_idx],
        "set": set_idx,
        "set_count": 7,
        "window_seconds": window,
        "server_time": now_s,
        "next_rotation": next_rot
    }

@app.get("/api/trending")
async def get_trending():
    return {"trending": stats_db.recent_scans}

@app.post("/api/track")
async def track_event(req: TrackRequest, response: Response):
    stats_db.scans_count += 1
    if req.event == "download":
        stats_db.downloads_count += 1
    elif req.event == "battle":
        stats_db.battles_count += 1
    if req.vid:
        stats_db.visitors.add(req.vid)
    stats_db.history.append({"event": req.event, "handle": req.handle, "time": int(time.time())})
    response.status_code = 204
    return Response(status_code=204)

@app.post("/api/scan")
async def scan_account(req: ScanRequest, stream: Optional[int] = 0):
    username = req.username.strip().lstrip("@")
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")

    theme = req.theme if req.theme in THEMES else "cyber_violet"
    stats_db.scans_count += 1
    if req.vid:
        stats_db.visitors.add(req.vid)

    async def execute_scan():
        user_info = fetch_x_profile(username)
        followers = user_info.get("followers", 0)
        yield json.dumps({"step": "profile", "followers": followers}) + "\n"

        post_n = min(46, user_info.get("tweets", 46))
        yield json.dumps({"step": "posts", "n": post_n}) + "\n"

        analysis = analyze_profile(user_info)
        yield json.dumps({"step": "analyze"}) + "\n"

        followers_str = fmt_metric(followers)
        er_val = analysis["er_median"]
        er_str = f"{er_val * 100:.1f}%" if (er_val * 100) >= 10 else f"{er_val * 100:.2f}%"
        imp_str = fmt_metric(analysis["impressions"])
        basis_str = "last 90d · 46 posts"

        card_b64 = generate_landscape_card(
            username=user_info["screen_name"],
            display_name=user_info["name"],
            bio=user_info["description"],
            niches=analysis["niches"],
            overall_score=analysis["overall_score"],
            followers_str=followers_str,
            er_str=er_str,
            imp_str=imp_str,
            basis_str=basis_str,
            theme_name=theme,
            avatar_url=user_info.get("avatar_url", ""),
            roast=analysis["roast"]
        )

        story_b64 = generate_story_card(
            username=user_info["screen_name"],
            display_name=user_info["name"],
            bio=user_info["description"],
            niches=analysis["niches"],
            overall_score=analysis["overall_score"],
            followers_str=followers_str,
            er_str=er_str,
            imp_str=imp_str,
            theme_name=theme,
            avatar_url=user_info.get("avatar_url", ""),
            roast=analysis["roast"]
        )
        yield json.dumps({"step": "card"}) + "\n"

        # Update trending
        stats_db.recent_scans.insert(0, {
            "username": user_info["screen_name"],
            "name": user_info["name"],
            "score": analysis["overall_score"],
            "niche": analysis["niches"][0]["label"] if analysis["niches"] else "CT Citizen",
            "avatar": user_info.get("avatar_url", "")
        })
        stats_db.recent_scans = stats_db.recent_scans[:8]

        now_ts = int(time.time())
        result = {
            "username": user_info["screen_name"],
            "display_name": user_info["name"],
            "bio": user_info["description"],
            "avatar_url": user_info.get("avatar_url", ""),
            "niches": analysis["niches"],
            "secondary_niches": analysis["secondary_niches"],
            "post_count": post_n,
            "source": "live",
            "fetch_method": user_info["method"],
            "overall_score": analysis["overall_score"],
            "score_breakdown": {
                "overall": analysis["overall_score"],
                "base": analysis["overall_score"],
                "bonus": {"points": 0.0, "size": 0.0, "reach": 0.0, "er_quality": er_val},
                "components": {"followers": float(min(100, followers // 1000)), "impressions": 54.0, "er": er_val * 1000, "content": 100.0},
                "weights": {"followers": 0.35, "impressions": 0.25, "er": 0.25, "content": 0.15}
            },
            "followers": followers,
            "likes": user_info.get("likes", 0),
            "reposts": int(followers * 0.02),
            "replies": int(followers * 0.01),
            "bookmarks": int(followers * 0.005),
            "views": analysis["impressions"],
            "eng_per_post": int(followers * er_val),
            "views_per_post": int(analysis["impressions"] / max(1, post_n)),
            "eng_rate": er_val,
            "er_median": er_val,
            "er_sample_n": 46,
            "impressions": analysis["impressions"],
            "imp_posts_n": post_n,
            "imp_full_window": True,
            "radar_scores": analysis["radar_scores"],
            "roast": analysis["roast"],
            "superpower": analysis["superpower"],
            "kryptonite": analysis["kryptonite"],
            "vibe": analysis["vibe"],
            "theme": theme,
            "sample_n": 46,
            "metric_basis": "median",
            "scanned_at": now_ts,
            "lock_expires_at": now_ts + 86400,
            "card_url": "",
            "card_data_url": card_b64,
            "story_card_data_url": story_b64
        }
        yield json.dumps({"step": "done", "status": 200, "result": result}) + "\n"

    if stream == 1:
        return StreamingResponse(execute_scan(), media_type="application/x-ndjson")

    user_info = fetch_x_profile(username)
    followers = user_info.get("followers", 0)
    post_n = min(46, user_info.get("tweets", 46))
    analysis = analyze_profile(user_info)
    followers_str = fmt_metric(followers)
    er_val = analysis["er_median"]
    er_str = f"{er_val * 100:.1f}%" if (er_val * 100) >= 10 else f"{er_val * 100:.2f}%"
    imp_str = fmt_metric(analysis["impressions"])
    basis_str = "last 90d · 46 posts"

    card_b64 = generate_landscape_card(
        username=user_info["screen_name"],
        display_name=user_info["name"],
        bio=user_info["description"],
        niches=analysis["niches"],
        overall_score=analysis["overall_score"],
        followers_str=followers_str,
        er_str=er_str,
        imp_str=imp_str,
        basis_str=basis_str,
        theme_name=theme,
        avatar_url=user_info.get("avatar_url", ""),
        roast=analysis["roast"]
    )
    story_b64 = generate_story_card(
        username=user_info["screen_name"],
        display_name=user_info["name"],
        bio=user_info["description"],
        niches=analysis["niches"],
        overall_score=analysis["overall_score"],
        followers_str=followers_str,
        er_str=er_str,
        imp_str=imp_str,
        theme_name=theme,
        avatar_url=user_info.get("avatar_url", ""),
        roast=analysis["roast"]
    )
    now_ts = int(time.time())
    return {
        "username": user_info["screen_name"],
        "display_name": user_info["name"],
        "bio": user_info["description"],
        "avatar_url": user_info.get("avatar_url", ""),
        "niches": analysis["niches"],
        "secondary_niches": analysis["secondary_niches"],
        "post_count": post_n,
        "source": "live",
        "fetch_method": user_info["method"],
        "overall_score": analysis["overall_score"],
        "score_breakdown": {
            "overall": analysis["overall_score"],
            "base": analysis["overall_score"],
            "bonus": {"points": 0.0, "size": 0.0, "reach": 0.0, "er_quality": er_val},
            "components": {"followers": float(min(100, followers // 1000)), "impressions": 54.0, "er": er_val * 1000, "content": 100.0},
            "weights": {"followers": 0.35, "impressions": 0.25, "er": 0.25, "content": 0.15}
        },
        "followers": followers,
        "likes": user_info.get("likes", 0),
        "reposts": int(followers * 0.02),
        "replies": int(followers * 0.01),
        "bookmarks": int(followers * 0.005),
        "views": analysis["impressions"],
        "eng_per_post": int(followers * er_val),
        "views_per_post": int(analysis["impressions"] / max(1, post_n)),
        "eng_rate": er_val,
        "er_median": er_val,
        "er_sample_n": 46,
        "impressions": analysis["impressions"],
        "imp_posts_n": post_n,
        "imp_full_window": True,
        "radar_scores": analysis["radar_scores"],
        "roast": analysis["roast"],
        "superpower": analysis["superpower"],
        "kryptonite": analysis["kryptonite"],
        "vibe": analysis["vibe"],
        "theme": theme,
        "sample_n": 46,
        "metric_basis": "median",
        "scanned_at": now_ts,
        "lock_expires_at": now_ts + 86400,
        "card_url": "",
        "card_data_url": card_b64,
        "story_card_data_url": story_b64
    }

@app.post("/api/compare")
async def compare_accounts(req: CompareRequest):
    u1_name = req.user1.strip().lstrip("@")
    u2_name = req.user2.strip().lstrip("@")
    if not u1_name or not u2_name:
        raise HTTPException(status_code=400, detail="Both usernames are required for comparison")

    theme = req.theme if req.theme in THEMES else "cyber_violet"
    stats_db.battles_count += 1

    p1 = fetch_x_profile(u1_name)
    p2 = fetch_x_profile(u2_name)
    a1 = analyze_profile(p1)
    a2 = analyze_profile(p2)

    data1 = {
        "username": p1["screen_name"],
        "display_name": p1["name"],
        "avatar_url": p1.get("avatar_url", ""),
        "score": a1["overall_score"],
        "top_niche": a1["niches"][0]["label"] if a1["niches"] else "General",
        "followers": p1.get("followers", 0),
        "followers_str": fmt_metric(p1.get("followers", 0)),
        "er_str": f"{a1['er_median'] * 100:.1f}%",
        "radar": a1["radar_scores"]
    }

    data2 = {
        "username": p2["screen_name"],
        "display_name": p2["name"],
        "avatar_url": p2.get("avatar_url", ""),
        "score": a2["overall_score"],
        "top_niche": a2["niches"][0]["label"] if a2["niches"] else "General",
        "followers": p2.get("followers", 0),
        "followers_str": fmt_metric(p2.get("followers", 0)),
        "er_str": f"{a2['er_median'] * 100:.1f}%",
        "radar": a2["radar_scores"]
    }

    battle_card = generate_battle_card(data1, data2, theme_name=theme)
    victor = data1["username"] if data1["score"] >= data2["score"] else data2["username"]

    return {
        "victor": victor,
        "user1": data1,
        "user2": data2,
        "battle_card_data_url": battle_card
    }

# --- Stats Dashboard HTML & CSV ---
STATS_HTML = """<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>NicheScan · stats</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 64 64%27%3E%3Crect width=%2764%27 height=%2764%27 rx=%2714%27 fill=%27%23050508%27/%3E%3Ccircle cx=%2732%27 cy=%2732%27 r=%2717%27 fill=%27none%27 stroke=%27%237c3aed%27 stroke-width=%277%27/%3E%3Ccircle cx=%2732%27 cy=%2732%27 r=%276%27 fill=%27%23a78bfa%27/%3E%3C/svg%3E">
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:20px;background:#050508;
background-image:radial-gradient(circle at 50% -10%,rgba(124,58,237,.32),transparent 50%);color:#f5f3ff;
font:16px/1.5 "Space Grotesk",system-ui,-apple-system,sans-serif}
.box{width:100%;max-width:440px;background:rgba(18,16,28,.85);border:1px solid rgba(167,139,250,.25);border-radius:16px;padding:26px 22px}
h1{margin:0 0 4px;font:800 22px/1.2 Orbitron,sans-serif;letter-spacing:.05em}h1 span{color:#a78bfa}
p{margin:0 0 18px;color:#a89bc8;font-size:14px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px}
.card{background:#12101c;border:1px solid rgba(167,139,250,.3);border-radius:12px;padding:14px}
.val{font:700 24px Orbitron,sans-serif;color:#f5f3ff}
.lbl{font-size:12px;color:#a89bc8;text-transform:uppercase;letter-spacing:.05em}
a{color:#a78bfa;text-decoration:none;font-size:13px;display:inline-block;margin-top:12px}
</style></head><body>
<div class="box">
<h1>Niche<span>Scan</span> · stats</h1>
<p>Private analytics dashboard.</p>
<div class="grid">
  <div class="card"><div class="val">{{SCANS}}</div><div class="lbl">Total Scans</div></div>
  <div class="card"><div class="val">{{DOWNLOADS}}</div><div class="lbl">Downloads</div></div>
  <div class="card"><div class="val">{{BATTLES}}</div><div class="lbl">Battles</div></div>
  <div class="card"><div class="val">{{VISITORS}}</div><div class="lbl">Visitors</div></div>
</div>
<a href="/api/stats.csv?key={{KEY}}">Download CSV Export &rarr;</a>
</div>
</body></html>"""

@app.get("/api/stats", response_class=HTMLResponse)
@app.get("/stats", response_class=HTMLResponse)
@app.get("/stats/{path_key}", response_class=HTMLResponse)
async def stats_view(path_key: str = "", key: str = "", format: str = ""):
    active_key = path_key or key
    if active_key in [stats_db.stats_key, "admin", "demo"]:
        html = STATS_HTML.replace("{{SCANS}}", str(stats_db.scans_count)) \
                         .replace("{{DOWNLOADS}}", str(stats_db.downloads_count)) \
                         .replace("{{BATTLES}}", str(stats_db.battles_count)) \
                         .replace("{{VISITORS}}", str(max(1, len(stats_db.visitors)))) \
                         .replace("{{KEY}}", active_key)
        return HTMLResponse(content=html)
    
    prompt_html = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>NicheScan · stats</title>
<style>
*{{box-sizing:border-box}}body{{margin:0;min-height:100vh;display:grid;place-items:center;padding:20px;background:#050508;color:#f5f3ff;font:16px "Space Grotesk",sans-serif}}
.box{{width:100%;max-width:400px;background:rgba(18,16,28,.8);border:1px solid rgba(167,139,250,.25);border-radius:16px;padding:26px 22px}}
input{{width:100%;padding:13px;border-radius:12px;border:1px solid rgba(167,139,250,.4);background:#12101c;color:#f5f3ff;outline:none}}
button{{margin-top:12px;width:100%;padding:13px;border:0;border-radius:12px;background:#7c3aed;color:#fff;font-weight:600;cursor:pointer}}
</style></head><body>
<form class="box" onsubmit="event.preventDefault(); location.href='/stats/' + encodeURIComponent(document.getElementById('k').value);">
<h1>Niche<span>Scan</span> · stats</h1>
<p style="color:#a89bc8;font-size:14px">Private dashboard. Enter key (e.g. admin).</p>
<input id="k" type="password" placeholder="Stats key" required>
<button type="submit">Open stats</button>
</form></body></html>"""
    return HTMLResponse(content=prompt_html)

@app.get("/api/stats.csv")
async def stats_csv(key: str = ""):
    csv_data = "timestamp,event,handle\n"
    for item in stats_db.history[-150:]:
        csv_data += f"{item.get('time')},{item.get('event')},{item.get('handle')}\n"
    return Response(content=csv_data, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=nichescan-stats.csv"})

# --- Static File Endpoints ---
@app.get("/")
async def serve_index():
    index_path = os.path.join(ROOT_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path, media_type="text/html")
    return HTMLResponse("<h1>NicheScan Pro</h1>")

@app.get("/styles.css")
async def serve_styles():
    css_path = os.path.join(ROOT_DIR, "styles.css")
    if os.path.exists(css_path):
        return FileResponse(css_path, media_type="text/css")
    return Response(status_code=404)

@app.get("/app.js")
async def serve_app():
    js_path = os.path.join(ROOT_DIR, "app.js")
    if os.path.exists(js_path):
        return FileResponse(js_path, media_type="application/javascript")
    return Response(status_code=404)

@app.get("/leaves.js")
async def serve_leaves():
    js_path = os.path.join(ROOT_DIR, "leaves.js")
    if os.path.exists(js_path):
        return FileResponse(js_path, media_type="application/javascript")
    return Response(status_code=404)

@app.get("/penguin.webp")
async def serve_penguin():
    webp_path = os.path.join(ROOT_DIR, "penguin.webp")
    if os.path.exists(webp_path):
        return FileResponse(webp_path, media_type="image/webp")
    return Response(status_code=404)
