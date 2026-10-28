import assert from 'node:assert/strict';
import { createRoom, createMap, addRoom, setCell, placeProp, propAt, validateMap } from '../js/editor2/MapModel.js';
import { placeDoor } from '../js/editor2/MapContent.js';
import { paintWallCell, voidOutside, wallTileFor, shadowTileFor } from '../js/rooms/WallAutotile.js';
import { DEMO } from '../js/config/DemoConfig.js';

const TOP = [1, 2, 3, 4], BOTTOM = [41, 42, 43, 44], LEFT = [10, 20, 30], RIGHT = [15, 25, 35];
let seed = 7;
const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// '.' piso, '#' parede, ' ' vazio (a sala é 5×5 ou maior; todas as células são sobrescritas)
function grid(lines) {
    const room = createRoom(lines[0].length, lines.length);
    lines.forEach((line, r) => [...line].forEach((ch, c) => {
        if (ch === '#') setCell(room, c, r, 2, 'w');
        else if (ch === ' ') setCell(room, c, r, -2, 'v');
        else setCell(room, c, r, 16, 'f');
    }));
    return room;
}

// --- quinas ---
// ponta de parede com piso nos lados (não é quina do contorno): usa bloco de topo
assert.ok(TOP.includes(wallTileFor(grid(['.....', '.....', '.#...', '.....', '.....']), 1, 2, rng)), 'ponta com piso ao redor: topo');

// --- lados ---
assert.ok(TOP.includes(wallTileFor(grid(['     ', '#####', '.....', '.....', '.....']), 2, 1, rng)), 'piso ao sul: topo');
assert.ok(BOTTOM.includes(wallTileFor(grid(['.....', '.....', '.....', '#####', '     ']), 2, 3, rng)), 'piso ao norte: base');
assert.ok(LEFT.includes(wallTileFor(grid([' #...', ' #...', ' #...', ' #...', ' #...']), 1, 2, rng)), 'piso a leste: lateral esquerda');
assert.ok(RIGHT.includes(wallTileFor(grid(['...# ', '...# ', '...# ', '...# ', '...# ']), 3, 2, rng)), 'piso a oeste: lateral direita');
assert.ok(TOP.includes(wallTileFor(grid(['.....', '.....', '..#..', '.....', '.....']), 2, 2, rng)), 'piso dos dois lados: topo');
assert.ok(TOP.includes(wallTileFor(grid(['.....', '..#..', '..#..', '..#..', '.....']), 2, 2, rng)), 'parede vertical fina com piso dos dois lados: bloco de topo');

// quinas de contorno fechado: o piso só aparece na diagonal
// piso por dentro e vazio por fora: quinas da moldura (0 e 5)
assert.equal(wallTileFor(grid(['      ', ' #####', ' #....', ' #....', ' #....', ' #....']), 1, 1, rng), 0, 'contorno com piso dentro: quina superior esquerda 0');
assert.equal(wallTileFor(grid(['      ', '##### ', '....# ', '....# ', '....# ', '....# ']), 4, 1, rng), 5, 'contorno com piso dentro: quina superior direita 5');
// vazio por dentro e piso por fora: quinas 50 e 55
const hollow = grid(['......', '.####.', '.#  #.', '.#  #.', '.####.', '......']);
assert.equal(wallTileFor(hollow, 1, 1, rng), 50, 'contorno com vazio dentro: quina superior esquerda 50');
assert.equal(wallTileFor(hollow, 4, 1, rng), 55, 'contorno com vazio dentro: quina superior direita 55');
assert.ok(BOTTOM.includes(wallTileFor(hollow, 2, 1, rng)), 'topo do contorno com vazio dentro usa base');
assert.ok(RIGHT.includes(wallTileFor(hollow, 1, 2, rng)), 'lado esquerdo do contorno com vazio dentro usa lateral direita');
assert.ok(LEFT.includes(wallTileFor(hollow, 4, 2, rng)), 'lado direito do contorno com vazio dentro usa lateral esquerda');
assert.ok(TOP.includes(wallTileFor(hollow, 2, 4, rng)), 'fundo do contorno com vazio dentro usa topo');
assert.equal(wallTileFor(grid([' #....', ' #....', ' #....', ' #....', ' #####', '      ']), 1, 4, rng), 40, 'contorno: quina inferior esquerda');
assert.equal(wallTileFor(grid(['....# ', '....# ', '....# ', '....# ', '##### ', '      ']), 4, 4, rng), 45, 'contorno: quina inferior direita');
assert.equal(wallTileFor(grid(['#####', '#####', '#####', '#####', '#####']), 2, 2, rng), 2, 'sem piso ao redor usa o tile 2');

// --- variação sorteada é mantida ---
{
    const room = grid(['     ', '#####', '.....', '.....', '.....']);
    room.tiles[1][2] = 3;
    assert.equal(wallTileFor(room, 2, 1, rng), 3, 'tile do conjunto certo não é sorteado de novo');
    room.tiles[1][2] = 43;
    assert.ok(TOP.includes(wallTileFor(room, 2, 1, rng)), 'tile de outro lado é trocado');
    const seen = new Set();
    for (let i = 0; i < 80; i++) { room.tiles[1][2] = 99; seen.add(wallTileFor(room, 2, 1, rng)); }
    assert.ok(seen.size > 1 && [...seen].every(t => TOP.includes(t)), 'sorteio varia dentro do conjunto');
}

// --- sombra do piso ---
{
    const room = grid(['.....', '.....', '..#..', '.....', '.....']);
    assert.equal(shadowTileFor(room, 3, 2, rng), 21, 'piso a leste da parede: sombra esquerda');
    assert.equal(shadowTileFor(room, 1, 2, rng), 24, 'piso a oeste da parede: sombra direita');
    assert.ok([12, 13].includes(shadowTileFor(room, 2, 3, rng)), 'piso ao sul da parede: sombra de topo');
    assert.ok([32, 33].includes(shadowTileFor(room, 2, 1, rng)), 'piso ao norte da parede: sombra de base');
    room.tiles[4][4] = 21;
    assert.ok(DEMO.floorTiles.includes(shadowTileFor(room, 4, 4, rng)), 'sombra sem parede volta a piso');
    const corner = grid(['.....', '..#..', '.#...', '.....', '.....']);
    assert.equal(shadowTileFor(corner, 2, 2, rng), 11, 'parede ao norte e a oeste: quina 11');
    const corner2 = grid(['..#..', '...#.', '.....', '.....', '.....']);
    assert.equal(shadowTileFor(corner2, 2, 1, rng), 14, 'parede ao norte e a leste: quina 14');
}

// --- pincel: pintar, apagar, conteúdo, borda e portas ---
{
    const room = createRoom(14, 9);
    placeProp(room, 'chest', 4, 4);
    room.enemies.push({ type: 'demon', col: 4, row: 4 });
    assert.equal(paintWallCell(room, 4, 4, 'add', rng), true);
    assert.equal(room.kinds[4][4], 'w');
    assert.equal(propAt(room, 4, 4), null, 'prop sob a parede é removido');
    assert.equal(room.enemies.length, 0, 'inimigo sob a parede é removido');
    assert.equal(room.tiles[4][5], 21, 'piso ao lado ganha sombra');
    assert.equal(paintWallCell(room, 4, 4, 'add', rng), false, 'já é parede');

    assert.equal(paintWallCell(room, 4, 4, 'remove', rng), true);
    assert.equal(room.kinds[4][4], 'f');
    assert.ok(DEMO.floorTiles.includes(room.tiles[4][4]), 'parede apagada vira piso do conjunto');
    assert.ok(![21, 24, 12, 13, 32, 33].includes(room.tiles[4][5]), 'sombra some ao apagar a parede');

    // moldura: o pincel apaga e repinta o limite da sala com as peças da borda
    const frame = createRoom(14, 9);
    const topBefore = frame.tiles[0].slice(), leftBefore = frame.tiles.map(l => l[0]);
    assert.equal(paintWallCell(frame, 5, 0, 'remove', rng), true, 'borda superior pode ser apagada');
    assert.equal(frame.kinds[0][5], 'f');
    assert.equal(paintWallCell(frame, 5, 0, 'add', rng), true, 'e repintada');
    assert.ok(TOP.includes(frame.tiles[0][5]), 'borda superior repintada usa tile de topo');
    paintWallCell(frame, 0, 4, 'remove', rng); paintWallCell(frame, 0, 4, 'add', rng);
    assert.ok(LEFT.includes(frame.tiles[4][0]), 'borda esquerda repintada usa lateral esquerda');
    paintWallCell(frame, 13, 4, 'remove', rng); paintWallCell(frame, 13, 4, 'add', rng);
    assert.ok(RIGHT.includes(frame.tiles[4][13]), 'borda direita repintada usa lateral direita');
    paintWallCell(frame, 5, 8, 'remove', rng); paintWallCell(frame, 5, 8, 'add', rng);
    assert.ok(BOTTOM.includes(frame.tiles[8][5]), 'borda inferior repintada usa tile de base');
    for (const [c, r, t] of [[0, 0, 0], [13, 0, 5], [0, 8, 40], [13, 8, 45]]) {
        paintWallCell(frame, c, r, 'remove', rng); paintWallCell(frame, c, r, 'add', rng);
        assert.equal(frame.tiles[r][c], t, `quina da moldura ${c},${r} volta ao tile ${t}`);
    }
    assert.equal(frame.tiles[1][1], 11, 'sombra da quina interna continua');
    assert.deepEqual(frame.tiles[0].slice(1, 4).map(t => TOP.includes(t)), [true, true, true], 'resto da borda superior intacto');
    assert.ok(topBefore.length === 14 && leftBefore.length === 9);

    placeDoor(room, 13, 4, 'normal', 2, 'd1');
    assert.equal(paintWallCell(room, 13, 4, 'add', rng), false, 'porta é ignorada');
    assert.equal(room.doors.length, 1);
}

// --- vazio de fora ---
{
    const split = () => {
        const room = createRoom(14, 9);
        for (let r = 1; r <= 7; r++) paintWallCell(room, 5, r, 'add', rng);
        return room;
    };
    const room = split();
    const changed = voidOutside(room);
    assert.ok(changed > 0, 'lado isolado vira vazio');
    assert.equal(room.kinds[4][2], 'v'); assert.equal(room.tiles[4][2], -2);
    assert.equal(room.kinds[4][8], 'f', 'lado do centro continua piso');
    assert.equal(room.kinds[4][5], 'w', 'parede continua');
    assert.equal(room.kinds[0][3], 'w', 'moldura continua');

    const withDoor = split();
    placeDoor(withDoor, 0, 4, 'normal', 2, 'w1');
    assert.equal(voidOutside(withDoor), 0, 'área com porta é semente e não vira vazio');

    const withSpawn = split();
    withSpawn.spawns = { p1: { col: 2, row: 3 }, p2: { col: 2, row: 4 } };
    assert.equal(voidOutside(withSpawn), 0, 'área com spawn não vira vazio');

    const map = createMap({ gridCols: 1, gridRows: 1 });
    const mapRoom = addRoom(map, 0, 0);
    for (let r = 1; r <= 7; r++) paintWallCell(mapRoom, 5, r, 'add', rng);
    voidOutside(mapRoom);
    assert.equal(validateMap(map).errors.length, 0, 'sala com vazio passa na validação');
}

console.log('test_wall_autotile ok');
