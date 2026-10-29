import { ARAUTO_FX } from '../config/ArautoEffectsConfig.js';

export class ArautoEffects {
    constructor({ renderer, particleSystem }) {
        this.renderer = renderer;
        this.particles = particleSystem;
        this.reset();
    }

    reset() {
        this.states = new WeakMap();
        this.masks = new WeakMap();
        this.blur = 0;
    }

    attack() {
        this.renderer.triggerShake(ARAUTO_FX.attackShake);
        this.blur = Math.max(this.blur, ARAUTO_FX.attackBlur);
    }

    drawCamera(ctx, canvas) {
        if (this.blur < ARAUTO_FX.blurCutoff) { this.blur = 0; return; }
        if (!this.blurCanvas) this.blurCanvas = document.createElement('canvas');
        const copy = this.blurCanvas;
        if (copy.width !== canvas.width || copy.height !== canvas.height) {
            copy.width = canvas.width; copy.height = canvas.height;
        }
        const buffer = copy.getContext('2d');
        buffer.clearRect(0, 0, copy.width, copy.height);
        buffer.drawImage(canvas, 0, 0);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.filter = `blur(${this.blur}px)`;
        ctx.drawImage(copy, 0, 0);
        ctx.restore();
        this.blur *= ARAUTO_FX.blurDecay;
    }

    owns(enemy) { return enemy.effectMaterial === 'lavaStone'; }

    hit(enemy, info) {
        const length = Math.hypot(info.dirX, info.dirY) || 1;
        this.particles.triggerLavaDebris?.(info.x, info.y, ARAUTO_FX.contactPieces,
            { dirX: -info.dirX / length, dirY: -info.dirY / length, groundY: enemy.footY });
    }

    groundHit(enemy, slam = false) {
        this.renderer.triggerShake(slam ? ARAUTO_FX.slamShake : ARAUTO_FX.groundShake);
        this.blur = Math.max(this.blur, slam ? ARAUTO_FX.slamBlur : ARAUTO_FX.groundBlur);
        this.particles.triggerLavaDebris?.(enemy.x, enemy.footY, ARAUTO_FX.impactPieces,
            { groundY: enemy.footY });
        this.particles.triggerDust?.(enemy.x, enemy.footY, 0, 1, ARAUTO_FX.impactPieces);
    }

    pose(enemy) {
        const anim = enemy._currentAnim();
        return { x: enemy.x, y: enemy.y - enemy.jumpHeight, frame: enemy._currentFrameIndex(anim),
            row: anim.row, left: enemy.facingLeft };
    }

    update(enemies) {
        for (const enemy of enemies) {
            if (!this.owns(enemy)) continue;
            let state = this.states.get(enemy);
            if (!state) { state = { trails: [], tick: 0, previous: this.pose(enemy) }; this.states.set(enemy, state); }
            state.tick++;
            for (const trail of state.trails) trail.life--;
            state.trails = state.trails.filter(trail => trail.life > 0);
            if (enemy.charging && !enemy.isDying) {
                this.renderer.triggerShake(ARAUTO_FX.dashShake);
                this.blur = Math.max(this.blur, ARAUTO_FX.dashBlur);
                state.trails.push({ ...state.previous, life: ARAUTO_FX.trailLife });
                if (state.trails.length > ARAUTO_FX.trailMax) state.trails.shift();
            }
            state.previous = this.pose(enemy);
            if (enemy.phase !== 2 || enemy.isDying || enemy.isHidden || state.tick % ARAUTO_FX.lavaEvery) continue;
            const pose = this.pose(enemy), mask = this._mask(enemy, pose);
            if (!mask?.points.length) continue;
            const point = mask.points[Math.floor(Math.random() * mask.points.length)];
            const s = enemy.sprite, scale = s.drawHeight / s.cropH;
            const x = ((s.cropX + point.x - s.cellSize / 2) * scale) * (pose.left ? -1 : 1);
            const y = (s.cropY + point.y - enemy._anchorY()) * scale;
            this.particles.triggerLavaDebris?.(enemy.x + x, pose.y + y, 1, { lava: true, groundY: enemy.footY });
        }
    }

    _mask(enemy, pose) {
        const sheet = enemy.sheet;
        if (typeof document === 'undefined' || !sheet?.complete || !sheet.naturalWidth) return null;
        let frames = this.masks.get(sheet);
        if (!frames) { frames = new Map(); this.masks.set(sheet, frames); }
        const key = `${pose.row}:${pose.frame}`;
        if (frames.has(key)) return frames.get(key);
        const s = enemy.sprite;
        const silhouette = document.createElement('canvas');
        silhouette.width = s.cropW; silhouette.height = s.cropH;
        const maskCtx = silhouette.getContext('2d');
        maskCtx.drawImage(sheet, pose.frame * s.cellSize + s.cropX, pose.row * s.cellSize + s.cropY,
            s.cropW, s.cropH, 0, 0, s.cropW, s.cropH);
        const pixels = maskCtx.getImageData(0, 0, s.cropW, s.cropH);
        for (let i = 0; i < pixels.data.length; i += 4) {
            if (pixels.data[i] > 120 || pixels.data[i + 2] < pixels.data[i + 1]) pixels.data[i + 3] = 0;
        }
        maskCtx.putImageData(pixels, 0, 0);
        const canvas = document.createElement('canvas');
        canvas.width = s.cropW; canvas.height = s.cropH;
        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = ARAUTO_FX.lavaColors[1]; ctx.lineWidth = ARAUTO_FX.crackWidth;
        for (const crack of ARAUTO_FX.cracks) {
            ctx.beginPath();
            crack.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
            ctx.stroke();
        }
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(silhouette, 0, 0);
        const rgba = ctx.getImageData(0, 0, s.cropW, s.cropH).data;
        const points = [];
        for (let y = 0; y < s.cropH; y++) for (let x = 0; x < s.cropW; x++) {
            if (rgba[(y * s.cropW + x) * 4 + 3]) points.push({ x, y });
        }
        const result = { canvas, points, flow: new Map() };
        frames.set(key, result);
        return result;
    }

    _drawPose(ctx, enemy, pose, image, cropped = false) {
        const s = enemy.sprite, scale = s.drawHeight / s.cropH;
        ctx.save();
        ctx.translate(pose.x, pose.y);
        if (pose.left) ctx.scale(-1, 1);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(image, cropped ? 0 : pose.frame * s.cellSize + s.cropX,
            cropped ? 0 : pose.row * s.cellSize + s.cropY, s.cropW, s.cropH,
            (s.cropX - s.cellSize / 2) * scale, (s.cropY - enemy._anchorY()) * scale,
            s.cropW * scale, s.drawHeight);
        ctx.restore();
    }

    drawTrail(ctx, enemy) {
        if (!this.owns(enemy) || enemy.isHidden || !enemy.sheet?.naturalWidth) return;
        const state = this.states.get(enemy);
        if (!state) return;
        ctx.save();
        for (const trail of state.trails) {
            ctx.globalAlpha = ARAUTO_FX.trailAlpha * trail.life / ARAUTO_FX.trailLife;
            this._drawPose(ctx, enemy, trail, enemy.sheet);
        }
        ctx.restore();
    }

    drawLava(ctx, enemy) {
        if (!this.owns(enemy) || enemy.isHidden) return;
        const reveal = enemy.phase === 2 ? 1 : enemy.lavaReveal;
        if (!reveal) return;
        const pose = this.pose(enemy), mask = this._mask(enemy, pose);
        if (!mask) return;
        ctx.save();
        ctx.globalAlpha = reveal * ARAUTO_FX.crackAlpha;
        this._drawPose(ctx, enemy, pose, mask.canvas, true);
        const phase = Math.floor((this.states.get(enemy)?.tick ?? 0) / ARAUTO_FX.flowEvery) % ARAUTO_FX.flowFrames;
        if (!mask.flow.has(phase)) {
            const flow = document.createElement('canvas');
            flow.width = mask.canvas.width; flow.height = mask.canvas.height;
            const flowCtx = flow.getContext('2d');
            flowCtx.drawImage(mask.canvas, 0, 0);
            flowCtx.globalCompositeOperation = 'source-in';
            flowCtx.fillStyle = ARAUTO_FX.lavaColors[0];
            flowCtx.beginPath();
            for (let y = phase; y < flow.height; y += ARAUTO_FX.flowFrames) {
                flowCtx.rect(0, y, flow.width, ARAUTO_FX.flowBand);
            }
            flowCtx.fill();
            mask.flow.set(phase, flow);
        }
        this._drawPose(ctx, enemy, pose, mask.flow.get(phase), true);
        ctx.restore();
    }
}
