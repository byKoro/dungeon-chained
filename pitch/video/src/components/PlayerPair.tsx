import React from "react";
import { PLAYER } from "../sprites";
import { SpriteSheet } from "./SpriteSheet";
import { ChainSaw } from "./ChainSaw";

type Pt = { x: number; y: number };
type Pose = "walk" | "scared" | "hurt" | "idle";

const animFor = (player: 1 | 2, pose: Pose) => {
  const p = player === 1 ? PLAYER.p1 : PLAYER.p2;
  if (pose === "scared") return p.scared;
  if (pose === "hurt") return p.hurt;
  return p.walk; // walk e idle usam a folha de caminhada (idle = frame 0 travado)
};

// Frame fixo por pose (hurt = 2 como no jogo; idle = 0 = parado).
const frameOverrideFor = (pose: Pose): number | undefined => {
  if (pose === "hurt") return 2;
  if (pose === "idle") return 0;
  return undefined;
};

// Dois players acorrentados pela serra. `size` = altura do boneco na tela.
export const PlayerPair: React.FC<{
  p1: Pt;
  p2: Pt;
  pose1?: Pose;
  pose2?: Pose;
  size?: number;
  sawScale?: number;
  glow?: boolean;
  flip2?: boolean;
  showSaw?: boolean; // a serra só conecta quando os dois estão próximos
}> = ({
  p1,
  p2,
  pose1 = "walk",
  pose2 = "walk",
  size = 220,
  sawScale = 2.2,
  glow,
  flip2 = true,
  showSaw = true,
}) => {
  const a1 = animFor(1, pose1);
  const a2 = animFor(2, pose2);
  return (
    <>
      {showSaw && <ChainSaw p1={p1} p2={p2} scale={sawScale} glow={glow} />}
      <div style={{ position: "absolute", left: p1.x, top: p1.y, translate: "-50% -75%" }}>
        <SpriteSheet anim={a1} drawHeight={size} frameOverride={frameOverrideFor(pose1)} />
      </div>
      <div style={{ position: "absolute", left: p2.x, top: p2.y, translate: "-50% -75%" }}>
        <SpriteSheet
          anim={a2}
          drawHeight={size}
          flipX={flip2}
          frameOverride={frameOverrideFor(pose2)}
        />
      </div>
    </>
  );
};
