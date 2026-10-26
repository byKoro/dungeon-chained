import { MenuPad } from '../js/core/MenuPad.js';
import { MENU_PAD } from '../js/config/GameConfig.js';

let passed = 0;
let failed = 0;
function assert(condition, message) {
    if (condition) { console.log(`PASS: ${message}`); passed++; }
    else { console.error(`FAIL: ${message}`); failed++; }
}

const makePad = (index = 0) => ({ index, buttons: Array.from({ length: 17 }, () => ({ pressed: false })), axes: [0, 0, 0, 0] });
const press = (pad, i, v = true) => { pad.buttons[i].pressed = v; };

console.log('=== MenuPad ===');

{
    const pad = makePad();
    press(pad, MENU_PAD.buttons.start);
    const mp = new MenuPad({ getPads: () => [pad] });
    let h = mp.poll(0);
    assert(!h.start && !h.any, 'botão já segurado no 1º poll não dispara');
    h = mp.poll(16);
    assert(!h.start, 'segurar não repete Start');
    press(pad, MENU_PAD.buttons.start, false);
    mp.poll(32);
    press(pad, MENU_PAD.buttons.start);
    h = mp.poll(48);
    assert(h.start && h.any, 'soltar e apertar de novo dispara Start e any');
}

{
    const pad = makePad();
    const mp = new MenuPad({ getPads: () => [pad] });
    mp.poll(0);
    press(pad, 3);
    assert(mp.poll(16).any, 'qualquer botão (Y = 3) dispara any');
    assert(!mp.poll(32).any, 'any só na borda');
}

{
    const pad = makePad();
    const mp = new MenuPad({ getPads: () => [pad] });
    mp.poll(0);
    press(pad, MENU_PAD.buttons.down);
    assert(mp.poll(100).down, 'D-pad baixo dispara na borda');
    assert(!mp.poll(100 + MENU_PAD.repeatDelayMs - 1).down, 'não repete antes do atraso');
    assert(mp.poll(100 + MENU_PAD.repeatDelayMs).down, 'repete depois do atraso');
    assert(!mp.poll(100 + MENU_PAD.repeatDelayMs + MENU_PAD.repeatMs - 1).down, 'respeita o intervalo');
    assert(mp.poll(100 + MENU_PAD.repeatDelayMs + MENU_PAD.repeatMs).down, 'repete no intervalo');
}

{
    const pad = makePad();
    const mp = new MenuPad({ getPads: () => [pad] });
    mp.poll(0);
    pad.axes[0] = 0.9;
    assert(mp.poll(16).right, 'analógico à direita acima do limiar dispara right');
    pad.axes[0] = MENU_PAD.axisThreshold - 0.05;
    mp.poll(32);
    pad.axes[0] = -0.9;
    assert(mp.poll(48).left, 'analógico à esquerda dispara left');
}

{
    const pad = makePad();
    pad.axes[1] = 0.9;
    const mp = new MenuPad({ getPads: () => [pad] });
    mp.poll(0);
    assert(!mp.poll(5000).down, 'direção segurada desde o 1º poll não repete');
}

{
    const p1 = makePad(0), p2 = makePad(1);
    const mp = new MenuPad({ getPads: () => [p1, null, p2] });
    mp.poll(0);
    press(p2, MENU_PAD.buttons.a);
    assert(mp.poll(16).a, 'segundo controle também navega; slots null são ignorados');
}

{
    const mp = new MenuPad({ getPads: () => null });
    mp.poll(0);
    const h = mp.poll(16);
    assert(!h.any && !h.a, 'sem controles não dispara nada');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
