# Review: coop heal juice

- Feedback is render/step-only: CoopHeal logic unchanged except the two one-step flags; existing tests pass.
- Follows ADR 0002/0003: new subsystem in its own file, constructed in Game with injected deps; numbers in `js/config/CoopHealFeelConfig.js` (config-only import).
- Pixels snap to the 4 px world grid; no image smoothing involved (fillRect only).
- Ring pixel lists cached by radius; heal burst radii are snapped to the pixel step so the cache stays small.
- Risk: `DamageNumber` now accepts `opts.text`; default path unchanged.
- Working tree already had the user's uncommitted `feat/tackle-unlock` work (incl. Game.js); nothing committed, no branch switch.
