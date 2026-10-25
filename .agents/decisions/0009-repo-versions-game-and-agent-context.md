# What is versioned

Status: accepted (4f28125, 9b13c52, 9dacbc6)

Git holds the game, the room pieces, and shared AI context (`.agents/`, `AGENTS.md`, `.kiro/skills/`). Marketing/pitch video material (`/pitch/`), external docs (`/docs/`), local scratch (`/_local/`), tool configs (`/.claude/`, rest of `/.kiro/`) and regenerable output (`/graphify-out/`, `dist/`) stay out. Project documentation for humans and AIs therefore lives in `.agents/`, not `docs/`.
