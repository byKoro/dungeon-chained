import React from "react";
import {
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { DungeonRoom } from "../components/DungeonRoom";
import { TorchGlow, Vignette } from "../components/Effects";
import { OnScreenText } from "../components/OnScreenText";

// CENA 2 — Hela rouba Mjölnir (Block 1). ~5s.
// Mjölnir em SVG; mão/silhueta (Hela) entra pela direita e arranca o martelo.
const Scene02Inner: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const cx = width / 2;
  const cy = height / 2;

  // Tochas acendendo da esquerda para a direita.
  const torches = [
    { x: width * 0.2, y: cy, on: 0.5 },
    { x: width * 0.4, y: cy, on: 1.2 },
    { x: width * 0.6, y: cy, on: 1.9 },
    { x: width * 0.8, y: cy, on: 2.6 },
  ].filter((t) => frame > t.on * fps);

  // Hela arranca o martelo em ~3.5s: o martelo acelera para fora à direita.
  const grabStart = 3.5 * fps;
  const hammerX = interpolate(frame, [grabStart, grabStart + 0.4 * fps], [cx, width + 300], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.quad),
  });
  const hammerFloat = Math.sin(frame * 0.1) * 10;

  return (
    <DungeonRoom tile={120}>
      {torches.map((t, i) => (
        <TorchGlow key={i} x={t.x} y={height * 0.32} radius={300} />
      ))}

      {/* Mjölnir (SVG simples). */}
      <svg
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0, overflow: "visible" }}
      >
        <g style={{ translate: `${hammerX}px ${cy + hammerFloat}px` }}>
          <rect x={-70} y={-50} width={140} height={90} rx={10} fill="#6b7280" stroke="#cbd5e1" strokeWidth={4} />
          <rect x={-14} y={40} width={28} height={150} rx={8} fill="#7c5c3a" stroke="#3f2d1a" strokeWidth={3} />
          <rect x={-70} y={-50} width={20} height={90} fill="#9ca3af" opacity={0.6} />
        </g>
      </svg>

      {/* Silhueta de Hela entrando pela direita. */}
      <div
        style={{
          position: "absolute",
          right: interpolate(frame, [2.6 * fps, 3.5 * fps], [-400, 180], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.cubic),
          }),
          top: cy - 260,
          width: 360,
          height: 560,
          background: "linear-gradient(180deg, #11131a 0%, #05060a 100%)",
          clipPath:
            "polygon(50% 0%, 70% 12%, 62% 35%, 85% 60%, 70% 100%, 30% 100%, 15% 60%, 38% 35%, 30% 12%)",
          filter: "drop-shadow(0 0 30px rgba(0,0,0,0.9))",
        }}
      />

      <Vignette strength={0.9} />
      <OnScreenText from={3.5} variant="mythic">
        Now the chain binds them.
      </OnScreenText>
    </DungeonRoom>
  );
};

export const Scene02Hela = Interactive.create({
  Component: Scene02Inner,
  layout: "absolute-fill",
});
