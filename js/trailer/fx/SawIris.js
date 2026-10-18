/**
 * SawIris — transição da cena 10 para a 11: o disco da serra (que encheu a
 * tela no mergulho) continua girando e se ABRE em espiral a partir do centro,
 * revelando a próxima cena. Vive em `stage.overlay` (o TrailerPlayer atualiza
 * e desenha por cima de tudo).
 *
 * Buraco = "catavento" de 3 braços (raio em dente de serra pelo ângulo), que
 * gira junto com o disco e cresce até passar dos cantos da tela.
 */
import { clamp01, easeIn } from '../anim.js';

const ARMS = 3;
const STEPS = 120;

export class SawIris {
    /** @param {HTMLImageElement} img folha da serra (assets.saw) */
    constructor(img, { dur = 0.8, rotation = 0 } = {}) {
        this.img = img;
        this.dur = dur;
        this.t = 0;
        this.rot = rotation;
        this._cv = null;
    }
    get done() { return this.t >= this.dur; }
    update(dt) {
        this.t += dt;
        this.rot += dt * (9 + 10 * clamp01(this.t / this.dur));
    }

    draw(ctx) {
        const W = ctx.canvas.width, H = ctx.canvas.height;
        if (!this._cv) this._cv = document.createElement('canvas');
        const cv = this._cv;
        if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
        const o = cv.getContext('2d');
        o.setTransform(1, 0, 0, 1, 0, 0);
        o.globalCompositeOperation = 'source-over';
        o.clearRect(0, 0, W, H);
        o.imageSmoothingEnabled = false;

        const k = clamp01(this.t / this.dur);
        const diag = Math.hypot(W, H) / 2;
        // O disco ainda cresce um pouco (a câmera atravessa a serra).
        const R = diag * 1.05 * (1 + 0.5 * easeIn(k));
        const img = this.img;
        o.save();
        o.translate(W / 2, H / 2);
        o.rotate(-this.rot);
        if (img && img.complete && img.naturalWidth) {
            o.drawImage(img, 0, 32, 16, 16, -R, -R, R * 2, R * 2);
        } else {
            o.fillStyle = '#8a93a8';
            o.beginPath(); o.arc(0, 0, R, 0, Math.PI * 2); o.fill();
        }
        o.restore();

        // Buraco em espiral (catavento) crescendo a partir do centro.
        const hole = diag * 1.9 * Math.pow(k, 1.35);
        if (hole > 1) {
            o.globalCompositeOperation = 'destination-out';
            o.beginPath();
            for (let i = 0; i <= STEPS; i++) {
                const a = (i / STEPS) * Math.PI * 2;
                const saw = ((a * ARMS / (Math.PI * 2)) + this.rot * 0.25) % 1;
                const r = hole * (0.45 + 0.55 * saw);
                const x = W / 2 + Math.cos(a + this.rot) * r, y = H / 2 + Math.sin(a + this.rot) * r;
                if (i === 0) o.moveTo(x, y); else o.lineTo(x, y);
            }
            o.closePath();
            o.fill();
        }

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(cv, 0, 0);
        // Brilho azul-aço da serra nos primeiros quadros (emenda com a cena 10).
        const f = 1 - clamp01(this.t / 0.25);
        if (f > 0) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = `rgba(190, 215, 255, ${0.35 * f})`;
            ctx.fillRect(0, 0, W, H);
        }
        ctx.restore();
    }
}
