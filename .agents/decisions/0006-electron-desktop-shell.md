# Electron as the desktop shell

Status: accepted (1b3c547)

The distributable is an Electron app (`npm run dist`, Windows NSIS + portable) that serves the repo through a custom `app://game/` protocol, because `fetch` of local JSON fails over `file://`. The game code stays browser-compatible; Electron adds only window/fullscreen/devtools handling in `electron/main.cjs`. Packaged files are whitelisted in `package.json` `build.files`.
