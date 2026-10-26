// Props animados colocados pelo editor 2.0. Cada frame é um PNG separado de 16 px por tile.
const frames = (folder, prefix, count = 4) =>
    Array.from({ length: count }, (_, i) => `assets/${folder}/${prefix}_${i + 1}.png`);

export const PROP_FRAME_MS = 150;

export const ANIMATED_PROPS = Object.freeze({
    box_1: { label: "Caixa 1", frames: frames("box_1", "box_1"), w: 1, h: 1, solid: true },
    box_2: { label: "Caixa 2", frames: frames("box_2", "box_2"), w: 1, h: 1, solid: true },
    mini_box_1: { label: "Caixa pequena 1", frames: frames("mini_box_1", "mini_box_1"), w: 1, h: 1, solid: true },
    mini_box_2: { label: "Caixa pequena 2", frames: frames("mini_box_2", "mini_box_2"), w: 1, h: 1, solid: true },
    chest: { label: "Baú", frames: frames("chest", "chest"), w: 1, h: 1, solid: true },
    chest_open: { label: "Baú abrindo", frames: frames("chest", "chest_open"), w: 1, h: 1, solid: true, loop: false },
    mini_chest: { label: "Baú pequeno", frames: frames("mini_chest", "mini_chest"), w: 1, h: 1, solid: true },
    mini_chest_open: { label: "Baú pequeno abrindo", frames: frames("mini_chest", "mini_chest_open"), w: 1, h: 1, solid: true, loop: false },
    coin: { label: "Moeda", frames: frames("coin", "coin"), w: 1, h: 1, solid: false },
    flag: { label: "Bandeira", frames: frames("flag", "flag"), w: 1, h: 1, solid: false },
    flasks_1: { label: "Frasco 1", frames: frames("flasks", "flasks_1"), w: 1, h: 1, solid: false },
    flasks_2: { label: "Frasco 2", frames: frames("flasks", "flasks_2"), w: 1, h: 1, solid: false },
    flasks_3: { label: "Frasco 3", frames: frames("flasks", "flasks_3"), w: 1, h: 1, solid: false },
    flasks_4: { label: "Frasco 4", frames: frames("flasks", "flasks_4"), w: 1, h: 1, solid: false },
    key_1: { label: "Chave 1", frames: frames("keys", "keys_1"), w: 1, h: 1, solid: false },
    key_2: { label: "Chave 2", frames: frames("keys", "keys_2"), w: 1, h: 1, solid: false },
    flamethrower_v: { label: "Lança-chamas vertical", frames: frames("flamethrower", "flamethrower_1"), w: 1, h: 2, solid: true },
    flamethrower_h: { label: "Lança-chamas horizontal", frames: frames("flamethrower", "flamethrower_2"), w: 2, h: 1, solid: true }
});

export const ANIMATED_PROP_KEYS = Object.freeze(Object.keys(ANIMATED_PROPS));

// Animações sem loop seguram o último frame por PROP_HOLD_FRAMES antes de reiniciar (só no preview).
export const PROP_HOLD_FRAMES = 6;

export function propFrameIndex(def, ms, frameMs = PROP_FRAME_MS) {
    const n = def.frames.length;
    if (n <= 1) return 0;
    const step = Math.floor(ms / frameMs);
    if (def.loop === false) return Math.min(n - 1, step % (n + PROP_HOLD_FRAMES));
    return step % n;
}
