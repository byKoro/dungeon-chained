# SawTackle audio

Build: `node scripts/build-saw-tackle-audio.mjs`.

Seven deterministic mono PCM16/44.1kHz files, normalized to0.75 source peak. Existing repository recordings retain their original terms; no external audio library or new runtime dependency was introduced.

| Output | Existing sources | Purpose |
|---|---|---|
| saw-tackle-impact.wav | saw-land-01, trailer/thud, trailer/crack | Low metallic body with dry attack |
| saw-tackle-launch.wav | trailer/whoosh-03, saw-motor-loop | Launch air and motor attack |
| saw-tackle-flight-loop.wav | saw-motor-loop, trailer/whoosh-03 | Continuous moving machine |
| saw-tackle-cut-loop.wav | saw-motor-loop, saw-hit-01 | Dense motor texture and short tooth chatter |
| saw-tackle-bite.wav | saw-hit-01, trailer/crack | Initial material contact |
| saw-tackle-bounce.wav | saw-land-01, trailer/crack | Short wall ricochet |
| saw-tackle-land.wav | saw-land-01, trailer/thud | Weight settling on floor |

Loops have DC removed and matched endpoints. One-shots have short attack/release envelopes. Cue routing/voice limits are in AudioConfig; intensity/rate/filter curves are in SawTackleFeelConfig. Accepted-hit sawHit volume is scaled only for the tackle, leaving the other combat paths unchanged.

Game recordings in _local/saw-tackle exercise flesh/stone contacts, five accepted hits, bounce, landing, pause and restart. Subjective timbre, fatigue and co-op balance still require human listening.
