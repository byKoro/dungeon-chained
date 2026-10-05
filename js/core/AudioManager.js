/** Carrega e reproduz efeitos locais com variações e sobreposição simples. */
const clamp01 = v => Math.max(0, Math.min(1, v));

export class AudioManager {
    constructor(config, masterVolume = 1) {
        this.active = new Set();
        this.masterVolume = clamp01(masterVolume);
        this.sounds = Object.fromEntries(
            Object.entries(config).map(([name, entry]) => [name, {
                variants: entry.files.map(path => {
                    const audio = new Audio(path);
                    audio.preload = "auto";
                    return audio;
                }),
                volume: entry.volume,
                rate: entry.rate
            }])
        );
    }

    play(name, overrides = {}) {
        const sound = this.sounds[name];
        if (!sound?.variants.length) return;

        const volume = clamp01((overrides.volume ?? sound.volume) * this.masterVolume);
        const rate = overrides.rate ?? (
            Array.isArray(sound.rate)
                ? sound.rate[0] + Math.random() * (sound.rate[1] - sound.rate[0])
                : sound.rate
        );

        const template = sound.variants[Math.floor(Math.random() * sound.variants.length)];
        const audio = template.cloneNode();
        audio.volume = volume;
        audio.playbackRate = rate;
        audio.currentTime = 0;
        this.active.add(audio);
        audio.addEventListener("ended", () => this.active.delete(audio), { once: true });
        audio.play().catch(() => this.active.delete(audio));
    }

    setMasterVolume(v) {
        this.masterVolume = clamp01(v);
    }
}
