import { Weapon } from './Weapon.js';

/**
 * SawWeapon — serras giratórias presas à corrente dos jogadores.
 *
 * Sprite: assets/saw/saw.png — grade 4x4 de frames 16x16 (resolução de pixel
 * art nativa do jogo), fundo transparente.
 * UMA única serra (a maior) presa no meio da corrente.
 *   - Linhas 0 e 1: disco de INÉRCIA (limpa e ensanguentada).
 *   - Linhas 2 e 3: disco GIRANDO (limpa e ensanguentada).
 *
 * Ambos os discos ROTACIONAM de fato (ctx.rotate pelo ângulo acumulado
 * `this.rotation`). A escolha do sprite é por VELOCIDADE de giro (`spin`,
 * 0..1): com bastante velocidade usa-se o disco "girando"; ao perder
 * velocidade troca-se para o disco de "inércia", que segue girando pelo
 * ângulo residual até o `spin` chegar a 0 e parar.
 *
 * A serra só ganha giro quando OS DOIS jogadores andam. O `spin` tem INÉRCIA
 * (acelera devagar, desacelera ainda mais devagar). A troca de sprite é um
 * CROSSFADE por alpha na faixa [BLEND_LO, BLEND_HI], sem corte seco. Como game
 * feel, há um squash & stretch (pop de escala) no arranque e um tremor leve
 * enquanto gira — feedback transiente que volta ao repouso.
 */

const SAW_FRAME = { size: 16, cols: 4 };
const ROW_INERTIA_CLEAN = 0;
const ROW_INERTIA_BLOODY = 1;
const ROW_SPIN_CLEAN = 2;
const ROW_SPIN_BLOODY = 3;

// Fatores de ampliação do sprite (diâmetro em px de mundo).
//   serra grande = 4.025x (~64px, +15% sobre os 3.5x), pequena = 2x (32px).
const SAW_DRAW_LARGE = SAW_FRAME.size * 4.025; // ~64
const SAW_DRAW_SMALL = SAW_FRAME.size * 2;     // 32

// Corda montada a partir do sprite trançado tileável (assets/saw/rope.png).
//   LINK_WORLD_H = espessura da corda em px de MUNDO (a escala é derivada
//   disto, mantendo a proporção do sprite).
//   O meio da corda é deslocado por um vetor de ARRASTO (oposto ao movimento),
//   simulando a corda sendo puxada pelo chão. A serra fica ancorada nesse
//   ponto médio deslocado. A textura flui de forma contínua ao longo do arco.
//   16 = 4 px de arte x 4 (mesmo tamanho de pixel do resto do jogo).
const CABLE_LINK_WORLD_H = 16;
const CABLE_DRAG_GAIN = 7;   // quanto a velocidade vira "barriga" de arrasto
const CABLE_DRAG_MAX = 46;   // deslocamento máximo do meio (px de mundo)

// Quantos passos de simulação a serra fica ensanguentada após um acerto.
const BLOOD_DURATION = 90;

// Dinâmica do giro. Lerp assimétrico dá INÉRCIA: acelera devagar ao começar e
// desacelera ainda mais devagar ao parar (a serra não trava de imediato).
const SPIN_ACCEL = 0.045;      // suavidade ao GANHAR giro (começar a rodar)
const SPIN_DECEL = 0.012;      // suavidade ao PERDER giro (parar) — bem lento
// Faixa de transição INÉRCIA <-> GIRANDO por VELOCIDADE de giro. Abaixo de
// BLEND_LO usa o disco de inércia; acima de BLEND_HI, o disco girando; no meio,
// crossfade por alpha. Elevada para que o "girando" só apareça com bastante
// velocidade — ao perder velocidade, volta ao disco de inércia (que segue
// girando até parar).
const BLEND_LO = 0.35;
const BLEND_HI = 0.6;
// Velocidade de ROTAÇÃO do sprite ao girar (rad por passo, no giro máximo).
const SPIN_MAX_ROTATION = 0.45;
// O disco de inércia (linhas 0/1) usa o ÚLTIMO frame da linha como sprite base
// (o giro vem da rotação real, não da troca de frames).
const INERTIA_FRAME = SAW_FRAME.cols - 1; // 3

// Tremor da serra (vibração brusca em px de mundo).
//  - SHAKE_SPIN: vibração constante enquanto gira (não some no giro alto).
//  - SHAKE_TRANSITION: pico EXTRA e brusco durante a transição inércia<->giro.
const SHAKE_SPIN = 4;
const SHAKE_TRANSITION = 3;

export class SawWeapon extends Weapon {
    constructor(sprite = null, cableSprite = null) {
        super("SERRAS", 14);
        this.sprite = sprite;
        this.cableSprite = cableSprite; // segmento tileável da corrente
        this.bloodTimer = 0;
        this.onBlood = false;  // true enquanto o disco está sobre sangue no chão
        this.spin = 0;         // 0 = parada, 1 = girando a toda
        this.rotation = 0;     // ângulo acumulado da rotação real (giro)
        this.wasSpinning = false; // para detectar o instante do arranque
        this.spinKick = 0;     // "pop" de escala ao engatar o giro (decai)
        this.strain = 0;       // tensão da corrente 0..1 (ruptura iminente)
        this.flashPhase = 0;   // fase do piscar branco (avança conforme a tensão)
        this._flashCanvas = null; // offscreen para tingir o sprite de branco
        this.textureOffset = 0;   // deslocamento da textura (fluxo contínuo)
        this.dragX = 0;        // vetor de ARRASTO (oposto ao movimento),
        this.dragY = 0;        // suavizado — curva a corda "sendo puxada".

        // --- Estado de LÂMINA DROPADA (corrente arrebentada) ---
        // Quando a corrente arrebenta, a serra cai no chão e fica FLUTUANDO
        // como um item coletável: bob vertical suave, sombra pulsante embaixo
        // e um feixe de luz diagonal varrendo o sprite (brilho de "pega-me").
        this.dropped = false;  // true enquanto a lâmina está largada no chão
        this.dropX = 0;        // posição travada no chão (centro do sprite)
        this.dropY = 0;
        this.dropPhase = 0;    // fase contínua do bob de flutuação
        this.dropSpin = 0;     // giro residual lento enquanto está no chão
        this.sweepPhase = 0;   // fase do feixe de luz diagonal (varre o sprite)
        this.dropT = 0;        // 0->1 ao surgir (pop de queda) e aterrissar
        this.dropHover = 0;    // 0..1 flutuação atual (modula a luz que emite)
    }

    // Marca a lâmina como dropada numa posição fixa do mundo (chamado quando a
    // corrente arrebenta). Trava a serra ali até ser "recolhida" na reconexão.
    drop(x, y) {
        this.dropped = true;
        this.dropX = x;
        this.dropY = y;
        this.dropPhase = 0;
        this.sweepPhase = 0;
        this.dropT = 0;
        // Herda um pouco do giro atual para desacelerar suave no chão.
        this.dropSpin = this.spin;
    }

    // Recolhe a lâmina (chamado quando os jogadores reconectam a corrente).
    pickup() {
        this.dropped = false;
    }

    // Avança as animações da lâmina dropada (bob, giro residual, feixe de luz).
    // Deve ser chamado uma vez por passo enquanto estiver dropada.
    updateDropped() {
        if (!this.dropped) return;
        this.dropPhase += 0.07;          // flutuação lenta e serena
        this.sweepPhase += 0.03;         // varredura do feixe (bem gradual)
        this.dropSpin *= 0.94;           // giro residual morre devagar
        this.rotation += this.dropSpin * 0.25;
        if (this.dropT < 1) this.dropT = Math.min(1, this.dropT + 0.06); // aterrissa
        this.dropHover = (Math.sin(this.dropPhase) + 1) / 2; // 0..1 p/ modular a luz
    }

    update(p1 = null, p2 = null) {
        // Enquanto está SOBRE sangue, mantém o estado ensanguentado (não deixa
        // o timer expirar). O Game ajusta `onBlood` a cada frame.
        if (this.onBlood) this.bloodTimer = BLOOD_DURATION;
        else if (this.bloodTimer > 0) this.bloodTimer--;

        // LÂMINA DROPADA: largada no chão, ela NÃO responde ao movimento dos
        // jogadores — nada de giro ativo nem arrasto. Toda a animação do estado
        // dropado (bob, feixe de luz e o giro RESIDUAL que morre devagar) é
        // responsabilidade de updateDropped(). Sem este early-return, o giro
        // ativo (que sobe quando os dois andam) faria a lâmina largada girar ao
        // caminhar — justamente o bug reportado.
        if (this.dropped) {
            // Zera o alvo de giro para o spin desaparecer suave (não "segura"
            // velocidade de antes da queda).
            this.spin += (0 - this.spin) * SPIN_DECEL;
            return;
        }

        // Pisca de ruptura iminente: a fase avança mais rápido quanto maior a
        // tensão, então o piscar acelera progressivamente até arrebentar.
        this.flashPhase += 0.15 + this.strain * 0.6;

        // Alvo de giro: a serra só gira quando OS DOIS jogadores andam. Usamos
        // o MENOR dos dois speedMag — se um está parado, o alvo cai para ~0.
        let target = 0;
        if (p1 && p2) {
            const speed = p1.speed || p2.speed || 4.2;
            const mag = Math.min(p1.speedMag ?? 0, p2.speedMag ?? 0);
            target = Math.max(0, Math.min(1, mag / speed));
        }

        // ARRASTO: a corda curva no sentido CONTRÁRIO ao movimento (o meio fica
        // para trás, como se fosse arrastada pelo chão). Usamos a velocidade
        // média dos jogadores, suavizada (inércia), limitada a um máximo.
        if (p1 && p2) {
            const vx = (p1.vx + p2.vx) / 2;
            const vy = (p1.vy + p2.vy) / 2;
            // Alvo = -velocidade escalada; limita o módulo ao máximo de barriga.
            let tx = -vx * CABLE_DRAG_GAIN;
            let ty = -vy * CABLE_DRAG_GAIN;
            const m = Math.hypot(tx, ty);
            if (m > CABLE_DRAG_MAX) { tx = tx / m * CABLE_DRAG_MAX; ty = ty / m * CABLE_DRAG_MAX; }
            this.dragX += (tx - this.dragX) * 0.1;
            this.dragY += (ty - this.dragY) * 0.1;
        } else {
            this.dragX *= 0.9;
            this.dragY *= 0.9;
        }

        // A trama "corre" junto com o giro (corda sendo tracionada).
        this.textureOffset += this.spin * 1.2;
        // Inércia: lerp mais rápido para subir, bem mais lento para descer.
        const lerp = target > this.spin ? SPIN_ACCEL : SPIN_DECEL;
        this.spin += (target - this.spin) * lerp;

        // Rotação real do sprite com easing IN-OUT no giro: começa lento e
        // acelera conforme o `spin` sobe (smoothstep), até transicionar para o
        // modo giratório. Assim o arranque não é brusco.
        const s = Math.max(0, Math.min(1, this.spin));
        const eased = s * s * (3 - 2 * s); // smoothstep
        this.rotation += eased * SPIN_MAX_ROTATION;

        // JUICE: squash & stretch no ARRANQUE. Ao cruzar para o giro, dispara um
        // "pop" de escala que decai sozinho (feedback transiente, volta ao
        // repouso — princípio de game feel).
        const spinningNow = this.spin > BLEND_HI;
        if (spinningNow && !this.wasSpinning) this.spinKick = 1;
        this.wasSpinning = spinningNow;
        if (this.spinKick > 0) this.spinKick = Math.max(0, this.spinKick - 0.08);
    }

    // Chamado pelo CombatSystem quando a serra abate/acerta um inimigo.
    onHit() {
        this.bloodTimer = BLOOD_DURATION;
    }

    // O Game informa, a cada frame, se o disco está sobre sangue no chão.
    // Enquanto estiver, o sprite ensanguentado é MANTIDO (independe do giro).
    setOnBlood(flag) {
        this.onBlood = !!flag;
    }

    // A Chain informa, a cada frame, o nível de tensão (0..1). Dirige o piscar
    // branco progressivo e o tremor extra antes de arrebentar.
    setStrain(level) {
        this.strain = Math.max(0, Math.min(1, level || 0));
    }

    // Velocidade de giro atual (0..1), para o Game modular a tremida de câmera.
    get spinSpeed() {
        return this.spin;
    }

    // true quando a serra está em velocidade ALTA (giro "a toda").
    get isHighSpeed() {
        return this.spin > BLEND_HI;
    }

    // Raio do disco em px de mundo (metade do diâmetro desenhado). Para emitir
    // faíscas na borda.
    get discRadius() {
        return SAW_DRAW_LARGE / 2;
    }

    // Raio SÓLIDO de colisão: 50% do raio do disco (centro da serra). Impede
    // que os jogadores fiquem em cima/atrás do disco.
    get collisionRadius() {
        return this.discRadius * 0.5;
    }

    // true enquanto a serra está suja de sangue (após um acerto recente).
    get isBloody() {
        return this.bloodTimer > 0;
    }

    // Sentido do giro (+1 / -1). A serra única usa dir = -1 (index 0).
    get spinDir() {
        return -1;
    }

    // Ponto na CURVA da corda em t∈[0,1]. Segue a reta p1→p2 e o MEIO é puxado
    // pelo vetor de ARRASTO (this.dragX/Y, oposto ao movimento), simulando a
    // corda sendo arrastada pelo chão. 4*t*(1-t) tem pico 1 no meio (t=0.5).
    cablePoint(p1, p2, t) {
        const bx = p1.x + (p2.x - p1.x) * t;
        const by = p1.y + (p2.y - p1.y) * t;
        const bulge = 4 * t * (1 - t);
        return { x: bx + this.dragX * bulge, y: by + this.dragY * bulge };
    }

    getSawPositions(p1, p2) {
        // Uma única serra (a maior), ANCORADA no meio da curva da corda.
        const mid = this.cablePoint(p1, p2, 0.5);
        return [{ x: mid.x, y: mid.y, radius: 14 }];
    }

    hitsTarget(target, p1, p2) {
        return this.getSawPositions(p1, p2).some(saw =>
            Math.hypot(target.x - saw.x, target.y - saw.y) < saw.radius + (target.hitRadius ?? 0)
        );
    }

    // Corda ligando os jogadores. Desenhada numa camada ao FUNDO (sempre atrás
    // das entidades), separada do disco.
    //
    // O meio da corda é puxado pelo vetor de ARRASTO (oposto ao movimento),
    // simulando ser arrastada pelo chão. A TEXTURA é contínua: amostramos a
    // curva em sub-trechos e mapeamos cada um numa faixa do sprite pelo
    // comprimento de arco (com wrap), sem emendas nem distorção.
    drawChain(ctx, p1, p2) {
        const cable = this.cableSprite;
        const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;

        // Fallback vetorizado (segue a mesma curva) se o sprite não carregou.
        if (!cable || !cable.complete || !cable.naturalWidth) {
            ctx.save();
            ctx.strokeStyle = "#1a1a1e";
            ctx.lineWidth = 4;
            ctx.beginPath();
            const start = this.cablePoint(p1, p2, 0);
            ctx.moveTo(start.x, start.y);
            for (let i = 1; i <= 16; i++) {
                const q = this.cablePoint(p1, p2, i / 16);
                ctx.lineTo(q.x, q.y);
            }
            ctx.stroke();
            ctx.restore();
            return;
        }

        // Espessura (altura) da corda e escala do sprite.
        const linkH = CABLE_LINK_WORLD_H;
        const scale = linkH / cable.naturalHeight;
        // Largura (em px de mundo) de UMA repetição completa da trama.
        const tileW = cable.naturalWidth * scale;

        // TEXTURA CONTÍNUA: amostramos a curva em muitos sub-trechos finos; a
        // cada trecho avançamos uma coordenada de textura `u` pelo COMPRIMENTO
        // DE ARCO real, recortando a faixa correspondente do sprite (com wrap).
        // Assim a trama flui sem emendas e sem distorção, acompanhando a curva.
        const SUB = 48;                 // nº de sub-trechos (quanto mais, mais liso)
        const drawW = (Math.hypot(p2.x - p1.x, p2.y - p1.y) + Math.hypot(this.dragX, this.dragY) * 2) / SUB + 1;

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        let prev = this.cablePoint(p1, p2, 0);
        let u = this.textureOffset % tileW; // posição inicial na textura
        for (let i = 1; i <= SUB; i++) {
            const cur = this.cablePoint(p1, p2, i / SUB);
            const segLen = Math.hypot(cur.x - prev.x, cur.y - prev.y);
            const mx = (prev.x + cur.x) / 2;
            const my = (prev.y + cur.y) / 2;
            const ang = Math.atan2(cur.y - prev.y, cur.x - prev.x);

            // Faixa do sprite para este trecho: mapeia o arco [u, u+segLen] em
            // coordenadas de pixel do sprite (0..naturalWidth), com wrap.
            const su = ((u % tileW) / tileW) * cable.naturalWidth;
            const sw = (segLen / tileW) * cable.naturalWidth;

            ctx.save();
            ctx.translate(mx, my);
            ctx.rotate(ang);
            if (su + sw <= cable.naturalWidth) {
                ctx.drawImage(cable, su, 0, sw, cable.naturalHeight,
                    -segLen / 2 - 0.5, -linkH / 2, segLen + 1, linkH);
            } else {
                // A faixa cruza a borda da textura: desenha em duas partes.
                const sw1 = cable.naturalWidth - su;
                const frac = sw1 / sw;
                const w1 = (segLen + 1) * frac;
                ctx.drawImage(cable, su, 0, sw1, cable.naturalHeight,
                    -segLen / 2 - 0.5, -linkH / 2, w1, linkH);
                ctx.drawImage(cable, 0, 0, sw - sw1, cable.naturalHeight,
                    -segLen / 2 - 0.5 + w1, -linkH / 2, (segLen + 1) - w1, linkH);
            }
            ctx.restore();

            u += segLen;
            prev = cur;
        }
        ctx.restore();
    }

    draw(ctx, p1, p2) {
        ctx.save();

        const sprite = this.sprite;
        const spriteReady = sprite && sprite.complete && sprite.naturalWidth > 0;

        // Pixel art: nunca suavizar.
        const prevSmoothing = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = false;

        const bloody = this.bloodTimer > 0;
        const inertiaRow = (bloody ? ROW_INERTIA_BLOODY : ROW_INERTIA_CLEAN) * SAW_FRAME.size;
        const spinRow = (bloody ? ROW_SPIN_BLOODY : ROW_SPIN_CLEAN) * SAW_FRAME.size;

        // Blend 0..1 (smoothstep) ao longo da faixa de transição: 0 = só
        // inércia, 1 = só girando. Entre os dois, crossfade por alpha.
        const bt = Math.max(0, Math.min(1, (this.spin - BLEND_LO) / (BLEND_HI - BLEND_LO)));
        const blend = bt * bt * (3 - 2 * bt);

        // Tremor: vibração constante enquanto gira (não some no giro alto) MAIS
        // um pico brusco no MEIO da transição (blend*(1-blend) tem máximo em
        // 0.5). Assim a troca inércia<->giro "chacoalha" bem mais.
        const spinning = this.spin > BLEND_LO;
        const transPulse = blend * (1 - blend) * 4; // 0..1, pico no meio
        // Tensão adiciona um tremor leve (cresce com a iminência da ruptura).
        const strainShake = this.strain * this.strain * 3.5;
        const shake = (spinning ? SHAKE_SPIN : 0) + SHAKE_TRANSITION * transPulse + strainShake;

        // Flash de ruptura iminente: oscilação (0..1) cuja AMPLITUDE e PISO
        // crescem com a tensão. Perto do limite fica quase sempre branco.
        let flash = 0;
        if (this.strain > 0.02) {
            const osc = 0.5 + 0.5 * Math.sin(this.flashPhase); // 0..1
            const env = this.strain * this.strain;             // ease-in
            // mistura: oscila cedo, satura em branco perto da ruptura.
            flash = Math.min(1, osc * env * 1.4 + env * env * 0.6);
        }

        // JUICE: "pop" de escala no arranque — estica ao engatar o giro e volta
        // ao normal conforme o kick decai (ease-out).
        const popScale = 1 + 0.22 * this.spinKick;

        // Desenha o disco (rotação real) a partir de uma linha/frame da folha.
        // Tanto a INÉRCIA quanto o GIRO rotacionam de fato — a diferença é só
        // qual sprite usar. Assim, ao perder velocidade, o disco de inércia
        // segue girando pelo `this.rotation` residual até o `spin` zerar.
        // Offscreen que guarda o recorte do frame tingido de BRANCO (usando o
        // próprio alfa do sprite como máscara). Reaproveitado entre frames.
        const whiteTint = (sx, sy) => {
            const S = SAW_FRAME.size;
            if (!this._flashCanvas) {
                this._flashCanvas = document.createElement("canvas");
                this._flashCanvas.width = S;
                this._flashCanvas.height = S;
            }
            const fc = this._flashCanvas;
            const fx = fc.getContext("2d");
            fx.imageSmoothingEnabled = false;
            fx.clearRect(0, 0, S, S);
            fx.globalCompositeOperation = "source-over";
            fx.drawImage(sprite, sx, sy, S, S, 0, 0, S, S);
            // Pinta de branco só onde há sprite (preserva o recorte/alfa).
            fx.globalCompositeOperation = "source-atop";
            fx.fillStyle = "#ffffff";
            fx.fillRect(0, 0, S, S);
            fx.globalCompositeOperation = "source-over";
            return fc;
        };

        const drawDisc = (x, y, draw, dir, sx, sy, alpha) => {
            const jx = (Math.random() - 0.5) * 2 * shake;
            const jy = (Math.random() - 0.5) * 2 * shake;
            const sz = draw * popScale;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(x + jx, y + jy);
            ctx.rotate(this.rotation * dir);
            ctx.drawImage(sprite, sx, sy, SAW_FRAME.size, SAW_FRAME.size, -sz / 2, -sz / 2, sz, sz);
            // Pisca branco por cima (ruptura iminente).
            if (flash > 0) {
                ctx.globalAlpha = alpha * flash;
                ctx.drawImage(whiteTint(sx, sy), -sz / 2, -sz / 2, sz, sz);
            }
            ctx.restore();
        };

        const inertiaSx = INERTIA_FRAME * SAW_FRAME.size;
        const spinSx = 0; // giro usa o 1º frame da linha; o giro vem da rotação

        this.getSawPositions(p1, p2).forEach(({ x, y, radius }, index) => {
            const dir = index % 2 === 1 ? 1 : -1;
            const draw = radius >= 14 ? SAW_DRAW_LARGE : SAW_DRAW_SMALL;

            // GLOW do pisca (ruptura iminente): halo luminoso aditivo atrás do
            // disco, pulsando junto com o flash. Blur contido para não borrar
            // demais sobre o pixel art.
            if (flash > 0.01) {
                ctx.save();
                ctx.globalCompositeOperation = "lighter";
                ctx.globalAlpha = flash * 0.7;
                ctx.shadowColor = "#eaf2ff";
                ctx.shadowBlur = 8 * flash;
                ctx.fillStyle = "#eaf2ff";
                ctx.beginPath();
                ctx.arc(x, y, draw * 0.28, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
                ctx.globalAlpha = 1;
            }

            if (spriteReady) {
                // Crossfade por VELOCIDADE: giro rápido usa o sprite "girando";
                // ao desacelerar, troca para o "inércia" (ambos rotacionando).
                // Fora da faixa, desenha só um (nítido); dentro, sobrepõe.
                if (blend <= 0) {
                    drawDisc(x, y, draw, dir, inertiaSx, inertiaRow, 1);
                } else if (blend >= 1) {
                    drawDisc(x, y, draw, dir, spinSx, spinRow, 1);
                } else {
                    drawDisc(x, y, draw, dir, inertiaSx, inertiaRow, 1 - blend);
                    drawDisc(x, y, draw, dir, spinSx, spinRow, blend);
                }
                ctx.globalAlpha = 1;
            } else {
                // Fallback procedural (caso o sprite não carregue).
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(this.rotation * dir);
                ctx.fillStyle = bloody ? "#9a2638" : "#c8ccd4";
                ctx.beginPath();
                for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
                    ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
                    ctx.lineTo(Math.cos(a + 0.3) * (radius * 0.5), Math.sin(a + 0.3) * (radius * 0.5));
                }
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = "#2b2d42";
                ctx.lineWidth = 1.5;
                ctx.stroke();
                ctx.restore();
            }
        });

        ctx.globalAlpha = 1;
        ctx.imageSmoothingEnabled = prevSmoothing;
        ctx.restore();
    }

    // Desenha a LÂMINA DROPADA no chão (corrente arrebentada): sombra pulsante,
    // sprite flutuando (bob vertical) e um feixe de luz diagonal varrendo a
    // lâmina — sinalizando um item que pode ser recolhido (ao reconectar).
    drawDropped(ctx) {
        if (!this.dropped) return;

        const sprite = this.sprite;
        const spriteReady = sprite && sprite.complete && sprite.naturalWidth > 0;

        const prevSmoothing = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = false;

        const draw = SAW_DRAW_LARGE;
        const bloody = this.bloodTimer > 0;
        // Frame da serra: usa o disco de inércia (parado) na linha certa.
        const row = (bloody ? ROW_INERTIA_BLOODY : ROW_INERTIA_CLEAN) * SAW_FRAME.size;
        const sx = INERTIA_FRAME * SAW_FRAME.size;

        // Flutuação: altura do bob (senoide) e fator 0..1 para a sombra.
        const bob = Math.sin(this.dropPhase) * 5;      // sobe/desce ~5px
        const hover = (Math.sin(this.dropPhase) + 1) / 2; // 0..1
        // Pop de queda: ao surgir, a lâmina "assenta" (escala de 1.25 -> 1).
        const settle = 1 + (1 - this.dropT) * 0.25;

        const cx = this.dropX;
        const cy = this.dropY;

        // --- 1) Sombra no chão (elipse) — encolhe/clareia quando a lâmina sobe ---
        ctx.save();
        const shadowScale = 1 - hover * 0.22;          // menor quando flutua alto
        const shadowAlpha = 0.38 - hover * 0.14;       // mais fraca quando alto
        ctx.globalAlpha = Math.max(0, shadowAlpha);
        ctx.fillStyle = "#000000";
        ctx.beginPath();
        ctx.ellipse(cx, cy + draw * 0.34, draw * 0.34 * shadowScale, draw * 0.13 * shadowScale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // --- 2) Glow suave embaixo da lâmina (realça o item no escuro) ---
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.18 + hover * 0.12;
        ctx.shadowColor = "#cfe4ff";
        ctx.shadowBlur = 10;
        ctx.fillStyle = "#9fc4ff";
        ctx.beginPath();
        ctx.arc(cx, cy - bob, draw * 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Centro vertical da lâmina flutuando (aplicamos o bob aqui).
        const ly = cy - bob;
        const sz = draw * settle;

        // --- 3) A lâmina em si ---
        if (spriteReady) {
            ctx.save();
            ctx.translate(cx, ly);
            ctx.rotate(this.rotation * this.spinDir);
            ctx.drawImage(sprite, sx, row, SAW_FRAME.size, SAW_FRAME.size, -sz / 2, -sz / 2, sz, sz);
            ctx.restore();

            // --- 4) Feixe de luz DIAGONAL varrendo o sprite ---
            // Um gradiente diagonal (faixa clara que atravessa) é recortado pelo
            // ALFA do próprio sprite, então o brilho só aparece sobre a lâmina —
            // como um reflexo que corre pela superfície metálica.
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            ctx.translate(cx, ly);
            // A faixa de luz é desenhada num offscreen do tamanho do frame,
            // já mascarada pelo recorte do sprite, e então ampliada.
            const beam = this._buildBeam(sx, row);
            if (beam) ctx.drawImage(beam, -sz / 2, -sz / 2, sz, sz);
            ctx.restore();
        }

        ctx.globalAlpha = 1;
        ctx.imageSmoothingEnabled = prevSmoothing;
    }

    // Monta (num canvas offscreen) o FEIXE de luz diagonal recortado pelo alfa
    // do frame da serra. A posição da faixa corre com `this.sweepPhase`, então
    // o reflexo "varre" a lâmina de um canto ao outro, em loop.
    _buildBeam(sx, sy) {
        const sprite = this.sprite;
        if (!sprite || !sprite.complete || !sprite.naturalWidth) return null;

        const S = SAW_FRAME.size;
        if (!this._beamCanvas) {
            this._beamCanvas = document.createElement("canvas");
            this._beamCanvas.width = S;
            this._beamCanvas.height = S;
        }
        const bc = this._beamCanvas;
        const bx = bc.getContext("2d");
        bx.imageSmoothingEnabled = false;
        bx.clearRect(0, 0, S, S);

        // Posição da faixa (0..1 em loop) convertida em deslocamento diagonal.
        // Vai de -S a +2S para a faixa entrar e sair totalmente do quadro.
        const p = (Math.sin(this.sweepPhase) + 1) / 2; // 0..1 (vai e volta)
        const travel = -S + p * (2.2 * S);

        // Gradiente numa reta DIAGONAL (de um canto ao canto oposto). A faixa
        // clara fica centrada em `travel`, estreita, com bordas suaves.
        const dx = travel, dy = travel; // direção (1,1) normalizada no espaço do quadro
        const grad = bx.createLinearGradient(dx - S * 0.5, dy - S * 0.5, dx + S * 0.5, dy + S * 0.5);
        grad.addColorStop(0.0, "rgba(255,255,255,0)");
        grad.addColorStop(0.42, "rgba(255,255,255,0)");
        grad.addColorStop(0.5, "rgba(255,255,255,0.85)");
        grad.addColorStop(0.58, "rgba(255,255,255,0)");
        grad.addColorStop(1.0, "rgba(255,255,255,0)");
        bx.fillStyle = grad;
        bx.fillRect(0, 0, S, S);

        // Recorta a faixa pelo alfa do sprite (o brilho só vive sobre a lâmina).
        bx.globalCompositeOperation = "destination-in";
        bx.drawImage(sprite, sx, sy, S, S, 0, 0, S, S);
        bx.globalCompositeOperation = "source-over";
        return bc;
    }
}
