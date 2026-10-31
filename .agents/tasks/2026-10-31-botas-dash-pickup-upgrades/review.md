# Review — botas room feature

Date: 2026-10-31

## Scope
- 5 new forge recipes (moveSpeed, dashPush, coopHeal, dashCooldown, dashCharges) reusing the saw forge machinery.
- Player dash reworked to support charges + scaled cooldown + speed mult (backward-compatible at 1 charge).
- DashPush, CoopHeal systems; BootsPickup floating item that grants the dash; BotasRoomScript entry cinematic; AbilityCard tutorial.
- inicial.json botas anvil points at the 5 new recipes; boots PNG placeholder.

## Self-review vs. conventions / ADRs
- ADR 0002/0003: new behaviour lives in dedicated subsystems (DashPush, CoopHeal, BootsPickup, BotasRoomScript, AbilityCard), constructed in Game and called from _updateGameplay/_render; config in ForgeConfig/DemoConfig (config imports only config); i18n via t() tables (ADR 0013), added to both pt-BR and en.
- ADR 0014 (room death): the new forge buys ride the existing per-room rollback (_recordRoomForgeBuy/_rollbackRoomForgeBuys — they call forge.buy via onBuy, so rollback already covers them). The boots re-appear + dash re-traps only when dying IN the botas room (guarded by room name), matching "only that room resets". coopHeal/dashPush reset on room death too.
- No new npm deps, no bundler, imports relative with .js, no verbose comments.
- Backward compat verified: dashMaxCharges defaults to 1 → old single-dash behaviour; all prior dash/tackle tests pass after updating the catalog assertion and the cancelDash charge-consume.

## Risks / follow-ups
- Not playtested by a human (feel of upgrades, cinematic cadence, card look, boots visuals). 
- Entry-cinematic vs. combat sequencing in botas (enemies act during the ~2s tour) — worth a playtest; could gate the tour before enemy activation if it feels bad.
- Boots art + the `sawPickup` reused sound are placeholders.
- The 5 upgrade numbers are provisional (documented), to tune in playtest.
- coopHeal/dashPush/dashCharges are available on any map whose anvil lists them; only the botas anvil does today. moveSpeed etc. have no prerequisite by design (per the grill).
