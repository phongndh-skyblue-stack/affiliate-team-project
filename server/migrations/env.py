from __future__ import annotations

from logging.config import fileConfig
from pathlib import Path
import sys

from alembic import context
from sqlalchemy import engine_from_config, pool

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from app.api.ads_transparent.model import AdCreative, AdCreativeDetail, AdTransparencySearch  # noqa: F401
from app.api.affiliate_data.model import (  # noqa: F401
    AffiliateLink,
    AffiliateLinkProjectDataScan,
    AffiliateLinkTrafficScan,
)
from app.api.auth.model import User  # noqa: F401
from app.api.keyword_planner.model import (  # noqa: F401
    AdsAccount,
    AuthorGmail,
    DelegatedMail,
    KeywordPlannerJob,
    KeywordPlannerResult,
)
from app.api.manual_search.model import ManualCompetitorSearch, ManualCompetitorSearchAd  # noqa: F401
from app.api.notifications.model import Notification  # noqa: F401
from app.api.policy_watch.model import PolicyChangeEvent, PolicyWatchSnapshot  # noqa: F401
from app.api.proxy.model import Proxy  # noqa: F401
from app.api.search_ads.model import GoogleAdsSearch, GoogleAdsSearchAd, GoogleAdsSearchSchedule  # noqa: F401
from app.api.seo_content.model import SeoContent  # noqa: F401
from app.api.telegram.model import TelegramSubscription  # noqa: F401
from app.core.config import settings
from app.core.database import Base

config = context.config
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
