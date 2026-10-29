import assert from 'node:assert/strict';
import { SpawnSystem } from '../js/systems/SpawnSystem.js';
import { CombatSystem } from '../js/combat/CombatSystem.js';
import { Player } from '../js/entities/Player.js';
import { BossHealthBar } from '../js/ui/BossHealthBar.js';
import { FLAME_GOLEM } from '../js/config/FlameGolemConfig.js';
import { BOSS_BAR } from '../js/config/BossBarConfig.js';

const sheet = { complete: true, naturalWidth: 1200 };
const spawn = new SpawnSystem({ assets: { get: () => sheet }, bloodCanvas: { palette: [] } });
const create = (type = 'flameGolem') => spawn.createEnemy(0, 0, 1, type);
const noHit = () => assert.fail('sem dano nesta etapa');

// jogador falso: só conta os acertos recebidos
const dummy = (x, y = 0) => ({ x, y, lives: 3, hitRadius: 16, falling: false, hits: 0, takeDamage() { this.hits++; return true; } });

// --- escala, vida e resistência ---
{
    const e = create();
    assert.equal(e.hp, 100); assert.equal(e.maxHp, 100);
    assert.equal(FLAME_GOLEM.secondPhaseHp, 50);
    assert.equal(e.sprite.drawHeight, 246, 'dobro da escala visual anterior (123)');
    assert.equal(e.hitRadius, 24, 'colisão não dobra automaticamente');
    assert.equal(e.superArmor, true);

    const ps = [dummy(40), dummy(-40)];
    e.update(ps, noHit);
    assert.equal(e.state, 'windup');
    const hp = e.hp;
    assert.ok(e.takeHit(1, { dirX: 1, dirY: 0 }));
    assert.equal(e.hp, hp - 1);
    assert.equal(e.state, 'windup', 'dano no windup não cancela');
    assert.ok(e.flashTimer > 0, 'mantém o flash de acerto');
    assert.equal(e.pushVx, 0); assert.equal(e.pushVy, 0);
    e.freezeOnHit(0.1);
    assert.equal(e.hitFreezeTimer, 0, 'sem hit stop local');
    for (let t = 0; t < e.hitCooldownSteps; t++) e.update(ps, () => {});
    // dano durante o ataque e a recuperação nunca troca o estado por hurt/stunned
    const seen = new Set();
    for (let t = 0; t < 600; t++) {
        e.update(ps, () => {});
        if (t % e.hitCooldownSteps === 0) e.takeHit(1, { dirX: 1, dirY: 0 });
        seen.add(e.state);
    }
    assert.ok(seen.has('attack') && seen.has('recover'));
    assert.ok(!seen.has('hurt') && !seen.has('stunned'), 'nunca entra em hurt/stunned');
    assert.equal(e.takeHit(), false, 'cooldown entre acertos da serra');
}

// --- outros inimigos mantêm as reações antigas ---
{
    const k = create('blackKnightB');
    assert.equal(k.superArmor, false);
    k.takeHit(1, { dirX: 1, dirY: 0 });
    assert.ok(['hurt', 'stunned'].includes(k.state), 'inimigo comum ainda sofre stagger');
    k.freezeOnHit(0.05);
    assert.ok(k.hitFreezeTimer > 0, 'inimigo comum ainda congela no acerto');
}

// --- fase 2: transição única, sem restaurar vida ---
{
    const e = create();
    e.hp = 51; e._updatePhase();
    assert.equal(e.phase, 1);
    e.hp = 50; e._updatePhase();
    assert.equal(e.phase, 2);
    const speed = e.speed;
    e.hp = 20; e._updatePhase();
    assert.equal(e.phase, 2); assert.equal(e.speed, speed, 'transição acontece uma vez');
    assert.equal(e.hp, 20, 'não restaura vida');
}

// --- fase 1 mantém o golpe de área; fase 2 troca por três saltos ---
const startAttack2 = (e, ps) => {
    e.attackIndex = e.attackKeys.indexOf('attack2');
    e.update(ps, noHit);
    assert.equal(e.currentAttack, 'attack2');
    assert.equal(e.state, 'windup');
};
{
    const e = create(), ps = [dummy(40), dummy(-40)];
    startAttack2(e, ps);
    assert.equal(e.slamMode, false, 'fase 1: golpe de área único');
    assert.equal(e.slam, null);
}
{
    const e = create();
    e.hp = 50; e._updatePhase();
    const ps = [dummy(-40), dummy(40)];
    startAttack2(e, ps);
    assert.equal(e.slamMode, true, 'fase 2: sequência de saltos');
    const cfg = FLAME_GOLEM.slam;
    assert.equal(cfg.count, 3);

    const launched = [], landed = [];
    let impacts = 0, lastPhase = null;
    const hitsBefore = () => ps.map(p => p.hits);
    let shifted = false;
    for (let t = 0; t < 900 && e.state !== 'recover'; t++) {
        const before = hitsBefore();
        e.update(ps, () => {});
        const delta = ps.map((p, i) => p.hits - before[i]);
        if (e.slam && e.slam.phase === 'air' && e.slam.phase !== lastPhase) launched.push({ ...e.slam.mark });
        lastPhase = e.slam?.phase ?? null;
        if (e.slam?.phase === 'air') {
            assert.equal(e.airborne, true);
            assert.ok(e.jumpHeight > 0 || e.slam.t === 0);
            assert.deepEqual(delta, [0, 0], 'sem dano enquanto está no ar');
            // os jogadores se mexem durante o salto: a marca não segue
            if (!shifted) { ps.forEach(p => { p.x += 50; }); shifted = true; }
        }
        if (e.justSlammed) {
            if (shifted) { ps.forEach(p => { p.x -= 50; }); shifted = false; }
            impacts++;
            landed.push({ x: e.x, y: e.y });
            assert.equal(e.airborne, false); assert.equal(e.jumpHeight, 0);
            assert.ok(delta.every(d => d <= 1), 'no máximo um acerto por jogador por impacto');
        } else if (e.state === 'attack') {
            assert.deepEqual(delta, [0, 0], 'dano só no impacto');
        }
    }
    assert.equal(impacts, 3, 'três impactos');
    assert.equal(launched.length, 3);
    launched.forEach((mark, i) => {
        assert.ok(Math.abs(landed[i].x - mark.x) < 1e-9 && Math.abs(landed[i].y - mark.y) < 1e-9, `aterrissa na marca fixada do salto ${i + 1}`);
    });
    assert.ok(landed[0].x < 0 && landed[1].x > 0 && landed[2].x < 0, 'alterna entre os dois jogadores');
    assert.equal(e.state, 'recover');
    assert.ok(Math.abs(e.recoverFrames - cfg.finalRecoverTicks / FLAME_GOLEM.phases[1].animationSpeedMultiplier) < 1e-9, 'recuperação final maior');
    assert.ok(e.recoverFrames > e.abilities.attack2.recoverTicks / FLAME_GOLEM.phases[1].animationSpeedMultiplier);
    assert.ok(ps[0].hits >= 3 && ps[1].hits >= 3, 'cada impacto atinge quem está no raio');
}

// --- dano no ar não interrompe; morte cancela a sequência ---
{
    const e = create();
    e.hp = 50; e._updatePhase();
    const ps = [dummy(-40), dummy(40)];
    startAttack2(e, ps);
    for (let t = 0; t < 400 && !e.airborne; t++) e.update(ps, () => {});
    assert.equal(e.airborne, true);
    e.takeHit(1, { dirX: 1, dirY: 0 });
    e.update(ps, () => {});
    assert.equal(e.airborne, true, 'dano no salto não interrompe');
    e.hp = 0; e.startDying();
    assert.equal(e.airborne, false); assert.equal(e.jumpHeight, 0); assert.equal(e.slam, null);
    for (let t = 0; t < e.dyingDuration + 5; t++) {
        e.update(ps, noHit);
        assert.equal(e.justSlammed, false, 'morto não executa slam');
    }
    assert.ok(e.readyToGib);
}

// --- piso seguro ---
{
    const e = create(); e.x = e.y = 96;
    const floor = Array.from({ length: 8 }, () => Array(10).fill(17));
    for (let row = 0; row < floor.length; row++) floor[row][4] = -1;
    e.setNavigationFloor(floor, { minX: 0, minY: 0 });
    const mark = e._safeLanding(224, 96);
    assert.ok(mark, 'acha piso seguro perto do alvo sobre o abismo');
    assert.ok(e._chargeFits(mark.x, mark.y));
    assert.ok(mark.x + e.hitRadius <= 192 + 1e-9, 'não aterrissa perto demais do abismo');
    assert.deepEqual(e._safeLanding(96, 96), { x: 96, y: 96 }, 'ponto já seguro é mantido');
    e.setNavigationFloor(floor.map(r => r.map(() => -1)), { minX: 0, minY: 0 });
    assert.equal(e._safeLanding(96, 96), null, 'sem piso seguro devolve null');
}

// --- morte lenta, sem gibs, com escombros ---
{
    const e = create();
    assert.equal(e.dyingDuration, 6 * 12);
    e.hp = 50; e._updatePhase();
    assert.equal(e.dyingDuration, 6 * 12, 'fase 2 não acelera a morte');
    e.takeHit(); e.hp = 0; e.startDying();
    e.flashTimer = 0;
    const crops = [];
    const ctx = { save() {}, restore() {}, translate() {}, scale() {}, drawImage(...a) { crops.push(a.slice(1, 3)); } };
    for (let t = 0; t < e.dyingDuration; t++) { e.draw(ctx); e.update([dummy(500), dummy(600)], noHit); }
    assert.deepEqual([...new Set(crops.map(([x]) => x))], [30, 130, 230, 330, 430, 530], 'toca todos os quadros');
    assert.ok(e.readyToGib);

    const room = { enemies: [e], corpses: [], cell: {}, hearts: [], addHeart() {}, removeEnemyAt(i) { this.enemies.splice(i, 1); } };
    const combat = new CombatSystem({
        renderer: { triggerShake() {} },
        particleSystem: { triggerBlood: noHit, triggerBloodPool: noHit }
    });
    const gibs = []; let kills = 0;
    combat.resolveDeaths(room, gibs, () => kills++, []);
    assert.equal(gibs.length, 0, 'sem desmembramento'); assert.equal(kills, 1);
    assert.equal(room.enemies.length, 0, 'sala não fica bloqueada pelo cadáver');
    assert.equal(room.corpses.length, 1); assert.equal(e.state, 'dead');
    combat.resolveDeaths(room, gibs, () => kills++, []);
    assert.equal(kills, 1, 'evento de morte não repete');
    crops.length = 0; e.draw(ctx);
    assert.equal(crops[0][0], 530, 'escombros ficam no último quadro');

    // inimigo comum mantém o fluxo de gibs
    let blood = 0;
    const regular = { readyToGib: true, leavesCorpse: false, x: 0, y: 0, explodeIntoGibs: () => [1, 2, 3] };
    const room2 = { enemies: [regular], corpses: [], cell: {}, hearts: [], addHeart() {}, removeEnemyAt(i) { this.enemies.splice(i, 1); } };
    const combat2 = new CombatSystem({ renderer: { triggerShake() {} }, particleSystem: { triggerBlood() { blood++; }, triggerBloodPool() { blood++; } } });
    const gibs2 = [];
    combat2.resolveDeaths(room2, gibs2, null, []);
    assert.equal(gibs2.length, 3); assert.ok(blood > 0); assert.equal(room2.corpses.length, 0);
}

// --- barra de chefe ---
{
    let state = null;
    const bar = new BossHealthBar({ getState: () => state });
    bar.update(0.016);
    assert.equal(bar.visible, false, 'sem encontro, sem barra');

    const e = create();
    state = e.bossBarState;
    assert.equal(state.name, 'Arauto das Brasas'); assert.equal(state.max, 100); assert.equal(state.hp, 100);
    assert.equal(state.phaseAt, 0.5);
    bar.update(0.016);
    assert.equal(bar.visible, true); assert.equal(bar.ratio, 1);

    e.takeHit(30, null);
    state = e.bossBarState; bar.update(0.016);
    assert.equal(bar.hp, 70); assert.ok(Math.abs(bar.ratio - 0.7) < 1e-9, 'reflete HP atual/máximo');
    assert.ok(bar.trail > bar.ratio, 'rastro de dano segue atrás');
    for (let i = 0; i < 100; i++) bar.update(0.05);
    assert.equal(bar.trail, bar.ratio);

    e.hp = 0; e.startDying();
    state = e.bossBarState; bar.update(0.016);
    assert.equal(bar.hp, 0); assert.equal(bar.ratio, 0, 'HP zero durante a animação de morte');
    assert.equal(bar.visible, true);

    state = null; bar.update(0.016);
    assert.equal(bar.visible, false, 'some ao fim do encontro');
    assert.equal(bar.ratio, 1, 'reset limpa o estado antigo');

    // layout: dentro da faixa livre entre os retratos; janela estreita sobe acima do HUD
    const wide = bar.layout(1920, 1080, { left: 500, right: 1400, top: 960 });
    assert.ok(wide.x >= 500 && wide.x + wide.wL * wide.S <= 1400, 'não invade os retratos');
    assert.ok(wide.y + wide.hL * wide.S <= 1080);
    const narrow = bar.layout(700, 900, { left: 380, right: 320, top: 800 });
    assert.ok(narrow.y + narrow.hL * narrow.S <= 800, 'janela estreita: barra acima do HUD');
    assert.ok(narrow.x >= 0 && narrow.x + narrow.wL * narrow.S <= 700, 'cabe na tela estreita');
    assert.ok(wide.wL * wide.S <= BOSS_BAR.maxWidth);
}

// --- vida infinita ---
{
    const player = () => new Player(0, 0, '#fff', [], null, 'test');
    const normal = player();
    assert.equal(normal.infiniteLives, false, 'padrão desligado');
    assert.equal(normal.takeDamage(-10, 0), true);
    assert.equal(normal.lives, 2);

    const inf = player(); inf.infiniteLives = true;
    assert.equal(inf.takeDamage(-10, 0, { knockback: 20 }), true, 'acerto continua sendo aceito');
    assert.equal(inf.lives, 3, 'não desconta vida');
    assert.equal(inf.damageTaken, 1);
    assert.ok(inf.vx > 0, 'empurrão preservado');
    assert.ok(inf.invulnerableTimer > 0 && inf.hurtTimer > 0, 'reação e invulnerabilidade preservadas');
    assert.equal(inf.takeDamage(-10, 0), false, 'invulnerável logo depois');
    assert.equal(inf.loseLife(1), false); assert.equal(inf.lives, 3, 'queda também não desconta');

    inf.infiniteLives = false;
    inf.invulnerableTimer = 0;
    inf.takeDamage(-10, 0);
    assert.equal(inf.lives, 2, 'desligar restaura a perda de vida');
    assert.equal(inf.loseLife(5), true); assert.equal(inf.lives, 0);
}

console.log('Arauto das Brasas: resistência, fases, três slams, morte com escombros, barra e vida infinita passaram.');
