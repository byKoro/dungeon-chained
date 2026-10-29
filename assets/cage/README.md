# assets/cage

Gaiola do Salão e corda (encontro da sala `inicial`). Pixel art feita à mão em código por `scripts/gen-cage-sprites.py` (sem geração por IA, sem asset de terceiros), na paleta do tileset, dos baús e da bigorna (contorno `#25131a`). Para mudar: edite o script e rode `python scripts/gen-cage-sprites.py --preview` (prévia em `_local/cage-preview.png`). Não edite os PNGs à mão: o script sobrescreve.

| Arquivo | Tamanho (px de arte) | Uso |
|---|---|---|
| `cage_hang.png` | 24×32 | gaiola pendurada (gancho no topo, cinta de madeira, aro de ferro) |
| `cage_open.png` | 24×32 | igual, com o alçapão aberto (aparece a cada corte) |
| `cage_broken.png` | 32×16 | destroços no chão |
| `rope_stake.png` | 10×16 | estaca com a corda amarrada |
| `rope.png` | 8×4 | textura da corda, repetida ao longo da curva |
| `rope_end.png` | 6×6 | ponta desfiada da corda cortada |

No jogo, 1 px de arte = 4 px de mundo (`CAGE.art`); a corda é desenhada com 12 px de espessura (`CAGE.sprite.ropeThick`).
