"""Gera a folha dos indicadores de interagir (medalhão de pedra flutuante sobre baú e bigorna).

Uso: python scripts/gen-interact-prompt.py            (escreve assets/ui/interact_prompt.png)
     python scripts/gen-interact-prompt.py --preview  (também escreve _local/interact-prompt-preview.png)

Origem: pixel art desenhada por script, sem IA generativa. Segue a UI do jogo: pedra, contorno e lábio do `FRAME`
(PixelButton) e da tecla do HoldToSkip, glifos 3x5 do `PixelFont` em creme com sombra preta, ponta na cor do jogador
(como a gema do balão de fala), selo na cor da face `red` do PixelButton.

Folha 144x32, células 16x16, 1 pixel de arte = 4 px de mundo (mesma densidade dos sprites):
  linha 0 = Amarelo (P1), linha 1 = Azul (P2): só a ponta muda.
  colunas 0-7: [E, Shift, X Xbox, quadrado DualShock] x [normal, pressionado]
  coluna 8   : selo "bloqueado" (desenhado por cima do ícone)
"""
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "ui", "interact_prompt.png")


def hex_rgba(h, a=255):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


# Paleta da UI (PixelButton.FRAME, FACES.stone e FACES.red, HoldToSkip).
OUTLINE = hex_rgba("#0b0910")
STONE = hex_rgba("#4a4458")
STONE_LIGHT = hex_rgba("#6e6684")
STONE_DARK = hex_rgba("#2b2735")
FACE = hex_rgba("#3a3446")
FACE_LIGHT = hex_rgba("#5a5370")
TEXT = hex_rgba("#efe3c2")
TEXT_SHADOW = hex_rgba("#0b0910")
SHADOW = (0, 0, 0, 115)
RED = hex_rgba("#a3192b")
RED_LIGHT = hex_rgba("#c22a3c")
RED_DARK = hex_rgba("#6e0f1c")
# Botões do controle na cor do botão original, puxada para a paleta (sem saturação de plástico).
XBOX_BLUE = hex_rgba("#5d9bd6")
PS_PINK = hex_rgba("#d07ca6")

PLAYERS = ["#ffd166", "#6bb4db"]

CELL = 16
COLS = 9
MED_X = 2

# Medalhão 11x11 com ponta para baixo, apontando o objeto. O = contorno, R = aro de pedra, F = face,
# a/A/d = ponta na cor do jogador (luz, base, sombra).
MEDALLION = [
    "...OOOOO...",
    ".OORRRRROO.",
    ".ORRFFFRRO.",
    "ORRFFFFFRRO",
    "ORFFFFFFFRO",
    "ORFFFFFFFRO",
    "ORFFFFFFFRO",
    "ORRFFFFFRRO",
    ".ORRFFFRRO.",
    ".OORRRRROO.",
    "...OaAdO...",
    "....OAO....",
    ".....O.....",
]
CENTER = 5  # coluna e linha do centro da face

# E é o glifo 3x5 do PixelFont; Shift (seta cheia), X e quadrado são 5x5 (o X 3x5 vira listras no disco escuro).
GLYPHS = {
    "E": ["###", "#..", "##.", "#..", "###"],
    "X": ["#...#", ".#.#.", "..#..", ".#.#.", "#...#"],
    "SHIFT": ["..#..", ".###.", "#####", ".###.", ".###."],
    "SQUARE": ["#####", "#...#", "#...#", "#...#", "#####"],
}
ICONS = [("E", TEXT), ("SHIFT", TEXT), ("X", XBOX_BLUE), ("SQUARE", PS_PINK)]


def shade(rgba, k):
    r, g, b, a = rgba
    f = (lambda v: round(v + (255 - v) * k)) if k > 0 else (lambda v: round(v * (1 + k)))
    return (f(r), f(g), f(b), a)


def put(img, x, y, c):
    if 0 <= x < img.width and 0 <= y < img.height:
        img.putpixel((x, y), c)


def blend(img, x, y, c):
    if 0 <= x < img.width and 0 <= y < img.height:
        base = Image.new("RGBA", (1, 1), img.getpixel((x, y)))
        base.alpha_composite(Image.new("RGBA", (1, 1), c))
        img.putpixel((x, y), base.getpixel((0, 0)))


def cells():
    for r, row in enumerate(MEDALLION):
        for c, ch in enumerate(row):
            if ch != ".":
                yield c, r, ch


def medallion(img, ox, oy, accent, light):
    tip = {"a": shade(accent, 0.45), "A": accent, "d": shade(accent, -0.35)}
    for c, r, ch in cells():
        if ch == "O":
            color = OUTLINE
        elif ch in tip:
            color = tip[ch]
        elif ch == "R":
            # Luz de cima à esquerda, sombra embaixo à direita (como os painéis de pedra).
            d = (c - CENTER) + (r - CENTER)
            color = STONE_LIGHT if light and d <= -4 else STONE_DARK if d >= 4 else STONE
        else:
            color = FACE_LIGHT if light and r == 2 else FACE
        put(img, ox + c, oy + r, color)


def glyph(img, ox, oy, name, color):
    rows = GLYPHS[name]
    gx = ox + CENTER - len(rows[0]) // 2
    gy = oy + CENTER - len(rows) // 2
    for layer, col in ((1, TEXT_SHADOW), (0, color)):
        for r, row in enumerate(rows):
            for c, ch in enumerate(row):
                if ch == "#":
                    put(img, gx + c, gy + r + layer, col)


def badge(img, ox, oy, accent, icon, pressed):
    name, color = icon
    mx = ox + MED_X
    # Sombra projetada, depois o lábio de pedra escura 1 px abaixo; pressionado, a face desce e cobre o lábio.
    for c, r, _ in cells():
        blend(img, mx + c + 1, oy + r + 2, SHADOW)
    for c, r, ch in cells():
        put(img, mx + c, oy + r + 1, STONE_DARK if ch in "RF" else OUTLINE)
    dy = 1 if pressed else 0
    medallion(img, mx, oy + dy, hex_rgba(accent), light=not pressed)
    glyph(img, mx, oy + dy, name, color)


def blocked_seal(img, ox, oy):
    # Selo 5x5 no canto de baixo à direita da face, com um X creme.
    sx, sy = ox + MED_X + 7, oy + 6
    seal = [".OOO.", "OLRRO", "ORRRO", "ORRDO", ".OOO."]
    for r, row in enumerate(seal):
        for c, ch in enumerate(row):
            color = {"O": OUTLINE, "R": RED, "L": RED_LIGHT, "D": RED_DARK}.get(ch)
            if color:
                put(img, sx + c, sy + r, color)
    for i in (-1, 0, 1):
        put(img, sx + 2 + i, sy + 2 + i, TEXT)
        put(img, sx + 2 + i, sy + 2 - i, TEXT)


def build():
    img = Image.new("RGBA", (CELL * COLS, CELL * 2), (0, 0, 0, 0))
    for row, accent in enumerate(PLAYERS):
        for i, icon in enumerate(ICONS):
            for pressed in (False, True):
                badge(img, (i * 2 + int(pressed)) * CELL, row * CELL, accent, icon, pressed)
        blocked_seal(img, 8 * CELL, row * CELL)
    return img


def preview(img):
    """Folha na escala do jogo (4x) sobre o chão escuro, e em contexto acima do baú e da bigorna."""
    S, tile = 4, 64
    sheet = Image.new("RGBA", (tile * 12, tile * 5), hex_rgba("#2a2030"))
    for y in range(0, sheet.height, tile):
        for x in range(0, sheet.width, tile):
            for i in range(tile):
                sheet.putpixel((x + i, y), hex_rgba("#241b29"))
                sheet.putpixel((x, y + i), hex_rgba("#241b29"))
    up = lambda im: im.resize((im.width * S, im.height * S), Image.NEAREST)
    cell = lambda col, row: img.crop((col * CELL, row * CELL, (col + 1) * CELL, (row + 1) * CELL))
    chest = up(Image.open(os.path.join(ROOT, "assets", "chest", "chest_1.png")).convert("RGBA"))
    anvil = up(Image.open(os.path.join(ROOT, "assets", "anvil", "anvil.png")).convert("RGBA"))

    for row in range(2):
        for col in range(9):
            sheet.alpha_composite(up(cell(col, row)), (col * tile + tile // 2 + (tile if col == 8 else 0), row * tile + 8))
    base_y = 3 * tile + 24
    sheet.alpha_composite(chest, (2 * tile, base_y))
    sheet.alpha_composite(up(cell(0, 0)), (2 * tile, base_y - tile + 4))
    sheet.alpha_composite(anvil, (6 * tile, base_y - 8 * S))
    icon = up(cell(4, 1))
    icon.alpha_composite(up(cell(8, 1)))
    sheet.alpha_composite(icon, (6 * tile + 4 * S, base_y - 8 * S - tile + 4 * S))
    sheet.alpha_composite(chest, (9 * tile + tile // 2, base_y))
    sheet.alpha_composite(up(cell(6, 0)), (9 * tile - 6, base_y - tile + 4))
    sheet.alpha_composite(up(cell(2, 1)), (10 * tile + 6, base_y - tile + 4))
    return sheet


def main():
    img = build()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    img.save(OUT)
    print(f"escrito {os.path.relpath(OUT, ROOT)} {img.size}")
    if "--preview" in sys.argv:
        prev = os.path.join(ROOT, "_local", "interact-prompt-preview.png")
        os.makedirs(os.path.dirname(prev), exist_ok=True)
        preview(img).save(prev)
        print(f"preview {os.path.relpath(prev, ROOT)}")


if __name__ == "__main__":
    main()
