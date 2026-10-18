/**
 * trailer.js — SIMULADOR DE GAMEPLAY (cutscene scriptada) para o trailer.
 *
 * Não roda o Game inteiro: monta um bootstrap paralelo reusando os sistemas de
 * render do jogo (Renderer, Tileset, RoomTiles, Player, SawWeapon) e executa
 * uma CENA roteirizada por "beats" (sequência de passos com duração), movendo
 * câmera, jogadores e a serra de forma determinística — como um diretor.
 *
 * CENA 1 (pedido do roteiro):
 *   1. Os dois jogadores SAEM por uma porta entrando na sala; a câmera dá um
 *      zoom BEM PERTO da porta por onde eles saem.
 *   2. A câmera vai para o MEIO e a SERRA NASCE com um efeito "drop" + luz
 *      passando por ela.
 *   3. Corta para os dois jogadores com o sprite de ESPANTO.
 *   4. Eles chegam perto da serra e PEGAM ela; a câmera chega bem perto.
 *   5. Balão de fala do VERMELHO (comenta o quão afiada é a serra); vai pro
 *      AZUL e ele concorda.
 *   6. A sala toda TREME e o sprite de espanto toca novamente.
 *   7. Eles se aproximam da porta DEVAGAR enquanto a câmera dá zoom; ambos
 *      entram pela porta lentamente, sumindo na ESCURIDÃO.
 */

import { AssetLoader } from './core/AssetLoader.js';
import { Renderer } from './core/Renderer.js';
import { Tileset } from './core/Tileset.js';
import { RoomTiles } from './core/RoomTiles.js';
import { Player } from './entities/Player.js';
import { SawWeapon } from './weapons/SawWeapon.js';
import { playerConfigs } from './config/EntityConfig.js';
import { TILE, ROOM_COLS, ROOM_ROWS, BACKGROUND_TILE, DOOR_STUB_TILES } from './config/GameConfig.js';

// ---------------------------------------------------------------------------
// Utilidades de animação
// ---------------------------------------------------------------------------

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, t) => a + (b - a) * t;
// Easings (game feel): suaves no início/fim.
const easeInOut = (t) => t * t * (3 - 2 * t);         // smoothstep
const easeOut = (t) => 1 - Math.pow(1 - t, 3);        // easeOutCubic
const easeIn = (t) => t * t * t;                       // easeInCubic

// ---------------------------------------------------------------------------
// Cena do trailer
// ---------------------------------------------------------------------------

class TrailerScene {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;

        this._resize();
        window.addEventListener('resize', () => this._resize());

        // --- Assets e render ---
        this.assets = new AssetLoader();
        this.renderer = new Renderer(canvas, this.ctx);
        this.renderer.setTileset(new Tileset(this.assets.tileset, 16, 10));
        this.renderer.setAssets(this.assets);
        this.renderer.setTileWorldSize(TILE);

        // --- Sala do trailer: porta S (base), de frente para a câmera ---
        this.doors = { N: false, S: true, E: false, W: false };
        this.tiles = new RoomTiles(ROOM_COLS, ROOM_ROWS, this.doors, 1, true);

        // Retângulo da célula no mundo (origem 0,0).
        this.rect = { x: 0, y: 0, w: ROOM_COLS * TILE, h: ROOM_ROWS * TILE };
        this.bounds = {
            minX: this.rect.x + TILE,
            minY: this.rect.y + TILE,
            maxX: this.rect.x + this.rect.w - TILE,
            maxY: this.rect.y + this.rect.h - TILE
        };
        this.doorHalf = TILE; // vão de 2 tiles -> meia-largura = 1 tile

        // Geometria da porta S no mundo (centro do vão, borda inferior interna).
        const midC = (ROOM_COLS / 2) | 0;
        this.doorWorld = {
            dir: 'S',
            x: this.rect.x + midC * TILE,
            y: this.rect.y + this.rect.h - TILE  // borda interna (linha jogável)
        };
        this.doorList = [{ dir: 'S', x: this.doorWorld.x, y: this.rect.y + this.rect.h }];

        // Centro da sala (onde a serra nasce).
        this.center = {
            x: this.rect.x + this.rect.w / 2,
            y: this.rect.y + this.rect.h / 2 - TILE * 0.3
        };

        // --- Jogadores (reuso da config do jogo) ---
        const cfgs = playerConfigs(this.assets);
        // P1 = Amarelo (controls só decorativo aqui), P2 = Azul.
        this.p1 = new Player(0, 0, cfgs[0].color, cfgs[0].controls, cfgs[0].img, cfgs[0].name, cfgs[0].sprite);
        this.p2 = new Player(0, 0, cfgs[1].color, cfgs[1].controls, cfgs[1].img, cfgs[1].name, cfgs[1].sprite);
        // No roteiro, "vermelho" = P1. Como o P1 é amarelo no jogo, mantemos o
        // mapeamento vermelho->P1 (quem fala primeiro) e azul->P2.
        this.redPlayer = this.p1;
        this.bluePlayer = this.p2;

        // --- Serra ---
        this.saw = new SawWeapon(this.assets.saw, this.assets.cable);

        // --- Estado da cena ---
        this.sawVisibleDropped = false; // true quando a serra está "nascida" no chão
        this.sawCarried = false;        // true quando os jogadores a pegaram (corda ligada)
        this.sawDropWorld = { x: this.center.x, y: this.center.y };

        this.speech = null;   // { who, text, t, dur } balão de fala ativo
        this.screenFlashT = 0; // 0..1 clarão branco (nascimento da serra)
        this.worldQuake = 0;   // intensidade do tremor da sala (px)

        this.time = 0;         // tempo acumulado da cena (s)
        this.beatIndex = 0;    // beat atual
        this.beatTime = 0;     // tempo dentro do beat atual (s)

        this._buildBeats();
        this.reset();
    }

    _resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.ctx.imageSmoothingEnabled = false;
    }

    // Posições-chave da cena (em coordenadas de mundo).
    _layout() {
        const d = this.doorWorld;
        return {
            // Fora da sala, logo abaixo da porta (os jogadores "entram" por aqui).
            p1OutsideDoor: { x: d.x - TILE * 0.6, y: d.y + TILE * 1.9 },
            p2OutsideDoor: { x: d.x + TILE * 0.6, y: d.y + TILE * 1.9 },
            // Logo depois de cruzar a porta, ainda perto dela.
            p1NearDoor: { x: d.x - TILE * 0.75, y: d.y - TILE * 0.4 },
            p2NearDoor: { x: d.x + TILE * 0.75, y: d.y - TILE * 0.4 },
            // Posição de espanto (recuaram um pouco ao ver a serra).
            p1Startled: { x: this.center.x - TILE * 2.1, y: this.center.y + TILE * 1.9 },
            p2Startled: { x: this.center.x + TILE * 2.1, y: this.center.y + TILE * 1.9 },
            // Perto da serra (para pegá-la), um de cada lado.
            p1AtSaw: { x: this.center.x - TILE * 1.25, y: this.center.y + TILE * 0.7 },
            p2AtSaw: { x: this.center.x + TILE * 1.25, y: this.center.y + TILE * 0.7 }
        };
    }

    reset() {
        this.time = 0;
        this.beatIndex = 0;
        this.beatTime = 0;
        this.speech = null;
        this.screenFlashT = 0;
        this.worldQuake = 0;
        this.sawVisibleDropped = false;
        this.sawCarried = false;
        this.renderer.setIntroZoomFactor(1);
        this.renderer.resetSway();

        const L = this._layout();
        // Jogadores começam FORA da sala, abaixo da porta, virados para cima.
        this._place(this.p1, L.p1OutsideDoor);
        this._place(this.p2, L.p2OutsideDoor);
        this.p1.facingLeft = false;
        this.p2.facingLeft = false;

        // Câmera começa com zoom BEM PERTO da porta (onde a cena abre).
        this.renderer.camX = this.doorWorld.x;
        this.renderer.camY = this.doorWorld.y - TILE;
        this.renderer.zoom = this._zoomFit() * 2.0;
    }

    _place(p, pos) { p.x = pos.x; p.y = pos.y; p.vx = 0; p.vy = 0; }

    // Zoom que faz a sala caber na tela (como o jogo faz).
    _zoomFit() {
        const margin = 90;
        return Math.min(
            this.canvas.width / (this.rect.w + margin * 2),
            this.canvas.height / (this.rect.h + margin * 2)
        );
    }

    // -----------------------------------------------------------------------
    // Roteiro: lista de beats. Cada beat tem { dur, enter?, update(k) }.
    //   k = progresso 0..1 dentro do beat.
    // -----------------------------------------------------------------------
    _buildBeats() {
        const L = this._layout();
        const fit = () => this._zoomFit();

        this.beats = [
            // ----------------------------------------------------------------
            // BEAT 0 — Zoom BEM PERTO da porta; os dois SAEM e entram na sala.
            // ----------------------------------------------------------------
            {
                dur: 2.6,
                enter: () => {
                    this._place(this.p1, L.p1OutsideDoor);
                    this._place(this.p2, L.p2OutsideDoor);
                },
                update: (k) => {
                    // Câmera cravada perto da porta, com um leve recuo ao longo do beat.
                    const z = lerp(fit() * 2.0, fit() * 1.7, easeInOut(k));
                    this._camTo(this.doorWorld.x, this.doorWorld.y - TILE * 0.2, z, 0.14);

                    // Caminham de fora -> perto da porta (atravessando o vão).
                    const w = easeInOut(clamp01(k / 0.85));
                    this._walkTo(this.p1, L.p1OutsideDoor, L.p1NearDoor, w, 'up');
                    this._walkTo(this.p2, L.p2OutsideDoor, L.p2NearDoor, w, 'up');
                }
            },

            // ----------------------------------------------------------------
            // BEAT 1 — Câmera vai para o MEIO; a SERRA NASCE (drop + luz + clarão).
            // ----------------------------------------------------------------
            {
                dur: 2.2,
                enter: () => {
                    // A serra passa a existir, caída no centro (estado "dropped"),
                    // com o pop de queda e o feixe de luz varrendo (drawDropped).
                    this.saw.drop(this.center.x, this.center.y);
                    this.sawVisibleDropped = true;
                    this.sawCarried = false;
                    this.screenFlashT = 1; // clarão branco no nascimento
                    this.renderer.triggerShake(10);
                },
                update: (k) => {
                    // Câmera desliza da porta para o MEIO da sala, afastando um pouco.
                    const z = lerp(fit() * 1.7, fit() * 1.25, easeInOut(k));
                    const cx = lerp(this.doorWorld.x, this.center.x, easeInOut(k));
                    const cy = lerp(this.doorWorld.y - TILE * 0.2, this.center.y, easeInOut(k));
                    this._camTo(cx, cy, z, 0.12);
                    // Jogadores parados perto da porta (ainda sem reação).
                    this._idle(this.p1);
                    this._idle(this.p2);
                }
            },

            // ----------------------------------------------------------------
            // BEAT 2 — CORTE para os jogadores com o sprite de ESPANTO.
            // ----------------------------------------------------------------
            {
                dur: 1.8,
                enter: () => {
                    // Reposiciona (corte) um pouco mais afastados, encarando a serra.
                    this._place(this.p1, L.p1Startled);
                    this._place(this.p2, L.p2Startled);
                    this._startle(this.p1);
                    this._startle(this.p2);
                    // Corte seco de câmera: enquadra os dois com a serra ao fundo.
                    const z = fit() * 1.5;
                    this.renderer.zoom = z;
                    this.renderer.camX = this.center.x;
                    this.renderer.camY = this.center.y + TILE * 1.0;
                },
                update: (k) => {
                    this._camTo(this.center.x, this.center.y + TILE * 1.0, fit() * 1.5, 0.1);
                    this._idle(this.p1);
                    this._idle(this.p2);
                    this._keepStartled(this.p1);
                    this._keepStartled(this.p2);
                    // Encaram a serra (viram-se para o centro).
                    this.p1.facingLeft = false;
                    this.p2.facingLeft = true;
                }
            },

            // ----------------------------------------------------------------
            // BEAT 3 — Chegam perto da serra e PEGAM ela; câmera chega bem perto.
            // ----------------------------------------------------------------
            {
                dur: 2.4,
                enter: () => {
                    this._keepStartled(this.p1);
                    this._keepStartled(this.p2);
                },
                update: (k) => {
                    const w = easeInOut(clamp01(k / 0.7));
                    // Curiosos: mantêm o espanto no começo e vão perdendo ao se
                    // aproximarem (o scared decai sozinho conforme o timer cai).
                    this._walkTo(this.p1, L.p1Startled, L.p1AtSaw, w, 'toCenter');
                    this._walkTo(this.p2, L.p2Startled, L.p2AtSaw, w, 'toCenter');

                    // Câmera aproxima bem perto da serra.
                    const z = lerp(fit() * 1.5, fit() * 2.15, easeInOut(k));
                    this._camTo(this.center.x, this.center.y + TILE * 0.4, z, 0.12);

                    // Ao chegar perto (fim do trajeto), PEGAM a serra: a corda liga
                    // os dois e o disco passa a ser carregado entre eles.
                    if (k > 0.72 && !this.sawCarried) {
                        this.sawCarried = true;
                        this.sawVisibleDropped = false;
                        this.saw.pickup();
                        this.renderer.triggerZoomPunch(0.05);
                        this.renderer.triggerShake(5);
                    }
                }
            },

            // ----------------------------------------------------------------
            // BEAT 4 — Balão do VERMELHO: comenta o quão afiada é a serra.
            // ----------------------------------------------------------------
            {
                dur: 2.6,
                enter: () => {
                    // Já pegaram a serra: cara normal (fim do espanto) para falar.
                    this._calm(this.p1);
                    this._calm(this.p2);
                    this._speak(this.redPlayer, 'Olha como essa serra é afiada…', 2.4);
                },
                update: () => {
                    this._camTo(this.center.x, this.center.y + TILE * 0.4, this._zoomFit() * 2.15, 0.1);
                    this._idle(this.p1);
                    this._idle(this.p2);
                    this.p1.facingLeft = false;
                    this.p2.facingLeft = true;
                    // Serra gira devagar nas mãos deles (feedback de "afiada").
                    this.saw.spin = lerp(this.saw.spin, 0.5, 0.08);
                    this.saw.rotation += 0.18;
                }
            },

            // ----------------------------------------------------------------
            // BEAT 5 — Balão do AZUL: concorda.
            // ----------------------------------------------------------------
            {
                dur: 2.4,
                enter: () => {
                    this._calm(this.p1);
                    this._calm(this.p2);
                    this._speak(this.bluePlayer, 'Com certeza. Corta qualquer coisa!', 2.2);
                },
                update: () => {
                    this._camTo(this.center.x, this.center.y + TILE * 0.4, this._zoomFit() * 2.1, 0.1);
                    this._idle(this.p1);
                    this._idle(this.p2);
                    this.saw.spin = lerp(this.saw.spin, 0.35, 0.08);
                    this.saw.rotation += 0.14;
                }
            },

            // ----------------------------------------------------------------
            // BEAT 6 — A sala toda TREME; o sprite de espanto toca novamente.
            // ----------------------------------------------------------------
            {
                dur: 2.2,
                enter: () => {
                    this.worldQuake = 1;        // tremor forte decaindo
                    this.renderer.triggerShake(22);
                    this._startle(this.p1);
                    this._startle(this.p2);
                },
                update: (k) => {
                    // Afasta um pouco para mostrar a sala toda tremendo.
                    const z = lerp(this._zoomFit() * 2.1, this._zoomFit() * 1.4, easeOut(k));
                    this._camTo(this.center.x, this.center.y, z, 0.1);
                    this._idle(this.p1);
                    this._idle(this.p2);
                    this._keepStartled(this.p1);
                    this._keepStartled(this.p2);
                    // Serra desacelera (eles param de girar, assustados).
                    this.saw.spin = lerp(this.saw.spin, 0, 0.06);
                    // Mantém o tremor pulsando durante o beat.
                    if (k < 0.8 && this.renderer.screenShake < 6) this.renderer.triggerShake(14);
                }
            },

            // ----------------------------------------------------------------
            // BEAT 7 — Recuam DEVAGAR até a porta enquanto a câmera dá zoom;
            //          ambos entram pela porta e SOMEM na escuridão (fade).
            // ----------------------------------------------------------------
            {
                dur: 3.6,
                enter: () => {
                    this._keepStartled(this.p1);
                    this._keepStartled(this.p2);
                },
                update: (k) => {
                    // Trajeto lento em dois trechos: da serra -> perto da porta
                    // (até k=0.6) e depois cruzando a porta -> fora, na escuridão.
                    const seg = k < 0.6
                        ? { a1: L.p1AtSaw, a2: L.p2AtSaw, b1: L.p1NearDoor, b2: L.p2NearDoor, kk: easeInOut(clamp01(k / 0.6)) }
                        : { a1: L.p1NearDoor, a2: L.p2NearDoor, b1: L.p1OutsideDoor, b2: L.p2OutsideDoor, kk: easeInOut(clamp01((k - 0.6) / 0.4)) };
                    // Devagar: velocidade do passo reduzida (fator menor).
                    this._walkTo(this.p1, seg.a1, seg.b1, seg.kk, 'down', 0.5);
                    this._walkTo(this.p2, seg.a2, seg.b2, seg.kk, 'down', 0.5);

                    // Câmera dá zoom aproximando na porta conforme eles somem.
                    const z = lerp(this._zoomFit() * 1.4, this._zoomFit() * 2.1, easeIn(k));
                    this._camTo(this.doorWorld.x, this.doorWorld.y, z, 0.08);
                }
            }
        ];

        this.totalDuration = this.beats.reduce((s, b) => s + b.dur, 0);
    }

    // -----------------------------------------------------------------------
    // Helpers de movimentação / estado dos jogadores
    // -----------------------------------------------------------------------

    // Move o jogador de `from` para `to` conforme t (0..1) e anima o passo.
    // dir define a direção de encaramento ('up'/'down'/'toCenter'); speedScale
    // modula a velocidade da animação de passo (devagar < 1).
    _walkTo(p, from, to, t, dir = 'up', speedScale = 1) {
        const nx = lerp(from.x, to.x, t);
        const ny = lerp(from.y, to.y, t);
        const dx = nx - p.x, dy = ny - p.y;
        p.x = nx; p.y = ny;
        // Velocidade aparente (para a serra e a animação reagirem ao movimento).
        p.vx = dx; p.vy = dy;
        const moving = Math.hypot(dx, dy) > 0.05;
        if (moving) {
            p.walkFrame += (1.1 * speedScale);
            // Encaramento horizontal: segue o movimento lateral.
            if (dx < -0.1) p.facingLeft = true;
            else if (dx > 0.1) p.facingLeft = false;
        }
        // speedMag é derivado de vx/vy (getter), então o sprite de passo liga/desliga sozinho.
    }

    _idle(p) {
        p.vx = 0; p.vy = 0;
        p.walkFrame = 0; // pose parada (frame 0)
    }

    // Dispara/mantém o sprite de ESPANTO (scared). resolveSprite usa a folha
    // "scared" enquanto scaredTimer > 0 e hurtTimer === 0. Usamos um valor alto
    // (em frames) e reforçamos a cada frame com _keepStartled enquanto o beat
    // de espanto durar; ao sair dele (ex.: beat de fala) o timer é zerado.
    _startle(p) {
        p.hurtTimer = 0;
        p.scaredTimer = 600;
    }
    _keepStartled(p) {
        p.scaredTimer = 600; // reforça todo frame -> some assim que paramos de chamar
    }
    _calm(p) {
        p.scaredTimer = 0;   // volta ao sprite normal (fim do espanto)
    }

    // Balão de fala sobre a cabeça do jogador.
    _speak(who, text, dur) {
        this.speech = { who, text, t: 0, dur };
    }

    // Interpola a câmera manualmente (sem clamp de sala, para liberdade cênica).
    _camTo(x, y, zoom, lerpK = 0.12) {
        this.renderer.camX += (x - this.renderer.camX) * lerpK;
        this.renderer.camY += (y - this.renderer.camY) * lerpK;
        this.renderer.zoom += (zoom - this.renderer.zoom) * (lerpK * 0.8);
    }

    // -----------------------------------------------------------------------
    // Loop: avança o roteiro e desenha.
    // -----------------------------------------------------------------------

    update(dt) {
        // Avança timers visuais.
        if (this.screenFlashT > 0) this.screenFlashT = Math.max(0, this.screenFlashT - dt * 2.2);
        if (this.worldQuake > 0) this.worldQuake = Math.max(0, this.worldQuake - dt * 0.6);
        if (this.speech) {
            this.speech.t += dt;
            if (this.speech.t >= this.speech.dur) this.speech = null;
        }

        // Serra: estado carregada (gira com o movimento) ou largada (bob + luz).
        if (this.sawCarried) {
            this.saw.update(this.p1, this.p2);
        } else if (this.sawVisibleDropped) {
            this.saw.updateDropped();
        }

        // Máquina de beats.
        const beat = this.beats[this.beatIndex];
        if (!beat) return; // cena terminou (segura o último quadro)

        if (this.beatTime === 0 && beat.enter) beat.enter();
        this.beatTime += dt;
        const k = clamp01(this.beatTime / beat.dur);
        if (beat.update) beat.update(k);

        if (this.beatTime >= beat.dur) {
            this.beatIndex++;
            this.beatTime = 0;
        }
        this.time += dt;
    }

    render() {
        const { ctx, renderer } = this;

        renderer.beginFrame();
        renderer.drawBackground(BACKGROUND_TILE, TILE);

        // Tremor da sala: desloca o MUNDO (não a câmera) um pouco, para a sala
        // "chacoalhar" por inteiro. Aplicado como translate temporário.
        const quake = this.worldQuake > 0 ? this.worldQuake * 6 : 0;
        const qx = quake ? (Math.random() - 0.5) * 2 * quake : 0;
        const qy = quake ? (Math.random() - 0.5) * 2 * quake : 0;
        ctx.save();
        ctx.translate(qx, qy);

        // Clip ao retângulo da sala (+ margem dos stubs), como no jogo.
        const stubMargin = DOOR_STUB_TILES * TILE;
        ctx.save();
        ctx.beginPath();
        ctx.rect(this.rect.x - stubMargin, this.rect.y - stubMargin,
            this.rect.w + stubMargin * 2, this.rect.h + stubMargin * 2);
        ctx.clip();

        // Sala + portas abertas.
        renderer.drawRoom(this.rect, this.bounds, this.tiles, TILE, true, this.doorList, this.doorHalf);
        renderer.drawDoorStubs(this.rect, this.doorList, TILE, this.doorHalf, DOOR_STUB_TILES);
        renderer.drawDoorGradients(this.doorList, this.doorHalf, TILE, DOOR_STUB_TILES);

        // Sombras no chão (jogadores + serra largada).
        renderer.drawRoundShadow(this.p1.x, this.p1.y, 14, 0);
        renderer.drawRoundShadow(this.p2.x, this.p2.y, 14, 0);

        // Corda (quando a serra está sendo carregada), sempre ao fundo.
        if (this.sawCarried) this.saw.drawChain(ctx, this.p1, this.p2);

        // Ordenação por profundidade pelo Y (como o jogo).
        const sawY = this.sawCarried
            ? this.saw.getSawPositions(this.p1, this.p2)[0].y
            : this.sawDropWorld.y;
        const drawables = [this.p1, this.p2].sort((a, b) => a.y - b.y);

        drawables.filter(e => e.y <= sawY).forEach(e => e.draw(ctx));

        // Disco da serra: carregada (entre os dois) ou largada no chão (nasce).
        if (this.sawCarried) {
            this.saw.draw(ctx, this.p1, this.p2);
        } else if (this.sawVisibleDropped) {
            this.saw.drawDropped(ctx);
        }

        drawables.filter(e => e.y > sawY).forEach(e => e.draw(ctx));

        // Parede frontal por cima (quem encosta na base fica "atrás").
        renderer.drawFrontWall(this.rect, this.tiles, TILE, true, this.doorList, this.doorHalf, DOOR_STUB_TILES);

        ctx.restore(); // fim do clip da sala
        ctx.restore(); // fim do tremor

        renderer.endFrame();

        // --- Overlays em espaço de TELA (após o mundo) ---
        this._drawFlash();
        this._drawVignette();
        this._drawSpeech();
        this._drawLetterbox();
        this._drawEndFade();
    }

    // Clarão branco do nascimento da serra.
    _drawFlash() {
        if (this.screenFlashT <= 0) return;
        const { ctx, canvas } = this;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(255,255,255,${0.6 * this.screenFlashT})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }

    // Vinheta de masmorra (escurece as bordas).
    _drawVignette() {
        const { ctx, canvas } = this;
        const g = ctx.createRadialGradient(
            canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) * 0.3,
            canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * 0.75
        );
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, 'rgba(0,0,0,0.72)');
        ctx.save();
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }

    // Barras pretas de cinema (letterbox) para dar cara de trailer.
    _drawLetterbox() {
        const { ctx, canvas } = this;
        const barH = Math.round(canvas.height * 0.10);
        ctx.save();
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, barH);
        ctx.fillRect(0, canvas.height - barH, canvas.width, barH);
        ctx.restore();
    }

    // Balão de fala sobre a cabeça do personagem que fala.
    _drawSpeech() {
        if (!this.speech) return;
        const { ctx, renderer } = this;
        const who = this.speech.who;

        // Posição de tela acima da cabeça (sprite centrado em y, ~73px de altura
        // no mundo -> topo ~ y - 46). worldToScreen aplica o zoom quantizado.
        const headWorldY = who.y - 46;
        const scr = renderer.worldToScreen(who.x, headWorldY);

        // Animação de entrada do balão (pop + fade nos primeiros 0.18s).
        const inK = easeOut(clamp01(this.speech.t / 0.18));
        const outK = this.speech.t > this.speech.dur - 0.2
            ? clamp01((this.speech.dur - this.speech.t) / 0.2) : 1;
        const alpha = inK * outK;
        const scale = lerp(0.8, 1, inK);

        const text = this.speech.text;
        ctx.save();
        ctx.font = 'bold 20px monospace';
        const padX = 16, padY = 11;
        const metrics = ctx.measureText(text);
        const w = metrics.width + padX * 2;
        const h = 20 + padY * 2;
        const bx = scr.x - w / 2;
        const by = scr.y - h - 14;

        ctx.globalAlpha = alpha;
        ctx.translate(scr.x, by + h);
        ctx.scale(scale, scale);
        ctx.translate(-scr.x, -(by + h));

        // Balão (retângulo arredondado) na cor do personagem.
        const color = who.color || '#fffffe';
        this._roundRect(ctx, bx, by, w, h, 10);
        ctx.fillStyle = 'rgba(16, 14, 24, 0.92)';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = color;
        ctx.stroke();

        // Rabicho apontando para a cabeça.
        ctx.beginPath();
        ctx.moveTo(scr.x - 9, by + h - 1);
        ctx.lineTo(scr.x + 9, by + h - 1);
        ctx.lineTo(scr.x, by + h + 13);
        ctx.closePath();
        ctx.fillStyle = 'rgba(16, 14, 24, 0.92)';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Texto.
        ctx.fillStyle = '#fffffe';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, scr.x, by + h / 2 + 1);
        ctx.restore();
    }

    _roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    // Fade final para o preto (os jogadores somem na escuridão da porta).
    _drawEndFade() {
        const lastIndex = this.beats.length - 1;
        let a = 0;
        if (this.beatIndex > lastIndex) {
            a = 1; // cena terminou: tela preta
        } else if (this.beatIndex === lastIndex) {
            // No último beat, escurece gradualmente na reta final.
            const k = clamp01(this.beatTime / this.beats[lastIndex].dur);
            a = easeIn(clamp01((k - 0.55) / 0.45));
        }
        if (a <= 0) return;
        const { ctx, canvas } = this;
        ctx.save();
        ctx.fillStyle = `rgba(3, 2, 8, ${a})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (this.beatIndex > lastIndex) {
            // Cartela final simples.
            ctx.fillStyle = '#fffffe';
            ctx.font = 'bold 42px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('DUNGEON CHAINED', canvas.width / 2, canvas.height / 2 - 6);
            ctx.fillStyle = '#a7a9be';
            ctx.font = '16px monospace';
            ctx.fillText('acorrentados no calabouço', canvas.width / 2, canvas.height / 2 + 26);
        }
        ctx.restore();
    }
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

async function bootstrap() {
    const canvas = document.getElementById('trailerCanvas');
    const scene = new TrailerScene(canvas);

    await scene.assets.whenReady();

    // Esconde a tela de carregamento.
    const loading = document.getElementById('trailer-loading');
    if (loading) loading.style.display = 'none';

    // Botão de repetir a cena.
    const replay = document.getElementById('btn-replay');
    if (replay) replay.addEventListener('click', () => scene.reset());
    // Clicar/espaço também repete.
    window.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') scene.reset();
    });

    // Loop de render com dt limitado (tempo real), independente da taxa do monitor.
    let last = performance.now();
    function frame(now) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        scene.update(dt);
        scene.render();
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}

bootstrap();
