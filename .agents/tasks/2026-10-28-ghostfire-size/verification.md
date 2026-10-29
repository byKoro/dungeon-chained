# Verification — Boss no tamanho do trailer

## Automated
- npm.cmd run check: 12/12 arquivos de testes passaram, incluindo test_ghostfire.js.
- Validação de mapas: falha preexistente #4, corridor_vertical_ns_1.json ausente em map/index.json.
- Docs drift: OK.
- git diff --check: passou.
- npm.cmd run graph: graphify indisponível, conforme já registrado no projeto.
- Usado npm.cmd porque a política do PowerShell bloqueia npm.ps1.

## Manual (python serve.py → http://localhost:8000)
- Não executada; nenhuma ferramenta de navegador disponível nesta sessão.

## Not verified
- Aparência do boss, enquadramento e clipping da sala em execução. A escala de mundo agora corresponde ao trailer; a câmera do jogo permanece a existente.
