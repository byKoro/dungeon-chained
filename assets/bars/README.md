# assets/bars

Grade levadiça dos acessos de uma zona (desce durante um encontro). Pixel art feita à mão em código por `scripts/gen-bars-sprites.py` (sem geração por IA, sem asset de terceiros). A moldura usa as cores do tileset (blocos do topo das paredes, argamassa, contorno `#25131a`); a treliça usa o ferro da gaiola e da bigorna, com ferrugem. Para mudar: edite o script e rode `python scripts/gen-bars-sprites.py --preview` (prévia em `_local/bars-preview.png`, montada no piso do tileset). Não edite os PNGs à mão: o script sobrescreve.

| Arquivo | Tamanho (px de arte) | Uso |
|---|---|---|
| `gate.png` | 16×15 | treliça de ferro (barras, duas travessas rebitadas, dentes); repete lado a lado |
| `frame_mid.png` | 16×20 | verga de pedra (5 linhas) e a sombra dela sobre a abertura |
| `frame_left.png` | 16×20 | idem + ombreira com o trilho, encostada na parede da esquerda |
| `frame_right.png` | 16×20 | idem, à direita |
| `frame_single.png` | 16×20 | vão de um tile, com as duas ombreiras |

No jogo, 1 px de arte = 4 px de mundo; a base fica no pé do tile da grade. Ordem: fresta no chão, treliça recortada abaixo da verga, moldura. A moldura fica sempre (faz parte da parede); erguida, a treliça some dentro da verga e só a ponta dos dentes aparece. Geometria em `BARS.art` (`js/config/EventsConfig.js`); `RoomEvents` escolhe a moldura pelos vizinhos na mesma linha.
