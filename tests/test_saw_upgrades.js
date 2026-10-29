import { Chain } from '../js/core/Chain.js';
import { SawWeapon } from '../js/weapons/SawWeapon.js';
import { CHAIN } from '../js/config/ChainConfig.js';
import { FORGE } from '../js/config/ForgeConfig.js';
import { ForgeState, applySawUpgrades } from '../js/systems/ForgeState.js';
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
    assert(near(lvl2.discRadius, base.discRadius * 1.4), `Tamanho 2: raio ${lvl2.discRadius.toFixed(1)} = 1,4 × ${base.discRadius.toFixed(1)}`);
    assert(near(lvl2.collisionRadius, base.collisionRadius * 1.4), "raio de colisão acompanha");
}

// Elasticidade: +15% por nível na tensão (165) e na ruptura (240).
{
    const { chain } = setup(["elasticity", "elasticity", "elasticity"]);
    assert(near(chain.strainDistance, 165 * 1.45) && near(chain.breakDistance, 240 * 1.45), "Elasticidade 3: 239,25 / 348");
    const p1 = player(0, 0), p2 = player(300, 0);
    chain.update(p1, p2);
    assert(chain.isConnected, "a 300 px o cabo elástico não arrebenta");
    const { chain: plain } = setup();
    plain.update(player(0, 0), player(300, 0));
    assert(!plain.isConnected, "sem melhoria, a 300 px arrebenta");
}

// Serra dupla: divide acima de 85% da ruptura, junta abaixo de 70% (histerese).
{
    const { chain, weapon } = setup(["doubleSaw"]);
    const p1 = player(0, 0), p2 = player(100, 0);
    // Zera a tensão acumulada: aqui só interessa a geometria (acima da tensão o cabo arrebenta em 30 steps).
    const steps = (n) => { for (let i = 0; i < n; i++) { p1.x = 0; p2.x = d; p1.y = p2.y = 0; chain.strain = 0; chain.update(p1, p2); } };
    let d = 0.8 * 240;
    steps(30);
    assert(weapon.getSawPositions(p1, p2).length === 1, "a 80% da ruptura continua uma serra");
    d = 0.9 * 240;
    let splitSeen = false;
    for (let i = 0; i < 20; i++) { steps(1); splitSeen ||= weapon.justSplit; }
    const two = weapon.getSawPositions(p1, p2);
    assert(chain.isConnected && splitSeen && two.length === 2, "acima de 85% divide em duas (com aviso justSplit)");
    assert(near(two[0].x, d / 3, 2) && near(two[1].x, 2 * d / 3, 2), `discos em 1/3 e 2/3 do cabo (${two[0].x.toFixed(0)}, ${two[1].x.toFixed(0)})`);
    d = 0.78 * 240;
    steps(30);
    assert(weapon.getSawPositions(p1, p2).length === 2, "entre 70% e 85% continua dividida (histerese)");
    d = 0.6 * 240;
    let mergedSeen = false;
    for (let i = 0; i < 30; i++) { steps(1); mergedSeen ||= weapon.justMerged; }
    assert(mergedSeen && weapon.getSawPositions(p1, p2).length === 1, "abaixo de 70% junta de novo");

    const { chain: c2, weapon: w2 } = setup();
    d = 0.9 * 240;
    for (let i = 0; i < 30; i++) c2.update(player(0, 0), player(d, 0));
    assert(w2.getSawPositions(player(0, 0), player(d, 0)).length === 1, "sem a melhoria nunca divide");
}

// Os dois discos acertam.
{
    const { chain, weapon } = setup(["doubleSaw"]);
    const p1 = player(0, 0), p2 = player(216, 0);
    for (let i = 0; i < 20; i++) { p1.x = 0; p2.x = 216; chain.strain = 0; chain.update(p1, p2); }
    const [a, b] = weapon.getSawPositions(p1, p2);
    const noop = new Proxy({}, { get: () => () => {} });
    const combat = new CombatSystem({ renderer: noop, particleSystem: noop, audio: noop, hitFeedback: true });
    const enemy = (s) => ({ x: s.x, y: s.y + 40, hitRadius: 18, state: "chase", hits: 0, takeHit() { this.hits++; return { damage: 1, killed: false }; } });
    const e1 = enemy(a), e2 = enemy(b);
    combat.resolveWeaponHits(weapon, [e1, e2], p1, p2, true);
    assert(e1.hits === 1 && e2.hits === 1, "cada disco acerta o inimigo embaixo dele");
}

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
