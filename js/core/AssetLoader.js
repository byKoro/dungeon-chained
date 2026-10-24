import { TINY_RPG_ENEMIES } from '../config/TinyRpgEnemies.js';

export const PLAYER_EXPRESSIONS = [
    'neutro', 'assustado', 'espantado', 'raiva', 'furia', 'preocupado',
    'desconfiado', 'olhando_esquerda', 'olhando_direita', 'olhando_cima',
    'olhos_fechados'
];

export class AssetLoader {
    constructor() {
        this.images = {};

        this.load("p1", "assets/player_01/player_walk.png");
        this.load("p1Hurt", "assets/player_01/player_hurt.png");
        this.load("p1Scared", "assets/player_01/player_walk_scared.png");
        this.load("p2", "assets/player_02/player_walk.png");
        this.load("p2Hurt", "assets/player_02/player_hurt.png");
        this.load("p2Scared", "assets/player_02/player_walk_scared.png");

        for (const dir of ["player_01", "player_02"]) {
            for (const name of PLAYER_EXPRESSIONS) {
                this.load(`${dir}_expr_${name}`, `assets/${dir}/expressions/${name}.png`);
            }
        }

        this.load("heart", "assets/heart/heart.png");

        this.load("heartPickup", "assets/heart/heart_pickup.png");

        this.load("demon", "assets/enemies/demon.png");
        this.load("bloodMonster", "assets/enemies/blood_monster.png");

        for (const e of TINY_RPG_ENEMIES) this.load(e.key, e.src);

        this.load("tileset", "assets/tileset/tileset.png");
        this._tilesetVariantKeys = ["tileset"];
        for (let n = 1; n <= 6; n++) {
            const key = `tileset_${n}`;
            this.load(key, `assets/tileset/tileset_${n}.png`);
            this._tilesetVariantKeys.push(key);
        }

        this.load("saw", "assets/saw/saw.png");

        this.load("cable", "assets/saw/rope.png");

        this.load("peaks0", "assets/peaks/peaks_0.png");
        this.load("peaks1", "assets/peaks/peaks_1.png");
        this.load("peaks2", "assets/peaks/peaks_2.png");
        this.load("peaks3", "assets/peaks/peaks_3.png");

        this.load("arrowTrap1", "assets/arrow/arrow_1.png");
        this.load("arrowTrap2", "assets/arrow/arrow_2.png");
        this.load("arrowTrap3", "assets/arrow/arrow_3.png");
        this.load("arrowTrap4", "assets/arrow/arrow_4.png");
        this.load("arrow", "assets/arrow/Just_arrow.png");

        this.load("button", "assets/buttom/buttom_16.png");

        for (let frame = 1; frame <= 4; frame++) {
            this.load(`torch${frame}`, `assets/torch/torch_${frame}.png`);
            this.load(`sideTorch${frame}`, `assets/torch/side_torch_${frame}.png`);
            this.load(`candlestick1_${frame}`, `assets/torch/candlestick_1_${frame}.png`);
            this.load(`candlestick2_${frame}`, `assets/torch/candlestick_2_${frame}.png`);
        }
    }

    load(key, src) {
        const img = new Image();
        img.src = src;
        this.images[key] = img;
        return img;
    }

    get(key) {
        return this.images[key];
    }

    async whenReady(onProgress = null) {
        const imgs = Object.values(this.images);
        const total = imgs.length;
        let done = 0;
        const tick = () => { done++; onProgress?.(done, total); };
        onProgress?.(0, total);
        await Promise.all(imgs.map(img => new Promise(res => {
            const finish = () => {
                const ok = img.naturalWidth > 0;
                (ok && img.decode ? img.decode().catch(() => {}) : Promise.resolve())
                    .then(() => { tick(); res(); });
            };
            if (img.complete) finish();
            else {
                img.addEventListener('load', finish, { once: true });
                img.addEventListener('error', finish, { once: true });
            }
        })));
    }

    get p1() { return this.images.p1; }
    get p1Hurt() { return this.images.p1Hurt; }
    get p1Scared() { return this.images.p1Scared; }
    get p2() { return this.images.p2; }
    get p2Hurt() { return this.images.p2Hurt; }
    get p2Scared() { return this.images.p2Scared; }
    get demon() { return this.images.demon; }
    get bloodMonster() { return this.images.bloodMonster; }
    get heart() { return this.images.heart; }
    get tileset() { return this.images.tileset; }
    get saw() { return this.images.saw; }
    get cable() { return this.images.cable; }

    get tilesetVariants() {
        return (this._tilesetVariantKeys || ["tileset"])
            .map(k => this.images[k])
            .filter(img => img && img.complete && img.naturalWidth > 0);
    }

    get peaks() { return [this.images.peaks0, this.images.peaks1, this.images.peaks2, this.images.peaks3]; }
    get arrowTrap() { return [this.images.arrowTrap1, this.images.arrowTrap2, this.images.arrowTrap3, this.images.arrowTrap4]; }
    get arrow() { return this.images.arrow; }
    get button() { return this.images.button; }
    get torchSprites() {
        return {
            torch: [1, 2, 3, 4].map(frame => this.images[`torch${frame}`]),
            sideTorch: [1, 2, 3, 4].map(frame => this.images[`sideTorch${frame}`]),
            candlestick1: [1, 2, 3, 4].map(frame => this.images[`candlestick1_${frame}`]),
            candlestick2: [1, 2, 3, 4].map(frame => this.images[`candlestick2_${frame}`])
        };
    }
}
