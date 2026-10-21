/**
 * BloodScreen — transição de sangue em espaço de TELA, em pixel art grossa.
 *
 * Fases:
 *   1) spray(): gotas GRANDES voam pela tela (arcos com gravidade) e, ao
 *      "baterem na lente", viram manchas que escorrem para baixo. A taxa de
 *      gotas cresce até a tela encher.
 *   2) flood(): garante cobertura total (preenche o que faltar).
 *   3) drain(): a camada inteira ESCORRE verticalmente, coluna a coluna, com
 *      velocidades diferentes (cortina de sangue), revelando a cena de baixo.
 *
 * Tudo vive numa grade de "células" (pixels grossos) e é ampliado sem
 * suavização, combinando com o resto do jogo.
 */

const PALETTE = {
    base: [[110, 15, 28], [96, 11, 24], [124, 18, 32]],
    dark: [58, 5, 16],
    light: [163, 27, 43],
    shine: [214, 64, 72],
};

export class BloodScreen {
    constructor(canvas) {
        this.canvas = canvas;
        this.reset();
    }

    reset() {
        this.active = false;
        this.drops = [];      // gotas voando
        this.runs = [];       // escorridos (gotas que descem pela lente)
        this.mode = 'idle';   // idle | spray | drain | done
        this.drainT = 0;
    }

    // Prepara a grade conforme o tamanho atual da tela.
    _setupGrid() {
        const { width: W, height: H } = this.canvas;
        // Pixel grosso pelo LADO CURTO (em paisagem = altura): no vídeo
        // vertical o sangue tem o mesmo "pixel" e o mesmo nº de células.
        this.cell = Math.max(4, Math.round(Math.min(W, H) / 110));
        this.cols = Math.ceil(W / this.cell);
        this.rows = Math.ceil(H / this.cell);
        // Tela mais alta que larga: escorre proporcionalmente mais rápido
        // (a cortina leva o mesmo tempo para descer). Paisagem: 1.
        this._drainK = Math.max(1, this.rows / Math.ceil(Math.min(W, H) / this.cell));
        this.mask = new Uint8Array(this.cols * this.rows);   // 0 = vazio, 1 = sangue
        this.tone = new Uint8Array(this.cols * this.rows);   // variação de cor
        this.buf = document.createElement('canvas');
        this.buf.width = this.cols;
        this.buf.height = this.rows;
        this.bctx = this.buf.getContext('2d');
        this.img = this.bctx.createImageData(this.cols, this.rows);
        this.dirty = true;
        this.coverage = 0;
        this._filled = 0;
    }

    // Começa a fase de borrifo.
    startSpray() {
        this._setupGrid();
        this.active = true;
        this.mode = 'spray';
        this.drops = [];
        this.runs = [];
        this._spawnAcc = 0;
    }

    /**
     * Avança um frame. `intensity` 0..1 controla a taxa de gotas na fase spray.
     * dt em segundos.
     */
    update(dt, intensity = 1) {
        if (!this.active) return;
        const f = dt * 60; // passos de 60 Hz

        if (this.mode === 'spray') {
            // Taxa de gotas cresce com a intensidade (até ~9 por frame).
            this._spawnAcc += (0.4 + intensity * intensity * 9) * f;
            while (this._spawnAcc >= 1) { this._spawnAcc--; this._spawnDrop(intensity); }

            for (let i = this.drops.length - 1; i >= 0; i--) {
                const d = this.drops[i];
                d.vy += 0.035 * f;             // gravidade (em células)
                d.x += d.vx * f; d.y += d.vy * f;
                d.life -= f;
                if (d.life <= 0) { this._splat(d.x, d.y, d.r); this.drops.splice(i, 1); }
            }
        }

        // Escorridos: descem devagar pintando uma trilha vertical.
        if (this.mode === 'spray') {
            for (let i = this.runs.length - 1; i >= 0; i--) {
                const r = this.runs[i];
                const y0 = r.y;
                r.y += r.v * f;
                r.v *= 0.995;
                for (let y = Math.floor(y0); y <= Math.floor(r.y); y++) {
                    for (let x = r.x - r.w; x <= r.x + r.w; x++) this._set(x, y);
                }
                r.life -= f;
                if (r.life <= 0 || r.y >= this.rows) this.runs.splice(i, 1);
            }
        }

        if (this.mode === 'drain') {
            this.drainT += dt;
            for (let c = 0; c < this.cols; c++) {
                this.colVel[c] += this.colAcc[c] * f;
                this.colOff[c] += this.colVel[c] * f;
            }
            if (this.drainT > 0.4 && Math.min(...this.colOff) > this.rows + 4) {
                this.mode = 'done';
                this.active = false;
            }
        }
    }

    // Garante a tela 100% coberta (fim do spray).
    flood() {
        if (!this.mask) return;
        for (let i = 0; i < this.mask.length; i++) {
            if (!this.mask[i]) { this.mask[i] = 1; this.tone[i] = (Math.random() * 3) | 0; }
        }
        this.drops = [];
        this.runs = [];
        this.coverage = 1;
        this.dirty = true;
    }

    // Começa a escorrer a camada para baixo, revelando a cena.
    startDrain() {
        this.flood();
        this.mode = 'drain';
        this.drainT = 0;
        const n = this.cols;
        this.colOff = new Float32Array(n);
        this.colVel = new Float32Array(n);
        this.colAcc = new Float32Array(n);
        // Ruído suave entre colunas (blocos de cortina) + algumas colunas
        // "teimosas" que demoram (deixam fios escorrendo).
        const seeds = [Math.random() * 10, Math.random() * 10, Math.random() * 10];
        for (let c = 0; c < n; c++) {
            const u = c / n;
            const smooth = 0.5 + 0.5 * Math.sin(u * 9 + seeds[0]) * Math.sin(u * 23 + seeds[1]);
            const jitter = Math.random() * 0.35;
            const slow = Math.random() < 0.08 ? 0.35 : 1;
            const k = this._drainK ?? 1;
            this.colAcc[c] = (0.006 + 0.03 * (smooth + jitter)) * slow * k;
            this.colVel[c] = (0.05 + Math.random() * 0.1) * k;
            // Começa com uma leve ondulação (topo já irregular).
            this.colOff[c] = smooth * 2;
        }
    }

    get covered() { return this.coverage >= 0.995; }

    // ------------------------------------------------------------------
    _spawnDrop(intensity) {
        const { cols, rows } = this;
        // Nasce de um ponto aleatório (dentro e nas bordas) e voa em arco.
        const fromEdge = Math.random() < 0.55;
        let x, y, vx, vy;
        if (fromEdge) {
            const side = (Math.random() * 3) | 0; // esquerda, direita, baixo
            if (side === 0) { x = -4; y = Math.random() * rows * 0.8; vx = 0.8 + Math.random() * 1.4; vy = -0.6 - Math.random(); }
            else if (side === 1) { x = cols + 4; y = Math.random() * rows * 0.8; vx = -0.8 - Math.random() * 1.4; vy = -0.6 - Math.random(); }
            else { x = Math.random() * cols; y = rows + 4; vx = (Math.random() - 0.5) * 1.6; vy = -1.6 - Math.random() * 1.2; }
        } else {
            x = Math.random() * cols; y = Math.random() * rows;
            const a = Math.random() * Math.PI * 2, sp = 0.4 + Math.random() * 1.2;
            vx = Math.cos(a) * sp; vy = Math.sin(a) * sp - 0.5;
        }
        const r = 2 + Math.random() * (3 + intensity * 5); // GRANDES (em células)
        this.drops.push({ x, y, vx, vy, r, life: 18 + Math.random() * 30 });
    }

    // Mancha ao bater na "lente": blob irregular + respingos + escorridos.
    _splat(cx, cy, r) {
        // Gancho de som (px de tela; r em px também).
        this.onSplat?.(cx * this.cell, cy * this.cell, r * this.cell);
        const R = r * 1.6;
        for (let y = Math.floor(cy - R - 1); y <= cy + R + 1; y++) {
            for (let x = Math.floor(cx - R - 1); x <= cx + R + 1; x++) {
                const dx = x - cx, dy = (y - cy) * 1.1;
                const wob = R * (0.85 + 0.3 * Math.sin(Math.atan2(dy, dx) * 5 + r));
                if (dx * dx + dy * dy <= wob * wob) this._set(x, y);
            }
        }
        // Respingos satélites.
        const n = 3 + ((Math.random() * 5) | 0);
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            const d = R * (1.3 + Math.random() * 1.2);
            const sr = 0.6 + Math.random() * 1.2;
            const sx = cx + Math.cos(a) * d, sy = cy + Math.sin(a) * d;
            for (let y = Math.floor(sy - sr); y <= sy + sr; y++)
                for (let x = Math.floor(sx - sr); x <= sx + sr; x++)
                    if ((x - sx) ** 2 + (y - sy) ** 2 <= sr * sr) this._set(x, y);
        }
        // Escorridos verticais a partir da base da mancha.
        const runs = 1 + ((Math.random() * 3) | 0);
        for (let i = 0; i < runs; i++) {
            this.runs.push({
                x: Math.round(cx + (Math.random() - 0.5) * R * 1.4),
                y: cy + R * 0.6,
                w: Math.random() < 0.4 ? 1 : 0,
                v: 0.25 + Math.random() * 0.45,
                life: 40 + Math.random() * 90
            });
        }
    }

    _set(x, y) {
        if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return;
        const i = y * this.cols + x;
        if (!this.mask[i]) {
            this.mask[i] = 1;
            this.tone[i] = (Math.random() * 3) | 0;
            this._filled = (this._filled ?? 0) + 1;
            this.coverage = this._filled / this.mask.length;
            this.dirty = true;
        }
    }

    // Recompõe a imagem da camada (com bisel: topo claro, base escura).
    _rebuild() {
        const { cols, rows, mask, tone } = this;
        const data = this.img.data;
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const i = y * cols + x;
                const o = i * 4;
                if (!mask[i]) { data[o + 3] = 0; continue; }
                const up = y > 0 ? mask[i - cols] : 1;
                const up2 = y > 1 ? mask[i - cols * 2] : 1;
                const down = y < rows - 1 ? mask[i + cols] : 1;
                let c = PALETTE.base[tone[i]];
                if (!up) c = PALETTE.shine;
                else if (!up2) c = PALETTE.light;
                else if (!down) c = PALETTE.dark;
                data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
            }
        }
        this.bctx.putImageData(this.img, 0, 0);
        this.dirty = false;
    }

    draw(ctx) {
        if (!this.mask || this.mode === 'idle' || this.mode === 'done') return;
        if (this.dirty) this._rebuild();
        const s = this.cell;
        ctx.save();
        ctx.imageSmoothingEnabled = false;

        if (this.mode === 'drain') {
            // Cada coluna desce no seu ritmo. Um rastro fino e translúcido fica
            // para trás e some (sangue escorrido na lente).
            const trailA = Math.max(0, 0.35 - this.drainT * 0.25);
            for (let c = 0; c < this.cols; c++) {
                const off = Math.floor(this.colOff[c]);
                if (off >= this.rows) continue;
                if (trailA > 0 && off > 0) {
                    ctx.globalAlpha = trailA;
                    ctx.drawImage(this.buf, c, 0, 1, 1, c * s, 0, s, off * s);
                }
                ctx.globalAlpha = 1;
                ctx.drawImage(this.buf, c, 0, 1, this.rows - off, c * s, off * s, s, (this.rows - off) * s);
                // "Cabeça" da gota: brilho no topo de cada coluna que desce.
                ctx.fillStyle = 'rgb(214,64,72)';
                ctx.fillRect(c * s, off * s, s, s);
            }
        } else {
            ctx.drawImage(this.buf, 0, 0, this.cols * s, this.rows * s);
            // Gotas voando: blobs grossos com brilho.
            for (const d of this.drops) {
                const R = Math.max(1, Math.round(d.r));
                for (let y = -R; y <= R; y++) {
                    for (let x = -R; x <= R; x++) {
                        if (x * x + y * y > R * R) continue;
                        const top = (x * x + (y - 1) * (y - 1)) > R * R;
                        ctx.fillStyle = top ? 'rgb(214,64,72)' : 'rgb(124,18,32)';
                        ctx.fillRect(Math.round(d.x + x) * s, Math.round(d.y + y) * s, s, s);
                    }
                }
                // Rastro curto atrás da gota.
                ctx.fillStyle = 'rgb(96,11,24)';
                ctx.fillRect(Math.round(d.x - d.vx * 3) * s, Math.round(d.y - d.vy * 3) * s, s, s);
            }
        }
        ctx.restore();
    }
}
