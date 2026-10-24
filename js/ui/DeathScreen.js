import { PixelButton, pixelScale } from './PixelButton.js';

export class DeathScreen {

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
