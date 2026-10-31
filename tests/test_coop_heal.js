import assert from 'node:assert/strict';
import { CoopHeal } from '../js/systems/CoopHeal.js';
import { PLAYER_UPGRADES } from '../js/config/ForgeConfig.js';

let passed = 0, failed = 0;
const ok = (c, m) => { if (c) { console.log(`✅ ${m}`); passed++; } else { console.error(`❌ ${m}`); failed++; } };

const R = PLAYER_UPGRADES.coopHeal.radius;
const player = (x, y, extra = {}) => ({ x, y, lives: 2, maxLives: 3, falling: false, damageTaken: 0, ...extra });
const make = (p1, p2) => new CoopHeal({ getPlayers: () => [p1, p2] });
const run = (h, n) => { for (let i = 0; i < n; i++) h.update(); };

console.log('=== TESTE DA CURA COOPERATIVA (Vínculo) ===');

// Sem a melhoria (params null): nunca cura.
{
    const p1 = player(0, 0), p2 = player(10, 0);
    const h = make(p1, p2);
    run(h, 1000);
    ok(p1.lives === 2 && p2.lives === 2, 'params null: não cura');
}

// Perto o tempo todo: cura 1 de cada após holdSteps.
{
    const p1 = player(0, 0), p2 = player(10, 0);
    const h = make(p1, p2);
    h.setParams({ holdSteps: 60, cooldownSteps: 100 });
    run(h, 59);
    ok(p1.lives === 2 && p2.lives === 2, 'antes de holdSteps não cura');
    h.update();
    ok(p1.lives === 3 && p2.lives === 3, 'após holdSteps cura 1 de cada um que falta');
}

// Afastar reinicia o contador.
{
    const p1 = player(0, 0), p2 = player(10, 0);
    const h = make(p1, p2);
    h.setParams({ holdSteps: 60, cooldownSteps: 100 });
    run(h, 40);
    p2.x = R + 50; // longe
    h.update();
    ok(h.hold === 0, 'afastar zera o contador');
    p2.x = 10;     // perto de novo
    run(h, 59);
    ok(p1.lives === 2, 'tem que acumular o tempo de novo');
    h.update();
    ok(p1.lives === 3, 'cura após recomeçar o tempo');
}

// Tomar dano reinicia o contador.
{
    const p1 = player(0, 0), p2 = player(10, 0);
    const h = make(p1, p2);
    h.setParams({ holdSteps: 60, cooldownSteps: 100 });
    run(h, 50);
    p1.damageTaken += 1; // tomou um hit
    h.update();
    ok(h.hold === 0, 'tomar dano zera o contador');
}

// Cooldown entre curas.
{
    const p1 = player(0, 0, { lives: 1, maxLives: 3 }), p2 = player(10, 0, { lives: 1, maxLives: 3 });
    const h = make(p1, p2);
    h.setParams({ holdSteps: 10, cooldownSteps: 30 });
    run(h, 10);
    ok(p1.lives === 2 && p2.lives === 2, 'primeira cura');
    run(h, 10);
    ok(p1.lives === 2, 'durante o cooldown não cura de novo');
    run(h, 20 + 10);
    ok(p1.lives === 3 && p2.lives === 3, 'após o cooldown + hold, cura de novo');
}

// Com os dois cheios, não entra em cooldown (não desperdiça).
{
    const p1 = player(0, 0, { lives: 3, maxLives: 3 }), p2 = player(10, 0, { lives: 3, maxLives: 3 });
    const h = make(p1, p2);
    h.setParams({ holdSteps: 10, cooldownSteps: 30 });
    run(h, 20);
    ok(h.cooldown === 0, 'cheios: não gasta a cura em cooldown');
}

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
