# Pokémon Vanguard — Nhật ký triển khai

Roadmap hiện hành: `docs/pokemon-vanguard-roadmap.md`. `ROADMAP.md` chỉ còn là lịch sử của hướng Aether cũ.

## Trạng thái hiện tại — rebaseline 12/09/2026

| Chặng | Trạng thái | Kết quả hiện có | Việc còn lại để qua gate |
| --- | --- | --- | --- |
| R0 Rebaseline | DONE | Khóa tên Pokémon Vanguard, local-first, English UI, không rarity, M-A trước, Single/Double, 66/32 Stat Points và schema snapshot | Không |
| R1 M-A Data | IMPLEMENTED / REVIEW PENDING | Candidate `pv-ma-2026-09-11`: 213 species/forms, 516 move được tham chiếu, 180 Ability, 166 item, 5 banner, 0 unresolved | Review semantic diff, bổ sung promote command và chỉ promote khi R3/R4 sẵn sàng |
| R2 Battle Rules | DONE AS SHADOW CONTRACT | 18 hệ, đơn/song hệ, level-50 stats, damage core, target Single/Double, switch → Mega → move, dynamic speed, faint/replacement/end-turn và deterministic replay | Chưa nối vào runtime schema 2; R3 cung cấp mechanic handlers, R4 mới chuyển runtime |
| R3 Mechanics Coverage | IN PROGRESS | Manifest/registry/coverage, inventory, shared accuracy/evasion và stat-stage handlers; 23 move có evidence Single/Double | 839/862 entry còn bị chặn; tiếp tục major/volatile status, damage variants, Ability/item hooks |
| R4 Training/Team UI | NOT STARTED | Có UI/validator schema 2 để tái sử dụng | Catalog service schema 3, promote M-A, migration roster/build/team, nối Archive/Training/Team/Preview/AI |
| R5 Roster Ranch | NOT STARTED | Ledger, receipt, clock và Trial reference của M4 tái sử dụng được | Dùng banner snapshot; xác minh luật lineup/coupon; thay prototype 8 offer |
| R6 Mega Evolution | NOT STARTED | R2 đã có vị trí Mega trong turn lifecycle | Xác minh legality/state transition, implement form swap và coverage Single/Double |
| R7 Sprite/Move FX | NOT STARTED | Có animation queue cũ và audit kiến trúc Showdown | Cache sprite local, audit Mega aliases, làm FX primitives/profiles/overrides theo battle events |
| M6 PvP | BLOCKED BY R4–R7 | Server-authoritative room flow cũ là nền tham khảo | Version negotiation, hidden information, reconnect, clocks và replay trên schema 3 |
| M7 Ranked | BLOCKED BY M6 | Chưa triển khai | Identity, queue, season/rating, anti-duplicate settlement, audit và vận hành |

Baseline R3 hiện tại: `npm run check` đạt, `npm test` đạt **127/127**, candidate M-A validate thành công, và replay/battle invariants vẫn deterministic. Coverage hiện tại là **23 supported / 839 blocked** cho từng format; đây là trạng thái cố ý fail-closed, không phải 839 mechanic đã hỏng.

### Quyết định kế tiếp

Tiếp tục ở **R3**, không nhảy thẳng sang UI hoặc sprite. Accuracy/evasion, self/ally boost và target debuff cơ bản đã có; thứ tự gần nhất là major/volatile status → multi-hit/recoil/drain → protection/redirection/switching → field conditions → Ability hooks → item hooks. Sau mỗi family phải regenerate coverage và chỉ bật entry có evidence cho cả Single lẫn Double. Roadmap chi tiết định nghĩa nguồn cần kiểm, cách implement, test matrix và gate cho từng bước.

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

## M0-05 — Storage adapter và migration dry-run

- Status: DONE
- Ngày: 11/09/2026
- Storage: `server/storage-json.mjs` đọc/lưu JSON bằng file tạm + atomic rename, kiểm room name, backup và restore bản JSON hợp lệ.
- Server: `local-server.mjs` sử dụng adapter; save lỗi/corrupt không bị thay bằng adventure trắng.
- Migration: `server/migrations.mjs` chuyển v1→v2 thuần và idempotent; giữ wallet, pity, summons, wins, badges, mail, legacy level/item; tạo mon/build/team ID ổn định.
- Active battle: save có trận v1 chưa kết thúc trả trạng thái deferred và giữ nguyên bytes/state; schema mới hơn bị từ chối.
- Dry-run: lệnh tài liệu hóa chạy thành công trên bản backup, báo 14 Mon/14 builds/team 6 và xác nhận không file nào bị đổi.
- Restore: được kiểm trên thư mục tạm qua backup→thay state→restore; chưa có nút UI và chưa restore save thật.

## M1-01 — Build validation và sáu chỉ số v2

- Status: DONE
- Ngày: 11/09/2026
- Nguồn: `logic-src/10-v2-builds.js`; được ghép vào logic thuần nhưng chưa bật trong adventure v1.
- Luật: sáu stats, tổng 32 points/tối đa 16 mỗi stat, alignment neutral hoặc +10%/−10% trên hai non-HP stats khác nhau.
- Validation: bốn move khác nhau thuộc movepool, Ability thuộc loài, item thuộc catalog.
- Snapshot: BattleMon giữ bản build độc lập; sửa build sau khi tạo không đổi stats/PP của trận.

## M1-02 — Damage, PP, accuracy và RNG v2

- Status: DONE
- Ngày: 11/09/2026
- Nguồn: `logic-src/20-v2-damage.js`; chưa thay battle v1 cho tới khi phase engine hoàn tất.
- Damage: physical/special, stage −6..+6, STAB, đơn/song hệ, weather, terrain, burn và spread/incoming/outgoing modifiers.
- Golden tests: damage 42 neutral, 84 khắc hệ, 0 miễn nhiễm; kiểm thêm ¼× và 4×.
- PP: cập nhật immutable; Guard, miễn nhiễm và miss vẫn tiêu PP; noPP không tiêu thêm.
- RNG/accuracy: seeded và deterministic; Struggle định nghĩa power 50 cùng recoil theo damage thực tế.
- Validation chung sau ba ticket: `npm run check` đạt; `npm test` đạt 21/21.

## M1-03 — Phase machine, command, queue, switch và target

- Status: DONE
- Ngày: 11/09/2026
- Depends on: M1-02
- Nguồn: `logic-src/30-v2-phases.js`.
- Kết quả: transition hợp lệ giữa tám phase; hai phe commit command một lần; chỉ tạo queue khi đủ hai gói lệnh.
- Queue: switch → priority → effective speed → tie key được sinh trước bằng RNG seeded; kiểm thử nhiều seed cho thấy mirror tie có cả A lẫn B đi trước.
- Double: actor gắn `battleMonId`, target dùng `{side, slot}`, fallback foe slot thấp nhất; switch trùng reserve bị từ chối và giữ PP/status khi rời sân.

## M1-04 — Conditions, Ability và held items

- Status: DONE
- Ngày: 11/09/2026
- Depends on: M1-03
- Nguồn: `logic-src/40-v2-effect-catalog.js`, `41-v2-conditions.js`, `42-v2-modifiers.js`, `43-v2-entry-effects.js`, `44-v2-move-effects.js`.
- Conditions: Burn/Poison/Slow/Sleep, Guard chain, Sun/Rain/Snow/Sand, Meadow/Storm, Tailwind/Barrier; field layers độc lập và duration không cộng dồn.
- Catalog hooks: đăng ký đủ 24 Ability và 12 held items bằng bảng hook tường minh, không `eval`; bao phủ entry, stat, accuracy, damage, survive, after-damage, status và end-turn.
- Luật quan trọng: miễn status theo hệ, chỉ một major status, Cure Berry dùng một lần, sturdy-heart trước Focus Crystal, weather rock không kéo terrain và ngược lại.

## M1-05 — END_TURN, replacement và result

- Status: DONE
- Ngày: 11/09/2026
- Depends on: M1-04
- Nguồn: `logic-src/50-v2-lifecycle.js`.
- END_TURN: major residual → Sand → item heal → Ability heal → Meadow heal → expiry; thay đổi cùng nhóm lấy snapshot và áp dụng đối xứng.
- Result: thắng/thua/hòa KO đồng thời, hard cap 100 lượt và receipt `${battleId}:result` duy nhất kể cả kiểm result lại.
- Replacement: yêu cầu đúng số slot có thể lấp, chặn slot/Mon trùng, cho phép tiếp tục khi một phe còn ít Mon hơn active count.
- Validation chung: `npm run check` đạt; `npm test` đạt 31/31 sau khi compile generated logic.
- Remaining: engine v2 vẫn là sandbox nội bộ; chưa nối vào save/UI v1 trước gate M3.

## Refactor trước M1-06 — Effects modules

- Status: DONE
- Kết quả: file effects 9,9 KB được tách thành năm fragment catalog, conditions, modifiers, entry và declared move effects; file lớn nhất trong nhóm còn 63 dòng/3,4 KB.
- Kiểm tra kích thước: turn resolution 150 dòng/9 KB; events 122 dòng/7,8 KB; không thêm luật v2 vào `90-public-api.js`.

## M1-06 — Events, log projector và animation adapter

- Status: DONE
- Ngày: 11/09/2026
- Depends on: M1-05
- Nguồn: `logic-src/55-v2-turn-resolution.js`, `60-v2-events.js`, `65-v2-invariants.js`.
- Resolution: command queue chạy trọn switch/sleep/PP/Guard/target/accuracy/damage/survival/berry/secondary/Ability/recoil/END_TURN/result mà không mutate input.
- Events: 19 kind được allowlist, payload damage/heal được validate, ID tăng duy nhất; chặn depth >8 và quá 256 events/lượt.
- Projector/log: phía đối thủ chỉ nhận phần trăm HP, phía mình giữ amount; log phân trang 20 lượt và fallback an toàn cho event phiên bản mới.
- Animator adapter: chuyển switch/entry, damage, heal và field change sang frame trung gian mà `battle-animation.js` hiện tại hiểu; HP frame lấy từ event đã áp dụng.
- Declared effects: dispatcher hỗ trợ `onUse`/`afterDamage`, chance seeded, status/stage/heal/field/side/redirect; move secondary có event riêng.

## Gate M1 — Determinism và simulation

- Status: PASSED
- Invariants: HP, PP, stages, active slots, finite values và JSON roundtrip được kiểm sau từng lượt giả lập.
- Simulation: 1.000 trận seeded kết thúc trong ≤100 lượt, không crash/hang; 25 seed đầu replay byte-for-byte cùng final state/events.
- Validation: `npm run check` đạt; `npm test` đạt 36/36, gồm toàn bộ suite legacy và v2, thời gian khoảng 19 giây.
- Browser QA: không áp dụng ở mốc này vì v2 chưa bật vào UI; adapter được kiểm bằng frame/event tự động.
- Remaining: catalog 48 moves/36 species và server build/team actions thuộc M2; save/UI người chơi tiếp tục dùng v1.

## M2-01 — Catalog gameplay hoàn chỉnh

- Status: DONE
- Ngày: 11/09/2026
- Dữ liệu runtime: `content/species.json`, `moves.json`, `abilities.json`, `items.json`; authoring chia trong `content-src/battle-catalog.mjs` và `species-catalog.mjs`.
- Kết quả: 36 species, 48 moves học được, 24 Ability, 12 held items + `none`; 12 Mon đơn hệ/24 song hệ.
- Mỗi species có sáu base stats tổng 480, role tường minh, ≥8 move IDs, hai Ability và default build bốn chiêu có tên/mô tả tiếng Việt.
- Validator mới chặn count/ID/reference/stat budget/effect schema/default build sai; `npm run generate:content` tái tạo JSON deterministic.

## M2-02 — Server build/team actions

- Status: DONE
- Ngày: 11/09/2026
- Nguồn: `server/v2-catalog.mjs`, `server/v2-progression.mjs`; route catalog read-only tại `/api/v2/catalog`.
- Build: kiểm ownership/trial, 32 points/16 cap, alignment, bốn move, Ability/item, tối đa ba build và optimistic revision.
- Economy: đổi nội dung battle tốn 10 coins; đổi tên/no-op miễn phí; stale revision và invalid draft không trừ tiền.
- Team: 1–6 build, chặn build lạ và species trùng; đổi tên/thứ tự miễn phí.
- Tương thích: progression v2 là sidecar trong save v1 và chỉ được tạo khi lưu; migration v1→v2 giữ custom build/team này.
- Integration test xác nhận catalog HTTP, WebSocket build.save, atomic persistence và reload sau restart.

## M2-03 — Training editor

- Status: DONE
- Ngày: 11/09/2026
- Nguồn: `public/js/training-editor.js`, `public/training-editor.css`; `client.js` chỉ thêm wiring và không nhận phần render editor.
- UI: roster Mon sở hữu, tối đa ba build, tên, sáu sliders, điểm còn lại, stat before/after, alignment, hai Ability, bốn move selectors có PP/mô tả, 12 items và reset draft.
- Save: draft invalid bị khóa; phí hiển thị theo thay đổi; build mới reconcile với ID/revision server để lần lưu no-op kế tiếp không bị tính phí.
- Browser QA room riêng: tạo `Emberlyn tốc độ` và `Emberlyn hỗ trợ`, phí đúng 10 coins mỗi build; no-op giữ nguyên tiền và reload vẫn đủ hai build.
- Lỗi tìm thấy/sửa: bare `window.fetch` mất binding; build mới chưa nhận server ID khiến lần lưu hai bị tính như build mới.
- Validation chung: `npm run check` đạt; `npm test` đạt 44/44, bao gồm 1.000 trận seeded M1 và restart persistence M2.

## M2-04 — Box, permanent và trial

- Status: DONE
- Ngày: 11/09/2026
- Nguồn: `public/js/box-view.js`, `public/box-view.css`; renderer và trạng thái bộ lọc không nằm trong `client.js`.
- Archive: luôn hiển thị đủ 36 loài và phân biệt rõ locked, permanent, trial; thẻ owned có số build và số lần build đang được đội sử dụng.
- Bộ lọc: tab Archive/Permanent/Trial, tìm tên, lọc type/role và sắp xếp tên/rarity.
- Trial: chỉ đọc và bị chặn Training; fixture tự động xác nhận trạng thái trial trước khi Recruitment được bật ở M4.

## M2-05 — Team Builder và blueprint

- Status: DONE
- Ngày: 11/09/2026
- Nguồn UI: `public/js/team-builder.js`, `team-analysis.js`, `public/team-builder.css`; nguồn server: `server/v2-team-actions.mjs`.
- Team: sáu slot theo build, species không trùng; draft dưới sáu Mon vẫn lưu được và được giải thích là chưa hợp lệ để đấu.
- Regulation: cả UI và server báo Species Clause; đội đủ sáu Mon còn kiểm Item Clause. Phân tích hiển thị role, coverage, điểm yếu/kháng hệ và gợi ý speed control, support, damage category.
- Blueprint schema v1 chỉ chứa species và build spec. Import tối đa 64 KiB, kiểm ID/build points/move/Ability/item; loài chưa sở hữu được lưu là ineligible và không tạo Mon hay cấp tiền.
- Browser QA room riêng: dựng/lưu đội sáu Mon, reload giữ đủ sáu build; export 2.753 bytes không có `monId`, `buildId`, coins, ownership hoặc session; import thiếu Cindrake vẫn giữ đúng sáu Mon permanent; console 0 lỗi/cảnh báo.

## Gate M2 — Roster và team authoring

- Status: PASSED
- Physical-fast/Support: lưu được build `Vật lý tốc độ` cho Emberlyn và `Hỗ trợ sân` cho Mossprout qua cùng validator server.
- Tương thích: lưu đội hiện tại không xóa team cũ; build mặc định của cả 36 loài có bốn chiêu hợp lệ, tên build và mô tả chiêu đầy đủ.
- Validation: `npm run check` đạt; `npm test` đạt 50/50, gồm 1.000 trận seeded deterministic và toàn bộ test M2.

## M3-01 — Regulation và Team Preview

- Status: DONE
- Ngày: 11/09/2026
- Regulation: có `sandbox-v2`, `alpha-single` và `alpha-double`; server kiểm roster, số Mon được chọn, Species Clause và Item Clause trước khi tạo BattleMon.
- Preview: Single chọn ba, Double chọn bốn; thứ tự chọn xác định lead một/hai slot. Closed team sheet của đối thủ chỉ công khai species, type và art, không lộ build, moves, Ability, item hoặc stats.
- Giao diện: đội chưa đủ sáu Mon được thử qua Sandbox; đội đủ sáu dùng Alpha regulation.

## M3-02 — AI và đội hình mẫu

- Status: DONE
- Ngày: 11/09/2026
- AI: Easy chọn hành động hợp lệ bằng RNG riêng; Normal chấm điểm một lượt; Hard xét tối đa 36 tổ hợp Double cùng synergy và tránh xung đột switch/field action.
- Privacy: AI chỉ nhận bản chiếu public của đội người chơi; pending command, moves, PP, Ability, held item và stats tùy chỉnh đều bị gỡ trước khi chấm điểm.
- Content: 12 đội exhibition và sáu đội gym cho mỗi format Single/Double; validator kiểm difficulty, sáu species hợp lệ và không trùng.
- Determinism: AI RNG tách khỏi battle RNG; cùng public state và seed cho cùng lựa chọn.

## M3-03 — Tactical battle UI và server flow

- Status: DONE
- Ngày: 11/09/2026
- Server: preview, command, replacement và surrender đều được xử lý authoritative, lưu atomic và phục hồi sau restart. Battle engine server dùng `src/v2-engine.mjs` sinh từ cùng fragments với public logic.
- UI: hiển thị phase, turn, PP, category, power, accuracy, target, switch, replacement, weather/terrain/side conditions, event delta và battle log. Single/Double dùng cùng controller và các renderer nhỏ theo trách nhiệm.
- Privacy: opponent HP chỉ được chiếu theo phần trăm; snapshots trước/sau lượt và events gửi client đều đã project. Trận v1 đang dang dở vẫn dùng UI cũ để có thể kết thúc an toàn.
- Event: event không khai báo turn được đóng dấu theo lượt vừa resolve; log damage/heal đối thủ dùng phần trăm khi absolute amount đã bị ẩn.
- Validation: `npm run check` đạt; `npm test` đạt 57/57, gồm 1.000 trận seeded. Browser smoke đi qua Battle Arena → Team Preview → lead → COMMAND, xác nhận bốn move có PP/category/target.
- Bảo trì: battle UI tách thành preview/arena/commands/controller; server tách factory/view/actions. File mới lớn nhất khoảng 6,2 KB.

## M3-04 — Damage Inspector và balance simulation

- Status: DONE
- Ngày: 11/09/2026
- Inspector: Training có sandbox calculator cho saved build hoặc draft đang chỉnh, 36 dummy defender, Weather, Terrain và spread modifier; breakdown hiển thị base, ATK/DEF hoặc SPA/SPD, STAB, type, field, Ability/item, burn, accuracy và damage cuối.
- Authoritative: endpoint `POST /api/v2/damage` chỉ nhận `context: sandbox`, validate build/scenario và gọi đúng calculator/modifier của engine; không ghi save và không nhận battle/gym controls.
- Runner: `npm run simulate -- --seed 100 --matches 10000` dùng bốn worker, lịch 12 đội exhibition × Single/Double, đổi A/B, battle RNG và AI RNG seeded. CSV có seed, mode, matchup, firstSide, aiDifficulty, turns, winner, moveUsage, speciesUsage và timeout.
- Kết quả Hard-vs-Hard seed 100: 10.000 trận, 132 matchup theo format, trung bình 11,46 lượt, timeout 0%, first-side win 50,16%; không move nào vượt 35% usage.
- Tín hiệu balance: `league-07` 81,64% và `league-12` 78,44% vượt ngưỡng 65%; giữ nguyên catalog trong ticket này để chờ playtest người thật thay vì đổi chỉ số chỉ từ bot-vs-bot. Báo cáo local ở `reports/balance-v2-seed-100-10000.csv` và `.summary.json`, tách khỏi user saves và Git.
- Sửa phương pháp: lượt chạy đầu dùng difficulty gắn theo team nên bị confound; báo cáo cuối chạy cùng Hard cho cả hai phía và có cột `aiDifficulty`.

## M3-05 — Adventure v2, migration, reward và hướng dẫn

- Status: DONE
- Ngày: 11/09/2026
- Migration release: save v1 không có trận được backup tự động vào `.local-data/.migration-backups` rồi nâng schema v2. Trận v1 đang dở tiếp tục bằng frozen engine; sau kết thúc/đầu hàng, UI hiện kết quả và reward v1, rồi nút “Tiếp tục sang Tactical Alpha” mới backup và migrate. Schema v2 chặn tạo trận v1 mới.
- Tương thích: coins, crystals, pity, summons, wins, badges, mail, collection, build/team sidecar và legacy level được giữ. Lớp release đồng bộ Mail/Summon legacy với wallet và ownership v2 trong giai đoạn chuyển tiếp.
- Settlement: exhibition Alpha thắng +180/+80, thua/hòa +60/+20; Gym first clear thêm +500/+300 và badge dùng chung format; Sandbox/surrender 0. Result, wallet, badge và receipt được persist cùng một action, replay không cộng lại.
- Tutorial: Home có checklist đội sáu Mon → hoàn thành battle → nhận reward → chỉnh build; Field Guide đã đổi từ Energy v1 sang PP, phase, field layers và reward v2.
- Privacy: spectator chỉ nhận `{spectator:true}`; progression, battle view, internal RNG và reward receipts không được broadcast. Team Preview tiếp tục ẩn seed/template/build đối thủ.
- UI QA room riêng: migration tạo đội Alpha sáu Mon; Home hiện tutorial; Training hiện mô tả Ability/item/move; Damage Inspector trả final damage/formula/replay; Alpha Preview vào COMMAND; surrender hiện +0/+0 và policy đúng.
- Bảo trì: progression state, release adapter, settlement, inspector, simulation runner và report aggregator là các module riêng; file source mới lớn nhất khoảng 6,2 KB, không đưa các trách nhiệm này vào `client.js` hay battle dispatcher.

## Gate Local Tactical Alpha

- Status: PASSED
- Functional loop: người mới có thể xem tutorial, dùng Team Builder, Team Preview Single/Double, đấu AI, nhận reward idempotent và chỉnh build; Sandbox Damage Inspector không ảnh hưởng kinh tế.
- Content/UI: 36 Mon, 48 move, 24 Ability và 12 held item đi qua cùng catalog/validator; Training và battle hiển thị mô tả, PP, category, target và field state.
- Compatibility: save v1 bình thường và active battle fixture đều có backup/migration/restart coverage; spectator và opponent projection có privacy tests.
- Validation: `npm run check` đạt; `npm test` đạt 64/64, gồm 1.000 battle invariant simulation trong suite và báo cáo balance 10.000 trận riêng.
- Balance: gate chức năng đạt; hai đội vượt ngưỡng simulation được ghi rõ để playtest/cân chỉnh trước khi tuyên bố game đã cân bằng.

## Review changeset M4 và reset hướng sản phẩm

- Status: DONE
- Ngày: 11/09/2026
- Nguồn: changeset 45 file trong `D:\Mon\AetherChampions_M4_modified_files`; toàn bộ SHA-256 khớp manifest và baseline nguyên bản đạt `npm run check` + 85/85 test.
- Giữ lại: economy ledger/action receipt idempotent, Mail/Battle settlement dùng chung ledger, server clock chống quay ngược, Recruitment state, Trial giữ nguyên Mon/build/team reference, privacy projection và restart coverage.
- Phát hiện lệch hướng: changeset dùng rarity gacha, lineup sáu loài, Trial 24 giờ, giá theo rarity và Ascension Stone. Các giả định này mâu thuẫn với `info.txt` nên không được tích hợp nguyên trạng.

## PV-00 — Pokémon Vanguard foundation correction

- Status: DONE
- Product metadata đổi thành **Pokémon Vanguard**; roadmap Aether cũ được đánh dấu archived và trỏ sang `docs/pokemon-vanguard-roadmap.md`.
- Build contract đổi sang tổng 66 Stat Points, tối đa 32 mỗi stat ở engine, server validator, blueprint validator và Training UI.
- Economy schema v2 bổ sung `recruitmentTickets`; migration từ economy v1 cấp một ticket chuyển tiếp mà không thay coins/crystals.
- Rarity summon bị gỡ khỏi route/UI/dispatcher v2. Action `summon` từ schema v2 trả `LEGACY_SUMMON_DISABLED`; frozen v1 vẫn được giữ để hoàn thành trận/save cũ.
- Recruitment có tám offer duy nhất, Trial bảy ngày, giá permanent đồng nhất 1.200 coins hoặc một ticket. Coin/ticket được trừ bằng cùng ledger và receipt chống gửi lặp.
- Archive và Recruitment không hiển thị hoặc sắp xếp theo rarity. Catalog 36 Mon cũ còn trường rarity chỉ như fixture tương thích và sẽ bị loại khỏi schema 3.
- Economy simulation đổi từ 100.000 rarity pull sang 100.000 Recruitment cycle, kiểm tám offer duy nhất và độ phủ equal-pool; không đọc/ghi user save.
- Source manifest: `app/content-src/pokemon-sources.json` khóa M-A trước, 66/32, English UI, front GIF + flip, move-FX-only và runtime offline.
- Toàn bộ text mới của catalog chuyển tiếp, Recruitment, Training, Team Builder và Battle v2 đã được chuẩn hóa sang tiếng Anh; màn chi tiết legacy không còn hiển thị rarity.
- Validation cuối: `npm run check` đạt; `npm test` đạt 82/82; browser QA xác nhận 8 offer, Trial 7 ngày, ticket, không rarity, Training 66/32 và không có console error.
- Recruitment simulation seed `424242` đạt 100.000 cycle, 0 lineup lỗi; tần suất xuất hiện mỗi species nằm trong khoảng 21.894–22.549.

## Trạng thái chuyển tiếp

- M4 ledger/clock/Trial là nền tái sử dụng được và đã được sửa theo quyết định mới.
- Catalog chiến đấu hiện hành vẫn là fixture Aether 36 loài/12 hệ. Nó chưa phải dữ liệu Pokémon Champions M-A và các regulation `alpha-*` chưa được đổi tên giả thành `m-a-*`.
- Bước tiếp theo bắt buộc: PV-01 candidate importer và snapshot M-A; sau đó PV-02 engine 18 hệ/mechanics, PV-03 schema-3 roster reset, PV-04 sprite local, PV-05 M-A Recruitment/UI và PV-06 Mega Evolution.
- Save schema 3 sẽ reset roster/build/team theo lựa chọn của chủ dự án, nhưng giữ wallet/settings phù hợp và luôn backup trước migration.

## Việc tiếp theo

- Ticket: PV-01 — raw snapshot, parser fixture-backed, normalize ID/reference và candidate diff cho Regulation M-A.
- Ticket: PV-02 — canonical 18-type chart, formula/mechanic gates và `implemented/legal` cho move/Ability/item.
- Không tiếp tục M5 Ascension của roadmap cũ; Mega Evolution thay thế tại PV-06.

## R3-02 — Stat-stage primitives và move capability inventory

- Status: DONE
- Ngày: 12/09/2026
- Nguồn: PokéBase M-A candidate cung cấp type/category/PP/description; Pokémon Showdown server commit `aa17ca0fac8bc5605df673bd8774c2d0e91efa43` chỉ được dùng để cross-check priority, target và boost payload cho batch đã review.
- Handler: thêm `apply-stat-stages` thuần, hỗ trợ bảy stage `atk/def/spa/spd/spe/accuracy/evasion`, clamp −6…+6, self/adjacent ally, explicit event gồm requested/applied delta và `stageLimit`.
- Move được mở: Acid Armor, Agility, Amnesia, Aromatic Mist, Bulk Up, Calm Mind, Coaching, Cosmic Power và Cotton Guard; cộng Tackle/Aerial Ace thành 11 move supported ở cả hai format.
- Single/Double: ally-only moves tiêu PP rồi fail `noTarget` ở Single; Double chỉ tác động ally đã chọn. Self moves được chạy ma trận ở cả hai format; input immutable và kết quả lặp byte-identical.
- Inventory: `npm run mechanics:inventory -- pv-ma-2026-09-11` phân loại đủ 516 move thành review queues. Description signals chỉ hỗ trợ nghiên cứu, có cờ `trustedMechanics:false`, không thay implementation hoặc legality.
- Coverage: 862 entries; Single 11 supported/851 blocked; Double 11 supported/851 blocked.
- Validation: `npm run check` đạt; `npm test` đạt 120/120.

## R3-03 — Accuracy/evasion và target stat debuffs

- Status: DONE
- Ngày: 12/09/2026
- Accuracy: thêm `check-accuracy` dùng cùng seeded RNG cho damage/status, công thức stage ba-based, kết hợp `accuracy - evasion` rồi clamp −6…+6; always-hit bỏ qua stage.
- Tích hợp: Tackle giờ có thể miss do accuracy/evasion stage; Aerial Ace vẫn luôn hit. Damage và status không còn duy trì hai công thức accuracy riêng.
- Move mới: Baby-Doll Eyes, Charm, Coil, Confide, Double Team, Fake Tears, Feather Dance, Noble Roar, Scary Face, Screech, String Shot và Sweet Scent.
- Double: single target đi qua redirection; spread status kiểm accuracy độc lập từng foe. String Shot fixture xác nhận một foe hit và một foe miss trong cùng action.
- Event: miss ghi target cùng effective accuracy; stage change giữ requested/applied delta và clamp. Cùng roll stream tạo output byte-identical.
- Minimize cố ý chưa bật vì còn volatile riêng làm một số move gây damage gấp đôi/always-hit; stage evasion đơn lẻ chưa đủ mechanic.
- Coverage: 862 entries; Single 23 supported/839 blocked; Double 23 supported/839 blocked. Inventory còn 493 move chờ manual review.
- Validation: `npm run check` đạt; `npm test` đạt 127/127.
