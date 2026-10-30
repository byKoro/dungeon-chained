# Dispatch: Explorer Survey 1 — Core Simulation & Mechanics

## Assignment
Investigate the core game simulation across the codebase to map all simulation features, mechanics, mathematical models, entity systems, combat, and room generation.

Read:
- `c:\Users\Usuario\Desktop\dungeon-chained\.agents\teamwork\ORIGINAL_REQUEST.md`
- `AGENTS.md`
- `.agents/context/architecture.md`
- `.agents/context/conventions.md`
- `.agents/context/systems/*.md`
- All code in `js/` relating to players, chain, physics, combat, entities, enemy AI, weapons, room generation, math.

Identify:
1. Complete inventory of simulation features (player movement, chain physics, saw mechanics, combat damage, enemy AI behavior, room generation/placement).
2. All current couplings to DOM, Canvas 2D, `window`, `document`, audio, or other platform globals within simulation code.
3. Precise domain models and state structures needed for engine-agnostic simulation (portable to Unity C#).
4. Recommendations for clean simulation interfaces and data flow.

Output your findings to: `c:\Users\Usuario\Desktop\dungeon-chained\.agents\teamwork\explorer_survey_1\handoff.md`
Include `progress.md` in your folder for liveness.

## 2026-10-30T07:47:35Z
You are Explorer Survey 1 (Core Simulation & Mechanics).
Your working directory is: c:\Users\Usuario\Desktop\dungeon-chained\.agents\teamwork\explorer_survey_1\
Original request path: c:\Users\Usuario\Desktop\dungeon-chained\.agents\teamwork\ORIGINAL_REQUEST.md
Dispatch instructions path: c:\Users\Usuario\Desktop\dungeon-chained\.agents\teamwork\explorer_survey_1\DISPATCH.md

You are a read-only exploration agent. Your mission:
1. Read ORIGINAL_REQUEST.md, DISPATCH.md, AGENTS.md, .agents/context/architecture.md, .agents/context/conventions.md, .agents/context/systems/*.md.
2. Investigate the codebase in js/ relating to players, chain, physics, combat, entities, enemy AI, weapons, room generation, and math.
3. Map every simulation feature, boundary, and data model.
4. Identify all couplings between simulation logic and platform/DOM/Canvas/browser globals.
5. Provide detailed recommendations and specifications for pure, engine-agnostic domain models and simulation systems portable to Unity C#.
6. Maintain progress.md in your working directory with 'Last visited: [timestamp]'.
7. Write your final report to handoff.md in your working directory and notify the parent orchestrator via send_message when complete.
