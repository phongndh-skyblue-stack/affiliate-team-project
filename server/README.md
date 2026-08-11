# MIC ACE — Server

Backend FastAPI cho dự án MIC ACE Affiliate Platform.

## Tech stack

| Thư viện | Mục đích |
|---|---|
| FastAPI 0.115 | Web framework |
| SQLAlchemy 2 | ORM |
| Alembic 1.15 | Database migrations |
| Pydantic Settings | Config từ `.env` |
| PyJWT | JWT access/refresh token |
| Passlib + bcrypt | Hash mật khẩu |
| Uvicorn | ASGI server |

## Cấu trúc thư mục

```text
server/
├── app/
│   ├── main.py                 # FastAPI app, middleware, lifespan
│   ├── router.py               # Gom tất cả API router
│   ├── api/
│   │   ├── auth/               # Đăng ký, đăng nhập, refresh, logout
│   │   │   ├── model.py        # SQLAlchemy User model
│   │   │   ├── repository.py   # Truy vấn DB
│   │   │   ├── router.py       # FastAPI endpoints
│   │   │   ├── schema.py       # Pydantic request/response schemas
│   │   │   └── service.py      # Business logic
│   │   ├── users/              # Lấy thông tin user hiện tại
│   │   └── health/             # Health check endpoint
│   ├── core/
│   │   ├── config.py           # Settings (pydantic-settings, đọc .env)
│   │   ├── database.py         # SQLAlchemy engine, session, Base
│   │   └── security.py         # JWT tạo/verify, password hash
│   └── shared/
│       ├── constants.py        # Hằng số dùng chung
│       ├── deps.py             # FastAPI dependencies (get_current_user…)
│       ├── exceptions.py       # AppHTTPException
│       ├── pagination.py       # Pagination helper
│       ├── responses.py        # Chuẩn hoá response
│       └── utils.py            # Utility functions
├── migrations/
│   ├── env.py                  # Alembic env config
│   ├── script.py.mako
│   └── versions/               # File migration được sinh ra
├── .env                        # Biến môi trường local (không commit)
├── .env.example                # Mẫu biến môi trường
├── alembic.ini                 # Alembic config
└── requirements.txt
```

## Biến môi trường

Tạo file `.env` trong thư mục `server/` (xem mẫu ở `.env.example`):

```env
APP_NAME=MIC ACE API
APP_ENV=development
DEBUG=true
APP_PORT=4050
API_PREFIX=/api

DATABASE_URL=sqlite:///./micace.db

SQLALCHEMY_ECHO=false

JWT_ALGORITHM=HS256
JWT_SECRET_KEY=change-me-access-secret
JWT_REFRESH_SECRET_KEY=change-me-refresh-secret
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

CORS_ORIGINS=http://localhost:4000,http://127.0.0.1:4000
```

## Chạy local

```bash
# Tạo virtual environment
python -m venv .venv

# Kích hoạt (Windows)
.venv\Scripts\activate
# Kích hoạt (Linux/macOS)
source .venv/bin/activate

# Cài dependencies
pip install -r requirements.txt

# Chạy server (port 4050)
uvicorn app.main:app --reload --port 4050
```

Server chạy tại **http://localhost:4050**.  
Swagger UI: **http://localhost:4050/docs**

## Alembic — Database migrations

```bash
# Tạo migration mới từ thay đổi model
alembic revision --autogenerate -m "mô tả thay đổi"

# Apply migration lên DB
alembic upgrade head

# Xem lịch sử migration
alembic history

# Rollback 1 bước
alembic downgrade -1
```

> Lưu ý: `app/main.py` có `Base.metadata.create_all()` trong startup, nên table sẽ được tạo tự động khi chạy dev dù chưa chạy `alembic upgrade head`. Trong production nên dùng Alembic.

## API Endpoints

| Method | Path | Mô tả |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/auth/register` | Đăng ký tài khoản |
| `POST` | `/api/auth/login` | Đăng nhập |
| `POST` | `/api/auth/refresh` | Cấp lại access token |
| `POST` | `/api/auth/logout` | Logout (stateless) |
| `GET` | `/api/users/me` | Thông tin user hiện tại |


## Tính năng sẵn có

- `POST /api/auth/register`: đăng ký user mới, trả về `accessToken`, `refreshToken`, `user`
- `POST /api/auth/login`: đăng nhập bằng `username` và `password`
- `POST /api/auth/refresh`: cấp lại access token từ refresh token
- `POST /api/auth/logout`: endpoint logout dạng stateless
- `GET /api/users/me`: lấy thông tin user hiện tại từ bearer token
- `GET /api/health`: health check

## Chạy local

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 4050
```

Server mặc định chạy tại `http://localhost:4050`, nên frontend `client/` có thể dùng luôn `http://localhost:4050/api`.

Nếu chạy bằng Python trực tiếp, backend dùng host mặc định trong code và đọc `APP_PORT` từ `.env` nếu có:

```bash
python -m app.main
```

## Alembic

Tạo migration đầu tiên:

```bash
alembic revision --autogenerate -m "init"
alembic upgrade head
```

Lưu ý: hiện tại app có `Base.metadata.create_all(...)` trong startup để chạy được ngay trên local ngay cả khi chưa tạo migration đầu tiên.