import assert from 'node:assert/strict';
import { FORGE, anvilRecipes } from '../js/config/ForgeConfig.js';
import { ForgeState, applySawUpgrades, sawTackleTuning, embersParams, reconnectBlastParams, lastStandParams } from '../js/systems/ForgeState.js';
import { ScrapWallet } from '../js/systems/ScrapWallet.js';
import { lockedText } from '../js/ui/ForgeMenu.js';
import { SawTackle } from '../js/systems/SawTackle.js';
import { SawEmbers } from '../js/systems/SawEmbers.js';
import { ReconnectBlast } from '../js/systems/ReconnectBlast.js';
import { LastStand } from '../js/systems/LastStand.js';
import { Chain } from '../js/core/Chain.js';
import { SawWeapon } from '../js/weapons/SawWeapon.js';
import { CHAIN } from '../js/config/ChainConfig.js';
import { SAW_TACKLE } from '../js/config/SawTackleConfig.js';
import { PLAYER_DASH } from '../js/config/GameConfig.js';

const near = (a, b) => Math.abs(a - b) < 1e-9;
const forgeWith = (levels) => { const f = new ForgeState(); for (const [id, n] of Object.entries(levels)) f.setLevel(id, n); return f; };

// --- Catálogo e pré-requisitos ---
{
    assert.deepEqual([...FORGE.penhascoRecipes], ["tackle", "size2", "tackleHits", "ricochet", "embers", "tackleLong", "reconnectBlast"]);
    assert.ok(FORGE.bootsRecipes.at(-1) === "lastStand", 'Segunda chance no fim da botas');
    assert.ok(!FORGE.penhascoRecipes.includes("saw") && !FORGE.penhascoRecipes.includes("size"), 'Penhasco sem o catálogo base');
    const f = forgeWith({ saw: 1, size: 2 });
    assert.equal(f.status("size2", 999), "locked", 'Tamanho II travado com Tamanho 2');
    f.setLevel("size", 3);
    assert.equal(f.status("size2", 999), "ok", 'Tamanho II libera com Tamanho 3');
    assert.equal(f.status("size2", 69), "poor");
    for (const id of ["tackleHits", "ricochet", "embers", "tackleLong"]) assert.equal(f.status(id, 999), "locked", `${id} precisa da Investida`);
    assert.equal(f.status("reconnectBlast", 999), "ok", 'Reconexão explosiva só precisa da Serra');
    f.setLevel("tackle", 1);
    for (const id of ["tackleHits", "ricochet", "embers", "tackleLong"]) assert.equal(f.status(id, 999), "ok", `${id} com a Investida`);
    assert.equal(lockedText(FORGE.recipes.size2), "Precisa de Tamanho 3.");
    assert.equal(lockedText(FORGE.recipes.tackleHits), "Precisa da Investida.");
    assert.equal(lockedText(FORGE.recipes.reconnectBlast), "Precisa da Serra.");
    assert.equal(lockedText({}), "Precisa da Serra.", 'sem aviso próprio cai no genérico');
    const wallet = new ScrapWallet(); wallet.add(170);
    assert.ok(f.buy("size2", wallet).ok && f.buy("size2", wallet).ok && wallet.amount === 0, 'Tamanho II custa 70 + 100');
    const chain = new Chain([new SawWeapon()], CHAIN);
    applySawUpgrades(f, chain, chain.weapon, CHAIN);
    assert.ok(near(chain.weapon.sizeScale, 1.6), `serra 1,60× com Tamanho 3 + Tamanho II 2 (${chain.weapon.sizeScale})`);
    assert.ok(anvilRecipes({ type: "anvil", recipes: [...FORGE.penhascoRecipes] }).length === 7);
}

// --- Parâmetros por nível ---
{
    assert.deepEqual(sawTackleTuning(new ForgeState()), {}, 'sem melhorias, nenhum ajuste');
    const t = sawTackleTuning(forgeWith({ tackleHits: 2, tackleLong: 1, ricochet: 2 }));
    assert.deepEqual(t, { hits: 10, speed: 17, returnStartSteps: 55, ricochetJumps: 2, ricochetRange: 300 });
    assert.equal(embersParams(new ForgeState()), null);
    assert.deepEqual(embersParams(forgeWith({ embers: 1 })), { lifeSteps: 90, damage: 1, spacing: 24, radius: 22 });
    assert.equal(reconnectBlastParams(new ForgeState()), null);
    assert.equal(reconnectBlastParams(forgeWith({ reconnectBlast: 2 })).radius, FORGE.recipes.reconnectBlast.radius[1]);
    assert.equal(reconnectBlastParams(forgeWith({ reconnectBlast: 1 })).cooldownSteps, 180);
    assert.equal(lastStandParams(forgeWith({ lastStand: 1 })).invulnSteps, 90);
}

// --- SawTackle com as melhorias ---
const player = (x, y) => ({
    x, y, vx: 0, vy: 0, dashing: false, dashDirX: 1, dashDirY: 0, hitRadius: 16, lives: 3, falling: false,
    startTackle() { this.dashing = false; this.vx = this.vy = 0; }
});
const dash = (p) => Object.assign(p, { dashing: true, dashDirX: 1, dashDirY: 0, vx: PLAYER_DASH.speed, vy: 0 });
const enemy = (x, y, extra = {}) => ({
    x, y, hitRadius: 20, hp: 50, state: 'chase', accepted: 0,
    takeHit(d) { this.hp -= d; this.accepted++; if (this.hp <= 0) { this.state = 'dying'; return { killed: true }; } return { killed: false }; },
    ...extra
});
const setup = ({ enemies = [], tuning = {} } = {}) => {
    const chain = new Chain([new SawWeapon()], CHAIN);
    chain.spawnSaw(1000, 1000);
    const p1 = player(972, 1000), p2 = player(100, 1600);
    const room = { enemies, wallBoxes: [] };
    const tackle = new SawTackle({
        chain, getPlayers: () => [p1, p2], getRoom: () => room, getBounds: () => ({ minX: 0, minY: 0, maxX: 3000, maxY: 3000 }),
        safeDrop: (x, y) => ({ x, y }), cfg: { ...SAW_TACKLE, aimConeDeg: 0 }, getTuning: () => tuning
    });
    return { chain, w: chain.weapon, p1, tackle, room };
};
const runUntil = (tackle, done, max = 900) => { for (let i = 0; i < max && !done(); i++) tackle.update(); return done(); };
{
    const a = enemy(1150, 1000);
    const { tackle, p1 } = setup({ enemies: [a], tuning: { hits: 7 } });
    dash(p1); tackle.update();
    runUntil(tackle, () => a.accepted >= 7 && tackle.state !== 'stuck');
    assert.equal(a.accepted, 7, `Mais cortes: 7 acertos aceitos (${a.accepted})`);
}
{
    const { tackle, p1 } = setup({ tuning: { speed: 17 } });
    dash(p1); tackle.update();
    runUntil(tackle, () => tackle.state === 'flight');
    assert.ok(near(Math.hypot(tackle.vx, tackle.vy), 17), 'Investida longa: voo a 17 px/step');
    assert.equal(tackle.cfg.returnStartSteps, SAW_TACKLE.returnStartSteps, 'sem o nível, a volta começa no padrão');
}
{
    const { tackle, p1 } = setup();
    dash(p1); tackle.update();
    assert.equal(tackle.cfg.hits, SAW_TACKLE.hits, 'sem melhorias usa o SAW_TACKLE');
}
// Ricochete: depois do primeiro inimigo, vai para o segundo (fora da linha do voo); sem a melhoria, não.
for (const jumps of [0, 1]) {
    const a = enemy(1150, 1000, { hp: 1 });
    const b = enemy(1150, 1220);
    const { tackle, p1 } = setup({ enemies: [a, b], tuning: jumps ? { ricochetJumps: jumps, ricochetRange: 300 } : {} });
    dash(p1); tackle.update();
    runUntil(tackle, () => a.state === 'dying');
    tackle.update();
    runUntil(tackle, () => b.accepted > 0 || !tackle.state, 300);
    if (jumps) {
        assert.ok(b.accepted > 0, 'Ricochete: o segundo inimigo é atingido');
        assert.equal(tackle.ricochetLeft, 0, 'gastou o pulo');
    } else assert.equal(b.accepted, 0, 'sem Ricochete o segundo inimigo fica de fora');
}
{
    const arauto = enemy(1150, 1000, { effectMaterial: 'lavaStone', hp: 2 });
    const b = enemy(1150, 1220);
    const { tackle, p1 } = setup({ enemies: [arauto, b], tuning: { ricochetJumps: 2, ricochetRange: 300 } });
    dash(p1); tackle.update();
    runUntil(tackle, () => arauto.state === 'dying');
    assert.equal(tackle.ricochetLeft, 2, 'Arauto não dispara ricochete');
}

// --- Brasa ---
{
    const params = embersParams(forgeWith({ embers: 1 }));
    const w = { dropX: 0, dropY: 0 };
    const tackle = { mode: 'tackle', state: 'flight', launchId: 1, chain: { weapon: w } };
    const a = enemy(100, 30, { hp: 3 }), arauto = enemy(200, 0, { effectMaterial: 'lavaStone', hp: 80 });
    const room = { enemies: [a, arauto] };
    let on = true;
    const embers = new SawEmbers({ getParams: () => on ? params : null, getTackle: () => tackle, getRoom: () => room });
    for (let x = 0; x <= 300; x += 15) { w.dropX = x; embers.update(); }
    assert.ok(embers.embers.length >= 10, `brasas a cada ~24 px (${embers.embers.length})`);
    assert.equal(a.accepted, 1, 'inimigo perto das brasas leva 1 de dano');
    assert.equal(arauto.accepted, 0, 'Arauto imune à Brasa');
    for (let i = 0; i < 30; i++) embers.update();
    assert.equal(a.accepted, 1, 'uma vez por lançamento');
    tackle.launchId = 2; w.dropX = 100; w.dropY = 30;
    embers.update();
    assert.equal(a.accepted, 2, 'novo lançamento queima de novo');
    tackle.state = null;
    for (let i = 0; i < params.lifeSteps + 2; i++) embers.update();
    assert.equal(embers.embers.length, 0, 'as brasas apagam depois de 1,5 s');
    on = false;
}

// --- Reconexão explosiva ---
{
    let params = null;
    const blasts = [];
    const rb = new ReconnectBlast({ getParams: () => params, blast: (x, y, r) => blasts.push({ x, y, r }) });
    assert.ok(!rb.onReconnect(1, 1), 'sem a melhoria não explode');
    params = reconnectBlastParams(forgeWith({ reconnectBlast: 1 }));
    assert.ok(!rb.onReconnect(1, 1, { first: true }), 'a primeira conexão (cinemática) não conta');
    assert.ok(rb.onReconnect(5, 6) && blasts[0].r === params.radius && blasts[0].x === 5, 'reconectar solta a onda');
    assert.ok(!rb.onReconnect(5, 6), 'recarga de 3 s');
    for (let i = 0; i < params.cooldownSteps; i++) rb.update();
    assert.ok(rb.onReconnect(5, 6) && blasts.length === 2, 'depois da recarga explode de novo');
}

// --- Segunda chance ---
{
    let params = null;
    const p1 = { lives: 0, invulnerableTimer: 0, falling: false }, p2 = { lives: 0, invulnerableTimer: 0, falling: false };
    const saved = [];
    const ls = new LastStand({ getParams: () => params, getPlayers: () => [p1, p2], onSave: (p, i) => saved.push(i) });
    assert.ok(!ls.check() && p1.lives === 0, 'sem a melhoria não salva');
    params = lastStandParams(forgeWith({ lastStand: 1 }));
    p2.falling = true;
    assert.ok(ls.check() && p1.lives === 1 && p1.invulnerableTimer === 90 && p2.lives === 0, 'salva quem zerou (a queda é salva no _resolveFall)');
    assert.ok(ls.save(p2) && p2.lives === 1, 'queda também é salva');
    p1.lives = 0;
    assert.ok(!ls.check() && p1.lives === 0, 'uma vez por sala');
    ls.reset();
    assert.ok(ls.check() && p1.lives === 1 && saved.join() === "0,1,0", 'sala nova: carga volta');
    const inf = { lives: 0, infiniteLives: true };
    const ls2 = new LastStand({ getParams: () => params, getPlayers: () => [inf] });
    assert.ok(!ls2.save(inf), 'vida infinita não gasta a carga');
}

console.log('Penhasco: catálogo, pré-requisito por nível, Tamanho II, Mais cortes, Investida longa, Ricochete, Brasa, Reconexão explosiva e Segunda chance passaram.');
