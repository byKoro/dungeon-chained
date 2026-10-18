import { random, useCurrentFrame } from "remotion";

// Screen shake: devolve um translate string decaindo a partir de startFrame.
export const useShake = (
  startFrame: number,
  amount = 12,
  durationInFrames = 10,
): string => {
  const frame = useCurrentFrame();
  const t = frame - startFrame;
  if (t < 0 || t > durationInFrames) return "0px 0px";
  const decay = 1 - t / durationInFrames;
  const dx = (random(`shake-x-${frame}`) - 0.5) * 2 * amount * decay;
  const dy = (random(`shake-y-${frame}`) - 0.5) * 2 * amount * decay;
  return `${dx}px ${dy}px`;
};
