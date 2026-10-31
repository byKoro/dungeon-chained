import assert from 'node:assert/strict';
import { ChainTensionFeedback, tensionTargets, tensionAudioTargets, tensionGlowTargets } from '../js/systems/ChainTensionFeedback.js';
import { Chain } from '../js/core/Chain.js';
import { SawWeapon } from '../js/weapons/SawWeapon.js';
import { CHAIN } from '../js/config/ChainConfig.js';
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
test('brilho permanece visível e progride do vermelho escuro ao vermelho quente', () => {
    const rest = tensionGlowTargets({ effort: 0 });
    const light = tensionGlowTargets({ effort: 0.23, risk: 0 });
    const hot = tensionGlowTargets({ effort: 0.9, risk: 0.9 });
    assert.equal(rest.strength, 0);
    assert(light.strength > 0.4 && hot.strength > light.strength);
    assert.notEqual(light.color, hot.color);
    for (const pulse of [0, 0.25, 0.5, 0.75]) {
        assert(tensionGlowTargets({ effort: 1, risk: 1, pulse }).strength > 0.7, 'aviso crítico não apaga entre pulsos');
    }
});
test('expressões têm histerese e alívio termina em 250ms sem reiniciar acomodação', () => {
    const c = chain(), p = players(190), f = new ChainTensionFeedback();
    let now = 0;
    const tick = (count, options = {}) => { for (let i = 0; i < count; i++) f.update(c, p, options, now += 1000 / 60); };
    c.strain = c.strainLimit * 0.9; tick(12);
    assert.equal(p[0].tensionExpression, 'furia');
    c.strain = c.strainLimit * 0.65; tick(12);
    assert.equal(p[0].tensionExpression, 'furia');
    c.strain = c.strainLimit * 0.55; tick(12);
    assert.equal(p[0].tensionExpression, 'raiva');
    c.strain = 0; p[1].x = c.rest; tick(15);
    assert.equal(p[0].tensionExpression, null);
    assert(f.state.effort < 0.02); assert.equal(f.state.settle, 0);
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
test('vibração desenhada não altera cabo físico nem posição da serra', () => {
    const c = chain(), p = players(210), w = c.weapon;
    const before = w.getSawPositions(...p);
    w.tensionFeedback = { effort: 1, phase: 0.7, settle: 0, motionScale: 1 };
    assert.deepEqual(w.getSawPositions(...p), before);
    assert.deepEqual(w.visualCablePoint(...p, 0), w.cablePoint(...p, 0));
    assert.deepEqual(w.visualCablePoint(...p, 1), w.cablePoint(...p, 1));
    assert.notDeepEqual(w.visualCablePoint(...p, 0.4), w.cablePoint(...p, 0.4));
    w.tensionFeedback.effort = 0.23;
    assert(Array.from({ length: 20 }, (_, i) => (i + 1) / 21).some(t => {
        const visual = w.visualCablePoint(...p, t), physical = w.cablePoint(...p, t);
        return visual.x !== physical.x || visual.y !== physical.y;
    }), 'vibração leve deve sobreviver à quantização de pixels');
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
console.log(`${passed}/${passed} ok`);
