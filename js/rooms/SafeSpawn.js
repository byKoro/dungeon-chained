import { HOLE_TILE } from '../config/GameConfig.js';

/**
 * SafeSpawn — garante que uma entidade nasça SEMPRE sobre piso válido.
 *
 * A peça autoral (editor) pode posicionar um inimigo sobre um buraco (-1) ou
 * fora da área jogável (parede de borda). Em vez de DESCARTAR esse inimigo
 * (fazendo-o sumir) ou deixá-lo nascer no abismo (morte instantânea), esta
 * função encontra o tile de PISO seguro mais próximo e devolve a célula
 * corrigida.
 *
 * A busca é em anéis crescentes (distância de Chebyshev) a partir da célula
 * pedida, então o reposicionamento é o menor possível — o inimigo "escorrega"
 * para a beira de piso mais próxima do buraco. Mesma estratégia usada para o
 * spawn seguro dos jogadores (ver DungeonTileQuery.ensureSafeSpawn).
 */

/**
 * Um tile é "piso seguro" quando: está dentro da grade, não é buraco (-1) e
 * não é uma das paredes de borda (primeira/última linha e coluna da moldura).
 *
 * @param {number[][]} floor  matriz [row][col] de índices de tile
 * @param {number} col
 * @param {number} row
 * @param {number} cols  largura da grade (tiles)
 * @param {number} rows  altura da grade (tiles)
 * @returns {boolean}
 */
export function isSafeFloorCell(floor, col, row, cols, rows) {
    const line = floor[row];
    if (!line) return false;
    const value = line[col];
    if (value === undefined) return false;        // fora da grade
    if (value === HOLE_TILE) return false;         // buraco/abismo
    if (value < 0) return false;                   // qualquer marcador "sem piso"
    // Evita a moldura de parede nas bordas (não é piso pisável).
    if (col <= 0 || row <= 0 || col >= cols - 1 || row >= rows - 1) return false;
    return true;
}

/**
 * Resolve a célula de spawn segura mais próxima de (col, row).
 *
 * Se a célula pedida já for piso seguro, devolve-a inalterada. Caso contrário,
 * procura em anéis crescentes o piso seguro mais próximo. Se a sala inteira não
 * tiver nenhum piso seguro (caso degenerado), devolve a célula original e
 * sinaliza que falhou, cabendo ao chamador decidir (ex.: não spawnar).
 *
 * @param {number[][]} floor  matriz [row][col] de índices de tile
 * @param {number} col  coluna pedida (autoral)
 * @param {number} row  linha pedida (autoral)
 * @returns {{ col:number, row:number, moved:boolean, found:boolean }}
 */
export function findSafeFloorCell(floor, col, row) {
    const rows = floor.length;
    const cols = rows > 0 ? floor[0].length : 0;
    if (cols === 0) return { col, row, moved: false, found: false };

    if (isSafeFloorCell(floor, col, row, cols, rows)) {
        return { col, row, moved: false, found: true };
    }

    const maxRadius = Math.max(cols, rows);
    for (let radius = 1; radius < maxRadius; radius++) {
        // Candidato mais próximo primeiro: percorre o anel e escolhe o de menor
        // distância euclidiana ao alvo (desempata o "mais perto de verdade"
        // dentro do mesmo anel de Chebyshev).
        let best = null;
        let bestDist = Infinity;
        for (let dr = -radius; dr <= radius; dr++) {
            for (let dc = -radius; dc <= radius; dc++) {
                if (Math.max(Math.abs(dr), Math.abs(dc)) !== radius) continue;
                const c = col + dc, r = row + dr;
                if (!isSafeFloorCell(floor, c, r, cols, rows)) continue;
                const dist = dc * dc + dr * dr;
                if (dist < bestDist) {
                    bestDist = dist;
                    best = { col: c, row: r };
                }
            }
        }
        if (best) return { col: best.col, row: best.row, moved: true, found: true };
    }

    // Nenhum piso seguro na sala inteira.
    return { col, row, moved: false, found: false };
}
