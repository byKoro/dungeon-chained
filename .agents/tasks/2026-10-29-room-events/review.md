# Review — room events

Verdict: approved (self-review by reading the diff; no separate reviewer this time)
Range: feat/saw-drag..HEAD

## Findings
- low · `CageEncounter._checkCuts` · Cutting needs the cable within 1,5 tiles of the stake; standing next to a stake right when the encounter starts can cut that rope on the same step. Acceptable; tune `cutRadius` when playing.
- low · `RoomEvents._script` · Script chosen by room name; renaming `inicial` in the editor silently disables the encounter. Documented in ADR 0011.
- low · Enemy navigation ignores bars (BFS uses the floor grid only). Enemies do not need to leave the Salão during the fight.
- low · `Game._respawnRun` keeps the blood canvas when the death happens in the start room; fine visually, noted.
- Checked: classic mode and maps without anvil keep game over (`_runRules`); hidden chest has no collision, no prompt, no interact; hidden enemies excluded from collision and refused by `takeHit` (frozen); `newDungeon` resets events, death does not reset completed ones.
