# Aether Champions — Nhật ký triển khai

Roadmap nguồn: `ROADMAP.md`.

## M0-01 — Baseline và bảo vệ dữ liệu

- Status: DONE
- Ngày: 11/09/2026
- Runtime: Node.js 22.15.0, npm 10.9.2
- Baseline: `npm run check` đạt; `npm test` đạt 6/6 tests.
- Save: đã sao lưu bốn file JSON vào `backups/pre-m0-20260911-015222`; tất cả bản sao đọc được và SHA-256 khớp nguồn.
- Git: khởi tạo repository local; saves, backups, logs, dependencies và secrets được ignore.
- Checkpoint baseline: `514a47b` (`chore: establish local roadmap baseline`).
- Thay đổi gameplay: không.

## M0-02 — Hợp đồng catalog và ID

- Status: DONE
- Ngày bắt đầu: 11/09/2026
- Phạm vi: schema catalog, enum dùng chung, mapping ổn định cho 36 loài, validator content và script npm.
- Kết quả: tạo contract catalog và hai JSON Schema; mapping 36 loài có 12 đơn hệ/24 song hệ; `coverageType` độc lập với hệ cơ thể.
- Validation: `npm run check` đạt; `npm test` đạt 9/9 tests. Negative tests xác nhận chặn ID trùng, type array sai, enum/effect và coverage type không hỗ trợ.
- Checkpoint chứa triển khai: `514a47b`.
- Thay đổi gameplay: không; dữ liệu này chưa được battle engine sử dụng cho đến bước generator.

## M0-03 — Generator, dev runner và legacy engine

- Status: DONE
- Ngày: 11/09/2026
- Nguồn luật: `app/logic-src/manifest.json` liệt kê fragment theo thứ tự; `app/src/logic.js` là artifact sinh deterministic có source hash.
- Legacy: `app/server/legacy/logic-v1.js` đóng băng từ logic v1 trước generator; không dùng làm nơi phát triển luật v2.
- An toàn build: syntax được kiểm trên file tạm rồi mới atomic rename; test xác nhận fragment lỗi không thay bản build hợp lệ cuối.
- Dev: `npm run dev` compile trước khi mở server, theo dõi `logic-src` và `content`, debounce 150 ms; server Node watch chỉ nhận artifact hợp lệ.
- Contract: checker từ chối export ngoài đúng sáu tên được phép.
- Validation: `npm run check` đạt; `npm test` đạt 11/11; parity test bao phủ setup, claim, summon, team, double battle và một turn/event.
- Runtime smoke: dev runner mở thành công trên cổng tạm 55273 và dừng được; server chính tại `127.0.0.1:3100` vẫn trả HTTP 200.
- Thay đổi gameplay/save: không.

## M0-04 — Tách client store, network và router

- Status: DONE
- Ngày: 11/09/2026
- Store: `public/js/store.js` quản lý player identity, room và settings; settings JSON lỗi được phục hồi an toàn.
- Router: `public/js/router.js` là nguồn duy nhất cho chín màn hình và từ chối route không khai báo.
- Network: `public/js/net.js` quản lý join, heartbeat, reconnect, parse frame và gửi action; `client.js` chỉ xử lý state/UI.
- Validation tự động: `npm run check` đạt; `npm test` đạt 14/14, gồm store/router/network module tests.
- Browser QA: room test riêng tải Home, mở Battle Arena, bắt đầu Single Battle, resolve lượt 1 sang lượt 2 có animation, rồi điều hướng Settings; console 0 error/warning.
- Save/gameplay/UI: không đổi schema hoặc luật; room test tách riêng khỏi adventure chính.

## Việc tiếp theo

- Ticket: M0-05 — storage adapter, migration pure function, fixture v1/v2 và dry-run/restore flow.
- Migration ở M0-05 chưa được tự động áp vào save người dùng; chỉ kiểm tra trên bản copy tới khi M3 bật engine v2.
