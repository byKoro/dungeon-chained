/** Carrega e reproduz efeitos locais com variações e sobreposição simples. */
export class AudioManager {
    constructor(clips) {
        this.active = new Set();
        this.clips = Object.fromEntries(
            Object.entries(clips).map(([name, paths]) => [name, paths.map(path => {
                const audio = new Audio(path);
                audio.preload = "auto";
                return audio;
            })])
        );
    }

    play(name, { volume = 0.7, rate = 1 } = {}) {
        const variants = this.clips[name];
        if (!variants?.length) return;

        const template = variants[Math.floor(Math.random() * variants.length)];
        const audio = template.cloneNode();
        audio.volume = volume;
        audio.playbackRate = rate;
        audio.currentTime = 0;
        this.active.add(audio);
        audio.addEventListener("ended", () => this.active.delete(audio), { once: true });
        audio.play().catch(() => this.active.delete(audio));
    }
}
