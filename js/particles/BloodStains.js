/**
 * BloodStains — manchas de sangue desenhadas SOBRE um sprite.
 *
 * Componente reutilizável por qualquer entidade (Player, inimigo, gib). As
 * manchas ficam em coordenadas locais (relativas ao centro do sprite) e são
 * desenhadas no mesmo sistema de transform do sprite, então acompanham o
 * personagem. Podem ser temporárias (com fade-out) ou permanentes.
 *
 * Uso:
 *   this.stains = new BloodStains();
 *   this.stains.splatter({ count: 4, spread: 10, life: 90, palette });
 *   // no update:  this.stains.update();
 *   // no draw (após desenhar o sprite, dentro do mesmo save/scale):
 *   //   this.stains.draw(ctx);
 */
export class BloodStains {
    constructor() {
        this.marks = [];
    }

    get length() {
        return this.marks.length;
    }

    _color(palette) {
        if (palette && palette.length) {
            return palette[(Math.random() * palette.length) | 0];
        }
        const fallback = ["#830623", "#a30808", "#c60f0e", "#7a0404"];
        return fallback[(Math.random() * fallback.length) | 0];
    }

    /**
     * Adiciona algumas manchas espalhadas em torno do centro do sprite.
     * @param {object} o
     *   count   nº de manchas
     *   spread  raio de dispersão (px locais)
     *   life    duração em frames (Infinity = permanente)
     *   palette lista de cores (ex.: do BloodCanvas)
     *   sizeMin/sizeMax tamanho do bloco
     *   offsetY deslocamento vertical do centro (ex.: subir para o torso)
     */
    splatter({ count = 3, spread = 10, life = 90, palette = null,
               sizeMin = 2, sizeMax = 4, offsetY = 0, alpha = 1 } = {}) {
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = Math.random() * spread;
            this.marks.push({
                x: Math.cos(a) * r,
                y: Math.sin(a) * r + offsetY,
                size: sizeMin + ((Math.random() * (sizeMax - sizeMin + 1)) | 0),
                color: this._color(palette),
                life,
                maxLife: life,
                alpha
            });
        }
    }

    update() {
        for (let i = this.marks.length - 1; i >= 0; i--) {
            const m = this.marks[i];
            if (m.life !== Infinity) {
                m.life--;
                if (m.life <= 0) this.marks.splice(i, 1);
            }
        }
    }

    clear() {
        this.marks.length = 0;
    }

    /**
     * Desenha as manchas. Deve ser chamado dentro do mesmo contexto/transform
     * usado para desenhar o sprite (translate no centro, scale de facing).
     * 'alpha' global opcional para deixar bem leve.
     */
    draw(ctx, alpha = 1) {
        if (!this.marks.length) return;
        ctx.save();
        for (const m of this.marks) {
            // Fade-out temporal (manchas temporárias somem suavemente perto do fim)
            const t = m.life === Infinity ? 1 : Math.min(1, m.life / (m.maxLife * 0.4));
            const a = (m.alpha ?? 1);
            ctx.globalAlpha = alpha * a * Math.min(1, t);
            ctx.fillStyle = m.color;
            ctx.fillRect(Math.round(m.x), Math.round(m.y), m.size, m.size);
        }
        ctx.restore();
    }
}
