import { ASSET } from "./theme";
import type { SheetAnim } from "./components/SpriteSheet";

// Presets de animação com os números EXATOS do jogo (js/config/EntityConfig.js).
// Players: fita horizontal, cell 100, 1 linha. Inimigos: grade 8x6, cell 100.

const playerWalk = (src: string): SheetAnim => ({
  src,
  sheetW: 800,
  sheetH: 100,
  cell: 100,
  cropX: 41,
  cropY: 37,
  cropW: 17,
  cropH: 23,
  row: 0,
  frames: 8,
  ticksPerFrame: 6,
  loop: true,
  startFrame: 1, // frames 1..7 = passo (frame 0 = parado)
});

const playerScared = (src: string): SheetAnim => ({
  ...playerWalk(src),
  src,
});

const playerHurt = (src: string): SheetAnim => ({
  src,
  sheetW: 500,
  sheetH: 100,
  cell: 100,
  cropX: 42,
  cropY: 38,
  cropW: 16,
  cropH: 22,
  row: 0,
  frames: 5,
  ticksPerFrame: 6,
  loop: false,
  startFrame: 0,
});

export const PLAYER = {
  p1: {
    walk: playerWalk(ASSET.p1Walk),
    scared: playerScared(ASSET.p1Scared),
    hurt: playerHurt(ASSET.p1Hurt),
    drawHeight: 73,
  },
  p2: {
    walk: playerWalk(ASSET.p2Walk),
    scared: playerScared(ASSET.p2Scared),
    hurt: playerHurt(ASSET.p2Hurt),
    drawHeight: 73,
  },
};

// Inimigos: row 1 = walk (8 frames), row 5 = death (4 frames), deathFlash row0 frame6.
export const DEMON = {
  walk: {
    src: ASSET.demon,
    sheetW: 800,
    sheetH: 600,
    cell: 100,
    cropX: 28,
    cropY: 34,
    cropW: 52,
    cropH: 26,
    row: 1,
    frames: 8,
    ticksPerFrame: 6,
    loop: true,
    startFrame: 0,
  } as SheetAnim,
  death: {
    src: ASSET.demon,
    sheetW: 800,
    sheetH: 600,
    cell: 100,
    cropX: 28,
    cropY: 34,
    cropW: 52,
    cropH: 26,
    row: 5,
    frames: 4,
    ticksPerFrame: 7,
    loop: false,
    startFrame: 0,
  } as SheetAnim,
  drawHeight: 82,
};

export const BLOOD_MONSTER = {
  walk: {
    src: ASSET.bloodMonster,
    sheetW: 800,
    sheetH: 600,
    cell: 100,
    cropX: 36,
    cropY: 30,
    cropW: 48,
    cropH: 30,
    row: 1,
    frames: 8,
    ticksPerFrame: 6,
    loop: true,
    startFrame: 0,
  } as SheetAnim,
  drawHeight: 84,
};
