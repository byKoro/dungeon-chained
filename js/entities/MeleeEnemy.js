import { TILE } from '../config/GameConfig.js';
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
 *     attack2, attack3: (opcionais, mesmo formato)
 *     death:  { row, frames, fps }
 *   },
 *   body: { x, y, w, h },   // opcional: corpo na célula (âncora/altura)
 *   gib:  { gridCols, gridRows, box: { x, y, w, h } }  // box opcional
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
        this.attackKeys = ["attack", "attack2", "attack3"].filter(k => this.sprite.rows[k]);
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
        this.stepDistance = 0;
        this.justStepped = false;
        this.justAttacked = false;

        this.navigationFloor = null;
        this.navigationBounds = null;
        this.navigationWalls = new Set();
        this.lastSafePosition = { x, y };

        // Congelamento de INTRO: enquanto `frozen` é true o inimigo fica parado
        // (sem IA, sem mover, sem atacar). Usado na sequência de entrada da sala:
        // os inimigos aparecem com partícula e só "ganham vida" quando a intro
        // termina e o Game chama unfreeze(). `spawnFx` é um timer (frames) do
        // efeito de aparição, usado no draw para um fade-in/sobe suave.
        this.frozen = false;
        // Duração da REVELAÇÃO de baixo para cima (frames). Mais longa que o
        // fade antigo para acompanhar a coluna de fogo subindo e revelando o
        // inimigo pouco a pouco.
        this.spawnFxDuration = 40; // ~0.66s a 60fps
        this.spawnFx = 0;
        // Atraso (frames) antes de o inimigo APARECER. Enquanto > 0 ele fica
        // invisível e inerte: permite escalonar o spawn (cada inimigo surge num
        // instante diferente, de forma desordenada). `justAppeared` fica true no
        // único frame em que o delay zera — o Game usa isso para disparar a
        // chama de aparição na posição do inimigo.
        this.spawnDelay = 0;
        this.justAppeared = false;
    }

    // Começa congelado (intro de sala). `delay` (frames) adia a aparição: o
    // inimigo fica invisível/inerte até lá e só então toca o efeito de spawn.
    beginFrozenSpawn(delay = 0) {
        this.frozen = true;
        this.spawnDelay = Math.max(0, delay | 0);
        // Só arma o fade-in agora se não houver atraso; com atraso, o fade-in
        // começa quando o delay zera (ver update).
        this.spawnFx = this.spawnDelay > 0 ? 0 : this.spawnFxDuration;
        this.justAppeared = this.spawnDelay === 0;
        this.vx = this.vy = this.pushVx = this.pushVy = 0;
    }

    // true enquanto o inimigo ainda não apareceu (está no atraso de spawn).
    get isHidden() {
        return this.spawnDelay > 0;
    }

    // Altura do sprite desenhado no mundo (px). O sprite é desenhado centrado
    // em this.y, então vai de (y - drawHeight/2) no topo a (y + drawHeight/2)
    // na base (os pés).
    // Com `sprite.body` (caixa do corpo dentro da célula), a altura é a do
    // CORPO, não do recorte inteiro (que inclui golpes/efeitos largos).
    get drawHeight() {
        const s = this.sprite;
        if (s?.body) return s.body.h * (s.drawHeight / s.cropH);
        return s?.drawHeight ?? 44;
    }

    // Y (coords da célula) que fica alinhado a this.y. Por padrão é o centro
    // do recorte; com `sprite.body`, o centro do corpo — assim golpes que
    // sobem/descem muito não deslocam o boneco da posição de colisão.
    _anchorY() {
        const s = this.sprite;
        return s.body ? s.body.y + s.body.h / 2 : s.cropY + s.cropH / 2;
    }

    // Coordenada Y da BASE do sprite (os pés, onde o fogo deve nascer no chão).
    get footY() {
        return this.y + this.drawHeight / 2;
    }

    // Libera o inimigo para agir (fim da intro).
    unfreeze() {
        this.frozen = false;
    }


    setNavigationFloor(floor, bounds, walls = []) {
        this.navigationFloor = floor;
        this.navigationBounds = bounds;
        this.lastSafePosition = { x: this.x, y: this.y };
    }

    _tileAt(x, y) {
        const col = Math.floor((x - this.navigationBounds.minX) / TILE) + 1;
        const row = Math.floor((y - this.navigationBounds.minY) / TILE) + 1;
        return { col, row };
    }

    _isWalkable(x, y) {
        if (!this.navigationFloor || !this.navigationBounds) return true;
        const { col, row } = this._tileAt(x, y);
        return row > 0 && row < this.navigationFloor.length - 1 &&
            col > 0 && col < (this.navigationFloor[row] || []).length - 1 &&
            this.navigationFloor[row][col] !== -1 &&
            !this.navigationWalls.has(String(col) + "," + String(row));
    }


    _hasClearWalkablePath(target) {
        if (!this.navigationFloor || !this.navigationBounds) return true;
        const dx = target.x - this.x, dy = target.y - this.y;
        const steps = Math.ceil(Math.hypot(dx, dy) / (TILE / 4));
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            if (!this._isWalkable(this.x + dx * t, this.y + dy * t)) return false;
        }
        return true;
    }
    _chaseWaypoint(target) {
        if (!this.navigationFloor || !this.navigationBounds) return target;
        const start = this._tileAt(this.x, this.y);
        const goal = this._tileAt(target.x, target.y);
        if (!this._isWalkable(this.x, this.y) || !this._isWalkable(target.x, target.y)) return null;
        const key = (col, row) => String(col) + "," + String(row);
        const startKey = key(start.col, start.row);
        const goalKey = key(goal.col, goal.row);
        const queue = [start];
        const previous = new Map([[startKey, null]]);
        const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (let q = 0; q < queue.length && !previous.has(goalKey); q++) {
            const cell = queue[q];
            for (const [dc, dr] of directions) {
                const col = cell.col + dc, row = cell.row + dr;
                if (row <= 0 || row >= this.navigationFloor.length - 1 || col <= 0 || col >= this.navigationFloor[row].length - 1) continue;
                if (this.navigationFloor[row][col] === -1 || this.navigationWalls.has(String(col) + "," + String(row))) continue;
                const nextKey = key(col, row);
                if (previous.has(nextKey)) continue;
                previous.set(nextKey, key(cell.col, cell.row));
                queue.push({ col, row });
            }
        }
        if (!previous.has(goalKey)) return null;
        let stepKey = goalKey;
        let parentKey = previous.get(stepKey);
        while (parentKey && parentKey !== startKey) { stepKey = parentKey; parentKey = previous.get(stepKey); }
        if (stepKey === startKey) return target;
        const [col, row] = stepKey.split(",").map(Number);
        return { x: this.navigationBounds.minX + (col - 0.5) * TILE, y: this.navigationBounds.minY + (row - 0.5) * TILE };
    }

    ensureOnWalkableTile() {
        if (this._isWalkable(this.x, this.y)) {
            this.lastSafePosition = { x: this.x, y: this.y };
            return;
        }
        this.x = this.lastSafePosition.x;
        this.y = this.lastSafePosition.y;
        this.vx = this.vy = this.pushVx = this.pushVy = 0;
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
        // `gib.box` (opcional) = caixa do corpo caído no último frame de morte;
        // sem ela, picota o recorte inteiro (comportamento original).
        const gib = s.gib || {};
        const box = gib.box || { x: s.cropX, y: s.cropY, w: s.cropW, h: s.cropH };
        const death = s.rows.death;
        const deathFrame = death.frames - 1;
        const baseSrcX = deathFrame * cell + box.x;
        const baseSrcY = death.row * cell + box.y;
        const cw = box.w, ch = box.h;
        // Ponto da célula que corresponde a (this.x, this.y) no mundo.
        const anchorX = s.body ? cell / 2 : s.cropX + s.cropW / 2;
        const anchorY = this._anchorY();

        const pieces = [];

        // Grade fina de picotamento. Configurável por sprite via gib.gridCols/Rows.
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
                const offX = (box.x + (c + 0.5) * pieceW - anchorX) * scale;
                const offY = (box.y + (r + 0.5) * pieceH - anchorY) * scale;

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
        this.justStepped = false;
        this.justAttacked = false;

        // Congelado na intro: fica totalmente parado (sem IA, sem dano) e só
        // avança o timer do efeito de aparição. Não anima o ciclo de andar
        // (fica na pose parada) nem persegue/ataca.
        if (this.frozen) {
            this.vx = this.vy = this.pushVx = this.pushVy = 0;
            this.justAppeared = false;
            if (this.spawnDelay > 0) {
                // Ainda esperando a vez de aparecer (invisível).
                this.spawnDelay--;
                if (this.spawnDelay === 0) {
                    // Chegou a vez: materializa agora (arma o fade-in e sinaliza
                    // ao Game para soltar a chama neste frame).
                    this.spawnFx = this.spawnFxDuration;
                    this.justAppeared = true;
                }
                return;
            }
            if (this.spawnFx > 0) this.spawnFx--;
            return;
        }

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
                const waypoint = this._chaseWaypoint(this.target);
                if (waypoint) {
                    const angle = Math.atan2(waypoint.y - this.y, waypoint.x - this.x);
                    this.vx = this.vx * 0.85 + Math.cos(angle) * this.speed * 0.15;
                    this.vy = this.vy * 0.85 + Math.sin(angle) * this.speed * 0.15;
                } else {
                    this.vx *= 0.5;
                    this.vy *= 0.5;
                }

                if (distToTarget <= this.attackRange && this._hasClearWalkablePath(this.target)) {
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
                    this.justAttacked = true;
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
                    if (distToTarget <= this.hitRange && this._hasClearWalkablePath(this.target)) {
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

        if (this.state === "chase" && this.speedMag > 0.35) {
            this.stepDistance += this.speedMag;
            if (this.stepDistance >= 48) {
                this.stepDistance %= 48;
                this.justStepped = true;
            }
        } else if (this.state !== "chase") {
            this.stepDistance = 0;
        }
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
        // Ainda no atraso de spawn (intro): invisível até chegar sua vez.
        if (this.isHidden) return;

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
        // Idem na vertical: alinha o ponto-âncora (centro do corpo, se houver
        // `body`) a this.y. Sem `body` o deslocamento é 0 (centro do recorte).
        const cropCenterOffsetY = ((s.cropY + ch / 2) - this._anchorY()) * scale;

        // Efeito de APARIÇÃO (spawn na intro): o inimigo é REVELADO de baixo
        // para cima, como se emergisse do fogo que sobe do chão. `t` vai de 0
        // (recém-nascido, invisível) a 1 (totalmente revelado).
        let revealT = 1;
        if (this.spawnFx > 0 && this.spawnFxDuration > 0) {
            revealT = 1 - this.spawnFx / this.spawnFxDuration; // 0 -> 1
        }

        ctx.save();
        ctx.translate(this.x, this.y);
        if (this.facingLeft) ctx.scale(-1, 1);
        // Alinha sprite e manchas ao centro real do boneco na célula
        ctx.translate(cropCenterOffset, cropCenterOffsetY);

        // Enquanto revela, recorta a região VISÍVEL: só a parte do sprite ABAIXO
        // da "linha do fogo", que começa na base (pés) e sobe até o topo. Em
        // coords locais o recorte ocupa de -drawH/2 (topo) a +drawH/2 (base);
        // com `body`, a revelação percorre só a altura do corpo.
        if (revealT < 1) {
            const top = s.body ? (s.body.y - s.cropY) * scale - drawH / 2 : -drawH / 2;
            const bottom = s.body ? (s.body.y + s.body.h - s.cropY) * scale - drawH / 2 : drawH / 2;
            // Linha de revelação: em t=0 está na base; em t=1 chega ao topo.
            const revealLineY = bottom - (bottom - top) * revealT;
            ctx.beginPath();
            // Largura folgada para cobrir o sprite inteiro mesmo com flip.
            ctx.rect(-drawW, revealLineY, drawW * 2, drawH / 2 - revealLineY + 2);
            ctx.clip();
        }

        ctx.drawImage(
            this.sheet,
            srcX, srcY, cw, ch,
            -drawW / 2, -drawH / 2, drawW, drawH
        );

        ctx.restore();
    }
}
