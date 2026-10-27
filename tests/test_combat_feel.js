/**
 * test_combat_feel.js — game-feel dos acertos da serra (lógica pura, sem navegador).
 * Cobre MeleeEnemy (stagger, poise, knockback), CombatSystem (impacto, dedupe, eventos),
 * GameLoop (hit stop vs pause/slow-mo) e DamageNumber/ParticleSystem.
 */

import { MeleeEnemy } from '../js/entities/MeleeEnemy.js';
import { CombatSystem } from '../js/combat/CombatSystem.js';
import { GameLoop } from '../js/core/GameLoop.js';
import { ParticleSystem } from '../js/particles/ParticleSystem.js';
import { DamageNumber } from '../js/particles/DamageNumber.js';
import { ENEMY_HIT, HIT_FEEL, DAMAGE_NUMBER } from '../js/config/CombatFeelConfig.js';
import { HIT_STOP, HIT_SLOWMO, SIM_STEP, TILE } from '../js/config/GameConfig.js';
import { DEMO_ENEMY_STATS } from '../js/config/DemoCombatConfig.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`✅ PASSOU: ${message}`);
        passed++;
    } else {
        console.error(`❌ FALHOU: ${message}`);
        failed++;
    }
}

const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

function makeSprite(combat) {
    return {
        cellSize: 100, cropX: 0, cropY: 0, cropW: 32, cropH: 32, drawHeight: 64,
        rows: {
            walk: { row: 0, frames: 4, fps: 6 },
            attack: { row: 1, frames: 4, fps: 6, hitFrame: 2 },
            death: { row: 2, frames: 4, fps: 6 }
        },
        combat
    };
}

const FAR_PLAYERS = [{ x: 5000, y: 5000, takeDamage: () => false }, { x: 5100, y: 5000, takeDamage: () => false }];
const makeEnemy = (combat, x = 300, y = 300) => new MeleeEnemy(x, y, null, makeSprite(combat), 1);
const tick = (e, n) => { for (let i = 0; i < n; i++) e.update(FAR_PLAYERS, () => {}); };

// --- config ---
{
    for (const [tier, s] of Object.entries(HIT_FEEL.hitStop)) {
        assert(s >= HIT_STOP.min && s <= HIT_STOP.max, `hit stop "${tier}" (${s}s) dentro de ${HIT_STOP.min}–${HIT_STOP.max}s`);
    }
    assert(HIT_STOP.min >= 0.02 && HIT_STOP.max <= 0.10, "limites do hit stop respeitam 0,02–0,10 s");
    for (const steps of [ENEMY_HIT.flash.steps, ENEMY_HIT.flash.breakSteps]) {
        const s = steps * SIM_STEP;
        assert(s >= 0.05 && s <= 0.10 + 1e-9, `flash de ${steps} passos = ${s.toFixed(3)}s dentro de 0,05–0,10 s`);
    }
    assert(DEMO_ENEMY_STATS.tank.hp > 1 && DEMO_ENEMY_STATS.tank.poise > 0, "tanque é forte: vida > 1 e poise configurada");
}

// --- MeleeEnemy: inimigo comum e chamadas legadas ---
{
    const e = makeEnemy({ hp: 1 });
    const r = e.takeHit(1, { dirX: 1, dirY: 0 });
    assert(r && r.killed && r.damage === 1 && e.state === "dying", "inimigo comum morre com um acerto");
    assert(e.pushVx === 0 && e.pushVy === 0, "morte prevalece: sem knockback no golpe que mata");

    const legacy = makeEnemy({ hp: 3 });
    const lr = legacy.takeHit();
    assert(lr && lr.damage === 1 && legacy.hp === 2 && legacy.state === "chase", "takeHit() sem info de impacto só desconta vida (compatível)");
}

// --- MeleeEnemy: stagger, cooldown, interrupção ---
{
    const e = makeEnemy({ hp: 4, poise: 0 });
    const r = e.takeHit(1, { dirX: 1, dirY: 0 });
    assert(r && !r.killed && r.staggered && !r.poiseBroken, "sobrevivente reage com stagger sem romper poise");
    assert(e.state === "hurt" && e.hp === 3, "entra em hurt e desconta a vida correta");
    assert(e.flashTimer > 0 && e.pushVx > 0 && near(e.pushVy, 0), "flash ligado e empurrão para longe da fonte (+x)");
    assert(e.takeHit(1, { dirX: 1, dirY: 0 }) === false && e.hp === 3, "segundo golpe no cooldown é recusado sem dano");
    tick(e, ENEMY_HIT.stagger.steps);
    assert(e.state === "chase", "hurt termina e retoma a perseguição");
    assert(e.takeHit(1, { dirX: 1, dirY: 0 }) === false, "ainda em cooldown depois do hurt");
    tick(e, ENEMY_HIT.cooldownSteps - ENEMY_HIT.stagger.steps);
    assert(e.takeHit(1, { dirX: 1, dirY: 0 }) !== false, "cooldown acaba e o golpe volta a valer");

    const w = makeEnemy({ hp: 2 });
    w.state = "windup"; w.stateTimer = 10; w.dealtHit = false; w.justAttacked = true;
    w.takeHit(1, { dirX: 0, dirY: 1 });
    assert(w.state === "hurt" && w.justAttacked === false, "golpe interrompe wind-up");
    const a = makeEnemy({ hp: 2 });
    a.state = "attack"; a.currentAttack = "attack"; a.stateTimer = 12; a.animTime = 3; a.dealtHit = false;
    a.takeHit(1, { dirX: 0, dirY: 1 });
    let hurtPlayer = false;
    const target = [{ x: a.x, y: a.y, takeDamage: () => { hurtPlayer = true; return true; } }, { x: 9000, y: 9000, takeDamage: () => false }];
    for (let i = 0; i < 40; i++) a.update(target, () => {});
    assert(!hurtPlayer, "ataque interrompido não causa dano ao jogador");

    const f = makeEnemy({ hp: 3 });
    f.beginFrozenSpawn(30);
    assert(f.takeHit(1, { dirX: 1, dirY: 0 }) === false, "inimigo congelado no spawn não recebe golpe");
}

// --- MeleeEnemy: poise e vulnerabilidade ---
{
    const e = makeEnemy({ hp: 4, poise: 3 });
    const hit = { dirX: -1, dirY: 0 };
    const gap = () => tick(e, ENEMY_HIT.cooldownSteps);
    const r1 = e.takeHit(1, hit); gap();
    const r2 = e.takeHit(1, hit); gap();
    assert(!r1.poiseBroken && !r2.poiseBroken && e.poise === 1 && e.hp === 2, "poise cai a cada golpe sem romper antes do limite");
    const pushBefore = Math.hypot(e.pushVx, e.pushVy);
    const r3 = e.takeHit(1, hit);
    assert(r3.poiseBroken && e.state === "stunned" && e.hp === 1, "poise rompe no limite configurado e atordoa");
    assert(e.poise === e.poiseMax, "poise reinicia ao romper");
    assert(e.stateTimer === ENEMY_HIT.poise.breakSteps && ENEMY_HIT.poise.breakSteps > ENEMY_HIT.stagger.steps, "stun longo é maior que o stagger");
    assert(Math.hypot(e.pushVx, e.pushVy) > pushBefore && e.pushVx < 0, "ruptura empurra mais forte, para longe da fonte");
    assert(e.vulnerableTimer === ENEMY_HIT.poise.vulnerableSteps, "abre a janela de vulnerabilidade");

    tick(e, ENEMY_HIT.cooldownSteps);
    assert(e.state === "stunned", "ainda atordoado quando o cooldown acaba");
    const r4 = e.takeHit(1, hit);
    assert(r4.vulnerable && r4.damage === ENEMY_HIT.poise.vulnerableDamageMult && r4.killed, "dano multiplicado na janela vulnerável (número real = dano aplicado)");

    const s = makeEnemy({ hp: 6, poise: 1 });
    s.takeHit(1, hit);
    tick(s, ENEMY_HIT.poise.breakSteps);
    assert(s.state === "chase", "stun não prende o inimigo para sempre");
    tick(s, ENEMY_HIT.poise.vulnerableSteps);
    assert(s.vulnerableTimer === 0, "vulnerabilidade expira");

    const g = makeEnemy({ hp: 6, poise: 3 });
    g.takeHit(1, hit);
    tick(g, ENEMY_HIT.poise.regenDelaySteps + 2);
    assert(g.poise === g.poiseMax, "poise regenera depois de um tempo sem golpes");
}

// --- MeleeEnemy: knockback não atravessa buraco ---
{
    const rows = 7, cols = 7;
    const floor = Array.from({ length: rows }, () => Array(cols).fill(16));
    floor[3][4] = -1;
    const bounds = { minX: TILE, minY: TILE, maxX: TILE * 6, maxY: TILE * 6 };
    const e = makeEnemy({ hp: 4, poise: 3 }, TILE + 2.5 * TILE, TILE + 2.5 * TILE);
    e.setNavigationFloor(floor, bounds, []);
    e.takeHit(1, { dirX: 1, dirY: 0 });
    tick(e, 30);
    const holeStart = TILE + 3 * TILE;
    assert(e.x < holeStart && e._isWalkable(e.x, e.y), "empurrão para o buraco para na beirada");
    assert(e.x > TILE + 2.5 * TILE, "empurrão ainda anda até a beirada");
}

// --- CombatSystem ---
function makeCombat(opts = {}) {
    const log = { shakes: [], numbers: [], sparks: [], blood: [], hitBlood: [], dust: [], flash: [], audio: [], ducks: [], weaponHits: 0 };
    const renderer = { triggerShake: (v) => log.shakes.push(v) };
    const particleSystem = {
        triggerBlood: (...a) => log.blood.push(a),
        triggerHitBlood: (...a) => log.hitBlood.push(a),
        triggerHitSparks: (...a) => log.sparks.push(a),
        triggerFlash: (...a) => log.flash.push(a),
        triggerDust: (...a) => log.dust.push(a),
        triggerDamageNumber: (...a) => log.numbers.push(a)
    };
    const audio = { play: (name, o) => { log.audio.push([name, o]); return null; }, duck: (db) => log.ducks.push(db) };
    const combat = new CombatSystem({ renderer, particleSystem, audio, ...opts });
    const weapon = {
        hitThreshold: 14, discRadius: 32,
        getSawPositions: () => [{ x: 300, y: 300 }],
        onHit: () => { log.weaponHits++; }
    };
    return { combat, weapon, log };
}
const P1 = { x: 200, y: 300 };
const P2 = { x: 400, y: 300 };

{
    const { combat, weapon, log } = makeCombat({ hitFeedback: true });
    const e = makeEnemy({ hp: 1 }, 300, 340);
    const hits = []; const kills = [];
    combat.resolveWeaponHits(weapon, [e], P1, P2, true, (en) => kills.push(en), (en, info) => hits.push(info));
    assert(hits.length === 1 && kills.length === 1 && kills[0] === e, "acerto que mata dispara onHit e onKill uma vez");
    const i = hits[0];
    assert(i.killed && i.tier === "kill" && i.damage === 1, "info do abate: tier kill e dano real");
    assert(near(i.x, 300) && near(i.y, 332) && near(i.dirX, 0) && near(i.dirY, 1), "impacto do disco fica na borda do disco voltada ao inimigo");
    assert(i.hitStop >= HIT_STOP.min && i.hitStop <= HIT_STOP.max, "hit stop pedido dentro do intervalo");
    assert(log.numbers.length === 1 && log.numbers[0][2] === 1, "um número de dano com o valor real");
    assert(log.shakes.length === 1 && log.shakes[0] === HIT_FEEL.shake.kill, "tremor de abate");
    assert(log.sparks.length === 1 && log.sparks[0][2] === 0 && log.sparks[0][3] === 1, "faíscas direcionais saem na direção do golpe");
    assert(log.audio.filter(([n]) => n === "sawHit").length === 1, "sawHit toca uma vez");
    assert(log.weaponHits === 1, "weapon.onHit chamado uma vez");
    assert(log.blood.length === 1, "abate mantém o sangue existente");
}

{
    const { combat, weapon, log } = makeCombat({ hitFeedback: true });
    const e = makeEnemy({ hp: 4, poise: 3 }, 330, 300);
    const kills = []; const hits = [];
    combat.resolveWeaponHits(weapon, [e], P1, P2, true, (en) => kills.push(en), (en, info) => hits.push(info));
    assert(hits.length === 1 && kills.length === 0, "golpe que não mata não dispara onKill");
    assert(hits[0].tier === "hit" && hits[0].staggered && e.state === "hurt", "inimigo forte sobrevive e entra em hurt");
    assert(near(hits[0].x, 330) && near(hits[0].dirX, 1), "impacto do disco quando o inimigo está dentro do raio");
    assert(log.hitBlood.length === 1 && log.dust.length === 1, "sangue direcional e poeira no contato");
    assert(log.shakes[0] === HIT_FEEL.shake.hit, "tremor moderado de acerto");

    const before = { numbers: log.numbers.length, audio: log.audio.length, shakes: log.shakes.length, w: log.weaponHits };
    for (let n = 0; n < 5; n++) combat.resolveWeaponHits(weapon, [e], P1, P2, true, (en) => kills.push(en), (en, info) => hits.push(info));
    assert(hits.length === 1 && log.numbers.length === before.numbers && log.audio.length === before.audio
        && log.shakes.length === before.shakes && log.weaponHits === before.w && e.hp === 3,
        "contato contínuo no cooldown não repete dano, número, som ou efeitos");
}

{
    const { combat, weapon, log } = makeCombat({ hitFeedback: true });
    const e = makeEnemy({ hp: 4, poise: 3 }, 330, 300);
    const infos = [];
    for (let n = 0; n < 3; n++) {
        // o empurrão afasta o inimigo da serra; o teste a mantém encostada, como o jogador fazendo perseguição
        e.x = 330; e.y = 300;
        combat.resolveWeaponHits(weapon, [e], P1, P2, true, null, (en, info) => infos.push(info));
        tick(e, ENEMY_HIT.cooldownSteps);
    }
    const last = infos[2];
    assert(infos.length === 3 && last.poiseBroken && last.tier === "poiseBreak", "terceiro golpe rompe a poise");
    assert(last.hitStop === HIT_FEEL.hitStop.poiseBreak && last.hitStop >= infos[0].hitStop, "ruptura pede hit stop maior");
    const heavy = log.audio.filter(([n]) => n === "sawHit").pop()[1];
    assert(heavy.rateMultiplier < 1 && heavy.volumeMultiplier > 1, "ruptura usa sawHit mais grave e mais alto");
    assert(log.ducks[log.ducks.length - 1] === -9, "ruptura abaixa mais a ambiência");
}

{
    const { combat, weapon, log } = makeCombat({ hitFeedback: true });
    const e = makeEnemy({ hp: 2 }, 240, 330);
    const infos = [];
    combat.resolveWeaponHits(weapon, [e], P1, P2, true, null, (en, info) => infos.push(info));
    assert(infos.length === 1 && near(infos[0].x, 240) && near(infos[0].y, 300) && near(infos[0].dirY, 1), "impacto do cabo é o ponto mais próximo no segmento");
}

{
    const { combat, weapon } = makeCombat({ hitFeedback: true });
    const e = makeEnemy({ hp: 2 }, 330, 300);
    let called = 0;
    combat.resolveWeaponHits(weapon, [e], P1, P2, false, () => called++, () => called++);
    assert(called === 0 && e.hp === 2, "cabo desconectado não acerta");
}

{
    const { combat, weapon, log } = makeCombat();
    const e = makeEnemy({ hp: 1 }, 330, 300);
    let kills = 0;
    combat.resolveWeaponHits(weapon, [e], P1, P2, true, () => kills++);
    assert(kills === 1 && log.numbers.length === 0 && log.sparks.length === 0 && log.shakes[0] === 10, "sem hitFeedback o comportamento antigo é preservado (trailers)");
}

// --- GameLoop: hit stop ---
{
    const queue = [];
    globalThis.requestAnimationFrame = (fn) => { queue.push(fn); return queue.length; };
    let steps = 0, renders = 0, frames = 0;
    const loop = new GameLoop({ onStep: () => steps++, onRender: () => renders++, onFrameStart: () => frames++ });
    let now = 0;
    const frame = (ms = 1000 / 60) => { now += ms; queue.shift()(now); };
    loop.start();
    frame(0);
    for (let i = 0; i < 10; i++) frame();
    assert(steps >= 9 && steps <= 10, "sem hit stop a simulação avança um passo por frame");

    assert(loop.triggerHitStop(0.5) === true, "hit stop aceito");
    assert(loop._hitStopT <= HIT_STOP.max + 1e-9, "duração pedida alta é limitada ao máximo");
    const s0 = steps, r0 = renders, f0 = frames;
    let frozen = 0;
    while (loop.hitStopActive && frozen < 20) { frame(); frozen++; }
    assert(steps === s0, "simulação parada durante o hit stop");
    assert(renders - r0 === frozen && frames - f0 === frozen, "render e polling de entrada seguem ativos durante o hit stop");
    assert(frozen >= 2 && frozen <= 7, `hit stop máximo dura entre 2 e 7 frames (${frozen})`);
    frame(); frame();
    assert(steps > s0, "simulação retoma depois do hit stop");

    assert(loop.triggerHitStop(0.05) === false, "novo hit stop logo após o anterior é recusado (folga mínima)");
    for (let i = 0; i < 8; i++) frame();
    assert(loop.triggerHitStop(0.001) === true && loop._hitStopT >= HIT_STOP.min, "duração pedida baixa é elevada ao mínimo");
    while (loop.hitStopActive) frame();
    for (let i = 0; i < 8; i++) frame();

    // composição com slow-mo de abate: o congelamento vem primeiro, o slow-mo toca inteiro depois
    loop.triggerHitStop(0.07);
    loop.triggerHitSlowmo();
    while (loop.hitStopActive) frame();
    assert(near(loop._slowmoT, HIT_SLOWMO.duration, 1e-9), "slow-mo não decai durante o hit stop");
    assert(loop.timeScale < 1, "slow-mo começa depois do hit stop");
    for (let i = 0; i < 40; i++) frame();
    assert(loop._slowmoT === 0 && loop.timeScale === 1, "slow-mo termina e o tempo volta ao normal");

    // pause
    for (let i = 0; i < 8; i++) frame();
    loop.triggerHitStop(0.09);
    loop.setPaused(true);
    assert(!loop.hitStopActive && loop.paused, "pausar cancela o hit stop restante");
    const s1 = steps;
    for (let i = 0; i < 20; i++) frame();
    assert(loop.paused && steps === s1, "pausa continua pausada depois do tempo do hit stop");
    assert(loop.triggerHitStop(0.05) === false, "hit stop não é aceito com o jogo pausado");
    loop.setPaused(false);
    for (let i = 0; i < 30; i++) frame();
    assert(!loop.paused && steps > s1, "despausar retoma a simulação");
}

// --- Número de dano e ParticleSystem ---
{
    const ps = new ParticleSystem(null);
    for (let i = 0; i < DAMAGE_NUMBER.max + 10; i++) ps.triggerDamageNumber(100, 100, 1);
    assert(ps.damageNumbers.length === DAMAGE_NUMBER.max, "números de dano têm limite");
    const n = new DamageNumber(0, 0, 3);
    const y0 = n.y;
    n.update();
    assert(n.y < y0, "número sobe");
    for (let i = 0; i < DAMAGE_NUMBER.lifeSteps; i++) n.update();
    assert(n.done, "número some depois da vida configurada");

    const calls = [];
    const ctx = new Proxy({}, { get: (_, k) => (k === "fillRect" ? (...a) => calls.push(a) : () => {}), set: () => true });
    new DamageNumber(0, 0, 12).draw(ctx);
    assert(calls.length > 0, "número é desenhado com a fonte pixel");

    ps.update([], null);
    ps.clear();
    assert(ps.damageNumbers.length === 0 && !ps.hasDamageNumbers, "clear() limpa os números de dano");
    ps.triggerHitSparks(10, 10, 1, 0, 5, 1, 0.5);
    assert(ps.sparks.length === 5 && ps.sparks.every(s => s.vx > 0), "faíscas direcionais seguem a direção do golpe");
    ps.triggerHitBlood(10, 10, 1, 0, 4, 0.8);
    assert(ps.airParticles.length === 4, "sangue direcional criado");
}

console.log(`\n${passed} passaram, ${failed} falharam.`);
process.exit(failed ? 1 : 0);
