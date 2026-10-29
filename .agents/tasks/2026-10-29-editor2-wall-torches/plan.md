# Editor2 wall torches
Status: implemented
Branch codex/editor2-wall-torches, base c92e13a.
Goal: allow wall torches on authored interior walls in Editor2.
Context: architecture/conventions (session), room-editor, status, TorchLayout, WallAutotile, ContentTools. Router skill applied.
Steps: reproduce with created-wall fixtures; resolve mount using wall sprite face and lateral floor; preserve border/door rules; verify focused/full tests and review.
Files: js/rooms/TorchLayout.js, tests/test_torch_layout.js. User demo_campaign map edits preserved.
No new terminology or structural ADR.

Follow-up user requirement: wall torches allowed beside holes. Exposed mounting area includes floor/hole, with same wall face orientation and corner/door rules.
