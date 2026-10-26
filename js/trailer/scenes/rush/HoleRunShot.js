import { RushShot, dressRoom, handheld } from '../../kit/rushKit.js';
import { TILE } from '../../../config/GameConfig.js';
import { lerp, clamp01, easeInOut } from '../../anim.js';

const COLS = 18, ROWS = 30;
const SPEED = 5.2;
const AMP = 150, WAVE = 260;
const HALF = 78;
const BRIDGE = 2.7;
const GAPS = [ROWS - 11, ROWS - 19];

export class HoleRunShot extends RushShot {
    constructor(stage) {
        super(stage, { cols: COLS, rows: ROWS, doors: { N: true }, seed: 81, ropeLen: 200 }, 4.0);
        this.cutIn = null;
        this._built = false;
    }

    setup(A) {
        const { p1, p2 } = A;
        const cx = A.center.x;
        const y0 = A.bounds.maxY - 100;
        const pathX = (y) => cx + AMP * Math.sin((y0 - y) / WAVE);
        const pathCol = (r) => pathX(r * TILE + TILE / 2) / TILE;
        if (!this._built) {
            this._built = true;
            const cells = [];
            for (let r = 3; r <= ROWS - 5; r++) {
                for (let c = 3; c <= COLS - 4; c++) {
                    if (GAPS.includes(r) || Math.abs(c + 0.5 - pathCol(r)) > BRIDGE) cells.push([c, r]);
                }
            }
            A.setHoles(cells);
        }
        dressRoom(A, {
            seed: 81, crates: 2, rubble: 16, loot: 1, banners: 2, blood: 10,
            avoid: (c, r) => r > 2 && r < ROWS - 4 && Math.abs(c + 0.5 - pathCol(r)) < BRIDGE + 0.5
        });

        A.initPlayer(p1, pathX(y0) - HALF, y0, 0, -SPEED);
        A.initPlayer(p2, pathX(y0) + HALF, y0, 0, -SPEED);
        A.both(p => { p.accel = 0.28; p.wobble = 0.15; p._gap = null; p._landed = null; A.expr(p, 'assustado'); });
        A.minSpin = 1; A.saw.spin = 1;
        A.red = 0.85; A.redHz = 2.2;

        const ledgeL = 2 * TILE, ledgeR = (COLS - 2) * TILE;
        const mid = A.midTarget;
        for (let i = 0; i < 6; i++) {
            const left = i % 2 === 0, k = (i / 2) | 0;
            const goal = { get x() { return left ? ledgeL : ledgeR; }, get y() { return mid.y - 40 - k * 110; } };
            A.spawnEnemy(left ? ledgeL : ledgeR, y0 - 120 - k * 160, i % 3 === 1 ? 'bloodMonster' : 'demon',
                { speed: 5.2, goal, lookAt: mid });
        }
        const ahead = [];
        for (let i = 0; i < 5; i++) {
            let y = y0 - 360 - i * 230;
            for (const g of GAPS) if (Math.abs(y - (g * TILE + 32)) < 90) y -= 120;
            const e = A.spawnEnemy(pathX(y) + (i % 2 ? 36 : -36), y, i === 3 ? 'bloodMonster' : 'demon',
                { speed: 0.8, chase: mid });
            e._armed = true;
            ahead.push(e);
        }
        for (let i = 0; i < 4; i++) {
            A.spawnEnemy(pathX(y0) + (i - 1.5) * 60, y0 + 70 + (i % 2) * 30, 'demon',
                { speed: 4.7, chase: mid, stopDist: 60 });
        }

        let jumps = 0;
        A.onKill = () => {
            A.renderer.triggerZoomPunch(0.04);
            const p = A.kills % 2 ? p1 : p2;
            A.hop(p, 3);
            A.exprFor(p, 'furia', 0.4);
        };

        A.script = (t) => {
            const my = y0 - SPEED * 60 * t;
            const mx = pathX(my);
            p1.goal = { follow: true, x: mx - HALF, y: my, gain: 0.32, max: 8 };
            p2.goal = { follow: true, x: mx + HALF, y: my, gain: 0.32, max: 8 };

            for (const p of [p1, p2]) {
                for (const g of GAPS) {
                    const edge = (g + 1) * TILE;
                    const d = p.y + 14 - edge;
                    if (d > 0 && d < 46 && p.hopZ < 1 && p._gap !== g) {
                        p._gap = g;
                        A.hop(p, 6.6);
                        A.sfx('whoosh', p.x, p.y, { vol: 0.4, rate: 1.4, cool: 0.08 });
                        A.expr(p, 'espantado');
                        if (p === p1) {
                            jumps++;
                            A.slowmo(0.38, jumps === 1 ? 0.28 : 0.4);
                            A.renderer.triggerShake(8);
                            A.renderer.triggerZoomPunch(0.06);
                        }
                    }
                    if (p._gap === g && p.y + 14 < g * TILE - 20 && !p._landed?.[g]) {
                        p._landed = { ...(p._landed || {}), [g]: true };
                        A.particles.triggerDust(p.x, p.y + 16, 0, 1, 10);
                        A.renderer.triggerShake(6);
                        A.expr(p, p === p1 ? 'furia' : 'raiva');
                    }
                }
            }
            for (const e of ahead) {
                if (e._armed && e.state !== 'dying' && Math.abs(e.y - my) < 140) {
                    e._armed = false;
                    A.lunge(e, mx, my, 4.5);
                }
            }
            if (((t * 60) | 0) % 14 === 0) A.renderer.triggerShake(3);

            const h = handheld(t, 1.3);
            const k = clamp01(t / 3.8);
            const m = A.mid;
            A.focus({
                x: m.x + h.x, y: m.y - 110 + h.y, zoom: lerp(1.95, 2.35, k),
                rot: lerp(0.42, -0.24, easeInOut(k)) + h.r, k: 0.16, fit: [p1, p2], pad: 70
            });
        };
        A.snapCamera(pathX(y0), y0 - 110, 1.95 * A.zoomRef, 0.42);
    }
}
