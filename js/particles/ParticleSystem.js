import { FloorDebris } from './FloorDebris.js';
import { DustPuff } from './DustPuff.js';
import { SparkParticle } from './SparkParticle.js';
import { FlashParticle } from './FlashParticle.js';
import { FlameParticle } from './FlameParticle.js';

// 1 "pixel" de sangue no mundo (= 1 pixel de tile: tile 16px desenhado a 64px).
const BLOOD_PX = 4;

// Paleta do sangue VOANDO no ar (respingo no impacto). Diferente do sangue seco
// do chão (que é composto em "multiply"), estas partículas são desenhadas sobre
// a cena em modo normal, então usamos tons de bordô médios/dessaturados: dão
// "vida" ao impacto sem o vermelho berrante que destoava do cenário escuro.
const AIR_BLOOD_COLORS = ["#5c0a18", "#6e0f1c", "#7d1420", "#4a0612", "#640d1a"];

// Atualiza todas as partículas da lista e remove as terminadas (p.done) numa
// ÚNICA passada, compactando in-place. Substitui o splice(i, 1) dentro do
// loop, que custava O(n) por remoção (O(n²) no pior caso com muitas
// partículas). Preserva a ordem (logo, a ordem de desenho também).
function updateAndCompact(list, a, b) {
    let w = 0;
    for (let r = 0; r < list.length; r++) {
        const p = list[r];
        p.update(a, b);
        if (!p.done) list[w++] = p;
    }
    list.length = w;
}

class AirParticle {
    constructor(x, y, color, isBlood = false, spread = 1, ephemeral = false) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.isBlood = isBlood;
        // Efêmera: ao assentar, apenas some — NÃO carimba sangue nem debris no
        // chão (usada para respingo puramente visual, sem criar sangue novo).
        this.ephemeral = ephemeral;

        // Tamanho sempre múltiplo do pixel de arte (1 ou 2 pixels de tile).
        this.size = BLOOD_PX * (1 + (Math.random() < 0.35 ? 1 : 0));

        const angle = Math.random() * Math.PI * 2;
        const speed = ((isBlood ? 3 : 4) + Math.random() * (isBlood ? 8 : 11)) * spread;
        this.vx = Math.cos(angle) * speed + (Math.random() - 0.5) * 2;
        this.vy = Math.sin(angle) * speed - (1 + Math.random() * 3.5);

        this.gravity = 0.4;
        this.friction = 0.92;
        // Onde a gota vai assentar no chão. 'spread' amplia a dispersão para o
        // sangue cair espalhado e aleatório em volta do ponto de impacto.
        this.groundY = y + 12 + (Math.random() - 0.5) * 36 * spread;
        this.bounces = 0;
        this.maxBounces = 1 + Math.floor(Math.random() * 2);
        this.settled = false;
    }

    // Interface comum com as demais partículas (usada por updateAndCompact).
    get done() {
        return this.settled;
    }

    update(debrisList, bloodCanvas) {
        if (this.settled) return;

        this.vx *= this.friction;
        this.vy += this.gravity;
        this.x += this.vx;
        this.y += this.vy;

        if (this.y >= this.groundY) {
            this.y = this.groundY;
            this.bounces++;
            if (this.bounces < this.maxBounces && Math.abs(this.vy) > 1.4) {
                this.vy = -this.vy * 0.35;
                this.vx *= 0.6;
            } else {
                this.settled = true;
                if (this.ephemeral) {
                    // Efêmera: não deixa marca nenhuma (só desaparece).
                } else if (this.isBlood && bloodCanvas) {
                    // Ao assentar, carimba um respingo pixelado no buffer de sangue.
                    bloodCanvas.stampSplat(this.x, this.y, 0.6 + Math.random() * 0.5);
                } else if (debrisList) {
                    // Fallback (detritos não-sangue): mancha simples no chão.
                    debrisList.push(new FloorDebris(this.x, this.y, this.size, this.size, this.color, false));
                }
            }
        }
    }

    draw(ctx) {
        if (this.settled) return;
        ctx.fillStyle = this.color;
        // Alinha à grade de pixels de sangue (coerente com os tiles).
        const x = Math.round(this.x / BLOOD_PX) * BLOOD_PX;
        const y = Math.round(this.y / BLOOD_PX) * BLOOD_PX;
        ctx.fillRect(x, y, this.size, this.size);
    }
}

export class ParticleSystem {
    constructor(bloodCanvas = null) {
        this.airParticles = [];
        this.floorDebris = [];
        this.smoke = [];                // baforadas de fumaça (poeira de corrida)
        this.sparks = [];               // faíscas da serra raspando o chão
        this.flashes = [];              // flash branco ao arrebentar a corrente
        this.flames = [];               // chamas de aparição dos inimigos (intro)
        this.bloodCanvas = bloodCanvas; // buffer offscreen do sangue de chão
    }

    clear() {
        this.airParticles = [];
        this.floorDebris = [];
        this.smoke = [];
        this.sparks = [];
        this.flashes = [];
        this.flames = [];
        if (this.bloodCanvas) this.bloodCanvas.clear();
    }

    // Poeira de corrida PROCEDURAL: gera um conjunto de partículas de poeira
    // lançadas no sentido contrário à corrida. (dirX, dirY) = direção da corrida.
    triggerDust(x, y, dirX, dirY, amount = 10) {
        // pequeno jitter proporcional (não infla emissões pequenas de andar)
        const n = amount + ((Math.random() * Math.max(1, amount * 0.3)) | 0);
        for (let i = 0; i < n; i++) {
            // pequena dispersão na origem para não sair tudo do mesmo ponto
            const ox = (Math.random() - 0.5) * 8;
            const oy = (Math.random() - 0.5) * 6;
            this.smoke.push(new DustPuff(x + ox, y + oy, dirX, dirY));
        }
    }

    // COLUNA DE CHAMA de APARIÇÃO (spawn de inimigo na intro): uma labareda
    // GRANDE sobe do CHÃO (os pés do inimigo) com as cores da tocha, revelando
    // o inimigo pouco a pouco conforme sobe. `baseColor` é o RGB ([r,g,b]).
    // `opts`: { amount, rise (altura px), width (largura da base px), sizeScale }.
    triggerFlameBurst(x, y, baseColor = [255, 190, 110], opts = {}) {
        const amount = opts.amount ?? 34;
        const flameOpts = {
            rise: opts.rise ?? 50,
            width: opts.width ?? 30,
            sizeScale: opts.sizeScale ?? 1
        };
        for (let i = 0; i < amount; i++) {
            this.flames.push(new FlameParticle(x, y, baseColor, flameOpts));
        }
    }

    // Flash branco (procedural, com glow sutil) ao arrebentar a corrente/serra.
    // 'power' escala levemente a velocidade/alcance.
    triggerFlash(x, y, amount = 14, power = 1) {
        for (let i = 0; i < amount; i++) {
            this.flashes.push(new FlashParticle(x, y, power));
        }
    }

    // Faíscas da serra raspando o chão. Nascem na BORDA do disco (raio) e são
    // arremessadas no sentido do giro (spinDir: +1 horário, -1 anti-horário).
    triggerSparks(cx, cy, radius = 24, spinDir = 1, amount = 2) {
        for (let i = 0; i < amount; i++) {
            this.sparks.push(new SparkParticle(cx, cy, radius, spinDir));
        }
    }

    // Explosão de faíscas EXAGERADAS (radiais, com glow) ao arrebentar.
    triggerSparkBurst(cx, cy, radius = 24, amount = 24, power = 1.5) {
        for (let i = 0; i < amount; i++) {
            this.sparks.push(new SparkParticle(cx, cy, radius, 1, { burst: true, power }));
        }
    }

    // Jato de sangue focado (sem pedaços/ossos). Usado ao matar inimigos e
    // ao player receber dano. 'amount' controla a intensidade; as gotas saltam
    // e assentam espalhadas e aleatórias pelo chão.
    triggerBlood(x, y, amount = 20, spread = 1) {
        const bloodColors = AIR_BLOOD_COLORS;
        const count = amount + Math.floor(Math.random() * (amount * 0.5));
        for (let i = 0; i < count; i++) {
            const c = bloodColors[Math.floor(Math.random() * bloodColors.length)];
            this.airParticles.push(new AirParticle(x, y, c, true, spread));
        }
    }

    // Gotas de sangue EFÊMERAS (só visual): voam e somem sem carimbar nada no
    // chão. Para a serra girando SOBRE sangue — espirra sem criar sangue novo.
    triggerBloodDroplets(x, y, amount = 2, spread = 1) {
        const bloodColors = AIR_BLOOD_COLORS;
        for (let i = 0; i < amount; i++) {
            const c = bloodColors[Math.floor(Math.random() * bloodColors.length)];
            this.airParticles.push(new AirParticle(x, y, c, true, spread, true));
        }
    }

    // Poça de sangue no local da morte: carimbada como geometria pixelada
    // complexa (elipses imperfeitas + quadriculados) no buffer de sangue.
    triggerBloodPool(x, y, scale = 1) {
        if (this.bloodCanvas) this.bloodCanvas.stampPool(x, y, scale);
    }

    triggerExplosion(x, y, isSkeleton) {
        const bloodColors = AIR_BLOOD_COLORS;
        const boneColors = isSkeleton 
            ? ["#ffffff", "#e5e5e5", "#b8b8b8", "#595959"] 
            : ["#48cae4", "#0096c7", "#023e8a", "#e0fbfc"];

        const bloodCount = 22 + Math.floor(Math.random() * 10);
        for (let i = 0; i < bloodCount; i++) {
            const c = bloodColors[Math.floor(Math.random() * bloodColors.length)];
            this.airParticles.push(new AirParticle(x, y, c, true));
        }

        const pieceCount = 14 + Math.floor(Math.random() * 8);
        for (let i = 0; i < pieceCount; i++) {
            const c = boneColors[Math.floor(Math.random() * boneColors.length)];
            this.airParticles.push(new AirParticle(x, y, c, false));
        }
    }

    update(players, bounds) {
        // Atualiza detritos no chão (não-sangue; podem ser chutados)
        for (let i = 0; i < this.floorDebris.length; i++) {
            this.floorDebris[i].update(players, bounds);
        }

        // Partículas voando. Ao assentar, o sangue é carimbado no buffer.
        updateAndCompact(this.airParticles, this.floorDebris, this.bloodCanvas);
        // Fumaça, faíscas, flashes e chamas: atualiza e remove as terminadas.
        updateAndCompact(this.smoke);
        updateAndCompact(this.sparks);
        updateAndCompact(this.flashes);
        updateAndCompact(this.flames);
    }

    // 'clip' (opcional) {minX,maxX,minY,maxY}: restringe o sangue de chão à
    // área jogável, para não aparecer sobre as paredes do cenário.
    // 'holes' (opcional) [{x,y,w,h}]: retângulos a EXCLUIR do clip (ex.: miolo
    // escuro dos buracos), para o sangue nunca aparecer sobre eles.
    drawFloor(ctx, clip, holes = null) {
        ctx.save();
        if (clip) {
            ctx.beginPath();
            ctx.rect(clip.minX, clip.minY, clip.maxX - clip.minX, clip.maxY - clip.minY);
            // Fura os buracos: com a regra "evenodd", os retângulos internos
            // viram recortes (o sangue não é desenhado dentro deles).
            if (holes) {
                for (const h of holes) ctx.rect(h.x, h.y, h.w, h.h);
            }
            ctx.clip("evenodd");
        }
        if (this.bloodCanvas) this.bloodCanvas.draw(ctx);
        for (let i = 0; i < this.floorDebris.length; i++) {
            this.floorDebris[i].draw(ctx);
        }
        ctx.restore();
    }

    // Estado do ctx (globalAlpha, blend) é salvo/restaurado UMA vez por
    // camada, não por partícula: as partículas só ajustam alpha/fillStyle.

    // Fumaça (poeira de corrida): desenhada na camada de chão, sob as entidades.
    drawSmoke(ctx) {
        if (this.smoke.length === 0) return;
        ctx.save();
        for (let i = 0; i < this.smoke.length; i++) {
            this.smoke[i].draw(ctx);
        }
        ctx.restore();
    }

    // Faíscas da serra: camada aérea, por cima das entidades (centelhas vivas).
    drawSparks(ctx) {
        if (this.sparks.length === 0 && this.flashes.length === 0) return;
        ctx.save();
        for (let i = 0; i < this.sparks.length; i++) {
            this.sparks[i].draw(ctx);
        }
        // Flashes de ruptura: desenhados junto, por cima de tudo no mundo,
        // com glow ADITIVO (modo ligado uma vez para todos).
        if (this.flashes.length > 0) {
            // Escala atual do ctx: o glow é calibrado em px de tela.
            const zoom = ctx.getTransform().a || 1;
            ctx.globalCompositeOperation = "lighter";
            for (let i = 0; i < this.flashes.length; i++) {
                this.flashes[i].draw(ctx, zoom);
            }
        }
        ctx.restore();
    }

    drawAir(ctx) {
        for (let i = 0; i < this.airParticles.length; i++) {
            this.airParticles[i].draw(ctx);
        }
    }

    // Chamas de aparição (intro): camada aérea, por cima das entidades, para o
    // fogo "subir na frente" do inimigo que está materializando.
    drawFlames(ctx) {
        if (this.flames.length === 0) return;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < this.flames.length; i++) {
            this.flames[i].draw(ctx);
        }
        ctx.restore();
    }
}