import React from "react";
import {
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS } from "../theme";
import { DungeonRoom } from "../components/DungeonRoom";
import { ChainSaw } from "../components/ChainSaw";
import { SpriteSheet } from "../components/SpriteSheet";
import { PLAYER } from "../sprites";
import { Flash, TorchGlow, Vignette } from "../components/Effects";
import { useShake } from "../components/useShake";

// CENA 3 — A serra nasce (Block 1 fim). ~4s.
const Scene03Inner: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const cy = height / 2;
  const p1 = { x: width / 2 - 420, y: cy };
  const p2 = { x: width / 2 + 420, y: cy };

  // A corda "liga" em ~1.4s: antes disso, a serra ainda não aparece.
  const sawOn = 1.4 * fps;
  const ropeProgress = interpolate(frame, [0, sawOn], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  // Ponto da corda que vai crescendo de p1 até p2 antes da serra ligar.
  const growP2 = {
    x: p1.x + (p2.x - p1.x) * ropeProgress,
    y: cy,
  };
  const shake = useShake(sawOn, 10, 10);

  return (
    <div style={{ width: "100%", height: "100%", translate: shake }}>
      <DungeonRoom tile={120}>
        <TorchGlow x={width * 0.5} y={cy - 120} radius={500} />

        {/* Irmãos grandes, de perfil, virados um para o outro. */}
        <div style={{ position: "absolute", left: p1.x, top: cy, translate: "-50% -75%" }}>
          <SpriteSheet anim={PLAYER.p1.walk} drawHeight={360} />
        </div>
        <div style={{ position: "absolute", left: p2.x, top: cy, translate: "-50% -75%" }}>
          <SpriteSheet anim={PLAYER.p2.walk} drawHeight={360} flipX />
        </div>

        {frame < sawOn ? (
        // Corda crescendo (sem lâminas ainda).
        <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
          <line
            x1={p1.x}
            y1={p1.y}
            x2={growP2.x}
            y2={growP2.y}
            stroke={COLORS.rope}
            strokeWidth={9}
            strokeLinecap="round"
          />
        </svg>
        ) : (
          <ChainSaw p1={p1} p2={p2} scale={2.4} glow />
        )}

        <Vignette strength={0.85} />
        <Flash startFrame={sawOn} durationInFrames={7} />
      </DungeonRoom>
    </div>
  );
};

export const Scene03SawBorn = Interactive.create({
  Component: Scene03Inner,
  layout: "absolute-fill",
});
