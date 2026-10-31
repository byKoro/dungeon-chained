import { SawForgeCinematic } from '../js/systems/SawForgeCinematic.js';
import { SAW_CINEMATIC as C } from '../js/config/ForgeConfig.js';
import { Player } from '../js/entities/Player.js';

let passed = 0;
let failed = 0;
function assert(condition, message) {
    if (condition) { console.log(`✅ PASSOU: ${message}`); passed++; }
    else { console.error(`❌ FALHOU: ${message}`); failed++; }
}

console.log("=== TESTE DA CINEMÁTICA DA SERRA ===");

const DT = 1 / 60;
const anvil = { x: 100, y: 200 };
const box = { x: 76, y: 208, w: 64, h: 24 };

function run({ players = [], maxSteps = 60 * 8 } = {}) {
    const shakes = [], sounds = [], ended = [], poses = [];
    const camera = { focus: null };
    const cin = new SawForgeCinematic({
        renderer: { triggerShake: a => shakes.push(a) },
        particleSystem: { triggerSparkBurst() {}, triggerFlash() {} },
        audio: { play: c => sounds.push(c) },
        camera, getWeapon: () => null, getPlayers: () => players, getAnvilBox: () => box,
        onEnd: a => ended.push({ anvil: a, players: players.map(p => ({ x: p.x, y: p.y, facingLeft: p.facingLeft, autoMove: p.autoMove })) })
    });
    cin.start(anvil);
    const startFocus = camera.focus;
    let maxLetterbox = 0, maxJump = 0, minSy = 1, firstHitT = null, lastPose = null, crossed = false;
    for (let i = 0; i < maxSteps && cin.active; i++) {
        cin.update(DT);
        if (firstHitT === null && sounds.includes("forgeHammer")) firstHitT = cin.t;
        maxLetterbox = Math.max(maxLetterbox, cin.letterbox);
        for (const p of players) {
            const fx = p.x, fy = p.y + 14;
            if (fx > box.x + 2 && fx < box.x + box.w - 2 && fy > box.y + 2 && fy < box.y + box.h - 2) crossed = true;
        }
        const pose = cin.sawPose();
        if (pose) { poses.push(pose); lastPose = pose; maxJump = Math.max(maxJump, cin.anvilTop.y - pose.y); minSy = Math.min(minSy, pose.sy); }
    }
    return { cin, camera, startFocus, shakes, sounds, ended, poses, maxLetterbox, maxJump, minSy, firstHitT, lastPose, crossed };
}

const r = run();
assert(r.startFocus?.x === 100 && r.startFocus.zoom === C.zoom, "começa com a câmera focada na bigorna");
assert(r.sounds.filter(s => s === "forgeHammer").length === 3, "três marteladas");
assert(r.shakes[0] < r.shakes[1] && r.shakes[1] < r.shakes[2], `shake crescente (${r.shakes.slice(0, 3).join(", ")})`);
assert(r.sounds.includes("sawLand"), "a serra pousa com som");
assert(r.maxLetterbox === 1, "letterbox entra por inteiro");
assert(r.maxJump > C.jumpHeight * 0.95, `a serra salta (${r.maxJump.toFixed(0)} px)`);
assert(r.minSy < 0.85, "squash ao pousar");
assert(r.poses.every(p => !("glow" in p)), "a serra nasce sem o brilho circular");
assert(!r.cin.active && r.ended.length === 1 && r.ended[0].anvil === anvil && r.camera.focus === null, "termina uma vez, devolve a câmera");
assert(r.cin.letterbox === 0 && r.cin.sawPose() === null, "nada desenhado depois do fim");

// Os dois começam do mesmo lado (esquerda, um na frente e outro atrás da bigorna): cada um vai para um lado.
const a = new Player(30, 230, "#ff0", ["w", "s", "a", "d", "q"], null, "Amarelo");
const b = new Player(60, 150, "#00f", ["i", "k", "j", "l", "u"], null, "Azul");
const w = run({ players: [a, b] });
const [endA, endB] = w.ended[0]?.players ?? [];
assert(w.firstHitT !== null && w.firstHitT > C.hits[0] + 0.3, `as marteladas só começam depois da caminhada (${w.firstHitT?.toFixed(2)} s)`);
assert(endA && endB && endA.x < box.x && endB.x > box.x + box.w, `um de cada lado (${endA?.x.toFixed(0)} / ${endB?.x.toFixed(0)})`);
assert(endA && endB && endA.y + 14 > box.y + box.h && endB.y + 14 > box.y + box.h, "param um pouco à frente da base");
assert(Math.abs(endA.x - anvil.x + (endB.x - anvil.x)) < 6, "simétricos em volta da bigorna");
assert(!endA.facingLeft && endB.facingLeft, "viram para a bigorna");
assert(!w.crossed, "ninguém atravessa a base da bigorna");
assert(!a.autoMove && !b.autoMove, "o controle volta aos jogadores no fim");
const mid = { x: (endA.x + endB.x) / 2, y: (endA.y + endB.y) / 2 };
assert(w.lastPose && Math.hypot(w.lastPose.x - mid.x, w.lastPose.y - mid.y) < 3, "a serra termina no meio dos dois (onde conecta)");

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
