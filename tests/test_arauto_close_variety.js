import assert from 'node:assert/strict';
import { SpawnSystem } from '../js/systems/SpawnSystem.js';
import { FLAME_GOLEM } from '../js/config/FlameGolemConfig.js';

const spawn = new SpawnSystem({ assets: { get: () => ({ complete: true, naturalWidth: 1200 }) }, bloodCanvas: { palette: [] } });
const originalRandom = Math.random;
const dummy = x => ({ x, y: 0, lives: 3, hitRadius: 16, takeDamage: () => true });
try {
    for (const phase of [1, 2]) {
        const create = () => {
            const e = spawn.createEnemy(0, 0, 1, 'flameGolem');
            if (phase === 2) { e.hp = FLAME_GOLEM.secondPhaseHp; e._updatePhase(); }
            return e;
        };
        const walking = create(), ps = [dummy(100)];
        Math.random = () => 0.7;
        walking.update(ps, () => {});
        assert.equal(walking.state, 'chase', 'near player can trigger walking');
        const start = walking.x;
        Math.random = () => assert.fail('must not roll again during nearby walking interval');
        for (let i = 0; i < FLAME_GOLEM.ai.closeChaseMinTicks; i++) {
            walking.update(ps, () => {});
            assert.equal(walking.state, 'chase');
        }
        assert.ok(walking.x > start, 'walks rather than idling');
        Math.random = () => 0;
        for (let i = 0; i < FLAME_GOLEM.ai.closeChaseMaxTicks + 2 && walking.state === 'chase'; i++) walking.update(ps, () => {});
        assert.equal(walking.state, 'windup', 'eventually re-evaluates nearby attacks');

        const dash = create(), targets = [dummy(60), dummy(300)];
        Math.random = () => 0.999;
        dash.update(targets, () => {});
        assert.equal(dash.currentAttack, 'attack3', 'dash is also available nearby');
        assert.equal(dash.plan.target, targets[0], 'dash targets the nearby player');

        const blocked = create();
        blocked._planDash = () => null;
        blocked.update([dummy(60)], () => {});
        assert.equal(blocked.state, 'windup');
        assert.ok(['attack', 'attack2'].includes(blocked.currentAttack), 'unsafe dash falls back to a close attack');
    }
} finally { Math.random = originalRandom; }
console.log('Arauto nearby walking, dash, timed re-evaluation and invalid dash fallback passed.');
