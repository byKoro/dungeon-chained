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

// Encontro com API falsa.
const enemiesOf = () => api.room.enemies;
const players = [{ x: 0, y: 0, lives: 3, falling: false }, { x: 0, y: 0, lives: 3, falling: false }];
const chain = { isConnected: true, weapon: { getSawPositions: () => [] } };
const log = { bars: [], said: [], vacuum: 0, hidden: new Map(), opened: [], completed: new Set() };
let inZone = false;
const api = {
    room: { key: "1,1", enemies: [] },
    authored: {
        interactives: [
            { type: "cage", col: 14, row: 12 }, { type: "rope", col: 16, row: 15, auto: true },
            { type: "rope", col: 3, row: 10 }, { type: "rope", col: 4, row: 16 }, { type: "rope", col: 27, row: 10 }
        ],
        props: [{ type: "chest", col: 14, row: 12, scrap: 15 }]
    },
    getPlayers: () => players, chain,
    tileCenter: (col, row) => ({ x: (col + 0.5) * TILE, y: (row + 0.5) * TILE }),
    bothInZone: () => inZone,
    encounter: () => ({ id: "salao", waves: [[{ type: "demon", count: 3 }], [{ type: "bloodMonster", count: 1 }, { type: "demon", count: 3 }], [{ type: "blackKnightB", count: 1 }, { type: "demon", count: 2 }], [{ type: "demon", count: 3 }, { type: "bloodMonster", count: 1 }, { type: "blackKnightB", count: 1 }]] }),
    isCompleted: id => log.completed.has(id), complete: id => log.completed.add(id),
    setBars: down => log.bars.push(down),
    spawnEnemy(type, x, y, delay) { const e = { type, x, y, state: "chase", isHidden: false, frozen: false, delay }; api.room.enemies.push(e); return e; },
    removeEnemies(list) { api.room.enemies = api.room.enemies.filter(e => !list.includes(e)); },
    scrap: { vacuum: () => log.vacuum++, spawnBurst() {} },
    chests: {
        setHidden: (k, p, h) => log.hidden.set(`${p.col},${p.row}`, h),
        forceOpen: (k, p) => { log.opened.push(p); return true; }
    },
    dialogue: { say: (who, key) => log.said.push(key) }
};
const killAll = () => { for (const e of enemiesOf()) e.state = "dying"; api.room.enemies = []; };
const cutRope = (i) => {
    const r = cage.ropes[i];
    players[0].x = r.x - 10; players[0].y = r.y; players[1].x = r.x + 10; players[1].y = r.y;
    cage.update();
};
const cage = new CageEncounter({ api, zoneId: "salao", encounterId: "salao", rng: () => 0.5 });

assert(cage.valid && cage.ropes.length === 4 && log.hidden.get("14,12") === true, "acha gaiola, 4 cordas e esconde o baú de dentro");
players[0].x = 100; players[1].x = 120;
cage.update();
assert(cage.phase === "idle" && !enemiesOf().length, "fora da zona: nada acontece");

inZone = true;
cage.update();
assert(cage.phase === "active" && log.bars[0] === true && cage.cuts === 1 && cage.ropes[0].cut, "os dois na zona: a corda automática arrebenta e as grades descem");
assert(enemiesOf().length === 3 && enemiesOf().every(e => e.type === "demon"), "leva 1: 3 demônios");
assert(enemiesOf().every((e, i) => e.delay === CAGE.dropSteps + i * CAGE.dropStagger), "os inimigos caem um atrás do outro");
assert(log.said.includes("talk.rope1"), "fala da corda 1");

killAll(); cage.update();
assert(log.vacuum === 1 && log.said.includes("talk.wave1Clear"), "leva limpa: aspira a sucata e fala");

cutRope(3);
assert(cage.cuts === 2 && enemiesOf().length === 4 && enemiesOf()[0].type === "bloodMonster", "corte 2 (qualquer corda): leva 2 pela ordem do corte");
cutRope(1);
assert(cage.cuts === 3 && enemiesOf().length === 7, "cortar com a leva anterior viva acumula");

// Morte no meio: tudo volta ao começo.
cage.onDeath();
assert(cage.phase === "idle" && cage.cuts === 0 && !enemiesOf().length && cage.ropes.every(r => !r.cut), "morte interrompe: cordas e gaiola restauradas, inimigos removidos");

cage.update();
killAll(); cage.update();
cutRope(1); killAll(); cage.update();
cutRope(2); killAll(); cage.update();
cutRope(3);
assert(cage.phase === "falling" && enemiesOf().length === 5, "4º corte: leva 4 e a gaiola cai");
for (let i = 0; i < CAGE.fallSteps + 1; i++) cage.update();
assert(cage.phase === "fallen" && log.hidden.get("14,12") === false, "gaiola quebrada: o baú aparece");
assert(!log.opened.length, "com inimigos vivos o baú não abre");
killAll(); cage.update();
assert(cage.phase === "done" && log.opened.length === 1 && log.bars.at(-1) === false && log.completed.has("salao"), "última leva morta: baú abre, grades sobem, encontro concluído");
assert(log.said.includes("talk.chest2"), "fala do baú 2");
cage.onDeath();
assert(cage.phase === "done", "morte depois de concluído não desfaz");

const again = new CageEncounter({ api, zoneId: "salao", encounterId: "salao" });
assert(again.phase === "done", "recriado com o encontro concluído já nasce terminado");

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
