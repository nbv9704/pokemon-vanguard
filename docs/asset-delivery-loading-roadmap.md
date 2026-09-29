# Phân phối asset và loading — chốt local-only B48

Trạng thái: **#35 DONE**. Theo quyết định của chủ dự án ngày 30/09/2026, runtime chỉ phục vụ asset từ `app/public`; Supabase Storage/CDN và mọi cấu hình/upload tool liên quan đã được gỡ. Supabase vẫn được dùng cho account/save theo các hạng mục riêng, không dùng để phân phối hình ảnh.

## Kiến trúc đã chốt

- Mọi URL asset runtime là đường dẫn same-origin local. Không có `PUBLIC_ASSET_BASE_URL`, bucket, remote resolver hoặc request `/api/assets/config`.
- Boot hiển thị tiến độ dựa trên 11 shell asset thật; preload có timeout, deduplicate và concurrency hữu hạn, tự hạ xuống hai worker khi Save-Data/2G.
- Route tiếp tục dùng lazy module, skeleton, trạng thái lỗi và retry đã nghiệm thu ở #21. Responsive image dùng local `srcset` 1×/2× và kích thước tĩnh để tránh layout shift.
- Battle chỉ warm front/back sprite từ public battle state, không đọc nhánh bí mật, không `await` trước render/input và không làm dừng deadline server.
- Static server giữ ETag/revalidation cho URL thường và cache immutable cho tên file có content hash. Local assets vẫn nằm trong source/release để chạy offline và rollback tự nhiên.
- `public/asset-manifest.json` tiếp tục là inventory/hash gate tái lập, không phải pointer CDN. File tài liệu và extension không hỗ trợ không được đưa vào manifest runtime.

## Bằng chứng nghiệm thu

- Manifest hiện có 1.495 runtime media/93.096.206 byte, xác định bằng content hash; stale byte/path/tổng bị gate từ chối.
- Browser B44/B45 xác nhận Home local và fallback hoạt động, DPR responsive chọn đúng biến thể, không failed image/warning/error trong phạm vi đã đo.
- Hai client Ranked nhận và render state ngay cả khi warm Promise treo; decision deadline 45 giây vẫn tiến và auto-action đúng.
- Automated tests bao phủ local-only resolver, không có network config request, missing-local reporting, Save-Data concurrency, responsive local `srcset`, manifest và battle warm/deduplicate.

## Phạm vi không thuộc #35

- Quyền phân phối artwork vẫn thuộc #22. Chạy local/private không tự cấp quyền cho public release.
- Tối ưu/nâng cấp ảnh mới phải cập nhật master, responsive variants, manifest và rights inventory tương ứng.
- Nếu tương lai chủ dự án muốn dùng CDN, đó là một quyết định kiến trúc mới: phải mở hạng mục mới với provider/quota/security/rights/browser acceptance riêng; không khôi phục ngầm code đã gỡ.

## Điều kiện duy trì DONE

- Không thêm URL ảnh remote hoặc credential vào client/source.
- `npm run assets:manifest:validate`, `npm run assets:responsive:validate`, `npm run check` và regression liên quan phải đạt sau thay đổi asset.
- Loading không khóa auth hoặc input PvP khi ảnh chậm/hỏng; mọi ảnh mới có fallback local phù hợp.
