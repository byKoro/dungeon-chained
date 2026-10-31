import fs from 'node:fs';

const rate = 44100;
const seconds = 1.6;
const source = fs.readFileSync('assets/audio/saw-snap.wav');
let pcm, channels, sourceRate;
for (let offset = 12; offset + 8 <= source.length;) {
    const size = source.readUInt32LE(offset + 4);
    const chunk = source.toString('ascii', offset, offset + 4);
    if (chunk === 'fmt ') {
        if (source.readUInt16LE(offset + 8) !== 1 || source.readUInt16LE(offset + 22) !== 16) throw new Error('Expected PCM16');
        channels = source.readUInt16LE(offset + 10);
        sourceRate = source.readUInt32LE(offset + 12);
    }
    if (chunk === 'data') pcm = source.subarray(offset + 8, offset + 8 + size);
    offset += 8 + size + size % 2;
}
if (!pcm || !sourceRate || !channels) throw new Error('Invalid saw-snap.wav');
const sample = time => {
    const frame = Math.floor(time * sourceRate);
    if (frame < 0 || (frame + 1) * channels * 2 > pcm.length) return 0;
    let value = 0;
    for (let c = 0; c < channels; c++) value += pcm.readInt16LE((frame * channels + c) * 2) / 32768 / channels;
    return value;
};
const data = new Float32Array(Math.round(seconds * rate));
// Grãos sobrepostos preservam o atrito do cabo sem repetir o ataque da ruptura.
for (let grain = -2; grain < 31; grain++) {
    const start = grain * seconds / 29;
    const speed = 0.6 + 0.12 * Math.sin(grain * 1.73);
    for (let j = 0; j < rate * 0.16; j++) {
        const time = j / rate, at = Math.round((start + time) * rate);
        if (at < 0 || at >= data.length) continue;
        const envelope = Math.sin(Math.PI * time / 0.16) ** 2;
        data[at] += sample(0.07 + (grain % 4 + 4) % 4 * 0.018 + time * speed) * envelope;
    }
}
for (let i = 0; i < data.length; i++) {
    const t = i / rate;
    const rub = 0.58 + 0.26 * Math.sin(2 * Math.PI * 11 * t) + 0.16 * Math.sin(2 * Math.PI * 23 * t);
    const bend = 0.24 * Math.sin(2 * Math.PI * 3.125 * t);
    const metal = Math.sin(2 * Math.PI * 191.25 * t + bend)
        + 0.4 * Math.sin(2 * Math.PI * 466.25 * t + bend * 1.8)
        + 0.22 * Math.sin(2 * Math.PI * 828.75 * t - bend);
    data[i] = data[i] * 0.75 + metal * rub * 0.065;
}
const crossfade = Math.round(rate * 0.045);
for (let i = 0; i < crossfade; i++) {
    const mix = i / (crossfade - 1);
    data[data.length - crossfade + i] = data[data.length - crossfade + i] * (1 - mix) + data[i] * mix;
}
const delta = data.at(-1) - data[0];
for (let i = 0; i < data.length; i++) data[i] -= delta * i / (data.length - 1);
const mean = data.reduce((sum, v) => sum + v, 0) / data.length;
let peak = 0;
for (let i = 0; i < data.length; i++) { data[i] -= mean; peak = Math.max(peak, Math.abs(data[i])); }
const wav = Buffer.alloc(44 + data.length * 2);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28);
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36);
wav.writeUInt32LE(data.length * 2, 40);
for (let i = 0; i < data.length; i++) wav.writeInt16LE(Math.round(data[i] / peak * 0.7 * 32767), 44 + i * 2);
fs.writeFileSync('assets/audio/chain-tension-loop.wav', wav);
console.log('chain-tension-loop.wav: 1.6s, mono PCM16/44100, peak 0.7');
