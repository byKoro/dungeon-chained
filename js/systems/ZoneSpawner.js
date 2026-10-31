import { ZONE_SPAWN } from '../config/EventsConfig.js';
import { easeIn, easeOut, clamp01 } from './StakeRope.js';
import { objectsOwnedByZone } from '../rooms/ZoneAssign.js';

// Inimigos soltos (autorados no array `enemies` da sala) que ficam escondidos até a dupla entrar na zona onde
// foram colocados. Ao entrar, a câmera aproxima suave do grupo e eles despencam do alto do mapa (sem fogo e sem
// som de spawn), com uma queda demorada e um baque forte no chão. Um grupo por zona que contém inimigos soltos.
// Quando toda a leva do grupo morre, se a sala tem chave e uma corda com grade (gateRope), a câmera faz uma volta
// muda mostrando primeiro a chave (o objetivo) e depois a corda isolada (o que cortar para liberá-la).
// Cada grupo dispara uma vez por run (sobrevive à morte via complete).
export class ZoneSpawner {
    constructor({ api, cfg = ZONE_SPAWN } = {}) {
        this.api = api;
        this.cfg = cfg;
        const authored = api.authored || {};
        const zones = authored.zones || [];
        // Cada inimigo solto pertence a UMA zona (a menor que o contém); zonas sobrepostas não duplicam o grupo.
        this.groups = [];
        for (const z of zones) {
            const foes = objectsOwnedByZone(zones, authored.enemies, z.id);
            if (!foes.length) continue;
            // O intro genérico não deve criar estes: o grupo os assume.
            for (const foe of foes) api.claimAuthoredEnemy?.(foe);
            this.groups.push({ zoneId: z.id, foes });
        }
        // Alvos da cinemática de fim de combate: a chave (objetivo) e a corda com grade (o que liberá-la).
        this.key = (authored.interactives || []).find(o => o.type === "key" || o.type === "ropeKey") || null;
        this.gate = (authored.interactives || []).find(o => o.type === "gateRope") || null;
        this._restore();
    }

    get valid() {
        return this.groups.length > 0;
    }

    _restore() {
        for (const g of this.groups) {
            g.triggered = false;
            g.drops = [];
            g.spawned = [];
            g.cam = null;
            g.outro = null;
            g.outroDone = false;
        }
    }

    update() {
        for (const g of this.groups) {
            if (!g.triggered) {
                if (this.api.bothInZone?.(g.zoneId)) this._trigger(g);
                continue;
            }
            this._updateDrops(g);
            this._updateCamera(g);
            this._updateOutro(g);
        }
    }

    _trigger(g) {
        g.triggered = true;
        const j = this.cfg.jump, fallH = this.cfg.fallHeight;
        let i = 0;
        for (const foe of g.foes) {
            const at = this.api.tileCenter(foe.col, foe.row);
            const wait = j.delay + i * j.stagger;
            // airborne: sem colisão/sombra até pousar; sem som de spawn (não chamamos "enemySpawn").
            const e = this.api.spawnEnemy(foe.type, at.x, at.y, wait, { airborne: true });
            if (e) {
                e.fromZoneSpawn = true;
                g.spawned.push(e);
                g.drops.push({ e, t: -wait, fromY: at.y - fallH, toX: at.x, toY: at.y, phase: "hang", k: 0 });
                e.x = at.x; e.y = at.y - fallH;
            }
            i++;
        }
        // A câmera aproxima do centro do grupo e segura o enquadramento por toda a queda, com folga.
        const cx = g.foes.reduce((s, o) => s + this.api.tileCenter(o.col, o.row).x, 0) / g.foes.length;
        const cy = g.foes.reduce((s, o) => s + this.api.tileCenter(o.col, o.row).y, 0) / g.foes.length;
        const last = j.delay + (g.foes.length - 1) * j.stagger;
        const cam = this.cfg.cam;
        g.cam = {
            x: cx, y: cy,
            phase: "in", k: 0,
            hold: cam.hold + last + j.hangSteps + j.steps + j.settleSteps,
            from: this._playersCenter()
        };
    }

    _playersCenter() {
        const ps = (this.api.getPlayers?.() || []).filter(p => p && p.lives > 0);
        if (!ps.length) return null;
        return { x: ps.reduce((s, p) => s + p.x, 0) / ps.length, y: ps.reduce((s, p) => s + p.y, 0) / ps.length };
    }

    // Queda: curto suspense no alto → gravidade (ease-in, cada vez mais rápido) → baque → assenta e vira inimigo normal.
    _updateDrops(g) {
        const j = this.cfg.jump;
        for (let i = g.drops.length - 1; i >= 0; i--) {
            const k = g.drops[i], e = k.e;
            if (!this.api.room.enemies.includes(e)) { g.drops.splice(i, 1); continue; }
            k.t++;
            if (k.t < 0) { e.x = k.toX; e.y = k.fromY; continue; }

            if (k.phase === "hang") {
                e.x = k.toX; e.y = k.fromY;
                if (k.t >= j.hangSteps) { k.phase = "fall"; k.t = 0; }
                continue;
            }
            if (k.phase === "fall") {
                const u = clamp01(k.t / j.steps);
                e.x = k.toX;
                e.y = k.fromY + (k.toY - k.fromY) * easeIn(u);
                if (u >= 1) { e.y = k.toY; this._land(k); }
                continue;
            }
            if (k.phase === "settle") {
                if (++k.k >= j.settleSteps) {
                    e.airborne = false;
                    e.frozen = false;
                    g.drops.splice(i, 1);
                }
            }
        }
    }

    _land(k) {
        const j = this.cfg.jump, e = k.e, ps = this.api.particleSystem;
        k.phase = "settle";
        k.k = 0;
        // Baque proporcional ao quanto caiu: tremor, hit stop leve e poeira em anel.
        this.api.renderer?.triggerShake(j.shake);
        this.api.hitStop?.(this.cfg.cut.hitStop);
        this.api.audio?.play("enemyStep", { rateMultiplier: 0.75, volumeMultiplier: 0.9 });
        const ls = this.cfg.landSound;
        if (ls) this.api.audio?.play(ls.cue, { rateMultiplier: ls.rate, volumeMultiplier: ls.volume });
        for (let n = 0; n < j.dust; n++) {
            const a = (n / j.dust) * Math.PI * 2;
            ps?.triggerDust?.(e.x + Math.cos(a) * 16, (e.footY ?? e.y + 20) + Math.sin(a) * 5, Math.cos(a), Math.sin(a) * 0.5, 1);
        }
    }

    _groupAlive(g) {
        return g.spawned.filter(e => this.api.room.enemies.includes(e) && e.state !== "dying").length;
    }

    // Câmera da queda: aproxima suave (easeOut), segura acompanhando o grupo, depois volta suave (easeIn) à dupla.
    _updateCamera(g) {
        if (!g.cam) return;
        const cam = this.cfg.cam, c = g.cam, z = cam.zoom;
        c.k++;
        if (c.phase === "in") {
            const u = clamp01(c.k / cam.easeIn), e = easeOut(u);
            const from = c.from || { x: c.x, y: c.y };
            this.api.cameraFocus?.(from.x + (c.x - from.x) * e, from.y + (c.y - from.y) * e, 1 + (z - 1) * e);
            if (u >= 1) { c.phase = "hold"; c.k = 0; }
            return;
        }
        if (c.phase === "hold") {
            this.api.cameraFocus?.(c.x, c.y, z);
            if (c.k >= c.hold || g.drops.length === 0) { c.phase = "out"; c.k = 0; c.from = this._playersCenter() || c.from; }
            return;
        }
        // out: devolve o enquadramento à dupla.
        const u = clamp01(c.k / cam.easeOut), e = easeIn(u);
        const to = this._playersCenter() || c.from || { x: c.x, y: c.y };
        this.api.cameraFocus?.(c.x + (to.x - c.x) * e, c.y + (to.y - c.y) * e, z + (1 - z) * e);
        if (u >= 1) { this.api.clearCameraFocus?.(); g.cam = null; }
    }

    // Fim de combate: toda a leva morreu, a câmera da queda já soltou e a sala tem chave + corda com grade.
    _maybeStartOutro(g) {
        if (g.outro || g.outroDone || g.cam) return;
        if (!this.key || !this.gate) return;
        // Espera a leva do grupo e qualquer outro inimigo da zona (ex.: gaiolas da mesma zona) morrerem.
        if (this._groupAlive(g) > 0) return;
        if ((this.api.livingEnemiesInZone?.(g.zoneId) ?? 0) > 0) return;
        const o = this.cfg.outro;
        const key = this.api.tileCenter(this.key.col, this.key.row);
        const gate = this.api.tileCenter(this.gate.col, this.gate.row);
        const start = this._playersCenter() || key;
        // Legs encadeados (cada um: ponto/zoom de→para, duração e easing). Sem texto; câmera suave.
        // Aproxima na chave → segura → desliza até a corda → segura → volta à dupla.
        g.outro = {
            legs: [
                { from: { ...start, z: 1 }, to: { ...key, z: o.zoom }, dur: o.travel, ease: easeOut },
                { from: { ...key, z: o.zoom }, to: { ...key, z: o.zoom }, dur: o.hold, ease: easeOut },
                { from: { ...key, z: o.zoom }, to: { ...gate, z: o.zoom }, dur: o.pan, ease: easeInOutLocal },
                { from: { ...gate, z: o.zoom }, to: { ...gate, z: o.zoom }, dur: o.hold, ease: easeOut },
                { from: { ...gate, z: o.zoom }, to: null, dur: o.travel, ease: easeIn }
            ],
            leg: 0, k: 0
        };
    }

    // Volta muda: dupla → chave (segura) → corda isolada (segura) → volta à dupla.
    _updateOutro(g) {
        if (!g.triggered) return;
        if (!g.outro) { this._maybeStartOutro(g); return; }
        const c = g.outro, leg = c.legs[c.leg];
        c.k++;
        const u = clamp01(c.k / leg.dur), e = leg.ease(u);
        const to = leg.to || { ...(this._playersCenter() || leg.from), z: 1 };
        const f = leg.from;
        this.api.cameraFocus?.(f.x + (to.x - f.x) * e, f.y + (to.y - f.y) * e, f.z + (to.z - f.z) * e);
        if (u >= 1) {
            c.leg++;
            c.k = 0;
            if (c.leg >= c.legs.length) { this.api.clearCameraFocus?.(); g.outro = null; g.outroDone = true; }
        }
    }

    // Queda no ar: desenha a sombra de cada inimigo caindo (o Game não desenha sombra de `airborne`), crescendo ao descer.
    drawFloor(ctx) {
        const col = this.cfg.colors, j = this.cfg.jump;
        ctx.save();
        for (const g of this.groups) {
            for (const k of g.drops || []) {
                if (k.t < 0 || k.phase === "settle") continue;
                const u = k.phase === "fall" ? clamp01(k.t / j.steps) : 0;
                ctx.globalAlpha = 0.25 + 0.45 * u;
                ctx.fillStyle = col.shadow;
                ctx.beginPath();
                ctx.ellipse(k.toX, k.toY + 20, 8 + 9 * u, 3 + 3.5 * u, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    }

    // Morte da dupla: remove os inimigos que caíram e solta a câmera; o grupo volta a esperar a dupla na zona.
    onDeath() {
        for (const g of this.groups) {
            this.api.removeEnemies?.((g.drops || []).map(k => k.e));
            g.triggered = false;
            g.drops = [];
            g.spawned = [];
            g.outroDone = false;
            if (g.cam || g.outro) { this.api.clearCameraFocus?.(); g.cam = null; g.outro = null; }
        }
    }
}

const easeInOutLocal = k => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
