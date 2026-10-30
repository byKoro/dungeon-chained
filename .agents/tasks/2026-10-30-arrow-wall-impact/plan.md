# Arrow wall impact
Goal: stop arrowtrap projectiles on walls with a mild spark.
Docs: architecture/conventions and status from session; router/diagnosing-bugs, combat-and-entities, visual-effects, add-trap playbook, ADR 0003.
Steps: failing Arrow regression; swept first-wall collision utility; Room supplies full wall tiles plus perimeter; Challenge queues one-step impacts; Game emits configured light sparks; parallel review and check.
Verification: node tests/test_arrow_wall_impact.js; npm run check; npm run graph. Runtime visual verification pending.
