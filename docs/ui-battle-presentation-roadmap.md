# Aether Champions — Pokémon UI & Battle Presentation Rebaseline

**Tài liệu dẫn hướng kỹ thuật sau R3-91**  
**Baseline:** R3-91 — Regulation M-A battle-content 272/272 vertical-complete  
**Mục tiêu:** chuyển Aether Champions từ một web game/dashboard có battle screen thành một game Pokémon-style hoàn chỉnh về presentation, input, battle flow, animation và developer tooling, trong khi giữ nguyên tính đúng đắn của battle engine đã khóa.

---

## 0. Tóm tắt quyết định

Sau R3-91, battle-content M-A đã đạt:

- **272/272 Regulation M-A battle-content entries**
  - 213/213 canonical non-Mega selectable entries
  - 59/59 Mega forms
- **213 Pokémon** trong promoted non-Mega catalog
- **490 moves**
- **180 ordinary Abilities**
- **82 enabled items**
- **59 M-A Mega relations**
- **277 battle forms** trong physical/form foundation
- **490/490 Move FX coverage** theo hệ profile hiện tại
- Full regression của R3-91: **1038/1038 pass**

Từ mốc này, hướng phát triển thay đổi trọng tâm:

> **Không tiếp tục coi “thêm content” là công việc chính của M-A.**  
> Phần việc lớn tiếp theo là biến content và battle engine đã đúng thành một trải nghiệm game Pokémon hoàn chỉnh.

Ba trụ cột mới:

1. **Pokémon-style UI architecture**
2. **Battle Presentation & Animation Runtime**
3. **Release-grade Assets, QA và Developer Tooling**

Reference chính:

- PokéRogue — UI architecture, scene/panel flow, input abstraction, battle presentation, data-driven battle animations.
- pret/pokeemerald + pret/pokefirered — state machine, task/input flow, healthbox, menu behavior của Pokémon console.
- Pokémon Showdown — ranh giới giữa battle simulation và presentation/event protocol.
- pokeemerald-expansion — battle debug, test/tooling, sprite/debug workflow.

Không copy nguyên asset hoặc code có licensing không phù hợp. Mục tiêu là học kiến trúc, interaction pattern và presentation philosophy.

---

# 1. Product goal mới

## 1.1 Cảm giác sản phẩm

Khi người chơi mở Aether Champions, cảm giác cần hướng tới:

- đây là **một game Pokémon**, không phải một web dashboard có theme Pokémon;
- battle field là trung tâm;
- menu, cursor, HUD, message box, party, summary và archive cùng một visual language;
- keyboard/gamepad/touch đều là first-class input;
- animation move có timing, impact, actor motion và audio đồng bộ;
- state đặc biệt như Mega Evolution, Transform, Stance Change, Disguise, Forecast... phải **được nhìn thấy**, không chỉ đúng trong logic;
- Single và Double đều dễ đọc;
- game vẫn responsive và accessible trên web.

## 1.2 Những thứ không được hy sinh

Presentation rewrite không được phá:

- deterministic battle engine;
- authoritative server state;
- event ordering;
- save compatibility;
- M-A legality;
- exact canonical roster;
- 66/32 Stat Point rules;
- Mega legality;
- Single/Double mechanics;
- fail-closed mechanics coverage;
- current regression suite.

**UI không được tự tính luật battle.**

---

# 2. Reference stack và cách sử dụng

## 2.1 PokéRogue

Repo:

- https://github.com/pagefaultgames/pokerogue
- https://github.com/pagefaultgames/pokerogue-assets

Dùng làm reference chính cho:

- `UiMode` / mode transitions;
- screen handler architecture;
- cursor + focus navigation;
- command selection;
- Fight / Party / Summary / Pokédex flow;
- reusable window primitives;
- pixel/game-like scaling;
- battle sprite layering;
- battle animation timeline;
- animation JSON;
- user/target-relative coordinates;
- sound/timed events;
- cleanup sau animation;
- common animations;
- lazy-loading animation assets.

Không copy:

- texture/window assets;
- Pokémon sprites/audio nếu license không phù hợp;
- nguyên implementation `battle-anims.ts`;
- technical debt/spaghetti mà chính project đang có.

### Bài học chính

PokéRogue có một nguyên tắc rất phù hợp:

> Battle logic không chứa animation logic; move chỉ trỏ tới animation data/runtime.

Aether cần phát triển theo nguyên tắc này.

---

## 2.2 pret/pokeemerald và pret/pokefirered

Repos:

- https://github.com/pret/pokeemerald
- https://github.com/pret/pokefirered

Dùng làm reference cho:

- task/state machine;
- A/B/DPAD interaction;
- menu cursor;
- battle command sequence;
- move selection;
- target selection;
- healthbox;
- party selection;
- summary pages;
- transition behavior;
- input lock trong animation/message.

### Bài học chính

Pokémon console thường không để một screen có “mọi nút cùng lúc”.

Ví dụ:

```text
COMMAND
  ↓ Fight
MOVE_SELECT
  ↓ move needs target
TARGET_SELECT
  ↓ confirm
LOCKED
```

UI luôn biết **mode hiện tại**.

---

## 2.3 Pokémon Showdown

Repos:

- https://github.com/smogon/pokemon-showdown
- https://github.com/smogon/pokemon-showdown-client

Dùng làm reference cho:

- simulator vs client boundary;
- battle requests;
- event protocol;
- replayability;
- deterministic state transitions;
- text log;
- action selection contract;
- separation presentation/simulation.

### Bài học chính

Engine nên phát semantic event:

```text
move
damage
heal
status
switch
faint
weather
ability
formChange
megaEvolution
```

UI quyết định:

- animation nào chạy;
- message nào hiện;
- HP giảm vào thời điểm visual nào;
- sound nào phát.

---

## 2.4 pokeemerald-expansion

Repo:

- https://github.com/rh-hideout/pokeemerald-expansion

Dùng làm reference cho:

- battle debug menu;
- integrated tests;
- sprite visualizer;
- mechanics debug;
- form/state inspection;
- scenario setup.

### Bài học chính

Aether cần một **Battle Lab** để debug mechanics phức tạp nhanh hơn thay vì luôn dựng battle đầy đủ.

---

# 3. Nguyên tắc kiến trúc bắt buộc

## 3.1 Engine authoritative

Battle engine là nguồn sự thật duy nhất.

Không được:

```js
if (move.name === "Thunderbolt") {
  target.hp -= ...
}
```

trong UI.

UI chỉ nhận:

```js
{
  type: "damage",
  targetId,
  amount,
  hpBefore,
  hpAfter
}
```

và quyết định khi nào animate HP.

---

## 3.2 Presentation event không thay battle event

Cần hai lớp khác nhau.

### Battle event

Canonical và replay-safe:

```js
{
  type: "damage",
  sourceId: "...",
  targetId: "...",
  moveId: "thunderbolt",
  amount: 83,
  hpBefore: 171,
  hpAfter: 88
}
```

### Presentation cue

Derived:

```js
{
  cue: "move-impact",
  moveId: "thunderbolt",
  actorId: "...",
  targetId: "...",
  at: 410
}
```

Presentation cue có thể thay đổi mà không đổi kết quả trận.

---

## 3.3 UI mode/state machine

UI không được chỉ là “HTML đang có những button nào”.

Target:

```text
GameUiController
 ├── UiModeStack
 ├── InputManager
 ├── FocusManager
 ├── MessageController
 ├── TransitionController
 └── active UiHandler
```

Các mode ví dụ:

```text
TITLE
HOME
ARCHIVE
PARTY
SUMMARY
TRAINING
TEAM_BUILDER
BATTLE_INTRO
BATTLE_COMMAND
BATTLE_MOVE_SELECT
BATTLE_TARGET_SELECT
BATTLE_PARTY
BATTLE_MESSAGE
BATTLE_ANIMATION
BATTLE_REPLACEMENT
BATTLE_RESULT
DIALOG
SETTINGS
```

---

## 3.4 Input abstraction

Không viết:

```js
button.onclick = doThing
```

rải rác.

Target:

```text
Physical input
 ↓
InputManager
 ↓
InputAction
 ↓
active UiHandler
```

Canonical actions:

```text
UP
DOWN
LEFT
RIGHT
CONFIRM
CANCEL
MENU
DETAIL
PAGE_LEFT
PAGE_RIGHT
FAST_FORWARD
SKIP
```

Mapping:

| Physical | Action |
|---|---|
| Arrow / WASD | Direction |
| Z / Enter | Confirm |
| X / Escape | Cancel |
| C | Detail/Menu |
| Gamepad A | Confirm |
| Gamepad B | Cancel |
| D-pad | Direction |
| Touch/Mouse | direct focus + Confirm |

Logic không biết input đến từ đâu.

---

# 4. Target UI architecture

## 4.1 Proposed folders

```text
app/public/ui/
  core/
    game-ui-controller.js
    ui-mode-stack.js
    input-manager.js
    focus-manager.js
    message-controller.js
    transition-controller.js

  primitives/
    aether-window.js
    game-cursor.js
    type-badge.js
    status-badge.js
    pokemon-hud.js
    party-slot.js
    move-tile.js
    prompt-arrow.js
    tab-strip.js
    tooltip.js

  handlers/
    home-ui-handler.js
    archive-ui-handler.js
    party-ui-handler.js
    summary-ui-handler.js
    training-ui-handler.js
    team-builder-ui-handler.js

    battle/
      battle-root-ui-handler.js
      battle-command-ui-handler.js
      battle-move-ui-handler.js
      battle-target-ui-handler.js
      battle-party-ui-handler.js
      battle-replacement-ui-handler.js
      battle-message-ui-handler.js
      battle-result-ui-handler.js

  presentation/
    battle-presentation-controller.js
    battle-event-adapter.js
    actor-registry.js
    battle-camera.js
    battlefield-layout.js

  fx/
    fx-runtime.js
    fx-timeline.js
    fx-registry.js
    fx-assets.js
    fx-audio.js
    fx-primitives/
```

Tên file có thể điều chỉnh theo convention hiện tại, nhưng trách nhiệm phải giữ riêng.

---

## 4.2 DOM-first hybrid rendering

Không bắt buộc chuyển toàn bộ game sang Phaser/WebGL.

Khuyến nghị:

- DOM cho menu/window/text;
- CSS transforms/WAAPI cho HUD/cursor/actor motion nhẹ;
- Canvas 2D hoặc WebGL layer cho particle/projectile phức tạp;
- sprites vẫn là image elements hoặc canvas atlas tùy pipeline;
- semantic buttons/ARIA vẫn tồn tại.

Lợi ích:

- dễ responsive;
- accessible;
- keyboard navigation;
- không rewrite toàn frontend;
- vẫn tạo được Pokémon game feeling.

---

# 5. Design system Pokémon-style

## 5.1 AetherWindow

Tạo một primitive window duy nhất.

Variants:

```text
normal
thin
dialog
command
info
tooltip
modal
transparent
```

Thuộc tính:

- border pieces hoặc nine-slice;
- internal padding;
- focus ring;
- title;
- optional header;
- shadow;
- disabled state;
- active state;
- compact/mobile mode.

Không để mỗi screen tự tạo `.card`, `.panel`, `.box`.

---

## 5.2 Typography

Phân tầng:

```text
DISPLAY
WINDOW_TITLE
BODY
COMMAND
STAT
CAPTION
SYSTEM
```

Yêu cầu:

- dễ đọc ở 720p/1080p/mobile;
- outline/shadow kiểu game nhưng không quá nặng;
- số HP/PP/stat monospace hoặc tabular numerals;
- text animation không làm layout jump.

---

## 5.3 Cursor

Cursor phải là first-class object.

Có:

- position;
- selected index;
- grid dimensions;
- disabled skip;
- wrap behavior;
- confirm/cancel;
- cursor sound;
- hover synchronization.

Mouse di vào item:

```text
cursor moves
```

Keyboard di cursor:

```text
visual focus moves
```

Không có hai hệ focus tách biệt.

---

## 5.4 Type / status / category visual language

Tạo component chung cho:

- 18 types;
- physical/special/status;
- major status;
- weather/terrain;
- positive/negative stat stage;
- Mega;
- form/state.

Không render type bằng text plain ở mỗi screen.

---

# 6. Battle screen redesign

## 6.1 Composition

Desktop target:

```text
┌──────────────────────────────────────┐
│              FIELD                   │
│                                      │
│    enemy HUD           enemy sprite  │
│                                      │
│             effects                  │
│                                      │
│  player sprite          player HUD   │
│                                      │
├──────────────────────────────────────┤
│ MESSAGE / COMMAND WINDOW             │
└──────────────────────────────────────┘
```

Double:

```text
enemy A        enemy B

       battlefield

player A       player B
```

Không để battlefield chỉ là một card giữa dashboard.

---

## 6.2 Pokémon HUD

Component `PokemonHud`:

- display name;
- level;
- gender;
- HP bar;
- HP numeric cho player nếu rule cho phép;
- major status;
- Mega/form indicator;
- side/active slot;
- optional small type/details khi inspecting.

HP animation:

```text
damage event
 ↓
impact cue
 ↓
HP bar tween
 ↓
number tween
 ↓
faint event
```

HP không giảm trước khi visual impact.

---

## 6.3 Command flow

### Single

```text
BATTLE_COMMAND
 ├ Fight
 ├ Pokémon
 ├ Info/Inspect (nếu cần)
 └ Surrender
```

Fight:

```text
BATTLE_MOVE_SELECT
 ├ Move 1
 ├ Move 2
 ├ Move 3
 └ Move 4
```

Move tile:

- name;
- type;
- category;
- PP current/max;
- disabled reason.

Nếu move cần target:

```text
BATTLE_TARGET_SELECT
```

Nếu không:

```text
lock action
```

### Double

Flow lặp cho active slot A và B.

State ví dụ:

```text
command(slot0)
move(slot0)
target(slot0)
command(slot1)
move(slot1)
target(slot1)
review
submit
```

Back/CANCEL phải quay ngược đúng bước.

---

## 6.4 Mega action

Không để Mega checkbox cố định bên cạnh form.

Trong move-select:

- Mega button/icon xuất hiện nếu legal;
- chỉ enable nếu side chưa Mega;
- chọn Mega là một state của action;
- move vẫn chọn bình thường.

Visual Mega Evolution chạy ở thời điểm authoritative event.

---

## 6.5 Battle messages

Message box riêng:

```text
Pikachu used Thunderbolt!
It's super effective!
Charizard's HP fell...
```

Không log tất cả cùng lúc trong một sidebar.

Battle log đầy đủ vẫn tồn tại như inspect/history, nhưng message box là presentation chính.

---

# 7. Battle Presentation Runtime

## 7.1 Mục tiêu

Hệ Move FX hiện tại:

```text
move → profile → cast/impact CSS primitive
```

đã tốt làm foundation nhưng chưa đủ để đạt Pokémon-style.

Target mới:

```text
Battle Event Timeline
 ↓
Presentation Controller
 ↓
FxDefinition
 ↓
FxTimeline
 ↓
Visual / Actor / Audio / Camera primitives
```

---

## 7.2 FxDefinition

Ví dụ schema:

```json
{
  "id": "thunderbolt",
  "template": "electric-beam",
  "duration": 720,
  "tracks": [
    {
      "at": 0,
      "type": "actorTint",
      "actor": "USER",
      "duration": 100
    },
    {
      "at": 120,
      "type": "particleBurst",
      "anchor": "USER_CENTER",
      "asset": "electric_charge"
    },
    {
      "at": 240,
      "type": "beam",
      "from": "USER_CENTER",
      "to": "TARGET_CENTER",
      "asset": "electric_bolt"
    },
    {
      "at": 410,
      "type": "impact",
      "anchor": "TARGET_CENTER"
    },
    {
      "at": 410,
      "type": "sound",
      "sound": "electric_impact"
    },
    {
      "at": 410,
      "type": "cameraShake",
      "strength": 0.3,
      "duration": 100
    }
  ],
  "commit": {
    "damage": 410
  }
}
```

Không nhất thiết dùng JSON nguyên văn này; đây là contract tư duy.

---

## 7.3 FX primitives

Core primitives:

### Actor

```text
actorMove
actorLunge
actorJump
actorShake
actorScale
actorRotate
actorFade
actorTint
actorHide
actorShow
```

### Projectile/effect

```text
sprite
projectile
beam
trail
slash
ring
particleBurst
particleEmitter
wave
aura
shield
impact
```

### Scene

```text
screenFlash
fieldTint
backgroundReplace
cameraShake
cameraZoom
cameraPan
darken
```

### Audio

```text
sound
loopSound
stopSound
```

### Timing

```text
wait
repeat
sequence
parallel
```

---

## 7.4 Anchors

Canonical anchor system:

```text
USER_CENTER
USER_GROUND
USER_FRONT
USER_BACK

TARGET_CENTER
TARGET_GROUND
TARGET_FRONT
TARGET_BACK

ALLY_CENTER

FIELD_CENTER
USER_SIDE_CENTER
TARGET_SIDE_CENTER

USER_TO_TARGET
TARGET_TO_USER
```

Double battle phải resolve anchor theo `activeSlot`.

---

## 7.5 Layers

Không dùng một overlay duy nhất.

Recommended:

```text
BACKGROUND
FIELD_BACK
ACTOR_BACK
ACTOR
ACTOR_FRONT
FX_FRONT
UI
```

Một animation có thể thay layer theo timeline nếu cần.

---

# 8. Move animation authoring strategy

Không viết tay 490 move từ zero ngay lập tức.

## 8.1 Tier model

### Tier A — Signature animation

Moves cần animation riêng:

- signature;
- iconic;
- mechanically unique;
- common/high visibility.

Ví dụ:

- Thunderbolt
- Flamethrower
- Surf
- Solar Beam
- Hyper Beam
- Close Combat
- Protect
- Earthquake
- Shadow Ball
- Dragon Pulse
- Aura Wheel
- King's Shield
- Transform

### Tier B — Parameterized template

Dùng template nhưng có asset/palette/timing riêng.

```text
elemental-projectile
elemental-beam
physical-rush
physical-slash
multi-hit
drain
pulse
field-wave
self-aura
status-target
screen
hazard
weather
```

### Tier C — Safe fallback

Chỉ dùng khi chưa author animation.

Fallback phải:

- hợp category;
- hợp type palette;
- có actor/cast/impact;
- không làm sai target.

Coverage không được giảm.

---

## 8.2 Existing 490/490 profiles

Không bỏ.

Dùng hệ cũ làm:

- migration source;
- fallback layer;
- coverage guard.

Từng move có trạng thái:

```text
legacy-profile
timeline-template
signature-timeline
```

Coverage report mới nên thống kê:

```text
490 active moves
- signature timeline: X
- parameterized timeline: Y
- legacy fallback: Z
- missing: 0
```

Goal cuối M-A:

```text
missing = 0
legacy fallback càng gần 0 càng tốt
```

---

# 9. Timing và battle event synchronization

## 9.1 Cast vs commit

Hiện Aether đã có cast/impact concept.

Phải giữ và mở rộng.

Ví dụ:

```text
0ms      message
80ms     cast begins
300ms    projectile
500ms    hit flash
510ms    damage commit visible
600ms    secondary effect
760ms    result message
900ms    next event
```

Engine đã tính damage trước.

UI chỉ reveal tại `commit`.

---

## 9.2 Multi-hit

Cần event granularity:

```text
hit 1
damage 1
hit 2
damage 2
...
```

Presentation:

```text
impact
HP tween
impact
HP tween
```

Quan trọng cho:

- Disguise;
- Focus Sash;
- Sturdy;
- Weak Armor;
- Rocky Helmet;
- contact effects;
- recoil;
- drain;
- Parental Bond;
- multi-hit move.

---

## 9.3 Called moves

Sleep Talk / Copycat / Instruct:

Battle event phải phân biệt:

```text
caller move
called move
actual executed move
```

Presentation nên:

1. show caller if appropriate;
2. play actual move animation;
3. không trigger form mechanic sai.

Aegislash contract phải tiếp tục giữ.

---

## 9.4 Two-turn / semi-invulnerable

### Solar Beam

Turn 1:

```text
charge presentation
```

Turn 2:

```text
release presentation
```

Sun:

```text
skip charge
release immediately
```

### Dig/Fly/Dive/Phantom Force

Need actor state:

```text
visible
semi-invulnerable
hidden/off-field visual
return
impact
```

Presentation state derive từ authoritative battle state.

---

# 10. Special Pokémon presentation contracts

## 10.1 Ditto

Transform:

- actor morph/flash;
- sprite/species presentation đổi sau Transform resolves;
- target lấy từ slot đang đối diện tại resolution;
- copy battle form;
- HP display giữ Ditto HP;
- transformed move UI cập nhật.

Imposter:

- transform animation tự trigger khi entry event resolve;
- không yêu cầu move.

---

## 10.2 Zoroark

Illusion:

- presentation identity khác combat identity;
- opponent-facing sprite/name lấy last living teammate;
- own-side inspect phải tùy rule;
- break animation khi first damaging hit;
- không đổi stats/type/moves.

Không dùng cùng pipeline với Transform.

---

## 10.3 Castform

Weather event:

```text
weather change
 ↓
Forecast
 ↓
form-change presentation
 ↓
sprite/type update
```

Stats giữ nguyên.

Weather mất:

```text
revert Normal form
```

---

## 10.4 Aegislash

Before qualifying attack:

```text
Shield → Blade
```

King's Shield:

```text
Blade → Shield
```

Animation form change phải xảy ra theo event/state đã resolve, không tự đoán từ move UI.

---

## 10.5 Mimikyu

First damaging hit:

```text
Disguise absorbs
 ↓
Busted form animation
 ↓
1/8 max HP cost
 ↓
remaining hits continue
```

Transform-copy không được sử dụng Disguise.

---

## 10.6 Morpeko

End turn:

```text
Full Belly ↔ Hangry
```

Aura Wheel presentation/type derive từ current form.

Transform-copy không Hunger Switch form.

---

## 10.7 Palafin

First valid switch out:

```text
Zero → Hero battle state
```

Khi xuất hiện lần sau:

- Hero sprite;
- Hero stats;
- Hero presentation.

---

# 11. Persistent battlefield presentation

Need dedicated layers:

## Weather

- Sun
- Rain
- Sandstorm
- Snow

## Terrain

- Electric
- Grassy
- Misty
- Psychic

## Rooms

- Trick Room
- Wonder Room
- Magic Room

## Side conditions

- Reflect
- Light Screen
- Aurora Veil
- Tailwind
- hazards

Rule:

> Persistent visual layer chỉ reflect authoritative state.

Không timer riêng trong UI.

---

# 12. Audio architecture

## 12.1 Channels

```text
master
music
battle_sfx
ui_sfx
cry
ambience
```

Settings persisted.

## 12.2 Animation audio

Sound gắn vào FX timeline:

```text
at: 410ms → impact sound
```

Không gọi audio bằng một timeout tách rời.

## 12.3 UI sounds

Common sounds:

- cursor move;
- confirm;
- cancel;
- invalid;
- open window;
- close window;
- HP low;
- battle start;
- faint.

Có toggle giảm/disable.

---

# 13. Archive → Pokédex-style

Current card catalogue cần migrate.

Target layout:

```text
┌──────── grid/list ───────┬──── Pokémon preview ────┐
│ icons                    │ sprite/art              │
│ search/filter            │ name/form               │
│ cursor                   │ types                   │
│                          │ ability                 │
│                          │ availability            │
└──────────────────────────┴─────────────────────────┘
```

Features:

- type filters;
- regulation filter;
- Mega/form tray;
- sort;
- owned/recruitable;
- keyboard cursor;
- details action.

213 species phải duyệt nhanh mà không lag.

Virtualized grid nếu cần.

---

# 14. Training → Summary-style

Pages:

```text
PROFILE
STATS
MOVES
ABILITY/ITEM
```

## Profile

- sprite;
- species/form;
- types;
- gender;
- physical data;
- ability;
- held item.

## Stats

- final level-50 stats;
- base stats;
- Stat Point allocation;
- alignment/nature-like modifier;
- remaining points;
- legal max.

## Moves

4 move slots:

- type;
- category;
- PP;
- power;
- accuracy;
- description.

Move selection mở overlay riêng.

Không dùng một form web rất dài.

---

# 15. Team Builder → Party screen

Main:

```text
slot 1
slot 2
slot 3
slot 4
slot 5
slot 6
```

Mỗi slot:

- sprite;
- name/form;
- types;
- held item;
- ability;
- build indicator.

Select slot:

```text
Summary
Change Pokémon
Edit build
Change item
Change ability
Change moves
Remove
```

Không để 6 dropdown độc lập là primary UX.

---

# 16. Recruitment/Ranch

Presentation theo Pokémon game:

- roster silhouettes / icons;
- focused preview;
- recruit/trial status;
- banner/regulation context;
- confirm dialog;
- reward animation.

Logic recruitment giữ nguyên.

---

# 17. Responsive strategy

Không reflow mọi thứ như dashboard.

## Battle

Giữ composition.

Desktop:

```text
16:9-ish game surface
```

Mobile portrait:

- field upper section;
- command/message lower section;
- larger touch targets;
- actor/HUD scale down;
- no tiny text.

## Archive/Training

Cho phép adaptive split → stacked.

## CSS units

Tạo logical game units:

```text
--game-scale
--ui-unit
--window-padding
```

Không hardcode quá nhiều pixel ngẫu nhiên.

---

# 18. Accessibility

Pokémon-style không đồng nghĩa inaccessible.

Cần:

- semantic button;
- keyboard full navigation;
- focus state;
- ARIA labels;
- live region cho battle messages;
- reduced motion;
- high-contrast option;
- text scaling;
- no color-only information;
- controller optional.

Canvas FX chỉ decorative:

```html
aria-hidden="true"
```

Battle state vẫn có DOM representation.

---

# 19. Performance budget

Target 60 FPS trên desktop phổ thông.

## Không làm

- hàng nghìn DOM particle;
- layout thrashing;
- đọc/ghi layout xen kẽ trong frame;
- create/destroy audio node không kiểm soát;
- fetch animation JSON mỗi cast;
- decode image ngay giữa animation.

## Làm

- preload;
- cache;
- object pool;
- transform/opacity animation;
- requestAnimationFrame;
- OffscreenCanvas nếu hợp lý;
- asset atlas khi đủ lợi ích.

---

# 20. Asset pipeline mới

## 20.1 Asset manifest

Mỗi Pokémon/form:

```text
front
back
icon
artwork
optional shiny later
```

Battle-state forms riêng:

- Castform forms
- Aegislash Blade/Shield
- Mimikyu Busted
- Morpeko Hangry
- Palafin Hero
- Mega forms

Manifest phải canonical.

---

## 20.2 Validation

Script validate:

- path exists;
- dimensions;
- duplicate/missing;
- canonical species ID;
- form alias;
- license/source metadata;
- no runtime remote dependency.

---

## 20.3 Missing asset behavior

Không silent fallback sang sai Pokémon.

Allowed:

```text
intentional placeholder silhouette
```

và development warning.

Release gate:

```text
required battle asset missing = fail
```

---

# 21. Battle Lab / Developer Tools

Sau UI foundation cần xây debug utility.

## Battle Lab setup

Chọn:

- format;
- Pokémon;
- form;
- HP;
- status;
- item;
- ability;
- stat stages;
- weather;
- terrain;
- room;
- side condition;
- move;
- target;
- RNG seed.

Buttons:

```text
Execute turn
Execute event
Play presentation only
Pause
Step
Replay
Export scenario
```

## Event Inspector

Hiện:

```text
BattleEvent
PresentationCue
FX timeline
actor state
snapshot before/after
```

Cực quan trọng cho mechanics phức tạp.

---

# 22. Testing architecture

## 22.1 Unit

Test:

- mode stack;
- cursor movement;
- input mapping;
- focus wrap;
- window primitive;
- FX parser;
- timeline scheduler;
- anchor resolution;
- layer mapping.

## 22.2 Presentation contract

Mỗi battle event family phải có test:

```text
event → expected presentation cues
```

Không test pixel exact.

Ví dụ:

```text
damage event
→ impact
→ hp tween
```

## 22.3 Move FX validation

Validator:

- every active move resolves;
- no missing assets;
- timeline valid;
- commit marker valid;
- anchor valid;
- duration sane;
- no illegal primitive;
- reduced-motion fallback exists.

## 22.4 Screenshot/visual QA

Golden snapshots cho:

- Single battle;
- Double battle;
- move select;
- target select;
- party;
- summary;
- archive;
- Mega;
- weather;
- form change.

Không dùng screenshot test thay mechanics tests.

---

# 23. Timeout-safe development workflow

Đây là yêu cầu bắt buộc do session trước đã gặp timeout.

## Không chạy

```bash
npm test
```

theo một blocking call dài trong một tool request nếu có nguy cơ > timeout.

## Workflow

### 1. Targeted gate

```bash
node --test tests/ui-foundation.test.mjs
node --test tests/battle-presentation.test.mjs
```

### 2. Static/content gate

```bash
npm run check
```

nếu thời gian đã ổn.

### 3. Full regression

Chạy shell session dài:

```bash
npm test
```

rồi poll output định kỳ.

### 4. Packaging

Chỉ sau full regression pass.

### 5. Apply-test

Patch lên pristine previous checkpoint.

### 6. Re-run short gate

```bash
npm run check
```

trên apply-test tree.

Không để một command im lặng quá lâu mà không poll.

---

# 24. Migration plan

Không rewrite toàn frontend một lần.

## Step A

Tạo architecture mới bên cạnh UI cũ.

## Step B

Migrate Battle trước.

Battle là nơi lợi ích lớn nhất và dễ khóa bằng engine event.

## Step C

Migrate Party/Team.

## Step D

Migrate Summary/Training.

## Step E

Migrate Archive.

## Step F

Migrate Recruitment/Home/Settings.

## Step G

Xóa legacy V3 dashboard primitives chỉ khi không còn consumer.

---

# 25. Milestone roadmap

---

## R3-92 — Pokémon UI Foundation

### Scope

- InputManager
- UiModeStack
- FocusManager
- GameCursor
- AetherWindow
- type/status/category components
- typography tokens
- game surface/layout tokens
- basic transition controller
- compatibility adapter với router hiện tại

### Không làm

- full move animation rewrite
- full archive redesign
- full team redesign

### Acceptance

- keyboard + mouse điều khiển cùng focus model;
- cursor không lệch focus;
- mode push/pop testable;
- window primitive dùng được trong ít nhất Battle prototype;
- no regression battle logic.

---

## R3-93 — Battle UI Shell

**Status: DONE in R3-93.** Immersive game-surface, sequential Command → Move → Target/Party → Review flow, Pokémon-style replacement cards, Mega selection and shared keyboard/mouse controller are live without changing the authoritative battle engine.

### Scope

- full-screen battlefield;
- Pokémon HUD;
- message box;
- command menu;
- move menu;
- target selection;
- party/replacement overlay;
- Single + Double;
- Mega selection.

### Acceptance

- không cần dashboard sidebar để chơi battle;
- tất cả action có thể chọn bằng keyboard;
- mouse/touch tương đương;
- no duplicate submit;
- back/cancel đúng mode;
- current R3-91 engine untouched.

---

## R3-94 — Battle Presentation Runtime

**Status: DONE in R3-94.** Data-driven presentation schema/timeline, canonical anchors/layers, actor/camera/screen hooks, semantic audio events, authoritative impact commit markers and a 490/490 legacy Move-FX adapter are live without changing battle mechanics.

### Scope

- FxRuntime
- FxTimeline
- anchors
- layers
- actor motion
- camera effects
- audio hooks
- commit markers
- reduced-motion path
- legacy move-FX adapter.

### Acceptance

- timeline không quyết định battle result;
- skip/2× hoạt động;
- cancel/navigation cleanup sạch;
- damage reveal đúng commit;
- spread move chạy multi-target.

---

## R3-95 — Move FX Migration Wave 1

**Status: DONE — R3-95.** Active M-A catalog now resolves **490/490** moves as **10 signature timelines + 480 parameterized timelines + 0 legacy fallback**. Timeline overflow validation, anchor-aware rendering, weather/hazard/multi-hit templates and first-wave signature primitives are release-gated by `npm run check` and the full regression suite.

### Scope

Core templates:

- projectile
- beam
- slash
- rush
- impact
- aura
- barrier
- drain
- multi-hit
- field wave
- weather
- hazard

Signature first wave:

- Thunderbolt
- Flamethrower
- Surf
- Solar Beam
- Hyper Beam
- Protect
- Earthquake
- Shadow Ball
- Close Combat
- Dragon Pulse

### Acceptance

- [x] registry report có tier + template counts;
- [x] missing = 0;
- [x] 10 signature timelines + 480 parameterized timelines;
- [x] authoritative impact/HP/event boundary giữ nguyên;
- [x] Single/Double spread outcomes + anchors giữ đúng;
- [x] 1×/2×/Skip/reduced-motion không regression;
- [x] legacy presentation fallback = 0 cho active M-A catalog (legacy profile metadata vẫn giữ để compatibility/tooling).

---

## R3-96 — Special Battle Presentation

**Status: DONE — R3-96.** Special-state presentation is now event-driven and replay-safe for Mega Evolution, Transform/Imposter, Illusion, Forecast, Stance Change, Disguise, Hunger Switch, Zero to Hero, switch/faint entry sequences and two-turn semi-invulnerable states. Combat identity remains authoritative; display identity/form state is projected separately and full regression is **1070/1070**.

### Scope

- Mega Evolution
- Transform/Imposter
- Illusion
- Forecast
- Stance Change
- Disguise
- Hunger Switch
- Zero to Hero
- two-turn/semi-invulnerable visual states
- faint/switch/entry sequences.

### Acceptance

Mọi special form/state trong M-A:

- [x] đúng sprite/display identity;
- [x] đúng timing (including pre-cast Stance Change);
- [x] đúng revert/reveal;
- [x] replay-safe;
- [x] skip-safe via authoritative final snapshot;
- [x] Double-safe/public-state safe.

---

## R3-97 — Party + Summary + Training

**Status: DONE — R3-97.** Training is now a four-page Pokémon Summary console (Profile / Stats / Moves / Ability-Item) with full 25-nature preview support, form/physical/Mega eligibility details and the existing authoritative build-save contract. Team Builder is now a six-slot Party screen with direct swap/replacement picker, Species/Item Clause feedback and shared keyboard focus/page navigation. Full regression is **1075/1075**.

### Scope

- party screen;
- summary tabs;
- stat editor;
- moves editor;
- item/ability editor;
- form display;
- Mega eligibility display.

### Acceptance

Không còn form web dài làm UX chính cho build editing.

---

## R3-98 — Archive/Pokédex + Recruitment

**Status: DONE — R3-98.** Archive now exposes all **213 canonical non-Mega M-A entries** through a Pokédex-style keyboard/controller grid with search/type/ownership filters, canonical form tray and legal Mega-form preview. Roster Ranch now uses a ten-offer selector + focused detail/action pane while preserving the authoritative Trial/permanent/revision contracts. Long-grid cursor scrolling and explicit artwork placeholders are release-gated; full regression is **1081/1081**.

### Scope

- Pokédex-style grid;
- sprite preview;
- filters;
- form tray;
- regulation markers;
- recruit/trial flow;
- owned state.

### Acceptance

213 non-Mega entries và Mega/forms duyệt mượt.

---

## R3-99 — Asset Pipeline Closure + Audio + Polish — DONE (bespoke artwork debt tracked separately)

### Scope

- required sprite asset closure;
- battle state forms;
- icon coverage;
- audio routing;
- UI SFX;
- transition polish;
- responsive QA;
- accessibility pass.

### Acceptance

Không missing required battle asset.

---

## R3-100 — M-A Presentation Release Gate — DONE (runtime-ready; bespoke art debt remains explicit)

### Scope

Release hardening.

- all 272 M-A entries represented;
- full Single/Double scenario matrix;
- 59 Mega presentations;
- all special forms;
- all 490 moves resolve FX;
- mobile QA;
- keyboard QA;
- save migration;
- offline package;
- replay/skip stress;
- Battle Lab smoke.

### Acceptance

Engineering/presentation runtime gate is complete: 213/213 non-Mega spawn in Single and Double release matrix, 59/59 Mega presentation paths, 490/490 move timelines with authoritative commit, special-state smoke, keyboard/reduced-motion/coarse-pointer checks, save migration regression and zero external runtime URL dependencies. `npm run release:validate` is now part of `npm run check`; `npm run release:matrix` is the deterministic release scenario matrix.

**Asset truth:** only 13/272 selectable entries currently have bespoke front + back + artwork coverage. The remaining 259 resolve through an intentional local fallback and are tracked as presentation art debt rather than being misreported as bespoke-complete. See `docs/r3-100-ma-release-report.md`.

---

# 26. Move FX long-term quality goal

Không bắt buộc mọi move có handmade bespoke animation.

Mục tiêu thực tế:

```text
490/490 valid visual presentation
0 missing

high-use/iconic:
signature animation

common:
parameterized timeline

rare/generic:
high-quality template

legacy CSS fallback:
temporary only
```

Sau R3-100 có thể tiếp tục animation polish mà không block release.

---

# 27. Source/license policy

Khi học từ external repo:

## Allowed direction

- architectural pattern;
- interaction design;
- state-machine concepts;
- public data format ideas;
- original implementation của Aether dựa trên concept.

## Cần kiểm license trước khi reuse code

- exact implementation;
- substantial code fragments;
- texture;
- audio;
- sprite;
- animation JSON.

Mỗi external asset cần:

```text
source
license
attribution requirement
local file
hash
```

---

# 28. Coding rules cho phase mới

1. Không thêm logic battle vào UI.
2. Không thêm UI decision vào engine.
3. Không dùng global DOM query làm state source.
4. Không tạo handler file vừa render + validate + network + animation.
5. Một module có một responsibility chính.
6. Event adapter riêng.
7. Input mapping riêng.
8. Animation definition là data nếu có thể.
9. Không dùng timeout rải rác để sync animation.
10. Tất cả timer đi qua timeline/playback controller.
11. Cleanup phải idempotent.
12. Skip phải luôn đưa presentation về authoritative final snapshot.
13. Reduced motion là first-class.
14. Double battle luôn được test cùng Single.
15. Mọi new UI primitive có keyboard behavior.
16. Asset missing phải observable.
17. Generated coverage phải verify trong `npm run check`.

---

# 29. Definition of Done cho một screen mới

Một screen chỉ được gọi hoàn thành khi:

- visual đúng design system;
- mouse hoạt động;
- keyboard hoạt động;
- gamepad mapping không bị architecture chặn;
- touch target hợp lý;
- cancel/back đúng;
- focus visible;
- no console error;
- responsive desktop/mobile;
- semantic/ARIA basic;
- unit/integration test;
- không duplicate logic data;
- không fetch asset runtime ngoài manifest;
- no stale timers sau navigation.

---

# 30. Definition of Done cho một move animation

Một move animation chỉ hoàn thành khi:

- registry resolve đúng move;
- asset tồn tại;
- actor/target anchor đúng Single;
- actor/target anchor đúng Double;
- miss path;
- immune path;
- blocked path;
- spread path nếu applicable;
- damage commit đúng thời điểm;
- secondary event không bị lẫn;
- reduced motion path;
- 2×;
- skip;
- navigation cancel cleanup;
- no gameplay mutation.

---

# 31. Release QA matrix M-A

Trước R3-100 cần automated hoặc semi-automated matrix.

## Pokémon

- 213 non-Mega entries battle spawn
- 59 Mega forms
- all battle-state forms

## Moves

- 490/490 registry resolution
- physical
- special
- status
- multi-hit
- recoil
- drain
- priority
- weather
- terrain
- hazards
- room
- switching
- two-turn
- semi-invulnerable
- called moves

## Formats

- Single
- Double

## Outcomes

- hit
- miss
- crit
- immune
- Protect
- KO
- switch
- forced replacement

## Presentation controls

- 1×
- 2×
- skip
- reduced motion
- tab hide/show
- resize
- navigate away/back

---

# 32. First implementation order

Khi bắt đầu code sau tài liệu này:

### 1

Tạo:

```text
ui/core/input-manager
ui/core/ui-mode-stack
ui/core/focus-manager
```

### 2

Tạo:

```text
AetherWindow
GameCursor
MessageBox
PokemonHud
MoveTile
```

### 3

Dựng battle screen mới **song song** battle screen hiện tại.

Feature flag/dev route:

```text
/battle?ui=next
```

hoặc internal equivalent.

### 4

Connect với projection/event hiện tại.

Không đổi battle engine.

### 5

Migrate command selection.

### 6

Migrate timeline playback.

### 7

Thêm FxRuntime mới với legacy adapter.

### 8

Khi battle new UI đạt parity:

- switch default;
- giữ legacy screen ngắn hạn;
- regression;
- rồi mới remove.

---

# 33. Những việc chưa nên làm ngay

Không:

- chuyển framework chỉ vì redesign;
- rewrite server;
- rewrite logic.js;
- đổi battle rules;
- mở M-B/M-C cùng lúc;
- thêm ranked online;
- handmade 490 animations trước khi runtime ổn;
- bê asset PokéRogue vào repo;
- xóa UI cũ trước parity.

---

# 34. KPI kỹ thuật

Theo dõi sau mỗi milestone:

```text
UI mode test pass
battle interaction test pass
FX coverage
legacy FX count
missing asset count
console error count
full regression
bundle/load impact
average frame time
animation cleanup leaks
```

Suggested release target:

```text
M-A canonical: 272/272
Move FX resolve: 490/490
missing battle assets: 0
full regression: 100%
critical console errors: 0
keyboard battle flow: 100%
Single/Double smoke: pass
special-form presentation: pass
```

---

# 35. Cách báo cáo tiến độ từ giờ

Mỗi patch nên báo tách:

## Mechanics

Không đổi / thay đổi gì.

## UI architecture

Số primitive/handler được migrate.

## Move FX

```text
signature / template / legacy / missing
```

## Assets

```text
covered / required
```

## Regression

```text
targeted
npm run check
full
```

## Apply-test

```text
missing
extra
checksum differences
```

Không dùng một con số “coverage” duy nhất để che việc animation vẫn chỉ là fallback.

---

# 36. North Star

Aether Champions sau phase này nên có cảm giác:

> **Pokémon battle game trước, web application sau.**

Người chơi không nên nghĩ:

> “đây là một website quản lý Pokémon có battle.”

Mà nên nghĩ:

> “đây là một game Pokémon chạy trong browser.”

Để đạt được điều đó, visual redesign thôi là chưa đủ.

Ta phải đồng thời thay:

- interaction model;
- input model;
- UI state architecture;
- battle message flow;
- animation timeline;
- asset presentation;
- sound synchronization;
- debugging workflow.

Battle engine R3-91 đã đủ mạnh để làm nền.  
Phase mới chủ yếu là **presentation architecture**, không phải viết lại mechanics.

---

# 37. Checklist bắt đầu R3-92

- [ ] Tạo branch/worktree từ R3-91 locked.
- [ ] Ghi baseline SHA/patch.
- [ ] Không thay battle mechanics.
- [ ] Tạo `ui/core/`.
- [ ] InputAction enum/contract.
- [ ] UiModeStack.
- [ ] FocusManager.
- [ ] GameCursor.
- [ ] AetherWindow.
- [ ] MessageBox.
- [ ] PokemonHud prototype.
- [ ] Battle dev route/feature flag.
- [ ] Command handler state machine.
- [ ] Keyboard integration tests.
- [ ] Mouse/focus parity tests.
- [ ] Responsive battle shell.
- [ ] `npm run check`.
- [ ] Targeted tests.
- [ ] Full regression bằng session + poll.
- [ ] Patch apply-test.
- [ ] ZIP patch + full project.
- [ ] SHA-256.

---

# 38. Reference links

### PokéRogue

- https://github.com/pagefaultgames/pokerogue
- https://github.com/pagefaultgames/pokerogue-assets

### Pokémon decomp

- https://github.com/pret/pokeemerald
- https://github.com/pret/pokefirered

### pokeemerald-expansion

- https://github.com/rh-hideout/pokeemerald-expansion

### Pokémon Showdown

- https://github.com/smogon/pokemon-showdown
- https://github.com/smogon/pokemon-showdown-client

---

## Kết luận

R3-91 hoàn tất nền battle-content M-A.

**R3-92 trở đi không phải một đợt “reskin”.**  
Đó là một rebaseline presentation hoàn chỉnh:

```text
R3-91
  Battle/content correctness complete
        ↓
R3-92
  Pokémon UI foundation
        ↓
R3-93
  Battle interaction shell
        ↓
R3-94
  Battle presentation runtime
        ↓
R3-95
  Move animation migration
        ↓
R3-96
  Special forms / Mega presentation
        ↓
R3-97
  Party / Summary / Training
        ↓
R3-98
  Archive / Recruitment
        ↓
R3-99
  Assets / Audio / Polish
        ↓
R3-100
  M-A Presentation Release Gate
```

Đây là hướng mặc định cần bám nếu không có quyết định product mới thay đổi scope.

---

## Post-R3-100 iteration — R3-101 signature presentation wave 2

R3-100 closes the M-A engineering release gate, but presentation quality is intentionally iterative. R3-101 establishes the first post-release-quality rule:

- keep `missing = 0` and `legacy = 0` at all times;
- promote high-value moves from parameterized timelines into signature timelines in reviewed waves;
- keep signature definitions data-driven rather than adding move-specific conditionals to the runtime;
- maintain all 18 move types in the signature-quality set;
- keep semantic audio local/provenance-safe unless a separately approved asset source is introduced;
- never move damage/status commits for visual convenience.

R3-101 baseline after Wave 2:

```text
Active moves:            490
Signature timelines:      30
Parameterized timelines: 460
Legacy timelines:          0
Missing timelines:         0
Signature type coverage: 18/18
```

Future waves should prioritize moves players see frequently, signature/species-defining moves, spread/field moves whose presentation benefits from custom staging, and moves whose mechanics require distinct visual readability.
