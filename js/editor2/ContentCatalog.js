import { ENEMY_TYPES } from '../config/EntityConfig.js';

// Inimigos liberados no editor 2.0. Acrescente a chave aqui quando um inimigo ficar pronto.
// Salas antigas com outros tipos continuam sendo desenhadas e podem ser apagadas.
export const EDITOR2_ENEMY_KEYS = ['demon', 'bloodMonster', 'blackKnightB', 'cultist', 'flameGolem'];

export function editorEnemyTypes() {
    return EDITOR2_ENEMY_KEYS.map(key => ENEMY_TYPES.find(t => t.key === key)).filter(Boolean);
}

// Recorte do frame 0 da animação "walk" usado nas miniaturas (mesma regra do editor 1.0).
export function thumbRegion(cfg) {
    const r = cfg.body || { x: cfg.cropX, y: cfg.cropY, w: cfg.cropW, h: cfg.cropH };
    return { sx: r.x, sy: (cfg.rows.walk?.row || 0) * cfg.cellSize + r.y, w: r.w, h: r.h };
}
