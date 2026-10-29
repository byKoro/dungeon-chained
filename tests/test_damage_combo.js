import assert from 'node:assert/strict';
import { ParticleSystem } from '../js/particles/ParticleSystem.js';
import { comboColor } from '../js/particles/DamageCombo.js';
import { CombatSystem } from '../js/combat/CombatSystem.js';
import { DAMAGE_COMBO } from '../js/config/CombatFeelConfig.js';

const C = DAMAGE_COMBO;
const step = (ps, n) => { for (let i = 0; i < n; i++) ps.update([], null); };
const enemy = (x = 100, y = 200) => ({ x, y });

// --- janela, soma e visibilidade ---
{
    const ps = new ParticleSystem(null);
    const e = enemy();
    const combo = ps.triggerDamageCombo(e, 170, 1);
    assert.equal(combo.total, 1);
    assert.equal(combo.visible, false, 'um golpe só não mostra total');
    step(ps, C.windowSteps - 1);
    ps.triggerDamageCombo(e, 170, 1);
    assert.equal(ps.damageCombos.length, 1, 'golpe dentro da janela soma no mesmo combo');
    assert.equal(combo.total, 2);
    assert.equal(combo.visible, true, 'a partir do 2º golpe o total aparece');
    ps.triggerDamageCombo(e, 170, 2);
    assert.equal(combo.total, 4, 'soma todos os golpes, incluindo o primeiro');
    assert.equal(combo.popAge, 0, 'cada golpe somado dá um pulo');

    // fecha depois da janela sem golpe, segura e some
    step(ps, C.windowSteps);
    assert.equal(combo.open, false, 'combo fecha depois da janela');
    ps.triggerDamageCombo(e, 170, 1);
    assert.equal(ps.damageCombos.length, 2, 'golpe depois da janela abre outro combo');
    assert.equal(ps.damageCombos[1].total, 1);
    step(ps, C.holdSteps + C.fadeSteps);
    assert.ok(!ps.damageCombos.includes(combo), 'total antigo some depois de segurar e esmaecer');
}

// --- separado por inimigo ---
{
    const ps = new ParticleSystem(null);
    const a = enemy(), b = enemy(300);
    ps.triggerDamageCombo(a, 170, 1); ps.triggerDamageCombo(b, 170, 1); ps.triggerDamageCombo(a, 170, 1);
    assert.equal(ps.damageCombos.length, 2);
    assert.equal(ps.damageCombos.find(c => c.target === a).total, 2);
    assert.equal(ps.damageCombos.find(c => c.target === b).total, 1);
}

// --- acompanha o inimigo; morte no meio do combo congela ---
{
    const ps = new ParticleSystem(null);
    const e = enemy(100, 200);
    const combo = ps.triggerDamageCombo(e, 170, 1);
    ps.triggerDamageCombo(e, 170, 1);
    assert.equal(combo.y, 170 - C.offsetY, 'fica acima do ponto dos números individuais');
    e.x = 140; e.y = 220; step(ps, 1);
    assert.equal(combo.x, 140); assert.equal(combo.y, 190 - C.offsetY, 'acompanha o inimigo');

    ps.triggerDamageCombo(e, 190, 3, { killed: true });
    assert.equal(combo.total, 5, 'golpe que mata entra no total');
    assert.equal(combo.open, false, 'morte fecha o combo');
    e.x = 500; step(ps, 1);
    assert.equal(combo.x, 140, 'parado onde o inimigo morreu');
    step(ps, C.holdSteps - 2);
    assert.ok(ps.damageCombos.includes(combo), 'segura antes de sumir');
    step(ps, C.fadeSteps + 2);
    assert.equal(ps.damageCombos.length, 0);
}

// --- golpe único que mata não deixa total ---
{
    const ps = new ParticleSystem(null);
    ps.triggerDamageCombo(enemy(), 170, 1, { killed: true });
    step(ps, 1);
    assert.equal(ps.damageCombos.length, 0);
}

// --- escala de cores ---
{
    const expected = [[2, '#ffffff'], [3, '#fff1a8'], [4, '#fff1a8'], [5, '#ffd24a'], [6, '#ffd24a'], [7, '#e8a317'],
        [9, '#e8a317'], [10, '#ff6b4a'], [13, '#ff6b4a'], [14, '#e8262a'], [19, '#e8262a'], [20, '#a8121c'], [99, '#a8121c']];
    for (const [total, color] of expected) assert.equal(comboColor(total), color, `total ${total}`);
}

// --- desenho, limite e limpeza ---
{
    const ps = new ParticleSystem(null);
    const calls = [];
    const ctx = new Proxy({}, { get: (_, k) => (k === 'fillRect' ? (...a) => calls.push(a) : () => {}), set: () => true });
    const e = enemy();
    ps.triggerDamageCombo(e, 170, 1);
    ps.drawDamageNumbers(ctx);
    assert.equal(calls.length, 0, 'total invisível com um golpe');
    ps.triggerDamageCombo(e, 170, 1);
    ps.drawDamageNumbers(ctx);
    assert.ok(calls.length > 0, 'total desenhado com a fonte pixel');
    assert.equal(ps.hasDamageNumbers, true);

    for (let i = 0; i < C.max + 5; i++) ps.triggerDamageCombo(enemy(i), 170, 1);
    assert.equal(ps.damageCombos.length, C.max, 'totais têm limite');
    ps.clearDamageNumbers();
    assert.equal(ps.damageCombos.length, 0);
    assert.equal(ps.hasDamageNumbers, false);
    ps.triggerDamageCombo(e, 170, 1);
    ps.clear();
    assert.equal(ps.damageCombos.length, 0, 'clear() também limpa os totais');
}

// --- CombatSystem manda cada golpe aceito para o combo do inimigo ---
{
    const combos = [];
    const particleSystem = {
        triggerHitSparks() {}, triggerFlash() {}, triggerHitBlood() {}, triggerDust() {}, triggerBlood() {},
        triggerDamageNumber() {}, triggerDamageCombo: (...a) => combos.push(a)
    };
    const combat = new CombatSystem({ renderer: { triggerShake() {} }, particleSystem, hitFeedback: true });
    const e = { x: 10, y: 50, drawHeight: 40 };
    combat._hitFeedback(e, { tier: 'hit', damage: 1, killed: false, poiseBroken: false, x: 10, y: 50, dirX: 1, dirY: 0 });
    combat._hitFeedback(e, { tier: 'kill', damage: 2, killed: true, poiseBroken: false, x: 10, y: 50, dirX: 1, dirY: 0 });
    assert.deepEqual(combos, [[e, 24, 1, { killed: false }], [e, 24, 2, { killed: true }]]);
}

console.log('Dano acumulado: janela, soma, por inimigo, acompanha/congela na morte, cores, limite e CombatSystem passaram.');
