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

// Corrente (cabo) montada a partir do sprite tileável (assets/saw/image.png).
//   LINK_WORLD_H = altura do elo em px de MUNDO (a escala é derivada disto,
//   mantendo a proporção do sprite). O cabo é RETO (sem curva).
const CABLE_LINK_WORLD_H = 32;

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
    }

    update(p1 = null, p2 = null) {
        // Enquanto está SOBRE sangue, mantém o estado ensanguentado (não deixa
        // o timer expirar). O Game ajusta `onBlood` a cada frame.
        if (this.onBlood) this.bloodTimer = BLOOD_DURATION;
        else if (this.bloodTimer > 0) this.bloodTimer--;

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

    getSawPositions(p1, p2) {
        // Uma única serra (a maior), no meio da corrente.
        return [{
            x: (p1.x + p2.x) / 2,
            y: (p1.y + p2.y) / 2,
            radius: 14
        }];
    }

    hitsTarget(target, p1, p2) {
        return this.getSawPositions(p1, p2).some(saw =>
            Math.hypot(target.x - saw.x, target.y - saw.y) < saw.radius + (target.hitRadius ?? 0)
        );
    }

    // Corrente ligando os jogadores. Desenhada numa camada ao FUNDO (sempre
    // atrás das entidades), separada do disco.
    //
    // Montagem a partir do sprite `cableSprite` (um segmento tileável): o cabo
    // CURVA como uma corda pendurada (catenária aproximada por parábola). O
    // afundamento (sag) é maior quando a corrente está frouxa e some quando ela
    // estica. Percorremos a curva em passos do tamanho do segmento, desenhando
    // cada elo rotacionado na TANGENTE para acompanhar a curvatura.
    drawChain(ctx, p1, p2) {
        const cable = this.cableSprite;
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy) || 1;

        // Fallback vetorizado se o sprite não carregou.
        if (!cable || !cable.complete || !cable.naturalWidth) {
            ctx.save();
            ctx.strokeStyle = "#8d99ae";
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
            ctx.restore();
            return;
        }

        // Dimensões do elo em px de MUNDO: escala derivada da altura-alvo,
        // preservando a proporção do sprite. O passo tilea o sprite ao longo da
        // linha com leve sobreposição para encadear sem vãos.
        const linkH = CABLE_LINK_WORLD_H;
        const scale = linkH / cable.naturalHeight;
        const linkW = cable.naturalWidth * scale;
        const step = linkW * 0.78;

        // Cabo RETO: um único ângulo de p1 a p2, tileando os elos na linha.
        const ang = Math.atan2(dy, dx);
        const segments = Math.max(1, Math.ceil(dist / step));

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.translate(p1.x, p1.y);
        ctx.rotate(ang);
        for (let i = 0; i < segments; i++) {
            const cx = (i + 0.5) * (dist / segments);
            ctx.drawImage(
                cable, 0, 0, cable.naturalWidth, cable.naturalHeight,
                cx - linkW / 2, -linkH / 2, linkW, linkH
            );
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
}
