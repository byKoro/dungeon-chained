import { InicialRoomScript } from '../js/systems/roomScripts/InicialRoomScript.js';
import { TILE } from '../js/config/GameConfig.js';

let passed = 0;
let failed = 0;
function assert(condition, message) {
    if (condition) { console.log(`✅ PASSOU: ${message}`); passed++; }
    else { console.error(`❌ FALHOU: ${message}`); failed++; }
}

console.log("=== TESTE DO ROTEIRO DA SALA INICIAL ===");

const cfg = { enabled: true, startDelaySteps: 3, anvilNearTiles: 2.5, bossGateTiles: 3 };
const kinds = Array.from({ length: 30 }, () => "f".repeat(30));
const far = { x: -9999, y: -9999 };
const players = [{ ...far, lives: 3, falling: false }, { ...far, lives: 3, falling: false }];
const said = [];
const completed = new Set();
const chests = { justOpened: [], setHidden: () => {} };
const encounterChest = { type: "chest", col: 14, row: 12, encounter: "salao" };
const chest1 = { type: "chest", col: 22, row: 27 };
const api = {
    room: { key: "1,1", enemies: [] }, tile: TILE, rect: () => ({ x: 0, y: 0 }),
    authored: {
        kinds, interactives: [],
        props: [{ type: "anvil", col: 24, row: 26 }, chest1, encounterChest],
        doors: [{ col: 23, row: 0, type: "boss", width: 2, id: "door_2" }]
    },
    getPlayers: () => players, chain: { isConnected: false, weapon: {} },
    tileCenter: (col, row) => ({ x: (col + 0.5) * TILE, y: (row + 0.5) * TILE }),
    bothInZone: () => false, encounter: () => null,
    isCompleted: id => completed.has(id), complete: id => completed.add(id),
    chests, dialogue: { say: (who, key) => said.push(`${who}:${key}`) }
};
const script = new InicialRoomScript(api, cfg);
const steps = n => { for (let i = 0; i < n; i++) script.update(); };

steps(2);
assert(said.length === 0, "nada antes do atraso inicial");
steps(1);
assert(said.join() === "0:talk.start.1,1:talk.start.2", "início: Amarelo e depois Azul");
steps(10);
assert(said.length === 2, "falas do início tocam uma vez só");

chests.justOpened = [{ prop: encounterChest, roomKey: "1,1" }];
steps(1);
assert(!said.includes("1:talk.chest1"), "baú do encontro não dispara a fala do baú 1");
assert(said.at(-1) === "0:talk.chest2", "baú do encontro aberto pelos jogadores: Amarelo fala do baú 2");
chests.justOpened = [];
chests.justOpened = [{ prop: chest1, roomKey: "1,1" }];
steps(1);
chests.justOpened = [];
assert(said.at(-1) === "1:talk.chest1", "baú 1 aberto: Azul fala da sucata");

players[0].x = 25 * TILE; players[0].y = 26.5 * TILE;
steps(2);
assert(said.at(-1) === "0:talk.anvilNear" && said.filter(s => s.endsWith("anvilNear")).length === 1, "perto da bigorna: Amarelo, uma vez");

players[1].x = 24 * TILE; players[1].y = 2 * TILE;
steps(1);
assert(said.slice(-2).join() === "1:talk.bossGate,0:talk.rightDoor", "perto do portão: Azul e a resposta do Amarelo");

const again = new InicialRoomScript(api, cfg);
const before = said.length;
for (let i = 0; i < 10; i++) again.update();
assert(said.length === before, "falas já ditas não voltam com um script novo (morte mantém `completed`)");

const off = new InicialRoomScript({ ...api, isCompleted: () => false, complete: () => {} }, { ...cfg, enabled: false });
for (let i = 0; i < 10; i++) off.update();
assert(said.length === before, "roteiro desligado não fala");

console.log(`\nResultados: ${passed} passaram, ${failed} falharam.`);
if (failed > 0) process.exit(1);
