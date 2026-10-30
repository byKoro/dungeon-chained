# Stair connections
Goal: tile 39 behaves as a map connection like a door.
Docs: router, architecture/conventions and editor/rendering context from previous task, rooms-and-maps, MapConnections/AuthoredDungeon.
Steps: create stairs endpoint via palette/door tool; preserve floor; support connection validation, resizing and safe arrival; render sprite without border effects; regression tests and parallel code review.
Verification: node tests/test_stair_connections.js; npm run check; npm run graph.

Follow-up scope: allow border wall placement, inward arrivals, anchored resizing and preserve south-edge stair art during front-wall rendering.
