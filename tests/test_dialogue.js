import { DialogueSystem } from '../js/systems/DialogueSystem.js';
import { DIALOGUE } from '../js/config/DialogueConfig.js';

let passed = 0;
let failed = 0;
function assert(condition, message) {
    if (condition) { console.log(`✅ PASSOU: ${message}`); passed++; }
    else { console.error(`❌ FALHOU: ${message}`); failed++; }
}

console.log("=== TESTE DAS FALAS ===");

// As falas estão desligadas no jogo (DIALOGUE.enabled = false); o teste liga só para exercitar o sistema.
const TALKING = { ...DIALOGUE, enabled: true };

const DT = 1 / 60;
const held = new Set();
const input = { isDown: k => held.has(k) };
const blips = [];
const starts = [];
const audio = { play: (cue, opts) => blips.push({ cue, rate: opts.rateMultiplier }) };
const p1 = { x: 0, y: 0 }, p2 = { x: 0, y: 0 };
const d = new DialogueSystem({
    getPlayers: () => [p1, p2], input, audio, cfg: TALKING,
    onLineStart: (i, expr, dur) => starts.push({ i, expr, dur }),
    translate: key => ({ a: "Que lugar é esse?", b: "Tem algo ali." })[key] ?? key
});
const steps = (n) => { for (let i = 0; i < n; i++) d.update(DT); };

assert(d.say(0, "a") && d.say(p2, "b") && d.queue.length === 2, "enfileira por índice ou pelo Player");
assert(!d.say({}, "a"), "recusa quem não é jogador");

steps(1);
assert(d.line?.index === 0 && starts[0]?.i === 0 && starts[0].expr === DIALOGUE.defaultExpr, "primeira fala começa e avisa o HUD");
steps(10);
const shown = d.line.shown;
assert(shown > 0 && shown < d.line.text.length, `texto entra letra a letra (${shown} letras)`);
assert(blips.length > 0 && blips.every(b => b.cue === "voiceBlip" && b.rate > 0.85 && b.rate < 1), "blip do Amarelo num tom próprio");

const blipsBeforeSkip = blips.length;
held.add("shiftright"); steps(1); held.delete("shiftright");
assert(d.line.typed && d.line.shown === d.line.text.length, "interagir completa o texto");
assert(blips.length === blipsBeforeSkip, "completar o texto não dispara os blips restantes de uma vez");
held.add("e"); steps(1); held.delete("e");
steps(Math.ceil(DIALOGUE.gapSeconds / DT) + 2);
assert(d.line?.index === 1, "interagir de novo passa para a próxima fala");
const before = blips.length;
steps(20);
assert(blips.slice(before).every(b => b.rate > 1.1), "blip do Azul num tom mais agudo");

steps(60 * 10);
assert(!d.active && starts.length === 2, "falas acabam sozinhas pelo tempo");

held.add("e");
const d2 = new DialogueSystem({ getPlayers: () => [p1, p2], input, cfg: TALKING, translate: k => k });
d2.say(0, "uma fala longa para testar");
for (let i = 0; i < 5; i++) d2.update(DT);
assert(!d2.line.typed, "tecla já segurada no início não pula a fala");
held.clear();

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
