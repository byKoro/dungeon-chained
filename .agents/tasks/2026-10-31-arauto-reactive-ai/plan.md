# Arauto reativo — plano

Spec: `spec-arauto-comportamento.md` (documento de design aprovado pelo usuário, 30/10/2026). O usuário pediu "execute o md em uma branch nova": implementação completa do documento na branch `feat/arauto-reactive-ai`, a partir de `main` (`cd04ce3`).

## Docs lidos
`AGENTS.md`, `architecture.md`, `conventions.md`, `systems/combat-and-entities.md` (Flame Golem), `status.md`. Código: `FlameGolemEnemy.js`, `MeleeEnemy.js`, `FlameGolemConfig.js`, `Entity.js`, `Room.js` (navegação), `Game._step` (colisões, `ensureOnWalkableTile`). Testes: `test_flame_golem*.js`, `test_golem_solid_body.js`, `test_arauto_das_brasas.js`, `test_arauto_effects.js`.

## Desenho
- `MeleeEnemy` ganha dois ganchos sem mudar o comportamento dos outros inimigos: `_focusTarget(nearest)` (quem o inimigo encara/persegue) e `_readyToAttack(dist)` (o teste antigo de início de ataque).
- `FlameGolemEnemy` troca o ciclo por `_decide()`, chamado só no estado `chase` (depois da recuperação):
  - Fase 1: pressão pronta → pancada; jogador perto → melee; investida válida → investida; senão persegue.
  - Fase 2: perto → melee; investida válida → investida; salto com aterrissagem segura → salto; senão persegue.
- Validações separadas: `_wallBetween` (só paredes protegem; buraco não), `_planDash` (corpo não atravessa parede nem sai do mapa, pode passar por buraco, termina em piso seguro), `_safeLanding` (salto), BFS com o corpo para a perseguição.
- Investida e salto acompanham o alvo durante o aviso e ficam fixos na execução (sai `trackingStrength`).
- `FLAME_GOLEM.ai.chainMode`: `'single'` (padrão) ou `'sequence'`.

## Decisões técnicas para os pontos abertos do spec
1. Pressão pronta e os dois saem antes do aviso: a reação pendente é cancelada junto com o tempo (sem ninguém perto a pancada não faz sentido). Depois que o aviso começou, a pancada é mantida (compromisso).
2. Revezamento: conta "ao menos um perto"; não exige o mesmo jogador.
3. "Perto" (melee e pressão) = até 110 px e sem parede entre o centro do boss e o jogador. Um jogador perto mas atrás de parede não conta como perto.
4. Sequência: cada execução seguinte escolhe de novo o jogador mais próximo com trajeto/aterrissagem válidos, no próprio aviso. Sem nenhum válido, a sequência acaba e vai para a recuperação.
5. Durante o aviso, o plano de investida/aterrissagem é recalculado a cada tick e só substitui o anterior se for válido. A execução usa o último plano válido, então nunca viola segurança e o alvo pode desviar.
6. Investida válida: o corpo chega pelo menos até `distância ao alvo − hitRadius da investida` (limitado ao comprimento da investida) sem parede; termina no ponto seguro mais distante desse trecho. Sem isso, fase 1 contorna andando, fase 2 tenta o salto.
7. Impacto da aterrissagem do salto: oclusão por parede preservada como hoje (não há). Investida: contato varrido, agora com a mesma regra de parede (buraco não protege).
8. Modo de comparação: opção global em config.
9. Perseguição: alvo = jogador com o menor caminho para o corpo; sem caminho para o corpo, cai no BFS antigo de centro e, sem esse, anda reto (desliza nas bordas).
10. Pressão zera no impacto da pancada e na troca de fase.

## Passos
1. Config: `ai` (`chainMode`, `pressureSeconds`), `slam.triggerRange` 480, remover `trackingStrength`.
2. Ganchos no `MeleeEnemy`.
3. Decisão, pressão, investida planejada, salto rastreado, perseguição com corpo, modos.
4. Atualizar testes que dependiam do ciclo (`attackIndex`) para `forceAttack(key)`, e reescrever os que assumiam marcas fixas ou rastreio na execução.
5. Teste novo `tests/test_arauto_ai.js` com os critérios 1–13 do spec.
6. Docs: `combat-and-entities.md`, `status.md`.

## Verificação
`npm test`, `npm run check`. Critério 14 (sensação no jogo) exige playtest; não declarar sem ver.
