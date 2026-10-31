import { BARS, STAKE_LIGHT, ZONE_SPAWN } from '../config/EventsConfig.js';
import { TILE, LIGHT_PIXEL_SCALE } from '../config/GameConfig.js';
import { findSafeFloorCell } from '../rooms/SafeSpawn.js';
import { objectsOwnedByZone } from '../rooms/ZoneAssign.js';
import { InicialRoomScript } from './roomScripts/InicialRoomScript.js';
import { BotasRoomScript } from './roomScripts/BotasRoomScript.js';
import { RopeChests } from './RopeChests.js';
import { RopeGate } from './RopeGate.js';
import { ZoneSpawner } from './ZoneSpawner.js';
import { CageEncounter } from './CageEncounter.js';

// Script por sala, escolhido pelo nome da sala do Editor 2.0. Cada script recebe uma API pequena (zonas, encontros,
// inimigos, grades, baús, falas) e guarda o próprio estado; os eventos concluídos sobrevivem à morte da dupla.
const ROOM_SCRIPTS = Object.freeze({ inicial: InicialRoomScript, botas: BotasRoomScript });

export class RoomEvents {
    constructor({ rooms, spawnSystem, getPlayers, chain, scrap = null, chests = null, dialogue = null, audio = null,
        particleSystem = null, renderer = null, assets = null, camera = null, hooks = {}, scripts = ROOM_SCRIPTS, tile = TILE }) {
        Object.assign(this, { rooms, spawnSystem, getPlayers, chain, scrap, chests, dialogue, audio, particleSystem, renderer, assets, camera, hooks, scripts, tile });
        this.reset();
    }

    reset() {
        this.completed = new Set();
        this._scripts = new Map();
        this._ropes = new Map();
        this._gates = new Map();
        this._zoneSpawns = new Map();
        this._cages = new Map();
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

    // Cordas com baú da sala (qualquer sala, independente do script).
    _ropeChests(room) {
        if (this._ropes.has(room.key)) return this._ropes.get(room.key);
        const ropes = new RopeChests({ api: this._api(room) });
        const value = ropes.valid ? ropes : null;
        this._ropes.set(room.key, value);
        return value;
    }

    // Cordas com grade da sala (qualquer sala): cortar a estaca levanta os tiles de grade dela.
    _ropeGate(room) {
        if (this._gates.has(room.key)) return this._gates.get(room.key);
        const gate = new RopeGate({ api: this._api(room) });
        const value = gate.valid ? gate : null;
        this._gates.set(room.key, value);
        return value;
    }

    // Gaiolas da sala: uma por zona que contém estacas `rope` (a zona dispara e delimita o encontro). Vale em qualquer sala.
    _cageList(room) {
        if (this._cages.has(room.key)) return this._cages.get(room.key);
        const api = this._api(room);
        const authored = room.cell.authored || {};
        const ropes = (authored.interactives || []).filter(o => o.type === "rope");
        const zones = authored.zones || [];
        // Cada estaca pertence a uma zona só (a menor que a contém): só criamos encontro para a zona DONA de alguma estaca.
        const zoneIds = new Set(zones.filter(z => objectsOwnedByZone(zones, ropes, z.id).length).map(z => z.id));
        for (const e of authored.encounters || []) if ((authored.zones || []).some(z => z.id === e.id)) zoneIds.add(e.id);
        const list = [...zoneIds].map(id => new CageEncounter({ api, zoneId: id, encounterId: id })).filter(c => c.valid);
        this._cages.set(room.key, list);
        return list;
    }

    // Zona-spawner da sala: inimigos soltos (autorados) que caem quando a dupla entra na zona deles.
    _zoneSpawn(room) {
        if (this._zoneSpawns.has(room.key)) return this._zoneSpawns.get(room.key);
        const spawner = new ZoneSpawner({ api: this._api(room), cfg: ZONE_SPAWN });
        const value = spawner.valid ? spawner : null;
        this._zoneSpawns.set(room.key, value);
        return value;
    }

    _handlers(room = this.rooms.current) {
        if (!room) return [];
        return [this._script(room), ...this._cageList(room), this._ropeChests(room), this._ropeGate(room), this._zoneSpawn(room)].filter(Boolean);
    }

    // Deixa os handlers reivindicarem seus inimigos autorados antes do intro genérico (chamado pelo Game na entrada).
    claimPendingEnemies(room = this.rooms.current) {
        if (room) this._zoneSpawn(room);
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
            // Inimigos vivos (não morrendo) com os pés dentro da zona — serve para saber se um encontro de zona acabou.
            livingEnemiesInZone(id) {
                const z = this.zone(id);
                if (!z) return 0;
                return (room.enemies || []).filter(e => e && e.state !== "dying"
                    && e.x >= z.x && e.x < z.x + z.w && e.y >= z.y && e.y < z.y + z.h).length;
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
            // Câmera cinematográfica: foca um ponto do mundo (zoom multiplica o de referência); null solta de volta.
            cameraFocus(x, y, zoom = 1) { if (self.camera) self.camera.focus = { x, y, zoom }; },
            clearCameraFocus() { if (self.camera) self.camera.focus = null; },
            // Tira um inimigo autorado da lista pendente da sala (o intro genérico não o spawna; o script assume).
            claimAuthoredEnemy(foe) { room.claimAuthoredEnemy?.(foe); },
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
            // Prop gerado em runtime (ex.: baú da corda com baú): entra na lista viva da sala, não no documento autorado.
            addProp(prop) {
                const list = room.tiles.props || (room.tiles.props = []);
                if (!list.includes(prop)) list.push(prop);
                self.hooks.propsChanged?.(room);
            },
            drawPropFrame: (ctx, type, frame, dx, dy, sx, sy) => self.hooks.drawPropFrame?.(ctx, type, frame, dx, dy, sx, sy)
        };
    }

    // Pontos de estaca cortáveis da sala atual, para a mira assistida do tackle da serra (mundo).
    aimPoints() {
        return this._handlers().flatMap(h => h.stakeAimPoints?.() ?? []);
    }

    // Luzes pedidas pelo script da sala (ex.: estacas), em coordenadas do mundo.
    renderLights(renderer, postProcessor) {
        for (const l of this._handlers().flatMap(h => h.lights?.() || [])) {
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
        if (!bars) { bars = { down: false, phase: "up", k: 0, t: 0 }; this._bars.set(room.key, bars); }
        return bars;
    }

    // `t` = quanto a grade desceu (0..1, decide a colisão); `phase` conduz a animação.
    _setBars(room, down) {
        const bars = this._barsOf(room);
        if (bars.down === down) return;
        bars.down = down;
        bars.k = 0;
        bars.phase = down ? "antic" : "raise";
        this.audio?.play(down ? "buttonPress" : "buttonRelease", { rateMultiplier: down ? 0.6 : 0.5 });
        if (!down) this.renderer?.triggerShake(BARS.shake / 3);
    }

    update() {
        const room = this.rooms.current;
        if (!room) return;
        this._updateBars(room, this._barsOf(room));
        for (const h of this._handlers(room)) h.update?.();
    }

    // Tranco (a grade solta e trepida na verga) → queda com gravidade → baque com quique → parada.
    // Subir é lento, rangendo, com poeira caindo da verga.
    _updateBars(room, bars) {
        const B = BARS;
        bars.k++;
        const to = phase => { bars.phase = phase; bars.k = 0; };
        if (bars.phase === "antic") {
            bars.t = 0;
            if (bars.k % 4 === 1) this._barsDust(room, "lintel");
            if (bars.k >= B.anticSteps) to("fall");
        } else if (bars.phase === "fall") {
            const u = Math.min(1, bars.k / B.dropSteps);
            bars.t = u * u;
            if (u >= 1) { this._landBars(room); to("bounce"); }
        } else if (bars.phase === "bounce") {
            bars.t = 1;
            if (bars.k >= B.bounceSteps) to("down");
        } else if (bars.phase === "raise") {
            const u = Math.min(1, bars.k / B.raiseSteps);
            bars.t = 1 - u * u * (3 - 2 * u);
            if (bars.k % 8 === 1) this._barsDust(room, "lintel");
            if (u >= 1) { to("up"); this.renderer?.triggerShake(BARS.shake / 3); }
        }
    }

    // Quanto a treliça aparece (0 = escondida na verga, 1 = no chão), com o tranco e o quique.
    _gateLowered(bars) {
        const B = BARS, travel = B.art.travel;
        if (bars.phase === "antic") return (bars.k % 6 < 3 ? 1 : 0) / travel;
        if (bars.phase === "bounce") return 1 - Math.sin(Math.PI * bars.k / B.bounceSteps) * B.bouncePx / travel;
        return bars.t;
    }

    _barsDust(room, at) {
        const r = this.rooms.cellRect(), px = this.tile / 16;
        for (const b of room.cell.authored?.bars || []) {
            const x = r.x + (b.col + 0.5) * this.tile, base = r.y + (b.row + 1) * this.tile;
            if (at === "lintel") {
                const lintelY = base - (BARS.art.frameH - BARS.art.lintel) * px;
                this.particleSystem?.triggerDust?.(x + (Math.random() - 0.5) * this.tile * 0.8, lintelY, 0, 1, 1);
            } else {
                this.particleSystem?.triggerDust?.(x - 18, base - 4, -1, 0.15, BARS.landDust);
                this.particleSystem?.triggerDust?.(x + 18, base - 4, 1, 0.15, BARS.landDust);
            }
        }
    }

    // A grade bate no chão: hit stop curto, tremor, clangor, faíscas dos dentes e poeira.
    _landBars(room) {
        this.hooks.hitStop?.(BARS.hitStop);
        this.renderer?.triggerShake(BARS.shake);
        this.audio?.play("sawLand", { rateMultiplier: 0.55, volumeMultiplier: 0.8 });
        this.audio?.play("forgeHammer", { rateMultiplier: 0.5, volumeMultiplier: 0.45 });
        this._barsDust(room, "floor");
        const r = this.rooms.cellRect();
        for (const b of room.cell.authored?.bars || []) {
            const x = r.x + (b.col + 0.5) * this.tile, y = r.y + (b.row + 1) * this.tile - 4;
            this.particleSystem?.triggerSparkBurst?.(x, y, this.tile / 2, BARS.sparks, 0.8);
        }
    }

    // Reset de uma sala (morte na sala): a sala volta ao estado inicial — encontros (até os concluídos),
    // scripts, cordas, gaiolas e grades daquela sala são descartados para serem recriados do zero.
    resetRoom(roomKey) {
        const prefix = `${roomKey}/`;
        for (const id of [...this.completed]) if (id.startsWith(prefix)) this.completed.delete(id);
        this._scripts.delete(roomKey);
        this._ropes.delete(roomKey);
        this._cages.delete(roomKey);
        this._bars.delete(roomKey);
    }

    // Morte da dupla: encontros interrompidos voltam ao começo; concluídos ficam.
    onDeath() {
        const cages = [...this._cages.values()].flat();
        for (const h of [...this._scripts.values(), ...cages, ...this._ropes.values(), ...this._gates.values(), ...this._zoneSpawns.values()]) h?.onDeath?.();
        for (const [key, bars] of this._bars) {
            if (!bars.down) continue;
            bars.down = false;
            bars.phase = "up";
            bars.k = 0;
            bars.t = 0;
            void key;
        }
    }

    // Caixas de colisão das grades: as grades levadiças da sala (descidas) mais as grades das cordas (gateRope).
    solidBoxes() {
        const room = this.rooms.current;
        if (!room) return [];
        const handlerBoxes = this._handlers(room).flatMap(h => h.solidBoxes?.() ?? []);
        if (this._barsOf(room).t < BARS.solidAt) return handlerBoxes;
        const r = this.rooms.cellRect();
        const bars = (room.cell.authored?.bars || []).map(b => ({ x: r.x + b.col * this.tile, y: r.y + b.row * this.tile, w: this.tile, h: this.tile }));
        return [...bars, ...handlerBoxes];
    }

    // Círculos sólidos no chão pedidos pelo script (estacas).
    solidCircles() {
        return this._handlers().flatMap(h => h.solidCircles?.() ?? []);
    }

    // Empurra os pés (`footY`, ou y + `footOffset`) para fora dos círculos sólidos.
    resolveCollisions(entities, footOffset, footRadius) {
        const circles = this.solidCircles();
        if (!circles.length) return;
        for (const e of entities) {
            if (!e || e.falling || e.airborne || e.state === "dying") continue;
            const foot = e.footY !== undefined ? e.footY - e.y : footOffset;
            for (const c of circles) {
                const dx = e.x - c.x, dy = e.y + foot - c.y, d = Math.hypot(dx, dy), R = c.r + footRadius;
                if (d >= R) continue;
                const nx = d ? dx / d : 0, ny = d ? dy / d : 1;
                e.x = c.x + nx * R;
                e.y = c.y + ny * R - foot;
            }
        }
    }

    drawFloor(ctx) {
        for (const h of this._handlers()) h.drawFloor?.(ctx);
    }

    drawAir(ctx) {
        for (const h of this._handlers()) h.drawAir?.(ctx);
    }

    // Grades ordenadas por y com as entidades (base no pé do tile).
    drawables() {
        const room = this.rooms.current;
        if (!room) return [];
        const lowered = this._gateLowered(this._barsOf(room));
        const r = this.rooms.cellRect();
        const list = room.cell.authored?.bars || [];
        const at = new Set(list.map(b => `${b.col},${b.row}`));
        // A moldura (verga + ombreiras) faz parte da parede: fica sempre; a treliça só aparece descendo.
        const bars = list.map(b => {
            const x = r.x + b.col * this.tile, base = r.y + (b.row + 1) * this.tile;
            const left = !at.has(`${b.col - 1},${b.row}`), right = !at.has(`${b.col + 1},${b.row}`);
            const key = left && right ? "barsFrameSingle" : left ? "barsFrameLeft" : right ? "barsFrameRight" : "barsFrameMid";
            return { y: base - 14, feetSortY: base, draw: ctx => this._drawBar(ctx, key, x, base, lowered) };
        });
        // Estacas e outros drawables ordenados por y pedidos pelo script da sala (ex.: CageEncounter).
        return [...bars, ...this._handlers(room).flatMap(h => h.drawables?.() ?? [])];
    }

    // Fresta no chão → treliça recortada abaixo da verga → moldura por cima.
    _drawBar(ctx, frameKey, x, base, lowered) {
        const frame = this.assets?.get?.(frameKey), gate = this.assets?.get?.("barsGate");
        if (!frame?.complete || !frame.naturalWidth || !gate?.complete || !gate.naturalWidth) return;
        const T = this.tile, px = T / 16, A = BARS.art;
        const top = base - A.frameH * px, opening = top + A.lintel * px;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = BARS.shadow;
        ctx.globalAlpha = 0.4 + 0.6 * lowered;
        ctx.fillRect(x, base - px, T, px);
        ctx.globalAlpha = 1;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, opening, T, base - opening);
        ctx.clip();
        const lift = Math.round((1 - lowered) * A.travel) * px;
        ctx.drawImage(gate, x, base - A.gateH * px - lift, T, A.gateH * px);
        ctx.restore();
        ctx.drawImage(frame, x, top, T, A.frameH * px);
        ctx.restore();
    }
}
