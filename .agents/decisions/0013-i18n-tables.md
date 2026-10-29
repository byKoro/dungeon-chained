# Game text goes through i18n tables, pt-BR by default
Status: accepted (feat/scrap-chest, 2026-10-29). Numbers 0011 (room events) and 0012 (run progression) are reserved by the Início design for later slices.

New player-facing game text is looked up with `t(key, vars?)` from `js/i18n/I18n.js`. Tables are plain frozen objects, one per language: `js/i18n/pt-BR.js` (`PT_BR`) and `js/i18n/en.js` (`EN`). The demo runs in pt-BR. A key missing in the current language falls back to pt-BR, then to the key itself, so a missing string shows up as its key instead of crashing. `{name}` placeholders are filled from `vars`.

Scope: only strings added from the Início slices on (speech bubbles first). Existing English menu labels (`RESUME`, `RESTART`, trailer text) and the pt-BR editor UI are not migrated; the editor stays pt-BR only. A language selector in the pause menu comes later (`setLanguage` already exists).

Why: the script is still "vamos testar" and will change; keeping it as data makes it easy to edit, switch off or translate without touching gameplay code. No library: a 20-line module covers lookup, fallback and interpolation (ADR 0001).
