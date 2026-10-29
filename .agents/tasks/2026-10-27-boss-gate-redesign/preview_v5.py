import sys
from PIL import Image

ver = sys.argv[1] if len(sys.argv) > 1 else 'v5'
strip = Image.open(f'assets/doors/boss-gate-opening-strip-{ver}.png').convert('RGBA')
t = Image.open('assets/tileset/tileset.png').convert('RGBA')
tile = lambda i: t.crop(((i % 10) * 16, (i // 10) * 16, (i % 10) * 16 + 16, (i // 10) * 16 + 16))
frames = [strip.crop((i * 32, 0, i * 32 + 32, 32)) for i in range(4)]

COLS, ROWS = 8, 4
scenes = Image.new('RGBA', (4 * (COLS * 16 + 4), (ROWS + 1) * 16), (0x17, 0x12, 0x1e, 255))
top = [0, 1, 2, 3, 4, 1, 2, 5]
# Behind the gate, as the game draws it: door cells hold floor tile 16 (placeDoor);
# above the wall is the background tile 78 while locked, the corridor stub tile 17 once open.
for n, fr in enumerate(frames):
    room = Image.new('RGBA', (COLS * 16, (ROWS + 1) * 16), (0x05, 0x03, 0x04, 255))
    for c in range(COLS):
        room.alpha_composite(tile(top[c]), (c * 16, 16))
        for r in range(2, ROWS + 1):
            room.alpha_composite(tile(10 if c == 0 else 15 if c == COLS - 1 else 16), (c * 16, r * 16))
    for c in (3, 4):
        room.alpha_composite(tile(78 if n == 0 else 17), (c * 16, 0))
        room.alpha_composite(tile(16), (c * 16, 16))
    room.alpha_composite(fr, (3 * 16, 0))
    scenes.alpha_composite(room, (n * (COLS * 16 + 4), 0))
scenes.resize((scenes.width * 4, scenes.height * 4), Image.NEAREST).save(f'.agents/tasks/2026-10-27-boss-gate-redesign/{ver}-in-wall-x4.png')
strip.resize((strip.width * 8, strip.height * 8), Image.NEAREST).save(f'.agents/tasks/2026-10-27-boss-gate-redesign/{ver}-strip-x8.png')
print('ok')
