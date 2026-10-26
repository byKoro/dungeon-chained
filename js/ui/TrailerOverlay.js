import { PixelButton, pixelScale } from './PixelButton.js';
import { playUi, preloadUi } from './UiSound.js';

const SKIP_DELAY_MS = 3000;

export class TrailerOverlay {

    constructor({ onStart, onPause = null, isTrailerPaused = () => false }) {
        this.root = document.getElementById('trailer-overlay');
        this.skip = document.getElementById('btn-skip');
        this.start = document.getElementById('btn-start');
        this._confirmed = false;
        this._skipTimer = 0;
        if (!this.root) return;

        this.skipBtn = new PixelButton(this.skip, {
            label: 'SKIP ▶', ariaLabel: 'Skip trailer', face: 'gold',
            enabled: () => this.skip.classList.contains('visible'),
            onPress: onStart
        });
        this.startBtn = new PixelButton(this.start, {
            label: 'START', ariaLabel: 'Start game', face: 'red',
            enabled: () => this.start.classList.contains('visible') && !this._confirmed,
            onPress: () => { this._confirmed = true; onStart(); }
        });
        this._confirmStart = () => {
            // Enter/Espaço não passam pelo clique do botão: mostra o quadro apertado e toca o som uma vez só.
            if (!this._confirmed) { this.startBtn.showPressed(); playUi('uiConfirm'); }
            this._confirmed = true;
            onStart();
        };

        this._onResize = () => this._applyScale();
        window.addEventListener('resize', this._onResize);
        this._applyScale();
        preloadUi();

        this._onKey = (e) => {
            if (e.key === 'Escape') { if (!e.repeat) onPause?.(); }
            else if (isTrailerPaused()) return;
            else if ((e.key === 'Enter' || e.key === ' ') && this.start.classList.contains('visible')) {
                e.preventDefault();
                this._confirmStart();
            }
        };
        window.addEventListener('keydown', this._onKey);
    }

    _applyScale() {
        const s = pixelScale();
        const sSkip = Math.max(2, s - 2);
        this.skipBtn.applyScale(sSkip);
        this.skip.style.setProperty('--px', `${sSkip}px`);
        this.startBtn.applyScale(s);
        this.start.style.setProperty('--px', `${s}px`);
    }

    showSkip() {
        if (!this.root) return;
        this.root.classList.remove('hidden');
        clearTimeout(this._skipTimer);
        this._skipTimer = setTimeout(() => {
            if (this.start.classList.contains('visible') || this.root.classList.contains('hidden')) return;
            this.skip.classList.add('visible');
        }, SKIP_DELAY_MS);
    }

    showStart() {
        if (!this.root) return;
        this.root.classList.remove('hidden');
        this.skip.classList.remove('visible');
        // Tirar o foco do SKIP antes evita o "uiMove" no foco automático do START.
        this.skip.blur();
        this.start.classList.add('visible');
        this.start.focus({ preventScroll: true });
    }

    hide() {
        if (!this.root) return;
        clearTimeout(this._skipTimer);
        window.removeEventListener('keydown', this._onKey);
        window.removeEventListener('resize', this._onResize);
        this.skip.classList.remove('visible');
        this.start.classList.remove('visible');
        this.root.classList.add('hidden');
    }
}
