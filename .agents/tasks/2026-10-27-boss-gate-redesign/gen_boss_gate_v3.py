"""Deterministic generator for the boss gate opening sprite sheet (v3, chunky).

Keeps the native art density of v2 (48x48 logical art px per frame, 4 frames in a
2x2 grid, upscaled x8 -> 768x768) and the tileset-sampled plum/rust/bone palette,
but redraws everything with a chunkier read closer to the v1 illustration:

- stone built from discrete blocks, each with a fat 2-tone bevel (lit top-left,
  shaded bottom-right) and dark mortar gaps, instead of flat single-tone faces;
- a bold arched ring (side pillars + stepped top band) with a raised keystone;
- thick 3px iron bars with brass rivets and chunky cross bands;
- a larger bone skull with ember eye sockets as the central lock.

The stone ring is identical on every frame. Only the portcullis + skull retract
vertically up behind the lintel. Stone is drawn last so the bars clip behind it.
"""
from PIL import Image

# ---- Palette (sampled from assets/tileset/tileset.png) ----------------------
TRANSPARENT = (0, 0, 0, 0)

# Stone frame (plum masonry) - wider value range for a chunkier bevel
STONE_HI   = (0x8a, 0x5f, 0x62, 255)  # brightest lit corner
STONE_LIT  = (0x6a, 0x45, 0x5f, 255)  # lit face
STONE_MID  = (0x4c, 0x2f, 0x49, 255)  # main face
STONE_DARK = (0x36, 0x20, 0x30, 255)  # shaded face
STONE_DEEP = (0x28, 0x16, 0x23, 255)  # deepest shade
STONE_LINE = (0x1c, 0x0e, 0x16, 255)  # mortar gap
OUTLINE    = (0x0b, 0x06, 0x08, 255)  # outer dark outline

# Passage void (behind bars)
VOID       = (0x17, 0x0c, 0x10, 255)
VOID_DEEP  = (0x05, 0x03, 0x04, 255)

# Iron / rust metal
IRON_DARK  = (0x5e, 0x39, 0x2b, 255)
IRON_MID   = (0x89, 0x5a, 0x45, 255)
RUST_HI    = (0xbf, 0x70, 0x4d, 255)
RUST_LITE  = (0xdc, 0x8c, 0x5e, 255)
BRASS      = (0xc0, 0x93, 0x44, 255)
EMBER      = (0xff, 0xd5, 0x69, 255)

# Bone skull
BONE_HI    = (0xe8, 0xf2, 0xf7, 255)
BONE_MID   = (0xca, 0xe6, 0xf5, 255)
BONE_SHAD  = (0x90, 0x91, 0x9e, 255)

W = H = 48  # one logical frame


def new_frame():
    return [[TRANSPARENT for _ in range(W)] for _ in range(H)]


def put(f, x, y, c):
    if 0 <= x < W and 0 <= y < H:
        f[y][x] = c


def rect(f, x0, y0, x1, y1, c):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            put(f, x, y, c)


# ---- Chunky beveled stone block --------------------------------------------
def block(f, x0, y0, x1, y1):
    """A single masonry block: fat 2px-ish lit bevel top/left, dark bevel
    bottom/right, mid face, and a brightest single-pixel corner."""
    rect(f, x0, y0, x1, y1, STONE_MID)
    # lit top + left (2 thick)
    for x in range(x0, x1 + 1):
        put(f, x, y0, STONE_LIT)
    for y in range(y0, y1 + 1):
        put(f, x0, y, STONE_LIT)
    put(f, x0, y0, STONE_HI)
    put(f, x0 + 1, y0, STONE_HI)
    put(f, x0, y0 + 1, STONE_HI)
    # shaded bottom + right (2 thick)
    for x in range(x0, x1 + 1):
        put(f, x, y1, STONE_DARK)
        put(f, x, y1 - 1, STONE_DARK if (x + y1) % 3 else STONE_MID)
    for y in range(y0, y1 + 1):
        put(f, x1, y, STONE_DARK)
        put(f, x1 - 1, y, STONE_DARK if (x1 + y) % 3 else STONE_MID)
    put(f, x1, y1, STONE_DEEP)


def mortar_gap(f, x, y0, y1, vertical=True):
    if vertical:
        for y in range(y0, y1 + 1):
            put(f, x, y, STONE_LINE)
    else:
        for xx in range(y0, y1 + 1):
            put(f, xx, x, STONE_LINE)


def outline_rect(f, x0, y0, x1, y1):
    for x in range(x0, x1 + 1):
        put(f, x, y0, OUTLINE)
        put(f, x, y1, OUTLINE)
    for y in range(y0, y1 + 1):
        put(f, x0, y, OUTLINE)
        put(f, x1, y, OUTLINE)


def crack(f, pts):
    for (x, y) in pts:
        put(f, x, y, STONE_LINE)


# ---- Rust bracket bolting the frame ----------------------------------------
def bracket(f, x0, x1, y):
    """A chunky 3px rust band with a lit top edge and brass bolt heads."""
    rect(f, x0, y, x1, y + 2, IRON_DARK)
    for x in range(x0, x1 + 1):
        put(f, x, y, RUST_HI)
        put(f, x, y + 1, IRON_MID)
    put(f, x0 + 1, y + 1, BRASS)
    put(f, x1 - 1, y + 1, BRASS)


# ---- Stone ring (identical on every frame) ---------------------------------
# Layout (logical 48x48):
#   left pillar  cols 1..11, right pillar cols 36..46, rows 6..46
#   top band     rows 1..8 spanning pillars, keystone rows 0..3 center
#   threshold    rows 43..46
#   inner opening cols 12..35, rows 9..42

PILLAR_L = (1, 11)
PILLAR_R = (36, 46)


def draw_stone(f):
    lx0, lx1 = PILLAR_L
    rx0, rx1 = PILLAR_R

    # --- left pillar: stacked blocks ---
    rows = [(6, 15), (15, 24), (24, 33), (33, 42), (42, 46)]
    for (y0, y1) in rows:
        block(f, lx0, y0, lx1, y1)
    for (y0, y1) in [(15, 15), (24, 24), (33, 33), (42, 42)]:
        mortar_gap(f, y0, lx0, lx1, vertical=False)
    # --- right pillar ---
    for (y0, y1) in rows:
        block(f, rx0, y0, rx1, y1)
    for (y0, y1) in [(15, 15), (24, 24), (33, 33), (42, 42)]:
        mortar_gap(f, y0, rx0, rx1, vertical=False)

    # --- top band: a row of voussoir blocks across the arch ---
    band_y0, band_y1 = 1, 9
    seams = [1, 11, 18, 23, 25, 30, 37, 46]
    for i in range(len(seams) - 1):
        block(f, seams[i], band_y0, seams[i + 1], band_y1)
    for s in seams[1:-1]:
        mortar_gap(f, s, band_y0, band_y1, vertical=True)

    # --- raised keystone cap (center, slightly taller) ---
    block(f, 20, 0, 27, 9)
    # cross emblem recessed into the keystone
    rect(f, 23, 2, 24, 7, STONE_DEEP)
    rect(f, 21, 3, 26, 4, STONE_DEEP)
    put(f, 23, 2, OUTLINE); put(f, 24, 2, OUTLINE)

    # --- threshold sill across the bottom ---
    block(f, 1, 43, 46, 46)
    for s in (12, 23, 35):
        mortar_gap(f, s, 43, 46, vertical=True)

    # --- a few hand-placed cracks for texture ---
    crack(f, [(5, 19), (6, 20), (7, 20), (8, 21)])
    crack(f, [(40, 28), (41, 29), (42, 29)])
    crack(f, [(4, 37), (5, 38)])

    # --- rust brackets bolting the pillars ---
    bracket(f, lx0, lx1, 20)
    bracket(f, lx0, lx1, 37)
    bracket(f, rx0, rx1, 20)
    bracket(f, rx0, rx1, 37)

    # --- outlines so the frame pops over the wall ---
    outline_rect(f, 1, 0, 46, 46)          # outer silhouette
    outline_rect(f, 20, 0, 27, 9)          # keystone
    # inner opening outline (flush to pillar faces)
    for y in range(8, 43):
        put(f, 11, y, OUTLINE)
        put(f, 36, y, OUTLINE)
    for x in range(11, 37):
        put(f, x, 8, OUTLINE)
        put(f, x, 42, OUTLINE)


def draw_void(f):
    rect(f, 12, 9, 35, 42, VOID)
    rect(f, 13, 10, 34, 41, VOID_DEEP)


# ---- Portcullis (chunky bars) + skull lock ---------------------------------
# Inner opening spans cols 12..35. Six fat 3px bars, two cross bands, retracting
# upward behind the lintel (clip at row 9).

BAR_X = [12, 16, 20, 24, 28, 32]   # left edge of each 3px-wide bar
SPAN_TOP = 9
SPAN_BOT = 41


def draw_portcullis(f, retract):
    height = SPAN_BOT - SPAN_TOP
    shift = int(round(retract * (height + 8)))  # fully clears past the top
    top = SPAN_TOP - shift
    bot = SPAN_BOT - shift
    vis_top = max(top, SPAN_TOP)
    if vis_top > SPAN_BOT:
        return

    # vertical bars (3px wide: mid, hi, dark)
    for bx in BAR_X:
        for y in range(vis_top, min(bot, SPAN_BOT) + 1):
            put(f, bx, y, IRON_MID)
            put(f, bx + 1, y, RUST_HI)
            put(f, bx + 2, y, IRON_DARK)
        # bright cap on the top of each bar
        cap = max(vis_top, SPAN_TOP)
        if cap <= SPAN_BOT:
            put(f, bx, cap, RUST_LITE)
            put(f, bx + 1, cap, RUST_LITE)

    # two chunky horizontal cross bands moving with the grille
    for band in (top + 9, top + 24):
        if SPAN_TOP <= band <= SPAN_BOT - 1:
            for x in range(12, 36):
                put(f, x, band, RUST_HI)
                put(f, x, band + 1, IRON_DARK)
            for bx in BAR_X:
                put(f, bx + 1, band, BRASS)      # rivet heads
                put(f, bx + 1, band + 1, EMBER)

    # skull lock centred on the grille, travels with it
    draw_skull(f, 23, top + 16, SPAN_TOP, SPAN_BOT)


def draw_skull(f, cx, cy, clip_top, clip_bot):
    """Chunky bone skull with ember eye sockets, clipped to the opening."""
    def ps(x, y, c):
        if clip_top <= y <= clip_bot:
            put(f, x, y, c)

    # cranium 9 wide x 7 tall
    for dy in range(-5, 2):
        for dx in range(-4, 5):
            ps(cx + dx, cy + dy, BONE_MID)
    # rounded corners -> trim
    for (dx, dy) in [(-4, -5), (4, -5), (-4, 1), (4, 1)]:
        ps(cx + dx, cy + dy, TRANSPARENT)
    # top + left highlight band
    for dx in range(-3, 4):
        ps(cx + dx, cy - 5, BONE_HI)
    for dy in range(-4, 0):
        ps(cx - 4, cy + dy, BONE_HI)
    # outline ring
    for dx in range(-4, 5):
        ps(cx + dx, cy - 6, OUTLINE)
    for dx in range(-3, 4):
        ps(cx + dx, cy + 2, OUTLINE)
    for dy in range(-6, 3):
        ps(cx - 5, cy + dy, OUTLINE)
        ps(cx + 5, cy + dy, OUTLINE)
    # jaw block (narrower)
    for dx in range(-3, 4):
        ps(cx + dx, cy + 2, BONE_SHAD)
    for dx in range(-3, 4):
        ps(cx + dx, cy + 3, OUTLINE)
    # eye sockets (ember glow)
    for (ex) in (-3, -2):
        ps(cx + ex, cy - 2, EMBER)
        ps(cx + ex, cy - 1, RUST_HI)
    for (ex) in (2, 3):
        ps(cx + ex, cy - 2, EMBER)
        ps(cx + ex, cy - 1, RUST_HI)
    ps(cx - 3, cy - 3, OUTLINE); ps(cx + 3, cy - 3, OUTLINE)
    ps(cx - 2, cy - 3, OUTLINE); ps(cx + 2, cy - 3, OUTLINE)
    # nasal cavity + keyhole mouth
    ps(cx, cy - 1, VOID_DEEP)
    ps(cx, cy, VOID_DEEP)
    ps(cx, cy + 1, VOID_DEEP)
    ps(cx - 1, cy + 1, BONE_SHAD)
    ps(cx + 1, cy + 1, BONE_SHAD)


# ---- Compose ---------------------------------------------------------------
def build_frame(retract):
    f = new_frame()
    draw_void(f)
    draw_portcullis(f, retract)
    draw_stone(f)  # stone last so bars clip behind the ring
    return f


def frame_to_region(sheet, f, ox, oy):
    for y in range(H):
        for x in range(W):
            sheet.putpixel((ox + x, oy + y), f[y][x])


def main():
    retracts = [0.0, 1 / 3, 2 / 3, 1.0]
    sheet = Image.new('RGBA', (W * 2, H * 2), TRANSPARENT)
    positions = [(0, 0), (W, 0), (0, H), (W, H)]  # row-major 2x2
    for r, (ox, oy) in zip(retracts, positions):
        frame_to_region(sheet, build_frame(r), ox, oy)
    scale = 8
    big = sheet.resize((sheet.width * scale, sheet.height * scale), Image.NEAREST)
    out = 'assets/doors/boss-gate-opening-sheet-v3.png'
    big.save(out)
    print('wrote', out, big.size)


if __name__ == '__main__':
    main()
