import { SAW_INDICATOR as CFG } from '../config/SawIndicatorConfig.js';
import { TILE } from '../config/GameConfig.js';
import { drawText, measureText } from '../ui/PixelFont.js';

// Frame limpo da serra parada (linha 0, última coluna) do sprite sheet 16px, 4 colunas.
const SAW_FRAME = 16;
const SAW_COLS = 4;
const CLEAN_COL = SAW_COLS - 1;
const CLEAN_ROW = 0;

// Seta pixelada no HUD apontando pra serra quando ela sai do enquadramento (câmera da demo que segue a dupla).
// O disco usa o próprio sprite da serra (gira devagar); a seta aponta pra fora, na direção da serra.
export class SawOffscreenIndicator {
    constructor({ renderer, getSaw, getPlayers, getScale, sawSprite }) {
        Object.assign(this, { renderer, getSaw, getPlayers, getScale, sawSprite });
        this._phase = 0;
        this._spin = 0;
        this._arrowBuf = null;
    }

    reset() {
        this._phase = 0;
        this._spin = 0;
    }

    // Serra conectada: disco do meio do cabo. Solta/na bigorna: ponto onde caiu.
    _sawWorld() {
        const weapon = this.getSaw?.();
        if (!weapon) return null;
        if (weapon.dropped) return { x: weapon.dropX, y: weapon.dropY };
        const [p1, p2] = this.getPlayers();
        const pos = weapon.getSawPositions?.(p1, p2)?.[0];
        return pos ? { x: pos.x, y: pos.y } : null;
    }

    draw(ctx, W, H) {
        const world = this._sawWorld();
        if (!world) return;

        const at = this.renderer.worldToScreen(world.x, world.y);
        const pad = CFG.hideWithinScreen;
        const onScreen = at.x >= pad && at.x <= W - pad && at.y >= pad && at.y <= H - pad;
        if (onScreen) return;

        const cx = W / 2, cy = H / 2;
        const dx = at.x - cx, dy = at.y - cy;
        if (dx === 0 && dy === 0) return;
        const angle = Math.atan2(dy, dx);

        this._phase += (Math.PI * 2 * CFG.pulseHz) / 60;
        this._spin += CFG.spinPerFrame;
        const pulse = 1 + CFG.pulseDepth * (0.5 + 0.5 * Math.sin(this._phase));
        const scale = Math.max(1, Math.round(this.getScale?.() ?? 4));

        // Raio da coisa inteira: disco + folga + seta (a seta aponta pra fora, então é ela que encosta na borda).
        const a = CFG.arrow;
        const reach = (CFG.discSize / 2 + a.gap + a.length) * scale;
        // Folga embaixo pro número da distância (fonte de 5 px + sombra).
        const textDrop = (CFG.discSize / 2 + 4 + 7) * scale;
        const inset = CFG.edgeMargin + reach;
        // Clampa o centro do disco deixando a marca inteira (seta pra qualquer lado, texto embaixo) dentro da tela.
        const ex = Math.max(inset, Math.min(W - inset, at.x));
        const ey = Math.max(inset, Math.min(H - inset - textDrop, at.y));

        this._drawArrow(ctx, ex, ey, angle, scale, pulse);
        this._drawSaw(ctx, ex, ey, scale, pulse);

        const [p1, p2] = this.getPlayers();
        const dist = Math.hypot(world.x - (p1.x + p2.x) / 2, world.y - (p1.y + p2.y) / 2);
        const tiles = dist / TILE;
        if (tiles >= CFG.showDistanceTiles) this._drawDistance(ctx, ex, ey, Math.round(tiles), scale);
    }

    _drawSaw(ctx, ex, ey, scale, pulse) {
        const sprite = this.sawSprite;
        const ready = sprite && sprite.complete && sprite.naturalWidth > 0;
        const size = CFG.discSize * scale * pulse;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.translate(Math.round(ex), Math.round(ey));
        ctx.rotate(this._spin);
        if (ready) {
            ctx.drawImage(sprite, CLEAN_COL * SAW_FRAME, CLEAN_ROW * SAW_FRAME, SAW_FRAME, SAW_FRAME,
                Math.round(-size / 2), Math.round(-size / 2), Math.round(size), Math.round(size));
        } else {
            ctx.fillStyle = CFG.colors.outline;
            ctx.beginPath(); ctx.arc(0, 0, size / 2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#c8ccd4';
            ctx.beginPath(); ctx.arc(0, 0, size / 2 - scale, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }

    // Seta desenhada a 1 art px num buffer e escalada por inteiro; aponta pra fora (na direção da serra).
    _drawArrow(ctx, ex, ey, angle, scale, pulse) {
        const a = CFG.arrow;
        const c = CFG.colors;
        const pad = 2;
        const w = a.length + pad * 2;
        const h = a.width + pad * 2;
        if (!this._arrowBuf || this._arrowBuf.width !== w || this._arrowBuf.height !== h) {
            this._arrowBuf = document.createElement('canvas');
            this._arrowBuf.width = w;
            this._arrowBuf.height = h;
        }
        const buf = this._arrowBuf;
        const g = buf.getContext('2d');
        g.imageSmoothingEnabled = false;
        g.clearRect(0, 0, w, h);
        const midY = h / 2;
        const baseX = pad, tipX = pad + a.length, halfW = a.width / 2;
        g.fillStyle = c.outline;
        this._tri(g, baseX - 1, midY, tipX + 1, halfW + 1);
        g.fillStyle = c.arrow;
        this._tri(g, baseX, midY, tipX, halfW);
        g.fillStyle = c.arrowLight;
        this._tri(g, baseX, midY - 1, tipX - 1, Math.max(1, halfW - 2));

        const discHalf = (CFG.discSize * pulse) / 2;
        const offset = (discHalf + a.gap + a.length / 2) * scale;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.translate(Math.round(ex), Math.round(ey));
        ctx.rotate(angle);
        ctx.translate(Math.round(offset), 0);
        const dw = w * scale, dh = h * scale;
        ctx.drawImage(buf, Math.round(-dw / 2), Math.round(-dh / 2), Math.round(dw), Math.round(dh));
        ctx.restore();
    }

    _tri(g, baseX, baseY, tipX, halfW) {
        g.beginPath();
        g.moveTo(tipX, baseY);
        g.lineTo(baseX, baseY - halfW);
        g.lineTo(baseX, baseY + halfW);
        g.closePath();
        g.fill();
    }

    _drawDistance(ctx, ex, ey, tiles, scale) {
        const c = CFG.colors;
        const label = `${tiles}`;
        const w = measureText(label);
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.translate(Math.round(ex - (w * scale) / 2), Math.round(ey + (CFG.discSize / 2 + 4) * scale));
        ctx.scale(scale, scale);
        drawText(ctx, label, 1, 1, c.textShadow);
        drawText(ctx, label, 0, 0, c.text);
        ctx.restore();
    }
}
