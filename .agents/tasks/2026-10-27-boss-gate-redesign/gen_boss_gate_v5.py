"""Boss gate opening strip v5: four 32x32 frames side by side (128x32), native scale.

The gate covers the two-tile doorway of the north wall. Its bottom half is the wall
row itself: rows 16..31 reuse the brick rows of the wall tile (tileset index 1), so
the wall flows into the gate pillars without a seam. The top half is an arched crown
built from the same bricks and brown cap. Only the portcullis and skull move.
Run from the repo root: python .agents/tasks/2026-10-27-boss-gate-redesign/gen_boss_gate_v5.py
"""
from PIL import Image

def hexc(h):
    return (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), 255)

CLEAR = (0, 0, 0, 0)
A, B = hexc('#4c2f49'), hexc('#593756')
CAP, CAP_HI, CAP_SH = hexc('#6e4a48'), hexc('#78514f'), hexc('#523b40')
EDGE, FACE, CORNER = hexc('#3d253b'), hexc('#543740'), hexc('#483040')
MORTAR = hexc('#25131a')
VOID_DEEP, VOID, VOID_FLOOR = hexc('#050304'), hexc('#0b0608'), hexc('#170c10')
IRON_HI, IRON, IRON_SH = hexc('#bf704d'), hexc('#895a45'), hexc('#724736')
GOLD, GOLD_HI = hexc('#c09344'), hexc('#ffd569')
BONE_HI, BONE, BONE_SH = hexc('#d3d4a7'), hexc('#b19d83'), hexc('#927a5d')
EMBER, RED, RED_HI = hexc('#d1851e'), hexc('#bc4c51'), hexc('#cf686d')

W = H = 32
WALL_Y = 16
OPEN_X0, OPEN_X1, OPEN_Y0, OPEN_Y1 = 5, 26, 12, 30
KEY_X0, KEY_X1 = 12, 19


def blank():
    return [[CLEAR] * W for _ in range(H)]


def put(f, x, y, c):
    if 0 <= x < W and 0 <= y < H:
        f[y][x] = c


def rect(f, x0, y0, x1, y1, c):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            put(f, x, y, c)


def in_crown(x, y):
    if y < 3:
        return KEY_X0 <= x <= KEY_X1
    if y == 3:
        return 1 <= x <= 30
    return y < WALL_Y


def in_opening(x, y):
    if not (OPEN_X0 <= x <= OPEN_X1 and OPEN_Y0 <= y <= OPEN_Y1):
        return False
    return not (y == OPEN_Y0 and (x < OPEN_X0 + 2 or x > OPEN_X1 - 2))


def wall_rows():
    t = Image.open('assets/tileset/tileset.png').convert('RGBA')
    return [[t.getpixel((16 + x, y)) for x in range(16)] for y in range(16)]


def brick(f, x0, y0, x1, y1):
    rect(f, x0, y0, x1, y1, FACE)
    for x, y in ((x0, y0), (x1, y0), (x0, y1), (x1, y1)):
        put(f, x, y, CORNER)


def cap_block(f, x0, y0, x1, y1):
    rect(f, x0, y0, x1, y1, CAP)
    rect(f, x0, y1, x1, y1, CAP_HI)
    put(f, x1, y0, CAP_SH)


def draw_wall_half(f):
    rows = wall_rows()
    left = [0, 1, 2, 3, 15]
    right = [0, 12, 13, 14, 15]
    for y in range(16):
        for i, sx in enumerate(left):
            put(f, i, WALL_Y + y, rows[y][sx])
        for i, sx in enumerate(right):
            put(f, 27 + i, WALL_Y + y, rows[y][sx])
        for x in range(5, 27):
            put(f, x, WALL_Y + y, rows[y][(x + 5) % 16])


def draw_crown(f):
    for y in range(WALL_Y):
        for x in range(W):
            if in_crown(x, y):
                f[y][x] = MORTAR
    for x0, x1 in [(1, 6), (8, 10), (21, 23), (25, 30)]:
        cap_block(f, x0, 4, x1, 6)
    for x0, x1 in [(1, 4), (6, 10), (21, 25), (27, 30)]:
        brick(f, x0, 8, x1, 10)
    for x0, x1 in [(1, 3), (28, 30)]:
        brick(f, x0, 12, x1, 15)
    rect(f, 4, 12, 4, 15, EDGE)
    rect(f, 27, 12, 27, 15, EDGE)
    for x in (OPEN_X0, OPEN_X0 + 1):
        put(f, x, OPEN_Y0, CORNER)
        put(f, W - 1 - x, OPEN_Y0, CORNER)

    cap_block(f, KEY_X0 + 1, 1, KEY_X1 - 1, 10)
    rect(f, 14, 4, 17, 7, MORTAR)
    rect(f, 15, 4, 16, 4, RED_HI)
    rect(f, 14, 5, 17, 6, RED)
    put(f, 14, 5, RED_HI)
    rect(f, 15, 7, 16, 7, RED)
    put(f, 17, 6, IRON_SH)

    for y in range(WALL_Y):
        for x in range(W):
            if not in_crown(x, y):
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, -1)):
                nx, ny = x + dx, y + dy
                if not (0 <= nx < W and 0 <= ny) or (ny < WALL_Y and not in_crown(nx, ny)):
                    f[y][x] = MORTAR
                    break


def draw_void(f):
    for y in range(OPEN_Y0, OPEN_Y1 + 1):
        for x in range(OPEN_X0, OPEN_X1 + 1):
            if in_opening(x, y):
                f[y][x] = VOID_DEEP if y <= OPEN_Y0 + 1 else VOID_FLOOR if y == OPEN_Y1 else VOID


SKULL = [
    "..OOOOOO..",
    ".OHHHHHMO.",
    "OHHHHHMMSO",
    "OHDDMMDDSO",
    "OMDYMMYDSO",
    "OSMMKKMMSO",
    ".OSMKKMSO.",
    ".OMOMMOMO.",
    "..OOOOOO..",
]
SKULL_COLORS = {'O': MORTAR, 'H': BONE_HI, 'M': BONE, 'S': BONE_SH,
                'D': VOID_DEEP, 'Y': GOLD_HI, 'K': VOID_DEEP}
BAR_X = [7, 12, 17, 22]
BAND_Y = [17, 25]


def portcullis_layer():
    layer = {}
    for bx in BAR_X:
        for y in range(OPEN_Y0, OPEN_Y1 + 1):
            cols = [IRON_HI, IRON, IRON_SH] if y < OPEN_Y1 else [None, IRON, None]
            for i, c in enumerate(cols):
                if c:
                    layer[(bx + i, y)] = c
    for by in BAND_Y:
        for x in range(OPEN_X0, OPEN_X1 + 1):
            layer[(x, by)] = IRON_HI
            layer[(x, by + 1)] = IRON_SH
            layer.setdefault((x, by + 2), MORTAR)
        for bx in BAR_X:
            layer[(bx + 1, by)] = GOLD_HI
            layer[(bx + 1, by + 1)] = GOLD
    for j, row in enumerate(SKULL):
        for i, ch in enumerate(row):
            if ch != '.':
                layer[(11 + i, 15 + j)] = SKULL_COLORS[ch]
    return layer


DARKEN = {IRON_HI: IRON_SH, IRON: IRON_SH, IRON_SH: MORTAR, GOLD_HI: GOLD, GOLD: IRON_SH,
          BONE_HI: BONE_SH, BONE: BONE_SH, BONE_SH: IRON_SH}


def draw_portcullis(f, shift):
    for (x, y), c in portcullis_layer().items():
        ty = y - shift
        if in_opening(x, ty):
            f[ty][x] = DARKEN.get(c, c) if ty == OPEN_Y0 else c


def build(shift):
    f = blank()
    draw_wall_half(f)
    draw_crown(f)
    draw_void(f)
    draw_portcullis(f, shift)
    return f


def main():
    shifts = [0, 7, 13, 19]
    sheet = Image.new('RGBA', (W * 4, H), CLEAR)
    for i, s in enumerate(shifts):
        f = build(s)
        for y in range(H):
            for x in range(W):
                sheet.putpixel((i * W + x, y), f[y][x])
    out = 'assets/doors/boss-gate-opening-strip-v5.png'
    sheet.save(out)
    print('wrote', out, sheet.size)


if __name__ == '__main__':
    main()
