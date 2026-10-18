/**
 * Item de cura deixado por inimigos derrotados.
 *
 * Desenhado em DUAS camadas:
 *   - drawShadow(ctx): sombra no chão, no passe normal do mundo (sob as
 *     entidades).
 *   - drawOverlay(ctx): o coração flutuando + brilho + FEIXE de luz diagonal
 *     varrendo o sprite (mesmo "pega-me" da serra largada). Chamado DEPOIS do
 *     pós-processamento (luz/vinheta), por cima de todos os efeitos, para o
 *     item nunca sumir no escuro, no sangue ou na fumaça.
 * A luz vermelha que ele projeta no chão vem do LightingRenderer (lightInfo()).
 */
export class HeartPickup {
    // Sprite do item (assets/heart/heart_pickup.png, 12x12 — gerado por
    // tools/gen_heart.py). Definido pelo Game ao iniciar.
    static sheet = null;
    // Pixels de MUNDO por pixel de arte = o mesmo do cenário (tile de 64 =
    // 16 px de arte), para os pixels do coração baterem com o resto da cena.
    static PIXEL = 4;
    static ART = 12;

    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 24;
        this.age = 0;
        // Fase própria do feixe: corações vizinhos não brilham em sincronia.
        this.sweepPhase = Math.random() * Math.PI * 2;
    }

    update() {
        this.age++;
        this.sweepPhase += 0.035;
    }

    // Flutuação: senoide lenta (altura em px de mundo) e fator 0..1.
    get _bob() { return Math.sin(this.age * 0.08) * 4; }
    get hover() { return (Math.sin(this.age * 0.08) + 1) / 2; }

    // Dados para a luz de chão (LightingRenderer).
    lightInfo() {
        return { x: this.x, y: this.y, hover: this.hover };
    }

    _ready() {
        const img = HeartPickup.sheet;
        return img && img.complete && img.naturalWidth > 0 ? img : null;
    }

    // Sombra elíptica no chão: encolhe/clareia quando o coração sobe.
    drawShadow(ctx) {
        const size = HeartPickup.ART * HeartPickup.PIXEL;
        const h = this.hover;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 0.4 - h * 0.15);
        ctx.fillStyle = "#000";
        ctx.beginPath();
        const s = 1 - h * 0.2;
        ctx.ellipse(this.x, this.y + size * 0.55, size * 0.36 * s, size * 0.12 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Coração + brilho + feixe diagonal (desenhar após o pós-processamento,
    // com o transform de mundo — ver Renderer.beginOverlayWorld()).
    drawOverlay(ctx) {
        const img = this._ready();
        if (!img) return;
        const A = HeartPickup.ART;
        // Pop ao surgir: assenta de 1.3x para 1x nos primeiros ~0.25s.
        const settle = 1 + Math.max(0, 1 - this.age / 15) * 0.3;
        const size = A * HeartPickup.PIXEL * settle;
        const cx = Math.round(this.x);
        const cy = Math.round(this.y - this._bob);

        const prevSmooth = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = false;

        // 1) Brilho suave atrás (realça o item; respira com a flutuação).
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.16 + this.hover * 0.1;
        ctx.shadowColor = "#ff4d6d";
        ctx.shadowBlur = 14;
        ctx.fillStyle = "#ff4d6d";
        ctx.beginPath();
        ctx.arc(cx, cy, size * 0.32, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 2) O coração.
        ctx.drawImage(img, 0, 0, A, A, cx - size / 2, cy - size / 2, size, size);

        // 3) Feixe de luz diagonal recortado pelo alfa do sprite. Montado na
        //    resolução de ARTE, então a faixa também sai em blocos chunky.
        const beam = this._buildBeam(img);
        if (beam) {
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            ctx.drawImage(beam, cx - size / 2, cy - size / 2, size, size);
            ctx.restore();
        }

        ctx.imageSmoothingEnabled = prevSmooth;
    }

    // Faixa clara diagonal (vai e volta) mascarada pelo sprite, num canvas
    // compartilhado do tamanho da arte (é copiado na hora pelo drawImage).
    _buildBeam(img) {
        const A = HeartPickup.ART;
        if (!HeartPickup._beam) {
            const c = document.createElement("canvas");
            c.width = A; c.height = A;
            HeartPickup._beam = c;
        }
        const bc = HeartPickup._beam;
        const bx = bc.getContext("2d");
        bx.globalCompositeOperation = "source-over";
        bx.clearRect(0, 0, A, A);

        // Pausa entre passadas: a faixa só cruza durante parte do ciclo.
        const p = (Math.sin(this.sweepPhase) + 1) / 2;   // 0..1
        const travel = -A + p * (2.2 * A);
        const grad = bx.createLinearGradient(travel - A * 0.5, travel - A * 0.5, travel + A * 0.5, travel + A * 0.5);
        grad.addColorStop(0.0, "rgba(255,255,255,0)");
        grad.addColorStop(0.4, "rgba(255,255,255,0)");
        grad.addColorStop(0.5, "rgba(255,235,240,0.9)");
        grad.addColorStop(0.6, "rgba(255,255,255,0)");
        grad.addColorStop(1.0, "rgba(255,255,255,0)");
        bx.fillStyle = grad;
        bx.fillRect(0, 0, A, A);

        bx.globalCompositeOperation = "destination-in";
        bx.drawImage(this._mask(img), 0, 0);
        bx.globalCompositeOperation = "source-over";
        return bc;
    }

    // Máscara só com os pixels OPACOS do sprite (sem a sombra projetada
    // semitransparente), para o feixe não clarear a sombra. Montada uma vez.
    _mask(img) {
        if (HeartPickup._maskCanvas) return HeartPickup._maskCanvas;
        const A = HeartPickup.ART;
        const c = document.createElement("canvas");
        c.width = A; c.height = A;
        const g = c.getContext("2d");
        g.drawImage(img, 0, 0, A, A, 0, 0, A, A);
        const data = g.getImageData(0, 0, A, A);
        for (let i = 3; i < data.data.length; i += 4) {
            data.data[i] = data.data[i] === 255 ? 255 : 0;
        }
        g.putImageData(data, 0, 0);
        HeartPickup._maskCanvas = c;
        return c;
    }
}
