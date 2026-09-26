# Pokémon Vanguard — local development

The project runs directly with Node.js on the local machine. **R3-101 builds on the locked R3-100 Pokémon Champions Regulation M-A runtime: 272/272 selectable entries (213 non-Mega + 59 Mega), 490 active moves, and now 30 signature move timelines covering all 18 move types.** The old 36-Mon catalog still exists only as a compatibility fixture for legacy tests. See [the presentation roadmap](docs/ui-battle-presentation-roadmap.md) and [the R3-100 release report](docs/r3-100-ma-release-report.md).

## Chạy game

Yêu cầu Node.js 22 trở lên. Mở terminal tại thư mục `app`:

```powershell
npm install
npm run dev
```

Mở http://localhost:3100. Hoặc nhấp đúp `start-local.cmd` ở thư mục dự án.

- Sửa HTML/CSS/JS trong `app/public`, rồi tải lại trình duyệt để xem thay đổi.
- Sửa luật trong `app/logic-src`, rồi chạy `npm run compile:logic`. Khi dùng `npm run dev`, trình biên dịch theo dõi fragment/catalog và chỉ khởi động lại máy chủ sau khi tạo được `app/src/logic.js` và `app/src/v2-engine.mjs` hợp lệ.
- Dừng bằng Ctrl+C trong terminal đang chạy máy chủ.
- Chạy `npm run start` nếu không cần tự khởi động lại.
- Máy chủ chỉ lắng nghe trên máy này, không mở truy cập từ mạng LAN.

## Lưu game

Trạng thái trò chơi lưu tại `app/.local-data/*.json`, không đưa vào Git.
Trình duyệt lưu mã người chơi để nhận lại đúng bản lưu. Hãy dùng cùng trình duyệt và cùng địa chỉ `localhost:3100` để tiếp tục chơi.
Có thể sao lưu cả thư mục `.local-data`. Bản lưu trên website cũ không tự chuyển về local.

Khi một save local schema v1 được mở, máy chủ tự tạo bản sao tại `app/.local-data/.migration-backups` rồi nâng lên schema v2. Trận v1 đang diễn ra được giữ nguyên; sau khi kết thúc hoặc đầu hàng, giao diện vẫn hiện kết quả cũ. Bấm **Continue to Vanguard battles** để backup kết quả rồi migrate. Không tạo thêm trận v1 sau khi đã nâng schema.

## Kiểm tra

```powershell
npm run check
npm test
npm run simulate -- --seed 100 --matches 10000
npm run simulate:economy -- --seed 424242 --cycles 100000
npm run release:validate
npm run release:matrix
```

`npm run check` now verifies generated logic, compatibility content, source syntax, **490/490 Move FX timelines (30 signature + 460 parameterized + 0 legacy), 272/272 presentation-asset resolution, 277 foundation forms, 59/59 M-A Mega relations, exact 272-entry M-A scope and the R3-100 offline/runtime release gate**. `npm run release:matrix` additionally spawns all 213 non-Mega entries in both Single and Double scenarios, exercises all 59 M-A Mega presentation paths and checks every active move presentation commit.

Tạo và kiểm tra một candidate Pokémon Champions mới trong `app`:

```powershell
npm run pokemon:fetch -- pv-ma-YYYY-MM-DD
npm run pokemon:candidate -- pv-ma-YYYY-MM-DD m-a
npm run pokemon:validate -- pv-ma-YYYY-MM-DD
```

`pokemon:fetch` tạo snapshot bất biến kèm byte length, HTTP metadata và SHA-256. Lệnh sẽ từ chối ghi đè snapshot cùng ID. `pokemon:candidate` chỉ đọc snapshot local, chuẩn hóa form/learnset/Ability/item/banner và tạo báo cáo unresolved. `pokemon:validate` kiểm lại hash nguồn, quan hệ catalog, 18 hệ, base stats và ghi `normalized/candidate-report.md`. Candidate nằm trong `app/content-candidates`, không thay `app/content` và không được Git theo dõi trước khi review/promotion.

Kiểm tra migration trên **một bản sao** của save, không ghi thay đổi:

```powershell
npm run migrate:save -- --dry-run --input D:\duong-dan\ban-sao-save.json
```

Storage adapter có backup/restore và migration v1→v2 được kiểm thử tự động. Các fragment có tên theo trách nhiệm trong `app/logic-src` chứa battle engine v2: build, damage, phase/queue, conditions, Ability/item modifiers, move effects, vòng đời, turn resolution, events và invariants. `src/v2-engine.mjs` là adapter server được sinh từ chính các fragment này. Battle Arena dùng v2 cho Team Preview, battle và reward có receipt chống cộng trùng.

The battle simulation uses four local workers and writes CSV/JSON reports. `simulate:economy` now tests 100,000 equal-pool Recruitment cycles, eight unique offers and uniform permanent affordability. Neither simulation reads or writes `app/.local-data`.

Bộ kiểm tra local xác nhận phục vụ trang, catalog chuyển tiếp 36 loài, nhận thư một lần, Recruitment/Trial, đấu đơn/đôi, chặn người xem sửa game và giữ tiến trình sau khi khởi động lại máy chủ.

## Cấu trúc

- `app/local-server.mjs`: máy chủ HTTP/WebSocket local và lưu file.
- `app/logic-src/`: nguồn luật có thứ tự; `app/src/logic.js` là file được sinh tự động và không sửa trực tiếp.
- `app/content-import/`: snapshot, Next/RSC parser, normalizer và validator cho candidate Pokémon Champions.
- `app/server/legacy/logic-v1.js`: bản luật v1 đóng băng để kiểm tra tương thích và kết thúc trận cũ khi migration được bật.
- `app/public/js/store.js`, `router.js`, `net.js`: trạng thái trình duyệt, điều hướng và kết nối WebSocket được tách khỏi phần render trong `client.js`.
- `app/public/js/training-editor.js`: editor build v2; catalog lấy từ `/api/v2/catalog`, save được server kiểm và lưu atomic.
- `app/public/js/box-view.js`: Archive 36 loài với ownership permanent/trial/locked và bộ lọc catalog v2.
- `app/public/js/team-builder.js`, `team-analysis.js`: đội sáu slot, kiểm regulation, phân tích matchup và blueprint JSON.
- `app/public/js/recruitment-view.js`: eight equal-pool offers, seven-day Trial and permanent coin/ticket actions.
- `app/server/v2-recruitment*.mjs`, `clock.mjs`: UTC offer cycle, Trial expiry/permanent upgrade and server-owned monotonic clock.
- `app/server/v2-economy*.mjs`, `v2-mail.mjs`: economy config, ledger, action receipts, Mail and Recruitment simulation.
- `app/server/v2-team-actions.mjs`: luật team và import blueprint authoritative; blueprint không thể cấp Mon hoặc tiền.
- `app/server/v2-regulations.mjs`, `v2-ai.mjs`: regulation Team Preview và AI Easy/Normal/Hard với nguồn dữ liệu đã lọc.
- `app/server/v2-battle-actions.mjs`, `v2-battle-factory.mjs`, `v2-battle-view.mjs`: action authoritative, dựng trận và projection riêng cho client.
- `app/server/v2-settlement.mjs`, `v2-release.mjs`: reward receipt, đồng bộ ví, tutorial và migration release.
- `app/server/v2-damage-inspector.mjs`: calculator read-only chỉ dành cho Training sandbox.
- `app/server/v2-simulation.mjs`, `app/scripts/simulate-v2*.mjs`: runner cân bằng Single/Double chạy song song và xuất báo cáo.
- `app/public/js/v2-battle-*.js`: Team Preview, arena, command/replacement renderer và controller battle v2.
- `app/public/js/damage-inspector.js`, `v2-tutorial.js`: Damage Inspector cho saved/draft build và checklist vòng chơi Vanguard.
- `app/public/client.js`: giao diện và điều khiển.
- `app/public/art.js`: 36 hình minh họa SVG gốc.
- `app/public/style.css`: giao diện responsive.
- `app/tests/local.test.mjs`: kiểm tra tích hợp local.
- `app/package.cloud.json`, `src/room.ts`, `src/worker.ts`: bản cấu hình/cloud cũ được giữ để tham khảo; không dùng khi chạy local.

## Nội dung phiên bản đầu

The transition build still contains 36 original fixture species, 48 moves, 24 Abilities and 13 held items so completed engine work remains testable. Production content will use the reviewed M-A Pokémon roster, the canonical type chart and locally cached Showdown sprites. Recruitment already uses eight offers, a seven-day Trial, a uniform permanent coin price and recruitment tickets; rarity summoning is disabled for schema-v2 saves.

Pokémon front/back/artwork coverage is 272/272 from the local PokéAPI-derived asset pack, and held-item/rank assets remain local. Pokémon Vanguard also standardizes battle metadata on the **Pokémon Legends: Arceus (LA)** type-symbol family: 18 circular `* icon LA` sprites, 18 horizontal `*IC LA` strips and the matching 50×50 Physical/Special/Status category sprites. Run `cd app && npm run assets:ui-icons` to vendor all 39 third-party UI sprites into `public/assets/ui/`. If they have not been vendored yet, the app uses a same-origin server proxy as a development/deployment fallback; no Bulbagarden URL is exposed in public browser code. Review the sprite fair-use/redistribution terms before a public release.

## Hoạt ảnh chiến đấu

- Mỗi chiêu phát theo đúng thứ tự hành động từ máy chủ: lấy đà, tung đòn, va chạm, số sát thương và thanh máu.
- Hiệu ứng theo 12 hệ, chiêu diện rộng đánh đồng thời nhiều mục tiêu; có hồi máu, lá chắn, tăng sức mạnh, thời tiết, đổi Mon và bị hạ.
- Chọn tốc độ 1×/2× ngay trên sân đấu. Nút Skip bỏ qua phần diễn nhưng giữ nguyên kết quả đã lưu.
- Settings → Reduced motion tắt chuyển động/hạt sáng; tùy chọn giảm chuyển động của hệ điều hành cũng được tôn trọng.
- `app/public/battle-animation.js` và `.css`: bộ phát hoạt ảnh Canvas/Web Animations; `src/logic.js` xuất sự kiện và ảnh chụp trạng thái từng hành động.
- `npm test` kiểm tra đồng bộ sát thương/HP, mục tiêu đấu đôi, 12 hệ, miễn nhiễm, đỡ đòn, hồi máu, thời tiết, đổi Mon, bị hạ và tương thích bản lưu cũ.

## Admin Console

Pokémon Vanguard includes a server-authorized admin surface at `/admin.html`. It is not enabled by a client-side flag: the signed-in account must be present in the server environment variable `ADMIN_ACCOUNT_IDS`.

Example `.dev.vars` configuration:

```text
ADMIN_ACCOUNT_IDS=11111111-1111-4111-8111-111111111111,22222222-2222-4222-8222-222222222222
ADMIN_ALLOW_LOCAL_BETA=false
```

Use Supabase account UUIDs for production. `ADMIN_ALLOW_LOCAL_BETA=true` is intended only for local development. The admin console can inspect player saves; manage wallet, held-item and Pokémon ownership; inspect teams/builds; edit/reset Ranked state; complete/reset Missions and Achievements; create backups; disconnect or suspend accounts; stop active Ranked/Friendly/PvE activity as an administrative no-contest; and send claimable Mailbox gift campaigns to one trainer, a selected list, online trainers, a rank cohort, or the entire server. Gift campaigns can contain VP, Crystals, Recruitment Tickets, multiple held items and multiple Pokémon. Each campaign also selects a mail-retention type and can override separate unread and after-read lifetimes; opening mail shortens retention and expired rewards cannot be claimed. Admin-only notes/audit metadata and the sending admin UUID are never included in the normal player view.

### PvP match lifecycle

Ranked and Friendly PvP use server-authoritative decision clocks: 45 seconds for COMMAND/REPLACE, 90 seconds for Team Preview, and a 90-second reconnect grace. Missed decisions receive a deterministic legal fallback action; a single expired disconnect forfeits to the connected trainer, while simultaneous disconnect expiry is no-contest. Friendly waiting rooms expire after 15 minutes and finished in-memory results are cleaned after 10 minutes. These live coordinator states remain single-process beta state and are not yet restart-persistent.
