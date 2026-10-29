import assert from 'node:assert/strict';
import { SpawnSystem } from '../js/systems/SpawnSystem.js';
import { FlameGolemEnemy } from '../js/entities/FlameGolemEnemy.js';
import { Player } from '../js/entities/Player.js';
import { FLAME_GOLEM } from '../js/config/FlameGolemConfig.js';

const spawn = new SpawnSystem({ assets: { get: () => ({ complete: true, naturalWidth: 1200 }) }, bloodCanvas: { palette: [] } });
const create = () => {
    const e = spawn.createEnemy(0, 0, 1, 'flameGolem');
    e.abilities = structuredClone(FLAME_GOLEM.attacks);
    return e;
};
const player = (x, y = 0) => new Player(x, y, '#fff', [], null, 'test');
const begin = (e, key, players) => {
    e.attackIndex = e.attackKeys.indexOf(key);
    e.update(players, () => assert.fail('windup cannot deal damage'));
    assert.equal(e.state, 'windup');
    assert.equal(e.currentAttack, key);
};
const launch = (e, players) => {
    for (let t = 0; t < 200 && e.state === 'windup'; t++) e.update(players, () => assert.fail('windup cannot hit'));
    assert.equal(e.state, 'attack');
};
const tickToImpact = (e, players, onHit = () => {}) => {
    for (let t = 0; t < 200 && !e.dealtHit; t++) e.update(players, onHit);
    assert.ok(e.dealtHit);
};

assert.ok(create() instanceof FlameGolemEnemy);
// Posições derivadas do config: mudar alcance, raio e empurrão não obriga a editar o teste.
const ATTACK = FLAME_GOLEM.attacks.attack, AREA = FLAME_GOLEM.attacks.attack2;
const NEAR = Math.floor(ATTACK.range * 0.5);
const INSIDE = Math.floor(AREA.radius * 0.6);
{
    const e = create(), ps = [player(NEAR), player(-NEAR)];
    begin(e, 'attack', ps); launch(e, ps); tickToImpact(e, ps);
    assert.equal(ps.reduce((n, p) => n + (3 - p.lives), 0), 1, 'normal hits one player');
    assert.equal(Math.max(...ps.map(p => Math.hypot(p.vx, p.vy))), ATTACK.knockback);
}
{
    const e = create(), ps = [player(INSIDE), player(-INSIDE)];
    begin(e, 'attack2', ps); launch(e, ps);
    // o ataque começa na pose de espera, então só faltam alguns ticks para o impacto
    const impactTick = e.abilities.attack2.hitFrame * e.sprite.rows.attack2.fps;
    const remaining = impactTick - e.animTime;
    assert.ok(remaining > 0);
    for (let t = 1; t < remaining; t++) e.update(ps, () => assert.fail('no early area damage'));
    assert.equal(ps[0].lives, 3);
    let hits = 0; e.update(ps, () => hits++);
    assert.equal(hits, 2, 'area hits both players on impact');
    assert.equal(ps[0].vx, AREA.knockback); assert.equal(ps[1].vx, -AREA.knockback);
    for (let t = 0; t < 15; t++) e.update(ps, () => assert.fail('area cannot repeat damage'));
    assert.equal(ps[0].lives, 2);
}
{
    const e = create(), ps = [player(INSIDE), player(AREA.radius * 3)];
    begin(e, 'attack2', ps); launch(e, ps);
    ps[0].x = AREA.radius + 60;
    tickToImpact(e, ps, () => assert.fail('leaving telegraphed radius avoids area'));
}
{
    const e = create(), ps = [player(INSIDE), player(-INSIDE)];
    ps[0].dashing = true; ps[1].invulnerableTimer = 10;
    begin(e, 'attack2', ps); launch(e, ps); tickToImpact(e, ps);
    assert.equal(ps[0].lives, 3); assert.equal(ps[1].lives, 3);
    assert.equal(ps[0].vx, 0); assert.equal(ps[1].vx, 0);
}
{
    const e = create(), ps = [player(100), player(400)];
    begin(e, 'attack3', ps);
    assert.deepEqual(e.marks.map(m => [m.x, m.y]), [[100, 0], [400, 0]]);
    ps[0].x = 200; ps[0].y = 150;
    assert.deepEqual([e.marks[0].x, e.marks[0].y], [100, 0], 'marks are snapshots');
    e.freezeOnHit(0.1);
    assert.equal(e.hitFreezeTimer, 0, 'chefe não congela no acerto');
    const timer = e.stateTimer;
    e.update(ps, () => assert.fail('windup cannot hit'));
    assert.equal(e.stateTimer, timer - 1, 'windup segue andando depois de freezeOnHit');
    assert.ok(e.takeHit(1, { dirX: 1, dirY: 0 }));
    assert.equal(e.state, 'windup', 'acerto não interrompe a habilidade');
    assert.equal(e.marks.length, 2, 'marcas da investida continuam');
}
{
    const e = create(), ps = [player(100), player(400)];
    e.abilities.attack3.trackingStrength = 0;
    e.abilities.attack3.speed = 200;
    begin(e, 'attack3', ps); launch(e, ps);
    const start = e.x;
    e.animTime = e.abilities.attack3.launchFrame * e.sprite.rows.attack3.fps - 1;
    e.update(ps, () => {});
    assert.equal(e.x - start, 200, 'dash speed controls displacement');
    assert.equal(ps[0].lives, 2, 'swept hit detects player between endpoints');
    assert.equal(ps[0].vx, e.abilities.attack3.knockback);
    e.update(ps, () => {});
    assert.equal(ps[0].lives, 2, 'one hit per player per dash');
}
{
    for (const strength of [0, 1]) {
        const e = create(), ps = [player(300), player(400)];
        e.abilities.attack3.trackingStrength = strength;
        begin(e, 'attack3', ps); launch(e, ps);
        ps[0].y = 200;
        e.animTime = e.abilities.attack3.launchFrame * e.sprite.rows.attack3.fps - 1;
        e.update(ps, () => {});
        if (strength === 0) assert.equal(e.vy, 0, 'zero tracking keeps marked heading');
        else assert.ok(e.vy > 0, 'full tracking follows live target');
    }
}
{
    const e = create(); e.x = e.y = 96;
    const floor = Array.from({ length: 8 }, () => Array(10).fill(17));
    for (let row = 0; row < floor.length; row++) floor[row][4] = -1;
    e.setNavigationFloor(floor, { minX: 0, minY: 0 });
    const ps = [player(160, 96), player(160, 96)];
    e.abilities.attack3.speed = 300;
    e.abilities.attack3.trackingStrength = 0;
    begin(e, 'attack3', ps); launch(e, ps);
    e.animTime = e.abilities.attack3.launchFrame * e.sprite.rows.attack3.fps - 1;
    e.update(ps, () => {});
    assert.ok(e.x + e.hitRadius < 192, 'fast dash stops before hole, including body radius');
    assert.ok(e.x > 96);
}
{
    const southHole = () => {
        const floor = Array.from({ length: 8 }, () => Array(10).fill(17));
        for (let col = 0; col < 10; col++) floor[6][col] = -1;
        return floor;
    };
    const holeTop = 5 * 64;
    const e = create(); e.x = 320; e.y = 100;
    e.setNavigationFloor(southHole(), { minX: 0, minY: 0 });
    const ps = [player(320, holeTop - 20), player(320, holeTop - 20)];
    for (let t = 0; t < 600; t++) {
        e.update(ps, () => {});
        e.ensureOnWalkableTile();
        assert.ok(e.footY <= holeTop + 1, `feet stay on the floor (tick ${t}, footY ${e.footY})`);
    }
    assert.ok(e.y > 100, 'golem still advances toward the player near the hole');

    const pushed = create(); pushed.x = 320; pushed.y = 200;
    pushed.setNavigationFloor(southHole(), { minX: 0, minY: 0 });
    pushed.pushVy = 40;
    for (let t = 0; t < 40; t++) { pushed._applyPush(); pushed.ensureOnWalkableTile(); }
    assert.ok(pushed.footY <= holeTop + 1, 'knockback cannot carry the feet over the hole');
    assert.equal(pushed.y, 200, 'the boss takes no knockback');
    assert.equal(pushed.pushVy, 0);

    const stuck = create(); stuck.x = 320; stuck.y = 300;
    stuck.setNavigationFloor(southHole(), { minX: 0, minY: 0 });
    assert.ok(!stuck._standsOnFloor(stuck.x, stuck.y));
    stuck.ensureOnWalkableTile();
    assert.ok(stuck._standsOnFloor(stuck.x, stuck.y), 'a golem spawned over the hole is moved to solid floor');
}
{
    for (const phase of [1, 2]) {
        const e = create(), ps = [player(120), player(200, 50)];
        if (phase === 2) e.hp = FLAME_GOLEM.secondPhaseHp;
        begin(e, 'attack3', ps);
        assert.equal(e.phase, phase);
        const speed = FLAME_GOLEM.phases[phase - 1];
        assert.equal(e.speed, FLAME_GOLEM.speed * speed.movementSpeedMultiplier);
        assert.equal(e.sprite.rows.attack.fps, FLAME_GOLEM.attacks.attack.ticksPerFrame / speed.animationSpeedMultiplier);
        assert.equal(e.windupFrames, e.abilities.attack3.windupTicks / speed.animationSpeedMultiplier);
        let launches = 0;
        for (let t = 0; t < 400 && e.state !== 'recover'; t++) {
            e.update(ps, () => {});
            if (e.justAttacked) launches++;
        }
        assert.equal(launches, speed.dashCount, 'one dash in phase one, two in phase two');
        assert.equal(e.state, 'recover');
    }
    assert.equal(create().sprite.rows.walk.fps, FLAME_GOLEM.walkTicksPerFrame, 'phase two cannot mutate other instances');
}
{
    const e = create(), ps = [player(100), player(200)];
    begin(e, 'attack3', ps);
    const oldFrame = e.animTime / e.sprite.rows.attack3.fps;
    e.hp = FLAME_GOLEM.secondPhaseHp;
    e._updatePhase();
    assert.equal(e.animTime / e.sprite.rows.attack3.fps, oldFrame, 'phase transition preserves pose');
    e.startDying();
    assert.equal(e.marks.length, 0);
    for (let t = 0; t < 100; t++) e.update(ps, () => assert.fail('dead boss cannot attack'));
    assert.ok(e.readyToGib);
}
{
    const p = player(0); p.takeDamage(-1, 0);
    assert.equal(p.vx, 16, 'ordinary damage retains default knockback');
    const pushed = player(140); pushed.takeDamage(0, 0, { knockback: 48 });
    for (let t = 0; t < 8; t++) pushed.update({ isDown: () => false });
    assert.ok(pushed.x > 256, 'strong knockback can carry player past an arena edge');
}
{
    const phase = FLAME_GOLEM.phases[0];
    const original = { ...phase };
    try {
        phase.movementSpeedMultiplier = 1.5;
        phase.animationSpeedMultiplier = 2;
        const e = create();
        assert.equal(e.speed, FLAME_GOLEM.speed * 1.5);
        assert.equal(e.sprite.rows.walk.fps, FLAME_GOLEM.walkTicksPerFrame / 2);
        assert.equal(e.dyingDuration, 6 * FLAME_GOLEM.deathTicksPerFrame, 'a morte não acelera com a fase');
        e.animTime = 3;
        const frame = e.animTime / e.sprite.rows.walk.fps;
        e.hp = FLAME_GOLEM.secondPhaseHp;
        e._updatePhase();
        assert.ok(Math.abs(e.animTime / e.sprite.rows.walk.fps - frame) < 1e-9);
    } finally { Object.assign(phase, original); }
}
console.log('Flame Golem abilities: normal, AoE, knockback, telegraphs, dash sweep/tracking, holes, phases and cancellation passed.');
