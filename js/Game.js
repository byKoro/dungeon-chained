import { DemoEncounter } from './systems/DemoEncounter.js';
import { HAZARDS } from './config/GameConfig.js';
import { DemoVictory } from './ui/DemoVictory.js';
import { DemoProgress } from './systems/DemoProgress.js';
import { BootsPickup } from './systems/BootsPickup.js';
import { DemoCamera } from './systems/DemoCamera.js';
import { SawOffscreenIndicator } from './systems/SawOffscreenIndicator.js';
import { DemoDoors } from './systems/DemoDoors.js';
import { ThrownSaw } from './systems/ThrownSaw.js';
import { ScrapSystem } from './systems/ScrapSystem.js';
import { ChestSystem } from './systems/ChestSystem.js';
import { DialogueSystem } from './systems/DialogueSystem.js';
import { SCRIPT_LINES } from './config/DialogueConfig.js';
import { SCRAP } from './config/ScrapConfig.js';
import { CHAIN } from './config/ChainConfig.js';
import { CHAIN_TENSION } from './config/ChainTensionConfig.js';
import { ForgeState, mapOffersRecipe, applySawUpgrades, applyHeartUpgrades, applyPlayerUpgrades, coopHealParams, sawDragStats, snapWaveRadius } from './systems/ForgeState.js';
import { SawDrag } from './systems/SawDrag.js';
import { DashTether, dashUnlocked } from './systems/DashTether.js';
import { DroppedSawPush } from './systems/DroppedSawPush.js';
import { DashPush } from './systems/DashPush.js';
import { DashPushFeedback } from './systems/DashPushFeedback.js';
import { CoopHeal } from './systems/CoopHeal.js';
import { CoopHealFeedback } from './systems/CoopHealFeedback.js';
import { SawTackle } from './systems/SawTackle.js';
import { SawTackleFeedback } from './systems/SawTackleFeedback.js';
import { SAW_TACKLE_FEEL } from './config/SawTackleFeelConfig.js';
import { PlayerLeash } from './systems/PlayerLeash.js';
import { PLAYER_LEASH, BOOTS } from './config/DemoConfig.js';
import { PROP_COLLISION } from './config/PropConfig.js';
import { RoomEvents } from './systems/RoomEvents.js';
import { DebugMenu } from './systems/DebugMenu.js';
import { RUN_DEATH } from './config/EventsConfig.js';
import { ForgeSystem } from './systems/ForgeSystem.js';
import { InteractPrompt, propTargetId } from './systems/InteractPrompt.js';
import { ForgeMenu } from './ui/ForgeMenu.js';
import { AbilityCard, cardForRecipe } from './ui/AbilityCard.js';
import { SawForgeCinematic } from './systems/SawForgeCinematic.js';
import { FORGE, SAW_CINEMATIC, PLAYER_UPGRADES } from './config/ForgeConfig.js';
import { PropSprites } from './core/PropSprites.js';
import { RoomProps } from './systems/RoomProps.js';
import { InputHandler } from './core/InputHandler.js';
import { MenuPad } from './core/MenuPad.js';
import { Physics } from './core/Physics.js';
import { Chain } from './core/Chain.js';
import { ChainObstacleSystem } from './systems/ChainObstacleSystem.js';
import { ChainTensionFeedback } from './systems/ChainTensionFeedback.js';
import { ArautoEffects } from './systems/ArautoEffects.js';
import { ArautoPhaseScene } from './systems/ArautoPhaseScene.js';
import { ArautoAudio } from './systems/ArautoAudio.js';
import { ArautoIntroScene } from './systems/ArautoIntroScene.js';
import { HoldToSkip } from './ui/HoldToSkip.js';
import { drawLetterbox, letterboxHeight } from './ui/Letterbox.js';
import { ARAUTO_FX } from './config/ArautoEffectsConfig.js';
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
import { GhostfireSystem } from './systems/GhostfireSystem.js';
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
import { BossHealthBar } from './ui/BossHealthBar.js';
import { ScrapCounter } from './ui/ScrapCounter.js';
import { DeathScreen } from './ui/DeathScreen.js';
import { PauseScreen } from './ui/PauseScreen.js';
import { setUiAudio, playUi } from './ui/UiSound.js';
import { MasterVolume } from './core/MasterVolume.js';
import { HeartPickup } from './entities/HeartPickup.js';
import { playerConfigs } from './config/EntityConfig.js';

import {
    TILE, WORLD_W, WORLD_H, BLOOD_COLORS, BLOOD_PIXEL,
    CAM_MARGIN, CAMERA_DRONE, TRANSITION_SPEED,
    DOOR_STUB_TILES, DOOR_ENTER_DEPTH, DOOR_SAW_PASS_TILES, DOOR_FOLLOW_TILES, BACKGROUND_TILE,
    TORCHES, DOOR_LIGHT, WIND,
    getPlayerSpawnPositions, AUDIO_CONFIG,
    SIM_STEP, ROOM_INTRO, HOLE_FALL, PLAYER_DASH, GAME_OVER_INPUT_DELAY_MS
} from './config/GameConfig.js';

const feetSortKey = d => d.feetSortY ?? d.footY ?? d.y + HOLE_FALL.footOffset;

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
        this.bossBar = new BossHealthBar({ getState: () => this._bossBarState() });
        this._bossBarAt = null;

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

        this.chainObstacles = new ChainObstacleSystem();
        this.chain = new Chain([new SawWeapon(this.assets.saw, this.assets.cable)], CHAIN);
        this.chainTension = new ChainTensionFeedback({ audio: this.audio,
            reducedMotion: globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false });
        this.dashTether = new DashTether({ chain: this.chain });
        this.forge = new ForgeState();

        this.playerFactory = new PlayerFactory({ assets: this.assets, bloodCanvas: this.bloodCanvas });
        this.spawnSystem = new SpawnSystem({ assets: this.assets, bloodCanvas: this.bloodCanvas });
        this.ghostfire = new GhostfireSystem({ spawnSystem: this.spawnSystem, particleSystem: this.particleSystem, renderer: this.renderer, audio: this.audio });
        this.arautoEffects = new ArautoEffects({ renderer: this.renderer, particleSystem: this.particleSystem });
        this.arautoAudio = new ArautoAudio({ audio: this.audio });
        this.arautoScene = new ArautoPhaseScene({ renderer: this.renderer, hud: this.hud,
            particleSystem: this.particleSystem, getPlayers: () => [this.p1, this.p2] });
        this.combat = new CombatSystem({ renderer: this.renderer, particleSystem: this.particleSystem,
            audio: this.audio, hitFeedback: true, arautoEffects: this.arautoEffects, arautoAudio: this.arautoAudio });
        this.effects = new ParticleEffects({ particleSystem: this.particleSystem, bloodCanvas: this.bloodCanvas, audio: this.audio });

        this.effects.stepBlocker = (x, y) => !!this.rooms?.current?.challenge?.coversButton(x, y);
        this.rooms = new RoomManager({ spawnSystem: this.spawnSystem, getFloor: () => this.floor, roomCatalog: this.roomCatalog, mapData: this.mapData });

        this.tiles = new DungeonTileQuery({ rooms: this.rooms });
        this.holes = new HoleEffects({ rooms: this.rooms });
        this.demoProgress = new DemoProgress({ rooms: this.rooms, input: this.input, assets: this.assets, getPlayers: () => [this.p1, this.p2], getSaw: () => this.chain.weapon,
            renderer: this.renderer, particleSystem: this.particleSystem, audio: this.audio, hitStop: s => this.gameLoop?.triggerHitStop(s) });
        this.bootsPickup = this.mapData ? new BootsPickup({
            rooms: this.rooms, getPlayers: () => [this.p1, this.p2], assets: this.assets, demoProgress: this.demoProgress,
            particleSystem: this.particleSystem, renderer: this.renderer, audio: this.audio,
            hitStop: s => this.gameLoop?.triggerHitStop(s),
            onPickup: () => this.abilityCard?.show(BOOTS.cinematic.cardText)
        }) : null;
        this.thrownSaw = new ThrownSaw({ getWeapon: () => this.chain.weapon, getRoom: () => this.rooms.current,
            safeDrop: (x, y) => this.tiles.safeDropPoint(x, y, [this.p1, this.p2]),
            onHit: (enemy, info) => { if (this.arautoEffects.owns(enemy)) this.arautoEffects.hit(enemy, info); } });
        this.demoCamera = new DemoCamera({ canvas, renderer: this.renderer, getPlayers: () => [this.p1, this.p2], getRect: () => this.rooms.cellRect(),
            mode: this.mapData?.test?.camera, lockZoom: PLAYER_LEASH.enabled });
        this.sawIndicator = this.mapData ? new SawOffscreenIndicator({
            renderer: this.renderer, getSaw: () => this.chain.weapon, getPlayers: () => [this.p1, this.p2],
            getScale: () => this.hud.pixelScale(this.canvas.width, this.canvas.height), sawSprite: this.assets.saw
        }) : null;
        // Só nos mapas do Editor 2.0, fora da tela dividida (F6) e das cinemáticas com câmera própria.
        this.playerLeash = this.mapData ? new PlayerLeash({
            getPlayers: () => [this.p1, this.p2], getView: () => this.demoCamera.viewSize(),
            isActive: () => this.demoCamera.mode !== 'split' && !this.demoCamera.focus,
            particleSystem: this.particleSystem
        }) : null;
        // A câmera da cena usa `demoCamera.focus`, que só vale no mapa da demo; no modo clássico a câmera fica parada.
        this.arautoIntro = new ArautoIntroScene({ camera: this.demoCamera, hud: this.hud, effects: this.arautoEffects,
            arautoAudio: this.arautoAudio, audio: this.audio, particles: this.particleSystem,
            getPlayers: () => [this.p1, this.p2],
            storage: typeof sessionStorage === 'undefined' ? null : sessionStorage,
            forceFull: !!this.mapData?.test?.repeatArautoIntro,
            onFinish: () => { for (const p of this.players) p.latchDashKey(); } });
        this.introSkip = new HoldToSkip({ isHeld: () => this.input.isDown('e') });
        this._interactLatched = false;
        this.demoDoors = new DemoDoors({ assets: this.assets, renderer: this.renderer, rooms: this.rooms });
        this.demoVictory = new DemoVictory({ onRestart: () => this.restart() });
        this.demoEncounter = new DemoEncounter({ rooms: this.rooms, spawnSystem: this.spawnSystem, onVictory: () => {
            this.gameOver = true; this._gameOverAt = performance.now(); this.demoVictory.show();
        } });
        this.animatedProps = this.mapData ? new PropSprites() : null;
        this.roomProps = this.animatedProps ? new RoomProps({
            rooms: this.rooms, sprites: this.animatedProps, getFrame: (prop, key) => this._propFrame(prop, key),
            isHidden: (prop, key) => !!this.chests?.isHidden(key, prop)
        }) : null;
        const scrapFrames = SCRAP.frames.map((_, i) => this.assets.get(`scrap${i + 1}`));
        this.scrap = this.mapData ? new ScrapSystem({ audio: this.audio, frames: scrapFrames }) : null;
        this.scrapCounter = this.scrap ? new ScrapCounter({ getAmount: () => this.scrap.amount, frames: scrapFrames }) : null;
        this.chests = this.scrap ? new ChestSystem({
            rooms: this.rooms, scrap: this.scrap, getPlayers: () => [this.p1, this.p2], input: this.input,
            audio: this.audio, particleSystem: this.particleSystem,
            onOpen: () => {
                this.forgeSystem?.latchInteract();
                this.dialogue?.latchInteract();
                this.demoProgress.held = [true, true];
            }
        }) : null;

        this.dialogue = this.mapData ? new DialogueSystem({
            getPlayers: () => [this.p1, this.p2], input: this.input, audio: this.audio,
            onLineStart: (i, expr, dur) => this.hud.speak(i, expr, dur),
            onBlip: (i) => this.hud.talkBlip(i)
        }) : null;
        if (this.dialogue && typeof window !== "undefined") window.dialogue = this.dialogue;

        this.roomEvents = this.mapData ? new RoomEvents({
            rooms: this.rooms, spawnSystem: this.spawnSystem, getPlayers: () => [this.p1, this.p2], chain: this.chain,
            scrap: this.scrap, chests: this.chests, dialogue: this.dialogue, audio: this.audio,
            particleSystem: this.particleSystem, renderer: this.renderer, assets: this.assets, camera: this.demoCamera,
            hooks: {
                hitStop: s => this.gameLoop?.triggerHitStop(s),
                propsChanged: room => this.roomProps?.invalidate(room),
                drawPropFrame: (ctx, type, frame, dx, dy, sx, sy) => this.animatedProps?.drawFrame(ctx, type, frame, dx, dy, TILE, false, sx, sy)
            }
        }) : null;
        // Mapas com bigorna seguem a regra de morte da run (ADR 0012): renascer no início em vez de game over.
        this._runRules = !!this.mapData && Object.values(this.mapData.map.rooms).some(r => (r.props || []).some(p => p.type === "anvil"));
        this._respawnFadeAt = -Infinity;

        this.forgeSystem = this.scrap ? new ForgeSystem({
            rooms: this.rooms, getPlayers: () => [this.p1, this.p2], input: this.input,
            forge: this.forge, scrap: this.scrap, audio: this.audio,
            canOpen: () => !this.transition && !this.gameOver && !this.rooms.current.enemies.some(e => e.state !== "dying"),
            onOpen: () => {
                for (const p of this.players) { p.vx = 0; p.vy = 0; p.cancelDash(); }
                this.dialogue?.latchInteract();
                this.demoProgress.held = [true, true];
            },
            onClose: () => { for (const p of this.players) p.latchDashKey(); },
            onBuy: (id, result, anvil) => this._onForgeBuy(id, anvil)
        }) : null;
        this.forgeMenu = this.forgeSystem ? new ForgeMenu({ forgeSystem: this.forgeSystem, getAmount: () => this.scrap.amount, coin: scrapFrames[0] }) : null;
        this._mapSellsDrag = !!this.mapData && mapOffersRecipe(this.mapData.map, "drag");
        this.sawDrag = this.mapData ? new SawDrag({
            chain: this.chain, getPlayers: () => [this.p1, this.p2], input: this.input,
            getStats: () => sawDragStats(TILE),
            isBlocked: (x, y) => this._sawDragBlocked(x, y),
            getBounds: () => this.arenaBounds,
            // Mapa sem bigorna que venda o Arrastar: fica liberado, como a Serra.
            canDrag: () => (this.forge.has("drag") || !this._mapSellsDrag) && !this.forgeSystem?.open && !this.sawCinematic?.active,
            audio: this.audio, particleSystem: this.particleSystem, renderer: this.renderer
        }) : null;
        this.sawPush = new DroppedSawPush({
            chain: this.chain, getPlayers: () => [this.p1, this.p2],
            isBlocked: (x, y) => this._sawDragBlocked(x, y),
            getBounds: () => this.arenaBounds,
            canPush: () => !this.sawDrag?.active && !this.forgeSystem?.open && !this.sawCinematic?.active,
            audio: this.audio, particleSystem: this.particleSystem, renderer: this.renderer
        });
        this.sawTackleFeedback = new SawTackleFeedback({ audio: this.audio, renderer: this.renderer,
            particleSystem: this.particleSystem, reducedMotion: globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false });
        this.sawTackle = new SawTackle({
            feedback: this.sawTackleFeedback,
            flightMode: this.mapData?.test?.sawTackleMode,
            // Editor 2.0: só com a receita Investida (bigorna da Penhasco). Modo clássico não tem forja: liberado.
            canTackle: () => !this.mapData || this.forge.has("tackle"),
            chain: this.chain, getPlayers: () => [this.p1, this.p2], getRoom: () => this.rooms.current,
            getBounds: () => this.arenaBounds,
            isSolid: (x, y) => this._sawSolidAt(x, y),
            safeDrop: (x, y) => this.tiles.safeDropPoint(x, y, [this.p1, this.p2]),
            findLandingRoute: (x, y, blocked) => this.tiles.safeDropRoute(x, y, [this.p1, this.p2], blocked),
            canLand: (x, y) => {
                const p = this.tiles.reachableDropPoint(x, y, [this.p1, this.p2]);
                return p.x === x && p.y === y;
            },
            getAimTargets: () => this.roomEvents?.aimPoints() ?? [],
            onEnemyHit: (enemy, result, impact) => {
                const info = this.combat.feedbackForHit(enemy, result, impact, { soundVolumeMultiplier: SAW_TACKLE_FEEL.audio.hitVolume });
                enemy.freezeOnHit?.(info.hitStop);
                if (!this.arautoEffects.owns(enemy)) this.sawMotor?.onHit();
            },
            audio: this.audio, particleSystem: this.particleSystem, renderer: this.renderer
        });
        // Melhoria "Impacto": o dash arremessa inimigos (sala "botas").
        this.dashPushFeedback = new DashPushFeedback({ particleSystem: this.particleSystem, renderer: this.renderer, audio: this.audio,
            hitStop: s => this.gameLoop?.triggerHitStop(s), endSpeed: PLAYER_UPGRADES.dashPush.launchEndSpeed,
            reducedMotion: globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false });
        this.dashPush = new DashPush({ getPlayers: () => [this.p1, this.p2], getRoom: () => this.rooms.current,
            particleSystem: this.particleSystem, feedback: this.dashPushFeedback });
        // Melhoria "Vínculo": os dois perto curam com o tempo (sala "botas").
        this.coopHeal = new CoopHeal({ getPlayers: () => [this.p1, this.p2], particleSystem: this.particleSystem, audio: this.audio });
        this.coopHealFeedback = new CoopHealFeedback({ coopHeal: this.coopHeal, getPlayers: () => [this.p1, this.p2],
            particleSystem: this.particleSystem, reducedMotion: globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false });
        // Telinha ao ganhar uma habilidade (dash nas botas, Investida na bigorna): "vídeo" de uma sala real.
        this.abilityCard = this.mapData ? new AbilityCard({
            getDevice: i => this.input.deviceFor(i), assets: this.assets
        }) : null;
        this.sawCinematic = this.forgeSystem ? new SawForgeCinematic({
            renderer: this.renderer, particleSystem: this.particleSystem, audio: this.audio, camera: this.demoCamera,
            getWeapon: () => this.chain.weapon, getPlayers: () => [this.p1, this.p2],
            getAnvilBox: anvil => this.roomProps?.solid.find(s => s.prop === anvil.prop)?.box ?? null,
            resolvePlayers: () => this._constrainTetherPlayers(this.rooms.current, this.roomEvents?.solidBoxes() ?? [], this.rooms.doorsOfCurrent(), false),
            onEnd: () => this._onSawForged()
        }) : null;

        this.interactPrompt = this.chests && this.forgeSystem ? new InteractPrompt({
            sources: [() => this.chests.promptTargets, () => this.forgeSystem.promptTargets],
            getDevice: i => this.input.deviceFor(i),
            sheet: this.assets.get("interactPrompt"),
            isVisible: () => !this.forgeSystem.open && !this.sawCinematic?.active && !this.transition && !this.gameOver
        }) : null;

        this.lighting = new LightingRenderer({ renderer: this.renderer, postProcessor: this.postProcessor });

        this.debugMenu = new DebugMenu({ getGame: () => this });

        this.gameLoop = new GameLoop({
            onFrameStart: () => { this.input.pollGamepads(); this.debugMenu.maskInput(this.input); this._maskLatchedInteract(); this._pollMenuPad(); this._updateSawMotor(); },
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
        // Só o teste do editor 2.0 pode ligar a vida infinita; o jogo normal sempre começa desligado.
        this.infiniteLives = !!this.mapData?.test?.infiniteLives;

        this._bindButtons();
        if (this.mapData?.test) {
            const back = document.createElement('a'); back.href = 'editor2.html'; back.textContent = '← Voltar ao Editor 2.0';
            back.style.cssText = 'position:fixed;right:12px;top:12px;z-index:100;color:white;background:#252035;padding:10px;border-radius:6px'; document.body.append(back);
            const lives = document.createElement('button');
            lives.type = 'button'; lives.tabIndex = -1;
            lives.style.cssText = 'position:fixed;right:12px;top:56px;z-index:100;color:white;background:#252035;padding:8px 10px;border:1px solid #7f5af0;border-radius:6px;font:inherit;cursor:pointer';
            // Sem foco no botão: Enter/Espaço são dash e não podem acioná-lo.
            lives.addEventListener('mousedown', e => e.preventDefault());
            lives.addEventListener('click', () => this.setInfiniteLives(!this.infiniteLives));
            document.body.append(lives);
            this._infiniteLivesButton = lives;
            this.setInfiniteLives(this.infiniteLives);
            window.addEventListener('keydown', e => {
                if (e.code === 'F7') { e.preventDefault(); this.setInfiniteLives(!this.infiniteLives); return; }
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
        const spark = HAZARDS.arrow.wallSpark;
        for (const impact of challenge.arrowImpacts || []) {
            this.particleSystem.triggerSparkBurst(impact.x, impact.y, spark.radius, spark.amount, spark.power);
        }
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
            if (k === "escape") { if (!this.forgeSystem?.open) this.togglePause(); }
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

    // Estado da barra de chefe: só durante o encontro ativo (chefe da sala atual, já fora do spawn congelado).
    _bossBarState() {
        if (this.arautoIntro?.active) return null;
        const boss = this.rooms?.current?.enemies?.find(e => e.hasBossBar && !e.isHidden && !e.frozen);
        return boss ? boss.bossBarState : null;
    }

    // Vida infinita (só teste): acertos e quedas seguem acontecendo, a vida não desce.
    setInfiniteLives(on) {
        this.infiniteLives = !!on;
        for (const p of [this.p1, this.p2]) if (p) p.infiniteLives = this.infiniteLives;
        if (this._infiniteLivesButton) {
            this._infiniteLivesButton.textContent = `Vida infinita: ${this.infiniteLives ? 'ON' : 'OFF'} (F7)`;
            this._infiniteLivesButton.setAttribute('aria-pressed', String(this.infiniteLives));
        }
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

    // Depois de pular a cena segurando E, o E fica fora do input até ser solto (não abre bigorna/baú no mesmo instante).
    _maskLatchedInteract() {
        if (!this._interactLatched) return;
        if (this.input.isDown('e')) this.input.keys.delete('e');
        else this._interactLatched = false;
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
        if (this.forgeSystem?.open && !this.gameLoop.paused) { this.forgeSystem.handleInput(hit); return; }
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
        this.chainTension.reset([this.p1, this.p2]);
        this.arautoAudio.reset();
        this.arautoScene.reset();
        this.arautoIntro.reset();
        this.introSkip.reset();
        this.arautoEffects.reset();
        this.rooms.reset();
        this.demoProgress.reset(this.mapData?.test?.progress);
        this.bootsPickup?.reset();
        this.abilityCard?.reset();
        this.demoDoors.opened.clear();
        this.demoVictory.hide();
        this.demoEncounter.reset();
        this.scrap?.reset();
        this.scrapCounter?.reset();
        this.chests?.reset();
        this.interactPrompt?.reset();
        this.dialogue?.clear();
        this.forgeSystem?.reset();
        this.sawDrag?.reset();
        this.sawPush?.reset();
        this.sawTackle.reset();
        this.dashPush?.reset();
        this.coopHeal?.reset();
        this.coopHealFeedback?.reset();
        this.roomEvents?.reset();
        this._respawnFadeAt = -Infinity;
        this.sawCinematic?.reset();
        this.sawIndicator?.reset();
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
        this.bossBar.reset();
        this.setInfiniteLives(this.infiniteLives);

        if (this.gameLoop.paused) this.setPaused(false, { silent: true });
        this._sawLandPending = false;

        this.audio.setLoopLevel("ambience", 0, 1500);

        const startsWithSaw = this._startsWithSaw();
        this.chain.reset({ present: startsWithSaw });
        const items = startsWithSaw ? ["saw"] : [];
        if (this.mapData?.test?.progress?.tackle) items.push("tackle");
        this.forge.reset({ items });
        this._roomForgeBuys?.clear();
        this._applySawUpgrades();

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

    // Quadro de um prop sólido: baú ou bigorna (brilho), mais a borda branca quando alguém está no alcance.
    _propFrame(prop, roomKey) {
        const over = this.chests?.frameFor(prop, roomKey) ?? this.forgeSystem?.frameFor(prop);
        const outline = over && this.interactPrompt?.outlineFor(propTargetId(roomKey, prop));
        return outline ? { ...over, outline } : over;
    }

    // Mapas cuja bigorna oferece a Serra começam sem ela; o teste do editor pode forçar qualquer estado.
    _startsWithSaw() {
        if (!this.mapData) return true;
        const forced = this.mapData.test?.progress?.saw;
        if (typeof forced === "boolean") return forced;
        return !mapOffersRecipe(this.mapData.map, "saw");
    }

    // Melhoria Estalo: onda em volta da serra quando o cabo arrebenta (não na queda nem no corte forçado).
    _snapWave(x, y, enemies) {
        const radius = snapWaveRadius(this.forge);
        if (radius <= 0) return;
        const fx = FORGE.snapWave;
        this.particleSystem.triggerShockRing(x, y, radius, { life: fx.ringLife, color: fx.ringColor });
        this.particleSystem.triggerSparkBurst(x, y, radius * 0.5, fx.sparks, 1.4);
        this.renderer.triggerShake(fx.shake);
        this.audio.play(fx.sound.cue, { rateMultiplier: fx.sound.rate, volumeMultiplier: fx.sound.volume });
        this.combat.resolveSnapWave(this.chain.weapon, enemies, x, y, radius,
            () => this.triggerHitSlowmo(),
            (enemy, info) => enemy.freezeOnHit?.(info.hitStop));
    }

    _applySawUpgrades() {
        applySawUpgrades(this.forge, this.chain, this.chain.weapon, CHAIN);
        applyHeartUpgrades(this.forge, [this.p1, this.p2]);
        applyPlayerUpgrades(this.forge, [this.p1, this.p2]);
        this.coopHeal?.setParams(coopHealParams(this.forge));
    }

    _onForgeBuy(id, anvil) {
        this._recordRoomForgeBuy(id);
        this._applySawUpgrades();
        if (id === "tackle") {
            this.forgeSystem.close({ silent: true });
            this.abilityCard?.show("ability.tackle");
            return;
        }
        // Receitas com card (Vínculo, Arrastar, Estalo, Inércia, Impacto): só na primeira compra; o nível 2 não muda a mecânica.
        const card = cardForRecipe(id);
        if (card && this.forge.level(id) === 1 && this.abilityCard) {
            this.forgeSystem.close({ silent: true });
            this.abilityCard.show(card);
            return;
        }
        if (id !== "saw") return;
        this.forgeSystem.close({ silent: true });
        this.sawCinematic.start(anvil);
    }

    // Guarda o nível anterior de cada receita comprada, por sala, para desfazer na morte da sala.
    _recordRoomForgeBuy(id) {
        const key = this.rooms.current?.key;
        if (!key) return;
        const log = this._roomForgeBuys ??= new Map();
        const buys = log.get(key) ?? [];
        // `level` já subiu quando onBuy dispara: o nível anterior é o atual menos 1.
        buys.push({ id, prevLevel: Math.max(0, this.forge.level(id) - 1) });
        log.set(key, buys);
    }

    // Fim da cinemática: os dois estão dos lados da bigorna e a serra conecta direto neles (primeira conexão).
    _onSawForged() {
        this.chain.reset({ present: true });
        this._onSawReconnect({ first: true });
    }


    // Morte na sala (ADR 0014): a dupla renasce no spawn da sala atual, só esta sala reseta e o status
    // ganho nela (melhorias compradas na bigorna, baús abertos) é perdido. As outras salas e a sucata ficam.
    _respawnRoom() {
        const key = this.rooms.current.key;
        this._rollbackRoomForgeBuys(key);
        this.chests?.forgetRoom(key);
        this.roomEvents?.resetRoom(key);

        this.sawDrag?.reset();
        this.sawPush?.reset();
        this.sawTackle.reset();
        this.dashPush?.reset();
        this.coopHeal?.reset();
        this.coopHealFeedback?.reset();
        // Morte na sala "botas": a bota volta e o dash concedido por ela re-trava (reset só vale nesta sala).
        if (this.rooms.current.cell.authored?.name === "botas") this.bootsPickup?.reset();
        this.dialogue?.clear();
        this.forgeSystem?.close({ silent: true });
        this.gibs = [];
        this.particleSystem.clear();

        this.rooms.resetCurrentRoom();
        this.arenaBounds = this.rooms.currentBounds;

        const spawns = this.rooms.dungeon.spawnPositions();
        const rect = this.rooms.cellRect();
        for (const [p, s] of [[this.p1, spawns.p1], [this.p2, spawns.p2]]) {
            p.lives = p.maxLives;
            p.respawnAt(s.x, s.y, RUN_DEATH.invulnSteps);
            this.tiles.ensureSafeSpawn(p, rect);
            p._livesSeen = p.lives;
            p._fallSeen = false;
        }
        this.chain.reset({ present: this.forge.has("saw") });
        this._rememberEntrySpawns();
        this.renderer.camX = (spawns.p1.x + spawns.p2.x) / 2;
        this.renderer.camY = (spawns.p1.y + spawns.p2.y) / 2;
        this.renderer.resetSway();
        this._respawnFadeAt = performance.now();
        this.screenGore.triggerFlash();
        this.audio.play("playerFall", { rateMultiplier: 0.8 });
        this._activateRoomEnemies();
    }

    // Desfaz as compras da forja feitas nesta sala (na ordem inversa) e esquece o registro dela.
    _rollbackRoomForgeBuys(roomKey) {
        const buys = this._roomForgeBuys?.get(roomKey);
        if (buys) {
            for (let i = buys.length - 1; i >= 0; i--) this.forge.setLevel(buys[i].id, buys[i].prevLevel);
            this._roomForgeBuys.delete(roomKey);
        }
        this._applySawUpgrades();
    }

    // Debug: leva a dupla para a sala (gx, gy) e recoloca nos spawns dela (sem transição, câmera salta).
    teleportToCell(gx, gy) {
        if (!this.mapData) return;
        this.forgeSystem?.close({ silent: true });
        this.rooms.transitionTo({ gx, gy });
        this.arenaBounds = this.rooms.currentBounds;
        const rect = this.rooms.cellRect();
        const spawns = this.rooms.dungeon.spawnPositions();
        for (const [p, s] of [[this.p1, spawns.p1], [this.p2, spawns.p2]]) {
            p.x = s.x; p.y = s.y; p.vx = 0; p.vy = 0;
            p.cancelDash();
            this.tiles.ensureSafeSpawn(p, rect);
        }
        if (!this.chain.isConnected) this.chain.reset({ present: this.chain.hasSaw });
        this.sawDrag?.reset();
        this.sawPush?.reset();
        this.sawTackle.reset();
        this._rememberEntrySpawns();
        this.renderer.camX = (this.p1.x + this.p2.x) / 2;
        this.renderer.camY = (this.p1.y + this.p2.y) / 2;
        this.renderer.resetSway();
        this._activateRoomEnemies();
    }

    // A serra largada (arrastada ou empurrada) não entra em buraco, parede, grade, estaca nem prop sólido.
    _sawDragBlocked(x, y) {
        return this.tiles.isHoleAtWorld(x, y) || this._sawSolidAt(x, y);
    }

    // Sólidos para a serra (paredes, grades, estacas, props sólidos); buracos não contam: em voo ela os cruza.
    _sawSolidAt(x, y) {
        const r = this.chain.weapon?.collisionRadius ?? 16;
        const boxes = [...(this.rooms.current?.wallBoxes || []), ...(this.roomEvents?.solidBoxes() ?? []),
            ...(this.roomProps?.solid.map(s => s.box) ?? [])];
        if (boxes.some(b => Math.hypot(x - Math.max(b.x, Math.min(x, b.x + b.w)), y - Math.max(b.y, Math.min(y, b.y + b.h))) < r)) return true;
        return (this.roomEvents?.solidCircles() ?? []).some(c => Math.hypot(x - c.x, y - c.y) < r + c.r);
    }

    _onSawReconnect({ first = false } = {}) {
        this.renderer.triggerShake(first ? SAW_CINEMATIC.firstReconnectShake : 4);

        this.audio.play("sawPickup");
        this.audio.duck(-4, { attackMs: 20, holdMs: 120, releaseMs: 600 });
        this._sawLandPending = false;

        if (first) {
            this.chain.weapon?.playReconnect?.(SAW_CINEMATIC.firstReconnectScale);
            if (SCRIPT_LINES.enabled) {
                this.dialogue?.say(0, "talk.connected.1");
                this.dialogue?.say(1, "talk.connected.2");
            }
        } else {
            this.chain.weapon?.playReconnect?.();
        }
    }

    _updateSawCinematic(dt) {
        this.sawCinematic.update(dt);
        this.particleSystem.update([this.p1, this.p2], this.arenaBounds);
        this._updateCameraToCurrentRoom(dt);
    }

    _sawSplitFeedback(weapon) {
        if (!this.chain.isConnected || (!weapon?.justSplit && !weapon?.justMerged)) return;
        const fx = FORGE.splitFeedback;
        this.audio.play("sawLand", { rateMultiplier: weapon.justSplit ? fx.splitRate : fx.mergeRate });
        this.renderer.triggerShake(fx.shake);
        for (const s of weapon.getSawPositions(this.p1, this.p2)) {
            this.particleSystem.triggerSparkBurst(s.x, s.y, weapon.discRadius, fx.sparks, fx.power);
        }
    }

    transitionThroughDoor(door) {
        this.bossBar.reset();
        this.chests?.flushPending();
        this.scrap?.collectAll();
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
        this.sawDrag?.reset();
        this.sawPush?.reset();
        this.sawTackle.reset();

        this.particleSystem.clearDamageNumbers();
        this.coopHealFeedback?.reset();

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

    _dropSawSafely() {
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
        p.loseLife(HOLE_FALL.livesLost ?? 1);
        if (p.lives <= 0) { p.fallComplete = false; return; }

        // Ainda tem vida: renasce perto do buraco (ensureSafeSpawn empurra para o chão seguro mais perto),
        // não no ponto de entrada da sala. Morrer de vez (lives<=0) segue a regra de morte lá embaixo.
        const spot = { x: p.fallX, y: p.fallY };
        p.respawnAt(spot.x, spot.y, HOLE_FALL.respawnInvulnFrames ?? 0);
        this.tiles.ensureSafeSpawn(p, this.rooms.cellRect());
        p._fallSeen = false;

        this.screenGore.triggerFlash();
        p._livesSeen = p.lives;
        this.particleSystem.triggerFlash(p.x, p.y, 10, 0.8);
    }

    _activateRoomEnemies() {
        const room = this.rooms.current;
        // Handlers de evento (ex.: ZoneSpawner) reivindicam seus inimigos soltos antes do intro genérico.
        this.roomEvents?.claimPendingEnemies(room);
        if (!room.hasPendingEnemies) return false;
        if (this._startArautoIntro(room)) return true;
        if (ROOM_INTRO.enabled) this._beginRoomIntro();
        else room.spawnEnemies(false);
        return true;
    }

    // Sala do Arauto: em vez do intro genérico, o golem nasce desmontado e a apresentação dele toca.
    _startArautoIntro(room) {
        if (!room._authoredEnemies.some(foe => foe.type === 'flameGolem')) return false;
        const golem = room.spawnEnemies(false).find(e => e.effectMaterial === 'lavaStone');
        if (!golem) return true;
        this.introSkip.reset();
        this.arautoIntro.start(golem);
        return true;
    }

    _updateArautoIntro(dt) {
        this.introSkip.update(dt);
        if (this.introSkip.done) {
            this.arautoIntro.skip();
            this._interactLatched = true;
            playUi("uiConfirm");
        } else {
            this.arautoIntro.update(dt);
        }
        for (const p of this.players) { p.vx = 0; p.vy = 0; }
        this.arautoEffects.update(this.rooms.current.enemies);
        this.particleSystem.update([this.p1, this.p2], this.arenaBounds);
        this._updateCameraToCurrentRoom(dt);
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
        if (!w) return;
        const state = {
            connected: this.chain.isConnected,
            active: this.chain.hasSaw && !this.gameOver && !this.transition && !this.roomIntro
                && !this.arautoScene.active && !this.arautoIntro.active && !this.gameLoop.paused && !this.forgeSystem?.open && !this.sawCinematic?.active,
            timeScale: this.gameLoop.timeScale
        };
        this.sawMotor?.update(w.spinSpeed ?? 0, state);
        this.sawTackleFeedback.update(this.sawTackle, w, state);
        this.arautoAudio.update(w, this.rooms.current.enemies,
            { ...state, players: [this.p1, this.p2] });
    }

    triggerHitSlowmo() {
        this.gameLoop.triggerHitSlowmo();
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
        if (this.sawCinematic?.active) {
            this._updateSawCinematic(deltaSeconds);
        } else if (this.forgeSystem?.open) {
            this._updateCameraToCurrentRoom(deltaSeconds);
        } else if (this.transition) {
            this._updateTransition();
        } else if (this.roomIntro) {
            this._updateRoomIntro(deltaSeconds);
        } else if (this.arautoIntro?.active) {
            this._updateArautoIntro(deltaSeconds);
        } else {
            if (this.arautoScene.tryStart(this.rooms.current.enemies)) {
                this.arautoScene.update(deltaSeconds);
                this.arautoEffects.update(this.rooms.current.enemies);
                this.particleSystem.update([], this.arenaBounds);
                return;
            }
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

        const canDash = dashUnlocked(!!this.mapData, this.demoProgress?.state);
        const drag = this.sawDrag;
        p1.update(this.input, this.arenaBounds, { canDash: canDash && !drag?.isDragging(0), feetInHole: this.tiles.feetInHole(p1), speedScale: drag?.speedScaleFor(0) ?? 1 });
        p2.update(this.input, this.arenaBounds, { canDash: canDash && !drag?.isDragging(1), feetInHole: this.tiles.feetInHole(p2), speedScale: drag?.speedScaleFor(1) ?? 1 });
        this._dashFeedback(p1);
        this._dashFeedback(p2);
        if (p1.justDashed || p2.justDashed) this.abilityCard?.notify("dash");
        this.dashTether.apply(p1, p2);

        this._resolveFall(p1);
        this._resolveFall(p2);

        this.effects.processPlayer(p1);
        this.effects.processPlayer(p2);

        this.sawDrag?.update();
        if (this.sawDrag?.justGrabbed) this.abilityCard?.notify("drag");
        // Antes do Chain: um tackle no mesmo passo que a reconexão vence (a serra fica travada no impacto).
        this.sawTackle.update();
        if (this.sawTackle.justTackled) this.abilityCard?.notify("tackle");
        this.thrownSaw.aimFrom([p1, p2]);
        this.chain.update(p1, p2, {
            onSnap: () => {
                const sp = this.chain.weapon?.getSawPositions?.(p1, p2)?.[0];
                const fx = sp ? sp.x : (p1.x + p2.x) / 2;
                const fy = sp ? sp.y : (p1.y + p2.y) / 2;

                this.chainTension.onSnap({ x: fx, y: fy });
                if (this.mapData && this.demoProgress.state.sawThrow) this.thrownSaw.launch();
                // Camadas do estalo: mordida de hit-stop + tremor + clarão + faíscas no ponto de ruptura.
                this.gameLoop.triggerHitStop(CHAIN_TENSION.hitStopSeconds);
                this.renderer.triggerShake(14);

                this.audio.play("sawSnap");
                this.sawMotor?.onSnap();
                this.audio.duck(-9, { attackMs: 10, holdMs: 250, releaseMs: 1100 });
                this._sawLandPending = true;

                const r = this.chain.weapon?.discRadius ?? 24;
                this.particleSystem.triggerSparkBurst(fx, fy, r, CHAIN_TENSION.snap.sparks, 1.4);
                this._snapWave(fx, fy, room.enemies);
            },
            onReconnect: () => this._onSawReconnect(),
            holdStrain: this.dashTether.holdsStrain(p1, p2),

            resolveDropPoint: (x, y) => this.tiles.reachableDropPoint(x, y, [p1, p2])
        });
        this._updateSawLanding();

        const weapon = this.chain.weapon;
        this._sawSplitFeedback(weapon);
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
        this.playerLeash?.update();

        if (room.challenge) {
            room.challenge.update([p1, p2], deltaSeconds);
            this._buttonFeedback(room.challenge);
            this._arrowTrapFeedback(room.challenge);
        }

        const enemies = room.enemies;
        this.combat.updateEnemies(enemies, [p1, p2]);
        this.dashPush?.update();
        if (this.dashPush?.justPushed) this.abilityCard?.notify("dashPush");
        this.sawTackle.onBossImpacts(enemies);
        this.arautoEffects.update(enemies);
        this.ghostfire.update(room, [p1, p2]);

        const liveEnemies = enemies.filter(e => e.state !== 'dying' && !e.isHidden && !e.airborne);
        const allEntities = [p1, p2].filter(p => !p.dashing).concat(liveEnemies.filter(e => !e.ignoresEntityCollisions));

        const sawR = (this.chain.isConnected && weapon) ? (weapon.collisionRadius ?? 0) : 0;
        // Perto de uma porta aberta a serra presa não empurra a própria dupla: no vão estreito ela fica entre os dois
        // e empurrava um para trás, travando a passagem. Inimigos continuam sendo empurrados.
        const sawBodies = sawR > 0 ? allEntities.filter(e => (e !== p1 && e !== p2) || !this._nearOpenDoor(e)) : [];
        this.chainObstacles.beginStep(this.chain);
        for (let it = 0; it < 3; it++) {
            Physics.resolveEntityCollisions(allEntities);
            this.chainObstacles.resolve(this.chain, p1, p2, liveEnemies);
            if (sawR > 0) {
                for (const sc of weapon.getSawPositions(p1, p2)) {
                    for (const e of sawBodies) Physics.resolveCircleCollision(e, sc.x, sc.y, sawR);
                }
            }
        }

        this.sawPush.update();

        if (room.wallBoxes?.length) {
            for (const entity of [p1, p2, ...room.enemies.filter(e => !e.airborne)]) {
                Physics.resolveBoxCollisions(entity, room.wallBoxes);
            }
        }
        this.roomProps?.resolveCollisions([p1, p2, ...room.enemies]);
        this.roomEvents?.resolveCollisions([p1, p2, ...liveEnemies], HOLE_FALL.footOffset, PROP_COLLISION.footRadius);
        const barBoxes = this.roomEvents?.solidBoxes() ?? [];
        if (barBoxes.length) for (const entity of [p1, p2, ...liveEnemies]) Physics.resolveBoxCollisions(entity, barBoxes);

        for (const enemy of liveEnemies) enemy.ensureOnWalkableTile?.();
        this.dashPushFeedback.update();

        enemies.forEach(e => rooms.clampEnemy(e, this.arenaBounds));
        const doors = rooms.doorsOfCurrent();
        const canPass = !rooms.isLocked();
        rooms.clampPlayer(p1, this.arenaBounds, doors, canPass);
        rooms.clampPlayer(p2, this.arenaBounds, doors, canPass);

        const tetherClear = this.chainObstacles.resolve(this.chain, p1, p2, liveEnemies, () => {
            this._constrainTetherPlayers(room, barBoxes, doors, canPass);
        });
        if (!tetherClear) this._dropSawSafely();

        this.tiles.checkHoleFalls([p1, p2]);

        for (const p of [p1, p2]) {
            if (p.falling && !p._fallSeen) {
                this.audio.play("playerFall");
                this.audio.duck(-8, { attackMs: 30, holdMs: 500, releaseMs: 1200 });
                this._dropSawSafely();
            }
            p._fallSeen = p.falling;
            this._dashLandFeedback(p);
        }
        this.holes.update([p1, p2]);

        this.combat.resolveWeaponHits(
            this.chain.weapon, enemies, p1, p2, this.chain.isConnected,
            () => this.triggerHitSlowmo(),
            (enemy, info) => {
                enemy.freezeOnHit?.(info.hitStop);
                if (!this.arautoEffects.owns(enemy)) this.sawMotor?.onHit();
            }
        );
        if (!this.chain.isConnected) this.combat.resolveLooseSawHits(this.chain.weapon, enemies,
            () => this.triggerHitSlowmo(),
            (enemy, info) => {
                enemy.freezeOnHit?.(info.hitStop);
                if (!this.arautoEffects.owns(enemy)) this.sawMotor?.onHit();
            });
        this.combat.resolveDeaths(room, this.gibs, enemy => {
            if (!this.arautoEffects.owns(enemy)) this.screenGore.trigger();
            this.scrap?.dropFromEnemy(enemy);
        }, [p1, p2]);

        this._updateHearts(room);
        this.coopHeal?.update();
        this.coopHealFeedback?.update();
        this.chests?.update();
        this.roomEvents?.update();
        this.scrap?.update([p1, p2], this.arenaBounds);

        for (let i = this.gibs.length - 1; i >= 0; i--) {
            this.gibs[i].update(this.arenaBounds);
            if (this.gibs[i].done) this.gibs.splice(i, 1);
        }

        this.effects.update();

        for (const p of [p1, p2]) {
            // damageTaken sobe a cada acerto aceito, inclusive com vida infinita (a vida não muda).
            const hurt = p._livesSeen !== undefined && (p.lives < p._livesSeen || p.damageTaken > (p._damageSeen ?? 0));
            if (hurt) {
                this.screenGore.triggerFlash();

                if (!p.falling) {
                    this.renderer.triggerShake(ARAUTO_FX.playerShake);

                    this.audio.play("playerHit", { rateMultiplier: p.lives <= 1 ? 0.88 : 1 });
                    this.audio.duck(-6, { attackMs: 10, holdMs: 150, releaseMs: 700 });
                }
            }
            p._livesSeen = p.lives;
            p._damageSeen = p.damageTaken;
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

        if ((p1.lives <= 0 || p2.lives <= 0) && this._runRules) {
            this._respawnRoom();
        } else if (p1.lives <= 0 || p2.lives <= 0) {
            this.gameOver = true;
            this._gameOverAt = performance.now();
            this.deathScreen.show();

            this.audio.setLoopLevel("ambience", -10, 1500);
        }

        this.thrownSaw.update();
        // Antes das falas e dos interativos: abrir a bigorna consome o aperto de interagir.
        this.forgeSystem?.update();
        this.interactPrompt?.update(performance.now());
        this.dialogue?.update(deltaSeconds);
        this.demoProgress.update(deltaSeconds);
        this.bootsPickup?.update();
        this.demoEncounter.update();
        this._checkDoorTransition(doors);
        this._updateCameraToCurrentRoom(deltaSeconds);
    }

    _constrainTetherPlayers(room, barBoxes, doors, canPass) {
        const players = [this.p1, this.p2];
        this.roomProps?.resolveCollisions(players);
        this.roomEvents?.resolveCollisions(players, HOLE_FALL.footOffset, PROP_COLLISION.footRadius);
        for (const player of players) {
            if (room.wallBoxes?.length) Physics.resolveBoxCollisions(player, room.wallBoxes);
            if (barBoxes?.length) Physics.resolveBoxCollisions(player, barBoxes);
            this.rooms.clampPlayer(player, this.arenaBounds, doors, canPass);
        }
    }

    _updateHearts(room) {
        const { p1, p2 } = this;
        const hearts = room.hearts;
        for (let i = hearts.length - 1; i >= 0; i--) {
            const heart = hearts[i];
            heart.update();
            const collector = [p1, p2].find(player =>
                player.lives < player.maxLives && Math.hypot(player.x - heart.x, player.y - heart.y) <= heart.radius + player.hitRadius
            );
            if (collector) {
                collector.lives = Math.min(collector.maxLives, collector.lives + 1);
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

    // Jogador alinhado a uma porta aberta e a menos de `DOOR_SAW_PASS_TILES` da borda dela (ou já dentro do vão).
    _nearOpenDoor(p) {
        if (this.rooms.isLocked()) return false;
        for (const door of this.rooms.doorsOfCurrent()) {
            if (door.blocked || door.type === 'stairs') continue;
            const half = door.passHalfWidth ?? door.halfWidth ?? this.rooms.doorHalfWidth;
            const across = door.dir === 'N' || door.dir === 'S' ? Math.abs(p.x - door.x) : Math.abs(p.y - door.y);
            if (across < half && this.rooms.doorEntryDepth(p, door, this.arenaBounds) > -DOOR_SAW_PASS_TILES * TILE) return true;
        }
        return false;
    }

    _checkDoorTransition(doors) {

        if (this.mapData ? this.mapData.test?.isolated : this.playtest) return;
        if (this.rooms.isLocked() || this.transition || this.forgeSystem?.open) return;
        const { p1, p2, rooms } = this;
        for (const door of doors) {
            if (door.blocked) continue;
            const d1 = rooms.doorEntryDepth(p1, door, this.arenaBounds);
            const d2 = rooms.doorEntryDepth(p2, door, this.arenaBounds);
            // O vão só cabe um jogador de cada vez: basta o da frente entrar e o parceiro estar no umbral
            // (alinhado e a menos de DOOR_FOLLOW_TILES da borda). Exigir os dois dentro obrigava a se espremer.
            const lead = d1 >= d2 ? { p: p1, d: d1 } : { p: p2, d: d2 };
            const back = lead.p === p1 ? { p: p2, d: d2 } : { p: p1, d: d1 };
            const across = (p) => door.dir === 'N' || door.dir === 'S' ? Math.abs(p.x - door.x) : Math.abs(p.y - door.y);
            const half = door.passHalfWidth ?? door.halfWidth ?? rooms.doorHalfWidth;
            const leadIn = lead.d > DOOR_ENTER_DEPTH * 0.5 && (door.type === 'stairs' || across(lead.p) < half);
            const backNear = door.type === 'stairs'
                ? back.d > 0
                : back.d > 2 || (across(back.p) < half + back.p.hitRadius && back.d > -DOOR_FOLLOW_TILES * TILE);
            if (leadIn && backNear) {
                this.transition = { phase: "out", t: 0, door };
                break;
            }
        }
    }

    _render() {
        const cinematic = this.arautoScene.active || this.arautoIntro.active;
        this.chainTension.update(this.chain, [this.p1, this.p2], {
            active: this._started && !this.gameOver && !this.transition && !this.roomIntro
                && !cinematic && !this.gameLoop.paused && !this.forgeSystem?.open && !this.sawCinematic?.active,
            protected: this.dashTether.holdsStrain(this.p1, this.p2)
        });
        if (this.mapData && this.demoCamera.mode === 'split' && !cinematic) this.demoCamera.renderSplit(() => this._renderView());
        else this._renderView();
        this.arautoEffects.drawCamera(this.ctx, this.canvas);
        this._renderOverlays();
        if (this.mapData && !cinematic && !this.forgeSystem?.open) {
            this.demoCamera.drawIndicators(this.ctx);
            if (this.demoCamera.mode !== 'split' && !this.transition && !this.roomIntro && !this.gameOver) {
                this.sawIndicator?.draw(this.ctx, this.canvas.width, this.canvas.height);
            }
            const ctx = this.ctx; ctx.save();
            if (this.mapData.test) { ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(`Câmera: ${this.demoCamera.mode} • F6 alterna`, 12, 24); }
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

        const nowMs = performance.now();
        this.roomProps?.drawFloor(ctx, nowMs);
        this.demoProgress.draw(ctx);
        if (open) {
            renderer.drawDoorStubs(rect, doors, TILE, doorHalf, DOOR_STUB_TILES);
            renderer.drawDoorGradients(doors, doorHalf, TILE, DOOR_STUB_TILES);
        }
        this.demoDoors.drawGates(ctx);

        this.holes.draw(ctx);

        const challenge = rooms.current.challenge;
        if (challenge) challenge.drawFloorLayer(ctx);

        this.particleSystem.drawFloor(ctx, this.arenaBounds, this.tiles.darkHoleRects());
        this.effects.draw(ctx);
        this.roomEvents?.drawFloor(ctx);
        this.ghostfire.drawFloor(ctx, rooms.current);
        for (const enemy of rooms.current.enemies) enemy.drawAttackEffect?.(ctx);

        if (challenge) challenge.drawButtons(ctx);
        this.particleSystem.drawSmoke(ctx);

        rooms.current.hearts.forEach(h => h.drawShadow(ctx));

        const p1Bounce = this.p1.speedMag > 0.15 ? Math.abs(Math.sin(this.p1.animTimer)) : 0;
        const p2Bounce = this.p2.speedMag > 0.15 ? Math.abs(Math.sin(this.p2.animTimer)) : 0;
        if (!this.p1.falling) renderer.drawRoundShadow(this.p1.x, this.p1.y, 14, p1Bounce);
        if (!this.p2.falling) renderer.drawRoundShadow(this.p2.x, this.p2.y, 14, p2Bounce);
        this.coopHealFeedback?.drawFloor(ctx);
        const enemies = rooms.current.enemies;

        enemies.forEach(e => {
            if (e.isHidden) return;
            if (e.drawShadow) e.drawShadow(ctx);
            else if (!e.airborne) renderer.drawRoundShadow(e.x, e.y, 13, 0);
        });
        this.scrap?.drawShadows(ctx);

        this.chain.drawChain(ctx, this.p1, this.p2);
        this.sawDrag?.drawRope(ctx);

        const saws = this.chain.weapon?.getSawPositions?.(this.p1, this.p2) ?? [];
        const sawY = saws.length ? saws.reduce((s, p) => s + p.y, 0) / saws.length : (this.p1.y + this.p2.y) / 2;
        const entities = [this.p1, this.p2, ...enemies];

        const occluders = challenge ? challenge.buttonOccluders(entities) : [];
        const wallDrawables = this.roomProps ? renderer.wallDrawables(rect, rooms.current.frontWalls, tiles, TILE, HOLE_FALL.footOffset) : [];
        const propDrawables = [...(this.roomProps?.drawables(nowMs) ?? []), ...(this.roomEvents?.drawables() ?? []), ...(this.demoProgress?.drawables?.() ?? []), ...this.demoDoors.drawables(), ...wallDrawables];
        // Com props sólidos a ordem é pelos pés (inimigos têm os pés bem abaixo do centro); sem eles, pelo centro.
        const sortKey = this.roomProps ? feetSortKey : (d => d.y);
        const drawables = [...entities, ...(rooms.current.corpses ?? []), ...occluders, ...propDrawables].sort((a, b) => sortKey(a) - sortKey(b));

        const drawEntity = e => {
            if (e.falling) { this.holes.drawFalling(ctx, e); return; }
            this.arautoEffects.drawTrail(ctx, e);
            e.draw(ctx);
            this.arautoEffects.drawLava(ctx, e);
        };
        drawables.filter(e => sortKey(e) <= sawY).forEach(drawEntity);

        this.chain.draw(ctx, this.p1, this.p2);

        this.chain.drawDropped(ctx);

        this.particleSystem.drawSparks(ctx);

        drawables.filter(e => sortKey(e) > sawY).forEach(drawEntity);
        this.sawCinematic?.drawWorld(ctx);
        // Cordas e gaiolas caindo: no passe do mundo, para a luz do ambiente atuar nelas.
        this.roomEvents?.drawAir(ctx);
        // Botas flutuando sobre a bigorna da sala "botas" (acima dos props; a máscara em renderLights as tira da escuridão).
        this.bootsPickup?.draw(ctx);
        this.interactPrompt?.draw(ctx, nowMs);

        this.particleSystem.drawFlames(ctx);
        this.ghostfire.drawAir(ctx, rooms.current);

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
            hearts: this.rooms.current?.hearts ?? [],
            enemies: this.rooms.current?.enemies ?? [],
            corpses: this.rooms.current?.corpses ?? []
        });

        const strain = this.chainTension.state.risk;
        this.postProcessor.setVignetteBreath(strain);

        this.ghostfire.renderLights(rooms.current, renderer, this.postProcessor);
        this.roomEvents?.renderLights(renderer, this.postProcessor);
        this.demoProgress.renderLights(renderer, this.postProcessor);
        this.bootsPickup?.renderLights(renderer, this.postProcessor);
        this.demoDoors.renderLights(this.postProcessor);
        this.sawTackleFeedback.renderLights(renderer, this.postProcessor, this.sawTackle, this.chain.weapon);
        this.coopHealFeedback?.renderLights(renderer, this.postProcessor);
        this.postProcessor.draw();

        const hearts = rooms.current.hearts;
        if (hearts.length || this.particleSystem.hasDamageNumbers || this.scrap?.pickups.length
            || this.chainTension.state.effort > 0 || this.chainTension.snapTime > 0
            || this.sawTackle.active || this.sawTackleFeedback.bursts.length || this.sawTackleFeedback.visual.lit
            || this.coopHealFeedback?.active) {
            renderer.beginOverlayWorld();

            this.chainTension.draw(ctx, this.p1, this.p2, this.chain.isConnected, this.chain.weapon);
            this.sawTackleFeedback.draw(ctx, this.sawTackle, this.chain.weapon);
            this.scrap?.drawOverlay(ctx);
            hearts.forEach(h => h.drawOverlay(ctx));
            this.coopHealFeedback?.drawOverlay(ctx);
            this.particleSystem.drawDamageNumbers(ctx);
            renderer.endOverlayWorld();
        }

        if (WIND.layer === "screen") this.wind.drawScreen(ctx, (x, y) => renderer.worldToScreen(x, y));

    }

    _renderOverlays() {
        const { ctx, canvas } = this;

        this.screenGore.draw(ctx);
        this.dialogue?.draw(ctx, this.renderer, canvas);

        if (this.transition) {
            const t = this.transition;
            const a = t.phase === "out" ? t.t : (1 - t.t);
            ctx.fillStyle = `rgba(8, 7, 14, ${Math.max(0, Math.min(1, a))})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        const fade = 1 - (performance.now() - this._respawnFadeAt) / (RUN_DEATH.fadeSeconds * 1000);
        if (fade > 0) {
            ctx.fillStyle = `rgba(8, 7, 14, ${Math.min(1, fade)})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        this.hud.draw(ctx, canvas.width, canvas.height);
        this.scrapCounter?.draw(ctx, canvas.width, canvas.height, this.hud.pixelScale(canvas.width, canvas.height));
        this.sawCinematic?.drawOverlay(ctx, canvas);
        this.arautoScene.drawOverlay(ctx, canvas);
        if (this.arautoIntro.active) {
            const k = this.arautoIntro.letterbox;
            drawLetterbox(ctx, canvas, k);
            this.introSkip.draw(ctx, canvas, this.hud.pixelScale(canvas.width, canvas.height), letterboxHeight(canvas.height, k));
        }
        this.forgeMenu?.draw(ctx, canvas);
        if (!this.forgeSystem?.open) this.abilityCard?.draw(ctx, canvas);

        const now = performance.now();
        const dt = this._bossBarAt === null ? 0 : Math.min(0.05, (now - this._bossBarAt) / 1000);
        this._bossBarAt = now;
        this.bossBar.update(dt);
        this.bossBar.draw(ctx, canvas.width, canvas.height, this.hud.freeSpan(canvas.width, canvas.height));

        this.debugMenu.draw(ctx, canvas);
    }
}
