import React from "react";
import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, FONT_TITLE, FONT_UI } from "../theme";
import { DungeonBg } from "../components/DungeonBg";

// CENA 11 — Roadmap / visão (Block 7). ~20s.
const BULLETS = [
  { t: "Boss fights", at: 6 },
  { t: "Meta-progression", at: 8.5 },
  { t: "More saws & rooms", at: 11 },
  { t: "Content expansions & new maps", at: 13.5 },
];

const Scene11Inner: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const zoom = interpolate(frame, [0, 20 * fps], [1, 1.08], {
    easing: Easing.inOut(Easing.ease),
  });

  // Silhueta de boss surgindo atrás da porta (0-6s).
  const bossRise = interpolate(frame, [0.5 * fps, 5 * fps], [260, 60], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const bossEyeBlink = 0.6 + Math.abs(Math.sin(frame * 0.08)) * 0.4;

  const online = frame > 16 * fps;

  return (
    <AbsoluteFill style={{ scale: String(zoom) }}>
      <DungeonBg torches={[{ x: width * 0.5, y: height * 0.28, radius: 480 }]} vignette={0.88} />

      {/* Boss silhueta. */}
      <div
        style={{
          position: "absolute",
          left: width / 2 - 240,
          top: bossRise,
          width: 480,
          height: 520,
          background: "linear-gradient(180deg, #0a0710, #05040a)",
          clipPath: "polygon(50% 0, 72% 22%, 100% 40%, 82% 70%, 90% 100%, 10% 100%, 18% 70%, 0 40%, 28% 22%)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 140,
            left: 150,
            display: "flex",
            gap: 60,
          }}
        >
          {[0, 1].map((i) => (
            <div
              key={i}
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: COLORS.amber,
                opacity: bossEyeBlink,
                boxShadow: `0 0 24px ${COLORS.amber}`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Títulos e bullets. */}
      <div
        style={{
          position: "absolute",
          top: 80,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: FONT_TITLE,
          fontSize: 44,
          fontWeight: 700,
          color: "#e6e1f0",
          letterSpacing: 3,
          opacity: interpolate(frame, [0, fps], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        PLAYABLE VERTICAL SLICE
      </div>

      <div
        style={{
          position: "absolute",
          left: 120,
          bottom: 120,
          display: "flex",
          flexDirection: "column",
          gap: 22,
        }}
      >
        {BULLETS.map((b, i) => {
          const op = interpolate(frame, [b.at * fps, (b.at + 0.4) * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const slide = interpolate(frame, [b.at * fps, (b.at + 0.4) * fps], [-40, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.cubic),
          });
          return (
            <div
              key={i}
              style={{
                opacity: op,
                translate: `${slide}px 0px`,
                fontFamily: FONT_UI,
                fontSize: 48,
                fontWeight: 700,
                color: "#fff",
                textShadow: "0 2px 12px rgba(0,0,0,0.9)",
              }}
            >
              <span style={{ color: COLORS.sawPink }}>▸ </span>
              {b.t}
            </div>
          );
        })}
        {online && (
          <div
            style={{
              fontFamily: FONT_UI,
              fontSize: 48,
              fontWeight: 700,
              color: COLORS.amber,
              marginTop: 10,
              textShadow: "0 2px 12px rgba(0,0,0,0.9)",
            }}
          >
            ★ One day: online co-op
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

export const Scene11Roadmap = Interactive.create({
  Component: Scene11Inner,
  layout: "absolute-fill",
});
