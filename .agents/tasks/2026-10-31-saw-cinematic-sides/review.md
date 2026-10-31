# Review — saw cinematic sides

- `Player.autoMove` só é lido em `handleInput`; a cinemática limpa no fim e no `reset()`. Nenhum outro sistema escreve nele.
- A caminhada chama `p.update` com uma entrada vazia: timers do jogador (invulnerável, recarga do dash) andam durante a cinemática, como já andavam os da câmera. Aceito.
- Se alguém travar, `walkMax` (2,2 s) começa a forja assim mesmo e a conexão acontece onde eles estiverem; acima de `breakDistance` o cabo arrebentaria no primeiro passo. Não acontece nas bigornas atuais (há chão dos dois lados).
- Removidos `_sawOnAnvil`, `_sawAnvilSortY`, `_sawFirstConnect`, o caso "primeira conexão ao trocar de sala" e a fala `talk.sawReady` (pt-BR e en), porque a serra não fica mais esperando na bigorna.
- `drawAt` perdeu o parâmetro `glow` (só a cinemática usava).
