"""Boss gate opening sheet v4: 48x48 art px per frame, 2x2 grid, native scale.

Every colour is taken from assets/tileset/tileset.png. The stone ring is identical
in all frames; only the portcullis and skull lock rise behind the lintel.
Run from the repo root: python .agents/tasks/2026-10-27-boss-gate-redesign/gen_boss_gate_v4.py
"""
from PIL import Image

def hexc(h):
    return (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), 255)

CLEAR = (0, 0, 0, 0)
OUTLINE = hexc('#0b0608')
MORTAR = hexc('#25131a')
ST_HI = hexc('#593756')
ST_FACE = hexc('#4c2f49')
ST_BASE = hexc('#3d253b')
ST_SHADE = hexc('#362030')
TRIM_HI = hexc('#78514f')
TRIM = hexc('#6e4a48')
TRIM_SH = hexc('#523b40')
VOID = hexc('#0b0608')
VOID_DEEP = hexc('#050304')
VOID_FLOOR = hexc('#170c10')
IRON_HI = hexc('#bf704d')
IRON = hexc('#895a45')
IRON_SH = hexc('#724736')
GOLD = hexc('#c09344')
GOLD_HI = hexc('#ffd569')
BONE_HI = hexc('#d3d4a7')
BONE = hexc('#b19d83')
BONE_SH = hexc('#927a5d')
EMBER = hexc('#d1851e')
RED = hexc('#bc4c51')
RED_HI = hexc('#cf686d')

W = H = 48
OPEN_X0, OPEN_X1 = 8, 39
OPEN_Y0, OPEN_Y1 = 13, 42


def blank():
    return [[CLEAR] * W for _ in range(H)]


def put(f, x, y, c):
    if 0 <= x < W and 0 <= y < H:
        f[y][x] = c


def rect(f, x0, y0, x1, y1, c):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            put(f, x, y, c)


def in_silhouette(x, y):
    if y <= 2:
        return 18 <= x <= 29 and y >= 0
    if y <= 4:
        return 2 <= x <= 45
    return 0 <= x <= 47


def in_opening(x, y):
    if not (OPEN_X0 <= x <= OPEN_X1 and OPEN_Y0 <= y <= OPEN_Y1):
        return False
    corbel = {(0, 0), (1, 0), (0, 1)}
    if (x - OPEN_X0, y - OPEN_Y0) in corbel or (OPEN_X1 - x, y - OPEN_Y0) in corbel:
        return False
    return True


def block(f, x0, y0, x1, y1, face=ST_FACE, hi=ST_HI, shade=ST_SHADE):
    rect(f, x0, y0, x1, y1, face)
    rect(f, x0, y0, x1, y0, hi)
    rect(f, x0, y0, x0, y1 - 1, hi)
    rect(f, x0, y1, x1, y1, shade)
    rect(f, x1, y0 + 1, x1, y1, shade)


def trim_block(f, x0, y0, x1, y1):
    rect(f, x0, y0, x1, y1, TRIM)
    rect(f, x0, y0, x1, y0, TRIM_HI)
    rect(f, x0, y1, x1, y1, TRIM_SH)
    rect(f, x1, y0 + 1, x1, y1, TRIM_SH)


def mirror_x(x0, x1):
    return W - 1 - x1, W - 1 - x0


def strap(f, x0, x1, y):
    rect(f, x0, y, x1, y, IRON_HI)
    rect(f, x0, y + 1, x1, y + 1, IRON)
    rect(f, x0, y + 2, x1, y + 2, IRON_SH)
    for x in (x0 + 2, x1 - 2):
        put(f, x, y + 1, GOLD_HI)
        put(f, x, y + 2, GOLD)


def draw_stone(f):
    for y in range(H):
        for x in range(W):
            if in_silhouette(x, y) and not in_opening(x, y):
                f[y][x] = MORTAR

    pillar_rows = [(13, 22), (24, 33), (35, 42)]
    for side in (0, 1):
        def bx(x0, x1):
            return mirror_x(x0, x1) if side else (x0, x1)
        cap = bx(1, 9)
        block(f, cap[0], 4, cap[1], 11)
        vous = bx(11, 17)
        block(f, vous[0], 4, vous[1], 11)
        col = bx(1, 6)
        for y0, y1 in pillar_rows:
            block(f, col[0], y0, col[1], y1)
        sx = bx(0, 7)
        strap(f, sx[0], sx[1], 22)
        strap(f, sx[0], sx[1], 33)
        edge = W - 1 - OPEN_X0 if side else OPEN_X0
        step = -1 if side else 1
        put(f, edge, OPEN_Y0, ST_FACE)
        put(f, edge + step, OPEN_Y0, ST_SHADE)
        put(f, edge, OPEN_Y0 + 1, ST_SHADE)

    block(f, 19, 1, 28, 11)
    rect(f, 22, 4, 25, 8, MORTAR)
    rect(f, 23, 4, 24, 4, RED_HI)
    rect(f, 22, 5, 25, 6, RED)
    put(f, 22, 5, RED_HI)
    rect(f, 23, 7, 24, 7, RED)
    put(f, 25, 6, IRON_SH)
    put(f, 24, 7, IRON_SH)

    for x0, x1 in [(1, 15), (17, 30), (32, 46)]:
        trim_block(f, x0, 44, x1, 46)

    for x, y in [(3, 16), (4, 17), (4, 18), (5, 19)]:
        put(f, x, y, ST_SHADE)
    for x, y in [(43, 27), (42, 28), (42, 29)]:
        put(f, x, y, ST_SHADE)
    for x, y in [(13, 7), (14, 8)]:
        put(f, x, y, ST_SHADE)
    for x, y in [(2, 38), (3, 38)]:
        put(f, x, y, ST_BASE)


def draw_void(f):
    for y in range(OPEN_Y0, OPEN_Y1 + 1):
        for x in range(OPEN_X0, OPEN_X1 + 1):
            if in_opening(x, y):
                c = VOID_DEEP if y <= OPEN_Y0 + 2 else VOID
                if y >= OPEN_Y1 - 1:
                    c = VOID_FLOOR
                f[y][x] = c


SKULL = [
    "...OOOOOO...",
    ".OOHHHHHHOO.",
    ".OHHHHHHHMO.",
    "OHHHMMMMMMSO",
    "OHDDDMMDDDSO",
    "OMDYDMMDYDSO",
    "OMDEDMMDEDSO",
    "OSMMMKKMMMSO",
    ".OSSMKKMSSO.",
    "..OMOMMOMO..",
    "..OSOSSOSO..",
    "...OOOOOO...",
]
SKULL_COLORS = {'O': MORTAR, 'H': BONE_HI, 'M': BONE, 'S': BONE_SH,
                'D': VOID_DEEP, 'Y': GOLD_HI, 'E': EMBER, 'K': VOID_DEEP}

BAR_X = [8, 15, 22, 29, 36]
BAND_Y = [22, 33]


def portcullis_layer():
    layer = {}
    for bx in BAR_X:
        for y in range(OPEN_Y0, OPEN_Y1 + 1):
            cols = [IRON_HI, IRON, IRON, IRON_SH]
            if y == OPEN_Y1:
                cols = [None, IRON, IRON_SH, None]
            for i, c in enumerate(cols):
                if c:
                    layer[(bx + i, y)] = c
        for y in range(OPEN_Y0 + 3, OPEN_Y1 - 2, 6):
            layer[(bx + 2, y + (bx // 7) % 3)] = IRON_SH
    for by in BAND_Y:
        for x in range(OPEN_X0, OPEN_X1 + 1):
            layer[(x, by)] = IRON_HI
            layer[(x, by + 1)] = IRON
            layer[(x, by + 2)] = IRON_SH
            if (x, by + 3) not in layer:
                layer[(x, by + 3)] = MORTAR
        for bx in BAR_X:
            layer[(bx + 1, by + 1)] = GOLD_HI
            layer[(bx + 2, by + 1)] = GOLD

    sx0, sy0 = 18, 19
    for j, row in enumerate(SKULL):
        for i, ch in enumerate(row):
            if ch != '.':
                layer[(sx0 + i, sy0 + j)] = SKULL_COLORS[ch]
    return layer


DARKEN = {IRON_HI: IRON_SH, IRON: IRON_SH, IRON_SH: MORTAR, GOLD_HI: GOLD, GOLD: IRON_SH,
          BONE_HI: BONE_SH, BONE: BONE_SH, BONE_SH: IRON_SH}


def draw_portcullis(f, shift):
    for (x, y), c in portcullis_layer().items():
        ty = y - shift
        if in_opening(x, ty):
            if ty == OPEN_Y0:
                c = DARKEN.get(c, c)
            f[ty][x] = c


def draw_outline(f):
    for y in range(H):
        for x in range(W):
            if not in_silhouette(x, y):
                f[y][x] = CLEAR
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if not (0 <= nx < W and 0 <= ny < H) or not in_silhouette(nx, ny):
                    f[y][x] = OUTLINE
                    break


def build(shift):
    f = blank()
    draw_stone(f)
    draw_void(f)
    draw_portcullis(f, shift)
    draw_outline(f)
    return f


def main():
    shifts = [0, 11, 22, 31]
    sheet = Image.new('RGBA', (W * 2, H * 2), CLEAR)
    for i, s in enumerate(shifts):
        f = build(s)
        ox, oy = (i % 2) * W, (i // 2) * H
        for y in range(H):
            for x in range(W):
                sheet.putpixel((ox + x, oy + y), f[y][x])
    out = 'assets/doors/boss-gate-opening-sheet-v4.png'
    sheet.save(out)
    print('wrote', out, sheet.size)


if __name__ == '__main__':
    main()
