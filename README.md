# Aether Champions — phát triển local

Dự án hiện chạy trực tiếp bằng Node.js trên máy, không cần Higgsfield, tài khoản Cloudflare hoặc Bun.

## Chạy game

Yêu cầu Node.js 22 trở lên. Mở terminal tại thư mục `app`:

```powershell
npm install
npm run dev
```

Mở http://localhost:3100. Hoặc nhấp đúp `start-local.cmd` ở thư mục dự án.

- Sửa HTML/CSS/JS trong `app/public`, rồi tải lại trình duyệt để xem thay đổi.
- Sửa luật trong `app/logic-src`, rồi chạy `npm run compile:logic`. Khi dùng `npm run dev`, trình biên dịch theo dõi fragment/catalog và chỉ khởi động lại máy chủ sau khi tạo được `app/src/logic.js` hợp lệ.
- Dừng bằng Ctrl+C trong terminal đang chạy máy chủ.
- Chạy `npm run start` nếu không cần tự khởi động lại.
- Máy chủ chỉ lắng nghe trên máy này, không mở truy cập từ mạng LAN.

## Lưu game

Trạng thái trò chơi lưu tại `app/.local-data/*.json`, không đưa vào Git.
Trình duyệt lưu mã người chơi để nhận lại đúng bản lưu. Hãy dùng cùng trình duyệt và cùng địa chỉ `localhost:3100` để tiếp tục chơi.
Có thể sao lưu cả thư mục `.local-data`. Bản lưu trên website cũ không tự chuyển về local.

## Kiểm tra

```powershell
npm run check
npm test
```

`npm run check` cũng xác nhận hợp đồng catalog v2 trong `app/content`: ID ổn định của 36 loài, 12 hệ, phân bổ đơn/song hệ, coverage type, asset tương ứng và các enum hiệu ứng. Có thể chạy riêng bằng `npm run check:content`. Catalog v2 hiện là dữ liệu chuẩn bị cho roadmap và chưa thay đổi gameplay v1.

Kiểm tra migration trên **một bản sao** của save, không ghi thay đổi:

```powershell
npm run migrate:save -- --dry-run --input D:\duong-dan\ban-sao-save.json
```

Storage adapter có backup/restore được kiểm thử tự động, nhưng migration v2 chưa được bật cho save thật. Các fragment `10-v2-builds.js` và `20-v2-damage.js` chứa nền build/damage v2; adventure hiện vẫn dùng luật v1 cho tới khi hoàn thành phase engine và giao diện M3.

Bộ kiểm tra local xác nhận phục vụ trang, 36 loài quái, nhận thư một lần, triệu hồi, đấu đơn/đôi, chặn người xem sửa game và giữ tiến trình sau khi khởi động lại máy chủ.

## Cấu trúc

- `app/local-server.mjs`: máy chủ HTTP/WebSocket local và lưu file.
- `app/logic-src/`: nguồn luật có thứ tự; `app/src/logic.js` là file được sinh tự động và không sửa trực tiếp.
- `app/server/legacy/logic-v1.js`: bản luật v1 đóng băng để kiểm tra tương thích và kết thúc trận cũ khi migration được bật.
- `app/public/js/store.js`, `router.js`, `net.js`: trạng thái trình duyệt, điều hướng và kết nối WebSocket được tách khỏi phần render trong `client.js`.
- `app/public/client.js`: giao diện và điều khiển.
- `app/public/art.js`: 36 hình minh họa SVG gốc.
- `app/public/style.css`: giao diện responsive.
- `app/tests/local.test.mjs`: kiểm tra tích hợp local.
- `app/package.cloud.json`, `src/room.ts`, `src/worker.ts`: bản cấu hình/cloud cũ được giữ để tham khảo; không dùng khi chạy local.

## Nội dung phiên bản đầu

36 loài quái, 12 hệ nguyên tố, mỗi loài có bốn kỹ năng và nội tại; sáu vật phẩm cầm, thời tiết, đấu đơn/đôi với AI, sáu gym, tập luyện, thư, gacha bằng tiền trong game, đội hình và cài đặt hiển thị.

Đây là bản solo với AI; chưa có đấu PvP, âm thanh hoặc hệ thống tài khoản. Không sử dụng thanh toán tiền thật. Các hình minh họa là vector tự vẽ.

## Hoạt ảnh chiến đấu

- Mỗi chiêu phát theo đúng thứ tự hành động từ máy chủ: lấy đà, tung đòn, va chạm, số sát thương và thanh máu.
- Hiệu ứng theo 12 hệ, chiêu diện rộng đánh đồng thời nhiều mục tiêu; có hồi máu, lá chắn, tăng sức mạnh, thời tiết, đổi Mon và bị hạ.
- Chọn tốc độ 1×/2× ngay trên sân đấu. Nút Skip bỏ qua phần diễn nhưng giữ nguyên kết quả đã lưu.
- Settings → Reduced motion tắt chuyển động/hạt sáng; tùy chọn giảm chuyển động của hệ điều hành cũng được tôn trọng.
- `app/public/battle-animation.js` và `.css`: bộ phát hoạt ảnh Canvas/Web Animations; `src/logic.js` xuất sự kiện và ảnh chụp trạng thái từng hành động.
- `npm test` kiểm tra đồng bộ sát thương/HP, mục tiêu đấu đôi, 12 hệ, miễn nhiễm, đỡ đòn, hồi máu, thời tiết, đổi Mon, bị hạ và tương thích bản lưu cũ.
