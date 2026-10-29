# Verification — ataque do Ghostfire

- npm.cmd run check: 12/12 arquivos de testes passaram, incluindo test_ghostfire.js.
- Gate geral falha somente no problema preexistente #4: corridor_vertical_ns_1.json ausente em map/index.json.
- Docs drift e git diff --check: OK.
- npm.cmd run graph: graphify indisponível, conforme registrado no projeto; diagnóstico via npm run doctor.
- Não testado visualmente no jogo. Alteração limitada aos tempos de espera, carga, aviso e recuperação.
