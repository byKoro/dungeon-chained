import { TILE, HOLE_TILE, HOLE_FALL } from '../config/GameConfig.js';

export class DungeonTileQuery {

    constructor({ rooms, holeFall = HOLE_FALL }) {
        this.rooms = rooms;
        this.holeFall = holeFall;
    }

    _floor() {
        const tiles = this.rooms.currentTiles;
        return tiles?.floor ? tiles : null;
    }

    _toTile(x, y, rect = this.rooms.cellRect()) {
        return {
            col: Math.floor((x - rect.x) / TILE),
            row: Math.floor((y - rect.y) / TILE)
        };
    }

    _tileValue(tiles, col, row) {
        return tiles.floor[row]?.[col];
    }

    isHoleAtWorld(x, y) {
        const tiles = this._floor();
        if (!tiles) return false;
        const { col, row } = this._toTile(x, y);
        const value = this._tileValue(tiles, col, row);
        if (value === undefined) return false;
        return value === HOLE_TILE;
    }

    feetInHole(player) {
        return this.isHoleAtWorld(player.x, player.y + (HOLE_FALL.footOffset ?? 0));
    }

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

    checkHoleFalls(players) {
        const tiles = this._floor();
        if (!tiles) return;
        const rect = this.rooms.cellRect();
        const { edgeMargin, inwardDamping, pushBack, footOffset = 0 } = this.holeFall;

        for (const player of players) {
            if (player.falling || player.dashing) continue;
            const fx = player.x, fy = player.y + footOffset;
            const { col, row } = this._toTile(fx, fy, rect);
            // Pés no tile do buraco: cai na hora.
            if (this._tileValue(tiles, col, row) === HOLE_TILE) {
                // Assistência do dash: logo após um dash, "ganha" a borda se houver chão seguro bem perto.
                if (player.holeGrace > 0 && this._dashLandAssist(player, tiles, rect, col, row)) continue;
                player.startFalling(rect.x + (col + 0.5) * TILE, rect.y + (row + 0.5) * TILE);
                continue;
            }

            // Faixa de resistência no piso, antes da borda: freia o passo para dentro e empurra de volta.
            const edge = this._holeEdge(tiles, rect, col, row, fx, fy);
            if (!edge || edge.dist >= edgeMargin) continue;
            const { nx, ny } = edge;
            const inward = -(player.vx * nx + player.vy * ny);
            if (inward > 0) {
                const cut = inward * (1 - inwardDamping);
                player.vx += nx * cut;
                player.vy += ny * cut;
            }
            const push = pushBack * Math.max(0.35, 1 - edge.dist / edgeMargin);
            player.x += nx * push;
            player.y += ny * push;
        }
    }

    // Assistência do dash: os pés pararam sobre o buraco logo depois de um dash. Procura o tile de chão
    // seguro mais perto (até `dashLandAssistTiles` de distância do centro do tile do buraco), preferindo
    // a direção do dash — como se tivesse "ganhado" a borda — e coloca o jogador nele. true = salvou a queda.
    _dashLandAssist(player, tiles, rect, col, row) {
        const reachTiles = this.holeFall.dashLandAssistTiles ?? 1.5;
        const reach = Math.max(1, Math.ceil(reachTiles));
        const maxDist = reachTiles + 0.5; // em tiles, do centro do tile do buraco ao centro do tile de chão
        const safe = (c, r) => {
            const value = this._tileValue(tiles, c, r);
            return value !== undefined && value >= 0 &&
                c > 0 && r > 0 && c < tiles.cols - 1 && r < tiles.rows - 1;
        };
        const dirX = player.dashDirX ?? 0, dirY = player.dashDirY ?? 0;
        let best = null, bestScore = Infinity;
        for (let dr = -reach; dr <= reach; dr++) {
            for (let dc = -reach; dc <= reach; dc++) {
                if (!dr && !dc || !safe(col + dc, row + dr)) continue;
                const tileDist = Math.hypot(dc, dr);
                if (tileDist > maxDist) continue;
                // Pontua por distância em tiles, descontando o chão à frente do dash (o dash "cruza").
                const ahead = tileDist ? (dc * dirX + dr * dirY) / tileDist : 0;
                const score = tileDist - Math.max(0, ahead) * 0.6;
                if (score < bestScore) { bestScore = score; best = { c: col + dc, r: row + dr }; }
            }
        }
        if (!best) return false;
        player.x = rect.x + (best.c + 0.5) * TILE;
        player.y = rect.y + (best.r + 0.5) * TILE - (this.holeFall.footOffset ?? 0);
        return true;
    }

    // Distância dos pés até o tile de buraco vizinho mais perto e a direção para longe dele.
    _holeEdge(tiles, rect, col, row, x, y) {
        let best = null;
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if ((!dr && !dc) || this._tileValue(tiles, col + dc, row + dr) !== HOLE_TILE) continue;
                const left = rect.x + (col + dc) * TILE, top = rect.y + (row + dr) * TILE;
                const px = Math.max(left, Math.min(left + TILE, x));
                const py = Math.max(top, Math.min(top + TILE, y));
                const dist = Math.hypot(x - px, y - py);
                if (!best || dist < best.dist) best = { dist, nx: dist ? (x - px) / dist : -dc, ny: dist ? (y - py) / dist : -dr };
            }
        }
        if (!best) return null;
        const len = Math.hypot(best.nx, best.ny) || 1;
        return { dist: best.dist, nx: best.nx / len, ny: best.ny / len };
    }

    _isWalkable(tiles, c, r, wallSet) {
        const value = this._tileValue(tiles, c, r);
        if (value === undefined || value < 0) return false;
        if (c <= 0 || r <= 0 || c >= tiles.cols - 1 || r >= tiles.rows - 1) return false;
        return !wallSet.has(`${c},${r}`);
    }

    reachableDropPoint(x, y, players) {
        const tiles = this._floor();
        if (!tiles) return { x, y };
        const rect = this.rooms.cellRect();
        const ok = this._reachableTest(tiles, rect, players);

        const { col, row } = this._toTile(x, y, rect);
        if (ok(col, row)) return { x, y };
        return this._nearestTileCenter(tiles, rect, x, y, ok) ?? { x, y };
    }

    safeDropPoint(x, y, seeds) {
        const tiles = this._floor();
        if (!tiles) return { x, y };
        const rect = this.rooms.cellRect();
        const { ok, awayFromHoles } = this._dropTests(tiles, rect, seeds);
        const { col, row } = this._toTile(x, y, rect);
        if (awayFromHoles(col, row)) return { x, y };
        return this._nearestTileCenter(tiles, rect, x, y, awayFromHoles)
            ?? this._nearestTileCenter(tiles, rect, x, y, ok)
            ?? { x, y };
    }

    _dropTests(tiles, rect, seeds) {
        const ok = this._reachableTest(tiles, rect, seeds);
        const awayFromHoles = (c, r) => {
            if (!ok(c, r)) return false;
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (this._tileValue(tiles, c + dc, r + dr) === HOLE_TILE) return false;
                }
            }
            return true;
        };
        return { ok, awayFromHoles };
    }

    safeDropRoute(x, y, seeds, isBlocked = () => false) {
        const tiles = this._floor();
        if (!tiles) return [];
        const rect = this.rooms.cellRect();
        const { ok, awayFromHoles } = this._dropTests(tiles, rect, seeds);
        const walls = new Set((tiles.walls || []).map(w => `${w.col},${w.row}`));
        const center = (c, r) => ({ x: rect.x + (c + 0.5) * TILE, y: rect.y + (r + 0.5) * TILE });
        const canFly = (c, r) => {
            const value = this._tileValue(tiles, c, r);
            return c > 0 && r > 0 && c < tiles.cols - 1 && r < tiles.rows - 1
                && (value >= 0 || value === HOLE_TILE) && !walls.has(`${c},${r}`);
        };
        const clear = (a, b) => {
            const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (TILE / 8)));
            for (let i = 1; i <= steps; i++) {
                const px = a.x + (b.x - a.x) * i / steps, py = a.y + (b.y - a.y) * i / steps;
                const { col, row } = this._toTile(px, py, rect);
                if (!canFly(col, row) || isBlocked(px, py)) return false;
            }
            return true;
        };
        const { col, row } = this._toTile(x, y, rect);
        const queue = [], seen = new Set();
        const add = (c, r, parent) => {
            const key = `${c},${r}`;
            if (seen.has(key) || !canFly(c, r)) return;
            const point = center(c, r);
            if (!clear(parent?.point ?? { x, y }, point)) return;
            seen.add(key);
            queue.push({ c, r, point, parent });
        };
        const roots = [];
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) roots.push({ c: col + dc, r: row + dr });
        roots.sort((a, b) => {
            const pa = center(a.c, a.r), pb = center(b.c, b.r);
            return Math.hypot(pa.x - x, pa.y - y) - Math.hypot(pb.x - x, pb.y - y);
        });
        for (const root of roots) add(root.c, root.r, null);
        let goal = null, fallback = null;
        for (let i = 0; i < queue.length; i++) {
            const node = queue[i];
            if (awayFromHoles(node.c, node.r)) { goal = node; break; }
            if (!fallback && ok(node.c, node.r)) fallback = node;
            for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) add(node.c + dc, node.r + dr, node);
        }
        goal ??= fallback;
        const route = [];
        while (goal) { route.push(goal.point); goal = goal.parent; }
        return route.reverse();
    }

    _nearestTileCenter(tiles, rect, x, y, test) {
        let best = null;
        let bestDist = Infinity;
        for (let r = 0; r < tiles.rows; r++) {
            for (let c = 0; c < tiles.cols; c++) {
                if (!test(c, r)) continue;
                const cx = rect.x + (c + 0.5) * TILE;
                const cy = rect.y + (r + 0.5) * TILE;
                const d = (cx - x) ** 2 + (cy - y) ** 2;
                if (d < bestDist) {
                    bestDist = d;
                    best = { x: cx, y: cy };
                }
            }
        }
        return best;
    }

    _reachableTest(tiles, rect, players) {
        const wallSet = new Set((tiles.walls || []).map(w => `${w.col},${w.row}`));
        const walkable = (c, r) => this._isWalkable(tiles, c, r, wallSet);

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
        return (c, r) => anyWalkable ? walkable(c, r) : reached.has(`${c},${r}`);
    }

    ensureSafeSpawn(player, rect = this.rooms.cellRect()) {
        const tiles = this._floor();
        if (!tiles) return;

        const isSafe = (c, r) => {
            const value = this._tileValue(tiles, c, r);

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
