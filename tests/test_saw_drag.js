import { SawDrag } from '../js/systems/SawDrag.js';
import { Chain } from '../js/core/Chain.js';
import { SawWeapon } from '../js/weapons/SawWeapon.js';
import { CHAIN } from '../js/config/ChainConfig.js';
import { SAW_DRAG, FORGE } from '../js/config/ForgeConfig.js';
import { ForgeState, sawDragStats } from '../js/systems/ForgeState.js';
import { ScrapWallet } from '../js/systems/ScrapWallet.js';
import { TILE } from '../js/config/GameConfig.js';

let passed = 0;
let failed = 0;
function assert(condition, message) {
    if (condition) { console.log(`✅ PASSOU: ${message}`); passed++; }
    else { console.error(`❌ FALHOU: ${message}`); failed++; }
}

console.log("=== TESTE DO ARRASTO DA SERRA ===");

const player = (x, y) => ({ x, y, vx: 0, vy: 0, speed: 4.2, speedMag: 0, hitRadius: 16, lives: 3, falling: false });
const setup = ({ blocked = () => false, weight = 0 } = {}) => {
    const forge = new ForgeState();
    forge.reset({ items: ["saw"] });
    const wallet = new ScrapWallet(999);
    for (let i = 0; i < weight; i++) forge.buy("weight", wallet);
    const chain = new Chain([new SawWeapon()], CHAIN);
    chain.spawnSaw(500, 500);
    const held = new Set();
    const p1 = player(500 - 40, 500), p2 = player(1500, 500);
    const drag = new SawDrag({
        chain, getPlayers: () => [p1, p2], input: { isDown: k => held.has(k) },
        getStats: () => sawDragStats(forge, TILE), isBlocked: blocked
    });
    return { forge, chain, held, p1, p2, drag, w: chain.weapon };
};
const steps = (drag, n, fn = null) => { for (let i = 0; i < n; i++) { fn?.(); drag.update(); } };

// Pega segurando, não tocando.
{
    const { drag, held, p1 } = setup();
    drag.update();
    assert(drag.prompt === "drag.prompt", "perto da serra largada: mostra a dica");
    held.add("e"); steps(drag, 3); held.delete("e"); steps(drag, 1);
    assert(!drag.active, "toque rápido não pega a serra");
    held.add("e"); steps(drag, SAW_DRAG.grabSteps + 1);
    assert(drag.isDragging(0) && !drag.isDragging(1) && drag.justGrabbed === false, "segurar interagir prende P1 à serra");
    assert(drag.speedScaleFor(0) === FORGE.recipes.weight.dragSpeed[0] && drag.speedScaleFor(1) === 1, "quem arrasta anda a 40%; o outro, normal");
    held.delete("e"); drag.update();
    assert(!drag.active, "soltar interagir solta a serra");
    void p1;
}

// Arrasta atrás do jogador, sem girar, até o limite; o cabo curto arrebenta e precisa soltar para pegar de novo.
{
    const { drag, held, p1, w } = setup();
    held.add("e"); steps(drag, SAW_DRAG.grabSteps + 1);
    w.dropSpin = 1;
    let moved = 0;
    while (drag.active && moved < 1000) { p1.x -= 2; moved += 2; drag.update(); }
    assert(Math.abs(drag.traveled - 2 * TILE) < 3 || !drag.active, "o arrasto conta a distância percorrida pela serra");
    assert(!drag.active && drag.justSnapped, `passados 2 tiles o cabo curto arrebenta (jogador andou ${moved} px)`);
    assert(Math.abs((p1.x - w.dropX)) <= SAW_DRAG.ropeLength + 3, "a serra ficou atrás do jogador, no comprimento do cabo");
    assert(w.dropSpin === 0, "arrastada, a serra não gira");
    steps(drag, SAW_DRAG.regrabSteps + SAW_DRAG.grabSteps + 5);
    assert(!drag.active, "segurando direto não pega de novo: precisa soltar");
    held.delete("e"); drag.update(); held.add("e");
    steps(drag, SAW_DRAG.grabSteps + 1);
    assert(drag.active, "soltou e segurou de novo: pega");
}

// Peso: mais distância e mais velocidade.
{
    const { drag, held, p1, forge } = setup({ weight: 2 });
    assert(forge.level("weight") === 2, "Peso comprado duas vezes (10 + 18)");
    assert(drag.speedScaleFor(0) === 1 && sawDragStats(forge, TILE).speedScale === 0.7, "Peso 2: 70% de velocidade");
    held.add("e"); steps(drag, SAW_DRAG.grabSteps + 1);
    let moved = 0;
    while (drag.active && moved < 2000) { p1.x -= 2; moved += 2; drag.update(); }
    assert(moved > 4 * TILE - 10 && moved < 4 * TILE + SAW_DRAG.ropeLength + 10, `Peso 2: arrasta 4 tiles (${moved} px)`);
}

// Obstáculo: a serra para; esticando demais o cabo curto arrebenta.
{
    const { drag, held, p1, w } = setup({ blocked: (x) => x < 480 });
    held.add("e"); steps(drag, SAW_DRAG.grabSteps + 1);
    let moved = 0;
    while (drag.active && moved < 400) { p1.x -= 2; moved += 2; drag.update(); }
    assert(w.dropX >= 480 && !drag.active && drag.justSnapped, "serra presa no obstáculo; o cabo arrebenta ao esticar");
}

// O parceiro chegando perto reconecta normalmente.
{
    const { drag, held, p1, p2, chain } = setup();
    held.add("e"); steps(drag, SAW_DRAG.grabSteps + 1);
    p2.x = chain.weapon.dropX + 30; p2.y = chain.weapon.dropY;
    p1.x = chain.weapon.dropX - 30;
    chain.update(p1, p2);
    drag.update();
    assert(chain.isConnected && !drag.active, "parceiro perto: o Chain reconecta e o arrasto acaba");
}

// Sem serra, conectada, arremessada ou bloqueada pelo Game: nada.
{
    const { drag, held, chain } = setup();
    chain.reset({ present: true });
    held.add("e"); steps(drag, SAW_DRAG.grabSteps + 5);
    assert(!drag.active && drag.prompt === null, "com o cabo conectado não arrasta");
    const s2 = setup();
    s2.w.thrown = true;
    s2.held.add("e"); steps(s2.drag, SAW_DRAG.grabSteps + 5);
    assert(!s2.drag.active, "serra arremessada não arrasta");
}

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
