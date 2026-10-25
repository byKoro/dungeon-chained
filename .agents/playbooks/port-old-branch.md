# Playbook: port work from an old branch

Several remote branches (`inimigos-novos`, `branch-inimigo-novo-skull`, `sala-trap-teste`) were cut before the subsystem refactor (ADR 0002). Their files can conflict head-on with `main`. The 2026-10 merge of `branch-rodrigo` set the pattern: keep `main`'s architecture and re-home the feature.

1. Inspect, don't merge blindly: `git log --oneline main..origin/<branch>` and `git diff main...origin/<branch> --stat`.
2. List the feature's pieces (new entity class, assets, config, call sites). Assets and brand-new files usually port as-is.
3. Never resolve a conflict by taking the old `js/main.js` or an old monolith: `main.js` stays the bootstrap.
4. Map each old call site to its subsystem today (see `architecture.md` table): enemy logic → `MeleeEnemy`/`SpawnSystem`/`EntityConfig`/`TinyRpgEnemies`; sounds → `AudioConfig` cue + `audio.play` in `CombatSystem`/`Game`; room state → `Room`; drawing → the right layer in `Game._render`.
5. Prefer data: a new enemy that is just a sprite sheet should be a `TINY_RPG_ENEMIES` entry, not a new class (`playbooks/add-enemy.md`).
6. Work on a new branch from current `main` (`git switch -c port-<feature> main`), cherry-pick or re-implement, commit per piece.
7. `npm run check`, play-test, update `status.md` (branch merged/obsolete) and the relevant `systems/*.md`.
