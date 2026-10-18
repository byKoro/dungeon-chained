/**
 * FlameParticle — língua de CHAMA GRANDE que SOBE do chão (aparição dos
 * inimigos na intro).
 *
 * Nasce na BASE (os pés do inimigo, no chão), numa coluna estreita, e sobe alto
 * — quase mais alto que o próprio sprite —, com oscilação lateral (a chama
 * "lambe") e afinando conforme sobe/esfria. A cor começa quente/clara (quase
 * branca/amarela) no núcleo e vai esfriando para o âmbar da tocha e, no topo,
 * para um vermelho escuro — igual ao fogo das tochas do cenário. Desenhada com
 * glow aditivo ("lighter") para o brilho somar como fogo real. Puramente
 * visual: não deixa marca no chão.
 */
// 1 "pixel de arte" no mundo = tile de 16px desenhado a 64px (TILE/16 = 4).
// O fogo é desenhado em BLOCOS deste tamanho e alinhado a esta grade, para
// combinar com o pixel art do cenário/sangue (nada de blocos "realistas").
const FLAME_PX = 4;

export class FlameParticle {
    /**
     * @param {number} x origem (centro da base da coluna de fogo)
     * @param {number} y origem (nível do CHÃO / pés do inimigo)
     * @param {[number,number,number]} baseColor cor-base (RGB) da chama (tocha)
     * @param {object} opts
     * @param {number} opts.rise  altura (px) que a chama tende a alcançar
     * @param {number} opts.width largura (px) da base da coluna (dispersão)
     * @param {number} opts.sizeScale escala do tamanho dos blocos de fogo
     */
    constructor(x, y, baseColor = [255, 190, 110], opts = {}) {
        const rise = opts.rise ?? 48;
        const width = opts.width ?? 28;
        const sizeScale = opts.sizeScale ?? 1;

        // Base no CHÃO: dispersão horizontal estreita (coluna) e quase nenhuma
        // dispersão vertical, para o fogo "sair do piso".
        this.x = x + (Math.random() - 0.5) * width;
        this.y = y + (Math.random() - 0.5) * 4;

        // Altura-alvo individual (varia por partícula: chama irregular). A
        // velocidade inicial é derivada da altura desejada considerando o
        // amortecimento (vy *= damping por frame) — línguas mais ambiciosas
        // sobem mais alto.
        const targetRise = rise * (0.55 + Math.random() * 0.6);
        // Com damping ~0.9/frame e ~`life` frames, a soma da subida ≈ v0 * k.
        // Calibramos v0 para a soma bater a altura-alvo (aproximação boa o
        // suficiente para o efeito).
        this.vy = -(targetRise * 0.14);
        this.vx = (Math.random() - 0.5) * 0.9;

        // Oscilação lateral (lambida da chama).
        this.swayPhase = Math.random() * Math.PI * 2;
        this.swaySpeed = 0.16 + Math.random() * 0.14;
        this.swayAmp = 0.5 + Math.random() * 0.9;

        // Tamanho em PIXELS DE ARTE (não em px de tela). Blocos chunky de 2..4
        // pixels de arte (= 8..16px de mundo), coerentes com a grade do sangue
        // e dos tiles. Encolhem ao subir/esfriar (ver draw).
        this.sizeArt = Math.max(1, Math.round((2 + ((Math.random() * 3) | 0)) * sizeScale));

        this.life = 20 + ((Math.random() * 16) | 0);
        this.maxLife = this.life;

        this.base = baseColor;
    }

    get done() {
        return this.life <= 0;
    }

    update() {
        this.swayPhase += this.swaySpeed;
        this.x += this.vx + Math.sin(this.swayPhase) * this.swayAmp;
        this.y += this.vy;
        // Desacelera a subida (a chama perde força e "assenta" no topo).
        this.vy *= 0.9;
        this.vx *= 0.92;
        this.life--;
    }

    // Cor conforme a "temperatura" (t: 1 = recém-nascida/quente, 0 = fria).
    // Quente -> clareia para o branco-amarelo; fria -> escurece para vermelho.
    _colorFor(t) {
        const [r, g, b] = this.base;
        if (t > 0.6) {
            // Núcleo quente: clareia em direção ao branco.
            const k = (t - 0.6) / 0.4; // 0..1
            const rr = Math.round(r + (255 - r) * k);
            const gg = Math.round(g + (255 - g) * k);
            const bb = Math.round(b + (235 - b) * k);
            return `rgb(${rr}, ${gg}, ${bb})`;
        }
        // Esfriando: desce de âmbar para vermelho escuro.
        const k = t / 0.6; // 1 no âmbar -> 0 no vermelho frio
        const rr = Math.round(120 + (r - 120) * k);
        const gg = Math.round(30 + (g - 30) * k);
        const bb = Math.round(20 + (b - 20) * k);
        return `rgb(${rr}, ${gg}, ${bb})`;
    }

    draw(ctx) {
        const t = this.life / this.maxLife; // 1 -> 0
        // Afina conforme sobe/esfria: grande na base (t alto), pequeno no topo.
        // Tamanho em pixels de ARTE, convertido para px de mundo (múltiplo de
        // FLAME_PX) para o bloco ficar chunky, igual ao resto do pixel art.
        const sizeArt = Math.max(1, Math.round(this.sizeArt * (0.4 + t * 0.6)));
        const s = sizeArt * FLAME_PX;
        // Snap da posição à grade de pixels de arte (como o sangue): sem isso,
        // o bloco cai em subpixels e parece "borrado"/realista.
        const px = Math.round(this.x / FLAME_PX) * FLAME_PX;
        const py = Math.round(this.y / FLAME_PX) * FLAME_PX;

        ctx.save();
        // Glow aditivo: o fogo soma luz sobre a cena escura. SEM shadowBlur —
        // o blur deixava o bloco difuso/realista, destoando do pixel art.
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = Math.max(0, t) * 0.85;
        ctx.fillStyle = this._colorFor(t);
        ctx.fillRect(px - s / 2, py - s / 2, s, s);
        ctx.restore();
    }
}
