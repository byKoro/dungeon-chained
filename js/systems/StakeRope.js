// Estaca com corda (gaiolas do salão, baús pendurados): geometria do corte e desenho compartilhados.
export const easeIn = k => k * k;
export const easeOut = k => 1 - (1 - k) * (1 - k);
export const clamp01 = v => Math.max(0, Math.min(1, v));

// Distância entre o disco que gira (preso à corrente, lançado, dado tackle, ou solto por Inércia) e um ponto; ≤ 0 = encostando.
export function sawGap(chain, players, point) {
    const w = chain?.weapon;
    if (!w) return Infinity;
    const disc = w.discRadius ?? 0;
    if (chain.isConnected) {
        const [p1, p2] = players || [];
        let best = Infinity;
        for (const p of w.getSawPositions?.(p1, p2) || []) best = Math.min(best, Math.hypot(p.x - point.x, p.y - point.y) - disc);
        return best;
    }
    // Solta: lançada pelo cabo (thrown), girando por Inércia, ou em voo do tackle (dash na serra) corta a corda.
    if (w.thrown || w.spinningLoose || w.tackleState) return Math.hypot(w.dropX - point.x, w.dropY - point.y) - disc;
    return Infinity;
}

// Impacto no chão (gaiola ou baú): tremor, hit stop, faíscas, poeira em anel e empurrão em quem estiver perto.
export function impactBurst(api, x, y, fx) {
    const ps = api.particleSystem;
    api.renderer?.triggerShake(fx.shake);
    api.renderer?.triggerZoomPunch?.(fx.zoomPunch);
    api.hitStop?.(fx.hitStop);
    ps?.triggerSparkBurst?.(x, y - 20, 30, fx.sparks, 1.3);
    ps?.triggerFlash?.(x, y - 20, fx.flash, 1);
    for (let i = 0; i < fx.dust; i++) {
        const a = (i / fx.dust) * Math.PI * 2;
        ps?.triggerDust?.(x + Math.cos(a) * 26, y + Math.sin(a) * 10, Math.cos(a), Math.sin(a) * 0.5, 2);
    }
    api.pushPlayers?.(x, y, fx.pushRadius, fx.pushForce);
}

// Baú caindo (queda esticada) e amassando no chão até o prop de verdade reaparecer.
export function drawChestDrop(ctx, api, chest, d, c) {
    const T = api.tile;
    if (!d || !chest || (d.phase !== "fall" && d.phase !== "landed")) return;
    if (d.phase === "landed" && d.t >= c.squashSteps) return;
    let y = 0, sx = 1, sy = 1;
    if (d.phase === "fall") {
        const k = d.t / c.fallSteps;
        y = -c.fallHeight * (1 - easeIn(k));
        sy = 1 + 0.18 * k; sx = 1 / sy;
    } else {
        const k = d.t / c.squashSteps;
        const wave = Math.sin(k * Math.PI * 2.5) * (1 - k);
        sy = 1 - 0.38 * wave; sx = 1 + 0.25 * wave;
    }
    const r = api.rect();
    api.drawPropFrame?.(ctx, chest.type, 0, d.col * T + r.x, d.row * T + r.y + y, sx, sy);
}

// Sprites de assets/cage; 1 pixel de arte = cfg.art px de mundo. `r` = { x, y, cut, flash } (centro do tile da estaca).
export class StakeRopeArt {
    constructor(cfg, getAssets) {
        this.cfg = cfg;
        this.getAssets = getAssets;
    }

    img(key) {
        const img = this.getAssets()?.get?.(key);
        return img?.complete && img.naturalWidth > 0 ? img : null;
    }

    stakePoint(r) {
        return { x: r.x, y: r.y + this.cfg.stakeHitY };
    }

    // Onde a corda sai da estaca (nas voltas de corda do sprite).
    knot(r) {
        const A = this.cfg.art, s = this.cfg.sprite;
        return { x: r.x, y: r.y + s.stakeFoot - (s.stakeH - s.knotY) * A };
    }

    solidCircle(r) {
        const b = this.cfg.stakeBody;
        return { x: r.x, y: r.y + this.cfg.sprite.stakeFoot - b.bodyY, r: b.radius };
    }

    shadow(ctx, x, y, k) {
        ctx.fillStyle = this.cfg.colors.shadow;
        ctx.beginPath();
        ctx.ellipse(x, y, this.cfg.width * (0.12 + k * 0.34), this.cfg.width * (0.05 + k * 0.13), 0, 0, Math.PI * 2);
        ctx.fill();
    }

    fallK(state, warnSteps, fallSteps) {
        if (state.phase === "warn") return 0.25 * clamp01(state.t / warnSteps);
        return 0.25 + 0.75 * easeIn(clamp01(state.t / fallSteps));
    }

    // Anel pontilhado no chão em volta da estaca: "passe a serra aqui". Fica mais forte com a serra perto.
    ring(ctx, r, near, tick) {
        const pulse = 0.5 + 0.5 * Math.sin(tick * 0.12 + r.x);
        const alpha = 0.25 + 0.55 * near * (0.6 + 0.4 * pulse);
        const rx = 30 + 6 * pulse, ry = rx * 0.45, cy = r.y + this.cfg.sprite.stakeFoot - 4, n = 18, P = this.cfg.art;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.cfg.colors.ring;
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + tick * 0.02;
            ctx.fillRect(Math.round((r.x + Math.cos(a) * rx) / P) * P - P / 2, Math.round((cy + Math.sin(a) * ry) / P) * P - P / 2, P, P);
        }
        ctx.restore();
    }

    // Estacas ordenadas por y com as entidades. `nearOf(r)` (0..1) faz a estaca inteira brilhar.
    drawables(stakes, nearOf, tick) {
        const img = this.img("ropeStake");
        if (!img) return [];
        const s = this.cfg.sprite, A = this.cfg.art;
        return stakes.map(r => ({
            y: r.y + s.stakeFoot - s.stakeH * A,
            feetSortY: r.y + s.stakeFoot,
            draw: ctx => {
                ctx.save();
                ctx.imageSmoothingEnabled = false;
                this.drawStake(ctx, r, img, nearOf(r), tick);
                ctx.restore();
            }
        }));
    }

    // Estaca: fica no lugar depois do corte. Inteira, brilha (faixa de luz) e pisca branco no golpe.
    drawStake(ctx, r, img, near, tick) {
        const A = this.cfg.art, s = this.cfg.sprite, cut = this.cfg.cut;
        const w = s.stakeW * A, h = s.stakeH * A;
        const sq = r.flash > 0 ? Math.sin((r.flash / cut.stakeFlashSteps) * Math.PI) * cut.squash : 0;
        ctx.save();
        ctx.translate(r.x, r.y + s.stakeFoot);
        ctx.scale(1 + sq * 0.6, 1 - sq);
        ctx.drawImage(img, -w / 2, -h, w, h);
        const glow = r.flash > 0 ? r.flash / cut.stakeFlashSteps : (r.cut ? 0 : near) * (0.35 + 0.25 * Math.sin(tick * 0.2));
        if (glow > 0.01) {
            ctx.globalCompositeOperation = "lighter";
            ctx.globalAlpha = Math.min(1, glow);
            ctx.drawImage(this._white(img), -w / 2, -h, w, h);
        }
        ctx.restore();
        if (r.cut) this.ropeEnd(ctx, this.knot(r), 0);
    }

    _white(img) {
        if (this._whiteImg?.src === img) return this._whiteImg.canvas;
        const c = document.createElement("canvas");
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const g = c.getContext("2d");
        g.drawImage(img, 0, 0);
        g.globalCompositeOperation = "source-atop";
        g.fillStyle = this.cfg.colors.shine;
        g.fillRect(0, 0, c.width, c.height);
        this._whiteImg = { src: img, canvas: c };
        return c;
    }

    // Corda inteira balançando do nó até `top`, ou (cortada) a parte de cima chicoteando para o alto e sumindo.
    rope(ctx, r, top, tick) {
        const cfg = this.cfg, knot = this.knot(r);
        if (!r.cut) {
            this.ropeAlong(ctx, knot, top, Math.sin(tick * 0.03 + r.x * 0.01) * cfg.swayAmp, cfg.ropeFade);
        } else if (r.cutT < 1) {
            const k = easeIn(r.cutT);
            const end = { x: knot.x + (top.x - knot.x) * k, y: knot.y - 18 + (top.y - knot.y + 18) * k };
            const span = Math.hypot(top.x - knot.x, top.y - knot.y);
            const fade = Math.max(0, (cfg.ropeFade * span - Math.hypot(end.x - knot.x, end.y - knot.y)) / Math.max(1, Math.hypot(top.x - end.x, top.y - end.y)));
            this.ropeAlong(ctx, end, top, Math.sin(r.cutT * 20) * 6 * (1 - r.cutT), fade);
            this.ropeEnd(ctx, end, 0);
        }
    }

    // Corda texturizada ao longo de uma curva; `wob` desloca o meio na horizontal (balanço).
    // `fade` (0..1): a partir dessa fração do caminho p→q a corda vai sumindo.
    ropeAlong(ctx, p, q, wob, fade = 1) {
        const tex = this.img("cageRope"), s = this.cfg.sprite;
        const mx = (p.x + q.x) / 2 + wob, my = (p.y + q.y) / 2;
        const at = t => ({
            x: (1 - t) * (1 - t) * p.x + 2 * (1 - t) * t * mx + t * t * q.x,
            y: (1 - t) * (1 - t) * p.y + 2 * (1 - t) * t * my + t * t * q.y
        });
        const N = 24;
        let prev = at(0), u = 0;
        for (let i = 1; i <= N; i++) {
            const cur = at(i / N);
            const len = Math.hypot(cur.x - prev.x, cur.y - prev.y);
            ctx.save();
            const tt = (i - 0.5) / N;
            if (tt > fade) ctx.globalAlpha *= Math.max(0, 1 - (tt - fade) / (1 - fade));
            ctx.translate((prev.x + cur.x) / 2, (prev.y + cur.y) / 2);
            ctx.rotate(Math.atan2(cur.y - prev.y, cur.x - prev.x));
            if (tex) {
                const tw = tex.naturalWidth, srcW = Math.max(1, Math.min(tw, Math.round(len / s.ropeThick * tex.naturalHeight)));
                const sx = Math.floor(u) % Math.max(1, tw - srcW + 1);
                ctx.drawImage(tex, sx, 0, srcW, tex.naturalHeight, -len / 2 - 0.5, -s.ropeThick / 2, len + 1, s.ropeThick);
                u += srcW;
            } else {
                ctx.fillStyle = this.cfg.colors.rope;
                ctx.fillRect(-len / 2, -s.ropeThick / 4, len, s.ropeThick / 2);
            }
            ctx.restore();
            prev = cur;
        }
    }

    // Ponta desfiada de corda cortada.
    ropeEnd(ctx, at, dangling) {
        const img = this.img("cageRopeEnd"), A = this.cfg.art;
        if (!img) return;
        const w = img.naturalWidth * A * 0.75, h = img.naturalHeight * A * 0.75;
        ctx.drawImage(img, Math.round(at.x - w / 2), Math.round(at.y - h / 2 + dangling * 4), w, h);
    }
}
