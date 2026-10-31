# Safe saw landing route

Status: done
Date: 2026-10-31
Branch: feat/tackle-serra; pre-existing shared feature work preserved.

## Goal
Replace the remaining instant relocation from unsafe/out-of-reach stopping points with visible bounded travel to reachable safe ground.

## Context read
AGENTS.md, router and diagnosing-bugs skills; existing code-review workflow; architecture, conventions, weapons, players-and-chain, rooms-and-maps; ADR0003. Inspected SawTackle, DungeonTileQuery, Game collision callback and Chain update order. Graphify unavailable.

## Steps
- [x] Reproduce teleport using actual safeDropPoint + _land in regression test.
- [x] Add landing state, bounded movement and retry tuning to existing SawTackle subsystem.
- [x] Add tile route search with segment collision checks to DungeonTileQuery; inject through Game.
- [x] Revalidate reachable destination at arrival; allow near-hole reachable fallback if preferred targets blocked.
- [x] Cover unsafe landing, wall detours, no-route waits/reopening, fallback and cancellation.
- [x] Focused tests, general gate, Electron runtime verification, independent Standards/Spec reviews and docs.

## Commit cleanup
- [x] Archive unused art/preview sources and temporary Electron harnesses under ignored _local/tackle-unused.
- [x] Remove write-only tackler state, redundant synchronization and redundant comments.
- [x] Consolidate system/status documentation; preserve task Markdown history and both playtest versions.
