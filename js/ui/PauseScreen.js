import { PixelButton, pixelScale } from './PixelButton.js';
import { PixelSlider } from './PixelSlider.js';
import { measureText } from './PixelFont.js';
import { MasterVolume } from '../core/MasterVolume.js';

const LABELS = { resume: 'RESUME', restart: 'RESTART' };

export class PauseScreen {

    constructor({ onResume, onRestart = null, onMove = null, rootId = 'pause-screen', volume = true, restartLabel = LABELS.restart }) {
        this.onMove = onMove;
        this.root = document.getElementById(rootId) || this._createRoot(rootId);
        this.root.classList.add('pause-screen');
        let menu = this.root.querySelector('.pause-menu');
        if (!menu) { menu = document.createElement('div'); menu.className = 'pause-menu'; this.root.appendChild(menu); }
        menu.innerHTML = '';
        const labels = [LABELS.resume, ...(onRestart ? [restartLabel] : [])];
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
                label: restartLabel, ariaLabel: restartLabel === LABELS.restart ? 'Restart' : restartLabel.toLowerCase(), face: 'stone', minTextW,
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

        this.items = [...this.buttons, ...(this.slider ? [this.slider] : [])];

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

        this.buttons[0].el.focus({ preventScroll: true });
    }

    hide() {
        if (!this.visible) return;
        this.root.classList.remove('visible');
        this.root.setAttribute('aria-hidden', 'true');
        this.items.forEach(b => b.el.blur());
    }

    get focusedIndex() {
        return this.items.findIndex(b => b.el === document.activeElement);
    }

    move(delta) {
        if (!this.visible) return;
        const n = this.items.length;
        const cur = this.focusedIndex;
        const next = cur < 0 ? 0 : (cur + delta + n) % n;
        this.items[next].el.focus({ preventScroll: true });
        this.onMove?.();
    }

    confirm() {
        if (!this.visible) return;
        const item = this.items[Math.max(0, this.focusedIndex)];
        if (item instanceof PixelButton) item.el.click();
    }

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
