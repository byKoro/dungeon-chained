# Local co-op only (online removed)

Status: accepted (9b13c52)

An online mode was explored and removed during the repo cleanup. The game is local 2-player co-op only (keyboard + up to two gamepads). Do not add networking code without a new ADR; input stays mapped to key names so a remote/AI driver can inject keys (as `PlayerAI` does).
