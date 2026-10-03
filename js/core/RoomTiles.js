/**
 * RoomTiles — monta o mapa de tiles de uma sala (autotiling) usando o tileset.
 *
 * Gera, de forma DETERMINÍSTICA por sala (mesma sala => mesmo layout), uma
 * grade de índices de tile: moldura de parede com cantos/beiras corretos,
 * piso base liso e vãos de porta.
 *
 * Índices (mapeados a partir do tileset fornecido, grade 10x10):
 *   Cantos parede:  0=NO 5=NE 40=SO 45=SE
 *   Parede topo:    1,2,3,4      Parede base: 41,42,43,44
 *   Parede esq:     10,20,30     Parede dir:  15,25,35
 *   Piso beira topo:      12,13   cantos-topo do piso: 11,14
 *   Piso beira lados:     21(esq),24(dir)
 *   Piso beira base:      32,33   cantos-base do piso:  31,34
 *   Piso central:         16 (liso fixo — sem variação aleatória)
 *   Porta (vão):          36/37 (base), 66/67 (topo), 47/57 (W), 48/58 (E)
 *
 * NOTA: tochas, props, inimigos e perigos NÃO são mais gerados aqui. Todo o
 * conteúdo é AUTORAL (peças desenhadas no editor, em /map). Este módulo produz
 * apenas a MOLDURA + PISO BASE determinístico, usado como fallback liso quando
 * não existe peça autoral para a forma de portas.
 */

export class RoomTiles {
    /**
     * @param {number} cols nº de tiles na largura da sala
     * @param {number} rows nº de tiles na altura da sala
     * @param {object} doors { N,S,E,W: bool } quais lados têm porta
     * @param {number} [seed]  (não usado — mantido por compatibilidade de assinatura)
     * @param {boolean} [decorate]  (não usado — mantido por compatibilidade)
     */
    constructor(cols, rows, doors, seed, decorate = true) {
        this.cols = cols;
        this.rows = rows;
        this.doors = doors || {};
        this._decorate = decorate;

        this.floor = [];       // matriz de índices do piso/parede
        this.props = [];        // [{ col, row, index }] — preenchido pela peça autoral
        this.doorCells = [];    // [{ col, row, index }] células de porta (p/ estado fechado)
        this.torches = [];      // [{ col, row, side }] — preenchido pela peça autoral
        this._build(decorate);
    }

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

        // NOTA: tochas e props NÃO são mais gerados proceduralmente aqui. O
        // conteúdo (tochas, props, inimigos, perigos) é todo autoral, vindo da
        // peça desenhada no editor (ver RoomCatalog / arquivos em /map). Este
        // RoomTiles produz apenas a MOLDURA + PISO BASE determinístico, usado
        // como fallback quando não há peça autoral para a forma de portas.
    }

    // Escolhe o tile de parede/piso para (c,r) conforme a posição na moldura.
    // Determinístico e FIXO (sem variação aleatória): este layout é apenas o
    // fallback liso. O conteúdo rico vem das peças autorais do editor.
    _tileAt(c, r, last, bottom) {
        // Cantos da parede
        if (r === 0 && c === 0) return 0;
        if (r === 0 && c === last) return 5;
        if (r === bottom && c === 0) return 40;
        if (r === bottom && c === last) return 45;

        // Bordas de parede (tiles fixos)
        if (r === 0) return 2;
        if (r === bottom) return 42;
        if (c === 0) return 20;
        if (c === last) return 25;

        // Beiras do piso (primeira/última fileira jogável)
        const topRow = 1, botRow = bottom - 1, leftCol = 1, rightCol = last - 1;
        if (r === topRow && c === leftCol) return 11;
        if (r === topRow && c === rightCol) return 14;
        if (r === botRow && c === leftCol) return 31;
        if (r === botRow && c === rightCol) return 34;
        if (r === topRow) return 12;
        if (r === botRow) return 32;
        if (c === leftCol) return 21;
        if (c === rightCol) return 24;

        // Piso central liso (tile fixo)
        return 16;
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
        const FLOOR = 16; // piso liso fixo (sem variação aleatória)
        if (this.doors.N) {
            this.floor[0][midC - 1] = FLOOR;
            this.floor[0][midC] = FLOOR;
            this.doorCells.push({ col: midC - 1, row: 0, index: 36 }, { col: midC, row: 0, index: 37 });
        }
        if (this.doors.S) {
            this.floor[bottom][midC - 1] = FLOOR;
            this.floor[bottom][midC] = FLOOR;
            this.doorCells.push({ col: midC - 1, row: bottom, index: 36 }, { col: midC, row: bottom, index: 37 });
        }
        if (this.doors.W) {
            this.floor[midR - 1][0] = FLOOR;
            this.floor[midR][0] = FLOOR;
            this.doorCells.push({ col: 0, row: midR - 1, index: 47 }, { col: 0, row: midR, index: 57 });
        }
        if (this.doors.E) {
            this.floor[midR - 1][last] = FLOOR;
            this.floor[midR][last] = FLOOR;
            this.doorCells.push({ col: last, row: midR - 1, index: 48 }, { col: last, row: midR, index: 58 });
        }

        // Na entrada de cada porta, as células INTERNAS adjacentes ao vão não
        // devem ser "beira de parede" (piso de canto/borda): viram piso central
        // liso, para a passagem não ter aquele degrau estranho.
        const topRow = 1, botRow = bottom - 1, leftCol = 1, rightCol = last - 1;
        if (this.doors.N) {
            this.floor[topRow][midC - 1] = FLOOR;
            this.floor[topRow][midC] = FLOOR;
        }
        if (this.doors.S) {
            this.floor[botRow][midC - 1] = FLOOR;
            this.floor[botRow][midC] = FLOOR;
        }
        if (this.doors.W) {
            this.floor[midR - 1][leftCol] = FLOOR;
            this.floor[midR][leftCol] = FLOOR;
        }
        if (this.doors.E) {
            this.floor[midR - 1][rightCol] = FLOOR;
            this.floor[midR][rightCol] = FLOOR;
        }
    }

}
