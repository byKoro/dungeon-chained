import { DEMO } from '../config/DemoConfig.js';
import { TILE, ROOM_COLS, ROOM_ROWS, CAM_MARGIN } from '../config/GameConfig.js';

export class DemoCamera {
    constructor({ canvas, renderer, getPlayers, getRect, mode = DEMO.cameraMode }) {
        Object.assign(this, { canvas, renderer, getPlayers, getRect, mode });
    }

    referenceZoom() {
        return DEMO.cameraZoom * Math.min(this.canvas.width / (ROOM_COLS * TILE + CAM_MARGIN * 2), this.canvas.height / (ROOM_ROWS * TILE + CAM_MARGIN * 2));
    }

    update() {
        const [p1, p2] = this.getPlayers();
        // Cinemáticas: `focus = { x, y, zoom }` (zoom multiplica o de referência) substitui o alvo dos jogadores.
        if (this.focus) {
            this.renderer.updateCamera({ x: this.focus.x, y: this.focus.y, zoom: this.referenceZoom() * this.focus.zoom });
            return;
        }
        let zoom = this.referenceZoom();
        if (this.mode === 'zoom') zoom = Math.min(zoom,
            this.canvas.width / (Math.abs(p1.x - p2.x) + DEMO.cameraMargin * 2),
            this.canvas.height / (Math.abs(p1.y - p2.y) + DEMO.cameraMargin * 2));
        // Sem limite na borda do mapa: a câmera fica sempre centrada na dupla.
        this.renderer.updateCamera({ x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2, zoom });
    }

    drawIndicators(ctx) {
        if (this.mode !== 'fixed') return;
        this.getPlayers().forEach((p, i) => {
            const at = this.renderer.worldToScreen(p.x, p.y);
            if (at.x >= 20 && at.x < this.canvas.width - 20 && at.y >= 20 && at.y < this.canvas.height - 20) return;
            ctx.save(); ctx.fillStyle = i ? '#6bb4db' : '#ffd166'; ctx.font = 'bold 18px sans-serif';
            ctx.fillText(`P${i + 1}`, Math.max(20, Math.min(this.canvas.width - 42, at.x)), Math.max(30, Math.min(this.canvas.height - 30, at.y))); ctx.restore();
        });
    }

    renderSplit(drawView) {
        const renderer = this.renderer, ctx = renderer.ctx, players = this.getPlayers(), r = this.getRect();
        const saved = { x: renderer.camX, y: renderer.camY, zoom: renderer.zoom };
        const width = this.canvas.width / 2, zoom = this.referenceZoom();
        for (let i = 0; i < 2; i++) {
            ctx.save(); ctx.beginPath(); ctx.rect(i * width, 0, width, this.canvas.height); ctx.clip();
            renderer.viewport = { x: i * width, y: 0, w: width, h: this.canvas.height };
            const clamp = (v, start, length, half) => length < half * 2 ? start + length / 2 : Math.max(start + half, Math.min(start + length - half, v));
            renderer.camX = clamp(players[i].x, r.x, r.w, width / zoom / 2);
            renderer.camY = clamp(players[i].y, r.y, r.h, this.canvas.height / zoom / 2);
            renderer.zoom = zoom;
            drawView(); ctx.restore();
        }
        renderer.viewport = null; renderer.camX = saved.x; renderer.camY = saved.y; renderer.zoom = saved.zoom;
        ctx.fillStyle = '#17131e'; ctx.fillRect(width - 2, 0, 4, this.canvas.height);
    }
}
