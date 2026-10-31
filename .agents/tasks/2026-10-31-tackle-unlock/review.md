# Review — tackle unlock

Verdict: approved   <!-- approved | changes-requested -->
Range: d499dd6..HEAD

## Findings
- info · js/systems/SawTackle.js:_tryTackle · `canTackle` só barra o início do tackle; um voo em andamento não é cortado se a receita sumir no meio. Hoje a receita só some na morte da sala, que já chama `sawTackle.reset()`, e no F1. Aceito.
- info · js/Game.js:newDungeon · `test.progress.tackle` também entra em `demoProgress.state` (via `reset(progress)`), sem efeito: nenhuma porta usa `requires: "tackle"`.
- info · js/systems/DebugMenu.js:_openAnvil · bigorna de outra sala abre com o ponto entre a dupla; comprar a Serra por ali roda a cinemática em volta desse ponto (caixa padrão de `SawForgeCinematic`), sem bigorna desenhada. Só debug.
- low · glossário · "Investida" já era tradução de Dash e da investida marcada do golem. O nome foi aprovado pelo usuário (Q4) antes de ver isso; anotado no glossário e levado ao usuário.
- info · js/ui/ForgeMenu.js · com custo 0 o lado direito mostra `forge.free` sem moeda; travada (sem Serra) fica cinza como as outras.
