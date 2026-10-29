"""Gera os sprites da gaiola do Salão e da corda (pixel art à mão, paleta do tileset/baús).

Uso: python scripts/gen-cage-sprites.py            (escreve em assets/cage/)
     python scripts/gen-cage-sprites.py --preview  (também escreve _local/cage-preview.png, 8x)

Saída (1 px = 1 pixel de arte; o jogo desenha a 4 px de mundo por pixel):
  cage_hang.png    24x32  gaiola pendurada, fechada
  cage_open.png    24x32  mesma gaiola com o alçapão de baixo aberto (cada corte)
  cage_broken.png  32x16  destroços no chão
  rope_stake.png   10x16  estaca com a corda amarrada
  rope.png          8x4   textura repetida da corda (desenhada ao longo da curva)
  rope_end.png      6x6   ponta desfiada da corda cortada
"""
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "cage")

PAL = {
    ".": None,
    "o": "#25131a",  # contorno (mesmo de baús, bigorna, tileset)
    "D": "#62505a",  # ferro escuro (bigorna)
    "M": "#90919e",  # ferro
    "L": "#adc1cf",  # ferro claro
    "S": "#bbd3e1",  # brilho
    "k": "#3d253b",  # grades de trás, na sombra (pedra escura do tileset)
    "b": "#523b40",  # madeira escura
    "w": "#895a45",  # madeira
    "r": "#bf704d",  # ferrugem/madeira clara
    "h": "#0b0608",  # buraco do alçapão
    "1": "#c29a62",  # corda clara
    "2": "#8e6a43",  # corda
    "3": "#5a4030",  # corda escura
    "g": "#4c2f49",  # terra/pedra do pé da estaca
}


def rgba(key):
    c = PAL[key]
    if c is None:
        return (0, 0, 0, 0)
    return (int(c[1:3], 16), int(c[3:5], 16), int(c[5:7], 16), 255)


def from_rows(rows):
    w = len(rows[0])
    for i, r in enumerate(rows):
        assert len(r) == w, f"linha {i} com {len(r)} colunas (esperado {w})"
    img = Image.new("RGBA", (w, len(rows)))
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            img.putpixel((x, y), rgba(ch))
    return img


def bar_row(shift=0):
    """Grades: frente em ferro (claro à esquerda, escuro à direita), de trás na sombra; vão transparente."""
    r = ["."] * 24
    r[2] = r[21] = "o"
    r[3], r[20] = "M", "D"               # montantes laterais
    for x in (6, 10, 14, 18):            # grades da frente
        r[x - 1 + shift] = "L"
        r[x + shift] = "D"
    for x in (8, 12, 16):                # grades de trás
        r[x] = "k"
    return "".join(r)


BAR = bar_row()
BAND_W = "..o" + "wrwwMwwwwrwwwMwwrb" + "o.."   # cinta de madeira com rebites
BAND_B = "..o" + "b" * 17 + "o" + "o.."
BAND_I = "..o" + "DMMDDMMDDMMDDMMDDD" + "o.."   # aro de ferro do meio


def cage(open_hatch):
    rows = [
        "..........oooo..........",
        ".........oMLLDo.........",
        ".........oL..Do.........",
        ".........oDooDo.........",
        "..........oMDo..........",
        "........oooMDooo........",
        "......ooLLMMDDDDoo......",
        "....ooLSLMMMDDDDDDoo....",
        "...oLLLMMMMDDDDDDDDDo...",
        "..o" + "MMMMMDDDDDDDDDDDkk" + "o..",
        BAND_W,
        BAND_B,
        BAR, BAR, BAR, BAR, BAR,
        BAND_I,
        BAR, BAR, BAR, BAR, BAR, BAR,
        BAND_W,
        BAND_B,
    ]
    if open_hatch:
        # Alçapão aberto: buraco escuro no fundo e a tampa pendurada pela dobradiça da direita.
        rows += [
            "..o" + "DDDDDD" + "hhhhhh" + "DDDDDD" + "o..",
            "...oooooohhhhhhMooooo...",
            "..............oMDo......",
            ".............oMDo.......",
            "............oMDo........",
            "............ooo.........",
        ]
    else:
        rows += [
            "..o" + "DDDDDDMMMMMMDDDDDD" + "o..",
            "...oooooooooooooooooo...",
            "........................",
            "........................",
            "........................",
            "........................",
        ]
    return from_rows(rows)


class Canvas:
    """Desenho por primitivas com contorno automático de 1 px em volta do que foi pintado."""

    def __init__(self, w, h):
        self.w, self.h = w, h
        self.px = [["."] * w for _ in range(h)]

    def put(self, x, y, k):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[y][x] = k

    def rect(self, x0, y0, x1, y1, k):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.put(x, y, k)

    def line(self, x0, y0, x1, y1, k):
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx + dy
        while True:
            self.put(x0, y0, k)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x0 += sx
            if e2 <= dx:
                err += dx
                y0 += sy

    def bar(self, x0, y0, x1, y1):
        """Barra de ferro de 2 px: claro em cima, ferro embaixo."""
        self.line(x0, y0 + 1, x1, y1 + 1, "M")
        self.line(x0, y0, x1, y1, "L")

    def outline(self):
        filled = {(x, y) for y in range(self.h) for x in range(self.w) if self.px[y][x] not in (".", "o")}
        for (x, y) in filled:
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < self.w and 0 <= ny < self.h and self.px[ny][nx] == ".":
                    self.px[ny][nx] = "o"

    def image(self):
        return from_rows(["".join(r) for r in self.px])


def broken():
    c = Canvas(32, 16)
    # Cúpula tombada à esquerda: ferro claro à esquerda, escuro à direita, borda de baixo amassada.
    dome = [(5, 8), (3, 10), (2, 11), (2, 11), (2, 11), (3, 10)]
    for i, (x0, x1) in enumerate(dome):
        y = 4 + i
        c.rect(x0, y, x1, y, "D")
        c.rect(x0, y, x0 + 2 + i // 2, y, "M")
    c.rect(4, 4, 6, 4, "L")
    c.put(4, 5, "S")
    c.put(5, 10, "D"); c.put(8, 10, "D"); c.put(10, 10, "D")  # dentes da borda quebrada
    c.put(13, 6, "M"); c.put(14, 7, "D")  # argola solta
    # Pedaço da cinta de madeira.
    c.rect(13, 10, 22, 11, "w")
    c.put(15, 10, "r"); c.put(19, 10, "r")
    c.rect(13, 12, 22, 12, "b")
    # Grades tortas.
    c.bar(15, 2, 18, 8)
    c.bar(22, 1, 26, 7)
    c.bar(24, 9, 30, 11)
    c.bar(2, 12, 9, 13)
    # Chapa do fundo.
    c.rect(23, 13, 29, 13, "D")
    c.outline()
    return c.image()


def stake():
    c = Canvas(10, 16)
    c.rect(1, 13, 8, 14, "g")          # terra em volta do pé
    c.rect(3, 2, 6, 13, "w")           # poste
    c.rect(6, 2, 6, 13, "b")
    c.rect(3, 2, 3, 12, "r")
    c.rect(4, 1, 5, 1, "w")            # topo arredondado
    c.rect(2, 6, 7, 6, "1")            # voltas da corda
    c.rect(2, 7, 7, 7, "2")
    c.rect(2, 9, 7, 9, "1")
    c.rect(2, 10, 7, 10, "3")
    c.put(8, 7, "1"); c.put(8, 8, "2")  # nó
    c.outline()
    return c.image()


def rope():
    return from_rows([
        "oooooooo",
        "11211121",
        "23322332",
        "oooooooo",
    ])


def rope_end():
    return from_rows([
        "..o.o.",
        ".o1o2o",
        "o121o.",
        "o2332o",
        ".o33o.",
        "..oo..",
    ])


def main():
    os.makedirs(OUT, exist_ok=True)
    sprites = {
        "cage_hang.png": cage(False),
        "cage_open.png": cage(True),
        "cage_broken.png": broken(),
        "rope_stake.png": stake(),
        "rope.png": rope(),
        "rope_end.png": rope_end(),
    }
    for name, img in sprites.items():
        img.save(os.path.join(OUT, name))
        print(f"{name} {img.size[0]}x{img.size[1]}")
    if "--preview" in sys.argv:
        scale, pad = 8, 8
        w = sum(i.size[0] for i in sprites.values()) * scale + pad * (len(sprites) + 1)
        h = max(i.size[1] for i in sprites.values()) * scale + pad * 2
        sheet = Image.new("RGBA", (w, h), (61, 37, 59, 255))
        x = pad
        for img in sprites.values():
            big = img.resize((img.size[0] * scale, img.size[1] * scale), Image.NEAREST)
            sheet.alpha_composite(big, (x, pad))
            x += big.size[0] + pad
        os.makedirs(os.path.join(ROOT, "_local"), exist_ok=True)
        sheet.save(os.path.join(ROOT, "_local", "cage-preview.png"))
        print("preview _local/cage-preview.png")


if __name__ == "__main__":
    main()
