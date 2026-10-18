"""Exporta a SALA MONTADA em PNGs grandes (nearest-neighbor), replicando o
autotiling da engine (js/core/RoomTiles.js) para montar o cenário 3D no
DaVinci Resolve.

Gera, com fundo TRANSPARENTE:
  - sala_completa.png  : a sala inteira (14x9 tiles) com as 4 portas, igual
                         ao fallback liso da engine (moldura + piso).
  - chao_completo.png  : apenas a composição do PISO (área jogável), sem a
                         moldura de parede — para forrar o chão no 3D.
  - parede_topo_completa.png : a parede SUPERIOR inteira na largura da sala
                         (crista + corpo), como uma peça só.
  - parede_base_completa.png : a parede INFERIOR inteira (lado S).
  - parede_esq_completa.png / parede_dir_completa.png : paredes laterais.

Convenção do tileset: grade de 10 colunas, tiles 16x16 (index = row*10 + col).
"""
import os
from PIL import Image

SRC = "assets/tileset/tileset.png"
OUT_DIR = "assets/scene_export"

TILE = 16
COLS = 10
SCALE = 32          # cada tile de 16px vira 512px

# Dimensões da sala (de js/config/GameConfig.js: ROOM_COLS=14, ROOM_ROWS=9).
ROOM_COLS = 14
ROOM_ROWS = 9

os.makedirs(OUT_DIR, exist_ok=True)
src = Image.open(SRC).convert("RGBA")


def tile_img(index):
    c = index % COLS
    r = index // COLS
    return src.crop((c * TILE, r * TILE, c * TILE + TILE, r * TILE + TILE))


# --- Réplica de RoomTiles._tileAt (fallback liso determinístico da engine) ---
def tile_at(c, r, last, bottom):
    # Cantos da parede
    if r == 0 and c == 0: return 0
    if r == 0 and c == last: return 5
    if r == bottom and c == 0: return 40
    if r == bottom and c == last: return 45
    # Bordas de parede
    if r == 0: return 2
    if r == bottom: return 42
    if c == 0: return 20
    if c == last: return 25
    # Beiras do piso (primeira/última fileira jogável)
    topRow, botRow, leftCol, rightCol = 1, bottom - 1, 1, last - 1
    if r == topRow and c == leftCol: return 11
    if r == topRow and c == rightCol: return 14
    if r == botRow and c == leftCol: return 31
    if r == botRow and c == rightCol: return 34
    if r == topRow: return 12
    if r == botRow: return 32
    if c == leftCol: return 21
    if c == rightCol: return 24
    # Piso central liso
    return 16


def build_room(cols, rows, doors):
    """Monta a matriz de índices da sala, com abertura dos vãos de porta,
    exatamente como RoomTiles._build + _openDoors."""
    last, bottom = cols - 1, rows - 1
    floor = [[tile_at(c, r, last, bottom) for c in range(cols)] for r in range(rows)]

    midC = cols // 2
    midR = rows // 2
    FLOOR = 16
    topRow, botRow, leftCol, rightCol = 1, bottom - 1, 1, last - 1

    if doors.get("N"):
        floor[0][midC - 1] = FLOOR; floor[0][midC] = FLOOR
        floor[topRow][midC - 1] = FLOOR; floor[topRow][midC] = FLOOR
    if doors.get("S"):
        floor[bottom][midC - 1] = FLOOR; floor[bottom][midC] = FLOOR
        floor[botRow][midC - 1] = FLOOR; floor[botRow][midC] = FLOOR
    if doors.get("W"):
        floor[midR - 1][0] = FLOOR; floor[midR][0] = FLOOR
        floor[midR - 1][leftCol] = FLOOR; floor[midR][leftCol] = FLOOR
    if doors.get("E"):
        floor[midR - 1][last] = FLOOR; floor[midR][last] = FLOOR
        floor[midR - 1][rightCol] = FLOOR; floor[midR][rightCol] = FLOOR

    return floor


def render(floor):
    """Desenha a matriz de índices numa imagem RGBA (1:1 em tiles de 16px)."""
    rows = len(floor)
    cols = len(floor[0])
    img = Image.new("RGBA", (cols * TILE, rows * TILE), (0, 0, 0, 0))
    for r in range(rows):
        for c in range(cols):
            img.alpha_composite(tile_img(floor[r][c]), (c * TILE, r * TILE))
    return img


def upscale(img):
    return img.resize((img.width * SCALE, img.height * SCALE), Image.NEAREST)


def save(name, img):
    path = os.path.join(OUT_DIR, f"{name}.png")
    big = upscale(img)
    big.save(path)
    print(f"OK  {name:26s} {img.width}x{img.height} tiles -> {big.width}x{big.height}px")


# ---------------------------------------------------------------------------
# 1) SALA COMPLETA (14x9) com as 4 portas abertas.
# ---------------------------------------------------------------------------
room = build_room(ROOM_COLS, ROOM_ROWS, {"N": True, "S": True, "E": True, "W": True})
save("sala_completa", render(room))

# Variante sem portas (paredes fechadas em volta), caso prefira na cena.
room_closed = build_room(ROOM_COLS, ROOM_ROWS, {})
save("sala_fechada", render(room_closed))

# ---------------------------------------------------------------------------
# 2) CHÃO COMPLETO — só a área jogável de piso (sem a moldura de parede).
#    Recorta as linhas/colunas internas (1..rows-2, 1..cols-2) da sala.
# ---------------------------------------------------------------------------
inner_rows = range(1, ROOM_ROWS - 1)
inner_cols = range(1, ROOM_COLS - 1)
floor_only = [[room[r][c] for c in inner_cols] for r in inner_rows]
save("chao_completo", render(floor_only))

# Chão retangular 100% liso (só o tile 16), útil como plano base contínuo.
flat = [[16 for _ in inner_cols] for _ in inner_rows]
save("chao_liso", render(flat))

# ---------------------------------------------------------------------------
# 3) PAREDES COMPLETAS (cada lado inteiro, na dimensão da sala).
#    A engine usa 1 fileira de parede por lado; aqui empilhamos a CRISTA
#    (linha 4 do tileset) sobre o CORPO (linha 5) para dar altura à parede
#    superior/inferior, como no export anterior.
# ---------------------------------------------------------------------------
# Parede superior (N): canto 0 + topo 2 ... + canto 5, com crista+corpo.
def wall_row_top(cols):
    crista = [0] + [2] * (cols - 2) + [5]          # linha da crista (com cantos)
    corpo = [40] + [42] * (cols - 2) + [45]        # linha do corpo (reaproveita base)
    return [crista, corpo]

def wall_row_bottom(cols):
    crista = [0] + [2] * (cols - 2) + [5]
    corpo = [40] + [42] * (cols - 2) + [45]
    return [crista, corpo]

save("parede_topo_completa", render(wall_row_top(ROOM_COLS)))

# Parede inferior (S): a engine usa 40/42/45 (linha base). Uma fileira só.
save("parede_base_completa", render([[40] + [42] * (ROOM_COLS - 2) + [45]]))

# Paredes laterais (coluna inteira na altura da sala).
save("parede_esq_completa", render([[20] for _ in range(ROOM_ROWS)]))
save("parede_dir_completa", render([[25] for _ in range(ROOM_ROWS)]))

print("\nSala montada exportada em", OUT_DIR)
