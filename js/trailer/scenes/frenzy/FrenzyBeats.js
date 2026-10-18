/**
 * Roteiro (beats) da FrenzyScene. Cada beat:
 *   { max, until?, enter(), update(t), cam(), onKill?, onYank?, onBump? }
 * `max` = duração máxima (s); `until` encerra antes quando verdadeiro.
 * Transições são sempre suaves: posições/câmera nunca são teleportadas,
 * apenas os OBJETIVOS (goal, faceX, expressão) mudam.
 */
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };

export const HORDE = 16;

export function buildFrenzyBeats(S) {
    const h = () => S.host;
    const P = () => [S.host.p1, S.host.p2];

    return [
        // 0 — CORRERIA desesperada; o demônio surge e é cortado sem querer.
        {
            max: 6,
            // (tempo de simulação: com a câmera lenta, 0.4s duram bem mais)
            until: () => S._loneDeadAt !== Infinity && S.beatT > S._loneDeadAt + 0.4,
            enter() {
                S._loneDeadAt = Infinity;
                S._sawDemon = false; S._stumbled = false; S._glance = -1;
                const [p1, p2] = P();
                p1.goal = { vx: -3.5, vy: 0 }; p2.goal = { vx: -3.3, vy: 0 };
                p1.wobble = p2.wobble = 0.45;
                p1.accel = p2.accel = 0.07;
            },
            update(t) {
                const [p1, p2] = P();
                const lone = S.lone;
                const loneAlive = lone && S.enemies.includes(lone) && !lone.isDying;
                if (!S._sawDemon) {
                    // Olham para trás aflitos, alternando (algo os perseguia).
                    const k = Math.floor(t / 0.55);
                    if (k !== S._glance) {
                        S._glance = k;
                        if (k % 2) S._look(p1, p1.x + 300); else S._expr(p1, 'assustado');
                        if (k % 3 === 1) S._look(p2, p2.x + 300); else S._expr(p2, 'preocupado');
                    }
                    // Tropeço do azul no meio da corrida.
                    if (t > 0.9 && !S._stumbled) { S._stumbled = true; p2.stumble = 0.35; S._blink(p2, 0.25); }
                }
                // Avistam o demônio: pulo de susto e tentam desviar, cada um
                // para um lado... e a corda fica bem no caminho dele.
                if (!S._sawDemon && loneAlive && Math.abs(S._mid().x - lone.x) < 330) {
                    S._sawDemon = true;
                    S._both(p => { S._hop(p, 5); S._expr(p, 'espantado'); });
                    p1.goal = { vx: -2.6, vy: -2.0 };
                    p2.goal = { vx: -2.6, vy: 2.0 };
                    h().renderer.triggerShake(4);
                }
                if (S._sawDemon && loneAlive && t % 0.5 < 0.02) { S._look(p1, lone.x); S._look(p2, lone.x); }
                if (S._loneDeadAt === Infinity && lone && lone.isDying) {
                    S._loneDeadAt = S.beatT;
                    S._slowmo(0.9, 0.22);
                    h().renderer.triggerZoomPunch(0.06);
                    S._both(p => { S._expr(p, 'espantado'); p.tiltKick = 0.25 * (p === S.host.p1 ? -1 : 1); });
                    p1.goal = p2.goal = null; // largam tudo: deslizam
                }
                // Demônio caminha em direção a eles (roteirizado).
                if (loneAlive) { lone.x += 1.0; lone.facingLeft = false; }
                // Garantia: o corte acontece mesmo se o encontro atrasar.
                if (t > 4.5 && loneAlive) lone.startDying();
            },
            cam: () => S._camFocus({
                lean: S.lone && S.enemies.includes(S.lone) ? S.lone : null, leanK: 0.3, zoom: 2.1
            })
        },

        // 1 — CHOQUE: olham os pedaços, se olham, tremem.
        {
            max: 3.4,
            enter() {
                const [p1, p2] = P();
                p1.goal = p2.goal = null;
                S._gibCenter = S._gibsCenter() ?? S._mid();
            },
            update(t) {
                const [p1, p2] = P();
                const g = S._gibCenter;
                // Depois do susto, chegam mais perto um do outro (e dos pedaços),
                // devagar e hesitantes.
                if (t > 0.7 && !p1.goal) {
                    const m = S._mid();
                    p1.goal = { x: m.x - 10, y: m.y - 60, speed: 0.9 };
                    p2.goal = { x: m.x + 10, y: m.y + 60, speed: 0.9 };
                    p1.accel = p2.accel = 0.05;
                }
                if (t < 2.4) { S._face(p1, g.x); S._face(p2, g.x); }
                p1.shiver = p2.shiver = t > 0.5 ? 0.6 : 0;
                S._stage(t, [
                    [0.0, () => S._both(p => S._expr(p, 'espantado'))],
                    [0.9, () => { S._face(p1, p2.x); S._face(p2, p1.x); S._look(p1, p2.x); S._look(p2, p1.x); }],
                    [1.5, () => S._both(p => { S._face(p, g.x); S._expr(p, 'preocupado'); })],
                    [2.1, () => S._blink(p2, 0.18)],
                    [2.5, () => { S._look(p1, g.x); S._expr(p2, 'assustado'); }],
                ]);
            },
            cam: () => S._camFocus({ lean: S._gibCenter, leanK: 0.25, zoom: 2.6 })
        },

        // 2 — PORTA: rugido; a câmera puxa para a porta e a horda entra.
        {
            max: 3.0,
            enter() {
                h().renderer.triggerShake(8);
                S.horde.setMode('enter'); // atravessam a porta e se reúnem em bloco
            },
            update(t) {
                const [p1, p2] = P();
                S.doorGlow = smooth(t / 1.2);
                if (t < 1.6 && h().renderer.screenShake < 3) h().renderer.triggerShake(4);
                p1.shiver = p2.shiver = 0.2;
                S._stage(t, [
                    [0.0, () => S._both(p => S._expr(p, 'assustado'))],
                    [0.3, () => S._both(p => { S._hop(p, 5.5); S._face(p, S.door.x); S._expr(p, 'espantado'); })],
                    [1.4, () => S._both(p => S._look(p, S.door.x))],
                    [2.0, () => S._both(p => S._expr(p, 'espantado'))],
                    [2.5, () => { S._look(p1, p2.x); S._look(p2, p1.x); }],
                ]);
                // Horda entra escalonada.
                const want = Math.floor(smooth((t - 0.4) / 1.8) * HORDE);
                while (S.hordeSpawned < want) S._spawnHorde();
            },
            cam: () => {
                const t = S.beatT;
                const k = smooth(t / 0.9) * (1 - smooth((t - 2.1) / 0.9));
                return S._camFocus({ lean: S.door, leanK: 0.12 + 0.4 * k, zoom: lerp(2.2, 1.45, k) });
            }
        },

        // 3 — DESESPERO: correm em voltas aleatórias, cada um para um lado; a
        //     corda vive dando tranco e os dois acabam girando um em volta do
        //     outro, sem sair do lugar.
        {
            max: 3.4,
            enter() {
                S._both(p => {
                    p.faceX = null; p.accel = 0.1; p.wobble = 0.25; p.shiver = 0;
                    p._ang = Math.random() * Math.PI * 2;
                    p._turn = 0;
                    p._bias = (p === S.host.p1 ? 1 : -1) * (0.035 + Math.random() * 0.02);
                    S._expr(p, 'espantado');
                });
                S._lastYank = -1; S._panicK = -1;
            },
            update(t) {
                const [p1, p2] = P();
                const b = S.bounds, hm = S.horde.mass ?? S.door;
                for (const p of [p1, p2]) {
                    // Rumo vagando ao acaso (curvas fechadas = voltas).
                    p._turn += (Math.random() - 0.5) * 0.06;
                    p._turn = Math.max(-0.1, Math.min(0.1, p._turn));
                    p._ang += p._turn + p._bias;
                    let dx = Math.cos(p._ang), dy = Math.sin(p._ang);
                    // Fogem das paredes e da horda (sem perceber, dão a volta).
                    const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
                    if (p.x < b.minX + 140 || p.x > b.maxX - 140) dx += Math.sign(cx - p.x) * 1.2;
                    if (p.y < b.minY + 120 || p.y > b.maxY - 120) dy += Math.sign(cy - p.y) * 1.2;
                    const hd = Math.hypot(p.x - hm.x, p.y - hm.y);
                    if (hd < 460) { dx += (p.x - hm.x) / hd * 1.4; dy += (p.y - hm.y) / hd * 1.4; }
                    const m = Math.hypot(dx, dy) || 1;
                    const sp = 3.6 + Math.sin(t * 5 + p._bias * 50) * 0.8;
                    p.goal = { vx: dx / m * sp, vy: dy / m * sp };
                    p._ang = Math.atan2(p.goal.vy, p.goal.vx); // rumo segue o desvio
                }
                // Caretas trocando o tempo todo (pânico).
                const k = Math.floor(t / 0.42);
                if (k !== S._panicK) {
                    S._panicK = k;
                    const opts = ['espantado', 'assustado', 'horda', 'outro', 'espantado', 'preocupado'];
                    for (const [p, o] of [[p1, opts[k % 6]], [p2, opts[(k + 3) % 6]]]) {
                        if (o === 'horda') S._look(p, hm.x);
                        else if (o === 'outro') S._look(p, (p === p1 ? p2 : p1).x);
                        else S._expr(p, o);
                    }
                }
            },
            onYank() {
                if (S.beatT - S._lastYank < 0.45) return;
                S._lastYank = S.beatT;
                S._both(p => { S._blink(p, 0.22); p.tiltKick = 0.3 * Math.sign(p.vx || 1); S._hop(p, 2.5); });
                h().renderer.triggerShake(6);
            },
            cam: () => S._camFocus({ lean: S.horde.mass, leanK: 0.1, zoom: 2.0 })
        },

        // 4 — ESBARRÃO: no meio da correria, disparam um na direção do outro.
        {
            max: 2.2,
            enter() {
                S._both(p => { p.faceX = null; S._expr(p, 'assustado'); p.accel = 0.16; p.wobble = 0.1; });
                S._bumped = false; S._bumpLook = false;
            },
            update(t) {
                const [p1, p2] = P();
                if (!S._bumped) {
                    // Cada um corre reto para onde o outro ESTÁ (sem frear).
                    for (const [p, o] of [[p1, p2], [p2, p1]]) {
                        const dx = o.x - p.x, dy = o.y - p.y, d = Math.hypot(dx, dy) || 1;
                        p.goal = { vx: dx / d * 4.6, vy: dy / d * 4.6 };
                    }
                    return;
                }
                const dt = t - S._bumpT;
                if (dt > 0.45 && !S._bumpLook) {
                    S._bumpLook = true;
                    S._expr(p1, 'raiva'); S._face(p1, p2.x);
                    S._expr(p2, 'desconfiado'); S._face(p2, p1.x);
                }
            },
            onBump() {
                if (S._bumped) return;
                S._bumped = true; S._bumpT = S.beatT;
                S._both(p => { p.goal = null; S._blink(p, 0.42); S._hop(p, 4); p.tiltKick = 0.4 * (p === S.host.p1 ? 1 : -1); });
                h().renderer.triggerShake(11);
            },
            cam: () => S._camFocus({ zoom: 2.3 })
        },

        // 5 — A HORDA VEM: avança em bloco pelo meio; eles recuam tremendo.
        {
            max: 2.8,
            enter() {
                S.horde.setMode('advance', { speed: 1.35, holdDist: 340 });
                h().renderer.triggerShake(6);
            },
            update(t) {
                const [p1, p2] = P();
                const hm = S.horde.mass ?? S.door;
                p1.shiver = p2.shiver = 0.45;
                S._stage(t, [
                    [0.0, () => S._both(p => { S._face(p, hm.x); S._hop(p, 4.5); S._expr(p, 'espantado'); })],
                    [0.8, () => S._both(p => {
                        // Recuam devagar, sem tirar os olhos da horda.
                        p.goal = { x: p.x - 70, y: p.y, speed: 1.1 }; p.accel = 0.06;
                        S._expr(p, 'assustado');
                    })],
                    [1.6, () => { S._look(p1, p2.x); S._look(p2, p1.x); }],
                    [2.2, () => { S._expr(p1, 'preocupado'); S._look(p2, hm.x); }],
                ]);
                if (t > 0.8) S._both(p => S._face(p, hm.x));
            },
            cam: () => S._camFocus({ lean: S.horde.mass, leanK: 0.35, zoom: 1.7 })
        },

        // 6 — DECISÃO: se olham, raiva e entram em formação.
        {
            max: 1.9,
            enter() {
                const [p1, p2] = P();
                S._lineY = S.door.y;
                S._lineX = Math.min(S._mid().x, S.door.x - 650);
                p1.goal = { x: S._lineX, y: S._lineY - 85, speed: 2.4 };
                p2.goal = { x: S._lineX, y: S._lineY + 85, speed: 2.4 };
                S._both(p => { p.accel = 0.1; p.wobble = 0.1; p.shiver = 0.15; });
                // A horda se alinha com a linha da investida e segura.
                S.horde.setMode('advance', { speed: 1.0, holdDist: 360 });
            },
            update(t) {
                const [p1, p2] = P();
                S._stage(t, [
                    [0.0, () => { S._face(p1, p2.x); S._face(p2, p1.x); S._look(p1, p2.x); S._look(p2, p1.x); }],
                    [0.55, () => { S._expr(p1, 'raiva'); S._hop(p1, 3); }],
                    [0.8, () => { S._expr(p2, 'raiva'); S._hop(p2, 3); }],
                    [1.25, () => S._both(p => { S._face(p, S.door.x); S._expr(p, 'furia'); })],
                ]);
            },
            cam: () => S._camFocus({ lean: S.door, leanK: 0.18, zoom: 2.0 })
        },

        // 7 — INVESTIDA em linha reta: um em cima, outro embaixo.
        {
            max: 4.0,
            until: () => S.host.p1.x > S.door.x - 170,
            enter() {
                S.charging = true;
                S.aimRope = true;
                S._firstChargeKill = false; S._midCharge = false;
                const [p1, p2] = P();
                S._both(p => { p.faceX = null; p.accel = 0.09; p.wobble = 0.04; S._expr(p, 'furia'); });
                p1.goal = { vx: 5.4, vy: 0, holdY: S._lineY - 85 };
                p2.goal = { vx: 5.4, vy: 0, holdY: S._lineY + 85 };
                S._both(p => { p.shiver = 0; });
                // Horda corre em bloco compacto bem para o MEIO da corda.
                S.horde.setMode('rush', { compact: 0.65 });
            },
            update(t) {
                if (t > 1.2 && !S._midCharge) { S._midCharge = true; S._expr(S.host.p2, 'raiva'); }
            },
            onKill() {
                if (S._firstChargeKill) return;
                S._firstChargeKill = true;
                // Corte seco para a montagem logo depois do primeiro abate.
                S._cutAt = S.beatT + 0.3;
                S._slowmo(0.55, 0.3);
                h().renderer.triggerZoomPunch(0.05);
            },
            cam: () => S._camFocus({ lead: 150, zoom: 2.0 })
        },

        // 8 — DEPOIS: freiam, viram e encaram o estrago. Fica em loop.
        {
            max: Infinity,
            enter() {
                S.charging = false;
                S.horde.setMode('swarm'); // retardatários se jogam na corda
                S._both(p => { p.goal = null; p.accel = 0.06; });
                S._idleGlance = -1;
            },
            // Algum retardatário se joga na corda: susto e careta.
            onKill() {
                S._both(p => { S._hop(p, 3); S.host._expressFor(p, 'espantado', 0.7); });
            },
            update(t) {
                const [p1, p2] = P();
                S.doorGlow = Math.max(0.35, 1 - smooth(t / 3) * 0.65);
                S._stage(t, [
                    [0.5, () => S._both(p => { S._face(p, p.x - 400); S._expr(p, 'espantado'); })],
                    [1.6, () => { S._look(p1, p2.x); S._look(p2, p1.x); }],
                    [2.3, () => S._both(p => S._expr(p, 'preocupado'))],
                    [2.9, () => S._blink(p1, 0.16)],
                ]);
                // Ofegantes + olhando ao redor (vivos), sem parar.
                p1.shiver = p2.shiver = t < 2.5 ? 0.35 : 0.12;
                if (t > 3.4) {
                    const k = Math.floor((t - 3.4) / 0.9);
                    if (k !== S._idleGlance) {
                        S._idleGlance = k;
                        const opts = [
                            () => S._look(p1, p1.x - 300), () => S._look(p2, p2.x + 300),
                            () => S._blink(p2, 0.14), () => S._look(p1, p2.x),
                            () => S._expr(p2, 'preocupado'), () => S._look(p2, p2.x - 300),
                            () => S._expr(p1, 'desconfiado'), () => S._blink(p1, 0.14),
                        ];
                        opts[k % opts.length]();
                    }
                }
            },
            cam: () => S._camFocus({ lean: S._gibsCenter(), leanK: 0.15, zoom: lerp(2.0, 2.4, smooth(S.beatT / 4)) })
        },
    ];
}
