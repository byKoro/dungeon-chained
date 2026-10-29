// Regras de armadilhas compartilhadas entre o jogo (ChallengeCorridor) e o editor 2.0.
// Funções puras, sem DOM.

// Os tiles de parede leste/oeste têm tijolo só na metade interna (a outra metade é sombra).
// A cabeça do lançador fica 15px atrás da origem do sprite (lado da parede) e o centro do tijolo
// está a 18px do centro do tile: o sprite é deslocado 33px (TILE = 64) na direção do disparo.
export const ARROW_HEAD_BACK = 15;
export const WALL_BRICK_CENTER = 18;
export const ARROW_WALL_INSET = ARROW_HEAD_BACK + WALL_BRICK_CENTER;

// Atraso de fase entre espinhos vizinhos de uma fileira (fração do ciclo): é o que cria a onda.
export const SPIKE_ROW_WAVE = 0.12;

const FIRE_FROM_SIDE = {
    top: { x: 0, y: 1 },
    bottom: { x: 0, y: -1 },
    left: { x: 1, y: 0 },
    right: { x: -1, y: 0 }
};

// Direção de disparo (para dentro da sala) a partir do lado da parede.
// Paredes laterais *internas* (editáveis) invertem x: regra herdada do editor 1.0.
export function arrowFireDir(side, interior = false) {
    const base = FIRE_FROM_SIDE[side];
    if (!base) return null;
    const dir = { ...base };
    if (interior && dir.x !== 0) dir.x *= -1;
    return dir;
}

// Deslocamento do lançador em relação ao centro do tile. Só as paredes laterais precisam.
export function arrowMountOffset(dir, inset = ARROW_WALL_INSET) {
    return dir && dir.x !== 0 ? { x: Math.sign(dir.x) * inset, y: 0 } : { x: 0, y: 0 };
}

// Lado da parede conforme o índice do tile (mesma tabela do editor 1.0).
export function wallSideForTile(tile) {
    const id = Number(tile);
    if ((id >= 1 && id <= 4) || (id >= 50 && id <= 55)) return 'top';
    if ([5, 15, 25, 35, 45].includes(id)) return 'left';
    if ([0, 10, 20, 30, 40].includes(id)) return 'right';
    if (id >= 41 && id <= 44) return 'bottom';
    return 'top';
}

export function spikeRowVertical(h) {
    return h.dir === 'up' || h.dir === 'down';
}

// Fase do espinho i da fileira. Para right/down o primeiro tile dispara primeiro e a onda
// anda para frente; para left/up o último tile dispara primeiro (a onda anda para trás).
export function spikeRowPhase(h, i) {
    const wave = h.wave ?? SPIKE_ROW_WAVE;
    const step = (h.dir === 'right' || h.dir === 'down') ? -wave : wave;
    return ((((h.phase || 0) + i * step) % 1) + 1) % 1;
}

// Âncora da fileira: recua para a fileira inteira caber dentro das paredes.
export function fitSpikeRow(cols, rows, col, row, dir, count) {
    const vertical = dir === 'up' || dir === 'down';
    const maxLen = Math.max(1, (vertical ? rows : cols) - 2);
    const length = Math.max(1, Math.min(Math.round(count) || 1, maxLen));
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));
    return vertical
        ? { col: clamp(col, 1, cols - 2), row: clamp(row, 1, rows - 1 - length), count: length }
        : { col: clamp(col, 1, cols - 1 - length), row: clamp(row, 1, rows - 2), count: length };
}
