import { ForgeSystem } from '../js/systems/ForgeSystem.js';
import { ForgeState } from '../js/systems/ForgeState.js';
import { ScrapSystem } from '../js/systems/ScrapSystem.js';
import { TILE } from '../js/config/GameConfig.js';

let passed = 0;
let failed = 0;
function assert(condition, message) {
    if (condition) { console.log(`✅ PASSOU: ${message}`); passed++; }
    else { console.error(`❌ FALHOU: ${message}`); failed++; }
}

console.log("=== TESTE DO MENU DA BIGORNA ===");

const held = new Set();
const input = { isDown: k => held.has(k) };
const tap = (fs, key, frame = false) => {
    held.add(key);
    frame ? fs.handleInput() : fs.update();
    held.delete(key);
    frame ? fs.handleInput() : fs.update();
};
const anvil = { type: "anvil", col: 24, row: 26 };
const room = { key: "1,1", tiles: { props: [anvil] }, enemies: [] };
const rooms = { current: room, cellRect: () => ({ x: 0, y: 0, w: 30 * TILE, h: 30 * TILE }) };
const ax = 25 * TILE, ay = 26.5 * TILE;
const p1 = { x: ax - 300, y: ay, lives: 3, falling: false };
const p2 = { x: ax + 400, y: ay, lives: 3, falling: false };
const forge = new ForgeState();
const scrap = new ScrapSystem();
let enemiesAlive = false;
const bought = [];
const sounds = [];
const fs = new ForgeSystem({
    rooms, getPlayers: () => [p1, p2], input, forge, scrap,
    audio: { play: c => sounds.push(c) },
    canOpen: () => !enemiesAlive, onBuy: id => bought.push(id)
});

fs.update();
const shine0 = fs.frameFor(anvil)?.shine;
fs.update();
assert(fs.frameFor(anvil)?.type === "anvil" && fs.frameFor(anvil).frame === 0 && shine0 !== fs.frameFor(anvil).shine, "a bigorna tem a faixa de brilho andando, como o baú");
assert(fs.frameFor({ type: "chest", col: 1, row: 1 }) === null, "o brilho da forja só vale para a bigorna");
tap(fs, "e");
assert(!fs.open && fs.promptTargets.length === 0, "longe da bigorna: sem indicador e não abre");

p2.x = ax + 60;
fs.update();
assert(fs.promptTargets.length === 1 && fs.promptTargets[0].users.join() === "1" && !fs.promptTargets[0].blocked, "perto: indicador para o P2");
tap(fs, "e");
assert(!fs.open, "P1 longe apertando E não abre (só quem está perto)");

enemiesAlive = true;
tap(fs, "shiftright");
assert(!fs.open && fs.promptTargets[0]?.blocked === true, "com inimigos vivos não abre e o indicador marca bloqueado");
enemiesAlive = false;

tap(fs, "shiftright");
assert(fs.open && fs.recipes.join() === "saw,drag,size,inertia,snapWave,quickLink,hearts", "P2 perto abre com as receitas padrão");
assert(sounds.includes("uiOpen"), "som de abrir");
fs.handleInput();
assert(fs.open, "a tecla que abriu não fecha no frame seguinte");

assert(fs.cursor === 0, "cursor começa no primeiro item");
tap(fs, " ", true);
assert(bought.length === 0 && fs.denyT > 0 && scrap.amount === 0, "sem sucata a compra é recusada");

scrap.wallet.add(30);
tap(fs, " ", true);
assert(bought[0] === "saw" && scrap.amount === 20 && forge.has("saw"), "Espaço compra a Serra");
tap(fs, "s", true);
assert(fs.cursor === 1, "S desce o cursor");
fs.handleInput({ up: true });
fs.handleInput({});
assert(fs.cursor === 0, "D-pad sobe o cursor");
fs.handleInput({ up: true });
assert(fs.cursor === 6, "o cursor dá a volta");
fs.handleInput({});
for (let i = 0; i < 3; i++) { fs.handleInput({ down: true }); fs.handleInput({}); }
fs.handleInput({ a: true });
assert(bought[1] === "size" && scrap.amount === 5, "A do controle compra Tamanho (15)");

tap(fs, "e", true);
assert(!fs.open && sounds.includes("uiClose"), "interagir fecha");
fs.update();
assert(!fs.open, "o mesmo E não reabre no step seguinte");

tap(fs, "shiftright");
fs.handleInput({ b: true });
assert(!fs.open, "B fecha");
fs.update();

anvil.recipes = ["size"];
tap(fs, "shiftright");
assert(fs.open && fs.recipes.join() === "size", "bigorna com receitas autoradas");
fs.handleInput();
held.add("escape"); fs.handleInput(); held.clear();
assert(!fs.open, "Esc fecha");
fs.update();

anvil.recipes = ["size", "elasticity", "weight", "doubleSaw"];
tap(fs, "shiftright");
assert(fs.open && fs.recipes.join() === "size", "receitas removidas gravadas num mapa antigo não aparecem");
held.add("escape"); fs.handleInput(); held.clear();

// Bordas por tecla e navegação só pelo teclado real.
{
    const kb = new Set(), all = new Set();
    const input2 = { keyboardKeys: kb, isDown: k => all.has(k) || kb.has(k) };
    const forge2 = new ForgeState();
    forge2.reset({ items: ["saw"] });
    const sys = new ForgeSystem({ rooms, getPlayers: () => [p1, p2], input: input2, forge: forge2, scrap: new ScrapSystem() });
    anvil.recipes = ["saw", "size"];
    sys.openAt({ prop: anvil, roomKey: "1,1", x: ax, y: ay });
    kb.add("arrowup"); sys.handleInput();
    const afterHold = sys.cursor;
    kb.add("w"); sys.handleInput();
    assert(sys.cursor === (afterHold + 1) % 2, "P1 aperta W enquanto P2 segura a seta: o cursor anda");
    kb.clear(); sys.handleInput();
    const c0 = sys.cursor;
    all.add("s"); sys.handleInput(); all.delete("s"); sys.handleInput();
    assert(sys.cursor === c0, "S vindo do analógico (não teclado) não move: o MenuPad cuida do controle");
    all.add("e"); sys.handleInput();
    assert(!sys.open, "X do controle (vira 'e') fecha");
}

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
