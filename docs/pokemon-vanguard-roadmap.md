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
| R1 M-A Data | BETA SLICE REVIEWED, FULL REVIEW PENDING | `pv-ma-2026-09-12-beta2` + Beta v35: canonical overlay + scoped hash-bound promotion cho **213/213 selectable non-Mega M-A entries**, 490 moves, 180 ordinary Abilities và 82 ordinary items; M-A Mega scope khóa riêng ở 59/59 forms trên 58 base species |
| R2 Battle Rules | DONE, SHADOW ONLY | Contract thuần cho 18 hệ, stats/damage, lifecycle, Single/Double và replay; chưa thay schema-2 runtime |
| R3 Mechanics Coverage | IN PROGRESS / GLOBAL REVIEW COMPLETE | **862/862 candidate entry reviewed** ở cả hai format; executable runtime = **507 move / 180 Ability / 149 item**; active Beta v35 có **213 species/490 move/180 ordinary Ability/82 ordinary item**, toàn bộ 213 canonical non-Mega entries content-complete; M-A runtime expose 59 legal Mega forms trên 58 bases, còn 5 implementation M-B/M-C được giữ ngoài M-A |
| R4 | BETA GATE PASSED | Schema 3 chạy Home/Archive/Training/Team/Recruitment status/Guide → Preview → Battle Single/Double; Inspector migration theo beta feedback |
| R5 Roster Ranch | BETA 2 GATE PASSED | 10 offer deterministic, 22 giờ, Trial 7 ngày, permanent coin/ticket, expiry/receipt/restart và catalog rebase đã nối schema 3 |
| R6–R7 | R6 BETA SLICE PASSED; R7 CORE GATE PASSED | 64 Mega implementation tồn tại trong source/runtime chung, trong đó M-A expose đúng 59 legal forms và 5 form còn lại thuộc M-B/M-C; 490/490 active move có FX profile, ordered timeline và persistent/delayed/commitment/semi-invulnerable/secondary presentation |
| M6–M7 | BLOCKED | Chỉ bắt đầu sau khi local battle schema 3 đã hoàn chỉnh |

Baseline logic hiện tại tách hai metric: **862/862 reviewed** và **836/862 runtime-supported** ở cả hai format. 26 entry runtime-blocked đều đã được review và fail-closed có lý do machine-readable (9 move unavailable/legacy theo Champions hiện tại + 17 Mega Stone chưa promote relation/form). Copycat/Instruct/Sleep Talk đã có shared called-move runtime; Tera Blast vẫn fail-closed vì Terastallization chưa có battle runtime. R3-78–80 mở Mega-first expansion; R3-81 khóa contract full legal learnset/Ability cho mọi base species đã có Mega và thêm `mega:validate`; R3-82–84 tăng dần lên Beta v28/mega-beta-v7 với 41 base species content-complete và 42 relations. R3-85 mở Beta v29/mega-beta-v8: thêm 18 base species, 22 relations gồm Raichu X/Y và alternate Absol/Garchomp/Lucario Z, gender gate cho Mega Meowstic, explicit physical foundation cho 127 battle forms và các generic Ability hooks mới cho protection pierce, Parental Bond, Shadow Tag, terrain/aura và damage-response. R3-86 mở Beta v30 bằng 20 non-Mega M-A species vertical-complete, đưa active catalog lên 83 Pokémon/427 move/112 ordinary Ability/82 item và foundation lên 147 forms; Mega vẫn 64 relations, còn validator tách đúng invariant promoted-Mega-base khỏi non-Mega complete. R3-87 mở Beta v31 bằng thêm 25 species vertical-complete, đưa active catalog lên 108 Pokémon/431 move/120 ordinary Ability/82 item, 104 content-complete species và foundation 172 forms; expanded-catalog ceiling tăng 128→256 để không chặn candidate M-A 213 entries. R3-88 mở Beta v32 bằng thêm 25 species vertical-complete, đưa active catalog lên 133 Pokémon/440 move/140 ordinary Ability/82 item, 129 content-complete species và foundation 197 forms. R3-89 mở Beta v33 bằng thêm 25 species vertical-complete, đưa active catalog lên 158 Pokémon/460 move/155 ordinary Ability/82 item, 154 content-complete species và foundation 222 forms. R3-90 khóa source-of-truth M-A thành **272 battle-content entries = 213 non-Mega + 59 Mega**, sửa năm Mega M-B/M-C bị tag nhầm M-A, và mở Beta v34 bằng 30-entry closure lên **184 Pokémon/472 move/163 ordinary Ability/82 item**, foundation 248 forms; **184/213 non-Mega + 59/59 Mega = 243/272 M-A entries** đã vertical-complete, còn 29 non-Mega entries. R3-91 canonicalize exact 213 selectable non-Mega IDs, thay ba snapshot artifact (Aegislash Blade/Shield + generic Lycanroc) bằng Gourgeist Small/Large/Jumbo, hoàn thiện 29 entry cuối và mở Beta v35 lên **213 Pokémon/490 move/180 ordinary Ability/82 item**; **213/213 non-Mega + 59/59 Mega = 272/272 M-A battle-content entries** vertical-complete. Không còn missing manifest. Lệnh `npm run beta:validate` vẫn là gate riêng cho tập nội dung sẽ đưa vào beta.

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

**Trạng thái:** IN PROGRESS / TERRAIN FAMILY CORE COMPLETE. Registry, manifest schema, coverage generator, capability inventory, shared accuracy/stages, status lifecycle, damage variants, protection/redirection, switching core, passive damage, Sun/Rain, Tailwind, screens và cả bốn terrain core đã có. Tổng cộng 118 entry nền hiện supported trong cả hai format: 96 move, 7 Ability và 15 item. Active Beta Slice vẫn là v5 vì Electric/Psychic Terrain chưa có relation trong 12-Pokémon beta.

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

**Tiến độ:** đủ sáu major status, confusion/flinch, Taunt/Encore/Disable và Leech Seed cho playable foundation. Linked residual giữ source slot qua source switch, dùng actual damage để heal và chạy trước poison/burn. Yawn đã hoàn tất ở R3-25 qua delayed scheduler; Rest, damaging secondary status, Fire-hit thaw, defrost move cùng các named volatile khác tiếp tục blocked theo capability riêng. R3.4 đã có primitive per-hit, multi-hit 2–5, recoil và drain theo actual damage.

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

**Tiến độ:** Sun/Rain, terrain, screens, hazards, Room family, delayed-effect family, charge/recharge và semi-invulnerable commitment family đều đã có authoritative lifecycle. R3-24 thêm `field.rooms`; R3-25 thêm delayed scheduler; R3-26 thêm two-turn/recharge commitment state; R3-27 mở rộng commitment sang underground/underwater/airborne/vanished cùng hit-through exceptions. Beta v12 promote thêm Dig/Fly/Dive/Phantom Force bằng relation M-A thật. Trick/Magic Room vẫn content-blocked vì không có relation trong 12-Pokémon beta. Future Sight-style attacks, Soundproof/Baton Pass transfer, Gravity/Bounce/Sky Drop và unreviewed grounding side effects tiếp tục fail-closed.

**Tiến độ side condition:** Tailwind đặt condition 4 turn cho đúng side và nhân đôi effective Speed; dynamic queue tính lại nên đồng đội chưa hành động có thể vượt đối thủ ngay trong cùng turn. Reflect/Light Screen tồn tại 5 turn, giảm đúng physical/special damage còn 1/2 ở Single và fixed-point 2732/4096 ở Double; critical hit bỏ qua screen. Light Clay kéo riêng hai screen lên 8 turn. Duplicate cast thất bại nhưng vẫn đi qua PP/action log. Infiltrator, screen breaking và Aurora Veil vẫn fail-closed tới batch interaction tương ứng.

**Tiến độ terrain (R3-18 / Beta 3-03):** Grassy Terrain và Misty Terrain đã promote trong Beta Slice v5. Cả hai là field-global 5 turn, Terrain Extender kéo terrain do holder tạo lên 8. Grassy Terrain hồi 1/16 max HP cho grounded active Mon, boost Grass damage bằng fixed-point 5325/4096 và giảm 1/2 base power của Earthquake/Bulldoze/Magnitude vào grounded target. Misty Terrain chặn major status/confusion và giảm 1/2 Dragon damage trên grounded target. Same-terrain recast fail sau PP; terrain khác phát end-event `replaced` rồi start-event mới. Grounding hiện chỉ claim cho Flying + các airborne volatile đã có state; Levitate/Air Balloon/Gravity và các override khác vẫn fail-closed. Active base catalog 36 move/6 Ability/15 item và R7 FX 36/36.

**Tiến độ terrain core (R3-19):** Electric Terrain và Psychic Terrain đã hoàn tất ở shared mechanics layer nhưng không promote vào Beta Slice v5 vì 12 species active không có learnset relation cho hai move này. Electric Terrain boost grounded Electric damage bằng `5325/4096` và chặn Sleep mới trên grounded target; Psychic Terrain boost grounded Psychic damage bằng `5325/4096` và chặn priority `> 0.1` nhắm grounded foe, nhưng không chặn self/ally/airborne target và không bị `bypassesProtect` xuyên qua. Cả hai tái sử dụng lifecycle 5 turn / Terrain Extender 8 turn. Coverage lên **118/862** mỗi format = 96 move / 7 Ability / 15 item; active Beta v5 và FX 36/36 không đổi.

**Tiến độ replacement window (R3-20):** R3.6 đã có suspend/resume contract cho KO xảy ra trên Pokémon vừa `switchIn` giữa lượt. Engine serialize phần queue chưa chạy, RNG/tie state và execution history vào battle snapshot, mở `REPLACE` mà không tăng turn, rồi `ENTRY → RESOLVE` tiếp tục dynamic ordering trên state mới. KO do move thông thường không dùng nhánh này. Schema-3 server tự resume sau `battleV3.replacements`; full suite 312/312 pass. Đây là dependency đã đóng để batch kế tiếp mở Stealth Rock/Spikes thay vì tiếp tục block hazard vì lifecycle.

**Tiến độ hazard (R3-21 / Beta 3-04):** Stealth Rock và Spikes đã promote trong Beta Slice v6 bằng shared side-condition/entry-effects path. Stealth Rock có một layer và gây `floor(maxHP × Rock effectiveness / 8)`; Spikes có tối đa ba layer, chỉ tác động grounded target với `1/8`, `1/6`, `1/4` max HP. Hazard activation giữ thứ tự tạo condition như pinned Showdown `effectOrder`. Manual switch, pivot, forced switch và replacement đều đi qua cùng entry resolver; hazard KO giữa lượt dùng R3-20 suspend → replacement → deterministic resume, kể cả replacement mới lại bị hazard KO. Active base catalog = 12 Pokémon / 38 move / 6 Ability / 15 item; Mega extension runtime = 38 move / 7 Ability / 16 item; coverage = **120/862** mỗi format = 98 move / 7 Ability / 15 item; R7 FX = **38/38**. Heavy-Duty Boots, Magic Guard, Rapid Spin/Defog/Court Change, Toxic Spikes/Sticky Web và grounding overrides chưa review vẫn fail-closed.

**Tiến độ Toxic Spikes (R3-23 / Beta 3-06):** Toxic Spikes đã promote cho Beedrill trong Beta Slice v8. Side condition stack tối đa hai layer; grounded entrant nhận poison ở layer 1 hoặc bad poison ở layer 2 qua shared major-status contract, nên Steel/existing status/Misty Terrain cùng dùng block reason hiện có. Grounded Poison-type hấp thụ và xóa toàn bộ hazard; Flying/airborne bỏ qua. Stable hazard creation order tiếp tục áp dụng trong replacement chain; Rapid Spin/Defog cleanup mở rộng theo order `Spikes → Toxic Spikes → Stealth Rock`. Active base catalog = 12 Pokémon / 41 move / 6 Ability / 15 item; Mega runtime = 41 move / 7 Ability / 16 item; coverage = **123/862** mỗi format = 101 move / 7 Ability / 15 item; R7 FX = **41/41**. Heavy-Duty Boots, Magic Guard relation, Sticky Web/Court Change và grounding override chưa review vẫn fail-closed. Do beta roster không có relation cho Sticky Web/Court Change và candidate không có Heavy-Duty Boots, hazard family tạm dừng; batch kế tiếp quay lại room/field family, ưu tiên relation thật như Primarina → Wonder Room sau source audit.


**Tiến độ Room family (R3-24 / Beta 3-07):** Shared Room core đã hoàn tất cho Trick Room, Wonder Room và Magic Room. Cả ba dùng `field.rooms`, duration 5 turn, coexist độc lập và same-Room recast tắt condition thay vì refresh. Trick Room manifest priority `-7` và turn engine re-read active Room trước mỗi dynamic rank nên Speed order của waiting actions đổi ngay mà không reroll tie state. Wonder Room đổi Defense/Sp. Def base stat trước khi áp stage của stat được request. Magic Room suppress held-item passive effects hiện có (damage items, Light Clay, Heat/Damp Rock, Terrain Extender) nhưng giữ Ability passive và không tự suy diễn suppression cho Mega evolution. Primarina → Wonder Room là relation thật nên Beta Slice v9 promote đúng một move Room; Trick/Magic Room mechanics-supported nhưng không active content. Active base catalog = 12 Pokémon / 42 move / 6 Ability / 15 item; Mega runtime = 42 move / 7 Ability / 16 item; coverage = **126/862** mỗi format = 104 move / 7 Ability / 15 item; R7 FX = **42/42**. Full suite **343/343** pass. Ticket kế tiếp: delayed-effect scheduler foundation, ưu tiên Blastoise → Yawn relation thật; Perish Song/two-turn/recharge families vẫn fail-closed cho tới batch riêng.

**Tiến độ delayed-effect family (R3-25 / Beta 3-08):** Shared scheduler đã hoàn tất cho Yawn và Perish Song. Yawn lưu 2-step delayed volatile, block tại cast theo Protect/status/Electric Terrain và re-check shared sleep legality khi resolve; Misty Terrain vì vậy có thể chặn Sleep ở resolution. Perish Song gắn count 4 lên mọi active chưa có counter, decrement cuối mỗi turn kể cả turn sử dụng và faint trực tiếp ở 0; switch xóa state, recast không reset. Scheduler chạy sau residual HP groups nhưng trước ordinary expiry, dùng authoritative RNG và stable actor order. Beta Slice v10 promote Blastoise → Yawn + Primarina → Perish Song; active base catalog = 12 Pokémon / 44 move / 6 Ability / 15 item; Mega runtime = 44 move / 7 Ability / 16 item; coverage = **128/862** mỗi format = 106 move / 7 Ability / 15 item; R7 FX = **44/44**; full suite **355/355** pass. Ticket kế tiếp: two-turn/recharge family foundation; Future Sight-style attacks và transfer/immunity edge cases vẫn fail-closed.


**Tiến độ charge/recharge family (R3-26 / Beta 3-09):** Shared commitment core đã hoàn tất cho prepared two-turn attacks và mandatory recharge. Solar Beam/Solar Blade tiêu PP ở preparation, khóa move + target slot, release không tiêu PP lần hai, Sun bỏ charge và Rain giảm released power 1/2; interruption trước release clear commitment. Hydro Cannon/Frenzy Plant/Blast Burn/Hyper Beam/Giga Impact chỉ gắn must-recharge sau hit có actual damage; miss/protection/immunity không tạo recharge. Turn engine/schema-3/UI đều coi recharge là forced next action nhưng vẫn giữ action ordering Double và không cho Mega/switch/pivot chen vào commitment. Beta Slice v11 active = 12 Pokémon / 51 move / 6 Ability / 15 item; Mega runtime = 51 move / 7 Ability / 16 item; coverage = **135/862** mỗi format = 113 move / 7 Ability / 15 item; R7 FX = **51/51**; full suite **365/365** pass. Ticket kế tiếp: semi-invulnerable family Dig/Fly/Dive/Phantom Force với hit-through exceptions và untargetable lifecycle; Future Sight-style attacks vẫn fail-closed.


**Tiến độ semi-invulnerable family (R3-27 / Beta 3-10):** Shared commitment core giờ lưu mode `underground/underwater/airborne/vanished` trên prepared action, khóa move + target slot và chỉ tiêu PP ở preparation. Shared accuracy gate loại ordinary attacks trước Protect/accuracy RNG nếu target đang semi-invulnerable; resolver exception cho Dig (Earthquake/Magnitude 2×), Dive (Surf/Whirlpool 2×), Fly (reviewed hit-through list, Gust/Twister 2×, Smack Down interruption) và Phantom Force (vanish + Protect break on release). Schema-3 Single/Double auto-lock release, Battle Log/FX biểu diễn prepare/miss/interruption. Beta Slice v12 active = 12 Pokémon / 55 move / 6 Ability / 15 item; Mega runtime = 55 move / 7 Ability / 16 item; coverage = **139/862** mỗi format = 117 move / 7 Ability / 15 item; R7 FX = **55/55**; full suite **375/375** pass. Ticket kế tiếp chuyển sang **R3.8 Ability hooks**, ưu tiên relation thật và giữ các hook chưa review fail-closed.


**Tiến độ hazard cleanup (R3-22 / Beta 3-05):** Rapid Spin và Defog đã promote trong Beta Slice v7 bằng handler cleanup dùng chung. Rapid Spin chỉ cleanup sau damaging hit hợp lệ, xóa Leech Seed + Stealth Rock/Spikes phía user rồi +1 Speed; Protect/immunity/zero-damage không cho cleanup hoặc boost miễn phí. Defog hạ Evasion mục tiêu, xóa Reflect/Light Screen phía mục tiêu, xóa Stealth Rock/Spikes ở cả hai phía và clear Terrain nhưng không xóa Tailwind. Cleanup phát event authoritative để replay/UI derive state và chỉ nhận mode đã khai báo. Active base catalog = 12 Pokémon / 40 move / 6 Ability / 15 item; Mega runtime = 40 move / 7 Ability / 16 item; coverage = **122/862** mỗi format = 100 move / 7 Ability / 15 item; R7 FX = **40/40**. Heavy-Duty Boots/Magic Guard chưa có beta relation/candidate phù hợp; Toxic Spikes có relation với Beedrill và là hazard vertical slice kế tiếp sau khi poison-entry/absorption/grounding contract được khóa; Sticky Web/Court Change và các condition removal khác tiếp tục fail-closed.

### R3.8 Ability hooks

- Nhóm hook: pre-battle, on-entry, target/redirection, stat/damage modifier, immunity, after-hit, on-faint, end-turn, on-switch.
- Sau đó mới làm suppression, copy, swap/replace và ability-changing effects.
- Resolve đồng thời theo explicit priority/order; không dựa vào object insertion order.

**Tiến độ Ability Hooks Wave 1 (R3-28 / Beta 3-11):** Shared hook layer giờ có phase rõ cho move transform, target immunity, base-power/stat/final-damage modifier, weather/status và end-turn. Chín relation M-A thật đã promote: Solar Power, Leaf Guard, Flash Fire, Sniper, Technician, Iron Fist, Bulletproof, Long Reach và Liquid Voice. Manifest move tags `sound/punch/bullet` được validate và Hyper Voice được promote để Liquid Voice có damaging interaction active. Beta Slice v13 active = 12 Pokémon / 56 move / 15 Ability / 15 item; Mega runtime = 56 move / 16 Ability / 16 item; coverage = **149/862** mỗi format = 118 move / 16 Ability / 15 item; R7 FX = **56/56**; full suite **386/386** pass. Wave 2 ưu tiên secondary-effect framework + Sheer Force. Light Metal vẫn content/mechanics-blocked cho tới khi snapshot có canonical weight data; suppression/copy/swap/replace chưa được suy diễn.

**Tiến độ Ability Hooks Wave 2 (R3-29 / Beta 3-12):** Shared secondary-effect framework chạy sau successful damage và chỉ trên target thực sự nhận damage; miss/Protect/immunity/KO không tiêu secondary RNG. Mỗi effect/target có roll độc lập, hỗ trợ major status, volatile và stat-stage delta; spread `allAdjacent` cũng đi qua shared 0.75× damage path. Sheer Force dùng Ability hook `secondary-effect-power-boost`: move có secondary được tăng base power theo 5325/4096 và triệt toàn bộ secondary trước khi RNG secondary được tiêu. Beta Slice v14 promote Feraligatr → Sheer Force cùng 9 move relation thật (`Waterfall`, `Crunch`, `Liquidation`, `Ice Punch`, `Body Slam`, `Rock Slide`, `Water Pulse`, `Ice Fang`, `Bulldoze`) để khóa status/flinch/stat-drop/multi-secondary/spread/100% cases. Active base = 12 Pokémon / 65 move / 16 Ability / 15 item; Mega runtime = 65 move / 17 Ability / 16 item; coverage = **159/862** mỗi format = 127 move / 17 Ability / 15 item; R7 FX = **65/65**; full suite **395/395** pass. `Light Metal` vẫn fail-closed vì snapshot chưa có canonical species weight; Ability suppression/copy/swap/replace chưa có evidence đủ để promote. Ticket kế tiếp chuyển sang **R3.9 Item Hooks Wave 1**, ưu tiên state/event contract cho recovery/consumable/survival item trước khi bật item mới.

**Tiến độ Weather foundation + Ability Hooks Wave 3 (R3-37 → R3-38):** Snow/Sandstorm đã mở trên weather engine dùng chung cùng Icy Rock/Smooth Rock và sáu weather Ability; active Beta v22 = 12 Pokémon / 67 move / 16 Ability / 82 item, R7 FX = 67/67. Sau đó Ability Wave 3 mở thêm 26 Ability candidate bằng declarative stat/damage/accuracy/status/crit/STAB/recoil contracts mà không bump catalog giả: Compound Eyes, Huge/Pure Power, Fur Coat, Strong Jaw/Sharpness/Tough Claws/Mega Launcher/Reckless, Super Luck/Shell Armor, Insomnia/Vital Spirit/Limber/Immunity/Magma Armor, Adaptability/Soundproof/Rock Head, Marvel Scale/Multiscale/Solid Rock/Purifying Salt/Hustle/No Guard/Guts. Coverage sau Wave 5 = **285/862** mỗi format = 129 move / 74 Ability / 82 item. Wave 4 bổ sung 13 Ability stat-drop/ally/Speed/multihit/end-turn; Wave 5 bổ sung 12 Ability switch-out/on-entry/deterministic status-cure (`Natural Cure`, `Regenerator`, `Shed Skin`, bốn weather setter, `Intimidate`, `Supersweet Syrup`, `Screen Cleaner`, `Curious Medicine`, `Hospitality`) trên shared lifecycle. `Battle Armor` fixture-only entry vẫn bị loại khỏi manifest vì không tồn tại trong candidate. Tiếp theo ưu tiên passive damage/immunity và các family không cần approximation; suppression/copy/swap/replace, trapping/Bound và Light Metal vẫn giữ fail-closed khi foundation/source chưa đủ.

**Tiến độ Ability Hooks Wave 4 (R3-39):** Thêm 13 Ability candidate bằng shared stat-drop/Speed/ally/secondary/multihit/end-turn contracts: Clear Body, White Smoke, Hyper Cutter, Big Pecks, Quick Feet, Surge Surfer, Plus, Minus, Telepathy, Friend Guard, Shield Dust, Skill Link, Hydration. Server turn queue và variable-power formulas giờ dùng chung effective-Speed pipeline; Shield Dust chặn cả move secondary và King's Rock-added flinch trước RNG; Friend Guard/Telepathy/Plus/Minus có Double-local semantics và không leak sang self/foe. Active Beta vẫn v22; coverage tăng thật **260 → 273/862** = 129 move / 62 Ability / 82 item. Tiếp theo ưu tiên switch-out/on-entry Ability foundations; không bump catalog nếu chỉ mở global reviewed coverage.

**Tiến độ Ability Hooks Wave 5–6 (R3-40 → R3-41):** Wave 5 mở 12 Ability switch-out/on-entry/end-turn (`Natural Cure`, `Regenerator`, `Shed Skin`, bốn weather setter, `Intimidate`, `Supersweet Syrup`, `Screen Cleaner`, `Curious Medicine`, `Hospitality`) trên lifecycle dùng chung, đưa coverage 273 → 285/862. Wave 6 mở thêm 14 Ability bằng hai generic contracts mới và các passive handler có sẵn: Heatproof/Thick Fat, Keen Eye/Illuminate, Water Absorb/Volt Absorb/Earth Eater, Motor Drive/Sap Sipper, Rough Skin/Flame Body/Static/Poison Point/Gooey. Type-immunity response block trước accuracy/damage và heal/stat-up theo manifest; contact response chỉ chạy sau actual contact damage, dùng seeded RNG cho 30% status và tái dùng major-status/stat-drop/White Herb rules. Active Beta vẫn v22; coverage tăng thật **285 → 299/862** = 129 move / 88 Ability / 82 item. Tiếp theo ưu tiên damaged-response/on-faint/turn-order family; suppression/copy/swap/replace và trapping vẫn fail-closed cho tới khi có foundation đúng.


**Tiến độ Ability Hooks Wave 7 (R3-42):** Thêm 11 Ability candidate bằng shared damaged-response/on-KO/end-turn/survival contracts: Anger Point, Berserk, Justified, Moxie, Sand Spit, Speed Boost, Stamina, Sturdy, Toxic Debris, Water Bubble và Weak Armor. Damage-response dùng actual damage + critical/type/category/HP-crossing evidence, compose shared weather/hazard/stage/White Herb paths; Sturdy resolve trước Focus Sash; Speed Boost persist entry turn; fixed-damage giờ cũng chạy Ability survival/contact response thay vì bypass. Active Beta giữ v22; coverage tăng thật **299 → 310/862** = 129 move / 99 Ability / 82 item; full suite **550/550** pass. Tiếp theo tiếp tục các family có semantics đủ rõ; suppression/copy/swap/replace, mid-turn replacement-choice và trapping vẫn fail-closed cho tới khi foundation đúng.

**Tiến độ Ability Hooks Wave 8 (R3-43):** Thêm 8 Ability candidate bằng shared stat/status response contracts: Competitive, Defiant, Inner Focus, Own Tempo, Merciless, Poison Heal, Synchronize và Steadfast. Opponent stat-drop response chạy trên primary/secondary/contact/protection/entry paths; scoped source-Ability immunity giữ Inner Focus/Own Tempo chỉ miễn Intimidate; volatile immunity chặn flinch/confusion kể cả King's Rock; Merciless ép critical trên poisoned target nhưng tôn trọng critical immunity; Poison Heal thay poison residual bằng heal mà không tăng toxic counter; Synchronize reflect qua major-status engine với recursion guard; Steadfast chỉ boost khi flinch thật sự ngăn action. Active Beta giữ v22; coverage tăng thật **310 → 318/862** = 129 move / 107 Ability / 82 item; full suite **559/559** pass.

**Tiến độ Ability Hooks Wave 9 (R3-44):** Thêm 7 Ability candidate bằng shared side-aura và conditional modifier contracts: Armor Tail, Queenly Majesty, Sweet Veil, Corrosion, Tangled Feet, Dry Skin và Flower Veil. Priority-immunity aura chặn positive-priority move từ đối thủ nhắm holder/ally trước accuracy; ally status/stat immunity có type/source scoping để Sweet Veil/Flower Veil không cần Ability-ID branch; Corrosion chỉ bypass Poison/Steel type immunity cho poison statuses; Tangled Feet áp incoming accuracy ×0.5 khi confused; Dry Skin compose Water absorb-heal, Fire damage ×1.25, Rain heal và Sun residual trên shared handlers. Active Beta giữ v22; machine-readable coverage tăng thật **318 → 325/862** = 129 move / 114 Ability / 82 item; full suite **567/567** pass.


### R3.9 Item hooks

- Nhóm passive modifier, consumable berry, survival, choice/lock, recovery, status cure và Mega Stone.
- Tách `availableInChampions`, `legalByRegulation`, `implemented`, `enabledForBattle`.
- Consume/loss/swap phải có owner, reveal policy, idempotent event và restart/replay tests.

**Tiến độ Item Hooks Wave 1 (R3-30 / Beta 3-13):** Shared held-item state giờ lưu owner item, consumed/revealed state, activation count và idempotent activation receipt. `Leftovers` dùng end-turn recovery 1/16 max HP. `Sitrus Berry` dùng shared HP-threshold update ở <= 1/2 HP, hồi 1/4 rồi consume; threshold hiện được kiểm sau direct/fixed move damage, entry hazard, recoil, confusion self-hit, protection retaliation, Leech Seed và giữa các supported end-turn residual groups. `Focus Sash` chỉ cứu full-HP holder khỏi lethal move damage — gồm normal và fixed-damage move — giữ 1 HP rồi consume; non-move damage không kích Sash. Magic Room suppress các item hook này mà không consume/reveal; các passive item cũ cũng dùng shared active-owner check. Public opponent/AI view chỉ nhận item identity sau authoritative reveal; JSON restart giữ consumed/receipt để không tái kích hoạt. Battle snapshot cũ chưa có `itemState` được infer owner từ immutable build/passive snapshot để giữ compatibility. Active base = 12 Pokémon / 65 move / 16 Ability / 18 item; Mega runtime = 65 move / 17 Ability / 19 item; coverage = **162/862** mỗi format = 127 move / 17 Ability / 18 item; R7 FX = **65/65**; full suite **415/415** pass. Wave 2 ưu tiên status-cure consumable family; Choice lock, Life Orb/Rocky Helmet, item loss/swap/steal và Heavy-Duty Boots vẫn fail-closed.

**Tiến độ Item Hooks Wave 2 (R3-31 / Beta 3-14):** Shared item contract thêm hook `afterStatus` và promote `Lum Berry`, `Cheri Berry`, `Chesto Berry`, `Pecha Berry`, `Rawst Berry`, `Aspear Berry`, `Persim Berry`. Resolver đọc authoritative held-item owner/state rồi chỉ consume khi major status/confusion khớp; Pecha chữa poison + bad poison, Persim chỉ confusion, còn Lum có thể chữa major status + confusion trong một activation receipt. Status application từ direct move, secondary, Yawn/Toxic Spikes đều tái dùng cùng resolver. Magic Room suppress berry mà không reveal/consume; natural expiry hoặc same-Room recast-off chạy cure ngay trước action gate tiếp theo. Runtime Single/Double, restart receipt và public reveal semantics đều dùng state/event contract của Wave 1. Active base = 12 Pokémon / 65 move / 16 Ability / 25 item; Mega runtime = 65 move / 17 Ability / 26 item; coverage = **169/862** mỗi format = 127 move / 17 Ability / 25 item; R7 FX = **65/65**; full suite **424/424** pass. Wave 3 ưu tiên post-damage owner/source family (`Life Orb`, `Rocky Helmet`, `Shell Bell`) vì cả ba đã có Champions candidate; Choice lock tách riêng vì cần command legality + switch-reset contract. Item loss/swap/steal, Heavy-Duty Boots và Light Metal vẫn fail-closed.

**Tiến độ Item Hooks Wave 3 (R3-32 / Beta 3-15):** Shared post-damage pipeline promote `Life Orb`, `Rocky Helmet`, `Shell Bell` từ candidate thật. Life Orb dùng generic all-damaging modifier 5324/4096 rồi recoil 1/10 max HP ở after-move phase; Sheer Force giữ damage boost nhưng suppress recoil và force-switch move cũng bỏ qua AfterMoveSecondarySelf-style hook. Rocky Helmet gây 1/6 max HP attacker cho mỗi damaging contact hit, vẫn kích nếu holder faint từ hit đó, dùng contact state sau Long Reach và cũng chạy cho fixed-damage contact move. Shell Bell hồi 1/8 aggregate actual move damage một lần sau move. Shared generic after-move item resolver chạy order 145, trước pivot/forced switch order 150; Magic Room và authoritative reveal/activation state tiếp tục được tái dùng. Active base = 12 Pokémon / 65 move / 16 Ability / 28 item; Mega runtime = 65 move / 17 Ability / 29 item; coverage = **172/862** mỗi format = 127 move / 17 Ability / 28 item; R7 FX = **65/65**; full suite tích hợp **438/438** pass. Wave 4 ưu tiên `Choice Scarf` + choice-lock command legality/switch-reset vì snapshot beta2 chỉ có Choice Scarf trong Choice family; White Herb là ticket consumable stat-reset riêng. Item loss/swap/steal, Heavy-Duty Boots và Light Metal vẫn fail-closed.

**Tiến độ Item Hooks Wave 4 (R3-33 / Beta 3-16):** `Choice Scarf` được promote từ candidate thật bằng generic `item-speed-boost` và `item-choice-lock`. Dynamic effective Speed áp dụng 1.5× theo floor; command validator chỉ cho move đã lock nhưng vẫn cho switch. Lock được tạo sau before-action gate, serialize cùng volatile state qua restart/replay và được shared switch lifecycle xóa cho mọi nguồn switch. Magic Room suppress cả Speed modifier lẫn command restriction mà không xóa lock đã có; move dùng khi item đang bị suppress không tạo lock mới. UI disable move không hợp lệ và fallback sang switch nếu locked move hết PP; AI dùng cùng validator nhưng preview pivot bằng reserve hợp lệ để không làm đổi behavior cũ. Active base = 12 Pokémon / 65 move / 16 Ability / 29 item; Mega runtime = 65 move / 17 Ability / 30 item; coverage = **173/862** mỗi format = 127 move / 17 Ability / 29 item; R7 FX = **65/65**; full suite **446/446** pass. Wave 5 ưu tiên `White Herb`; Choice Band/Choice Specs chưa có trong beta2 candidate, item loss/swap/steal và Heavy-Duty Boots vẫn fail-closed, còn Light Metal chờ canonical weight data.

**Tiến độ Item Hooks Wave 5 (R3-34 / Beta 3-17):** `White Herb` được promote từ candidate thật bằng generic `item-negative-stage-reset`. Shared resolver chạy sau primary stat changes, damaging secondary stat drops và supported King's Shield retaliation; khi có ít nhất một stage âm, item reveal/activate/consume đúng một lần rồi đưa toàn bộ stage âm về 0, giữ stage không âm nguyên vẹn. Magic Room suppress activation mà không xóa stage âm hoặc reveal item; recast-off/natural expiry giải phóng resolver, còn JSON restart giữ state và before-action update xử lý state hợp lệ chưa resolve. Active base = 12 Pokémon / 65 move / 16 Ability / 30 item; Mega runtime = 65 move / 17 Ability / 31 item; coverage = **174/862** mỗi format = 127 move / 17 Ability / 30 item; R7 FX = **65/65**; full suite **453/453** pass. Wave 6 ưu tiên 17 resistance berries có candidate rõ ràng; item loss/swap/steal và Heavy-Duty Boots vẫn fail-closed, còn Light Metal chờ canonical weight data.

**Tiến độ Item Hooks Wave 6 mega-batch (R3-35 / Beta 3-18):** 33 reviewed item được promote trong một shared-mechanics batch: 17 typed super-effective resistance berries + Chilan Berry, chín 20% type boosters, Expert Belt, Wide Lens, Oran Berry, Bright Powder, Scope Lens và Focus Band. `item-resist-hit` consume/reveal authoritative trên first qualifying direct-damage hit, hỗ trợ multi-hit, Magic Room và restart/replay idempotency; Chilan bỏ yêu cầu super-effective riêng cho Normal. Generic held-damage modifier mở thêm super-effective selector cho Expert Belt; Wide Lens thêm passive 1.1× effective-accuracy modifier sau stages; Oran mở fixed-amount branch trên threshold-heal resolver mà không đổi Sitrus fraction contract. Bright Powder compose incoming 0.9× accuracy modifier với Wide Lens; Scope Lens mở generic +1 critical-ratio stage; Focus Band mở seeded 10% non-consumable survival branch dùng được cả direct/fixed move damage. Active base = 12 Pokémon / 65 move / 16 Ability / 63 item; Mega runtime = 65 move / 17 Ability / 64 item; coverage = **207/862** mỗi format = 127 move / 17 Ability / 63 item; R7 FX = **65/65**; full suite **475/475** pass. Các item cần grounding, forced switch, PP restoration, species-gated crit interactions, move-level spread receipts, item transfer/loss/steal hoặc trapping vẫn fail-closed; Light Metal tiếp tục chờ canonical species weight data.

**Tiến độ Item Lifecycle Wave 7 mega-patch (R3-36 / Beta 3-19):** 17 reviewed item đang fail-closed thật được promote trên các shared contract thay vì move/item-ID branches: Air Balloon/Big Root, bốn Terrain Seeds, Iron Ball, Leppa Berry, Normal Gem, Red Card, Zoom Lens, King’s Rock, Metronome, Light Ball, Leek, Mental Herb và Quick Claw. Airborne/grounding giờ được dùng chung bởi Ground effectiveness và entry hazards; PP restore/terrain seed/volatile cure đều giữ authoritative consume/reveal/Magic Room/restart semantics. Red Card tái dùng seeded forced-switch path và skip native phazing/no-reserve. Normal Gem được prepare sau hit qualification nhưng trước damage; Metronome lưu switch-cleared consecutive chain; Light Ball/Leek dùng species-gated passive hooks; King’s Rock chỉ thêm flinch cho damaging move không có natural flinch và tôn trọng Sheer Force suppression. Quick Claw mở generic deterministic turn-order preparation: internal order boost chỉ thắng Speed/Trick Room trong cùng priority bracket, input không thể spoof và higher-priority move vẫn thắng. Active base = 12 Pokémon / 65 move / 16 Ability / 80 item; Mega runtime = 65 move / 17 Ability / 81 item; coverage = **224/862** mỗi format = 127 move / 17 Ability / 80 item; R7 FX = **65/65**; full suite **496/496** pass. Eject Button chờ mid-turn replacement-choice lifecycle; Binding Band/Shed Shell chờ trapping/Bound; Icy Rock/Smooth Rock đã được mở ở weather foundation R3-37; Light Metal chờ canonical weight data.

**Tiến độ beta trước Wave 1:** `held-damage-boost` đã mở bốn item tăng hệ 1.2× và Muscle Band/Wise Glasses tăng category 1.1×. Item Clause được kiểm ở beta gate.

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

**Tiến độ R6-01 → R3-85 Mega-first Wave 8:** Mega Venusaur là vertical slice đầu tiên; `mega-beta-v2` mở rộng cùng contract sang Mega Blastoise, Mega Beedrill, Mega Charizard X/Y, Mega Chesnaught và Mega Scizor; `mega-beta-v3` thêm Mega Feraligatr/Meganium; các wave sau mở dần roster theo vertical-complete gate. Server validate command ở submit/resolve, khóa một Mega mỗi side, transform trước move, giữ HP damage/PP/status/stages/volatiles, compile lại Ability/form stats/type/height/weight và dùng Speed form mới cho queue còn lại. R3-81 bổ sung contract content-complete: full legal learnset/Ability phải nằm trong active catalog trước khi Mega relation được phép tồn tại. R3-82–84 nâng foundation lên 87 battle forms và 42 relations. R3-85 mở `mega-beta-v8` + Beta v29 với 18 base species mới và 22 relations: Aggron/Chimecho/Crabominable/Drampa/Emboar/Excadrill/Floette/Gengar/Glimmora/Golurk/Greninja/Kangaskhan/Meowstic/Pinsir/Raichu/Scovillain/Skarmory/Victreebel, hai nhánh Raichu X/Y và alternate Absol/Garchomp/Lucario Z. Foundation đạt 127 battle forms; Meowstic relation có male-only gate; generic runtime hỗ trợ Fairy Aura, Piercing Drill/Unseen Fist, Parental Bond, Shadow Tag, Electric Surge, Spicy Spray, Innards Out và Aura Guard. Alternate/classic forms luôn là relation riêng; physical data không được inherit khi chưa xác minh.

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
5. Beta v35 giữ promoted player catalog **213 Pokémon/490 move/180 ordinary Ability/82 item**; **213/213 canonical non-Mega entries** đã full legal learnset/Ability trong Training/build legality, trong đó toàn bộ 58 M-A Mega base species (59 Mega forms) vẫn complete. R3-73/74 đóng move review và gender/weight/Fling foundation; R3-75 đạt **180/180 Ability executable** và review đủ 81 Mega Stone; R3-76/77 đóng state-transfer + called-move runtime; R3-78–85 chuyển sang Mega-first vertical expansion; R3-86–90 tiếp tục non-Mega M-A vertical expansion; R3-90 khóa denominator M-A 272 + legality của 59 Mega M-A; R3-91 khóa exact canonical selector IDs và hoàn tất 272/272 battle-content entries. Global matrix sau R3-90 vẫn **862/862 reviewed**, **836/862 runtime-supported** mỗi format = 507 move/180 Ability/149 item. 9 move và 17 Mega Stone còn blocked đều có explicit reason; 17 Stone được defer cho relation/form snapshot phù hợp thay vì ép vào M-A chỉ để làm đẹp coverage.

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
