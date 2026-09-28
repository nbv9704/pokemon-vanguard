# B20 — Import boundary và dependency cycle gate

B20 biến hướng phụ thuộc kiến trúc thành quality gate bắt buộc. Lệnh `npm run check:imports` được chạy trong `npm run check`, nên local validation và CI đều chặn import ngược lớp, vòng phụ thuộc hoặc network I/O lọt vào mechanics.

## Contract được cưỡng chế

- `rules-v3` chỉ được nhập module trong `rules-v3`;
- `mechanics-v3` chỉ được nhập `rules-v3` hoặc `mechanics-v3`, đồng thời không được gọi `fetch()`;
- browser `public` chỉ nhập module browser `public`;
- server không nhập implementation UI; ngoại lệ duy nhất là `public/js/ui/pokemon-symbol-assets-data.js`, một bảng dữ liệu thuần dùng chung đã được review;
- mọi local import tương đối phải resolve được và toàn graph production phải không có cycle.

Phạm vi quét gồm `rules-v3`, `mechanics-v3`, `server`, `content-import`, `public` và composition root `local-server.mjs`. `server/legacy` được loại vì là implementation frozen; generated/frozen source vẫn được kiểm bằng các gate chuyên biệt hiện có.

## Hai cycle đã loại bỏ

1. Chuỗi switch/form/item từng đi từ `switch-lifecycle` qua `ability-form`, barrel `item-hooks`, `combat`, `switching` rồi quay lại. Logic item hồi HP theo ngưỡng được tách sang `item-hooks/threshold.mjs`; facade `item-hooks.mjs` vẫn export cùng API.
2. Chuỗi damage response từng đi từ `damage-hit` qua `ability-damage-response`, `hazards`, `delayed-effects` rồi quay lại. Mutation tạo hazard được tách sang `hazard-state.mjs`; `hazards.mjs` tiếp tục re-export `applyHazard` để caller cũ không đổi.

Ngoài ra `passive-effects.mjs` nhập trực tiếp state helper thay vì kéo cả barrel item-hooks. Không cycle nào được che bằng allowlist.

## Kiểm thử và cách xử lý khi gate lỗi

Chạy riêng:

`npm run check:imports`

Thông báo lỗi luôn ghi file nguồn, file đích và rule bị vi phạm; cycle in toàn đường đi. Cách sửa là chuyển contract/dữ liệu thuần xuống lớp trung lập hoặc tách trách nhiệm nhỏ, không đảo import bằng dynamic import và không thêm allowlist chỉ để gate xanh. Dynamic import chuỗi literal cũng được đưa vào graph.

Regression fixture chứng minh gate chấp nhận hướng `rules → mechanics`, từ chối import ngược và từ chối cycle. Kết quả B20: focused 32/32, full suite 1.375/1.375 trên 215 file và toàn bộ `npm run check` PASS.

## Giới hạn còn lại

Gate là phân tích tĩnh cho local import chuỗi literal; specifier động được tính lúc chạy không thể suy ra an toàn. B20 chưa hoàn tất toàn bộ roadmap #24/#25: composition root client/server/ranked còn cần tách theo trách nhiệm, và promise-aware/JSDoc/checkJs/schema-derived contracts vẫn là bước tiếp theo.
