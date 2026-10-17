/**
 * PlayerAI — IA simples e opcional para controlar o Jogador 1 (Amarelo).
 *
 * Serve APENAS para testar o jogo sozinho: quando ligada, ela "finge" ser um
 * jogador humano, injetando as mesmas teclas virtuais que o P1 já consome
 * (w/s/a/d) no InputHandler, uma vez por passo de simulação, ANTES do
 * p1.update(). Assim não precisamos mexer na física nem na lógica do Player.
 *
 * Como ligar/desligar:
 *   - Tecla "I" alterna a IA (toggle por toque).
 *   - Via console:  window.playerAI.toggle()  /  .enable()  /  .disable()
 *
 * O que ela faz (nessa ordem de prioridade):
 *   1) COMBATE — havendo inimigos vivos, posiciona o P1 de modo que a SERRA
 *      (que fica no meio da corrente, entre os dois players) passe por cima do
 *      inimigo mais próximo, e mantém o P1 em MOVIMENTO orbitando o alvo (a
 *      serra só gira quando os dois players andam, então ficar parado não mata).
 *   2) PORTA — sem inimigos e com o humano (P2) encostando numa porta aberta, o
 *      P1 vai para o mesmo vão, para disparar a transição (que exige os dois).
 *   3) SEGUIR — caso contrário, acompanha o P2 para manter a corrente conectada.
 *
 * Em todos os casos, DESVIA de buracos: antes de aceitar uma direção, checa o
 * ponto logo à frente; se for abismo, varre ângulos alternativos até achar um
 * caminho seguro (steering simples).
 */
export class PlayerAI {
    /**
     * @param {object} opts
     * @param {InputHandler} opts.input    onde as teclas virtuais são injetadas
     * @param {() => object}  opts.getP1    retorna o Player 1
     * @param {() => object}  opts.getP2    retorna o Player 2
     * @param {() => object}  opts.getRoom  retorna a Room atual (para os inimigos)
     * @param {(x:number,y:number)=>boolean} opts.isHoleAt  ponto do mundo é buraco?
     * @param {() => Array}   opts.getDoors portas abertas da sala atual
     * @param {string[]}      [opts.controls]  teclas do P1 [up, down, left, right]
     */
    constructor({ input, getP1, getP2, getRoom, isHoleAt, getDoors, controls = ["w", "s", "a", "d"] }) {
        this.input = input;
        this.getP1 = getP1;
        this.getP2 = getP2;
        this.getRoom = getRoom;
        this.isHoleAt = isHoleAt || (() => false);
        this.getDoors = getDoors || (() => []);
        this.controls = controls; // [up, down, left, right]

        this.enabled = false;

        // --- Combate ---
        // A serra mira no inimigo. O P1 tenta ficar do lado OPOSTO ao P2 em
        // relação ao inimigo, para que o meio da corrente (a serra) caia sobre
        // ele. Orbita o alvo (sentido alterna às vezes) mantendo movimento.
        this.orbitDir = 1;            // sentido do giro ao redor do alvo
        this.orbitFlipTimer = 0;      // conta passos até trocar de sentido
        this.orbitFlipEvery = 90;     // ~1.5s a 60fps

        // --- Seguir o P2 ---
        this.followDistance = 70;     // distância confortável atrás do humano

        // --- Portas ---
        // Quando o P2 está perto/dentro de uma porta aberta, o P1 corre pro vão.
        this.doorApproachRange = 170; // o quão perto o P2 precisa estar da porta

        // --- Desvio de buracos ---
        this.lookAhead = 26;          // distância (px) à frente que a IA "olha"
        // Ângulos (graus) testados ao redor da direção desejada quando há buraco.
        this.avoidAngles = [25, -25, 50, -50, 75, -75, 100, -100, 130, -130, 160, -160];

        // Alterna a IA com a tecla "I" (toggle por toque, não por frame).
        if (typeof window !== "undefined") {
            window.addEventListener("keydown", (e) => {
                if (e.key.toLowerCase() === "i" && !e.repeat) this.toggle();
            });
            window.playerAI = this; // atalho de console para os testes
        }
    }

    enable() { this.enabled = true; this._log(); }
    disable() { this.enabled = false; this._log(); }
    toggle() { this.enabled = !this.enabled; this._log(); }

    _log() {
        if (typeof console !== "undefined") {
            console.log(`[PlayerAI] IA do P1 ${this.enabled ? "LIGADA" : "DESLIGADA"}`);
        }
    }

    /**
     * Injeta as teclas de movimento do P1 para este passo de simulação. Deve ser
     * chamado DEPOIS de input.pollGamepads() e ANTES de p1.update().
     * Desligada: não faz nada (controle volta ao jogador humano).
     */
    update() {
        if (!this.enabled) return;

        const p1 = this.getP1?.();
        const p2 = this.getP2?.();
        if (!p1) return;

        if (this.orbitFlipTimer-- <= 0) {
            this.orbitDir *= -1;
            this.orbitFlipTimer = this.orbitFlipEvery;
        }

        // Decide o VETOR de movimento desejado (dir.x, dir.y) conforme o estado.
        let dir = this._combatDir(p1, p2);
        if (!dir) dir = this._doorDir(p1, p2);
        if (!dir) dir = this._followDir(p1, p2);

        // Limpa as teclas do P1 (não deixa resíduo de passos anteriores).
        const [up, down, left, right] = this.controls;
        const keys = this.input.keys;
        keys.delete(up); keys.delete(down); keys.delete(left); keys.delete(right);

        if (!dir || (dir.x === 0 && dir.y === 0)) return;

        // Desvia de buracos: ajusta a direção desejada para uma segura.
        const safe = this._avoidHoles(p1, dir.x, dir.y);
        if (!safe) return; // cercado por buraco: melhor parar que cair

        // Traduz o vetor nas teclas virtuais (zona morta evita zigue-zague).
        const dead = 0.33;
        if (safe.y < -dead) keys.add(up);
        else if (safe.y > dead) keys.add(down);
        if (safe.x < -dead) keys.add(left);
        else if (safe.x > dead) keys.add(right);
    }

    // ---- Estados de decisão (retornam um vetor {x,y} normalizado ou null) ----

    // COMBATE: mira a serra no inimigo mais próximo e orbita mantendo movimento.
    _combatDir(p1, p2) {
        const enemy = this._nearestEnemy(p1);
        if (!enemy) return null;

        // Ponto ONDE o P1 deveria estar para a serra (meio da corrente) cair
        // sobre o inimigo: do lado oposto ao P2 em relação ao inimigo.
        let desiredX, desiredY;
        if (p2) {
            const ex = enemy.x - p2.x;
            const ey = enemy.y - p2.y;
            const em = Math.hypot(ex, ey) || 1;
            // Reflete o P2 através do inimigo (P1 fica do outro lado).
            desiredX = enemy.x + (ex / em) * 60;
            desiredY = enemy.y + (ey / em) * 60;
        } else {
            desiredX = enemy.x;
            desiredY = enemy.y;
        }

        let dx = desiredX - p1.x;
        let dy = desiredY - p1.y;
        const dist = Math.hypot(dx, dy);

        // Perto do ponto ideal: ORBITA o inimigo (tangente) em vez de parar, para
        // manter os dois players andando (a serra só gira assim) e passar o disco
        // repetidamente sobre o alvo.
        if (dist < 24) {
            const ox = p1.x - enemy.x;
            const oy = p1.y - enemy.y;
            const om = Math.hypot(ox, oy) || 1;
            // Tangente (perpendicular ao raio), no sentido atual de órbita.
            const tx = -oy / om * this.orbitDir;
            const ty = ox / om * this.orbitDir;
            return { x: tx, y: ty };
        }

        return { x: dx / dist, y: dy / dist };
    }

    // PORTA: se o P2 está encostando numa porta aberta, vai para o mesmo vão.
    _doorDir(p1, p2) {
        if (!p2) return null;
        const doors = this.getDoors?.() || [];
        if (!doors.length) return null;

        // Porta que o P2 está mais perto de atravessar.
        let best = null, bestD = Infinity;
        for (const d of doors) {
            const dd = Math.hypot(d.x - p2.x, d.y - p2.y);
            if (dd < bestD) { bestD = dd; best = d; }
        }
        if (!best || bestD > this.doorApproachRange) return null;

        // Mira um pouco ALÉM da porta (na direção de saída), para o P1 realmente
        // adentrar o vão junto com o humano e disparar a transição.
        const off = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] }[best.dir] || [0, 0];
        const tx = best.x + off[0] * 40;
        const ty = best.y + off[1] * 40;
        let dx = tx - p1.x, dy = ty - p1.y;
        const m = Math.hypot(dx, dy) || 1;
        return { x: dx / m, y: dy / m };
    }

    // SEGUIR: acompanha o P2 mantendo uma folga (não cola).
    _followDir(p1, p2) {
        if (!p2) return null;
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);
        if (dist < this.followDistance) return { x: 0, y: 0 };
        return { x: dx / dist, y: dy / dist };
    }

    // ---- Helpers ----

    // Inimigo vivo mais próximo do P1 (ignora morrendo/escondidos na intro).
    _nearestEnemy(p1) {
        const room = this.getRoom?.();
        const enemies = room?.enemies || [];
        let nearest = null, nd = Infinity;
        for (const e of enemies) {
            if (e.state === "dying" || e.isHidden) continue;
            const d = Math.hypot(e.x - p1.x, e.y - p1.y);
            if (d < nd) { nd = d; nearest = e; }
        }
        return nearest;
    }

    /**
     * Dado um vetor de movimento desejado, devolve um vetor SEGURO (sem buraco à
     * frente). Testa a direção original e, se cair em abismo, varre ângulos ao
     * redor dela até achar passagem. Retorna null se tudo à frente é buraco.
     */
    _avoidHoles(p1, dx, dy) {
        if (!this.isHoleAt) return { x: dx, y: dy };

        const clear = (ang) => {
            const nx = Math.cos(ang), ny = Math.sin(ang);
            const probeX = p1.x + nx * this.lookAhead;
            const probeY = p1.y + ny * this.lookAhead;
            return !this.isHoleAt(probeX, probeY);
        };

        const base = Math.atan2(dy, dx);
        if (clear(base)) return { x: dx, y: dy };

        for (const deg of this.avoidAngles) {
            const ang = base + (deg * Math.PI) / 180;
            if (clear(ang)) return { x: Math.cos(ang), y: Math.sin(ang) };
        }
        return null; // sem saída segura
    }
}
