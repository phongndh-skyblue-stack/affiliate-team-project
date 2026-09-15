# Hướng dẫn đặt lịch với RedBeat (Celery Beat)

Tài liệu này mô tả cách dự án **api-adecos** thiết lập và vận hành lịch chạy định kỳ bằng **Celery Beat + RedBeat** (lịch lưu trên **Redis**). Mục tiêu: agent/developer khác có thể đọc, triển khai infra, và thêm job mới đúng convention.

---

## 1. Tổng quan kiến trúc

```mermaid
flowchart LR
  API[FastAPI API] -->|RedBeatManager.create/upsert| Redis[(Redis RedBeat keys)]
  Beat[Celery Beat + RedBeatScheduler] -->|đọc lịch| Redis
  Beat -->|publish task| RabbitMQ[(RabbitMQ)]
  Worker[Celery Worker] -->|consume| RabbitMQ
  Worker -->|execute| Task[Celery Task functions]
  API -->|metadata scheduler| PG[(PostgreSQL)]
```

| Thành phần | Vai trò |
|-----------|---------|
| **Redis** | Lưu định nghĩa lịch RedBeat (`redbeat{job_name}`) |
| **RabbitMQ** | Broker hàng đợi task |
| **PostgreSQL** | Backend kết quả Celery + bảng scheduler (keyword/crawler/project) |
| **Celery Beat** | Process đọc Redis, enqueue task đúng giờ |
| **Celery Worker** | Process thực thi task (theo `queue`) |
| **FastAPI** | Tạo/cập nhật/xóa job qua `RedBeatManager`; một số job hệ thống đăng ký lúc startup |

**Nguyên tắc quan trọng**

- Lịch **runtime** nằm trên Redis (RedBeat), không dùng file `celerybeat-schedule`.
- Với scheduler do user cấu hình (keyword, crawler, project): **PostgreSQL là nguồn metadata** (`redbeat_job_name`, `next_run_at`, …); mỗi thao tác CRUD scheduler phải **đồng bộ Redis + DB** (tạo job trước/sau tùy flow, luôn rollback DB nếu RedBeat fail).
- Task Celery phải được **đăng ký** trong `api/core/celery_config.py` (`include` / `autodiscover_tasks`) và worker phải lắng nghe **đúng queue**.

---

## 2. Hạ tầng & biến môi trường

### 2.1 Dịch vụ bắt buộc

| Dịch vụ | Mục đích |
|---------|----------|
| Redis | RedBeat + cache app |
| RabbitMQ | Celery broker |
| PostgreSQL | DB app + Celery result backend |

Tham khảo `docker-compose.yml` (service `redis`, `some-rabbit`, `postgres`).

### 2.2 Biến môi trường (`.env`)

```env
# Broker & backend
CELERY_BROKER_URL=amqp://user:password@host:5672//
CELERY_POSTGRES_USER=...
CELERY_POSTGRES_PASSWORD=...
CELERY_POSTGRES_HOST=...
CELERY_POSTGRES_PORT=5432
CELERY_POSTGRES_DB=postgres_celery

REDIS_URL=redis://redis:6379/0

# Khoảng giờ giữa các lần quét digital (account/campaign cron)
# Cron hour = */SCHEDULER_INTERVAL (mặc định 12 → mỗi 12 giờ)
SCHEDULER_INTERVAL=12

# Khi true: API startup gọi sync toàn bộ campaign/account scan jobs
AUTO_SCHEDULER=false
```

`SCHEDULER_INTERVAL` được đồng bộ vào Redis lúc startup (`sync_sheduler_interval_from_env_and_motify_scheduler`); khi giá trị đổi, hệ thống **upsert lại** toàn bộ job account/campaign theo interval mới.

### 2.3 Dependency

```
celery-redbeat==2.3.3
```

(`requirements.txt`)

---

## 3. Cấu hình Celery & RedBeat

File trung tâm: `api/core/celery_config.py`.

```python
celery_app.conf.update(
    beat_scheduler="redbeat.RedBeatScheduler",
    redbeat_redis_url=redbeat_url,          # từ settings.REDIS_URL
    redbeat_key_prefix="redbeat",           # key Redis: redbeat{job_name}
    redbeat_lock_key="redbeat::lock",
    redbeat_lock_timeout=600,
    beat_max_loop_interval=2,             # Beat poll Redis mỗi ~2s
    timezone=pytz.timezone("Asia/Ho_Chi_Minh"),
    enable_utc=True,
)
```

- Task được route theo `task_routes` (ví dụ `digital`, `keywords`, `projects`, `crawlers`, `agents`, …).
- Module task phải nằm trong `include=[...]` hoặc `autodiscover_tasks([...])`.

---

## 4. Chạy process (local / deploy)

### 4.1 Worker (ví dụ)

```bash
# Digital (account/campaign scan)
celery -A api.core.celery_config worker --loglevel=info --queues=digital --concurrency=4 -n digital-worker@%h

# Keywords
celery -A api.core.celery_config worker --loglevel=info --queues=keywords --concurrency=2 -n keywords-worker@%h

# Projects
celery -A api.core.celery_config worker --loglevel=info --queues=projects --concurrency=2 -n projects-worker@%h

# Crawlers
celery -A api.core.celery_config worker --loglevel=info --queues=crawlers --concurrency=4 -n crawler-worker@%h
```

Windows (pool threads cho một số queue): xem `README.md`.

### 4.2 Beat (bắt buộc cho mọi job RedBeat)

Scheduler đã cấu hình sẵn trong app; chỉ cần:

```bash
celery -A api.core.celery_config beat --loglevel=info
```

Hoặc chỉ định rõ (tương đương):

```bash
celery -A api.core.celery_config beat -S redbeat.RedBeatScheduler --loglevel=info
```

**Lưu ý:** Chỉ chạy **một** Beat leader (RedBeat dùng lock `redbeat::lock`). Scale worker, không scale beat.

### 4.3 API

```bash
uvicorn api.main:app --reload
```

Một số job hệ thống được `upsert`/`create` trong **lifespan startup** (`api/main.py`) — vẫn cần Beat + Worker, không cần gọi API để các job đó tồn tại (trừ khi đã xóa khỏi Redis).

---

## 5. `RedBeatManager` — API quản lý lịch

File: `api/shared/services/scheduler.py`.

### 5.1 Kiểu lịch (`ScheduleSpec`)

| Kiểu | Mô tả |
|------|--------|
| `CronSpec(minute, hour, day_of_week, day_of_month, month_of_year)` | Crontab (giờ theo timezone Beat: `Asia/Ho_Chi_Minh`) |
| `EverySpec(seconds)` | Mỗi N giây |
| `timedelta` | Interval (giống crawler/keyword/project scheduler) |

### 5.2 Phương thức chính

| Method | Hành vi |
|--------|---------|
| `create(name, task, schedule, args, kwargs, enabled, options)` | Tạo mới; nếu đã có → `JobStatus.ALREADY_EXISTS` |
| `update(...)` | Cập nhật từng field; không có → `NOT_FOUND` |
| `upsert(...)` | Create hoặc update full |
| `create_clocked(name, task, clocked_time, ...)` | Một lần theo crontab phút/giờ/ngày/tháng (không có năm) |
| `delete(name)` / `delete_by_prefix(prefix)` / `delete_by_task(task)` | Xóa |
| `enable(name)` / `disable(name)` | Bật/tắt không xóa |
| `exists(name)` / `get(name)` / `list_names(prefix)` | Kiểm tra / liệt kê |

`options` thường chứa `{"queue": "digital"}` (hoặc `keywords`, `projects`, `crawlers`, …) — **phải khớp** queue worker đang chạy.

### 5.3 `JobStatus`

Enum: `api/shared/enums/enum.py` → `JobStatus` (`scheduled`, `updated`, `already_exists`, `not_found`, `deleted`, `enabled`, `disabled`, …).

### 5.4 Ví dụ tạo job cron (digital)

```python
from api.shared.services.scheduler import CronSpec, RedBeatManager

mgr = RedBeatManager()
status = mgr.upsert(
    name="campaign_scan_<campaign_uuid>",
    task="campaign.scan",
    schedule=CronSpec(minute="0", hour="*/12"),
    args=(str(campaign_id),),
    options={"queue": "digital"},
)
```

### 5.5 Ví dụ job interval (crawler)

```python
from datetime import timedelta

mgr.create(
    name=f"crawler_scheduler_{crawler_id}",
    task="crawlers.run_crawler_scheduled",
    schedule=timedelta(hours=24),
    args=[str(crawler_id)],
    kwargs={"scheduler_id": str(scheduler_id), "triggered_by": "scheduler"},
    options={"queue": "crawlers"},
)
```

### 5.6 `create_clocked` — lịch bắt đầu trong tương lai

Dùng khi `date_start > now` (keyword, crawler, project scheduler). Task **phải tự chuyển** sang periodic sau lần chạy đầu (logic nằm trong task/service tương ứng — xem `api/src/project/crawler/service.py`, `keyword/service.py`, `project_component/service.py`).

Timezone so sánh thường dùng **UTC+7** cho `date_start`, trong khi Beat config `Asia/Ho_Chi_Minh`.

---

## 6. Hai nhóm job trong dự án

### 6.1 Job hệ thống (đăng ký lúc API startup)

Định nghĩa trong `api/main.py` (lifespan), ví dụ:

| `name` (RedBeat) | `task` | Queue |
|------------------|--------|-------|
| `account_sync_ads_accounts_and_budget.first` | `account.sync_ads_accounts_and_budget` | digital |
| `campaign_scan_all_before_report` | `campaign.scan_all_before_report` | digital |
| `daily_campaign_data_refresh_*` | `daily.campaign.data.refresh` | digital |
| `monthly_scoring_recalculation` | `scoring.recalculate_monthly_scores` | projects |
| `keyword_planner_sync_locations` | `keyword_planner.sync_locations` | digital |

Pattern: `mgr.upsert(...)` hoặc `mgr.create(...)` — idempotent qua `upsert` khi cần.

### 6.2 Job theo entity (digital account/campaign)

**Constants:** `api/shared/constants/redbeat_job.py`

| Config | `name_prefix` | `task` | `minute` (stagger) |
|--------|---------------|--------|---------------------|
| Account `DATA_SCAN` | `account_data_scan` | `account.scan_data` | 10 |
| Account `BIDDING_STRATEGY_DATA_SCAN` | `account_bidding_strategy_data_scan` | `account.scan_bidding_strategy_data` | 12 |
| Campaign `SCAN` | `campaign_scan` | `campaign.scan` | 0 |
| Campaign `KEYWORD_SCAN` | `campaign_keyword_scan` | `campaign.scan_keyword_data` | 1 |
| … | … | … | … |

**Quy tắc đặt tên job:** `{name_prefix}_{entity_uuid}`  
Ví dụ: `campaign_scan_a1b2c3d4-...`

**Cron hour:** `*/{SCHEDULER_INTERVAL}` — helper `_scheduler_hour()` trong `api/shared/utils/main_support.py`.

**Đồng bộ hàng loạt:**

- `start_all_campaign_schedulers()` — upsert mọi campaign (khi `AUTO_SCHEDULER=true` lúc startup).
- `_sync_account_schedulers` / `_sync_campaign_schedulers` — khi `SCHEDULER_INTERVAL` đổi.

**Task implementation:** `api/src/digital/account/jobs.py` — `@celery_app.task(name=CampaignJobConfigs.SCAN.task, ...)`.

Khi tạo account/campaign mới, service/repository gọi `RedBeatManager.upsert` tương tự; khi incident/xóa entity → `mgr.delete(f"{prefix}_{id}")`.

### 6.3 Job theo user scheduler (keyword / crawler / project)

| Module | Bảng DB | Pattern `redbeat_job_name` | Task Celery |
|--------|---------|---------------------------|-------------|
| Keyword | scheduler keyword | `keyword_scheduler_{keyword_id}` | `keywords.search_keyword_scheduled` |
| Crawler | crawler scheduler | `crawler_scheduler_{crawler_id}` | `crawlers.run_crawler_scheduled` |
| Project (global) | project scheduler | `global_scheduler_{type}_{user_id}` | `projects.scan_all_{type}` |
| Project (per project) | project scheduler | `project_scheduler_{project_id}` | `projects.scan_all_*` / traffic tasks |

**Flow chuẩn khi tạo scheduler (service layer):**

1. Kiểm tra Redis (`exists`) — fail fast 503 nếu Redis down.
2. Tạo record DB + gán `redbeat_job_name`.
3. `create_clocked` (future `date_start`) hoặc `create` với `timedelta` (chạy ngay định kỳ).
4. Cập nhật `next_run_at` trên DB.
5. Exception → rollback/xóa DB record.

**Flow update:** thường `delete` job cũ → `create`/`create_clocked` mới (tránh lỗi đổi kiểu schedule).

**Flow delete:** xóa RedBeat trước (có retry), rồi xóa DB; nếu RedBeat fail sau retry → có thể disable scheduler thay vì mất đồng bộ.

---

## 7. Checklist: thêm job định kỳ mới

Dùng cho agent implement feature mới.

### Bước 1 — Định nghĩa Celery task

```python
# api/src/<module>/jobs.py hoặc tasks.py
from api.core.celery_config import celery_app

@celery_app.task(name="my_module.my_task", bind=True, queue="digital")
def my_task(self, entity_id: str):
    ...
```

- `name` phải **unique** toàn cluster.
- `queue` khớp `task_routes` trong `celery_config.py`.

### Bước 2 — Đăng ký module task

Thêm path vào `include` và/hoặc `autodiscover_tasks` trong `api/core/celery_config.py`.

### Bước 3 — (Tuỳ chọn) Constant job

Nếu là job digital theo entity, thêm vào `RedBeatJobConfig` trong `api/shared/constants/redbeat_job.py` và dùng trong `AccountJobConfigs.all()` / `CampaignJobConfigs.all()`.

### Bước 4 — Đăng ký lịch

**A. Job toàn hệ thống (cố định):** thêm `mgr.upsert(...)` trong `api/main.py` lifespan **hoặc** migration/script ops một lần.

**B. Job theo entity:** gọi `RedBeatManager` từ **service** khi create/update/delete entity; lưu `redbeat_job_name` trên DB nếu cần UI/API liệt kê.

**C. Job theo user scheduler:** làm theo pattern keyword/crawler (`CrawlerSchedulerService`, `KeywordSchedulerService`, …).

### Bước 5 — Vận hành

- Deploy/ chạy worker đúng `--queues=...`.
- Chạy **một** Celery Beat.
- Redis + RabbitMQ available.

### Bước 6 — Kiểm tra

```bash
# Redis CLI — liệt kê key (prefix mặc định)
redis-cli KEYS "redbeat*"

# Python shell
from api.shared.services.scheduler import RedBeatManager
mgr = RedBeatManager()
print(mgr.list_names("campaign_scan"))
print(mgr.get("campaign_scan_<uuid>"))
```

---

## 8. Mapping task → queue (tham khảo)

| Task prefix / pattern | Queue |
|----------------------|-------|
| `account.*`, `campaign.*`, `daily.campaign.*`, `keyword_planner.*` | `digital` |
| `keywords.*` | `keywords` |
| `projects.*`, `scoring.*` | `projects` |
| `crawlers.*` | `crawlers` |
| `tasks.scan.*`, `tasks.memory.*` | `agents` |
| `tasks.agent.run_ads` | `chat_ads_requests` |
| `tasks.agent.run_research` | `chat_research_requests` |

Luôn truyền `options={"queue": "..."}` khi tạo RedBeat job nếu khác `default`.

---

## 9. Timezone & `next_run_at`

- Beat: `timezone=Asia/Ho_Chi_Minh`, `enable_utc=True`.
- UI/API `next_run_at` thường tính đồng bộ với logic RedBeat (`now + timedelta`, hoặc `date_start` nếu clocked) — xem `_calculate_next_run` trong các service scheduler.
- `create_clocked` dùng crontab **không có year** → job “một lần” theo pattern ngày-tháng; task runtime phải đổi sang interval nếu cần lặp.

---

## 10. Xử lý lỗi & vận hành

| Vấn đề | Gợi ý |
|--------|--------|
| Task không chạy | Beat có chạy? Redis có key `redbeat{name}`? Worker có đúng queue? |
| `ALREADY_EXISTS` khi create | Dùng `upsert` hoặc `delete` trước |
| Orphan Redis key | `delete` / `delete_by_prefix` / `list_names` + dọn tay |
| Orphan DB scheduler | Cron cleanup trong task (ví dụ crawler/keyword task xóa job khi hết hạn) |
| Campaign/account 404 | `jobs.py` xóa RedBeat job tương ứng (`_handle_campaign_not_found_error`) |
| Đổi `SCHEDULER_INTERVAL` | Restart API → `sync_sheduler_interval_from_env_and_motify_scheduler` upsert lại digital jobs |

**Không** commit secrets trong `.env`. Production: một Beat instance, monitor Redis memory.

---

## 11. File tham chiếu nhanh

| File | Nội dung |
|------|----------|
| `api/core/celery_config.py` | Celery app, RedBeat config, queues, routes |
| `api/shared/services/scheduler.py` | `RedBeatManager`, `CronSpec`, `EverySpec` |
| `api/shared/constants/redbeat_job.py` | Digital scan job constants |
| `api/shared/utils/main_support.py` | Sync account/campaign schedulers, interval sync |
| `api/main.py` | Startup system schedulers, `AUTO_SCHEDULER` |
| `api/src/digital/account/jobs.py` | Digital scheduled tasks |
| `api/src/project/keyword/service.py` | Keyword scheduler + RedBeat |
| `api/src/project/crawler/service.py` | Crawler scheduler + RedBeat |
| `api/src/project/project_component/service.py` | Project scheduler + RedBeat |
| `README.md` | Lệnh worker/beat cơ bản |

---

## 12. Tóm tắt cho agent triển khai

1. **Infra:** Redis + RabbitMQ + Postgres + Celery Worker(s) + **một** Celery Beat.
2. **Config:** `REDIS_URL`, `CELERY_BROKER_URL`, `CELERY_DATABASE_URL`, tuỳ chọn `SCHEDULER_INTERVAL`, `AUTO_SCHEDULER`.
3. **Code:** Task Celery (`name` + `queue`) → đăng ký trong `celery_config` → `RedBeatManager.create/upsert` với `name` unique và `options.queue` đúng.
4. **User schedulers:** Luôn đồng bộ DB ↔ Redis; validate Redis trước khi ghi DB; rollback khi RedBeat fail.
5. **Digital entity scans:** Dùng `redbeat_job.py` + `{prefix}_{uuid}` + `CronSpec(minute=..., hour=*/SCHEDULER_INTERVAL)`.

Nếu chỉ sửa tần suất quét digital toàn cục: đổi `SCHEDULER_INTERVAL` và restart API (để sync), không cần sửa từng campaign thủ công.
