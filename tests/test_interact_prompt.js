import { InteractPrompt, propTargetId } from '../js/systems/InteractPrompt.js';
import { INTERACT_PROMPT as C } from '../js/config/InteractPromptConfig.js';
import { padKind, InputHandler } from '../js/core/InputHandler.js';

let passed = 0;
let failed = 0;
function assert(condition, message) {
    if (condition) { console.log(`✅ PASSOU: ${message}`); passed++; }
    else { console.error(`❌ FALHOU: ${message}`); failed++; }
}

console.log("=== TESTE DO INDICADOR DE INTERAGIR ===");

assert(padKind("Xbox 360 Controller (XInput STANDARD GAMEPAD)") === "xbox", "Xbox pelo nome");
assert(padKind("Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)") === "playstation", "DualShock 4 pelo fabricante Sony");
assert(padKind("DualSense Wireless Controller") === "playstation", "DualSense");
assert(padKind("Controle genérico 1234") === "xbox" && padKind() === "xbox", "controle desconhecido cai no ícone do Xbox");

// InputHandler sem janela: só a lógica de dispositivo.
{
    globalThis.window = { addEventListener() {} };
    const input = new InputHandler();
    delete globalThis.window;
    assert(input.deviceFor(0) === "keyboard" && input.deviceFor(1) === "keyboard", "começa no teclado");
    const pad = (id, pressed) => ({ id, buttons: [{ pressed: false }, { pressed: false }, { pressed }], axes: [0, 0] });
    input.notePadActivity(0, pad("Xbox 360 Controller", false));
    assert(input.deviceFor(0) === "keyboard", "controle parado não troca o ícone");
    input.notePadActivity(0, pad("Xbox 360 Controller", true));
    input.notePadActivity(1, { id: "Wireless Controller 054c", buttons: [], axes: [0.9, 0] });
    assert(input.deviceFor(0) === "xbox" && input.deviceFor(1) === "playstation", "botão ou analógico troca o ícone daquele jogador");
}

const target = { id: "1,1/3,3", x: 200, topY: 100, users: [0], blocked: false };
let targets = [];
let visible = true;
const devices = ["keyboard", "keyboard"];
const prompt = new InteractPrompt({ sources: [() => targets], getDevice: i => devices[i], isVisible: () => visible });

prompt.update(0);
assert(prompt.layout(0).length === 0, "sem alvo no alcance: nada desenhado");

targets = [target];
prompt.update(1000);
const first = prompt.layout(1000)[0];
assert(first && first.scale < 1.01 && first.column === C.columns.keyboardE, "P1 no teclado: ícone E");
const settled = prompt.layout(1000 + C.popMs + 1)[0];
assert(settled.scale === 1, "depois da entrada o ícone assenta no tamanho cheio");
assert(settled.y < target.topY && settled.y > target.topY - 200, "fica acima do topo do objeto");

targets = [{ ...target, users: [1] }];
const p2 = prompt.layout(1000 + C.popMs + 1)[0];
assert(p2.column === C.columns.keyboardShift, "P2 no teclado: ícone ⇧");

devices[1] = "playstation";
assert(prompt.layout(1000 + C.popMs + 1)[0].column === C.columns.playstation, "P2 com DualShock: ícone do quadrado");
devices[0] = "xbox";

targets = [{ ...target, users: [0, 1] }];
const P = C.pulsePeriodMs, base = Math.ceil(2000 / (2 * P)) * 2 * P;
const pairA = prompt.layout(base), pairB = prompt.layout(base + P);
assert(pairA.length === 1 && pairA[0].x === target.x, "dois jogadores perto: um medalhão só, centrado no objeto");
assert(pairA[0].column === C.columns.xbox && pairB[0].column === C.columns.playstation, "botões diferentes: alterna a cada pulso");
devices[1] = "xbox";
assert(prompt.layout(base)[0].column === C.columns.xbox && prompt.layout(base + P)[0].column === C.columns.xbox, "mesmo botão: fica fixo");
devices[1] = "playstation";
targets = [target];

const t0 = base;
const frames = new Set([prompt.layout(t0)[0].column, prompt.layout(t0 + C.pulsePeriodMs / 2)[0].column]);
assert(frames.size === 2, "alterna entre os quadros normal e pressionado");

targets = [{ ...target, blocked: true }];
const blocked = prompt.layout(t0)[0];
assert(blocked.blocked && blocked.alpha < 1 && blocked.column === C.columns.xbox, "bloqueado: escurecido, sem quadro pressionado");

visible = false;
assert(prompt.layout(t0).length === 0, "oculto durante o menu da bigorna e cinemáticas");
visible = true;

targets = [];
prompt.update(5000);
targets = [target];
prompt.update(6000);
assert(prompt.layout(6000)[0].scale < 1.01, "sair do alcance e voltar repete a entrada");

// Borda branca do prop: acende em alguns steps no alcance e apaga devagar ao sair.
{
    const O = C.outline;
    const glow = new InteractPrompt({ sources: [() => targets], getDevice: () => "keyboard", isVisible: () => visible });
    targets = [];
    glow.update(0);
    assert(glow.outlineFor(target.id) === null, "fora do alcance: sem borda");
    targets = [target];
    glow.update(16);
    const a1 = glow.outlineFor(target.id).alpha;
    for (let i = 0; i < O.fadeInSteps; i++) glow.update(16 * (i + 2));
    const full = glow.outlineFor(target.id);
    assert(a1 > 0 && a1 < 1 && full.alpha === 1 && full.color === O.color, "entra no alcance: borda acende até o cheio");
    targets = [];
    glow.update(500);
    const fading = glow.outlineFor(target.id)?.alpha ?? 0;
    for (let i = 0; i < O.fadeOutSteps; i++) glow.update(500 + 16 * i);
    assert(fading > 0 && fading < 1 && glow.outlineFor(target.id) === null, "sai do alcance: apaga aos poucos e some");
    targets = [{ ...target, blocked: true }];
    for (let i = 0; i <= O.fadeInSteps; i++) glow.update(900 + 16 * i);
    assert(glow.outlineFor(target.id).alpha === C.blockedAlpha, "bigorna bloqueada: borda na mesma transparência do ícone");
    visible = false;
    assert(glow.outlineFor(target.id) === null, "menu da bigorna ou cinemática: sem borda");
    visible = true;
}
assert(propTargetId("1,1", { col: 24, row: 26 }) === "1,1/24,26", "id do alvo = sala + tile do prop");

console.log(`\nResultados: ${passed} passaram, ${failed} falharam.`);
if (failed > 0) process.exit(1);
