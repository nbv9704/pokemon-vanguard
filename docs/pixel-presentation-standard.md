# Aether Champions Pixel Presentation Standard

**Baseline:** R3-103 resolution-locked visual direction

Aether Champions targets a **Gen III / GBA-inspired pixel presentation rendered on a modern browser surface**. The goal is the same design logic seen in games such as Pokémon Emerald and in PokéRogue: low-resolution composition, sharp pixel edges, compact window grammar, cursor-driven navigation and a high-resolution output surface.

## Core rules

1. Treat battle as a **320×180-inspired 16:9 composition**, even when the browser renders it at HD resolution.
2. Author the application on one **1280×720 logical surface** and uniformly fit that surface to the physical viewport. Letterbox/pillarbox when aspect ratios differ; do not reflow desktop composition based on physical resolution.
3. Pixel UI geometry remains hard-edged, but raster image resampling is asset-aware: high-resolution artwork/SVG fallback and the current cropped animated battle GIFs use browser smoothing to avoid jagged fractional scaling. Re-enable nearest-neighbour only for assets authored on a standardized pixel canvas where integer scaling can be guaranteed.
4. UI windows use square corners, hard inset highlights and hard offset shadows. Avoid glassmorphism, soft blur and large rounded cards.
5. All management screens share one grammar: blue game chrome, cream content windows, dark navy borders, yellow focus/cursor state.
6. Keyboard/controller focus is visible as a game cursor (`▶`), not only as a browser outline.
7. Battle HP bars, buttons, tabs and status panels use hard-edged geometry.
8. Animation can remain smooth when it communicates motion, but resting actor/UI positions must read as pixel-aligned.
9. No external runtime fonts are required. The current baseline uses an offline monospace/system stack until a provenance-safe bitmap/pixel font is approved.
10. Presentation changes never calculate battle mechanics; the authoritative engine/event contracts remain unchanged.
11. Legacy `@media (max-width: ...)` component reflows must not change the logical desktop composition while `resolution-locked` is active; the viewport scaler owns physical resolution adaptation.

## Palette baseline

- Navy shell: `#10233d`
- Field/menu blue: `#244f7c`
- Highlight blue: `#78a6c7`
- Cream paper: `#f7f2d7`
- Ink: `#18243a`
- Focus yellow: `#f4d35e`
- HP green: `#5ea84f`
- Danger red: `#c4544d`

## Screen expectations

### Battle

- Full game surface, not a dashboard card.
- Battlefield above a bottom command/message window.
- Pokémon HUDs use square GBA-style boxes and hard HP bars.
- Command flow remains `Command → Move → Target/Party → Review`.
- Move FX may use modern rendering internally, but must visually sit inside the pixel composition.

### Party / Summary / Training

- Cream game windows with blue headers.
- Tabs behave like cartridge-era menu tabs, not web pills.
- Party cards use hard borders and selected-slot yellow highlighting.

### Pokédex / Ranch

- Dense grid selector, explicit cursor, preview pane.
- Entries use square indexed cells.
- Form tray is a compact game control, not a rounded chip carousel.

### Global navigation

- Horizontal game menu bar replaces the old fixed dashboard sidebar presentation.
- Resource counters are compact HUD cells.

## Current implementation

`app/public/pixel-era-ui.css` is loaded after every prior stylesheet and intentionally acts as the visual compatibility layer while the DOM/state architecture from R3-92–R3-101 remains intact. R3-103 adds `app/public/js/ui/core/game-viewport-scaler.js`, which locks the presentation to a 1280×720 logical surface and sets the uniform fit scale from the real browser viewport.

This approach makes R3-102 a testable visual rebaseline without reopening mechanics. Later batches may move stable pixel rules back into their owning component stylesheets once the direction is accepted.
