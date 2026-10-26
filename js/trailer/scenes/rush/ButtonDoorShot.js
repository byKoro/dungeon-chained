import { RushShot, dressRoom, handheld } from '../../kit/rushKit.js';
import { PressureButton } from '../../../entities/PressureButton.js';
import { TILE } from '../../../config/GameConfig.js';
import { lerp, clamp01 } from '../../anim.js';

const SAW_SPEED = 16;

export class ButtonDoorShot extends RushShot {
    constructor(stage) {
        super(stage, { cols: 16, rows: 11, doors: { N: true, S: true }, seed: 61, ropeLen: 400 }, 9);
        const a = stage.assets;
        this.buttons = [5, 10].map(c => new PressureButton(c * TILE + TILE / 2, 5 * TILE + TILE / 2, { sprite: a.button }));
    }

    get isDone() { return this.t >= this.duration || (this._doneAt !== undefined && this.t >= this._doneAt); }

    setup(A) {
        const { p1, p2 } = A;
        const S = this;
        const [b1, b2] = this.buttons;
        for (const b of this.buttons) {
            Object.assign(b, { pressed: false, justPressed: false, justReleased: false, press: 0, squash: 0, squashV: 0, glow: 0, flash: 0, ringT: 0 });
        }
        this._doneAt = undefined;
        this.phase = 'run';
        let tP = 0, tSaw = 0, tClear = 0;
        dressRoom(A, { seed: 61, crates: 3, rubble: 12, loot: 2, banners: 2, blood: 8 });

        const doorN = { x: A.center.x, y: A.bounds.minY };
        const doorS = { x: A.center.x, y: A.bounds.maxY };
        A.doorOpen = { N: 0, S: 0 };
        A.connected = false;
        A.sawVisible = false;
        A.freeSaw = null;
        A.red = 0.55; A.redHz = 1.8;

        const standY = (b) => b.y - 19;
        const portrait = this.stage.portrait;
        if (portrait) {
            A.initPlayer(p1, b1.x + 10, b1.y + 170, 0, -4);
            A.initPlayer(p2, b2.x - 10, b2.y + 160, 0, -4);
        } else {
            A.initPlayer(p1, A.bounds.minX + 70, 240, 4, 0);
            A.initPlayer(p2, A.bounds.maxX - 70, 250, -4, 0);
        }
        const spread = portrait ? 125 : 190;
        p1.goal = { x: b1.x, y: standY(b1), speed: 5.6 };
        p2.goal = { x: b2.x, y: standY(b2), speed: 5.6 };
        A.both(p => { p.accel = 0.16; p.wobble = 0.35; A.expr(p, 'preocupado'); });

        for (let i = 0; i < 3; i++) {
            A.spawnEnemy(i === 1 ? A.bounds.maxX - 20 : A.bounds.minX + 20, 520 + i * 30, 'demon',
                { speed: 1.4, chase: i === 1 ? p2 : p1, stopDist: 80 });
        }
        const feet = () => [p1, p2].map(p => ({ x: p.x, y: p.y, lives: 1, falling: false }));
        A.onDrawFloor = (ctx) => { for (const b of S.buttons) b.draw(ctx); };

        const alive = () => A.enemies.filter(e => e.state !== 'dying' && !e.isHidden);
        let rumbleAcc = 0, spawned = 0;
        A.onKill = () => {
            if (A.kills === 1) { A.slowmo(0.4, 0.25); A.renderer.triggerZoomPunch(0.07); }
            else A.renderer.triggerZoomPunch(0.035);
            const p = A.kills % 2 ? p1 : p2;
            A.exprFor(p, 'espantado', 0.3);
        };

        A.script = (t) => {
            const fs = feet();
            for (const b of S.buttons) b.update(fs);

            if (S.phase === 'run' && ((b1.pressed && b2.pressed) || t > 2.2)) {
                S.phase = 'pressed'; tP = t;
                A.renderer.triggerShake(16);
                A.renderer.triggerZoomPunch(0.06);
                A.impactFlash = 0.35;
                A.both(p => { A.hop(p, 3.5); A.exprFor(p, 'espantado', 0.35); });
                A.particles.triggerDust(b1.x, b1.y + 10, 0, 1, 8);
                A.particles.triggerDust(b2.x, b2.y + 10, 0, 1, 8);
                A.sfx('stoneClick', b1.x, b1.y, { vol: 0.9, cool: 0 });
                A.sfx('stoneClick', b2.x, b2.y, { vol: 0.9, cool: 0, delay: 0.03 });
                A.sfx('stoneGrind', doorN.x, doorN.y, { vol: 0.8, delay: 0.2 });
                S.stage.audio?.mood(-2, 16000, 0.5);
            }

            if (S.phase === 'pressed') {
                const u = t - tP;
                if (u > 0.25 && u < 0.4) A.both(p => A.expr(p, 'olhando_cima'));
                if (u > 0.2 && u < 0.6) {
                    if ((rumbleAcc += 1) % 4 === 0) {
                        A.particles.triggerDust(doorN.x + (Math.random() - 0.5) * 120, doorN.y + 6, 0, 1, 5);
                        A.renderer.triggerShake(5);
                    }
                }
                A.doorOpen.N = clamp01((u - 0.6) / 0.3);
                if (u > 0.6) A.red = Math.min(1, A.red + 0.02);
                if (u > 0.72 && spawned < 10 && u > 0.72 + spawned * 0.07) {
                    const i = spawned++;
                    const target = i % 2 ? p2 : p1;
                    A.spawnEnemy(doorN.x + (i % 3 - 1) * 34, doorN.y - 40 - (i % 2) * 20, i % 4 === 3 ? 'bloodMonster' : 'demon',
                        { speed: 2.2 + (i % 3) * 0.3, chase: target, stopDist: 74 + (i % 4) * 26, entering: true });
                    if (i === 0) {
                        A.sfx('doorOpen', doorN.x, doorN.y, { vol: 0.8 });
                        A.sfx('roar', doorN.x, doorN.y, { vol: 0.45, rate: 1.3 });
                        A.renderer.triggerShake(14);
                        A.both(p => { A.expr(p, 'assustado'); p.shiver = 0.35; });
                        p1.goal = { x: doorS.x - spread, y: doorS.y - 50, speed: 3.6 };
                        p2.goal = { x: doorS.x + spread, y: doorS.y - 50, speed: 3.6 };
                    }
                }
                if (u > 2.0 && u < 2.3 && ((t * 60) | 0) % 3 === 0) {
                    A.particles.triggerDust(doorS.x + (Math.random() - 0.5) * 100, doorS.y - 4, 0, -1, 5);
                    A.renderer.triggerShake(6);
                    A.sfx('thud', doorS.x, doorS.y, { vol: 0.5, rate: 1.4, cool: 0.08 });
                }
                A.doorOpen.S = clamp01((u - 2.25) / 0.14);
                if (u > 2.3) {
                    S.phase = 'saw'; tSaw = t;
                    A.sawVisible = true;
                    A.freeSaw = { x: doorS.x, y: doorS.y + 70, vx: 0, vy: -SAW_SPEED * 1.2 };
                    A.saw.spin = 1; A.saw.bloodTimer = 0;
                    A.connectFlash = 1; A._connectAt = { x: doorS.x, y: doorS.y };
                    A.particles.triggerSparkBurst(doorS.x, doorS.y, 30, 30, 2);
                    A.sfx('boom', doorS.x, doorS.y, { vol: 0.85, rate: 1.1 });
                    A.sfx('sawPickup', doorS.x, doorS.y, { vol: 0.8 });
                    S.stage.audio?.duck(-8, 0.05, 0.5);
                    S.stage.audio?.mood(0, 20000, 0.2);
                    A.renderer.triggerShake(22);
                    A.both(p => { p.shiver = 0; A.exprFor(p, 'espantado', 0.6); A.hop(p, 4); });
                }
            }

            if (S.phase === 'saw' || S.phase === 'clear') {
                const f = A.freeSaw;
                const live = alive();
                let tx, ty, sp = SAW_SPEED;
                if (live.length) {
                    let best = live[0], bd = Infinity;
                    for (const e of live) { const d = Math.hypot(e.x - f.x, e.y - f.y); if (d < bd) { bd = d; best = e; } }
                    tx = best.x; ty = best.y;
                } else {
                    if (S.phase === 'saw') { S.phase = 'clear'; tClear = t; A.both(p => { A.expr(p, 'raiva'); A.hop(p, 4); }); }
                    const m = A.mid;
                    tx = m.x; ty = m.y - 30;
                    sp = Math.min(SAW_SPEED, Math.hypot(tx - f.x, ty - f.y) * 0.08);
                    if (S._doneAt === undefined && t > tClear + 0.9) S._doneAt = S.t + 0.25;
                }
                const dx = tx - f.x, dy = ty - f.y, d = Math.hypot(dx, dy) || 1;
                const turn = t - tSaw < 0.35 ? 0.06 : 0.2;
                f.vx += (dx / d * sp - f.vx) * turn;
                f.vy += (dy / d * sp - f.vy) * turn;
                const b = A.bounds;
                f.x = Math.max(b.minX + 20, Math.min(b.maxX - 20, f.x));
                if (t - tSaw > 0.3) f.y = Math.max(b.minY + 20, Math.min(b.maxY - 20, f.y));
                if (((t * 60) | 0) % 8 === 0) A.both(p => { p.faceX = f.x; if (!p._exprTimer) A.look(p, f.x); });
            }
            if (((t * 60) | 0) % 16 === 0) A.renderer.triggerShake(2.5);

            S._camera(A, t, { tP, tSaw, doorN });
        };
        A.snapCamera(A.center.x, 300, 2.3 * A.zoomRef, 0.3);
        A.clampY = [-40, A.rect.h + 90];
        if (portrait) {
            this._camera(A, 0, { tP: 0, doorN });
            const g = A.camGoal;
            A.setCam(g.x, g.y, g.zoom, g.rot);
        }
    }

    _camera(A, t, { tP, doorN }) {
        const { p1, p2 } = A;
        const h = handheld(t, 1.2);
        const m = A.mid;
        if (this.phase === 'run') {
            const portrait = this.stage.portrait;
            const fit = portrait ? [...this.buttons, p1, p2] : [p1, p2];
            const fx = portrait ? A.center.x : m.x;
            const fy = portrait ? (this.buttons[0].y + m.y) / 2 : m.y + 10;
            A.focus({ x: fx + h.x, y: fy + h.y, zoom: 2.4, rot: lerp(0.3, 0.12, clamp01(t / 1.4)) + h.r, k: 0.14, fit, pad: 60 });
        } else if (this.phase === 'pressed' && t - tP < 2.1) {
            A.focus({ x: m.x + h.x, y: lerp(m.y, doorN.y, 0.45) + h.y, zoom: 2.4, rot: -0.22 + h.r, k: 0.12, fit: [p1, p2, doorN], pad: 90 });
        } else if (this.phase === 'pressed') {
            A.focus({ x: m.x + h.x, y: A.bounds.maxY - 120 + h.y, zoom: 2.7, rot: 0.08 + h.r, k: 0.14, fit: [p1, p2], pad: 70 });
        } else {
            const f = A.freeSaw;
            let cx = lerp(m.x, f.x, 0.6), cy = lerp(m.y, f.y, 0.6), fit = [f, m], pad = 170;
            if (this.stage.portrait) {
                fit = [f, p1, p2]; pad = 110;
                const xs = fit.map(p => p.x), ys = fit.map(p => p.y);
                cx = (Math.min(...xs) + Math.max(...xs)) / 2;
                cy = (Math.min(...ys) + Math.max(...ys)) / 2;
            }
            A.focus({
                x: cx + h.x, y: cy + h.y, zoom: 2.5,
                rot: 0.2 * Math.sin(t * 1.4) + h.r, k: 0.13, fit, pad
            });
        }
    }
}
