/**
 * RoomTiles — monta o mapa de tiles de uma sala (autotiling) usando o tileset.
 *
 * Gera, de forma DETERMINÍSTICA por sala (mesma sala => mesmo layout), uma
 * grade de índices de tile: moldura de parede com cantos/beiras corretos,
 * piso com variação, vãos de porta e props decorativos encostados nas paredes.
 *
 * Índices (mapeados a partir do tileset fornecido, grade 10x10):
 *   Cantos parede:  0=NO 5=NE 40=SO 45=SE
 *   Parede topo:    1,2,3,4      Parede base: 41,42,43,44
 *   Parede esq:     10,20,30     Parede dir:  15,25,35
 *   Piso beira topo:      12,13   cantos-topo do piso: 11,14
 *   Piso beira lados:     21(esq),24(dir)
 *   Piso beira base:      32,33   cantos-base do piso:  31,34
 *   Piso central (var):   6,7,8,9,16,17,18,19,26,27,28,29
 *   Porta (vão):          66(arred. esq central), 67(arred. dir central)
 *   Props:                49,59(rochas) 77(caveira) 68(ossos) 65(teia peq) 64(teia grande)
 */

import { TORCHES } from '../config/GameConfig.js';

const FLOOR_VARIANTS = [6, 7, 8, 9, 16, 17, 18, 19, 26, 27, 28, 29];
const PROPS = [49, 59, 77, 68, 65, 64];

// RNG determinístico simples (mulberry32) a partir de uma seed.
function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export class RoomTiles {
    /**
     * @param {number} cols nº de tiles na largura da sala
     * @param {number} rows nº de tiles na altura da sala
     * @param {object} doors { N,S,E,W: bool } quais lados têm porta
     * @param {number} seed  semente determinística (da posição da sala)
     * @param {boolean} decorate  gera props (salas sim, corredores menos)
     */
    constructor(cols, rows, doors, seed, decorate = true) {
        this.cols = cols;
        this.rows = rows;
        this.doors = doors || {};
        this.rng = makeRng(seed);
        this._decorate = decorate;

        this.floor = [];       // matriz de índices do piso/parede
        this.props = [];        // [{ col, row, index }]
        this.doorCells = [];    // [{ col, row, index }] células de porta (p/ estado fechado)
        this.torches = [];      // [{ col, row }] tochas na parede norte (pontos de luz)
        this._build(decorate);
    }

    _pick(arr) { return arr[(this.rng() * arr.length) | 0]; }

    _build(decorate) {
        const C = this.cols, R = this.rows;
        const last = C - 1, bottom = R - 1;

        for (let r = 0; r < R; r++) {
            const line = [];
            for (let c = 0; c < C; c++) {
                line.push(this._tileAt(c, r, last, bottom));
            }
            this.floor.push(line);
        }

        // Abre os vãos de porta no meio de cada lado com porta
        this._openDoors(last, bottom);

        if (decorate) {
            this._scatterProps(last, bottom);
            this._placeTorches(last, bottom);
        }
    }

    /**
     * Sorteia de minPerWall a maxPerWall posições DISTINTAS de uma lista de
     * candidatos (determinístico pela seed), respeitando o gap mínimo entre
     * elas. Usado para distribuir tochas em qualquer parede.
     */
    _chooseTorchSlots(candidates, minGap) {
        if (candidates.length === 0) return [];
        const span = TORCHES.maxPerWall - TORCHES.minPerWall + 1;
        const count = TORCHES.minPerWall + ((this.rng() * span) | 0);

        const shuffled = candidates.slice();
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = (this.rng() * (i + 1)) | 0;
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        const chosen = [];
        for (const v of shuffled) {
            if (chosen.length >= count) break;
            if (chosen.every(ch => Math.abs(ch - v) >= minGap)) chosen.push(v);
        }
        chosen.sort((a, b) => a - b);
        return chosen;
    }

    /**
     * Coloca tochas nas paredes NORTE e LATERAIS (esq/dir), em posições
     * variadas (determinísticas pela seed), evitando quinas e os vãos de porta.
     * As tochas vão em this.props (desenhadas SOBRE o cenário, sem removê-lo) e
     * em this.torches (para o Game emitir luz; cada uma guarda o lado).
     */
    _placeTorches(last, bottom) {
        if (!TORCHES.enabled) return;
        if (TORCHES.onlyCombatRooms && !this._decorate) return;

        this._placeNorthTorches(last);
        if (TORCHES.sides && TORCHES.sides.enabled) this._placeSideTorches(last, bottom);
    }

    // Parede NORTE (fileira r=0): tile TORCHES.index colado na parede.
    _placeNorthTorches(last) {
        const margin = TORCHES.marginTiles;
        const minGap = Math.max(1, TORCHES.minGap);

        const midC = (this.cols / 2) | 0;
        const doorCols = this.doors.N ? new Set([midC - 1, midC]) : new Set();
        const candidates = [];
        for (let c = margin; c <= last - margin; c++) {
            if (!doorCols.has(c)) candidates.push(c);
        }

        for (const c of this._chooseTorchSlots(candidates, minGap)) {
            // Prop desenhado SOBRE a parede norte (não substitui o tile).
            this.props.push({ col: c, row: 0, index: TORCHES.index });
            this.torches.push({ col: c, row: 0, side: "N" });
        }
    }

    /**
     * Paredes LATERAIS: tile TORCHES.sideIndex no PISO à frente da parede
     * (coluna interna adjacente — 1 à esquerda, last-1 à direita). Evita as
     * quinas (linhas de topo/base) e o vão da porta lateral. Na parede DIREITA
     * o tile é espelhado (flip), pois o 91 encaixa na esquerda por padrão.
     */
    _placeSideTorches(last, bottom) {
        const margin = TORCHES.marginTiles;
        const minGap = Math.max(1, TORCHES.minGap);
        const midR = (this.rows / 2) | 0;

        // Linhas candidatas: entre as margens (afasta das quinas) e fora do vão
        // da porta lateral. O eixo vertical é curto (salas são mais baixas que
        // largas), então usamos a própria margem sem folga extra.
        const buildRowCandidates = (hasDoor) => {
            const doorRows = hasDoor ? new Set([midR - 1, midR]) : new Set();
            const rows = [];
            for (let r = margin; r <= bottom - margin; r++) {
                if (!doorRows.has(r)) rows.push(r);
            }
            return rows;
        };

        if (TORCHES.sides.left) {
            const col = 1; // piso logo à frente da parede esquerda (coluna 0)
            for (const r of this._chooseTorchSlots(buildRowCandidates(this.doors.W), minGap)) {
                this.props.push({ col, row: r, index: TORCHES.sideIndex, flip: false });
                this.torches.push({ col, row: r, side: "W" });
            }
        }
        if (TORCHES.sides.right) {
            const col = last - 1; // piso logo à frente da parede direita
            for (const r of this._chooseTorchSlots(buildRowCandidates(this.doors.E), minGap)) {
                // Espelhado: o tile 91 encaixa na esquerda por padrão.
                this.props.push({ col, row: r, index: TORCHES.sideIndex, flip: true });
                this.torches.push({ col, row: r, side: "E" });
            }
        }
    }

    // Escolhe o tile de parede/piso para (c,r) conforme a posição na moldura.
    _tileAt(c, r, last, bottom) {
        // Cantos da parede
        if (r === 0 && c === 0) return 0;
        if (r === 0 && c === last) return 5;
        if (r === bottom && c === 0) return 40;
        if (r === bottom && c === last) return 45;

        // Bordas de parede
        if (r === 0) return this._pick([1, 2, 3, 4]);
        if (r === bottom) return this._pick([41, 42, 43, 44]);
        if (c === 0) return this._pick([10, 20, 30]);
        if (c === last) return this._pick([15, 25, 35]);

        // Beiras do piso (primeira/última fileira jogável)
        const topRow = 1, botRow = bottom - 1, leftCol = 1, rightCol = last - 1;
        if (r === topRow && c === leftCol) return 11;
        if (r === topRow && c === rightCol) return 14;
        if (r === botRow && c === leftCol) return 31;
        if (r === botRow && c === rightCol) return 34;
        if (r === topRow) return this._pick([12, 13]);
        if (r === botRow) return this._pick([32, 33]);
        if (c === leftCol) return 21;
        if (c === rightCol) return 24;

        // Piso central com variação
        return this._pick(FLOOR_VARIANTS);
    }

    _openDoors(last, bottom) {
        // O vão da porta fica ABERTO (piso), indicando caminho livre. Os tiles
        // de porta só são desenhados quando a sala está TRANCADA (no Renderer).
        // TODAS as portas ocupam 2 tiles:
        //   N (topo):  66 (esq) + 67 (dir)
        //   S (base):  36 (esq) + 37 (dir)
        //   W (esq):   47 (topo) + 57 (base)   -- vertical
        //   E (dir):   48 (topo) + 58 (base)   -- vertical
        const midC = (this.cols / 2) | 0;
        const midR = (this.rows / 2) | 0;

        // No vão colocamos PISO (passagem). Quando a sala está ABERTA, o
        // gradiente (corredor escuro) é desenhado por cima; quando TRANCADA,
        // o tile de porta tapa o vão. Guardamos em doorCells o índice do tile
        // de porta (fechada) e a posição.
        if (this.doors.N) {
            this.floor[0][midC - 1] = this._pick(FLOOR_VARIANTS);
            this.floor[0][midC] = this._pick(FLOOR_VARIANTS);
            this.doorCells.push({ col: midC - 1, row: 0, index: 36 }, { col: midC, row: 0, index: 37 });
        }
        if (this.doors.S) {
            this.floor[bottom][midC - 1] = this._pick(FLOOR_VARIANTS);
            this.floor[bottom][midC] = this._pick(FLOOR_VARIANTS);
            this.doorCells.push({ col: midC - 1, row: bottom, index: 36 }, { col: midC, row: bottom, index: 37 });
        }
        if (this.doors.W) {
            this.floor[midR - 1][0] = this._pick(FLOOR_VARIANTS);
            this.floor[midR][0] = this._pick(FLOOR_VARIANTS);
            this.doorCells.push({ col: 0, row: midR - 1, index: 47 }, { col: 0, row: midR, index: 57 });
        }
        if (this.doors.E) {
            this.floor[midR - 1][last] = this._pick(FLOOR_VARIANTS);
            this.floor[midR][last] = this._pick(FLOOR_VARIANTS);
            this.doorCells.push({ col: last, row: midR - 1, index: 48 }, { col: last, row: midR, index: 58 });
        }

        // Na entrada de cada porta, as células INTERNAS adjacentes ao vão não
        // devem ser "beira de parede" (piso de canto/borda): viram piso central
        // liso, para a passagem não ter aquele degrau estranho.
        const topRow = 1, botRow = bottom - 1, leftCol = 1, rightCol = last - 1;
        if (this.doors.N) {
            this.floor[topRow][midC - 1] = this._pick(FLOOR_VARIANTS);
            this.floor[topRow][midC] = this._pick(FLOOR_VARIANTS);
        }
        if (this.doors.S) {
            this.floor[botRow][midC - 1] = this._pick(FLOOR_VARIANTS);
            this.floor[botRow][midC] = this._pick(FLOOR_VARIANTS);
        }
        if (this.doors.W) {
            this.floor[midR - 1][leftCol] = this._pick(FLOOR_VARIANTS);
            this.floor[midR][leftCol] = this._pick(FLOOR_VARIANTS);
        }
        if (this.doors.E) {
            this.floor[midR - 1][rightCol] = this._pick(FLOOR_VARIANTS);
            this.floor[midR][rightCol] = this._pick(FLOOR_VARIANTS);
        }
    }

    // Uma célula (col,row) é de porta? (para evitar props em cima delas)
    _isDoorCell(col, row) {
        return this.doorCells.some(d => d.col === col && d.row === row);
    }

    // A célula está imediatamente à frente de um vão de porta? (corredor de
    // entrada que deve ficar livre de props)
    _blocksDoorPath(col, row) {
        for (const d of this.doorCells) {
            // Uma célula "à frente" tem a mesma coluna (portas N/S) ou mesma
            // linha (portas E/W) e está a 1-2 tiles do vão para dentro da sala.
            if (d.col === col && Math.abs(d.row - row) <= 2) return true;
            if (d.row === row && Math.abs(d.col - col) <= 2) return true;
        }
        return false;
    }

    // Espalha props encostados nas paredes (determinístico).
    _scatterProps(last, bottom) {
        const tries = 6 + ((this.rng() * 5) | 0);
        for (let i = 0; i < tries; i++) {
            // Escolhe uma célula de piso próxima da parede (primeira fileira interna)
            const edge = (this.rng() * 4) | 0;
            let c, r;
            if (edge === 0) { r = 1; c = 2 + ((this.rng() * (this.cols - 4)) | 0); }
            else if (edge === 1) { r = bottom - 1; c = 2 + ((this.rng() * (this.cols - 4)) | 0); }
            else if (edge === 2) { c = 1; r = 2 + ((this.rng() * (this.rows - 4)) | 0); }
            else { c = last - 1; r = 2 + ((this.rng() * (this.rows - 4)) | 0); }

            // Não põe prop em cima de porta nem no caminho dela (célula do vão
            // ou a célula logo à frente do vão, para não bloquear a passagem).
            if (this._isDoorCell(c, r)) continue;
            if (this._blocksDoorPath(c, r)) continue;

            this.props.push({ col: c, row: r, index: this._pick(PROPS) });
        }
    }
}
