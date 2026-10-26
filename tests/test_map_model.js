/**
 * test_map_model.js — modelo de dados do editor 2.0 (js/editor2/MapModel.js).
 */

import {
    createMap, createRoom, addRoom, removeRoom, moveRoom, resizeGrid, resizeRoom,
    setCell, setKind, eraseCell, setDoor, doorSide, doorAt, placeProp, propAt, removePropAt,
    roomLinks, sequenceOrder, validateMap, normalizeMap, serializeMap, formatMapJson,
    toLegacyPiece, legacyIssues, findPlaytestSpawn, defaultKindForTile
} from '../js/editor2/MapModel.js';
import { ROOM_COLS, ROOM_ROWS } from '../js/config/GameConfig.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`✅ PASSOU: ${message}`);
        passed++;
    } else {
        console.error(`❌ FALHOU: ${message}`);
        failed++;
    }
}

// Sala nova: moldura de parede, miolo de piso
{
    const room = createRoom(14, 9);
    assert(room.tiles.length === 9 && room.tiles[0].length === 14, "createRoom gera 14x9");
    assert(room.kinds[0] === "w".repeat(14), "borda superior é parede");
    assert(room.kinds[4][0] === "w" && room.kinds[4][13] === "w", "bordas laterais são parede");
    assert(room.kinds[4][5] === "f" && room.tiles[4][5] === 16, "miolo é piso 16");
    assert(createRoom(1, 1).cols === 5, "tamanho mínimo é respeitado");
}

// Atributos dos tiles
{
    const room = createRoom(10, 7);
    setCell(room, 3, 3, 77, "h");
    assert(room.tiles[3][3] === -1 && room.kinds[3][3] === "h", "buraco força índice -1");
    setCell(room, 4, 3, 77, "v");
    assert(room.tiles[3][4] === -2 && room.kinds[3][4] === "v", "vazio força índice -2");
    setCell(room, 5, 3, 52, "w");
    assert(room.tiles[3][5] === 52 && room.kinds[3][5] === "w", "parede guarda o visual escolhido");
    setKind(room, 5, 3, "f");
    assert(room.tiles[3][5] === 52 && room.kinds[3][5] === "f", "trocar colisão mantém o visual");
    setKind(room, 3, 3, "f");
    assert(room.tiles[3][3] === 16, "buraco virando piso recebe o piso padrão");
    assert(defaultKindForTile(2) === "w" && defaultKindForTile(16) === "f", "modo automático: 2 é parede, 16 é piso");
    eraseCell(room, 5, 3);
    assert(room.tiles[3][5] === 16 && room.kinds[3][5] === "f", "borracha volta ao piso no miolo");
}

// Portas
{
    const room = createRoom(14, 9);
    assert(doorSide(room, 0, 0) === null, "canto não aceita porta");
    assert(doorSide(room, 5, 5) === null, "miolo não aceita porta");
    assert(setDoor(room, 6, 0), "porta norte criada");
    assert(room.kinds[0][6] === "f" && room.tiles[0][6] === 16, "porta abre o tile da borda");
    assert(setDoor(room, 6, 0, "boss") && doorAt(room, 6, 0).type === "boss", "troca o tipo da porta");
    setCell(room, 6, 0, 2, "w");
    assert(!doorAt(room, 6, 0), "pintar parede em cima remove a porta");
}

// Props com footprint
{
    const room = createRoom(14, 9);
    assert(placeProp(room, "flamethrower_h", 3, 3), "lança-chamas 2x1 colocado");
    assert(propAt(room, 4, 3) !== null, "footprint ocupa o segundo tile");
    assert(!placeProp(room, "coin", 4, 3), "não sobrepõe props");
    assert(!placeProp(room, "flamethrower_v", 5, 8), "não sai da sala");
    assert(!placeProp(room, "nao_existe", 6, 6), "tipo desconhecido é recusado");
    assert(removePropAt(room, 4, 3) && room.props.length === 0, "remove pelo tile do footprint");
}

// Redimensionar sala
{
    const room = createRoom(14, 9);
    setCell(room, 5, 4, 77, "h");
    setDoor(room, 6, 0);
    setDoor(room, 13, 4);
    placeProp(room, "chest", 3, 3);
    const big = resizeRoom(room, 20, 12);
    assert(big.cols === 20 && big.rows === 12 && big.tiles[11].length === 20, "sala cresce para 20x12");
    assert(big.kinds[4][5] === "h", "miolo é preservado");
    assert(big.kinds[0][19] === "w" && big.kinds[11][10] === "w", "moldura refeita no tamanho novo");
    assert(doorAt(big, 6, 0) && doorAt(big, 19, 4), "portas seguem para a borda nova");
    assert(big.props.length === 1, "props são mantidos");
    const small = resizeRoom(room, 6, 5);
    assert(!doorAt(small, 6, 0), "porta fora da sala menor é descartada");
}

// Grid, ligações e ordem
{
    const map = createMap({ gridCols: 3, gridRows: 2 });
    const a = addRoom(map, 0, 0);
    const b = addRoom(map, 1, 0);
    assert(map.start === "0,0", "primeira sala vira o início");
    assert(addRoom(map, 0, 0) === null && addRoom(map, 5, 5) === null, "não duplica nem cria fora do grid");
    setDoor(a, 13, 4);
    assert(roomLinks(map)[0].status === "one-way", "porta sem volta é one-way");
    setDoor(b, 0, 4);
    assert(roomLinks(map).every(l => l.status === "ok"), "porta com volta é ok");
    assert(sequenceOrder(map).get("1,0") === 1, "ordem segue as ligações");
    assert(validateMap(map).errors.length === 0, "mapa válido sem erros");

    moveRoom(map, "0,0", "1,0");
    assert(map.rooms["1,0"] === a && map.rooms["0,0"] === b && map.start === "1,0", "mover para célula ocupada troca as salas");

    addRoom(map, 2, 1);
    const removed = resizeGrid(map, 2, 1);
    assert(removed.length === 1 && removed[0] === "2,1", "encolher o grid remove salas de fora");
    removeRoom(map, map.start);
    assert(map.start === null, "remover o início limpa o início");
}

// Import/export
{
    const map = createMap();
    const room = addRoom(map, 1, 1);
    setDoor(room, 6, 0, "boss");
    placeProp(room, "key_1", 4, 4, true);
    const back = normalizeMap(JSON.parse(JSON.stringify(serializeMap(map))));
    assert(JSON.stringify(back) === JSON.stringify(map), "serializar e importar devolve o mesmo mapa");
    let threw = false;
    try { normalizeMap({ format: "outro" }); } catch { threw = true; }
    assert(threw, "formato errado é recusado");

    const text = formatMapJson(serializeMap(map));
    assert(JSON.stringify(JSON.parse(text)) === JSON.stringify(map), "JSON formatado é válido e igual ao mapa");
    assert(text.includes(`"w${"f".repeat(12)}w",\n`), "kinds ficam um por linha");
    assert(text.includes("[0, 2, 2, 2"), "linha de tiles fica numa linha só");
}

// Formatação igual à do serve.py
{
    assert(formatMapJson({ a: [1, 2], b: { c: "x,y" }, d: ["só"] }) === '{\n  "a": [1, 2],\n  "b": { "c": "x,y" },\n  "d": ["só"]\n}', "formatMapJson segue as regras do servidor");
}

// Compatibilidade com o jogo atual (playtest)
{
    const room = createRoom(ROOM_COLS, ROOM_ROWS);
    setDoor(room, 6, 0);
    setDoor(room, 7, 0);
    setCell(room, 3, 3, 52, "w");
    setCell(room, 4, 4, 0, "h");
    const piece = toLegacyPiece(room);
    assert(piece.doors.N && !piece.doors.S, "portas viram booleanos por lado");
    assert(piece.walls.length === 1 && piece.walls[0].tile === 52 && piece.floor[3][3] === 16, "parede interna vira walls[] com piso por baixo");
    assert(piece.holes.includes("4,4") && piece.floor[4][4] === -1, "buraco vai para holes e floor");
    assert(legacyIssues(room).length === 0, "sala 14x9 com porta no meio é compatível");
    setDoor(room, 3, 8);
    assert(legacyIssues(room).length === 1, "porta fora do meio é avisada");
    assert(legacyIssues(createRoom(20, 12)).length === 1, "tamanho diferente é avisado");
    const spawn = findPlaytestSpawn(room);
    assert(spawn && room.kinds[spawn.p1.row][spawn.p1.col] === "f" && room.kinds[spawn.p2.row][spawn.p2.col] === "f", "spawn de teste em piso");
}

console.log(`\n${passed} passaram, ${failed} falharam.`);
process.exit(failed ? 1 : 0);
