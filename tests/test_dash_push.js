import assert from 'node:assert/strict';
import { DashPush } from '../js/systems/DashPush.js';

let passed = 0, failed = 0;
const ok = (c, m) => { if (c) { console.log(`✅ ${m}`); passed++; } else { console.error(`❌ ${m}`); failed++; } };

const player = (x, y, extra = {}) => ({ x, y, vx: 0, vy: 0, hitRadius: 16, dashing: false, justDashed: false, dashDirX: 1, dashDirY: 0, dashPushImpulse: 0, ...extra });
const enemy = (x, y, extra = {}) => ({ x, y, hitRadius: 16, state: 'chase', frozen: false, airborne: false, immovable: false, pushVx: 0, pushVy: 0, ...extra });

console.log('=== TESTE DO EMPURRÃO DO DASH (Impacto) ===');

// Sem a melhoria (impulso 0): não empurra.
{
    const p = player(100, 100, { dashing: true, justDashed: true, dashPushImpulse: 0 });
    const e = enemy(112, 100);
    const dp = new DashPush({ getPlayers: () => [p], getRoom: () => ({ enemies: [e] }) });
    dp.update();
    ok(e.pushVx === 0 && e.pushVy === 0, 'impulso 0 não empurra');
}

// Com a melhoria: empurra o inimigo encostado para longe do jogador, sem dano.
{
    const p = player(100, 100, { dashing: true, justDashed: true, dashPushImpulse: 5 });
    const e = enemy(118, 100, { hp: 3 });
    const dp = new DashPush({ getPlayers: () => [p], getRoom: () => ({ enemies: [e] }) });
    dp.update();
    ok(e.pushVx > 0 && Math.abs(e.pushVy) < 1e-6, 'empurra para a direita (longe do jogador à esquerda)');
    ok(Math.hypot(e.pushVx, e.pushVy) === 5, 'magnitude = impulso');
    ok(e.hp === 3, 'não causa dano');
}

// Uma vez por inimigo por dash.
{
    const p = player(100, 100, { dashing: true, justDashed: true, dashPushImpulse: 5 });
    const e = enemy(118, 100);
    const dp = new DashPush({ getPlayers: () => [p], getRoom: () => ({ enemies: [e] }) });
    dp.update();                 // empurra (justDashed abre o dash)
    e.pushVx = 0; e.pushVy = 0;  // o inimigo consumiria o push
    p.justDashed = false;        // mesmo dash, próximos steps
    dp.update();
    ok(e.pushVx === 0, 'mesmo inimigo não é re-empurrado no mesmo dash');
    // novo dash reabre
    p.justDashed = true;
    dp.update();
    ok(e.pushVx > 0, 'novo dash pode empurrar de novo');
}

// Não empurra inimigos imóveis (Arauto), mortos ou congelados, nem quem está fora do alcance.
{
    const p = player(100, 100, { dashing: true, justDashed: true, dashPushImpulse: 5 });
    const boss = enemy(118, 100, { immovable: true });
    const dying = enemy(100, 118, { state: 'dying' });
    const far = enemy(400, 100);
    const dp = new DashPush({ getPlayers: () => [p], getRoom: () => ({ enemies: [boss, dying, far] }) });
    dp.update();
    ok(boss.pushVx === 0 && dying.pushVx === 0 && far.pushVx === 0, 'imóvel/morrendo/longe não são empurrados');
}

// Só empurra enquanto o jogador está em dash.
{
    const p = player(100, 100, { dashing: false, dashPushImpulse: 5 });
    const e = enemy(118, 100);
    const dp = new DashPush({ getPlayers: () => [p], getRoom: () => ({ enemies: [e] }) });
    dp.update();
    ok(e.pushVx === 0, 'sem dash não empurra');
}

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
