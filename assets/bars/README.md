# assets/bars

Grade (portão levadiço) que desce nos acessos de uma zona durante um encontro. Pixel art feita à mão em código por `scripts/gen-bars-sprites.py` (sem geração por IA, sem asset de terceiros), na paleta da gaiola e da bigorna (contorno `#25131a`). Para mudar: edite o script e rode `python scripts/gen-bars-sprites.py --preview` (prévia em `_local/bars-preview.png`). Não edite os PNGs à mão: o script sobrescreve.

| Arquivo | Tamanho (px de arte) | Uso |
|---|---|---|
| `bars_mid.png` | 16×20 | tile do meio da grade (viga, barras, travessa, dentes) |
| `bars_left.png` | 16×20 | ponta esquerda, com o pilar que encosta na parede |
| `bars_right.png` | 16×20 | ponta direita |
| `bars_single.png` | 16×20 | grade de um tile só, com os dois pilares |

No jogo, 1 px de arte = 4 px de mundo; cada peça ocupa um tile de largura e `BARS.height` (1,25 tile) de altura, com a base no pé do tile. `RoomEvents` escolhe a peça pelos vizinhos na mesma linha.
