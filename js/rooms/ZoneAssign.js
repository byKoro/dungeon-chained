// Atribui cada objeto autorado (inimigo solto, estaca de corda) a UMA zona só, mesmo quando as zonas se
// sobrepõem. Dono = a menor zona (por área) que contém o objeto; empate de área fica com a primeira na ordem
// do mapa. Assim "combate" (menor) fica com os objetos da arena e "zona" (maior) só com o que sobra, sem
// duplicar spawns/encontros quando as duas zonas cobrem a mesma área.

const contains = (z, o) => o.col >= z.col && o.row >= z.row && o.col < z.col + z.w && o.row < z.row + z.h;
const area = z => z.w * z.h;

// Zona dona do objeto (menor área que o contém), ou null se nenhuma o contém.
export function ownerZone(zones, o) {
    let best = null;
    for (const z of zones) {
        if (!contains(z, o)) continue;
        if (!best || area(z) < area(best)) best = z;
    }
    return best;
}

// Objetos (de `objects`) cuja zona dona é `zoneId`. `zones` = todas as zonas do mapa (para resolver a sobreposição).
export function objectsOwnedByZone(zones, objects, zoneId) {
    return (objects || []).filter(o => ownerZone(zones, o)?.id === zoneId);
}
