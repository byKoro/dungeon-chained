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
 *   5b. Fim da conversa: CLOSE no rosto do VERMELHO e depois no do AZUL.
 *   6. A câmera recua, a sala toda TREME e o sprite de espanto toca novamente.
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
import { WindSystem } from './systems/WindSystem.js';
import { playerConfigs } from './config/EntityConfig.js';
import { renderSpeechBubble } from './ui/SpeechBubble.js';
import { BloodScreen } from './trailer/BloodScreen.js';
import { FrenzyScene } from './trailer/FrenzyScene.js';

// Linha do tempo da CENA 2 (segundos). title: a partir da cartela preta;
// frenzyDur/outroFade: a partir da revelação do frenesi.
const SEQUEL_TIMING = {
    flickerStart: 2.0,  // cartela parada antes de começar a piscar
    sprayStart: 2.6,    // primeiras gotas de sangue
    sprayFull: 4.6,     // tela totalmente coberta
    drainStart: 5.0,    // sangue começa a escorrer e revela o frenesi
    frenzyDur: 10.0,    // duração do frenesi
    outroFade: 1.2      // fade final para a cartela
};

// Hash determinístico 0..1 (estroboscópio do pisca vermelho).
const hash01 = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// Pixel do balão = esta fração do pixel de arte do jogo (1 = mesma escala).
const BUBBLE_PIXEL_RATIO = 0.5;
import {
    TILE, ROOM_COLS, ROOM_ROWS, BACKGROUND_TILE, DOOR_STUB_TILES,
    PLAYER_LIGHT_RADIUS, LIGHT_PIXEL_SCALE, TORCHES
} from './config/GameConfig.js';

// Expressões faciais dos jogadores (spritesheets de 8 frames, mesmo layout do
// player_walk.png). Carregadas SÓ no trailer e injetadas em sprite.expressions;
// o jogo não é afetado. As chaves batem com os arquivos em
// assets/player_0X/expressions/<nome>.png.
const TRAILER_EXPRESSIONS = [
    'neutro', 'assustado', 'espantado', 'raiva', 'furia', 'preocupado',
    'desconfiado', 'olhando_esquerda', 'olhando_direita', 'olhando_cima',
    'olhos_fechados'
];

// Perfil de luz AZUL-AÇO da serra (mesma cor do jogo), para o trailer montar a
// luz da lâmina localmente (com escurecimento próprio).
const BLADE_LIGHT_PROFILE = {
    color: '150, 196, 255',
    flickerBase: 1, flickerSine: 0.05, flickerNoise: 0.02,
    falloff: [
        { offset: 0.0, alpha: 0.9 },
        { offset: 0.3, alpha: 0.5 },
        { offset: 0.55, alpha: 0.26 },
        { offset: 0.78, alpha: 0.1 },
        { offset: 1.0, alpha: 0.0 }
    ]
};

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

        // --- Expressões (olhos/sobrancelhas) geradas por tools/gen_expressions.py ---
        // Mesmo layout da folha de caminhada; troca via this._express(p, nome).
        for (const [p, dir] of [[this.p1, 'player_01'], [this.p2, 'player_02']]) {
            const s = p.sprite;
            s.expressions = {};
            for (const name of TRAILER_EXPRESSIONS) {
                s.expressions[name] = {
                    img: this.assets.load(`${dir}_expr_${name}`, `assets/${dir}/expressions/${name}.png`),
                    frameCount: s.frameCount, cellSize: s.cellSize,
                    cropX: s.cropX, cropY: s.cropY, cropW: s.cropW, cropH: s.cropH
                };
            }
        }

        // --- Serra ---
        this.saw = new SawWeapon(this.assets.saw, this.assets.cable);

        // --- Iluminação (reuso do PostProcessor do jogo) ---
        // PostProcessor: ambiente escuro + halos de luz + vinheta. As luzes
        // (jogadores, tochas, serra azul) são montadas em _renderLights() a cada
        // frame, com brilho escurecido pelo SPOT_DIM — tudo isolado no trailer.
        //
        // IMPORTANTE: estes overrides valem SÓ no trailer (passados ao
        // construtor, não ao config global) — o jogo continua intacto. Deixam
        // os spots de luz mais ESCUROS: ambiente mais sombrio + luzes menos
        // intensas (flickerBase menor reduz o brilho das elipses).
        // Overrides SÓ do trailer (passados ao construtor; o config global do
        // jogo fica intacto). Ambiente mais escuro + vinheta mais fechada deixam
        // a cena mais sombria. O brilho dos SPOTS em si é escurecido no montador
        // de luzes local (_renderLights), via SPOT_DIM.
        this.postProcessor = new PostProcessor(canvas, this.ctx, {
            lighting: { ambient: '30, 26, 40' }, // era 41,35,53
            vignette: { strength: 0.8 }          // era 0.7
        });

        // Fator de escurecimento dos spots (tochas, jogadores, serra). 1 = cheio;
        // < 1 escurece. Vive só no trailer.
        this.SPOT_DIM = 0.6;

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

        // --- Cena 2: transição de sangue + frenesi ---
        this.bloodScreen = new BloodScreen(canvas);
        this.frenzy = new FrenzyScene(this);

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
            // Perto da serra (para pegá-la), um de cada lado e NA MESMA ALTURA
            // do centro: assim o MEIO da corda (cablePoint 0.5) cai exatamente
            // onde a serra estava largada (this.center), sem o disco "teleportar"
            // ao conectar. Ligeiramente abaixo (0.15) para ficarem de frente p/ ela.
            p1AtSaw: { x: this.center.x - TILE * 1.15, y: this.center.y + TILE * 0.15 },
            p2AtSaw: { x: this.center.x + TILE * 1.15, y: this.center.y + TILE * 0.15 }
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
        this.saw.dragX = this.saw.dragY = 0;
        this._fogPhase = 0;
        // Cena 2 (cartela -> sangue -> frenesi) volta ao início.
        this.phase = 'scene1';
        this.phaseT = 0;
        this.bloodScreen?.reset();
        this.frenzy?.reset();
        this.renderer.screenShake = 0;
        this.renderer.setIntroZoomFactor(1);
        this.renderer.resetSway();

        const L = this._layout();
        // Jogadores começam FORA da sala, abaixo da porta, virados para cima.
        this._place(this.p1, L.p1OutsideDoor);
        this._place(this.p2, L.p2OutsideDoor);
        this.p1.facingLeft = false;
        this.p2.facingLeft = false;
        this._faceFree(); // destrava o facing (importante ao repetir a cena)
        // Zera expressões (ao repetir a cena, começa limpo).
        for (const p of [this.p1, this.p2]) {
            p.expression = null;
            p._exprBase = null;
            p._exprTimer = 0;
            p.scaredTimer = 0;
            p.hurtTimer = 0;
        }

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
                    // Entram cautelosos, olhando para a sala escura (cada um para
                    // um lado) — exploram o ambiente antes de avançar.
                    this._express(this.p1, 'olhando_direita');
                    this._express(this.p2, 'olhando_esquerda');
                },
                update: (k) => {
                    // Câmera cravada perto da porta, com um leve recuo ao longo do beat.
                    const z = lerp(fit() * 2.0, fit() * 1.7, easeInOut(k));
                    this._camTo(this.doorWorld.x, this.doorWorld.y - TILE * 0.2, z, 0.14);

                    // Caminham de fora -> perto da porta (atravessando o vão).
                    const w = easeInOut(clamp01(k / 0.85));
                    this._walkTo(this.p1, L.p1OutsideDoor, L.p1NearDoor, w, 'up');
                    this._walkTo(this.p2, L.p2OutsideDoor, L.p2NearDoor, w, 'up');

                    // Já dentro, olham para FRENTE/CIMA (encaram o interior) e
                    // ficam desconfiados com o lugar.
                    if (k > 0.5) {
                        this._express(this.p1, 'olhando_cima');
                        this._express(this.p2, 'desconfiado');
                    }
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
                    // Reação imediata ao ver a serra nascer: ESPANTO (boca/olhos
                    // arregalados). A expressão tem prioridade sobre o "scared".
                    this._express(this.p1, 'espantado');
                    this._express(this.p2, 'espantado');
                },
                update: (k) => {
                    // Câmera desliza da porta para o MEIO da sala, afastando um pouco
                    // para revelar a serra nascendo (sem corte seco).
                    const z = lerp(fit() * 1.7, fit() * 1.3, easeInOut(k));
                    const cx = lerp(this.doorWorld.x, this.center.x, easeInOut(k));
                    const cy = lerp(this.doorWorld.y - TILE * 0.2, this.center.y + TILE * 0.7, easeInOut(k));
                    this._camTo(cx, cy, z, 0.1);
                    // Parados, espantados, encarando a serra.
                    this._idle(this.p1);
                    this._idle(this.p2);
                    this.p1.facingLeft = false;
                    this.p2.facingLeft = true;
                    // Depois do susto inicial, a tensão vira apreensão (preocupado).
                    if (k > 0.6) {
                        this._express(this.p1, 'preocupado');
                        this._express(this.p2, 'preocupado');
                    }
                }
            },

            // ----------------------------------------------------------------
            // BEAT 2 — CAMINHAM (sem corte) da porta até perto da serra e PEGAM
            //          ela; câmera acompanha e dá um zoom BEM FORTE na serra.
            // ----------------------------------------------------------------
            {
                dur: 2.8,
                enter: () => {
                    // Começam o avanço ainda apreensivos (herdam 'preocupado').
                    this._express(this.p1, 'preocupado');
                    this._express(this.p2, 'preocupado');
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

                    // Aproximam-se CAUTELOSOS (desconfiados da serra misteriosa).
                    if (k <= 0.55) {
                        this._express(this.p1, 'desconfiado');
                        this._express(this.p2, 'desconfiado');
                    }

                    // TELEPORTE SUAVE: enquanto se aproximam, a serra largada
                    // DESLIZA do centro até o MEIO dos dois jogadores. Assim,
                    // quando a corda conecta, o disco (meio da corda) já está
                    // exatamente onde a serra estava — sem salto.
                    const mid = this._playersMid();
                    const slide = easeInOut(clamp01((k - 0.4) / 0.38)); // começa na 2ª metade
                    this.saw.dropX = lerp(this.center.x, mid.x, slide);
                    this.saw.dropY = lerp(this.center.y, mid.y, slide);

                    // Perto da serra (e ANTES de pegá-la): VIRAM-SE PARA ELA
                    // (flip do sprite + olhar DIRECIONAL olhando_esquerda/direita).
                    // Trava o facing para o passo não revirá-los. Depois de pegar
                    // (sawCarried) paramos de forçar o olhar, para não sobrescrever
                    // o SUSTO da conexão no frame seguinte.
                    if (k > 0.55 && !this.sawCarried) {
                        this._calm(this.p1);
                        this._calm(this.p2);
                        this._faceSaw();
                        this._lookAtSaw();
                    }

                    // Ao chegar, PEGAM a serra: a corda liga os dois (transição da
                    // corda) e o disco passa a ser carregado. Como o disco já foi
                    // deslizado até o meio deles, a troca é CONTÍNUA (sem teleporte).
                    if (k > 0.78 && !this.sawCarried) {
                        this.sawCarried = true;
                        this.sawVisibleDropped = false;
                        this.saw.pickup();
                        this._faceSaw();
                        this.renderer.triggerZoomPunch(0.04);
                        // LEVE SUSTO no instante em que a serra conecta e começa a
                        // girar: expressão "assustado" por um instante, volta ao
                        // normal (neutro) sozinha. Pulsinho de câmera + micro-shake.
                        this._express(this.p1, 'neutro');
                        this._express(this.p2, 'neutro');
                        this._bothExpressFor('assustado', 0.6);
                        this.saw.spin = 0.4;                 // engata o giro de leve
                        this.renderer.triggerShake(4);
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
                    // Passado o susto: VERMELHO admira a serra (neutro, falando);
                    // AZUL observa a lâmina com desconfiança.
                    this._calm(this.p1);
                    this._calm(this.p2);
                    this._express(this.redPlayer, 'neutro');
                    this._express(this.bluePlayer, 'desconfiado');
                    this._speak(this.redPlayer, 'Olha como essa serra é afiada…', 2.4);
                },
                update: () => {
                    this._camTo(this.center.x, this.center.y + TILE * 0.35, this._zoomFit() * 2.7, 0.08);
                    this._idle(this.p1);
                    this._idle(this.p2);
                    this._faceSaw(); // encaram a serra que seguram
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
                    // AZUL concorda empolgado (neutro); VERMELHO acompanha o giro.
                    this._express(this.bluePlayer, 'neutro');
                    this._express(this.redPlayer, 'neutro');
                    this._speak(this.bluePlayer, 'Com certeza. Corta qualquer coisa!', 2.2);
                },
                update: () => {
                    this._camTo(this.center.x, this.center.y + TILE * 0.35, this._zoomFit() * 2.6, 0.08);
                    this._idle(this.p1);
                    this._idle(this.p2);
                    this._faceSaw(); // seguem encarando a serra
                    // Mantém o giro a toda (sprite de giro) durante a concordância.
                    this.saw.spin = lerp(this.saw.spin, 0.9, 0.1);
                    this.saw.rotation += 0.4;
                }
            },

            // ----------------------------------------------------------------
            // BEAT 4b/4c — Fim da conversa: CLOSE no rosto do VERMELHO e depois
            //              no do AZUL (troca de olhares antes do tremor).
            // ----------------------------------------------------------------
            this._faceCloseUp(this.redPlayer, ['desconfiado', 'raiva']),
            this._faceCloseUp(this.bluePlayer, ['olhos_fechados', 'furia']),

            // ----------------------------------------------------------------
            // BEAT 5 — A sala toda TREME; o sprite de espanto toca novamente.
            // ----------------------------------------------------------------
            {
                dur: 2.2,
                enter: () => {
                    this.worldQuake = 1;        // tremor forte decaindo
                    this.renderer.triggerShake(22);
                    // A sala treme: ESPANTO novamente (olhos arregalados).
                    this._express(this.p1, 'espantado');
                    this._express(this.p2, 'espantado');
                },
                update: (k) => {
                    // Afasta para mostrar a sala toda tremendo (vinha do zoom
                    // fechado da fala; recua suave).
                    const z = lerp(this._zoomFit() * 2.6, this._zoomFit() * 1.4, easeOut(k));
                    this._camTo(this.center.x, this.center.y, z, 0.1);
                    this._idle(this.p1);
                    this._idle(this.p2);
                    // Serra desacelera (eles param de girar, assustados).
                    this.saw.spin = lerp(this.saw.spin, 0, 0.06);
                    // Mantém o tremor pulsando durante o beat.
                    if (k < 0.8 && this.renderer.screenShake < 6) this.renderer.triggerShake(14);
                    // Passado o baque inicial, viram apreensão (preocupado) —
                    // preparando a retirada.
                    if (k > 0.5) {
                        this._express(this.p1, 'preocupado');
                        this._express(this.p2, 'preocupado');
                    }
                }
            },

            // ----------------------------------------------------------------
            // BEAT 6 — Recuam DEVAGAR até a porta enquanto a câmera dá zoom;
            //          ambos entram pela porta e SOMEM na escuridão (fade).
            // ----------------------------------------------------------------
            {
                dur: 3.6,
                enter: () => {
                    this._faceFree(); // ao recuar, voltam a virar conforme o movimento
                    // Recuam AMEDRONTADOS (herdam 'preocupado' do beat anterior).
                    this._express(this.p1, 'preocupado');
                    this._express(this.p2, 'preocupado');
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

                    // Olham para trás (para a serra que deixam) na saída: um breve
                    // olhar por cima do ombro antes de sumir na escuridão.
                    if (k > 0.3 && k < 0.6) {
                        this._express(this.p1, 'olhando_cima');
                        this._express(this.p2, 'olhando_cima');
                    } else if (k >= 0.6) {
                        this._express(this.p1, 'preocupado');
                        this._express(this.p2, 'preocupado');
                    }

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

        // Encaramento horizontal: segue o movimento lateral (com limiar), a
        // menos que o facing esteja TRAVADO (p._faceLock) — usado quando eles
        // devem encarar a serra independentemente da direção do passo.
        if (!p._faceLock) {
            if (dx < -0.1) p.facingLeft = true;
            else if (dx > 0.1) p.facingLeft = false;
        }
    }

    _idle(p) {
        p._moving = false;
        p._gaitScale = 1;
    }

    // Ponto médio atual entre os dois jogadores (centro da futura corda).
    _playersMid() {
        return { x: (this.p1.x + this.p2.x) / 2, y: (this.p1.y + this.p2.y) / 2 };
    }

    // Vira AMBOS para a serra (centro): quem está à esquerda do centro olha para
    // a direita; quem está à direita olha para a esquerda. Trava o facing para o
    // passo não revirá-los (p._faceLock).
    _faceSaw() {
        this.p1.facingLeft = this.p1.x > this.center.x;
        this.p2.facingLeft = this.p2.x > this.center.x;
        this.p1._faceLock = true;
        this.p2._faceLock = true;
    }

    // Libera o facing travado (volta a seguir o movimento).
    _faceFree() {
        this.p1._faceLock = false;
        this.p2._faceLock = false;
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
        p.expression = 'assustado';
    }
    _keepStartled(p) {
        p.scaredTimer = 600; // reforça todo frame -> some assim que paramos de chamar
    }
    _calm(p) {
        p.scaredTimer = 0;   // volta ao sprite normal (fim do espanto)
        p.expression = null;
    }

    // Força uma expressão permanente (ver TRAILER_EXPRESSIONS); null = normal.
    // Também define a expressão BASE para onde um susto temporário volta.
    _express(p, name) {
        p.expression = name;
        p._exprBase = name;
        p._exprTimer = 0;
    }

    // Expressão TEMPORÁRIA (ex.: susto): aplica `name` por `seconds` e depois
    // volta sozinha para a expressão base atual (via _tickExpressions).
    _expressFor(p, name, seconds) {
        p._exprBase = p._exprBase ?? p.expression ?? null;
        p.expression = name;
        p._exprTimer = seconds;
    }

    // Atalho: aplica a MESMA expressão temporária aos dois jogadores.
    _bothExpressFor(name, seconds) {
        this._expressFor(this.p1, name, seconds);
        this._expressFor(this.p2, name, seconds);
    }

    // Avança os timers de expressão temporária; ao zerar, volta à base.
    _tickExpressions(dt) {
        for (const p of [this.p1, this.p2]) {
            if (p._exprTimer > 0) {
                p._exprTimer -= dt;
                if (p._exprTimer <= 0) p.expression = p._exprBase ?? null;
            }
        }
    }

    // Vira AMBOS os jogadores para encarar a serra usando as EXPRESSÕES
    // direcionais (olhando_esquerda/olhando_direita) além do flip do sprite.
    _lookAtSaw() {
        // P1 à esquerda do centro olha para a DIREITA; P2 à direita, para a ESQUERDA.
        this._express(this.p1, this.p1.x <= this.center.x ? 'olhando_direita' : 'olhando_esquerda');
        this._express(this.p2, this.p2.x <= this.center.x ? 'olhando_direita' : 'olhando_esquerda');
    }

    // Balão de fala sobre a cabeça do jogador.
    _speak(who, text, dur) {
        this.speech = { who, text, t: 0, dur };
    }

    // Beat de CLOSE no rosto de `who`: câmera mergulha rápido no rosto, segura
    // e troca a expressão no meio (exprs[0] -> exprs[1]). O outro jogador e a
    // serra continuam no lugar (serra girando).
    _faceCloseUp(who, exprs, dur = 1.6) {
        const FACE_ZOOM = 5.0;   // multiplicador sobre o zoom-fit da sala
        const FACE_DY = -28;     // rosto fica ~28px de mundo acima do centro do sprite
        return {
            dur,
            enter: () => {
                this.speech = null;
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
        // Depois da cena 1: cartela, sangue e frenesi.
        if (this.phase !== 'scene1') {
            this._updateSequel(dt);
            this._tickExpressions(dt);
            return;
        }
        if (this.beatIndex >= this.beats.length) {
            this.phase = 'title';
            this.phaseT = 0;
            return;
        }

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

        // Expressões temporárias (sustos) voltam à base quando o timer zera.
        this._tickExpressions(dt);

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
        if (this.phase !== 'scene1') { this._renderSequel(); return; }
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

        // --- ILUMINAÇÃO em espaço de TELA ---
        // Monta as luzes do quadro (jogadores, tochas, serra azul) com o brilho
        // escurecido pelo SPOT_DIM (só do trailer) e compõe luz + vinheta.
        this._renderLights();
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

        // Balão de pedra em pixel art + fonte bitmap minúscula (js/ui).
        // Texto aparece como máquina de escrever (~40 caracteres/s).
        const text = this.speech.text;
        const chars = Math.floor(this.speech.t * 40);
        const key = `${text}|${chars}|${who.color}`;
        if (!this._bubbleCache || this._bubbleCache.key !== key) {
            this._bubbleCache = { key, ...renderSpeechBubble(text, who.color, chars) };
        }
        const { canvas: art, tipX, tipY } = this._bubbleCache;

        // "Pixel de arte" com a MESMA escala do jogo: tile de 16px de arte
        // ocupa TILE px de mundo, vezes o zoom quantizado da câmera.
        // Metade do pixel do jogo: fica "chunky" mas ainda legível. Limita a
        // largura do balão a ~55% da tela para não estourar em zoom alto.
        const gamePx = (TILE / 16) * scr.zoom;
        const maxP = Math.floor((this.canvas.width * 0.55) / art.width);
        const baseP = Math.max(2, Math.min(Math.round(gamePx * BUBBLE_PIXEL_RATIO), maxP));
        const P = baseP * scale;
        const dw = Math.round(art.width * P);
        const dh = Math.round(art.height * P);
        // Ponta do rabicho logo acima da cabeça; sobe um pouco ao surgir.
        const rise = (1 - inK) * 4 * P;
        let dx = Math.round(scr.x - tipX * P);
        let dy = Math.round(scr.y - 6 - tipY * P + rise);
        // Mantém o balão dentro da área visível (fora das barras de cinema).
        const margin = Math.round(this.canvas.height * 0.10) + 8;
        dx = Math.max(8, Math.min(dx, this.canvas.width - dw - 8));
        dy = Math.max(margin, dy);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(art, dx, dy, dw, dh);
        ctx.restore();
    }

    // Monta as luzes do quadro no PostProcessor (espaço de TELA), com o brilho
    // ESCURECIDO por SPOT_DIM. Replica o essencial do LightingRenderer do jogo
    // (jogadores + tochas + serra), mas isolado no trailer para poder regular a
    // intensidade sem tocar no config global.
    // `world` (opcional) permite outra cena (ex.: FrenzyScene) reaproveitar o
    // montador com a SUA sala: { tiles, rect, sawPos, sawDropped }.
    _renderLights(world = null) {
        const tiles = world?.tiles ?? this.tiles;
        const rect = world?.rect ?? this.rect;
        const pp = this.postProcessor;
        const r = this.renderer;
        const dim = this.SPOT_DIM;
        const lightPixel = (zoom, scale = LIGHT_PIXEL_SCALE) =>
            Math.max(2, Math.round((TILE / 16) * zoom * scale));
        // Clona um perfil escurecendo cada alpha do falloff por SPOT_DIM.
        const dimProfile = (base) => ({
            ...base,
            falloff: base.falloff.map(s => ({ offset: s.offset, alpha: s.alpha * dim }))
        });

        // 1) Luz de cada jogador (perfil global padrão, escurecido).
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

        // 2) Tochas de parede: halo na chama + mancha de área empurrada p/ dentro.
        if (TORCHES.enabled && tiles.torches?.length) {
            const tl = TORCHES.light;
            const area = tl.area;
            const glowProfile = dimProfile({ ...tl, falloff: tl.glow.falloff });
            const areaProfile = dimProfile({ ...tl, falloff: area.falloff });
            for (const t of tiles.torches) {
                let wx = rect.x + t.col * TILE + TILE / 2;
                let wy = rect.y + t.row * TILE + TILE / 2;
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

        // 3) Luz azul-aço da serra (ativa entre os dois, ou largada no chão).
        const bladeProfile = dimProfile(BLADE_LIGHT_PROFILE);
        if (world) {
            if (world.sawPos) {
                const s = r.worldToScreen(world.sawPos.x, world.sawPos.y);
                const radius = 60 + (this.saw.spin ?? 0) * 18;
                pp.addLight(s.x, s.y, radius * s.zoom, lightPixel(s.zoom), 1, bladeProfile);
            }
        } else if (this.sawCarried) {
            const sp = this.saw.getSawPositions(this.p1, this.p2)[0];
            const s = r.worldToScreen(sp.x, sp.y);
            const radius = 60 + (this.saw.spin ?? 0) * 18;
            pp.addLight(s.x, s.y, radius * s.zoom, lightPixel(s.zoom), 1, bladeProfile);
        } else if (this.sawVisibleDropped) {
            const s = r.worldToScreen(this.saw.dropX, this.saw.dropY);
            const breathe = 0.85 + (this.saw.dropHover ?? 0) * 0.15;
            pp.addLight(s.x, s.y, 150 * breathe * s.zoom, lightPixel(s.zoom), 1, bladeProfile);
        }
    }

    // Brilho AZUL-AÇO em volta do disco da serra (no MUNDO, aditivo). Intensifica
    // com o giro — casa com a luz fria que _renderLights emite da lâmina.
    _drawSawGlow(ctx, pos) {
        if (!pos) return;
        const spin = this.saw.spin ?? 0;
        const r = (this.saw.discRadius ?? 32);
        // Base mais contida (acompanha o escurecimento dos spots); o giro ainda
        // reforça o brilho azul.
        const intensity = 0.22 + spin * 0.45;
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

        if (this.beatIndex > lastIndex) this._drawTitleText();
        ctx.restore();
    }

    // Nome do jogo no centro. `red` 0..1 tinge de vermelho e treme (frenesi).
    _drawTitleText(red = 0, alpha = 1) {
        const { ctx, canvas } = this;
        const jx = red > 0 ? (Math.random() - 0.5) * 6 * red : 0;
        const jy = red > 0 ? (Math.random() - 0.5) * 4 * red : 0;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.textAlign = 'center';
        ctx.fillStyle = red > 0.5 ? '#ff3344' : '#fffffe';
        ctx.font = 'bold 42px monospace';
        ctx.fillText('DUNGEON CHAINED', canvas.width / 2 + jx, canvas.height / 2 - 6 + jy);
        ctx.fillStyle = red > 0.5 ? '#b3122a' : '#a7a9be';
        ctx.font = '16px monospace';
        ctx.fillText('acorrentados no calabouço', canvas.width / 2 + jx * 0.5, canvas.height / 2 + 26 + jy * 0.5);
        ctx.restore();
    }

    // -----------------------------------------------------------------------
    // CENA 2: cartela -> pisca vermelho -> sangue enche a tela -> escorre e
    // revela o FRENESI (FrenzyScene) -> fade -> cartela final.
    // -----------------------------------------------------------------------

    _updateSequel(dt) {
        const T = SEQUEL_TIMING;
        this.phaseT += dt;
        const bs = this.bloodScreen;

        if (this.phase === 'title') {
            if (this.phaseT >= T.sprayStart && bs.mode === 'idle') {
                bs.startSpray();
                this.renderer.triggerShake(6);
            }
            if (bs.mode === 'spray') {
                const k = clamp01((this.phaseT - T.sprayStart) / (T.sprayFull - T.sprayStart));
                bs.update(dt, k);
                if (this.phaseT >= T.sprayFull) bs.flood();
            }
            if (this.phaseT >= T.drainStart) {
                this.phase = 'frenzy';
                this.phaseT = 0;
                this.frenzy.start();
                bs.startDrain();
            }
            return;
        }

        // frenzy / outro
        this.frenzy.update(dt);
        bs.update(dt);
        if (this.phase === 'frenzy' && this.phaseT >= T.frenzyDur) {
            this.phase = 'outro';
            this.phaseT = 0;
        }
    }

    _renderSequel() {
        const { ctx, canvas } = this;
        const T = SEQUEL_TIMING;
        const W = canvas.width, H = canvas.height;

        if (this.phase === 'title') {
            const t = this.phaseT;
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.fillStyle = '#030208';
            ctx.fillRect(0, 0, W, H);

            // Pisca vermelho: estroboscópio irregular que fica mais forte e
            // mais frequente conforme se aproxima do sangue.
            const amt = easeInOut(clamp01((t - T.flickerStart) / (T.sprayFull - T.flickerStart)));
            let red = 0;
            if (amt > 0) {
                const on = hash01(Math.floor(t * 14)) < 0.3 + 0.45 * amt;
                ctx.fillStyle = on
                    ? `rgba(150, 0, 18, ${0.25 + 0.5 * amt})`
                    : `rgba(55, 0, 8, ${0.35 * amt})`;
                ctx.fillRect(0, 0, W, H);
                red = on ? Math.max(0.6, amt) : amt * 0.4;
            }
            ctx.restore();
            this._drawTitleText(red);
            this.bloodScreen.draw(ctx);
            this._drawLetterbox();
            return;
        }

        // Frenesi por baixo; a camada de sangue escorre por cima.
        this.frenzy.render();
        // Clarão vermelho residual logo no começo da revelação.
        if (this.phase === 'frenzy' && this.phaseT < 0.6) {
            ctx.save();
            ctx.fillStyle = `rgba(150, 0, 18, ${0.4 * (1 - this.phaseT / 0.6)})`;
            ctx.fillRect(0, 0, W, H);
            ctx.restore();
        }
        this.bloodScreen.draw(ctx);
        this._drawLetterbox();

        if (this.phase === 'outro') {
            const a = easeInOut(clamp01(this.phaseT / T.outroFade));
            ctx.save();
            ctx.fillStyle = `rgba(3, 2, 8, ${a})`;
            ctx.fillRect(0, 0, W, H);
            ctx.restore();
            if (a > 0.6) this._drawTitleText(0, (a - 0.6) / 0.4);
        }
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

    // Atalho de edição: trailer.html?cena=2 pula direto para a cartela/sangue.
    const skipToSequel = () => {
        if (new URLSearchParams(location.search).get('cena') === '2') scene.beatIndex = scene.beats.length;
    };
    skipToSequel();
    const origReset = scene.reset.bind(scene);
    scene.reset = () => { origReset(); skipToSequel(); };
    window.trailerScene = scene; // inspeção pelo console

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
