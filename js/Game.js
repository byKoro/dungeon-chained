import { InputHandler } from './core/InputHandler.js';
import { Physics } from './core/Physics.js';
import { Chain } from './core/Chain.js';
import { Renderer } from './core/Renderer.js';
import { Tileset } from './core/Tileset.js';
import { AssetLoader } from './core/AssetLoader.js';
import { AudioManager } from './core/AudioManager.js';
import { GameLoop } from './core/GameLoop.js';

import { SawWeapon } from './weapons/SawWeapon.js';

import { ParticleSystem } from './particles/ParticleSystem.js';
import { BloodCanvas } from './particles/BloodCanvas.js';

import { PlayerFactory } from './entities/PlayerFactory.js';
import { SpawnSystem } from './systems/SpawnSystem.js';
import { ParticleEffects } from './systems/ParticleEffects.js';
import { CombatSystem } from './combat/CombatSystem.js';
import { RoomManager } from './rooms/RoomManager.js';
import { DungeonTileQuery } from './rooms/DungeonTileQuery.js';
import { PostProcessor } from './systems/PostProcessor.js';
import { ScreenGore } from './systems/ScreenGore.js';
import { WindSystem } from './systems/WindSystem.js';
import { PlayerAI } from './systems/PlayerAI.js';
import { LightingRenderer } from './systems/LightingRenderer.js';
import { VtuberHud } from './ui/VtuberHud.js';
import { DeathScreen } from './ui/DeathScreen.js';
import { HeartPickup } from './entities/HeartPickup.js';
import { playerConfigs } from './config/EntityConfig.js';

import {
    TILE, WORLD_W, WORLD_H, BLOOD_COLORS, BLOOD_PIXEL,
    MAX_PLAYER_SEPARATION, CAM_MARGIN, CAMERA_DRONE, TRANSITION_SPEED,
    DOOR_STUB_TILES, DOOR_ENTER_DEPTH, BACKGROUND_TILE,
    TORCHES, DOOR_LIGHT, WIND,
    getPlayerSpawnPositions, AUDIO_CONFIG,
    SIM_STEP, PLAYER_SAFE_ZONE, ROOM_INTRO
} from './config/GameConfig.js';

/**
 * Game — orquestrador do jogo.
 *
 * Possui todos os subsistemas (render, input, física, salas, combate,
 * partículas) e roda o loop principal. Toda a lógica que antes vivia solta no
 * main.js mora aqui, encapsulada em estado de instância e métodos coesos.
 *
 * Uso:
 *   const game = new Game(document.getElementById("gameCanvas"));
 *   game.start();
 */
export class Game {
    constructor(canvas, opts = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.ctx.imageSmoothingEnabled = false;

        // Catálogo de peças autorais (/map); pode ser null (cai no fallback).
        this.roomCatalog = opts.roomCatalog || null;

        // Assets e tela
        // Pode receber um loader já carregado (ex.: o mesmo do trailer), para
        // não baixar/decodificar as texturas de novo ao começar.
        this.assets = opts.assets || new AssetLoader();
        this._bindResize();

        // HUD no canvas: retratos "vtuber" (P1 à esquerda, P2 à direita) com os
        // corações voltados para o centro. Os getters resolvem os jogadores
        // atuais (recriados no restart).
        const cfgs = playerConfigs(this.assets);
        this.hud = new VtuberHud({
            assets: this.assets,
            getPlayers: () => [this.p1, this.p2],
            spriteConfigs: cfgs.map(c => c.sprite),
            colors: cfgs.map(c => c.color)
        });
        // Tela de morte (DOM): véu de sangue + botão REINICIAR em pixel art.
        this.deathScreen = new DeathScreen({ onRestart: () => this.restart() });

        // Sprite do item de cura (versão chunky, no pixel do cenário).
        HeartPickup.sheet = this.assets.get("heartPickup");

        // Subsistemas de render / mundo
        this.renderer = new Renderer(canvas, this.ctx);
        this.renderer.setTileset(new Tileset(this.assets.tileset, 16, 10));
        this.renderer.setAssets(this.assets);
        // Alternador de tileset (tecla "T" / botão): índice da variante atual.
        this._tilesetIndex = 0;
        // Informa o tamanho do tile no mundo para a quantização do zoom
        // (mantém a grade de tiles alinhada ao pixel de tela — tiles fixos).
        this.renderer.setTileWorldSize(TILE);

        // Pós-processamento de tela (vinheta de masmorra).
        this.postProcessor = new PostProcessor(canvas, this.ctx);

        // Feedback de "kill" em espaço de tela (sangue voando + flash vermelho).
        this.screenGore = new ScreenGore(canvas);

        // Poeira/vento ambiente (atmosfera viva).
        this.wind = new WindSystem();

        // Sangue cobre o mundo inteiro
        this.bloodCanvas = new BloodCanvas(WORLD_W, WORLD_H, BLOOD_COLORS, BLOOD_PIXEL);
        this.particleSystem = new ParticleSystem(this.bloodCanvas);

        // Áudio: gerenciado centralmente por AudioConfig. Permite alterar sons,
        // volumes por caso de uso, pitch e volume master.
        this.audio = new AudioManager(AUDIO_CONFIG);
        if (typeof window !== "undefined") {
            window.audio = this.audio;
            window.audioConfig = AUDIO_CONFIG;
        }

        // Entrada e armas
        this.input = new InputHandler();
        // IA opcional do Jogador 1 (apenas para testar o jogo sozinho). Fica
        // DESLIGADA por padrão; alterna com a tecla "I" ou window.playerAI.
        // Os getters resolvem p1/p2/sala em tempo real (são recriados no
        // restart), então a IA sempre age sobre as instâncias atuais.
        this.playerAI = new PlayerAI({
            input: this.input,
            getP1: () => this.p1,
            getP2: () => this.p2,
            getRoom: () => this.rooms?.current,
            // Testa se um ponto do MUNDO cai sobre um buraco (ou fora da sala),
            // para a IA desviar de abismos. Reaproveita a grade de tiles.
            isHoleAt: (x, y) => this.tiles.isHoleAtWorld(x, y),
            // Portas abertas da sala atual (para a IA acompanhar o humano ao
            // atravessar). Vazio quando a sala está trancada.
            getDoors: () => (this.rooms?.isLocked() ? [] : this.rooms.doorsOfCurrent())
        });
        // A corrente une os jogadores e porta a arma ativa. Se insistirem em se
        // separar além do limite, ela ARREBENTA (empurrão elástico) e os
        // jogadores ficam DESARMADOS até os dois voltarem até a serra caída
        // (pickupRadius). Ajuste os "dials" (tensão, ruptura, reconexão) aqui.
        this.chain = new Chain([new SawWeapon(this.assets.saw, this.assets.cable)], {
            rest: 130,
            stiffness: 0.02,
            breakDistance: 240,
            strainDistance: 165,
            strainLimit: 30,
            reconnectDistance: 110,
            pickupRadius: 60,
            snapImpulse: 12,
            playerSafeZone: PLAYER_SAFE_ZONE
        });

        // Fábricas / sistemas
        this.playerFactory = new PlayerFactory({ assets: this.assets, bloodCanvas: this.bloodCanvas });
        this.spawnSystem = new SpawnSystem({ assets: this.assets, bloodCanvas: this.bloodCanvas });
        this.combat = new CombatSystem({ renderer: this.renderer, particleSystem: this.particleSystem, audio: this.audio });
        this.effects = new ParticleEffects({ particleSystem: this.particleSystem, bloodCanvas: this.bloodCanvas, audio: this.audio });
        // Pegadas não marcam os botões do corredor-desafio.
        this.effects.stepBlocker = (x, y) => !!this.rooms?.current?.challenge?.coversButton(x, y);
        this.rooms = new RoomManager({ spawnSystem: this.spawnSystem, getFloor: () => this.floor, roomCatalog: this.roomCatalog });

        // Consultas de grade de tiles (buracos, spawn seguro) sobre a sala atual.
        this.tiles = new DungeonTileQuery({ rooms: this.rooms });
        // Montagem das luzes de tela do quadro (jogadores, serra, tochas, portas).
        this.lighting = new LightingRenderer({ renderer: this.renderer, postProcessor: this.postProcessor });
        // Laço principal: fixed timestep + slow-motion. Os callbacks resolvem
        // leitura de controles, um passo de simulação e o render do quadro.
        this.gameLoop = new GameLoop({
            onFrameStart: () => { this.input.pollGamepads(); this._pollRestartPad(); },
            onStep: (dt) => this._step(dt),
            onRender: () => this._render()
        });

        // Modo de teste do editor: carrega UMA sala custom e desabilita a
        // troca de salas (não há vizinhas — transicionar causaria crash).
        this.playtest = typeof window !== "undefined" &&
            !!window.location && window.location.search.includes("playtest=true");

        // Estado de jogo
        this.floor = 1;
        this.gameOver = false;
        this.players = [];
        this.p1 = null;
        this.p2 = null;
        this.arenaBounds = null;
        this.gibs = [];
        this.transition = null; // { phase: "out"|"in", t, door }
        this.roomIntro = null;   // { phase, t } sequência de entrada na sala
        this._doorFlashT = 0;    // segundos restantes do flash de "porta aberta"

        this._bindButtons();
    }

    get currentWeapon() {
        return this.chain.weapon;
    }

    // ---- Bootstrap ----
    start() {
        this.players = this.playerFactory.create();
        [this.p1, this.p2] = this.players;
        this.newDungeon();
        this.gameLoop.start();
    }

    _bindResize() {
        const resize = () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.ctx.imageSmoothingEnabled = false;
        };
        resize();
        window.addEventListener("resize", resize);
    }

    // Feedback dos botões de pressão (tier "pequeno" de game feel): som de
    // clique, tremidinha de câmera e poeira saindo da base ao apertar; um
    // clique mais leve ao soltar. A animação (squash, onda, brilho) é do
    // próprio PressureButton.
    _buttonFeedback(challenge) {
        for (const b of challenge.buttons) {
            if (b.justPressed) {
                this.audio?.play("buttonPress");
                this.renderer.triggerShake(3);
                // Poeira radial saindo da borda da base (triggerDust lança
                // CONTRA a direção dada, por isso o sinal invertido).
                const n = 8;
                for (let i = 0; i < n; i++) {
                    const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
                    const cx = Math.cos(a), cy = Math.sin(a);
                    this.particleSystem.triggerDust(b.x + cx * 26, b.y + 14 + cy * 12, -cx, -cy, 2);
                }
            } else if (b.justReleased) {
                this.audio?.play("buttonRelease");
            }
        }
    }

    _bindButtons() {
        // Sem barra de botões: atalhos de teclado (toggle por toque, não por
        // frame). "R" reinicia a qualquer momento; Enter/Espaço reiniciam na
        // tela de fim de jogo. "T" cicla o tileset (teste de texturas).
        window.addEventListener("keydown", (e) => {
            if (e.repeat) return;
            const k = e.key.toLowerCase();
            if (k === "t") this.cycleTileset();
            else if (k === "r") this.restart();
            // Com o botão da tela de morte em foco, Enter/Espaço já disparam
            // o clique dele — não reinicia duas vezes.
            else if (this.gameOver && (k === "enter" || k === " ") &&
                document.activeElement !== this.deathScreen.button) this.restart();
        });
    }

    // Recomeça do andar 1 com jogadores novos (a HUD detecta a troca e zera).
    restart() {
        this.floor = 1;
        this.players = this.playerFactory.create();
        [this.p1, this.p2] = this.players;
        this.newDungeon();
    }

    // Fim de jogo: botão START (9) de qualquer controle reinicia (borda de
    // subida, para não reiniciar em loop enquanto segura).
    _pollRestartPad() {
        if (typeof navigator === "undefined" || !navigator.getGamepads) return;
        const pads = navigator.getGamepads() || [];
        let pressed = false;
        for (const pad of pads) {
            if (pad && this.input.isButtonPressed(pad, 9)) pressed = true;
        }
        if (pressed && !this._padStartHeld && this.gameOver) this.restart();
        this._padStartHeld = pressed;
    }

    // Troca o tileset do mundo pela próxima variante disponível (ciclo). Como o
    // Tileset desenha a partir de .img, basta trocar a imagem — sem recriar
    // nada nem recarregar a sala.
    cycleTileset() {
        const variants = this.assets.tilesetVariants;
        if (!variants || variants.length <= 1) return; // nada para alternar
        this._tilesetIndex = (this._tilesetIndex + 1) % variants.length;
        this.renderer.tileset.img = variants[this._tilesetIndex];
    }

    // Gera uma nova dungeon e posiciona os jogadores na sala inicial.
    newDungeon() {
        this.rooms.reset();
        this.gibs = [];
        this.effects.clear();
        this.transition = null;
        this.roomIntro = null;
        this.renderer.setIntroZoomFactor(1);
        this.particleSystem.clear();
        this.screenGore.clear();
        this.gameOver = false;
        this.deathScreen.hide();

        // A corrente começa conectada a cada nova dungeon.
        this.chain.reset();

        this.rooms.enter();
        this.arenaBounds = this.rooms.currentBounds;

        const rect = this.rooms.cellRect();
        const spawns = getPlayerSpawnPositions("CENTER", rect.x, rect.y, TILE);
        // Teste do editor: usa o spawn escolhido na aba "Spawns Players".
        const custom = this.playtest ? this.rooms.playtestSpawn : null;
        if (custom) {
            for (const key of ["p1", "p2"]) {
                spawns[key].x = rect.x + (custom[key].col + 0.5) * TILE;
                spawns[key].y = rect.y + (custom[key].row + 0.5) * TILE;
            }
        }
        this.p1.x = spawns.p1.x; this.p1.y = spawns.p1.y; this.p1.vx = 0; this.p1.vy = 0;
        this.p2.x = spawns.p2.x; this.p2.y = spawns.p2.y; this.p2.vx = 0; this.p2.vy = 0;

        // No modo de teste do editor, o spawn pode cair sobre um buraco
        // (morte instantânea em loop). Reposiciona cada player no tile de piso
        // seguro mais próximo.
        if (this.playtest) {
            this.tiles.ensureSafeSpawn(this.p1, rect);
            this.tiles.ensureSafeSpawn(this.p2, rect);
        }

        const center = this.rooms.cellCenter();
        this.renderer.camX = center.x;
        this.renderer.camY = center.y;
        this.renderer.resetSway();

        // A sala inicial também pode ter inimigos autorais (sempre no teste do
        // editor). Antes eles só nasciam ao ENTRAR por uma porta, então a sala
        // de teste ficava vazia — e trancada para sempre na regra "enemies".
        this._activateRoomEnemies();
    }

    // Move para a sala vizinha através de uma porta, reposicionando cada player em um tile logo à frente da porta.
    transitionThroughDoor(door) {
        this.rooms.transitionTo(door);
        this.arenaBounds = this.rooms.currentBounds;

        // A porta de entrada na nova sala é o lado oposto da porta atravessada na sala anterior:
        // Ex: saiu pela porta Norte -> entra pela porta Sul da nova sala.
        const entryDir = { N: "S", S: "N", E: "W", W: "E" }[door.dir] || "CENTER";
        const rect = this.rooms.cellRect();
        const spawns = getPlayerSpawnPositions(entryDir, rect.x, rect.y, TILE);

        this.p1.x = spawns.p1.x; this.p1.y = spawns.p1.y; this.p1.vx = 0; this.p1.vy = 0;
        this.p2.x = spawns.p2.x; this.p2.y = spawns.p2.y; this.p2.vx = 0; this.p2.vy = 0;

        // Saíram DESARMADOS: a lâmina largada ficaria presa na sala anterior
        // (coordenadas de outra célula) e nunca mais poderia ser recolhida.
        // Ela acompanha os jogadores e a corrente volta conectada.
        if (!this.chain.isConnected) this.chain.reset();

        // Sala de combate (tem inimigos a instanciar): dispara a SEQUÊNCIA DE
        // INTRO (jogadores parados na porta -> zoom -> inimigos aparecem
        // congelados -> zoom volta -> liberados). Caso contrário, entrou numa
        // sala já aberta: dispara o flash amarelo das portas.
        const combat = this._activateRoomEnemies();
        if (!combat && !this.rooms.isLocked()) {
            this._triggerDoorFlash();
        }

        // Retratos da HUD reagem à sala nova (combate = espanto -> raiva).
        this.hud.onRoomEnter(combat);
    }

    // Instancia os inimigos autorais pendentes da sala atual. Com a intro
    // ligada, dispara a sequência (zoom -> aparição -> liberação); sem ela,
    // cria os inimigos já ativos. Devolve true se havia inimigos a criar.
    _activateRoomEnemies() {
        const room = this.rooms.current;
        if (!room.hasPendingEnemies) return false;
        if (ROOM_INTRO.enabled) this._beginRoomIntro();
        else room.spawnEnemies(false);
        return true;
    }

    // Inicia a sequência de intro da sala atual. Enquanto ativa, o controle dos
    // jogadores e o combate ficam suspensos (ver _updateRoomIntro).
    _beginRoomIntro() {
        this.roomIntro = { phase: "zoomIn", t: 0 };
        // Cor da chama de aparição = cor da luz da tocha (âmbar do cenário),
        // convertida de "r, g, b" para [r,g,b]. Calculada uma vez por intro.
        this._introFlameColor = this._parseRgbTriplet(
            TORCHES?.light?.color || "255, 190, 110"
        );
        // Garante que os jogadores comecem imóveis na porta.
        this.p1.vx = this.p1.vy = 0;
        this.p2.vx = this.p2.vy = 0;
    }

    // Converte uma cor "r, g, b" (string) em [r, g, b] (números). Fallback para
    // o âmbar da tocha se o formato for inesperado.
    _parseRgbTriplet(str) {
        const parts = String(str).split(",").map(s => parseInt(s.trim(), 10));
        if (parts.length === 3 && parts.every(n => Number.isFinite(n))) return parts;
        return [255, 190, 110];
    }

    /**
     * Distribui atrasos de aparição ALEATÓRIOS entre os inimigos recém-criados,
     * para que surjam de forma desordenada (um aqui, outro ali, não todos de
     * uma vez). Cada inimigo recebe um delay base crescente + jitter, embaralhado
     * para a ordem não seguir a lista. Delays em frames (60 = 1s).
     */
    _scheduleStaggeredSpawns(enemies) {
        if (!enemies || !enemies.length) return;
        // Ordem embaralhada (Fisher–Yates) para o escalonamento ser desordenado.
        const order = enemies.slice();
        for (let i = order.length - 1; i > 0; i--) {
            const j = (Math.random() * (i + 1)) | 0;
            [order[i], order[j]] = [order[j], order[i]];
        }
        // Espaçamento entre aparições (frames) com jitter. O primeiro pode sair
        // quase imediato; os demais escalonam.
        let acc = (Math.random() * 6) | 0;
        for (const e of order) {
            e.beginFrozenSpawn(acc);
            acc += 8 + ((Math.random() * 16) | 0); // ~0.13s..0.4s entre cada
        }
    }

    // Dispara o flash temporário de "porta aberta" (pulsa e enfraquece) + um
    // pulso de câmera sutil (zoom-punch) ao abrir a porta.
    _triggerDoorFlash() {
        this._doorFlashT = DOOR_LIGHT.flashDuration;
        this.renderer.triggerZoomPunch(0.045);
    }

    // Dispara o slow-motion de abate (dá peso ao golpe sem travar). Delega ao
    // GameLoop, dono do tempo da simulação.
    triggerHitSlowmo() {
        this.gameLoop.triggerHitSlowmo();
    }

    // Limite físico de afastamento entre os players (teto rígido).
    enforceSeparationLimit() {
        // O teto rígido só vale enquanto a corrente está CONECTADA. Se ela
        // arrebentou, os jogadores ficam livres (desarmados) e não devem mais
        // puxar um ao outro — a reconexão acontece ao se reaproximarem.
        if (!this.chain.isConnected) return;
        const dx = this.p2.x - this.p1.x, dy = this.p2.y - this.p1.y;
        const dist = Math.hypot(dx, dy);
        if (dist > MAX_PLAYER_SEPARATION) {
            const over = dist - MAX_PLAYER_SEPARATION;
            const nx = dx / (dist || 1), ny = dy / (dist || 1);
            this.p1.x += nx * over / 2; this.p1.y += ny * over / 2;
            this.p2.x -= nx * over / 2; this.p2.y -= ny * over / 2;
        }
    }

    // Centra a câmera na sala atual com zoom que faz a célula inteira caber.
    // Além do centro fixo, aplica o sway "drone": a câmera pende na direção do
    // movimento dos jogadores e balança como um pêndulo ao virar/parar.
    _updateCameraToCurrentRoom(dt = SIM_STEP) {
        const rect = this.rooms.cellRect();
        const fitZoom = Math.min(
            this.canvas.width / (rect.w + CAM_MARGIN * 2),
            this.canvas.height / (rect.h + CAM_MARGIN * 2)
        );

        // Sway drone: alvo de deslocamento = velocidade média dos jogadores,
        // normalizada por responseVel (satura em 1) e escalada por maxOffset.
        // Enquanto correm, a câmera pende à frente; ao parar/virar, a mola
        // amortecida devolve o sway ao centro oscilando (pêndulo).
        if (CAMERA_DRONE.enabled) {
            const avgVX = (this.p1.vx + this.p2.vx) / 2;
            const avgVY = (this.p1.vy + this.p2.vy) / 2;
            const sat = CAMERA_DRONE.responseVel || 1;
            const targetSwayX = Math.max(-1, Math.min(1, avgVX / sat)) * CAMERA_DRONE.maxOffset;
            const targetSwayY = Math.max(-1, Math.min(1, avgVY / sat)) * CAMERA_DRONE.maxOffset;
            this.renderer.applyDroneSway(
                targetSwayX, targetSwayY, CAMERA_DRONE.stiffness, CAMERA_DRONE.damping, dt
            );
        }

        this.renderer.updateCamera({
            x: rect.x + rect.w / 2, y: rect.y + rect.h / 2, zoom: fitZoom
        });
    }

    // ---- Simulação ----
    //
    // O laço e o tempo (fixed timestep + slow-motion) vivem no GameLoop; aqui
    // ficam só os passos de simulação e o render, chamados pelos callbacks.

    // Um passo lógico de tamanho fixo (SIM_STEP segundos).
    _step(deltaSeconds) {
        if (this.gameOver) return;
        if (this.transition) {
            this._updateTransition();
        } else if (this.roomIntro) {
            this._updateRoomIntro(deltaSeconds);
        } else {
            this._updateGameplay(deltaSeconds);
        }
    }

    _updateTransition() {
        this.arenaBounds = this.rooms.currentBounds;
        this.transition.t += TRANSITION_SPEED;
        if (this.transition.phase === "out" && this.transition.t >= 1) {
            this.transitionThroughDoor(this.transition.door);
            this.transition.phase = "in";
            this.transition.t = 0;
        } else if (this.transition.phase === "in" && this.transition.t >= 1) {
            this.transition = null;
        }
        this.wind.update(this.arenaBounds); // poeira continua viva durante o fade
        this._updateCameraToCurrentRoom();
    }

    /**
     * Sequência de ENTRADA na sala de combate. Enquanto ativa, os jogadores
     * ficam parados na porta (sem controle) e o combate está suspenso. As fases:
     *   zoomIn  — a câmera aproxima (introZoomFactor sobe até ROOM_INTRO.zoomFactor);
     *             ao chegar, os inimigos SPAWNAM congelados com partícula.
     *   hold    — os inimigos ficam visíveis e parados por um instante.
     *   zoomOut — a câmera volta ao zoom normal (fator -> 1).
     *   (fim)   — libera os inimigos (unfreeze) e devolve o controle.
     */
    _updateRoomIntro(deltaSeconds = SIM_STEP) {
        const intro = this.roomIntro;
        const room = this.rooms.current;
        this.arenaBounds = this.rooms.currentBounds;

        intro.t += deltaSeconds;

        if (intro.phase === "zoomIn") {
            const dur = ROOM_INTRO.zoomInTime || 0.0001;
            const k = Math.min(1, intro.t / dur);
            const eased = 1 - Math.pow(1 - k, 3); // easeOutCubic
            this.renderer.setIntroZoomFactor(1 + (ROOM_INTRO.zoomFactor - 1) * eased);
            if (k >= 1) {
                // Pico do zoom: cria os inimigos CONGELADOS e os ESCALONA — cada
                // um ganha um atraso de aparição aleatório, para surgirem de
                // forma desordenada (não todos de uma vez). Cada um aparece do
                // fogo (chama de tocha) quando sua vez chega (ver justAppeared).
                const spawned = room.spawnEnemies(true);
                this._scheduleStaggeredSpawns(spawned);
                intro.phase = "hold";
                intro.t = 0;
            }
        } else if (intro.phase === "hold") {
            this.renderer.setIntroZoomFactor(ROOM_INTRO.zoomFactor);
            // Só avança quando TODOS já apareceram (nenhum ainda escondido) E o
            // tempo mínimo de contemplação passou.
            const allAppeared = room.enemies.every(e => !e.isHidden);
            if (allAppeared && intro.t >= (ROOM_INTRO.spawnHold || 0)) {
                intro.phase = "zoomOut";
                intro.t = 0;
            }
        } else if (intro.phase === "zoomOut") {
            const dur = ROOM_INTRO.zoomOutTime || 0.0001;
            const k = Math.min(1, intro.t / dur);
            const eased = 1 - Math.pow(1 - k, 3);
            this.renderer.setIntroZoomFactor(ROOM_INTRO.zoomFactor + (1 - ROOM_INTRO.zoomFactor) * eased);
            if (k >= 1) {
                // Fim da intro: zoom normal, libera os inimigos e o controle.
                this.renderer.setIntroZoomFactor(1);
                for (const e of room.enemies) e.unfreeze?.();
                this.roomIntro = null;
            }
        }

        // Os jogadores permanecem imóveis na porta durante toda a intro.
        this.p1.vx = this.p1.vy = 0;
        this.p2.vx = this.p2.vy = 0;

        // Mantém os inimigos presos aos bounds e avança APENAS seu efeito de
        // aparição (update congelado não move/ataca). Quando um inimigo chega a
        // sua vez (justAppeared), uma CHAMA sobe no lugar dele com as cores da
        // tocha e a câmera dá um soquinho. Partículas e ambiente continuam vivos
        // para a cena não "congelar" por completo.
        for (const e of room.enemies) {
            e.update([this.p1, this.p2], () => {});
            // Altura do fogo: um pouco MAIOR que o sprite, para a coluna de
            // chama cobrir e revelar o inimigo de baixo para cima.
            const riseH = e.drawHeight * 1.15;
            if (e.justAppeared) {
                // Erupção inicial (densa) saindo do CHÃO (os pés).
                this.particleSystem.triggerFlameBurst(e.x, e.footY, this._introFlameColor, {
                    amount: 40, rise: riseH, width: e.drawHeight * 0.6
                });
                this.renderer.triggerShake(6);
            } else if (e.spawnFx > 0) {
                // Alimenta a coluna de fogo durante toda a REVELAÇÃO, para o
                // fogo acompanhar o sprite surgindo (não some antes da hora).
                this.particleSystem.triggerFlameBurst(e.x, e.footY, this._introFlameColor, {
                    amount: 6, rise: riseH, width: e.drawHeight * 0.55
                });
            }
            this.rooms.clampEnemy(e, this.arenaBounds);
        }

        this.particleSystem.update([this.p1, this.p2], this.arenaBounds);
        this.wind.update(this.arenaBounds);
        this.effects.update();

        if (this._doorFlashT > 0) {
            this._doorFlashT = Math.max(0, this._doorFlashT - deltaSeconds);
        }

        this._updateCameraToCurrentRoom(deltaSeconds);
    }

    _updateGameplay(deltaSeconds = 1 / 60) {
        const { p1, p2, rooms } = this;
        this.arenaBounds = rooms.currentBounds;
        const room = rooms.current;

        // IA opcional do P1: injeta as teclas virtuais ANTES do update do
        // jogador. Desligada, não faz nada (controle volta ao humano).
        this.playerAI.update();

        p1.update(this.input, this.arenaBounds);
        p2.update(this.input, this.arenaBounds);

        this.effects.processPlayer(p1);
        this.effects.processPlayer(p2);

        // Corrente: tensão elástica, ruptura (arrebenta e desarma) e reconexão.
        // A própria Chain aplica o constraint elástico e atualiza a animação da
        // arma. O teto rígido de afastamento continua valendo por cima.
        this.chain.update(p1, p2, {
            onSnap: () => {
                this.renderer.triggerShake(14);
                // Ruptura: explosão exagerada de FAÍSCAS (radiais, com glow) +
                // flash branco no ponto da serra (meio da curva da corda).
                const sp = this.chain.weapon?.getSawPositions?.(p1, p2)?.[0];
                const fx = sp ? sp.x : (p1.x + p2.x) / 2;
                const fy = sp ? sp.y : (p1.y + p2.y) / 2;
                const r = this.chain.weapon?.discRadius ?? 24;
                this.particleSystem.triggerSparkBurst(fx, fy, r, 12, 1.2);
                this.particleSystem.triggerFlash(fx, fy, 12, 1);
            },
            onReconnect: () => {
                this.renderer.triggerShake(4);
                // Serra recolhida: pisca em branco e dá um pop de escala que
                // cresce e retrai suave.
                this.chain.weapon?.playReconnect?.();
            },
            // A serra nunca cai num ponto inalcançável (buraco, parede, ilha).
            resolveDropPoint: (x, y) => this.tiles.reachableDropPoint(x, y, [p1, p2])
        });

        // Serra em velocidade ALTA: tremida de câmera SECA e PEQUENA, contínua
        // enquanto o disco gira a toda (sensação de vibração do motor).
        const weapon = this.chain.weapon;
        if (this.chain.isConnected && weapon?.isHighSpeed) {
            this.renderer.triggerShake(1.6);
        }

        // Faíscas de "raspar o chão": o disco cospe centelhas pelas BORDAS,
        // arremessadas no sentido do giro. A TAXA de emissão é contínua e
        // proporcional a (giro × movimento), então as faíscas vão RAREANDO
        // suavemente conforme a serra ou os jogadores desaceleram — sem corte
        // seco. Um acumulador fracionário permite emitir menos de 1 por frame.
        // Corrente desarmada: a serra não está em jogo — garante que não fique
        // "presa" sobre sangue.
        if (!this.chain.isConnected) weapon?.setOnBlood?.(false);

        if (this.chain.isConnected && weapon) {
            const spin = weapon.spinSpeed ?? 0;
            const vx = (p1.vx + p2.vx) / 2;
            const vy = (p1.vy + p2.vy) / 2;
            const speed = Math.min(1, Math.hypot(vx, vy) / (p1.speed || 4.2));
            // Intensidade 0..1 combinando giro e movimento (ambos precisam
            // existir para raspar). Elevada ao quadrado para cair suave no fim.
            const intensity = spin * speed;
            // Pico de ~5 faíscas por frame no raspar máximo.
            this._sparkAccum = (this._sparkAccum ?? 0) + intensity * 5;
            const emit = Math.floor(this._sparkAccum);
            // Centro da serra = meio da CURVA da corda (ancoragem real).
            const sawPos = weapon.getSawPositions(p1, p2)[0];
            const sawX = sawPos.x;
            const sawY = sawPos.y;
            if (emit > 0) {
                this._sparkAccum -= emit;
                this.particleSystem.triggerSparks(
                    sawX, sawY, weapon.discRadius ?? 24, weapon.spinDir ?? 1, emit
                );
            }

            // Serra SOBRE SANGUE: enquanto o disco está sobre uma poça/zona
            // molhada do chão, mantém o sprite ensanguentado (mesmo parado) e,
            // se estiver GIRANDO, chapinha lançando gotas EFÊMERAS pelas bordas
            // — só visual, sem carimbar/criar sangue novo no chão.
            const bc = this.particleSystem.bloodCanvas;
            const overBlood = !!bc && bc.isBloodZone(sawX, sawY);
            weapon.setOnBlood?.(overBlood);
            if (overBlood && intensity > 0.05) {
                const radius = weapon.discRadius ?? 24;
                this._gorePickupAccum = (this._gorePickupAccum ?? 0) + intensity * 3;
                let splats = Math.floor(this._gorePickupAccum);
                if (splats > 0) {
                    this._gorePickupAccum -= splats;
                    while (splats-- > 0) {
                        const a = Math.random() * Math.PI * 2;
                        const bx = sawX + Math.cos(a) * radius;
                        const by = sawY + Math.sin(a) * radius;
                        this.particleSystem.triggerBloodDroplets(bx, by, 2, 0.6);
                    }
                }
            }
        }
        this.enforceSeparationLimit();

        // Corredor-desafio: perigos (spikes/flechas) + botões co-op.
        if (room.challenge) {
            room.challenge.update([p1, p2], deltaSeconds);
            this._buttonFeedback(room.challenge);
        }

        // Inimigos: IA + dano no player (feedback via CombatSystem)
        const enemies = room.enemies;
        this.combat.updateEnemies(enemies, [p1, p2]);

        // Colisões entre entidades (3 iterações)
        const liveEnemies = enemies.filter(e => e.state !== "dying");
        const allEntities = [p1, p2, ...liveEnemies];
        // Raio sólido do disco da serra (só quando conectada): impede que os
        // jogadores (e inimigos vivos) fiquem em cima/atrás do disco.
        const sawR = (this.chain.isConnected && weapon) ? (weapon.collisionRadius ?? 0) : 0;
        for (let it = 0; it < 3; it++) {
            Physics.resolveEntityCollisions(allEntities);
            if (sawR > 0) {
                // Centro = meio da CURVA da corda, recalculado a cada iteração.
                const sc = weapon.getSawPositions(p1, p2)[0];
                for (const e of allEntities) {
                    Physics.resolveCircleCollision(e, sc.x, sc.y, sawR);
                }
            }
        }

        // Colisão com paredes construídas no editor (vindo da branch paredes).
        if (room.wallBoxes?.length) {
            for (const entity of [p1, p2, ...room.enemies]) {
                Physics.resolveBoxCollisions(entity, room.wallBoxes);
            }
        }

        // Após resolver as colisões, garante que nenhum inimigo tenha sido
        // empurrado para um tile não-caminhável.
        for (const enemy of liveEnemies) enemy.ensureOnWalkableTile?.();

        // Confinamento: inimigos presos; players podem adentrar portas abertas
        enemies.forEach(e => rooms.clampEnemy(e, this.arenaBounds));
        const doors = rooms.doorsOfCurrent();
        const canPass = !rooms.isLocked();
        rooms.clampPlayer(p1, this.arenaBounds, doors, canPass);
        rooms.clampPlayer(p2, this.arenaBounds, doors, canPass);

        // Queda em buracos/abismos COM RESISTÊNCIA (HOLE_FALL): na beirada o
        // jogador é freado e empurrado de volta ao piso; só cai (e morre) se
        // insistir além dela por alguns frames. A posição já está confinada acima.
        this.tiles.checkHoleFalls([p1, p2]);

        // Arma: a animação já é atualizada por chain.update(). O dano só é
        // aplicado quando a corrente está conectada (desarmada = sem dano).
        this.combat.resolveWeaponHits(
            this.chain.weapon, enemies, p1, p2, this.chain.isConnected,
            () => this.triggerHitSlowmo()
        );
        this.combat.resolveDeaths(room, this.gibs, () => this.screenGore.trigger(), [p1, p2]);

        // Corações de cura: atualiza, e qualquer player com vida < 3 que
        // encoste coleta (cura até o máximo de 3). Toca o som de pickup.
        this._updateHearts(room);

        // Gibs
        for (let i = this.gibs.length - 1; i >= 0; i--) {
            this.gibs[i].update(this.arenaBounds);
            if (this.gibs[i].done) this.gibs.splice(i, 1);
        }

        // Pegadas / poeira
        this.effects.update();

        // Flash vermelho SÓ quando um jogador perde vida (qualquer fonte:
        // inimigo, flecha, spike). Detecta pela queda de `lives` desde o
        // último passo; cura e reinício (lives sobe) não disparam.
        for (const p of [p1, p2]) {
            if (p._livesSeen !== undefined && p.lives < p._livesSeen) {
                this.screenGore.triggerFlash();
            }
            p._livesSeen = p.lives;
        }

        // Feedback de tela: respingos (kill) + flash vermelho (dano).
        this.screenGore.update();

        // Flash de "porta aberta": decai ao longo do tempo até sumir.
        if (this._doorFlashT > 0) {
            this._doorFlashT = Math.max(0, this._doorFlashT - deltaSeconds);
        }

        // Sala limpa quando sem inimigos. No instante em que destrava, dispara
        // o flash amarelo nas portas (pulsa um momento e enfraquece).
        if (rooms.tryClearCurrent()) {
            this._triggerDoorFlash();
            // Pulso de câmera mais forte ao LIMPAR a sala (alívio/recompensa):
            // afasta de leve e volta.
            this.renderer.triggerZoomPunch(-0.07);
            this.hud.onRoomCleared();
        }

        this.particleSystem.update([p1, p2], this.arenaBounds);
        this.wind.update(this.arenaBounds);

        if (p1.lives <= 0 || p2.lives <= 0) {
            this.gameOver = true;
            this.deathScreen.show();
        }

        this._checkDoorTransition(doors);
        this._updateCameraToCurrentRoom(deltaSeconds);
    }

    // Atualiza os corações da sala e resolve a coleta pelos jogadores.
    // Qualquer player pode recolher um coração desde que ainda tenha espaço para
    // recuperar uma vida (o máximo é três). Coletar cura +1 e toca "pickup".
    _updateHearts(room) {
        const { p1, p2 } = this;
        const hearts = room.hearts;
        for (let i = hearts.length - 1; i >= 0; i--) {
            const heart = hearts[i];
            heart.update();
            const collector = [p1, p2].find(player =>
                player.lives < 3 && Math.hypot(player.x - heart.x, player.y - heart.y) <= heart.radius + player.hitRadius
            );
            if (collector) {
                collector.lives = Math.min(3, collector.lives + 1);
                this.audio.play("pickup");
                hearts.splice(i, 1);
            }
        }
    }

    // Dispara a transição quando ambos os players adentraram o mesmo vão.
    _checkDoorTransition(doors) {
        // No modo de teste do editor só existe UMA sala: nunca transiciona.
        if (this.playtest) return;
        if (this.rooms.isLocked() || this.transition) return;
        const { p1, p2, rooms } = this;
        for (const door of doors) {
            const a1 = rooms.playerAlignedToDoor(p1, door);
            const a2 = rooms.playerAlignedToDoor(p2, door);
            const d1 = rooms.doorEntryDepth(p1, door, this.arenaBounds);
            const d2 = rooms.doorEntryDepth(p2, door, this.arenaBounds);
            if (a1 && a2 && d1 > 2 && d2 > 2 && Math.max(d1, d2) > DOOR_ENTER_DEPTH * 0.5) {
                this.transition = { phase: "out", t: 0, door };
                break;
            }
        }
    }

    // ---- Render ----
    _render() {
        const { ctx, renderer, rooms } = this;
        renderer.beginFrame();
        renderer.drawBackground(BACKGROUND_TILE, TILE);

        const rect = rooms.cellRect();
        const doors = rooms.doorsOfCurrent();
        const open = !rooms.isLocked();
        const tiles = rooms.currentTiles;
        const doorHalf = rooms.doorHalfWidth;

        // Recorta ao retângulo da célula + margem dos stubs de corredor.
        const stubMargin = DOOR_STUB_TILES * TILE;
        ctx.save();
        ctx.beginPath();
        ctx.rect(rect.x - stubMargin, rect.y - stubMargin, rect.w + stubMargin * 2, rect.h + stubMargin * 2);
        ctx.clip();

        renderer.drawRoom(rect, this.arenaBounds, tiles, TILE, open, doors, doorHalf);

        if (open) {
            renderer.drawDoorStubs(rect, doors, TILE, doorHalf, DOOR_STUB_TILES);
            renderer.drawDoorGradients(doors, doorHalf, TILE, DOOR_STUB_TILES);
        }

        // Desafio co-op: botões e spikes ficam no CHÃO. São desenhados ANTES do
        // sangue para que a mancha caia POR CIMA do piso onde eles estão (do
        // contrário o sprite da spike taparia o sangue do próprio tile).
        const challenge = rooms.current.challenge;
        if (challenge) challenge.drawFloorLayer(ctx);

        this.particleSystem.drawFloor(ctx, this.arenaBounds, this.tiles.darkHoleRects());
        this.effects.draw(ctx);
        // Botões: objeto com altura, POR CIMA do sangue e das pegadas (nada
        // mancha a tampa), mas sob a poeira, as sombras e as entidades.
        if (challenge) challenge.drawButtons(ctx);
        this.particleSystem.drawSmoke(ctx);

        // Corações de cura: só a SOMBRA vai no chão; o coração em si é
        // desenhado depois do pós-processamento (ver _render, abaixo).
        rooms.current.hearts.forEach(h => h.drawShadow(ctx));

        const p1Bounce = this.p1.speedMag > 0.15 ? Math.abs(Math.sin(this.p1.animTimer)) : 0;
        const p2Bounce = this.p2.speedMag > 0.15 ? Math.abs(Math.sin(this.p2.animTimer)) : 0;
        renderer.drawRoundShadow(this.p1.x, this.p1.y, 14, p1Bounce);
        renderer.drawRoundShadow(this.p2.x, this.p2.y, 14, p2Bounce);
        const enemies = rooms.current.enemies;
        // Inimigos ainda escondidos (atraso de spawn da intro) não projetam
        // sombra — ela denunciaria a posição antes de aparecerem.
        enemies.forEach(e => { if (!e.isHidden) renderer.drawRoundShadow(e.x, e.y, 13, 0); });

        // Corrente (linha) da arma: SEMPRE ao fundo, atrás de todas as
        // entidades. Só o disco entra na ordenação por profundidade.
        this.chain.drawChain(ctx, this.p1, this.p2);

        // Profundidade pelo DISCO da serra: ele fica no meio da corrente
        // (sawY). Quem está mais ACIMA (y <= sawY, "ao fundo") é desenhado
        // ANTES e fica atrás do disco; quem está mais ABAIXO (y > sawY, "à
        // frente") é desenhado DEPOIS e fica na frente dele. Ordenado por Y.
        const sawY = this.chain.weapon?.getSawPositions
            ? this.chain.weapon.getSawPositions(this.p1, this.p2)[0].y
            : (this.p1.y + this.p2.y) / 2;
        const entities = [this.p1, this.p2, ...enemies];
        // Botões entram na ordenação como OCLUSORES: redesenham a tampa por
        // cima dos pés de quem passa por TRÁS deles (dá volume ao botão).
        const occluders = challenge ? challenge.buttonOccluders(entities) : [];
        const drawables = [...entities, ...occluders].sort((a, b) => a.y - b.y);

        drawables.filter(e => e.y <= sawY).forEach(e => e.draw(ctx));

        // Disco da serra: só aparece quando conectada (a Chain cuida disso).
        this.chain.draw(ctx, this.p1, this.p2);

        // Lâmina DROPADA: quando a corrente arrebenta, a serra fica flutuando
        // no chão como item coletável (sombra + feixe de luz). Só desenha
        // quando desconectada (a Chain cuida disso).
        this.chain.drawDropped(ctx);

        // Faíscas da serra: por cima do disco (centelhas saltando).
        this.particleSystem.drawSparks(ctx);

        drawables.filter(e => e.y > sawY).forEach(e => e.draw(ctx));

        // Chamas de APARIÇÃO (intro): por cima das entidades, para o fogo subir
        // na frente do inimigo que materializa.
        this.particleSystem.drawFlames(ctx);

        // Indicadores dos atiradores de flecha: montados nas paredes, por cima
        // das entidades (ficam na parede, não no chão).
        if (challenge) challenge.drawWallLayer(ctx);

        renderer.drawFrontWall(rect, tiles, TILE, open, doors, doorHalf, DOOR_STUB_TILES);

        this.gibs.forEach(g => g.draw(ctx));

        // Flechas em voo: por cima de tudo no mundo (camada "aérea").
        if (challenge) challenge.drawAirLayer(ctx);

        this.particleSystem.drawAir(ctx);

        // Poeira/vento no MUNDO (dentro do clip). Como a iluminação é aplicada
        // depois do endFrame, a luz das tochas/jogadores "revela" a poeira.
        if (WIND.layer === "world") this.wind.draw(ctx);

        ctx.restore(); // fim do clip da sala
        renderer.endFrame();

        // Pós-processamento em espaço de tela (iluminação + vinheta), sobre a
        // cena mas por baixo dos overlays de UI/transição/game over. Toda a
        // montagem de luzes do quadro é delegada ao LightingRenderer; a posição
        // da serra em uso é calculada aqui (depende de p1/p2) e injetada.
        const sawPos = (this.chain.isConnected && this.chain.weapon)
            ? this.chain.weapon.getSawPositions?.(this.p1, this.p2)?.[0] ?? null
            : null;
        this.lighting.render({
            players: [this.p1, this.p2],
            chain: this.chain,
            sawPos,
            arenaBounds: this.arenaBounds,
            tiles,
            rect,
            doors,
            doorHalf,
            open,
            doorFlashT: this._doorFlashT,
            buttons: this.rooms.current?.challenge?.buttons ?? [],
            hearts: this.rooms.current?.hearts ?? []
        });

        // Vinheta "respira" no ritmo da TENSÃO da corrente: quanto mais perto
        // de arrebentar, mais a tela pulsa (tensão/ansiedade). Sem tensão (ou
        // desconectada), fica estável.
        const strain = (this.chain.isConnected && this.chain.weapon)
            ? (this.chain.weapon.strain ?? 0) : 0;
        this.postProcessor.setVignetteBreath(strain);

        this.postProcessor.draw();

        // Corações de cura POR CIMA de todos os efeitos (luz, vinheta, sangue,
        // fumaça, partículas): sprite + brilho + feixe diagonal, no transform
        // do mundo — como um item "pega-me" que nunca some no escuro.
        const hearts = rooms.current.hearts;
        if (hearts.length) {
            renderer.beginOverlayWorld();
            hearts.forEach(h => h.drawOverlay(ctx));
            renderer.endOverlayWorld();
        }

        // Poeira/vento em espaço de TELA (visível na cena toda, inclusive no
        // escuro). Só quando WIND.layer === "screen".
        if (WIND.layer === "screen") this.wind.drawScreen(ctx, (x, y) => renderer.worldToScreen(x, y));

        this._renderOverlays();
    }

    _renderOverlays() {
        const { ctx, canvas } = this;

        // Feedback de "kill" (sangue voando + flash vermelho) por cima da cena,
        // mas por baixo de transição/game over.
        this.screenGore.draw(ctx);

        if (this.transition) {
            const t = this.transition;
            const a = t.phase === "out" ? t.t : (1 - t.t);
            ctx.fillStyle = `rgba(8, 7, 14, ${Math.max(0, Math.min(1, a))})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // HUD "vtuber" por cima do fade de transição (os retratos reagem à
        // sala nova enquanto a tela escurece); a tela de morte (DOM) fica acima.
        this.hud.draw(ctx, canvas.width, canvas.height);

        // Fim de jogo: a tela de morte (DOM, js/ui/DeathScreen.js) cobre a cena.
    }
}
