import { InputHandler } from './core/InputHandler.js';
import { Physics } from './core/Physics.js';
import { Renderer } from './core/Renderer.js';
import { Tileset } from './core/Tileset.js';
import { AssetLoader } from './core/AssetLoader.js';

import { LaserWeapon } from './weapons/LaserWeapon.js';
import { SawWeapon } from './weapons/SawWeapon.js';

import { ParticleSystem } from './particles/ParticleSystem.js';
import { BloodCanvas } from './particles/BloodCanvas.js';

import { PlayerFactory } from './entities/PlayerFactory.js';
import { SpawnSystem } from './systems/SpawnSystem.js';
import { ParticleEffects } from './systems/ParticleEffects.js';
import { CombatSystem } from './combat/CombatSystem.js';
import { RoomManager } from './rooms/RoomManager.js';
import { PostProcessor } from './systems/PostProcessor.js';

import {
    TILE, WORLD_W, WORLD_H, BLOOD_COLORS, BLOOD_PIXEL,
    MAX_PLAYER_SEPARATION, CAM_MARGIN, TRANSITION_SPEED,
    DOOR_STUB_TILES, DOOR_ENTER_DEPTH, BACKGROUND_TILE,
    PLAYER_LIGHT_RADIUS, LIGHT_PIXEL_SCALE, TORCHES
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
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.ctx.imageSmoothingEnabled = false;

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
        // Informa o tamanho do tile no mundo para a quantização do zoom
        // (mantém a grade de tiles alinhada ao pixel de tela — tiles fixos).
        this.renderer.setTileWorldSize(TILE);

        // Pós-processamento de tela (vinheta de masmorra).
        this.postProcessor = new PostProcessor(canvas, this.ctx);

        // Sangue cobre o mundo inteiro
        this.bloodCanvas = new BloodCanvas(WORLD_W, WORLD_H, BLOOD_COLORS, BLOOD_PIXEL);
        this.particleSystem = new ParticleSystem(this.bloodCanvas);

        // Entrada e armas
        this.input = new InputHandler();
        this.weapons = [new LaserWeapon(), new SawWeapon()];
        this.currentWeaponIndex = 0;

        // Fábricas / sistemas
        this.playerFactory = new PlayerFactory({ assets: this.assets, bloodCanvas: this.bloodCanvas });
        this.spawnSystem = new SpawnSystem({ assets: this.assets, bloodCanvas: this.bloodCanvas });
        this.combat = new CombatSystem({ renderer: this.renderer, particleSystem: this.particleSystem });
        this.effects = new ParticleEffects({ particleSystem: this.particleSystem, bloodCanvas: this.bloodCanvas });
        this.rooms = new RoomManager({ spawnSystem: this.spawnSystem, getFloor: () => this.floor });

        // Estado de jogo
        this.floor = 1;
        this.gameOver = false;
        this.players = [];
        this.p1 = null;
        this.p2 = null;
        this.arenaBounds = null;
        this.gibs = [];
        this.transition = null; // { phase: "out"|"in", t, door }

        this._bindButtons();
    }

    get currentWeapon() {
        return this.weapons[this.currentWeaponIndex];
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
        this.hud.btnWeapon.addEventListener("click", () => {
            this.currentWeaponIndex = (this.currentWeaponIndex + 1) % this.weapons.length;
            const w = this.currentWeapon;
            this.hud.btnWeapon.innerText = `ARMA: ${w.name}`;
            this.hud.btnWeapon.style.background = w.name === "SERRAS" ? "#ff5470" : "#e53170";
        });
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

        const center = this.rooms.cellCenter();
        this.p1.x = center.x - 30; this.p1.y = center.y; this.p1.vx = 0; this.p1.vy = 0;
        this.p2.x = center.x + 30; this.p2.y = center.y; this.p2.vx = 0; this.p2.vy = 0;

        this.renderer.camX = center.x;
        this.renderer.camY = center.y;

        this.rooms.enter();
        this.arenaBounds = this.rooms.currentBounds;
        this.updateHud();
    }

    // Move para a sala vizinha através de uma porta, reposicionando os players.
    transitionThroughDoor(door) {
        this.rooms.transitionTo(door);
        this.arenaBounds = this.rooms.currentBounds;

        const nb = this.arenaBounds;
        const cx = (nb.minX + nb.maxX) / 2, cy = (nb.minY + nb.maxY) / 2;
        let ex = cx, ey = cy;
        const inset = 90;
        if (door.dir === "N") { ey = nb.maxY - inset; ex = cx; }
        else if (door.dir === "S") { ey = nb.minY + inset; ex = cx; }
        else if (door.dir === "E") { ex = nb.minX + inset; ey = cy; }
        else if (door.dir === "W") { ex = nb.maxX - inset; ey = cy; }

        this.p1.x = ex - 24; this.p1.y = ey; this.p1.vx = 0; this.p1.vy = 0;
        this.p2.x = ex + 24; this.p2.y = ey; this.p2.vx = 0; this.p2.vy = 0;
        this.updateHud();
    }

    updateHud() {
        const c = this.rooms.currentCell;
        const tag = c.kind === "corridor" ? "CORREDOR" : (c.type === "boss" ? "SALA DO CHEFE" : "SALA");
        this.hud.floor.innerText = `DUNGEON ${this.floor} — ${tag}`;
        this.hud.p1.innerText = `P1 (Amarelo): ${"❤️".repeat(Math.max(0, this.p1.lives))}`;
        this.hud.p2.innerText = `P2 (Azul): ${"❤️".repeat(Math.max(0, this.p2.lives))}`;
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
    _updateCameraToCurrentRoom() {
        const rect = this.rooms.cellRect();
        const fitZoom = Math.min(
            this.canvas.width / (rect.w + CAM_MARGIN * 2),
            this.canvas.height / (rect.h + CAM_MARGIN * 2)
        );
        this.renderer.updateCamera({
            x: rect.x + rect.w / 2, y: rect.y + rect.h / 2, zoom: fitZoom
        });
    }

    // ---- Loop ----
    _loop() {
        if (!this.gameOver && this.transition) {
            this._updateTransition();
        } else if (!this.gameOver) {
            this._updateGameplay();
        }
        this._render();
        requestAnimationFrame(this._loop);
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
        this._updateCameraToCurrentRoom();
        this.updateHud();
    }

    _updateGameplay() {
        const { p1, p2, rooms } = this;
        this.arenaBounds = rooms.currentBounds;
        const room = rooms.current;

        p1.update(this.input, this.arenaBounds);
        p2.update(this.input, this.arenaBounds);

        this.effects.processPlayer(p1);
        this.effects.processPlayer(p2);

        // Corrente elástica + teto rígido de afastamento
        Physics.applyChainConstraint(p1, p2);
        this.enforceSeparationLimit();

        // Inimigos: IA + dano no player (feedback via CombatSystem)
        const enemies = room.enemies;
        this.combat.updateEnemies(enemies, [p1, p2]);

        // Colisões entre entidades (3 iterações)
        const liveEnemies = enemies.filter(e => e.state !== "dying");
        const allEntities = [p1, p2, ...liveEnemies];
        for (let it = 0; it < 3; it++) Physics.resolveEntityCollisions(allEntities);

        // Confinamento: inimigos presos; players podem adentrar portas abertas
        enemies.forEach(e => rooms.clampEnemy(e, this.arenaBounds));
        const doors = rooms.doorsOfCurrent();
        const canPass = !rooms.isLocked();
        rooms.clampPlayer(p1, this.arenaBounds, doors, canPass);
        rooms.clampPlayer(p2, this.arenaBounds, doors, canPass);

        // Arma
        this.currentWeapon.update();
        this.combat.resolveWeaponHits(this.currentWeapon, enemies, p1, p2);
        this.combat.resolveDeaths(room, this.gibs);

        // Gibs
        for (let i = this.gibs.length - 1; i >= 0; i--) {
            this.gibs[i].update(this.arenaBounds);
            if (this.gibs[i].done) this.gibs.splice(i, 1);
        }

        // Pegadas / poeira
        this.effects.update();

        // Sala limpa quando sem inimigos
        rooms.tryClearCurrent();

        this.particleSystem.update([p1, p2], this.arenaBounds);

        if (p1.lives <= 0 || p2.lives <= 0) this.gameOver = true;

        this._checkDoorTransition(doors);
        this._updateCameraToCurrentRoom();
        this.updateHud();
    }

    // Dispara a transição quando ambos os players adentraram o mesmo vão.
    _checkDoorTransition(doors) {
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

        this.particleSystem.drawFloor(ctx, this.arenaBounds);
        this.effects.draw(ctx);
        this.particleSystem.drawSmoke(ctx);

        const p1Bounce = this.p1.speedMag > 0.15 ? Math.abs(Math.sin(this.p1.animTimer)) : 0;
        const p2Bounce = this.p2.speedMag > 0.15 ? Math.abs(Math.sin(this.p2.animTimer)) : 0;
        renderer.drawRoundShadow(this.p1.x, this.p1.y, 14, p1Bounce);
        renderer.drawRoundShadow(this.p2.x, this.p2.y, 14, p2Bounce);
        const enemies = rooms.current.enemies;
        enemies.forEach(e => renderer.drawRoundShadow(e.x, e.y, 13, 0));

        this.currentWeapon.draw(ctx, this.p1, this.p2);

        const drawables = [this.p1, this.p2, ...enemies].sort((a, b) => a.y - b.y);
        drawables.forEach(e => e.draw(ctx));

        renderer.drawFrontWall(rect, tiles, TILE, open, doors, doorHalf, DOOR_STUB_TILES);

        this.gibs.forEach(g => g.draw(ctx));
        this.particleSystem.drawAir(ctx);

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
                else if (t.side === "W") wx += tl.offsetX;
                else if (t.side === "E") wx -= tl.offsetX;

                const s = renderer.worldToScreen(wx, wy);
                const px = Math.max(2, Math.round((TILE / 16) * s.zoom * tl.pixelScale));
                this.postProcessor.addLight(s.x, s.y, tl.radius * s.zoom, px, tl.flatten, tl);
            }
        }

        this.postProcessor.draw();

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
