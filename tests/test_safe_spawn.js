/**
 * test_safe_spawn.js — Teste unitário para a regra de spawn seguro de inimigos.
 *
 * Regra: um inimigo NUNCA deve nascer sobre um buraco (-1) ou sobre a parede de
 * borda. Quando a célula autoral cair nesses casos, findSafeFloorCell deve
 * escorregar para o tile de PISO seguro mais próximo. Quando a célula já for
 * piso, deve ficar inalterada.
 */

import { findSafeFloorCell, isSafeFloorCell } from '../js/rooms/SafeSpawn.js';
import { HOLE_TILE } from '../js/config/GameConfig.js';

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

console.log("=== TESTE DA REGRA DE SPAWN SEGURO DE INIMIGOS ===");

const H = HOLE_TILE; // -1 (buraco)
const F = 16;        // piso liso
const W = 2;         // parede (índice de borda qualquer >= 0)

// Grade 6x6: moldura de parede nas bordas, piso no miolo, com um buraco em
// (col 3, row 3). Indexada [row][col].
function makeGrid() {
    return [
        [W, W, W, W, W, W],
        [W, F, F, F, F, W],
        [W, F, F, F, F, W],
        [W, F, F, H, F, W],  // buraco em (3,3)
        [W, F, F, F, F, W],
        [W, W, W, W, W, W],
    ];
}

const grid = makeGrid();
const COLS = 6, ROWS = 6;

// 1. Célula de piso permanece inalterada (não move).
const onFloor = findSafeFloorCell(grid, 2, 2);
assert(onFloor.found && !onFloor.moved && onFloor.col === 2 && onFloor.row === 2,
    "Piso válido (2,2) não é movido");

// 2. Célula sobre buraco escorrega para piso adjacente (anel 1).
const onHole = findSafeFloorCell(grid, 3, 3);
assert(onHole.found && onHole.moved, "Buraco (3,3) é reposicionado para piso");
assert(isSafeFloorCell(grid, onHole.col, onHole.row, COLS, ROWS),
    `Destino do buraco (${onHole.col},${onHole.row}) é piso seguro`);
assert(Math.max(Math.abs(onHole.col - 3), Math.abs(onHole.row - 3)) === 1,
    "Destino do buraco está no anel mais próximo (distância 1)");

// 3. Célula sobre parede de borda escorrega para dentro.
const onWall = findSafeFloorCell(grid, 0, 0);
assert(onWall.found && onWall.moved, "Parede de borda (0,0) é reposicionada");
assert(isSafeFloorCell(grid, onWall.col, onWall.row, COLS, ROWS),
    `Destino da parede (${onWall.col},${onWall.row}) é piso seguro`);

// 4. isSafeFloorCell rejeita buraco, parede e fora-da-grade; aceita piso.
assert(!isSafeFloorCell(grid, 3, 3, COLS, ROWS), "isSafeFloorCell rejeita buraco");
assert(!isSafeFloorCell(grid, 0, 2, COLS, ROWS), "isSafeFloorCell rejeita parede de borda");
assert(!isSafeFloorCell(grid, 99, 99, COLS, ROWS), "isSafeFloorCell rejeita fora da grade");
assert(isSafeFloorCell(grid, 1, 1, COLS, ROWS), "isSafeFloorCell aceita piso do miolo");

// 5. Caso degenerado: sala sem nenhum piso seguro -> found=false.
const allHoles = [
    [W, W, W],
    [W, H, W],
    [W, W, W],
];
const none = findSafeFloorCell(allHoles, 1, 1);
assert(!none.found, "Sala sem piso seguro sinaliza found=false (não spawnar)");

// ---------------------------------------------------------------------------
// 6. CONSISTÊNCIA DE COORDENADAS entre o spawn (Room) e a navegação (MeleeEnemy)
//
// Bug corrigido: o spawn calculava a posição com (col + 0.5), mas a navegação
// (_tileAt) lê a célula com (x - minX)/TILE + 1. Isso deslocava o inimigo 1
// tile — a célula "protegida" por findSafeFloorCell não era a célula onde ele
// aparecia, então ele ainda caía no buraco.
//
// Aqui replicamos AS DUAS fórmulas e exigimos que a célula lida pela navegação
// seja EXATAMENTE a célula segura escolhida no spawn.
// ---------------------------------------------------------------------------
const TILE = 64;
const bounds = { minX: 500, minY: 300 }; // origem arbitrária da área jogável

// Fórmula do spawn (igual a Room.spawnEnemies, já corrigida).
function spawnWorldPos(col, row) {
    return {
        x: bounds.minX + (col - 0.5) * TILE,
        y: bounds.minY + (row - 0.5) * TILE
    };
}

// Fórmula da navegação (igual a MeleeEnemy._tileAt).
function navTileAt(x, y) {
    return {
        col: Math.floor((x - bounds.minX) / TILE) + 1,
        row: Math.floor((y - bounds.minY) / TILE) + 1
    };
}

// Para cada célula segura possível na grade de teste, o round-trip
// spawn -> navegação deve devolver a MESMA célula.
let roundTripOk = true;
for (let r = 1; r < ROWS - 1; r++) {
    for (let c = 1; c < COLS - 1; c++) {
        if (!isSafeFloorCell(grid, c, r, COLS, ROWS)) continue;
        const p = spawnWorldPos(c, r);
        const back = navTileAt(p.x, p.y);
        if (back.col !== c || back.row !== r) {
            roundTripOk = false;
            console.error(`   divergência: célula (${c},${r}) -> nav (${back.col},${back.row})`);
        }
    }
}
assert(roundTripOk, "Posição de spawn é lida pela navegação como a MESMA célula (sem deslocar 1 tile)");

// E o caso concreto do bug: inimigo autorado sobre o buraco (3,3) deve, após o
// reposicionamento, ser lido pela navegação numa célula de PISO (nunca no -1).
const fixed = findSafeFloorCell(grid, 3, 3);
const fixedPos = spawnWorldPos(fixed.col, fixed.row);
const fixedCell = navTileAt(fixedPos.x, fixedPos.y);
assert(grid[fixedCell.row][fixedCell.col] !== H,
    `Inimigo do buraco é lido pela navegação sobre piso (${fixedCell.col},${fixedCell.row}), não sobre -1`);

console.log(`\nRESULTADO: ${passed}/${passed + failed} testes passaram.`);
if (failed > 0) process.exit(1);
