import { TILE, HOLE_TILE, HOLE_FALL } from '../config/GameConfig.js';

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

    // Queda em buracos COM RESISTÊNCIA (ver HOLE_FALL). Usa os PÉS do
    // jogador (centro + footOffset) e mede a PROFUNDIDADE deles dentro do
    // buraco (distância até o piso pisável mais próximo):
    //   - fora do buraco: nada acontece (e a contagem de queda zera);
    //   - dentro do buraco: a velocidade para dentro é freada e um empurrão
    //     (proporcional à profundidade) devolve o jogador ao piso;
    //   - além da beirada (`edgeMargin`) por `graceFrames` frames seguidos: cai.
    // A queda leva à morte ao fim da animação. Já espera que a posição esteja
    // confinada aos bounds.
    checkHoleFalls(players) {
        const tiles = this._floor();
        if (!tiles) return;
        const rect = this.rooms.cellRect();
        const wallSet = new Set((tiles.walls || []).map(w => `${w.col},${w.row}`));
        const { edgeMargin, inwardDamping, pushBack, graceFrames, footOffset = 0 } = HOLE_FALL;

        for (const player of players) {
            if (player.falling) continue;
            const hole = this._holeDepth(tiles, rect, wallSet, player.x, player.y + footOffset);
            if (!hole) { player.holeGrace = 0; continue; }

            const { depth, nx, ny, col, row } = hole;
            const beyondEdge = depth > edgeMargin;
            player.holeGrace = beyondEdge ? (player.holeGrace ?? 0) + 1 : 0;

            if (beyondEdge && player.holeGrace >= graceFrames) {
                player.holeGrace = 0;
                // Centro do tile do buraco, para o sprite afundar alinhado.
                player.startFalling(rect.x + (col + 0.5) * TILE, rect.y + (row + 0.5) * TILE);
                continue;
            }

            // (nx, ny) aponta para o piso. Sem piso por perto (miolo de um
            // buraco grande) não há para onde empurrar: só a contagem vale.
            if (nx === 0 && ny === 0) continue;

            // Freia só a componente que vai PARA DENTRO do buraco (andar ao
            // longo da beirada ou voltar ao piso continua livre).
            const inward = -(player.vx * nx + player.vy * ny);
            if (inward > 0) {
                const cut = inward * (1 - inwardDamping);
                player.vx += nx * cut;
                player.vy += ny * cut;
            }

            // Empurrão de volta ao piso, mais forte quanto mais fundo. Tem um
            // mínimo (senão só se aproxima da borda sem nunca sair do buraco)
            // e não passa do necessário para pisar de volta no piso.
            const k = Math.max(0.35, Math.min(1, depth / edgeMargin));
            const push = Math.min(depth + 0.5, pushBack * k);
            player.x += nx * push;
            player.y += ny * push;
        }
    }

    // Profundidade de um ponto do MUNDO dentro de um buraco: distância até o
    // tile PISÁVEL mais próximo (vizinhança 3x3) e a direção (unitária) até
    // ele. Retorna null se o ponto não está sobre um buraco. Sem piso pisável
    // na vizinhança, depth = Infinity e direção (0, 0).
    _holeDepth(tiles, rect, wallSet, x, y) {
        const { col, row } = this._toTile(x, y, rect);
        if (this._tileValue(tiles, col, row) !== HOLE_TILE) return null;

        let best = Infinity, bx = 0, by = 0;
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const c = col + dc, r = row + dr;
                if (!this._isWalkable(tiles, c, r, wallSet)) continue;
                // Ponto do tile vizinho mais próximo de (x, y).
                const left = rect.x + c * TILE, top = rect.y + r * TILE;
                const px = Math.max(left, Math.min(left + TILE, x));
                const py = Math.max(top, Math.min(top + TILE, y));
                const d = Math.hypot(px - x, py - y);
                if (d < best) { best = d; bx = px - x; by = py - y; }
            }
        }
        if (best === Infinity) return { depth: Infinity, nx: 0, ny: 0, col, row };
        const len = best || 1;
        return { depth: best, nx: bx / len, ny: by / len, col, row };
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
