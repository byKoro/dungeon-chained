"""Gera a grade (portão levadiço) dos acessos das zonas: pixel art à mão, no mesmo 2,5D das paredes do tileset.

Uso: python scripts/gen-bars-sprites.py            (escreve em assets/bars/)
     python scripts/gen-bars-sprites.py --preview  (também escreve _local/bars-preview.png, 8x, entre paredes do mapa)

Tudo cabe em um tile 16x16, a mesma altura da parede de frente (tile 2 do tileset). A verga copia as linhas de cima
desse tile: a face de cima do bloco (luz na borda) e a faixa da frente. Abaixo dela fica o vão por onde a treliça desce.
  gate.png         16x10  treliça de ferro (barras, travessa rebitada, dentes); repete lado a lado
  frame_mid.png    16x16  verga (topo + frente) e a sombra dela no vão
  frame_left.png   16x16  idem + ombreira de pedra com o trilho, encostada na parede da esquerda
  frame_right.png  16x16  idem, à direita
  frame_single.png 16x16  vão de um tile, com as duas ombreiras
O jogo desenha: fresta no chão → treliça (recortada abaixo da verga) → moldura. Erguida, a treliça some atrás da verga
com a ponta dos dentes aparecendo; ao fechar ela despenca.
"""
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "bars")
TILESET = os.path.join(ROOT, "assets", "tileset", "tileset.png")
WALL_FRONT = 2   # tile da parede vista de frente (topo + face de tijolos)

PAL = {
    ".": None,
    "o": (0x25, 0x13, 0x1a, 255),  # contorno (tileset)
    "s": (0x25, 0x13, 0x1a, 170),  # sombra da verga no vão
    "t": (0x25, 0x13, 0x1a, 80),
    "D": (0x62, 0x50, 0x5a, 255),  # ferro escuro (gaiola, bigorna)
    "M": (0x90, 0x91, 0x9e, 255),  # ferro
    "L": (0xad, 0xc1, 0xcf, 255),  # rebite
    "r": (0x72, 0x47, 0x36, 255),  # ferrugem
    "k": (0x3d, 0x25, 0x3b, 255),  # junta / pedra escura (tileset)
    "p": (0x54, 0x37, 0x40, 255),  # pedra da face (tileset)
    "e": (0x48, 0x30, 0x40, 255),  # pedra na sombra (tileset)
}

W = 16
FRAME_H = 16
LINTEL = 6           # linhas 0..5: topo do bloco (0..3) + frente (4..5), como o tile 2
GATE_H = FRAME_H - LINTEL
BAR_X = (1, 5, 9, 13)


def put_rows(img, rows, y0=0):
    for y, r in enumerate(rows):
        assert len(r) == W, f"linha {y}: {len(r)}"
        for x, ch in enumerate(r):
            if PAL[ch]:
                img.putpixel((x, y0 + y), PAL[ch])


def gate():
    g = [["."] * W for _ in range(GATE_H)]
    for x in BAR_X:
        for y in range(0, GATE_H - 2):
            g[y][x], g[y][x + 1] = "M", "D"
        g[GATE_H - 2][x], g[GATE_H - 2][x + 1] = "D", "o"   # dente
        g[GATE_H - 1][x] = "o"
    y0 = 2                                                    # travessa rebitada
    for x in range(W):
        g[y0][x] = "M"
        g[y0 + 1][x] = "D"
        if g[y0 + 2][x] == ".":
            g[y0 + 2][x] = "o"
    for x in BAR_X:
        g[y0][x] = "L"
    for x, y in ((2, 6), (10, 5), (14, 7)):                   # escorridos de ferrugem
        g[y][x] = "r"
    img = Image.new("RGBA", (W, GATE_H))
    put_rows(img, ["".join(r) for r in g])
    return img


def frame(left, right, wall):
    img = Image.new("RGBA", (W, FRAME_H))
    img.alpha_composite(wall.crop((0, 0, W, LINTEL)), (0, 0))
    put_rows(img, ["s" * W, "t" * W], LINTEL)

    def jamb(x0, mirror):
        cols = ("k", "p", "o") if not mirror else ("o", "p", "k")
        for y in range(LINTEL, FRAME_H):
            for i, ch in enumerate(cols):
                img.putpixel((x0 + i, y), PAL["e" if (ch == "p" and y in (LINTEL + 4, FRAME_H - 2)) else ch])
        img.putpixel((x0 + 1, FRAME_H - 1), PAL["o"])

    if left:
        jamb(0, False)
    if right:
        jamb(W - 3, True)
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    ts = Image.open(TILESET).convert("RGBA")
    wall = ts.crop(((WALL_FRONT % 10) * 16, (WALL_FRONT // 10) * 16, (WALL_FRONT % 10) * 16 + 16, (WALL_FRONT // 10) * 16 + 16))
    sprites = {
        "gate.png": gate(),
        "frame_mid.png": frame(False, False, wall),
        "frame_left.png": frame(True, False, wall),
        "frame_right.png": frame(False, True, wall),
        "frame_single.png": frame(True, True, wall),
    }
    for name, img in sprites.items():
        img.save(os.path.join(OUT, name))
        print(f"{name} {img.size[0]}x{img.size[1]}")
    if "--preview" in sys.argv:
        preview(sprites, ts, wall)


def compose(sprites, name, lowered, floor):
    img = Image.new("RGBA", (W, FRAME_H))
    img.alpha_composite(floor, (0, 0))
    for x in range(W):
        img.putpixel((x, FRAME_H - 1), (0x25, 0x13, 0x1a, 255))
    layer = Image.new("RGBA", (W, FRAME_H))
    travel = GATE_H - 2
    layer.alpha_composite(sprites["gate.png"], (0, LINTEL - round((1 - lowered) * travel)))
    img.alpha_composite(layer.crop((0, LINTEL, W, FRAME_H)), (0, LINTEL))
    img.alpha_composite(sprites[name], (0, 0))
    return img


def preview(sprites, ts, wall):
    """Linha de parede de frente com um vão de 3 tiles: abaixada, erguida e no meio, como no mapa."""
    floor = ts.crop((96, 0, 112, 16))
    names = ["frame_left.png", "frame_mid.png", "frame_right.png"]
    scale = 8
    states = (1, 0, 0.5)
    sheet = Image.new("RGBA", (7 * W, len(states) * (FRAME_H * 2)))
    for i, lowered in enumerate(states):
        y = i * FRAME_H * 2 + FRAME_H // 2
        for c in range(7):
            sheet.alpha_composite(floor, (c * W, y - FRAME_H // 2))
            sheet.alpha_composite(floor, (c * W, y + FRAME_H))
            if c < 2 or c > 4:
                sheet.alpha_composite(wall, (c * W, y))
            else:
                sheet.alpha_composite(compose(sprites, names[c - 2], lowered, floor), (c * W, y))
    sheet = sheet.resize((sheet.width * scale, sheet.height * scale), Image.NEAREST)
    os.makedirs(os.path.join(ROOT, "_local"), exist_ok=True)
    sheet.save(os.path.join(ROOT, "_local", "bars-preview-3.png"))
    print("preview _local/bars-preview-3.png")


if __name__ == "__main__":
    main()
