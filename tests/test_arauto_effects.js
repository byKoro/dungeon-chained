import assert from 'node:assert/strict';
import { SpawnSystem } from '../js/systems/SpawnSystem.js';
import { ParticleSystem } from '../js/particles/ParticleSystem.js';
import { ArautoEffects } from '../js/systems/ArautoEffects.js';
import { ArautoPhaseScene } from '../js/systems/ArautoPhaseScene.js';
import { CombatSystem } from '../js/combat/CombatSystem.js';
import { Game } from '../js/Game.js';
import { SawWeapon } from '../js/weapons/SawWeapon.js';
import { FLAME_GOLEM } from '../js/config/FlameGolemConfig.js';
import { ARAUTO_FX } from '../js/config/ArautoEffectsConfig.js';

const spawn = new SpawnSystem({ assets: { get: () => null }, bloodCanvas: { palette: [] } });
const create = () => spawn.createEnemy(0, 0, 1, 'flameGolem');
const bounds = { minX: -1000, maxX: 1000, minY: -1000, maxY: 1000 };
let stamps = 0;
const particles = new ParticleSystem({ stampSplat() { stamps++; }, stampPool() { stamps++; } });
const shakes = [];
const renderer = { camX: 20, camY: 40, zoom: 1, triggerShake(value) { shakes.push(value); } };
const effects = new ArautoEffects({ renderer, particleSystem: particles });
const enemy = create();
effects.hit(enemy, { x: 0, y: 0, dirX: 1, dirY: 0 });
assert.equal(particles.lavaFragments.length, ARAUTO_FX.contactPieces);
for (let i = 0; i < 100; i++) particles.update([], bounds);
assert.ok(particles.lavaFragments.every(p => p.settled), 'fragments settle on floor');
assert.equal(stamps, 0, 'lava and stones never stamp blood');
for (let i = 0; i < ARAUTO_FX.fragmentLife; i++) particles.update([], bounds);
assert.equal(particles.lavaFragments.length, 0, 'floor fragments expire');
particles.triggerLavaDebris(0, 0, ARAUTO_FX.maxFragments * 2);
assert.equal(particles.lavaFragments.length, ARAUTO_FX.maxFragments, 'fragment pool is bounded');

const ps = new ParticleSystem();
const fx = new ArautoEffects({ renderer, particleSystem: ps });
const combat = new CombatSystem({ renderer, particleSystem: ps, arautoEffects: fx, hitFeedback: true });
const weapon = new SawWeapon();
combat.resolveWeaponHits(weapon, [enemy], { x: -100, y: 0 }, { x: 100, y: 0 });
assert.ok(ps.lavaFragments.length > 0, 'saw hits emit lava debris');
assert.equal(ps.airParticles.length, 0, 'boss saw hit emits no blood');
assert.equal(weapon.bloodTimer, 0, 'rock does not coat saw in blood');
fx.groundHit(enemy);
fx.groundHit(enemy, true);
assert.ok(shakes.includes(ARAUTO_FX.groundShake) && shakes.includes(ARAUTO_FX.slamShake));
assert.equal(enemy.outline, null, 'boss has no generated silhouette outline');
assert.equal(FLAME_GOLEM.telegraph.showMarks, false, 'attack debug outlines disabled');
fx.reset();
fx.attack();
assert.equal(fx.blur, ARAUTO_FX.attackBlur);
enemy.charging = true;
fx.update([enemy]);
assert.ok(shakes.includes(ARAUTO_FX.dashShake));
enemy.charging = false;
let filtered = false;
fx.blurCanvas = { width: 320, height: 180, getContext: () => ({ clearRect() {}, drawImage() {} }) };
const cameraCtx = { save() {}, restore() {}, setTransform() {}, drawImage() { filtered = this.filter.startsWith('blur('); } };
for (let i = 0; i < 60; i++) fx.drawCamera(cameraCtx, { width: 320, height: 180 });
assert.ok(filtered, 'camera pass draws through blur filter');
assert.equal(fx.blur, 0, 'camera blur expires without more attacks');
fx.groundHit(enemy, true);
assert.equal(fx.blur, ARAUTO_FX.slamBlur);
fx.reset();
assert.equal(fx.blur, 0, 'restart clears camera blur');

const expressions = [];
const sceneEnemy = create(); sceneEnemy.hp = FLAME_GOLEM.secondPhaseHp;
sceneEnemy.state = 'attack';
const scene = new ArautoPhaseScene({ renderer, particleSystem: ps,
    hud: { onBossTransformation(e) { expressions.push(e); } }, getPlayers: () => [] });
assert.equal(scene.tryStart([sceneEnemy]), false, 'scene waits for active attack');
sceneEnemy.state = 'recover';
const harness = { gameOver: false, rooms: { current: { enemies: [sceneEnemy] } },
    arautoScene: scene, arautoEffects: fx, particleSystem: ps, arenaBounds: bounds,
    gameplay: 0, _updateGameplay() { this.gameplay++; } };
Game.prototype._step.call(harness, 1 / 60);
assert.equal(scene.active, true);
assert.equal(harness.gameplay, 0, 'Game dispatch freezes all gameplay during scene');
assert.equal(sceneEnemy.phase, 1, 'phase waits for explosion');
for (let i = 0; i < 200 && scene.active; i++) Game.prototype._step.call(harness, 1 / 60);
assert.equal(scene.active, false);
assert.equal(sceneEnemy.phase, 2);
assert.deepEqual(expressions, ['assustado', 'raiva', null]);
assert.deepEqual([renderer.camX, renderer.camY, renderer.zoom], [20, 40, 1], 'camera restores before controls');
assert.equal(scene.tryStart([sceneEnemy]), false, 'one scene per boss');
assert.equal(harness.gameplay, 0);
const restartEnemy = create(); restartEnemy.hp = FLAME_GOLEM.secondPhaseHp;
assert.equal(scene.tryStart([restartEnemy]), true);
scene.update(0.5);
assert.notEqual(renderer.zoom, 1);
scene.reset();
assert.equal(renderer.zoom, 1, 'reset during scene restores camera');
assert.equal(expressions.at(-1), null, 'reset clears cinematic expression override');

const poseEnemy = create();
const target = { x: 20, y: 0, lives: 3, hitRadius: 16, takeDamage() { return false; } };
poseEnemy.forceAttack('attack2');
poseEnemy.update([target], () => {});
let held = 0;
while (poseEnemy.state === 'windup') {
    const frame = poseEnemy._currentFrameIndex(poseEnemy._currentAnim());
    assert.ok(frame <= FLAME_GOLEM.attacks.attack2.raisedFrame, 'no downswing during warning');
    if (frame === FLAME_GOLEM.attacks.attack2.raisedFrame) held++;
    poseEnemy.update([target], () => {});
}
assert.ok(held >= FLAME_GOLEM.attacks.attack2.windupTicks, 'full windup held at raised pose');
let impacts = 0;
while (poseEnemy.state === 'attack') {
    poseEnemy.update([target], () => {});
    if (poseEnemy.justGroundHit) impacts++;
}
assert.equal(impacts, 1, 'ground impact event fires once even when damage is rejected');
console.log('Arauto VFX, particles, phase scene and raised windup tests passed');
