import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.config import get_settings
from app.db.engine import get_engine, dispose_engine
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.utils.http_rate_limiter import limiter
from app.utils.wandb_logger import init_wandb, finish as wandb_finish
from app.api.routes_auth import router as auth_router
from app.api.routes_brief import router as brief_router
from app.api.routes_watchlist import router as watchlist_router
from app.api.routes_filing import router as filing_router
from app.api.routes_audio import router as audio_router
from app.api.ws_realtime import router as ws_router
from app.api.routes_market import router as market_router
from app.api.routes_portfolio import router as portfolio_router
from app.api.routes_schedule import router as schedule_router
from app.services.scheduler import get_scheduler_service

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()

    if settings.jwt_secret_key == "change-me-in-production":
        if settings.debug:
            logger.warning("Using default JWT_SECRET_KEY — not safe for production")
        else:
            raise RuntimeError(
                "JWT_SECRET_KEY must be changed from default value. "
                "Set JWT_SECRET_KEY env var or set DEBUG=true for development."
            )

    audio_path = Path(settings.audio_dir)
    audio_path.mkdir(parents=True, exist_ok=True)
    get_engine()
    init_wandb(project=settings.wandb_project, api_key=settings.wandb_api_key)
    scheduler_svc = get_scheduler_service()
    await scheduler_svc.load_schedules_from_db()
    scheduler_svc.start()
    yield
    scheduler_svc.shutdown()
    wandb_finish()
    await dispose_engine()


app = FastAPI(
    title="QuantBrief API",
    description="AI-powered real-time market intelligence",
    version="0.1.0",
    lifespan=lifespan,
)

app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Rate limit exceeded. Please try again later."},
    )


def _get_cors_origins() -> list[str]:
    settings = get_settings()
    return [o.strip() for o in settings.cors_origins.split(",") if o.strip()]


app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_cors_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.mount("/static", StaticFiles(directory="static", check_dir=False), name="static")

app.include_router(auth_router, prefix="/api/auth", tags=["Auth"])
app.include_router(brief_router, prefix="/api/brief", tags=["Brief"])
app.include_router(watchlist_router, prefix="/api/watchlist", tags=["Watchlist"])
app.include_router(filing_router, prefix="/api/filing", tags=["Filing"])
app.include_router(audio_router, prefix="/api/audio", tags=["Audio"])
app.include_router(ws_router, prefix="/api/ws", tags=["WebSocket"])
app.include_router(market_router, prefix="/api/market", tags=["Market"])
app.include_router(portfolio_router, prefix="/api/portfolio", tags=["Portfolio"])
app.include_router(schedule_router, prefix="/api/schedule", tags=["Schedule"])


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "quantbrief"}
