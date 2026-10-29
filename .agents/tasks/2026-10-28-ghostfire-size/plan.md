# Boss no tamanho do trailer

Status: done
Branch: boss  Base: c306bc2  Date: 2026-10-28

## Goal
Usar no jogo a escala 21× do Ghostfire do trailer, anteriormente 8×. Manter o raio proporcional ao sprite.

## Context read
- AGENTS.md; dungeon-chained-router; architecture; conventions; status.
- systems/combat-and-entities.md; systems/rendering.md; ADRs 0001–0003.
- GhostfireConfig, GhostfireBoss, GhostfireRenderer, BossWallShot, test_ghostfire.
- graphify indisponível; navegação pela documentação e busca de código.

## Steps
- [x] Centralizar escala 21 em GhostfireConfig e compartilhar com BossWallShot; largura do raio 63 e hitRadius proporcional de 115.5.
- [x] Revisar os arquivos alterados e executar npm.cmd run check.

## Docs to update when done
- [x] .agents/context/systems/rendering.md
- [x] .agents/context/status.md
- Nenhuma mudança estrutural; ADR desnecessário.
