import assert from 'node:assert/strict';
import { SpawnSystem } from '../js/systems/SpawnSystem.js';
import { FLAME_GOLEM } from '../js/config/FlameGolemConfig.js';

const spawn = new SpawnSystem({ assets: { get: () => ({ complete: true, naturalWidth: 1200 }) }, bloodCanvas: { palette: [] } });
const originalRandom = Math.random;
const dummy = x => ({ x, y: 0, lives: 3, hitRadius: 16, takeDamage: () => true });
try {
    for (const phase of [1, 2]) {
        for (const roll of [0.3, 0.7, 0]) {
            const e = spawn.createEnemy(0, 0, 1, 'flameGolem');
            if (phase === 2) { e.hp = FLAME_GOLEM.secondPhaseHp; e._updatePhase(); }
            let calls = 0;
            Math.random = () => calls++ % 2 === 0 ? 0 : roll;
            const near = [dummy(60)];
            e.update(near, () => {});
            const first = e.currentAttack;
            for (let i = 0; i < 1000 && e.state !== 'recover'; i++) e.update(near, () => {});
            assert.equal(e.state, 'recover');
            const far = [dummy(2000)];
            for (let i = 0; i < 1000 && e.state !== 'chase'; i++) e.update(far, () => {});
            e.update(far, () => {});
            e.update([dummy(e.x + 60)], () => {});
            assert.equal(e.state, 'windup');
            if (roll === 0) {
                assert.equal(e.currentAttack, first, 'repetition remains possible, no fixed alternation');
                for (let i = 0; i < 1000 && e.state !== 'recover'; i++) e.update(near, () => {});
                for (let i = 0; i < 1000 && e.state !== 'chase'; i++) e.update(far, () => {});
                calls = 0;
                Math.random = () => calls++ % 2 === 0 ? 0 : 0.2;
                e.update([dummy(e.x + 60)], () => {});
                assert.equal(e.currentAttack, 'attack2', 'two repeats reduce the old attack weight further');
            } else assert.notEqual(e.currentAttack, first, `phase ${phase}: recent attack loses weight even after retreat`);
        }
    }
} finally { Math.random = originalRandom; }
console.log('Arauto attack memory survives retreat and reduces repeats without forced alternation.');
