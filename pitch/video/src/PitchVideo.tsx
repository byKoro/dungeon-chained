import React from "react";
import { Track, useVideoConfig } from "remotion";
import { Scene01Forge } from "./scenes/Scene01_Forge";
import { Scene02Hela } from "./scenes/Scene02_Hela";
import { Scene03SawBorn } from "./scenes/Scene03_SawBorn";
import { Scene04Gameplay } from "./scenes/Scene04_Gameplay";
import { Scene05Couch } from "./scenes/Scene05_Couch";
import { Scene06Saw } from "./scenes/Scene06_Saw";
import { Scene07Chaos1 } from "./scenes/Scene07_Chaos1";
import { Scene08Chaos2 } from "./scenes/Scene08_Chaos2";
import { Scene09Inspirations } from "./scenes/Scene09_Inspirations";
import { Scene10Business } from "./scenes/Scene10_Business";
import { Scene11Roadmap } from "./scenes/Scene11_Roadmap";
import { Scene12CTA } from "./scenes/Scene12_CTA";

// Durações por cena (segundos), casando com o shot list 03-remotion-shotlist.md.
export const SCENE_SECONDS = [6, 5, 4, 8, 6, 10, 7, 8, 30, 20, 20, 12];
export const TOTAL_SECONDS = SCENE_SECONDS.reduce((a, b) => a + b, 0); // 136s

// Vídeo completo: 12 cenas sucessivas numa Track. Cada cena é editável no Studio.
export const PitchVideo: React.FC = () => {
  const { fps } = useVideoConfig();
  const s = (n: number) => n * fps;
  let acc = 0;
  const from = (i: number) => {
    const start = acc;
    acc += s(SCENE_SECONDS[i]);
    return start;
  };

  return (
    <Track name="Pitch">
      <Scene01Forge name="1 · Forge" from={from(0)} durationInFrames={s(6)} />
      <Scene02Hela name="2 · Hela" from={from(1)} durationInFrames={s(5)} />
      <Scene03SawBorn name="3 · Saw is born" from={from(2)} durationInFrames={s(4)} />
      <Scene04Gameplay name="4 · Gameplay" from={from(3)} durationInFrames={s(8)} />
      <Scene05Couch name="5 · Couch + stream" from={from(4)} durationInFrames={s(6)} />
      <Scene06Saw name="6 · The saw" from={from(5)} durationInFrames={s(10)} />
      <Scene07Chaos1 name="7 · Chaos: spikes" from={from(6)} durationInFrames={s(7)} />
      <Scene08Chaos2 name="8 · Chaos: co-op doors" from={from(7)} durationInFrames={s(8)} />
      <Scene09Inspirations name="9 · Inspirations" from={from(8)} durationInFrames={s(30)} />
      <Scene10Business name="10 · Business" from={from(9)} durationInFrames={s(20)} />
      <Scene11Roadmap name="11 · Roadmap" from={from(10)} durationInFrames={s(20)} />
      <Scene12CTA name="12 · CTA + logo" from={from(11)} durationInFrames={s(12)} />
    </Track>
  );
};
