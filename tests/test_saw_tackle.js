import assert from 'node:assert/strict';
import { SawTackle } from '../js/systems/SawTackle.js';
import { sawGap } from '../js/systems/StakeRope.js';
import { DroppedSawPush } from '../js/systems/DroppedSawPush.js';
import { SawDrag } from '../js/systems/SawDrag.js';
import { Chain } from '../js/core/Chain.js';
import { SawWeapon } from '../js/weapons/SawWeapon.js';
import { Player } from '../js/entities/Player.js';
import { SpawnSystem } from '../js/systems/SpawnSystem.js';
import { CHAIN } from '../js/config/ChainConfig.js';
import { SAW_TACKLE } from '../js/config/SawTackleConfig.js';
import { FLAME_GOLEM } from '../js/config/FlameGolemConfig.js';
import { PLAYER_DASH, SIM_HZ } from '../js/config/GameConfig.js';

const BOUNDS = { minX: 0, minY: 0, maxX: 2000, maxY: 2000 };
const FREEZE = Math.max(1, Math.round(SAW_TACKLE.hitStopSeconds * SIM_HZ));
const INTERVAL = Math.max(1, Math.round(SAW_TACKLE.hitIntervalSeconds * SIM_HZ));

const player = (x, y, extra = {}) => ({
    x, y, vx: 0, vy: 0, dashing: false, dashDirX: 1, dashDirY: 0, hitRadius: 16, lives: 3, falling: false,
    tackles: 0,
    startTackle(dx, dy) { this.tackles++; this.dashing = false; this.vx = this.vy = 0; this.lastTackle = { dx, dy }; },
    ...extra
});
const dashing = (p, dx = 1, dy = 0) => {
    const m = Math.hypot(dx, dy);
    Object.assign(p, { dashing: true, dashDirX: dx / m, dashDirY: dy / m, vx: dx / m * PLAYER_DASH.speed, vy: dy / m * PLAYER_DASH.speed });
};
const enemy = (x, y, extra = {}) => ({
    x, y, hitRadius: 20, hp: 50, state: 'chase', accepted: 0, attempts: 0,
    takeHit(d) {
        this.attempts++;
        if (this.reject?.()) return false;
        this.hp -= d; this.accepted++;
        if (this.hp <= 0) { this.state = 'dying'; return { damage: d, killed: true }; }
        return { damage: d, killed: false };
    },
    ...extra
});
const setup = ({ sawX = 1000, sawY = 1000, enemies = [], cfg = {}, isSolid = () => false, players = null } = {}) => {
    const chain = new Chain([new SawWeapon()], CHAIN);
    chain.spawnSaw(sawX, sawY);
    const p1 = players?.[0] ?? player(sawX - 28, sawY), p2 = players?.[1] ?? player(sawX - 900, sawY + 600);
    const room = { enemies, wallBoxes: [] };
    const log = { hits: [], drops: [] };
    const tackle = new SawTackle({
        chain, getPlayers: () => [p1, p2], getRoom: () => room, getBounds: () => BOUNDS, isSolid,
        safeDrop: (x, y) => { log.drops.push({ x, y }); return { x, y }; },
        onEnemyHit: (e, result) => log.hits.push({ e, result }),
        cfg: { ...SAW_TACKLE, ...cfg }
    });
    return { chain, w: chain.weapon, p1, p2, room, tackle, log };
};
const run = (tackle, n, each = null) => { for (let i = 0; i < n; i++) { each?.(i); tackle.update(); } };
const untilState = (tackle, state, max = 600, each = null) => {
    for (let i = 0; i < max && tackle.state !== state; i++) { each?.(i); tackle.update(); }
    return tackle.state === state;
};

// --- ativação: só com dash; andando não dispara ---
{
    const { tackle, p1, w } = setup();
    p1.vx = 4; tackle.update();
    assert.equal(tackle.state, null, 'contato andando não faz tackle');
    dashing(p1);
    tackle.update();
    assert.equal(tackle.state, 'impact');
    assert.equal(p1.tackles, 1);
    assert.equal(w.sawLocked, true, 'travada no impacto');
    assert.equal(w.tackleState, 'impact');
    run(tackle, FREEZE - 1);
    assert.equal(tackle.state, 'impact', 'hit stop local dura o configurado');
    tackle.update();
    assert.equal(tackle.state, 'flight');
    assert.ok(tackle.vx > 0 && Math.abs(tackle.vy) < 1e-9, 'parte na direção do dash');
    assert.equal(w.sawLocked, false, 'em voo não fica travada');
}

// --- um dash produz um tackle só; empate de dois dashes fica com um ---
{
    const p1 = player(975, 1000), p2 = player(1025, 1000);
    const { tackle } = setup({ players: [p1, p2] });
    dashing(p1, 1, 0); dashing(p2, -1, 0);
    tackle.update();
    assert.equal(p1.tackles + p2.tackles, 1, 'dois dashes no mesmo passo: um lançamento');
    assert.equal(p1.tackles, 1, 'empate de distância fica com o P1');
}

// --- mira assistida: corrige para inimigo à frente; não mira atrás nem através de parede ---
{
    const ahead = enemy(1300, 1060);
    const s = setup({ enemies: [ahead] });
    dashing(s.p1); s.tackle.update();
    const aim = s.tackle.pending;
    assert.ok(aim.y > 0 && aim.x > 0, 'puxa para o inimigo à frente');
    assert.ok(Math.atan2(aim.y, aim.x) <= SAW_TACKLE.aimMaxTurnDeg * Math.PI / 180 + 1e-9, 'correção limitada');

    const behind = setup({ enemies: [enemy(700, 1000)] });
    dashing(behind.p1); behind.tackle.update();
    assert.deepEqual(behind.tackle.pending, { x: 1, y: 0 }, 'não mira atrás');

    const walled = setup({ enemies: [enemy(1300, 1060)], isSolid: (x) => x > 1150 && x < 1170 });
    dashing(walled.p1); walled.tackle.update();
    assert.deepEqual(walled.tackle.pending, { x: 1, y: 0 }, 'não escolhe alvo atrás de parede');
}

// --- presa: exatamente N acertos aceitos (5 e 10), segue o inimigo, depois continua ---
for (const hits of [5, 10]) {
    const e = enemy(1250, 1000);
    let attempt = 0;
    e.reject = () => (++attempt % 3 === 0);
    const s = setup({ enemies: [e], cfg: { hits } });
    dashing(s.p1); s.tackle.update();
    assert.ok(untilState(s.tackle, 'stuck'), 'prende no inimigo');
    assert.equal(s.w.sawLocked, true);
    assert.equal(s.chain._canReconnect({ x: s.w.dropX, y: s.w.dropY }, { x: s.w.dropX, y: s.w.dropY }, 0), false, 'presa: sem reconexão');
    const ox = s.w.dropX - e.x;
    e.x += 30; s.tackle.update();
    assert.ok(Math.abs(s.w.dropX - e.x - ox) < 1e-9, 'acompanha o inimigo que se move');
    assert.ok(untilState(s.tackle, 'flight', 400), 'solta depois dos acertos');
    assert.equal(e.accepted, hits, `exatamente ${hits} acertos aceitos`);
    assert.ok(e.attempts > hits, 'tentativas recusadas não contam');
    assert.equal(s.log.hits.length, hits, 'feedback só nos aceitos');
    assert.ok(s.tackle.vx > 0, 'continua na direção em que vinha');
    run(s.tackle, 200);
    assert.equal(e.accepted, hits, 'mesmo inimigo não é atingido de novo no mesmo lançamento');
}
{
    // intervalo entre acertos
    const e = enemy(1250, 1000);
    const s = setup({ enemies: [e] });
    dashing(s.p1); s.tackle.update();
    untilState(s.tackle, 'stuck');
    s.tackle.update();
    assert.equal(e.accepted, 1, 'primeiro acerto no contato');
    run(s.tackle, INTERVAL - 1);
    assert.equal(e.accepted, 1);
    s.tackle.update();
    assert.equal(e.accepted, 2, `próximo acerto após ${SAW_TACKLE.hitIntervalSeconds} s`);
}
{
    // morte antes do total: solta na hora
    const e = enemy(1250, 1000, { hp: 2 });
    const s = setup({ enemies: [e] });
    dashing(s.p1); s.tackle.update();
    untilState(s.tackle, 'stuck');
    run(s.tackle, INTERVAL * 2 + 1);
    assert.equal(s.tackle.state, 'flight', 'inimigo morto solta a serra');
    assert.equal(e.accepted, 2);
}
{
    // alvo que nunca aceita: não fica presa para sempre
    const e = enemy(1250, 1000, { reject: () => true });
    const s = setup({ enemies: [e] });
    dashing(s.p1); s.tackle.update();
    untilState(s.tackle, 'stuck');
    run(s.tackle, Math.round(SAW_TACKLE.stuckMaxWaitSeconds * SIM_HZ) + 2);
    assert.equal(s.tackle.state, 'flight', 'sem acerto aceito por muito tempo: solta');
}
{
    // vários inimigos no trajeto, uma vez cada
    const a = enemy(1200, 1000), b = enemy(1500, 1000);
    const s = setup({ enemies: [a, b] });
    dashing(s.p1); s.tackle.update();
    run(s.tackle, 300);
    assert.equal(a.accepted, SAW_TACKLE.hits);
    assert.equal(b.accepted, SAW_TACKLE.hits);
}

// --- quiques e volta para a origem ---
{
    const s = setup({ sawX: 1700, sawY: 1000 });
    dashing(s.p1); s.tackle.update();
    let bounced = false;
    for (let i = 0; i < 600 && s.tackle.state; i++) { s.tackle.update(); if (s.tackle.vx < 0) bounced = true; }
    assert.ok(bounced, 'quica na parede');
    assert.equal(s.tackle.state, null, 'termina o voo');
    const end = s.log.drops.at(-1);
    assert.ok(Math.hypot(end.x - 1700, end.y - 1000) < SAW_TACKLE.arriveRadius + SAW_TACKLE.speed, 'cai perto da origem');
}
{
    // sem conseguir voltar: duração máxima e queda segura
    const s = setup({ cfg: { returnTurnRate: 0 } });
    dashing(s.p1, 1, 0.37); s.tackle.update();
    run(s.tackle, FREEZE + SAW_TACKLE.maxFlightSteps + 2);
    assert.equal(s.tackle.state, null);
    assert.equal(s.log.drops.length, 1, 'queda pelo piso seguro');
}

// --- reconexão e re-tackle em voo ---
{
    const s = setup();
    dashing(s.p1); s.tackle.update();
    untilState(s.tackle, 'flight');
    const near = { x: s.w.dropX, y: s.w.dropY };
    assert.equal(s.chain._canReconnect(near, near, 0), true, 'em voo reconecta');
    s.chain.reset();
    s.tackle.update();
    assert.equal(s.tackle.state, null, 'reconectar encerra o voo');
    assert.equal(s.w.tackleState, null);
}
{
    const e = enemy(1250, 1000);
    const s = setup({ enemies: [e] });
    dashing(s.p1); s.tackle.update();
    run(s.tackle, 120);
    assert.equal(e.accepted, SAW_TACKLE.hits);
    assert.equal(s.tackle.state, 'flight');
    const p = s.p2;
    p.x = s.w.dropX + 30; p.y = s.w.dropY;
    dashing(p, -1, 0); s.tackle.update();
    assert.equal(p.tackles, 1, 're-tackle em voo');
    assert.deepEqual(s.tackle.origin, { x: s.w.dropX, y: s.w.dropY }, 'nova origem no ponto da colisão');
    assert.equal(s.tackle.processed.size, 0, 'novo lançamento esquece os alvos anteriores');
}
{
    // presa: dash não faz tackle
    const e = enemy(1250, 1000);
    const s = setup({ enemies: [e] });
    dashing(s.p1); s.tackle.update();
    untilState(s.tackle, 'stuck');
    const p = s.p2;
    p.x = s.w.dropX - 30; p.y = s.w.dropY;
    dashing(p, 1, 0); s.tackle.update();
    assert.equal(p.tackles, 0, 'presa não aceita tackle');
    assert.equal(s.tackle.state, 'stuck');
}

// --- Arauto: prende na superfície, volta direto (ou cai no local) ---
const arauto = (x, y) => enemy(x, y, {
    effectMaterial: 'lavaStone', immovable: true, ignoresEntityCollisions: false, hp: 100,
    collisionBodies: [{ x: 0, y: 0, radiusX: 48, radiusY: 30 }]
});
{
    const boss = arauto(1300, 1000);
    const s = setup({ enemies: [boss] });
    dashing(s.p1); s.tackle.update();
    assert.ok(untilState(s.tackle, 'stuck'));
    const r = s.w.discRadius * SAW_TACKLE.enemyContactScale;
    assert.ok(Math.hypot((s.w.dropX - boss.x) / (48 + r), (s.w.dropY - boss.y) / (30 + r)) >= 1, 'fica na superfície, sem atravessar');
    untilState(s.tackle, 'flight', 200);
    assert.equal(boss.accepted, SAW_TACKLE.hits);
    assert.equal(s.tackle.specialReturn, true);
    assert.ok(s.tackle.vx < 0, 'volta direto para a origem');
    run(s.tackle, 200);
    assert.equal(s.tackle.state, null);
    assert.equal(boss.accepted, SAW_TACKLE.hits, 'a volta não repete o Arauto');
}
{
    const boss = arauto(1300, 1000);
    const s = setup({ enemies: [boss], cfg: { arautoAfterHits: 'drop' } });
    dashing(s.p1); s.tackle.update();
    untilState(s.tackle, 'stuck');
    run(s.tackle, INTERVAL * SAW_TACKLE.hits + 2);
    assert.equal(s.tackle.state, null, "opção 'drop': cai junto ao contato");
    assert.ok(Math.hypot(s.w.dropX - boss.x, s.w.dropY - boss.y) < 120);
}

// --- ataques do Arauto lançam a serra solta no impacto ---
{
    const boss = arauto(1000, 1100);
    boss.abilities = { attack2: { radius: FLAME_GOLEM.attacks.attack2.radius } };
    const s = setup({ enemies: [boss] });
    boss.currentAttack = 'attack2'; boss.slamMode = false;
    s.tackle.onBossImpacts([boss]);
    assert.equal(s.tackle.state, null, 'sem impacto (aviso), não lança');
    boss.justGroundHit = true;
    s.tackle.onBossImpacts([boss]);
    assert.equal(s.tackle.state, 'flight');
    assert.equal(s.tackle.mode, 'boss');
    assert.ok(s.tackle.vy < 0, 'radial, para longe do centro do impacto');
    run(s.tackle, 300);
    assert.equal(boss.accepted, 0, 'não fere o próprio Arauto que lançou');
    assert.equal(s.tackle.state, null, 'para e cai em piso seguro');
}
{
    const boss = arauto(1000, 1000);
    const s = setup({ enemies: [boss] });
    boss.justSlammed = true;
    s.tackle.onBossImpacts([boss]);
    assert.ok(s.tackle.vy > 0 && Math.abs(s.tackle.vx) < 1e-9, 'serra no centro: direção fixa para baixo');
    const far = setup({ sawX: 1000, sawY: 1500, enemies: [boss] });
    far.tackle.onBossImpacts([boss]);
    assert.equal(far.tackle.state, null, 'fora da área do golpe não lança');
    const melee = setup({ sawX: 1000, sawY: 1050, enemies: [arauto(1000, 1000)] });
    const m = melee.room.enemies[0];
    m.justGroundHit = true; m.currentAttack = 'attack';
    melee.tackle.onBossImpacts([m]);
    assert.equal(melee.tackle.state, 'flight', 'attack1 também lança a serra no impacto');
    assert.equal(melee.tackle.mode, 'boss');
    assert.ok(melee.tackle.vy > 0, 'attack1 empurra para longe do boss');
}
{
    const boss = arauto(1000, 1000);
    const s = setup({ sawY: 1050, enemies: [boss] });
    s.chain.reset();
    boss.justSlammed = true;
    s.tackle.onBossImpacts([boss]);
    assert.equal(s.tackle.state, null, 'serra conectada não é arrancada');
}

// --- dash do boss: contato varrido, impulso para a frente, sem repetição ---
{
    const boss = arauto(1400, 1000);
    boss.currentAttack = 'attack3'; boss.vx = 500; boss.vy = 0;
    boss.abilities = FLAME_GOLEM.attacks;
    const s = setup({ sawX: 1150, enemies: [boss] });
    s.tackle.onBossImpacts([boss]);
    assert.equal(s.tackle.state, null, 'aviso da investida não lança');
    boss.charging = true;
    s.tackle.onBossImpacts([boss]);
    assert.equal(s.tackle.mode, 'boss', 'detecta contato entre início e fim do passo');
    assert.equal(s.tackle.vx, SAW_TACKLE.bossLaunchSpeed, 'segue a investida mesmo com a serra atrás da posição final');
    assert.equal(s.tackle.vy, 0);
    s.tackle.update();
    const vx = s.tackle.vx;
    s.tackle.onBossImpacts([boss]);
    assert.equal(s.tackle.vx, vx, 'contato mantido não renova impulso em voo');
    const far = setup({ sawX: 1150, sawY: 1500, enemies: [boss] });
    far.tackle.onBossImpacts([boss]);
    assert.equal(far.tackle.state, null, 'fora da faixa da investida não lança');
    const wall = setup({ sawX: 1150, sawY: 1060, enemies: [boss], isSolid: (x,y) => y > 1020 && y < 1040 });
    wall.tackle.onBossImpacts([boss]);
    assert.equal(wall.tackle.state, null, 'parede protege a serra do dash');
}
{
    const boss = arauto(1000, 1000);
    boss.currentAttack = 'attack'; boss.abilities = FLAME_GOLEM.attacks;
    const near = setup({ sawY: 1050, enemies: [boss] });
    near.tackle.onBossImpacts([boss]);
    assert.equal(near.tackle.state, null, 'attack1 não lança durante aviso');
    boss.justGroundHit = true;
    near.tackle.onBossImpacts([boss]);
    assert.equal(near.tackle.state, 'flight');
    const far = setup({ sawY: 1400, enemies: [boss] });
    far.tackle.onBossImpacts([boss]);
    assert.equal(far.tackle.state, null, 'attack1 respeita alcance');
    const connected = setup({ sawY: 1050, enemies: [boss] });
    connected.chain.reset();
    connected.tackle.onBossImpacts([boss]);
    assert.equal(connected.tackle.state, null, 'attack1 não arranca serra conectada');
    const active = setup({ sawY: 1050, enemies: [boss] });
    dashing(active.p1); active.tackle.update();
    active.tackle.onBossImpacts([boss]);
    assert.equal(active.tackle.state, 'impact', 'golpe não substitui tackle já ativo');
}

for (const attack of ['attack', 'attack3']) {
    const spawn = new SpawnSystem({ assets: { get: () => ({ complete: true, naturalWidth: 1200 }) }, bloodCanvas: { palette: [] } });
    const boss = spawn.createEnemy(1000, 1000, 1, 'flameGolem');
    const p1 = new Player(attack === 'attack' ? 1050 : 1250, 1000, '#fff', [], null, 'P1');
    const p2 = new Player(1900, 1400, '#fff', [], null, 'P2');
    const s = setup({ sawX: attack === 'attack' ? 1050 : 1150, enemies: [boss], players: [p1, p2] });
    boss.forceAttack(attack);
    for (let i = 0; i < 240 && !s.tackle.active; i++) {
        boss.update([p1, p2], () => {});
        s.tackle.onBossImpacts([boss]);
    }
    assert.equal(s.tackle.mode, 'boss', `${attack}: entidade real emite contato que lança a serra`);
    assert.ok(s.tackle.vx > 0);
}

// --- empurrão e arraste ficam de fora enquanto o tackle está ativo ---
{
    const s = setup();
    dashing(s.p1); s.tackle.update();
    const push = new DroppedSawPush({ chain: s.chain, getPlayers: () => [s.p1, s.p2] });
    assert.equal(push._eligible(), false, 'sem empurrão duplicado');
    const drag = new SawDrag({ chain: s.chain, getPlayers: () => [s.p1, s.p2], input: { isDown: () => false }, getStats: () => ({}) });
    assert.equal(drag._eligible(), false, 'sem arraste durante o tackle');
}

// --- jogador: hit stop local, reação para trás, sem invulnerabilidade longa ---
{
    const input = { isDown: () => false };
    const p = new Player(0, 0, '#fff', ['w', 's', 'a', 'd', ' '], null, 'P1', { animated: false });
    p.dashing = true;
    p.startTackle(1, 0, { freezeSteps: FREEZE, reactionSteps: SAW_TACKLE.reactionSteps, recoilSpeed: SAW_TACKLE.recoilSpeed, invulnSteps: SAW_TACKLE.invulnSteps, impactScale: SAW_TACKLE.impactScale });
    assert.equal(p.dashing, false);
    assert.equal(p.dashCooldown, PLAYER_DASH.cooldownSteps, 'cooldown normal do dash');
    assert.equal(p.dashScale, SAW_TACKLE.impactScale, 'impact frame achatado');
    for (let i = 0; i < FREEZE - 1; i++) { p.update(input, null); assert.equal(p.x, 0, 'congelado no hit stop'); }
    p.update(input, null);
    assert.ok(p.vx < 0, 'reação para trás');
    p.update(input, null);
    assert.ok(p.x < 0);
    assert.ok(p.invulnerableTimer <= SAW_TACKLE.invulnSteps);
    for (let i = 0; i < SAW_TACKLE.reactionSteps + 1; i++) p.update(input, null);
    assert.equal(p.tackling, false);
    assert.equal(p.dashScale, 1);
}

// --- versão sem retorno: mantém o rumo depois de soltar um inimigo ---
{
    const e = enemy(450, 1000);
    const s = setup({ sawX: 200, enemies: [e], cfg: { flightMode: 'coast' } });
    s.p2.x = 1000; s.p2.y = 1000;
    dashing(s.p1); s.tackle.update();
    assert.ok(untilState(s.tackle, 'stuck'));
    assert.ok(untilState(s.tackle, 'flight'));
    const x = s.w.dropX;
    run(s.tackle, 70);
    assert.ok(s.w.dropX > x, 'sem retorno: continua para a frente após os hits');
    assert.ok(Math.abs(s.w.dropY - 1000) < 1e-8, 'sem retorno: não curva para tentar alcançar a origem');
    assert.equal(s.tackle.homing, null);
}

{
    const s = setup({ sawX: 200, cfg: { flightMode: 'coast', coastDistance: 30, coastFriction: 0.5 } });
    dashing(s.p1); s.tackle.update();
    untilState(s.tackle, 'flight');
    run(s.tackle, 1);
    assert.equal(s.tackle.vx, SAW_TACKLE.speed, 'antes da distância: velocidade de lançamento');
    run(s.tackle, 1);
    assert.equal(s.tackle.distance, 30);
    assert.equal(s.tackle.vx, SAW_TACKLE.speed * 0.5, 'atingiu a distância: começa a perder velocidade');
    run(s.tackle, 1);
    assert.equal(s.tackle.vx, SAW_TACKLE.speed * 0.25, 'não restaura velocidade no passo seguinte');
    const speed = s.tackle.vx;
    s.room.enemies.push(enemy(s.w.dropX + 10, s.w.dropY));
    assert.ok(untilState(s.tackle, 'stuck'));
    assert.ok(untilState(s.tackle, 'flight'));
    assert.equal(s.tackle.vx, speed, 'soltar inimigo preserva a velocidade já reduzida');
    run(s.tackle, 20);
    assert.equal(s.tackle.state, null);
    assert.equal(s.log.drops.length, 1, 'ao parar, cai em piso seguro');
}
{
    const s = setup({ sawX: 200, cfg: { flightMode: 'coast', coastDistance: 120 }, isSolid: x => x >= 260 });
    dashing(s.p1); s.tackle.update();
    untilState(s.tackle, 'flight');
    run(s.tackle, 9);
    assert.ok(s.tackle.vx < 0, 'parede ainda reflete a trajetória');
    assert.ok(s.tackle.distance >= 120 && s.tackle.distance > Math.abs(s.w.dropX - 200), 'soma percurso, incluindo quiques');
    assert.ok(Math.abs(s.tackle.vx) < SAW_TACKLE.speed);
    run(s.tackle, SAW_TACKLE.maxFlightSteps);
    assert.equal(s.tackle.state, null);
}
{
    const boss = arauto(450, 1000);
    const s = setup({ sawX: 200, enemies: [boss], cfg: { flightMode: 'coast' } });
    dashing(s.p1); s.tackle.update();
    assert.ok(untilState(s.tackle, 'stuck'));
    assert.ok(untilState(s.tackle, 'flight'));
    assert.equal(boss.accepted, SAW_TACKLE.hits);
    assert.equal(s.tackle.specialReturn, false, 'nova versão não força retorno após o Arauto');
    assert.ok(s.tackle.vx > 0, 'retoma o rumo de entrada');
    run(s.tackle, 2);
    assert.ok(s.tackle.vx < 0, 'corpo sólido já atingido faz quicar, sem atravessar o Arauto');
    assert.equal(s.tackle.homing, null);
    const r = s.w.discRadius * SAW_TACKLE.enemyContactScale;
    assert.ok(!s.tackle._insideBody(boss, s.w.dropX, s.w.dropY, r));
}
{
    const s = setup({ sawX: 200, cfg: { flightMode: 'coast', coastDistance: 30 } });
    dashing(s.p1); s.tackle.update();
    untilState(s.tackle, 'flight');
    run(s.tackle, 5);
    assert.ok(s.tackle.distance > 30);
    s.p2.x = s.w.dropX + 28; s.p2.y = s.w.dropY;
    dashing(s.p2, -1, 0); s.tackle.update();
    assert.equal(s.tackle.state, 'impact');
    untilState(s.tackle, 'flight');
    assert.equal(s.tackle.distance, 0, 'novo tackle reinicia percurso');
    assert.equal(s.tackle.vx, -SAW_TACKLE.speed, 'novo tackle renova a velocidade');
}

// --- serra encostada na parede: o tackle não deixa ela presa ---
for (const dir of [[1, 0], [-1, 0], [0, 1], [1, 1]]) {
    // Parede à direita em x ≥ 1020; a serra fica dentro da margem do voo (raio × wallContactScale ≈ 16 px).
    const s = setup({ sawX: 1012, sawY: 1000, isSolid: (x) => x >= 1020 });
    const m = Math.hypot(dir[0], dir[1]);
    s.p1.x = 1012 - dir[0] / m * 28; s.p1.y = 1000 - dir[1] / m * 28;
    dashing(s.p1, dir[0], dir[1]);
    s.tackle.update();
    assert.equal(s.p1.tackles, 1, `dash ${dir}: houve tackle`);
    let moved = 0;
    for (let i = 0; i < 400 && s.tackle.state; i++) {
        const x = s.w.dropX, y = s.w.dropY;
        s.tackle.update();
        moved += Math.hypot(s.w.dropX - x, s.w.dropY - y);
    }
    assert.equal(s.tackle.state, null, `dash ${dir}: o voo termina`);
    assert.ok(moved > 0, `dash ${dir}: a serra sai do lugar`);
    assert.ok(s.w.dropX < 1020, `dash ${dir}: termina fora da parede`);
}

// --- serra dentro do corpo do Arauto (braço que se mexeu, volta direta bloqueada) não fica presa ---
{
    const boss = arauto(1060, 1000);
    const s = setup({ sawX: 1040, sawY: 1000, enemies: [boss] });
    Object.assign(s.tackle, { processed: new Set([boss]), specialReturn: true, homing: 'direct', mode: 'tackle',
        origin: { x: 1200, y: 1000 }, state: 'flight', vx: SAW_TACKLE.speed, vy: 0 });
    for (let i = 0; i < 600 && s.tackle.state; i++) s.tackle.update();
    assert.equal(s.tackle.state, null, 'volta atrás do Arauto termina (contorna ou pousa)');
    const r = s.w.discRadius * SAW_TACKLE.enemyContactScale;
    assert.ok(Math.hypot((s.w.dropX - boss.x) / (48 + r), (s.w.dropY - boss.y) / (30 + r)) >= 1, 'termina fora do corpo');
}
{
    // Sem nenhuma saída livre: pousa no piso seguro em vez de ficar parada no ar.
    const boss = arauto(1000, 1000);
    const s = setup({ sawX: 1000, sawY: 1000, enemies: [boss], isSolid: () => true });
    Object.assign(s.tackle, { processed: new Set([boss]), specialReturn: true, mode: 'tackle',
        origin: { x: 1300, y: 1000 }, state: 'flight', vx: SAW_TACKLE.speed, vy: 0 });
    for (let i = 0; i < 400 && s.tackle.state; i++) s.tackle.update();
    assert.equal(s.tackle.state, null, 'cercada: pousa em vez de ficar parada');
    assert.ok(s.log.drops.length >= 1, 'usa o piso seguro');
}

// --- queda forçada volta para perto da origem e num ponto alcançável ---
{
    // Serra cercada (isSolid em tudo menos perto da origem): o force-landing escolhe o ponto perto da origem.
    const origin = { x: 1300, y: 1000 };
    const chain = new Chain([new SawWeapon()], CHAIN);
    chain.spawnSaw(1000, 1000);
    const safe = { x: origin.x + 10, y: origin.y };
    const tackle = new SawTackle({
        chain, getPlayers: () => [player(972, 1000), player(100, 1600)], getRoom: () => ({ enemies: [], wallBoxes: [] }),
        getBounds: () => BOUNDS, isSolid: () => true,
        safeDrop: (x, y) => (Math.hypot(x - origin.x, y - origin.y) < 60 ? safe : { x, y }),
        canLand: (x, y) => Math.hypot(x - safe.x, y - safe.y) < 1e-6,
        cfg: SAW_TACKLE
    });
    Object.assign(tackle, { state: 'flight', mode: 'tackle', origin, vx: SAW_TACKLE.speed, vy: 0, landingFails: 99 });
    tackle._forceLanding(chain.weapon);
    assert.equal(tackle.state, null, 'force landing termina o voo');
    assert.ok(Math.hypot(chain.weapon.dropX - origin.x, chain.weapon.dropY - origin.y) < 60, 'cai perto da origem, não onde ficou presa');
}

// --- mira assistida também mira estacas (cordas), não só inimigos ---
{
    const chain = new Chain([new SawWeapon()], CHAIN);
    chain.spawnSaw(1000, 1000);
    const p1 = player(972, 1000), p2 = player(100, 1600);
    const stake = { x: 1300, y: 1055 };
    const tackle = new SawTackle({
        chain, getPlayers: () => [p1, p2], getRoom: () => ({ enemies: [], wallBoxes: [] }), getBounds: () => BOUNDS,
        getAimTargets: () => [stake], safeDrop: (x, y) => ({ x, y }), cfg: SAW_TACKLE
    });
    dashing(p1); tackle.update();
    const aim = tackle.pending;
    assert.ok(aim.y > 0 && aim.x > 0, 'puxa para a estaca à frente');
    assert.ok(Math.atan2(aim.y, aim.x) <= SAW_TACKLE.aimMaxTurnDeg * Math.PI / 180 + 1e-9, 'correção para a estaca limitada');

    // estaca atrás não é mirada
    const backChain = new Chain([new SawWeapon()], CHAIN); backChain.spawnSaw(1000, 1000);
    const bp = player(972, 1000), bp2 = player(100, 1600);
    const back = new SawTackle({
        chain: backChain, getPlayers: () => [bp, bp2], getRoom: () => ({ enemies: [], wallBoxes: [] }), getBounds: () => BOUNDS,
        getAimTargets: () => [{ x: 700, y: 1000 }], safeDrop: (x, y) => ({ x, y }), cfg: SAW_TACKLE
    });
    dashing(bp); back.update();
    assert.deepEqual(back.pending, { x: 1, y: 0 }, 'não mira estaca atrás');
}

// --- sawGap enxerga a serra em voo do tackle: a técnica corta cordas ---
{
    const chain = new Chain([new SawWeapon()], CHAIN);
    chain.spawnSaw(500, 500);
    const w = chain.weapon;
    const stake = { x: 500, y: 500 };
    assert.ok(sawGap(chain, [], stake) === Infinity, 'serra parada (sem voo) não corta a corda');
    w.tackleState = 'flight';
    assert.ok(sawGap(chain, [], stake) <= 0, 'serra em voo do tackle encosta na estaca (corta)');
    w.tackleState = null;
    assert.ok(sawGap(chain, [], stake) === Infinity, 'fora do voo volta a não cortar');
}

// --- Investida: sem a receita (canTackle falso) o dash encosta na serra e não lança; liberada, lança ---
{
    const { tackle, p1, w } = setup();
    let unlocked = false;
    tackle.canTackle = () => unlocked;
    dashing(p1);
    tackle.update();
    assert.equal(tackle.state, null, 'travado: dash na serra solta não faz tackle');
    assert.equal(p1.tackles, 0, 'travado: jogador não recebe o impacto');
    assert.equal(tackle.justTackled, null);
    assert.equal(w.tackleState, null, 'travado: empurrão/arrasto não ficam bloqueados');
    unlocked = true;
    tackle.update();
    assert.equal(tackle.state, 'impact', 'liberado: o mesmo dash lança');
    assert.equal(tackle.justTackled, p1);
}
console.log('Tackle da serra: versões com retorno e sem retorno, desaceleração por percurso, quiques, hits, Arauto, reconexão, jogador, serra presa em parede/Arauto, mira em estacas e corte de corda em voo passaram.');
