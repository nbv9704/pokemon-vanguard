# Optimization B08 — Giới hạn tài nguyên và thời hạn I/O

## Phạm vi

Batch này tiếp tục mục #05, #10 và #14 trong Optimization Audit. Các token bucket và giới hạn kết nối **chỉ có hiệu lực trong một tiến trình Node.js**. Không coi đây là rate-limit phân tán, phòng chống DDoS hoặc nghiệm thu môi trường Internet nhiều instance. Mục #18 (khôi phục trận PvP đang đánh sau restart) vẫn chưa được thực hiện trong B08.

## Cấu hình / tác động giao thức

| Biến môi trường tùy chọn | Mặc định | Ý nghĩa |
| --- | ---: | --- |
| `PV_WS_MAX_SOCKETS_PER_IP` | 24 | Số WebSocket đang mở trên một IP transport |
| `PV_RATE_ACCOUNT_ACTIONS_10S` | 45 | Ngân sách tin nhắn mỗi tài khoản / 10 giây |
| `PV_RATE_IP_ACTIONS_10S` | 180 | Ngân sách tin nhắn mỗi IP / 10 giây |
| `PV_RATE_SOCKET_MESSAGES_10S` | 70 | Ngân sách mỗi socket / 10 giây |
| `PV_RATE_IP_UPGRADES_MIN` | 30 | Ngân sách upgrade theo IP / phút |
| `PV_RATE_INSPECTOR_MIN` | 40 | Ngân sách HTTP damage inspector theo IP / phút |

Các giới hạn dùng token bucket: có burst đến ngưỡng cấu hình và tự nạp theo thời gian. Mỗi `__ping` cũng tiêu thụ ngân sách tin nhắn để tránh bypass. Lỗi WebSocket trả `ACTION_RATE_LIMITED` cùng `retryAfterMs` (giới hạn số lần nhận, **không** kết luận action đã được ghi; không tự động replay). HTTP inspector trả 429 + `Retry-After`, kiểm trước khi đọc JSON body. Việc từ chối upgrade sử dụng HTTP 429; số socket đang mở trên IP được kiểm tra độc lập với token bucket.

IP được lấy từ `req.socket.remoteAddress`; không tin `X-Forwarded-For` do người dùng tự gửi. **Nếu chạy sau reverse proxy:** nhiều người có thể dùng chung một IP ở phía Node, ảnh hưởng quota. Cần xác định public origin/trusted proxy (#12) trước khi quyết định tin forwarded headers hoặc phân tán rate limit. Các giá trị env sai kiểu, âm hoặc vượt giới hạn sẽ khiến startup từ chối thay vì âm thầm hạ bảo vệ; không log secret.

## Supabase và proxy biểu tượng

- Toàn bộ quá trình yêu cầu Supabase, kể cả đọc body, chịu chung deadline. HTTP 409/412, lỗi hạ tầng, response JSON hỏng và response quá lớn có mã lỗi phân biệt. Timeout ghi là kết quả **có thể đã commit**, không tự retry write nếu chưa tra receipt/CAS.
- Body Supabase giới hạn 16 MiB ngay khi streaming, tránh cấp phát không giới hạn với chunked transfer. Không đưa nội dung trả về có thể chứa secret vào thông báo lỗi.
- Proxy biểu tượng chỉ nhận các đường dẫn/kho URL được allowlist, gộp concurrent fetch cùng URL, timeout mặc định 5 giây bao gồm đọc body, từ chối response lớn hơn 256 KiB, loại nội dung không phải PNG (MIME và header PNG). Lỗi upstream trả 502; timeout trả 504. Positive cache chỉ giữ tối đa tập URL biểu tượng đã allowlist trong một tiến trình.
- `HybridAdventureStorage.savePair` từ chối giao dịch hai tài khoản khác backend **trước khi ghi** với `STORAGE_PAIR_CROSS_BACKEND`. Không thay thế bằng hai `save()` riêng lẻ. Luồng Social/Ranked cần dùng cùng backend được hỗ trợ.

## Kiểm thử và giới hạn cần nghiệm thu tiếp

- Unit test: burst 1.000 tin, refill/reclaim bộ đệm hạn mức, quota độc lập socket/IP/account, đồng thời và timeout icon proxy, body Supabase treo/quá lớn/JSON hỏng, cross-backend không ghi phía nào.
- Nghiệm thu B08 chạy `npm run check` và các nhóm test không phụ thuộc `ws`. Môi trường hiện tại không truy cập được registry npm để lấy `ws@8.21.3`; các test backend/WebSocket thực tế cần chạy lại trong CI có dependency.
- Chưa có soak thực tế, shared limiter đa tiến trình, trusted proxy contract (#12), OAuth deadline, kiểm thử Supabase đang triển khai, kiểm thử sau mất điện hay phục hồi trận PvP đang diễn ra (#18). Không nâng trạng thái các mục này lên DONE khi chưa kiểm thử.
