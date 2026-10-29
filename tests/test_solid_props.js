import { ANIMATED_PROPS } from '../js/config/PropConfig.js';
import { TILE, HOLE_FALL } from '../js/config/GameConfig.js';
import { propBaseBox, propSortY, pushFeetOutOfBox } from '../js/core/PropBodies.js';
import { RoomProps } from '../js/systems/RoomProps.js';

let passed = 0;
let failed = 0;
function assert(condition, message) {
    if (condition) { console.log(`✅ PASSOU: ${message}`); passed++; }
    else { console.error(`❌ FALHOU: ${message}`); failed++; }
}

console.log("=== TESTE DOS PROPS SÓLIDOS ===");

const rect = { x: 0, y: 0, w: 30 * TILE, h: 30 * TILE };
const FOOT = HOLE_FALL.footOffset;
const anvil = { type: "anvil", col: 24, row: 26 };

// Bigorna 24×24 centrada na pegada 2×1: base = colunas 6..21, linhas 14..19 da arte (4 px de mundo por pixel de arte).
{
    const box = propBaseBox(anvil, ANIMATED_PROPS.anvil, rect, TILE);
    assert(box.x === 24 * TILE + 16 + 24 && box.w === 64, `x/largura da base da bigorna (${box.x}, ${box.w})`);
    assert(box.y === 26 * TILE - 16 + 56 && box.h === 24, `y/altura da base da bigorna (${box.y}, ${box.h})`);
    const flipped = propBaseBox({ ...anvil, flip: true }, ANIMATED_PROPS.anvil, rect, TILE);
    assert(flipped.x === 24 * TILE + 16 + (24 - 6 - 16) * 4, "base espelhada quando o prop está espelhado");
    assert(propBaseBox({ type: "flag", col: 1, row: 1 }, ANIMATED_PROPS.flag, rect, TILE) === null, "prop sem base não tem caixa");
}

// Baú 1×1 sem `art`: a base usa a escala da pegada.
{
    const box = propBaseBox({ type: "chest", col: 21, row: 26 }, ANIMATED_PROPS.chest, rect, TILE);
    assert(box.x === 21 * TILE + 4 && box.y === 26 * TILE + 32 && box.w === 56 && box.h === 24, "base do baú");
}

// Pés não entram na base, vindo de cima e de baixo.
{
    const box = propBaseBox(anvil, ANIMATED_PROPS.anvil, rect, TILE);
    const cx = box.x + box.w / 2;
    const fromAbove = { x: cx, y: box.y - FOOT - 2 };
    for (let i = 0; i < 20; i++) { fromAbove.y += 3; pushFeetOutOfBox(fromAbove, box, FOOT, 10); }
    assert(fromAbove.y + FOOT <= box.y - 9.9, `vindo de cima os pés param acima da base (pés ${(fromAbove.y + FOOT).toFixed(1)}, topo ${box.y})`);

    const fromBelow = { x: cx, y: box.y + box.h + 20 - FOOT };
    for (let i = 0; i < 20; i++) { fromBelow.y -= 3; pushFeetOutOfBox(fromBelow, box, FOOT, 10); }
    assert(fromBelow.y + FOOT >= box.y + box.h + 9.9, "vindo de baixo os pés param abaixo da base");

    const inside = { x: cx, y: box.y + 2 - FOOT };
    pushFeetOutOfBox(inside, box, FOOT, 10);
    assert(inside.y + FOOT <= box.y - 10 + 1e-6, "pés já dentro da base saem pelo lado mais perto");
}

// Ordem de render: pés acima do meio da base ⇒ atrás.
{
    const box = propBaseBox(anvil, ANIMATED_PROPS.anvil, rect, TILE);
    const sortY = propSortY(box, FOOT);
    const behind = { y: box.y - 10 - FOOT }, front = { y: box.y + box.h + 10 - FOOT };
    assert(behind.y < sortY && front.y > sortY, "jogador acima da base desenha antes, abaixo desenha depois");
}

// RoomProps separa chão e sólidos e empurra entidades.
{
    const room = { key: "1,1", tiles: { props: [anvil, { type: "flag", col: 2, row: 2 }, { col: 3, row: 3, index: 40 }] } };
    const rooms = { current: room, cellRect: () => rect };
    const rp = new RoomProps({ rooms, sprites: null });
    assert(rp.solid.length === 1 && rp.solid[0].prop === anvil, "só a bigorna é sólida");
    assert(rp.drawables(0).length === 1 && typeof rp.drawables(0)[0].draw === "function", "bigorna vira drawable ordenado por y");
    const box = rp.solid[0].box;
    const p = { x: box.x + box.w / 2, y: box.y + 4 - FOOT };
    const falling = { x: p.x, y: p.y, falling: true };
    rp.resolveCollisions([p, falling]);
    assert(p.y + FOOT < box.y && falling.y === box.y + 4 - FOOT, "empurra quem anda, ignora quem está caindo");
}

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
