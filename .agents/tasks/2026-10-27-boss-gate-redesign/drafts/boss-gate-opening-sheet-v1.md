# Boss gate opening — v1

Generated 2026-10-26 using the built-in OpenAI image-generation tool, editing `boss-gate-closed-source-v1.png`.

Files: `boss-gate-opening-sheet-v1.png` and standalone `boss-gate-opening-preview.html` (keep together).

Four equal cells in a 2x2 grid, row-major order: closed, one-third open, two-thirds open, fully open. Preview holds closed for 650 ms, shows each intermediate frame for 200 ms, then holds open. Replay restarts the sequence.

Status: animation draft, not integrated into gameplay. Generated stonework has small variations between frames; a final pixel-art cleanup and native-scale verification are still required. Alpha exists outside the door; passage is dark opaque.

## Prompt

Edit the supplied boss gate into a precise FOUR FRAME animation sprite sheet, 2 columns by 2 rows of equal square cells, reading order top-left, top-right, bottom-left, bottom-right. Transparent background outside the door. Square output canvas. Each cell has EXACTLY the same size gate at EXACTLY the same centered coordinates and baseline, with equal small margins. Preserve the original plum stone arch, cracks, rust-orange bands, skull identity, pixel-art style and proportions across every cell. The STONE FRAME AND SIDE PILLARS NEVER MOVE OR CHANGE. Only the inner iron portcullis including its attached skull lock travels VERTICALLY UP into a recess behind the lintel, clipped to the doorway. Frame 1: closed exactly like reference. Frame 2: portcullis raised 1/3 of its travel, skull travels upward with it, bottom third of doorway clear. Frame 3: portcullis raised 2/3 of travel, skull nearly hidden behind top lintel, bottom two thirds clear. Frame 4: fully open, all bars AND skull retracted out of sight behind lintel, empty solid very dark purple passage. KEEP the flat stone threshold visible and fixed. No swinging doors. No scaling gate between frames. No extra locks or skulls on the fixed frame. No captions, numbers, letters, cell borders, divider lines, checkerboard, background scenery, floor or effects. Make each state visibly different and all geometry spatially registered so the cells can play as an opening animation. Entire gate must fit in every cell. True alpha outside each gate, dark opaque passage inside. This is one sprite sheet asset, not a presentation.
