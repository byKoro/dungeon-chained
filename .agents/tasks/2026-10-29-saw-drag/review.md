# Review — saw drag

Verdict: approved (self-review by reading the diff; no separate reviewer this time)
Range: feat/anvil-forge..HEAD

## Findings
- low · `SawDrag.update` · Holding interact also fires the first-frame tap of chests, the forge and `DemoProgress` when the saw is next to them. Accepted for now; listed in status.md.
- low · `SawDrag.update` · Against a hole or wall the saw stops instead of sliding along it, so dragging around corners snaps the short cable. Acceptable for the first version.
- low · `SawDrag.drawRope` · Placeholder art; almost invisible at the current rope length.
- Checked: classic mode has no `sawDrag` (`mapData` only) and every call is `?.`; the dragger cannot dash; door transitions and `newDungeon` reset the drag; the partner reconnect path is the normal `Chain` one (rope 46 < pickup 60).
