/**
 * Utilidades de animação compartilhadas pelas cenas do trailer.
 */
export const clamp01 = (v) => Math.max(0, Math.min(1, v));
export const lerp = (a, b, t) => a + (b - a) * t;
// Easings (game feel): suaves no início/fim.
export const easeInOut = (t) => t * t * (3 - 2 * t);   // smoothstep
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);  // easeOutCubic
export const easeIn = (t) => t * t * t;                 // easeInCubic
// Hash determinístico 0..1 (estroboscópios, variações estáveis).
export const hash01 = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
