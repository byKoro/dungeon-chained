import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ArautoAudio, stoneGrindTargets } from '../js/systems/ArautoAudio.js';
import { ARAUTO_AUDIO } from '../js/config/ArautoAudioConfig.js';
import { AUDIO_CONFIG } from '../js/config/AudioConfig.js';
import { CombatSystem } from '../js/combat/CombatSystem.js';
import { SpawnSystem } from '../js/systems/SpawnSystem.js';
import { SawWeapon } from '../js/weapons/SawWeapon.js';

const full = stoneGrindTargets(1, { contact: true });
const cutting = stoneGrindTargets(0.7, { contact: true });
assert.ok(cutting.level * AUDIO_CONFIG.cues.arautoSawStone.volume >= 0.6,
    'stone contact must remain prominent at sustained 70% cutting spin');
assert.ok(cutting.cutoff >= 10000, 'cutting texture retains audible upper grit');
assert.ok(full.level > stoneGrindTargets(0.5, { contact: true }).level);
assert.equal(stoneGrindTargets(1).level, 0, 'no contact is silent');
assert.equal(stoneGrindTargets(0, { contact: true }).level, 0);
assert.equal(stoneGrindTargets(1, { contact: true, active: false }).level, 0);
assert.equal(stoneGrindTargets(1, { contact: true, connected: false }).level, 0);
assert.ok(stoneGrindTargets(1, { contact: true, timeScale: 0.25 }).rate < full.rate);

const calls = [], voices = [];
const audio = {
    play(name) { calls.push(name); }, duck(db) { calls.push(db); },
    createLoopVoice(name) {
        const voice = { name, sets: [], set(target, tau) { this.sets.push({ target, tau }); }, stop() { this.stopped = true; } };
        voices.push(voice); return voice;
    }
};
const controller = new ArautoAudio({ audio });
const enemy = { x: 0, y: 0, vx: 0, vy: 0, state: 'windup', effectMaterial: 'lavaStone',
    collisionBodies: [{ x: 0, y: 0, radiusX: 48, radiusY: 30 }] };
const weapon = { spinSpeed: 1, discRadius: 32, getSawPositions: () => [{ x: 0, y: -60 }] };
const state = { players: [{}, {}] };
controller.update(weapon, [enemy], state);
assert.equal(voices.length, 1, 'one persistent grind voice');
assert.equal(voices[0].name, 'arautoSawStone');
assert.equal(voices[0].sets.at(-1).target.level, 1);
for (let i = 0; i < 120; i++) controller.update(weapon, [enemy], state);
assert.equal(voices.length, 1, 'held contact never stacks voices');
assert.equal(calls.length, 0, 'contact is continuous rather than one-shot spam');
weapon.getSawPositions = () => [{ x: 400, y: 0 }];
controller.update(weapon, [enemy], state);
assert.equal(voices[0].sets.at(-1).target.level, 0, 'leaving surface releases grind');
assert.equal(voices[0].sets.at(-1).tau, ARAUTO_AUDIO.releaseTau);
enemy.state = 'attack'; enemy.charging = true; enemy.vx = 12;
controller.update(weapon, [enemy], state);
for (let i = 0; i < 5; i++) controller.update(weapon, [enemy], state);
assert.deepEqual(calls, ['arautoDashStart'], 'dash cue once per actual launch');
assert.equal(voices[1].name, 'arautoDashLoop');
assert.ok(voices[1].sets.at(-1).target.level > 0);
controller.update(weapon, [enemy], { ...state, active: false });
assert.ok(voices.every(voice => voice.sets.at(-1).target.level === 0), 'pause/cutscene silences continuous voices');
controller.update(weapon, [enemy], state);
assert.equal(calls.length, 1, 'resume does not replay dash launch');
enemy.vx = 0;
controller.update(weapon, [enemy], state);
assert.equal(voices[1].sets.at(-1).target.level, 0, 'dash blocked by wall is silent');
enemy.charging = false;
controller.update(weapon, [enemy], state);
controller.groundHit(); controller.groundHit(true);
assert.deepEqual(calls.slice(-4), ['arautoGround', ARAUTO_AUDIO.groundDuck.db, 'arautoSlam', ARAUTO_AUDIO.slamDuck.db]);
controller.reset();
assert.ok(voices.every(voice => voice.stopped), 'restart releases loop resources');
assert.doesNotThrow(() => new ArautoAudio({ audio: null }).update(weapon, [enemy], state));

const spawn = new SpawnSystem({ assets: { get: () => null }, bloodCanvas: { palette: [] } });
const boss = spawn.createEnemy(0, 0, 1, 'flameGolem');
boss.update = function () { this.justGroundHit = true; this.justSlammed = false; this.justAttacked = true; };
const combat = new CombatSystem({ renderer: { triggerShake() {} }, particleSystem: {
    triggerBlood() {}, triggerLavaDebris() {}
}, audio, arautoAudio: controller });
calls.length = 0;
combat.updateEnemies([boss], []);
assert.ok(calls.includes('arautoGround'), 'missed attack still plays synchronized ground sound');
assert.ok(!calls.includes('enemyAttack'), 'no generic impact during boss windup/attack start');
boss.update = function () { this.justSlammed = true; this.justGroundHit = false; this.justAttacked = false; };
calls.length = 0;
combat.updateEnemies([boss], []);
assert.ok(calls.includes('arautoSlam'));
assert.ok(!calls.includes('playerFall'), 'slam no longer uses player fall cue');
const saw = new SawWeapon();
calls.length = 0;
combat.resolveWeaponHits(saw, [boss], { x: -100, y: 0 }, { x: 100, y: 0 });
assert.ok(calls.includes('sawHit'), 'Arauto toca o mesmo som de dano da serra dos outros monstros');
{
    const before = calls.length;
    combat.feedbackForHit(boss, { damage: 1, killed: false }, { x: 0, y: 0, dirX: 1, dirY: 0 });
    assert.ok(calls.slice(before).includes('sawHit'), 'acerto da serra presa (tackle) no Arauto também toca sawHit');
}
boss.update = function (players, onHit) {
    this.justSlammed = this.justGroundHit = this.justAttacked = false;
    onHit({ x: 0, y: 0 });
};
calls.length = 0;
combat.updateEnemies([boss], []);
assert.ok(!calls.includes('playerHurt'), 'boss uses Game playerHit instead of doubling hurt samples');
const ordinary = spawn.createEnemy(0, 0, 1, 'demon');
calls.length = 0;
combat.resolveWeaponHits(saw, [ordinary], { x: -100, y: 0 }, { x: 100, y: 0 });
assert.ok(calls.includes('sawHit'), 'ordinary enemies preserve their original hit sound');

for (const cue of ['arautoSawStone', 'arautoDashLoop', 'arautoDashStart', 'arautoGround', 'arautoSlam']) {
    for (const file of AUDIO_CONFIG.cues[cue].files) {
        const wav = fs.readFileSync(file);
        assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
        let peak = 0, sum = 0;
        for (let i = 44; i < wav.length; i += 2) {
            const value = wav.readInt16LE(i) / 32768;
            peak = Math.max(peak, Math.abs(value)); sum += value;
        }
        assert.ok(peak > 0.1 && peak < 0.8, `${file}: audible, normalized headroom`);
        assert.ok(Math.abs(sum / ((wav.length - 44) / 2)) < 0.01, `${file}: low DC offset`);
        if (AUDIO_CONFIG.cues[cue].loop) {
            assert.ok(Math.abs(wav.readInt16LE(44) - wav.readInt16LE(wav.length - 2)) <= 1, `${file}: continuous seam`);
        }
    }
}
function textureContrast(file) {
    const data = fs.readFileSync(file), energies = [];
    for (let start = 44; start + 882 <= data.length; start += 882) {
        let energy = 0;
        for (let i = start; i < start + 882; i += 2) energy += (data.readInt16LE(i) / 32768) ** 2;
        energies.push(Math.sqrt(energy / 441));
    }
    energies.sort((a, b) => a - b);
    return energies[Math.floor(energies.length * 0.9)] / Math.max(0.00001, energies[Math.floor(energies.length * 0.2)]);
}
assert.ok(textureContrast('assets/audio/arauto-saw-stone-loop.wav') > 5,
    'stone loop has distinct short transients and gaps rather than a continuous hiss');
assert.ok(textureContrast('assets/audio/arauto-dash-loop.wav') < 4,
    'dash wind remains continuous rather than crackling');
console.log('Arauto audio contacts, dash/impact synchronization, lifecycle and WAV checks passed');
