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
| R1 M-A Data | BETA 2 SLICE REVIEWED, FULL REVIEW PENDING | `pv-ma-2026-09-12-beta2`: scoped hash-bound approval cho 12 species/29 moves/4 Abilities/11 items; phần còn lại chưa được duyệt |
| R2 Battle Rules | DONE, SHADOW ONLY | Contract thuần cho 18 hệ, stats/damage, lifecycle, Single/Double và replay; chưa thay schema-2 runtime |
| R3 Mechanics Coverage | IN PROGRESS / WEATHER BATCH PROMOTED | 109 entry nền đã kiểm thử ở cả hai format; catalog hiện có 31 move/6 Ability/13 item, gồm Sun/Rain và các hook duration/Speed/heal |
| R4 | BETA GATE PASSED | Schema 3 chạy Home/Archive/Training/Team/Recruitment status/Guide → Preview → Battle Single/Double; Inspector migration theo beta feedback |
| R5 Roster Ranch | BETA 2 GATE PASSED | 10 offer deterministic, 22 giờ, Trial 7 ngày, permanent coin/ticket, expiry/receipt/restart và catalog rebase đã nối schema 3 |
| R6–R7 | R6 BETA SLICE PASSED; R7 CORE GATE PASSED | Mega Venusaur chạy end-to-end với Venusaurite/Thick Fat; 31/31 move có FX profile, ordered timeline và persistent Sun/Rain layer |
| M6–M7 | BLOCKED | Chỉ bắt đầu sau khi local battle schema 3 đã hoàn chỉnh |

Baseline logic hiện tại có 109/862 entry supported ở cả hai format. Trạng thái 753 blocked là fail-closed có chủ đích: catalog đã biết entry nhưng chưa cho dùng khi mechanic chưa có test evidence. Lệnh `npm run beta:validate` là gate riêng cho tập nội dung sẽ đưa vào beta.

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

Có thể làm prototype của chặng sau để kiểm kiến trúc, nhưng không nối vào production path trước gate. R3 không bắt buộc hỗ trợ cả 862 entry trước R4. **Beta Slice v1 đã được khóa** ở `app/content-src/beta-slice-v1.json`: sáu Pokémon, 15 move, 3 Ability được dùng và 6 held item, tất cả supported cho Single/Double. R1 chỉ review đúng các relation trong slice trước; R4 chỉ promote slice sau khi review đạt. Sau khi beta loop chạy end-to-end, R3 tiếp tục mở rộng theo batch có tác động rõ đến đội hình.

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

**Tiến độ beta:** scoped review cho `beta-slice-v1` đã pass và khóa SHA-256 của pokemon/moves/abilities/items snapshot. Sáu species detail URL, 15 learnset relations, ba Ability được dùng, sáu item và M-A Item Clause đã được đối chiếu. Approval này không mở khóa 856 entry ngoài slice.

### R1.3 Promote command — làm cùng R4

- `content:promote -- <snapshot-id>` phải validate lại, in semantic diff, yêu cầu exact ID và tạo atomic active pointer.
- Refuse snapshot chưa review, hash khác, unresolved khác 0, parser version không hỗ trợ hoặc thiếu coverage artifact.
- Có rollback về previous active snapshot; battle đã lock vẫn dùng snapshot cũ.

**Tiến độ beta:** `content:promote` đã có dry-run mặc định, exact snapshot check, review/hash/coverage gate và atomic active pointer. Catalog active `pv-ma-2026-09-11-beta-slice-v1` pin rules/catalog/snapshot versions; rollback UI và multi-version battle retention sẽ hoàn thiện cùng migration/battle factory.

**Gate:** cùng raw fixture sinh normalized JSON byte-identical; review report được ký nhận; promote dry-run cho diff dễ đọc và không chạm `.local-data`.

## 9. R2 — Battle Rules

**Trạng thái:** DONE dưới dạng shadow contract; runtime switch ở R4.

Đã có: 18-type chart và dual type; stats level 50 và nature; 66/32; common damage với 16 rolls; Single/Double target discovery; replacement/switch/Mega/move ordering; dynamic speed/Trick Room/tie RNG; faint cancellation; end-turn groups; snapshot versioning và replay equality.

Trước khi R4 kích hoạt, chạy lại fixture trong `docs/r2-battle-rules-reference-2026-09-12.md`, kiểm formula với PokéBase calculator và ghi version của mọi fallback main-series. R2 chỉ cung cấp primitives; named exception của move/Ability/item thuộc R3.

**Gate:** cùng snapshot + seed + command stream cho byte-identical final state/events/replay ở Single và Double.

## 10. R3 — Mechanics Coverage

**Trạng thái:** IN PROGRESS / WEATHER BATCH PROMOTED. Registry, manifest schema, coverage generator, capability inventory, shared accuracy/stages, status lifecycle, damage variants, protection/redirection, switching core, passive damage và Sun/Rain đã có. Tổng cộng 109 entry nền hiện supported trong cả hai format: 89 move, 7 Ability và 13 item.

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

**Tiến độ:** đủ sáu major status, confusion/flinch, Taunt/Encore/Disable và Leech Seed cho playable foundation. Linked residual giữ source slot qua source switch, dùng actual damage để heal và chạy trước poison/burn. Rest, Yawn, damaging secondary status, Fire-hit thaw, defrost move cùng các named volatile khác tiếp tục blocked theo capability riêng. R3.4 đã có primitive per-hit, multi-hit 2–5, recoil và drain theo actual damage.

### R3.4 Damage variants

- Multi-hit phải dùng đúng hit-count distribution và dừng khi faint.
- Recoil/drain dựa trên actual damage; fixed/level/HP/weight/speed/condition power có capability riêng.
- Secondary chance dùng battle RNG và có replay evidence.

**Tiến độ:** hoàn tất multi-hit hiện đại 35/35/15/15, fixed two-hit, dừng khi faint, recoil/drain actual damage, fixed level/current-HP, variable power theo HP/Speed/stages/fainted allies/status và seeded random. Scale Shot đã compose self stage sau chuỗi hit. Đã mở 30 move qua ba batch. Weight và per-turn-history variants giữ blocked cùng dependency rõ; chuyển sang R3.5.

### R3.5 Protection, redirection và target control

- Protect/Detect, Wide/Quick-style guards, consecutive success, Feint-like bypass nếu có.
- Follow Me/Rage Powder-like redirection, immunity và priority.
- Double tests phải bao phủ ally, both foes, all adjacent, field, side và invalid slot sau faint/switch.

**Tiến độ:** hoàn tất core cho Protect/Detect, Wide/Quick Guard, shared stall chain, Spiky Shield/King's Shield/Baneful Bunker contact retaliation và Feint removal. Follow Me/Rage Powder đã nối vào shared target resolver, gồm Double-only gate, latest redirect và Grass immunity của Rage Powder. Ability/item powder immunity chờ hook tương ứng. Chuyển sang R3.6 switching/position effects.

### R3.6 Switching và position effects

- Voluntary switch, pivot after hit, forced switch, trap, Baton Pass-like transfer và position swap.
- Chốt on-exit/on-entry order, hazards, replacement window, queued action cancellation và interaction với Mega.

**Tiến độ:** U-turn/Volt Switch/Flip Turn đã có post-damage pivot và pre-lock reserve validation. Circle Throw/Dragon Tail/Roar/Whirlwind dùng seeded forced switch, đúng priority/protect behavior và tự hủy queued action của actor bị đưa khỏi sân. Ally Switch đổi slot trong Double và có chuỗi thất bại độc lập. Baton Pass, Chilly Reception, Shed Tail, trapping cùng partial trapping tiếp tục blocked theo dependency được ghi trong progress.

### R3.7 Battlefield conditions

- Weather, terrain, rooms, screens, tailwind-like side effects, hazards và delayed effects.
- Mỗi condition có owner/scope, start event, duration, refresh/replace rule, modifier hooks, end event và cleanup.
- UI state phải derive từ battle state; animation overlay không giữ timer riêng.

**Tiến độ:** Sun và Rain đã chạy end-to-end. Sunny Day/Rain Dance đặt condition toàn sân 5 turn; Heat Rock/Damp Rock kéo đúng weather lên 8. Damage Fire/Water dùng modifier 1.5×/0.5× trong shared hit pipeline; Chlorophyll/Swift Swim sửa effective Speed ở dynamic queue; Rain Dish hồi 1/16 max HP trong end-turn group trước khi giảm timer. Start/end event, battle log, replay snapshot, field chip/layer và cast → impact timing dùng cùng authoritative state. Terrain, room, screen, Tailwind, hazard và delayed effect tiếp tục là các batch tách biệt.

### R3.8 Ability hooks

- Nhóm hook: pre-battle, on-entry, target/redirection, stat/damage modifier, immunity, after-hit, on-faint, end-turn, on-switch.
- Sau đó mới làm suppression, copy, swap/replace và ability-changing effects.
- Resolve đồng thời theo explicit priority/order; không dựa vào object insertion order.

**Tiến độ beta:** `low-hp-type-boost` đã mở Overgrow, Blaze, Torrent và Swarm với ngưỡng HP ≤ 1/3, hệ tương ứng và modifier 1.5×. Compiler tạo effect snapshot tách khỏi manifest; R4 sẽ gắn snapshot đó vào BattleMon khi khóa preview. Damage breakdown ghi source để replay và inspector không phải suy luận lại.

### R3.9 Item hooks

- Nhóm passive modifier, consumable berry, survival, choice/lock, recovery, status cure và Mega Stone.
- Tách `availableInChampions`, `legalByRegulation`, `implemented`, `enabledForBattle`.
- Consume/loss/swap phải có owner, reveal policy, idempotent event và restart/replay tests.

**Tiến độ beta:** `held-damage-boost` đã mở bốn item tăng hệ 1.2× và Muscle Band/Wise Glasses tăng category 1.1×. Item Clause được kiểm ở beta gate. Consumable, item loss/swap và suppression vẫn blocked cho đến khi có state/event contract riêng.

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

**Tiến độ:** DONE cho beta catalog. `/api/v3/catalog` đọc active pointer, xác minh SHA-256 trước khi load và chỉ expose nội dung đã promote; mechanic manifests chỉ tồn tại trong server catalog. Training/Team đã chuyển sang service này; Preview/Battle là consumer kế tiếp.

### R4.2 Build validator

- Validate ownership/Trial, exact species/form, nature, 66/32, bốn move khác nhau trong legal learnset, Ability hợp lệ và item được enable.
- Hiển thị một/song hệ rõ ràng; Mega form không được chọn như base build nếu flow yêu cầu stone + transform.
- Damage Inspector gọi cùng pure calculator/handlers của battle và ghi catalog/rules version.

**Tiến độ:** DONE cho beta build/team. Pure domain tạo sáu owned Mon/default builds/đội beta từ catalog. Build validator khóa exact 66/32, nature, bốn learnset moves, Ability và enabled item; save/server action dùng optimistic revision, persist qua restart và UI hiển thị type đơn/song hệ cùng legality.

### R4.3 Team/Preview/AI

- Regulation định nghĩa roster size, pick count, Species Clause, Item Clause, level, format và Mega count.
- Preview khóa immutable battle snapshot; chỉnh build sau đó không đổi trận đang diễn ra.
- AI chỉ nhận public projection và chỉ chọn command server xác nhận hợp lệ.

**Tiến độ:** DONE cho beta. Team Builder có sáu slot và clause authoritative; Preview khóa 3/4 ordered picks; battle snapshot pin build/stats/PP/passive; AI dùng projected state; server resolve Single/Double bằng cùng R2/R3 engine.

### R4.4 Migration schema 3

- Backup atomic trước migration; preserve wallet/settings/mail phù hợp; archive legacy roster/build/team rồi tạo trạng thái M-A mới.
- Migration thuần, idempotent, có dry-run report và không chạy khi legacy battle/result chưa xử lý xong.
- Rollback restore được test trên temporary save; không test bằng save thật.

**Tiến độ:** DONE cho beta runtime. Schema 2 được archive rồi nâng atomic; account/wallet được giữ, active legacy battle làm migration chờ, schema mới hơn hoặc catalog mismatch đều fail-closed.

### R4.5 UI QA

- Desktop/mobile: Archive → Training → Team → Preview → battle → result → restart.
- Kiểm empty/loading/error/unsupported states, keyboard focus, reduced motion và console/network errors.
- Test cả single-type/dual-type, invalid Stat Points, unsupported mechanic, expired Trial và snapshot mismatch.

**Tiến độ:** BETA GATE PASSED. Browser QA đã chơi xong Single/Double, đi qua replacement và move FX, kiểm restart cùng console/network; automated suite đạt 254/254. Archive/Inspector schema 3 được xếp sau beta feedback vì không chặn playable loop.

**Gate:** tạo team hợp lệ từ promoted M-A slice, restart, chơi xong Single và Double bằng schema 3; schema 2 chỉ còn compatibility/migration path.

**Beta 2 transition:** Catalog active đã mở rộng lên 12 Pokémon. Sáu starter giữ permanent; sáu Pokémon còn lại đi qua Roster Ranch thay vì được cấp sẵn. Save Beta 1 được backup và rebase catalog, giữ build/team tương thích.

## 12. R5 — Roster Ranch

**Trạng thái:** BETA 2 GATE PASSED. Runtime schema 3 dùng 10 offer không trùng, cycle 22 giờ, một Trial 7 ngày, ba paid refresh/cycle, permanent bằng 1.600 coin hoặc một Recruitment Ticket. Trial → permanent giữ `monId/buildId`; Trial hết hạn chặn preview mới. Action revision, action ID, ledger receipt, clock rollback và restart đã có test.

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

**Tiến độ R6-01:** Mega Venusaur là vertical slice đầu tiên. Relation, Mega Stone, form stats/type/Ability và sprite có provenance riêng trong `mega-beta-v1`. Server validate command ở submit/resolve, khóa một Mega mỗi side, transform trước move, giữ HP damage/PP/status/stages/volatiles, compile lại Thick Fat và dùng Speed form mới cho queue còn lại. UI, ordered timeline, Battle Log, Single/Double tests và browser QA đã đạt. Batch kế tiếp thêm relation/form mà không cần đổi turn engine; on-entry và suppression chỉ mở khi form được chọn thực sự cần hook đó.

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

**Tiến độ R7-04:** 29/29 move Beta 2 đã resolve qua registry profile/fallback và coverage report được verify tự động. Cast/impact dùng cùng move context; impact outcome lấy từ event authoritative cho hit/miss/block/status/heal/failed và spread target tracks. Palette đủ 18 hệ, reduced motion giữ caption/state. Batch còn lại của R7 tập trung persistent condition layers, playback 1×/2×/skip/cancel và matrix visual cho mobile/background tab.

**Tiến độ R7-05:** timeline runner đã có scaled/cancellable wait, 1×/2× persisted setting và Skip commit authoritative snapshot. Tab background, resize và navigation dùng cùng cancel path. Battle projection/adapter/CSS đã có persistent layer contract cho weather, terrain, Trick Room và side conditions; start/end event chỉ đổi layer ở impact. Các mechanics tạo condition vẫn phải được enable và test ở R3 trước khi xuất hiện trong trận Beta.

**Tiến độ R7-06:** core presentation gate đã đạt cho Beta 2. Anchor module ánh xạ actor/ally/foe/field theo đúng `activeSlot` ở Single/Double; cast và impact dùng cùng target identity từ event timeline. Spread move render track và outcome riêng cho từng target, kể cả mixed hit/miss/block/immune; drain/recoil không tạo target giả. Chế độ 2× đồng bộ cả wait timer, move primitive, fighter reaction và Mega CSS duration. Visual matrix rộng hơn trên mobile tiếp tục là regression QA khi thêm content, không còn chặn beta core hiện tại.

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

1. Review semantic đúng sáu species cùng 15 move, ba Ability được dùng và sáu item trong `beta-slice-v1`; lưu exact/missing/mismatch và provenance thay vì review toàn bộ 862 entry trước beta.
2. R4.1 catalog service và promote dry-run đã hoàn tất; mọi batch mới tiếp tục phải xuất đúng slice cùng coverage/provenance.
3. Nối schema-3 Training → Team → Preview → Battle; battle factory phải compile Ability/item passive effects vào immutable BattleMon snapshot và dùng cùng rules/mechanics engine ở Single/Double.
4. Chạy beta gate tự động, simulation/replay rồi browser QA cho một trận Single và một trận Double; chỉ sau đó mở beta local cho người test.
5. Beta 2, Mega Venusaur, core R7 và batch Sun/Rain đã qua gate tự động lẫn browser QA. Kế tiếp mở rộng R3.7 theo một condition batch có tác động rõ, ưu tiên terrain/side-speed trước hazard, và bổ sung FX override cùng lúc với content được promote.

Tài liệu tham chiếu trong repo:

- `docs/source-audit-2026-09-11.md`
- `docs/r2-battle-rules-reference-2026-09-12.md`
- `docs/r3-mechanics-coverage-2026-09-12.md`
- `docs/showdown-animation-reference-2026-09-12.md`
- `app/content-src/pokemon-sources.json`
#### Beta UI consistency gate (completed)

- Command Center, Pokémon Archive, Recruitment, Gym status, Field Guide and Battle now read the promoted schema-3 beta slice.
- Schema-3 saves cannot enter the legacy Gym battle path. Gym progression remains a later roadmap deliverable rather than an implied beta feature.
- Beta 2 catalog có 12 Pokémon; sáu starter permanent và sáu species mở qua Roster Ranch schema 3.
#### Ordered battle presentation gate (completed)

- Schema-3 UI replays the authoritative event order rather than applying the final turn snapshot immediately.
- A move's cast/skill FX completes before its damage and secondary events update the visible target; the next queued actor starts only after the impact frame.
- Battle Log records readable full-history entries with effective Speed and preserves cancelled actions in their correct queue position.
#### R7 battle perspective foundation (completed)

- Local battle assets now include paired front/back idle GIFs for the 12-Pokémon Beta 2 slice.
- Player fighters render with back sprites in the near field; opponents render with front sprites in the far field for both Single and Double.
- Non-battle artwork now uses the native transparent `official-artwork` PNG set from the PokeAPI sprites repository. The source is pinned to a reviewed commit and its Dex mapping is tracked in `docs/pokemon-artwork-sources.md`.
