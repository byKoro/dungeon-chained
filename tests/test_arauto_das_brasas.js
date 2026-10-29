import assert from 'node:assert/strict';
import { SpawnSystem } from '../js/systems/SpawnSystem.js';
import { CombatSystem } from '../js/combat/CombatSystem.js';
import { Player } from '../js/entities/Player.js';
import { Physics } from '../js/core/Physics.js';
import { BossHealthBar } from '../js/ui/BossHealthBar.js';
import { FLAME_GOLEM } from '../js/config/FlameGolemConfig.js';
import { BOSS_BAR } from '../js/config/BossBarConfig.js';

const sheet = { complete: true, naturalWidth: 1200 };
const spawn = new SpawnSystem({ assets: { get: () => sheet }, bloodCanvas: { palette: [] } });
const create = (type = 'flameGolem') => spawn.createEnemy(0, 0, 1, type);
const noHit = () => assert.fail('sem dano nesta etapa');

// jogador falso: só conta os acertos recebidos
const dummy = (x, y = 0) => ({ x, y, lives: 3, hitRadius: 16, falling: false, hits: 0, takeDamage() { this.hits++; return true; } });

// Distâncias derivadas do config: mexer em alcances e raios não obriga a editar os testes.
const SLAM = FLAME_GOLEM.slam;
const NEAR_ATTACK = Math.floor(FLAME_GOLEM.attacks.attack.triggerRange * 0.5); // dentro do gatilho do golpe normal
const NEAR_SLAM = Math.floor(SLAM.radius * 0.3);                                // dentro do raio do slam, perto do golem
const SHIFT = Math.floor(SLAM.radius * 0.25);

// --- escala, vida e resistência ---
{
    const e = create();
    assert.equal(e.hp, FLAME_GOLEM.hp); assert.equal(e.maxHp, FLAME_GOLEM.hp);
    assert.equal(e.sprite.drawHeight, FLAME_GOLEM.drawHeight);
    assert.equal(e.hitRadius, FLAME_GOLEM.hitRadius, 'colisão tem ajuste próprio');
    assert.equal(e.superArmor, true);

    const ps = [dummy(NEAR_ATTACK), dummy(-NEAR_ATTACK)];
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
    e.hp = FLAME_GOLEM.secondPhaseHp + 1; e._updatePhase();
    assert.equal(e.phase, 1);
    e.hp = FLAME_GOLEM.secondPhaseHp; e._updatePhase();
    assert.equal(e.phase, 2);
    const speed = e.speed;
    const low = Math.floor(FLAME_GOLEM.secondPhaseHp / 2);
    e.hp = low; e._updatePhase();
    assert.equal(e.phase, 2); assert.equal(e.speed, speed, 'transição acontece uma vez');
    assert.equal(e.hp, low, 'não restaura vida');
}

// --- aviso do ataque: a própria animação, parada na pose de espera ---
{
    const e = create(), ps = [dummy(NEAR_ATTACK), dummy(-NEAR_ATTACK)];
    e.update(ps, noHit);
    assert.equal(e.state, 'windup'); assert.equal(e.currentAttack, 'attack');
    const tell = e._tellFrame();
    assert.equal(tell, FLAME_GOLEM.attacks.attack.hitFrame - 1, 'pose de espera = quadro antes do impacto');
    assert.equal(e._currentAnim(), e.sprite.rows.attack, 'o windup mostra a linha do ataque, não a caminhada');

    const frames = [];
    while (e.state === 'windup') {
        frames.push(e._currentFrameIndex(e._currentAnim()));
        e.update(ps, () => {});
    }
    assert.equal(frames[0], 0, 'começa no primeiro quadro do ataque');
    assert.equal(Math.max(...frames), tell, 'avança até a pose de espera');
    assert.ok(frames.every((f, i) => i === 0 || f >= frames[i - 1]), 'só avança, nunca volta');
    assert.ok(frames.slice(-5).every(f => f === tell), 'segura a pose até o golpe');
    assert.equal(e.state, 'attack');
    assert.equal(e.animTime, tell * e.sprite.rows.attack.fps, 'o ataque continua da pose de espera, sem voltar ao quadro 0');
    assert.equal(e._currentFrameIndex(e._currentAnim()), tell);

    // o dano continua no mesmo animTime absoluto de antes (hitFrame * fps)
    let hitTime = null;
    for (let t = 0; t < 100 && hitTime === null; t++) e.update(ps, () => { hitTime = e.animTime; });
    assert.equal(hitTime, FLAME_GOLEM.attacks.attack.hitFrame * e.sprite.rows.attack.fps);
}
{
    // investida: pose de espera antes do lançamento
    const e = create(), ps = [dummy(120), dummy(200, 50)];
    e.attackIndex = e.attackKeys.indexOf('attack3');
    e.update(ps, noHit);
    assert.equal(e.currentAttack, 'attack3');
    assert.equal(e._tellFrame(), FLAME_GOLEM.attacks.attack3.launchFrame - 1);
    assert.equal(e._currentAnim(), e.sprite.rows.attack3);
}
{
    // as marcas são só para teste e saem com um interruptor
    const calls = () => { const n = { arc: 0, move: 0 }; return { n, ctx: { save() {}, restore() {}, beginPath() {}, stroke() {}, setLineDash() {}, arc() { n.arc++; }, moveTo() { n.move++; }, lineTo() {} } }; };
    const e = create(), ps = [dummy(120), dummy(200, 50)];
    e.attackIndex = e.attackKeys.indexOf('attack3');
    e.update(ps, noHit);
    const was = FLAME_GOLEM.telegraph.showMarks;
    try {
        FLAME_GOLEM.telegraph.showMarks = true;
        const on = calls(); e.drawAttackEffect(on.ctx);
        assert.ok(on.n.arc > 0, 'com showMarks as marcas aparecem');
        FLAME_GOLEM.telegraph.showMarks = false;
        const off = calls(); e.drawAttackEffect(off.ctx);
        assert.equal(off.n.arc + off.n.move, 0, 'sem showMarks nada é desenhado');
    } finally { FLAME_GOLEM.telegraph.showMarks = was; }
}

// --- sombra, contorno, luz e brasas ---
{
    const grad = { stops: [], addColorStop(offset, color) { this.stops.push(color); } };
    const log = { translate: null, scale: null, arc: null };
    const ctx = {
        save() {}, restore() {}, beginPath() {}, fill() {},
        translate(x, y) { log.translate = [x, y]; }, scale(x, y) { log.scale = [x, y]; },
        createRadialGradient() { return grad; }, arc(x, y, r) { log.arc = r; }
    };
    const e = create(); e.x = 40; e.y = 10;
    e.drawShadow(ctx);
    assert.deepEqual(log.translate, [40, e.footY + FLAME_GOLEM.shadow.yOffset], 'sombra nos pés');
    const ground = log.arc, alphaGround = grad.stops[0];
    grad.stops.length = 0;
    e.jumpHeight = SLAM.jumpHeight;
    e.drawShadow(ctx);
    assert.ok(log.arc < ground, 'encolhe durante o salto');
    assert.notEqual(grad.stops[0], alphaGround, 'e fica mais fraca');
    e.beginFrozenSpawn(5);
    log.arc = null; e.drawShadow(ctx);
    assert.equal(log.arc, null, 'sem sombra enquanto o spawn está escondido');
}
{
    const e = create();
    assert.deepEqual(e.outline, FLAME_GOLEM.outline);
    // sem DOM (testes em Node) o desenho com contorno não pode lançar
    const ctx = { save() {}, restore() {}, translate() {}, scale() {}, drawImage() {} };
    e.draw(ctx);
}
{
    const e = create();
    e._lightT = 0;
    const idle = e.lightInfo();
    assert.ok(idle.strength > 0 && idle.radius === FLAME_GOLEM.light.radius);
    e.state = 'windup';
    assert.ok(e.lightInfo().strength > idle.strength, 'luz mais forte no aviso do ataque');
    e.state = 'chase'; e._slamGlow = 1;
    assert.ok(e.lightInfo().strength > idle.strength, 'e no impacto do slam');
    e._slamGlow = 0;
    e.state = 'dying'; e.dyingTimer = 0;
    assert.equal(e.lightInfo().strength, FLAME_GOLEM.light.corpseStrength, 'desbota na morte');
    e.state = 'dead';
    assert.equal(e.lightInfo().strength, FLAME_GOLEM.light.corpseStrength, 'escombros brilham fraco');
    const hidden = create(); hidden.beginFrozenSpawn(5);
    assert.equal(hidden.lightInfo(), null, 'sem luz enquanto escondido');
}
{
    const count = (e, ticks) => { let n = 0; const ps = { triggerFlameBurst() { n++; } }; for (let i = 0; i < ticks; i++) e.emitEmbers(ps); return n; };
    const cfg = FLAME_GOLEM.embers;
    const idle = count(create(), 60);
    assert.ok(Math.abs(idle - cfg.perSecond) <= 1, 'taxa configurada de brasas por segundo');
    const warn = create(); warn.state = 'windup';
    assert.ok(count(warn, 60) > idle, 'mais brasas no aviso do ataque');
    const dying = create(); dying.state = 'dying';
    assert.equal(count(dying, 60), 0, 'não emite morrendo');
    const dead = create(); dead.state = 'dead';
    assert.equal(count(dead, 60), 0, 'nem nos escombros');
    const hidden = create(); hidden.beginFrozenSpawn(5);
    assert.equal(count(hidden, 60), 0, 'nem escondido');
    assert.doesNotThrow(() => create().emitEmbers(null), 'sem sistema de partículas não quebra');
}

// --- a investida sempre percorre a distância inteira, mesmo com um jogador no caminho ---
{
    const run = () => {
        const e = create();
        e.abilities = structuredClone(FLAME_GOLEM.attacks);
        e.abilities.attack3.trackingStrength = 0;
        const ps = [dummy(70), dummy(900)];
        e.attackIndex = e.attackKeys.indexOf('attack3');
        let charged = 0;
        for (let t = 0; t < 400; t++) {
            e.update(ps, () => {});
            if (e.charging) charged++;
            for (let i = 0; i < 3; i++) {
                const solid = [...ps, e].filter(x => !x.ignoresEntityCollisions);
                Physics.resolveEntityCollisions(solid);
            }
            if (e.state === 'recover') break;
        }
        return { x: e.x, charged };
    };
    const cfg = FLAME_GOLEM.attacks.attack3;
    const full = run();
    assert.equal(full.charged, cfg.durationTicks, 'a investida avança durante todos os ticks configurados');
    const expected = cfg.speed * cfg.durationTicks;
    assert.ok(Math.abs(full.x - expected) < 1, `percorre a distância inteira (${full.x} de ${expected})`);
    const e = create();
    assert.equal(e.ignoresEntityCollisions, false, 'golem no chão continua sólido');
    assert.equal(e.immovable, FLAME_GOLEM.immovable);
    e.airborne = true;
    assert.equal(e.ignoresEntityCollisions, true, 'também no ar');
}

// --- fase 1 mantém o golpe de área; fase 2 troca por três saltos ---
const startAttack2 = (e, ps) => {
    e.attackIndex = e.attackKeys.indexOf('attack2');
    e.update(ps, noHit);
    assert.equal(e.currentAttack, 'attack2');
    assert.equal(e.state, 'windup');
};
{
    const e = create(), ps = [dummy(NEAR_SLAM), dummy(-NEAR_SLAM)];
    startAttack2(e, ps);
    assert.equal(e.slamMode, false, 'fase 1: golpe de área único');
    assert.equal(e.slam, null);
}
{
    const e = create();
    e.hp = FLAME_GOLEM.secondPhaseHp; e._updatePhase();
    const ps = [dummy(-NEAR_SLAM), dummy(NEAR_SLAM)];
    startAttack2(e, ps);
    assert.equal(e.slamMode, true, 'fase 2: sequência de saltos');
    const cfg = FLAME_GOLEM.slam;

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
            if (!shifted) { ps.forEach(p => { p.x += SHIFT; }); shifted = true; }
        }
        if (e.justSlammed) {
            if (shifted) { ps.forEach(p => { p.x -= SHIFT; }); shifted = false; }
            impacts++;
            landed.push({ x: e.x, y: e.y });
            assert.equal(e.airborne, false); assert.equal(e.jumpHeight, 0);
            assert.ok(delta.every(d => d <= 1), 'no máximo um acerto por jogador por impacto');
        } else if (e.state === 'attack') {
            assert.deepEqual(delta, [0, 0], 'dano só no impacto');
        }
    }
    assert.equal(impacts, cfg.count, 'um impacto por salto');
    assert.equal(launched.length, cfg.count);
    launched.forEach((mark, i) => {
        assert.ok(Math.abs(landed[i].x - mark.x) < 1e-9 && Math.abs(landed[i].y - mark.y) < 1e-9, `aterrissa na marca fixada do salto ${i + 1}`);
    });
    landed.forEach((point, i) => assert.ok(i % 2 === 0 ? point.x < 0 : point.x > 0, 'alterna entre os dois jogadores'));
    assert.equal(e.state, 'recover');
    assert.ok(Math.abs(e.recoverFrames - cfg.finalRecoverTicks / FLAME_GOLEM.phases[1].animationSpeedMultiplier) < 1e-9, 'recuperação final maior');
    assert.ok(e.recoverFrames > e.abilities.attack2.recoverTicks / FLAME_GOLEM.phases[1].animationSpeedMultiplier);
    assert.ok(ps.every(p => p.hits >= cfg.count), 'cada impacto atinge quem está no raio');
}
{
    // pose de espera também nos saltos: o primeiro e a pausa agachada seguram o mesmo quadro
    const e = create();
    e.hp = FLAME_GOLEM.secondPhaseHp; e._updatePhase();
    const ps = [dummy(-NEAR_SLAM), dummy(NEAR_SLAM)];
    startAttack2(e, ps);
    const fps = e.sprite.rows.attack2.fps, tell = e._tellFrame('attack2');
    for (let t = 0; t < 400 && e.state === 'windup'; t++) e.update(ps, () => {});
    assert.equal(e.state, 'attack');
    assert.equal(e.animTime, tell * fps, 'o primeiro salto parte da pose de espera');
    let sawPrep = false;
    for (let t = 0; t < 900 && e.state !== 'recover'; t++) {
        e.update(ps, () => {});
        if (e.slam?.phase === 'prep') {
            sawPrep = true;
            const expected = Math.min(tell, Math.floor(e.slam.t / fps));
            assert.equal(e._currentFrameIndex(e._currentAnim()), expected, 'ergue os braços e depois segura a pose entre os saltos');
        }
    }
    assert.ok(sawPrep);
}

// --- dano no ar não interrompe; morte cancela a sequência ---
{
    const e = create();
    e.hp = FLAME_GOLEM.secondPhaseHp; e._updatePhase();
    const ps = [dummy(-NEAR_SLAM), dummy(NEAR_SLAM)];
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
    const deathTicks = 6 * FLAME_GOLEM.deathTicksPerFrame;
    assert.equal(e.dyingDuration, deathTicks);
    e.hp = FLAME_GOLEM.secondPhaseHp; e._updatePhase();
    assert.equal(e.dyingDuration, deathTicks, 'fase 2 não acelera a morte');
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
    assert.equal(state.name, FLAME_GOLEM.name); assert.equal(state.max, FLAME_GOLEM.hp); assert.equal(state.hp, FLAME_GOLEM.hp);
    assert.equal(state.phaseAt, FLAME_GOLEM.secondPhaseHp / FLAME_GOLEM.hp);
    bar.update(0.016);
    assert.equal(bar.visible, true); assert.equal(bar.ratio, 1);
    const phase1Palette = bar.palette();

    const damage = Math.floor(FLAME_GOLEM.hp * 0.3);
    e.takeHit(damage, null);
    state = e.bossBarState; bar.update(0.016);
    assert.equal(bar.hp, FLAME_GOLEM.hp - damage);
    assert.ok(Math.abs(bar.ratio - (FLAME_GOLEM.hp - damage) / FLAME_GOLEM.hp) < 1e-9, 'reflete HP atual/máximo');
    assert.ok(bar.trail > bar.ratio, 'rastro de dano segue atrás');
    for (let i = 0; i < 100; i++) bar.update(0.05);
    assert.equal(bar.trail, bar.ratio);

    e.hp = FLAME_GOLEM.secondPhaseHp; e._updatePhase();
    state = e.bossBarState; bar.update(0.016);
    assert.equal(bar.phase, 2);
    assert.notDeepEqual(bar.palette(), phase1Palette, 'fase 2 esquenta as cores da barra');

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
    assert.equal(wide.hL, bar.plateHeight() + BOSS_BAR.plateGap + BOSS_BAR.barHeight + BOSS_BAR.padding * 2, 'altura inclui a placa de nome');
    assert.equal(wide.barTop, bar.plateHeight() + BOSS_BAR.plateGap, 'a barra fica abaixo da placa de nome');
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

console.log('Arauto das Brasas: resistência, aviso por animação, sombra, luz, brasas, fases, slams, morte, barra e vida infinita passaram.');
