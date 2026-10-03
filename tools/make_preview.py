"""Gera assets/tileset/_preview.png com cada tile numerado (índice da grade).

O tileset é uma grade de tiles 16x16. O índice segue a convenção do jogo:
    index = linha * COLS + coluna   (COLS = 10)
Cada tile é ampliado (nearest-neighbor) e recebe o número sobreposto, para
facilitar descrever quais índices correspondem aos buracos.
"""
from PIL import Image, ImageDraw, ImageFont

SRC = "assets/tileset/tileset.png"
OUT = "assets/tileset/_preview.png"

TILE = 16
COLS = 10          # convenção do jogo (index = row*10 + col)
SCALE = 6          # ampliação de cada tile
PAD = 2            # borda entre células no preview

src = Image.open(SRC).convert("RGBA")
w, h = src.size
rows = h // TILE
cols = w // TILE
total = rows * cols

cell = TILE * SCALE
cw = cell + PAD
ch = cell + PAD

canvas = Image.new("RGBA", (cols * cw + PAD, rows * ch + PAD), (24, 22, 34, 255))
draw = ImageDraw.Draw(canvas)

# Fonte: tenta uma TTF comum do Windows; cai para a bitmap default se faltar.
try:
    font = ImageFont.truetype("consola.ttf", 16)
except Exception:
    try:
        font = ImageFont.truetype("arial.ttf", 15)
    except Exception:
        font = ImageFont.load_default()

def draw_label(x, y, text):
    # contorno escuro para o número ser legível sobre qualquer tile
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            if dx or dy:
                draw.text((x + dx, y + dy), text, font=font, fill=(0, 0, 0, 255))
    draw.text((x, y), text, font=font, fill=(255, 240, 120, 255))

for r in range(rows):
    for c in range(cols):
        idx = r * COLS + c
        tile = src.crop((c * TILE, r * TILE, c * TILE + TILE, r * TILE + TILE))
        tile = tile.resize((cell, cell), Image.NEAREST)
        px = PAD + c * cw
        py = PAD + r * ch
        canvas.alpha_composite(tile, (px, py))
        # grade
        draw.rectangle([px, py, px + cell - 1, py + cell - 1], outline=(255, 255, 255, 60))
        draw_label(px + 3, py + 2, str(idx))

canvas.save(OUT)
print(f"OK -> {OUT}  ({cols}x{rows} tiles, indices 0..{total-1})")
