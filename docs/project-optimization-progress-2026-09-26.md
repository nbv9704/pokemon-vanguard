# Pokémon Vanguard — Tiến độ kế hoạch tối ưu 26/09/2026

Tài liệu kế hoạch: [`project-optimization-audit-2026-09-26.md`](./project-optimization-audit-2026-09-26.md)

Ngày bắt đầu triển khai: 26/09/2026. Baseline: commit `26601b2`.

## Quy ước trạng thái

- `TODO`: chưa bắt đầu.
- `IN PROGRESS`: đang triển khai hoặc đang kiểm thử.
- `DONE`: đã sửa, có kiểm thử mục tiêu và đạt tiêu chí của đợt hiện tại.
- `BLOCKED`: cần quyết định sản phẩm, hạ tầng hoặc dữ liệu bên ngoài.
- `DEFERRED`: chủ động để sau, có ghi rõ lý do.

## Tổng quan

| Trạng thái | Số lượng |
| --- | ---: |
| DONE | 9 |
| IN PROGRESS | 19 |
| TODO | 5 |
| BLOCKED | 0 |
| DEFERRED | 1 |

Đợt hiện tại: **B13 — browser render baseline và derived receipt index**. Hạng mục P1/P2 chưa xong vẫn theo dõi, không đánh dấu hoàn thành. Các thay đổi Supabase đã có migration và test adapter nhưng chưa được coi là hoàn tất production trước khi migration được áp dụng và smoke-test trên môi trường thật.

## Bảng tiến độ

| # | Hạng mục | Ưu tiên | Trạng thái | Bằng chứng / bước kế tiếp |
| ---: | --- | --- | --- | --- |
| 01 | Không cho auth dùng secret công khai mặc định | P0 | DONE | Account mode fail-closed nếu secret thiếu/yếu; local unauthenticated vẫn hoạt động |
| 02 | Ranked chỉ settlement sau khi lưu thành công | P0 | IN PROGRESS | B03 JSON pair WAL; B08 xác nhận chặn pair cross-backend trước mọi write; B04 thêm receipt kết quả trong hai save, kiểm tra lại receipt sau mất ACK và lifecycle retry; còn mid-battle recovery, multi-process/Supabase rollout |
| 03 | Bộ đóng gói chưa loại hết dữ liệu local | P0 | DONE | Exclude backup/report/admin backup/campaign journal/raw candidate/node_modules/dist; release ZIP vẫn chứa normalized validation snapshot đã review |
| 04 | Một cơ chế khóa thống nhất cho account và match | P1 | IN PROGRESS | `AccountCoordinator` khóa tập account; WS/Admin/Social/Ranked/Friendly action đã dùng; còn lifecycle Friendly và multi-process |
| 05 | Supabase optimistic concurrency và transaction | P1 | IN PROGRESS | CAS revision + pair-save RPC; thêm bảng campaign idempotency bằng migration 202609260002; cần apply cả migration 001/002 và smoke-test Supabase thật |
| 06 | Queue phục hồi sau exception | P1 | DONE | `SerialTaskQueue`; lỗi job không poison tail; close/admin dùng cùng abstraction |
| 07 | Kiểm tra số nguyên an toàn economy | P1 | DONE | Chặn non-number/non-safe integer/overflow trước khi mutate |
| 08 | Idempotency xuyên retry | P1 | IN PROGRESS | B01–06: Admin/Social/Ranked/Training/Team/Shop/Recruitment receipts. B07: bổ sung PvE schema-3 battle receipts + lost-ACK retry đọc save; còn legacy commands, PvP per-turn durable receipts và archival |
| 09 | Giới hạn dữ liệu nóng | P2 | IN PROGRESS | B12 đo 100k ~65,26 MB; B13 index dẫn xuất cho receipt append-only >=256, steady lookup ~<=0,001 ms nhưng cold build 42,595 ms/100k; chưa compact vì cần archive giữ dedupe bền |
| 10 | Giới hạn WebSocket/backpressure | P1 | IN PROGRESS | B06 queue/buffer/payload; B07 deadline join + cap socket/account; B08 quota; B10 chỉ tin XFF từ proxy IP allowlist; còn soak và distributed cap |
| 11 | Vòng đời session và thu hồi phiên | P1 | IN PROGRESS | B07 session ID + expiry trên WS, logout thu hồi/đóng socket theo phiên, strict provider/account/room và giữ legacy ID 128; còn revoke store liên process/restart, commit-boundary expiry, integration WS/Supabase thật |
| 12 | Origin/cookie qua HTTPS proxy | P1 | DONE | B10 canonical `PUBLIC_ORIGIN`, Secure cookie/HTTPS callback, exact HTTP/WS Origin + Fetch Metadata và proxy IP allowlist; focused integration PASS |
| 13 | Save JSON schema/concurrency/recovery | P1 | IN PROGRESS | B03: JSON pair WAL redo sau restart, pre/post hash guard, durable receipt và khóa IO trong một tiến trình; còn power-loss/Windows, đa tiến trình và live-room rehydration |
| 14 | Deadline I/O và phân loại lỗi | P1 | DONE | B02/B08 storage body + icon proxy deadline/error bounds; B10 OAuth/profile timeout codes và graceful shutdown idempotent theo một budget; focused integration PASS |
| 15 | Public projection allowlist/pure | P1 | DONE | B11 root save, Training V2/V3, Battle V2/V3 và preview dùng allowlist fail-closed; negative sentinel + WebSocket thật chứng minh receipt/field tương lai không lọt ra public |
| 16 | Giảm full-state broadcast/render | P2 | IN PROGRESS | B12 cùng audience/tab project + serialize 1 lần; B13 browser baseline: Team p50/p95 11,5/51,9 ms, các route chính còn lại p95 <=3,8 ms, focus/caret giữ qua push; còn delta/cursor và profiling Team |
| 17 | Thu hồi room/presence | P1 | IN PROGRESS | B07 reclaim room detach >10 phút với guard socket/join/job/PvP; prune presence; còn hard cap/LRU, đo memory soak và process ownership |
| 18 | Khôi phục PvP sau restart | P1 | DEFERRED | B04 có kết quả Ranked đã settle; mid-match snapshot/timer/Friendly cố ý hoãn sau B08 theo ưu tiên mới, không coi đã hỗ trợ restart trận đang đánh |
| 19 | ACK và trạng thái đã lưu | P1 | IN PROGRESS | B05–06: Social/management/Shop/Recruitment. B07: PvE schema-3 durable ACK + một outbox retry chủ đích; còn ACK toàn bộ legacy/PvP action, multi-device/browser QA |
| 20 | Cache/nén HTTP | P2 | IN PROGRESS | B09-fix1: precompressed catalog V2/V3 + ETag/304/HEAD; q-weight/406 đúng, static bounded cache/streaming; cần browser/cold-warm/live WS |
| 21 | Lazy-load UI/catalog | P2 | TODO | Giữ legacy fallback |
| 22 | Tối ưu ảnh/manifest | P2 | TODO | Cần visual QA |
| 23 | CSS layers/cascade | P2 | TODO | Cần screenshot baseline |
| 24 | Tách module theo trách nhiệm | P2 | TODO | Làm sau correctness |
| 25 | Lint/type contracts | P2 | TODO | Thiết lập baseline |
| 26 | CI/test đúng artifact phát hành | P1/P2 | DONE | Run #10: Ubuntu + Windows npm-ci/check/inventory/1.333 test PASS; Ubuntu đóng gói, verify, clean-unpack và handle-leak PASS |
| 27 | Snapshot content/repo size | P2 | IN PROGRESS | B09: inventory 35 catalog version (18.06 MiB), xác minh active SHA-256; chưa archive/delete version chưa rõ tương thích; UI icon mirror 0/39 trong source ZIP chưa được fetch |
| 28 | Admin overview aggregate đúng | P1 | IN PROGRESS | Fixture 150 account; UI/API ghi rõ sample và online lấy registry toàn cục; còn aggregate DB + keyset campaign |
| 29 | Social capacity/profile offline | P1 | IN PROGRESS | B03 WAL/cloud pair RPC; B04 durable Social receipts; B05 WS commit ACK + sessionStorage pending outbox theo tài khoản và retry cùng mã qua reconnect/reload (không tự gửi lại); còn Supabase thật/multi-process smoke và QA trình duyệt |
| 30 | Quan sát lỗi/benchmark | P1/P2 | IN PROGRESS | B09: baseline catalog raw/gzip/br và serialize CPU JSON có script lặp lại; chưa metrics persist, room, heap, load/soak |
| 31 | UX/accessibility/storage fallback | P2 | IN PROGRESS | localStorage lỗi chuyển memory fallback và báo không persistent; còn browser/a11y QA |
| 32 | Workflow/tài liệu thống nhất | P2 | IN PROGRESS | B09: thay app/AGENTS template cloud lỗi thời bằng Node local contract; README + operations mới; cần clean-clone/đội review |
| 33 | Release tái lập/clean environment | P2 | IN PROGRESS | B09-fix1 + hosted run #10: stable archive root, normalized metadata, manifest/verifier/dry-run, clean-unpack PASS; còn so checksum nén cross-zlib/macOS nếu muốn cam kết whole-ZIP byte-identical |
| 34 | Không mất quà pending khi inbox đầy | P1 | DONE | Quota 50 pending: từ chối thư mới, không cắt quyền nhận cũ; duplicate vẫn idempotent |

## Nhật ký triển khai

### 26/09/2026 — Khởi động

- Tạo file progress riêng và liên kết tới báo cáo gốc.
- Xác nhận worktree chỉ có hai tài liệu mới thuộc kế hoạch; chưa commit/push.
- Bắt đầu mục 01 và 03 theo thứ tự đợt A.
- Không đọc hoặc sửa `.dev.vars`, `.local-data`, backup hay save người chơi.

### 26/09/2026 — Guard bảo mật, đóng gói và economy

- Mục 01: `createLocalServer({authRequired:true})` truyền chế độ bắt buộc secret; auth từ chối secret dưới 32 ký tự hoặc fallback cũ. Fixture auth được đổi sang secret test đủ dài.
- Mục 03: packager lọc case-insensitive và loại `backups`, `reports`, `.admin-backups`, `content-candidates`, `node_modules`, `dist`; test fixture xác nhận các file này không vào ZIP.
- Mục 07: ledger kiểm mọi currency/ticket delta là safe integer và kiểm overflow balance trước khi ghi.
- Kiểm thử: 25/25 auth/admin/package đạt; 39/39 economy/ticket/shop/mission/admin đạt.

### 26/09/2026 — Ranked failure safety và queue recovery

- Mục 02 (một phần): settlement tính trên clone, chỉ publish live state và đặt `settled` sau khi cả hai lệnh persist thành công; promise settlement chống hai commit đồng thời trong một match. Fault-injection xác nhận save lỗi giữ rating/match count live ở trạng thái cũ và cho retry thành công.
- Mục 02 chưa `DONE`: hai backend write chưa phải một transaction bền vững; sẽ hoàn tất cùng mục 04–05.
- Mục 06: thêm `SerialTaskQueue`; exception vẫn trả về caller nhưng tail được phục hồi để message/cleanup/admin job sau chạy tiếp.
- Kiểm thử: 26/26 Ranked/PvP/ticket đạt; 26/26 queue/local/admin/heartbeat đạt.

### 26/09/2026 — Social và Gift Inbox

- Mục 29 (một phần): mọi Social mutation chạy trên clone; lỗi persist không làm bẩn live state. Accept kiểm lại trần 100 bạn; profile người offline lấy từ storage profile khi có.
- Mục 29 chưa `DONE`: save hai account vẫn cần transaction và coordinator chung ở mục 04–05.
- Mục 34: chọn chính sách quota rõ ràng — giữ tối đa 50 quà pending; khi đầy, thư mới trả `GIFT_INBOX_FULL`, không xóa quà cũ. Retry gift ID cũ vẫn trả duplicate thành công.
- Kiểm thử: 28/28 Social/Arena/Admin đạt; 15/15 Admin đạt và 3/3 Mailbox retention đạt ở lượt riêng.

### 26/09/2026 — Coordinator, CAS và atomic pair-save

- Mục 04: thêm `AccountCoordinator` khóa nguyên tử theo tập account, phục hồi sau rejected work; wiring vào mutation thường, admin, Social, Ranked và Friendly action. Ranked tick/admin stop khóa cả hai participant.
- Mục 05: Supabase save bắt buộc load revision trước, update bằng revision CAS và trả `STORAGE_REVISION_CONFLICT` khi stale writer. Thêm RPC `save_game_state_pair` cùng receipt/fingerprint và advisory lock để hai save Social/Ranked commit trong một transaction.
- Mục 02/29: Ranked và Social dùng pair RPC cho account cloud; chỉ publish live state sau persist thành công. Migration `202609260001_atomic_pair_saves.sql` phải được apply trước khi rollout server này.
- Kiểm thử mục tiêu: 58/58 coordinator/Social/Ranked/local/admin/storage đạt; test riêng xác nhận stale writer và payload pair RPC.

### 26/09/2026 — Storage, projection, browser fallback và admin scope

- Mục 13: JSON save kiểm schema hỗ trợ và wallet safe integer trước ghi; temp/backup dùng tên duy nhất và cleanup; restore cloud nạp revision trước CAS.
- Mục 15: Ranked/Social/Ticket Bag/Mission/Admin Gift/Mailbox projection trả dữ liệu tách khỏi state; deep-freeze test bảo đảm không mutate đầu vào.
- Mục 31: client chịu được localStorage bị chặn bằng memory identity/settings fallback và cảnh báo rõ tiến độ sẽ không bền vững.
- Mục 28: overview không còn gọi metric của 100 account đầu là tổng hệ thống; response có `sampledAccounts`/`aggregateScope`, UI hiện `sample N/total`, còn online lấy registry toàn cục. Fixture 150 account đạt.

### 26/09/2026 — Verification toàn dự án

- `npm run check`: đạt toàn bộ compile/content/syntax/structure/item/assets/release/reward gates; 403 production JS/MJS, trần 360/360 dòng.
- `npm test`: **1250/1250 pass**, 179 test files, 0 fail/skip/todo; gồm simulation 1.000 trận seeded.
- Chưa commit, push hoặc apply migration vào Supabase production trong đợt này.

### 27/09/2026 — B01: Admin Gift retry-safe, local durability và kiểm thử đúng bản phát hành

- **Mục 08 (một phần):** `server/admin-campaigns.mjs` tạo fingerprint của admin + audience selector + gift đã normalize, bỏ timestamp biến động. `AdminService.sendGiftCampaign()` nhận `campaignId` ổn định, lưu manifest audience/gift không thay đổi và serialize request trùng ID. Cùng ID khác nội dung/đối tượng gửi trả HTTP 409. Recipient receipt lưu trong save cùng bản tin để tránh gửi lại dù thư được claim hoặc đã hết retention. Client giữ ID và payload đã xác nhận trong `sessionStorage` cho đến khi tất cả đối tượng gửi thành công; khi partial, nút tiếp tục retry đúng chiến dịch cũ. Không tự tạo chiến dịch mới từ thất bại mạng.
- **Mục 08/05 cloud rollout:** bổ sung migration `app/supabase/migrations/202609260002_admin_campaign_identity.sql` và storage adapter manifest theo unique key. **Chưa apply vào database production**. Cần apply `202609260001_atomic_pair_saves.sql` và migration mới trên môi trường test trước khi rollout; kiểm tra RLS, retry đồng thời nhiều process, crash sau commit trước ACK. Client cũ không gửi `campaignId` vẫn tương thích nhưng không được đảm bảo retry giống phiên bản UI mới.
- **Mục 13 (một phần):** `JsonAdventureStorage.save()` ghi file tạm độc nhất, fsync nội dung trước rename và fsync directory trên POSIX; manifest chiến dịch local được đăng ký theo thao tác link độc quyền. Chưa có journal/transaction hai file local hoặc kiểm thử mất điện thực tế. Windows có giới hạn directory fsync.
- **Mục 26 (một phần):** bản source an toàn trước đây bỏ hẳn `content-candidates` khiến release gate/test vẫn đọc đường dẫn đã bị bỏ. Tách 20 normalized JSON/fetch manifest (2 snapshot gốc) thành `app/content-validation/`, cố định SHA-256 manifest; chuyển **validators và test runtime** sang bản đã review. Các authoring command vẫn dùng `content-candidates` riêng và không có trong ZIP phát hành. Packager tiếp tục bỏ raw candidates, `.campaigns`, saves, backup, secret, node_modules và reports. Kiểm tra SHA-256 được gọi đầu tiên trong `npm run check`.
- Files trọng yếu: `server/admin-service.mjs`, `admin-gifts.mjs`, `admin-campaigns.mjs`, `storage-json.mjs`, `storage-supabase.mjs`, `local-server.mjs`, `public/admin.js`, `scripts/package-full.py`, `scripts/verify-validation-snapshots.mjs`, `content-validation/`, các validator/tests dùng snapshot và migration SQL mới. Không thay gameplay/mechanics/schema save hiện hữu và không đụng save/secret của người dùng.
- Test: `npm run check` **PASS**; `npm test` **1260/1260 PASS, 181 test files, 0 fail/skip/todo**, bao gồm 8 case Admin Campaign mới và 2 case verification snapshot; focused regression Admin/Ticket/JSON/Packager cũng PASS.
- Nghiệm thu gói source: đóng gói bằng `npm run package:full`, quét đường dẫn riêng tư và CRC đều PASS; giải nén gói sạch sang thư mục khác, `npm run check` PASS và `npm test` **1260/1260** PASS sau khi chuẩn bị dependency `ws` (tương đương bước cài dependency; bản phát hành không đóng kèm `node_modules`).
- **Còn lại trước DONE:** chuẩn hóa action envelope và durable receipt cho các command còn lại (đặc biệt Ranked, PvP và admin mutation); receipt retention/compaction không mở lại entitlement; kiểm thử migration cloud và multi-process; journal/recovery + atomic pair cho local; CI clean install trên nhiều hệ điều hành.


### 27/09/2026 — B02: Admin mutations chống thực thi trùng và cloud request deadline

- **Mục 08 (một phần):** thêm `server/admin-action-receipts.mjs` để fingerprint canonical toàn bộ nội dung mutation gắn với admin/account và `actionId`; append-only `adminActionReceiptsV1` nằm trong cùng player save với mutation + audit. Retry cùng ID cùng payload chỉ trả trạng thái đã lưu, cùng ID khác payload/admin bị từ chối HTTP 409. Mất phản hồi sau khi save nhưng trước khi publish live được nhận diện bằng cách đọc lại receipt từ storage. Giữ hỗ trợ legacy API thiếu ID; các side effect đặc biệt `save.backup`, `battle.stop`, `session.disconnect` chưa đưa vào hành lang retry này và từ chối nhận `actionId`.
- **Admin UI:** giữ một mutation đang chờ xác nhận trong `sessionStorage` theo admin account, có nút Retry dùng đúng ID/payload, chặn mở mutation hoặc gửi Gift mới tới khi giải quyết, kèm cảnh báo khi discard vì kết quả server có thể đã commit. UI khởi tạo mã qua `crypto.randomUUID()` và tách khỏi campaign ID của Admin Gift. Receipt chỉ lưu private trên server, được loại khỏi WebSocket projection.
- **Mục 14 (một phần):** `SupabaseAdventureStorage.request()` đặt deadline 10 giây có thể cấu hình cho quá trình fetch, abort và phân loại `STORAGE_TIMEOUT`, `STORAGE_UNAVAILABLE`, `STORAGE_CANCELLED`, `STORAGE_HTTP_ERROR` và `STORAGE_REVISION_CONFLICT` (HTTP 409/412). Timeout khi POST/PATCH là **trạng thái chưa xác định**; caller phải đọc receipt/trạng thái trước retry, không tự động POST mới. Chưa áp dụng deadline xuyên suốt tới `.json()` đọc body và các upstream OAuth; giữ IN PROGRESS.
- **Kiểm thử bổ sung:** fingerprint canonical, double-click đồng thời qua account coordinator, cùng ID khác payload/admin, timeout sau commit nhưng live chưa publish, tạo lại instance JSON storage/service, pending UI qua reload, WS privacy; mock abort timeout và HTTP/CAS errors.
- **Nghiệm thu B02:** `npm run check` PASS; `npm test` **1271/1271 PASS**, 183 test files, 0 fail/skip/todo (gồm 8 test Admin action mới và 3 test I/O deadline). Dependency `ws` được chuẩn bị đúng phiên bản khóa trong lockfile từ môi trường kiểm thử B01 vì registry không có sẵn trong offline npm cache. Chưa thực hiện CI `npm ci` đa hệ điều hành.
- **Chưa triển khai trong B02:** atomic journal/recovery cho local `savePair` (mục 13, phụ thuộc 02), unified player action envelope/Ranked recovery (mục 08/18), chạy Supabase migrations trên môi trường production và smoke-test đa process.

### 27/09/2026 — B03: local JSON pair journal + recovery

- **Mục 13 (một phần):** thêm `app/server/json-pair-journal.mjs`, WAL `.transactions/pending.json` fsync trước khi chạm hai save; ghi từng save bằng temp-file + fsync + rename và kiểm tra hash cũ/mới trước khi replay. Khởi tạo storage mới tự phục hồi WAL dang dở trước khi đọc hoặc ghi save. WAL hỏng hoặc save đã diverge trả lỗi rõ ràng, tuyệt đối không overwrite im lặng. Ghi receipt bền theo operation ID và SHA-256 của nội dung cặp save. Retry cùng ID/cùng nội dung trả duplicate; khác nội dung trả conflict.
- **Mục 02/04/29 (một phần):** local JSON adapter dùng queue chung theo save directory trong cùng tiến trình cho load, save, savePair, backup và restore. Nếu lưu cặp lỗi sau khi thử chuẩn bị WAL, instance cũ bị khóa `STORAGE_PAIR_RESTART_REQUIRED`, tránh tiếp tục dùng live room stale; phải restart và load lại hai tài khoản. Hybrid adapter từ chối cặp account thuộc hai backend khác nhau thay vì `Promise.all` có thể ghi được một phía. Supabase pair RPC không bị đổi.
- **Mục 03/26:** `package:full` bổ sung loại bỏ `.transactions` và bài kiểm thử fixture; source ZIP chỉ có triển khai WAL và synthetic test, không có WAL/save thực của người chơi. Có hướng dẫn vận hành chi tiết tại `app/docs/local-json-recovery.md`.
- **Kiểm thử:** `npm run check` PASS. Toàn bộ suite gồm **1.279/1.279 PASS** trên 184 file test, 0 failed/skipped/todo, thực thi theo 11 nhóm để tránh timeout toàn tiến trình (9 nhóm đầu từ `npm test`, 2 nhóm cuối chạy riêng cùng cú pháp `--test --test-force-exit`). Bổ sung fault injection: lỗi trước file đầu, lỗi sau file đầu, lỗi ghi receipt, replay sau restart, conflict/chống replay trên save đã diverge, journal hỏng, retry trùng ID và concurrency trong cùng tiến trình. Không thực hiện thử cắt điện thật.
- **Giới hạn:** journal tạo eventual recovery, không cho external raw file reader atomic visibility; chỉ có lock trong một Node process. Windows không có directory fsync tương đương; operation receipts hiện giữ vĩnh viễn. Chưa thay thế yêu cầu migration Supabase thật, test HA đa tiến trình và khôi phục live Ranked/PvP sau restart. Vì vậy #02/#04/#05/#08/#13/#29 vẫn **IN PROGRESS**.


### 27/09/2026 — B04: Social action retry và Ranked result recovery

- **Mục 08/29:** thêm `server/social-action-receipts.mjs`, canonical fingerprint theo account/type/target và text đã normalize. `SocialService` kiểm receipt từ storage trước các precondition, ghi receipt vào save người gửi cùng giao dịch `savePair`, duplicate tái nạp cả hai state sau lỗi publish/ACK; cùng ID khác nội dung bị từ chối. Operation ID gửi xuống WAL được băm cố định để không vượt giới hạn 160 ký tự. Không thay đổi Social DTO; private receipt bị loại trong `local-server.mjs`. Trường hợp action cũ thiếu ID tiếp tục chạy tương thích nhưng không được đảm bảo dedupe xuyên restart.
- **Mục 02/18/08 (một phần):** thêm `server/ranked-settlement-receipts.mjs` và `server/ranked-action-identity.mjs`. Settlement lưu receipt kết quả cùng pair transaction, cả hai bên xác nhận chung match fingerprint; retry từ kết quả đã lưu không tính lại RP/Rank Ticket/mission. Nếu một bên thiếu hoặc hai receipt sai lệch, fail-closed. Lifecycle tick thử tiếp settlement dang dở; cấm surrender mới khi settlement còn pending; retry surrender cùng ID giữ nguyên ý định. Kiểm fingerprint action nội bộ match, chưa có durable per-turn snapshot.
- **Mục 18 (một phần):** sau server restart, nếu match đã settle và người chơi chưa dismiss, `RankedService.viewFor()` phát lại kết quả trong cửa sổ 10 phút. Dismiss lưu lại trên tài khoản; `CompletedBattleResults` không auto-hide kết quả recovered lúc hydration, client điều hướng tới Arena để hiển thị. Đây **không** phải khôi phục trận đang chiến đấu hay Friendly/PvP timer.
- **Mục 15:** strip `socialActionReceiptsV1`/`rankedSettlementReceiptsV1` khỏi WebSocket public state; projection Social/Ranked chỉ phát các trường cần thiết.
- **Kiểm thử:** bổ sung synthetic JSON lost-ACK, restart, cùng ID khác payload, double-submit đồng thời với `AccountCoordinator`, chat không gửi lặp, Rank settlement idempotency, receipt mismatch fail-closed, lifecycle retry, Ranked kết quả recovered/dismiss và client reentry guard. Hướng dẫn vận hành: `app/docs/social-ranked-retry-recovery.md`. `npm run check` **PASS**; `npm test` **1.287/1.287 PASS**, 186 test files, 0 fail/skip/todo, chia batch 12 file để tránh timeout.
- **Nghiệm thu gói sạch:** đóng full ZIP bằng packager an toàn; CRC và quét path private đạt. Giải nén vào thư mục mới rồi chạy lại `npm run check` **PASS**, `npm test` **1.287/1.287 PASS**. `npm ci --offline` không chạy được vì cache không có tarball `ws@8.21.3`; đã chuẩn bị dependency `ws@8.21.3` từ fixture local khớp lockfile trước khi test. Chưa kết luận cài sạch qua registry hoặc CI đa OS đạt.
- **Giới hạn:** không có real Supabase migration/smoke, HA đa process, power-cut test hay active PvP battle rehydration. Các receipt bền còn tăng kích thước save; chỉ compact sau khi có archive/dedupe durable. Mục 02/08/13/18/29 giữ `IN PROGRESS`.



### 27/09/2026 — B05: ACK sau commit, retry Social và Schema-3 management

- **Mục 08 (một phần):** `app/server/v3-player-actions.mjs` áp dụng các action `buildV3.save`, `teamV3.save`, `teamV3.activate`, `replicaV3.apply` trên clone rồi mới persist/public state. Action mang ID hợp lệ ghi canonical SHA-256 fingerprint + receipt vào **cùng save**; retry cùng ID/nội dung nhận kết quả đã có ngay cả khi `expectedRevision` cũ, cùng ID khác payload từ chối `ACTION_ID_REUSED`. Nhánh local WebSocket nạp lại save trước khi tra receipt cho các action có ID; training checkout và Team save không được thực thi lần hai. Legacy action thiếu ID tiếp tục tương thích nhưng không có cam kết dedupe này. Team Builder bổ sung actionId cho save/activate.
- **Mục 19/29 (một phần):** WebSocket gửi `action-ack` **sau** commit thành công cho Social và Schema-3 management có actionId. `AdventureConnection` tách ACK khỏi `state`; Social action nhận error với ID khi server từ chối rõ ràng. `SocialPendingActions` giữ đúng một action chờ (cùng payload/ID) trong `sessionStorage` theo tài khoản/tab; khi reload hoặc mất ACK, UI hiển thị cảnh báo và nút Retry/Discard. Không có tự động replay, kể cả khi reconnect; chỉ ACK đúng ID mới xóa pending. Nếu tắt storage hoặc quota lỗi, cảnh báo pending sẽ không bền qua reload. Pending message không xóa nội dung compose khi gửi chưa thành công.
- **Ổn định đóng gói/JSON:** kiểm thử trên ZIP sạch phát hiện race đăng ký Admin Gift manifest ở hai lời gọi đồng thời. `JsonAdventureStorage.registerCampaign()` giờ dùng chung queue thư mục với save/WAL trong một tiến trình; bổ sung test hai adapter cùng thư mục để xác nhận lượt đăng ký đầu được giữ nguyên. Bản cloud vẫn dựa trên unique constraint database; multi-process chưa kiểm thử.
- **Tổ chức code:** tách bộ giữ focus/scroll sang `app/public/js/render-continuity.js`, policy Social retry sang `social-retry-controller.js`; giữ giới hạn cấu trúc 360 dòng/module. Đây chỉ là tái cấu trúc phục vụ thay đổi, chưa hoàn thành mục 24 nói chung.
- **Kiểm thử:** `npm run check` PASS; `npm test` **1.298/1.298 PASS** trên **190 test files**, 0 failed/skipped/todo. Tests mới gồm receipt duplicate/conflict với training và team, outbox reload/ACK/dismiss, WebSocket mất phản hồi rồi retry qua restart, Social pair-save mock đã commit nhưng mất ACK + fingerprint conflict. Mock Supabase chứng minh contract kiểm thử, **không thay thế smoke-test trên database thật**.
- **Giới hạn / bước kế tiếp:** mục 08, 19 và 29 vẫn `IN PROGRESS`; chưa có envelope/ACK thống nhất cho Shop, Recruitment, Battle và mọi command; chưa khôi phục trận PvP đang đánh/timer sau restart; `sessionStorage` chỉ giữ pending trong cùng tab; receipt tăng dung lượng save và cần chính sách archival an toàn. Chưa apply/kiểm tra migrations Supabase production, multi-process hoặc browser QA nhiều thiết bị.

### 27/09/2026 — B06: batch lớn — commerce reliability + WebSocket lifecycle/flow control

- **Mục 08/19:** Shop `shopV3.buy` và Schema-3 `recruitV3.*` chạy qua `server/receipt-command-handler.mjs`: đọc lại durable save trước mỗi action có ID (chống commit-thành-công/mất-ACK), kiểm tra receipt/id-payload conflict và chỉ publish sau persist hoặc nhận diện duplicate. ACK bao gồm action ID, loại, committed revision và duplicate; lỗi từ handler kèm actionId để UI biết chính xác ý định bị từ chối. Recruitment tăng account revision khi ghi receipt.
- **Client:** thêm `commerce-pending-actions.js` và `commerce-retry.css` cho Shop/Ranch, giữ đúng một ý định đang chờ trong sessionStorage theo account, không tự replay qua reconnect, chỉ ACK cùng ID mới xóa. Banner Retry/Discard toàn ứng dụng, cảnh báo khi browser storage bị khóa và khi logout làm mất khả năng retry cục bộ. Bỏ nhãn `ADVENTURE SAVED` dựa trên WebSocket mở; hiển thị `SYNCING`, `ONLINE`, `PURCHASE UNCONFIRMED` hoặc trạng thái tương ứng.
- **WebSocket lifecycle (#19):** `net.js` không gửi action trước frame `state` đầu tiên, timeout join 12 giây, exponential backoff có jitter và dừng retry với close code terminal (suspension/revocation). Giữ heartbeat hiện tại, không auto replay command battle.
- **WebSocket resource safety (#10):** `ws-flow-control.mjs` chặn hơn 32 queued message trên một socket, 8 MiB outgoing buffer, giữ inbound maxPayload 70 KiB hiện có. Test synthetic 1.000 message và slow consumer; đây là guard trong một process, **chưa** là production load/soak test hoặc distributed rate limiter.
- **Tests mới:** mock lost-ACK-after-write Shop và Recruitment với mission/ledger không nhân đôi, same-ID different payload conflict, client outbox reload/ACK/storage unavailable, socket join timeout/fatal close, synthetic queue/backpressure, WebSocket thật + restart + duplicate ACK + public privacy. Hướng dẫn vận hành: `app/docs/commerce-retry-operations.md`.
- **Giới hạn:** #08/#10/#19 giữ `IN PROGRESS`; không có active PvP rehydration (#18), Supabase staging/production smoke, safe receipt archival, multi-process load benchmark, universal player action envelope hoặc browser QA nhiều thiết bị.
- **Nghiệm thu cuối B06:** source `npm run check` PASS; `npm test` **1.310/1.310 PASS**, 195 test files, 0 fail/skip/todo. Full ZIP CRC PASS, quét path riêng tư PASS. Giải nén ZIP vào thư mục sạch: `npm run check` PASS; sạch-batch 1–10 **1.239/1.239 PASS**, batch 11 chạy riêng **71/71 PASS** (= **1.310/1.310**). Chạy all-in-one trên ZIP sạch bị timeout công cụ trong batch cuối; đã chạy lại nguyên batch đó độc lập thành công, không thay đổi code. Dependency `ws@8.21.3` từ fixture thử nghiệm đúng lockfile vì chưa có kiểm chứng `npm ci` registry sạch đa OS.

### 27/09/2026 — B07: PvE receipt, session lifetime, detached-room lifecycle

- **#08/#19:** thêm `app/server/v3-battle-player-actions.mjs`, canonical action fingerprint, kiểm receipt trước phase check; persist battle + mission cùng receipt và ACK sau commit, retry lost ACK nạp lại save và tránh xử lý thêm lượt. PvE client tham gia chung `sessionStorage` explicit outbox với Shop/Recruitment, giới hạn payload theo từng action, không auto replay. Action cũ không có ID giữ tương thích.
- **#10/#11:** session mới có SID ngẫu nhiên và expiry kiểm trước mỗi WS message, timer kết thúc socket khi hết hạn. Logout hủy một session và đóng socket của nó **trong một process**; vẫn nhận legacy session token/ID hợp lệ. Validate local/cloud provider/account/room mapping; route local hỗ trợ prefix với ID 128. Pending join có deadline (12 s) và đóng góp vào giới hạn socket/account (mặc định 4); các hạn mức cấu hình được.
- **#17:** tách `server/room-lifecycle.mjs`, reclaim room sau 10 phút không còn socket/join/job hoặc match Ranked/Friendly; dọn presence cục bộ, reload room sau đó từ save bền vững. Mới có static/unit fixtures, chưa có soak/per-process metric hay eviction benchmark.
- **Kiểm thử thực hiện:** `npm run check` PASS. B07 targeted unit/contract 8/8 PASS; 1.235/1.235 bài kiểm thử trong 179 file không phụ thuộc `ws` hoặc `local-server.mjs` qua 13 nhóm PASS, cộng 1/1 static socket contract test (tổng 1.236/1.236 bài có thể chạy không cần `ws`; 20 file bị loại khỏi lệnh batch tự động, gồm 1 static contract file đã chạy riêng và 19 file WebSocket/backend chưa xác minh).
- **Giới hạn phải giữ:** môi trường B07 không có `ws@8.21.3`, npm registry lỗi DNS (`EAI_AGAIN`); không chạy được 19 file test có yêu cầu WebSocket/full server, nên **KHÔNG** tuyên bố full regression hoặc ZIP sạch full-test pass. B07 không khôi phục trận Ranked/Friendly đang diễn ra (#18), không giải quyết revocation distributed hay kiểm thử Supabase staging. Xem `app/docs/session-pve-retry-b07.md`.

### 27/09/2026 — B08: quotas theo kết nối/IP, Supabase body deadline và bảo vệ icon proxy

- **#05/#02 (guard bổ sung):** `HybridAdventureStorage.savePair()` từ chối fail-closed giao dịch cặp tài khoản ở hai provider khác nhau (`STORAGE_PAIR_CROSS_BACKEND`) **trước bất kỳ lần ghi nào**; không còn fallback `Promise.all(save A, save B)` có nguy cơ commit một bên. B03 từng ghi nhận guard nhưng ZIP B07 còn chứa fallback; B08 kiểm tra lại nguồn phát hành và sửa kèm test.
- **#10:** `server/request-quotas.mjs` thêm token bucket độc lập cho account/IP/socket, upgrade theo IP và HTTP damage inspector. `local-server.mjs` kiểm trước parse/enqueue, quota ping, trả lỗi WS `ACTION_RATE_LIMITED` hoặc HTTP 429/Retry-After; socket/IP cap bổ sung 24 (tùy chỉnh). Bộ nhớ quota map có trần và tự prune; cấu hình env có validate trong `app/.dev.vars.example`. Nguồn IP là địa chỉ transport thực, chưa chấp nhận forwarded headers chưa đáng tin.
- **#14:** Supabase timeout bắt trùm thời gian đọc body (không chỉ fetch headers), đọc streaming giới hạn 16 MiB và phân biệt JSON hỏng/oversize. Icon proxy đóng trên tập URL allowlist, đồng bộ concurrent fetch, timeout 5 giây cho cả body, giới hạn 256 KiB và kiểm MIME + chữ ký PNG. Chỉ cache ảnh hợp lệ.
- **Tests mới / cập nhật:** `tests/request-quotas-b08.test.mjs`, `tests/icon-proxy-b08.test.mjs`, `tests/storage-boundary-b08.test.mjs`; cập nhật mock `tests/admin-campaigns.test.mjs` sang Response chuẩn để test deadline body. Unit/contract gồm burst 1.000 yêu cầu, refill, IP/account isolation, fetch concurrent và timeout sau header, cấm mixed-backend partial write. Hướng dẫn: `app/docs/resource-guard-b08.md`.
- **Kết quả source:** `npm run check` PASS; 188 file test không import `ws`/live server đã chạy qua 14 batch đầu + hai nhóm riêng + 2 bài simulation riêng: **1.273/1.273 PASS**, không skip/fail. Các bài `storage` và quota tường minh được chạy lại sau bước hardening cuối. Đây **không** phải full regression: 14 file integration cần `ws` chưa chạy trong môi trường này.
- **Giới hạn:** npm registry không truy cập được (`EAI_AGAIN` cho `ws@8.21.3`); chưa xác nhận runtime WebSocket đầy đủ, Supabase staging/production, multi-process load, origin proxy (#12) hoặc live PvP/Friendly match rehydration (#18). Giữ #02/#05/#10/#14/#18/#26 `IN PROGRESS`.

### 27/09/2026 — B09: batch lớn độc lập (HTTP, CI, inventory, docs, release)

- **Chủ trương:** #18 chuyển `DEFERRED` vì PvP mid-match restart cần snapshot/timer/ownership liên tiến trình. Không tiếp tục giữ các batch độc lập vì phụ thuộc #18 hoặc Supabase staging. Khi có môi trường tích hợp sẽ mở lại #18.
- **#20:** tạo `server/http-public-assets.mjs`, catalog công khai serialize/cache một lần mỗi server, SHA-256 ETag, 304, HEAD, gzip/Brotli/Vary. Static chỉ bật immutable nếu filename chứa fingerprint hex >=10; HTML/JS/CSS còn lại no-cache/revalidate. Bounded text LRU 48 entry/8 MiB; stream file lớn và không nén PNG/ZIP, kiểm symlink/traversal. Không đổi policy cho auth/save/admin. Các unit qua HTTP thực `tests/http-cache-b09.test.mjs` đều đạt; chưa browser/network benchmark.
- **#30:** script `scripts/benchmark-http-public.mjs` với baseline Linux Node v22.16.0 (10 sample sau 3 warmup); catalog V3 JSON **909,342 bytes** → gzip **108,789** / Brotli **78,438**, serialize p50 **3.25 ms** / p95 **7.49 ms** (development CPU, không phải live). Ghi dữ liệu trong `app/docs/http-baseline-b09.md`. Chưa có metrics vận hành toàn server.
- **#26/#33:** recursive `scripts/test-inventory.mjs` + batched runner parse summary bắt buộc (tránh im lặng bỏ test), liệt kê 3 file `.test.ts` của Cloud cũ thành archived. GitHub Actions mới matrix Linux/Windows + Ubuntu clean-unpack artifact check, còn **chưa chạy hosted**. `package-full.py` có pruning, dry-run, ZIP metadata ổn định, nhúng `RELEASE-MANIFEST.json` theo SHA-256; `verify-release.py` so thành viên/hash/path/CRC. Dùng chung Python executable launcher cho đóng gói và verify. Fixture xác minh byte-identical trên cùng Python/zlib và mtime thay đổi. Không cam kết checksum toàn ZIP giống nhau giữa phiên bản zlib/OS.
- **#27:** inventory phân loại 35 content snapshots, tổng **18.06 MiB**, xác nhận active SHA-256; `unclassified-retain` phải giữ, không xóa nếu chưa kiểm replay/migration. Kiểm tra `assets:ui-icons:validate` phát hiện local asset mirror **thiếu 39/39** (source ZIP cũ đã thiếu), chưa đưa gate này vào check hoặc tự fetch khi offline; live proxy/fallback giữ như trước, cần QA và asset license trước khi giải quyết #27/#22.
- **#32:** `app/AGENTS.md` trỏ về Node/npm workflow chính, cập nhật README và tài liệu vận hành B09; không còn hướng người mới sửa generated src/tic-tac-toe.
- **Kiểm thử trên source:** `npm run check` PASS; **184 file unit không import local-server/ws** đã chạy thành 14 batch + 5 nhóm riêng do timeout tổng của lần chạy all-in-one, cộng **1,246/1,246 tests PASS** (14 batch đầu 1,157, 5 nhóm cuối 89). 21 file tích hợp có import `local-server/ws` **chưa chạy** vì `ws` không được cài và npm registry hiện không sẵn; không gọi đây là full regression. Tests mới cho HTTP, release, discovery 6/6 PASS.
- **Còn mở:** browser/network metrics, `npm ci` từ registry sạch/hosted CI, WebSocket test, Supabase staging, Windows/macOS release checksum + icon mirror, PvP snapshot; không sửa save người chơi.

### 27/09/2026 — B09-fix1: Windows portability và HTTP negotiation

- **#20:** sửa lựa chọn `Accept-Encoding` theo trọng số `q` thay vì luôn ưu tiên Brotli; trả 406 khi Brotli, gzip và identity đều bị từ chối. Thêm regression cho `gzip;q=1, br;q=0.1` và `identity;q=0`.
- **#26/#33:** test symlink được tách khỏi large-stream và dùng directory junction trên Windows. Python test dùng chung launcher `py/python/python3`, không gọi cứng `python3`. Packager nhận diện Windows reparse-point để không đi xuyên junction vào save/secret.
- **Nghiệm thu local Windows:** `npm ci` PASS, audit 0 vulnerability; `npm run check` PASS; `npm test` **1.333/1.333 PASS trên 205 file**, 0 fail/skip/todo, 3 TypeScript cloud test được liệt kê archived. Nhóm HTTP/release/discovery 7/7 PASS.
- **Nghiệm thu ZIP sạch:** sửa wrapper đóng gói để nhận đúng output path qua npm trên Windows; ZIP giải nén sang thư mục mới, `npm ci`, `npm run check` và `npm test` đều PASS **1.333/1.333**. Manifest/CRC/security verifier PASS.
- **Tích hợp bản chính:** đồng bộ 86 file mới và 95 file cập nhật vào `D:\\Mon\\PokemonVanguard` bằng hash, không xóa file chỉ có ở bản chính. Secret, save, candidate authoring, backup và report được giữ nguyên; check/test trên bản chính tiếp tục PASS 1.333/1.333.
- **Giới hạn giữ nguyên:** GitHub-hosted Linux/Windows chưa chạy; browser/network benchmark, Supabase staging, icon mirror 0/39, multi-process và PvP mid-match recovery vẫn mở. Không nâng các mục tương ứng thành DONE.

### 27/09/2026 — Đưa B01–B09-fix1 lên nhánh chính

- Commit `f429a2b` (`feat: integrate optimization B01-B09 fix1`) đã được push lên `origin/main`; trước commit, `npm run check` PASS và phạm vi stage không chứa `.dev.vars`, `.local-data`, `node_modules`, `content-candidates`, log hoặc ZIP.
- GitHub Actions run `36300290729` đã được tạo cho workflow **Verify game and source release**. Cả job `validate (ubuntu-latest)` và `validate (windows-latest)` bị GitHub dừng trước step đầu với thông báo account bị khóa do billing; `release-smoke` vì vậy bị skip.
- Đây là chặn hạ tầng tài khoản, chưa phải lỗi source hay workflow. Giữ #26/#33 `IN PROGRESS`; sau khi billing GitHub được xử lý, rerun workflow và chỉ cập nhật PASS khi matrix Linux/Windows cùng clean-unpack hoàn tất.

### 27/09/2026 — Hosted CI đa hệ điều hành và release sạch

- Sau khi payment method được verify, runner GitHub hoạt động bình thường. Các run trung gian phát hiện lỗi portability thật: Git checkout Windows đổi LF/CRLF làm sai hash/generated comparison; temporary root của hosted Windows đi qua junction; tên thư mục checkout GitHub viết thường làm ZIP root không khớp smoke contract.
- Chuẩn hóa toàn bộ text checkout bằng `.gitattributes` (`* text=auto eol=lf`); static server so containment giữa `realpath(root)` và `realpath(file)` bằng `path.relative`, vẫn chặn linked directory thoát public root; ZIP luôn dùng archive root `PokemonVanguard` bất kể tên checkout. Test runner phát annotation TAP ngắn cho lỗi hosted.
- Clean clone Windows độc lập: `npm ci`, `npm run check`, `npm test` **1.333/1.333 PASS trên 205 file**. Test mục tiêu HTTP/release/reward đều PASS sau bản sửa cuối.
- GitHub Actions run [`36305711464`](https://github.com/nbv9704/pokemon-vanguard/actions/runs/36305711464) cho commit `13b7ac0`: `validate (ubuntu-latest)` PASS, `validate (windows-latest)` PASS, `release-smoke` PASS gồm package manifest/CRC/security, clean-unpack, npm-ci/check và handle-leak. Đánh dấu #26 `DONE`.
- #33 giữ `IN PROGRESS` theo tiêu chí thận trọng: hash từng file trong manifest là contract portable đã PASS; chưa cam kết toàn bộ byte ZIP giống nhau giữa zlib/OS và chưa chạy macOS. Cảnh báo action runtime Node 20 bị GitHub ép Node 24 là cảnh báo maintenance, không làm thất bại run.

### 27/09/2026 — B10: origin/proxy và shutdown

- **#12 DONE:** thêm canonical `PUBLIC_ORIGIN`; OAuth callback và cờ cookie `Secure` không còn phụ thuộc `Host` nội bộ. Mutation trình duyệt và WebSocket kiểm tra exact origin/scheme/port; `Sec-Fetch-Site: cross-site` bị chặn.
- **#10 một phần:** `X-Forwarded-For` chỉ được dùng khi transport peer nằm trong allowlist IP `PV_TRUSTED_PROXY_IPS`; client trực tiếp không thể spoof IP quota. Distributed socket cap và soak vẫn mở nên #10 giữ `IN PROGRESS`.
- **#14 DONE:** token exchange/profile sync có deadline + mã lỗi ổn định; shutdown dừng accept, drain queue, đóng WS và force-close trong một budget, đồng thời idempotent.
- **Kiểm thử:** bộ mục tiêu `proxy-origin-b10`, `local` và `request-quotas-b08`: 17/17 PASS; `npm run check` PASS; full regression **1.341/1.341 PASS trên 206 file**. Tài liệu vận hành: `app/docs/proxy-origin-shutdown-b10.md`.
- **Hosted CI:** run [`36313895556`](https://github.com/nbv9704/pokemon-vanguard/actions/runs/36313895556) cho commit `df69640`: Ubuntu PASS, Windows PASS và `release-smoke` PASS.
- **Giới hạn:** chưa thay thế smoke-test qua reverse proxy/OAuth/Supabase thật; không tuyên bố multi-process drain hay khôi phục PvP giữa trận.

### 27/09/2026 — B11: public DTO allowlist và privacy regression

- **#15 DONE:** thêm `server/player-public-view.mjs` làm allowlist fail-closed cho root save công khai. `local-server.mjs` không còn clone toàn bộ state rồi blacklist receipt; field root mới mặc định ở lại server cho đến khi được review và thêm chủ đích.
- Training V2/V3 map rõ từng field của Mon/build/team/blueprint. Battle V2/V3 map rõ own-unit; preview V3 map session và roster thay vì clone session. Dữ liệu trả về được detach khỏi authoritative state; policy ẩn thông tin đối thủ hiện có vẫn được giữ.
- Regression mới dùng private sentinel ở root và nested object, kiểm tra preview/live battle, rồi nạp JSON storage qua WebSocket thật và xác nhận sentinel không xuất hiện trong frame serialize. Các test Admin Gift, Admin action, Ranked và Social receipt cũ được đổi từ tìm chuỗi blacklist trong source sang kiểm tra hành vi projection thực tế.
- **Kiểm thử:** focused projection/battle **73/73 PASS**; receipt privacy bổ sung **29/29 PASS** (22 Admin/projection + 7 Ranked/Social); `npm run check` PASS; full regression **1.346/1.346 PASS trên 207 file**, 0 fail/skip/todo. Tài liệu: `app/docs/public-projection-b11.md`.
- **Hosted CI:** run [`36316200849`](https://github.com/nbv9704/pokemon-vanguard/actions/runs/36316200849) cho commit `b8be44b`: Ubuntu PASS, Windows PASS và `release-smoke` PASS.
- **Giới hạn:** Admin API được xác thực là management DTO riêng, không thuộc player-public projection. Chưa thay thế browser/network inspection qua proxy/account stack thật hoặc Supabase staging; các hạng mục đó vẫn giữ trạng thái riêng.

### 27/09/2026 — B12: hot-state baseline và coalesce broadcast

- **#09 chuyển `IN PROGRESS`:** thêm benchmark synthetic lặp lại được ở `scripts/benchmark-hot-state-b12.mjs`; không đọc save thật, dùng temp JSON storage rồi xóa. Trên Windows/Node v22.15.0, 100k entry mỗi nhánh không giới hạn tạo save **65.263.022 B**, serialize p50/p95 **258,149/261,540 ms**, durable JSON write **1.446,791 ms**; ledger 30.777.782 B, action receipts 21.477.781 B, battle events 11.946.577 B. Xác nhận cần archive/index nhưng chưa cắt receipt/tombstone vì sẽ làm hỏng chống trùng.
- **#16 một phần:** thêm `state-broadcast.mjs`; nhiều socket cùng audience trong một room dùng chung đúng một projection và chuỗi JSON. Spectator short-circuit trước các owner projector. `sendSerializedBounded()` vẫn giữ kiểm tra backpressure. Với fixture 4 tab, số projection/serialization giảm **4 → 1**; frame history 100k event giảm CPU synthetic p50 từ **1.014,269 ms** xuống **244,529 ms** nhưng số byte mạng không đổi.
- **Kiểm thử:** broadcast/flow-control/local/WebSocket/privacy **14/14 PASS**; `npm run check` PASS; full regression **1.348/1.348 PASS trên 208 file**, 0 fail/skip/todo. Tài liệu và cách chạy benchmark: `app/docs/hot-state-broadcast-b12.md`.
- **Hosted CI:** run [`36326764392`](https://github.com/nbv9704/pokemon-vanguard/actions/runs/36326764392) cho commit `bfe641b`: Ubuntu PASS, Windows PASS và `release-smoke` PASS.
- **Giới hạn:** chưa có cursor/delta/resync, chưa archive receipt/ledger, chưa browser long-task/render baseline theo từng route và chưa soak multi-process/Supabase. Vì vậy #09 và #16 giữ `IN PROGRESS`.

### 27/09/2026 — B13: browser render baseline và derived receipt index

- **Browser QA cho #16:** chạy Local Beta trên save temp bằng trình duyệt thật và timer `?debug=1`. Mỗi route lấy 10 mẫu xen kẽ Home: Team Builder p50/p95 **11,5/51,9 ms** (349 descendant), Training **2,3/3,8 ms**, Friends **2,3/3,8 ms**, Arena **1,6/3,8 ms**. Double Preview 4,0 ms; command đầu 6,2 ms; 20 lần bật/tắt Battle Log p50/p95 **2,8/3,7 ms**. Một long-task outlier ở Team chưa đủ để viết lại DOM; cần profile tách HTML/layout/image decode.
- **Continuity:** tab thứ hai cùng account join và gây state broadcast trong lúc input Team name có draft; value, focus và cả hai đầu caret được giữ nguyên. Browser skill dẫn tới quyết định không thực hiện DOM rewrite chưa có bằng chứng.
- **#09 một phần:** thêm `append-only-index.mjs`, WeakMap chỉ trong process, không serialize; dưới 256 entry vẫn linear. Index áp dụng cho economy/action/Social/Admin/Gift/Ranked settlement/V2 reward receipt, giữ first-match, cập nhật append và rebuild khi array bị thay/truncate. Không xóa hoặc hết hạn replay barrier.
- **Benchmark 100k receipt:** linear missing lookup p50/p95 **2,022/2,678 ms**; cold index build **42,595 ms** một lần; steady first/last/missing ở hoặc dưới độ phân giải **0,001 ms**. Save size/serialize/write không giảm, nên #09 vẫn `IN PROGRESS`.
- **Kiểm thử:** receipt/economy/settlement mục tiêu **49/49 PASS**; `npm run check` PASS; full regression **1.352/1.352 PASS trên 209 file**, 0 fail/skip/todo. Tài liệu: `app/docs/browser-render-receipt-index-b13.md`.
- **Giới hạn:** chưa archive receipt/ledger, chưa cursor/base revision/resync cho battle history, chưa trace Team Builder nhiều fixture/browser hoặc soak multi-process/Supabase. #09/#16 giữ `IN PROGRESS`.

## Cách cập nhật file này

Sau mỗi hạng mục: cập nhật bảng tổng quan, dòng tương ứng và thêm nhật ký gồm file đã đổi, test đã chạy, kết quả, giới hạn còn lại. Chỉ đánh dấu `DONE` khi test mục tiêu đạt; nếu chỉ hoàn thành một phần thì giữ `IN PROGRESS`.
