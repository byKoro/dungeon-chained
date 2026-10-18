import React from "react";
import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS } from "../theme";
import { DungeonRoom } from "../components/DungeonRoom";
import { TorchGlow, Vignette } from "../components/Effects";
import { PlayerPair } from "../components/PlayerPair";
import { OnScreenText } from "../components/OnScreenText";

// CENA 8 — Caos 2: beira do abismo + botões co-op (Block 4 fim). ~8s.
const Scene08Inner: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const cy = height / 2 + 40;

  // Fase A (0-3s): buraco; a corda puxa um player para a beira.
  // Fase B (3-8s): dois botões; pisam juntos; porta abre.
  const phaseB = frame > 3 * fps;

  // Players.
  const pullX = interpolate(frame, [0.4 * fps, 2.4 * fps], [width * 0.4, width * 0.3], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.ease),
  });
  const p1 = phaseB ? { x: width * 0.4, y: cy } : { x: width * 0.6, y: cy };
  const p2 = phaseB ? { x: width * 0.6, y: cy } : { x: pullX, y: cy };

  // Botões pressionados a partir de ~5s.
  const pressed = frame > 5 * fps;
  const doorOpen = interpolate(frame, [5.3 * fps, 6.5 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const Button: React.FC<{ x: number }> = ({ x }) => (
    <div
      style={{
        position: "absolute",
        left: x - 36,
        top: cy + 70,
        width: 72,
        height: 72,
        borderRadius: "50%",
        background: COLORS.bgDarker,
        border: `6px solid #8a7fb0`,
        boxShadow: pressed ? `0 0 24px ${COLORS.btnPressed}` : "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 10,
          borderRadius: "50%",
          background: pressed ? COLORS.btnPressed : COLORS.blue,
        }}
      />
    </div>
  );

  return (
    <AbsoluteFill>
      <DungeonRoom tile={120}>
        <TorchGlow x={width * 0.5} y={height * 0.3} radius={340} />

      {!phaseB && (
        // Buraco/abismo entre os dois.
        <div
          style={{
            position: "absolute",
            left: width * 0.45,
            top: cy - 20,
            width: width * 0.12,
            height: 220,
            background: "radial-gradient(ellipse at center, #000 40%, #0a0710 100%)",
            borderRadius: "50%",
            boxShadow: "inset 0 0 60px #000",
          }}
        />
      )}

      {phaseB && (
        <>
          <Button x={width * 0.4} />
          <Button x={width * 0.6} />
          {/* Porta que abre com glow rosa. */}
          <div
            style={{
              position: "absolute",
              left: width / 2 - 60,
              top: 160,
              width: 120,
              height: 180,
              background: `linear-gradient(180deg, ${COLORS.doorGlow}, #2a2330)`,
              opacity: doorOpen,
              boxShadow: `0 0 40px ${COLORS.doorGlow}`,
              borderRadius: 8,
            }}
          />
        </>
      )}

      <PlayerPair
        p1={p1}
        p2={p2}
        pose1={phaseB ? "walk" : "scared"}
        pose2={phaseB ? "walk" : "scared"}
        size={240}
      />

        <Vignette strength={phaseB ? 0.8 : 0.95} />
        <OnScreenText from={3.5} variant="headline" position="bottom">
          Doors open only together.
        </OnScreenText>
      </DungeonRoom>
    </AbsoluteFill>
  );
};

export const Scene08Chaos2 = Interactive.create({
  Component: Scene08Inner,
  layout: "absolute-fill",
});
