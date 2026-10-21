/**
 * Plano E — AS CARTAS / ARREMESSO (Bloco 6: "árvores de habilidade pro
 * personagem e pra arma, como arremessar a serra e ver ela ricochetear nas
 * paredes").
 *
 * Mesa: pose-base embaixo e as 3 cartas lado a lado em cima (Gullinbursti,
 * ARREMESSO no meio, Mjölnir), cada uma na sua cruzinha da folha 4. A mão
 * escolhe o Arremesso: o corte acontece no começo do gesto (as 3 ainda no
 * lugar).
 * Jogo:
 *   1. as duas cartas de fora saem voando para os lados; os dois olham para
 *      cima; o Arremesso sobe, treme e brilha;
 *   2. a carta se desfaz nos PRÓPRIOS pixels, que voam para a serra; a serra
 *      absorve (clarão, faíscas, brilho vermelho);
 *   3. a câmera recua até a sala inteira e a sala se enche de demônios;
 *   4. se olham, fúria, e ARREMESSAM: a serra solta voa e ricocheteia 4 vezes
 *      nas paredes (reflexão de verdade), cortando os demônios no caminho
 *      (câmera lenta no 1º abate);
 *   5. depois do 4º ricochete a corda puxa a serra de volta: RECONEXÃO com
 *      soco de câmera; a câmera assenta.
 *
 * Tempos do roteiro em s de SIMULAÇÃO depois do congelamento; câmera em tempo
 * real (camTo).
 */
import { MatchShot, LAYOUT, FREEZE, TAIL } from './MatchShot.js';
import { clamp01, easeIn, easeOut, lerp, hash01 as hash } from '../anim.js';

const E = LAYOUT.shots.E;
const ART_PX = E.artPx;              // px de mundo por px de arte da carta
const CARD_UP = 10;                  // as PNGs são a arte ampliada 10x

// Arte das cartas (mesmas PNGs que vão para a impressão).
const CARD_IMG = {};
await Promise.all(E.cards.map(async (c) => {
    const img = new Image();
    img.src = new URL(`../../../pitch/print/cartas/carta_${c.id}.png`, import.meta.url).href;
    await img.decode();
    CARD_IMG[c.id] = img;
}));

const LOOK_AT = 0.05;       // olham para as cartas
const SIDE_AT = 0.12;       // cartas de fora saem
const SIDE_DUR = 0.36;
const SIDE_DX = 440;        // px de mundo que cada uma anda para fora do quadro
const LIFT_AT = 0.32;       // Arremesso sobe e brilha
const BURST_AT = 0.78;      // carta vira pixels
const POP_DUR = 0.08;       // pixels estouram para fora...
const FLY_DUR = 0.26;       // ...e são sugados pela serra
const FLY_SPREAD = 0.16;    // atraso máximo entre um pixel e outro
const ABSORB_AT = BURST_AT + POP_DUR + FLY_DUR + FLY_SPREAD;   // ~1.38
const SPAWN_AT = ABSORB_AT + 0.08;
const SPAWN_GAP = 0.06;
const NOD_AT = 1.66;        // se olham com fúria
const THROW_AT = 1.88;      // arremesso
const SAW_V = 17;           // px/passo da serra solta
const BOUNCES = 4;          // ricochetes antes de voltar
const HOME_TURN = 0.13;     // quão rápido a corda puxa a serra de volta
const CATCH_DIST = 34;
const RETURN_GUARANTEE = 2.75;  // s de voo até forçar a reconexão (rede de segurança; o natural é ~2.5)
const WIDE = { x: 576, y: 352, z: 0.56 };  // sala inteira (as 4 paredes à vista)
// Onde os demônios aparecem: distância ao longo do caminho da serra
// (pontos a menos de 150 px dos dois são descartados).
const ENEMY_ARC = [230, 480, 700, 905, 1110, 1480, 1590];

export class CardShot extends MatchShot {
    constructor(stage) {
        super(stage, FREEZE + 4.8 + TAIL);
    }

    setup(A) {
        const { p1, p2, saw } = A;
        const S = this;
        const y0 = LAYOUT.pose.p1.y;
        S.phase = 'cards';
        S.flags = {};
        S.bounces = 0;
        S.kills0 = 0;
        S.throwT = S.catchT = undefined;
        S.trail = [];
        S.glow = 0;
        S.pixels = null;
        const once = (k) => (S.flags[k] ? false : (S.flags[k] = true));

        // Caixa de ricochete (centro da serra encosta a borda do disco na parede).
        const R = saw.discRadius;
        const b = A.bounds;
        S.box = { minX: b.minX + R, maxX: b.maxX - R, minY: b.minY + R, maxY: b.maxY - R };
        S.start = { x: (LAYOUT.pose.p1.x + LAYOUT.pose.p2.x) / 2, y: y0 };
        // 1ª parede: em cima, à direita (longe dos dois, bem visível).
        const aim = { x: 800, y: S.box.minY };
        const d0 = Math.hypot(aim.x - S.start.x, aim.y - S.start.y);
        S.dir0 = { x: (aim.x - S.start.x) / d0, y: (aim.y - S.start.y) / d0 };
        S.path = this._tracePath(S.start, S.dir0, BOUNCES);

        // Cartas: estado de cada uma (deslocamento, giro, escala, alfa).
        S.cards = E.cards.map(c => ({
            ...c, img: CARD_IMG[c.id], pick: c.id === E.pick,
            dir: Math.sign(c.x - S.start.x), dx: 0, dy: 0, rot: 0, s: 1, a: 1, glow: 0
        }));

        A.onDrawOver = (ctx) => S._drawOver(A, ctx);

        A.script = (t) => {
            A.minSpin = S.phase === 'cards' ? Math.min(0.5, t * 0.8) : A.minSpin;

            // 1) Olham para as cartas; as de fora saem; o Arremesso sobe.
            if (t > LOOK_AT && once('look')) {
                A.both(p => { A.expr(p, 'olhando_cima'); A.hop(p, 2.2); });
            }
            if (t > SIDE_AT && once('side')) {
                A.stage.audio?.play('whoosh', { vol: 0.55, rate: 1.15 });
            }
            for (const c of S.cards) {
                if (c.pick) {
                    const k = easeOut(clamp01((t - LIFT_AT) / 0.35));
                    c.s = 1 + 0.1 * k;
                    c.dy = -8 * k;
                    c.glow = k * (0.7 + 0.3 * Math.sin(t * 40));
                    c.shake = clamp01((t - LIFT_AT - 0.15) / 0.3) * 1.6;
                } else {
                    const k = clamp01((t - SIDE_AT) / SIDE_DUR);
                    const e = easeIn(k);
                    c.dx = c.dir * SIDE_DX * e;
                    c.dy = 26 * e * e;
                    c.rot = c.dir * 0.55 * e;
                    c.a = 1 - clamp01((k - 0.75) / 0.25);
                }
            }
            if (t > LIFT_AT && once('lift')) {
                A.stage.audio?.play('riser', { vol: 0.35, rate: 1.6 });
                S.camTo({ x: S.start.x, y: 322, z: 1.06, rot: -0.015, k: 2.4 });
            }

            // 2) A carta vira pixels, que voam para a serra.
            if (t > BURST_AT && once('burst')) {
                const c = S.cards.find(k => k.pick);
                c.a = 0;
                S.pixels = this._cardPixels(c);
                A.particles.triggerFlash(c.x, c.y + c.dy, 14, 1.1);
                A.renderer.triggerShake(8);
                A.renderer.triggerZoomPunch(0.03);
                A.sfx('pop', c.x, c.y, { vol: 0.7 });
                A.sfx('zap', c.x, c.y, { vol: 0.5, rate: 1.3, delay: 0.08 });
                A.both(p => A.exprFor(p, 'espantado', 0.5));
                // Acompanha os pixels descendo da carta para a serra.
                S.camTo({ x: S.start.x, y: 345, z: 1.08, rot: 0.02, k: 3 });
            }
            if (t > ABSORB_AT && once('absorb')) {
                const sp = A.sawPos;
                S.glow = 1;
                A.minSpin = 1; saw.spin = 1;
                S.hitstop(0.06);
                A.particles.triggerSparkBurst(sp.x, sp.y, R, 34, 2);
                A.particles.triggerFlash(sp.x, sp.y, 18, 1.4);
                A.renderer.triggerShake(16);
                A.renderer.triggerZoomPunch(0.06);
                A.sfx('impact', sp.x, sp.y, { vol: 0.7 });
                A.sfx('sawHit', sp.x, sp.y, { vol: 0.6 });
                A.stage.audio?.excite(0.5);
                A.both(p => { p.faceX = sp.x; A.expr(p, 'raiva'); A.hop(p, 3); });
                // 3) A câmera recua até a sala inteira.
                S.camTo({ x: WIDE.x, y: WIDE.y, z: WIDE.z, rot: 0, k: 2.6 });
                S.phase = 'charged';
            }
            // A sala se enche de demônios ao longo do caminho que a serra vai fazer.
            if (S.flags.absorb && !S.flags.spawned) {
                const due = Math.min(S.enemyAt().length, Math.floor((t - SPAWN_AT) / SPAWN_GAP) + 1);
                S.nSpawned = S.nSpawned ?? 0;
                while (S.nSpawned < due) {
                    const at = S.enemyAt()[S.nSpawned];
                    A.spawnEnemy(at.x, at.y, S.nSpawned % 3 === 1 ? 'bloodMonster' : 'demon',
                        { speed: 0, intro: true, lookAt: A.midTarget });
                    if (S.nSpawned % 3 === 0) A.renderer.triggerShake(5);
                    S.nSpawned++;
                }
                if (S.nSpawned >= S.enemyAt().length) S.flags.spawned = true;
                if (S.nSpawned === 2 && once('roar')) A.sfx('roar', 900, 300, { vol: 0.45, rate: 1.25 });
            }
            if (S.phase === 'charged') S.glow = 0.75 + 0.25 * Math.sin(t * 18);

            // 4) Se olham, fúria... e arremessam.
            if (t > NOD_AT && once('nod')) {
                A.both(p => { p.faceX = p === p1 ? p2.x : p1.x; A.expr(p, 'furia'); A.hop(p, 3.4); });
                saw.setStrain(0.6);
                A.renderer.triggerShake(6);
            }
            if (t > THROW_AT && once('throw')) {
                const sp = A.sawPos;
                S.phase = 'flight';
                S.throwT = t;
                saw.setStrain(0);
                A.connected = false;
                A.freeSaw = { x: sp.x, y: sp.y, vx: S.dir0.x * SAW_V, vy: S.dir0.y * SAW_V };
                S.kills0 = A.kills;
                S.hitstop(0.05);
                A.renderer.triggerShake(14);
                A.renderer.triggerZoomPunch(0.04);
                A.particles.triggerSparkBurst(sp.x, sp.y, R, 24, 1.8);
                A.sfx('whoosh', sp.x, sp.y, { vol: 0.9, rate: 0.9 });
                A.sfx('sawSnap', sp.x, sp.y, { vol: 0.45, rate: 1.3 });
                A.both(p => {
                    p.goal = { x: p.x, y: p.y, speed: 1 };
                    p.tiltKick = 0.35 * Math.sign(S.dir0.x || 1);
                    A.hop(p, 3);
                    A.particles.triggerDust(p.x, p.y + 20, -S.dir0.x, -S.dir0.y, 10);
                });
            }

            if (S.phase === 'flight') S._flight(A, t);

            // 5) Reconectados: soco de câmera, depois assenta e deriva.
            if (S.phase === 'caught') {
                if (t > S.catchT + 0.3 && once('rest')) S.camTo({ x: A.mid.x, y: A.mid.y - 30, z: 0.9, rot: 0, k: 3 });
                if (t > S.catchT + 0.8 && once('drift')) S.camTo({ z: 0.95, k: 0.7 });
                S.glow = Math.max(0, S.glow - 0.012);
            }
        };
    }

    // Lugares dos demônios: pontos do caminho da serra longe dos dois.
    enemyAt() {
        if (this._enemyAt) return this._enemyAt;
        const A = this.arena, out = [];
        for (const s of ENEMY_ARC) {
            const p = this._pointAt(s);
            const far = [A.p1, A.p2].every(q => Math.hypot(q.x - p.x, q.y - p.y) > 150);
            const b = A.bounds;
            if (far) out.push({ x: Math.max(b.minX + 30, Math.min(b.maxX - 30, p.x)), y: Math.max(b.minY + 40, Math.min(b.maxY - 30, p.y)) });
        }
        return (this._enemyAt = out);
    }

    // Caminho da serra com reflexão de verdade nas paredes (lista de pontos).
    _tracePath(start, dir, n) {
        const B = this.box, pts = [{ ...start }];
        let x = start.x, y = start.y, vx = dir.x, vy = dir.y;
        for (let i = 0; i < n; i++) {
            const tx = vx > 0 ? (B.maxX - x) / vx : vx < 0 ? (B.minX - x) / vx : Infinity;
            const ty = vy > 0 ? (B.maxY - y) / vy : vy < 0 ? (B.minY - y) / vy : Infinity;
            const tt = Math.min(tx, ty);
            x += vx * tt; y += vy * tt;
            if (tx <= ty) vx = -vx; else vy = -vy;
            pts.push({ x, y });
        }
        return pts;
    }

    _pointAt(s) {
        const P = this.path;
        for (let i = 1; i < P.length; i++) {
            const a = P[i - 1], b = P[i], L = Math.hypot(b.x - a.x, b.y - a.y);
            if (s <= L) return { x: lerp(a.x, b.x, s / L), y: lerp(a.y, b.y, s / L) };
            s -= L;
        }
        return { ...P[P.length - 1] };
    }

    // Voo da serra: ricocheteia na caixa; depois do último ricochete a corda
    // puxa de volta para o meio dos dois.
    _flight(A, t) {
        const S = this, f = A.freeSaw, B = S.box, saw = A.saw;
        S.trail.push({ x: f.x, y: f.y });
        if (S.trail.length > 9) S.trail.shift();

        if (S.bounces < BOUNCES) {
            const nx = f.x + f.vx, ny = f.y + f.vy;
            let hit = null;
            if (nx > B.maxX || nx < B.minX) { f.vx = -f.vx; hit = { x: nx > B.maxX ? B.maxX + saw.discRadius : B.minX - saw.discRadius, y: f.y }; }
            if (ny > B.maxY || ny < B.minY) { f.vy = -f.vy; hit = { x: f.x, y: ny > B.maxY ? B.maxY + saw.discRadius : B.minY - saw.discRadius }; }
            if (hit) {
                S.bounces++;
                A.particles.triggerSparkBurst(hit.x, hit.y, 6, 26, 2);
                A.particles.triggerDust(hit.x, hit.y, -Math.sign(hit.x - f.x), -Math.sign(hit.y - f.y), 10);
                A.renderer.triggerShake(13);
                A.renderer.triggerZoomPunch(0.025);
                A.sfx('sawHit', hit.x, hit.y, { vol: 0.8, cool: 0 });
                A.sfx('thunk', hit.x, hit.y, { vol: 0.55, cool: 0 });
                S.camTo({ rot: (S.bounces % 2 ? 1 : -1) * 0.03, k: 5 });
            }
        } else {
            // A corda puxa de volta.
            const m = A.mid, dx = m.x - f.x, dy = m.y - f.y, d = Math.hypot(dx, dy) || 1;
            const sp = Math.min(SAW_V, Math.max(6, d * 0.2));
            f.vx += (dx / d * sp - f.vx) * HOME_TURN;
            f.vy += (dy / d * sp - f.vy) * HOME_TURN;
            if (d < CATCH_DIST) return S._catch(A, t);
        }
        if (t > S.throwT + RETURN_GUARANTEE) return S._catch(A, t);

        // Abates: o 1º em câmera lenta; todos dão um tranco na câmera.
        if (A.kills > S.kills0) {
            if (once.call(S, 'kill1')) {
                S.hitstop(0.05);
                A.slowmo(0.28, 0.32);
                A.renderer.triggerZoomPunch(0.04);
            } else A.renderer.triggerZoomPunch(0.015);
            S.kills0 = A.kills;
        }

        // Os dois acompanham a serra com o olhar.
        if (((t * 60) | 0) % 6 === 0) A.both(p => { p.faceX = f.x; });
        // Câmera aberta, puxada de leve para onde a serra está.
        S.camTo({ x: WIDE.x + (f.x - WIDE.x) * 0.18, y: WIDE.y + (f.y - WIDE.y) * 0.14, z: WIDE.z, k: 3 });
    }

    _catch(A, t) {
        const S = this, saw = A.saw, f = A.freeSaw;
        S.phase = 'caught';
        S.catchT = t;
        A.freeSaw = null;
        saw.drop(f.x, f.y);
        A.reconnect();
        A.connectFlash = 0.75;
        S.hitstop(0.07);
        A.slowmo(0.16, 0.4);
        A.minSpin = 0.9;
        S.trail.length = 0;
        A.both(p => { A.expr(p, 'furia'); A.hop(p, 4); p.faceX = p === A.p1 ? A.p2.x : A.p1.x; p.goal = { x: p.x, y: p.y, speed: 1 }; });
        const m = A.mid;
        S.camTo({ x: m.x, y: m.y - 20, z: 1.05, rot: 0.05, k: 13 });
    }

    // Pixels da carta (blocos 2x2 da arte), cada um com o seu caminho até a serra.
    _cardPixels(c) {
        const art = document.createElement('canvas');
        art.width = c.img.width; art.height = c.img.height;
        const g = art.getContext('2d');
        g.drawImage(c.img, 0, 0);
        const data = g.getImageData(0, 0, art.width, art.height).data;
        const aw = art.width / CARD_UP, ah = art.height / CARD_UP;
        const w = aw * ART_PX * c.s, h = ah * ART_PX * c.s;
        const x0 = c.x - w / 2, y0 = c.y + c.dy - h / 2;
        const out = [];
        let i = 0;
        for (let ay = 0; ay < ah; ay += 2) {
            for (let ax = 0; ax < aw; ax += 2) {
                const o = ((ay * CARD_UP + 5) * art.width + (ax * CARD_UP + 5)) * 4;
                if (data[o + 3] < 10) continue;
                const px = x0 + (ax + 1) * ART_PX * c.s, py = y0 + (ay + 1) * ART_PX * c.s;
                const ang = Math.atan2(py - c.y, px - c.x) + (hash(i) - 0.5) * 0.8;
                const pop = 10 + hash(i + 7) * 30;
                out.push({
                    x: px, y: py,
                    ox: Math.cos(ang) * pop, oy: Math.sin(ang) * pop - 4,
                    bend: (hash(i + 3) - 0.5) * 120,
                    delay: hash(i + 11) * FLY_SPREAD,
                    color: `rgb(${data[o]}, ${data[o + 1]}, ${data[o + 2]})`
                });
                i++;
            }
        }
        return out;
    }

    // ---- Desenho (depois da luz: as cartas são "interface", não escurecem) ----
    _drawOver(A, ctx) {
        const S = this, t = A.t;
        ctx.imageSmoothingEnabled = false;
        // Cartas.
        for (const c of S.cards) {
            if (c.a <= 0) continue;
            const w = c.img.width / CARD_UP * ART_PX, h = c.img.height / CARD_UP * ART_PX;
            const jx = c.shake ? (hash(((t * 60) | 0) + 1) - 0.5) * 2 * c.shake : 0;
            const jy = c.shake ? (hash(((t * 60) | 0) + 5) - 0.5) * 2 * c.shake : 0;
            ctx.save();
            ctx.translate(c.x + c.dx + jx, c.y + c.dy + jy);
            ctx.rotate(c.rot);
            ctx.scale(c.s, c.s);
            if (c.glow > 0) {
                // Brilho vermelho em volta (borda da carta acesa).
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                for (let k = 3; k >= 1; k--) {
                    const pad = k * 3.4;
                    ctx.globalAlpha = c.glow * 0.16 * (4 - k);
                    ctx.fillStyle = '#ff3b2f';
                    ctx.fillRect(-w / 2 - pad, -h / 2 - pad, w + pad * 2, h + pad * 2);
                }
                ctx.restore();
            }
            ctx.globalAlpha = c.a;
            ctx.drawImage(c.img, -w / 2, -h / 2, w, h);
            if (c.glow > 0) {
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = c.glow * 0.22;
                ctx.drawImage(c.img, -w / 2, -h / 2, w, h);
            }
            ctx.restore();
        }

        // Pixels da carta voando até a serra.
        if (S.pixels && !S.flags.absorbDrawn) {
            const sp = A.sawPos, lt = t - BURST_AT;
            let alive = 0;
            const sz = ART_PX * 2 * (S.cards.find(c => c.pick)?.s ?? 1);
            for (const p of S.pixels) {
                const kp = easeOut(clamp01(lt / POP_DUR));
                const kl = clamp01((lt - POP_DUR - p.delay) / FLY_DUR);
                const kf = kl * kl;     // acelera até ser sugado
                if (kl >= 1) continue;
                alive++;
                // Estouro curto para fora, depois curva até a serra.
                const ax = p.x + p.ox * kp, ay = p.y + p.oy * kp;
                const cx = (ax + sp.x) / 2 + p.bend, cy = (ay + sp.y) / 2 - 20;
                const u = kf, v = 1 - u;
                const x = v * v * ax + 2 * v * u * cx + u * u * sp.x;
                const y = v * v * ay + 2 * v * u * cy + u * u * sp.y;
                const s = sz * (1 - 0.6 * u);
                ctx.globalAlpha = 1;
                ctx.fillStyle = p.color;
                ctx.fillRect(x - s / 2, y - s / 2, s, s);
                if (u > 0.4) {
                    ctx.save();
                    ctx.globalCompositeOperation = 'lighter';
                    ctx.globalAlpha = (u - 0.4) * 0.9;
                    ctx.fillStyle = '#ff6a4a';
                    ctx.fillRect(x - s / 2, y - s / 2, s, s);
                    ctx.restore();
                }
            }
            if (!alive && lt > POP_DUR) S.flags.absorbDrawn = true;
        }

        // Serra carregada: brilho vermelho + rastro no voo (a serra vem por cima).
        if (S.glow > 0 && A.sawVisible) {
            const sp = A.sawPos;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < S.trail.length; i++) {
                const q = S.trail[i], k = (i + 1) / S.trail.length;
                ctx.globalAlpha = 0.22 * k * S.glow;
                ctx.fillStyle = '#ff3020';
                ctx.beginPath();
                ctx.arc(q.x, q.y, 30 * (0.5 + 0.5 * k), 0, Math.PI * 2);
                ctx.fill();
            }
            const r = 52 + 8 * Math.sin(t * 24);
            const grd = ctx.createRadialGradient(sp.x, sp.y, 8, sp.x, sp.y, r);
            grd.addColorStop(0, `rgba(255, 80, 50, ${0.55 * S.glow})`);
            grd.addColorStop(1, 'rgba(255, 30, 20, 0)');
            ctx.globalAlpha = 1;
            ctx.fillStyle = grd;
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
    }
}

// Flag de uma vez só (mesma ideia do `once` do roteiro).
function once(k) { return this.flags[k] ? false : (this.flags[k] = true); }
