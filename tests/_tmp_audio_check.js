// Verificação temporária do AudioManager com stubs (removida após rodar).
import fs from 'node:fs';
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.error('FAIL', m); } else console.log('ok', m); };

class FakeAudio {
    static created = 0;
    constructor(src) { this.src = src; this.volume = 1; this.playbackRate = 1; this.paused = true; this.readyState = 4; FakeAudio.created++; this._l = {}; }
    cloneNode() { return new FakeAudio(this.src); }
    addEventListener(ev, fn) { this._l[ev] = fn; }
    play() { this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
}
globalThis.Audio = FakeAudio;

class Param {
    constructor(v) { this.value = v; this.events = []; }
    setTargetAtTime(v, t, tc) { this.events.push(['target', v, t, tc]); this.value = v; }
    setValueAtTime(v, t) { this.events.push(['set', v, t]); }
    cancelScheduledValues(t) { this.events.push(['cancel', t]); }
}
class Node_ { constructor() { this.gain = new Param(1); this.conn = []; } connect(n) { this.conn.push(n); } }
class FakeCtx {
    constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
    createGain() { return new Node_(); }
    createBufferSource() { const s = new Node_(); s.start = () => { s.started = true; }; s.stop = () => { s.stopped = true; }; FakeCtx.last = s; return s; }
    decodeAudioData(d, res) { res({ duration: 20 }); }
    resume() { return Promise.resolve(); }
}
globalThis.AudioContext = FakeCtx;
globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });

let fakeNow = 1000;
Object.defineProperty(globalThis, 'performance', { value: { now: () => fakeNow }, configurable: true });

const { AudioManager } = await import('../js/core/AudioManager.js');
const { AUDIO_CONFIG } = await import('../js/config/AudioConfig.js');

// Arquivos dos cues novos existem.
for (const name of ['pickup', 'sawHit', 'sawSnap', 'sawLand', 'sawPickup', 'playerFall', 'doorOpen', 'ambience']) {
    const cue = AUDIO_CONFIG.cues[name];
    ok(cue && cue.files.every(f => fs.existsSync(f)), `arquivos de ${name} existem`);
}

const am = new AudioManager(AUDIO_CONFIG);
ok(!am.clips.ambience, 'loop não é pré-carregado como HTMLAudio');
ok(am.play('ambience') === null, 'play() ignora cue de loop');

// Cooldown
const a1 = am.play('sawHit');
const a2 = am.play('sawHit');
ok(a1 && a2 === null, 'cooldown bloqueia redisparo imediato');
fakeNow += 50;
const a3 = am.play('sawHit');
ok(!!a3, 'após cooldown toca de novo');

// maxVoices (3): 4º disparo rouba o mais antigo
fakeNow += 50; const a4 = am.play('sawHit');
fakeNow += 50; const a5 = am.play('sawHit');
ok(a1.paused && !a5.paused && am._voices.get('sawHit').length === 3, 'maxVoices rouba a voz mais antiga');
ok(a5 !== null && a4 !== null, 'vozes novas tocam');

// rateMultiplier com pitchShift
fakeNow += 100;
const r = am.play('pickup', { rateMultiplier: 1.24 });
ok(r.playbackRate > 1.18 && r.playbackRate < 1.3 && r.preservesPitch === false, 'rateMultiplier + pitchShift');

// Variante não repete em sequência
let repeats = 0, last = null;
for (let i = 0; i < 40; i++) { fakeNow += 250; const x = am.play('sawLand'); if (x.src === last) repeats++; last = x.src; }
ok(repeats === 0, 'variantes não repetem consecutivamente');

// Loops
am.playLoop('ambience', { fadeMs: 3000 });
await new Promise(r => setTimeout(r, 10));
const src = FakeCtx.last;
ok(src && src.loop === true && src.started, 'loop inicia com source.loop = true');
am.playLoop('ambience');
ok(FakeCtx.last === src, 'playLoop é idempotente');
const loop = am._loops.get('ambience');
ok(Math.abs(loop.gain.gain.value - 0.45) < 1e-9, 'fade-in mira o volume do cue');
am.setLoopLevel('ambience', -10);
ok(Math.abs(loop.gain.gain.value - 0.45 * Math.pow(10, -0.5)) < 1e-9, 'setLoopLevel em dB');
am.setLoopLevel('ambience', 0);

// Duck: o mais fundo prevalece dentro da janela
am.duck(-9, { holdMs: 300 });
const deep = am._duckState.lin;
fakeNow += 50;
am.duck(-3, { holdMs: 50 });
ok(am._duckState.lin === deep, 'duck mais raso não sobrescreve o mais fundo');
const ev = am._duckNode.gain.events.filter(e => e[0] === 'target');
ok(ev.at(-1)[1] === 1, 'duck agenda a recuperação para 1');

// Mudo
am.toggleMute(true);
ok(am._masterNode.gain.value === 0, 'mudo zera o master dos loops');
am.toggleMute(false);
ok(am._masterNode.gain.value === 1, 'desmutar restaura');

am.stopLoop('ambience');
ok(!am.isLoopPlaying('ambience') && src.stopped, 'stopLoop encerra com fade');

// Cues antigos com arquivo faltando (só aviso)
for (const [n, c] of Object.entries(AUDIO_CONFIG.cues)) {
    const miss = (c.files || []).filter(f => !fs.existsSync(f));
    if (miss.length) console.log(`AVISO: ${n} sem arquivo(s): ${miss.length}`);
}
process.exit(fails ? 1 : 0);
