import React from "react";
import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { TILE, ASSET } from "../theme";
import { Camera } from "../components/Camera";
import { RoomWorld, ROOM_W, ROOM_H } from "../components/RoomWorld";
import { TorchGlow, Vignette, Flash } from "../components/Effects";
import { PlayerPair } from "../components/PlayerPair";
import { Prop } from "../components/Prop";
import { SawShatter } from "../components/SawShatter";
import { useShake } from "../components/useShake";

// CENA 1 — Cold open (Block 1). ~6s. Sem texto.
// Preto curto -> sala ilumina -> os dois se aproximam -> a SERRA (grande)
// conecta (shake brusco + caras apavoradas) -> a serra ROMPE e seus pedaços
// se espalham e caem para fora da tela, cortando para a próxima cena.
const Scene01Inner: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // Marcos (s)
  const DARK_END = 0.6;
  const APPROACH_START = 1.6;
  const CONNECT = 3.2; // serra conecta
  const SHATTER = 4.2; // serra rompe e se estilhaça
  const END = 6.0;

  // --- Mundo ---
  const roomCX = ROOM_W / 2;
  const playersY = ROOM_H * 0.55;

  const darkness = interpolate(t, [0, DARK_END, 1.4], [1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.ease),
  });

  // Aproximação (sem serra ainda).
  const spread = interpolate(t, [APPROACH_START, CONNECT], [250, 150], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.ease),
  });
  const moving = t > APPROACH_START && t < CONNECT;

  const connected = t >= CONNECT;
  const scared = t >= CONNECT && t < CONNECT + 1.0;
  const shattered = t >= SHATTER; // a serra rompeu: esconde a inteira, mostra os cacos

  const p1 = { x: roomCX - spread, y: playersY };
  const p2 = { x: roomCX + spread, y: playersY };
  const sawMidY = (p1.y + p2.y) / 2;

  // --- Câmera ---
  // Fecha nos dois ao conectar e dá um leve push-in no rompimento.
  const zoom = interpolate(
    t,
    [0, DARK_END, APPROACH_START, CONNECT, SHATTER, END],
    [3.0, 2.9, 2.3, 2.2, 2.3, 2.6],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.ease),
    },
  );
  const camX = roomCX;
  const camY = playersY - 50;

  // Shake ao conectar E, mais forte, no rompimento.
  const shakeConnect = useShake(CONNECT * fps, 24, 12);
  const shakeShatter = useShake(SHATTER * fps, 36, 16);
  const shake = t >= SHATTER ? shakeShatter : shakeConnect;

  const torchOpacity = 1 - darkness;
  // Escurecimento no fim para cortar/entregar a transição depois dos cacos.
  const fadeOut = interpolate(t, [END - 0.6, END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Camera x={camX} y={camY} zoom={zoom} shake={shake}>
        <RoomWorld doors={{ N: true }} doorOpen={0}>
          {/* Elementos de cenário (props reais, maiores e nas paredes). */}
          <div style={{ opacity: torchOpacity }}>
            {/* Baú grande + moedas: recompensa, canto superior direito. */}
            <Prop frames={ASSET.chest} size={TILE * 1.6} x={ROOM_W - TILE * 2.6} y={TILE * 2.6} fps={4} />
            <Prop frames={ASSET.coin} size={TILE} x={ROOM_W - TILE * 3.6} y={TILE * 2.7} fps={10} />
            <Prop frames={ASSET.coin} size={TILE} x={ROOM_W - TILE * 1.8} y={TILE * 2.8} fps={10} />

            {/* Pilha de caixas/barris encostada na parede esquerda. */}
            <Prop frames={ASSET.box1} size={TILE * 1.5} x={TILE * 2.4} y={TILE * 3.0} fps={0} />
            <Prop frames={ASSET.box2} size={TILE * 1.5} x={TILE * 3.6} y={TILE * 3.0} fps={0} />

            {/* Frascos de poção (vermelho/azul) sobre uma caixa. */}
            <Prop frames={ASSET.flask1} size={TILE} x={TILE * 2.2} y={TILE * 2.2} fps={6} />
            <Prop frames={ASSET.flask2} size={TILE} x={TILE * 3.0} y={TILE * 2.2} fps={6} />
          </div>

          {/* Halos de luz (nas paredes laterais altas, não no chão). */}
          <div style={{ opacity: torchOpacity }}>
            <TorchGlow x={TILE * 1.2} y={TILE * 1.4} radius={260} />
            <TorchGlow x={ROOM_W - TILE * 1.2} y={TILE * 1.4} radius={260} />
          </div>

          <PlayerPair
            p1={p1}
            p2={p2}
            pose1={scared ? "scared" : moving ? "walk" : "idle"}
            pose2={scared ? "scared" : moving ? "walk" : "idle"}
            size={120}
            sawScale={11}
            glow={connected}
            showSaw={connected && !shattered}
          />

          {/* A serra ROMPE: cacos se espalham e caem para fora da tela. */}
          {shattered && (
            <SawShatter
              cx={roomCX}
              cy={sawMidY}
              size={16 * 11}
              startFrame={SHATTER * fps}
              seed={1}
            />
          )}
        </RoomWorld>
      </Camera>

      <Vignette strength={0.9} />
      <Flash startFrame={CONNECT * fps} durationInFrames={6} />
      {/* Flash branco curto no instante do rompimento. */}
      <Flash startFrame={SHATTER * fps} durationInFrames={5} />
      {/* Preto por cima (recua ao iluminar). */}
      <AbsoluteFill style={{ backgroundColor: "#000", opacity: darkness }} />
      {/* Escurecimento final para o corte. */}
      <AbsoluteFill style={{ backgroundColor: "#000", opacity: fadeOut }} />
    </AbsoluteFill>
  );
};

export const Scene01Forge = Interactive.create({
  Component: Scene01Inner,
  layout: "absolute-fill",
});
