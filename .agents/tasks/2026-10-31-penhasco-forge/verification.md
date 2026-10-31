# Verification — penhasco forge

## Automated
- [x] `node tests/test_penhasco_forge.js`: catálogo da Penhasco/botas, Tamanho II travado até Tamanho 3, quatro melhorias
      travadas até a Investida, Reconexão só com a Serra, avisos de travado, 70 + 100 moedas, serra 1,60×, parâmetros por
      nível; SawTackle real com 7 acertos (Mais cortes), voo a 17 px/step (Investida longa), ricochete atingindo um segundo
      inimigo fora da linha (e não atingindo sem a melhoria), Arauto sem ricochete; SawEmbers (brasas a cada ~24 px,
      1 dano por lançamento, Arauto imune, apagam em 1,5 s); ReconnectBlast (sem melhoria, 1ª conexão, recarga);
      LastStand (salva uma vez por sala e por jogador, reset, vida infinita).
- [x] `npm test`: 62/64. Falham só `test_arauto_effects` (intermitente, já listado) e `test_modular_grid` (Curva SE, #5).
- [x] `validate-map`: só o erro antigo #4 (`corridor_vertical_ns_1.json`).
- [x] Captura do `ForgeMenu` no Chrome headless (harness em `_local`, apagado): Penhasco com Tamanho 2 (linhas travadas em
      cinza, "Precisa de Tamanho 3."), Penhasco com Investida/Ricochete 1 (MAX verde, ponto de nível, descrição) e botas
      com Segunda chance. "Reconexão explosiva" empurra os pontos de nível sem encostar no preço.

## Not verified
- Nada foi jogado: brasas e chamas na tela, ricochete com a mira real, onda da reconexão, Segunda chance em golpe e queda.
- Equilíbrio de preços e da força das melhorias (valores provisórios).
- Se a carga da Segunda chance deveria proteger a dupla (hoje cada jogador tem a sua; a morte de um reinicia a sala).
