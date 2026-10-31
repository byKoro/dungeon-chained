import { SpikeTrap } from '../entities/SpikeTrap.js';
import { ArrowTrap } from '../entities/ArrowTrap.js';
import { PressureButton } from '../entities/PressureButton.js';
import { HAZARDS, TILE } from '../config/GameConfig.js';
import { arrowFireDir, arrowMountOffset, spikeRowPhase } from '../rooms/HazardLayout.js';

export class ChallengeCorridor {

    constructor(layout, bounds, doors, assets) {
        this.layout = layout;
        this.bounds = bounds;
        this.name = layout.name;

        this.vertical = !!(doors && (doors.N || doors.S));
        if (doors && (doors.E || doors.W) && !(doors.N || doors.S)) this.vertical = false;

        this.spikes = [];
        this.arrowTraps = [];
        this.arrows = [];
        this.buttons = [];

        this.solved = false;
        this.holdTimer = 0;

        this._pad = 36;

        this._build(assets);
    }

    _tileToWorld(col, row) {
        return {
            x: this.bounds.minX + (col - 1 + 0.5) * TILE,
            y: this.bounds.minY + (row - 1 + 0.5) * TILE
        };
    }

    _elemWorld(el, u = el.u, v = el.v) {
        if (el.col !== undefined && el.row !== undefined) {
            return this._tileToWorld(el.col, el.row);
        }
        return this._toWorld(u, v);
    }

    _toWorld(u, v) {
        const b = this.bounds;
        const pad = this._pad;
        if (this.vertical) {
            const x = b.minX + pad + v * (b.maxX - b.minX - pad * 2);
            const y = b.minY + pad + u * (b.maxY - b.minY - pad * 2);
            return { x, y };
        } else {
            const x = b.minX + pad + u * (b.maxX - b.minX - pad * 2);
            const y = b.minY + pad + v * (b.maxY - b.minY - pad * 2);
            return { x, y };
        }
    }

    _fireDir(code) {
        if (this.vertical) {
            switch (code) {
                case "across+": return { x: 1, y: 0 };
                case "across-": return { x: -1, y: 0 };
                case "along+":  return { x: 0, y: 1 };
                case "along-":  return { x: 0, y: -1 };
            }
        } else {
            switch (code) {
                case "across+": return { x: 0, y: 1 };
                case "across-": return { x: 0, y: -1 };
                case "along+":  return { x: 1, y: 0 };
                case "along-":  return { x: -1, y: 0 };
            }
        }
        return { x: 1, y: 0 };
    }

    _build(assets) {
        const peaks = assets && assets.peaks ? assets.peaks : null;
        const arrowTrapSprites = assets && assets.arrowTrap ? assets.arrowTrap : null;
        const arrowSprite = assets && assets.arrow ? assets.arrow : null;
        const buttonSprite = assets && assets.button ? assets.button : null;

        for (const el of this.layout.elements) {
            const byTile = el.col !== undefined && el.row !== undefined;
            switch (el.type) {
                case "spike": {
                    const p = this._elemWorld(el);
                    this.spikes.push(new SpikeTrap(p.x, p.y, peaks, { phaseOffset: el.phase || 0, durations: el.durations, timing: el.timing, delay: el.delay }));
                    break;
                }
                case "spikeRow": {
                    const count = el.count || 4;

                    const dir = el.dir || "left";
                    const vertical = dir === "up" || dir === "down";

                    for (let i = 0; i < count; i++) {
                        const phase = spikeRowPhase({ ...el, dir }, i);
                        let p;
                        if (byTile) {

                            p = vertical ? this._tileToWorld(el.col, el.row + i) : this._tileToWorld(el.col + i, el.row);
                        } else {

                            const v = (i + 0.5) / count;
                            p = this._toWorld(el.u, v);
                        }
                        this.spikes.push(new SpikeTrap(p.x, p.y, peaks, { phaseOffset: phase, durations: el.durations, timing: el.timing, delay: el.delay }));
                    }
                    break;
                }
                case "arrow": {
                    const p = this._elemWorld(el);
                    const inferredSide = el.side || (el.row === 0 ? "top"
                        : el.row === Math.round((this.bounds.maxY - this.bounds.minY) / TILE) + 1 ? "bottom"
                            : el.col === 0 ? "left"
                                : el.col === Math.round((this.bounds.maxX - this.bounds.minX) / TILE) + 1 ? "right" : null);

                    const isCustomLateralWall = byTile && el.col > 0 && el.col < Math.round((this.bounds.maxX - this.bounds.minX) / TILE) + 1 &&
                        el.row > 0 && el.row < Math.round((this.bounds.maxY - this.bounds.minY) / TILE) + 1 &&
                        (inferredSide === "left" || inferredSide === "right");
                    const dir = arrowFireDir(inferredSide, isCustomLateralWall) || this._fireDir(el.dir || "across+");

                    const mount = arrowMountOffset(dir);
                    this.arrowTraps.push(new ArrowTrap(p.x + mount.x, p.y + mount.y, dir, { phaseOffset: el.phase || 0, sprites: arrowTrapSprites, arrowSprite }));
                    break;
                }
                case "button": {
                    const p = this._elemWorld(el);
                    this.buttons.push(new PressureButton(p.x, p.y, { sprite: buttonSprite }));
                    break;
                }
            }
        }
    }

    get locked() {
        return !this.solved;
    }

    update(players, deltaSeconds = 1 / 60) {

        for (const s of this.spikes) s.update(players, deltaSeconds);

        const onFire = (arrow) => this.arrows.push(arrow);
        for (const t of this.arrowTraps) t.update(onFire, deltaSeconds);
        for (let i = this.arrows.length - 1; i >= 0; i--) {
            this.arrows[i].update(players, this.bounds, deltaSeconds);
            if (this.arrows[i].dead) this.arrows.splice(i, 1);
        }

        for (const b of this.buttons) b.update(players);
        if (!this.solved) {
            const allPressed = this.buttons.length >= 2 && this.buttons.every(b => b.pressed);
            if (allPressed) {
                this.holdTimer++;
                if (this.holdTimer >= HAZARDS.challenge.holdFrames) this.solved = true;
            } else {
                this.holdTimer = 0;
            }
        }
    }

    drawFloorLayer(ctx) {
        for (const s of this.spikes) s.draw(ctx);
    }

    drawButtons(ctx) {
        for (const b of this.buttons) b.draw(ctx);
    }

    buttonOccluders(entities) {
        return this.buttons.map(b => ({
            y: b.sortY,
            draw: (ctx) => b.drawOcclusion(ctx, entities)
        }));
    }

    coversButton(x, y) {
        for (const b of this.buttons) if (b.covers(x, y)) return true;
        return false;
    }

    drawWallLayer(ctx) {
        for (const t of this.arrowTraps) t.draw(ctx);
    }

    drawAirLayer(ctx) {
        for (const a of this.arrows) a.draw(ctx);
    }
}
