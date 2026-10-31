# Verification: coop heal juice

## Commands run
- `npm test -- coop_heal`: pass (existing 11 assertions; behaviour unchanged).
- Node smoke of CoopHeal + CoopHealFeedback: charge shows alpha 1 / progress 0.5 / motes at 30 steps; damage sets `broke='hurt'`, alpha 0, shards spawned; heal pushes "+1" for both, bursts 2, light pulse; cooldown keeps alpha 0.
- Headless Chrome via Playwright (`_local/coop_heal_smoke.py`, server `python serve.py`), captures `_local/coop_heal_{1_charge30,2_charge85,3_heal,4_heal_after,5_break,6_room}.png`:
  - first pass: ring (rx 24) hidden under the sprites, motes covered the bodies as green noise, heal ring dimmed by the darkness pass. Fixed: ring rx 32/ry 14, motes spawn on the side arcs, heal ring moved to the unlit overlay.
  - second pass: bottom arc fills visibly, "+1" above each player, heal ring bright, room light visible. Lives 1→2. Break: 24 shards, ring stays hidden 24 steps while the charge restarts. Separation fades in 12 steps.
  - console errors: only the known tileset 404s (#15).
- `npm run check`: tests 61/63 (pre-existing `test_arauto_effects`, `test_modular_grid` #5; `test_flame_golem` is flaky, 2/5 isolated runs fail, does not import touched files). Map: pre-existing #4 only. Docs drift OK, graph rebuilt.

## Not verified
- Real playtest feel with keyboard/gamepad and sound.
- `prefers-reduced-motion: reduce` path (code only).
- Split view (two viewports) rendering.
- Electron build.

## Card do Vínculo (follow-up)
- `js/ui/CoopHealDemo.js` + `CARDS["ability.coopHeal"]` + i18n + `Game._onForgeBuy` (level 1 only).
- Headless Chrome (`_local/coop_heal_card_smoke.py`): after `forge.setLevel('coopHeal',1)` + `_onForgeBuy('coopHeal')` the card is active with key `ability.coopHeal`; demo at t 0.55/1.48/2.72/3.30/3.82 s shows walk-in, ring 23%→80%, heal (lives 2→3, "+1", heart pop). First framing (9×5) left the players small and a skull prop under P1's hearts; switched to 7×4 and no props from row 2 down. Level 2 purchase does not show the card. No console errors besides the known 404s.
- `test_ability_card`, `test_i18n`, `test_coop_heal` pass; `npm run check`: only pre-existing failures.
- Not verified: buying through the real anvil UI, gamepad, rebuy after a room death (shows the card again because the level resets to 0).

## Arrastar à venda, cards de Estalo/Inércia/Arrastar/Impacto, Impacto mais forte (follow-up 2)
- Tests: `test_dash_push`, `test_forge`, `test_forge_menu` (updated: default anvil now 7 recipes; cursor wrap 6; Size bought with 3 downs), `test_saw_upgrades` (catalog string), `test_i18n` pass. `npm run check`: only pre-existing failures (#4, #5, arauto_effects).
- Headless Chrome `_local/cards_smoke.py`: each card opens from `_onForgeBuy` at level 1; per-step state logged (drag: grab at ~1 s, reconnect ~2.6 s; snap: 4 kills at the snap; inertia: 2 kills at ~2.2 s; dashPush: enemy 634 → 690 at the wall). Frames `_local/card_*_N.png` inspected.
- In-game Impact (`--game`): first runs exposed (1) radial-only push sending the enemy backwards after the dash overshot (fixed with dash-direction push + `contactBias`), (2) false slam from the enemy walking against the push (fixed with `launchStagger`), (3) the dash overtaking the enemy pinned on the wall and body collision spitting it out (fixed: cancel the launcher's dash + zero velocity on slam). Final trace: launch −12 px/step, ~57 px to the north wall, pinned, player stops at ~1620.
- Not verified: audio, gamepad, real anvil UI purchase, crowds/hole edges.
