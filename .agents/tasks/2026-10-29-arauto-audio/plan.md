# Arauto audio

Status: done (automated audio delivery/mix verification; human listening pending)

Approved grilling decisions: continuous metal-on-stone saw contact following spin and quick release; motor stays. Low heavy dash whoosh only during advance, with floor scrape. Ground dry stone attack + short bass + delayed debris, even when miss; slam lower/longer/stronger and ambience ducked. Start from existing repository material and evaluate later whether replacements are needed. Prioritize sound before further visual impact changes.

Context read: architecture, conventions, audio/visual-effects/combat docs, audio-design skill + project notes, add-sound playbook; existing grilling decisions. Work remains on existing feature branch; user camera/map edits and previous dirty work preserved.

Completed:
1. scripts/build-arauto-audio.mjs remixes existing PCM sources into11dedicated WAVs; original files preserved, provenance/build notes in assets/audio/arauto-sources.md.
2. AudioConfig cues and ArautoAudioConfig contact/duck curves.
3. Game-owned ArautoAudio with pure stoneGrindTargets, actual disc geometry, lazy reusable LoopVoice voices and dash movement-edge launch; handles contact loss, stop, pause, transition, scene, death, reset.
4. Combat impact flags drive dedicated cues at impact, including misses; remove boss fall/early generic attack/flesh-hit cues. Keep generic enemies unchanged. Avoid duplicate playerHurt+Game playerHit on boss hits; preserve Game playerHit and player blood.
5. Tests/reviews/browser recording, documentation and graph refresh.

No runtime dependencies and no structural ADR required.


Follow-up scope: user explicitly changed contact timbre to dry snaps and dash to thick strong wind. Reworked generator and regenerated assets, preserved controllers/ground/slam, updated sources, structural texture checks, independent reviews and actualGame recording; isolated previews provided. See verification.md.
