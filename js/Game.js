import { InputHandler } from './core/InputHandler.js';
import { Physics } from './core/Physics.js';
import { Chain } from './core/Chain.js';
import { Renderer } from './core/Renderer.js';
import { Tileset } from './core/Tileset.js';
import { AssetLoader } from './core/AssetLoader.js';
import { AudioManager } from './core/AudioManager.js';

import { SawWeapon } from './weapons/SawWeapon.js';

import { ParticleSystem } from './particles/ParticleSystem.js';
import { BloodCanvas } from './particles/BloodCanvas.js';

import { PlayerFactory } from './entities/PlayerFactory.js';
import { SpawnSystem } from './systems/SpawnSystem.js';
import { ParticleEffects } from './systems/ParticleEffects.js';
import { CombatSystem } from './combat/CombatSystem.js';
import { RoomManager } from './rooms/RoomManager.js';
import { PostProcessor } from './systems/PostProcessor.js';
import { WindSystem } from './systems/WindSystem.js';

import {
    TILE, WORLD_W, WORLD_H, BLOOD_COLORS, BLOOD_PIXEL,
    MAX_PLAYER_SEPARATION, CAM_MARGIN, CAMERA_DRONE, TRANSITION_SPEED,
    DOOR_STUB_TILES, DOOR_ENTER_DEPTH, BACKGROUND_TILE,
    PLAYER_LIGHT_RADIUS, LIGHT_PIXEL_SCALE, TORCHES, DOOR_LIGHT, WIND,
    getPlayerSpawnPositions, HOLE_TILE, HOLE_TILES, holeTileFor, AUDIO_CONFIG, AUDIO_CLIPS,
    SIM_STEP, MAX_SIM_STEPS_PER_FRAME, PLAYER_SAFE_ZONE, HIT_SLOWMO
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
        this.assets = new AssetLoader();
        this._bindResize();

        // HUD (DOM)
        this.hud = {
            floor: document.getElementById("hud-floor"),
            p1: document.getElementById("hud-p1"),
            p2: document.getElementById("hud-p2"),
            btnWeapon: document.getElementById("btn-weapon"),
            btnRestart: document.getElementById("btn-restart")
        };

        // Subsistemas de render / mundo
        this.renderer = new Renderer(canvas, this.ctx);
        this.renderer.setTileset(new Tileset(this.assets.tileset, 16, 10));
        this.renderer.setAssets(this.assets);
        // Informa o tamanho do tile no mundo para a quantização do zoom
        // (mantém a grade de tiles alinhada ao pixel de tela — tiles fixos).
        this.renderer.setTileWorldSize(TILE);

        // Pós-processamento de tela (vinheta de masmorra).
        this.postProcessor = new PostProcessor(canvas, this.ctx);

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
        // A corrente une os jogadores e porta a arma ativa. Se insistirem em se
        // separar além do limite, ela ARREBENTA (empurrão elástico) e os
        // jogadores ficam DESARMADOS até se reaproximarem. Ajuste os "dials"
        // (tensão, ruptura, reconexão) aqui.
        this.chain = new Chain([new SawWeapon(this.assets.saw, this.assets.cable)], {
            rest: 130,
            stiffness: 0.02,
            breakDistance: 240,
            strainDistance: 165,
            strainLimit: 30,
            reconnectDistance: 110,
            snapImpulse: 12,
            playerSafeZone: PLAYER_SAFE_ZONE
        });

        // Fábricas / sistemas
        this.playerFactory = new PlayerFactory({ assets: this.assets, bloodCanvas: this.bloodCanvas });
        this.spawnSystem = new SpawnSystem({ assets: this.assets, bloodCanvas: this.bloodCanvas });
        this.combat = new CombatSystem({ renderer: this.renderer, particleSystem: this.particleSystem, audio: this.audio });
        this.effects = new ParticleEffects({ particleSystem: this.particleSystem, bloodCanvas: this.bloodCanvas, audio: this.audio });
        this.rooms = new RoomManager({ spawnSystem: this.spawnSystem, getFloor: () => this.floor, roomCatalog: this.roomCatalog });

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
        this._doorFlashT = 0;    // segundos restantes do flash de "porta aberta"
        this._lastFrameTimestamp = null;
        this._simAccumulator = 0; // acumulador de tempo do fixed timestep (s)
        this._slowmoT = 0;        // segundos restantes de slow-motion de abate

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
        this.updateHud();
        this._loop = this._loop.bind(this);
        requestAnimationFrame(this._loop);
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

    _bindButtons() {
        // Só existe uma arma (serras). O botão é apenas informativo; mantém o
        // texto/estilo em sincronia via updateHud.
        this.hud.btnRestart.addEventListener("click", () => {
            this.floor = 1;
            this.players = this.playerFactory.create();
            [this.p1, this.p2] = this.players;
            this.newDungeon();
        });
    }

    // Gera uma nova dungeon e posiciona os jogadores na sala inicial.
    newDungeon() {
        this.rooms.reset();
        this.gibs = [];
        this.effects.clear();
        this.transition = null;
        this.particleSystem.clear();
        this.gameOver = false;

        // A corrente começa conectada a cada nova dungeon.
        this.chain.reset();

        this.rooms.enter();
        this.arenaBounds = this.rooms.currentBounds;

        const rect = this.rooms.cellRect();
        const spawns = getPlayerSpawnPositions("CENTER", rect.x, rect.y, TILE);
        this.p1.x = spawns.p1.x; this.p1.y = spawns.p1.y; this.p1.vx = 0; this.p1.vy = 0;
        this.p2.x = spawns.p2.x; this.p2.y = spawns.p2.y; this.p2.vx = 0; this.p2.vy = 0;

        // No modo de teste do editor, o spawn central pode cair sobre um buraco
        // (morte instantânea em loop). Reposiciona cada player no tile de piso
        // seguro mais próximo do centro.
        if (this.playtest) {
            this._ensureSafeSpawn(this.p1, rect);
            this._ensureSafeSpawn(this.p2, rect);
        }

        const center = this.rooms.cellCenter();
        this.renderer.camX = center.x;
        this.renderer.camY = center.y;
        this.renderer.resetSway();

        this.updateHud();
    }

    // Garante que um jogador não nasça sobre um buraco (-1): se o tile atual for
    // abismo, busca em espiral o tile de piso válido mais próximo e recoloca o
    // jogador no centro dele.
    _ensureSafeSpawn(player, rect) {
        const tiles = this.rooms.currentTiles;
        if (!tiles || !tiles.floor) return;
        const floor = tiles.floor;

        const col = Math.floor((player.x - rect.x) / TILE);
        const row = Math.floor((player.y - rect.y) / TILE);

        const isSafe = (c, r) => {
            const line = floor[r];
            // Dentro da sala, não ser parede de borda e não ser buraco.
            return !!line && line[c] !== undefined && line[c] >= 0 &&
                c > 0 && r > 0 && c < tiles.cols - 1 && r < tiles.rows - 1;
        };

        if (isSafe(col, row)) return;

        // Busca em anéis crescentes ao redor do tile original.
        const maxR = Math.max(tiles.cols, tiles.rows);
        for (let radius = 1; radius < maxR; radius++) {
            for (let dr = -radius; dr <= radius; dr++) {
                for (let dc = -radius; dc <= radius; dc++) {
                    if (Math.max(Math.abs(dr), Math.abs(dc)) !== radius) continue;
                    const c = col + dc, r = row + dr;
                    if (isSafe(c, r)) {
                        player.x = rect.x + (c + 0.5) * TILE;
                        player.y = rect.y + (r + 0.5) * TILE;
                        player.vx = 0; player.vy = 0;
                        return;
                    }
                }
            }
        }
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

        // Entrou numa sala já ABERTA (sem combate / já limpa): dispara o flash
        // amarelo das portas indicando que estão abertas.
        if (!this.rooms.isLocked()) this._triggerDoorFlash();

        this.updateHud();
    }

    // Dispara o flash temporário de "porta aberta" (pulsa e enfraquece).
    _triggerDoorFlash() {
        this._doorFlashT = DOOR_LIGHT.flashDuration;
    }

    // Dispara o slow-motion de abate: a simulação desacelera e volta suave ao
    // normal, dando peso ao golpe sem travar. Reinicia o timer para o cheio, de
    // modo que mortes em sequência renovem (não encurtem) o efeito.
    triggerHitSlowmo() {
        this._slowmoT = HIT_SLOWMO.duration;
    }

    // Fator de velocidade atual da simulação (0..1). Em slow-motion começa em
    // HIT_SLOWMO.minScale (quando o timer está cheio) e sobe suavemente até 1
    // conforme o timer esvazia, usando easeOutCubic (desacelera a recuperação
    // perto do fim, deixando a volta ao normal bem macia). Sem efeito ativo
    // retorna 1 (velocidade cheia).
    _slowmoTimeScale() {
        if (this._slowmoT <= 0) return 1;
        const duration = HIT_SLOWMO.duration || 1;
        // progress: 0 no início do efeito (mais lento) -> 1 no fim (normal).
        const progress = 1 - this._slowmoT / duration;
        const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
        return HIT_SLOWMO.minScale + (1 - HIT_SLOWMO.minScale) * eased;
    }

    updateHud() {
        const c = this.rooms.currentCell;
        const tag = c.kind === "corridor" ? "CORREDOR" : (c.type === "boss" ? "SALA DO CHEFE" : "SALA");
        this.hud.floor.innerText = `DUNGEON ${this.floor} — ${tag}`;
        this.hud.p1.innerText = `P1 (Amarelo): ${"❤️".repeat(Math.max(0, this.p1.lives))}`;
        this.hud.p2.innerText = `P2 (Azul): ${"❤️".repeat(Math.max(0, this.p2.lives))}`;

        // Botão de arma reflete o estado da corrente: quando arrebentada, avisa
        // os jogadores que estão desarmados e precisam se reaproximar.
        if (this.chain.isConnected) {
            this.hud.btnWeapon.innerText = `ARMA: ${this.chain.name}`;
            this.hud.btnWeapon.style.background = "#8d99ae";
        } else {
            this.hud.btnWeapon.innerText = "ARMA QUEBRADA! APROXIMEM-SE";
            this.hud.btnWeapon.style.background = "#555";
        }
    }

    // Limite físico de afastamento entre os players (teto rígido).
    enforceSeparationLimit() {
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

    // ---- Loop ----
    //
    // Fixed timestep (acumulador): o render roda na taxa do monitor via
    // requestAnimationFrame, mas a SIMULAÇÃO roda em passos fixos de SIM_STEP
    // (1/60 s). Assim a velocidade de movimento, a física e os timers (contados
    // em "frames" de 60fps no restante do código) ficam idênticos em qualquer
    // taxa de atualização de tela (60Hz, 144Hz, 240Hz...).
    _loop(timestamp) {
        const frameSeconds = this._lastFrameTimestamp === null
            ? 0
            : Math.min(Math.max((timestamp - this._lastFrameTimestamp) / 1000, 0), 0.25);
        this._lastFrameTimestamp = timestamp;

        // Slow-motion de abate: enquanto ativo, a SIMULAÇÃO roda em câmera
        // lenta e volta suave ao normal (sem travar seco). O timer corre em
        // tempo REAL; o fator de velocidade começa em minScale no pico e sobe
        // até 1 com easing. Só o tempo ESCALADO alimenta o acumulador, então o
        // mundo desacelera sem perder a independência de framerate.
        const timeScale = this._slowmoTimeScale();
        if (this._slowmoT > 0) {
            this._slowmoT = Math.max(0, this._slowmoT - frameSeconds);
        }

        this._simAccumulator += frameSeconds * timeScale;

        // Teto de passos por quadro: se o quadro atrasou muito (aba em segundo
        // plano, stall de GC), descarta o excesso para não travar numa "espiral
        // da morte" tentando recuperar dezenas de passos de uma vez.
        if (this._simAccumulator > SIM_STEP * MAX_SIM_STEPS_PER_FRAME) {
            this._simAccumulator = SIM_STEP * MAX_SIM_STEPS_PER_FRAME;
        }

        while (this._simAccumulator >= SIM_STEP) {
            this._step(SIM_STEP);
            this._simAccumulator -= SIM_STEP;
        }

        this._render();
        requestAnimationFrame(this._loop);
    }

    // Um passo lógico de tamanho fixo (SIM_STEP segundos).
    _step(deltaSeconds) {
        if (this.gameOver) return;
        if (this.transition) {
            this._updateTransition();
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
        this.updateHud();
    }

    _updateGameplay(deltaSeconds = 1 / 60) {
        const { p1, p2, rooms } = this;
        this.arenaBounds = rooms.currentBounds;
        const room = rooms.current;

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
                // flash branco luminoso no ponto da serra.
                const fx = (p1.x + p2.x) / 2;
                const fy = (p1.y + p2.y) / 2;
                const r = this.chain.weapon?.discRadius ?? 24;
                this.particleSystem.triggerSparkBurst(fx, fy, r, 12, 1.2);
                this.particleSystem.triggerFlash(fx, fy, 12, 1);
            },
            onReconnect: () => this.renderer.triggerShake(4)
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
            const sawX = (p1.x + p2.x) / 2;
            const sawY = (p1.y + p2.y) / 2;
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
        if (room.challenge) room.challenge.update([p1, p2], deltaSeconds);

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
                // Centro recalculado a cada iteração (segue o meio da corrente).
                const cx = (p1.x + p2.x) / 2;
                const cy = (p1.y + p2.y) / 2;
                for (const e of allEntities) {
                    Physics.resolveCircleCollision(e, cx, cy, sawR);
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

        // Queda em buracos/abismos: se o centro do jogador está sobre um tile
        // sem piso (-1), ele cai e morre. A posição já está confinada acima.
        this._checkHoleFalls([p1, p2]);

        // Arma: a animação já é atualizada por chain.update(). O dano só é
        // aplicado quando a corrente está conectada (desarmada = sem dano).
        this.combat.resolveWeaponHits(
            this.chain.weapon, enemies, p1, p2, this.chain.isConnected,
            () => this.triggerHitSlowmo()
        );
        this.combat.resolveDeaths(room, this.gibs);

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

        // Flash de "porta aberta": decai ao longo do tempo até sumir.
        if (this._doorFlashT > 0) {
            this._doorFlashT = Math.max(0, this._doorFlashT - deltaSeconds);
        }

        // Sala limpa quando sem inimigos. No instante em que destrava, dispara
        // o flash amarelo nas portas (pulsa um momento e enfraquece).
        if (rooms.tryClearCurrent()) {
            this._triggerDoorFlash();
        }

        this.particleSystem.update([p1, p2], this.arenaBounds);
        this.wind.update(this.arenaBounds);

        if (p1.lives <= 0 || p2.lives <= 0) this.gameOver = true;

        this._checkDoorTransition(doors);
        this._updateCameraToCurrentRoom(deltaSeconds);
        this.updateHud();
    }

    // Verifica se cada jogador está sobre um tile de buraco (-1). Em caso
    // positivo, dispara a queda (que leva à morte ao fim da animação). Usa o
    // centro do jogador convertido para coordenada de tile da sala atual.
    _checkHoleFalls(players) {
        const tiles = this.rooms.currentTiles;
        if (!tiles || !tiles.floor) return;
        const rect = this.rooms.cellRect();

        for (const p of players) {
            if (p.falling) continue;
            const col = Math.floor((p.x - rect.x) / TILE);
            const row = Math.floor((p.y - rect.y) / TILE);
            const line = tiles.floor[row];
            if (line && line[col] === HOLE_TILE) {
                // Centro do tile do buraco, para o sprite afundar alinhado.
                const cx = rect.x + (col + 0.5) * TILE;
                const cy = rect.y + (row + 0.5) * TILE;
                p.startFalling(cx, cy);
            }
        }
    }

    // Retângulos (mundo) dos tiles de MIOLO ESCURO de buraco na sala atual.
    // Usados para FURAR o clip do sangue, garantindo que nenhuma mancha (gotas,
    // poças, serra) apareça sobre a parte escura dos buracos. Bordas de buraco
    // e piso (incl. espinhos) ficam de fora da exclusão, então recebem sangue.
    _darkHoleRects() {
        const tiles = this.rooms.currentTiles;
        if (!tiles || !tiles.floor) return null;
        const rect = this.rooms.cellRect();
        const rects = [];
        for (let r = 0; r < tiles.floor.length; r++) {
            const line = tiles.floor[r];
            for (let c = 0; c < line.length; c++) {
                if (line[c] !== HOLE_TILE) continue;
                if (holeTileFor(tiles.floor, c, r) !== HOLE_TILES[0]) continue; // só o miolo
                rects.push({ x: rect.x + c * TILE, y: rect.y + r * TILE, w: TILE, h: TILE });
            }
        }
        return rects.length ? rects : null;
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

        this.particleSystem.drawFloor(ctx, this.arenaBounds, this._darkHoleRects());
        this.effects.draw(ctx);
        this.particleSystem.drawSmoke(ctx);

        // Desafio co-op: botões e spikes ficam no CHÃO (sob as entidades).
        const challenge = rooms.current.challenge;
        if (challenge) challenge.drawFloorLayer(ctx);

        // Corações de cura: desenhados no CHÃO, sob as entidades e suas sombras.
        rooms.current.hearts.forEach(h => h.draw(ctx));

        const p1Bounce = this.p1.speedMag > 0.15 ? Math.abs(Math.sin(this.p1.animTimer)) : 0;
        const p2Bounce = this.p2.speedMag > 0.15 ? Math.abs(Math.sin(this.p2.animTimer)) : 0;
        renderer.drawRoundShadow(this.p1.x, this.p1.y, 14, p1Bounce);
        renderer.drawRoundShadow(this.p2.x, this.p2.y, 14, p2Bounce);
        const enemies = rooms.current.enemies;
        enemies.forEach(e => renderer.drawRoundShadow(e.x, e.y, 13, 0));

        // Corrente (linha) da arma: SEMPRE ao fundo, atrás de todas as
        // entidades. Só o disco entra na ordenação por profundidade.
        this.chain.drawChain(ctx, this.p1, this.p2);

        // Profundidade pelo DISCO da serra: ele fica no meio da corrente
        // (sawY). Quem está mais ACIMA (y <= sawY, "ao fundo") é desenhado
        // ANTES e fica atrás do disco; quem está mais ABAIXO (y > sawY, "à
        // frente") é desenhado DEPOIS e fica na frente dele. Ordenado por Y.
        const sawY = (this.p1.y + this.p2.y) / 2;
        const drawables = [this.p1, this.p2, ...enemies].sort((a, b) => a.y - b.y);

        drawables.filter(e => e.y <= sawY).forEach(e => e.draw(ctx));

        // Disco da serra: só aparece quando conectada (a Chain cuida disso).
        this.chain.draw(ctx, this.p1, this.p2);

        // Faíscas da serra: por cima do disco (centelhas saltando).
        this.particleSystem.drawSparks(ctx);

        drawables.filter(e => e.y > sawY).forEach(e => e.draw(ctx));

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
        // cena mas por baixo dos overlays de UI/transição/game over.
        // Registra uma luz na posição (de tela) de cada jogador. O raio em
        // mundo (PLAYER_LIGHT_RADIUS) é convertido para tela pelo zoom.
        for (const p of [this.p1, this.p2]) {
            const s = renderer.worldToScreen(p.x, p.y);
            // pixel de arte do cenário na tela ~= (TILE/16) * zoom. Escalamos
            // por LIGHT_PIXEL_SCALE (config) para a elipse de luz ficar chunky.
            const lightPixel = Math.max(2, Math.round((TILE / 16) * s.zoom * LIGHT_PIXEL_SCALE));
            this.postProcessor.addLight(s.x, s.y, PLAYER_LIGHT_RADIUS * s.zoom, lightPixel);
        }

        // Luzes das TOCHAS de parede (pontos de luz naturais do cenário). Cada
        // tocha registrada em tiles.torches vira uma luz suave na sua posição.
        if (TORCHES.enabled && tiles.torches && tiles.torches.length) {
            const tl = TORCHES.light;
            for (const t of tiles.torches) {
                // Centro do tile da tocha no mundo + deslocamento para o lado de
                // DENTRO da sala, onde a chama de fato ilumina:
                //   N  -> empurra para baixo (offsetY)
                //   W  -> empurra para a direita (offsetX)
                //   E  -> empurra para a esquerda (-offsetX)
                let wx = rect.x + t.col * TILE + TILE / 2;
                let wy = rect.y + t.row * TILE + TILE / 2;
                if (t.side === "N") wy += tl.offsetY;
                else if (t.side === "S") wy -= tl.offsetY; // empurra para dentro (para cima)
                else if (t.side === "W") wx += tl.offsetX;
                else if (t.side === "E") wx -= tl.offsetX;

                const s = renderer.worldToScreen(wx, wy);
                const px = Math.max(2, Math.round((TILE / 16) * s.zoom * tl.pixelScale));
                this.postProcessor.addLight(s.x, s.y, tl.radius * s.zoom, px, tl.flatten, tl);
            }
        }

        // Luz amarela TEMPORÁRIA das PORTAS: dispara quando a porta abre
        // (sala destravada ou entrada numa sala já aberta), pulsa suavemente por
        // um instante e enfraquece até sumir. Controlada pelo timer
        // _doorFlashT (segundos restantes). O foco é empurrado para DENTRO da
        // sala e o halo é alongado no eixo de projeção, de modo que a luz pareça
        // SAIR do vão e se espalhar na direção contrária à parede.
        if (DOOR_LIGHT.enabled && this._doorFlashT > 0 && open && doors && doors.length) {
            const dl = DOOR_LIGHT;
            // Progresso 0..1 do início ao fim do flash.
            const prog = 1 - this._doorFlashT / dl.flashDuration;
            // Envelope de enfraquecimento: começa cheio e cai até 0 no fim.
            const fade = Math.pow(1 - prog, dl.fadeExponent);
            // Pulso suave sobreposto ao fade (respira sem piscar bruscamente).
            const pulse = 1 + Math.sin(prog * dl.flashDuration * dl.pulseSpeed) * dl.pulseDepth;
            // O desvanecimento é por OPACIDADE (alpha), NÃO por tamanho: a
            // GEOMETRIA do feixe (comprimento, boca, início) fica FIXA o flash
            // todo, então ele não encolhe nem "anda para trás" — só perde brilho.
            const alphaScale = Math.max(0, fade * pulse);
            // Perfil neutro: cor amarela + falloff próprio, SEM flicker do
            // PostProcessor (o pulso/fade já vêm do alphaScale).
            const profile = {
                color: dl.color,
                flickerBase: 1, flickerSine: 0, flickerNoise: 0,
                falloff: [
                    { offset: 0.0, alpha: 0.9 },
                    { offset: 0.4, alpha: 0.5 },
                    { offset: 0.7, alpha: 0.2 },
                    { offset: 0.9, alpha: 0.06 },
                    { offset: 1.0, alpha: 0.0 }
                ]
            };
            for (const door of doors) {
                // Direção do feixe: para DENTRO da sala (contrária à parede).
                //   N (topo)    -> aponta para baixo
                //   S (base)    -> aponta para cima
                //   W (esquerda)-> aponta para a direita
                //   E (direita) -> aponta para a esquerda
                let dx = 0, dy = 0;
                if (door.dir === "N") dy = 1;
                else if (door.dir === "S") dy = -1;
                else if (door.dir === "W") dx = 1;
                else if (door.dir === "E") dx = -1;

                // Recuo do apex ATRÁS da porta derivado da LARGURA do vão: para
                // a boca do cone cobrir a porta de ponta a ponta, a meia-largura
                // do feixe no plano da porta deve ser = doorHalf. Como essa
                // meia-largura ~= apexBehind * tan(spread), isolamos apexBehind.
                const apexBehind = doorHalf / Math.tan(dl.spread);

                // Apex ATRÁS da porta (lado de fora da sala): recua na direção
                // OPOSTA ao feixe, de modo que o cone nasça atrás do vão, já
                // tenha a largura da porta ao cruzar a soleira e se projete para
                // dentro da sala.
                const wx = door.x - dx * apexBehind;
                const wy = door.y - dy * apexBehind;

                const s = renderer.worldToScreen(wx, wy);
                const px = Math.max(2, Math.round((TILE / 16) * s.zoom * dl.pixelScale));
                // Comprimento = recuo atrás da porta + alcance dentro da sala,
                // para render o mesmo alcance interno mesmo nascendo atrás do
                // vão. intensity (pulso×fade) escala o comprimento: encolhe e
                // some ao final do flash.
                // Geometria FIXA (não escala com o fade): comprimento = recuo
                // atrás da porta + alcance dentro da sala.
                const beamLen = (dl.length + apexBehind) * s.zoom;
                // O feixe só aparece A PARTIR do plano da porta (startDist =
                // apexBehind): recorta a ponta atrás do vão. Como a boca fica no
                // plano da porta, nasce já com a largura do vão.
                const startDist = apexBehind * s.zoom;
                // O desvanecer vai no alphaScale (opacidade), mantendo o tamanho.
                // startFade suaviza o início do feixe na soleira da porta.
                this.postProcessor.addSpotLight(
                    s.x, s.y, dx, dy, beamLen, dl.spread, px, profile, startDist, alphaScale, dl.startFade
                );
            }
        }

        this.postProcessor.draw();

        // Poeira/vento em espaço de TELA (visível na cena toda, inclusive no
        // escuro). Só quando WIND.layer === "screen".
        if (WIND.layer === "screen") this.wind.drawScreen(ctx, (x, y) => renderer.worldToScreen(x, y));

        this._renderOverlays();
    }

    _renderOverlays() {
        const { ctx, canvas } = this;
        if (this.transition) {
            const t = this.transition;
            const a = t.phase === "out" ? t.t : (1 - t.t);
            ctx.fillStyle = `rgba(8, 7, 14, ${Math.max(0, Math.min(1, a))})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        if (this.gameOver) {
            ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "#e53170";
            ctx.font = "bold 44px monospace";
            ctx.textAlign = "center";
            ctx.fillText("FIM DE JOGO!", canvas.width / 2, canvas.height / 2 - 20);
            ctx.fillStyle = "#fffffe";
            ctx.font = "20px monospace";
            ctx.fillText(`Vocês exploraram a Dungeon ${this.floor}`, canvas.width / 2, canvas.height / 2 + 25);
            ctx.fillText("Pressione 'REINICIAR' para tentar novamente", canvas.width / 2, canvas.height / 2 + 60);
            ctx.textAlign = "start";
        }
    }
}
