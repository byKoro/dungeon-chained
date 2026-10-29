# Verification — Game-feel dos acertos da serra

## Automated
- `node tests/test_combat_feel.js` → 79 passaram, 0 falharam (MeleeEnemy, CombatSystem, GameLoop, DamageNumber/ParticleSystem).
- `npm run check` → 10/11 arquivos de teste; só falha `test_modular_grid.js` (antigo, status.md #5). `validate:map` só aponta `corridor_vertical_ns_1.json` (antigo, #4). O aviso de docs drift foi tratado atualizando os docs.

## No jogo (Electron do projeto + servidor local temporário, jogo clássico `?skipTrailer`, cliques/teclas e posições por script)
Jogadores fixados com a corrente conectada; inimigos criados com `spawnSystem.createEnemy` em cima da serra. Sem erros no console em nenhum cenário.
- Inimigo comum (demônio): 1 golpe → tier `kill`, dano 1, inimigo removido, slow-mo de abate depois do hit stop, número de dano 1. Hit stop medido de 73 ms para o pedido de 0,07 s.
- Tanque (hp 4, poise 3), golpes repetidos com a serra encostada: golpe 1 e 2 → `hurt` (hp 3 e 2, poise 2 e 1, flash); golpe 3 → `stunned` (poise rompida, hp 1, `vulnerableTimer` 72, hit stop 0,09 s); golpe 4 durante a janela → dano 2, mata. Inimigo nunca saiu dos limites da sala.
- Pause durante hit stop: o hit stop é cancelado, o jogo continua pausado depois de 400 ms, a simulação não avança pausada e retoma ao despausar.
- Quatro inimigos comuns em sequência na corrente: 4 golpes, 4 abates, congelamentos curtos (≈8 frames a ~120 Hz de render do ambiente = ~0,07 s), sem travar.
- Capturas do canvas (flash branco/vermelho, faíscas, sangue, números "1" subindo, ruptura de poise com número amarelo, abate com números vermelhos) conferidas visualmente.
- Repetição do abate: 1 golpe → 1 número (a primeira medição mostrou 2 números e 0 frames de hit stop logo após o carregamento; não se repetiu em duas execuções seguintes, ver "Não verificado").

## Não verificado
- Jogando com teclado/controle reais; sensação de peso (valores em `CombatFeelConfig.js` precisam de ajuste jogando).
- A primeira execução do cenário A mostrou 0 frames de hit stop e 2 números de dano para 1 golpe; duas repetições do mesmo cenário deram o resultado correto (73 ms; 1 golpe → 1 número). Provável efeito do primeiro frame longo logo após o carregamento, não confirmado.
- `ThrownSaw` e `FireSkullEnemy` (fora do escopo) e as cenas do trailer não foram abertos; o `CombatSystem` dos trailers segue o caminho antigo (`hitFeedback` desligado) coberto só por teste de unidade.
- Sem assets de som de ferimento/ruptura de poise: ver status.md #13.
