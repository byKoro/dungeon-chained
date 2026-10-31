# penhasco forge

Status: done   <!-- planned | in-progress | done | abandoned -->
Branch: feat/penhasco-forge (worktree `../dungeon-chained-penhasco`)  Base: 3d95483  Date: 2026-10-31

## Goal
A bigorna da Penhasco passa a vender só o catálogo próprio: Investida (grátis), Tamanho II, Mais cortes, Ricochete,
Brasa, Investida longa e Reconexão explosiva. A bigorna da botas ganha Segunda chance.

Decisões (entrevista grill-me, 2026-10-31):
- Pré-requisito com nível mínimo (`item` + `itemLevel`) e aviso de travado por receita ("Precisa da Investida.", "Precisa de Tamanho 3.").
- Tamanho II (`size2`): 2 níveis, +12% cada, 70/100, exige Tamanho 3. Serra máxima 1,60×.
- Mais cortes (`tackleHits`): 5 → 7 → 10 acertos presa, 25/45, exige Investida.
- Ricochete (`ricochet`): 1/2 pulos para o inimigo válido mais perto (≤ 300 px, sem parede, não atingido no lançamento), 40/70, exige Investida. Arauto não dispara ricochete.
- Brasa (`embers`): brasas no chão por 1,5 s atrás da serra em voo do tackle; 1 dano por inimigo por lançamento; não fere jogadores; Arauto imune. 50, exige Investida.
- Investida longa (`tackleLong`): velocidade 15 → 17 → 19, volta começa em 40 → 55 → 70 passos. 20/35, exige Investida.
- Reconexão explosiva (`reconnectBlast`): onda de 1,6/2,4 tiles, 1 dano (como o Estalo), recarga 3 s, não na 1ª conexão da cinemática. 30/50, exige Serra.
- Segunda chance (`lastStand`, botas): 60. Uma vez por sala por jogador: golpe ou queda que zeraria fica com 1 coração, 1,5 s invulnerável, clarão + som. Recarrega ao entrar em sala nova e no respawn da sala.
- Penhasco: tackle, size2, tackleHits, ricochet, embers, tackleLong, reconnectBlast (sem o catálogo base). Botas: + lastStand no fim.
- Sem arte nova: reaproveita chamas/faíscas, anel do Estalo, clarão de dano e som de coração. Valores provisórios.

## Steps
- [x] 1. ForgeConfig/ForgeState: receitas, `itemLevel`, `sawTackleTuning`, sizeScale com size2; ForgeMenu aviso por receita; i18n; mapa
- [x] 2. SawTackle: tuning por lançamento (hits, speed, returnStartSteps) + ricochete
- [x] 3. SawEmbers (subsistema novo) + Game
- [x] 4. ReconnectBlast (subsistema novo) + Game (onda compartilhada com o Estalo)
- [x] 5. LastStand (subsistema novo) + Game (dano e queda)
- [x] 6. Testes, docs, check, commits por grupo

## Docs to update when done
- [x] .agents/context/systems/weapons.md, players-and-chain.md (Segunda chance), ui.md (aviso)
- [x] .agents/context/status.md, glossary.md
