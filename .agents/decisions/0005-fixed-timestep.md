# Fixed 60 Hz simulation step

Status: accepted

`GameLoop` runs the simulation in fixed `SIM_STEP` increments (60 Hz) with an accumulator, then renders once per animation frame without interpolation. Gameplay values are per step (px/step, frame counters), which keeps physics and chain behaviour deterministic across refresh rates and makes slow-mo/pause a `timeScale` change. Consequence: changing `SIM_HZ` changes game speed; render-only effects (shake, HUD) are per frame.
