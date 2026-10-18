import React from "react";
import { AbsoluteFill, staticFile } from "remotion";
import { ASSET } from "../theme";

// Recorta UM tile do tileset (10 colunas, 16px) e desenha num quadrado `size`.
// index -> col = index % 10, row = floor(index / 10); sx = col*16, sy = row*16.
const TILESET_COLS = 10;
const TILE_SRC = 16;

export const Tile: React.FC<{ index: number; size: number; left: number; top: number }> = ({
  index,
  size,
  left,
  top,
}) => {
  const col = index % TILESET_COLS;
  const row = Math.floor(index / TILESET_COLS);
  const scale = size / TILE_SRC;
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width: size,
        height: size,
        overflow: "hidden",
      }}
    >
      <img
        src={staticFile(ASSET.tileset)}
        width={160 * scale}
        height={192 * scale}
        style={{
          imageRendering: "pixelated",
          marginLeft: -col * TILE_SRC * scale,
          marginTop: -row * TILE_SRC * scale,
          maxWidth: "none",
        }}
        alt=""
      />
    </div>
  );
};

// Reproduz a moldura + piso base do jogo (RoomTiles._tileAt) para C×R tiles.
// Mesmos índices: cantos 0/5/40/45, paredes 2/42/20/25, beiras 11/12/14/31/32/34/21/24,
// piso central 16.
const roomTileAt = (c: number, r: number, cols: number, rows: number): number => {
  const last = cols - 1;
  const bottom = rows - 1;
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
  return 16; // piso central liso
};

// Monta a sala centralizada. `tile` = tamanho de cada tile na tela (px).
// Com 14x9 tiles e tile=120, a sala ocupa 1680x1080 (cabe em 1920x1080).
export const DungeonRoom: React.FC<{
  cols?: number;
  rows?: number;
  tile?: number;
  offsetY?: number;
  children?: React.ReactNode;
}> = ({ cols = 14, rows = 9, tile = 120, offsetY = 0, children }) => {
  const w = cols * tile;
  const h = rows * tile;
  const originX = (1920 - w) / 2;
  const originY = (1080 - h) / 2 + offsetY;

  const tiles: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      tiles.push(
        <Tile
          key={`${c}-${r}`}
          index={roomTileAt(c, r, cols, rows)}
          size={tile + 1} // +1 evita linhas finas entre tiles
          left={originX + c * tile}
          top={originY + r * tile}
        />,
      );
    }
  }

  return (
    <AbsoluteFill style={{ backgroundColor: "#0d0b12" }}>
      {tiles}
      {children}
    </AbsoluteFill>
  );
};
