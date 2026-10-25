# Vanilla JS + canvas, no engine, no bundler

Status: accepted (since 2665bbe)

The game is plain ES modules drawn on a 2D canvas, loaded directly by the browser/Electron with no build step and no runtime npm dependencies. This keeps iteration instant (edit, reload) and the code readable by everyone on the team. Consequence: imports must use relative paths with `.js`, no TypeScript, no npm packages in `js/`; anything that needs tooling lives in `scripts/` (Node) or `serve.py` (Python).
