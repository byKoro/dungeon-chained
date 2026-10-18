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

        // Tileset das salas (grade 10x10 de 16px). Além do padrão, carregamos
        // variantes OPCIONAIS para testar texturas (alternador in-game, tecla
        // "T"). Basta soltar arquivos em assets/tileset/ com estes nomes; os
        // que não existirem são simplesmente ignorados (não quebram nada).
        this.load("tileset", "assets/tileset/tileset.png");
        this._tilesetVariantKeys = ["tileset"];
        for (let n = 1; n <= 6; n++) {
            const key = `tileset_${n}`;
            this.load(key, `assets/tileset/tileset_${n}.png`);
            this._tilesetVariantKeys.push(key);
        }

        // Serra: folha com 4 frames de rotação na primeira linha (grade 65px
        // começando em 13,13 — ver SawWeapon para o fatiamento).
        this.load("saw", "assets/saw/saw.png");

        // Corda que prende os jogadores (segmento trançado tileável, preto).
        this.load("cable", "assets/saw/rope.png");

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

    /**
     * Resolve quando TODAS as imagens registradas tiverem carregado (ou
     * falhado — variantes opcionais ausentes não travam) e já estiverem
     * DECODIFICADAS. Decodificar antes evita o engasgo do primeiro desenho
     * de cada textura quando o jogo começa.
     * @param {(done:number, total:number) => void} [onProgress]
     */
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

    // Atalhos nomeados (para passar como `assets` às configs).
    get p1() { return this.images.p1; }
    get p1Hurt() { return this.images.p1Hurt; }
    get p1Scared() { return this.images.p1Scared; }
    get p2() { return this.images.p2; }
    get p2Hurt() { return this.images.p2Hurt; }
    get p2Scared() { return this.images.p2Scared; }
    get demon() { return this.images.demon; }
    get bloodMonster() { return this.images.bloodMonster; }
    get tileset() { return this.images.tileset; }
    get saw() { return this.images.saw; }
    get cable() { return this.images.cable; }
    // Lista de tilesets DISPONÍVEIS para o alternador: o padrão + as variantes
    // que de fato carregaram (arquivos ausentes ficam de fora). Consultar após
    // whenReady() para o estado de carga ser confiável.
    get tilesetVariants() {
        return (this._tilesetVariantKeys || ["tileset"])
            .map(k => this.images[k])
            .filter(img => img && img.complete && img.naturalWidth > 0);
    }
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
