# Review — gamepad ui

Verdict: approved (self-review; the full `code-review` skill was not run)
Range: 4932b03..working tree

## Findings
- info · `MenuPad.poll` · the first poll only seeds state, so a button held across a screen change never fires on the new screen.
- low · `TrailerPlayer._showGate` · in a browser, pad-only players get a muted trailer and a suspended game `AudioManager` until a key/click (platform limit, `status.md` #19).
- low · button prompts · SKIP/START show no pad glyph; A/Start are discoverable only by trying.
