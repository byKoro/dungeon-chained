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
//   serra grande = 3.5x (56px), pequena = 2x (32px).
const SAW_DRAW_LARGE = SAW_FRAME.size * 3.5; // 56
const SAW_DRAW_SMALL = SAW_FRAME.size * 2;   // 32

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
const SHAKE_TRANSITION = 7;

export class SawWeapon extends Weapon {
    constructor(sprite = null) {
        super("SERRAS", 14);
        this.sprite = sprite;
        this.bloodTimer = 0;
        this.spin = 0;         // 0 = parada, 1 = girando a toda
        this.rotation = 0;     // ângulo acumulado da rotação real (giro)
        this.wasSpinning = false; // para detectar o instante do arranque
        this.spinKick = 0;     // "pop" de escala ao engatar o giro (decai)
    }

    update(p1 = null, p2 = null) {
        if (this.bloodTimer > 0) this.bloodTimer--;

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

    // Velocidade de giro atual (0..1), para o Game modular a tremida de câmera.
    get spinSpeed() {
        return this.spin;
    }

    // true quando a serra está em velocidade ALTA (giro "a toda").
    get isHighSpeed() {
        return this.spin > BLEND_HI;
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

    draw(ctx, p1, p2) {
        ctx.save();

        // Corrente ligando os jogadores.
        ctx.strokeStyle = "#8d99ae";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

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
        const shake = (spinning ? SHAKE_SPIN : 0) + SHAKE_TRANSITION * transPulse;

        // JUICE: "pop" de escala no arranque — estica ao engatar o giro e volta
        // ao normal conforme o kick decai (ease-out).
        const popScale = 1 + 0.22 * this.spinKick;

        // Desenha o disco (rotação real) a partir de uma linha/frame da folha.
        // Tanto a INÉRCIA quanto o GIRO rotacionam de fato — a diferença é só
        // qual sprite usar. Assim, ao perder velocidade, o disco de inércia
        // segue girando pelo `this.rotation` residual até o `spin` zerar.
        const drawDisc = (x, y, draw, dir, sx, sy, alpha) => {
            const jx = (Math.random() - 0.5) * 2 * shake;
            const jy = (Math.random() - 0.5) * 2 * shake;
            const sz = draw * popScale;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(x + jx, y + jy);
            ctx.rotate(this.rotation * dir);
            ctx.drawImage(sprite, sx, sy, SAW_FRAME.size, SAW_FRAME.size, -sz / 2, -sz / 2, sz, sz);
            ctx.restore();
        };

        const inertiaSx = INERTIA_FRAME * SAW_FRAME.size;
        const spinSx = 0; // giro usa o 1º frame da linha; o giro vem da rotação

        this.getSawPositions(p1, p2).forEach(({ x, y, radius }, index) => {
            const dir = index % 2 === 1 ? 1 : -1;
            const draw = radius >= 14 ? SAW_DRAW_LARGE : SAW_DRAW_SMALL;

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
