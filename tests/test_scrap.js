import { ScrapWallet } from '../js/systems/ScrapWallet.js';
import { ScrapSystem } from '../js/systems/ScrapSystem.js';
import { ScrapPickup } from '../js/entities/ScrapPickup.js';
import { SCRAP } from '../js/config/ScrapConfig.js';
import { TILE } from '../js/config/GameConfig.js';

let passed = 0;
let failed = 0;
function assert(condition, message) {
    if (condition) { console.log(`✅ PASSOU: ${message}`); passed++; }
    else { console.error(`❌ FALHOU: ${message}`); failed++; }
}

console.log("=== TESTE DA SUCATA ===");

const player = (x, y, extra = {}) => ({ x, y, hitRadius: 16, lives: 3, falling: false, ...extra });
const run = (pickup, players, steps) => {
    for (let i = 0; i < steps; i++) { const who = pickup.update(players); if (who) return { who, step: i + 1 }; }
    return null;
};

// Carteira
{
    const w = new ScrapWallet();
    w.add(10); w.add(-5); w.add(2.9);
    assert(w.amount === 12, "carteira soma só valores positivos inteiros");
    assert(!w.spend(13) && w.amount === 12, "gasto maior que o saldo é recusado");
    assert(w.spend(12) && w.amount === 0, "gasto exato zera o saldo");
    w.add(4); w.reset();
    assert(w.amount === 0, "reset zera a carteira");
}

// Fica parada 0,4 s antes de ser atraída, mesmo com jogador do lado.
{
    const s = new ScrapPickup(0, 0);
    const p = player(30, 0);
    const got = run(s, [p], SCRAP.restSteps + 30);
    assert(got && got.step > SCRAP.restSteps, `não coleta durante o repouso (coletou no step ${got?.step})`);
}

// Ímã: atrai dentro de ~2,5 tiles; fora disso fica parada.
{
    const near = new ScrapPickup(0, 0);
    const pNear = player(2.2 * TILE, 0);
    assert(!!run(near, [pNear], 200), "jogador a 2,2 tiles atrai e coleta");

    const far = new ScrapPickup(0, 0);
    const pFar = player(3 * TILE, 0);
    assert(!run(far, [pFar], 200) && Math.abs(far.x) < 1, "jogador a 3 tiles não atrai");
}

// Vai para o jogador mais próximo; ignora quem caiu ou está sem vidas.
{
    const s = new ScrapPickup(0, 0);
    const a = player(100, 0), b = player(-60, 0);
    assert(run(s, [a, b], 200)?.who === b, "coleta pelo jogador mais próximo");

    const s2 = new ScrapPickup(0, 0);
    const fallen = player(-40, 0, { falling: true }), ok = player(110, 0);
    assert(run(s2, [fallen, ok], 200)?.who === ok, "jogador caindo não atrai");
}

// Arco: sobe, quica e assenta antes de contar o repouso.
{
    const s = new ScrapPickup(0, 0, { vz: 6, z: 10 });
    let maxZ = 0, bounces = 0, prevVz = s.vz;
    for (let i = 0; i < 200 && !s.landed; i++) {
        s.update([]);
        maxZ = Math.max(maxZ, s.z);
        if (prevVz < 0 && s.vz > 0) bounces++;
        prevVz = s.vz;
    }
    assert(maxZ > 10 && bounces >= 1 && s.landed && s.z === 0, `arco sobe (${maxZ.toFixed(1)}), quica (${bounces}) e assenta`);
    assert(s.restTimer === SCRAP.restSteps, "repouso só começa depois de assentar");
}

// Sistema: drop por tipo, vácuo e saída da sala.
{
    const sys = new ScrapSystem({ rng: () => 0.5 });
    assert(sys.dropFromEnemy({ typeKey: "demon", x: 0, y: 0 }) === 1, "demônio solta 1");
    assert(sys.dropFromEnemy({ typeKey: "bloodMonster", x: 0, y: 0 }) === 3, "monstro de sangue solta 3");
    assert(sys.dropFromEnemy({ typeKey: "blackKnightB", x: 0, y: 0 }) === 5, "cavaleiro negro B solta 5");
    assert(sys.dropFromEnemy({ typeKey: "cultist", x: 0, y: 0 }) === 0, "tipo sem valor não solta");
    assert(sys.pickups.length === 9, "9 peças no chão");

    sys.vacuum();
    const far = player(10 * TILE, 0);
    for (let i = 0; i < 400 && sys.pickups.length; i++) sys.update([far]);
    assert(sys.pickups.length === 0 && sys.amount === 9, `vácuo puxa tudo de longe, sem repouso (saldo ${sys.amount})`);

    sys.spawnBurst(0, 0, 4);
    assert(sys.collectAll() === 4 && sys.amount === 13 && !sys.pickups.length, "collectAll credita o que ficou no chão");
    sys.reset();
    assert(sys.amount === 0 && !sys.pickups.length, "reset zera saldo e chão");
}

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
