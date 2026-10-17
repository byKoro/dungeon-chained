import { Weapon } from './Weapon.js';

/**
 * SawWeapon — serras giratórias presas à corrente dos jogadores.
 *
 * Sprite: assets/saw/saw.png — grade 4x4 de frames 16x16 (resolução de pixel
 * art nativa do jogo), fundo transparente.
 *   - Linha 0: serra parada, limpa.
 *   - Linha 1: serra parada, ensanguentada.
 *   - Linha 2: serra girando (motion blur), limpa.
 *   - Linha 3: serra girando (motion blur), ensanguentada.
 *
 * A serra só GIRA quando os jogadores andam. Um valor `spin` (0..1) persegue
 * suavemente a velocidade do movimento: perto de 0 mostramos a linha PARADA
 * (giro residual bem lento); acima de um limiar passamos para a linha GIRANDO,
 * cuja troca de frames é proporcional ao `spin` (mais devagar que antes).
 *
 * O giro vem da TROCA DE FRAMES (sem ctx.rotate): pixels sempre alinhados aos
 * eixos, mesma proporção do resto do jogo.
 */

const SAW_FRAME = { size: 16, cols: 4 };
const ROW_IDLE_CLEAN = 0;
const ROW_IDLE_BLOODY = 1;
const ROW_SPIN_CLEAN = 2;
const ROW_SPIN_BLOODY = 3;

// Fatores de ampliação inteiros (pixels sempre quadrados):
//   serra grande = 3x (48px), pequena = 2x (32px).
const SAW_DRAW_LARGE = SAW_FRAME.size * 3; // 48
const SAW_DRAW_SMALL = SAW_FRAME.size * 2; // 32

// Quantos passos de simulação a serra fica ensanguentada após um acerto.
const BLOOD_DURATION = 90;

// Dinâmica do giro.
const SPIN_LERP = 0.12;        // suavidade da transição parado <-> girando
const SPIN_SHOW_THRESHOLD = 0.12; // acima disto, mostra a linha "girando"
// Velocidade da animação de giro (quanto MAIOR, mais LENTO). Antes era ~3;
// subimos para desacelerar a troca de frames do giratório.
const SPIN_FRAME_DIVISOR = 6;

export class SawWeapon extends Weapon {
    constructor(sprite = null) {
        super("SERRAS", 14);
        this.sprite = sprite;
        this.bloodTimer = 0;
        this.spin = 0;         // 0 = parada, 1 = girando a toda
        this.framePhase = 0;   // fase contínua da animação de frames
    }

    update(p1 = null, p2 = null) {
        if (this.bloodTimer > 0) this.bloodTimer--;

        // Alvo de giro = quanto os jogadores estão se movendo (0..1).
        let target = 0;
        if (p1 && p2) {
            const speed = p1.speed || p2.speed || 4.2;
            const mag = Math.max(p1.speedMag ?? 0, p2.speedMag ?? 0);
            target = Math.max(0, Math.min(1, mag / speed));
        }
        this.spin += (target - this.spin) * SPIN_LERP;

        // Avanço da animação de frames, proporcional ao giro: rápido ao andar,
        // desacelerando até quase travar conforme os jogadores param.
        this.framePhase += this.spin / SPIN_FRAME_DIVISOR;
    }

    // Chamado pelo CombatSystem quando a serra abate/acerta um inimigo.
    onHit() {
        this.bloodTimer = BLOOD_DURATION;
    }

    getSawPositions(p1, p2) {
        const numSaws = 3;
        return Array.from({ length: numSaws }, (_, index) => {
            const i = index + 1;
            const t = i / (numSaws + 1);
            return {
                x: p1.x + (p2.x - p1.x) * t,
                y: p1.y + (p2.y - p1.y) * t,
                radius: i % 2 === 0 ? 14 : 11
            };
        });
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

        const spinning = this.spin > SPIN_SHOW_THRESHOLD;
        const bloody = this.bloodTimer > 0;
        const row = spinning
            ? (bloody ? ROW_SPIN_BLOODY : ROW_SPIN_CLEAN)
            : (bloody ? ROW_IDLE_BLOODY : ROW_IDLE_CLEAN);
        const sy = row * SAW_FRAME.size;

        this.getSawPositions(p1, p2).forEach(({ x, y, radius }, index) => {
            if (spriteReady) {
                // Giro por troca de frames. Serras alternadas avançam em
                // sentidos opostos e defasadas, para não ficarem idênticas.
                const dir = index % 2 === 1 ? 1 : -1;
                const step = Math.floor(this.framePhase) * dir + index;
                const frame = ((step % SAW_FRAME.cols) + SAW_FRAME.cols) % SAW_FRAME.cols;
                const sx = frame * SAW_FRAME.size;

                const draw = radius >= 14 ? SAW_DRAW_LARGE : SAW_DRAW_SMALL;
                // Canto quantizado ao tamanho do pixel ampliado (sem sub-pixel).
                const pix = draw / SAW_FRAME.size;
                const dx = Math.round((x - draw / 2) / pix) * pix;
                const dy = Math.round((y - draw / 2) / pix) * pix;

                ctx.drawImage(
                    sprite,
                    sx, sy, SAW_FRAME.size, SAW_FRAME.size,
                    dx, dy, draw, draw
                );
            } else {
                // Fallback procedural (caso o sprite não carregue).
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(this.framePhase * (index % 2 === 1 ? 1 : -1));
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

        ctx.imageSmoothingEnabled = prevSmoothing;
        ctx.restore();
    }
}
