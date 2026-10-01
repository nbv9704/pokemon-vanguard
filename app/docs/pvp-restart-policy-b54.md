# B54 — PvP restart recovery policy

## Supported topology and outcome

The beta supports exactly one live game-coordinator process. `PV_GAME_COORDINATOR_COUNT` fails startup unless it is `1`; distributed match ownership, leases and fencing are not advertised as supported deployment behavior.

An unfinished Ranked match is never resumed after that coordinator restarts. It becomes a durable **no-contest** when either participant next connects:

- no rating change;
- no Ranked match/win/loss/draw increment;
- no Rank Ticket or other ticket consumption;
- no reward or mission progress;
- one matching settlement receipt in both account saves.

Friendly rooms are session-only and close on restart. They carry no rating, ticket, reward or account settlement, and the Arena UI states this policy before room creation.

## Durable boundary

Matchmaking writes `activeRankedMatchV1` to both player saves with the existing atomic pair-storage contract before acknowledging the match. The marker contains only match identity, mode, participant display/rating data, creation time and pinned catalog/rules versions. It deliberately excludes the battle snapshot, RNG seed, rosters and pending commands, so a restart cannot reveal an opponent's hidden choice.

Normal rated settlement and ordinary no-contest settlement remove both markers in the same pair commit that records the final receipts. A lost matchmaking-write acknowledgement is recovered by reading both markers instead of creating a second match. Reconnecting to a match still owned by the current coordinator does not invoke restart recovery.

On a real restart the WebSocket join path loads both saves under the shared account coordinator. Matching markers are atomically replaced with `server-restart-no-contest` receipts. Missing, one-sided or conflicting markers fail closed for manual recovery; the server never guesses an outcome or writes only one account.

No Supabase migration is required because the marker and receipt are fields inside the existing version-3 save JSON and use the already verified `save_game_state_pair` transaction.

## Acceptance evidence

- Dedicated B54 marker/restart/lost-ACK/reconnect/corruption/UI file: 7/7 PASS; broader Ranked/recovery/lifecycle regression: 38/38 PASS before the final guard cases were added.
- Full `npm test`: 1,524/1,524 PASS across 245 files, with 0 fail/skip/todo.
- Source syntax, imports, lint, type contracts, structure, negative contracts, CSS, module and accessibility gates PASS.
- Hosted CI run [`36815940073`](https://github.com/nbv9704/pokemon-vanguard/actions/runs/36815940073) PASS on Ubuntu, Windows and `release-smoke` for B54 code commit `d3424ab`.

This closes optimization item #18 for the declared beta topology. It does not claim live match resume or multi-coordinator deployment support.
