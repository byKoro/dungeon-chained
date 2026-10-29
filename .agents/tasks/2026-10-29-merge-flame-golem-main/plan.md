# Merge main and feat/flame-golem

Status: done (validated integration, local branch merge)

User requested merge of main and feat/flame-golem. Started on clean feat/flame-golem b7272f7; main/origin/main0368672. Fetched origin; main had41unique commits, feature9. Integrate main into feature, preserve both histories, then fast-forward local main to combined merge. No remote push requested/performed.

Docs read: AGENTS/conventions/architecture/status and system context from ongoing work; new ADR0011room events and0012run progression; code-review skill. Existing feature was committed/clean before work. New task records this integration only.

Resolved7conflictfiles: Game, CombatSystem, AudioConfig, ContentTools, DemoCamera, SpawnSystem, context/status. Preserve Arauto audio/effects/cutscene/corpse/HUD/infiniteLives and main Ghostfire,forge,scrap/chests/events/runrules,double-saw,upgrades,localizedUI. Camera combines featureverticalmargin with main cameraZoom multiplier.

Semantic integration:
- Actual multiple sawdiscs used for boss collision/audio and ordinary combat; no imaginary midpoint disc while split.
- Solid props/bars rechecked in final boss tether solver. Draw order uses feet sort key and retains corpse/props.
- Reusable regression test tests/test_arauto_double_saw.js covers both factories, seconddisc collision/audio/damage, phantom midpoint and prop/bar pinching.

Verification/reviews in sibling files. Commits keep original histories; no branch deletion/force operations.
