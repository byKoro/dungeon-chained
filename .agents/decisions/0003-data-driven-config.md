# All tuning in js/config, audio is data-driven

Status: accepted (ba77196)

Gameplay numbers, hazards, lighting, enemy sprite sheets and every sound cue live in `js/config/*` (`GameConfig`, `EntityConfig`, `TinyRpgEnemies`, `AudioConfig`). Code calls `audio.play("cueName")` and never hard-codes volumes/rates; each cue is `{files, volume, rate, rateVariance, ...}`. Designers tweak config without touching logic. Config modules import only other config. Some legacy literals remain (Chain tuning, Player stats) and should migrate when touched.
