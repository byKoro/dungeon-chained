# cable snap feel

Status: done   <!-- planned | in-progress | done | abandoned -->
Branch: feat/cage-visual-editor (working tree; unrelated WIP present)  Date: 2026-10-31

## Goal
Descartar o efeito atual de "cabo arrebentando" (chuvinha de pixels saindo das âncoras
dos jogadores) e substituir por algo com mais game-feel: o cabo **afina** conforme a
tensão sobe rumo à ruptura, e no instante em que separa há um **estalo** — as duas
metades do cabo chicoteiam de volta para cada jogador (overshoot + acomodação) somado a
um flash no ponto de ruptura e um breve hit-stop. Sem mudar a física do Chain.

## Context read
- game-feel skill (hit-stop, trauma shake, easing/overshoot, feedback em camadas, "voltar ao repouso")
- .agents/context/systems/players-and-chain.md (Chain.update snap, ChainTensionFeedback, SawWeapon)
- js/core/Chain.js (snap em onSnap), js/weapons/SawWeapon.js (drawChain linkH, visualCablePoint)
- js/systems/ChainTensionFeedback.js (state.risk/effort, snapTime, draw snap branch)
- js/config/ChainTensionConfig.js, js/Game.js (onSnap handler, triggerHitSlowmo)
- js/particles/ParticleSystem.js (flash/spark/shockring)
- tests/test_chain_tension.js (harness)

## Steps
- [ ] 1. Config: afinamento do cabo + parâmetros do chicote/estalo em ChainTensionConfig.
      Files: js/config/ChainTensionConfig.js
      Verify: npm test -- chain_tension
- [ ] 2. Afinar o cabo em SawWeapon.drawChain conforme risk (tensionFeedback), com piso mínimo.
      Files: js/weapons/SawWeapon.js
      Verify: cabo fica mais fino perto da ruptura; teste de thickness
- [ ] 3. Guardar ponto/direção da ruptura em onSnap e trocar o desenho do snap por chicote recuado.
      Files: js/systems/ChainTensionFeedback.js
      Verify: npm test -- chain_tension (novo caso do snap)
- [ ] 4. Camada de impacto no Game.onSnap: hit-stop curto + flash do ponto de ruptura.
      Files: js/Game.js
      Verify: npm test; abrir o jogo se possível

## Docs to update when done
- [ ] .agents/context/systems/players-and-chain.md (Feedback de tensão / estalo)
- [ ] .agents/context/status.md
