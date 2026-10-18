import React from "react";
import { COLORS, FONT_TITLE } from "../theme";

// Logo tipográfico "DUNGEON CHAINED". `seal` = versão pequena de canto.
export const GameName: React.FC<{ seal?: boolean; style?: React.CSSProperties }> = ({
  seal = false,
  style,
}) => {
  if (seal) {
    return (
      <div
        style={{
          fontFamily: FONT_TITLE,
          fontSize: 30,
          fontWeight: 700,
          color: "#fff",
          letterSpacing: 2,
          textShadow: "0 2px 10px rgba(0,0,0,0.9)",
          ...style,
        }}
      >
        DUNGEON<span style={{ color: COLORS.sawPink }}>·</span>CHAINED
      </div>
    );
  }
  return (
    <div style={{ textAlign: "center", ...style }}>
      <div
        style={{
          fontFamily: FONT_TITLE,
          fontSize: 150,
          fontWeight: 700,
          color: "#fff",
          letterSpacing: 6,
          lineHeight: 0.95,
          textShadow: `0 0 30px rgba(0,0,0,0.9), 0 0 60px ${COLORS.sawPink}55`,
        }}
      >
        DUNGEON
      </div>
      <div
        style={{
          fontFamily: FONT_TITLE,
          fontSize: 150,
          fontWeight: 700,
          color: COLORS.sawPink,
          letterSpacing: 6,
          lineHeight: 0.95,
          textShadow: `0 0 40px ${COLORS.sawPink}aa`,
        }}
      >
        CHAINED
      </div>
    </div>
  );
};
