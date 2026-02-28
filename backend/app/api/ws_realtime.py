import asyncio
import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)
router = APIRouter()

# Connected WebSocket clients
_clients: list[WebSocket] = []


async def broadcast_progress(stage: str, pct: int):
    """Broadcast pipeline progress to all connected clients."""
    message = json.dumps({"type": "pipeline_progress", "stage": stage, "pct": pct})
    disconnected = []
    for ws in _clients:
        try:
            await ws.send_text(message)
        except Exception:
            disconnected.append(ws)
    for ws in disconnected:
        _clients.remove(ws)


@router.websocket("/pipeline")
async def pipeline_ws(websocket: WebSocket):
    """WebSocket endpoint for real-time pipeline progress."""
    await websocket.accept()
    _clients.append(websocket)
    logger.info("WebSocket client connected (%d total)", len(_clients))
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        if websocket in _clients:
            _clients.remove(websocket)
        logger.info("WebSocket client disconnected (%d remaining)", len(_clients))
