/**
 * Clipe 5 — MAPA NOVO ("Cada run monta um mapa novo, a partir de salas
 * desenhadas à mão.").
 *
 * Começa na sala padrão do jogo, com os dois no meio. Formas de sala brotam
 * coladas nas bordas (sem corredor) com um "pop" (escala com overshoot +
 * silhueta branca + tremor leve), cada uma com uma cor nova, e a câmera recua
 * acompanhando. Clarão: a MESMA sala padrão volta e cresce de outro jeito, com
 * outras cores (outra run). Layout e assado em ./mapGrow.js.
 *
 * A arena é usada só como palco (jogadores, serra, luz, névoa, câmera): a sala
 * dela fica vazia e o mapa é desenhado no gancho de piso.
 */
import { B3Shot, AMBIENT } from './B3Shot.js';
import { GW, GH, START, RUNS, PALETTES, buildRun, bakeRun, tintTilesets, extentOf } from './mapGrow.js';
import { SpikeTrap } from '../../entities/SpikeTrap.js';
import { PressureButton } from '../../entities/PressureButton.js';
import { TILE } from '../../config/GameConfig.js';
import { handheld } from '../kit/rushKit.js';
import { clamp01, lerp } from '../anim.js';

const STEP = 1 / 60;
const POP = 0.42;                 // duração do pop de um lobo
const RUN_AT = [0.5, 2.75];       // início de cada run (s reais)
const GAP = 0.34;                 // entre um lobo e o próximo
const FLASH_AT = 2.42;            // clarão da troca de run
const START_ZOOM = 1.55;          // ×zoomRef (sala padrão, de perto)
const AMB_FAR = [150, 138, 176];  // ambiente de longe (mapa legível)
const AMB_NEAR = AMBIENT.split(',').map(Number);
const backOut = (v, s = 1.70158) => { const u = v - 1; return 1 + (s + 1) * u * u * u + s * u * u; };

export class MapShot extends B3Shot {
    constructor(stage) {
        super(stage, { cols: GW, rows: GH, doors: {}, seed: 5, ropeLen: 210 }, 5.0);
        this.label = 'NEW MAP EVERY RUN';
        const A = this.arena;
        // Sala da arena vazia: o mapa vem do assado.
        A.tiles = { cols: 0, rows: 0, floor: [], props: [], torches: [], doorCells: [], walls: [] };
        this.runs = RUNS.map(buildRun);
        this._baked = false;
    }

    start() {
        if (!this._baked) {
            this._baked = true;
            const tilesets = tintTilesets(this.stage.assets.tileset);
            this.runs.forEach(R => bakeRun(R, tilesets));
        }
        this.run = 0;
        this.cam = null;
        this._flashed = false;
        this._popped = new Set();
        super.start();
    }

    // Instante (s reais) em que o lobo k da run r começa a nascer.
    popAt(r, k) { return RUN_AT[r] + (k - 1) * GAP; }

    setup(A) {
        const { p1, p2 } = A;
        const cx = (START.x + START.w / 2) * TILE, cy = (START.y + START.h / 2) * TILE;
        this.center = { x: cx, y: cy };
        A.initPlayer(p1, cx - 110, cy + 10);
        A.initPlayer(p2, cx + 110, cy - 10);
        A.both(p => { p.accel = 0.1; p.wobble = 0.2; });
        A.expr(p1, 'neutro'); A.expr(p2, 'neutro');
        A.minSpin = 0.3; A.saw.spin = 0.4;
        this._live = this._makeLive(0);

        A.script = (t) => {
            // Passeio curto pela sala padrão (a dupla segue jogando).
            const a = t * 0.9;
            const mx = cx + Math.sin(a) * 90, my = cy + Math.sin(a * 1.7) * 40;
            const ang = a * 0.5;
            p1.goal = { follow: true, x: mx - Math.cos(ang) * 105, y: my - Math.sin(ang) * 40, gain: 0.12, max: 3 };
            p2.goal = { follow: true, x: mx + Math.cos(ang) * 105, y: my + Math.sin(ang) * 40, gain: 0.12, max: 3 };
            // Perigos vivos dos lobos já nascidos.
            for (const L of this._live) {
                if (!L.on) continue;
                for (const s of L.spikes) s.update([], STEP);
            }
        };
        this._applyCam(true);
    }

    // Perigos reais (espinhos/botões) de cada lobo da run r.
    _makeLive(r) {
        const R = this.runs[r];
        const c = (g) => g * TILE + TILE / 2;
        const a = this.stage.assets;
        return R.lobes.map((L, k) => ({
            k, on: false,
            spikes: L.spikes.map(([x, y], i) => new SpikeTrap(c(x), c(y), a.peaks, { phaseOffset: (i * 0.13) % 1 })),
            buttons: L.buttons.map(([x, y]) => new PressureButton(c(x), c(y), { sprite: a.button }))
        }));
    }

    update(dt) {
        super.update(dt);
        const A = this.arena, t = this.t;
        // Troca de run: clarão branco cobre a volta à sala padrão.
        if (!this._flashed && t >= FLASH_AT) {
            this._flashed = true;
            this.run = 1;
            this._live = this._makeLive(1);
            this._popped.clear();
            A.impactFlash = 1;
            A.renderer.triggerShake(10);
            A.sfx('impact', this.center.x, this.center.y, { vol: 0.55, rate: 1.2 });
            A.sfx('whoosh', this.center.x, this.center.y, { vol: 0.5, rate: 0.8 });
            this.cam = null;
            this._applyCam(true);
        }
        // Pops: som, tremor leve e expressão quando cada lobo nasce.
        const R = this.runs[this.run];
        for (let k = 1; k < R.lobes.length; k++) {
            const at = this.popAt(this.run, k);
            if (t >= at && !this._popped.has(k)) {
                this._popped.add(k);
                const L = R.lobes[k];
                A.renderer.triggerShake(4);
                A.sfx('pop', (L.x + L.w / 2) * TILE, (L.y + L.h / 2) * TILE, { vol: 0.5, rate: 0.85 + k * 0.12 });
                if (k === 1) A.both(p => A.exprFor(p, 'espantado', 0.5));
            }
            if (t >= at + POP) this._live[k].on = true;
        }
        this._live[0].on = true;
        this._applyCam(false, dt);
        this._ambient();
    }

    // Câmera: enquadra tudo o que já nasceu (mola em tempo real + tremido leve).
    _applyCam(snap, dt = 0) {
        const A = this.arena, t = this.t, R = this.runs[this.run];
        let k = 0;
        for (let i = 1; i < R.lobes.length; i++) if (t >= this.popAt(this.run, i) - 0.05) k = i;
        const e = extentOf(R, k);
        const W = A.canvas.width, H = A.canvas.height;
        const bw = (e.x1 - e.x0 + 2) * TILE, bh = (e.y1 - e.y0 + 2) * TILE;
        const zNear = START_ZOOM * A.zoomRef;
        const z = Math.min(zNear, W * 0.94 / bw, H * 0.9 / bh);
        const goal = { x: (e.x0 + e.x1) / 2 * TILE, y: (e.y0 + e.y1) / 2 * TILE, z: k ? z : zNear };
        if (!k) { goal.x = this.center.x; goal.y = this.center.y - 10; }
        if (snap || !this.cam) this.cam = { ...goal };
        else {
            const a = 1 - Math.exp(-dt * 4.2);
            this.cam.x += (goal.x - this.cam.x) * a;
            this.cam.y += (goal.y - this.cam.y) * a;
            this.cam.z *= Math.pow(goal.z / this.cam.z, a);   // zoom em escala log
        }
        const h = handheld(t, 0.3);
        A.setCam(this.cam.x + h.x / this.cam.z * 1.5, this.cam.y + h.y / this.cam.z * 1.5, this.cam.z, h.r * 0.2);
    }

    // Ambiente clareia de longe (mapa legível), escuro de perto (masmorra).
    _ambient() {
        const A = this.arena;
        const zNear = START_ZOOM * A.zoomRef;
        const k = clamp01((zNear - A.renderer.zoom) / (zNear * 0.55));
        A.post.lighting.ambient = AMB_NEAR.map((v, i) => Math.round(lerp(v, AMB_FAR[i], k))).join(', ');
    }

    drawFloor(ctx) {
        const R = this.runs[this.run], t = this.t;
        const S = TILE / 16;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(R.base, 0, 0, R.base.width * S, R.base.height * S);
        for (let k = 1; k < R.diffs.length; k++) {
            const d = R.diffs[k];
            if (!d) continue;
            const u = (t - this.popAt(this.run, k)) / POP;
            if (u <= 0) continue;
            const L = R.lobes[k];
            const cx = (L.x + L.w / 2) * TILE, cy = (L.y + L.h / 2) * TILE;
            const s = u >= 1 ? 1 : lerp(0.5, 1, backOut(clamp01(u)));
            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(s, s);
            ctx.translate(-cx, -cy);
            ctx.globalAlpha = clamp01(u * 5);
            const x = d.x * TILE, y = d.y * TILE, w = d.w * TILE, h = d.h * TILE;
            ctx.drawImage(d.img, x, y, w, h);
            if (u < 1) {
                ctx.globalAlpha = (1 - clamp01(u)) ** 2;
                ctx.drawImage(d.flash, x, y, w, h);
            }
            ctx.restore();
        }
        for (const L of this._live) {
            if (!L.on) continue;
            for (const s of L.spikes) s.draw(ctx);
            for (const b of L.buttons) b.draw(ctx);
        }
        ctx.restore();
    }

    // Luz tingida de cada lobo (acende com o pop).
    lights(pp, ws, pix) {
        const R = this.runs[this.run], t = this.t;
        for (let k = 1; k < R.lobes.length; k++) {
            const u = clamp01((t - this.popAt(this.run, k)) / POP);
            if (u <= 0) continue;
            const L = R.lobes[k];
            const s = ws((L.x + L.w / 2) * TILE, (L.y + L.h / 2) * TILE);
            const color = PALETTES[L.pal].light;
            const flash = 1 + (1 - u) * 1.5;
            pp.addLight(s.x, s.y, Math.max(L.w, L.h) * TILE * 0.62 * s.zoom * flash, pix(s.zoom, 1.4), 0.75, {
                color, flickerBase: 1, flickerSine: 0, flickerNoise: 0,
                falloff: [{ offset: 0, alpha: 0.5 }, { offset: 0.6, alpha: 0.2 }, { offset: 1, alpha: 0 }]
            });
        }
    }
}
