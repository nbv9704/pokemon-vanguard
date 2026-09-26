# Pokémon Vanguard — Code Cleanup Audit — 23/09/2026

## Scope

Audit target: the post-Profile / Ranked PvP Beta v1 project. The cleanup is behavior-preserving: no battle balance, content availability, account save schema, Shop pricing or Ranked rating rule was intentionally changed.

## Findings and decisions

### Refactored

1. **Held-item mechanics** — the previous `mechanics-v3/item-hooks.mjs` mixed state ownership, transfer, damage interception, stat modifiers, status cure and end-turn behavior. It is now a stable facade over four responsibility-specific modules.
2. **Passive handler validation** — the previous single 576-line conditional validator mixed core Ability validation, lifecycle Ability validation and held-item validation. It is now a dispatcher over three validator modules.
3. **Presentation naming** — active code had remaining Aether-era function/event/tooling names. Canonical UI code now uses `renderPokemonWindow` and `vanguard:battle-*`; the old renderer export remains only as a compatibility alias.
4. **Brand/tooling strings** — classic UI title/loading copy, asset-fetch user agents and active schema titles now say Pokémon Vanguard. The frozen v1 legacy engine metadata remains unchanged on purpose.
5. **Duplicate logo** — removed the unreferenced `app/logo.png`; runtime and tests use the identical `app/public/logo.png` copy.
6. **Structural regression guard** — `structure:validate` now rejects production JS/MJS modules above 360 lines, with explicit exclusions only for generated `app/src`, tests and the frozen legacy snapshot.

### Reviewed and intentionally kept

- **`app/src/logic.js` / `app/src/v2-engine.mjs`** — large because they are generated artifacts. The source of truth is `logic-src/*`; direct splitting would be incorrect.
- **`app/server/legacy/logic-v1.js`** — frozen compatibility/history snapshot. It retains historical Aether metadata intentionally.
- **`public/pixel-era-ui.css`** — large, but it is the final visual-theme and resolution-lock override layer. Its cascade order is a runtime presentation contract; the recent Shop bug demonstrated that mechanical CSS splitting can change specificity/load behavior. Page-specific rules should continue moving into route CSS, but this global layer should only be split in a dedicated visual migration with browser screenshots/regression checks.
- **Candidate content snapshots** — duplicated normalized/raw records across dated candidate directories are provenance snapshots, not accidental duplicate runtime code.
- **Gourgeist repeated artwork/sprites** — identical files reflect form-source availability/fallback mappings and are covered by asset manifests; not removed in a code-cleanup batch.

## Verification

- Passive-handler validator parity: 22,127 checked-in handler occurrences, 0 output differences between old and refactored implementations.
- `npm run check`: pass, including the new structure gate.
- Full regression: 1157/1157 pass, 0 fail/skip/todo, verified through the established ten batches.
- Release invariants unchanged: M-A 272/272, Mega M-A 59/59, Move FX 490/490, Pokémon presentation 272/272, held-item acquisition/assets 141/141, foundation 277 forms.
