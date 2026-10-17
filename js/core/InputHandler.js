export class InputHandler {
    constructor() {
        // Teclas "virtuais" ativas no frame. Inclui tanto teclas físicas
        // (teclado) quanto as sintetizadas a partir dos gamepads.
        this.keys = new Set();

        // Teclas vindas do teclado (persistem entre frames via eventos).
        // Mantidas à parte das do gamepad para que o polling do gamepad possa
        // ser recalculado a cada frame sem apagar o estado do teclado.
        this.keyboardKeys = new Set();

        // Mapeamento gamepad -> player.
        // Cada player tem seu conjunto de "controls" (ver EntityConfig):
        //   P1 (índice 0): w / s / a / d
        //   P2 (índice 1): arrowup / arrowdown / arrowleft / arrowright
        // Gamepad 0 controla P1, gamepad 1 controla P2.
        this.gamepadControls = [
            { up: "w", down: "s", left: "a", right: "d" },
            { up: "arrowup", down: "arrowdown", left: "arrowleft", right: "arrowright" }
        ];

        // Zona morta do analógico (evita drift do stick parado).
        this.deadZone = 0.35;

        window.addEventListener("keydown", (e) => {
            this.keyboardKeys.add(e.key.toLowerCase());

            // Evita que as setas rolem a página durante o jogo
            const k = e.key.toLowerCase();
            if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) {
                e.preventDefault();
            }
        });

        window.addEventListener("keyup", (e) => {
            this.keyboardKeys.delete(e.key.toLowerCase());
        });

        // Limpa o estado se a janela perder o foco (evita teclas "presas")
        window.addEventListener("blur", () => this.keyboardKeys.clear());

        // Log amigável de conexão/desconexão (ajuda a depurar controles).
        if (typeof window !== "undefined") {
            window.addEventListener("gamepadconnected", (e) => {
                console.log(`Controle conectado [${e.gamepad.index}]: ${e.gamepad.id}`);
            });
            window.addEventListener("gamepaddisconnected", (e) => {
                console.log(`Controle desconectado [${e.gamepad.index}]: ${e.gamepad.id}`);
            });
        }
    }

    // Lê os gamepads conectados e traduz sticks/d-pad em teclas virtuais.
    // Deve ser chamado uma vez por frame (antes de ler isDown no update).
    // Xbox e PlayStation usam o "standard mapping" do navegador, então os
    // mesmos índices de eixo/botão servem para ambos.
    pollGamepads() {
        // Começa do estado do teclado e sobrepõe o do gamepad por cima.
        this.keys = new Set(this.keyboardKeys);

        if (typeof navigator === "undefined" || !navigator.getGamepads) return;

        const pads = navigator.getGamepads();
        if (!pads) return;

        for (let i = 0; i < this.gamepadControls.length; i++) {
            const pad = pads[i];
            if (!pad) continue;

            const map = this.gamepadControls[i];

            // --- Analógico esquerdo (eixos 0 = X, 1 = Y no standard mapping) ---
            const ax = pad.axes[0] || 0;
            const ay = pad.axes[1] || 0;
            if (ax < -this.deadZone) this.keys.add(map.left);
            if (ax > this.deadZone) this.keys.add(map.right);
            if (ay < -this.deadZone) this.keys.add(map.up);
            if (ay > this.deadZone) this.keys.add(map.down);

            // --- D-pad (botões 12=cima, 13=baixo, 14=esq, 15=dir) ---
            if (this.isButtonPressed(pad, 12)) this.keys.add(map.up);
            if (this.isButtonPressed(pad, 13)) this.keys.add(map.down);
            if (this.isButtonPressed(pad, 14)) this.keys.add(map.left);
            if (this.isButtonPressed(pad, 15)) this.keys.add(map.right);
        }
    }

    // Botão pressionado de forma segura (alguns navegadores retornam número).
    isButtonPressed(pad, index) {
        const btn = pad.buttons[index];
        if (!btn) return false;
        return typeof btn === "object" ? btn.pressed : btn > 0.5;
    }

    isDown(key) {
        return this.keys.has(key.toLowerCase());
    }
}
