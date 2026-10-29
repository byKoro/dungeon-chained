// Dados de eventos das salas do Editor 2.0: zonas (retângulos com id), encontros (levas) e grades (tiles).

// Texto do editor: uma linha por leva, "tipo:quantidade" separados por vírgula. Ex.: "bloodMonster:1, demon:3".
export function parseWaves(text) {
    return String(text || "").split(/\r?\n/).map(line => line.split(",").map(part => {
        const [type, n] = part.split(":").map(s => s.trim());
        const count = n === undefined ? 1 : Math.floor(Number(n));
        return type && Number.isFinite(count) && count > 0 ? { type, count } : null;
    }).filter(Boolean)).filter(wave => wave.length);
}

export function formatWaves(waves) {
    return (waves || []).map(wave => wave.map(g => `${g.type}:${g.count}`).join(", ")).join("\n");
}

// Retângulo pelos dois cantos clicados (qualquer ordem).
export function zoneFromCorners(id, a, b) {
    const col = Math.min(a.col, b.col), row = Math.min(a.row, b.row);
    return { id, col, row, w: Math.abs(a.col - b.col) + 1, h: Math.abs(a.row - b.row) + 1 };
}

// Coloca ou troca a zona com o mesmo id.
export function setZone(room, zone) {
    room.zones = (room.zones || []).filter(z => z.id !== zone.id);
    room.zones.push(zone);
}

export function zoneContainsTile(zone, col, row) {
    return col >= zone.col && row >= zone.row && col < zone.col + zone.w && row < zone.row + zone.h;
}

export function setEncounter(room, encounter) {
    room.encounters ||= [];
    const i = room.encounters.findIndex(e => e.id === encounter.id);
    if (i >= 0) room.encounters[i] = encounter;
    else room.encounters.push(encounter);
}

export function toggleBar(room, col, row) {
    room.bars ||= [];
    const i = room.bars.findIndex(b => b.col === col && b.row === row);
    if (i >= 0) room.bars.splice(i, 1);
    else room.bars.push({ col, row });
}
