"""Exporta PNGs GRANDES (nearest-neighbor) de peças do cenário a partir do
tileset do jogo, para montar o cenário 3D no DaVinci Resolve.

O tileset é uma grade de 10 colunas de tiles 16x16 (index = row*10 + col).
Cada peça é recortada do tileset e ampliada com NEAREST (mantém o pixel art
nítido, sem borrar) para um PNG com fundo TRANSPARENTE.

Saída: assets/scene_export/
"""
import os
from PIL import Image

SRC = "assets/tileset/tileset.png"
OUT_DIR = "assets/scene_export"

TILE = 16
COLS = 10          # convenção do jogo (index = row*10 + col)
SCALE = 32         # ampliação: cada tile de 16px vira 512px

os.makedirs(OUT_DIR, exist_ok=True)
src = Image.open(SRC).convert("RGBA")


def tile_box(index):
    """Retângulo (left, top, right, bottom) de um tile pelo índice da grade."""
    c = index % COLS
    r = index // COLS
    x = c * TILE
    y = r * TILE
    return (x, y, x + TILE, y + TILE)


def crop_indices(indices, cols):
    """Recorta um bloco retangular de tiles (lista em ordem de leitura,
    linha a linha) e devolve uma imagem única já montada.
    `cols` = quantos tiles por linha no bloco."""
    rows = (len(indices) + cols - 1) // cols
    block = Image.new("RGBA", (cols * TILE, rows * TILE), (0, 0, 0, 0))
    for i, idx in enumerate(indices):
        bc = i % cols
        br = i // cols
        tile = src.crop(tile_box(idx))
        block.alpha_composite(tile, (bc * TILE, br * TILE))
    return block


def upscale(img):
    """Amplia com NEAREST mantendo pixel art nítido."""
    return img.resize((img.width * SCALE, img.height * SCALE), Image.NEAREST)


def export(name, indices, cols=1):
    img = crop_indices(indices, cols)
    big = upscale(img)
    path = os.path.join(OUT_DIR, f"{name}.png")
    big.save(path)
    print(f"OK  {name:28s} {img.width}x{img.height} tiles -> {big.width}x{big.height}px")


def export_tiled(name, index, nx, ny):
    """Repete um único tile numa grade nx*ny (piso contínuo tileável)."""
    unit = src.crop(tile_box(index))
    block = Image.new("RGBA", (nx * TILE, ny * TILE), (0, 0, 0, 0))
    for yy in range(ny):
        for xx in range(nx):
            block.alpha_composite(unit, (xx * TILE, yy * TILE))
    big = upscale(block)
    path = os.path.join(OUT_DIR, f"{name}.png")
    big.save(path)
    print(f"OK  {name:28s} {block.width}x{block.height} tiles -> {big.width}x{big.height}px")


# ---------------------------------------------------------------------------
# PISO
# ---------------------------------------------------------------------------
export("piso", [16])                 # tile de piso liso (1x1)
export_tiled("piso_4x4", 16, 4, 4)   # painel de piso contínuo (4x4 tiles)

# ---------------------------------------------------------------------------
# PAREDES (crista superior + corpo da parede, como a engine monta)
# ---------------------------------------------------------------------------
# Parede do topo (N): crista (linha 4) sobre o corpo (linha 5) = parede inteira.
export("parede_topo", [41, 51], cols=1)             # 1 tile de largura, 2 de altura
export("parede_topo_faixa", [41, 42, 43,
                             51, 52, 53], cols=3)    # faixa de 3 de largura
export("parede_crista", [41])        # só a crista superior (beira iluminada)
export("parede_corpo", [51])         # só o corpo (bloco de pedra)
export("parede_lateral", [50])       # parede lateral (coluna esquerda)
export("parede_lateral_dir", [55])   # parede lateral (coluna direita)

# ---------------------------------------------------------------------------
# PORTAS
# ---------------------------------------------------------------------------
# Porta de madeira em arco (vão de 2 tiles de largura): tiles 66 + 67.
export("porta_arco", [66, 67], cols=2)
# Portal de madeira em arco com crista por cima (36/37 topo, 66/67 base).
export("porta_arco_alta", [36, 37, 66, 67], cols=2)
# Batente/portal de madeira (vertical, 1 tile): 38.
export("porta_madeira", [38])
# Escada (dá para usar como passagem/portal): 39.
export("porta_escada", [39])

# ---------------------------------------------------------------------------
# PROPS
# ---------------------------------------------------------------------------
export("prop_bau_fechado", [84])     # baú de prata fechado
export("prop_bau_aberto", [85])      # baú aberto
export("prop_bau_madeira", [80])     # baú de madeira
export("prop_caveira", [77])         # caveira
export("prop_ossos", [68])           # ossos
export("prop_moeda", [86])           # moeda de ouro
export("prop_frasco_azul", [87])     # frasco azul
export("prop_frasco_vermelho", [89]) # frasco vermelho
export("prop_chave", [99])           # chave
export("prop_tocha", [90])           # tocha de parede (chama)
export("prop_tocha_lateral", [91])   # tocha lateral
export("prop_estandarte", [74])      # estandarte/bandeira
export("prop_castical", [93])        # castiçal

# ---------------------------------------------------------------------------
# FOLHA-CONTATO: miniatura de tudo que foi exportado, com rótulo do arquivo.
# Facilita escolher a peça certa dentro do DaVinci sem abrir arquivo por arquivo.
# ---------------------------------------------------------------------------
def make_contact_sheet():
    from PIL import ImageDraw, ImageFont
    files = sorted(f for f in os.listdir(OUT_DIR)
                   if f.endswith(".png") and f != "_contato.png")
    thumb = 150          # lado da miniatura
    pad = 10
    label_h = 20
    cols_n = 6
    rows_n = (len(files) + cols_n - 1) // cols_n
    cw = thumb + pad
    ch = thumb + label_h + pad
    sheet = Image.new("RGBA", (cols_n * cw + pad, rows_n * ch + pad), (24, 22, 34, 255))
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("arial.ttf", 12)
    except Exception:
        font = ImageFont.load_default()
    for i, fn in enumerate(files):
        im = Image.open(os.path.join(OUT_DIR, fn)).convert("RGBA")
        im.thumbnail((thumb, thumb), Image.NEAREST)
        c = i % cols_n
        r = i // cols_n
        px = pad + c * cw
        py = pad + r * ch
        # moldura para enxergar o alpha
        draw.rectangle([px, py, px + thumb, py + thumb], outline=(255, 255, 255, 50))
        sheet.alpha_composite(im, (px + (thumb - im.width) // 2,
                                   py + (thumb - im.height) // 2))
        draw.text((px + 2, py + thumb + 3), fn[:-4], font=font, fill=(255, 240, 120, 255))
    out = os.path.join(OUT_DIR, "_contato.png")
    sheet.save(out)
    print(f"OK  folha-contato -> {out}")


make_contact_sheet()
print("\nTudo exportado em", OUT_DIR)
