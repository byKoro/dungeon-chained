# Dispatch: Explorer Survey 3 — Performance, Dead Code, Test Infrastructure & Tooling

## Assignment
Investigate the codebase for performance bottlenecks, dead code/unused files/unreferenced exports/assets, test suite baseline, and git configuration.

Read:
- `c:\Users\Usuario\Desktop\dungeon-chained\.agents\teamwork\ORIGINAL_REQUEST.md`
- `AGENTS.md`
- `.agents/context/status.md`
- `package.json`, `tests/`, `tools/`
- All source files in `js/`, `map/`, `assets/`

Identify:
1. Performance bottlenecks, inefficient loops/algorithms, hot-path allocations, and redundant computations in physics, rendering, entity updates, or room generation.
2. Verified dead code, unused files, dead functions, unreferenced assets, or obsolete exports across the project.
3. Test suite coverage and baseline status: existing tests in `tests/`, `npm test`, `npm run check`, known test/doc issues listed in `status.md`.
4. Git branch status and requirements for branch isolation (Requirement R1: feature branch off `main`).
5. Concrete recommendations for phased dead code removal and performance refactoring without breaking imports or tests.

Output your findings to: `c:\Users\Usuario\Desktop\dungeon-chained\.agents\teamwork\explorer_survey_3\handoff.md`
Include `progress.md` in your folder for liveness.


## 2026-10-30T07:47:49Z
You are Explorer Survey 3 (Performance, Dead Code, Test Infrastructure & Tooling).
Your working directory is: c:\Users\Usuario\Desktop\dungeon-chained\.agents\teamwork\explorer_survey_3\
Original request path: c:\Users\Usuario\Desktop\dungeon-chained\.agents\teamwork\ORIGINAL_REQUEST.md
Dispatch instructions path: c:\Users\Usuario\Desktop\dungeon-chained\.agents\teamwork\explorer_survey_3\DISPATCH.md

You are a read-only exploration agent. Your mission:
1. Read ORIGINAL_REQUEST.md, DISPATCH.md, AGENTS.md, .agents/context/status.md, package.json, tests/, tools/.
2. Investigate the codebase for performance bottlenecks, hot loops, allocations, and redundant computations.
3. Identify all dead code, unused files, dead functions, unreferenced assets, and obsolete exports across js/, map/, assets/.
4. Inspect the test suite and verification tools: npm test, npm run check, and the known issues noted in status.md.
5. Check git status and branch requirements for Requirement R1 (feature branch off main).
6. Provide concrete, actionable lists of dead code for removal, performance refactoring opportunities, and test baseline validation steps.
7. Maintain progress.md in your working directory with 'Last visited: [timestamp]'.
8. Write your final report to handoff.md in your working directory and notify the parent orchestrator via send_message when complete.
