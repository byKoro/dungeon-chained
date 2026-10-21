/**
 * Perigos REAIS do jogo dentro de uma ActionArena (clipes do Bloco 3):
 * espinhos (SpikeTrap), atiradores de flecha (ArrowTrap + Arrow) e botões
 * de pressão (PressureButton) — as mesmas classes do ChallengeCorridor, com o
 * mesmo dano (Player.takeDamage) e as mesmas animações.
 *
 * Também traz a QUEDA COM RESISTÊNCIA na beirada do buraco (HOLE_FALL), uma
 * cópia fiel de DungeonTileQuery.checkHoleFalls usando a grade da arena.
 */
import { TILE, HOLE_FALL, HOLE_TILE } from '../../config/GameConfig.js';
import { SpikeTrap } from '../../entities/SpikeTrap.js';
import { ArrowTrap } from '../../entities/ArrowTrap.js';
import { PressureButton } from '../../entities/PressureButton.js';

const STEP = 1 / 60;

/** Centro do tile (col, row) em px de mundo. */
export const tileCenter = (c, r) => ({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 });

export class ArenaHazards {
    /** @param {ActionArena} A */
    constructor(A) {
        this.A = A;
        this.assets = A.stage.assets;
        this.specs = { spikes: [], traps: [], buttons: [] };
        this.spikes = [];
        this.traps = [];
        this.arrows = [];
        this.buttons = [];
        this.onArrowFire = null;   // (trap) => void
    }

    /**
     * Espinho no tile (col,row). `upAt` = s de simulação em que ele fica
     * LETAL (frame 2): a fase é calculada a partir do ciclo real.
     * durations = [escondido, subindo, subindo, exposto] em s (padrão do jogo).
     */
    spike(col, row, { upAt = null, phase = 0, durations = [1, 0.15, 0.15, 2] } = {}) {
        this.specs.spikes.push({ col, row, upAt, phase, durations });
        return this;
    }

    /**
     * Atirador na parede: side 'W'|'E'|'N'|'S' (parede onde está), na linha
     * (W/E) ou coluna (N/S) `at`. `fireAt` = s de simulação do 1º disparo.
     */
    trap(side, at, { fireAt = 0.5 } = {}) {
        this.specs.traps.push({ side, at, fireAt });
        return this;
    }

    button(col, row) {
        this.specs.buttons.push({ col, row });
        return this;
    }

    /** (Re)cria as entidades no estado inicial (chamado a cada start). */
    reset() {
        const a = this.assets, A = this.A;
        this.spikes = this.specs.spikes.map(s => {
            const p = tileCenter(s.col, s.row);
            const cycle = s.durations.reduce((x, y) => x + y, 0);
            const lethal = s.durations[0] + s.durations[1] + s.durations[2];
            let phase = s.phase;
            if (s.upAt !== null) phase = ((((lethal - s.upAt) % cycle) + cycle) % cycle) / cycle;
            return new SpikeTrap(p.x, p.y, a.peaks, { phaseOffset: phase, durations: s.durations });
        });
        this.traps = this.specs.traps.map(s => {
            let x, y, dir;
            if (s.side === 'W') { x = 46; y = s.at * TILE + TILE / 2; dir = { x: 1, y: 0 }; }
            else if (s.side === 'E') { x = (A.cols - 1) * TILE + 18; y = s.at * TILE + TILE / 2; dir = { x: -1, y: 0 }; }
            else if (s.side === 'N') { x = s.at * TILE + TILE / 2; y = 40; dir = { x: 0, y: 1 }; }
            else { x = s.at * TILE + TILE / 2; y = (A.rows - 1) * TILE + 24; dir = { x: 0, y: -1 }; }
            const t = new ArrowTrap(x, y, dir, { sprites: a.arrowTrap, arrowSprite: a.arrow });
            // Fase para disparar em `fireAt` (mesma conta do ArrowTrap.update).
            const launch = t.intervalSeconds - t.warnSeconds * 0.25;
            t.elapsed = ((((launch - s.fireAt) % t.intervalSeconds) + t.intervalSeconds) % t.intervalSeconds);
            return t;
        });
        this.arrows = [];
        this.buttons = this.specs.buttons.map(s => {
            const p = tileCenter(s.col, s.row);
            return new PressureButton(p.x, p.y, { sprite: a.button });
        });
    }

    update(players) {
        const A = this.A;
        for (const s of this.spikes) s.update(players, STEP);
        for (const t of this.traps) {
            t.update((arrow) => this.arrows.push(arrow), STEP);
            if (t.justFired) {
                A.sfx('arrow', t.x, t.y, { vol: 0.5, cool: 0.05 });
                this.onArrowFire?.(t);
            }
        }
        for (let i = this.arrows.length - 1; i >= 0; i--) {
            const ar = this.arrows[i];
            ar.update(players, A.bounds, STEP);
            if (ar.dead) {
                // Crava na parede: poeira + "thunk".
                if (ar.lifeSeconds > 0) {
                    A.particles.triggerDust(ar.x, ar.y, -Math.sign(ar.dx), -Math.sign(ar.dy), 5);
                    A.sfx('thunk', ar.x, ar.y, { vol: 0.35, cool: 0.05 });
                }
                this.arrows.splice(i, 1);
            }
        }
        for (const b of this.buttons) {
            b.update(players);
            if (b.justPressed) this._buttonDust(b);
        }
    }

    // Poeira radial na borda da base (igual ao Game._buttonFeedback).
    _buttonDust(b) {
        const n = 8;
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
            const cx = Math.cos(a), cy = Math.sin(a);
            this.A.particles.triggerDust(b.x + cx * 26, b.y + 14 + cy * 12, -cx, -cy, 2);
        }
    }

    drawFloor(ctx) {
        for (const s of this.spikes) s.draw(ctx);
        for (const b of this.buttons) b.draw(ctx);
    }

    drawTop(ctx) {
        for (const t of this.traps) t.draw(ctx);
        for (const a of this.arrows) a.draw(ctx);
    }
}

// ---------------------------------------------------------------------------
// Queda no buraco com RESISTÊNCIA (cópia de DungeonTileQuery.checkHoleFalls,
// com a grade da arena: retângulo em (0,0), moldura de parede de 1 tile).

function tileValue(A, c, r) {
    const line = A.tiles.floor[r];
    return line ? line[c] : undefined;
}

function walkable(A, c, r) {
    const v = tileValue(A, c, r);
    if (v === undefined || v < 0) return false;
    return c > 0 && r > 0 && c < A.cols - 1 && r < A.rows - 1;
}

/** Profundidade de (x,y) dentro de um buraco (null = fora de buraco). */
export function holeDepth(A, x, y) {
    const col = Math.floor(x / TILE), row = Math.floor(y / TILE);
    if (tileValue(A, col, row) !== HOLE_TILE) return null;
    let best = Infinity, bx = 0, by = 0;
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            const c = col + dc, r = row + dr;
            if (!walkable(A, c, r)) continue;
            const left = c * TILE, top = r * TILE;
            const px = Math.max(left, Math.min(left + TILE, x));
            const py = Math.max(top, Math.min(top + TILE, y));
            const d = Math.hypot(px - x, py - y);
            if (d < best) { best = d; bx = px - x; by = py - y; }
        }
    }
    if (best === Infinity) return { depth: Infinity, nx: 0, ny: 0, col, row };
    const len = best || 1;
    return { depth: best, nx: bx / len, ny: by / len, col, row };
}

/**
 * Um passo da resistência na beirada para os jogadores da arena. Mesmas
 * regras do jogo: freia a velocidade PARA DENTRO, empurra de volta ao piso e
 * só cai quem fica além da beirada por `graceFrames` passos seguidos.
 * Grava em cada jogador `holeDepth` (px) e `holeGrace` (passos). Devolve a
 * lista dos que começaram a cair neste passo.
 */
export function holeStep(A, players) {
    const { edgeMargin, inwardDamping, pushBack, graceFrames, footOffset = 0 } = HOLE_FALL;
    const fell = [];
    for (const p of players) {
        if (p.falling) continue;
        const h = holeDepth(A, p.x, p.y + footOffset);
        if (!h) { p.holeGrace = 0; p.holeDepth = 0; continue; }
        p.holeDepth = h.depth;
        const beyond = h.depth > edgeMargin;
        p.holeGrace = beyond ? (p.holeGrace ?? 0) + 1 : 0;
        if (beyond && p.holeGrace >= graceFrames) {
            p.holeGrace = 0;
            p.startFalling((h.col + 0.5) * TILE, (h.row + 0.5) * TILE);
            fell.push(p);
            continue;
        }
        if (h.nx === 0 && h.ny === 0) continue;
        const inward = -(p.vx * h.nx + p.vy * h.ny);
        if (inward > 0) {
            const cut = inward * (1 - inwardDamping);
            p.vx += h.nx * cut;
            p.vy += h.ny * cut;
        }
        const k = Math.max(0.35, Math.min(1, h.depth / edgeMargin));
        const push = Math.min(h.depth + 0.5, pushBack * k);
        p.x += h.nx * push;
        p.y += h.ny * push;
    }
    return fell;
}
