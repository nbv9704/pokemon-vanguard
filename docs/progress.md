# Aether Champions — Nhật ký triển khai

Roadmap nguồn: `ROADMAP.md`.

## M0-01 — Baseline và bảo vệ dữ liệu

- Status: DONE
- Ngày: 11/09/2026
- Runtime: Node.js 22.15.0, npm 10.9.2
- Baseline: `npm run check` đạt; `npm test` đạt 6/6 tests.
- Save: đã sao lưu bốn file JSON vào `backups/pre-m0-20260911-015222`; tất cả bản sao đọc được và SHA-256 khớp nguồn.
- Git: khởi tạo repository local; saves, backups, logs, dependencies và secrets được ignore.
- Thay đổi gameplay: không.

## M0-02 — Hợp đồng catalog và ID

- Status: DONE
- Ngày bắt đầu: 11/09/2026
- Phạm vi: schema catalog, enum dùng chung, mapping ổn định cho 36 loài, validator content và script npm.
- Kết quả: tạo contract catalog và hai JSON Schema; mapping 36 loài có 12 đơn hệ/24 song hệ; `coverageType` độc lập với hệ cơ thể.
- Validation: `npm run check` đạt; `npm test` đạt 9/9 tests. Negative tests xác nhận chặn ID trùng, type array sai, enum/effect và coverage type không hỗ trợ.
- Thay đổi gameplay: không; dữ liệu này chưa được battle engine sử dụng cho đến bước generator.

## Việc tiếp theo

- Ticket: M0-03 — generator/fragment, dev runner và legacy engine adapter.
- Điều kiện giữ nguyên: output logic phải deterministic, đúng sáu export và không làm thay đổi hành vi v1.
