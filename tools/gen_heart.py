"""Gera o sprite do coração (HUD e item de cura) em pixel art chunky.

Saída: assets/heart/heart.png — folha 64x16 com 4 frames de 16x16:
  0 = cheio (vida)          1 = vazio (pedra rachada, vida perdida)
  2 = metade esquerda       3 = metade direita   (usadas ao "quebrar")

Mesma linguagem visual do resto do jogo: contorno quase preto de 1 px,
volume chapado em 3-4 tons, luz no topo/esquerda e sombra embaixo/direita.
Paleta de sangue = a da barra de carregamento (#8a1424 / #6e0f1c / #c22a3c);
paleta de pedra = a do balão de fala (#2b2735 / #4a4458 / #6e6684).

Uso:  python tools/gen_heart.py [--preview caminho.png]
"""
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "heart", "heart.png")
CELL = 16
OX, OY = 0, 1  # o desenho (15x14) fica no topo da célula, 1 px abaixo da borda

# Tokens: '.' vazio | 'o' contorno | 'w' brilho | 'h' luz | 'r' base
#         'd' sombra | 'D' sombra funda
SHAPE = [
    "...ooo...ooo...",
    "..ohhro.orrro..",
    ".ohwhrrorrrrdo.",
    "ohwwhrrrrrrrrdo",
    "ohwhrrrrrrrrrdo",
    "ohhrrrrrrrrrddo",
    "orrrrrrrrrrrddo",
    ".orrrrrrrrrddo.",
    "..odrrrrrrddo..",
    "...odrrrrdDo...",
    "....odrrdDo....",
    ".....oddDo.....",
    "......oDo......",
    ".......o.......",
]

BLOOD = {
    "o": (11, 9, 16), "w": (255, 214, 222), "h": (255, 107, 122),
    "r": (194, 42, 60), "d": (138, 20, 36), "D": (94, 12, 26),
}
STONE = {
    "o": (11, 9, 16), "w": (110, 102, 132), "h": (74, 68, 88),
    "r": (43, 39, 53), "d": (31, 27, 40), "D": (22, 19, 30),
}

# Coração do ITEM DE CURA (no chão): resolução menor (11x10) para ser
# desenhado com o MESMO tamanho de pixel do cenário (16 px de arte -> 1 tile)
# sem ficar enorme. Menos pixels = blocos maiores = visual mais chunky.
PICKUP_OUT = os.path.join(ROOT, "assets", "heart", "heart_pickup.png")
PICKUP_SIZE = 12  # 11x10 + 1 px de sombra projetada
PICKUP = [
    ".ooo...ooo.",
    "ohhro.orrro",
    "ohwhrorrrdo",
    "ohhrrrrrrdo",
    "orrrrrrrddo",
    ".orrrrrrdo.",
    "..orrrddo..",
    "...ordDo...",
    "....oDo....",
    ".....o.....",
]

# Rachadura em zigue-zague (coluna por linha). Divide as metades e marca o
# coração vazio. Linhas fora do dicionário usam a coluna central (7).
CRACK = {2: 7, 3: 6, 4: 7, 5: 8, 6: 7, 7: 6, 8: 7, 9: 8, 10: 7}


def crack_col(row):
    return CRACK.get(row, 7)


def paint(img, ox, pal, keep=None, crack=False):
    """Pinta SHAPE na posição ox. keep(row, col) -> False descarta o pixel;
    crack=True desenha a rachadura (pedra)."""
    px = img.load()
    for r, line in enumerate(SHAPE):
        for c, t in enumerate(line):
            if t == ".":
                continue
            if keep and not keep(r, c):
                continue
            color = pal[t]
            if crack and t != "o" and c == crack_col(r) and r in CRACK:
                color = pal["o"]
            px[ox + OX + c, OY + r] = color + (255,)


def half_left(r, c):
    return c <= crack_col(r)


def half_right(r, c):
    return c >= crack_col(r)


def main():
    sheet = Image.new("RGBA", (CELL * 4, CELL), (0, 0, 0, 0))
    paint(sheet, 0, BLOOD)
    paint(sheet, CELL, STONE, crack=True)
    paint(sheet, CELL * 2, BLOOD, keep=half_left)
    paint(sheet, CELL * 3, BLOOD, keep=half_right)

    # Borda da quebra: a coluna da rachadura vira contorno nas duas metades.
    px = sheet.load()
    for r in range(len(SHAPE)):
        c = crack_col(r)
        if SHAPE[r][c] == ".":
            continue
        for base in (CELL * 2, CELL * 3):
            px[base + OX + c, OY + r] = BLOOD["o"] + (255,)

    # Sombra projetada de 1 px (baixo/direita) em todos os frames: dá o peso
    # "chunky" de objeto sólido, como os baús e caixas do cenário.
    solid = [(x, y) for x in range(sheet.width) for y in range(CELL) if px[x, y][3] == 255]
    for x, y in solid:
        sx, sy = x + 1, y + 1
        if sx % CELL == 0 or sy >= CELL:
            continue  # não vaza para a célula vizinha
        if px[sx, sy][3] == 0:
            px[sx, sy] = (0, 0, 0, 120)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    sheet.save(OUT)
    print("ok:", OUT)

    # Item de cura: mesmo vocabulário (contorno, 4 tons, sombra de 1 px).
    pick = Image.new("RGBA", (PICKUP_SIZE, PICKUP_SIZE), (0, 0, 0, 0))
    pp = pick.load()
    for r, line in enumerate(PICKUP):
        for c, t in enumerate(line):
            if t != ".":
                pp[c, r] = BLOOD[t] + (255,)
    for x, y in [(x, y) for x in range(PICKUP_SIZE) for y in range(PICKUP_SIZE) if pp[x, y][3] == 255]:
        if x + 1 < PICKUP_SIZE and y + 1 < PICKUP_SIZE and pp[x + 1, y + 1][3] == 0:
            pp[x + 1, y + 1] = (0, 0, 0, 120)
    pick.save(PICKUP_OUT)
    print("ok:", PICKUP_OUT)

    if "--preview" in sys.argv:
        dst = sys.argv[sys.argv.index("--preview") + 1]
        bg = Image.new("RGBA", sheet.size, (40, 36, 50, 255))
        bg.alpha_composite(sheet)
        out = Image.new("RGBA", (sheet.width + PICKUP_SIZE + 4, CELL), (40, 36, 50, 255))
        out.alpha_composite(bg, (0, 0))
        out.alpha_composite(pick, (sheet.width + 4, 2))
        out.resize((out.width * 12, out.height * 12), Image.NEAREST).save(dst)
        print("preview:", dst)


if __name__ == "__main__":
    main()
