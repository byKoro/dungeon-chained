import { HAZARDS } from '../config/GameConfig.js';

/**
 * SpikeTrap — espinhos de chão que sobem e descem num ciclo.
 *
 * Ciclo de sprites: peaks_3 -> peaks_0 -> peaks_1 -> peaks_2.
 *
 * Só peaks_2 causa dano. Se os sprites não carregarem, desenha uma
 * forma geométrica (triângulos) como fallback.
 *
 * O ciclo pode receber um `phase` (0..1) inicial para dessincronizar spikes
 * vizinhos (ondas), e um `delay` em frames.
 */
export class SpikeTrap {
    /**
     * @param {number} x centro no mundo
     * @param {number} y centro no mundo
     * @param {object} peaks array [img0..img3] dos frames (ou null p/ geométrico)
     * @param {object} opts { phaseOffset:0..1, cfg }
     */
    constructor(x, y, peaks = null, opts = {}) {
        this.x = x;
        this.y = y;
        this.hitRadius = 0; // não participa de colisões de empurrão
        this.peaks = peaks;
        this.cfg = opts.cfg || HAZARDS.spike;

        // Metade das durações anteriores; não depende da taxa do RAF.
        this.durations = [1, 0.15, 0.15, 2];
        this.cycle = this.durations.reduce((sum, seconds) => sum + seconds, 0);
        // Deslocamento de fase para criar ondas entre spikes vizinhos.
        this.elapsed = ((opts.phaseOffset || 0) * this.cycle) % this.cycle;

        this.state = "hidden";
        this.extend = 0; // 0 (recolhido) .. 1 (totalmente para fora)
        this.frameIndex = 3;
    }

    // Fase atual -> estado + nível de extensão (0..1).
    _advance(deltaSeconds) {
        this.elapsed = (this.elapsed + deltaSeconds) % this.cycle;
        if (this.elapsed < this.durations[0]) {
            this.frameIndex = 3;
            this.state = "hidden";
            this.extend = 0;
        } else if (this.elapsed < this.durations[0] + this.durations[1]) {
            this.frameIndex = 0;
            this.state = "warn";
            this.extend = 0.25;
        } else if (this.elapsed < this.durations[0] + this.durations[1] + this.durations[2]) {
            this.frameIndex = 1;
            this.state = "warn";
            this.extend = 0.5;
        } else {
            this.frameIndex = 2;
            this.state = "exposed";
            this.extend = 1;
        }
    }

    // Fere quando quase/totalmente estendido (letal perto do topo do ciclo).
    get isDangerous() {
        return this.frameIndex === 2;
    }

    update(players, deltaSeconds = 1 / 60) {
        this._advance(Math.max(0, deltaSeconds));
        if (!this.isDangerous) return;

        const r = this.cfg.damageRadius;
        for (const p of players) {
            if (Math.hypot(p.x - this.x, p.y - this.y) < r + p.hitRadius * 0.4) {
                // A fonte do empurrão é o próprio spike (empurra para fora dele).
                p.takeDamage(this.x, this.y);
            }
        }
    }

    draw(ctx) {
        const size = this.cfg.drawSize;
        const half = size / 2;

        // Sprite animado, se disponível.
        const frames = this.peaks;
        const img = frames && frames[this.frameIndex];
        if (img && img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, this.x - half, this.y - half, size, size);
            return;
        }

        // --- Fallback geométrico ---
        // Base (buraco no chão) sempre visível.
        ctx.save();
        ctx.fillStyle = "#1b1620";
        ctx.beginPath();
        ctx.ellipse(this.x, this.y + half * 0.4, half * 0.8, half * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();

        if (this.extend > 0.02) {
            const h = size * 0.8 * this.extend;
            const danger = this.isDangerous;
            ctx.fillStyle = danger ? "#d9d4e0" : "#7a7488";
            ctx.strokeStyle = "#2a2330";
            ctx.lineWidth = 2;
            const spikes = 3;
            const w = size * 0.72;
            const x0 = this.x - w / 2;
            const step = w / spikes;
            for (let i = 0; i < spikes; i++) {
                const bx = x0 + i * step;
                ctx.beginPath();
                ctx.moveTo(bx, this.y + half * 0.4);
                ctx.lineTo(bx + step / 2, this.y + half * 0.4 - h);
                ctx.lineTo(bx + step, this.y + half * 0.4);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
        }
        ctx.restore();
    }
}
