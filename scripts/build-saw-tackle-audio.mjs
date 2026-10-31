import fs from 'node:fs';

const sampleRate = 44100;
function read(path) {
    const wav = fs.readFileSync(`assets/audio/${path}.wav`);
    let pcm, channels, rate;
    for (let offset = 12; offset + 8 <= wav.length;) {
        const size = wav.readUInt32LE(offset + 4), chunk = wav.toString('ascii', offset, offset + 4);
        if (chunk === 'fmt ') {
            if (wav.readUInt16LE(offset + 8) !== 1 || wav.readUInt16LE(offset + 22) !== 16) throw new Error(`Expected PCM16: ${path}`);
            channels = wav.readUInt16LE(offset + 10); rate = wav.readUInt32LE(offset + 12);
        }
        if (chunk === 'data') pcm = wav.subarray(offset + 8, offset + 8 + size);
        offset += 8 + size + size % 2;
    }
    if (!pcm || !channels || !rate) throw new Error(`Invalid WAV: ${path}`);
    return time => {
        const position = time * rate, frame = Math.floor(position), blend = position - frame;
        if (frame < 0 || (frame + 2) * channels * 2 > pcm.length) return 0;
        let sum = 0;
        for (let c = 0; c < channels; c++) {
            const a = pcm.readInt16LE((frame * channels + c) * 2), b = pcm.readInt16LE(((frame + 1) * channels + c) * 2);
            sum += (a + (b - a) * blend) / 32768 / channels;
        }
        return sum;
    };
}
function write(name, seconds, fn, loop = false) {
    const data = Float32Array.from({ length: Math.round(seconds * sampleRate) }, (_, i) => fn(i / sampleRate));
    if (loop) {
        const fade = Math.round(sampleRate * 0.035);
        for (let i = 0; i < fade; i++) {
            const k = i / (fade - 1), at = data.length - fade + i;
            data[at] = data[at] * (1 - k) + data[i] * k;
        }
        const delta = data.at(-1) - data[0];
        for (let i = 0; i < data.length; i++) data[i] -= delta * i / (data.length - 1);
    }
    const mean = data.reduce((sum, v) => sum + v, 0) / data.length;
    let peak = 0;
    for (let i = 0; i < data.length; i++) { data[i] -= mean; peak = Math.max(peak, Math.abs(data[i])); }
    const wav = Buffer.alloc(44 + data.length * 2);
    wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
    wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28);
    wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(data.length * 2, 40);
    for (let i = 0; i < data.length; i++) {
        const envelope = loop ? 1 : Math.min(1, i / 80, (data.length - 1 - i) / (sampleRate * 0.04));
        wav.writeInt16LE(Math.round(data[i] / Math.max(peak, 0.0001) * 0.75 * envelope * 32767), 44 + i * 2);
    }
    fs.writeFileSync(`assets/audio/saw-tackle-${name}.wav`, wav);
    console.log(`saw-tackle-${name}: ${seconds}s${loop ? ' loop' : ''}`);
}
const motor = read('saw-motor-loop'), metal = read('saw-land-01'), hit = read('saw-hit-01');
const thud = read('trailer/thud'), crack = read('trailer/crack'), whoosh = read('trailer/whoosh-03');
write('impact', 0.48, t => metal(t * 0.72) * Math.exp(-t * 6) + thud(t * 0.8) * 1.2
    + crack(t * 0.9) * Math.exp(-t * 23) * 0.45);
write('launch', 0.35, t => whoosh(t * 1.1) * 0.85 + motor(0.2 + t * 0.8) * Math.exp(-t * 15) * 0.4);
write('flight-loop', 1, t => motor(0.35 + t * 0.6) * 0.65
    + whoosh(0.03 + t % 0.14 * 0.7) * (0.8 + Math.sin(t * Math.PI * 18) * 0.2) * 0.2, true);
write('cut-loop', 0.8, t => Math.tanh(motor(0.3 + t * 0.82) * 2.2) * 0.7
    + hit(0.03 + t % 0.052 * 0.8) * Math.exp(-(t % 0.052) * 48) * 0.35, true);
write('bite', 0.23, t => hit(t * 0.75) * 0.8 + crack(t * 1.2) * Math.exp(-t * 22) * 0.7);
write('bounce', 0.26, t => metal(t * 1.45) * Math.exp(-t * 13) + crack(t * 1.8) * Math.exp(-t * 25) * 0.3);
write('land', 0.4, t => metal(t * 0.9) * Math.exp(-t * 10) * 0.7 + thud(t * 1.1) * 0.8);
