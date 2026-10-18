import React from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_TITLE, FONT_UI } from "../theme";

// Texto de tela (sempre em inglês) com fade-in e saída opcional.
// Respeita a safe area de vídeo (margens generosas).
export const OnScreenText: React.FC<{
  children: React.ReactNode;
  from?: number; // segundos
  until?: number; // segundos (opcional, para sumir)
  variant?: "headline" | "support" | "mythic";
  position?: "center" | "bottom" | "top";
  style?: React.CSSProperties;
}> = ({ children, from = 0, until, variant = "support", position = "bottom", style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = from * fps;

  const opacityIn = interpolate(frame, [start, start + 0.5 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const opacityOut = until
    ? interpolate(frame, [until * fps - 0.3 * fps, until * fps], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;
  const opacity = Math.min(opacityIn, opacityOut);

  const sizes = { headline: 96, support: 52, mythic: 76 };
  const fonts = {
    headline: FONT_UI,
    support: FONT_UI,
    mythic: FONT_TITLE,
  };
  const vpos: React.CSSProperties =
    position === "center"
      ? { top: 0, bottom: 0, alignItems: "center" }
      : position === "top"
        ? { top: 100 }
        : { bottom: 110 };

  return (
    <div
      style={{
        position: "absolute",
        left: 90,
        right: 90,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        textAlign: "center",
        opacity,
        ...vpos,
      }}
    >
      <div
        style={{
          fontFamily: fonts[variant],
          fontSize: sizes[variant],
          fontWeight: variant === "mythic" ? 700 : 800,
          color: "#ffffff",
          letterSpacing: variant === "mythic" ? 2 : 0.5,
          textShadow: "0 4px 24px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.9)",
          lineHeight: 1.1,
          ...style,
        }}
      >
        {children}
      </div>
    </div>
  );
};
