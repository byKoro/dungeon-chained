import assert from 'node:assert/strict';
import { SpawnSystem } from '../js/systems/SpawnSystem.js';
import { FLAME_GOLEM } from '../js/config/FlameGolemConfig.js';

const spawn = new SpawnSystem({ assets: { get: () => ({ complete: true, naturalWidth: 1200 }) }, bloodCanvas: { palette: [] } });
const originalRandom = Math.random;
try {
    for (const phase of [1, 2]) {
        for (const [roll, expected] of [[0, 'attack'], [0.999, 'attack2']]) {
            const e = spawn.createEnemy(0, 0, 1, 'flameGolem');
            if (phase === 2) { e.hp = FLAME_GOLEM.secondPhaseHp; e._updatePhase(); }
            let calls = 0;
            Math.random = () => calls++ === 0 ? 0 : roll;
            e.update([{ x: 60, y: 0, lives: 3 }, { x: 300, y: 0, lives: 3 }], () => {});
            assert.equal(e.currentAttack, expected, `phase ${phase}, roll ${roll}: immediate choice without pressure`);
            assert.equal(e.slamMode, phase === 2 && expected === 'attack2');
        }
    }
    for (const [roll, expected] of [[0, 'attack3'], [0.999, 'attack2']]) {
        const e = spawn.createEnemy(0, 0, 1, 'flameGolem');
        e.hp = FLAME_GOLEM.secondPhaseHp;
        e._updatePhase();
        let calls = 0;
        Math.random = () => calls++ === 0 ? 0 : roll;
        e.update([{ x: 250, y: 0, lives: 3 }], () => {});
        assert.equal(e.currentAttack, expected, 'phase 2: valid dash must not suppress jump');
    }
} finally {
    Math.random = originalRandom;
}
console.log('Arauto random attack selection passed.');
