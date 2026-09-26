# Bag & Consumable Tickets (V1)

The Bag lives in the avatar dropdown, separately from top-bar currency. It shows four
consumable tickets and the player's permanent held-item unlocks. The Shop's `Owned`
filter is still a filter, not a Bag shortcut. All spending and protection occur on
the server; the browser does not modify balances.

| Ticket | Acquisition/use | Spending rule |
| --- | --- | --- |
| Recruitment | Existing Recruitment Ticket, including old account balances | Existing recruit-one-Pokémon action (`recruitV3.permanent`) and its current constraints |
| Shop | Purchase an eligible, unowned item offered by the Shop | Exactly one Shop Ticket per item, independent of the VP price |
| Training | Save a validated, paid Pokémon training change | Exactly one Training Ticket for the *entire* transaction, independent of price; free/no-op saves do not consume it |
| Rank | Activate/deactivate in Bag | One ticket on the next Ranked loss that would actually reduce RP; not consumed on victory, draw, or a 0-RP floor |

The Bag stores the three **new** ticket balances under `state.ticketBagV1` and keeps
Recruitment Tickets in the **legacy wallet** (`state.wallet.recruitmentTickets`).
This is intentional: existing Recruitment claims, missions, mail, saves, and receipts
remain compatible. The Bag combines the sources for display. New ticket counts
initialize to **zero**; no new reward drop rates or loot mechanics are invented.

Admin Gift Center can grant all four ticket types. Use `shopTickets`,
`trainingTickets`, `rankTickets`, and/or legacy `recruitmentTickets` in the gift
reward; the recipient receives the ticket(s) on claim. Grants and spending use
the existing receipt-aware economy ledger. Shop purchase action IDs distinguish
`payment: 'coins'` and `payment: 'ticket'`; training validates the build before
checking out and debits the requested payment method. Rank protection is armed
via `bagV1.rankProtection` only outside active PvP sessions.

Ticket art and five ranked-box images already exist in `public/assets/items/`.
Reward-box opening and reward contents are intentionally **not** included here:
only the existing art registry is set up until those game mechanics are agreed.

## Validation

- `node --test tests/ticket-bag.test.mjs tests/ticket-bag-integration.test.mjs`
- `npm test` (all batched regressions)
- `npm run check` (source limits, assets and release gates)
- `npm run package:full -- --output /your/path/PokemonVanguard_full.zip`

`package:full` excludes `.dev.vars` and local save data. Use the safe
`.dev.vars.example` to configure the project on a fresh machine.
