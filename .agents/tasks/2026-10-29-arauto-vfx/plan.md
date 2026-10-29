# Arauto VFX

Status: done (automated Game/browser verification; human co-op tuning pending)

Approved design from grilling:
- Ground impacts shake even on misses; slam stronger. Accepted player damage shakes briefly.
- Dash local translucent trail; scene/players stay crisp.
- Arauto blood becomes lava embers/stones at saw contact and floor; players retain blood. Bounded decorative residues cool and expire around10s.
- Phase2 retains silhouette with fullbody lava cracks, animated flow and dripping; cosmetic only.
- Transition waits active attack finish, freezes combat about3s, cinematic bars + moderate zoom, fissure buildup/explosion/reveal, HUD scared then angry, restore camera before controls.
- Attack2 raises to frame4, holds full windup, then downswing/impact. Each phase2 slam repeats raise/hold; landings synchronize impact.

Docs/skills read: architecture, conventions, status/glossary, visual-effects/rendering/combat/UI context; router, game-feel + project notes, add-particle-effect; grilling decisions approved explicitly. Existing feat/flame-golem dirty work preserved, including user camera edits.

Implemented:
1. ArautoEffectsConfig tuning, LavaFragment lifecycle, bounded ParticleSystem pool with floor/air layers.
2. ArautoEffects owner: material contact, ground FX, frame/flip-masked cached cracks, animated flow, drips and bounded dash pose history.
3. ArautoPhaseScene/Game: selective simulation state, safe phase timing, cinematic camera/bars/HUD lifecycle; reset cleanup and split-view handling.
4. FlameGolem attack2 raisedFrame4 selected from actual sprite contact sheet; added raise time before configured hold, repeats on later jumps; one-frame ground event.
5. CombatSystem/ThrownSaw material contact route and SawWeapon blood flag; preserve player blood and ordinary enemy feedback. Game accepted-damage shake and skip boss death screen gore.
6. Regression tests, independent review, actual Electron Game capture, docs and graph.

No structural ADR: follows accepted Game-owned systems/config model.
