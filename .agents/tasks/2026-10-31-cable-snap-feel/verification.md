# Verification — cable snap feel

## O que foi feito
- Descartado o efeito antigo de ruptura (quatro pixelzinhos saindo das âncoras dos jogadores,
  antigo ramo `snap !== null` de `ChainTensionFeedback.draw`).
- Cabo afina conforme o risco de ruptura (`SawWeapon._cableThickness`, aplicado em `drawChain`
  — `drawH = linkH * thin` no sprite, `lineWidth` no fallback). Só a espessura desenhada muda;
  o passo da textura e a física do Chain ficam intocados.
- Estalo novo: `_drawSnap` desenha as duas metades do cabo chicoteando de volta pra cada
  jogador (overshoot `easeOutBack`, desvio lateral `kink` que some, halo+núcleo aditivos que
  afinam até sumir) + clarão aditivo no ponto de ruptura.
- Camada de impacto no `Game.onSnap`: hit-stop curto (`gameLoop.triggerHitStop`), além do
  tremor/duck/faíscas/`_snapWave` já existentes.
- Config em `js/config/ChainTensionConfig.js` (`hitStopSeconds`, `cableThin`, `snap`;
  `snapSeconds` 0.24→0.30).

## Comandos rodados
- `npm test -- chain_tension` → PASS (inclui 2 casos novos: afinamento com piso mínimo;
  `onSnap` guarda o ponto e alterna o lado do chicote).
- `npm test` (completo) → 56/58. As duas falhas são pré-existentes e NÃO foram causadas aqui:
  - `test_modular_grid.js` = bug conhecido #5 (Curva SE).
  - `test_arauto_effects.js` = `FLAME_GOLEM.telegraph.showMarks === true` (debug ligado no WIP
    da branch `feat/cage-visual-editor`); arquivo de config não tocado por esta task. A própria
    `status.md` da branch já chama esse teste de "flaky". Confirmado por `git status` que os
    arquivos que mexi são só `js/Game.js`, `js/config/ChainTensionConfig.js`,
    `js/systems/ChainTensionFeedback.js`, `js/weapons/SawWeapon.js`, `tests/test_chain_tension.js`.
- `node --check js/Game.js` → ok (não há teste que importe o Game.js).
- `npm run validate:map` → só o erro pré-existente #4 (`corridor_vertical_ns_1.json`).

## O que NÃO foi verificado
- **Não abri o jogo.** Não há browser headless/Puppeteer nesta máquina (ADR 0001, sem deps npm)
  e nenhum script de captura no repo. Então o afinamento do cabo, o chicote e o clarão do estalo
  não foram observados rodando; os números em `cableThin`/`snap`/`hitStopSeconds` são um ponto de
  partida a afinar no playtest. Com a iluminação da sala o afinamento pode ficar sutil demais ou o
  clarão forte demais — avaliar em jogo.
- Não testado o caso de cabo curto do arrasto (`SawDrag`), que usa o próprio `justSnapped` e não
  passa pelo `Chain.onSnap`; o chicote novo só dispara na ruptura normal do tether.

## Revisão (2026-10-31) — tirar vermelho/glow/cara de raiva, piscar+afinar
Pedido do usuário: o feedback de tensão estava com efeito vermelho trêmulo horrível; tirar
isso por completo e não usar efeitos sobre o canvas; manter o tremor; fazer a corda piscar e
afinar; tirar a cara de raiva.
- Removidos: `_drawGlow` (brilho vermelho), `_drawEffortPulse` (anéis nas âncoras),
  `tensionGlowTargets`, e o seteo de `tensionExpression` (sempre `null` agora → sem cara de
  raiva/fúria, inclusive no retrato do VtuberHud). Config: removidos `glow`, `expressions`,
  `criticalEnter/Exit` e chaves de `motion` que só serviam ao glow/pulse.
- Adicionado: `SawWeapon._cableAlpha()` (piscar: opacidade oscila, Hz e profundidade crescem
  com o risco, via `blinkPhase` montado em `update`), aplicado no sprite e no fallback.
  Config `cableBlink`. `ChainTensionFeedback.draw` agora só desenha o estalo.
- Mantidos: afinamento (`_cableThickness`), vibração da corda (`visualCablePoint`), estalo
  (chicote+clarão) e as camadas de impacto (hit-stop, shake, faíscas, `_snapWave`).
- Testes: `tests/test_chain_tension.js` reescrito (removido teste de glow e de histerese de
  expressão; novo teste garante que a tensão nunca seta expressão). `npm test` 56/58 — as duas
  falhas são pré-existentes (`test_modular_grid` #5 e o flaky `test_arauto_effects` do WIP da
  branch), nenhuma causada aqui.
- **Continua sem observação no jogo rodando** (sem headless). `cableBlink`/`cableThin` a afinar
  no playtest: avaliar se o piscar fica claro sem ser epilético e se o afinar aparece com a luz.
