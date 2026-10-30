import { ENEMY_TYPES } from '../config/EntityConfig.js';
import { DEMO, INTERACTIVES } from '../config/DemoConfig.js';
import { connectDoors, identifyDoors, doorCells, validatePlayable, sideOf, safeSpawnPair } from '../rooms/MapConnections.js';
import { scatterProps, randomizeFloor, placeDoor } from './MapContent.js';
import { AssetLoader } from '../core/AssetLoader.js';
import { editorEnemyTypes, thumbRegion } from './ContentCatalog.js';
import { occupiedCells } from '../rooms/MapOccupancy.js';
import { torchPlacement, isMirroredTorch } from '../rooms/TorchLayout.js';
import { arrowFireDir, arrowMountOffset, fitSpikeRow, wallSideForTile, SPIKE_ROW_WAVE } from '../rooms/HazardLayout.js';
import { HAZARDS, TILE } from '../config/GameConfig.js';
import { parseWaves, formatWaves, zoneFromCorners, setZone, setEncounter, toggleBar } from '../rooms/RoomEventsData.js';

const $ = id => document.getElementById(id);

const TRAPS = [
    ['spike', 'Espinhos', 'assets/peaks/peaks_3.png'], ['spikeRow', 'Fileira', 'assets/peaks/peaks_2.png'],
    ['arrow', 'Flechas', 'assets/arrow/arrow_1.png'], ['button', 'Botão co-op', 'assets/buttom/buttom_16.png']
];
const TORCHES = [
    ['torch', 'Parede', 'torch1'], ['candlestick_1', 'Castiçal 1', 'candlestick1_1'], ['candlestick_2', 'Castiçal 2', 'candlestick2_1']
];
const TOOL_LABELS = {
    paint: 'Tile', hole: 'Buraco', void: 'Vazio', collision: 'Colisão', door: 'Porta', prop: 'Prop animado', erase: 'Borracha', wall: 'Parede',
    spawn1: 'Spawn P1', spawn2: 'Spawn P2', enemy: 'Inimigo', torch: 'Tocha', hazard: 'Armadilha', interactive: 'Interativo',
    bridge: 'Ponte da alavanca', staticProp: 'Decoração (tile como prop)', eraseContent: 'Remover conteúdo',
    zone: 'Zona', bars: 'Grade'
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
            <div class="panel-title">Chão</div>
            <label class="field">Tiles de chão (índices separados por vírgula)<input id="content-floor-pool" value="${DEMO.floorTiles.join(',')}"></label>
            <button class="btn" id="content-floor">Sortear chão novamente</button>
            <button class="btn btn-danger" data-content="eraseContent">Remover conteúdo no tile</button>
            <p class="hint" id="content-hint">Selecione uma ferramenta e clique na sala. Ctrl+Z desfaz.</p>
        </div></div>`;
        // Depois dos cards existentes: no mapa, "Mapa" continua no topo.
        $('sidebar-left').querySelector('.tab-panel-container').append(panel);
        this._buildEvents(panel);
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
        // Inclui o botão de decoração, que fica no card "Props" (fora deste painel).
        document.querySelectorAll('[data-content]').forEach(b => b.onclick = () => this.select(b.dataset.content));
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
            <label><input type="checkbox" id="test-infinite-lives"> Vida infinita (ambos os jogadores)</label>
            <label><input type="checkbox" id="test-arauto-intro"> Repetir apresentação completa do Arauto</label>
            <label class="field">Serra no início<select id="test-sawstart"><option value="">Conforme o mapa (sem serra se uma bigorna oferece a Serra)</option><option value="yes">Com serra</option><option value="no">Sem serra</option></select></label>
            <label class="field">Câmera para comparar<select id="test-camera"><option value="zoom">Zoom-out</option><option value="fixed">Zoom fixo + indicadores</option><option value="split">Tela dividida</option></select></label>
            <button class="btn btn-primary" id="content-test-map">Testar mapa</button>
            <button class="btn" id="content-main">Definir mapa salvo como principal</button>
            <p class="hint">No jogo: P1 E / P2 Shift direito / controle X interagem. F6 alterna as câmeras e F7 liga/desliga a vida infinita durante o teste.</p>
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
        for (const b of document.querySelectorAll('[data-content]')) this._markActive(b, b.dataset.content === tool);
        for (const b of this.panel.querySelectorAll('[data-trap]')) this._markActive(b, tool === 'hazard' && b.dataset.trap === this.choice);
        const current = { enemy: this.enemyType, torch: this.torchType, interactive: this.interactiveType };
        for (const b of this.panel.querySelectorAll('.choice-btn')) this._markActive(b, tool === b.dataset.tool && b.dataset.value === current[b.dataset.tool]);
    }

    sync() {
        this._syncSelection();
        if (this.app.tool !== 'zone') this.zoneStart = null;
        this._syncEvents();
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
        if (type === 'zone') {
            if (a.stroke.mode) return true;
            a.stroke.mode = 'done';
            if (!this.zoneStart) { this.zoneStart = cell; this._hint('Agora clique no canto oposto da zona.'); return true; }
            const id = $('content-zone-id').value.trim() || 'zona';
            setZone(r, zoneFromCorners(id, this.zoneStart, cell));
            this.zoneStart = null;
            this._hint(`Zona "${id}" salva.`);
            return true;
        }
        if (type === 'bars') {
            if (onFloor) toggleBar(r, col, row);
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
            if (torch === 'torch') {
                const mount = torchPlacement(r, cell);
                if (!mount) this._hint('Encaixe a tocha numa parede (não em porta, canto ou buraco).');
                else this._toggle(r, 'torches', { col: mount.col, row: mount.row, type: torch, side: mount.side });
            } else if (onFloor) this._toggle(r, 'torches', { ...cell, type: torch, side: 'F' });
        } else if (type === 'hazard') this._applyHazard(r, cell, onFloor);
        else if (type === 'interactive') {
            const hit = (r.interactives || []).find(o => o.col === col && o.row === row);
            if (hit?.type === 'lever') { this.bridgeId = hit.id; $('content-hint').textContent = 'Alavanca selecionada. Use “Marcar ponte”.'; return true; }
            if (!onFloor) return true;
            const object = { ...cell, type: this.interactiveType, id: `object_${Date.now()}_${col}_${row}` };
            if (object.type === 'lever') { object.tiles = []; this.bridgeId = object.id; }
            if (object.type === 'rope' && $('content-rope-auto').checked) object.auto = true;
            if (object.type === 'chestRope' && !hit) {
                const used = new Set((r.interactives || []).map(o => o.id));
                let n = 1;
                while (used.has(`corda${n}`)) n++;
                object.id = `corda${n}`;
                this._hint(`Corda com baú “${object.id}”: num baú, preencha “Corda com baú” com ${object.id}.`);
            }
            this._toggle(r, 'interactives', object);
        } else if (type === 'bridge') {
            const lever = (r.interactives || []).find(o => o.id === this.bridgeId);
            if (!lever || r.kinds[row][col] !== 'h') return true;
            const i = lever.tiles.findIndex(p => p.col === col && p.row === row);
            if (i >= 0) lever.tiles.splice(i, 1); else lever.tiles.push(cell);
        } else if (type === 'eraseContent') {
            for (const field of ['enemies', 'props', 'torches', 'interactives', 'bars']) r[field] = (r[field] || []).filter(o => o.col !== col || o.row !== row);
            // Fileira de espinhos ocupa vários tiles: clicar em qualquer um remove a fileira toda.
            r.hazards = (r.hazards || []).filter(h => !occupiedCells(h).some(p => p.col === col && p.row === row));
        } else return false;
        return true;
    }

    _hint(text) { $('content-hint').textContent = text; }

    // Zonas, grades e encontros. Os eventos em si ficam no script da sala (código).
    _buildEvents(panel) {
        const events = document.createElement('section');
        events.className = 'tool-group expanded';
        events.dataset.view = 'room';
        events.innerHTML = `<h2 class="group-title">Eventos da sala</h2><div class="group-body"><div class="tab-panel">
            <label class="field">Id da zona<input id="content-zone-id" value="zona"></label>
            <button class="btn" data-content="zone">Desenhar zona (clique em dois cantos)</button>
            <div id="content-zones"></div>
            <button class="btn" data-content="bars">Grade (clique nos tiles do acesso)</button>
            <label><input type="checkbox" id="content-rope-auto"> Corda arrebenta sozinha</label>
            <div class="panel-title">Encontros</div>
            <label class="field">Id do encontro<input id="content-encounter-id" value="encontro"></label>
            <label class="field">Levas (uma por linha, tipo:quantidade)<textarea id="content-encounter-waves" rows="4" placeholder="demon:3&#10;bloodMonster:1, demon:3"></textarea></label>
            <button class="btn" id="content-encounter-save">Salvar encontro</button>
            <div id="content-encounters"></div>
            <p class="hint">O script da sala usa os ids. Tipos: demon, bloodMonster, blackKnightB…</p>
        </div></div>`;
        panel.after(events);
        $('content-encounter-save').onclick = () => {
            const id = $('content-encounter-id').value.trim();
            if (!id || !this.app.room) return;
            this.app._commit(() => setEncounter(this.app.room, { id, waves: parseWaves($('content-encounter-waves').value) }));
        };
    }

    _syncEvents() {
        const room = this.app.room;
        const zones = $('content-zones'), encounters = $('content-encounters');
        zones.replaceChildren(); encounters.replaceChildren();
        if (!room) return;
        for (const z of room.zones || []) {
            const b = document.createElement('button'); b.className = 'btn connection-entry';
            b.textContent = `Zona ${z.id} (${z.col},${z.row} ${z.w}×${z.h}) ×`;
            b.title = 'Remover zona'; b.onclick = () => this.app._commit(() => { room.zones = room.zones.filter(o => o !== z); });
            zones.append(b);
        }
        for (const e of room.encounters || []) {
            const row = document.createElement('div'); row.className = 'content-actions';
            const edit = document.createElement('button'); edit.className = 'btn';
            edit.textContent = `${e.id}: ${e.waves.length} leva(s)`;
            edit.onclick = () => { $('content-encounter-id').value = e.id; $('content-encounter-waves').value = formatWaves(e.waves); };
            const del = document.createElement('button'); del.className = 'btn btn-danger'; del.textContent = '×'; del.title = 'Remover encontro';
            del.onclick = () => this.app._commit(() => { room.encounters = room.encounters.filter(o => o !== e); });
            row.append(edit, del); encounters.append(row);
        }
        if (this.zoneStart) this._hint('Agora clique no canto oposto da zona.');
    }

    // Armadilhas: flecha só em parede (encaixa na mais próxima se o clique foi no chão), espinhos só no chão.
    _applyHazard(r, cell, onFloor) {
        const timing = $('content-timing').value;
        const delay = Math.max(0, Number($('content-delay').value) || 0);
        if (this.choice === 'arrow') {
            const mount = this._arrowMount(r, cell.col, cell.row);
            if (!mount) { this._hint('Não dá para montar a flecha numa porta.'); return; }
            this._placeHazard(r, { col: mount.col, row: mount.row, type: 'arrow', side: mount.side, phase: 0 }, cell);
            return;
        }
        if (!onFloor) return;
        if (this.choice === 'spikeRow') {
            const dir = $('content-direction').value;
            const fit = fitSpikeRow(r.cols, r.rows, cell.col, cell.row, dir, Number($('content-count').value));
            const row = { type: 'spikeRow', col: fit.col, row: fit.row, timing, delay, dir, count: fit.count, phase: 0, wave: SPIKE_ROW_WAVE };
            this._placeHazard(r, row, cell, () => occupiedCells(row).every(p => r.kinds[p.row]?.[p.col] === 'f')
                ? '' : 'A fileira não cabe aqui: há parede ou buraco no caminho. Reduza a quantidade ou mude a direção.');
            return;
        }
        const hazard = this.choice === 'spike' ? { type: 'spike', col: cell.col, row: cell.row, timing, delay } : { type: this.choice, col: cell.col, row: cell.row };
        this._placeHazard(r, hazard, cell);
    }

    // Clicar em qualquer tile de uma armadilha existente a remove; senão coloca (se o espaço estiver livre).
    _placeHazard(room, hazard, clicked, problem = () => '') {
        room.hazards ||= [];
        const at = (o) => occupiedCells(o).some(p => p.col === clicked.col && p.row === clicked.row);
        const hit = room.hazards.findIndex(at);
        if (hit >= 0) { room.hazards.splice(hit, 1); return; }
        const issue = problem();
        if (issue) { this._hint(issue); return; }
        const cells = occupiedCells(hazard);
        const taken = room.hazards.some(o => occupiedCells(o).some(p => cells.some(c => c.col === p.col && c.row === p.row)));
        if (taken) { this._hint('Já existe uma armadilha nesse espaço.'); return; }
        room.hazards.push(hazard);
    }

    // Parede onde a flecha fica montada e o lado dela. Clique no chão encaixa na borda mais próxima (como no editor 1.0).
    _arrowMount(r, col, row) {
        const lastCol = r.cols - 1, lastRow = r.rows - 1;
        const border = col === 0 || row === 0 || col === lastCol || row === lastRow;
        let target = { col, row }, side;
        if (r.kinds[row][col] === 'w') {
            side = border ? ({ N: 'top', S: 'bottom', W: 'left', E: 'right' })[sideOf(r, target)] : wallSideForTile(r.tiles[row][col]);
        } else {
            const distances = [['top', row], ['bottom', lastRow - row], ['left', col], ['right', lastCol - col]];
            side = distances.reduce((best, item) => item[1] < best[1] ? item : best)[0];
            target = { top: { col, row: 0 }, bottom: { col, row: lastRow }, left: { col: 0, row }, right: { col: lastCol, row } }[side];
        }
        const onDoor = r.doors.some(d => doorCells(r, d).some(p => p.col === target.col && p.row === target.row));
        return onDoor ? null : { ...target, side };
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
        for (const h of room.hazards || []) this._drawHazard(ctx, room, h, ox, oy, tile);
        for (const t of room.torches || []) {
            const f = Math.floor(this.app.now / 160) % 4 + 1;
            const img = this.assets.get(t.type === 'candlestick_1' ? `candlestick1_${f}` : t.type === 'candlestick_2' ? `candlestick2_${f}` : ['W', 'E'].includes(t.side) ? `sideTorch${f}` : `torch${f}`);
            if (!isMirroredTorch(t)) { image(img, t); continue; }
            ctx.save();
            ctx.translate(ox + (t.col + 1) * tile, oy + t.row * tile);
            ctx.scale(-1, 1);
            if (img?.complete && img.naturalWidth) ctx.drawImage(img, 0, 0, tile, tile);
            ctx.restore();
        }
        for (const o of room.interactives || []) {
            const def = INTERACTIVES[o.type]; if (def) marker(o, def.color, def.symbol);
            for (const t of o.tiles || []) { ctx.strokeStyle = '#a6e88b'; ctx.lineWidth = 3; ctx.strokeRect(ox + t.col * tile + 3, oy + t.row * tile + 3, tile - 6, tile - 6); }
        }
        for (const [name, p] of Object.entries(room.spawns || {})) marker(p, name === 'p1' ? '#ffd166' : '#6bb4db', name.toUpperCase());
        for (const b of room.bars || []) {
            ctx.fillStyle = 'rgba(160, 168, 184, 0.85)';
            for (let i = 1; i < 4; i++) ctx.fillRect(ox + b.col * tile + i * tile / 4 - 1, oy + b.row * tile + 2, 2, tile - 4);
        }
        for (const o of room.interactives || []) if (o.type === 'rope' && o.auto) {
            ctx.strokeStyle = '#ff5c5c'; ctx.lineWidth = 2; ctx.strokeRect(ox + o.col * tile + 1, oy + o.row * tile + 1, tile - 2, tile - 2);
        }
        // Corda com baú: id embaixo da estaca e linha até o baú ligado a ela.
        for (const o of room.interactives || []) if (o.type === 'chestRope') {
            const cx = ox + (o.col + 0.5) * tile, cy = oy + (o.row + 0.5) * tile;
            for (const p of room.props || []) if (p.rope && p.rope === o.id) {
                ctx.strokeStyle = INTERACTIVES.chestRope.color; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
                ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ox + (p.col + 0.5) * tile, oy + (p.row + 0.5) * tile); ctx.stroke();
                ctx.setLineDash([]);
            }
            ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.max(9, tile * 0.25)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            ctx.fillText(o.id, cx, oy + (o.row + 1) * tile);
        }
        for (const z of room.zones || []) {
            ctx.strokeStyle = 'rgba(127, 219, 255, 0.9)'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
            ctx.strokeRect(ox + z.col * tile + 1, oy + z.row * tile + 1, z.w * tile - 2, z.h * tile - 2);
            ctx.setLineDash([]); ctx.fillStyle = 'rgba(127, 219, 255, 0.9)'; ctx.font = `bold ${Math.max(10, tile * 0.3)}px sans-serif`;
            ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(z.id, ox + z.col * tile + 4, oy + z.row * tile + 4);
        }
        if (this.zoneStart && this.app.tool === 'zone') {
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(ox + this.zoneStart.col * tile, oy + this.zoneStart.row * tile, tile, tile);
        }
        ctx.restore();
    }

    _drawHazard(ctx, room, h, ox, oy, tile) {
        const ready = (img) => img?.complete && img.naturalWidth;
        if (h.type === 'arrow') { this._drawArrowTrap(ctx, room, h, ox, oy, tile); return; }
        if (h.type === 'button') {
            const img = this.assets.get('button');
            if (ready(img)) ctx.drawImage(img, 0, 0, 16, 16, ox + h.col * tile, oy + h.row * tile, tile, tile);
            return;
        }
        // Espinho único e fileira: mesmo sprite do editor 1.0, um por tile ocupado.
        const cells = occupiedCells(h), img = this.assets.get('peaks2');
        for (const p of cells) if (ready(img)) ctx.drawImage(img, ox + p.col * tile, oy + p.row * tile, tile, tile);
        if (h.type === 'spikeRow') this._drawWaveArrow(ctx, h, cells, ox, oy, tile);
    }

    // Seta laranja sobre a fileira, no sentido em que a onda de espinhos anda (igual ao editor 1.0).
    _drawWaveArrow(ctx, h, cells, ox, oy, tile) {
        const dir = h.dir || 'left';
        const [dx, dy] = ({ right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] })[dir] || [-1, 0];
        const forward = dir === 'right' || dir === 'down';
        const a = forward ? cells[0] : cells[cells.length - 1], b = forward ? cells[cells.length - 1] : cells[0];
        const off = tile * 0.3, head = tile * 0.18;
        const sx = ox + (a.col + 0.5) * tile - dx * off, sy = oy + (a.row + 0.5) * tile - dy * off;
        const ex = ox + (b.col + 0.5) * tile + dx * off, ey = oy + (b.row + 0.5) * tile + dy * off;
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 137, 6, 0.95)'; ctx.lineWidth = Math.max(2, tile * 0.05); ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sx, sy); ctx.lineTo(ex, ey);
        ctx.moveTo(ex, ey); ctx.lineTo(ex - dx * head - dy * head, ey - dy * head + dx * head);
        ctx.moveTo(ex, ey); ctx.lineTo(ex - dx * head + dy * head, ey - dy * head - dx * head);
        ctx.stroke();
        ctx.restore();
    }

    // Lançador de flechas como no jogo: sprite girado para a direção do disparo e deslocado sobre o tijolo da parede.
    _drawArrowTrap(ctx, room, h, ox, oy, tile) {
        const interior = h.col > 0 && h.row > 0 && h.col < room.cols - 1 && h.row < room.rows - 1;
        const dir = arrowFireDir(h.side, interior) || { x: 0, y: 1 };
        const k = tile / TILE, off = arrowMountOffset(dir);
        const cx = ox + (h.col + 0.5) * tile + off.x * k, cy = oy + (h.row + 0.5) * tile + off.y * k;
        const sprite = this.assets.get('arrowTrap2');
        if (sprite?.complete && sprite.naturalWidth) {
            const w = HAZARDS.arrowTrap.indicatorSize * 1.6 * k, height = w * sprite.naturalHeight / sprite.naturalWidth;
            ctx.save();
            ctx.translate(cx, cy); ctx.rotate(Math.atan2(dir.y, dir.x) - Math.PI / 2);
            ctx.drawImage(sprite, -w / 2, -height / 2, w, height);
            ctx.restore();
        }
        // Guia laranja do sentido do disparo (como no editor 1.0).
        const length = tile * 0.4, head = tile * 0.12, ex = cx + dir.x * length, ey = cy + dir.y * length;
        ctx.save();
        ctx.strokeStyle = '#ff8906'; ctx.lineWidth = Math.max(2, tile * 0.04); ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx, cy); ctx.lineTo(ex, ey);
        ctx.moveTo(ex, ey); ctx.lineTo(ex - dir.x * head - dir.y * head, ey - dir.y * head + dir.x * head);
        ctx.moveTo(ex, ey); ctx.lineTo(ex - dir.x * head + dir.y * head, ey - dir.y * head - dir.x * head);
        ctx.stroke();
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
        const sawStart = $('test-sawstart').value;
        if (sawStart) progress.saw = sawStart === 'yes';
        sessionStorage.setItem(DEMO.sessionKey, JSON.stringify({ map, isolated, progress, camera: $('test-camera').value, infiniteLives: $('test-infinite-lives').checked,
            repeatArautoIntro: $('test-arauto-intro').checked }));
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
