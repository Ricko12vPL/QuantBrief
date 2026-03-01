import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from app.auth.jwt import decode_token

logger = logging.getLogger(__name__)
router = APIRouter()

# NOTE: Module-level state — works with single-worker uvicorn.
# Multi-worker deployment (gunicorn --workers N) requires Redis Pub/Sub for cross-worker broadcast.
_clients: set[WebSocket] = set()


async def broadcast_progress(stage: str, pct: int):
    message = json.dumps({"type": "pipeline_progress", "stage": stage, "pct": pct})
    disconnected = []
    for ws in _clients:
        try:
            await ws.send_text(message)
        except Exception:
            disconnected.append(ws)
    for ws in disconnected:
        _clients.discard(ws)


@router.websocket("/pipeline")
async def pipeline_ws(websocket: WebSocket, token: str = Query(default="")):
    if token:
        payload = decode_token(token)
        if payload is None:
            await websocket.close(code=4001, reason="Invalid token")
            return

    await websocket.accept()
    _clients.add(websocket)
    logger.info("WebSocket client connected (%d total)", len(_clients))
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        _clients.discard(websocket)
        logger.info("WebSocket client disconnected (%d remaining)", len(_clients))
