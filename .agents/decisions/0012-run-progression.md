# Run progression: scrap resets on death, items and finished events stay
Status: accepted (feat/room-events, 2026-10-29)

Applies to Editor 2.0 maps that have at least one anvil (`Game._runRules`). Other maps keep the game over screen.

When either player reaches 0 lives, `Game._respawnRun` runs instead of game over:
- both players respawn at the start room's spawn with 3 lives (short invulnerability, black fade);
- the saw comes back connected if it was forged (`forge.has("saw")`), otherwise the pair is still without saw;
- the scrap pot and the scrap on the floor reset to 0;
- forged items and upgrades (`ForgeState`), opened chests (`ChestSystem`), `DemoProgress` items and completed encounters stay;
- an encounter interrupted midway restarts (`RoomEvents.onDeath` → scripts restore ropes, cage, bars and remove its enemies).

Restart (`newDungeon`) still wipes everything. No save between sessions.

Why: the design wants a loop of fighting for scrap, buying upgrades and trying again without losing progress, while keeping a cost (the scrap) for dying.
