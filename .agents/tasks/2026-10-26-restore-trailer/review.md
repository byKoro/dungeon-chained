# Review — restore trailer

Verdict: approved (self-review; the full `code-review` skill was not run)
Range: 19a6979..working tree

## Findings
- info · `js/trailer/**` · restored from `9b13c52~1` with comments stripped (team style from `9b13c52`); code is unchanged. Game modules it imports differ from `9b13c52~1` only in comments, so no API drift today.
- info · `js/ui/TrailerOverlay.js` · replaces `buildTrailerUI` from the old `main.js` (ADR 0002: `main.js` stays bootstrap). Also clears the SKIP timer and removes the resize listener on `hide()`; the old code leaked the resize listeners.
- low · `TrailerPlayer._pollPad` · no pad path to START/SKIP or the gate (pre-existing behaviour, logged as `status.md` #19).
- low · assets · `megasong.mp3` and the trailer wavs are back in the repo and in the Electron build (`assets/**/*`), which makes it bigger.
