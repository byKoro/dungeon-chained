import React from "react";
import { interpolate, random, staticFile, useCurrentFrame } from "remotion";
import type { SheetAnim } from "./SpriteSheet";

// Explode um inimigo em pedaços (como MeleeEnemy.explodeIntoGibs: grade de
// recortes do último frame da animação de morte). Cada peça é um recorte do
// sheet que voa com gravidade. Dispara em `startFrame`.
export const GibExplosion: React.FC<{
  anim: SheetAnim; // usar o preset de death do inimigo
  drawHeight: number;
  cx: number; // centro no mundo (px)
  cy: number;
  startFrame: number;
  gridCols?: number;
  gridRows?: number;
  seed?: number;
}> = ({ anim, drawHeight, cx, cy, startFrame, gridCols = 5, gridRows = 4, seed = 1 }) => {
  const frame = useCurrentFrame();
  const t = frame - startFrame;
  if (t < 0) return null;

  const scale = drawHeight / anim.cropH;
  const deathFrame = anim.frames - 1;
  const baseSrcX = deathFrame * anim.cell + anim.cropX;
  const baseSrcY = (anim.row ?? 0) * anim.cell + anim.cropY;
  const pieceW = anim.cropW / gridCols;
  const pieceH = anim.cropH / gridRows;

  const pieces: React.ReactNode[] = [];
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const key = `${seed}-${c}-${r}`;
      const ang = random(`${key}-a`) * Math.PI * 2;
      const speed = 5 + random(`${key}-b`) * 13;
      const dist = speed * t;
      const gravity = 0.22 * t * t;
      // Offset do pedaço em relação ao centro (como no jogo).
      const offX = ((c + 0.5) * pieceW - anim.cropW / 2) * scale;
      const offY = ((r + 0.5) * pieceH - anim.cropH / 2) * scale;
      const px = cx + offX + Math.cos(ang) * dist;
      const py = cy + offY + Math.sin(ang) * dist + gravity;
      const rot = (random(`${key}-r`) - 0.5) * 20 * t;
      const opacity = interpolate(t, [0, 40, 55], [1, 1, 0], {
        extrapolateRight: "clamp",
      });

      pieces.push(
        <div
          key={key}
          style={{
            position: "absolute",
            left: px - (pieceW * scale) / 2,
            top: py - (pieceH * scale) / 2,
            width: pieceW * scale,
            height: pieceH * scale,
            overflow: "hidden",
            rotate: `${rot}deg`,
            opacity,
          }}
        >
          <img
            src={staticFile(anim.src)}
            width={anim.sheetW * scale}
            height={anim.sheetH * scale}
            style={{
              imageRendering: "pixelated",
              marginLeft: -(baseSrcX + c * pieceW) * scale,
              marginTop: -(baseSrcY + r * pieceH) * scale,
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
