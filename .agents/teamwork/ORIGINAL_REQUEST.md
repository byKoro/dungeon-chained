# Original User Request

## Initial Request — 2026-10-30T07:45:01Z

Re-architect the game codebase on a dedicated git branch with high rigor, establishing a formal architecture design proposal that separates responsibilities for a future Unity port, executing in clear phased stages, refactoring inefficient code, removing dead code, and keeping all game functionality working.

Integrity mode: development

## Requirements

### R1. Git Branch Isolation
Create and perform all work on a dedicated feature branch off `main`, keeping `main` untouched.

### R2. Architectural Design Proposal and Phased Execution
Produce a comprehensive architecture proposal document before modifying core systems, detailing:
- Clean boundary separation between pure game simulation (math, player movement, cable/saw mechanics, combat, entity AI, procedural room placement) and platform-specific code (Canvas 2D rendering, DOM, web audio, keyboard/mouse input).
- A phased execution plan breaking the refactoring into verifiable stages so that each stage can be validated independently.

### R3. Modular Separation of Responsibilities for Unity Port
Execute the refactoring according to the architecture proposal:
- Extract pure domain models and simulation logic into engine-agnostic modules that have zero dependencies on DOM, Canvas 2D contexts, or browser globals, making them directly portable to Unity C#.
- Adapt the existing web/Canvas renderer and input handlers to consume simulation state through clean interfaces, keeping the JavaScript game fully playable.

### R4. Performance Optimization and Dead Code Removal
- Refactor inefficient algorithms, hot-path bottlenecks, and redundant computations identified during the architectural overhaul.
- Remove all verified dead code, unused files, obsolete functions, and unreferenced assets across the project without introducing dangling imports or missing references.

### R5. Functional Preservation
Maintain all existing gameplay mechanics, dual-player tether/saw physics, combat balance, audio triggers, room transitions, and editor features without gameplay regressions or runtime errors.

## Acceptance Criteria

### Workflow and Branching
- [ ] All commits exist on a dedicated feature branch; `main` remains unchanged.
- [ ] An architectural proposal document is delivered detailing domain boundaries, subsystem responsibilities, and the phased migration plan.

### Architecture and Portability
- [ ] Core game simulation (movement, chain/saw mechanics, combat, AI, generation) is isolated in pure modules with no DOM, Canvas, or browser global references.
- [ ] The web Canvas game runs by consuming the decoupled simulation state through defined interfaces.

### Code Hygiene and Efficiency
- [ ] Inefficient routines identified in the architecture review are refactored for performance.
- [ ] Unused files, dead functions, and unreferenced exports are deleted with zero broken imports or runtime reference errors.

### Verification and Regression Gate
- [ ] Existing automated tests (`npm test`, `npm run check`) pass without regressions.
- [ ] The game launches and runs completely in the browser with all mechanics functional and zero unhandled console errors.

