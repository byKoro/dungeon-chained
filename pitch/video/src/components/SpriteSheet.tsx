import React from "react";
import { staticFile, useCurrentFrame } from "remotion";

// Recorta e anima um sprite do jogo a partir de uma folha (sprite sheet),
// usando os mesmos números de recorte do jogo (EntityConfig.js).
//
// Modelo do jogo:
//   srcX = col * cellSize + cropX
//   srcY = row * cellSize + cropY
//   recorte = cropW x cropH, escalado por scale = drawHeight / cropH
// A folha é desenhada com image-rendering: pixelated (nearest-neighbor).

export type SheetAnim = {
  src: string; // caminho em public/
  sheetW: number; // largura real do PNG
  sheetH: number; // altura real do PNG
  cell: number; // tamanho da célula (quadrada)
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
  row?: number; // linha da animação (0 para fitas horizontais)
  frames: number; // nº de frames
  ticksPerFrame?: number; // ticks de 60Hz por frame (o "fps" do config)
  loop?: boolean;
  startFrame?: number; // primeiro frame do ciclo (player anda em 1..7)
};

export const SpriteSheet: React.FC<{
  anim: SheetAnim;
  drawHeight: number; // altura final na tela (px)
  flipX?: boolean;
  frameOverride?: number; // força um frame específico (ex.: hurt)
  shadow?: boolean;
  style?: React.CSSProperties;
}> = ({ anim, drawHeight, flipX = false, frameOverride, shadow = true, style }) => {
  const frame = useCurrentFrame();
  const {
    src,
    sheetW,
    sheetH,
    cell,
    cropX,
    cropY,
    cropW,
    cropH,
    row = 0,
    frames,
    ticksPerFrame = 6,
    loop = true,
    startFrame = 0,
  } = anim;

  // Remotion roda a 30fps; o jogo conta ticks de 60Hz. Convertemos: 2 ticks/frame.
  const ticks = frame * 2;
  const span = frames - startFrame;
  let col: number;
  if (frameOverride != null) {
    col = frameOverride;
  } else {
    const step = Math.floor(ticks / ticksPerFrame);
    col = loop ? startFrame + (step % span) : Math.min(startFrame + step, frames - 1);
  }

  const scale = drawHeight / cropH;
  const drawW = cropW * scale;
  const drawH = cropH * scale;

  const sx = col * cell + cropX;
  const sy = row * cell + cropY;

  return (
    <div
      style={{
        width: drawW,
        height: drawH,
        overflow: "hidden",
        scale: flipX ? "-1 1" : undefined,
        filter: shadow ? "drop-shadow(0 10px 10px rgba(0,0,0,0.6))" : undefined,
        ...style,
      }}
    >
      <img
        src={staticFile(src)}
        width={sheetW * scale}
        height={sheetH * scale}
        style={{
          imageRendering: "pixelated",
          marginLeft: -sx * scale,
          marginTop: -sy * scale,
          maxWidth: "none",
        }}
        alt=""
      />
    </div>
  );
};
