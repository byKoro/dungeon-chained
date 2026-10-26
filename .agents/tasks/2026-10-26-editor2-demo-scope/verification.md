# Verification — Editor 2.0 escopo da demo

Base: commit do Codex `1ffde46` + correções do Kiro na mesma branch `novo_editor`.

## Automatizado
- `node tests/test_map_model.js` → 72 passaram, 0 falharam (inclui portas largas, conexões livres N→L, duas ligações entre as mesmas salas, mão única, destino único por porta, chegada segura, ids preservados ao redimensionar, validação de teste de sala vs mapa, ida e volta salvar/abrir).
- `npm test` → 9/10; só falha `test_modular_grid.js` (antigo, status.md #5).
- `node --check` em todos os arquivos JS tocados.

## Jogo aberto de verdade (Electron do projeto + servidor temporário 127.0.0.1:8010 com o serve.py desta branch)
Mapa montado por script no Editor 2.0: Hub 14×9, Grande 22×14, Pequena 9×7, 3 conexões (uma com requisito chave).
- Editor: visão do mapa desenha salas de tamanhos diferentes e as linhas de conexão (verde normal, amarela com requisito).
- "Testar mapa": jogo abre no Hub nos spawns marcados, portão do boss desenhado no norte. Sem erros no console.
- Porta leste do Hub → chega na sala Grande junto à porta oeste (p1 em x=96). Escala igual à da sala 14×9 (zoom ~1.1); a câmera acompanha a dupla em vez de enquadrar a sala inteira.
- Sala Grande com trava "derrotar inimigos": travada até matar o inimigo, depois libera.
- Volta pela porta oeste → Hub, chegando junto à porta leste.
- Portão do boss bloqueado sem a chave (`blocked: true`).
- Porta sul do Hub → sala Pequena 9×7, centralizada.
- "Testar sala" isolado (sala 18×11 com conteúdo): 1 inimigo, 2 tochas (parede + castiçal animados), prop estático por cima do piso + baú animado, espinhos, 2 botões co-op com trava "botões". Altar de Dash: P1 apertando E concede Dash para a dupla. Os dois em cima dos botões destravam a sala.
- Jogo normal sem `map/demo/active.json`: abre o modo clássico (procedural) como antes.
- Mecânicas (sala 20×11, teste com Dash e Lançar Serra liberados):
  - Alavanca: E perto dela troca só os 2 tiles marcados de buraco (-1) para chão (16); o resto do buraco continua.
  - Serra lançável: ao arrebentar o cabo a serra sai voando (`thrown`), anda até x≈1179 e para em chão seguro.
  - Corda + chave: a serra em voo corta a corda; a chave cai e é coletada por contato (`bossKey: true`).

## Não verificado
- Controles reais (teclado/controle físico): os testes moveram os jogadores e dispararam teclas por script.
- Comparação das 3 câmeras jogando (zoom-out / fixa + indicadores / tela dividida): o código existe (F6 alterna no teste), a escolha precisa ser feita jogando.
- Ricochete da serra nas paredes e dano nos inimigos pelo caminho (o teste não tinha inimigo na linha nem parede no alcance).
- Interface de clicar portas no modo "Conectar portas" com mouse real (as conexões do teste foram criadas por script).
- Build Electron empacotado (`npm run dist`) com mapa principal definido.
- Boss e tela de agradecimento: não existem ainda.
