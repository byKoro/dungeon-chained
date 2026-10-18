import React from "react";
import { Tile } from "./DungeonRoom";
import { TILE, ROOM_COLS as RC, ROOM_ROWS as RR, ROOM_W as RW, ROOM_H as RH } from "../theme";

// Sala em COORDENADAS DE MUNDO (origem 0,0; cada tile = TILE px, como o jogo).
// Desenha a moldura + piso (RoomTiles._tileAt) e as PORTAS REAIS do tileset
// nos vãos (índices do jogo). Pensada para ficar dentro de <Camera>.
//
// Portas (RoomTiles._openDoors): 2 tiles de largura por lado.
//   N/S: índices 36 (esq) + 37 (dir)   W: 47/57   E: 48/58
// Quando "aberta", o vão vira piso + um gradiente de corredor escuro.

const roomTileAt = (
  c: number,
  r: number,
  cols: number,
  rows: number,
  doors: Doors = {},
): number => {
  const last = cols - 1;
  const bottom = rows - 1;
  const midC = (cols / 2) | 0;

  // VÃO DA PORTA: nas colunas centrais da parede com porta, a célula é PISO
  // (o vão), não parede — igual ao jogo (RoomTiles._openDoors põe FLOOR=16).
  // Assim, quando as folhas da porta deslizam, revela-se piso/corredor, não a
  // parede.
  const isDoorColN = doors.N && r === 0 && (c === midC - 1 || c === midC);
  const isDoorColS = doors.S && r === bottom && (c === midC - 1 || c === midC);
  if (isDoorColN || isDoorColS) return 16;

  if (r === 0 && c === 0) return 0;
  if (r === 0 && c === last) return 5;
  if (r === bottom && c === 0) return 40;
  if (r === bottom && c === last) return 45;
  if (r === 0) return 2;
  if (r === bottom) return 42;
  if (c === 0) return 20;
  if (c === last) return 25;
  const topRow = 1,
    botRow = bottom - 1,
    leftCol = 1,
    rightCol = last - 1;
  if (r === topRow && c === leftCol) return 11;
  if (r === topRow && c === rightCol) return 14;
  if (r === botRow && c === leftCol) return 31;
  if (r === botRow && c === rightCol) return 34;
  if (r === topRow) return 12;
  if (r === botRow) return 32;
  if (c === leftCol) return 21;
  if (c === rightCol) return 24;
  return 16;
};

export type Doors = { N?: boolean; S?: boolean; E?: boolean; W?: boolean };

// Posição (em tile) e índices da porta de cada lado (como o jogo).
const doorCellsFor = (cols: number, rows: number, doors: Doors) => {
  const midC = (cols / 2) | 0;
  const midR = (rows / 2) | 0;
  const last = cols - 1;
  const bottom = rows - 1;
  const cells: { col: number; row: number; index: number }[] = [];
  if (doors.N) cells.push({ col: midC - 1, row: 0, index: 36 }, { col: midC, row: 0, index: 37 });
  if (doors.S)
    cells.push({ col: midC - 1, row: bottom, index: 36 }, { col: midC, row: bottom, index: 37 });
  if (doors.W) cells.push({ col: 0, row: midR - 1, index: 47 }, { col: 0, row: midR, index: 57 });
  if (doors.E) cells.push({ col: last, row: midR - 1, index: 48 }, { col: last, row: midR, index: 58 });
  return cells;
};

export const ROOM_COLS = RC;
export const ROOM_ROWS = RR;
export const ROOM_W = RW;
export const ROOM_H = RH;

export const RoomWorld: React.FC<{
  cols?: number;
  rows?: number;
  doors?: Doors;
  doorOpen?: number; // 0 = fechada (tile de porta), 1 = aberta (vão + corredor)
  children?: React.ReactNode;
}> = ({ cols = ROOM_COLS, rows = ROOM_ROWS, doors = {}, doorOpen = 0, children }) => {
  const tiles: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      tiles.push(
        <Tile
          key={`${c}-${r}`}
          index={roomTileAt(c, r, cols, rows, doors)}
          size={TILE + 1}
          left={c * TILE}
          top={r * TILE}
        />,
      );
    }
  }

  const doorCells = doorCellsFor(cols, rows, doors);

  return (
    <>
      {tiles}

      {/* Corredor do outro lado da porta Norte: aparece ATRÁS, revelado quando
          a porta abre (piso indo para fora + luz). Fica sob o tile de porta. */}
      {doors.N && doorOpen > 0 && <DoorwayNorth cols={cols} openAmount={doorOpen} />}

      {/* Portas reais do tileset no vão. Fechada: tile de porta opaco.
          Aberta: as duas folhas deslizam para os lados, abrindo o vão. */}
      {doors.N
        ? (() => {
            const midC = (cols / 2) | 0;
            const slide = doorOpen * TILE; // folhas deslizam até sumir no batente
            return (
              <>
                <div style={{ opacity: 1 - doorOpen * 0.15, translate: `${-slide}px 0px` }}>
                  <Tile index={36} size={TILE + 1} left={(midC - 1) * TILE} top={0} />
                </div>
                <div style={{ opacity: 1 - doorOpen * 0.15, translate: `${slide}px 0px` }}>
                  <Tile index={37} size={TILE + 1} left={midC * TILE} top={0} />
                </div>
              </>
            );
          })()
        : doorCells.map((d, i) => (
            <div key={`door-${i}`} style={{ opacity: 1 - doorOpen }}>
              <Tile index={d.index} size={TILE + 1} left={d.col * TILE} top={d.row * TILE} />
            </div>
          ))}

      {children}
    </>
  );
};

// O outro lado da porta Norte: um corredor de piso subindo para fora da sala,
// escurecendo ao longe, com um brilho âmbar de "próxima sala". Revelado pela
// abertura da porta (openAmount 0..1).
const DoorwayNorth: React.FC<{ cols: number; openAmount: number }> = ({ cols, openAmount }) => {
  const midC = (cols / 2) | 0;
  const x = (midC - 1) * TILE;
  const w = 2 * TILE;
  const depth = TILE * 2.5; // profundidade do corredor acima da sala

  // Tiles de piso do corredor (duas colunas x algumas fileiras acima de y=0).
  const floorTiles: React.ReactNode[] = [];
  const rowsUp = 3;
  for (let r = 1; r <= rowsUp; r++) {
    for (let c = 0; c < 2; c++) {
      floorTiles.push(
        <Tile
          key={`cf-${c}-${r}`}
          index={16}
          size={TILE + 1}
          left={x + c * TILE}
          top={-r * TILE}
        />,
      );
    }
  }

  return (
    <div style={{ position: "absolute", left: 0, top: 0, opacity: openAmount }}>
      {/* Piso do corredor que se revela além da porta. */}
      <div style={{ clipPath: `inset(0 0 ${(1 - openAmount) * 100}% 0)` }}>{floorTiles}</div>
      {/* Escurecimento ao fundo do corredor. */}
      <div
        style={{
          position: "absolute",
          left: x,
          top: -depth,
          width: w,
          height: depth,
          background:
            "linear-gradient(180deg, rgba(10,7,16,0.95) 0%, rgba(10,7,16,0.4) 70%, rgba(10,7,16,0) 100%)",
        }}
      />
      {/* Luz âmbar da próxima sala, no limiar da porta. */}
      <div
        style={{
          position: "absolute",
          left: x - TILE * 0.3,
          top: -TILE * 0.6,
          width: w + TILE * 0.6,
          height: TILE * 1.6,
          background:
            "radial-gradient(ellipse at center, rgba(255,209,102,0.9) 0%, rgba(255,209,102,0.3) 50%, rgba(255,209,102,0) 100%)",
          filter: "blur(3px)",
        }}
      />
    </div>
  );
};
