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
import { PostProcessor } from './systems/PostProcessor.js';
import { LightingRenderer } from './systems/LightingRenderer.js';
import { WindSystem } from './systems/WindSystem.js';
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
        this._decorateRoom();

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

        // --- Iluminação (reuso do pipeline do jogo) ---
        // PostProcessor: ambiente escuro + halos de luz + vinheta. LightingRenderer
        // monta as luzes (jogadores, tochas, serra azul, wash) a cada frame.
        this.postProcessor = new PostProcessor(canvas, this.ctx);
        this.lighting = new LightingRenderer({ renderer: this.renderer, postProcessor: this.postProcessor });

        // Adaptador mínimo que o LightingRenderer espera no lugar da Chain:
        // expõe isConnected, weapon e getDroppedLight(). Assim ganhamos a luz
        // azul-aço da serra (ativa e largada) de graça.
        const self = this; // referência estável para os getters abaixo
        this.chainLike = {
            get isConnected() { return self.sawCarried; },
            get weapon() { return self.saw; },
            getDroppedLight: () => {
                if (!self.sawVisibleDropped) return null;
                return { x: self.saw.dropX, y: self.saw.dropY, hover: self.saw.dropHover ?? 0 };
            }
        };

        // --- Névoa / poeira ambiente (clima misterioso) ---
        this.wind = new WindSystem();

        // --- Estado da cena ---
        this.sawVisibleDropped = false; // true quando a serra está "nascida" no chão
        this.sawCarried = false;        // true quando os jogadores a pegaram (corda ligada)
        this.sawDropWorld = { x: this.center.x, y: this.center.y };

        this.speech = null;   // { who, text, t, dur } balão de fala ativo
        this.screenFlashT = 0; // 0..1 clarão branco (nascimento da serra)
        this.worldQuake = 0;   // intensidade do tremor da sala (px)
        this.chainReveal = 0;  // 0..1 transição da corda ao conectar aos jogadores

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

    // Decora a sala do trailer: TOCHAS nas paredes (o Renderer anima pelos
    // sprites de assets.torchSprites conforme t.side/t.type) e PROPS no piso
    // (índices do tileset desenhados pelo Renderer em tiles.props).
    _decorateRoom() {
        const last = ROOM_COLS - 1;
        const bottom = ROOM_ROWS - 1;

        // Tochas de PAREDE. IMPORTANTE: tochas laterais ficam na PRIMEIRA
        // coluna de PISO à frente da parede (col 1 à esquerda, col last-1 à
        // direita) — não dentro da coluna de parede (col 0/last), senão o
        // sprite fica escondido atrás do tile sólido. É o mesmo padrão das
        // peças do jogo (ver map/*.json: side "W" em col 1, side "E" em col 12).
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

        // Props decorativos no piso (encostados nas paredes, longe do vão da
        // porta e do centro onde a serra nasce). Índices de PROP_SCATTER.tiles.
        this.tiles.props = [
            { col: 2, row: 2, index: 59 },
            { col: last - 2, row: 2, index: 68 },
            { col: 2, row: bottom - 2, index: 64 },
            { col: last - 2, row: bottom - 2, index: 77 },
            { col: 4, row: 3, index: 64 },
            { col: last - 4, row: 3, index: 59 }
        ];
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
        this.chainReveal = 0;
        this.saw.spin = 0;
        this.saw.rotation = 0;
        this._fogPhase = 0;
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
            //          Os jogadores REAGEM com ESPANTO ali mesmo (perto da porta),
            //          sem corte: congelam e encaram a serra.
            // ----------------------------------------------------------------
            {
                dur: 2.0,
                enter: () => {
                    // A serra passa a existir, caída no centro (estado "dropped"),
                    // com o pop de queda e o feixe de luz varrendo (drawDropped).
                    this.saw.drop(this.center.x, this.center.y);
                    this.sawVisibleDropped = true;
                    this.sawCarried = false;
                    this.screenFlashT = 1; // clarão branco no nascimento
                    this.renderer.triggerShake(10);
                    // Reação imediata: sprite de ESPANTO (continuam onde estão).
                    this._startle(this.p1);
                    this._startle(this.p2);
                },
                update: (k) => {
                    // Câmera desliza da porta para o MEIO da sala, afastando um pouco
                    // para revelar a serra nascendo (sem corte seco).
                    const z = lerp(fit() * 1.7, fit() * 1.3, easeInOut(k));
                    const cx = lerp(this.doorWorld.x, this.center.x, easeInOut(k));
                    const cy = lerp(this.doorWorld.y - TILE * 0.2, this.center.y + TILE * 0.7, easeInOut(k));
                    this._camTo(cx, cy, z, 0.1);
                    // Parados, assustados, encarando a serra.
                    this._idle(this.p1);
                    this._idle(this.p2);
                    this._keepStartled(this.p1);
                    this._keepStartled(this.p2);
                    this.p1.facingLeft = false;
                    this.p2.facingLeft = true;
                }
            },

            // ----------------------------------------------------------------
            // BEAT 2 — CAMINHAM (sem corte) da porta até perto da serra e PEGAM
            //          ela; câmera acompanha e dá um zoom BEM FORTE na serra.
            // ----------------------------------------------------------------
            {
                dur: 2.8,
                enter: () => {
                    this._keepStartled(this.p1);
                    this._keepStartled(this.p2);
                },
                update: (k) => {
                    // Trajeto contínuo: de onde pararam (perto da porta) até a serra.
                    const w = easeInOut(clamp01(k / 0.78));
                    this._walkTo(this.p1, L.p1NearDoor, L.p1AtSaw, w, 'toCenter');
                    this._walkTo(this.p2, L.p2NearDoor, L.p2AtSaw, w, 'toCenter');

                    // Câmera acompanha a aproximação com zoom crescente e FORTE na
                    // serra (bem mais perto do que antes).
                    const cy = lerp(this.center.y + TILE * 0.7, this.center.y + TILE * 0.3, easeInOut(k));
                    const z = lerp(fit() * 1.3, fit() * 2.8, easeInOut(k));
                    this._camTo(this.center.x, cy, z, 0.1);

                    // Perto da serra deixam de ficar assustados (curiosidade vence).
                    if (k > 0.6) { this._calm(this.p1); this._calm(this.p2); }

                    // Ao chegar, PEGAM a serra: a corda liga os dois (com transição)
                    // e o disco passa a ser carregado entre eles.
                    if (k > 0.78 && !this.sawCarried) {
                        this.sawCarried = true;
                        this.sawVisibleDropped = false;
                        this.saw.pickup();
                        this.renderer.triggerZoomPunch(0.05);
                        this.renderer.triggerShake(5);
                    }
                }
            },

            // ----------------------------------------------------------------
            // BEAT 3 — Balão do VERMELHO: comenta o quão afiada é a serra.
            //          Enquadramento fechado (zoom forte) na serra entre os dois.
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
                    this._camTo(this.center.x, this.center.y + TILE * 0.35, this._zoomFit() * 2.7, 0.08);
                    this._idle(this.p1);
                    this._idle(this.p2);
                    this.p1.facingLeft = false;
                    this.p2.facingLeft = true;
                    // Serra GIRA a toda (feedback de "afiada"): spin acima de
                    // BLEND_HI (0.6) para engatar o SPRITE DE GIRO; rotação real
                    // acelerada para o disco rodar visível.
                    this.saw.spin = lerp(this.saw.spin, 0.95, 0.12);
                    this.saw.rotation += 0.42;
                }
            },

            // ----------------------------------------------------------------
            // BEAT 4 — Balão do AZUL: concorda.
            // ----------------------------------------------------------------
            {
                dur: 2.4,
                enter: () => {
                    this._calm(this.p1);
                    this._calm(this.p2);
                    this._speak(this.bluePlayer, 'Com certeza. Corta qualquer coisa!', 2.2);
                },
                update: () => {
                    this._camTo(this.center.x, this.center.y + TILE * 0.35, this._zoomFit() * 2.6, 0.08);
                    this._idle(this.p1);
                    this._idle(this.p2);
                    this.p1.facingLeft = false;
                    this.p2.facingLeft = true;
                    // Mantém o giro a toda (sprite de giro) durante a concordância.
                    this.saw.spin = lerp(this.saw.spin, 0.9, 0.1);
                    this.saw.rotation += 0.4;
                }
            },

            // ----------------------------------------------------------------
            // BEAT 5 — A sala toda TREME; o sprite de espanto toca novamente.
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
                    // Afasta para mostrar a sala toda tremendo (vinha do zoom
                    // fechado da fala; recua suave).
                    const z = lerp(this._zoomFit() * 2.6, this._zoomFit() * 1.4, easeOut(k));
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
            // BEAT 6 — Recuam DEVAGAR até a porta enquanto a câmera dá zoom;
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

    // Move o jogador de `from` para `to` conforme t (0..1) e anima o passo de
    // forma SUAVE. A animação (bobPhase/tilt/walkFrame) é dirigida por um
    // relógio contínuo próprio (_gaitPhase) e NÃO pelo deslocamento bruto por
    // frame — assim o personagem não "treme" quando o dt varia. A velocidade
    // real (vx/vy) é apenas uma dica amortecida para a serra reagir, mantida
    // pequena para o bob (que depende de speedMag/speed) ficar discreto.
    // speedScale modula o ritmo do passo (devagar < 1).
    _walkTo(p, from, to, t, dir = 'up', speedScale = 1) {
        const nx = lerp(from.x, to.x, t);
        const ny = lerp(from.y, to.y, t);
        const dx = nx - p.x, dy = ny - p.y;
        p.x = nx; p.y = ny;

        const moving = Math.hypot(dx, dy) > 0.03;
        p._moving = moving;
        p._gaitScale = speedScale;

        // Encaramento horizontal: segue o movimento lateral (com limiar).
        if (dx < -0.1) p.facingLeft = true;
        else if (dx > 0.1) p.facingLeft = false;
    }

    _idle(p) {
        p._moving = false;
        p._gaitScale = 1;
    }

    // Avança a animação de caminhada SUAVE de um jogador (chamado todo frame no
    // update, com dt real). Mantém bobPhase/tilt/walkFrame contínuos e com
    // amplitude contida, e amortece vx/vy para o bob (speedMag/speed) ser leve.
    _gait(p, dt) {
        const moving = !!p._moving;
        const scale = p._gaitScale ?? 1;

        // "Velocidade aparente" bem baixa: ~20% da velocidade máxima quando
        // andando. Como o bob/tilt do Player escalam por speedMag/speed, isso
        // deixa o balanço SUAVE (sem tranco). A cena anda na vertical, então
        // injetamos a magnitude no eixo Y; o X fica num valor pequeno coerente
        // com o lado para onde encara (dá um tilt leve, sem solavanco).
        const dirSign = p.facingLeft ? -1 : 1;
        const targetMag = moving ? p.speed * 0.20 * scale : 0;
        const targetVX = moving ? dirSign * p.speed * 0.04 : 0;
        const targetVY = -targetMag;
        p.vx += (targetVX - p.vx) * 0.12;
        p.vy += (targetVY - p.vy) * 0.12;

        // Relógio de passo contínuo (independe de dt irregular): avança em
        // "passos por segundo" fixos, escalado pela velocidade da cena.
        const stepsPerSec = 7.5 * scale;
        if (moving) {
            p.walkFrame += stepsPerSec * dt;
        } else {
            p.walkFrame = 0; // pose parada
        }

        // Bob/tilt próprios, suaves e contínuos. bobPhase avança devagar; o tilt
        // persegue um alvo pequeno. (No jogo isso vive em Player.update, que
        // aqui não roda, então replicamos de forma mais branda.)
        p.bobPhase += (moving ? (3.2 + 2.0 * scale) : 0) * dt;
        const tiltTarget = moving ? dirSign * 0.04 : 0;
        p.tilt += (tiltTarget - p.tilt) * 0.08;
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

        // Máquina de beats (define posição/estado dos jogadores neste frame).
        const beat = this.beats[this.beatIndex];
        if (beat) {
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

        // Animação SUAVE de caminhada (depois dos beats definirem _moving).
        this._gait(this.p1, dt);
        this._gait(this.p2, dt);

        // Névoa/poeira ambiente (atravessa a sala, revelada pela luz).
        this.wind.update(this.bounds);

        // Camadas de névoa atmosférica (bancos de fumaça lentos). Avança a fase.
        this._fogPhase = (this._fogPhase ?? 0) + dt * 0.06;

        // Transição da corda: cresce de 0->1 quando a serra é conectada.
        if (this.sawCarried && this.chainReveal < 1) {
            this.chainReveal = Math.min(1, this.chainReveal + dt / 0.45);
        }

        // Serra: estado carregada (gira com o movimento) ou largada (bob + luz).
        if (this.sawCarried) {
            this.saw.update(this.p1, this.p2);
        } else if (this.sawVisibleDropped) {
            this.saw.updateDropped();
        }
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

        // Corda (quando a serra está sendo carregada), sempre ao fundo. Na
        // CONEXÃO, a corda surge com uma transição: cresce em alpha e dá um
        // pulso de luz branca correndo entre os jogadores (ela "liga").
        if (this.sawCarried) {
            const rev = this.chainReveal;
            ctx.save();
            ctx.globalAlpha = rev; // fade-in da corda
            this.saw.drawChain(ctx, this.p1, this.p2);
            ctx.restore();
            if (rev < 1) this._drawChainConnectPulse(ctx, rev);
        }

        // Ordenação por profundidade pelo Y (como o jogo).
        const sawY = this.sawCarried
            ? this.saw.getSawPositions(this.p1, this.p2)[0].y
            : this.sawDropWorld.y;
        const drawables = [this.p1, this.p2].sort((a, b) => a.y - b.y);

        drawables.filter(e => e.y <= sawY).forEach(e => e.draw(ctx));

        // Disco da serra: carregada (entre os dois) ou largada no chão (nasce).
        if (this.sawCarried) {
            // Brilho AZUL em volta do disco (reforça a luz fria da serra),
            // pulsando com o giro — desenhado atrás do disco, aditivo.
            this._drawSawGlow(ctx, this.saw.getSawPositions(this.p1, this.p2)[0]);
            this.saw.draw(ctx, this.p1, this.p2);
        } else if (this.sawVisibleDropped) {
            this._drawSawGlow(ctx, { x: this.saw.dropX, y: this.saw.dropY });
            this.saw.drawDropped(ctx);
        }

        drawables.filter(e => e.y > sawY).forEach(e => e.draw(ctx));

        // Parede frontal por cima (quem encosta na base fica "atrás").
        renderer.drawFrontWall(this.rect, this.tiles, TILE, true, this.doorList, this.doorHalf, DOOR_STUB_TILES);

        // Poeira/vento no MUNDO (dentro do clip): a luz das tochas/jogadores a
        // revela, deixando o ar "vivo".
        this.wind.draw(ctx);

        ctx.restore(); // fim do clip da sala
        ctx.restore(); // fim do tremor

        renderer.endFrame();

        // --- ILUMINAÇÃO (pipeline do jogo) em espaço de TELA ---
        // Monta as luzes do quadro e compõe o mapa de luz + vinheta sobre a cena.
        const sawPos = (this.sawCarried && this.saw)
            ? this.saw.getSawPositions(this.p1, this.p2)[0]
            : null;
        this.lighting.render({
            players: [this.p1, this.p2],
            chain: this.chainLike,
            sawPos,
            arenaBounds: this.bounds,
            tiles: this.tiles,
            rect: this.rect,
            doors: this.doorList,
            doorHalf: this.doorHalf,
            open: true,
            doorFlashT: 0
        });
        this.postProcessor.draw();

        // --- Overlays em espaço de TELA (após a iluminação) ---
        this._drawFog();        // névoa atmosférica (bancos de fumaça)
        this._drawFlash();      // clarão do nascimento da serra
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

    // Névoa atmosférica: bancos de fumaça suaves derivando pela tela, por cima
    // da iluminação (a vinheta já vem do PostProcessor). Vários blobs radiais
    // azul-arroxeados, lentos, de baixa opacidade — dão o ar "misterioso" sem
    // esconder a cena. Posições derivam de senoides defasadas (determinístico).
    _drawFog() {
        const { ctx, canvas } = this;
        const w = canvas.width, h = canvas.height;
        const ph = this._fogPhase ?? 0;

        // Camada 1: banco baixo (chão), mais denso. Camada 2: véu alto, tênue.
        const banks = [
            { cy: h * 0.82, r: h * 0.55, color: '70, 60, 95', base: 0.16, n: 4, speed: 1.0, drift: w * 0.5 },
            { cy: h * 0.35, r: h * 0.45, color: '60, 70, 110', base: 0.08, n: 3, speed: 0.6, drift: w * 0.6 }
        ];

        ctx.save();
        ctx.globalCompositeOperation = 'screen'; // névoa clareia de leve (não some no escuro)
        for (const bank of banks) {
            for (let i = 0; i < bank.n; i++) {
                // Posição horizontal derivando devagar em loop (vai e volta).
                const phase = ph * bank.speed + (i / bank.n) * Math.PI * 2;
                const cx = w * 0.5 + Math.sin(phase) * bank.drift;
                const cy = bank.cy + Math.cos(phase * 0.7) * (h * 0.05);
                // Opacidade pulsando devagar (respiração da névoa).
                const a = bank.base * (0.6 + 0.4 * (0.5 + 0.5 * Math.sin(phase * 1.3)));
                const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, bank.r);
                g.addColorStop(0, `rgba(${bank.color}, ${a})`);
                g.addColorStop(0.6, `rgba(${bank.color}, ${a * 0.4})`);
                g.addColorStop(1, `rgba(${bank.color}, 0)`);
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, w, h);
            }
        }
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

    // Brilho AZUL-AÇO em volta do disco da serra (no MUNDO, aditivo). Intensifica
    // com o giro — casa com a luz fria que o LightingRenderer já emite da lâmina.
    _drawSawGlow(ctx, pos) {
        if (!pos) return;
        const spin = this.saw.spin ?? 0;
        const r = (this.saw.discRadius ?? 32);
        const intensity = 0.35 + spin * 0.5; // base + reforço com o giro
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        // Halo externo difuso.
        const g = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, r * 1.9);
        g.addColorStop(0, `rgba(150, 196, 255, ${0.5 * intensity})`);
        g.addColorStop(0.5, `rgba(120, 170, 255, ${0.22 * intensity})`);
        g.addColorStop(1, 'rgba(120, 170, 255, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r * 1.9, 0, Math.PI * 2);
        ctx.fill();
        // Núcleo mais intenso bem no disco.
        ctx.fillStyle = `rgba(210, 230, 255, ${0.3 * intensity})`;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Pulso de luz da CONEXÃO da corda: um brilho branco-azulado que parte do
    // meio (onde está a serra) e corre para os dois jogadores conforme a corda
    // se revela (rev 0..1). Dá a sensação de a corda "ligar" os dois.
    _drawChainConnectPulse(ctx, rev) {
        const saw = this.saw;
        // Extensão do brilho a partir do meio (t=0.5) rumo às pontas (0 e 1).
        const spread = easeOut(rev);          // cresce rápido no começo
        const glow = Math.sin(rev * Math.PI); // acende e apaga (pico no meio)
        if (glow <= 0.01) return;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineWidth = 7;
        ctx.strokeStyle = `rgba(200, 225, 255, ${0.9 * glow})`;
        ctx.shadowColor = 'rgba(170, 205, 255, 0.9)';
        ctx.shadowBlur = 14 * glow;

        // Dois segmentos: do meio para P1 e do meio para P2.
        const drawSeg = (fromT, toT) => {
            ctx.beginPath();
            const steps = 20;
            for (let i = 0; i <= steps; i++) {
                const t = lerp(fromT, toT, i / steps);
                const pt = saw.cablePoint(this.p1, this.p2, t);
                if (i === 0) ctx.moveTo(pt.x, pt.y);
                else ctx.lineTo(pt.x, pt.y);
            }
            ctx.stroke();
        };
        drawSeg(0.5, 0.5 - 0.5 * spread); // meio -> P1
        drawSeg(0.5, 0.5 + 0.5 * spread); // meio -> P2

        // Clarão na própria serra no auge da conexão.
        const mid = saw.cablePoint(this.p1, this.p2, 0.5);
        ctx.beginPath();
        ctx.fillStyle = `rgba(230, 240, 255, ${0.8 * glow})`;
        ctx.arc(mid.x, mid.y, 10 + 10 * glow, 0, Math.PI * 2);
        ctx.fill();
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
