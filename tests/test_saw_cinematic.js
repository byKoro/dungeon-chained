import { SawForgeCinematic } from '../js/systems/SawForgeCinematic.js';
import { SAW_CINEMATIC as C } from '../js/config/ForgeConfig.js';

let passed = 0;
let failed = 0;
function assert(condition, message) {
    if (condition) { console.log(`✅ PASSOU: ${message}`); passed++; }
    else { console.error(`❌ FALHOU: ${message}`); failed++; }
}

console.log("=== TESTE DA CINEMÁTICA DA SERRA ===");

const shakes = [], sounds = [], ended = [];
const camera = { focus: null };
const cin = new SawForgeCinematic({
    renderer: { triggerShake: a => shakes.push(a) },
    particleSystem: { triggerSparkBurst() {}, triggerFlash() {} },
    audio: { play: c => sounds.push(c) },
    camera, getWeapon: () => null, onEnd: a => ended.push(a)
});
const anvil = { x: 100, y: 200 };
cin.start(anvil);
assert(cin.active && camera.focus?.x === 100 && camera.focus.zoom === C.zoom, "começa com a câmera focada na bigorna");

const DT = 1 / 60;
let maxLetterbox = 0, maxJump = 0, minSy = 1;
for (let i = 0; i < 60 * 5 && cin.active; i++) {
    cin.update(DT);
    maxLetterbox = Math.max(maxLetterbox, cin.letterbox);
    const pose = cin.sawPose();
    if (pose) { maxJump = Math.max(maxJump, cin.anvilTop.y - pose.y); minSy = Math.min(minSy, pose.sy); }
}
assert(sounds.filter(s => s === "forgeHammer").length === 3, "três marteladas");
assert(shakes[0] < shakes[1] && shakes[1] < shakes[2], `shake crescente (${shakes.slice(0, 3).join(", ")})`);
assert(sounds.includes("sawLand"), "a serra pousa com som");
assert(maxLetterbox === 1, "letterbox entra por inteiro");
assert(maxJump > C.jumpHeight * 0.95, `a serra salta (${maxJump.toFixed(0)} px)`);
assert(minSy < 0.85, "squash ao pousar");
assert(!cin.active && ended.length === 1 && ended[0] === anvil && camera.focus === null, "termina uma vez, devolve a câmera");
assert(cin.letterbox === 0 && cin.sawPose() === null, "nada desenhado depois do fim");

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
