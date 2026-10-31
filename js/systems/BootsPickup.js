import { BOOTS, KEY_LIGHT } from '../config/DemoConfig.js';
import { TILE, LIGHT_PIXEL_SCALE } from '../config/GameConfig.js';
import { ANIMATED_PROPS } from '../config/PropConfig.js';

// Botas da sala "botas": um item que flutua sobre a bigorna com o visual da chave/serra largada (sombra pixelada,
// reflexo transversal, fora da escuridão por máscara, luz leve). Quando um jogador chega perto (sem botão), coleta:
// pop-out da chave + burst, concede o dash e salta a telinha de tutorial. Persiste na run (sai/volta da sala continua
// pego); a morte-na-sala (reset) faz a bota voltar e o dash re-travar.
export class BootsPickup {
    constructor({ rooms, getPlayers, assets, demoProgress, particleSystem = null, renderer = null, audio = null,
        hitStop = null, onPickup = null, roomName = "botas", cfg = BOOTS }) {
        Object.assign(this, { rooms, getPlayers, assets, demoProgress, particleSystem, renderer, audio, hitStop, onPickup, roomName, cfg });
        this._masks = [];
        this.reset();
    }

    reset() {
        // Re-trava o dash concedido pela bota (morte-na-sala / nova partida).
        if (this.granted && this.demoProgress?.state) this.demoProgress.state.dash = false;
        this.collected = false;
        this.granted = false;
        this.celebrate = null;
        this._pulse = 0;
    }

    // A bigorna da sala "botas" (prop + posição no mundo), ou null se não estamos nessa sala.
    _anvil() {
        const room = this.rooms.current;
        if (!room || room.cell.authored?.name !== this.roomName) return null;
        const prop = (room.tiles.props || []).find(p => p.type === "anvil");
        if (!prop) return null;
        const rect = this.rooms.cellRect();
        const def = ANIMATED_PROPS.anvil;
        return {
            prop,
            x: rect.x + (prop.col + def.w / 2) * TILE,
            // Topo da bigorna: meio do tile menos o lift.
            top: rect.y + (prop.row + 0.5) * TILE - this.cfg.liftTiles * TILE
        };
    }

    // Enquanto a bota não foi pega e estamos na sala dela, para a câmera/destaque do BotasRoomScript.
    get present() {
        return !this.collected && !!this._anvil();
    }

    // Ponto de mundo da bota (centro), para o foco de câmera da cinemática.
    focusPoint() {
        const a = this._anvil();
        return a ? { x: a.x, y: a.top } : null;
    }

    update() {
        this._pulse++;
        if (this.celebrate) {
            this.celebrate.t++;
            const c = this.cfg.pickup;
            if (this.celebrate.t <= c.zoomHold) this.renderer?.triggerZoomPunch?.(c.zoomPunch * (1 - this.celebrate.t / c.zoomHold));
            if (this.celebrate.t % c.reburstEvery === 0 && this.celebrate.t < c.celebrateSteps) {
                this.particleSystem?.triggerSparkBurst?.(this.celebrate.x, this.celebrate.y - c.rise * (this.celebrate.t / c.celebrateSteps), 22, c.reburstSparks, 1.1);
            }
            if (this.celebrate.t >= c.celebrateSteps) this.celebrate = null;
        }
        if (this.collected) return;
        const a = this._anvil();
        if (!a) return;
        for (const p of this.getPlayers() || []) {
            if (!p || p.falling || p.lives <= 0) continue;
            if (Math.hypot(p.x - a.x, p.y - a.top) <= this.cfg.pickupRadius) { this._collect(a); break; }
        }
    }

    _collect(a) {
        const c = this.cfg.pickup, ps = this.particleSystem;
        this.collected = true;
        this.celebrate = { t: 0, x: a.x, y: a.top };
        // Concede o dash (a bota é a origem do dash nesta sala).
        if (this.demoProgress?.state) { this.demoProgress.state.dash = true; this.granted = true; }
        this.renderer?.triggerZoomPunch?.(c.zoomPunch);
        this.renderer?.triggerShake?.(c.shake);
        this.hitStop?.(c.hitStop);
        this.audio?.play?.(c.sound, { rateMultiplier: c.soundRate });
        ps?.triggerSparkBurst?.(a.x, a.top, 30, c.sparks, c.sparksPower);
        ps?.triggerFlash?.(a.x, a.top, c.flash, 1);
        for (let n = 0; n < c.dust; n++) {
            const ang = (n / c.dust) * Math.PI * 2;
            ps?.triggerDust?.(a.x + Math.cos(ang) * 18, a.top + 18 + Math.sin(ang) * 6, Math.cos(ang), Math.sin(ang) * 0.5, 1);
        }
        this.onPickup?.(a.x, a.top);
    }

    _hover() {
        return (Math.sin(this._pulse * this.cfg.bobSpeed) + 1) / 2;
    }

    // Centro vertical atual da bota (flutuação + subida do pickup), usado no desenho e na luz.
    _bodyY(a) {
        const B = this.cfg, cel = this.celebrate;
        const bob = Math.sin(this._pulse * B.bobSpeed) * B.bobAmp;
        const p = cel ? Math.min(1, cel.t / B.pickup.celebrateSteps) : 0;
        return a.top - bob - (cel ? B.pickup.rise * (p * (2 - p)) : 0);
    }

    // Pop-out igual ao da chave (DemoProgress._popScale): incha com overshoot, pisca branco, encolhe esticando.
    _popScale(cel) {
        if (!cel) return { sx: 1, sy: 1, flash: false };
        const c = this.cfg.pickup, t = cel.t;
        if (t <= c.growSteps) {
            const u = t / c.growSteps, k = 1.70158, m = u - 1;
            const s = 1 + (c.peakScale - 1) * (1 + (k + 1) * m * m * m + k * m * m);
            return { sx: s, sy: s, flash: t >= c.growSteps - 1 };
        }
        const v = Math.min(1, (t - c.growSteps) / (c.celebrateSteps - c.growSteps));
        const s = c.peakScale * (1 - v * v);
        return { sx: s * (1 - c.stretch * v), sy: s * (1 + c.stretch * v), flash: t < c.growSteps + c.flashSteps };
    }

    // Passe do mundo: sombra pixelada no tampo da bigorna, sprite em escala inteira, reflexo transversal e a máscara
    // (retângulo de tela do sprite) que o `renderLights` usa para tirar a bota da escuridão.
    draw(ctx) {
        const a = this._anvil();
        if (!a) return;
        const cel = this.celebrate;
        if (this.collected && !cel) return;
        const B = this.cfg, size = 16 * B.artScale, half = size / 2;
        const img = this.assets?.get?.(B.assetKey);
        if (!cel) this._drawPixelShadow(ctx, a.x, a.top + B.shadow.offsetY, this._hover());
        if (!(img?.complete && img.naturalWidth)) return;

        const pop = this._popScale(cel);
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.translate(Math.round(a.x), Math.round(this._bodyY(a)));
        ctx.scale(pop.sx, pop.sy);
        ctx.drawImage(img, -half, -half, size, size);
        if (pop.flash) {
            ctx.drawImage(this._silhouette(img), -half, -half, size, size);
        } else {
            ctx.globalCompositeOperation = "lighter";
            ctx.drawImage(this._beam(img), -half, -half, size, size);
        }
        const m = ctx.getTransform();
        this._masks.push({ img: this._silhouette(img), x: m.e - half * m.a, y: m.f - half * m.d, w: size * m.a, h: size * m.d });
        ctx.restore();
    }

    // Depois do passe do mundo: máscara (sprite fora da escuridão) + luz leve da chave enquanto não foi pega.
    renderLights(renderer, postProcessor) {
        if (!postProcessor) return;
        for (const m of this._masks) postProcessor.addMask(m.img, m.x, m.y, m.w, m.h);
        this._masks.length = 0;
        const a = this._anvil();
        if (!a || this.collected) return;
        const L = this.cfg.light;
        const pulse = 1 + L.pulse * Math.sin(this._pulse * this.cfg.bobSpeed);
        const s = renderer.worldToScreen(a.x, this._bodyY(a));
        const px = Math.max(2, Math.round((TILE / 16) * s.zoom * LIGHT_PIXEL_SCALE));
        postProcessor.addLight(s.x, s.y, L.radius * pulse * s.zoom, px, 1, KEY_LIGHT);
    }

    // Elipse em blocos do tamanho do pixel de arte; encolhe/clareia conforme a bota sobe.
    _drawPixelShadow(ctx, x, y, hover) {
        const S = this.cfg.shadow, P = this.cfg.artScale;
        const rx = Math.max(2, Math.round(S.w * (1 - hover * 0.25))), ry = Math.max(1, S.h);
        ctx.save();
        ctx.globalAlpha = Math.max(0, S.baseAlpha - hover * S.hoverFade);
        ctx.fillStyle = "#000000";
        const ox = Math.round(x), oy = Math.round(y);
        for (let j = -ry; j < ry; j++) {
            const f = (j + 0.5) / ry, w = Math.round(rx * Math.sqrt(Math.max(0, 1 - f * f)));
            if (w > 0) ctx.fillRect(ox - w * P, oy + j * P, w * 2 * P, P);
        }
        ctx.restore();
    }

    _silhouette(img) {
        if (this._silhouetteCanvas?.src === img) return this._silhouetteCanvas.canvas;
        const c = document.createElement("canvas");
        c.width = c.height = 16;
        const g = c.getContext("2d");
        g.imageSmoothingEnabled = false;
        g.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, 16, 16);
        g.globalCompositeOperation = "source-in";
        g.fillStyle = "#ffffff";
        g.fillRect(0, 0, 16, 16);
        this._silhouetteCanvas = { src: img, canvas: c };
        return c;
    }

    // Reflexo transversal igual ao `SawWeapon._buildBeam`: faixa diagonal estreita (stops 0.42/0.5/0.58) varrendo o sprite.
    _beam(img) {
        const S = 16;
        if (!this._beamCanvas) { this._beamCanvas = document.createElement("canvas"); this._beamCanvas.width = this._beamCanvas.height = S; }
        const bc = this._beamCanvas, bx = bc.getContext("2d");
        bx.imageSmoothingEnabled = false;
        bx.globalCompositeOperation = "source-over";
        bx.clearRect(0, 0, S, S);
        const p = (Math.sin(this._pulse * this.cfg.shineSpeed) + 1) / 2, travel = -S + p * (2.2 * S);
        const grad = bx.createLinearGradient(travel - S * 0.5, travel - S * 0.5, travel + S * 0.5, travel + S * 0.5);
        grad.addColorStop(0.0, "rgba(255,255,255,0)");
        grad.addColorStop(0.42, "rgba(255,255,255,0)");
        grad.addColorStop(0.5, `rgba(255,255,255,${this.cfg.shineAlpha})`);
        grad.addColorStop(0.58, "rgba(255,255,255,0)");
        grad.addColorStop(1.0, "rgba(255,255,255,0)");
        bx.fillStyle = grad;
        bx.fillRect(0, 0, S, S);
        bx.globalCompositeOperation = "destination-in";
        bx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, S, S);
        bx.globalCompositeOperation = "source-over";
        return bc;
    }
}
