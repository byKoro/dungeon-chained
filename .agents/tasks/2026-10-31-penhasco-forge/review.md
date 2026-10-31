# Review — penhasco forge

Verdict: approved   <!-- approved | changes-requested -->
Range: 3d95483..HEAD

## Findings
- info · js/systems/SawTackle.js · `this.cfg` passou a ser o ajuste do lançamento atual; `reset()` volta para `baseCfg`. Quem lê `sawTackle.cfg` de fora (testes, feedback) vê o ajuste em vigor. Lançamento do Arauto usa `baseCfg` de propósito.
- info · js/systems/SawTackle.js:_ricochet · pausa o volante por `ceil(d/speed)+6` steps; se o alvo andar muito nesse tempo a serra pode errar e então volta normalmente. Aceito.
- low · js/systems/SawEmbers.js · brasas continuam queimando enquanto existirem só se a melhoria segue comprada (rollback na morte para tudo). Aceito.
- info · js/Game.js:_onSawReconnect · a onda sai na posição da serra já conectada; a recarga reseta junto com o tackle (porta/TP/morte), então trocar de sala libera uma onda nova.
- info · LastStand · `check` ignora quem está caindo; a queda é tratada em `_resolveFall` antes do `return` de morte.
