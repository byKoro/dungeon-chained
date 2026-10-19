// Testa o mapeamento giro -> som do motor da serra e o controlador.
// Rodar: node tests/test_saw_motor_audio.js
import { motorTargets, SawMotorAudio } from '../js/weapons/SawMotorAudio.js';

let fails = 0, total = 0;
const assert = (cond, msg) => {
    total++;
    if (!cond) { fails++; console.error('FALHOU:', msg); }
};

// Parado = silêncio; a toda = nível cheio, tom original, filtro aberto.
const stop = motorTargets(0);
const full = motorTargets(1);
assert(stop.level === 0, 'serra parada é silenciosa');
assert(Math.abs(full.level - 1) < 1e-9, 'a toda = nível 1');
assert(Math.abs(full.rate - 1) < 1e-9, 'a toda = rate 1 (gravação original)');
assert(full.cutoff > 17000 && stop.cutoff < 800, 'filtro abre com o giro');

// Monotônico: acelerar sobe volume, tom e brilho; parar desce tudo.
let prev = motorTargets(0.03);
for (let s = 0.05; s <= 1.0001; s += 0.05) {
    const t = motorTargets(s);
    assert(t.level > prev.level && t.rate > prev.rate && t.cutoff > prev.cutoff, `monotônico em spin=${s.toFixed(2)}`);
    prev = t;
}

// Meia velocidade fica bem abaixo do cheio (curva perceptual, não linear).
assert(motorTargets(0.5).level < 0.4, 'meio giro < 40% do nível');

// Lâmina largada soa mais distante; fora de jogo, silêncio.
assert(motorTargets(1, { connected: false }).level < full.level, 'dropada mais baixa');
assert(motorTargets(1, { active: false }).level === 0, 'inativo = silêncio');

// Slow-motion baixa o tom.
assert(motorTargets(1, { timeScale: 0.25 }).rate < 0.9, 'slow-mo derruba o tom');

// Controlador: repassa alvos à voz e gera pulsos nos eventos.
class FakeVoice {
    constructor() { this.sets = []; this.pulses = []; }
    set(t, tau) { this.sets.push([t, tau]); }
    pulse(p) { this.pulses.push(p); }
    stop() { this.stopped = true; }
}
let now = 1000;
Object.defineProperty(globalThis, 'performance', { value: { now: () => now }, configurable: true });

const v = new FakeVoice();
const m = new SawMotorAudio(v);
m.update(0.1);
m.onHit();
assert(v.pulses.length === 0, 'sem pulso com a serra quase parada');

m.update(1);
m.onHit();
assert(v.pulses.length === 1 && v.pulses[0].cents < -150, 'acerto a toda: engasgo de tom');
now += 10; m.onHit();
assert(v.pulses.length === 1, 'acertos no mesmo instante viram um pulso');
now += 100; m.onHit();
assert(v.pulses.length === 2, 'acerto seguinte pulsa de novo');

m.update(0.6);
now += 100; m.onHit();
assert(Math.abs(v.pulses[2].cents) < Math.abs(v.pulses[1].cents) * 0.85, 'pulso proporcional ao giro');

m.update(1); m.onSnap();
assert(v.pulses.at(-1).cents < -400, 'ruptura: engasgo forte');

m.update(1, { active: false });
assert(v.sets.at(-1)[0].level === 0 && v.sets.at(-1)[1] > 0.1, 'fora de jogo some suave');

// Sem voz (sem Web Audio/arquivo) nada quebra.
const mute = new SawMotorAudio(null);
mute.update(1); mute.onHit(); mute.onSnap();

console.log(`${total - fails}/${total} ok`);
process.exit(fails ? 1 : 0);
