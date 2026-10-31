import { DEMO, INTERACTIVES, KEY_LIGHT } from '../config/DemoConfig.js';
import { TILE, LIGHT_PIXEL_SCALE } from '../config/GameConfig.js';
import { Physics } from '../core/Physics.js';

export class DemoProgress {
    constructor({ rooms, input, getPlayers, getSaw, assets = null, renderer = null, particleSystem = null, audio = null, hitStop = null }) {
        Object.assign(this, { rooms, input, getPlayers, getSaw, assets, renderer, particleSystem, audio, hitStop });
        this._beam = null;
        this._sweep = 0;
        this._masks = [];
        this.reset();
    }

    reset(initial = {}) {
        this.state = { dash: false, sawThrow: false, bossKey: false, ...initial };
        this.activated = new Set();
        this.cut = new Map();
        this.held = [false, false];
        // Celebração do pickup por id: { t, x, y } (steps). Some sozinha.
        this.celebrations = new Map();
        if (this.rooms.dungeon.document) this.rooms.dungeon.progress = this.state;
    }

    update(dt) {
        if (!this.rooms.dungeon.document) return;
        this._sweep += DEMO.key.shineSpeed;
        this._updateCelebrations();
        const room = this.rooms.current, rect = this.rooms.cellRect(), players = this.getPlayers();
        const pressed = players.map((_, i) => this.input.isDown(i === 0 ? 'e' : 'shiftright'));
        const tapped = pressed.map((v, i) => v && !this.held[i]);
        this.held = pressed;
        for (const o of room.cell.authored.interactives || []) {
            if (!INTERACTIVES[o.type] || INTERACTIVES[o.type].scripted) continue;
            const id = `${room.key}/${o.id}`;
            if (this.activated.has(id)) continue;
            const x = rect.x + (o.col + 0.5) * TILE, y = rect.y + (o.row + 0.5) * TILE;
            if (o.type === 'ropeKey') {
                const saw = this.getSaw();
                if (!this.cut.has(id) && saw?.thrown && Physics.distToSegment(x, y, saw.prevX, saw.prevY, saw.dropX, saw.dropY) < DEMO.ropeRadius) this.cut.set(id, 0);
                if (!this.cut.has(id)) continue;
                this.cut.set(id, this.cut.get(id) + dt);
                if (this.cut.get(id) < DEMO.keyDropSeconds) continue;
            }
            for (let i = 0; i < players.length; i++) {
                const p = players[i];
                if (p.falling || p.lives <= 0 || Math.hypot(p.x - x, p.y - y) > DEMO.interactionRadius) continue;
                const pickup = o.type === 'key' || o.type === 'ropeKey';
                if (!pickup && !tapped[i]) continue;
                this.activated.add(id);
                if (o.type === 'altarDash') this.state.dash = true;
                if (o.type === 'altarSaw') this.state.sawThrow = true;
                if (pickup) { this.state.bossKey = true; this._celebrateKey(id, x, y - DEMO.key.floatHeight); }
                if (o.type === 'lever') {
                    for (const cell of o.tiles || []) {
                        if (room.tiles.floor[cell.row]?.[cell.col] !== -1) continue;
                        room.tiles.floor[cell.row][cell.col] = 16;
                        const line = room.cell.authored.kinds[cell.row];
                        room.cell.authored.kinds[cell.row] = line.slice(0, cell.col) + 'f' + line.slice(cell.col + 1);
                    }
                }
                break;
            }
        }
    }

    // Pegar a chave: burst pixelado (faíscas + flash + poeira), tremor, hit stop, som e um zoom "você fez algo incrível".
    _celebrateKey(id, x, y) {
        const c = DEMO.key.pickup, ps = this.particleSystem;
        this.celebrations.set(id, { t: 0, x, y });
        this.renderer?.triggerZoomPunch?.(c.zoomPunch);
        this.renderer?.triggerShake?.(c.shake);
        this.hitStop?.(c.hitStop);
        this.audio?.play?.(c.sound, { rateMultiplier: c.soundRate });
        ps?.triggerSparkBurst?.(x, y, 34, c.sparks, c.sparksPower);
        ps?.triggerFlash?.(x, y, c.flash, 1);
        for (let n = 0; n < c.dust; n++) {
            const a = (n / c.dust) * Math.PI * 2;
            ps?.triggerDust?.(x + Math.cos(a) * 18, y + 18 + Math.sin(a) * 6, Math.cos(a), Math.sin(a) * 0.5, 1);
        }
    }

    _updateCelebrations() {
        const c = DEMO.key.pickup, ps = this.particleSystem;
        for (const [id, cel] of this.celebrations) {
            cel.t++;
            // Mantém o zoom "pinado" por alguns steps (o punch do renderer decai sozinho) e solta re-bursts de faísca.
            if (cel.t <= c.zoomHold) this.renderer?.triggerZoomPunch?.(c.zoomPunch * (1 - cel.t / c.zoomHold));
            if (cel.t % c.reburstEvery === 0 && cel.t < c.celebrateSteps) {
                const ry = cel.y - c.rise * (cel.t / c.celebrateSteps);
                ps?.triggerSparkBurst?.(cel.x, ry, 24, c.reburstSparks, 1.1);
            }
            if (cel.t >= c.celebrateSteps) this.celebrations.delete(id);
        }
    }

    // Interativos de chão (alavanca, altares). A chave vai por `drawables()` para ser ordenada por y com as entidades.
    draw(ctx) {
        if (!this.rooms.dungeon.document) return;
        const room = this.rooms.current, rect = this.rooms.cellRect();
        ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 22px sans-serif';
        for (const o of room.cell.authored.interactives || []) {
            const id = `${room.key}/${o.id}`, def = INTERACTIVES[o.type];
            if (!def || def.scripted) continue;
            if (['key', 'ropeKey'].includes(o.type)) continue;
            const active = this.activated.has(id);
            const x = rect.x + (o.col + 0.5) * TILE, y = rect.y + (o.row + 0.5) * TILE;
            ctx.fillStyle = '#322b42'; ctx.fillRect(x - 28, y + 10, 56, 16);
            ctx.fillStyle = '#655669'; ctx.fillRect(x - 24, y - 2, 48, 18);
            ctx.fillStyle = active ? '#53635a' : def.color;
            if (o.type === 'lever') {
                ctx.fillRect(x - 6, y - 24, 12, 28); ctx.fillRect(x + (active ? 0 : -18), y - 28, 18, 8);
            } else {
                ctx.fillRect(x - 18, y - 30, 36, 28); ctx.fillStyle = '#17131e'; ctx.fillText(active ? '✓' : def.symbol, x, y - 15);
            }
            if (o.type === 'lever' && active) for (const cell of o.tiles || []) {
                ctx.fillStyle = '#987247'; ctx.fillRect(rect.x + cell.col * TILE, rect.y + cell.row * TILE, TILE, TILE);
                ctx.strokeStyle = '#473326'; ctx.lineWidth = 3;
                for (let n = 0; n < 4; n++) ctx.strokeRect(rect.x + cell.col * TILE, rect.y + cell.row * TILE + n * 16, TILE, 16);
            }
        }
        ctx.restore();
    }

    // A chave entra na ordenação por y com as entidades (a serra cruza só a parte de baixo dela, não fica toda por cima).
    // Cada entrada: `feetSortY` = centro flutuante da chave; `y` = topo (desempate). O `draw` desenha sombra + sprite + reflexo.
    drawables() {
        if (!this.rooms.dungeon.document) return [];
        const room = this.rooms.current, rect = this.rooms.cellRect(), out = [];
        const K = DEMO.key, size = 16 * K.artScale;
        for (const o of room.cell.authored.interactives || []) {
            if (!['key', 'ropeKey'].includes(o.type)) continue;
            const id = `${room.key}/${o.id}`;
            const cel = this.celebrations.get(id);
            if (this.activated.has(id) && !cel) continue;   // já coletada e sem celebração: sumiu
            const groundY = rect.y + (o.row + 0.5) * TILE;
            const cy = this._keyBodyY(o, id, groundY);
            // Ordena pelo centro flutuante da chave (não pelo pé no chão): a dupla/serra, ao chegar na chave, fica na
            // mesma altura ou mais baixa, então a serra cobre só a parte de baixo da chave e o topo continua visível.
            out.push({ y: cy - size / 2, feetSortY: cy, draw: ctx => this._drawKeyAt(ctx, o, id, rect) });
        }
        return out;
    }

    // Centro vertical atual da chave flutuando (mesma conta do desenho), usado tanto para ordenar quanto para desenhar.
    _keyBodyY(o, id, groundY) {
        const K = DEMO.key, cel = this.celebrations.get(id);
        const drop = o.type === 'key' ? 1 : Math.min(1, (this.cut.get(id) || 0) / DEMO.keyDropSeconds);
        const bob = Math.sin((performance.now() / 1000) / (1 / 60) * K.bobSpeed) * K.bobAmp;
        const restY = groundY - K.floatHeight - DEMO.keyHeight * (1 - drop * drop);
        const p = cel ? Math.min(1, cel.t / K.pickup.celebrateSteps) : 0;
        const rise = cel ? K.pickup.rise * (p * (2 - p)) : 0;
        return restY - bob - rise;
    }

    // Pop-out do pickup: incha rápido com overshoot, depois encolhe esticando na vertical até sumir. { sx, sy, flash }.
    _popScale(cel) {
        if (!cel) return { sx: 1, sy: 1, flash: false };
        const c = DEMO.key.pickup, t = cel.t;
        if (t <= c.growSteps) {
            const u = t / c.growSteps, k = 1.70158, m = u - 1;
            const s = 1 + (c.peakScale - 1) * (1 + (k + 1) * m * m * m + k * m * m);   // easeOutBack
            return { sx: s, sy: s, flash: t >= c.growSteps - 1 };
        }
        const v = Math.min(1, (t - c.growSteps) / (c.celebrateSteps - c.growSteps));
        const s = c.peakScale * (1 - v * v);
        return { sx: s * (1 - c.stretch * v), sy: s * (1 + c.stretch * v), flash: t < c.growSteps + c.flashSteps };
    }

    // Chave coletável: sprite 16×16 em escala inteira (crespo), flutuando com sombra pixelada e o reflexo transversal da
    // serra largada. Os pixels dela não escurecem (máscara em `renderLights`) e ela emite uma luz leve.
    // Ao pegar faz pop-out (incha, pisca branco, encolhe esticando) sem girar.
    _drawKeyAt(ctx, o, id, rect) {
        const K = DEMO.key;
        const x = rect.x + (o.col + 0.5) * TILE, groundY = rect.y + (o.row + 0.5) * TILE;
        const cel = this.celebrations.get(id);

        const image = this.assets?.get(`demoKey${Math.floor(performance.now() / K.frameMs) % 4 + 1}`);
        const size = 16 * K.artScale;
        const hover = (Math.sin((performance.now() / 1000) / (1 / 60) * K.bobSpeed) + 1) / 2;
        const pop = this._popScale(cel);
        const cy = this._keyBodyY(o, id, groundY);

        // Corda do ropeKey ainda pendurado.
        if (o.type === 'ropeKey' && !this.cut.has(id)) {
            ctx.strokeStyle = '#ccb787'; ctx.lineWidth = 4; ctx.beginPath();
            ctx.moveTo(x, groundY - DEMO.keyHeight - 36); ctx.lineTo(x, cy); ctx.stroke();
        }

        // Sombra pixelada no chão (blocos do tamanho do pixel da chave), encolhe/clareia conforme a chave sobe.
        if (!cel) this._drawPixelShadow(ctx, x, groundY + K.shadow.offsetY, hover);

        if (!(image?.complete && image.naturalWidth)) {
            ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 22px sans-serif';
            ctx.fillStyle = INTERACTIVES[o.type].color; ctx.fillText('⚿', x, cy); ctx.restore();
            return;
        }

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.translate(Math.round(x), Math.round(cy));
        ctx.scale(pop.sx, pop.sy);
        const half = size / 2;
        ctx.drawImage(image, -half, -half, size, size);
        if (pop.flash) {
            // Quadro branco no pico do pop (silhueta do próprio sprite, pixelada).
            ctx.drawImage(this._silhouette(image), -half, -half, size, size);
        } else {
            const beam = this._keyBeam(image);
            if (beam) { ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(beam, -half, -half, size, size); }
        }
        // Retângulo exato do sprite na tela (já com zoom/tremor/pop): vira a máscara que tira a chave da escuridão.
        const m = ctx.getTransform();
        this._masks.push({ img: this._silhouette(image), x: m.e - half * m.a, y: m.f - half * m.d, w: size * m.a, h: size * m.d });
        ctx.restore();
    }

    _drawPixelShadow(ctx, x, y, hover) {
        const S = DEMO.key.shadow, P = DEMO.key.artScale;
        const rx = Math.max(2, Math.round(S.w * (1 - hover * 0.25))), ry = Math.max(1, S.h);
        ctx.save();
        ctx.globalAlpha = Math.max(0, S.baseAlpha - hover * S.hoverFade);
        ctx.fillStyle = '#000000';
        const ox = Math.round(x), oy = Math.round(y);
        for (let j = -ry; j < ry; j++) {
            const f = (j + 0.5) / ry, half = Math.round(rx * Math.sqrt(Math.max(0, 1 - f * f)));
            if (half > 0) ctx.fillRect(ox - half * P, oy + j * P, half * 2 * P, P);
        }
        ctx.restore();
    }

    // Silhueta branca 16×16 do quadro (máscara de luz e flash do pop), em cache por imagem.
    _silhouette(image) {
        this._silhouettes ??= new Map();
        let c = this._silhouettes.get(image);
        if (c) return c;
        c = document.createElement('canvas'); c.width = c.height = 16;
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = false;
        g.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight, 0, 0, 16, 16);
        g.globalCompositeOperation = 'source-in';
        g.fillStyle = '#ffffff';
        g.fillRect(0, 0, 16, 16);
        this._silhouettes.set(image, c);
        return c;
    }

    // Reflexo transversal igual ao `SawWeapon._buildBeam`: faixa diagonal estreita (stops 0.42/0.5/0.58) varrendo o sprite.
    _keyBeam(image) {
        const S = 16, K = DEMO.key;
        if (!this._beam) { this._beam = document.createElement('canvas'); this._beam.width = this._beam.height = S; }
        const bc = this._beam, bx = bc.getContext('2d');
        bx.imageSmoothingEnabled = false;
        bx.globalCompositeOperation = 'source-over';
        bx.clearRect(0, 0, S, S);
        const p = (Math.sin(this._sweep) + 1) / 2, travel = -S + p * (2.2 * S);
        const grad = bx.createLinearGradient(travel - S * 0.5, travel - S * 0.5, travel + S * 0.5, travel + S * 0.5);
        grad.addColorStop(0.0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.42, 'rgba(255,255,255,0)');
        grad.addColorStop(0.5, `rgba(255,255,255,${K.shineAlpha})`);
        grad.addColorStop(0.58, 'rgba(255,255,255,0)');
        grad.addColorStop(1.0, 'rgba(255,255,255,0)');
        bx.fillStyle = grad;
        bx.fillRect(0, 0, S, S);
        bx.globalCompositeOperation = 'destination-in';
        bx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight, 0, 0, S, S);
        bx.globalCompositeOperation = 'source-over';
        return bc;
    }

    // Depois do passe do mundo: máscara (sprite da chave fora da escuridão) + uma luz leve em volta de cada chave.
    renderLights(renderer, postProcessor) {
        if (!postProcessor) return;
        for (const m of this._masks) postProcessor.addMask(m.img, m.x, m.y, m.w, m.h);
        this._masks.length = 0;
        if (!this.rooms.dungeon.document) return;
        const room = this.rooms.current, rect = this.rooms.cellRect(), L = DEMO.key.light;
        const pulse = 1 + L.pulse * Math.sin((performance.now() / 1000) / (1 / 60) * DEMO.key.bobSpeed);
        for (const o of room.cell.authored.interactives || []) {
            if (!['key', 'ropeKey'].includes(o.type)) continue;
            const id = `${room.key}/${o.id}`;
            if (this.activated.has(id)) continue;
            const groundY = rect.y + (o.row + 0.5) * TILE;
            const s = renderer.worldToScreen(rect.x + (o.col + 0.5) * TILE, this._keyBodyY(o, id, groundY));
            const px = Math.max(2, Math.round((TILE / 16) * s.zoom * LIGHT_PIXEL_SCALE));
            postProcessor.addLight(s.x, s.y, L.radius * pulse * s.zoom, px, 1, KEY_LIGHT);
        }
    }
}
