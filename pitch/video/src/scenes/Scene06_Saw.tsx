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
import { TorchGlow, Vignette, BloodBurst, Flash, ScreenBlood } from "../components/Effects";
import { PlayerPair } from "../components/PlayerPair";
import { SpriteSheet } from "../components/SpriteSheet";
import { GibExplosion } from "../components/GibExplosion";
import { DEMON } from "../sprites";
import { useShake } from "../components/useShake";
import { OnScreenText } from "../components/OnScreenText";

// CENA 6 — Close na serra / física da tensão / corte no inimigo (Block 3). ~10s.
const Scene06Inner: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const cy = height / 2 + 20;

  // Fase 1 (0-3s): close na serra. Fase 2 (3-7s): esticar/relaxar.
  // Fase 3 (7-10s): alinhar demon no meio e dilacerar.
  const sep = interpolate(
    frame,
    [3 * fps, 4.5 * fps, 6 * fps, 7 * fps],
    [220, 520, 220, 300],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.ease) },
  );
  const p1 = { x: width / 2 - sep, y: cy };
  const p2 = { x: width / 2 + sep, y: cy };
  const scared = frame > 3.6 * fps && frame < 5.4 * fps;

  // Zoom close na serra na fase 1.
  const zoom = interpolate(frame, [0, 3 * fps], [1.35, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.ease),
  });

  const killFrame = 7.6 * fps;
  const demonAlive = frame < killFrame;
  const shake = useShake(killFrame, 16, 12);

  return (
    <AbsoluteFill style={{ scale: String(zoom), translate: shake }}>
      <DungeonRoom tile={120}>
        <TorchGlow x={width * 0.3} y={height * 0.35} radius={320} />
        <TorchGlow x={width * 0.7} y={height * 0.35} radius={320} />

        {/* Demon animado no meio da linha, alvo da serra. */}
        {demonAlive && frame > 6.6 * fps && (
          <div style={{ position: "absolute", left: width / 2, top: cy, translate: "-50% -70%" }}>
            <SpriteSheet anim={DEMON.walk} drawHeight={240} />
          </div>
        )}

        {/* Explosão em gibs ao ser cortado. */}
        {!demonAlive && (
          <GibExplosion
            anim={DEMON.death}
            drawHeight={240}
            cx={width / 2}
            cy={cy - 60}
            startFrame={killFrame}
            seed={6}
          />
        )}

        <PlayerPair
          p1={p1}
          p2={p2}
          pose1={scared ? "scared" : "walk"}
          pose2={scared ? "scared" : "walk"}
          size={240}
          sawScale={2.6}
          glow
        />

        <BloodBurst x={width / 2} y={cy} startFrame={killFrame} count={38} seed={6} />
        <ScreenBlood startFrame={killFrame} count={16} seed={6} />
        <Flash startFrame={killFrame} durationInFrames={5} />
        <Vignette strength={0.82} />

        <OnScreenText from={0} until={3} variant="headline">
          The saw IS the chain.
        </OnScreenText>
        <OnScreenText from={3} until={7} variant="headline" position="bottom">
          Walk apart — it pulls taut.
        </OnScreenText>
        <OnScreenText from={7.8} variant="headline" position="bottom">
          Your sword, your rope, your leash.
        </OnScreenText>
      </DungeonRoom>
    </AbsoluteFill>
  );
};

export const Scene06Saw = Interactive.create({
  Component: Scene06Inner,
  layout: "absolute-fill",
});
