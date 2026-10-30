# Review against HEAD
Spec source: user request in this chat.
Standards: parallel review found no actionable code issues.
Spec: identified eyedrop treating static decorations as animated props. Fixed by selecting prop.index in automatic paint mode; regression coverage added and passed.
Known limitation: previously painted floor tiles require floor restoration and repaint. Visual runtime verification pending.
Final check: 43/44 suites pass; only the two documented prior failures. Graph generation attempted but graphify is unavailable.
