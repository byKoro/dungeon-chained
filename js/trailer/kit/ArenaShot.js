/**
 * ArenaShot — base das cenas de montagem: uma ActionArena em tela cheia, com
 * duração fixa e entrada em CORTE SECO + impacto (cutIn = 'impact', tratado
 * pelo TrailerPlayer). Subclasses implementam setup(A) e, se quiserem,
 * shotUpdate(A, t).
 */
import { ActionArena } from './ActionArena.js';

export class ArenaShot {
    constructor(stage, arenaOpts = {}, duration = 4) {
        this.stage = stage;
        this.arena = new ActionArena(stage, arenaOpts);
        this.duration = duration;
        this.cutIn = 'impact';
        this.t = 0;
    }
    reset() { this.t = 0; }
    start() {
        this.t = 0;
        const A = this.arena;
        A.reset();
        A.ensureSize(this.stage.canvas.width, this.stage.canvas.height);
        this.setup(A);
        A.renderer.triggerShake(18); // tranco do corte
    }
    setup() {}
    get isDone() { return this.t >= this.duration; }
    get reachedEnd() { return this.isDone; }
    update(dt) {
        this.t += dt;
        this.arena.update(dt);
    }
    render() {
        const { ctx, canvas } = this.stage;
        this.arena.render(canvas.width, canvas.height);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(this.arena.canvas, 0, 0);
        ctx.restore();
    }
}
