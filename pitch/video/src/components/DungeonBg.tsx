import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { ASSET, COLORS } from "../theme";
import { TorchGlow, Vignette } from "./Effects";

// Fundo de masmorra: cor base + o tileset como textura de piso em tile,
// tochas com halo e vinheta. Primeiro corte — iterar depois com salas reais.
export const DungeonBg: React.FC<{
  torches?: { x: number; y: number; radius?: number }[];
  vignette?: number;
  tint?: string;
}> = ({ torches = [], vignette = 0.85, tint = COLORS.bgDark }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: tint, overflow: "hidden" }}>
      {/* Textura do tileset repetida, bem sutil, só para dar leitura de pedra. */}
      <Img
        src={staticFile(ASSET.tileset)}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          imageRendering: "pixelated",
          opacity: 0.12,
          mixBlendMode: "overlay",
        }}
      />
      {torches.map((t, i) => (
        <TorchGlow key={i} x={t.x} y={t.y} radius={t.radius ?? 320} />
      ))}
      <Vignette strength={vignette} />
    </AbsoluteFill>
  );
};
