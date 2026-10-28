# Verificação

## Automatizada
- `node tests/test_editor2_content_catalog.js`: passou (chaves existem, rótulos/ordem, `thumbRegion` do blackKnightB = 41,136,19,22 e do demon = 28,134,52,26).
- `node scripts/run-tests.mjs` e `node scripts/check.mjs`: 12/13 arquivos; só falha `test_modular_grid.js` (antigo, status.md #5). `npm` direto não roda no PowerShell desta máquina (execução de scripts desabilitada), então os scripts foram chamados com `node`.

## No navegador (Chrome headless, servidor `python -m http.server` só em 127.0.0.1, página temporária removida depois)
Controlado por script via `window.mapEditor`, sem erros no console.
- Lista de inimigos com exatamente 3 itens e rótulos corretos; tochas (3) e interativos (5) como listas. Selects e botões antigos (`#content-enemy`, `#content-torch`, `#content-interactive`, "Colocar inimigo/tocha/interativo") não existem mais.
- As 11 miniaturas são pintadas (incluindo logo após o carregamento, sem esperar todos os assets).
- Destaque (`.active` + `aria-pressed`) e linha "Ferramenta ativa" corretos para: Tile (inicial), Inimigo, Spawn P1, Armadilha, Tocha, Interativo, Remover conteúdo, Porta (tipo de porta marcado) e Prop. O prop só fica destacado com a ferramenta Prop (antes ficava sempre).
- Colocar `blackKnightB` com a lista funciona e Ctrl+Z (`_undo`) desfaz.
- Sala com `assassin` e `fireSkull` (fora da lista): desenha sem erros e "Remover conteúdo" apaga.
- Screenshot conferido: item selecionado com borda roxa, brilho e ✓ (o primeiro estilo estava sutil demais e foi reforçado).

## Não verificado
- Clique real do mouse na sala (o `apply()` foi chamado por script), persistência/salvar no servidor e playtest depois da mudança.
- Electron/janela empacotada.
