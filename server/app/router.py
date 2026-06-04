from __future__ import annotations

from fastapi import APIRouter

from app.api.ads_transparent.router import router as ads_transparent_router
from app.api.affiliate_data.router import router as affiliate_data_router
from app.api.auth.router import router as auth_router
from app.api.health.router import router as health_router
from app.api.keyword_planner.router import mail_router as mail_delegation_router
from app.api.keyword_planner.router import router as keyword_planner_router
from app.api.manual_search.router import router as manual_search_router
from app.api.notifications.router import router as notifications_router
from app.api.proxy.router import router as proxy_router
from app.api.search_ads.router import router as search_ads_router
from app.api.telegram.router import router as telegram_router
from app.api.users.router import router as users_router
from app.core.config import settings

api_router = APIRouter(prefix=settings.API_PREFIX)
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(ads_transparent_router)
api_router.include_router(manual_search_router)
api_router.include_router(search_ads_router)
api_router.include_router(affiliate_data_router)
api_router.include_router(keyword_planner_router)
api_router.include_router(mail_delegation_router)
api_router.include_router(notifications_router)
api_router.include_router(proxy_router)
api_router.include_router(telegram_router)
