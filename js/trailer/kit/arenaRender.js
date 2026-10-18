/**
 * Desenho de uma ActionArena no canvas PRÓPRIO dela: mundo (girado pelo
 * drone), iluminação, névoa, respingos e a serra por cima de tudo.
 */
import {
    TILE, BACKGROUND_TILE, DOOR_STUB_TILES, PLAYER_LIGHT_RADIUS, LIGHT_PIXEL_SCALE, TORCHES
} from '../../config/GameConfig.js';
import { easeOut } from '../anim.js';

const SOFT = [
    { offset: 0.0, alpha: 1.0 }, { offset: 0.3, alpha: 0.62 },
    { offset: 0.55, alpha: 0.32 }, { offset: 0.8, alpha: 0.12 }, { offset: 1.0, alpha: 0 }
];
const LIGHT = {
    player: { color: '255, 214, 160', falloff: SOFT },
    fill: { color: '104, 86, 140', falloff: [{ offset: 0, alpha: 0.36 }, { offset: 0.6, alpha: 0.16 }, { offset: 1, alpha: 0 }], flickerBase: 1, flickerSine: 0, flickerNoise: 0 },
    saw: { color: '150, 196, 255', falloff: SOFT, flickerBase: 1, flickerSine: 0.05, flickerNoise: 0.02 },
    connect: { color: '215, 232, 255', falloff: SOFT, flickerBase: 1, flickerSine: 0, flickerNoise: 0 },
    kill: { color: '255, 70, 50', falloff: SOFT, flickerBase: 1, flickerSine: 0, flickerNoise: 0.1 },
    alarm: { color: '255, 40, 36', falloff: [{ offset: 0, alpha: 0.75 }, { offset: 0.5, alpha: 0.32 }, { offset: 1, alpha: 0 }], flickerBase: 1, flickerSine: 0, flickerNoise: 0.03 },
};

export function renderArena(A, w, h) {
    A.ensureSize(w, h);
    const { ctx, renderer, p1, p2, saw } = A;
    const W = A.canvas.width, H = A.canvas.height;

    renderer.beginFrame();
    // Rotação do drone em volta do centro da tela.
    const base = ctx.getTransform();
    ctx.setTransform(new DOMMatrix()
        .translate(W / 2, H / 2).rotate(A.rot * 180 / Math.PI).translate(-W / 2, -H / 2)
        .multiply(base));
    const worldTf = ctx.getTransform();
    drawBackground(A);

    const stub = DOOR_STUB_TILES * TILE;
    ctx.save();
    ctx.beginPath();
    ctx.rect(-stub, -stub, A.rect.w + stub * 2, A.rect.h + stub * 2);
    ctx.clip();

    renderer.drawRoom(A.rect, A.bounds, A.tiles, TILE, true, A.doorList, A.doorHalf);
    renderer.drawDoorStubs(A.rect, A.doorList, TILE, A.doorHalf, DOOR_STUB_TILES);
    renderer.drawDoorGradients(A.doorList, A.doorHalf, TILE, DOOR_STUB_TILES);
    drawClosedDoors(A, ctx, false);
    A.particles.drawFloor(ctx, A.bounds);
    A.particles.drawSmoke(ctx);
    A.onDrawFloor?.(ctx);

    for (const p of [p1, p2]) renderer.drawRoundShadow(p.x, p.y, 14 - Math.min(6, p.hopZ * 0.4), 0);
    for (const e of A.enemies) if (!e.isHidden) renderer.drawRoundShadow(e.x, e.y, 13, 0);

    if (A.sawVisible && A.connected) {
        ctx.save();
        ctx.globalAlpha = A.chainReveal;
        saw.drawChain(ctx, p1, p2);
        ctx.restore();
        if (A.chainReveal < 1) drawConnectPulse(A, ctx, A.chainReveal);
    }

    const drawEnt = (e) => {
        if (e === p1 || e === p2) {
            // Pulinho + tremedeira aplicados só no desenho.
            const ox = e.shiver ? (Math.random() - 0.5) * e.shiver * 2 : 0;
            const oy = -e.hopZ;
            e.x += ox; e.y += oy; e.draw(ctx); e.x -= ox; e.y -= oy;
        } else e.draw(ctx);
    };
    [p1, p2, ...A.enemies].sort((a, b) => a.y - b.y).forEach(drawEnt);
    A.particles.drawSparks(ctx);
    A.particles.drawFlames(ctx);
    renderer.drawFrontWall(A.rect, A.tiles, TILE, true, A.doorList, A.doorHalf, DOOR_STUB_TILES);
    drawClosedDoors(A, ctx, true);
    for (const g of A.gibs) g.draw(ctx);
    drawArrows(A, ctx);
    A.onDrawTop?.(ctx);
    A.particles.drawAir(ctx);
    A.wind.draw(ctx);

    ctx.restore();
    renderer.endFrame();

    renderLights(A);
    A.post.draw();
    A.stage.drawFogOn(ctx, W, H, A.fogPhase ?? 0);
    drawRedMood(A, ctx, W, H);
    A.screenGore.draw(ctx);
    A.lens.draw(ctx);

    // Serra por cima de tudo (destaque) + anel de choque da reconexão.
    ctx.save();
    ctx.setTransform(worldTf);
    if (A.sawVisible) {
        const sp = A.sawPos, s = A.sawScale;
        if (s !== 1) {
            ctx.translate(sp.x, sp.y); ctx.scale(s, s); ctx.translate(-sp.x, -sp.y);
        }
        A.stage._drawSawGlow(ctx, sp);
        if (A.freeSaw) { const f = { x: sp.x, y: sp.y }; saw.draw(ctx, f, f); }
        else if (A.connected) saw.draw(ctx, p1, p2);
        else if (saw.dropped) saw.drawDropped(ctx);
        if (s !== 1) ctx.setTransform(worldTf);
    }
    if (A.connectFlash > 0 && A._connectAt) {
        const f = A.connectFlash, a = A._connectAt;
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(200, 225, 255, ${f})`;
        ctx.lineWidth = 3 + 8 * f;
        ctx.beginPath();
        ctx.arc(a.x, a.y, 24 + easeOut(1 - f) * 260, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.restore();

    // Clarões em tela (reconexão azul / impacto branco).
    const flash = Math.max(A.connectFlash * 0.55, A.impactFlash);
    if (flash > 0.01) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = A.connectFlash > A.impactFlash
            ? `rgba(170, 205, 255, ${flash * 0.5})` : `rgba(255, 255, 255, ${flash * 0.45})`;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
    }
}

// Portas FECHADAS (A.doorOpen[dir] < 1): as folhas recolhem para os batentes
// conforme abrem. A porta S é redesenhada por cima da parede frontal.
function drawClosedDoors(A, ctx, front) {
    const ts = A.renderer.tileset;
    if (!ts || !ts.ready) return;
    const last = A.cols - 1, bottom = A.rows - 1;
    const seen = {};
    for (const d of A.tiles.doorCells) {
        const dir = d.row === 0 ? 'N' : d.row === bottom ? 'S' : d.col === 0 ? 'W' : d.col === last ? 'E' : null;
        const k = A.doorOpen[dir];
        if (k === undefined || k >= 1) continue;
        if (front !== (dir === 'S')) continue;
        const n = seen[dir] = (seen[dir] ?? -1) + 1;   // 0 = primeira folha
        const s = 1 - k * k;
        const x = d.col * TILE, y = d.row * TILE;
        if (dir === 'N' || dir === 'S') {
            const w = TILE * s;
            ts.draw(ctx, d.index, n === 0 ? x : x + TILE - w, y, w, TILE);
        } else {
            const h = TILE * s;
            ts.draw(ctx, d.index, x, n === 0 ? y : y + TILE - h, TILE, h);
        }
    }
}

// Clima vermelho: vinheta vermelha pulsando (alarme) por cima da luz.
function drawRedMood(A, ctx, W, H) {
    if (A.red <= 0.01) return;
    const pulse = 0.5 + 0.5 * Math.sin((A.t || 0) * Math.PI * 2 * A.redHz);
    const a = A.red * (0.28 + 0.22 * pulse);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const R = Math.hypot(W, H) / 2;
    const g = ctx.createRadialGradient(W / 2, H / 2, R * 0.35, W / 2, H / 2, R);
    g.addColorStop(0, 'rgba(120, 0, 12, 0)');
    g.addColorStop(0.6, `rgba(120, 0, 14, ${a * 0.55})`);
    g.addColorStop(1, `rgba(70, 0, 8, ${a})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = `rgba(200, 20, 30, ${A.red * (0.1 + 0.08 * pulse)})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
}

// Fundo cobrindo a viewport GIRADA (o do Renderer só cobre a reta).
function drawBackground(A) {
    const r = A.renderer, ts = r.tileset;
    if (!ts || !ts.ready) return;
    const R = Math.hypot(A.canvas.width, A.canvas.height) / 2 / r.zoom + TILE * 2;
    const x0 = Math.floor((r.camX - R) / TILE) * TILE, y0 = Math.floor((r.camY - R) / TILE) * TILE;
    for (let y = y0; y < r.camY + R; y += TILE)
        for (let x = x0; x < r.camX + R; x += TILE)
            ts.draw(A.ctx, BACKGROUND_TILE, x, y, TILE, TILE);
}

function drawArrows(A, ctx) {
    const img = A.arrowSprite;
    for (const a of A.arrows) {
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(a.angle);
        if (a.stuck > 0) ctx.rotate(Math.sin(a.stuck * 60) * 0.08 * a.stuck);
        else {
            ctx.fillStyle = 'rgba(255, 240, 220, 0.28)'; // rastro de velocidade
            ctx.fillRect(-70, -1.5, 52, 3);
        }
        if (img && img.complete && img.naturalWidth > 0) {
            ctx.rotate(-Math.PI / 2); // eixo do sprite (como no ArrowTrap do jogo)
            ctx.drawImage(img, -19, -19, 38, 38);
        } else {
            ctx.fillStyle = '#d9c9a3';
            ctx.fillRect(-16, -2, 32, 4);
        }
        ctx.restore();
    }
}

// Pulso de luz correndo do meio da corda até os dois na reconexão.
function drawConnectPulse(A, ctx, rev) {
    const { saw, p1, p2 } = A;
    const spread = easeOut(rev);
    const glow = Math.sin(rev * Math.PI);
    if (glow <= 0.01) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 7;
    ctx.strokeStyle = `rgba(200, 225, 255, ${0.9 * glow})`;
    ctx.shadowColor = 'rgba(170, 205, 255, 0.9)';
    ctx.shadowBlur = 14 * glow;
    const seg = (a, b) => {
        ctx.beginPath();
        for (let i = 0; i <= 20; i++) {
            const pt = saw.cablePoint(p1, p2, a + (b - a) * i / 20);
            if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
    };
    seg(0.5, 0.5 - 0.5 * spread);
    seg(0.5, 0.5 + 0.5 * spread);
    ctx.restore();
}

// Luzes: preenchimento, tochas, jogadores, serra, reconexão, abates.
function renderLights(A) {
    const pp = A.post;
    const pix = (zoom, s = LIGHT_PIXEL_SCALE) => Math.max(2, Math.round((TILE / 16) * zoom * s));
    const ws = (x, y) => A.ws(x, y);

    const c = ws(A.rect.w / 2, A.rect.h / 2);
    pp.addLight(c.x, c.y, A.rect.w * 0.75 * c.zoom, pix(c.zoom, 1.4), 0.7, LIGHT.fill);

    if (TORCHES.enabled) {
        const tl = TORCHES.light, area = tl.area;
        const glow = { ...tl, falloff: tl.glow.falloff };
        const areaP = { ...tl, falloff: area.falloff };
        for (const t of A.tiles.torches) {
            let wx = t.col * TILE + TILE / 2, wy = t.row * TILE + TILE / 2, ax = 0, ay = 0;
            if (t.side === 'N') { wy += tl.offsetY; ay = area.pushIn; }
            else if (t.side === 'S') { wy -= tl.offsetY; ay = -area.pushIn; }
            else if (t.side === 'W') { wx += tl.offsetX; ax = area.pushIn; }
            else if (t.side === 'E') { wx -= tl.offsetX; ax = -area.pushIn; }
            const s = ws(wx, wy);
            const px = pix(s.zoom, tl.pixelScale);
            pp.addLight(s.x, s.y, tl.glow.radius * s.zoom, px, tl.glow.flatten, glow);
            const a = ws(wx + ax, wy + ay);
            pp.addLight(a.x, a.y, area.radius * 1.15 * s.zoom, px, area.flatten, areaP);
        }
    }

    for (const p of [A.p1, A.p2]) {
        const s = ws(p.x, p.y);
        pp.addLight(s.x, s.y, PLAYER_LIGHT_RADIUS * 1.35 * s.zoom, pix(s.zoom), 1, LIGHT.player);
    }
    if (A.sawVisible) {
        const sp = A.sawPos, s = ws(sp.x, sp.y);
        const breathe = A.connected || A.freeSaw ? 1 : 0.85 + (A.saw.dropHover ?? 0) * 0.3;
        pp.addLight(s.x, s.y, (70 + A.saw.spin * 40) * breathe * A.sawScale * s.zoom, pix(s.zoom), 1, LIGHT.saw);
    }
    // Alarme vermelho: luz vermelha pulsando em volta dos dois.
    if (A.red > 0.01) {
        const pulse = 0.5 + 0.5 * Math.sin((A.t || 0) * Math.PI * 2 * A.redHz);
        const m = ws(A.mid.x, A.mid.y);
        pp.addLight(m.x, m.y, 520 * m.zoom, pix(m.zoom, 1.4), 0.8,
            { ...LIGHT.alarm, falloff: LIGHT.alarm.falloff.map(f => ({ offset: f.offset, alpha: f.alpha * A.red * (0.55 + 0.45 * pulse) })) });
    }
    if (A.connectFlash > 0 && A._connectAt) {
        const s = ws(A._connectAt.x, A._connectAt.y);
        pp.addLight(s.x, s.y, (120 + 380 * A.connectFlash) * s.zoom, pix(s.zoom), 0.9, LIGHT.connect);
    }
    for (const f of A.killFlashes) {
        const s = ws(f.x, f.y);
        pp.addLight(s.x, s.y, 130 * f.life * s.zoom, pix(s.zoom), 0.8, LIGHT.kill);
    }
}
