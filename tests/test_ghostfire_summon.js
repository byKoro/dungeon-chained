import assert from 'node:assert/strict';
import { SpawnSystem } from '../js/systems/SpawnSystem.js';
import { GhostfireSystem } from '../js/systems/GhostfireSystem.js';
import { GHOSTFIRE } from '../js/config/GhostfireConfig.js';
import { TILE } from '../js/config/GameConfig.js';

function fixture(side = 'right') {
    const spawner = new SpawnSystem({ assets: { get: () => ({}) }, bloodCanvas: { palette: null } });
    const floor = Array.from({ length: 9 }, () => Array(14).fill(16));
    const bounds = { minX: 64, minY: 64, maxX: 832, maxY: 512 };
    const boss = spawner.createEnemy(700, 280, 1, 'ghostfire');
    boss.side = side;
    boss.setNavigationFloor(floor, bounds);
    boss._enter('summon', GHOSTFIRE.summonFrames);
    const room = { enemies: [boss], bounds, tiles: { floor, walls: [] }, _spawnFloor: 1 };
    const created = [], cues = [];
    let tick = 0;
    const system = new GhostfireSystem({
        spawnSystem: { createEnemy(x, y, level, type) {
            created.push({ x, y, type, tick });
            return spawner.createEnemy(x, y, level, type);
        } },
        particleSystem: { triggerFlameBurst() {}, triggerFlash() {} },
        renderer: { triggerShake() {} }, audio: { play(cue) { cues.push(cue); } }
    });
    const step = (frames = 1, players = []) => {
        for (let i = 0; i < frames; i++) { tick++; boss.update(players); system.update(room, players); }
    };
    return { boss, room, created, cues, system, step, spawner };
}

// --- Uma onda = cinco projéteis de fogo cuspidos juntos (rastro, igual ao trailer) ---
const run = fixture();
run.step(GHOSTFIRE.summonReleaseFrame - 1);
assert.equal(run.system.summons.projectiles.length, 0);
run.step();
assert.equal(run.system.summons.projectiles.length, GHOSTFIRE.summonCount, 'a cuspida lança um projétil por inimigo');
assert.equal(run.room.enemies.length, 1, 'nenhum inimigo aparece antes do impacto');
const wave = run.system.summons.projectiles.slice();
assert.equal(new Set(wave.map(s => s.waveId)).size, 1, 'todos os projéteis compartilham a mesma onda');
const mouthX = run.boss.x - GHOSTFIRE.sprite.mouthOffset * GHOSTFIRE.sprite.scale;
assert(wave.every(s => s.x === mouthX), 'todos saem da boca');
assert(wave.every(s => s.start.y === run.boss.y + run.boss.hoverOffset), 'todos partem da mesma altura da boca');

// Voo reto (sem arco): a meio caminho, y é a interpolação linear boca->alvo.
run.step(Math.floor(GHOSTFIRE.summon.flightFrames / 2));
for (const s of run.system.summons.projectiles) {
    const t = s.age / GHOSTFIRE.summon.flightFrames;
    const linearY = s.start.y + (s.target.y - s.start.y) * t;
    assert(Math.abs(s.y - linearY) < 1e-6, 'rastro voa reto, sem arco');
}
assert.equal(run.created.length, 0, 'voo não solta inimigos em pontos intermediários');

run.step(GHOSTFIRE.summon.flightFrames); // garante o pouso de toda a onda
assert.equal(run.created.length, 5, 'impacto cria exatamente cinco');
assert.equal(new Set(run.created.map(e => e.tick)).size, 1, 'toda a onda pousa no mesmo tick');
assert.deepEqual(run.created.map(e => e.type).sort(),
    ['hellbat', 'demonessA', 'demonessB', 'hellbat', 'demonessA'].sort(),
    'tipos determinísticos da formação');
assert.equal(run.cues.filter(c => c === 'ghostfireSummon').length, 1);
assert.equal(run.cues.filter(c => c === 'ghostfireSummonImpact').length, 1, 'um toque de impacto por onda');
assert.equal(run.cues.filter(c => c === 'enemySpawn').length, 5, 'cada inimigo materializado toca seu som');
for (const enemy of run.room.enemies.slice(1)) {
    assert.equal(enemy.state, 'recover', 'jogador tem tempo para reagir à materialização');
}
assert.equal(run.system.summons.projectiles.length, 0);

// --- Formação e destino são determinísticos ---
const repeat = fixture();
repeat.step(GHOSTFIRE.summonReleaseFrame + GHOSTFIRE.summon.flightFrames + 1);
assert.deepEqual(
    repeat.created.map(e => ({ x: e.x, y: e.y, type: e.type })),
    run.created.map(e => ({ x: e.x, y: e.y, type: e.type })),
    'formação e destino não são sorteados');

// --- Lados: boss à direita cospe para a esquerda e vice-versa ---
const left = fixture('left');
left.step(GHOSTFIRE.summonReleaseFrame + GHOSTFIRE.summon.flightFrames + 1);
assert.equal(left.created.length, 5);
assert(left.created.every(e => e.x > left.boss.x), 'lado esquerdo cospe para a direita');
assert(run.created.every(e => e.x < run.boss.x), 'lado direito cospe para a esquerda');

// --- Alvo bloqueado: procura outra formação inteira livre de paredes/buracos ---
const obstacles = fixture();
const sample = run.system.summons; // formação de referência
const refTarget = { x: run.created[0].x, y: run.created[0].y };
const targetCol = Math.floor((refTarget.x - obstacles.room.bounds.minX) / TILE) + 1;
const targetRow = Math.floor((refTarget.y - obstacles.room.bounds.minY) / TILE) + 1;
obstacles.room.tiles.floor[targetRow][targetCol] = -1;
obstacles.room.tiles.walls.push({ col: targetCol - 1, row: targetRow });
obstacles.step(GHOSTFIRE.summonReleaseFrame + GHOSTFIRE.summon.flightFrames + 1);
assert.equal(obstacles.created.length, 5, 'onda inteira mesmo com o alvo original bloqueado');
for (const e of obstacles.created) {
    const r = GHOSTFIRE.summon.spawnRadius;
    for (const dx of [-r, r]) for (const dy of [-r, r]) {
        const col = Math.floor((e.x + dx - obstacles.room.bounds.minX) / TILE) + 1;
        const row = Math.floor((e.y + dy - obstacles.room.bounds.minY) / TILE) + 1;
        assert(obstacles.room.tiles.floor[row][col] >= 0);
        assert(!obstacles.room.tiles.walls.some(w => w.col === col && w.row === row));
    }
}

// --- Sem espaço seguro: não lança nada ---
const blocked = fixture();
blocked.room.tiles.floor.forEach(row => row.fill(-1));
blocked.step(GHOSTFIRE.summonReleaseFrame);
assert.equal(blocked.system.summons.projectiles.length, 0, 'não lança quando não cabe uma onda segura');
assert.equal(blocked.created.length, 0);

// --- Limite de minions não produz ondas parciais ---
const full = fixture();
full.room.enemies.push(...Array.from({ length: 6 }, () => ({ isBoss: false, state: 'chase' })));
full.step(GHOSTFIRE.summonReleaseFrame);
assert.equal(full.system.summons.projectiles.length, 0, 'limite não produz ondas parciais');

// --- Ondas em voo reservam capacidade (duas ondas = 10, terceira negada) ---
const reserved = fixture();
const second = reserved.spawner.createEnemy(100, 280, 1, 'ghostfire');
second.side = 'left';
second.setNavigationFloor(reserved.room.tiles.floor, reserved.room.bounds);
reserved.room.enemies.push(second);
assert(reserved.system.summons.launch(reserved.room, reserved.boss, []));
assert(reserved.system.summons.launch(reserved.room, second, []));
const third = reserved.spawner.createEnemy(400, 100, 1, 'ghostfire');
assert.equal(reserved.system.summons.launch(reserved.room, third, []), false, 'ondas em voo reservam capacidade');
for (let i = 0; i <= GHOSTFIRE.summon.flightFrames; i++) reserved.system.summons.update(reserved.room);
assert.equal(reserved.created.length, GHOSTFIRE.maxMinions);

// --- Morte do boss cancela a onda em voo ---
const dead = fixture();
dead.step(GHOSTFIRE.summonReleaseFrame);
dead.boss.startDying();
dead.step(GHOSTFIRE.summon.flightFrames);
assert.equal(dead.created.length, 0, 'morte cancela invocação em voo');
assert.equal(dead.system.summons.projectiles.length, 0);

// --- Troca de sala descarta projéteis antigos ---
const departed = fixture();
departed.step(GHOSTFIRE.summonReleaseFrame);
departed.system.update({ enemies: [] }, []);
departed.step(GHOSTFIRE.summon.flightFrames);
assert.equal(departed.created.length, 0, 'troca de sala descarta projéteis antigos');

console.log('PASS ghostfire fire-trail summon wave');
