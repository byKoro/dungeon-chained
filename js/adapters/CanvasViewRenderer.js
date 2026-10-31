/**
 * CanvasViewRenderer - Platform Canvas 2D Presentation Adapter.
 * Consumes immutable RenderSnapshot from GameSimulation and renders
 * simulation elements (players, chain, saw, enemies, pickups, traps) with:
 * - Proper feetSortY depth sorting
 * - Preservation of crisp pixel art (imageSmoothingEnabled = false)
 * - Clean coordinate rendering with sprite sheets or crisp procedural fallbacks
 */

export class CanvasViewRenderer {
    constructor(opts = {}) {
        this.assets = opts.assets || null;
        this.renderer = opts.renderer || null;
    }

    setAssets(assets) {
        this.assets = assets;
    }

    setRenderer(renderer) {
        this.renderer = renderer;
    }

    prepareFrame(ctx) {
        if (ctx) {
            ctx.imageSmoothingEnabled = false;
        }
    }

    onRenderFrame(ctx, snapshot) {
        if (ctx) {
            ctx.imageSmoothingEnabled = false;
        }
    }

    /**
     * Renders simulation state onto the given Canvas 2D rendering context.
     * @param {CanvasRenderingContext2D} ctx
     * @param {Object} snapshot RenderSnapshot from GameSimulation
     * @returns {number} Count of rendered drawables
     */
    renderSimulation(ctx, snapshot) {
        if (!ctx || !snapshot) return 0;

        // Requirement: preserve crisp pixel art
        ctx.imageSmoothingEnabled = false;

        // 1. Shadows Layer
        this._renderShadows(ctx, snapshot);

        // 2. Chain/Tether Cable
        if (snapshot.chain?.connected && snapshot.chain?.points?.length > 1) {
            this._renderChain(ctx, snapshot.chain);
        }

        // 3. Assemble and Depth-Sort Drawables by feetSortY
        const drawables = [];

        // Players
        if (Array.isArray(snapshot.players)) {
            for (let i = 0; i < snapshot.players.length; i++) {
                const p = snapshot.players[i];
                drawables.push({
                    type: 'player',
                    index: i,
                    feetSortY: p.feetSortY ?? (p.y + 14),
                    draw: (c) => this._drawPlayer(c, p, i)
                });
            }
        }

        // Enemies
        if (Array.isArray(snapshot.enemies)) {
            for (let i = 0; i < snapshot.enemies.length; i++) {
                const e = snapshot.enemies[i];
                drawables.push({
                    type: 'enemy',
                    index: i,
                    feetSortY: e.feetSortY ?? (e.y + 14),
                    draw: (c) => this._drawEnemy(c, e)
                });
            }
        }

        // Dropped Saw
        if (snapshot.saw?.dropped) {
            drawables.push({
                type: 'dropped_saw',
                feetSortY: snapshot.saw.y,
                draw: (c) => this._drawSaw(c, snapshot.saw)
            });
        }

        // Pickups
        if (Array.isArray(snapshot.pickups)) {
            for (let i = 0; i < snapshot.pickups.length; i++) {
                const pick = snapshot.pickups[i];
                if (pick.collected) continue;
                drawables.push({
                    type: 'pickup',
                    feetSortY: pick.y,
                    draw: (c) => this._drawPickup(c, pick)
                });
            }
        }

        // Traps
        if (Array.isArray(snapshot.traps)) {
            for (let i = 0; i < snapshot.traps.length; i++) {
                const trap = snapshot.traps[i];
                drawables.push({
                    type: 'trap',
                    feetSortY: trap.y,
                    draw: (c) => this._drawTrap(c, trap)
                });
            }
        }

        // Depth sort by feetSortY ascending
        drawables.sort((a, b) => a.feetSortY - b.feetSortY);

        // Active saw position if attached to tether
        const activeSaw = (!snapshot.saw?.dropped && snapshot.chain?.connected && snapshot.saw) ? snapshot.saw : null;
        const sawY = activeSaw ? activeSaw.y : Infinity;

        // Render drawables in order
        for (const drawable of drawables) {
            if (activeSaw && !activeSaw.rendered && drawable.feetSortY > sawY) {
                this._drawSaw(ctx, activeSaw);
                activeSaw.rendered = true;
            }
            drawable.draw(ctx);
        }

        if (activeSaw && !activeSaw.rendered) {
            this._drawSaw(ctx, activeSaw);
            activeSaw.rendered = true;
        }

        return drawables.length;
    }

    _renderShadows(ctx, snapshot) {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';

        // Player shadows
        if (Array.isArray(snapshot.players)) {
            for (const p of snapshot.players) {
                if (p.isFalling) continue;
                ctx.beginPath();
                ctx.ellipse(p.x, p.y + 12, 13, 5, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Enemy shadows
        if (Array.isArray(snapshot.enemies)) {
            for (const e of snapshot.enemies) {
                if (e.hp <= 0) continue;
                ctx.beginPath();
                ctx.ellipse(e.x, e.y + 11, 12, 4.5, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Dropped saw shadow
        if (snapshot.saw?.dropped) {
            ctx.beginPath();
            ctx.ellipse(snapshot.saw.x, snapshot.saw.y + 4, snapshot.saw.radius || 14, 5, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    _renderChain(ctx, chain) {
        const points = chain.points;
        if (!points || points.length < 2) return;

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Dark outline
        ctx.strokeStyle = '#181425';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();

        // Inner metallic line (tints red when strained)
        const strainRatio = Math.min(1, Math.max(0, (chain.strain || 0) / 20));
        ctx.strokeStyle = strainRatio > 0.5 ? '#e06c75' : '#8a939e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();

        ctx.restore();
    }

    _drawPlayer(ctx, player, index) {
        ctx.save();

        if (player.invulnerable && (Math.floor(Date.now() / 80) % 2 === 0)) {
            ctx.globalAlpha = 0.45;
        }

        if (player.isFalling) {
            const scale = Math.max(0, 1 - (player.fallProgress || 0));
            ctx.translate(player.x, player.y);
            ctx.scale(scale, scale);
            ctx.translate(-player.x, -player.y);
        }

        const primaryColor = index === 0 ? '#4fa3e3' : '#e05638';
        const outlineColor = '#181425';

        // Body outline
        ctx.fillStyle = outlineColor;
        ctx.beginPath();
        ctx.arc(player.x, player.y, 11, 0, Math.PI * 2);
        ctx.fill();

        // Body core
        ctx.fillStyle = primaryColor;
        ctx.beginPath();
        ctx.arc(player.x, player.y, 9, 0, Math.PI * 2);
        ctx.fill();

        // Visor / eyes indicating facing direction
        ctx.fillStyle = '#ffffff';
        const eyeOffset = player.facingLeft ? -4 : 4;
        ctx.beginPath();
        ctx.arc(player.x + eyeOffset, player.y - 2, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    _drawEnemy(ctx, enemy) {
        ctx.save();

        const x = enemy.x;
        const y = enemy.y;
        const isHurt = enemy.animState === 'hurt' || enemy.animState === 'stunned';

        // Silhouette / outline
        ctx.fillStyle = '#181425';
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.fill();

        // Core body
        ctx.fillStyle = isHurt ? '#ffffff' : (enemy.type === 'flameGolem' ? '#d97706' : '#9e2a2b');
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#fbbf24';
        const eyeOffset = enemy.facingLeft ? -4 : 4;
        ctx.beginPath();
        ctx.arc(x + eyeOffset, y - 2, 2, 0, Math.PI * 2);
        ctx.fill();

        // Health bar if damaged
        if (enemy.hp < enemy.maxHp && enemy.hp > 0) {
            const barW = 20;
            const barH = 3;
            const barX = x - barW / 2;
            const barY = y - 18;

            ctx.fillStyle = '#181425';
            ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

            const hpRatio = Math.max(0, enemy.hp / enemy.maxHp);
            ctx.fillStyle = hpRatio > 0.4 ? '#22c55e' : '#ef4444';
            ctx.fillRect(barX, barY, barW * hpRatio, barH);
        }

        ctx.restore();
    }

    _drawSaw(ctx, saw) {
        ctx.save();
        ctx.translate(saw.x, saw.y);
        ctx.rotate(saw.rotation || 0);

        const r = saw.radius || 14;

        // Circular blade outline
        ctx.fillStyle = '#181425';
        ctx.beginPath();
        ctx.arc(0, 0, r + 2, 0, Math.PI * 2);
        ctx.fill();

        // Metallic blade disc
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();

        // Cutting teeth
        ctx.fillStyle = '#64748b';
        const toothCount = 8;
        for (let i = 0; i < toothCount; i++) {
            const angle = (i / toothCount) * Math.PI * 2;
            const tx = Math.cos(angle) * (r - 2);
            const ty = Math.sin(angle) * (r - 2);
            ctx.beginPath();
            ctx.arc(tx, ty, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Center hub
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    _drawPickup(ctx, pickup) {
        ctx.save();
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(pickup.x, pickup.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    _drawTrap(ctx, trap) {
        ctx.save();
        ctx.fillStyle = trap.state === 'active' ? '#dc2626' : '#475569';
        ctx.fillRect(trap.x - 8, trap.y - 8, 16, 16);
        ctx.restore();
    }
}
