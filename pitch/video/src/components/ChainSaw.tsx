import React from "react";
import { staticFile, useCurrentFrame } from "remotion";
import { COLORS } from "../theme";

// A SERRA = a corrente = a arma. Agora com o SPRITE REAL do jogo:
// assets/saw/saw.png (64x64, grade 4x4 de frames 16x16). Usamos a pose de
// inércia da linha 0, coluna 3 (sx=48, sy=0), girando por rotação.
// Uma ÚNICA serra, bem no meio, ligada aos dois players por uma corda.
type Point = { x: number; y: number };

const SAW_SRC = "assets/saw/saw.png";
const SAW_COL = 3;
const SAW_ROW = 0;
const SAW_CELL = 16;
const SHEET = 64;

export const ChainSaw: React.FC<{
  p1: Point;
  p2: Point;
  scale?: number; // multiplicador do tamanho da serra
  glow?: boolean;
}> = ({ p1, p2, scale = 2.2, glow = false }) => {
  const frame = useCurrentFrame();
  const angle = frame * 14; // rotação contínua (graus)

  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;
  const drawSize = SAW_CELL * scale;
  const sheetScale = scale; // 16->16*scale

  return (
    <>
      {/* Corda ligando os dois players (passa pela serra no meio). */}
      <svg
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0, overflow: "visible" }}
      >
        <line
          x1={p1.x}
          y1={p1.y}
          x2={p2.x}
          y2={p2.y}
          stroke={COLORS.rope}
          strokeWidth={3 * scale}
          strokeLinecap="round"
        />
      </svg>

      {/* Serra única no meio, girando (sprite real). */}
      <div
        style={{
          position: "absolute",
          left: midX,
          top: midY,
          width: drawSize,
          height: drawSize,
          translate: "-50% -50%",
          rotate: `${angle}deg`,
          overflow: "hidden",
          filter: glow ? `drop-shadow(0 0 12px ${COLORS.sawPink})` : undefined,
        }}
      >
        <img
          src={staticFile(SAW_SRC)}
          width={SHEET * sheetScale}
          height={SHEET * sheetScale}
          style={{
            imageRendering: "pixelated",
            marginLeft: -SAW_COL * SAW_CELL * sheetScale,
            marginTop: -SAW_ROW * SAW_CELL * sheetScale,
            maxWidth: "none",
          }}
          alt=""
        />
      </div>
    </>
  );
};
