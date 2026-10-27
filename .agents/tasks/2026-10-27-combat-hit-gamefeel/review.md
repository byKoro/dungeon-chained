# Review — Game-feel dos acertos da serra

Verdict: approved (autorrevisão; sem revisor externo)
Range: 1e609a5..HEAD (alterações ainda não commitadas)

## Findings
- low · `CombatSystem.resolveWeaponHits` · O callback `onKill` (6º parâmetro) agora só roda quando o golpe mata; antes rodava em todo golpe aceito. Para inimigos hp 1 (trailers, jogo clássico) é idêntico; `Game` passou a usar `onHit` para hit stop e `sawMotor.onHit()`. Feito de propósito (handoff: slow-mo só em abates).
- low · `MeleeEnemy._applyPush` · O empurrão agora não entra em tile não andável (buraco/borda). Vale também para os impulsos de colisão entre entidades, que antes eram desfeitos por `ensureOnWalkableTile`.
- low · `FireSkullEnemy` / `ThrownSaw` · Não ganham stagger/flash/poise (ver status.md #21).
- info · Valores de feel são palpites iniciais; ajustar em `js/config/CombatFeelConfig.js`.
