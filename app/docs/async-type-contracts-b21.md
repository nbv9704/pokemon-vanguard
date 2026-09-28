# B21 — Promise safety và type-contract foundation

B21 bổ sung type-aware quality gates cho server local mà không rewrite dự án sang TypeScript. Các công cụ là dev dependency chạy cục bộ/CI, không gọi API hay dịch vụ trả phí và không đi vào runtime release.

## Promise gate

ESLint dùng TypeScript program riêng từ `tsconfig.async.json` trên `local-server.mjs` và 81 module `server/**/*.mjs` đang hoạt động; `server/legacy` frozen vẫn bị loại theo contract dự án. Ba rule bắt buộc:

- `@typescript-eslint/no-floating-promises`: Promise phải được await, kết thúc bằng rejection handler hoặc được đánh dấu `void` có chủ đích;
- `@typescript-eslint/no-misused-promises`: không truyền async callback vào API chỉ nhận callback trả `void`;
- `@typescript-eslint/await-thenable`: không `await` giá trị không phải Promise/thenable.

Lần chạy đầu phát hiện ba điểm:

1. `http.createServer()` nhận trực tiếp async callback dù Node không chờ Promise trả về;
2. signal handler `SIGINT`/`SIGTERM` trả Promise cho `process.on()` và không có rejection path rõ;
3. Promise do `.finally()` trong `AccountCoordinator` tạo ra không được xử lý tường minh.

HTTP handler nay được bọc bằng callback đồng bộ và gọi `void handleHttp(...)`; chính handler tiếp tục bắt toàn bộ lỗi request. Signal handler gọi close có success/rejection path; coordinator đánh dấu fire-and-forget có chủ đích sau khi work rejection đã được chuyển tới caller.

## Type-contract foundation

`types/runtime-contracts.d.ts` định nghĩa nền tảng cho JSON value, Save, Command Action, Command Result, Storage Port và public state DTO. `tsconfig.contracts.json` dùng `allowJs + checkJs`, `strict`, `noUncheckedIndexedAccess` và `exactOptionalPropertyTypes` trên lát cắt đầu tiên:

- `receipt-command-handler.mjs`: generic contract cho account, durable load/persist, action và success/failure result;
- `serial-task-queue.mjs`: generic work result, queue timestamps, snapshot và idle promise.

`npm run check:types` nằm trong `npm run check`. Khi mở rộng, phải thêm module vào `tsconfig.contracts.json`, bổ sung JSDoc/import type ở biên dữ liệu, sửa hết diagnostics rồi mới tăng phạm vi; không dùng `any` hoặc tắt strict chỉ để gate xanh.

## Xác minh

- `npm run lint`: PASS với promise-aware rules trên 82 module/root server;
- `npm run check:types`: PASS;
- focused coordinator/queue/receipt/shutdown: 16/16 PASS;
- `npm run check`: PASS;
- full regression: 1.375/1.375 PASS trên 215 file, 0 fail/skip/todo;
- `npm audit`: 0 vulnerability sau khi thêm dev dependencies.

## Giới hạn còn lại

Type-check strict mới bao phủ contract lõi đầu tiên, chưa toàn bộ Save/DTO/storage implementations và browser action envelope. TypeScript tĩnh không thay runtime validation tại HTTP/WebSocket/save/content boundaries. Roadmap #25 vì vậy tiếp tục `IN PROGRESS`.
