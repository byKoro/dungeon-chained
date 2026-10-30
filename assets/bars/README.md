# assets/bars

Grade levadiça dos acessos de uma zona (desce durante um encontro). Pixel art feita à mão em código por `scripts/gen-bars-sprites.py` (sem geração por IA, sem asset de terceiros). Cada peça é um tile 16×16, a mesma altura da parede de frente: a verga copia as 6 linhas de cima do tile 2 do tileset (topo do bloco com a borda clara + faixa da frente), então continua a linha das paredes em 2,5D. A treliça usa o ferro da gaiola e da bigorna, com ferrugem. Para mudar: edite o script e rode `python scripts/gen-bars-sprites.py --preview` (prévia em `_local/bars-preview-3.png`, entre paredes de frente). Não edite os PNGs à mão: o script sobrescreve.

| Arquivo | Tamanho (px de arte) | Uso |
|---|---|---|
| `gate.png` | 16×10 | treliça de ferro (barras, travessa rebitada, dentes); repete lado a lado |
| `frame_mid.png` | 16×16 | verga (topo + frente) e a sombra dela no vão |
| `frame_left.png` | 16×16 | idem + ombreira de pedra com o trilho, encostada na parede da esquerda |
| `frame_right.png` | 16×16 | idem, à direita |
| `frame_single.png` | 16×16 | vão de um tile, com as duas ombreiras |

No jogo, 1 px de arte = 4 px de mundo e a peça ocupa exatamente o tile da grade. Ordem: fresta no chão, treliça recortada abaixo da verga, moldura. A moldura fica sempre; erguida, a treliça some atrás da verga e só a ponta dos dentes aparece. Geometria em `BARS.art` (`js/config/EventsConfig.js`); `RoomEvents` escolhe a moldura pelos vizinhos na mesma linha.
