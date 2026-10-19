/**
 * PauseScreen — tela de pausa: véu escuro de pedra (sem vermelho — o vermelho
 * é da morte) sobre a cena congelada e SÓ dois botões pixel art empilhados,
 * com a mesma largura:
 *   RESUME  (face vermelha, ação principal, já em foco)
 *   RESTART (face de pedra, ação secundária)
 *
 * Navegação: setas / W-S (teclado) e d-pad/analógico (controle, via Game)
 * movem o foco; Enter/Espaço/A confirmam; Esc/B/START voltam ao jogo (Game).
 *
 * Game feel: os botões nascem com pop elástico escalonado; o botão em foco
 * "respira" em degraus de 1 pixel de arte; apertado, a face afunda.
 */
import { PixelButton, pixelScale } from './PixelButton.js';
import { measureText } from './PixelFont.js';

const LABELS = { resume: 'RESUME', restart: 'RESTART' };

export class PauseScreen {
    /**
     * @param {object} o
     * @param {() => void} o.onResume
     * @param {() => void} o.onRestart
     * @param {() => void} [o.onMove]  foco mudou (ex.: som de clique)
     */
    constructor({ onResume, onRestart, onMove = null }) {
        this.onMove = onMove;
        this.root = document.getElementById('pause-screen') || this._createRoot();
        const minTextW = Math.max(...Object.values(LABELS).map(measureText));
        const els = this.root.querySelectorAll('.pixel-btn');
        this.buttons = [
            new PixelButton(els[0], {
                label: LABELS.resume, ariaLabel: 'Resume', face: 'red', minTextW,
                enabled: () => this.visible, onPress: () => onResume?.()
            }),
            new PixelButton(els[1], {
                label: LABELS.restart, ariaLabel: 'Restart', face: 'stone', minTextW,
                enabled: () => this.visible, onPress: () => onRestart?.()
            })
        ];

        // Teclado: setas / W-S andam entre os botões (com volta).
        this.root.addEventListener('keydown', (e) => {
            const k = e.key.toLowerCase();
            if (k === 'arrowup' || k === 'w') { e.preventDefault(); this.move(-1); }
            else if (k === 'arrowdown' || k === 's') { e.preventDefault(); this.move(1); }
        });

        this._onResize = () => this._applyScale();
        window.addEventListener('resize', this._onResize);
        this._applyScale();
    }

    _createRoot() {
        const root = document.createElement('div');
        root.id = 'pause-screen';
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-label', 'Paused');
        root.setAttribute('aria-hidden', 'true');
        root.innerHTML = `
            <div class="pause-menu">
                <button class="pixel-btn" type="button"><canvas></canvas></button>
                <button class="pixel-btn" type="button"><canvas></canvas></button>
            </div>`;
        document.body.appendChild(root);
        return root;
    }

    get visible() { return this.root.classList.contains('visible'); }

    show() {
        if (this.visible) return;
        this.buttons.forEach(b => b.reset());
        this.root.classList.add('visible');
        this.root.setAttribute('aria-hidden', 'false');
        // RESUME já em foco (Enter/A retoma direto).
        this.buttons[0].el.focus({ preventScroll: true });
    }

    hide() {
        if (!this.visible) return;
        this.root.classList.remove('visible');
        this.root.setAttribute('aria-hidden', 'true');
        this.buttons.forEach(b => b.el.blur());
    }

    // Índice do botão em foco (-1 se nenhum).
    get focusedIndex() {
        return this.buttons.findIndex(b => b.el === document.activeElement);
    }

    // Move o foco (delta = -1 sobe, +1 desce), com volta nas pontas.
    move(delta) {
        if (!this.visible) return;
        const n = this.buttons.length;
        const cur = this.focusedIndex;
        const next = cur < 0 ? 0 : (cur + delta + n) % n;
        this.buttons[next].el.focus({ preventScroll: true });
        this.onMove?.();
    }

    // Aciona o botão em foco (controle: botão A).
    confirm() {
        if (!this.visible) return;
        const i = Math.max(0, this.focusedIndex);
        this.buttons[i].el.click();
    }

    _applyScale() {
        const s = pixelScale();
        this.buttons.forEach(b => b.applyScale(s));
        this.root.style.setProperty('--px', `${s}px`);
    }
}
