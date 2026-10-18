"""Gera a folha de EXPLOSÃO em pixel art do trailer (boss de fogo).

Bola de fogo procedural quantizada na PALETA DO FOGO do ghostfire
(assets/enemies/ghostfire.png): nasce pequena e quente (miolo claro), incha
em lóbulos irregulares, esfria de dentro para fora (o miolo queima e abre
um buraco) e termina em fumaça escura que se desfaz em pixels soltos.

Saída: assets/fx/explosion.png — grade de CELL x CELL, FRAMES colunas x
VARIANTS linhas (variações de forma, sorteadas por quem desenha).

Uso:  python tools/gen_explosion.py [--preview caminho.png]
"""
import math
import os
import random
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "fx", "explosion.png")
CELL = 32
FRAMES = 10
VARIANTS = 3

# Paleta do fogo do ghostfire (frio -> quente). Os dois primeiros são fumaça.
SMOKE_DARK = (58, 9, 8, 255)
SMOKE = (97, 64, 58, 255)
RAMP = [
    (92, 19, 34, 255),
    (125, 24, 24, 255),
    (159, 50, 50, 255),
    (190, 81, 47, 255),
    (221, 144, 74, 255),
    (242, 213, 213, 255),
]


def value_noise(seed):
    """Ruído de valor 2D suave (grade 4 px), determinístico pela semente."""
    rnd = random.Random(seed)
    grid = {}

    def g(ix, iy):
        k = (ix, iy)
        if k not in grid:
            grid[k] = rnd.random()
        return grid[k]

    def n(x, y, scale=4.0):
        x /= scale
        y /= scale
        ix, iy = math.floor(x), math.floor(y)
        fx, fy = x - ix, y - iy
        sx, sy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
        a = g(ix, iy) + (g(ix + 1, iy) - g(ix, iy)) * sx
        b = g(ix, iy + 1) + (g(ix + 1, iy + 1) - g(ix, iy + 1)) * sx
        return a + (b - a) * sy

    return n


def ease_out(t):
    return 1 - (1 - t) ** 3


def frame(variant, f):
    rnd = random.Random(variant * 97 + 13)
    noise = value_noise(variant * 31 + 7)
    k = f / (FRAMES - 1)                       # 0 -> 1 ao longo da vida
    c = CELL / 2 - 0.5
    # Lóbulos: o centro + 3..4 bolhas em volta (forma irregular).
    lobes = [(0.0, 0.0, 1.0)]
    for _ in range(3 + variant % 2):
        a = rnd.random() * math.tau
        d = 0.35 + rnd.random() * 0.3
        lobes.append((math.cos(a) * d, math.sin(a) * d, 0.55 + rnd.random() * 0.3))
    R = 3.5 + 11.5 * ease_out(min(1, k * 1.25))   # raio em px da célula
    cool = 1.1 * k ** 1.5                          # esfriamento global (quente por mais tempo)
    hollow = max(0.0, (k - 0.45) / 0.55)           # miolo queimando (buraco)

    img = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    px = img.load()
    for y in range(CELL):
        for x in range(CELL):
            # Distância normalizada ao lóbulo mais próximo (0 = centro, 1 = borda).
            best = 9.0
            for lx, ly, lr in lobes:
                dx = (x - c) / R - lx * min(1, k * 2)
                dy = (y - c) / R - ly * min(1, k * 2)
                best = min(best, math.hypot(dx, dy) / lr)
            n = noise(x + variant * 50, y + f * 1.7)
            edge = best + (n - 0.5) * 0.55          # borda irregular
            if edge > 1.0:
                continue
            heat = (1 - edge) * 1.4 - cool + (n - 0.5) * 0.35
            # Miolo queima e abre (fim da explosão).
            if hollow > 0 and best < hollow * 0.75 + (n - 0.5) * 0.3:
                continue
            # Fumaça se desfaz em pixels soltos no fim.
            if k > 0.7 and n < (k - 0.7) * 2.2:
                continue
            if heat <= 0.02:
                col = SMOKE if (n > 0.55 and k > 0.5) else SMOKE_DARK
            else:
                i = min(len(RAMP) - 1, int(heat * len(RAMP)))
                col = RAMP[i]
            px[x, y] = col
    return img


def main():
    sheet = Image.new("RGBA", (CELL * FRAMES, CELL * VARIANTS), (0, 0, 0, 0))
    for v in range(VARIANTS):
        for f in range(FRAMES):
            sheet.paste(frame(v, f), (f * CELL, v * CELL))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    sheet.save(OUT)
    print("ok", OUT, sheet.size)
    if "--preview" in sys.argv:
        path = sys.argv[sys.argv.index("--preview") + 1]
        bg = Image.new("RGBA", sheet.size, (30, 22, 30, 255))
        bg.alpha_composite(sheet)
        bg.resize((sheet.width * 4, sheet.height * 4), Image.NEAREST).save(path)
        print("preview", path)


if __name__ == "__main__":
    main()
