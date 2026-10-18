import React from "react";
import { Img, staticFile } from "remotion";

// Desenha um sprite do jogo em pixel art, sem borrar.
// `src` é o caminho dentro de public/ (ex.: ASSET.p1Walk).
export const PixelSprite: React.FC<{
  src: string;
  size?: number;
  style?: React.CSSProperties;
  flipX?: boolean;
  shadow?: boolean;
}> = ({ src, size = 160, style, flipX = false, shadow = true }) => {
  return (
    <Img
      src={staticFile(src)}
      style={{
        width: size,
        height: "auto",
        imageRendering: "pixelated",
        scale: flipX ? "-1 1" : undefined,
        filter: shadow ? "drop-shadow(0 8px 10px rgba(0,0,0,0.6))" : undefined,
        ...style,
      }}
    />
  );
};
