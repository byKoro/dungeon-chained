# Verificação: Arauto das Brasas

## Executado
- `npm test`: 21 de 22 arquivos passam. Falha só `test_modular_grid` (pré-existente, `status.md` #4).
- `npm run check`: tests, map, docs drift e graph rodaram. Falhas: `test_modular_grid` e `corridor_vertical_ns_1.json` fora de `map/index.json`, as duas pré-existentes (#4 e #5). Grafo atualizado (2483 nós).
- `tests/test_arauto_das_brasas.js` cobre: dano sem stagger/empurrão/hit stop, outros inimigos inalterados, 100 HP e transição única em 50, golpe de área só na fase 1, três slams na fase 2 (marca fixa, alternância, aterrissagem na marca, dano só no impacto e uma vez por jogador, recuperação final), dano no ar sem interromper, morte cancelando a sequência, piso seguro, morte lenta sem gibs com escombros, dados da barra, layout da barra e vida infinita (ON/OFF).

## Não verificado
- Nada foi visto no jogo real: tamanho do chefe na arena 6×6, espaço de desvio, aparência dos três slams, empurrão causando queda, barra em diferentes resoluções, pausa, botão/F7 de vida infinita e o fluxo editor → teste. O usuário vai testar.
- `ContentTools.playtest` → `sessionStorage` → `Game` não tem teste automatizado (precisa de DOM).
- O alvo dos slams e os números de balanceamento são provisórios.
