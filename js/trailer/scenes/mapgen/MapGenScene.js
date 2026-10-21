/**
 * MapGenScene — GERAÇÃO DE MAPAS.
 *
 * Começa numa sala em panorâmica (câmera perto, deslizando e girando de
 * leve). Então a câmera dá um "POP" para trás (antecipa aproximando, recua
 * rápido passando do ponto e assenta) e a grade de salas cresce em volta:
 * 3x3, depois 7x5, depois 15x9. As salas nascem com um pop (escala com
 * overshoot + clarão branco), os corredores se ligam entre elas e as portas
 * abrem (as das salas trancadas continuam fechadas).
 *
 * Salas com formatos variados (retangular padrão, L, cruz, T, octógono,
 * pilares, salão), props, tochas, espinhos, buracos, botões, flechas e
 * inimigos vagando à toa. Layout em ./mapLayout.js (determinístico),
 * desenho das peças estáticas assado em ./mapBake.js.
 *
 * Fim: em DIVE_AT a câmera MERGULHA numa sala retangular perto do centro
 * até ela encher a tela, com clarão branco que passa (overlay) para a cena
 * seguinte (ArrowRunShot), que continua o zoom.
 */
import { TILE, TORCHES } from '../../../config/GameConfig.js';
import { SpikeTrap } from '../../../entities/SpikeTrap.js';
import { PressureButton } from '../../../entities/PressureButton.js';
import { ArrowTrap } from '../../../entities/ArrowTrap.js';
import { SpawnSystem } from '../../../systems/SpawnSystem.js';
import { PostProcessor } from '../../../systems/PostProcessor.js';
import {
    buildDungeon, levelRectTiles, levelOf, useGrid, CENTER, CELL_W, CELL_H, GRID_W, GRID_H, MAP_W
} from './mapLayout.js';
import { bakeDungeon, drawTile16 } from './mapBake.js';
import { clamp01, lerp, easeInOut, hash01 } from '../../anim.js';

const STEP = 1 / 60;
const SEED = 20261018;

// Cada pop: instante (s), nível revelado e tempo de espalhamento das salas.
const POPS = [
    { at: 3.0, level: 1, spread: 0.75 },
    { at: 6.6, level: 2, spread: 1.1 },
    { at: 10.2, level: 3, spread: 1.6 }
];
const POP_DUR = 0.8;      // duração do recuo de câmera
const DIVE_AT = 13.0;     // mergulho lá de cima numa das salas
const DIVE_DUR = 1.15;
const DIVE_FLASH = 0.8;   // clarão branco no fim do mergulho (continua na próxima cena)
const ROOM_POP = 0.42;    // pop de uma sala
const CORR_POP = 0.3;     // pop de um corredor
const DOOR_OPEN = 0.2;    // animação de abrir porta
const BG = 'rgb(37, 19, 26)';   // = tile de fundo 78 (vazio entre as salas)

const AMBIENT_DARK = [50, 42, 64];     // perto: clima de masmorra
const AMBIENT_MAP = [196, 184, 222];   // longe: mapa legível

// Tiles de porta FECHADA por lado da sala (2 células cada: esq/dir ou cima/baixo).
const DOOR_TILES = { N: [66, 67], S: [36, 37], E: [47, 57], W: [48, 58] };

const SOFT = [
    { offset: 0.0, alpha: 1.0 }, { offset: 0.3, alpha: 0.62 },
    { offset: 0.55, alpha: 0.32 }, { offset: 0.8, alpha: 0.12 }, { offset: 1.0, alpha: 0 }
];
const LIGHT = {
    fill: { color: '104, 86, 140', falloff: [{ offset: 0, alpha: 0.36 }, { offset: 0.6, alpha: 0.16 }, { offset: 1, alpha: 0 }], flickerBase: 1, flickerSine: 0, flickerNoise: 0 },
    pop: { color: '235, 225, 255', falloff: SOFT, flickerBase: 1, flickerSine: 0, flickerNoise: 0 },
    candle: { color: '255, 196, 120', falloff: SOFT, flickerBase: 0.95, flickerSine: 0.05, flickerNoise: 0.04 }
};

// easeOutBack: passa do alvo e volta (s controla o overshoot).
const backOut = (v, s = 1.70158) => { const u = v - 1; return 1 + (s + 1) * u * u * u + s * u * u; };

export class MapGenScene {
    constructor(stage) {
        this.stage = stage;
        this.cutIn = 'impact';
        this.post = new PostProcessor(stage.canvas, stage.ctx, {
            lighting: { ambient: AMBIENT_DARK.join(', ') },
            vignette: { strength: 0.7 }
        });
        this._build();
        this.t = 0;
    }

    // Gera a dungeon na grade do formato atual da tela: paisagem (15x9
    // células) ou RETRATO (7x15, vídeo vertical: os níveis crescem para cima e
    // para baixo e enchem o quadro alto).
    _build() {
        this._grid = this.stage.portrait ? 'portrait' : 'landscape';
        useGrid(this._grid);
        this.D = buildDungeon(SEED);
        this.center = this.D.rooms.find(R => R.level === 0);
        this.cellRoom = new Map(this.D.rooms.map(R => [`${R.i},${R.j}`, R]));
        this._baked = false;
        this._schedule();
        // Sala do mergulho: retangular, perto do centro (não a do centro).
        const rects = this.D.rooms.filter(R => R.shape === 'rect' && R.level >= 1 && R.level <= 2);
        rects.sort((a, b) => a.d - b.d);
        this.diveRoom = rects[0] || this.center;
    }

    reset() { this.t = 0; }

    // Som: câmera própria (sem jogadores/serra); tremor dos pops.
    audioState() {
        const c = this._camAt(this.t);
        return { cam: { x: c.x, y: c.y, zoom: c.z, rot: c.rot }, shake: this.shake, saw: null, players: null, amb: 0.5 };
    }
    // Pan aproximado de um ponto do mapa (câmera sem rotação no cálculo).
    _pan(x, y) {
        const c = this._camAt(this.t), W = this.stage.canvas.width;
        return Math.max(-0.8, Math.min(0.8, (x - c.x) * c.z / (W / 2)));
    }
    // Cada sala/corredor nascendo = "bloop" (tom sobe com o nível); portas
    // destravando = clique de pedra; mergulho = subida + passagem de ar.
    _popSounds(au, t0) {
        const t = this.t;
        for (const R of this.D.rooms) {
            if (R.popT > t0 && R.popT <= t) {
                au.play('pop', {
                    vol: 0.34, rate: 0.9 + R.level * 0.14 + Math.random() * 0.08, cool: 0.022,
                    pan: this._pan((R.gx + R.w / 2) * TILE, (R.gy + R.h / 2) * TILE)
                });
            }
        }
        for (const C of this.D.corridors) {
            if (C.popT > t0 && C.popT <= t) au.play('pop', { vol: 0.16, rate: 1.6, cool: 0.03 });
            if (C.openT > t0 && C.openT <= t && !C.doorA.room.locked) au.play('stoneClick', { vol: 0.14, rate: 1.4, cool: 0.05 });
        }
        if (t0 < DIVE_AT - 0.35 && t >= DIVE_AT - 0.35) au.play('riser', { vol: 0.7 });
        if (t0 < DIVE_AT && t >= DIVE_AT) {
            au.mood(-2, 20000, DIVE_DUR);
            au.play('whoosh', { vol: 0.75, rate: 0.7, delay: 0.35 });
        }
    }
    // Termina no fim do mergulho; a cena seguinte continua o zoom.
    get isDone() { return this.t >= DIVE_AT + DIVE_DUR; }
    get reachedEnd() { return this.isDone; }

    // Ordem de nascimento: anel 3x3 em sentido horário; depois ondas a partir
    // do centro (distância + um pouco de acaso estável).
    _schedule() {
        const { rooms, corridors } = this.D;
        for (const R of rooms) R.popT = R.level === 0 ? -99 : Infinity;
        for (const P of POPS) {
            const list = rooms.filter(R => R.level === P.level);
            if (P.level === 1) {
                const ang = (R) => (Math.atan2(R.j - CENTER.j, R.i - CENTER.i) + Math.PI * 2.5) % (Math.PI * 2);
                list.sort((a, b) => ang(a) - ang(b));
            } else {
                const key = (R) => R.d + hash01(R.id * 7.3) * 0.9;
                list.sort((a, b) => key(a) - key(b));
            }
            const stagger = P.spread / Math.max(1, list.length);
            list.forEach((R, n) => { R.popT = P.at + 0.2 + n * stagger; });
        }
        for (const C of corridors) {
            C.popT = Math.max(C.a.popT, C.b.popT) + 0.14;
            C.openT = C.popT + CORR_POP + 0.1 + hash01(C.id + 3) * 0.18;
        }
    }

    start() {
        this.t = 0;
        this._acc = 0;
        this._stepN = 0;
        this.shake = 0;
        this.flash = 0;
        this._firedPop = 0;
        this._flashHanded = false;
        this.fogPhase = 0;
        // A tela trocou de formato (paisagem <-> retrato): outra dungeon.
        if (this._grid !== (this.stage.portrait ? 'portrait' : 'landscape')) this._build();
        else useGrid(this._grid);
        if (!this._baked) {
            bakeDungeon(this.D, this.stage.assets.tileset);
            this._shadow = makeShadowSprite();
            this._baked = true;
        }
        this._spawnActors();
    }

    // ---- Atores (espinhos, botões, flechas, inimigos) ----
    _spawnActors() {
        const a = this.stage.assets;
        const spawner = new SpawnSystem({ assets: a, bloodCanvas: { palette: null } });
        const c = (g) => g * TILE + TILE / 2;
        for (const R of this.D.rooms) {
            const rt = R.rt = { spikes: [], buttons: [], traps: [], arrows: [], enemies: [] };
            rt.minX = (R.gx + 1) * TILE; rt.maxX = (R.gx + R.w - 1) * TILE;
            for (const s of R.spikes) {
                rt.spikes.push(new SpikeTrap(c(s.gx), c(s.gy), a.peaks, { phaseOffset: ((s.phase % 1) + 1) % 1, timing: s.timing }));
            }
            for (const b of R.buttons) rt.buttons.push(new PressureButton(c(b.gx), c(b.gy), { sprite: a.button }));
            for (const tr of R.traps) {
                // Na faixa da parede: oeste fica no lado direito do tile, leste no esquerdo.
                const x = tr.gx * TILE + (tr.dir > 0 ? 46 : 18);
                rt.traps.push({
                    dir: tr.dir,
                    trap: new ArrowTrap(x, c(tr.gy), { x: tr.dir, y: 0 },
                        { phaseOffset: tr.phase, sprites: a.arrowTrap, arrowSprite: a.arrow })
                });
            }
            for (const en of R.enemies) {
                const e = spawner.createEnemy(c(en.gx), c(en.gy) - 14, 1, en.type);
                e.state = 'chase';
                e.speed = 0.45 + Math.random() * 0.35;
                e.animTime = (Math.random() * 40) | 0;
                e.facingLeft = Math.random() < 0.5;
                e.vx = e.vy = 0;
                e.wander = { tx: e.x, ty: e.y, idle: 0.2 + Math.random() * 1.4, attackT: 0 };
                rt.enemies.push(e);
            }
            if (!R.walkCells) {
                R.walkCells = [];
                for (let y = 1; y < R.h - 1; y++) for (let x = 1; x < R.w - 1; x++) {
                    const k = (R.gy + y) * MAP_W + R.gx + x;
                    if (this.D.floor[k] === 1 && this.D.room[k] === R.id && !this.D.solid[k]) R.walkCells.push([R.gx + x, R.gy + y]);
                }
            }
        }
    }

    // ------------------------------------------------------------------
    update(dt) {
        const t0 = this.t;
        this.t += dt;
        const au = this.stage.audio;
        while (this._firedPop < POPS.length && this.t >= POPS[this._firedPop].at + 0.12) {
            this.shake = Math.max(this.shake, 16);
            this.flash = 0.4;
            this._firedPop++;
            // Pop do nível: passagem de ar do recuo + pancada; a trilha sobe.
            au?.play('whoosh', { vol: 0.6, rate: 0.8 });
            au?.play('impact', { vol: 0.5, rate: 1.25 });
            au?.excite(0.45);
        }
        if (au) this._popSounds(au, t0);
        // Fim do mergulho: o clarão segue por cima da próxima cena (overlay).
        if (this.isDone && !this._flashHanded) {
            this._flashHanded = true;
            this.stage.overlay = whiteFade(DIVE_FLASH, 0.4);
            au?.play('impact', { vol: 0.85 });
            au?.duck(-8, 0.05, 0.6);
        }
        this._acc += dt * 60;
        let n = 0;
        while (this._acc >= 1 && n < 4) { this._acc -= 1; n++; this._step(); }
        if (this._acc > 4) this._acc = 0;
        this.shake *= Math.exp(-dt * 9);
        if (this.shake < 0.3) this.shake = 0;
        this.flash = Math.max(0, this.flash - dt * 2.4);
        this.fogPhase += dt * 0.06;
    }

    _step() {
        this._stepN++;
        const t = this.t;
        for (const R of this.D.rooms) {
            if (R.popT > t) continue;
            const rt = R.rt;
            for (const s of rt.spikes) s.update([], STEP);
            if (rt.buttons.length) {
                const feet = rt.enemies.map(e => ({ x: e.x, y: e.y, lives: 1, falling: false }));
                for (const b of rt.buttons) b.update(feet);
            }
            for (const tr of rt.traps) tr.trap.update((arrow) => rt.arrows.push({ a: arrow, stuck: 0 }), STEP);
            this._stepArrows(rt);
            for (const e of rt.enemies) this._wander(R, e);
            this._separate(R, rt.enemies);
        }
    }

    // Flechas cruzam a sala e cravam na parede oposta.
    _stepArrows(rt) {
        for (let i = rt.arrows.length - 1; i >= 0; i--) {
            const A = rt.arrows[i], a = A.a;
            if (A.stuck > 0) {
                A.stuck -= STEP;
                if (A.stuck <= 0) rt.arrows.splice(i, 1);
                continue;
            }
            a.x += a.dx; a.y += a.dy;
            if (a.dx > 0 && a.x > rt.maxX - 6) { a.x = rt.maxX - 6; A.stuck = 0.6; }
            else if (a.dx < 0 && a.x < rt.minX + 6) { a.x = rt.minX + 6; A.stuck = 0.6; }
        }
    }

    // Pés do inimigo dentro do piso da sala (sem buraco, sem caixa).
    _walkable(R, x, y) {
        const D = this.D, fy = y + 16;
        for (const [ox, oy] of [[-12, -6], [12, -6], [-12, 6], [12, 6]]) {
            const k = Math.floor((fy + oy) / TILE) * MAP_W + Math.floor((x + ox) / TILE);
            if (D.floor[k] !== 1 || D.room[k] !== R.id || D.solid[k]) return false;
        }
        return true;
    }
    _clearPath(R, x0, y0, x1, y1) {
        const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 12);
        for (let i = 1; i <= n; i++) {
            const k = i / n;
            if (!this._walkable(R, x0 + (x1 - x0) * k, y0 + (y1 - y0) * k)) return false;
        }
        return true;
    }
    _pickTarget(R, e) {
        const w = e.wander;
        for (let tries = 0; tries < 14; tries++) {
            const [gx, gy] = R.walkCells[(Math.random() * R.walkCells.length) | 0];
            const tx = gx * TILE + TILE / 2 + (Math.random() - 0.5) * 24;
            const ty = gy * TILE + TILE / 2 - 14 + (Math.random() - 0.5) * 16;
            if (Math.hypot(tx - e.x, ty - e.y) < 70) continue;
            if (this._clearPath(R, e.x, e.y, tx, ty)) { w.tx = tx; w.ty = ty; return; }
        }
        w.idle = 0.4 + Math.random();
    }

    // Vaga à toa: escolhe um ponto, anda até ele, para um pouco (às vezes
    // ensaia um golpe no ar) e escolhe outro.
    _wander(R, e) {
        const w = e.wander;
        if (w.attackT > 0) {
            w.attackT--; e.animTime++;
            if (w.attackT <= 0) { e.state = 'chase'; w.idle = 0.3 + Math.random() * 0.6; }
            return;
        }
        if (w.idle > 0) {
            w.idle -= STEP;
            e.vx *= 0.8; e.vy *= 0.8;
            if (this._stepN % 3 === 0) e.animTime++;   // respira em vez de marchar
            if (w.idle <= 0) this._pickTarget(R, e);
            return;
        }
        const dx = w.tx - e.x, dy = w.ty - e.y, d = Math.hypot(dx, dy);
        if (d < 4) {
            w.idle = 0.5 + Math.random() * 1.8;
            // Às vezes ensaia um golpe no ar (anima o ataque parado).
            const keys = e.attackKeys || [];
            if (keys.length && Math.random() < 0.2) {
                e.currentAttack = keys[(Math.random() * keys.length) | 0];
                const anim = e.sprite.rows[e.currentAttack];
                e.state = 'attack'; e.animTime = 0;
                w.attackT = anim.frames * anim.fps;
            }
            return;
        }
        const sp = Math.min(e.speed, d * 0.1);
        e.vx += (dx / d * sp - e.vx) * 0.15;
        e.vy += (dy / d * sp - e.vy) * 0.15;
        const nx = e.x + e.vx, ny = e.y + e.vy;
        if (this._walkable(R, nx, ny)) { e.x = nx; e.y = ny; }
        else { e.vx = e.vy = 0; w.idle = 0.25; }
        e.animTime++;
        if (Math.abs(e.vx) > 0.05) e.facingLeft = e.vx < 0;
    }

    // Empurrão simples entre inimigos da mesma sala (sem atravessar paredes).
    _separate(R, list) {
        for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
            const a = list[i], b = list[j];
            const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
            if (d >= 30 || d < 0.01) continue;
            const push = (30 - d) * 0.25, nx = dx / d * push, ny = dy / d * push;
            if (this._walkable(R, a.x - nx, a.y - ny)) { a.x -= nx; a.y -= ny; }
            if (this._walkable(R, b.x + nx, b.y + ny)) { b.x += nx; b.y += ny; }
        }
    }

    // ---- Câmera ----
    // Altura útil: dentro das barras de cinema (em paisagem = 0.78 da altura).
    get _usableH() { return (this.stage.canvas.height - 2 * this.stage.barH) * 0.975; }
    _fit(r, rot) {
        const { canvas } = this.stage;
        const c = Math.abs(Math.cos(rot)), s = Math.abs(Math.sin(rot));
        const rw = r.w * c + r.h * s, rh = r.w * s + r.h * c;
        return Math.min(canvas.width * 0.94 / rw, this._usableH / rh);
    }
    // Vídeo vertical: a ALTURA do retângulo enche a área útil (corta os lados).
    _fitH(r, rot) {
        const c = Math.abs(Math.cos(rot)), s = Math.abs(Math.sin(rot));
        return this._usableH / (r.w * s + r.h * c);
    }
    _levelRect(k) {
        if (k === 0) {
            const R = this.center;
            return { x: R.gx * TILE, y: R.gy * TILE, w: R.w * TILE, h: R.h * TILE };
        }
        const r = levelRectTiles(k);
        return { x: r.x * TILE, y: r.y * TILE, w: r.w * TILE, h: r.h * TILE };
    }
    // Câmera "parada" de cada fase (0 = panorâmica da sala; k = nível k).
    _base(k, t) {
        const r = this._levelRect(k);
        if (k === 0) {
            const u = easeInOut(clamp01(t / (POPS[0].at + 0.3)));
            const rot = lerp(-0.12, 0.05, u);
            // Panorâmica: quase a sala inteira na altura, deslizando de lado.
            // (Vertical: a altura da sala enche o quadro e a câmera atravessa
            // a sala de lado — o quadro estreito mostra uma fatia dela.)
            return {
                x: r.x + r.w * (0.5 + lerp(-0.2, 0.17, u)),
                y: r.y + r.h * (0.5 + lerp(-0.02, -0.05, u)),
                z: this.stage.portrait ? this._fitH(r, rot) * lerp(1.06, 1.0, u) : this._fit(r, rot) * lerp(1.3, 1.17, u),
                rot
            };
        }
        const dt = Math.max(0, t - POPS[k - 1].at);
        const rot = [0, 0.05, -0.045, 0.03][k] + 0.02 * Math.sin(dt * 0.45 + k);
        const dolly = lerp(1.07, 1.0, easeInOut(clamp01(dt / (k < 3 ? 3.5 : 6))));
        return {
            x: r.x + r.w * (0.5 + 0.012 * Math.sin(dt * 0.4)),
            y: r.y + r.h * (0.5 + 0.01 * Math.cos(dt * 0.33)),
            z: this._fit(r, rot) * dolly,
            rot
        };
    }
    // Pop para trás: antecipa (aproxima ~6%), recua rápido passando do ponto
    // (easeOutBack em escala logarítmica) e assenta no novo enquadramento.
    _camAt(t) {
        if (t >= DIVE_AT) return this._diveCam(t);
        return this._popCam(t);
    }
    // Mergulho acelerando até a sala escolhida encher a tela (girando).
    _diveCam(t) {
        const A = this._popCam(DIVE_AT);
        const R = this.diveRoom;
        const r = { x: R.gx * TILE, y: R.gy * TILE, w: R.w * TILE, h: R.h * TILE };
        const u = clamp01((t - DIVE_AT) / DIVE_DUR);
        const rot = lerp(A.rot, 0.32, easeInOut(u));
        // (Vertical: a sala enche o quadro pela altura.)
        const zB = (this.stage.portrait ? this._fitH(r, rot) : this._fit(r, rot)) * 1.15;
        const w = Math.pow(u, 2.2);
        const pw = easeInOut(clamp01(u * 1.25));
        return {
            x: lerp(A.x, r.x + r.w / 2, pw), y: lerp(A.y, r.y + r.h / 2, pw),
            z: Math.exp(Math.log(A.z) + (Math.log(zB) - Math.log(A.z)) * w), rot
        };
    }
    _popCam(t) {
        let k = 0;
        while (k < POPS.length && t >= POPS[k].at) k++;
        if (k === 0) return this._base(0, t);
        const u = (t - POPS[k - 1].at) / POP_DUR;
        const B = this._base(k, t);
        if (u >= 1) return B;
        const A = this._base(k - 1, t);
        const ant = u < 0.3 ? Math.sin(Math.PI * u / 0.3) : 0;
        const w = u < 0.12 ? 0 : backOut((u - 0.12) / 0.88, 1.5);
        const lz = Math.log(A.z) + (Math.log(B.z) - Math.log(A.z)) * w + Math.log(1 + 0.06 * ant);
        const pw = easeInOut(clamp01((u - 0.08) / 0.8));
        return { x: lerp(A.x, B.x, pw), y: lerp(A.y, B.y, pw), z: Math.exp(lz), rot: lerp(A.rot, B.rot, pw) };
    }

    // ---- Pop das peças ----
    _popU(T0, dur) { return (this.t - T0) / dur; }
    _scaleOf(T0, dur, s = 2.0) {
        const u = this._popU(T0, dur);
        if (u <= 0) return 0;
        if (u >= 1) return 1;
        return backOut(u, s);
    }
    _withScale(ctx, s, cx, cy, fn) {
        if (s === 1) { fn(); return; }
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(s, s);
        ctx.translate(-cx, -cy);
        fn();
        ctx.restore();
    }

    // ------------------------------------------------------------------
    render() {
        const { ctx, canvas } = this.stage;
        const W = canvas.width, H = canvas.height;
        const cam = this._camAt(this.t);
        const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
        const M = new DOMMatrix()
            .translate(W / 2 + sx, H / 2 + sy).rotate(cam.rot * 180 / Math.PI)
            .scale(cam.z).translate(-cam.x, -cam.y);
        this._M = M;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, W, H);
        ctx.setTransform(M);
        // Muito longe (menos de ~0.7 px de tela por texel) o vizinho mais
        // próximo cintila: suaviza a redução.
        ctx.imageSmoothingEnabled = cam.z * (TILE / 16) < 0.7;

        const view = viewRect(M, W, H, TILE * 2);
        this._drawGrid(ctx, cam.z);

        const rooms = [];
        for (const R of this.D.rooms) {
            const s = this._scaleOf(R.popT, ROOM_POP);
            if (s <= 0) continue;
            const x = R.gx * TILE, y = R.gy * TILE, w = R.w * TILE, h = R.h * TILE;
            if (x > view.x1 || y > view.y1 || x + w < view.x0 || y + h < view.y0) continue;
            rooms.push({ R, s, x, y, w, h, cx: x + w / 2, cy: y + h / 2 });
        }
        const corrs = [];
        for (const C of this.D.corridors) {
            const s = this._scaleOf(C.popT, CORR_POP, 1.4);
            if (s <= 0) continue;
            const b = C.bbox, x = b.x * TILE, y = b.y * TILE, w = b.w * TILE, h = b.h * TILE;
            if (x > view.x1 || y > view.y1 || x + w < view.x0 || y + h < view.y0) continue;
            corrs.push({ C, s, x, y, w, h, cx: x + w / 2, cy: y + h / 2 });
        }

        // 1) salas (seladas)
        for (const o of rooms) this._withScale(ctx, o.s, o.cx, o.cy, () => ctx.drawImage(o.R.bake.base, o.x, o.y, o.w, o.h));
        // 2) corredores por cima (junções) + portas
        for (const o of corrs) this._withScale(ctx, o.s, o.cx, o.cy, () => {
            ctx.drawImage(o.C.bake.base, o.x, o.y, o.w, o.h);
            this._drawDoors(ctx, o.C);
        });
        // 3) conteúdo vivo de cada sala
        for (const o of rooms) this._withScale(ctx, o.s, o.cx, o.cy, () => this._drawRoomLive(ctx, o.R));
        // 4) parede da base por cima dos atores
        for (const o of rooms) this._withScale(ctx, o.s, o.cx, o.cy, () => ctx.drawImage(o.R.bake.front, o.x, o.y, o.w, o.h));
        // 5) clarão branco do nascimento
        for (const o of rooms) this._drawPopFlash(ctx, o, o.R.bake.flash, o.R.popT, ROOM_POP);
        for (const o of corrs) this._drawPopFlash(ctx, o, o.C.bake.flash, o.C.popT, CORR_POP);
        ctx.restore();

        this._drawLights(rooms, cam);
        this.post.draw();
        this.stage.drawFogOn(ctx, W, H, this.fogPhase);
        this._drawSpeedLines(ctx, W, H);
        this._drawDive(ctx, W, H);
        if (this.flash > 0.01) {
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = `rgba(230, 220, 255, ${this.flash * 0.3})`;
            ctx.fillRect(0, 0, W, H);
            ctx.restore();
        }
        ctx.imageSmoothingEnabled = false;
    }

    // Portas fechadas nas pontas do corredor: abrem logo depois de ligar
    // (as folhas recolhem para os batentes); salas trancadas não abrem.
    _drawDoors(ctx, C) {
        const img = this.stage.assets.tileset;
        for (const door of [C.doorA, C.doorB]) {
            const k = door.room.locked ? 0 : clamp01((this.t - C.openT) / DOOR_OPEN);
            if (k >= 1) continue;
            const [t0, t1] = DOOR_TILES[door.side];
            const horiz = door.side === 'N' || door.side === 'S';
            const s = 1 - k * k;
            ctx.save();
            ctx.globalAlpha = 1 - k * 0.5;
            door.cells.forEach(([gx, gy], n) => {
                const x = gx * TILE, y = gy * TILE;
                const tile = n === 0 ? t0 : t1;
                if (horiz) {
                    const w = TILE * s;
                    drawTile16(ctx, img, tile, n === 0 ? x : x + TILE - w, y, w, TILE);
                } else {
                    const h = TILE * s;
                    drawTile16(ctx, img, tile, x, n === 0 ? y : y + TILE - h, TILE, h);
                }
            });
            ctx.restore();
        }
    }

    _drawRoomLive(ctx, R) {
        const rt = R.rt, a = this.stage.assets;
        for (const s of rt.spikes) s.draw(ctx);
        for (const b of rt.buttons) b.draw(ctx);
        this._drawTorches(ctx, R, a.torchSprites);
        for (const tr of rt.traps) tr.trap.draw(ctx);
        const sh = this._shadow;
        for (const e of rt.enemies) ctx.drawImage(sh, e.x - 15, e.y + 10, 30, 14);
        const list = rt.enemies.length > 1 ? [...rt.enemies].sort((p, q) => p.y - q.y) : rt.enemies;
        for (const e of list) e.draw(ctx);
        for (const A of rt.arrows) {
            if (A.stuck > 0) {
                ctx.save();
                ctx.translate(A.a.x, A.a.y);
                ctx.rotate(Math.sin(A.stuck * 60) * 0.08 * A.stuck);
                ctx.translate(-A.a.x, -A.a.y);
                A.a.draw(ctx);
                ctx.restore();
            } else A.a.draw(ctx);
        }
    }

    _drawTorches(ctx, R, sprites) {
        if (!sprites) return;
        for (const T of R.torches) {
            const frame = (Math.floor(this.t / 0.16) + T.gx) % 4;
            const set = T.type === 'candlestick_1' ? sprites.candlestick1
                : T.type === 'candlestick_2' ? sprites.candlestick2
                    : (T.side === 'W' || T.side === 'E') ? sprites.sideTorch : sprites.torch;
            const img = set && set[frame];
            if (!img || !img.complete || !img.naturalWidth) continue;
            const x = T.gx * TILE, y = T.gy * TILE;
            if (T.type === 'torch' && T.side === 'E') {
                ctx.save();
                ctx.translate(x + TILE, y);
                ctx.scale(-1, 1);
                ctx.drawImage(img, 0, 0, TILE, TILE);
                ctx.restore();
            } else ctx.drawImage(img, x, y, TILE, TILE);
        }
    }

    _drawPopFlash(ctx, o, mask, T0, dur) {
        const u = this._popU(T0, dur);
        if (u <= 0 || u >= 1) return;
        const a = (1 - u) * (1 - u) * 0.9;
        this._withScale(ctx, o.s, o.cx, o.cy, () => {
            ctx.globalAlpha = a;
            ctx.drawImage(mask, o.x, o.y, o.w, o.h);
            ctx.globalAlpha = 1;
        });
    }

    // Contorno tracejado das células do novo nível: aparece no pop e some
    // conforme cada sala nasce (a grade "crescendo").
    _drawGrid(ctx, z) {
        const t = this.t;
        for (const P of POPS) {
            if (t < P.at || t > P.at + POP_DUR + 2.6) continue;
            const aIn = clamp01((t - P.at - 0.08) / 0.25);
            ctx.save();
            ctx.lineWidth = 2 / z;
            ctx.setLineDash([10 / z, 7 / z]);
            for (let j = 0; j < GRID_H; j++) for (let i = 0; i < GRID_W; i++) {
                if (levelOf(i, j) !== P.level) continue;
                const R = this.cellRoom.get(`${i},${j}`);
                const aOut = R ? clamp01((t - R.popT) / 0.3) : clamp01((t - (P.at + POP_DUR + 1.2)) / 0.8);
                const a = aIn * (1 - aOut);
                if (a <= 0.01) continue;
                ctx.strokeStyle = `rgba(196, 178, 245, ${a * 0.55})`;
                ctx.strokeRect((i * CELL_W + 0.5) * TILE, (j * CELL_H + 0.5) * TILE, (CELL_W - 1) * TILE, (CELL_H - 1) * TILE);
            }
            ctx.restore();
        }
    }

    // Riscos de velocidade convergindo para o centro durante o recuo.
    _drawSpeedLines(ctx, W, H) {
        const t = this.t;
        for (const P of POPS) {
            const u = (t - P.at) / POP_DUR;
            if (u < 0.1 || u > 0.7) continue;
            const v = (u - 0.1) / 0.6;
            const a = Math.sin(Math.PI * v);
            const diag = Math.hypot(W, H) / 2;
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = `rgba(215, 205, 255, ${0.32 * a})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i < 56; i++) {
                const ang = (i / 56) * Math.PI * 2 + hash01(i + P.level * 31) * 0.1;
                const r1 = diag * (1.05 - 0.35 * v) * (0.85 + 0.25 * hash01(i * 3.1 + P.level));
                const r0 = r1 - diag * (0.12 + 0.18 * hash01(i * 5.7));
                ctx.moveTo(W / 2 + Math.cos(ang) * r1, H / 2 + Math.sin(ang) * r1);
                ctx.lineTo(W / 2 + Math.cos(ang) * r0, H / 2 + Math.sin(ang) * r0);
            }
            ctx.stroke();
            ctx.restore();
        }
    }

    // Mergulho: riscos saindo do centro (aproximação) + clarão branco no fim.
    _drawDive(ctx, W, H) {
        const u = (this.t - DIVE_AT) / DIVE_DUR;
        if (u <= 0) return;
        const v = clamp01(u);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'lighter';
        const a = clamp01((v - 0.25) / 0.3) * 0.45;
        if (a > 0) {
            const diag = Math.hypot(W, H) / 2;
            ctx.strokeStyle = `rgba(230, 220, 255, ${a})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let i = 0; i < 64; i++) {
                const ang = (i / 64) * Math.PI * 2 + hash01(i + 91) * 0.1;
                const ph = (this.t * 2.4 + hash01(i * 4.3)) % 1;
                const r0 = diag * (0.25 + ph * 0.9), r1 = r0 + diag * (0.1 + 0.25 * v);
                ctx.moveTo(W / 2 + Math.cos(ang) * r0, H / 2 + Math.sin(ang) * r0);
                ctx.lineTo(W / 2 + Math.cos(ang) * r1, H / 2 + Math.sin(ang) * r1);
            }
            ctx.stroke();
        }
        const f = clamp01((v - 0.72) / 0.28);
        if (f > 0) {
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = `rgba(255, 250, 245, ${DIVE_FLASH * f * f})`;
            ctx.fillRect(0, 0, W, H);
        }
        ctx.restore();
    }

    // Luz: ambiente escuro de perto clareando ao afastar (o mapa fica
    // legível), tochas/castiçais, preenchimento roxo e o clarão de cada pop.
    _drawLights(rooms, cam) {
        const pp = this.post, M = this._M, z = cam.z;
        const tilePx = TILE * z;
        const kb = clamp01((46 - tilePx) / 34);
        pp.lighting.ambient = AMBIENT_DARK.map((v, i) => Math.round(lerp(v, AMBIENT_MAP[i], kb))).join(', ');
        const pix = (s) => Math.max(2, Math.round((TILE / 16) * z * s));
        const ws = (x, y) => M.transformPoint(new DOMPoint(x, y));
        const tl = TORCHES.light, area = tl.area;
        const glowP = { ...tl, falloff: tl.glow.falloff };
        const areaP = { ...tl, falloff: area.falloff };
        for (const o of rooms) {
            const R = o.R, s = o.s;
            const u = this._popU(R.popT, ROOM_POP);
            if (u > 0 && u < 1) {
                const c = ws(o.cx, o.cy);
                pp.addLight(c.x, c.y, Math.max(o.w, o.h) * 0.7 * z * (1.2 - u), pix(1.4), 0.75, LIGHT.pop);
            }
            if (tilePx > 12) {
                const c = ws(o.cx, o.cy);
                pp.addLight(c.x, c.y, o.w * 0.7 * z * s, pix(1.4), 0.7, LIGHT.fill);
            }
            // Tochas só quando dá para vê-las (centenas de luzes no mapa inteiro pesam).
            if (tilePx < 14) continue;
            for (const T of R.torches) {
                let wx = T.gx * TILE + TILE / 2, wy = T.gy * TILE + TILE / 2, ax = 0, ay = 0;
                if (T.side === 'N') { wy += tl.offsetY; ay = area.pushIn; }
                else if (T.side === 'W') { wx += tl.offsetX; ax = area.pushIn; }
                else if (T.side === 'E') { wx -= tl.offsetX; ax = -area.pushIn; }
                if (s !== 1) { wx = o.cx + (wx - o.cx) * s; wy = o.cy + (wy - o.cy) * s; }
                const p = ws(wx, wy);
                if (T.side === 'F') { pp.addLight(p.x, p.y, 120 * z * s, pix(1.2), 0.9, LIGHT.candle); continue; }
                pp.addLight(p.x, p.y, tl.glow.radius * z * s, pix(tl.pixelScale), tl.glow.flatten, glowP);
                const q = ws(wx + ax * s, wy + ay * s);
                pp.addLight(q.x, q.y, area.radius * 1.1 * z * s, pix(tl.pixelScale), area.flatten, areaP);
            }
        }
    }
}

// Retângulo do mundo visível (AABB da tela girada), com folga.
function viewRect(M, W, H, pad) {
    const inv = M.inverse();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of [[0, 0], [W, 0], [0, H], [W, H]]) {
        const p = inv.transformPoint(new DOMPoint(x, y));
        x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
    }
    return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
}

// Sombra redonda pré-desenhada (barata para centenas de inimigos).
function makeShadowSprite() {
    const c = document.createElement('canvas');
    c.width = 60; c.height = 28;
    const g = c.getContext('2d');
    g.translate(30, 14);
    g.scale(1, 0.47);
    const grad = g.createRadialGradient(0, 0, 1, 0, 0, 29);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.6)');
    grad.addColorStop(0.6, 'rgba(0, 0, 0, 0.32)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(0, 0, 29, 0, Math.PI * 2);
    g.fill();
    return c;
}

// Clarão branco que some (overlay do stage, atravessa o corte de cena).
function whiteFade(alpha, dur) {
    return {
        t: 0,
        get done() { return this.t >= dur; },
        update(dt) { this.t += dt; },
        draw(ctx) {
            const k = 1 - clamp01(this.t / dur);
            if (k <= 0) return;
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.fillStyle = `rgba(255, 250, 245, ${alpha * k * k})`;
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.restore();
        }
    };
}
