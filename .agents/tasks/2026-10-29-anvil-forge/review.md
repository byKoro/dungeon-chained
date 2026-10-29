# Review — anvil forge

Verdict: approved after fixes in `141a4b1` (was changes-requested); #7 waits for a tuning decision
Range: feat/scrap-chest..HEAD

## Resolution
- #1 fixed: `Chain.update` returns early with `spin = 0` while the saw is absent; the motor is also inactive without a saw, with the menu open or during the cinematic (#9). Test added.
- #2 fixed: leaving the room with the saw still on the anvil plays the first-connect feedback (`_onSawReconnect`) during the transition.
- #3, #4 fixed: menu navigation/confirm read only the real keyboard (`input.keyboardKeys`), pads go through `MenuPad`; edges are per key. Tests added.
- #5 fixed: the saw on the anvil is a drawable sorted right after the anvil.
- #6 partly: drop point and the render split use the mean of the discs; sparks, blood pickup and the light still use disc `[0]`.
- #8 fixed: the forge updates before dialogue and interactives and latches their interact state when it opens.
- #10 fixed: no opening during a transition or game over; no door transition starts while the menu is open.
- #11 fixed: the bottom prompt/message and camera label are hidden while the menu is open.
- #12 fixed: `pickup()` resets the split; split feedback only while connected.
- #13 accepted (test-only F6 split mode), listed in verification.
- #14 fixed for the forge/cinematic/split numbers (`FORGE.denySteps/denyRate/splitFeedback`, `SAW_CINEMATIC.focusOffsetY/landShake/landFlash/firstReconnectShake`).
- #7 open: Serra dupla split band vs strain distance; needs a design call.

Slice 2 adds the start-without-saw rule, the anvil menu (ForgeSystem/ForgeMenu/ForgeState), the Size/Elasticity/Double-saw upgrades, the saw cinematic and `CHAIN` config. Classic mode (`mapData` null) and `demo_campaign.json` (no anvil) still start with the saw: `_startsWithSaw` returns true and `applySawUpgrades` at level 0 restores the old cable numbers. The trailer is unaffected because the new `SawWeapon` fields default to the old behaviour. With the saw absent, hole falls (`forceDrop` guards `present`), ThrownSaw (only launched from `onSnap`), hits (`connected` false) and door transitions (`reset()` keeps `present`) behave correctly. Review by code reading plus `npm test` (27/28, only the pre-existing `test_modular_grid.js` fails). The game was not run.

Blocking: findings 1–4. The absent saw still drives the motor loop. Leaving the room with the saw on the anvil leaves `_sawFirstConnect` stuck. Menu input has two problems: a gamepad stick push probably moves the cursor twice, and edges tracked per key group let one player's held key swallow the other player's press.

## Findings

1. **high** · `js/core/Chain.js:update` + `js/Game.js:_updateSawMotor` · Confirmed in code, not heard. When `present` is false the weapon is neither connected nor dropped, so `SawWeapon.update` runs the connected branch. Spin follows the players' speed, and `_updateSawMotor` sends that spin with `connected:false`, which `motorTargets` plays at 0.8 of full level. On `inicial.json` the pair hears a saw motor before the saw exists. The leftover spin also becomes `dropSpin` in `spawnSaw`, so the saw starts spinning when it lands on the anvil. · Skip `weapon.update` (or force spin to 0) while `!present`, and pass `active: this.chain.hasSaw && …` to the motor.

2. **medium** · `js/Game.js:transitionThroughDoor` · Confirmed. Leaving the room while the saw sits on the anvil calls `chain.reset()`, which reconnects silently. The "SERRA" title, the pickup sound and the bigger pop never play, and `_sawFirstConnect` stays true. The next ordinary reconnect after a snap then plays the first-connect feedback (shake 9, `firstReconnectScale`, banner). · Either run the first-connect feedback here, or clear `_sawFirstConnect` here. Alternatively, leave the saw on the anvil (skip the reset while `_sawOnAnvil`) if the design wants the pair to pick it up.

3. **medium** · `js/systems/ForgeSystem.js:handleInput` · Likely. `InputHandler.pollGamepads` turns stick input past 0.35 into `w/s` or `arrowup/arrowdown`, which fires the keyboard edge. `MenuPad` fires its own `up/down` hit at 0.6, usually a frame or more later. One stick push moves the cursor two rows. D-pad and A fire on the same frame, so they collapse into one move. · Read nav and confirm keys from `input.keyboardKeys` (real keyboard only) and leave pads to `MenuPad`. Or ignore keyboard nav edges on frames where a pad is connected and moving.

4. **medium** · `js/systems/ForgeSystem.js:_keyEdges` · Confirmed. Edges are tracked per group (`w`+`arrowup`, `space`+`enter`, `e`+`shiftright`+`escape`), not per key. While any key in a group is down, the other player's press of the same action is ignored. This happens when P2 still holds ArrowUp or Enter from walking or dashing as the menu opens (the snapshot marks it held), and when E is held from opening, which blocks Escape. This undercuts the shared cursor. · Track `held` per key and fire when any key goes from up to down.

5. **low** · `js/Game.js:_renderView` (`_sawOnAnvil`) · Confirmed. The saw on the anvil is drawn after both drawable passes, so it covers players and enemies standing in front of (south of) the anvil. · Insert it as a drawable whose sort key is just past the anvil's feet.

6. **low** · `js/Game.js:_updateGameplay` / `_renderView`, `js/core/Chain.js:update` · Confirmed. Draw, `resolveWeaponHits` and circle collision use every disc. The other consumers still read `getSawPositions(...)[0]`: depth sort `sawY`, spark and blood-pickup emission, the lighting `sawPos`, and the snap drop point plus `onSnap` FX. With the saw split, the second disc has no light or sparks and can sort wrong, and a snap drops the saw at the P1-side disc instead of the middle. · Loop over the discs for FX and light, and use the cable midpoint for the drop point and `sawY`.

7. **low** · `js/config/ForgeConfig.js:doubleSaw` · Confirmed, already noted in status.md. `splitAt` 0.85 (204 px) and `mergeAt` 0.7 (168 px) both sit above `strainDistance` (165 px), and elasticity scales both distances by the same factor. The double saw therefore only exists while strain is building, about 30 steps before the snap. It costs 30 scrap. · Tie `splitAt`/`mergeAt` to `strainDistance`, or pause strain while split, before this ships.

8. **low** · `js/systems/ForgeSystem.js:update` vs `DialogueSystem._interactTapped` / `DemoProgress.update` · Confirmed. All three read their own E/Shift edge from the same key. Near the anvil, tapping E to skip the "talk.sawReady" line (or any line) also reopens the menu. Opening the menu also skips the current line and fires any `DemoProgress` interactive in range. · Consume the tap: when `ForgeSystem` opens, latch the other systems' held state, or route interact through one shared edge owner.

9. **low** · `js/Game.js:_updateSawMotor` · Confirmed. `active` ignores `forgeSystem.open` and `sawCinematic.active`. When upgrades are bought with the saw connected, the motor keeps humming at the frozen spin for as long as the menu is open. · Add both conditions to `active`.

10. **low** · `js/Game.js:_updateGameplay` (`forgeSystem.update` placement) · Confirmed in code, depends on map layout. The menu can open in the same step that `_checkDoorTransition` starts a transition or a hazard sets `gameOver`. The forge branch in `_step` outranks `transition`, so the fade resumes as soon as the menu closes. After a saw purchase, that path silently reconnects (finding 2). With `gameOver`, the menu draws over the death screen. · Also require `!this.transition && !this.gameOver` in `canOpen`, or move `forgeSystem.update()` after the door check.

11. **low** · `js/Game.js:_render` · Confirmed. The bottom DemoProgress message/prompt and the test camera label are drawn after `_renderOverlays`, so they appear on top of the dimmed menu. `messageTime` is frozen while the game is frozen, so a message shown when the menu opened stays up the whole time. · Skip that block while `forgeSystem.open`, or draw the menu last.

12. **low** · `js/Game.js:newDungeon` / `_sawSplitFeedback` · Confirmed. A restart does not reset `split`/`_splitTarget`. If the saw was split, `doubleSaw` resets to false and the next steps merge it, so `_sawSplitFeedback` plays `sawLand`, shakes and spawns sparks even on a run that starts without the saw. · Reset split state in `SawWeapon.pickup` (or `applySawUpgrades`), and gate the feedback on `chain.isConnected`.

13. **low** · `js/systems/DemoCamera.js:renderSplit` · Confirmed. Split mode (F6) sets its own `camX/camY/zoom` per half and ignores `focus`, so the cinematic does not frame the anvil there. This is test-only. · Honour `focus` in `renderSplit` (one full view while `focus` is set).

14. **low** · ADR 0003 · Tuning numbers are inline: `denyT = 12` and its rate 0.6 (`ForgeSystem`), first-reconnect shake 9 and split feedback rate/shake/sparks (`Game`), land shake 5, flash 14 and focus offset −16 (`SawForgeCinematic`), and `SawWeapon` split defaults that duplicate `FORGE.recipes.doubleSaw`. · Move them to `ForgeConfig`/`SAW_CINEMATIC`.
