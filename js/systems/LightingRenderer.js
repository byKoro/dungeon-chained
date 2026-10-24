import {
    TILE, LIGHT_PIXEL_SCALE, PLAYER_LIGHT_RADIUS, TORCHES, DOOR_LIGHT
} from '../config/GameConfig.js';

const BLADE_COLOR = "150, 196, 255";
const DROPPED_BLADE_PROFILE = {
    color: BLADE_COLOR,
    flickerBase: 1, flickerSine: 0.04, flickerNoise: 0.02,
    falloff: [
        { offset: 0.0, alpha: 0.95 },
        { offset: 0.3, alpha: 0.55 },
        { offset: 0.55, alpha: 0.28 },
        { offset: 0.78, alpha: 0.1 },
        { offset: 1.0, alpha: 0.0 }
    ]
};
const ACTIVE_BLADE_PROFILE = {
    color: BLADE_COLOR,
    flickerBase: 1, flickerSine: 0.05, flickerNoise: 0.02,
    falloff: [
        { offset: 0.0, alpha: 0.9 },
        { offset: 0.3, alpha: 0.5 },
        { offset: 0.55, alpha: 0.26 },
        { offset: 0.78, alpha: 0.1 },
        { offset: 1.0, alpha: 0.0 }
    ]
};

const DOOR_BEAM_PROFILE = {
    color: DOOR_LIGHT.color,
    flickerBase: 1, flickerSine: 0, flickerNoise: 0,
    falloff: [
        { offset: 0.0, alpha: 0.9 },
        { offset: 0.4, alpha: 0.5 },
        { offset: 0.7, alpha: 0.2 },
        { offset: 0.9, alpha: 0.06 },
        { offset: 1.0, alpha: 0.0 }
    ]
};

const HEART_PROFILE = {
    color: "255, 77, 109",
    flickerBase: 1, flickerSine: 0.04, flickerNoise: 0.02,
    falloff: [
        { offset: 0.0, alpha: 0.85 },
        { offset: 0.3, alpha: 0.45 },
        { offset: 0.6, alpha: 0.18 },
        { offset: 1.0, alpha: 0.0 }
    ]
};

const BUTTON_PROFILE = {
    color: "214, 120, 112",
    flickerBase: 1, flickerSine: 0, flickerNoise: 0,
    falloff: [
        { offset: 0.0, alpha: 0.7 },
        { offset: 0.35, alpha: 0.35 },
        { offset: 0.7, alpha: 0.1 },
        { offset: 1.0, alpha: 0.0 }
    ]
};

export class LightingRenderer {

    constructor({ renderer, postProcessor }) {
        this.renderer = renderer;
        this.postProcessor = postProcessor;
    }

    _lightPixel(zoom, scale = LIGHT_PIXEL_SCALE) {
        return Math.max(2, Math.round((TILE / 16) * zoom * scale));
    }

    render({ players, chain, sawPos, arenaBounds, tiles, rect, doors, doorHalf, open, doorFlashT, buttons = [], hearts = [] }) {
        this._renderButtonLights(buttons);
        this._renderHeartLights(hearts);
        this._renderPlayerLights(players);
        this._renderDroppedBladeLight(chain);
        this._renderActiveBladeLight(chain, sawPos);
        this._renderWallWash(arenaBounds);
        this._renderTorches(tiles, rect);
        this._renderDoorFlash({ doors, doorHalf, open, doorFlashT });
    }

    _renderButtonLights(buttons) {
        for (const b of buttons) {
            const glow = b.glow ?? 0, flash = b.flash ?? 0;
            const strength = Math.max(glow * 0.7, flash);
            if (strength < 0.02) continue;
            const s = this.renderer.worldToScreen(b.x, b.y);
            const px = this._lightPixel(s.zoom);
            const radius = (55 + glow * 15 + flash * 55) * s.zoom;

            this.postProcessor.addLight(s.x, s.y, radius, px, 0.6, {
                ...BUTTON_PROFILE,
                falloff: BUTTON_PROFILE.falloff.map(f => ({ ...f, alpha: f.alpha * strength }))
            });
        }
    }

    _renderHeartLights(hearts) {
        for (const h of hearts) {
            const info = h.lightInfo?.();
            if (!info) continue;
            const s = this.renderer.worldToScreen(info.x, info.y);
            const px = this._lightPixel(s.zoom);
            const breathe = 0.85 + info.hover * 0.15;
            this.postProcessor.addLight(s.x, s.y, 120 * breathe * s.zoom, px, 1, HEART_PROFILE);
        }
    }

    _renderPlayerLights(players) {
        for (const p of players) {
            const s = this.renderer.worldToScreen(p.x, p.y);
            const pixel = this._lightPixel(s.zoom);
            this.postProcessor.addLight(s.x, s.y, PLAYER_LIGHT_RADIUS * s.zoom, pixel);
        }
    }

    _renderDroppedBladeLight(chain) {
        const dropLight = chain.getDroppedLight?.();
        if (!dropLight) return;
        const s = this.renderer.worldToScreen(dropLight.x, dropLight.y);
        const px = this._lightPixel(s.zoom);
        const breathe = 0.85 + dropLight.hover * 0.15;
        this.postProcessor.addLight(s.x, s.y, 150 * breathe * s.zoom, px, 1, DROPPED_BLADE_PROFILE);
    }

    _renderActiveBladeLight(chain, sawPos) {
        if (!chain.isConnected || !sawPos) return;
        const weapon = chain.weapon;
        if (!weapon) return;
        const s = this.renderer.worldToScreen(sawPos.x, sawPos.y);
        const px = this._lightPixel(s.zoom);
        const spin = weapon.spinSpeed ?? 0;
        const bladeRadius = 60 + spin * 18;
        this.postProcessor.addLight(s.x, s.y, bladeRadius * s.zoom, px, 1, ACTIVE_BLADE_PROFILE);
    }

    _renderWallWash(arenaBounds) {
        if (!(TORCHES.enabled && TORCHES.light.wash?.enabled && arenaBounds)) return;
        const wash = TORCHES.light.wash;
        const wProfile = { ...TORCHES.light, falloff: wash.falloff };
        const b = arenaBounds;
        const tl0 = this.renderer.worldToScreen(b.minX, b.minY);
        const br0 = this.renderer.worldToScreen(b.maxX, b.maxY);
        const d = wash.depth * tl0.zoom;
        const left = tl0.x, top = tl0.y, right = br0.x, bottom = br0.y;
        const fullW = right - left, fullH = bottom - top;

        this.postProcessor.addWash({ x: left, y: top, w: fullW, h: d }, "N", wProfile);
        this.postProcessor.addWash({ x: left, y: bottom - d, w: fullW, h: d }, "S", wProfile);
        this.postProcessor.addWash({ x: left, y: top, w: d, h: fullH }, "W", wProfile);
        this.postProcessor.addWash({ x: right - d, y: top, w: d, h: fullH }, "E", wProfile);
    }

    _renderTorches(tiles, rect) {
        if (!(TORCHES.enabled && tiles.torches?.length)) return;
        const tl = TORCHES.light;
        const area = tl.area;
        for (const t of tiles.torches) {

            let wx = rect.x + t.col * TILE + TILE / 2;
            let wy = rect.y + t.row * TILE + TILE / 2;

            let areaDx = 0, areaDy = 0;
            if (t.side === "N") { wy += tl.offsetY; areaDy = area.pushIn; }
            else if (t.side === "S") { wy -= tl.offsetY; areaDy = -area.pushIn; }
            else if (t.side === "W") { wx += tl.offsetX; areaDx = area.pushIn; }
            else if (t.side === "E") { wx -= tl.offsetX; areaDx = -area.pushIn; }

            const s = this.renderer.worldToScreen(wx, wy);
            const px = this._lightPixel(s.zoom, tl.pixelScale);

            const glowProfile = { ...tl, falloff: tl.glow.falloff };
            this.postProcessor.addLight(s.x, s.y, tl.glow.radius * s.zoom, px, tl.glow.flatten, glowProfile);

            const areaProfile = { ...tl, falloff: area.falloff };
            const ac = this.renderer.worldToScreen(wx + areaDx, wy + areaDy);
            this.postProcessor.addLight(ac.x, ac.y, area.radius * s.zoom, px, area.flatten, areaProfile);
        }
    }

    _renderDoorFlash({ doors, doorHalf, open, doorFlashT }) {
        if (!(DOOR_LIGHT.enabled && doorFlashT > 0 && open && doors?.length)) return;
        const dl = DOOR_LIGHT;
        const prog = 1 - doorFlashT / dl.flashDuration;
        const fade = (1 - prog) ** dl.fadeExponent;
        const pulse = 1 + Math.sin(prog * dl.flashDuration * dl.pulseSpeed) * dl.pulseDepth;
        const alphaScale = Math.max(0, fade * pulse);

        for (const door of doors) {

            let dx = 0, dy = 0;
            if (door.dir === "N") dy = 1;
            else if (door.dir === "S") dy = -1;
            else if (door.dir === "W") dx = 1;
            else if (door.dir === "E") dx = -1;

            const apexBehind = doorHalf / Math.tan(dl.spread);
            const wx = door.x - dx * apexBehind;
            const wy = door.y - dy * apexBehind;

            const s = this.renderer.worldToScreen(wx, wy);
            const px = this._lightPixel(s.zoom, dl.pixelScale);

            const beamLen = (dl.length + apexBehind) * s.zoom;

            const startDist = apexBehind * s.zoom;
            this.postProcessor.addSpotLight(
                s.x, s.y, dx, dy, beamLen, dl.spread, px, DOOR_BEAM_PROFILE, startDist, alphaScale, dl.startFade
            );
        }
    }
}
