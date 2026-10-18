"""
build_tinyrpg_enemies.py — Gera as folhas de inimigos do "Tiny RPG Character
Asset Pack 02" no formato que o MeleeEnemy espera (uma grade de células
100x100, uma LINHA por animação) e o módulo de dados JS correspondente.

Lê direto do .zip do pack (não precisa extrair). Para cada personagem, só as
animações que o jogo USA entram na folha:

    linha 0  flash   (1 frame: silhueta clara do idle, pisca no hit stop)
    linha 1  walk    (Walk; voadores usam Flying)
    linha 2+ attack, attack2, attack3 (Attack01..03, variantes sem efeito
             de projétil/feixe quando existem)
    última   death

Também mede o recorte (bbox união de todos os frames usados), o frame de
impacto de cada ataque e descarta frames finais vazios da morte.

Saídas:
    assets/enemies/<arquivo>.png
    js/config/TinyRpgEnemies.js   (gerado, não editar à mão)

Uso:
    python tools/build_tinyrpg_enemies.py [caminho_do_zip]
"""
import io
import json
import os
import sys
import zipfile

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_ZIP = os.path.join(
    os.path.expanduser("~"), "Downloads",
    "Tiny RPG Character Asset Pack 02 v1.01-Full 20 Characters.zip")
SPLIT_DIR = "Characters(100x100 split)/"
CELL = 100
# Escala de pixel de arte -> mundo. 3.15 é a mesma do demon atual (82/26),
# assim os tamanhos relativos do pack são preservados.
PIXEL_SCALE = 3.15

# (pasta no pack, chave no jogo, arquivo, rótulo no editor, overrides de strip)
# Demon_A e Blood Monster_A já existem no jogo (demon / bloodMonster).
CHARACTERS = [
    ("Black Knight_A", "blackKnightA", "black_knight_a", "Cavaleiro Negro A", {}),
    ("Black Knight_B", "blackKnightB", "black_knight_b", "Cavaleiro Negro B", {}),
    ("Black Knight_C", "blackKnightC", "black_knight_c", "Cavaleiro Negro C",
     {"attack3": "Black Knight_C_Attack03(No beam effects)"}),
    ("Blood Monster_B", "bloodMonsterB", "blood_monster_b", "Monstro de Sangue B (Voador)", {}),
    ("Demoness_A", "demonessA", "demoness_a", "Demônia A", {}),
    ("Demoness_B", "demonessB", "demoness_b", "Demônia B", {}),
    ("Demon_B", "demonB", "demon_b", "Demônio B", {}),
    ("Demon_C", "demonC", "demon_c", "Demônio C", {}),
    ("Demon_D", "demonD", "demon_d", "Demônio D", {}),
    ("Demon_E", "demonE", "demon_e", "Demônio E", {}),
    ("Eyeball Monster", "eyeballMonster", "eyeball_monster", "Monstro Olho",
     {"attack3": "Eyeball Monster_Attack03(No beam effects)"}),
    ("Flame Golem", "flameGolem", "flame_golem", "Golem de Chamas", {}),
    ("Ghostfire", "ghostfire", "ghostfire", "Fogo Fantasma (Voador)",
     {"attack2": "Ghostfire_Attack02(No beam effects)"}),
    ("Hellbat", "hellbat", "hellbat", "Morcego Infernal (Voador)", {}),
    ("Hellhound", "hellhound", "hellhound", "Cão Infernal", {}),
    ("Lava Slime", "lavaSlime", "lava_slime", "Slime de Lava",
     {"attack2": "Lava Slime_Attack02(No spike effects)"}),
    ("Minotaur", "minotaur", "minotaur", "Minotauro", {}),
    ("Warlock", "warlock", "warlock", "Bruxo", {}),
]

# Ticks de jogo (60Hz) por frame — mesmos valores dos inimigos atuais.
WALK_TICKS = 6
DEATH_TICKS = 7


def attack_ticks(frames):
    # Golpes muito longos aceleram um pouco para não ficarem arrastados.
    if frames >= 14:
        return 3
    if frames >= 10:
        return 4
    return 5


def find_zip_root(zf):
    for name in zf.namelist():
        i = name.find(SPLIT_DIR)
        if i >= 0:
            return name[:i + len(SPLIT_DIR)]
    raise SystemExit("Pasta 'Characters(100x100 split)' não encontrada no zip")


def load_strip(zf, root, folder, base):
    """Strip sem sombra: <root>/<folder>/<folder>/<base>.png"""
    path = f"{root}{folder}/{folder}/{base}.png"
    try:
        data = zf.read(path)
    except KeyError:
        return None
    return Image.open(io.BytesIO(data)).convert("RGBA")


def split_frames(strip):
    n = strip.width // CELL
    return [strip.crop((i * CELL, 0, (i + 1) * CELL, CELL)) for i in range(n)]


def alpha_count(frame):
    return frame.getchannel("A").point(lambda a: 255 if a > 0 else 0).histogram()[255]


def bbox_union(frames):
    box = None
    for f in frames:
        b = f.getchannel("A").getbbox()
        if not b:
            continue
        box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]),
                                     max(box[2], b[2]), max(box[3], b[3]))
    return box


def hit_frame(frames):
    """Frame do impacto: onde o golpe mais avança para a frente (direita)."""
    rights = []
    for f in frames:
        b = f.getchannel("A").getbbox()
        rights.append(b[2] if b else 0)
    best = max(rights)
    if best == rights[0]:
        # Ataque sem avanço visível (magia/feitiço): impacto pouco após o meio.
        return max(1, min(len(frames) - 1, int(len(frames) * 0.55)))
    return max(1, rights.index(best))


def flash_frame(frame):
    """Silhueta quase branca (levemente rosada), igual ao flash dos atuais."""
    out = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    src = frame.load()
    dst = out.load()
    for y in range(frame.height):
        for x in range(frame.width):
            r, g, b, a = src[x, y]
            if a == 0:
                continue
            t = 0.9
            dst[x, y] = (int(r + (252 - r) * t), int(g + (232 - g) * t),
                         int(b + (232 - b) * t), a)
    return out


def build_character(zf, root, folder, overrides):
    p = folder  # prefixo dos arquivos = nome da pasta

    def strip(slot, *candidates):
        names = [overrides[slot]] if slot in overrides else []
        names += [f"{p}_{c}" for c in candidates]
        for n in names:
            s = load_strip(zf, root, folder, n)
            if s is not None:
                return s
        return None

    walk = strip("walk", "Walk", "Flying")
    idle = strip("idle", "Idle", "Flying")
    death = strip("death", "Death")
    attacks = [strip(k, f"Attack0{i}") for i, k in
               enumerate(["attack", "attack2", "attack3"], start=1)]
    if walk is None or death is None or attacks[0] is None:
        raise SystemExit(f"{folder}: faltam animações obrigatórias")

    walk_f = split_frames(walk)
    death_f = split_frames(death)
    atk_f = [split_frames(a) for a in attacks if a is not None]

    # Morte: descarta frames finais vazios/quase vazios (fade-out), pois o
    # último frame vira a fonte dos gibs e o "corpo" no chão.
    ref = alpha_count(walk_f[0])
    while len(death_f) > 1 and alpha_count(death_f[-1]) < ref * 0.15:
        death_f.pop()

    flash = flash_frame(split_frames(idle)[0] if idle is not None else walk_f[0])

    rows_frames = [[flash], walk_f] + atk_f + [death_f]
    cols = max(len(r) for r in rows_frames)
    sheet = Image.new("RGBA", (cols * CELL, len(rows_frames) * CELL), (0, 0, 0, 0))
    for r, frames in enumerate(rows_frames):
        for c, f in enumerate(frames):
            sheet.paste(f, (c * CELL, r * CELL))

    # Recorte = união de TODOS os frames usados (golpes largos não são
    # cortados). O "corpo" = união só do walk: é ele que fica centrado na
    # posição/colisão do inimigo (ver anchor em MeleeEnemy.draw).
    all_frames = walk_f + death_f + [f for a in atk_f for f in a]
    x0, y0, x1, y1 = bbox_union(all_frames)
    bx0, by0, bx1, by1 = bbox_union(walk_f)
    crop = {"cropX": x0, "cropY": y0, "cropW": x1 - x0, "cropH": y1 - y0,
            "body": {"x": bx0, "y": by0, "w": bx1 - bx0, "h": by1 - by0}}

    rows = {"walk": {"row": 1, "frames": len(walk_f), "fps": WALK_TICKS}}
    for i, frames in enumerate(atk_f):
        key = "attack" if i == 0 else f"attack{i + 1}"
        rows[key] = {"row": 2 + i, "frames": len(frames),
                     "fps": attack_ticks(len(frames)), "hitFrame": hit_frame(frames)}
    rows["death"] = {"row": 2 + len(atk_f), "frames": len(death_f), "fps": DEATH_TICKS}

    # Gibs saem do corpo caído (último frame da morte), não do recorte todo.
    gx0, gy0, gx1, gy1 = death_f[-1].getchannel("A").getbbox()
    gib_box = {"x": gx0, "y": gy0, "w": gx1 - gx0, "h": gy1 - gy0}

    return sheet, crop, rows, gib_box


def main():
    zip_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_ZIP
    out_dir = os.path.join(ROOT, "assets", "enemies")
    os.makedirs(out_dir, exist_ok=True)

    entries = []
    with zipfile.ZipFile(zip_path) as zf:
        root = find_zip_root(zf)
        for folder, key, fname, label, overrides in CHARACTERS:
            sheet, crop, rows, gib_box = build_character(zf, root, folder, overrides)
            rel = f"assets/enemies/{fname}.png"
            sheet.save(os.path.join(ROOT, rel), optimize=True)
            entries.append({
                "key": key, "label": label, "src": rel, "cellSize": CELL,
                **crop, "drawHeight": round(crop["cropH"] * PIXEL_SCALE),
                "rows": rows,
                "deathFlash": {"row": 0, "frame": 0},
                # Grade proporcional ao corpo caído (pedaços de ~5x4 px de arte).
                "gib": {"gridCols": max(3, min(5, round(gib_box["w"] / 5))),
                        "gridRows": max(2, min(4, round(gib_box["h"] / 4))),
                        "box": gib_box},
            })
            print(f"{key:16} {sheet.size} crop={crop} rows={ {k: (v['frames'], v.get('hitFrame')) for k, v in rows.items()} }")

    js = (
        "// GERADO por tools/build_tinyrpg_enemies.py — não editar à mão.\n"
        "// Inimigos do Tiny RPG Character Asset Pack 02 (folhas em grade 100x100,\n"
        "// linha 0 = flash, 1 = walk, depois ataques e por último death).\n"
        "export const TINY_RPG_ENEMIES = "
        + json.dumps(entries, ensure_ascii=False, indent=4) + ";\n"
    )
    with open(os.path.join(ROOT, "js", "config", "TinyRpgEnemies.js"), "w", encoding="utf-8") as f:
        f.write(js)
    print(f"{len(entries)} inimigos gerados")


if __name__ == "__main__":
    main()
