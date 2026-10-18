import React from "react";
import { random, staticFile, useCurrentFrame } from "remotion";

// A serra ROMPE: o sprite real (saw.png, linha 0 col 3) é picotado numa grade
// e cada caco se espalha e CAI para fora da tela (gravidade), com rotação.
// Usado como transição no fim da cena.
const SAW_SRC = "assets/saw/saw.png";
const SAW_COL = 3;
const SAW_ROW = 0;
const SAW_CELL = 16;
const SHEET = 64;

export const SawShatter: React.FC<{
  cx: number; // centro da serra no mundo
  cy: number;
  size: number; // tamanho da serra inteira (px de mundo)
  startFrame: number; // instante do rompimento
  gridCols?: number;
  gridRows?: number;
  seed?: number;
}> = ({ cx, cy, size, startFrame, gridCols = 4, gridRows = 4, seed = 1 }) => {
  const frame = useCurrentFrame();
  const t = frame - startFrame;
  if (t < 0) return null;

  const pieceW = size / gridCols;
  const pieceH = size / gridRows;
  const originX = cx - size / 2;
  const originY = cy - size / 2;
  const sheetScale = size / SAW_CELL; // sprite 16px -> size px

  const pieces: React.ReactNode[] = [];
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const key = `${seed}-${c}-${r}`;
      // Velocidade inicial: espalha para os lados (x) e para cima/baixo (y),
      // depois a gravidade puxa tudo para BAIXO, saindo da tela.
      const vx = (c - (gridCols - 1) / 2) * 5 + (random(`${key}-x`) - 0.5) * 10;
      const vy = -6 + (random(`${key}-y`) - 0.5) * 8; // leve impulso pra cima
      const gravity = 0.9;
      const px = originX + c * pieceW + vx * t;
      const py = originY + r * pieceH + vy * t + 0.5 * gravity * t * t;
      const rot = (random(`${key}-r`) - 0.5) * 30 * t;

      // Recorte deste caco dentro do frame da serra (col 3, row 0).
      const srcX = (SAW_COL * SAW_CELL + (c / gridCols) * SAW_CELL) * sheetScale;
      const srcY = (SAW_ROW * SAW_CELL + (r / gridRows) * SAW_CELL) * sheetScale;

      pieces.push(
        <div
          key={key}
          style={{
            position: "absolute",
            left: px,
            top: py,
            width: pieceW,
            height: pieceH,
            overflow: "hidden",
            rotate: `${rot}deg`,
          }}
        >
          <img
            src={staticFile(SAW_SRC)}
            width={SHEET * sheetScale}
            height={SHEET * sheetScale}
            style={{
              imageRendering: "pixelated",
              marginLeft: -srcX,
              marginTop: -srcY,
              maxWidth: "none",
            }}
            alt=""
          />
        </div>,
      );
    }
  }

  return <>{pieces}</>;
};
