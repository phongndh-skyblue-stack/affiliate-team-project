"""Socket.IO server (async mode, ASGI).

Mount point: /socket.io  (handled by `sio_app`, not the FastAPI router)

Rooms strategy
--------------
Each authenticated user joins a private room named after their user_id.
`emit_to_user(user_id, event, data)` emits to that room.
"""
from __future__ import annotations

import logging
from typing import Any

import socketio

from app.core.security import decode_token
from app.shared.constants import ACCESS_TOKEN_TYPE

logger = logging.getLogger(__name__)

# CORS origins are set permissively here; production should restrict to the FE domain.
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    logger=False,
    engineio_logger=False,
)

sio_app = socketio.ASGIApp(sio, socketio_path="socket.io")


# ---------------------------------------------------------------------------
# Connection lifecycle
# ---------------------------------------------------------------------------

@sio.event
async def connect(sid: str, environ: dict, auth: dict | None) -> bool:
    """Validate JWT token provided in `auth` dict or query string."""
    token: str | None = None

    # auth dict: client passes { token: "..." }
    if auth and isinstance(auth, dict):
        token = auth.get("token")

    # Fallback: query string ?token=
    if not token:
        qs: str = environ.get("QUERY_STRING", "")
        for part in qs.split("&"):
            if part.startswith("token="):
                token = part[6:]
                break

    if not token:
        logger.warning("Socket.IO: connection rejected — no token (sid=%s)", sid)
        return False  # reject

    try:
        payload = decode_token(token, expected_type=ACCESS_TOKEN_TYPE)
    except Exception:
        logger.warning("Socket.IO: connection rejected — invalid token (sid=%s)", sid)
        return False

    user_id = payload.sub
    await sio.save_session(sid, {"user_id": user_id})
    await sio.enter_room(sid, room=user_id)
    logger.debug("Socket.IO: connected sid=%s user=%s", sid, user_id)
    return True


@sio.event
async def disconnect(sid: str) -> None:
    session = await sio.get_session(sid)
    logger.debug("Socket.IO: disconnected sid=%s user=%s", sid, session.get("user_id"))


# ---------------------------------------------------------------------------
# Helpers used by the rest of the app
# ---------------------------------------------------------------------------

async def emit_to_user(user_id: str, event: str, data: dict[str, Any]) -> None:
    """Emit a Socket.IO event to all sessions of a user (via room)."""
    await sio.emit(event, data, room=user_id)
    logger.debug("Socket.IO: emitted %s to user=%s", event, user_id)
