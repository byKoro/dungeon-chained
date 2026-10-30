import { CageEncounter } from '../js/systems/CageEncounter.js';
import { CAGE } from '../js/config/EventsConfig.js';
import { parseWaves, formatWaves, zoneFromCorners, setZone, toggleBar } from '../js/rooms/RoomEventsData.js';
import { TILE } from '../js/config/GameConfig.js';

let passed = 0;
let failed = 0;
function assert(condition, message) {
    if (condition) { console.log(`✅ PASSOU: ${message}`); passed++; }
    else { console.error(`❌ FALHOU: ${message}`); failed++; }
}

console.log("=== TESTE DOS EVENTOS DA SALA (GAIOLA) ===");

// Dados do editor.
{
    const waves = parseWaves("demon:3\nbloodMonster:1, demon:3\n\n , demon:0, blackKnightB");
    assert(waves.length === 3 && waves[1][0].type === "bloodMonster" && waves[2].length === 1 && waves[2][0].count === 1, "parseWaves lê levas, ignora linhas vazias e quantidades inválidas");
    assert(formatWaves([[{ type: "demon", count: 3 }], [{ type: "bloodMonster", count: 1 }, { type: "demon", count: 2 }]]) === "demon:3\nbloodMonster:1, demon:2", "formatWaves volta ao texto");
    const z = zoneFromCorners("salao", { col: 10, row: 17 }, { col: 1, row: 10 });
    assert(z.col === 1 && z.row === 10 && z.w === 10 && z.h === 8, "zona pelos dois cantos em qualquer ordem");
    const room = { zones: [{ id: "salao", col: 0, row: 0, w: 1, h: 1 }] };
    setZone(room, z);
    assert(room.zones.length === 1 && room.zones[0].w === 10, "zona com o mesmo id é trocada");
    toggleBar(room, 3, 4); toggleBar(room, 5, 4); toggleBar(room, 3, 4);
    assert(room.bars.length === 1 && room.bars[0].col === 5, "grade liga e desliga por tile");
}

// Encontro com API falsa: estacas com gaiolas no alto; a serra na estaca corta.
const W = 30, H = 30;
const kinds = Array.from({ length: H }, (_, r) => Array.from({ length: W }, (_, c) => (r === 0 || c === 0 || r === H - 1 || c === W - 1) ? "w" : "f").join(""));
// Parede vertical colada à direita da estaca (3,10): ninguém pode pousar do outro lado dela.
for (let r = 5; r < 16; r++) kinds[r] = kinds[r].slice(0, 5) + "w" + kinds[r].slice(6);
const players = [{ x: 0, y: 0, vx: 0, vy: 0, lives: 3, falling: false }, { x: 0, y: 0, vx: 0, vy: 0, lives: 3, falling: false }];
const saw = { x: 0, y: 0 };
const chain = { isConnected: true, weapon: { discRadius: 32, getSawPositions: () => [saw] } };
const log = { bars: [], said: [], vacuum: 0, hidden: new Map(), opened: [], completed: new Set(), bursts: 0, hitStops: 0, moved: [] };
let inZone = false;
const chestProp = { type: "chest", col: 14, row: 12, scrap: 15, encounter: "salao" };
const api = {
    room: { key: "1,1", enemies: [] }, tile: TILE, rect: () => ({ x: 0, y: 0 }),
    authored: {
        kinds,
        interactives: [
            { type: "rope", col: 16, row: 15, auto: true }, { type: "rope", col: 3, row: 10 },
            { type: "rope", col: 8, row: 16 }, { type: "rope", col: 27, row: 10 }
        ],
        props: [chestProp, { type: "chest", col: 22, row: 27 }],
        bars: [{ col: 3, row: 13 }]
    },
    getPlayers: () => players, chain,
    tileCenter: (col, row) => ({ x: (col + 0.5) * TILE, y: (row + 0.5) * TILE }),
    bothInZone: () => inZone,
    encounter: () => ({ id: "salao", waves: [[{ type: "demon", count: 3 }], [{ type: "bloodMonster", count: 1 }, { type: "demon", count: 3 }], [{ type: "blackKnightB", count: 1 }, { type: "demon", count: 2 }], [{ type: "demon", count: 3 }, { type: "bloodMonster", count: 1 }, { type: "blackKnightB", count: 1 }]] }),
    isCompleted: id => log.completed.has(id), complete: id => log.completed.add(id),
    setBars: down => log.bars.push(down),
    spawnEnemy(type, x, y, delay, opts) { const e = { type, x, y, state: "chase", frozen: true, airborne: !!opts?.airborne, delay }; api.room.enemies.push(e); return e; },
    removeEnemies(list) { api.room.enemies = api.room.enemies.filter(e => !list.includes(e)); },
    scrap: { vacuum: () => log.vacuum++, spawnBurst: () => log.bursts++ },
    chests: {
        setHidden: (k, p, h) => log.hidden.set(`${p.col},${p.row}`, h),
        forceOpen: (k, p) => { log.opened.push({ col: p.col, row: p.row }); return true; }
    },
    dialogue: { say: (who, key) => log.said.push(key) },
    hitStop: () => log.hitStops++,
    pushPlayers(x, y, r, f) { for (const p of players) if (Math.hypot(p.x - x, p.y - y) < r) p.vx += f; },
    moveProp(p, col, row) { p.col = col; p.row = row; log.moved.push([col, row]); }
};
const enemiesOf = () => api.room.enemies;
const killAll = () => { api.room.enemies = []; };
const steps = n => { for (let i = 0; i < n; i++) cage.update(); };
const DROP = CAGE.warnSteps + CAGE.fallSteps + 1;
const JUMP = CAGE.jump.delay + 6 * CAGE.jump.stagger + CAGE.jump.steps + CAGE.jump.holdSteps + 2;
const sawAway = () => { saw.x = -999; saw.y = -999; };
const sawOn = i => { const p = cage._stakePoint(cage.ropes[i]); saw.x = p.x; saw.y = p.y; cage.update(); sawAway(); };
sawAway();
const cage = new CageEncounter({ api, zoneId: "salao", encounterId: "salao", rng: () => 0.3 });

assert(cage.valid && cage.ropes.length === 4 && log.hidden.get("14,12") === true && !log.hidden.has("22,27"), "4 estacas; só o baú do encontro fica escondido");
cage.update();
assert(cage.phase === "idle" && !enemiesOf().length, "fora da zona: nada acontece");

inZone = true;
chain.isConnected = false;
cage.update();
assert(cage.phase === "idle" && !log.bars.length, "na zona mas sem a serra conectada: as grades não descem");

chain.isConnected = true;
cage.update();
const auto = cage.ropes[0];
assert(cage.phase === "active" && log.bars[0] === true && auto.cut && auto.cage?.phase === "warn" && log.hitStops === 1, "corda automática: grades descem, aviso antes da queda, hit stop no corte");
steps(CAGE.warnSteps);
assert(auto.cage.phase === "fall" && !enemiesOf().length, "depois do aviso a gaiola cai; ninguém aparece ainda");
players[0].x = auto.x + 20; players[0].y = auto.y; players[0].vx = 0;
steps(CAGE.fallSteps + 1);
assert(auto.cage.landed && log.bursts === 1 && players[0].vx > 0, "impacto: estilhaça (sucata) e empurra quem está perto");
assert(enemiesOf().length === 3 && enemiesOf().every(e => e.airborne && e.frozen), "leva 1 sai saltando: 3 demônios no ar");
const landing = enemiesOf().map(e => cage.jumpers.find(j => j.e === e)).map(j => ({ col: Math.floor(j.toX / TILE), row: Math.floor(j.toY / TILE) }));
assert(landing.every(c => kinds[c.row][c.col] === "f" && !(c.col === 16 && c.row === 15)), "pousam em tiles de piso, fora da estaca");
steps(JUMP);
assert(enemiesOf().every(e => !e.airborne && !e.frozen) && !cage.jumpers.length, "depois de pousar voltam a agir");

killAll(); cage.update();
assert(log.vacuum === 1 && log.said.includes("talk.wave1Clear"), "leva limpa: aspira a sucata e fala");

// Cabo cruzando a estaca, com o disco longe, não corta.
cage.update();
assert(!cage.ropes[1].cut, "sem a serra na estaca nada é cortado");
sawOn(1);
assert(cage.cuts === 2 && cage.ropes[1].cage, "serra na estaca (3,10): corta");
steps(DROP);
const wall = enemiesOf().map(e => cage.jumpers.find(j => j.e === e)).map(j => Math.floor(j.toX / TILE));
assert(enemiesOf().length === 4 && wall.every(c => c < 5), "estaca colada na parede: todos pousam do lado dela, nenhum atrás da parede");
steps(JUMP);

cage.onDeath();
assert(cage.phase === "idle" && cage.cuts === 0 && !enemiesOf().length && cage.ropes.every(r => !r.cut && !r.cage), "morte interrompe: estacas e gaiolas restauradas, inimigos removidos");

cage.update(); steps(DROP + JUMP); killAll(); cage.update();
for (const i of [1, 2, 3]) { sawOn(i); steps(DROP + JUMP); if (i < 3) { killAll(); cage.update(); } }
assert(cage.phase === "active" && enemiesOf().length === 5 && !log.opened.length, "última leva viva: baú ainda não caiu");
killAll(); cage.update();
assert(cage.phase === "reward" && log.completed.has("salao"), "tudo cortado e ninguém vivo: o baú vai cair");
const last = cage.ropes[3];
assert(Math.hypot(chestProp.col - last.col, chestProp.row - last.row) <= CAGE.landMaxTiles + 0.01 && kinds[chestProp.row][chestProp.col] === "f", "o baú cai perto da última estaca cortada, num piso");
const c = CAGE.chest;
steps(c.delay + c.warnSteps + c.fallSteps + 2);
assert(cage.drop.phase === "landed" && !log.opened.length, "o baú bateu no chão; ainda não abriu");
steps(c.squashSteps + c.openDelay + 1);
assert(cage.phase === "done" && log.bars.at(-1) === false, "depois do impacto as grades sobem");
assert(!log.opened.length && log.hidden.get(`${chestProp.col},${chestProp.row}`) === false, "o baú aparece fechado: só abre quando os jogadores interagirem");
const landedAt = [chestProp.col, chestProp.row];
cage.onDeath();
assert(cage.phase === "done" && chestProp.col === landedAt[0] && chestProp.row === landedAt[1], "morte depois de concluído não desfaz nem devolve o baú");

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
