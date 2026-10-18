import React from "react";
import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, FONT_UI } from "../theme";
import { OnScreenText } from "../components/OnScreenText";
import { Vignette } from "../components/Effects";

// CENA 10 — Mercado / negócio (Block 6). ~20s. Planos limpos, sem shake.
const TwoCopies: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = interpolate(frame, [0, 0.8 * fps], [0.6, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(1.4)),
    output: "perceptual-scale",
  });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", gap: 60, scale: String(pop), marginTop: -120 }}>
        {[COLORS.amber, COLORS.blue].map((c, i) => (
          <div
            key={i}
            style={{
              width: 200,
              height: 280,
              borderRadius: 18,
              background: `linear-gradient(160deg, ${c}, ${COLORS.bgDark})`,
              border: "4px solid rgba(255,255,255,0.2)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};

const StreamGrid: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 28,
          width: 1100,
          marginTop: -120,
        }}
      >
        {new Array(6).fill(0).map((_, i) => {
          const op = interpolate(frame, [i * 0.2 * fps, i * 0.2 * fps + 0.4 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <div
              key={i}
              style={{
                height: 190,
                borderRadius: 14,
                border: `3px solid ${COLORS.sawPink}`,
                background: "rgba(13,11,18,0.8)",
                opacity: op,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontFamily: FONT_UI,
                fontSize: 24,
                fontWeight: 700,
              }}
            >
              ● LIVE
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const Scene10Inner: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgDarker }}>
      <Sequence durationInFrames={8 * fps} name="Co-op sells in pairs">
        <TwoCopies />
        <OnScreenText from={0} variant="headline" position="bottom">
          Co-op sells in pairs.
        </OnScreenText>
      </Sequence>
      <Sequence from={8 * fps} durationInFrames={6 * fps} name="Streamer growth">
        <StreamGrid />
        <OnScreenText from={0} variant="headline" position="bottom">
          Accessible premium. Streamer-driven growth.
        </OnScreenText>
      </Sequence>
      <Sequence from={14 * fps} durationInFrames={6 * fps} name="Positioning">
        <OnScreenText from={0} variant="headline" position="center">
          Low cost to reach. High reason to share.
        </OnScreenText>
      </Sequence>
      <Vignette strength={0.7} />
    </AbsoluteFill>
  );
};

export const Scene10Business = Interactive.create({
  Component: Scene10Inner,
  layout: "absolute-fill",
});
