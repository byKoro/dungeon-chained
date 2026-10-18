/**
 * EditorApp.js — Aplicação do Editor Visual de Salas e Corredores.
 *
 * Funcionalidades focadas:
 *  - Presets com posições de portas fixas (sem desalinhamento por espelhamento vertical ímpar).
 *  - Piso e tochas gerados automaticamente de forma procedural (RoomTiles).
 *  - Definição de Buracos / Sem Piso (abismos onde ninguém pode pisar).
 *  - Traps & Perigos (Botões co-op, espinhos em onda, disparadores de flechas).
 *  - Spawn de Inimigos com sprites recortados corretamente (frame 0 de demon e bloodMonster).
 *  - Indicação visual dos Spawns dos Players (P1 Amarelo & P2 Azul) nas entradas das portas ativas.
 *  - Alerta automático de segurança se armadilhas ou buracos obstruírem o spawn dos players.
 *  - Exportação e importação JSON e código JS pronto para o projeto.
 *  - Teste jogável instantâneo no motor do jogo!
 */

import { AssetLoader } from '../core/AssetLoader.js';
import { Tileset } from '../core/Tileset.js';
import { RoomSocket, RoomTemplate } from '../rooms/RoomSocket.js';
import { RoomPresets } from '../rooms/RoomPresets.js';
import { RoomCatalog, doorSignature } from '../rooms/RoomCatalog.js';
import { RoomTiles } from '../core/RoomTiles.js';
import { ROOM_COLS, ROOM_ROWS, PLAYER_DOOR_SPAWN_TILES, getPlayerSpawnPositions, holeTileFor, TORCHES, scatterPropsOnFloor, EMPTY_FLOOR_TILE, EMPTY_FLOOR_COLOR } from '../config/GameConfig.js';
import { ENEMY_TYPES, ENEMY_TYPE_BY_KEY, playerConfigs } from '../config/EntityConfig.js';

class RoomEditor {
    constructor() {
        this.assets = new AssetLoader();
        this.tileset = null;

        // Dimensões padrão
        this.tilePx = 64; // Tamanho do tile em tela (px)
        this.cols = ROOM_COLS;
        this.rows = ROOM_ROWS;

        // Estado da Sala Atual
        this.room = {
            id: "room_cross_4way",
            name: "Sala de Quatro Vias",
            cols: this.cols,
            rows: this.rows,
            kind: "room",
            type: "normal",
            sockets: {
                N: new RoomSocket({ dir: "N", offset: 6, span: 2 }),
                S: new RoomSocket({ dir: "S", offset: 6, span: 2 }),
                E: new RoomSocket({ dir: "E", offset: 3, span: 2 }),
                W: new RoomSocket({ dir: "W", offset: 3, span: 2 })
            },
            floor: [],            // matriz [r][c] de índices de tile
            floorOverrides: {}, // tiles visuais personalizados do editor
            holes: new Set(),     // coordenadas "c,r" onde NÃO haverá piso (abismo)
            hazards: [],          // perigos { type, u, v, count, phase, wave, dir }
            walls: [],            // paredes sólidas { col, row, tile }
            enemies: [],          // inimigos { type, col, row }
            torches: [],          // tochas (luz) { col, row, side }
            props: [],            // decoração manual { col, row, index, flip }
            // Props aleatórios: quando enabled, o jogo espalha props no chão na
            // geração (exclusivo com props manuais).
            scatterProps: { enabled: false, density: 0.08 },
            // Regra de trancamento das portas: "auto" (deduz), "none" (nunca),
            // "enemies" (até matar todos), "buttons" (puzzle de 2 botões).
            lock: "auto"
        };

        // Estado das Ferramentas
        this.activeTab = "tab-holes"; // tab-holes, tab-torches, tab-props, tab-challenges, tab-enemies, tab-spawns
        this.selectedHazard = "button";
        this.spikeTiming = "normal";
        this.spikeDelay = 0;
        this.spikeRowDir = "right";   // direção da onda da fileira (right/left/down/up)
        this.spikeRowCount = 4;       // quantidade de tiles da fileira
        this.selectedEnemy = "demon";
        this.selectedProp = 59;
        this.selectedTorchType = "torch";

        // Spawn usado SÓ pelo botão "Testar" (não vai para o JSON da peça).
        // mode: "CENTER" | "N" | "S" | "E" | "W" | "custom". Em "custom",
        // p1/p2 guardam os tiles escolhidos com clique no canvas.
        this.testSpawn = this._loadTestSpawn();

        // Navegador de formas/variações
        this.shapeIndex = 0;        // forma atual (ver _allShapes)
        this.variantIndex = 0;      // variação atual (0..n-1 = existentes; n = nova)
        this.catalog = null;        // RoomCatalog carregado (peças de /map)

        // Viewport (Zoom e Pan)
        this.zoom = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.isPanning = false;
        this.lastMouse = { x: 0, y: 0 };
        this.isMouseDown = false;
        this.hoverTile = null;         // Tile sob o cursor { col, row }
        this.lastToggledHole = null;   // Evita toggle repetido ao arrastar

        // Configurações de Exibição
        this.showGrid = true;
        this.showCoords = true;
        this.showDoors = true;
        this.showPlayerSpawns = true;

        // Referências DOM
        this.canvas = document.getElementById("roomCanvas");
        this.ctx = this.canvas.getContext("2d");
        this.container = document.getElementById("canvas-container");

        // Inicialização
        this._initEvents();
        this._initAssets();
    }

    async _initAssets() {
        await this.assets.whenReady();
        this.tileset = new Tileset(this.assets.tileset, 16, 10);
        this._drawEnemyChoiceThumbs();

        // Carrega o catálogo de peças (/map) para o navegador de formas/variações.
        this.catalog = new RoomCatalog();
        await this.catalog.load();

        // Restaura a última cena editada (localStorage) para não perder trabalho
        // ao ir/voltar do teste; senão, abre na primeira forma.
        if (!this._loadSavedState()) {
            this.shapeIndex = 0;
            this.variantIndex = 0;
            this._loadCurrentShapeVariant();
        }
        this._fitScreen();
        this.render();
    }

    /* --------------------------------------------------------------------------
     * NAVEGADOR DE FORMAS & VARIAÇÕES (setas no header)
     * -------------------------------------------------------------------------- */

    // Lista canônica de TODAS as formas navegáveis (ordem das setas).
    _allShapes() {
        const d = (N, E, S, W) => ({ N: !!N, E: !!E, S: !!S, W: !!W });
        return [
            { name: "Cruzamento (4 vias)", doors: d(1, 1, 1, 1), kind: "room", type: "normal" },
            { name: "Junção T (N,E,W)", doors: d(1, 1, 0, 1), kind: "room", type: "normal" },
            { name: "Junção T (S,E,W)", doors: d(0, 1, 1, 1), kind: "room", type: "normal" },
            { name: "Junção T (N,S,E)", doors: d(1, 1, 1, 0), kind: "room", type: "normal" },
            { name: "Junção T (N,S,W)", doors: d(1, 0, 1, 1), kind: "room", type: "normal" },
            { name: "Corredor Leste-Oeste", doors: d(0, 1, 0, 1), kind: "corridor", type: "normal" },
            { name: "Corredor Norte-Sul", doors: d(1, 0, 1, 0), kind: "corridor", type: "normal" },
            { name: "Curva Norte-Leste", doors: d(1, 1, 0, 0), kind: "corridor", type: "normal" },
            { name: "Curva Norte-Oeste", doors: d(1, 0, 0, 1), kind: "corridor", type: "normal" },
            { name: "Curva Sul-Leste", doors: d(0, 1, 1, 0), kind: "corridor", type: "normal" },
            { name: "Curva Sul-Oeste", doors: d(0, 0, 1, 1), kind: "corridor", type: "normal" },
            { name: "Dead-End Norte", doors: d(1, 0, 0, 0), kind: "room", type: "normal" },
            { name: "Dead-End Leste", doors: d(0, 1, 0, 0), kind: "room", type: "normal" },
            { name: "Dead-End Sul", doors: d(0, 0, 1, 0), kind: "room", type: "normal" },
            { name: "Dead-End Oeste", doors: d(0, 0, 0, 1), kind: "room", type: "normal" },
            { name: "Câmara Inicial (Start)", doors: d(1, 1, 1, 1), kind: "room", type: "start" },
            { name: "Câmara do Chefe (Boss)", doors: d(0, 0, 0, 1), kind: "room", type: "boss" }
        ];
    }

    // Peças existentes no catálogo para a forma atual (mesmo tipo + assinatura).
    _variantsForShape(shape) {
        if (!this.catalog) return [];
        const want = doorSignature(shape.doors);
        const wantType = shape.type === "start" || shape.type === "boss" ? shape.type : "normal";
        return this.catalog.pieces.filter(p => {
            const t = p.type === "start" || p.type === "boss" ? p.type : "normal";
            return t === wantType && doorSignature(p.doors) === want;
        });
    }

    _navShape(delta) {
        const shapes = this._allShapes();
        this.shapeIndex = (this.shapeIndex + delta + shapes.length) % shapes.length;
        this.variantIndex = 0; // começa na 1ª variação (ou "nova" se não houver)
        this._loadCurrentShapeVariant();
    }

    _navVariant(delta) {
        const shape = this._allShapes()[this.shapeIndex];
        const variants = this._variantsForShape(shape);
        const slots = variants.length + 1; // +1 = slot "nova variação"
        this.variantIndex = (this.variantIndex + delta + slots) % slots;
        this._loadCurrentShapeVariant();
    }

    _newVariant() {
        const shape = this._allShapes()[this.shapeIndex];
        const variants = this._variantsForShape(shape);
        this.variantIndex = variants.length; // o slot "nova"
        this._loadCurrentShapeVariant();
    }

    // Carrega na tela a variação atual: uma peça existente ou o molde limpo.
    _loadCurrentShapeVariant() {
        const shape = this._allShapes()[this.shapeIndex];
        const variants = this._variantsForShape(shape);

        if (this.variantIndex < variants.length) {
            // Variação existente: carrega a peça do catálogo.
            this._importFromData(variants[this.variantIndex]);
        } else {
            // Slot "nova": molde limpo com as portas da forma.
            this._loadBlankShape(shape);
        }
        this._updateShapeNavUI();
    }

    // Monta um molde limpo (moldura + portas + piso) para a forma dada.
    _loadBlankShape(shape) {
        this.cols = ROOM_COLS;
        this.rows = ROOM_ROWS;
        this.room.id = `${shape.type === "start" ? "room_start_hub" : shape.type === "boss" ? "room_boss" : (shape.kind === "corridor" ? "corridor" : "room")}`;
        this.room.name = shape.name.replace(/^[^\w]+/, "").trim();
        this.room.cols = this.cols;
        this.room.rows = this.rows;
        this.room.kind = shape.kind;
        this.room.type = shape.type;
        const midC = (this.cols / 2) | 0;
        const midR = (this.rows / 2) | 0;
        this.room.sockets = {
            N: shape.doors.N ? new RoomSocket({ dir: "N", offset: midC - 1, span: 2 }) : null,
            S: shape.doors.S ? new RoomSocket({ dir: "S", offset: midC - 1, span: 2 }) : null,
            E: shape.doors.E ? new RoomSocket({ dir: "E", offset: midR - 1, span: 2 }) : null,
            W: shape.doors.W ? new RoomSocket({ dir: "W", offset: midR - 1, span: 2 }) : null
        };
        this.room.holes = new Set();
        this.room.floorOverrides = {};
        this.room.hazards = [];
        this.room.walls = [];
        this.room.enemies = [];
        this.room.torches = [];
        this.room.props = [];
        this.room.scatterProps = { enabled: false, density: 0.08 };
        this.room.lock = "auto";

        this._rebuildAutotile();
        this._updateUIFromState();
        this.render();
    }

    _updateShapeNavUI() {
        const shapes = this._allShapes();
        const shape = shapes[this.shapeIndex];
        const variants = this._variantsForShape(shape);

        const nameEl = document.getElementById("shape-name");
        const statusEl = document.getElementById("shape-status");
        const varLabel = document.getElementById("variant-label");
        if (nameEl) nameEl.textContent = `${shape.name}  (${this.shapeIndex + 1}/${shapes.length})`;
        if (statusEl) {
            if (variants.length > 0) {
                statusEl.textContent = `✓ ${variants.length} variação${variants.length > 1 ? "ões" : ""} criada${variants.length > 1 ? "s" : ""}`;
                statusEl.className = "shape-status done";
            } else {
                statusEl.textContent = "⚠ nenhuma variação — falta criar";
                statusEl.className = "shape-status missing";
            }
        }
        if (varLabel) {
            if (this.variantIndex < variants.length) {
                varLabel.textContent = `variação ${this.variantIndex + 1} de ${variants.length}`;
            } else {
                varLabel.textContent = variants.length > 0 ? "✨ nova variação" : "✨ primeira variação";
            }
        }
    }

    // Aponta o navegador para a forma que corresponde à cena atual (doors+tipo).
    _syncShapeIndexToCurrentRoom() {
        const doors = {
            N: !!this.room.sockets.N, E: !!this.room.sockets.E,
            S: !!this.room.sockets.S, W: !!this.room.sockets.W
        };
        const sig = doorSignature(doors);
        const type = this.room.type === "start" || this.room.type === "boss" ? this.room.type : "normal";
        const shapes = this._allShapes();
        const idx = shapes.findIndex(s => {
            const st = s.type === "start" || s.type === "boss" ? s.type : "normal";
            return st === type && doorSignature(s.doors) === sig;
        });
        if (idx >= 0) this.shapeIndex = idx;
        this.variantIndex = 0;
    }

    /* --------------------------------------------------------------------------
     * PERSISTÊNCIA DA CENA (localStorage) — sobrevive a recarregar/testar
     * -------------------------------------------------------------------------- */
    _sceneToData() {
        return {
            id: this.room.id,
            name: this.room.name,
            cols: this.cols,
            rows: this.rows,
            kind: this.room.kind,
            type: this.room.type,
            doors: {
                N: !!this.room.sockets.N,
                S: !!this.room.sockets.S,
                E: !!this.room.sockets.E,
                W: !!this.room.sockets.W
            },
            holes: Array.from(this.room.holes),
            walls: this.room.walls,
            floorOverrides: this.room.floorOverrides,
            floor: this.room.floor,
            hazards: this.room.hazards,
            enemies: this.room.enemies,
            torches: this.room.torches,
            props: this.room.scatterProps.enabled ? [] : this.room.props,
            scatterProps: this.room.scatterProps,
            lock: this.room.lock
        };
    }

    _saveState() {
        try {
            localStorage.setItem("editor_scene_state", JSON.stringify(this._sceneToData()));
        } catch (e) {
            // Silencioso: se o localStorage estiver indisponível, apenas não persiste.
        }
    }

    _loadSavedState() {
        try {
            const raw = localStorage.getItem("editor_scene_state");
            if (!raw) return false;
            const data = JSON.parse(raw);
            this._importFromData(data);
            // Sincroniza o navegador com a forma restaurada (sem trocar a cena).
            this._syncShapeIndexToCurrentRoom();
            this._updateShapeNavUI();
            return true;
        } catch (e) {
            return false;
        }
    }

    /* --------------------------------------------------------------------------
     * GERENCIAMENTO DE PRESETS & CARREGAMENTO (PORTAS FIXAS)
     * -------------------------------------------------------------------------- */
    _loadInitialPreset(presetKey) {
        if (presetKey === "custom_new") {
            this._createBlankRoom();
        } else {
            const enumKey = this._presetKeyToEnum(presetKey);
            const template = RoomPresets[enumKey] || RoomPresets.CROSS_4WAY;
            this._loadTemplate(template);
        }
    }

    _presetKeyToEnum(key) {
        const map = {
            "room_cross_4way": "CROSS_4WAY",
            "room_t_junction_n": "T_JUNCTION_NORTH",
            "room_t_junction_s": "T_JUNCTION_SOUTH",
            "room_t_junction_e": "T_JUNCTION_EAST",
            "room_t_junction_w": "T_JUNCTION_WEST",
            "corridor_horizontal_ew": "CORRIDOR_HORIZONTAL",
            "corridor_vertical_ns": "CORRIDOR_VERTICAL",
            "room_corner_ne": "CORNER_NE",
            "room_corner_nw": "CORNER_NW",
            "room_corner_se": "CORNER_SE",
            "room_corner_sw": "CORNER_SW",
            "room_deadend_w": "DEADEND_WEST",
            "room_deadend_e": "DEADEND_EAST",
            "room_deadend_n": "DEADEND_NORTH",
            "room_deadend_s": "DEADEND_SOUTH",
            "room_start_hub": "START_ROOM",
            "room_boss_chamber": "BOSS_ROOM"
        };
        return map[key] || "CROSS_4WAY";
    }

    _loadTemplate(template) {
        this.cols = template.cols;
        this.rows = template.rows;
        this.room.id = template.id;
        this.room.name = template.name;
        this.room.cols = template.cols;
        this.room.rows = template.rows;
        this.room.kind = template.kind;
        this.room.type = template.type;
        this.room.holes = new Set();
        this.room.hazards = [];
        this.room.walls = [];
        this.room.enemies = [];
        this.room.torches = [];
        this.room.props = [];
        this.room.scatterProps = { enabled: false, density: 0.08 };
        this.room.lock = "auto";

        // Portas fixas do template
        this.room.sockets = {
            N: template.getSockets("N")[0] ? template.getSockets("N")[0].clone() : null,
            S: template.getSockets("S")[0] ? template.getSockets("S")[0].clone() : null,
            E: template.getSockets("E")[0] ? template.getSockets("E")[0].clone() : null,
            W: template.getSockets("W")[0] ? template.getSockets("W")[0].clone() : null
        };

        // Reconstrói layout de piso procedural
        this._rebuildAutotile();
        this._updateUIFromState();
        this.render();
    }

    _createBlankRoom() {
        this.cols = ROOM_COLS;
        this.rows = ROOM_ROWS;
        this.room.id = `room_custom_${Date.now().toString().slice(-4)}`;
        this.room.name = "Sala Customizada";
        this.room.cols = this.cols;
        this.room.rows = this.rows;
        this.room.kind = "room";
        this.room.type = "normal";
        this.room.sockets = {
            N: new RoomSocket({ dir: "N", offset: 6, span: 2 }),
            S: new RoomSocket({ dir: "S", offset: 6, span: 2 }),
            E: new RoomSocket({ dir: "E", offset: 3, span: 2 }),
            W: new RoomSocket({ dir: "W", offset: 3, span: 2 })
        };
        this.room.holes = new Set();
        this.room.hazards = [];
        this.room.walls = [];
        this.room.enemies = [];
        this.room.torches = [];
        this.room.props = [];
        this.room.scatterProps = { enabled: false, density: 0.08 };
        this.room.lock = "auto";

        this._rebuildAutotile();
        this._updateUIFromState();
        this.render();
    }

    /**
     * Gera a grade de tiles usando as mesmas regras determinísticas da engine (RoomTiles).
     * O piso e as tochas são colocados automaticamente.
     */
    _rebuildAutotile() {
        const doors = {
            N: !!this.room.sockets.N,
            S: !!this.room.sockets.S,
            E: !!this.room.sockets.E,
            W: !!this.room.sockets.W
        };

        const rt = new RoomTiles(this.cols, this.rows, doors, 12345, this.room.kind === "room");
        this.room.floor = rt.floor;

        // Aplica tiles visuais pintados pelo editor e, depois, os buracos.
        for (const [key, tile] of Object.entries(this.room.floorOverrides || {})) {
            const [c, r] = key.split(",").map(Number);
            if (r >= 0 && r < this.rows && c >= 0 && c < this.cols) this.room.floor[r][c] = tile;
        }
        // Aplica os buracos definidos
        for (const holeKey of this.room.holes) {
            const [c, r] = holeKey.split(",").map(Number);
            if (r >= 0 && r < this.rows && c >= 0 && c < this.cols) {
                this.room.floor[r][c] = -1; // -1 indica ausência de piso (abismo)
            }
        }
    }

    /* --------------------------------------------------------------------------
     * CÁLCULO DAS ZONAS DE ENTRADA & SPAWNS DOS JOGADORES
     * Regra do jogo: cada jogador nasce em um tile específico logo à frente da porta.
     * -------------------------------------------------------------------------- */
    _getPlayerSpawns() {
        const spawns = [];

        // Se for a sala inicial (Start Hub) ou centro
        if (this.room.type === "start" || this.room.id === "room_start_hub") {
            const data = getPlayerSpawnPositions("CENTER", 0, 0, this.tilePx);
            spawns.push({
                id: "center",
                label: "Spawn Inicial (Centro)",
                entryDir: "Centro",
                p1: data.p1,
                p2: data.p2
            });
        }

        // Portas ativas determinam onde os players surgem ao entrar na sala
        const dirConfigs = [
            { dir: "N", id: "north", label: "Entrada Norte (Vindo do Norte)" },
            { dir: "S", id: "south", label: "Entrada Sul (Vindo do Sul)" },
            { dir: "W", id: "west", label: "Entrada Oeste (Vindo do Oeste)" },
            { dir: "E", id: "east", label: "Entrada Leste (Vindo do Leste)" }
        ];

        for (const { dir, id, label } of dirConfigs) {
            if (this.room.sockets[dir]) {
                const data = getPlayerSpawnPositions(dir, 0, 0, this.tilePx);
                spawns.push({
                    id,
                    label,
                    entryDir: dir,
                    p1: data.p1,
                    p2: data.p2
                });
            }
        }

        return spawns;
    }

    _checkSpawnSafety() {
        // O alerta de spawn e o badge de segurança foram removidos da UI.
        // Guard clause: sem os elementos no DOM, este método é um no-op seguro.
        const warnBox = document.getElementById("spawn-warning-box");
        const statSafety = document.getElementById("stat-spawns-safety");
        if (!warnBox || !statSafety) return;

        const spawns = this._getPlayerSpawns();
        const warnings = [];

        for (const sp of spawns) {
            // Verifica buracos nos tiles específicos de spawn
            if (this.room.holes.has(`${sp.p1.col},${sp.p1.row}`)) {
                warnings.push(`Buraco sem piso sobre o tile de spawn do P1 [Col ${sp.p1.col}, Linha ${sp.p1.row}] na ${sp.label}!`);
            }
            if (this.room.holes.has(`${sp.p2.col},${sp.p2.row}`)) {
                warnings.push(`Buraco sem piso sobre o tile de spawn do P2 [Col ${sp.p2.col}, Linha ${sp.p2.row}] na ${sp.label}!`);
            }

            // Verifica armadilhas / hazards nos tiles de spawn (por tile).
            for (const h of this.room.hazards) {
                for (const t of this._hazardTiles(h)) {
                    if (t.col === sp.p1.col && t.row === sp.p1.row) {
                        warnings.push(`Perigo (${this._hazardLabel(h.type)}) sobre o tile de spawn do P1 [Col ${t.col}, Linha ${t.row}] na ${sp.label}!`);
                    }
                    if (t.col === sp.p2.col && t.row === sp.p2.row) {
                        warnings.push(`Perigo (${this._hazardLabel(h.type)}) sobre o tile de spawn do P2 [Col ${t.col}, Linha ${t.row}] na ${sp.label}!`);
                    }
                }
            }
        }

        if (warnings.length > 0) {
            warnBox.style.display = "block";
            warnBox.innerHTML = `
                <strong>⚠️ Alerta de Segurança de Spawn:</strong>
                <ul style="margin:4px 0 0 16px; padding:0;">
                    ${warnings.map(w => `<li>${w}</li>`).join("")}
                </ul>
            `;
            statSafety.textContent = "Atenção (Perigo na Entrada)";
            statSafety.className = "status-badge warn";
        } else {
            warnBox.style.display = "none";
            statSafety.textContent = "Seguro (Entradas Livres)";
            statSafety.className = "status-badge ok";
        }
    }

    /* --------------------------------------------------------------------------
     * SPAWN DO TESTE (botão "Testar")
     * Configuração só do editor: persiste no localStorage à parte da cena, para
     * não vazar para o JSON salvo em /map.
     * -------------------------------------------------------------------------- */
    _loadTestSpawn() {
        const fallback = { mode: "CENTER", p1: null, p2: null };
        try {
            const raw = localStorage.getItem("editor_test_spawn");
            if (!raw) return fallback;
            const data = JSON.parse(raw);
            const valid = ["CENTER", "N", "S", "E", "W", "custom"];
            if (!data || !valid.includes(data.mode)) return fallback;
            return { mode: data.mode, p1: data.p1 || null, p2: data.p2 || null };
        } catch (e) {
            return fallback;
        }
    }

    _saveTestSpawn() {
        try {
            localStorage.setItem("editor_test_spawn", JSON.stringify(this.testSpawn));
        } catch (e) {
            // Silencioso: sem localStorage, a escolha só vale nesta sessão.
        }
    }

    // Tile interno onde um player pode nascer (sem borda, parede ou buraco).
    _isTestSpawnTileFree(col, row) {
        if (col <= 0 || row <= 0 || col >= this.cols - 1 || row >= this.rows - 1) return false;
        if (this.room.holes.has(`${col},${row}`)) return false;
        if ((this.room.walls || []).some(w => w.col === col && w.row === row)) return false;
        return true;
    }

    // Resolve o spawn do teste em tiles + px. Se o modo escolhido não existir
    // mais na sala atual (porta removida, tile virou buraco), cai no centro.
    _resolveTestSpawn() {
        const ts = this.testSpawn;
        const toPos = (t) => ({
            col: t.col,
            row: t.row,
            x: (t.col + 0.5) * this.tilePx,
            y: (t.row + 0.5) * this.tilePx
        });

        if (ts.mode === "custom" && ts.p1 && ts.p2 &&
            this._isTestSpawnTileFree(ts.p1.col, ts.p1.row) &&
            this._isTestSpawnTileFree(ts.p2.col, ts.p2.row)) {
            return { mode: "custom", p1: toPos(ts.p1), p2: toPos(ts.p2) };
        }
        if (["N", "S", "E", "W"].includes(ts.mode) && this.room.sockets[ts.mode]) {
            const d = getPlayerSpawnPositions(ts.mode, 0, 0, this.tilePx);
            return { mode: ts.mode, p1: d.p1, p2: d.p2 };
        }
        const d = getPlayerSpawnPositions("CENTER", 0, 0, this.tilePx);
        return { mode: "CENTER", p1: d.p1, p2: d.p2 };
    }

    // Clique no canvas (aba Spawns): P1 no tile clicado, P2 no primeiro vizinho
    // livre. Ficam colados para a corrente não arrebentar ao iniciar.
    _setCustomTestSpawn(col, row) {
        if (!this._isTestSpawnTileFree(col, row)) return;
        const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        let p2 = null;
        for (const [dc, dr] of neighbors) {
            if (this._isTestSpawnTileFree(col + dc, row + dr)) {
                p2 = { col: col + dc, row: row + dr };
                break;
            }
        }
        if (!p2) return; // tile isolado: sem espaço para os dois players

        this.testSpawn = { mode: "custom", p1: { col, row }, p2 };
        this._saveTestSpawn();
        this._updateTestSpawnUI();
        this.render();
    }

    _updateTestSpawnUI() {
        const sel = document.getElementById("test-spawn-mode");
        const info = document.getElementById("test-spawn-info");
        if (!sel) return;

        const options = [{ value: "CENTER", label: "Centro (padrão)" }];
        const doorLabels = { N: "Porta Norte", S: "Porta Sul", W: "Porta Oeste", E: "Porta Leste" };
        for (const dir of ["N", "S", "W", "E"]) {
            if (this.room.sockets[dir]) options.push({ value: dir, label: `Entrada ${doorLabels[dir]}` });
        }
        options.push({ value: "custom", label: "Personalizado (clique no mapa)" });

        const resolved = this._resolveTestSpawn();
        // Mantém "Personalizado" visível como escolha mesmo antes do 1º clique.
        const current = this.testSpawn.mode === "custom" ? "custom" : resolved.mode;
        sel.innerHTML = options
            .map(o => `<option value="${o.value}"${o.value === current ? " selected" : ""}>${o.label}</option>`)
            .join("");

        if (info) {
            const pending = this.testSpawn.mode === "custom" && resolved.mode !== "custom";
            info.textContent = pending
                ? "Clique num tile de piso para definir o spawn (usando o centro por enquanto)."
                : `P1 [Col ${resolved.p1.col}, Linha ${resolved.p1.row}] · P2 [Col ${resolved.p2.col}, Linha ${resolved.p2.row}]`;
        }
    }

    // Marcador verde do spawn do teste no canvas (distinto das entradas).
    _renderTestSpawn(ctx, tileW) {
        const sp = this._resolveTestSpawn();
        ctx.save();
        ctx.strokeStyle = "#2cb67d";
        ctx.fillStyle = "rgba(44, 182, 125, 0.18)";
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        for (const p of [sp.p1, sp.p2]) {
            ctx.fillRect(p.col * tileW, p.row * tileW, tileW, tileW);
            ctx.strokeRect(p.col * tileW + 2, p.row * tileW + 2, tileW - 4, tileW - 4);
        }
        ctx.setLineDash([]);
        this._drawPlayerSprite(ctx, sp.p1.x, sp.p1.y, "p1", "#ffd166", "P1");
        this._drawPlayerSprite(ctx, sp.p2.x, sp.p2.y, "p2", "#6bb4db", "P2");

        // Etiqueta "TESTE" acima do par.
        const labelX = (Math.min(sp.p1.col, sp.p2.col)) * tileW + 4;
        const labelY = (Math.min(sp.p1.row, sp.p2.row)) * tileW + 4;
        ctx.font = "bold 11px sans-serif";
        ctx.textBaseline = "top";
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(labelX - 2, labelY - 1, 44, 14);
        ctx.fillStyle = "#2cb67d";
        ctx.fillText("TESTE", labelX, labelY);
        ctx.restore();
    }

    /* --------------------------------------------------------------------------
     * ATUALIZAÇÃO DA INTERFACE A PARTIR DO ESTADO
     * -------------------------------------------------------------------------- */
    _updateUIFromState() {
        // Regra de trancamento das portas (único controle que reflete metadados).
        const lockSel = document.getElementById("lock-rule");
        if (lockSel) lockSel.value = this.room.lock || "auto";

        // Buracos
        const holesCount = document.getElementById("holes-count");
        if (holesCount) holesCount.textContent = this.room.holes.size;

        // Listas de Perigos, Inimigos, Tochas e Props
        this._updateWallsListUI();
        this._updateHazardsListUI();
        this._updateEnemiesListUI();
        this._updateTorchesListUI();
        this._updatePropsListUI();
        this._syncScatterUI();
        this._updateSpawnsListUI();
        this._updateTestSpawnUI();

        // Segurança de spawn (no-op com guard) e persistência da cena.
        this._checkSpawnSafety();
        this._updateCodeOutput();

        // Status bar
        const statusDims = document.getElementById("status-dims");
        if (statusDims) statusDims.textContent = `${this.cols} x ${this.rows} tiles (${this.cols * this.tilePx} x ${this.rows * this.tilePx} px)`;
    }

    _updateSpawnsListUI() {
        const listEl = document.getElementById("spawns-info-list");
        if (!listEl) return;
        const spawns = this._getPlayerSpawns();
        listEl.innerHTML = "";

        if (spawns.length === 0) {
            listEl.innerHTML = `<div style="font-size:11px; color:var(--text-dim); text-align:center; padding:8px;">Nenhuma porta ativa nesta sala</div>`;
            return;
        }

        spawns.forEach(sp => {
            const card = document.createElement("div");
            card.className = "spawn-card";
            card.innerHTML = `
                <div class="spawn-header">
                    <strong>${sp.label}</strong>
                    <span class="badge" style="font-size:10px;">Regra: 1 Tile à Frente</span>
                </div>
                <div style="font-size:11px; margin-top:6px; display:flex; flex-direction:column; gap:4px;">
                    <span style="color:#ffd166; font-weight:600;">P1 (Amarelo): Tile [Col ${sp.p1.col}, Linha ${sp.p1.row}]</span>
                    <span style="color:#6bb4db; font-weight:600;">P2 (Azul): Tile [Col ${sp.p2.col}, Linha ${sp.p2.row}]</span>
                </div>
                <div style="font-size:10px; color:var(--text-dim); margin-top:4px;">
                    Centros px: P1 (${Math.round(sp.p1.x)}, ${Math.round(sp.p1.y)}) | P2 (${Math.round(sp.p2.x)}, ${Math.round(sp.p2.y)})
                </div>
            `;
            listEl.appendChild(card);
        });
    }

    _updateWallsListUI() {
        const list = document.getElementById("walls-list");
        const count = document.getElementById("wall-count");
        if (!list || !count) return;
        count.textContent = this.room.walls.length;
        list.innerHTML = "";
        this.room.walls.forEach((wall, index) => {
            const item = document.createElement("div");
            item.className = "status-item";
            const label = document.createElement("span");
            label.textContent = "Bloco " + wall.tile + " (" + wall.col + ", " + wall.row + ")";
            const button = document.createElement("button");
            button.className = "btn btn-sm btn-danger";
            button.textContent = "✕";
            button.onclick = () => {
                this.room.walls.splice(index, 1);
                this._updateWallsListUI();
                this._updateCodeOutput();
                this.render();
            };
            item.append(label, button);
            list.appendChild(item);
        });
    }

    _updateHazardsListUI() {
        const listEl = document.getElementById("hazards-list");
        const countEl = document.getElementById("hazard-count");
        countEl.textContent = this.room.hazards.length;
        listEl.innerHTML = "";

        if (this.room.hazards.length === 0) {
            listEl.innerHTML = `<div style="font-size:11px; color:var(--text-dim); text-align:center; padding:10px;">Nenhum perigo colocado</div>`;
            return;
        }

        this.room.hazards.forEach((h, i) => {
            const item = document.createElement("div");
            item.className = "status-item";
            item.innerHTML = `
                <span>${this._hazardLabel(h.type)} (col:${h.col ?? '-'}, lin:${h.row ?? '-'})${h.type === "spikeRow" ? ` · ${h.count || 4} tiles ${this._waveDirArrow(h.dir)}` : ""}</span>
                <button class="btn btn-sm btn-danger" data-del-hazard="${i}">✕</button>
            `;
            listEl.appendChild(item);
        });

        listEl.querySelectorAll("[data-del-hazard]").forEach(btn => {
            btn.onclick = (e) => {
                const idx = parseInt(e.target.dataset.delHazard, 10);
                this.room.hazards.splice(idx, 1);
                this._updateHazardsListUI();
                this._checkSpawnSafety();
                this._updateCodeOutput();
                this.render();
            };
        });
    }

    _hazardLabel(type) {
        if (type === "button") return "Botão Co-op";
        if (type === "spikeRow") return "Fileira Espinhos";
        if (type === "spike") return "Espinho Único";
        if (type === "arrow") return "Atirador Flecha";
        return type;
    }

    _updateEnemiesListUI() {
        const listEl = document.getElementById("enemies-list");
        const countEl = document.getElementById("enemy-count");
        countEl.textContent = this.room.enemies.length;
        listEl.innerHTML = "";

        if (this.room.enemies.length === 0) {
            listEl.innerHTML = `<div style="font-size:11px; color:var(--text-dim); text-align:center; padding:10px;">Nenhum inimigo colocado</div>`;
            return;
        }

        this.room.enemies.forEach((foe, i) => {
            const item = document.createElement("div");
            item.className = "status-item";
            item.innerHTML = `
                <span>${ENEMY_TYPE_BY_KEY[foe.type]?.label ?? String(foe.type).replace(/[&<>"']/g, "?")} (${foe.col}, ${foe.row})</span>
                <button class="btn btn-sm btn-danger" data-del-enemy="${i}">✕</button>
            `;
            listEl.appendChild(item);
        });

        listEl.querySelectorAll("[data-del-enemy]").forEach(btn => {
            btn.onclick = (e) => {
                const idx = parseInt(e.target.dataset.delEnemy, 10);
                this.room.enemies.splice(idx, 1);
                this._updateEnemiesListUI();
                this._updateCodeOutput();
                this.render();
            };
        });
    }

    _updateTorchesListUI() {
        const listEl = document.getElementById("torches-list");
        const countEl = document.getElementById("torch-count");
        if (!listEl || !countEl) return;
        countEl.textContent = this.room.torches.length;
        listEl.innerHTML = "";

        if (this.room.torches.length === 0) {
            listEl.innerHTML = `<div style="font-size:11px; color:var(--text-dim); text-align:center; padding:10px;">Nenhuma tocha colocada</div>`;
            return;
        }

        this.room.torches.forEach((t, i) => {
            const item = document.createElement("div");
            item.className = "status-item";
            item.innerHTML = `
                <span>${t.type === "candlestick_1" ? "Candlestick 1" : t.type === "candlestick_2" ? "Candlestick 2" : `Tocha ${t.side}`} (${t.col}, ${t.row})</span>
                <button class="btn btn-sm btn-danger" data-del-torch="${i}">✕</button>
            `;
            listEl.appendChild(item);
        });

        listEl.querySelectorAll("[data-del-torch]").forEach(btn => {
            btn.onclick = (e) => {
                const idx = parseInt(e.target.dataset.delTorch, 10);
                this.room.torches.splice(idx, 1);
                this._updateTorchesListUI();
                this._updateCodeOutput();
                this.render();
            };
        });
    }

    _updatePropsListUI() {
        const listEl = document.getElementById("props-list");
        const countEl = document.getElementById("prop-count");
        if (!listEl || !countEl) return;
        countEl.textContent = this.room.props.length;
        listEl.innerHTML = "";

        if (this.room.props.length === 0) {
            listEl.innerHTML = `<div style="font-size:11px; color:var(--text-dim); text-align:center; padding:10px;">Nenhum prop colocado</div>`;
            return;
        }

        this.room.props.forEach((p, i) => {
            const item = document.createElement("div");
            item.className = "status-item";
            item.innerHTML = `
                <span>Prop #${p.index} (${p.col}, ${p.row})</span>
                <button class="btn btn-sm btn-danger" data-del-prop="${i}">✕</button>
            `;
            listEl.appendChild(item);
        });

        listEl.querySelectorAll("[data-del-prop]").forEach(btn => {
            btn.onclick = (e) => {
                const idx = parseInt(e.target.dataset.delProp, 10);
                this.room.props.splice(idx, 1);
                this._updatePropsListUI();
                this._updateCodeOutput();
                this.render();
            };
        });
    }

    // O card "Código / JSON Gerado" foi removido da UI. Este método agora serve
    // apenas para persistir a cena: é chamado por praticamente toda mutação do
    // editor, garantindo que o estado continue sendo gravado no localStorage.
    _updateCodeOutput() {
        this._saveState();
    }

    /* --------------------------------------------------------------------------
     * RENDERIZAÇÃO DO VIEWPORT DA SALA
     * -------------------------------------------------------------------------- */
    render() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.clearRect(0, 0, w, h);
        ctx.save();

        // Aplica Pan & Zoom
        ctx.translate(this.panX, this.panY);
        ctx.scale(this.zoom, this.zoom);
        ctx.imageSmoothingEnabled = false;

        const tileW = this.tilePx;
        const totalW = this.cols * tileW;
        const totalH = this.rows * tileW;

        // Fundo escuro do abismo/chão
        ctx.fillStyle = "#0c0b14";
        ctx.fillRect(0, 0, totalW, totalH);

        // 1. Renderiza Tiles do Piso e Parede (Procedurais de RoomTiles)
        if (this.tileset && this.room.floor.length === this.rows) {
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    const tileIdx = this.room.floor[r][c];
                    if (tileIdx === EMPTY_FLOOR_TILE) {
                        ctx.fillStyle = EMPTY_FLOOR_COLOR;
                        ctx.fillRect(c * tileW, r * tileW, tileW, tileW);
                    } else if (tileIdx >= 0) {
                        this.tileset.draw(ctx, tileIdx, c * tileW, r * tileW, tileW, tileW);
                    }
                }
            }
        }

        // 2. Renderiza Buracos (Sem Piso / Abismos)
        this._renderHoles(ctx, tileW);
        this._renderWalls(ctx, tileW);

        // 2b. Props decorativos e tochas (desenhados sobre o piso/parede)
        this._renderProps(ctx, tileW);
        this._renderTorches(ctx, tileW);

        // 3. Renderiza Perigos (Traps)
        this._renderHazards(ctx, totalW, totalH);

        // 4. Renderiza Inimigos (com recorte correto do frame 0)
        this._renderEnemies(ctx, tileW);

        // 5. Renderiza Spawns dos Jogadores (P1 & P2 nas entradas)
        if (this.showPlayerSpawns) {
            this._renderPlayerSpawns(ctx, tileW);
            this._renderTestSpawn(ctx, tileW);
        }

        // 6. Renderiza Destaques de Portas nas Bordas
        if (this.showDoors) {
            this._renderSocketsHighlight(ctx, tileW, totalW, totalH);
        }

        // 7. Grade Auxiliar e Coordenadas
        if (this.showGrid) {
            this._renderGrid(ctx, tileW, totalW, totalH);
        }

        // 8. Destaque do Tile sob o Cursor (Hover Box)
        if (this.hoverTile) {
            const { col: hc, row: hr } = this.hoverTile;
            if (hc >= 0 && hc < this.cols && hr >= 0 && hr < this.rows) {
                const isBorder = (hc === 0 || hc === this.cols - 1 || hr === 0 || hr === this.rows - 1);
                ctx.save();
                if (isBorder) {
                    ctx.fillStyle = "rgba(239, 69, 101, 0.28)";
                    ctx.strokeStyle = "#ef4565";
                } else if (this.activeTab === "tab-holes") {
                    const isHole = this.room.holes.has(`${hc},${hr}`);
                    ctx.fillStyle = isHole ? "rgba(44, 182, 125, 0.35)" : "rgba(239, 69, 101, 0.35)";
                    ctx.strokeStyle = isHole ? "#2cb67d" : "#ef4565";
                } else {
                    ctx.fillStyle = "rgba(255, 209, 102, 0.25)";
                    ctx.strokeStyle = "#ffd166";
                }
                ctx.lineWidth = 2;
                ctx.fillRect(hc * tileW, hr * tileW, tileW, tileW);
                ctx.strokeRect(hc * tileW + 1, hr * tileW + 1, tileW - 2, tileW - 2);
                ctx.restore();
            }
        }

        ctx.restore();
    }

    _renderWalls(ctx, tileW) {
        for (const wall of (this.room.walls || [])) {
            const x = wall.col * tileW;
            const y = wall.row * tileW;
            if (this.tileset) this.tileset.draw(ctx, wall.tile, x, y, tileW, tileW);
            else { ctx.fillStyle = "#514052"; ctx.fillRect(x, y, tileW, tileW); }
        }
    }

    _renderHoles(ctx, tileW) {
        const floor = this.room.floor;
        for (const holeKey of this.room.holes) {
            const [c, r] = holeKey.split(",").map(Number);
            const x = c * tileW;
            const y = r * tileW;

            // Fundo de abismo profundo
            ctx.fillStyle = "#030206";
            ctx.fillRect(x, y, tileW, tileW);

            // Tile real do abismo (autotiling pelos vizinhos), igual à engine.
            if (this.tileset && floor && floor.length) {
                const idx = holeTileFor(floor, c, r);
                this.tileset.draw(ctx, idx, x, y, tileW, tileW);
            }

            // Realce sutil só na aba de buracos, para indicar que é editável.
            if (this.activeTab === "tab-holes") {
                ctx.strokeStyle = "rgba(229, 49, 112, 0.45)";
                ctx.lineWidth = 1.5;
                ctx.setLineDash([4, 4]);
                ctx.strokeRect(x + 2, y + 2, tileW - 4, tileW - 4);
                ctx.setLineDash([]);
            }
        }
    }

    _renderProps(ctx, tileW) {
        if (!this.tileset) return;

        // Modo aleatório: desenha um PREVIEW determinístico do espalhamento
        // (apenas ilustrativo — no jogo é regerado por célula).
        if (this.room.scatterProps && this.room.scatterProps.enabled) {
            if (this.room.floor.length !== this.rows) return;
            const preview = scatterPropsOnFloor(this.room.floor, {
                density: this.room.scatterProps.density,
                rng: this._previewRng(1234)
            });
            ctx.save();
            ctx.globalAlpha = 0.75;
            for (const p of preview) {
                this.tileset.draw(ctx, p.index, p.col * tileW, p.row * tileW, tileW, tileW);
            }
            ctx.restore();
            return;
        }

        for (const p of this.room.props) {
            const dx = p.col * tileW, dy = p.row * tileW;
            if (p.flip) {
                ctx.save();
                ctx.translate(dx + tileW, dy);
                ctx.scale(-1, 1);
                this.tileset.draw(ctx, p.index, 0, 0, tileW, tileW);
                ctx.restore();
            } else {
                this.tileset.draw(ctx, p.index, dx, dy, tileW, tileW);
            }
        }
    }

    // RNG determinístico para o preview do scatter (mulberry32).
    _previewRng(seed) {
        let a = seed >>> 0;
        return function () {
            a |= 0; a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    _renderTorches(ctx, tileW) {
        const spriteGroups = this.assets.torchSprites;
        const frame = Math.floor(performance.now() / 160) % 4;
        for (const t of this.room.torches) {
            const dx = t.col * tileW, dy = t.row * tileW;
            const type = t.type || "torch";
            const sprites = type === "candlestick_1" ? spriteGroups.candlestick1
                : type === "candlestick_2" ? spriteGroups.candlestick2
                    : (t.side === "W" || t.side === "E") ? spriteGroups.sideTorch
                        : spriteGroups.torch;
            const img = sprites && sprites[frame];
            const flip = type === "torch" && t.side === "E";
            if (img && img.complete && img.naturalWidth > 0 && flip) {
                ctx.save();
                ctx.translate(dx + tileW, dy);
                ctx.scale(-1, 1);
                ctx.drawImage(img, 0, 0, tileW, tileW);
                ctx.restore();
            } else if (img && img.complete && img.naturalWidth > 0) {
                ctx.drawImage(img, dx, dy, tileW, tileW);
            } else if (this.tileset) {
                const idx = (t.side === "N" || t.side === "S") ? TORCHES.index : TORCHES.sideIndex;
                if (flip) {
                    ctx.save();
                    ctx.translate(dx + tileW, dy);
                    ctx.scale(-1, 1);
                    this.tileset.draw(ctx, idx, 0, 0, tileW, tileW);
                    ctx.restore();
                } else {
                    this.tileset.draw(ctx, idx, dx, dy, tileW, tileW);
                }
            }
            // Halo indicativo da luz (só visual no editor).
            const cx = dx + tileW / 2, cy = dy + tileW / 2;
            const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, tileW * 0.9);
            grad.addColorStop(0, "rgba(255, 190, 110, 0.45)");
            grad.addColorStop(1, "rgba(255, 190, 110, 0)");
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(cx, cy, tileW * 0.9, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    _renderGrid(ctx, tileW, totalW, totalH) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
        ctx.lineWidth = 1;

        for (let c = 0; c <= this.cols; c++) {
            ctx.beginPath();
            ctx.moveTo(c * tileW, 0);
            ctx.lineTo(c * tileW, totalH);
            ctx.stroke();
        }

        for (let r = 0; r <= this.rows; r++) {
            ctx.beginPath();
            ctx.moveTo(0, r * tileW);
            ctx.lineTo(totalW, r * tileW);
            ctx.stroke();
        }
    }

    _renderSocketsHighlight(ctx, tileW, totalW, totalH) {
        const s = this.room.sockets;

        // Borda Norte (Azul/Ciano)
        if (s.N) {
            const x = s.N.offset * tileW;
            const w = s.N.span * tileW;
            ctx.fillStyle = "rgba(61, 169, 252, 0.35)";
            ctx.fillRect(x, 0, w, tileW);
            ctx.strokeStyle = "#3da9fc";
            ctx.lineWidth = 3;
            ctx.strokeRect(x, 0, w, tileW);
        }

        // Borda Sul (Amarelo)
        if (s.S) {
            const x = s.S.offset * tileW;
            const y = (this.rows - 1) * tileW;
            const w = s.S.span * tileW;
            ctx.fillStyle = "rgba(255, 209, 102, 0.35)";
            ctx.fillRect(x, y, w, tileW);
            ctx.strokeStyle = "#ffd166";
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y, w, tileW);
        }

        // Borda Leste (Verde)
        if (s.E) {
            const x = (this.cols - 1) * tileW;
            const y = s.E.offset * tileW;
            const h = s.E.span * tileW;
            ctx.fillStyle = "rgba(44, 182, 125, 0.35)";
            ctx.fillRect(x, y, tileW, h);
            ctx.strokeStyle = "#2cb67d";
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y, tileW, h);
        }

        // Borda Oeste (Magenta)
        if (s.W) {
            const y = s.W.offset * tileW;
            const h = s.W.span * tileW;
            ctx.fillStyle = "rgba(229, 49, 112, 0.35)";
            ctx.fillRect(0, y, tileW, h);
            ctx.strokeStyle = "#e53170";
            ctx.lineWidth = 3;
            ctx.strokeRect(0, y, tileW, h);
        }
    }

    /**
     * Renderiza os perigos. TODOS são posicionados por TILE (col,row) — um por
     * tile — e desenhados alinhados à grade, exatamente como no jogo.
     */
    _renderHazards(ctx, totalW, totalH) {
        const tileW = this.tilePx;

        for (const h of this.room.hazards) {
            // Tiles que este perigo ocupa (spikeRow ocupa `count` tiles em linha).
            const tiles = this._hazardTiles(h);

            if (h.type === "button") {
                const t = tiles[0];
                const cx = t.col * tileW + tileW / 2;
                const cy = t.row * tileW + tileW / 2;
                // Botão de pressão co-op: sprite (frame 0 = levantado), com a
                // forma geométrica antiga como fallback.
                const btnImg = this.assets.get("button");
                if (btnImg && btnImg.complete && btnImg.naturalWidth > 0) {
                    ctx.drawImage(btnImg, 0, 0, 16, 16, t.col * tileW, t.row * tileW, tileW, tileW);
                    continue;
                }
                ctx.fillStyle = "#5c0a18";
                ctx.beginPath();
                ctx.ellipse(cx, cy, 22, 14, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = "#ff8906";
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.fillStyle = "#e53170";
                ctx.beginPath();
                ctx.ellipse(cx, cy - 4, 13, 8, 0, 0, Math.PI * 2);
                ctx.fill();
            } else if (h.type === "spike" || h.type === "spikeRow") {
                const peakImg = this.assets.get("peaks2");
                for (const t of tiles) {
                    const dx = t.col * tileW;
                    const dy = t.row * tileW;
                    if (peakImg && peakImg.complete) {
                        ctx.drawImage(peakImg, dx, dy, tileW, tileW);
                    } else {
                        const cx = dx + tileW / 2, cy = dy + tileW / 2;
                        ctx.fillStyle = "#f5a623";
                        ctx.beginPath();
                        ctx.moveTo(cx, cy - tileW * 0.3);
                        ctx.lineTo(cx + tileW * 0.25, cy + tileW * 0.25);
                        ctx.lineTo(cx - tileW * 0.25, cy + tileW * 0.25);
                        ctx.closePath();
                        ctx.fill();
                    }
                }
                if (h.type === "spikeRow") this._renderWaveArrow(ctx, h, tiles, tileW);
            } else if (h.type === "arrow") {
                const t = tiles[0];
                const dx = t.col * tileW;
                const dy = t.row * tileW;
                // Sprite do lançador de flechas: tile 75 do tileset.
                if (this.tileset) {
                    this.tileset.draw(ctx, 75, dx, dy, tileW, tileW);
                }
                // Seta de direção do disparo (overlay guia).
                const cx = dx + tileW / 2, cy = dy + tileW / 2;
                ctx.strokeStyle = "#ff8906";
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                const L = tileW * 0.4;
                const sideDirs = { top: "along+", bottom: "along-", left: "across+", right: "across-" };
                const dir = sideDirs[h.side] || h.dir;
                if (dir === "across+") ctx.lineTo(cx + L, cy);
                else if (dir === "across-") ctx.lineTo(cx - L, cy);
                else if (dir === "along+") ctx.lineTo(cx, cy + L);
                else ctx.lineTo(cx, cy - L);
                ctx.stroke();
            }
        }
    }

    /**
     * Lista de tiles {col,row} que um perigo ocupa. spikeRow ocupa `count`
     * tiles a partir de (col,row): para a direita (horizontal) ou para baixo
     * (vertical, quando a onda vai para cima/baixo); os demais, 1 tile.
     */
    _hazardTiles(h) {
        const col = h.col ?? 0;
        const row = h.row ?? 0;
        if (h.type === "spikeRow") {
            const count = h.count || 4;
            const vertical = h.dir === "up" || h.dir === "down";
            const tiles = [];
            for (let i = 0; i < count; i++) {
                if (vertical) tiles.push({ col, row: Math.min(this.rows - 2, Math.max(1, row + i)) });
                else tiles.push({ col: Math.min(this.cols - 2, Math.max(1, col + i)), row });
            }
            return tiles;
        }
        return [{ col, row }];
    }

    // Seta da direção da onda. Peças antigas (sem `dir`) correm para a esquerda.
    _waveDirArrow(dir) {
        return { right: "→", left: "←", down: "↓", up: "↑" }[dir || "left"] || "←";
    }

    // Desenha sobre a fileira uma seta no sentido em que a onda se propaga.
    _renderWaveArrow(ctx, h, tiles, tileW) {
        if (!tiles.length) return;
        const dir = h.dir || "left";
        const [dx, dy] = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] }[dir] || [-1, 0];
        const forward = dir === "right" || dir === "down";
        const a = forward ? tiles[0] : tiles[tiles.length - 1];
        const b = forward ? tiles[tiles.length - 1] : tiles[0];
        const off = tileW * 0.3, head = tileW * 0.18;
        const sx = (a.col + 0.5) * tileW - dx * off, sy = (a.row + 0.5) * tileW - dy * off;
        const ex = (b.col + 0.5) * tileW + dx * off, ey = (b.row + 0.5) * tileW + dy * off;
        ctx.save();
        ctx.strokeStyle = "rgba(255, 137, 6, 0.95)";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        // Ponta da seta: duas abas na perpendicular (-dy, dx).
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - dx * head - dy * head, ey - dy * head + dx * head);
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - dx * head + dy * head, ey - dy * head - dx * head);
        ctx.stroke();
        ctx.restore();
    }

    /**
     * Renderiza inimigos utilizando EXATAMENTE um frame recortado do spritesheet
     * (não a imagem inteira comprimida).
     */
    _renderEnemies(ctx, tileW) {
        for (const foe of this.room.enemies) {
            const cx = foe.col * tileW + tileW / 2;
            const cy = foe.row * tileW + tileW / 2;

            const style = this._enemyEditorStyle(foe.type);

            // Anel de destaque sob o inimigo
            ctx.fillStyle = style.ring;
            ctx.beginPath();
            ctx.ellipse(cx, cy + 12, 24, 10, 0, 0, Math.PI * 2);
            ctx.fill();

            if (!this._drawEnemyPreview(ctx, foe.type, cx, cy - 4, style.scale)) {
                ctx.fillStyle = style.fallback;
                ctx.beginPath();
                ctx.arc(cx, cy, 18, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    // Cor do anel / escala de preview por tipo. Os dois originais mantêm o
    // visual de antes; os demais usam uma cor neutra.
    _enemyEditorStyle(type) {
        if (type === "demon") return { ring: "rgba(239, 69, 101, 0.25)", fallback: "#ef4565", scale: 1.45 };
        if (type === "bloodMonster") return { ring: "rgba(127, 90, 240, 0.25)", fallback: "#7f5af0", scale: 1.35 };
        return { ring: "rgba(255, 137, 6, 0.25)", fallback: "#ff8906", scale: 1.45 };
    }

    /**
     * Desenha o frame 0 do walk de um tipo de inimigo centrado em (cx, cy).
     * Usa a caixa do corpo (`body`) quando existir, senão o recorte da config.
     * `scale` = px de tela por px de arte; ou `fit` = {w, h} para caber numa caixa.
     * Retorna false se o tipo/imagem não estiver disponível.
     */
    _drawEnemyPreview(ctx, type, cx, cy, scale, fit = null) {
        const entry = ENEMY_TYPE_BY_KEY[type];
        if (!entry) return false;
        const cfg = entry.config(this.assets);
        const img = cfg.img;
        if (!img || !img.complete || img.naturalWidth === 0) return false;

        const r = cfg.body || { x: cfg.cropX, y: cfg.cropY, w: cfg.cropW, h: cfg.cropH };
        const sx = r.x;
        const sy = cfg.rows.walk.row * cfg.cellSize + r.y;
        const k = fit ? Math.min(fit.w / r.w, fit.h / r.h) : scale;
        const dw = r.w * k, dh = r.h * k;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, sx, sy, r.w, r.h, cx - dw / 2, cy - dh / 2, dw, dh);
        ctx.restore();
        return true;
    }

    // Cria um botão (radio) por tipo de ENEMY_TYPES no painel de Inimigos.
    _buildEnemyChoices() {
        const list = document.getElementById("enemy-choice-list");
        if (!list) return;
        list.innerHTML = "";
        for (const t of ENEMY_TYPES) {
            const label = document.createElement("label");
            label.className = "btn tool-enemy-btn";
            label.dataset.enemy = t.key;
            label.style.cssText = "display:flex; align-items:center; gap:8px; justify-content:flex-start;";

            const input = document.createElement("input");
            input.type = "radio";
            input.name = "enemy-choice";
            input.value = t.key;
            input.checked = t.key === this.selectedEnemy;
            input.onchange = () => {
                this.selectedEnemy = t.key;
                list.querySelectorAll(".tool-enemy-btn").forEach(l =>
                    l.classList.toggle("active", l.dataset.enemy === t.key));
            };

            const thumb = document.createElement("canvas");
            thumb.width = thumb.height = 32;
            thumb.dataset.enemyThumb = t.key;
            thumb.setAttribute("aria-hidden", "true");
            thumb.style.cssText = "width:32px; height:32px; image-rendering:pixelated; flex:none;";

            const text = document.createElement("span");
            text.textContent = t.label;

            label.classList.toggle("active", input.checked);
            label.append(input, thumb, text);
            list.appendChild(label);
        }
    }

    // Preenche as miniaturas dos botões de inimigo (após carregar os assets).
    _drawEnemyChoiceThumbs() {
        document.querySelectorAll("canvas[data-enemy-thumb]").forEach(c => {
            const ctx = c.getContext("2d");
            ctx.clearRect(0, 0, c.width, c.height);
            this._drawEnemyPreview(ctx, c.dataset.enemyThumb, c.width / 2, c.height / 2, 1, { w: c.width - 2, h: c.height - 2 });
        });
    }

    /**
     * Renderiza os Spawns dos Jogadores (onde P1 e P2 entram na sala).
     * Cada jogador nasce em um tile específico logo à frente da porta.
     */
    _renderPlayerSpawns(ctx, tileW) {
        const spawns = this._getPlayerSpawns();

        for (const sp of spawns) {
            ctx.save();

            // 1. Destaque do Tile de Spawn do P1 (Amarelo)
            const p1x = sp.p1.col * tileW;
            const p1y = sp.p1.row * tileW;
            ctx.fillStyle = "rgba(255, 209, 102, 0.22)";
            ctx.fillRect(p1x, p1y, tileW, tileW);
            ctx.strokeStyle = "#ffd166";
            ctx.lineWidth = 2;
            ctx.strokeRect(p1x + 1, p1y + 1, tileW - 2, tileW - 2);

            // 2. Destaque do Tile de Spawn do P2 (Azul)
            const p2x = sp.p2.col * tileW;
            const p2y = sp.p2.row * tileW;
            ctx.fillStyle = "rgba(107, 180, 219, 0.22)";
            ctx.fillRect(p2x, p2y, tileW, tileW);
            ctx.strokeStyle = "#6bb4db";
            ctx.lineWidth = 2;
            ctx.strokeRect(p2x + 1, p2y + 1, tileW - 2, tileW - 2);

            // 3. Linha de Corrente entre os centros dos dois tiles
            ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
            ctx.lineWidth = 2.5;
            ctx.setLineDash([3, 4]);
            ctx.beginPath();
            ctx.moveTo(sp.p1.x, sp.p1.y);
            ctx.lineTo(sp.p2.x, sp.p2.y);
            ctx.stroke();
            ctx.setLineDash([]);

            // Elos da corrente (círculo central)
            const midX = (sp.p1.x + sp.p2.x) / 2;
            const midY = (sp.p1.y + sp.p2.y) / 2;
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(midX, midY, 3, 0, Math.PI * 2);
            ctx.fill();

            // 4. Sprites de P1 e P2 nos centros de seus respectivos tiles
            this._drawPlayerSprite(ctx, sp.p1.x, sp.p1.y, "p1", "#ffd166", "P1");
            this._drawPlayerSprite(ctx, sp.p2.x, sp.p2.y, "p2", "#6bb4db", "P2");

            ctx.restore();
        }
    }

    _drawPlayerSprite(ctx, px, py, playerKey, glowColor, label) {
        // Sombra sob o jogador
        ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
        ctx.beginPath();
        ctx.ellipse(px, py + 14, 14, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Aura de cor do jogador
        ctx.fillStyle = glowColor;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;

        const sprite = this.assets.get(playerKey);
        if (sprite && sprite.complete) {
            // P1 & P2: cropX: 41, cropY: 37, cropW: 17, cropH: 23
            const sx = 41;
            const sy = 37;
            const sw = 17;
            const sh = 23;

            const scale = 1.4;
            const dw = sw * scale;
            const dh = sh * scale;

            ctx.drawImage(sprite, sx, sy, sw, sh, px - dw / 2, py - dh / 2, dw, dh);
        } else {
            ctx.beginPath();
            ctx.arc(px, py, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
    }

    /* --------------------------------------------------------------------------
     * EVENTOS DE ENTRADA & INTERAÇÃO COM O CANVAS
     * -------------------------------------------------------------------------- */
    _initEvents() {
        // Navegador de Formas e Variações (setas no header)
        const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
        bind("shape-prev", () => this._navShape(-1));
        bind("shape-next", () => this._navShape(1));
        bind("variant-prev", () => this._navVariant(-1));
        bind("variant-next", () => this._navVariant(1));
        bind("variant-new", () => this._newVariant());
        bind("btn-save-room", () => this._saveRoomToServer());
        bind("btn-delete-room", () => this._deleteRoomFromServer());

        // Cards colapsáveis da sidebar esquerda: clicar no título (h2) alterna
        // minimizar/expandir aquele card. Ao expandir, o card vira o "ativo"
        // (último interagido) e define this.activeTab para rotear os cliques
        // no grid para o modo correspondente.
        document.querySelectorAll(".group-title").forEach(h => {
            h.onclick = () => {
                const group = h.closest(".tool-group");
                if (!group) return;
                const id = group.dataset.group;
                const wasExpanded = group.classList.contains("expanded");

                group.classList.toggle("expanded");
                group.classList.toggle("collapsed");

                // Ao expandir, torna este o card ativo e re-renderiza.
                if (!wasExpanded) {
                    document.querySelectorAll(".tool-group").forEach(g => g.classList.remove("active"));
                    group.classList.add("active");
                    this.activeTab = id;
                    this.render();
                }
            };
        });

        // Limpar Buracos
        document.getElementById("btn-clear-holes").onclick = () => {
            this.room.holes.clear();
            this._rebuildAutotile();
            this._updateUIFromState();
            this.render();
        };

        document.getElementById("btn-clear-walls").onclick = () => {
            this.room.walls = [];
            this._updateWallsListUI();
            this._updateCodeOutput();
            this.render();
        };

        // Perigos
        document.querySelectorAll("[name='hazard-choice']").forEach(r => {
            r.onchange = () => { this.selectedHazard = r.value; };
        });
        const spikeTimingSelect = document.getElementById("spike-timing");
        if (spikeTimingSelect) {
            this.spikeTiming = spikeTimingSelect.value || "normal";
            spikeTimingSelect.onchange = () => { this.spikeTiming = spikeTimingSelect.value; };
        }
        const spikeDelayInput = document.getElementById("spike-delay");
        if (spikeDelayInput) {
            this.spikeDelay = Math.max(0, Number(spikeDelayInput.value) || 0);
            spikeDelayInput.oninput = () => { this.spikeDelay = Math.max(0, Number(spikeDelayInput.value) || 0); };
        }
        const spikeRowDirSelect = document.getElementById("spike-row-dir");
        if (spikeRowDirSelect) {
            this.spikeRowDir = spikeRowDirSelect.value || "right";
            spikeRowDirSelect.onchange = () => { this.spikeRowDir = spikeRowDirSelect.value; };
        }
        const spikeRowCountInput = document.getElementById("spike-row-count");
        if (spikeRowCountInput) {
            const readCount = () => Math.max(1, Math.round(Number(spikeRowCountInput.value) || 4));
            this.spikeRowCount = readCount();
            spikeRowCountInput.oninput = () => { this.spikeRowCount = readCount(); };
        }
        document.getElementById("btn-clear-hazards").onclick = () => {
            this.room.hazards = [];
            this._updateHazardsListUI();
            this._checkSpawnSafety();
            this._updateCodeOutput();
            this.render();
        };

        // Regra de trancamento das portas
        const lockSelect = document.getElementById("lock-rule");
        if (lockSelect) lockSelect.onchange = (e) => {
            this.room.lock = e.target.value;
            this._updateCodeOutput();
        };

        // Inimigos: um botão por tipo registrado em ENEMY_TYPES.
        this._buildEnemyChoices();
        document.getElementById("btn-clear-enemies").onclick = () => {
            this.room.enemies = [];
            this._updateEnemiesListUI();
            this._updateCodeOutput();
            this.render();
        };
        document.getElementById("btn-distribute-circle").onclick = () => {
            this._distributeEnemiesCircle();
        };

        // Tochas
        const btnClearTorches = document.getElementById("btn-clear-torches");
        if (btnClearTorches) btnClearTorches.onclick = () => {
            this.room.torches = [];
            this._updateTorchesListUI();
            this._updateCodeOutput();
            this.render();
        };
        document.querySelectorAll("[name='torch-choice']").forEach(radio => {
            radio.onchange = () => { this.selectedTorchType = radio.value; };
        });

        // Props
        document.querySelectorAll("[name='prop-choice']").forEach(r => {
            r.onchange = () => { this.selectedProp = parseInt(r.value, 10); };
        });
        const btnClearProps = document.getElementById("btn-clear-props");
        if (btnClearProps) btnClearProps.onclick = () => {
            this.room.props = [];
            this._updatePropsListUI();
            this._updateCodeOutput();
            this.render();
        };

        // Props aleatórios (scatter)
        const toggleScatter = document.getElementById("toggle-scatter-props");
        if (toggleScatter) toggleScatter.onchange = (e) => {
            this.room.scatterProps.enabled = e.target.checked;
            // Modo exclusivo: ligar o scatter limpa os props manuais.
            if (e.target.checked && this.room.props.length) this.room.props = [];
            this._syncScatterUI();
            this._updatePropsListUI();
            this._updateCodeOutput();
            this.render();
        };
        const scatterSlider = document.getElementById("scatter-density");
        if (scatterSlider) scatterSlider.oninput = (e) => {
            this.room.scatterProps.density = parseInt(e.target.value, 10) / 100;
            this._syncScatterUI();
            this._updateCodeOutput();
            this.render();
        };

        // Spawns Players Toggle (na aba e na barra de ferramentas)
        const toggleSpawnsAba = document.getElementById("toggle-show-spawns");
        const toggleSpawnsBar = document.getElementById("toggle-spawns");
        if (toggleSpawnsAba) {
            toggleSpawnsAba.onchange = (e) => {
                this.showPlayerSpawns = e.target.checked;
                if (toggleSpawnsBar) toggleSpawnsBar.checked = e.target.checked;
                this.render();
            };
        }
        if (toggleSpawnsBar) {
            toggleSpawnsBar.onchange = (e) => {
                this.showPlayerSpawns = e.target.checked;
                if (toggleSpawnsAba) toggleSpawnsAba.checked = e.target.checked;
                this.render();
            };
        }

        // Spawn do teste (Centro / portas / Personalizado)
        const testSpawnSel = document.getElementById("test-spawn-mode");
        if (testSpawnSel) {
            testSpawnSel.onchange = (e) => {
                // Mantém os tiles personalizados ao alternar, para poder voltar.
                this.testSpawn = { ...this.testSpawn, mode: e.target.value };
                this._saveTestSpawn();
                this._updateTestSpawnUI();
                this.render();
            };
        }

        // Alternadores de Exibição
        document.getElementById("toggle-grid").onchange = (e) => { this.showGrid = e.target.checked; this.render(); };
        document.getElementById("toggle-doors").onchange = (e) => { this.showDoors = e.target.checked; this.render(); };

        // Botões de Zoom & Pan
        document.getElementById("btn-zoom-in").onclick = () => { this.zoom = Math.min(2.5, this.zoom * 1.2); this.render(); };
        document.getElementById("btn-zoom-out").onclick = () => { this.zoom = Math.max(0.4, this.zoom / 1.2); this.render(); };
        document.getElementById("btn-zoom-reset").onclick = () => { this.zoom = 1.0; this.panX = 0; this.panY = 0; this.render(); };
        document.getElementById("btn-fit-screen").onclick = () => { this._fitScreen(); this.render(); };

        // Modal
        document.getElementById("modal-close-btn").onclick = () => { this._closeModal(); };
        document.getElementById("modal-cancel-btn").onclick = () => { this._closeModal(); };

        // Testar no Jogo
        document.getElementById("btn-playtest").onclick = () => { this._playtestInGame(); };

        // Cobertura de peças
        const btnCoverage = document.getElementById("btn-coverage");
        if (btnCoverage) btnCoverage.onclick = () => { this._openCoverageModal(); };
        const covClose = document.getElementById("coverage-close-btn");
        const covDismiss = document.getElementById("coverage-dismiss-btn");
        const covRefresh = document.getElementById("coverage-refresh-btn");
        if (covClose) covClose.onclick = () => { document.getElementById("coverage-modal").classList.remove("active"); };
        if (covDismiss) covDismiss.onclick = () => { document.getElementById("coverage-modal").classList.remove("active"); };
        if (covRefresh) covRefresh.onclick = () => { this._renderCoverage(true); };

        // Interação com o Canvas da Sala (Mouse)
        this.container.onmousedown = (e) => { this._onMouseDown(e); };
        window.onmousemove = (e) => { this._onMouseMove(e); };
        window.onmouseup = () => { this._onMouseUp(); };
        this.container.onmouseleave = () => { this.hoverTile = null; this.render(); };
        this.container.onwheel = (e) => { this._onWheel(e); };
        window.onresize = () => { this._fitScreen(); this.render(); };
    }

    _fitScreen() {
        const containerRect = this.container.getBoundingClientRect();
        this.canvas.width = Math.max(100, Math.floor(containerRect.width));
        this.canvas.height = Math.max(100, Math.floor(containerRect.height));

        const roomW = this.cols * this.tilePx;
        const roomH = this.rows * this.tilePx;

        const padding = 60;
        const scaleX = (this.canvas.width - padding) / roomW;
        const scaleY = (this.canvas.height - padding) / roomH;
        this.zoom = Math.max(0.4, Math.min(scaleX, scaleY, 1.25));

        this.panX = Math.round((this.canvas.width - roomW * this.zoom) / 2);
        this.panY = Math.round((this.canvas.height - roomH * this.zoom) / 2);
    }

    _screenToTile(screenX, screenY) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = screenX - rect.left;
        const mouseY = screenY - rect.top;

        const worldX = (mouseX - this.panX) / this.zoom;
        const worldY = (mouseY - this.panY) / this.zoom;

        const col = Math.floor(worldX / this.tilePx);
        const row = Math.floor(worldY / this.tilePx);

        return { col, row, localX: worldX, localY: worldY };
    }

    _onMouseDown(e) {
        // Ignora cliques em elementos sobrepostos ao canvas (setas de forma/variação),
        // para que a navegação não dispare mutação na célula do grid por baixo.
        if (e.target !== this.canvas) return;

        if (e.button === 1 || e.shiftKey || e.altKey) {
            // Pan
            this.isPanning = true;
            this.lastMouse = { x: e.clientX, y: e.clientY };
            this.container.classList.add("panning");
            return;
        }

        if (e.button === 0) {
            this.isMouseDown = true;
            this._handleCanvasAction(e);
        }
    }

    _onMouseMove(e) {
        if (this.isPanning) {
            const dx = e.clientX - this.lastMouse.x;
            const dy = e.clientY - this.lastMouse.y;
            this.panX += dx;
            this.panY += dy;
            this.lastMouse = { x: e.clientX, y: e.clientY };
            this.render();
            return;
        }

        const { col, row, localX, localY } = this._screenToTile(e.clientX, e.clientY);
        this.hoverTile = { col, row };

        if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
            document.getElementById("status-coords").textContent = `Tile: Col ${col}, Linha ${row} | Mundo: (${Math.round(localX)}, ${Math.round(localY)}) px`;
        } else {
            document.getElementById("status-coords").textContent = `Fora da Sala | (${Math.round(localX)}, ${Math.round(localY)}) px`;
        }

        // Se estiver com mouse pressionado na aba de buracos, permite abrir/tapar buracos continuamente
        if (this.isMouseDown && (this.activeTab === "tab-holes" || this.activeTab === "tab-floor-tiles")) {
            const key = `${col},${row}`;
            if (this.lastToggledHole !== key) {
                this.lastToggledHole = key;
                if (this.activeTab === "tab-holes") this._toggleHole(col, row);
                else this._paintEmptyFloorTile(col, row);
            }
        } else {
            this.render();
        }
    }

    _onMouseUp() {
        this.isMouseDown = false;
        this.isPanning = false;
        this.lastToggledHole = null;
        this.container.classList.remove("panning");
        this.render();
    }

    _onWheel(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const oldZoom = this.zoom;
        const factor = e.deltaY < 0 ? 1.15 : 0.85;
        const newZoom = Math.max(0.35, Math.min(3.0, oldZoom * factor));
        if (newZoom === oldZoom) return;

        const worldX = (mouseX - this.panX) / oldZoom;
        const worldY = (mouseY - this.panY) / oldZoom;

        this.panX = mouseX - worldX * newZoom;
        this.panY = mouseY - worldY * newZoom;
        this.zoom = newZoom;

        const { col, row } = this._screenToTile(e.clientX, e.clientY);
        this.hoverTile = { col, row };
        this.render();
    }

    _handleCanvasAction(e) {
        const { col, row, localX, localY } = this._screenToTile(e.clientX, e.clientY);
        if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return;

        if (this.activeTab === "tab-holes") {
            this._toggleHole(col, row);
        } else if (this.activeTab === "tab-floor-tiles") {
            this._paintEmptyFloorTile(col, row);
        } else if (this.activeTab === "tab-walls") {
            this._toggleWallAt(col, row);
        } else if (this.activeTab === "tab-torches") {
            this._toggleTorchAt(col, row);
        } else if (this.activeTab === "tab-props") {
            this._togglePropAt(col, row);
        } else if (this.activeTab === "tab-challenges") {
            this._addHazardAt(col, row);
        } else if (this.activeTab === "tab-enemies") {
            this._addEnemyAt(col, row);
        } else if (this.activeTab === "tab-spawns") {
            this._setCustomTestSpawn(col, row);
        }
    }


    _toggleWallAt(col, row) {
        const onBorder = col === 0 || col === this.cols - 1 || row === 0 || row === this.rows - 1;
        // Nas bordas é permitido trocar a parede, exceto nas aberturas das portas
        // (uma parede ali bloquearia a passagem dos players).
        if (onBorder && this._isDoorTile(col, row)) return;

        const key = String(col) + "," + String(row);
        const tile = Number(document.getElementById("wall-tile")?.value || 0);
        const existing = this.room.walls.findIndex(w => String(w.col) + "," + String(w.row) === key);

        if (existing >= 0) {
            const wall = this.room.walls[existing];
            if (Number(wall.tile) === tile) {
                // Mesmo bloco: clicar de novo remove (volta à parede/piso original).
                this.room.walls.splice(existing, 1);
            } else {
                // Bloco diferente: substitui pelo selecionado.
                wall.tile = tile;
                wall.side = this._wallSideForTile(tile);
            }
        } else {
            if (!onBorder) {
                // No interior, não bloqueia o spawn dos players nem coloca parede sobre buraco.
                const spawns = this._getPlayerSpawns();
                if (spawns.some(sp => (sp.p1.col === col && sp.p1.row === row) || (sp.p2.col === col && sp.p2.row === row))) return;
                if (this.room.holes.has(key)) return;
            }
            this.room.walls.push({ col, row, tile, side: this._wallSideForTile(tile) });
        }
        this._updateWallsListUI();
        this._updateCodeOutput();
        this.render();
    }

    // Tile de borda que faz parte da abertura de uma porta ativa.
    _isDoorTile(col, row) {
        const s = this.room.sockets;
        const inSpan = (sock, v) => !!sock && v >= sock.offset && v < sock.offset + sock.span;
        if (row === 0 && inSpan(s.N, col)) return true;
        if (row === this.rows - 1 && inSpan(s.S, col)) return true;
        if (col === this.cols - 1 && inSpan(s.E, row)) return true;
        if (col === 0 && inSpan(s.W, row)) return true;
        return false;
    }

    _wallSideForTile(tile) {
        const id = Number(tile);
        if ((id >= 1 && id <= 4) || (id >= 50 && id <= 55)) return "top";
        if ([5, 15, 25, 35, 45].includes(id)) return "left";
        if ([0, 10, 20, 30, 40].includes(id)) return "right";
        if (id >= 41 && id <= 44) return "bottom";
        return "top";
    }

    _paintEmptyFloorTile(col, row) {
        const key = String(col) + "," + String(row);
        if (this.room.walls.some(w => w.col === col && w.row === row)) return;
        this.room.holes.delete(key);
        this.room.floorOverrides[key] = EMPTY_FLOOR_TILE;
        this._rebuildAutotile();
        this._updateUIFromState();
        this._updateCodeOutput();
        this.render();
    }
    _toggleHole(col, row) {
        // Tiles onde os jogadores nascem logo à frente da porta não podem ser buraco!
        const spawns = this._getPlayerSpawns();
        for (const sp of spawns) {
            if ((sp.p1.col === col && sp.p1.row === row) || (sp.p2.col === col && sp.p2.row === row)) {
                return; // Protegido contra abismo
            }
        }

        const key = `${col},${row}`;
        if (!this.room.holes.has(key) && this.room.walls.some(w => w.col === col && w.row === row)) return;
        if (this.room.holes.has(key)) {
            this.room.holes.delete(key);
        } else {
            this.room.holes.add(key);
        }

        this._rebuildAutotile();
        this._updateUIFromState();
        this.render();
    }

    /**
     * Adiciona um perigo no TILE (col,row) clicado. Um perigo por tile: se já
     * houver outro perigo ocupando o mesmo tile, não duplica.
     */
    _addHazardAt(col, row) {
        const type = this.selectedHazard;

        // Flechas podem ser montadas nas paredes editáveis ou no contorno da sala.
        let arrowSide = null;
        if (type === "arrow") {
            const mountedWall = (this.room.walls || []).find(w => Number(w.col) === col && Number(w.row) === row);
            if (mountedWall) {
                arrowSide = mountedWall.side || this._wallSideForTile(mountedWall.tile);
            } else {
                const lastCol = this.cols - 1, lastRow = this.rows - 1;
                const distances = [
                    { side: "top", distance: row },
                    { side: "bottom", distance: lastRow - row },
                    { side: "left", distance: col },
                    { side: "right", distance: lastCol - col }
                ];
                arrowSide = distances.reduce((best, item) => item.distance < best.distance ? item : best).side;
                if (arrowSide === "top") row = 0;
                else if (arrowSide === "bottom") row = lastRow;
                else if (arrowSide === "left") col = 0;
                else col = lastCol;
                col = Math.min(lastCol, Math.max(0, col));
                row = Math.min(lastRow, Math.max(0, row));
            }
        } else if (col === 0 || col === this.cols - 1 || row === 0 || row === this.rows - 1) {
            return;
        }

        const newHazard = { type, col, row };

        if (type === "spike" || type === "spikeRow") newHazard.timing = this.spikeTiming || "normal";
        if (type === "spike" || type === "spikeRow") newHazard.delay = this.spikeDelay || 0;

        if (type === "spikeRow") {
            const dir = this.spikeRowDir || "right";
            const vertical = dir === "up" || dir === "down";
            const maxLen = (vertical ? this.rows : this.cols) - 2;
            newHazard.dir = dir;
            newHazard.count = Math.max(1, Math.min(this.spikeRowCount || 4, maxLen));
            newHazard.phase = 0.0;
            newHazard.wave = 0.12;
            // Ancora no tile clicado e recua para a fileira não atravessar a parede.
            if (vertical) newHazard.row = Math.max(1, Math.min(row, this.rows - 1 - newHazard.count));
            else newHazard.col = Math.max(1, Math.min(col, this.cols - 1 - newHazard.count));
        } else if (type === "arrow") {
            newHazard.side = arrowSide || (row === 0 ? "top" : row === this.rows - 1 ? "bottom" : col === 0 ? "left" : "right");
            newHazard.phase = 0.0;
        }

        // Impede dois perigos no mesmo tile (considera todos os tiles da fileira).
        const newTiles = this._hazardTiles(newHazard);
        const occupied = this.room.hazards.some(h =>
            this._hazardTiles(h).some(t => newTiles.some(n => n.col === t.col && n.row === t.row))
        );
        if (occupied) return;

        this.room.hazards.push(newHazard);
        this._updateHazardsListUI();
        this._checkSpawnSafety();
        this._updateCodeOutput();
        this.render();
    }

    _addEnemyAt(col, row) {
        if (col === 0 || col === this.cols - 1 || row === 0 || row === this.rows - 1) return;
        if (this.room.enemies.some(e => e.col === col && e.row === row)) return;

        this.room.enemies.push({
            type: this.selectedEnemy,
            col,
            row
        });

        this._updateEnemiesListUI();
        this._updateCodeOutput();
        this.render();
    }

    /**
     * Coloca/remove uma tocha numa PAREDE (borda da sala). O lado (side) é
     * deduzido da borda clicada e define para onde a luz é empurrada no jogo.
     */
    _toggleTorchAt(col, row) {
        const type = this.selectedTorchType || "torch";
        const mountedWall = (this.room.walls || []).find(w => w.col === col && w.row === row);
        if (mountedWall && type !== "candlestick_1" && type !== "candlestick_2") {
            const wallSide = mountedWall.side || this._wallSideForTile(mountedWall.tile);
            const side = { top: "N", bottom: "S", left: "E", right: "W" }[wallSide] || "N";
            const offsets = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] };
            const [dc, dr] = offsets[wallSide] || [0, -1];
            const torchCol = col + dc, torchRow = row + dr;
            if (torchCol < 0 || torchCol >= this.cols || torchRow < 0 || torchRow >= this.rows) return;
            const i = this.room.torches.findIndex(t => t.col === torchCol && t.row === torchRow);
            if (i >= 0) this.room.torches.splice(i, 1);
            else if (!this.room.holes.has(`${torchCol},${torchRow}`)) {
                this.room.torches.push({ col: torchCol, row: torchRow, side, type });
            }
            this._updateTorchesListUI();
            this._updateCodeOutput();
            this.render();
            return;
        }
        if (type === "candlestick_1" || type === "candlestick_2") {
            if (col === 0 || col === this.cols - 1 || row === 0 || row === this.rows - 1) return;
            if (this.room.holes.has(`${col},${row}`)) return;
            const i = this.room.torches.findIndex(t => t.col === col && t.row === row);
            if (i >= 0) this.room.torches.splice(i, 1);
            else this.room.torches.push({ col, row, side: "F", type });
            this._updateTorchesListUI();
            this._updateCodeOutput();
            this.render();
            return;
        }

        const last = this.cols - 1, bottom = this.rows - 1;
        const onBorder = col === 0 || col === last || row === 0 || row === bottom;
        // Também aceita clique no PISO logo à frente das paredes laterais
        // (col 1 ou last-1), que é onde o sprite da tocha lateral encaixa.
        const nearSideWall = (col === 1 || col === last - 1) && row > 0 && row < bottom;
        if (!onBorder && !nearSideWall) return;

        // Deduz o lado da parede a que a tocha pertence e normaliza a COLUNA
        // para o tile correto: paredes N/S ficam na própria borda (row 0/bottom);
        // paredes E/W ficam no PISO à frente (col 1 à esquerda, last-1 à direita).
        let side, tcol = col, trow = row;
        if (row === 0) { side = "N"; }
        else if (row === bottom) { side = "S"; }
        else if (col === 0 || col === 1) { side = "W"; tcol = 1; }
        else if (col === last || col === last - 1) { side = "E"; tcol = last - 1; }
        else return;

        // Não coloca tocha sobre o vão de porta (nem no piso à frente dele).
        const midC = (this.cols / 2) | 0;
        const midR = (this.rows / 2) | 0;
        const blockN = this.room.sockets.N && side === "N" && (tcol === midC - 1 || tcol === midC);
        const blockS = this.room.sockets.S && side === "S" && (tcol === midC - 1 || tcol === midC);
        const blockW = this.room.sockets.W && side === "W" && (trow === midR - 1 || trow === midR);
        const blockE = this.room.sockets.E && side === "E" && (trow === midR - 1 || trow === midR);
        if (blockN || blockS || blockW || blockE) return;

        const i = this.room.torches.findIndex(t => t.col === tcol && t.row === trow);
        if (i >= 0) {
            this.room.torches.splice(i, 1);
        } else {
            this.room.torches.push({ col: tcol, row: trow, side });
        }

        this._updateTorchesListUI();
        this._updateCodeOutput();
        this.render();
    }

    /** Reflete o estado de scatterProps nos controles da UI. */
    _syncScatterUI() {
        const sp = this.room.scatterProps || { enabled: false, density: 0.08 };
        const toggle = document.getElementById("toggle-scatter-props");
        const row = document.getElementById("scatter-density-row");
        const val = document.getElementById("scatter-density-val");
        const slider = document.getElementById("scatter-density");
        const manual = document.getElementById("props-manual-section");
        if (toggle) toggle.checked = sp.enabled;
        if (row) row.style.display = sp.enabled ? "block" : "none";
        if (slider) slider.value = Math.round(sp.density * 100);
        if (val) val.textContent = `${Math.round(sp.density * 100)}%`;
        // Modo exclusivo: desativa a seção de colocação manual quando ligado.
        if (manual) {
            manual.style.opacity = sp.enabled ? "0.4" : "1";
            manual.style.pointerEvents = sp.enabled ? "none" : "auto";
        }
    }

    /** Coloca/remove um prop decorativo num tile de piso interno. */
    _togglePropAt(col, row) {
        // Modo aleatório ligado: colocação manual desativada.
        if (this.room.scatterProps && this.room.scatterProps.enabled) return;
        if (col === 0 || col === this.cols - 1 || row === 0 || row === this.rows - 1) return;

        const i = this.room.props.findIndex(p => p.col === col && p.row === row);
        if (i >= 0) {
            this.room.props.splice(i, 1);
        } else {
            this.room.props.push({ col, row, index: this.selectedProp, flip: false });
        }

        this._updatePropsListUI();
        this._updateCodeOutput();
        this.render();
    }

    _distributeEnemiesCircle() {
        this.room.enemies = [];
        const midC = (this.cols / 2) | 0;
        const midR = (this.rows / 2) | 0;
        const radius = Math.min(this.cols, this.rows) * 0.28;
        const count = 4;

        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const c = Math.round(midC + Math.cos(angle) * (radius * 1.2));
            const r = Math.round(midR + Math.sin(angle) * radius);
            this.room.enemies.push({
                type: (i % 2 === 0) ? "demon" : "bloodMonster",
                col: Math.max(1, Math.min(this.cols - 2, c)),
                row: Math.max(1, Math.min(this.rows - 2, r))
            });
        }

        this._updateEnemiesListUI();
        this._updateCodeOutput();
        this.render();
    }

    /* --------------------------------------------------------------------------
     * EXPORTAÇÃO, IMPORTAÇÃO & TESTE NO JOGO
     * -------------------------------------------------------------------------- */
    _exportJSON() {
        const exportData = {
            id: this.room.id,
            name: this.room.name,
            cols: this.cols,
            rows: this.rows,
            kind: this.room.kind,
            type: this.room.type,
            doors: {
                N: !!this.room.sockets.N,
                S: !!this.room.sockets.S,
                E: !!this.room.sockets.E,
                W: !!this.room.sockets.W
            },
            holes: Array.from(this.room.holes),
            walls: this.room.walls,
            // Grade de tiles já com os buracos aplicados (-1). É o que a engine
            // consome como `customFloor`, preservando os abismos no jogo.
            floor: this.room.floor,
            hazards: this.room.hazards,
            enemies: this.room.enemies,
            torches: this.room.torches,
            props: this.room.scatterProps.enabled ? [] : this.room.props,
            scatterProps: this.room.scatterProps
        };
        // Só grava a regra de trancamento se não for "auto" (padrão deduzido).
        if (this.room.lock && this.room.lock !== "auto") exportData.lock = this.room.lock;

        const jsonStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${this.room.id}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /* --------------------------------------------------------------------------
     * COBERTURA DE PEÇAS — quais formas já foram feitas e quantas variações
     * -------------------------------------------------------------------------- */

    // Formas esperadas: cada assinatura de portas (N,E,S,W) com nome amigável,
    // agrupadas por categoria. É o "checklist" de peças a desenhar.
    _expectedShapes() {
        const d = (N, E, S, W) => ({ N, E, S, W });
        return [
            { group: "Cruzamento (4 vias)", items: [
                { name: "Cruzamento", doors: d(1, 1, 1, 1) }
            ]},
            { group: "Junções T (3 vias)", items: [
                { name: "T sem Sul (N,E,W)", doors: d(1, 1, 0, 1) },
                { name: "T sem Norte (S,E,W)", doors: d(0, 1, 1, 1) },
                { name: "T sem Oeste (N,S,E)", doors: d(1, 1, 1, 0) },
                { name: "T sem Leste (N,S,W)", doors: d(1, 0, 1, 1) }
            ]},
            { group: "Corredores retos (2 vias)", items: [
                { name: "Corredor Leste-Oeste", doors: d(0, 1, 0, 1) },
                { name: "Corredor Norte-Sul", doors: d(1, 0, 1, 0) }
            ]},
            { group: "Curvas em L (2 vias)", items: [
                { name: "Curva N-E", doors: d(1, 1, 0, 0) },
                { name: "Curva N-O", doors: d(1, 0, 0, 1) },
                { name: "Curva S-E", doors: d(0, 1, 1, 0) },
                { name: "Curva S-O", doors: d(0, 0, 1, 1) }
            ]},
            { group: "Dead-ends (1 via)", items: [
                { name: "Entrada Norte", doors: d(1, 0, 0, 0) },
                { name: "Entrada Leste", doors: d(0, 1, 0, 0) },
                { name: "Entrada Sul", doors: d(0, 0, 1, 0) },
                { name: "Entrada Oeste", doors: d(0, 0, 0, 1) }
            ]}
        ];
    }

    async _openCoverageModal() {
        document.getElementById("coverage-modal").classList.add("active");
        await this._renderCoverage(false);
    }

    async _renderCoverage(forceReload) {
        const body = document.getElementById("coverage-body");
        const summary = document.getElementById("coverage-summary");
        body.innerHTML = `<div style="padding:12px; color:var(--text-dim);">Carregando peças de /map...</div>`;

        // (Re)carrega o catálogo de /map.
        if (forceReload || !this._coverageCatalog) {
            this._coverageCatalog = new RoomCatalog();
            await this._coverageCatalog.load();
        }
        const catalog = this._coverageCatalog;

        // Conta variações por "tipo|assinatura".
        const countByKey = new Map();
        for (const p of catalog.pieces) {
            const type = (p.type === "start" || p.type === "boss") ? p.type : "normal";
            const key = `${type}|${doorSignature(p.doors)}`;
            countByKey.set(key, (countByKey.get(key) || 0) + 1);
        }

        const groups = this._expectedShapes();
        let totalShapes = 0, doneShapes = 0, totalVariants = 0, missing = 0;
        let html = "";

        // Seções normais (por forma de portas).
        for (const g of groups) {
            let rows = "";
            for (const item of g.items) {
                totalShapes++;
                const key = `normal|${doorSignature(item.doors)}`;
                const n = countByKey.get(key) || 0;
                totalVariants += n;
                if (n > 0) doneShapes++; else missing++;
                const badge = n > 0
                    ? `<span class="status-badge ok">${n} variação${n > 1 ? "ões" : ""}</span>`
                    : `<span class="status-badge warn">faltando</span>`;
                rows += `<div class="status-item"><span>${item.name}</span>${badge}</div>`;
            }
            html += `<div class="card" style="margin-bottom:8px;">
                <div class="panel-title">${g.group}</div>${rows}</div>`;
        }

        // Especiais: Start e Boss (contadas por tipo, qualquer assinatura).
        const startN = catalog.pieces.filter(p => p.type === "start").length;
        const bossN = catalog.pieces.filter(p => p.type === "boss").length;
        const specialRow = (label, n) => {
            const badge = n > 0
                ? `<span class="status-badge ok">${n} variação${n > 1 ? "ões" : ""}</span>`
                : `<span class="status-badge warn">faltando</span>`;
            return `<div class="status-item"><span>${label}</span>${badge}</div>`;
        };
        html += `<div class="card" style="margin-bottom:8px;">
            <div class="panel-title">Especiais</div>
            ${specialRow("Sala Inicial (start)", startN)}
            ${specialRow("Sala do Chefe (boss)", bossN)}</div>`;

        totalShapes += 2;
        if (startN > 0) doneShapes++; else missing++;
        if (bossN > 0) doneShapes++; else missing++;
        totalVariants += startN + bossN;

        summary.innerHTML = `
            <strong>${doneShapes}/${totalShapes}</strong> formas com ao menos 1 peça ·
            <strong>${totalVariants}</strong> variações no total ·
            <span style="color:${missing > 0 ? "#ffb020" : "#2cb67d"};">${missing} faltando</span>`;
        body.innerHTML = html;
    }

    /**
     * Salva a peça atual na pasta /map via POST ao servidor (serve.py), que
     * grava o arquivo com nome automático e atualiza o index.json. Depois
     * recarrega o catálogo e reposiciona o navegador na variação recém-criada.
     */
    async _saveRoomToServer() {
        const payload = this._sceneToData();
        // Props: modo exclusivo (scatter vs manual) já é tratado em _sceneToData.
        if (this.room.lock && this.room.lock !== "auto") payload.lock = this.room.lock;

        try {
            const res = await fetch("/api/save-room", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.ok) {
                alert("❌ Falha ao salvar: " + (data.error || `HTTP ${res.status}`) +
                    "\n\nDica: reinicie o servidor (python serve.py) para habilitar o salvamento.");
                return;
            }

            // Recarrega o catálogo para refletir a nova peça e aponta para ela.
            this.catalog = new RoomCatalog();
            await this.catalog.load();
            const shape = this._allShapes()[this.shapeIndex];
            const variants = this._variantsForShape(shape);
            this.variantIndex = Math.max(0, variants.length - 1); // última = recém-salva
            this._updateShapeNavUI();
            alert(`✅ Peça salva como ${data.file} (${data.count} peças no total).`);
        } catch (e) {
            alert("❌ Não foi possível contatar o servidor: " + e.message +
                "\n\nVocê precisa rodar 'python serve.py' (versão com /api/save-room).");
        }
    }

    /**
     * Deleta a VARIAÇÃO atual (apaga o arquivo de /map e tira do index). Só
     * funciona quando a variação exibida é uma peça existente (não o molde
     * "nova variação"). Pede confirmação antes.
     */
    async _deleteRoomFromServer() {
        const shape = this._allShapes()[this.shapeIndex];
        const variants = this._variantsForShape(shape);
        const piece = variants[this.variantIndex];

        if (!piece || !piece.__file) {
            alert("Nada para deletar: esta é uma variação nova ainda não salva.\nUse as setas de variação para selecionar uma peça existente.");
            return;
        }

        if (!confirm(`Deletar a peça "${piece.__file}"?\nEsta ação remove o arquivo de /map e não pode ser desfeita.`)) {
            return;
        }

        try {
            const res = await fetch("/api/delete-room", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ file: piece.__file })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.ok) {
                alert("❌ Falha ao deletar: " + (data.error || `HTTP ${res.status}`) +
                    "\n\nDica: reinicie o servidor (python serve.py) para habilitar.");
                return;
            }

            // Recarrega o catálogo e reposiciona na forma (variação válida ou molde).
            this.catalog = new RoomCatalog();
            await this.catalog.load();
            const left = this._variantsForShape(shape);
            this.variantIndex = Math.min(this.variantIndex, left.length); // clamp (left.length = slot "nova")
            this._loadCurrentShapeVariant();
            alert(`🗑️ Peça "${data.file}" deletada (${data.count} peças restantes).`);
        } catch (e) {
            alert("❌ Não foi possível contatar o servidor: " + e.message +
                "\n\nVocê precisa rodar 'python serve.py' (versão com /api/delete-room).");
        }
    }

    _openImportModal() {
        const modal = document.getElementById("modal-box");
        const title = document.getElementById("modal-title");
        const textarea = document.getElementById("modal-textarea");
        const actionBtn = document.getElementById("modal-action-btn");

        title.textContent = "Importar Sala (Cole o JSON)";
        textarea.value = "";
        actionBtn.textContent = "Carregar Sala";

        actionBtn.onclick = () => {
            try {
                const data = JSON.parse(textarea.value);
                this._importFromData(data);
                this._closeModal();
            } catch (err) {
                alert("❌ JSON inválido: " + err.message);
            }
        };

        modal.classList.add("active");
    }

    _importFromData(data) {
        this.cols = data.cols || ROOM_COLS;
        this.rows = data.rows || ROOM_ROWS;
        this.room.id = data.id || "imported_room";
        this.room.name = data.name || "Sala Importada";
        this.room.cols = this.cols;
        this.room.rows = this.rows;
        this.room.kind = data.kind || "room";
        this.room.type = data.type || "normal";
        this.room.hazards = data.hazards || [];
        this.room.walls = data.walls || [];
        this.room.enemies = data.enemies || [];
        this.room.torches = data.torches || [];
        this.room.props = data.props || [];
        this.room.scatterProps = data.scatterProps || { enabled: false, density: 0.08 };
        this.room.lock = data.lock || "auto";
        this.room.holes = new Set(data.holes || []);
        this.room.floorOverrides = data.floorOverrides || {};
        if (!data.floorOverrides && Array.isArray(data.floor)) {
            for (let r = 0; r < data.floor.length; r++) {
                for (let c = 0; c < (data.floor[r] || []).length; c++) {
                    if (data.floor[r][c] === EMPTY_FLOOR_TILE) this.room.floorOverrides[String(c) + "," + String(r)] = EMPTY_FLOOR_TILE;
                }
            }
        }

        this.room.sockets = { N: null, S: null, E: null, W: null };
        if (data.doors) {
            const midC = (this.cols / 2) | 0;
            const midR = (this.rows / 2) | 0;
            if (data.doors.N) this.room.sockets.N = new RoomSocket({ dir: "N", offset: midC - 1, span: 2 });
            if (data.doors.S) this.room.sockets.S = new RoomSocket({ dir: "S", offset: midC - 1, span: 2 });
            if (data.doors.E) this.room.sockets.E = new RoomSocket({ dir: "E", offset: midR - 1, span: 2 });
            if (data.doors.W) this.room.sockets.W = new RoomSocket({ dir: "W", offset: midR - 1, span: 2 });
        }

        this._rebuildAutotile();
        this._updateUIFromState();
        this._fitScreen();
        this.render();
    }

    _closeModal() {
        document.getElementById("modal-box").classList.remove("active");
    }

    /**
     * Envia os dados da sala atual para o sessionStorage e redireciona para o jogo.
     */
    _playtestInGame() {
        const playtestData = {
            id: this.room.id,
            name: this.room.name,
            cols: this.cols,
            rows: this.rows,
            kind: this.room.kind,
            type: this.room.type,
            doors: {
                N: !!this.room.sockets.N,
                S: !!this.room.sockets.S,
                E: !!this.room.sockets.E,
                W: !!this.room.sockets.W
            },
            holes: Array.from(this.room.holes),
            walls: this.room.walls,
            // Grade de tiles já com os buracos aplicados (-1), consumida pela
            // engine como `customFloor` — é o que preserva os abismos no jogo.
            floor: this.room.floor,
            hazards: this.room.hazards,
            enemies: this.room.enemies,
            torches: this.room.torches,
            props: this.room.scatterProps.enabled ? [] : this.room.props,
            scatterProps: this.room.scatterProps
        };
        if (this.room.lock && this.room.lock !== "auto") playtestData.lock = this.room.lock;

        // Spawn escolhido na aba "Spawns Players" (tiles locais da sala).
        const sp = this._resolveTestSpawn();
        playtestData.testSpawn = {
            p1: { col: sp.p1.col, row: sp.p1.row },
            p2: { col: sp.p2.col, row: sp.p2.row }
        };

        sessionStorage.setItem("editor_custom_room", JSON.stringify(playtestData));
        // Garante que a cena do editor fique salva antes de sair para o teste.
        this._saveState();
        window.location.href = "index.html?playtest=true";
    }
}

// Inicia o editor quando o DOM estiver pronto
window.addEventListener("DOMContentLoaded", () => {
    window.editorApp = new RoomEditor();
});
