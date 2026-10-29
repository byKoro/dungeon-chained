import { SAW_CINEMATIC } from '../config/ForgeConfig.js';

const clamp01 = v => Math.max(0, Math.min(1, v));
const easeOut = k => 1 - Math.pow(1 - k, 3);

// Craft da Serra: letterbox, câmera na bigorna, três marteladas, a serra salta girando e cai na bigorna.
// O Game congela a simulação enquanto `active`; `onEnd(anvil)` larga a serra de verdade.
export class SawForgeCinematic {
    constructor({ renderer, particleSystem, audio = null, camera = null, getWeapon, onEnd = null, cfg = SAW_CINEMATIC }) {
        Object.assign(this, { renderer, particleSystem, audio, camera, getWeapon, onEnd, cfg });
        this.reset();
    }

    reset() {
        this.active = false;
        this.t = 0;
        this.anvil = null;
        this._hits = 0;
        this._landed = false;
        if (this.camera) this.camera.focus = null;
    }

    start(anvil) {
        this.reset();
        this.active = true;
        this.anvil = anvil;
        if (this.camera) this.camera.focus = { x: anvil.x, y: anvil.y + this.cfg.focusOffsetY, zoom: this.cfg.zoom };
    }

    get anvilTop() {
        return { x: this.anvil.x, y: this.anvil.y - this.cfg.sawLift };
    }

    update(dt) {
        if (!this.active) return;
        const c = this.cfg;
        this.t += dt;
        const top = this.anvilTop;
        while (this._hits < c.hits.length && this.t >= c.hits[this._hits]) {
            const i = this._hits++;
            this.audio?.play("forgeHammer", { rateMultiplier: 1 + i * 0.06 });
            this.renderer.triggerShake(c.hitShake[i]);
            this.particleSystem.triggerSparkBurst?.(top.x, top.y + 8, 18, c.hitSparks[i], 1 + i * 0.25);
            this.particleSystem.triggerFlash?.(top.x, top.y + 6, 6 + i * 3, 0.8);
        }
        if (!this._landed && this.t >= c.jumpEnd) {
            this._landed = true;
            this.audio?.play("sawLand");
            this.renderer.triggerShake(c.landShake);
            this.particleSystem.triggerFlash?.(top.x, top.y, c.landFlash, 1);
        }
        if (this.t >= c.end) {
            const anvil = this.anvil;
            this.active = false;
            if (this.camera) this.camera.focus = null;
            this.onEnd?.(anvil);
        }
    }

    // 0..1 = altura das faixas pretas.
    get letterbox() {
        if (!this.active) return 0;
        const c = this.cfg;
        if (this.t < c.letterboxIn) return easeOut(this.t / c.letterboxIn);
        if (this.t > c.outStart) return 1 - easeOut(clamp01((this.t - c.outStart) / (c.end - c.outStart)));
        return 1;
    }

    // Pose da serra no mundo durante o salto e depois de pousar; null antes de surgir.
    sawPose() {
        const c = this.cfg;
        if (!this.active || this.t < c.jumpStart) return null;
        const top = this.anvilTop;
        if (this.t < c.jumpEnd) {
            const k = (this.t - c.jumpStart) / (c.jumpEnd - c.jumpStart);
            return { x: top.x, y: top.y - Math.sin(k * Math.PI) * c.jumpHeight, rotation: k * c.jumpSpins * Math.PI * 2, sx: 1, sy: 1, glow: 0 };
        }
        const since = this.t - c.jumpEnd;
        const sq = since < c.squashTime ? Math.sin((since / c.squashTime) * Math.PI) * (1 - since / c.squashTime) : 0;
        const glow = since < c.glowTime ? Math.sin((since / c.glowTime) * Math.PI) : 0;
        return { x: top.x, y: top.y, rotation: 0, sx: 1 + sq * c.squashAmount * 0.6, sy: 1 - sq * c.squashAmount, glow };
    }

    drawWorld(ctx) {
        const pose = this.sawPose();
        if (pose) this.getWeapon()?.drawAt?.(ctx, pose.x, pose.y, pose);
    }

    drawOverlay(ctx, canvas) {
        const k = this.letterbox;
        if (k <= 0) return;
        const h = Math.round(canvas.height * this.cfg.barRatio * k);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = "#050409";
        ctx.fillRect(0, 0, canvas.width, h);
        ctx.fillRect(0, canvas.height - h, canvas.width, h);
        ctx.restore();
    }
}
