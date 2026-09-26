# Pokémon Vanguard — Nhật ký triển khai

Roadmap hiện hành: `docs/pokemon-vanguard-roadmap.md`. `ROADMAP.md` chỉ còn là lịch sử của hướng Aether cũ.

## Trạng thái hiện tại — rebaseline 12/09/2026

| Chặng | Trạng thái | Kết quả hiện có | Việc còn lại để qua gate |
| --- | --- | --- | --- |
| R0 Rebaseline | DONE | Khóa tên Pokémon Vanguard, local-first, English UI, không rarity, M-A trước, Single/Double, 66/32 Stat Points và schema snapshot | Không |
| R1 M-A Data | BETA SLICE REVIEWED / FULL REVIEW PENDING | Candidate `pv-ma-2026-09-11`: 213 species/forms, 516 move, 180 Ability, 166 item; scoped review đã khóa hash và relation cho beta v1 | Review phần còn lại theo từng content batch; không coi scoped approval là approval toàn candidate |
| R2 Battle Rules | DONE AS SHADOW CONTRACT | 18 hệ, đơn/song hệ, level-50 stats, damage core, target Single/Double, switch → Mega → move, dynamic speed, faint/replacement/end-turn và deterministic replay | Chưa nối vào runtime schema 2; R3 cung cấp mechanic handlers, R4 mới chuyển runtime |
| R3 Mechanics Coverage | IN PROGRESS / GLOBAL REVIEW COMPLETE | Candidate hiện **862/862 reviewed** ở cả hai format; executable runtime = **507/516 move, 180/180 Ability, 149/166 item**; active Beta v35 có 213 Pokémon/490 move/180 ordinary Ability/82 item; **213/213 canonical non-Mega M-A entries content-complete**; M-A Mega scope khóa ở 59/59 forms trên 58 base species, còn mega-beta-v8 giữ thêm 5 implementation M-B/M-C ngoài M-A | M-A battle-content đã đóng 272/272; tiếp tục giữ 9 move legacy/unavailable fail-closed có chủ đích và 17 Mega Stone ngoài phần đã implement defer theo regulation phù hợp |
| R4 Training/Team UI | BETA GATE PASSED | Catalog, migration/save, Home/Archive/Training/Team/Recruitment status/Guide và Preview/AI/Battle schema 3 đã chạy end-to-end | Mở rộng Inspector theo beta feedback |
| R5 Roster Ranch | BETA 2 GATE PASSED | 10 offer deterministic, 22 giờ, Trial 7 ngày, permanent coin/ticket, expiry/receipt/restart và catalog rebase đã nối schema 3 | Mở rộng banner/coupon sau khi có source evidence mới |
| R6 Mega Evolution | BETA SLICE PASSED / MEGA-FIRST EXPANSION | 64 Mega implementations tồn tại globally; Regulation M-A runtime expose đúng 59 legal forms/relations trên 58 base species, 5 implementation còn lại được giữ cho M-B/M-C; explicit type/stat/Ability/height/weight, one-per-side, gender-gated relation, dynamic Speed, persistence/replay và custom on-transform Ability lifecycle đã nối schema 3 | Tiếp tục promote 17 relation còn lại theo đúng regulation/snapshot; unique Mega art vẫn là presentation follow-up |
| R7 Sprite/Move FX | CORE GATE PASSED | 490/490 active move có profile/fallback, slot anchors Single/Double, per-target spread/secondary outcome, weather/terrain/side-condition/hazard/room/delayed/commitment/semi-invulnerable presentation và playback 1×/2×/Skip | Chạy visual matrix rộng hơn trên mobile; thêm override khi content batch mới được promote |
| M6 PvP | BLOCKED BY R4–R7 | Server-authoritative room flow cũ là nền tham khảo | Version negotiation, hidden information, reconnect, clocks và replay trên schema 3 |
| M7 Ranked | BLOCKED BY M6 | Chưa triển khai | Identity, queue, season/rating, anti-duplicate settlement, audit và vận hành |

Baseline R3 hiện tại: candidate M-A validate thành công và replay/battle invariants vẫn deterministic. Coverage schema từ R3-75 tách **reviewed** khỏi **runtime-supported**. Sau R3-91: **862/862 reviewed**, **836/862 executable** cho từng format. Breakdown executable = **507/516 move**, **180/180 Ability**, **149/166 item**. 26 entry còn lại đều có explicit fail-closed reason: 9 move unavailable/legacy theo ruleset Champions hiện tại (gồm `tera-blast` khi Terastallization chưa có runtime) và 17 Mega Stone chưa có promoted form/relation; không còn `missing-manifest`.

## R3-73 / R3-74 — Move review closure + Foundation Data

- **R3-73 recovery / Wave 50:** khóa explicit fail-closed manifests cho Tera Blast, Simple Beam, Baton Pass, Copycat, Curse, Instruct, Parting Shot và Sleep Talk. Các move này được review có chủ đích nhưng chưa giả lập semantics động chưa có foundation; runtime từ chối deterministic trước khi tốn PP hoặc thay đổi battle state.
- **R3-74 Foundation / Wave 51:** thêm `battle-foundation-v1.json` cho 13 battle forms và 166/166 candidate items. Runtime hydrate `weightKg`/gender foundation vào catalog, battle unit nhận deterministic gender, Mega Venusaur cập nhật trọng lượng 155.5 kg, và Autotomize giảm effective weight 100 kg/lần với floor 0.1 kg.
- **Weight moves:** Low Kick/Grass Knot dùng tier 20/40/60/80/100/120 theo target weight; Heavy Slam/Heat Crash dùng ratio user/target 40/60/80/100/120. Shared `variableMovePower` đọc effective weight nên Autotomize tác động trực tiếp.
- **Attract:** Infatuation yêu cầu opposite binary gender, chặn hành động 50% bằng seeded RNG, kết thúc khi source rời sân, bị Oblivious chặn và Mental Herb cure ngay sau apply.
- **Fling:** 166 item có machine-readable fling metadata; Mega Stone fail-closed, item hợp lệ bị consume trước Protect/accuracy resolution, Berry kích hoạt trên target, và special effects của King's Rock / Light Ball / Mental Herb / Poison Barb / White Herb được xử lý trong shared lifecycle.
- **Gates:** `foundation:validate` nằm trong `npm run check`; mechanics coverage đạt **776/862 Single + 776/862 Double**, trong đó move đạt **516/516**. Full regression sau thay đổi đạt **918/918**.


## R3-75 — Ability closure + global review closure + Eject Button lifecycle

- **Ability Hooks Wave 18:** promote bốn Ability cuối `Cute Charm`, `Rivalry`, `Heavy Metal`, `Light Metal`, đưa global Ability runtime lên **180/180 executable**. Rivalry dùng shared gender damage modifier; Heavy/Light Metal đi qua effective-weight pipeline sau Autotomize; Cute Charm tái dùng chung Infatuation primitive với Attract, gồm Oblivious/Mental Herb/source-switch lifecycle.
- **Shared contact hardening:** contact-response resolver không còn blanket-suppress mọi post-hit contact Ability khi move có opponent-Ability bypass flag; targeted regression khóa cả Cute Charm và các contact response cũ.
- **Mega Stone review:** 81/81 candidate Mega Stone có manifest. `Venusaurite` executable vì relation/form đã được promote; 80 stone còn lại được review nhưng explicit `fail-closed: mega-relation-not-promoted`, nên không thể vô tình compile thành battle passive.
- **Eject Button / Wave 10:** thêm `item-holder-switch` và live forced-replacement request. Item chỉ consume sau damaging hit khi có reserve hợp lệ, bị Magic Room suppress, không kích hoạt nếu holder faint/no reserve/native phazing; turn resolver suspend giữa lượt, replacement chạy switch-out mechanics, entry lifecycle rồi resume chính xác pending queue. Holder bị đổi ra không còn được thực hiện action đã queue; snapshot/AI/UI dùng authoritative `replacementSlots` cho cả live replacement.
- **Coverage semantics:** mọi manifest `unusable: true` hiện được gắn `reviewState: fail-closed`; report phân biệt `reviewed` với `runtime-supported`. Kết quả = **862/862 reviewed**, **766/862 executable** mỗi format = 500 move + 180 Ability + 86 item. 96 runtime-blocked đều là reviewed fail-closed có machine-readable reason.
- **Gates:** targeted lifecycle/switch regression **54/54** pass; `npm run check` pass; full regression **936/936** pass.

## R3-76 — State-transfer move runtime closure / Wave 52

- **Simple Beam:** promote thành executable với target `anyAdjacent`, transient runtime Ability profile `Simple` tách khỏi candidate catalog, stat-stage delta ×2 sau replacement, restore Ability gốc khi switch-out, và block đúng nhóm Ability immutable của Champions.
- **Baton Pass:** thêm shared state-transfer handler cho toàn bộ stat stages và whitelist Champions hiện có: confusion, Aqua Ring, Curse, Dragon Cheer, Focus Energy, Heal Block, Ingrain, Leech Seed, target-lock (Lock-On/Mind Reader), Magnet Rise, Perish Song, Substitute, Telekinesis và transient Ability suppression. Power Trick được tái áp dụng trên stats của Pokémon vào sân thay vì copy raw outgoing stats; generic trapping, infatuation, type/form/Ability replacement không được truyền.
- **Curse:** dynamic target contract đổi theo current type. Non-Ghost dùng shared stat-stage pipeline (+Atk/+Def/-Spe); Ghost dùng `anyAdjacent`, trả 1/2 max HP và gắn residual -1/4 max HP/end turn; Curse state tiếp tục tương thích Baton Pass.
- **Parting Shot:** promote stat-drop → pivot lifecycle, target `anyAdjacent`, bypass Substitute và sound tag; không switch nếu cả hai stat không đổi, nhưng giữ đúng Mirror Armor exception và Magic Bounce reflection ownership/replacement request.
- **Coverage:** **862/862 reviewed**, **770/862 executable** mỗi format = **504 move + 180 Ability + 86 item**. Còn 92 runtime-blocked: 8 legacy Champions-unusable move, 4 mechanically pending move (`tera-blast`, `copycat`, `instruct`, `sleep-talk`) và 80 Mega Stone chưa promote relation/form.
- **Gates:** Wave 52 targeted **12/12** pass; `npm run check` pass; full regression **948/948** pass.

## R3-77 — Called-move/replay runtime closure / Wave 53

- **Shared called-move executor:** thêm hai mode tách biệt theo lifecycle thật: `use` cho Copycat/Sleep Talk (không trừ PP move được gọi, không chạy lại generic before-action gate) và `run` cho Instruct (trừ PP của move được lặp lại và chạy action gate của chính target). Battle-level `lastMoveUsed` tách khỏi per-unit `lastMoveId`, nên Copycat đọc đúng move vừa thực thi mà Encore/Disable/Torment vẫn thấy move Pokémon đã chọn.
- **Copycat:** dùng move gần nhất toàn battle, blacklist explicit, chọn target hợp lệ bằng seeded RNG trong Double và không tốn PP của move copy. Move được copy trở thành battle-level last move nhưng user history vẫn là Copycat.
- **Instruct:** target `anyAdjacent`, bypass Substitute, dùng lại `lastMoveId` + target slot đã lưu của target, trừ PP thật và fail-closed cho zero PP, blacklist, two-turn/recharge family.
- **Sleep Talk:** `sleepUsable`, chỉ gọi move khi user còn asleep sau sleep gate, bỏ qua blacklist/two-turn family, có thể gọi move 0 PP và chỉ trừ PP của Sleep Talk.
- **Called pivot lifecycle:** U-turn/Volt Switch/Flip Turn/Parting Shot/Baton Pass/Shed Tail được gọi gián tiếp không tự chọn reserve. Runtime tạo forced-replacement request, suspend pending queue, để replacement command chọn Pokémon rồi resume. Baton Pass snapshot whitelist/Power Trick/Ability suppression và Shed Tail Substitute được mang qua replacement metadata rồi apply sau switch.
- **Tera Blast:** tiếp tục `reviewState: fail-closed` với reason `champions-terastallization-unavailable`; không dựng Tera state giả khi Terastallization chưa thuộc battle runtime Champions hiện tại.
- **Coverage:** **862/862 reviewed**, **773/862 executable** mỗi format = **507 move + 180 Ability + 86 item**. 89 runtime-blocked còn lại = 9 move unavailable/legacy + 80 Mega Stone chưa promote relation/form.
- **Gates:** Wave 53 targeted **14/14** pass; `npm run check` pass; full regression **962/962** pass.

## R3-78 — Active-roster Mega Wave 2 + Beta Slice v23 metadata refresh

- **Mega content wave:** promote thêm sáu relation/form đang gắn trực tiếp với roster beta hiện tại: Blastoise/Blastoisinite, Beedrill/Beedrillite, Charizard X/Charizardite X, Charizard Y/Charizardite Y, Chesnaught/Chesnaughtite và Scizor/Scizorite. Cùng Mega Venusaur, runtime extension hiện có **7 Mega form / 7 relation**.
- **Form foundation:** foundation tăng **13 → 19 battle forms** với weight/gender canonical cho sáu Mega mới. Mega catalog dùng upsert/dedupe cho Ability/item nên Ability đã có trong base slice như Bulletproof/Technician không bị nhân đôi khi extension được merge.
- **Mega Ability lifecycle:** transformed unit compile đúng Mega Launcher/Adaptability/Tough Claws/Drought/Bulletproof/Technician; Ability Start được resolve ngay trong Mega phase, vì vậy Mega Charizard Y khởi động Sun tức thời thay vì chờ lần switch-in giả. Single/Double đều dùng cùng path.
- **Beta Slice v23:** playable selection không đổi (**12 Pokémon / 67 move / 16 Ability / 82 item**), nhưng refresh mechanics metadata từ manifest đã review. Việc này đưa tag `pulse` hiện hành của Water Pulse vào active runtime, nên Mega Launcher boost thật qua generic tag contract thay vì special-case Blastoise.
- **Presentation:** public battle projection expose `megaEvolved` và `spriteKey`; battle screen ưu tiên `spriteKey`, cho phép sáu Mega mới dùng explicit base-sprite fallback an toàn trong khi unique Mega art chưa được bundle, đồng thời hiển thị badge MEGA. Mechanics/form identity vẫn là Mega thật.
- **Coverage:** **862/862 reviewed**, **779/862 executable** mỗi format = **507 move + 180 Ability + 92 item**. Mega Stone executable tăng 7/81; 74 stone còn lại giữ `mega-relation-not-promoted` fail-closed.
- **Gates:** Mega Wave 2 + catalog/beta/foundation targeted **34/34** pass; `npm run check` pass; foundation **19 forms + 166/166 items**; Move FX **67/67**; full regression **969/969** pass.

## R3-79 — Physical Mega Foundation + Feraligatr/Meganium Wave 3

- **Mega content wave:** promote `Feraligatr + Feraligite → Mega Feraligatr` và `Meganium + Meganiumite → Mega Meganium`, đưa runtime lên **9 Mega form / 9 relation**. Mega Feraligatr = Water/Dragon, 85/160/125/89/93/78, Dragonize; Mega Meganium = Grass/Fairy, 80/92/115/143/115/80, Mega Sol.
- **Physical foundation hardening:** backfill `heightM` + `weightKg` explicit cho toàn bộ 12 base form và 9 promoted Mega form. Mega validation không còn silent weight inheritance; form thiếu height/weight bị từ chối với `MEGA_FOUNDATION_MISSING`. Foundation gate đồng thời kiểm physical fields trong Mega catalog khớp foundation record.
- **Weight-sensitive regression:** Meganium đổi **1.8 m / 100.5 kg → 2.4 m / 201 kg** khi Mega, nên target-weight tier của Low Kick/Grass Knot đổi **100 BP → 120 BP**. Mega Feraligatr dùng explicit **2.3 m / 108.8 kg**, không suy diễn từ field trống ở nguồn khác.
- **Custom Mega Abilities:** Dragonize dùng shared `move-type-conversion` (Normal → Dragon, ×1.2 power). Mega Sol dùng per-holder `effective-weather-override: sun`: holder xử lý move như harsh sunlight nhưng không thay field weather hay buff Pokémon khác; Solar Beam, charge power, weather-scaled healing/stat/profile/accuracy và Fire/Water move modifier đều dùng actor-personal effective weather.
- **Coverage:** **862/862 reviewed**, **781/862 executable** mỗi format = **507 move + 180 Ability + 94 item**. Mega Stone executable tăng **9/81**; **72** stone còn lại giữ `mega-relation-not-promoted` fail-closed.
- **Gates:** Wave 3 targeted + shared weather/Mega regressions pass; `npm run check` pass; foundation **21 forms + 166/166 items**; Move FX **67/67**; full regression **975/975** pass.

## R3-80 — Mega-first roster expansion + Physical Mega Wave 4

- **Mega-first roster promotion:** promote bốn base species có Mega từ candidate M-A vào Beta Slice v24: `Steelix`, `Camerupt`, `Heracross`, `Medicham`. Playable catalog tăng **12 → 16 Pokémon** nhưng ordinary move/item pool giữ nguyên **67 move / 82 item**; Ability selectable tăng **16 → 18** do thêm `Solid Rock` và `Pure Power`.
- **Mega content wave:** promote `Steelixite → Mega Steelix`, `Cameruptite → Mega Camerupt`, `Heracronite → Mega Heracross`, `Medichamite → Mega Medicham`, đưa runtime lên **13 Mega forms / 13 relations**. Mega abilities tái dùng shared contracts đã review: Sand Force, Sheer Force, Skill Link, Pure Power.
- **Physical foundation:** thêm explicit base+Mega height/weight/gender records cho cả bốn species. Steelix **9.2 m / 400 kg → 10.5 m / 740 kg**, Camerupt **1.9 m / 220 kg → 2.5 m / 320.5 kg**, Heracross **1.5 m / 54 kg → 1.7 m / 62.5 kg**, Medicham giữ **1.3 m / 31.5 kg** ở cả base/Mega sau khi được xác minh riêng. Foundation tăng **21 → 29 battle forms**; không có physical inheritance fallback.
- **Weight regression:** Heavy Slam của Steelix vào target 100 kg đổi tier từ **100 BP** ở 400 kg lên **120 BP** sau Mega ở 740 kg, khóa yêu cầu không được kế thừa nhầm base weight.
- **Catalog separation:** `mega-beta-v4` tiếp tục giữ Mega forms ngoài recruitable species; base species được promote qua Beta v24, Mega form/Stone chỉ merge vào battle catalog qua promoted relations. Runtime catalog hiện 16 base species + 13 Mega forms, 27 unique Ability records và 95 item records sau dedupe/extension.
- **Coverage:** **862/862 reviewed**, **785/862 executable** mỗi format = **507 move + 180 Ability + 98 item**. Mega Stone executable tăng **13/81**; **68** stone còn lại giữ `mega-relation-not-promoted` fail-closed.
- **Gates:** Wave 4 targeted + historical contract regressions pass; `npm run check` pass; Beta v24 validate **16 Pokémon / 67 move / 18 Ability / 82 item**; foundation **29 forms + 166/166 items**; Move FX **67/67**; full regression **981/981** pass với fixed test concurrency.

## R3-81 — Mega-base vertical completion + content-completeness gate

- **Mega-base content closure:** toàn bộ 12 base species đang sở hữu 13 promoted Mega relations (`Venusaur`, `Blastoise`, `Beedrill`, `Charizard`, `Chesnaught`, `Scizor`, `Feraligatr`, `Meganium`, `Steelix`, `Camerupt`, `Heracross`, `Medicham`) được promote đủ legal Champions learnset + base Ability relations thay vì chỉ default-build subset. Union riêng của 12 species này = **274 legal move / 22 legal Ability**, toàn bộ đã runtime-supported ở Single/Double.
- **Beta Slice v25 / schema 4:** giữ toàn bộ optional content từ v24 rồi cộng full Mega-base relations, nên active ordinary catalog hiện **16 Pokémon / 285 move / 26 Ability / 82 item**. Bốn non-Mega species vẫn giữ scope beta hiện tại; Mega forms tiếp tục là battle-only extension, không trở thành recruitable species riêng.
- **Fail-closed completeness contract:** `completeSpeciesIds` trở thành contract machine-readable. Validator từ chối slice nếu thiếu chỉ một legal move/Ability của species đã đánh dấu complete; regression khóa `Steelix → Head Smash` và `Heracross → Moxie`.
- **Mega/base consistency gate:** thêm `npm run mega:validate` vào `npm run check`. Mọi Mega relation bắt buộc có base species trong playable catalog, base phải nằm trong `completeSpeciesIds`, và toàn bộ candidate move/Ability relations của base phải tồn tại trong active catalog. Nhờ vậy từ đây không thể promote “Mega trước, Pokémon gốc chưa hoàn thiện” một cách im lặng.
- **Build/UI integration:** schema-3 build validator chấp nhận full promoted learnset/Ability của Mega-base species; regression xác nhận Steelix build `Head Smash / Heavy Slam / Curse / Sleep Talk + Rock Head + Steelixite` hợp lệ và Heracross expose `Megahorn + Moxie`.
- **Coverage:** global mechanics không đổi **862/862 reviewed, 785/862 executable** mỗi format = 507 move + 180 Ability + 98 item; thay đổi ở R3-81 là active playable breadth, không tô lại global support. Move-FX artifact mở từ **67/67 → 285/285 active moves**.
- **Gates:** Beta v25 validate **16 Pokémon / 285 move / 26 Ability / 82 item**; `mega:validate` **12/12 base species content-complete, 13 relations**; foundation **29 forms + 166/166 items**; full regression **983/983** pass.


## R3-82 — Mega-first vertical Wave 5

- **Vertical-complete species batch:** promote đồng thời `Alakazam`, `Aerodactyl`, `Garchomp`, `Gyarados`, `Ampharos`, `Manectric` vào Beta Slice v26 và đánh dấu cả sáu là content-complete. Active ordinary catalog tăng lên **22 Pokémon / 322 move / 38 Ability / 82 item**; toàn bộ legal Champions move/Ability relations của 18 Mega-base species đều nằm trong active catalog và runtime-supported.
- **Mega Wave 5:** promote `Alakazite → Mega Alakazam`, `Aerodactylite → Mega Aerodactyl`, `Garchompite → Mega Garchomp`, `Gyaradosite → Mega Gyarados`, `Ampharosite → Mega Ampharos`, `Manectite → Mega Manectric`. Runtime lên **19 Mega forms / 19 relations**; 6 Stone mới dùng shared Mega handler thay vì species-specific branches.
- **Physical foundation / multi-source gate:** base và Mega form đều có explicit reviewed height/weight/gender. Mega values: Alakazam **1.2 m / 48 kg**, Aerodactyl **2.1 m / 79 kg**, classic Garchomp **1.9 m / 95 kg**, Gyarados **6.5 m / 305 kg**, Ampharos **1.4 m / 61.5 kg**, Manectric **1.8 m / 44 kg**. Foundation tăng **29 → 41 battle forms**; không có silent physical inheritance.
- **Ability-start semantics:** Tough Claws/Sand Force/Mold Breaker tái dùng shared contracts; Mega Manectric chạy Intimidate ngay trong Mega phase; Mega Alakazam chạy Trace ngay trong Mega phase và copy Ability của opposing active slot qua generic Ability Start lifecycle.
- **Garchomp form split:** `Garchompite` chỉ map classic Mega Garchomp (Sand Force, 95 kg). `Mega Garchomp Z / Garchompite Z` giữ unpromoted vì nguồn hiện hành tách thành form riêng và còn mâu thuẫn Ability ở các nguồn cross-check; validator/test cấm vô tình alias Z sang classic form.
- **Weight-sensitive regression:** Mega Gyarados dùng **305 kg** thay vì base 235 kg cho Heavy Slam/Heat Crash ratio tiers; regression khóa thay đổi **80 BP → 120 BP** trước target 60 kg.
- **Coverage/Gates:** **862/862 reviewed**, **791/862 executable** mỗi format = **507 move + 180 Ability + 104 item**. Mega Stone executable **19/81**, còn **62** fail-closed. Beta v26 validate **22/322/38/82**; `mega:validate` **18/18 base species, 19 relations**; foundation **41 forms + 166/166 items**; Move FX **322/322**; full regression **990/990** pass.

## R3-83 — Mega-first vertical Wave 6 / 10-species batch

- **Larger vertical-complete batch:** promote đồng thời `Abomasnow`, `Absol`, `Altaria`, `Audino`, `Banette`, `Gallade`, `Gardevoir`, `Glalie`, `Houndoom`, `Lucario` vào Beta Slice v27. Cả 10 base species được đánh dấu content-complete với toàn bộ legal Champions learnset + Ability relations; active ordinary catalog lên **32 Pokémon / 367 move / 56 Ability / 82 item**, và tổng content-complete Mega-base species lên **28/28**.
- **Mega Wave 6:** promote `Abomasite`, `Absolite`, `Altarianite`, `Audinite`, `Banettite`, `Galladite`, `Gardevoirite`, `Glalitite`, `Houndoominite`, `Lucarionite`, đưa runtime lên **29 Mega forms / 29 relations**. Alternate Z relations như `Absolite Z`/Mega Absol Z và Mega Lucario Z không bị alias vào classic form.
- **Physical foundation / form separation:** thêm explicit base+Mega height/weight/gender cho toàn bộ 10 cặp, nâng foundation **41 → 61 battle forms**. Regression khóa Abomasnow **135.5 → 185 kg** và Glalie **256.5 → 350.2 kg** làm Heavy Slam đổi **100 → 120 BP** ở các target-weight fixture đã chọn; không có silent base-weight inheritance.
- **Shared Ability semantics:** Snow Warning chạy ngay trong Mega phase; Pixilate/Refrigerate dùng generic Normal-type conversion + ×1.2 power; Magic Bounce, Healer, Prankster, Solar Power và Adaptability được compile từ shared Ability contracts hiện có. Không thêm species-specific damage/priority branches.
- **Expanded catalog guard:** beta schema 4 vẫn giữ `completeSpeciesIds`/learnset/Ability coverage/Mega-base consistency; chỉ nâng giới hạn kỹ thuật expanded catalog từ 24 lên **64 species** để không chặn batch content-complete lớn. Gate không bị bỏ hoặc nới theo kiểu bypass.
- **Coverage/Gates:** **862/862 reviewed**, **801/862 executable** mỗi format = **507 move + 180 Ability + 114 item**. Mega Stone executable **29/81**, còn **52** fail-closed. Beta v27 validate **32/367/56/82**; `mega:validate` **28/28 base species, 29 relations**; foundation **61 forms + 166/166 items**; Move FX **367/367**; full regression **997/997** pass.

## R3-84 — Mega-first vertical Wave 7 / 13-species batch

- **13-species vertical-complete batch:** promote đồng thời `Lopunny`, `Pidgeot`, `Sableye`, `Sharpedo`, `Slowbro`, `Tyranitar`, `Chandelure`, `Dragonite`, `Clefable`, `Froslass`, `Hawlucha`, `Starmie`, `Delphox` vào Beta Slice v28. Active ordinary catalog lên **45 Pokémon / 386 move / 77 Ability / 82 item**; tổng Mega-base content-complete đạt **41/41**.
- **Mega Wave 7:** promote 13 Stone/relation tương ứng, đưa runtime lên **42 Mega forms / 42 relations** và **42/81 Mega Stone executable**. Các form dùng shared Ability contracts hiện có như Scrappy, No Guard, Magic Bounce, Strong Jaw, Shell Armor, Sand Stream, Infiltrator, Multiscale, Snow Warning, Huge Power và Levitate.
- **Physical foundation:** mọi base/Mega form mới có explicit reviewed height/weight/gender, nâng foundation **61 → 87 battle forms**. Regression khóa Mega Sableye **11 → 161 kg**, làm Heavy Slam từ minimum tier **40 BP → 120 BP** trước target 30 kg; không có silent inheritance.
- **Mega-phase lifecycle:** Sand Stream/Snow Warning khởi động weather ngay khi Mega Evolution; Strong Jaw/Huge Power tiếp tục đi qua generic power/stat contracts.
- **Coverage/Gates:** **862/862 reviewed**, **814/862 executable** mỗi format = **507 move + 180 Ability + 127 item**. Mega Stone executable **42/81**, còn **39** fail-closed. Beta v28 validate **45/386/77/82**; `mega:validate` **41/41 base species, 42 relations**; foundation **87 forms + 166/166 items**; Move FX **386/386**; full regression **1004/1004** pass.

## R3-85 — Mega-first vertical Wave 8 / 18-species + 22-relation batch

- **18-species vertical-complete batch:** promote `Aggron`, `Chimecho`, `Crabominable`, `Drampa`, `Emboar`, `Excadrill`, `Floette`, `Gengar`, `Glimmora`, `Golurk`, `Greninja`, `Kangaskhan`, `Meowstic`, `Pinsir`, `Raichu`, `Scovillain`, `Skarmory`, `Victreebel` vào Beta Slice v29. Active ordinary catalog lên **63 Pokémon / 415 move / 96 Ability / 82 item**; tổng Mega-base content-complete đạt **59/59**.
- **Mega Wave 8 / 22 relations:** promote 18 nhóm base mới, gồm hai nhánh `Raichu X/Y`, đồng thời mở các alternate relation `Absol Z`, `Garchomp Z`, `Lucario Z`. Runtime tăng **42 → 64 Mega forms/relations** và **64/81 Mega Stone executable**. `Meowsticite` có explicit `requiredGender: male`, nên female Meowstic bị từ chối bằng `MEGA_GENDER_REQUIRED` thay vì biến đổi sai form.
- **Physical foundation:** toàn bộ form mới có reviewed explicit height/weight/gender, nâng foundation **87 → 127 battle forms**. Các giá trị Mega không bị inherit im lặng từ base; regression/data gate giữ riêng Mega Floette **100.8 kg**, Mega Victreebel **125.5 kg** và Raichu X/Y **1.2 m / 38 kg** vs **1.0 m / 26 kg** để weight-sensitive moves đọc đúng form hiện tại.
- **Runtime Ability expansion:** thêm generic hooks cho `field-type-damage-aura`, `contact-protection-pierce`, `parental-bond`, `opponent-switch-trap`, `entry-terrain` và mở damage-response cho attacker status/faint-attacker damage. Nhờ đó Fairy Aura, Piercing Drill/Unseen Fist, Parental Bond, Shadow Tag, Electric Surge, Spicy Spray, Innards Out, Aura Guard cùng các shared contracts cũ chạy qua manifest thay vì species-specific branches.
- **Coverage/Gates:** **862/862 reviewed**, **836/862 executable** mỗi format = **507 move + 180 Ability + 149 item**. Mega Stone executable **64/81**, còn **17** fail-closed. Beta v29 validate **63/415/96/82**; `mega:validate` **59/59 base species, 64 relations**; foundation **127 forms + 166/166 items**; Move FX **415/415**; Wave-8 targeted **9/9** và full regression **1014/1014** pass.

## R3-86 — Non-Mega M-A vertical Wave 1 / 20-species batch

- **20-species vertical-complete batch:** promote `Arbok`, `Pikachu`, `Ninetales`, `Arcanine`, `Machamp`, `Tauros`, `Vaporeon`, `Jolteon`, `Flareon`, `Snorlax`, `Ariados`, `Azumarill`, `Politoed`, `Espeon`, `Umbreon`, `Slowking`, `Forretress`, `Pelipper`, `Torkoal`, `Milotic` vào Beta Slice v30. Active ordinary catalog tăng **63 → 83 Pokémon**, **415 → 427 move**, **96 → 112 Ability**, giữ **82 item**; tổng content-complete tăng **59 → 79 species**.
- **Scope discipline:** 17 Mega Stone còn fail-closed không bị promote cưỡng ép chỉ để tăng coverage. Các target Mega còn lại nằm ngoài tập non-Mega M-A đang mở và được defer cho snapshot/scope audit phù hợp; Mega extension vẫn giữ **64 forms / 64 relations**.
- **Physical/gender foundation:** thêm explicit reviewed height/weight/gender cho 20 base form mới, nâng foundation **127 → 147 battle forms**. Regression khóa Slowking **2.0 m / 79.5 kg**, Forretress **125.8 kg**, Milotic **6.2 m / 162 kg**, Tauros male-only và Ninetales **25% male / 75% female**, nên Attract/Rivalry và weight-sensitive moves dùng đúng foundation thay vì fallback.
- **Catalog invariants:** expanded beta ceiling tăng có kiểm soát **64 → 128** members để roster M-A có thể tiếp tục mở rộng. `mega:validate` được sửa invariant: mọi **promoted Mega base** bắt buộc content-complete, nhưng content-complete non-Mega không còn bị ép phải có Mega relation.
- **Coverage/Gates:** global mechanics giữ **862/862 reviewed**, **836/862 executable** mỗi format = **507 move + 180 Ability + 149 item**. Beta v30 validate **83/427/112/82**; `mega:validate` **59/59 promoted Mega bases, 79 total complete species, 64 relations**; foundation **147 forms + 166/166 items**; Move FX **427/427**; full regression **1015/1015** pass.

## R3-87 — Non-Mega M-A vertical Wave 2 / 25-species batch

- **25-species vertical-complete batch:** promote `Torterra`, `Empoleon`, `Luxray`, `Roserade`, `Rampardos`, `Bastiodon`, `Spiritomb`, `Hippowdon`, `Toxicroak`, `Weavile`, `Rhyperior`, `Leafeon`, `Glaceon`, `Gliscor`, `Mamoswine`, `Serperior`, `Samurott`, `Watchog`, `Liepard`, `Simisage`, `Simisear`, `Simipour`, `Conkeldurr`, `Whimsicott`, `Krookodile` vào Beta Slice v31. Active ordinary catalog tăng **83 → 108 Pokémon**, **427 → 431 move**, **112 → 120 Ability**, giữ **82 item**; tổng content-complete tăng **79 → 104 species**.
- **Physical/gender foundation:** thêm explicit reviewed height/weight/gender cho toàn bộ 25 base form mới, nâng foundation **147 → 172 battle forms**. Regression khóa representative values cho Torterra, Conkeldurr và Whimsicott; gender eighths luôn tổng bằng 8 để Attract/Rivalry và weight-sensitive moves dùng deterministic foundation.
- **M-A scale guard:** nâng expanded-catalog ceiling **128 → 256** vì candidate M-A có **213 species/form entries**; thay đổi này chỉ mở giới hạn catalog và không đổi battle roster size 6 hay pick rules. Audit trước Wave 2 cho thấy 123/130 entry còn lại không phụ thuộc 9 move fail-closed; bảy special-form entry còn dính legacy set là năm Rotom appliance và Aegislash Blade/Shield.
- **Coverage/Gates:** global mechanics giữ **862/862 reviewed**, **836/862 executable** mỗi format = **507 move + 180 Ability + 149 item**. Beta v31 validate **108/431/120/82**; `mega:validate` **59/59 promoted Mega bases, 104 total complete species, 64 relations**; foundation **172 forms + 166/166 items**; Move FX **431/431**; full regression **1017/1017** pass.

## R3-88 — Non-Mega M-A vertical Wave 3 / 25-species batch

- **25-species vertical-complete batch:** promote `Cofagrigus`, `Garbodor`, `Reuniclus`, `Vanilluxe`, `Emolga`, `Beartic`, `Stunfisk`, `Hydreigon`, `Volcarona`, `Diggersby`, `Talonflame`, `Vivillon`, `Florges`, `Pangoro`, `Furfrou`, `Aromatisse`, `Slurpuff`, `Clawitzer`, `Heliolisk`, `Tyrantrum`, `Aurorus`, `Sylveon`, `Dedenne`, `Goodra`, `Klefki` vào Beta Slice v32. Active ordinary catalog tăng **108 → 133 Pokémon**, **431 → 440 move**, **120 → 140 Ability**, giữ **82 item**; tổng content-complete tăng **104 → 129 species**.
- **Physical/gender foundation:** thêm explicit reviewed height/weight/gender cho toàn bộ 25 base form mới, nâng foundation **172 → 197 battle forms**. Regression khóa representative values cho Beartic 260 kg, Tyrantrum 270 kg, Aurorus 225 kg, female-only Florges và tỷ lệ 1F:7M của Tyrantrum/Aurorus/Sylveon.
- **Scope discipline:** Wave 3 tiếp tục tránh regional/form-switch entries và nhóm Rotom/Aegislash special-form đang defer, nên không mở rộng form-lifecycle scope giữa batch. Sau v32 còn **80/213 candidate species/form entries** chưa promote trong M-A; các entry này cần tiếp tục được chia theo readiness thay vì suy diễn completeness.
- **Coverage/Gates:** global mechanics giữ **862/862 reviewed**, **836/862 executable** mỗi format = **507 move + 180 Ability + 149 item**. Beta v32 validate **133/440/140/82**; `mega:validate` **59/59 promoted Mega bases, 129 total complete species, 64 relations**; foundation **197 forms + 166/166 items**; Move FX **440/440**; full regression **1019/1019** pass.

## R3-89 — Non-Mega M-A vertical Wave 4 / 25-species batch

- **25-species vertical-complete batch:** promote `Trevenant`, `Gourgeist`, `Avalugg`, `Noivern`, `Incineroar`, `Toucannon`, `Lycanroc-Midday`, `Toxapex`, `Mudsdale`, `Araquanid`, `Salazzle`, `Tsareena`, `Oranguru`, `Passimian`, `Kommo-o`, `Corviknight`, `Flapple`, `Appletun`, `Sandaconda`, `Polteageist`, `Hatterene`, `Mr. Rime`, `Runerigus`, `Alcremie`, `Dragapult` vào Beta Slice v33. Active ordinary catalog tăng **133 → 158 Pokémon**, **440 → 460 move**, **140 → 155 Ability**, giữ **82 item**; tổng content-complete tăng **129 → 154 species**. `Primarina` được loại khỏi batch mới vì đã recruitable từ trước nhưng chưa content-complete; `Dragapult` thay vào để Wave 4 vẫn có đúng 25 species mới.
- **Physical/gender foundation:** thêm explicit reviewed height/weight/gender cho toàn bộ 25 base form mới, nâng foundation **197 → 222 battle forms**. Regression khóa các case có ý nghĩa cho weight/gender mechanics như Mudsdale **920 kg**, Avalugg **505 kg**, female-only Salazzle/Tsareena/Hatterene/Alcremie, genderless Polteageist/Runerigus và Dragapult **3.0 m / 50 kg**.
- **Scope discipline:** tiếp tục tránh regional variants và form-switch entries cần lifecycle riêng. Sau v33 còn **59/213 candidate species/form entries chưa content-complete** trong M-A; bốn species đã recruitable nhưng vẫn incomplete (`Typhlosion`, `Infernape`, `Decidueye`, `Primarina`) được giữ cho batch closure riêng thay vì giả định complete. Năm Rotom appliance và Aegislash Blade/Shield vẫn nằm trong nhóm special-form cần xử lý cùng legacy/form contracts.
- **Coverage/Gates:** global mechanics giữ **862/862 reviewed**, **836/862 executable** mỗi format = **507 move + 180 Ability + 149 item**. Beta v33 validate **158/460/155/82**; `mega:validate` **59/59 promoted Mega bases, 154 total complete species, 64 relations**; foundation **222 forms + 166/166 items**; Move FX **460/460**; full regression **1021/1021** pass.

## R3-90 — M-A scope lock + Non-Mega M-A vertical Wave 5 / 30-entry closure

- **M-A source-of-truth lock:** thêm `ma:validate` và regression khóa denominator battle-content thành **272 entries = 213 non-Mega + 59 Mega forms**, với **58 Mega base species**; Charizard X/Y là cặp Mega duy nhất dùng chung một base trong M-A. Đây là scope battle-content, không đồng nhất với Recruit Ranch/cosmetic-form counts.
- **Mega legality correction:** `Raichu Mega X/Y` được retag chỉ `m-b`; `Absol Mega Z`, `Garchomp Mega Z`, `Lucario Mega Z` chỉ `m-c`. `mega-beta-v8` vẫn giữ đủ 64 implementation để tái sử dụng cho regulation sau, nhưng runtime catalog M-A chỉ expose **59 legal Mega relations/forms**.
- **Wave 5:** Beta v34 hoàn thiện **30 non-Mega M-A entries**: 26 entry mới (`Raichu-Alola`, `Ninetales-Alola`, `Arcanine-Hisui`, `Slowbro-Galar`, ba Paldean Tauros, `Typhlosion-Hisui`, `Slowking-Galar`, `Samurott-Hisui`, `Stunfisk-Galar`, `Meowstic-Female`, `Goodra-Hisui`, `Avalugg-Hisui`, `Decidueye-Hisui`, `Lycanroc-Dusk`, `Lycanroc-Midnight`, `Wyrdeer`, `Kleavor`, hai Basculegion, `Sneasler`, `Meowscarada`, `Skeledirge`, `Quaquaval`, `Garganacl`) và đóng completeness cho bốn species đã recruitable từ trước (`Typhlosion`, `Infernape`, `Decidueye`, `Primarina`). Active ordinary catalog tăng **158 → 184 Pokémon**, **460 → 472 move**, **155 → 163 Ability**, giữ **82 item**; toàn bộ **184/184 active non-Mega entries** hiện content-complete.
- **Foundation/data correction:** foundation tăng **222 → 248 battle forms** với explicit height/weight/gender cho regional/form entries; Primarina gender được sửa về **1 female : 7 male eighths**. Ambiguous generic `lycanroc` và dynamic-form/lifecycle-heavy entries tiếp tục defer thay vì ép qua validator.
- **Progress:** tổng M-A vertical-complete hiện **243/272 = 184 non-Mega + 59 Mega**, còn đúng **29 non-Mega M-A entries**. Không còn Mega M-A nào thiếu.
- **Gates:** Beta v34 validate **184/472/163/82**; `ma:validate` **213 + 59 = 272**; `mega:validate` **58/58 M-A Mega bases, 59 legal M-A relations, 184 complete non-Mega species**; foundation **248 forms + 166/166 items**; Move FX **472/472**; `npm run check` pass; full regression **1028/1028** pass.

## R3-91 — Canonical M-A closure + special-form contracts

- **Canonical selector overlay:** khóa exact **213 selectable non-Mega M-A IDs**, loại `aegislash-blade`, `aegislash-shield` và generic `lycanroc` khỏi selector scope; bổ sung Gourgeist Small/Large/Jumbo. Aegislash Blade/Shield và các state form của Castform/Mimikyu/Morpeko/Palafin chỉ tồn tại như battle-state internal forms.
- **Wave 6 closure:** Beta v35 đưa 29 entry cuối vào active catalog, đạt **213 Pokémon / 490 move / 180 ordinary Ability / 82 item** và **213/213 non-Mega content-complete**. Cộng **59/59 M-A Mega forms**, Regulation M-A battle-content đạt **272/272 vertical-complete**.
- **Special mechanics:** Ditto hỗ trợ learnset một move `Transform`; Transform resolve Pokémon đang chiếm target slot tại thời điểm thực thi; Forecast đổi Castform identity/type theo weather; Stance Change xử lý Aegislash Blade/Shield nhưng bỏ qua called moves/transformed copies; Disguise chuyển Mimikyu sang Busted sau hit đầu; Hunger Switch không chạy trên transformed copy; Illusion chỉ che presentation; Zero to Hero kích hoạt khi Palafin switch-out còn sống.
- **Rotom/Gourgeist contracts:** sáu Rotom là selectable entries độc lập; năm appliance dùng chung appliance stats và mỗi form chỉ thêm đúng signature move. Gourgeist selector dùng Medium (generic), Small, Large, Jumbo theo Regulation M-A.
- **Foundation:** physical/gender data explicit cho toàn bộ Wave 6 và internal battle forms; foundation hiện validate **277 battle forms** (bao gồm 64 Mega implementations global, trong đó 59 legal M-A + 5 later-regulation). Move FX active catalog đạt **490/490**.
- **Gates:** `npm run check` pass; targeted R3-91/canonical/special-form regression **87/87** pass; full regression **1038/1038** pass. M-A scope validator khóa exact 213 canonical IDs + 59 Mega = 272 và Mega validator giữ đúng 59 legal M-A relations.

## R3-92 — Pokémon-style UI Foundation / Input + Window + Battle HUD primitives

- **Presentation rebaseline:** lấy R3-91 (M-A 272/272 battle-content) làm baseline và bắt đầu roadmap `docs/ui-battle-presentation-roadmap.md`. Batch này không đổi mechanics, catalog, battle protocol hay authoritative event ordering; mục tiêu là tạo lớp presentation mới chạy song song UI V3 hiện tại để migration từng phần không cần rewrite battle engine.
- **Input architecture:** thêm `InputAction` abstraction cho keyboard/gamepad mapping, `UiModeStack`, `FocusManager` và `GameUiController`. Arrow/WASD, Z/Enter/Space, X/Escape và các action page/detail được chuẩn hóa trước khi tới screen handler; input text/select không bị keyboard controller chiếm quyền. Battle Schema 3 bắt đầu dùng cùng focus model cho landing, preview, move selection, submit, replacement, skip, surrender và result.
- **Pokémon-style primitives:** thêm `AetherWindow`, `MessageBox` và `PokemonHud` cùng CSS presentation riêng. Battle HUD chuyển khỏi block HUD bespoke sang reusable Pokémon-style HP component với semantic HP/status/Mega state; command/replacement/resolution/result bắt đầu dùng window/dialog primitives mới. Hệ này vẫn DOM-first để giữ responsive/accessibility và chuẩn bị cho R3-93 battle shell.
- **Mode contract:** `V3BattleScreen.uiMode()` expose `BATTLE_LANDING`, `BATTLE_PREVIEW`, `BATTLE_ANIMATION`, `BATTLE_COMMAND`, `BATTLE_REPLACEMENT`, `BATTLE_RESULT` và `BATTLE_MESSAGE`. Đây là bridge đầu tiên từ router/page kiểu dashboard sang state-machine UI; battle engine vẫn là nguồn sự thật duy nhất.
- **Testing:** thêm 5 test foundation cho input mapping, mode stack, directional focus, DOM/controller parity và reusable primitives. Targeted UI/battle/FX/playback regression **53/53** pass; `npm run check` pass với **490/490 Move FX**, foundation **277 forms**, M-A exact **213 + 59 = 272**; full regression **1043/1043** pass.
- **Next:** R3-93 sẽ dùng foundation này để chuyển battle thành game-surface Pokémon thực sự: command → move → target state flow, message/command dock, party/replacement overlay và HUD composition cho Single/Double; không mở rộng content M-A trong cùng batch.

## R3-93 — Pokémon Battle UI Shell / Command → Move → Target → Review

- **Immersive battle shell:** Schema 3 Battle không còn nằm trong dashboard sidebar/topbar; battle route render một `pokemon-game-surface` riêng với game header, battlefield stage và bottom command/message dock. Single/Double vẫn dùng authoritative projection/event timeline cũ; batch này không đổi mechanics, catalog, server command contract hay damage ordering.
- **Sequential Pokémon-style command state machine:** thêm `BattleCommandUiHandler` với các mode `COMMAND → MOVE → TARGET/PARTY → REVIEW`. Double dẫn lần lượt từng active Pokémon thay vì render move/target/switch của cả hai slot cùng lúc; Cancel đi ngược đúng state, Review cho phép sửa từng actor trước khi submit. Forced charge/recharge được sync tự động mà vẫn giữ command authoritative.
- **Target/Mega/party flow:** target candidates hiểu `adjacentAlly`, `adjacentAllyOrSelf`, `adjacentFoe`, `anyAdjacent` và các auto-target mode; Mega được queue ngay trong Fight flow nhưng server vẫn validate. Replacement phase bỏ dropdown, dùng party cards/HP bar và chặn trực quan hai active slot chọn cùng một reserve trong Double.
- **Input integration:** `GameUiController` giờ route Cancel/Detail vào battle handler; keyboard/mouse dùng cùng focus model từ R3-92. Battle log trở thành overlay có thể bật/tắt thay vì chiếm layout chính; landing/preview/replacement/result đều dùng Pokémon-style window language.
- **Presentation-only boundary:** `V3BattleScreen` chỉ chuyển presentation/client state; request submit lên server giữ nguyên shape. Existing move FX/playback/field/authoritative battle tests tiếp tục pass, nên shell mới không tự tính legality hay mechanics.
- **Testing/Gates:** thêm 5 regression test R3-93 cho immersive shell, Fight/Target/Cancel state flow, target semantics, duplicate replacement prevention và controller integration; đăng ký chúng vào full `npm test`. Targeted battle/UI/Mega/playback/Move-FX gate **65/65** pass; `npm run check` pass với **490/490 Move FX**, foundation **277 forms**, M-A exact **213 + 59 = 272** và **59/59 legal M-A Mega forms**; full regression **1048/1048** pass.
- **Next:** R3-94 chuyển sang Battle Presentation Runtime: timeline/anchor/layer/actor motion/camera/audio/commit markers và legacy Move-FX adapter, vẫn giữ battle engine authoritative.

## R3-94 — Battle Presentation Runtime / Data-driven timeline foundation

- **Presentation boundary:** thêm runtime presentation tách khỏi battle mechanics. Battle engine/event stream vẫn authoritative; presentation chỉ compile `move + stage + targets` thành timeline definition/cues và không được phép tính damage, legality hay thay đổi snapshot.
- **Schema/timeline:** thêm canonical presentation layers (`BACKGROUND → FIELD_BACK → ACTOR_BACK → ACTOR → ACTOR_FRONT → FX_FRONT → UI`), anchor vocabulary cho USER/TARGET/FIELD, cue types `effect/actor/camera/screen/audio/commit`, schema validator và cancellable timeline scheduler. Commit cue nằm ở authoritative impact boundary; cast snapshot tiếp tục giữ HP/state trước damage, impact snapshot mới reveal result.
- **Legacy Move-FX adapter:** hệ 490 Move FX cũ không bị bỏ. Mỗi profile hiện compile qua `legacy-adapter` thành cast/impact timeline có actor motion, visual cue timing, target-relative tracks, semantic audio hooks và commit marker. Spread move vẫn giữ per-target outcome/slot anchor; self/field target không bị convert sang sai foe track.
- **Actor/camera/screen hooks:** battle arena nhận presentation classes cho lunge/pulse/target shake, camera shake và screen flash. Các hook này chỉ là presentation; CSS reduced-motion tắt motion/flash, còn 2× dùng cùng scheduler speed scaling. `client.js` phát `aether:battle-presentation` và `aether:battle-audio-cue` CustomEvent để R3-95/R3-99 có thể gắn asset/audio thật mà không sửa battle engine.
- **Coverage gate:** `generate-move-fx-coverage.mjs` giờ verify đồng thời profile cũ và presentation timeline mới. Active catalog đạt **490/490 profiles + 490/490 presentation timelines**, tất cả impact definition có commit marker; report ghi tier/cast cue/impact cue theo từng move.
- **Testing/Gates:** thêm 7 regression test R3-94 cho schema, 490-move compilation, beam/camera/audio/commit contract, spread renderer, runtime audio dispatch, speed-scaled timeline và authoritative snapshot boundary. Focused battle/UI/Mega/playback/FX gate **64/64** pass; `npm run check` pass với foundation **277 forms**, M-A exact **213 + 59 = 272**, Mega M-A **59/59**; full regression **1055/1055** pass.
- **Next:** R3-95 sẽ bắt đầu Move FX Migration Wave 1: author core parameterized templates + một nhóm signature animations trên runtime mới, giảm dần `legacy-adapter` nhưng luôn giữ missing=0.

## R3-95 — Move FX Migration Wave 1 / Parameterized timelines + signature animations

- **Migration closure:** toàn bộ **490/490 active moves** đã rời `legacy-adapter`. Coverage mới khóa **10 signature timelines + 480 parameterized timelines + 0 legacy fallback + 0 missing**; profile cũ vẫn được giữ làm semantic/fallback metadata để không phá catalog/tooling, nhưng renderer hiện dùng timeline definition mới cho mọi active move.
- **Core templates:** thêm template cho `projectile`, `beam`, `slash`, `rush`, `impact`, `aura`, `barrier`, `drain`, `multi-hit`, `field-wave`, `weather` và `hazard`. Weather dùng FIELD anchor; hazards dùng TARGET_SIDE anchor; drain có đường TARGET→USER; 15 move multi-hit reviewed dùng timeline nhiều projectile thay vì generic physical impact.
- **Signature Wave 1:** Thunderbolt, Flamethrower, Surf, Solar Beam, Hyper Beam, Protect, Earthquake, Shadow Ball, Close Combat và Dragon Pulse có timeline riêng cùng primitive riêng (`electric-bolt`, `flame-stream`, `water-wave`, `solar-flare`, `hyper-beam-core`, `quake-ring`, `shadow-orb`, `combat-hit`, `dragon-wave`). Các definition vẫn chỉ biểu diễn presentation; damage/state authoritative tiếp tục đến từ battle event/snapshot.
- **Anchor/layer hardening:** renderer giờ thực sự phân biệt `USER_CENTER`, `TARGET_CENTER`, `FIELD_CENTER`, `USER_SIDE_CENTER`, `TARGET_SIDE_CENTER`, `USER_TO_TARGET` và `TARGET_TO_USER` thay vì dùng một track chung cho mọi cue. Spread signature/template vẫn giữ outcome theo từng target và đúng slot coordinates trong Double.
- **Timeline safety:** schema validator reject cue nếu `at + duration` vượt definition duration, ngăn FX tràn sang action frame kế tiếp. Signature cast/impact được khóa trong 1050/420 ms hiện hành; 1×/2×/Skip/reduced-motion tiếp tục dùng playback contract R3-94.
- **Coverage/reporting:** `r7-move-fx-coverage.json` giờ ghi `tierCounts`, `templateCounts`, `signatureMoveCount`, `parameterizedMoveCount`, `legacyMoveCount`; `npm run check` fail nếu còn legacy fallback hoặc signature Wave 1 bị regression.
- **Testing/Gates:** thêm 9 test R3-95 cho migration counts, 10 signature primitives, weather/hazard anchors, 15 multi-hit IDs, spread outcomes, reverse/static anchors, coverage report, timeline overflow guard và CSS primitives. Focused battle/UI/Mega/playback gate **63/63** pass; `npm run check` pass với **490/490 profiles + 490/490 timelines**, foundation **277 forms**, M-A exact **213 + 59 = 272**, Mega M-A **59/59**; full regression **1064/1064** pass.
- **Next:** R3-96 chuyển sang Special Battle Presentation: Mega Evolution, Transform/Imposter, Illusion, Forecast, Stance Change, Disguise, Hunger Switch, Zero to Hero và two-turn/semi-invulnerable actor states trên cùng runtime.

## R3-96 — Special Battle Presentation / form, disguise, transform and semi-invulnerable states

- **Special-state presentation runtime:** thêm `special-battle-presentation.js` trên cùng data-driven runtime R3-94/R3-95. Mega Evolution, Transform/Imposter, Illusion break/start, Forecast/Stance Change/Hunger Switch/Zero to Hero form events, Disguise break, two-turn semi-invulnerable enter/exit, switch-in và faint đều map thành semantic actor/screen/audio cues thay vì để battle logic tự điều khiển animation.
- **Authoritative identity projection:** form-change events giờ mang `spriteKey`; Transform/restore event mang display identity; Illusion break projection reveal real species/name/sprite/types đúng lúc Ability vỡ nhưng vẫn tiếp tục giấu opponent Illusion start/Ability event trước đó. Zoroark giữ display identity tách biệt combat identity, không dùng Transform path.
- **Timeline timing:** `abilityFormChanged` với trigger `before-move` được apply vào cast snapshot, nên Aegislash đổi Blade/Shield trước animation của move nhưng damage/effect vẫn chỉ commit ở impact. Các form change khác (Forecast, Disguise, Hunger Switch) vẫn commit tại event frame authoritative.
- **Persistent semi-invulnerability:** public battle projection expose duy nhất state presentation cần thiết (`underground`, `underwater`, `airborne`, `vanished`) thay vì leak volatile internals. Dig/Dive/Fly/Phantom Force giữ visual state qua command turn kế tiếp và clear khi release/abort; Smack Down interruption mang mode để presentation có emerge cue.
- **Battle visuals:** thêm actor morph/shatter/break/vanish/emerge/faint/Mega animations, persistent semi-invulnerable CSS states, semantic special overlays và reduced-motion fallback. Palafin Hero re-entry dùng authoritative `palafin-hero` snapshot để ưu tiên form morph trên generic switch-in.
- **Testing/Gates:** thêm 6 regression test R3-96 cho Transform projection, pre-cast Stance Change timing, special cue mapping, persistent semi-invulnerability, Illusion reveal/public-state boundary và CSS contracts. Mechanics-focused gate **80/80** pass; Battle/UI/FX gate **37/37** pass; `npm run check` pass với **490/490 profiles + 490/490 timelines**, foundation **277 forms**, M-A **213 + 59 = 272**, Mega M-A **59/59**; full regression **1070/1070** pass.
- **Next:** R3-97 chuyển Party + Summary + Training sang Pokémon-style UI, tái sử dụng UiMode/Input/Window primitives thay vì tiếp tục mở rộng battle mechanics trong cùng batch.

## R3-97 — Pokémon Party + Summary + Training UI

- **Summary/Training redesign:** `V3TrainingEditor` không còn là một form dài. Mỗi Pokémon dùng một Summary console bốn page `Profile / Stats / Moves / Ability-Item`; Profile hiển thị Dex/form/type/physical/gender/base stats và Mega eligibility, Stats chỉnh 66 Stat Points + nature, Moves chỉnh move set kèm power/accuracy/PP/description, Loadout chỉnh Ability + held item.
- **Nature correctness:** UI trước R3-97 chỉ expose Modest/Jolly/Adamant và chỉ preview modifier cho ba nature này dù server hỗ trợ 25. R3-97 expose đủ 25 nature và preview level-50 stat modifier theo cùng up/down contract của rules-v3; server validation/save schema không đổi.
- **Party redesign:** Team Builder chuyển từ sáu `<select>` sang Party screen sáu slot + build picker. Chọn member đang ở slot khác sẽ swap hai slot trực tiếp; build ngoài party thay slot hiện tại. UI trình bày species/type/build/Ability/item và local Species/Item Clause status, còn server vẫn authoritative validate khi `teamV3.save`.
- **Shared input architecture:** Training/Party dùng cùng `GameUiController`, keyboard focus/cursor và `PAGE_LEFT/PAGE_RIGHT` vocabulary của R3-92. Q/E hoặc shoulder-page action chuyển Summary tabs; Cancel trở về Profile / primary party slot thay vì thêm handler riêng rời rạc. Mouse/touch vẫn dùng semantic buttons/selects.
- **Responsive/game presentation:** thêm Pokémon-style portrait, type chips, stat bars, move cards, party HP-like panels, sticky picker và responsive breakpoints. Missing per-species sprite vẫn có text fallback cho tới Asset Closure R3-99; không fetch runtime asset ngoài local path.
- **Testing/Gates:** thêm 5 regression test R3-97 cho Summary pages/tab state, full 25-nature UI, Moves/Loadout details, Party picker/swap contract và shared controller wiring. Focused UI/progression/client/battle gate **58/58** pass; `npm run check` pass với **490/490 profiles + 490/490 timelines**, foundation **277 forms**, M-A **213 + 59 = 272**, Mega M-A **59/59**; full regression **1075/1075** pass.
- **Next:** R3-98 chuyển Archive + Recruitment sang Pokédex-style grid/preview/filter/form tray, dùng cùng input/window system và canonical M-A IDs.

## Quyết định kế tiếp

Ưu tiên **beta loop trước full coverage**. Schema 3 hiện chạy end-to-end từ Recruitment → Training → Team → Preview → Battle cho cả Single/Double. Beta Slice v35 là active recruitable catalog (**213 Pokémon / 490 move / 180 ordinary Ability / 82 item**); Snow/Sandstorm + Icy Rock/Smooth Rock vẫn dùng weather foundation chung; Ability Hooks Wave 3–4 mở global reviewed coverage mà không tăng active catalog giả. Wave 4 thêm stat-drop immunity, shared Speed, ally aura/immunity, secondary-effect immunity, multihit-max và weather status cure; Wave 5 thêm switch-out cure/heal, deterministic random status cure và on-entry weather/stat/screen/ally lifecycle. Wave 6 thêm passive type-damage reduction, scoped accuracy-drop immunity, absorb-family type immunity response và deterministic contact retaliation/status/stat responses. Wave 7 thêm damaged-response/on-KO/end-turn/survival contracts cho Anger Point/Berserk/Justified/Moxie/Sand Spit/Speed Boost/Stamina/Sturdy/Toxic Debris/Water Bubble/Weak Armor, đồng thời harden fixed-damage contact response. Wave 8 thêm opponent stat-drop response, scoped Intimidate/volatile immunity, poisoned-target critical, Poison Heal residual replacement, Synchronize reflection và flinch response. Wave 9 thêm priority-immunity aura, ally status/stat protection, scoped status-type bypass, volatile accuracy, received-type damage modifier và weather/absorb composition cho Armor Tail/Queenly Majesty/Sweet Veil/Corrosion/Tangled Feet/Dry Skin/Flower Veil. Wave 10 thêm ally volatile protection, held-item suppression, grounding immunity, move-type conversion, outgoing contact/secondary effects, Berry suppression/restore, Scrappy type-immunity bypass, ally status cure, item-loss Speed state và seeded turn-order modifier cho Quick Draw/Gale Wings/Prankster/Stall. Wave 11 thêm weather suppression, target-relative late-action power, Berry-consumption heal, damage disable/charge state, sleep counter rate, item reveal, stat-drop reflection, deterministic random stat shift, powder/redirection immunity, target PP pressure, once-per-switch type change và entry fainted-ally snapshot. Wave 12 thêm generic stat inversion/copy, global move block, type redirection + immunity response, Berry-effect multiplier và opponent-stage ignore cho Contrary/Damp/Lightning Rod/Opportunist/Ripen/Unaware; Infiltrator vẫn fail-closed vì Substitute/Safeguard chưa có runtime foundation đầy đủ. Wave 13 mở shared item-consumption history/ownership transfer/end-turn lifecycle cho Cud Chew/Gluttony/Magician/Pickpocket/Pickup/Sticky Hold/Symbiosis, đồng thời tách rõ consumed item khỏi hostile/ally ownership loss để Harvest/Unburden không đọc sai state. Wave 14 mở transient dynamic Ability state cho Trace/Receiver/Mummy/Wandering Spirit: copy/replace/swap dùng cùng compiler, giữ item passives, restore original Ability ở switch-out và bắt ally faint xuyên direct damage/hazard/end-turn residual. Wave 15 thêm entry danger sensing cho Anticipation và generic indirect-damage immunity cho Magic Guard xuyên status/weather/seed/hazard/recoil/contact/item/protection lifecycle nhưng vẫn giữ direct move damage và Struggle exception. Wave 16 mở opponent-Ability bypass, reflectable status lifecycle, Substitute/Safeguard, field-driven type/form state và one-hit Disguise shield cho Mold Breaker/Magic Bounce/Infiltrator/Forecast/Mimicry/Disguise/Stance Change; spread status reflection được resolve per target và reflected action tự kiểm accuracy/evasion. Wave 17 thêm battle-only Transform/Illusion state tách khỏi build state, Imposter facing-slot entry transform, Transform Ability Start lifecycle, Hunger Switch/Aura Wheel form-dependent typing và Zero to Hero switch-out evolution; public/AI projection chỉ thấy Illusion appearance, không lộ hidden Ability state. Wave 18 chuyển sang move coverage và promote 76 move trên bốn family dùng shared runtime hiện có: priority attacks, direct damage, primary stat-stage status và damaging stat-secondary; targeting/priority/tags/chance đều được source-audit theo base Showdown + Champions override trước khi machine-readable promotion. Wave 19 promote thêm 55 move trên major-status/flinch secondaries, multihit, recoil, primary self-drop và self-secondary stat effects; self-secondary được tách khỏi target secondary để giữ đúng Shield Dust/Sheer Force/Contrary/Opportunist semantics. Waves 20–25 mở critical/recovery/reset, field-aware moves, status/type/stage manipulation, HP-cost/non-lethal damage, hazard secondary và stored-stat transforms. Waves 26–30 chuyển sang multi-family batches cho item ownership, Ability manipulation, binding/trap, persistent field, hazard cleanup, first-turn/target lock, Berry/two-turn lifecycle, rampage/PP/Stockpile/crash damage/Torment/forced grounding. Waves 31–32 bổ sung shared turn-history cho damage/stat/last-result/faint history, promote Assurance/Avalanche/Payback/Lash Out/Retaliate/Stomping Tantrum/Temper Flare/Alluring Voice/Burning Jealousy và retaliation family Counter/Mirror Coat/Metal Burst/Comeuppance cùng Focus Punch. Item Lifecycle Wave 8 thêm Binding Band và Shed Shell trên passive lifecycle chung; R3-75 đã đóng holder replacement-choice lifecycle và promote Eject Button trên cùng replacement/entry/resume path. Waves 33–35 tiếp tục bằng action-context/history theo lần vào sân, pending-action introspection, OHKO accuracy/damage path và party/recovery utility; promote Gigaton Hammer/Last Resort/Sucker Punch/Upper Hand, Fissure/Guillotine/Horn Drill/Sheer Cold, Rest/Heal Bell/Magnetic Flux. Waves 36–38 mở queue-reordering thật, transient Ability suppression, Imprison legality, Endure/shared stall gate, max-HP self damage, Charge move-type state, temporary/persistent type lifecycle, Heal Block và critical-cheer state; promote After You/Quash/Gastro Acid/Imprison, Endure/Steel Beam/Charge, Roost/Burn Up/Psychic Noise/Dragon Cheer. Waves 39–41 tiếp tục bằng dynamic terrain priority, ally Round chaining, consecutive-use power, one-turn move-type override, slot-bound delayed healing, dual-type effectiveness, dynamic category/contact, per-hit accuracy/power và pre-turn contact retaliation; promote Grassy Glide/Round/Fury Cutter/Electrify, Wish/Flying Press/Shell Side Arm, Triple Axel/Population Bomb/Beak Blast. Waves 42–44 mở shared Gravity field lifecycle/grounding/accuracy, weight-reduction state, target-stat snapshot healing, source-bound recurring stat drops và fixed three-turn sound lock; promote Autotomize/Gravity, Strength Sap/Syrup Bomb và Uproar, đồng thời nối Grav Apple vào Gravity power rule. Waves 45–47 thêm slot-bound Healing Wish trước entry hazards, Destiny Bond success-history/KO retaliation, Dragon Darts smart split và Shed Tail HP-cost + Substitute transfer qua shared switch lifecycle. Waves 48–49 thêm explicit Champions-unusable move contract cho tám legacy move, slot-bound Future Sight delayed attack và party-derived Beat Up hit-power schedule. Wave 50 đóng review cho tám move còn thiếu bằng explicit fail-closed contract; Wave 51 thêm gender/weight/Fling foundation và executable Attract/Fling/Low Kick/Grass Knot/Heavy Slam/Heat Crash. R3-75 dùng foundation đó để đóng Cute Charm/Rivalry/Heavy Metal/Light Metal, promote Eject Button và review đủ 81 Mega Stone. R3-76 promote Simple Beam/Baton Pass/Curse/Parting Shot; R3-77 promote Copycat/Instruct/Sleep Talk trên shared called-move executor và replacement-window pivot contract; R3-78–80 chuyển sang Mega-first content expansion; R3-81 đóng full legal learnset/Ability cho mọi base species đã có Mega và thêm fail-closed Mega/base completeness gate; R3-82 mở thêm sáu vertical-complete base+Mega pairs và giữ Mega Garchomp Z tách riêng do source conflict; R3-83 tăng batch lên 10 cặp Abomasnow/Absol/Altaria/Audino/Banette/Gallade/Gardevoir/Glalie/Houndoom/Lucario; R3-84 tiếp tục với 13 cặp Lopunny/Pidgeot/Sableye/Sharpedo/Slowbro/Tyranitar/Chandelure/Dragonite/Clefable/Froslass/Hawlucha/Starmie/Delphox; R3-85 mở 18 base species mới + 22 relations, gồm Raichu X/Y và alternate Absol/Garchomp/Lucario Z, đồng thời thêm gender gate cho Mega Meowstic. R3-86 bắt đầu non-Mega M-A expansion bằng 20 species vertical-complete và tách validator invariant để non-Mega complete không cần Mega relation. R3-87 tiếp tục bằng 25 species vertical-complete, nâng active Beta lên 108 Pokémon, foundation lên 172 forms và expanded-catalog ceiling lên 256 để đủ headroom cho 213 M-A species/form entries. R3-88 thêm 25 species vertical-complete nữa, nâng active Beta lên 133 Pokémon, foundation lên 197 forms và content-complete lên 129 species. R3-89 thêm tiếp 25 species vertical-complete, nâng active Beta lên 158 Pokémon, foundation lên 222 forms và content-complete lên 154 species. R3-90 khóa scope M-A thành 213 non-Mega + 59 Mega = 272 entries, retag năm Mega M-B/M-C ra khỏi M-A và đóng thêm 30 non-Mega entries, đưa active Beta v34 lên 184 Pokémon/472 move/163 Ability/82 item, foundation 248 forms và tổng M-A vertical-complete lên 243/272. Coverage hiện **862/862 reviewed**, **836/862 executable** mỗi format = 507 move/180 Ability/149 item; R7 FX active catalog hiện **490/490**. 9 move unavailable/legacy và 17 Mega Stone còn runtime-blocked đều có explicit fail-closed reason thay vì missing manifest.

## R3-72 — Mega Patch: Move Hooks Waves 48–49

- Promote **10 move** trong một batch thật sự lớn. Wave 48 đưa **Frustration, Hidden Power, Natural Gift, Pursuit, Return, Secret Power, Snatch và Telekinesis** vào explicit `unusable` contract vì chính snapshot Champions hiện đánh dấu chúng là không thể dùng. Command validator trả `MOVE_UNUSABLE`; direct resolver có fail-safe `reject-unusable-move`, không trừ PP và không ghi move history, nên coverage phản ánh đúng semantics hiện tại thay vì giả lập luật legacy.
- Wave 49 thêm **Future Sight** bằng slot-bound delayed attack: accuracy được resolve khi dùng, effect gắn vào target slot, tick trên use turn và nổ sau đúng hai lượt trên occupant hiện tại; source có thể đã switch/faint, hit không đi qua Protect/Endure nhưng vẫn dùng shared damage/Ability/item/Substitute path. End-turn orchestration resolve future attack trước các residual HP group theo slot-condition ordering.
- Wave 49 đồng thời thêm **Beat Up** bằng shared party-hit schedule. Handler lấy các party member còn HP và không có major status, đọc canonical species base Attack để tính từng hit `5 + floor(baseAtk/10)`, rồi tái sử dụng multi-hit damage path; server move runtime nhận read-only species catalog thay vì hardcode species/move table.
- Global reviewed coverage tăng **752 → 762/862** mỗi format: **502 move / 176 Ability / 84 item**; chỉ còn **14 move / 4 Ability / 82 item** fail-closed. 14 move còn lại tập trung ở gender (`Attract`), weight (`Grass Knot/Low Kick/Heat Crash/Heavy Slam`), Tera (`Tera Blast`), broad item mapping (`Fling`), missing Ability semantics (`Simple Beam`) và move replay/dynamic-target/state-transfer/replacement families (`Baton Pass`, `Copycat`, `Curse`, `Instruct`, `Parting Shot`, `Sleep Talk`). Active Beta v22 vẫn **12 Pokémon / 67 move / 16 Ability / 82 item**, Move FX **67/67**.
- Validation: Wave 48–49 **8/8** direct tests pass, focused delayed/multi-hit/accuracy/protection regression **46/46**, candidate validation **0 problem**, full suite **908/908** pass, 0 fail/skip/todo; `npm run check` hoàn tất compile/content/logic/Move-FX/source-syntax với **282 source files**, Beta v22 validate pass.

## R3-71 — Mega Patch: Move Hooks Waves 45–47

- Promote thêm **4 move** trên ba wave tập trung vào replacement/delayed-slot, KO retaliation và smart multi-target lifecycle. Wave 45 gồm **Healing Wish** và **Destiny Bond**: Healing Wish self-KO rồi gắn heal/status cure vào đúng side/slot, resolve trước entry hazards và chỉ consume khi entrant thật sự cần heal/cure; Destiny Bond arm tới lúc user bắt đầu move kế tiếp, KO direct attacker khi user bị hạ, bỏ qua Future Sight/Doom Desire và chỉ block lần dùng kế tiếp khi lần Destiny Bond trước **thành công**.
- Wave 46 thêm **Dragon Darts** bằng `smartSplit` trên shared accuracy/multi-hit path: Single hoặc chỉ còn một foe thì hai hit vào cùng target; Double với hai foe sống thì chia một hit mỗi target. Protect/miss của một smart target không redirect dart đó sang target còn lại.
- Wave 47 thêm **Shed Tail** trên shared pivot lifecycle: trả đúng `ceil(maxHP/2)`, cho threshold Berry kích hoạt trước switch, tạo Substitute `floor(maxHP/4)` cho replacement và chỉ transfer Substitute chứ không transfer stat stages/volatile khác. Move fail atomically nếu HP không đủ, đang có Substitute hoặc replacement không hợp lệ.
- Global reviewed coverage tăng **748 → 752/862** mỗi format: **492 move / 176 Ability / 84 item**; còn **24 move / 4 Ability / 82 item** fail-closed. Active Beta v22 vẫn **12 Pokémon / 67 move / 16 Ability / 82 item**, Move FX **67/67**. Future Sight/Baton Pass và các move copy/replay, weight/gender/friendship, Hidden Power/Tera hoặc replacement/state-transfer sâu tiếp tục fail-closed cho tới khi contract/data nền tương ứng đủ chắc.
- Validation: Wave 45–47 **14/14** pass sau edge hardening, focused regression **225/225**, candidate validation **0 problem**, full suite **900/900** pass, 0 fail/skip/todo; `npm run check` hoàn tất compile/content/logic/Move-FX/source-syntax với **279 source files**, Beta v22 validate pass.

## R3-70 — Mega Patch: Move Hooks Waves 42–44

- Promote thêm **5 move** trên ba wave dùng shared field/residual/state primitives. Wave 42 gồm **Autotomize** và **Gravity**: Autotomize dùng stat-stage path hiện có, chỉ giảm weight-state khi Speed thật sự thay đổi và xử lý đúng Contrary/stage cap; Gravity là field condition 5 lượt, force-ground Flying/Levitate/item-airborne targets, tăng accuracy theo canonical multiplier, hủy Magnet Rise/Telekinesis/airborne two-turn state và chặn các move mang Gravity restriction ở command validator.
- Wave 43 thêm **Strength Sap** và **Syrup Bomb**. Strength Sap snapshot Attack đã tính stage trước khi hạ một stage, heal đúng source của reflected status action và vẫn compose Heal Block/Magic Bounce/item lifecycle. Syrup Bomb tạo source-bound residual volatile, hạ Speed ở cuối đúng **3 lượt**, không refresh coating đang tồn tại và tự kết thúc nếu source rời field; residual stat drop đi qua shared `apply-stat-stages` nên giữ Ability/item response semantics.
- Wave 44 thêm **Uproar** bằng fixed three-turn rampage contract: random foe retarget dùng seeded runtime, sound/bypass-Substitute metadata, wake toàn bộ active sleeper, block mọi sleep application khi Uproar còn active, giữ move lock đủ ba connected use và kết thúc không confusion. Existing rampage family vẫn giữ behavior cũ; interruption event cho Uproar được tách riêng.
- Gravity còn được nối vào shared Ground effectiveness/grounded checks, accuracy handler và **Grav Apple** 1.5× power rule. `Curse` được review nhưng tiếp tục fail-closed vì Ghost/non-Ghost target mode đổi động trong khi command target contract hiện vẫn tĩnh; weight-based damage, gender/friendship, Hidden Power/Tera và deep state-transfer/replacement families cũng chưa được giả lập.
- Global reviewed coverage tăng **743 → 748/862** mỗi format: **488 move / 176 Ability / 84 item**; còn **28 move / 4 Ability / 82 item** fail-closed. Active Beta v22 vẫn **12 Pokémon / 67 move / 16 Ability / 82 item**, Move FX **67/67**.
- Validation: Wave 42–44 **12/12** pass, focused mechanics regression **286/286**, candidate validation **0 problem**, full suite **886/886** pass, 0 fail/skip/todo; `npm run check` hoàn tất toàn bộ compile/content/logic/Move-FX/source-syntax gate với **275 source files**, Beta v22 validate pass.

## R3-69 — Mega Patch: Move Hooks Waves 39–41

- Promote thêm **10 move** trên ba wave dùng shared-runtime primitives thay vì move-ID branch. Wave 39 gồm **Grassy Glide, Round, Fury Cutter và Electrify**: Grassy Glide lấy dynamic priority +1 khi user grounded trên Grassy Terrain; Round có ally chain/reorder pending action và power doubling khi nối chuỗi; Fury Cutter giữ consecutive-use power state 40 → 80 → 160; Electrify gắn one-turn next-move type override và được consume đúng khi target thực sự hành động.
- Wave 40 thêm **Wish, Flying Press và Shell Side Arm**. Wish lưu delayed heal theo **side/slot** nên replacement hiện tại ở slot nhận heal vào lượt sau; Flying Press đi qua một damage hit nhưng nhân đồng thời Fighting + Flying effectiveness; Shell Side Arm chọn physical/special theo projected damage formula, tie dùng seeded RNG, chỉ contact khi nhánh physical và vẫn dùng shared 20% poison secondary.
- Wave 41 thêm **Triple Axel, Population Bomb và Beak Blast**. Multi-hit runtime hỗ trợ per-hit accuracy cùng power schedule nên Triple Axel dùng 20/40/60 và Population Bomb có thể dừng ngay ở hit miss bất kỳ; Beak Blast tạo heated volatile ở turn-order preparation, burn contact attacker trước khi user hành động và vẫn phản ứng nếu chính contact hit đó KO user, rồi clear state khi move được dùng.
- Global reviewed coverage tăng **733 → 743/862** mỗi format: **483 move / 176 Ability / 84 item**; còn **33 move / 4 Ability / 82 item** fail-closed. Active Beta v22 vẫn **12 Pokémon / 67 move / 16 Ability / 82 item**, Move FX **67/67**. Gender/weight/friendship/Tera/Hidden Power data dependencies, replacement-choice/state-transfer sâu và các move bị snapshot đánh dấu unavailable tiếp tục giữ fail-closed.
- Validation: Wave 39–41 **14/14** pass sau edge hardening, focused mechanics regression **246/246**, full suite **874/874** pass, 0 fail/skip/todo; `check:content`, logic contract, `compile-logic --verify`, Beta v22 và Move-FX **67/67** đều pass; syntax song song **391/391 JS/MJS** pass.

## R3-68 — Mega Patch: Move Hooks Waves 36–38

- Promote thêm **11 move** trên ba family dùng shared runtime. Wave 36 gồm **After You, Quash, Gastro Acid và Imprison**: turn engine cho phép handler reorder chính pending queue nhưng từ chối `queueOrderOverride` do client gửi; Gastro Acid dùng transient Ability suppression, giữ item passives và restore Ability gốc khi switch-out; Imprison chặn move trùng chỉ khi holder còn active.
- Wave 37 thêm **Endure, Steel Beam và Charge**. Endure dùng chung protection stall gate và clamp move damage lethal về 1 HP; Steel Beam trả đúng nửa max HP theo direct self-damage path kể cả khi miss; Charge tăng Sp. Def, gắn Electric-only damage multiplier và chỉ tiêu thụ state ở Electric move kế tiếp không phải Charge.
- Wave 38 thêm **Roost, Burn Up, Psychic Noise và Dragon Cheer**. Roost hồi 1/2 max HP rồi bỏ Flying tới end turn chỉ khi heal thật sự xảy ra; Burn Up yêu cầu Fire type, chỉ bỏ Fire sau hit và restore original typing khi switch; Psychic Noise dùng sound/bypass-Substitute secondary Heal Block hai lượt và chặn cả move/Ability/item/generic HP recovery path; Dragon Cheer lưu critical stage +2 cho Dragon ally, +1 cho ally khác và xung đột đúng với Focus Energy. Shared type-change lifecycle cũng được harden để các move đã support như Soak restore original types khi switch.
- Global reviewed coverage tăng **722 → 733/862** mỗi format: **473 move / 176 Ability / 84 item**; còn **43 move / 4 Ability / 82 item** fail-closed. Active Beta v22 vẫn **12 Pokémon / 67 move / 16 Ability / 82 item**, Move FX **67/67**. Weight/friendship/gender/Tera/Hidden Power families và Eject Button tiếp tục fail-closed khi authoritative data/lifecycle nền chưa đủ.
- Validation: Wave 36–38 **18/18**, focused mechanics regression **121/121**, content/logic/Beta/Move-FX gates đều pass. Full runner phát ra **814/814 `ok`, 0 `not ok`** khi dùng dependency tree khớp package-lock; process vẫn giữ handle sau khi phát hết test như các checkpoint R3-66/R3-67 nên không ghi nhận exit-code full-suite giả.

## R3-67 — Mega Patch: Move Hooks Waves 33–35

- Promote thêm **11 move** trên ba family dùng shared runtime. Wave 33 gồm Gigaton Hammer, Last Resort, Sucker Punch và Upper Hand; engine có entry-local move-use history, consecutive-use legality gate và pending-action introspection thay vì hardcode từng move. Switch-in reset đúng history theo lần vào sân, còn PP/history chỉ ghi khi move thật sự qua gate sử dụng.
- Wave 34 thêm **Fissure, Guillotine, Horn Drill và Sheer Cold** trên OHKO path riêng: level thấp hơn target fail, accuracy cơ sở tăng theo chênh level và bỏ accuracy/evasion stage math; Sheer Cold giữ rule riêng cho non-Ice user và Ice target. Sturdy có explicit OHKO block kể cả khi holder không full HP; Substitute nhận hit trước Ability block và Mold Breaker vẫn bypass target Ability qua shared opponent-ability contract.
- Wave 35 thêm **Rest, Heal Bell và Magnetic Flux**. Rest chữa status cũ, full-heal rồi áp sleep state theo shared status/item lifecycle; Heal Bell chữa cả party nhưng active Soundproof ally được miễn còn bench Soundproof vẫn được chữa; Magnetic Flux chỉ boost active Plus/Minus holder và fail-closed nếu không có target hợp lệ.
- Global reviewed coverage tăng **711 → 722/862** mỗi format: **462 move / 176 Ability / 84 item**; còn **54 move / 4 Ability / 82 item** fail-closed. Active Beta v22 vẫn **12 Pokémon / 67 move / 16 Ability / 82 item**, Move FX **67/67**. Weight-dependent Grass Knot/Low Kick/Heat Crash/Heavy Slam và gender/weight Ability vẫn chưa promote vì snapshot thiếu canonical data cần thiết.
- Validation: Wave 33–35 **15/15**, focused mechanics regression **108/108**, compile/content/logic/Move-FX/Beta gates đều pass và syntax của **18/18 source file thay đổi** pass. Full runner phát ra **796/796 `ok`, 0 `not ok`** sau khi dùng dependency tree theo package-lock; runner vẫn giữ handle và không tự trả summary/exit, cùng limitation đã quan sát ở R3-66 nên không ghi nhận exit-code full-suite giả.

## R3-66 — Move Hooks Waves 31–32 + Item Lifecycle Wave 8

- Promote thêm **14 move** trên hai family dùng shared runtime: Wave 31 gồm Assurance, Avalanche, Payback, Lash Out, Retaliate, Stomping Tantrum, Temper Flare, Alluring Voice và Burning Jealousy; Wave 32 gồm Counter, Mirror Coat, Metal Burst, Comeuppance và Focus Punch. Active Beta v22 không đổi nên không tăng catalog/FX giả khi relation chưa được promote.
- Thêm `mechanics-v3/turn-history.mjs` làm primitive dùng chung cho damage cùng lượt, damage theo source→target, stat tăng/giảm trong lượt, kết quả move lượt trước, ally faint ở lượt trước và damaging hit gần nhất theo category/source side/source slot. Counter/Mirror Coat/Metal Burst/Comeuppance dùng cùng prepared-retaliation contract và target slot của attacker; vì vậy pivot không làm mất semantics scripted target. Focus Punch dùng cùng hit history để fail khi đã nhận damaging move trước action.
- Item Lifecycle Wave 8 promote **Binding Band** và **Shed Shell**. Binding Band nâng bind residual của holder nguồn lên 1/6 và vẫn tôn trọng held-item suppression/Magic Room; Shed Shell bypass bound/generic trapped khi switch nhưng không bỏ qua Ingrain/Fairy Lock. **Eject Button** giữ fail-closed vì engine hiện chưa có lifecycle chọn Pokémon thay thế cho chính holder giữa lượt; Mega Stones tiếp tục chờ relation/form review.
- Global reviewed coverage tăng **695 → 711/862** mỗi format: **451 move / 176 Ability / 84 item**; còn **65 move / 4 Ability / 82 item** fail-closed. Active Beta v22 vẫn **12 Pokémon / 67 move / 16 Ability / 82 item**, Move FX vẫn **67/67**.
- Regression mới: Wave 31 + Item Wave 8 **9/9**, Wave 32 **6/6**, focused mechanics regression **175/175**. `check:content`, `check-logic` và Move FX gate đều pass; source syntax kiểm độc lập **251/251** file pass. Wrapper `npm run check` vẫn chạm timeout ở sequential source-syntax sweep giống baseline R3-65, không phát sinh assertion failure trước điểm timeout. Full `npm test` phát ra **781 test đều `ok`** nhưng runner chưa trả summary/exit trước timeout, nên chưa ghi nhận gate full-suite là pass tuyệt đối.

## Integration 16/09/2026 — Merge patch chain R3-55 → R3-65

- Đã audit và gộp tuần tự 11 patch Wave 20–30. Mỗi patch chỉ chứa file project dưới `app/` và hai tài liệu tham khảo; không có checksum hay metadata cần chép vào repo. Toàn bộ 44 JSON parse hợp lệ, 158 JS/MJS trong các bundle qua syntax check và file app cuối khớp hash với snapshot R3-65.
- Mỗi wave đều qua `npm run check` và test riêng trước khi nhận wave kế tiếp: Wave 20 **5/5**, 21 **7/7**, 22 **8/8**, 23 **8/8**, 24 **9/9**, 25 **9/9**, 26 **10/10**, 27 **11/11**, 28 **14/14**, 29 **14/14**, 30 **14/14**. `npm run beta:validate` cũng đạt tại các checkpoint Wave 22, 26 và 30.
- Move Waves 20–30 thêm **173 move reviewed**, nâng global coverage từ **522 lên 695/862** mỗi format: **437 move / 176 Ability / 82 item**. Còn **79 move / 4 Ability / 84 item** fail-closed; active Beta v22 giữ **12 Pokémon / 67 move / 16 Ability / 82 item** và Move FX **67/67**.
- Runtime mới bao phủ critical/recovery/reset, field-aware moves, type và stat manipulation, HP-cost/non-lethal damage, item transfer/consumption history, dynamic Ability state, binding/trap/persistent field effects, hazard cleanup, first-turn/target lock, two-turn/Berry lifecycle, rampage/PP/Stockpile/crash damage/Torment/forced grounding. Các hành vi được tách thành capability handlers nhỏ; `item-hooks.mjs` và `passive-handler-validation.mjs` vượt ngưỡng gợi ý 400 dòng nhưng vẫn giữ đúng một trách nhiệm, nên không cắt cơ học làm tăng coupling.
- Browser QA dùng room local biệt lập `patch-merge-r3-65-qa`: Command Center tải đúng Beta v22; Double Preview khóa đúng bốn Mon của team hiện hành. Turn thật resolve bốn opportunity theo Speed: Feraligatr 143 dùng Flip Turn và hoàn tất replacement → Decidueye 134 dùng Brave Bird → Venusaur 132 bị cancel sau faint → Blastoise 130 dùng Water Spout lên hai target; Battle Log ghi đủ PP, power, damage, effectiveness, faint/replacement và console không có warning/error.
- Gate tích hợp: source syntax **249 file**, candidate/content/logic/FX checks đều đạt; full regression **812/812**, 0 fail/skip/todo. Source contract tiếp tục bám Regulation M-A chính thức và Pokémon Showdown commit đã pin `aa17ca0fac8bc5605df673bd8774c2d0e91efa43`.

## Integration 14/09/2026 — Merge patch chain R3-18 → R3-31

- Đã audit và gộp tuần tự 13 changed-files bundle từ Beta Slice v5 đến v16. Mỗi mốc catalog được chạy `npm run check` và full suite trước khi nhận patch kế tiếp; test count tăng từ 299 lên 424 trước phần sửa integration.
- Bundle R3-19 không có trong thư mục người dùng cung cấp, nhưng R3-21 đã phụ thuộc export Psychic Terrain của nó. Contract thiếu được truy vết từ snapshot tích lũy R3-24; bản cuối dùng nguyên implementation terrain hoàn chỉnh của snapshot sau và qua toàn bộ terrain/protection/hazard regression.
- `npm run check` cũ dài 8.170 ký tự và vượt giới hạn command line Windows khi R3-27 nối thêm source. Đã thay danh sách `node --check` thủ công bằng `scripts/check-source-syntax.mjs`, duyệt cùng các source tree theo từng process và hiện kiểm 183 file.
- Browser QA dùng room local biệt lập `patch-merge-v16-qa`: catalog rebase đúng v16; Training hiện đúng move/Ability/item theo relation; lưu được Feraligatr với Sheer Force + Waterfall + Lum Berry; Team Builder và Single Preview giữ đúng build; turn thật chạy sang turn 2, FX/HP/PP theo authoritative timeline và console không có warning/error.
- QA browser phát hiện `abilityTriggered` đang rơi xuống fallback `AbilityTriggered.`. Formatter và regression test đã được bổ sung cho Ability hooks cùng các event status/volatile/protection/switch/replacement mới, nên Battle Log hiện ghi rõ ví dụ “Feraligatr's Sheer Force boosted Waterfall and suppressed 1 secondary effect.”
- Gate tích hợp cuối: `npm run check`, `npm run beta:validate`, candidate/inventory/coverage generators và full suite **425/425** đều đạt; Single/Double coverage = **169/862**, Move FX = **65/65**.

## Integration 14/09/2026 — Merge patch chain R3-33 → R3-44

- Đã audit bảy thư mục patch mới và gộp theo năm mốc phụ thuộc: R3-33, R3-34, R3-35, cumulative R3-36→39 và cumulative R3-40→44. Checkpoint R3-39 độc lập trùng hoàn toàn với cumulative R3-36→39; checkpoint R3-40 độc lập đã được cumulative R3-40→44 thay thế nên không áp dụng chồng lần hai.
- Mỗi mốc catalog đều qua `npm run check`, `npm run beta:validate` và full suite trước khi nhận mốc kế tiếp: v18 **446/446**, v19 **453/453**, v20 **475/475**, v22 sau R3-39 **524/524**, và R3-44 **567/567**.
- Active catalog cuối là **Beta Slice v22 = 12 Pokémon / 67 move / 16 Ability / 82 item**; runtime Mega bổ sung Thick Fat và Venusaurite. Global reviewed coverage đạt **325/862** mỗi format, gồm **129 move / 114 Ability / 82 item**; Move FX đạt **67/67**.
- Giữ nguyên script syntax checker dạng đệ quy để tránh giới hạn command line trên Windows. Các formatter Battle Log tích hợp trước đó cho Ability lifecycle, Life Orb, Rocky Helmet và Shell Bell vẫn còn nguyên và regression test tiếp tục pass.
- Source audit đối chiếu Regulation M-A chính thức và source Pokémon Showdown đã pin tại commit `aa17ca0fac8bc5605df673bd8774c2d0e91efa43` cho Ability, item và condition contracts; content ngoài manifest đã review tiếp tục fail-closed.
- Browser QA dùng room local biệt lập `patch-merge-v22-qa`: Command Center báo đúng v22; Training hiển thị đủ 82 item gồm Choice Scarf, White Herb, Quick Claw, Icy Rock và Smooth Rock; Single Preview khóa đúng team hiện hành. Một turn thật xác nhận Feraligatr Speed 143 dùng Flip Turn trước Venusaur Speed 132, chuyển Decidueye, rồi Giga Drain mới chạy FX/damage/heal theo timeline; Battle Log đọc được và console không có warning/error.

## Integration 15/09/2026 — Merge patch chain R3-45 → R3-54

- Đã audit và gộp tuần tự 10 changed-files bundle. Bundle R3-45→53 dùng project root lồng `AetherChampions/`; R3-54 dùng root `files/`; chỉ file project được áp dụng, checkpoint/format-patch/filelist không bị chép vào repo. Tất cả JSON parse hợp lệ, JS/MJS qua syntax check và checksum R3-54 khớp toàn bộ tám file đã khai báo.
- Mỗi mốc đều qua `npm run check`, `npm run beta:validate` và full suite trước khi nhận patch tiếp theo: R3-45 **583/583**, R3-46 **601/601**, R3-47 **610/610**, R3-48 **622/622**, R3-49 **633/633**, R3-50 **645/645**, R3-51 **666/666**, R3-52 **683/683**, R3-53 **692/692**, R3-54 **703/703**.
- Ability Waves 10–17 mở thêm 62 Ability bằng shared contracts cho turn order, suppression, transfer/copy/swap, indirect damage, reflection, form/transform và hidden appearance. Move Waves 18–19 mở thêm 131 move đã review trên các family damage, priority, stat stage, status/flinch secondary, multihit và recoil.
- Global reviewed coverage cuối đạt **522/862** mỗi format, gồm **264 move / 176 Ability / 82 item**; active Beta v22 giữ **12 Pokémon / 67 move / 16 Ability / 82 item** và Move FX **67/67** vì batch này chưa thay promoted player catalog.
- Audit bảo trì tách schema validator khỏi `passive-effects.mjs`: runtime modifier compiler còn 41 dòng trong file trách nhiệm riêng, còn validation chuyển sang `passive-handler-validation.mjs`. Toàn bộ 703 test tiếp tục pass sau refactor.
- Source audit tiếp tục khóa Regulation M-A chính thức và Pokémon Showdown commit `aa17ca0fac8bc5605df673bd8774c2d0e91efa43`; Champions override trong candidate được ưu tiên khi khác base move data, content chưa đủ gender/weight data tiếp tục fail-closed.
- Browser QA dùng room local biệt lập `patch-merge-r3-54-qa`: Command Center tải đúng Beta v22 và Double Preview giữ đúng team hiện hành. Turn thật resolve bốn opportunity theo Speed: Feraligatr 143 → Decidueye 134 → Venusaur 132 bị cancel sau faint → Blastoise 130; Flip Turn replacement hoàn tất trước action kế tiếp, Water Spout áp dụng riêng cho hai target theo ordered timeline, Battle Log đọc được và console không có warning/error.



## R3-54 — Move Hooks Wave 19 mega-patch: status, flinch, multihit, recoil và self-effects

- Status: IMPLEMENTED / AUTOMATED GATE PASSED.
- Ngày: 15/09/2026
- Scope: promote **55 move** bằng shared runtime: **20 damaging major-status moves**, **10 flinch-secondary moves**, **4 multihit moves**, `Wave Crash` recoil, **10 primary self-drop attacks** và **10 damaging self-secondary stat-boost moves**. Không thêm per-move branch trong battle loop.
- Secondary foundation: damaging major-status/flinch tiếp tục đi qua target secondary resolver với intrinsic immunity, Shield Dust và deterministic RNG. Self-secondary được tách thành `target: self`, chỉ chạy một lần sau successful hit, không bị target Shield Dust chặn và vẫn bị Sheer Force suppress khi đúng điều kiện.
- Multihit/recoil: Bone Rush/Pin Missile/Tail Slap/Water Shuriken dùng shared seeded hit-count resolver; Skill Link ép đủ 5 hit và Water Shuriken giữ priority +1. Wave Crash dùng shared recoil path nên Magic Guard chặn recoil nhưng không chặn direct damage.
- Self-stage lifecycle: Close Combat/Draco Meteor/Leaf Storm... dùng primary self-stage path có `requireDamage`, tiếp tục compose với Contrary và White Herb; Torch Song/Charge Beam/Flame Charge... dùng self-secondary path và compose với Contrary/Opportunist.
- Tag/interaction audit: sound/bullet/pulse/punch/slicing/bite/contact metadata tiếp tục tái sử dụng Soundproof, Bulletproof, Mega Launcher, Iron Fist, Sharpness, Strong Jaw và Substitute sound bypass; Sheer Force vẫn suppress secondary mà không suppress primary self-drop.
- Content: active catalog giữ **Beta Slice v22 = 12 Pokémon / 67 move / 16 Ability / 82 item**. Move inventory = **516 / 264 manifest-reviewed / 252 pending**.
- Coverage: **522 supported / 340 blocked** mỗi format; breakdown = **264 move / 176 Ability / 82 item**. Machine-readable coverage tăng đúng **+55 entries** từ R3-53.
- Validation: focused Wave 19 **11/11** pass (data-driven trên đủ 55 move); cross-family regression **146/146** pass; candidate validation **0 problem**; `npm run check` pass (**211 source files**, Move FX **67/67**); Beta v22 validate pass; full suite pre-commit **703/703** pass, 0 fail/skip/todo.
- Boundary/next: còn **252 move** và **84 item** chưa manifest-reviewed, cùng 4 Ability phụ thuộc gender/weight data. Tiếp tục ưu tiên move/item family có shared-runtime leverage cao trước khi mở mechanic cần state/data mới.

## R3-53 — Move Hooks Wave 18 mega-patch: priority, direct damage và stat-stage expansion

- Status: IMPLEMENTED / AUTOMATED GATE PASSED.
- Ngày: 15/09/2026
- Scope: promote **76 move** bằng các shared primitives đã có thay vì thêm per-move branch trong battle loop: **9 priority damaging moves**, **21 direct-damage moves**, **12 primary stat-stage status moves** và **34 damaging stat-secondary moves**. Manifest-reviewed move coverage tăng từ 133 lên 209.
- Priority/direct foundation: priority của Accelerock/Aqua Jet/Bullet Punch/Extreme Speed/Jet Punch/Mach Punch/Quick Attack/Shadow Sneak/Vacuum Wave đi qua authoritative turn queue nên vẫn giữ priority bracket + dynamic Speed ordering; direct-damage family tái sử dụng accuracy/damage/target resolver cho adjacent/anyAdjacent/spread/always-hit thay vì bypass pipeline.
- Stat-stage foundation: self/target primary boosts/drops dùng shared stage application nên tiếp tục compose với Contrary, Mirror Armor, Magic Bounce và protection rules; damaging secondaries dùng shared secondary-effect path nên chance, Sheer Force suppression và spread-target semantics vẫn deterministic.
- Tag/override audit: bullet/sound/pulse/punch/slicing/contact metadata được nối vào mechanics sẵn có cho Bulletproof, Soundproof, Mega Launcher, Iron Fist, Sharpness và Substitute sound bypass. Champions overrides được ưu tiên khi khác base data, gồm Moonblast **10%** Sp. Atk drop và slicing flags của Dragon Claw/Crush Claw.
- Content: active catalog giữ **Beta Slice v22 = 12 Pokémon / 67 move / 16 Ability / 82 item**; Wave 18 chỉ mở global reviewed coverage, không tăng active catalog giả. Move inventory = **516 / 209 manifest-reviewed / 307 pending**.
- Coverage: **467 supported / 395 blocked** mỗi format; breakdown = **209 move / 176 Ability / 82 item**. Machine-readable coverage tăng đúng **+76 entries** từ R3-52.
- Validation: focused Wave 18 **9/9** pass (data-driven trên đủ 76 move); cross-family regression **132/132** pass; candidate validation **0 problem**; `npm run check` pass (**211 source files**, Move FX **67/67**); Beta v22 validate pass; full suite pre-commit **692/692** pass, 0 fail/skip/todo.
- Boundary/next: còn **307 move** và **84 item** chưa manifest-reviewed, cùng 4 Ability phụ thuộc gender/weight data. Tiếp tục ưu tiên các move/item family có shared-runtime leverage cao (major status, volatile/self secondary, recoil/drain, item interaction...) trước khi mở mechanic cần state/data mới.


## R3-52 — Ability Hooks Wave 17 mega-patch: transform, illusion và battle-only form lifecycle

- Status: IMPLEMENTED / AUTOMATED GATE PASSED.
- Ngày: 15/09/2026
- Scope: promote **4 Ability + 2 move mechanics** bằng shared battle-state contracts: `Illusion`, `Imposter`, `Hunger Switch`, `Zero to Hero`, cùng `Transform` và `Aura Wheel`. Không ghi đè build/profile gốc để mô phỏng battle-only state và không tăng active Beta slice giả.
- Transform/Imposter lifecycle: `Transform` snapshot combat state gốc, copy non-HP combat profile, stages, current moves + PP capped 5 và active Ability/passives của target nhưng giữ current/max HP và held item của source; command validation đọc transformed move IDs. State restore khi switch-out. `Imposter` dùng cùng primitive trên shared entry lifecycle và trong Double chỉ chọn foe ở facing slot, không fallback sang slot khác khi ô đối diện trống.
- Copied Ability Start: khi Transform thực sự đổi Ability, shared Ability-start resolver chạy ngay với trigger `transform`, nên copied entry/start effect như Intimidate được kích đúng một lần thay vì chỉ thay passive snapshot. Restriction vẫn chặn target Substitute, active Illusion, fainted/self và already-transformed source/target.
- Illusion/privacy: Illusion giữ appearance state riêng (`species/name/sprite/types`) mà không sửa stats/types/Ability thật; chỉ vỡ khi actual damaging move/fixed damage chạm holder, không vỡ khi Substitute absorb. Opponent public view và AI projection chỉ thấy appearance, đồng thời hidden Illusion Ability/state được loại khỏi projection. Switch-out clear appearance state.
- Hunger Switch/Aura Wheel: end-turn form toggle đổi Morpeko Full Belly ↔ Hangry bằng shared form profile; Aura Wheel chọn Electric/Dark theo **current** form trước Ability-based type conversion và chỉ +1 Speed sau khi damage thành công. Transformed Morpeko copy Hunger Switch vẫn dùng current transformed form/state.
- Zero to Hero: Palafin đổi sang Hero Form khi switch-out qua generic `switch-out-form-change`, dùng profile **100/160/97/106/87/100** Water và giữ Hero Form khi quay lại sân tới hết battle; không reset như transient Transform state.
- Source audit/reference: PokeRogue được dùng để đối chiếu cách tách in-battle form/type/illusion state và metadata Ability copiable/replaceable/suppressable/ignorable; Pokémon Showdown được dùng để đối chiếu Transform restrictions, reset-on-switch behavior và semantics copied Ability `Start`. Không copy implementation; chỉ dùng như nguồn tham khảo để harden contract hiện có.
- Content: active catalog giữ **Beta Slice v22 = 12 Pokémon / 67 move / 16 Ability / 82 item**. Move inventory = **516 / 133 manifest-reviewed / 383 pending**.
- Coverage: **391 supported / 471 blocked** mỗi format; breakdown = **133 move / 176 Ability / 82 item**. Machine-readable coverage tăng đúng **+6 entries** từ R3-51.
- Validation: focused Wave 17 **17/17** pass; cross-family regression **140/140** pass; candidate validation **0 problem**; `npm run check` pass (**211 source files**, Move FX **67/67**); Beta v22 validate pass; full suite **683/683** pass, 0 fail/skip/todo.
- Boundary/next: còn đúng **4 Ability** fail-closed: `Cute Charm`, `Heavy Metal`, `Light Metal`, `Rivalry`. Candidate snapshot hiện không có authoritative gender/weight fields đủ để giải quyết semantics cho toàn roster; không tự bịa dữ liệu chỉ để tăng coverage.


## R3-51 — Ability Hooks Wave 16 mega-patch: suppression, reflection và form/type lifecycle

- Status: IMPLEMENTED / AUTOMATED GATE PASSED.
- Ngày: 15/09/2026
- Scope: promote **7 Ability + 2 move mechanics** bằng shared contracts: `Mold Breaker`, `Magic Bounce`, `Infiltrator`, `Forecast`, `Mimicry`, `Disguise`, `Stance Change`, cùng `Substitute` và `Safeguard`. `King's Shield` tiếp tục dùng reviewed mechanic cũ và chỉ được tái sử dụng làm acceptance surface cho Stance Change, không tính lại coverage.
- Opponent-Ability bypass: `opponent-ability-bypass` được propagate qua accuracy, damage, status, stat-stage, volatile, secondary/contact response và defensive Ability hooks. Mold Breaker xuyên Levitate, Sturdy, Multiscale, Disguise, status immunity và Magic Bounce nhưng không vô hiệu item semantics hay Ability của đồng minh.
- Reflection foundation: `status-move-reflect` xử lý targeted status và foe-side hazard mà reflector không tốn PP. Với spread status `allAdjacentFoes`, mỗi target resolve độc lập: non-bouncer vẫn nhận effect, từng Magic Bounce holder phản riêng về caster, và reflected action tự chạy accuracy/evasion check; Mold Breaker suppress reflection đúng target scope.
- Substitute/Safeguard: Substitute có HP riêng bằng 1/4 max HP, absorb damaging hit trước holder và chặn opposing status theo shared resolver; sound/Infiltrator bypass đúng primitive. Safeguard chặn opposing major status nhưng không chặn self-status; Infiltrator xuyên Substitute, Safeguard, Reflect và Light Screen bằng cùng side-condition/substitute bypass contract.
- Field type/form lifecycle: Forecast đọc effective weather nên Cloud Nine suppression trả về base type mà không xóa weather state; Mimicry theo terrain và restore captured base typing khi terrain kết thúc/switch-out. Stance Change đổi Aegislash Shield/Blade trước move theo profile, bảo toàn lượng HP đã mất và luôn trở về Shield Forme khi switch-out.
- Disguise lifecycle: hit damaging đầu tiên bị shield, Ability chuyển sang broken state và gây break cost 1/8 max HP; state broken tồn tại qua switch-out/back-in. Mold Breaker xuyên intact Disguise mà không tiêu one-time shield state.
- Content: active catalog giữ **Beta Slice v22 = 12 Pokémon / 67 move / 16 Ability / 82 item**; Wave 16 mở global reviewed coverage và hai reviewed move mechanic mới nhưng không bump active beta slice giả.
- Coverage: **385 supported / 477 blocked** mỗi format; breakdown = **131 move / 172 Ability / 82 item**. Move inventory = **516 / 131 manifest-reviewed / 385 pending**; machine-readable coverage tăng đúng **+9 entries** từ R3-50.
- Validation: focused Wave 16 **21/21** pass; cross-family regression **170/170** pass; candidate validation **0 problem**; `npm run check` pass (**208 source files**, Move FX **67/67**); Beta v22 validate pass; full suite **666/666** pass, 0 fail/skip/todo.
- Boundary/next: còn **8 Ability** fail-closed: `Cute Charm`, `Heavy Metal`, `Hunger Switch`, `Illusion`, `Imposter`, `Light Metal`, `Rivalry`, `Zero to Hero`. Gender-dependent Cute Charm/Rivalry và weight-dependent Heavy/Light Metal chỉ promote khi authoritative gender/weight data đủ; Illusion/Imposter và form-transition Hunger Switch/Zero to Hero cần state model riêng thay vì branch theo Ability name.


## R3-50 — Ability Hooks Wave 15 mega-patch: entry threat sensing và indirect-damage immunity

- Status: IMPLEMENTED / AUTOMATED GATE PASSED.
- Ngày: 15/09/2026
- Scope: promote **2 Ability** candidate bằng shared contracts: `Anticipation` và `Magic Guard`. `Mold Breaker`/`Magic Bounce` tiếp tục fail-closed vì suppression/reflection của chúng cần event-scoped Ability bypass và reflectable-move lifecycle rộng hơn; không promote bằng fixture hẹp.
- Entry threat sensing: `entry-danger-sense` đọc authoritative move IDs của active opponents từ build snapshot, tra move catalog và trigger Anticipation khi có damaging move super-effective hoặc OHKO. Status/neutral/resisted/immune move không báo sai; Double dùng cùng active-opponent scan và không thay battle state.
- Indirect damage foundation: `indirect-damage-immunity` chặn burn/poison/toxic residual, Sandstorm, Ability weather residual, Leech Seed drain, Stealth Rock/Spikes, ordinary recoil, damaging contact Ability response, Rocky Helmet, Life Orb và Spiky Shield retaliation. Ability/source activation provenance vẫn được giữ để replay/log không mất nguyên nhân.
- Boundary semantics: Magic Guard **không** chặn direct move damage; Struggle recoil vẫn gây damage theo direct-damage exception; Toxic Spikes vẫn có thể đặt poison và toxic counter vẫn tiến khi residual damage bị chặn. Non-damage contact effects không bị suppress chỉ vì holder có Magic Guard.
- Runtime wiring: initial entry, ordinary switch entry và replacement entry đều truyền move catalog vào shared entry lifecycle, nên Anticipation không phụ thuộc fixture-only path. Handler declarations/registry/manifest validation và public mechanics export đều dùng generic IDs thay vì Ability-name branch trong battle core.
- Content: active catalog giữ **Beta Slice v22 = 12 Pokémon / 67 move / 16 Ability / 82 item**; Wave 15 chỉ mở global reviewed coverage, không bump catalog giả.
- Coverage: **376 supported / 486 blocked** mỗi format; breakdown = **129 move / 165 Ability / 82 item**. Move inventory giữ **516 / 129 manifest-reviewed / 387 pending**; machine-readable coverage tăng đúng **+2 Ability** từ R3-49.
- Validation: focused Wave 15 **12/12** pass; cross-family regression **147/147** pass; candidate validation **0 problem**; `npm run check` pass (**204 source files**, Move FX **67/67**); Beta v22 validate pass; full suite **645/645** pass, 0 fail/skip/todo.
- Boundary/next: còn **15 Ability** fail-closed: `Cute Charm`, `Disguise`, `Forecast`, `Heavy Metal`, `Hunger Switch`, `Illusion`, `Imposter`, `Infiltrator`, `Light Metal`, `Magic Bounce`, `Mimicry`, `Mold Breaker`, `Rivalry`, `Stance Change`, `Zero to Hero`. R3-51 nên tiếp tục suppression/reflection (`Mold Breaker`, `Magic Bounce`, đánh giá lại `Infiltrator`) trước khi mở form/transform hoặc gender/weight family.

## R3-49 — Ability Hooks Wave 14 mega-patch: dynamic Ability copy / replace / swap lifecycle

- Status: IMPLEMENTED / AUTOMATED GATE PASSED.
- Ngày: 15/09/2026
- Scope: promote **4 Ability** candidate bằng shared transient Ability state: `Trace`, `Receiver`, `Mummy`, `Wandering Spirit`. Không branch theo tên Ability trong battle core; declaration/registry/compiler gọi các primitive copy/replace/swap dùng chung.
- Dynamic state: khi Ability active bị copy/replace/swap, original Ability được giữ trong `abilityState.transientAbility`; compiler chỉ thay passive effects nguồn Ability và giữ nguyên held-item passives. Switch-out chạy hook của Ability đang active trước, sau đó restore original Ability, nên ví dụ Trace → Natural Cure vẫn cure status trước khi trở lại Trace.
- Trace: chọn Ability đối thủ active bằng battle RNG deterministic trong Double, bỏ candidate form-defining/unsupported, copy xong kích ngay entry lifecycle của Ability mới (ví dụ Intimidate) và giữ replay provenance từ target bị copy.
- Receiver: copy Ability của ally thật sự faint khi holder còn active; shared faint-event resolver được nối vào direct/fixed damage, hazard entry, action queue callback, linked/major/weather residual và delayed end-turn paths để không phụ thuộc một damage handler hẹp.
- Contact replacement: Mummy replace Ability attacker sau damaging contact nhưng giữ item passives; Wandering Spirit swap Ability hai phía bằng cùng primitive. Cả hai state restore đúng khi Pokémon rời sân; unsupported/form-defining Ability tiếp tục fail-closed.
- Content: active catalog giữ **Beta Slice v22 = 12 Pokémon / 67 move / 16 Ability / 82 item**; Wave 14 chỉ mở global reviewed coverage, không bump catalog giả.
- Coverage: **374 supported / 488 blocked** mỗi format; breakdown = **129 move / 163 Ability / 82 item**. Move inventory giữ **516 / 129 manifest-reviewed / 387 pending**; machine-readable coverage tăng đúng **+4 Ability** từ R3-48.
- Validation: focused Wave 14 **11/11** pass; cross-family regression **118/118** pass; candidate validation **0 problem**; `npm run check` pass (**204 source files**, Move FX **67/67**); Beta v22 validate pass; full suite **633/633** pass, 0 fail/skip/todo.
- Boundary/next: còn **17 Ability** candidate fail-closed: `Anticipation`, `Cute Charm`, `Disguise`, `Forecast`, `Heavy Metal`, `Hunger Switch`, `Illusion`, `Imposter`, `Infiltrator`, `Light Metal`, `Magic Bounce`, `Magic Guard`, `Mimicry`, `Mold Breaker`, `Rivalry`, `Stance Change`, `Zero to Hero`. R3-50 ưu tiên suppression/bypass/reflection có thể dùng shared contracts; form/transform, gender và weight mechanics chỉ promote khi state/source đầy đủ.

## R3-48 — Ability Hooks Wave 13 mega-patch: item consumption và ownership lifecycle

- Status: IMPLEMENTED / AUTOMATED GATE PASSED.
- Ngày: 15/09/2026
- Scope: promote **7 Ability** candidate bằng một shared stateful item lifecycle: `Cud Chew`, `Gluttony`, `Magician`, `Pickpocket`, `Pickup`, `Sticky Hold`, `Symbiosis`. Batch này không thêm branch theo tên Ability; item consumption, delayed Berry replay, ownership transfer, removal immunity và end-turn pickup đều đi qua passive manifest/registry contracts.
- Consumption/history foundation: mọi consumable activation lưu item/effect snapshot + turn history trước khi item trở thành inactive. `Gluttony` dùng generic Berry threshold modifier, chỉ mở threshold 1/4 → 1/2 cho Berry; non-Berry không bị ảnh hưởng. `Cud Chew` lưu delayed replay snapshot và tái áp dụng supported Berry heal/status/PP effect đúng end-turn kế tiếp, kể cả holder đã nhận item mới qua Symbiosis.
- Ownership foundation: `transferHeldItem` chuyển cả item state lẫn compiled item passive effects, giữ authoritative provenance và đánh dấu donor là **item loss**, không giả thành consumption. `Sticky Hold` chặn hostile transfer ở primitive chung; `Symbiosis` pass item ngay khi active ally consume item và event attribution thuộc donor holder. Item bị chuyển quyền sở hữu không thể bị `Harvest` restore ở owner cũ, trong khi shared item-loss state vẫn kích đúng `Unburden`.
- Post-move foundation: `Magician`/`Pickpocket` resolve **một lần sau toàn bộ damage hits**, tránh multi-hit double-steal. Pickpocket chỉ chạy với damaging contact khi secondary-response layer không bị suppress; Magician lấy item từ damaged target khi user đang itemless. Multi-target candidate ordering dùng effective Speed + stable side/id tie-break, và mọi steal đều tái dùng Sticky Hold guard.
- End-turn foundation: `Pickup` đọc only current-turn consumed-item history, chọn deterministic bằng seeded battle RNG khi có nhiều candidate, chuyển item/effect snapshot sang holder itemless rồi đánh dấu history đã claim để hai Pickup không nhân đôi cùng item. `damaging-hit` destruction như Air Balloon không được đưa vào pickup pool.
- Semantic hardening: ownership loss có `lostReason` riêng; Harvest chỉ restore Berry thực sự consumed, không mọc lại Berry đã bị steal/pass. Cud Chew delayed state độc lập current held slot; Symbiosis provenance và transferred passive effects có regression riêng; Magician runtime integration được test qua `createMoveActionHandler`, không chỉ helper-level fixture.
- Coverage: **370 supported / 492 blocked** mỗi format; breakdown = **129 move / 159 Ability / 82 item**. Tăng đúng **+7 Ability** từ R3-47; candidate validation = 0 problems; còn **21 Ability** fail-closed (`Anticipation`, `Cute Charm`, form/copy/swap/ability-replacement families, Infiltrator, Magic Bounce/Guard, Mold Breaker, Rivalry và weight-dependent Heavy/Light Metal).
- Validation: focused Wave 13 **12/12**, item/Ability cross-family **147/147**; candidate validate 0 problem; inventory **516 move / 129 reviewed / 387 pending**; `mechanics:coverage` = **370/862** cả Single/Double; `beta:validate` v22 pass; `npm run check` pass với **203 source files** và Move FX **67/67**; full suite **622/622** pass, 0 fail/skip/todo.
- Boundary/next: R3-49 chuyển sang các family còn phụ thuộc ability-copy/replacement/form state (`Trace`, `Receiver`, `Mummy`, `Wandering Spirit`, `Imposter`, `Illusion`, `Disguise`, `Stance Change`, `Forecast`, `Mimicry`, `Hunger Switch`, `Zero to Hero`) hoặc battle primitives chưa đủ (`Magic Bounce`, `Magic Guard`, `Mold Breaker`, `Infiltrator`). `Heavy Metal`/`Light Metal` tiếp tục không promote cho tới khi canonical species weight được đưa vào authoritative build snapshot.
- Source cross-check: candidate vẫn là availability/description source; semantics của Cud Chew/Symbiosis/Magician được đối chiếu lại với Pokémon Showdown Ability handlers trong source audit trước final gate.

## R3-47 — Ability Hooks Wave 12 mega-patch: stat semantics, global block và type redirection

- Status: IMPLEMENTED / AUTOMATED GATE PASSED.
- Ngày: 15/09/2026
- Scope: mở thêm **6 Ability** candidate bằng shared contracts: `Contrary`, `Damp`, `Lightning Rod`, `Opportunist`, `Ripen`, `Unaware`. `Infiltrator` có prerequisite screen-bypass foundation nhưng **không promote** vì Substitute/Safeguard chưa được model đầy đủ; coverage tiếp tục fail-closed thay vì nhận nửa mechanic.
- Stat foundations: `stat-change-inversion` chạy trước clamp/block/reflect cho mọi stat-change path đã review; `opponent-stat-gain-copy` chỉ copy **applied positive delta** của đối thủ và tái dùng cùng stage clamp. Contrary được harden qua primary, secondary, entry/contact Ability, protection retaliation, terrain seed, damage/KO/end-turn response và cả stat drop bị Mirror Armor phản chiếu.
- Field/global foundations: Damp dùng `global-move-block` để chặn Explosion/Mind Blown/Misty Explosion/Self-Destruct sau PP spend và đồng thời suppress Aftermath; Lightning Rod dùng `type-redirection` chung, cạnh tranh holder ở cả hai phía theo effective Speed, rồi tái dùng `type-immunity-response` để chặn Electric hit và +1 Sp. Atk. Rules layer chỉ nhận comparator, còn battle-speed ordering nằm trong mechanics wrapper để tránh dependency ngược.
- Berry/stage foundations: Ripen dùng `berry-effect-multiplier` cho HP-threshold Berry heal, resistance Berry multiplier và Leppa PP restore; Unaware dùng `opponent-stage-ignore` để bỏ đúng opposing Attack/Defense/Sp. Atk/Sp. Def và Accuracy/Evasion stages theo attacking/defending role mà không xóa stage state thật.
- Content: active catalog giữ **Beta Slice v22 = 12 Pokémon / 67 move / 16 Ability / 82 item**; Wave 12 chỉ mở global reviewed coverage, không bump catalog giả.
- Coverage: **363 supported / 499 blocked** mỗi format; breakdown = **129 move / 152 Ability / 82 item**. Move inventory giữ **516 / 129 manifest-reviewed / 387 pending**; machine-readable coverage tăng đúng **+6 Ability** từ R3-46.
- Validation: focused Wave 12 **9/9** pass; cross-family regression **254/254** pass; candidate validation **0 problem**; `npm run check` pass (**201 source files**, Move FX **67/67**); Beta v22 validate pass; full suite **610/610** pass, 0 fail/skip/todo.
- Audit hardening: Lightning Rod multi-holder redirect được khóa bằng effective-Speed regression kể cả holder cùng phía với attacker; Ripen có Leppa ×2 regression; Contrary + Mirror Armor được khóa để reflected negative delta vẫn đi qua inversion trước stage application.
- Boundary/next: còn **28 Ability** candidate chưa reviewed: chủ yếu form/copy/swap/transfer (`Disguise`, `Forecast`, `Hunger Switch`, `Illusion`, `Imposter`, `Mimicry`, `Receiver`, `Stance Change`, `Trace`, `Wandering Spirit`, `Zero to Hero`), item lifecycle (`Cud Chew`, `Magician`, `Pickpocket`, `Pickup`, `Sticky Hold`, `Symbiosis`) và các special-condition family khác. Không promote family tiếp theo trước khi state model/lifecycle tương ứng đủ deterministic; `Light Metal` vẫn chờ canonical species weight data.

## R3-46 — Ability Hooks Wave 11 mega-patch: field suppression, reactive state và target lifecycle

- Status: IMPLEMENTED / AUTOMATED GATE PASSED.
- Ngày: 15/09/2026
- Scope: mở thêm **16 Ability** candidate bằng shared contracts: `Aftermath`, `Analytic`, `Cheek Pouch`, `Cloud Nine`, `Cursed Body`, `Early Bird`, `Electromorphosis`, `Frisk`, `Mirror Armor`, `Moody`, `Oblivious`, `Overcoat`, `Pressure`, `Protean`, `Stalwart`, `Supreme Overlord`.
- Field/action foundations: `weather-suppression` tách effective weather khỏi weather state để Cloud Nine vô hiệu modifier/residual mà không xóa/tạm dừng timer; `late-move-power-boost` xét trạng thái hành động của **selected target** cho Analytic; `target-pp-pressure` tính PP surcharge trên tập target thực tế; Stalwart và Overcoat dùng shared redirection metadata/immunity thay vì Ability-ID branch.
- Reactive/lifecycle foundations: Cheek Pouch nối vào Berry consumption; Cursed Body dùng seeded post-damage disable của move thực sự gây damage; Electromorphosis arm/consume charge state; Early Bird tăng sleep-counter rate; Frisk force-reveal item đang held kể cả khi effect item bị suppress; Protean lưu original types, đổi type trước damaging/status action hợp lệ đúng một lần mỗi switch và restore ở switch-out; Supreme Overlord snapshot số ally đã faint khi entry.
- Stat contracts: Mirror Armor phản chiếu opponent-caused negative stage trên primary, secondary, entry Ability (Intimidate) và contact Ability paths, đồng thời giữ White Herb/stat-drop-response ordering ở nguồn bị phản chiếu. Moody dùng battle RNG deterministic, chọn một combat stat +2 và một stat khác -1, loại Accuracy/Evasion. Oblivious behaviorally chặn Taunt và riêng Intimidate qua existing volatile/stat-drop immunity contracts.
- Content: active catalog giữ **Beta Slice v22 = 12 Pokémon / 67 move / 16 Ability / 82 item**; Wave 11 chỉ mở global reviewed coverage, không bump catalog giả.
- Coverage: **357 supported / 505 blocked** mỗi format; breakdown = **129 move / 146 Ability / 82 item**. Move inventory giữ **516 / 129 manifest-reviewed / 387 pending**; machine-readable coverage tăng đúng **+16 Ability** từ R3-45.
- Validation: focused Wave 11 **18/18** pass; cross-family regression **198/198** pass; candidate validation **0 problem**; `npm run check` pass (**199 source files**, Move FX **67/67**); Beta v22 validate pass; full suite **601/601** pass, 0 fail/skip/todo.
- Audit hardening: Analytic được sửa từ heuristic “last actor on field” sang target-relative action state; Mirror Armor được mở rộng qua bốn stat-drop delivery paths và Oblivious được nâng từ manifest-only assertion lên behavior test, tránh machine-readable coverage xanh bằng fixture hẹp.
- Boundary/next: còn **34 Ability** candidate chưa reviewed. Tiếp tục ưu tiên cluster có thể dùng shared contracts và deterministic lifecycle; suppression/copy/swap/trapping, Bound/mid-turn replacement-choice hoặc mechanic thiếu canonical source vẫn giữ fail-closed, `Light Metal` vẫn chờ species weight data.

## R3-45 — Ability Hooks Wave 10 mega-patch: suppression, conversion, lifecycle và turn-order

- Status: IMPLEMENTED / AUTOMATED GATE PASSED.
- Ngày: 15/09/2026
- Scope: mở thêm **16 Ability** candidate bằng shared contracts: `Aroma Veil`, `Klutz`, `Levitate`, `Pixilate`, `Refrigerate`, `Poison Touch`, `Stench`, `Quick Draw`, `Unnerve`, `Scrappy`, `Harvest`, `Healer`, `Unburden`, `Gale Wings`, `Prankster`, `Stall`.
- Generic foundation: thêm `ally-volatile-immunity`, `held-item-suppression`, `grounding-immunity`, `move-type-conversion`, `outgoing-secondary-effect`, `opponent-berry-suppression`, `type-immunity-bypass`, `end-turn-berry-restore`, `end-turn-ally-status-cure`, `item-loss-speed-boost`; `turn-order-modifier` dùng chung cho Quick Draw/Gale Wings/Prankster/Stall thay vì Ability-ID branch trong queue.
- Runtime/lifecycle: Iron Ball grounding override Levitate; Pixilate/Refrigerate đổi Normal sang Fairy/Ice rồi áp boost ×1.2 trong shared damage path; Scrappy bỏ riêng Ghost immunity cho Normal/Fighting và dùng stat-drop immunity scoped cho Intimidate; Unnerve chặn Berry activation nhưng không phá held item; Harvest restore Berry 50% và guaranteed trong Sun; Healer cure status cho ally sống với seeded 30%; Unburden ×2 Speed chỉ khi held item đã bị consume và mất multiplier khi item được restore.
- Secondary/order: Poison Touch chỉ roll trên contact hit gây damage; Stench bỏ roll nếu move đã có flinch secondary. Quick Draw seeded 30% chỉ đổi thứ tự trong cùng priority bracket; Gale Wings +1 cho Flying move khi full HP; Prankster +1 cho status move và chỉ bị Dark immunity khi nhắm **đối thủ** Dark; Stall nhận order boost âm để đi sau trong cùng bracket. Modified priority được truyền tiếp vào priority/terrain/protection contracts hiện có.
- Content: active catalog giữ **Beta Slice v22 = 12 Pokémon / 67 move / 16 Ability / 82 item**; không bump catalog vì Wave 10 chỉ mở global reviewed coverage.
- Coverage: **341 supported / 521 blocked** mỗi format; breakdown = **129 move / 130 Ability / 82 item**. Move inventory giữ **516 / 129 manifest-reviewed / 387 pending**; machine-readable coverage tăng đúng **+16 Ability** từ R3-44.
- Validation: focused Wave 10 **16/16** pass; cross-family regression **71/71** pass; candidate validation **0 problem**; `npm run check` pass (**197 source files**, Move FX **67/67**); Beta v22 validate pass; full suite **583/583** pass, 0 fail/skip/todo.
- Boundary/next: tiếp tục các Ability cần suppression/copy/swap/trapping, Bound hoặc mid-turn replacement-choice chỉ khi có shared/canonical contract tương ứng; `Light Metal` vẫn chờ canonical species weight data.

## R3-44 — Ability Hooks Wave 9 mega-patch: side aura, scoped immunity và conditional modifiers

- Status: IMPLEMENTED / AUTOMATED GATE PASSED.
- Ngày: 14/09/2026
- Scope: mở thêm **7 Ability** candidate bằng shared contracts: `Armor Tail`, `Queenly Majesty`, `Sweet Veil`, `Corrosion`, `Tangled Feet`, `Dry Skin`, `Flower Veil`.
- Side aura: `priority-move-immunity-aura` chặn move priority dương từ đối thủ nhắm holder/ally; `ally-major-status-immunity` và `ally-stat-drop-immunity` hỗ trợ selector type/source để Sweet Veil và Flower Veil dùng chung resolver thay vì Ability-ID branch.
- Scoped bypass/modifier: Corrosion dùng `status-type-immunity-bypass` chỉ cho poison/bad-poison lên Poison/Steel; Tangled Feet dùng `volatile-incoming-accuracy-modifier` khi confused; Dry Skin compose Water absorb-heal, Fire received-damage ×1.25, Rain heal 1/8 và Sun residual 1/8 trên các passive/weather contracts sẵn có.
- Ordering: priority aura chạy trước accuracy/damage; status/type immunity vẫn đi qua shared major-status path; Flower Veil chỉ chặn effect do Pokémon khác gây ra nên self-inflicted stat/status vẫn hợp lệ; Yawn truyền source vào cùng status-aura gate.
- Content: active catalog giữ **Beta Slice v22 = 12 Pokémon / 67 move / 16 Ability / 82 item**; không bump catalog vì Wave 9 chỉ mở global reviewed coverage.
- Coverage: **325 supported / 537 blocked** mỗi format; breakdown = **129 move / 114 Ability / 82 item**. Move inventory giữ **516 / 129 manifest-reviewed / 387 pending**.
- Validation: focused Wave 9 **8/8** pass; cross-family regression **136/136** pass; candidate validation 0 problem; `npm run check` pass (**194 source files**, Move FX **67/67**); Beta v22 validate pass; full suite **567/567** pass, 0 fail/skip/todo; machine-readable coverage xác nhận +7 Ability thật.

## R3-43 — Ability Hooks Wave 8 mega-patch: stat/status response và volatile immunity

- Status: IMPLEMENTED / AUTOMATED GATE PASSED.
- Ngày: 14/09/2026
- Scope: mở thêm **8 Ability** candidate bằng shared contracts: `Competitive`, `Defiant`, `Inner Focus`, `Own Tempo`, `Merciless`, `Poison Heal`, `Synchronize`, `Steadfast`.
- Stat response: `stat-drop-response` trigger một lần cho mỗi opponent lowering event dù nhiều stat bị hạ; chạy trên primary/secondary/contact/protection/entry paths trước White Herb. `stat-drop-immunity` có selector `sourceAbilities`, nên Inner Focus/Own Tempo chỉ chặn Intimidate còn stat drop thường vẫn hợp lệ.
- Volatile/critical: `volatile-immunity` chặn flinch/confusion trước RNG, gồm cả King's Rock; Steadfast boost Speed chỉ khi flinch thật sự consume action. Merciless force critical với poison/bad-poison nhưng critical-immunity vẫn ưu tiên và RNG stream vẫn được tiêu deterministic.
- Status lifecycle: Poison Heal thay poison/toxic residual bằng heal 1/8 max HP và không tăng toxic counter. Synchronize phản chiếu burn/paralysis/poison/bad-poison qua shared major-status rules, có reflection guard chống recursion và vẫn tôn trọng immunity/cure của nguồn.
- Content: active catalog giữ **Beta Slice v22 = 12 Pokémon / 67 move / 16 Ability / 82 item**; không bump catalog vì Wave 8 chỉ mở global reviewed coverage.
- Coverage: **318 supported / 544 blocked** mỗi format; breakdown = **129 move / 107 Ability / 82 item**. Move inventory giữ **516 / 129 manifest-reviewed / 387 pending**.
- Validation: focused Wave 8 **9/9** pass; cross-family regression **184/184** pass; candidate validation 0 problem; `npm run check` pass (**194 source files**, Move FX **67/67**); Beta v22 validate pass; full suite **559/559** pass, 0 fail/skip/todo.
- Boundary/next: tiếp tục Ability family có semantics hoàn chỉnh từ candidate/shared engine; suppression/copy/swap/replace, true mid-turn replacement-choice, trapping và các contract cần source data mới vẫn fail-closed.

## R3-42 — Ability Hooks Wave 7 mega-patch: damaged response, KO, survival và end-turn

- Status: IMPLEMENTED / AUTOMATED GATE PASSED.
- Ngày: 14/09/2026
- Scope: mở thêm **11 Ability** candidate bằng shared contracts: `Anger Point`, `Berserk`, `Justified`, `Moxie`, `Sand Spit`, `Speed Boost`, `Stamina`, `Sturdy`, `Toxic Debris`, `Water Bubble`, `Weak Armor`.
- Damage-response: một resolver generic nhận actual damage + authoritative breakdown để gate critical/type/category/HP-threshold, rồi thực hiện stage set/boost, weather hoặc hazard response. Weak Armor tái dùng White Herb reset path; Toxic Debris dùng shared hazard layer cap; Sand Spit dùng shared weather state.
- Survival/KO: Sturdy chạy trước held-item survival nên full-HP Sturdy không consume Focus Sash; multi-hit/fixed-damage đều đi qua cùng lethal-hit contract. Moxie chỉ boost attacker còn sống sau khi target thật sự faint.
- End-turn: Speed Boost lưu entry turn trong persistent `abilityState`, bỏ đúng turn vừa switch-in rồi +1 Speed ở các end turn sau; state nằm trong battle snapshot nên restart/replay deterministic.
- Composition: Water Bubble ghép `received-type-damage-reduction` cho Fire với `major-status-immunity` cho burn, không cần Ability-ID branch. Fixed-damage handler được harden để dùng chung Sturdy, damaged-response và contact-response của Wave 6.
- Content: active catalog giữ **Beta Slice v22 = 12 Pokémon / 67 move / 16 Ability / 82 item**; không bump catalog khi chỉ mở global reviewed coverage.
- Coverage: **310 supported / 552 blocked** mỗi format; breakdown = **129 move / 99 Ability / 82 item**. Move inventory giữ **516 / 129 manifest-reviewed / 387 pending**.
- Validation: focused Wave 7 **10/10** pass; cross-family regression **181/181** pass; candidate validation 0 problem; `npm run check` pass (**193 source files**, Move FX **67/67**); Beta v22 validate pass; full suite **550/550** pass, 0 fail/skip/todo.
- Boundary/next: tiếp tục các Ability damaged/turn/status family chỉ khi semantics đủ từ candidate/shared engine; suppression/copy/swap/replace, true mid-turn replacement-choice và trapping vẫn fail-closed.

## R3-41 — Ability Hooks Wave 6 mega-patch: type immunity, passive reduction và contact response

- Status: IMPLEMENTED / AUTOMATED GATE PASSED.
- Ngày: 14/09/2026
- Scope: mở thêm **14 Ability** candidate bằng shared contracts: `Heatproof`, `Thick Fat`, `Keen Eye`, `Illuminate`, `Water Absorb`, `Volt Absorb`, `Earth Eater`, `Motor Drive`, `Sap Sipper`, `Rough Skin`, `Flame Body`, `Static`, `Poison Point`, `Gooey`.
- Passive reduction: `Heatproof` và `Thick Fat` tái dùng `received-type-damage-reduction`; modifier nằm trong authoritative damage breakdown và không ảnh hưởng type ngoài selector.
- Scoped stat-drop immunity: `Keen Eye`/`Illuminate` dùng cùng `stat-drop-immunity` nhưng chỉ khóa `accuracy`, nên Attack/Defense/etc. vẫn bị hạ bình thường và self-drop không bị biến thành blanket immunity.
- Type immunity response: `Water Absorb`/`Volt Absorb`/`Earth Eater` block matching type trước accuracy/damage rồi hồi `floor(maxHP / 4)` nếu thiếu HP; `Motor Drive` và `Sap Sipper` dùng cùng contract để block rồi tăng Speed/Attack một stage. Không tiêu accuracy RNG cho hit đã bị Ability chặn.
- Contact response: resolver dùng chung chạy sau actual contact damage. `Rough Skin` gây `1/8` max HP lên attacker; `Flame Body`/`Static`/`Poison Point` dùng seeded 30% roll và shared major-status immunity; `Gooey` hạ Speed qua shared stat-drop/White Herb path. Contact đã bị Long Reach loại hoặc hit không gây damage không trigger.
- Architecture: hai declaration mới `type-immunity-response` và `contact-response` được validate ở manifest layer; battle core chỉ gọi generic resolver, không branch theo Ability ID. Contact RNG lấy runtime seeded stream nên restart/replay vẫn deterministic.
- Content: active catalog giữ **Beta Slice v22 = 12 Pokémon / 67 move / 16 Ability / 82 item**; Wave này chỉ tăng global reviewed mechanics coverage, không bump catalog giả.
- Coverage: **299 supported / 563 blocked** mỗi format; breakdown = **129 move / 88 Ability / 82 item**. Move inventory giữ **516 / 129 manifest-reviewed / 387 pending**.
- Validation: focused Wave 6 **7/7** pass; cross-family/registry regression **113/113** pass; candidate validation 0 problem; coverage generator nhận đúng +14 Ability. `npm run check` pass (**192 source files**, Move FX **67/67**); Beta v22 validate pass; full suite **540/540** pass, 0 fail/skip/todo.
- Boundary/next: ưu tiên damaged-response/on-faint/turn-order Ability family nếu có thể dùng shared lifecycle hiện tại; suppression/copy/swap/replace, trapping/Bound và `Light Metal` tiếp tục fail-closed khi foundation/source chưa đủ.

## R3-40 — Ability Hooks Wave 5 mega-patch: switch-out, on-entry và deterministic end-turn lifecycle

- Status: IMPLEMENTED / AUTOMATED GATE PASSED.
- Ngày: 14/09/2026
- Scope: mở thêm **12 Ability** candidate bằng lifecycle dùng chung: `Natural Cure`, `Regenerator`, `Shed Skin`, `Drizzle`, `Drought`, `Sand Stream`, `Snow Warning`, `Intimidate`, `Supersweet Syrup`, `Screen Cleaner`, `Curious Medicine`, `Hospitality`.
- Switch-out contract: manual switch, pivot và forced switch đều đi qua `applyMechanicsSwitch`; Natural Cure xóa major status trước shared switch reset, Regenerator hồi `floor(maxHP / 3)` trước khi rút khỏi active slot. Không nhân bản logic ở server/move handlers.
- End-turn RNG: Shed Skin dùng trực tiếp `battle.rngState`, consume đúng một seeded roll khi holder active có status và resolve trước major-status residual damage; JSON restart/replay vì thế giữ cùng kết quả.
- Entry contract: `resolveEntryAbilities` chạy trước held-item/hazard entry effects. Weather setters tái dùng shared weather duration nên matching weather rock vẫn kéo 5 → 8 turn; simultaneous entrants resolve theo effective Speed, slower setter chạy sau. Intimidate đi qua shared stat-drop immunity và White Herb resolver; Supersweet Syrup lưu persistent `abilityState` để chỉ trigger lần sent-in đầu tiên của battle.
- Double-only ally semantics: Curious Medicine reset stat stages của active ally nhưng không reset holder; Hospitality hồi 1/4 max HP cho active ally. Screen Cleaner xóa Reflect/Light Screen (và future Aurora Veil state nếu có) ở cả hai bên.
- Content: active catalog giữ **Beta Slice v22 = 12 Pokémon / 67 move / 16 Ability / 82 item**; Wave này chỉ tăng global reviewed mechanics coverage.
- Coverage: **285 supported / 577 blocked** mỗi format; breakdown = **129 move / 74 Ability / 82 item**.
- Validation: lifecycle focused **9/9** pass; cross-family regression **157/157** pass; candidate validation 0 problem; coverage generator nhận đủ +12 Ability; `npm run check` pass (**191 source files**, Move FX **67/67**); Beta v22 validate pass; full suite **533/533** pass, 0 fail/skip/todo.
- Boundary/next: ưu tiên passive damage/immunity families có thể tái dùng foundation hiện tại trước khi mở suppression/copy/swap, trapping/Bound hoặc replacement-choice phức tạp. `Light Metal` vẫn chờ canonical weight data.

## R3-39 — Ability Hooks Wave 4 mega-patch: stat-drop, ally interaction, Speed, multihit và end-turn cure

- Status: IMPLEMENTED / AUTOMATED GATE PASSED.
- Ngày: 14/09/2026
- Scope: mở thêm **13 Ability** candidate bằng shared contracts: `Clear Body`, `White Smoke`, `Hyper Cutter`, `Big Pecks`, `Quick Feet`, `Surge Surfer`, `Plus`, `Minus`, `Telepathy`, `Friend Guard`, `Shield Dust`, `Skill Link`, `Hydration`.
- Stat-stage contract: opponent-caused drops đi qua generic `stat-drop-immunity`; full-stat (`Clear Body`/`White Smoke`) và scoped-stat (`Hyper Cutter` Attack, `Big Pecks` Defense) dùng cùng path ở primary stat change, secondary stat drop và King's Shield retaliation. Self-drop vẫn hợp lệ và White Herb chỉ resolve khi stage thật sự bị hạ.
- Shared Speed: server queue và variable-power formulas dùng cùng `effectiveBattleSpeed`; `Quick Feet` tăng 1.5× khi có major status và bỏ paralysis Speed penalty, `Surge Surfer` tăng 2× trong Electric Terrain. Weather/item/side-condition modifiers tiếp tục compose qua một pipeline duy nhất.
- Double contracts: `Plus`/`Minus` chỉ tăng SpA khi matching ally đang active; `Telepathy` chặn damaging ally attack nhưng không chặn foe; `Friend Guard` giảm 25% damage lên ally, không bảo vệ chính holder. Không có hiệu ứng ally giả trong Single.
- Hit/secondary contracts: `Shield Dust` chặn move secondary và King's Rock-added flinch trước secondary RNG; `Skill Link` chọn max hit count cho ranged 2–5 multihit nhưng không thay fixed-hit contract. `Hydration` cure major status ở end turn trong Rain trước major-status residual group.
- Content: active catalog giữ **Beta Slice v22 = 12 Pokémon / 67 move / 16 Ability / 82 item**; Wave này chỉ tăng reviewed global mechanics coverage, không bump catalog khi 12 Pokémon beta không cần relation mới.
- Coverage: **273 supported / 589 blocked** mỗi format; breakdown = **129 move / 62 Ability / 82 item**. Move inventory giữ **516 / 129 manifest-reviewed / 387 pending**.
- Validation: focused Ability Wave 4 **34/34** pass; cross-family regression (stat/secondary/item/protection/multihit/variable-power/weather/server battle) **100/100** pass; candidate validation 0 problem; `npm run check` pass với 189 source files + Move FX 67/67; full suite **524/524** pass, 0 fail/skip/todo.
- Boundary/next: switch-out healing/cure (`Natural Cure`, `Regenerator`) và on-entry families là mục tiêu kế tiếp; suppression/copy/swap, trapping/Bound và mid-turn replacement-choice vẫn cần lifecycle riêng. `Light Metal` tiếp tục chờ canonical weight data.

## R3-38 — Ability Hooks Wave 3 mega-patch: static offense/defense, accuracy, immunity và hit rules

- Status: IMPLEMENTED / AUTOMATED GATE PASSED.
- Ngày: 14/09/2026
- Scope: mở thêm **26 Ability** có thật trong candidate M-A bằng shared handler families, không hard-code Ability ID vào damage/status pipeline và không bump Beta catalog chỉ để tăng số version: `Compound Eyes`, `Huge Power`, `Pure Power`, `Fur Coat`, `Strong Jaw`, `Sharpness`, `Tough Claws`, `Mega Launcher`, `Reckless`, `Super Luck`, `Shell Armor`, `Insomnia`, `Vital Spirit`, `Limber`, `Immunity`, `Magma Armor`, `Adaptability`, `Soundproof`, `Rock Head`, `Marvel Scale`, `Multiscale`, `Solid Rock`, `Purifying Salt`, `Hustle`, `No Guard`, `Guts`. `Battle Armor` được loại khỏi manifest sau coverage audit vì không tồn tại trong snapshot candidate hiện tại; fixture test không được dùng để làm xanh coverage.
- Shared modifiers: generic stat multiplier dùng chung cho Atk/Def và conditional status state; outgoing accuracy có selector theo move category; move-property boost tái dùng tags `bite`/`slicing`/`pulse`, contact và recoil metadata; received-damage modifier hỗ trợ full-HP và super-effective predicates; STAB modifier, critical-ratio/critical-immunity và recoil-immunity đều nằm trong declarative passive layer.
- Accuracy/hit ordering: `Compound Eyes` compose sau accuracy/evasion stages và trước target-local evasion modifier; `Hustle` chỉ giảm accuracy của physical move; `No Guard` force hit khi attacker hoặc target có Ability và bỏ semi-invulnerable miss gate nhưng vẫn không bypass Protect/Ability immunity.
- Status/damage contracts: Sleep/Paralysis/Poison/Freeze immunity families đi qua shared major-status block; `Purifying Salt` dùng cùng block cho mọi major status và 0.5× Ghost received damage. `Guts` yêu cầu major status, tăng Attack 1.5× và bỏ burn physical penalty; `Marvel Scale` chỉ tăng Defense khi status; `Multiscale` chỉ giảm damage ở full HP; `Solid Rock` chỉ áp dụng khi effectiveness > 1.
- Damage semantics: `Adaptability` dùng STAB 2×; `Super Luck` cộng critical stage trước held-item stage; `Shell Armor` chặn critical; `Rock Head` suppress move recoil nhưng không thay dealt damage. `Fur Coat`/Huge/Pure Power đi qua stat pipeline nên tiếp tục compose với stages, weather/item modifiers và critical-stage bypass theo cùng battle state.
- Content: active catalog giữ **Beta Slice v22 = 12 Pokémon / 67 move / 16 Ability / 82 item**; Mega runtime = **67 move / 17 Ability / 83 item**. Wave này là global reviewed mechanics coverage, không tự thêm Ability vào Training nếu relation của 12 Pokémon beta không dùng chúng.
- Coverage: **260 supported / 602 blocked** mỗi format; breakdown = **129 move / 49 Ability / 82 item**. So với weather baseline 234/862, Wave 3 tăng đúng +26 Ability candidate. Move inventory = **516 / 129 manifest-reviewed / 387 pending**.
- Validation: Ability/runtime focused regression + weather interaction **53/53** pass; candidate validate 0 problem; `npm run beta:validate` v22 pass; `npm run check` pass với **188 source files** và Move FX **67/67**; full suite **515/515** pass, 0 fail/skip/todo.
- Boundary/next: tiếp tục ưu tiên Ability family có shared contract rõ và candidate evidence thật; on-entry weather/intimidation, suppression/copy/swap/replace, trapping/Bound và mid-turn replacement-choice vẫn cần lifecycle riêng. `Light Metal` tiếp tục fail-closed vì snapshot chưa có canonical species weight.
- Source cross-check: Champions candidate là nguồn availability/description; Pokémon Showdown server commit khóa `aa17ca0fac8bc5605df673bd8774c2d0e91efa43` tiếp tục là mechanics/order cross-check cho Ability modifiers, critical/status/accuracy và recoil semantics.

## R3-37 / Beta 3-20 — Snow/Sandstorm weather foundation

- Status: IMPLEMENTED / AUTOMATED GATE PASSED.
- Ngày: 14/09/2026
- Scope: mở `Sandstorm` + `Snowscape`, `Icy Rock` + `Smooth Rock` và six weather Ability contracts `Sand Rush`, `Slush Rush`, `Ice Body`, `Sand Force`, `Sand Veil`, `Snow Cloak` trên weather engine hiện có.
- Field rules: Snow tăng Defense cho Ice; Sandstorm tăng SpD cho Rock và gây residual 1/16 lên active unit không thuộc Rock/Ground/Steel, resolve trước weather expiry. Weather-type boost/evasion/heal/speed/residual-immunity đều dùng declarative Ability hooks; held rocks chỉ kéo dài đúng matching weather và tiếp tục bị Magic Room suppress.
- Content: active base nâng lên **Beta Slice v22 = 12 Pokémon / 67 move / 16 Ability / 82 item**; Mega runtime = **67 move / 17 Ability / 83 item**; R7 FX = **67/67**.
- Coverage baseline sau weather = **234/862** mỗi format = **129 move / 23 Ability / 82 item**, tăng +10 supported entries so với Wave 7 (2 move + 6 Ability + 2 item).
- Validation: weather/runtime targeted regression pass và được cover lại trong cumulative full suite 515/515 ở R3-38; `npm run check`/`beta:validate` hiện đều xanh trên v22.
- Boundary: Snow/Sand blocker của Icy Rock/Smooth Rock đã được gỡ; Eject Button vẫn cần mid-turn replacement-choice, Binding Band/Shed Shell cần trapping/Bound, Light Metal cần canonical weight.

## R3-36 / Beta 3-19 — Item Lifecycle Wave 7 mega-patch: field, reactive, species và turn-order families

- Status: IMPLEMENTED / AUTOMATED GATE PASSED.
- Ngày: 14/09/2026
- Scope: promote **17 reviewed item** đang fail-closed thật sự mà không đổi default builds: `Air Balloon`, `Big Root`, bốn Terrain Seeds, `Iron Ball`, `Leppa Berry`, `Normal Gem`, `Red Card`, `Zoom Lens`, `King’s Rock`, `Metronome`, `Light Ball`, `Leek`, `Mental Herb` và `Quick Claw`. Batch không tính lại các item đã supported từ default build và không promote Mega Stone chỉ để tăng coverage.
- Field/consumable foundation: `Air Balloon` dùng shared airborne/grounding checks cho Ground immunity + grounded entry hazards và pop sau damaging hit; `Iron Ball` giảm Speed 0.5× và ép grounded, cả hai đều bị Magic Room suppress. Bốn Terrain Seeds consume đúng một lần trên matching Terrain để tăng Def/SpD; `Leppa Berry` restore 10 PP ở 0 PP và giải phóng state hợp lệ khi Magic Room kết thúc. `Big Root` nhân drain/Leech Seed recovery; `Normal Gem` consume sau target/protection/accuracy qualification nhưng trước damage để boost đúng một Normal move.
- Reactive/specialized foundation: `Red Card` consume sau damaging hit rồi dùng shared seeded forced-switch resolver, skip nếu attacker không có reserve hoặc move đã có native phazing. `Zoom Lens` đọc authoritative pending-turn state thay vì so raw Speed. `King’s Rock` roll seeded 10% flinch sau damage chỉ với damaging move không có flinch secondary sẵn; Sheer Force secondary suppression cũng suppress roll. `Metronome` lưu consecutive-move chain trong volatile switch-cleared state, tăng từ 1.0× theo +0.2 tới cap 2.0×.
- Species/status foundation: `Light Ball` dùng generic species-stat modifier để nhân đôi Pikachu Atk/SpA, kể cả confusion self-hit Attack path; `Leek` thêm +2 critical stages chỉ cho Farfetch’d/Sirfetch’d. `Mental Herb` consume một lần và xóa toàn bộ restrictive volatile được review (`infatuation`, `taunt`, `torment`, `disable`, `heal-block`, `encore`), đồng thời hỗ trợ deferred release sau Magic Room.
- Turn-order foundation: `Quick Claw` **không** giả thành move priority. Turn engine có internal `orderBoost` chỉ được tạo bởi deterministic preparation hook sau seeded queue setup; proc 20% đưa holder lên trước Speed/Trick Room ordering nhưng chỉ trong cùng move-priority bracket. Input bên ngoài không được phép spoof `orderBoost`; higher-priority move vẫn luôn đi trước. Successful proc reveal/activate item nhưng không consume; Magic Room suppress cả roll.
- Architecture hardening: King’s Rock flinch application được giữ dependency-neutral để tránh vòng import `item-hooks ↔ volatile-state`. Generic turn engine nhận optional `prepareTurnOrder` callback và không import mechanics, nên rules layer vẫn độc lập; suspended queue giữ action đã prepared qua restart/resume thay vì reroll Quick Claw.
- Content: Active base catalog = **Beta Slice v21, 12 Pokémon / 65 move / 16 Ability / 80 item**; Mega runtime = **65 move / 17 Ability / 81 item**. Move set không đổi, R7 FX vẫn **65/65**.
- Coverage: **224 supported / 638 blocked** mỗi format; breakdown = **127 move / 17 Ability / 80 item**. Tăng đúng +17 item so với v20, không mở move/Ability ngoài ý muốn.
- Validation: dedicated lifecycle regression **19/19**, focused cross-family integration **197/197**; candidate validate 0 problem; inventory **516 move / 127 reviewed / 389 pending**; `mechanics:coverage` = **224/862** cả Single/Double; `beta:validate` v21 pass; `npm run check` pass với **188 source files** và Move FX **65/65**; full suite **496/496** pass, 0 fail/skip/todo.
- Boundary/next: `Eject Button` tiếp tục fail-closed cho tới khi có mid-turn replacement-choice lifecycle có thể suspend → chọn replacement hợp lệ → resume mà không cho holder vừa eject tự vào lại. `Binding Band`/`Shed Shell` chờ trapping/Bound foundation; `Icy Rock`/`Smooth Rock` chờ Snow/Sandstorm weather families. Item transfer/loss/steal và `Light Metal` vẫn không được suy diễn; Light Metal chờ canonical species weight data.
- Source cross-check: Champions candidate khóa availability/description; Pokémon Showdown server commit `aa17ca0fac8bc5605df673bd8774c2d0e91efa43` tiếp tục là mechanics/ordering cross-check.

## R3-35 / Beta 3-18 — Item Hooks Wave 6 mega-batch: resistance + passive expansion

- Status: IMPLEMENTED / AUTOMATED GATE PASSED.
- Ngày: 14/09/2026
- Scope lớn: promote **33 reviewed item** từ Champions candidate trong một coherent item-mechanics batch, không đổi default builds. Batch gồm 17 typed super-effective resistance berries, `Chilan Berry`, chín canonical 20% type boosters, `Expert Belt`, `Wide Lens`, `Oran Berry`, `Bright Powder`, `Scope Lens` và `Focus Band`. Các family có lifecycle mới phức tạp vẫn cố ý fail-closed thay vì suy diễn.
- Resistance contract: shared `item-resist-hit` chạy trong direct-damage pipeline sau immunity/protection/accuracy gate. 17 typed berry yêu cầu đúng move type + effectiveness > 1 và nhân damage hit đầu đủ điều kiện với 0.5; Chilan áp dụng cho damaging Normal hit mà không yêu cầu super-effective. Item reveal/activate/consume authoritative trước damage; multi-hit chỉ giảm hit đầu vì state đã consumed. Magic Room suppress mà không reveal/consume; restart/replay giữ consumed state nên không kích lại.
- Passive damage/accuracy: chín type booster dùng lại generic `held-damage-boost` 1.2×; `Expert Belt` mở selector `superEffective` trên cùng pipeline và chỉ boost damaging hit có effectiveness > 1. `Wide Lens` dùng generic `item-accuracy-boost`, nhân effective accuracy 1.1× sau accuracy/evasion stages, cap 100; always-hit vẫn bỏ qua accuracy roll. Passive modifier không tự reveal item, và Magic Room suppress đúng shared held-item contract. `Bright Powder` dùng incoming 0.9× accuracy modifier trên cùng pipeline, vì vậy Wide Lens/Bright Powder compose trước một lần floor/cap mà không tạo item reveal.
- Threshold consumable: `Oran Berry` mở rộng `item-threshold-heal` để hỗ trợ heal amount cố định; ở <= 1/2 max HP hồi đúng 10 HP, trong khi Sitrus fraction behavior giữ nguyên. Reveal/consume/idempotency và timing tiếp tục dùng cùng authoritative threshold resolver. `Scope Lens` mở generic held-item critical stage (+1: 1/8 thay vì base 1/24) trong direct-damage critical roll; `Focus Band` mở probabilistic survival branch 10% seeded, không yêu cầu full HP và không consume, nên có thể roll lại ở lethal hit sau kể cả fixed damage.
- Content: Active base catalog = **Beta Slice v20, 12 Pokémon / 65 move / 16 Ability / 63 item**; Mega runtime = **65 move / 17 Ability / 64 item**. Move catalog không đổi nên R7 FX vẫn **65/65**.
- Coverage: **207 supported / 655 blocked** mỗi format; breakdown = **127 move / 17 Ability / 63 item**. Coverage tăng đúng +33 reviewed item; move/Ability support không bị mở ngoài ý muốn.
- Validation: dedicated Item Hooks **47/47**, schema-3 item runtime **25/25**, focused cross-family regression **142/142**; candidate validate 0 problem; inventory **516 move / 127 reviewed / 389 pending**; `mechanics:coverage` xác nhận 207/862 cho cả Single/Double; `npm run check` pass; `beta:validate` v20 pass; full suite **475/475** pass, 0 fail/skip/todo.
- Boundary/next: các item cần grounding/airborne state, forced switch, PP restoration, species-gated critical-ratio interactions, move-level spread receipts, item transfer/loss/steal hoặc trapping tiếp tục fail-closed để batch lớn vẫn reviewable. `Light Metal` vẫn chờ canonical species weight data.
- Source cross-check: Champions candidate khóa availability/description; Pokémon Showdown server commit khóa `aa17ca0fac8bc5605df673bd8774c2d0e91efa43` tiếp tục là mechanics/ordering cross-check.

## R3-34 / Beta 3-17 — Item Hooks Wave 5: White Herb negative-stage reset

- Status: IMPLEMENTED / AUTOMATED GATE PASSED.
- Ngày: 14/09/2026
- Scope: promote `White Herb` từ Champions candidate bằng shared passive hook `item-negative-stage-reset`; không đổi default builds. Resolver chỉ kích khi holder thực sự có ít nhất một battle stage âm, consume đúng một lần, đưa **toàn bộ stage âm về 0** và giữ nguyên stage không âm.
- Integration: primary `apply-stat-stages`, damaging secondary `stat-stages` và supported King's Shield retaliation đều gọi cùng resolver sau stat event thay vì hard-code theo move. Event reset tiếp tục dùng authoritative `statStageChanged` kèm `itemId`, nên replay/timeline không cần một event format riêng.
- Suppression/restart: Magic Room chặn activation/reveal/consume nhưng giữ stage âm; same-Room recast-off và natural expiry giải phóng White Herb ngay sau suppression. JSON restart giữ nguyên `itemState`/stage state và before-action item update phục hồi trường hợp state hợp lệ nhưng chưa resolve. Switch vẫn dùng lifecycle hiện có và reset stages/volatiles như trước.
- Content: Active base catalog = **Beta Slice v19, 12 Pokémon / 65 move / 16 Ability / 30 item**; Mega runtime = **65 move / 17 Ability / 31 item**. Move catalog không đổi nên R7 FX vẫn **65/65**.
- Coverage: **174 supported / 688 blocked** mỗi format; breakdown = **127 move / 17 Ability / 30 item**. Coverage tăng đúng +1 reviewed item.
- Validation: dedicated Item Hooks **34/34**, focused cross-family regression **100/100**, `npm run check` pass; `npm run beta:validate` v19 pass; full suite **453/453** pass, 0 fail/skip/todo.
- Boundary/next: Wave 6 ưu tiên **17 resistance berries** có mô tả candidate rõ ràng “halve first super-effective attack of type X, consumed after use”, vì chúng có thể dùng một shared super-effective damage interception + consume contract. Item loss/swap/steal và Heavy-Duty Boots tiếp tục fail-closed; `Light Metal` vẫn chờ canonical species weight data.
- Source cross-check: Champions candidate là nguồn availability/description của White Herb; Pokémon Showdown server commit khóa `aa17ca0fac8bc5605df673bd8774c2d0e91efa43` tiếp tục là architecture/mechanics cross-check cho held-item update/clear-negative-stage lifecycle.

## R3-33 / Beta 3-16 — Item Hooks Wave 4: Choice Scarf command-legality + switch-reset

- Status: IMPLEMENTED / AUTOMATED GATE PASSED.
- Ngày: 14/09/2026
- Scope lớn: promote `Choice Scarf` từ Champions candidate bằng hai passive item hook dùng chung: `item-speed-boost` cho effective Speed và `item-choice-lock` cho command legality. Candidate beta2 không có Choice Band/Choice Specs nên không suy diễn cả Choice family.
- Speed contract: Choice Scarf nhân **1.5× Speed** theo floor trong dynamic Speed pipeline, vì vậy thứ tự action được tính lại từ battle state hiện hành. Magic Room suppress modifier; passive Speed không tự reveal item cho đối thủ.
- Choice-lock contract: lock được tạo sau before-action gate khi holder thật sự bắt đầu move attempt; các move khác bị command validator từ chối bằng `CHOICE_LOCKED_MOVE_REQUIRED`, còn switch vẫn hợp lệ. Lock là volatile authoritative nên sống qua JSON restart/replay nhưng được shared `applySwitch` xóa cho manual/pivot/forced/replacement lifecycle. Magic Room chỉ suppress restriction và Speed, không xóa một lock cũ; move dùng trong lúc Magic Room đang active không tạo lock mới.
- UI/AI: UI disable move không khớp lock và nếu locked move hết PP nhưng còn reserve thì fallback sang switch thay vì dereference command rỗng. AI dùng cùng command validator; pivot candidate được validate với reserve tạm hợp lệ để giữ nguyên behavior chọn pivot trước đây.
- Content: Active base catalog = **Beta Slice v18, 12 Pokémon / 65 move / 16 Ability / 29 item**; Mega runtime = **65 move / 17 Ability / 30 item**. Move catalog không đổi nên R7 FX vẫn **65/65**.
- Coverage: **173 supported / 689 blocked** mỗi format; breakdown = **127 move / 17 Ability / 29 item**. Coverage tăng đúng +1 reviewed item.
- Validation: dedicated Item Hooks mechanics **30/30**, schema-3 item runtime **15/15**, cross-family room/switch/commitment regression **43/43**, server battle **10/10**, UI **12/12**, beta/catalog **11/11**; `npm run check` pass; `npm run beta:validate` pass; full suite **446/446** pass, 0 fail/skip/todo.
- Boundary/next: Wave 5 ưu tiên `White Herb` như consumable stat-reset ticket riêng. Choice Band/Choice Specs không có trong beta2 candidate; `Light Metal` vẫn chờ canonical species weight data; item loss/swap/steal và các item chưa có manifest tiếp tục fail-closed.
- Source cross-check: Champions candidate khóa availability/description; Pokémon Showdown server commit khóa `aa17ca0fac8bc5605df673bd8774c2d0e91efa43` được dùng để đối chiếu Choice Scarf multiplier, choice-lock và switch/item-suppression lifecycle.

## R3-32 / Beta 3-15 — Item Hooks Wave 3: post-damage owner/source family

- Status: IMPLEMENTED / AUTOMATED GATE PASSED; cumulative Beta v17 browser QA passed after integration.
- Ngày: 14/09/2026
- Scope lớn: mở rộng shared held-item pipeline bằng ba hook post-damage có owner/source rõ ràng rồi promote `Life Orb`, `Rocky Helmet`, `Shell Bell` từ Champions candidate; default builds không đổi. `held-damage-boost` được tổng quát hóa bằng selector `allDamaging` cho Life Orb thay vì hard-code type/category hay move ID.
- Life Orb: mọi damaging move đi qua damage pipeline nhận modifier **5324/4096**; sau move gây actual damage, holder nhận recoil **1/10 max HP** đúng một lần ở shared after-move phase. Sheer Force vẫn giữ Life Orb damage boost nhưng suppress AfterMoveSecondarySelf-style recoil; force-switch move cũng bỏ qua post-move recoil theo pinned Showdown contract. Magic Room suppress cả boost/recoil mà không reveal item.
- Rocky Helmet: mỗi successful damaging **contact hit** gây lại **1/6 max HP của attacker** qua authoritative HP group, kể cả hit vừa làm holder faint. Multi-hit re-read attacker trước từng hit nên nếu Helmet làm attacker faint thì các hit sau dừng. Long Reach/contact removal chặn Helmet; fixed-damage contact move cũng dùng cùng resolver. Retaliation damage chạy HP-threshold update nên Sitrus Berry của attacker có thể kích đúng sau Helmet.
- Shell Bell: after-move hook hồi **1/8 aggregate actual move damage** một lần, nên multi-hit/spread cộng damage trước khi heal; full-HP holder không reveal item. Sheer Force và force-switch move suppress hook này; Magic Room suppress mà không reveal.
- Ordering/replay: native recoil/drain/recharge và secondary handlers resolve trước; generic `resolve-after-move-items` chạy order 145; pivot/forced-switch chuyển sang order 150 để owner item resolve trước khi rời sân. Item reveal/activation tiếp tục dùng authoritative `itemState`/receipt của Wave 1, còn Rocky Helmet activation key gồm turn/holder/attacker/move/hit để per-hit idempotency vẫn deterministic.
- Content: Active base catalog = **Beta Slice v17, 12 Pokémon / 65 move / 16 Ability / 28 item**; Mega runtime = **65 move / 17 Ability / 29 item**. Move catalog không đổi nên R7 FX vẫn **65/65**.
- Coverage: **172 supported / 690 blocked** mỗi format; breakdown = **127 move / 17 Ability / 28 item**. Coverage tăng đúng +3 reviewed item; Choice lock, White Herb, resistance berries, item loss/swap/steal và Heavy-Duty Boots không bị suy diễn.
- Validation: dedicated Item Hooks mechanics **27/27** sau fixed-damage hardening, schema-3 item runtime **13/13**, focused cross-family regression **68/68**, beta/catalog gate **10/10**; `npm run check` pass; `npm run beta:validate` pass; full suite **438/438** pass, 0 fail/skip/todo.
- Browser QA local: catalog rebase đúng Beta Slice v17; Training hiển thị Life Orb/Rocky Helmet/Shell Bell; build Venusaur + Life Orb lưu và đi xuyên Team Preview vào trận. Giga Drain resolve damage/heal trước khi Life Orb reveal/activate/recoil 15 HP, turn tăng đúng một lần và console không có warning/error.
- Boundary/next: candidate hiện có `Choice Scarf` nhưng không có Choice Band/Choice Specs trong snapshot beta2, nên Wave 4 ưu tiên **Choice Scarf** + shared choice-lock command legality/switch-reset contract thay vì giả lập cả family. `White Herb` cũng có candidate và sẽ là consumable stat-reset ticket riêng. `Light Metal` vẫn chờ canonical species weight data.
- Source cross-check: Champions candidate là nguồn availability/description; Pokémon Showdown server commit khóa `aa17ca0fac8bc5605df673bd8774c2d0e91efa43` (`data/items.ts` + battle action ordering) được dùng để cross-check Life Orb, Rocky Helmet, Shell Bell và Sheer Force/force-switch interaction.


## R3-31 / Beta 3-14 — Item Hooks Wave 2: status-cure consumable family

- Status: IMPLEMENTED / AUTOMATED GATE PASSED; cumulative Beta v17 browser QA passed after integration.
- Ngày: 14/09/2026
- Scope lớn: mở rộng shared held-item state/event contract của R3-30 bằng hook `afterStatus` rồi promote bảy item Champions đã review: `Lum Berry`, `Cheri Berry`, `Chesto Berry`, `Pecha Berry`, `Rawst Berry`, `Aspear Berry`, `Persim Berry`. Default builds không đổi; item mới chỉ mở như Training choices.
- Cure contract: Cheri/Chesto/Pecha/Rawst/Aspear chỉ consume khi holder thật sự có status tương ứng; Pecha xử lý cả poison và bad poison. Persim chỉ chữa confusion. Lum có thể xóa đồng thời một major status và confusion bằng **một** activation/consume receipt; wrong-status holder không reveal/consume item. Major-status và confusion application đều gọi cùng authoritative status-cure resolver nên Toxic Spikes, Yawn và secondary status effects thừa hưởng hành vi mà không hard-code move/hazard.
- Suppression/lifecycle: Magic Room giữ berry bị suppress mà không reveal/consume. Khi Magic Room hết duration ở end-turn hoặc bị recast để tắt, resolver chạy ngay để cure trước action gate kế tiếp. `before-action` vẫn có fallback cho snapshot/restart cũ, bảo đảm eligible berry không để sleep/freeze/paralysis/confusion gate chạy trước item.
- Replay/state: activation tiếp tục dùng `itemRevealed` → `itemActivated` → `itemConsumed`, shared activation receipt và consumed state của R3-30 nên restart/replay không cure lần hai. Runtime schema-3 Single/Double compile item từ active catalog thật; opponent projection chỉ thấy identity sau reveal.
- Content: Active base catalog = **Beta Slice v16, 12 Pokémon / 65 move / 16 Ability / 25 item**; Mega runtime = **65 move / 17 Ability / 26 item**. Move catalog không đổi nên R7 FX vẫn **65/65**.
- Coverage: **169 supported / 693 blocked** mỗi format; breakdown = **127 move / 17 Ability / 25 item**. Coverage tăng đúng +7 reviewed item, không suy diễn Choice lock, damage/recoil item, item loss/swap/steal hay Heavy-Duty Boots.
- Validation: dedicated Item Hooks mechanics **20/20**, schema-3/catalog runtime **11/11**, broad status/volatile/secondary/Yawn/hazard/room/item regression **92/92**; `npm run check` pass; `npm run beta:validate` pass; full suite **424/424** pass, 0 fail/skip/todo.
- Boundary/next: Item Hooks Wave 3 ưu tiên **post-damage owner/source family** vì Champions candidate hiện có `Life Orb` (power + recoil), `Rocky Helmet` (contact retaliation) và `Shell Bell` (heal from actual damage). `Choice Scarf`/choice-lock tách ticket riêng vì phải nối command legality + switch reset; item loss/swap/steal, Heavy-Duty Boots và Light Metal vẫn fail-closed.
- Source cross-check: Champions candidate là nguồn availability/description cho bảy berries; Pokémon Showdown server commit khóa `aa17ca0fac8bc5605df673bd8774c2d0e91efa43` (`data/items.ts`) được dùng để cross-check trigger/cure/consume semantics.


## R3-30 / Beta 3-13 — Item Hooks Wave 1: recovery, consumable và survival

- Status: IMPLEMENTED / AUTOMATED GATE PASSED; cumulative Beta v17 browser QA passed after integration.
- Ngày: 14/09/2026
- Scope lớn: xây shared held-item state/event contract rồi promote ba item Champions đã review: `Leftovers`, `Sitrus Berry`, `Focus Sash`. Default builds không đổi; item mới chỉ mở như Training choices. `itemState` giữ `heldItemId`, `consumed`, `revealed`, activation count và idempotent activation receipt để restart/replay không kích hoạt lại consumable.
- Lifecycle: `Leftovers` hồi 1/16 max HP ở end-turn trước major poison/burn residual. `Sitrus Berry` dùng shared HP-threshold update ở <= 1/2 HP, hồi 1/4 max HP rồi consume; trigger đã nối sau direct/fixed move damage, entry hazard, recoil, confusion self-hit, protection retaliation, Leech Seed và giữa các supported end-turn residual groups để Berry không bị trì hoãn tới sau cumulative KO. `Focus Sash` chỉ can thiệp lethal **move** damage khi holder đang full HP, gồm cả normal damage và fixed-damage move, giữ 1 HP rồi consume; hazard/recoil/residual không kích Sash. Miss/immunity/zero-damage/faint-before-threshold không kích hoạt consumable.
- Suppression/backward compatibility: Magic Room suppress item hooks mà không reveal/consume. Passive item cũ cũng đi qua shared current-owner check. Battle snapshot cũ chưa có `itemState` được infer item owner từ immutable build/passive snapshot, tránh regression khi restart/migration; consumed state mới vẫn là authoritative khi đã tồn tại.
- Privacy/replay: item lần đầu activation phát `itemRevealed`, sau đó `itemActivated`, và consumable phát `itemConsumed`. Opponent/AI projection không thấy unrevealed item; sau reveal chỉ expose public item identity + consumed flag. JSON restart giữ consumption/receipt; cùng activation key là idempotent và không heal/survive lần hai. Playback reducer/log theo đúng event stream này.
- Content: Active base catalog = **Beta Slice v15, 12 Pokémon / 65 move / 16 Ability / 18 item**; Mega runtime = **65 move / 17 Ability / 19 item**. Move catalog không đổi nên R7 FX vẫn **65/65**.
- Coverage: **162 supported / 700 blocked** mỗi format; breakdown = **127 move / 17 Ability / 18 item**. Chỉ ba reviewed item làm coverage tăng; Choice/status-cure/item-loss/swap/steal family chưa được suy diễn.
- Validation: dedicated Item Hooks mechanics **14/14**, schema-3 item runtime **5/5**, item playback/runtime bundle **15/15**, focused HP/status/hazard/protection/recoil/fixed/residual regression **55/55**; backward-compatible snapshot inference giữ các passive item cũ hoạt động; `npm run check` pass; `npm run beta:validate` pass; full suite **415/415** pass, 0 fail/skip/todo.
- Boundary/next: Item Hooks Wave 2 ưu tiên status-cure consumable family (`Lum Berry` và các status-specific berries đã có trong Champions candidate) trên shared consume/reveal contract. Choice lock, Life Orb/Rocky Helmet, item loss/swap/steal và Heavy-Duty Boots tiếp tục fail-closed cho tới batch riêng. `Light Metal` vẫn chờ canonical species weight data.
- Source cross-check: Pokémon Showdown server commit khóa `aa17ca0fac8bc5605df673bd8774c2d0e91efa43` (`data/items.ts`) cho Leftovers 1/16 end-turn recovery, Sitrus threshold/heal/consume và Focus Sash full-HP lethal survival/consume; PokéBase candidate tiếp tục là source Champions cho item availability.


## R3-29 / Beta 3-12 — Secondary-effect framework + Sheer Force

- Status: IMPLEMENTED / AUTOMATED GATE PASSED; cumulative Beta v17 browser QA passed after integration.
- Ngày: 14/09/2026
- Scope lớn: xây shared damaging-secondary framework và promote `Sheer Force` cho Feraligatr cùng 9 move M-A thật: `Waterfall`, `Crunch`, `Liquidation`, `Ice Punch`, `Body Slam`, `Rock Slide`, `Water Pulse`, `Ice Fang`, `Bulldoze`. Default builds không đổi; các move mới chỉ mở như Training choices đã review.
- Secondary lifecycle: secondary handler chỉ chạy sau successful damage trên từng `damagedTargetId`; miss, Protect, immunity, zero damage hoặc target không còn hợp lệ không tiêu secondary RNG. Chance roll độc lập theo từng effect/target; 100% effect không tiêu chance RNG. Shared resolver hỗ trợ major status, volatile status và stat-stage delta, tái dùng type/status immunity, stage clamp và seeded RNG hiện có.
- Spread/data contract: `allAdjacent` được nhận diện là spread giống `allAdjacentFoes` khi có nhiều target nên Bulldoze dùng 0.75× trong Double; secondary chỉ áp lên ally/foe thực sự nhận damage, không bao giờ áp ngược user. Manifest validate kind/chance/status/volatile/boosts và bắt buộc handler `apply-secondary-effects`, giữ fail-closed nếu khai báo thiếu hoặc lệch.
- Sheer Force: shared Ability hook nhận diện move có `secondaryEffects`, tăng base power theo `5325/4096` và đánh dấu `secondaryEffectsSuppressed` trước secondary phase. Ability event ghi số secondary bị triệt; suppressed secondary không tiêu RNG. Move không có secondary không được boost. Runtime Single/Double factory compile Sheer Force từ active catalog thật.
- Content/presentation: Active base catalog = **Beta Slice v14, 12 Pokémon / 65 move / 16 Ability / 15 item**; Mega runtime = **65 move / 17 Ability / 16 item**. Chín move mới có explicit FX override phù hợp và R7 coverage = **65/65**.
- Coverage: **159 supported / 703 blocked** mỗi format; breakdown = **127 move / 17 Ability / 15 item**. Chỉ 9 reviewed moves + Sheer Force làm coverage tăng; Light Metal và Ability family chưa review không được suy diễn.
- Validation: secondary mechanics **9/9**, schema-3 secondary runtime **2/2**, broad status/stage/protection/terrain/damage/Ability/catalog/FX regression **94/94**; `npm run check` pass; `npm run beta:validate` pass; full suite **395/395** pass, 0 fail/skip/todo.
- Boundary/next: `Light Metal` tiếp tục fail-closed vì candidate M-A chưa có canonical species weight. Ability suppression/copy/swap/replace giữ blocked. Ticket kế tiếp là **R3.9 Item Hooks Wave 1**: xây item owner/consume/reveal/idempotent event + restart/replay contract trước, sau đó ưu tiên recovery/consumable/survival candidates có trong Champions như Leftovers, Sitrus Berry và Focus Sash sau source audit.
- Source cross-check: Pokémon Showdown server commit khóa `aa17ca0fac8bc5605df673bd8774c2d0e91efa43` (`data/abilities.ts`, `data/moves.ts`) cho Sheer Force base-power/secondary suppression và secondary definitions; PokéBase candidate tiếp tục là source Champions cho PP/learnset/Ability relation.


## R3-28 / Beta 3-11 — Ability Hooks Wave 1

- Status: IMPLEMENTED / AUTOMATED GATE PASSED; cumulative Beta v17 browser QA passed after integration.
- Ngày: 14/09/2026
- Scope lớn: xây shared Ability-hook layer theo explicit phase và promote 9 relation M-A thật trong 12 Pokémon beta: `Solar Power`, `Leaf Guard`, `Flash Fire`, `Sniper`, `Technician`, `Iron Fist`, `Bulletproof`, `Long Reach`, `Liquid Voice`. Default builds không đổi. `Hyper Voice` được promote cho Primarina để Liquid Voice có damaging sound interaction thực trong active catalog.
- Hook ordering: move transform chạy trước target resolution; target Ability immunity chạy sau semi-invulnerability/protection gate nhưng trước accuracy RNG; base-power/stat/final-damage hooks tách phase; weather/status/end-turn hooks dùng authoritative battle lifecycle. Không dựa vào object insertion order.
- Data contract: manifest move tags `sound/punch/bullet` được validate fail-closed. Liquid Voice đổi sound-tagged move sang Water; Long Reach xóa contact trước retaliation; Bulletproof chặn bullet-tagged move trước accuracy; Iron Fist/Technician/Sniper dùng shared damage modifier phases thay vì move-ID branches.
- Weather/status hooks: Solar Power tăng SpA 1.5× trong Sun và mất 1/8 max HP cuối lượt; Leaf Guard chặn major status/Yawn trong Sun; Flash Fire miễn nhiễm Fire, lưu activation state và tăng Fire offense 1.5× sau activation. Ability hooks không bị Magic Room suppress vì Room chỉ suppress item passives.
- Runtime/content: schema-3 Single/Double factory compile các Ability mới từ catalog thật; Liquid Voice + Hyper Voice có runtime integration riêng. Active base catalog = **Beta Slice v13, 12 Pokémon / 56 move / 15 Ability / 15 item**; Mega runtime = **56 move / 16 Ability / 16 item**; R7 FX = **56/56**.
- Coverage: **149 supported / 713 blocked** mỗi format; breakdown = **118 move / 16 Ability / 15 item**. Chỉ Hyper Voice + 9 reviewed Ability làm coverage tăng; Ability ngoài Wave 1 không được suy diễn.
- Validation: Ability hook unit **9/9**, schema-3 runtime **2/2**, targeted status/delayed regression sạch; `npm run check` pass; `npm run beta:validate` pass; full suite **386/386** pass, 0 fail/skip/todo.
- Boundary/next: relation beta còn lại đáng kể là `Sheer Force` và `Light Metal`. Ticket kế tiếp là **secondary-effect framework + Sheer Force**; Light Metal tiếp tục fail-closed vì candidate M-A hiện không có canonical species weight field để chứng minh weight mechanics. Ability suppression/copy/swap/replace vẫn chờ family riêng.
- Source cross-check: Pokémon Showdown server commit khóa `aa17ca0fac8bc5605df673bd8774c2d0e91efa43` (`data/abilities.ts`, battle action ordering) cho các hook modifier/immunity/status/weather/tag behavior; PokéBase candidate tiếp tục là source relation Champions.


## R3-27 / Beta 3-10 — Semi-invulnerable two-turn family

- Status: IMPLEMENTED / AUTOMATED GATE PASSED; cumulative Beta v17 browser QA passed after integration.
- Ngày: 14/09/2026
- Scope lớn: mở rộng shared move-commitment core cho `Dig`, `Fly`, `Dive`, `Phantom Force`; cả bốn đều có relation M-A thật trong 12 Pokémon beta và default builds không đổi. Semi-invulnerable state nằm trong authoritative `two-turn-move` volatile, không phải UI flag.
- Shared lifecycle: lượt preparation tiêu PP một lần, khóa move + target slot, gắn mode `underground/airborne/underwater/vanished`; lượt release clear state trước khi resolve hit và không tiêu PP lần hai. Ordinary targeted moves bị `check-accuracy` loại ra trước Protect/accuracy RNG khi target đang ở mode không thể chạm tới. Switch/interruption tiếp tục dùng commitment cleanup chung.
- Hit-through exceptions: Dig nhận `Earthquake/Magnitude` và hai move này nhận 2× modifier; Dive nhận `Surf/Whirlpool` và 2×; Fly nhận Gust/Twister/Sky Uppercut/Thunder/Hurricane/Smack Down/Thousand Arrows, riêng Gust/Twister 2×. `Smack Down` cắt Fly commitment sau hit sống sót. Các exception move chưa active vẫn chỉ tồn tại trong resolver/test fixture, không tự được promote.
- Phantom Force: vanish phase không bị ordinary move chạm tới; release dùng manifest `bypassesProtect` + shared `break-protection` nên phá Protect trước damage. Không suy diễn thêm Gravity/Bounce/Sky Drop hay secondary grounding effects chưa review.
- Runtime/UI/presentation: schema-3 Single/Double auto-lock forced release và giữ PP một lần; Battle Log phân biệt burrow/dive/fly/vanish, unreachable miss và Smack Down interruption; bốn move có FX profile.
- Content: Active base catalog = **Beta Slice v12, 12 Pokémon / 55 move / 6 Ability / 15 item**; Mega runtime = **55 move / 7 Ability / 16 item**; R7 FX = **55/55**.
- Coverage: **139 supported / 723 blocked** mỗi format; breakdown = **117 move / 7 Ability / 15 item**. Chỉ bốn reviewed moves tăng support; hit-through fixtures không làm coverage xanh giả.
- Validation: semi-invulnerable core **5/5**, schema-3 runtime **4/4**, presentation regression có dedicated log assertion; `npm run check` pass; `npm run beta:validate` pass; full suite **375/375** pass, 0 fail/skip/todo.
- Boundary/next: R3.7 battlefield/move-lifecycle foundation đã đủ cho beta slice hiện tại; ticket kế tiếp chuyển sang **R3.8 Ability hooks**. Candidate beta có nhiều relation thật để mở theo family như Solar Power/Rain Dish/Leaf Guard/Flash Fire/Sniper/Technician/Iron Fist/Bulletproof/Long Reach/Liquid Voice, nhưng từng Ability chỉ được promote sau khi shared hook ordering và interaction evidence được khóa.
- Source cross-check: Pokémon Showdown server commit khóa `aa17ca0fac8bc5605df673bd8774c2d0e91efa43` (`data/moves.ts`) cho semi-invulnerable callbacks, hit-through/double-damage exceptions và Phantom Force Protect bypass; PokéBase candidate giữ Champions PP/learnset relation.


## R3-26 / Beta 3-09 — Charge/recharge family + seven reviewed moves

- Status: IMPLEMENTED / AUTOMATED GATE PASSED; cumulative Beta v17 browser QA passed after integration.
- Ngày: 14/09/2026
- Scope lớn: xây shared move-commitment contract rồi promote bảy relation M-A thật: `Solar Beam`, `Solar Blade`, `Hydro Cannon`, `Frenzy Plant`, `Blast Burn`, `Hyper Beam`, `Giga Impact`; 12 default builds không đổi. `Dig/Fly/Dive/Phantom Force` chưa promote vì semi-invulnerability và hit-through exceptions cần batch riêng.
- Charge lifecycle: lượt chuẩn bị tiêu PP một lần, lưu move + target slot trên Pokémon và khóa lựa chọn kế tiếp; lượt release không tiêu PP lần hai. Sun bỏ preparation cho Solar Beam/Solar Blade; Rain hiện có giảm released power còn 1/2. Sleep/freeze/flinch/restriction/confusion/paralysis chặn release sẽ clear commitment thay vì giữ charge sai. Switch cleanup dùng volatile lifecycle chung.
- Recharge lifecycle: năm recharge move chỉ tạo `must-recharge` sau khi thực sự gây damage; miss/protection/immunity không tạo commitment. Lượt kế tiếp schema-3 tự normalize thành `recharge`, không được Mega/switch/pivot trong committed action, tiêu 0 PP và vẫn cho đồng đội Double thực hiện action bình thường.
- Runtime/UI/presentation: turn engine nhận action kind `recharge` trong cùng dynamic ordering path với move; schema-3 Single/Double khóa charge release và Double recharge; command UI hiện forced-action panel thay vì move/switch controls. Battle Log có prepare/release/abort, PP-skip, weather power modification, recharge-required/recharge-turn; bảy move có FX override.
- Content: Active base catalog = **Beta Slice v11, 12 Pokémon / 51 move / 6 Ability / 15 item**; Mega runtime = **51 move / 7 Ability / 16 item**; R7 FX = **51/51**.
- Coverage: **135 supported / 727 blocked** mỗi format; breakdown = **113 move / 7 Ability / 15 item**. Chỉ bảy reviewed moves tăng support; semi-invulnerable/two-turn variants chưa được suy diễn.
- Validation: charge/recharge core + runtime **9/9**, command UI/FX targeted regression **21/21**; `npm run check` pass; `npm run beta:validate` pass; full suite **365/365** pass, 0 fail/skip/todo.
- Boundary/next: ticket kế tiếp là semi-invulnerable two-turn family. Candidate beta có relation thật: Charizard/Blastoise/Typhlosion/Feraligatr/Infernape/Chesnaught → Dig, Charizard → Fly, Blastoise/Feraligatr/Primarina → Dive, Decidueye → Phantom Force. Phải khóa untargetable state, move-specific hit-through/double-damage exceptions và Protect interaction trước promotion.
- Source cross-check: Pokémon Showdown server commit khóa `aa17ca0fac8bc5605df673bd8774c2d0e91efa43` (`data/moves.ts`, `data/conditions.ts`) cho charge state, Sun skip, weather power modifier và `mustrecharge`; PokéBase candidate giữ Champions PP/learnset relation.

## R3-25 / Beta 3-08 — Delayed-effect family + Yawn + Perish Song

- Status: IMPLEMENTED / AUTOMATED GATE PASSED; cumulative Beta v17 browser QA passed after integration.
- Ngày: 14/09/2026
- Scope lớn: thêm shared delayed-effect scheduler và promote hai relation M-A thật: Blastoise → `Yawn`, Primarina → `Perish Song`; default builds không đổi. Future Sight-style delayed attacks, Soundproof/Baton Pass transfer semantics, two-turn và recharge vẫn fail-closed.
- Scheduler/lifecycle: delayed state được lưu trên Pokémon affected, không ở UI; end-turn resolve sau weather/status/residual HP groups nhưng trước ordinary condition expiry. Seeded status resolution cập nhật authoritative RNG; Pokémon đã faint trước scheduler bị skip; switch-out dùng cleanup volatile hiện có nên không để state delayed bám sang replacement.
- Yawn: schedule 2 residual steps; Protect/status hiện có/grounded Electric Terrain chặn ngay lúc cast; Misty Terrain không chặn schedule nhưng shared major-status rule được re-check khi resolve Sleep. Single/Double đều dùng cùng handler.
- Perish Song: mỗi active Pokémon chưa có counter nhận initial count 4, giảm cuối chính lượt dùng xuống 3 rồi 2 → 1 → faint ở 0; faint không đi qua damage pipeline. Recast không reset counter đang tồn tại; switch xóa counter và replacement không kế thừa.
- Runtime/presentation: schema-3 test khóa Yawn Single/Double, Perish Song decrement và switch cleanup; Battle Log có schedule/tick/resolve text; `Yawn`/`Perish Song` dùng `notes` FX và delayed scheduling được render như status outcome/target track.
- Content: Active base catalog = **Beta Slice v10, 12 Pokémon / 44 move / 6 Ability / 15 item**; Mega runtime = **44 move / 7 Ability / 16 item**; R7 FX = **44/44**.
- Coverage: **128 supported / 734 blocked** mỗi format; breakdown = **106 move / 7 Ability / 15 item**. Chỉ Yawn/Perish Song tăng coverage; scheduler không tự đánh dấu Future Sight/two-turn/recharge là supported.
- Validation: delayed core **8/8**, schema-3 delayed runtime **3/3**, catalog/UI/FX targeted gate **22/22**; `npm run check` pass; `npm run beta:validate` pass; full suite **355/355** pass, 0 fail/skip/todo.
- Boundary/next: ticket kế tiếp là shared two-turn/recharge foundation, ưu tiên relation thật trong beta và khóa charge/skip/recharge/action-prevention lifecycle trước khi promote thêm content.
- Source cross-check: Pokémon Showdown server commit khóa `aa17ca0fac8bc5605df673bd8774c2d0e91efa43` (`data/moves.ts`) cho Yawn/Perish Song; scoped Champions candidate giữ learnset relation và PP.

## R3-24 / Beta 3-07 — Room family core + Wonder Room

- Status: IMPLEMENTED / AUTOMATED GATE PASSED; cumulative Beta v17 browser QA passed after integration.
- Ngày: 13/09/2026
- Scope lớn: hoàn thiện shared Room family cho `Trick Room`, `Wonder Room`, `Magic Room`; chỉ promote `Wonder Room` cho Primarina trong Beta Slice v9 vì đây là relation M-A thật trong 12 Pokémon beta. Trick/Magic Room giữ mechanics-supported nhưng content-blocked.
- Shared lifecycle: `field.rooms` cho phép nhiều Room độc lập cùng tồn tại, mỗi Room 5 turn; dùng lại cùng Room tiêu PP rồi tắt chính Room đó thay vì refresh. End-turn giảm timer riêng và phát generic `roomStarted/roomEnded` để replay/UI derive state.
- Trick Room core: manifest priority `-7`; turn engine re-read Room state trước mỗi action ranking nên các actor chưa hành động đảo Speed order ngay khi Room thay đổi mà vẫn giữ RNG/tie keys. Suspend/resume replacement tiếp tục dùng cùng dynamic callback.
- Wonder Room core: physical/special damage đổi Defense/Sp. Def **base stat trước stage modifier của stat được yêu cầu**, đúng contract Showdown; critical-stage bypass tiếp tục dùng shared damage path.
- Magic Room core: suppress mọi held-item passive hiện có trong Room (damage boost/reduction, Light Clay, weather rocks, Terrain Extender) nhưng không suppress Ability passive. Mega evolution eligibility không bị gộp vào passive-item suppression.
- Presentation/content: field adapter render nhiều Room layer/chip đồng thời; Battle Log có start/end/toggle text; Wonder Room dùng `field-burst` FX. Active base catalog = **Beta Slice v9, 12 Pokémon / 42 move / 6 Ability / 15 item**; Mega runtime = **42 move / 7 Ability / 16 item**; R7 FX = **42/42**.
- Coverage: **126 supported / 736 blocked** mỗi format; breakdown = **104 move / 7 Ability / 15 item**. Trick/Wonder/Magic Room đều có Single/Double evidence, nhưng legality vẫn tách riêng khỏi mechanics coverage.
- Validation: Room core **7/7**, schema-3 runtime **2/2**, UI/FX **18/18**, broad rules/weather/terrain/screens/passive regression **54/54**; `npm run check` pass; `npm run beta:validate` pass; full suite **343/343** pass, 0 fail/skip/todo.
- Boundary/next: Persistent Ability extension, specialized offensive-defense-stat moves và các item mechanics chưa implemented không được suy diễn. Ticket kế tiếp là delayed-effect scheduler foundation; Blastoise → Yawn có relation thật và là candidate ưu tiên để khóa delayed sleep/lifecycle trước khi mở Perish Song hoặc two-turn/recharge families.
- Source cross-check: Pokémon Showdown server commit khóa `aa17ca0fac8bc5605df673bd8774c2d0e91efa43`, `data/moves.ts` cho Room duration/recast/priority và `sim/pokemon.ts` cho Trick Room Speed inversion + Wonder Room defensive-stat swap; PokéBase candidate tiếp tục là nguồn Champions cho PP và Primarina learnset relation.


## R3-23 / Beta 3-06 — Toxic Spikes vertical slice

- Status: IMPLEMENTED / AUTOMATED GATE PASSED; cumulative Beta v17 browser QA passed after integration.
- Ngày: 13/09/2026
- Scope: promote Toxic Spikes cho Beedrill dưới dạng optional Training choice; 12 default build không đổi. Shared hazard state mở layer cap riêng thay vì species/UI special-case.
- Entry contract: Toxic Spikes có tối đa 2 layer. Grounded entrant nhận `poison` ở 1 layer và `bad-poison` ở 2 layer qua shared major-status pipeline, nên existing status, Steel immunity và Misty Terrain đều giữ cùng authoritative block rules. Flying/airborne target bỏ qua.
- Absorption/order: grounded Poison-type xóa toàn bộ Toxic Spikes trước status application và phát `hazardRemoved(reason=poison-type-absorption)` để replay/UI cập nhật đúng. Hazard vẫn giữ stable creation order; test khóa chuỗi Toxic Spikes → Stealth Rock KO → replacement → apply lại Toxic Spikes mà không tăng turn sai.
- Cleanup/presentation: Rapid Spin và Defog thêm Toxic Spikes vào explicit Showdown order `Spikes → Toxic Spikes → Stealth Rock`. Side chip hiển thị layer `×2`; Battle Log phân biệt poison/bad-poison trigger và Poison-type absorption; Toxic Spikes dùng `field-burst` FX.
- Content/runtime: active base catalog = **Beta Slice v8, 12 Pokémon / 41 move / 6 Ability / 15 item**; Mega runtime = 41 move / 7 Ability / 16 item. Mechanics coverage = **123 supported / 739 blocked** mỗi format; breakdown = **101 move / 7 Ability / 15 item**. R7 Move FX = **41/41**.
- Validation: targeted status/terrain/hazard/replacement/catalog/FX regression **92/92** pass; `npm run check` pass; `npm run beta:validate` pass; full exact suite **333/333** pass, 0 fail/skip/todo. Candidate promotion giữ hash-bound evidence và Beedrill → Toxic Spikes relation thật.
- Boundary/next: Heavy-Duty Boots không có trong candidate, Magic Guard không có relation trong beta roster, Sticky Web/Court Change cũng không có relation trong 12 Pokémon hiện tại. Hazard family vì vậy dừng fail-closed tại đây; ticket kế tiếp nên quay lại R3.7 room/field family, ưu tiên move có relation thật (Primarina hiện có Wonder Room) sau source/interaction audit.
- Source cross-check: Pokémon Showdown server commit khóa `aa17ca0fac8bc5605df673bd8774c2d0e91efa43`, `data/moves.ts` Toxic Spikes và cleanup lists; PokéBase candidate là nguồn Champions cho PP và Beedrill learnset relation.


## R3-22 / Beta 3-05 — Rapid Spin + Defog hazard cleanup

- Status: IMPLEMENTED / AUTOMATED GATE PASSED; cumulative Beta v17 browser QA passed after integration.
- Ngày: 13/09/2026
- Scope: promote Rapid Spin cho Blastoise và Defog cho Decidueye/Scizor dưới dạng optional Training choices; default builds không đổi. Cleanup được đặt trong shared mechanics handler thay vì hard-code theo species/UI.
- Rapid Spin: chỉ cleanup sau một damaging hit hợp lệ; xóa Leech Seed trên user, xóa Stealth Rock/Spikes ở side của user và sau đó +1 Speed. Protect, immunity hoặc zero-damage path không được cleanup/boost miễn phí. Partial trapping vẫn fail-closed vì chưa có state contract tương ứng.
- Defog: sau target/protection resolution, hạ Evasion mục tiêu 1 stage, xóa Reflect/Light Screen ở target side, xóa Stealth Rock/Spikes ở cả hai side và clear active Terrain. Tailwind không bị xóa. Evasion đã ở -6 không làm cleanup thất bại.
- Ordering/fail-closed: hazard cleanup dùng explicit order Spikes → Stealth Rock cho supported subset, phát `hazardRemoved`, `sideConditionEnded`, `terrainEnded` để replay/UI derive state. Handler reject cleanup mode không khai báo thay vì fallback ngầm. Toxic Spikes/Sticky Web, Aurora Veil/Safeguard/Mist, Court Change và partial trapping chưa được claim.
- Content/runtime: active base catalog lên Beta Slice v7 = **12 Pokémon / 40 move / 6 Ability / 15 item**; Mega extension runtime = 40 move / 7 Ability / 16 item. Mechanics coverage tăng **120 → 122 supported / 740 blocked** mỗi format; breakdown = **100 move / 7 Ability / 15 item**. R7 Move FX = **40/40**.
- Validation: targeted hazards/screens/terrain/runtime regression **44/44** pass; `npm run check` pass; `npm run beta:validate` pass; full `npm test` đạt **327/327**, 0 fail/skip/todo. Candidate promotion vẫn hash-bound và default builds không đổi.
- Boundary/next: Heavy-Duty Boots không có trong candidate hiện tại, Magic Guard không có relation trong 12-species beta. Toxic Spikes có relation thật với Beedrill nên là hazard ticket kế tiếp; chỉ promote khi poison-on-entry, Poison-type absorption, grounded gating, replacement chain và cleanup interaction được test đầy đủ. Sticky Web tiếp tục fail-closed cho tới khi có content relation/review phù hợp.
- Source cross-check: Pokémon Showdown server commit khóa `aa17ca0fac8bc5605df673bd8774c2d0e91efa43`; Rapid Spin dùng successful-hit cleanup + Speed boost, Defog dùng target evasion drop + screens/hazards/terrain cleanup. PokéBase candidate tiếp tục là nguồn Champions cho PP/content relation.


## R3-21 / Beta 3-04 — Stealth Rock + Spikes hazard vertical slice

- Status: IMPLEMENTED / AUTOMATED GATE PASSED; cumulative Beta v17 browser QA passed after integration.
- Ngày: 13/09/2026
- Scope: promote hai entry hazard có relation thật trong roster beta: Chesnaught → Spikes và Infernape → Stealth Rock. Default builds giữ nguyên; hai move là optional Training choices qua `enabledContent`.
- Side state: Stealth Rock có tối đa một layer; Spikes stack tối đa ba layer. Duplicate/max-layer cast vẫn tiêu PP rồi phát `moveFailed(hazardMaxLayers)`. Side condition lưu source và stable creation order để SwitchIn effects resolve theo cùng effect-order contract thay vì object insertion ngẫu nhiên.
- Entry damage: Stealth Rock gây `floor(maxHP × Rock effectiveness / 8)`, minimum 1 khi có damage. Spikes chỉ đánh grounded target và dùng `1/8`, `1/6`, `1/4` max HP cho 1/2/3 layer. Flying và airborne volatile đã support bỏ qua Spikes; Stealth Rock vẫn đi qua type chart.
- Shared lifecycle: `turn-engine` gọi một entry-effects resolver chung cho manual switch, pivot và forced switch; schema-3 replacement flow cũng dùng đúng resolver đó trước `completeEntry`. Nếu hazard KO entrant giữa lượt, R3-20 suspend pending queue → `REPLACE`; replacement mới lại ăn hazard và có thể yêu cầu replacement lần nữa mà turn không tăng; khi có entrant sống, queue deterministic resume.
- Presentation: Battle Log có `hazardApplied`, `hazardTriggered`, `entryReplacementRequired`; side-condition chip hiển thị layer (`×2`, `×3`); Stealth Rock/Spikes dùng `field-burst` FX. R7 coverage = **38/38**.
- Content/runtime: active base catalog lên Beta Slice v6 = **12 Pokémon / 38 move / 6 Ability / 15 item**; Mega extension runtime = 38 move / 7 Ability / 16 item. Mechanics coverage tăng **118 → 120 supported / 742 blocked** mỗi format; breakdown = **98 move / 7 Ability / 15 item**.
- Validation: targeted hazard/core/server/switch regression pass; `npm run check` pass; `npm run beta:validate` pass; full `npm test` đạt **321/321**, 0 fail/skip/todo. Candidate review giữ hash-bound promotion và default builds không đổi.
- Boundary: Heavy-Duty Boots, Magic Guard, Rapid Spin/Defog/Court Change, Toxic Spikes/Sticky Web và Levitate/Air Balloon/Gravity/Smack Down/Ingrain chưa được claim. Kế tiếp review hazard-cleanup vertical slice, ưu tiên Rapid Spin/Defog vì Blastoise/Decidueye có relation trong roster beta nhưng chỉ promote sau khi clear-order, side scope và secondary effects có contract/test đầy đủ.
- Source cross-check: Pokémon Showdown server commit khóa `aa17ca0fac8bc5605df673bd8774c2d0e91efa43`; `data/moves.ts` cho layer/formula và `sim/battle.ts` xác nhận các SwitchIn side-condition tie được resolve theo creation `effectOrder`.


## R3-20 — Mid-turn replacement suspend/resume

- Status: IMPLEMENTED / AUTOMATED GATE PASSED; không thay đổi active Beta Slice v5 hay mechanics coverage.
- Ngày: 13/09/2026
- Scope: đóng dependency lifecycle của R3.6 trước khi mở entry hazards. Khi một action có `switchIn` và Pokémon vừa vào sân bị KO trong cùng action (ví dụ future hazard damage), authoritative queue dừng ngay sau action đó, mở `REPLACE`, rồi tiếp tục đúng các action chưa chạy sau replacement/entry. KO do move thông thường không mở mid-turn replacement và vẫn dùng end-turn replacement hiện hành.
- Determinism: battle snapshot giữ `pendingResolution` gồm ba phần queue còn lại (switch/Mega/move), execution history, RNG state, tie keys và Trick Room flag. Resume không prepare/reroll queue lần hai; dynamic Speed vẫn được tính lại trên state mới cho từng action còn chờ.
- Turn lifecycle: replacement giữa lượt không tăng `turn`; `applyReplacements` chuyển `REPLACE → ENTRY`, `completeEntry` nhận biết suspended resolution và chuyển `ENTRY → RESOLVE`; chỉ sau queue còn lại + end-turn mới sang turn tiếp theo. `turnSuspended`, `entryCompleted(resume=true)` và `turnResumed` làm mốc replay/log rõ ràng.
- Server: `battleV3.replacements` tự resume authoritative queue và chạy end-turn nếu queue kết thúc; nếu một future entry effect lại tạo KO replacement khác, engine có thể trả về `REPLACE` lần nữa mà không làm mất pending queue. `lastTurn.initial` vẫn giữ snapshot đầu turn và final snapshot chỉ chốt sau continuation.
- Tests: R3 switching test thêm Single suspend/resume, Double byte-deterministic pending order và negative ordinary-KO case; schema-3 integration test xác nhận action `battleV3.replacements` resume queue, clear pending state và chỉ tăng turn đúng một lần sau end-turn.
- Validation: targeted lifecycle/switching/server tests pass; `npm run check` pass; `npm run beta:validate` pass với Beta Slice v5 = 12 Pokémon / 36 move / 6 Ability / 15 item; full `npm test` đạt **312/312**, 0 fail/skip/todo.
- Boundary: batch này chưa implement Stealth Rock/Spikes và không claim on-entry ordering của hazard/Ability/item cụ thể. Kế tiếp là hazard vertical slice dùng contract suspend/resume này, kèm source review, damage/order tests, Single/Double và entry-KO replacement chain.
- Design provenance: đây là Vanguard authoritative-engine contract nhằm bảo toàn deterministic turn resolution/replay; không tuyên bố clone exact UI timing của Pokémon Champions khi Champions không công bố engine internals.

## R3-19 — Electric + Psychic Terrain mechanics closure

- Status: IMPLEMENTED / AUTOMATED GATE PASSED; active Beta Slice v5 intentionally unchanged.
- Ngày: 13/09/2026
- Scope: hoàn tất hai terrain còn lại ở shared mechanics layer thay vì promote content không có relation trong roster beta. Candidate hiện không có Electric Terrain/Psychic Terrain relation cho 12 species active, vì vậy hai move được supported trong M-A coverage nhưng không đưa vào Beta Slice v5.
- Electric Terrain: field-global 5 turn, Terrain Extender kéo lên 8; grounded Electric move dùng modifier fixed-point `5325/4096`; grounded target không thể nhận Sleep mới. Major status khác không bị chặn và airborne target không chịu terrain effect. Yawn vẫn fail-closed vì bản thân Yawn chưa có supported volatile contract.
- Psychic Terrain: field-global 5/8 turn; grounded Psychic move dùng `5325/4096`; priority effect `> 0.1` nhắm grounded foe bị chặn trước accuracy/protection resolution. Self/ally target và airborne target được miễn; `bypassesProtect` (ví dụ Feint) không vượt Psychic Terrain vì đây không phải Protect.
- Grounding boundary không đổi: Flying type và Magnet Rise/Telekinesis được coi airborne; Levitate/Air Balloon/Gravity/Smack Down/Ingrain vẫn chưa được claim.
- Presentation: Electric/Psychic Terrain đã có `field-burst` override và dùng generic authoritative terrain layer sẵn có. Active FX coverage vẫn **36/36** vì hai move chưa nằm trong Beta Slice v5.
- Coverage: M-A tăng **116 → 118 supported / 744 blocked** ở cả Single và Double; breakdown = **96 move / 7 Ability / 15 item**. Active base catalog vẫn 12 Pokémon / 36 move / 6 Ability / 15 item; Mega extension runtime vẫn 36 move / 7 Ability / 16 item.
- Validation: `npm run check` pass; `npm run beta:validate` pass và vẫn khóa Beta Slice v5 = 12 Pokémon / 36 move / 6 Ability / 15 item; targeted Terrain/Protection/Status/Beta regression đạt 28/28; exact full `npm test` file list với Node `--test-force-exit` đạt **308/308**, 0 fail/skip/todo; R7 FX test xác nhận override Electric/Psychic dùng `field-burst`.
- Hazard dependency: Stealth Rock/Spikes có relation thật trong beta, nhưng chưa mở ở batch này. Nếu entry hazard KO Pokémon ngay khi manual/pivot/forced switch đưa nó vào sân giữa lượt, engine cần suspend action queue → replacement window → resume deterministic. R3.6 hiện chưa có contract đó, nên hazard tiếp tục blocked thay vì triển khai nửa vời.
- Source cross-check: Pokémon Showdown server commit khóa `aa17ca0fac8bc5605df673bd8774c2d0e91efa43`, `data/moves.ts`; Electric Terrain xác nhận 5/8 turn, Sleep gate và `5325/4096`, Psychic Terrain xác nhận priority gate, ally/airborne exemptions và `5325/4096`.

## R3-18 / Beta 3-03 — Grassy + Misty Terrain vertical slice

- Status: IMPLEMENTED / AUTOMATED GATE PASSED; cumulative Beta v17 browser QA passed after integration.
- Ngày: 13/09/2026
- Checkpoint implementation: `f4c4146` (`feat: add grassy and misty terrain mechanics`).
- Scope: promote đúng một terrain batch có relation thật trong 12-Pokémon beta: Grassy Terrain cho Venusaur/Meganium/Chesnaught/Decidueye, Misty Terrain cho Primarina và held item Terrain Extender. Electric/Psychic Terrain chưa promote để không khai báo hỗ trợ giả cho sleep/priority/grounding interactions chưa có hook.
- Lifecycle: terrain là condition field-global, mặc định 5 turn; Terrain Extender kéo terrain do holder tạo lên 8 turn; cast lại cùng terrain thất bại sau PP spend, terrain khác thay thế condition cũ bằng `terrainEnded(reason=replaced)` rồi `terrainStarted`; expiry phát `terrainEnded(reason=duration)`.
- Grassy Terrain: grounded Grass move dùng modifier Showdown fixed-point `5325/4096`; Earthquake/Bulldoze/Magnitude giảm power còn 1/2 khi target grounded; active grounded Pokémon hồi `1/16` max HP ở end turn trước khi timer giảm.
- Misty Terrain: grounded target không nhận major status hoặc confusion; Dragon damage vào grounded target giảm `0.5×`.
- Grounding boundary của batch: Flying type và volatile Magnet Rise/Telekinesis được coi airborne. Levitate, Air Balloon, Gravity, Smack Down/Ingrain và các grounding override khác chưa được enable nên tiếp tục fail-closed cho batch tương ứng.
- Runtime/content: active base catalog lên Beta Slice v5 = 12 Pokémon / 36 move / 6 Ability / 15 item; Mega extension runtime = 36 move / 7 Ability / 16 item. Default builds không đổi. `beta:validate` pass.
- Coverage: M-A tăng từ 113 → **116 supported / 746 blocked** ở cả Single và Double; breakdown = 94 move / 7 Ability / 15 item. Move FX tăng **36/36**, Grassy/Misty dùng `field-burst`; terrain layer và Battle Log lấy `terrainStarted/terrainEnded` từ authoritative timeline.
- Validation: targeted terrain/content/catalog/FX/UI tests pass; `npm run check` pass; exact full `npm test` file list chạy với Node `--test-force-exit` đạt **306/306**, 0 fail/skip/todo. `pokemon:validate`, `mechanics:inventory`, `mechanics:coverage` và `beta:validate` đều pass; suite vẫn gồm seeded 1,000-battle deterministic simulation.
- Browser QA: được bao phủ trong lượt integration Beta v17 trên local server; catalog, Training choices, Team Preview, battle animation và ordered Battle Log đều tải đúng, không có console warning/error.
- Source cross-check: Pokémon Showdown server commit khóa `aa17ca0fac8bc5605df673bd8774c2d0e91efa43`, `data/moves.ts` + `data/items.ts`; PokéBase candidate tiếp tục là nguồn Champions cho availability/relations/display values.

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
- Normalized the perceived size of each static artwork with a small presentation-only CSS scale derived from its non-transparent pixel area. Source PNGs remain unchanged, and battle sprites are not affected.

## Beta 2-01 — Expanded catalog and schema-3 Roster Ranch

- Active catalog: `pv-ma-2026-09-12-beta2-beta-slice-v2`, containing 12 Pokémon, 29 moves, 4 Abilities and 11 held items with Single/Double coverage. The original six remain the permanent starter team; Charizard, Meganium, Typhlosion, Scizor, Infernape and Primarina are recruitable.
- Save safety: existing schema-3 saves are backed up and rebased onto the new catalog. Compatible Mon/build/team references are preserved, legacy `beta` ownership becomes `permanent`, and new species are not granted automatically.
- Roster Ranch: ten unique seeded offers, a 22-hour cycle, three paid refreshes, one seven-day Trial and permanent purchase with 1,600 coins or one Recruitment Ticket. Trial-to-permanent upgrades preserve `monId` and `buildId`; expired Trial members cannot enter a new preview.
- Economy loop: completed schema-3 battles now settle one ledger reward. Victory grants 180 coins/80 crystals; defeat or draw grants 60/20; surrender grants zero.
- Presentation: all six new species have local official artwork plus front/back battle GIFs. Source proportions remain unmodified; no additional per-species scale tuning was added.
- Validation: Beta slice gate reports 12 Pokémon/10 types/29 moves/4 Abilities/11 items; full suite passes 261/261. Browser QA caught and fixed an invalid dotted Recruitment action ID, then confirmed a real Primarina Trial, ticket upgrade, seven-card Archive, Team Builder save, Team Preview, all artwork loaded and zero console warnings/errors.

## Beta 2-02 — Team Builder/Battle Arena synchronization

- Fixed Battle Arena retaining a Team Preview or finished-session roster created before the latest `teamV3.save`.
- Saving a team now discards only unlocked Preview and finished battle sessions. A battle already in Command/Replacement keeps its immutable lineup; Team Builder explains that saved changes apply to the next battle.
- Integration QA changed slot one from Primarina to Venusaur while an older Preview existed. Battle Arena returned to format selection, and the next Single Preview showed the exact six saved members with no console warnings/errors.

## Beta 2-03 / R6-01 — Mega Venusaur vertical slice

- Status: DONE cho Mega đầu tiên trong schema 3; các Mega form khác tiếp tục được mở theo relation batch.
- Data: `mega-beta-v1` ghi riêng relation Venusaur → Mega Venusaur → Venusaurite, form stats/type, Thick Fat và provenance PokéBase/PokeAPI. Catalog runtime có 12 Pokémon thường + 1 Mega form, 5 Ability và 12 item; Regulation M-A Beta cho phép một Mega mỗi side.
- Rules: command phải là move của active Venusaur đang giữ Venusaurite. Server kiểm lại lúc submit và resolve; lần Mega thứ hai, sai stone, form thiếu và actor không còn active trả mã lỗi ổn định. Switch không thể mang cờ Mega.
- Transition: Mega chạy sau switch và trước move. Form mới tính lại stats level 50, giữ lượng HP đã mất, PP, major status, stages và volatiles; Ability đổi sang Thick Fat và passive snapshot được compile lại. Move order còn lại đọc Speed mới từ battle state.
- Mechanics: Thick Fat dùng defender-side damage modifier 0.5 cho Fire/Ice và ghi source vào authoritative damage breakdown.
- Presentation: command card có checkbox Mega chỉ khi stone/form hợp lệ; timeline chiếu transformation FX trước move cast, đổi front/back idle sprite đúng frame và Battle Log ghi form + Ability mới.
- Evidence: `npm run check` pass; full suite 272/272; browser QA local đi qua Training → Venusaurite → Single Preview → Mega command và xác nhận Mega sprite, log, Thick Fat cùng command turn kế tiếp.

## R7-04 — Event-driven Move FX profiles

- Status: DONE cho toàn bộ 29 move đang enable trong Beta 2; persistent weather/terrain layer và playback speed/skip controls vẫn là batch R7 tiếp theo.
- Architecture: `v3-move-fx.js` tách khỏi battle screen, chọn `move override → category fallback → minimal cue`. Profile dùng chung gồm projectile, beam, slash, rush, barrage, impact, aura, barrier, drain, seed, notes và field burst; move-specific mapping chỉ là bảng nhỏ.
- Timing: mỗi cast frame và impact frame giữ cùng `actorId`/`moveId`. Cast chỉ chạy chuyển động, còn impact đọc event authoritative để biểu diễn hit, miss, blocked, status, heal/drain hoặc failed; HP/status vẫn chỉ đổi sau commit point của timeline.
- Double Battle: adapter đếm target trực tiếp từ event và tạo nhiều impact track cho spread move. Hướng bay dùng side của actor; Pokémon tiếp tục chạy idle sprite và chỉ nhận cast/hit reaction.
- Presentation: thêm primitive CSS độc lập và palette đủ 18 hệ. Reduced motion giữ tên chiêu, outcome, HP và log nhưng tắt các vật thể chuyển động; runtime không fetch resource bên ngoài.
- Coverage: `docs/r7-move-fx-coverage.json` được generate và verify trong `npm run check`, khóa 29/29 move cùng profile/source/type. Test riêng bao phủ cast/impact, spread, miss, block, status, heal, failed và reduced motion.
- Browser QA local: Protect hiển thị barrier cast rồi blocked impact; Brave Bird bị chặn vẫn hiển thị rush + blocked; Giga Drain và Flip Turn đi đúng action order, Battle Log/HP cập nhật sau impact, quay về Command và không có console error. `npm run check` pass; full suite đạt 277/277.

## R7-05 — Playback controls và persistent field presentation

- Playback runner được tách khỏi battle screen, sở hữu scaled wait và cancellable timer. Schema 3 hỗ trợ 1×/2×, lưu lựa chọn vào browser settings, khóa selector khi turn đang chạy và cho phép Skip ngay trong mọi frame.
- Skip, chuyển trang, ẩn tab hoặc resize đều hủy timer/FX tạm và render authoritative final snapshot đã nhận từ server; không chạy nốt callback cũ và không gửi thêm action.
- Field adapter nhận public `field` và `sideConditions` từ battle projection. Weather, terrain, Trick Room và condition của mỗi side có layer/chip độc lập; event start/end chỉ cập nhật đúng layer tại impact commit point.
- CSS condition nằm riêng, có rain/sun/sand/snow, bốn terrain và Trick Room primitives. Reduced motion giữ chip/trạng thái nhưng dừng chuyển động nền.
- Boundary: đây là presentation contract sẵn sàng cho batch mechanics; catalog Beta 2 hiện chưa enable move tạo weather/terrain nên gameplay chưa tự phát sinh các condition này.
- Browser QA: đổi 2×, chạy turn, thấy selector bị khóa + Skip; Skip lập tức commit damage/log và trả về Command turn 2. Reload vẫn giữ 2×, field layer tồn tại, không có console error. `npm run check` pass; full suite đạt 282/282.

## R7-06 — Slot anchors và per-target spread outcomes

- `v3-scene-anchors.js` là nguồn tọa độ duy nhất cho actor, ally, foe và field trong Single/Double. Move FX nhận target identity từ authoritative event timeline và tạo đường bay riêng tới đúng `activeSlot` thay vì dịch chuyển mục tiêu theo chỉ số CSS.
- Cast và impact dùng cùng target list. Drain bỏ heal event của chính người dùng khỏi danh sách mục tiêu; recoil/protection damage cũng không tạo thêm attack track về actor.
- Mỗi mục tiêu của spread move có outcome riêng: hit, miss, blocked, immune, status hoặc heal. Root dùng `mixed` khi kết quả khác nhau, trong khi từng primitive giữ màu/chuyển động đúng kết quả của target đó.
- Chế độ 2× giờ rút ngắn cả timer lẫn CSS duration/delay của move, hit/cast reaction và Mega FX, nên hình ảnh không còn bị frame kế tiếp cắt giữa chừng.
- Battle Log sửa nhãn bốn sự kiện switch mở trận luôn là T1 sau khi trận đã sang turn sau.
- Automated QA khóa tọa độ Single/Double, Giga Drain một target, recoil exclusion, mixed spread, immunity và 2× class. Browser QA Double xác nhận Water Spout có hai target track tới hai slot khác nhau, giữ `speed-2`, Battle Log theo đúng Speed và không có console warning/error.

## R3-16 / Beta 3-01 — Sun/Rain battlefield conditions

- Scope: mở một vertical slice condition hoàn chỉnh trước khi làm toàn bộ terrain/room/hazard. Sunny Day và Rain Dance dùng handler `apply-weather`; state duy nhất nằm ở `battle.field.weather` với source, loại weather và số turn còn lại.
- Rules: weather mặc định 5 turn; Heat Rock chỉ kéo Sun và Damp Rock chỉ kéo Rain lên 8. Sun tăng Fire/giảm Water, Rain tăng Water/giảm Fire theo 1.5×/0.5× trong shared damage pipeline. Chlorophyll và Swift Swim nhân đôi Speed trong weather tương ứng; hàng đợi server tính lại effective Speed từ state hiện tại trước từng action. Rain Dish hồi 1/16 max HP trong end-turn group rồi timer weather mới giảm và phát `weatherEnded`.
- Content: `beta-slice-v3` thêm `enabledContent`, cho phép promote lựa chọn đã review mà không sửa 12 build mặc định. Active catalog có 31 moves, 6 Abilities và 13 held items trước phần mở rộng Mega. Venusaur nhận Sunny Day/Chlorophyll/Heat Rock; Blastoise nhận Rain Dance/Rain Dish/Damp Rock. Swift Swim đã có mechanics evidence nhưng chưa expose vì 12 species hiện tại không có relation hợp lệ.
- Presentation: Sunny Day/Rain Dance dùng `field-burst`; `weatherStarted` nằm trong cùng move group nên lớp trời và chip chỉ xuất hiện ở impact commit sau animation. Battle Log ghi loại weather và duration; snapshot/replay giữ condition qua turn, và chip giảm theo state authoritative.
- Source audit: formula/duration/hook được đối chiếu ở Pokémon Showdown server commit `aa17ca0fac8bc5605df673bd8774c2d0e91efa43`, trong `data/conditions.ts` và `data/abilities.ts`. Review record nằm ở `app/content-src/beta-slice-v3-review.json`.
- Automated gate: mechanics coverage tăng lên 109/862 cho cả Single và Double; FX coverage 31/31. Test unit bao phủ duration, wrong rock, damage modifier, Speed ability, Rain Dish, expiry, replace/reset và immutability; test server xác nhận Heat Rock Sun còn 7 turn sau end-turn và Chlorophyll Speed được nhân đôi ở command kế tiếp.
- Browser QA trên phòng local riêng: Training hiển thị đúng sáu lựa chọn Sun/Rain. Trong Single Battle, Feraligatr Speed 143 hành động trước Venusaur Speed 132 ở turn đặt nắng; weather layer/chip chỉ xuất hiện sau Sunny Day impact và còn 7T. Turn kế tiếp Chlorophyll đưa Venusaur lên Speed 264, vượt Decidueye 134; Battle Log và chip về 6T sau end-turn. Không có console warning/error.
- Gate hoàn tất: `npm run check`, `npm run beta:validate` và full suite `293/293` đều đạt.

## R3-17 / Beta 3-02 — Tailwind, screens và Light Clay

- Scope: condition theo side đầu tiên gồm Tailwind, Reflect và Light Screen. State nằm trong `battle.sides[side].conditions`; move handler chỉ tạo/kiểm tra condition, damage và Speed đọc state ở thời điểm resolve.
- Tailwind: 4 turn, nhân đôi Speed của side sở hữu. Server tiếp tục xếp lại các action chưa chạy sau mỗi action; test Double hạ Speed gốc của Blastoise xuống 98, sau Tailwind thành 196 và vượt một đối thủ vốn nhanh hơn ở cùng turn.
- Screens: Reflect chỉ giảm physical, Light Screen chỉ giảm special. Single dùng 0.5×; Double dùng fixed-point 2732/4096; critical hit bỏ qua. Breakdown ghi `sideConditionModifiers` để inspector/replay không phải suy luận từ HP.
- Light Clay: passive snapshot `screen-duration` kéo Reflect/Light Screen từ 5 lên 8 turn và không tác động Tailwind. Dùng lại item clause hiện có.
- Lifecycle: persistent condition dùng `remaining`, one-turn guard giữ `endTurnTimer`; một vòng cleanup chọn đúng timer nên không giảm hai lần. Recast khi condition còn hoạt động phát `moveFailed` với reason ổn định sau khi PP đã tiêu.
- Content/presentation: `beta-slice-v4` giữ nguyên 12 default build và mở 34 moves, 6 Abilities, 14 items trước Mega. Tailwind dùng field burst; Reflect/Light Screen dùng barrier; event/log/chip đều có duration và chỉ commit sau impact.
- Source audit: Pokémon Showdown commit `aa17ca0fac8bc5605df673bd8774c2d0e91efa43`, `data/moves.ts` và `data/items.ts`; review record nằm ở `app/content-src/beta-slice-v4-review.json`.
- Coverage tự động: 113/862 entry supported cho mỗi format; move FX 34/34. Unit/integration tests bao phủ wrong category, Single/Double modifier, critical bypass, Light Clay scope, duplicate cast, expiry, immutability và dynamic Speed cùng turn.
- Browser QA trên room local riêng: catalog tự rebase lên Beta v4; Training cho phép lưu Tailwind, Reflect và Light Clay. Trong Double Battle, Feraligatr Speed 143 đi trước Decidueye Speed 134; Tailwind chỉ xuất hiện ở impact, sau đó Blastoise được tính lại từ Speed 130 lên 260 và vượt Decidueye địch Speed 134 ngay trong cùng turn. Battle Log ghi PP, duration 4 turn, chip còn 3T sau end-turn và browser không có warning/error.
- Gate hoàn tất: `npm run check`, `npm run beta:validate` và full suite `299/299` đều đạt.

## R3-98 — Pokédex Archive + Roster Ranch UI

- **Pokédex Archive:** schema-3 Collection now browses all **213 canonical non-Mega Regulation M-A entries** instead of rendering only owned cards. The screen uses a five-column keyboard/controller grid, selected-entry detail pane, Pokédex number, types, height/weight, Abilities, base-stat bars, current build details and ownership state without changing progression data.
- **Filters and forms:** Archive adds name/National-Dex search, type filter and ownership filter (Owned / Trial / Expired / Locked). Same-Dex canonical forms share a form tray; legal M-A Mega relations appear in that tray as battle transformations with their Mega Stone requirement, while ownership remains attached to the base/non-Mega Ranch entry. Q/E (`PAGE_LEFT/PAGE_RIGHT`) cycles forms and Cancel clears form/filter state before leaving the screen.
- **Roster Ranch:** Recruitment now uses the same Pokémon game-selection language: ten rotating offers appear in a cursor grid while one selected partner owns the detail/actions pane. The pane shows type, physical data, legal Abilities, authoritative sample build, move/category/PP, permanent cost, Trial status and coin/ticket actions. Existing revision/cycle/action-ID server contracts are unchanged.
- **Input and long-list behavior:** Archive and Recruitment are routed through the shared R3-92 `GameUiController`. `FocusManager` now scrolls opt-in long grids (`data-ui-scroll-container`) so keyboard/controller focus cannot move beyond the visible Pokédex window. Search redraw preserves text focus/caret.
- **Asset-safe presentation:** R3-98 does not pretend full artwork closure. The thirteen local artwork assets are used where available; other M-A entries render an explicit local placeholder rather than generating 200+ broken network requests. Full sprite/art closure remains R3-99 scope.
- **Testing/Gates:** added 6 R3-98 regression tests for 213-entry rendering, search/type/ownership filters, Charizard/Lycanroc form trays, page/cancel behavior, ten-offer Ranch selection and revision-safe recruitment actions. Focused UI/progression/client/battle gate **63/63** pass; `npm run check` pass with **490/490 profiles + 490/490 timelines**, foundation **277 forms**, M-A **213 + 59 = 272**, Mega M-A **59/59**; full regression **1081/1081** pass.
- **Next:** R3-99 moves to Asset Closure + Audio + Polish: canonical artwork/front/back/icon manifests for required M-A forms, audio routing/UI SFX, transition polish, responsive/accessibility QA and release-grade missing-asset validation.

## R3-99 — Presentation Asset Pipeline + Audio + Release Polish

- **Canonical M-A asset manifest:** added generated `presentation-assets-v1` for all **272 Regulation M-A selectable entries** (213 non-Mega + 59 Mega). Every entry now resolves local `front`, `back` and `artwork` presentation paths; the generator/validator is part of `npm run check` and rejects stale manifests or scope drift.
- **Honest bespoke coverage:** R3-99 does not relabel placeholders as finished Pokémon art. Current local bespoke coverage is **13 front sprites / 13 back sprites / 13 artwork**; the other entries intentionally resolve to one local Aether fallback asset, so there are **272/272 fallback-safe entries and zero broken/remote presentation URLs**. This keeps missing licensed artwork visible as asset debt instead of producing runtime 404s.
- **Shared asset resolver:** Battle, Training/Summary, Party and Archive/Ranch presentation now use generated `presentation-assets.js` instead of independently guessing sprite paths. Missing bespoke assets render the same explicit local fallback with a visible `LOCAL FALLBACK` treatment.
- **Audio router:** added a local Web Audio `AudioManager` that consumes the semantic audio cues already emitted by the R3-94/R3-96 presentation runtime. UI confirm/focus cues and battle semantic cues are synthesized locally; no external audio asset or network dependency is introduced. Settings now expose audio enable/disable and master volume and persist through the existing browser settings store.
- **Responsive/accessibility polish:** added coarse-pointer minimum touch targets, mobile audio/settings layout, global reduced-motion hardening, explicit fallback styling and reusable screen-reader utility support. Existing ARIA live battle/message regions remain authoritative; decorative presentation assets do not carry gameplay state.
- **Testing/Gates:** added 4 R3-99 tests for the 272-entry manifest, resolver fallback behavior, audio settings semantics and settings/accessibility wiring. `npm run check` passes with asset validation, **490/490 Move FX timelines**, foundation **277 forms**, M-A **272/272**, Mega M-A **59/59**; full regression **1085/1085** passes.
- **Known release debt:** bespoke Pokémon art/sprite coverage remains **13/272** by design. R3-100 must treat this separately from path/runtime completeness and must not claim third-party Pokémon art has been cleared unless source/license provenance is explicitly approved.
- **Next:** R3-100 runs the M-A Presentation Release Gate: full Single/Double scenario matrix, all 59 Mega presentation paths, special-form/state smoke, 490 move FX resolution, mobile/keyboard/reduced-motion/skip QA, save/offline packaging, and a final explicit decision on whether bespoke artwork debt blocks release.

## R3-100 — M-A Presentation Release Gate

- **Status:** DONE for the M-A engineering/runtime release gate; bespoke Pokémon art remains an explicit, non-hidden presentation debt.
- **Release auditor:** added `release/ma-release-gate.mjs` + `npm run release:validate`. `npm run check` now fails on M-A scope drift, missing/legacy Move FX timelines, broken presentation-asset resolution, external HTTP(S) runtime references, or missing keyboard/reduced-motion/coarse-pointer/responsive release contracts.
- **Offline closure:** removed the Google Fonts runtime import from `public/style.css`. Public HTML/CSS/JS/JSON now has **0 external runtime URL references** (the SVG XML namespace is explicitly not treated as a network dependency).
- **Battle Lab:** added `server/v3-battle-lab.mjs`, a deterministic sandbox helper that builds legal six-Pokémon schema-3 teams, opens Single/Double battles and can advance an authoritative command turn without rewards or save mutation.
- **Release matrix:** `npm run release:matrix` groups the canonical M-A roster into deterministic Battle Lab scenarios. It covers **213/213 non-Mega species in Single**, **213/213 in Double**, **59/59 M-A Mega evolution + presentation paths**, 9 special presentation event families and **490/490 move timelines with authoritative commit markers**.
- **Save/restart/offline/input:** existing schema-3 migration/restart regression remains in the full suite; R3-100 adds offline URL scanning and explicit keyboard/mobile/reduced-motion checks rather than treating them as manual assumptions.
- **Asset truth:** manifest remains **272/272 fallback-safe** but bespoke front/back/artwork is only **13/272**. The release report records **259/272 bespoke art debt**; this is not considered missing-path/runtime breakage and is not mislabeled as complete art coverage.
- **Generated report:** `docs/r3-100-ma-release-gate.json` records the machine-readable gate state; `docs/r3-100-ma-release-report.md` explains the product decision and remaining debt.
- **Testing/Gates:** R3-100 adds 4 tests; `npm run check` passes with release validation and full regression reaches **1089/1089**.
- **Next:** continue with approved/provenance-safe bespoke Pokémon asset waves and deeper signature animation/audio polish without reopening M-A mechanics or weakening the release gate.

## R3-101 — Signature Move Presentation Wave 2 + type-aware audio

- **Signature coverage:** active M-A move presentation now reports **30 signature timelines + 460 parameterized timelines + 0 legacy + 0 missing** across the same 490/490 active moves. The second wave promotes Ice Beam, Psychic, Moonblast, Sludge Bomb, Flash Cannon, Air Slash, Stone Edge, Bug Buzz, Dark Pulse, Aura Sphere, Hydro Pump, Fire Blast, Thunder, Leaf Blade, Iron Head, Extreme Speed, Blizzard, Focus Blast, Power Gem and Will-O-Wisp.
- **18-type closure:** the 30 signature timelines collectively cover all **18 Pokémon move types**. Wave-2 primitives include dedicated ice crystal/beam/burst, psychic and dark rings, moon/fairy burst, poison sludge, steel cannon/impact, air blade, stone spike, sonic ring, aura sphere, hydro jet, Fire Blast star, Thunder strike, leaf slash, speed streak, Blizzard flurry, Focus Blast orb/burst, gem burst and Will-O-Wisp ghost flame.
- **Data-driven authoring:** signature definitions moved to `presentation/signature-move-specs.js`; timeline generation now branches on reusable families (`projectile`, `beam`, `pulse`, `slash`, `rush`, `target-rise`, `target-strike`, `field-storm`, `barrage`, plus the Wave-1 field/barrier/combo families) instead of extending a move-ID `if` chain.
- **Audio polish:** semantic move audio is now type-aware for all 18 types. Signature cues use a stronger local synthesized envelope while still remaining offline/provenance-safe; no Pokémon audio asset is bundled or fetched.
- **Status correctness:** Will-O-Wisp has a signature visual but does not fake a damaging target shake. Damage/state commits remain authoritative and happen only at the existing impact marker.
- **Testing/Gates:** R3-101 adds 6 tests and keeps the Wave-1 contracts intact. Focused UI/battle/release/FX gate **68/68** passes; `npm run check` passes with **30 signature + 460 parameterized + 0 legacy**, M-A **272/272**, asset resolution **272/272**, foundation **277 forms**; full regression reaches **1095/1095**.
- **Next:** continue bespoke signature animation waves and provenance-safe Pokémon asset waves without weakening the R3-100 release gate or reopening locked M-A mechanics.

## R3-102 — Gen III / GBA Pixel UI Overhaul (visual candidate)

- **Status:** FUNCTIONALLY GREEN / AWAITING USER VISUAL APPROVAL. This is intentionally a large presentation batch for hands-on style testing rather than a claim that the final art direction is already approved.
- **Visual direction:** locks the UI to a Gen III/GBA/PokéRogue-inspired pixel grammar rendered on a modern browser surface. `public/pixel-era-ui.css` is loaded last as a compatibility/rebaseline layer so the R3-92–R3-101 state/input architecture remains intact.
- **Global shell:** the former fixed dashboard sidebar is restyled into a horizontal game-menu bar; resources become compact HUD cells; content sits on a tiled game surface instead of modern rounded dashboard cards.
- **Pixel primitives:** square corners, hard inset highlights, hard offset shadows, offline monospace/system pixel-like typography, explicit `image-rendering: pixelated`, yellow cursor focus, cartridge-style button pressed states and hard-edged progress/HP geometry.
- **Battle:** keeps the authoritative R3-93 command state machine but presents it as a 320×180-inspired 16:9 composition. Battlefield, HUD, message/command dock, move tiles, target tiles, review and replacement cards all use the same GBA-like window grammar. HP tween uses stepped presentation while damage commit remains authoritative.
- **Management:** Summary/Training, Party, Pokédex and Roster Ranch share the same blue-header / cream-window / navy-border language and square indexed selectors. Existing keyboard/controller cursor behavior is preserved.
- **Offline/accessibility:** no external font or runtime URL was introduced; large-text scaling still uses `--scale`; reduced-motion disables the new cursor/prompt animation; semantic DOM/input contracts remain unchanged.
- **Standard:** `docs/pixel-presentation-standard.md` records the visual rules for future batches.
- **Testing:** new R3-102 visual contract suite adds 5 tests. Targeted UI/release gate 30/30 passes; `npm run check` passes with M-A 272/272, Move FX 490/490, foundation 277 forms, fallback-safe assets 272/272; full regression reaches **1100/1100**.
- **Browser QA limitation:** container Chromium headless could not generate even an `about:blank` screenshot due environment/headless DBus failure, so no screenshot claim is made. The R3-102 artifact is specifically packaged for direct user browser evaluation before the style is declared final.


## R3-103 — Resolution Lock + Image Resampling

- **User-feedback target:** R3-102 direction was accepted, but low-resolution/fractional image scaling produced visible jagged edges and responsive media queries changed composition between resolutions.
- **Fixed logical viewport:** added `GameViewportScaler`; the application is authored on one **1280×720** logical surface and uniformly scales to fit the physical browser. Non-16:9 displays letterbox/pillarbox instead of reflowing the game into a different composition.
- **Resolution stability:** shell, immersive battle and modal surfaces now share the same logical coordinate system. Legacy width-based responsive rules are neutralized while `resolution-locked` is active, so 1366×768, 1920×1080, 2560×1440 and 4K use the same layout proportions.
- **Image quality:** removed the effective global nearest-neighbour override. 475×475 key artwork, SVG fallback and the current cropped animated GIF battle sprites now use browser resampling, preventing the R3-102 jagged/stairstep outline caused by fractional pixel scaling. The hard-pixel style remains in windows, typography, cursor, bars and geometry rather than being forced onto every image.
- **Testing/Gates:** added 5 R3-103 tests for scale math, letterboxing, client installation, fixed-composition CSS and image-resampling cascade. Targeted UI suite **31/31** passes; `npm run check` passes with M-A **272/272**, Move FX **490/490**, foundation **277 forms**; full regression reaches **1105/1105**.
- **Next:** user browser QA across multiple desktop resolutions. If accepted, this 1280×720 logical surface becomes the presentation baseline for further bespoke sprite/art upgrades.

## R3-104 — Locked-Surface Backdrop Restore

- **User-feedback target:** R3-103 fixed the composition and image resampling, but the full-viewport `#app` host used a flat `#071323` fill. That layer covered the accepted R3-102 Pixel Era blue-grid backdrop, making letterbox/pillarbox areas appear black.
- **Backdrop fix:** the resolution-locked app host is now transparent. The original `body.pixel-era` viewport background remains visible outside the centered 1280×720 logical surface, while the logical surface, uniform fit scale and fixed composition remain unchanged.
- **Regression lock:** `r3-resolution-lock.test.mjs` now explicitly requires the resolution-locked `#app` host to stay transparent and rejects reintroducing the flat-black fill.
- **Testing/Gates:** focused Pixel Era + resolution-lock suite **10/10** passes; `npm run check` passes with M-A **272/272**, Move FX **490/490**, foundation **277 forms**; full regression remains **1105/1105**.
- **Next:** user browser QA. R3-104 intentionally changes only the viewport backdrop regression and keeps R3-103 scaling/image-quality behavior intact.

## R3-104 Asset Closure — Complete M-A local presentation pack

- **Complete local coverage:** all 272 selectable M-A entries now have a local front battle image, back battle image and artwork image. The presentation manifest reports **272/272 front + 272/272 back + 272/272 artwork**, with no selectable entry using the generic placeholder.
- **Format policy:** preserve the existing Charizard/Scizor convention. Prefer Gen V animated GIFs for front/back, then PokéAPI Showdown GIFs, then the current static PNG when no GIF exists. The resulting pack contains 258 animated front/back pairs, 14 static PNG front/back pairs and 272 PNG artwork files.
- **Form correctness:** each Mega/form resolves through its own PokéAPI identity. Mega forms are no longer displayed with their base Pokémon asset. Eleven local identifiers use explicit aliases for PokéAPI form names such as `tauros-paldea-combat-breed`, `aegislash-shield` and `meowstic-male-mega`.
- **Provenance:** `scripts/fetch-presentation-assets.mjs` is the repeatable importer. `content-src/presentation-asset-sources-v1.json` records source URL, PokéAPI ID/name, local path, byte length and SHA-256 for every file. The repository license states that the repository is distributed under CC0 while Pokémon image contents remain copyright The Pokémon Company.
- **Offline runtime:** downloaded files are served from `public/`; public runtime code contains no remote image URL. Asset acquisition is an explicit development command (`npm run assets:fetch`) and is not called by build/start.
- **Validation:** asset generation/verification reports 272/272 for all three kinds. The release auditor now returns `runtime-ready` with `bespokeDebt: 0` and no asset warning.

## Post R3-104 — Account, progression và management UI integration

- **Status (21/09/2026):** DONE cho vòng tích hợp local/public beta hiện tại. Các thay đổi dưới đây đã được nối vào cùng schema-3 runtime, không còn là mock UI rời rạc.
- **Pokédex/Recruitment continuity:** chọn Pokémon không còn kéo danh sách về đầu; vùng đang cuộn, phần tử đang focus và caret của ô tìm kiếm được giữ qua redraw. Search nhận liên tục từng ký tự và Backspace hoạt động đúng khi chuỗi còn nội dung; thao tác xoá toàn bộ chỉ chạy khi filter thật sự rỗng. Recruitment cũng không còn phát tiếng xác nhận lặp theo countdown/ticker.
- **Branding:** `app/public/logo.png` được dùng tại shell chính, màn đăng nhập và các vị trí nhận diện dự án thay cho mark tạm trước đó.
- **Beta economy:** local beta server dùng test wallet `999,999 VP + 999,999 crystals + 999 recruitment tickets` trước reward/mail phát sinh, giúp kiểm thử training, recruit và mission mà không phải chỉnh save thủ công.
- **Google/Discord auth:** Supabase OAuth là luồng đăng ký/đăng nhập chung cho Google và Discord. Server đổi authorization code, tạo session cookie đã ký, ánh xạ user thành player/room ổn định và đồng bộ basic profile. `app/supabase/migrations/202609210001_vanguard_accounts.sql` tạo `profiles`, `game_saves`, `game_save_backups` cùng RLS; `HybridAdventureStorage` giữ local fallback cho development và dùng Supabase cho tài khoản authenticated. Hướng dẫn cấu hình nằm tại `app/docs/auth-setup.md` và `app/.dev.vars.example`.
- **Account controls:** ô user cạnh wallet đã thành nút avatar có dropdown Profile, Settings và Log out; Settings được bỏ khỏi navigation bar và chuyển vào dropdown. Dropdown có keyboard/Escape/outside-click handling và giữ focus hợp lệ.
- **Mission system:** thêm Daily, Weekly và Starter Missions, reset theo UTC period, progress từ login/battle/win/recruit/ownership, badge claimable, Claim/Claim All và reward qua economy ledger idempotent. Server giữ mission state riêng, chỉ project dữ liệu cần thiết cho client.
- **Mailbox/Field Guide:** Mailbox được đổi thành nơi nhận ba thư quà chính thức với claim state và wallet reward; phần hiển thị kiểu achievement cũ đã bỏ. Field Guide cũng được gỡ khỏi router/navigation.
- **Training Room:** màn đầu có hai lựa chọn `Pokémon Training` và `Replica Teams`. Pokémon Training đi theo hai bước chọn Pokémon → chỉnh build; giá authoritative là 5 VP cho mỗi Stat Point thay đổi, 500 VP cho Nature, 500 VP cho Ability và 250 VP cho mỗi move thay đổi. Replica Teams tạo Team ID `PV1.*`, đọc/paste/share team và chỉ apply nếu người chơi sở hữu đủ Pokémon cùng content hợp lệ.
- **Team Builder + Held Items:** Team Builder dùng bố cục hai vùng theo hướng Pokémon Champions: rail sáu thành viên bên trái, selector/build detail bên phải. Held Items được chuyển thành một workspace bên trong Team Builder; đổi item lưu qua `buildV3.save` và không tính training VP. Màn hiện tại dùng gần trọn logical surface, rail rộng hơn, card không cắt item, danh sách held item hai cột và detail pane dễ đọc hơn; thay đổi được scope riêng cho route `teams` để không làm lệch Battle hoặc các màn khác.
- **Held-item asset closure:** toàn bộ 141 item đang map dùng chung một Pokémon Showdown sprite sheet local `app/public/item-sprites/itemicons-sheet.png`, không trộn icon từ nhiều bộ. `app/scripts/fetch-item-assets.mjs` tạo/verify mapping, `app/public/js/item-sprites.js` cung cấp tọa độ CSS và `app/docs/item-assets-manifest.json` ghi source URL + sprite index. `npm run assets:validate` kiểm cả Pokémon presentation pack và held-item sheet.
- **Browser QA:** đã kiểm trực tiếp Team Builder và Held Items trên logical viewport 1280×720; rail, footer, two-column item list và selected-item pane đều nằm trong surface, item sprite tải local và text description có contrast đúng.
- **Validation/Gates:** `npm run check` pass; asset verifier báo **272/272 Pokémon presentation entries** và **141/141 held-item mappings**, release gate trả `runtime-ready`; full regression **1132/1132** pass, 0 fail/skip/todo.

## Post R3-104 UI hotfix — Initial loading splash alignment + scale

- **Status (22/09/2026):** DONE. Fix presentation-only cho màn loading ban đầu; không thay đổi gameplay, schema, auth, save hoặc battle runtime.
- **Root cause:** legacy rule `.loading { margin:18vh auto }` trong `style.css` vẫn còn hiệu lực dưới Pixel Era, nên toàn bộ loading surface bị đẩy xuống dù `place-content:center` đã được dùng. Loading screen cũng chưa nằm trong selector resolution-lock 1280×720, vì vậy kích thước splash không scale đồng nhất với shell/battle ở các độ phân giải khác nhau.
- **Fix:** Pixel Era loading reset `margin:0`, dùng cùng centered logical surface **1280×720** và cùng `translate(-50%,-50%) scale(var(--game-fit-scale))` với shell/battle. Logo tăng **72→96 px**, title **16→20 px**, subtitle **8→10 px** logical để splash có trọng lượng thị giác phù hợp hơn mà vẫn giữ cùng composition ở 1080p/1440p/4K.
- **Regression lock:** bổ sung test buộc loading dùng resolution lock, không được tái xuất hiện offset 18vh, và khóa kích thước focal-point mới.
- **Validation:** focused Pixel Era / resolution-lock / project-logo suite **20/20** pass; `npm run check` pass toàn bộ, gồm source syntax **333 files**, assets **272/272 Pokémon + 141/141 held-item mappings**, foundation **277 forms**, M-A **272/272**, release gate `runtime-ready`. Full `npm test` được chạy nhưng runner bị timeout sau **1082 test đã `ok`**, chưa quan sát `not ok`; vì vậy không ghi nhận một full-suite pass mới thay cho baseline **1132/1132** trước hotfix.

## Post R3-104 Management refresh — Multi-team autosave + Achievements + Held-item filters

- **Status (22/09/2026):** DONE. Batch này mở rộng management/progression UI trên schema 3 hiện có; không thay đổi M-A battle mechanics, 272-entry scope hay battle presentation contract.
- **Five Battle Teams:** mỗi schema-3 account có **5 team slot** và một `activeTeamId`. Save hiện hữu được `v3-team-slots-v1` normalize tự động lên năm slot mà không xoá team/build cũ; team đang active được dùng thống nhất ở Home, Replica Teams và Battle Preview. `teamV3.activate` là action authoritative nên lựa chọn team tồn tại qua restart/save thay vì chỉ là client tab.
- **Team Builder autosave:** bỏ `SAVE PARTY`, `RESET`, badge `Party ready for Regulation M-A` và nút Held Items bị lặp ở rail. Thay đổi tên/lineup được debounce rồi tự gửi `teamV3.save`; nếu người chơi đổi team trong lúc save đang pending, activation được queue sau acknowledgement để không mất edit. Rail có một control `ACTIVE TEAM / Team N of 5 / Change`.
- **Team selector:** thêm panel chọn team lấy cảm hứng từ cấu trúc Pokémon Champions nhưng giữ visual language pixel/window của Vanguard. Năm team hiển thị thành từng row với tên, sáu portrait thành viên và trạng thái `Current Team` / `Use Team`; đổi team không rewrite build hoặc clone battle state.
- **Mission Achievements:** Missions hiện có bốn category `Daily / Weekly / Starter / Achievements`. Achievements là lifetime progression không reset theo UTC và dùng cùng authoritative counter + idempotent economy reward flow; batch đầu theo dõi battle, win, recruit, permanent ownership và Mega Evolution milestones.
- **Held Items filter expansion:** workspace item hiện có `Recent`, `All`, `Stat Boost`, `Power Boost`, `Defense`, `Recovery`, `Effect Extend`, `Berry`, `Mega Stone`, `Other`. Recent giữ lịch sử chọn item trong client session và seed từ held items của active team; item đang được member khác của active team giữ được đánh dấu `IN USE` để tránh tạo Item Clause violation.
- **Migration/integration:** current schema-3 save có một team được nâng lên năm team slot qua release upgrader; activation làm stale unlocked Battle Preview bị clear và preview kế tiếp mặc định lấy active team. Replica Team apply cũng áp vào active team thay vì hard-code team đầu tiên.
- **Validation/Gates:** focused management/progression/missions/release/UI suite **38/38** pass; `npm run check` pass với source syntax **333 files**, Pokémon assets **272/272**, held-item mappings **141/141**, foundation **277 forms**, M-A **272/272** và release gate `runtime-ready`. Full TAP runner phát summary **1137/1137 pass, 0 fail/skip/todo**; process vẫn giữ handle sau summary như limitation runner đã quan sát ở các checkpoint trước.

## Post R3-104 Shop + public-account storage — Champions item acquisition + cloud-save hardening

- **Status (22/09/2026):** DONE. Batch này đưa held-item ownership/shop vào authoritative schema-3 progression và chuyển account runtime theo hướng public-first; không thay đổi M-A battle mechanics, 272-entry scope hay damage/event ordering.
- **Header Shop:** thêm tab `Shop` trực tiếp trên top header. Shop có các view `All / Held Items / Berries / Mega Stones / Owned`, dùng sprite item local hiện có, hiển thị source unlock và VP balance; purchase gửi `shopV3.buy` lên server thay vì mutate client state.
- **Pokémon Champions acquisition source:** `content-src/champions-item-acquisition.json` khóa dữ liệu theo Serebii Pokémon Champions Items page. Active M-A battle-item catalog hiện có **141/141 acquisition mappings = 10 Beginning + 122 Shop + 8 Mega Evolution Tutorial + 1 deposit-only**. Beginning items là Bright Powder, Choice Scarf, Focus Band, Focus Sash, King's Rock, Leftovers, Quick Claw, White Herb, Lum Berry và Sitrus Berry. Shop pricing trong active catalog dùng 400 VP cho Berry, 700/1000 VP cho held items theo source và 2000 VP cho Mega Stones được bán; Floettite là deposit-only.
- **Authoritative ownership:** `progressionV3.ownedItemIds` là nguồn sự thật. Account mới chỉ nhận 10 Beginning items; mua item trừ VP qua economy ledger/idempotent action receipt. `buildV3.save` và Replica Team apply từ chối item chưa sở hữu. Recruitment build fallback chọn một owned item hợp lệ thay vì tự cấp item Shop.
- **Save migration:** schema-3 save cũ được thêm Beginning unlocks và bảo toàn item đang equip để không phá build hiện hữu. Sau migration, item mới vẫn phải được unlock qua source tương ứng; không có browser-local inventory riêng.
- **Public account storage:** Google/Discord chỉ được quảng bá/khởi động khi Supabase Auth **và** server-side cloud-save key đều sẵn sàng. UUID account room không còn silently fallback sang local JSON nếu cloud storage thiếu cấu hình. `AUTH_ALLOW_LOCAL_BETA` và `BETA_TEST_FUNDS` đều là development-only opt-in, mặc định production không bật.
- **Test runner hardening:** `npm test` chuyển sang `scripts/run-tests-batched.mjs`, tự discovery toàn bộ `tests/*.test.mjs`, chạy theo batch với `--test-force-exit`, timeout per-batch và aggregate summary. Việc này tránh command line quá dài và giảm rủi ro runner giữ handle sau khi đã in TAP summary.
- **Validation/Gates:** `npm run check` pass với source syntax **338 files**, item acquisition **141/141**, assets **272/272 Pokémon + 141/141 item mappings**, foundation **277 forms**, Mega M-A **59/59**, M-A **272/272**, release `runtime-ready`. Full suite được xác nhận theo 9 batch: **1146/1146 pass, 0 fail/skip/todo**.

## Post Shop integration — Shop navigation/detail/list usability fix — 22/09/2026

- **Navigation correction:** Shop is now a normal main navigation entry between Recruitment and Missions. The temporary topbar Shop button was removed so route ordering matches the primary game navigation contract.
- **Item detail sprite correction:** Shop detail preview now scales the sprite-sheet cell itself to 72 px (`background-size/background-position` use the same logical cell size) instead of only enlarging the element box around a 24 px cell. Shop also owns its sprite base rule rather than depending implicitly on Team Builder CSS.
- **List scrolling:** fixed a CSS cascade bug where the later `.aether-window { overflow:hidden }` rule overrode Shop's `overflow:auto`. `.shop-grid.aether-window` now explicitly owns vertical scrolling and renders a visible scrollbar.
- **Search:** added a Shop item search field above the item list. Search filters by item name/ID and participates in the existing redraw continuity path so typing focus/caret is preserved.
- **Regression/gates:** router/UI focused tests pass; Shop focused rendering/search checks pass; `npm run check` passes with item acquisition 141/141, presentation assets 272/272, M-A 272/272 and Move FX 490/490.

## Post Shop integration — Shop card density + list sprite fit — 22/09/2026

- **Two-column list:** desktop Shop list now uses **2 item cards per row** instead of 3. Cards have more horizontal room for item name, price/source and status badge without shrinking the button into a cramped layout.
- **Card sizing:** each Shop card now owns a stable 50 px icon column, 76 px minimum card height and full-width/min-width guards so grid compression cannot collapse the control.
- **Sprite fit:** list sprites are scaled as real **36×36 px sprite-sheet cells** inside a 46×46 icon well; `background-size` and `background-position` are scaled with the cell, so the icon itself grows to match the card instead of leaving a 24 px sprite floating inside a larger button. At narrower management layouts the icon steps down to 32×32 while the grid remains two columns until the existing single-column mobile breakpoint.
- **Regression lock:** Shop UI regression now asserts the two-column desktop grid, minimum card geometry and scaled sprite-sheet coordinates. Focused render/CSS checks pass; `npm run check` passes with item acquisition **141/141**, presentation assets **272/272**, M-A **272/272** and Move FX **490/490**.


## Post Shop UI hotfix — 22/09/2026 — card geometry / sprite containment

- **Root cause:** `shop.css` defined roomy Shop cards, but `pixel-era-ui.css` is loaded later and its global `body.pixel-era button { min-height: 30px; }` selector had higher specificity than the unscoped `.shop-card` height rule. The Shop buttons therefore collapsed to the global 30px primitive while their 36px sprites remained larger, producing the apparent icon overflow seen in the Shop list. The number of columns was not the underlying defect.
- **Fix:** add Pixel-Era-scoped Shop geometry that outranks the global button primitive; Shop grid now starts tracks at the top with `grid-auto-rows: minmax(80px, max-content)`, each card is at least 80 logical px tall, and the icon frame/sprite are contained at 48/40 logical px respectively. Two-column desktop layout remains because it gives names/pricing comfortable horizontal room, but card height is now independent of the generic button rule.
- **Regression:** Shop test now explicitly reads both `shop.css` and the later `pixel-era-ui.css`, verifies the competing 30px global rule exists, and requires the scoped Shop override plus scaled sprite geometry so this cascade bug cannot silently return.
- **Gates:** focused Shop suite **8/8** pass; `npm run check` pass; full batched regression **1147/1147** pass, 0 fail/skip/todo. M-A remains **213 + 59 = 272**, Move FX **490/490**, presentation assets **272/272**, held-item acquisition/assets **141/141**.

## Post R3-104 — Trainer Profile / account progression surface (22/09/2026)

- **Dedicated Profile route:** avatar dropdown `Profile` no longer aliases Settings. `profile` is a private application route opened from the account dropdown, while Settings remains a separate destination.
- **Authoritative profile projection:** server adds `profileV1`, derived from schema-3 progression, lifetime mission counters, battle wins, badges, owned Pokémon/items, active team and achievement state. The client does not reconstruct gameplay totals from DOM/local storage.
- **Trainer card UI:** Profile shows connected account identity/avatar/provider, save connection state, Regulation M-A, battle/win/roster/item/Mega/badge summary cards, the six-member active Battle Team, achievement progress and direct links to Team Builder, Missions and Settings.
- **Privacy boundary:** account UUID, room ID, service credentials and other storage identifiers are not rendered on Profile. Display name/avatar continue to come from the authenticated Google/Discord session.
- **Presentation:** new `profile.css` uses the current Pixel Era window language, logical 1280×720 layout and responsive fallbacks without changing battle/content mechanics.
- **Validation/Gates:** dedicated Profile regression **4/4** pass; `npm run check` pass with source syntax **340 files**, item acquisition **141/141**, presentation assets **272/272**, Move FX **490/490**, M-A **272/272**, release `runtime-ready`; full batched regression **1151/1151 pass, 0 fail/skip/todo**.


## Post Profile — Profile portrait normalization + Ranked PvP Beta v1 — 23/09/2026

- **Profile portrait normalization:** Active Battle Team cards no longer use battle front GIFs with heterogeneous source canvases. Profile now resolves the normalized local 475×475 artwork asset for each selected species/form, contains it inside a fixed portrait well with `object-fit: contain`, and clips overflow. This removes the apparent per-species scale mismatch seen with Charizard/Decidueye/Blastoise-class battle GIF canvases while leaving battle sprites unchanged in the battle renderer.
- **Ranked account surface:** Profile projection now includes the account Ranked summary (tier/rating, W-L-D and peak rating) without exposing account UUID, room ID or storage credentials.
- **Ranked Beta v1:** added a two-account server-authoritative Ranked service on schema 3. Google/Discord accounts can queue separately for Single or Double; matchmaking uses regulation/catalog/rules compatibility plus a rating window that widens with queue time. Local/dev identities are not Ranked eligible.
- **PvP battle lifecycle:** a matched pair enters closed-team preview, each player locks the legal Regulation M-A pick count, and the server creates one shared deterministic schema-3 PvP battle. Commands remain private until both sides submit, then resolve through the same mechanics/turn-order pipeline as local schema-3 battles. Replacement choices likewise wait for all required sides; surrender works during preview or battle.
- **Perspective privacy:** each account receives its own `viewFor` projection. Opponent roster preview omits build IDs; battle snapshot/events are projected per side and do not expose the other player's pending commands. The client reuses the existing battle shell/presentation runtime with an explicit `ownSide` perspective rather than inventing a second battle engine.
- **Rating/record:** Ranked state is stored in the account save. Beta v1 pins `seasonId=2026-S1` and Vanguard-owned `elo-v1-k32`; settlement is derived only from the authoritative match result, writes W/L/D, current/peak rating and recent match history, and applies once per match. Ranked battles feed the existing battle/win mission counters. This is a Vanguard rating design, not a claim about Pokémon Champions' unpublished algorithm.
- **Reconnect scope:** WebSocket reconnect within the same server process restores the player's current queued/matched view and marks connection presence. Queue/match runtime is still process-memory state; process-restart resume, persisted replay/room receipts, competitive clocks/deadlines, spectator role, region matchmaking, moderation/abuse controls, season transition/rewards and multi-node coordination remain explicit M6/M7 production work rather than being presented as complete.
- **UI:** Battle landing now exposes Ranked Single/Double above AI practice, with linked-account eligibility, rating/tier/record, queue screen, opponent identity, preview waiting state, command/replacement waiting messages and post-match rating delta. Ranked activity blocks team/build/recruit/shop mutation while a queue/match is active.
- **Validation:** dedicated Profile/Ranked/battle-shell focused regression is green; `npm run check` passes with source syntax **341 files**, item acquisition **141/141**, Pokémon assets **272/272**, Move FX **490/490**, foundation **277 forms**, M-A **272/272** and release gate `runtime-ready`. The prior Profile baseline was **1151/1151** tests; this batch adds one six-test Ranked suite while keeping the two modified existing suites at the same test counts, for **1157 expected total tests**. The monolithic aggregate command can exceed the chat execution window, so the remaining late batches were also rerun directly with 0 failures rather than claiming process-restart or infrastructure coverage that is not implemented.

## Post Ranked Beta v1 — Controlled codebase cleanup / module boundaries — 23/09/2026

- **Behavior-preserving refactor:** this batch intentionally changes project structure and naming without changing battle/content/save contracts. Generated `app/src/logic.js` / `app/src/v2-engine.mjs` and frozen `app/server/legacy/logic-v1.js` remain untouched as development targets.
- **Held-item mechanics split:** `mechanics-v3/item-hooks.mjs` is now a small compatibility facade. Implementation is separated into `item-hooks/state.mjs` (identity/ownership/consume/transfer), `item-hooks/modifiers.mjs` (stat/type/accuracy/Choice modifiers), `item-hooks/combat.mjs` (damage/reactive/turn-order item mechanics) and `item-hooks/status-lifecycle.mjs` (cure/end-turn lifecycle). Existing import paths and public exports remain stable.
- **Passive validator split:** the former 576-line `passive-handler-validation.mjs` is now a dispatcher over `passive-validation/ability-core-handlers.mjs`, `ability-lifecycle-handlers.mjs` and `item-handlers.mjs`. Validator output was compared against the pre-refactor implementation across **22,127 handler occurrences** from checked-in content with **0 differences**.
- **Naming cleanup:** active presentation code uses canonical `renderPokemonWindow` and `vanguard:battle-*` browser event names. `renderAetherWindow` remains only as a compatibility alias. Stale Aether branding was removed from active classic UI/tooling/schema titles; the frozen legacy engine metadata is intentionally preserved.
- **Structure gate:** added `npm run structure:validate` to `npm run check`. Production JS/MJS modules are capped at **360 lines**, excluding generated `app/src`, tests and the frozen legacy snapshot. Current production maximum is **338/360** lines. The gate exists to prevent unrelated responsibilities from accumulating again.
- **Architecture guide:** added `docs/code-structure.md` defining ownership boundaries for `rules-v3`, `mechanics-v3`, `server`, browser presentation, content/tooling, generated artifacts and compatibility facades. `pixel-era-ui.css` remains intentionally unified because it is the final theme/resolution-lock cascade; route-specific styling stays in dedicated page sheets.
- **Validation/Gates:** `npm run check` passes with structure gate, item acquisition **141/141**, presentation assets **272/272**, Move FX **490/490**, foundation **277 forms**, Mega M-A **59/59**, M-A **272/272** and release `runtime-ready`. Full regression was verified by the existing ten test batches: batches 1–8 = **1057/1057**, batch 9 = **86/86**, batch 10 = **14/14**, total **1157/1157 pass, 0 fail/skip/todo**.

## Post cleanup — Ranked tier assets + five-tier ladder integration — 23/09/2026

- Ranked ladder now uses the five Vanguard tiers: **Poké Ball 0–1199 RP**, **Great Ball 1200–1599**, **Ultra Ball 1600–1999**, **Master Ball 2000–2399**, **Challenger 2400+**. The Elo `elo-v1-k32` settlement model remains unchanged.
- Five transparent rank assets under `app/public/ranks/` are projected from authoritative tier metadata and used by Profile and Ranked surfaces. `npm run rank-assets:validate` is part of `npm run check`.
- Rank presentation uses contained pixel rendering so the final Pixel Era image rules cannot blur/crop the checked-in emblems.
- Validation at that milestone: focused Profile/Ranked/rank assets **11/11 pass**, full batched regression **1158/1158 pass**.

## Post rank integration — Arena hub, Training modes, Friendly Rooms & Social v1 — 23/09/2026

- **Arena IA:** the `Arena` navigation now opens a hub with **Ranked** and **Training**. Training branches into **Battle Practice** (PvE) and **Friendly Battle** (private PvP). The existing `Training Room` remains the Pokémon build/stat editor.
- **Team-first launch:** Ranked search, PvE start, Friendly room creation, room-code join and invite join all expose/select one of the five saved Battle Teams before matchmaking/start. Ranked/Friendly services snapshot the chosen team and lock management mutations while the match is live.
- **PvE difficulty:** `Rookie` uses a simple varied legal policy with no deliberate Mega Evolution; `Veteran` prioritizes base damage with light STAB weighting; `Ace` additionally evaluates STAB, type effectiveness, immunity and KO pressure. Difficulty therefore changes server-side action policy rather than only changing a UI label.
- **Training isolation:** Arena PvE sessions are flagged `training`, pay **0 VP / 0 crystals** and do not increment battle/win missions. Friendly PvP has no rating/reward settlement.
- **Friendly Battle rooms:** linked Google/Discord accounts can create a six-character Single/Double room code, copy/share it, join by code or invite an online friend. Closed Team Preview, hidden commands, replacements, surrender and reconnect-in-process reuse the shared schema-3 PvP runtime also used by Ranked.
- **Shared PvP runtime:** command/replacement resolution and player-perspective projection were extracted to `server/pvp-battle-runtime.mjs`; Ranked keeps separate queue/rating settlement while Friendly Battle keeps separate private-room lifecycle.
- **Social v1:** authoritative account save now contains friends, incoming/outgoing requests and the latest 100 direct messages per friend. Trainer Codes are UUID-backed but presented as a `PV-...` code rather than a raw account UUID. UI supports add/accept/reject/cancel/remove, online presence and chat. Messages are sanitized, capped at 500 chars and rate-limited; friend/request counts are bounded.
- **Arena social UI:** Friends & Chat is available directly from the Arena hub and alongside Friendly Battle. Open rooms can invite online friends; stale room invitations are revoked when a room fills or closes.
- **Public-beta boundary:** friend relationships and DMs persist in account storage, while live presence, Friendly rooms and room invitations remain **single-process in-memory beta state**. Server restart/multi-node recovery, centralized realtime presence, moderation/report/block tooling and production chat abuse controls remain future hardening work.
- **Validation:** `npm run check` passes with M-A **272/272**, Move FX **490/490**, Pokémon assets **272/272**, held-item acquisition/assets **141/141**, rank assets **5/5**, foundation **277 forms** and release `runtime-ready`. Focused Arena/Ranked/battle regression **17/17 pass**; broad dependency-free suite **1116/1116 pass**. The 10 HTTP/WebSocket integration test files were not rerun in this clean packaging workspace because `node_modules` is intentionally excluded and this environment could not fetch `ws`; this batch therefore does **not** claim a new full HTTP/WS integration-pass total.

## Post Arena/Social — Admin Console v1 — 23/09/2026

- **Dedicated admin surface:** added `/admin.html` as a deliberately simple management console separate from the game shell. Authenticated accounts only receive the Admin Console entry when their account ID is listed in `ADMIN_ACCOUNT_IDS`; every `/api/admin/*` endpoint repeats the authorization check server-side.
- **Player management:** searchable player list and per-account detail view include online/suspended state, save/schema metadata, wallet balances, owned Pokémon/items, Battle Teams/build summaries, Ranked record/tier, mission/achievement state, social counts and the latest admin audit entries.
- **Authoritative mutations:** admins can set VP/crystals/recruitment tickets, grant/revoke held-item ownership, grant/revoke Pokémon, change the active Battle Team, set/reset Ranked rating/record, reset Missions/Achievements, create a save backup, add a private admin note, and suspend/unsuspend accounts.
- **Invariant protection:** Beginning items cannot be revoked because they are guaranteed by the inventory migration; equipped items cannot be revoked; Pokémon referenced by any saved Battle Team cannot be removed. Granting a new Pokémon also creates a usable default schema-3 build with an item the account already owns.
- **Moderation/privacy:** `adminV1` and `adminAuditV1` are stripped from the normal player projection. Internal notes and admin audit data are visible only through the authorized admin API. Suspending an online account disconnects its game socket and future joins are rejected until unsuspended.
- **Concurrency:** admin mutations on an online account run through that room's existing action queue before persistence, preventing admin/gameplay writes from racing and overwriting one another.
- **Storage:** Supabase account listing joins the existing `profiles` and `game_saves` tables through the server service key; no new public database policy is required. JSON enumeration remains available only for explicit local-development admin use.
- **Configuration:** production admins are configured through comma-separated `ADMIN_ACCOUNT_IDS`. `ADMIN_ALLOW_LOCAL_BETA` is a development-only escape hatch and defaults off.
- **Validation:** dedicated Admin regression **6/6 pass**; `npm run check` passes with source structure **379 production modules, max 338/360**, M-A **272/272**, Move FX **490/490**, Pokémon assets **272/272**, held-item acquisition/assets **141/141**, rank assets **5/5**, foundation **277 forms** and release gate `runtime-ready`. A broad dependency-free regression run (excluding the 10 suites that import the local WebSocket server and therefore require the intentionally omitted `ws` install) passes **1123/1123** before the final admin-service lock test was added; the Admin suite was rerun separately after that change and remains **6/6**.

## Post Admin Console v1 — Admin Operations, Gift Center & Live Control — 23/09/2026

- **Gift Center:** `/admin.html` can create authoritative gift campaigns for one selected trainer, an explicit trainer-ID list, all currently online trainers, a Ranked tier cohort, or every account visible to server storage. Campaigns support VP, Crystals, Recruitment Tickets, multiple held items and multiple Pokémon. Delivery is bounded/concurrent and audited per recipient.
- **Mailbox claim semantics:** admin gifts are not silently injected into spendable balances. They are stored in the recipient's authoritative save and projected into the normal player Mailbox as claimable gifts. Claiming uses an idempotent economy receipt, grants only validated catalog items/Pokémon, and then marks the gift claimed. The sending admin account ID is never exposed in the player projection.
- **Mission & Achievement operations:** admins can Complete or Grant Reward for an individual mission/achievement, Complete All or Grant Claimable for a category, reset a single category, or reset all mission/achievement progress. Daily, Weekly, Starter and lifetime Achievement state all use the existing mission engine rather than separate admin-only counters.
- **Live Operations:** Admin Console now projects active Ranked queue/matches, Friendly rooms/matches and PvE battles. An admin can stop a selected trainer's active activity. Ranked stops are **no-contest** with zero RP delta, no W/L/D increment and no battle/win mission settlement; Friendly active matches end no-contest and pre-battle rooms are dissolved; PvE battles end with `admin-stop` and reward 0.
- **Session/moderation split:** `Disconnect session` is separate from suspend/unsuspend. Disconnect removes the current live session without changing account eligibility; suspension remains a persistent moderation state that rejects future joins until lifted.
- **Concurrency and safety:** admin account mutations continue through the same per-account action queue used by live gameplay before persistence. Gift campaigns validate catalog IDs, keep bounded inbox history, and use a fixed recipient concurrency pool rather than spawning unbounded writes. Existing inventory/team invariants remain enforced.
- **UI organization:** Admin Console top-level views are **Players**, **Gift Center** and **Live Operations**. Player detail is split into Summary, Items, Pokémon, Teams, Progress, Live and Moderation so operational controls remain readable without turning the console into a single dense page.
- **Validation:** Admin/Ranked/Friendly focused regression **29/29 pass**; `npm run check` passes with source structure **382 production modules, max 338/360**, M-A **272/272**, Move FX **490/490**, Pokémon assets **272/272**, held-item acquisition/assets **141/141**, rank assets **5/5**, foundation **277 forms** and release gate `runtime-ready`. Broad dependency-free regression across 156 test files passes **1133/1133**, 0 fail/skip/todo. The 10 suites importing the local WebSocket server were not rerun because the clean packaging workspace intentionally contains no `node_modules`/`ws`; no HTTP/WebSocket integration-pass claim is made for those files in this batch.

## Post Admin Operations — Ranked start tier, Arena portraits & Mailbox lifecycle — 23/09/2026

- **Ranked start tier corrected:** the existing `elo-v1-k32` account baseline remains **1000 RP**, but the five Vanguard tier boundaries are now **Poké Ball 0–1199**, **Great Ball 1200–1599**, **Ultra Ball 1600–1999**, **Master Ball 2000–2399**, **Challenger 2400+**. New accounts therefore start in Poké Ball as intended; no save-wide rating rewrite is needed and existing RP values are preserved.
- **Arena team portraits:** Arena already sourced normalized 475×475 local artwork, but its CSS forced `image-rendering: pixelated` while shrinking that artwork into a very small box. Team selection now uses a dedicated 44px clipped portrait well with `object-fit: contain` and a Pixel-Era-scoped `image-rendering: auto !important`, matching the clear artwork strategy used by Profile instead of making downscaled art look jagged/unclear.
- **Mailbox lifecycle v1:** official system mail and admin gift mail now have authoritative **Unread / Read** state and server-enforced expiry. Opening mail records `readAt`; its effective expiry becomes the earlier of the original unread deadline or `readAt + read TTL`, so reading can shorten retention but can never extend a message past its original expiry. Expired mail is omitted from player projections and reward claims are rejected server-side.
- **Retention by mail type:** system notices own explicit retention windows (for example Welcome Gift 90 days unread / 14 days after read; update notices 30 / 7). Admin Gift Center adds presets **Standard Gift 14 / 3**, **Event Gift 7 / 2**, and **Compensation 30 / 7**, while also allowing an administrator to override both unread and after-read lifetimes from **1 hour to 365 days** per campaign.
- **Mailbox UI:** Mailbox badges now represent unread messages instead of merely unclaimed rewards. The list displays UNREAD/READ status, sender and remaining lifetime; opening a message reveals its contents/reward and starts the shorter after-read retention window. Admin gifts remain idempotent claimable rewards and do not expose the sending admin UUID.
- **Migration:** existing system-mail claims are migrated as read/claimed, existing admin gifts receive safe Standard retention defaults, and old saves gain mailbox lifecycle records without losing mail/reward state.
- **Validation:** focused Ranked/Profile/Arena/Admin/Mailbox/Economy regression **42/42 pass**, including the Arena portrait suite **9/9**; `npm run check` passes with source structure **383 production modules, max 338/360**, M-A **272/272**, Move FX **490/490**, Pokémon assets **272/272**, held items **141/141**, rank assets **5/5** and release `runtime-ready`. Dependency-free broad regression across 157 test files passes **1136/1136**, 0 fail/skip/todo. The 10 suites importing `local-server.mjs` were not rerun because this clean workspace intentionally has no installed `ws` dependency; `npm test` therefore reports the expected dependency error rather than a gameplay regression.


## Post Mailbox lifecycle — LA type & move-category UI symbols — 24/09/2026

- **Unified symbol family:** Pokémon Vanguard now uses the Pokémon Legends: Arceus (LA) presentation family for battle metadata: **18 type icon sprites (86×86), 18 TypeIC strips (152×36), and Physical/Special/Status category icons (50×50)**. LA was selected for move categories because all three categories are square and visually consistent with the already-selected LA type assets.
- **Shared asset contract:** `public/js/ui/pokemon-symbol-assets-data.js` is the browser-safe filename catalog; `pokemon-symbol-assets.js` owns markup, local paths and same-origin fallback behavior. External source URLs live only in `server/pokemon-ui-icons.mjs`, keeping the public runtime free of third-party URL references and preserving the R3-100 release gate.
- **Local-first delivery:** expected checked-in/vendor paths are `public/assets/ui/pokemon-types/icon`, `public/assets/ui/pokemon-types/ic` and `public/assets/ui/move-categories`. `npm run assets:ui-icons` downloads and validates all **39** source PNGs; until they are vendored, missing local images retry through `/api/ui-symbols/...`, whose server proxy keeps a short-lived in-memory cache.
- **UI integration:** Team Builder, Training move summaries, battle Fight move tiles, Recruitment/Ranch sample builds and Pokédex detail now use the shared type/category helpers. Compact battle controls use the 86×86 type icon, while management/detail surfaces use the wider TypeIC label; move rows display Physical/Special/Status as a dedicated icon rather than text alone.
- **Cascade/layout safety:** `pokemon-symbols.css` loads after the theme sheets and explicitly owns sprite dimensions plus `image-rendering: pixelated`; Recruitment's old generic `.ranch-moves span` grid rule was narrowed so the new nested category metadata cannot inherit the two-row type slot.
- **Validation:** focused symbol + Training/Team/Battle UI regression **20/20 pass**; `npm run check` passes with source structure **387 production modules, max 338/360**, Move FX **490/490**, M-A **272/272**, Pokémon assets **272/272**, held-item assets/acquisition **141/141**, rank assets **5/5**, and release `runtime-ready`. Broad dependency-free regression across **158** test files passes **1140/1140**, 0 fail/skip/todo. The same 10 suites importing `local-server.mjs` were not rerun because this clean workspace intentionally has no installed `ws` package.


## Post LA icon integration — Battle move-card visual refresh — 24/09/2026
- Battle Fight move cards now use an icon-only metadata row: Type LA icon + Move Category LA icon; redundant `Type · Category` text was removed from each move tile.
- Move cards now use a clearer two-zone hierarchy: move name/icons on the left and a dedicated PWR/PP stat rail with divider on the right.
- Move Category LA glyphs are semantic-color tinted across the UI: Physical warm orange-red, Special indigo-blue, Status teal-green.
- Final battle geometry lives in `pokemon-symbols.css`, which intentionally loads after `pixel-era-ui.css`, preventing Pixel Era global move-tile rules from collapsing the refreshed layout.

## Post Battle move-card refresh — Battle presentation cadence + draggable log + field polish — 24/09/2026

- **Draggable Battle Log:** the in-battle Battle Log can now be repositioned by dragging its title bar. Position is stored as normalized stage coordinates so rerenders preserve it and resize clamps it back inside the battle viewport; double-clicking the title resets the default top-right position. Drag geometry is implemented in `public/js/ui/battle-log-drag-controller.js` and its final Pixel-Era override is deliberately loaded after the theme sheet.
- **Surrender confirmation:** Ranked, Friendly Battle and PvE Battle Practice no longer submit a surrender directly from a single click. They open a project-styled confirmation dialog with mode-specific consequences before the existing authoritative surrender action is sent. Ranked copy explicitly warns that the normal loss/rating settlement applies; Friendly/PvE retain their existing no-RP/training-reward semantics.
- **Presentation cadence:** normal move playback now uses a centralized **1450 ms cast/travel + 720 ms impact** cadence. Mega, switch, recharge, cancelled action and end-turn presentation timings were lengthened consistently; 2× playback continues to halve waits for players who prefer faster battles. Move presentation cues are retimed from the previous 1050/420 definitions rather than stretching only CSS animations.
- **Contact-before-damage presentation:** schema-3 still resolves the turn server-authoritatively, but the client no longer draws the turn's final authoritative snapshot before playback begins. A move cast frame keeps the pre-hit HP/state, USER_TO_TARGET FX remains visible through the end of travel, then the impact frame commits damage/status outcomes. HP bars animate from `hpBefore`/`hpBeforePercent` to the committed value during the 720 ms impact beat. Because `V3PlaybackRunner` awaits each frame, the next Pokémon's cast cannot begin until the previous Pokémon's impact frame finishes.
- **Weather visual pass:** Rain now uses separate near/far streak layers and a restrained dark atmosphere; Sun uses a localized source plus slow rays; Sandstorm separates broad dust drift from particle specks; Snow uses two particle depths. Effects remain behind UI and are tuned to avoid obscuring Pokémon.
- **Terrain/floor visual pass:** Electric, Grassy, Misty and Psychic Terrain now read as floor-plane effects rather than a full-screen tint. Electric gains subtle grids/sparks, Grassy gets a blade silhouette layer, Misty uses low drifting fog and Psychic uses floor rings/scan energy. Trick/Wonder/Magic Room overlays were also reduced so they remain atmospheric instead of overpowering fighters.
- **Animation polish:** actor cast/lunge/hit/shake, fallback move FX, Mega/form/faint transitions and projectile travel were slowed and synchronized with the centralized timeline. Reduced-motion continues to disable these animations without changing authoritative snapshot order.
- **Regression:** new presentation tests lock sequential `cast → impact → next actor`, pre-hit versus impact HP snapshots, retimed projectile contact, HP commit animation, Battle Log drag clamping/persistence, surrender modal wiring and weather/terrain ownership. Focused battle/presentation regression **55/55 pass**; `npm run check` passes with source structure **389 production modules, max 352/360**, Move FX **490/490**, M-A **272/272**, Pokémon assets **272/272**, held items **141/141**, rank assets **5/5** and release gate `runtime-ready`. Broad dependency-free regression across **159** test files passes **1147/1147**, 0 fail/skip/todo. The 10 suites importing `local-server.mjs` remain excluded in this clean workspace because `node_modules/ws` is intentionally not packaged; no WebSocket-integration pass claim is made for those files in this batch.

## Post Battle presentation cadence — Admin search / Gift expiry input / Team sync hotfix — 24/09/2026

- **Admin Pokémon ownership search:** the Pokémon management filter now normalizes case/diacritics and searches name, type, species ID, Mon/Build identifiers and ownership state (`Owned`, `In team`, `Not owned`). Filtered rows are hidden explicitly and an empty-result state is rendered, avoiding the previous fragile browser-only filter behavior. Admin projection also deterministically prefers permanent ownership when more than one record for the same species exists.
- **Gift retention input fix:** the Gift Center's old `min="0.04" step="0.25"` combination made ordinary values such as `12` invalid because HTML number inputs use `min` as the step base (`0.04 + n×0.25`). The inputs now accept normal decimal-day values, and labels are clarified as **Expires if unread** and **Expires after opened**. Retention semantics are unchanged: unread TTL starts at send time; read TTL starts on first open; the earlier deadline wins.
- **Team autosave reliability:** the shared browser `send()` function now reports whether an action was actually sent. Team Builder no longer marks a save as in-flight when transport is busy; it retries the draft instead of silently losing it. Queued team activation waits for the pending lineup save to complete.
- **Team state continuity:** Select Team renders the current local draft while autosave is pending, navigation away from Team Builder flushes the draft, and Arena clears/reconciles its cached team selection so a Team Builder active-team change is reflected on the next Arena visit.
- **Regression:** focused Admin/Mailbox/Arena/Team tests **41/41 pass**; `npm run check` passes with source structure **389 production modules, max 356/360**, Move FX **490/490**, M-A **272/272**, Pokémon presentation assets **272/272**, held items **141/141**, rank assets **5/5** and release gate `runtime-ready`. Broad dependency-free regression excluding the 10 local-server/WebSocket suites passes **1149/1149**, 0 fail/skip/todo. Those 10 suites remain unrun in the clean workspace because `node_modules/ws` is intentionally absent.

## Post Admin/Team sync hotfix — Held-item Admin search parity — 24/09/2026

- **Held-item search parity:** Admin `Items` filtering now shares the same normalized search contract as Pokémon ownership instead of its older ad-hoc lowercase substring filter. Searches cover item name, category, item ID, acquisition source and ownership/usage state, including `Owned`, `Not owned`, `Equipped`, `In use` and `Beginning`.
- **Acquisition metadata:** the authorized admin player projection now includes each battle item's acquisition kind/label from the existing item-acquisition rules, so Admin search/display does not infer Shop/Beginning/tutorial/deposit state on the client.
- **Shared search helper:** `public/js/admin-search.js` owns normalization, metadata text construction and filter matching for both Held Items and Pokémon. Exact state queries such as `owned`, `not owned`, `equipped` and `in team` are handled deliberately so ownership searches do not regress into ambiguous substring-only behavior.
- **Empty-result UX:** Held Items now mirrors Pokémon with a clear `No held items match this search.` state when the filter has no rows.
- **Regression:** Admin focused tests **14/14 pass**, `npm run check` passes with source structure **390 production modules, max 356/360**, and broad dependency-free regression excluding the 10 local-server/WebSocket suites passes **1150/1150**, 0 fail/skip/todo. The WebSocket suites remain unrun in the clean workspace because `node_modules/ws` is intentionally not packaged.

## Post Admin Held-item search parity — Team composition persistence fix — 24/09/2026

- **Immediate lineup commits:** changing a Team Builder slot or swapping two existing members now schedules a zero-delay authoritative save instead of sharing the 220 ms team-name debounce. Team-name typing remains debounced to avoid one write per keystroke.
- **Draft persistence separated from battle legality:** `teamV3.save` and `teamV3.activate` now validate structural draft integrity (team name, six unique build IDs, existing builds) rather than rejecting the save because of competitive Species/Item Clause state. Full `validateV3Team` legality remains authoritative at Ranked/PvE/Friendly battle entry, so an invalid saved draft still cannot start a legal Regulation M-A battle.
- **Recruited Pokémon case fixed:** newly recruited builds can legitimately share a fallback held item with an existing member while the player is still editing. That temporary Item Clause conflict no longer causes Team Builder to silently keep a client-only draft; the composition persists and the UI reports `Draft saved` with the remaining clause issue for the player to fix before battle.
- **Pending-save recovery:** a rejected team save no longer leaves `pendingSnapshot` stuck forever. The browser clears the failed in-flight marker so later edits can be saved, and reconciliation now distinguishes a committed pending snapshot from an unrelated/newer server team revision instead of blindly treating every revision bump as a successful local save.
- **Arena continuity:** regression now exercises the complete path `Team Builder edit → teamV3.save → authoritative trainingV3 projection → Arena selected team`, including a newly inserted Pokémon with an Item Clause conflict.
- **Validation:** focused Team/Progression regression **26/26 pass**; `npm run check` passes with source structure **390 production modules, max 356/360**, Move FX **490/490**, M-A **272/272**, Pokémon assets **272/272**, held items **141/141**, rank assets **5/5** and release gate `runtime-ready`. Broad dependency-free regression across **159** test files passes **1153/1153**, 0 fail/skip/todo. Local-server/WebSocket suites remain excluded because the clean workspace intentionally does not include `node_modules/ws`.

## Post Team persistence fix — PvP lifecycle timers, reconnect grace & stale-match cleanup — 24/09/2026

- **Server-authoritative PvP clocks:** Ranked and Friendly PvP now use a shared lifecycle module (`server/pvp-lifecycle.mjs`). COMMAND and required REPLACE decisions have a hard **45-second** deadline. The clock starts once for the phase/revision and does not reset when the first trainer submits.
- **Deterministic timeout action:** when a trainer misses the 45-second deadline, the server builds a deterministic legal fallback from that side's current active Pokémon, preferring the first legal move/target and only falling back to a switch when no legal move can be submitted. In Double battles the server submits a complete legal command set for all active Pokémon. If both trainers time out, both fallback command sets are resolved normally in the shared schema-3 action queue.
- **Team Preview clock:** matched Ranked/Friendly previews have a **90-second** decision window. Unlocked sides are auto-locked using the first legal picks from the already-snapshotted Battle Team so a paired match cannot remain in Preview indefinitely.
- **Reconnect grace:** an active PvP participant gets **90 seconds** after the last game socket disconnects. Reconnecting in time restores control without resetting the current decision clock. If exactly one trainer exceeds the grace while the opponent is online, the disconnected trainer forfeits and Ranked settles the result normally. If both trainers exceed the grace, Ranked becomes **no-contest** with 0 RP and no W/L/D or battle/win mission settlement.
- **Stale-state cleanup:** a defensive **5-minute hard-idle watchdog** ends an otherwise stuck active match as no-contest. Friendly waiting rooms with no opponent expire after **15 minutes**. Finished in-memory PvP results are retained for **10 minutes** for reconnect/result viewing, then removed from the coordinator. Expired Friendly invitations are also pruned by the lifecycle tick.
- **UI:** Ranked/Friendly Battle and Team Preview now show a live countdown sourced from server deadlines. A second reconnect countdown appears while the opponent is offline. The browser only renders the countdown; timeout decisions remain server-authoritative.
- **Operations:** Admin Live Operations now receives decision and reconnect deadlines in Ranked/Friendly projections, making stuck/near-timeout sessions visible without exposing pending commands.
- **Boundary:** these timers harden the current single-process Ranked/Friendly beta coordinator. Match persistence across a server process restart/multi-node coordinator recovery remains a later online-hardening task; server downtime is not silently converted into a player forfeit by this batch.
- **Validation:** lifecycle fake-clock regression **5/5 pass**; focused Ranked/Friendly/Battle presentation regression **33/33 pass**; `npm run check` passes with source structure **392 production modules, max 356/360**, M-A **272/272**, Move FX **490/490**, Pokémon assets **272/272**, held items **141/141**, rank assets **5/5** and release `runtime-ready`. Broad dependency-free regression across 160 test files passes **1158/1158**, 0 fail/skip/todo. The 10 local-server/WebSocket integration files were not rerun because this clean workspace intentionally does not contain `node_modules/ws`.

## Post PvP lifecycle timers — Realtime state rendering hotfix — 24/09/2026

- **Root cause:** schema-3 PvP transport remained realtime and continued broadcasting both trainers after command submissions. The regression was in `public/client.js`: after the battle-presentation cadence change, every V3 state containing the previous resolved turn's `turnSnapshots/events` entered the playback branch, but `V3BattleScreen.playTurn()` correctly rejected an already-played turn. Because `receiveView()` returned without a normal redraw, same-turn realtime pushes (own command locked/waiting state, reconnect presence, timing/status changes) reached the browser state but were not painted until a later render.
- **Fresh-playback gate:** `V3BattleScreen` now exposes `playbackKey()` / `hasFreshPlayback()`. `receiveView()` suppresses the immediate authoritative draw only when the incoming projection contains a genuinely new resolved turn that needs animation. Same-turn pushes fall through to the ordinary `V=next → draw()` path, restoring realtime UI while preserving the impact-before-HP presentation contract.
- **Server verification:** focused regression asserts Ranked still notifies **both connected accounts** as soon as the first trainer submits a command, before the turn can resolve. Hidden simultaneous-command privacy is unchanged: the opponent does not see the submitted command contents, only live connection/match state.
- **Retention cleanup:** when a finished Ranked match reaches the existing 10-minute result-retention limit, coordinator cleanup now also notifies both accounts after removing the match mapping, so clients return to the idle Ranked view without waiting for another action.
- **Validation:** dedicated realtime/client regression **3/3 pass**; focused Ranked/Friendly/lifecycle suite **24/24 pass**; `npm run check` passes with source structure **392 production modules, max 356/360**, Move FX **490/490**, M-A **272/272**, Pokémon assets **272/272**, held items **141/141**, rank assets **5/5** and release gate `runtime-ready`. Broad dependency-free regression across 161 test files passes **1161/1161**, 0 fail/skip/todo. The same 10 local-server/WebSocket integration files remain excluded because the clean workspace intentionally does not include `node_modules/ws`.

## Post realtime hotfix — Playback baseline + WebSocket liveness hardening — 24/09/2026

- **Stale-turn replay closed:** V3 battle screens now expose `acknowledgePlayback()`. Any authoritative Ranked/Friendly/PvE state accepted without animation records the current resolved-turn key as the playback baseline. Reloading/reconnecting into an already-resolved turn, receiving a later presence/timing push, or returning to Battle after viewing another route can no longer replay that old turn and temporarily block input.
- **Realtime playback contract preserved:** genuinely new resolved turns still enter `hasFreshPlayback() → playTurn()` and keep the existing impact-before-HP cadence. Same-turn command-lock, presence, reconnect and timing pushes continue to redraw immediately without re-running animation.
- **Client half-open detection:** `AdventureConnection` now watches for `__pong` after its application heartbeat. Any inbound frame proves liveness; a silent socket is abandoned after the pong timeout and the existing reconnect backoff takes over instead of leaving the UI falsely `connected` indefinitely.
- **Server heartbeat:** local WebSocket transport now has an independent protocol-level heartbeat in `server/websocket-heartbeat.mjs`. Connections are pinged every 10 seconds by default and a socket that remains silent for a complete heartbeat sweep is terminated, allowing the existing Ranked/Friendly disconnect-grace logic to start predictably even when a TCP close event would otherwise be delayed.
- **Module boundary:** heartbeat policy is isolated from `local-server.mjs` and unit-testable without booting the full server or requiring the `ws` package in the clean archive.
- **Validation:** focused realtime/transport/Ranked/Friendly regression **33/33 pass**; `npm run check` passes with source structure **393 production modules, max 359/360**, Move FX **490/490**, M-A **272/272**, Pokémon presentation assets **272/272**, held items **141/141**, rank assets **5/5** and release gate `runtime-ready`. The full 1,100+ regression was intentionally not rerun in this batch to keep validation bounded; the clean archive still omits `node_modules`, so local-server integration suites requiring `ws` were not rerun here.

## Post realtime transport hardening — Completed-result lifecycle cleanup — 24/09/2026

- **Old result resurrection fixed:** completed Ranked, Friendly and PvE results now have a shared client lifecycle guard. A result reached live is still shown normally, but a completed result already present when the app is entered/reloaded is treated as stale, suppressed immediately and cleaned from the authoritative session instead of taking over the Arena again.
- **Cross-mode stacking fixed:** dismissing/returning from a current result also suppresses any older completed result sitting behind it. Cleanup is serialized in coordinator priority (Ranked → Friendly → persisted PvE), so a stale PvE result cannot reappear after the player finishes and dismisses a newer Ranked/Friendly match.
- **Persistent PvE dismissal:** schema-3 PvE now supports authoritative `battleV3.dismiss`. A finished Battle Practice session is removed from the saved adventure after `New battle`, route exit, stale re-entry cleanup or backgrounding; dismissal is idempotent once the saved session is already gone and refuses to clear an active match.
- **Exit/re-entry behavior:** leaving Arena while a result is complete, hiding the tab after completion, or opening the app with a previously completed result marks that result consumed. Ranked/Friendly continue using their existing server-side dismiss actions, while the new PvE action clears persisted `battleV3` state.
- **Regression:** focused completed-result/PvE/Ranked/Friendly/realtime/lifecycle regression **40/40 pass** before the project validation gate. New tests cover stale initial hydration, serialized cross-mode cleanup, Friendly dismissal and persisted PvE result removal.

## Post completed-result lifecycle — Navigation icon slot normalization — 25/09/2026

- **Navigation icons activated:** the 11 main navigation routes now use the PNG assets in `public/assets/icons/` instead of Unicode glyphs, with the updated labels `Home`, `Pokedex`, `Box` and `Training`.
- **Fixed visual slot, not fixed-height-only:** every navigation icon renders inside a square slot and uses `object-fit: contain`, so horizontal assets such as Pokedex/Box/Training cannot widen the button while vertical assets such as Missions/Gym/Friends keep their natural proportions.
- **Vertical centering:** icon wrappers use flex centering, `align-self:center` and zero line-height; the image is a block-level element centered inside the slot. This removes image-baseline drift and keeps the icon midpoint aligned with the button text midpoint across desktop, Pixel Era, Classic/GBA and mobile layouts.
- **Pixel Era sizing:** the primary navigation uses an 18×18 icon slot, including resolution-locked/mobile variants. The generic desktop theme uses 22×22; Classic/GBA keeps its theme-specific 23×23 / 19×19 slot geometry.
- **Sampling:** navigation PNGs explicitly use smooth image downsampling rather than inheriting Pixel Era's global pixelated image rule, preserving the clean line art at small sizes.
- **Asset note:** this uploaded archive contains 11 navigation PNGs but does not contain `profile.png` or `settings.png`, so the account dropdown intentionally retains its existing glyphs rather than referencing missing files.
- **Validation:** focused client/router regression **5/5 pass**; `npm run check` passes with source structure **394 production modules, max 360/360**, Move FX **490/490**, M-A **272/272**, presentation assets **272/272**, held items **141/141**, rank assets **5/5** and release gate `runtime-ready`.

## Post navigation slot normalization — Optical icon balance + account dropdown icons — 25/09/2026

- **Optical normalization:** navigation still uses a fixed centered slot for stable geometry, but each silhouette now has a small per-route visual scale. Dense icons such as Pokedex/Recruitment are reduced slightly, taller/sparser icons such as Missions/Friends/Gym are enlarged slightly, and the very wide Training dumbbell receives the largest correction. The scale changes only the painted image, never the slot, so button spacing and vertical text alignment remain deterministic.
- **Alignment contract:** icon wrappers remain flex-centered with zero line-height and `object-fit:contain`; scaling uses a center transform. The visual center therefore stays on the button's cross-axis even when an asset has a very different aspect ratio or negative-space ratio.
- **Account dropdown:** `profile.png` and `settings.png` are now included under `public/assets/icons/` and replace the old ◆ / ⚙ glyphs. The redundant `Friends & Chat` dropdown entry has been removed because Friends is already a primary navigation route.
- **Theme sampling:** account icons use smooth sampling like the main navigation icons. Pixel Era keeps the original black artwork on its light dropdown; the generic dark dropdown uses an inverted presentation so the same monochrome assets remain visible.
- **Regression cleanup:** the Arena/social source-contract test was updated from the pre-icon Unicode router expectation to the PNG navigation contract and now explicitly verifies that the duplicate direct Friends dropdown action is absent.
- **Validation:** focused client/profile/social regression **19/19 pass**; `npm run check` passes with source structure **394 production modules, max 360/360**, Move FX **490/490**, M-A **272/272**, presentation assets **272/272**, held items **141/141**, rank assets **5/5** and release gate `runtime-ready`.
