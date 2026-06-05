# Cách chạy dự án MIC ACE local

Tài liệu này có 2 phiên bản:

1. Windows
2. macOS

Bạn cần chạy đủ 4 thứ:

1. Backend API
2. Frontend web
3. ARQ worker
4. Telegram bot

ARQ worker cần Redis chạy ở máy local.

## A. Windows

Phần này dùng Git Bash trên Windows.

Đường dẫn project:

```text
D:\MICACE\affiliate-project
```

Trong Git Bash, đường dẫn này viết là:

```bash
/d/MICACE/affiliate-project
```

### A0. Mở Git Bash

Cách dễ nhất:

1. Mở thư mục `D:\MICACE\affiliate-project` bằng File Explorer.
2. Click chuột phải vào khoảng trống trong thư mục.
3. Chọn `Open Git Bash here`.

Nếu không thấy `Open Git Bash here`:

1. Mở Start Menu.
2. Gõ `Git Bash`.
3. Mở Git Bash.
4. Gõ lệnh này rồi Enter:

```bash
cd /d/MICACE/affiliate-project
```

Kiểm tra đang đứng đúng thư mục:

```bash
pwd
```

Nếu đúng, sẽ thấy gần giống:

```text
/d/MICACE/affiliate-project
```

### A1. Cài thư viện nếu là lần đầu

Backend:

```bash
cd /d/MICACE/affiliate-project/server
pip install -r requirements.txt
```

Frontend:

```bash
cd /d/MICACE/affiliate-project/client
yarn install
```

Nếu máy không có `yarn`, dùng:

```bash
cd /d/MICACE/affiliate-project/client
npm install
```

### A2. Chạy Redis cho ARQ

ARQ worker cần Redis. Nếu Redis đã chạy sẵn thì bỏ qua phần này.

Kiểm tra Redis:

```bash
redis-cli ping
```

Nếu hiện `PONG` là Redis đã chạy.

Nếu dùng Docker, mở Git Bash mới và chạy:

```bash
docker run --name micace-redis -p 6379:6379 redis:7
```

Nếu báo container đã tồn tại, chạy:

```bash
docker start micace-redis
```

Giữ cửa sổ Redis này mở.

### A3. Cửa sổ 1: chạy Backend API

Mở Git Bash mới.

```bash
cd /d/MICACE/affiliate-project/server
uvicorn app.main:app --reload --host 0.0.0.0 --port 9030
```

Kiểm tra backend trong trình duyệt:

```text
http://localhost:9030/docs
```

Giữ cửa sổ backend này mở.

### A4. Cửa sổ 2: chạy Frontend web

Mở Git Bash mới.

```bash
cd /d/MICACE/affiliate-project/client
yarn dev
```

Nếu không dùng `yarn`, chạy:

```bash
cd /d/MICACE/affiliate-project/client
npm run dev
```

Mở web:

```text
http://localhost:3000
```

Giữ cửa sổ frontend này mở.

### A5. Cửa sổ 3: chạy ARQ worker

Mở Git Bash mới.

```bash
cd /d/MICACE/affiliate-project/server
arq app.api.search_ads.tasks.WorkerSettings
```

Nếu báo lỗi không kết nối được Redis, quay lại phần `A2. Chạy Redis cho ARQ`.

Giữ cửa sổ ARQ worker này mở.

### A6. Cửa sổ 4: chạy Telegram bot

Mở Git Bash mới.

```bash
cd /d/MICACE/affiliate-project/server
python -m bot.main
```

Không chạy kiểu này:

```bash
python -m server/bot/main
```

Lệnh đó sai vì `python -m` không dùng dấu `/`.

Bot cần `TELEGRAM_BOT_TOKEN` trong file:

```text
D:\MICACE\affiliate-project\server\.env
```

Giữ cửa sổ bot này mở.

### A7. Tóm tắt Windows

Backend:

```bash
cd /d/MICACE/affiliate-project/server
uvicorn app.main:app --reload --host 0.0.0.0 --port 9030
```

Frontend:

```bash
cd /d/MICACE/affiliate-project/client
yarn dev
```

ARQ worker:

```bash
cd /d/MICACE/affiliate-project/server
arq app.api.search_ads.tasks.WorkerSettings
```

Telegram bot:

```bash
cd /d/MICACE/affiliate-project/server
python -m bot.main
```

## B. macOS

Phần này dùng Terminal trên macOS. Shell mặc định thường là `zsh`, dùng được bình thường.

Đường dẫn project trên máy bạn có thể khác. Ví dụ nếu project nằm trong `Documents`:

```text
~/Documents/MICACE/affiliate-project
```

Nếu project nằm chỗ khác, thay đường dẫn trong các lệnh bên dưới cho đúng.

### B0. Mở Terminal

1. Bấm `Command + Space`.
2. Gõ `Terminal`.
3. Bấm Enter.

Vào thư mục project:

```zsh
cd ~/Documents/MICACE/affiliate-project
```

Kiểm tra đang đứng đúng thư mục:

```zsh
pwd
```

Nếu đúng, sẽ thấy gần giống:

```text
/Users/ten-cua-ban/Documents/MICACE/affiliate-project
```

### B1. Cài thư viện nếu là lần đầu

Backend:

```zsh
cd ~/Documents/MICACE/affiliate-project/server
pip install -r requirements.txt
```

Frontend:

```zsh
cd ~/Documents/MICACE/affiliate-project/client
yarn install
```

Nếu máy không có `yarn`, dùng:

```zsh
cd ~/Documents/MICACE/affiliate-project/client
npm install
```

### B2. Chạy Redis cho ARQ

ARQ worker cần Redis. Nếu Redis đã chạy sẵn thì bỏ qua phần này.

Kiểm tra Redis:

```zsh
redis-cli ping
```

Nếu hiện `PONG` là Redis đã chạy.

Nếu có Homebrew, có thể chạy Redis bằng:

```zsh
brew services start redis
```

Nếu dùng Docker, mở Terminal mới và chạy:

```zsh
docker run --name micace-redis -p 6379:6379 redis:7
```

Nếu báo container đã tồn tại, chạy:

```zsh
docker start micace-redis
```

### B3. Cửa sổ 1: chạy Backend API

Mở Terminal mới.

```zsh
cd ~/Documents/MICACE/affiliate-project/server
uvicorn app.main:app --reload --host 0.0.0.0 --port 9030
```

Kiểm tra backend trong trình duyệt:

```text
http://localhost:9030/docs
```

Giữ cửa sổ backend này mở.

### B4. Cửa sổ 2: chạy Frontend web

Mở Terminal mới.

```zsh
cd ~/Documents/MICACE/affiliate-project/client
yarn dev
```

Nếu không dùng `yarn`, chạy:

```zsh
cd ~/Documents/MICACE/affiliate-project/client
npm run dev
```

Mở web:

```text
http://localhost:3000
```

Giữ cửa sổ frontend này mở.

### B5. Cửa sổ 3: chạy ARQ worker

Mở Terminal mới.

```zsh
cd ~/Documents/MICACE/affiliate-project/server
arq app.api.search_ads.tasks.WorkerSettings
```

Nếu báo lỗi không kết nối được Redis, quay lại phần `B2. Chạy Redis cho ARQ`.

Giữ cửa sổ ARQ worker này mở.

### B6. Cửa sổ 4: chạy Telegram bot

Mở Terminal mới.

```zsh
cd ~/Documents/MICACE/affiliate-project/server
python -m bot.main
```

Nếu máy macOS dùng lệnh `python3` thay vì `python`, chạy:

```zsh
cd ~/Documents/MICACE/affiliate-project/server
python3 -m bot.main
```

Bot cần `TELEGRAM_BOT_TOKEN` trong file:

```text
~/Documents/MICACE/affiliate-project/server/.env
```

Giữ cửa sổ bot này mở.

### B7. Tóm tắt macOS

Backend:

```zsh
cd ~/Documents/MICACE/affiliate-project/server
uvicorn app.main:app --reload --host 0.0.0.0 --port 9030
```

Frontend:

```zsh
cd ~/Documents/MICACE/affiliate-project/client
yarn dev
```

ARQ worker:

```zsh
cd ~/Documents/MICACE/affiliate-project/server
arq app.api.search_ads.tasks.WorkerSettings
```

Telegram bot:

```zsh
cd ~/Documents/MICACE/affiliate-project/server
python -m bot.main
```

## C. Thứ tự chạy khuyến nghị

Chạy theo thứ tự này cho đỡ lỗi:

1. Redis
2. Backend API
3. ARQ worker
4. Telegram bot
5. Frontend web

Frontend có thể mở sau cùng vì nó gọi API từ backend.

## D. Cách tắt

Ở từng cửa sổ đang chạy server/worker/bot, bấm:

```text
Ctrl + C
```

Nếu hỏi xác nhận, bấm:

```text
Y
```

rồi Enter.

## E. Lỗi thường gặp

### Lỗi `No module named server/bot/main`

Bạn đang chạy sai lệnh bot.

Windows:

```bash
cd /d/MICACE/affiliate-project/server
python -m bot.main
```

macOS:

```zsh
cd ~/Documents/MICACE/affiliate-project/server
python -m bot.main
```

Nếu macOS không nhận `python`, dùng:

```zsh
python3 -m bot.main
```

### Lỗi frontend không gọi được API

Kiểm tra backend đã chạy chưa:

```text
http://localhost:9030/docs
```

Kiểm tra file frontend env:

Windows:

```text
D:\MICACE\affiliate-project\client\.env
```

macOS:

```text
~/Documents/MICACE/affiliate-project/client/.env
```

Cần có:

```env
NEXT_PUBLIC_API_URL=http://localhost:9030/api
PORT=3000
```

### Lỗi ARQ không chạy

Kiểm tra Redis:

```bash
redis-cli ping
```

Nếu không ra `PONG`, Redis chưa chạy.

### Lỗi thiếu thư viện Python

Windows:

```bash
cd /d/MICACE/affiliate-project/server
pip install -r requirements.txt
```

macOS:

```zsh
cd ~/Documents/MICACE/affiliate-project/server
pip install -r requirements.txt
```

Nếu macOS không nhận `pip`, dùng:

```zsh
pip3 install -r requirements.txt
```

### Lỗi thiếu thư viện frontend

Windows:

```bash
cd /d/MICACE/affiliate-project/client
yarn install
```

macOS:

```zsh
cd ~/Documents/MICACE/affiliate-project/client
yarn install
```

Nếu không dùng `yarn`, chạy `npm install` trong thư mục `client`.
