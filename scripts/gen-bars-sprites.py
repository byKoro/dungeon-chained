"""Gera a grade (portão levadiço) dos acessos das zonas: pixel art à mão, paleta do tileset, da gaiola e da bigorna.

Uso: python scripts/gen-bars-sprites.py            (escreve em assets/bars/)
     python scripts/gen-bars-sprites.py --preview  (também escreve _local/bars-preview.png, 8x, no piso do tileset)

Duas camadas por tile (16 px de arte de largura; a base é o pé do tile):
  gate.png         16x15  treliça de ferro que corre por dentro do batente (repete lado a lado)
  frame_mid.png    16x20  verga de pedra no alto (blocos como o topo das paredes) e sombra embaixo dela
  frame_left.png   16x20  idem + ombreira de pedra com o trilho, encostada na parede da esquerda
  frame_right.png  16x20  idem, à direita
  frame_single.png 16x20  vão de um tile, com as duas ombreiras
O jogo desenha: fresta no chão → treliça (recortada abaixo da verga) → moldura. Erguida, a treliça fica escondida
na verga com a ponta dos dentes aparecendo; ao fechar ela despenca da verga.
"""
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "bars")

PAL = {
    ".": None,
    "o": (0x25, 0x13, 0x1a, 255),  # contorno (tileset)
    "s": (0x25, 0x13, 0x1a, 150),  # sombra da verga sobre a treliça
    "t": (0x25, 0x13, 0x1a, 70),
    "D": (0x62, 0x50, 0x5a, 255),  # ferro escuro (gaiola, bigorna)
    "M": (0x90, 0x91, 0x9e, 255),  # ferro
    "L": (0xad, 0xc1, 0xcf, 255),  # rebite
    "r": (0x72, 0x47, 0x36, 255),  # ferrugem
    "k": (0x3d, 0x25, 0x3b, 255),  # argamassa / pedra escura (tileset)
    "p": (0x54, 0x37, 0x40, 255),  # pedra
    "q": (0x6e, 0x4a, 0x48, 255),  # bloco do topo da parede
    "u": (0x78, 0x51, 0x4f, 255),  # luz do bloco
}

W = 16
GATE_H = 15
FRAME_H = 20
LINTEL = 5           # linhas da verga (0..4); a abertura vai de 5 a 19
BAR_X = (1, 5, 9, 13)  # coluna clara de cada barra (passo 4 também entre tiles)


def image(rows):
    img = Image.new("RGBA", (len(rows[0]), len(rows)))
    for y, r in enumerate(rows):
        assert len(r) == img.width, f"linha {y}: {len(r)}"
        for x, ch in enumerate(r):
            img.putpixel((x, y), PAL[ch] or (0, 0, 0, 0))
    return img


def gate():
    g = [["."] * W for _ in range(GATE_H)]
    for x in BAR_X:
        for y in range(0, 13):
            g[y][x], g[y][x + 1] = "M", "D"
        g[13][x], g[13][x + 1] = "D", "o"   # dente
        g[14][x] = "o"
    for y0 in (2, 8):                         # travessas rebitadas
        for x in range(W):
            g[y0][x] = "M"
            g[y0 + 1][x] = "D"
            if g[y0 + 2][x] == ".":
                g[y0 + 2][x] = "o"
        for x in BAR_X:
            g[y0][x] = "L"
    for x, y in ((2, 5), (6, 11), (10, 6), (14, 12), (6, 4)):  # escorridos de ferrugem
        g[y][x] = "r"
    return image(["".join(r) for r in g])


def lintel_rows():
    # Blocos como o topo das paredes: luz em cima, juntas de argamassa a cada 8 px (deslocadas na 2ª fiada).
    top = "o" * W
    a = "".join("k" if x % 8 == 7 else "u" for x in range(W))
    b = "".join("k" if x % 8 == 7 else "q" for x in range(W))
    c = "".join("k" if (x + 4) % 8 == 7 else "p" for x in range(W))
    return [list(top), list(a), list(b), list(c), list("o" * W)]


def frame(left, right):
    g = lintel_rows() + [["."] * W for _ in range(FRAME_H - LINTEL)]
    for x in range(W):
        g[LINTEL][x] = "s"
        g[LINTEL + 1][x] = "t"

    def jamb(x0, inner):
        # Ombreira de 3 px: pedra com luz do lado de fora e o trilho escuro do lado do vão.
        cols = ("o", "u", "p") if inner > x0 else ("p", "u", "o")
        for y in range(LINTEL, FRAME_H):
            for i, ch in enumerate(cols):
                g[y][x0 + i] = ch
            g[y][inner] = "o"
        for y in (9, 14):
            g[y][x0 + 1] = "k"
        g[FRAME_H - 1][x0 + 1] = "o"

    if left:
        jamb(0, 3)
    if right:
        jamb(W - 3, W - 4)
    return image(["".join(r) for r in g])


def main():
    os.makedirs(OUT, exist_ok=True)
    for old in ("bars_mid.png", "bars_left.png", "bars_right.png", "bars_single.png"):
        path = os.path.join(OUT, old)
        if os.path.exists(path):
            os.remove(path)
    sprites = {
        "gate.png": gate(),
        "frame_mid.png": frame(False, False),
        "frame_left.png": frame(True, False),
        "frame_right.png": frame(False, True),
        "frame_single.png": frame(True, True),
    }
    for name, img in sprites.items():
        img.save(os.path.join(OUT, name))
        print(f"{name} {img.size[0]}x{img.size[1]}")
    if "--preview" in sys.argv:
        preview(sprites)


def compose(sprites, names, lowered):
    """Uma grade montada: fresta, treliça (abaixada `lowered` 0..1) e moldura, como o jogo desenha."""
    w = len(names) * W
    img = Image.new("RGBA", (w, FRAME_H))
    travel = GATE_H - 2
    for i, name in enumerate(names):
        x = i * W
        for xx in range(x, x + W):
            img.putpixel((xx, FRAME_H - 1), PAL["t"])
        layer = Image.new("RGBA", (W, FRAME_H))
        layer.alpha_composite(sprites["gate.png"], (0, FRAME_H - GATE_H - round((1 - lowered) * travel)))
        layer = layer.crop((0, LINTEL, W, FRAME_H))
        img.alpha_composite(layer, (x, LINTEL))
        img.alpha_composite(sprites[name], (x, 0))
    return img


def preview(sprites):
    scale = 8
    floor = Image.open(os.path.join(ROOT, "assets", "tileset", "tileset.png")).convert("RGBA").crop((96, 0, 112, 16))
    row = ["frame_left.png", "frame_mid.png", "frame_right.png"]
    shots = [compose(sprites, row, 1), compose(sprites, row, 0), compose(sprites, ["frame_single.png"], 0.6)]
    w = 3 * W + 2 * 2
    h = len(shots) * (FRAME_H + 4) + 4
    sheet = Image.new("RGBA", (w, h))
    for yy in range(0, h, 16):
        for xx in range(0, w, 16):
            sheet.alpha_composite(floor, (xx, yy))
    for i, s in enumerate(shots):
        sheet.alpha_composite(s, (2, 2 + i * (FRAME_H + 4)))
    sheet = sheet.resize((w * scale, h * scale), Image.NEAREST)
    os.makedirs(os.path.join(ROOT, "_local"), exist_ok=True)
    sheet.save(os.path.join(ROOT, "_local", "bars-preview.png"))
    print("preview _local/bars-preview.png")


if __name__ == "__main__":
    main()
