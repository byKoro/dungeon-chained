import assert from 'node:assert/strict';
import { SpawnSystem } from '../js/systems/SpawnSystem.js';
import { FLAME_GOLEM } from '../js/config/FlameGolemConfig.js';

const spawn = new SpawnSystem({ assets: { get: () => ({ complete: true, naturalWidth: 1200 }) }, bloodCanvas: { palette: [] } });
const originalRandom = Math.random;
try {
    for (const phase of [1, 2]) {
        const e = spawn.createEnemy(0, 0, 1, 'flameGolem');
        if (phase === 2) { e.hp = FLAME_GOLEM.secondPhaseHp; e._updatePhase(); }
        const ps = [{ x: 400, y: 0, lives: 3, hitRadius: 16 }];
        let rolls = 0;
        Math.random = () => { rolls++; return 0.999; };
        e.update(ps, () => {});
        assert.equal(e.state, 'chase', `phase ${phase}: can choose walking over a valid dash`);
        const start = e.x, afterChoice = rolls;
        Math.random = () => { rolls++; return 0; };
        for (let i = 0; i < FLAME_GOLEM.ai.chaseMinTicks - 1; i++) {
            e.update(ps, () => {});
            assert.equal(e.state, 'chase', 'walking choice persists instead of rolling every tick');
        }
        assert.ok(e.x > start, 'actively walks toward the target');
        assert.equal(rolls, afterChoice, 'no repeated rolls during committed chase');
        for (let i = 0; i < FLAME_GOLEM.ai.chaseMaxTicks + 2 && e.state === 'chase'; i++) e.update(ps, () => {});
        assert.equal(e.currentAttack, 'attack3', 'can dash after the walking interval');
        assert.equal(e.state, 'windup');
    }
    const e = spawn.createEnemy(0, 0, 1, 'flameGolem');
    Math.random = () => 0.999;
    e.update([{ x: 400, y: 0, lives: 3 }], () => {});
    assert.equal(e.state, 'chase');
    Math.random = () => 0;
    e.update([{ x: e.x + 50, y: 0, lives: 3 }], () => {});
    assert.equal(e.currentAttack, 'attack', 'near target interrupts the walking interval with melee');
    assert.equal(e.state, 'windup');
} finally {
    Math.random = originalRandom;
}
console.log('Arauto committed chase, ranged re-evaluation and nearby reaction passed.');
