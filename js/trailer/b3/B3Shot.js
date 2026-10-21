/**
 * B3Shot — base dos clipes do Bloco 3 do vídeo de apresentação
 * (pitch/04-video-apresentacao.md, "O jogo na prática").
 *
 * Cada clipe é uma ActionArena em tela cheia, dirigida por roteiro, mas com a
 * MECÂNICA REAL do jogo decidindo o resultado: resistência na beirada do
 * buraco (HOLE_FALL), espinhos/flechas/botões (SpikeTrap, ArrowTrap,
 * PressureButton) e dano (Player.takeDamage). Cada roteiro tem "garantias" de
 * tempo para nunca travar.
 *
 * Linguagem visual: câmera de cima como a do jogo (sem o giro de drone do
 * trailer), com um tremido de mão leve e o zoom um pouco mais perto. Clima
 * de masmorra do jogo (ambiente 44,36,54), sem a luz vermelha do trailer.
 *
 * Diferenças para o trailer:
 *   - cutIn = 'dry': corte seco puro (sem clarão nem whoosh); o beat é da edição;
 *   - sem tranco de câmera no corte; TAIL de 1 s de sobra no fim;
 *   - dano detectado pela queda de `lives` (como o Game): flash vermelho,
 *     tremor médio, hit-stop curto e `playerHit`.
 *
 * Níveis de juice (combinados com o roteiro):
 *   pequeno = passos, botão do P1, corda esticando (tremor 3)
 *   médio   = dano no espinho, 2º botão
 *   grande  = auge do "segurar" no buraco, último inimigo
 */
import { ArenaShot } from '../kit/ArenaShot.js';
import { handheld } from '../kit/rushKit.js';
import { DOOR_LIGHT } from '../../config/GameConfig.js';
import { drawText, measureText } from '../../ui/PixelFont.js';

export const TAIL = 1.0;              // s de sobra no fim (folga para a edição)
export const AMBIENT = '44, 36, 54';  // clima das salas do jogo
const VIGNETTE = 0.72;

// Feixe amarelo de "porta aberta" (igual ao LightingRenderer do jogo).
const DOOR_BEAM = {
    color: DOOR_LIGHT.color,
    flickerBase: 1, flickerSine: 0, flickerNoise: 0,
    falloff: [
        { offset: 0.0, alpha: 0.9 }, { offset: 0.4, alpha: 0.5 }, { offset: 0.7, alpha: 0.2 },
        { offset: 0.9, alpha: 0.06 }, { offset: 1.0, alpha: 0.0 }
    ]
};

export class B3Shot extends ArenaShot {
    /**
     * @param {TrailerStage} stage
     * @param {object} opts   opções da ActionArena (cols, rows, doors, seed, ropeLen...)
     * @param {number} action s de ação (o TAIL é somado aqui)
     */
    constructor(stage, opts = {}, action = 3) {
        super(stage, {
            smoothZoom: true, camClose: 1, ambient: AMBIENT, vignette: VIGNETTE, ...opts
        }, action + TAIL);
        this.cutIn = 'dry';
        this.action = action;
        this.label = '';        // lower-third (só na prévia com ?labels)
        this.hz = null;         // ArenaHazards opcional (espinhos/flechas/botões)
        this.hitStop = 0;
        this.doorFlashT = 0;
    }

    start() {
        this.t = 0;
        this.hitStop = 0;
        this.doorFlashT = 0;
        const A = this.arena;
        A.reset();
        A.ensureSize(this.stage.canvas.width, this.stage.canvas.height);
        for (const p of [A.p1, A.p2]) {
            p.lives = 3;
            p.falling = false;
            p.fallComplete = false;
            p.holeGrace = 0;
            p.expression = null;
            p._exprBase = null;
            p._livesSeen = 3;
        }
        this.hz?.reset();
        // Ganchos de desenho: perigos + extras da subclasse.
        A.onDrawFloor = (ctx) => { this.hz?.drawFloor(ctx); this.drawFloor?.(ctx); };
        A.onDrawTop = (ctx) => { this.hz?.drawTop(ctx); this.drawTop?.(ctx); };
        A.onLights = (pp, ws, pix) => { this._doorLights(pp, ws, pix); this.lights?.(pp, ws, pix); };
        this.setup(A);
        const user = A.script;
        A.script = (t) => {
            // Timers que a arena não avança (o Player.update do jogo avança).
            for (const p of [A.p1, A.p2]) {
                if (p.invulnerableTimer > 0) p.invulnerableTimer--;
                if (p.scaredTimer > 0) p.scaredTimer--;
                // Intenção de movimento (o PressureButton usa para soltar o pé
                // de quem está saindo, como o input no jogo).
                const v = Math.hypot(p.vx, p.vy);
                p.moveX = v > 0.3 ? p.vx / v : 0;
                p.moveY = v > 0.3 ? p.vy / v : 0;
            }
            this.hz?.update([A.p1, A.p2]);
            user?.(t);
            this._detectHurt(A);
        };
    }

    /** Congela a simulação por `secs` reais (hit-stop); tremor e luz seguem. */
    hitstop(secs) { this.hitStop = Math.max(this.hitStop, secs); }

    update(dt) {
        this.t += dt;
        if (this.doorFlashT > 0) this.doorFlashT = Math.max(0, this.doorFlashT - dt);
        if (this.hitStop > 0) this.hitStop -= dt;
        else this.arena.update(dt);
    }

    /**
     * Câmera do jogo: de cima, mola suave e tremido de mão leve (sem o giro
     * do drone). zoom em ×zoomRef (camClose = 1).
     */
    frame(A, t, { x, y, zoom, k = 0.1, fit = null, pad = 120, amp = 0.35 }) {
        const h = handheld(t, amp);
        A.focus({ x: x + h.x, y: y + h.y, zoom, rot: h.r * 0.2, k, fit, pad });
    }

    // Dano real (qualquer fonte): detecta a queda de `lives`, como o Game.
    _detectHurt(A) {
        for (const p of [A.p1, A.p2]) {
            if (p.lives < p._livesSeen) this.onHurt(A, p);
            p._livesSeen = p.lives;
        }
    }

    /** Feedback de dano (nível médio). Subclasses podem estender. */
    onHurt(A, p) {
        A.screenGore.triggerFlash();
        A.renderer.triggerShake(10);
        this.hitstop(0.05);
        A.sfx('playerHit', p.x, p.y, { vol: 0.9 });
        A.stage.audio?.duck(-6, 0.15, 0.7);
        A.particles.triggerBlood(p.x, p.y, 6, 0.6);
    }

    /** Porta destrancando: flash amarelo (feixe), som e pulso de câmera. */
    unlockDoors(A) {
        this.doorFlashT = DOOR_LIGHT.flashDuration;
        A.renderer.triggerZoomPunch(-0.07);
        const d = A.doorList[0];
        if (d) A.sfx('doorOpen', d.x, d.y, { vol: 0.9 });
    }

    _doorLights(pp, ws) {
        if (this.doorFlashT <= 0) return;
        const dl = DOOR_LIGHT;
        const prog = 1 - this.doorFlashT / dl.flashDuration;
        const fade = (1 - prog) ** dl.fadeExponent;
        const pulse = 1 + Math.sin(prog * dl.flashDuration * dl.pulseSpeed) * dl.pulseDepth;
        const alpha = Math.max(0, fade * pulse);
        const A = this.arena, half = A.doorHalf;
        for (const door of A.doorList) {
            if ((A.doorOpen[door.dir] ?? 1) < 0.5) continue;
            let dx = 0, dy = 0;
            if (door.dir === 'N') dy = 1; else if (door.dir === 'S') dy = -1;
            else if (door.dir === 'W') dx = 1; else dx = -1;
            const behind = half / Math.tan(dl.spread);
            const s = ws(door.x - dx * behind, door.y - dy * behind);
            const px = Math.max(2, Math.round(4 * s.zoom * dl.pixelScale));
            pp.addSpotLight(s.x, s.y, dx, dy, (dl.length + behind) * s.zoom, dl.spread, px,
                DOOR_BEAM, behind * s.zoom, alpha, dl.startFade);
        }
    }

    render() {
        super.render();
        if (this.stage.showLabels && this.label) this._drawLabel();
    }

    // Lower-third da prévia (no vídeo final quem põe é a edição).
    _drawLabel() {
        const { ctx } = this.stage;
        this._labelArt ??= pixelText(this.label);
        const art = this._labelArt, s = 6;
        // Canto de cima (o de baixo fica livre para a legenda e os controles).
        const x = 64, y = 64;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = 'rgba(5, 3, 10, 0.72)';
        ctx.fillRect(x - 18, y - 16, art.width * s + 36, art.height * s + 26);
        ctx.drawImage(art, x, y, art.width * s, art.height * s);
        ctx.restore();
    }
}

// Texto em PixelFont na resolução da arte (com sombra de 1 px).
function pixelText(text) {
    const c = document.createElement('canvas');
    c.width = measureText(text) + 1;
    c.height = 7;
    const g = c.getContext('2d');
    drawText(g, text, 0, 1, '#3a2408');
    drawText(g, text, 0, 0, '#ffd68c');
    return c;
}
