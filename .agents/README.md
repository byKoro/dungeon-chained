# .agents — shared AI context for Dungeon Chained

Start at the repo root `AGENTS.md`. This folder is the single source of truth (ADR 0010).

```
context/      what the code is: overview, architecture, conventions, glossary, status, systems/*.md
playbooks/    how to add common things (room piece, enemy, trap, weapon, sound, particle, UI, old branch port)
decisions/    ADRs: why it is built this way (NNNN-slug.md, never renumber)
tasks/        per-change plan/review/verification folders (local issue tracker)
backlog/      approved-but-not-built ideas
skills/       agent skills (SKILL.md each); start game tasks with dungeon-chained-router
```

Reading order for a new session: `context/overview.md` → `context/architecture.md` → `context/conventions.md` → the `systems/` doc for your area → playbook → `decisions/` → `context/status.md`.

Maintenance
- Docs describe `main`. Change code and docs in the same commit; `npm run check` warns when `js/` changes without a context/decisions change.
- Context docs cite file paths and symbol names, not line numbers.
- Keep this folder lean: no skills or docs that don't apply to this project (they cost context for every assistant).
- Adding a skill: drop the folder in `skills/`, list it in `AGENTS.md` → "Agent skills", add `PROJECT-NOTES.md` if it is generic, run `npm run agents:sync`.
