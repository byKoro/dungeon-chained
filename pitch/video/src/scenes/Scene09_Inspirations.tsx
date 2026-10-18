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
import { COLORS, FONT_TITLE, FONT_UI } from "../theme";
import { DungeonBg } from "../components/DungeonBg";
import { ChainSaw } from "../components/ChainSaw";

// CENA 9 — Inspirações & valor (Block 5). ~30s. 4 cards de ~7s + fusão.
// Licença: só NOME + valor em texto; sem artwork de terceiros.
const InspCard: React.FC<{ title: string; value: string }> = ({ title, value }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slide = interpolate(frame, [0, 0.6 * fps], [120, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const opacity = interpolate(frame, [0, 0.6 * fps, 6.2 * fps, 7 * fps], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity }}>
      <div
        style={{
          translate: `${slide}px 0px`,
          padding: "60px 90px",
          background: "rgba(13,11,18,0.78)",
          border: `3px solid ${COLORS.sawPink}`,
          borderRadius: 24,
          textAlign: "center",
        }}
      >
        <div style={{ fontFamily: FONT_TITLE, fontSize: 82, fontWeight: 700, color: "#fff", letterSpacing: 2 }}>
          {title}
        </div>
        <div style={{ fontFamily: FONT_UI, fontSize: 48, fontWeight: 700, color: COLORS.amber, marginTop: 18 }}>
          {value}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Scene09Inner: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const cy = height / 2;

  // Fusão final (28-30s): serra única girando + frase.
  const fuseStart = 28 * fps;
  const fuseOp = interpolate(frame, [fuseStart, fuseStart + 0.6 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <DungeonBg torches={[{ x: width * 0.5, y: height * 0.4, radius: 520 }]} vignette={0.85} />

      <Sequence durationInFrames={7 * fps} name="Overcooked">
        <InspCard title="OVERCOOKED" value="Friendly chaos" />
      </Sequence>
      <Sequence from={7 * fps} durationInFrames={7 * fps} name="Isaac">
        <InspCard title="THE BINDING OF ISAAC" value="Procedural runs" />
      </Sequence>
      <Sequence from={14 * fps} durationInFrames={7 * fps} name="It Takes Two">
        <InspCard title="IT TAKES TWO" value="Built for two" />
      </Sequence>
      <Sequence from={21 * fps} durationInFrames={7 * fps} name="Chained Together">
        <InspCard title="CHAINED TOGETHER" value="The bond" />
      </Sequence>

      {frame >= fuseStart && (
        <AbsoluteFill style={{ opacity: fuseOp }}>
          <ChainSaw p1={{ x: width / 2 - 260, y: cy }} p2={{ x: width / 2 + 260, y: cy }} scale={3} glow />
          <div
            style={{
              position: "absolute",
              bottom: 150,
              left: 90,
              right: 90,
              textAlign: "center",
              fontFamily: FONT_UI,
              fontSize: 60,
              fontWeight: 700,
              color: "#fff",
              textShadow: "0 4px 24px rgba(0,0,0,0.9)",
            }}
          >
            We forge all four into one blade.
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

export const Scene09Inspirations = Interactive.create({
  Component: Scene09Inner,
  layout: "absolute-fill",
});
