# Peças de Sala (`/map`)

Cada arquivo `.json` nesta pasta é **uma peça de sala autoral** usada pelo
gerador da dungeon. O gerador monta o grid (onde cada peça fica e quais portas
ela tem) e, para cada slot, **sorteia uma peça** cuja assinatura de portas
corresponda. Toda a aleatoriedade está nessa escolha — o conteúdo interno de
cada peça é fixo (desenhado por você no editor).

## Índice

`index.json` lista os arquivos de peça que o jogo deve carregar. O navegador
não lista pastas sozinho, então toda peça nova precisa ser adicionada aqui.

```json
{
  "rooms": [
    "cross_01.json",
    "corner_ne_01.json",
    "corner_ne_02.json"
  ]
}
```

## Formato de uma peça

```json
{
  "id": "corner_ne_01",
  "name": "Curva NE — Ruínas",
  "cols": 14,
  "rows": 9,
  "kind": "room",            // "room" | "corridor"
  "type": "normal",          // "normal" | "start" | "boss" | "challenge"
  "doors": { "N": true, "S": false, "E": true, "W": false },
  "floor": [[...], ...],      // matriz [rows][cols] de índices de tile; -1 = buraco/abismo
  "holes": ["3,4", "3,5"],   // (opcional) coordenadas "col,row" de buraco; redundante com floor=-1
  "torches": [                // tochas = pontos de luz posicionados por você
    { "col": 3, "row": 0, "side": "N" }
  ],
  "props": [                  // decoração estática (tiles desenhados sobre o piso)
    { "col": 2, "row": 1, "index": 59, "flip": false }
  ],
  "scatterProps": {           // (opcional) props aleatórios pelo chão
    "enabled": false,         // se true, o jogo espalha props e IGNORA "props"
    "density": 0.08           // fração dos tiles de chão livre (0..0.4)
  },
  "lock": "none",             // (opcional) regra das portas: ver abaixo
  "enemies": [                // inimigos posicionados por você
    { "type": "demon", "col": 6, "row": 4 }
  ],
  "hazards": [                // perigos (traps) por tile
    { "type": "spikeRow", "col": 4, "row": 4, "count": 4, "phase": 0, "wave": 0.12 },
    { "type": "button", "col": 11, "row": 3 }
  ]
}
```

### Campos

- **doors**: assinatura de portas. É o que o gerador usa para encaixar a peça
  num slot do grid. Deve bater exatamente com as portas que o slot exige.
- **floor**: a matriz de tiles já com buracos aplicados (`-1`). A moldura de
  parede e os vãos de porta fazem parte dela.
- **torches**: cada tocha vira um ponto de luz no jogo. `side` (`N`/`S`/`E`/`W`)
  define para qual lado a luz é empurrada (para dentro da sala).
- **props**: decoração puramente visual (tiles do tileset). `flip` espelha o
  tile horizontalmente.
- **scatterProps**: alternativa aos props manuais. Com `enabled: true`, o jogo
  espalha props nos tiles de chão livre na geração (determinístico por célula),
  e o campo `props` é ignorado. É um ou outro, não os dois.
- **enemies / hazards**: conteúdo de combate/puzzle, posicionado por tile.
- **lock**: regra que define quando as portas da peça abrem. Opcional; se
  ausente, é deduzida pelo conteúdo. Valores:
  - `"none"` — nunca tranca (portas sempre abertas), mesmo com spikes/flechas.
  - `"enemies"` — tranca até matar todos os inimigos.
  - `"buttons"` — tranca até os 2 botões serem pressionados juntos (co-op).

Padrão deduzido quando `lock` está ausente: 2+ botões → `buttons`; senão
inimigos → `enemies`; senão → `none`. Spikes/flechas sozinhos NÃO trancam mais
(ficam ativos, mas as portas permanecem abertas).
