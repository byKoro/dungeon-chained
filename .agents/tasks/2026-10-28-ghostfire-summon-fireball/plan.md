# Ghostfire: bola de fogo com cinco inimigos

Status: in-progress. Branch: boss. Base: 9d5a04a.

Pedido: trocar spawns espalhados por uma bola de fogo que revela cinco inimigos juntos. Referência visual: chamas na boca e invocações de BossWallShot; a nova onda simultânea segue o pedido do usuário.

Contexto: architecture, conventions, combat-and-entities, visual-effects, rendering, ADRs 0001–0003; skills dungeon-chained-router, game-feel (+ PROJECT-NOTES), code-review; playbook add-particle-effect.

1. Emitir um evento no frame de cuspida e lançar projétil com voo em arco e rastro.
2. Escolher deterministicamente uma formação compacta à frente do boss, com cinco posições livres de paredes/buracos. Criar todos no impacto. Reservar capacidade para ondas completas.
3. Reutilizar partículas, som e luz; cancelar projéteis ao morrer/trocar sala.
4. Testar sincronização, segurança, limite, lados, cancelamento e renderização; atualizar docs e rodar check.
