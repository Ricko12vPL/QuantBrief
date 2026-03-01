<h1 align="center">
  <img src="https://img.shields.io/badge/⚡-QuantBrief-FF7000?style=for-the-badge&labelColor=0a0a0a" alt="QuantBrief" height="40"/>
</h1>

<h3 align="center">AI-Powered Real-Time Market Intelligence Agent</h3>

<p align="center">
  <strong>Your personal CIO — multi-agent pipeline that screens news, analyzes SEC filings with 256K context, reasons about portfolio impact, and delivers scheduled audio briefings in 5 languages.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Mistral_Large_3-256K_Context-FF7000?style=flat-square" alt="Mistral Large 3"/>
  <img src="https://img.shields.io/badge/Magistral-Reasoning-FF7000?style=flat-square" alt="Magistral"/>
  <img src="https://img.shields.io/badge/Ministral_3B-Screening-FF7000?style=flat-square" alt="Ministral 3B"/>
  <img src="https://img.shields.io/badge/ElevenLabs-Voice_AI-000000?style=flat-square" alt="ElevenLabs"/>
  <img src="https://img.shields.io/badge/W%26B-Tracking-FFBE00?style=flat-square&logo=weightsandbiases" alt="W&B"/>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/python-3.12-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python"/>
  <img src="https://img.shields.io/badge/react-19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React"/>
  <img src="https://img.shields.io/badge/fastapi-0.115-009688?style=flat-square&logo=fastapi" alt="FastAPI"/>
  <img src="https://img.shields.io/badge/postgresql-16-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL"/>
  <img src="https://img.shields.io/badge/tests-33_passing-brightgreen?style=flat-square" alt="Tests"/>
  <img src="https://github.com/Ricko12vPL/QuantBrief/actions/workflows/ci.yml/badge.svg" alt="CI"/>
</p>

<p align="center">
  Built for <strong>Mistral AI Worldwide Hackathon 2026</strong> &middot; Track: <strong>Anything Goes</strong> &middot; <strong>Kacper Saks</strong>
</p>

<p align="center">
  <img src="screenshot.png" alt="QuantBrief — AI-Powered Market Intelligence" width="100%"/>
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

## Key Features

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
- **Persistent**: Schedules survive server restarts (PostgreSQL-backed)

### Earnings Call Analysis (Voxtral)

Upload earnings call audio files — Voxtral transcribes, Mistral Large 3 extracts financial highlights, forward guidance, risk factors, and Q&A insights.

### Real-Time Market Data

- **Live quotes** via yfinance — prices, change %, intraday data
- **Technical analysis** — RSI, MACD, Bollinger Bands, moving averages with AI interpretation
- **Interactive price charts** — candlestick and line views with 1D/1W/1M/3M intervals
- **News sentiment** — per-ticker news with AI-scored sentiment and relevance
- **Financial ratios** — P/E, P/B, ROE, D/E, profit margins with radar chart comparison

### Multilingual (5 Languages)

Full UI and audio briefings in **English, French, German, Polish, Spanish**. Leverages Mistral's native multilingual capabilities to translate English-only SEC content.

### Production-Ready Infrastructure

- **JWT Authentication** — access/refresh tokens, bcrypt password hashing, secure login/register flow
- **PostgreSQL** — persistent storage for users, briefs, portfolios, watchlists, schedules
- **Rate Limiting** — per-endpoint limits (SlowAPI) to prevent abuse
- **Security Headers** — CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy
- **33 Automated Tests** — auth, portfolio, watchlist, schedule isolation (IDOR prevention)
- **CI/CD** — GitHub Actions for backend (pytest) + frontend (lint, TypeScript, build)

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

### System Design

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React 19)                   │
│  React Router · Zustand · Tailwind · Recharts · i18n    │
│  Auth Pages · Dashboard · Analysis Panels · Audio Player│
└──────────────────────┬──────────────────────────────────┘
                       │ REST API + WebSocket
┌──────────────────────▼──────────────────────────────────┐
│                  FastAPI Backend                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │ JWT Auth │ │ Rate     │ │ Security │ │ CORS      │  │
│  │ Middleware│ │ Limiter  │ │ Headers  │ │ Origins   │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
│  ┌──────────────────────────────────────────────────┐   │
│  │          25+ API Endpoints (REST + WS)           │   │
│  │  Auth · Brief · Schedule · Portfolio · Watchlist  │   │
│  │  Market · Filing · Audio · WebSocket Progress     │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │     5-Agent Pipeline (Orchestrator + Lock)        │   │
│  │  Screener → Analyst → Reasoner → Synth → Voice   │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │     APScheduler (Cron/Interval Triggers)          │   │
│  └──────────────────────────────────────────────────┘   │
└──────┬──────────────┬──────────────┬────────────────────┘
       │              │              │
  ┌────▼────┐   ┌─────▼─────┐  ┌────▼────┐
  │ Postgres│   │   Redis    │  │  W&B    │
  │ 6 tables│   │   Cache    │  │ Logging │
  └─────────┘   └───────────┘  └─────────┘
```

---

## Tech Stack

### Backend

| Component | Technology |
|---|---|
| Language | Python 3.12 |
| Framework | FastAPI 0.115 + Uvicorn (async) |
| Database | PostgreSQL 16 + SQLAlchemy 2.0 (async ORM) |
| Migrations | Alembic |
| Auth | JWT (PyJWT) + bcrypt |
| AI Models | mistralai SDK (Ministral 3B, Mistral Large 3, Magistral Medium) |
| Voice | ElevenLabs SDK (multilingual TTS) |
| Scheduler | APScheduler (AsyncIOScheduler, in-process) |
| Market Data | yfinance (quotes, candles, financials, news) |
| Cache | Redis 7 (with in-memory fallback) |
| Rate Limiting | SlowAPI (60 req/min global + per-endpoint) |
| Security | CSP, X-Frame-Options, Referrer-Policy, input validation |
| Tracking | Weights & Biases |
| Testing | pytest 8.3 + pytest-asyncio (33 tests) |

### Frontend

| Component | Technology |
|---|---|
| Framework | React 19 + TypeScript 5.9 |
| Build | Vite 7.3 (lazy-loaded route code splitting) |
| Routing | React Router 7.5 |
| Styling | Tailwind CSS 4.2 (glassmorphism dark theme) |
| State | Zustand 5.0 (5 stores) |
| Charts | Recharts 3.7 + Lightweight Charts 4.2 |
| i18n | react-i18next (EN/FR/DE/PL/ES — 150+ keys) |
| Real-time | WebSocket (pipeline progress) |
| Icons | Lucide React |

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

- Python 3.12+, Node.js 20+, PostgreSQL 16+, Redis
- API keys: [Mistral AI](https://console.mistral.ai/), [ElevenLabs](https://elevenlabs.io/) (free tiers available)

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

### 2. Configure

```bash
cp .env.example backend/.env
# Edit backend/.env — set at minimum:
#   MISTRAL_API_KEY=your_key
#   ELEVENLABS_API_KEY=your_key
#   JWT_SECRET_KEY=$(openssl rand -hex 32)
#   DATABASE_URL=postgresql+asyncpg://quantbrief:quantbrief@localhost:5432/quantbrief
```

### 3. Database Setup

```bash
# Create PostgreSQL role and database
psql -U postgres -c "CREATE ROLE quantbrief WITH LOGIN PASSWORD 'quantbrief';"
psql -U postgres -c "CREATE DATABASE quantbrief OWNER quantbrief;"

# Run migrations
cd backend
alembic upgrade head
```

### 4. Run

```bash
# Terminal 1: Backend
cd backend
uvicorn app.main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend
npm run dev
```

### 5. Open

Navigate to **http://localhost:5173** — register an account and start generating briefs.

### Docker Compose (Alternative)

```bash
cp .env.example .env
# Edit .env with your API keys
docker compose up
# Frontend: http://localhost:5173
# Backend API: http://localhost:8000
```

---

## Project Structure

```
QuantBrief/
├── backend/
│   ├── app/
│   │   ├── main.py                     # FastAPI entry + lifespan + middleware stack
│   │   ├── config.py                   # Pydantic settings (env-driven)
│   │   │
│   │   ├── agents/                     # 5-agent AI pipeline
│   │   │   ├── orchestrator.py         # Pipeline coordinator with progress callbacks
│   │   │   ├── news_screener.py        # Ministral 3B — parallel news filtering
│   │   │   ├── filing_analyst.py       # Mistral Large 3 — 256K SEC analysis
│   │   │   ├── reasoning_engine.py     # Magistral — chain-of-thought reasoning
│   │   │   ├── synthesizer.py          # Mistral Large 3 — brief generation
│   │   │   ├── voice_agent.py          # ElevenLabs TTS
│   │   │   └── earnings_transcriber.py # Voxtral earnings call analysis
│   │   │
│   │   ├── api/                        # 25+ REST + WebSocket endpoints
│   │   │   ├── routes_auth.py          # Register, login, refresh, me
│   │   │   ├── routes_brief.py         # Generate, latest, history
│   │   │   ├── routes_schedule.py      # CRUD + pause/resume
│   │   │   ├── routes_portfolio.py     # Portfolio management
│   │   │   ├── routes_watchlist.py     # Watchlist + ticker search
│   │   │   ├── routes_market.py        # Quotes, technicals, ratios, news
│   │   │   ├── routes_filing.py        # SEC filing analysis + earnings calls
│   │   │   ├── routes_audio.py         # Audio generation
│   │   │   └── ws_realtime.py          # WebSocket pipeline progress
│   │   │
│   │   ├── auth/                       # Authentication layer
│   │   │   ├── jwt.py                  # PyJWT access/refresh token management
│   │   │   ├── password.py             # bcrypt hashing
│   │   │   ├── dependencies.py         # FastAPI Depends (get_current_user)
│   │   │   ├── schemas.py              # Register/Login/Token Pydantic models
│   │   │   └── usage.py                # Usage tracking (future metering)
│   │   │
│   │   ├── db/                         # Database layer
│   │   │   ├── engine.py               # Async engine + session factory
│   │   │   └── models.py              # 6 SQLAlchemy ORM tables
│   │   │
│   │   ├── services/
│   │   │   └── scheduler.py            # APScheduler (CRUD, execution, DB persistence)
│   │   │
│   │   ├── models/                     # Pydantic data schemas
│   │   ├── data_sources/               # SEC EDGAR, yfinance, Finnhub, FRED, RSS
│   │   ├── analytics/                  # Technical signals, ratios, sentiment
│   │   ├── middleware/                 # Security headers middleware
│   │   └── utils/                      # Cache, rate limiter, validation, W&B logger
│   │
│   ├── prompts/                        # Versioned Mistral prompts (7 .md files)
│   ├── alembic/                        # Database migrations
│   ├── tests/                          # 33 pytest tests (4 test files)
│   └── requirements.txt                # 24 Python dependencies
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx                     # React Router (lazy-loaded routes)
│   │   ├── components/
│   │   │   ├── Auth/                   # LoginPage, RegisterPage, ProtectedRoute
│   │   │   ├── Landing/               # Hero page
│   │   │   ├── Dashboard/             # 7 components (BriefCard, PriceChart, etc.)
│   │   │   ├── Analysis/             # 7 components (Sentiment, Technicals, Filing, etc.)
│   │   │   ├── Audio/                # AudioPlayer, TranscriptView
│   │   │   └── Common/              # WatchlistManager, ScheduleManager, etc.
│   │   ├── stores/                   # 5 Zustand stores (auth, brief, portfolio, etc.)
│   │   ├── lib/                      # Fully typed API client + WebSocket
│   │   └── i18n/                     # 5 locale JSON files
│   └── package.json
│
├── .github/workflows/ci.yml           # CI: pytest + lint + tsc + build
├── docker-compose.yml                  # PostgreSQL + Redis + Backend + Frontend
└── .env.example
```

### Database Schema (6 Tables)

```sql
users                  -- id, email, hashed_password, display_name, tier, created_at
briefs                 -- id, user_id, data (JSON), sentiment, audio_url, generated_at
portfolio_positions    -- id, user_id, ticker, shares, avg_price (unique per user+ticker)
watchlist_items        -- id, user_id, ticker, company_name (unique per user+ticker)
schedules              -- id, user_id, frequency, hour, tickers, paused, next_run_at
usage_logs             -- id, user_id, action, metadata, created_at (future metering)
```

---

## API Reference

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | No | Create account, returns JWT tokens |
| POST | `/api/auth/login` | No | Login, returns JWT tokens |
| POST | `/api/auth/refresh` | No | Refresh access token |
| GET | `/api/auth/me` | Yes | Current user info |

### Brief Generation

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/brief/generate` | Yes | Run the full 5-agent pipeline |
| GET | `/api/brief/latest` | Yes | Most recent brief |
| GET | `/api/brief/history` | Yes | Paginated brief history |

### Scheduling

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/schedule` | Yes | List user's schedules |
| POST | `/api/schedule` | Yes | Create schedule (max 10 per user) |
| PATCH | `/api/schedule/{id}` | Yes | Update schedule |
| DELETE | `/api/schedule/{id}` | Yes | Delete schedule |
| POST | `/api/schedule/{id}/pause` | Yes | Pause schedule |
| POST | `/api/schedule/{id}/resume` | Yes | Resume schedule |

### Market Data

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/market/quotes?tickers=AAPL,NVDA` | No | Live quotes |
| GET | `/api/market/{ticker}/candles` | No | OHLCV candles |
| GET | `/api/market/{ticker}/technical` | No | Technical indicators |
| GET | `/api/market/{ticker}/ratios` | No | Financial ratios |
| GET | `/api/market/{ticker}/news` | No | News with AI sentiment |
| POST | `/api/market/{ticker}/analyze-technical` | Yes | AI technical analysis |

### Portfolio & Watchlist

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET/POST/DELETE | `/api/portfolio` | Yes | Portfolio CRUD |
| GET/POST/DELETE | `/api/watchlist` | Yes | Watchlist CRUD |
| GET | `/api/watchlist/search?q=...` | No | Ticker search |

### Filing & Audio

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/filing/{ticker}` | No | List recent filings |
| GET | `/api/filing/{ticker}/analyze` | Yes | AI filing analysis |
| POST | `/api/filing/earnings-call` | Yes | Upload & analyze earnings call |
| POST | `/api/audio/generate` | Yes | Generate audio briefing |

---

## Why This Wins

### Full Mistral Ecosystem (4 Models)

Not a single-API-call project. Each model chosen for specific strengths:

- **Ministral 3B** for speed — screening at ~50ms/article
- **Mistral Large 3** for depth — entire 10-K in 256K context, no chunking
- **Magistral** for reasoning — transparent chain-of-thought with confidence scores
- **Mistral Large 3** for synthesis — cross-source correlation into actionable briefs

### 256K Context = No RAG Needed

Most tools truncate or chunk SEC filings. QuantBrief loads the **entire 80-120 page filing** into a single Mistral Large 3 call. Full context = better analysis.

### Real Data, Real Impact

No synthetic demos. Live market data from yfinance, real SEC filings from EDGAR, actual news sentiment. The briefs analyze your actual portfolio in real time.

### Scheduled Automation

Not just on-demand — fully automated brief generation on a schedule. Set it and forget it. Your morning brief is ready before you wake up.

### Production-Grade Engineering

Not a prototype — production infrastructure with JWT auth, PostgreSQL persistence, rate limiting, security headers, 33 automated tests, and CI/CD. Ready to deploy.

---

## Codebase Metrics

| Metric | Value |
|---|---|
| Total lines of code | ~15,000 |
| Backend Python files | 67 |
| Frontend TypeScript files | 35 |
| React components | 20+ |
| API endpoints | 25+ |
| Database tables | 6 |
| Automated tests | 33 |
| Languages supported | 5 (EN/FR/DE/PL/ES) |
| AI models used | 4 Mistral + 1 ElevenLabs |
| Versioned prompts | 7 |

---

## Sponsor Prize Alignment

| Prize | Qualification |
|---|---|
| **Jump Trading** (Quant Finance) | Core domain — financial analysis with real market data, technical indicators, SEC filings |
| **ElevenLabs** ($2K credits) | Audio briefing as first-class feature — multilingual TTS integrated into the pipeline |
| **Best Agent Skills** | 5-agent pipeline: parallel screening + sequential deep analysis + reasoning + synthesis + voice |
| **W&B** | Full experiment tracking of agent decisions, token usage, and pipeline latency metrics |

---

## Hackathon Submission

| Field | Value |
|---|---|
| **Hackathon** | Mistral AI Worldwide Hackathon 2026 |
| **Track** | Anything Goes |
| **Team** | Kacper Saks |
| **Location** | Online (Warsaw, Poland) |
| **Mistral Models** | Mistral Large 3 (256K), Magistral Medium, Ministral 3B |
| **Sponsor Tech** | ElevenLabs (Voice AI), W&B (Experiment Tracking) |
| **Data Sources** | SEC EDGAR, yfinance, Finnhub, FRED, RSS |
| **Repo** | [github.com/Ricko12vPL/QuantBrief](https://github.com/Ricko12vPL/QuantBrief) |

---

## License

MIT License

---

<p align="center">
  <strong>Democratizing financial intelligence, one morning brief at a time.</strong>
</p>
