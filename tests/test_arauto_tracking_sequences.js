import assert from 'node:assert/strict';
import { SpawnSystem } from '../js/systems/SpawnSystem.js';
import { FLAME_GOLEM } from '../js/config/FlameGolemConfig.js';

const spawn = new SpawnSystem({ assets: { get: () => ({ complete: true, naturalWidth: 1200 }) }, bloodCanvas: { palette: [] } });
const create = () => {
    const e = spawn.createEnemy(0, 0, 1, 'flameGolem');
    e.hp = FLAME_GOLEM.secondPhaseHp;
    e._updatePhase();
    return e;
};
const player = (x, y = 0) => ({ x, y, lives: 3, hitRadius: 16, takeDamage: () => true });
for (const key of ['attack2', 'attack3']) {
    const e = create(), ps = [player(200), player(-200)];
    e.forceAttack(key);
    e.update(ps, () => {});
    const mark = { ...(key === 'attack2' ? e.slam.mark : e.marks[0]) };
    ps[0].y = 100;
    e.update(ps, () => {});
    const actual = key === 'attack2' ? e.slam.mark : e.marks[0];
    assert.equal(actual.x, mark.x);
    assert.equal(actual.y, mark.y, `${key}: warning must keep its original mark`);
}
for (const [key, expected] of [['attack2', 3], ['attack3', 2]]) {
    const e = create(), ps = [player(200), player(-200)];
    e.forceAttack(key);
    let count = 0;
    e.update(ps, () => {});
    for (let i = 0; i < 1000; i++) {
        e.update(ps, () => {});
        if (key === 'attack2' ? e.justSlammed : e.justAttacked) count++;
        if (e.state === 'recover') break;
    }
    assert.equal(count, expected, `${key}: default phase 2 sequence`);
}
console.log('Arauto fixed warning marks and default phase 2 sequences passed.');
