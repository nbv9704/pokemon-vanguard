# Nghiên cứu kiến trúc UI của PokéRogue

Ngày rà soát: 2026-09-20

Nguồn chính được đọc:

- `D:\Mon\pokerogue-main`
- `https://github.com/pagefaultgames/pokerogue-assets` nhánh `beta`, chỉ clone nông vào thư mục tạm để kiểm tra asset vì submodule `assets` trong workspace đang trống.

Phiên bản trong `pokerogue-main/package.json`: `1.12.0.11`.

## Kết luận chính

PokéRogue có cảm giác giống một game Pokémon chạy trên máy cầm tay vì toàn bộ phần trình bày được thiết kế như một game pixel thực thụ, không phải vì một bộ CSS giống Pokémon.

Năm quyết định tạo ra phần lớn hiệu quả đó:

1. Game dùng Phaser/WebGL và một không gian thiết kế logic cố định `320 × 180`.
2. Mọi layer chính được phóng đúng `6×` lên canvas `1920 × 1080`; anti-alias bị tắt.
3. Panel, HUD, cursor, số, icon và nền màn hình là PNG/atlas được vẽ theo pixel; cửa sổ co giãn dùng 9-slice.
4. UI là một state machine gồm các `UiMode` và handler giữ cursor/trạng thái riêng, thay vì thay toàn bộ DOM sau mỗi thao tác.
5. Animation, âm thanh, thay form và cập nhật HUD chạy theo phase/timeline có thứ tự rõ ràng.

Vì vậy, chỉ đổi font, border-radius và `image-rendering: pixelated` sẽ không đạt cùng kết quả. Hình học, asset, input, state và nhịp animation phải cùng tuân theo một lưới pixel.

## 1. Khung render và lưới pixel

Entry point là `src/main.ts`:

- Phaser canvas có kích thước `1920 × 1080`.
- `Phaser.Scale.FIT` giữ nguyên tỷ lệ và thêm khoảng trống khi viewport không khớp.
- `antialias: false` giữ cạnh pixel.
- Font được đợi tải xong trước khi tạo game.

`src/scene-base.ts` khai báo `scaledCanvas = { width: 320, height: 180 }`. Đây mới là hệ tọa độ mà code UI dùng. Trong `BattleScene.launchBattle()`, các container `field`, `fieldUI` và `uiContainer` đều có `setScale(6)`.

Hệ quả:

- Một đơn vị layout luôn tương ứng với một pixel thiết kế.
- Tất cả tọa độ của cursor, icon, thanh HP và chữ có cùng hệ quy chiếu.
- Scale là số nguyên nên sprite không nằm giữa pixel vật lý.
- Responsive xảy ra ở cấp canvas, không làm từng widget tự reflow.

PokéRogue đôi lúc dùng tọa độ `.5` để canh texture/mask hoặc đường kẻ, nhưng toàn bộ phép đặt vẫn diễn ra trong hệ `320 × 180`, có chủ đích và nhất quán.

## 2. Cấu trúc scene và layer

`BattleScene` là scene chính. Thứ tự khái quát:

1. Arena background.
2. `field`: Pokémon, trainer, arena bases và vật thể chiến đấu.
3. `fieldUI`: lớp phủ trên sân, ability bar, Poké Ball tray, EXP, thông tin phụ.
4. `uiContainer`: HUD, menu, modal, tooltip và các handler UI.

Mỗi nhóm là một `Phaser.GameObjects.Container`, nên có thể ẩn, tween, đổi depth hoặc dịch chuyển cả nhóm mà không làm mất state con. Các sprite chiến đấu còn đi qua `FieldSpritePipeline` và `SpritePipeline` để xử lý tint, shadow, tera color và hiệu ứng đặc biệt đồng nhất.

Điểm đáng học là gameplay state không trực tiếp dựng HTML. Scene nhận state, tạo game object và để phase/UI handler quyết định lúc nào nó xuất hiện hoặc đổi trạng thái.

## 3. UI mode và handler

`src/ui/ui.ts` tạo một handler riêng cho từng mode. Bản được đọc có 48 file handler, gồm battle message, command, fight, party, summary, starter select, Pokédex, settings, modal và nhiều màn khác.

`src/enums/ui-mode.ts` là danh sách mode trung tâm. `UI` cung cấp:

- `setMode`: đóng mode cũ rồi mở mode mới.
- `setModeWithoutClear`: chuyển mode nhưng giữ state cũ.
- `setOverlayMode`: đẩy overlay lên trên và giữ mode phía dưới.
- `revertMode`: quay lại mode trước trong chain.

Mỗi `UiHandler` có vòng đời nhỏ:

- `setup()` tạo game object một lần.
- `show(args)` bật và đồng bộ dữ liệu.
- `processInput(button)` xử lý input theo mode hiện tại.
- `setCursor()` chỉ thay cursor và vị trí hiển thị.
- `clear()` ẩn mode nhưng không bắt buộc phá toàn bộ cây object.

Ví dụ `CommandUiHandler` tạo bốn label lệnh một lần, sau đó chỉ bật container, đổi nội dung cần thiết và di chuyển sprite cursor `6 × 10`. Đây là lý do focus/cursor không bị mất khi state đổi nhỏ.

## 4. Asset tạo nên ngoại hình

Asset là một repository riêng được gắn làm Git submodule. Bản asset chính thức được kiểm tra có:

- 1.567 file trong `images/ui`.
- 13.566 PNG trong cây `images/pokemon`.
- 928 JSON mô tả battle animation.

Các loại asset UI chính:

- Nền nguyên màn `320 × 180`: party, summary, starter select, Pokédex.
- HUD chiến đấu: `pbinfo_player`, `pbinfo_enemy_mini`, `overlay_hp`, `overlay_exp`.
- Atlas: type icon, số, Poké Ball, cursor animation, status và button.
- Window texture `24 × 24` dùng 9-slice.
- Một bộ `ui/legacy` song song với bộ mặc định.
- Hai font `pokemon-emerald-pro.ttf` và `pkmnems.ttf`.
- Label quan trọng được raster hóa sẵn theo ngôn ngữ trong `ui/text_images/<lang>`.

`SceneBase.loadImage/loadSpritesheet/loadAtlas` tự thử tải cả asset thường và asset `ui/legacy`. `addUiThemeOverrides()` chặn các lệnh tạo image/sprite/9-slice để tự thêm hậu tố `_legacy` khi theme Legacy được bật. Nhờ đó logic layout dùng chung, còn giao diện đổi trọn bộ texture.

`addWindow()` dùng `Phaser.GameObjects.NineSlice`. Border là 8 pixel với theme mặc định và 6 pixel với Legacy. Cửa sổ có thể co giãn mà góc và viền luôn sắc nét.

## 5. Chữ và nhãn

`src/ui/text.ts` không để từng màn tự chọn CSS. Tất cả chữ đi qua `TextStyle` và một factory chung.

Thiết lập cơ bản:

- Font render ở cỡ 96 px.
- Text object được scale xuống `1/6`, cho kích thước logic khoảng 16 px.
- Shadow, padding, line spacing và màu được xác định theo style.
- Một số ngôn ngữ có font size/padding riêng.
- Các label cần độ chính xác cao như `HP`, `Lv.`, tiêu đề Summary và battle stat được dùng dưới dạng PNG/atlas đã localize.

Điểm cần giữ khi áp dụng là một typography system duy nhất. Nếu từng component tự chọn font-size, line-height và shadow, cảm giác pixel sẽ nhanh chóng vỡ.

## 6. HUD và menu chiến đấu

HUD không phải một box CSS tổng quát. `BattleInfo` ghép texture nền, tên, giới tính, level, status, type icon, HP bar và stat overlay tại tọa độ cố định.

Một số chi tiết quan trọng:

- HP bar dùng texture frame `high`, `medium`, `low`.
- EXP dùng mask để lộ dần thanh ảnh.
- Số HP được ghép từng ký tự từ atlas `numbers`, không dùng text thông thường.
- Khi HP/EXP đổi, Phaser tween trực tiếp scale hoặc mask.
- HUD player và enemy dùng texture, kích thước và anchor riêng.
- Command và move menu có cursor sprite thật, không dựa vào outline của browser.

Thiết kế này khiến UI trông như một phần của cùng sprite set với Pokémon và arena.

## 7. Input

`InputsController` chuẩn hóa keyboard và gamepad thành enum `Button`. Touch control mô phỏng cùng luồng keyboard/button. Mode đang active nhận `processInput(button)`.

Điều này có ba lợi ích:

- Keyboard, gamepad và touch đi qua cùng một luật điều hướng.
- Cursor thuộc về handler, không phụ thuộc DOM focus.
- Input có thể khóa trong lúc animation/overlay mà không phải vô hiệu hóa hàng loạt element.

PokéRogue đánh đổi accessibility của DOM cho độ kiểm soát canvas. Nếu Aether áp dụng kiến trúc này, nên giữ một lớp DOM/ARIA song song cho screen reader và form nhập liệu.

## 8. Pokémon sprite, form và Mega

PokéRogue không đổi ảnh Mega bằng cách đoán URL lúc render. Form là state chính thức của Pokémon.

Luồng chính:

1. `Pokemon.formIndex` xác định `PokemonSpeciesForm` hiện tại.
2. Form sinh ra sprite id, ví dụ Steelix Mega là `208-mega`.
3. Player mặc định lấy nhánh `back/`; enemy lấy front.
4. Shiny, female và variant được ghép có quy tắc vào sprite id.
5. Loader nạp cả PNG và JSON atlas rồi tạo animation lặp ở 10 fps.
6. `changeForm()` cập nhật form, load asset mới và gọi lại animation/HUD.

Kho asset có riêng:

- `images/pokemon/208-mega.{png,json}`
- `images/pokemon/back/208-mega.{png,json}`
- bản shiny front/back
- icon Mega riêng

`QuietFormChangePhase` chỉ hiển thị sprite form mới sau khi `pokemon.changeForm(formChange)` hoàn tất. Đây là nguyên tắc cần giữ trong Aether: `form state → resolved sprite key → preload/verify → swap presentation`. Không để badge Mega và sprite là hai nguồn sự thật riêng biệt.

## 9. Animation và nhịp game

Codebase có 97 phase file. Phase manager xếp các bước battle vào queue; mỗi phase kết thúc mới chuyển sang phase kế tiếp. Move animation được mô tả bằng JSON frame data với vị trí, scale, opacity, priority, focus và graphic frame.

Hiệu quả thị giác đến từ việc đồng bộ:

- thông báo;
- animation cast/impact;
- thay HP;
- âm thanh;
- form change;
- cry/fanfare;
- trả quyền điều khiển.

Đây là phần Aether đã có nền tảng khá gần qua playback timeline và presentation runtime. Phần cần thay chủ yếu là renderer, asset grammar và timing profile, không cần viết lại battle mechanics.

## 10. So sánh với Aether R3-104

| Mảng | PokéRogue | Aether hiện tại | Khoảng cách chính |
| --- | --- | --- | --- |
| Render | Phaser/WebGL canvas | DOM/HTML/CSS | DOM reflow và browser text làm hình học kém đồng nhất |
| Hệ tọa độ | `320 × 180`, scale `6×` | `1280 × 720`, scale toàn app | Aether thiết kế trực tiếp ở độ phân giải cao |
| Panel | PNG + atlas + 9-slice | Gradient, border, box-shadow CSS | Viền và góc chưa có ngôn ngữ sprite chung |
| Font | Pixel font + style factory + raster label | Monospace override và nhiều cỡ CSS | Chưa có metric/shadow/padding thống nhất |
| Cursor | Sprite do handler sở hữu | DOM focus + class cursor | Hình thức và lifecycle còn phụ thuộc re-render |
| HUD | Texture chuyên biệt, số atlas, mask/tween | HTML box, chữ và progress CSS | Cảm giác giống dashboard web hơn battle HUD |
| Form/Mega | Form state sinh sprite key | Đã có reconcile sprite key sau các bản sửa | Nền tảng đúng, cần gắn chặt preload/swap/timeline hơn |
| Animation | Phase queue + frame data | Playback frames + presentation cues | Có thể chuyển đổi mà không thay mechanics |
| Accessibility | Canvas gây hạn chế | DOM có lợi thế rõ rệt | Nên dùng kiến trúc hybrid |

`public/pixel-era-ui.css` hiện đã tạo theme pixel tốt hơn bản web cũ, nhưng vẫn là một skin phủ lên layout DOM `1280 × 720`. Nó chưa biến layout thành một scene `320 × 180`.

## 11. Cách áp dụng phù hợp cho Aether

Không nên port toàn bộ PokéRogue hoặc thay engine battle. Cách ít rủi ro nhất là một presentation layer hybrid.

### Bước 1: khóa một pixel stage thật

- Giữ viewport ngoài `1280 × 720` để không phá shell hiện tại.
- Tạo battle/summary stage nội bộ `320 × 180` và phóng đúng `4×`.
- Tất cả anchor, HUD và menu trong stage dùng đơn vị 1 pixel logic.
- Chỉ scale stage như một khối; không reflow từng widget.

`1280 / 320 = 4` và `720 / 180 = 4`, nên Aether đã có tỷ lệ rất thuận lợi.

### Bước 2: xây asset grammar riêng

- Nền nguyên màn theo từng mode.
- Bộ window 9-slice riêng của Aether.
- HUD player/enemy riêng.
- Atlas cursor, numbers, status, type và prompt.
- Một font pixel có giấy phép rõ ràng và metric cố định.

Không nên sao chép trực tiếp texture PokéRogue. Nên dùng cấu trúc và quy tắc của họ làm tham chiếu rồi tạo bộ hình riêng phù hợp Aether.

### Bước 3: thêm renderer primitive

Cần primitive cấp thấp tương đương:

- `PixelStage`
- `Sprite`
- `AtlasFrame`
- `NineSliceWindow`
- `PixelText`
- `NumberAtlas`
- `MaskBar`
- `Cursor`

Battle screen chỉ phối các primitive này theo anchor, không tự vẽ border/gradient riêng.

### Bước 4: giữ UI state ngoài DOM

`BattleCommandUiHandler` hiện đã giữ mode `COMMAND/MOVE/TARGET/PARTY/REVIEW`; đây là nền tốt. Tiếp theo nên:

- giữ cursor index/id ổn định trong handler;
- cập nhật node hoặc sprite cần đổi thay vì render lại toàn bộ stage;
- dùng mode stack cho modal/summary;
- để DOM focus là lớp accessibility phản chiếu cursor, không phải nguồn state duy nhất.

### Bước 5: nối timeline với presentation

- Mỗi frame playback phát sprite animation, sound cue, shake/flash và HUD tween theo mốc.
- Mega phải preload sprite mới trước cue swap.
- HUD cập nhật tại impact, không cập nhật sớm khi command vừa gửi.
- Khóa input trong phase cần khóa, trả input sau cue cuối.

### Bước 6: chuyển từng màn

Thứ tự hợp lý:

1. Battle field + HUD + command menu.
2. Party screen.
3. Summary/training.
4. Pokédex.
5. Recruitment và các màn quản lý còn lại.

Battle là nơi mang lại khác biệt lớn nhất và cũng đã có timeline/presentation runtime để tái sử dụng.

## 12. Ràng buộc giấy phép

Repository code PokéRogue ghi giấy phép AGPL-3.0-only. Kho asset nói asset có thể là CC-BY-NC-SA-4.0 nếu được gắn giấy phép, nhưng cũng cảnh báo file không có metadata trong `REUSE.toml` phải xem là chưa có thông tin bản quyền/giấy phép. `REUSE.toml` hiện tại của kho asset không gắn giấy phép cụ thể cho toàn bộ cây UI/Pokémon.

Do đó:

- Có thể học kiến trúc, quy tắc layout và pipeline.
- Không nên chép code trực tiếp vào Aether nếu không chấp nhận nghĩa vụ AGPL.
- Không nên nhập nguyên bộ UI/font/sprite từ PokéRogue khi chưa xác minh giấy phép từng file.
- Bộ sprite Pokémon hiện có của Aether từ Pokémon Showdown/PokeAPI vẫn nên được quản lý theo ledger nguồn hiện tại.

## Các file nên đọc lại khi triển khai

PokéRogue:

- `src/main.ts`
- `src/scene-base.ts`
- `src/battle-scene.ts`
- `src/ui/ui.ts`
- `src/ui/ui-theme.ts`
- `src/ui/text.ts`
- `src/ui/handlers/ui-handler.ts`
- `src/ui/handlers/command-ui-handler.ts`
- `src/ui/handlers/fight-ui-handler.ts`
- `src/ui/battle-info/battle-info.ts`
- `src/data/pokemon-species.ts`
- `src/field/pokemon.ts`
- `src/phases/form-change-phase.ts`
- `src/phases/quiet-form-change-phase.ts`

Aether:

- `public/js/ui/core/game-viewport-scaler.js`
- `public/js/ui/core/ui-mode-stack.js`
- `public/js/ui/core/input-manager.js`
- `public/js/ui/handlers/battle-command-ui-handler.js`
- `public/js/ui/primitives/pokemon-ui.js`
- `public/js/v3-battle-screen.js`
- `public/js/v3-battle-timeline.js`
- `public/js/presentation/battle-presentation-runtime.js`
- `public/pixel-era-ui.css`
- `public/pokemon-battle-shell.css`

