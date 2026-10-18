import React from "react";
import { Composition } from "remotion";
import { FPS, WIDTH, HEIGHT } from "./theme";
import { PitchVideo, SCENE_SECONDS, TOTAL_SECONDS } from "./PitchVideo";
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

const base = { fps: FPS, width: WIDTH, height: HEIGHT } as const;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Vídeo completo */}
      <Composition
        id="PitchVideo"
        component={PitchVideo}
        durationInFrames={TOTAL_SECONDS * FPS}
        {...base}
      />

      {/* Cenas individuais (para editar/preview isolado no Studio) */}
      <Composition id="S01-Forge" component={Scene01Forge} durationInFrames={SCENE_SECONDS[0] * FPS} {...base} />
      <Composition id="S02-Hela" component={Scene02Hela} durationInFrames={SCENE_SECONDS[1] * FPS} {...base} />
      <Composition id="S03-SawBorn" component={Scene03SawBorn} durationInFrames={SCENE_SECONDS[2] * FPS} {...base} />
      <Composition id="S04-Gameplay" component={Scene04Gameplay} durationInFrames={SCENE_SECONDS[3] * FPS} {...base} />
      <Composition id="S05-Couch" component={Scene05Couch} durationInFrames={SCENE_SECONDS[4] * FPS} {...base} />
      <Composition id="S06-Saw" component={Scene06Saw} durationInFrames={SCENE_SECONDS[5] * FPS} {...base} />
      <Composition id="S07-Chaos1" component={Scene07Chaos1} durationInFrames={SCENE_SECONDS[6] * FPS} {...base} />
      <Composition id="S08-Chaos2" component={Scene08Chaos2} durationInFrames={SCENE_SECONDS[7] * FPS} {...base} />
      <Composition id="S09-Inspirations" component={Scene09Inspirations} durationInFrames={SCENE_SECONDS[8] * FPS} {...base} />
      <Composition id="S10-Business" component={Scene10Business} durationInFrames={SCENE_SECONDS[9] * FPS} {...base} />
      <Composition id="S11-Roadmap" component={Scene11Roadmap} durationInFrames={SCENE_SECONDS[10] * FPS} {...base} />
      <Composition id="S12-CTA" component={Scene12CTA} durationInFrames={SCENE_SECONDS[11] * FPS} {...base} />
    </>
  );
};
