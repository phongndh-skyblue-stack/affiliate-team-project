from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import httpx
from aiogram import Bot, Dispatcher, F, Router
from aiogram.types import Message
from fastapi import HTTPException

SERVER_DIR = Path(__file__).resolve().parents[1]
if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))

from app.api.telegram.service import TelegramService  # noqa: E402
from app.api.telegram.verification import delete_verification_code, get_user_id_from_code  # noqa: E402
from app.api.auth.model import User  # noqa: F401,E402
from app.core.config import settings  # noqa: E402
from app.core.database import SessionLocal  # noqa: E402

router = Router()


def save_chat_link(user_id: str, chat_id: int) -> None:
    with SessionLocal() as db:
        TelegramService(db).save_chat_link(user_id, chat_id)


def unlink_chat(chat_id: int) -> str | None:
    with SessionLocal() as db:
        return TelegramService(db).unlink_by_chat_id(chat_id)


async def notify_backend_telegram_linked(user_id: str, chat_id: int) -> None:
    url = f"http://127.0.0.1:{settings.APP_PORT}{settings.API_PREFIX}/telegram/internal/verified"
    async with httpx.AsyncClient(timeout=5.0) as client:
        response = await client.post(
            url,
            json={"user_id": user_id, "chat_id": chat_id},
            headers={"X-Telegram-Bot-Token": settings.TELEGRAM_BOT_TOKEN},
        )
        response.raise_for_status()


async def notify_backend_telegram_unlinked(user_id: str) -> None:
    url = f"http://127.0.0.1:{settings.APP_PORT}{settings.API_PREFIX}/telegram/internal/unlinked"
    async with httpx.AsyncClient(timeout=5.0) as client:
        response = await client.post(
            url,
            json={"user_id": user_id},
            headers={"X-Telegram-Bot-Token": settings.TELEGRAM_BOT_TOKEN},
        )
        response.raise_for_status()


@router.message(F.text.startswith("/verify "))
async def verify_command(message: Message) -> None:
    if message.chat.type != "private":
        await message.answer("Vui long gui lenh /verify trong private chat voi bot.")
        return

    parts = (message.text or "").split(maxsplit=1)
    if len(parts) != 2:
        await message.answer("Sai cu phap. Vi du: /verify verify_abc123")
        return

    code = parts[1].strip()
    user_id = await get_user_id_from_code(code)
    if not user_id:
        await message.answer("Ma xac thuc khong hop le hoac da het han.")
        return

    try:
        await asyncio.to_thread(save_chat_link, user_id, message.chat.id)
    except HTTPException as exc:
        await message.answer(str(exc.detail))
        return

    await delete_verification_code(code)
    try:
        await notify_backend_telegram_linked(user_id, message.chat.id)
    except Exception:
        pass
    await message.answer("Liên kết với bot thành công! Bạn sẽ nhận được thông báo qua bot.")


@router.message(F.text == "/unlink")
async def unlink_command(message: Message) -> None:
    if message.chat.type != "private":
        await message.answer("Vui long gui lenh /unlink trong private chat voi bot.")
        return

    user_id = await asyncio.to_thread(unlink_chat, message.chat.id)
    if not user_id:
        await message.answer("Telegram cua ban chua duoc lien ket voi tai khoan nao.")
        return

    try:
        await notify_backend_telegram_unlinked(user_id)
    except Exception:
        pass
    await message.answer("Da huy lien ket Telegram. He thong da xoa lien ket khoi database.")


async def main() -> None:
    if not settings.TELEGRAM_BOT_TOKEN:
        raise RuntimeError("TELEGRAM_BOT_TOKEN is not configured")

    bot = Bot(token=settings.TELEGRAM_BOT_TOKEN)
    dp = Dispatcher()
    dp.include_router(router)
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
