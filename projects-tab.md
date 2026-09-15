# Tài liệu chức năng tab "Dự án"

Tài liệu này mô tả chức năng tab **Dự án** trong dashboard để một agent khác có thể triển khai lại phần này từ đầu. Phần hiện tại nằm chủ yếu ở frontend `client/components/features/dashboard/ProjectsTab.tsx` và backend `server/app/api/affiliate_data/*`.

## Mục tiêu

Tab **Dự án** giúp người dùng quản lý các affiliate link của họ, quét traffic của domain, quét thông tin dự án affiliate từ website, phát hiện quốc gia bị cấm hoặc hạn chế, gợi ý thị trường ưu tiên và tự sinh nội dung Google Search Ads.

Chức năng cần hỗ trợ:

- Lưu affiliate link theo từng user.
- Hiển thị danh sách affiliate link đã lưu.
- Xem chi tiết link đã chọn, gồm các lần quét traffic và dữ liệu dự án.
- Quét lại traffic bằng SimilarWeb.
- Quét lại thông tin dự án bằng Tavily.
- Tính readiness score cho việc chạy ads.
- Hiển thị top traffic countries, top countries theo tín hiệu web và restricted countries.
- Copy danh sách quốc gia cần loại trừ.
- Sinh và copy Google Search Ads copy gồm 15 headlines và 4 descriptions.

## Vị trí trong dashboard

Tab này là tab đầu tiên trong sidebar dashboard.

Tab id: `projects`

Label hiển thị: `Dự án`

Icon: `FolderOpen`

Route dashboard dùng query string:

```text
/dashboard?tab=projects
```

Trang dashboard cần đọc query `tab`, chọn component tương ứng và render `ProjectsTab` khi `tab=projects` hoặc khi tab mặc định là `projects`.

## Luồng người dùng

1. Người dùng mở dashboard tab **Dự án**.
2. Frontend gọi API lấy danh sách affiliate link của user hiện tại.
3. Nếu danh sách có link, tự chọn link đầu tiên.
4. Khi chọn link, frontend gọi API lấy chi tiết link đó.
5. Người dùng có thể thêm affiliate link mới.
6. Người dùng có thể bấm quét traffic hoặc quét dự án.
7. Sau mỗi lần quét thành công, frontend gọi lại detail để lấy bản ghi mới nhất đã lưu.
8. UI hiển thị insight tổng hợp từ scan mới nhất.

## Frontend state

`ProjectsTab` cần quản lý các state chính:

- `links`: danh sách affiliate link của user.
- `loadingLinks`: trạng thái đang tải danh sách link.
- `selectedLink`: link đang được chọn.
- `detail`: dữ liệu chi tiết của link đang chọn.
- `loadingDetail`: trạng thái đang tải detail.
- `scanningTraffic`: trạng thái đang quét traffic.
- `scanningProject`: trạng thái đang quét thông tin dự án.
- `showAddForm`: bật/tắt form thêm link.
- `newLinkInput`: giá trị input affiliate link mới.
- `savingLink`: trạng thái đang lưu link.
- `openEvidenceKey`: quốc gia restricted đang mở phần minh chứng.

`isBusy` nên là `scanningTraffic || scanningProject || savingLink` để disable các thao tác dễ gây trùng request.

## API frontend service

Base API dùng axios instance hiện có. Các endpoint cần có token user hiện tại nếu hệ thống dùng auth.

### Tạo affiliate link

```http
POST /affiliate-data/affiliate-link
```

Body:

```json
{
  "website": "https://example.com/ref/abc"
}
```

Response: `AffiliateLinkModel`

Hành vi:

- Chuẩn hóa URL.
- Tách domain.
- Lưu link theo user.
- Nếu user đã lưu cùng affiliate URL, trả về bản ghi cũ.

### Lấy danh sách affiliate link

```http
GET /affiliate-data/affiliate-links
```

Response: `AffiliateLinkModel[]`

Sắp xếp backend nên trả link mới cập nhật gần nhất trước.

### Lấy chi tiết affiliate link

```http
GET /affiliate-data/affiliate-link-detail?website={affiliate_url}
```

Response: `AffiliateLinkDetailResponse`

Response gồm:

- `affiliate_link`
- `traffic_scans`
- `project_data_scans`

Backend cần sort `traffic_scans` và `project_data_scans` theo `created_at` giảm dần. Frontend dùng phần tử `[0]` làm kết quả mới nhất.

### Quét traffic

```http
POST /affiliate-data/scan-traffic
```

Body:

```json
{
  "affiliate_link_id": "uuid",
  "months": 4
}
```

Response: `ScanTrafficResponse`

Hành vi:

- Kiểm tra link thuộc user hiện tại.
- Gọi SimilarWeb hoặc service tương đương để lấy traffic.
- Lưu một bản ghi scan mới vào database.
- Trả kết quả scan.

### Quét thông tin dự án affiliate

```http
POST /affiliate-data/scan-affiliate-project
```

Body:

```json
{
  "affiliate_link_id": "uuid",
  "max_results": 10,
  "search_depth": "advanced",
  "include_raw_content": true
}
```

Response: `ScanAffiliateProjectResponse`

Hành vi:

- Kiểm tra link thuộc user hiện tại.
- Tạo query từ domain và các keyword về affiliate, commission, campaign, promotion, country, region, restricted jurisdictions.
- Gọi Tavily hoặc search service tương đương, chỉ include domain của project.
- Trích xuất project name, project link, event content, sale content, top countries và restricted countries.
- Lưu một bản ghi project data scan mới vào database.

## Data models

### AffiliateLinkModel

```ts
interface AffiliateLinkModel {
  id: string;
  user_id?: string | null;
  affiliate_url: string;
  domain: string;
  raw_data?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}
```

### ScanTrafficResponse

```ts
interface ScanTrafficResponse {
  domain: string;
  url: string;
  found: boolean;
  monthly_visits: number;
  period_month: string;
  traffic_details?: TrafficDetails | null;
}
```

### TrafficDetails

```ts
interface TrafficDetails {
  global: TrafficGlobalItem[];
  country?: TrafficCountryItem[];
  source?: TrafficSourceItem;
  social?: TrafficSocialItem[];
  search_keywords?: TrafficSearchKeywordItem[];
}
```

Quan trọng nhất cho UI hiện tại là `traffic_details.country`.

```ts
interface TrafficCountryItem {
  country_code: string;
  country_name: string;
  traffic_share_percentage: number;
  total_visits_monthly: number | null;
  pages_per_visit: number;
  avg_visit_duration: number;
  bounce_rate_percentage: number;
}
```

### ScanAffiliateProjectResponse

```ts
interface ScanAffiliateProjectResponse {
  website: string;
  domain: string;
  query: string;
  project_name?: string | null;
  project_link?: string | null;
  event_content?: string | null;
  sale_content?: string | null;
  restricted_countries: RestrictedCountryInsight[];
  top_countries: TopCountryInsight[];
  answer?: string | null;
  results: Array<Record<string, unknown>>;
}
```

### RestrictedCountryInsight

```ts
interface RestrictedCountryInsight {
  country: string;
  restriction_type: "banned" | "restricted";
  signals: string[];
  evidence_links?: Array<{
    title?: string | null;
    url?: string | null;
    snippet?: string | null;
  }>;
  confidence?: "high" | "medium" | "low";
  verification_note?: string | null;
}
```

### TopCountryInsight

```ts
interface TopCountryInsight {
  country: string;
  signal_score: number;
  signals: string[];
}
```

### AffiliateLinkDetailResponse

```ts
interface AffiliateLinkDetailResponse {
  affiliate_link: AffiliateLinkModel;
  traffic_scans: AffiliateLinkTrafficModel[];
  project_data_scans: AffiliateLinkProjectDataModel[];
}
```

## Database

Cần 3 bảng chính.

### `affiliate_links`

Các trường:

- `id`
- `user_id`
- `affiliate_url`
- `domain`
- `raw_data`
- `created_at`
- `updated_at`

Ràng buộc unique:

```text
(user_id, affiliate_url)
```

### `affiliate_link_traffic_scans`

Các trường:

- `id`
- `affiliate_link_id`
- `found`
- `monthly_visits`
- `period_month`
- `traffic_details` dạng JSON
- `raw_data` dạng JSON
- `created_at`
- `updated_at`

Quan hệ:

```text
affiliate_link_id -> affiliate_links.id
```

Xóa affiliate link thì xóa cascade scan liên quan.

### `affiliate_link_project_data_scans`

Các trường:

- `id`
- `affiliate_link_id`
- `query`
- `project_name`
- `project_link`
- `event_content`
- `sale_content`
- `restricted_countries` dạng JSON
- `top_countries` dạng JSON
- `answer`
- `results` dạng JSON
- `raw_data` dạng JSON
- `created_at`
- `updated_at`

Quan hệ:

```text
affiliate_link_id -> affiliate_links.id
```

## Thuật toán backend

### Chuẩn hóa URL

Khi user nhập website:

1. Trim input.
2. Nếu không có `http://` hoặc `https://`, thêm `https://`.
3. Parse host và path.
4. Host phải có dấu `.`.
5. Lowercase host.
6. Rebuild URL dạng:

```text
https://{host}{path}
```

7. Bỏ dấu `/` cuối.

Domain được tách từ URL, bỏ prefix `www.`.

### Quét project insight

Query Tavily nên gồm domain và keyword:

```text
{domain} affiliate program commission rate payout referral terms percentage fixed amount project campaign event sale promotion discount coupon headquarters branch office languages countries regions locales restricted countries banned countries prohibited jurisdictions unavailable regions
```

Tham số gợi ý:

- `search_depth`: mặc định `advanced`
- `max_results`: mặc định `10`, tối đa `20`
- `include_answer`: `true`
- `include_raw_content`: `true`
- `include_domains`: `[domain]`

### Chọn project link tốt nhất

Từ Tavily results, chọn item có điểm cao nhất dựa trên:

- URL chứa keyword ưu tiên: `affiliate`, `partner`, `program`, `referral`, `commission`, `terms`, `promotion`, `sale`.
- `score` từ search result nếu có.

Project link là `url` của result tốt nhất.

Project name lấy từ `title` của result tốt nhất:

- Split title theo ` - `, ` | ` hoặc ` : `.
- Bỏ các phần chứa token chung như `affiliate`, `program`, `commission`, `referral`, `terms` hoặc domain.
- Lấy phần còn lại đầu tiên.

### Trích event và sale content

Ghép `answer`, `content` và `raw_content` từ results thành `combined_text`.

`event_content`: lấy câu đầu tiên chứa một trong các keyword:

```text
event, campaign, launch, webinar, conference, promotion
```

`sale_content`: lấy câu đầu tiên chứa một trong các keyword:

```text
sale, discount, coupon, offer, deal, %, off
```

Mỗi câu nên giới hạn tối đa 500 ký tự.

### Tính top countries từ tín hiệu web

Quét `answer`, `title`, `content`, `raw_content` để tạo `top_countries`.

Các nhóm signal:

- Text mention: nếu text chứa alias quốc gia, cộng 2 điểm.
- ccTLD trong URL: nếu URL có đuôi quốc gia như `.vn`, `.jp`, `.sg`, cộng 3 điểm.
- hreflang: nếu text có pattern như `hreflang=en-US`, `vi-VN`, cộng 3 điểm theo country code.
- Headquarters hoặc branch mention: nếu câu có `headquarter`, `head office`, `based in`, `branch`, `office in` kèm alias quốc gia, cộng 4 điểm.

Sort giảm dần theo `signal_score`, lấy top 5.

### Phát hiện restricted countries

Quét `answer`, `title`, `content`, `raw_content` để tìm câu hoặc đoạn có country alias và restriction keyword.

Restriction keyword gồm các nhóm như:

```text
banned, prohibited, not allowed, not accepted, not available, unable to offer, do not extend our services, cease operations, unavailable, excluded, blocked, restricted, cannot participate, cannot purchase, ineligible
```

Nếu context chứa keyword cứng như `banned`, `prohibited`, `not allowed`, đánh `restriction_type = "banned"`, còn lại là `"restricted"`.

Mỗi country trả về:

- `country`
- `restriction_type`
- `signals`: các đoạn context tìm được
- `evidence_links`: title, url, snippet nếu context đến từ result có URL
- `confidence`: `medium` nếu có evidence link, `low` nếu chỉ suy luận từ answer/tóm tắt
- `verification_note`: nhắc người dùng mở nguồn kiểm tra lại

## Thuật toán frontend

### Chuyển detail thành kết quả mới nhất

`trafficResult` lấy từ:

```ts
detail.traffic_scans[0]
```

Map thành `ScanTrafficResponse`.

`projectResult` lấy từ:

```ts
detail.project_data_scans[0]
```

Map thành `ScanAffiliateProjectResponse`.

Nếu chưa có scan thì trả `null`.

### Top traffic countries

Từ `trafficResult.traffic_details.country`:

1. Sort giảm dần theo `traffic_share_percentage`.
2. Lấy top 5.

### Kiểm tra quốc gia bị restricted

Một traffic country được xem là restricted nếu tên quốc gia khớp hoặc gần khớp với `restricted_countries.country`.

Logic khớp:

```ts
restricted === normalized ||
restricted.includes(normalized) ||
normalized.includes(restricted)
```

### Launch insight

Từ `projectResult` và `trafficResult`, tính:

- `priorityCountries`: top traffic countries không bị restricted, lấy tối đa 4.
- `excludedTrafficCountries`: top traffic countries bị restricted, lấy tối đa 4.
- `hasOffer`: có `event_content` hoặc `sale_content`.
- `hasRestrictions`: có `restricted_countries`.
- `hasTraffic`: `monthly_visits > 0`.
- `hasPriorityCountries`: có priority countries.

Readiness score:

```text
+30 nếu monthly visits >= 100000
+18 nếu có traffic nhưng dưới 100000
+25 nếu có priority countries
+20 nếu có event hoặc sale content
+15 nếu có restricted countries
+10 nếu có project link
-10 nếu có top traffic country bị restricted
clamp 0..100
```

Checks hiển thị:

- Market ưu tiên
- Loại trừ địa lý
- Offer để chạy ads
- Rủi ro traffic bị loại

Mỗi check có status:

```ts
"good" | "warn" | "missing"
```

### Evidence links

Khi country có `evidence_links`, dùng trực tiếp.

Nếu không có, frontend có thể fallback bằng cách quét `projectResult.results`:

1. Text phải chứa tên country.
2. Text phải chứa restriction token như `restricted`, `banned`, `prohibited`, `not available`, `ineligible`, `not allowed`.
3. Result phải có `url`.
4. Tạo snippet quanh vị trí country, tối đa khoảng 300 ký tự.
5. Deduplicate theo URL, lấy tối đa 3 link.

### Sinh Google Search Ads copy

Input: `projectResult`.

Brand:

- Ưu tiên `project_name` nếu có và dài tối đa 22 ký tự.
- Nếu không có, lấy subdomain chính từ domain, bỏ `www.`.
- Title case brand.

Trích phrase:

- Ghép `project_name`, `answer`, `event_content`, `sale_content`, và title/content/raw_content từ results.
- Dùng regex để lấy cụm từ nổi bật, số liệu như `%`, `USDT`, `USD`, `APR`, `x`, và các cụm như `copy trading`, `affiliate program`, `referral program`, `commission rate`, `sign up bonus`.
- Bỏ phrase quá ngắn, quá dài hoặc phrase chung như `Privacy Policy`, `Terms Of Use`, `Log In`, `Sign Up`.
- Deduplicate, giới hạn khoảng 24 phrase.

Nhận diện ngữ cảnh:

- Crypto: có `crypto`, `bitcoin`, `btc`, `usdt`, `trading`, `futures`, `exchange`, `token`.
- Affiliate: có `affiliate`, `partner`, `referral`, `commission`.
- Bonus: có `bonus`, `reward`, `campaign`, `promotion`, `offer`, `event`, `earn`.
- Copy trading, futures, spot, earn, app, security, support tương tự theo keyword.

Headlines:

- Sinh candidate từ brand và context.
- Lọc candidate không phù hợp với context. Ví dụ nếu không có futures thì bỏ headline có `Futures`.
- Mỗi headline tối đa 30 ký tự.
- Deduplicate.
- Lấy 15 headline.

Descriptions:

- Sinh 4 description.
- Mỗi description tối đa 90 ký tự.
- Nội dung nên nhắc sign up, offer, eligibility, terms, official resources, regions.

UI cần hiển thị số ký tự dạng `{length}/30` cho headline và `{length}/90` cho description.

## UI layout đề xuất

Giao diện nên chia 2 cột trên desktop:

- Cột trái: danh sách affiliate links và form thêm link.
- Cột phải: detail, actions, traffic/project insight.

Trên mobile, stack theo chiều dọc.

Các vùng chính:

1. Header tab với title và nút thêm link.
2. Sidebar nội bộ hoặc panel danh sách link.
3. Empty state khi chưa có link.
4. Form thêm link.
5. Detail header của selected link.
6. Action buttons:
   - Quét lại Traffic
   - Quét lại Dự án
7. Traffic summary:
   - Monthly visits
   - Period month
   - Top traffic countries
8. Launch insight:
   - Readiness score
   - Market ưu tiên
   - Cần tránh
   - Checks
9. Thông tin dự án:
   - Project name
   - Project link
   - Event content
   - Sale content
10. Restricted countries:
   - Country name
   - Badge `Cấm` hoặc `Hạn chế`
   - Confidence
   - Nút mở minh chứng
   - Nút copy danh sách loại trừ
11. Top 5 quốc gia theo tín hiệu web.
12. Google Search Ads copy:
   - 15 headlines
   - 4 descriptions
   - Copy từng dòng
   - Copy toàn bộ

## Loading, error và toast

Cần có toast cho các hành động:

- Thêm link thành công.
- Thêm link thất bại.
- Quét traffic thành công.
- Quét traffic thất bại.
- Quét dự án thành công.
- Quét dự án thất bại.
- Copy thành công.
- Copy thất bại nếu Clipboard API lỗi.

Loading state:

- Khi tải danh sách link: skeleton hoặc message đang tải.
- Khi tải detail: spinner trong panel detail.
- Khi scan traffic/project: disable nút và hiển thị spinner.
- Khi save link: disable form submit.

## Auth và phân quyền

Mọi endpoint phải dùng current user.

Backend không được cho user lấy hoặc quét link của user khác. Các thao tác scan phải kiểm tra `affiliate_link_id` thuộc `current_user.id`.

## Lỗi backend cần xử lý

- `400`: website không hợp lệ hoặc affiliate link không thuộc user.
- `404`: không tìm thấy detail cho affiliate link.
- `500`: lỗi quét traffic.
- `502`: search provider trả HTTP error.
- `503`: lỗi mạng, hết quota key hoặc provider không sẵn sàng.

Frontend nên hiển thị thông báo ngắn bằng toast và không làm mất dữ liệu cũ đang hiển thị.

## Checklist triển khai lại

- Tạo model/database cho affiliate links, traffic scans, project data scans.
- Tạo schema request/response đúng với các interface ở trên.
- Tạo API create/list/detail/scan traffic/scan project.
- Tạo service normalize URL và extract domain.
- Tích hợp SimilarWeb hoặc service traffic tương đương.
- Tích hợp Tavily hoặc search service tương đương.
- Implement thuật toán chọn project link, event, sale, top countries, restricted countries.
- Implement frontend service gọi API.
- Implement tab `projects` trong dashboard sidebar và route query `?tab=projects`.
- Implement `ProjectsTab` với list, add form, detail, scan actions, insight, restricted countries và ad copy.
- Đảm bảo scan mới nhất nằm đầu mảng trong detail response.
- Test với link mới, link đã tồn tại, link không hợp lệ, scan traffic, scan project, user không sở hữu link.

## Ghi chú rủi ro

Các kết quả restricted countries và top countries là suy luận tự động từ dữ liệu web. UI phải thể hiện rõ đây không phải kết luận pháp lý tuyệt đối và nên cung cấp evidence link để người dùng tự kiểm tra Terms of Use, eligibility, restricted jurisdictions hoặc supported countries của dự án trước khi ra quyết định quan trọng.
