# Black Knight B tanque

Status: done

## Goal
Transformar blackKnightB em tanque lento (4 HP, velocidade 0.8), alternar os três ataques e exibir a morte completa antes dos gibs. Preservar os outros mobs.

## Context read
AGENTS.md, architecture.md, conventions.md, combat-and-entities.md, status.md, ADR 0003, add-enemy.md, dungeon-chained-router e game-ai. Consulta graphify sobre morte e ataques.

## Steps
1. Ajustar os dados do cavaleiro e habilitar ciclo de ataques e morte animada em MeleeEnemy.
2. Testar resistência pela API de combate, os três ataques e frames de morte.
3. Verificar no navegador, rodar check e atualizar a documentação.
