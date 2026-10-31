import { TILE, HOLE_TILE, HOLE_FALL } from '../../config/GameConfig.js';
import { isSafeFloorCell, findSafeFloorCell } from '../../rooms/SafeSpawn.js';

/**
 * DungeonSim - Engine-agnostic room geometry, tile queries, and hole fall physics.
 * Extracted from DungeonTileQuery.js and SafeSpawn.js.
 * Zero browser or Canvas dependencies. Directly portable to C# class DungeonSim.
 */
export class DungeonSim {
    constructor({
        cellRect = { x: 0, y: 0, w: 14 * TILE, h: 9 * TILE },
        floor = null,
        walls = [],
        doors = [],
        cols = 14,
        rows = 9,
        holeFall = HOLE_FALL
    } = {}) {
        this.cellRect = cellRect;
        this.cols = cols;
        this.rows = rows;
        this.holeFall = holeFall;
        this.doors = doors;
        this.walls = walls;

        if (floor && Array.isArray(floor)) {
            this.floor = floor;
        } else if (floor && floor.floor) {
            this.floor = floor.floor;
            if (floor.walls) this.walls = floor.walls;
        } else {
            // Default empty room: perimeter walls, interior walkable floor
            this.floor = [];
            for (let r = 0; r < rows; r++) {
                const row = [];
                for (let c = 0; c < cols; c++) {
                    row.push(r === 0 || r === rows - 1 || c === 0 || c === cols - 1 ? 0 : 16);
                }
                this.floor.push(row);
            }
        }

        this.wallBounds = [];
        this._buildWallBounds();
    }

    _buildWallBounds() {
        this.wallBounds = [];
        // Add perimeter and authored wall tiles as collision boxes
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const val = this.floor[r]?.[c];
                const isWallTile = (r === 0 || r === this.rows - 1 || c === 0 || c === this.cols - 1);
                if (isWallTile && !this._isDoorTile(c, r)) {
                    this.wallBounds.push({
                        x: this.cellRect.x + c * TILE,
                        y: this.cellRect.y + r * TILE,
                        w: TILE,
                        h: TILE
                    });
                }
            }
        }
        for (const w of this.walls) {
            this.wallBounds.push({
                x: this.cellRect.x + w.col * TILE,
                y: this.cellRect.y + w.row * TILE,
                w: TILE,
                h: TILE
            });
        }
    }

    _isDoorTile(col, row) {
        for (const d of this.doors) {
            if (d.col === col && d.row === row) return true;
        }
        return false;
    }

    toTile(x, y) {
        return {
            col: Math.floor((x - this.cellRect.x) / TILE),
            row: Math.floor((y - this.cellRect.y) / TILE)
        };
    }

    tileValue(col, row) {
        return this.floor[row]?.[col];
    }

    isHoleAtWorld(x, y) {
        const { col, row } = this.toTile(x, y);
        const val = this.tileValue(col, row);
        return val === HOLE_TILE;
    }

    feetInHole(player) {
        return this.isHoleAtWorld(player.x, player.y + (this.holeFall.footOffset ?? 14));
    }

    unstainableRects() {
        if (this._unstainableRects) return this._unstainableRects;
        const seen = new Set();
        const rects = [];
        const add = (c, r) => {
            const key = `${c},${r}`;
            if (seen.has(key)) return;
            seen.add(key);
            rects.push({ x: this.cellRect.x + c * TILE, y: this.cellRect.y + r * TILE, w: TILE, h: TILE });
        };

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.floor[r]?.[c] === HOLE_TILE) add(c, r);
            }
        }
        for (const w of this.walls) add(w.col, w.row);
        this._unstainableRects = rects;
        return rects;
    }

    checkHoleFalls(players, events = null) {
        const { edgeMargin, inwardDamping, pushBack, footOffset = 14 } = this.holeFall;

        for (const player of players) {
            if (player.falling || player.dashing) continue;
            const fx = player.x, fy = player.y + footOffset;
            const { col, row } = this.toTile(fx, fy);

            if (this.tileValue(col, row) === HOLE_TILE) {
                player.startFalling(
                    this.cellRect.x + (col + 0.5) * TILE,
                    this.cellRect.y + (row + 0.5) * TILE,
                    events
                );
                continue;
            }

            const edge = this._holeEdge(col, row, fx, fy);
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

    _holeEdge(col, row, x, y) {
        let best = null;
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if ((!dr && !dc) || this.tileValue(col + dc, row + dr) !== HOLE_TILE) continue;
                const left = this.cellRect.x + (col + dc) * TILE;
                const top = this.cellRect.y + (row + dr) * TILE;
                const px = Math.max(left, Math.min(left + TILE, x));
                const py = Math.max(top, Math.min(top + TILE, y));
                const dist = Math.hypot(x - px, y - py);
                if (!best || dist < best.dist) {
                    best = { dist, nx: dist ? (x - px) / dist : -dc, ny: dist ? (y - py) / dist : -dr };
                }
            }
        }
        if (!best) return null;
        const len = Math.hypot(best.nx, best.ny) || 1;
        return { dist: best.dist, nx: best.nx / len, ny: best.ny / len };
    }

    _isWalkable(c, r, wallSet) {
        const value = this.tileValue(c, r);
        if (value === undefined || value < 0 || value === HOLE_TILE) return false;
        if (c <= 0 || r <= 0 || c >= this.cols - 1 || r >= this.rows - 1) return false;
        return !wallSet.has(`${c},${r}`);
    }

    safeDropPoint(x, y, seeds = []) {
        const wallSet = new Set(this.walls.map(w => `${w.col},${w.row}`));
        const walkable = (c, r) => this._isWalkable(c, r, wallSet);

        const awayFromHoles = (c, r) => {
            if (!walkable(c, r)) return false;
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (this.tileValue(c + dc, r + dr) === HOLE_TILE) return false;
                }
            }
            return true;
        };

        const nearest = (test) => {
            let best = null;
            let bestDist = Infinity;
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    if (!test(c, r)) continue;
                    const cx = this.cellRect.x + (c + 0.5) * TILE;
                    const cy = this.cellRect.y + (r + 0.5) * TILE;
                    const d = (cx - x) ** 2 + (cy - y) ** 2;
                    if (d < bestDist) {
                        bestDist = d;
                        best = { x: cx, y: cy };
                    }
                }
            }
            return best;
        };

        return nearest(awayFromHoles) ?? nearest(walkable) ?? { x, y };
    }

    ensureSafeSpawn(entity) {
        const { col, row } = this.toTile(entity.x, entity.y);
        const result = findSafeFloorCell(this.floor, col, row);
        if (result.found && result.moved) {
            entity.x = this.cellRect.x + (result.col + 0.5) * TILE;
            entity.y = this.cellRect.y + (result.row + 0.5) * TILE;
            entity.vx = 0;
            entity.vy = 0;
        }
    }

    getRenderState() {
        return {
            cellRect: this.cellRect,
            cols: this.cols,
            rows: this.rows,
            wallBounds: this.wallBounds,
            doors: this.doors
        };
    }
}
