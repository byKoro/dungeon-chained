# Project notes: audio-design in Dungeon Chained

SKILL.md is a literal upstream copy (from .kiro/skills, awesome-gamedev-agent-skills). It is engine-neutral or shows Godot/Unity/etc. examples; this game is vanilla JS + canvas (ADR 0001). Apply the ideas through the project APIs below.

Bus graph and cue table: .agents/context/systems/audio.md. Cues in js/config/AudioConfig.js ({files, volume, rate, rateVariance, cooldownMs, maxVoices}). Ducking via audio.duck affects only loop beds. Saw motor = LoopVoice driven by motorTargets (js/weapons/SawMotorAudio.js), unit-tested in tests/test_saw_motor_audio.js. No adaptive music system yet. Playbook: .agents/playbooks/add-sound.md.
