import { DungeonTileQuery } from '../js/rooms/DungeonTileQuery.js';
import { Player } from '../js/entities/Player.js';
import { TILE, HOLE_TILE } from '../js/config/GameConfig.js';

let passed = 0;
let failed = 0;
function assert(condition, message) {
    if (condition) { console.log(`✅ PASSOU: ${message}`); passed++; }
    else { console.error(`❌ FALHOU: ${message}`); failed++; }
}

console.log("=== TESTE DA RESISTÊNCIA À QUEDA EM BURACOS ===");

const H = HOLE_TILE, F = 16, W = 2;
// Grade 7x5 (moldura de parede). Buraco 2x3 nas colunas 3-4, linhas 1-3.
const floor = [
    [W, W, W, W, W, W, W],
    [W, F, F, H, H, F, W],
    [W, F, F, H, H, F, W],
    [W, F, F, H, H, F, W],
    [W, W, W, W, W, W, W],
];
const rooms = {
    currentTiles: { floor, cols: 7, rows: 5, walls: [] },
    cellRect: () => ({ x: 0, y: 0, w: 7 * TILE, h: 5 * TILE })
};
const query = new DungeonTileQuery({ rooms });

const HOLE_LEFT = 3 * TILE;        // borda esquerda do buraco (x mundo)
const ROW_Y = 2 * TILE + TILE / 2; // linha do meio

// Input falso: segura as direções pedidas.
const makeInput = () => {
    const held = new Set();
    return { held, isDown: (k) => held.has(k) };
};
const makePlayer = (x) => {
    const p = new Player(x, ROW_Y, '#f00', ['up', 'down', 'left', 'right'], null, 'P');
    return p;
};
// Um frame da simulação, na mesma ordem do Game (update -> queda).
const tick = (p, input) => { p.update(input, null); query.checkHoleFalls([p]); };
const runUntilFall = (p, input, maxFrames) => {
    for (let f = 1; f <= maxFrames; f++) {
        tick(p, input);
        if (p.falling) return f;
    }
    return -1;
};

// 1) Esbarrão: corre 12 frames em direção à borda e solta. A faixa no piso segura.
{
    const p = makePlayer(HOLE_LEFT - 20);
    const input = makeInput();
    input.held.add('right');
    for (let f = 0; f < 12; f++) tick(p, input);
    input.held.clear();
    for (let f = 0; f < 90; f++) tick(p, input);
    assert(!p.falling, "Esbarrar na borda e soltar não derruba");
    assert(p.x < HOLE_LEFT, `Soltando, continua no piso (x=${p.x.toFixed(1)} < ${HOLE_LEFT})`);
}

// 2) Pés no tile do buraco: cai no mesmo frame, sem tolerância por dentro.
{
    const p = makePlayer(HOLE_LEFT + 2);
    assert(runUntilFall(p, makeInput(), 1) === 1, "Pés 2px dentro do buraco caem na hora");
}

// 3) Insistir para dentro: a faixa no piso freia, mas acaba caindo.
{
    const p = makePlayer(HOLE_LEFT - 30);
    const input = makeInput();
    input.held.add('right');
    const frames = runUntilFall(p, input, 240);
    assert(frames > 0, "Insistindo para dentro do buraco, acaba caindo");
    assert(frames >= 12, `A queda exige insistência (${frames} frames, mínimo 12)`);
}

// 4) Empurrão leve na faixa é segurado; knockback forte (takeDamage = 16) derruba.
{
    const p = makePlayer(HOLE_LEFT - 10);
    p.vx = 4;
    assert(runUntilFall(p, makeInput(), 120) < 0, "Empurrão leve perto da borda não derruba");
    assert(p.x < HOLE_LEFT - 10, "A faixa empurra de volta para o piso");

    const q = makePlayer(HOLE_LEFT - 10);
    q.vx = 16;
    assert(runUntilFall(q, makeInput(), 120) > 0, "Knockback forte perto da borda derruba");
}

// 5) Andar AO LONGO da borda, dentro da faixa, não é freado (só a componente para dentro).
{
    const p = makePlayer(HOLE_LEFT - 4);
    p.y = 1 * TILE + TILE / 2;
    p.vx = 0; p.vy = 3;
    const vy0 = p.vy;
    query.checkHoleFalls([p]);
    assert(Math.abs(p.vy - vy0) < 1e-9, "Velocidade paralela à beirada não é freada");
}

// 5b) A queda é medida nos PÉS: com o centro acima do buraco e os pés na faixa, sofre o
//     empurrão; com os pés no tile do buraco, cai.
{
    const vFloor = [
        [W, W, W, W, W],
        [W, F, F, F, W],
        [W, F, F, F, W],
        [W, H, H, H, W],
        [W, H, H, H, W],
        [W, W, W, W, W],
    ];
    const vRooms = {
        currentTiles: { floor: vFloor, cols: 5, rows: 6, walls: [] },
        cellRect: () => ({ x: 0, y: 0, w: 5 * TILE, h: 6 * TILE })
    };
    const vQuery = new DungeonTileQuery({ rooms: vRooms });
    const holeTop = 3 * TILE;
    const p = new Player(2 * TILE + TILE / 2, holeTop - 2 - 14 - 4, '#f00', ['up', 'down', 'left', 'right'], null, 'P');
    const yBefore = p.y;
    vQuery.checkHoleFalls([p]);
    assert(!p.falling && p.y < yBefore, "Pés 4px antes da borda norte: empurrado para trás, não cai");

    const q = new Player(2 * TILE + TILE / 2, holeTop - 14 + 1, '#f00', ['up', 'down', 'left', 'right'], null, 'P');
    vQuery.checkHoleFalls([q]);
    assert(q.falling, "Centro acima do buraco mas pés dentro: cai");

    const input = makeInput();
    input.held.add('down');
    let fell = -1;
    for (let f = 1; f <= 240 && fell < 0; f++) {
        p.update(input, null);
        vQuery.checkHoleFalls([p]);
        if (p.falling) fell = f;
    }
    assert(fell > 0, `Entrando pelo norte (pés primeiro), insistindo, cai (${fell} frames)`);
}

// 6) Fora do buraco nada muda.
{
    const p = makePlayer(1 * TILE + TILE / 2);
    p.vx = 2; p.vy = 1;
    const before = { x: p.x, y: p.y, vx: p.vx, vy: p.vy };
    query.checkHoleFalls([p]);
    assert(p.x === before.x && p.y === before.y && p.vx === before.vx && p.vy === before.vy,
        "Sobre piso, posição e velocidade ficam intactas");
}

console.log(`\nRESULTADO: ${passed}/${passed + failed} testes passaram.`);
if (failed > 0) process.exit(1);
