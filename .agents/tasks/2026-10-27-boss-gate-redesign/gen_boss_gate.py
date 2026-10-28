"""Deterministic generator for the boss gate opening sprite sheet.

Redraws the gate at the project's native art density (16 art px per 64-world-px
tile). The gate occupies 3 tiles horizontally, so one logical frame is 48x48 art
pixels. Four frames are packed in a 2x2 grid (row-major: closed, 1/3, 2/3, open)
to match DemoDoors.draw, which reads cells as img.naturalWidth/2.

Palette is sampled from assets/tileset/tileset.png (muted plum stone + warm rust
metal + bone), so the gate sits in the same colour family as the dungeon walls.

Output logical sheet is 96x96 (2x2 of 48x48). It is upscaled 8x with
nearest-neighbour to 768x768 for crisp integer-scale pixels.
"""
from PIL import Image

# ---- Palette (sampled from the real tileset) -------------------------------
TRANSPARENT = (0, 0, 0, 0)

# Stone frame (plum masonry)
STONE_HI   = (0x78, 0x51, 0x4f, 255)  # warm lit edge
STONE_LIT  = (0x59, 0x37, 0x56, 255)  # lit stone face
STONE_MID  = (0x4c, 0x2f, 0x49, 255)  # main stone face
STONE_DARK = (0x36, 0x20, 0x30, 255)  # shaded stone
STONE_LINE = (0x25, 0x13, 0x1a, 255)  # mortar / crack
OUTLINE    = (0x0b, 0x06, 0x08, 255)  # dark outline

# Passage void (behind bars)
VOID       = (0x17, 0x0c, 0x10, 255)
VOID_DEEP  = (0x05, 0x03, 0x04, 255)

# Iron / rust metal
IRON_DARK  = (0x72, 0x47, 0x36, 255)
IRON_MID   = (0x89, 0x5a, 0x45, 255)
RUST_HI    = (0xbf, 0x70, 0x4d, 255)
BRASS      = (0xc0, 0x93, 0x44, 255)
EMBER      = (0xff, 0xd5, 0x69, 255)

# Bone skull
BONE_HI    = (0xca, 0xe6, 0xf5, 255)
BONE_MID   = (0xad, 0xc1, 0xcf, 255)
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

# ---- Stone frame (identical on every frame) --------------------------------
# Layout: left pillar cols 2..9, right pillar cols 38..45, top arch rows 2..12,
# threshold rows 42..45. Inner passage: cols 12..35, rows 13..41.

def fill_stone(f, x0, y0, x1, y1):
    """Solid stone face with a subtle top-left lit bevel and shaded bottom-right."""
    rect(f, x0, y0, x1, y1, STONE_MID)
    for x in range(x0, x1 + 1):
        put(f, x, y0, STONE_LIT)
    for y in range(y0, y1 + 1):
        put(f, x0, y, STONE_LIT)
    for x in range(x0, x1 + 1):
        put(f, x, y1, STONE_DARK)
    for y in range(y0, y1 + 1):
        put(f, x1, y, STONE_DARK)

def mortar_v(f, x, y0, y1):
    for y in range(y0, y1 + 1):
        put(f, x, y, STONE_LINE)
        put(f, x, y + 1, STONE_HI)  # warm highlight under the mortar line

def mortar_h(f, y, x0, x1):
    for x in range(x0, x1 + 1):
        put(f, x, y, STONE_LINE)

def outline_ring(f, x0, y0, x1, y1):
    for x in range(x0, x1 + 1):
        put(f, x, y0, OUTLINE); put(f, x, y1, OUTLINE)
    for y in range(y0, y1 + 1):
        put(f, x0, y, OUTLINE); put(f, x1, y, OUTLINE)

def rust_band(f, cx0, cx1, y):
    rect(f, cx0, y, cx1, y + 1, IRON_DARK)
    for x in range(cx0, cx1 + 1):
        put(f, x, y, RUST_HI)
    put(f, (cx0 + cx1) // 2, y + 1, BRASS)

def draw_frame_stone(f):
    # --- one continuous stone ring, no gaps -------------------------------
    # pillars meet the inner opening edge (cols 10 and 37) so no see-through sliver.
    fill_stone(f, 2, 3, 10, 44)       # left pillar full height
    fill_stone(f, 37, 3, 45, 44)      # right pillar full height
    fill_stone(f, 2, 1, 45, 9)        # top band spanning both pillars (arch base)
    fill_stone(f, 17, 0, 30, 2)       # raised keystone lintel cap
    # threshold sill across the bottom
    fill_stone(f, 2, 41, 45, 45)

    # masonry divisions (mortar lines carve blocks out of the solid ring)
    for y in (11, 19, 27, 35):
        mortar_h(f, y, 3, 9); mortar_h(f, y, 38, 44)
    for x in (10, 17, 24, 30, 37):
        mortar_v(f, x, 1, 8)
    mortar_h(f, 8, 2, 45)             # line under the top band
    mortar_h(f, 40, 2, 45)           # line above the sill

    # keystone raised cross emblem (centered on the top band)
    rect(f, 22, 1, 25, 7, STONE_DARK)     # vertical bar recess
    rect(f, 20, 3, 27, 4, STONE_DARK)     # cross arm recess
    rect(f, 23, 2, 24, 7, OUTLINE)
    rect(f, 21, 3, 26, 3, OUTLINE)

    # warm rust brackets bolting the frame
    rust_band(f, 2, 10, 23)
    rust_band(f, 2, 10, 33)
    rust_band(f, 37, 45, 23)
    rust_band(f, 37, 45, 33)

    # outer outline so the frame pops over the wall
    outline_ring(f, 2, 1, 45, 45)
    outline_ring(f, 17, 0, 30, 9)
    # inner opening outline (flush against pillar faces at col 10 / 37)
    for y in range(8, 41):
        put(f, 10, y, OUTLINE); put(f, 37, y, OUTLINE)
    for x in range(10, 38):
        put(f, x, 8, OUTLINE); put(f, x, 40, OUTLINE)

def draw_void(f):
    # dark passage behind bars (inner opening), fully opaque so no see-through
    rect(f, 10, 8, 37, 40, VOID)
    rect(f, 12, 10, 35, 39, VOID_DEEP)

# ---- Portcullis (bars) + skull lock ----------------------------------------
# bars travel vertically. travel = fraction already retracted (0..1).
# bar vertical span when closed: rows 9..41 (height 33). Retract upward behind
# lintel (clip top at row 9).

BAR_COLS = [14, 18, 22, 26, 30, 34]  # vertical bars, 2px wide each (inner 11..36)

def draw_portcullis(f, retract):
    span_top = 9
    span_bot = 39
    height = span_bot - span_top
    shift = int(round(retract * (height + 4)))  # move up, fully gone past top
    top = span_top - shift
    bot = span_bot - shift
    # clip: anything above the lintel (row 9) is hidden behind stone
    vis_top = max(top, span_top)
    if vis_top > span_bot:
        return  # fully retracted, nothing visible
    # vertical bars
    for bx in BAR_COLS:
        for y in range(vis_top, bot + 1):
            if y < span_top:
                continue
            put(f, bx, y, IRON_MID)
            put(f, bx + 1, y, IRON_DARK)
        # bright top cap on each bar
        if span_top <= bot:
            put(f, bx, max(vis_top, span_top), RUST_HI)
    # two horizontal cross bands move with the grille
    for band in (top + 10, top + 24):
        by = band
        if span_top <= by <= span_bot:
            for x in range(12, 36):
                put(f, x, by, IRON_DARK)
                put(f, x, by - 1, RUST_HI)
            for bx in BAR_COLS:
                put(f, bx, by, BRASS)  # rivets
    # skull lock centered on the grille, travels with it
    sk_cy = top + 14
    draw_skull(f, 23, sk_cy, span_top, span_bot)

def draw_skull(f, cx, cy, clip_top, clip_bot):
    """Small bone skull with ember eyes, clipped to the doorway opening."""
    def ps(x, y, c):
        if clip_top <= y <= clip_bot:
            put(f, x, y, c)
    # cranium 7x6
    for dy in range(-4, 2):
        for dx in range(-3, 4):
            ps(cx + dx, cy + dy, BONE_MID)
    # top highlight
    for dx in range(-2, 3):
        ps(cx + dx, cy - 4, BONE_HI)
    # outline
    for dx in range(-3, 4):
        ps(cx + dx, cy - 5, OUTLINE); ps(cx + dx, cy + 2, OUTLINE)
    for dy in range(-5, 3):
        ps(cx - 4, cy + dy, OUTLINE); ps(cx + 4, cy + dy, OUTLINE)
    # eye sockets (ember)
    ps(cx - 2, cy - 1, EMBER); ps(cx - 1, cy - 1, RUST_HI)
    ps(cx + 1, cy - 1, RUST_HI); ps(cx + 2, cy - 1, EMBER)
    ps(cx - 2, cy - 2, OUTLINE); ps(cx + 2, cy - 2, OUTLINE)
    # nasal + keyhole
    ps(cx, cy, VOID_DEEP)
    ps(cx, cy + 1, VOID_DEEP)
    # jaw shading
    ps(cx - 2, cy + 1, BONE_SHAD); ps(cx + 2, cy + 1, BONE_SHAD)

# ---- Compose ---------------------------------------------------------------

def build_frame(retract):
    f = new_frame()
    draw_void(f)
    draw_portcullis(f, retract)
    draw_frame_stone(f)  # stone drawn last so bars/skull clip behind it
    return f

def frame_to_region(sheet, f, ox, oy):
    for y in range(H):
        for x in range(W):
            sheet.putpixel((ox + x, oy + y), f[y][x])

def main():
    retracts = [0.0, 1/3, 2/3, 1.0]
    sheet = Image.new('RGBA', (W * 2, H * 2), TRANSPARENT)
    positions = [(0, 0), (W, 0), (0, H), (W, H)]  # row-major 2x2
    for r, (ox, oy) in zip(retracts, positions):
        frame_to_region(sheet, build_frame(r), ox, oy)
    scale = 8
    big = sheet.resize((sheet.width * scale, sheet.height * scale), Image.NEAREST)
    out = 'assets/doors/boss-gate-opening-sheet-v2.png'
    big.save(out)
    print('wrote', out, big.size)

if __name__ == '__main__':
    main()
