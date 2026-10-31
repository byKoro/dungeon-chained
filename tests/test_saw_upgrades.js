import { Chain } from '../js/core/Chain.js';
import { SawWeapon } from '../js/weapons/SawWeapon.js';
import { CHAIN } from '../js/config/ChainConfig.js';
import { FORGE } from '../js/config/ForgeConfig.js';
import { ForgeState, applySawUpgrades, applyHeartUpgrades, snapWaveRadius } from '../js/systems/ForgeState.js';
import { ScrapWallet } from '../js/systems/ScrapWallet.js';
import { CombatSystem } from '../js/combat/CombatSystem.js';

let passed = 0;
let failed = 0;
function assert(condition, message) {
    if (condition) { console.log(`✅ PASSOU: ${message}`); passed++; }
    else { console.error(`❌ FALHOU: ${message}`); failed++; }
}
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

console.log("=== TESTE DAS MELHORIAS DA SERRA ===");

const player = (x, y) => ({ x, y, vx: 0, vy: 0, speed: 4.2, speedMag: 0, hitRadius: 16 });
const setup = (buys = []) => {
    const forge = new ForgeState();
    forge.reset({ items: ["saw"] });
    const wallet = new ScrapWallet(999);
    for (const id of buys) forge.buy(id, wallet);
    const weapon = new SawWeapon();
    const chain = new Chain([weapon], CHAIN);
    applySawUpgrades(forge, chain, weapon, CHAIN);
    return { forge, weapon, chain };
};

// Tamanho: +20% por nível no raio do disco (acerto e colisão acompanham).
{
    const base = setup().weapon;
    const lvl2 = setup(["size", "size"]).weapon;
    assert(near(lvl2.discRadius, base.discRadius * 1.24), `Tamanho 2: raio ${lvl2.discRadius.toFixed(1)} = 1,24 × ${base.discRadius.toFixed(1)}`);
    assert(near(lvl2.collisionRadius, base.collisionRadius * 1.24), "raio de colisão acompanha");
}

// Só Serra e Tamanho existem na forja; o cabo fica com os valores-base e a serra nunca divide.
{
    assert(Object.keys(FORGE.recipes).join() === "tackle,saw,drag,size,inertia,snapWave,quickLink,hearts,moveSpeed,dashPush,coopHeal,dashCooldown,dashCharges", "catálogo da forja");
    const { chain, weapon } = setup(["size"]);
    assert(near(chain.strainDistance, CHAIN.strainDistance) && near(chain.breakDistance, CHAIN.breakDistance), "cabo com tensão e ruptura base");
    const p1 = player(0, 0), p2 = player(0.9 * 240, 0);
    for (let i = 0; i < 30; i++) { p1.x = 0; p2.x = 0.9 * 240; chain.strain = 0; chain.update(p1, p2); }
    assert(!weapon.doubleSaw && weapon.getSawPositions(p1, p2).length === 1, "sem Serra dupla: uma serra só");
}

// Inércia: solta, a serra segue girando pelo tempo do nível e depois desacelera; posta na bigorna, não gira.
{
    const { weapon: plain } = setup();
    plain.spin = 1; plain.drop(0, 0);
    assert(!plain.spinningLoose, "sem Inércia a serra solta não fica girando");

    const { chain, weapon } = setup(["inertia", "inertia"]);
    const steps = Math.round(FORGE.recipes.inertia.seconds[1] * 60);
    assert(weapon.inertiaSteps === steps, `Inércia 2: ${steps} steps`);
    weapon.spin = 0.2;
    chain.forceDrop(player(0, 0), player(100, 0));
    assert(weapon.spinningLoose && weapon.spin >= FORGE.inertia.minSpin, "solta parada, a serra ganha o giro mínimo da Inércia");
    const r0 = weapon.rotation;
    for (let i = 0; i < steps - 1; i++) { weapon.update(); weapon.updateDropped(); }
    assert(weapon.spinningLoose && near(weapon.spin, Math.max(0.2, FORGE.inertia.minSpin)) && weapon.rotation !== r0, "gira sem perder velocidade durante o tempo");
    weapon.update(); weapon.updateDropped();
    for (let i = 0; i < 120; i++) weapon.update();
    assert(!weapon.spinningLoose && weapon.spin < FORGE.inertia.minSpin, "acabou o tempo: para de cortar e desacelera");

    chain.spawnSaw(0, 0);
    assert(!weapon.spinningLoose, "serra posta na bigorna não gira");
}

// Inércia corta inimigos encostados no disco solto.
{
    const { chain, weapon } = setup(["inertia"]);
    weapon.spin = 1;
    chain.forceDrop(player(0, 0), player(100, 0), () => ({ x: 500, y: 500 }));
    const noop = new Proxy({}, { get: () => () => {} });
    const combat = new CombatSystem({ renderer: noop, particleSystem: noop, audio: noop, hitFeedback: true });
    const enemy = (x) => ({ x, y: 500, hitRadius: 18, state: "chase", hits: 0, takeHit() { this.hits++; return { damage: 1, killed: false }; } });
    const near1 = enemy(520), far = enemy(700);
    combat.resolveLooseSawHits(weapon, [near1, far]);
    assert(near1.hits === 1 && far.hits === 0, "o disco solto girando acerta só quem encosta");
}

// Estalo: raio por nível; a onda acerta uma vez quem está no raio, e ninguém fora dele.
{
    const { forge, weapon } = setup(["snapWave"]);
    assert(snapWaveRadius(setup().forge) === 0 && near(snapWaveRadius(forge), FORGE.recipes.snapWave.radius[0]), "sem Estalo raio 0; nível 1 = 1,6 tiles");
    const noop = new Proxy({}, { get: () => () => {} });
    const combat = new CombatSystem({ renderer: noop, particleSystem: noop, audio: noop, hitFeedback: true });
    const enemy = (x) => ({ x, y: 0, hitRadius: 18, state: "chase", hits: 0, takeHit() { this.hits++; return { damage: 1, killed: false }; } });
    const r = snapWaveRadius(forge), inside = enemy(r), outside = enemy(r + 40);
    combat.resolveSnapWave(weapon, [inside, outside], 0, 0, r);
    assert(inside.hits === 1 && outside.hits === 0, "a onda acerta quem encosta no raio e mais ninguém");
}

// Reconexão rápida: raio de pegar e distância de reconexão maiores, espera menor.
{
    const { chain } = setup();
    assert(chain.pickupRadius === CHAIN.pickupRadius && chain.reconnectDelay === 20, "sem a melhoria: 60 px e 20 steps");
    const { chain: fast } = setup(["quickLink", "quickLink"]);
    assert(near(fast.pickupRadius, CHAIN.pickupRadius * 1.8) && near(fast.reconnectDistance, CHAIN.reconnectDistance * 1.8) && fast.reconnectDelay === 6, "nível 2: 108 px, 198 px, 6 steps");
    fast.spawnSaw(0, 0);
    fast.update(player(-90, 0), player(90, 0));
    assert(fast.isConnected, "a 90 px da serra largada os dois já reconectam");
    chain.spawnSaw(0, 0);
    chain.update(player(-90, 0), player(90, 0));
    assert(!chain.isConnected, "sem a melhoria, a 90 px não reconecta");
}

// Coração: +1 máximo por nível para os dois, já cheio; reset volta a 3.
{
    const forge = new ForgeState();
    const wallet = new ScrapWallet(999);
    const a = { lives: 2, maxLives: 3 }, b = { lives: 3, maxLives: 3 };
    assert(forge.status("hearts", 999) === "ok", "Coração não precisa da Serra");
    forge.buy("hearts", wallet); applyHeartUpgrades(forge, [a, b]);
    forge.buy("hearts", wallet); applyHeartUpgrades(forge, [a, b]);
    assert(a.maxLives === 5 && b.maxLives === 5 && a.lives === 4 && b.lives === 5, "dois níveis: máximo 5, e cada nível enche um coração");
    assert(wallet.amount === 999 - 80 - 140 && forge.status("hearts", 999) === "maxed", "Coração custa 80 + 140 e para no nível 2");
    forge.reset();
    applyHeartUpgrades(forge, [a, b]);
    assert(a.maxLives === 3 && a.lives === 3 && b.lives === 3, "nova partida: volta a 3 corações");
}

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
