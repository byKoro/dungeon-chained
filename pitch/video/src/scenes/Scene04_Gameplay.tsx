import React from "react";
import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { DungeonRoom } from "../components/DungeonRoom";
import { TorchGlow, Vignette } from "../components/Effects";
import { PlayerPair } from "../components/PlayerPair";
import { OnScreenText } from "../components/OnScreenText";

// CENA 4 — Gameplay apresentação (Block 2). ~8s. Zoom suave no par.
const Scene04Inner: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const cy = height / 2 + 40;

  const zoom = interpolate(frame, [0, 8 * fps], [1, 1.12], {
    easing: Easing.inOut(Easing.ease),
  });
  // Dupla caminhando (leve oscilação lateral).
  const sway = Math.sin(frame * 0.08) * 60;
  const bob = Math.sin(frame * 0.4) * 5;
  const p1 = { x: width / 2 - 170 + sway, y: cy + bob };
  const p2 = { x: width / 2 + 170 + sway, y: cy - bob };

  return (
    <AbsoluteFill style={{ scale: String(zoom) }}>
      <DungeonRoom tile={120}>
        <TorchGlow x={width * 0.22} y={height * 0.32} radius={320} />
        <TorchGlow x={width * 0.78} y={height * 0.32} radius={320} />
        <PlayerPair p1={p1} p2={p2} size={260} />
        <Vignette strength={0.8} />
        <OnScreenText from={0.5} variant="headline" position="bottom">
          2-PLAYER COUCH CO-OP ROGUELIKE
        </OnScreenText>
      </DungeonRoom>
    </AbsoluteFill>
  );
};

export const Scene04Gameplay = Interactive.create({
  Component: Scene04Inner,
  layout: "absolute-fill",
});
