# Game orchestrator + subsystems (no monolith)

Status: accepted (2890741, reaffirmed in 4106a48)

The original monolithic `main.js` was split into `Game.js` (orchestrator that constructs every subsystem and defines `_step`/`_render` order) plus one class per concern (`CombatSystem`, `RoomManager`, `LightingRenderer`...). `main.js` is bootstrap only. When branch-rodrigo arrived with features inside the old monolith, they were ported into subsystems instead of reverting. Never reintroduce the monolith; new features are subsystems with constructor-injected dependencies, and nothing imports `Game.js` except `main.js`.
