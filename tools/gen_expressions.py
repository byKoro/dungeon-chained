"""Gera variações de expressão (olhos + sobrancelhas) dos jogadores.

Lê assets/player_0X/player_walk.png (8 frames de 100x100) e, para cada
expressão, repinta só a região dos olhos/sobrancelhas de cada frame,
salvando em assets/player_0X/expressions/<nome>.png com o MESMO layout
(drop-in no lugar da folha de caminhada).

O rosto é localizado por frame pelo pixel branco do olho esquerdo
(x=49 dentro da célula; o y varia com o balanço da caminhada).

Uso:  python tools/gen_expressions.py [--preview caminho.png]
"""
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLAYERS = ["player_01", "player_02"]
CELL = 100
EYE_X = 49  # coluna do branco do olho esquerdo (o direito fica em +3)

# Cada expressão é uma grade 5x4 começando em (EYE_X, ey-2):
#   linha 0 = testa (ey-2), 1 = sobrancelha (ey-1), 2 = olho (ey), 3 = abaixo (ey+1)
# Tokens: '.' mantém original | 's' pele | 'b' sobrancelha | 'w' branco
#         'p' pupila | 'r' pupila vermelha (fúria)
# Na linha 3 as colunas 0 e 4 são barba/contorno e sempre mantidas.
EXPRESSIONS = {
    "neutro": [
        ".....",
        ".....",
        ".....",
        ".....",
    ],
    # Sobrancelhas sobem e os olhos ficam com 2px de altura.
    "assustado": [
        "bbsbb",
        "wwsww",
        "wpswp",
        ".sss.",
    ],
    # Olhos todo brancos, sem pupila (espanto cartunesco).
    "espantado": [
        "bbsbb",
        "wwsww",
        "wwsww",
        ".sss.",
    ],
    # Sobrancelhas grossas em "V": ponta externa sobe, interna pesa no olho.
    "raiva": [
        "bsssb",
        "bbsbb",
        "wpswp",
        ".sss.",
    ],
    # Igual à raiva, mas com pupilas vermelhas.
    "furia": [
        "bsssb",
        "bbsbb",
        "wrswr",
        ".sss.",
    ],
    # Pontas internas das sobrancelhas sobem (medo/tristeza).
    "preocupado": [
        ".bsb.",
        "bbsbb",
        "wpswp",
        ".sss.",
    ],
    # Uma sobrancelha erguida, o outro olho semicerrado.
    "desconfiado": [
        "...bb",
        "bbsss",
        "bpswp",
        ".sss.",
    ],
    "olhando_esquerda": [
        ".....",
        ".....",
        "pwspw",
        ".....",
    ],
    "olhando_direita": [
        ".....",
        ".....",
        "wpswp",
        ".....",
    ],
    "olhando_cima": [
        "bbsbb",
        "wpswp",
        "wwsww",
        ".sss.",
    ],
    "olhos_fechados": [
        ".....",
        "sssss",
        "bbsbb",
        ".sss.",
    ],
}

FURY_RED = (230, 40, 40, 255)


def palette(img, ox, ey):
    """Extrai as cores do próprio personagem a partir do frame original."""
    px = lambda x, y: img.getpixel((ox + x, y))
    return {
        "w": px(EYE_X, ey),          # branco do olho
        "p": px(EYE_X + 1, ey),      # pupila
        "b": px(EYE_X, ey - 1),      # sobrancelha
        "s": px(EYE_X + 2, ey),      # pele clara (entre os olhos)
        "sd": px(EYE_X, ey - 2),     # pele na sombra (borda esquerda)
        "r": FURY_RED,
    }


def find_eye_y(img, ox):
    for y in range(CELL):
        c = img.getpixel((ox + EYE_X, y))
        if c[3] > 0 and c[:3] == (255, 255, 255):
            return y
    return None


def apply(img, grid):
    out = img.copy()
    frames = img.size[0] // CELL
    for f in range(frames):
        ox = f * CELL
        ey = find_eye_y(img, ox)
        if ey is None:
            continue
        pal = palette(img, ox, ey)
        for r, row in enumerate(grid):
            for c, tok in enumerate(row):
                if tok == "." or (r == 3 and c in (0, 4)):
                    continue
                if tok == "s":
                    color = pal["sd"] if c == 0 else pal["s"]
                else:
                    color = pal[tok]
                out.putpixel((ox + EYE_X + c, ey - 2 + r), color)
    return out


def main():
    preview_path = None
    if "--preview" in sys.argv:
        preview_path = sys.argv[sys.argv.index("--preview") + 1]

    rows = []
    for p in PLAYERS:
        src = Image.open(os.path.join(ROOT, "assets", p, "player_walk.png")).convert("RGBA")
        out_dir = os.path.join(ROOT, "assets", p, "expressions")
        os.makedirs(out_dir, exist_ok=True)
        for name, grid in EXPRESSIONS.items():
            sheet = apply(src, grid)
            sheet.save(os.path.join(out_dir, f"{name}.png"))
            rows.append((p, name, sheet))
        print(f"{p}: {len(EXPRESSIONS)} expressões em {out_dir}")

    if preview_path:
        # Prévia: frame 0 de cada expressão, ampliado 10x, um personagem por linha.
        z, w, h = 10, 20, 22
        names = list(EXPRESSIONS)
        prev = Image.new("RGBA", (len(names) * w * z, len(PLAYERS) * h * z), (60, 60, 70, 255))
        for i, (p, name, sheet) in enumerate(rows):
            col, line = names.index(name), PLAYERS.index(p)
            crop = sheet.crop((40, 37, 60, 59))
            bg = Image.new("RGBA", crop.size, (90, 90, 100, 255))
            bg.alpha_composite(crop)
            prev.paste(bg.resize((w * z, h * z), Image.NEAREST), (col * w * z, line * h * z))
        prev.save(preview_path)
        print("prévia:", preview_path)


if __name__ == "__main__":
    main()
