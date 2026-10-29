# Arauto audio sources

Build: `node scripts/build-arauto-audio.mjs` (Node only, no runtime dependencies).

All outputs are mono PCM16/44.1kHz WAV files. Stone/impact material uses existing repository audio; dash wind uses deterministic filtered noise. Originals remain unchanged.

| Output | Existing inputs | Processing |
|---|---|---|
| `arauto-saw-stone-loop.wav` | `trailer/crack.wav`, `trailer/stone-click.wav` | Ten irregular dry stone snaps with short decay and gaps, seamless 0.8s loop |
| `arauto-dash-01/02/03.wav` | Deterministic generated noise | Three 0.2s gusts, filtered 55-1300Hz with extra low body and soft edges |
| `arauto-dash-loop.wav` | Deterministic generated noise | Thick continuous gust, low turbulence and seamless 0.6s loop; no stone/fire texture |
| `arauto-ground-01/02/03.wav` | corresponding `trailer/impact` and `trailer/boom`, `trailer/crack.wav`, `trailer/stone-grind.wav` | 1.05s dry attack, filtered bass, delayed debris |
| `arauto-slam-01/02/03.wav` | same impact layers | Lower rates, stronger bass and longer 1.75s debris tail |

Build removes DC offset, normalizes peak to 0.78, fades one-shot edges and matches loop endpoints. Cue gain/variation is in `js/config/AudioConfig.js`; contact/duck envelopes are in `js/config/ArautoAudioConfig.js`.
