from PIL import Image

sheet = Image.open('assets/doors/boss-gate-opening-sheet-v4.png').convert('RGBA')
tiles = Image.open('assets/tileset/tileset.png').convert('RGBA')
room = tiles.crop((0, 0, 96, 96))
frames = [sheet.crop(((i % 2) * 48, (i // 2) * 48, (i % 2) * 48 + 48, (i // 2) * 48 + 48)) for i in range(4)]

strip = Image.new('RGBA', (4 * 104, 104), (0x17, 0x12, 0x1e, 255))
for i, fr in enumerate(frames):
    scene = Image.new('RGBA', (96, 104), (0x05, 0x03, 0x04, 255))
    scene.alpha_composite(room, (0, 8))
    scene.alpha_composite(fr, (24, 0))
    strip.alpha_composite(scene, (i * 104 + 4, 0))
strip.resize((strip.width * 4, strip.height * 4), Image.NEAREST).save('.agents/tasks/2026-10-27-boss-gate-redesign/v4-in-room-x4.png')

big = Image.new('RGBA', (4 * 50, 50), (0x24, 0x1c, 0x2c, 255))
for i, fr in enumerate(frames):
    big.alpha_composite(fr, (i * 50 + 1, 1))
big.resize((big.width * 8, big.height * 8), Image.NEAREST).save('.agents/tasks/2026-10-27-boss-gate-redesign/v4-frames-x8.png')
print('ok')
