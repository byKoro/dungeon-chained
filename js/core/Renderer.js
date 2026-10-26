import { holeTileFor, TORCHES, EMPTY_FLOOR_TILE, EMPTY_FLOOR_COLOR } from '../config/GameConfig.js';

export class Renderer {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.assets = null;
        this.zoom = 1.50;
        this.screenShake = 0;

        this.tileWorldSize = 64;

        this.camX = canvas.width / 2;
        this.camY = canvas.height / 2;

        this.swayX = 0; this.swayY = 0;
        this._swayVX = 0; this._swayVY = 0;

        this._zoomPunch = 0;

        this.introZoomFactor = 1;
    }

    setIntroZoomFactor(f) {
        this.introZoomFactor = Math.max(0.1, f || 1);
    }

    triggerZoomPunch(amount = 0.08) {
        if (Math.abs(amount) > Math.abs(this._zoomPunch)) this._zoomPunch = amount;
    }

    resetSway() {
        this.swayX = 0; this.swayY = 0;
        this._swayVX = 0; this._swayVY = 0;
    }

    applyDroneSway(targetX, targetY, stiffness, damping, dt) {
        const ax = stiffness * (targetX - this.swayX) - damping * this._swayVX;
        const ay = stiffness * (targetY - this.swayY) - damping * this._swayVY;
        this._swayVX += ax * dt;
        this._swayVY += ay * dt;
        this.swayX += this._swayVX * dt;
        this.swayY += this._swayVY * dt;
    }

    setTileWorldSize(px) {
        if (px > 0) this.tileWorldSize = px;
    }

    setAssets(assets) {
        this.assets = assets;
    }

    _quantizeZoom(zoom) {
        const t = this.tileWorldSize;
        if (!t) return zoom;

        const tilePxOnScreen = Math.max(1, Math.round(t * zoom));
        return tilePxOnScreen / t;
    }

    triggerShake(amount = 14) {
        this.screenShake = Math.max(this.screenShake, amount);
    }

    updateCamera(t) {

        const targetX = t.x + this.swayX;
        const targetY = t.y + this.swayY;
        this.camX += (targetX - this.camX) * 0.12;
        this.camY += (targetY - this.camY) * 0.12;
        if (t.zoom) {

            const targetZoom = t.zoom * this.introZoomFactor;
            this.zoom += (targetZoom - this.zoom) * 0.08;

            if (Math.abs(targetZoom - this.zoom) < 0.001) this.zoom = targetZoom;
        }

        if (t.bounds) {
            const halfW = ((this.viewport ? this.viewport.x + this.viewport.w / 2 : this.canvas.width / 2)) / this.zoom;
            const halfH = ((this.viewport ? this.viewport.y + this.viewport.h / 2 : this.canvas.height / 2)) / this.zoom;
            const b = t.bounds;
            if (b.maxX - b.minX > halfW * 2) {
                this.camX = Math.max(b.minX + halfW, Math.min(b.maxX - halfW, this.camX));
            } else {
                this.camX = (b.minX + b.maxX) / 2;
            }
            if (b.maxY - b.minY > halfH * 2) {
                this.camY = Math.max(b.minY + halfH, Math.min(b.maxY - halfH, this.camY));
            } else {
                this.camY = (b.minY + b.maxY) / 2;
            }
        }
    }

    screenToWorld(sx, sy) {
        return {
            x: this.camX + (sx - (this.viewport ? this.viewport.x + this.viewport.w / 2 : this.canvas.width / 2)) / this.zoom,
            y: this.camY + (sy - (this.viewport ? this.viewport.y + this.viewport.h / 2 : this.canvas.height / 2)) / this.zoom
        };
    }

    worldToScreen(wx, wy) {
        const z = this._quantizeZoom(this.zoom);
        const tx = Math.round((this.viewport ? this.viewport.x + this.viewport.w / 2 : this.canvas.width / 2) - this.camX * z);
        const ty = Math.round((this.viewport ? this.viewport.y + this.viewport.h / 2 : this.canvas.height / 2) - this.camY * z);
        return { x: wx * z + tx, y: wy * z + ty, zoom: z };
    }

    beginFrame() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();

        let shakeX = 0, shakeY = 0;
        if (this.screenShake > 0) {
            shakeX = (Math.random() - 0.5) * this.screenShake;
            shakeY = (Math.random() - 0.5) * this.screenShake;
            this.screenShake *= 0.88;
            if (this.screenShake < 0.3) this.screenShake = 0;
        }

        if (Math.abs(this._zoomPunch) > 0.0005) {
            this._zoomPunch *= 0.82;
            if (Math.abs(this._zoomPunch) < 0.0005) this._zoomPunch = 0;
        }
        const punchedZoom = this.zoom * (1 + this._zoomPunch);
        const renderZoom = this._quantizeZoom(punchedZoom);
        const tx = Math.round((this.viewport ? this.viewport.x + this.viewport.w / 2 : this.canvas.width / 2) - this.camX * renderZoom + shakeX);
        const ty = Math.round((this.viewport ? this.viewport.y + this.viewport.h / 2 : this.canvas.height / 2) - this.camY * renderZoom + shakeY);
        this.ctx.setTransform(renderZoom, 0, 0, renderZoom, tx, ty);
    }

    endFrame() {
        this.ctx.restore();
    }

    beginOverlayWorld() {
        const z = this._quantizeZoom(this.zoom);
        const tx = Math.round((this.viewport ? this.viewport.x + this.viewport.w / 2 : this.canvas.width / 2) - this.camX * z);
        const ty = Math.round((this.viewport ? this.viewport.y + this.viewport.h / 2 : this.canvas.height / 2) - this.camY * z);
        this.ctx.save();
        this.ctx.setTransform(z, 0, 0, z, tx, ty);
    }

    endOverlayWorld() {
        this.ctx.restore();
    }

    drawRoundShadow(x, y, baseRadius, bounceFactor = 0) {
        this.ctx.save();
        const currentR = Math.max(6, baseRadius - bounceFactor * 1.5);
        this.ctx.translate(x, y + 17);

        const grad = this.ctx.createRadialGradient(0, 0, 1, 0, 0, currentR);
        grad.addColorStop(0, "rgba(0, 0, 0, 0.65)");
        grad.addColorStop(0.6, "rgba(0, 0, 0, 0.35)");
        grad.addColorStop(1, "rgba(0, 0, 0, 0)");

        this.ctx.beginPath();
        this.ctx.arc(0, 0, currentR, 0, Math.PI * 2);
        this.ctx.fillStyle = grad;
        this.ctx.fill();
        this.ctx.restore();
    }

    setTileset(tileset) {
        this.tileset = tileset;
    }

    drawBackground(tileIndex, tile) {
        if (!this.tileset || !this.tileset.ready) return;

        const tl = this.screenToWorld(-tile, -tile);
        const br = this.screenToWorld(this.canvas.width + tile, this.canvas.height + tile);
        const x0 = Math.floor(tl.x / tile) * tile;
        const y0 = Math.floor(tl.y / tile) * tile;
        for (let y = y0; y < br.y; y += tile) {
            for (let x = x0; x < br.x; x += tile) {
                this.tileset.draw(this.ctx, tileIndex, x, y, tile, tile);
            }
        }
    }

    drawRoom(rect, bounds, tiles, tile, doorsOpen, doors = [], doorHalf = 48) {
        const c = this.ctx;

        if (!this.tileset || !this.tileset.ready || !tiles) {
            c.fillStyle = "#15141f";
            c.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
            c.fillStyle = "#0a0910";
            c.fillRect(rect.x, rect.y, rect.w, bounds.minY - rect.y);
            c.fillRect(rect.x, bounds.maxY, rect.w, rect.y + rect.h - bounds.maxY);
            c.fillRect(rect.x, rect.y, bounds.minX - rect.x, rect.h);
            c.fillRect(bounds.maxX, rect.y, rect.x + rect.w - bounds.maxX, rect.h);
            return;
        }

        for (let r = 0; r < tiles.rows; r++) {
            for (let col = 0; col < tiles.cols; col++) {
                let idx = tiles.floor[r][col];
                const dx = rect.x + col * tile;
                const dy = rect.y + r * tile;
                if (idx === EMPTY_FLOOR_TILE) {
                    c.fillStyle = EMPTY_FLOOR_COLOR;
                    c.fillRect(dx, dy, tile, tile);
                    continue;
                }
                if (idx < 0) idx = holeTileFor(tiles.floor, col, r);
                this.tileset.draw(c, idx, dx, dy, tile, tile);
            }
        }

        for (const wall of (tiles.walls || [])) {
            this.tileset.draw(c, wall.tile, rect.x + wall.col * tile, rect.y + wall.row * tile, tile, tile);
        }

        for (const p of tiles.props) {
            if (p.type) continue;
            const dx = rect.x + p.col * tile;
            const dy = rect.y + p.row * tile;
            if (p.flip) {

                c.save();
                c.translate(dx + tile, dy);
                c.scale(-1, 1);
                this.tileset.draw(c, p.index, 0, 0, tile, tile);
                c.restore();
            } else {
                this.tileset.draw(c, p.index, dx, dy, tile, tile);
            }
        }

        if (tiles.torches) {
            const torchSprites = this.assets && this.assets.torchSprites;
            const frame = Math.floor(performance.now() / 160) % 4;
            for (const t of tiles.torches) {

                const behindLowWall = t.side === "S" && (tiles.walls || []).some(w =>
                    w.col === t.col && w.row === t.row - 1 &&
                    (w.side === "bottom" || (w.tile >= 41 && w.tile <= 44))
                );
                if (behindLowWall) continue;
                const dx = rect.x + t.col * tile;
                const dy = rect.y + t.row * tile;
                const type = t.type || "torch";
                const sprites = type === "candlestick_1" ? torchSprites?.candlestick1
                    : type === "candlestick_2" ? torchSprites?.candlestick2
                        : (t.side === "W" || t.side === "E") ? torchSprites?.sideTorch
                            : torchSprites?.torch;
                const img = sprites && sprites[frame];
                const flip = type === "torch" && t.side === "E";
                if (img && img.complete && img.naturalWidth > 0 && flip) {
                    c.save();
                    c.translate(dx + tile, dy);
                    c.scale(-1, 1);
                    c.drawImage(img, 0, 0, tile, tile);
                    c.restore();
                } else if (img && img.complete && img.naturalWidth > 0) {
                    c.drawImage(img, dx, dy, tile, tile);
                } else {
                    const idx = (t.side === "N" || t.side === "S") ? TORCHES.index : TORCHES.sideIndex;
                    if (flip) {
                        c.save();
                        c.translate(dx + tile, dy);
                        c.scale(-1, 1);
                        this.tileset.draw(c, idx, 0, 0, tile, tile);
                        c.restore();
                    } else {
                        this.tileset.draw(c, idx, dx, dy, tile, tile);
                    }
                }
            }
        }

        if (!doorsOpen && tiles.doorCells) {

            for (const d of tiles.doorCells) {
                const dx = rect.x + d.col * tile;
                const dy = rect.y + d.row * tile;
                this.tileset.draw(c, d.index, dx, dy, tile, tile);
            }
        }

    }

    drawDoorGradients(doors, doorHalf, tile, stubTiles = 0) {
        this._drawDoorGradients(doors, doorHalf, tile, stubTiles);
    }

    drawDoorStubs(rect, doors, tile, doorHalf, stubTiles = 2, floorIdx = 17) {
        if (!this.tileset || !this.tileset.ready) return;
        const ctx = this.ctx;
        for (const d of doors) {
            if (d.blocked) continue;
            doorHalf = d.halfWidth ?? doorHalf;
            const across = Math.round((doorHalf * 2) / tile);
            for (let s = 1; s <= stubTiles; s++) {
                for (let k = 0; k < across; k++) {
                    let dx, dy;
                    if (d.dir === "N") {
                        dx = d.x - doorHalf + k * tile;
                        dy = d.y - s * tile;
                    } else if (d.dir === "S") {
                        dx = d.x - doorHalf + k * tile;
                        dy = d.y + (s - 1) * tile;
                    } else if (d.dir === "W") {
                        dx = d.x - s * tile;
                        dy = d.y - doorHalf + k * tile;
                    } else {
                        dx = d.x + (s - 1) * tile;
                        dy = d.y - doorHalf + k * tile;
                    }
                    this.tileset.draw(ctx, floorIdx, dx, dy, tile, tile);
                }
            }
        }
    }

    drawFrontWall(rect, tiles, tile, doorsOpen, doors = [], doorHalf = 64, stubTiles = 0) {
        if (!this.tileset || !this.tileset.ready || !tiles) return;
        const r = tiles.rows - 1;

        const southDoorCols = new Set();
        if (doorsOpen && tiles.doorCells) {
            for (const d of tiles.doorCells) {
                if (d.row === r) southDoorCols.add(d.col);
            }
        }

        for (let col = 0; col < tiles.cols; col++) {
            if (southDoorCols.has(col)) continue;
            let idx = tiles.floor[r][col];
            if (idx < 0) idx = holeTileFor(tiles.floor, col, r);
            const dx = rect.x + col * tile;
            const dy = rect.y + r * tile;
            this.tileset.draw(this.ctx, idx, dx, dy, tile, tile);
        }

        if (!doorsOpen && tiles.doorCells) {

            for (const d of tiles.doorCells) {
                if (d.row === r) {
                    this.tileset.draw(this.ctx, d.index, rect.x + d.col * tile, rect.y + d.row * tile, tile, tile);
                }
            }
        } else if (doorsOpen) {

            const south = doors.find(d => d.dir === "S");
            if (south) this._drawDoorGradients([south], doorHalf, tile, stubTiles);
        }
    }

    _drawDoorGradients(doors, doorHalf, wallDepth, stubTiles = 0) {
        const c = this.ctx;

        const dark = "rgba(37, 19, 26, 1)";
        const clear = "rgba(37, 19, 26, 0)";

        const depth = wallDepth * 2.5 + stubTiles * wallDepth;
        for (const d of doors) {
            if (d.blocked) continue;
            doorHalf = d.halfWidth ?? doorHalf;
            c.save();
            let grad;
            if (d.dir === "N") {
                grad = c.createLinearGradient(0, d.y, 0, d.y - depth);
                grad.addColorStop(0, clear);
                grad.addColorStop(0.35, dark);
                grad.addColorStop(1, dark);
                c.fillStyle = grad;
                c.fillRect(d.x - doorHalf, d.y - depth, doorHalf * 2, depth);
            } else if (d.dir === "S") {
                grad = c.createLinearGradient(0, d.y, 0, d.y + depth);
                grad.addColorStop(0, clear);
                grad.addColorStop(0.35, dark);
                grad.addColorStop(1, dark);
                c.fillStyle = grad;
                c.fillRect(d.x - doorHalf, d.y, doorHalf * 2, depth);
            } else if (d.dir === "W") {
                grad = c.createLinearGradient(d.x, 0, d.x - depth, 0);
                grad.addColorStop(0, clear);
                grad.addColorStop(0.35, dark);
                grad.addColorStop(1, dark);
                c.fillStyle = grad;
                c.fillRect(d.x - depth, d.y - doorHalf, depth, doorHalf * 2);
            } else if (d.dir === "E") {
                grad = c.createLinearGradient(d.x, 0, d.x + depth, 0);
                grad.addColorStop(0, clear);
                grad.addColorStop(0.35, dark);
                grad.addColorStop(1, dark);
                c.fillStyle = grad;
                c.fillRect(d.x, d.y - doorHalf, depth, doorHalf * 2);
            }
            c.restore();
        }
    }
}
