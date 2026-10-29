# Review
Working changes against c92e13a, excluding preexisting torch, DemoConfig and user map work. code-review skill with independent Standards and Spec agents.

## Standards
Found incorrect clampPlayer argument order and skip interaction leaking through same-frame/multi-step simulation. Fixed using actual room bounds plus real RoomManager regression. Input masks immediately in onFinish and once per input poll until release. Re-review: no remaining actionable findings.

## Spec
Found missing short replay after death (cached boss), skipped raised/downstroke frames and bright boss during door fade. Fixed interrupted living Arauto reset on run death (including start-room reactivation), explicit raised hold/downstroke and dormant pose before pending start. Re-review: no remaining actionable findings.

No human listening/subjective presentation sign-off claimed. Sound reactions are procedural formant synthesis, not voice-actor recordings.
