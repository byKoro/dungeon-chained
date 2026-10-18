import React from "react";
import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ASSET } from "../theme";
import { DungeonRoom } from "../components/DungeonRoom";
import { TorchGlow, Vignette, BloodBurst, ScreenBlood } from "../components/Effects";
import { PlayerPair } from "../components/PlayerPair";
import { PixelSprite } from "../components/PixelSprite";
import { useShake } from "../components/useShake";
import { OnScreenText } from "../components/OnScreenText";

// CENA 7 — Caos 1: puxão pros spikes (Block 4). ~7s.
// P1 quer ir pra esquerda, P2 dispara pra direita e arrasta P1 pros spikes.
const Scene07Inner: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const cy = height / 2 + 60;

  // P2 corre para a direita; a corda arrasta P1 atrás dele.
  const p2x = interpolate(frame, [0, 2.2 * fps], [width / 2, width * 0.78], {
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.quad),
  });
  const p1x = interpolate(frame, [0, 2.2 * fps], [width / 2 - 60, width * 0.62], {
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });
  const p1 = { x: p1x, y: cy };
  const p2 = { x: p2x, y: cy };

  const hitFrame = 2.5 * fps;
  const hurt = frame > hitFrame && Math.floor(frame / 4) % 2 === 0;
  const shake = useShake(hitFrame, 14, 14);

  // Spikes animados (peaks_0..3) na zona de destino de P1.
  const spikeFrame = Math.min(3, Math.floor(((frame % 40) / 40) * 4));

  return (
    <AbsoluteFill style={{ translate: shake }}>
      <DungeonRoom tile={120}>
        <TorchGlow x={width * 0.3} y={height * 0.32} radius={320} />

        {/* Fileira de spikes (peaks_0..3) onde P1 é arrastado. */}
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ position: "absolute", left: width * 0.6 + i * 110, top: cy + 70 }}>
            <PixelSprite src={ASSET.peaks[spikeFrame]} size={110} shadow={false} />
          </div>
        ))}

        <PlayerPair
          p1={p1}
          p2={p2}
          pose1={hurt ? "hurt" : frame > 1.6 * fps ? "scared" : "walk"}
          pose2="walk"
          size={240}
        />

        <BloodBurst x={p1.x} y={cy} startFrame={hitFrame} count={18} seed={7} />
        <ScreenBlood startFrame={hitFrame} count={10} seed={7} />
        <Vignette strength={0.85} />

        <OnScreenText from={0} until={2.2} variant="headline" position="top">
          You go left.
        </OnScreenText>
        <OnScreenText from={4.5} variant="headline" position="top">
          Your partner drags you in.
        </OnScreenText>
      </DungeonRoom>
    </AbsoluteFill>
  );
};

export const Scene07Chaos1 = Interactive.create({
  Component: Scene07Inner,
  layout: "absolute-fill",
});
