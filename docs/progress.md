# Pokémon Vanguard — Nhật ký triển khai

Roadmap hiện hành: `docs/pokemon-vanguard-roadmap.md`. `ROADMAP.md` chỉ còn là lịch sử của hướng Aether cũ.

## Trạng thái hiện tại — rebaseline 12/09/2026

| Chặng | Trạng thái | Kết quả hiện có | Việc còn lại để qua gate |
| --- | --- | --- | --- |
| R0 Rebaseline | DONE | Khóa tên Pokémon Vanguard, local-first, English UI, không rarity, M-A trước, Single/Double, 66/32 Stat Points và schema snapshot | Không |
| R1 M-A Data | BETA SLICE REVIEWED / FULL REVIEW PENDING | Candidate `pv-ma-2026-09-11`: 213 species/forms, 516 move, 180 Ability, 166 item; scoped review đã khóa hash và relation cho beta v1 | Review phần còn lại theo từng content batch; không coi scoped approval là approval toàn candidate |
| R2 Battle Rules | DONE AS SHADOW CONTRACT | 18 hệ, đơn/song hệ, level-50 stats, damage core, target Single/Double, switch → Mega → move, dynamic speed, faint/replacement/end-turn và deterministic replay | Chưa nối vào runtime schema 2; R3 cung cấp mechanic handlers, R4 mới chuyển runtime |
| R3 Mechanics Coverage | IN PROGRESS / BETA SLICE LOCKED | 87 move, 4 Ability và 6 item có evidence Single/Double; đội beta 6 Pokémon đã qua legality/coverage gate | Mở rộng mechanics theo batch sau khi beta loop chạy; 765/862 entry vẫn fail-closed |
| R4 Training/Team UI | BETA GATE PASSED | Catalog, migration/save, Home/Archive/Training/Team/Recruitment status/Guide và Preview/AI/Battle schema 3 đã chạy end-to-end | Mở rộng Inspector sau beta feedback; tiếp tục R5 theo slice |
| R5 Roster Ranch | NOT STARTED | Ledger, receipt, clock và Trial reference của M4 tái sử dụng được | Dùng banner snapshot; xác minh luật lineup/coupon; thay prototype 8 offer |
| R6 Mega Evolution | NOT STARTED | R2 đã có vị trí Mega trong turn lifecycle | Xác minh legality/state transition, implement form swap và coverage Single/Double |
| R7 Sprite/Move FX | FOUNDATION STARTED | Sáu front idle GIF đã cache local; battle dùng animation queue code-based và đã có audit Showdown | Audit Mega aliases, mở rộng FX primitives/profiles/overrides theo battle events |
| M6 PvP | BLOCKED BY R4–R7 | Server-authoritative room flow cũ là nền tham khảo | Version negotiation, hidden information, reconnect, clocks và replay trên schema 3 |
| M7 Ranked | BLOCKED BY M6 | Chưa triển khai | Identity, queue, season/rating, anti-duplicate settlement, audit và vận hành |

Baseline R3 hiện tại: candidate M-A validate thành công và replay/battle invariants vẫn deterministic. Coverage hiện tại là **97 supported / 765 blocked** cho từng format, gồm 87 move, 4 Ability và 6 item; đây là trạng thái cố ý fail-closed, không phải 765 mechanic đã hỏng.

### Quyết định kế tiếp

Ưu tiên **beta loop trước full coverage**. `beta-slice-v1` hiện chạy end-to-end bằng schema 3 từ Training → Team → Preview → Battle cho cả Single/Double và đã qua restart QA. Kế tiếp nhận beta feedback rồi mở R5 Roster Ranch song song với các batch R3 có tác động rõ đến roster; entry ngoài slice tiếp tục fail-closed.

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

## R3-04 — Major status foundation

- Status: DONE cho state/lifecycle cơ bản của burn, regular poison, paralysis, sleep, freeze và bad poison.
- Ngày: 12/09/2026
- Contract: major status là state độc quyền; target đã có status không bị overwrite. Fire miễn burn, Electric miễn paralysis, Poison/Steel miễn poison; powder moves bổ sung Grass immunity và Thunder Wave bổ sung Ground immunity.
- Lifecycle: burn gây `1/16 max HP`, poison `1/8 max HP` ở end turn; paralysis giảm Speed còn một nửa và có 25% seeded action prevention. Switch giữ major status nhưng reset đủ bảy stat stages.
- Move được mở: Glare, Poison Powder, Stun Spore, Thunder Wave và Will-O-Wisp. Accuracy, redirection, type immunity, existing-status failure và PP đều đi qua shared handlers.
- Integration: move action chạy paralysis gate trước `moveStarted`/PP; full paralysis không tiêu PP. `majorStatusTurnOptions` cung cấp dynamic Speed cho R2 queue và `resolveMajorStatusEndTurn` nối residual group vào lifecycle.
- Nguồn cross-check: Pokémon Showdown server commit `aa17ca0fac8bc5605df673bd8774c2d0e91efa43`, `data/moves.ts` và `data/conditions.ts`; giá trị Champions display/PP vẫn lấy từ candidate PokéBase.
- Coverage: 862 entries; Single 28 supported/834 blocked; Double 28 supported/834 blocked. Inventory còn 488 move chờ review.
- Validation: `npm run check` đạt; `npm test` đạt 133/133.

## R3-05 — Advanced major status lifecycle

- Status: DONE cho core; Rest, Yawn, damaging secondary status, Fire-hit thaw và defrost move vẫn blocked theo capability riêng.
- Ngày: 12/09/2026
- Kiến trúc: `major-status.mjs` chỉ còn là facade; state/application, before-action gate và end-turn residual nằm trong ba module riêng.
- Sleep: duration seeded 1–3 lượt bị chặn, tự wake ở lần action kế tiếp và không tiêu PP trong lượt ngủ. Freeze: Ice immunity và natural thaw 20% seeded. Bad poison: damage tăng từ `1/16` đến trần `15/16 max HP`, giữ status khi switch nhưng reset toxic counter.
- Move được mở: Hypnosis, Sing, Sleep Powder và Toxic. Sleep Powder chặn Grass; Toxic chặn Poison/Steel; Poison-type Toxic bypass accuracy theo cross-check Gen 8+.
- Nguồn cross-check: Pokémon Showdown server commit `aa17ca0fac8bc5605df673bd8774c2d0e91efa43`, `data/conditions.ts`, `data/moves.ts` và `sim/battle-actions.ts`. Giá trị Champions accuracy/max PP lấy từ candidate PokéBase.
- Coverage: 862 entries; Single 32 supported/830 blocked; Double 32 supported/830 blocked. Inventory còn 484 move chờ review.
- Validation: `npm run check` đạt; `npm test` đạt 141/141; candidate validate 0 lỗi.

## R3-06 — Volatile action foundation

- Status: DONE cho confusion và flinch core; damaging secondary flinch cùng move-lock volatile vẫn blocked theo capability riêng.
- Ngày: 12/09/2026
- Confusion: timer nguồn 2–5 tương ứng 1–4 action checks trước natural recovery; mỗi check có 33% self-hit power 40. Damage chỉ dùng Attack/Defense sau stat stage và random roll, không dùng STAB/type/critical hoặc modifier damage thông thường.
- Flinch: chặn action trước confusion/paralysis, không tiêu PP, bị consume khi target tới lượt và bị xóa ở end turn nếu target đã hành động trước khi nhận flinch.
- Ordering: sleep/freeze → flinch → confusion → paralysis, cùng dùng seeded runtime và giữ output byte-identical.
- Move được mở: Confuse Ray, Flatter và Swagger. Hai move sau compose stat-stage handler trước confusion; target mode `anyAdjacent` hỗ trợ chọn ally trong Double và foe target vẫn đi qua redirection.
- Nguồn cross-check: Pokémon Showdown server commit `aa17ca0fac8bc5605df673bd8774c2d0e91efa43`, `data/conditions.ts`, `data/moves.ts` và `sim/battle-actions.ts`; accuracy/max PP lấy từ candidate PokéBase.
- Coverage: Single 35/862; Double 35/862; inventory còn 481 move chờ review.
- Validation: `npm run check` đạt; `npm test` đạt 149/149; candidate validate 0 lỗi.

## R3-07 — Move-lock volatile và command legality

- Status: DONE cho Taunt, Encore và Disable core.
- Ngày: 12/09/2026
- Command gate: `createMoveChoiceValidator` trả mã lỗi machine-readable trước khi queue lock; move resolver có fail-safe cùng quy tắc và không tiêu PP khi lệnh bị khóa.
- History: move đi qua action gates được ghi vào `lastMoveId`; action bị sleep/freeze/flinch/confusion/paralysis, move lock hoặc hết PP không ghi đè history.
- Duration: Taunt/Encore khóa ba lượt và Disable bốn lượt. Runtime `hasActed` từ turn engine điều chỉnh timer khi effect được áp trước hoặc sau action của target; switch xóa effect, end turn giảm timer và phát event kết thúc.
- Encore/Disable chỉ bind last move hợp lệ còn PP. Encore chặn danh sách move không thể encore và tự kết thúc khi move bị ép hết PP.
- Move được mở: Taunt, Encore và Disable; cả ba dùng `anyAdjacent`, hỗ trợ ally target và foe redirection trong Double.
- Nguồn cross-check: candidate PokéBase cho Champions description/accuracy/max PP; Pokémon Showdown server pin cho duration, failure list, action order và PP expiry.
- Coverage: Single 38/862; Double 38/862; inventory còn 478 move chờ review.
- Validation: `npm run check` đạt; `npm test` đạt 159/159; candidate validate 0 lỗi.

## R3-08 — Leech Seed linked residual

- Status: DONE cho Leech Seed core; Liquid Ooze/Big Root và các Ability/item modifier vẫn blocked cùng entry sở hữu chúng.
- Ngày: 12/09/2026
- State: volatile lưu `sourceSide/sourceSlot`; Mon thay vào đúng slot nguồn nhận heal, còn source slot trống hoặc faint thì lượt đó không drain. Target switch xóa link theo cleanup volatile chung.
- Residual: lấy `1/8 max HP`, heal đúng actual damage sau HP cap. Nhiều target cùng source được damage trong một nhóm đối xứng rồi aggregate heal, không hồi sinh source đã faint.
- Ordering: `resolveMechanicsEndTurn` chạy linked drain trước regular/bad poison và burn, sau đó commit một chuỗi event duy nhất để replay giữ đúng thứ tự.
- Move được mở: Leech Seed với accuracy 90, Grass immunity, `anyAdjacent`, ally target và foe redirection trong Double.
- Nguồn cross-check: candidate PokéBase cho Champions description/accuracy/max PP; Pokémon Showdown server pin `data/moves.ts` cho source-slot, immunity và residual fraction.
- Coverage: Single 39/862; Double 39/862; inventory còn 477 move chờ review.
- Validation: `npm run check` đạt; `npm test` đạt 167/167; candidate validate 0 lỗi.

## R3-09 — Multi-hit, recoil và drain theo actual damage

- Status: DONE cho primitive và 12 move không có named secondary chưa được hỗ trợ.
- Ngày: 12/09/2026
- Damage primitive: `damage-hit.mjs` là một hit authoritative dùng chung cho direct và multi-hit, gồm crit, roll 85–100, STAB/type, burn, HP cap, event damage/faint và không mutate input.
- Multi-hit: hit count 2–5 theo phân phối hiện đại 35/35/15/15; accuracy/redirect chỉ resolve một lần, mỗi hit có crit/damage roll riêng, dừng ngay khi faint hoặc immunity. Event `hitCount` ghi planned/actual hits cho replay và FX.
- Recoil/drain: handler sau damage đọc `payload.totalDamage`, dùng actual HP đã mất, `Math.round`, tối thiểu 1 khi đã gây damage và clamp theo HP. Drain không hồi sinh và không phát heal giả khi đầy HP.
- Move được mở: Bullet Seed, Rock Blast, Icicle Spear, Dual Wingbeat; Double-Edge, Brave Bird, Wild Charge, Head Smash; Giga Drain, Drain Punch, Draining Kiss và Horn Leech.
- Scale Shot vẫn blocked vì cần self Defense −1/Speed +1 sau chuỗi hit; Ability/item như Skill Link, Loaded Dice, Rock Head, Reckless, Liquid Ooze và Big Root tiếp tục blocked theo manifest riêng.
- Nguồn cross-check: candidate PokéBase cho Champions values; Pokémon Showdown server pin `data/moves.ts`, `sim/battle-actions.ts` và `sim/battle.ts` cho hit distribution, per-hit lifecycle, ratio và rounding.
- Coverage: Single 51/862; Double 51/862; inventory còn 465 move chờ review.
- Validation: `npm run check` đạt; `npm test` đạt 176/176; candidate validate 0 lỗi.

## R3-10 — Fixed damage và variable power

- Status: DONE cho sáu công thức variable và hai công thức fixed đã có đủ dữ liệu runtime; weight-based vẫn blocked.
- Ngày: 12/09/2026
- Stat correction: damage hit dùng stage multiplier cho Attack/Sp. Atk và Defense/Sp. Def. Critical bỏ qua stage tấn công âm và phòng thủ dương; confusion tái sử dụng cùng primitive stat thay vì giữ bản sao công thức.
- Fixed damage: Night Shade và Seismic Toss gây damage bằng level; Super Fang gây `floor(current HP / 2)`, tối thiểu 1. Cả nhóm vẫn qua accuracy, target/redirection và type immunity nhưng bỏ qua crit, random, STAB và effectiveness multiplier.
- Variable power: Flail/Reversal dùng sáu ngưỡng HP; Electro Ball/Gyro Ball dùng effective Speed có stage/paralysis; Eruption/Water Spout dùng current/max HP và spread modifier; Stored Power/Power Trip cộng mọi stage dương; Last Respects đếm đồng đội đã faint.
- Event: `powerResolved` ghi formula và power cho replay, inspector và FX; damage sau đó đi qua primitive chung nên giữ crit/random/type/burn/stage behavior.
- Nguồn cross-check: candidate PokéBase cho Champions values; Pokémon Showdown server pin `data/moves.ts` cho callback, threshold, cap và target mode.
- Deferred: Grass Knot, Low Kick, Heat Crash và Heavy Slam cần weight canonical trong R1 data + snapshot; Hard Press và các condition-specific move sẽ vào batch riêng để giữ test evidence độc lập.
- Coverage: Single 63/862; Double 63/862; inventory còn 453 move chờ review.
- Validation: `npm run check` đạt; `npm test` đạt 185/185; candidate validate 0 lỗi.

## R3-11 — Conditional power và Scale Shot composition

- Status: DONE; khép R3.4 trong phạm vi state hiện có.
- Ngày: 12/09/2026
- Conditional power: Facade nhân đôi khi user có status hợp lệ và bỏ burn penalty; Hex nhân đôi với target có major status; Venoshock chỉ nhân đôi với poison/bad-poison; Hard Press dùng fixed-point current-HP callback; Fickle Beam dùng đúng một roll seeded 30% để nhân đôi.
- Multi-hit composition: `apply-stat-stages` hỗ trợ target override `self` và `requireDamage`; Scale Shot roll 2–5 hit rồi hạ Defense/tăng Speed của user đúng một lần. Miss, immunity hoặc zero total damage không đổi stage.
- Event order: `powerResolved` đứng trước damage; Scale Shot phát damage theo hit, `hitCount`, rồi hai `statStageChanged`, đủ dữ liệu cho replay và move FX.
- Deferred: Assurance/Avalanche/Payback/Stomping Tantrum/Temper Flare cần per-turn damage/failure/action history; weight moves cần canonical weight; Infernal Parade cần secondary-status handler.
- Coverage: Single 69/862; Double 69/862; inventory còn 447 move chờ review.
- Validation: `npm run check` đạt; `npm test` đạt 192/192; candidate validate 0 lỗi.

## R3-12 — Protection và side guards

- Status: DONE cho protection core; các biến thể phản đòn khi contact và Feint-like removal tiếp tục blocked cho đến khi có after-block hook riêng.
- Ngày: 12/09/2026
- Personal protection: Protect và Detect tạo volatile một lượt. Move nhắm từ bên ngoài bị chặn trước accuracy/damage RNG nhưng attacker vẫn mất PP theo action order; manifest có cờ `bypassesProtect` tường minh cho mechanic được review sau này.
- Consecutive use: lần đầu thành công chắc chắn; chuỗi liên tiếp dùng xác suất `1`, `1/3`, `1/9`… với denominator tối đa 729. Bỏ qua một lượt làm stall state hết hạn và chuỗi bắt đầu lại.
- Side protection: Wide Guard bảo vệ cả phe trước spread move; Quick Guard bảo vệ cả phe trước move có priority dương. Condition tồn tại một lượt, dùng chung stall chain và được lifecycle phát `sideConditionEnded` khi hết hạn.
- Double targeting: Detect chỉ loại một target khỏi Eruption còn target kia vẫn nhận damage; Wide Guard loại cả hai ally khỏi cùng spread action. Protection được resolve theo từng target nên không tiêu accuracy roll cho target đã bị chặn.
- Nguồn cross-check: candidate PokéBase cho Champions description/max PP; Pokémon Showdown server commit `aa17ca0fac8bc5605df673bd8774c2d0e91efa43` cho priority, shared stall counter, duration, spread và positive-priority predicates.
- Coverage: Single 73/862; Double 73/862; inventory còn 443 move chờ review.
- Validation: `npm run check` đạt; `npm test` đạt 200/200; candidate validate 0 lỗi.

## R3-13 — Protection retaliation, removal và redirection

- Status: DONE cho phạm vi R3.5 có trong candidate hiện tại; Ability/item powder immunity và các protection/redirect move khác vẫn fail-closed theo entry riêng.
- Ngày: 12/09/2026
- Contact retaliation: Spiky Shield gây `floor(max HP / 8)` lên đúng contact attacker; King’s Shield hạ Attack một stage và chỉ chặn damaging move; Baneful Bunker áp regular poison qua shared major-status immunity. Non-contact move không kích hoạt phản đòn.
- Removal: Feint có priority 2, bypass protection và chạy `break-protection` trước accuracy/damage. Nó xóa personal protection cùng Wide/Quick Guard của target side, phát `protectionBroken`, không nhận phản đòn từ shield vừa phá.
- Redirection: Follow Me và Rage Powder yêu cầu ít nhất hai active Mon nên tiêu PP rồi fail trong Single. Trong Double, single-target opposing move dùng shared target resolver; redirect được resolve sau cùng thắng, hết hiệu lực cuối lượt và Grass attacker bỏ qua Rage Powder.
- Kiến trúc: retaliation nằm trong `protection.mjs`, phá protection và apply redirection là handler riêng; `rules-v3/redirection.mjs` chỉ chọn target và xử lý immunity cần biết attacker. Không có switch theo move ID.
- Nguồn cross-check: candidate PokéBase cho Champions values/description; Pokémon Showdown server pin `data/moves.ts` và `sim/battle-actions.ts` cho priority, contact outcome, Feint removal set, Double-only gate và Rage Powder immunity.
- Coverage: Single 79/862; Double 79/862; inventory còn 437 move chờ review.
- Validation: `npm run check` đạt; `npm test` đạt 211/211; candidate validate 0 lỗi.

## R3-14 — Pivot, forced switch và position swap

- Status: DONE cho switching/position core không phụ thuộc trap, weather, Substitute hoặc volatile transfer.
- Ngày: 12/09/2026
- Damage pivot: U-turn, Volt Switch và Flip Turn chỉ đổi sang reserve đã chọn sau actual damage. Miss/immunity/zero damage, actor faint hoặc reserve không còn hợp lệ giữ nguyên active slot; choice validator chặn thiếu/sai `switchToId` trước queue lock và resolver vẫn có fail-safe.
- Forced switch: Circle Throw và Dragon Tail gây damage rồi chọn reserve bằng seeded battle RNG; Roar và Whirlwind phaze không damage, priority −6 và bypass Protect theo flags đã review. Không còn reserve tạo failure event nhưng không hoàn tác damage.
- Queue/lifecycle: forced-out actor không còn active nên turn resolver phát `actionCancelled`; outgoing Mon dùng shared `applySwitch`, vì vậy reset stages/volatiles và toxic counter đúng contract. Event order là damage → switchOut → switchIn → forcedSwitch.
- Position: Ally Switch chỉ chạy trong Double với ally sống, đổi hai active slot trước các action target theo slot. Chuỗi riêng dùng `1`, `1/3`, `1/9` đến denominator 729 và hết hạn nếu bỏ một lượt; Single tiêu PP rồi fail rõ ràng.
- Deferred: Baton Pass cần whitelist state được transfer; Chilly Reception cần Snow lifecycle; Shed Tail cần Substitute/HP cost; Mean Look/Block/Spirit Shackle và partial-trap moves cần switch legality cùng source-link/residual contract.
- Nguồn cross-check: candidate PokéBase cho Champions values/description; Pokémon Showdown server pin `data/moves.ts` cho priority, contact, `selfSwitch`, `forceSwitch`, protect flags và Ally Switch counter.
- Coverage: Single 87/862; Double 87/862; inventory còn 429 move chờ review.
- Validation: `npm run check` đạt; `npm test` đạt 223/223; candidate validate 0 lỗi.

## R3-15 — Beta Slice v1 và passive damage

- Status: DONE cho content gate của beta đầu tiên; chưa promote vào schema-3 runtime trước R1 review/R4 integration.
- Ngày: 12/09/2026
- Slice: khóa sáu Pokémon M-A gồm Venusaur, Blastoise, Beedrill, Chesnaught, Decidueye và Feraligatr. Mỗi thành viên có đúng bốn move thuộc learnset và supported ở Single/Double; sáu held item tuân Item Clause.
- Ability: Overgrow, Blaze, Torrent và Swarm dùng chung `low-hp-type-boost`, kích hoạt khi HP ≤ 1/3 và chỉ tăng damage của hệ tương ứng 1.5×. Compiler tạo effect snapshot tách khỏi manifest để R4 gắn vào BattleMon khi khóa preview.
- Item: Miracle Seed, Mystic Water, Silver Powder và Dragon Fang tăng damage theo hệ 1.2×; Muscle Band/Wise Glasses tăng physical/special 1.1×. Ability và item compose theo thứ tự manifest, được ghi trong damage breakdown phục vụ replay/inspector.
- Gate: `npm run beta:validate` kiểm schema/snapshot/format, M-A legality, Species Clause, Item Clause, learnset/Ability relation và machine-readable coverage cho từng move/Ability/item ở cả hai format.
- Phạm vi: slice có 6 Pokémon, 6 hệ cơ thể, 15 move khác nhau, 3 Ability đang được dùng và 6 item; Blaze được mở sẵn cho batch Fire kế tiếp. Nội dung ngoài slice không được bật ngầm.
- Coverage: Single 97/862; Double 97/862; move inventory vẫn 87 reviewed và 429 pending vì Ability/item không làm tăng số move.
- Validation: `npm run check`, candidate validation, `npm run beta:validate` và `npm test` đạt 233/233.

## R1-04 / R4-01 — Scoped review và promoted beta catalog

- Status: DONE cho Beta Slice v1; full candidate vẫn review pending.
- Ngày: 12/09/2026
- Source review: đối chiếu Regulation M-A chính thức, sáu trang species detail và snapshot PokéBase đã hash. Review artifact khóa bốn source hash, đúng sáu detail URL, species/form/type/stats, learnset, Ability relation, item availability, coverage và Species/Item Clause.
- Training defaults: mỗi Mon có nature hợp lệ và đúng 66 Stat Points, không stat nào vượt 32; dữ liệu này nằm trong slice và được beta validator kiểm trước promote.
- Promote: `npm run content:promote -- pv-ma-2026-09-11` mặc định chỉ in dry-run; thêm `--apply` mới atomic-write catalog và active pointer. Review/snapshot/hash lệch sẽ chặn promote.
- Active catalog: `pv-ma-2026-09-11-beta-slice-v1`, schema 3, rules `champions-r2.0.0`; chỉ chứa 6 species, 15 moves, 3 Abilities và 6 items đã dùng trong slice.
- Service: `/api/v3/catalog` là read-only, `no-store`; response public bỏ mechanic manifests, còn server catalog giữ lookup maps và content đã pin hash.
- Validation: `npm run check`, candidate/beta validation, promote dry-run và `npm test` đạt 236/236.
- Remaining trước beta: schema-3 build/team/migration, battle factory/engine integration, Single/Double simulation và browser QA.

## R4-02 — Schema-3 Training/Team domain

- Status: DONE cho pure domain; server/save/UI wiring là ticket kế tiếp.
- State: tạo sáu Mon beta owned, sáu default builds và `Beta Squad` sáu thành viên từ promoted catalog. Mọi build giữ `catalogVersion`, revision và stable ID.
- Build validator: yêu cầu nature hợp lệ, đúng 66 Stat Points/cap 32, bốn move khác nhau thuộc learnset và enabled, Ability thuộc species và item enabled.
- Team validator: đúng sáu build, reference tồn tại, Species Clause và Item Clause; item `none` được phép lặp nếu được thêm ở slice tương lai.
- Actions: `buildV3.save` và `teamV3.save` dùng optimistic revision, trả lỗi machine-readable và không mutate input; beta editing không gắn phí economy trong domain này.
- Projection: Training view clone dữ liệu và trả một/song hệ từ catalog để UI không tự suy luận.
- Validation: targeted tests đạt 5/5; `npm run check` và full suite đạt 241/241.

## R4-03 — Schema-3 migration, save và Training/Team UI

- Status: DONE cho luồng build/team; Preview/Battle là checkpoint kế tiếp.
- Migration: save schema 2 không có trận đang diễn ra được nâng atomic lên schema 3, giữ wallet/account và lưu roster cũ trong `legacyV2Archive`; trận chưa kết thúc buộc migration chờ để không làm mất phiên đấu.
- Catalog safety: save schema 3 phải khớp đúng promoted `catalogVersion`; phiên bản save mới hơn ứng dụng hoặc catalog lệch đều fail-closed.
- Server: `buildV3.save` và `teamV3.save` chạy validator authoritative, optimistic revision, persist qua restart và chỉ broadcast projection `trainingV3`; archive thô không rời server.
- UI: Training hiển thị sáu Mon beta, một/song hệ, đúng 66 Stat Points, nature, Ability, item và bốn move hợp lệ. Team Builder có sáu slot và báo legality trước khi gửi; server vẫn quyết định Species/Item Clause.
- Compatibility: màn legacy và battle schema 2 vẫn tồn tại tạm thời để save cũ kết thúc an toàn; dữ liệu beta mới đã đọc/ghi qua schema 3.
- Validation: `npm run check`, `npm run beta:validate`, targeted tests đạt 6/6 và full suite đạt 247/247.

## R4-04 — Schema-3 Preview/Battle beta gate

- Status: BETA READY; đây là playable slice sáu Mon, chưa phải full roster/content coverage.
- Preview: Single khóa đúng 3 và lead 1; Double khóa đúng 4 và lead 2. Snapshot giữ stats level 50, PP, build, Ability/item passive effects, rules/catalog version; sửa build sau đó không đổi trận.
- Runtime: server chuẩn hóa target, priority, effective Speed, switch/pivot và phase revision trước khi gọi chung R2 turn engine + R3 mechanic handlers. End-turn, faint, replacement, surrender và result đều persist authoritative.
- Privacy: public opponent chỉ có species/type/HP percent/status; raw build, PP, passive effects và exact damage breakdown không broadcast. AI nhận projected player state và không cần hidden build để chọn target.
- UI: Battle Arena dùng schema 3, có closed Team Preview, command panels theo active slot, PP/target/switch, replacement validation, result và move FX code-based theo event/type; reduced-motion tắt projectile.
- Regression đã bắt và sửa trong browser QA: command cũ của Mon faint làm dư action; pivot target cũ sau replacement; nút replacement bật khi chưa chọn.
- Automated gate: `npm run check` và `npm run beta:validate` đạt; full suite đạt 254/254, gồm deterministic full-match Single/Double.
- Browser gate: Training hiện dual type + 66/66; Team có 6 slot hợp lệ; Single kết thúc ở turn 9, Double ở turn 8 qua replacement; move FX xuất hiện; restart phục hồi result; 0 console warning/error.

## R4-05 — Recruitment beta catalog và Pokémon idle sprites

- Status: DONE cho beta presentation; Roster Ranch rotation/trial/permanent action vẫn thuộc R5.
- Sửa regression: Recruitment từng tiếp tục đọc `recruitmentV2` + catalog Mon cũ nên có thể đứng ở `Loading Recruitment…` hoặc render Emberlyn/Tideray thay vì Pokémon schema 3.
- UI: `V3RecruitmentView` đọc trực tiếp `trainingV3` và promoted catalog, hiển thị sáu Pokémon, National Dex, hệ đơn/song hệ, Ability và bốn move hiện dùng. Sáu thành viên ghi `Unlocked` vì beta progression cấp sẵn đội hình để test battle.
- Art: Venusaur, Blastoise, Beedrill, Chesnaught, Decidueye và Feraligatr có animated idle GIF lưu local trong `public/pokemon-sprites`; Recruitment và Battle Preview/Arena không còn dùng SVG Mon cũ.
- Boundary: màn hình ghi rõ rotation, trial và permanent recruitment sẽ được mở trong R5 thay vì giả lập action chưa có schema-3 domain.
- Validation: UI test xác nhận 6 card, không có tên Mon cũ/Loading; browser xác nhận 6 ảnh `complete`, natural dimensions hợp lệ, Team Preview có 12 sprite instance từ đúng 6 local URL và 0 console warning/error.
### R4-06 — Đồng bộ các màn beta với Pokémon schema 3

- Home, Pokémon Archive, Gym và Field Guide đã chuyển sang `V3OverviewView`, dùng cùng catalog và build/team schema 3 với Training, Recruitment và Battle.
- Home và Archive hiển thị sáu Pokémon beta cùng idle sprite local; footer cũng báo đúng `6 / 6 BETA POKÉMON · SCHEMA 3`.
- Gym v1/v2 được chặn trong save schema 3. Màn Gym hiện ghi rõ trạng thái roadmap và vô hiệu hóa thử thách cho tới khi luồng Roster Ranch/Gym mới được triển khai, tránh trộn luật battle cũ vào beta.
- Browser QA trên `localhost:3100`: Home, Archive, Recruitment đều tải sáu sprite; Gym có sáu nút bị khóa; bốn màn không còn Emberlyn, Tideray, Mossprout hoặc Voltkit.
- Logic UI có test chống hồi quy cho roster sáu Pokémon, Single/Double entry point và Gym legacy bị khóa.
- Gate hoàn tất: `npm run check`, `npm run beta:validate` và full suite `256/256` đều đạt.
## R4-07 — Ordered turn playback và Battle Log schema 3

- Turn engine tiếp tục dùng thứ tự authoritative: switch → Mega → move priority → effective Speed → seeded tie key; Speed được tính lại trước mỗi action còn chờ nên speed control giữa turn có thể đổi thứ tự phần còn lại.
- Mỗi turn lưu snapshot đầu/cuối và event history đã project. Double Battle có test end-to-end xác nhận đủ bốn action opportunity đi theo Speed; Pokémon đã faint trước lượt phát `actionCancelled` đúng vị trí.
- `V3BattleTimeline` tách event stream thành từng action. Cast/skill FX chạy 1,05 giây trên snapshot trước impact; damage, heal, status, switch và faint chỉ áp vào snapshot hiển thị sau khi FX kết thúc, sau đó mới chuyển action kế tiếp.
- Battle Log chuyển từ mã event thô sang câu có Pokémon, move, Speed, PP, damage/HP%, effectiveness, status, switch, faint và end-turn; history của các turn trước được giữ lại.
- Browser QA Double turn 1: Feraligatr Speed 143 → Decidueye 134 → Venusaur 132 bị hủy do faint → Blastoise 130. HP giữ 100% tại 0 ms và 500 ms, chỉ đổi sau impact; UI hiển thị `ACTION 1/4`, không tính end-turn thành action thứ năm.
- Gate hoàn tất: `npm run check`, `npm run beta:validate` và full suite `257/257` đều đạt.
## R7-01 — Battle perspective sprites và arena staging

- Sáu front idle GIF tiếp tục dùng cho đối thủ trong battle; đã cache thêm sáu back idle GIF local cho phe người chơi dưới `public/pokemon-sprites/back`.
- `V3BattleScreen` yêu cầu perspective rõ ràng từ art helper: `front` cho opponent và `back` cho player. UI regression test khóa đúng hai front + hai back trong Double.
- Arena schema 3 có stylesheet riêng: enemy ở xa phía trên/phải, player ở gần phía dưới/trái, mỗi fighter có platform và HUD tách khỏi sprite. Single và Double có layout riêng cùng responsive rules.
- Browser QA xác nhận Single hiển thị Feraligatr front đối diện Venusaur back; Double hiển thị hai front sprite ở hàng xa và hai back sprite ở hàng gần, đúng góc nhìn game Pokémon tham khảo.
- Artwork ngoài battle chưa đổi; front GIF hiện tại chỉ là placeholder cho tới khi có nguồn key art/menu artwork riêng.

## R7-02 — Official artwork outside battle

- Verified the large official-artwork links on Pokémon Database for all six beta Pokémon and recorded their direct sources in `docs/pokemon-artwork-sources.md`.
- Added local transparent PNG copies for Venusaur, Blastoise, Beedrill, Chesnaught, Decidueye and Feraligatr. Only the edge-connected white JPEG canvas was removed.
- Home, Collection, Recruitment, Gym and Team Preview now use static official artwork. The active battle arena keeps the animated front/back GIF pair through a separate `battleArt` renderer.

## R7-03 — PokeAPI artwork source correction

- Replaced the processed Pokémon Database JPEG copies with native transparent official-artwork PNGs from `PokeAPI/sprites`.
- Pinned the six downloads to repository commit `2ecb4eeacd5a1718621fc30f12772e3f60d830b9` and mapped filenames by National Dex ID.
- Every asset is now an unmodified 475 × 475 RGBA PNG. The total artwork payload dropped from about 3.0 MB to under 1.0 MB.
