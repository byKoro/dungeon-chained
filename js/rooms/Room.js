import { RoomTiles } from '../core/RoomTiles.js';
import { ROOM_COLS, ROOM_ROWS, TILE } from '../config/GameConfig.js';
import { ChallengeCorridor } from '../systems/ChallengeCorridor.js';
import { GlobalRoomVariantCatalog } from './RoomArchetypes.js';
import { HeartPickup } from '../entities/HeartPickup.js';

/**
 * Room — uma sala concreta da dungeon.
 *
 * Encapsula o estado que antes ficava espalhado entre `roomStates` (main.js) e
 * `cleared`/`visited` (Dungeon): o layout de tiles, os inimigos gerados e se a
 * sala já foi limpa. É criada sob demanda pelo RoomManager quando o jogador
 * entra pela primeira vez na célula correspondente.
 */
export class Room {
    /**
     * @param {object} cell   célula do grafo { gx, gy, kind, type, doors }
     * @param {object} bounds bounds jogáveis (px) da sala
     */
    constructor(cell, bounds) {
        this.cell = cell;
        this.bounds = bounds;
        this.key = `${cell.gx},${cell.gy}`;

        this.enemies = [];
        this.hearts = [];
        this.cleared = false;
        this.populated = false;
        // Inimigos criados sob demanda pela intro de sala (não em populate()).
        // Enquanto false, os inimigos autorais ainda não foram instanciados.
        this.enemiesSpawned = false;

        // Corredor-desafio co-op (perigos + botões), criado sob demanda em
        // populate() se a célula estiver marcada como desafio.
        this.challenge = null;

        // Layout de tiles (determinístico pela posição da sala ou vindo do editor).
        const seed = (cell.gx * 73856093) ^ (cell.gy * 19349663);
        this.tiles = new RoomTiles(ROOM_COLS, ROOM_ROWS, cell.doors, seed, cell.kind === "room");

        // Piso: peça autoral (editor/map) tem prioridade; depois o catálogo de
        // arquétipos em código; por fim, o fallback liso do RoomTiles.
        if (cell.customFloor && Array.isArray(cell.customFloor)) {
            this.tiles.floor = cell.customFloor;
        } else if (GlobalRoomVariantCatalog) {
            const authorialFloor = GlobalRoomVariantCatalog.getFloorForDoors(cell.doors);
            if (authorialFloor) {
                this.tiles.floor = authorialFloor;
            }
        }

        this.tiles.walls = Array.isArray(cell.customWalls) ? cell.customWalls : [];
        this.wallBoxes = this.tiles.walls.map(wall => ({ x: bounds.minX - TILE + wall.col * TILE, y: bounds.minY - TILE + wall.row * TILE, w: TILE, h: TILE }));

        // Tochas (luz) e props (decoração) autorais: substituem o que o
        // RoomTiles traria (hoje vazio, já que não há mais geração procedural).
        if (Array.isArray(cell.customTorches)) this.tiles.torches = cell.customTorches;
        if (Array.isArray(cell.customProps)) this.tiles.props = cell.customProps;
    }

    get isCombatRoom() {
        return this.cell.kind === "room" && this.cell.type !== "start";
    }

    get isChallengeCorridor() {
        return !!(this.cell.customHazards && this.cell.customHazards.length > 0);
    }

    // nº de botões de pressão nos perigos autorais (o puzzle co-op usa 2).
    get buttonCount() {
        if (!this.cell.customHazards) return 0;
        return this.cell.customHazards.filter(h => h.type === "button").length;
    }

    /**
     * Regra de trancamento das portas desta sala/corredor:
     *   "none"    — nunca tranca.
     *   "enemies" — tranca até matar todos os inimigos.
     *   "buttons" — tranca até o puzzle de 2 botões ser resolvido.
     * Usa o campo autoral `customLock` se definido; senão deduz um padrão
     * sensato (botões -> buttons; inimigos -> enemies; nada -> none).
     */
    get lockRule() {
        const explicit = this.cell.customLock;
        // "buttons" exige 2 botões para ser resolvível; sem eles, não tranca.
        if (explicit === "buttons") return this.buttonCount >= 2 ? "buttons" : "none";
        if (explicit === "enemies") return "enemies";
        if (explicit === "none") return "none";
        // Padrão deduzido quando a peça não define `lock`:
        if (this.buttonCount >= 2) return "buttons";
        if (this.cell.customEnemies && this.cell.customEnemies.length > 0) return "enemies";
        return "none";
    }

    get isBoss() {
        return this.cell.type === "boss";
    }

    get kind() {
        return this.cell.kind;
    }

    /**
     * Gera os inimigos uma única vez (idempotente). Salas que não são de
     * combate (start, corredores) já nascem limpas.
     * @param {SpawnSystem} spawnSystem
     * @param {number} floor
     * @param {object} assets  AssetLoader (para sprites dos perigos)
     */
    populate(spawnSystem, floor, assets = null) {
        if (this.populated) return;
        this.populated = true;

        // Guarda os parâmetros de spawn para instanciar os inimigos SOB DEMANDA
        // (ver spawnEnemies). A criação é adiada para a intro de sala poder
        // mostrá-los aparecendo com partícula, congelados, só depois do zoom.
        this._spawnSystem = spawnSystem;
        this._spawnFloor = floor;
        this._spawnAssets = assets;

        // 1) Instancia o CONTEÚDO (independente de trancar ou não).
        // Perigos autorais (spikes/flechas/botões) -> ChallengeCorridor, que os
        // mantém ativos (ferindo). Só vêm da peça desenhada — nada procedural.
        if (this.cell.customHazards && this.cell.customHazards.length > 0) {
            const layout = { name: this.cell.customName || "Desafio Custom", elements: this.cell.customHazards };
            this.challenge = new ChallengeCorridor(layout, this.bounds, this.cell.doors, assets);
        }

        // NOTA: os inimigos autorais NÃO são criados aqui. A intro de sala chama
        // spawnEnemies() no momento certo (após o zoom). Até lá, enemies == [].

        // Corações iniciais: a peça autoral pode semear `heartCount` corações
        // espalhados pelo centro da sala (mesmo espalhamento do design original).
        const heartCount = Number.isInteger(this.cell.heartCount) ? this.cell.heartCount : 0;
        if (heartCount > 0) {
            const cx = (this.bounds.minX + this.bounds.maxX) / 2;
            const cy = (this.bounds.minY + this.bounds.maxY) / 2;
            for (let i = 0; i < heartCount; i++) {
                this.addHeart(cx + (Math.random() - 0.5) * 180, cy + (Math.random() - 0.5) * 120);
            }
        }

        // 2) Define o estado "limpo" conforme a REGRA DE TRANCAMENTO.
        //   none    -> nasce limpa (portas abertas), mesmo com perigos.
        //   buttons -> trancada até o puzzle (challenge.solved).
        //   enemies -> trancada até matar todos os inimigos.
        const rule = this.lockRule;
        if (rule === "buttons" && this.challenge) {
            this.cleared = false;
        } else if (rule === "enemies" && this.hasPendingEnemies) {
            // Inimigos ainda não foram instanciados (spawnEnemies), mas a peça
            // tem inimigos autorais: a sala nasce TRANCADA e não-limpa.
            this.cleared = false;
        } else {
            this.cleared = true;
        }
    }

    // Inimigos autorais válidos (fora de buracos) ainda a instanciar.
    get _validAuthoredEnemies() {
        if (!this.cell.customEnemies || !this.cell.customEnemies.length) return [];
        const floorGrid = this.tiles.floor;
        return this.cell.customEnemies.filter(foe => {
            const row = floorGrid[foe.row];
            return !row || row[foe.col] !== -1;
        });
    }

    // true se a sala tem inimigos autorais que ainda não foram spawnados.
    get hasPendingEnemies() {
        return !this.enemiesSpawned && this._validAuthoredEnemies.length > 0;
    }

    /**
     * Instancia os inimigos autorais da sala (idempotente). Chamado pela intro
     * de sala no momento da "aparição". Se `frozen` for true, cada inimigo nasce
     * congelado (parado, sem IA) tocando o efeito de spawn — a intro os libera
     * depois via unfreeze(). Devolve a lista criada (para o Game posicionar
     * partículas de spawn em cada um).
     */
    spawnEnemies(frozen = false) {
        if (this.enemiesSpawned) return this.enemies;
        this.enemiesSpawned = true;

        const spawnSystem = this._spawnSystem;
        if (!spawnSystem) return this.enemies; // populate() não rodou ainda

        const floorGrid = this.tiles.floor;
        this.enemies = this._validAuthoredEnemies.map(foe => {
            const ex = this.bounds.minX + foe.col * 64;
            const ey = this.bounds.minY + foe.row * 64;
            const enemy = spawnSystem.createEnemy(ex, ey, this._spawnFloor, foe.type);
            enemy.setNavigationFloor(floorGrid, this.bounds, this.tiles.walls);
            if (frozen) enemy.beginFrozenSpawn();
            return enemy;
        });
        return this.enemies;
    }

    // A sala está trancada (portas fechadas) conforme a regra de trancamento.
    //   none    -> nunca tranca.
    //   buttons -> trancada até o puzzle co-op ser resolvido.
    //   enemies -> trancada até matar todos os inimigos.
    isLocked() {
        if (this.cleared) return false;
        const rule = this.lockRule;
        if (rule === "buttons") return this.challenge ? this.challenge.locked : false;
        // "enemies": trancada enquanto houver inimigos vivos OU inimigos autorais
        // ainda não instanciados (durante a intro, antes de spawnEnemies).
        if (rule === "enemies") return this.enemies.length > 0 || this.hasPendingEnemies;
        return false;
    }

    // Marca a sala como limpa quando a condição da regra é satisfeita.
    tryClear() {
        if (this.cleared) return false;
        const rule = this.lockRule;

        if (rule === "buttons") {
            if (this.challenge && this.challenge.solved) {
                this.cleared = true;
                return true;
            }
            return false;
        }
        if (rule === "enemies") {
            // Só pode limpar depois de os inimigos terem sido instanciados
            // (fim da intro) e todos mortos.
            if (this.enemiesSpawned && this.enemies.length === 0) {
                this.cleared = true;
                return true;
            }
            return false;
        }
        // "none": já nasce limpa.
        return false;
    }

    removeEnemyAt(index) {
        this.enemies.splice(index, 1);
    }

    // Adiciona um coração de cura na posição dada (ex.: drop na morte de um
    // inimigo ou semeadura inicial da sala).
    addHeart(x, y) {
        this.hearts.push(new HeartPickup(x, y));
    }
}
