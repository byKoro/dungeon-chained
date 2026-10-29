# Verification — scrap chest

## Automated
- `npm test`: 23/24 arquivos. Só falha `test_modular_grid.js` (antigo, status.md #5). Novos: `test_i18n` (9), `test_scrap` (19), `test_solid_props` (12), `test_chest` (17), `test_dialogue` (11), todos passando.
- `npm run check`: falha só nos itens antigos #4 (`corridor_vertical_ns_1.json` fora do `map/index.json`) e #5. Docs atualizados para o aviso de drift.

## No jogo (Electron do projeto + `python serve.py`, scripts em `_local/verify-*.cjs`, não versionados)
Mapa: `map/demo/inicial.json` via sessionStorage do teste do Editor 2.0 (`index.html?playtest=true&editor2=true`, sala isolada). Jogadores e inimigos posicionados por script; teclas reais via `sendInputEvent`. Console sem erros (só o aviso de CSP do Electron).
- Baú 1: a 200 px não abre; a 110 px abre, toca `chestOpen`, solta 10 peças depois do atraso. Em ~2,5 s o pote foi de 0 a 6–7 (peças fora dos 2,5 tiles do ímã ficam no chão até alguém chegar perto). Captura: arco das moedas visível acima da escuridão, baú no quadro aberto.
- Contador no topo: "00" → "06" → "12"; captura conferida.
- Bigorna: segurando S vindo de cima, os pés param em 1694 (topo da base 1704) e o jogador aparece atrás da bigorna; segurando W vindo de baixo, os pés param em 1738 (base termina em 1728) e ele aparece na frente. Com o parceiro puxando o cabo de lado, o jogador desliza pela quina e passa (os pés nunca entram na base).
- Cavaleiro Negro B morto por script: removido e +5 de sucata.
- Balões: `dialogue.say(0, 'talk.start.1')` + `say(1, 'talk.anvilNear')`. Balão acima do Amarelo, texto letra a letra com acento (é), retrato do HUD muda de expressão. E completa, segundo E passa para a fala do Azul.
- `game.restart()`: pote 0, baús fechados, sem fala ativa.
- Modo clássico (`?classic=true&skipTrailer`): inicia, `scrap`/`dialogue`/`roomProps` são `null`, sem erros.
- Editor 2.0: sala nova, prop Baú mostra o campo "Sucata no baú" (10); trocar para 15 vale para o próximo baú (`_propExtra` → `{scrap: 15}`); Bandeira esconde o campo. Sem erros.

## Not verified
- Jogando com teclado/controle de verdade, dois jogadores; sensação do ímã, do arco e do squash (valores em `ScrapConfig.js` precisam de ajuste jogando).
- Som: os três cues novos (`scrapPickup`, `chestOpen`, `voiceBlip`) não foram ouvidos; só a chamada foi vista.
- Inimigos andando contra a bigorna/baús (navegação não conhece os props) e a ordem por pés entre inimigos e props, só por leitura.
- Fala em modo split (F6), build empacotado (`npm run dist`) e o trailer (`/` sem `?skipTrailer`) não foram abertos; o trailer usa `SpeechBubble.js` e `PixelFont.js` (só glifos novos).
- `map/demo/inicial.json` no commit `9ef00b1` traz, além do baú, uma versão diferente da sala (vazios viraram piso, faixa do topo uma linha abaixo, 19 props a menos). Essa diferença não foi uma edição intencional desta fatia e a origem não foi confirmada; aguarda o usuário dizer qual versão vale. Os testes no jogo acima usaram essa versão.
