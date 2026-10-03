/**
 * test_player_spawns.js — Teste unitário para a regra de spawn dos jogadores.
 *
 * Regra: Cada jogador (P1 Amarelo & P2 Azul) deve nascer exatamente em um
 * tile individual logo à frente do vão da porta (span de 2 tiles).
 */

import { TILE, ROOM_COLS, ROOM_ROWS, PLAYER_DOOR_SPAWN_TILES, getPlayerSpawnPositions } from '../js/config/GameConfig.js';

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

console.log("=== TESTE DA REGRA DE SPAWN DOS JOGADORES ===");

// 1. Porta Norte
const spawnN = getPlayerSpawnPositions("N", 0, 0, TILE);
assert(spawnN.p1.col === 6 && spawnN.p1.row === 1, "Porta Norte: P1 está exatamente no tile (col: 6, row: 1) à frente da porta");
assert(spawnN.p2.col === 7 && spawnN.p2.row === 1, "Porta Norte: P2 está exatamente no tile (col: 7, row: 1) à frente da porta");
assert(spawnN.p1.x === (6 + 0.5) * TILE && spawnN.p1.y === (1 + 0.5) * TILE, "Porta Norte: P1 centrado no tile (416, 96) px");
assert(spawnN.p2.x === (7 + 0.5) * TILE && spawnN.p2.y === (1 + 0.5) * TILE, "Porta Norte: P2 centrado no tile (480, 96) px");

// 2. Porta Sul
const spawnS = getPlayerSpawnPositions("S", 0, 0, TILE);
assert(spawnS.p1.col === 6 && spawnS.p1.row === ROOM_ROWS - 2, "Porta Sul: P1 está exatamente no tile (col: 6, row: 7) à frente da porta");
assert(spawnS.p2.col === 7 && spawnS.p2.row === ROOM_ROWS - 2, "Porta Sul: P2 está exatamente no tile (col: 7, row: 7) à frente da porta");
assert(spawnS.p1.x === (6 + 0.5) * TILE && spawnS.p1.y === (7 + 0.5) * TILE, "Porta Sul: P1 centrado no tile (416, 480) px");
assert(spawnS.p2.x === (7 + 0.5) * TILE && spawnS.p2.y === (7 + 0.5) * TILE, "Porta Sul: P2 centrado no tile (480, 480) px");

// 3. Porta Oeste
const spawnW = getPlayerSpawnPositions("W", 0, 0, TILE);
assert(spawnW.p1.col === 1 && spawnW.p1.row === 3, "Porta Oeste: P1 está exatamente no tile (col: 1, row: 3) à frente da porta");
assert(spawnW.p2.col === 1 && spawnW.p2.row === 4, "Porta Oeste: P2 está exatamente no tile (col: 1, row: 4) à frente da porta");
assert(spawnW.p1.x === (1 + 0.5) * TILE && spawnW.p1.y === (3 + 0.5) * TILE, "Porta Oeste: P1 centrado no tile (96, 224) px");
assert(spawnW.p2.x === (1 + 0.5) * TILE && spawnW.p2.y === (4 + 0.5) * TILE, "Porta Oeste: P2 centrado no tile (96, 288) px");

// 4. Porta Leste
const spawnE = getPlayerSpawnPositions("E", 0, 0, TILE);
assert(spawnE.p1.col === ROOM_COLS - 2 && spawnE.p1.row === 3, "Porta Leste: P1 está exatamente no tile (col: 12, row: 3) à frente da porta");
assert(spawnE.p2.col === ROOM_COLS - 2 && spawnE.p2.row === 4, "Porta Leste: P2 está exatamente no tile (col: 12, row: 4) à frente da porta");
assert(spawnE.p1.x === (12 + 0.5) * TILE && spawnE.p1.y === (3 + 0.5) * TILE, "Porta Leste: P1 centrado no tile (800, 224) px");
assert(spawnE.p2.x === (12 + 0.5) * TILE && spawnE.p2.y === (4 + 0.5) * TILE, "Porta Leste: P2 centrado no tile (800, 288) px");

// 5. Spawn Inicial (Centro)
const spawnCenter = getPlayerSpawnPositions("CENTER", 0, 0, TILE);
assert(spawnCenter.p1.col === 6 && spawnCenter.p1.row === 4, "Spawn Inicial: P1 no tile central (col: 6, row: 4)");
assert(spawnCenter.p2.col === 7 && spawnCenter.p2.row === 4, "Spawn Inicial: P2 no tile central (col: 7, row: 4)");

// 6. Teste com offset de célula no mundo (ex: gx=2, gy=3)
const cellX0 = 2 * ROOM_COLS * TILE;
const cellY0 = 3 * ROOM_ROWS * TILE;
const spawnWorld = getPlayerSpawnPositions("N", cellX0, cellY0, TILE);
assert(spawnWorld.p1.x === cellX0 + (6 + 0.5) * TILE, "Offset de mundo respeitado para P1");
assert(spawnWorld.p2.x === cellX0 + (7 + 0.5) * TILE, "Offset de mundo respeitado para P2");

console.log(`\nRESULTADO: ${passed}/${passed + failed} testes passaram.`);
if (failed > 0) process.exit(1);
