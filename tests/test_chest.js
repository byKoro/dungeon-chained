import { ChestSystem } from '../js/systems/ChestSystem.js';
import { ScrapSystem } from '../js/systems/ScrapSystem.js';
import { CHEST, SCRAP, chestScrapAmount } from '../js/config/ScrapConfig.js';
import { TILE } from '../js/config/GameConfig.js';
import { placeProp } from '../js/rooms/MapDocument.js';

let passed = 0;
let failed = 0;
function assert(condition, message) {
    if (condition) { console.log(`✅ PASSOU: ${message}`); passed++; }
    else { console.error(`❌ FALHOU: ${message}`); failed++; }
}

console.log("=== TESTE DOS BAÚS ===");

const chest1 = { type: "chest", col: 21, row: 26, scrap: 10 };
const chest2 = { type: "mini_chest", col: 5, row: 5 };
const anvil = { type: "anvil", col: 24, row: 26 };
const room = { key: "1,1", tiles: { props: [chest1, chest2, anvil] } };
const rooms = { current: room, cellRect: () => ({ x: 0, y: 0, w: 30 * TILE, h: 30 * TILE }) };
const center = p => ({ x: (p.col + 0.5) * TILE, y: (p.row + 0.5) * TILE });
const player = (x, y, extra = {}) => ({ x, y, hitRadius: 16, lives: 3, falling: false, ...extra });

const played = [];
const audio = { play: (cue) => played.push(cue) };
const scrap = new ScrapSystem({ rng: () => 0.5 });
const p1 = player(0, 0), p2 = player(0, 0);
const chests = new ChestSystem({ rooms, scrap, getPlayers: () => [p1, p2], audio });

const c1 = center(chest1);
p1.x = c1.x - CHEST.openRadius - 5; p1.y = c1.y;
chests.update();
assert(!chests.isOpen("1,1", chest1), "longe do raio não abre");

p2.x = c1.x - CHEST.openRadius + 5; p2.y = c1.y;
chests.update();
assert(chests.isOpen("1,1", chest1) && chests.justOpened.length === 1, "qualquer jogador perto (~2 tiles) abre");
assert(played.filter(c => c === "chestOpen").length === 1, "toca o som de abrir uma vez");
assert(chests.frameFor(chest1, "1,1")?.type === "chest_open", "baú aberto usa a animação de abertura");
assert(chests.frameFor(chest2, "1,1") === null && chests.frameFor(anvil, "1,1") === null, "baú fechado e bigorna não são trocados");

for (let i = 0; i < CHEST.burstDelaySteps - 2; i++) chests.update();
assert(scrap.pickups.length === 0, "a sucata espera a tampa abrir");
for (let i = 0; i < 3; i++) chests.update();
assert(scrap.pickups.length === 10, `solta a quantidade autorada (${scrap.pickups.length})`);

for (let i = 0; i < 200; i++) chests.update();
assert(scrap.pickups.length === 10 && played.filter(c => c === "chestOpen").length === 1, "abre uma vez só");
const last = chests.frameFor(chest1, "1,1");
assert(last.frame === 3 && last.sx === 1 && last.sy === 1, "termina no último quadro, sem squash");

const c2 = center(chest2);
p1.x = c2.x; p1.y = c2.y; p1.falling = true;
chests.update();
assert(!chests.isOpen("1,1", chest2), "jogador caindo não abre");
p1.falling = false;
chests.update();
for (let i = 0; i < CHEST.burstDelaySteps + 1; i++) chests.update();
assert(scrap.pickups.length === 10 + SCRAP.chestDefault, "baú sem valor usa o padrão");

assert(chestScrapAmount({ scrap: 15 }) === 15 && chestScrapAmount({ scrap: -1 }) === SCRAP.chestDefault
    && chestScrapAmount({ scrap: 5000 }) === SCRAP.chestMax && chestScrapAmount({ scrap: "x" }) === SCRAP.chestDefault, "chestScrapAmount valida o valor");

chests.reset();
assert(!chests.isOpen("1,1", chest1), "reset fecha os baús (nova partida)");

{
    const s = new ScrapSystem();
    const cs = new ChestSystem({ rooms, scrap: s, getPlayers: () => [player(c1.x, c1.y)] });
    cs.update();
    assert(cs.isOpen("1,1", chest1) && s.pickups.length === 0, "baú abriu e a sucata ainda não saiu");
    assert(cs.flushPending() === 10 && s.amount === 10, "sair da sala antes da explosão credita a sucata pendente");
    for (let i = 0; i < CHEST.burstDelaySteps + 2; i++) cs.update();
    assert(s.pickups.length === 0 && cs.flushPending() === 0, "sem explosão dupla nem crédito duplo");
}

const r = { cols: 10, rows: 10, props: [] };
placeProp(r, "chest", 2, 2, false, { scrap: 15 });
placeProp(r, "flag", 4, 4, false, null);
assert(r.props[0].scrap === 15 && r.props[0].type === "chest" && !("scrap" in r.props[1]), "editor grava a sucata só no baú");

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
