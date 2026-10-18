import { TILE, HOLE_TILE } from '../config/GameConfig.js';

/**
 * DungeonTileQuery — consultas e regras sobre a GRADE DE TILES da sala atual.
 *
 * Centraliza toda a conversão mundo→tile e as regras ligadas ao piso que antes
 * viviam espalhadas no Game: detecção de buracos (para a IA desviar e para a
 * queda dos jogadores), retângulos de buraco (para furar o clip do sangue) e o
 * reposicionamento em piso seguro no spawn do modo de teste.
 *
 * Lê o estado da sala em tempo real via RoomManager (os tiles mudam a cada
 * transição), então uma única instância serve a dungeon toda.
 */
export class DungeonTileQuery {
    /** @param {object} opts @param {RoomManager} opts.rooms */
    constructor({ rooms }) {
        this.rooms = rooms;
    }

    // Grade de piso da sala atual (ou null quando ainda não há sala/tiles).
    _floor() {
        const tiles = this.rooms.currentTiles;
        return tiles?.floor ? tiles : null;
    }

    // Converte um ponto do MUNDO para índices de coluna/linha da grade atual.
    _toTile(x, y, rect = this.rooms.cellRect()) {
        return {
            col: Math.floor((x - rect.x) / TILE),
            row: Math.floor((y - rect.y) / TILE)
        };
    }

    // Valor do tile de piso em (col, row), ou undefined se fora da grade.
    _tileValue(tiles, col, row) {
        return tiles.floor[row]?.[col];
    }

    // Testa se um ponto do MUNDO cai sobre um buraco (-1) na sala atual. Pontos
    // fora da grade de piso (vãos de porta/corredor) são tratados como SEGUROS,
    // para a IA conseguir atravessar.
    isHoleAtWorld(x, y) {
        const tiles = this._floor();
        if (!tiles) return false;
        const { col, row } = this._toTile(x, y);
        const value = this._tileValue(tiles, col, row);
        if (value === undefined) return false; // fora da grade: seguro
        return value === HOLE_TILE;
    }

    // Retângulos (mundo) dos tiles de BURACO na sala atual, para FURAR o clip do
    // sangue (nenhuma mancha deve aparecer sobre buracos). Inclui o tile inteiro
    // de buraco — miolo e bordas — pois o jogador percebe o tile todo como vão.
    // Retorna null quando não há buracos.
    darkHoleRects() {
        const tiles = this._floor();
        if (!tiles) return null;
        const rect = this.rooms.cellRect();
        const rects = [];
        tiles.floor.forEach((line, r) => {
            line.forEach((value, c) => {
                if (value !== HOLE_TILE) return;
                rects.push({ x: rect.x + c * TILE, y: rect.y + r * TILE, w: TILE, h: TILE });
            });
        });
        return rects.length ? rects : null;
    }

    // Dispara a queda de cada jogador que estiver sobre um buraco (-1). A queda
    // leva à morte ao fim da animação. Usa o CENTRO do jogador. Já espera que a
    // posição esteja confinada aos bounds.
    checkHoleFalls(players) {
        const tiles = this._floor();
        if (!tiles) return;
        const rect = this.rooms.cellRect();
        for (const player of players) {
            if (player.falling) continue;
            const { col, row } = this._toTile(player.x, player.y, rect);
            if (this._tileValue(tiles, col, row) !== HOLE_TILE) continue;
            // Centro do tile do buraco, para o sprite afundar alinhado.
            const cx = rect.x + (col + 0.5) * TILE;
            const cy = rect.y + (row + 0.5) * TILE;
            player.startFalling(cx, cy);
        }
    }

    // Tile PISÁVEL: dentro da grade, com piso (não buraco/-1), fora da moldura
    // de parede de borda e sem parede autoral do editor em cima.
    _isWalkable(tiles, c, r, wallSet) {
        const value = this._tileValue(tiles, c, r);
        if (value === undefined || value < 0) return false;
        if (c <= 0 || r <= 0 || c >= tiles.cols - 1 || r >= tiles.rows - 1) return false;
        return !wallSet.has(`${c},${r}`);
    }

    /**
     * Ponto onde a serra pode cair SEM ficar inalcançável.
     *
     * Faz uma busca em largura (4 vizinhos, conservadora: não conta "passar
     * pela quina" entre dois buracos/paredes) pelos tiles pisáveis a partir
     * dos tiles onde os jogadores estão. Se o tile do ponto pedido for
     * alcançável, mantém o ponto exato; senão devolve o CENTRO do tile
     * alcançável mais próximo. Cobre buraco, parede autoral, moldura, vão de
     * porta (fora da grade) e "ilhas" de piso cercadas por buracos.
     *
     * @param {number} x  ponto pedido (mundo)
     * @param {number} y
     * @param {{x:number,y:number}[]} players
     * @returns {{x:number,y:number}}
     */
    reachableDropPoint(x, y, players) {
        const tiles = this._floor();
        if (!tiles) return { x, y };
        const rect = this.rooms.cellRect();
        const wallSet = new Set((tiles.walls || []).map(w => `${w.col},${w.row}`));
        const walkable = (c, r) => this._isWalkable(tiles, c, r, wallSet);

        // BFS a partir dos tiles (pisáveis) dos jogadores.
        const reached = new Set();
        const queue = [];
        for (const p of players) {
            const { col, row } = this._toTile(p.x, p.y, rect);
            const key = `${col},${row}`;
            if (walkable(col, row) && !reached.has(key)) {
                reached.add(key);
                queue.push([col, row]);
            }
        }
        // Nenhum jogador sobre piso (ex.: ambos caindo): qualquer tile pisável
        // serve como candidato — melhor que deixar a serra num buraco.
        const anyWalkable = queue.length === 0;
        for (let i = 0; i < queue.length; i++) {
            const [c, r] = queue[i];
            for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nc = c + dc, nr = r + dr;
                const key = `${nc},${nr}`;
                if (reached.has(key) || !walkable(nc, nr)) continue;
                reached.add(key);
                queue.push([nc, nr]);
            }
        }
        const ok = (c, r) => anyWalkable ? walkable(c, r) : reached.has(`${c},${r}`);

        const { col, row } = this._toTile(x, y, rect);
        if (ok(col, row)) return { x, y };

        // Tile alcançável cujo centro está mais perto do ponto pedido.
        let best = null;
        let bestDist = Infinity;
        for (let r = 0; r < tiles.rows; r++) {
            for (let c = 0; c < tiles.cols; c++) {
                if (!ok(c, r)) continue;
                const cx = rect.x + (c + 0.5) * TILE;
                const cy = rect.y + (r + 0.5) * TILE;
                const d = (cx - x) ** 2 + (cy - y) ** 2;
                if (d < bestDist) {
                    bestDist = d;
                    best = { x: cx, y: cy };
                }
            }
        }
        return best ?? { x, y };
    }

    // Garante que um jogador não nasça sobre um buraco: se o tile atual não for
    // piso válido, busca em anéis crescentes o tile seguro mais próximo e
    // recoloca o jogador no centro dele (zerando a velocidade).
    ensureSafeSpawn(player, rect = this.rooms.cellRect()) {
        const tiles = this._floor();
        if (!tiles) return;

        const isSafe = (c, r) => {
            const value = this._tileValue(tiles, c, r);
            // Dentro da sala, não ser parede de borda e não ser buraco.
            return value !== undefined && value >= 0 &&
                c > 0 && r > 0 && c < tiles.cols - 1 && r < tiles.rows - 1;
        };

        const { col, row } = this._toTile(player.x, player.y, rect);
        if (isSafe(col, row)) return;

        const maxRadius = Math.max(tiles.cols, tiles.rows);
        for (let radius = 1; radius < maxRadius; radius++) {
            for (let dr = -radius; dr <= radius; dr++) {
                for (let dc = -radius; dc <= radius; dc++) {
                    if (Math.max(Math.abs(dr), Math.abs(dc)) !== radius) continue;
                    const c = col + dc, r = row + dr;
                    if (!isSafe(c, r)) continue;
                    player.x = rect.x + (c + 0.5) * TILE;
                    player.y = rect.y + (r + 0.5) * TILE;
                    player.vx = 0;
                    player.vy = 0;
                    return;
                }
            }
        }
    }
}
