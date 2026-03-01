<h1 align="center">QuantBrief — AI-Powered Real-Time Market Intelligence</h1>

<p align="center">
  <strong>Your personal CIO: multi-agent pipeline that screens news, analyzes SEC filings with 256K context, reasons about portfolio impact, and delivers scheduled audio briefings in 5 languages.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Mistral_Large_3-256K_Context-FF7000?style=for-the-badge" alt="Mistral Large 3"/>
  <img src="https://img.shields.io/badge/Magistral-Reasoning-FF7000?style=for-the-badge" alt="Magistral"/>
  <img src="https://img.shields.io/badge/Ministral_3B-Screening-FF7000?style=for-the-badge" alt="Ministral 3B"/>
  <img src="https://img.shields.io/badge/ElevenLabs-Voice_AI-000000?style=for-the-badge" alt="ElevenLabs"/>
  <img src="https://img.shields.io/badge/W%26B-Tracking-FFBE00?style=for-the-badge&logo=weightsandbiases" alt="W&B"/>
</p>

<p align="center">
  Built for the <strong>Mistral AI Worldwide Hackathon 2026</strong> | Track: <strong>Anything Goes</strong> | Team: <strong>Kacper Saks</strong> (solo)
</p>

---

## The Problem

150+ million retail investors face a massive information asymmetry. A Bloomberg Terminal costs $25,200/year. Without it:

- **300+ financial articles/hour** — impossible to read manually
- **SEC filings in legal jargon** — 80-120 page 10-Ks are unreadable for most
- **No cross-source synthesis** — data exists everywhere but nobody connects the dots
- **Language barriers** — European investors face English-only sources

## The Solution

**QuantBrief** is a multi-agent AI system that acts as your personal Chief Investment Officer. It monitors markets, SEC filings, and news — then delivers actionable, synthesized intelligence briefs on a schedule you define.

```
You schedule a daily brief at 09:00 UTC. QuantBrief automatically:

  1. Screens overnight news using Ministral 3B (~50ms/article)
  2. Detects material events affecting your portfolio & watchlist
  3. Analyzes full SEC filings in Mistral Large 3's 256K context window
  4. Reasons about portfolio impact using Magistral chain-of-thought
  5. Generates an audio briefing via ElevenLabs in your language
  6. Pushes the brief to your dashboard — ready when you wake up
```

---

## Features

### Multi-Agent AI Pipeline (4 Mistral Models + ElevenLabs)

| Agent | Model | Role |
|---|---|---|
| **News Screener** | Ministral 3B | High-throughput filtering of news articles (<50ms each) |
| **Filing Analyst** | Mistral Large 3 (256K) | Full SEC 10-K/10-Q analysis in a single pass — no chunking, no RAG |
| **Reasoning Engine** | Magistral Medium | Chain-of-thought portfolio impact assessment with confidence scores |
| **Synthesizer** | Mistral Large 3 | Cross-source correlation into executive brief + action items |
| **Voice Agent** | ElevenLabs | Professional multilingual audio briefings (EN/FR/DE/PL/ES) |

### Scheduled Brief Generation

Automatic recurring analysis — no manual clicking required:

- **Ticker sources**: Custom tickers, Portfolio holdings, Watchlist, or All combined
- **Frequencies**: Every 4 hours, Daily, Weekly
- **Configurable time**: Set exact UTC hour/minute for daily and weekly runs
- **Concurrency-safe**: Shared asyncio lock prevents overlapping pipeline runs
- **Auto-refresh**: Dashboard updates automatically when a scheduled brief completes

### Earnings Call Analysis (Voxtral)

Upload earnings call audio files — Voxtral transcribes, Mistral Large 3 extracts financial highlights, forward guidance, risk factors, and Q&A insights.

### Real-Time Market Data

- **Live quotes** via yfinance — prices, change %, intraday data
- **Technical analysis** — RSI, MACD, Bollinger Bands, moving averages
- **Interactive price charts** — candlestick and line views with 1D/1W/1M/3M intervals
- **News sentiment** — per-ticker news with AI-scored sentiment and relevance
- **Financial ratios** — P/E, P/B, ROE, D/E, profit margins with radar chart comparison

### Multilingual (5 Languages)

Full UI and audio briefings in **English, French, German, Polish, Spanish**. Leverages Mistral's native multilingual capabilities to translate English-only SEC content.

### Portfolio & Watchlist Management

Track your holdings with shares and average price. Manage a watchlist with live quotes and auto-search. Both feed into scheduled brief generation for personalized analysis.

---

## Architecture

```
DATA SOURCES                    AGENT PIPELINE                        OUTPUT

SEC EDGAR ──┐                  ┌─────────────────────┐               ┌──────────┐
yfinance ───┤  Ingestion  ──▶ │ Stage 1: SCREENING   │               │ React    │
RSS News ───┤  Layer          │ Ministral 3B (parallel)│──▶          │ Dashboard│
FRED ───────┘                  └─────────┬───────────┘    │          └──────────┘
                                         ▼                │          ┌──────────┐
                               ┌─────────────────────┐    │          │ Audio    │
                               │ Stage 2: ANALYSIS    │    ├────────▶│ Briefing │
                               │ Mistral Large 3 256K │    │          └──────────┘
                               └─────────┬───────────┘    │          ┌──────────┐
                                         ▼                │          │ JSON API │
                               ┌─────────────────────┐    │          │ REST+WS  │
                               │ Stage 3: REASONING   │────┘          └──────────┘
                               │ Magistral (CoT)      │
                               └─────────┬───────────┘
                                         ▼
                               ┌─────────────────────┐
                               │ Stage 4: SYNTHESIS   │
                               │ Mistral Large 3      │
                               └─────────┬───────────┘
                                         ▼
                               ┌─────────────────────┐
                               │ Stage 5: VOICE       │
                               │ ElevenLabs TTS       │
                               └─────────────────────┘
```

### Scheduling Architecture

APScheduler (asyncio-native) runs in-process with FastAPI — zero extra infrastructure:

- `CronTrigger` for daily/weekly schedules at specific UTC times
- `IntervalTrigger` for every-4-hour recurring runs
- Shared `asyncio.Lock` between manual and scheduled generation
- If pipeline is busy when schedule fires, the run is silently skipped

---

## Tech Stack

### Backend

| Component | Technology |
|---|---|
| Language | Python 3.12 |
| Framework | FastAPI + Uvicorn (async) |
| AI Models | mistralai SDK (Ministral 3B, Mistral Large 3, Magistral Medium) |
| Voice | ElevenLabs SDK (multilingual TTS) |
| Scheduler | APScheduler (AsyncIOScheduler) |
| Market Data | yfinance (real-time quotes, candles, financials) |
| Cache | Redis (with in-memory fallback) |
| Tracking | Weights & Biases |

### Frontend

| Component | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS (glassmorphism design) |
| State | Zustand |
| Charts | Recharts |
| i18n | react-i18next (EN/FR/DE/PL/ES) |
| Real-time | WebSocket (pipeline progress) |

### Data Sources

| Source | Data | Cost |
|---|---|---|
| SEC EDGAR | 10-K, 10-Q, 8-K filings | Free |
| yfinance | Quotes, candles, financials, news | Free |
| Finnhub | Ticker search, company profiles | Free tier |
| FRED | GDP, CPI, rates, macro indicators | Free |
| RSS | Reuters, MarketWatch headlines | Free |

---

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 20+
- API keys: Mistral AI, ElevenLabs (free tiers available)

### 1. Clone & Install

```bash
git clone https://github.com/Ricko12vPL/QuantBrief.git
cd QuantBrief

# Backend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your API keys:
#   MISTRAL_API_KEY=...
#   ELEVENLABS_API_KEY=...
```

### 3. Run

```bash
# Terminal 1: Backend
cd backend
uvicorn app.main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend
npm run dev
```

### 4. Open

Navigate to **http://localhost:5173** — click "Get Started" to enter the dashboard.

---

## Project Structure

```
QuantBrief/
├── backend/
│   ├── app/
│   │   ├── main.py                     # FastAPI entry + scheduler lifecycle
│   │   ├── config.py                   # Pydantic settings
│   │   │
│   │   ├── agents/                     # Multi-agent pipeline
│   │   │   ├── orchestrator.py         # Pipeline coordinator
│   │   │   ├── news_screener.py        # Ministral 3B — news filtering
│   │   │   ├── filing_analyst.py       # Mistral Large 3 — 256K SEC analysis
│   │   │   ├── reasoning_engine.py     # Magistral — chain-of-thought
│   │   │   ├── synthesizer.py          # Mistral Large 3 — brief generation
│   │   │   ├── voice_agent.py          # ElevenLabs TTS
│   │   │   └── earnings_transcriber.py # Voxtral earnings call analysis
│   │   │
│   │   ├── api/                        # REST + WebSocket endpoints
│   │   │   ├── routes_brief.py         # Brief generation & history
│   │   │   ├── routes_schedule.py      # Schedule CRUD (create/pause/resume/delete)
│   │   │   ├── routes_portfolio.py     # Portfolio management
│   │   │   ├── routes_watchlist.py     # Watchlist management
│   │   │   ├── routes_market.py        # Market data (quotes, technicals, news)
│   │   │   ├── routes_filing.py        # SEC filing analysis
│   │   │   ├── routes_audio.py         # Audio generation
│   │   │   └── ws_realtime.py          # WebSocket pipeline progress
│   │   │
│   │   ├── services/
│   │   │   └── scheduler.py            # APScheduler service (schedule CRUD + execution)
│   │   │
│   │   ├── models/                     # Pydantic data models
│   │   │   ├── brief.py                # IntelligenceBrief schema
│   │   │   ├── schedule.py             # Schedule, ScheduleFrequency, TickerSource
│   │   │   ├── filing.py, signal.py, watchlist.py, earnings.py
│   │   │
│   │   ├── data_sources/               # External API clients
│   │   │   ├── sec_edgar.py            # SEC EDGAR API
│   │   │   ├── yfinance_client.py      # yfinance market data
│   │   │   ├── finnhub_client.py       # Finnhub search/quotes
│   │   │   ├── fred_client.py          # FRED economic data
│   │   │   └── news_rss.py             # RSS feed aggregator
│   │   │
│   │   ├── analytics/                  # Quantitative analysis
│   │   │   ├── financial_ratios.py     # P/E, P/B, ROE, etc.
│   │   │   ├── sentiment_scorer.py     # NLP sentiment
│   │   │   ├── technical_signals.py    # RSI, MACD, Bollinger
│   │   │   └── earnings_surprise.py    # Actual vs consensus
│   │   │
│   │   └── utils/
│   │       ├── cache.py, rate_limiter.py, wandb_logger.py
│   │
│   ├── prompts/                        # Versioned Mistral prompts (.md)
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx                     # Main app with sidebar layout
│   │   ├── components/
│   │   │   ├── Landing/Hero.tsx        # Landing page
│   │   │   ├── Dashboard/              # BriefCard, EventTimeline, MarketOverview,
│   │   │   │                           # PortfolioImpact, PortfolioManager, PriceChart
│   │   │   ├── Analysis/              # SentimentGauge, RatioComparison, TechnicalAnalysis,
│   │   │   │                          # NewsSentiment, FilingViewer, ReasoningChain,
│   │   │   │                          # EarningsCallUpload
│   │   │   ├── Audio/                 # AudioPlayer, TranscriptView
│   │   │   └── Common/               # WatchlistManager, ScheduleManager,
│   │   │                              # LanguageSelector, AgentStatusBar
│   │   ├── stores/                    # Zustand stores
│   │   │   ├── briefStore.ts, portfolioStore.ts,
│   │   │   ├── watchlistStore.ts, scheduleStore.ts
│   │   ├── i18n/locales/             # EN, FR, DE, PL, ES translations
│   │   └── lib/                      # api.ts, websocket.ts
│   │
│   ├── package.json
│   └── vite.config.ts
│
├── .env.example
└── docker-compose.yml
```

---

## API Reference

### Brief Generation

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/brief/generate` | Generate brief (manual trigger) |
| GET | `/api/brief/latest` | Get most recent brief |
| GET | `/api/brief/history?limit=10` | Brief generation history |

### Scheduling

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/schedule` | List all schedules |
| POST | `/api/schedule` | Create schedule (max 10) |
| PATCH | `/api/schedule/{id}` | Update schedule |
| DELETE | `/api/schedule/{id}` | Delete schedule |
| POST | `/api/schedule/{id}/pause` | Pause schedule |
| POST | `/api/schedule/{id}/resume` | Resume schedule |

### Market Data

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/market/quotes?tickers=AAPL,NVDA` | Live quotes |
| GET | `/api/market/{ticker}/candles` | OHLCV candles |
| GET | `/api/market/{ticker}/technical` | Technical indicators |
| GET | `/api/market/{ticker}/ratios` | Financial ratios |
| GET | `/api/market/{ticker}/news` | News with sentiment |
| POST | `/api/market/{ticker}/analyze-technical` | AI technical analysis |

### Portfolio & Watchlist

| Method | Endpoint | Description |
|---|---|---|
| GET/POST/DELETE | `/api/portfolio` | Portfolio CRUD |
| GET/POST/DELETE | `/api/watchlist` | Watchlist CRUD |
| GET | `/api/watchlist/search?q=...` | Ticker search |

---

## Why This Wins

### Full Mistral Ecosystem (4 Models)

Not a single-API-call project. Each model chosen for specific strengths:
- **Ministral 3B** for speed (screening at 50ms/article)
- **Mistral Large 3** for depth (entire 10-K in 256K context — no chunking)
- **Magistral** for reasoning (transparent chain-of-thought with confidence)
- **Mistral Large 3** for synthesis (cross-source correlation)

### 256K Context = No RAG Needed

Most tools truncate or chunk SEC filings. QuantBrief loads the **entire 80-120 page filing** into a single Mistral Large 3 call. Full context = better analysis.

### Real Data, Real Impact

No synthetic demos. Live market data from yfinance, real SEC filings from EDGAR, actual news sentiment. The briefs analyze your actual portfolio in real time.

### Scheduled Automation

Not just on-demand — fully automated brief generation on a schedule. Set it and forget it. Your morning brief is ready before you wake up.

---

## Sponsor Prize Alignment

| Prize | Qualification |
|---|---|
| **Jump Trading** (Quant Finance) | Core domain — financial analysis with real market data |
| **ElevenLabs** ($2K credits) | Audio briefing as first-class feature, not an afterthought |
| **Best Agent Skills** | 4-agent pipeline with parallel screening + sequential deep analysis |
| **W&B** | Full experiment tracking of agent decisions and pipeline metrics |

---

## Hackathon Submission

| Field | Value |
|---|---|
| **Hackathon** | Mistral AI Worldwide Hackathon 2026 |
| **Track** | Anything Goes |
| **Team** | Kacper Saks (solo) |
| **Location** | Online (Warsaw, Poland) |
| **Mistral Models** | Mistral Large 3, Magistral Medium, Ministral 3B |
| **Sponsor Tech** | ElevenLabs (Voice), W&B (Tracking) |
| **Data Sources** | SEC EDGAR, yfinance, Finnhub, FRED, RSS |
| **Repo** | [github.com/Ricko12vPL/QuantBrief](https://github.com/Ricko12vPL/QuantBrief) |

---

## License

MIT License

---

## Acknowledgments

- **Mistral AI** — for the most capable open-weight models and organizing this hackathon
- **ElevenLabs** — for multilingual voice AI
- **Weights & Biases** — for experiment tracking
- **Jump Trading** — for sponsoring the quant finance track
- **SEC EDGAR** — for free open access to corporate filings

<p align="center">
  <em>Democratizing financial intelligence, one morning brief at a time.</em>
</p>
