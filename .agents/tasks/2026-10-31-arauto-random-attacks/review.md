# Review

Scope: working diff against HEAD (258568f), plus new regression test. Spec: user report and plan.md. Applied code-review skill with separate parallel Standards and Spec agents.

## Standards
No substantive violations or actionable code smells. Config owns probability; existing FSM and dependencies preserved. Stale pressure comment corrected; required docs updated.

## Spec
No functional findings. Nearby attacks are randomized in both phases, and valid phase 2 dash no longer suppresses jump. Terrain fallbacks and recovery preserved. Optional boundary/fallback test expansion noted.

Total: zero outstanding findings on either axis.

## Tracking/sequences follow-up review
Parallel Standards and Spec reviews found no functional/standards issues. Corrected the stale config comment about warning/dash tracking. Sequence cancellation on invalid terrain remains intentional. Runtime feel still requires playtest.

## Distant pursuit follow-up
Parallel Standards and Spec reviews: no actionable findings. Timings/probabilities are config-owned; walking persists without per-frame random retries, near targets interrupt, and phase 2 ranged variety remains.

## Attack repetition memory follow-up
Parallel Standards and Spec reviews found no actionable issues. History is recorded on actual windup start and retained across retreat; repeat probability decreases progressively without forced alternation. Ranged decisions remain unchanged.

## Nearby action variety follow-up
Parallel Standards and Spec reviews found no actionable issues. Nearby decisions mix adaptive close attacks, brief committed walking and validated dash against the near player. Invalid dash fallback and separate pursuit commitments are covered.
