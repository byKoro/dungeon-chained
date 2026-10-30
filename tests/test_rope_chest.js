import { RopeChests } from '../js/systems/RopeChests.js';
import { ROPE_CHEST } from '../js/config/EventsConfig.js';
import { sawGap } from '../js/systems/StakeRope.js';
import { TILE } from '../js/config/GameConfig.js';

let passed = 0;
let failed = 0;
function assert(condition, message) {
    if (condition) { console.log(`✅ PASSOU: ${message}`); passed++; }
    else { console.error(`❌ FALHOU: ${message}`); failed++; }
}

console.log("=== TESTE DA CORDA COM BAÚ ===");

const players = [{ x: 0, y: 0, vx: 0, vy: 0, lives: 3 }, { x: 0, y: 0, vx: 0, vy: 0, lives: 3 }];
const saw = { x: -999, y: -999 };
const weapon = { discRadius: 32, getSawPositions: () => [saw], thrown: false, spinningLoose: false, dropX: -999, dropY: -999 };
const chain = { isConnected: true, weapon };
const completed = new Set(), hidden = new Map();
const chest = { type: "chest", col: 12, row: 4, scrap: 20, rope: "corda1" };
const other = { type: "chest", col: 2, row: 2 };
const api = {
    room: { key: "0,0" }, tile: TILE, rect: () => ({ x: 0, y: 0 }),
    authored: {
        interactives: [{ type: "chestRope", id: "corda1", col: 5, row: 6 }, { type: "rope", id: "x", col: 8, row: 8 }],
        props: [chest, other]
    },
    getPlayers: () => players, chain,
    tileCenter: (col, row) => ({ x: (col + 0.5) * TILE, y: (row + 0.5) * TILE }),
    isCompleted: id => completed.has(`0,0/${id}`), complete: id => completed.add(`0,0/${id}`),
    chests: { setHidden: (k, p, h) => hidden.set(p, h) },
    pushPlayers() {}, hitStop() {}
};
const DROP = ROPE_CHEST.chest.delay + ROPE_CHEST.chest.warnSteps + ROPE_CHEST.chest.fallSteps + ROPE_CHEST.chest.squashSteps + 5;
const steps = (sys, n) => { for (let i = 0; i < n; i++) sys.update(); };

const ropes = new RopeChests({ api, rng: () => 0.5 });
const r = ropes.ropes[0];
assert(ropes.valid && ropes.ropes.length === 1 && r.chest === chest, "só a corda com baú entra; baú ligado pelo id");
assert(hidden.get(chest) === true && !hidden.has(other), "baú da corda escondido; baú comum não");
assert(ropes.solidCircles().length === 1, "estaca é sólida");

steps(ropes, 30);
assert(!r.cut, "sem disco na estaca: a corda não corta");

players[0].x = r.x; players[0].y = r.y;
steps(ropes, 5);
assert(!r.cut, "jogador sozinho na estaca não corta");

const s = ropes.art.stakePoint(r);
saw.x = s.x; saw.y = s.y;
ropes.update();
saw.x = saw.y = -999;
assert(r.cut && completed.has("0,0/rope:corda1") && r.drop, "disco preso na estaca corta e começa a queda");
assert(hidden.get(chest) === true, "baú continua escondido durante a queda");
assert(r.drop.col === 12 && r.drop.row === 4, "baú cai no próprio tile");
steps(ropes, DROP);
assert(!r.drop && hidden.get(chest) === false, "baú pousa e aparece fechado");
assert(ropes.solidCircles().length === 1, "estaca fica depois do corte");

// Morte no meio da queda: termina a queda; o corte fica salvo.
{
    completed.clear(); hidden.clear();
    const again = new RopeChests({ api });
    const q = again.ropes[0];
    weapon.spinningLoose = true;
    chain.isConnected = false;
    const p = again.art.stakePoint(q);
    weapon.dropX = p.x; weapon.dropY = p.y;
    again.update();
    weapon.spinningLoose = false;
    assert(q.cut, "serra solta girando (Inércia) corta");
    again.onDeath();
    assert(!q.drop && hidden.get(chest) === false, "morte no meio da queda: baú já aparece");
    const reborn = new RopeChests({ api });
    assert(reborn.ropes[0].cut && !reborn.ropes[0].drop, "corda cortada continua cortada");
}

// Serra largada parada (sem Inércia) não corta.
weapon.thrown = false; weapon.spinningLoose = false;
assert(sawGap(chain, players, { x: weapon.dropX, y: weapon.dropY }) === Infinity, "serra largada parada não conta como disco girando");
weapon.thrown = true;
assert(sawGap(chain, players, { x: weapon.dropX, y: weapon.dropY }) < 0, "serra lançada conta");

console.log(`\n${passed} passaram, ${failed} falharam.`);
if (failed > 0) process.exit(1);
