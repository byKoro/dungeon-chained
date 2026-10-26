export function sideOf(room, door) {
    if (door.row === 0) return 'N';
    if (door.row === room.rows - 1) return 'S';
    if (door.col === 0) return 'W';
    if (door.col === room.cols - 1) return 'E';
    return null;
}

export function doorCells(room, door) {
    const horizontal = ['N', 'S'].includes(sideOf(room, door));
    return Array.from({ length: door.width || 1 }, (_, i) => ({
        col: door.col + (horizontal ? i : 0), row: door.row + (horizontal ? 0 : i)
    }));
}

export function identifyDoors(map) {
    for (const room of Object.values(map.rooms)) {
        for (const [i, door] of room.doors.entries()) {
            if (!door.id) door.id = `door_${i}_${door.col}_${door.row}`;
        }
    }
    return map;
}

export function endpointDoor(map, endpoint) {
    return map.rooms[endpoint?.room]?.doors.find(d => d.id === endpoint.door) || null;
}

export function sameEndpoint(a, b) {
    return a?.room === b?.room && a?.door === b?.door;
}

export function connectDoors(map, from, to, { oneWay = false, requires = '' } = {}) {
    identifyDoors(map);
    if (from.room === to.room || !endpointDoor(map, from) || !endpointDoor(map, to)) return false;
    const occupied = (map.connections || []).some(c => [c.from, c.to].some(e => sameEndpoint(e, from) || sameEndpoint(e, to)));
    if (occupied) return false;
    map.connections ??= [];
    map.connections.push({ from: { ...from }, to: { ...to }, oneWay: !!oneWay, requires });
    return true;
}

export function outgoingConnections(map, key) {
    const out = [];
    for (const c of map.connections || []) {
        if (c.from.room === key) out.push({ ...c, source: c.from, target: c.to });
        if (c.to.room === key && !c.oneWay) out.push({ ...c, source: c.to, target: c.from });
    }
    return out;
}

export function safeSpawnPair(room, door = null) {
    const valid = (p) => p && Number.isInteger(p.col) && Number.isInteger(p.row)
        && p.col > 0 && p.row > 0 && p.col < room.cols - 1 && p.row < room.rows - 1
        && room.kinds[p.row]?.[p.col] === 'f'
        && !(room.hazards || []).some(h => h.col === p.col && h.row === p.row && h.type !== 'button');
    if (!door && room.spawns) {
        const { p1, p2 } = room.spawns;
        if (valid(p1) && valid(p2) && (p1.col !== p2.col || p1.row !== p2.row)) return structuredClone(room.spawns);
        return null;
    }
    const side = door && sideOf(room, door);
    const candidates = [];
    const cx = door ? door.col + (['N', 'S'].includes(side) ? ((door.width || 1) - 1) / 2 : 0) : room.cols / 2;
    const cy = door ? door.row + (['E', 'W'].includes(side) ? ((door.width || 1) - 1) / 2 : 0) : room.rows / 2;
    for (let row = 1; row < room.rows - 1; row++) {
        for (let col = 1; col < room.cols - 1; col++) {
            const p = { col, row };
            if (valid(p) && (!door || Math.abs(col - cx) + Math.abs(row - cy) <= 3)) candidates.push(p);
        }
    }
    candidates.sort((a, b) => Math.hypot(a.col - cx, a.row - cy) - Math.hypot(b.col - cx, b.row - cy));
    for (const p1 of candidates) {
        const p2 = candidates.find(p => Math.abs(p.col - p1.col) + Math.abs(p.row - p1.row) === 1);
        if (p2) return { p1, p2 };
    }
    return null;
}

export function validatePlayable(map, { roomKey = null } = {}) {
    const errors = [];
    const keys = roomKey ? [roomKey] : Object.keys(map.rooms);
    if (!roomKey && !map.rooms[map.start]) errors.push('Marque a sala inicial.');
    for (const key of keys) {
        const room = map.rooms[key];
        if (!room) { errors.push(`Sala ${key} inexistente.`); continue; }
        if (!safeSpawnPair(room)) errors.push(`${room.name}: configure dois spawns em chão seguro.`);
        if (room.lock === 'buttons' && (room.hazards || []).filter(h => h.type === 'button').length !== 2) errors.push(`${room.name}: a trava co-op precisa de dois botões.`);
        const occupied = new Set();
        const ids = new Set();
        for (const d of room.doors) {
            const side = sideOf(room, d);
            if (!side || !Number.isInteger(d.width || 1) || (d.width || 1) < 1) { errors.push(`${room.name}: porta inválida.`); continue; }
            if (ids.has(d.id)) errors.push(`${room.name}: identificador de porta duplicado.`);
            ids.add(d.id);
            if (d.type === 'boss' && (side !== 'N' || d.width !== 2)) errors.push(`${room.name}: portão do boss exige parede norte e largura 2.`);
            for (const p of doorCells(room, d)) {
                const k = `${p.col},${p.row}`;
                const corner = (p.col === 0 || p.col === room.cols - 1) && (p.row === 0 || p.row === room.rows - 1);
                if (corner || room.kinds[p.row]?.[p.col] !== 'f' || occupied.has(k)) errors.push(`${room.name}: passagem inválida em ${k}.`);
                occupied.add(k);
            }
            if (!safeSpawnPair(room, d)) errors.push(`${room.name}: entrada sem espaço seguro para a dupla.`);
            if (!roomKey && !(map.connections || []).some(c => [c.from, c.to].some(e => e.room === key && e.door === d.id))) errors.push(`${room.name}: porta ${d.id} sem conexão.`);
        }
    }
    const ends = new Set();
    for (const c of roomKey ? [] : map.connections || []) {
        if (!['', 'dash', 'sawThrow', 'bossKey'].includes(c.requires || '')) errors.push('Conexão com requisito desconhecido.');
        for (const e of [c.from, c.to]) {
            if (!endpointDoor(map, e)) errors.push('Conexão aponta para uma porta inexistente.');
            const key = `${e?.room}/${e?.door}`;
            if (ends.has(key)) errors.push('Uma porta possui mais de um destino.');
            ends.add(key);
        }
    }
    return [...new Set(errors)];
}
