// Paleta e constantes de produção do pitch "Dungeon Chained".
// Cores extraídas do jogo (GameConfig.js / SawWeapon.js).

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const TILE = 64; // tamanho do tile no mundo (como o jogo)
export const ROOM_COLS = 14;
export const ROOM_ROWS = 9;
export const ROOM_W = ROOM_COLS * TILE; // 896
export const ROOM_H = ROOM_ROWS * TILE; // 576

export const COLORS = {
  bgDark: "#1a1622", // ambiente escuro do jogo
  bgDarker: "#0d0b12", // forja / cold open
  amber: "#ffd166", // luz de tocha / P1 amarelo
  blue: "#6bb4db", // P2 azul
  sawPink: "#ff5470", // lâminas da serra
  rope: "#8d99ae", // corda/corrente
  blood: ["#6e0f1c", "#5c0a18", "#4a0612", "#480810", "#3a0510"],
  doorGlow: "#e53170",
  btnPressed: "#54d98b",
};

import { cinzel, rajdhani } from "./fonts";

export const FONT_TITLE = cinzel;
export const FONT_UI = rajdhani;

// Caminhos de asset dentro de public/ (usar com staticFile()).
export const ASSET = {
  p1Walk: "assets/player_01/player_walk.png",
  p1Scared: "assets/player_01/player_walk_scared.png",
  p1Hurt: "assets/player_01/player_hurt.png",
  p2Walk: "assets/player_02/player_walk.png",
  p2Scared: "assets/player_02/player_walk_scared.png",
  p2Hurt: "assets/player_02/player_hurt.png",
  demon: "assets/enemies/demon.png",
  bloodMonster: "assets/enemies/blood_monster.png",
  tileset: "assets/tileset/tileset.png",
  peaks: [
    "assets/peaks/peaks_0.png",
    "assets/peaks/peaks_1.png",
    "assets/peaks/peaks_2.png",
    "assets/peaks/peaks_3.png",
  ],
  torch: [
    "assets/torch/torch_1.png",
    "assets/torch/torch_2.png",
    "assets/torch/torch_3.png",
    "assets/torch/torch_4.png",
  ],
  chestOpen: [
    "assets/chest/chest_open_1.png",
    "assets/chest/chest_open_2.png",
    "assets/chest/chest_open_3.png",
    "assets/chest/chest_open_4.png",
  ],
  chest: [
    "assets/chest/chest_1.png",
    "assets/chest/chest_2.png",
    "assets/chest/chest_3.png",
    "assets/chest/chest_4.png",
  ],
  box1: [
    "assets/box_1/box_1_1.png",
    "assets/box_1/box_1_2.png",
    "assets/box_1/box_1_3.png",
    "assets/box_1/box_1_4.png",
  ],
  box2: [
    "assets/box_2/box_2_1.png",
    "assets/box_2/box_2_2.png",
    "assets/box_2/box_2_3.png",
    "assets/box_2/box_2_4.png",
  ],
  flask1: [
    "assets/flasks/flasks_1_1.png",
    "assets/flasks/flasks_1_2.png",
    "assets/flasks/flasks_1_3.png",
    "assets/flasks/flasks_1_4.png",
  ],
  flask2: [
    "assets/flasks/flasks_2_1.png",
    "assets/flasks/flasks_2_2.png",
    "assets/flasks/flasks_2_3.png",
    "assets/flasks/flasks_2_4.png",
  ],
  coin: [
    "assets/coin/coin_1.png",
    "assets/coin/coin_2.png",
    "assets/coin/coin_3.png",
    "assets/coin/coin_4.png",
  ],
  // Tocha de parede (4 frames de chama).
  wallTorch: [
    "assets/torch/torch_1.png",
    "assets/torch/torch_2.png",
    "assets/torch/torch_3.png",
    "assets/torch/torch_4.png",
  ],
} as const;
