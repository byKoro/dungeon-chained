/**
 * IntroScene — CENA 1 do trailer.
 *
 *   1. Os dois entram pela porta; câmera BEM PERTO da porta.
 *   2. A câmera vai para o meio e a SERRA NASCE (drop + luz + clarão).
 *   3. Reação de ESPANTO.
 *   4. Chegam perto da serra e PEGAM ela (a corda liga os dois).
 *   5. Balão do VERMELHO; o AZUL concorda.
 *   5b. CLOSE no rosto do vermelho e depois no do azul.
 *   6. A câmera recua, a sala TREME, espanto de novo.
 *   7. Recuam devagar pela porta e somem na escuridão (fade para a cartela).
 */
import { RoomTiles } from '../../core/RoomTiles.js';
import { PostProcessor } from '../../systems/PostProcessor.js';
import { WindSystem } from '../../systems/WindSystem.js';
import {
    TILE, ROOM_COLS, ROOM_ROWS, BACKGROUND_TILE, DOOR_STUB_TILES,
    PLAYER_LIGHT_RADIUS, LIGHT_PIXEL_SCALE, TORCHES
} from '../../config/GameConfig.js';
import { clamp01, lerp, easeInOut, easeOut, easeIn } from '../anim.js';

// Luz AZUL-AÇO da lâmina (mesma cor do jogo).
const BLADE_LIGHT_PROFILE = {
    color: '150, 196, 255',
    flickerBase: 1, flickerSine: 0.05, flickerNoise: 0.02,
    falloff: [
        { offset: 0.0, alpha: 0.9 }, { offset: 0.3, alpha: 0.5 },
        { offset: 0.55, alpha: 0.26 }, { offset: 0.78, alpha: 0.1 },
        { offset: 1.0, alpha: 0.0 }
    ]
};

export class IntroScene {
    constructor(stage) {
        this.stage = stage;

        // Sala: porta S (base), de frente para a câmera.
        this.doors = { N: false, S: true, E: false, W: false };
        this.tiles = new RoomTiles(ROOM_COLS, ROOM_ROWS, this.doors, 1, true);
        this._decorateRoom();
        this.rect = { x: 0, y: 0, w: ROOM_COLS * TILE, h: ROOM_ROWS * TILE };
        this.bounds = {
            minX: TILE, minY: TILE,
            maxX: this.rect.w - TILE, maxY: this.rect.h - TILE
        };
        this.doorHalf = TILE;
        const midC = (ROOM_COLS / 2) | 0;
        this.doorWorld = { dir: 'S', x: midC * TILE, y: this.rect.h - TILE };
        this.doorList = [{ dir: 'S', x: this.doorWorld.x, y: this.rect.h }];
        this.center = { x: this.rect.w / 2, y: this.rect.h / 2 - TILE * 0.3 };

        // Iluminação sombria (só do trailer): ambiente escuro + vinheta
        // fechada; o brilho dos spots é escurecido por SPOT_DIM.
        this.postProcessor = new PostProcessor(stage.canvas, stage.ctx, {
            lighting: { ambient: '30, 26, 40' },
            vignette: { strength: 0.8 }
        });
        this.SPOT_DIM = 0.6;
        this.wind = new WindSystem();

        this._buildBeats();
        this.reset();
    }

    // Atalhos para o palco compartilhado.
    get p1() { return this.stage.p1; }
    get p2() { return this.stage.p2; }
    get saw() { return this.stage.saw; }
    get renderer() { return this.stage.renderer; }
    get ctx() { return this.stage.ctx; }
    get canvas() { return this.stage.canvas; }
    get redPlayer() { return this.stage.redPlayer; }
    get bluePlayer() { return this.stage.bluePlayer; }
    _express(p, n) { this.stage._express(p, n); }
    _bothExpressFor(n, s) { this.stage._bothExpressFor(n, s); }
    _speak(w, t, d) { this.stage._speak(w, t, d); }
    _camTo(x, y, z, k) { this.stage._camTo(x, y, z, k); }
    _zoomFit() { return this.stage._zoomFit(); }

    // Tochas nas paredes + props no piso.
    _decorateRoom() {
        const last = ROOM_COLS - 1, bottom = ROOM_ROWS - 1;
        this.tiles.torches = [
            { col: 1, row: 2, side: 'W', type: 'torch' },
            { col: 1, row: 4, side: 'W', type: 'torch' },
            { col: 1, row: bottom - 2, side: 'W', type: 'torch' },
            { col: last - 1, row: 2, side: 'E', type: 'torch' },
            { col: last - 1, row: 4, side: 'E', type: 'torch' },
            { col: last - 1, row: bottom - 2, side: 'E', type: 'torch' },
            { col: 3, row: 0, side: 'N', type: 'torch' },
            { col: last - 3, row: 0, side: 'N', type: 'torch' }
        ];
        this.tiles.props = [
            { col: 2, row: 2, index: 59 },
            { col: last - 2, row: 2, index: 68 },
            { col: 2, row: bottom - 2, index: 64 },
            { col: last - 2, row: bottom - 2, index: 77 },
            { col: 4, row: 3, index: 64 },
            { col: last - 4, row: 3, index: 59 }
        ];
    }

    // Posições-chave da cena (mundo).
    _layout() {
        const d = this.doorWorld;
        return {
            p1OutsideDoor: { x: d.x - TILE * 0.6, y: d.y + TILE * 1.9 },
            p2OutsideDoor: { x: d.x + TILE * 0.6, y: d.y + TILE * 1.9 },
            p1NearDoor: { x: d.x - TILE * 0.75, y: d.y - TILE * 0.4 },
            p2NearDoor: { x: d.x + TILE * 0.75, y: d.y - TILE * 0.4 },
            // Um de cada lado e na mesma altura do centro: o meio da corda cai
            // exatamente onde a serra estava (sem "teleporte" ao conectar).
            p1AtSaw: { x: this.center.x - TILE * 1.15, y: this.center.y + TILE * 0.15 },
            p2AtSaw: { x: this.center.x + TILE * 1.15, y: this.center.y + TILE * 0.15 }
        };
    }

    reset() {
        this.beatIndex = 0;
        this.beatTime = 0;
        this.screenFlashT = 0;
        this.worldQuake = 0;
        this.sawVisibleDropped = false;
        this.sawCarried = false;
        this.chainReveal = 0;
        this.sawDropWorld = { x: this.center.x, y: this.center.y };
    }

    // Chamado quando a cena passa a tocar.
    start() {
        this.reset();
        const L = this._layout();
        this._place(this.p1, L.p1OutsideDoor);
        this._place(this.p2, L.p2OutsideDoor);
        this.p1.facingLeft = this.p2.facingLeft = false;
        this._faceFree();
        // Câmera começa BEM PERTO da porta.
        this.renderer.camX = this.doorWorld.x;
        this.renderer.camY = this.doorWorld.y - TILE;
        this.renderer.zoom = this._zoomFit() * 2.0;
    }

    get isDone() { return this.beatIndex >= this.beats.length; }

    _place(p, pos) { p.x = pos.x; p.y = pos.y; p.vx = 0; p.vy = 0; }

    // -----------------------------------------------------------------------
    // Roteiro: { dur, enter?, update(k) }, k = progresso 0..1 do beat.
    // -----------------------------------------------------------------------
    _buildBeats() {
        const L = this._layout();
        const fit = () => this._zoomFit();

        this.beats = [
            // 0 — Zoom perto da porta; os dois entram na sala.
            {
                dur: 2.6,
                enter: () => {
                    this._place(this.p1, L.p1OutsideDoor);
                    this._place(this.p2, L.p2OutsideDoor);
                    this._express(this.p1, 'olhando_direita');
                    this._express(this.p2, 'olhando_esquerda');
                },
                update: (k) => {
                    const z = lerp(fit() * 2.0, fit() * 1.7, easeInOut(k));
                    this._camTo(this.doorWorld.x, this.doorWorld.y - TILE * 0.2, z, 0.14);
                    const w = easeInOut(clamp01(k / 0.85));
                    this._walkTo(this.p1, L.p1OutsideDoor, L.p1NearDoor, w);
                    this._walkTo(this.p2, L.p2OutsideDoor, L.p2NearDoor, w);
                    if (k > 0.5) {
                        this._express(this.p1, 'olhando_cima');
                        this._express(this.p2, 'desconfiado');
                    }
                }
            },

            // 1 — A serra NASCE no meio; espanto ali mesmo.
            {
                dur: 2.0,
                enter: () => {
                    this.saw.drop(this.center.x, this.center.y);
                    this.sawVisibleDropped = true;
                    this.sawCarried = false;
                    this.screenFlashT = 1;
                    this.renderer.triggerShake(10);
                    this._express(this.p1, 'espantado');
                    this._express(this.p2, 'espantado');
                },
                update: (k) => {
                    const z = lerp(fit() * 1.7, fit() * 1.3, easeInOut(k));
                    const cx = lerp(this.doorWorld.x, this.center.x, easeInOut(k));
                    const cy = lerp(this.doorWorld.y - TILE * 0.2, this.center.y + TILE * 0.7, easeInOut(k));
                    this._camTo(cx, cy, z, 0.1);
                    this._idle(this.p1);
                    this._idle(this.p2);
                    this.p1.facingLeft = false;
                    this.p2.facingLeft = true;
                    if (k > 0.6) {
                        this._express(this.p1, 'preocupado');
                        this._express(this.p2, 'preocupado');
                    }
                }
            },

            // 2 — Caminham até a serra e PEGAM ela; zoom forte na serra.
            {
                dur: 2.8,
                enter: () => {
                    this._express(this.p1, 'preocupado');
                    this._express(this.p2, 'preocupado');
                },
                update: (k) => {
                    const w = easeInOut(clamp01(k / 0.78));
                    this._walkTo(this.p1, L.p1NearDoor, L.p1AtSaw, w);
                    this._walkTo(this.p2, L.p2NearDoor, L.p2AtSaw, w);

                    const cy = lerp(this.center.y + TILE * 0.7, this.center.y + TILE * 0.3, easeInOut(k));
                    const z = lerp(fit() * 1.3, fit() * 2.8, easeInOut(k));
                    this._camTo(this.center.x, cy, z, 0.1);

                    if (k <= 0.55) {
                        this._express(this.p1, 'desconfiado');
                        this._express(this.p2, 'desconfiado');
                    }

                    // A serra largada desliza até o meio dos dois (sem salto
                    // quando a corda conecta).
                    const mid = this._playersMid();
                    const slide = easeInOut(clamp01((k - 0.4) / 0.38));
                    this.saw.dropX = lerp(this.center.x, mid.x, slide);
                    this.saw.dropY = lerp(this.center.y, mid.y, slide);

                    if (k > 0.55 && !this.sawCarried) {
                        this._calm(this.p1);
                        this._calm(this.p2);
                        this._faceSaw();
                        this._lookAtSaw();
                    }

                    if (k > 0.78 && !this.sawCarried) {
                        this.sawCarried = true;
                        this.sawVisibleDropped = false;
                        this.saw.pickup();
                        this._faceSaw();
                        this.renderer.triggerZoomPunch(0.04);
                        this._express(this.p1, 'neutro');
                        this._express(this.p2, 'neutro');
                        this._bothExpressFor('assustado', 0.6);
                        this.saw.spin = 0.4;
                        this.renderer.triggerShake(4);
                    }
                }
            },

            // 3 — Balão do VERMELHO.
            {
                dur: 2.6,
                enter: () => {
                    this._calm(this.p1);
                    this._calm(this.p2);
                    this._express(this.redPlayer, 'neutro');
                    this._express(this.bluePlayer, 'desconfiado');
                    this._speak(this.redPlayer, 'Olha como essa serra é afiada…', 2.4);
                },
                update: () => {
                    this._camTo(this.center.x, this.center.y + TILE * 0.35, fit() * 2.7, 0.08);
                    this._idle(this.p1);
                    this._idle(this.p2);
                    this._faceSaw();
                    this.saw.spin = lerp(this.saw.spin, 0.95, 0.12);
                    this.saw.rotation += 0.42;
                }
            },

            // 4 — Balão do AZUL: concorda.
            {
                dur: 2.4,
                enter: () => {
                    this._calm(this.p1);
                    this._calm(this.p2);
                    this._express(this.bluePlayer, 'neutro');
                    this._express(this.redPlayer, 'neutro');
                    this._speak(this.bluePlayer, 'Com certeza. Corta qualquer coisa!', 2.2);
                },
                update: () => {
                    this._camTo(this.center.x, this.center.y + TILE * 0.35, fit() * 2.6, 0.08);
                    this._idle(this.p1);
                    this._idle(this.p2);
                    this._faceSaw();
                    this.saw.spin = lerp(this.saw.spin, 0.9, 0.1);
                    this.saw.rotation += 0.4;
                }
            },

            // 4b/4c — CLOSE no rosto do vermelho e depois no do azul.
            this._faceCloseUp(this.redPlayer, ['desconfiado', 'raiva']),
            this._faceCloseUp(this.bluePlayer, ['olhos_fechados', 'furia']),

            // 5 — A sala TREME; espanto de novo.
            {
                dur: 2.2,
                enter: () => {
                    this.worldQuake = 1;
                    this.renderer.triggerShake(22);
                    this._express(this.p1, 'espantado');
                    this._express(this.p2, 'espantado');
                },
                update: (k) => {
                    const z = lerp(fit() * 2.6, fit() * 1.4, easeOut(k));
                    this._camTo(this.center.x, this.center.y, z, 0.1);
                    this._idle(this.p1);
                    this._idle(this.p2);
                    this.saw.spin = lerp(this.saw.spin, 0, 0.06);
                    if (k < 0.8 && this.renderer.screenShake < 6) this.renderer.triggerShake(14);
                    if (k > 0.5) {
                        this._express(this.p1, 'preocupado');
                        this._express(this.p2, 'preocupado');
                    }
                }
            },

            // 6 — Recuam devagar pela porta e somem na escuridão.
            {
                dur: 3.6,
                enter: () => {
                    this._faceFree();
                    this._express(this.p1, 'preocupado');
                    this._express(this.p2, 'preocupado');
                },
                update: (k) => {
                    const seg = k < 0.6
                        ? { a1: L.p1AtSaw, a2: L.p2AtSaw, b1: L.p1NearDoor, b2: L.p2NearDoor, kk: easeInOut(clamp01(k / 0.6)) }
                        : { a1: L.p1NearDoor, a2: L.p2NearDoor, b1: L.p1OutsideDoor, b2: L.p2OutsideDoor, kk: easeInOut(clamp01((k - 0.6) / 0.4)) };
                    this._walkTo(this.p1, seg.a1, seg.b1, seg.kk, 0.5);
                    this._walkTo(this.p2, seg.a2, seg.b2, seg.kk, 0.5);
                    if (k > 0.3 && k < 0.6) {
                        this._express(this.p1, 'olhando_cima');
                        this._express(this.p2, 'olhando_cima');
                    } else if (k >= 0.6) {
                        this._express(this.p1, 'preocupado');
                        this._express(this.p2, 'preocupado');
                    }
                    const z = lerp(fit() * 1.4, fit() * 2.1, easeIn(k));
                    this._camTo(this.doorWorld.x, this.doorWorld.y, z, 0.08);
                }
            }
        ];
    }

    // -----------------------------------------------------------------------
    // Helpers de movimento / estado dos jogadores
    // -----------------------------------------------------------------------

    // Move de `from` para `to` conforme t (0..1); a animação do passo é
    // dirigida por um relógio próprio em _gait (sem tremer com dt irregular).
    _walkTo(p, from, to, t, speedScale = 1) {
        const nx = lerp(from.x, to.x, t);
        const ny = lerp(from.y, to.y, t);
        const dx = nx - p.x, dy = ny - p.y;
        p.x = nx; p.y = ny;
        p._moving = Math.hypot(dx, dy) > 0.03;
        p._gaitScale = speedScale;
        if (!p._faceLock) {
            if (dx < -0.1) p.facingLeft = true;
            else if (dx > 0.1) p.facingLeft = false;
        }
    }
    _idle(p) { p._moving = false; p._gaitScale = 1; }
    _playersMid() { return { x: (this.p1.x + this.p2.x) / 2, y: (this.p1.y + this.p2.y) / 2 }; }

    // Vira os dois para a serra e trava o facing.
    _faceSaw() {
        this.p1.facingLeft = this.p1.x > this.center.x;
        this.p2.facingLeft = this.p2.x > this.center.x;
        this.p1._faceLock = this.p2._faceLock = true;
    }
    _faceFree() { this.p1._faceLock = this.p2._faceLock = false; }

    // Passo SUAVE: bob/tilt/walkFrame contínuos e contidos.
    _gait(p, dt) {
        const moving = !!p._moving;
        const scale = p._gaitScale ?? 1;
        const dirSign = p.facingLeft ? -1 : 1;
        const targetMag = moving ? p.speed * 0.20 * scale : 0;
        const targetVX = moving ? dirSign * p.speed * 0.04 : 0;
        p.vx += (targetVX - p.vx) * 0.12;
        p.vy += (-targetMag - p.vy) * 0.12;
        if (moving) p.walkFrame += 7.5 * scale * dt;
        else p.walkFrame = 0;
        p.bobPhase += (moving ? (3.2 + 2.0 * scale) : 0) * dt;
        const tiltTarget = moving ? dirSign * 0.04 : 0;
        p.tilt += (tiltTarget - p.tilt) * 0.08;
    }

    _calm(p) { p.scaredTimer = 0; p.expression = null; }

    // Olhar direcional para a serra (além do flip do sprite).
    _lookAtSaw() {
        this._express(this.p1, this.p1.x <= this.center.x ? 'olhando_direita' : 'olhando_esquerda');
        this._express(this.p2, this.p2.x <= this.center.x ? 'olhando_direita' : 'olhando_esquerda');
    }

    // Beat de CLOSE no rosto de `who` (troca exprs[0] -> exprs[1] no meio).
    _faceCloseUp(who, exprs, dur = 1.6) {
        const FACE_ZOOM = 5.0;
        const FACE_DY = -28;
        return {
            dur,
            enter: () => {
                this.stage.speech = null;
                this._express(who, exprs[0]);
                this.renderer.triggerZoomPunch(0.05);
            },
            update: (k) => {
                this._camTo(who.x, who.y + FACE_DY, this._zoomFit() * FACE_ZOOM, 0.18);
                this._idle(this.p1);
                this._idle(this.p2);
                this._faceSaw();
                if (k > 0.45) this._express(who, exprs[1]);
                this.saw.spin = lerp(this.saw.spin, 0.9, 0.1);
                this.saw.rotation += 0.4;
            }
        };
    }

    // -----------------------------------------------------------------------
    // Loop
    // -----------------------------------------------------------------------
    update(dt) {
        if (this.isDone) return;
        if (this.screenFlashT > 0) this.screenFlashT = Math.max(0, this.screenFlashT - dt * 2.2);
        if (this.worldQuake > 0) this.worldQuake = Math.max(0, this.worldQuake - dt * 0.6);

        const beat = this.beats[this.beatIndex];
        if (this.beatTime === 0 && beat.enter) beat.enter();
        this.beatTime += dt;
        beat.update?.(clamp01(this.beatTime / beat.dur));
        if (this.beatTime >= beat.dur) { this.beatIndex++; this.beatTime = 0; }

        this._gait(this.p1, dt);
        this._gait(this.p2, dt);
        this.wind.update(this.bounds);
        this.stage.tickFog(dt);

        if (this.sawCarried && this.chainReveal < 1) {
            this.chainReveal = Math.min(1, this.chainReveal + dt / 0.45);
        }
        if (this.sawCarried) this.saw.update(this.p1, this.p2);
        else if (this.sawVisibleDropped) this.saw.updateDropped();
    }

    render() {
        const { ctx, renderer } = this;
        renderer.beginFrame();
        renderer.drawBackground(BACKGROUND_TILE, TILE);

        // Tremor da sala: desloca o MUNDO inteiro.
        const quake = this.worldQuake > 0 ? this.worldQuake * 6 : 0;
        const qx = quake ? (Math.random() - 0.5) * 2 * quake : 0;
        const qy = quake ? (Math.random() - 0.5) * 2 * quake : 0;
        ctx.save();
        ctx.translate(qx, qy);
        this._worldTf = ctx.getTransform(); // p/ redesenhar a serra por cima

        const stub = DOOR_STUB_TILES * TILE;
        ctx.save();
        ctx.beginPath();
        ctx.rect(-stub, -stub, this.rect.w + stub * 2, this.rect.h + stub * 2);
        ctx.clip();

        renderer.drawRoom(this.rect, this.bounds, this.tiles, TILE, true, this.doorList, this.doorHalf);
        renderer.drawDoorStubs(this.rect, this.doorList, TILE, this.doorHalf, DOOR_STUB_TILES);
        renderer.drawDoorGradients(this.doorList, this.doorHalf, TILE, DOOR_STUB_TILES);

        renderer.drawRoundShadow(this.p1.x, this.p1.y, 14, 0);
        renderer.drawRoundShadow(this.p2.x, this.p2.y, 14, 0);

        // Corda (fade-in + pulso de luz na conexão).
        if (this.sawCarried) {
            const rev = this.chainReveal;
            ctx.save();
            ctx.globalAlpha = rev;
            this.saw.drawChain(ctx, this.p1, this.p2);
            ctx.restore();
            if (rev < 1) this._drawChainConnectPulse(ctx, rev);
        }

        // Jogadores por profundidade (o disco vem depois, por cima de tudo).
        [this.p1, this.p2].sort((a, b) => a.y - b.y).forEach(e => e.draw(ctx));

        renderer.drawFrontWall(this.rect, this.tiles, TILE, true, this.doorList, this.doorHalf, DOOR_STUB_TILES);
        this.wind.draw(ctx);

        ctx.restore(); // clip
        ctx.restore(); // tremor
        renderer.endFrame();

        this._renderLights();
        this.postProcessor.draw();

        this.stage._drawFog();
        this._drawSawOnTop();
        this._drawFlash();
        this.stage.drawSpeech();
        this._drawEndFade();
    }

    // Disco da serra DEPOIS da luz/névoa, com o transform do mundo do quadro.
    _drawSawOnTop() {
        if (!this._worldTf || (!this.sawCarried && !this.sawVisibleDropped)) return;
        const { ctx } = this;
        ctx.save();
        ctx.setTransform(this._worldTf);
        if (this.sawCarried) {
            this.stage._drawSawGlow(ctx, this.saw.getSawPositions(this.p1, this.p2)[0]);
            this.saw.draw(ctx, this.p1, this.p2);
        } else {
            this.stage._drawSawGlow(ctx, { x: this.saw.dropX, y: this.saw.dropY });
            this.saw.drawDropped(ctx);
        }
        ctx.restore();
    }

    _drawFlash() {
        if (this.screenFlashT <= 0) return;
        const { ctx, canvas } = this;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(255,255,255,${0.6 * this.screenFlashT})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }

    // Fade para o preto na reta final; terminada a cena, mostra o título
    // (a próxima cena começa exatamente nessa cartela: sem corte).
    _drawEndFade() {
        const last = this.beats.length - 1;
        let a = 0;
        if (this.beatIndex > last) a = 1;
        else if (this.beatIndex === last) {
            const k = clamp01(this.beatTime / this.beats[last].dur);
            a = easeIn(clamp01((k - 0.55) / 0.45));
        }
        if (a <= 0) return;
        const { ctx, canvas } = this;
        ctx.save();
        ctx.fillStyle = `rgba(3, 2, 8, ${a})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
        if (this.beatIndex > last) this.stage.drawTitleText();
    }

    // Luzes do quadro (jogadores, tochas, serra), escurecidas por SPOT_DIM.
    _renderLights() {
        const pp = this.postProcessor;
        const r = this.renderer;
        const dim = this.SPOT_DIM;
        const lightPixel = (zoom, scale = LIGHT_PIXEL_SCALE) =>
            Math.max(2, Math.round((TILE / 16) * zoom * scale));
        const dimProfile = (base) => ({
            ...base,
            falloff: base.falloff.map(s => ({ offset: s.offset, alpha: s.alpha * dim }))
        });

        const playerProfile = dimProfile({
            color: '255, 220, 150',
            falloff: [
                { offset: 0.0, alpha: 1.0 }, { offset: 0.25, alpha: 0.6 },
                { offset: 0.45, alpha: 0.35 }, { offset: 0.65, alpha: 0.17 },
                { offset: 1.0, alpha: 0.0 }
            ]
        });
        for (const p of [this.p1, this.p2]) {
            const s = r.worldToScreen(p.x, p.y);
            pp.addLight(s.x, s.y, PLAYER_LIGHT_RADIUS * s.zoom, lightPixel(s.zoom), 1, playerProfile);
        }

        if (TORCHES.enabled && this.tiles.torches?.length) {
            const tl = TORCHES.light;
            const area = tl.area;
            const glowProfile = dimProfile({ ...tl, falloff: tl.glow.falloff });
            const areaProfile = dimProfile({ ...tl, falloff: area.falloff });
            for (const t of this.tiles.torches) {
                let wx = t.col * TILE + TILE / 2;
                let wy = t.row * TILE + TILE / 2;
                let adx = 0, ady = 0;
                if (t.side === 'N') { wy += tl.offsetY; ady = area.pushIn; }
                else if (t.side === 'S') { wy -= tl.offsetY; ady = -area.pushIn; }
                else if (t.side === 'W') { wx += tl.offsetX; adx = area.pushIn; }
                else if (t.side === 'E') { wx -= tl.offsetX; adx = -area.pushIn; }
                const s = r.worldToScreen(wx, wy);
                const px = lightPixel(s.zoom, tl.pixelScale);
                pp.addLight(s.x, s.y, tl.glow.radius * s.zoom, px, tl.glow.flatten, glowProfile);
                const ac = r.worldToScreen(wx + adx, wy + ady);
                pp.addLight(ac.x, ac.y, area.radius * s.zoom, px, area.flatten, areaProfile);
            }
        }

        const bladeProfile = dimProfile(BLADE_LIGHT_PROFILE);
        if (this.sawCarried) {
            const sp = this.saw.getSawPositions(this.p1, this.p2)[0];
            const s = r.worldToScreen(sp.x, sp.y);
            pp.addLight(s.x, s.y, (60 + (this.saw.spin ?? 0) * 18) * s.zoom, lightPixel(s.zoom), 1, bladeProfile);
        } else if (this.sawVisibleDropped) {
            const s = r.worldToScreen(this.saw.dropX, this.saw.dropY);
            const breathe = 0.85 + (this.saw.dropHover ?? 0) * 0.15;
            pp.addLight(s.x, s.y, 150 * breathe * s.zoom, lightPixel(s.zoom), 1, bladeProfile);
        }
    }

    // Pulso de luz que corre do meio da corda até os dois na conexão.
    _drawChainConnectPulse(ctx, rev) {
        const saw = this.saw;
        const spread = easeOut(rev);
        const glow = Math.sin(rev * Math.PI);
        if (glow <= 0.01) return;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineWidth = 7;
        ctx.strokeStyle = `rgba(200, 225, 255, ${0.9 * glow})`;
        ctx.shadowColor = 'rgba(170, 205, 255, 0.9)';
        ctx.shadowBlur = 14 * glow;
        const drawSeg = (fromT, toT) => {
            ctx.beginPath();
            for (let i = 0; i <= 20; i++) {
                const pt = saw.cablePoint(this.p1, this.p2, lerp(fromT, toT, i / 20));
                if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
            }
            ctx.stroke();
        };
        drawSeg(0.5, 0.5 - 0.5 * spread);
        drawSeg(0.5, 0.5 + 0.5 * spread);
        const mid = saw.cablePoint(this.p1, this.p2, 0.5);
        ctx.beginPath();
        ctx.fillStyle = `rgba(230, 240, 255, ${0.8 * glow})`;
        ctx.arc(mid.x, mid.y, 10 + 10 * glow, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}
