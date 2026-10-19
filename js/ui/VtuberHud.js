/**
 * VtuberHud — HUD desenhada no canvas: cada jogador aparece num canto
 * inferior como um "vtuber" (busto grande saindo da borda da tela) e a vida
 * fica numa fileira de corações ao lado, apontando para o centro da tela.
 *
 *   P1 (esquerda)  [busto] ♥♥♥ ......................... ♥♥♥ [busto]  P2 (direita)
 *
 * Game feel (tudo transitório, volta ao repouso):
 *   - Idle: respiração (squash leve), balanço de pêndulo, piscadas e olhadas
 *     ao redor (esquerda/direita/cima/desconfiado) com o corpo inclinando
 *     para o lado do olhar.
 *   - Acompanha o boneco do jogo: quando o jogador anda, o busto balança e
 *     inclina na direção do movimento.
 *   - Entrar em sala: pulinho + estica/encolhe + sequência de reação
 *     (espanto -> desconfiança -> raiva em sala de combate; espiada nos
 *     cantos em sala aberta).
 *   - Dano: clarão branco -> tinta vermelha, tremor por "trauma" (seno, não
 *     ruído), squash forte, recuo para a borda, expressão assustada; o
 *     coração perdido racha em duas metades que caem; o parceiro se espanta
 *     e olha para quem apanhou.
 *   - Cura: coração entra com overshoot; com 1 vida o último coração bate.
 *
 * A HUD lê as vidas dos jogadores a cada quadro e reage às MUDANÇAS (dano/
 * cura de qualquer fonte). Eventos de sala chegam por onRoomEnter/onRoomCleared.
 * Usa tempo REAL (performance.now), então não desacelera no slow-motion.
 */
import { drawText, measureText } from './PixelFont.js';

const MAX_LIVES = 3;
const HEART_FRAME = { FULL: 0, EMPTY: 1, HALF_L: 2, HALF_R: 3 };
const HEART_ART = 16; // célula do coração (px de arte)
// Linhas do sprite que ficam ABAIXO da borda da tela (pernas): o busto
// "sai" do rodapé como um vtuber. O pulo revela as pernas naturalmente.
const BELOW_EDGE_ROWS = 6;

const REDUCED_MOTION = typeof window !== 'undefined' && !!window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Atenuação de tremores/flashes para quem pede menos movimento.
const MOTION = REDUCED_MOTION ? 0.35 : 1;

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Mola amortecida (semi-implícita): x persegue target com overshoot. */
class Spring {
    constructor(value, k, c) {
        this.x = value; this.v = 0; this.target = value; this.k = k; this.c = c;
    }
    update(dt) {
        const a = -this.k * (this.x - this.target) - this.c * this.v;
        this.v += a * dt;
        this.x += this.v * dt;
    }
    kick(v) { this.v += v; }
    set(x) { this.x = x; }
}

/** Retrato de um jogador (busto + reações). */
class Portrait {
    /**
     * @param {object} o
     * @param {'left'|'right'} o.side  canto da tela
     * @param {object} o.sprite        config do sprite (EntityConfig)
     * @param {HTMLImageElement} o.walk folha base (player_walk.png)
     * @param {Object<string, HTMLImageElement>} o.expressions
     */
    constructor({ side, sprite, walk, expressions }) {
        this.side = side;
        // O sprite olha para a DIREITA; no canto direito ele vira para o centro.
        this.flip = side === 'right';
        this.towardCenter = side === 'left' ? 1 : -1; // direção do centro (tela)
        this.sprite = sprite;
        this.walk = walk;
        this.expressions = expressions;
        this.seed = Math.random() * 100;

        // Buffer de 1 frame para tingir (clarão/dano) sem afetar a folha.
        this._buf = document.createElement('canvas');
        this._buf.width = sprite.cropW;
        this._buf.height = sprite.cropH;
        this._bctx = this._buf.getContext('2d');

        this.reset();
    }

    reset() {
        this.t = 0;
        this.base = 'neutro';
        this.seq = [];          // [{ expr?, look?, dur, idle? }]
        this.seqT = 0;
        this.idleWait = rand(1.2, 2.6);
        this.blinkT = rand(1.5, 4);
        this.blinking = 0;
        this.flashT = 0;        // clarão branco do impacto
        this.redT = 0;          // tinta vermelha pós-impacto
        this.trauma = 0;        // tremor (0..1), forma trauma²
        this.pending = [];      // reações atrasadas [{ t, fn }]
        this.dead = false;
        this.paused = false;
        // Molas: escala vertical (squash/stretch), pulo (px de arte),
        // recuo lateral (px de arte) e inclinação do olhar (-1..1).
        this.squash = new Spring(1, 320, 13);
        this.hop = new Spring(0, 140, 11);
        this.push = new Spring(0, 120, 12);
        this.lean = new Spring(0, 45, 9);
        this.sink = new Spring(0, 30, 9);
        this.walkPhase = 0;
        this.walkAmt = 0;
        this.tilt = 0;
    }

    // ---- Reações (eventos) ----

    // Substitui a sequência atual (eventos têm prioridade sobre o idle).
    _play(steps) {
        this.seq = steps.map(s => ({ ...s }));
        this.seqT = 0;
        this.idleWait = rand(1.5, 3);
    }

    _later(t, fn) { this.pending.push({ t, fn }); }

    hurt() {
        this.flashT = 0.1;
        this.redT = 0.45;
        this.trauma = 1;
        this.squash.set(0.74);
        this.squash.kick(-1.5);
        this.hop.kick(30);                       // tranco para BAIXO
        this.push.kick(-this.towardCenter * 40); // recua para a borda
        this.blinking = 0;
        this._play([
            { expr: 'assustado', dur: 1.0 },
            { expr: 'preocupado', dur: 0.9 }
        ]);
    }

    partnerHurt() {
        // Espanta e olha para o parceiro (que está no outro canto = centro).
        this._later(0.06, () => {
            this.hop.kick(-40);
            this.squash.set(1.12);
            this.lean.kick(this.towardCenter * 3);
            this._play([
                { expr: 'espantado', dur: 0.45, lean: this.towardCenter },
                { look: this.towardCenter, dur: 0.7 }
            ]);
        });
    }

    roomEnter(combat, delay) {
        this._later(delay, () => {
            // Pulinho com estica (antecipação curta via squash inicial).
            this.squash.set(0.86);
            this.squash.kick(4.5);
            this.hop.kick(-80);
            this._play(combat
                ? [
                    { expr: 'espantado', dur: 0.5 },
                    { expr: 'desconfiado', dur: 0.55, lean: this.towardCenter },
                    { expr: 'raiva', dur: 1.1 }
                ]
                : [
                    { expr: 'espantado', dur: 0.3 },
                    { look: -1, dur: 0.45 },
                    { look: 1, dur: 0.45 },
                    { look: 'up', dur: 0.4 }
                ]);
        });
    }

    roomCleared(delay) {
        this._later(delay, () => {
            this.hop.kick(-50);
            this.squash.set(1.1);
            this._play([
                { expr: 'olhos_fechados', dur: 0.55 },
                { look: this.towardCenter, dur: 0.5 }
            ]);
        });
    }

    // Pausa: pulinho de "percebeu" e passa a olhar para cima (o menu); ao
    // voltar, outro pulinho e o idle recomeça.
    setPaused(paused, delay = 0) {
        if (paused === this.paused) return;
        this.paused = paused;
        this.seq = [];
        this.seqT = 0;
        this.idleWait = rand(1.5, 3);
        this._later(delay, () => {
            this.hop.kick(paused ? -40 : -25);
            this.squash.set(paused ? 1.1 : 0.92);
        });
    }

    healed() {
        this.hop.kick(-35);
        this.squash.set(1.08);
        this._play([{ expr: 'olhos_fechados', dur: 0.35 }]);
    }

    // ---- Simulação ----

    update(dt, player) {
        this.t += dt;
        const lives = player ? player.lives : MAX_LIVES;
        this.dead = lives <= 0;
        this.base = this.dead ? 'olhos_fechados' : (lives === 1 ? 'preocupado' : 'neutro');

        for (let i = this.pending.length - 1; i >= 0; i--) {
            const p = this.pending[i];
            p.t -= dt;
            if (p.t <= 0) { this.pending.splice(i, 1); p.fn(); }
        }

        // Sequência de expressões (reação ou olhada idle).
        if (this.seq.length) {
            this.seqT += dt;
            if (this.seqT >= this.seq[0].dur) {
                this.seq.shift();
                this.seqT = 0;
            }
        } else if (!this.dead && !this.paused) {
            // Idle: de tempos em tempos olha ao redor. Com 1 vida fica nervoso
            // (olhadas mais curtas e frequentes).
            this.idleWait -= dt;
            if (this.idleWait <= 0) {
                const nervous = lives === 1;
                const look = pick([-1, 1, -1, 1, 'up', 'sus']);
                this.seq = look === 'sus'
                    ? [{ expr: 'desconfiado', dur: rand(0.6, 1.1), idle: true }]
                    : [{ look, dur: nervous ? rand(0.3, 0.6) : rand(0.6, 1.3), idle: true }];
                this.seqT = 0;
                this.idleWait = nervous ? rand(0.5, 1.4) : rand(1.6, 4.0);
            }
        }

        // Piscada (curta, aleatória).
        if (this.blinking > 0) this.blinking -= dt;
        this.blinkT -= dt;
        if (this.blinkT <= 0) {
            this.blinking = 0.11;
            this.blinkT = Math.random() < 0.2 ? 0.25 : rand(2, 5); // às vezes pisca duplo
        }

        // Inclinação do olhar segue a direção da expressão atual.
        const step = this.seq[0];
        let leanTarget = 0;
        if (step) {
            if (typeof step.lean === 'number') leanTarget = step.lean;
            else if (step.look === -1 || step.look === 1) leanTarget = step.look;
        }
        this.lean.target = leanTarget;

        // Acompanha o boneco do jogo: anda -> balança e inclina junto.
        const speed = player?.speed || 4.2;
        const live = player && !this.dead && !this.paused;
        const moveAmt = live ? clamp((player.speedMag || 0) / speed, 0, 1) : 0;
        this.walkAmt += (moveAmt - this.walkAmt) * Math.min(1, dt * 8);
        this.walkPhase += dt * (4 + this.walkAmt * 7);
        const tiltTarget = live ? clamp((player.vx || 0) / speed, -1, 1) * 0.1 : 0;
        this.tilt += (tiltTarget - this.tilt) * Math.min(1, dt * 6);

        this.sink.target = this.dead ? 9 : 0;

        this.squash.update(dt);
        this.hop.update(dt);
        this.push.update(dt);
        this.lean.update(dt);
        this.sink.update(dt);

        this.trauma = Math.max(0, this.trauma - dt * 2.2);
        if (this.flashT > 0) this.flashT -= dt;
        if (this.redT > 0) this.redT -= dt;
    }

    // Expressão do quadro (prioridade: sequência > base; piscada por cima).
    _exprName() {
        const step = this.seq[0];
        let name = this.base;
        // Pausa: os dois olham para cima (para o menu), sem reações.
        if (this.paused && !this.dead) name = 'olhando_cima';
        else if (step) {
            if (step.expr) name = step.expr;
            else if (step.look === 'up') name = 'olhando_cima';
            else if (step.look === -1 || step.look === 1) {
                // Direção na TELA -> folha (o flip inverte esquerda/direita).
                const imgDir = this.flip ? -step.look : step.look;
                name = imgDir < 0 ? 'olhando_esquerda' : 'olhando_direita';
            }
        }
        const noBlink = name === 'espantado' || name === 'assustado' || name === 'olhos_fechados';
        if (this.blinking > 0 && !noBlink) name = 'olhos_fechados';
        return name;
    }

    _sheet(name) {
        const img = this.expressions[name];
        if (img && img.complete && img.naturalWidth > 0) return img;
        return this.walk; // fallback: folha base (frame 0 = parado)
    }

    /**
     * Desenha o busto. (ax, ay) = ponto da tela onde fica a BASE do sprite
     * (abaixo da borda); S = px de tela por px de arte.
     */
    draw(ctx, ax, ay, S) {
        const s = this.sprite;
        const img = this._sheet(this._exprName());
        if (!img || !img.complete || !img.naturalWidth) return;

        // Frame 0 (parado) da folha, recortado no buffer para tingir.
        const b = this._bctx;
        b.globalCompositeOperation = 'source-over';
        b.clearRect(0, 0, s.cropW, s.cropH);
        b.drawImage(img, s.cropX, s.cropY, s.cropW, s.cropH, 0, 0, s.cropW, s.cropH);
        let tint = null;
        if (this.flashT > 0) tint = 'rgba(255,255,255,1)';
        else if (this.redT > 0) tint = `rgba(220,30,50,${(this.redT / 0.45) * 0.55 * MOTION})`;
        else if (this.dead) tint = 'rgba(20,16,28,0.55)';
        if (tint) {
            b.globalCompositeOperation = 'source-atop';
            b.fillStyle = tint;
            b.fillRect(0, 0, s.cropW, s.cropH);
        }

        const t = this.t + this.seed;
        // Respiração: estica/encolhe leve, preservando volume.
        const breathHz = this.base === 'preocupado' ? 1.25 : 0.55;
        const breath = Math.sin(t * Math.PI * 2 * breathHz) * 0.022;
        const sy = this.squash.x * (1 + breath);
        const sx = (1 + (1 - this.squash.x) * 0.8) * (1 - breath * 0.6);

        // Balanço de pêndulo idle + inclinação do olhar + do andar + tremor.
        const tr = this.trauma * this.trauma * MOTION;
        const rot = Math.sin(t * 0.9) * 0.028
            + this.lean.x * 0.07
            + this.tilt
            + Math.sin(this.walkPhase) * 0.05 * this.walkAmt
            + Math.sin(t * 41) * 0.16 * tr;
        // Deslocamentos em px de arte (x S no fim).
        const dx = (this.lean.x * 1.2 + this.push.x + Math.sin(t * 57) * 2.2 * tr) * S;
        const bob = Math.abs(Math.sin(this.walkPhase)) * 1.4 * this.walkAmt;
        const dy = (this.hop.x + this.sink.x - bob + Math.sin(t * 0.7) * 0.3) * S;

        const w = s.cropW * S, h = s.cropH * S;
        ctx.save();
        ctx.translate(ax + dx, ay + dy);
        ctx.rotate(rot);                 // pivô na base (abaixo da tela)
        ctx.scale(sx, sy);
        if (this.flip) ctx.scale(-1, 1);
        ctx.drawImage(this._buf, -w / 2, -h, w, h);
        ctx.restore();
    }
}

/** Fileira de corações de um jogador. */
class HeartRow {
    constructor(dir) {
        this.dir = dir; // +1 = cresce para a direita; -1 = para a esquerda
        this.reset(MAX_LIVES);
    }

    reset(lives) {
        this.t = Math.random() * 10;
        this.slots = Array.from({ length: MAX_LIVES }, (_, i) => ({
            full: i < lives,
            scale: new Spring(1, 380, 14),
            shake: 0
        }));
        this.debris = [];
        this.lives = lives;
    }

    // Vidas mudaram: racha os corações perdidos / acende os recuperados.
    setLives(lives) {
        lives = clamp(lives, 0, MAX_LIVES);
        if (lives < this.lives) {
            for (let i = this.lives - 1; i >= lives; i--) this._break(i, this.slotPos(i));
            for (let i = 0; i < lives; i++) this.slots[i].shake = 0.4;
        } else if (lives > this.lives) {
            for (let i = this.lives; i < lives; i++) {
                const sl = this.slots[i];
                sl.full = true;
                sl.scale.set(0.2);
                sl.scale.kick(12);
            }
        }
        this.lives = lives;
    }

    _break(i, p) {
        const sl = this.slots[i];
        sl.full = false;
        sl.scale.set(1.45);
        sl.shake = 0.35;
        // Duas metades voam para lados opostos e caem girando.
        for (const [frame, side] of [[HEART_FRAME.HALF_L, -1], [HEART_FRAME.HALF_R, 1]]) {
            // Unidades: px de arte do coração (multiplicados por hs no draw).
            this.debris.push({
                frame, x: p.x + side * 2, y: p.y,
                vx: side * rand(25, 45), vy: rand(-95, -70),
                rot: 0, vr: side * rand(4, 7), life: 0.9
            });
        }
    }

    update(dt) {
        this.t += dt;
        for (const sl of this.slots) {
            sl.scale.update(dt);
            if (sl.shake > 0) sl.shake = Math.max(0, sl.shake - dt);
        }
        for (let i = this.debris.length - 1; i >= 0; i--) {
            const d = this.debris[i];
            d.vy += 320 * dt;           // gravidade (px de arte/s²)
            d.x += d.vx * dt;
            d.y += d.vy * dt;
            d.rot += d.vr * dt;
            d.life -= dt;
            if (d.life <= 0) this.debris.splice(i, 1);
        }
    }

    // Centro do slot i em px de arte do coração, relativo a (x0, y0).
    slotPos(i) {
        return { x: this.dir * (i * (HEART_ART + 2) + HEART_ART / 2), y: 0 };
    }

    // (x0, y0) = início da fileira (lado do busto); hs = px de tela por px de arte.
    draw(ctx, img, x0, y0, hs) {
        if (!img || !img.complete || !img.naturalWidth) return;
        const size = HEART_ART * hs;
        const step = (HEART_ART + 2) * hs;
        this.slots.forEach((sl, i) => {
            const cx = x0 + this.dir * (i * step + size / 2);
            // Bob ondulado (cada coração em fase diferente).
            let cy = y0 + Math.sin(this.t * 2.4 - i * 0.8) * hs * 0.5;
            let sc = sl.scale.x;
            // Com 1 vida, o último coração bate (tum-tum).
            if (sl.full && this.lives === 1) {
                const ph = (this.t * 1.1) % 1;
                const beat = Math.exp(-((ph - 0.08) ** 2) / 0.002) + 0.7 * Math.exp(-((ph - 0.26) ** 2) / 0.002);
                sc += beat * 0.16 * MOTION;
            }
            let rx = 0, rr = 0;
            if (sl.shake > 0) {
                const k = (sl.shake / 0.4) * MOTION;
                rx = Math.sin(this.t * 70 + i) * hs * 1.2 * k;
                rr = Math.sin(this.t * 53 + i) * 0.18 * k;
            }
            ctx.save();
            ctx.translate(Math.round(cx + rx), Math.round(cy));
            ctx.rotate(rr);
            ctx.scale(sc, sc);
            const frame = sl.full ? HEART_FRAME.FULL : HEART_FRAME.EMPTY;
            ctx.drawImage(img, frame * HEART_ART, 0, HEART_ART, HEART_ART, -size / 2, -size / 2, size, size);
            ctx.restore();
        });

        // Metades do coração quebrado (posições em px de arte * hs).
        for (const d of this.debris) {
            ctx.save();
            ctx.globalAlpha = clamp(d.life / 0.3, 0, 1);
            ctx.translate(x0 + d.x * hs, y0 + d.y * hs);
            ctx.rotate(d.rot);
            ctx.drawImage(img, d.frame * HEART_ART, 0, HEART_ART, HEART_ART, -size / 2, -size / 2, size, size);
            ctx.restore();
        }
    }
}

export class VtuberHud {
    /**
     * @param {object} o
     * @param {AssetLoader} o.assets
     * @param {() => Player[]} o.getPlayers  [p1, p2] atuais (recriados no restart)
     * @param {object[]} o.spriteConfigs    configs de sprite de p1 e p2 (EntityConfig)
     * @param {string[]} o.colors           cor de cada jogador
     */
    constructor({ assets, getPlayers, spriteConfigs, colors }) {
        this.assets = assets;
        this.getPlayers = getPlayers;
        this.heartImg = assets.get('heart');
        // P1 no canto ESQUERDO, P2 no DIREITO; corações apontam para o centro.
        const dirs = ['player_01', 'player_02'];
        const sides = ['left', 'right'];
        this.entries = spriteConfigs.map((sprite, i) => {
            const expressions = {};
            for (const [key, img] of Object.entries(assets.images)) {
                const prefix = `${dirs[i]}_expr_`;
                if (key.startsWith(prefix)) expressions[key.slice(prefix.length)] = img;
            }
            const side = sides[i];
            return {
                side,
                color: colors[i],
                label: this._makeLabel(`P${i + 1}`, colors[i]),
                portrait: new Portrait({ side, sprite, walk: assets.get(i === 0 ? 'p1' : 'p2'), expressions }),
                hearts: new HeartRow(side === 'left' ? 1 : -1),
                player: null,
                seen: MAX_LIVES,
                layout: null
            };
        });
        this._last = null;
    }

    // Rótulo "P1"/"P2" em PixelFont (canvas de arte, ampliado no draw).
    _makeLabel(text, color) {
        const c = document.createElement('canvas');
        c.width = measureText(text) + 1;
        c.height = 7;
        const g = c.getContext('2d');
        drawText(g, text, 1, 2, '#0b0910');
        drawText(g, text, 0, 1, color);
        return c;
    }

    // Reinício: zera reações e sincroniza corações com as vidas atuais.
    reset() {
        const players = this.getPlayers() || [];
        this.entries.forEach((e, i) => {
            const p = players[i];
            e.player = p || null;
            e.seen = p ? p.lives : MAX_LIVES;
            e.portrait.reset();
            e.hearts.reset(e.seen);
        });
    }

    // Entrou em uma sala (combat = sala com inimigos a enfrentar).
    onRoomEnter(combat) {
        this.entries.forEach((e, i) => e.portrait.roomEnter(combat, i * 0.09));
    }

    // Jogo pausado/retomado: os retratos olham para o menu (escalonados).
    setPaused(paused) {
        this.entries.forEach((e, i) => e.portrait.setPaused(!!paused, i * 0.07));
    }

    onRoomCleared() {
        this.entries.forEach((e, i) => e.portrait.roomCleared(0.15 + i * 0.1));
    }

    // Layout responsivo: escala inteira a partir da menor dimensão útil.
    _layout(W, H) {
        const ref = Math.min(H, W * 0.6);
        const S = Math.max(4, Math.round((ref * 0.3) / 23));   // sprite ~30% da altura
        const hs = Math.max(2, Math.round(S * 0.38));           // coração
        const margin = Math.round(Math.max(10, S * 1.5));
        return { S, hs, margin };
    }

    draw(ctx, W, H) {
        const now = performance.now();
        const dt = this._last === null ? 0 : Math.min(0.05, (now - this._last) / 1000);
        this._last = now;

        const players = this.getPlayers() || [];
        const { S, hs, margin } = this._layout(W, H);

        // 1) Detecta trocas de jogador (restart) e mudanças de vida.
        this.entries.forEach((e, i) => {
            const p = players[i];
            if (p !== e.player) {
                e.player = p || null;
                e.seen = p ? p.lives : MAX_LIVES;
                e.portrait.reset();
                e.hearts.reset(e.seen);
            }
        });
        this.entries.forEach((e, i) => {
            const p = e.player;
            if (!p) return;
            const lives = clamp(p.lives, 0, MAX_LIVES);
            if (lives !== e.seen) {
                if (lives < e.seen) {
                    e.portrait.hurt();
                    this.entries[1 - i]?.portrait.partnerHurt();
                } else {
                    e.portrait.healed();
                }
                e.hearts.setLives(lives);
                e.seen = lives;
            }
        });

        // 2) Atualiza e desenha.
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.imageSmoothingEnabled = false;

        for (const e of this.entries) {
            e.portrait.update(dt, e.player);
            e.hearts.update(dt);

            const sp = e.portrait.sprite;
            const bustW = sp.cropW * S;
            const left = e.side === 'left';
            const ax = left ? margin + bustW / 2 : W - margin - bustW / 2;
            const ay = H + BELOW_EDGE_ROWS * S;

            // Halo na cor do jogador atrás do busto (destaca do cenário).
            const gx = ax, gy = H - 8 * S, gr = 22 * S;
            const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
            grad.addColorStop(0, 'rgba(5,4,10,0.6)');
            grad.addColorStop(0.55, 'rgba(5,4,10,0.35)');
            grad.addColorStop(1, 'rgba(5,4,10,0)');
            ctx.fillStyle = grad;
            ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
            const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr * 0.7);
            glow.addColorStop(0, hexA(e.color, 0.22));
            glow.addColorStop(1, hexA(e.color, 0));
            ctx.fillStyle = glow;
            ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);

            e.portrait.draw(ctx, ax, ay, S);

            // Corações ao lado do busto, voltados para o centro da tela.
            const gap = 2 * S;
            const x0 = left ? ax + bustW / 2 + gap : ax - bustW / 2 - gap;
            const y0 = H - margin - (HEART_ART * hs) / 2 - S * 2;
            e.hearts.draw(ctx, this.heartImg, x0, y0, hs);

            // Rótulo P1/P2 acima dos corações, alinhado ao lado do busto.
            const lw = e.label.width * hs, lh = e.label.height * hs;
            const lx = left ? x0 : x0 - lw;
            const ly = y0 - (HEART_ART * hs) / 2 - lh - hs;
            ctx.drawImage(e.label, Math.round(lx), Math.round(ly), lw, lh);
        }
        ctx.restore();
    }
}

// "#rrggbb" + alfa -> rgba().
function hexA(hex, a) {
    const n = parseInt(String(hex).slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
