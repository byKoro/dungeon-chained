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

// Encontro com API falsa: cordas verticais, uma gaiola por corda.
const enemiesOf = () => api.room.enemies;
const players = [{ x: 0, y: 0, lives: 3, falling: false }, { x: 0, y: 0, lives: 3, falling: false }];
const chain = { isConnected: true, weapon: { discRadius: 32, getSawPositions: () => [] } };
const log = { bars: [], said: [], vacuum: 0, hidden: new Map(), opened: [], completed: new Set(), bursts: 0 };
let inZone = false;
const api = {
    room: { key: "1,1", enemies: [] },
    authored: {
        interactives: [
            { type: "rope", col: 16, row: 15, auto: true }, { type: "rope", col: 3, row: 10 },
            { type: "rope", col: 4, row: 16 }, { type: "rope", col: 27, row: 10 }
        ],
        props: [{ type: "chest", col: 14, row: 12, scrap: 15, encounter: "salao" }, { type: "chest", col: 22, row: 27 }]
    },
    getPlayers: () => players, chain,
    tileCenter: (col, row) => ({ x: (col + 0.5) * TILE, y: (row + 0.5) * TILE }),
    bothInZone: () => inZone,
    encounter: () => ({ id: "salao", waves: [[{ type: "demon", count: 3 }], [{ type: "bloodMonster", count: 1 }, { type: "demon", count: 3 }], [{ type: "blackKnightB", count: 1 }, { type: "demon", count: 2 }], [{ type: "demon", count: 3 }, { type: "bloodMonster", count: 1 }, { type: "blackKnightB", count: 1 }]] }),
    isCompleted: id => log.completed.has(id), complete: id => log.completed.add(id),
    setBars: down => log.bars.push(down),
    spawnEnemy(type, x, y, delay) { const e = { type, x, y, state: "chase", isHidden: false, frozen: false, delay }; api.room.enemies.push(e); return e; },
    removeEnemies(list) { api.room.enemies = api.room.enemies.filter(e => !list.includes(e)); },
    scrap: { vacuum: () => log.vacuum++, spawnBurst: () => log.bursts++ },
    chests: {
        setHidden: (k, p, h) => log.hidden.set(`${p.col},${p.row}`, h),
        forceOpen: (k, p) => { log.opened.push(p); return true; }
    },
    dialogue: { say: (who, key) => log.said.push(key) }
};
const killAll = () => { api.room.enemies = []; };
const steps = n => { for (let i = 0; i < n; i++) cage.update(); };
const away = () => { players[0].x = 100; players[0].y = 100; players[1].x = 140; players[1].y = 100; };
// Cabo cruzando o trecho de baixo da corda, na horizontal.
const crossRope = (i) => {
    const r = cage.ropes[i], k = cage._knot(r);
    players[0].x = r.x - 40; players[1].x = r.x + 40; players[0].y = players[1].y = k.y - 20;
    cage.update();
    away();
};
const cage = new CageEncounter({ api, zoneId: "salao", encounterId: "salao", rng: () => 0.5 });

assert(cage.valid && cage.ropes.length === 4 && log.hidden.get("14,12") === true && !log.hidden.has("22,27"), "4 cordas; só o baú do encontro fica escondido");
away(); cage.update();
assert(cage.phase === "idle" && !enemiesOf().length, "fora da zona: nada acontece");

inZone = true;
cage.update();
const auto = cage.ropes[0];
assert(cage.phase === "active" && log.bars[0] === true && cage.cuts === 1 && auto.cut && auto.cage && !auto.cage.landed, "os dois na zona: a corda automática arrebenta, grades descem, a gaiola dela começa a cair");
assert(!enemiesOf().length && log.said.includes("talk.rope1"), "ninguém aparece enquanto a gaiola cai");
steps(CAGE.fallSteps + 1);
assert(auto.cage.landed && log.bursts === 1, "a gaiola bate no chão e estilhaça (sucata dos destroços)");
assert(enemiesOf().length === 3 && enemiesOf().every(e => e.type === "demon"), "leva 1 sai dos destroços: 3 demônios");
assert(enemiesOf().every(e => Math.hypot(e.x - auto.x, e.y - auto.y) < 1.5 * TILE), "os monstros surgem em volta do ponto da corda");
assert(enemiesOf().every((e, i) => e.delay === i * CAGE.dropStagger), "surgem um atrás do outro");

killAll(); cage.update();
assert(log.vacuum === 1 && log.said.includes("talk.wave1Clear"), "leva limpa: aspira a sucata e fala");

// Passar perto de uma estaca sem cruzar a corda não corta.
players[0].x = cage.ropes[3].x + 50; players[1].x = cage.ropes[3].x + 150; players[0].y = players[1].y = cage.ropes[3].y;
cage.update(); away();
assert(!cage.ropes[3].cut, "cabo ao lado da corda, sem cruzar, não corta");

crossRope(3);
assert(cage.cuts === 2 && cage.ropes[3].cage && !enemiesOf().length, "corte 2: a gaiola daquela corda cai");
steps(CAGE.fallSteps + 1);
assert(enemiesOf().length === 4 && enemiesOf()[0].type === "bloodMonster" && enemiesOf().every(e => Math.hypot(e.x - cage.ropes[3].x, e.y - cage.ropes[3].y) < 1.5 * TILE), "leva 2 pela ordem do corte, no ponto da corda cortada");
crossRope(1); steps(CAGE.fallSteps + 1);
assert(cage.cuts === 3 && enemiesOf().length === 7, "cortar com a leva anterior viva acumula");

cage.onDeath();
assert(cage.phase === "idle" && cage.cuts === 0 && !enemiesOf().length && cage.ropes.every(r => !r.cut && !r.cage), "morte interrompe: cordas e gaiolas restauradas, inimigos removidos");

cage.update(); steps(CAGE.fallSteps + 1); killAll(); cage.update();
crossRope(1); steps(CAGE.fallSteps + 1); killAll(); cage.update();
crossRope(2); steps(CAGE.fallSteps + 1); killAll(); cage.update();
crossRope(3);
assert(cage.phase === "active" && !log.opened.length, "última corda: a gaiola ainda está caindo, o baú não abre");
steps(CAGE.fallSteps + 1);
assert(enemiesOf().length === 5 && !log.opened.length, "leva 4 viva: baú ainda fechado");
killAll(); cage.update();
assert(cage.phase === "done" && log.opened.length === 1 && log.bars.at(-1) === false && log.completed.has("salao"), "tudo cortado e ninguém vivo: baú abre, grades sobem, encontro concluído");
assert(log.said.includes("talk.chest2"), "fala do baú 2");
cage.onDeath();
assert(cage.phase === "done", "morte depois de concluído não desfaz");
const again = new CageEncounter({ api, zoneId: "salao", encounterId: "salao" });
assert(again.phase === "done", "recriado com o encontro concluído já nasce terminado");

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
