/**
 * FlashParticle — estilhaço de FLASH branco (ruptura da corrente/serra).
 *
 * Bloco branco/claro lançado a partir do ponto de ruptura. Voa, desacelera e
 * some em poucos quadros, com fade ease-out e um GLOW aditivo SUTIL. Versão
 * contida (pouco exagero). Puramente visual (não deixa marca).
 *
 * Desempenho: o glow NÃO usa shadowBlur em tempo real (caríssimo no Canvas 2D
 * quando aplicado por partícula). Ele é pré-renderizado UMA vez num sprite
 * pequeno (cache por cor/tamanho/blur) e depois só carimbado com drawImage.
 */

const GLOW_COLOR = "#eaf2ff";
// Blur máximo em px de TELA (equivale ao antigo shadowBlur = 5 * t, que o
// Canvas aplica em espaço de tela, ignorando o zoom da câmera).
const GLOW_BLUR_SCREEN = 5;
// Quantização do blur (px de mundo): limita a quantidade de sprites em cache.
const BLUR_STEP = 0.5;
const BLUR_MAX = 8;

// Cache de sprites de glow: chave "cor|tamanho|blur" -> { canvas, pad }.
const _glowCache = new Map();

function getGlowSprite(color, size, blur) {
    const key = color + "|" + size + "|" + blur;
    let sprite = _glowCache.get(key);
    if (sprite) return sprite;

    // Margem para o halo não ser cortado pela borda do canvas.
    const pad = Math.ceil(blur * 1.5) + 1;
    const dim = size + pad * 2;
    const canvas = document.createElement("canvas");
    canvas.width = dim;
    canvas.height = dim;
    const g = canvas.getContext("2d");
    g.shadowColor = GLOW_COLOR;
    g.shadowBlur = blur;
    g.fillStyle = color;
    g.fillRect(pad, pad, size, size);

    sprite = { canvas, pad };
    _glowCache.set(key, sprite);
    return sprite;
}

export class FlashParticle {
    constructor(x, y, power = 1) {
        this.x = x;
        this.y = y;

        const angle = Math.random() * Math.PI * 2;
        // Velocidade moderada (menos intensa que o burst exagerado anterior).
        const speed = (1.5 + Math.random() * 3) * power;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.friction = 0.87;

        // Blocos pequenos (2..4 px de arte).
        this.size = 2 + ((Math.random() * 3) | 0);

        this.life = 7 + ((Math.random() * 6) | 0);
        this.maxLife = this.life;

        // Branco / branco-azulado claro.
        const tones = ["#ffffff", "#fdfdff", "#eaf2ff"];
        this.color = tones[(Math.random() * tones.length) | 0];
    }

    get done() {
        return this.life <= 0;
    }

    update() {
        this.vx *= this.friction;
        this.vy *= this.friction;
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
    }

    /**
     * Desenha o estilhaço. O CHAMADOR (ParticleSystem) liga o modo "lighter"
     * uma vez para a camada inteira e restaura o estado no fim; aqui só se
     * ajusta globalAlpha/fillStyle.
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} zoom escala atual do ctx (para o blur bater em px de tela)
     */
    draw(ctx, zoom = 1) {
        const t = this.life / this.maxLife; // 1 -> 0
        const alpha = Math.max(0, t) * 0.9;
        if (alpha <= 0) return;

        const s = Math.max(1, Math.round(this.size * (0.5 + t * 0.5)));
        const px = Math.round(this.x - s / 2);
        const py = Math.round(this.y - s / 2);
        ctx.globalAlpha = alpha;

        // Blur em px de mundo: converte o alvo em px de tela pelo zoom.
        const raw = (GLOW_BLUR_SCREEN * t) / (zoom > 0 ? zoom : 1);
        const blur = Math.min(BLUR_MAX, Math.round(raw / BLUR_STEP) * BLUR_STEP);
        if (blur <= 0) {
            ctx.fillStyle = this.color;
            ctx.fillRect(px, py, s, s);
            return;
        }
        // Glow aditivo SUTIL: sprite pré-renderizado (bloco + halo).
        const sprite = getGlowSprite(this.color, s, blur);
        ctx.drawImage(sprite.canvas, px - sprite.pad, py - sprite.pad);
    }
}
