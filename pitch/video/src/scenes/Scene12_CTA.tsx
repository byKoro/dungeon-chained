import React from "react";
import {
  AbsoluteFill,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, FONT_UI } from "../theme";
import { DungeonRoom } from "../components/DungeonRoom";
import { TorchGlow, Vignette, Flash } from "../components/Effects";
import { PlayerPair } from "../components/PlayerPair";
import { GameName } from "../components/GameName";
import { useShake } from "../components/useShake";
import { OnScreenText } from "../components/OnScreenText";

// CENA 12 — Call to Action + Logo (Block 8). ~12s.
const Scene12Inner: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const cy = height / 2 + 40;

  // Fase 1 (0-5s): irmãos de costas encarando porta de luz.
  // Fase 2 (5-10s): logo pleno. Fase 3 (10-12s): CTA.
  const logoStart = 5 * fps;
  const showHeroes = frame < logoStart;
  const logoShake = useShake(logoStart, 18, 12);
  const logoOp = interpolate(frame, [logoStart, logoStart + 0.5 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const p1 = { x: width / 2 - 150, y: cy };
  const p2 = { x: width / 2 + 150, y: cy };

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgDarker }}>
      {showHeroes && (
        <DungeonRoom tile={120}>
          <TorchGlow x={width * 0.5} y={height * 0.3} radius={420} />
          {/* Porta de luz âmbar ao fundo. */}
          <div
            style={{
              position: "absolute",
              left: width / 2 - 110,
              top: 120,
              width: 220,
              height: 320,
              background: `radial-gradient(ellipse at center, ${COLORS.amber} 0%, rgba(255,209,102,0.1) 70%, transparent 100%)`,
              filter: "blur(4px)",
            }}
          />
          <PlayerPair p1={p1} p2={p2} size={300} glow />
          <Vignette strength={0.9} />
          <OnScreenText from={0} until={5} variant="mythic" position="bottom">
            Two brothers. One saw.
          </OnScreenText>
        </DungeonRoom>
      )}

      {frame >= logoStart && (
        <AbsoluteFill
          style={{
            alignItems: "center",
            justifyContent: "center",
            opacity: logoOp,
            translate: logoShake,
          }}
        >
          <GameName />
          {frame >= 10 * fps && (
            <div
              style={{
                marginTop: 50,
                fontFamily: FONT_UI,
                fontSize: 54,
                fontWeight: 700,
                color: "#fff",
                letterSpacing: 1,
                textShadow: "0 2px 16px rgba(0,0,0,0.9)",
              }}
            >
              Wishlist now. Grab a friend.
            </div>
          )}
        </AbsoluteFill>
      )}

      <Flash startFrame={logoStart} durationInFrames={6} />
    </AbsoluteFill>
  );
};

export const Scene12CTA = Interactive.create({
  Component: Scene12Inner,
  layout: "absolute-fill",
});
