import { Entity } from './Entity.js';
import { GibPiece } from '../particles/GibPiece.js';
import { BloodStains } from '../particles/BloodStains.js';

/**
 * Inimigo corpo a corpo (melee) padronizado.
 *
 * Comportamento: vai até o player > para (windup/telegrafo) > tenta atacar.
 * Durante o windup o player tem uma JANELA DE ESQUIVA: se sair do alcance a
 * tempo, o golpe erra. Essa janela encolhe conforme o andar (floor) avança,
 * deixando os inimigos mais rápidos/agressivos.
 *
 * O sprite é configurável (spriteConfig) para que outros inimigos melee
 * reutilizem exatamente a mesma lógica, só trocando a folha e as linhas de
 * animação. Layout esperado: grade de células, linhas = tipos de animação.
 *
 * spriteConfig = {
 *   img, cellSize, cropX, cropY, cropW, cropH, drawHeight,
 *   rows: {
 *     walk:   { row, frames, fps },
 *     attack: { row, frames, fps, hitFrame },  // hitFrame = quando o golpe conecta
 *     death:  { row, frames, fps }
 *   }
 * }
 */
export class MeleeEnemy extends Entity {
    constructor(x, y, sheet, spriteConfig, floor = 1) {
        super(x, y, 18);
        this.sheet = sheet;
        this.sprite = spriteConfig;
        this.isSkeleton = false; // compat. com código antigo de partículas

        // Movimento
        this.speed = 1.7;

        // Alcances
        this.attackRange = 44;   // distância para parar e iniciar o ataque
        this.hitRange = 58;      // alcance efetivo do golpe (um pouco maior que attackRange)

        // Janela de esquiva (windup), em frames. Diminui com o andar.
        this.baseWindup = 55;
        this.windupFrames = Math.max(16, this.baseWindup - (floor - 1) * 6);
        this.recoverFrames = 28;

        // Estado
        this.state = "chase";    // chase | windup | attack | recover | dying | dead
        this.stateTimer = 0;
        this.dealtHit = false;   // evita aplicar dano mais de uma vez por ataque

        // Morte impactante: ao ser atingido, o inimigo TRAVA e pisca branco por
        // poucos frames (hit stop) e só então se parte em gibs.
        this.dyingTimer = 0;
        this.dyingDuration = 9;  // ~0.15s a 60fps: rápido, mas perceptível

        // Ataques disponíveis (o demon tem 2). Escolhido aleatoriamente por golpe.
        this.attackKeys = ["attack", "attack2"].filter(k => this.sprite.rows[k]);
        this.currentAttack = this.attackKeys[0] || "attack";

        this.bloodPalette = null;   // definida externamente (paleta da textura)
        this.gibStainConfig = null; // config das manchas dos fragmentos (gibs)

        // Velocidade de empurrão (física de colisão). É separada do movimento da
        // IA para que o empurrão NÃO seja engolido pelo amortecimento dos estados
        // de ataque. A física escreve aqui; aplicamos à posição todo frame.
        this.pushVx = 0;
        this.pushVy = 0;

        // Animação
        this.animTime = 0;       // acumulador de tempo (frames)
        this.deathDone = false;  // morte terminou de tocar (corpo parado no chão)
        this.corpseTimer = 0;    // tempo desde que virou cadáver (para escurecer)

        this.target = null;
    }

    get isDead() {
        return this.state === "dead";
    }

    // true enquanto está na travada/flash de morte (ainda não virou gibs).
    get isDying() {
        return this.state === "dying";
    }

    // true no frame em que a travada de morte termina (hora de explodir em gibs).
    get readyToGib() {
        return this.state === "dying" && this.dyingTimer <= 0;
    }

    // Chamado pela arma/corrente quando o inimigo é atingido. Não explode na
    // hora: entra no estado "dying" (trava + pisca branco) por poucos frames.
    startDying() {
        if (this.state === "dying" || this.state === "dead") return;
        // Congela a pose atual (a "travada brusca" na posição em que apanhou).
        const anim = this._currentAnim();
        this._frozen = { anim, frame: this._currentFrameIndex(anim) };
        this.state = "dying";
        this.dyingTimer = this.dyingDuration;
        this.vx = 0;
        this.vy = 0;
        this.pushVx = 0;
        this.pushVy = 0;
    }

    // Picota o inimigo em VÁRIOS fragmentos pequenos (gibs) recortados do
    // próprio sprite, fatiando a bbox numa grade fina. Cada pedaço é
    // posicionado com o offset relativo à sua fatia e é arrastável pela física.
    explodeIntoGibs() {
        const s = this.sprite;
        const cell = s.cellSize;
        const scale = s.drawHeight / s.cropH;

        // Usa o ÚLTIMO frame da animação de morte (corpo caído/estirado) como
        // fonte dos recortes, para os fragmentos parecerem o inimigo no chão.
        const death = s.rows.death;
        const deathFrame = death.frames - 1;
        const baseSrcX = deathFrame * cell + s.cropX;
        const baseSrcY = death.row * cell + s.cropY;
        const cw = s.cropW, ch = s.cropH;

        const pieces = [];

        // Grade fina de picotamento. Configurável por sprite via gib.gridCols/Rows.
        const gib = s.gib || {};
        const cols = gib.gridCols ?? 5;
        const rows = gib.gridRows ?? 4;
        const pieceW = cw / cols;
        const pieceH = ch / rows;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                // Recorte da célula desta fatia (com leve jitter nas bordas)
                const jx = (Math.random() - 0.5) * pieceW * 0.25;
                const jy = (Math.random() - 0.5) * pieceH * 0.25;
                const sx = baseSrcX + c * pieceW + Math.max(0, jx);
                const sy = baseSrcY + r * pieceH + Math.max(0, jy);
                const sw = Math.min(pieceW, cw - (c * pieceW));
                const sh = Math.min(pieceH, ch - (r * pieceH));

                // Offset do pedaço em relação ao centro do boneco (mundo)
                const offX = ((c + 0.5) * pieceW - cw / 2) * scale;
                const offY = ((r + 0.5) * pieceH - ch / 2) * scale;

                const gibPiece = new GibPiece(
                    this.x + offX, this.y + offY,
                    this.sheet,
                    sx, sy, sw, sh,
                    sw * scale, sh * scale
                );

                // Suja o pedaço com manchas de sangue permanentes (configurável).
                // Poucas por pedaço, já que agora há muitos fragmentos pequenos.
                const gcfg = this.gibStainConfig || {};
                const st = new BloodStains();
                st.splatter({
                    count: gcfg.count ?? 2,
                    spread: Math.min(sw, sh) * scale * 0.45,
                    life: gcfg.life ?? Infinity,
                    palette: this.bloodPalette,
                    sizeMin: gcfg.sizeMin ?? 1,
                    sizeMax: gcfg.sizeMax ?? 3,
                    alpha: gcfg.alpha ?? 0.9
                });
                gibPiece.setStains(st);

                pieces.push(gibPiece);
            }
        }

        return pieces;
    }

    update(players, onPlayerHit) {
        this.animTime++;

        if (this.state === "dying") {
            // Travado no lugar (hit stop), piscando branco. Não se move, não
            // persegue, não ataca. Só conta o tempo até virar gibs.
            this.vx = 0; this.vy = 0;
            this.pushVx = 0; this.pushVy = 0;
            if (this.dyingTimer > 0) this.dyingTimer--;
            return;
        }

        if (this.state === "dead") {
            // Cadáver: desacelera qualquer resíduo e conta o tempo caído
            this.vx *= 0.8;
            this.vy *= 0.8;
            this.corpseTimer++;
            const d = this.sprite.rows.death;
            const dur = d.frames * d.fps;
            if (this.animTime >= dur) this.deathDone = true;
            this._applyPush();
            super.update();
            return;
        }

        // Escolhe o player mais próximo como alvo
        const d1 = Math.hypot(players[0].x - this.x, players[0].y - this.y);
        const d2 = Math.hypot(players[1].x - this.x, players[1].y - this.y);
        this.target = d1 < d2 ? players[0] : players[1];
        const distToTarget = Math.min(d1, d2);

        // Encara o alvo enquanto prepara/ataca (quando a velocidade é ~0 e o
        // facing por velocidade do Entity não é confiável).
        if (this.state === "windup" || this.state === "attack" || this.state === "recover") {
            this.facingLeft = (this.target.x < this.x);
        }

        switch (this.state) {
            case "chase": {
                // Persegue o alvo
                const angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
                this.vx = this.vx * 0.85 + Math.cos(angle) * this.speed * 0.15;
                this.vy = this.vy * 0.85 + Math.sin(angle) * this.speed * 0.15;

                if (distToTarget <= this.attackRange) {
                    // Chegou perto: para e inicia o windup (telegrafo do golpe)
                    this.state = "windup";
                    this.stateTimer = this.windupFrames;
                    this.animTime = 0;
                    this.dealtHit = false;
                }
                break;
            }

            case "windup": {
                // Parado, "carregando" o ataque. Janela de esquiva para o player.
                this.vx *= 0.6;
                this.vy *= 0.6;
                this.stateTimer--;
                if (this.stateTimer <= 0) {
                    // Escolhe aleatoriamente um dos ataques disponíveis
                    this.currentAttack = this.attackKeys[
                        Math.floor(Math.random() * this.attackKeys.length)
                    ];
                    const atk = this.sprite.rows[this.currentAttack];
                    this.state = "attack";
                    this.stateTimer = atk.frames * atk.fps;
                    this.animTime = 0;
                    this.dealtHit = false;
                }
                break;
            }

            case "attack": {
                // Desfere o golpe. No frame de impacto, se o player ainda estiver
                // no alcance (não esquivou), causa dano.
                this.vx *= 0.5;
                this.vy *= 0.5;

                const atk = this.sprite.rows[this.currentAttack];
                const hitAt = (atk.hitFrame ?? Math.floor(atk.frames / 2)) * atk.fps;
                if (!this.dealtHit && this.animTime >= hitAt) {
                    this.dealtHit = true;
                    if (distToTarget <= this.hitRange) {
                        if (this.target.takeDamage(this.x, this.y)) {
                            onPlayerHit(this.target);
                        }
                    }
                }

                this.stateTimer--;
                if (this.stateTimer <= 0) {
                    this.state = "recover";
                    this.stateTimer = this.recoverFrames;
                    this.animTime = 0;
                }
                break;
            }

            case "recover": {
                // Pequena pausa após atacar antes de voltar a perseguir
                this.vx *= 0.7;
                this.vy *= 0.7;
                this.stateTimer--;
                if (this.stateTimer <= 0) {
                    this.state = "chase";
                    this.animTime = 0;
                }
                break;
            }
        }

        this._applyPush();
        super.update();
    }

    // Soma o empurrão da física à posição e o faz decair. Assim o empurrão
    // funciona em qualquer estado, mesmo quando a IA amortece a velocidade.
    _applyPush() {
        this.x += this.pushVx;
        this.y += this.pushVy;
        this.pushVx *= 0.85;
        this.pushVy *= 0.85;
        if (Math.abs(this.pushVx) < 0.01) this.pushVx = 0;
        if (Math.abs(this.pushVy) < 0.01) this.pushVy = 0;
    }

    // Frame atual da animação da linha ativa
    _currentAnim() {
        const r = this.sprite.rows;
        switch (this.state) {
            case "dying":  return (this._frozen && this._frozen.anim) || r.walk;
            case "dead":   return r.death;
            case "attack": return r[this.currentAttack] || r.attack;
            case "windup":
            case "recover":
            case "chase":
            default:       return r.walk;
        }
    }

    _currentFrameIndex(anim) {
        if (this.state === "dying") {
            // Pose congelada no momento do golpe (travada brusca)
            return this._frozen ? this._frozen.frame : 0;
        }
        if (this.state === "dead") {
            // Toca uma vez e trava no último frame (corpo estirado)
            const idx = Math.floor(this.animTime / anim.fps);
            return Math.min(idx, anim.frames - 1);
        }
        if (this.state === "windup") {
            // Parado no primeiro frame de andar (postura de "preparar")
            return 0;
        }
        if (this.state === "attack") {
            const idx = Math.floor(this.animTime / anim.fps);
            return Math.min(idx, anim.frames - 1);
        }
        // walk / recover: loop contínuo
        return Math.floor(this.animTime / anim.fps) % anim.frames;
    }

    draw(ctx) {
        if (!this.sheet || !this.sheet.complete || this.sheet.naturalWidth === 0) return;

        const s = this.sprite;
        const anim = this._currentAnim();
        const frame = this._currentFrameIndex(anim);
        const cell = s.cellSize;
        const cw = s.cropW, ch = s.cropH;

        // Por padrão usa a linha/coluna da animação atual.
        let srcRow = anim.row;
        let srcCol = frame;

        // Durante a travada de morte, pisca alternando entre o frame BRANCO
        // (sprite dedicado) e a pose congelada, se o sprite tiver deathFlash.
        if (this.state === "dying" && s.deathFlash) {
            const blink = Math.floor(this.dyingTimer / 2) % 2 === 0;
            if (blink) {
                srcRow = s.deathFlash.row;
                srcCol = s.deathFlash.frame;
            }
        }

        const srcX = srcCol * cell + s.cropX;
        const srcY = srcRow * cell + s.cropY;

        const scale = s.drawHeight / ch;
        const drawW = cw * scale;
        const drawH = ch * scale;

        // Offset horizontal do centro do RECORTE em relação ao centro da CÉLULA.
        // Se o recorte não estiver centralizado na célula, desenhar em -drawW/2
        // faria o sprite "pular" ao dar flip. Compensamos alinhando o desenho ao
        // centro da célula, tornando o espelhamento simétrico.
        const cropCenterOffset = ((s.cropX + cw / 2) - cell / 2) * scale;

        ctx.save();
        ctx.translate(this.x, this.y);
        if (this.facingLeft) ctx.scale(-1, 1);
        // Alinha sprite e manchas ao centro real do boneco na célula
        ctx.translate(cropCenterOffset, 0);

        ctx.drawImage(
            this.sheet,
            srcX, srcY, cw, ch,
            -drawW / 2, -drawH / 2, drawW, drawH
        );

        ctx.restore();
    }
}
