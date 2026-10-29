import fs from 'node:fs';

const sampleRate = 44100;
const base = 'assets/audio/';
function read(name) {
    const buffer = fs.readFileSync(base + name + '.wav');
    let data;
    for (let offset = 12; offset + 8 <= buffer.length;) {
        const size = buffer.readUInt32LE(offset + 4), type = buffer.toString('ascii', offset, offset + 4);
        if (type === 'fmt ' && (buffer.readUInt16LE(offset + 8) !== 1 || buffer.readUInt16LE(offset + 10) !== 1
            || buffer.readUInt32LE(offset + 12) !== sampleRate || buffer.readUInt16LE(offset + 22) !== 16)) {
            throw new Error(`Expected mono PCM16/44100: ${name}`);
        }
        if (type === 'data') data = buffer.subarray(offset + 8, offset + 8 + size);
        offset += 8 + size + size % 2;
    }
    if (!data) throw new Error(`Missing PCM: ${name}`);
    return Float32Array.from({ length: data.length / 2 }, (_, i) => data.readInt16LE(i * 2) / 32768);
}
function sample(data, time) {
    const index = time * sampleRate, i = Math.floor(index), t = index - i;
    return i >= 0 && i + 1 < data.length ? data[i] * (1 - t) + data[i + 1] * t : 0;
}
function lowpass(data, hz) {
    const out = new Float32Array(data.length), k = 1 - Math.exp(-2 * Math.PI * hz / sampleRate);
    let value = 0;
    for (let i = 0; i < data.length; i++) { value += (data[i] - value) * k; out[i] = value; }
    return out;
}
function render(seconds, layers) {
    return Float32Array.from({ length: Math.round(seconds * sampleRate) }, (_, i) => {
        const t = i / sampleRate;
        return layers.reduce((sum, layer) => {
            const local = t - (layer.delay ?? 0);
            if (local < 0) return sum;
            return sum + sample(layer.data, local * (layer.rate ?? 1) + (layer.offset ?? 0)) * layer.gain;
        }, 0);
    });
}
function loop(data, seconds, offset = 0) {
    const size = Math.round(seconds * sampleRate), fade = Math.round(0.04 * sampleRate);
    const out = Float32Array.from({ length: size }, (_, i) => sample(data, offset + i / sampleRate));
    for (let i = 0; i < fade; i++) {
        const t = i / fade;
        out[size - fade + i] = out[size - fade + i] * (1 - t) + sample(data, offset - (fade - i) / sampleRate) * t;
    }
    const first = out[0], last = out.at(-1);
    for (let i = 0; i < size; i++) out[i] -= first + (last - first) * i / (size - 1);
    return out;
}
function write(name, data, looped = false) {
    let mean = 0;
    for (const value of data) mean += value / data.length;
    let peak = 0;
    for (let i = 0; i < data.length; i++) { data[i] -= mean; peak = Math.max(peak, Math.abs(data[i])); }
    const gain = 0.78 / Math.max(peak, 0.0001);
    const wav = Buffer.alloc(44 + data.length * 2);
    wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
    wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28);
    wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(data.length * 2, 40);
    for (let i = 0; i < data.length; i++) {
        const envelope = looped ? 1 : Math.min(1, i / 64, (data.length - 1 - i) / (sampleRate * 0.05));
        wav.writeInt16LE(Math.round(data[i] * gain * envelope * 32767), 44 + i * 2);
    }
    fs.writeFileSync(base + name + '.wav', wav);
    console.log(`${name}: ${(data.length / sampleRate).toFixed(2)}s`);
}

const stone = read('trailer/stone-grind');
const crack = read('trailer/crack'), click = read('trailer/stone-click');
const snaps = new Float32Array(Math.round(0.8 * sampleRate));
const times = [0.01, 0.083, 0.165, 0.234, 0.318, 0.389, 0.473, 0.55, 0.632, 0.715];
for (let hit = 0; hit < times.length; hit++) {
    for (let i = 0; i < sampleRate * 0.055; i++) {
        const t = i / sampleRate, at = Math.round(times[hit] * sampleRate) + i;
        const rate = 1.4 + hit % 3 * 0.17;
        const attack = Math.min(1, t / 0.0005);
        snaps[at] += (sample(crack, t * rate + 0.008) * Math.exp(-t / 0.011)
            + sample(click, t * 1.5 + 0.002) * Math.exp(-t / 0.007) * 0.75) * attack;
    }
}
write('arauto-saw-stone-loop', snaps, true);

function wind(seconds, seed) {
    const white = Float32Array.from({ length: Math.round(seconds * sampleRate) }, () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 2147483648 - 1;
    });
    const body = lowpass(white, 1300), rumble = lowpass(white, 220), sub = lowpass(white, 55);
    return Float32Array.from(body, (value, i) => {
        const t = i / sampleRate;
        const gust = 0.85 + 0.1 * Math.sin(t * Math.PI * 2 * 4) + 0.05 * Math.sin(t * Math.PI * 2 * 11);
        return (value - sub[i] + (rumble[i] - sub[i]) * 1.2) * gust;
    });
}

for (let variant = 1; variant <= 3; variant++) {
    const gust = wind(0.2, 1987 + variant * 37);
    for (let i = 0; i < gust.length; i++) {
        const t = i / sampleRate;
        gust[i] *= Math.min(1, t / 0.025) * Math.pow(1 - t / 0.2, 0.55);
    }
    write(`arauto-dash-0${variant}`, gust);
    const impact = read(`trailer/impact-0${variant}`), boom = lowpass(read(`trailer/boom-0${variant}`), 600);
    const crack = read('trailer/crack');
    for (const [type, heavy] of [['ground', false], ['slam', true]]) {
        write(`arauto-${type}-0${variant}`, render(heavy ? 1.75 : 1.05, [
            { data: impact, gain: 0.7, rate: heavy ? 0.72 : 0.95 },
            { data: boom, gain: heavy ? 0.9 : 0.5, rate: heavy ? 0.72 : 1.1 },
            { data: crack, gain: 0.28, rate: heavy ? 0.8 : 1.05, delay: 0.07 },
            { data: stone, gain: 0.16, rate: 1.1, delay: 0.12, offset: 0.1 }
        ]));
    }
}
write('arauto-dash-loop', loop(wind(1, 39137), 0.6, 0.12), true);
