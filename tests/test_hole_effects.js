/**
 * test_hole_effects.js — poeira/pedrinhas dos buracos e recorte do jogador caindo.
 */

import { HoleEffects } from '../js/systems/HoleEffects.js';
import { HOLE_TILE, HOLE_FX, TILE } from '../js/config/GameConfig.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`✅ PASSOU: ${message}`);
        passed++;
    } else {
        console.error(`❌ FALHOU: ${message}`);
        failed++;
    }
}

console.log("=== TESTE DOS EFEITOS DE BURACO ===");

const H = HOLE_TILE, F = 16;
// [row][col]; buraco 2x2 em (2..3, 1..2) e um buraco isolado em (5,3).
const floor = [
    [F, F, F, F, F, F, F],
    [F, F, H, H, F, F, F],
    [F, F, H, H, F, F, F],
    [F, F, F, F, F, H, F],
    [F, F, F, F, F, F, F],
];
const rect = { x: 1000, y: 2000, w: 7 * TILE, h: 5 * TILE };
const rooms = { currentTiles: { floor, rows: 5, cols: 7 }, cellRect: () => rect };
const isHoleWorld = (x, y) => floor[Math.floor((y - rect.y) / TILE)]?.[Math.floor((x - rect.x) / TILE)] === H;
const center = (c, r) => ({ x: rect.x + (c + 0.5) * TILE, y: rect.y + (r + 0.5) * TILE });

const fx = new HoleEffects({ rooms });

// 1. Fontes de poeira: bordas norte e laterais.
fx.update();
assert(fx._holeRects.length === 5, "5 tiles de buraco indexados");
assert(fx._lips.length === 3, "3 bordas norte (2 do buraco grande + 1 do isolado)");
assert(fx._sides.length === 6, "6 bordas laterais");

// 2. Poeira nasce e morre só dentro do buraco; teto de partículas respeitado.
let outside = 0, maxSeen = 0;
for (let i = 0; i < 2000; i++) {
    fx.update();
    maxSeen = Math.max(maxSeen, fx.motes.length);
    for (const m of fx.motes) if (!isHoleWorld(m.x, m.y)) outside++;
}
assert(maxSeen > 0, "Poeira ambiente aparece com o tempo");
assert(outside === 0, "Nenhuma partícula viva fora de um tile de buraco");
assert(maxSeen <= HOLE_FX.maxMotes, `Teto de ${HOLE_FX.maxMotes} partículas respeitado (máx ${maxSeen})`);

// 3. Recorte da queda: colunas da linha, abertas para cima, fechadas na borda sul.
const top = center(2, 1);
const clip = fx._fallClip(top.x, top.y);
assert(clip && clip.length === 2, "Queda em (2,1) recorta as 2 colunas do buraco");
const bottom = rect.y + 3 * TILE;
assert(clip.every(r => r.y + r.h === bottom), "Recorte termina na borda sul do buraco (linha 2)");
assert(clip.every(r => r.y < rect.y + TILE), "Recorte fica aberto acima do buraco (cabeça pode passar da borda norte)");
assert(fx._fallClip(center(0, 0).x, center(0, 0).y) === null, "Fora de buraco não há recorte");
const lone = fx._fallClip(center(5, 3).x, center(5, 3).y);
assert(lone.length === 1 && lone[0].x === rect.x + 5 * TILE && lone[0].w === TILE, "Buraco isolado recorta só a própria coluna");

// 4. Rajada de pedrinhas só uma vez por queda.
const p = { x: top.x, y: top.y, vx: 0, vy: 0, falling: false, fallTimer: 0, fallDuration: 34, fallX: top.x, fallY: top.y };
fx.motes.length = 0;
p.falling = true;
const random = Math.random;
Math.random = () => 0.5;
fx.update([p]);
const afterFirst = fx.motes.filter(m => m.kind === "crumbs").length;
fx.motes.length = 0;
fx.update([p]);
const afterSecond = fx.motes.filter(m => m.kind === "crumbs").length;
Math.random = random;
assert(afterFirst > 0, `Início da queda solta pedrinhas (${afterFirst})`);
assert(afterSecond === 0, "Mesma queda não repete a rajada");

// 5. drawFalling recorta, escurece e restaura o contexto.
const calls = [];
const ctx = {
    filter: "none",
    save: () => calls.push("save"), restore: () => calls.push("restore"),
    beginPath: () => {}, rect: () => calls.push("rect"), clip: () => calls.push("clip"),
    translate: () => {}
};
p.fallTimer = 17;
let filterSeen = null;
p.draw = (c) => { filterSeen = c.filter; calls.push("draw"); };
fx.drawFalling(ctx, p);
assert(calls.join(",") === "save,rect,rect,clip,draw,restore", `Ordem save→clip→draw→restore (${calls.join(",")})`);
assert(/^brightness\(0\.\d+\)$/.test(filterSeen), `Jogador escurece no meio da queda (${filterSeen})`);

// 6. Troca de sala limpa as partículas.
fx.update();
fx.motes.push({ kind: "dust", x: top.x, y: top.y, y0: top.y, vx: 0, vy: 0, life: 50, maxLife: 50, size: 1 });
rooms.currentTiles = { floor: [[F, F], [F, F]], rows: 2, cols: 2 };
fx.update();
assert(fx.motes.length === 0 && fx._holeRects.length === 0, "Sala sem buracos limpa partículas e fontes");

console.log(`\nRESULTADO: ${passed}/${passed + failed} testes passaram.`);
if (failed > 0) process.exit(1);
