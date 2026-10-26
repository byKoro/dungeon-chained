"""Regenerate the 47 auto-tiled hole cells in each tileset (blob autotile).

Mask bits match holeTileFor in js/config/GameConfig.js. Edges: 1=N, 2=E, 4=S, 8=W set when that
neighbour is NOT a hole. Inner corners: 16=NW, 32=NE, 64=SE, 128=SW set when the diagonal is
NOT a hole and both orthogonals beside it ARE holes. The 16 edge-only cells keep their old
indices (100..116); the 31 corner cells live in rows 12..15 (indices from CORNER_BASE), so the
sheet grows to 160x256. Colours are sampled from each sheet so palette variants stay coherent.

    python scripts/gen-hole-tiles.py            # preview only, writes _local/pits/*.png
    python scripts/gen-hole-tiles.py --write    # patch assets/tileset/*.png in place
    python scripts/gen-hole-tiles.py --js       # print the HOLE_TILES table for GameConfig.js
"""
import argparse
from pathlib import Path
from PIL import Image

T = 16
COLS = 10
ROWS = 16
N, E, S, W, NW, NE, SE, SW = 1, 2, 4, 8, 16, 32, 64, 128
EDGE_TILES = {0: 116, 1: 103, 2: 105, 3: 102, 4: 104, 5: 115, 6: 109, 7: 112,
              8: 106, 9: 101, 10: 114, 11: 110, 12: 107, 13: 113, 14: 111, 15: 100}
CORNER_BASE = 120
SHEETS = ["assets/tileset/tileset.png", "assets/tileset/tileset_1.png"]

FACE_TOP = 1
FACE_ROWS = 7
FACE_END = FACE_TOP + FACE_ROWS


def corner_options(edges):
    opts = []
    if not edges & N and not edges & W: opts.append(NW)
    if not edges & N and not edges & E: opts.append(NE)
    if not edges & S and not edges & E: opts.append(SE)
    if not edges & S and not edges & W: opts.append(SW)
    return opts


def hole_tiles():
    corner_masks = []
    for edges in range(16):
        opts = corner_options(edges)
        for sub in range(1, 1 << len(opts)):
            corners = sum(o for i, o in enumerate(opts) if sub & (1 << i))
            corner_masks.append(edges | corners)
    table = dict(EDGE_TILES)
    for i, mask in enumerate(sorted(corner_masks)):
        table[mask] = CORNER_BASE + i
    return table


def cell(im, idx):
    x, y = (idx % COLS) * T, (idx // COLS) * T
    return im.crop((x, y, x + T, y + T))


def colors_by_luma(tile):
    seen = {c for _, c in tile.getcolors(T * T) if c[3] == 255}
    return sorted(seen, key=lambda c: 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2])


def scale(c, k):
    return (round(c[0] * k), round(c[1] * k), round(c[2] * k), 255)


def palette(im):
    dark, brick_dark, brick, brick_light = colors_by_luma(cell(im, 0))
    floor_sh, floor = colors_by_luma(cell(im, 16))
    void = scale(dark, 0.62)
    return {
        "lip": brick_light, "brick": brick, "brick_dark": brick_dark,
        "floor": floor, "floor_sh": floor_sh, "dark": dark,
        "void": void, "deep": scale(dark, 0.30), "abyss": scale(dark, 0.14),
    }


COURSES = ((1, 2, "brick", 3), (4, 5, "brick_dark", 7), (7, 7, "floor_sh", 3))


def face_column(x, P):
    col = [P["dark"]] * (FACE_END + 1)
    col[0] = P["lip"]
    for y0, y1, key, joint in COURSES:
        for y in range(y0, y1 + 1):
            col[y] = P["dark"] if (x - joint) % 8 == 0 else P[key]
    if x in (2, 9, 13):
        col[1] = P["lip"]
    col[FACE_END] = P["dark"] if x % 2 == 0 else P["void"]
    return col


def build_tile(mask, P):
    n, e, s, w = bool(mask & N), bool(mask & E), bool(mask & S), bool(mask & W)
    nw, ne, se, sw = bool(mask & NW), bool(mask & NE), bool(mask & SE), bool(mask & SW)
    px = [[P["abyss"]] * T for _ in range(T)]
    last = T - 1

    face_end = FACE_END if n else 0
    for y in range(T):
        for x in range(T):
            d = 99
            if n: d = min(d, y - face_end + 1)
            if s: d = min(d, last - y)
            if w: d = min(d, x)
            if e: d = min(d, last - x)
            if nw: d = min(d, max(x - 1, y - FACE_END))
            if ne: d = min(d, max(last - 1 - x, y - FACE_END))
            if sw: d = min(d, max(x, last - y))
            if se: d = min(d, max(last - x, last - y))
            if d <= 1: px[y][x] = P["void"]
            elif d <= 3: px[y][x] = P["deep"] if (x + y) % 2 == 0 or d == 2 else P["abyss"]
            elif d <= 4 and (x + y) % 2 == 0: px[y][x] = P["deep"]

    if n:
        for x in range(T):
            for y, c in enumerate(face_column(x, P)):
                px[y][x] = c

    if s:
        px[last] = [P["brick_dark"]] * T
        for x in (4, 11):
            px[last - 1][x] = P["brick_dark"]
    for side, col_x, inner_x in ((w, 0, 1), (e, last, last - 1)):
        if not side:
            continue
        for y in range(T):
            if n and y == 0:
                continue
            px[y][col_x] = P["brick_dark"]
            if y >= face_end and not (s and y == last):
                px[y][inner_x] = P["dark"]
        if n:
            for y in range(1, face_end):
                px[y][inner_x] = scale(px[y][inner_x], 0.7)
    if n and w: px[0][0] = P["brick_dark"]
    if n and e: px[0][last] = P["brick_dark"]

    # Inner corner under a north face: the neighbour's wall face runs one more pixel, under the
    # side rim of the tile above, so it ends flush with that rim line instead of beside it.
    for corner, col_x, inner_x in ((nw, 0, 1), (ne, last, last - 1)):
        if not corner:
            continue
        face = face_column(col_x, P)
        for y in range(FACE_END + 1):
            px[y][col_x] = face[y]
        for y in range(FACE_END):
            px[y][inner_x] = P["dark"]
    # Inner corner on the south side: close the L where the south rim meets the side rim below.
    for corner, col_x, inner_x in ((sw, 0, 1), (se, last, last - 1)):
        if not corner:
            continue
        px[last][col_x] = P["brick_dark"]
        px[last][inner_x] = P["dark"]

    img = Image.new("RGBA", (T, T))
    img.putdata([c for row in px for c in row])
    return img


def patch(path, table, write, out_dir):
    src = Image.open(path).convert("RGBA")
    P = palette(src)
    im = Image.new("RGBA", (COLS * T, ROWS * T), (0, 0, 0, 0))
    im.paste(src, (0, 0))
    for mask, idx in table.items():
        im.paste(build_tile(mask, P), ((idx % COLS) * T, (idx // COLS) * T))
    if write:
        im.save(path)
    stem = Path(path).stem
    src.save(out_dir / f"before_{stem}.png")
    im.save(out_dir / f"after_{stem}.png")
    return P


def js_table(table):
    names = [(N, "N"), (E, "E"), (S, "S"), (W, "W"), (NW, "NW"), (NE, "NE"), (SE, "SE"), (SW, "SW")]
    lines = []
    for mask in sorted(table):
        label = "+".join(n for b, n in names if mask & b) or "-"
        lines.append(f"    {mask}: {table[mask]},".ljust(14) + f"// {label}")
    return "export const HOLE_TILES = Object.freeze({\n" + "\n".join(lines) + "\n});"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--js", action="store_true")
    ap.add_argument("--out", default="_local/pits")
    a = ap.parse_args()
    table = hole_tiles()
    if a.js:
        print(js_table(table))
        return
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    for path in SHEETS:
        P = patch(path, table, a.write, out)
        print(path, "written" if a.write else "preview only", f"{len(table)} hole cells")


if __name__ == "__main__":
    main()
