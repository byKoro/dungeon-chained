// Props animados colocados pelo editor 2.0. Cada frame é um PNG separado de 16 px por tile.
const frames = (folder, prefix, count = 4) =>
    Array.from({ length: count }, (_, i) => `assets/${folder}/${prefix}_${i + 1}.png`);

export const PROP_FRAME_MS = 150;

// `base` = pegada no chão, em pixels de arte a partir do canto do sprite desenhado. Com `base` o prop colide
// (só pelos pés de quem anda) e entra na ordenação por y com as entidades. `opens` = baú que abre por proximidade.
const CHEST_BASE = Object.freeze({ x: 1, y: 8, w: 14, h: 6 });
const MINI_CHEST_BASE = Object.freeze({ x: 3, y: 9, w: 10, h: 5 });
// Pegada no chão dos props sólidos sem arte própria (desenhados no tile de 16 px). Com `base` eles passam
// a colidir pelos pés e a ordenar por y com as entidades, em vez de ficarem na camada do chão (bug do "tapete").
const BOX_BASE = Object.freeze({ x: 2, y: 9, w: 12, h: 6 });
const MINI_BOX_BASE = Object.freeze({ x: 3, y: 10, w: 10, h: 5 });
// Lança-chamas são multi-tile: o footprint é w*16 × h*16 px de arte. Os pés ficam no tile de baixo.
const FLAME_V_BASE = Object.freeze({ x: 3, y: 24, w: 10, h: 6 });
const FLAME_H_BASE = Object.freeze({ x: 6, y: 9, w: 20, h: 6 });

export const PROP_COLLISION = Object.freeze({ footRadius: 10 });

export const ANIMATED_PROPS = Object.freeze({
    box_1: { label: "Caixa 1", frames: frames("box_1", "box_1"), w: 1, h: 1, solid: true, base: BOX_BASE },
    box_2: { label: "Caixa 2", frames: frames("box_2", "box_2"), w: 1, h: 1, solid: true, base: BOX_BASE },
    mini_box_1: { label: "Caixa pequena 1", frames: frames("mini_box_1", "mini_box_1"), w: 1, h: 1, solid: true, base: MINI_BOX_BASE },
    mini_box_2: { label: "Caixa pequena 2", frames: frames("mini_box_2", "mini_box_2"), w: 1, h: 1, solid: true, base: MINI_BOX_BASE },
    chest: { label: "Baú", frames: frames("chest", "chest"), w: 1, h: 1, solid: true, base: CHEST_BASE, opens: "chest_open" },
    chest_open: { label: "Baú abrindo", frames: frames("chest", "chest_open"), w: 1, h: 1, solid: true, loop: false, base: CHEST_BASE },
    mini_chest: { label: "Baú pequeno", frames: frames("mini_chest", "mini_chest"), w: 1, h: 1, solid: true, base: MINI_CHEST_BASE, opens: "mini_chest_open" },
    mini_chest_open: { label: "Baú pequeno abrindo", frames: frames("mini_chest", "mini_chest_open"), w: 1, h: 1, solid: true, loop: false, base: MINI_CHEST_BASE },
    coin: { label: "Moeda", frames: frames("coin", "coin"), w: 1, h: 1, solid: false },
    flag: { label: "Bandeira", frames: frames("flag", "flag"), w: 1, h: 1, solid: false },
    flasks_1: { label: "Frasco 1", frames: frames("flasks", "flasks_1"), w: 1, h: 1, solid: false },
    flasks_2: { label: "Frasco 2", frames: frames("flasks", "flasks_2"), w: 1, h: 1, solid: false },
    flasks_3: { label: "Frasco 3", frames: frames("flasks", "flasks_3"), w: 1, h: 1, solid: false },
    flasks_4: { label: "Frasco 4", frames: frames("flasks", "flasks_4"), w: 1, h: 1, solid: false },
    key_1: { label: "Chave 1", frames: frames("keys", "keys_1"), w: 1, h: 1, solid: false },
    key_2: { label: "Chave 2", frames: frames("keys", "keys_2"), w: 1, h: 1, solid: false },
    flamethrower_v: { label: "Lança-chamas vertical", frames: frames("flamethrower", "flamethrower_1"), w: 1, h: 2, solid: true, base: FLAME_V_BASE },
    flamethrower_h: { label: "Lança-chamas horizontal", frames: frames("flamethrower", "flamethrower_2"), w: 2, h: 1, solid: true, base: FLAME_H_BASE },
    // `art` = tamanho do PNG em pixels de arte; o sprite é desenhado nesse tamanho, centrado no footprint, sem esticar.
    anvil: { label: "Bigorna", frames: ["assets/anvil/anvil.png"], w: 2, h: 1, solid: true, art: { w: 24, h: 24 }, base: { x: 6, y: 14, w: 16, h: 6 } },
    sleipnir: { label: "Sleipnir (16×16)", frames: ["assets/items/sleipnir.png"], w: 1, h: 1, solid: false, art: { w: 16, h: 16 } },
    sleipnir_concept: { label: "Sleipnir (conceito)", frames: ["assets/items/sleipnir_concept.png"], w: 1, h: 1, solid: false, art: { w: 32, h: 32 } },
    sleipnir_horseshoe: {
        label: "Ferradura alada (Sleipnir)",
        frames: Array.from({ length: 8 }, (_, i) => `assets/items/sleipnir_horseshoe_${i + 1}.png`),
        w: 1, h: 1, solid: false, art: { w: 16, h: 16 },
        motion: { type: "float", floatMs: 1200, floatPx: 1.5 }
    },
    sleipnir_horseshoe_native: {
        label: "Ferradura alada (32×32)",
        frames: Array.from({ length: 8 }, (_, i) => `assets/items/sleipnir_horseshoe_native_${i + 1}.png`),
        w: 1, h: 1, solid: false, art: { w: 32, h: 32 },
        motion: { type: "float", floatMs: 1200, floatPx: 1.5 }
    },
    sleipnir_horseshoe_redesign: {
        label: "Ferradura alada redesenhada (16×16)",
        frames: ["assets/items/sleipnir_horseshoe_16_redesign.png"],
        w: 1, h: 1, solid: false, art: { w: 16, h: 16 },
        motion: { type: "float", floatMs: 1200, floatPx: 1.5 }
    }
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
