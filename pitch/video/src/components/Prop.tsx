import React from "react";
import { Img, staticFile, useCurrentFrame } from "remotion";

// Prop decorativo de 16x16 do jogo (caixa, barril, frasco, baú, moeda...).
// Pode animar entre N frames (arquivos separados tipo torch_1..4.png) num loop.
export const Prop: React.FC<{
  frames: readonly string[]; // caminhos dos frames em public/
  size: number; // tamanho na tela (px de mundo, dentro da Camera)
  x: number; // centro no mundo
  y: number; // base (os pés do prop) no mundo
  fps?: number; // frames por segundo da animação
  flipX?: boolean;
  shadow?: boolean;
}> = ({ frames, size, x, y, fps = 8, flipX = false, shadow = true }) => {
  const frame = useCurrentFrame();
  const i = frames.length > 1 ? Math.floor((frame / (30 / fps)) % frames.length) : 0;
  return (
    <Img
      src={staticFile(frames[i])}
      style={{
        position: "absolute",
        left: x - size / 2,
        top: y - size,
        width: size,
        height: size,
        imageRendering: "pixelated",
        scale: flipX ? "-1 1" : undefined,
        filter: shadow ? "drop-shadow(0 4px 4px rgba(0,0,0,0.5))" : undefined,
      }}
      alt=""
    />
  );
};
