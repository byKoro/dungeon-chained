"""Boss gate opening strip v8: v7 (hand-edited) with a see-through passage.

The opening behind the portcullis is transparent and the bars cast no shadow band, so
the floor or corridor behind the gate shows through. Drawing code below is v7's and is
used only as the mask; the pixels come from the edited v7 PNG.

Four 32x32 frames side by side (128x32), native scale.

Keeps the 2.5D top-down look of the tileset walls: every raised mass shows a brown
top surface (outlined plum, lighter lip on the front edge) above a darker brick
front face. The gate is a block taller than the north wall:
  rows 1..7   top surface of the gate (slabs + raised keystone)
  rows 8..19  front face above the wall line (lintel + pillar courses)
  rows 20..31 front face that is the wall row itself (copied from tile 1), so the
              wall's brick courses run straight into the gate pillars.
Only the portcullis and skull lock move.
Run from the repo root: python .agents/tasks/2026-10-27-boss-gate-redesign/gen_boss_gate_v8.py
"""
from PIL import Image

def hexc(h):
    return (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), 255)

CLEAR = (0, 0, 0, 0)
TOP_LINE, TOP_LINE_HI = hexc('#4c2f49'), hexc('#593756')
CAP, CAP_HI, CAP_SH = hexc('#6e4a48'), hexc('#78514f'), hexc('#523b40')
EDGE, FACE, CORNER = hexc('#3d253b'), hexc('#543740'), hexc('#483040')
LOW, LOW_SH = hexc('#4f3740'), hexc('#422c3b')
MORTAR = hexc('#25131a')
VOID_DEEP, VOID, VOID_FLOOR = hexc('#050304'), hexc('#0b0608'), hexc('#170c10')
IRON_HI, IRON, IRON_SH = hexc('#bf704d'), hexc('#895a45'), hexc('#724736')
GOLD, GOLD_HI = hexc('#c09344'), hexc('#ffd569')
BONE_HI, BONE, BONE_SH = hexc('#d3d4a7'), hexc('#b19d83'), hexc('#927a5d')
RED, RED_HI = hexc('#bc4c51'), hexc('#cf686d')

W = H = 32
OPEN_X0, OPEN_X1, OPEN_Y0, OPEN_Y1 = 5, 26, 12, 30
KEY_X0, KEY_X1 = 12, 19
TOP_Y0, LIP_Y = 2, 7
FACE_Y0 = 8
WALL_FACE_Y = 20


def blank():
    return [[CLEAR] * W for _ in range(H)]


def put(f, x, y, c):
    if 0 <= x < W and 0 <= y < H:
        f[y][x] = c


def rect(f, x0, y0, x1, y1, c):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            put(f, x, y, c)


def in_opening(x, y):
    if not (OPEN_X0 <= x <= OPEN_X1 and OPEN_Y0 <= y <= OPEN_Y1):
        return False
    return not (y == OPEN_Y0 and (x < OPEN_X0 + 2 or x > OPEN_X1 - 2))


def wall_tile():
    t = Image.open('assets/tileset/tileset.png').convert('RGBA')
    return [[t.getpixel((16 + x, y)) for x in range(16)] for y in range(16)]


def slab(f, x0, y0, x1, y1):
    """Top surface like the wall cap (tile 1 rows 0-3): plum rim, brown fill, lighter
    front lip that meets the front face with no border line."""
    rect(f, x0, y0, x1, y1, TOP_LINE)
    rect(f, x0 + 1, y0 + 1, x1 - 1, y1, CAP)
    rect(f, x0 + 1, y1, x1 - 1, y1, CAP_HI)


def brick(f, x0, y0, x1, y1):
    """Front-face brick like the wall face: plum ends, flat face, darker inner corners."""
    rect(f, x0, y0, x1, y1, FACE)
    rect(f, x0, y0, x0, y1, EDGE)
    rect(f, x1, y0, x1, y1, EDGE)
    if x1 - x0 >= 6:
        put(f, x0 + 1, y1, CORNER)
        put(f, x1 - 1, y1, CORNER)


def draw_top_surface(f):
    slab(f, 0, TOP_Y0, KEY_X0, LIP_Y)
    slab(f, KEY_X1, TOP_Y0, W - 1, LIP_Y)
    slab(f, KEY_X0, 0, KEY_X1, LIP_Y)


def draw_front_face(f):
    rect(f, 0, FACE_Y0, W - 1, WALL_FACE_Y - 1, EDGE)
    brick(f, 0, 8, KEY_X0 - 1, 10)
    brick(f, KEY_X1 + 1, 8, W - 1, 10)
    brick(f, KEY_X0, 8, KEY_X1, 11)
    rect(f, 14, 9, 17, 10, RED)
    rect(f, 15, 9, 16, 9, RED_HI)
    rect(f, 15, 11, 16, 11, RED)
    for y0, y1 in [(12, 14), (16, 18)]:
        brick(f, 0, y0, 4, y1)
        brick(f, 27, y0, 31, y1)
    for x in (OPEN_X0, OPEN_X0 + 1):
        put(f, x, OPEN_Y0, CORNER)
        put(f, W - 1 - x, OPEN_Y0, CORNER)
    rect(f, 0, FACE_Y0, 0, WALL_FACE_Y - 1, TOP_LINE)
    rect(f, W - 1, FACE_Y0, W - 1, WALL_FACE_Y - 1, TOP_LINE)


def draw_wall_face(f):
    rows = wall_tile()
    left, right = [0, 1, 2, 3, 15], [0, 12, 13, 14, 15]
    for y in range(WALL_FACE_Y, H):
        src = rows[y - 16]
        for i, sx in enumerate(left):
            put(f, i, y, src[sx])
        for i, sx in enumerate(right):
            put(f, 27 + i, y, src[sx])
        for x in range(5, 27):
            put(f, x, y, src[(x + 5) % 16])


def draw_void(f):
    for y in range(OPEN_Y0, OPEN_Y1 + 1):
        for x in range(OPEN_X0, OPEN_X1 + 1):
            if in_opening(x, y):
                f[y][x] = CLEAR


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
    draw_wall_face(f)
    draw_front_face(f)
    draw_top_surface(f)
    draw_void(f)
    draw_portcullis(f, shift)
    return f


def main():
    # v7 was hand-edited (lower side slabs); start from that PNG and only clear the passage.
    # The approved v8 PNG was hand-edited afterwards (row 31 of the passage cleared), so
    # running this overwrites that edit; edit the PNG directly instead.
    shifts = [0, 7, 13, 19]
    sheet = Image.open('.agents/tasks/2026-10-27-boss-gate-redesign/drafts/boss-gate-opening-strip-v7.png').convert('RGBA')
    cleared = 0
    for i, s in enumerate(shifts):
        f = build(s)
        for y in range(H):
            for x in range(W):
                if in_opening(x, y) and f[y][x] == CLEAR:
                    sheet.putpixel((i * W + x, y), CLEAR)
                    cleared += 1
    out = 'assets/doors/boss-gate-opening-strip-v8.png'
    sheet.save(out)
    print('wrote', out, sheet.size, 'cleared', cleared)


if __name__ == '__main__':
    main()
