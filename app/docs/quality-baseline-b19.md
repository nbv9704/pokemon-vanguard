# B19 — Baseline chất lượng mã nguồn

## Mục tiêu

B19 đưa lint thành một quality gate bắt buộc cho JavaScript/MJS đang được phát hành. Gate chạy bằng `npm run lint` và nằm trong `npm run check`, do đó cả local validation lẫn GitHub Actions đều chặn commit có lỗi lint.

ESLint, `@eslint/js` và `globals` chỉ là `devDependencies`, dùng lúc phát triển/CI, không chạy cùng game server và không yêu cầu dịch vụ trả phí. ESLint 10 yêu cầu Node `^22.13.0` trong nhánh Node 22, nên package contract được nâng từ `>=22` lên `>=22.13.0`.

## Phạm vi

`eslint.config.js` áp dụng cấu hình recommended và các guard bổ sung cho toàn bộ `.js`/`.mjs` đang được hỗ trợ, với global tách riêng:

- Node: server, rules, mechanics, importer và script vận hành;
- Browser: `public/**`;
- lỗi bị chặn: reference/import/biến local không dùng, biểu thức nhị phân hằng sai, escape vô nghĩa, assignment vô nghĩa, promise executor trả giá trị và các lỗi correctness trong ESLint recommended;
- empty `catch` được phép vì một số browser/storage capability probe cố ý bỏ qua lỗi;
- `require-atomic-updates` không bật: command queue của dự án tuần tự hóa mutation trên object room đã capture, khiến rule này báo false positive;
- tham số hook/API chưa dùng được giữ để ổn định contract; import và local variable vẫn strict.

Các ngoại lệ đều được ghi trực tiếp trong config:

- `src/**`: bundle sinh từ nguồn và đã được `compile-logic --verify` kiểm tra;
- `logic-src/**`: fragment dùng chung scope sau khi compiler ghép, không phải module độc lập;
- `server/legacy/**`: compatibility snapshot đóng băng;
- `tests/**`: được parse và chạy bởi test gate riêng; baseline B19 nhắm mã phát hành;
- `scripts/build.mjs`: entry Bun/Workers lịch sử;
- dependency, artifact build và candidate data không phát hành.

Không miễn toàn bộ server, mechanics, UI hoặc scripts đang hoạt động.

## Sửa lỗi từ baseline

Lần chạy đầu trên toàn repo báo 262 lỗi, phần lớn do lint các fragment/generated/frozen như module độc lập và do rule concurrency không phù hợp. Sau khi chia đúng boundary, còn 47 lỗi thật; B19 đã xử lý hết bằng cách xóa import/local/assignment chết, giữ nguyên side effect và bổ sung `cause` cho lỗi JSON/generator.

Quan trọng nhất, lint phát hiện năm passive Ability handler được import nhưng chưa nằm trong `HANDLER_DEFINITIONS`:

- `field-type-damage-aura`;
- `contact-protection-pierce`;
- `parental-bond`;
- `opponent-switch-trap`;
- `entry-terrain`.

Các declaration này đã được đăng ký lại. Regression hiện có trực tiếp bao phủ Mega field aura, Protect pierce, Parental Bond, Shadow Tag và entry terrain.

## Cách chạy và tiêu chí đạt

```powershell
cd D:\Mon\PokemonVanguard\app
npm ci
npm run lint
npm run check
npm test
```

Đạt khi cả ba gate không có error/warning/failure. Nếu thêm lớp source mới, phải khai báo đúng Node/Browser global; không mở rộng ignore chỉ để làm gate xanh.

## Phần còn lại của mục #25

B19 hoàn tất lint baseline nhưng chưa tuyên bố type safety toàn dự án. Các bước sau vẫn còn:

1. import-boundary/cycle gate cho `rules → mechanics → server` và ngăn server phụ thuộc renderer UI;
2. promise/async contract chuyên biệt (missing await/floating promise) ở storage, settlement và command dispatch;
3. JSDoc/checkJs hoặc schema-derived type cho Command, Result, Save, DTO và Storage, với Node/DOM config riêng;
4. giữ runtime validation tại mọi trust boundary dù type tĩnh đã có.

Vì vậy roadmap #25 chuyển từ `TODO` sang `IN PROGRESS`, chưa chuyển `DONE`.
