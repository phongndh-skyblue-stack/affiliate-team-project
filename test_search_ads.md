# Test Search Ads Agent

File này dùng để chạy test riêng agent quét quảng cáo trong `app/shared/agents/search_ads`, không đi qua API chính và không ghi lịch sử vào database.

## Chạy Từ Thư Mục Server

```powershell
cd D:\MICACE\affiliate-project\server
```

## Lệnh Test Có Mở Browser

```powershell
python -m app.shared.agents.search_ads.main --keyword "adidas" --location "Vietnam" --language vi --device desktop --no-proxy --headful --slow-mo-ms 500
```

Sau khi chạy xong, kết quả đầy đủ mặc định sẽ được ghi vào file ngoài cùng project:

```text
search_ads_result.json
```

## Các Lệnh Hay Dùng

Chạy headless, không mở browser:

```powershell
python -m app.shared.agents.search_ads.main --keyword "adidas" --location "Vietnam" --language vi --device desktop --no-proxy
```

Mở browser để quan sát:

```powershell
python -m app.shared.agents.search_ads.main --keyword "adidas" --location "Vietnam" --language vi --device desktop --no-proxy --headful
```

Mở browser và làm chậm thao tác:

```powershell
python -m app.shared.agents.search_ads.main --keyword "adidas" --location "Vietnam" --language vi --device desktop --no-proxy --headful --slow-mo-ms 500
```

Mở browser, làm chậm thao tác và quay video:

```powershell
python -m app.shared.agents.search_ads.main --keyword "xm" --location "Vietnam" --language vi --device desktop --no-proxy --headful --slow-mo-ms 500 --record-video-dir ".\tmp\videos" --output ".\tmp\xm_result.json"
```

Test giao diện mobile:

```powershell
python -m app.shared.agents.search_ads.main --keyword "máy lọc nước" --location "Vietnam" --language vi --device mobile --no-proxy --headful --slow-mo-ms 500
```

## Giải Thích Các Option

`--keyword`

Từ khóa cần quét quảng cáo trên Google. Ví dụ:

```powershell
--keyword "adidas"
--keyword "máy lọc nước"
--keyword "xm trading"
```

`--location`

Khu vực tìm kiếm. Giá trị này được truyền vào state của agent để tạo ngữ cảnh tìm kiếm. Ví dụ:

```powershell
--location "Vietnam"
--location "United States"
```

`--language`

Ngôn ngữ tìm kiếm/giao diện. Ví dụ:

```powershell
--language vi
--language en
```

`--device`

Thiết bị giả lập khi mở browser. Hiện hỗ trợ:

```powershell
--device desktop
--device mobile
```

`desktop` dùng viewport và user-agent desktop. `mobile` dùng user-agent mobile để kiểm tra kết quả theo thiết bị di động.

`--no-proxy`

Tắt proxy khi test local. Nên bật option này nếu bạn chỉ muốn chạy nhanh trên máy local hoặc chưa có proxy thật.

Khi dùng `--no-proxy`, runner sẽ patch `ProxyService.get_proxy_for_location` để trả về proxy disabled. Luồng API chính không bị ảnh hưởng.

`--headful`

Mở browser có giao diện để quan sát agent đang search, click, đọc trang kết quả và lấy thông tin quảng cáo.

Không truyền `--headful` thì browser chạy headless.

`--slow-mo-ms`

Làm chậm các thao tác browser theo mili-giây. Chỉ hữu ích khi dùng cùng `--headful`.

Ví dụ:

```powershell
--slow-mo-ms 500
```

Nghĩa là mỗi thao tác browser sẽ chậm thêm khoảng 500ms, giúp dễ nhìn quá trình chạy hơn.

`--record-video-dir`

Thư mục lưu video quá trình browser chạy. Nên dùng cùng `--headful` và `--slow-mo-ms` khi cần debug selector, thao tác click, hoặc kiểm tra agent có đang click nhầm quảng cáo không.

Ví dụ:

```powershell
--record-video-dir ".\tmp\videos"
```

Video sẽ được ghi sau khi browser context đóng, thường là lúc command chạy xong.

`--output`

File JSON để lưu kết quả sau khi chạy. Nếu không truyền option này, runner sẽ tự ghi vào:

```text
search_ads_result.json
```

Ví dụ muốn ghi ra file khác:

```powershell
python -m app.shared.agents.search_ads.main --keyword "adidas" --location "Vietnam" --language vi --device desktop --no-proxy --headful --slow-mo-ms 500 --output ".\tmp\adidas_result.json"
```

## Xem Help

```powershell
python -m app.shared.agents.search_ads.main --help
```
