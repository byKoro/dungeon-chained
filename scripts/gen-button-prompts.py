"""Gera a folha dos ícones de botão dos tutoriais rápidos (card do dash e os próximos).

Uso: python scripts/gen-button-prompts.py            (escreve assets/ui/button_prompts.png)
     python scripts/gen-button-prompts.py --preview  (também escreve _local/button-prompts-preview.png)

Origem: pixel art desenhada por script, sem IA generativa. Mesma paleta do indicador de interagir
(gen-interact-prompt.py) e do `FRAME` do PixelButton.

Folha 80x32, células 16x16, linha 0 = normal, linha 1 = pressionado (a face desce 2 px e cobre o lábio):
  coluna 0: tecla do teclado em branco (fatiada em 3: borda esquerda 4 px, miolo 1 px esticável, borda direita 4 px;
            o rótulo é escrito em jogo com o PixelFont, traduzido)
  coluna 1: Xbox A (verde)      coluna 2: Xbox X (azul)
  coluna 3: DualShock ✕ (azul)  coluna 4: DualShock □ (rosa)
"""
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "ui", "button_prompts.png")


def hex_rgba(h, a=255):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


OUTLINE = hex_rgba("#0b0910")
SHADOW = (0, 0, 0, 115)
KEY_FACE = hex_rgba("#6e6684")
KEY_LIGHT = hex_rgba("#8c84a3")
KEY_SIDE = hex_rgba("#5a5370")
KEY_LIP = hex_rgba("#2b2735")
KEY_PRESSED = hex_rgba("#5a5370")
PAD_FACE = hex_rgba("#2a2533")
PAD_LIGHT = hex_rgba("#3e3849")
PAD_LIP = hex_rgba("#151219")
TEXT_SHADOW = hex_rgba("#0b0910")
# Cores dos botões puxadas para a paleta (sem saturação de plástico). Xbox X e □ iguais aos do indicador de interagir.
XBOX_GREEN = hex_rgba("#7cc46a")
XBOX_BLUE = hex_rgba("#5d9bd6")
PS_BLUE = hex_rgba("#8fb3e8")
PS_PINK = hex_rgba("#d07ca6")

CELL = 16
COLS = 5
LIP = 2

GLYPHS = {
    "A": [".###.", "#...#", "#####", "#...#", "#...#"],
    "X": ["#...#", ".#.#.", "..#..", ".#.#.", "#...#"],
    "CROSS": ["#...#", "##.##", ".###.", "##.##", "#...#"],
    "SQUARE": ["#####", "#...#", "#...#", "#...#", "#####"],
}
PADS = [("A", XBOX_GREEN), ("X", XBOX_BLUE), ("CROSS", PS_BLUE), ("SQUARE", PS_PINK)]


def shade(rgba, k):
    r, g, b, a = rgba
    return (round(r * (1 + k)), round(g * (1 + k)), round(b * (1 + k)), a)


def put(img, x, y, c):
    if 0 <= x < img.width and 0 <= y < img.height:
        img.putpixel((x, y), c)


def blend(img, x, y, c):
    if 0 <= x < img.width and 0 <= y < img.height:
        base = Image.new("RGBA", (1, 1), img.getpixel((x, y)))
        base.alpha_composite(Image.new("RGBA", (1, 1), c))
        img.putpixel((x, y), base.getpixel((0, 0)))


def keycap(img, ox, oy, pressed):
    # Tecla 16 de largura e 13 de altura (+2 de lábio, +1 de sombra). Cantos chanfrados; o miolo (x 4..11) é
    # igual em todas as colunas para poder ser esticado.
    w, h = CELL, 13
    top = oy + (LIP if pressed else 0)
    # Sombra projetada (1 px abaixo de tudo).
    for x in range(1, w - 1):
        blend(img, ox + x, oy + h + LIP, SHADOW)
    # Lábio (só sem pressionar).
    if not pressed:
        for y in range(h - 1, h + LIP):
            for x in range(w):
                corner = x in (0, w - 1) and y == h + LIP - 1
                if corner:
                    continue
                edge = x in (0, w - 1) or y == h + LIP - 1
                put(img, ox + x, oy + y, OUTLINE if edge else KEY_LIP)
    for y in range(h):
        for x in range(w):
            if x in (0, w - 1) and y in (0, h - 1):
                continue
            edge = x in (0, w - 1) or y == 0 or (pressed and y == h - 1)
            if y == h - 1 and not edge:
                c = KEY_LIP
            elif edge:
                c = OUTLINE
            elif pressed:
                c = KEY_PRESSED
            elif y == 1:
                c = KEY_LIGHT
            elif x in (1, w - 2) or y == h - 2:
                c = KEY_SIDE
            else:
                c = KEY_FACE
            put(img, ox + x, top + y, c)


def disk_mask(d=13):
    r = d / 2
    return [[((x + 0.5 - r) ** 2 + (y + 0.5 - r) ** 2) <= r * r for x in range(d)] for y in range(d)]


def pad_button(img, ox, oy, glyph, color, pressed):
    d = 13
    m = disk_mask(d)
    on = lambda x, y: 0 <= x < d and 0 <= y < d and m[y][x]
    top = oy + (LIP if pressed else 0)
    # Sombra, lábio, disco.
    for y in range(d):
        for x in range(d):
            if on(x, y):
                blend(img, ox + x + 1, oy + y + LIP + 1, SHADOW)
    if not pressed:
        # Silhueta do disco arrastada LIP px para baixo: borda em contorno, miolo em lábio; o disco cobre o resto.
        body = lambda x, y: any(on(x, y - dy) for dy in range(LIP + 1))
        for y in range(d + LIP):
            for x in range(d):
                if body(x, y):
                    edge = not (body(x - 1, y) and body(x + 1, y) and body(x, y + 1))
                    put(img, ox + x, oy + y, OUTLINE if edge else PAD_LIP)
    ring = shade(color, -0.45)
    for y in range(d):
        for x in range(d):
            if not on(x, y):
                continue
            if not (on(x - 1, y) and on(x + 1, y) and on(x, y - 1) and on(x, y + 1)):
                c = OUTLINE
            elif not (on(x - 2, y) and on(x + 2, y) and on(x, y - 2) and on(x, y + 2)):
                c = ring
            elif not pressed and y <= 3:
                c = PAD_LIGHT
            else:
                c = PAD_FACE
            put(img, ox + x, top + y, c)
    rows = GLYPHS[glyph]
    gx, gy = ox + (d - 5) // 2, top + (d - 5) // 2
    for layer, col in ((1, TEXT_SHADOW), (0, color)):
        for r, row in enumerate(rows):
            for c, ch in enumerate(row):
                if ch == "#":
                    put(img, gx + c, gy + r + layer, col)


def build():
    img = Image.new("RGBA", (CELL * COLS, CELL * 2), (0, 0, 0, 0))
    for row, pressed in ((0, False), (1, True)):
        keycap(img, 0, row * CELL, pressed)
        for i, (glyph, color) in enumerate(PADS):
            pad_button(img, (i + 1) * CELL, row * CELL, glyph, color, pressed)
    return img


def preview(img):
    """Folha 6x sobre o poço escuro do card, com a tecla esticada para 'ESPAÇO'."""
    S = 6
    bg = Image.new("RGBA", (img.width * S + 40, img.height * S + 40), hex_rgba("#1b1722"))
    bg.alpha_composite(img.resize((img.width * S, img.height * S), Image.NEAREST), (20, 20))
    return bg


def main():
    img = build()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    img.save(OUT)
    print(f"escrito {os.path.relpath(OUT, ROOT)} {img.size}")
    if "--preview" in sys.argv:
        prev = os.path.join(ROOT, "_local", "button-prompts-preview.png")
        os.makedirs(os.path.dirname(prev), exist_ok=True)
        preview(img).save(prev)
        print(f"preview {os.path.relpath(prev, ROOT)}")


if __name__ == "__main__":
    main()
