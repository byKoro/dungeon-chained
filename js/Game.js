import { DemoEncounter } from './systems/DemoEncounter.js';
import { DemoVictory } from './ui/DemoVictory.js';
import { DemoProgress } from './systems/DemoProgress.js';
import { DemoCamera } from './systems/DemoCamera.js';
import { DemoDoors } from './systems/DemoDoors.js';
import { ThrownSaw } from './systems/ThrownSaw.js';
import { PropSprites } from './core/PropSprites.js';
import { InputHandler } from './core/InputHandler.js';
import { MenuPad } from './core/MenuPad.js';
import { Physics } from './core/Physics.js';
import { Chain } from './core/Chain.js';
import { Renderer } from './core/Renderer.js';
import { Tileset } from './core/Tileset.js';
import { AssetLoader } from './core/AssetLoader.js';
import { AudioManager } from './core/AudioManager.js';
import { GameLoop } from './core/GameLoop.js';

import { SawWeapon } from './weapons/SawWeapon.js';
import { SawMotorAudio } from './weapons/SawMotorAudio.js';

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
import { HoleEffects } from './systems/HoleEffects.js';
import { VtuberHud } from './ui/VtuberHud.js';
import { DeathScreen } from './ui/DeathScreen.js';
import { PauseScreen } from './ui/PauseScreen.js';
import { setUiAudio, playUi } from './ui/UiSound.js';
import { MasterVolume } from './core/MasterVolume.js';
import { HeartPickup } from './entities/HeartPickup.js';
import { playerConfigs } from './config/EntityConfig.js';

import {
    TILE, WORLD_W, WORLD_H, BLOOD_COLORS, BLOOD_PIXEL,
    MAX_PLAYER_SEPARATION, CAM_MARGIN, CAMERA_DRONE, TRANSITION_SPEED,
    DOOR_STUB_TILES, DOOR_ENTER_DEPTH, BACKGROUND_TILE,
    TORCHES, DOOR_LIGHT, WIND,
    getPlayerSpawnPositions, AUDIO_CONFIG,
    SIM_STEP, PLAYER_SAFE_ZONE, ROOM_INTRO, HOLE_FALL, PLAYER_DASH, GAME_OVER_INPUT_DELAY_MS
} from './config/GameConfig.js';

export class Game {
    constructor(canvas, opts = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.ctx.imageSmoothingEnabled = false;

        this.roomCatalog = opts.roomCatalog || null;
        this.mapData = opts.mapData || null;

        this.assets = opts.assets || new AssetLoader();
        this._bindResize();

        const cfgs = playerConfigs(this.assets);
        this.hud = new VtuberHud({
            assets: this.assets,
            getPlayers: () => [this.p1, this.p2],
            spriteConfigs: cfgs.map(c => c.sprite),
            colors: cfgs.map(c => c.color)
        });

        this.deathScreen = new DeathScreen({ onRestart: () => this.restart() });

        this.pauseScreen = new PauseScreen({

            onResume: () => this.setPaused(false, { silent: true }),
            onRestart: () => this.restart()
        });
        this._started = false;
        this.menuPad = new MenuPad();

        HeartPickup.sheet = this.assets.get("heartPickup");

        this.renderer = new Renderer(canvas, this.ctx);
        this.renderer.setTileset(new Tileset(this.assets.tileset, 16, 10));
        this.renderer.setAssets(this.assets);

        this._tilesetIndex = 0;

        this.renderer.setTileWorldSize(TILE);

        this.postProcessor = new PostProcessor(canvas, this.ctx);

        this.screenGore = new ScreenGore(canvas);

        this.wind = new WindSystem();

        this.bloodCanvas = new BloodCanvas(WORLD_W, WORLD_H, BLOOD_COLORS, BLOOD_PIXEL);
        this.particleSystem = new ParticleSystem(this.bloodCanvas);

        this.audio = new AudioManager(AUDIO_CONFIG);

        const mixMaster = this.audio.getMasterVolume();

        this.mixMaster = mixMaster;
        this._unsubVolume = MasterVolume.subscribe(() => this.audio.setMasterVolume(mixMaster * MasterVolume.gain()));

        setUiAudio(this.audio);
        if (typeof window !== "undefined") {
            window.audio = this.audio;
            window.audioConfig = AUDIO_CONFIG;
        }

        this.input = new InputHandler();

        this.playerAI = new PlayerAI({
            input: this.input,
            getP1: () => this.p1,
            getP2: () => this.p2,
            getRoom: () => this.rooms?.current,

            isHoleAt: (x, y) => this.tiles.isHoleAtWorld(x, y),

            getDoors: () => (this.rooms?.isLocked() ? [] : this.rooms.doorsOfCurrent())
        });

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

        this.playerFactory = new PlayerFactory({ assets: this.assets, bloodCanvas: this.bloodCanvas });
        this.spawnSystem = new SpawnSystem({ assets: this.assets, bloodCanvas: this.bloodCanvas });
        this.combat = new CombatSystem({ renderer: this.renderer, particleSystem: this.particleSystem, audio: this.audio, hitFeedback: true });
        this.effects = new ParticleEffects({ particleSystem: this.particleSystem, bloodCanvas: this.bloodCanvas, audio: this.audio });

        this.effects.stepBlocker = (x, y) => !!this.rooms?.current?.challenge?.coversButton(x, y);
        this.rooms = new RoomManager({ spawnSystem: this.spawnSystem, getFloor: () => this.floor, roomCatalog: this.roomCatalog, mapData: this.mapData });

        this.tiles = new DungeonTileQuery({ rooms: this.rooms });
        this.holes = new HoleEffects({ rooms: this.rooms });
        this.demoProgress = new DemoProgress({ rooms: this.rooms, input: this.input, assets: this.assets, getPlayers: () => [this.p1, this.p2], getSaw: () => this.chain.weapon });
        this.thrownSaw = new ThrownSaw({ getWeapon: () => this.chain.weapon, getRoom: () => this.rooms.current, safeDrop: (x, y) => this.tiles.safeDropPoint(x, y, [this.p1, this.p2]) });
        this.demoCamera = new DemoCamera({ canvas, renderer: this.renderer, getPlayers: () => [this.p1, this.p2], getRect: () => this.rooms.cellRect(), mode: this.mapData?.test?.camera });
        this.demoDoors = new DemoDoors({ assets: this.assets, renderer: this.renderer, rooms: this.rooms });
        this.demoVictory = new DemoVictory({ onRestart: () => this.restart() });
        this.demoEncounter = new DemoEncounter({ rooms: this.rooms, spawnSystem: this.spawnSystem, onVictory: () => {
            this.gameOver = true; this._gameOverAt = performance.now(); this.demoVictory.show();
        } });
        this.animatedProps = this.mapData ? new PropSprites() : null;

        this.lighting = new LightingRenderer({ renderer: this.renderer, postProcessor: this.postProcessor });

        this.gameLoop = new GameLoop({
            onFrameStart: () => { this.input.pollGamepads(); this._pollMenuPad(); this._updateSawMotor(); },
            onStep: (dt) => this._step(dt),
            onRender: () => this._render()
        });

        this.playtest = typeof window !== "undefined" &&
            !!window.location && window.location.search.includes("playtest=true");

        this.floor = 1;
        this.gameOver = false;
        this.players = [];
        this.p1 = null;
        this.p2 = null;
        this.arenaBounds = null;
        this.gibs = [];
        this.transition = null;
        this.roomIntro = null;
        this._doorFlashT = 0;

        this._bindButtons();
        if (this.mapData?.test) {
            const back = document.createElement('a'); back.href = 'editor2.html'; back.textContent = '← Voltar ao Editor 2.0';
            back.style.cssText = 'position:fixed;right:12px;top:12px;z-index:100;color:white;background:#252035;padding:10px;border-radius:6px'; document.body.append(back);
            window.addEventListener('keydown', e => {
                if (e.code !== 'F6') return;
                e.preventDefault(); const modes = ['zoom', 'fixed', 'split'];
                this.demoCamera.mode = modes[(modes.indexOf(this.demoCamera.mode) + 1) % modes.length];
            });
        }
    }

    get currentWeapon() {
        return this.chain.weapon;
    }

    start() {
        this.players = this.playerFactory.create();
        [this.p1, this.p2] = this.players;
        this.newDungeon();
        this._started = true;

        this.audio.playLoop("ambience", { fadeMs: 3000 });

        this.sawMotor ??= new SawMotorAudio(this.audio.createLoopVoice("sawMotor"));
        if (typeof window !== "undefined") window.sawMotor = this.sawMotor;
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

    _buttonFeedback(challenge) {

        const allPressed = challenge.buttons.length >= 2 && challenge.buttons.every(b => b.pressed);
        for (const b of challenge.buttons) {
            if (b.justPressed) {
                this.audio?.play("buttonPress", { rateMultiplier: allPressed ? 1.12 : 1 });
                this.renderer.triggerShake(3);

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

    _dashFeedback(p) {
        if (!p.justDashed) return;
        this.audio?.play("playerDash");
        this.renderer.triggerShake(PLAYER_DASH.shake);
        const fx = p.x - p.dashDirX * 10, fy = p.y + 15 - p.dashDirY * 4;
        this.particleSystem.triggerDust(fx, fy, p.dashDirX, p.dashDirY, PLAYER_DASH.dustCount);
        this._dustRing(fx, fy, PLAYER_DASH.ringDust);
        this.particleSystem.triggerFlash(fx, fy - 6, 4, 0.7);
    }

    _dashLandFeedback(p) {
        if (!p.justEndedDash || p.falling) return;
        this.audio?.play("playerStep", { rateMultiplier: PLAYER_DASH.landStepRate });
        const fx = p.x + p.dashDirX * 8, fy = p.y + 15;
        this.particleSystem.triggerDust(fx, fy, -p.dashDirX, -p.dashDirY, PLAYER_DASH.landDust);
        this._dustRing(p.x, fy, Math.ceil(PLAYER_DASH.landDust / 2));
    }

    _dustRing(x, y, n) {
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
            const cx = Math.cos(a), cy = Math.sin(a);
            this.particleSystem.triggerDust(x + cx * 14, y + cy * 6, -cx, -cy, 1);
        }
    }

    _arrowTrapFeedback(challenge) {
        for (const t of challenge.arrowTraps) {
            if (!t.justFired) continue;
            const d = Math.min(
                Math.hypot(this.p1.x - t.x, this.p1.y - t.y),
                Math.hypot(this.p2.x - t.x, this.p2.y - t.y)
            );

            const k = Math.max(0, Math.min(1, (d - 160) / 480));
            this.audio?.play("arrowFire", { volumeMultiplier: 1 - 0.65 * k });
        }
    }

    _bindButtons() {

        window.addEventListener("keydown", (e) => {
            if (e.repeat) return;
            const k = e.key.toLowerCase();
            if (k === "escape") this.togglePause();
            else if (k === "t") this.cycleTileset();
            else if (k === "r") this.restart();

            else if (this._gameOverAcceptsInput() && (k === "enter" || k === " ") &&
                document.activeElement !== this.deathScreen.button) {
                playUi("uiConfirm");
                this.restart();
            }
        });
    }

    _gameOverAcceptsInput() {
        if (!this.gameOver) return false;
        return performance.now() - (this._gameOverAt ?? 0) >= GAME_OVER_INPUT_DELAY_MS;
    }

    restart() {
        this.floor = 1;
        this.players = this.playerFactory.create();
        [this.p1, this.p2] = this.players;
        this.newDungeon();
    }

    setPaused(paused, { silent = false } = {}) {
        paused = !!paused;
        if (paused === this.gameLoop.paused) return;
        if (paused && (!this._started || this.gameOver)) return;
        this.gameLoop.setPaused(paused);
        this.hud.setPaused(paused);
        if (paused) {
            this.pauseScreen.show();
            this.audio.stopAll();
            this.audio.setLoopLevel("ambience", -12, 250);
            playUi("uiOpen");
        } else {
            this.pauseScreen.hide();
            // A tecla/botão que fechou a pausa (Enter, A) também é dash: não pode disparar ao voltar.
            for (const p of this.players) p.latchDashKey();
            this.audio.setLoopLevel("ambience", 0, 400);
            if (!silent) playUi("uiClose");
        }
    }

    togglePause() {
        this.setPaused(!this.gameLoop.paused);
    }

    _pollMenuPad() {
        const hit = this.menuPad.poll();

        if (this.gameOver) {
            if ((hit.start || hit.a) && this._gameOverAcceptsInput()) {
                this.deathScreen.pixel.showPressed();
                playUi("uiConfirm");
                this.restart();
            }
            return;
        }
        if (hit.start) { this.togglePause(); return; }
        if (!this.gameLoop.paused) return;
        if (hit.up) this.pauseScreen.move(-1);
        else if (hit.down) this.pauseScreen.move(1);
        else if (hit.left) this.pauseScreen.adjust(-1);
        else if (hit.right) this.pauseScreen.adjust(1);
        else if (hit.a) this.pauseScreen.confirm();
        else if (hit.b) this.setPaused(false);
    }

    cycleTileset() {
        const variants = this.assets.tilesetVariants;
        if (!variants || variants.length <= 1) return;
        this._tilesetIndex = (this._tilesetIndex + 1) % variants.length;
        this.renderer.tileset.img = variants[this._tilesetIndex];
    }

    newDungeon() {
        this.rooms.reset();
        this.demoProgress.reset(this.mapData?.test?.progress);
        this.demoDoors.opened.clear();
        this.demoVictory.hide();
        this.demoEncounter.reset();
        this.bloodCanvas.clear();
        this.gibs = [];
        this.effects.clear();
        this.transition = null;
        this.roomIntro = null;
        this.renderer.setIntroZoomFactor(1);
        this.particleSystem.clear();
        this.screenGore.clear();
        this.gameOver = false;
        this.deathScreen.hide();

        if (this.gameLoop.paused) this.setPaused(false, { silent: true });
        this._sawLandPending = false;

        this.audio.setLoopLevel("ambience", 0, 1500);

        this.chain.reset();

        this.rooms.enter();
        this.arenaBounds = this.rooms.currentBounds;

        const rect = this.rooms.cellRect();
        const spawns = this.mapData ? this.rooms.dungeon.spawnPositions() : getPlayerSpawnPositions("CENTER", rect.x, rect.y, TILE);

        const custom = this.playtest ? this.rooms.playtestSpawn : null;
        if (custom) {
            for (const key of ["p1", "p2"]) {
                spawns[key].x = rect.x + (custom[key].col + 0.5) * TILE;
                spawns[key].y = rect.y + (custom[key].row + 0.5) * TILE;
            }
        }
        this.p1.x = spawns.p1.x; this.p1.y = spawns.p1.y; this.p1.vx = 0; this.p1.vy = 0;
        this.p2.x = spawns.p2.x; this.p2.y = spawns.p2.y; this.p2.vx = 0; this.p2.vy = 0;
        this.p1.cancelDash();
        this.p2.cancelDash();

        if (this.playtest) {
            this.tiles.ensureSafeSpawn(this.p1, rect);
            this.tiles.ensureSafeSpawn(this.p2, rect);
        }
        this._rememberEntrySpawns();

        const center = this.rooms.cellCenter();
        this.renderer.camX = center.x;
        this.renderer.camY = center.y;
        this.renderer.resetSway();

        this._activateRoomEnemies();
    }

    transitionThroughDoor(door) {
        this.rooms.transitionTo(door);
        this.arenaBounds = this.rooms.currentBounds;

        const entryDir = { N: "S", S: "N", E: "W", W: "E" }[door.dir] || "CENTER";
        const rect = this.rooms.cellRect();
        const spawns = this.mapData ? this.rooms.dungeon.spawnPositions(door.targetDoor) : getPlayerSpawnPositions(entryDir, rect.x, rect.y, TILE);
        if (this.mapData) { this.bloodCanvas.clear(); this.gibs = []; this.particleSystem.clear(); }

        this.p1.x = spawns.p1.x; this.p1.y = spawns.p1.y; this.p1.vx = 0; this.p1.vy = 0;
        this.p2.x = spawns.p2.x; this.p2.y = spawns.p2.y; this.p2.vx = 0; this.p2.vy = 0;
        this.p1.cancelDash();
        this.p2.cancelDash();
        this._rememberEntrySpawns();

        if (!this.chain.isConnected) this.chain.reset();

        this.particleSystem.damageNumbers = [];

        const combat = this._activateRoomEnemies();
        if (!combat && !this.rooms.isLocked()) {
            this._triggerDoorFlash();
        }

        this.hud.onRoomEnter(combat);
    }

    _rememberEntrySpawns() {
        this._entrySpawns = new Map([
            [this.p1, { x: this.p1.x, y: this.p1.y }],
            [this.p2, { x: this.p2.x, y: this.p2.y }]
        ]);
    }

    _dropSawOnFall() {
        const { p1, p2 } = this;
        const seeds = [p1, p2].filter(p => !p.falling);
        for (const p of [p1, p2]) {
            if (p.falling) seeds.push(this._entrySpawns?.get(p) ?? p);
        }
        const dropped = this.chain.forceDrop(p1, p2,
            (x, y) => this.tiles.safeDropPoint(x, y, seeds));
        if (!dropped) return;

        this.audio.play("sawSnap");
        this.sawMotor?.onSnap();
        this._sawLandPending = true;
        const r = this.chain.weapon?.discRadius ?? 24;
        const w = this.chain.weapon;
        if (w?.dropped) this.particleSystem.triggerSparkBurst(w.dropX, w.dropY, r, 8, 1);
        this.renderer.triggerShake(6);
    }

    _resolveFall(p) {
        if (!p.falling || !p.fallComplete) return;
        p.lives = Math.max(0, p.lives - (HOLE_FALL.livesLost ?? 1));
        if (p.lives <= 0) { p.fallComplete = false; return; }

        const spot = this._entrySpawns?.get(p) ?? this.rooms.cellCenter();
        p.respawnAt(spot.x, spot.y, HOLE_FALL.respawnInvulnFrames ?? 0);
        this.tiles.ensureSafeSpawn(p, this.rooms.cellRect());
        p._fallSeen = false;

        this.screenGore.triggerFlash();
        p._livesSeen = p.lives;
        this.particleSystem.triggerFlash(p.x, p.y, 10, 0.8);
    }

    _activateRoomEnemies() {
        const room = this.rooms.current;
        if (!room.hasPendingEnemies) return false;
        if (ROOM_INTRO.enabled) this._beginRoomIntro();
        else room.spawnEnemies(false);
        return true;
    }

    _beginRoomIntro() {
        this.roomIntro = { phase: "zoomIn", t: 0 };

        this._introFlameColor = this._parseRgbTriplet(
            TORCHES?.light?.color || "255, 190, 110"
        );

        this.p1.vx = this.p1.vy = 0;
        this.p2.vx = this.p2.vy = 0;
    }

    _parseRgbTriplet(str) {
        const parts = String(str).split(",").map(s => parseInt(s.trim(), 10));
        if (parts.length === 3 && parts.every(n => Number.isFinite(n))) return parts;
        return [255, 190, 110];
    }

    _scheduleStaggeredSpawns(enemies) {
        if (!enemies || !enemies.length) return;

        const order = enemies.slice();
        for (let i = order.length - 1; i > 0; i--) {
            const j = (Math.random() * (i + 1)) | 0;
            [order[i], order[j]] = [order[j], order[i]];
        }

        let acc = (Math.random() * 6) | 0;
        for (const e of order) {
            e.beginFrozenSpawn(acc);
            acc += 8 + ((Math.random() * 16) | 0);
        }
    }

    _triggerDoorFlash() {
        this._doorFlashT = DOOR_LIGHT.flashDuration;
        this.renderer.triggerZoomPunch(0.045);
    }

    _updateSawMotor() {
        const w = this.chain?.weapon;
        if (!this.sawMotor || !w) return;
        this.sawMotor.update(w.spinSpeed ?? 0, {
            connected: this.chain.isConnected,
            active: !this.gameOver && !this.transition && !this.roomIntro && !this.gameLoop.paused,
            timeScale: this.gameLoop.timeScale
        });
    }

    triggerHitSlowmo() {
        this.gameLoop.triggerHitSlowmo();
    }

    enforceSeparationLimit() {

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

    _updateCameraToCurrentRoom(dt = SIM_STEP) {
        if (this.mapData) { this.demoCamera.update(); return; }
        const rect = this.rooms.cellRect();
        const fitZoom = Math.min(
            this.canvas.width / (rect.w + CAM_MARGIN * 2),
            this.canvas.height / (rect.h + CAM_MARGIN * 2)
        );

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
        this.wind.update(this.arenaBounds);
        this._updateCameraToCurrentRoom();
    }

    _updateRoomIntro(deltaSeconds = SIM_STEP) {
        const intro = this.roomIntro;
        const room = this.rooms.current;
        this.arenaBounds = this.rooms.currentBounds;

        intro.t += deltaSeconds;

        if (intro.phase === "zoomIn") {
            const dur = ROOM_INTRO.zoomInTime || 0.0001;
            const k = Math.min(1, intro.t / dur);
            const eased = 1 - Math.pow(1 - k, 3);
            this.renderer.setIntroZoomFactor(1 + (ROOM_INTRO.zoomFactor - 1) * eased);
            if (k >= 1) {

                const spawned = room.spawnEnemies(true);
                this._scheduleStaggeredSpawns(spawned);
                intro.phase = "hold";
                intro.t = 0;
            }
        } else if (intro.phase === "hold") {
            this.renderer.setIntroZoomFactor(ROOM_INTRO.zoomFactor);

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

                this.renderer.setIntroZoomFactor(1);
                for (const e of room.enemies) e.unfreeze?.();
                this.roomIntro = null;
            }
        }

        this.p1.vx = this.p1.vy = 0;
        this.p2.vx = this.p2.vy = 0;

        for (const e of room.enemies) {
            e.update([this.p1, this.p2], () => {});

            const riseH = e.drawHeight * 1.15;
            if (e.justAppeared) {

                this.particleSystem.triggerFlameBurst(e.x, e.footY, this._introFlameColor, {
                    amount: 40, rise: riseH, width: e.drawHeight * 0.6
                });
                this.renderer.triggerShake(6);

                this.audio.play("enemySpawn");
            } else if (e.spawnFx > 0) {

                this.particleSystem.triggerFlameBurst(e.x, e.footY, this._introFlameColor, {
                    amount: 6, rise: riseH, width: e.drawHeight * 0.55
                });
            }
            this.rooms.clampEnemy(e, this.arenaBounds);
        }

        this.particleSystem.update([this.p1, this.p2], this.arenaBounds);
        this.wind.update(this.arenaBounds);
        this.effects.update();
        this.holes.update();

        if (this._doorFlashT > 0) {
            this._doorFlashT = Math.max(0, this._doorFlashT - deltaSeconds);
        }

        this._updateCameraToCurrentRoom(deltaSeconds);
    }

    _updateGameplay(deltaSeconds = 1 / 60) {
        const { p1, p2, rooms } = this;
        this.arenaBounds = rooms.currentBounds;
        const room = rooms.current;

        this.playerAI.update();

        const canDash = !this.chain.isConnected && (!this.mapData || this.demoProgress.state.dash);
        p1.update(this.input, this.arenaBounds, { canDash, feetInHole: this.tiles.feetInHole(p1) });
        p2.update(this.input, this.arenaBounds, { canDash, feetInHole: this.tiles.feetInHole(p2) });
        this._dashFeedback(p1);
        this._dashFeedback(p2);

        this._resolveFall(p1);
        this._resolveFall(p2);

        this.effects.processPlayer(p1);
        this.effects.processPlayer(p2);

        this.thrownSaw.aimFrom([p1, p2]);
        this.chain.update(p1, p2, {
            onSnap: () => {
                if (this.mapData && this.demoProgress.state.sawThrow) this.thrownSaw.launch();
                this.renderer.triggerShake(14);

                this.audio.play("sawSnap");
                this.sawMotor?.onSnap();
                this.audio.duck(-9, { attackMs: 10, holdMs: 250, releaseMs: 1100 });
                this._sawLandPending = true;

                const sp = this.chain.weapon?.getSawPositions?.(p1, p2)?.[0];
                const fx = sp ? sp.x : (p1.x + p2.x) / 2;
                const fy = sp ? sp.y : (p1.y + p2.y) / 2;
                const r = this.chain.weapon?.discRadius ?? 24;
                this.particleSystem.triggerSparkBurst(fx, fy, r, 12, 1.2);
                this.particleSystem.triggerFlash(fx, fy, 12, 1);
            },
            onReconnect: () => {
                this.renderer.triggerShake(4);

                this.audio.play("sawPickup");
                this.audio.duck(-4, { attackMs: 20, holdMs: 120, releaseMs: 600 });
                this._sawLandPending = false;

                this.chain.weapon?.playReconnect?.();
            },

            resolveDropPoint: (x, y) => this.tiles.reachableDropPoint(x, y, [p1, p2])
        });
        this._updateSawLanding();

        const weapon = this.chain.weapon;
        if (this.chain.isConnected && weapon?.isHighSpeed) {
            this.renderer.triggerShake(1.6);
        }

        if (!this.chain.isConnected) weapon?.setOnBlood?.(false);

        if (this.chain.isConnected && weapon) {
            const spin = weapon.spinSpeed ?? 0;
            const vx = (p1.vx + p2.vx) / 2;
            const vy = (p1.vy + p2.vy) / 2;
            const speed = Math.min(1, Math.hypot(vx, vy) / (p1.speed || 4.2));

            const intensity = spin * speed;

            this._sparkAccum = (this._sparkAccum ?? 0) + intensity * 5;
            const emit = Math.floor(this._sparkAccum);

            const sawPos = weapon.getSawPositions(p1, p2)[0];
            const sawX = sawPos.x;
            const sawY = sawPos.y;
            if (emit > 0) {
                this._sparkAccum -= emit;
                this.particleSystem.triggerSparks(
                    sawX, sawY, weapon.discRadius ?? 24, weapon.spinDir ?? 1, emit
                );
            }

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

        if (room.challenge) {
            room.challenge.update([p1, p2], deltaSeconds);
            this._buttonFeedback(room.challenge);
            this._arrowTrapFeedback(room.challenge);
        }

        const enemies = room.enemies;
        this.combat.updateEnemies(enemies, [p1, p2]);

        const liveEnemies = enemies.filter(e => e.state !== "dying");
        const allEntities = [p1, p2].filter(p => !p.dashing).concat(liveEnemies);

        const sawR = (this.chain.isConnected && weapon) ? (weapon.collisionRadius ?? 0) : 0;
        for (let it = 0; it < 3; it++) {
            Physics.resolveEntityCollisions(allEntities);
            if (sawR > 0) {

                const sc = weapon.getSawPositions(p1, p2)[0];
                for (const e of allEntities) {
                    Physics.resolveCircleCollision(e, sc.x, sc.y, sawR);
                }
            }
        }

        if (room.wallBoxes?.length) {
            for (const entity of [p1, p2, ...room.enemies]) {
                Physics.resolveBoxCollisions(entity, room.wallBoxes);
            }
        }

        for (const enemy of liveEnemies) enemy.ensureOnWalkableTile?.();

        enemies.forEach(e => rooms.clampEnemy(e, this.arenaBounds));
        const doors = rooms.doorsOfCurrent();
        const canPass = !rooms.isLocked();
        rooms.clampPlayer(p1, this.arenaBounds, doors, canPass);
        rooms.clampPlayer(p2, this.arenaBounds, doors, canPass);

        this.tiles.checkHoleFalls([p1, p2]);

        for (const p of [p1, p2]) {
            if (p.falling && !p._fallSeen) {
                this.audio.play("playerFall");
                this.audio.duck(-8, { attackMs: 30, holdMs: 500, releaseMs: 1200 });
                this._dropSawOnFall();
            }
            p._fallSeen = p.falling;
            this._dashLandFeedback(p);
        }
        this.holes.update([p1, p2]);

        this.combat.resolveWeaponHits(
            this.chain.weapon, enemies, p1, p2, this.chain.isConnected,
            () => this.triggerHitSlowmo(),
            (enemy, info) => {
                this.gameLoop.triggerHitStop(info.hitStop);
                this.sawMotor?.onHit();
            }
        );
        this.combat.resolveDeaths(room, this.gibs, () => this.screenGore.trigger(), [p1, p2]);

        this._updateHearts(room);

        for (let i = this.gibs.length - 1; i >= 0; i--) {
            this.gibs[i].update(this.arenaBounds);
            if (this.gibs[i].done) this.gibs.splice(i, 1);
        }

        this.effects.update();

        for (const p of [p1, p2]) {
            if (p._livesSeen !== undefined && p.lives < p._livesSeen) {
                this.screenGore.triggerFlash();

                if (!p.falling) {

                    this.audio.play("playerHit", { rateMultiplier: p.lives <= 1 ? 0.88 : 1 });
                    this.audio.duck(-6, { attackMs: 10, holdMs: 150, releaseMs: 700 });
                }
            }
            p._livesSeen = p.lives;
        }

        this.screenGore.update();

        if (this._doorFlashT > 0) {
            this._doorFlashT = Math.max(0, this._doorFlashT - deltaSeconds);
        }

        if (rooms.tryClearCurrent()) {
            this._triggerDoorFlash();

            this.audio.play("doorOpen");

            this.renderer.triggerZoomPunch(-0.07);
            this.hud.onRoomCleared();
        }

        this.particleSystem.update([p1, p2], this.arenaBounds);
        this.wind.update(this.arenaBounds);

        if (p1.lives <= 0 || p2.lives <= 0) {
            this.gameOver = true;
            this._gameOverAt = performance.now();
            this.deathScreen.show();

            this.audio.setLoopLevel("ambience", -10, 1500);
        }

        this.thrownSaw.update();
        this.demoProgress.update(deltaSeconds);
        this.demoEncounter.update();
        this._checkDoorTransition(doors);
        this._updateCameraToCurrentRoom(deltaSeconds);
    }

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
                this._playHeartPickup();

                this.particleSystem.triggerFlash(heart.x, heart.y, 6, 0.6);
                hearts.splice(i, 1);
            }
        }
    }

    _playHeartPickup() {
        const now = globalThis.performance?.now?.() ?? Date.now();
        const HEART_STREAK_MS = 2500;
        this._heartStreak = now - (this._lastHeartAt ?? -Infinity) < HEART_STREAK_MS
            ? Math.min((this._heartStreak ?? 0) + 1, 4)
            : 0;
        this._lastHeartAt = now;
        this.audio.play("pickup", { rateMultiplier: 1 + this._heartStreak * 0.06 });
    }

    _updateSawLanding() {
        const w = this.chain.weapon;
        if (!this._sawLandPending) return;
        if (this.chain.isConnected || !w?.dropped) {
            this._sawLandPending = false;
            return;
        }
        if ((w.dropT ?? 1) < 1) return;
        this._sawLandPending = false;
        this.audio.play("sawLand");
        this.renderer.triggerShake(3);
        const n = 6;
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
            const cx = Math.cos(a), cy = Math.sin(a);
            this.particleSystem.triggerDust(w.dropX + cx * 20, w.dropY + 10 + cy * 8, -cx, -cy, 1);
        }
    }

    _checkDoorTransition(doors) {

        if (this.mapData ? this.mapData.test?.isolated : this.playtest) return;
        if (this.rooms.isLocked() || this.transition) return;
        const { p1, p2, rooms } = this;
        for (const door of doors) {
            if (door.blocked) continue;
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

    _render() {
        if (this.mapData && this.demoCamera.mode === 'split') this.demoCamera.renderSplit(() => this._renderView());
        else this._renderView();
        this._renderOverlays();
        if (this.mapData) {
            this.demoCamera.drawIndicators(this.ctx);
            const ctx = this.ctx; ctx.save(); ctx.textAlign = 'center'; ctx.font = 'bold 18px sans-serif';
            const message = this.demoProgress.messageTime ? this.demoProgress.message : this.demoProgress.prompt;
            if (message) { ctx.fillStyle = '#16121ee6'; ctx.fillRect(this.canvas.width / 2 - 250, this.canvas.height - 60, 500, 36); ctx.fillStyle = '#fff'; ctx.fillText(message, this.canvas.width / 2, this.canvas.height - 36); }
            if (this.mapData.test) { ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif'; ctx.fillText(`Câmera: ${this.demoCamera.mode} • F6 alterna`, this.canvas.width / 2, 24); }
            ctx.restore();
        }
    }

    _renderView() {
        const { ctx, renderer, rooms } = this;
        renderer.beginFrame();
        renderer.drawBackground(BACKGROUND_TILE, TILE);

        const rect = rooms.cellRect();
        const doors = rooms.doorsOfCurrent();
        const open = !rooms.isLocked();
        const tiles = rooms.currentTiles;
        const doorHalf = rooms.doorHalfWidth;

        const stubMargin = DOOR_STUB_TILES * TILE;
        ctx.save();
        ctx.beginPath();
        ctx.rect(rect.x - stubMargin, rect.y - stubMargin, rect.w + stubMargin * 2, rect.h + stubMargin * 2);
        ctx.clip();

        renderer.drawRoom(rect, this.arenaBounds, tiles, TILE, open, doors, doorHalf);

        if (this.animatedProps) for (const p of tiles.props) {
            if (p.type) this.animatedProps.draw(ctx, p.type, rect.x + p.col * TILE, rect.y + p.row * TILE, TILE, performance.now(), !!p.flip);
        }
        this.demoProgress.draw(ctx);
        if (open) {
            renderer.drawDoorStubs(rect, doors, TILE, doorHalf, DOOR_STUB_TILES);
            renderer.drawDoorGradients(doors, doorHalf, TILE, DOOR_STUB_TILES);
        }

        this.holes.draw(ctx);

        const challenge = rooms.current.challenge;
        if (challenge) challenge.drawFloorLayer(ctx);

        this.particleSystem.drawFloor(ctx, this.arenaBounds, this.tiles.darkHoleRects());
        this.effects.draw(ctx);

        if (challenge) challenge.drawButtons(ctx);
        this.particleSystem.drawSmoke(ctx);

        rooms.current.hearts.forEach(h => h.drawShadow(ctx));

        const p1Bounce = this.p1.speedMag > 0.15 ? Math.abs(Math.sin(this.p1.animTimer)) : 0;
        const p2Bounce = this.p2.speedMag > 0.15 ? Math.abs(Math.sin(this.p2.animTimer)) : 0;
        if (!this.p1.falling) renderer.drawRoundShadow(this.p1.x, this.p1.y, 14, p1Bounce);
        if (!this.p2.falling) renderer.drawRoundShadow(this.p2.x, this.p2.y, 14, p2Bounce);
        const enemies = rooms.current.enemies;

        enemies.forEach(e => { if (!e.isHidden) renderer.drawRoundShadow(e.x, e.y, 13, 0); });

        this.chain.drawChain(ctx, this.p1, this.p2);

        const sawY = this.chain.weapon?.getSawPositions
            ? this.chain.weapon.getSawPositions(this.p1, this.p2)[0].y
            : (this.p1.y + this.p2.y) / 2;
        const entities = [this.p1, this.p2, ...enemies];

        const occluders = challenge ? challenge.buttonOccluders(entities) : [];
        const drawables = [...entities, ...occluders].sort((a, b) => a.y - b.y);

        const drawEntity = e => (e.falling ? this.holes.drawFalling(ctx, e) : e.draw(ctx));
        drawables.filter(e => e.y <= sawY).forEach(drawEntity);

        this.chain.draw(ctx, this.p1, this.p2);

        this.chain.drawDropped(ctx);

        this.particleSystem.drawSparks(ctx);

        drawables.filter(e => e.y > sawY).forEach(drawEntity);

        this.particleSystem.drawFlames(ctx);

        if (challenge) challenge.drawWallLayer(ctx);

        renderer.drawFrontWall(rect, tiles, TILE, open, doors, doorHalf, DOOR_STUB_TILES);

        this.demoDoors.draw(ctx);
        this.gibs.forEach(g => g.draw(ctx));

        if (challenge) challenge.drawAirLayer(ctx);

        this.particleSystem.drawAir(ctx);

        if (WIND.layer === "world") this.wind.draw(ctx);

        ctx.restore();
        renderer.endFrame();

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

        const strain = (this.chain.isConnected && this.chain.weapon)
            ? (this.chain.weapon.strain ?? 0) : 0;
        this.postProcessor.setVignetteBreath(strain);

        this.postProcessor.draw();

        const hearts = rooms.current.hearts;
        if (hearts.length || this.particleSystem.hasDamageNumbers) {
            renderer.beginOverlayWorld();
            hearts.forEach(h => h.drawOverlay(ctx));
            this.particleSystem.drawDamageNumbers(ctx);
            renderer.endOverlayWorld();
        }

        if (WIND.layer === "screen") this.wind.drawScreen(ctx, (x, y) => renderer.worldToScreen(x, y));

    }

    _renderOverlays() {
        const { ctx, canvas } = this;

        this.screenGore.draw(ctx);

        if (this.transition) {
            const t = this.transition;
            const a = t.phase === "out" ? t.t : (1 - t.t);
            ctx.fillStyle = `rgba(8, 7, 14, ${Math.max(0, Math.min(1, a))})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        this.hud.draw(ctx, canvas.width, canvas.height);

    }
}
