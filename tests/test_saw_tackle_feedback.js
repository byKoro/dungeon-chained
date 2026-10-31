import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SawTackleFeedback, tackleAudioTargets, tackleHeatColor } from '../js/systems/SawTackleFeedback.js';
import { SawTackle } from '../js/systems/SawTackle.js';
import { SawWeapon } from '../js/weapons/SawWeapon.js';
import { Chain } from '../js/core/Chain.js';
import { CHAIN } from '../js/config/ChainConfig.js';
import { SAW_TACKLE } from '../js/config/SawTackleConfig.js';
import { SAW_TACKLE_FEEL as C } from '../js/config/SawTackleFeelConfig.js';
import { AUDIO_CONFIG } from '../js/config/AudioConfig.js';

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`ok ${name}`); };
class FakeVoice {
    set(value) { this.last = value; }
    pulse() { this.pulses = (this.pulses ?? 0) + 1; }
    stop() { this.stopped = true; }
}
const setup = () => {
    const voices = [], sounds = [], blood = [], sparks = [];
    const audio = { play(cue) { sounds.push(cue); }, duck() {}, createLoopVoice(cue) {
        const voice = new FakeVoice(); voices.push({ cue, voice }); return voice;
    } };
    const feedback = new SawTackleFeedback({ audio, particleSystem: {
        triggerHitBlood(...args) { blood.push(args); }, triggerHitSparks(...args) { sparks.push(args); }
    } });
    const weapon = new SawWeapon(); weapon.drop(100, 100);
    const tackle = { state: 'flight', vx: SAW_TACKLE.speed, vy: 0, stuck: null };
    return { feedback, weapon, tackle, voices, sounds, blood, sparks };
};

test('voo/corte têm curvas distintas e estados inativos são silenciosos', () => {
    const flight = tackleAudioTargets({ state: 'flight', speed: 15 });
    assert(flight.flight.level > 0 && flight.cut.level === 0);
    const slow = tackleAudioTargets({ state: 'flight', speed: 5 });
    assert(flight.flight.level > slow.flight.level);
    const cut = tackleAudioTargets({ state: 'stuck' });
    assert(cut.cut.level > flight.flight.level && cut.flight.level === 0);
    const stone = tackleAudioTargets({ state: 'stuck', stone: true });
    assert(stone.cut.rate < cut.cut.rate && stone.cut.cutoff < cut.cut.cutoff);
    for (const state of ['impact', 'flight', 'stuck', 'landing', null]) {
        const inactive = tackleAudioTargets({ state, speed: 15, active: false });
        assert.equal(inactive.cut.level + inactive.flight.level, 0);
    }
    assert.equal(tackleAudioTargets({ state: 'flight', speed: 0 }).flight.level, 0);
});
test('duas vozes reutilizadas; transições, pausa e reset não deixam áudio preso', () => {
    const s = setup(), f = s.feedback;
    f.update(s.tackle, s.weapon, {}, 0);
    for (let i = 1; i <= 10; i++) f.update(s.tackle, s.weapon, {}, i * 17);
    assert.equal(s.voices.length, 1);
    s.tackle.state = 'stuck'; s.tackle.stuck = { e: {}, dirX: 1, dirY: 0 };
    f.update(s.tackle, s.weapon, {}, 190);
    assert.equal(s.voices.length, 2);
    assert.equal(f.flightVoice.last.level, 0); assert(f.cutVoice.last.level > 0);
    f.hit(s.weapon, {}, {}, { x: 1, y: 0 }); assert.equal(f.cutVoice.pulses, 1);
    f.update(s.tackle, s.weapon, { active: false }, 210);
    assert.equal(f.cutVoice.last.level + f.flightVoice.last.level, 0);
    assert.equal(f.visual.jitter, 0); assert.equal(f.bursts.length, 0);
    f.update(s.tackle, s.weapon, {}, 230);
    assert.equal(s.voices.length, 2);
    s.weapon.dropped = false; f.update(s.tackle, s.weapon, {}, 250);
    assert.equal(f.cutVoice.last.level, 0);
    f.reset(); assert(s.voices.every(v => v.voice.stopped)); assert.equal(f.cutVoice, null);
});
test('vibração não muda coordenadas; pedra não emite sangue; partículas limitadas', () => {
    const s = setup(), before = { x: s.weapon.dropX, y: s.weapon.dropY };
    s.tackle.state = 'stuck'; s.tackle.stuck = { e: { effectMaterial: 'lavaStone' }, dirX: 1, dirY: 0 };
    for (let i = 0; i < 20; i++) s.feedback.update(s.tackle, s.weapon, {}, i * 17);
    assert(s.feedback.visual.jitter > 0 && s.sparks.length > 0);
    assert.deepEqual({ x: s.weapon.dropX, y: s.weapon.dropY }, before);
    s.feedback.hit(s.weapon, s.tackle.stuck.e, {}, { x: 1, y: 0 });
    assert.equal(s.blood.length, 0);
    s.feedback.hit(s.weapon, {}, {}, { x: 1, y: 0 }); assert.equal(s.blood.length, 1);
    for (let i = 0; i < 100; i++) s.feedback.impact(s.weapon, { x: 1, y: 0 });
    assert.equal(s.feedback.bursts.length, C.maxBursts);
    s.tackle.state = null;
    for (let i = 20; i < 60; i++) s.feedback.update(s.tackle, s.weapon, {}, i * 17);
    assert.equal(s.feedback.bursts.length, 0);
    assert.equal(s.feedback.visual.scale, 1);
});
test('eventos reais ocorrem uma vez; rejeitar dano não emite pulsos de acerto', () => {
    const events = [];
    const bridge = Object.fromEntries(['reset', 'impact', 'launch', 'contact', 'hit', 'land', 'bounce']
        .map(name => [name, () => events.push(name)]));
    const chain = new Chain([new SawWeapon()], CHAIN); chain.spawnSaw(1000, 1000);
    const p = { x: 973, y: 1000, vx: 15, vy: 0, dashDirX: 1, dashDirY: 0,
        dashing: true, lives: 3, hitRadius: 16, startTackle() { this.dashing = false; } };
    let accepts = false;
    const enemy = { x: 1200, y: 1000, hitRadius: 20, hp: 100, state: 'chase', takeHit() {
        return accepts ? { damage: 1, killed: false } : false;
    } };
    const t = new SawTackle({ chain, getPlayers: () => [p], getRoom: () => ({ enemies: [enemy] }), feedback: bridge });
    events.length = 0;
    for (let i = 0; i < 30; i++) t.update();
    assert.equal(events.filter(e => e === 'impact').length, 1);
    assert.equal(events.filter(e => e === 'launch').length, 1);
    assert.equal(events.filter(e => e === 'contact').length, 1);
    assert.equal(events.filter(e => e === 'hit').length, 0);
    accepts = true; t.update(); assert.equal(events.filter(e => e === 'hit').length, 1);
    for (let i = 0; i < 3; i++) t.update();
    assert.equal(events.filter(e => e === 'hit').length, 1, 'sem pulso a cada frame');
    t.reset(); assert.equal(events.at(-1), 'reset');
});
test('áudio gerado está registrado, sem saturação e loops sem salto na emenda', () => {
    for (const [name, cue] of Object.entries(AUDIO_CONFIG.cues).filter(([key]) => key.startsWith('sawTackle'))) {
        const wav = fs.readFileSync(cue.files[0]);
        assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
        assert.equal(wav.readUInt32LE(24), 44100);
        let clipped = false;
        for (let i = 44; i < wav.length; i += 2) if (Math.abs(wav.readInt16LE(i)) >= 32767) clipped = true;
        assert(!clipped, name);
        if (cue.loop) assert(Math.abs(wav.readInt16LE(44) - wav.readInt16LE(wav.length - 2)) <= 1, `${name}: loop seam`);
    }
});
test('luzes dinâmicas usam coordenadas válidas, têm limite e desligam no reset', () => {
    const s = setup(), lights = [];
    s.tackle.trail = Array.from({ length: 12 }, (_, i) => ({ x: i * 15, y: 80 + i }));
    for (let i = 0; i < 30; i++) s.feedback.impact(s.weapon, { x: 1, y: 0 });
    s.feedback.update(s.tackle, s.weapon, {}, 0);
    const renderer = { worldToScreen: (x, y) => ({ x: x * 2, y: y * 2, zoom: 2 }) };
    const post = { addLight(...args) { lights.push(args); } };
    s.feedback.renderLights(renderer, post, s.tackle, s.weapon);
    assert(lights.length > 0 && lights.length <= 2 + C.light.maxBursts + C.light.maxTrail);
    assert(lights.every(args => args.slice(0, 3).every(Number.isFinite)));
    assert(s.weapon.tackleFeedback.lit);
    s.feedback.reset(); lights.length = 0;
    s.feedback.renderLights(renderer, post, s.tackle, s.weapon); assert.equal(lights.length, 0);
    assert.equal(s.weapon.tackleFeedback.lit, false);
});
test('cor aquece gradualmente desde a serra solta e esfria sem salto no pouso', () => {
    const s = setup();
    s.feedback.update(s.tackle, s.weapon, {}, 0);
    assert.equal(s.feedback.visual.heat, 0);
    assert.equal(tackleHeatColor(C.colors.flight, 0), '150, 196, 255');
    s.feedback.update(s.tackle, s.weapon, {}, 50);
    const early = s.feedback.visual.heat;
    assert(early > 0 && early < 1);
    assert.notEqual(tackleHeatColor(C.colors.flight, early), tackleHeatColor(C.colors.flight, 1));
    for (let i = 2; i <= 12; i++) s.feedback.update(s.tackle, s.weapon, {}, i * 50);
    assert.equal(s.feedback.visual.heat, 1);
    s.tackle.state = null; s.feedback.update(s.tackle, s.weapon, {}, 650);
    assert(s.feedback.visual.heat > 0 && s.feedback.visual.heat < 1);
    assert(s.feedback.visual.lit);
    for (let i = 14; i <= 25; i++) s.feedback.update(s.tackle, s.weapon, {}, i * 50);
    assert.equal(s.feedback.visual.heat, 0); assert.equal(s.feedback.visual.lit, false);
});
console.log(`${passed}/${passed} ok`);
