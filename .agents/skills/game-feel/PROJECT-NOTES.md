# Project notes: game-feel in Dungeon Chained

SKILL.md is a literal upstream copy (from .kiro/skills, awesome-gamedev-agent-skills). It is engine-neutral or shows Godot/Unity/etc. examples; this game is vanilla JS + canvas (ADR 0001). Apply the ideas through the project APIs below.

Juice toolbox already in the game: see .agents/context/systems/visual-effects.md (table 'Juice toolbox'). Hooks: renderer.triggerShake / triggerZoomPunch (js/core/Renderer.js), gameLoop.triggerHitSlowmo (= hit-stop, HIT_SLOWMO in GameConfig), screenGore.triggerFlash / trigger (js/systems/ScreenGore.js), particleSystem.trigger* (js/particles/ParticleSystem.js), audio.duck (js/core/AudioManager.js), postProcessor.setVignetteBreath. Shake is max-merge, not additive, and decays per render frame. Engine snippets in SKILL.md (Godot/Unity) do not apply: translate to these calls inside Game.js or a system. Playbook: .agents/playbooks/add-particle-effect.md.
