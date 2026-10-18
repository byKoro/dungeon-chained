"""Gera a animação de QUEDA no buraco dos jogadores (estilo .kiro/fall.png).

Referência: personagem inclinado, de braços abertos, encolhendo em 4 passos
e sumindo num brilho "+" (grande e depois pequeno) = 6 frames.

Lê o frame 0 de assets/player_0X/player_walk.png (células 100x100), tira a
sombra, abre os braços para cima (pose de "caindo"), inclina com RotSprite
(scale2x x3 -> gira -> reduz) e gera os tamanhos menores com contorno
refeito. Saída: assets/player_0X/player_fall.png (6 frames de 100x100, mesmo
centro da folha de caminhada -> drop-in no AssetLoader).

Uso:  python tools/gen_fall.py [--preview caminho.png]
"""
import math
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLAYERS = ["player_01", "player_02"]
CELL = 100
OUTLINE = (31, 26, 26, 255)
CLEAR = (0, 0, 0, 0)
SPARK = (255, 255, 255, 255)
EYE = (255, 255, 255, 255)         # branco do olho (rastreado à parte)

TILT = 14                          # graus (anti-horário = cabeça p/ esquerda)
SCALES = [1.0, 0.78, 0.58, 0.42]   # proporção dos 4 frames do personagem
CENTER = (51, 49)                  # centro do corpo na célula (igual à caminhada)

# Braços erguidos (pose de queda). Coordenadas ABSOLUTAS na célula 100x100 do
# frame 0. Tokens: 'o' contorno | 's' manga | 'g' luva clara | 'G' luva escura.
# Cada braço sai do ombro e sobe na diagonal, terminando na manopla de aço.
ARMS = {
    # (x0, y0, desenho)
    "left": (40, 45, [
        ".oo...",
        "ogGo..",
        "oGGso.",
        ".ooss.",
        "...oss",
        "....os",
    ]),
    "right": (55, 45, [
        "...oo.",
        "..oGgo",
        ".osGGo",
        ".ssoo.",
        "sso...",
        "so....",
    ]),
}

# Cores do braço por jogador (manga = cor do braço original de cada um).
ARM_COLORS = {
    "player_01": {"s": (103, 32, 32, 255), "g": (155, 173, 183, 255), "G": (96, 117, 129, 255)},
    "player_02": {"s": (21, 103, 51, 255), "g": (155, 173, 183, 255), "G": (96, 117, 129, 255)},
}

# Região do braço original encostado no corpo (vira tronco/contorno ao abrir).
# Pixels de manga/luva dentro destes retângulos são apagados antes de redesenhar.
ARM_ERASE = [(44, 50, 48, 54), (53, 53, 57, 54)]


# ---------------------------------------------------------------- utilidades
def to_grid(img):
    w, h = img.size
    px = img.load()
    return [[px[x, y] for x in range(w)] for y in range(h)]


def from_grid(g):
    h, w = len(g), len(g[0])
    img = Image.new("RGBA", (w, h))
    px = img.load()
    for y in range(h):
        for x in range(w):
            px[x, y] = g[y][x]
    return img


def scale2x(g):
    """EPX/Scale2x: dobra a resolução preservando diagonais do pixel art."""
    h, w = len(g), len(g[0])
    out = [[CLEAR] * (w * 2) for _ in range(h * 2)]
    get = lambda x, y: g[min(max(y, 0), h - 1)][min(max(x, 0), w - 1)]
    for y in range(h):
        for x in range(w):
            p = g[y][x]
            a, b, c, d = get(x, y - 1), get(x + 1, y), get(x - 1, y), get(x, y + 1)
            e0 = e1 = e2 = e3 = p
            if c == a and c != d and a != b:
                e0 = a
            if a == b and a != c and b != d:
                e1 = b
            if d == c and d != b and c != a:
                e2 = c
            if b == d and b != a and d != c:
                e3 = d
            out[2 * y][2 * x], out[2 * y][2 * x + 1] = e0, e1
            out[2 * y + 1][2 * x], out[2 * y + 1][2 * x + 1] = e2, e3
    return out


def strip_edge_outline(img):
    """Remove só o contorno EXTERNO (pixels de contorno colados no vazio)."""
    out = img.copy()
    src, dst = img.load(), out.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            if src[x, y][:3] != OUTLINE[:3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if not (0 <= nx < w and 0 <= ny < h) or src[nx, ny][3] == 0:
                    dst[x, y] = CLEAR
                    break
    return out


def add_outline(img):
    """Contorno de 1px (4-vizinhos) em volta de tudo que for opaco."""
    w, h = img.size
    out = Image.new("RGBA", (w + 2, h + 2), CLEAR)
    out.paste(img, (1, 1))
    src = out.copy().load()
    dst = out.load()
    for y in range(h + 2):
        for x in range(w + 2):
            if src[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w + 2 and 0 <= ny < h + 2 and src[nx, ny][3]:
                    dst[x, y] = OUTLINE
                    break
    return out


# ------------------------------------------------------------------- etapas
def fall_pose(sheet, player):
    """Frame 0 sem sombra e com os braços abertos para cima."""
    cell = sheet.crop((0, 0, CELL, CELL)).copy()
    px = cell.load()
    # Sombra = pixels semitransparentes; contorno opaco das pernas fica.
    for y in range(CELL):
        for x in range(CELL):
            if 0 < px[x, y][3] < 255:
                px[x, y] = CLEAR
    # Apaga o braço colado no corpo: manga/luva (e o contorno deles) somem e
    # só vira contorno o que encosta no tronco, deixando a cintura fina.
    arm = ARM_COLORS[player]
    arm_rgb = {c[:3] for c in arm.values()} | {OUTLINE[:3]}
    erased = []
    for x0, y0, x1, y1 in ARM_ERASE:
        for y in range(y0, y1):
            for x in range(x0, x1):
                if px[x, y][3] and px[x, y][:3] in arm_rgb:
                    px[x, y] = CLEAR
                    erased.append((x, y))
    for x, y in erased:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = px[x + dx, y + dy]
            if n[3] and n[:3] != OUTLINE[:3]:
                px[x, y] = OUTLINE
                break
    # Desenha os braços erguidos (só onde está vazio ou já é contorno, para não
    # cobrir rosto/barba).
    colors = {"o": OUTLINE, **arm}
    for x0, y0, rows in ARMS.values():
        for r, row in enumerate(rows):
            for c, tok in enumerate(row):
                if tok == ".":
                    continue
                x, y = x0 + c, y0 + r
                cur = px[x, y]
                vazio = cur[3] == 0
                contorno = cur[:3] == OUTLINE[:3]
                if vazio or (contorno and tok != "o"):
                    px[x, y] = colors[tok]
    bb = cell.getchannel("A").getbbox()
    pose = cell.crop(bb)
    return pose, extract_eyes(pose)


# ------------------------------------------------------------------- olhos
# Olhos de 1px somem/duplicam ao girar e reduzir. Por isso eles saem da arte
# (viram pele), seguem como pontos pelas transformações e são carimbados de
# volta no fim de cada etapa. Ponto = (x, y, cor), com x/y no centro do pixel.
def extract_eyes(img):
    px = img.load()
    feats, skin = [], None
    for y in range(img.height):
        for x in range(img.width):
            if px[x, y] == EYE:
                feats.append((x + 0.5, y + 0.5, EYE))
                if x + 1 < img.width:
                    feats.append((x + 1.5, y + 0.5, px[x + 1, y]))   # pupila
                    if skin is None and x + 2 < img.width:
                        skin = px[x + 2, y]                          # pele entre os olhos
    for fx, fy, _ in feats:
        px[int(fx), int(fy)] = skin
    return feats


def stamp_eyes(img, feats, pupils=True):
    """Carimba pupilas e depois os brancos (o branco vence se colidirem)."""
    px = img.load()
    order = [f for f in feats if f[2] != EYE] if pupils else []
    order += [f for f in feats if f[2] == EYE]
    for fx, fy, color in order:
        x, y = int(fx), int(fy)
        if 0 <= x < img.width and 0 <= y < img.height and px[x, y][3]:
            px[x, y] = color


def crop_with_feats(img, feats):
    bb = img.getchannel("A").getbbox()
    return img.crop(bb), [(x - bb[0], y - bb[1], c) for x, y, c in feats]


def rotsprite(img, feats, angle):
    """RotSprite simplificado: 8x com Scale2x, gira em NEAREST, volta a 1x."""
    pad = 6
    big = Image.new("RGBA", (img.width + pad * 2, img.height + pad * 2), CLEAR)
    big.paste(img, (pad, pad))
    g = to_grid(big)
    for _ in range(3):
        g = scale2x(g)
    up = from_grid(g)
    rot = up.rotate(angle, resample=Image.NEAREST, expand=False)
    small = mode_downscale(rot, *big.size)
    # Mesma rotação nos olhos (PIL gira anti-horário em torno do centro).
    cx, cy = big.width / 2, big.height / 2
    cs, sn = math.cos(math.radians(angle)), math.sin(math.radians(angle))
    moved = []
    for x, y, c in feats:
        dx, dy = x + pad - cx, y + pad - cy
        moved.append((cx + dx * cs + dy * sn, cy - dx * sn + dy * cs, c))
    stamp_eyes(small, moved)
    return crop_with_feats(small, moved)


def shrink(img, feats, scale):
    """Reduz mantendo leitura: tira contorno externo, reduz, recontorna."""
    if scale >= 1.0:
        return img
    stripped = strip_edge_outline(img)
    bb = stripped.getchannel("A").getbbox()
    core = stripped.crop(bb)
    g = to_grid(core)
    for _ in range(2):
        g = scale2x(g)
    up = from_grid(g)
    w = max(1, round(core.width * scale))
    h = max(1, round(core.height * scale))
    small = mode_downscale(up, w, h)
    sx, sy = w / core.width, h / core.height
    moved = [((x - bb[0]) * sx, (y - bb[1]) * sy, c) for x, y, c in feats]
    stamp_eyes(small, moved, pupils=scale >= 0.7)
    return add_outline(small)


def mode_downscale(img, w, h):
    """Redução por "cor dominante" do bloco (sem misturar cores = pixel art)."""
    src = img.load()
    sw, sh = img.size
    out = Image.new("RGBA", (w, h), CLEAR)
    dst = out.load()
    for ty in range(h):
        y0, y1 = ty * sh // h, max(ty * sh // h + 1, (ty + 1) * sh // h)
        for tx in range(w):
            x0, x1 = tx * sw // w, max(tx * sw // w + 1, (tx + 1) * sw // w)
            count, total, empty = {}, 0, 0
            for y in range(y0, y1):
                for x in range(x0, x1):
                    p = src[x, y]
                    total += 1
                    if p[3] == 0:
                        empty += 1
                    else:
                        count[p] = count.get(p, 0) + 1
            if not count or empty * 2 > total:
                continue
            dst[tx, ty] = max(count, key=count.get)
    return out


def sparkle(size):
    """Brilho '+' branco (como os dois últimos frames da referência)."""
    img = Image.new("RGBA", (size, size), CLEAR)
    m = size // 2
    for i in range(size):
        img.putpixel((m, i), SPARK)
        img.putpixel((i, m), SPARK)
    return img


def build_sheet(player):
    walk = Image.open(os.path.join(ROOT, "assets", player, "player_walk.png")).convert("RGBA")
    pose, eyes = fall_pose(walk, player)
    base, eyes = rotsprite(pose, eyes, TILT)
    frames = [shrink(base, eyes, s) for s in SCALES] + [sparkle(7), sparkle(3)]
    sheet = Image.new("RGBA", (CELL * len(frames), CELL), CLEAR)
    for i, f in enumerate(frames):
        x = i * CELL + CENTER[0] - f.width // 2
        y = CENTER[1] - f.height // 2
        sheet.alpha_composite(f, (x, y))
    return sheet


def main():
    preview_path = None
    if "--preview" in sys.argv:
        preview_path = sys.argv[sys.argv.index("--preview") + 1]

    sheets = []
    for p in PLAYERS:
        sheet = build_sheet(p)
        out = os.path.join(ROOT, "assets", p, "player_fall.png")
        sheet.save(out)
        sheets.append(sheet)
        print(f"{p}: {sheet.width // CELL} frames -> {out}")

    if preview_path:
        # Prévia: recorte central de cada frame, 8x, um jogador por linha.
        z, half = 8, 16
        n = sheets[0].width // CELL
        prev = Image.new("RGBA", (n * half * 2 * z, len(sheets) * half * 2 * z), (60, 60, 70, 255))
        for line, sheet in enumerate(sheets):
            for i in range(n):
                cx = i * CELL + CENTER[0]
                crop = sheet.crop((cx - half, CENTER[1] - half, cx + half, CENTER[1] + half))
                bg = Image.new("RGBA", crop.size, (60, 60, 70, 255))
                bg.alpha_composite(crop)
                prev.paste(bg.resize((half * 2 * z,) * 2, Image.NEAREST), (i * half * 2 * z, line * half * 2 * z))
        prev.save(preview_path)
        print("prévia:", preview_path)


if __name__ == "__main__":
    main()
