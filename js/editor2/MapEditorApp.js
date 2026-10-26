import { ContentTools } from './ContentTools.js';
import { identifyDoors, validatePlayable, doorCells } from '../rooms/MapConnections.js';
import { Tileset } from '../core/Tileset.js';
import { TILE, ROOM_COLS, ROOM_ROWS, EMPTY_FLOOR_COLOR, holeTileFor } from '../config/GameConfig.js';
import { TILE_KINDS, DOOR_TYPES, DEFAULT_DOOR_TYPE, MAP_LIMITS } from '../config/MapEditorConfig.js';
import { ANIMATED_PROPS, ANIMATED_PROP_KEYS } from '../config/PropConfig.js';
import * as M from './MapModel.js';
import { TilePalette } from './TilePalette.js';
import { PropSprites } from './PropSprites.js';

const STORAGE_KEY = "editor2_map_state";
const DEFAULT_FILE = "demo_map.json";
const ROOM_TILE_PX = TILE;
const MAP_TILE_PX = 16;
const SLOT_GAP_TILES = 3;
const HISTORY_LIMIT = 100;
const TOOLS = ["paint", "hole", "void", "collision", "door", "prop", "erase"];
const LINK_COLORS = { ok: "#2cb67d", "one-way": "#f5a623", "no-room": "#ef4565" };

const $ = (id) => document.getElementById(id);

export class MapEditorApp {
    constructor() {
        this.canvas = $("editorCanvas");
        this.ctx = this.canvas.getContext("2d");
        this.container = $("canvas-container");

        this.map = M.createMap();
        this.file = DEFAULT_FILE;
        this.view = "map";
        this.selectedKey = null;
        this.editingKey = null;

        this.tool = "paint";
        this.paintKind = "auto";
        this.doorType = DEFAULT_DOOR_TYPE;
        this.propType = ANIMATED_PROP_KEYS[0];
        this.propFlip = false;
        this.showKinds = true;
        this.showGrid = true;

        this.cams = {
            map: { zoom: 1, panX: 0, panY: 0, fitted: false },
            room: { zoom: 1, panX: 0, panY: 0, fitted: false }
        };
        this.isPanning = false;
        this.lastMouse = { x: 0, y: 0 };
        this.hover = null;
        this.hoverSlot = null;
        this.stroke = null;
        this.mapDrag = null;

        this.undoStack = [];
        this.redoStack = [];
        this.dirtyServer = false;
        this._persistTimer = 0;
        this.now = 0;

        this.tileImg = new Image();
        this.tileset = new Tileset(this.tileImg, 16, 10);
        this.props = new PropSprites();
        this.palette = new TilePalette({
            canvas: $("tileset-canvas"),
            image: this.tileImg,
            onChange: () => {
                if (this.tool !== "paint") this._setTool("paint");
                this._syncUI();
            }
        });
        this.tileImg.onload = () => {
            this.palette.refresh();
            this._syncUI();
        };
        this.tileImg.src = "assets/tileset/tileset.png";

        this._loadFromStorage();
        this._buildDoorTypes();
        this._buildPropGrid();
        this.contentTools = new ContentTools(this);
        this._bindUI();
        this._bindCanvas();
        this._resizeCanvas();
        new ResizeObserver(() => this._resizeCanvas()).observe(this.container);
        this._syncUI();
        this._refreshMapList();
        requestAnimationFrame((t) => this._frame(t));
    }

    get room() {
        return this.editingKey ? this.map.rooms[this.editingKey] || null : null;
    }

    get cam() {
        return this.cams[this.view];
    }

    // ---------- persistência local e histórico ----------

    _snapshot() {
        return JSON.stringify(this.map);
    }

    _commit(fn) {
        const before = this._snapshot();
        const result = fn();
        identifyDoors(this.map);
        if (this._snapshot() !== before) this._pushUndo(before);
        this._afterChange();
        return result;
    }

    _pushUndo(before) {
        this.undoStack.push(before);
        if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
        this.redoStack = [];
        this.dirtyServer = true;
    }

    _undo() {
        if (!this.undoStack.length) return;
        this.redoStack.push(this._snapshot());
        this._restore(this.undoStack.pop());
    }

    _redo() {
        if (!this.redoStack.length) return;
        this.undoStack.push(this._snapshot());
        this._restore(this.redoStack.pop());
    }

    _restore(snapshot) {
        this.map = JSON.parse(snapshot);
        this.dirtyServer = true;
        if (this.editingKey && !this.map.rooms[this.editingKey]) this._backToMap();
        this._afterChange();
    }

    _afterChange() {
        clearTimeout(this._persistTimer);
        this._persistTimer = setTimeout(() => this._persistNow(), 250);
        this._syncUI();
    }

    _persistNow() {
        clearTimeout(this._persistTimer);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                map: this.map,
                file: this.file,
                view: this.view,
                editingKey: this.editingKey,
                selectedKey: this.selectedKey,
                dirtyServer: this.dirtyServer
            }));
        } catch (e) {
            console.warn("Não foi possível salvar o mapa no navegador:", e);
        }
    }

    _loadFromStorage() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const saved = JSON.parse(raw);
            this.map = M.normalizeMap(saved.map);
            this.file = this._sanitizeFile(saved.file);
            this.dirtyServer = !!saved.dirtyServer;
            this.selectedKey = this.map.rooms[saved.selectedKey] ? saved.selectedKey : null;
            if (saved.view === "room" && this.map.rooms[saved.editingKey]) {
                this.view = "room";
                this.editingKey = saved.editingKey;
            }
        } catch (e) {
            console.warn("Estado salvo do editor 2.0 ignorado:", e);
            this.map = M.createMap();
        }
    }

    // ---------- navegação entre visões ----------

    _openRoom(key) {
        if (!this.map.rooms[key]) return;
        this.editingKey = key;
        this.selectedKey = key;
        this.view = "room";
        this.cams.room.fitted = false;
        this.stroke = null;
        this.hover = null;
        this._fit();
        this._persistNow();
        this._syncUI();
    }

    _backToMap() {
        this.view = "map";
        this.editingKey = null;
        this.stroke = null;
        this.hover = null;
        if (!this.cams.map.fitted) this._fit();
        this._persistNow();
        this._syncUI();
    }

    // ---------- câmera ----------

    _resizeCanvas() {
        const w = Math.max(1, this.container.clientWidth);
        const h = Math.max(1, this.container.clientHeight);
        if (this.canvas.width !== w || this.canvas.height !== h) {
            this.canvas.width = w;
            this.canvas.height = h;
        }
        if (!this.cam.fitted) this._fit();
    }

    _worldSize() {
        if (this.view === "map") {
            const L = this._slotLayout();
            return { w: L.w, h: L.h };
        }
        const room = this.room;
        return room ? { w: room.cols * ROOM_TILE_PX, h: room.rows * ROOM_TILE_PX } : { w: 1, h: 1 };
    }

    _fit() {
        const { w, h } = this._worldSize();
        const pad = 32;
        const cw = this.canvas.width, ch = this.canvas.height;
        const cam = this.cam;
        cam.zoom = Math.max(0.05, Math.min(6, Math.min((cw - pad * 2) / w, (ch - pad * 2) / h)));
        cam.panX = (cw - w * cam.zoom) / 2;
        cam.panY = (ch - h * cam.zoom) / 2;
        cam.fitted = true;
    }

    _zoomAt(factor, sx, sy) {
        const cam = this.cam;
        const zoom = Math.max(0.05, Math.min(6, cam.zoom * factor));
        const wx = (sx - cam.panX) / cam.zoom;
        const wy = (sy - cam.panY) / cam.zoom;
        cam.zoom = zoom;
        cam.panX = sx - wx * zoom;
        cam.panY = sy - wy * zoom;
    }

    _toWorld(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const sx = clientX - rect.left, sy = clientY - rect.top;
        const cam = this.cam;
        return { sx, sy, x: (sx - cam.panX) / cam.zoom, y: (sy - cam.panY) / cam.zoom };
    }

    _tileAt(clientX, clientY) {
        const { x, y } = this._toWorld(clientX, clientY);
        return { col: Math.floor(x / ROOM_TILE_PX), row: Math.floor(y / ROOM_TILE_PX) };
    }

    // ---------- layout do grid ----------

    _slotLayout() {
        const rooms = Object.values(this.map.rooms);
        const sc = Math.max(this.map.roomSize.cols, ...rooms.map(r => r.cols));
        const sr = Math.max(this.map.roomSize.rows, ...rooms.map(r => r.rows));
        const slotW = sc * MAP_TILE_PX, slotH = sr * MAP_TILE_PX, gap = SLOT_GAP_TILES * MAP_TILE_PX;
        const { cols, rows } = this.map.grid;
        return { slotW, slotH, gap, w: cols * slotW + (cols + 1) * gap, h: rows * slotH + (rows + 1) * gap };
    }

    _slotRect(gx, gy, L) {
        return { x: L.gap + gx * (L.slotW + L.gap), y: L.gap + gy * (L.slotH + L.gap), w: L.slotW, h: L.slotH };
    }

    _roomOrigin(room, gx, gy, L) {
        const s = this._slotRect(gx, gy, L);
        const ox = s.x + Math.floor((L.slotW - room.cols * MAP_TILE_PX) / 2 / MAP_TILE_PX) * MAP_TILE_PX;
        const oy = s.y + Math.floor((L.slotH - room.rows * MAP_TILE_PX) / 2 / MAP_TILE_PX) * MAP_TILE_PX;
        return { x: ox, y: oy };
    }

    _slotAt(clientX, clientY) {
        const { x, y } = this._toWorld(clientX, clientY);
        const L = this._slotLayout();
        const { cols, rows } = this.map.grid;
        for (let gy = 0; gy < rows; gy++) {
            for (let gx = 0; gx < cols; gx++) {
                const s = this._slotRect(gx, gy, L);
                if (x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h) return M.cellKey(gx, gy);
            }
        }
        return null;
    }

    // ---------- eventos do canvas ----------

    _bindCanvas() {
        this.container.addEventListener("mousedown", (e) => this._onMouseDown(e));
        window.addEventListener("mousemove", (e) => this._onMouseMove(e));
        window.addEventListener("mouseup", (e) => this._onMouseUp(e));
        this.container.addEventListener("wheel", (e) => {
            e.preventDefault();
            const { sx, sy } = this._toWorld(e.clientX, e.clientY);
            this._zoomAt(e.deltaY < 0 ? 1.15 : 0.87, sx, sy);
        }, { passive: false });
        this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
        this.canvas.addEventListener("dblclick", (e) => this._onDoubleClick(e));
        this.canvas.addEventListener("mouseleave", () => {
            this.hover = null;
            this.hoverSlot = null;
            $("status-coords").textContent = "—";
        });
        window.addEventListener("keydown", (e) => this._onKeyDown(e));
    }

    _onMouseDown(e) {
        if (e.target !== this.canvas) return;
        if (e.button === 1 || e.shiftKey || e.altKey) {
            e.preventDefault();
            this.isPanning = true;
            this.lastMouse = { x: e.clientX, y: e.clientY };
            this.container.classList.add("panning");
            return;
        }
        if (this.view === "map") {
            if (e.button === 0) this._mapMouseDown(e);
            return;
        }
        const { col, row } = this._tileAt(e.clientX, e.clientY);
        if (e.button === 2) {
            this._eyedrop(col, row);
            return;
        }
        if (e.button === 0) this._beginStroke(col, row);
    }

    _onMouseMove(e) {
        if (this.isPanning) {
            this.cam.panX += e.clientX - this.lastMouse.x;
            this.cam.panY += e.clientY - this.lastMouse.y;
            this.lastMouse = { x: e.clientX, y: e.clientY };
            return;
        }
        const overCanvas = e.target === this.canvas;
        if (this.view === "map") {
            this.hoverSlot = overCanvas || this.mapDrag ? this._slotAt(e.clientX, e.clientY) : null;
            if (this.mapDrag && !this.mapDrag.moved && Math.hypot(e.clientX - this.mapDrag.x, e.clientY - this.mapDrag.y) > 6) {
                this.mapDrag.moved = true;
            }
            if (overCanvas) this._updateMapStatus();
            return;
        }
        if (!overCanvas && !this.stroke) return;
        const { col, row } = this._tileAt(e.clientX, e.clientY);
        this.hover = { col, row };
        if (this.stroke) this._continueStroke(col, row);
        this._updateRoomStatus();
    }

    _onMouseUp() {
        if (this.isPanning) {
            this.isPanning = false;
            this.container.classList.remove("panning");
            return;
        }
        if (this.mapDrag) {
            const drag = this.mapDrag;
            this.mapDrag = null;
            if (drag.moved && this.hoverSlot && this.hoverSlot !== drag.key) {
                const target = this.hoverSlot;
                this._commit(() => M.moveRoom(this.map, drag.key, target));
                this.selectedKey = target;
                this._syncUI();
            }
            return;
        }
        if (this.stroke) this._endStroke();
    }

    _onDoubleClick(e) {
        if (this.view !== "map" || this.contentTools.connecting) return;
        const key = this._slotAt(e.clientX, e.clientY);
        if (!key) return;
        if (!this.map.rooms[key]) this._createRoomAt(key);
        this._openRoom(key);
    }

    _mapMouseDown(e) {
        if (this.contentTools.mapClick(e)) return;
        const key = this._slotAt(e.clientX, e.clientY);
        this.selectedKey = key;
        if (key && this.map.rooms[key]) this.mapDrag = { key, x: e.clientX, y: e.clientY, moved: false };
        this._syncUI();
    }

    _onKeyDown(e) {
        const tag = (e.target && e.target.tagName) || "";
        const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
        const key = e.key.toLowerCase();
        if ((e.ctrlKey || e.metaKey) && key === "s") {
            e.preventDefault();
            this._saveToServer();
            return;
        }
        if (typing) return;
        if ((e.ctrlKey || e.metaKey) && key === "z") {
            e.preventDefault();
            if (e.shiftKey) this._redo();
            else this._undo();
            return;
        }
        if ((e.ctrlKey || e.metaKey) && key === "y") {
            e.preventDefault();
            this._redo();
            return;
        }
        if (key === "escape" && this.view === "room") {
            this._backToMap();
            return;
        }
        if (this.view === "room" && /^[1-7]$/.test(key)) this._setTool(TOOLS[Number(key) - 1]);
    }

    // ---------- ferramentas da sala ----------

    _beginStroke(col, row) {
        if (!this.room) return;
        this.stroke = { before: this._snapshot(), visited: new Set(), mode: null };
        this._applyTool(col, row);
    }

    _continueStroke(col, row) {
        if (this.tool === "prop" && this.stroke.mode === "add") return;
        this._applyTool(col, row);
    }

    _endStroke() {
        const before = this.stroke.before;
        this.stroke = null;
        if (this._snapshot() !== before) this._pushUndo(before);
        this._afterChange();
    }

    _applyTool(col, row) {
        const room = this.room;
        const stroke = this.stroke;
        const key = `${col},${row}`;
        if (!room || stroke.visited.has(key)) return;
        stroke.visited.add(key);
        if (this.tool !== "paint" && !M.inBounds(room, col, row)) return;

        if (this.contentTools.apply(col, row)) return;
        switch (this.tool) {
            case "paint": {
                const stamp = this.palette.stamp;
                for (let dy = 0; dy < stamp.length; dy++) {
                    for (let dx = 0; dx < stamp[dy].length; dx++) {
                        const idx = stamp[dy][dx];
                        const kind = this.paintKind === "auto" ? M.defaultKindForTile(idx) : this.paintKind;
                        M.setCell(room, col + dx, row + dy, idx, kind);
                    }
                }
                break;
            }
            case "hole":
                M.setCell(room, col, row, -1, "h");
                break;
            case "void":
                M.setCell(room, col, row, -2, "v");
                break;
            case "collision":
                if (!stroke.mode) stroke.mode = M.getKind(room, col, row) === "w" ? "f" : "w";
                M.setKind(room, col, row, stroke.mode);
                break;
            case "door": {
                if (!stroke.mode) {
                    const d = M.doorAt(room, col, row);
                    stroke.mode = d && d.type === this.doorType ? "remove" : "set";
                }
                if (stroke.mode === "remove") M.removeDoorAt(room, col, row);
                else M.setDoor(room, col, row, this.doorType);
                break;
            }
            case "prop":
                if (!stroke.mode) stroke.mode = M.propAt(room, col, row) ? "remove" : "add";
                if (stroke.mode === "remove") M.removePropAt(room, col, row);
                else M.placeProp(room, this.propType, col, row, this.propFlip);
                break;
            case "erase":
                M.eraseCell(room, col, row);
                break;
        }
    }

    _eyedrop(col, row) {
        const room = this.room;
        if (!room || !M.inBounds(room, col, row)) return;
        const prop = M.propAt(room, col, row);
        if (prop) {
            this.propType = prop.type;
            this.propFlip = !!prop.flip;
            this._setTool("prop");
            return;
        }
        const kind = room.kinds[row][col];
        if (kind === "h") return this._setTool("hole");
        if (kind === "v") return this._setTool("void");
        const tile = room.tiles[row][col];
        this.palette.selectIndex(tile);
        this.paintKind = M.defaultKindForTile(tile) === kind ? "auto" : kind;
        this._setTool("paint");
    }

    _setTool(tool) {
        if (!TOOLS.includes(tool)) return;
        this.tool = tool;
        this._syncUI();
    }

    // ---------- ações do mapa ----------

    _createRoomAt(key) {
        const { gx, gy } = M.parseKey(key);
        this._commit(() => M.addRoom(this.map, gx, gy));
        this.selectedKey = key;
    }

    _deleteRoom(key) {
        const room = this.map.rooms[key];
        if (!room) return;
        if (!confirm(`Excluir a sala "${room.name}" (${key})? Dá para desfazer com Ctrl+Z.`)) return;
        this._commit(() => M.removeRoom(this.map, key));
    }

    _applyGridSize() {
        const cols = Number($("grid-cols").value), rows = Number($("grid-rows").value);
        const outside = M.roomsOutsideGrid(this.map, cols, rows);
        if (outside.length && !confirm(`${outside.length} sala(s) ficam fora do grid novo e serão removidas: ${outside.join(" ")}. Continuar?`)) {
            this._syncUI();
            return;
        }
        this._commit(() => M.resizeGrid(this.map, cols, rows));
        if (this.selectedKey && !this.map.rooms[this.selectedKey]) {
            const { gx, gy } = M.parseKey(this.selectedKey);
            if (!M.inGrid(this.map, gx, gy)) this.selectedKey = null;
        }
        this.cams.map.fitted = false;
        if (this.view === "map") this._fit();
        this._syncUI();
    }

    _applyDefaultRoomSize() {
        const cols = Number($("default-room-cols").value), rows = Number($("default-room-rows").value);
        this._commit(() => {
            this.map.roomSize.cols = Math.max(MAP_LIMITS.minRoomCols, Math.min(MAP_LIMITS.maxRoomCols, Math.round(cols) || ROOM_COLS));
            this.map.roomSize.rows = Math.max(MAP_LIMITS.minRoomRows, Math.min(MAP_LIMITS.maxRoomRows, Math.round(rows) || ROOM_ROWS));
        });
    }

    _applyRoomSize() {
        const room = this.room;
        if (!room) return;
        const cols = Number($("room-cols").value), rows = Number($("room-rows").value);
        const rebuildFrame = $("room-rebuild-frame").checked;
        const shrinking = cols < room.cols || rows < room.rows;
        if (shrinking && !confirm("A sala vai encolher: tiles, portas e props fora do tamanho novo serão perdidos. Continuar?")) {
            this._syncUI();
            return;
        }
        const key = this.editingKey;
        this._commit(() => { this.map.rooms[key] = M.resizeRoom(room, cols, rows, { rebuildFrame }); });
        this.cams.room.fitted = false;
        this.cams.map.fitted = false;
        this._fit();
        this._syncUI();
    }

    _newMap() {
        if (!confirm("Começar um mapa novo? O atual some do editor (dá para desfazer com Ctrl+Z, e o que já foi salvo no servidor continua lá).")) return;
        this._commit(() => { this.map = M.createMap(); });
        this.selectedKey = null;
        this.file = DEFAULT_FILE;
        this._backToMap();
        this._fit();
    }

    _replaceMap(map, file = null) {
        this._commit(() => { this.map = map; });
        if (file) this.file = file;
        this.selectedKey = map.start;
        this.cams.map.fitted = false;
        this._backToMap();
        this._fit();
    }

    // ---------- arquivo e servidor ----------

    _sanitizeFile(name) {
        let file = String(name || "").trim().replace(/[^A-Za-z0-9_\-.]/g, "_").replace(/\.json$/i, "").replace(/\./g, "_");
        if (!file) file = DEFAULT_FILE.replace(/\.json$/, "");
        return `${file.slice(0, 60)}.json`;
    }

    async _saveToServer() {
        this.file = this._sanitizeFile($("map-file").value || this.file);
        const report = M.validateMap(this.map);
        if (report.errors.length && !confirm(`O mapa tem ${report.errors.length} erro(s) de validação. Salvar mesmo assim?`)) return;
        try {
            const res = await fetch("/api/save-map", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ file: this.file, map: M.serializeMap(this.map) })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.ok) {
                alert(`Falha ao salvar: ${data.error || `HTTP ${res.status}`}\n\nO salvamento precisa do servidor de desenvolvimento (python serve.py).`);
                return;
            }
            this.dirtyServer = false;
            this._lastSaved = `Salvo em map/demo/${data.file} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
            this._persistNow();
            this._syncUI();
            this._refreshMapList(data.file);
        } catch (e) {
            alert(`Não foi possível contatar o servidor: ${e.message}\n\nRode "python serve.py" (ou "py serve.py") e abra http://localhost:8000/editor2.html.`);
        }
    }

    async _refreshMapList(selectFile = null) {
        const select = $("map-list");
        try {
            const res = await fetch("/api/list-maps");
            const data = await res.json();
            if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
            select.innerHTML = "";
            if (!data.files.length) select.add(new Option("(nenhum mapa salvo)", ""));
            for (const f of data.files) select.add(new Option(f, f));
            select.value = selectFile && data.files.includes(selectFile) ? selectFile
                : data.files.includes(this.file) ? this.file : (data.files[0] || "");
        } catch {
            select.innerHTML = "";
            select.add(new Option("(servidor offline)", ""));
        }
    }

    async _loadFromServer() {
        const file = $("map-list").value;
        if (!file) return;
        if (this.dirtyServer && !confirm("O mapa atual tem alterações não salvas no servidor. Abrir outro mesmo assim? (dá para desfazer com Ctrl+Z)")) return;
        try {
            const res = await fetch(`map/demo/${encodeURIComponent(file)}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const map = M.normalizeMap(await res.json());
            this._replaceMap(map, file);
            this.dirtyServer = false;
            this._lastSaved = `Aberto de map/demo/${file}`;
            this._persistNow();
            this._syncUI();
        } catch (e) {
            alert(`Não foi possível abrir ${file}: ${e.message}`);
        }
    }

    _exportFile() {
        const blob = new Blob([M.formatMapJson(M.serializeMap(this.map)) + "\n"], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = this._sanitizeFile($("map-file").value || this.file);
        a.click();
        URL.revokeObjectURL(url);
    }

    async _importFile(file) {
        try {
            const map = M.normalizeMap(JSON.parse(await file.text()));
            if (!confirm(`Substituir o mapa atual por "${map.name}" (${Object.keys(map.rooms).length} salas)? Dá para desfazer com Ctrl+Z.`)) return;
            this._replaceMap(map, this._sanitizeFile(file.name));
        } catch (e) {
            alert(`Arquivo inválido: ${e.message}`);
        }
    }

    _playtest() {
        this.contentTools.playtest(true);
    }

    // ---------- UI ----------

    _bindUI() {
        for (const title of document.querySelectorAll(".tool-group .group-title")) {
            title.addEventListener("click", () => {
                const group = title.closest(".tool-group");
                const open = group.classList.contains("collapsed");
                group.classList.toggle("collapsed", !open);
                group.classList.toggle("expanded", open);
            });
        }

        $("btn-back-map").addEventListener("click", () => this._backToMap());
        $("btn-save").addEventListener("click", () => this._saveToServer());
        $("btn-playtest").addEventListener("click", () => this._playtest());

        $("map-name").addEventListener("change", (e) => this._commit(() => { this.map.name = e.target.value.trim() || "Demo"; }));
        $("btn-apply-grid").addEventListener("click", () => this._applyGridSize());
        $("default-room-cols").addEventListener("change", () => this._applyDefaultRoomSize());
        $("default-room-rows").addEventListener("change", () => this._applyDefaultRoomSize());
        $("map-file").addEventListener("change", (e) => {
            this.file = this._sanitizeFile(e.target.value);
            this._persistNow();
            this._syncUI();
        });
        $("btn-refresh-maps").addEventListener("click", () => this._refreshMapList());
        $("btn-load-map").addEventListener("click", () => this._loadFromServer());
        $("btn-export").addEventListener("click", () => this._exportFile());
        $("btn-import").addEventListener("click", () => $("import-file").click());
        $("import-file").addEventListener("change", (e) => {
            const file = e.target.files && e.target.files[0];
            e.target.value = "";
            if (file) this._importFile(file);
        });
        $("btn-new-map").addEventListener("click", () => this._newMap());

        $("btn-create-room").addEventListener("click", () => {
            if (this.selectedKey) this._createRoomAt(this.selectedKey);
        });
        $("btn-edit-room").addEventListener("click", () => this._openRoom(this.selectedKey));
        $("btn-set-start").addEventListener("click", () => this._commit(() => M.setStart(this.map, this.selectedKey)));
        $("btn-delete-room").addEventListener("click", () => this._deleteRoom(this.selectedKey));

        $("room-name").addEventListener("change", (e) => {
            const room = this.room;
            if (room) this._commit(() => { room.name = e.target.value.trim() || "Sala"; });
        });
        $("room-notes").addEventListener("change", (e) => {
            const room = this.room;
            if (room) this._commit(() => { room.notes = e.target.value; });
        });
        $("btn-apply-size").addEventListener("click", () => this._applyRoomSize());

        for (const btn of document.querySelectorAll("#tool-grid [data-tool]")) {
            btn.addEventListener("click", () => this._setTool(btn.dataset.tool));
        }
        $("paint-kind").addEventListener("change", (e) => { this.paintKind = e.target.value; this._syncUI(); });
        $("show-kinds").addEventListener("change", (e) => { this.showKinds = e.target.checked; });
        $("prop-flip").addEventListener("change", (e) => { this.propFlip = e.target.checked; });

        $("btn-zoom-in").addEventListener("click", () => this._zoomAt(1.25, this.canvas.width / 2, this.canvas.height / 2));
        $("btn-zoom-out").addEventListener("click", () => this._zoomAt(0.8, this.canvas.width / 2, this.canvas.height / 2));
        $("btn-zoom-fit").addEventListener("click", () => this._fit());
        $("toggle-grid").addEventListener("change", (e) => { this.showGrid = e.target.checked; });
        $("btn-undo").addEventListener("click", () => this._undo());
        $("btn-redo").addEventListener("click", () => this._redo());
    }

    _buildDoorTypes() {
        const list = $("door-types");
        list.innerHTML = "";
        for (const [type, def] of Object.entries(DOOR_TYPES)) {
            const label = document.createElement("label");
            const input = document.createElement("input");
            input.type = "radio";
            input.name = "door-type";
            input.value = type;
            input.checked = type === this.doorType;
            input.addEventListener("change", () => { this.doorType = type; });
            const swatch = document.createElement("span");
            swatch.className = "swatch";
            swatch.style.background = def.color;
            label.append(input, swatch, document.createTextNode(def.label));
            list.appendChild(label);
        }
    }

    _buildPropGrid() {
        const grid = $("prop-grid");
        grid.innerHTML = "";
        this.propThumbs = [];
        for (const type of ANIMATED_PROP_KEYS) {
            const def = ANIMATED_PROPS[type];
            const btn = document.createElement("button");
            btn.className = "prop-btn";
            btn.type = "button";
            btn.dataset.prop = type;
            btn.title = `${def.label} (${def.w}×${def.h} tile${def.w * def.h > 1 ? "s" : ""})`;
            const cv = document.createElement("canvas");
            cv.width = 32;
            cv.height = 32;
            const name = document.createElement("span");
            name.textContent = def.label;
            btn.append(cv, name);
            btn.addEventListener("click", () => {
                this.propType = type;
                this._setTool("prop");
            });
            grid.appendChild(btn);
            this.propThumbs.push({ type, ctx: cv.getContext("2d") });
        }
    }

    _setVal(id, value) {
        const el = $(id);
        if (el && document.activeElement !== el && el.value !== String(value)) el.value = value;
    }

    _syncUI() {
        if (this.view === "room" && !this.room) {
            this.view = "map";
            this.editingKey = null;
        }
        const isRoom = this.view === "room";
        for (const el of document.querySelectorAll("[data-view]")) el.hidden = el.dataset.view !== this.view;
        $("btn-back-map").hidden = !isRoom;
        $("btn-playtest").hidden = !isRoom;
        $("btn-undo").disabled = !this.undoStack.length;
        $("btn-redo").disabled = !this.redoStack.length;
        $("status-save").textContent = this.dirtyServer ? "Alterações salvas só no navegador (Salvar grava no servidor)" : (this._lastSaved || "Sem alterações pendentes");

        if (isRoom) this._syncRoomUI();
        else this._syncMapUI();
        this.contentTools?.sync();
    }

    _syncMapUI() {
        const map = this.map;
        const count = Object.keys(map.rooms).length;
        $("title-main").textContent = map.name;
        $("title-sub").textContent = `${count} sala(s) · grid ${map.grid.cols}×${map.grid.rows}`;
        this._setVal("map-name", map.name);
        this._setVal("grid-cols", map.grid.cols);
        this._setVal("grid-rows", map.grid.rows);
        this._setVal("default-room-cols", map.roomSize.cols);
        this._setVal("default-room-rows", map.roomSize.rows);
        this._setVal("map-file", this.file);

        const key = this.selectedKey;
        const room = key ? map.rooms[key] : null;
        $("cell-empty").hidden = !key || !!room;
        $("cell-room").hidden = !room;
        if (!key) $("cell-info").textContent = "Clique numa célula do grid.";
        else if (!room) $("cell-info").textContent = `Célula ${key} vazia.`;
        else {
            const order = M.sequenceOrder(map).get(key);
            const parts = [`"${room.name}" em ${key}`, `${room.cols}×${room.rows} tiles`, `${room.doors.length} porta(s)`, `${room.props.length} prop(s)`];
            if (map.start === key) parts.push("início");
            if (order !== undefined) parts.push(`ordem #${order + 1}`);
            $("cell-info").textContent = parts.join(" · ");
            $("btn-set-start").disabled = map.start === key;
        }

        const report = M.validateMap(map);
        const list = $("validation-list");
        list.innerHTML = "";
        const add = (cls, text) => {
            const li = document.createElement("li");
            li.className = cls;
            li.textContent = text;
            list.appendChild(li);
        };
        for (const msg of report.errors) add("err", msg);
        for (const msg of report.warnings) add("warn", msg);
        if (!report.errors.length && !report.warnings.length) add("ok", "Tudo certo.");
    }

    _syncRoomUI() {
        const room = this.room;
        $("title-main").textContent = room.name;
        $("title-sub").textContent = `${this.editingKey} · ${room.cols}×${room.rows} tiles${this.map.start === this.editingKey ? " · início" : ""}`;
        this._setVal("room-name", room.name);
        this._setVal("room-notes", room.notes);
        this._setVal("room-cols", room.cols);
        this._setVal("room-rows", room.rows);

        const issues = validatePlayable(this.map, { roomKey: this.editingKey });
        const info = $("legacy-info");
        info.className = issues.length ? "hint warn" : "hint ok";
        info.textContent = issues.length ? `Testar no jogo: ${issues.join(" ")}` : "Esta sala pode ser testada no jogo.";
        $("btn-playtest").disabled = false;

        for (const btn of document.querySelectorAll("#tool-grid [data-tool]")) btn.classList.toggle("active", btn.dataset.tool === this.tool);
        $("paint-kind-field").hidden = this.tool !== "paint";
        $("door-type-field").hidden = this.tool !== "door";
        this._setVal("paint-kind", this.paintKind);
        $("prop-flip").checked = this.propFlip;
        for (const btn of document.querySelectorAll("#prop-grid [data-prop]")) btn.classList.toggle("active", btn.dataset.prop === this.propType);

        const s = this.palette.selection;
        const idx = this.palette.firstIndex;
        const autoKind = TILE_KINDS[M.defaultKindForTile(idx)].label;
        $("tile-info").textContent = s.w * s.h > 1
            ? `Bloco ${s.w}×${s.h} a partir do tile #${idx}. Clique e arraste na paleta para escolher outro bloco.`
            : `Tile #${idx} (coluna ${s.col}, linha ${s.row}) · automático: ${autoKind}. Arraste na paleta para escolher um bloco.`;
    }

    _updateMapStatus() {
        const key = this.hoverSlot;
        const room = key ? this.map.rooms[key] : null;
        $("status-coords").textContent = !key ? "—" : room ? `Célula ${key} · ${room.name} · ${room.cols}×${room.rows}` : `Célula ${key} · vazia`;
    }

    _updateRoomStatus() {
        const room = this.room;
        const h = this.hover;
        if (!room || !h || !M.inBounds(room, h.col, h.row)) {
            $("status-coords").textContent = "Fora da sala";
            return;
        }
        const kind = room.kinds[h.row][h.col];
        const tile = room.tiles[h.row][h.col];
        const door = M.doorAt(room, h.col, h.row);
        const prop = M.propAt(room, h.col, h.row);
        const parts = [`Tile ${h.col},${h.row}`, tile >= 0 ? `índice ${tile}` : null, TILE_KINDS[kind]?.label];
        if (door) parts.push(DOOR_TYPES[door.type]?.label || door.type);
        if (prop) parts.push(ANIMATED_PROPS[prop.type]?.label || prop.type);
        $("status-coords").textContent = parts.filter(Boolean).join(" · ");
    }

    // ---------- render ----------

    _frame(t) {
        this.now = t;
        this._render();
        if (this.view === "room") this._renderPropThumbs();
        requestAnimationFrame((n) => this._frame(n));
    }

    _render() {
        const ctx = this.ctx;
        const cam = this.cam;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = "#07060c";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.setTransform(cam.zoom, 0, 0, cam.zoom, cam.panX, cam.panY);
        ctx.imageSmoothingEnabled = false;
        if (this.view === "map") this._renderMap(ctx);
        else if (this.room) this._renderRoom(ctx);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    _drawTiles(ctx, room, ox, oy, T) {
        for (let r = 0; r < room.rows; r++) {
            for (let c = 0; c < room.cols; c++) {
                const kind = room.kinds[r][c];
                const x = ox + c * T, y = oy + r * T;
                if (kind === "v") {
                    ctx.fillStyle = EMPTY_FLOOR_COLOR;
                    ctx.fillRect(x, y, T, T);
                } else if (kind === "h") {
                    ctx.fillStyle = "#030206";
                    ctx.fillRect(x, y, T, T);
                    this.tileset.draw(ctx, holeTileFor(room.tiles, c, r), x, y, T, T);
                } else {
                    this.tileset.draw(ctx, room.tiles[r][c], x, y, T, T);
                }
            }
        }
    }

    _drawDoors(ctx, room, ox, oy, T, detailed) {
        for (const door of room.doors) for (const d of doorCells(room, door).map(p => ({ ...door, ...p }))) {
            const def = DOOR_TYPES[d.type] || DOOR_TYPES[DEFAULT_DOOR_TYPE];
            const x = ox + d.col * T, y = oy + d.row * T;
            ctx.save();
            ctx.globalAlpha = 0.45;
            ctx.fillStyle = def.color;
            ctx.fillRect(x, y, T, T);
            ctx.globalAlpha = 1;
            ctx.strokeStyle = def.color;
            ctx.lineWidth = Math.max(1, T / 16);
            ctx.strokeRect(x + ctx.lineWidth / 2, y + ctx.lineWidth / 2, T - ctx.lineWidth, T - ctx.lineWidth);
            if (detailed) {
                const side = M.doorSide(room, d.col, d.row);
                const cx = x + T / 2, cy = y + T / 2, a = T * 0.22;
                const dir = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[side] || [0, 0];
                ctx.fillStyle = "#fffffe";
                ctx.beginPath();
                ctx.moveTo(cx + dir[0] * a, cy + dir[1] * a);
                ctx.lineTo(cx - dir[1] * a - dir[0] * a * 0.6, cy + dir[0] * a - dir[1] * a * 0.6);
                ctx.lineTo(cx + dir[1] * a - dir[0] * a * 0.6, cy - dir[0] * a - dir[1] * a * 0.6);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();
        }
    }

    _drawProps(ctx, room, ox, oy, T) {
        for (const p of room.props) {
            const x = ox + p.col * T, y = oy + p.row * T;
            if (Number.isInteger(p.index)) {
                this.tileset.draw(ctx, p.index, x, y, T, T);
            } else if (!this.props.draw(ctx, p.type, x, y, T, this.now, !!p.flip)) {
                const { w, h } = M.propFootprint(p);
                ctx.fillStyle = "rgba(255, 137, 6, 0.5)";
                ctx.fillRect(x, y, w * T, h * T);
            }
        }
    }

    _renderMap(ctx) {
        const map = this.map;
        const L = this._slotLayout();
        const zoom = this.cam.zoom;
        const px = 1 / zoom;
        const order = M.sequenceOrder(map);

        ctx.fillStyle = "#0c0b14";
        ctx.fillRect(0, 0, L.w, L.h);

        for (let gy = 0; gy < map.grid.rows; gy++) {
            for (let gx = 0; gx < map.grid.cols; gx++) {
                const key = M.cellKey(gx, gy);
                const s = this._slotRect(gx, gy, L);
                const room = map.rooms[key];
                if (!room) {
                    ctx.save();
                    ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
                    ctx.lineWidth = 2 * px;
                    ctx.setLineDash([8 * px, 6 * px]);
                    ctx.strokeRect(s.x, s.y, s.w, s.h);
                    ctx.restore();
                    ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
                    ctx.font = `700 ${28 * px}px "Segoe UI", sans-serif`;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText("+", s.x + s.w / 2, s.y + s.h / 2);
                    continue;
                }
                const o = this._roomOrigin(room, gx, gy, L);
                this._drawTiles(ctx, room, o.x, o.y, MAP_TILE_PX);
                this._drawProps(ctx, room, o.x, o.y, MAP_TILE_PX);
                this._drawDoors(ctx, room, o.x, o.y, MAP_TILE_PX, false);
                this.contentTools.drawRoom(ctx, room, o.x, o.y, MAP_TILE_PX);

                const label = `${order.has(key) ? `#${order.get(key) + 1} ` : ""}${room.name}${map.start === key ? "  ★ início" : ""}`;
                ctx.font = `700 ${12 * px}px "Segoe UI", sans-serif`;
                ctx.textAlign = "left";
                ctx.textBaseline = "top";
                const tw = ctx.measureText(label).width;
                ctx.fillStyle = "rgba(8, 7, 13, 0.8)";
                ctx.fillRect(o.x, o.y, tw + 10 * px, 18 * px);
                ctx.fillStyle = map.start === key ? "#ffd166" : "#fffffe";
                ctx.fillText(label, o.x + 5 * px, o.y + 3 * px);
            }
        }

        for (const link of map.connections ? [] : M.roomLinks(map)) {
            const { gx, gy } = M.parseKey(link.from);
            const room = map.rooms[link.from];
            const o = this._roomOrigin(room, gx, gy, L);
            const s = this._slotRect(gx, gy, L);
            const cx = o.x + (link.doors.reduce((a, d) => a + d.col, 0) / link.doors.length + 0.5) * MAP_TILE_PX;
            const cy = o.y + (link.doors.reduce((a, d) => a + d.row, 0) / link.doors.length + 0.5) * MAP_TILE_PX;
            let ex = cx, ey = cy;
            if (link.side === "N") ey = s.y - L.gap / 2;
            else if (link.side === "S") ey = s.y + s.h + L.gap / 2;
            else if (link.side === "W") ex = s.x - L.gap / 2;
            else ex = s.x + s.w + L.gap / 2;
            ctx.save();
            ctx.strokeStyle = LINK_COLORS[link.status];
            ctx.lineWidth = 4 * px;
            if (link.status !== "ok") ctx.setLineDash([6 * px, 5 * px]);
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(ex, ey);
            ctx.stroke();
            ctx.restore();
        }

        this.contentTools.drawConnections(ctx);
        const highlight = (key, color, width) => {
            if (!key) return;
            const { gx, gy } = M.parseKey(key);
            const s = this._slotRect(gx, gy, L);
            ctx.strokeStyle = color;
            ctx.lineWidth = width * px;
            ctx.strokeRect(s.x - 4 * px, s.y - 4 * px, s.w + 8 * px, s.h + 8 * px);
        };
        if (this.mapDrag && this.mapDrag.moved) highlight(this.hoverSlot, "#ffd166", 3);
        else if (this.hoverSlot && this.hoverSlot !== this.selectedKey) highlight(this.hoverSlot, "rgba(255, 255, 255, 0.35)", 2);
        highlight(this.selectedKey, "#7f5af0", 3);
    }

    _renderRoom(ctx) {
        const room = this.room;
        const T = ROOM_TILE_PX;
        const W = room.cols * T, H = room.rows * T;
        ctx.fillStyle = "#0c0b14";
        ctx.fillRect(0, 0, W, H);
        this._drawTiles(ctx, room, 0, 0, T);
        if (this.showKinds) this._drawKinds(ctx, room, T);
        this._drawProps(ctx, room, 0, 0, T);
        this._drawDoors(ctx, room, 0, 0, T, true);
        this.contentTools.drawRoom(ctx, room, 0, 0, T);

        if (this.showGrid) {
            ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
            ctx.lineWidth = 1 / this.cam.zoom;
            ctx.beginPath();
            for (let c = 0; c <= room.cols; c++) { ctx.moveTo(c * T, 0); ctx.lineTo(c * T, H); }
            for (let r = 0; r <= room.rows; r++) { ctx.moveTo(0, r * T); ctx.lineTo(W, r * T); }
            ctx.stroke();
        }
        ctx.strokeStyle = "rgba(127, 90, 240, 0.8)";
        ctx.lineWidth = 2 / this.cam.zoom;
        ctx.strokeRect(0, 0, W, H);

        this._drawHoverPreview(ctx, room, T);
    }

    _drawKinds(ctx, room, T) {
        ctx.save();
        for (let r = 0; r < room.rows; r++) {
            for (let c = 0; c < room.cols; c++) {
                const kind = room.kinds[r][c];
                const x = c * T, y = r * T;
                if (kind === "w") {
                    ctx.fillStyle = "rgba(239, 69, 101, 0.18)";
                    ctx.fillRect(x, y, T, T);
                    ctx.strokeStyle = "rgba(239, 69, 101, 0.5)";
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(x + T * 0.2, y + T * 0.8);
                    ctx.lineTo(x + T * 0.8, y + T * 0.2);
                    ctx.stroke();
                } else if (kind === "h") {
                    ctx.strokeStyle = "rgba(229, 49, 112, 0.6)";
                    ctx.lineWidth = 2;
                    ctx.setLineDash([6, 5]);
                    ctx.strokeRect(x + 3, y + 3, T - 6, T - 6);
                    ctx.setLineDash([]);
                } else if (kind === "v") {
                    ctx.strokeStyle = "rgba(148, 161, 178, 0.45)";
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(x + T * 0.25, y + T * 0.25);
                    ctx.lineTo(x + T * 0.75, y + T * 0.75);
                    ctx.moveTo(x + T * 0.75, y + T * 0.25);
                    ctx.lineTo(x + T * 0.25, y + T * 0.75);
                    ctx.stroke();
                }
            }
        }
        ctx.restore();
    }

    _drawHoverPreview(ctx, room, T) {
        const h = this.hover;
        if (!h || this.isPanning) return;
        const box = (c, r, w, hh, color) => {
            ctx.strokeStyle = color;
            ctx.lineWidth = 3 / this.cam.zoom;
            ctx.strokeRect(c * T + 1, r * T + 1, w * T - 2, hh * T - 2);
        };
        ctx.save();
        switch (this.tool) {
            case "paint": {
                const stamp = this.palette.stamp;
                ctx.globalAlpha = 0.6;
                for (let dy = 0; dy < stamp.length; dy++) {
                    for (let dx = 0; dx < stamp[dy].length; dx++) {
                        if (M.inBounds(room, h.col + dx, h.row + dy)) this.tileset.draw(ctx, stamp[dy][dx], (h.col + dx) * T, (h.row + dy) * T, T, T);
                    }
                }
                ctx.globalAlpha = 1;
                box(h.col, h.row, stamp[0].length, stamp.length, "#ffd166");
                break;
            }
            case "door": {
                const ok = !!M.doorSide(room, h.col, h.row);
                box(h.col, h.row, 1, 1, ok ? (DOOR_TYPES[this.doorType]?.color || "#2cb67d") : "#ef4565");
                break;
            }
            case "prop": {
                const existing = M.propAt(room, h.col, h.row);
                if (existing) {
                    const { w, h: ph } = M.propFootprint(existing);
                    box(existing.col, existing.row, w, ph, "#ef4565");
                    break;
                }
                const def = ANIMATED_PROPS[this.propType];
                ctx.globalAlpha = 0.6;
                this.props.draw(ctx, this.propType, h.col * T, h.row * T, T, this.now, this.propFlip);
                ctx.globalAlpha = 1;
                box(h.col, h.row, def.w, def.h, M.canPlaceProp(room, this.propType, h.col, h.row) ? "#2cb67d" : "#ef4565");
                break;
            }
            default:
                if (M.inBounds(room, h.col, h.row)) box(h.col, h.row, 1, 1, this.tool === "erase" ? "#94a1b2" : "#ffd166");
        }
        ctx.restore();
    }

    _renderPropThumbs() {
        for (const { type, ctx } of this.propThumbs) {
            const def = ANIMATED_PROPS[type];
            ctx.clearRect(0, 0, 32, 32);
            ctx.imageSmoothingEnabled = false;
            const tilePx = 32 / Math.max(def.w, def.h);
            const dx = (32 - def.w * tilePx) / 2, dy = (32 - def.h * tilePx) / 2;
            this.props.draw(ctx, type, dx, dy, tilePx, this.now);
        }
    }
}

window.addEventListener("DOMContentLoaded", () => {
    window.mapEditor = new MapEditorApp();
});
