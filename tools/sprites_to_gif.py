#!/usr/bin/env python3
"""
sprites_to_gif.py - Converte sprites de sequencia em GIFs ampliados.

Objetivo: gerar GIFs para uso em video (DaVinci Resolve) a partir dos sprites
animados do jogo, com a resolucao aumentada por fator INTEIRO e reamostragem
NEAREST (vizinho mais proximo). Assim os pixels sao ampliados sem borrao.

Dois tipos de origem sao tratados:

1) Spritesheets: um unico PNG com varios frames numa grade de celulas de
   `cell` pixels. Recorta-se cada celula e, dentro dela, a regiao util
   (crop_x/y/w/h) - os mesmos valores usados pelo jogo (EntityConfig.js).

2) Frames separados: uma lista de PNGs, um por frame, empilhados na ordem.

Saida: assets_gif/<grupo>/<nome>.gif
"""

from PIL import Image
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
OUT = ROOT / "assets_gif"

# Fator de ampliacao INTEIRO (preserva nitidez dos pixels). Pode ajustar.
SCALE = 8

# Duracao padrao de cada frame no GIF, em milissegundos.
DEFAULT_MS = 110


def scaled(img: Image.Image, scale: int) -> Image.Image:
    """Amplia por fator inteiro usando NEAREST (sem borrar)."""
    return img.resize((img.width * scale, img.height * scale), Image.NEAREST)


def _canvas_size(frames):
    """Maior largura/altura entre os frames (para alinhar num quadro comum)."""
    w = max(f.width for f in frames)
    h = max(f.height for f in frames)
    return w, h


def _to_palette_frame(rgba: Image.Image):
    """Converte um frame RGBA para paleta P, reservando o indice 0 para a
    transparencia. Pixels com alfa baixo viram o indice transparente."""
    alpha = rgba.split()[3]
    # Quantiza as cores em ate 255 (deixa o indice 0 livre para transparencia).
    p = rgba.convert("RGB").quantize(colors=255, method=Image.MEDIANCUT)
    # Empurra todos os indices em +1 (abre o 0) e reconstroi a paleta.
    src_pal = p.getpalette()[: 255 * 3]
    new = Image.new("P", p.size)
    new.putpalette([0, 0, 0] + src_pal)  # indice 0 = cor transparente (preto)
    new.putdata([px + 1 for px in list(p.getdata())])
    # Marca como transparente onde o alfa original e baixo.
    transparent = alpha.point(lambda a: 255 if a < 128 else 0)
    new.paste(0, mask=transparent)
    return new


def save_gif(frames, out_path: Path, ms=DEFAULT_MS, scale=SCALE):
    """Salva uma lista de PIL.Image (RGBA) como GIF animado, ampliado.

    Usa escala inteira + NEAREST (sem borrar). A transparencia e preservada
    reservando o indice 0 da paleta. Frames de tamanhos diferentes sao
    centralizados num quadro comum para o GIF nao "pular"."""
    if not frames:
        print(f"  [skip] sem frames: {out_path.name}")
        return
    frames = [f.convert("RGBA") for f in frames]

    # Centraliza todos num quadro do tamanho do maior frame (antes de ampliar).
    cw, ch = _canvas_size(frames)
    centered = []
    for f in frames:
        canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        canvas.paste(f, ((cw - f.width) // 2, (ch - f.height) // 2))
        centered.append(scaled(canvas, scale))

    pal = [_to_palette_frame(f) for f in centered]
    durations = [ms] * len(pal)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    pal[0].save(
        out_path,
        save_all=True,
        append_images=pal[1:],
        duration=durations,
        loop=0,
        disposal=2,
        transparency=0,
        optimize=False,
    )
    print(f"  [ok] {out_path.relative_to(ROOT)}  {len(pal)} frames  {centered[0].size}")


# Exportar tambem a sequencia como PNGs numerados? GIF funde frames identicos
# consecutivos e so tem 256 cores + transparencia binaria. Para controle exato
# de frame e alfa real no DaVinci, a sequencia PNG e a melhor fonte. Ligado por
# padrao; os PNGs saem em assets_gif/<grupo>/<nome>/frame_000.png ...
EXPORT_PNG_SEQUENCE = True


def save_png_sequence(frames, out_dir: Path, scale=SCALE):
    """Salva cada frame como PNG numerado, ampliado (NEAREST), com alfa real.

    Mantem TODOS os frames (inclusive repetidos) e um quadro de tamanho fixo,
    para a sequencia nao "pular" ao ser importada no editor de video."""
    if not frames:
        return
    frames = [f.convert("RGBA") for f in frames]
    cw, ch = _canvas_size(frames)
    out_dir.mkdir(parents=True, exist_ok=True)
    for i, f in enumerate(frames):
        canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        canvas.paste(f, ((cw - f.width) // 2, (ch - f.height) // 2))
        scaled(canvas, scale).save(out_dir / f"frame_{i:03d}.png")


def crop_cell(sheet: Image.Image, col, row, cell, cx, cy, cw, ch):
    """Recorta a regiao util de uma celula da grade do spritesheet."""
    x = col * cell + cx
    y = row * cell + cy
    return sheet.crop((x, y, x + cw, y + ch))


def from_sheet(path, cell, cx, cy, cw, ch, row, frames, name, group, ms=DEFAULT_MS):
    """Gera GIF (e sequencia PNG) a partir de uma linha de um spritesheet."""
    sheet = Image.open(ASSETS / path).convert("RGBA")
    fr = [crop_cell(sheet, c, row, cell, cx, cy, cw, ch) for c in range(frames)]
    save_gif(fr, OUT / group / f"{name}.gif", ms=ms)
    if EXPORT_PNG_SEQUENCE:
        save_png_sequence(fr, OUT / group / name)


def from_files(paths, name, group, ms=DEFAULT_MS):
    """Gera GIF (e sequencia PNG) a partir de PNGs separados (um por frame)."""
    fr = []
    for p in paths:
        fp = ASSETS / p
        if fp.exists():
            fr.append(Image.open(fp).convert("RGBA"))
    save_gif(fr, OUT / group / f"{name}.gif", ms=ms)
    if EXPORT_PNG_SEQUENCE:
        save_png_sequence(fr, OUT / group / name)


def main():
    # ---------- Players (spritesheet 1 linha de celulas 100px) ----------
    players = [
        ("player_01", "p1"),
        ("player_02", "p2"),
    ]
    for folder, tag in players:
        # andar e andar assustado: crop 41,37,17,23 ; 8 frames
        from_sheet(f"{folder}/player_walk.png", 100, 41, 37, 17, 23, 0, 8,
                   f"{tag}_walk", "players", ms=100)
        from_sheet(f"{folder}/player_walk_scared.png", 100, 41, 37, 17, 23, 0, 8,
                   f"{tag}_walk_scared", "players", ms=100)
        # hurt: 5 frames, crop ~42,38,16,22
        from_sheet(f"{folder}/player_hurt.png", 100, 42, 38, 16, 22, 0, 5,
                   f"{tag}_hurt", "players", ms=120)

    # ---------- Inimigos (grade 8x6 de celulas 100px) ----------
    enemies = {
        "demon.png": dict(cx=28, cy=34, cw=52, ch=26, rows={
            "walk": (1, 8), "attack": (2, 7), "attack2": (3, 7), "death": (5, 4),
        }),
        "blood_monster.png": dict(cx=36, cy=30, cw=48, ch=30, rows={
            "walk": (1, 8), "attack": (2, 8), "attack2": (3, 8), "death": (5, 4),
        }),
    }
    for file, cfg in enemies.items():
        stem = file.replace(".png", "")
        for anim, (row, frames) in cfg["rows"].items():
            from_sheet(f"enemies/{file}", 100, cfg["cx"], cfg["cy"],
                       cfg["cw"], cfg["ch"], row, frames,
                       f"{stem}_{anim}", "enemies", ms=140)

    # ---------- Itens / cenario (frames separados) ----------
    seqs = {
        "coin": [f"coin/coin_{i}.png" for i in range(1, 5)],
        "box_1": [f"box_1/box_1_{i}.png" for i in range(1, 5)],
        "box_2": [f"box_2/box_2_{i}.png" for i in range(1, 5)],
        "chest": [f"chest/chest_{i}.png" for i in range(1, 5)],
        "chest_open": [f"chest/chest_open_{i}.png" for i in range(1, 5)],
        "peaks": [f"peaks/peaks_{i}.png" for i in (0, 1, 2, 3)],
        "arrow_trap": [f"arrow/arrow_{i}.png" for i in range(1, 5)],
        "torch": [f"torch/torch_{i}.png" for i in range(1, 5)],
        "side_torch": [f"torch/side_torch_{i}.png" for i in range(1, 5)],
        "candlestick_1": [f"torch/candlestick_1_{i}.png" for i in range(1, 5)],
        "candlestick_2": [f"torch/candlestick_2_{i}.png" for i in range(1, 5)],
        "flamethrower_1": [f"flamethrower/flamethrower_1_{i}.png" for i in range(1, 5)],
        "flamethrower_2": [f"flamethrower/flamethrower_2_{i}.png" for i in range(1, 5)],
        "keys_1": [f"keys/keys_1_{i}.png" for i in range(1, 5)],
        "keys_2": [f"keys/keys_2_{i}.png" for i in range(1, 5)],
    }
    for v in range(1, 5):
        seqs[f"flasks_{v}"] = [f"flasks/flasks_{v}_{i}.png" for i in range(1, 5)]

    for name, paths in seqs.items():
        from_files(paths, name, "items", ms=130)


if __name__ == "__main__":
    main()
