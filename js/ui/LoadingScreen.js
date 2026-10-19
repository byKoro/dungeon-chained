/**
 * LoadingScreen — tela de carregamento em DOM (cobre o canvas).
 *
 * Minimalista: fundo escuro e SÓ a barra, em pixel art chunky (mesma
 * linguagem do botão da tela de morte: moldura de pedra chanfrada, rebites de
 * ferro, poço escuro e blocos vermelho-sangue). A barra é um canvas pequeno em
 * resolução de ARTE ampliado por uma escala inteira (pixels nítidos).
 *
 * Game feel: cada bloco que acende dá um clarão e assenta no vermelho; o
 * próximo bloco vazio pulsa fraco (mostra que está vivo mesmo se o progresso
 * travar um instante).
 *
 * Para não "piscar" em carregamentos instantâneos, só aparece depois de
 * `delayMs`; e, uma vez visível, fica pelo menos `minVisibleMs`.
 *
 * Uso:
 *   const loading = new LoadingScreen();
 *   await loading.run('Carregando o calabouço…', [
 *       { weight: 3, task: (p) => assets.whenReady((d, t) => p(d / t)) },
 *       { weight: 1, task: () => catalog.load() },
 *   ]);
 *   // run() esconde a tela ao terminar.
 */
const PAL = {
    outline: '#0b0910',
    stone: '#4a4458',
    stoneLight: '#6e6684',
    stoneDark: '#2b2735',
    seam: '#1f1b28',
    well: '#16131d',
    wellShade: '#0f0d15',
    iron: '#7d8696',
    ironLight: '#c9d1dc',
    ironDark: '#454b57',
    red: '#8a1424',
    redLight: '#c22a3c',
    redDark: '#6e0f1c',
    redSpec: '#ff6b7a',
    flash: '#ffd6de',
};

const SEGMENTS = 12;  // blocos da barra (progresso em degraus de 1/12)
const SEG_W = 4;      // largura de um bloco (px de arte)
const GAP = 1;        // junta entre blocos
const SEG_H = 3;      // altura de um bloco
const FLASH_MS = 160; // clarão ao acender um bloco

// Geometria (px de arte): contorno 1 + pedra 2 + poço com 1 px de folga.
const WELL_W = SEGMENTS * SEG_W + (SEGMENTS - 1) * GAP + 2;
const WELL_H = SEG_H + 2;
const W = WELL_W + 6;
const H = WELL_H + 6;

export class LoadingScreen {
    constructor({ delayMs = 150, minVisibleMs = 450 } = {}) {
        this.delayMs = delayMs;
        this.minVisibleMs = minVisibleMs;
        this.el = document.getElementById('loading-screen') || this._build();
        this.canvas = this.el.querySelector('canvas.ls-bar') || this._ensureCanvas();
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = W + 1;   // +1 da sombra projetada
        this.canvas.height = H + 1;
        this._shownAt = 0;
        this._timer = 0;
        this._lit = 0;               // blocos acesos
        this._litAt = new Array(SEGMENTS).fill(-1e9);
        this._raf = 0;
        this._onResize = () => this._applyScale();
        window.addEventListener('resize', this._onResize);
        this._applyScale();
        this._draw(performance.now());
        // A tela começa visível no index.html (cobre o canvas enquanto os
        // módulos carregam): já anima desde agora.
        if (!this.el.classList.contains('ls-hidden')) this._startLoop();
    }

    _build() {
        const el = document.createElement('div');
        el.id = 'loading-screen';
        el.className = 'ls-hidden';
        el.setAttribute('role', 'progressbar');
        el.setAttribute('aria-valuemin', '0');
        el.setAttribute('aria-valuemax', '100');
        el.innerHTML = '<canvas class="ls-bar" aria-hidden="true"></canvas>';
        document.body.appendChild(el);
        return el;
    }

    _ensureCanvas() {
        const c = document.createElement('canvas');
        c.className = 'ls-bar';
        c.setAttribute('aria-hidden', 'true');
        this.el.appendChild(c);
        return c;
    }

    show(text = 'Carregando…') {
        // Sem texto na tela: o rótulo vai só para o leitor de tela.
        this.el.setAttribute('aria-label', text);
        this._lit = 0;
        this._litAt.fill(-1e9);
        this.setProgress(0);
        clearTimeout(this._timer);
        // Só aparece se demorar (evita flash em carregamentos instantâneos).
        this._timer = setTimeout(() => {
            this.el.classList.remove('ls-hidden');
            this._shownAt = performance.now();
            this._startLoop();
        }, this.delayMs);
    }

    setProgress(k) {
        const v = Math.max(0, Math.min(1, k || 0));
        this.el.setAttribute('aria-valuenow', String(Math.round(v * 100)));
        // Progresso em blocos inteiros; os novos acendem com clarão.
        const lit = Math.floor(v * SEGMENTS + 1e-6);
        const now = performance.now();
        for (let i = this._lit; i < lit; i++) this._litAt[i] = now + (i - this._lit) * 40;
        if (lit > this._lit) this._lit = lit;
    }

    async hide() {
        clearTimeout(this._timer);
        if (this._shownAt) {
            const wait = this.minVisibleMs - (performance.now() - this._shownAt);
            if (wait > 0) await new Promise(r => setTimeout(r, wait));
        }
        this.el.classList.add('ls-hidden');
        this._shownAt = 0;
        // Para o loop depois do fade de saída.
        setTimeout(() => {
            if (this.el.classList.contains('ls-hidden')) this._stopLoop();
        }, 400);
    }

    /**
     * Executa tarefas em paralelo e mostra o progresso combinado (por peso).
     * Cada tarefa recebe `report(0..1)` para progresso parcial.
     */
    async run(text, tasks) {
        this.show(text);
        const parts = tasks.map(() => 0);
        const total = tasks.reduce((s, t) => s + (t.weight ?? 1), 0) || 1;
        const update = () => this.setProgress(
            tasks.reduce((s, t, i) => s + parts[i] * (t.weight ?? 1), 0) / total);
        await Promise.all(tasks.map(async (t, i) => {
            const report = (k) => { parts[i] = Math.max(parts[i], Math.min(1, k)); update(); };
            try { await t.task(report); } catch (err) { console.warn('[loading]', err); }
            report(1);
        }));
        this.setProgress(1);
        await this.hide();
    }

    _startLoop() {
        if (this._raf) return;
        const tick = (t) => {
            this._draw(t);
            this._raf = requestAnimationFrame(tick);
        };
        this._raf = requestAnimationFrame(tick);
    }

    _stopLoop() {
        cancelAnimationFrame(this._raf);
        this._raf = 0;
    }

    // Escala INTEIRA a partir da janela (a barra ocupa ~1/3 da largura).
    _applyScale() {
        const byW = Math.floor((window.innerWidth * 0.34) / W);
        const byH = Math.floor(window.innerHeight / 120);
        const s = Math.max(3, Math.min(10, Math.min(byW, byH)));
        this.canvas.style.width = `${this.canvas.width * s}px`;
        this.canvas.style.height = `${this.canvas.height * s}px`;
    }

    _draw(now) {
        const ctx = this.ctx;
        const px = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); };
        const rect = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
        const chamfer = (x, y, w, h, c) => { rect(x + 1, y, w - 2, h, c); rect(x, y + 1, w, h - 2, c); };
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // --- Sombra projetada ---
        ctx.globalAlpha = 0.5;
        chamfer(1, 1, W, H, '#000');
        ctx.globalAlpha = 1;

        // --- Moldura de pedra chanfrada com bisel ---
        chamfer(0, 0, W, H, PAL.outline);
        chamfer(1, 1, W - 2, H - 2, PAL.stone);
        rect(2, 1, W - 4, 1, PAL.stoneLight);
        rect(1, 2, 1, H - 4, PAL.stoneLight);
        rect(2, H - 2, W - 4, 1, PAL.stoneDark);
        rect(W - 2, 2, 1, H - 4, PAL.stoneDark);
        for (let x = 9, i = 0; x < W - 8; x += 10 + (i++ % 3)) {
            px(x, 1, PAL.seam);
            px(x + 1, 1, PAL.stoneLight);
        }
        for (let x = 14, i = 0; x < W - 8; x += 9 + (i++ % 4)) px(x, H - 2, PAL.seam);

        // --- Poço escuro com sombra interna no topo ---
        rect(3, 3, WELL_W, WELL_H, PAL.well);
        rect(3, 3, WELL_W, 1, PAL.wellShade);

        // --- Blocos ---
        const sx0 = 4, sy = 4;
        for (let i = 0; i < SEGMENTS; i++) {
            const x = sx0 + i * (SEG_W + GAP);
            if (i < this._lit) {
                const age = now - this._litAt[i];
                if (age < 0) continue; // ainda vai acender (escalonado)
                if (age < FLASH_MS * 0.5) {
                    rect(x, sy, SEG_W, SEG_H, PAL.flash);           // clarão
                } else {
                    const fresh = age < FLASH_MS;
                    rect(x, sy, SEG_W, SEG_H, fresh ? PAL.redLight : PAL.red);
                    rect(x, sy, SEG_W, 1, fresh ? PAL.redSpec : PAL.redLight);
                    rect(x, sy + SEG_H - 1, SEG_W, 1, PAL.redDark);
                    px(x, sy, PAL.redSpec);
                }
            } else if (i === this._lit) {
                // Próximo bloco: pulso fraco (a barra "respira" enquanto espera).
                const on = Math.floor(now / 380) % 2 === 0;
                if (on) rect(x, sy + 1, SEG_W, 1, PAL.redDark);
            }
        }

        // --- Rebites de ferro nas pontas ---
        const rivet = (x, y) => {
            px(x, y, PAL.ironLight); px(x + 1, y, PAL.iron);
            px(x, y + 1, PAL.iron); px(x + 1, y + 1, PAL.ironDark);
        };
        rivet(1, 1); rivet(W - 3, 1); rivet(1, H - 3); rivet(W - 3, H - 3);
    }
}
