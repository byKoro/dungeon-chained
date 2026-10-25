# Project notes: game-ui-ux in Dungeon Chained

SKILL.md is a literal upstream copy (from .kiro/skills, awesome-gamedev-agent-skills). It is engine-neutral or shows Godot/Unity/etc. examples; this game is vanilla JS + canvas (ADR 0001). Apply the ideas through the project APIs below.

UI = DOM overlays (index.html + js/ui/PauseScreen, DeathScreen, LoadingScreen) built from canvas-rendered PixelButton/PixelSlider, plus canvas HUD VtuberHud. Integer pixelScale() scaling, focus = hover, gamepad menu in Game._pollMenuPad. See .agents/context/systems/ui.md and .agents/playbooks/add-ui-screen.md.
