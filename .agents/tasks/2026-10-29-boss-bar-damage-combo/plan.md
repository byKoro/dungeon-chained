# boss bar damage combo

Status: done
Branch: feat/boss-bar-damage-combo  Base: 145b221  Date: 2026-10-29

## Goal
Barra de vida do Arauto sem as chamas e desenhada como o botão RESUME (com pingos de lava). Total de dano acumulado por inimigo, flutuando acima dos números individuais, que continuam iguais.

## Decisões (grill com o usuário)
- Remover as chamas do nome e o emblema; a vida ocupa a largura toda. Nome continua acima, cores atuais.
- Copiar do RESUME: moldura de pedra, face (brilho, sombra, reflexo, lábio). Pingos de sangue → pingos de lava parados com a ponta pulsando, cores do Arauto.
- Face: vermelho do RESUME na fase 1, lava do Arauto na fase 2. Mantidos rastro, marcas de 10%, marcador de 50% e pulso da fase 2.
- Combo para qualquer inimigo da serra presa, separado por inimigo; janela de 0,8 s desde o último golpe (config).
- Total a partir do 2º golpe, somando todos; acima da cabeça, acompanha, por cima e 1,5× maior, pulo a cada golpe, ~0,5 s depois do fim e some.
- Cor pelo total: 2 branco, 3–4 amarelo claro, 5–6 amarelo, 7–9 amarelo escuro, 10–13 vermelho claro, 14–19 vermelho, 20+ vermelho escuro.
- Morte no meio do combo: fica onde morreu, valor final na cor da escala, some depois de ~0,5 s.
- Serra arremessada fora (vai ter rework).

## Context read
- `.agents/context/systems/ui.md`, `visual-effects.md`, `combat-and-entities.md`, `status.md`
- `js/ui/BossHealthBar.js`, `js/ui/PixelButton.js`, `js/particles/DamageNumber.js`, `js/particles/ParticleSystem.js`, `js/combat/CombatSystem.js`, `js/config/*`

## Steps
- [x] 1. Barra: `BossBarConfig.js` (face, drips, dripRoom) e `BossHealthBar.js` (drawStoneFrame + face + pingos, sem chamas). Verify: `tests/test_arauto_das_brasas.js`, captura.
- [x] 2. Combo: `DAMAGE_COMBO` em `CombatFeelConfig.js`, `js/particles/DamageCombo.js`, `ParticleSystem.triggerDamageCombo/clearDamageNumbers`, chamada em `CombatSystem._hitFeedback`, `Game` limpa na troca de sala. Verify: `tests/test_damage_combo.js`, captura.

## Docs to update when done
- [x] `.agents/context/systems/ui.md`, `visual-effects.md`
- [x] `.agents/context/status.md` (#24)
- ADR: não (sem decisão estrutural)
