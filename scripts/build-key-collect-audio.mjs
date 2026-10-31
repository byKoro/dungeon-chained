import fs from 'node:fs';

// Som de coleta da chave: arpejo maior subindo (sinos suaves, ataque macio, cauda curta com eco), sem pancada.
// Uso: node scripts/build-key-collect-audio.mjs → assets/audio/key-collect.wav
const sampleRate = 44100, seconds = 1.1;
const notes = [783.99, 987.77, 1174.66, 1567.98];   // G5 B5 D6 G6
const step = 0.075, attack = 0.012;

const bell = (f, t) => {
    if (t < 0) return 0;
    const env = Math.min(1, t / attack) * Math.exp(-t * 5.5);
    // Fundamental + parcial de sino leve + brilho fino, com tremolo curto.
    return env * (Math.sin(2 * Math.PI * f * t)
        + 0.35 * Math.sin(2 * Math.PI * f * 2.01 * t) * Math.exp(-t * 9)
        + 0.12 * Math.sin(2 * Math.PI * f * 3.99 * t) * Math.exp(-t * 16))
        * (1 + 0.08 * Math.sin(2 * Math.PI * 7 * t));
};
const dry = t => notes.reduce((s, f, i) => s + bell(f, t - i * step) * (0.8 + i * 0.07), 0);
// Eco curto (duas reflexões) para não terminar seco.
const voice = t => dry(t) + 0.3 * dry(t - 0.11) + 0.15 * dry(t - 0.23);

const data = Float32Array.from({ length: Math.round(seconds * sampleRate) }, (_, i) => voice(i / sampleRate));
let peak = 0;
for (const v of data) peak = Math.max(peak, Math.abs(v));
const wav = Buffer.alloc(44 + data.length * 2);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28);
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(data.length * 2, 40);
for (let i = 0; i < data.length; i++) {
    const tail = Math.min(1, (data.length - 1 - i) / (sampleRate * 0.15));
    wav.writeInt16LE(Math.round(data[i] / Math.max(peak, 0.0001) * 0.7 * tail * 32767), 44 + i * 2);
}
fs.writeFileSync('assets/audio/key-collect.wav', wav);
console.log(`key-collect: ${seconds}s`);
