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
        this.load("p2", "assets/player_02.png");

        // Inimigos
        this.load("demon", "assets/enemies/demon.png");
        this.load("bloodMonster", "assets/enemies/blood_monster.png");
        this.load("fireSkull", "assets/enemies/skull_fire_sheet.png");

        // Tileset das salas (grade 10x10 de 16px)
        this.load("tileset", "assets/tileset/tileset.png");

        // Spikes (4 frames de 16x16): 0=recolhido ... 3=estendido
        this.load("peaks0", "assets/peaks/peaks_0.png");
        this.load("peaks1", "assets/peaks/peaks_1.png");
        this.load("peaks2", "assets/peaks/peaks_2.png");
        this.load("peaks3", "assets/peaks/peaks_3.png");
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
        const pending = Object.values(this.images).filter(img => !img.complete);
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
    get demon() { return this.images.demon; }
    get bloodMonster() { return this.images.bloodMonster; }
    get fireSkull() { return this.images.fireSkull; }
    get tileset() { return this.images.tileset; }
    // Frames dos spikes, em ordem (recolhido -> estendido).
    get peaks() { return [this.images.peaks0, this.images.peaks1, this.images.peaks2, this.images.peaks3]; }
}
