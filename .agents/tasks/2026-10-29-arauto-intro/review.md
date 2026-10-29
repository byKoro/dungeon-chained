# Revisão
- Cena isolada do `Game` (dependências injetadas); números no config; tempos de remontagem e golpe derivados das linhas `death`/`attack2`, então mudar o fps do sprite ajusta a cena sozinho.
- `introPose` só muda desenho, luz e brasas; a lógica do golem não roda durante a cena porque o `Game` não chama `_updateGameplay`.
- Riscos: o cue `arautoAssemble` reusa `arauto-ground-0x` (rate 1.45, volume 0.32) e pode não soar como "encaixe"; possível salto visual entre o quadro 0 da morte e o quadro 0 do `attack2`; no modo clássico (sem mapa da demo) a câmera não segue o `focus`.
- Fase 2: as barras agora saem de `returnAt` até `duration` (0,65 s) em vez do `exitSeconds` do `CinematicBars`; ficam depois do HUD.
- `ArautoPhaseScene` passou a definir `p.expression` ('assustado'/'raiva'), o que agora aparece no boneco em campo.
