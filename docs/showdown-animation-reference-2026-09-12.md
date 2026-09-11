# Pokémon Showdown animation reference — 12/09/2026

Repository inspected: `smogon/pokemon-showdown-client`, commit `1e3b209011340e7c149a2e94769183eb4351b2e9`.

This is an architecture reference for Pokémon Vanguard R7. It is not a plan to embed the Showdown client or copy its animation catalog.

## What the repository contains

The battle animation system is primarily code:

- `play.pokemonshowdown.com/src/battle-animations.ts` defines the scene, sprite actors, coordinates, transitions, reusable effect metadata, status/other animations and move dispatch.
- `play.pokemonshowdown.com/src/battle-animations-moves.ts` defines move-specific timelines and aliases many moves to an existing animation.
- The inspected revision contained roughly 608 direct move-animation entries, 328 move aliases and 64 reusable effect definitions. These counts describe that revision and are not a compatibility contract.
- `runMoveAnim` looks up a move ID, uses broad fast profiles at high playback acceleration, and falls back to Tackle when no move entry exists.
- An animation entry may expose `anim`, `prepareAnim` and `residualAnim`. Timelines combine effect creation with actor/effect translation, scale, opacity, rotation, easing, delay and scene time offset.

The repository README states that `/sprites/` and `/audio/` are excluded for size reasons. The checked-out tree does include a smaller `fx/` collection used by the animation code; those files are separate from the full Pokémon sprite and audio resources.

## Licensing boundary

The repository as a whole is AGPLv3. Its README asks projects that want to reuse client code under another license to contact the maintainer. The inspected source headers identify `battle-animations.ts` as MIT and `battle-animations-moves.ts` as CC0-1.0, while effect assets contain mixed author/source comments.

Vanguard will therefore use the architectural ideas below and create its own modules, timeline data and FX assets. Any future direct reuse must first record the exact file, revision, declared license and asset provenance.

## Vanguard rendering contract

The Pokémon graphic is an idle actor. A move does not need a species-specific attack GIF. During a move, the front GIF continues idling while independent visual layers show the skill. A slot or camera may shake on impact without replacing the Pokémon graphic.

The renderer consumes battle events and cannot write battle state:

```text
authoritative engine
  -> ordered public battle events
  -> animation adapter
  -> move profile lookup
  -> timeline runner
  -> FX layers and UI cues
```

Each cue carries stable actor and target slot IDs, move ID/type/category, public outcome flags and an authoritative post-event frame. The renderer uses those fields only to choose and position visuals. HP changes when the event frame commits, regardless of playback speed or skipped animation.

## Three-level animation registry

1. **Primitives** draw or instantiate one visual concept: orb, beam, slash, ring, spark, leaf, rock, droplet, smoke, shockwave, status glyph, shield, ground crack or field tint.
2. **Profiles** compose primitives into reusable timelines: contact, projectile, beam, pulse, spread, self-buff, target-debuff, heal, guard, weather, terrain, hazard and transformation.
3. **Move overrides** exist only when a generic profile cannot communicate the move. An override may reuse another profile with parameter changes instead of duplicating a timeline.

Lookup order is `move override → declared profile → type/category fallback → minimal readable cue`. A missing effect never falls back to no feedback and never blocks event playback.

## Scene and timing model

- Use normalized arena coordinates and resolve them to DOM rectangles at playback time.
- Define actor, target, ally, center-field and side-field anchors for Single and Double independently.
- Maintain `field-back`, `behind-actors`, `actors`, `front-fx` and `battle-ui` layers.
- A timeline is declarative data with tracks, start time, duration, easing and keyframes. The runner owns cancellation, speed scaling and reduced motion.
- Spread moves create one target track per authoritative target and synchronize the commit point. Sequential multi-hit moves instead receive or derive explicit hit events.
- Weather, terrain, screens and hazards use persistent layer handles created/updated/removed by condition events rather than replaying a one-shot move animation every frame.
- Skip cancels pending visual work, removes temporary nodes and commits the latest authoritative frame. Reduced motion keeps captions, target highlights, final HP and condition state while removing travel, flashes and shake.

## Module boundaries for R7

```text
public/js/battle-fx/
  timeline-runner.js
  scene-anchors.js
  primitive-canvas.js
  primitive-dom.js
  profile-registry.js
  profiles-contact.js
  profiles-projectile.js
  profiles-field.js
  move-overrides.js
  persistent-conditions.js
```

The current `public/battle-animation.js` is a compatibility renderer. R7 should extract responsibilities into these modules before adding the M-A move set. No hand-authored file should become a thousands-of-lines move catalog; generated coverage reports may be large because they are not edited by hand.

## R7 acceptance checks

- Every enabled M-A move resolves to a known override/profile/fallback and reports that choice in a generated coverage file.
- The same battle events reach the same final DOM/HP state at 1×, 2×, Skip and reduced motion.
- Single/Double anchor fixtures cover self, ally, one foe, all foes, all adjacent and field targets.
- Cancellation removes all temporary nodes, animation handles and scheduled callbacks.
- Runtime works offline and does not fetch Showdown, PokéBase or GitHub.
- Visual QA samples every primitive/profile, all 18 types, blocked/immune/super-effective outcomes, weather/terrain and Mega transformation.
