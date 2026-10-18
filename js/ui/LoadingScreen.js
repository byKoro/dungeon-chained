/**
 * LoadingScreen — tela de carregamento em DOM (cobre o canvas).
 *
 * Mostra o nome do jogo, uma frase e uma barra de progresso em pixel art.
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
const TIPS = [
    'Acorrentados, um não vai a lugar nenhum sem o outro.',
    'A serra só gira quando os DOIS se movem.',
    'Esticar demais a corda faz ela arrebentar.',
    'P1: WASD   ·   P2: SETAS'
];

export class LoadingScreen {
    constructor({ delayMs = 150, minVisibleMs = 450 } = {}) {
        this.delayMs = delayMs;
        this.minVisibleMs = minVisibleMs;
        this.el = document.getElementById('loading-screen') || this._build();
        this.label = this.el.querySelector('.ls-label');
        this.bar = this.el.querySelector('.ls-bar-fill');
        this.pct = this.el.querySelector('.ls-pct');
        this.tip = this.el.querySelector('.ls-tip');
        this._shownAt = 0;
        this._timer = 0;
    }

    _build() {
        const el = document.createElement('div');
        el.id = 'loading-screen';
        el.className = 'ls-hidden';
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        el.innerHTML = `
            <div class="ls-box">
                <div class="ls-title">DUNGEON CHAINED</div>
                <div class="ls-label">Carregando…</div>
                <div class="ls-bar" aria-hidden="true"><div class="ls-bar-fill"></div></div>
                <div class="ls-pct">0%</div>
                <div class="ls-tip"></div>
            </div>`;
        document.body.appendChild(el);
        return el;
    }

    show(text = 'Carregando…') {
        this.label.textContent = text;
        this.tip.textContent = TIPS[(Math.random() * TIPS.length) | 0];
        this.setProgress(0);
        clearTimeout(this._timer);
        // Só aparece se demorar (evita flash em carregamentos instantâneos).
        this._timer = setTimeout(() => {
            this.el.classList.remove('ls-hidden');
            this._shownAt = performance.now();
        }, this.delayMs);
    }

    setProgress(k) {
        const v = Math.max(0, Math.min(1, k || 0));
        // Barra em degraus (pixel art): avança de 5% em 5%.
        const stepped = Math.floor(v * 20) / 20;
        this.bar.style.width = `${stepped * 100}%`;
        this.pct.textContent = `${Math.round(v * 100)}%`;
    }

    async hide() {
        clearTimeout(this._timer);
        if (this._shownAt) {
            const wait = this.minVisibleMs - (performance.now() - this._shownAt);
            if (wait > 0) await new Promise(r => setTimeout(r, wait));
        }
        this.el.classList.add('ls-hidden');
        this._shownAt = 0;
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
}
