import { handheld } from './rushKit.js';

// Peças de luta compartilhadas pelas cenas do trailer (nasceram na cena do Arauto):
// pacote de impacto por nível, câmera por planos com tranco, espera viva, arremesso e fila de ações.

const STEP = 1 / 60;
const rnd = (a, b) => a + Math.random() * (b - a);

// Intensidade por importância: inimigo comum = small, golpe forte = medium, boss = large.
export const HIT_TIERS = {
    small: { freeze: 2, shake: 10, zoom: 0.035, sparks: 10, flash: 0.15, slowmo: 0.05, kick: false },
    medium: { freeze: 3, shake: 16, zoom: 0.05, sparks: 16, flash: 0.25, slowmo: 0.08, kick: true },
    large: { freeze: 5, shake: 24, zoom: 0.08, sparks: 26, flash: 0.45, slowmo: 0.1, kick: true, big: true }
};

// Mordida da serra: quem estiver em dash trava alguns passos (o disco fica dentro do alvo) e o
// acerto solta faísca, sangue ou pedra, tremida, tranco de zoom e flash. `material`: 'flesh' | 'stone'.
// Sem ninguém em dash, a trava vira uma câmera lenta bem curta. Devolve o nível usado.
// `slow: false` dispensa a câmera lenta (para mortes em sequência não arrastarem a cena).
export function bite(A, cam, { x, y, dir = 1, tier = 'small', material = 'flesh', fx = null, extra = 0, slow = true } = {}) {
    const T = HIT_TIERS[tier] ?? HIT_TIERS.small;
    let froze = false;
    for (const p of [A.p1, A.p2]) if (p.dashing) { p.dashFreeze = T.freeze; froze = true; }
    if (!froze && slow) A.slowmo(T.slowmo, 0.3);
    A.saw.spin = 1;
    A.particles.triggerSparkBurst(x, y, 14 + extra, T.sparks + extra * 2, 1.6 + T.freeze * 0.2);
    if (material === 'stone') {
        A.particles.triggerLavaDebris?.(x, y, 6 + T.freeze * 2 + extra, { dirX: dir, dirY: -0.5, groundY: y + 30 });
    } else {
        A.particles.triggerBlood(x, y, 8 + T.freeze * 3, 1 + T.freeze * 0.1);
    }
    if (fx) {
        for (let i = 0; i < 4 + T.freeze * 2; i++) {
            const a = (dir > 0 ? 0 : Math.PI) + rnd(-1.2, 1.2), s = rnd(5, 14);
            fx.ember(x, y, Math.cos(a) * s, Math.sin(a) * s - 2, { size: rnd(3, 7), life: rnd(0.3, 0.7), float: false, drag: 0.92 });
        }
    }
    A.killFlashes.push({ x, y, life: 1, scale: 1 + T.freeze * 0.25 });
    A.renderer.triggerShake(T.shake + extra * 3);
    A.renderer.triggerZoomPunch(T.zoom + extra * 0.01);
    A.impactFlash = Math.max(A.impactFlash, T.flash);
    if (T.kick) cam?.kick(x, y, A.t, !!T.big);
    return T;
}

// Empurrão leve (swerve) ou arremesso (`fly`: o jogador voa, quica e freia).
export function knock(A, p, nx, ny, speed, hurt = 8, { fly = false } = {}) {
    p.dashT = 0; p.dashing = false; p.dashFreeze = 0;
    p.goal = null;
    p._hold = null;
    p.hurtTimer = hurt;
    if (fly) {
        p.airborne = true;
        p.airDrag = 0.88;
        p.vx = nx * speed; p.vy = ny * speed;
        p._knockT = 0.5;
        A.hop(p, 7);
    } else {
        A.swerve(p, nx * speed, ny * speed, 0.28);
        p._knockT = 0.32;
        A.hop(p, 3 + speed * 0.5);
    }
}

export function hold(p, x, y, max = 7) { p._hold = { x, y }; p._holdMax = max; }

// Espera viva: entre as ações cada jogador ronda o próprio ponto (`p._hold`), com passinhos e
// pulinhos aleatórios em ritmos diferentes, encarando `faceX` quando dado.
export function stepHold(A, t, faceX = null) {
    for (const p of [A.p1, A.p2]) {
        if (p._knockT > 0) { p._knockT -= STEP; continue; }
        if (p.dashing || p.airborne || p.dashFreeze > 0 || p._scripted) continue;
        if (!p._hold) p._hold = { x: p.x, y: p.y };
        const seed = p === A.p1 ? 0 : 1.7;
        if (!(p._stepT > 0)) {
            p._stepT = rnd(0.35, 0.75);
            p._off = { x: rnd(-38, 38), y: rnd(-22, 22) };
            if (Math.random() < 0.45) A.hop(p, rnd(2.5, 4));
        }
        p._stepT -= STEP;
        const o = p._off ?? { x: 0, y: 0 };
        const ph = t * (2.1 + seed * 0.4) + seed * 3;
        p.goal = {
            follow: true,
            x: p._hold.x + o.x + Math.sin(ph) * 16,
            y: p._hold.y + o.y + Math.cos(ph * 1.37) * 10,
            gain: 0.24, max: p._holdMax ?? 8
        };
        if (faceX !== null) p.faceX = faceX;
    }
}

// Ações atrasadas em passos de simulação (para os dois não se moverem em sincronia perfeita).
export class ActionQueue {
    constructor() { this.items = []; }
    clear() { this.items.length = 0; }
    later(steps, fn) { this.items.push({ left: steps, fn }); }
    step() {
        for (let i = this.items.length - 1; i >= 0; i--) {
            if (--this.items[i].left > 0) continue;
            const { fn } = this.items[i];
            this.items.splice(i, 1);
            fn();
        }
    }
}

// Câmera por planos: a cena escolhe o plano (`set`) e calcula o enquadramento dele; o kit aplica
// o fim automático (`until`), o tranco de acerto, a tremida de mão, o ajuste de retrato e o foco.
export class ShotCamera {
    constructor(stage) {
        this.stage = stage;
        this.reset();
    }
    reset(type = 'intro') {
        this.shot = { type, t0: 0 };
        this.kickData = null;
        this.dutch = 1;
    }
    set(type, t, extra = {}) { this.shot = { type, t0: t, ...extra }; }
    // Plano atual; troca para `fallback` quando o `until` do plano passou.
    current(t, fallback = 'fight') {
        const sh = this.shot;
        if (sh.until !== undefined && t > sh.until) this.shot = { type: fallback, t0: t };
        return this.shot;
    }
    kick(x, y, t, big = false, s = this.dutch) {
        this.kickData = { x, y, t, s, big };
        this.dutch = -this.dutch;
    }
    // `o` = { x, y, zoom, rot, k, fit?, pad? } em mundo, sem tremida de mão.
    frame(A, t, o, { hand = 1.1 } = {}) {
        const h = handheld(t, hand);
        const pz = this.stage.portrait ? 1.2 : 1;
        const kd = this.kickData;
        const kk = kd && t - kd.t < 0.4 ? 1 - (t - kd.t) / 0.4 : 0;
        if (kk > 0) {
            const amp = kd.big ? 1.5 : 1, e = kk * kk;
            o.x += (kd.x - o.x) * 0.35 * e; o.y += (kd.y - o.y) * 0.35 * e;
            o.zoom += 0.5 * amp * e; o.rot += 0.12 * amp * kd.s * e;
            o.k = Math.max(o.k, 0.3);
        }
        if (this.stage.portrait && o.fit) {
            const xs = o.fit.map(p => p.x);
            o.x = o.x * 0.2 + ((Math.min(...xs) + Math.max(...xs)) / 2) * 0.8;
        }
        A.focus({ ...o, x: o.x + h.x, y: o.y + h.y, zoom: o.zoom * pz, rot: o.rot + h.r });
    }
}
