import { BARS, STAKE_LIGHT } from '../config/EventsConfig.js';
import { TILE, LIGHT_PIXEL_SCALE } from '../config/GameConfig.js';
import { findSafeFloorCell } from '../rooms/SafeSpawn.js';
import { InicialRoomScript } from './roomScripts/InicialRoomScript.js';

// Script por sala, escolhido pelo nome da sala do Editor 2.0. Cada script recebe uma API pequena (zonas, encontros,
// inimigos, grades, baús, falas) e guarda o próprio estado; os eventos concluídos sobrevivem à morte da dupla.
const ROOM_SCRIPTS = Object.freeze({ inicial: InicialRoomScript });

export class RoomEvents {
    constructor({ rooms, spawnSystem, getPlayers, chain, scrap = null, chests = null, dialogue = null, audio = null,
        particleSystem = null, renderer = null, assets = null, hooks = {}, scripts = ROOM_SCRIPTS, tile = TILE }) {
        Object.assign(this, { rooms, spawnSystem, getPlayers, chain, scrap, chests, dialogue, audio, particleSystem, renderer, assets, hooks, scripts, tile });
        this.reset();
    }

    reset() {
        this.completed = new Set();
        this._scripts = new Map();
        this._bars = new Map();
    }

    _script(room = this.rooms.current) {
        if (!room) return null;
        if (this._scripts.has(room.key)) return this._scripts.get(room.key);
        const Script = this.scripts[room.cell.authored?.name];
        const script = Script ? new Script(this._api(room)) : null;
        this._scripts.set(room.key, script);
        return script;
    }

    _api(room) {
        const self = this, tile = this.tile;
        const rect = () => this.rooms.cellRect(room.cell);
        const authored = room.cell.authored || {};
        return {
            room, tile, rect,
            authored,
            getPlayers: this.getPlayers, chain: this.chain, scrap: this.scrap, chests: this.chests,
            dialogue: this.dialogue, audio: this.audio, particleSystem: this.particleSystem, renderer: this.renderer, assets: this.assets,
            zone(id) {
                const z = (authored.zones || []).find(o => o.id === id);
                if (!z) return null;
                const r = rect();
                return { x: r.x + z.col * tile, y: r.y + z.row * tile, w: z.w * tile, h: z.h * tile };
            },
            // Os dois vivos e dentro da zona (design: "entrar na zona" = os dois).
            bothInZone(id) {
                const z = this.zone(id);
                const players = self.getPlayers() || [];
                return !!z && players.length > 0 && players.every(p => p && p.lives > 0 && !p.falling
                    && p.x >= z.x && p.x < z.x + z.w && p.y >= z.y && p.y < z.y + z.h);
            },
            encounter(id) {
                return (authored.encounters || []).find(e => e.id === id) || null;
            },
            isCompleted: id => self.completed.has(`${room.key}/${id}`),
            complete: id => self.completed.add(`${room.key}/${id}`),
            setBars: down => self._setBars(room, down),
            tileCenter(col, row) {
                const r = rect();
                return { x: r.x + (col + 0.5) * tile, y: r.y + (row + 0.5) * tile };
            },
            // Inimigo do encontro: nasce escondido e "cai" por `delay` steps (spawn congelado do MeleeEnemy).
            spawnEnemy(type, x, y, delay, { airborne = false } = {}) {
                const r = rect();
                const col = Math.floor((x - r.x) / tile), row = Math.floor((y - r.y) / tile);
                const safe = self._floorCellNear(room, col, row);
                if (!safe) return null;
                const same = safe.col === col && safe.row === row;
                const ex = same ? x : r.x + (safe.col + 0.5) * tile;
                const ey = same ? y : r.y + (safe.row + 0.5) * tile;
                const enemy = self.spawnSystem.createEnemy(ex, ey, 1, type);
                enemy.setNavigationFloor?.(room.tiles.floor, room.bounds, room.tiles.walls);
                // No ar (salto controlado pelo script): sem colisão, sem sombra do Game; revelação curta ao aparecer.
                if (airborne) { enemy.airborne = true; enemy.spawnFxDuration = 10; }
                enemy.beginFrozenSpawn?.(delay);
                room.enemies.push(enemy);
                return enemy;
            },
            removeEnemies(list) {
                room.enemies = room.enemies.filter(e => !list.includes(e));
            },
            hitStop: s => self.hooks.hitStop?.(s),
            pushPlayers(x, y, radius, force) {
                for (const p of self.getPlayers() || []) {
                    if (!p || p.falling || p.lives <= 0) continue;
                    const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy);
                    if (d >= radius) continue;
                    const k = force * (1 - d / radius), n = d || 1;
                    p.vx += (d ? dx / n : 1) * k;
                    p.vy += (d ? dy / n : 0) * k * 0.7;
                }
            },
            // Move um prop autorado (ex.: o baú que cai) e avisa quem guarda o layout dos props.
            moveProp(prop, col, row) {
                if (prop.col === col && prop.row === row) return;
                prop.col = col; prop.row = row;
                self.hooks.propsChanged?.(room);
            },
            drawPropFrame: (ctx, type, frame, dx, dy, sx, sy) => self.hooks.drawPropFrame?.(ctx, type, frame, dx, dy, sx, sy)
        };
    }

    // Luzes pedidas pelo script da sala (ex.: estacas), em coordenadas do mundo.
    renderLights(renderer, postProcessor) {
        for (const l of this._script()?.lights?.() || []) {
            const s = renderer.worldToScreen(l.x, l.y);
            const px = Math.max(2, Math.round((this.tile / 16) * s.zoom * LIGHT_PIXEL_SCALE));
            postProcessor.addLight(s.x, s.y, l.radius * s.zoom, px, 1, STAKE_LIGHT);
        }
    }

    // Tile de chão mais perto (o findSafeFloorCell não conhece as paredes autoradas: usa `kinds`).
    _floorCellNear(room, col, row, maxRing = 4) {
        const kinds = room.cell.authored?.kinds;
        const ok = (c, r) => kinds ? kinds[r]?.[c] === "f" : findSafeFloorCell(room.tiles.floor, c, r).found;
        for (let ring = 0; ring <= maxRing; ring++) {
            for (let dr = -ring; dr <= ring; dr++) for (let dc = -ring; dc <= ring; dc++) {
                if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue;
                if (ok(col + dc, row + dr)) return { col: col + dc, row: row + dr };
            }
        }
        return null;
    }

    _barsOf(room) {
        let bars = this._bars.get(room.key);
        if (!bars) { bars = { down: false, t: 0, landed: false }; this._bars.set(room.key, bars); }
        return bars;
    }

    _setBars(room, down) {
        const bars = this._barsOf(room);
        if (bars.down === down) return;
        bars.down = down;
        bars.landed = false;
        if (!down) this.renderer?.triggerShake(BARS.shake / 2);
        this.audio?.play(down ? "buttonPress" : "buttonRelease", { rateMultiplier: 0.7 });
    }

    update() {
        const room = this.rooms.current;
        if (!room) return;
        const bars = this._barsOf(room);
        const step = 1 / BARS.dropSteps;
        bars.t = bars.down ? Math.min(1, bars.t + step) : Math.max(0, bars.t - step);
        if (bars.down && bars.t >= 1 && !bars.landed) this._landBars(room, bars);
        this._script(room)?.update();
    }

    // A grade bate no chão: tremor, baque e poeira no pé de cada tile.
    _landBars(room, bars) {
        bars.landed = true;
        this.renderer?.triggerShake(BARS.shake);
        this.audio?.play("sawLand", { rateMultiplier: 0.6, volumeMultiplier: 0.7 });
        const r = this.rooms.cellRect();
        for (const b of room.cell.authored?.bars || []) {
            const x = r.x + (b.col + 0.5) * this.tile, y = r.y + (b.row + 1) * this.tile - 4;
            this.particleSystem?.triggerDust?.(x - 16, y, -1, 0.2, BARS.landDust);
            this.particleSystem?.triggerDust?.(x + 16, y, 1, 0.2, BARS.landDust);
        }
    }

    // Morte da dupla: encontros interrompidos voltam ao começo; concluídos ficam.
    onDeath() {
        for (const script of this._scripts.values()) script?.onDeath?.();
        for (const [key, bars] of this._bars) {
            if (!bars.down) continue;
            bars.down = false;
            bars.landed = false;
            bars.t = 0;
            void key;
        }
    }

    // Caixas de colisão das grades descidas (bloqueiam a partir de `solidAt` da descida).
    solidBoxes() {
        const room = this.rooms.current;
        if (!room || this._barsOf(room).t < BARS.solidAt) return [];
        const r = this.rooms.cellRect();
        return (room.cell.authored?.bars || []).map(b => ({ x: r.x + b.col * this.tile, y: r.y + b.row * this.tile, w: this.tile, h: this.tile }));
    }

    drawFloor(ctx) {
        this._script()?.drawFloor?.(ctx);
    }

    drawAir(ctx) {
        this._script()?.drawAir?.(ctx);
    }

    // Grades ordenadas por y com as entidades (base no pé do tile).
    drawables() {
        const room = this.rooms.current;
        if (!room) return [];
        const t = this._barsOf(room).t;
        if (t <= 0) return [];
        const r = this.rooms.cellRect();
        const list = room.cell.authored?.bars || [];
        const at = new Set(list.map(b => `${b.col},${b.row}`));
        return list.map(b => {
            const x = r.x + b.col * this.tile, base = r.y + (b.row + 1) * this.tile;
            const left = !at.has(`${b.col - 1},${b.row}`), right = !at.has(`${b.col + 1},${b.row}`);
            const key = left && right ? "barsSingle" : left ? "barsLeft" : right ? "barsRight" : "barsMid";
            return { y: base - 14, feetSortY: base, draw: ctx => this._drawBar(ctx, key, x, base, t) };
        });
    }

    // Cai de cima com aceleração (sobe pelo mesmo caminho); a sombra no chão escurece conforme chega.
    _drawBar(ctx, key, x, base, t) {
        const img = this.assets?.get?.(key);
        if (!img?.complete || !img.naturalWidth) return;
        const T = this.tile, px = T / 16;
        const drop = Math.round((1 - t * t) * BARS.dropHeight / px) * px;
        ctx.save();
        ctx.fillStyle = BARS.shadow;
        ctx.globalAlpha = t;
        ctx.fillRect(x, base - 2 * px, T, 2 * px);
        ctx.globalAlpha = Math.min(1, t * 4);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, x, base - BARS.height - drop, T, BARS.height);
        ctx.restore();
    }
}
