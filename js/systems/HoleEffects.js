import { TILE, HOLE_TILE, HOLE_FALL, HOLE_FX } from '../config/GameConfig.js';

const rand = (a, b) => a + Math.random() * (b - a);

export class HoleEffects {

    constructor({ rooms, cfg = HOLE_FX }) {
        this.rooms = rooms;
        this.cfg = cfg;
        this.motes = [];
        this._tiles = null;
        this._rect = null;
        this._holeRects = [];
        this._lips = [];
        this._sides = [];
        this._fallSeen = new WeakSet();
    }

    clear() {
        this.motes.length = 0;
        this._tiles = null;
    }

    _isHole(c, r) {
        return this._tiles?.floor?.[r]?.[c] === HOLE_TILE;
    }

    _isHoleWorld(x, y) {
        const rect = this._rect;
        return this._isHole(Math.floor((x - rect.x) / TILE), Math.floor((y - rect.y) / TILE));
    }

    _rebuild(tiles) {
        this.motes.length = 0;
        this._tiles = tiles;
        this._rect = this.rooms.cellRect();
        this._holeRects = [];
        this._lips = [];
        this._sides = [];
        if (!tiles?.floor) return;

        const { x: ox, y: oy } = this._rect;
        const inset = this.cfg.pixel * 1.5;
        tiles.floor.forEach((line, r) => line.forEach((value, c) => {
            if (value !== HOLE_TILE) return;
            const x = ox + c * TILE, y = oy + r * TILE;
            this._holeRects.push({ x, y, w: TILE, h: TILE });
            if (!this._isHole(c, r - 1)) this._lips.push({ x, y });
            if (!this._isHole(c - 1, r)) this._sides.push({ x: x + inset, y });
            if (!this._isHole(c + 1, r)) this._sides.push({ x: x + TILE - inset, y });
        }));
    }

    _spawn(kind, x, y, vx = 0, vy = 0) {
        if (this.motes.length >= this.cfg.maxMotes) return;
        const k = this.cfg[kind];
        const life = Math.round(rand(k.life[0], k.life[1]));
        const big = kind === "crumbs" && Math.random() < k.bigChance;
        this.motes.push({ kind, x, y, y0: y, vx, vy, life, maxLife: life, size: big ? 2 : 1 });
    }

    burst(x, y, count, spread = this.cfg.crumbs.spread) {
        for (let i = 0; i < count; i++) {
            this._spawn("crumbs", x + rand(-14, 14), y + rand(-6, 6), rand(-spread, spread), rand(-0.6, 0.4));
        }
    }

    update(players = []) {
        const tiles = this.rooms.currentTiles;
        if (tiles !== this._tiles) this._rebuild(tiles);
        if (!this._holeRects.length) return;

        const { dust, crumbs } = this.cfg;
        for (const lip of this._lips) {
            if (Math.random() < dust.lipRate) this._spawn("dust", lip.x + rand(0, TILE), lip.y + this.cfg.pixel, rand(-dust.drift, dust.drift), 0);
        }
        for (const side of this._sides) {
            if (Math.random() < dust.sideRate) this._spawn("dust", side.x, side.y + rand(0, TILE), rand(-dust.drift, dust.drift), 0);
        }

        const footOffset = HOLE_FALL.footOffset ?? 0;
        for (const p of players) {
            if (p.falling) {
                if (!this._fallSeen.has(p)) {
                    this._fallSeen.add(p);
                    this.burst(p.x, p.y + footOffset, crumbs.fallBurst);
                }
                continue;
            }
            this._fallSeen.delete(p);
            if (Math.random() >= crumbs.edgeRate) continue;
            const reach = (HOLE_FALL.edgeMargin ?? 8) + 4;
            const fy = p.y + footOffset;
            const probes = [[0, 0], [reach, 0], [-reach, 0], [0, reach], [0, -reach]];
            const hit = probes.find(([dx, dy]) => this._isHoleWorld(p.x + dx, fy + dy));
            if (hit) {
                this._spawn("crumbs", p.x + hit[0] + rand(-6, 6), fy + hit[1], rand(-0.4, 0.4) + p.vx * 0.15, Math.max(0, p.vy * 0.2));
            }
        }

        for (let i = this.motes.length - 1; i >= 0; i--) {
            const m = this.motes[i];
            const k = this.cfg[m.kind];
            m.vy = Math.min(k.maxSpeed, m.vy + k.gravity);
            m.vx *= 0.96;
            m.x += m.vx;
            m.y += m.vy;
            m.life--;
            const depth = m.y - m.y0;
            if (m.life <= 0 || depth > k.fadeDepth || !this._isHoleWorld(m.x, m.y)) this.motes.splice(i, 1);
        }
    }

    _clipTo(ctx, rects) {
        ctx.beginPath();
        for (const r of rects) ctx.rect(r.x, r.y, r.w, r.h);
        ctx.clip();
    }

    draw(ctx) {
        if (!this.motes.length) return;
        const px = this.cfg.pixel;
        ctx.save();
        this._clipTo(ctx, this._holeRects);
        for (const m of this.motes) {
            const k = this.cfg[m.kind];
            const depthK = Math.max(0, 1 - (m.y - m.y0) / k.fadeDepth);
            const lifeK = Math.min(1, m.life / 10);
            const a = k.alpha * depthK * lifeK;
            if (a <= 0.02) continue;
            const s = px * m.size;
            ctx.fillStyle = `rgba(${this.cfg.color}, ${a.toFixed(3)})`;
            ctx.fillRect(Math.round(m.x / px) * px, Math.round(m.y / px) * px, s, s);
        }
        ctx.restore();
    }

    // Only the floor south of the pit can hide a falling body, so each column of the
    // fall row is open upward and ends at the bottom of its run of hole tiles.
    _fallClip(x, y) {
        if (!this._tiles?.floor) return null;
        const rect = this._rect;
        const col = Math.floor((x - rect.x) / TILE);
        const row = Math.floor((y - rect.y) / TILE);
        if (!this._isHole(col, row)) return null;

        let c0 = col, c1 = col;
        while (this._isHole(c0 - 1, row)) c0--;
        while (this._isHole(c1 + 1, row)) c1++;

        const top = rect.y - TILE * 4;
        const rects = [];
        for (let c = c0; c <= c1; c++) {
            let r = row;
            while (this._isHole(c, r + 1)) r++;
            rects.push({ x: rect.x + c * TILE, y: top, w: TILE, h: rect.y + (r + 1) * TILE - top });
        }
        return rects;
    }

    drawFalling(ctx, player) {
        const { sink, darken } = this.cfg.fall;
        const t = player.fallDuration ? 1 - player.fallTimer / player.fallDuration : 1;
        const clip = this._fallClip(player.fallX, player.fallY);

        ctx.save();
        if (clip) this._clipTo(ctx, clip);
        ctx.translate(0, sink * (1 - (1 - t) * (1 - t)));
        if ("filter" in ctx) ctx.filter = `brightness(${(1 - darken * t).toFixed(3)})`;
        player.draw(ctx);
        ctx.restore();
    }
}
