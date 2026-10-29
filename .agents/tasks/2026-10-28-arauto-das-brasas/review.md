# Revisão: Arauto das Brasas

Revisão feita pelo autor, sem revisor externo.

- `Player.loseLife` é o único ponto que desconta vida (acerto e queda). Nenhum outro `lives--` ou `lives -=` restou em `js/` (heart pickup só soma).
- `airborne` fica fora de colisão entre entidades, caixas de parede e `ensureOnWalkableTile` (senão o salto sobre abismo seria desfeito).
- Valores provisórios de balanceamento: `hitCooldownSteps: 10`, `slam.*`, `secondPhaseHp: 50`. Com `ENEMY_HIT.cooldownSteps = 0` (escolha do usuário) o chefe de 100 HP morreria em ~2 s de contato contínuo sem o cooldown próprio.
- Com vida infinita o HUD não anima a perda de coração (a vida não muda); o flash de tela e o som de dano seguem por `damageTaken`.
- Risco: `VtuberHud.freeSpan` estima a largura dos corações; em resoluções incomuns a barra pode encostar no HUD (a janela estreita sobe a barra).
