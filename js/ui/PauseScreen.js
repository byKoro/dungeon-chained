/**
 * PauseScreen — tela de pausa: véu escuro de pedra (sem vermelho — o vermelho
 * é da morte) sobre a cena congelada e controles pixel art empilhados, todos
 * com a mesma largura:
 *   RESUME  (face vermelha, ação principal, já em foco)
 *   RESTART (face de pedra, ação secundária — só no jogo)
 *   VOLUME  (slider de pedra com o volume GERAL; MasterVolume)
 *
 * Navegação: setas / W-S (teclado) e d-pad/analógico (controle, via Game)
 * movem o foco; Enter/Espaço/A confirmam; ← → / A-D (ou d-pad) mexem no
 * volume com o slider em foco; Esc/B/START voltam.
 *
 * Game feel: os controles nascem com pop elástico escalonado; o que está em
 * foco "respira" em degraus de 1 pixel de arte; apertado, a face afunda; o
 * puxador do volume afunda ao arrastar e cada passo toca o clique de UI no
 * volume novo.
 *
 * Usada pelo jogo (#pause-screen) e pelo trailer (#trailer-pause, sem RESTART).
 */
import { PixelButton, pixelScale } from './PixelButton.js';
import { PixelSlider } from './PixelSlider.js';
import { measureText } from './PixelFont.js';
import { MasterVolume } from '../core/MasterVolume.js';

const LABELS = { resume: 'RESUME', restart: 'RESTART' };

export class PauseScreen {
    /**
     * @param {object} o
     * @param {() => void} o.onResume
     * @param {(() => void)|null} [o.onRestart]  sem ele, não há botão RESTART
     * @param {() => void} [o.onMove]  foco mudou (ex.: som de clique)
     * @param {string} [o.rootId]      id do elemento da tela (criado se não existir)
     * @param {boolean} [o.volume]     mostra o slider de volume geral
     */
    constructor({ onResume, onRestart = null, onMove = null, rootId = 'pause-screen', volume = true }) {
        this.onMove = onMove;
        this.root = document.getElementById(rootId) || this._createRoot(rootId);
        this.root.classList.add('pause-screen');
        let menu = this.root.querySelector('.pause-menu');
        if (!menu) { menu = document.createElement('div'); menu.className = 'pause-menu'; this.root.appendChild(menu); }
        menu.innerHTML = '';
        const labels = [LABELS.resume, ...(onRestart ? [LABELS.restart] : [])];
        const minTextW = Math.max(...labels.map(measureText), measureText(LABELS.restart));
        const mk = (tag) => { const el = document.createElement(tag); el.appendChild(document.createElement('canvas')); menu.appendChild(el); return el; };

        this.buttons = [
            new PixelButton(mk('button'), {
                label: LABELS.resume, ariaLabel: 'Resume', face: 'red', minTextW,
                enabled: () => this.visible, onPress: () => onResume?.()
            })
        ];
        if (onRestart) {
            this.buttons.push(new PixelButton(mk('button'), {
                label: LABELS.restart, ariaLabel: 'Restart', face: 'stone', minTextW,
                enabled: () => this.visible, onPress: () => onRestart?.()
            }));
        }
        this.slider = null;
        if (volume) {
            this.slider = new PixelSlider(mk('div'), {
                ariaLabel: 'Volume', minTextW, enabled: () => this.visible,
                get: () => MasterVolume.value, set: (v) => MasterVolume.set(v)
            });
            this._unsub = MasterVolume.subscribe(() => this.slider.refresh());
        }
        // Ordem de foco (de cima para baixo).
        this.items = [...this.buttons, ...(this.slider ? [this.slider] : [])];

        // Teclado: setas / W-S andam entre os controles (com volta).
        this.root.addEventListener('keydown', (e) => {
            const k = e.key.toLowerCase();
            if (k === 'arrowup' || k === 'w') { e.preventDefault(); this.move(-1); }
            else if (k === 'arrowdown' || k === 's') { e.preventDefault(); this.move(1); }
        });

        this._onResize = () => this._applyScale();
        window.addEventListener('resize', this._onResize);
        this._applyScale();
    }

    _createRoot(id) {
        const root = document.createElement('div');
        root.id = id;
        root.className = 'pause-screen';
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-label', 'Paused');
        root.setAttribute('aria-hidden', 'true');
        root.innerHTML = '<div class="pause-menu"></div>';
        document.body.appendChild(root);
        return root;
    }

    get visible() { return this.root.classList.contains('visible'); }

    show() {
        if (this.visible) return;
        this.items.forEach(b => b.reset());
        this.root.classList.add('visible');
        this.root.setAttribute('aria-hidden', 'false');
        // RESUME já em foco (Enter/A retoma direto).
        this.buttons[0].el.focus({ preventScroll: true });
    }

    hide() {
        if (!this.visible) return;
        this.root.classList.remove('visible');
        this.root.setAttribute('aria-hidden', 'true');
        this.items.forEach(b => b.el.blur());
    }

    // Índice do controle em foco (-1 se nenhum).
    get focusedIndex() {
        return this.items.findIndex(b => b.el === document.activeElement);
    }

    // Move o foco (delta = -1 sobe, +1 desce), com volta nas pontas.
    move(delta) {
        if (!this.visible) return;
        const n = this.items.length;
        const cur = this.focusedIndex;
        const next = cur < 0 ? 0 : (cur + delta + n) % n;
        this.items[next].el.focus({ preventScroll: true });
        this.onMove?.();
    }

    // Aciona o controle em foco (controle: botão A). No slider, não faz nada.
    confirm() {
        if (!this.visible) return;
        const item = this.items[Math.max(0, this.focusedIndex)];
        if (item instanceof PixelButton) item.el.click();
    }

    // ← / → do controle: mexe no volume se o slider estiver em foco.
    adjust(dir) {
        if (!this.visible || !this.slider || document.activeElement !== this.slider.el) return false;
        this.slider.step(dir * 0.1);
        return true;
    }

    _applyScale() {
        const s = pixelScale();
        this.items.forEach(b => b.applyScale(s));
        this.root.style.setProperty('--px', `${s}px`);
    }
}
