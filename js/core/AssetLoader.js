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

        // Tileset das salas (grade 10x10 de 16px)
        this.load("tileset", "assets/tileset/tileset.png");
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
    get tileset() { return this.images.tileset; }
}
