/**
 * DeathScreen — tela de morte: escurece a cena com um véu vermelho-sangue e
 * mostra SÓ o botão RESTART no centro, em pixel art (ver PixelButton.js).
 *
 * Game feel: o véu entra com atraso (deixa o golpe final ler), o botão nasce
 * com um pop elástico e depois "respira" em degraus de 1 pixel de arte.
 */
import { PixelButton, pixelScale } from './PixelButton.js';

export class DeathScreen {
    /**
     * @param {object} o
     * @param {() => void} o.onRestart  chamado ao clicar/apertar RESTART
     * @param {string} [o.label]
     */
    constructor({ onRestart, label = 'RESTART' }) {
        this.onRestart = onRestart;
        this.root = document.getElementById('death-screen') || this._createRoot();
        this.button = this.root.querySelector('.death-btn');
        this.pixel = new PixelButton(this.button, {
            label,
            ariaLabel: 'Restart',
            face: 'red',
            enabled: () => this.visible,
            onPress: () => this.onRestart?.()
        });

        this._onResize = () => this._applyScale();
        window.addEventListener('resize', this._onResize);
        this._applyScale();
    }

    _createRoot() {
        const root = document.createElement('div');
        root.id = 'death-screen';
        root.setAttribute('aria-hidden', 'true');
        root.innerHTML = '<button class="pixel-btn death-btn" type="button"><canvas></canvas></button>';
        document.body.appendChild(root);
        return root;
    }

    get visible() { return this.root.classList.contains('visible'); }

    show() {
        if (this.visible) return;
        this.pixel.reset();
        this.root.classList.add('visible');
        this.root.setAttribute('aria-hidden', 'false');
        // Foco no botão: Enter/Espaço (e controle via START) já reiniciam.
        setTimeout(() => { if (this.visible) this.button.focus({ preventScroll: true }); }, 400);
    }

    hide() {
        if (!this.visible) return;
        this.root.classList.remove('visible');
        this.root.setAttribute('aria-hidden', 'true');
        this.button.blur();
    }

    _applyScale() {
        const s = pixelScale();
        this.pixel.applyScale(s);
        this.root.style.setProperty('--px', `${s}px`);
    }
}
