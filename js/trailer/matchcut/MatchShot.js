/**
 * MatchShot — base dos clipes do MATCH CUT do vídeo de apresentação
 * (pitch/04-video-apresentacao.md): o recorte de papel na mesa "vira" jogo.
 *
 * Regras comuns (combinadas para todos os planos):
 *   - arena 18x11 cujo miolo (a JANELA) é idêntico à folha 4 impressa
 *     (tools/gen_boss_room.py lê o mesmo layout.json);
 *   - câmera TRAVADA no enquadramento do papel (a folha preenche o 16:9:
 *     10 tiles de largura = 192 px por tile em 1920x1080) até o roteiro
 *     pedir um movimento (camTo, em tempo real) — ex.: o soco no abate;
 *   - hitstop(secs): congela a simulação um instante no impacto;
 *   - FREEZE s congelados no início = o quadro do papel (o editor escolhe o
 *     quadro do corte); depois a simulação anda;
 *   - luz PLANA (sem luz/vinheta/névoa/sombras, como o papel) que vira o
 *     clima do jogo em MOOD_IN s logo que a ação começa;
 *   - sem corte de impacto, sem letterbox, sem música (o TrailerPlayer do
 *     conjunto matchcut cuida disso).
 *
 * Subclasses: setup(A) (atores extras + roteiro em A.script, com t = tempo
 * de simulação desde o FIM do congelamento).
 */
import { ArenaShot } from '../kit/ArenaShot.js';
import { clamp01, easeInOut, lerp } from '../anim.js';

export const LAYOUT = await (await fetch(new URL('./layout.json', import.meta.url))).json();

export const FREEZE = 0.5;      // s congelados no início (= papel)
export const MOOD_IN = 0.4;     // s da luz plana até o clima do jogo
export const TAIL = 1.0;        // s de sobra no fim (folga para a edição)
const AMBIENT = [44, 36, 54];   // clima das arenas do trailer
const VIGNETTE = 0.72;
const BASE_W = 1920;            // largura para a qual camera.zoom foi pensado

export class MatchShot extends ArenaShot {
    /**
     * @param {TrailerStage} stage
     * @param {number} duration s reais, já contando FREEZE e TAIL
     * @param {object} [opts] overrides da ActionArena
     */
    constructor(stage, duration, opts = {}) {
        const a = LAYOUT.arena;
        super(stage, {
            cols: a.cols, rows: a.rows, seed: a.seed, ropeLen: a.ropeLen,
            // smoothZoom: zoom contínuo (os empurrões de câmera ficam lisos;
            // no zoom do papel, 3.0, o tile já cai em 192 px inteiros).
            camClose: 1, smoothZoom: true, ambient: AMBIENT.join(', '), vignette: VIGNETTE, ...opts
        }, duration);
        this.cutIn = null;
    }

    get layout() { return LAYOUT; }

    start() {
        this.t = 0;
        const A = this.arena;
        A.reset();
        const { width: W, height: H } = this.stage.canvas;
        A.ensureSize(W, H);
        // Janela = folha 4: piso liso + os mesmos props.
        A.tiles.props = LAYOUT.props.map(p => ({ ...p }));
        const c = LAYOUT.camera;
        this.baseZoom = c.zoom * W / BASE_W;
        A.setCam(c.x, c.y, this.baseZoom);
        // Câmera do clipe: começa TRAVADA no papel; só anda quando o roteiro
        // chama camTo (z = multiplicador do zoom do papel).
        this.cam = { x: c.x, y: c.y, z: 1, rot: 0 };
        this._camGoal = null;
        this.hitStop = 0;
        this.poseBase(A);
        this.setup(A);
        this._look(A, 1);
    }

    /**
     * Objetivo de câmera em TEMPO REAL (não estica na câmera lenta: o soco de
     * câmera continua rápido mesmo com o mundo lento). Campos omitidos mantêm
     * o objetivo anterior. k = rapidez (1/s; ~16 soco, ~3 assentar, ~1 deriva).
     */
    camTo(goal) {
        this._camGoal = { ...(this._camGoal ?? this.cam), k: 6, ...goal };
    }

    /** Congela a simulação por `secs` reais (hit-stop); tremor e luz seguem. */
    hitstop(secs) { this.hitStop = Math.max(this.hitStop, secs); }

    _tickCam(dt) {
        const g = this._camGoal;
        if (!g) return;
        const c = this.cam, a = 1 - Math.exp(-dt * g.k);
        c.x += (g.x - c.x) * a;
        c.y += (g.y - c.y) * a;
        c.z += (g.z - c.z) * a;
        c.rot += (g.rot - c.rot) * a;
        const A = this.arena, r = A.renderer;
        r.camX = c.x; r.camY = c.y; r.zoom = this.baseZoom * c.z;
        A.rot = c.rot;
    }

    /** Pose-base: P1 à esquerda olhando para o P2, P2 espelhado, corda em repouso. */
    poseBase(A) {
        const { p1: a, p2: b } = LAYOUT.pose;
        const { p1, p2, saw } = A;
        A.initPlayer(p1, a.x, a.y);
        A.initPlayer(p2, b.x, b.y);
        p1.faceX = b.x; p1.facingLeft = false;
        p2.faceX = a.x; p2.facingLeft = true;
        p1.tilt = p2.tilt = 0;
        saw.spin = 0; saw.rotation = 0; saw.dragX = saw.dragY = 0;
        A.minSpin = 0;
    }

    update(dt) {
        this.t += dt;
        const A = this.arena;
        if (this.t >= FREEZE) {
            if (this.hitStop > 0) this.hitStop -= dt;
            else A.update(dt);
        }
        this._tickCam(dt);
        this._look(A, 1 - easeInOut(clamp01((this.t - FREEZE) / MOOD_IN)));
    }

    // Luz plana (flat = 1, papel) -> clima do jogo (flat = 0).
    _look(A, flat) {
        A.flat = flat;
        const k = 1 - flat;
        const post = A.post;
        post.lighting.ambient = AMBIENT.map(v => Math.round(lerp(255, v, k))).join(', ');
        const s = VIGNETTE * k;
        if (post.vignette.strength !== s) {
            post.vignette.strength = s;
            post._vW = -1;                  // refaz o gradiente da vinheta
        }
    }
}
