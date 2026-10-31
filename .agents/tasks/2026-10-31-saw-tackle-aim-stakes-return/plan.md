# saw tackle aim (enemies+stakes) + natural return

Status: done
Branch: feat/cage-visual-editor  Date: 2026-10-31

## Goal
Make the "dash into the loose saw" technique (`SawTackle`) a bit more helpful and reliable:
1. When activated, the launch gets a light-but-meaningful aim assist toward nearby
   enemies AND stakes (estacas); and the tackled saw in flight can cut ropes (cage/
   chest/gate) by passing through a stake — same cut as the connected saw.
2. The launched saw always comes back naturally to an area around where it was
   launched and never ends up on a tile the players cannot reach.

## Context read
- .agents/backlog/tackle-serra.md (the approved spec for this ability)
- js/systems/SawTackle.js (_assistAim, flight/return, _land/_updateLanding/_forceLanding)
- js/config/SawTackleConfig.js (aimCone/Range/MaxTurn, return*, arriveRadius, flightMode 'return')
- js/systems/StakeRope.js (sawGap — rope-cut distance; only sees connected/thrown/spinningLoose today)
- js/systems/CageEncounter.js (_checkCuts/_sawGap, stake points), RoomEvents.js (handlers)
- js/weapons/SawWeapon.js (tackleState/sawLocked, dropX/dropY), ThrownSaw.js
- js/Game.js SawTackle wiring (isSolid/safeDrop/findLandingRoute/canLand), DungeonTileQuery drop points

## Steps
- [ ] 1. `sawGap` detects the saw during a tackle flight (StakeRope.js) → the tackled
         saw cuts ropes. Verify CageEncounter cuts when the saw sweeps a stake.
- [ ] 2. Aim assist also considers stakes. Add `getAimTargets` to SawTackle; merge into
         `_assistAim`. Game injects uncut stake points via RoomEvents.aimPoints() →
         CageEncounter stake aim points.
- [ ] 3. Natural return guarantee: `_forceLanding`/landing lands on a reachable point
         (prefer near origin). Confirm default return mode + arriveRadius.
- [ ] 4. Tests + Electron smoke + docs (weapons.md / rooms-and-maps.md, status.md).

## Docs to update
- [ ] .agents/context/systems/weapons.md (saw tackle: stakes in aim assist, rope cut, return guarantee)
- [ ] .agents/context/status.md
