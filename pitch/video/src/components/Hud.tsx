import React from "react";
import { FONT_UI, COLORS } from "../theme";

// HUD de jogo: andar + vidas de P1 (amarelo) e P2 (azul).
export const Hud: React.FC<{
  floor?: string;
  p1Lives?: number;
  p2Lives?: number;
}> = ({ floor = "DUNGEON — FLOOR 1", p1Lives = 3, p2Lives = 3 }) => {
  const hearts = (n: number) => "❤️".repeat(Math.max(0, n));
  return (
    <div
      style={{
        position: "absolute",
        top: 40,
        left: 60,
        right: 60,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontFamily: FONT_UI,
        fontSize: 34,
        fontWeight: 700,
        textShadow: "0 2px 8px rgba(0,0,0,0.9)",
      }}
    >
      <span style={{ color: "#e6e1f0", letterSpacing: 1 }}>{floor}</span>
      <span style={{ display: "flex", gap: 40 }}>
        <span style={{ color: COLORS.amber }}>P1 {hearts(p1Lives)}</span>
        <span style={{ color: COLORS.blue }}>P2 {hearts(p2Lives)}</span>
      </span>
    </div>
  );
};
