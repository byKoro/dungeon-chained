export class InputHandler {
    constructor() {

        this.keys = new Set();

        this.keyboardKeys = new Set();

        this.gamepadControls = [
            { up: "w", down: "s", left: "a", right: "d" },
            { up: "arrowup", down: "arrowdown", left: "arrowleft", right: "arrowright" }
        ];

        this.deadZone = 0.35;

        window.addEventListener("keydown", (e) => {
            this.keyboardKeys.add(e.key.toLowerCase());

            const k = e.key.toLowerCase();
            if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) {
                e.preventDefault();
            }
        });

        window.addEventListener("keyup", (e) => {
            this.keyboardKeys.delete(e.key.toLowerCase());
        });

        window.addEventListener("blur", () => this.keyboardKeys.clear());

        if (typeof window !== "undefined") {
            window.addEventListener("gamepadconnected", (e) => {
                console.log(`Controle conectado [${e.gamepad.index}]: ${e.gamepad.id}`);
            });
            window.addEventListener("gamepaddisconnected", (e) => {
                console.log(`Controle desconectado [${e.gamepad.index}]: ${e.gamepad.id}`);
            });
        }
    }

    pollGamepads() {

        this.keys = new Set(this.keyboardKeys);

        if (typeof navigator === "undefined" || !navigator.getGamepads) return;

        const pads = navigator.getGamepads();
        if (!pads) return;

        for (let i = 0; i < this.gamepadControls.length; i++) {
            const pad = pads[i];
            if (!pad) continue;

            const map = this.gamepadControls[i];

            const ax = pad.axes[0] || 0;
            const ay = pad.axes[1] || 0;
            if (ax < -this.deadZone) this.keys.add(map.left);
            if (ax > this.deadZone) this.keys.add(map.right);
            if (ay < -this.deadZone) this.keys.add(map.up);
            if (ay > this.deadZone) this.keys.add(map.down);

            if (this.isButtonPressed(pad, 12)) this.keys.add(map.up);
            if (this.isButtonPressed(pad, 13)) this.keys.add(map.down);
            if (this.isButtonPressed(pad, 14)) this.keys.add(map.left);
            if (this.isButtonPressed(pad, 15)) this.keys.add(map.right);
        }
    }

    isButtonPressed(pad, index) {
        const btn = pad.buttons[index];
        if (!btn) return false;
        return typeof btn === "object" ? btn.pressed : btn > 0.5;
    }

    isDown(key) {
        return this.keys.has(key.toLowerCase());
    }
}
