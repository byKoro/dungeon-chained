import { ActionArena } from '../../kit/ActionArena.js';
import { TILE } from '../../../config/GameConfig.js';

const ROWS = 32;

export class SplitShot {
    constructor(stage) {
        this.stage = stage;
        this.cutIn = 'impact';
        this.left = new ActionArena(stage, { cols: 12, rows: ROWS, doors: { N: true }, seed: 44, panBias: -0.45 });
        this.right = new ActionArena(stage, { cols: 14, rows: ROWS, doors: { N: true }, seed: 55, ambient: '46, 38, 52', panBias: 0.45 });
        this._holesBuilt = false;
        this.t = 0;
    }

    reset() { this.t = 0; }
    get isDone() { return this.t > 6.4; }
    get reachedEnd() { return this.t > 6.2; }

    _half() {
        const { canvas } = this.stage;
        return this.stage.portrait
            ? [canvas.width, Math.ceil(canvas.height / 2)]
            : [Math.ceil(canvas.width / 2), canvas.height];
    }

    start() {
        this.t = 0;
        const [hw, hh] = this._half();
        for (const A of [this.left, this.right]) { A.reset(); A.ensureSize(hw, hh); }
        this._setupLeft(this.left);
        this._setupRight(this.right);
        this.left.renderer.triggerShake(18);
        this.right.renderer.triggerShake(18);
    }

    _setupLeft(A) {
        const SPEED = 5.0, AMP = 105, WAVE = 190, HALF = 78;
        const cx = A.center.x, y0 = A.bounds.maxY - 80;
        const pathX = (y) => cx + AMP * Math.sin((y0 - y) / WAVE);

        if (!this._holesBuilt) {
            const cells = [];
            for (let r = 3; r < ROWS - 4; r++) {
                const y = r * TILE + TILE / 2;
                const s = Math.sin((y0 - y) / WAVE);
                if (s > 0.55) cells.push([1, r], [2, r], ...(s > 0.85 ? [[3, r]] : []));
                if (s < -0.55) cells.push([A.cols - 2, r], [A.cols - 3, r], ...(s < -0.85 ? [[A.cols - 4, r]] : []));
            }
            A.setHoles(cells);
            this._holesBuilt = true;
        }
        const holeX = (r) => (A.holeCells || []).filter(([, rr]) => rr === r).map(([c]) => c * TILE + TILE / 2);

        A.initPlayer(A.p1, pathX(y0) - HALF, y0, 0, -SPEED);
        A.initPlayer(A.p2, pathX(y0) + HALF, y0, 0, -SPEED);
        A.minSpin = 1; A.saw.spin = 1;
        A.expr(A.p1, 'furia'); A.expr(A.p2, 'raiva');
        A.both(p => { p.wobble = 0.08; p.accel = 0.3; });

        for (let i = 0; i < 9; i++) {
            const y = y0 - 260 - i * 175;
            A.spawnEnemy(pathX(y) + (i % 2 ? 30 : -30), y, i % 3 === 1 ? 'bloodMonster' : 'demon',
                { speed: 0.7, chase: A.midTarget });
        }
        A.onKill = () => { if (A.kills === 2) A.slowmo(0.2, 0.35); A.hop(A.kills % 2 ? A.p1 : A.p2, 3); };

        let lastHoleRow = -1;
        A.script = (t) => {
            const run = t < 6.0;
            const my = y0 - SPEED * 60 * Math.min(t, 6.0);
            const mx = pathX(my);
            if (run) {
                A.p1.goal = { follow: true, x: mx - HALF, y: my, gain: 0.3, max: 8 };
                A.p2.goal = { follow: true, x: mx + HALF, y: my, gain: 0.3, max: 8 };
            } else if (A.p1.goal) {
                A.both(p => { p.goal = null; p.shiver = 0.3; A.expr(p, 'preocupado'); });
            }
            const row = Math.floor(my / TILE);
            if (run && row !== lastHoleRow) {
                lastHoleRow = row;
                const xs = holeX(row - 1);
                for (const p of [A.p1, A.p2]) {
                    if (xs.some(x => Math.abs(x - p.x) < 120)) { A.exprFor(p, 'espantado', 0.45); A.hop(p, 3.5); }
                }
            }
            A.focus({
                x: mx, y: my - ahead, zoom: 1.8,
                rot: 0.22 + Math.sin(t * 0.9) * 0.08, k: 0.13, fit: [A.p1, A.p2], pad: 80
            });
        };
        const ahead = this.stage.portrait ? 90 : 120;
        A.snapCamera(pathX(y0), y0 - ahead, 1.8 * A.zoomRef, 0.22);
    }

    _setupRight(A) {
        const SPEED = 4.6;
        const y0 = A.bounds.maxY - 80;
        A.connected = false;
        A.sawVisible = false;
        const stag = this.stage.portrait ? 70 : 150;
        A.initPlayer(A.p1, A.center.x - 170, y0 - stag, 0, -SPEED);
        A.initPlayer(A.p2, A.center.x + 170, y0, 0, -SPEED);
        A.both(p => { p.wobble = 0.45; p.accel = 0.12; p.goal = { vx: 0, vy: -SPEED, holdX: p.x }; A.expr(p, 'assustado'); });

        const plan = [
            [0.35, 'p1', 'frente', 'W'], [0.8, 'p2', 'frente', 'E'], [1.25, 'p1', 'tras', 'E'],
            [1.6, 'p2', 'tras', 'W'], [2.0, 'p1', 'frente', 'W'], [2.3, 'p2', 'frente', 'W'],
            [2.75, 'p1', 'tras', 'E'], [3.1, 'p2', 'frente', 'E'], [3.5, 'p1', 'frente', 'W'],
            [3.8, 'p2', 'tras', 'W'], [4.25, 'p1', 'frente', 'E'], [4.6, 'p2', 'frente', 'W'],
            [5.0, 'p1', 'tras', 'W'], [5.4, 'p2', 'frente', 'E']
        ];
        let next = 0;
        A.script = (t) => {
            while (next < plan.length && t >= plan[next][0]) {
                const [, who, mode, side] = plan[next++];
                const p = A[who];
                const ahead = mode === 'frente';
                const y = p.y + (ahead ? -95 : 50);
                const fromW = side === 'W';
                A.fireArrow(fromW ? A.bounds.minX - 30 : A.bounds.maxX + 30, y, fromW ? 17 : -17);
                if (ahead) { p.brakeT = 0.32; A.hop(p, 4.5); }
                else A.swerve(p, 0, -3.5, 0.3);
                A.exprFor(p, 'espantado', 0.5);
                A.look(p, fromW ? p.x - 200 : p.x + 200);
                A.renderer.triggerShake(3);
            }
            if (t > 6.0) A.both(p => { if (p.goal) { p.goal = null; p.shiver = 0.35; A.expr(p, 'preocupado'); } });
            const m = A.mid;
            A.focus({
                x: m.x, y: m.y - ahead, zoom: 1.7,
                rot: -0.18 + Math.sin(t * 0.7 + 1) * 0.07, k: 0.12, fit: [A.p1, A.p2], pad: 90
            });
        };
        const ahead = this.stage.portrait ? -30 : 110;
        A.snapCamera(A.mid.x, A.mid.y - ahead, 1.7 * A.zoomRef, -0.18);
    }

    update(dt) {
        this.t += dt;
        this.left.update(dt);
        this.right.update(dt);
    }

    render() {
        const { ctx, canvas } = this.stage;
        const W = canvas.width, H = canvas.height, hw = Math.ceil(W / 2);
        if (this.stage.portrait) {
            const hh = Math.ceil(H / 2);
            this.left.render(W, hh);
            this.right.render(W, H - hh);
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.drawImage(this.left.canvas, 0, 0);
            ctx.drawImage(this.right.canvas, 0, hh);
            const bar = Math.max(6, Math.round(W / 120));
            ctx.fillStyle = '#0b0910';
            ctx.fillRect(0, hh - bar, W, bar * 2);
            ctx.fillStyle = '#4a4458';
            ctx.fillRect(0, hh - 1, W, 2);
            ctx.restore();
            return;
        }
        this.left.render(hw, H);
        this.right.render(W - hw, H);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(this.left.canvas, 0, 0);
        ctx.drawImage(this.right.canvas, hw, 0);
        const bar = Math.max(6, Math.round(H / 120));
        ctx.fillStyle = '#0b0910';
        ctx.fillRect(hw - bar, 0, bar * 2, H);
        ctx.fillStyle = '#4a4458';
        ctx.fillRect(hw - 1, 0, 2, H);
        ctx.restore();
    }
}
