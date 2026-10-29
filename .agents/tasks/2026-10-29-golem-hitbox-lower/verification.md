# Verification

- node tests/test_golem_solid_body.js: pass, including behind upper sprite/front lower body regression and arm contact.
- node tests/test_chain_obstacles.js: pass.
- npm.cmd run check: 23/24 suites; only old test_modular_grid and unlisted corridor_vertical_ns_1 map failures (#4/#5).
- Diagram PNG rendered with hidden Electron and visually inspected. Pixel art source unchanged. Config and actual collisionBodies used for new ellipses.
- Live gameplay not opened. No claim about observed co-op feel.
