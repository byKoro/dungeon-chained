/**
 * test_modular_grid.js — Testes unitários para Validação de Encaixe e Grid Modular.
 */

import { RoomSocket, RoomTemplate } from '../js/rooms/RoomSocket.js';
import { ModularGrid } from '../js/rooms/ModularGrid.js';
import { RoomPresets } from '../js/rooms/RoomPresets.js';

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
    totalTests++;
    if (!condition) {
        console.error(`❌ FALHOU: ${message}`);
        throw new Error(message);
    }
    passedTests++;
    console.log(`✅ PASSOU: ${message}`);
}

console.log("=== INICIANDO TESTES DO SISTEMA MODULAR DE SALAS ===\n");

// --------------------------------------------------------------------------
// TESTE 1: Definição e Leitura de Sockets
// --------------------------------------------------------------------------
console.log("--- TESTE 1: Definição e Leitura de Sockets ---");
{
    const socketE = new RoomSocket({
        id: "socket_e_mid",
        dir: "E",
        offset: 3,
        span: 2,
        type: "standard"
    });

    assert(socketE.dir === "E", "Socket possui direção 'E'");
    assert(socketE.offset === 3, "Socket possui offset 3");
    assert(socketE.span === 2, "Socket possui span 2");
    assert(socketE.containsCoord(3) && socketE.containsCoord(4), "Socket cobre as linhas 3 e 4");
    assert(!socketE.containsCoord(2) && !socketE.containsCoord(5), "Socket não cobre linhas fora do vão");

    // Criação a partir de JSON
    const jsonStr = JSON.stringify(socketE.toJSON());
    const restoredSocket = RoomSocket.fromJSON(JSON.parse(jsonStr));
    assert(restoredSocket.dir === "E" && restoredSocket.offset === 3, "Serialização e deserialização de RoomSocket funciona");

    // Template padrão
    const template = RoomTemplate.createStandard({
        id: "room_test_std",
        cols: 14,
        rows: 9,
        doors: { E: true, W: true }
    });

    assert(template.cols === 14 && template.rows === 9, "Template tem dimensões 14x9");
    const eSockets = template.getSockets("E");
    const wSockets = template.getSockets("W");
    assert(eSockets.length === 1, "Template possui 1 socket no Leste");
    assert(wSockets.length === 1, "Template possui 1 socket no Oeste");
    assert(eSockets[0].offset === 3 && eSockets[0].span === 2, "Socket Leste centralizado em row=3 (span=2)");
    assert(wSockets[0].offset === 3 && wSockets[0].span === 2, "Socket Oeste centralizado em row=3 (span=2)");
}

// --------------------------------------------------------------------------
// TESTE 2: Validação de Adjacência (Sala B à direita de Sala A)
// --------------------------------------------------------------------------
console.log("\n--- TESTE 2: Validação de Adjacência (Leste / Oeste) ---");
{
    const grid = new ModularGrid({ cols: 10, rows: 10 });

    // Sala A posicionada em (2, 2) com porta no Leste
    const roomA = RoomPresets.CORRIDOR_HORIZONTAL; // Doors: E e W
    const placeResA = grid.placeRoom(roomA, 2, 2);
    assert(placeResA.success, "Sala A posicionada em (2, 2)");

    // CASO 2.1: Sala B com porta Oeste matching no mesmo offset (row=3, span=2)
    const roomB_matching = RoomPresets.CORRIDOR_HORIZONTAL; // Doors: E e W
    const checkB_matching = grid.canPlace(roomB_matching, 3, 2);
    assert(checkB_matching.valid === true, "Sala B à direita de A é VÁLIDA quando portas coincidem");
    assert(checkB_matching.connections.length === 1, "Conexão identificada entre A e B");

    // CASO 2.2: Sala C à direita de A, mas com PAREDE SÓLIDA no Oeste (porta apenas no Norte/Sul)
    const roomC_solidWall = RoomPresets.CORRIDOR_VERTICAL; // Doors: N e S (W é parede sólida)
    const checkC_wall = grid.canPlace(roomC_solidWall, 3, 2);
    assert(checkC_wall.valid === false, "Sala com parede sólida onde vizinho tem porta deve ser REJEITADA");
    assert(checkC_wall.reason === "WALL_TO_DOOR_MISMATCH", "Motivo de rejeição: WALL_TO_DOOR_MISMATCH (parede sólida contra porta aberta)");

    // CASO 2.2b: Sala com PORTA aberta tentando encaixar onde vizinho tem PAREDE SÓLIDA
    const gridWall = new ModularGrid({ cols: 10, rows: 10 });
    gridWall.placeRoom(RoomPresets.CORRIDOR_VERTICAL, 2, 2); // E é parede sólida
    const checkDoorAgainstWall = gridWall.canPlace(RoomPresets.CORRIDOR_HORIZONTAL, 3, 2, { requireConnection: false });
    assert(checkDoorAgainstWall.valid === false, "Porta abrindo contra parede sólida deve ser REJEITADA");
    assert(checkDoorAgainstWall.reason === "DOOR_TO_WALL_MISMATCH", "Motivo de rejeição: DOOR_TO_WALL_MISMATCH");

    // CASO 2.3: Sala D possui porta no Oeste, mas em coordenada vertical DIFERENTE (desalinhamento)
    const roomD_misaligned = new RoomTemplate({
        id: "room_misaligned",
        cols: 14,
        rows: 9,
        sockets: [
            new RoomSocket({ dir: "W", offset: 5, span: 2 }) // Offset 5 em vez de 3
        ]
    });
    const checkD_misaligned = grid.canPlace(roomD_misaligned, 3, 2);
    assert(checkD_misaligned.valid === false, "Sala com porta em coordenada vertical diferente deve ser REJEITADA");
    assert(checkD_misaligned.reason === "SOCKET_ALIGNMENT_MISMATCH", "Motivo de rejeição: SOCKET_ALIGNMENT_MISMATCH");

    // CASO 2.4: Ambas as salas com parede sólida na borda compartilhada -> VÁLIDO
    const grid2 = new ModularGrid({ cols: 10, rows: 10 });
    // Sala em (0, 0) com portas apenas no N e S (E é parede sólida)
    grid2.placeRoom(RoomPresets.CORRIDOR_VERTICAL, 0, 0);
    // Sala vizinha em (1, 0) com portas apenas no N e S (W é parede sólida)
    const checkSolidWalls = grid2.canPlace(RoomPresets.CORRIDOR_VERTICAL, 1, 0, { requireConnection: false });
    assert(checkSolidWalls.valid === true, "Parede sólida contra parede sólida é VÁLIDO");
}

// --------------------------------------------------------------------------
// TESTE 3: Validação de Adjacência Vertical (Norte / Sul)
// --------------------------------------------------------------------------
console.log("\n--- TESTE 3: Validação de Adjacência Vertical (Norte / Sul) ---");
{
    const grid = new ModularGrid({ cols: 10, rows: 10 });
    // Sala A em (2, 2) com porta no Sul
    grid.placeRoom(RoomPresets.CORRIDOR_VERTICAL, 2, 2);

    // Sala B em (2, 3) (abaixo de A) com porta no Norte
    const checkVerticalMatch = grid.canPlace(RoomPresets.CORRIDOR_VERTICAL, 2, 3);
    assert(checkVerticalMatch.valid === true, "Sala B abaixo de A com porta Norte coincidente é VÁLIDA");

    // Sala B com porta Norte desalinhada (col=2 em vez de col=6)
    const roomVerticalMisaligned = new RoomTemplate({
        id: "room_v_misaligned",
        cols: 14,
        rows: 9,
        sockets: [
            new RoomSocket({ dir: "N", offset: 2, span: 2 }) // Esperado offset 6
        ]
    });
    const checkVMisaligned = grid.canPlace(roomVerticalMisaligned, 2, 3);
    assert(checkVMisaligned.valid === false, "Porta vertical com coluna desalinhada deve ser REJEITADA");
    assert(checkVMisaligned.reason === "SOCKET_ALIGNMENT_MISMATCH", "Motivo de rejeição: SOCKET_ALIGNMENT_MISMATCH");
}

// --------------------------------------------------------------------------
// TESTE 4: Gestão do Grid Global (Sobreposição, Fronteiras e Remoção)
// --------------------------------------------------------------------------
console.log("\n--- TESTE 4: Gestão do Grid Global ---");
{
    const grid = new ModularGrid({ cols: 9, rows: 7 });

    // 4.1 Posicionamento da sala inicial
    const place1 = grid.placeRoom(RoomPresets.CROSS_4WAY, 4, 3);
    assert(place1.success === true, "Sala inicial 4-way posicionada em (4, 3)");
    assert(grid.roomCount === 1, "Grid possui 1 sala");

    // 4.2 Rejeição de sobreposição
    const placeOverlap = grid.placeRoom(RoomPresets.CROSS_4WAY, 4, 3);
    assert(placeOverlap.success === false, "Tentativa de sobreposição em célula ocupada deve ser REJEITADA");
    assert(placeOverlap.validation.reason === "CELL_OCCUPIED", "Motivo: CELL_OCCUPIED");

    // 4.3 Expansão na fronteira (Leste, Oeste, Norte, Sul)
    const placeEast = grid.placeRoom(RoomPresets.DEADEND_WEST, 5, 3);
    assert(placeEast.success === true, "Deadend com porta Oeste encaixado perfeitamente no Leste de (4, 3)");

    const roomEast = grid.getRoom(5, 3);
    const roomCenter = grid.getRoom(4, 3);
    assert(roomCenter.isSocketConnected("room_cross_4way_door_E"), "Socket Leste do centro está conectado");
    assert(roomEast.isSocketConnected("room_deadend_w_door_W"), "Socket Oeste do vizinho está conectado");

    // 4.4 Verificação de Sockets Abertos e Fronteira
    const openSockets = grid.getOpenSockets();
    // Centro tinha 4 portas, 1 conectada => 3 abertas. Deadend tinha 1 porta, 1 conectada => 0 abertas. Total = 3 abertas.
    assert(openSockets.length === 3, "Grid possui exatamente 3 sockets abertos restantes");

    const frontierCells = grid.getFrontierCells();
    assert(frontierCells.length === 3, "Existem 3 células vazias candidatas na fronteira");

    // 4.5 Remoção de sala
    const removed = grid.removeRoom(5, 3);
    assert(removed !== null, "Sala em (5, 3) removida com sucesso");
    assert(grid.roomCount === 1, "Grid volta a ter 1 sala");
    assert(!roomCenter.isSocketConnected("room_cross_4way_door_E"), "Socket Leste do centro volta a ficar aberto");
}

// --------------------------------------------------------------------------
// TESTE 5: Tratamento de Dead-Ends e Exportação para DungeonGraph
// --------------------------------------------------------------------------
console.log("\n--- TESTE 5: Dead-Ends e Integração com Engine ---");
{
    const grid = new ModularGrid({ cols: 9, rows: 7 });
    grid.placeRoom(RoomPresets.START_ROOM, 4, 3);
    grid.placeRoom(RoomPresets.CORRIDOR_HORIZONTAL, 5, 3);
    grid.placeRoom(RoomPresets.BOSS_ROOM, 6, 3);

    const integrity = grid.validateIntegrity({ startKey: "4,3" });
    assert(integrity.isValid === true, "Integridade do mapa é válida");
    assert(integrity.connectedRoomsCount === 3, "Todas as 3 salas são alcançáveis a partir da inicial");

    // Selar sockets abertos (beiradas sem saída)
    const sealedCount = grid.sealDeadEnds("sealed");
    assert(sealedCount > 0, `${sealedCount} sockets abertos foram devidamente selados/bloqueados`);

    // Exportação para formato de DungeonGraph da engine
    const dungeonData = grid.toDungeonGraphData();
    assert(dungeonData.cells.has("4,3"), "Dungeon data possui célula (4, 3)");
    assert(dungeonData.cells.has("5,3"), "Dungeon data possui célula (5, 3)");
    assert(dungeonData.cells.has("6,3"), "Dungeon data possui célula (6, 3)");

    const centerCell = dungeonData.cells.get("4,3");
    assert(centerCell.doors.E === true, "Porta E da sala central ativa no grafo");
    assert(centerCell.doors.W === false, "Porta W da sala central inativa no grafo (não conectada)");

    // Teste de instanciação real da Dungeon consumindo os dados do ModularGrid
    const { Dungeon } = await import('../js/core/Dungeon.js');
    const dungeon = new Dungeon({ graph: dungeonData });
    assert(dungeon.currentKey === "4,3", "Dungeon inicializou na sala inicial correta (4, 3)");
    const doorsCenter = dungeon.doorsOf(4, 3);
    assert(doorsCenter.length === 1 && doorsCenter[0].dir === "E", "Dungeon calculou corretamente a porta Leste conectada");
    assert(doorsCenter[0].gx === 5 && doorsCenter[0].gy === 3, "Porta Leste aponta para a célula (5, 3)");

    console.log("Dungeon data exportado com sucesso compatível com Dungeon.js!");
}

// --------------------------------------------------------------------------
// TESTE 6: Arquétipos, Transformação Automática e Moldura Imutável
// --------------------------------------------------------------------------
console.log("\n--- TESTE 6: Arquétipos e Transformações Automáticas (Curvas/Espelhos) ---");
{
    const {
        ARCHETYPE,
        detectShapeFromDoors,
        applyImmutableFrame,
        transformRoomFloor,
        GlobalRoomVariantCatalog
    } = await import('../js/rooms/RoomArchetypes.js');

    // 6.1 Detecção automática de arquétipos a partir de portas
    const shapeNE = detectShapeFromDoors({ N: true, E: true });
    assert(shapeNE.archetype === ARCHETYPE.CORNER && shapeNE.orientation === "NE", "Detectado CORNER NE");

    const shapeNW = detectShapeFromDoors({ N: true, W: true });
    assert(shapeNW.archetype === ARCHETYPE.CORNER && shapeNW.orientation === "NW", "Detectado CORNER NW");

    const shapeSE = detectShapeFromDoors({ S: true, E: true });
    assert(shapeSE.archetype === ARCHETYPE.CORNER && shapeSE.orientation === "SE", "Detectado CORNER SE");

    const shapeSW = detectShapeFromDoors({ S: true, W: true });
    assert(shapeSW.archetype === ARCHETYPE.CORNER && shapeSW.orientation === "SW", "Detectado CORNER SW");

    const shapeDeadendN = detectShapeFromDoors({ N: true });
    assert(shapeDeadendN.archetype === ARCHETYPE.DEADEND && shapeDeadendN.orientation === "NORTH", "Detectado DEADEND NORTH");

    const shapeDeadendS = detectShapeFromDoors({ S: true });
    assert(shapeDeadendS.archetype === ARCHETYPE.DEADEND && shapeDeadendS.orientation === "SOUTH", "Detectado DEADEND SOUTH");

    // 6.2 Moldura imutável protege paredes externas e abre portas corretamente
    const blankInner = Array(9).fill(null).map(() => Array(14).fill(16));
    const framed = applyImmutableFrame(blankInner, { N: true, E: true }, 14, 9);
    assert(framed[0][0] === 0, "Canto superior esquerdo é parede (0)");
    assert(framed[0][13] === 5, "Canto superior direito é parede (5)");
    assert(framed[8][0] === 40, "Canto inferior esquerdo é parede (40)");
    assert(framed[8][13] === 45, "Canto inferior direito é parede (45)");
    assert(framed[0][6] === 16 && framed[0][7] === 17, "Porta Norte esculpida nas colunas centrais 6 e 7");
    assert(framed[3][13] === 16 && framed[4][13] === 17, "Porta Leste esculpida nas linhas centrais 3 e 4");

    // 6.3 Transformação automática: desenhar NE gera NW, SE e SW
    const baseCurvaNE = Array(9).fill(null).map(() => Array(14).fill(16));
    // Marca uma pedra especial no canto superior direito do miolo (col 10, linha 2)
    baseCurvaNE[2][10] = 77; // Caveira

    // Transforma para NW (espelha horizontalmente)
    const curvaNW = transformRoomFloor(baseCurvaNE, ARCHETYPE.CORNER, "NW", 14, 9);
    // Na base NE, col 10 estava a 2 tiles da parede direita (12).
    // No espelho NW, a pedra deve ter ido para a esquerda (col 3)!
    assert(curvaNW[2][3] === 77, "Pedra especial espelhada perfeitamente para o lado Oeste na Curva NW!");

    // Transforma para SE (espelha verticalmente)
    const curvaSE = transformRoomFloor(baseCurvaNE, ARCHETYPE.CORNER, "SE", 14, 9);
    // Linha 2 na base estava a 1 tile do topo. No espelho vertical (linhas 1..7), foi para a base (linha 6)!
    assert(curvaSE[6][10] === 77, "Pedra especial espelhada perfeitamente para o Sul na Curva SE!");

    // 6.4 Catálogo de variantes: pedir uma curva SW retorna a sala transformada pronta
    const floorSW = GlobalRoomVariantCatalog.getFloorForDoors({ S: true, W: true });
    assert(floorSW.length === 9 && floorSW[0].length === 14, "Piso gerado para Curva SW possui dimensões 14x9");
    assert(floorSW[8][6] === 16 && floorSW[8][7] === 17, "Porta Sul aberta na Curva SW");
    assert(floorSW[3][0] === 16 && floorSW[4][0] === 17, "Porta Oeste aberta na Curva SW");
    assert(floorSW[0][6] !== 16, "Porta Norte fechada com parede sólida na Curva SW");
    // 6.5 Junção em T: Teste de transformação automática T_NORTH -> T_SOUTH / T_WEST / T_EAST
    const shapeTNorth = detectShapeFromDoors({ N: true, E: true, W: true });
    assert(shapeTNorth.archetype === ARCHETYPE.T_JUNCTION && shapeTNorth.orientation === "T_NORTH", "Detectado T_JUNCTION T_NORTH");
    const shapeTSouth = detectShapeFromDoors({ S: true, E: true, W: true });
    assert(shapeTSouth.archetype === ARCHETYPE.T_JUNCTION && shapeTSouth.orientation === "T_SOUTH", "Detectado T_JUNCTION T_SOUTH");

    // Marca detalhe na haste norte (col 6, linha 2)
    const baseTNorth = Array(9).fill(null).map(() => Array(14).fill(16));
    baseTNorth[2][6] = 88; // Tocha sagrada
    const tSouth = transformRoomFloor(baseTNorth, ARCHETYPE.T_JUNCTION, "T_SOUTH", 14, 9);
    // Na haste sul espelhada, a tocha deve estar no sul (col 6, linha 6)
    assert(tSouth[6][6] === 88, "Detalhe na haste norte espelhado perfeitamente para a haste sul em T_SOUTH!");
    assert(tSouth[8][6] === 16 && tSouth[8][7] === 17, "Porta Sul aberta em T_SOUTH");
    assert(tSouth[0][6] !== 16, "Porta Norte fechada com parede sólida em T_SOUTH");
    assert(tSouth[3][0] === 16 && tSouth[3][13] === 16, "Portas Oeste e Leste abertas e alinhadas em T_SOUTH");

    // Catálogo de variantes para T_JUNCTION
    const tFloorFromCatalog = GlobalRoomVariantCatalog.getFloorForDoors({ S: true, E: true, W: true });
    assert(tFloorFromCatalog.length === 9 && tFloorFromCatalog[0].length === 14, "Piso de T_SOUTH gerado pelo catálogo possui dimensões 14x9");

    console.log("Sistema de Arquétipos e Transformações verificado com sucesso!");
}

console.log(`\n==================================================`);
console.log(`TODOS OS ${passedTests}/${totalTests} TESTES FORAM EXECUTADOS COM SUCESSO! 🎉`);
console.log(`==================================================`);

