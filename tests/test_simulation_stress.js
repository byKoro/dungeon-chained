import assert from 'node:assert';
import { GameSimulation } from '../js/sim/GameSimulation.js';
import { PhysicsSim } from '../js/sim/math/PhysicsSim.js';
import { Vec2 } from '../js/sim/math/Vec2.js';
import { Rect2D } from '../js/sim/math/Rect2D.js';
import { TetherModel } from '../js/sim/models/TetherModel.js';
import { SawModel } from '../js/sim/models/SawModel.js';
import { PlayerModel } from '../js/sim/models/PlayerModel.js';
import { EnemyModel } from '../js/sim/models/EnemyModel.js';
import { CombatSim } from '../js/sim/models/CombatSim.js';
import { DungeonSim } from '../js/sim/models/DungeonSim.js';
import { SimulationEvents } from '../js/sim/events/SimulationEvents.js';

// Entity guards verification in pure headless Node
import { Player } from '../js/entities/Player.js';
import { MeleeEnemy } from '../js/entities/MeleeEnemy.js';
import { SawWeapon } from '../js/weapons/SawWeapon.js';
import { HeartPickup } from '../js/entities/HeartPickup.js';

console.log('=== EMPIRICAL CHALLENGE: STRESS & ADVERSARIAL SIMULATION HARNESS ===\n');

let passCount = 0;
function test(name, fn) {
    try {
        fn();
        passCount++;
        console.log(`✅ PASSOU: ${name}`);
    } catch (err) {
        console.error(`❌ FALHOU: ${name}`);
        console.error(err);
        process.exit(1);
    }
}

// -------------------------------------------------------------
// 1. ISOLATION & ZERO GLOBALS TEST
// -------------------------------------------------------------
test('Ambiente Node puro não possui window/document/canvas', () => {
    assert.strictEqual(typeof window, 'undefined');
    assert.strictEqual(typeof document, 'undefined');
    assert.strictEqual(typeof AudioContext, 'undefined');
    assert.strictEqual(typeof HTMLImageElement, 'undefined');
    assert.strictEqual(typeof CanvasRenderingContext2D, 'undefined');
});

// -------------------------------------------------------------
// 2. PHYSICS & TETHER NUMERICAL EDGE CASES
// -------------------------------------------------------------
test('PhysicsSim.applyChainConstraint com distância ZERO não gera NaN nem divisão por zero', () => {
    const p1 = { x: 100, y: 100, vx: 0, vy: 0 };
    const p2 = { x: 100, y: 100, vx: 0, vy: 0 };
    PhysicsSim.applyChainConstraint(p1, p2, 145, 0.045);
    assert.ok(!Number.isNaN(p1.vx) && !Number.isNaN(p1.vy));
    assert.ok(!Number.isNaN(p2.vx) && !Number.isNaN(p2.vy));
    assert.strictEqual(p1.vx, 0);
    assert.strictEqual(p1.vy, 0);
    assert.strictEqual(p2.vx, 0);
    assert.strictEqual(p2.vy, 0);
});

test('PhysicsSim.distToSegment com segmento de comprimento zero retorna distância euclidiana', () => {
    const d = PhysicsSim.distToSegment(100, 100, 50, 50, 50, 50);
    const expected = Math.hypot(50, 50);
    assert.ok(Math.abs(d - expected) < 1e-9);
});

test('PhysicsSim.closestPointOnSegment com segmento de comprimento zero retorna ponto inicial', () => {
    const pt = PhysicsSim.closestPointOnSegment(100, 100, 50, 50, 50, 50);
    assert.strictEqual(pt.x, 50);
    assert.strictEqual(pt.y, 50);
});

test('PhysicsSim.resolveCircleCollision com entidade exatamente no centro do círculo (dist === 0)', () => {
    const e = { x: 200, y: 200, vx: 0, vy: 0, hitRadius: 10 };
    PhysicsSim.resolveCircleCollision(e, 200, 200, 30);
    assert.ok(!Number.isNaN(e.x) && !Number.isNaN(e.y));
    assert.ok(!Number.isNaN(e.vx) && !Number.isNaN(e.vy));
    // Deve ter sido empurrada para fora do raio (30 + 10 = 40)
    const dist = Math.hypot(e.x - 200, e.y - 200);
    assert.ok(Math.abs(dist - 40) < 1e-6);
});

test('PhysicsSim.resolveBoxCollisions com entidade exatamente no centro da caixa', () => {
    const e = { x: 50, y: 50, vx: 0, vy: 0, hitRadius: 16 };
    const box = { x: 40, y: 40, w: 20, h: 20 };
    PhysicsSim.resolveBoxCollisions(e, [box]);
    assert.ok(!Number.isNaN(e.x) && !Number.isNaN(e.y));
    assert.ok(e.x > 50); // Empurrado para fora sem NaN
});

test('PhysicsSim.resolveEntityCollisions com duas entidades coincidentes (distNorm === 0)', () => {
    const e1 = { x: 100, y: 100, vx: 0, vy: 0, hitRadius: 16 };
    const e2 = { x: 100, y: 100, vx: 0, vy: 0, hitRadius: 16 };
    PhysicsSim.resolveEntityCollisions([e1, e2]);
    assert.ok(!Number.isNaN(e1.x) && !Number.isNaN(e1.y));
    assert.ok(!Number.isNaN(e2.x) && !Number.isNaN(e2.y));
});

test('TetherModel e SawModel com jogadores coincidentes (distância ZERO)', () => {
    const tether = new TetherModel();
    const saw = new SawModel();
    const p1 = new PlayerModel(0, 300, 300);
    const p2 = new PlayerModel(1, 300, 300);
    const events = new SimulationEvents();

    tether.update(p1, p2, saw, events);

    assert.ok(!Number.isNaN(tether.strain));
    assert.ok(!Number.isNaN(saw.rotation));
    assert.ok(!Number.isNaN(saw.spin));
    assert.strictEqual(tether.strain, 0);

    const positions = saw.getSawPositions(p1, p2);
    assert.strictEqual(positions.length, 1);
    assert.strictEqual(positions[0].x, 300);
    assert.strictEqual(positions[0].y, 300);
});

test('TetherModel com distância extrema arrebenta e aplica impulso finito sem NaN', () => {
    const tether = new TetherModel();
    const saw = new SawModel();
    const dungeon = new DungeonSim();
    const p1 = new PlayerModel(0, 0, 300);
    const p2 = new PlayerModel(1, 5000, 300);
    const events = new SimulationEvents();

    tether.update(p1, p2, saw, events, dungeon);

    assert.strictEqual(tether.connected, false);
    assert.strictEqual(saw.dropped, true);
    assert.ok(!Number.isNaN(p1.vx));
    assert.ok(!Number.isNaN(p2.vx));
    assert.ok(!Number.isNaN(saw.dropX));
    assert.ok(!Number.isNaN(saw.dropY));
    assert.ok(events.queue.some(e => e.type === 'SawSnapped'));
});

test('TetherModel com velocidades supersônicas (10,000 px/frame) permanece estável', () => {
    const tether = new TetherModel();
    const saw = new SawModel();
    const p1 = new PlayerModel(0, 300, 300);
    const p2 = new PlayerModel(1, 350, 300);
    p1.vx = 10000;
    p1.vy = 10000;
    p2.vx = -10000;
    p2.vy = -10000;

    for (let i = 0; i < 10; i++) {
        tether.update(p1, p2, saw);
        p1.x += p1.vx * 0.01;
        p1.y += p1.vy * 0.01;
        p2.x += p2.vx * 0.01;
        p2.y += p2.vy * 0.01;
    }

    assert.ok(!Number.isNaN(p1.x));
    assert.ok(!Number.isNaN(p2.x));
    assert.ok(!Number.isNaN(saw.rotation));
});

// -------------------------------------------------------------
// 3. RAPID RECONNECT CYCLE STRESS TEST
// -------------------------------------------------------------
test('500 ciclos consecutivos de arrebentar e reconectar a serra', () => {
    const tether = new TetherModel({ reconnectDelay: 2 });
    const saw = new SawModel();
    const dungeon = new DungeonSim();
    const p1 = new PlayerModel(0, 300, 300);
    const p2 = new PlayerModel(1, 400, 300);
    const events = new SimulationEvents();

    for (let cycle = 0; cycle < 500; cycle++) {
        // Estica para arrebentar
        p2.x = p1.x + 300;
        tether.update(p1, p2, saw, events, dungeon);
        assert.strictEqual(tether.connected, false, `Falha no snap ciclo ${cycle}`);
        assert.strictEqual(saw.dropped, true);

        // Espera esfriar cooldown de reconexão
        tether.update(p1, p2, saw, events, dungeon);
        tether.update(p1, p2, saw, events, dungeon);

        // Move jogadores até o ponto da serra caída para reconectar
        p1.x = saw.dropX;
        p1.y = saw.dropY;
        p2.x = saw.dropX;
        p2.y = saw.dropY;

        tether.update(p1, p2, saw, events, dungeon);
        assert.strictEqual(tether.connected, true, `Falha na reconexão ciclo ${cycle}`);
        assert.strictEqual(saw.dropped, false);
    }
});

// -------------------------------------------------------------
// 4. DETERMINISMO E LONGO RUN (2,000 TICKS)
// -------------------------------------------------------------
test('2,000 ticks de simulação contínua determinística em GameSimulation', () => {
    const simA = new GameSimulation();
    const simB = new GameSimulation();

    const enemyA = simA.addEnemy({ type: 'melee', x: 200, y: 200 });
    const enemyB = simB.addEnemy({ type: 'melee', x: 200, y: 200 });

    for (let tick = 0; tick < 2000; tick++) {
        // Input pseudo-aleatório com sementes determinísticas baseadas no tick
        const p1X = (tick % 7 === 0) ? 1 : ((tick % 5 === 0) ? -1 : 0);
        const p1Y = (tick % 11 === 0) ? 1 : ((tick % 3 === 0) ? -1 : 0);
        const p2X = (tick % 4 === 0) ? -1 : ((tick % 9 === 0) ? 1 : 0);
        const p2Y = (tick % 6 === 0) ? 1 : ((tick % 8 === 0) ? -1 : 0);
        const dash1 = (tick === 50 || tick === 200 || tick === 600 || tick === 1200);
        const dash2 = (tick === 80 || tick === 350 || tick === 900);

        const input = {
            players: [
                { moveX: p1X, moveY: p1Y, dash: dash1 },
                { moveX: p2X, moveY: p2Y, dash: dash2 }
            ]
        };

        const evA = simA.step(input);
        const evB = simB.step(input);

        // Comparação estrita bit a bit de determinismo a cada 200 ticks
        if (tick % 200 === 0) {
            assert.strictEqual(simA.players[0].x, simB.players[0].x, `Desalinhamento X P1 tick ${tick}`);
            assert.strictEqual(simA.players[0].y, simB.players[0].y, `Desalinhamento Y P1 tick ${tick}`);
            assert.strictEqual(simA.players[1].x, simB.players[1].x, `Desalinhamento X P2 tick ${tick}`);
            assert.strictEqual(simA.players[1].y, simB.players[1].y, `Desalinhamento Y P2 tick ${tick}`);
            assert.strictEqual(simA.tether.strain, simB.tether.strain, `Desalinhamento strain tick ${tick}`);
            assert.strictEqual(enemyA.x, enemyB.x, `Desalinhamento Enemy X tick ${tick}`);
        }

        // Checagem de sanidade numérica
        assert.ok(!Number.isNaN(simA.players[0].x));
        assert.ok(!Number.isNaN(simA.players[1].x));
        assert.ok(!Number.isNaN(simA.saw.rotation));
    }

    assert.strictEqual(simA.tickCount, 2000);
    assert.strictEqual(simB.tickCount, 2000);
});

// -------------------------------------------------------------
// 5. DOUBLE SAW SPLITTING & MERGING STRESS
// -------------------------------------------------------------
test('SawModel com upgrade Double Saw divide e funde perfeitamente', () => {
    const saw = new SawModel();
    saw.doubleSaw = true;
    const p1 = new PlayerModel(0, 100, 200);
    const p2 = new PlayerModel(1, 300, 200);

    // Estica até splitAt (0.85)
    saw.setStretch(0.9);
    for (let i = 0; i < 20; i++) saw.update(p1, p2);

    assert.strictEqual(saw.split, 1);
    const posSplit = saw.getSawPositions(p1, p2);
    assert.strictEqual(posSplit.length, 2);
    assert.ok(posSplit[0].x < posSplit[1].x);

    // Relaxa até mergeAt (0.7)
    saw.setStretch(0.5);
    for (let i = 0; i < 20; i++) saw.update(p1, p2);

    assert.strictEqual(saw.split, 0);
    const posMerged = saw.getSawPositions(p1, p2);
    assert.strictEqual(posMerged.length, 1);
});

// -------------------------------------------------------------
// 6. ENTITY HEADLESS DOM GUARDS CHECK
// -------------------------------------------------------------
test('Entidades originais instanciam em ambiente Node puro sem ReferenceError', () => {
    const player = new Player(0, 100, 100, 'P1');
    assert.strictEqual(player.lives, 3);

    const spriteCfg = {
        cellSize: 100, cropX: 0, cropY: 0, cropW: 32, cropH: 32, drawHeight: 64,
        rows: { walk: { row: 0, frames: 4, fps: 6 }, attack: { row: 1, frames: 4, fps: 6 }, death: { row: 2, frames: 4, fps: 6 } }
    };
    const enemy = new MeleeEnemy(200, 200, null, spriteCfg, 1);
    assert.strictEqual(enemy.hp, 1);

    const sawWeapon = new SawWeapon();
    assert.strictEqual(sawWeapon.dropped, false);

    const heart = new HeartPickup(150, 150);
    assert.strictEqual(heart.radius, 24);

    // Verifica que métodos de buffer retornam null graciosamente sem lançar erro
    const tf = player._tintedFrame({ cropW: 16, cropH: 16 }, '#ffffff', 1);
    assert.strictEqual(tf, null);

    const beam = heart._buildBeam(null);
    assert.strictEqual(beam, null);
});

// -------------------------------------------------------------
// 7. INPUT SNAPSHOT ROBUSTNESS TEST
// -------------------------------------------------------------
test('GameSimulation.step tolera chamadas sem argumentos e objetos vazios', () => {
    const sim = new GameSimulation();
    assert.doesNotThrow(() => sim.step());
    assert.doesNotThrow(() => sim.step({}));
    assert.doesNotThrow(() => sim.step({ players: [] }));
    assert.strictEqual(sim.tickCount, 3);
});

console.log(`\nTODOS OS ${passCount} TESTES DO HARNESS ADVERSARIAL PASSARAM COM SUCESSO!`);
