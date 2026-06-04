from __future__ import annotations

import asyncio
import sys
from pathlib import Path

from aiogram import Bot, Dispatcher, F, Router
from aiogram.types import Message
from fastapi import HTTPException

SERVER_DIR = Path(__file__).resolve().parents[1]
if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))

from app.api.telegram.service import TelegramService  # noqa: E402
from app.api.telegram.verification import delete_verification_code, get_user_id_from_code  # noqa: E402
from app.core.config import settings  # noqa: E402
from app.core.database import SessionLocal  # noqa: E402

router = Router()


def save_chat_link(user_id: str, chat_id: int) -> None:
    with SessionLocal() as db:
        TelegramService(db).save_chat_link(user_id, chat_id)


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
    await message.answer("Lien ket Telegram thanh cong. Ban se nhan duoc thong bao tu he thong.")


async def main() -> None:
    if not settings.TELEGRAM_BOT_TOKEN:
        raise RuntimeError("TELEGRAM_BOT_TOKEN is not configured")

    bot = Bot(token=settings.TELEGRAM_BOT_TOKEN)
    dp = Dispatcher()
    dp.include_router(router)
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
