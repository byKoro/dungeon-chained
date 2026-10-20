"""Gera a KEYART quadrada do Dungeon Chained a partir dos sprites reais.

Tudo é composto numa grade NATIVA de 128x128 "pixels de arte" (a mesma
escala dos sprites do jogo: tiles de 16px, heróis ~18px, serra 16px) e só no
fim ampliado 8x com vizinho-mais-próximo -> 1024x1024. Nada é rotacionado nem
escalado fracionariamente, então todo pixel da imagem final tem o mesmo
tamanho (8x8).

Cena:
  - fundo: sala montada com assets/tileset/tileset.png (8x8 tiles);
  - luz quente central + vinheta, quantizadas em 4 faixas com dithering Bayer;
  - poças/respingos de sangue no chão (na grade);
  - P1 (furia) à esquerda, P2 (assustado) à direita, frame 0, escala 1x;
  - corda rasterizada pixel a pixel (2px de miolo + contorno, paleta do
    assets/saw/rope.png) curvando para baixo entre os dois;
  - serra PARADA ensanguentada (linha de inércia 1, frame 3) no fundo da curva;
  - título "DUNGEON / CHAINED" em fonte bitmap chunky desenhada aqui.

Saída: assets/keyart/keyart_128.png, assets/keyart/keyart_1024.png,
       assets/keyart/logo.png (só o título, fundo transparente, nativo) e
       assets/keyart/cover_630x500.png (capa do itch.io; heróis e serra
       maiores que o cenário — ver make_cover)
Uso:   python tools/gen_keyart.py
"""
import math
import os
import random
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "assets", "keyart")
SIZE = 128          # resolução nativa (pixels de arte)
SCALE = 8           # 128 * 8 = 1024
TILE = 16
SEED = 7            # sorteio estável dos tiles de chão / respingos


def asset(*parts):
    return os.path.join(ROOT, "assets", *parts)


# ---------------------------------------------------------------------------
# Fundo: sala do tileset
# ---------------------------------------------------------------------------
TILESET_COLS = 10
FLOOR_TILES = [11, 12, 13, 14, 21, 22, 23, 24, 31, 32, 33, 34,
               6, 7, 8, 9, 16, 17, 18, 19, 26, 27, 28, 29]


def tile(sheet, index):
    x = (index % TILESET_COLS) * TILE
    y = (index // TILESET_COLS) * TILE
    return sheet.crop((x, y, x + TILE, y + TILE))


def build_room(rng, cols=SIZE // TILE, rows=SIZE // TILE):
    """Sala fechada de cols x rows tiles (paredes nas bordas, piso sorteado)."""
    sheet = Image.open(asset("tileset", "tileset.png")).convert("RGBA")
    room = Image.new("RGBA", (cols * TILE, rows * TILE), (20, 14, 24, 255))
    n, m = cols, rows
    top = [1, 2, 3, 4]
    bottom = [41, 42, 43, 44]
    left = [10, 20, 30]
    right = [15, 25, 35]
    for ty in range(m):
        for tx in range(n):
            if ty == 0:
                idx = 0 if tx == 0 else 5 if tx == n - 1 else top[(tx - 1) % 4]
            elif ty == m - 1:
                idx = 40 if tx == 0 else 45 if tx == n - 1 else bottom[(tx - 1) % 4]
            elif tx == 0:
                idx = left[(ty - 1) % 3]
            elif tx == n - 1:
                idx = right[(ty - 1) % 3]
            else:
                idx = rng.choice(FLOOR_TILES)
            t = tile(sheet, idx)
            room.alpha_composite(t, (tx * TILE, ty * TILE))
    return room


# ---------------------------------------------------------------------------
# Sangue no chão (formas desenhadas na grade nativa)
# ---------------------------------------------------------------------------
BLOOD_DARK = (74, 10, 22, 255)
BLOOD_MID = (122, 20, 38, 255)
BLOOD_LIGHT = (154, 38, 56, 255)   # mesmo tom do sangue da serra no jogo
BLOOD_SHINE = (204, 82, 92, 255)


def blob(img, cx, cy, rx, ry, rng):
    """Poça irregular: elipse com borda ruidosa, contorno escuro e brilho."""
    px = img.load()
    cells = set()
    for y in range(cy - ry - 1, cy + ry + 2):
        for x in range(cx - rx - 1, cx + rx + 2):
            d = ((x - cx) / max(rx, 0.5)) ** 2 + ((y - cy) / max(ry, 0.5)) ** 2
            if d <= 1.0 + rng.uniform(-0.25, 0.2):
                cells.add((x, y))
    def is_edge(x, y):
        return any((x + dx, y + dy) not in cells
                   for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))

    edges = {c for c in cells if is_edge(*c)}
    for c in cells:
        px[c] = BLOOD_DARK if c in edges else BLOOD_MID
    # faixa clara logo abaixo da borda superior-esquerda (volume da poça)
    for (x, y) in cells - edges:
        if (x, y - 1) in edges and x < cx:
            px[x, y] = BLOOD_LIGHT
    if rx >= 3:
        px[cx - rx // 2, cy - max(ry // 2, 1)] = BLOOD_SHINE


def drops(img, cx, cy, radius, count, rng):
    px = img.load()
    for _ in range(count):
        a = rng.uniform(0, math.tau)
        r = rng.uniform(radius * 0.5, radius)
        x, y = int(round(cx + math.cos(a) * r)), int(round(cy + math.sin(a) * r * 0.6))
        color = rng.choice([BLOOD_MID, BLOOD_DARK, BLOOD_LIGHT])
        extra = rng.random() < 0.35
        if not (0 <= x < img.width - 1 and 0 <= y < img.height):
            continue   # gota fora da imagem (sorteios já feitos: seed estável)
        px[x, y] = color
        if extra:
            px[x + 1, y] = BLOOD_DARK


# ---------------------------------------------------------------------------
# Luz + vinheta quantizadas (4 faixas, dithering Bayer 4x4)
# ---------------------------------------------------------------------------
BAYER4 = [[0, 8, 2, 10],
          [12, 4, 14, 6],
          [3, 11, 1, 9],
          [15, 7, 13, 5]]
# (multiplicador RGB) por faixa: 0 = sombra fria/roxa, 3 = luz quente de tocha
BANDS = [(0.30, 0.26, 0.40),
         (0.55, 0.48, 0.62),
         (0.85, 0.74, 0.70),
         (1.18, 0.98, 0.78)]
LIGHT_CENTER = (64, 80)


def light_level(x, y):
    """Nível contínuo 0..3: luz quente central menos a vinheta das bordas."""
    lx, ly = LIGHT_CENTER
    d = math.hypot((x - lx) / 1.15, (y - ly))
    warm = max(0.0, 1.0 - d / 62.0)
    cx, cy = (x - 63.5) / 64, (y - 63.5) / 64
    vignette = min(1.0, (cx * cx + cy * cy) ** 1.4)
    return max(0.0, min(3.0, 3.0 * (0.30 + warm * 0.95) - 2.2 * vignette))


def apply_lighting(img, level=light_level):
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            v = level(x, y)
            base = int(v)
            threshold = (BAYER4[y % 4][x % 4] + 0.5) / 16
            band = min(3, base + (1 if (v - base) > threshold else 0))
            m = BANDS[band]
            r, g, b, a = px[x, y]
            px[x, y] = (min(255, int(r * m[0])), min(255, int(g * m[1])),
                        min(255, int(b * m[2])), a)


# ---------------------------------------------------------------------------
# Heróis e serra (sprites reais, escala 1x)
# ---------------------------------------------------------------------------
PLAYER_BOX = (41, 39, 59, 60)   # recorte do frame 0 (célula 100x100) c/ sombra
ROPE_ANCHOR = (9, 13)           # ponto de amarra relativo ao recorte (cintura)


def hero(folder, expression):
    sheet = Image.open(asset(folder, "expressions", f"{expression}.png")).convert("RGBA")
    return sheet.crop(PLAYER_BOX)


def saw_still_bloody():
    # SawWeapon.js: ROW_INERTIA_BLOODY = 1, INERTIA_FRAME = 3 (disco parado)
    sheet = Image.open(asset("saw", "saw.png")).convert("RGBA")
    return sheet.crop((48, 16, 64, 32))


# ---------------------------------------------------------------------------
# Corda: curva quadrática rasterizada na grade nativa
# ---------------------------------------------------------------------------
ROPE_OUTLINE = (10, 10, 12, 255)      # cores tiradas de assets/saw/rope.png
ROPE_LIGHT = (32, 32, 36, 255)
ROPE_DARK = (18, 18, 20, 255)


def rope_pixels(p0, mid, p2):
    """Pixels (x, y) únicos da curva que passa por p0 -> mid -> p2."""
    cx = 2 * mid[0] - 0.5 * (p0[0] + p2[0])
    cy = 2 * mid[1] - 0.5 * (p0[1] + p2[1])
    seen, path = set(), []
    steps = 600
    for i in range(steps + 1):
        t = i / steps
        x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * cx + t * t * p2[0]
        y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * cy + t * t * p2[1]
        p = (int(round(x)), int(round(y)))
        if p not in seen:
            seen.add(p)
            path.append(p)
    return path


def draw_rope(img, path):
    """Miolo de 2px (trançado alternando a cada 3px) + contorno de 1px."""
    px = img.load()
    core = {}
    for i, (x, y) in enumerate(path):
        braid = (i // 3) % 2
        core[(x, y)] = ROPE_LIGHT if braid == 0 else ROPE_DARK
        core[(x, y + 1)] = ROPE_DARK if braid == 0 else ROPE_LIGHT
    for (x, y) in core:
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                q = (x + dx, y + dy)
                if q not in core and 0 <= q[0] < img.width and 0 <= q[1] < img.height:
                    px[q] = ROPE_OUTLINE
    for q, c in core.items():
        if 0 <= q[0] < img.width and 0 <= q[1] < img.height:
            px[q] = c


# ---------------------------------------------------------------------------
# Fonte bitmap chunky
# ---------------------------------------------------------------------------
# Grade 5x7 com colunas/linhas de larguras variadas -> traços grossos (3px)
# nas bordas e no meio, glifo final de 14x16 pixels de arte.
COL_W = [3, 3, 2, 3, 3]
ROW_H = [3, 2, 2, 2, 2, 2, 3]
GLYPHS = {
    "D": ["XXXX.", "X...X", "X...X", "X...X", "X...X", "X...X", "XXXX."],
    "U": ["X...X", "X...X", "X...X", "X...X", "X...X", "X...X", ".XXX."],
    "N": ["X...X", "XX..X", "XX..X", "X.X.X", "X..XX", "X..XX", "X...X"],
    "G": [".XXXX", "X....", "X....", "X.XXX", "X...X", "X...X", ".XXX."],
    "E": ["XXXXX", "X....", "X....", "XXXX.", "X....", "X....", "XXXXX"],
    "O": [".XXX.", "X...X", "X...X", "X...X", "X...X", "X...X", ".XXX."],
    "C": [".XXXX", "X....", "X....", "X....", "X....", "X....", ".XXXX"],
    "H": ["X...X", "X...X", "X...X", "XXXXX", "X...X", "X...X", "X...X"],
    "A": [".XXX.", "X...X", "X...X", "XXXXX", "X...X", "X...X", "X...X"],
    "I": ["XXXXX", "..X..", "..X..", "..X..", "..X..", "..X..", "XXXXX"],
}
GLYPH_W, GLYPH_H = sum(COL_W), sum(ROW_H)
LETTER_GAP = 2
LINE_GAP = 5

TITLE_OUTLINE = (31, 26, 26, 255)
TITLE_SHADOW = (12, 6, 16, 255)
TITLE_SHINE = (255, 248, 206, 255)
# gradiente vertical de tocha (topo -> base), 4 faixas de 4 linhas
TITLE_GRADIENT = [(255, 222, 110, 255), (255, 178, 58, 255),
                  (236, 120, 34, 255), (178, 66, 26, 255)]


def glyph_mask(ch):
    rows = GLYPHS[ch]
    cells = set()
    y0 = 0
    for r, h in enumerate(ROW_H):
        x0 = 0
        for c, w in enumerate(COL_W):
            if rows[r][c] == "X":
                for yy in range(y0, y0 + h):
                    for xx in range(x0, x0 + w):
                        cells.add((xx, yy))
            x0 += w
        y0 += h
    return cells


def text_mask(text, ox, oy):
    """Pixels preenchidos da linha + y relativo (para o gradiente)."""
    cells = {}
    x = ox
    for ch in text:
        for (gx, gy) in glyph_mask(ch):
            cells[(x + gx, oy + gy)] = gy
        x += GLYPH_W + LETTER_GAP
    return cells


def draw_title(img, lines, top):
    px = img.load()
    fill = {}
    y = top
    for line in lines:
        width = len(line) * GLYPH_W + (len(line) - 1) * LETTER_GAP
        fill.update(text_mask(line, (SIZE - width) // 2, y))
        y += GLYPH_H + LINE_GAP

    outline = set()
    for (x, y) in fill:
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                q = (x + dx, y + dy)
                if q not in fill:
                    outline.add(q)
    shape = set(fill) | outline

    # sombra projetada (1 direita, 2 abaixo) por baixo de tudo
    for (x, y) in shape:
        for sx, sy in ((1, 1), (1, 2), (0, 2)):
            q = (x + sx, y + sy)
            if q not in shape and 0 <= q[0] < SIZE and 0 <= q[1] < SIZE:
                px[q] = TITLE_SHADOW
    for q in outline:
        px[q] = TITLE_OUTLINE
    for (x, y), gy in fill.items():
        px[x, y] = TITLE_GRADIENT[min(3, gy * 4 // GLYPH_H)]
        # bisel: pixel de borda superior ganha brilho
        if (x, y - 1) not in fill:
            px[x, y] = TITLE_SHINE


# ---------------------------------------------------------------------------
def main():
    rng = random.Random(SEED)
    img = build_room(rng)

    # Posições na grade nativa
    p1_pos = (26, 60)
    p2_pos = (84, 60)
    saw_center = (64, 90)

    # Sangue no chão (antes da luz, para ser iluminado junto com o piso)
    blob(img, 64, 99, 9, 3, rng)
    blob(img, 48, 94, 3, 1, rng)
    blob(img, 82, 97, 4, 2, rng)
    drops(img, 64, 96, 22, 18, rng)

    apply_lighting(img)

    a1 = (p1_pos[0] + ROPE_ANCHOR[0], p1_pos[1] + ROPE_ANCHOR[1])
    a2 = (p2_pos[0] + ROPE_ANCHOR[0], p2_pos[1] + ROPE_ANCHOR[1])
    draw_rope(img, rope_pixels(a1, (saw_center[0], saw_center[1] - 1), a2))

    saw = saw_still_bloody()
    img.alpha_composite(saw, (saw_center[0] - 8, saw_center[1] - 8))

    img.alpha_composite(hero("player_01", "furia"), p1_pos)
    img.alpha_composite(hero("player_02", "assustado"), p2_pos)

    draw_title(img, ["DUNGEON", "CHAINED"], 7)

    os.makedirs(OUT_DIR, exist_ok=True)
    native = img.convert("RGB")
    native.save(os.path.join(OUT_DIR, "keyart_128.png"))
    native.resize((SIZE * SCALE, SIZE * SCALE), Image.NEAREST).save(
        os.path.join(OUT_DIR, "keyart_1024.png"))

    # Logo sozinha (fundo transparente, resolução nativa, recortada justa):
    # usada pelo trailer (tela de entrada e cartela) ampliada em escala inteira.
    logo = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw_title(logo, ["DUNGEON", "CHAINED"], 7)
    logo = logo.crop(logo.getbbox())
    logo.save(os.path.join(OUT_DIR, "logo.png"))
    print("ok:", os.path.join(OUT_DIR, "keyart_1024.png"), "| logo", logo.size)

    make_cover(logo)


# ---------------------------------------------------------------------------
# Capa 630x500 (itch.io): heróis e serra em destaque
# ---------------------------------------------------------------------------
# Três camadas, cada uma na SUA grade de pixel e ampliada por escala inteira
# (vizinho-mais-próximo) — dentro de cada camada todo pixel tem o mesmo
# tamanho; os heróis/serra/corda ficam maiores que o cenário de propósito.
COVER_W, COVER_H = 630, 500
COVER_BG_SCALE = 3      # cenário: tile de 16px vira 48px
COVER_HERO_SCALE = 9    # heróis, corda e serra: herói ~189px, serra 144px
COVER_LOGO_SCALE = 4    # logo: 452x164
COVER_BG_CROP = (7, 9)  # recorte da sala 14x12 tiles (parede de baixo fora do quadro) -> 210x167 px de arte


def cover_level(x, y):
    """Luz quente atrás dos heróis + vinheta (grade do cenário, 210x167)."""
    lx, ly = 105, 104
    d = math.hypot((x - lx) / 1.6, (y - ly))
    warm = max(0.0, 1.0 - d / 78.0)
    cx, cy = (x - 104.5) / 105, (y - 83) / 84
    vignette = min(1.0, (cx * cx + cy * cy) ** 1.4)
    return max(0.0, min(3.0, 3.0 * (0.26 + warm * 1.0) - 2.3 * vignette))


def bloody(img, rng, toward, clusters=4):
    """Respingos de sangue no corpo do herói (na grade nativa do sprite).

    Só pinta pixels OPACOS do personagem (a sombra semitransparente fica
    limpa) e preserva o contorno escuro, para a silhueta continuar legível.
    `toward` = +1 se a serra está à direita do sprite, -1 à esquerda: a
    maioria dos respingos cai no lado virado para ela.
    """
    px = img.load()
    w, h = img.size

    def body(x, y):
        if not (0 <= x < w and 0 <= y < h):
            return False
        r, g, b, a = px[x, y]
        return a == 255 and (0.299 * r + 0.587 * g + 0.114 * b) > 42

    # Olhos (quase brancos) ficam sempre limpos: a expressão precisa ler.
    def paintable(x, y):
        if not body(x, y):
            return False
        r, g, b, _ = px[x, y]
        return min(r, g, b) < 200

    cells = [(x, y) for y in range(h) for x in range(w) if paintable(x, y)]
    if not cells:
        return img
    mid = w / 2
    top = min(y for _, y in cells)
    # Respingos maiores só no corpo (abaixo da cabeça), no lado da serra.
    torso = [c for c in cells if c[1] >= top + 9 and (c[0] - mid) * toward >= -1]
    head = [c for c in cells if top + 2 <= c[1] < top + 9 and (c[0] - mid) * toward >= 1]
    for _ in range(clusters):
        cx, cy = rng.choice(torso)
        size = rng.choice([1, 1, 2])
        for (x, y) in torso:
            dx, dy = x - cx, y - cy
            if dx * dx + dy * dy <= size:
                px[x, y] = rng.choice([BLOOD_MID, BLOOD_MID, BLOOD_LIGHT, BLOOD_DARK])
        # escorrido: 1-2 px para baixo a partir do respingo
        for k in range(rng.choice([0, 1, 2])):
            if paintable(cx, cy + 1 + k):
                px[cx, cy + 1 + k] = BLOOD_DARK
    # Respingo pequeno no rosto (bochecha do lado da serra) + gotinhas soltas.
    for (x, y) in rng.sample(head, min(3, len(head))):
        px[x, y] = rng.choice([BLOOD_MID, BLOOD_LIGHT])
    for (x, y) in rng.sample(torso, min(4, len(torso))):
        px[x, y] = rng.choice([BLOOD_LIGHT, BLOOD_SHINE])
    return img


def make_cover(logo):
    rng = random.Random(SEED + 1)

    # 1) Cenário (escala 3): sala, sangue no chão e luz quantizada.
    bw = -(-COVER_W // COVER_BG_SCALE)          # 210
    bh = -(-COVER_H // COVER_BG_SCALE)          # 167
    ox, oy = COVER_BG_CROP
    bg = build_room(rng, cols=14, rows=12).crop((ox, oy, ox + bw, oy + bh))
    blob(bg, 105, 157, 19, 4, rng)               # poça sob a serra
    blob(bg, 62, 150, 4, 2, rng)
    blob(bg, 150, 153, 5, 2, rng)
    drops(bg, 105, 152, 44, 40, rng)
    apply_lighting(bg, cover_level)

    # 2) Heróis + corda + serra (escala 9), 70x56 px de arte. A serra fica
    #    colada entre os dois (corda curta, quase só a curva).
    hw = -(-COVER_W // COVER_HERO_SCALE)        # 70
    hh = -(-COVER_H // COVER_HERO_SCALE)        # 56
    heroes = Image.new("RGBA", (hw, hh), (0, 0, 0, 0))
    p1_pos, p2_pos = (6, 21), (46, 21)
    saw_center = (35, 45)
    # Sujos de sangue (mais do lado virado para a serra).
    p1 = bloody(hero("player_01", "furia"), rng, toward=+1)
    # P2 espelhado: os dois olham para o centro (para a serra).
    p2 = bloody(hero("player_02", "assustado").transpose(Image.FLIP_LEFT_RIGHT), rng, toward=-1)
    a1 = (p1_pos[0] + ROPE_ANCHOR[0], p1_pos[1] + ROPE_ANCHOR[1])
    a2 = (p2_pos[0] + (p2.width - 1 - ROPE_ANCHOR[0]), p2_pos[1] + ROPE_ANCHOR[1])
    draw_rope(heroes, rope_pixels(a1, (saw_center[0], saw_center[1] - 1), a2))
    heroes.alpha_composite(p1, p1_pos)
    heroes.alpha_composite(p2, p2_pos)
    heroes.alpha_composite(saw_still_bloody(), (saw_center[0] - 8, saw_center[1] - 8))

    # 3) Composição final 630x500.
    out = bg.resize((bw * COVER_BG_SCALE, bh * COVER_BG_SCALE), Image.NEAREST)
    out = out.crop((0, 0, COVER_W, COVER_H))
    big = heroes.resize((hw * COVER_HERO_SCALE, hh * COVER_HERO_SCALE), Image.NEAREST)
    out.alpha_composite(big.crop((0, 0, COVER_W, COVER_H)))
    lg = logo.resize((logo.width * COVER_LOGO_SCALE, logo.height * COVER_LOGO_SCALE), Image.NEAREST)
    out.alpha_composite(lg, ((COVER_W - lg.width) // 2, 12))

    path = os.path.join(OUT_DIR, "cover_630x500.png")
    out.convert("RGB").save(path)
    print("ok:", path, out.size)


if __name__ == "__main__":
    main()
