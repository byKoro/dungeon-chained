# .agents/ is the single source of AI context

Status: accepted (2026-10-25)

The team uses Claude (Opus), Codex, Gemini and Kiro. `AGENTS.md` (read natively by Codex, imported by `CLAUDE.md` and `GEMINI.md` via `@AGENTS.md`) is the entry point; context, playbooks, ADRs, tasks and skills live in `.agents/`. Gemini CLI and Codex discover `.agents/skills` directly; Claude Code gets a local copy via `npm run agents:sync` (`.claude/` is gitignored). Skills from Matt Pocock's set write to `GLOSSARY.md`/`docs/adr`; in this repo those map to `.agents/context/glossary.md` and `.agents/decisions/`. Always-on rules from tool-specific formats (Antigravity `rules/`) were folded into `AGENTS.md`.
