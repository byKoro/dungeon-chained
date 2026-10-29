# Lower golem collision

Status: done (script and diagram verification; live gameplay pending)

Goal: allow passing behind upper sprite, block lower body/feet, reduce arm blockers and show exact before/after image.

Read: existing architecture/conventions/players/combat/rendering docs and router/physics project notes. No structural changes. Existing feat/flame-golem working changes preserved.

Completed: FlameGolemConfig bodyCollision torso moved y -16 to +32, vertical radius42 to30, arms radius24 to16, y -28 to+24, lift38 to12, spread12 to8 and x50 to48. Shared collision shapes retain existing player/cable/saw resistance. Tests verify behind access and lower blocking.

Artifact: _local/golem-hitbox-comparison.png plus self-contained SVG, generated deterministically from sprite and actual collisionBodies. Four panels compare idle and raised attack2 pose, with unchanged sprite placement. Diagram visually inspected; not live gameplay.
