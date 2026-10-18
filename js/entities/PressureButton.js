import { HAZARDS } from '../config/GameConfig.js';

/**
 * PressureButton — botão de piso que fica "pressionado" enquanto um player
 * estiver em cima. Usado no desafio co-op: os DOIS botões precisam estar
 * pressionados ao mesmo tempo para abrir a saída.
 *
 * Sprite: assets/buttom/buttom_16.png — folha 32x16 com 2 frames de 16x16
 * (mesma resolução de arte dos tiles, desenhada a 64px = 1 tile):
 *   frame 0 (esquerda) = botão LEVANTADO, frame 1 (direita) = APERTADO.
 * Se o sprite não carregar, desenha a forma geométrica antiga (fallback).
 *
 * Game feel:
 *  - A detecção usa os PÉS do jogador (não o centro do sprite), então o botão
 *    só afunda quando ele visualmente pisa na tampa.
 *  - ASSISTÊNCIA leve: perto do botão o jogador é puxado suavemente para o
 *    centro (forte quando está parado, fraca correndo, nula indo embora).
 *  - SQUASH & STRETCH por mola amortecida: achata ao apertar e estica ao
 *    soltar, com overshoot, voltando ao repouso.
 *  - ONDA de poeira/pixels saindo da base no clique + brilho da tampa
 *    (a luz em si é registrada pelo LightingRenderer via `glow`/`flash`).
 *  - Eventos `justPressed`/`justReleased` (1 frame) para o Game tocar som,
 *    tremer a câmera e soltar partículas.
 */
const FRAME_UP = 0;
const FRAME_DOWN = 1;

// Geometria do sprite em px de MUNDO (frame 16px desenhado a 64px; 1 px de
// arte = 4 px). Relativo ao centro (x, y) do tile do botão.
const ART_PX = 4;
const BASE_BOTTOM = 24;   // última linha opaca do frame (linha 13) -> y + 24
const BASE_HALF_W = 32;   // meia largura da base (linha mais larga)

export class PressureButton {
    /**
     * @param {number} x
     * @param {number} y
     * @param {object} opts { cfg, sprite }
     */
    constructor(x, y, opts = {}) {
        this.x = x;
        this.y = y;
        this.hitRadius = 0;
        this.cfg = opts.cfg || HAZARDS.button;
        this.sprite = opts.sprite || null;

        this.pressed = false;
        this.justPressed = false;   // true só no frame em que afundou
        this.justReleased = false;  // true só no frame em que soltou
        this.press = 0;             // 0..1 animação de afundar (fallback)
        this.pulse = 0;

        // Mola do squash & stretch: desvio de escala vertical (+ achata,
        // - estica) e sua velocidade.
        this.squash = 0;
        this.squashV = 0;

        this.glow = 0;   // 0..1 brilho contínuo enquanto pressionado (eased)
        this.flash = 0;  // 0..1 pico de luz no clique (decai rápido)
        this.ringT = 0;  // 0..1 onda de pixels saindo da base (1 = recém-solta)
    }

    // Centro da TAMPA em mundo: alvo dos pés do jogador.
    get capX() { return this.x; }
    get capY() { return this.y + (this.cfg.capOffsetY ?? -4); }

    // Pés do jogador em mundo (o centro do player fica acima dos pés).
    _feet(p) {
        return { x: p.x, y: p.y + (this.cfg.footOffset ?? 15) };
    }

    // Distância "elíptica" dos pés do jogador até o centro da tampa: o eixo
    // vertical pesa mais (a tampa vista em perspectiva é mais larga que alta),
    // então só conta como pisando quem está de fato sobre a tampa.
    _feetDist(p) {
        const f = this._feet(p);
        const ySquash = this.cfg.pressYScale ?? 1.5;
        return Math.hypot(f.x - this.capX, (f.y - this.capY) * ySquash);
    }

    // true se (x, y) cai sobre o botão (para bloquear pegadas/carimbos).
    covers(x, y) {
        const dx = (x - this.x) / (BASE_HALF_W - 2);
        const dy = (y - (this.y + 2)) / 22;
        return dx * dx + dy * dy <= 1;
    }

    // Atualiza estado, assistência e animações a partir dos players.
    update(players) {
        const cfg = this.cfg;
        const live = players.filter(p => !p.falling && p.lives > 0);

        // ASSISTÊNCIA: puxa os pés de cada jogador próximo para o centro.
        for (const p of live) this._assist(p);

        const was = this.pressed;
        this.pressed = live.some(p => this._feetDist(p) < cfg.pressRadius);
        this.justPressed = this.pressed && !was;
        this.justReleased = !this.pressed && was;

        if (this.justPressed) {
            // Achata na hora (o impacto do pé) e solta a mola.
            this.squash = cfg.pressSquash ?? 0.24;
            this.squashV = 0;
            this.flash = 1;
            this.ringT = 1;
        } else if (this.justReleased) {
            // Ao soltar, a tampa "pula" de volta: estica um pouco.
            this.squash = -(cfg.releaseStretch ?? 0.14);
            this.squashV = 0;
        }

        // Mola amortecida (overshoot e assenta em 0).
        const k = cfg.springK ?? 0.28, d = cfg.springDamp ?? 0.34;
        this.squashV += -k * this.squash - d * this.squashV;
        this.squash += this.squashV;
        if (Math.abs(this.squash) < 0.002 && Math.abs(this.squashV) < 0.002) {
            this.squash = 0; this.squashV = 0;
        }

        // Brilho: sobe rápido ao apertar, desce suave ao soltar.
        const gTarget = this.pressed ? 1 : 0;
        this.glow += (gTarget - this.glow) * (this.pressed ? 0.25 : 0.08);
        this.flash = Math.max(0, this.flash - 0.06);
        this.ringT = Math.max(0, this.ringT - 0.07);

        const target = this.pressed ? 1 : 0;
        this.press += (target - this.press) * 0.3;
        this.pulse += cfg.pulseSpeed;
    }

    // Assistência de posicionamento: dentro de `assistRadius`, desloca o
    // jogador uma fração da distância até o centro. A força cai com a
    // distância, é maior quando ele está parado e some se o input aponta para
    // FORA do botão (quem quer sair não fica preso).
    _assist(p) {
        const cfg = this.cfg;
        const R = cfg.assistRadius ?? 46;
        const f = this._feet(p);
        const dx = this.capX - f.x;
        const dy = this.capY - f.y;
        const dist = Math.hypot(dx, dy);
        if (dist >= R || dist < 0.5) return;

        // Proximidade: 0 na borda do raio -> 1 no centro (ease-out).
        const near = 1 - dist / R;
        let k = (cfg.assistStrength ?? 0.12) * (0.35 + 0.65 * near);

        // Intenção do jogador: alinhado com o centro mantém a força; para
        // fora zera; parado ganha força extra (encaixe suave ao soltar o input).
        const mx = p.moveX ?? 0, my = p.moveY ?? 0;
        const mLen = Math.hypot(mx, my);
        if (mLen > 0) {
            const align = (mx * dx + my * dy) / (mLen * dist); // -1..1
            if (align < -0.2) return;            // saindo: sem assistência
            k *= 0.45 + 0.55 * Math.max(0, align);
        } else {
            k *= 1.4;
        }

        p.x += dx * k;
        p.y += dy * k;
    }

    // Escala atual do squash & stretch (volume aproximadamente conservado).
    _scale() {
        const sy = 1 - this.squash;
        const sx = 1 + this.squash * 0.6;
        return { sx, sy };
    }

    draw(ctx) {
        const img = this.sprite;
        this._drawRing(ctx);
        if (img && img.complete && img.naturalWidth > 0) {
            this._drawSprite(ctx, img);
            return;
        }
        this._drawFallback(ctx);
    }

    // Frame do sprite conforme o estado (levantado / apertado), centrado no
    // tile do botão, com squash & stretch ancorado na BASE (o pé no chão não
    // se move). Pixel art: sem suavização.
    _drawSprite(ctx, img) {
        const fs = this.cfg.frameSize ?? 16;
        const size = this.cfg.drawSize ?? 64;
        const frame = this.pressed ? FRAME_DOWN : FRAME_UP;
        const { sx, sy } = this._scale();
        const baseY = this.y + BASE_BOTTOM;

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.translate(Math.round(this.x), Math.round(baseY));
        ctx.scale(sx, sy);
        ctx.drawImage(img, frame * fs, 0, fs, fs, -size / 2, -size / 2 - BASE_BOTTOM, size, size);

        // Brilho da tampa: leve luz quente aditiva enquanto pressionado (e um
        // pico no clique). Só onde há sprite (source-atop no próprio desenho
        // seria caro; um retângulo na área da tampa basta e é pixelado).
        const lit = Math.min(1, this.glow * 0.18 + this.flash * 0.35);
        if (lit > 0.01) {
            ctx.globalCompositeOperation = "lighter";
            ctx.globalAlpha = lit;
            ctx.fillStyle = "#cf686d";
            // Face da tampa apertada (linhas 5..9, colunas 3..12 do frame).
            ctx.fillRect(-5 * ART_PX, -BASE_BOTTOM - 32 + 6 * ART_PX, 10 * ART_PX, 3 * ART_PX);
        }
        ctx.restore();
    }

    // Onda de pixels saindo da base no clique (anel elíptico pixelado).
    _drawRing(ctx) {
        if (this.ringT <= 0) return;
        const t = 1 - this.ringT;                    // 0 -> 1
        const e = 1 - Math.pow(1 - t, 3);            // ease-out
        const rx = BASE_HALF_W + e * 26;
        const ry = rx * 0.5;
        const cy = this.y + 12;
        const n = 22;
        ctx.save();
        ctx.globalAlpha = this.ringT * 0.7;
        ctx.fillStyle = "#adb2be";
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            const px = Math.round((this.x + Math.cos(a) * rx) / ART_PX) * ART_PX;
            const py = Math.round((cy + Math.sin(a) * ry) / ART_PX) * ART_PX;
            ctx.fillRect(px - ART_PX / 2, py - ART_PX / 2, ART_PX, ART_PX);
        }
        ctx.restore();
    }

    /**
     * Passo de OCLUSÃO (chamado na ordenação por profundidade): se alguma
     * entidade está ATRÁS do botão (acima na tela, pés na altura da tampa) e
     * não está pisando nele, redesenha o botão por cima dos pés dela — a tampa
     * tem altura e não pode parecer um tapete por baixo do personagem.
     * @param {CanvasRenderingContext2D} ctx
     * @param {Array} entities  entidades já desenhadas nesta passada
     */
    drawOcclusion(ctx, entities) {
        if (!this.occludes(entities)) return;
        this.draw(ctx);
    }

    // Chave de profundidade do botão (y equivalente ao de uma entidade).
    get sortY() {
        return this.capY - (this.cfg.footOffset ?? 15) - (this.cfg.pressRadius * 0.5);
    }

    // Há entidade atrás do botão, perto o bastante para a tampa cobrir os pés?
    occludes(entities) {
        for (const e of entities) {
            if (e.y >= this.sortY) continue;                 // está na frente
            if (Math.abs(e.x - this.x) > BASE_HALF_W + 8) continue;
            const feetY = e.y + (this.cfg.footOffset ?? 15);
            if (feetY < this.y - 36) continue;               // longe, acima
            if (e.lives !== undefined && this._feetDist(e) < this.cfg.pressRadius) continue;
            return true;
        }
        return false;
    }

    // Forma geométrica (usada só se o sprite não carregar).
    _drawFallback(ctx) {
        const cfg = this.cfg;
        const R = cfg.radius;

        ctx.save();
        // Sombra/encaixe no chão.
        ctx.fillStyle = cfg.baseColor;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, R, R * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Anel externo.
        ctx.strokeStyle = cfg.ringColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, R, R * 0.6, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Topo do botão (sobe quando solto, afunda quando pressionado).
        const lift = (1 - this.press) * 6;
        const topR = R * 0.62;
        const color = this.pressed ? cfg.pressedColor : cfg.idleColor;
        // leve brilho pulsante quando solto (chama a atenção)
        const glow = this.pressed ? 1 : 0.75 + 0.25 * Math.abs(Math.sin(this.pulse));
        ctx.globalAlpha = glow;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y - lift, topR, topR * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#1b1620";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y - lift, topR, topR * 0.6, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}
