# Server – Hướng dẫn cho Agent

## Kiến trúc 3 lớp

Mỗi domain nằm trong `app/api/<domain>/` và gồm 4 file chính:

```
router.py      ← Chỉ nhận request, gọi service, trả response
service.py     ← Logic nghiệp vụ, orchestration
repository.py  ← Toàn bộ truy vấn DB (SQLAlchemy)
model.py       ← ORM model kế thừa Base
schema.py      ← Pydantic request/response schemas
```

**Quy tắc:**
- `repository.py`: chỉ viết DB queries (`select`, `insert`, `update`, `delete`). Không có business logic.
- `service.py`: gọi repository, xử lý logic nghiệp vụ, gọi external API nếu cần.
- `router.py`: gọi service, map kết quả sang response schema. Không viết query trực tiếp.

## Dependency Injection

```python
# database.py
def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# shared/deps.py
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    ...

# router.py pattern
def get_service(db: Session = Depends(get_db)) -> XxxService:
    return XxxService(db)

@router.get("/...")
def endpoint(
    current_user: User = Depends(get_current_user),
    service: XxxService = Depends(get_service),
):
    return service.do_something(current_user.id)
```

- `Service.__init__(self, db)` nhận `Session` và khởi tạo `Repository(db)`.
- Router không giữ state, mọi DI đều qua `Depends`.

## Migration (Alembic)

Khi thêm/sửa model, chạy:

```bash
# Tạo revision tự động dựa trên thay đổi model
alembic revision --autogenerate -m "mô tả thay đổi"

# Áp dụng migration lên head
alembic upgrade head
```

> Luôn kiểm tra file migration sinh ra trước khi `upgrade head`.
