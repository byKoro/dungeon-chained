/**
 * WebInputAdapter - Platform Input Adapter for Web.
 * Implements IInputProvider port.
 * Normalizes DOM keyboard events and Gamepad API into an immutable InputSnapshot:
 * {
 *   players: [
 *     { moveX: number, moveY: number, dash: boolean, interact: boolean },
 *     { moveX: number, moveY: number, dash: boolean, interact: boolean }
 *   ],
 *   menu: { up: boolean, down: boolean, left: boolean, right: boolean, confirm: boolean, cancel: boolean, pause: boolean },
 *   dt: number
 * }
 */

export class WebInputAdapter {
    constructor(opts = {}) {
        this.inputHandler = opts.inputHandler || null;
        this.menuPad = opts.menuPad || null;
        this.deadZone = opts.deadZone ?? 0.35;

        // Internal key state if standalone (no inputHandler passed)
        this._keys = new Set();
        this._testSnapshotOverride = null;

        // If standalone and in browser environment, bind DOM listeners
        if (!this.inputHandler && typeof window !== 'undefined') {
            this._boundKeyDown = (e) => {
                this._keys.add(e.key.toLowerCase());
                this._keys.add(e.code.toLowerCase());
            };
            this._boundKeyUp = (e) => {
                this._keys.delete(e.key.toLowerCase());
                this._keys.delete(e.code.toLowerCase());
            };
            this._boundBlur = () => {
                this._keys.clear();
            };
            window.addEventListener('keydown', this._boundKeyDown);
            window.addEventListener('keyup', this._boundKeyUp);
            window.addEventListener('blur', this._boundBlur);
        }
    }

    destroy() {
        if (typeof window !== 'undefined') {
            if (this._boundKeyDown) window.removeEventListener('keydown', this._boundKeyDown);
            if (this._boundKeyUp) window.removeEventListener('keyup', this._boundKeyUp);
            if (this._boundBlur) window.removeEventListener('blur', this._boundBlur);
        }
    }

    /**
     * Check if a key is down, reading from inputHandler or internal set.
     */
    isDown(key) {
        const k = key.toLowerCase();
        if (this.inputHandler?.isDown) {
            return this.inputHandler.isDown(k);
        }
        return this._keys.has(k);
    }

    /**
     * Poll gamepad state directly if available.
     * Returns array of player gamepad inputs: [{ moveX, moveY, dash, interact }]
     */
    _pollGamepads() {
        const results = [
            { moveX: 0, moveY: 0, dash: false, interact: false },
            { moveX: 0, moveY: 0, dash: false, interact: false }
        ];

        if (typeof navigator === 'undefined' || !navigator.getGamepads) {
            return results;
        }

        const pads = navigator.getGamepads();
        if (!pads) return results;

        for (let i = 0; i < 2; i++) {
            const pad = pads[i];
            if (!pad) continue;

            const ax = pad.axes?.[0] || 0;
            const ay = pad.axes?.[1] || 0;

            let mx = 0;
            let my = 0;
            if (Math.abs(ax) > this.deadZone) {
                mx = ax;
            }
            if (Math.abs(ay) > this.deadZone) {
                my = ay;
            }

            // D-Pad buttons (12: up, 13: down, 14: left, 15: right)
            if (this._isButtonPressed(pad, 14)) mx = -1;
            if (this._isButtonPressed(pad, 15)) mx = 1;
            if (this._isButtonPressed(pad, 12)) my = -1;
            if (this._isButtonPressed(pad, 13)) my = 1;

            // Dash: Button 0 (A/Cross) or Button 5 (RB/R1)
            const dash = this._isButtonPressed(pad, 0) || this._isButtonPressed(pad, 5);
            // Interact: Button 2 (X/Square)
            const interact = this._isButtonPressed(pad, 2);

            results[i] = { moveX: mx, moveY: my, dash, interact };
        }

        return results;
    }

    _isButtonPressed(pad, btnIndex) {
        const btn = pad.buttons?.[btnIndex];
        if (!btn) return false;
        return typeof btn === 'object' ? btn.pressed : btn > 0.5;
    }

    /**
     * Poll menu navigation input (dpad, sticks, confirmation keys).
     */
    _pollMenu() {
        if (this.menuPad?.poll) {
            const hit = this.menuPad.poll();
            return {
                up: !!hit.up,
                down: !!hit.down,
                left: !!hit.left,
                right: !!hit.right,
                confirm: !!(hit.a || hit.start),
                cancel: !!hit.b,
                pause: !!hit.start
            };
        }

        const up = this.isDown('w') || this.isDown('arrowup');
        const down = this.isDown('s') || this.isDown('arrowdown');
        const left = this.isDown('a') || this.isDown('arrowleft');
        const right = this.isDown('d') || this.isDown('arrowright');
        const confirm = this.isDown('enter') || this.isDown(' ') || this.isDown('e');
        const cancel = this.isDown('escape') || this.isDown('backspace');
        const pause = this.isDown('escape');

        return { up, down, left, right, confirm, cancel, pause };
    }

    /**
     * Generates a complete InputSnapshot conforming to IInputProvider.
     * @param {number} dt Frame delta time in seconds (default 1/60)
     * @returns {Object} InputSnapshot
     */
    getInputSnapshot(dt = 1 / 60) {
        if (this._testSnapshotOverride) {
            return { ...this._testSnapshotOverride, dt };
        }

        // If inputHandler exists, ensure its gamepads are polled
        if (this.inputHandler?.pollGamepads) {
            this.inputHandler.pollGamepads();
        }

        const padInputs = this._pollGamepads();

        // Player 0 (Keyboard: WASD, Space = Dash, E = Interact)
        let p1X = (this.isDown('d') ? 1 : 0) - (this.isDown('a') ? 1 : 0);
        let p1Y = (this.isDown('s') ? 1 : 0) - (this.isDown('w') ? 1 : 0);
        let p1Dash = this.isDown(' ') || this.isDown('space');
        let p1Interact = this.isDown('e') || this.isDown('keye');

        // Blend with gamepad 0
        if (padInputs[0].moveX !== 0 || padInputs[0].moveY !== 0) {
            p1X = padInputs[0].moveX;
            p1Y = padInputs[0].moveY;
        }
        p1Dash = p1Dash || padInputs[0].dash;
        p1Interact = p1Interact || padInputs[0].interact;

        // Player 1 (Keyboard: Arrows, Enter = Dash, ShiftRight = Interact)
        let p2X = (this.isDown('arrowright') ? 1 : 0) - (this.isDown('arrowleft') ? 1 : 0);
        let p2Y = (this.isDown('arrowdown') ? 1 : 0) - (this.isDown('arrowup') ? 1 : 0);
        let p2Dash = this.isDown('enter');
        let p2Interact = this.isDown('shiftright');

        // Blend with gamepad 1
        if (padInputs[1].moveX !== 0 || padInputs[1].moveY !== 0) {
            p2X = padInputs[1].moveX;
            p2Y = padInputs[1].moveY;
        }
        p2Dash = p2Dash || padInputs[1].dash;
        p2Interact = p2Interact || padInputs[1].interact;

        const menu = this._pollMenu();

        return {
            players: [
                { moveX: p1X, moveY: p1Y, dash: p1Dash, interact: p1Interact },
                { moveX: p2X, moveY: p2Y, dash: p2Dash, interact: p2Interact }
            ],
            menu,
            dt
        };
    }

    /**
     * For headless testing or script overrides.
     */
    setTestOverride(snapshot) {
        this._testSnapshotOverride = snapshot;
    }
}
