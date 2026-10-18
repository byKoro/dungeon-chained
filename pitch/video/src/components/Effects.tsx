import React from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame } from "remotion";
import { COLORS } from "../theme";

// Vinheta escura nas bordas (sempre ligada nas cenas de masmorra).
export const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.85 }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 40%, rgba(0,0,0,${strength}) 100%)`,
      pointerEvents: "none",
    }}
  />
);

// Halo âmbar de tocha com flicker, posicionável.
export const TorchGlow: React.FC<{
  x: number;
  y: number;
  radius?: number;
}> = ({ x, y, radius = 320 }) => {
  const frame = useCurrentFrame();
  const flicker = 0.85 + Math.sin(frame * 0.5) * 0.05 + (random(frame) - 0.5) * 0.06;
  return (
    <div
      style={{
        position: "absolute",
        left: x - radius,
        top: y - radius,
        width: radius * 2,
        height: radius * 2,
        borderRadius: "50%",
        background: `radial-gradient(circle, rgba(255,209,102,${0.55 * flicker}) 0%, rgba(255,209,102,0.18) 35%, rgba(255,209,102,0) 70%)`,
        pointerEvents: "none",
      }}
    />
  );
};

// Explosão de sangue EXAGERADA a partir de um ponto, disparada em `startFrame`.
export const BloodBurst: React.FC<{
  x: number;
  y: number;
  startFrame: number;
  count?: number;
  seed?: number;
}> = ({ x, y, startFrame, count = 28, seed = 1 }) => {
  const frame = useCurrentFrame();
  const t = frame - startFrame;
  if (t < 0 || t > 45) return null;
  return (
    <>
      {new Array(count).fill(0).map((_, i) => {
        const r = random(`${seed}-${i}-a`);
        const ang = r * Math.PI * 2;
        const speed = 6 + random(`${seed}-${i}-b`) * 14;
        const size = 6 + random(`${seed}-${i}-c`) * 16;
        const dist = speed * t;
        const gravity = 0.15 * t * t;
        const col = COLORS.blood[Math.floor(random(`${seed}-${i}-d`) * COLORS.blood.length)];
        const opacity = interpolate(t, [0, 30, 45], [1, 1, 0], {
          extrapolateRight: "clamp",
        });
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x + Math.cos(ang) * dist,
              top: y + Math.sin(ang) * dist + gravity,
              width: size,
              height: size,
              background: col,
              borderRadius: 2,
              opacity,
            }}
          />
        );
      })}
    </>
  );
};

// Flash branco curto.
export const Flash: React.FC<{ startFrame: number; durationInFrames?: number }> = ({
  startFrame,
  durationInFrames = 6,
}) => {
  const frame = useCurrentFrame();
  const t = frame - startFrame;
  if (t < 0 || t > durationInFrames) return null;
  const opacity = interpolate(t, [0, durationInFrames], [0.9, 0], {
    extrapolateRight: "clamp",
  });
  return <AbsoluteFill style={{ background: "white", opacity }} />;
};

// Sangue na "lente": manchas que surgem na tela inteira no impacto e desbotam.
export const ScreenBlood: React.FC<{
  startFrame: number;
  count?: number;
  seed?: number;
}> = ({ startFrame, count = 14, seed = 1 }) => {
  const frame = useCurrentFrame();
  const t = frame - startFrame;
  if (t < 0 || t > 90) return null;
  const opacity = interpolate(t, [0, 4, 60, 90], [0, 0.85, 0.6, 0], {
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity }}>
      {new Array(count).fill(0).map((_, i) => {
        const x = random(`sb-${seed}-${i}-x`) * 1920;
        const y = random(`sb-${seed}-${i}-y`) * 1080;
        const size = 30 + random(`sb-${seed}-${i}-s`) * 140;
        const col = COLORS.blood[Math.floor(random(`sb-${seed}-${i}-c`) * COLORS.blood.length)];
        const squish = 0.5 + random(`sb-${seed}-${i}-q`) * 1;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: size,
              height: size * squish,
              background: `radial-gradient(ellipse at center, ${col} 0%, ${col} 55%, transparent 72%)`,
              borderRadius: "50%",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
