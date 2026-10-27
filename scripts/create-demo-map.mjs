import { writeFileSync, mkdirSync } from 'node:fs';
import { createMap, addRoom, setCell, formatMapJson } from '../js/rooms/MapDocument.js';
import { placeDoor, randomizeFloor, scatterProps } from '../js/rooms/MapContent.js';
import { connectDoors, validatePlayable } from '../js/rooms/MapConnections.js';

const map = createMap({ name: 'Dungeon Chained — Demo', gridCols: 6, gridRows: 3 });
map.connections = [];
let seed = 26102026;
const rng = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const room = (x, y, name, cols, rows, notes) => {
    const r = addRoom(map, x, y, { name, cols, rows });
    r.notes = notes; randomizeFloor(r, [16, 17, 18, 19], rng);
    r.spawns = { p1: { col: 3, row: 3 }, p2: { col: 3, row: 4 } };
    r.torches = [
        { col: 3, row: 0, side: 'N', type: 'torch' }, { col: cols - 4, row: 0, side: 'N', type: 'torch' },
        { col: 1, row: rows - 3, side: 'W', type: 'torch' }, { col: cols - 2, row: rows - 3, side: 'E', type: 'torch' }
    ];
    return r;
};
const hub = room(1, 1, '1 · Hub', 14, 9, 'Comecem juntos. Oeste: santuário. Leste: abismo. Norte: portão da chave. Interagir: P1 E / P2 Shift direito / controle X.');
map.start = '1,1'; hub.spawns = { p1: { col: 6, row: 4 }, p2: { col: 7, row: 4 } };
hub.enemies = [{ type: 'demon', col: 4, row: 2 }, { type: 'demon', col: 10, row: 5 }]; hub.lock = 'enemies';
const dash = room(0, 1, '2 · Santuário do Dash', 11, 9, 'Ativem o altar. Arrebentem o cabo afastando-se; depois usem Espaço / Enter / controle A para cruzar o buraco.');
dash.interactives = [{ type: 'altarDash', id: 'altar_dash', col: 4, row: 4 }];
dash.enemies = [{ type: 'assassin', col: 7, row: 5 }]; dash.lock = 'enemies';
for (let row = 2; row <= 5; row++) setCell(dash, 6, row, -1, 'h');
const abyss = room(2, 1, '3 · Abismo', 20, 11, 'Sem Dash, procurem o santuário. Atravessem com o cabo rompido e acionem a alavanca para recuperar a serra pela ponte.');
abyss.spawns = { p1: { col: 4, row: 5 }, p2: { col: 4, row: 6 } };
for (let row = 1; row < abyss.rows - 1; row++) setCell(abyss, 9, row, -1, 'h');
abyss.interactives = [{ type: 'lever', id: 'bridge_abyss', col: 12, row: 5, tiles: [{ col: 9, row: 5 }, { col: 9, row: 6 }] }];
const arena = room(3, 1, '4 · Arena', 18, 13, 'Usem o Dash com o cabo rompido para escapar do tanque e das flechas de fogo.');
arena.enemies = [{ type: 'tank', col: 9, row: 6 }, { type: 'assassin', col: 12, row: 8 }, { type: 'fireSkull', col: 13, row: 3 }]; arena.lock = 'enemies';
for (const [col, row] of [[5, 4], [5, 5], [11, 8], [11, 9]]) setCell(arena, col, row, 52, 'w');
const saw = room(4, 1, '5 · Lançar Serra', 16, 11, 'Ativem o altar. Movam-se na direção do alvo e rompam o cabo para lançar a serra. Ela ricocheteia nas paredes.');
saw.interactives = [{ type: 'altarSaw', id: 'altar_saw', col: 6, row: 5 }];
saw.enemies = [{ type: 'tank', col: 11, row: 7 }, { type: 'fireSkull', col: 12, row: 3 }]; saw.lock = 'enemies';
for (const [col, row] of [[9, 4], [9, 5], [9, 6]]) setCell(saw, col, row, 52, 'w');
const key = room(4, 2, '6 · Sala da Chave', 18, 11, 'A chave só cai quando a serra lançada corta a corda. Coletem-na e usem a saída sul: atalho de mão única para o Hub.');
key.interactives = [{ type: 'ropeKey', id: 'boss_key', col: 12, row: 5 }];
key.enemies = [{ type: 'demon', col: 5, row: 8 }];
key.props = [{ type: 'flag', col: 10, row: 3 }, { type: 'key_2', col: 15, row: 8 }];
const boss = room(1, 0, '7 · Caveira de Fogo', 22, 14, 'O boss se teleporta, invoca inimigos e avisa antes do laser. Derrotem todos para concluir a demo.');
boss.type = 'boss'; boss.lock = 'enemies';
boss.enemies = [{ type: 'fireSkullBoss', col: 14, row: 6 }];

function link(fromKey, fromCell, toKey, toCell, options = {}) {
    const from = map.rooms[fromKey], to = map.rooms[toKey];
    if (!placeDoor(from, ...fromCell, options.boss ? 'boss' : 'normal', 2) || !placeDoor(to, ...toCell, 'normal', 2)) throw new Error('Porta da demo inválida');
    if (!connectDoors(map, { room: fromKey, door: from.doors.at(-1).id }, { room: toKey, door: to.doors.at(-1).id }, options)) throw new Error('Conexão da demo inválida');
}
link('1,1', [0, 3], '0,1', [10, 3]);
link('1,1', [13, 3], '2,1', [0, 4]);
link('2,1', [19, 4], '3,1', [0, 5]);
link('3,1', [17, 5], '4,1', [0, 4]);
link('4,1', [7, 10], '4,2', [7, 0]);
link('4,2', [7, 10], '1,1', [6, 8], { oneWay: true, requires: 'bossKey' });
link('1,1', [6, 0], '1,0', [0, 5], { boss: true, requires: 'bossKey' });
for (const r of Object.values(map.rooms)) scatterProps(r, 0.06, rng);
const errors = validatePlayable(map);
if (errors.length) throw new Error(errors.join('\n'));
mkdirSync(new URL('../map/demo/', import.meta.url), { recursive: true });
writeFileSync(new URL('../map/demo/demo_campaign.json', import.meta.url), formatMapJson(map) + '\n');
writeFileSync(new URL('../map/demo/active.json', import.meta.url), '{ "file": "demo_campaign.json" }\n');
console.log('Demo de sete salas criada e validada.');
