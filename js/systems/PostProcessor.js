/**
 * PostProcessor — efeitos de pós-processamento desenhados em coordenadas de
 * TELA (depois do renderer.endFrame(), que já restaurou o transform da câmera).
 *
 * Aplica, nesta ordem:
 *   1) ILUMINAÇÃO: a masmorra fica mal iluminada (escurecida por um ambiente
 *      sombrio) e cada jogador carrega um halo de luz ao redor. Isso é feito
 *      com um "mapa de luz" num canvas offscreen: começa escuro e abrimos
 *      gradientes radiais claros nas luzes; o mapa é composto sobre a cena em
 *      "multiply" (ambiente escurece, centros das luzes preservam a cena).
 *      As luzes tremulam de leve (flicker de tocha).
 *   2) VINHETA: escurecimento radial das bordas da tela, clima claustrofóbico.
 *
 * O Game registra as luzes a cada frame (em coordenadas de TELA) via addLight()
 * e chama draw() depois de desenhar a cena.
 */
import { POST_PROCESSING } from '../config/GameConfig.js';

export class PostProcessor {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {CanvasRenderingContext2D} ctx
     * @param {object} [opts] overrides pontuais sobre POST_PROCESSING do config:
     *                 { enabled, vignette:{...}, lighting:{...} }
     */
    constructor(canvas, ctx, opts = {}) {
        this.canvas = canvas;
        this.ctx = ctx;

        // Defaults vêm do GameConfig; opts sobrescreve campo a campo.
        this.enabled = opts.enabled ?? POST_PROCESSING.enabled;

        // ---- Vinheta ----
        this.vignette = { ...POST_PROCESSING.vignette, ...(opts.vignette || {}) };
        this._vgrad = null;
        this._vW = -1; this._vH = -1;

        // ---- Iluminação ----
        this.lighting = { ...POST_PROCESSING.lighting, ...(opts.lighting || {}) };
        // Buffer offscreen do mapa de luz (tamanho da viewport).
        this._lightCanvas = document.createElement("canvas");
        this._lightCtx = this._lightCanvas.getContext("2d");

        // Buffer de BAIXA resolução: desenhamos a elipse de luz aqui (um "pixel"
        // de arte = 1 pixel deste buffer) e escalamos para o mapa com
        // nearest-neighbor, dando o serrilhado pixelado chunky.
        this._loCanvas = document.createElement("canvas");
        this._loCtx = this._loCanvas.getContext("2d");

        // Luzes do frame atual (resetadas a cada draw). Cada luz:
        // { x, y, radius } em coordenadas de TELA.
        this._lights = [];

        // Fase do flicker (avança por frame).
        this._flicker = 0;
    }

    // Registra uma luz para ESTE frame (coordenadas de tela).
    /**
     * Registra uma luz para ESTE frame (coordenadas de tela).
     * @param {number} x,y    centro na tela
     * @param {number} radius raio horizontal da luz (px de tela)
     * @param {number} [pixel=6] tamanho do "pixel" de arte na tela (para o
     *                 serrilhado chunky da elipse)
     * @param {number} [flatten] achatamento vertical (raioY = radius*flatten);
     *                 default = lighting.flatten do config
     * @param {object} [profile] perfil próprio desta luz (sobrescreve o global):
     *                 { color, falloff, flickerSpeed, flickerBase, flickerSine,
     *                   flickerNoise }. Útil p/ tochas terem cor/flicker próprios.
     */
    addLight(x, y, radius, pixel = 6, flatten = this.lighting.flatten, profile = null) {
        this._lights.push({ kind: "ellipse", x, y, radius, pixel, flatten, profile });
    }

    /**
     * Registra um SPOT/CONE de luz para ESTE frame (coordenadas de tela). O
     * feixe nasce ESTREITO no apex (x,y) e se abre na direção (dirX,dirY),
     * clareando mais perto do apex e esmaecendo ao longo do comprimento e nas
     * bordas laterais — como a luz saindo de uma porta para dentro da sala.
     * @param {number} x,y        apex do cone (origem do feixe) na tela
     * @param {number} dirX,dirY  direção para onde o feixe aponta (será normalizada)
     * @param {number} length     comprimento do feixe (px de tela)
     * @param {number} spread     meia-abertura do cone em radianos (0..~1.2)
     * @param {number} [pixel=6]  tamanho do "pixel" de arte (serrilhado chunky)
     * @param {object} [profile]  { color, falloff, flicker* } próprio do feixe
     */
    addSpotLight(x, y, dirX, dirY, length, spread, pixel = 6, profile = null, startDist = 0, alphaScale = 1, startFade = 0) {
        const len = Math.hypot(dirX, dirY) || 1;
        this._lights.push({
            kind: "spot", x, y,
            dx: dirX / len, dy: dirY / len,
            length, spread, pixel, profile,
            startDist, // distância do apex onde o feixe começa (recorta a ponta)
            alphaScale, // multiplicador de OPACIDADE (p/ desvanecer sem encolher)
            startFade  // fração do comprimento usada p/ a subida suave na boca
        });
    }

    _ensureSize() {
        const w = this.canvas.width, h = this.canvas.height;
        if (this._lightCanvas.width !== w || this._lightCanvas.height !== h) {
            this._lightCanvas.width = w;
            this._lightCanvas.height = h;
        }
        this._lightCtx.imageSmoothingEnabled = false;
    }

    // Monta o mapa de luz e o compõe sobre a cena em "multiply".
    _drawLighting() {
        const w = this.canvas.width, h = this.canvas.height;
        this._ensureSize();
        const lctx = this._lightCtx;

        // Fundo = ambiente escuro (a parte "mal iluminada" da masmorra).
        lctx.globalCompositeOperation = "source-over";
        lctx.fillStyle = `rgb(${this.lighting.ambient})`;
        lctx.fillRect(0, 0, w, h);

        // Fase única do flicker, avança por frame. Cada luz aplica os próprios
        // coeficientes (base/amplitude/ruído) sobre esta fase.
        this._flicker += this.lighting.flickerSpeed;

        // Abre as luzes de forma ADITIVA (luzes se somam onde se sobrepõem).
        lctx.globalCompositeOperation = "lighter";
        for (const light of this._lights) {
            // Perfil da luz: o próprio (tochas) ou o global (jogadores).
            const p = light.profile || this.lighting;
            // Fase deslocada por luz (via posição) para as tochas não pulsarem
            // todas em sincronia — dá um crepitar mais natural.
            const phase = this._flicker + (light.x + light.y) * 0.01;
            const flick = (p.flickerBase ?? this.lighting.flickerBase)
                + Math.sin(phase) * (p.flickerSine ?? this.lighting.flickerSine)
                + (Math.random() - 0.5) * (p.flickerNoise ?? this.lighting.flickerNoise);
            const color = p.color ?? this.lighting.lightColor;
            if (light.kind === "spot") {
                this._drawPixelSpotLight(light, flick, color);
            } else {
                this._drawPixelEllipseLight(light, flick, color);
            }
        }

        // Compõe o mapa de luz sobre a cena: multiply escurece onde o mapa é
        // escuro (ambiente) e preserva/clareia onde há luz.
        const prevOp = this.ctx.globalCompositeOperation;
        this.ctx.globalCompositeOperation = "multiply";
        this.ctx.drawImage(this._lightCanvas, 0, 0);
        this.ctx.globalCompositeOperation = prevOp;
    }

    /**
     * Desenha UMA luz como ELIPSE PIXELADA no mapa de luz (lctx), de forma
     * aditiva. A elipse (mais larga que alta) é desenhada num buffer de baixa
     * resolução — 1 px do buffer = 1 "pixel" de arte — e depois escalada de
     * volta com nearest-neighbor, convertendo o gradiente suave em DEGRAUS
     * pixelados chunky, coerentes com o resto da pixel art.
     */
    _drawPixelEllipseLight(light, flick, lc) {
        const px = Math.max(2, light.pixel | 0);
        const rx = Math.max(1, light.radius * flick);      // raio horizontal (tela)
        const ry = Math.max(1, rx * (light.flatten ?? this.lighting.flatten)); // raio vertical

        // Dimensões em BAIXA resolução (nº de "pixels de arte" que cobrem a luz).
        const loW = Math.max(1, Math.ceil((rx * 2) / px));
        const loH = Math.max(1, Math.ceil((ry * 2) / px));

        if (this._loCanvas.width < loW || this._loCanvas.height < loH) {
            this._loCanvas.width = Math.max(this._loCanvas.width, loW);
            this._loCanvas.height = Math.max(this._loCanvas.height, loH);
        }
        const loCtx = this._loCtx;
        loCtx.imageSmoothingEnabled = false;
        loCtx.clearRect(0, 0, loW, loH);

        // Gradiente radial no espaço lo-res. Como a elipse é mais larga que
        // alta, escalamos o eixo Y antes de desenhar um gradiente circular.
        const cxLo = loW / 2, cyLo = loH / 2;
        const rLo = loW / 2;
        loCtx.save();
        loCtx.translate(cxLo, cyLo);
        loCtx.scale(1, loH / loW); // circulo -> elipse achatada
        const g = loCtx.createRadialGradient(0, 0, 0, 0, 0, rLo);
        // Perfil radial: o próprio da luz (tochas) ou o global (jogadores).
        // Centro forte caindo até transparente; os stops viram degraus visíveis
        // depois do upscale nearest-neighbor.
        const falloff = (light.profile && light.profile.falloff) || this.lighting.falloff;
        for (const stop of falloff) {
            g.addColorStop(stop.offset, `rgba(${lc}, ${stop.alpha})`);
        }
        loCtx.fillStyle = g;
        loCtx.beginPath();
        loCtx.arc(0, 0, rLo, 0, Math.PI * 2);
        loCtx.fill();
        loCtx.restore();

        // Upscale com nearest-neighbor: o buffer pequeno vira a elipse chunky.
        // Alinhamos o destino à grade de 'px' para os blocos ficarem retos.
        const lctx = this._lightCtx;
        lctx.imageSmoothingEnabled = false;
        const dw = loW * px, dh = loH * px;
        const dx = Math.round((light.x - dw / 2) / px) * px;
        const dy = Math.round((light.y - dh / 2) / px) * px;
        lctx.drawImage(this._loCanvas, 0, 0, loW, loH, dx, dy, dw, dh);
    }

    /**
     * Desenha UMA luz como FEIXE PIXELADO no mapa de luz (lctx), de forma
     * aditiva. A geometria é um cone a partir de um apex, mas a parte ANTES de
     * 'startDist' é recortada: o feixe nasce com uma BOCA RETA larga nesse plano
     * (não um bico pontudo) e se projeta até o fim. O decaimento vai da boca
     * (forte) ao fim (transparente); a abertura é um setor (arc) e as bordas
     * laterais são suavizadas por um leve blur no buffer lo-res (que o upscale
     * nearest-neighbor converte em degraus chunky).
     */
    _drawPixelSpotLight(light, flick, lc) {
        const px = Math.max(2, light.pixel | 0);
        const len = Math.max(1, light.length * flick);       // comprimento total (apex->fim)
        const spread = Math.max(0.05, light.spread);         // meia-abertura (rad)
        // Distância do apex onde o feixe COMEÇA a aparecer (recorta a ponta).
        // Clampada para não passar do fim.
        const start = Math.max(0, Math.min(light.startDist || 0, len - 1));

        // O buffer lo-res cobre só a parte VISÍVEL do feixe: de X=start até
        // X=len (a ponta atrás de 'start' é descartada). A abertura total no
        // fim é ±len*sin(spread); usamos isso como meia-altura do buffer.
        const halfH = len * Math.sin(spread);
        const pad = px * 2;
        const visLen = len - start;                          // extensão visível em X
        const loW = Math.max(1, Math.ceil((visLen + pad * 2) / px));
        const loH = Math.max(1, Math.ceil((halfH * 2 + pad * 2) / px));

        if (this._loCanvas.width < loW || this._loCanvas.height < loH) {
            this._loCanvas.width = Math.max(this._loCanvas.width, loW);
            this._loCanvas.height = Math.max(this._loCanvas.height, loH);
        }
        const loCtx = this._loCtx;
        loCtx.imageSmoothingEnabled = false;
        loCtx.clearRect(0, 0, loW, loH);

        // Escala tela->lo-res.
        const sc = 1 / px;
        const lenLo = len * sc;
        const startLo = start * sc;
        // O apex (X=0 do cone) fica à ESQUERDA do buffer: o buffer começa em
        // X=start, então o apex está em -start a partir da borda (+pad de folga).
        const originXLo = pad * sc;           // X lo-res da borda do buffer == X=start do cone
        const apexYLo = loH / 2;              // eixo central do feixe

        loCtx.save();
        loCtx.filter = "blur(0.8px)";         // suaviza as bordas laterais
        // Leva a origem para o APEX do cone (X=0): recua 'start' a partir da borda.
        loCtx.translate(originXLo - startLo, apexYLo);

        // Recorta tudo que está ANTES do plano de início (X < start): some a
        // ponta e o feixe passa a nascer com uma BOCA RETA larga em X=start.
        loCtx.beginPath();
        loCtx.rect(startLo, -halfH * sc, lenLo - startLo, halfH * 2 * sc);
        loCtx.clip();

        // Decaimento ao longo do feixe. createRadialGradient de start..len
        // mapeia o perfil a esse trecho (offset 0 = boca; offset 1 = fim).
        const g = loCtx.createRadialGradient(0, 0, startLo, 0, 0, lenLo);
        const falloff = (light.profile && light.profile.falloff) || this.lighting.falloff;
        const aScale = light.alphaScale ?? 1;   // opacidade global (desvanecer)

        // RAMP DE ENTRADA: em vez de a boca já começar no pico (o que cria uma
        // borda dura no plano da porta), a intensidade SOBE de 0 até o pico ao
        // longo da fração 'startFade' logo após a porta. Isso disfarça o corte e
        // dá a impressão de que a luz vem do outro lado, atravessando o vão.
        const fadeFrac = Math.min(0.9, Math.max(0, light.startFade ?? 0));
        const peak = falloff.length ? falloff[0].alpha : 0.9;
        if (fadeFrac > 0.001) {
            // Subida suave (ease-in) de 0 ao pico dentro de [0, fadeFrac].
            const RAMP_STEPS = 4;
            for (let i = 0; i <= RAMP_STEPS; i++) {
                const u = i / RAMP_STEPS;                 // 0..1 ao longo do ramp
                const off = u * fadeFrac;                 // offset no gradiente
                const a = peak * (u * u) * aScale;        // ease-in quadrático
                g.addColorStop(off, `rgba(${lc}, ${a})`);
            }
            // Restante do perfil comprimido em [fadeFrac, 1].
            for (const stop of falloff) {
                const off = fadeFrac + stop.offset * (1 - fadeFrac);
                g.addColorStop(off, `rgba(${lc}, ${stop.alpha * aScale})`);
            }
        } else {
            for (const stop of falloff) {
                g.addColorStop(stop.offset, `rgba(${lc}, ${stop.alpha * aScale})`);
            }
        }
        loCtx.fillStyle = g;
        loCtx.beginPath();
        loCtx.moveTo(0, 0);
        loCtx.arc(0, 0, lenLo, -spread, spread);
        loCtx.closePath();
        loCtx.fill();
        loCtx.restore();

        // Compõe no mapa de luz, rotacionando o buffer para a direção real. O
        // ponto do buffer que corresponde ao plano de início (X=start, no eixo)
        // deve cair exatamente no ponto real 'start' à frente do apex.
        const lctx = this._lightCtx;
        lctx.imageSmoothingEnabled = false;
        const ang = Math.atan2(light.dy, light.dx);
        lctx.save();
        // Posição real da BOCA do feixe (apex + direção * start).
        const mouthX = light.x + light.dx * start;
        const mouthY = light.y + light.dy * start;
        lctx.translate(mouthX, mouthY);
        lctx.rotate(ang);
        // No buffer, a boca está em (originXLo, apexYLo) lo-res == (pad, loH*px/2) tela.
        lctx.drawImage(
            this._loCanvas, 0, 0, loW, loH,
            -pad, -(loH * px) / 2, loW * px, loH * px
        );
        lctx.restore();
    }

    _buildVignette() {
        const w = this.canvas.width, h = this.canvas.height;
        const cx = w / 2, cy = h / 2;
        const outer = Math.hypot(cx, cy);
        const inner = outer * this.vignette.innerRadius;
        const col = this.vignette.color, s = this.vignette.strength;

        const g = this.ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
        g.addColorStop(0, `rgba(${col}, 0)`);
        g.addColorStop(this.vignette.midStop, `rgba(${col}, ${s * this.vignette.midAlphaFactor})`);
        g.addColorStop(1, `rgba(${col}, ${s})`);
        this._vgrad = g;
        this._vW = w; this._vH = h;
    }

    _drawVignette() {
        const { ctx, canvas } = this;
        if (!this._vgrad || this._vW !== canvas.width || this._vH !== canvas.height) {
            this._buildVignette();
        }
        const prevOp = ctx.globalCompositeOperation;
        ctx.globalCompositeOperation = "multiply";
        ctx.fillStyle = this._vgrad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = prevOp;
    }

    /**
     * Desenha o pós-processamento (iluminação + vinheta) em espaço de TELA,
     * antes dos overlays de UI/transição. Consome e limpa as luzes do frame.
     */
    draw() {
        if (this.enabled) {
            if (this.lighting.enabled) this._drawLighting();
            if (this.vignette.enabled) this._drawVignette();
        }
        // Luzes valem por frame: limpa para o próximo.
        this._lights.length = 0;
    }
}
