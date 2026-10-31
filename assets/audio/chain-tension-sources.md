# Chain tension loop

`chain-tension-loop.wav`: mono PCM16, 44.1 kHz, 1.6 seconds, peak 0.7.

Built deterministically with `node scripts/build-chain-tension-audio.mjs`. Short overlapping grains from the existing `saw-snap.wav` cable tail are mixed with synthesized, modulated inharmonic metal resonances. No external sound library or new runtime dependency. Existing source retains its original repository terms; synthesis and remix authored for this feature.

The loop removes DC, matches endpoints and avoids replaying the rupture attack. Runtime gain is automated in decibels; playback rate rises 0.78–1.32 and low-pass opens 1400–8500 Hz. Cue gain lives in AudioConfig, curves in ChainTensionConfig. Rupture reuses the existing `sawSnap` event and asset, with no duplicated snap layer.

Actual Game output recorded in `_local/tension/game-audio.wav`: increasing RMS across effort stages, no saturated samples in the captured output. Subjective headphone/speaker balance and repeated co-op play still require human listening.
