import { SpikeTrap } from '../entities/SpikeTrap.js';
import { ArrowTrap, Arrow } from '../entities/ArrowTrap.js';
import { PressureButton } from '../entities/PressureButton.js';
import { HAZARDS, TILE } from '../config/GameConfig.js';

/**
 * ChallengeCorridor — instancia e gerencia os perigos/botões de uma peça
 * autoral (os hazards vêm do arquivo da sala desenhada no editor).
 *
 * Responsabilidades:
 *  - Converter coordenadas normalizadas (u ao longo / v através) do layout para
 *    posições de MUNDO, respeitando a ORIENTAÇÃO do corredor (N-S ou E-W).
 *  - Hospedar spikes, atiradores (ArrowTrap), as flechas em voo e os 2 botões.
 *  - Rodar o update de tudo e aplicar dano via Player.takeDamage.
 *  - Resolver o puzzle co-op: enquanto os DOIS botões não estiverem
 *    pressionados ao mesmo tempo (por holdFrames), o corredor fica TRANCADO.
 *
 * Orientação:
 *   O corredor liga duas portas opostas. Deduzimos o eixo pelas portas da
 *   célula: se tem N e S -> eixo vertical (along = Y); se E e W -> horizontal
 *   (along = X). O sentido "entrada->saída" (u 0->1) segue a ordem natural
 *   (cima->baixo ou esquerda->direita); como o layout é simétrico o bastante,
 *   o sentido não quebra a jogabilidade.
 */
export class ChallengeCorridor {
    /**
     * @param {object} layout  definição (de ChallengeLayouts)
     * @param {object} bounds   bounds jogáveis da célula { minX,maxX,minY,maxY }
     * @param {object} doors    { N,S,E,W: bool } portas da célula
     * @param {object} assets   AssetLoader (para o sprite dos spikes)
     */
    constructor(layout, bounds, doors, assets) {
        this.layout = layout;
        this.bounds = bounds;
        this.name = layout.name;

        // Eixo principal do corredor. Regra simples e robusta: se há porta
        // vertical (N ou S) trata como vertical; se só há portas horizontais
        // (E/W), trata como horizontal.
        this.vertical = !!(doors && (doors.N || doors.S));
        if (doors && (doors.E || doors.W) && !(doors.N || doors.S)) this.vertical = false;

        this.spikes = [];
        this.arrowTraps = [];
        this.arrows = [];
        this.buttons = [];

        // Sem 2 botões não há puzzle de botões a resolver: nasce "resolvido"
        // (quem controla o trancamento é a regra da sala — ver Room.lockRule).
        this.solved = false;
        this.holdTimer = 0;

        // Margem interna para não colar os elementos nas paredes.
        this._pad = 36;

        this._build(assets);
    }

    // Centro de mundo (px) do tile (col,row). A célula tem 1 tile de parede, de
    // modo que bounds.minX/minY coincidem com o início do tile de índice 1.
    _tileToWorld(col, row) {
        return {
            x: this.bounds.minX + (col - 1 + 0.5) * TILE,
            y: this.bounds.minY + (row - 1 + 0.5) * TILE
        };
    }

    // Resolve a posição de mundo de um elemento: por tile (col,row) se o editor
    // forneceu, senão pelas coordenadas normalizadas (u,v) do layout autoral.
    _elemWorld(el, u = el.u, v = el.v) {
        if (el.col !== undefined && el.row !== undefined) {
            return this._tileToWorld(el.col, el.row);
        }
        return this._toWorld(u, v);
    }

    // Converte (u,v) normalizados -> (x,y) no mundo.
    // u = ao longo do corredor (0 entrada -> 1 saída); v = através (0..1).
    _toWorld(u, v) {
        const b = this.bounds;
        const pad = this._pad;
        if (this.vertical) {
            const x = b.minX + pad + v * (b.maxX - b.minX - pad * 2);
            const y = b.minY + pad + u * (b.maxY - b.minY - pad * 2);
            return { x, y };
        } else {
            const x = b.minX + pad + u * (b.maxX - b.minX - pad * 2);
            const y = b.minY + pad + v * (b.maxY - b.minY - pad * 2);
            return { x, y };
        }
    }

    // Direção de disparo de um atirador conforme o código do layout.
    //   across+/across- = perpendicular ao corredor (atravessa a passagem)
    //   along+/along-   = ao longo do corredor (na direção do movimento)
    _fireDir(code) {
        if (this.vertical) {
            switch (code) {
                case "across+": return { x: 1, y: 0 };
                case "across-": return { x: -1, y: 0 };
                case "along+":  return { x: 0, y: 1 };
                case "along-":  return { x: 0, y: -1 };
            }
        } else {
            switch (code) {
                case "across+": return { x: 0, y: 1 };
                case "across-": return { x: 0, y: -1 };
                case "along+":  return { x: 1, y: 0 };
                case "along-":  return { x: -1, y: 0 };
            }
        }
        return { x: 1, y: 0 };
    }

    _build(assets) {
        const peaks = assets && assets.peaks ? assets.peaks : null;

        for (const el of this.layout.elements) {
            const byTile = el.col !== undefined && el.row !== undefined;
            switch (el.type) {
                case "spike": {
                    const p = this._elemWorld(el);
                    this.spikes.push(new SpikeTrap(p.x, p.y, peaks, { phaseOffset: el.phase || 0 }));
                    break;
                }
                case "spikeRow": {
                    const count = el.count || 4;
                    for (let i = 0; i < count; i++) {
                        const phase = ((el.phase || 0) + i * (el.wave || 0)) % 1;
                        let p;
                        if (byTile) {
                            // Tiles consecutivos a partir de (col,row).
                            p = this._tileToWorld(el.col + i, el.row);
                        } else {
                            // Distribui ao longo do eixo "através" (v de 0..1).
                            const v = (i + 0.5) / count;
                            p = this._toWorld(el.u, v);
                        }
                        this.spikes.push(new SpikeTrap(p.x, p.y, peaks, { phaseOffset: phase }));
                    }
                    break;
                }
                case "arrow": {
                    const p = this._elemWorld(el);
                    const dir = this._fireDir(el.dir || "across+");
                    this.arrowTraps.push(new ArrowTrap(p.x, p.y, dir, { phaseOffset: el.phase || 0 }));
                    break;
                }
                case "button": {
                    const p = this._elemWorld(el);
                    this.buttons.push(new PressureButton(p.x, p.y));
                    break;
                }
            }
        }
    }

    // O corredor começa TRANCADO e só abre quando o puzzle é resolvido.
    get locked() {
        return !this.solved;
    }

    update(players) {
        // Spikes
        for (const s of this.spikes) s.update(players);

        // Atiradores + flechas
        const onFire = (arrow) => this.arrows.push(arrow);
        for (const t of this.arrowTraps) t.update(onFire);
        for (let i = this.arrows.length - 1; i >= 0; i--) {
            this.arrows[i].update(players, this.bounds);
            if (this.arrows[i].dead) this.arrows.splice(i, 1);
        }

        // Botões + resolução co-op (os DOIS pressionados ao mesmo tempo).
        for (const b of this.buttons) b.update(players);
        if (!this.solved) {
            const allPressed = this.buttons.length >= 2 && this.buttons.every(b => b.pressed);
            if (allPressed) {
                this.holdTimer++;
                if (this.holdTimer >= HAZARDS.challenge.holdFrames) this.solved = true;
            } else {
                this.holdTimer = 0;
            }
        }
    }

    // Elementos que devem entrar na ordenação por profundidade (desenhados
    // junto com players/inimigos). Spikes e botões ficam no chão; melhor
    // desenhá-los ANTES das entidades. As flechas voam por cima.
    drawFloorLayer(ctx) {
        for (const b of this.buttons) b.draw(ctx);
        for (const s of this.spikes) s.draw(ctx);
    }

    drawWallLayer(ctx) {
        for (const t of this.arrowTraps) t.draw(ctx);
    }

    drawAirLayer(ctx) {
        for (const a of this.arrows) a.draw(ctx);
    }
}
