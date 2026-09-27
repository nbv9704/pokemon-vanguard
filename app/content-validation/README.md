# Frozen validation snapshots

These 20 small, reviewed JSON inputs were copied unchanged from the source project's normalized candidate snapshots. The playable content remains under `content-active/` and `content-src/`.

The full-project ZIP deliberately omits `content-candidates/` (raw downloaded working data). Release gates and tests now read these read-only snapshots instead, so the ZIP can validate without local authoring directories. `snapshot-manifest.json` records their SHA-256 hashes; `npm run check` verifies those hashes.

When intentionally updating content, review new candidate inputs, update this frozen copy and manifest together, and rerun all content/release gates. The candidate-builder and promotion commands still require a deliberate authoring checkout with `content-candidates/`. No production gameplay data or save migration was changed by this snapshot move.
