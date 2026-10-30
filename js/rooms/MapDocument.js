import { identifyDoors, outgoingConnections, sideOf, doorCells } from './MapConnections.js';
import { randomizeFloor, placeDoor } from './MapContent.js';
// Modelo puro do mapa do editor 2.0 (sem DOM): salas num grid, tiles com atributo, portas por tile e props.
import { RoomTiles } from '../core/RoomTiles.js';
import { ROOM_COLS, ROOM_ROWS } from '../config/GameConfig.js';
import {
    MAP_FORMAT, MAP_VERSION, MAP_LIMITS, MAP_DEFAULTS, TILE_KIND, TILE_KINDS,
    HOLE_INDEX, VOID_INDEX, FLOOR_INDEX, WALL_TILE_INDICES, DOOR_TYPES, DEFAULT_DOOR_TYPE
} from '../config/MapEditorConfig.js';
import { ANIMATED_PROPS } from '../config/PropConfig.js';

const { FLOOR, WALL, HOLE, VOID } = TILE_KIND;
const WALL_SET = new Set(WALL_TILE_INDICES);
const SIDES = ["N", "E", "S", "W"];
const OPPOSITE = { N: "S", S: "N", E: "W", W: "E" };
const STEP = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };

function clampInt(value, lo, hi) {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) return lo;
    return Math.max(lo, Math.min(hi, n));
}

export function cellKey(gx, gy) {
    return `${gx},${gy}`;
}

export function parseKey(key) {
    const [gx, gy] = String(key).split(",").map(Number);
    return { gx, gy };
}

export function inBounds(room, c, r) {
    return c >= 0 && r >= 0 && c < room.cols && r < room.rows;
}

export function isBorder(cols, rows, c, r) {
    return c === 0 || r === 0 || c === cols - 1 || r === rows - 1;
}

function isFrame(cols, rows, c, r) {
    return c <= 1 || r <= 1 || c >= cols - 2 || r >= rows - 2;
}

const frameCache = new Map();
function frameTiles(cols, rows) {
    const key = `${cols},${rows}`;
    if (!frameCache.has(key)) frameCache.set(key, new RoomTiles(cols, rows, {}, 0, true).floor);
    return frameCache.get(key);
}

export function defaultKindForTile(index) {
    if (index === HOLE_INDEX) return HOLE;
    if (index === VOID_INDEX) return VOID;
    return WALL_SET.has(index) ? WALL : FLOOR;
}

export function wallSideForTile(tile) {
    const id = Number(tile);
    if ((id >= 1 && id <= 4) || (id >= 50 && id <= 55)) return "top";
    if ([5, 15, 25, 35, 45].includes(id)) return "left";
    if ([0, 10, 20, 30, 40].includes(id)) return "right";
    if (id >= 41 && id <= 44) return "bottom";
    return "top";
}

function setKindChar(room, c, r, kind) {
    const line = room.kinds[r];
    room.kinds[r] = line.slice(0, c) + kind + line.slice(c + 1);
}

export function getKind(room, c, r) {
    return inBounds(room, c, r) ? room.kinds[r][c] : null;
}

export function getTile(room, c, r) {
    return inBounds(room, c, r) ? room.tiles[r][c] : null;
}

export function createRoom(cols = MAP_DEFAULTS.roomCols, rows = MAP_DEFAULTS.roomRows, opts = {}) {
    cols = clampInt(cols, MAP_LIMITS.minRoomCols, MAP_LIMITS.maxRoomCols);
    rows = clampInt(rows, MAP_LIMITS.minRoomRows, MAP_LIMITS.maxRoomRows);
    const tiles = frameTiles(cols, rows).map(line => line.slice());
    const kinds = [];
    for (let r = 0; r < rows; r++) {
        let line = "";
        for (let c = 0; c < cols; c++) line += isBorder(cols, rows, c, r) ? WALL : FLOOR;
        kinds.push(line);
    }
    const room = {
        id: opts.id || "sala",
        name: opts.name || "Sala",
        notes: opts.notes || "",
        cols,
        rows,
        tiles,
        kinds,
        doors: [],
        props: [], enemies: [], hazards: [], torches: [], interactives: [], zones: [], encounters: [], bars: [],
        spawns: null, lock: 'none', type: 'normal'
    };
    randomizeFloor(room);
    return room;
}

// Retorna true se algo mudou.
export function setCell(room, c, r, tile, kind = defaultKindForTile(tile)) {
    if (!inBounds(room, c, r) || !TILE_KINDS[kind]) return false;
    if (kind === HOLE) tile = HOLE_INDEX;
    else if (kind === VOID) tile = VOID_INDEX;
    else if (!Number.isInteger(tile) || tile < 0) tile = FLOOR_INDEX;

    let changed = room.tiles[r][c] !== tile || room.kinds[r][c] !== kind;
    room.tiles[r][c] = tile;
    setKindChar(room, c, r, kind);
    if (kind !== FLOOR && removeDoorAt(room, c, r)) changed = true;
    return changed;
}

export function setKind(room, c, r, kind) {
    if (!inBounds(room, c, r)) return false;
    return setCell(room, c, r, room.tiles[r][c], kind);
}

export function eraseCell(room, c, r) {
    if (!inBounds(room, c, r)) return false;
    const tile = frameTiles(room.cols, room.rows)[r][c];
    const kind = isBorder(room.cols, room.rows, c, r) ? WALL : FLOOR;
    let changed = setCell(room, c, r, tile, kind);
    if (removeDoorAt(room, c, r)) changed = true;
    if (removePropAt(room, c, r)) changed = true;
    return changed;
}

export function doorSide(room, c, r) {
    if (!inBounds(room, c, r)) return null;
    const lastC = room.cols - 1, lastR = room.rows - 1;
    if ((c === 0 || c === lastC) && (r === 0 || r === lastR)) return null;
    if (r === 0) return "N";
    if (r === lastR) return "S";
    if (c === 0) return "W";
    if (c === lastC) return "E";
    return null;
}

export function doorAt(room, c, r) {
    return room.doors.find(d => doorCells(room, d).some(p => p.col === c && p.row === r)) || null;
}

export function setDoor(room, c, r, type = DEFAULT_DOOR_TYPE) {
    if (!doorSide(room, c, r)) return false;
    if (!DOOR_TYPES[type]) type = DEFAULT_DOOR_TYPE;
    const existing = doorAt(room, c, r);
    if (existing) {
        if (existing.type === type) return false;
        existing.type = type;
        return true;
    }
    if (room.kinds[r][c] !== FLOOR) setCell(room, c, r, FLOOR_INDEX, FLOOR);
    let i = 0;
    while (room.doors.some(d => d.id === `door_${i}`)) i++;
    room.doors.push({ col: c, row: r, type, width: 1, id: `door_${i}` });
    return true;
}

export function removeDoorAt(room, c, r) {
    const before = room.doors.length;
    const hit = doorAt(room, c, r);
    room.doors = room.doors.filter(d => d !== hit);
    return room.doors.length !== before;
}

export function doorsBySide(room) {
    const out = { N: [], E: [], S: [], W: [] };
    for (const d of room.doors) {
        const side = doorSide(room, d.col, d.row);
        if (side) out[side].push(d);
    }
    for (const side of SIDES) out[side].sort((a, b) => (a.col - b.col) || (a.row - b.row));
    return out;
}

export function propFootprint(prop) {
    const def = ANIMATED_PROPS[prop.type];
    return { w: def ? def.w : 1, h: def ? def.h : 1 };
}

export function propAt(room, c, r) {
    return room.props.find(p => {
        const { w, h } = propFootprint(p);
        return c >= p.col && c < p.col + w && r >= p.row && r < p.row + h;
    }) || null;
}

export function canPlaceProp(room, type, c, r) {
    const def = ANIMATED_PROPS[type];
    if (!def) return false;
    if (!inBounds(room, c, r) || !inBounds(room, c + def.w - 1, r + def.h - 1)) return false;
    for (let dy = 0; dy < def.h; dy++) {
        for (let dx = 0; dx < def.w; dx++) {
            if (propAt(room, c + dx, r + dy)) return false;
        }
    }
    return true;
}

export function placeProp(room, type, c, r, flip = false, extra = null) {
    if (!canPlaceProp(room, type, c, r)) return false;
    const prop = { ...extra, type, col: c, row: r };
    if (flip) prop.flip = true;
    room.props.push(prop);
    return true;
}

export function removePropAt(room, c, r) {
    const hit = propAt(room, c, r);
    if (!hit) return false;
    room.props = room.props.filter(p => p !== hit);
    return true;
}

// Com `rebuildFrame`, a moldura (borda + anel de sombra) é refeita no tamanho novo e só o miolo é copiado.
export function resizeRoom(room, cols, rows, { rebuildFrame = true } = {}) {
    const next = createRoom(cols, rows, { id: room.id, name: room.name, notes: room.notes });
    for (let r = 0; r < Math.min(room.rows, next.rows); r++) {
        for (let c = 0; c < Math.min(room.cols, next.cols); c++) {
            if (rebuildFrame && (isFrame(room.cols, room.rows, c, r) || isFrame(next.cols, next.rows, c, r))) continue;
            next.tiles[r][c] = room.tiles[r][c];
            setKindChar(next, c, r, room.kinds[r][c]);
        }
    }

    // Portas seguem para a borda nova mantendo id (as conexões apontam para ele) e largura.
    for (const d of room.doors) {
        if (d.type === 'stairs') {
            const side = doorSide(room, d.col, d.row);
            const c = side === 'E' ? next.cols - 1 : d.col;
            const r = side === 'S' ? next.rows - 1 : d.row;
            placeDoor(next, c, r, d.type, 1, d.id);
            continue;
        }
        const side = doorSide(room, d.col, d.row);
        let c = d.col, r = d.row;
        if (side === "N") r = 0;
        else if (side === "S") r = next.rows - 1;
        else if (side === "W") c = 0;
        else if (side === "E") c = next.cols - 1;
        if (!side || doorSide(next, c, r) !== side) continue;
        placeDoor(next, c, r, d.type, d.width || 1, d.id);
    }

    const inside = (o) => o && o.col >= 0 && o.row >= 0 && o.col < next.cols && o.row < next.rows;
    const interior = (o) => o && o.col > 0 && o.row > 0 && o.col < next.cols - 1 && o.row < next.rows - 1;
    next.props = room.props.filter(p => p.col < next.cols - 1 && p.row < next.rows - 1).map(p => ({ ...p }));
    for (const field of ['enemies', 'hazards', 'torches', 'interactives', 'bars']) {
        next[field] = structuredClone((room[field] || []).filter(inside));
    }
    for (const o of next.interactives) if (o.tiles) o.tiles = o.tiles.filter(interior);
    // Zonas são retângulos: recortadas para caber; as que ficariam vazias somem.
    next.zones = (room.zones || []).map(z => {
        const col = Math.max(0, z.col), row = Math.max(0, z.row);
        const w = Math.min(z.col + z.w, next.cols) - col, h = Math.min(z.row + z.h, next.rows) - row;
        return { ...z, col, row, w, h };
    }).filter(z => z.w > 0 && z.h > 0);
    next.encounters = structuredClone(room.encounters || []);
    next.spawns = room.spawns && interior(room.spawns.p1) && interior(room.spawns.p2) ? structuredClone(room.spawns) : null;
    next.lock = room.lock || 'none';
    if (room.floorPool) next.floorPool = room.floorPool;
    if (room.propDensity !== undefined) next.propDensity = room.propDensity;
    next.type = room.type || 'normal';
    return next;
}

// Volta a sala à moldura padrão mantendo só tamanho, id, nome e notas. Remove as conexões das portas dela.
export function resetRoom(map, key) {
    const room = map.rooms[key];
    if (!room) return false;
    const doorIds = new Set(room.doors.map(d => d.id).filter(Boolean));
    if (map.connections) {
        map.connections = map.connections.filter(c => ![c.from, c.to].some(e => e.room === key && doorIds.has(e.door)));
    }
    const fresh = createRoom(room.cols, room.rows, { id: room.id, name: room.name, notes: room.notes });
    for (const k of Object.keys(room)) delete room[k];
    Object.assign(room, fresh);
    return true;
}

export function createMap(opts = {}) {
    return {
        format: MAP_FORMAT,
        version: MAP_VERSION,
        name: opts.name || MAP_DEFAULTS.name,
        grid: {
            cols: clampInt(opts.gridCols ?? MAP_DEFAULTS.gridCols, MAP_LIMITS.minGrid, MAP_LIMITS.maxGrid),
            rows: clampInt(opts.gridRows ?? MAP_DEFAULTS.gridRows, MAP_LIMITS.minGrid, MAP_LIMITS.maxGrid)
        },
        roomSize: {
            cols: clampInt(opts.roomCols ?? MAP_DEFAULTS.roomCols, MAP_LIMITS.minRoomCols, MAP_LIMITS.maxRoomCols),
            rows: clampInt(opts.roomRows ?? MAP_DEFAULTS.roomRows, MAP_LIMITS.minRoomRows, MAP_LIMITS.maxRoomRows)
        },
        start: null,
        rooms: {}
    };
}

export function inGrid(map, gx, gy) {
    return Number.isInteger(gx) && Number.isInteger(gy) && gx >= 0 && gy >= 0 && gx < map.grid.cols && gy < map.grid.rows;
}

export function addRoom(map, gx, gy, opts = {}) {
    const key = cellKey(gx, gy);
    if (!inGrid(map, gx, gy) || map.rooms[key]) return null;
    const count = Object.keys(map.rooms).length;
    const room = createRoom(opts.cols ?? map.roomSize.cols, opts.rows ?? map.roomSize.rows, {
        id: `sala_${gx}_${gy}`,
        name: opts.name || `Sala ${count + 1}`
    });
    map.rooms[key] = room;
    if (!map.start) map.start = key;
    return room;
}

export function removeRoom(map, key) {
    if (!map.rooms[key]) return false;
    delete map.rooms[key];
    if (map.connections) map.connections = map.connections.filter(c => c.from.room !== key && c.to.room !== key);
    if (map.start === key) map.start = null;
    return true;
}

// Move a sala para outra célula; se a célula estiver ocupada, troca as duas.
export function moveRoom(map, fromKey, toKey) {
    const { gx, gy } = parseKey(toKey);
    if (fromKey === toKey || !map.rooms[fromKey] || !inGrid(map, gx, gy)) return false;
    for (const c of map.connections || []) for (const e of [c.from, c.to]) {
        if (e.room === fromKey) e.room = toKey;
        else if (e.room === toKey) e.room = fromKey;
    }
    const moving = map.rooms[fromKey];
    const other = map.rooms[toKey] || null;
    map.rooms[toKey] = moving;
    if (other) map.rooms[fromKey] = other;
    else delete map.rooms[fromKey];
    if (map.start === fromKey) map.start = toKey;
    else if (map.start === toKey && other) map.start = fromKey;
    return true;
}

export function setStart(map, key) {
    if (!map.rooms[key]) return false;
    map.start = key;
    return true;
}

// Retorna as chaves das salas removidas por ficarem fora do grid novo.
export function resizeGrid(map, cols, rows) {
    map.grid.cols = clampInt(cols, MAP_LIMITS.minGrid, MAP_LIMITS.maxGrid);
    map.grid.rows = clampInt(rows, MAP_LIMITS.minGrid, MAP_LIMITS.maxGrid);
    const removed = [];
    for (const key of Object.keys(map.rooms)) {
        const { gx, gy } = parseKey(key);
        if (!inGrid(map, gx, gy)) {
            removeRoom(map, key);
            removed.push(key);
        }
    }
    return removed;
}

export function roomsOutsideGrid(map, cols, rows) {
    return Object.keys(map.rooms).filter(key => {
        const { gx, gy } = parseKey(key);
        return gx >= cols || gy >= rows;
    });
}

// status: "ok" (as duas salas têm porta no lado que se encontra), "one-way" (o vizinho não tem porta de volta), "no-room".
export function roomLinks(map) {
    if (map.connections) return Object.keys(map.rooms).flatMap(key => outgoingConnections(map, key).map(c => {
        const door = map.rooms[key].doors.find(d => d.id === c.source.door);
        return { from: key, to: c.target.room, side: door ? sideOf(map.rooms[key], door) : 'N', status: map.rooms[c.target.room] && door ? 'ok' : 'no-room', doors: door ? [door] : [], connection: c };
    }));
    const links = [];
    for (const [key, room] of Object.entries(map.rooms)) {
        const { gx, gy } = parseKey(key);
        const sides = doorsBySide(room);
        for (const side of SIDES) {
            if (!sides[side].length) continue;
            const [dx, dy] = STEP[side];
            const to = cellKey(gx + dx, gy + dy);
            const neighbour = map.rooms[to];
            let status = "ok";
            if (!neighbour) status = "no-room";
            else if (!doorsBySide(neighbour)[OPPOSITE[side]].length) status = "one-way";
            links.push({ from: key, to, side, status, doors: sides[side] });
        }
    }
    return links;
}

// Ordem de descoberta (0 = início) seguindo só ligações "ok".
export function sequenceOrder(map) {
    const order = new Map();
    if (!map.start || !map.rooms[map.start]) return order;
    const edges = new Map();
    for (const link of roomLinks(map)) {
        if (link.status !== "ok") continue;
        if (!edges.has(link.from)) edges.set(link.from, []);
        edges.get(link.from).push(link.to);
    }
    const queue = [map.start];
    order.set(map.start, 0);
    while (queue.length) {
        const key = queue.shift();
        for (const next of edges.get(key) || []) {
            if (order.has(next)) continue;
            order.set(next, order.size);
            queue.push(next);
        }
    }
    return order;
}

export function roomLabel(map, key) {
    const room = map.rooms[key];
    return room ? `"${room.name}" (${key})` : `(${key})`;
}

export function validateMap(map) {
    const errors = [];
    const warnings = [];
    const keys = Object.keys(map.rooms);

    if (!keys.length) warnings.push("O mapa ainda não tem salas.");
    if (!map.start) {
        if (keys.length) warnings.push("Nenhuma sala marcada como início.");
    } else if (!map.rooms[map.start]) {
        errors.push(`A sala de início ${map.start} não existe.`);
    }

    for (const key of keys) {
        const room = map.rooms[key];
        const label = roomLabel(map, key);
        const { gx, gy } = parseKey(key);
        if (!inGrid(map, gx, gy)) errors.push(`${label} está fora do grid.`);

        if (!Array.isArray(room.tiles) || room.tiles.length !== room.rows || room.tiles.some(l => !Array.isArray(l) || l.length !== room.cols)) {
            errors.push(`${label}: tiles não batem com o tamanho ${room.cols}×${room.rows}.`);
            continue;
        }
        if (!Array.isArray(room.kinds) || room.kinds.length !== room.rows || room.kinds.some(l => typeof l !== "string" || l.length !== room.cols)) {
            errors.push(`${label}: atributos (kinds) não batem com o tamanho da sala.`);
            continue;
        }

        let badKind = 0, mismatch = 0;
        for (let r = 0; r < room.rows; r++) {
            for (let c = 0; c < room.cols; c++) {
                const k = room.kinds[r][c];
                const t = room.tiles[r][c];
                if (!TILE_KINDS[k]) { badKind++; continue; }
                if ((k === HOLE) !== (t === HOLE_INDEX) || (k === VOID) !== (t === VOID_INDEX) || !Number.isInteger(t)) mismatch++;
            }
        }
        if (badKind) errors.push(`${label}: ${badKind} tile(s) com atributo desconhecido.`);
        if (mismatch) errors.push(`${label}: ${mismatch} tile(s) com índice incompatível com o atributo.`);

        const seenDoors = new Set();
        for (const d of room.doors) {
            const k = `${d.col},${d.row}`;
            if (!inBounds(room, d.col, d.row)) { errors.push(`${label}: passagem fora da sala em ${k}.`); continue; }
            if (d.type !== 'stairs' && !doorSide(room, d.col, d.row)) errors.push(`${label}: porta em ${k} não está na borda (ou está num canto).`);
            else if (room.kinds[d.row][d.col] !== FLOOR) errors.push(`${label}: porta em ${k} sobre tile que não é piso.`);
            if (!DOOR_TYPES[d.type]) errors.push(`${label}: porta em ${k} com tipo desconhecido "${d.type}".`);
            if (seenDoors.has(k)) errors.push(`${label}: porta duplicada em ${k}.`);
            seenDoors.add(k);
        }
        if (!room.doors.length) warnings.push(`${label} não tem portas.`);

        const occupied = new Set();
        for (const p of room.props) {
            const def = Number.isInteger(p.index) ? { w: 1, h: 1, label: 'Decoração' } : ANIMATED_PROPS[p.type];
            if (!def) { errors.push(`${label}: prop desconhecido "${p.type}".`); continue; }
            for (let dy = 0; dy < def.h; dy++) {
                for (let dx = 0; dx < def.w; dx++) {
                    const c = p.col + dx, r = p.row + dy;
                    const k = `${c},${r}`;
                    if (!inBounds(room, c, r)) { errors.push(`${label}: prop "${def.label}" sai da sala.`); continue; }
                    if (occupied.has(k)) errors.push(`${label}: props sobrepostos em ${k}.`);
                    occupied.add(k);
                    const kind = room.kinds[r][c];
                    if (kind === HOLE || kind === VOID) warnings.push(`${label}: prop "${def.label}" sobre ${TILE_KINDS[kind].label.toLowerCase()} em ${k}.`);
                }
            }
        }
    }

    const sideName = { N: "norte", S: "sul", E: "leste", W: "oeste" };
    for (const link of roomLinks(map)) {
        if (link.status === "no-room") warnings.push(`Porta ${sideName[link.side]} de ${roomLabel(map, link.from)} leva a uma célula sem sala.`);
        else if (link.status === "one-way") warnings.push(`Porta ${sideName[link.side]} de ${roomLabel(map, link.from)} não tem porta de volta em ${roomLabel(map, link.to)}.`);
    }

    if (map.start && map.rooms[map.start]) {
        const order = sequenceOrder(map);
        const unreachable = keys.filter(k => !order.has(k));
        if (unreachable.length) warnings.push(`${unreachable.length} sala(s) não alcançáveis a partir do início: ${unreachable.map(k => roomLabel(map, k)).join(", ")}.`);
    }

    return { errors, warnings };
}

function normalizeRoom(raw, key) {
    if (!raw || typeof raw !== "object") throw new Error(`sala ${key} inválida`);
    const cols = clampInt(raw.cols, MAP_LIMITS.minRoomCols, MAP_LIMITS.maxRoomCols);
    const rows = clampInt(raw.rows, MAP_LIMITS.minRoomRows, MAP_LIMITS.maxRoomRows);
    if (cols !== raw.cols || rows !== raw.rows) throw new Error(`sala ${key}: tamanho ${raw.cols}×${raw.rows} fora dos limites`);
    if (!Array.isArray(raw.tiles) || raw.tiles.length !== rows || raw.tiles.some(l => !Array.isArray(l) || l.length !== cols)) {
        throw new Error(`sala ${key}: matriz de tiles inválida`);
    }
    const tiles = raw.tiles.map(l => l.map(Number));
    let kinds;
    if (Array.isArray(raw.kinds) && raw.kinds.length === rows && raw.kinds.every(l => typeof l === "string" && l.length === cols)) {
        kinds = raw.kinds.slice();
    } else {
        kinds = tiles.map(l => l.map(defaultKindForTile).join(""));
    }
    return {
        id: String(raw.id || `sala_${key.replace(",", "_")}`),
        name: String(raw.name || "Sala"),
        notes: String(raw.notes || ""),
        cols,
        rows,
        tiles,
        kinds,
        doors: (Array.isArray(raw.doors) ? raw.doors : [])
            .filter(d => d && Number.isInteger(d.col) && Number.isInteger(d.row))
            .map(d => ({ ...d, col: d.col, row: d.row, type: DOOR_TYPES[d.type] ? d.type : DEFAULT_DOOR_TYPE })),
        props: (Array.isArray(raw.props) ? raw.props : [])
            .filter(p => p && (typeof p.type === "string" || Number.isInteger(p.index)) && Number.isInteger(p.col) && Number.isInteger(p.row))
            .map(p => ({ ...p })),
        enemies: structuredClone(raw.enemies || []), hazards: structuredClone(raw.hazards || []),
        torches: structuredClone(raw.torches || []), interactives: structuredClone(raw.interactives || []),
        zones: structuredClone(raw.zones || []), encounters: structuredClone(raw.encounters || []), bars: structuredClone(raw.bars || []),
        spawns: structuredClone(raw.spawns || null), lock: raw.lock || 'none', type: raw.type || 'normal',
        ...(Array.isArray(raw.floorPool) ? { floorPool: raw.floorPool.filter(Number.isInteger) } : {}),
        ...(Number.isFinite(raw.propDensity) ? { propDensity: raw.propDensity } : {})
    };
}

// Lê um JSON importado (do servidor, arquivo ou localStorage). Lança Error com mensagem em pt-BR se o formato não servir.
export function normalizeMap(raw) {
    if (!raw || typeof raw !== "object") throw new Error("o arquivo não é um objeto JSON");
    if (raw.format !== MAP_FORMAT) throw new Error(`formato desconhecido (esperado "${MAP_FORMAT}")`);
    if (raw.version !== MAP_VERSION) throw new Error(`versão ${raw.version} não suportada (esperado ${MAP_VERSION})`);
    const map = createMap({
        name: raw.name,
        gridCols: raw.grid?.cols,
        gridRows: raw.grid?.rows,
        roomCols: raw.roomSize?.cols,
        roomRows: raw.roomSize?.rows
    });
    for (const [key, room] of Object.entries(raw.rooms || {})) {
        if (!/^\d+,\d+$/.test(key)) throw new Error(`chave de sala inválida "${key}"`);
        map.rooms[key] = normalizeRoom(room, key);
    }
    if (raw.connections) map.connections = structuredClone(raw.connections);
    identifyDoors(map);
    map.start = raw.start && map.rooms[raw.start] ? raw.start : null;
    return map;
}

export function serializeMap(map) {
    return JSON.parse(JSON.stringify(map));
}

const isScalar = (v) => v === null || typeof v !== "object";

// JSON legível no git: cada linha de tiles numa linha, `kinds` como desenho da sala, objetos simples numa linha só.
// Mesmas regras do _pretty() do serve.py.
export function formatMapJson(value, indent = "") {
    const next = indent + "  ";
    if (Array.isArray(value)) {
        if (!value.length) return "[]";
        const strings = value.every(v => typeof v === "string");
        if (value.every(isScalar) && !(strings && value.length > 1)) return `[${value.map(v => JSON.stringify(v)).join(", ")}]`;
        return `[\n${value.map(v => next + formatMapJson(v, next)).join(",\n")}\n${indent}]`;
    }
    if (value && typeof value === "object") {
        const entries = Object.entries(value);
        if (!entries.length) return "{}";
        if (entries.every(([, v]) => isScalar(v))) {
            return `{ ${entries.map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(", ")} }`;
        }
        return `{\n${entries.map(([k, v]) => `${next}${JSON.stringify(k)}: ${formatMapJson(v, next)}`).join(",\n")}\n${indent}}`;
    }
    return JSON.stringify(value);
}

// O jogo atual só monta salas 14×9 com portas fixas no meio de cada lado.
export function legacyIssues(room) {
    const issues = [];
    if (room.cols !== ROOM_COLS || room.rows !== ROOM_ROWS) {
        issues.push(`O jogo ainda só carrega salas ${ROOM_COLS}×${ROOM_ROWS}.`);
        return issues;
    }
    const midC = (ROOM_COLS / 2) | 0, midR = (ROOM_ROWS / 2) | 0;
    const expected = {
        N: [`${midC - 1},0`, `${midC},0`],
        S: [`${midC - 1},${ROOM_ROWS - 1}`, `${midC},${ROOM_ROWS - 1}`],
        W: [`0,${midR - 1}`, `0,${midR}`],
        E: [`${ROOM_COLS - 1},${midR - 1}`, `${ROOM_COLS - 1},${midR}`]
    };
    const sides = doorsBySide(room);
    for (const side of SIDES) {
        if (!sides[side].length) continue;
        const got = sides[side].map(d => `${d.col},${d.row}`).sort().join("|");
        if (got !== expected[side].slice().sort().join("|")) {
            issues.push(`Porta ${side} fora da posição padrão: no jogo ela abre sempre nos 2 tiles do meio.`);
        }
    }
    if (room.props.length) issues.push("Props animados ainda não aparecem no jogo.");
    if (room.doors.some(d => d.type !== DEFAULT_DOOR_TYPE)) issues.push("Tipos de porta especiais ainda não existem no jogo.");
    return issues;
}

// Converte para o formato de peça do editor antigo (o que o playtest do jogo entende).
export function toLegacyPiece(room, { type = "normal" } = {}) {
    const floor = room.tiles.map(line => line.slice());
    const holes = [];
    const walls = [];
    for (let r = 0; r < room.rows; r++) {
        for (let c = 0; c < room.cols; c++) {
            const kind = room.kinds[r][c];
            if (kind === HOLE) holes.push(`${c},${r}`);
            if (kind === WALL && !isBorder(room.cols, room.rows, c, r)) {
                walls.push({ col: c, row: r, tile: floor[r][c], side: wallSideForTile(floor[r][c]) });
                floor[r][c] = FLOOR_INDEX;
            }
        }
    }
    const sides = doorsBySide(room);
    return {
        id: room.id,
        name: room.name,
        cols: room.cols,
        rows: room.rows,
        kind: "room",
        type,
        doors: { N: sides.N.length > 0, E: sides.E.length > 0, S: sides.S.length > 0, W: sides.W.length > 0 },
        holes,
        walls,
        floor,
        hazards: [],
        enemies: [],
        torches: [],
        props: [],
        scatterProps: { enabled: false, density: 0 },
        lock: "none"
    };
}

// Dois tiles de piso vizinhos o mais perto possível do centro, fora da moldura.
export function findPlaytestSpawn(room) {
    const free = (c, r) => inBounds(room, c, r) && !isBorder(room.cols, room.rows, c, r)
        && room.kinds[r][c] === FLOOR && !propAt(room, c, r);
    const cx = (room.cols - 1) / 2, cy = (room.rows - 1) / 2;
    const cells = [];
    for (let r = 1; r < room.rows - 1; r++) {
        for (let c = 1; c < room.cols - 1; c++) {
            if (free(c, r)) cells.push({ c, r, d: Math.hypot(c - cx, r - cy) });
        }
    }
    cells.sort((a, b) => a.d - b.d);
    for (const { c, r } of cells) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            if (free(c + dx, r + dy)) return { p1: { col: c, row: r }, p2: { col: c + dx, row: r + dy } };
        }
    }
    return null;
}
