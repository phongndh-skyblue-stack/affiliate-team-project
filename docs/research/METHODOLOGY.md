# Nghiên cứu dự án affiliate — cách làm và chỗ cần soi lại

Tài liệu này mô tả toàn bộ quy trình đã chạy, để một AI khác (Codex) hoặc người khác
kiểm tra chéo. Mọi con số dưới đây lấy từ file dữ liệu trong cùng thư mục, thời điểm
2026-08-18.

## Bối cảnh

Yêu cầu ban đầu: tìm các website có sản phẩm và có chương trình affiliate, dùng Google
Keyword Planner để lọc theo lượt tìm kiếm và giá thầu.

Phiên Codex trước đó (2026-08-12, `~/.codex/sessions/2026/08/12/rollout-2026-08-12T14-28-32*.jsonl`)
làm việc này qua giao diện Keyword Planner trên Chrome và bị kẹt ở lỗi `DEADLINE_EXCEEDED`.
Hướng thay thế: gọi thẳng Google Ads API bằng service có sẵn của dự án.

## Hạ tầng dùng lại của dự án

- `server/app/shared/services/google_ads.py` — `get_keyword_ideas()` đã có sẵn, không sửa.
- Refresh token lấy từ bảng `author_gmails` join `delegated_mails` trong `server/micace.db`
  (mail `omaragough@gmail.com`).
- Customer ID: chọn tự động tài khoản `ads_status = 'enabled'` → ra `G-2/10-7` (`9781901015`).
  Tài khoản `G-2/10-8` (`3318379468`) đang `suspended` và mọi truy vấn qua nó đều lỗi.

## Bốn script đã viết

Tất cả nằm ở `server/scripts/`, chạy bằng `server/.venv/Scripts/python.exe`.

| script | việc | đầu ra |
|---|---|---|
| `affiliate_keyword_scan.py` | Quét ý tưởng từ khóa theo 19 mảng, mỗi mảng vài nhóm seed hẹp | `affiliate-keyword-scan.csv` |
| `affiliate_project_table.py` | Tra ngược từng **tên dự án** qua Keyword Planner lấy volume + giá thầu | `affiliate-projects-table.csv` |
| `physical_country_trends.py` | Quét hàng vật lý theo 12 quốc gia, mỗi nước dùng ngôn ngữ bản địa + tiếng Anh | `physical-country-trends.csv` |
| `verify_affiliate.py` | Mở website từng dự án, tìm trang chương trình affiliate | `affiliate-verification.csv` |

Tham số chung khi gọi API: `language_id=1000` (tiếng Anh) trừ phần quét quốc gia,
`location_ids=[]` (toàn cầu) trừ phần quét quốc gia, `keyword_plan_network=GOOGLE_SEARCH`.
Retry backoff 5s/15s/40s khi Google trả `DEADLINE_EXCEEDED` hoặc `UNAVAILABLE`.

## Dữ liệu hiện có

| file | số dòng | nội dung |
|---|---|---|
| `affiliate-projects-seed.json` | 665 dự án / 35 mảng | Danh sách brand + domain, đầu vào tra cứu |
| `affiliate-projects-table.csv` | 388 dự án | Bảng chính sau khi lọc theo affiliate |
| `affiliate-projects-removed.csv` | 269 dự án | Bị loại, kèm lý do |
| `affiliate-keyword-scan.csv` | 403 từ khóa | Từ khóa đạt bộ tiêu chí sản phẩm số |
| `physical-country-trends.csv` | 6.318 từ khóa | Hàng vật lý theo 12 quốc gia |
| `affiliate-verification.csv` | 657 dự án | Log xác minh affiliate đầy đủ |
| `affiliate-projects.html` | — | Trang xem, sinh lại được từ 3 CSV trên |

## Các bộ tiêu chí (khác nhau theo loại sản phẩm)

Yêu cầu thay đổi qua từng giai đoạn nên có ba bộ, hiện đều đang được dùng:

1. **Sản phẩm số** — `≥5.000 lượt/tháng`, `low_top_page_bid < $1`, `high_top_page_bid ≥ $5`
2. **Hàng vật lý** — `≥1.000 lượt/tháng`, `high_top_page_bid < $5`
3. **Lọc bổ sung** — dải `200–3.000 lượt/tháng` (chỉ dùng để lọc xem, không xóa dữ liệu)

Nhãn "ĐẠT" trên trang chấm theo bộ 1 hoặc bộ 2 tùy mảng. Danh sách mảng vật lý được
hardcode trong biến `PHYSICAL` ở phần script của `affiliate-projects.html`.

## Luật lọc theo chương trình affiliate

- Có affiliate, **đăng ký qua Impact** → xóa (51 dự án). Theo yêu cầu của người dùng.
- **Không tìm thấy chương trình** → xóa (218 dự án).
- **Không tải được website** (chặn bot / chặn IP / timeout) → giữ, đánh dấu riêng.
- **Chỉ có referral/creator program** → giữ nhưng gắn nhãn phân biệt.

Trạng thái 388 dự án còn lại: `có` 101, `có thể` 13, `chỉ referral` 12, `không rõ` 262.

## Lỗi đã phát hiện và sửa trong quá trình làm

Ghi lại để kiểm chứng — mỗi lỗi đều đã làm sai số liệu ở một bản trước đó.

1. **Dict ghi đè khi khớp tên dự án.** Google trả nhiều dòng chuẩn hóa về cùng một tên
   (khác hoa thường, dấu câu). Code dựng `dict` nên giữ dòng cuối, thường là biến thể
   volume thấp. `shopify` bị ghi 390 lượt trong khi thực tế 5.000.000. Đã sửa: giữ dòng
   có volume lớn nhất.

2. **Alias thêm từ bổ nghĩa làm lệch phép đo.** Tôi từng đặt `oanda` → `oanda forex`,
   `plus500` → `plus500 trading`. Đó là đo cụm từ khác chứ không phải brand. Đã gỡ,
   chỉ giữ alias là biến thể chính tả của chính brand (`crypto com`, `gate io`,
   `protonvpn`) và một ngoại lệ `ig` → `ig broker` vì tên này trùng từ thông dụng.

3. **Mã ngôn ngữ sai.** Dùng `1057` cho Indonesia — mã không tồn tại, cả 8 nhóm lỗi,
   ra 0 dòng. Dùng `1019` cho Việt Nam — mã hợp lệ nhưng là **tiếng Ả Rập**. Tiếng Việt
   là `1040`, Indonesia là `1025`. Docstring trong `google_ads.py:51` của dự án cũng
   đang ghi sai `1019 = Vietnamese` — **chưa sửa file đó**, chỉ sửa trong script mới.

4. **Xác minh affiliate — soft-404.** Nhiều site đá đường dẫn không tồn tại về trang chủ.
   Script đọc trang chủ, thấy chữ "affiliate" trong footer (thường là affiliate disclosure)
   rồi kết luận có chương trình. Đã thêm kiểm tra `is_soft_404()`.

5. **Xác minh affiliate — lẫn referral và partner doanh nghiệp với affiliate.**
   `replit.com/refer`, `ledger.com/referral`, `zapier.com/l/partners` bị đánh là có
   affiliate. Đã tách thành hai mức bằng chứng: `AFFILIATE_PROOF` và `REFERRAL_PROOF`.
   Lần chạy đầu báo 171 dự án "có"; sau khi sửa và soát lại 140 dự án thì còn 101.

## Chỗ cần kiểm tra chéo

Những điểm tôi tự đánh giá là yếu nhất, nên soi trước:

1. **262/388 dự án ở trạng thái "không rõ"** — chưa chứng minh được có affiliate, cũng
   chưa chứng minh được không có. Đây là 68% bảng. Phần lớn là site bán lẻ lớn chặn
   request tự động. Cần trình duyệt thật để kiểm tra.

2. **44 dự án trong nhóm "có" dùng URL không chứa chữ `affiliate`** — dựa vào nội dung
   trang, ví dụ `otter.ai/partner-program`. Đây là nhóm dễ sai nhất còn lại.

3. **Độ chính xác của domain** — domain do tôi điền từ hiểu biết sẵn có, không phải cào
   từ kết quả tìm kiếm. Có thể sai với brand ít tên tuổi.

4. **Volume dạng chính xác vs khoảng** — API trả `avg_monthly_searches` là số cụ thể,
   khác với giao diện Keyword Planner (chỉ hiện khoảng khi tài khoản chưa chạy campaign).
   Cần xác nhận số này có cùng ý nghĩa với số trên giao diện không.

5. **Hai dự án đụng trần giá thầu $1000.00** — `gate.io` và `gohighlevel`. Đây là trần
   Google trả về, không phải giá thị trường.

6. **Dự án Google không trả dòng khớp tên** — `elf cosmetics`, `ego power plus`,
   `nuna baby`, `happiest baby`, `frida baby`, `bass pro shops`, `trx training`,
   `naked nutrition`. Không có mặt trong bảng.

## Cách chạy lại

```bash
cd server
.venv/Scripts/python.exe scripts/affiliate_keyword_scan.py
.venv/Scripts/python.exe scripts/affiliate_project_table.py
.venv/Scripts/python.exe scripts/physical_country_trends.py
.venv/Scripts/python.exe scripts/verify_affiliate.py
```

Thêm dự án mới: thêm `{"name", "domain"}` vào `affiliate-projects-seed.json`, tên nhập
nhằng thì thêm `"query"`. Chạy lại `affiliate_project_table.py --verticals <mảng>`.

## Chưa làm

- Chưa commit bất cứ file nào; toàn bộ đang untracked.
- Chưa sửa docstring sai mã ngôn ngữ trong `server/app/shared/services/google_ads.py`.
- Chưa tích hợp vào tính năng Keyword Planner sẵn có của app (`server/app/api/keyword_planner/`);
  các script chạy độc lập, không ghi vào bảng `keyword_planner_jobs` hay `keyword_candidate_projects`.
- Chưa kiểm tra mức hoa hồng, điều kiện chấp nhận publisher quốc tế, hay cookie duration
  của bất kỳ chương trình affiliate nào.
