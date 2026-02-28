from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.utils.wandb_logger import init_wandb, finish as wandb_finish
from app.api.routes_brief import router as brief_router
from app.api.routes_watchlist import router as watchlist_router
from app.api.routes_filing import router as filing_router
from app.api.routes_audio import router as audio_router
from app.api.ws_realtime import router as ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    audio_path = Path(settings.audio_dir)
    audio_path.mkdir(parents=True, exist_ok=True)
    init_wandb(project=settings.wandb_project, api_key=settings.wandb_api_key)
    yield
    wandb_finish()


app = FastAPI(
    title="QuantBrief API",
    description="AI-powered real-time market intelligence",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static", check_dir=False), name="static")

app.include_router(brief_router, prefix="/api/brief", tags=["Brief"])
app.include_router(watchlist_router, prefix="/api/watchlist", tags=["Watchlist"])
app.include_router(filing_router, prefix="/api/filing", tags=["Filing"])
app.include_router(audio_router, prefix="/api/audio", tags=["Audio"])
app.include_router(ws_router, prefix="/api/ws", tags=["WebSocket"])


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "quantbrief"}
