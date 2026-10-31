"""Gera o sprite das Botas aladas (item que flutua sobre a bigorna na sala "botas").

Uso: python scripts/gen-boots.py            (escreve assets/boots/boots.png)
     python scripts/gen-boots.py --preview  (também escreve _local/boots-preview.png)

Origem: pixel art desenhada à mão em código, sem IA generativa nem asset de terceiros, a partir de uma imagem de
referência do time (par de botas de couro com asa branca e fivela dourada). 16x16, 1 px de arte = 4 px de mundo
(BOOTS.artScale). Paleta dos props (contorno #25131a dos baús/bigorna/chave, couro dos baús, ouro da chave/moeda,
metal claro dos baús para a asa).
"""
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "boots", "boots.png")

PAL = {
    "o": "#25131a",  # contorno
    "d": "#523b40",  # couro na sombra
    "m": "#724736",  # couro escuro
    "n": "#895a45",  # couro
    "l": "#bf704d",  # couro claro
    "h": "#c29a62",  # brilho do couro
    "s": "#3d253b",  # sola
    "g": "#c09344",  # fivela
    "y": "#ffd569",  # fivela, brilho
    "w": "#ffffff",  # pena
    "b": "#bbd3e1",  # pena, meio-tom
    "a": "#90919e",  # pena, sombra
}

# Par em 3/4, bico para a direita: bota da frente à esquerda/abaixo (punho dobrado, fivela, asa no calcanhar),
# bota de trás acima/à direita (só punho, cano e bico aparecem, mais a ponta da asa dela).
ART = [
    ".......o........",
    ".o....obooooooo.",
    "owo...obohlllno.",
    "owwo..oaonnnnmo.",
    "obww" + "o" * 11 + ".",
    "owbwohllnodnmo..",
    "oawbonnnmodnmo..",
    ".oaodddddodnmoo.",
    "..oolnnmoodnnlho",
    "...omgymooonnllo",
    "...ongnnlhloommo",
    "...onnnnnnnlosso",
    "...omnnnnnnmooo.",
    "...odmmmmmmdo...",
    "...o" + "s" * 8 + "o...",
    "....oooooooo....",
]


def rgba(key):
    c = PAL.get(key)
    if c is None:
        return (0, 0, 0, 0)
    return (int(c[1:3], 16), int(c[3:5], 16), int(c[5:7], 16), 255)


def build():
    w = len(ART[0])
    for i, r in enumerate(ART):
        assert len(r) == w, f"linha {i} com {len(r)} colunas (esperado {w})"
    img = Image.new("RGBA", (w, len(ART)), (0, 0, 0, 0))
    for y, row in enumerate(ART):
        for x, ch in enumerate(row):
            img.putpixel((x, y), rgba(ch))
    return img


def preview(img):
    """Esquerda: arte a 16x sobre xadrez. Direita: escala do jogo (4x) sobre a bigorna, no chão do tileset."""
    big = img.resize((img.width * 16, img.height * 16), Image.NEAREST)
    tile = 64
    sheet = Image.new("RGBA", (big.width + tile * 3, big.height), (61, 37, 59, 255))
    for y in range(0, big.height, 16):
        for x in range(0, big.width, 16):
            c = (70, 70, 78, 255) if (x // 16 + y // 16) % 2 else (52, 52, 60, 255)
            sheet.paste(c, (x, y, x + 16, y + 16))
    sheet.alpha_composite(big, (0, 0))
    anvil = Image.open(os.path.join(ROOT, "assets", "anvil", "anvil.png")).convert("RGBA")
    anvil = anvil.resize((anvil.width * 4, anvil.height * 4), Image.NEAREST)
    boots = img.resize((img.width * 4, img.height * 4), Image.NEAREST)
    ox, base_y = big.width + tile, tile * 3
    sheet.alpha_composite(anvil, (ox - 16, base_y - anvil.height + 24))
    sheet.alpha_composite(boots, (ox - 16 + (anvil.width - boots.width) // 2, base_y - anvil.height - boots.height + 40))
    return sheet


def main():
    img = build()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    img.save(OUT)
    print(f"escrito {os.path.relpath(OUT, ROOT)} {img.size}")
    if "--preview" in sys.argv:
        prev = os.path.join(ROOT, "_local", "boots-preview.png")
        os.makedirs(os.path.dirname(prev), exist_ok=True)
        preview(img).save(prev)
        print(f"preview {os.path.relpath(prev, ROOT)}")


if __name__ == "__main__":
    main()
