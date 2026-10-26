# Verification — Editor 2.0 (mapa da demo)

## Automated
- [x] `node tests/test_map_model.js` → 52 passaram, 0 falharam.
- [x] `npm test` → 5/6; só falha `test_modular_grid.js` (falha antiga, status.md #5).
- [x] `npm run validate:map` → 1 erro antigo (`corridor_vertical_ns_1.json`, status.md #4); `map/demo/` não interfere.
- [x] `node --check` em todos os arquivos novos de `js/`.
- [x] `_pretty` do `serve.py` gera o mesmo texto que `formatMapJson` para o caso do teste.

## Manual (Electron do projeto abrindo o editor num servidor temporário com o `serve.py` novo, porta 8010)
- [x] Visão do mapa: grid 5×4 vazio; duplo clique cria e abre a sala.
- [x] Sala: portas (normal e boss), buraco arrastando, vazio, tile 52 pela paleta (vira parede no automático), colisão, props (baú e lança-chamas 2×1), conta-gotas com botão direito, desfazer/refazer.
- [x] Redimensionar sala para 20×12: miolo preservado, moldura refeita, portas na borda nova.
- [x] Grid para 6×4, ligações (ok / sem volta), validação, ordem #1/#2.
- [x] Salvar no servidor, listar, reabrir (igual ao original), nome inválido → 400.
- [x] Recarregar a página restaura o mapa (autosave).
- [x] Testar sala 14×9: o jogo abriu com buracos, vazio, parede interna e portas N/E; console sem erros (só o aviso de CSP do Electron).

## Not verified
- Uso com mouse real (só eventos sintéticos), arraste de sala no grid e importação de arquivo pelo seletor do sistema.
- O `serve.py` que já estava rodando na porta 8000 é a versão antiga: precisa reiniciar para ter `/api/save-map` e `/api/list-maps`.
