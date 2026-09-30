# Pokémon Vanguard — Rà soát và kế hoạch tối ưu toàn dự án

Ngày: 26/09/2026. Bản được kiểm tra: `D:\Mon\PokemonVanguard`, commit `26601b2` — `feat: merge latest Bag and Tickets update`.

**Đây là báo cáo và hướng dẫn thực hiện, không phải bản sửa. Trong đợt này chỉ tạo tài liệu này; không sửa code, cấu hình, database, tài nguyên hoặc save người chơi; không commit/push.**

## 1. Kết luận và phạm vi

Không cần viết lại game hay đổi framework để có cải thiện đáng kể. Việc cần làm trước là bảo đảm đăng nhập và lưu dữ liệu đúng khi lỗi hoặc thao tác đồng thời; tiếp theo mới giảm lượng dữ liệu truyền, tải tài nguyên và chi phí render. Kiến trúc rules/mechanics/server/UI hiện có là nền tảng nên giữ.

Báo cáo có **34 hạng mục**. Các đường dẫn bên dưới tương đối với thư mục gốc dự án ở trên; tên hàm dùng làm điểm tìm kiếm ổn định khi số dòng thay đổi.

Đã kiểm tra trực tiếp: máy chủ HTTP/WebSocket, auth, lưu JSON/Supabase và migration SQL, Ranked/PvP lifecycle, Social, admin, economy ledger, đóng gói, bootstrap/client/network/store/router, các điểm render và focus, catalog, asset inventory, scripts kiểm tra/kiểm thử và tài liệu kiến trúc. Không đọc nội dung credential hoặc save thật.

Giới hạn: đây là rà soát mã và kiểm tra chọn lọc, không phải chứng nhận đã duyệt mọi dòng hay mọi tổ hợp mechanics. Chưa kiểm thử trình duyệt trực tiếp trong đợt này, chưa load-test, chưa kiểm toán database đang triển khai, chưa xác nhận cấu hình secret thực tế, chưa kiểm tra quyền sử dụng tài sản bên ngoài. Vì vậy không kết luận rằng hệ thống đang bị khai thác, đang rò dữ liệu, hoặc giao diện đã được đo chậm.

### Bằng chứng và kiểm tra trong đợt này

| Kiểm tra | Kết quả |
| --- | --- |
| Git trước khi viết báo cáo | Sạch, HEAD `26601b2` |
| Test chọn lọc: economy, ranked-v1, arena-social-training, storage-migration, client-modules | 33/33 đạt, không fail/skip |
| Auth với `env: {}` và session giả lập ký bằng fallback trong source | `readSession()` chấp nhận; không kết nối tài khoản thật |
| Ranked với storage giả lập luôn lỗi | `match.settled === true`, rating A đã thành 1016; gọi lại không thử lưu nữa |
| Social friend request với storage giả lập lỗi | Danh sách outgoing trong live state vẫn tăng lên 1 |
| Economy helper với `delta.coins = Infinity` | Trả `ok: true`; JSON hóa balance thành `null` |
| Inventory file Git | 1.698 file; tổng nội dung khoảng 118,92 MiB, không phải dung lượng Git history |
| CSS | 33 file CSS tracked, 325.438 byte; index tải trực tiếp 31 stylesheet |
| Client/server lớn | `client.js`: 64.165 byte / 360 dòng; `local-server.mjs`: 27.779 byte / 261 dòng |
| Ví dụ source nén dài | `client.js` có dòng dài 3.253 ký tự; `ranked-v1.mjs` 21.062 byte nhưng chỉ 77 dòng |
| Catalog public JSON chưa nén | V3: 909.342 byte; V2: 48.979 byte, đo bằng serialize export hiện tại |
| Ví dụ ảnh | `assets/items/challenger_box.png`: 1.164.769 byte, 1254×1254; `ranks/challenger.png`: 1.146.945 byte, 1254×1254 |
| Thư mục local ngoài Git | `backups`: 4 file JSON; `reports`: 6 file, trong đó 5 JSON; chỉ kiểm metadata, không kết luận mọi JSON đều là save |

Lần gộp trước đã báo `npm run check` đạt và 1.233/1.233 test `.mjs` đạt. Đây là baseline từ lượt trước, **không phải full suite vừa chạy lại trong đợt audit**. Có 179 file test tracked: 176 `.test.mjs` và 3 `.test.ts`; test runner hiện chỉ lấy `.test.mjs` trực tiếp dưới `app/tests`.

### Phân loại

- **P0:** xử lý trước khi dùng tài khoản thật/Ranked thật hoặc chia sẻ gói nguồn, theo điều kiện từng mục.
- **P1:** có thể ảnh hưởng tính đúng, độ bền hoặc vận hành; làm sớm.
- **P2:** tối ưu có giá trị, làm sau nền tảng correctness và có đo đạc.
- **P3:** tiện ích/quy trình dài hạn, không chặn bản local.
- **Xác nhận:** có bằng chứng code hoặc tái hiện giả lập. **Rủi ro:** đường đi có thể lỗi nhưng chưa tái hiện end-to-end. **Đo trước:** chưa có benchmark chứng minh nút thắt.

## 2. Thứ tự thực hiện

| Đợt | Hạng mục | Điều kiện hoàn thành |
| --- | --- | --- |
| A — Chặn lỗi nghiêm trọng | 01–03 | Secret không dùng mặc định; save lỗi không quyết toán giả; gói phát hành không chứa dữ liệu local |
| B — Nhất quán dữ liệu | 04–09, 13–14, 29, 34 | Có lock/transaction/CAS đúng phạm vi, receipt bền vững, fault-injection đạt |
| C — Giao thức và vận hành | 10–12, 15, 17–19, 28, 30 | Session/queue/bộ nhớ có giới hạn; trạng thái save rõ ràng; khôi phục có quy trình |
| D — Hiệu năng | 16, 20–23 | Có số đo trước/sau, không làm sai privacy hoặc animation |
| E — Dễ phát triển | 24–27, 31–33 | Cấu trúc dễ đọc, CI đúng runtime, docs không mâu thuẫn, release tái lập được |

Không nhất thiết phải làm toàn bộ trước khi tiếp tục chơi local. Nếu mở online với nhiều người, các mục concurrency, auth, rate limit, recovery chuyển thành điều kiện bắt buộc. Không tự ý nâng thành microservices/Redis/Kubernetes; chỉ bổ sung hạ tầng khi mô hình triển khai thực sự cần.

## 3. Danh sách chi tiết và cách xử lý

### 01 — Không cho auth dùng secret công khai mặc định

**P0 khi bật tài khoản thật; xác nhận bằng giả lập.** Vị trí: `app/server/local-auth.mjs`, `createLocalAuth()`, `issueSession()`, `readSession()`; `app/local-server.mjs` phần khởi tạo.

`AUTH_SESSION_SECRET` thiếu thì dùng chuỗi cố định trong source. Người biết chuỗi đó có thể tự ký session. Nếu một triển khai thực tế bỏ cấu hình secret, việc kiểm chữ ký không còn bảo vệ danh tính; quyền admin còn phụ thuộc `ADMIN_ACCOUNT_IDS`. Chưa xác nhận triển khai hiện tại thiếu secret.

Cách làm:

1. Tạo bộ kiểm cấu hình ngay lúc startup, trước listen. Trong chế độ account/online: thiếu, quá ngắn hoặc trùng fallback cũ thì fail closed với thông báo không chứa giá trị secret.
2. Chế độ test truyền secret fixture rõ ràng. Nếu cần local dev tiện dụng, cho phép secret ngẫu nhiên mỗi process trong chế độ local được bật tường minh, và ghi rõ restart làm hết phiên.
3. Dùng secret ngẫu nhiên đủ mạnh, tối thiểu 32 byte ngẫu nhiên; cất ở môi trường triển khai, không trong Git/log/ZIP.
4. Nếu từng chạy account mode với fallback: đổi secret và buộc đăng nhập lại; đánh giá audit log riêng, không suy đoán rằng đã bị xâm nhập.

Kiểm thử/đạt: startup account mode thiếu secret phải fail; chữ ký cũ bị từ chối; secret khác không xác thực được session; test không in token. Phụ thuộc thêm mục 11–12, nhưng không chờ hai mục đó mới bỏ fallback.

### 02 — Ranked chỉ hoàn tất settlement sau khi lưu thành công

**DONE trong B51.** Vị trí: `app/server/ranked-v1.mjs`, `ranked-settlement-service.mjs`, storage pair transaction/WAL và durable settlement receipts.

Baseline ban đầu sửa trực tiếp hai live state và đặt `match.settled=true` trước `Promise.all(persist A, persist B)`. Khi lưu lỗi, rating live có thể đã đổi nhưng database chỉ lưu một bên hoặc không bên nào; retry lại thoát sớm vì cờ settled. Probe trong audit đã tái hiện lỗi này trước khi các batch settlement sửa contract.

Cách làm:

1. Clone state hai bên; tính rating, rank-ticket protection, mission và settlement receipt trên bản nháp. Đừng sửa object mà `getState()` đang trả.
2. Dùng operation ID bền vững từ match ID. Commit hai người chơi và receipt trong **một transaction database**, hoặc dùng journal/recovery protocol có thể khôi phục cho backend local.
3. Chỉ publish live state, đặt settled và notify sau commit. Khi lỗi: giữ operation ở trạng thái pending/retryable, không phát kết quả “đã lưu”.
4. Nếu response timeout nhưng DB có thể đã commit, đọc receipt theo operation ID trước khi retry; không tính lại delta từ rating đã thay đổi.
5. Không dùng `history.slice(0,20)` làm hàng rào exactly-once lâu dài. History phục vụ UI, settlement receipt phục vụ tính đúng.

Kiểm thử/đạt: giả lập lỗi trước ghi, ghi A thành công/B lỗi, timeout sau commit, hai lượt settle đồng thời, crash/restart sau commit trước notify. Rating/ticket/mission chỉ áp dụng một lần; hai account và receipt đồng nhất. Làm cùng mục 04–05, 08 và 18.

Kết quả B51: Ranked không còn fallback `Promise.all()` ghi riêng hai tài khoản. Thiếu `savePair` trả `RANKED_ATOMIC_STORAGE_REQUIRED` trước publish; transaction/WAL phải commit cả hai state cùng receipt rồi service mới thay live state và đặt `settled`. Các gate bao phủ thiếu atomic capability, lỗi trước commit, lost ACK sau commit, receipt lệch, retry lifecycle, ba lời gọi settlement đồng thời và JSON restart recovery. #18 tiếp tục là phạm vi riêng cho trận đang đánh khi process restart; #04 là coordination/ownership nhiều process, không phải điều kiện để settlement đã kết thúc được lưu an toàn. Chi tiết: [`../app/docs/ranked-settlement-closure-b51.md`](../app/docs/ranked-settlement-closure-b51.md).

### 03 — Bộ đóng gói chưa loại hết dữ liệu local

**P0 trước khi chia sẻ ZIP; xác nhận về policy lọc, chưa khẳng định một ZIP đã phát hành bị lộ.** Vị trí: `app/scripts/package-full.py`, `SKIP_DIRS`, `collect()`, `private()`; `app/tests/reward-assets.test.mjs` test packager.

Packager bỏ `.local-data`, `.dev.vars`, private-key suffix… nhưng không bỏ `backups`, `reports`, `content-candidates`, `node_modules`, `dist`. Git ignore không được áp dụng ở đây. Thư mục backups/reports thực tế có JSON và sẽ không bị loại chỉ vì nằm trong đó. Lowercase tên rồi so với `'.DS_Store'` cũng khiến entry đó không khớp.

Cách làm:

1. Định nghĩa manifest/allowlist cho gói source hoặc xuất danh sách file tracked cộng các example được duyệt. Không coi “tracked” đồng nghĩa tuyệt đối an toàn: vẫn cần kiểm secret và chính sách dữ liệu.
2. Chặn rõ dữ liệu người chơi, backup, report local, candidate download, dependency/cache/build không cần thiết; chỉ đưa report công khai vào gói nếu được allowlist riêng.
3. Prune thư mục ngay lúc duyệt, không `rglob` toàn cây rồi mới lọc. Chuẩn hóa case cho denylist, xử lý symlink/junction/reparse point theo nền tảng; xác nhận resolved path nằm trong project.
4. Thêm chế độ `--dry-run` liệt kê file và lý do bị loại, không in nội dung.
5. Mở rộng fixture test với `backups/player.json`, `reports/export.json`, `.admin-backups`, `node_modules`, `.DS_Store`, secret extension, nested directory và link ra ngoài. Kiểm cả danh sách ZIP sau ghi.

Kiểm thử/đạt: các fixture riêng tư không có trong archive; source/content/assets cần chạy vẫn đủ; giữ `.dev.vars.example`; thử cài/chạy ở thư mục sạch. Không thử bằng cách đóng gói save thật rồi tải ZIP lên dịch vụ. Tính tái lập ZIP tách ở mục 33.

### 04 — Một cơ chế khóa thống nhất cho account và match

**P1; xác nhận thiếu khóa chung, rủi ro race.** Vị trí: `app/local-server.mjs` room queue/lifecycle timer; `social-v1.mjs`, `ranked-v1.mjs`, `training-pvp-v1.mjs`, `admin-service.mjs`.

Queue từng room không khóa account đối phương. Social tác động hai người, Ranked/timer tác động match, admin có đường offline không nằm trong room queue. JavaScript một thread vẫn xen kẽ thao tác ở `await`. `savePair()` của Social còn sửa live state trước persist; probe xác nhận state bị sửa dù lưu lỗi.

Cách làm:

1. Tạo coordinator cấp service với `withAccounts(ids, work)` và `withMatch(id, work)`; account lock tồn tại độc lập với room/socket online.
2. Quy định thứ tự khóa thống nhất, ví dụ match trước rồi account ID đã sort. Không giữ A rồi chờ B theo thứ tự tùy request; tránh deadlock.
3. Chuyển WS action, admin, tick, social và settlement đi qua cùng coordinator. Tránh wrapper khóa lồng lại cùng mutex không reentrant.
4. Load/clone state mới nhất bên trong lock, validate, persist, publish. Không normalize hoặc mutate live object trước validate.
5. Khóa trong RAM chỉ bảo vệ một process; nhiều instance vẫn cần CAS/transaction ở mục 05.

Kiểm thử/đạt: dùng barrier-controlled fake storage để ép xen kẽ chat + mua hàng, accept bạn + admin grant, command + timeout, hai admin request vào account offline. Không mất tiền/item/message, không resolve một turn hai lần, không deadlock. Không dùng sleep ngẫu nhiên làm bằng chứng duy nhất.

### 05 — Supabase cần optimistic concurrency và transaction contract

**P1; xác nhận.** Vị trí: `app/server/storage-supabase.mjs`, `load()`, `save()`; `app/supabase/migrations/202609210001_vanguard_accounts.sql`.

`save()` upsert whole state và không gửi expected revision. Trigger SQL tăng cột revision, nhưng load chỉ lấy state; revision cột DB không phải khóa đối chiếu revision trong JSON. Hai writer có thể ghi đè nhau theo last-write-wins.

Cách làm:

1. Chuẩn hóa adapter: `load -> {state, storageRevision}`; `save -> {storageRevision}` và nhận `expectedRevision`, `operationId`. Không tái sử dụng tùy tiện `state.revision` làm revision DB.
2. Thêm migration/RPC dùng compare-and-swap: update đúng user và revision, trả conflict nếu không còn khớp. Tạo mới xử lý riêng expected “chưa tồn tại”.
3. Tạo RPC transaction cho thao tác hai account/settlement; kiểm danh tính, operation ID, input constraints và cấp execute đúng service role, không mở write cho client.
4. Conflict phải reload và đánh giá lại command; không merge mù hai JSON hoặc retry request thanh toán với ID mới.
5. Đưa adapter local và fake test về cùng contract; rollout database trước ứng dụng, có backup/rollback tương thích.

Kiểm thử/đạt: hai writer cùng revision chỉ một commit; writer sau nhận conflict rõ; transaction hai account all-or-nothing; RLS/read-own-save vẫn giữ. Test trên DB disposable, không account thật.

### 06 — Queue không được hỏng vĩnh viễn sau một exception

**P1; rủi ro từ promise chain.** Vị trí: `app/local-server.mjs`, callback `withAccountLock` truyền admin, `ws.on('close')`.

Admin nối `target.queue.then(work)` rồi await; nếu work throw, tail bị rejected. Close lại nối `.then()` không có recovery, nên cleanup có thể bị bỏ qua. WS handler có catch ở đường riêng không bảo đảm mọi loại job dùng cùng quy tắc.

Cách làm:

1. Viết abstraction queue riêng: promise của job trả lỗi cho caller; tail dùng nội bộ luôn được phục hồi sau job thất bại.
2. Pattern: tạo `job = tail.then(work)`; gán `tail = job.catch(reportSafely)`; trả `job`, không trả tail đã nuốt lỗi.
3. Dùng abstraction cho message/admin/close; cleanup resource đặt trong `finally` phù hợp.
4. Thêm queue depth, thời gian chờ và deadline; kết hợp mục 10, 14.

Kiểm thử/đạt: job A throw, job B vẫn chạy; caller A vẫn nhận lỗi; socket close vẫn unregister; không có unhandled rejection. Tách khỏi mutex đa account ở mục 04 nhưng thống nhất cách recovery.

### 07 — Kiểm tra số nguyên an toàn ở trung tâm economy

**P1; xác nhận helper nhận số không hợp lệ, chưa chứng minh có đường client trực tiếp khai thác.** Vị trí: `app/server/v2-economy-ledger.mjs`, `ensureEconomyState()`, `applyEconomyTransaction()`.

Coins/crystals/recruitmentTickets dùng `Math.trunc` nhưng không bảo đảm finite/safe integer như các ticket mới. Probe truyền Infinity được chấp nhận và serialize thành null. JSON thường không mang Infinity, nhưng số quá lớn, dữ liệu migration hoặc phép tính nội bộ vẫn cần chặn.

Cách làm:

1. Viết validator chung cho balance và signed delta: kiểu number, `Number.isSafeInteger`, trong giới hạn nghiệp vụ được thống nhất.
2. Validate cả đầu vào lẫn kết quả cộng cho mọi loại tiền/ticket trước khi mutate. Không tự coerce chuỗi hoặc đổi dữ liệu lỗi về 0 một cách im lặng.
3. Với save cũ hỏng: trả lỗi có thể chẩn đoán/quarantine và recovery, không âm thầm xóa tài sản.
4. Rà mọi caller shop/training/mail/admin/recruitment; giữ check tập trung ngay cả khi caller đã validate.

Kiểm thử/đạt: NaN, Infinity, -Infinity, số thập phân, chuỗi, `1e309`, safe-integer overflow và số dư âm bị từ chối; state trước/sau lỗi giống hệt; số hợp lệ và rank protection vẫn đúng.

### 08 — Idempotency xuyên suốt retry, không chỉ trong UI

**DONE trong B50.** Vị trí: receipt-backed player/Admin/Social/Ranked commands, `player-action-retry-policy.mjs`, browser outbox và archive B49.

Game đã có action receipt là điểm tốt. Tuy nhiên campaign ID được tạo mới mỗi POST; nếu admin mất response và bấm lại thì có thể thành campaign khác. Ranked receipt chỉ giữ 200 entry trong RAM. Fingerprint helper mặc định chỉ có type nên cần kiểm từng command gọi nó, không kết luận tất cả caller hiện bị collision.

Cách làm:

1. Định nghĩa envelope gồm protocol version, action ID, type, expected revision và payload. ID của cùng ý định giữ nguyên qua retry.
2. Fingerprint canonical của toàn payload có ý nghĩa, kèm account/type; cùng ID khác payload phải conflict.
3. Lưu receipt và thay đổi dữ liệu trong cùng transaction. Duplicate trả đúng kết quả cũ, không thực thi lại.
4. Campaign admin dùng client request ID được kiểm tra/dedupe ở server, lưu audience snapshot và trạng thái từng recipient; retry chỉ tiếp tục phần chưa hoàn thành.
5. Quy định thời hạn retry và thời hạn lưu dedupe; retention không được mở lại cơ hội claim cũ.

Kiểm thử/đạt: double-click, mất ACK, reconnect, restart, cùng ID khác payload, campaign partial failure. Mỗi ý định chỉ tạo một khoản trừ/cộng; không chỉ test “UI đã disabled button”.

Kết quả B50: mọi mutation bền trong runtime schema-2/schema-3 dùng action ID ổn định, fingerprint payload, receipt cùng commit, authoritative/archive lookup và ACK `committed`. Khoảng trống cuối ở V2 Recruitment/Mail đã được đưa qua commerce outbox và có real-WebSocket restart duplicate/conflict test. `player-action-retry-policy.mjs` phân loại bằng mã chạy: lệnh Ranked/Friendly giữa trận chỉ ACK `session`; khôi phục owner/snapshot/timer sau process restart vẫn thuộc #18 DEFERRED, không phải thiếu receipt của mutation account. Mailbox mark-read là assignment metadata idempotent; legacy finish là migration tương thích. Bằng chứng: `app/docs/action-retry-closure-b50.md`.

### 09 — Giới hạn dữ liệu nóng mà không phá chống nhận thưởng trùng

**DONE trong B49.** Vị trí: `hot-state-retention.mjs`, `hot-state-archive.mjs`, JSON/Supabase storage và các đường action hydrate receipt.

Ledger/receipt lớn dần làm `.find()`, clone, serialize và write JSON đắt hơn. Battle view còn phát `battle.events` history; Social giới hạn 100 message/mỗi cuộc trò chuyện nhưng phát nhiều cuộc trò chuyện trong toàn view. Không được giải quyết bằng `slice(-N)` receipt thanh toán.

Cách làm:

1. Đo kích thước từng nhánh trên save synthetic 1k/10k/100k giao dịch, không dùng save người chơi thật để benchmark public.
2. Tách lịch sử/audit/chat sang store phân trang; state nóng giữ balances, ID tham chiếu và phần UI đang cần.
3. Duy trì dedupe bền bằng unique operation key, claim entitlement hoặc tombstone đủ thời hạn; migration ledger phải bảo toàn khóa.
4. Dùng index in-memory dẫn xuất cho lookup nếu benchmark cần; không serialize Map vào save JSON.
5. Chỉ gửi event mới có cursor, giữ cửa sổ playback đang cần và endpoint lấy lịch sử cũ.

Kết quả B49: hot window giới hạn receipt/ledger và history của battle đã kết thúc; JSON dùng segment + manifest bền, Supabase dùng backup row private theo key và partial lookup index. Quy trình full-save → archive → compact không thể mất replay barrier khi chết giữa chừng; action ID cũ hydrate đúng receipt trước mutation. Benchmark synthetic 1k/10k/100k giảm save 65.263.089 B xuống 1.390.026 B ở 100k (97,870%), serialize hot p95 5,403 ms. Social vẫn có trần 100×100; active battle không bị cắt khi còn chơi. Bằng chứng: `app/docs/hot-state-archive-b49.md`.

Kiểm thử/đạt: JSON single/pair, process restart thật, retry ngoài hot window không ghi lần hai, Supabase mock archive/hydrate, migration policy, lost-ACK Social/Ranked/commerce, full regression và hosted CI. Migration index B49 cần apply trước production để tránh table scan; correctness của archive không phụ thuộc index. Multi-process ownership và mid-match PvP vẫn thuộc #04/#18, không mở lại #09.

### 10 — Giới hạn WebSocket: kết nối, queue, tốc độ và backpressure

**P1 trước online; xác nhận có maxPayload/heartbeat nhưng thiếu giới hạn các chiều khác ở server hiện tại.** Vị trí: `app/local-server.mjs`, upgrade, connection/message, `send()`.

Cách làm:

1. Giới hạn số socket/account và IP, deadline phải join sau upgrade, giới hạn action/giây và queue depth theo account; cấu hình thông số, không hardcode theo cảm tính.
2. Parse/kiểm envelope nhẹ và byte size trước enqueue việc nặng; ping cũng có giới hạn. Chat 750 ms riêng không thay thế rate limit toàn giao thức.
3. Kiểm `ws.bufferedAmount`; socket chậm quá ngưỡng phải đóng hoặc coalesce state snapshot, không xếp vô hạn.
4. Không bỏ receipt/action-result hoặc event thiết yếu khi coalesce. State mới nhất phải có revision để resync đầy đủ.
5. Áp dụng quota hợp lý cho HTTP damage inspector/public catalog; không mặc định mọi endpoint public đều cần đăng nhập.

Kiểm thử/đạt: client không join, flood message nhỏ, nhiều tab, frame quá lớn, socket không đọc, malformed JSON. Bộ nhớ/queue có trần, người khác không bị starvation, phản hồi có code nhất quán. Load-test bằng fixture local, không tấn công dịch vụ đang chạy.

### 11 — Vòng đời session phải bao gồm socket và thu hồi phiên

**P1; xác nhận auth đọc khi upgrade, logout chủ yếu xóa cookie.** Vị trí: `local-auth.mjs`, `readSession()/logout/dev`; `local-server.mjs` session captured khi kết nối; `public/js/net.js` reconnect.

Cách làm:

1. Kiểm expiry trước action và/hoặc timer đóng socket đến hạn; báo `AUTH_EXPIRED` để client quay lại login, không reconnect vô tận.
2. Quyết định logout một phiên hay toàn tài khoản. Nếu cần revoke: thêm session ID/version store và disconnect các socket thuộc đúng phạm vi.
3. Suspend cần chặn action/reconnect theo trạng thái hiện tại; không chỉ tin session cũ hoặc việc đóng socket trước đó.
4. Validate schema session: UUID account cloud, provider allowlist, player/room mapping chính xác; không chỉ kiểm truthy field.
5. Đồng bộ quy tắc local ID: dev login hiện cho legacyPlayerId 128 ký tự nhưng room `aether-...` chỉ cho 64. Chấp nhận tối đa phù hợp hoặc dùng mapping ổn định; không đổi ID khiến mất liên kết save cũ.

Kiểm thử/đạt: socket mở qua expiry, logout ở tab khác, suspend rồi reconnect, invalid provider/room, local ID sát giới hạn. Test clock giả để không đợi bảy ngày. Không tự động nâng quyền local admin.

### 12 — Origin và cookie đúng khi chạy qua HTTPS proxy

**P1 trước internet; xác nhận URL nội bộ được dựng bằng HTTP.** Vị trí: `local-server.mjs` tạo `new URL(..., http://Host)`; `local-auth.mjs::secure()` và OAuth callback; `admin-service.mjs` origin check.

Auth xác định Secure cookie và callback theo URL truyền vào, nhưng server dựng URL HTTP. Nếu sau này reverse proxy terminate TLS, backend không tự biết public origin. Host-only comparison cũng chưa phải full origin policy. Localhost HTTP hiện là trường hợp sử dụng có chủ đích.

Cách làm:

1. Cấu hình public origin chuẩn, validate khi startup; dùng cho callback và cookie policy. Chỉ tin forwarded headers từ proxy được định nghĩa, không tin header bất kỳ từ internet.
2. Kiểm full origin và allowed host trên các endpoint cần bảo vệ. Quy định rõ browser WS có bắt buộc Origin không; client nội bộ không-Origin cần policy riêng.
3. State-changing cookie-auth HTTP cần CSRF token hoặc strict origin/fetch-metadata policy có test; SameSite là một lớp hỗ trợ.
4. Áp dụng CSP từ report-only rồi enforce sau khi rà inline style/asset; thêm frame-ancestors/referrer policy. Không bật HSTS cho localhost HTTP.

Kiểm thử/đạt: localhost vẫn login được; HTTPS proxy tạo callback HTTPS và Secure cookie; host/origin giả bị từ chối; OAuth provider callback hợp lệ không bị chặn nhầm. Không ghi token/authorization header vào log.

### 13 — Save JSON: schema, concurrent write và recovery

**P1; xác nhận adapter kiểm JSON syntax nhưng chưa kiểm schema đầy đủ.** Vị trí: `storage-json.mjs::load/save/backup/restore`, `migrations.mjs`, đường load/join trong server.

Temp-file + rename tốt hơn ghi đè trực tiếp, nhưng file `.tmp` cố định có thể xung đột nếu nhiều writer; JSON parse thành công không chứng minh save hợp lệ. Backup với label cố định có thể ghi đè bản trước trên local backend.

Cách làm:

1. Dùng lock mục 04 và temp filename duy nhất cùng volume; không để writer thứ hai đè temp writer thứ nhất.
2. Validate envelope/schema/invariants trên load, trước save và restore; từ chối schema tương lai, invalid owner, invalid balance, missing referenced build/item.
3. Với yêu cầu bền vững qua mất điện: flush file trước rename và bổ sung sync phù hợp nền tảng; ghi rõ mức bảo đảm Windows/filesystem, không gọi rename là transaction đa file.
4. Backup có ID/time duy nhất, checksum, schema/catalog version; retention có cấu hình. Save lỗi giữ nguyên dữ liệu cũ để recovery, không tự reset game.
5. Restore trên bản sao, validate rồi mới commit; yêu cầu quy trình backup-before-restore. Không tự xóa `.local-data` khi test lỗi.

Kiểm thử/đạt: JSON truncated, JSON hợp lệ nhưng schema sai, future version, disk full/permission lỗi, concurrent save, stale temp, restore sai account. Test temp directory riêng; bản tốt cũ luôn còn hoặc có recovery rõ ràng.

### 14 — Deadline cho I/O và phân loại lỗi

**P1; xác nhận fetch adapter không đặt deadline tại chỗ.** Vị trí: `storage-supabase.mjs::request`, `local-auth.mjs` exchange/profile sync, `pokemon-ui-icons.mjs` proxy, HTTP catch trong server.

I/O chậm giữ queue lâu; retry bừa write có thể nhân đôi nghiệp vụ. HTTP catch hiện thường trả “Not found”/400 cả cho lỗi khác, làm khó phân biệt lỗi client và backend.

Cách làm:

1. Wrapper fetch với AbortSignal/deadline, phân loại timeout/network/429/5xx/4xx và correlation ID; không đưa response chứa secret ra client.
2. Retry có backoff+jitter và giới hạn tổng thời gian cho read an toàn. Write chỉ retry khi có operation receipt/CAS và xử lý “không biết đã commit chưa”.
3. Trả 400/401/403/404/409/413/429/503 theo nghĩa tương ứng; lỗi nội bộ log server rồi trả thông điệp an toàn.
4. Icon proxy dedupe in-flight request theo URL, timeout, giới hạn kích thước response, kiểm loại dữ liệu và giữ allowlist nguồn. Danh sách nguồn hữu hạn đã tốt, không cần mở proxy URL tùy ý.
5. Shutdown ngừng nhận việc mới, đợi queue trong deadline và ghi phần chưa hoàn tất để recovery; không treo vô hạn khi upstream chết.

Kiểm thử/đạt: upstream treo, 429, 500, JSON sai, write timeout sau commit, shutdown khi persist pending. Không mất command âm thầm và không retry vô hạn.

### 15 — Public projection theo allowlist và không mutate state

**P1 về phòng ngừa privacy; rủi ro, chưa xác nhận rò field cụ thể.** Vị trí: `local-server.mjs::broadcast`, `v3-battle-view.mjs`, `pvp-battle-runtime.mjs`, các hàm `viewFor()`/`ensure*()`.

Server đã có lọc thông tin đối thủ và loại private field. Nhưng `...publicAdventure` dựa trên denylist dễ bỏ sót field mới. Một số view gọi ensure/normalize nên việc đọc có thể sửa state; cache projection sau này sẽ khó đúng.

Cách làm:

1. Định nghĩa DTO schema riêng owner/opponent/spectator/admin; dựng field rõ thay vì copy-rest nguyên state.
2. Normalize/migrate ở command/load boundary; projector chỉ đọc state và nhận clock explicit. Với timing view, không tự cập nhật decision clock trong bước serialize.
3. Test deep-freeze input cho projector; cùng input/time cho cùng output và không thay đổi state.
4. Privacy test dùng canary ở private build, seed/RNG, unrevealed item/ability, admin audit, receipt, conversation khác; serialize toàn response rồi kiểm canary không xuất hiện ở vai trò sai.
5. Review cả events, history, last-turn snapshots và error details, không chỉ snapshot cuối.

Kiểm thử/đạt: negative tests cho spectator/opponent; owner vẫn đủ data cho UI. Tách bước này trước tối ưu cache/delta ở mục 16 để không cache nhầm view người khác.

### 16 — Giảm full-state broadcast và render lại toàn trang

**P2; xác nhận cơ chế, hiệu quả cần đo.** Vị trí: `local-server.mjs::broadcast`; `public/client.js::receiveView/draw/captureRenderContinuity`; `social-v1.mjs::viewFor`; battle history projection.

Broadcast tính nhiều view V2/V3/mail/social/profile/shop cho mỗi socket. UI `draw()` thay toàn `#app.innerHTML`; đã phải capture/restore focus và scroll. Không có số đo đủ để khẳng định đây là bottleneck lớn nhất, nhưng phạm vi làm lại là rõ ràng.

Cách làm:

1. Đo JSON bytes, projector time, serialization time, socket buffer, render/long tasks theo scenario: idle, chat, bag, team edit, double battle, reconnect.
2. Tính shared projection một lần cho cùng owner/revision/time bucket khi an toàn; cache key gồm role/player/catalog. Spectator bị loại sớm trước khi tính các view không dùng.
3. Tách shell/sidebar/resource bar khỏi nội dung route; update phần thay đổi. Thử trên Bag/Profile trước battle playback.
4. Dùng domain revision/cursor để chỉ tính và phát nhánh thay đổi; full snapshot vẫn cần cho join/reconnect/resync. Hợp nhất push cùng tick nếu không làm sai command ordering.
5. Delta phải có base revision và resync khi lệch; không bỏ event animation giữa turn hoặc đồng nhất thời gian PvP với state revision một cách tùy tiện.

Kiểm thử/đạt: hai tab cùng state, input/focus/scroll không mất khi có chat/presence push, playback đúng một lần và thứ tự; báo trước/sau bytes, p50/p95 thời gian CPU/render. Không đặt mục tiêu giảm % khi chưa có baseline.

### 17 — Thu hồi room và presence khi không còn dùng

**P1 cho server chạy lâu; xác nhận `rooms` không có eviction trong local-server.** Vị trí: room Map, close callback; presence Map của Social/Ranked/PvP.

Ranked đã có timeout/cleanup match, không nên báo sai là mọi match tồn tại mãi. Room state/account presence vẫn cần lifecycle riêng, đặc biệt khi nhiều người ghé qua một process lâu ngày.

Cách làm:

1. Ghi `lastActiveAt`, `dirty`, queue pending, số socket, PvP references. Evict chỉ khi không socket, không job đang chạy, không match/grace period cần state và dữ liệu đã commit.
2. TTL/LRU có hard cap và metrics; xóa presence metadata/lastMessageAt theo policy sau khi không còn tham chiếu cần thiết.
3. Khi notify account đã evict, không tự tạo room mới nếu không có client; load lại khi cần command/join.
4. Registry lock mục 04 phải cleanup riêng, không xóa mutex đang có waiter.

Kiểm thử/đạt: 1.000 account synthetic connect/disconnect, clock tiến qua TTL, heap về mức ổn định; trận đang reconnect grace không bị evict; rejoin load đúng state.

### 18 — Khôi phục PvP sau restart và ownership nhiều process

**P1 trước Ranked online ổn định; giới hạn kiến trúc hiện tại.** Vị trí: Ranked/TrainingPvP service in-memory matches/queue; `pvp-lifecycle.mjs`; shutdown server.

Cách làm:

1. Chốt policy: local beta restart có thể hủy trận không tính điểm; online cần khôi phục hoặc settle/no-contest có receipt. Hiển thị policy thay vì ngầm hứa trận không mất.
2. Persist match snapshot/event log, participants, phase revision, pending commands, seed/RNG, catalog/rules version, deadlines, settlement status. Không lưu socket/Set/Map nguyên dạng không có serializer.
3. Khởi động quét match chưa kết thúc, claim ownership rồi resume deadline hoặc áp dụng no-contest theo policy; không bắt người chơi thua vì downtime của server nếu chưa thống nhất.
4. Nếu chạy nhiều instance: account/match lease hoặc routing owner duy nhất, fencing token và CAS. Sticky session đơn thuần không giải quyết crash/double settlement.
5. Giữ content version cần replay; backup/restore có diễn tập.

Kiểm thử/đạt: kill/restart tại preview, sau A submit, sau resolve trước persist, sau commit trước notify. Không nhận thưởng/trừ ticket hai lần; không reveal pending command đối phương. Liên quan chặt 02/04/05/08/27.

### 19 — ACK rõ ràng và phân biệt “kết nối” với “đã lưu”

**P1 về độ tin cậy UX; xác nhận.** Vị trí: `public/js/net.js`, `public/client.js::send/receiveView/draw`.

Client có boolean `pending` và xóa nó khi nhận bất kỳ state; presence push cũng có thể làm vậy. Dòng “ADVENTURE SAVED” dựa vào socket connected, không phải xác nhận persistence. Một socket mở không bảo đảm command cuối đã commit.

Cách làm:

1. Server trả `actionResult` gắn action ID, committed revision và status; client giữ pending theo ID/domain thay vì một boolean toàn cục.
2. State update không liên quan không tự xác nhận command đang chờ. Sau reconnect hỏi receipt/resync trước khi cho retry giao dịch.
3. Hiện rõ connecting/online/saving/saved/save failed; saved dựa trên ACK commit, không chỉ onopen.
4. Reconnect thêm jitter và xử lý close code auth/suspend/nonretryable riêng. Có deadline cho handshake/join.
5. Không auto-replay mọi action offline; battle command có phase revision cũ phải từ chối hoặc yêu cầu chọn lại.

Kiểm thử/đạt: presence push chen trước ACK, lost ACK, reconnect khi thanh toán, auth hết hạn, slow save. UI không báo saved sai và không phát sinh purchase mới khi retry cùng ý định.

### 20 — Cache và nén HTTP theo loại tài nguyên

**P2; xác nhận static/catalog đang no-store, catalog stringify mỗi request.** Vị trí: `local-server.mjs` routes static/catalog.

Cách làm:

1. Serialize catalog public một lần khi load catalog; ETag theo hash/version, trả 304 khi phù hợp. V3 hiện khoảng 909 KB chưa nén nên đo cả encoded bytes.
2. Static có tên hash: cache immutable dài. File chưa version/hash: ETag/revalidate hoặc TTL ngắn; HTML/bootstrap kiểm phiên luôn revalidate phù hợp.
3. Giữ `no-store` cho session/save/admin/private response; không cache response theo user bằng key URL chung.
4. Dùng compression HTTP ở server/proxy hoặc precompressed assets; negotiate Accept-Encoding và Vary. Không nén PNG/ZIP lại tùy tiện.
5. Static lớn nên stream hoặc cache có giới hạn thay vì mỗi request readFile toàn bộ; xử lý HEAD, stream error và client disconnect đúng.

Kiểm thử/đạt: cold/warm reload, ETag 304, catalog version mới không bị stale, HEAD không body, gzip/Brotli hợp lệ, private response không cache. Đo request count/bytes/thời gian; dev mode có thể giữ revalidate nhanh để sửa file không vướng cache.

### 21 — Lazy-load UI và catalog theo nhu cầu

**P2; xác nhận.** Vị trí: `public/client.js` static imports và hai lời gọi `trainingEditor.load()`/`v3TrainingEditor.load()`; `public/index.html`; các training editor.

V2 và V3 cùng được load khi client khởi động. Người dùng V3 không nhất thiết cần toàn UI/catalog V2 ngay, nhưng save cũ vẫn cần đường tương thích.

Cách làm:

1. Tạo route module registry với `import()` và shared catalog loader memoize promise theo version; trạng thái loading/error/retry rõ.
2. Chọn catalog cần thiết theo save/protocol capabilities từ server; V2 chỉ tải khi route hoặc legacy state cần, không xóa fallback.
3. Lazy-load màn phụ như damage inspector/legacy training; preload phần battle có khả năng dùng sớm sau khi shell interactive.
4. Asset/CSS lazy phải có ready barrier trước render để tránh flash/layout shift. Chưa cần thêm bundler nếu native modules đáp ứng; benchmark rồi mới quyết định.

Kiểm thử/đạt: V3 fresh session không tải V2 ngoài nhu cầu; save v1 battle đang diễn ra vẫn hoạt động; đổi route liên tục không fetch trùng; lỗi mạng một module không làm chết cả shell.

### 22 — Ảnh đúng kích thước hiển thị và có manifest

**P2; đo trước, bằng chứng asset lớn.** Vị trí: `public/assets/items`, `public/ranks`, `public/js/reward-assets.js`, `ranked-tier-view.js`, `presentation-assets.js`, `server/pokemon-ui-icons.mjs`.

Hai ảnh ví dụ 1254×1254, khoảng 1,1 MB mỗi ảnh, có thể không cần độ phân giải đó cho icon/card nhỏ. Không kết luận toàn bộ ảnh nên nén lossy hoặc xóa trùng; artwork/form fallback có chủ đích.

Cách làm:

1. Đo kích thước CSS và DPR thực tế, số ảnh tải/màn; phân loại artwork lớn, icon, rank badge, sprite pixel art.
2. Sinh bản runtime đúng cỡ 1×/2× từ master, giữ master ở nguồn riêng; chọn lossless/lossy theo QA alpha và pixel edges, không một preset cho mọi ảnh.
3. Gắn width/height/aspect-ratio; lazy-load ảnh ngoài viewport, decode async khi phù hợp; không lazy hero/LCP một cách máy móc.
4. Manifest ghi source, checksum, dimensions, variants, license/attribution. Ưu tiên vendor icon đã được phép phân phối để không phụ thuộc proxy upstream lúc chơi.
5. Hash duplicate chỉ để tìm ứng viên; cập nhật mọi manifest/reference rồi mới bỏ file vật lý thực sự thừa.

Kiểm thử/đạt: ảnh trong suốt, palette, form và front/back đúng; không vỡ ở DPR2; asset checks đạt; đo transfer/decode/layout shift trước/sau. Rà quyền sử dụng riêng trước public release, không suy ra giấy phép từ việc URL tải được.

### 23 — CSS theo layer, giữ hợp đồng cascade

**P2; xác nhận 31 stylesheet khởi đầu.** Vị trí: `public/index.html`, `pixel-era-ui.css`, `r3-release-polish.css`, `pokemon-battle-shell.css` và các route CSS; `docs/code-structure.md`.

Cách làm:

1. Chụp baseline các route/viewport trước thay đổi. Inventory selector trùng, override, `!important`, token màu/khoảng cách và rule chỉ dùng legacy.
2. Định nghĩa thứ tự layers: base/tokens/components/routes/theme/overrides. Việc đưa rule vào CSS layer làm đổi ưu tiên so với rule chưa layer, nên migrate có kiểm soát.
3. Chuyển từng nhóm page-specific ra file route; không sort, concatenate đổi thứ tự hoặc xóa override chỉ vì trông giống duplicate.
4. Giữ interface class `.aether-window` khi caller còn dùng; đổi tên chỉ với migration reference và regression riêng.
5. Sau parity mới bundle/minify hoặc lazy-load để giảm round trip; source vẫn phải đọc được.

Kiểm thử/đạt: ảnh đối chiếu Bag/Shop/Training/PvP/modal ở 360, 768, 1366 và 1920 px, zoom/large UI/reduced motion/contrast. Không thay đổi rule battle hoặc event names. Tài liệu audit 23/09 đã cảnh báo cascade này; không lặp lại việc tách file cơ học.

### 24 — Tách module theo trách nhiệm thay vì nén để qua 360 dòng

**P2; xác nhận.** Vị trí: `public/client.js`, `public/admin.js`, `local-server.mjs`, `server/ranked-v1.mjs`, `mechanics-v3/manifest-contract.mjs`, `scripts/check-source-structure.mjs`.

Gate 360 dòng đang hữu ích nhưng không phản ánh complexity khi một dòng dài hàng nghìn ký tự. `presentation-assets.js` dạng dữ liệu là trường hợp khác code control-flow, cần phân loại trước khi ép gate.

Cách làm:

1. Thống kê byte, độ dài function, nhánh, dependency; formatter thống nhất sau khi điều chỉnh gate để không ép code bị nén lại.
2. Server composition root chỉ wiring; tách HTTP routing, auth policy, command dispatch, account coordinator, projection/broadcast và lifecycle.
3. Client shell tách route rendering, modal/mail/settings/account controls, action dispatch, playback integration; interface `mount/update/unmount` nếu cần lifecycle rõ.
4. Ranked tách queue matching, match transitions, settlement và projection; không tách thành nhiều file chỉ chuyển một chuỗi if dài sang nơi khác.
5. Thêm import-boundary/cycle check: rules không phụ thuộc server/DOM; mechanics không fetch; server không nhập UI renderer; shared data contract đặt ở lớp trung lập thay vì server nhập public implementation.
6. Refactor từng module với characterization tests, public facade/export ổn định. Format-only commit tách semantic change; file generated vẫn sửa nguồn generator.

Kiểm thử/đạt: full suite/check, replay parity, không đổi API/export mà không migration caller. Gate mới có ngoại lệ generated/frozen/data được khai báo cụ thể, không miễn cả thư mục code sống.

### 25 — Lint, type contract và loại code smell theo từng lớp

**P2; xác nhận thiếu bước lint/typecheck cho phần local JS trong package hiện tại.** Vị trí: `app/package.json`, `app/tsconfig.json`, JS/MJS production.

`check:syntax` chỉ chứng minh parse được. tsconfig hiện thiên Workers, `allowJs:false`, không kiểm phần lớn code local; không nên nói dự án hiện có type safety cho JS vì thấy file tsconfig.

Cách làm:

1. Thêm lint nền tảng cho unused import/variable, promise không xử lý, accidental coercion và import boundary. Lập baseline để không tạo PR hàng nghìn thay đổi không liên quan.
2. JSDoc + checkJs hoặc schema-derived types trước cho Command/Result/Save/DTO/Storage. Cấu hình Node và DOM riêng, tách tsconfig cloud cũ.
3. Runtime schema validation vẫn bắt buộc tại biên client/save/content; type tĩnh không thay validate dữ liệu lạ.
4. Chọn một chuẩn clone theo contract JSON/plain data, không thay toàn bộ JSON clone bằng structuredClone mà chưa kiểm semantics undefined/NaN/Map/prototype.
5. Chỉ đưa TypeScript rộng hơn nếu team thấy lợi ích; không rewrite toàn repo trong một lần.

Kiểm thử/đạt: CI bắt sai action payload, thiếu await/result branch, import sai layer; thay đổi không tác động save serialization. Ưu tiên những vùng có lỗi 02/04/07.

### 26 — CI và test phải kiểm đúng thứ đang phát hành

**P1 cho cộng tác/release, P2 cho local một người; xác nhận.** Vị trí: chưa có `.github/` trong checkout; `package.json`, `scripts/run-tests-batched.mjs`, `tests/*.test.ts`, các test kiểm source bằng regex.

Runner chỉ liệt kê `.test.mjs` cấp đầu; test lồng thư mục sau này có thể bị bỏ. `--test-force-exit` giúp kết thúc batch nhưng có thể che open handle. Test regex kiểm wiring tốt, không thay test hành vi thật.

Cách làm:

1. CI checkout sạch, Node version được pin hợp lệ, Python phù hợp packager, `npm ci`, `npm run check`, `npm test`; matrix Windows/Linux cho path/package portability.
2. Quy định rõ `.test.ts` thuộc cloud archive hay còn supported. Nếu archive, ghi ở docs và tách job; không hứa toàn bộ test đều chạy bằng npm test.
3. Discovery recursive có exclude rõ, xuất manifest số test; fail nếu không test hoặc summary không parse được. Bắt cả spawn error, không chỉ close code.
4. Thêm một job không `--test-force-exit` để phát hiện timer/socket chưa đóng; cleanup test phải await close.
5. Bổ sung fault-injection/regression 01–19, browser E2E tối thiểu login fixture → bag/shop/training → battle → reload/reconnect; mock external auth, không đưa secret production vào PR workflow.
6. Snapshot/regex tests giữ cho contract ổn định, giảm assertion phụ thuộc whitespace/đường import sau khi refactor. Thêm deterministic/property tests cho rules và conservation/idempotency economy.

Kiểm thử/đạt: clean clone chạy được, mọi test được discover/ghi lý do exclude; CI không ghi lại generated artifacts ngoài ý muốn (`git diff --exit-code` sau verify). Coverage ưu tiên critical paths, không chỉ chạy theo một % toàn repo.

### 27 — Quản lý snapshot content và kích thước repo

**P2; xác nhận nhiều catalog version tracked; không xem mọi snapshot là rác.** Vị trí: `app/content-active/active.json`, `content-active/catalogs/*`, `content-import/*`, `server/v3-catalog.mjs`, tài liệu provenance.

Catalog lớn nhất khoảng 1,88 MB; nhiều version liên tiếp chứa snapshot đáng kể. Hash active đã được verify khi load là điểm tốt. Snapshot lịch sử có thể đang phục vụ migration, parity/replay và provenance, nên xóa mù sẽ hỏng khả năng tái tạo.

Cách làm:

1. Xây dependency inventory: active pointer, test fixtures, migration, match/replay đang tham chiếu version nào. Phân loại current / compatibility-required / archive-only.
2. Giữ immutable version và hash; archive-only có thể chuyển sang release artifact/content-addressed storage **sau khi** có vị trí tải, checksum, retention và restore test.
3. Runtime package chỉ gồm active + compatibility cần hỗ trợ, source/research package có thể đầy đủ hơn.
4. Release gate kiểm mọi ID/handler/reference/assets của active catalog và version đã support, kiểm thêm UI icon validation đang có script nhưng không nằm trong check tổng.
5. Không rewrite Git history hoặc triển khai LFS tùy tiện. Đo fresh-clone/disk/release size để quyết định; mọi history rewrite cần yêu cầu riêng.

Kiểm thử/đạt: fresh checkout offline trong phạm vi đã cam kết vẫn start; migrate save cũ/replay version được support; hash mismatch fail rõ; không phát candidate chưa duyệt thành active.

### 28 — Admin overview không được hiển thị tổng giả từ 100 account đầu

**P1 về tính chính xác dashboard; xác nhận.** Vị trí: `admin-service.mjs::overview/listAllAccounts`, `storage-supabase.mjs::listAccounts`.

Overview lấy limit 100 rồi tính online/suspended/totalVp/totalCrystals/rankDistribution trên phần đó, trong khi players lấy total toàn DB. Khi có hơn 100 account, các chỉ số không cùng phạm vi. listAccounts còn tải full state để dựng summary.

Cách làm:

1. Ngắn hạn: ghi rõ các số là “trên N account đã tải”, không gọi đó là tổng toàn hệ thống.
2. Dài hạn: API aggregate riêng phía DB cho count/sum/rank; online lấy từ registry đúng phạm vi, không suy từ trang 100 người.
3. List chỉ trả summary fields; full save chỉ tải khi xem detail hoặc thực thi mutation. Có thể projection table/materialized view sau khi đo, cập nhật cùng transaction nguồn.
4. Campaign audience dùng keyset pagination ổn định và snapshot IDs; không gom 50k full save vào RAM rồi giữ trong HTTP request dài.
5. Rà query plan trước khi thêm index cho search/order; test RLS/role của aggregate không lộ dữ liệu cho người chơi.

Kiểm thử/đạt: fixture 150–250 account có số tổng đã biết; phân trang không trùng/bỏ người khi updated_at đổi; summary không chứa state/private fields; admin UI ghi scope rõ.

### 29 — Social: giới hạn tại accept và profile offline chính xác

**P1; xác nhận từ nhánh action.** Vị trí: `social-v1.mjs::action/profile/stateFor/savePair`.

Friend request kiểm số lượng, nhưng accept không kiểm lại trần 100 hai bên. Hai bên có thể đạt trần sau khi request được gửi. Profile target ưu tiên presence nên người chưa từng online trong process có thể hiện tên fallback thay vì profile đã lưu.

Cách làm:

1. Trong lock hai account, kiểm lại capacity và mutual request/friend state tại accept; duplicate accept xử lý idempotent.
2. Mutation trên clone, commit cả pair rồi publish, như mục 04–05. Validate target trước mọi thay đổi.
3. Inject profile loader để lấy tên/avatar từ nguồn profile bền vững khi offline; cache có TTL và không dùng dữ liệu session người khác chưa validate.
4. Quy định remove friend có xóa lịch sử cả hai bên không, retention/chat privacy và blocked/reporting nếu public. Đây là lựa chọn sản phẩm, cần xác nhận trước khi thay behavior.

Kiểm thử/đạt: 99→100 đúng, accept khi một bên đã 100 bị từ chối không mutate, accept đồng thời không vượt trần, profile offline hiện đúng. Message text đã escape trong SocialView; giữ test chống HTML injection, không báo sai rằng đoạn này chưa escape.

### 30 — Quan sát lỗi và benchmark có thể lặp lại

**P1 cho vận hành, P2 cho tối ưu; quan sát từ code hiện tại.** Vị trí: `local-server.mjs` console error/tick; storage adapter; `public/client.js` debug render query.

Cách làm:

1. Log có cấu trúc: request/action/operation ID, domain, elapsed, outcome/error code, retry count, revision; redaction token/cookie/chat/full save. Dùng định danh account phù hợp quyền truy cập log.
2. Metrics: persist p50/p95/error, queue depth/oldest wait, event-loop lag, heap, room/socket/match count, broadcast bytes, slow-consumer drops, settlement pending age.
3. Liveness khác readiness: process sống khác storage sẵn sàng. Readiness check có timeout/throttle, không spam upstream hay làm lộ cấu hình.
4. Benchmark fixtures versioned: small/large collection, long history, single/double battle, multi-tab, concurrent social. Ghi máy/Node/catalog/commit/scenario, warmup và raw results.
5. Đặt budget sau baseline: ưu tiên không có queue tăng vô hạn, long task khi input, stale save và failed settlement bị bỏ quên. Không hứa FPS/p95 trước đo.

Kiểm thử/đạt: giả lập save lỗi truy được operation mà không đọc secret; replay benchmark cho kết quả so sánh được; log retention có trần. Không biến report local chứa dữ liệu người chơi thành artifact public của CI.

### 31 — UX, khả năng truy cập và trình duyệt hạn chế storage

**P2; một phần xác nhận code, phần cần browser QA.** Vị trí: `public/js/store.js`, `bootstrap.js`, `client.js` modal/continuity, router, UI focus/input controllers.

Đã có focus manager, modal aria và reduced-motion support; cần kiểm tính hoàn chỉnh, không xây lại từ đầu. `localStorage.getItem/setItem` ở một số đường không được catch nên môi trường chặn storage có thể làm bootstrap/store lỗi. Router chỉ giữ route trong memory nên reload/back chưa có hợp đồng URL.

Cách làm:

1. Storage adapter try/catch và memory fallback, thông báo setting không persist; auth identity không phụ thuộc thành công của việc tạo legacy local ID.
2. Browser QA bàn phím: Tab/Shift+Tab/Escape, focus trap, return focus sau modal, background inert, icon-only accessible name; không chỉ kiểm có aria attribute.
3. Kiểm reduced motion OS và setting, high contrast, large UI/zoom, màn nhỏ và chữ dài; countdown PvP phải còn đọc được khi tắt animation.
4. Thêm loading/empty/error/retry phân biệt cho catalog/assets/network. Không dùng duy nhất toast hết hạn để báo lỗi save quan trọng.
5. Nếu sản phẩm muốn Back/deep link: đồng bộ route URL qua history/hash với allowlist; không đưa token/private data vào URL. Chưa tự bật offline purchase queue.

Kiểm thử/đạt: storage getter/setter throw vẫn hiện login hoặc app phù hợp; thao tác bag/shop/team hoàn toàn bằng keyboard; focus không rơi về body sau state push; 200% zoom không che nút xác nhận. Chưa được coi là đạt accessibility cho đến khi browser QA thực tế.

### 32 — Một workflow chính thức, tài liệu không mâu thuẫn

**P2; xác nhận.** Vị trí: root `AGENTS.md`, `app/AGENTS.md`, `README.md`, `docs/code-structure.md`, `app/package.cloud.json`, `bun.lock`, `tsconfig.json`, tài liệu audit cũ.

Root đã nói Node/npm local là chính; app AGENTS vẫn mô tả template tic-tac-toe/Workers, sửa trực tiếp generated logic, Bun build. Người mới hoặc tooling có thể làm sai nếu chỉ đọc file con. Root cũng còn câu mô tả rules vào src cần làm rõ với kiến trúc rules-v3 hiện tại.

Cách làm:

1. Viết quickstart duy nhất cho Node/npm local: install/check/test/start, môi trường nào cần account storage, cấu hình example, migration, data path, backup/restore và release.
2. Thay docs template bằng thông báo legacy/reference và link workflow chính; giữ validation contract deterministic/immutable/view privacy còn áp dụng.
3. Lập bảng source-of-truth: rules-v3, mechanics-v3, server, public, logic-src → generated src, frozen legacy. Không hướng dẫn sửa artifact generated.
4. Chọn package-lock/npm làm chuẩn local; lock/config cloud giữ trong khu legacy nếu còn cần reference, chỉ bỏ sau kiểm caller/tool và được duyệt.
5. Tài liệu audit cũ là lịch sử, không viết đè thành trạng thái hiện tại. Ví dụ audit 23/09 nói đã bỏ logo duplicate nhưng bản merge hiện có thể giữ lại; hash/reference kiểm lại trước khi dọn.

Kiểm thử/đạt: người khác dùng clean clone làm đúng theo README, không cần kiến thức hội thoại; command tồn tại; docs không hướng deploy site cũ. Không đổi storage keys `aether-*` chỉ để đồng bộ thương hiệu làm mất liên kết save/settings.

### 33 — Release tái lập và kiểm tra trong môi trường sạch

**P2; xác nhận docstring packager nói reproducible nhưng ZIP giữ file metadata gốc.** Vị trí: `scripts/package-full.py`, `run-package-full.mjs`, Python launcher helper trong test, package metadata.

Cách làm:

1. Sau policy an toàn mục 03, tách loại artifact: source zip, runtime zip, debug report. Mỗi loại có manifest rõ.
2. Nếu yêu cầu byte-for-byte reproducible: normalize ZIP timestamps/permissions/order và tên root, ghi version/commit/catalog hash; cố định môi trường compression nếu cần checksum giống tuyệt đối.
3. Nếu chỉ yêu cầu tái tạo nội dung: đổi mô tả cho đúng và so checksum từng file thay vì checksum toàn ZIP.
4. Dedupe Python executable discovery giữa launcher và test bằng helper có test Windows/Linux, xử lý thiếu executable/spawn error và thông báo cài đặt rõ. Không tự cài dependency toàn máy.
5. Verify extracted package ở temp dir sạch: `npm ci`, check/start smoke, asset/case-sensitive path; kiểm không cần credential hoặc node_modules của workspace cũ để khởi động chế độ test được cấu hình.

Kiểm thử/đạt: hai build cùng input cho manifest như nhau; archive scan an toàn; source gốc/save thật không bị sửa. Package không tự commit hoặc publish. Release manifest phục vụ traceability, không chứa env values.

### 34 — Không làm mất thư quà chưa nhận khi inbox vượt trần

**P1; xác nhận hành vi cắt danh sách, cần xác nhận chính sách sản phẩm.** Vị trí: `app/server/admin-gifts.mjs::enqueueAdminGift()`, `admin-service.mjs::sendGiftCampaign()`.

Enqueue giữ `pending.slice(0,50)` và `claimed.slice(0,50)`. Khi có hơn 50 quà pending, phần cũ có thể bị loại khỏi inbox. Campaign vẫn có thể báo delivery thành công cho thư mới. Nếu quà pending là quyền nhận thưởng chưa hết hạn, cắt mảng đồng nghĩa mất khả năng nhận; không nên coi đây chỉ là tối ưu bộ nhớ.

Cách làm:

1. Chốt quy tắc retention: pending đã hết hạn mới được purge, hay có quota từ chối thư mới. Không tự chọn xóa quà cũ thay người dùng.
2. Tách storage đầy đủ khỏi page UI; giới hạn hiển thị 50 không được làm mất record/entitlement chưa xử lý.
3. Nếu quota cứng, trả lỗi `INBOX_FULL` hoặc queued overflow rõ cho campaign và recipient; campaign retry theo receipt mục 08.
4. Dedupe gift/campaign ID phải sống đủ lâu sau khi archive/purge để retry không phát lại quà.
5. Migration giữ quà còn tồn tại; dữ liệu đã bị loại không thể phục hồi từ array hiện tại, phải kiểm backup/audit nếu có và chỉ phục hồi theo quy trình được duyệt.

Kiểm thử/đạt: enqueue 51+ quà chưa claim, mix read/unread/expired/claimed, duplicate campaign và retry sau archive; không mất quyền nhận quà hợp lệ, balance chỉ tăng một lần.

### 35 — Phân phối asset và loading theo nhu cầu (bổ sung sau B43)

**DONE theo phạm vi local-only đã được chủ dự án chốt ở B48.** Loading khởi động có tiến độ thật, skeleton theo route, responsive local assets, cache HTTP và chuẩn bị tài nguyên battle đã hoàn tất; nhánh Supabase Storage/CDN được gỡ thay vì trở thành yêu cầu phát hành.

Kế hoạch chốt: [asset-delivery-loading-roadmap.md](./asset-delivery-loading-roadmap.md). B44–B45 hoàn tất loader, bounded Save-Data preload, DPR/cache và two-client PvP deadline test. B48 xóa remote resolver, endpoint config, env, deployment scripts/tests/docs và giữ manifest như inventory/hash gate local. Sau #35 quay lại #09/#08; lỗi toàn vẹn dữ liệu #02/#04 vẫn được ưu tiên nếu xuất hiện.

#22 sở hữu tối ưu ảnh/DPR/quyền sử dụng; #35 sở hữu phân phối và loading. Kế thừa #20 cache, #21 lazy-load, #27 source/release và #31 accessibility; không mở lại trạng thái DONE của chúng chỉ vì thêm tính năng mới. Tổng roadmap tăng từ 34 lên 35 mục.

Tiêu chí trọng yếu: vào Home sau nhóm tài nguyên thiết yếu; file progress trung thực; timeout/fallback; local cache và release tái lập. PvP bắt đầu preview timer ngay khi ghép/join: warm không khóa state/input hoặc lượt để đợi ảnh. Không xóa asset khỏi Git trước khi có nguồn master và bundle khôi phục theo hash.

DONE sau automated/browser local acceptance và CI/release smoke; việc viết kế hoạch không phải hoàn thành runtime. CDN về sau là hạng mục mới nếu chủ dự án đổi quyết định.

## 4. Nguyên tắc bắt buộc khi triển khai

1. Không sửa `app/src/logic.js` hoặc `app/src/v2-engine.mjs` bằng tay. Sửa `logic-src` và chạy generator đúng workflow. Không chỉnh frozen legacy chỉ để qua lint.
2. Không thay balance, giá shop, ticket cost, rate recruitment, Elo, battle rules, availability của content trong PR “tối ưu”. Thay nghiệp vụ phải thành yêu cầu riêng.
3. Không xóa `.local-data`, backup, report, content snapshot, asset hay Git history chỉ vì thấy dung lượng lớn. Mục 03 là loại khỏi package, không phải xóa khỏi máy.
4. Correctness trước caching. Immutable state/projection, revision và transaction phải rõ trước khi thêm delta/memoization.
5. Không đưa secret thật vào fixture, screenshot/log/Markdown/CI artifact. Chỉ dùng account và save synthetic.
6. Không tự bật admin local, tắt auth, mở host ra internet, deploy site cũ hoặc chạy migration trên DB thật để “kiểm tra nhanh”.
7. Refactor phải giữ tương thích save/player ID, storage keys và public exports cần dùng. Snapshot/provenance có mục đích khác duplicate code.

## 5. Quy trình thực hiện một hạng mục

1. Đọc mục tương ứng, xác nhận file/hàm còn tồn tại tại HEAD mới và đọc AGENTS. Kiểm `git status`; giữ nguyên thay đổi của người dùng.
2. Viết test tái hiện trước. Với mục đo trước, ghi benchmark/screenshot baseline thay cho test khẳng định một bottleneck chưa đo.
3. Xác định phạm vi PR và schema/protocol bị tác động. Với transaction/CAS, lập migration và rollout/rollback plan trước sửa caller.
4. Sửa nhỏ, test mục tiêu, rồi chạy gate phù hợp. Refactor/logic/storage thay đổi rộng phải chạy full check và full regression.
5. So `git diff`, kiểm generated parity, test manifests, privacy, state serialization và package exclusions.
6. Ghi bằng chứng: ca lỗi cũ đã fail trước fix và pass sau fix; benchmark trước/sau cùng scenario; hạn chế còn lại.
7. Chỉ commit/push/deploy khi nằm trong yêu cầu được cho phép ở lượt triển khai. Việc tạo báo cáo này không tự cấp quyền sửa toàn bộ danh sách.

### Lệnh baseline cho người thực hiện sau

Các lệnh dưới dành cho giai đoạn triển khai/kiểm thử, không ngụ ý đã chạy tất cả trong audit. Chạy trong checkout/fixture đúng phạm vi; nếu package chưa có dependency thì dùng `npm ci` trước.

```powershell
Set-Location 'D:\Mon\PokemonVanguard'
git status --short
git rev-parse HEAD
Set-Location 'D:\Mon\PokemonVanguard\app'
npm run check
npm test
```

Nhóm 33 test đã chạy trong audit:

```powershell
node --test tests/economy.test.mjs tests/ranked-v1.test.mjs tests/arena-social-training.test.mjs tests/storage-migration.test.mjs tests/client-modules.test.mjs
```

Các nhóm test cần bổ sung có thể đặt tên theo phạm vi: `auth-config-security`, `ranked-settlement-failure`, `account-concurrency`, `storage-cas`, `queue-recovery`, `economy-number-boundaries`, `protocol-ack-retry`, `package-privacy`, `admin-overview-pagination`, `gift-inbox-retention`. Đây là tên đề xuất, **chưa có file mới tương ứng được tạo trong audit**.

### Ma trận nghiệm thu tối thiểu

| Nhóm thay đổi | Bắt buộc kiểm |
| --- | --- |
| Auth/security | missing secret, forged/expired/revoked session, origin/proxy, roles và private DTO |
| Save/economy | failed write, concurrent write, ambiguous commit, replay/duplicate, safe integer, migration/restore |
| PvP | two-sided concurrent command, timeout race, disconnect/reconnect, restart, settlement exactly-once |
| Client/UI | pending/ACK, focus/scroll/input continuity, keyboard/modal, playback order, viewport/reduced motion |
| Assets/CSS | reference/hash/dimensions, missing asset fallback, visual parity, load order, cold/warm network |
| Structure/content | generated parity, import boundaries, active hash, legacy migration, supported version replay |
| Release | clean install/check/test, safe file manifest, no local secrets/saves, extract smoke và rollback metadata |

## 6. Điểm tốt nên giữ

- Engine deterministic, rules/mechanics tách lớp và content có hash/version; không đưa thời gian hệ thống/random trực tiếp vào rules để tiện lập trình.
- Nhiều test domain và release/content gates đã tồn tại. Tận dụng rồi bổ sung failure/concurrency/browser coverage, không thay toàn bộ test bằng snapshot.
- Có server-authoritative validation, owner/session mapping, giới hạn payload, heartbeat và PvP timeout. Bổ sung những chiều còn thiếu, không bỏ để giảm code.
- Local save đã dùng temp + rename; migration có backup; Supabase RLS không mở write cho client. Nâng cấp transaction/recovery mà giữ các lớp bảo vệ này.
- UI đã có focus continuity, bàn phím và reduced-motion. Khi tách render/CSS, các tính năng đó phải là acceptance criteria.
- Item hooks/passive validators đã được tách ở đợt trước. Không ghi nhận chúng là “chưa refactor” chỉ vì tên facade còn tồn tại.

**Đề xuất bắt đầu:** làm 01 và 03 thành hai thay đổi nhỏ độc lập; chuẩn bị test fault-injection cho 02, rồi xử lý 02/04/05 như một chuỗi thay đổi nhất quán. Sau đó đo baseline mục 30 trước khi đầu tư tối ưu render/tài nguyên.


## Phụ lục triển khai B06 (27/09/2026)

Bản audit phía trên là **baseline tại thời điểm khảo sát**, không phải kết quả kiểm thử production hiện tại. Với batch lớn B06, xem [`project-optimization-progress-2026-09-26.md`](./project-optimization-progress-2026-09-26.md) và [`../app/docs/commerce-retry-operations.md`](../app/docs/commerce-retry-operations.md) để đối chiếu phần đã triển khai của mục **08, 10, 19** và các giới hạn còn lại. Trong đó #10 chỉ chuyển sang IN PROGRESS (in-process bounds/synthetic fixture), #08/#19 vẫn IN PROGRESS và #18 chưa khôi phục trận đang diễn ra.


## Phụ lục triển khai B07 (27/09/2026)

Sau B06, B07 bổ sung receipt/ACK và explicit retry cho PvE schema-3 (#08/#19); giới hạn socket join/account và vòng đời session/logout trong một process (#10/#11); bước đầu reclaim room detach (#17). Chi tiết giới hạn, rủi ro triển khai và lệnh nghiệm thu ở [`../app/docs/session-pve-retry-b07.md`](../app/docs/session-pve-retry-b07.md) và bảng Progress. **Không** coi đã hoàn thành active PvP rehydration (#18), distributed revocation hay real-Supabase smoke. B07 chưa kiểm thử được WS integration trong môi trường build thiếu `ws@8.21.3`; trước production phải chạy clean-install/full tests và browser smoke theo acceptance matrix.
