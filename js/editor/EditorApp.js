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
import { CHALLENGE_LAYOUTS } from '../systems/ChallengeLayouts.js';
import { RoomTiles } from '../core/RoomTiles.js';
import { ROOM_COLS, ROOM_ROWS, PLAYER_DOOR_SPAWN_TILES, getPlayerSpawnPositions } from '../config/GameConfig.js';
import { demonConfig, bloodMonsterConfig, playerConfigs } from '../config/EntityConfig.js';

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
            holes: new Set(),     // coordenadas "c,r" onde NÃO haverá piso (abismo)
            hazards: [],          // perigos { type, u, v, count, phase, wave, dir }
            enemies: []           // inimigos { type, col, row }
        };

        // Estado das Ferramentas
        this.activeTab = "tab-holes"; // tab-holes, tab-challenges, tab-enemies, tab-spawns
        this.selectedHazard = "button";
        this.selectedEnemy = "demon";

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
        this._loadInitialPreset("room_cross_4way");
        this._fitScreen();
        this.render();
    }

    /* --------------------------------------------------------------------------
     * GERENCIAMENTO DE PRESETS & CARREGAMENTO (PORTAS FIXAS)
     * -------------------------------------------------------------------------- */
    _loadInitialPreset(presetKey) {
        if (presetKey.startsWith("challenge_")) {
            const idx = parseInt(presetKey.replace("challenge_", ""), 10);
            const challenge = CHALLENGE_LAYOUTS[idx] || CHALLENGE_LAYOUTS[0];
            this._loadChallengeLayout(challenge, idx);
        } else if (presetKey === "custom_new") {
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
        this.room.enemies = [];

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

    _loadChallengeLayout(challenge, idx) {
        this.cols = ROOM_COLS;
        this.rows = ROOM_ROWS;
        this.room.id = `challenge_${idx}`;
        this.room.name = challenge.name;
        this.room.cols = this.cols;
        this.room.rows = this.rows;
        this.room.kind = "corridor";
        this.room.type = "challenge";

        const midR = (this.rows / 2) | 0;
        this.room.sockets = {
            N: null,
            S: null,
            E: new RoomSocket({ dir: "E", offset: midR - 1, span: 2 }),
            W: new RoomSocket({ dir: "W", offset: midR - 1, span: 2 })
        };

        this.room.holes = new Set();
        this.room.hazards = JSON.parse(JSON.stringify(challenge.elements || []));
        this.room.enemies = [];

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
        this.room.enemies = [];

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
        const spawns = this._getPlayerSpawns();
        const warnings = [];
        const tileW = this.tilePx;
        const totalW = this.cols * tileW;
        const totalH = this.rows * tileW;
        const pad = tileW * 1.5;
        const innerW = totalW - pad * 2;
        const innerH = totalH - pad * 2;

        for (const sp of spawns) {
            // Verifica buracos nos tiles específicos de spawn
            if (this.room.holes.has(`${sp.p1.col},${sp.p1.row}`)) {
                warnings.push(`Buraco sem piso sobre o tile de spawn do P1 [Col ${sp.p1.col}, Linha ${sp.p1.row}] na ${sp.label}!`);
            }
            if (this.room.holes.has(`${sp.p2.col},${sp.p2.row}`)) {
                warnings.push(`Buraco sem piso sobre o tile de spawn do P2 [Col ${sp.p2.col}, Linha ${sp.p2.row}] na ${sp.label}!`);
            }

            // Verifica armadilhas / hazards nos tiles de spawn
            for (const h of this.room.hazards) {
                const hx = pad + (h.u ?? 0.5) * innerW;
                const hy = pad + (h.v ?? 0.5) * innerH;
                const hc = Math.floor(hx / tileW);
                const hr = Math.floor(hy / tileW);

                if (hc === sp.p1.col && hr === sp.p1.row) {
                    warnings.push(`Perigo (${this._hazardLabel(h.type)}) sobre o tile de spawn do P1 [Col ${hc}, Linha ${hr}] na ${sp.label}!`);
                }
                if (hc === sp.p2.col && hr === sp.p2.row) {
                    warnings.push(`Perigo (${this._hazardLabel(h.type)}) sobre o tile de spawn do P2 [Col ${hc}, Linha ${hr}] na ${sp.label}!`);
                }
            }
        }

        const warnBox = document.getElementById("spawn-warning-box");
        const statSafety = document.getElementById("stat-spawns-safety");

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
     * ATUALIZAÇÃO DA INTERFACE A PARTIR DO ESTADO
     * -------------------------------------------------------------------------- */
    _updateUIFromState() {
        // Campos de metadados
        document.getElementById("prop-id").value = this.room.id;
        document.getElementById("prop-name").value = this.room.name;
        document.getElementById("prop-cols").value = this.room.cols;
        document.getElementById("prop-rows").value = this.room.rows;
        document.getElementById("prop-kind").value = this.room.kind;
        document.getElementById("prop-type").value = this.room.type;

        // Buracos
        document.getElementById("holes-count").textContent = this.room.holes.size;

        // Listas de Perigos e Inimigos
        this._updateHazardsListUI();
        this._updateEnemiesListUI();
        this._updateSpawnsListUI();

        // Checklist e Código
        this._updateValidationChecklist();
        this._checkSpawnSafety();
        this._updateCodeOutput();

        // Status bar
        document.getElementById("status-dims").textContent = `${this.cols} x ${this.rows} tiles (${this.cols * this.tilePx} x ${this.rows * this.tilePx} px)`;
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
                    <strong>🚪 ${sp.label}</strong>
                    <span class="badge" style="font-size:10px;">Regra: 1 Tile à Frente</span>
                </div>
                <div style="font-size:11px; margin-top:6px; display:flex; flex-direction:column; gap:4px;">
                    <span style="color:#ffd166; font-weight:600;">🟡 P1 (Amarelo): Tile [Col ${sp.p1.col}, Linha ${sp.p1.row}]</span>
                    <span style="color:#6bb4db; font-weight:600;">🔵 P2 (Azul): Tile [Col ${sp.p2.col}, Linha ${sp.p2.row}]</span>
                </div>
                <div style="font-size:10px; color:var(--text-dim); margin-top:4px;">
                    Centros px: P1 (${Math.round(sp.p1.x)}, ${Math.round(sp.p1.y)}) | P2 (${Math.round(sp.p2.x)}, ${Math.round(sp.p2.y)})
                </div>
            `;
            listEl.appendChild(card);
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
                <span>${this._hazardLabel(h.type)} (u:${h.u?.toFixed(2)}, v:${h.v?.toFixed(2) ?? '-'})</span>
                <button class="btn btn-sm btn-danger" data-del-hazard="${i}">✕</button>
            `;
            listEl.appendChild(item);
        });

        listEl.querySelectorAll("[data-del-hazard]").forEach(btn => {
            btn.onclick = (e) => {
                const idx = parseInt(e.target.dataset.delHazard, 10);
                this.room.hazards.splice(idx, 1);
                this._updateHazardsListUI();
                this._updateValidationChecklist();
                this._checkSpawnSafety();
                this._updateCodeOutput();
                this.render();
            };
        });
    }

    _hazardLabel(type) {
        if (type === "button") return "🔘 Botão Co-op";
        if (type === "spikeRow") return "🔺 Fileira Espinhos";
        if (type === "spike") return "🎯 Espinho Único";
        if (type === "arrow") return "🏹 Atirador Flecha";
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
                <span>${foe.type === "demon" ? "👹 Demônio" : "🩸 Monstro Sangue"} (${foe.col}, ${foe.row})</span>
                <button class="btn btn-sm btn-danger" data-del-enemy="${i}">✕</button>
            `;
            listEl.appendChild(item);
        });

        listEl.querySelectorAll("[data-del-enemy]").forEach(btn => {
            btn.onclick = (e) => {
                const idx = parseInt(e.target.dataset.delEnemy, 10);
                this.room.enemies.splice(idx, 1);
                this._updateEnemiesListUI();
                this._updateValidationChecklist();
                this._updateCodeOutput();
                this.render();
            };
        });
    }

    _updateValidationChecklist() {
        // Portas
        const activeDirs = ["N", "S", "E", "W"].filter(d => !!this.room.sockets[d]);
        const statDoors = document.getElementById("stat-doors");
        statDoors.textContent = `${activeDirs.length} Porta(s) (${activeDirs.join(", ") || "Nenhuma"})`;
        statDoors.className = `status-badge ${activeDirs.length > 0 ? "ok" : "warn"}`;

        // Buracos
        const statHoles = document.getElementById("stat-holes");
        statHoles.textContent = `${this.room.holes.size} Buraco(s)`;
        statHoles.className = `status-badge ok`;

        // Perigos
        const statHazards = document.getElementById("stat-hazards");
        statHazards.textContent = `${this.room.hazards.length} Perigo(s)`;

        // Inimigos
        const statEnemies = document.getElementById("stat-enemies");
        statEnemies.textContent = `${this.room.enemies.length} Inimigos`;
    }

    _updateCodeOutput() {
        const out = document.getElementById("code-output");
        const doors = {
            N: !!this.room.sockets.N,
            S: !!this.room.sockets.S,
            E: !!this.room.sockets.E,
            W: !!this.room.sockets.W
        };

        const holesArray = Array.from(this.room.holes);

        if (this.room.hazards.length > 0) {
            // Formato ChallengeLayouts
            const obj = {
                name: this.room.name,
                doors,
                holes: holesArray.length > 0 ? holesArray : undefined,
                elements: this.room.hazards,
                enemies: this.room.enemies.length > 0 ? this.room.enemies : undefined
            };
            out.textContent = JSON.stringify(obj, null, 2);
        } else {
            // Formato RoomPresets
            const holesCode = holesArray.length > 0 ? `,\n  holes: ${JSON.stringify(holesArray)}` : "";
            const enemiesCode = this.room.enemies.length > 0 ? `,\n  enemies: ${JSON.stringify(this.room.enemies)}` : "";
            const code = `RoomTemplate.createStandard({\n  id: "${this.room.id}",\n  name: "${this.room.name}",\n  cols: ${this.cols},\n  rows: ${this.rows},\n  doors: ${JSON.stringify(doors)},\n  kind: "${this.room.kind}",\n  type: "${this.room.type}"${holesCode}${enemiesCode}\n})`;
            out.textContent = code;
        }
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
                    if (tileIdx >= 0) {
                        this.tileset.draw(ctx, tileIdx, c * tileW, r * tileW, tileW, tileW);
                    }
                }
            }
        }

        // 2. Renderiza Buracos (Sem Piso / Abismos)
        this._renderHoles(ctx, tileW);

        // 3. Renderiza Perigos (Traps)
        this._renderHazards(ctx, totalW, totalH);

        // 4. Renderiza Inimigos (com recorte correto do frame 0)
        this._renderEnemies(ctx, tileW);

        // 5. Renderiza Spawns dos Jogadores (P1 & P2 nas entradas)
        if (this.showPlayerSpawns) {
            this._renderPlayerSpawns(ctx, tileW);
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

    _renderHoles(ctx, tileW) {
        for (const holeKey of this.room.holes) {
            const [c, r] = holeKey.split(",").map(Number);
            const x = c * tileW;
            const y = r * tileW;

            // Fundo de abismo profundo
            ctx.fillStyle = "#030206";
            ctx.fillRect(x, y, tileW, tileW);

            // Borda com textura de buraco / abismo
            ctx.strokeStyle = "rgba(229, 49, 112, 0.5)";
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(x + 2, y + 2, tileW - 4, tileW - 4);
            ctx.setLineDash([]);

            // Ícone indicativo de abismo
            ctx.fillStyle = "rgba(229, 49, 112, 0.8)";
            ctx.font = "14px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("🕳️", x + tileW / 2, y + tileW / 2);
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

        // Números de colunas e linhas
        if (this.showCoords) {
            ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
            ctx.font = "10px monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            for (let c = 0; c < this.cols; c++) {
                ctx.fillText(`${c}`, c * tileW + tileW / 2, 12);
            }
            for (let r = 0; r < this.rows; r++) {
                ctx.fillText(`${r}`, 12, r * tileW + tileW / 2);
            }
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

            ctx.fillStyle = "#3da9fc";
            ctx.font = "bold 11px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(`🚪 N [${s.N.offset}..${s.N.offset + s.N.span - 1}]`, x + w / 2, tileW / 2);
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

            ctx.fillStyle = "#ffd166";
            ctx.font = "bold 11px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(`🚪 S [${s.S.offset}..${s.S.offset + s.S.span - 1}]`, x + w / 2, y + tileW / 2);
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

            ctx.fillStyle = "#2cb67d";
            ctx.font = "bold 11px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(`🚪 E [${s.E.offset}..${s.E.offset + s.E.span - 1}]`, x + tileW / 2, y + h / 2);
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

            ctx.fillStyle = "#e53170";
            ctx.font = "bold 11px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(`🚪 W [${s.W.offset}..${s.W.offset + s.W.span - 1}]`, tileW / 2, y + h / 2);
        }
    }

    _renderHazards(ctx, totalW, totalH) {
        const pad = this.tilePx * 1.5;
        const innerW = totalW - pad * 2;
        const innerH = totalH - pad * 2;

        for (const h of this.room.hazards) {
            const x = pad + (h.u ?? 0.5) * innerW;
            const y = pad + (h.v ?? 0.5) * innerH;

            if (h.type === "button") {
                // Botão de pressão co-op
                ctx.fillStyle = "#5c0a18";
                ctx.beginPath();
                ctx.ellipse(x, y, 20, 12, 0, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = "#ff8906";
                ctx.lineWidth = 2;
                ctx.stroke();

                ctx.fillStyle = "#e53170";
                ctx.beginPath();
                ctx.ellipse(x, y - 4, 12, 7, 0, 0, Math.PI * 2);
                ctx.fill();
            } else if (h.type === "spike" || h.type === "spikeRow") {
                const count = h.count || 1;
                for (let i = 0; i < count; i++) {
                    const sx = x;
                    const sy = y + (i - (count - 1) / 2) * 32;

                    const peakImg = this.assets.get("peaks2");
                    if (peakImg && peakImg.complete) {
                        ctx.drawImage(peakImg, sx - 16, sy - 16, 32, 32);
                    } else {
                        ctx.fillStyle = "#f5a623";
                        ctx.beginPath();
                        ctx.moveTo(sx, sy - 14);
                        ctx.lineTo(sx + 10, sy + 10);
                        ctx.lineTo(sx - 10, sy + 10);
                        ctx.closePath();
                        ctx.fill();
                    }
                }
            } else if (h.type === "arrow") {
                // Atirador de flecha na parede
                ctx.fillStyle = "#3da9fc";
                ctx.fillRect(x - 12, y - 12, 24, 24);
                ctx.strokeStyle = "#fff";
                ctx.lineWidth = 2;
                ctx.strokeRect(x - 12, y - 12, 24, 24);

                // Seta de direção do disparo
                ctx.strokeStyle = "#ff8906";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(x, y);
                if (h.dir === "across+") ctx.lineTo(x + 24, y);
                else if (h.dir === "across-") ctx.lineTo(x - 24, y);
                else if (h.dir === "along+") ctx.lineTo(x, y + 24);
                else ctx.lineTo(x, y - 24);
                ctx.stroke();
            }
        }
    }

    /**
     * Renderiza inimigos utilizando EXATAMENTE um frame recortado do spritesheet
     * (não a imagem inteira comprimida).
     */
    _renderEnemies(ctx, tileW) {
        for (const foe of this.room.enemies) {
            const cx = foe.col * tileW + tileW / 2;
            const cy = foe.row * tileW + tileW / 2;

            if (foe.type === "demon") {
                // Demon config: cellSize: 100, cropX: 28, cropY: 34, cropW: 52, cropH: 26, row: 1
                const sprite = this.assets.get("demon");
                const sx = 28;
                const sy = 100 + 34; // Row 1 (walk frame 0)
                const sw = 52;
                const sh = 26;

                // Anel de destaque sob o inimigo
                ctx.fillStyle = "rgba(239, 69, 101, 0.25)";
                ctx.beginPath();
                ctx.ellipse(cx, cy + 12, 24, 10, 0, 0, Math.PI * 2);
                ctx.fill();

                if (sprite && sprite.complete) {
                    const scale = 1.45;
                    const dw = sw * scale;
                    const dh = sh * scale;
                    ctx.drawImage(sprite, sx, sy, sw, sh, cx - dw / 2, cy - dh / 2 - 4, dw, dh);
                } else {
                    ctx.fillStyle = "#ef4565";
                    ctx.beginPath();
                    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
                    ctx.fill();
                }

                // Badge indicativo
                ctx.fillStyle = "#ef4565";
                ctx.font = "bold 9px sans-serif";
                ctx.textAlign = "center";
                ctx.fillText("👹 DEMON", cx, cy + 24);

            } else {
                // Blood Monster config: cellSize: 100, cropX: 36, cropY: 30, cropW: 48, cropH: 30, row: 1
                const sprite = this.assets.get("bloodMonster");
                const sx = 36;
                const sy = 100 + 30; // Row 1 (walk frame 0)
                const sw = 48;
                const sh = 30;

                ctx.fillStyle = "rgba(127, 90, 240, 0.25)";
                ctx.beginPath();
                ctx.ellipse(cx, cy + 12, 24, 10, 0, 0, Math.PI * 2);
                ctx.fill();

                if (sprite && sprite.complete) {
                    const scale = 1.35;
                    const dw = sw * scale;
                    const dh = sh * scale;
                    ctx.drawImage(sprite, sx, sy, sw, sh, cx - dw / 2, cy - dh / 2 - 4, dw, dh);
                } else {
                    ctx.fillStyle = "#7f5af0";
                    ctx.beginPath();
                    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.fillStyle = "#7f5af0";
                ctx.font = "bold 9px sans-serif";
                ctx.textAlign = "center";
                ctx.fillText("🩸 MONSTER", cx, cy + 24);
            }
        }
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

            ctx.fillStyle = "#ffd166";
            ctx.font = "bold 9px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(`🟡 P1 [${sp.p1.col},${sp.p1.row}]`, p1x + tileW / 2, p1y + 11);

            // 2. Destaque do Tile de Spawn do P2 (Azul)
            const p2x = sp.p2.col * tileW;
            const p2y = sp.p2.row * tileW;
            ctx.fillStyle = "rgba(107, 180, 219, 0.22)";
            ctx.fillRect(p2x, p2y, tileW, tileW);
            ctx.strokeStyle = "#6bb4db";
            ctx.lineWidth = 2;
            ctx.strokeRect(p2x + 1, p2y + 1, tileW - 2, tileW - 2);

            ctx.fillStyle = "#6bb4db";
            ctx.font = "bold 9px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(`🔵 P2 [${sp.p2.col},${sp.p2.row}]`, p2x + tileW / 2, p2y + 11);

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
            // P1: cropX: 41, cropY: 37, cropW: 17, cropH: 23
            // P2: cropX: 39, cropY: 35, cropW: 21, cropH: 25
            const isP1 = playerKey === "p1";
            const sx = isP1 ? 41 : 39;
            const sy = isP1 ? 37 : 35;
            const sw = isP1 ? 17 : 21;
            const sh = isP1 ? 23 : 25;

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

        // Badge textual P1 / P2
        ctx.fillStyle = glowColor;
        ctx.font = "bold 10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(label, px, py - 18);
    }

    /* --------------------------------------------------------------------------
     * EVENTOS DE ENTRADA & INTERAÇÃO COM O CANVAS
     * -------------------------------------------------------------------------- */
    _initEvents() {
        // Seletor de Presets
        document.getElementById("preset-select").onchange = (e) => {
            this._loadInitialPreset(e.target.value);
        };

        // Abas
        document.querySelectorAll(".tab-btn").forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
                document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));

                btn.classList.add("active");
                this.activeTab = btn.dataset.tab;
                const panel = document.getElementById(this.activeTab);
                if (panel) panel.classList.add("active");
                this.render();
            };
        });

        // Limpar Buracos
        document.getElementById("btn-clear-holes").onclick = () => {
            this.room.holes.clear();
            this._rebuildAutotile();
            this._updateUIFromState();
            this.render();
        };

        // Perigos
        document.querySelectorAll("[name='hazard-choice']").forEach(r => {
            r.onchange = () => { this.selectedHazard = r.value; };
        });
        document.getElementById("btn-clear-hazards").onclick = () => {
            this.room.hazards = [];
            this._updateHazardsListUI();
            this._updateValidationChecklist();
            this._checkSpawnSafety();
            this._updateCodeOutput();
            this.render();
        };

        // Inimigos
        document.querySelectorAll("[name='enemy-choice']").forEach(r => {
            r.onchange = () => { this.selectedEnemy = r.value; };
        });
        document.getElementById("btn-clear-enemies").onclick = () => {
            this.room.enemies = [];
            this._updateEnemiesListUI();
            this._updateValidationChecklist();
            this._updateCodeOutput();
            this.render();
        };
        document.getElementById("btn-distribute-circle").onclick = () => {
            this._distributeEnemiesCircle();
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

        // Alternadores de Exibição
        document.getElementById("toggle-grid").onchange = (e) => { this.showGrid = e.target.checked; this.render(); };
        document.getElementById("toggle-coords").onchange = (e) => { this.showCoords = e.target.checked; this.render(); };
        document.getElementById("toggle-doors").onchange = (e) => { this.showDoors = e.target.checked; this.render(); };

        // Botões de Zoom & Pan
        document.getElementById("btn-zoom-in").onclick = () => { this.zoom = Math.min(2.5, this.zoom * 1.2); this.render(); };
        document.getElementById("btn-zoom-out").onclick = () => { this.zoom = Math.max(0.4, this.zoom / 1.2); this.render(); };
        document.getElementById("btn-zoom-reset").onclick = () => { this.zoom = 1.0; this.panX = 0; this.panY = 0; this.render(); };
        document.getElementById("btn-fit-screen").onclick = () => { this._fitScreen(); this.render(); };

        // Inputs de Propriedades
        document.getElementById("prop-id").onchange = (e) => { this.room.id = e.target.value; this._updateCodeOutput(); };
        document.getElementById("prop-name").onchange = (e) => { this.room.name = e.target.value; this._updateCodeOutput(); };
        document.getElementById("prop-kind").onchange = (e) => { this.room.kind = e.target.value; this._updateCodeOutput(); };
        document.getElementById("prop-type").onchange = (e) => {
            this.room.type = e.target.value;
            this._updateUIFromState();
            this.render();
        };

        // Copiar Código e Exportar
        document.getElementById("btn-quick-copy").onclick = () => { this._copyCodeToClipboard(); };
        document.getElementById("btn-copy-code").onclick = () => { this._copyCodeToClipboard(); };
        document.getElementById("btn-export-json").onclick = () => { this._exportJSON(); };
        document.getElementById("btn-import-json").onclick = () => { this._openImportModal(); };

        // Modal
        document.getElementById("modal-close-btn").onclick = () => { this._closeModal(); };
        document.getElementById("modal-cancel-btn").onclick = () => { this._closeModal(); };

        // Testar no Jogo
        document.getElementById("btn-playtest").onclick = () => { this._playtestInGame(); };

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
        if (this.isMouseDown && this.activeTab === "tab-holes") {
            const key = `${col},${row}`;
            if (this.lastToggledHole !== key) {
                this.lastToggledHole = key;
                this._toggleHole(col, row);
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
        } else if (this.activeTab === "tab-challenges") {
            this._addHazardAt(localX, localY);
        } else if (this.activeTab === "tab-enemies") {
            this._addEnemyAt(col, row);
        }
    }

    _toggleHole(col, row) {
        // Paredes de contorno externo não podem ser buraco
        if (col === 0 || col === this.cols - 1 || row === 0 || row === this.rows - 1) {
            return;
        }

        // Tiles onde os jogadores nascem logo à frente da porta não podem ser buraco!
        const spawns = this._getPlayerSpawns();
        for (const sp of spawns) {
            if ((sp.p1.col === col && sp.p1.row === row) || (sp.p2.col === col && sp.p2.row === row)) {
                return; // Protegido contra abismo
            }
        }

        const key = `${col},${row}`;
        if (this.room.holes.has(key)) {
            this.room.holes.delete(key);
        } else {
            this.room.holes.add(key);
        }

        this._rebuildAutotile();
        this._updateUIFromState();
        this.render();
    }

    _addHazardAt(px, py) {
        const totalW = this.cols * this.tilePx;
        const totalH = this.rows * this.tilePx;
        const pad = this.tilePx * 1.5;

        const u = Math.max(0, Math.min(1, (px - pad) / (totalW - pad * 2)));
        const v = Math.max(0, Math.min(1, (py - pad) / (totalH - pad * 2)));

        const newHazard = {
            type: this.selectedHazard,
            u: parseFloat(u.toFixed(2)),
            v: parseFloat(v.toFixed(2))
        };

        if (this.selectedHazard === "spikeRow") {
            newHazard.count = 4;
            newHazard.phase = 0.0;
            newHazard.wave = 0.12;
        } else if (this.selectedHazard === "arrow") {
            newHazard.dir = "across+";
            newHazard.phase = 0.0;
        }

        this.room.hazards.push(newHazard);
        this._updateHazardsListUI();
        this._updateValidationChecklist();
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
        this._updateValidationChecklist();
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
        this._updateValidationChecklist();
        this._updateCodeOutput();
        this.render();
    }

    /* --------------------------------------------------------------------------
     * EXPORTAÇÃO, IMPORTAÇÃO & TESTE NO JOGO
     * -------------------------------------------------------------------------- */
    _copyCodeToClipboard() {
        const code = document.getElementById("code-output").textContent;
        navigator.clipboard.writeText(code).then(() => {
            alert("✅ Código copiado para a área de transferência!");
        });
    }

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
            hazards: this.room.hazards,
            enemies: this.room.enemies
        };

        const jsonStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${this.room.id}.json`;
        a.click();
        URL.revokeObjectURL(url);
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
        this.room.enemies = data.enemies || [];
        this.room.holes = new Set(data.holes || []);

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
            hazards: this.room.hazards,
            enemies: this.room.enemies
        };

        sessionStorage.setItem("editor_custom_room", JSON.stringify(playtestData));
        window.location.href = "index.html?playtest=true";
    }
}

// Inicia o editor quando o DOM estiver pronto
window.addEventListener("DOMContentLoaded", () => {
    window.editorApp = new RoomEditor();
});
