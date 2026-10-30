// Teclas de cada jogador (e.key e e.code em minúsculas), para saber quem usou o teclado.
const KEYBOARD_OWNER = [
    new Set(["w", "a", "s", "d", " ", "e", "keyw", "keya", "keys", "keyd", "space", "keye"]),
    new Set(["arrowup", "arrowdown", "arrowleft", "arrowright", "enter", "shiftright"])
];

// Ícone do botão: PlayStation pelo fabricante Sony (054c) ou pelo nome; qualquer outro controle cai no Xbox.
export function padKind(id = "") {
    return /054c|playstation|dualshock|dualsense|wireless controller/i.test(id) ? "playstation" : "xbox";
}

export class InputHandler {
    constructor() {

        // Último dispositivo que cada jogador apertou: "keyboard", "xbox" ou "playstation".
        this.devices = ["keyboard", "keyboard"];

        this.keys = new Set();

        this.keyboardKeys = new Set();

        this.gamepadControls = [
            { up: "w", down: "s", left: "a", right: "d", dash: " " },
            { up: "arrowup", down: "arrowdown", left: "arrowleft", right: "arrowright", dash: "enter" }
        ];
        this.dashButtons = [0, 5];

        this.deadZone = 0.35;

        window.addEventListener("keydown", (e) => {
            this.keyboardKeys.add(e.key.toLowerCase());
            this.keyboardKeys.add(e.code.toLowerCase());

            const k = e.key.toLowerCase();
            KEYBOARD_OWNER.forEach((keys, i) => { if (keys.has(k) || keys.has(e.code.toLowerCase())) this.devices[i] = "keyboard"; });
            if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) {
                e.preventDefault();
            }
        });

        window.addEventListener("keyup", (e) => {
            this.keyboardKeys.delete(e.key.toLowerCase());
            this.keyboardKeys.delete(e.code.toLowerCase());
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
            this.notePadActivity(i, pad);
            if (this.isButtonPressed(pad, 2)) this.keys.add(i === 0 ? "e" : "shiftright");

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
            if (this.dashButtons.some(b => this.isButtonPressed(pad, b))) this.keys.add(map.dash);
        }
    }

    // Qualquer botão ou analógico passado da zona morta troca o ícone daquele jogador para o do controle.
    notePadActivity(index, pad) {
        const active = (pad.buttons || []).some((_, b) => this.isButtonPressed(pad, b))
            || (pad.axes || []).slice(0, 2).some(v => Math.abs(v) > this.deadZone);
        if (active) this.devices[index] = padKind(pad.id);
    }

    deviceFor(index) {
        return this.devices[index] ?? "keyboard";
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
