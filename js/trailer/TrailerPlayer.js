import { TrailerStage } from './TrailerStage.js';
import { IntroScene } from './scenes/IntroScene.js';
import { TitleBloodScene } from './scenes/TitleBloodScene.js';
import { FrenzyScene } from './scenes/frenzy/FrenzyScene.js';
import { ZigZagShot } from './scenes/montage/ZigZagShot.js';
import { SnapShot } from './scenes/montage/SnapShot.js';
import { SplitShot } from './scenes/montage/SplitShot.js';
import { MapGenScene } from './scenes/mapgen/MapGenScene.js';
import { ArrowRunShot } from './scenes/rush/ArrowRunShot.js';
import { HoleRunShot } from './scenes/rush/HoleRunShot.js';
import { ButtonDoorShot } from './scenes/rush/ButtonDoorShot.js';
import { GiantSawShot } from './scenes/rush/GiantSawShot.js';
import { BossWallShot } from './scenes/rush/BossWallShot.js';
import { TrailerAudio } from './audio/TrailerAudio.js';
import { PauseScreen } from '../ui/PauseScreen.js';
import { playUi, preloadUi } from '../ui/UiSound.js';
import { drawText, measureText } from '../ui/PixelFont.js';
import { MenuPad } from '../core/MenuPad.js';

const SCENE_MOOD = {
    IntroScene: [-26, 420, 1.5],
    TitleBloodScene: [-14, 1200, 0.2],
    FrenzyScene: [-7, 4000, 0.8],
    ZigZagShot: [0, 20000, 0.15],
    SnapShot: [-1, 20000, 0.2],
    SplitShot: [-2, 14000, 0.3],
    MapGenScene: [-8, 5000, 0.6],
    ArrowRunShot: [-2, 20000, 0.4],
    HoleRunShot: [-2, 16000, 0.3],
    ButtonDoorShot: [-5, 9000, 0.3],
    GiantSawShot: [-3, 14000, 0.3],
    BossWallShot: [-20, 650, 0.5]
};

const SCENES = [
    IntroScene, TitleBloodScene, FrenzyScene, ZigZagShot, SnapShot, SplitShot, MapGenScene,
    ArrowRunShot, HoleRunShot, ButtonDoorShot, GiantSawShot, BossWallShot
];

const IMPACT_INVERT = 0.06;
const IMPACT_FLASH = 0.22;
const PAD_UNLOCK_WAIT_MS = 300;

export class TrailerPlayer {
    constructor(canvas, assets, opts = {}) {
        this.stage = new TrailerStage(canvas, assets);
        opts.setupStage?.(this.stage);
        this.audio = opts.audio === false ? null : new TrailerAudio();
        this.stage.audio = this.audio?.available ? this.audio : null;
        this.stage.hookAudio?.();
        this.letterbox = opts.letterbox !== false;
        this.music = opts.music !== false;
        this.scenes = (opts.scenes || SCENES).map(Scene => new Scene(this.stage));
        this._gate = null;
        this._paused = false;
        this.pauseScreen = null;
        this.menuPad = new MenuPad();
        this.onPadAction = opts.onPadAction || null;
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', () => {
                if (document.hidden && this.running && !this._gate) this.setPaused(true);
            });
        }
        this.onEnd = opts.onEnd || null;
        this.onBegin = opts.onBegin || null;
        this.showTimer = !!opts.showTimer;
        this.index = 0;
        this.running = false;
        this.ended = false;
        this.time = 0;
        this.sceneTime = 0;
        this.impactT = -1;
        this._raf = 0;
        this._last = 0;
        this._frame = (now) => this._tick(now);
    }

    get current() { return this.scenes[this.index]; }

    play(from = 0) {
        const au = this.stage.audio;
        if (au && !au.running) {
            this._showGate(from);
            return;
        }
        this._begin(from);
    }

    _showGate(from) {
        this.stage.attach();
        if (this._gate) { this._gate.from = from; return; }
        const gate = this._gate = { from, t: 0, loaded: false };
        preloadUi();
        this.stage.audio.ready.then(() => { gate.loaded = true; });
        const go = (e, { fromPad = false } = {}) => {
            if (e?.key === 'Escape' || gate.going) return;
            gate.going = true;
            window.removeEventListener('pointerdown', go, true);
            window.removeEventListener('keydown', go, true);
            if (!e?.target?.closest?.('.pixel-btn, button')) playUi('uiConfirm');
            const au = this.stage.audio;
            const begin = () => {
                if (this._gate !== gate) return;
                this._gate = null;
                this._begin(gate.from);
            };
            au.unlock().then(() => au.ready).then(begin);
            // No navegador, botão de controle não conta como gesto e o áudio não destrava: segue mudo, sem travar no gate.
            if (fromPad) {
                setTimeout(() => {
                    if (this._gate !== gate || au.running) return;
                    this.stage.audio = null;
                    begin();
                }, PAD_UNLOCK_WAIT_MS);
            }
        };
        gate.go = go;
        gate.cancel = () => {
            window.removeEventListener('pointerdown', go, true);
            window.removeEventListener('keydown', go, true);
        };
        window.addEventListener('pointerdown', go, true);
        window.addEventListener('keydown', go, true);
        if (!this.running) {
            this.running = true;
            this._last = performance.now();
            this._raf = requestAnimationFrame(this._frame);
        }
    }

    get paused() { return this._paused; }

    setPaused(paused, { silent = false } = {}) {
        paused = !!paused;
        if (paused === this._paused) return;
        if (paused && (this._gate || !this.running || this.allowPause === false)) return;
        this._paused = paused;
        if (!this.pauseScreen && typeof document !== 'undefined') {
            this.pauseScreen = new PauseScreen({
                rootId: 'trailer-pause',
                onResume: () => this.setPaused(false, { silent: true })
            });
        }
        if (paused) {
            this.stage.audio?.pause();
            this.pauseScreen?.show();
            playUi('uiOpen');
        } else {
            this.pauseScreen?.hide();
            this.stage.audio?.resume();
            if (!silent) playUi('uiClose');
            this._last = performance.now();
        }
    }
    togglePause() { this.setPaused(!this._paused); }

    _pollPad() {
        const hit = this.menuPad.poll();
        if (this._gate) {
            if (hit.any) this._gate.go?.(null, { fromPad: true });
            return;
        }
        if (this._paused && this.pauseScreen) {
            const ps = this.pauseScreen;
            if (hit.start) this.togglePause();
            else if (hit.up) ps.move(-1);
            else if (hit.down) ps.move(1);
            else if (hit.left) ps.adjust(-1);
            else if (hit.right) ps.adjust(1);
            else if (hit.a) ps.confirm();
            else if (hit.b) this.setPaused(false);
            return;
        }
        if (hit.start) { if (!this.onPadAction?.('start')) this.togglePause(); }
        else if (hit.a) this.onPadAction?.('a');
    }

    _begin(from = 0) {
        this._finishing = null;
        if (this._paused) this.setPaused(false, { silent: true });
        this.stage.attach();
        this.stage.bars.reset();
        if (this.letterbox) this.stage.bars.show();
        this.stage.resetActors();
        this.scenes.forEach(s => s.reset?.());
        this.index = Math.max(0, Math.min(from, this.scenes.length - 1));
        this.ended = false;
        this.time = 0;
        this.sceneTime = 0;
        this.impactT = -1;
        const au = this.stage.audio;
        if (au) { au.start({ music: this.music }); this._applyMood(); }
        this.current.start();
        if (!this.running) {
            this.running = true;
            this._last = performance.now();
            this._raf = requestAnimationFrame(this._frame);
        }
        if (this.onBegin) { const cb = this.onBegin; this.onBegin = null; cb(); }
    }

    finish() {
        if (this._finishing) return this._finishing;
        if (this._paused) this.setPaused(false, { silent: true });
        this.stage.bars.hide();
        this._finishing = new Promise(resolve => { this._finishResolve = resolve; });
        return this._finishing;
    }

    stop() {
        this.running = false;
        cancelAnimationFrame(this._raf);
        this._gate?.cancel?.();
        this._gate = null;
        if (this._paused) { this._paused = false; this.pauseScreen?.hide(); }
        this.stage.audio?.stopAll(0.6);
        this.stage.detach();
        const ctx = this.stage.ctx;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
    }

    _tick(now) {
        if (!this.running) return;
        const dt = Math.min(0.05, (now - this._last) / 1000);
        this._last = now;
        this._pollPad();
        if (this._gate) { this._gate.t += dt; this._drawGate(); }
        else if (this._paused) {   }
        else { this.update(dt); this.render(); }
        this._raf = requestAnimationFrame(this._frame);
    }

    _drawGate() {
        const { ctx, canvas } = this.stage;
        const W = canvas.width, H = canvas.height, g = this._gate;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#05030a';
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
        const logo = this.stage.drawTitleLogo(0, Math.min(1, g.t / 0.6), H / 2 - 16);
        const promptY = logo ? logo.y + logo.h + 36 : H / 2 + 64;
        const text = g.loaded ? '▶ CLICK OR PRESS ANY BUTTON  (sound on)' : 'loading sound…';
        const art = this._pixelText(text);
        const s = Math.max(2, (this.stage.logoScale() || 3) - 1);
        const blink = 0.55 + 0.45 * Math.sin(g.t * 4);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = g.loaded ? blink : 0.4;
        ctx.drawImage(art, Math.round((W - art.width * s) / 2), Math.round(promptY), art.width * s, art.height * s);
        ctx.restore();
        this.stage.drawLetterbox();
    }

    _pixelText(text) {
        this._pixelTextCache ??= new Map();
        let c = this._pixelTextCache.get(text);
        if (c) return c;
        c = document.createElement('canvas');
        c.width = measureText(text) + 1;
        c.height = 7;
        const g = c.getContext('2d');
        drawText(g, text, 0, 1, '#3a2408');
        drawText(g, text, 0, 0, '#ffd68c');
        this._pixelTextCache.set(text, c);
        return c;
    }

    _applyMood() {
        const m = SCENE_MOOD[this.current.constructor.name];
        if (m) this.stage.audio?.mood(m[0], m[1], m[2]);
    }

    _audioState() {
        const sc = this.current, st = this.stage;
        const W = st.canvas.width, H = st.canvas.height;
        const A = sc.arena ?? sc.left ?? null;
        let s;
        if (A) {
            const r = A.renderer;
            s = {
                W, H, slow: A.timeScale,
                cam: { x: r.camX, y: r.camY, zoom: r.zoom, rot: A.rot },
                shake: r.screenShake,
                saw: { visible: A.sawVisible && (A.connected || !!A.freeSaw), spin: A.freeSaw ? 1 : A.saw.spin, scale: A.sawScale },
                players: [A.p1, A.p2], ws: (x, y) => A.ws(x, y), amb: 0.6
            };
        } else {
            const r = st.renderer;
            s = {
                W, H, slow: sc.timeScale ?? 1,
                cam: { x: r.camX, y: r.camY, zoom: r.zoom, rot: 0 },
                shake: r.screenShake,
                saw: { visible: sc.sawCarried ?? true, spin: st.saw.spin, scale: 1 },
                players: [st.p1, st.p2], ws: (x, y) => r.worldToScreen(x, y), amb: 0.8
            };
        }
        if (sc.audioState) Object.assign(s, sc.audioState(s));
        return s;
    }

    update(dt) {
        const st = this.stage;
        st.bars.update(dt);
        if (this._finishing) {
            if (st.bars.hidden) {
                this._finishResolve?.();
                this._finishResolve = null;
            }
            return;
        }
        this.time += dt;
        this.sceneTime += dt;
        this.current.update(dt);
        if (this.current.isDone && this.index < this.scenes.length - 1) {
            this.index++;
            this.sceneTime = 0;
            this.current.start();
            this._applyMood();
            const au = st.audio;
            if (this.current.cutIn === 'impact') {
                this.impactT = 0;
                au?.play('impact', { vol: 0.9 });
                au?.play('whoosh', { vol: 0.45, rate: 1.25 });
                au?.duck(-10, 0.05, 0.7);
                au?.excite(0.5);
            } else if (this.current.cutIn !== 'dry') au?.play('whoosh', { vol: 0.35, rate: 0.9 });
        }
        st.audio?.tick(dt, this._audioState());
        if (this.impactT >= 0) {
            this.impactT += dt;
            if (this.impactT > IMPACT_FLASH) this.impactT = -1;
        }
        st._tickExpressions(dt);
        st.tickSpeech(dt);
        if (st.bloodScreen.mode === 'drain') st.bloodScreen.update(dt);
        if (st.overlay) {
            st.overlay.update(dt);
            if (st.overlay.done) st.overlay = null;
        }

        if (!this.ended && this.index === this.scenes.length - 1 && this.current.reachedEnd) {
            this.ended = true;
            this.onEnd?.();
        }
    }

    render() {
        const { ctx, canvas } = this.stage;
        this.current.render();
        this.stage.bloodScreen.draw(ctx);
        this.stage.overlay?.draw(ctx);
        this._drawImpact(ctx, canvas);
        if (this.letterbox) this.stage.drawLetterbox();
        if (this.showTimer) this._drawTimer(ctx, canvas);
    }

    _drawImpact(ctx, canvas) {
        const t = this.impactT;
        if (t < 0) return;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        if (t < IMPACT_INVERT) {
            ctx.globalCompositeOperation = 'difference';
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else {
            const k = 1 - (t - IMPACT_INVERT) / (IMPACT_FLASH - IMPACT_INVERT);
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = `rgba(255, 255, 255, ${0.55 * k * k})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.restore();
    }

    _drawTimer(ctx, canvas) {
        const name = this.current.constructor.name;
        const txt = `${this.time.toFixed(1)}s · cena ${this.index} ${name} +${this.sceneTime.toFixed(1)}s`;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.font = '11px monospace';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = 'rgba(167, 169, 190, 0.45)';
        ctx.fillText(txt, 10, canvas.height - 8);
        ctx.restore();
    }
}
