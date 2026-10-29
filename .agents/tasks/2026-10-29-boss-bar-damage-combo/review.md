# Review

- Escopo: só barra do chefe e números de dano; nenhum outro sistema muda de comportamento. `map/demo/demo_campaign.json` estava modificado antes desta tarefa e não faz parte dela.
- `BossHealthBar` reaproveita `drawStoneFrame`, `FACE_H` e `LIP` do `PixelButton` em vez de copiar o desenho; a altura da barra fica amarrada a 19 por teste.
- `DamageCombo` usa passos de simulação como os outros números, então o combo para junto com o hit stop.
- O combo procura por identidade do inimigo; um inimigo removido sem o golpe de morte (queda em buraco) fecha sozinho quando a janela vence.
- Risco baixo: `palette()` agora devolve um objeto de face em vez de um array; o único outro uso era o teste, que só compara as fases.
