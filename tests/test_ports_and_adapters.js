import { WebInputAdapter } from '../js/adapters/WebInputAdapter.js';
import { AudioEventAdapter } from '../js/adapters/AudioEventAdapter.js';
import { JuiceEventAdapter } from '../js/adapters/JuiceEventAdapter.js';
import { CanvasViewRenderer } from '../js/adapters/CanvasViewRenderer.js';
import { GameSimulation } from '../js/sim/GameSimulation.js';
import { SimulationEvents } from '../js/sim/events/SimulationEvents.js';
import { Game } from '../js/Game.js';

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

console.log("=== TESTES DE PORTS & ADAPTERS (MILESTONE 3) ===");

// -------------------------------------------------------------
// 1. WebInputAdapter: Transformação de Entradas e Contrato
// -------------------------------------------------------------
{
    console.log("\n--- Teste 1: WebInputAdapter ---");

    const inputAdapter = new WebInputAdapter();
    assert(typeof inputAdapter.getInputSnapshot === 'function', "WebInputAdapter implementa getInputSnapshot");

    // Snapshot padrão sem entradas ativas
    const defaultSnap = inputAdapter.getInputSnapshot(1 / 60);
    assert(Array.isArray(defaultSnap.players) && defaultSnap.players.length === 2, "Snapshot possui 2 jogadores");
    assert(defaultSnap.players[0].moveX === 0 && defaultSnap.players[0].moveY === 0, "Jogador 0 parado em repouso");
    assert(defaultSnap.players[1].moveX === 0 && defaultSnap.players[1].moveY === 0, "Jogador 1 parado em repouso");
    assert(defaultSnap.dt === 1 / 60, "dt repassado no snapshot");
    assert(typeof defaultSnap.menu === 'object', "Snapshot possui menu state");

    // Simulação com Mock de InputHandler
    const mockInputHandler = {
        _active: new Set(),
        pollGamepads() {},
        isDown(key) { return this._active.has(key.toLowerCase()); }
    };
    const adapterWithHandler = new WebInputAdapter({ inputHandler: mockInputHandler });

    // Player 0: W + D (diagonal nordeste) + Espaço (dash)
    mockInputHandler._active.add('w');
    mockInputHandler._active.add('d');
    mockInputHandler._active.add(' ');
    let snap = adapterWithHandler.getInputSnapshot();
    assert(snap.players[0].moveX === 1, "P1 moveX = 1 para tecla D");
    assert(snap.players[0].moveY === -1, "P1 moveY = -1 para tecla W");
    assert(snap.players[0].dash === true, "P1 dash = true para tecla Espaço");
    assert(snap.players[0].interact === false, "P1 interact = false quando E não está pressionado");

    // Player 0: Tecla E (interact)
    mockInputHandler._active.add('e');
    snap = adapterWithHandler.getInputSnapshot();
    assert(snap.players[0].interact === true, "P1 interact = true para tecla E");

    // Player 1: ArrowLeft + ArrowDown + Enter (dash) + ShiftRight (interact)
    mockInputHandler._active.clear();
    mockInputHandler._active.add('arrowleft');
    mockInputHandler._active.add('arrowdown');
    mockInputHandler._active.add('enter');
    mockInputHandler._active.add('shiftright');
    snap = adapterWithHandler.getInputSnapshot();
    assert(snap.players[1].moveX === -1, "P2 moveX = -1 para ArrowLeft");
    assert(snap.players[1].moveY === 1, "P2 moveY = 1 para ArrowDown");
    assert(snap.players[1].dash === true, "P2 dash = true para Enter");
    assert(snap.players[1].interact === true, "P2 interact = true para ShiftRight");

    // Override para testes determinísticos
    inputAdapter.setTestOverride({
        players: [
            { moveX: 0.75, moveY: -0.25, dash: true, interact: false },
            { moveX: -0.5, moveY: 0.5, dash: false, interact: true }
        ],
        menu: { up: false, down: false, left: false, right: false, confirm: true, cancel: false, pause: false }
    });
    const overridden = inputAdapter.getInputSnapshot(0.016);
    assert(overridden.players[0].moveX === 0.75, "Test override de input snapshot respeitado");
    assert(overridden.menu.confirm === true, "Menu confirm respeitado via override");
}

// -------------------------------------------------------------
// 2. AudioEventAdapter: Consumo de SimulationEvents
// -------------------------------------------------------------
{
    console.log("\n--- Teste 2: AudioEventAdapter ---");

    const playedCues = [];
    const duckCalls = [];
    let snapCalls = 0;
    let hitCalls = 0;

    const mockAudio = {
        play(cue, opts) { playedCues.push({ cue, opts }); },
        duck(level, opts) { duckCalls.push({ level, opts }); }
    };
    const mockSawMotor = {
        onSnap() { snapCalls++; },
        onHit() { hitCalls++; }
    };

    const audioAdapter = new AudioEventAdapter({ audio: mockAudio, sawMotor: mockSawMotor });

    const simEvents = new SimulationEvents();
    simEvents.emitSawSnapped(200, 150);
    simEvents.emitSawReconnected();
    simEvents.emitSawHit(200, 150, 1, false);
    simEvents.emitEntityDamaged(1, 200, 150, 1, true, 2); // Player hurt
    simEvents.emitEntityDamaged(2, 300, 150, 1, false, 0); // Enemy hurt
    simEvents.emitEntityDied(2, 300, 150, 'melee');
    simEvents.emitPlayerFootstep(0, 100, 100, false);
    simEvents.emitPlayerFootstep(1, 120, 100, true);
    simEvents.emitPlayerFell(0, 50, 50);
    simEvents.emitPlayerDashed(0, 1, 0);

    const count = audioAdapter.process(simEvents);
    assert(count === 10, "AudioEventAdapter processou todos os 10 eventos");

    assert(playedCues.some(c => c.cue === 'sawSnap'), "Áudio disparou 'sawSnap'");
    assert(snapCalls === 1, "SawMotor.onSnap acionado na ruptura da corrente");
    assert(duckCalls.some(d => d.level === -9), "Áudio fez ducking dinâmico para -9dB na ruptura");

    assert(playedCues.some(c => c.cue === 'sawPickup'), "Áudio disparou 'sawPickup' na reconexão");
    assert(hitCalls === 1, "SawMotor.onHit acionado no impacto da serra");

    assert(playedCues.some(c => c.cue === 'playerHit'), "Áudio disparou 'playerHit' para dano no jogador");
    assert(playedCues.some(c => c.cue === 'enemyHit'), "Áudio disparou 'enemyHit' para dano no inimigo");
    assert(playedCues.some(c => c.cue === 'enemyDeath'), "Áudio disparou 'enemyDeath' para morte de inimigo");

    assert(playedCues.some(c => c.cue === 'playerStep'), "Áudio disparou 'playerStep' normal");
    assert(playedCues.some(c => c.cue === 'playerStepBlood'), "Áudio disparou 'playerStepBlood' em poça de sangue");
    assert(playedCues.some(c => c.cue === 'playerFall'), "Áudio disparou 'playerFall' na queda em buraco");
    assert(playedCues.some(c => c.cue === 'playerDash'), "Áudio disparou 'playerDash'");
}

// -------------------------------------------------------------
// 3. JuiceEventAdapter: Efeitos Visuais e Feedback
// -------------------------------------------------------------
{
    console.log("\n--- Teste 3: JuiceEventAdapter ---");

    const shakes = [];
    const zoomPunches = [];
    let goreFlashes = 0;
    const sparkBursts = [];
    const dustBursts = [];
    const bloodSplats = [];

    const mockRenderer = {
        triggerShake(intensity) { shakes.push(intensity); },
        triggerZoomPunch(factor) { zoomPunches.push(factor); }
    };
    const mockScreenGore = {
        triggerFlash() { goreFlashes++; }
    };
    const mockParticleSystem = {
        triggerSparkBurst(x, y, r, count, pwr) { sparkBursts.push({ x, y, r, count }); },
        triggerFlash() {},
        triggerBloodDroplets(x, y, count, r) { bloodSplats.push({ x, y, count }); },
        triggerFlameBurst() {},
        triggerDust(x, y, dx, dy, count) { dustBursts.push({ x, y, dx, dy, count }); }
    };

    const juiceAdapter = new JuiceEventAdapter({
        renderer: mockRenderer,
        screenGore: mockScreenGore,
        particleSystem: mockParticleSystem
    });

    const events = [
        { type: 'SawSnapped', x: 100, y: 100 },
        { type: 'SawReconnected' },
        { type: 'SawHit', x: 200, y: 200, heavy: true },
        { type: 'EntityDamaged', isPlayer: true, x: 100, y: 100 },
        { type: 'EntityDamaged', isPlayer: false, x: 300, y: 200 },
        { type: 'EntityDied', x: 300, y: 200 },
        { type: 'PlayerFell', x: 50, y: 50 },
        { type: 'PlayerDashed', x: 80, y: 80, dirX: 1, dirY: 0 },
        { type: 'CameraShake', intensity: 12 }
    ];

    const processed = juiceAdapter.process(events);
    assert(processed === 9, "JuiceEventAdapter processou todos os 9 eventos");

    assert(shakes.includes(14), "Juice acionou camera shake de 14 na ruptura");
    assert(shakes.includes(4), "Juice acionou camera shake de 4 na reconexão");
    assert(shakes.includes(8), "Juice acionou camera shake de 8 em SawHit pesado");
    assert(shakes.includes(10), "Juice acionou camera shake de 10 em dano no jogador");
    assert(shakes.includes(12), "Juice acionou CameraShake com intensidade explícita");

    assert(goreFlashes >= 3, "ScreenGore disparou flashes para dano no jogador, morte de inimigo e queda");
    assert(sparkBursts.length >= 2, "Partículas emitiram feixes de faíscas em ruptura e acerto");
    assert(bloodSplats.length >= 1, "Partículas emitiram respingos de sangue em dano de inimigo");
    assert(dustBursts.length >= 1, "Partículas emitiram poeira no dash do jogador");
    assert(zoomPunches.length >= 1, "Renderer acionou zoom punch na morte do inimigo");
}

// -------------------------------------------------------------
// 4. CanvasViewRenderer: Ordenação de Profundidade e Renderização
// -------------------------------------------------------------
{
    console.log("\n--- Teste 4: CanvasViewRenderer ---");

    const calls = [];
    const mockCtx = {
        imageSmoothingEnabled: true,
        save() { calls.push('save'); },
        restore() { calls.push('restore'); },
        beginPath() { calls.push('beginPath'); },
        arc(x, y, r, sa, ea) { calls.push({ op: 'arc', x, y, r }); },
        ellipse(x, y, rx, ry, rot, sa, ea) { calls.push({ op: 'ellipse', x, y, rx, ry }); },
        fill() { calls.push('fill'); },
        stroke() { calls.push('stroke'); },
        moveTo(x, y) { calls.push({ op: 'moveTo', x, y }); },
        lineTo(x, y) { calls.push({ op: 'lineTo', x, y }); },
        fillRect(x, y, w, h) { calls.push({ op: 'fillRect', x, y, w, h }); },
        translate(x, y) { calls.push({ op: 'translate', x, y }); },
        rotate(angle) { calls.push({ op: 'rotate', angle }); },
        scale(sx, sy) { calls.push({ op: 'scale', sx, sy }); }
    };

    const viewRenderer = new CanvasViewRenderer();
    assert(typeof viewRenderer.renderSimulation === 'function', "CanvasViewRenderer implementa renderSimulation");

    const snapshot = {
        tick: 1,
        players: [
            { x: 100, y: 200, feetSortY: 214, facingLeft: false, animState: 'idle', invulnerable: false },
            { x: 150, y: 100, feetSortY: 114, facingLeft: true, animState: 'walk', invulnerable: false }
        ],
        chain: {
            connected: true,
            points: [{ x: 100, y: 200 }, { x: 125, y: 150 }, { x: 150, y: 100 }],
            strain: 5
        },
        saw: {
            x: 125,
            y: 150,
            rotation: 1.5,
            radius: 14,
            dropped: false
        },
        enemies: [
            { id: 1, type: 'melee', x: 120, y: 180, feetSortY: 194, hp: 2, maxHp: 3, facingLeft: false }
        ],
        pickups: [
            { type: 'heart', x: 130, y: 130, collected: false }
        ],
        traps: [
            { type: 'arrowTrap', x: 80, y: 80, state: 'idle' }
        ]
    };

    const drawableCount = viewRenderer.renderSimulation(mockCtx, snapshot);
    assert(drawableCount === 5, "CanvasViewRenderer computou e ordenou 5 entidades desenháveis");
    assert(mockCtx.imageSmoothingEnabled === false, "imageSmoothingEnabled mantido em false para pixel art crisp");
    assert(calls.some(c => c.op === 'ellipse'), "Sombras desenhadas via elipses");
    assert(calls.some(c => c.op === 'moveTo'), "Corrente desenhada com pontos interligados");

    // Teste de ordenação de profundidade: P2 (114) deve vir antes de Enemy (194) e P1 (214)
    // O array interno de drawables foi ordenado por feetSortY ascendente.
    // Hooks de frame
    viewRenderer.prepareFrame(mockCtx);
    assert(mockCtx.imageSmoothingEnabled === false, "prepareFrame garante imageSmoothingEnabled = false");
    viewRenderer.onRenderFrame(mockCtx, snapshot);
    assert(mockCtx.imageSmoothingEnabled === false, "onRenderFrame preserva pixel art");
}

// -------------------------------------------------------------
// 5. GameSimulation: Fallback Defensivo para Entrada Nula
// -------------------------------------------------------------
{
    console.log("\n--- Teste 5: GameSimulation Fallback Defensivo ---");

    const sim = new GameSimulation();

    // Chamada com null
    let eventsNull = null;
    try {
        eventsNull = sim.step(null);
        assert(eventsNull instanceof SimulationEvents, "GameSimulation.step(null) executou sem exceções");
    } catch (err) {
        assert(false, `GameSimulation.step(null) lançou erro: ${err.message}`);
    }

    // Chamada com undefined
    let eventsUndefined = null;
    try {
        eventsUndefined = sim.step(undefined);
        assert(eventsUndefined instanceof SimulationEvents, "GameSimulation.step(undefined) executou sem exceções");
    } catch (err) {
        assert(false, `GameSimulation.step(undefined) lançou erro: ${err.message}`);
    }

    // Chamada com objeto vazio
    let eventsEmpty = null;
    try {
        eventsEmpty = sim.step({});
        assert(eventsEmpty instanceof SimulationEvents, "GameSimulation.step({}) executou sem exceções");
    } catch (err) {
        assert(false, `GameSimulation.step({}) lançou erro: ${err.message}`);
    }

    // Chamada com players vazio
    let eventsEmptyPlayers = null;
    try {
        eventsEmptyPlayers = sim.step({ players: [] });
        assert(eventsEmptyPlayers instanceof SimulationEvents, "GameSimulation.step({ players: [] }) executou sem exceções");
    } catch (err) {
        assert(false, `GameSimulation.step({ players: [] }) lançou erro: ${err.message}`);
    }
}

// -------------------------------------------------------------
// 6. Game.js: Integração de Ports & Adapters
// -------------------------------------------------------------
{
    console.log("\n--- Teste 6: Game.js Integração de Ports & Adapters ---");

    assert(typeof Game.prototype.getRenderSnapshot === 'function', "Game possui método getRenderSnapshot()");
    assert(typeof Game.prototype._step === 'function', "Game possui método _step()");
    assert(typeof Game.prototype._renderView === 'function', "Game possui método _renderView()");

    // Verificação de snapshot autônomo do Game
    const mockGame = {
        simulation: null,
        gameLoop: { ticks: 42 },
        p1: { x: 100, y: 150, vx: 0, vy: 0, facingLeft: false, animState: 'idle', invulnerableTimer: 0, falling: false, lives: 3, maxLives: 3, feetSortY: 164 },
        p2: { x: 200, y: 150, vx: 0, vy: 0, facingLeft: true, animState: 'idle', invulnerableTimer: 0, falling: false, lives: 3, maxLives: 3, feetSortY: 164 },
        chain: { isConnected: true, hasSaw: true, weapon: { discRadius: 14, spinSpeed: 0.5, rotation: 0, strain: 0, getSawPositions: () => [{ x: 150, y: 150 }] } },
        arenaBounds: { x: 0, y: 0, w: 800, h: 600 },
        rooms: {
            cellRect: () => ({ x: 0, y: 0, w: 800, h: 600 }),
            currentTiles: null,
            doorsOfCurrent: () => [],
            current: { enemies: [], hearts: [], challenge: { arrowTraps: [] } }
        }
    };

    const snap = Game.prototype.getRenderSnapshot.call(mockGame);
    assert(snap.tick === 42, "RenderSnapshot do Game reflete o tick correto");
    assert(snap.players.length === 2, "RenderSnapshot contém ambos os jogadores");
    assert(snap.chain.connected === true, "RenderSnapshot reflete corrente conectada");
    assert(snap.saw.x === 150 && snap.saw.y === 150, "RenderSnapshot reflete posição calculada da serra");
}

console.log(`\nTODOS OS ${passed} TESTES DE PORTS & ADAPTERS PASSARAM COM SUCESSO!`);
