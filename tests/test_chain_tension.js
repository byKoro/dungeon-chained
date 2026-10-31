import assert from 'node:assert/strict';
import { ChainTensionFeedback, tensionTargets, tensionAudioTargets } from '../js/systems/ChainTensionFeedback.js';
import { Chain } from '../js/core/Chain.js';
import { SawWeapon } from '../js/weapons/SawWeapon.js';
import { CHAIN } from '../js/config/ChainConfig.js';
import { CHAIN_TENSION as C } from '../js/config/ChainTensionConfig.js';
import { Player } from '../js/entities/Player.js';
import { playerConfigs } from '../js/config/EntityConfig.js';

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`ok ${name}`); };
const players = distance => [{ x: 0, y: 0, vx: 0, vy: 0, lives: 3 }, { x: distance, y: 0, vx: 0, vy: 0, lives: 3 }];
const chain = () => new Chain([new SawWeapon()], CHAIN);

test('antecipação começa antes do desgaste, em silêncio no repouso', () => {
    const c = chain();
    assert.deepEqual(tensionTargets(c, ...players(c.rest)), { effort: 0, risk: 0 });
    const early = tensionTargets(c, ...players(c.strainDistance - 5));
    assert(early.effort > 0 && early.risk === 0);
});
test('distância e tempo fazem subir a tensão; afastamento extremo é urgente', () => {
    const c = chain(), p = players(c.strainDistance + 1);
    const initial = tensionTargets(c, ...p);
    c.strain = c.strainLimit * 0.9;
    assert(tensionTargets(c, ...p).risk > initial.risk);
    assert(tensionTargets(c, ...players(c.breakDistance - 1)).risk > 0.95);
});
test('melhoria de elasticidade desloca os limiares', () => {
    const c = chain(), p = players(180), old = tensionTargets(c, ...p);
    c.rest *= 2; c.strainDistance *= 2; c.breakDistance *= 2;
    assert(tensionTargets(c, ...p).effort < old.effort);
    assert.equal(tensionTargets(c, ...p).risk, 0);
});
test('dash mantém carga mas suspende risco; serra dupla ainda rompe por distância', () => {
    const c = chain(), p = players(c.breakDistance - 1);
    c.strain = c.strainLimit - 1;
    const held = tensionTargets(c, ...p, { protected: true });
    assert(held.effort > 0); assert.equal(held.risk, 0);
    c.weapon.split = 1;
    assert(tensionTargets(c, ...players(c.strainDistance + 1)).risk < 0.02);
    c.strain = 0;
    assert(tensionTargets(c, ...p).risk > 0.95);
    c.update(...p, { holdStrain: true });
    assert(c.isConnected);
    const far = players(c.breakDistance + 1);
    c.update(...far);
    assert(!c.isConnected);
});
test('recuar para a faixa segura remove risco temporal acumulado', () => {
    const c = chain(); c.strain = c.strainLimit - 1;
    assert.equal(tensionTargets(c, ...players(c.rest)).risk, 0);
});
test('áudio aumenta ganho, altura e abertura; inatividade silencia', () => {
    const a = tensionAudioTargets({ effort: 0.2, risk: 0 });
    const b = tensionAudioTargets({ effort: 0.9, risk: 0.9 });
    assert(b.level > a.level && b.rate > a.rate && b.cutoff > a.cutoff);
    assert.equal(tensionAudioTargets({ effort: 1, risk: 1 }, false).level, 0);
    assert.equal(tensionAudioTargets({ effort: 0, risk: 0 }).level, 0);
});
test('a tensão nunca coloca cara de raiva/fúria nos jogadores', () => {
    const c = chain(), p = players(190), f = new ChainTensionFeedback();
    let now = 0;
    const tick = (count, options = {}) => { for (let i = 0; i < count; i++) f.update(c, p, options, now += 1000 / 60); };
    c.strain = c.strainLimit * 0.9; tick(12);
    assert.equal(p[0].tensionExpression, null);
    assert.equal(p[1].tensionExpression, null);
    assert.equal(f.state.expression, null);
    assert(f.state.risk > 0, 'o risco ainda sobe (só o rosto não reage mais)');
});
test('voz única, snap imediato, pausa, desconexão, ausência da serra e reset', () => {
    let created = 0, stopped = 0, last;
    const f = new ChainTensionFeedback({ audio: { createLoopVoice() {
        created++; return { set(v) { last = v; }, stop() { stopped++; } };
    } } });
    const c = chain(), p = players(205);
    let now = 0;
    for (let i = 0; i < 20; i++) f.update(c, p, {}, now += 17);
    assert.equal(created, 1); assert(last.level > 0);
    f.update(c, p, { protected: true }, now += 17);
    assert.equal(f.state.risk, 0);
    assert.notEqual(p[0].tensionExpression, 'furia');
    f.onSnap(); assert.equal(last.level, 0);
    c.connected = false; f.update(c, p, {}, now += 17);
    assert.equal(last.level, 0); assert.equal(p[0].tensionExpression, null);
    c.connected = true; f.update(c, p, { active: false }, now += 17);
    assert.equal(f.state.effort, 0); assert.equal(f.snapTime, 0); assert.equal(last.level, 0);
    c.present = false; assert.deepEqual(tensionTargets(c, ...p), { effort: 0, risk: 0 });
    f.reset(p); assert.equal(stopped, 1); assert.equal(f.voice, null);
});
test('cabo só treme no limite: abaixo do risco segue a reta, perto da ruptura chacoalha', () => {
    const c = chain(), p = players(210), w = c.weapon;
    // Risco baixo (abaixo de preSnapShake.start): sem tremida, segue a reta física.
    w.tensionFeedback = { effort: 1, risk: C.preSnapShake.start - 0.05, motionScale: 1 };
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        assert.deepEqual(w.visualCablePoint(...p, t), w.cablePoint(...p, t), 'sem tremida longe do limite');
    }
    // Risco máximo: âncoras (t=0 e t=1) presas, mas o meio desvia da reta em algum momento da fase.
    w.tensionFeedback = { effort: 1, risk: 1, motionScale: 1 };
    assert.deepEqual(w.visualCablePoint(...p, 0), w.cablePoint(...p, 0), 't=0 fica preso no jogador');
    assert.deepEqual(w.visualCablePoint(...p, 1), w.cablePoint(...p, 1), 't=1 fica preso no jogador');
    const amp = (risk) => { w.tensionFeedback = { effort: 1, risk, motionScale: 1 }; return Math.max(...Array.from({ length: 40 }, (_, i) => { w.shakePhase = i / 40 * Math.PI * 2; const v = w.visualCablePoint(...p, 0.5), q = w.cablePoint(...p, 0.5); return Math.hypot(v.x - q.x, v.y - q.y); })); };
    const start = amp(C.preSnapShake.start + 0.02), full = amp(1);
    assert(start > 0 && start < 2, 'logo que entra em tensão é só uma tremidinha sutil');
    assert(full > start + 1, 'a tremida cresce bastante rumo à ruptura');
});
test('a corda pisca conforme o risco (opacidade cai no vale, piso em 1 sem risco)', () => {
    const w = new SawWeapon();
    w.tensionFeedback = { risk: 0 };
    assert.equal(w._cableAlpha(), 1, 'sem risco a corda não pisca');
    w.tensionFeedback = { risk: 1 };
    // Varre a fase do piscar: deve existir um vale (alpha < 1) e um pico perto de 1.
    let lo = 1, hi = 0;
    for (let i = 0; i < 64; i++) { w.blinkPhase = i / 64 * Math.PI * 2; const a = w._cableAlpha(); lo = Math.min(lo, a); hi = Math.max(hi, a); }
    assert(lo < 1 - C.cableBlink.depthMax * 0.4, 'no risco alto a opacidade cai bastante no vale');
    assert(hi > 0.98, 'a corda volta a quase cheia no pico do piscar');
});
test('sprite de esforço preserva animação; dano e expressão explícita prevalecem', () => {
    const img = { complete: true, naturalWidth: 800 };
    const effort = { ...img }, angry = { ...img }, hurt = { ...img }, scared = { ...img };
    const assets = { images: { player_01_expr_raiva: effort, player_01_expr_furia: angry }, p1: img, p1Hurt: hurt, p1Scared: scared };
    const cfg = playerConfigs(assets)[0];
    const p = new Player(0, 0, cfg.color, cfg.controls, cfg.img, cfg.name, cfg.sprite);
    p.tensionExpression = 'raiva';
    assert.equal(p.resolveSprite().sheet, effort);
    p.vx = 2; p.walkFrame = 3;
    assert.equal(p.resolveSprite().frame, 4);
    p.hurtTimer = 2; assert.equal(p.resolveSprite().sheet, hurt);
    p.hurtTimer = 0; p.expression = 'furia';
    assert.equal(p.resolveSprite().sheet, angry);
    p.expression = null; p.scaredTimer = 2; assert.equal(p.resolveSprite().sheet, scared);
});
test('cabo afina conforme o risco sobe e tem piso mínimo', () => {
    const w = new SawWeapon();
    w.tensionFeedback = { risk: 0 };
    assert.equal(w._cableThickness(), 1, 'em repouso o cabo tem espessura cheia');
    w.tensionFeedback = { risk: 0.5 };
    const mid = w._cableThickness();
    w.tensionFeedback = { risk: 1 };
    const full = w._cableThickness();
    assert(mid < 1 && full < mid, 'mais risco, mais fino');
    assert(full >= C.cableThin.minThickness - 1e-9, 'não afina além do piso mínimo');
});
test('onSnap guarda o ponto de ruptura e arma o corte; reset limpa', () => {
    const f = new ChainTensionFeedback();
    f.onSnap({ x: 120, y: 40 });
    assert.deepEqual(f.snapPoint, { x: 120, y: 40 });
    assert.equal(f.snapTime, C.snapSeconds, 'o corte dura snapSeconds');
    f.reset([]);
    assert.equal(f.snapPoint, null, 'reset limpa o ponto de ruptura');
    assert.equal(f.snapTime, 0);
});
console.log(`${passed}/${passed} ok`);
