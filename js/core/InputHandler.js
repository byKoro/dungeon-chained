export class InputHandler {
    constructor() {
        this.keys = new Set();

        window.addEventListener("keydown", (e) => {
            this.keys.add(e.key.toLowerCase());

            // Evita que as setas rolem a página durante o jogo
            const k = e.key.toLowerCase();
            if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) {
                e.preventDefault();
            }
        });

        window.addEventListener("keyup", (e) => {
            this.keys.delete(e.key.toLowerCase());
        });

        // Limpa o estado se a janela perder o foco (evita teclas "presas")
        window.addEventListener("blur", () => this.keys.clear());
    }

    isDown(key) {
        return this.keys.has(key.toLowerCase());
    }
}
