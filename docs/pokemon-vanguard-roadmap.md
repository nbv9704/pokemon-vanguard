# Pokémon Vanguard — roadmap triển khai chuẩn

Version 2.0 · Rebaseline 12/09/2026

Tài liệu này là thứ tự triển khai chính thức của dự án. `ROADMAP.md` chỉ còn lưu hướng Aether cũ. Mỗi ticket phải đọc phần “quy trình chung”, hoàn thành đầu ra và test được nêu tại chặng tương ứng, rồi mới được đánh dấu DONE.

## 1. Mục tiêu và quyết định đã khóa

- Xây game battle local lấy Pokémon Champions làm chuẩn quan sát, trước mắt chỉ kích hoạt Regulation M-A.
- Single và Double là hai format ngang hàng. Một mechanic không được coi là hoàn tất nếu chỉ đúng ở Single.
- Pokémon có một hoặc hai hệ; engine dùng đủ 18 hệ và nhân hiệu quả qua cả hai hệ phòng thủ.
- Training dùng 66 Stat Points tổng cộng, tối đa 32 cho một stat.
- Species chỉ dùng move và Ability có trong snapshot Champions đã duyệt. Item phải đồng thời có trong nguồn, hợp lệ theo regulation và đã được engine hỗ trợ.
- Không có rarity và không có gacha theo rarity. Recruitment lấy một lineup không trùng species từ pool của banner rồi cho người chơi chọn.
- Trial bảy ngày, mua permanent bằng coin hoặc Recruitment Ticket là luật progression riêng của Vanguard; không được trình bày như luật chính thức của Champions.
- Bỏ Ascension/Aether Stone. Mega Evolution dùng Mega form và Mega Stone tương ứng.
- Pokémon hiển thị bằng front idle GIF lưu local; phía người chơi lật ngang. Khi ra chiêu, sprite vẫn idle, còn projectile, impact, camera, field và status được dựng bằng move FX.
- Runtime dùng tiếng Anh, chạy offline và không gọi PokéBase/Showdown. Remote chỉ được dùng trong công cụ tạo candidate.
- Schema 3 reset roster/build/team phát triển cũ sau khi backup; giữ wallet/settings phù hợp. Không mapping 36 Mon Aether sang Pokémon.
- Candidate mới chỉ được promote sau review thủ công; fetch hoặc parse không bao giờ tự thay catalog đang chạy.

## 2. Trạng thái thực tế

| Chặng | Trạng thái | Bằng chứng hiện tại |
| --- | --- | --- |
| R0 Rebaseline | DONE | Quyết định sản phẩm, source manifest và ranh giới migration đã khóa |
| R1 M-A Data | CODE DONE, REVIEW PENDING | `pv-ma-2026-09-11`: 213 species/forms, 516 moves, 180 Abilities, 166 items, 5 banners, 0 unresolved |
| R2 Battle Rules | DONE, SHADOW ONLY | Contract thuần cho 18 hệ, stats/damage, lifecycle, Single/Double và replay; chưa thay schema-2 runtime |
| R3 Mechanics Coverage | IN PROGRESS | Accuracy/stages, sáu major status và confusion/flinch lifecycle hoàn tất; 35/862 entry supported trong mỗi format |
| R4–R7 | NOT STARTED | Chỉ có module schema 2 và prototype cũ có thể tái sử dụng |
| M6–M7 | BLOCKED | Chỉ bắt đầu sau khi local battle schema 3 đã hoàn chỉnh |

Baseline hiện tại: `npm run check` đạt, `npm test` đạt 149/149. Trạng thái 827 blocked là fail-closed có chủ đích: catalog đã biết entry nhưng chưa cho dùng khi mechanic chưa có test evidence.

## 3. Thứ tự nguồn và cách xử lý mâu thuẫn

Áp dụng thứ tự sau cho từng fact:

1. Hành vi capture trực tiếp từ đúng build Pokémon Champions và đúng regulation mục tiêu.
2. Trang regulation/news chính thức của Pokémon Champions.
3. Snapshot PokéBase Champions đã hash, dùng cho species/form/stats/type/learnset/Ability/item/banner quan sát được.
4. Pokémon Showdown server data ở commit đã pin, chỉ làm cross-check cho mechanic main-series còn thiếu trường có cấu trúc.
5. Nguồn cộng đồng chỉ dùng để tạo giả thuyết cần test; không tự động trở thành luật.
6. Luật riêng Vanguard phải nằm trong config versioned và ghi rõ `origin: vanguard`.

Nếu hai nguồn mâu thuẫn, không chọn ngầm. Tạo một mục trong `docs/research/contradictions.md` gồm source URL, ngày/build/regulation, giá trị A/B, fixture bị ảnh hưởng và quyết định tạm thời. Entry liên quan giữ `implemented:false` hoặc `provisional:true`; Ranked không nhận provisional.

Mỗi lần kiểm web phải lưu:

- URL đầy đủ, UTC `fetchedAt`, HTTP status, ETag/Last-Modified nếu có, byte length và SHA-256;
- regulation, game build/season và ngôn ngữ;
- phần nào là dữ liệu có cấu trúc, phần nào chỉ là mô tả;
- parser name/version, raw fixture bất biến và normalized diff;
- kết luận, confidence, test fixture và người/ngày review.

Không parse mô tả tiếng Anh thành code. Description chỉ để hiển thị và hỗ trợ review; mechanic phải được biểu diễn bằng manifest cùng handler có tên rõ ràng.

## 4. Các web phải kiểm

| Nhóm | Nguồn cần kiểm | Dùng để làm gì | Không được suy ra |
| --- | --- | --- | --- |
| Sản phẩm | `https://www.pokemon.com/us/pokemon-video-games/pokemon-champions` | Mode được công bố, HOME, Mega/Omni Ring, định hướng chính thức | Công thức chi tiết hoặc timing chưa công bố |
| Regulation M-A | `https://champions-news.pokemon-home.com/en/page/751.html` | Eligible roster, Mega một lần/trận, Item Clause, timers | Effect cụ thể của move/Ability/item |
| Regular Roster M-A | `https://champions-news.pokemon-home.com/en/page/750.html` | Thời gian banner, pool theo regulation, refresh 22 giờ, lineup không trùng | Số lựa chọn, xác suất, shiny/mark/ball nếu trang không nêu |
| M-A species | URL `pokemon` trong `app/content-src/pokemon-sources.json` | Form slug, một/song hệ, base stats, regulation, learnset và Ability relation | Battle legality nếu relation thiếu hoặc mechanic chưa implement |
| Moves | `https://pokebase.app/pokemon-champions/moves` và detail page | Power, accuracy, PP, category, type, description | Priority, target, contact và handler nếu payload không có trường cấu trúc |
| Abilities | `https://pokebase.app/pokemon-champions/abilities` và detail page | ID, description, Mega classification | Trigger order hoặc effect executable |
| Items | `https://pokebase.app/pokemon-champions/items` và detail page | Availability, category, unlock metadata, Mega relation | Giá coin Vanguard hoặc implemented state |
| Build/rules | PokéBase `team-builder`, `damage-calc`, `speed-tiers` | 66/32 UI, level-50 formula, damage examples, speed observations | Named edge cases chưa capture |
| Main-series cross-check | `https://github.com/smogon/pokemon-showdown/blob/master/data/moves.ts`, `abilities.ts`, `items.ts`, `data/conditions.ts` | Priority, targets, flags và danh sách interaction cần kiểm | Tự động coi behavior Showdown là Champions behavior |
| Sprite | `https://play.pokemonshowdown.com/sprites/ani/` | Tên file, GIF front, hash và kích thước | Mapping form bằng cách thay dấu câu |
| FX architecture | `pokemon-showdown-client` tại commit pin; `battle-animations.ts` và `battle-animations-moves.ts` | Layer, projectile, easing, timing và target anchors để tham khảo | Copy animation table hoặc giả định repo có `/sprites` và `/audio` |

Khi M-B/M-C được bắt đầu, tạo snapshot và audit mới; không sửa M-A snapshot cũ. Trang M-B/M-C có thể dùng để kiểm schema chịu được regulation mới, nhưng không mở content đó trong runtime M-A.

## 5. Quy trình chuẩn cho một mechanic

Mọi move, Ability, item, status hoặc field effect đi qua cùng luồng:

1. **Khoanh phạm vi:** liệt kê entry M-A cần mechanic này và các format/target liên quan từ coverage report.
2. **Thu thập bằng chứng:** đọc nguồn chính thức/PokéBase có cấu trúc; dùng Showdown để lập danh sách edge case; capture Champions cho điểm khác biệt hoặc timing chưa rõ.
3. **Viết fixture trước:** lưu input, seed, commands, expected events/state và provenance. Tối thiểu có success, fail/no-op và interaction.
4. **Khai báo manifest:** priority, target, flags, hooks theo thứ tự, capability IDs, format support và fixture IDs.
5. **Viết handler nhỏ:** handler thuần nhận battle context, không đọc DOM, network, save hoặc `Date.now()`. RNG chỉ đi qua seeded RNG của battle.
6. **Tích hợp event:** engine phát semantic event; UI/animation chỉ đọc event và không tự tính damage/effect.
7. **Test:** positive, negative, immunity/failure, Single, Double, ordering, faint/replacement, deterministic replay. Thêm restart/privacy nếu effect đi qua server state.
8. **Regenerate coverage:** entry chỉ supported khi mọi handler tồn tại và toàn bộ evidence bắt buộc đã pass.
9. **Review diff:** kiểm entry vừa mở khóa, entry ngoài phạm vi không đổi và blocked reason còn rõ.

Không tạo `switch (moveId)` dài. Logic dùng capability chung như `direct-damage`, `apply-boost`, `set-weather`; move đặc biệt chỉ có override nhỏ khi không thể biểu diễn bằng composition.

## 6. Delivery sequence và dependency gate

`R0 Rebaseline → R1 M-A Data → R2 Battle Rules → R3 Mechanics Coverage → R4 Training/Team UI → R5 Roster Ranch → R6 Mega Evolution → R7 Sprite/Move FX → M6 PvP → M7 Ranked`

Có thể làm prototype của chặng sau để kiểm kiến trúc, nhưng không nối vào production path trước gate. R3 không bắt buộc hỗ trợ cả 862 entry trước R4; R4 chỉ được promote một **playable slice** mà tất cả move/Ability/item trong slice đều supported cho cả hai format. Sau đó R3 tiếp tục mở rộng coverage theo batch.

## 7. R0 — Rebaseline

**Trạng thái:** DONE.

Đã hoàn thành:

- khóa tên, English runtime, local-first, không rarity và M-A trước;
- giữ deterministic engine, authoritative server, storage/backup, ledger/receipt, Trial references, animation queue và simulations;
- loại assumptions Aether khỏi production direction;
- tách `catalogVersion` khỏi `rulesVersion`, candidate khỏi active content và schema 2 khỏi schema 3.

**Gate:** docs/source contract đồng thuận; schema-2 compatibility vẫn chạy; không ghi user save trong rebaseline.

## 8. R1 — M-A Data

**Trạng thái:** importer hoàn tất; review và promote command còn thiếu.

### R1.1 Snapshot và parser — DONE

- Raw response bất biến, metadata/hash đầy đủ, parser chạy offline.
- Dùng `sourceSlug` cho form; giữ upstream ID và regulation arrays.
- Candidate chứa species/moves/Abilities/items/banners/provenance/unresolved/review reports.
- Validate 18 type names, một hoặc hai type, sáu base stats và mọi reference.

### R1.2 Manual review — NEXT WHEN R3 PLAYABLE SLICE IS KNOWN

- So sánh 213 form với official M-A eligible list; tạo report exact/missing/extra/form mismatch.
- Lấy mẫu mọi nhóm form đặc biệt, gender/regional/form mode và tất cả Mega relation.
- So sánh learnset/Ability/item links với trang detail, không chỉ list page.
- Phân loại 516 moves theo capability để lên batch R3; không review tuần tự theo alphabet.
- Ghi rõ 5 banner nào thuộc M-A, special hay future; active interval phải có timezone.

### R1.3 Promote command — làm cùng R4

- `content:promote -- <snapshot-id>` phải validate lại, in semantic diff, yêu cầu exact ID và tạo atomic active pointer.
- Refuse snapshot chưa review, hash khác, unresolved khác 0, parser version không hỗ trợ hoặc thiếu coverage artifact.
- Có rollback về previous active snapshot; battle đã lock vẫn dùng snapshot cũ.

**Gate:** cùng raw fixture sinh normalized JSON byte-identical; review report được ký nhận; promote dry-run cho diff dễ đọc và không chạm `.local-data`.

## 9. R2 — Battle Rules

**Trạng thái:** DONE dưới dạng shadow contract; runtime switch ở R4.

Đã có: 18-type chart và dual type; stats level 50 và nature; 66/32; common damage với 16 rolls; Single/Double target discovery; replacement/switch/Mega/move ordering; dynamic speed/Trick Room/tie RNG; faint cancellation; end-turn groups; snapshot versioning và replay equality.

Trước khi R4 kích hoạt, chạy lại fixture trong `docs/r2-battle-rules-reference-2026-09-12.md`, kiểm formula với PokéBase calculator và ghi version của mọi fallback main-series. R2 chỉ cung cấp primitives; named exception của move/Ability/item thuộc R3.

**Gate:** cùng snapshot + seed + command stream cho byte-identical final state/events/replay ở Single và Double.

## 10. R3 — Mechanics Coverage

**Trạng thái:** IN PROGRESS. Registry, manifest schema, coverage generator, capability inventory, shared accuracy/stages và burn/poison/paralysis lifecycle đã có. Tổng cộng 28 entry hiện supported trong cả hai format.

### R3.1 Direct/status damage core

- Mở rộng manifest cho standard physical/special/status, always-hit, immunity, contact/non-contact và all-adjacent spread.
- Chốt accuracy timing, crit eligibility, random roll, STAB, burn, spread và Protect interaction.
- Không gom fixed/variable damage vào direct damage nếu formula khác.
- Test mục tiêu tự chọn, ally target, redirection, miss, immune, faint giữa lượt và replay.

**Đầu ra:** capability primitives ổn định và batch move cơ bản đủ để lập hai team playable.

### R3.2 Stat stages, accuracy và evasion

- Handler tăng/giảm/reset/copy stat stages; clamp −6…+6; self/target/all target.
- Xác minh thứ tự accuracy/evasion, always-hit và Ability/item modifier.
- Event phải ghi requested delta, applied delta và reason khi fail/clamp.

**Tiến độ:** basic self/ally boosts, target debuffs, accuracy/evasion stages, per-target spread accuracy, redirection và always-hit bypass đã hoàn tất. Minimize và các move có volatile/named exception vẫn bị chặn cho đến khi interaction riêng có handler.

### R3.3 Major status và volatile status

- Major: burn, paralysis, poison/bad poison, sleep, freeze hoặc trạng thái tương ứng đúng Champions.
- Volatile: flinch, confusion, taunt, encore, disable, leech/seed-like effects và duration counters.
- Capture duration, immunity, overwrite, switch cleanup/persistence và end-turn order; điều chưa xác minh giữ blocked.

**Tiến độ:** đủ sáu major status đã có state/lifecycle cơ bản. Confusion đã có timer, 33% stage-aware self-hit và action ordering; flinch đã có consume/end-turn cleanup. Confuse Ray, Flatter và Swagger có evidence Single/Double, bao gồm ally target và redirection. Rest, Yawn, damaging secondary status, Fire-hit thaw và defrost move tiếp tục blocked. Bước kế tiếp là Taunt command gate; sau đó thêm last-successful-move tracking cho Encore/Disable rồi mới tới seed-like residual.

### R3.4 Damage variants

- Multi-hit phải dùng đúng hit-count distribution và dừng khi faint.
- Recoil/drain dựa trên actual damage; fixed/level/HP/weight/speed/condition power có capability riêng.
- Secondary chance dùng battle RNG và có replay evidence.

### R3.5 Protection, redirection và target control

- Protect/Detect, Wide/Quick-style guards, consecutive success, Feint-like bypass nếu có.
- Follow Me/Rage Powder-like redirection, immunity và priority.
- Double tests phải bao phủ ally, both foes, all adjacent, field, side và invalid slot sau faint/switch.

### R3.6 Switching và position effects

- Voluntary switch, pivot after hit, forced switch, trap, Baton Pass-like transfer và position swap.
- Chốt on-exit/on-entry order, hazards, replacement window, queued action cancellation và interaction với Mega.

### R3.7 Battlefield conditions

- Weather, terrain, rooms, screens, tailwind-like side effects, hazards và delayed effects.
- Mỗi condition có owner/scope, start event, duration, refresh/replace rule, modifier hooks, end event và cleanup.
- UI state phải derive từ battle state; animation overlay không giữ timer riêng.

### R3.8 Ability hooks

- Nhóm hook: pre-battle, on-entry, target/redirection, stat/damage modifier, immunity, after-hit, on-faint, end-turn, on-switch.
- Sau đó mới làm suppression, copy, swap/replace và ability-changing effects.
- Resolve đồng thời theo explicit priority/order; không dựa vào object insertion order.

### R3.9 Item hooks

- Nhóm passive modifier, consumable berry, survival, choice/lock, recovery, status cure và Mega Stone.
- Tách `availableInChampions`, `legalByRegulation`, `implemented`, `enabledForBattle`.
- Consume/loss/swap phải có owner, reveal policy, idempotent event và restart/replay tests.

### R3.10 M-A closure

- Regenerate matrix theo capability family, không theo phần trăm mơ hồ.
- Mỗi blocked entry phải có một reason cụ thể: missing manifest/handler/evidence/source conflict hoặc unsupported format.
- Chọn playable slice tối thiểu cho R4: đủ species để tạo nhiều team, mỗi species có ít nhất bốn move hợp lệ, ít nhất một Ability và một tập item không tạo team bế tắc.

**Gate R3 cho playable slice:** mọi entry được bật có positive/negative/interaction/replay evidence ở Single và Double; 0 provisional; mọi entry còn lại fail-closed với machine-readable reason.

## 11. R4 — Training, Team UI và schema 3 runtime

### R4.1 Catalog service

- Tạo read-only versioned catalog service dùng chung cho Archive, Training, Inspector, Team Builder, Preview, AI và battle factory.
- Không để UI import JSON trực tiếp hoặc tự tính legality.
- Response trả stable ID, display fields, support status và lỗi regulation có mã.

### R4.2 Build validator

- Validate ownership/Trial, exact species/form, nature, 66/32, bốn move khác nhau trong legal learnset, Ability hợp lệ và item được enable.
- Hiển thị một/song hệ rõ ràng; Mega form không được chọn như base build nếu flow yêu cầu stone + transform.
- Damage Inspector gọi cùng pure calculator/handlers của battle và ghi catalog/rules version.

### R4.3 Team/Preview/AI

- Regulation định nghĩa roster size, pick count, Species Clause, Item Clause, level, format và Mega count.
- Preview khóa immutable battle snapshot; chỉnh build sau đó không đổi trận đang diễn ra.
- AI chỉ nhận public projection và chỉ chọn command server xác nhận hợp lệ.

### R4.4 Migration schema 3

- Backup atomic trước migration; preserve wallet/settings/mail phù hợp; archive legacy roster/build/team rồi tạo trạng thái M-A mới.
- Migration thuần, idempotent, có dry-run report và không chạy khi legacy battle/result chưa xử lý xong.
- Rollback restore được test trên temporary save; không test bằng save thật.

### R4.5 UI QA

- Desktop/mobile: Archive → Training → Team → Preview → battle → result → restart.
- Kiểm empty/loading/error/unsupported states, keyboard focus, reduced motion và console/network errors.
- Test cả single-type/dual-type, invalid Stat Points, unsupported mechanic, expired Trial và snapshot mismatch.

**Gate:** tạo team hợp lệ từ promoted M-A slice, restart, chơi xong Single và Double bằng schema 3; schema 2 chỉ còn compatibility/migration path.

## 12. R5 — Roster Ranch

Nguồn chính thức M-A xác nhận lineup không có hai Pokémon giống nhau và miễn phí sau mỗi 22 giờ; VP/Quick Coupon có thể rút ngắn. Snapshot PokéBase đã quan sát 10 kết quả một Recruit. Vì số 10 chưa có bằng chứng chính thức trong audit, `pullCount` phải thuộc banner snapshot và kèm provenance.

### Luồng server

1. Chọn banner theo server clock và active interval.
2. Tạo lineup deterministic từ seed/receipt, không replacement trong cùng lineup.
3. Persist lineup trước khi trả response; retry cùng action ID trả cùng lineup.
4. Người chơi chọn một species; server tạo Trial bảy ngày theo config Vanguard.
5. Permanent upgrade giữ nguyên Pokémon/build/team references và settle coin/ticket một lần.
6. Expiry chặn preview mới nhưng không sửa battle snapshot đã khóa.

Phải capture thêm trước khi mô phỏng Champions fidelity: exact lineup count, duplicate-form semantics, refresh/coupon cost, shiny/mark/ball behavior và special banner ticket. Nếu chưa có bằng chứng, dùng luật Vanguard được ghi rõ, không gắn nhãn Champions.

**Test:** clock rollback, refresh boundary/timezone, retry/restart, insufficient currency, duplicate action, expired Trial, team reference, concurrent select và banner hết hạn.

**Gate:** banner → lineup → Trial → team → preview → battle → expiry/permanent vẫn nhất quán qua restart và ledger settle đúng một lần.

## 13. R6 — Mega Evolution

### Dữ liệu và legality

- Relation chuẩn: `{baseSpeciesId, megaSpeciesId, itemId, regulationSets}`; Mega form sở hữu stats/type/Ability/sprite riêng.
- M-A cho phép Mega đúng một lần mỗi battle và yêu cầu Mega Stone; Item Clause vẫn áp dụng.
- Validate ở command submit và resolve vì switch/faint/item state có thể đổi.

### State transition

- Capture và fixture hóa exact timing, HP continuity, stat recalculation/rounding, type/Ability swap, on-entry behavior, suppression và switch persistence.
- Giữ PP, status, stages và volatiles chỉ khi được nguồn/capture xác nhận; không sao chép assumptions từ engine cũ.
- Sau transform, action order còn lại dùng speed mới theo R2; tie RNG không bốc lại.
- Event công khai transformation và form mới nhưng không lộ command/hidden data sớm.

### Test matrix

- valid Single/Double, hai eligible Pokémon cùng side, attempt thứ hai, sai stone/form/regulation, switch trước turn, faint trước activation, speed reorder, Ability change, reconnect/replay/restart.

**Gate:** Mega state và replay giống nhau qua live resolve/restart; mọi illegal attempt có error code ổn định.

## 14. R7 — Sprite và move FX

### R7.1 Asset pipeline

- Fetch sprite listing ở snapshot tool, pin URL/hash, map bằng explicit alias; audit base và Mega riêng.
- Validate GIF signature, dimensions/frame metadata, file budget và duplicate hash; không silent fallback sang form khác.
- Runtime preload chỉ roster trận, cache local, player side dùng CSS/canvas flip với cùng feet baseline.
- Lập `ASSET_LICENSES.md`; Showdown client là AGPLv3 và repo không kèm `/sprites` hoặc `/audio`, nên chỉ dùng kiến trúc làm reference và không copy code/table nếu chưa giải quyết license.

### R7.2 FX architecture

- `timeline runner`: play/cancel/skip/speed/reduced-motion, không chứa move-specific logic.
- `primitives`: projectile, beam, slash, burst, ring, particles, overlay, shake, flash, number/text cue.
- `anchors/layers`: actor/target/ally/foes/field/side và behind/front/UI cho Single/Double.
- `profiles`: composition dùng chung theo capability/type/category.
- `overrides`: file nhỏ cho move có nhịp hoặc nhiều phase đặc biệt.
- `event adapter`: map semantic battle events sang visual cues; không đọc HP để suy luận kết quả.

Mọi enabled move cần profile hoặc fallback rõ ràng. Sprite Pokémon giữ idle trong suốt chiêu; contact có thể dùng camera/impact/slot shake mà không cần animate cơ thể.

### R7.3 Visual/performance QA

- Representative matrix: physical contact, projectile, beam, spread, self-buff, heal, status, weather, terrain, protect, switch và Mega.
- Kiểm Single/Double, nhiều target song song, desktop/mobile, 1×/2×/skip, reduced motion, tab background/resume và offline.
- Animation queue luôn kết thúc/cancel được; missing asset/FX không chặn command tiếp theo.

**Gate:** 100% move được enable có profile/override/fallback đã test; không network runtime; visual event order khớp replay.

## 15. M6 — Private PvP

- Server authoritative cho room create/join, preview, commands, replacements, surrender và result.
- Pin catalog/rules/regulation/mechanics versions khi lock room; hai client khác version bị từ chối trước trận.
- Command có action ID/idempotency, deadline server-side và reconnect token; choice ẩn cho đến resolve.
- `viewFor` tách owner/opponent/spectator, che moves/PP/Ability/item/stats chưa reveal và internal RNG.
- Persist room/replay/receipts để process restart vẫn resume; có disconnect grace, timeout, draw và abandonment rules.
- Dùng timer M-A đã xác minh làm preset competitive: total 20 phút, player 7 phút, turn 45 giây, preview 90 giây; local casual có thể dùng preset riêng được gắn `origin:vanguard`.

**Test:** hai browser Single/Double, simultaneous submit, duplicate/reordered packet, disconnect cả hai phía, restart, spectator injection, stale version và clock expiry.

**Gate:** hai browser hoàn tất trận và reconnect với state giống nhau; spectator không hành động hoặc đọc hidden information.

## 16. M7 — Ranked

- Identity/auth trước queue; không dùng client-supplied rating/result.
- Matchmaking theo format/region/rating với season-pinned regulation; queue ticket chống duplicate.
- Rating algorithm versioned và test bằng reference vectors; season reset/decay/reward là config bất biến theo season.
- Settlement chỉ từ authoritative completed match, có unique match receipt và transaction một lần.
- Audit log/replay privacy-safe, moderation/report hooks, ban/queue abuse controls và rollback procedure.
- Chỉ content `implemented:true`, đủ cả hai format và không provisional được vào ranked regulation.
- Load test queue/room/storage; chaos test disconnect/restart; test season transition, stale client và result replay attack.

Official Champions hiện mô tả rank thay đổi theo thắng/thua và placement ở Master Ball Tier dựa trên rating, nhưng không công bố thuật toán. Vanguard phải chọn thuật toán riêng, ghi rõ là local design và không tuyên bố clone chính xác nếu chưa có dữ liệu.

**Gate:** match → result → rating/reward settle đúng một lần; season có thể tái hiện từ config/audit và rollback an toàn.

## 17. Kiểm tra bắt buộc và lệnh làm việc

Chạy trong `D:\Mon\AetherChampions\app`:

```powershell
npm run check
npm test
npm run pokemon:validate -- pv-ma-2026-09-11
npm run mechanics:inventory -- pv-ma-2026-09-11
npm run mechanics:coverage -- pv-ma-2026-09-11
```

Nếu tên script thay đổi, cập nhật cả `package.json`, README liên quan và roadmap trong cùng commit. Với battle change, chạy thêm test file gần nhất trước full suite và seeded simulation. Với UI, mở server local bằng script của project, test một room riêng và kiểm console. Với content, rebuild từ raw fixture hai lần rồi so hash/bytes. Không lệnh nào trong test/import được đọc hoặc ghi `.local-data`.

Ticket chỉ DONE khi có:

- source/provenance hoặc quyết định Vanguard rõ ràng;
- contract/schema và implementation nhỏ theo trách nhiệm;
- positive, negative, interaction, Single/Double và replay tests phù hợp;
- persistence/privacy/error UX nếu đi qua server;
- coverage/diff/report được cập nhật;
- `npm run check` và `npm test` đạt;
- `docs/progress.md` ghi kết quả, số test, commit và giới hạn còn lại.

## 18. Quy tắc bảo trì file

- Một file chỉ có một trách nhiệm chính. Khi file bắt đầu chứa orchestration, data mapping và UI rendering cùng lúc, tách trước khi thêm feature tiếp theo.
- Handler theo capability; manifest là data; renderer chỉ render; route/dispatcher chỉ validate và điều phối.
- Không thêm species-specific logic vào battle core, không thêm move table khổng lồ vào một file và không để `client.js` trở lại thành nơi chứa mọi màn hình.
- Ưu tiên module dưới khoảng 300–400 dòng; đây là tín hiệu review chứ không phải quota cứng. Tách theo ranh giới behavior, không cắt cơ học.
- Public API nhỏ và explicit; tránh import sâu giữa feature folders. Dependency đi theo hướng catalog/rules/mechanics → server service → UI/event adapter.
- Generated files phải có header/source hash và không chỉnh tay. Raw candidates, reports lớn và user saves không commit nếu policy hiện tại ignore chúng.

## 19. Việc làm ngay sau tài liệu này

1. Tiếp tục R3.3: Taunt command gate, last-successful-move tracking cho Encore/Disable, rồi seed-like residual.
2. Dùng capability inventory 516 move để chọn batch theo mức tái sử dụng; description signals chỉ là research queue.
3. Thêm fixture/provenance cho mỗi capability; regenerate coverage sau từng batch.
4. Khi có playable slice đủ team, thực hiện R1 manual review cho đúng slice rồi bắt đầu R4 catalog service/promote dry-run.
5. Không bắt đầu R5/R6/R7 production integration trước khi schema 3 battle loop của R4 chạy xong cả Single và Double.

Tài liệu tham chiếu trong repo:

- `docs/source-audit-2026-09-11.md`
- `docs/r2-battle-rules-reference-2026-09-12.md`
- `docs/r3-mechanics-coverage-2026-09-12.md`
- `docs/showdown-animation-reference-2026-09-12.md`
- `app/content-src/pokemon-sources.json`
