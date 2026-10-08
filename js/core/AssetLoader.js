/**
 * AssetLoader — carrega e expõe todas as imagens do jogo.
 *
 * Antes os `new Image()` ficavam soltos no topo do main.js. Aqui ficam
 * encapsulados: cria-se uma instância, acessam-se as imagens por nome e,
 * se necessário, aguarda-se o carregamento com `whenReady()`.
 */
export class AssetLoader {
    constructor() {
        this.images = {};

        // Jogadores
        this.load("p1", "assets/player_01/player_walk.png");
        this.load("p1Hurt", "assets/player_01/player_hurt.png");
        this.load("p1Scared", "assets/player_01/player_walk_scared.png");
        this.load("p2", "assets/player_02/player_walk.png");
        this.load("p2Hurt", "assets/player_02/player_hurt.png");
        this.load("p2Scared", "assets/player_02/player_walk_scared.png");

        // Inimigos
        this.load("demon", "assets/enemies/demon.png");
        this.load("bloodMonster", "assets/enemies/blood_monster.png");

        // Inimigos com animações em arquivos separados por frame.
        const sequences = [
            ["cleaveDemon", "assets/enemies/cleave_demon", [
                ["idle", "01_demon_idle", "demon_idle", 6], ["walk", "02_demon_walk", "demon_walk", 12],
                ["attack", "03_demon_cleave", "demon_cleave", 15], ["hurt", "04_demon_take_hit", "demon_take_hit", 5],
                ["death", "05_demon_death", "demon_death", 22]
            ]],
            ["frostGuardian", "assets/enemies/frost_guardian", [
                ["attack", "1_atk", "1_atk", 14], ["death", "death", "death", 16],
                ["idle", "idle", "idle", 6], ["hurt", "take_hit", "take_hit", 7], ["walk", "walk", "walk", 10]
            ]]
        ];
        for (const [key, root, animations] of sequences) {
            for (const [anim, folder, prefix, count] of animations) {
                this.images[`${key}_${anim}`] = Array.from({ length: count }, (_, i) =>
                    this.load(`${key}_${anim}_${i + 1}`, `${root}/${folder}/${prefix}_${i + 1}.png`));
            }
        }

        // Tileset das salas (grade 10x10 de 16px)
        this.load("tileset", "assets/tileset/tileset.png");

        // Spikes (4 sprites de 16x16; a sequência usa os índices 3, 1 e 2)
        this.load("peaks0", "assets/peaks/peaks_0.png");
        this.load("peaks1", "assets/peaks/peaks_1.png");
        this.load("peaks2", "assets/peaks/peaks_2.png");
        this.load("peaks3", "assets/peaks/peaks_3.png");

        // Armadilha de flecha e projétil
        this.load("arrowTrap1", "assets/arrow/arrow_1.png");
        this.load("arrowTrap2", "assets/arrow/arrow_2.png");
        this.load("arrowTrap3", "assets/arrow/arrow_3.png");
        this.load("arrowTrap4", "assets/arrow/arrow_4.png");
        this.load("arrow", "assets/arrow/Just_arrow.png");

        // Animações de fogo para paredes e candlesticks.
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

    // Resolve quando todas as imagens tiverem carregado (ou falhado).
    whenReady() {
        const pending = Object.values(this.images).flatMap(value => Array.isArray(value) ? value : [value]).filter(img => img && !img.complete);
        if (pending.length === 0) return Promise.resolve();
        return Promise.all(pending.map(img => new Promise(res => {
            img.onload = img.onerror = () => res();
        })));
    }

    // Atalhos nomeados (para passar como `assets` às configs).
    get p1() { return this.images.p1; }
    get p1Hurt() { return this.images.p1Hurt; }
    get p1Scared() { return this.images.p1Scared; }
    get p2() { return this.images.p2; }
    get p2Hurt() { return this.images.p2Hurt; }
    get p2Scared() { return this.images.p2Scared; }
    get demon() { return this.images.demon; }
    get bloodMonster() { return this.images.bloodMonster; }
    get cleaveDemon() { return this._enemyAnimations("cleaveDemon"); }
    get frostGuardian() { return this._enemyAnimations("frostGuardian"); }
    _enemyAnimations(key) {
        return Object.fromEntries(["idle", "walk", "attack", "hurt", "death"].map(name => [name, this.images[`${key}_${name}`]]));
    }
    get tileset() { return this.images.tileset; }
    // Sprites dos spikes, indexados pelo nome do arquivo (0..3).
    get peaks() { return [this.images.peaks0, this.images.peaks1, this.images.peaks2, this.images.peaks3]; }
    get arrowTrap() { return [this.images.arrowTrap1, this.images.arrowTrap2, this.images.arrowTrap3, this.images.arrowTrap4]; }
    get arrow() { return this.images.arrow; }
    get torchSprites() {
        return {
            torch: [1, 2, 3, 4].map(frame => this.images[`torch${frame}`]),
            sideTorch: [1, 2, 3, 4].map(frame => this.images[`sideTorch${frame}`]),
            candlestick1: [1, 2, 3, 4].map(frame => this.images[`candlestick1_${frame}`]),
            candlestick2: [1, 2, 3, 4].map(frame => this.images[`candlestick2_${frame}`])
        };
    }
}
