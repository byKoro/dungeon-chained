# Transparent Tileset decorations
Goal: preserve the floor when painting transparent decorative tiles in Editor 2.0 automatic mode.
Docs read: architecture, conventions, room-editor, rendering, status, glossary, ADR 0004; router and diagnosing-bugs skills.
Steps: reproduce _applyTool floor replacement; detect source alpha in TilePalette; reuse static index props in MapEditorApp; test persistence and repaint; review and run check.
Verification: node tests/test_editor2_transparent_tiles.js; npm run check; npm run graph.
