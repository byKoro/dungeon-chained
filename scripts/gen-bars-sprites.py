"""Gera os sprites da grade (portão levadiço) dos acessos das zonas: pixel art à mão, paleta da gaiola/bigorna.

Uso: python scripts/gen-bars-sprites.py            (escreve em assets/bars/)
     python scripts/gen-bars-sprites.py --preview  (também escreve _local/bars-preview.png, 8x, em cima do piso)

Cada peça ocupa um tile (16 px de arte de largura) e 20 de altura (BARS.height = 1,25 tile); a base é o pé do tile.
Peças lado a lado formam uma grade contínua: viga de madeira em cima, barras de ferro, travessa rebitada e dentes
pontudos em baixo. `left`/`right` têm o pilar que encosta na parede; `single` tem os dois.
  bars_mid.png     16x20
  bars_left.png    16x20
  bars_right.png   16x20
  bars_single.png  16x20
"""
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "bars")

PAL = {
    ".": None,
    "o": "#25131a",  # contorno
    "D": "#62505a",  # ferro escuro
    "M": "#90919e",  # ferro
    "L": "#adc1cf",  # ferro claro
    "S": "#bbd3e1",  # brilho (rebites)
    "b": "#523b40",  # madeira escura
    "w": "#895a45",  # madeira
    "r": "#bf704d",  # madeira clara
}

W, H = 16, 20
BAR_X = (2, 6, 10, 14)  # coluna clara de cada barra; a escura fica à direita (passo 4 também entre peças)


def rgba(key):
    c = PAL[key]
    if c is None:
        return (0, 0, 0, 0)
    return (int(c[1:3], 16), int(c[3:5], 16), int(c[5:7], 16), 255)


def grid():
    g = [["."] * W for _ in range(H)]
    # Viga de madeira (y 0–4) com pregos de ferro.
    g[0] = list("o" * W)
    g[1] = list("wwrwwwwwwwrwwwww")
    g[2] = list("wwwwwSwwwwwwwSww")
    g[3] = list("bbbbbbbbbbbbbbbb")
    g[4] = list("o" * W)
    # Barras (y 5–17) e dentes (y 18–19).
    for x in BAR_X:
        for y in range(5, 18):
            g[y][x], g[y][x + 1] = "L", "D"
        g[18][x], g[18][x + 1] = "M", "o"
        g[19][x] = "o"
    # Travessa rebitada (y 10–12): ferro por cima das barras, contorno embaixo só nos vãos.
    for x in range(W):
        g[10][x] = "M"
        g[11][x] = "D"
        if g[12][x] == ".":
            g[12][x] = "o"
    for x in BAR_X:
        g[10][x] = "S"
    return g


def post(g, x0):
    """Pilar de 4 px que encosta na parede: contorno, madeira clara/escura, braçadeira de ferro."""
    for y in range(H):
        g[y][x0], g[y][x0 + 1], g[y][x0 + 2], g[y][x0 + 3] = "o", "r", "w", "o"
    for y in range(1, H - 1):
        g[y][x0 + 2] = "b" if y % 5 == 4 else "w"
    for y in (9, 10, 11, 12):
        g[y][x0 + 1], g[y][x0 + 2] = ("L", "D") if y < 12 else ("D", "D")
    g[10][x0 + 1] = "S"
    g[H - 1][x0 + 1] = g[H - 1][x0 + 2] = "o"


def piece(left, right):
    g = grid()
    if left:
        post(g, 0)
    if right:
        post(g, W - 4)
    img = Image.new("RGBA", (W, H))
    for y in range(H):
        for x in range(W):
            img.putpixel((x, y), rgba(g[y][x]))
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    sprites = {
        "bars_mid.png": piece(False, False),
        "bars_left.png": piece(True, False),
        "bars_right.png": piece(False, True),
        "bars_single.png": piece(True, True),
    }
    for name, img in sprites.items():
        img.save(os.path.join(OUT, name))
        print(f"{name} {img.size[0]}x{img.size[1]}")
    if "--preview" in sys.argv:
        scale = 8
        floor = (61, 37, 59, 255)
        rows = [["bars_left.png", "bars_mid.png", "bars_right.png"], ["bars_single.png"],
                ["bars_left.png", "bars_mid.png", "bars_mid.png", "bars_right.png"]]
        sheet = Image.new("RGBA", ((4 * W + 2) * scale, (len(rows) * (H + 4) + 2) * scale), floor)
        for r, names in enumerate(rows):
            for c, name in enumerate(names):
                big = sprites[name].resize((W * scale, H * scale), Image.NEAREST)
                sheet.alpha_composite(big, ((1 + c * W) * scale, (2 + r * (H + 4)) * scale))
        os.makedirs(os.path.join(ROOT, "_local"), exist_ok=True)
        sheet.save(os.path.join(ROOT, "_local", "bars-preview.png"))
        print("preview _local/bars-preview.png")


if __name__ == "__main__":
    main()
