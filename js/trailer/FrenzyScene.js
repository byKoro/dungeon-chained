/**
 * FrenzyScene — segunda parte do trailer: câmera BEM PERTO dos dois
 * jogadores em FRENESI, girando a serra no meio de uma horda de demônios e
 * blood monsters, com o pipeline de gore do jogo (CombatSystem, sangue no
 * chão, gibs, ScreenGore).
 *
 * Reaproveita do TrailerScene (host): renderer, postProcessor, assets, os
 * jogadores, a serra e o montador de luzes. Tem sala, sangue e inimigos
 * próprios. A simulação roda em PASSOS FIXOS de 60 Hz (como o jogo), com
 * câmera lenta pontual em alguns abates.
 */
import { RoomTiles } from '../core/RoomTiles.js';
import { Physics } from '../core/Physics.js';
import { BloodCanvas } from '../particles/BloodCanvas.js';
import { ParticleSystem } from '../particles/ParticleSystem.js';
import { CombatSystem } from '../combat/CombatSystem.js';
import { SpawnSystem } from '../systems/SpawnSystem.js';
import { ScreenGore } from '../systems/ScreenGore.js';
import {
    TILE, ROOM_COLS, ROOM_ROWS, BACKGROUND_TILE, DOOR_STUB_TILES,
    BLOOD_COLORS, BLOOD_PIXEL, MAX_ACTIVE_GIBS
} from '../config/GameConfig.js';

const HORDE_SIZE = 26;        // inimigos vivos mantidos na arena
const SLOWMO_EVERY = 6;       // a cada N abates, um instante de câmera lenta
const CAM_ZOOM = 1.9;         // multiplicador sobre o zoom-fit (bem perto)
const FLAME_COLOR = [255, 110, 70];

const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

export class FrenzyScene {
    constructor(host) {
        this.host = host;
        const { assets, renderer } = host;

        // Arena com as 4 portas abertas (inimigos "entram" de todo lado).
        this.doors = { N: true, S: true, E: true, W: true };
        this.tiles = new RoomTiles(ROOM_COLS, ROOM_ROWS, this.doors, 7, true);
        this.rect = { x: 0, y: 0, w: ROOM_COLS * TILE, h: ROOM_ROWS * TILE };
        this.bounds = {
            minX: TILE, minY: TILE,
            maxX: this.rect.w - TILE, maxY: this.rect.h - TILE
        };
        this.doorHalf = TILE;
        const midC = (ROOM_COLS / 2) | 0, midR = (ROOM_ROWS / 2) | 0;
        const b = this.bounds;
        this.doorList = [
            { dir: 'N', x: midC * TILE, y: b.minY },
            { dir: 'S', x: midC * TILE, y: b.maxY },
            { dir: 'E', x: b.maxX, y: midR * TILE },
            { dir: 'W', x: b.minX, y: midR * TILE },
        ];
        this._decorate();

        this.center = { x: this.rect.w / 2, y: this.rect.h / 2 };

        // Pipeline de gore do jogo.
        this.bloodCanvas = new BloodCanvas(this.rect.w, this.rect.h, BLOOD_COLORS, BLOOD_PIXEL);
        this.particles = new ParticleSystem(this.bloodCanvas);
        this.combat = new CombatSystem({ renderer, particleSystem: this.particles });
        this.spawner = new SpawnSystem({ assets, bloodCanvas: this.bloodCanvas });
        this.screenGore = new ScreenGore(host.canvas);

        // Inimigos miram nestes "proxies": seguem os jogadores, mas não
        // recebem dano (o roteiro controla os dois).
        this.targets = [host.p1, host.p2].map(p => ({
            get x() { return p.x; }, get y() { return p.y; },
            takeDamage: () => false
        }));

        this.reset();
    }

    _decorate() {
        const last = ROOM_COLS - 1, bottom = ROOM_ROWS - 1;
        this.tiles.torches = [
            { col: 3, row: 0, side: 'N', type: 'torch' },
            { col: last - 3, row: 0, side: 'N', type: 'torch' },
            { col: 1, row: 1, side: 'W', type: 'torch' },
            { col: 1, row: bottom - 1, side: 'W', type: 'torch' },
            { col: last - 1, row: 1, side: 'E', type: 'torch' },
            { col: last - 1, row: bottom - 1, side: 'E', type: 'torch' },
        ];
    }

    reset() {
        this.active = false;
        this.t = 0;
        this.enemies = [];
        this.gibs = [];
        this.kills = 0;
        this.slowmo = 0;      // segundos restantes de câmera lenta
        this._acc = 0;
        this._sparkAcc = 0;
        this.particles.clear();
        this.screenGore.clear();
    }

    /** Começa a cena (chamado quando a transição de sangue cobre a tela). */
    start() {
        this.reset();
        this.active = true;
        const { host } = this;
        const { p1, p2, saw, renderer } = host;

        // Chão já ensanguentado: o massacre "já estava rolando".
        for (let i = 0; i < 18; i++) {
            const x = lerp(this.bounds.minX + 30, this.bounds.maxX - 30, Math.random());
            const y = lerp(this.bounds.minY + 30, this.bounds.maxY - 30, Math.random());
            if (i % 3 === 0) this.bloodCanvas.stampPool(x, y, 0.8 + Math.random() * 0.6);
            else this.bloodCanvas.stampSplat(x, y, 1 + Math.random());
        }

        // Jogadores com a serra ligada, em fúria.
        this.theta = 0;
        this._placePlayers(0);
        saw.pickup();
        saw.spin = 1;
        saw.dragX = saw.dragY = 0;
        host._express(p1, 'furia');
        host._express(p2, 'raiva');
        p1._faceLock = p2._faceLock = false;

        // Horda inicial em volta deles (já viva, sem intro).
        for (let i = 0; i < HORDE_SIZE; i++) this._spawnEnemy(false, 150, 420);

        // Câmera já colada neles.
        const mid = this._mid();
        renderer.camX = mid.x;
        renderer.camY = mid.y;
        renderer.zoom = host._zoomFit() * CAM_ZOOM;
    }

    _mid() {
        const { p1, p2 } = this.host;
        return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    }

    // Roteiro de movimento: o centro da dupla passeia pela arena e os dois
    // giram em volta dele (martelo), acelerando — a corda varre a horda.
    _placePlayers(dtStep) {
        const { p1, p2 } = this.host;
        const t = this.t;
        const c = this.center;
        const cx = c.x + Math.sin(t * 0.55) * this.rect.w * 0.2;
        const cy = c.y + Math.sin(t * 0.9 + 1) * this.rect.h * 0.14;
        const omega = lerp(2.2, 5.2, smooth(t / 3.5)) * (1 + 0.15 * Math.sin(t * 1.7));
        this.theta += omega * dtStep;
        const R = 92 + 22 * Math.sin(t * 1.3);
        const ox = Math.cos(this.theta) * R, oy = Math.sin(this.theta) * R * 0.8;

        for (const [p, sx, sy] of [[p1, cx + ox, cy + oy], [p2, cx - ox, cy - oy]]) {
            const dx = sx - p.x, dy = sy - p.y;
            p.x = sx; p.y = sy;
            if (dtStep > 0) { p.vx = dx; p.vy = dy; }
        }
    }

    // Anima o passo dos jogadores (correndo a toda).
    _animPlayers(dtStep) {
        for (const p of [this.host.p1, this.host.p2]) {
            p.walkFrame += 13 * dtStep;
            p.bobPhase += 11 * dtStep;
            const tiltTarget = Math.max(-1, Math.min(1, p.vx / p.speed)) * 0.16;
            p.tilt += (tiltTarget - p.tilt) * 0.15;
            if (p.vx < -0.3) p.facingLeft = true;
            else if (p.vx > 0.3) p.facingLeft = false;
        }
    }

    // Cria um inimigo num anel em volta da dupla, dentro da arena.
    _spawnEnemy(withIntro, minR, maxR) {
        const mid = this._mid();
        const b = this.bounds;
        let x, y, tries = 0;
        do {
            const a = Math.random() * Math.PI * 2;
            const r = lerp(minR, maxR, Math.random());
            x = mid.x + Math.cos(a) * r;
            y = mid.y + Math.sin(a) * r;
            tries++;
        } while ((x < b.minX + 20 || x > b.maxX - 20 || y < b.minY + 20 || y > b.maxY - 20) && tries < 12);
        x = Math.max(b.minX + 20, Math.min(b.maxX - 20, x));
        y = Math.max(b.minY + 20, Math.min(b.maxY - 20, y));

        const type = Math.random() < 0.5 ? 'demon' : 'bloodMonster';
        const e = this.spawner.createEnemy(x, y, 3, type);
        e.speed *= 1.25; // horda agressiva
        e.animTime = (Math.random() * 40) | 0;
        if (withIntro) {
            e.beginFrozenSpawn(0);
            this.particles.triggerFlameBurst(e.x, e.footY, FLAME_COLOR, { amount: 26 });
        }
        this.enemies.push(e);
    }

    update(dt) {
        if (!this.active) return;
        // Câmera lenta: o relógio da simulação anda mais devagar.
        const scale = this.slowmo > 0 ? 0.3 : 1;
        if (this.slowmo > 0) this.slowmo -= dt;
        this._acc += dt * 60 * scale;
        let steps = 0;
        while (this._acc >= 1 && steps < 4) { this._acc -= 1; steps++; this._step(); }
    }

    _step() {
        const STEP = 1 / 60;
        const { host } = this;
        const { p1, p2, saw, renderer } = host;
        this.t += STEP;

        this._placePlayers(STEP);
        this._animPlayers(STEP);

        // Serra: gira pelo movimento real; mantém no máximo (frenesi).
        saw.setOnBlood?.(false);
        saw.update(p1, p2);
        saw.spin = Math.max(saw.spin, 0.95);
        if (saw.isHighSpeed) renderer.triggerShake(2.2);

        const sawPos = saw.getSawPositions(p1, p2)[0];
        // Faíscas raspando o chão.
        this._sparkAcc += 4;
        const emit = Math.floor(this._sparkAcc);
        if (emit > 0) {
            this._sparkAcc -= emit;
            this.particles.triggerSparks(sawPos.x, sawPos.y, saw.discRadius, saw.spinDir, emit);
        }
        // Serra chapinhando no sangue do chão.
        if (this.bloodCanvas.isBloodZone(sawPos.x, sawPos.y)) {
            saw.setOnBlood(true);
            const a = Math.random() * Math.PI * 2;
            this.particles.triggerBloodDroplets(
                sawPos.x + Math.cos(a) * saw.discRadius, sawPos.y + Math.sin(a) * saw.discRadius, 2, 0.6);
        }

        // Unfreeze de quem terminou a aparição.
        for (const e of this.enemies) if (e.frozen && e.spawnFx <= 0) e.unfreeze();

        // IA da horda (persegue os jogadores; golpes não machucam).
        this.combat.updateEnemies(this.enemies, this.targets);

        // Colisões entre inimigos + disco sólido da serra.
        const live = this.enemies.filter(e => e.state !== 'dying');
        for (let it = 0; it < 2; it++) {
            Physics.resolveEntityCollisions(live);
            const sc = saw.getSawPositions(p1, p2)[0];
            for (const e of live) Physics.resolveCircleCollision(e, sc.x, sc.y, saw.collisionRadius);
        }
        const b = this.bounds;
        for (const e of this.enemies) {
            e.x = Math.max(b.minX + 12, Math.min(b.maxX - 12, e.x));
            e.y = Math.max(b.minY + 12, Math.min(b.maxY - 12, e.y));
        }

        // Cortes da serra/corda.
        this.combat.resolveWeaponHits(saw, this.enemies, p1, p2, true, () => {
            this.kills++;
            if (this.kills % SLOWMO_EVERY === 0) {
                this.slowmo = 0.16;
                renderer.triggerZoomPunch(0.05);
            }
        });

        // Explosão em gibs + sangue (versão inline de CombatSystem.resolveDeaths).
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            if (!e.readyToGib) continue;
            this.particles.triggerBlood(e.x, e.y, 30, 1.5);
            this.particles.triggerBloodPool(e.x, e.y);
            this.gibs.push(...e.explodeIntoGibs());
            while (this.gibs.length > MAX_ACTIVE_GIBS) this.gibs.shift();
            this.enemies.splice(i, 1);
            renderer.triggerShake(9);
            // Flash/respingos de tela mais contidos: com tantos abates seguidos
            // o pulso vermelho do jogo lavaria a imagem inteira.
            this.screenGore.trigger(0.35);
        }

        for (let i = this.gibs.length - 1; i >= 0; i--) {
            this.gibs[i].update(this.bounds);
            if (this.gibs[i].done) this.gibs.splice(i, 1);
        }

        // Repõe a horda (entra com chama), até 2 por passo.
        let need = HORDE_SIZE - this.enemies.length;
        for (let n = 0; n < Math.min(2, need); n++) this._spawnEnemy(true, 220, 460);

        this.particles.update([p1, p2], this.bounds);
        this.screenGore.update();

        // Expressões: alternam entre fúria e raiva (gritando no frenesi).
        const beat = Math.floor(this.t / 0.9);
        if (beat !== this._exprBeat) {
            this._exprBeat = beat;
            host._express(p1, beat % 2 ? 'raiva' : 'furia');
            host._express(p2, beat % 2 ? 'furia' : 'raiva');
        }

        // Câmera colada no meio da dupla, com leve antecipação do giro.
        const mid = this._mid();
        host._camTo(mid.x + saw.dragX * 0.3, mid.y - 12 + saw.dragY * 0.3,
            host._zoomFit() * CAM_ZOOM, 0.14);
    }

    render() {
        const { host } = this;
        const { ctx, renderer, p1, p2, saw } = host;

        renderer.beginFrame();
        renderer.drawBackground(BACKGROUND_TILE, TILE);

        const stub = DOOR_STUB_TILES * TILE;
        ctx.save();
        ctx.beginPath();
        ctx.rect(-stub, -stub, this.rect.w + stub * 2, this.rect.h + stub * 2);
        ctx.clip();

        renderer.drawRoom(this.rect, this.bounds, this.tiles, TILE, true, this.doorList, this.doorHalf);
        renderer.drawDoorStubs(this.rect, this.doorList, TILE, this.doorHalf, DOOR_STUB_TILES);
        renderer.drawDoorGradients(this.doorList, this.doorHalf, TILE, DOOR_STUB_TILES);

        this.particles.drawFloor(ctx, this.bounds);
        this.particles.drawSmoke(ctx);

        renderer.drawRoundShadow(p1.x, p1.y, 14, 0);
        renderer.drawRoundShadow(p2.x, p2.y, 14, 0);
        for (const e of this.enemies) if (!e.isHidden) renderer.drawRoundShadow(e.x, e.y, 13, 0);

        saw.drawChain(ctx, p1, p2);

        const sawPos = saw.getSawPositions(p1, p2)[0];
        const drawables = [p1, p2, ...this.enemies].sort((a, b) => a.y - b.y);
        drawables.filter(e => e.y <= sawPos.y).forEach(e => e.draw(ctx));
        host._drawSawGlow(ctx, sawPos);
        saw.draw(ctx, p1, p2);
        this.particles.drawSparks(ctx);
        drawables.filter(e => e.y > sawPos.y).forEach(e => e.draw(ctx));

        this.particles.drawFlames(ctx);
        renderer.drawFrontWall(this.rect, this.tiles, TILE, true, this.doorList, this.doorHalf, DOOR_STUB_TILES);
        this.gibs.forEach(g => g.draw(ctx));
        this.particles.drawAir(ctx);

        ctx.restore();
        renderer.endFrame();

        host._renderLights({ tiles: this.tiles, rect: this.rect, sawPos, sawDropped: null });
        host.postProcessor.draw();
        this.screenGore.draw(ctx);
    }
}
