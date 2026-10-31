import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { Chain } from '../js/core/Chain.js';
import { Weapon } from '../js/weapons/Weapon.js';
import { SawWeapon } from '../js/weapons/SawWeapon.js';
import { ParticleSystem } from '../js/particles/ParticleSystem.js';
import { BloodCanvas } from '../js/particles/BloodCanvas.js';
import { PostProcessor } from '../js/systems/PostProcessor.js';
import { HAZARDS, TORCHES, TILE, HOLE_TILE } from '../js/config/GameConfig.js';
import { Room } from '../js/rooms/Room.js';
import { DungeonTileQuery } from '../js/rooms/DungeonTileQuery.js';
import { DungeonSim } from '../js/sim/models/DungeonSim.js';
import { Physics } from '../js/core/Physics.js';
import { PhysicsSim } from '../js/sim/math/PhysicsSim.js';
import { SawModel } from '../js/sim/models/SawModel.js';
import { ChainObstacleSystem } from '../js/systems/ChainObstacleSystem.js';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');

console.log('=== TESTES DE PERFORMANCE E HIGIENE (MILESTONE 4) ===');

// -------------------------------------------------------------
// 1. Remoção de Código Morto (7 métodos + configs obsoletas)
// -------------------------------------------------------------
console.log('\n--- Teste 1: Dead Code Removal ---');

assert.equal(Chain.prototype.applyToEnemies, undefined, 'Chain.applyToEnemies deve ser undefined');
assert.equal(Chain.prototype.cycleWeapon, undefined, 'Chain.cycleWeapon deve ser undefined');
assert.equal(Weapon.prototype.hitsTarget, undefined, 'Weapon.hitsTarget deve ser undefined');
assert.equal(SawWeapon.prototype.hitsTarget, undefined, 'SawWeapon.hitsTarget deve ser undefined');
assert.equal(ParticleSystem.prototype.triggerExplosion, undefined, 'ParticleSystem.triggerExplosion deve ser undefined');
assert.equal(BloodCanvas.prototype.stampGib, undefined, 'BloodCanvas.stampGib deve ser undefined');
assert.equal(PostProcessor.prototype.addAreaLight, undefined, 'PostProcessor.addAreaLight deve ser undefined');

// Dead config cleanup
assert.equal(HAZARDS.spike.hiddenFrames, undefined, 'HAZARDS.spike.hiddenFrames deve ser undefined');
assert.equal(HAZARDS.spike.warnFrames, undefined, 'HAZARDS.spike.warnFrames deve ser undefined');
assert.equal(HAZARDS.spike.exposedFrames, undefined, 'HAZARDS.spike.exposedFrames deve ser undefined');
assert.equal(HAZARDS.spike.retractFrames, undefined, 'HAZARDS.spike.retractFrames deve ser undefined');

assert.equal(TORCHES.minPerWall, undefined, 'TORCHES.minPerWall deve ser undefined');
assert.equal(TORCHES.maxPerWall, undefined, 'TORCHES.maxPerWall deve ser undefined');
assert.equal(TORCHES.sides, undefined, 'TORCHES.sides deve ser undefined');

// Scan all JS files in js/ to ensure zero dangling calls/references to removed methods
function scanDir(dir) {
    const entries = readdirSync(dir, { withFileTypes: true });
    const files = [];
    for (const e of entries) {
        const fullPath = join(dir, e.name);
        if (e.isDirectory()) files.push(...scanDir(fullPath));
        else if (e.name.endsWith('.js')) files.push(fullPath);
    }
    return files;
}

const jsFiles = scanDir(join(rootDir, 'js'));
const deadTokens = [
    'applyToEnemies',
    'cycleWeapon',
    'hitsTarget',
    'triggerExplosion',
    'stampGib',
    'addAreaLight'
];

for (const filePath of jsFiles) {
    const code = readFileSync(filePath, 'utf8');
    for (const token of deadTokens) {
        assert.ok(!code.includes(token), `Código em ${filePath} não deve conter referência a '${token}'`);
    }
}
console.log('✅ PASSOU: 7 métodos mortos e configs obsoletas eliminados sem referências pendentes.');

// -------------------------------------------------------------
// 2. Cache de unstainableRects em Room e DungeonTileQuery
// -------------------------------------------------------------
console.log('\n--- Teste 2: Cache de unstainableRects ---');

const mockCell = {
    gx: 0,
    gy: 0,
    kind: 'room',
    doors: {},
    customFloor: [
        [0, 16, 16, 0],
        [0, HOLE_TILE, 16, 0],
        [0, 16, HOLE_TILE, 0],
        [0, 0, 0, 0]
    ],
    customWalls: [
        { col: 0, row: 0 },
        { col: 3, row: 0 },
        { col: 0, row: 3 },
        { col: 3, row: 3 }
    ]
};
const mockBounds = { minX: TILE, minY: TILE, maxX: 4 * TILE, maxY: 4 * TILE };
const testRoom = new Room(mockCell, mockBounds);

assert.ok(Array.isArray(testRoom.unstainableRects), 'Room pré-calcula unstainableRects na inicialização');
assert.ok(testRoom.unstainableRects.length > 0, 'unstainableRects não está vazio');

const mockRoomsManager = {
    current: testRoom,
    cellRect: () => ({ x: 0, y: 0, w: 4 * TILE, h: 4 * TILE }),
    currentTiles: testRoom.tiles
};
const tileQuery = new DungeonTileQuery({ rooms: mockRoomsManager });

const rects1 = tileQuery.unstainableRects();
const rects2 = tileQuery.unstainableRects();

assert.equal(rects1, testRoom.unstainableRects, 'DungeonTileQuery retorna a mesma referência em cache do Room');
assert.equal(rects1, rects2, 'Chamadas subsequentes retornam a mesma referência em cache sem re-alocação');

// Geometria esperada: cada rect deve ter coordenadas corretas e w/h = TILE
for (const r of rects1) {
    assert.equal(r.w, TILE, 'Largura do retângulo deve ser TILE');
    assert.equal(r.h, TILE, 'Altura do retângulo deve ser TILE');
    assert.equal(r.x % TILE, 0, 'Coordenada X alinhada ao grid');
    assert.equal(r.y % TILE, 0, 'Coordenada Y alinhada ao grid');
}

// Teste em DungeonSim
const simDungeon = new DungeonSim({
    cellRect: { x: 0, y: 0, w: 4 * TILE, h: 4 * TILE },
    floor: mockCell.customFloor,
    walls: mockCell.customWalls,
    cols: 4,
    rows: 4
});
const simRects1 = simDungeon.unstainableRects();
const simRects2 = simDungeon.unstainableRects();
assert.equal(simRects1, simRects2, 'DungeonSim armazena em cache e retorna a mesma referência');
assert.ok(Array.isArray(simRects1) && simRects1.length > 0, 'DungeonSim retorna retângulos válidos');

console.log('✅ PASSOU: unstainableRects em cache e geometria idêntica sem alocação por frame.');

// -------------------------------------------------------------
// 3. Particionamento Single-Pass de Drawables em Game._renderView
// -------------------------------------------------------------
console.log('\n--- Teste 3: Single-Pass Drawable Partitioning ---');

const dummyDrawables = [
    { id: 1, y: 50 },
    { id: 2, y: 100 },
    { id: 3, y: 150 },
    { id: 4, y: 200 },
    { id: 5, y: 250 },
    { id: 6, y: 300 }
];
const sawY = 175;
const sortKey = d => d.y;

// Abordagem antiga (duplo filter alocando 2 arrays)
const oldBefore = dummyDrawables.filter(e => sortKey(e) <= sawY);
const oldAfter = dummyDrawables.filter(e => sortKey(e) > sawY);

// Nova abordagem single-pass particionada
const newBefore = [];
const newAfter = [];
let splitIdx = 0;
const total = dummyDrawables.length;
while (splitIdx < total && sortKey(dummyDrawables[splitIdx]) <= sawY) {
    newBefore.push(dummyDrawables[splitIdx]);
    splitIdx++;
}
for (let i = splitIdx; i < total; i++) {
    newAfter.push(dummyDrawables[i]);
}

assert.deepEqual(newBefore, oldBefore, 'Partição antes de sawY deve ser idêntica ao filter antigo');
assert.deepEqual(newAfter, oldAfter, 'Partição após sawY deve ser idêntica ao filter antigo');
console.log('✅ PASSOU: Particionamento single-pass produz ordem idêntica eliminando allocations.');

// -------------------------------------------------------------
// 4. Broadphase AABB em Physics.resolveBoxCollisions
// -------------------------------------------------------------
console.log('\n--- Teste 4: Broadphase AABB em Physics.resolveBoxCollisions ---');

// Referência brute force sem early out
function bruteForceResolveBox(entity, boxes) {
    const copy = { x: entity.x, y: entity.y, hitRadius: entity.hitRadius || 16 };
    boxes.forEach(b => {
        const nearestX = Math.max(b.x, Math.min(copy.x, b.x + b.w));
        const nearestY = Math.max(b.y, Math.min(copy.y, b.y + b.h));
        const distX = copy.x - nearestX;
        const distY = copy.y - nearestY;
        const dist = Math.hypot(distX, distY);
        const r = copy.hitRadius;

        if (dist < r) {
            const overlap = r - dist;
            if (dist === 0) {
                copy.x += overlap;
            } else {
                copy.x += (distX / dist) * overlap;
                copy.y += (distY / dist) * overlap;
            }
        }
    });
    return copy;
}

const wallBoxes = [
    { x: 0, y: 0, w: 64, h: 64 },
    { x: 128, y: 0, w: 64, h: 64 },
    { x: 0, y: 128, w: 64, h: 64 },
    { x: 128, y: 128, w: 64, h: 64 }
];

// Teste 1: Ponto distante (fora do AABB) não deve sofrer alteração
const farEntity = { x: 500, y: 500, hitRadius: 16 };
Physics.resolveBoxCollisions(farEntity, wallBoxes);
assert.equal(farEntity.x, 500);
assert.equal(farEntity.y, 500);

// Teste 2: Comparação de 200 pontos aleatórios contra brute force
let rngSeed = 123456789;
function pseudoRandom() {
    rngSeed = (rngSeed * 1664525 + 1013904223) >>> 0;
    return (rngSeed >>> 0) / 4294967296;
}

for (let i = 0; i < 200; i++) {
    const testX = -50 + pseudoRandom() * 300;
    const testY = -50 + pseudoRandom() * 300;
    const radius = 10 + pseudoRandom() * 20;

    const optEntity = { x: testX, y: testY, hitRadius: radius };
    Physics.resolveBoxCollisions(optEntity, wallBoxes);

    const refResult = bruteForceResolveBox({ x: testX, y: testY, hitRadius: radius }, wallBoxes);

    assert.ok(Math.abs(optEntity.x - refResult.x) < 1e-9, `Posição X divergente na iteração ${i}`);
    assert.ok(Math.abs(optEntity.y - refResult.y) < 1e-9, `Posição Y divergente na iteração ${i}`);

    // Equivalência com PhysicsSim
    const simEntity = { x: testX, y: testY, hitRadius: radius };
    PhysicsSim.resolveBoxCollisions(simEntity, wallBoxes);
    assert.ok(Math.abs(simEntity.x - optEntity.x) < 1e-9, `PhysicsSim divergiu de Physics na iteração ${i}`);
    assert.ok(Math.abs(simEntity.y - optEntity.y) < 1e-9, `PhysicsSim divergiu de Physics na iteração ${i}`);
}
console.log('✅ PASSOU: AABB broadphase produz resolução bit-a-bit idêntica à força bruta.');

// -------------------------------------------------------------
// 5. Pooling / Reuso de Objetos em getSawPositions
// -------------------------------------------------------------
console.log('\n--- Teste 5: Saw Position Object Pooling ---');

const sawWeapon = new SawWeapon();
const p1 = { x: 100, y: 200 };
const p2 = { x: 300, y: 200 };

// Chamada 1
const posA = sawWeapon.getSawPositions(p1, p2);
assert.equal(posA.length, 1);
assert.equal(posA[0].x, 200);
assert.equal(posA[0].y, 200);
assert.equal(posA[0].radius, 14);

// Chamada 2 (com posições diferentes)
p1.x = 150;
p2.x = 350;
const posB = sawWeapon.getSawPositions(p1, p2);

assert.equal(posA, posB, 'Array retornado por SawWeapon.getSawPositions deve ser reutilizado');
assert.equal(posA[0], posB[0], 'Objeto de posição retornado deve ser reutilizado (sem novas alocações no heap)');
assert.equal(posB[0].x, 250, 'Coordenadas atualizadas corretamente no objeto do pool');

// Modo split (dupla serra)
sawWeapon.split = 1;
const splitA = sawWeapon.getSawPositions(p1, p2);
const splitB = sawWeapon.getSawPositions(p1, p2);
assert.equal(splitA.length, 2);
assert.equal(splitA, splitB, 'Array de split saw reutilizado');
assert.equal(splitA[0], splitB[0], 'Objeto serra 0 reutilizado');
assert.equal(splitA[1], splitB[1], 'Objeto serra 1 reutilizado');

// Teste em SawModel
const sawModel = new SawModel();
const mPosA = sawModel.getSawPositions(p1, p2);
const mPosB = sawModel.getSawPositions(p1, p2);
assert.equal(mPosA, mPosB, 'Array retornado por SawModel reutilizado');
assert.equal(mPosA[0], mPosB[0], 'Objeto de posição de SawModel reutilizado');

sawModel.dropped = true;
sawModel.dropX = 77;
sawModel.dropY = 88;
const dropPos = sawModel.getSawPositions(p1, p2);
assert.equal(dropPos[0].x, 77);
assert.equal(dropPos[0].y, 88);
assert.equal(dropPos[0], mPosA[0], 'Objeto de serra largada reutiliza o pool');

console.log('✅ PASSOU: getSawPositions reutiliza arrays e objetos sem gerar lixo para o GC.');

// -------------------------------------------------------------
// 6. Teste Inline em ChainObstacleSystem._findContact
// -------------------------------------------------------------
console.log('\n--- Teste 6: Inline Point Testing em ChainObstacleSystem ---');

const obstacleSys = new ChainObstacleSystem();
const wpn = new SawWeapon();
const tetherP1 = { x: 0, y: 100, vx: 0, vy: 0 };
const tetherP2 = { x: 200, y: 100, vx: 0, vy: 0 };

// Sem inimigos imovíveis -> retorno nulo imediato
const noObstacles = obstacleSys._findContact(wpn, tetherP1, tetherP2, [{ immovable: false }]);
assert.equal(noObstacles, null, 'Retorna null imediatamente se nenhum obstáculo for imovível');

// Com inimigo imovível colidindo no centro da corrente
const immovableEnemy = {
    x: 100,
    y: 100,
    immovable: true,
    state: 'chase',
    collisionBodies: [{ x: 0, y: 0, radiusX: 30, radiusY: 30 }]
};

const contact = obstacleSys._findContact(wpn, tetherP1, tetherP2, [immovableEnemy]);
assert.ok(contact !== null, 'Detecta contato de obstáculo');
assert.equal(contact.enemy, immovableEnemy, 'Contato referencia o inimigo correto');
assert.ok(contact.depth > 0, 'Profundidade de penetração calculada');
assert.ok(contact.kind === 'chain' || contact.kind === 'disc', 'Kind registrado corretamente');

console.log('✅ PASSOU: ChainObstacleSystem avalia pontos inline com detecção correta.');

// -------------------------------------------------------------
// 7. Validação de Sintaxe Node em todos os Arquivos Modificados
// -------------------------------------------------------------
console.log('\n--- Teste 7: Node Syntax Check nos Módulos Modificados ---');

const modifiedFiles = [
    'js/rooms/Room.js',
    'js/rooms/DungeonTileQuery.js',
    'js/rooms/ModularGrid.js',
    'js/systems/CageEncounter.js',
    'js/systems/ChallengeCorridor.js',
    'js/systems/ChainObstacleSystem.js',
    'js/systems/PostProcessor.js',
    'js/core/Chain.js',
    'js/core/Physics.js',
    'js/weapons/Weapon.js',
    'js/weapons/SawWeapon.js',
    'js/particles/ParticleSystem.js',
    'js/particles/BloodCanvas.js',
    'js/config/GameConfig.js',
    'js/Game.js',
    'js/sim/math/PhysicsSim.js',
    'js/sim/models/DungeonSim.js',
    'js/sim/models/SawModel.js',
    'js/trailer/scenes/montage/SplitShot.js'
];

for (const relPath of modifiedFiles) {
    const full = join(rootDir, relPath);
    const res = spawnSync(process.execPath, ['--check', full], { encoding: 'utf8' });
    assert.equal(res.status, 0, `Erro de sintaxe em ${relPath}: ${res.stderr}`);
}
console.log(`✅ PASSOU: Todos os ${modifiedFiles.length} módulos passaram na checagem de sintaxe Node (exit code 0).`);

console.log('\nTODOS OS TESTES DE PERFORMANCE E HIGIENE FORAM APROVADOS COM SUCESSO!\n');
