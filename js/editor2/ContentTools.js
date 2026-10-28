import { ENEMY_TYPES } from '../config/EntityConfig.js';
import { DEMO, INTERACTIVES } from '../config/DemoConfig.js';
import { connectDoors, identifyDoors, doorCells, validatePlayable, sideOf, safeSpawnPair } from '../rooms/MapConnections.js';
import { scatterProps, randomizeFloor, placeDoor } from './MapContent.js';
import { AssetLoader } from '../core/AssetLoader.js';
import { editorEnemyTypes, thumbRegion } from './ContentCatalog.js';

const $ = id => document.getElementById(id);

const TRAPS = [
    ['spike', 'Espinhos', 'assets/peaks/peaks_3.png'], ['spikeRow', 'Fileira', 'assets/peaks/peaks_2.png'],
    ['arrow', 'Flechas', 'assets/arrow/arrow_1.png'], ['button', 'Botão co-op', 'assets/buttom/buttom_16.png']
];
const TORCHES = [
    ['torch', 'Parede', 'torch1'], ['candlestick_1', 'Castiçal 1', 'candlestick1_1'], ['candlestick_2', 'Castiçal 2', 'candlestick2_1']
];
const TOOL_LABELS = {
    paint: 'Tile', hole: 'Buraco', void: 'Vazio', collision: 'Colisão', door: 'Porta', prop: 'Prop animado', erase: 'Borracha',
    spawn1: 'Spawn P1', spawn2: 'Spawn P2', enemy: 'Inimigo', torch: 'Tocha', hazard: 'Armadilha', interactive: 'Interativo',
    bridge: 'Ponte da alavanca', staticProp: 'Decoração (tile como prop)', eraseContent: 'Remover conteúdo'
};

export class ContentTools {
    constructor(app) {
        this.app = app;
        this.assets = new AssetLoader();
        this.connecting = false;
        this.source = null;
        this.bridgeId = null;
        this.choice = 'spike';
        this.enemyType = editorEnemyTypes()[0]?.key;
        this.torchType = TORCHES[0][0];
        this.interactiveType = Object.keys(INTERACTIVES)[0];
        this.thumbs = [];
        this._build();
        this._drawThumbs();
        this.assets.whenReady().then(() => this._drawThumbs());
    }

    // Lista de botões com miniatura. Clicar escolhe o item e ativa a ferramenta.
    _buildChoiceList(containerId, tool, items, type) {
        const list = $(containerId);
        for (const item of items) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'btn choice-btn';
            button.dataset.tool = tool;
            button.dataset.value = item.key;
            button.title = item.label;
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = 32;
            canvas.setAttribute('aria-hidden', 'true');
            const text = document.createElement('span');
            text.textContent = item.label;
            button.append(canvas, text);
            button.onclick = () => { this[type] = item.key; this.select(tool); };
            list.append(button);
            this.thumbs.push({ ctx: canvas.getContext('2d'), draw: item.draw });
            // Redesenha assim que a imagem do próprio item carregar (sem esperar todos os assets).
            const img = item.img?.();
            if (img && !(img.complete && img.naturalWidth)) img.addEventListener('load', () => this._drawThumbs(), { once: true });
        }
    }

    _drawThumbs() {
        for (const { ctx, draw } of this.thumbs) {
            ctx.clearRect(0, 0, 32, 32);
            ctx.imageSmoothingEnabled = false;
            draw(ctx);
        }
    }

    _fitImage(ctx, img, sx, sy, w, h) {
        if (!img?.complete || !img.naturalWidth) return;
        const k = Math.min(30 / w, 30 / h), dw = w * k, dh = h * k;
        ctx.drawImage(img, sx, sy, w, h, (32 - dw) / 2, (32 - dh) / 2, dw, dh);
    }

    _enemyItems() {
        return editorEnemyTypes().map(t => ({
            key: t.key, label: t.label,
            img: () => t.config(this.assets).img,
            draw: ctx => {
                const cfg = t.config(this.assets), r = thumbRegion(cfg);
                this._fitImage(ctx, cfg.img, r.sx, r.sy, r.w, r.h);
            }
        }));
    }

    _torchItems() {
        return TORCHES.map(([key, label, asset]) => ({
            key, label,
            img: () => this.assets.get(asset),
            draw: ctx => { const img = this.assets.get(asset); this._fitImage(ctx, img, 0, 0, img?.naturalWidth, img?.naturalHeight); }
        }));
    }

    _interactiveItems() {
        return Object.entries(INTERACTIVES).map(([key, def]) => ({
            key, label: def.label,
            draw: ctx => {
                ctx.fillStyle = def.color; ctx.fillRect(4, 4, 24, 24);
                ctx.fillStyle = '#111'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(def.symbol, 16, 17);
            }
        }));
    }

    _build() {
        const panel = document.createElement('section');
        panel.className = 'tool-group expanded';
        panel.dataset.view = 'room';
        this.panel = panel;
        panel.innerHTML = `<h2 class="group-title">Conteúdo e gameplay</h2><div class="group-body"><div class="tab-panel">
            <div id="content-active" class="active-tool" role="status" aria-live="polite"></div>
            <div class="content-actions"><button class="btn" data-content="spawn1">Spawn P1</button><button class="btn" data-content="spawn2">Spawn P2</button></div>
            <div class="panel-title">Inimigos</div><div id="content-enemies" class="choice-grid" role="group" aria-label="Inimigo"></div>
            <div class="panel-title">Tochas</div><div id="content-torches" class="choice-grid" role="group" aria-label="Tocha"></div>
            <div class="panel-title">Armadilhas</div><div id="content-traps" class="content-actions"></div>
            <label class="field">Ritmo<select id="content-timing"><option>normal</option><option>fast</option><option>slow</option></select></label>
            <label class="field">Atraso (s)<input id="content-delay" type="number" min="0" max="30" step="0.1" value="0"></label>
            <label class="field">Direção<select id="content-direction"><option value="right">Direita</option><option value="left">Esquerda</option><option value="down">Baixo</option><option value="up">Cima</option></select></label>
            <label class="field">Quantidade da fileira<input id="content-count" type="number" min="1" max="20" value="3"></label>
            <label class="field">Portas da sala<select id="content-lock"><option value="none">Sempre abertas</option><option value="enemies">Derrotar inimigos</option><option value="buttons">Botões co-op</option></select></label>
            <label class="field">Tipo de sala<select id="content-room-type"><option value="normal">Normal</option><option value="boss">Boss / conclusão</option></select></label>
            <div class="panel-title">Interativos</div><div id="content-interactives" class="choice-grid" role="group" aria-label="Interativo"></div>
            <button class="btn" data-content="bridge">Marcar ponte da alavanca selecionada</button>
            <p class="hint">Clique novamente na alavanca para selecioná-la. Com “Marcar ponte”, clique nos buracos que formarão sua ponte.</p>
            <div class="panel-title">Decoração sobre o piso</div>
            <button class="btn" data-content="staticProp">Colocar tile selecionado como prop</button>
            <label class="field">Densidade (%)<input id="content-density" type="range" min="0" max="40" value="12"></label>
            <button class="btn" id="content-scatter">Sortear props novamente</button>
            <label class="field">Tiles de chão (índices separados por vírgula)<input id="content-floor-pool" value="${DEMO.floorTiles.join(',')}"></label>
            <button class="btn" id="content-floor">Sortear chão novamente</button>
            <button class="btn btn-danger" data-content="eraseContent">Remover conteúdo no tile</button>
            <p class="hint" id="content-hint">Selecione uma ferramenta e clique na sala. Ctrl+Z desfaz.</p>
        </div></div>`;
        // Depois dos cards existentes: no mapa, "Mapa" continua no topo.
        $('sidebar-left').querySelector('.tab-panel-container').append(panel);
        this._buildChoiceList('content-enemies', 'enemy', this._enemyItems(), 'enemyType');
        this._buildChoiceList('content-torches', 'torch', this._torchItems(), 'torchType');
        this._buildChoiceList('content-interactives', 'interactive', this._interactiveItems(), 'interactiveType');
        for (const [type, label, img] of TRAPS) {
            const button = document.createElement('button');
            button.className = 'btn trap-choice';
            button.type = 'button';
            button.dataset.trap = type;
            button.title = label;
            const image = document.createElement('img'); image.src = img; image.alt = label;
            const text = document.createElement('span'); text.textContent = label;
            button.append(image, text);
            button.onclick = () => { this.choice = type; this.select('hazard'); };
            $('content-traps').append(button);
        }
        panel.querySelectorAll('[data-content]').forEach(b => b.onclick = () => this.select(b.dataset.content));
        $('content-lock').onchange = () => this.app._commit(() => { this.app.room.lock = $('content-lock').value; });
        $('content-room-type').onchange = () => this.app._commit(() => { this.app.room.type = $('content-room-type').value; });
        $('content-scatter').onclick = () => this.app._commit(() => scatterProps(this.app.room, Number($('content-density').value) / 100));
        $('content-floor').onclick = () => this.app._commit(() => randomizeFloor(this.app.room, $('content-floor-pool').value.split(',').map(Number)));

        const doors = document.createElement('div');
        doors.className = 'field';
        doors.innerHTML = '<span>Largura da porta (tiles)</span><input id="content-door-width" type="number" min="1" max="6" value="2">';
        $('door-type-field').append(doors);

        const connections = document.createElement('section');
        connections.dataset.view = 'map'; connections.className = 'tool-group expanded';
        connections.innerHTML = `<h2 class="group-title">Conexões de portas</h2><div class="group-body"><div class="tab-panel">
            <button id="content-connect" class="btn">Conectar portas</button>
            <label><input type="checkbox" id="content-one-way"> Mão única (origem → destino)</label>
            <label class="field">Requisito<select id="content-requires"><option value="">Nenhum</option><option value="dash">Dash</option><option value="sawThrow">Lançar Serra</option><option value="bossKey">Chave do boss</option></select></label>
            <p class="hint" id="connection-hint">Ative o modo e clique em uma porta de cada sala. Clique em uma linha para removê-la.</p>
            <div id="content-connections"></div>
        </div></div>`;
        panel.after(connections);
        $('content-connect').onclick = () => { this.connecting = !this.connecting; this.source = null; this.sync(); };

        const tests = document.createElement('section');
        tests.className = 'tool-group expanded';
        tests.innerHTML = `<h2 class="group-title">Teste e demo</h2><div class="group-body"><div class="tab-panel">
            <label><input type="checkbox" id="test-dash"> Dash liberado</label>
            <label><input type="checkbox" id="test-saw"> Lançar serra liberado</label>
            <label><input type="checkbox" id="test-key"> Chave do boss</label>
            <label class="field">Câmera para comparar<select id="test-camera"><option value="zoom">Zoom-out</option><option value="fixed">Zoom fixo + indicadores</option><option value="split">Tela dividida</option></select></label>
            <button class="btn btn-primary" id="content-test-map">Testar mapa</button>
            <button class="btn" id="content-main">Definir mapa salvo como principal</button>
            <p class="hint">No jogo: P1 E / P2 Shift direito / controle X interagem. F6 alterna as câmeras durante o teste.</p>
        </div></div>`;
        connections.after(tests);
        $('content-test-map').onclick = () => this.playtest(false);
        $('content-main').onclick = () => this.setMain();
    }

    select(tool) {
        this.app.tool = tool;
        $('content-hint').textContent = 'Clique na sala para aplicar; Ctrl+Z desfaz.';
        this.app._syncUI();
    }

    _activeDescription() {
        const tool = this.app.tool, name = TOOL_LABELS[tool] || tool;
        const detail = {
            enemy: () => editorEnemyTypes().find(t => t.key === this.enemyType)?.label,
            torch: () => TORCHES.find(t => t[0] === this.torchType)?.[1],
            interactive: () => INTERACTIVES[this.interactiveType]?.label,
            hazard: () => TRAPS.find(t => t[0] === this.choice)?.[1]
        }[tool]?.();
        return detail ? `${name}: ${detail}` : name;
    }

    _markActive(button, active) {
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
    }

    _syncSelection() {
        const tool = this.app.tool;
        $('content-active').textContent = `Ferramenta ativa: ${this._activeDescription()}`;
        for (const b of this.panel.querySelectorAll('[data-content]')) this._markActive(b, b.dataset.content === tool);
        for (const b of this.panel.querySelectorAll('[data-trap]')) this._markActive(b, tool === 'hazard' && b.dataset.trap === this.choice);
        const current = { enemy: this.enemyType, torch: this.torchType, interactive: this.interactiveType };
        for (const b of this.panel.querySelectorAll('.choice-btn')) this._markActive(b, tool === b.dataset.tool && b.dataset.value === current[b.dataset.tool]);
    }

    sync() {
        this._syncSelection();
        const room = this.app.room;
        if (room) {
            $('content-lock').value = room.lock || 'none';
            $('content-room-type').value = room.type || 'normal';
            if (document.activeElement !== $('content-floor-pool')) $('content-floor-pool').value = (room.floorPool || DEMO.floorTiles).join(',');
        }
        $('content-connect').classList.toggle('btn-primary', this.connecting);
        $('connection-hint').textContent = this.source ? 'Agora clique na porta de destino.' : this.connecting ? 'Clique na primeira porta. Clique em uma linha para remover.' : 'Ative o modo para conectar portas.';
        const list = $('content-connections'); list.replaceChildren();
        for (const [index, c] of (this.app.map.connections || []).entries()) {
            const button = document.createElement('button'); button.className = 'btn connection-entry';
            button.textContent = `${this.app.map.rooms[c.from.room]?.name || '?'} ${c.oneWay ? '→' : '↔'} ${this.app.map.rooms[c.to.room]?.name || '?'}${c.requires ? ` • ${c.requires}` : ''} ×`;
            button.title = 'Remover conexão'; button.onclick = () => this.app._commit(() => this.app.map.connections.splice(index, 1)); list.append(button);
        }
    }

    apply(col, row) {
        const a = this.app, r = a.room, type = a.tool;
        if (!r || col < 0 || row < 0 || col >= r.cols || row >= r.rows) return true;
        const cell = { col, row };
        const onFloor = r.kinds[row][col] === 'f';
        if (type === 'door') {
            if (a.stroke.mode) return true;
            a.stroke.mode = 'done';
            const hit = r.doors.find(d => doorCells(r, d).some(p => p.col === col && p.row === row));
            if (hit) {
                r.doors = r.doors.filter(d => d !== hit);
                a.map.connections = (a.map.connections || []).filter(c => ![c.from, c.to].some(e => e.room === a.editingKey && e.door === hit.id));
            } else placeDoor(r, col, row, a.doorType, Number($('content-door-width').value));
            return true;
        }
        if (type === 'spawn1' || type === 'spawn2') {
            if (!onFloor || col === 0 || row === 0 || col === r.cols - 1 || row === r.rows - 1) return true;
            r.spawns ||= safeSpawnPair(r) || {};
            r.spawns[type === 'spawn1' ? 'p1' : 'p2'] = cell;
        } else if (type === 'enemy' && onFloor) this._toggle(r, 'enemies', { ...cell, type: this.enemyType });
        else if (type === 'staticProp' && onFloor) this._toggle(r, 'props', { ...cell, index: a.palette.firstIndex });
        else if (type === 'torch') {
            const torch = this.torchType;
            const side = torch === 'torch' ? sideOf(r, cell) || (col === 1 ? 'W' : col === r.cols - 2 ? 'E' : 'N') : 'F';
            if (torch === 'torch' || onFloor) this._toggle(r, 'torches', { ...cell, type: torch, side });
        } else if (type === 'hazard') {
            if (!onFloor && this.choice !== 'arrow') return true;
            const h = { ...cell, type: this.choice, timing: $('content-timing').value, delay: Math.max(0, Number($('content-delay').value) || 0) };
            if (h.type === 'spikeRow') Object.assign(h, { dir: $('content-direction').value, count: Math.max(1, Math.min(20, Number($('content-count').value) || 1)) });
            if (h.type === 'arrow') h.side = ({ N: 'top', S: 'bottom', W: 'left', E: 'right' })[sideOf(r, cell)] || ({ right: 'left', left: 'right', down: 'top', up: 'bottom' })[$('content-direction').value];
            this._toggle(r, 'hazards', h);
        } else if (type === 'interactive') {
            const hit = (r.interactives || []).find(o => o.col === col && o.row === row);
            if (hit?.type === 'lever') { this.bridgeId = hit.id; $('content-hint').textContent = 'Alavanca selecionada. Use “Marcar ponte”.'; return true; }
            if (!onFloor) return true;
            const object = { ...cell, type: this.interactiveType, id: `object_${Date.now()}_${col}_${row}` };
            if (object.type === 'lever') { object.tiles = []; this.bridgeId = object.id; }
            this._toggle(r, 'interactives', object);
        } else if (type === 'bridge') {
            const lever = (r.interactives || []).find(o => o.id === this.bridgeId);
            if (!lever || r.kinds[row][col] !== 'h') return true;
            const i = lever.tiles.findIndex(p => p.col === col && p.row === row);
            if (i >= 0) lever.tiles.splice(i, 1); else lever.tiles.push(cell);
        } else if (type === 'eraseContent') {
            for (const field of ['enemies', 'props', 'torches', 'hazards', 'interactives']) r[field] = (r[field] || []).filter(o => o.col !== col || o.row !== row);
        } else return false;
        return true;
    }

    _toggle(room, field, object) {
        room[field] ||= [];
        const i = room[field].findIndex(p => p.col === object.col && p.row === object.row);
        if (i >= 0) room[field].splice(i, 1); else room[field].push(object);
    }

    endpointPosition(e) {
        const a = this.app, r = a.map.rooms[e.room], d = r?.doors.find(p => p.id === e.door);
        if (!d) return null;
        const [gx, gy] = e.room.split(',').map(Number), o = a._roomOrigin(r, gx, gy, a._slotLayout());
        const horizontal = ['N', 'S'].includes(sideOf(r, d));
        const w = (horizontal ? d.width || 1 : 1) * 16, h = (horizontal ? 1 : d.width || 1) * 16;
        return { x: o.x + d.col * 16 + w / 2, y: o.y + d.row * 16 + h / 2, w, h };
    }

    mapClick(e) {
        if (!this.connecting) return false;
        const a = this.app, p = a._toWorld(e.clientX, e.clientY);
        identifyDoors(a.map);
        for (const [key, room] of Object.entries(a.map.rooms)) for (const door of room.doors) {
            const end = { room: key, door: door.id }, at = this.endpointPosition(end);
            const margin = 4 / a.cam.zoom;
            if (Math.abs(p.x - at.x) > at.w / 2 + margin || Math.abs(p.y - at.y) > at.h / 2 + margin) continue;
            if (!this.source) this.source = end;
            else {
                const ok = a._commit(() => connectDoors(a.map, this.source, end, { oneWay: $('content-one-way').checked, requires: $('content-requires').value }));
                if (!ok) alert('Escolha portas livres de duas salas diferentes. Remova a conexão existente para trocar o destino.');
                this.source = null;
            }
            this.sync(); return true;
        }
        for (const [i, c] of (a.map.connections || []).entries()) {
            const from = this.endpointPosition(c.from), to = this.endpointPosition(c.to);
            if (!from || !to) continue;
            const dx = to.x - from.x, dy = to.y - from.y;
            const t = Math.max(0, Math.min(1, ((p.x - from.x) * dx + (p.y - from.y) * dy) / (dx * dx + dy * dy || 1)));
            if (Math.hypot(p.x - from.x - t * dx, p.y - from.y - t * dy) < 8 / a.cam.zoom) {
                a._commit(() => a.map.connections.splice(i, 1)); break;
            }
        }
        return true;
    }

    drawConnections(ctx) {
        const a = this.app;
        for (const c of a.map.connections || []) {
            const from = this.endpointPosition(c.from), to = this.endpointPosition(c.to);
            if (!from || !to) continue;
            ctx.save(); ctx.strokeStyle = c.requires ? '#ffd166' : '#2cb67d'; ctx.lineWidth = 3 / a.cam.zoom;
            ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
            if (c.oneWay) {
                const angle = Math.atan2(to.y - from.y, to.x - from.x), x = (from.x + to.x) / 2, y = (from.y + to.y) / 2;
                ctx.translate(x, y); ctx.rotate(angle); ctx.beginPath(); ctx.moveTo(-10, -7); ctx.lineTo(0, 0); ctx.lineTo(-10, 7); ctx.stroke();
            }
            ctx.restore();
        }
        if (this.source) {
            const p = this.endpointPosition(this.source);
            if (p) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3 / a.cam.zoom; ctx.strokeRect(p.x - 10, p.y - 10, 20, 20); }
        }
    }

    drawRoom(ctx, room, ox, oy, tile) {
        const marker = (o, color, text) => {
            ctx.fillStyle = color; ctx.fillRect(ox + o.col * tile + 3, oy + o.row * tile + 3, tile - 6, tile - 6);
            ctx.fillStyle = '#111'; ctx.font = `bold ${tile * 0.35}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(text, ox + (o.col + 0.5) * tile, oy + (o.row + 0.5) * tile);
        };
        const image = (img, o) => { if (img?.complete && img.naturalWidth) ctx.drawImage(img, ox + o.col * tile, oy + o.row * tile, tile, tile); };
        ctx.save();
        for (const e of room.enemies || []) {
            const cfg = ENEMY_TYPES.find(t => t.key === e.type)?.config(this.assets), img = cfg?.img;
            if (img?.complete && img.naturalWidth) ctx.drawImage(img, cfg.cropX, (cfg.rows.walk?.row || 0) * cfg.cellSize + cfg.cropY, cfg.cropW, cfg.cropH, ox + e.col * tile, oy + e.row * tile, tile, tile);
            else marker(e, '#ff817e', 'E');
        }
        for (const h of room.hazards || []) {
            image(this.assets.get(h.type === 'arrow' ? 'arrowTrap1' : h.type === 'button' ? 'button' : 'peaks3'), h);
        }
        for (const t of room.torches || []) {
            const f = Math.floor(this.app.now / 160) % 4 + 1;
            image(this.assets.get(t.type === 'candlestick_1' ? `candlestick1_${f}` : t.type === 'candlestick_2' ? `candlestick2_${f}` : ['W', 'E'].includes(t.side) ? `sideTorch${f}` : `torch${f}`), t);
        }
        for (const o of room.interactives || []) {
            const def = INTERACTIVES[o.type]; if (def) marker(o, def.color, def.symbol);
            for (const t of o.tiles || []) { ctx.strokeStyle = '#a6e88b'; ctx.lineWidth = 3; ctx.strokeRect(ox + t.col * tile + 3, oy + t.row * tile + 3, tile - 6, tile - 6); }
        }
        for (const [name, p] of Object.entries(room.spawns || {})) marker(p, name === 'p1' ? '#ffd166' : '#6bb4db', name.toUpperCase());
        ctx.restore();
    }

    playtest(isolated = true) {
        const a = this.app;
        const map = structuredClone(a.map);
        if (isolated) { if (!a.editingKey) return; map.start = a.editingKey; }
        identifyDoors(map);
        const errors = validatePlayable(map, { roomKey: isolated ? map.start : null });
        if (errors.length) { alert(errors.join('\n')); return; }
        const progress = { dash: $('test-dash').checked, sawThrow: $('test-saw').checked, bossKey: $('test-key').checked };
        sessionStorage.setItem(DEMO.sessionKey, JSON.stringify({ map, isolated, progress, camera: $('test-camera').value }));
        a._persistNow();
        location.href = 'index.html?playtest=true&editor2=true';
    }

    async setMain() {
        if (this.app.dirtyServer) { alert('Salve o mapa antes de defini-lo como principal.'); return; }
        const errors = validatePlayable(this.app.map);
        if (errors.length) { alert(errors.join('\n')); return; }
        try {
            const res = await fetch('/api/set-main-map', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file: this.app.file }) });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Falha ao definir mapa.');
            alert('Mapa principal atualizado. O botão Jogo inicia esse mapa.');
        } catch (error) { alert(error.message); }
    }
}
