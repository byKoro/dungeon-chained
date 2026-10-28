# Cultista — pilar de fogo
Status: done
Branch: feat/cultist-fire-pillar (origin/main)

## Goal
Cultista à distância com preferredDistance ajustável, marca fixa no jogador vivo mais próximo, aviso antes do pilar da quarta linha e morte da última linha.

## Context
AGENTS, arquitetura/convenções, combat-and-entities, add-enemy, router, game-ai, game-feel e ADR de config. Reutilizar MeleeEnemy para spawn, navegação, stagger e morte; subclasse para recuo e pilar. Sem dependências novas.

## Steps
1. Config e subclasse, SpawnSystem e dois editores.
2. Testes de distância, alvo fixo, esquiva, dano e morte.
3. Verificar sprites no navegador, check, review e docs.
