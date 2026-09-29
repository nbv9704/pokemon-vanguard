# Roadmap phân phối asset và loading — bổ sung sau B43

Trạng thái sau B44: #35 IN PROGRESS. 35A và 35B hoàn tất; browser slow/503 đã xác nhận progress và local fallback. 35C có preload battle không khóa timer cùng session circuit breaker, còn offline/cache/DPR và PvP two-client; 35D chưa có CDN thật. Chưa chuyển asset lên dịch vụ ngoài hoặc mở gói trả phí.

## Quyết định kiến trúc

Thêm **#35 — Phân phối asset và loading theo nhu cầu**, P1 trước khi bật CDN cho người chơi. #22 tiếp tục sở hữu tối ưu ảnh, manifest ảnh, DPR và kiểm kê quyền sử dụng. #35 sở hữu resolver local/CDN, manifest phân phối, boot/route/battle loading, cache và rollout. Kế thừa #20 cache HTTP, #21 lazy modules/catalog, #31 accessibility; giữ nguyên nghiệm thu đã DONE của các mục đó.

Ưu tiên triển khai loader chạy với asset local trước. Backend phân phối là cấu hình, không hardcode Supabase URL vào từng view. Supabase Storage public bucket là ứng viên thử nghiệm đầu vì dự án đang dùng Supabase; chỉ chọn chính thức sau khi đo dung lượng, lượt tải cold/warm và quota hiện có. Public CDN không có nghĩa là không giới hạn hoặc luôn miễn phí. R2 là phương án thay thế khi số đo phù hợp hơn, không mở subscription chỉ để thực hiện kế hoạch này.

Giữ HTML/CSS/JS, catalog và fallback thiết yếu trên origin ứng dụng trong giai đoạn đầu. Chỉ đưa ảnh/sprite/âm thanh dạng file thực sự có trong inventory sang asset origin. Hiệu ứng tạo bằng code/CSS không được tính thành file cần download. Giữ nguyên artwork, kích thước và đường dẫn local của 39 icon dự án mà người dùng đã chọn.

## Thứ tự thực hiện

1. **35A — DONE trong B44: inventory, manifest và resolver local.** Đã đo 1.496 file/93.097.328 byte, sinh manifest fingerprint và đưa các nhóm ảnh động chính qua resolver; local vẫn là mặc định.
2. **35B — DONE trong B44: boot và route loading.** Boot có tiến độ theo công việc thật, timeout/fallback/accessibility; route skeleton/retry kế thừa contract #21/#31 và không tải manifest lớn trong critical path.
3. **35C — IN PROGRESS: chuẩn bị battle và cache.** B44 đã warm/deduplicate sprite từ state battle công khai mà không khóa input; browser với CDN 503 trễ đã chuyển 11/11 icon về local và circuit breaker ngăn retry lặp. Còn kiểm tra offline/cache eviction, DPR, reconnect và deadline PvP bằng hai client.
4. **35D — thử CDN có kiểm soát và rollout.** Chọn nhà cung cấp bằng số đo, upload một release bất biến, xác minh CORS/cache/hash/chi phí, thử client rồi mới chuyển cấu hình mặc định. Đóng #35 khi cả 35A–D đạt; nếu chưa có hạ tầng thì ghi rõ phần còn thiếu, không coi bản local là đã nghiệm thu CDN.
5. Tiếp tục #09 rồi #08; #02/#04 vẫn giữ ưu tiên xử lý khi phát hiện vấn đề toàn vẹn dữ liệu. #22 đóng riêng khi nghiệm thu ảnh/quyền sử dụng còn lại hoàn tất; #18 vẫn DEFERRED.

Các nhãn 35A–D là checkpoint trong một mục lớn, không phải bốn mục DONE độc lập hay số batch B44–B47 đã cam kết.

## Hợp đồng triển khai

### 35A — inventory và manifest

- Kiểm kê asset runtime đang được tham chiếu, tách master/source khỏi bản gửi tới browser; đo tổng byte và byte cần cho boot/Home/Battle.
- Manifest có `version`, asset ID ổn định, đường dẫn tương đối, SHA-256, byte size, MIME, kích thước ảnh, nhóm tải, mức thiết yếu và fallback. URL file dùng hash; chỉ manifest/pointer được revalidate.
- Một resolver dùng base URL đã cấu hình và danh sách host cho phép; kiểm mọi đường tham chiếu HTML/CSS/srcset/JS. Local mode vẫn chạy được khi không có CDN.
- Phân phối bản 1×/2× đã có theo nhu cầu; không thay artwork gốc hoặc giải mã toàn bộ sprite vào RAM.
- Upload đầy đủ và xác minh hash trước khi publish manifest. Giữ release cũ đủ lâu cho client đang chơi; không đổi manifest giữa trận.

### 35B — giao diện loading

- Boot hiển thị logo, trạng thái và progress bar khi biết tổng công việc. Bắt đầu bằng shell/cấu hình/phiên/catalog; sau khi biết đội hình mới chốt nhóm asset Home. Giai đoạn chưa biết tổng dùng trạng thái chờ, không bịa phần trăm.
- Đăng nhập được hiển thị sớm khi chưa có phiên; không chờ asset theo tài khoản trước khi biết tài khoản. Hiển thị lỗi xác thực riêng với lỗi tải ảnh.
- Chỉ vào màn chơi khi logic/catalog/state cần thiết đã sẵn sàng. Ảnh thiếu có thể dùng fallback; hiển thị Home rồi tải phần còn lại theo route.
- Progress ghi rõ đang đo số tài nguyên sẵn sàng hay byte truyền. Không dùng byte size manifest làm số byte mạng đã tải. Nguồn cache/response không có kích thước đo được dùng số file; hoàn tất ảnh sau load/decode, không chỉ sau fetch headers.
- Chuyển route dùng skeleton giữ kích thước và focus ổn định. Deduplicate request, ưu tiên route hiện tại, hủy công việc không còn cần; prefetch nền concurrency thấp và nhường khi mạng yếu/Save-Data.
- Timeout hữu hạn, retry tối đa có backoff và nút thử lại; asset trang trí lỗi chuyển fallback; catalog/logic lỗi có màn báo lỗi rõ. Không có loading vô hạn hoặc thời gian chờ cố ý để chạy animation.
- `role=progressbar`, accessible name, `aria-valuenow` chỉ khi xác định; aria-live cập nhật theo giai đoạn, reduced motion và bàn phím hoạt động.

### 35C — battle readiness và cache

- **Bằng chứng hiện tại:** `app/server/pvp-lifecycle.mjs` có preview 90 giây và decision 45 giây. Ranked gọi `syncPvpDecisionClock` ngay lúc ghép trận; Friendly gọi khi guest join. Client loading không dừng các timer này.
- PvE: preload trước command bắt đầu; dùng asset roster và biến thể có thể xuất hiện (Mega/transform nếu áp dụng); fallback trình bày vẫn dùng được nếu thiếu ảnh/âm thanh.
- PvP: chuẩn bị UI battle, fallback và asset đội mình trước queue/join. Khi ghép được đối thủ, tải ưu tiên sprite roster công khai của đối thủ; giữ preview và lựa chọn lượt khả dụng. Không đợi hết hiệu ứng/âm thanh hoặc che màn hình trong lúc deadline đang chạy. Không gửi move/loadout bí mật của đối thủ chỉ để preload.
- Reconnect vào trận đang chạy phải render state và deadline ngay bằng fallback; không bắt tải lại một battle pack rồi mới cho thao tác. Asset readiness là trạng thái trình bày, không phải xác nhận gameplay từ client.
- Nếu muốn loading đối xứng bắt buộc trước PvP về sau, phải thiết kế phase PREPARING do server quản lý, deadline hữu hạn, readiness idempotent, disconnect/timeout/abuse rules và kiểm #04/#18; không ngầm sửa timer trong #35 phiên bản đầu.
- Ưu tiên HTTP cache cho URL bất biến (`public, max-age=31536000, immutable`). Cache Storage/Service Worker bổ sung cho nhóm file được kiểm soát khi cần; không cache auth, save, admin response hoặc cookie.
- Cache có giới hạn byte/version, xử lý quota/eviction/private mode bằng fallback network. Browser có thể xóa cache; không hứa lần hai luôn tức thì hoặc chơi offline, vì server vẫn giữ gameplay/save authoritative.
- CORS phải hỗ trợ fetch kiểm hash; response lỗi/HTML giả ảnh/hash sai không được đánh dấu ready. Không đưa service key vào browser. Âm thanh tuân thủ thao tác người dùng để mở autoplay.

### 35D — provider và phát hành

- Trước khi chọn provider: ghi tổng GB, cold-start MB, warm-start transferred bytes, lượt mở/tháng dự kiến và requests sau cache; đối chiếu cả storage, egress, operation quotas và hành vi vượt quota của gói tài khoản thực tế.
- Supabase public bucket có CDN nhưng vẫn có quota; Smart CDN thuộc Pro trở lên. Không mặc định khả năng Pro có sẵn trên Free. R2 cũng có hạn mức storage/operations dù egress trực tiếp miễn phí.
- Cấu hình GET/HEAD/CORS, MIME và immutable cache cho hash URL; manifest dùng revalidation. Không thêm runtime proxy tải lại mọi ảnh qua server game.
- CI xác minh manifest/file/hash và asset bundle riêng. Giữ full-source/local release hiện có; profile CDN có thể bỏ file runtime nặng khi manifest trỏ tới release đã xác minh. Khôi phục cấu hình về local là đường rollback ban đầu.
- Chưa xóa asset khỏi Git trong đợt loader. Chỉ tách binary khỏi checkout chính sau khi có kho master/versioned bundle và quy trình download theo hash để local dev/CI/release tái lập được. Xóa khỏi HEAD không giảm lịch sử Git; rewrite history là quyết định riêng.
- Tuỳ chọn tải toàn bộ và hỗ trợ offline hoàn chỉnh để sau; không đưa vào boot mặc định.

## Nghiệm thu để đóng #35

| Nhóm | Bằng chứng cần có |
| --- | --- |
| Manifest/resolver | Local/CDN cùng nội dung; thiếu/tamper/hash sai fail đúng; không còn đường asset nặng bỏ qua resolver trong phạm vi chuyển đổi |
| Boot/routes | Cold/warm trên desktop/mobile DPR1/2; byte khởi động, time-to-interactive, CLS; skeleton/focus/retry đúng; không tải toàn inventory trước Home |
| Lỗi và cache | CDN 404/5xx/timeout/CORS lỗi; mất mạng; cache bị xóa/quota đầy; cập nhật version khi tab cũ còn mở; rollback local |
| Battle | PvE/PvP/Single/Double/Mega/reconnect; mạng chậm không khóa input khi timer đang chạy; không leak loadout, không duplicate action |
| Phát hành | Bucket/release thật được kiểm tra từ browser; manifest hash, immutable headers, clean-source/local smoke và hosted CI đạt |
| Chi phí | Báo cáo inventory và traffic dự kiến đối chiếu quota thật; ghi lựa chọn provider, giới hạn và cách theo dõi |

Chốt performance budget sau baseline 35A, trước khi triển khai 35B. Không cam kết “vài giây” khi chưa đo mạng/thiết bị; lấy median/p95 cùng điều kiện đo, so local và CDN. Chạy test sau batch đủ lớn; mỗi checkpoint ghi bằng chứng và phần thiếu vào hai tracker, chỉ nâng #35 DONE khi toàn bộ acceptance đạt.

## Tài liệu provider dùng để quyết định khi triển khai

- [Supabase Storage CDN](https://supabase.com/docs/guides/storage/cdn/fundamentals)
- [Supabase Smart CDN và browser cache](https://supabase.com/docs/guides/storage/cdn/smart-cdn)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)

Quota và giá cần được kiểm tra lại tại thời điểm rollout, không coi số liệu tư vấn là bảo đảm chi phí.
