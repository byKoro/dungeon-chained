import React from "react";
import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, FONT_UI } from "../theme";
import { DungeonRoom } from "../components/DungeonRoom";
import { TorchGlow } from "../components/Effects";
import { PlayerPair } from "../components/PlayerPair";
import { OnScreenText } from "../components/OnScreenText";
import { GameName } from "../components/GameName";

// CENA 5 — Sofá + stream (Block 2 fim). ~6s.
// Esquerda: silhueta de duas pessoas no sofá. Direita: gameplay.
// A partir de 3.5s entra moldura de "webcam" + selo do logo.
const Scene05Inner: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const cy = height / 2 + 40;

  const sway = Math.sin(frame * 0.1) * 40;
  const p1 = { x: width * 0.72 - 130 + sway, y: cy };
  const p2 = { x: width * 0.72 + 130 + sway, y: cy };

  const camIn = interpolate(frame, [3.5 * fps, 4 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill>
      <DungeonRoom tile={120}>
        <TorchGlow x={width * 0.72} y={height * 0.32} radius={320} />
      </DungeonRoom>

      {/* Painel esquerdo: sofá com duas silhuetas. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: width * 0.42,
          height: "100%",
          background: "linear-gradient(180deg, #221c2e 0%, #16111f 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width={520} height={420} viewBox="0 0 520 420">
          {/* Sofá */}
          <rect x={40} y={240} width={440} height={130} rx={30} fill="#3a2f4a" />
          <rect x={20} y={200} width={70} height={170} rx={24} fill="#4a3d5f" />
          <rect x={430} y={200} width={70} height={170} rx={24} fill="#4a3d5f" />
          {/* Duas pessoas */}
          <g fill="#0c0a12">
            <circle cx={190} cy={170} r={48} />
            <rect x={150} y={210} width={80} height={120} rx={28} />
            <circle cx={330} cy={170} r={48} />
            <rect x={290} y={210} width={80} height={120} rx={28} />
          </g>
        </svg>
      </div>

      {/* Gameplay (direita). */}
      <PlayerPair p1={p1} p2={p2} size={230} />

      {/* Moldura de webcam fake + selo do logo. */}
      <div
        style={{
          position: "absolute",
          right: 70,
          bottom: 70,
          width: 320,
          height: 190,
          borderRadius: 16,
          border: `3px solid ${COLORS.sawPink}`,
          background: "rgba(10,8,16,0.75)",
          opacity: camIn,
          scale: String(0.9 + camIn * 0.1),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontFamily: FONT_UI,
          fontSize: 26,
          fontWeight: 700,
        }}
      >
        ● LIVE
      </div>
      <GameName seal style={{ position: "absolute", right: 70, top: 50, opacity: camIn }} />

      <OnScreenText from={0} until={3.5} variant="headline" position="bottom">
        One keyboard. Two friends.
      </OnScreenText>
      <OnScreenText from={3.5} variant="headline" position="bottom">
        Built for friends. Built to go viral.
      </OnScreenText>
    </AbsoluteFill>
  );
};

export const Scene05Couch = Interactive.create({
  Component: Scene05Inner,
  layout: "absolute-fill",
});
