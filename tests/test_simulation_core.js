import { Vec2 } from '../js/sim/math/Vec2.js';
import { Rect2D } from '../js/sim/math/Rect2D.js';
import { PhysicsSim } from '../js/sim/math/PhysicsSim.js';
import { PlayerModel } from '../js/sim/models/PlayerModel.js';
import { TetherModel } from '../js/sim/models/TetherModel.js';
import { SawModel } from '../js/sim/models/SawModel.js';
import { EnemyModel } from '../js/sim/models/EnemyModel.js';
import { CombatSim } from '../js/sim/models/CombatSim.js';
import { DungeonSim } from '../js/sim/models/DungeonSim.js';
import { SimulationEvents } from '../js/sim/events/SimulationEvents.js';
import { GameSimulation } from '../js/sim/GameSimulation.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`✅ PASSOU: ${message}`);
        passed++;
    } else {
        console.error(`❌ FALHOU: ${message}`);
        failed++;
        throw new Error(message);
    }
}

console.log("=== TESTE DO CORE DE SIMULAÇÃO ENGINE-AGNOSTIC (HEADLESS NODE) ===");

// 1. Verificação de Ausência de Globais do Browser
{
    assert(typeof window === 'undefined', "Nenhum global 'window' presente no ambiente Node puro");
    assert(typeof document === 'undefined', "Nenhum global 'document' presente no ambiente Node puro");
    assert(typeof navigator === 'undefined' || !navigator.getGamepads, "Sem Gamepad API no ambiente Node puro");
}

// 2. Primitivas Matemáticas (Vec2, Rect2D, PhysicsSim)
{
    const v1 = new Vec2(3, 4);
    assert(v1.len() === 5, "Vec2.len() calcula hipotenusa correta");
    const vNorm = v1.normalize();
    assert(Math.abs(vNorm.len() - 1) < 1e-6, "Vec2.normalize() produz vetor unitário");
    const v2 = new Vec2(1, 2);
    const vAdd = v1.add(v2);
    assert(vAdd.x === 4 && vAdd.y === 6, "Vec2.add() soma componentes");
    const vScale = v1.scale(2);
    assert(vScale.x === 6 && vScale.y === 8, "Vec2.scale() multiplica escalar");
    assert(v1.dot(v2) === 11, "Vec2.dot() calcula produto escalar");

    const r1 = new Rect2D(10, 10, 40, 40);
    assert(r1.contains(20, 20), "Rect2D.contains() detecta ponto interno");
    assert(!r1.contains(5, 5), "Rect2D.contains() rejeita ponto externo");
    const r2 = new Rect2D(30, 30, 40, 40);
    assert(r1.intersects(r2), "Rect2D.intersects() detecta sobreposição AABB");
    assert(r1.intersectsCircle(10, 10, 5), "Rect2D.intersectsCircle() detecta círculo sobreposto");

    const p1 = { x: 100, y: 100, vx: 0, vy: 0 };
    const p2 = { x: 300, y: 100, vx: 0, vy: 0 };
    PhysicsSim.applyChainConstraint(p1, p2, 145, 0.045);
    assert(p1.vx > 0 && p2.vx < 0, "PhysicsSim.applyChainConstraint aplica forças elásticas opostas");

    const distSeg = PhysicsSim.distToSegment(150, 120, 100, 100, 200, 100);
    assert(Math.abs(distSeg - 20) < 1e-6, "PhysicsSim.distToSegment calcula distância perpendicular correta");
}

// 3. Simulação de Jogador (PlayerModel)
{
    const player = new PlayerModel(0, 200, 200);
    assert(player.lives === 3 && player.maxLives === 3, "PlayerModel inicializa com 3 vidas");

    // Movimentação analógica
    player.update({ moveX: 1, moveY: 0, dash: false });
    assert(player.vx > 0, "PlayerModel acelera para a direita com input moveX > 0");

    // Dano e invulnerabilidade
    const events = new SimulationEvents();
    const hit = player.takeDamage(100, 200, { knockback: 10 }, events);
    assert(hit && player.lives === 2, "PlayerModel perde 1 vida e registra acerto");
    assert(player.invulnerableTimer > 0, "PlayerModel ativa timer de invulnerabilidade");
    const eventsAll = events.all();
    assert(eventsAll.some(e => e.type === 'EntityDamaged' && e.isPlayer), "SimulationEvents captura evento EntityDamaged para jogador");
}

// 4. Dinâmica do Cabo e Serra (TetherModel & SawModel)
{
    const tether = new TetherModel({ rest: 100, strainDistance: 120, breakDistance: 200, strainLimit: 10 });
    const saw = new SawModel();
    const p1 = new PlayerModel(0, 100, 100);
    const p2 = new PlayerModel(1, 260, 100);
    const events = new SimulationEvents();

    assert(tether.connected, "TetherModel inicia conectado");
    // Passo com distância acima do limite de ruptura (260 - 100 = 160 > 120): acumula tensão
    for (let i = 0; i < 15; i++) {
        tether.update(p1, p2, saw, events);
    }
    assert(!tether.connected, "TetherModel arrebenta quando esticado além do limite");
    assert(saw.dropped, "SawModel cai no chão quando a corrente arrebenta");
    assert(events.all().some(e => e.type === 'SawSnapped'), "SimulationEvents registra SawSnapped");

    // Reconexão ao aproximar jogadores da serra no chão
    p1.x = saw.dropX + 5;
    p1.y = saw.dropY;
    p2.x = saw.dropX - 5;
    p2.y = saw.dropY;
    tether.reconnectCooldown = 0;
    tether.update(p1, p2, saw, events);
    assert(tether.connected, "TetherModel reconecta quando ambos os jogadores chegam na serra");
    assert(!saw.dropped, "SawModel volta para estado recolhido após reconexão");
    assert(events.all().some(e => e.type === 'SawReconnected'), "SimulationEvents registra SawReconnected");
}

// 5. Inteligência Artificial de Inimigos e Combate (EnemyModel & CombatSim)
{
    const enemy = EnemyModel.create('melee', 300, 100, { hp: 2 });
    assert(enemy.state === 'chase', "EnemyModel inicia em estado 'chase'");
    const p1 = new PlayerModel(0, 200, 100);
    const p2 = new PlayerModel(1, 440, 100);
    const combat = new CombatSim();
    const saw = new SawModel();
    const tether = new TetherModel();
    const events = new SimulationEvents();

    // Inimigo se aproxima dos jogadores
    for (let i = 0; i < 20; i++) {
        enemy.update([p1, p2], null, events);
    }
    assert(enemy.state === 'chase' || enemy.state === 'windup', "EnemyModel atualiza perseguição");

    // Posiciona o inimigo no meio da corrente (fora da safe zone dos players: dP1=120, dP2=120 > 46)
    enemy.x = 320;
    enemy.y = 100;
    enemy.hitTimer = 0;

    // Combate da serra cortando o inimigo
    const hits = combat.resolveWeaponHits(saw, tether, [enemy], p1, p2, events);
    assert(hits >= 1, "CombatSim detecta corte da serra contra o inimigo");
    assert(enemy.hp < 2, "EnemyModel sofre dano do CombatSim");
    assert(events.all().some(e => e.type === 'SawHit'), "SimulationEvents registra SawHit");
}

// 6. Simulação de Dungeon e Buracos (DungeonSim)
{
    const dungeon = new DungeonSim({
        cols: 14,
        rows: 9,
        floor: [
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 0],
            [0, 16, 16, -1, -1, 16, 16, 16, 16, 16, 16, 16, 16, 0], // buraco em col 3 e 4
            [0, 16, 16, -1, -1, 16, 16, 16, 16, 16, 16, 16, 16, 0],
            [0, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 0],
            [0, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 0],
            [0, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 0],
            [0, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        ]
    });

    assert(dungeon.isHoleAtWorld(3 * 64 + 32, 2 * 64 + 32), "DungeonSim detecta buraco nas coordenadas mundiais");
    assert(!dungeon.isHoleAtWorld(1 * 64 + 32, 1 * 64 + 32), "DungeonSim detecta chão sólido fora do buraco");

    const p = new PlayerModel(0, 3 * 64 + 32, 2 * 64 + 32 - 14); // Pés no buraco
    const events = new SimulationEvents();
    dungeon.checkHoleFalls([p], events);
    assert(p.falling, "DungeonSim derruba jogador com pés no buraco");
    assert(events.all().some(e => e.type === 'PlayerFell'), "SimulationEvents registra PlayerFell");
}

// 7. Teste de Integração: GameSimulation (Loop Determinístico a 60Hz)
{
    const sim = new GameSimulation({
        spawnP1: { x: 300, y: 300 },
        spawnP2: { x: 380, y: 300 }
    });

    sim.addEnemy({ type: 'melee', x: 340, y: 200, hp: 3 });

    assert(sim.tickCount === 0, "GameSimulation inicia no tick 0");
    assert(sim.players.length === 2, "GameSimulation contém 2 jogadores");
    assert(sim.enemies.length === 1, "GameSimulation contém 1 inimigo registrado");

    // Executa 60 steps determinísticos (1 segundo de simulação a 60 Hz)
    for (let step = 0; step < 60; step++) {
        const inputSnapshot = {
            players: [
                { moveX: 0.5, moveY: 0, dash: false },
                { moveX: 0.5, moveY: 0, dash: false }
            ]
        };
        const events = sim.step(inputSnapshot);
        assert(events instanceof SimulationEvents, "GameSimulation.step retorna instância de SimulationEvents");
    }

    assert(sim.tickCount === 60, "GameSimulation avançou exatamente 60 ticks determinísticos");
    assert(sim.players[0].x > 300, "Jogador 1 se moveu conforme os inputs determinísticos");

    // Snapshot para renderizador Canvas 2D ou Unity
    const snapshot = sim.getRenderSnapshot();
    assert(snapshot.tick === 60, "RenderSnapshot reflete o tick atual");
    assert(Array.isArray(snapshot.players) && snapshot.players.length === 2, "RenderSnapshot possui estado de 2 jogadores");
    assert(snapshot.chain && Array.isArray(snapshot.chain.points), "RenderSnapshot possui pontos calculados do cabo");
    assert(snapshot.saw && snapshot.saw.radius === 14, "RenderSnapshot possui dimensões e estado da serra");
    assert(snapshot.enemies && snapshot.enemies.length === 1, "RenderSnapshot possui estado dos inimigos");
}

console.log(`\nTODOS OS ${passed} TESTES DO CORE DE SIMULAÇÃO PASSARAM COM SUCESSO!`);
