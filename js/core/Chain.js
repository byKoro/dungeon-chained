import { Physics } from './Physics.js';

/**
 * Chain — a corrente que une os dois jogadores e porta a arma ativa.
 *
 * Responsabilidades (antes espalhadas no main.js):
 *  - Manter a tensão elástica entre os jogadores.
 *  - Arrebentar quando eles insistem em se separar (empurrão elástico) e
 *    deixá-los DESARMADOS; reconectar quando os dois voltam até a lâmina
 *    largada no chão.
 *  - Portar a arma ativa (serras) e aplicar o dano aos inimigos apenas
 *    quando conectada.
 *  - Desenhar a arma/corrente (só quando conectada).
 *
 * Ajuste o comportamento pelo objeto de configuração passado no construtor.
 */
export class Chain {
    constructor(weapons, config = {}) {
        this.weapons = weapons;
        this.weaponIndex = 0;

        // --- Configuração (todos os "dials" da corrente em um só lugar) ---
        this.rest = config.rest ?? 130;               // distância de repouso
        this.stiffness = config.stiffness ?? 0.02;    // tensão da mola
        this.breakDistance = config.breakDistance ?? 240; // corte seco extremo
        this.strainDistance = config.strainDistance ?? 165; // acima disto acumula esforço
        this.strainLimit = config.strainLimit ?? 30;  // frames insistindo p/ arrebentar
        this.reconnectDistance = config.reconnectDistance ?? 110;
        this.snapImpulse = config.snapImpulse ?? 12;   // empurrão ao arrebentar
        this.reconnectDelay = config.reconnectDelay ?? 20;
        // Raio em volta da lâmina largada: os DOIS jogadores precisam estar
        // dentro dele para recolhê-la e reconectar.
        this.pickupRadius = config.pickupRadius ?? 60;

        // Zona morta: perto do corpo do player a arma não mata (deixa o inimigo
        // encostar e causar dano).
        this.playerSafeZone = config.playerSafeZone ?? 46;

        // --- Estado ---
        this.connected = true;
        this.strain = 0;
        this.reconnectCooldown = 0;
    }

    reset() {
        this.connected = true;
        this.strain = 0;
        this.reconnectCooldown = 0;
        // Garante que a lâmina não fique "largada" ao reiniciar/trocar de sala.
        this.weapon.pickup?.();
    }

    get weapon() {
        return this.weapons[this.weaponIndex];
    }

    get name() {
        return this.weapon.name;
    }

    get isConnected() {
        return this.connected;
    }

    cycleWeapon() {
        this.weaponIndex = (this.weaponIndex + 1) % this.weapons.length;
        return this.weapon;
    }

    /**
     * Atualiza tensão, ruptura e reconexão da corrente.
     * @param {object} p1 jogador 1
     * @param {object} p2 jogador 2
     * @param {object} events callbacks opcionais { onSnap, onReconnect,
     *   resolveDropPoint(x, y) -> {x, y} }
     */
    update(p1, p2, events = {}) {
        if (this.reconnectCooldown > 0) this.reconnectCooldown--;
        const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);

        if (this.connected) {
            // Tensão elástica suave enquanto conectada
            Physics.applyChainConstraint(p1, p2, this.rest, this.stiffness);

            // Acumula "insistência" enquanto esticada; alivia se relaxa
            if (dist > this.strainDistance) this.strain++;
            else this.strain = Math.max(0, this.strain - 2);

            // Arrebenta por afastamento extremo (seco) OU insistência sustentada
            if (dist > this.breakDistance || this.strain >= this.strainLimit) {
                const nx = (p2.x - p1.x) / (dist || 1);
                const ny = (p2.y - p1.y) / (dist || 1);
                p1.vx -= nx * this.snapImpulse;
                p1.vy -= ny * this.snapImpulse;
                p2.vx += nx * this.snapImpulse;
                p2.vy += ny * this.snapImpulse;
                this.connected = false;
                this.strain = 0;
                this.reconnectCooldown = this.reconnectDelay;

                // DROP: a lâmina cai e fica flutuando no chão (item coletável)
                // no ponto exato onde a serra estava no instante da ruptura.
                const sp = this.weapon.getSawPositions?.(p1, p2)?.[0];
                const rawX = sp ? sp.x : (p1.x + p2.x) / 2;
                const rawY = sp ? sp.y : (p1.y + p2.y) / 2;
                // O jogo pode corrigir o ponto (ex.: tirar a lâmina de cima de
                // um buraco/parede) para ela nunca ficar inalcançável.
                const fixed = events.resolveDropPoint?.(rawX, rawY) ?? { x: rawX, y: rawY };
                this.weapon.drop?.(fixed.x, fixed.y);

                events.onSnap?.();
            }
        } else if (this.reconnectCooldown <= 0 && this._canReconnect(p1, p2, dist)) {
            // Desarmados: reconecta quando os DOIS chegam até a lâmina largada
            // — ela é "recolhida" e a corrente volta a uni-los.
            this.connected = true;
            this.weapon.pickup?.();
            events.onReconnect?.();
        }

        // Nível de tensão 0..1 para o feedback visual (pisca/treme antes de
        // arrebentar). Combina a "insistência" acumulada com o quão perto a
        // distância está do ponto de ruptura.
        let strainLevel = 0;
        if (this.connected) {
            const byStrain = this.strain / this.strainLimit;
            const span = this.breakDistance - this.strainDistance;
            const byDist = span > 0 ? (dist - this.strainDistance) / span : 0;
            strainLevel = Math.max(0, Math.min(1, Math.max(byStrain, byDist)));
        }

        // Mantém a animação da arma rodando. Passa os jogadores para que a
        // arma possa reagir ao movimento (ex.: a serra só gira quando andam) e
        // o nível de tensão para o feedback de ruptura iminente.
        this.weapon.setStrain?.(strainLevel);
        this.weapon.update(p1, p2);

        // Desconectada: avança a animação da lâmina largada no chão (flutuação,
        // feixe de luz, giro residual).
        if (!this.connected) this.weapon.updateDropped?.();
    }

    /**
     * Desconecta SEM empurrão (ex.: um jogador caiu no buraco) e larga a
     * lâmina no ponto devolvido por `resolveDropPoint(x, y)` — partindo de
     * onde a serra estava. Retorna true se havia corrente para soltar.
     */
    forceDrop(p1, p2, resolveDropPoint) {
        if (!this.connected) return false;
        this.connected = false;
        this.strain = 0;
        this.reconnectCooldown = this.reconnectDelay;
        const sp = this.weapon.getSawPositions?.(p1, p2)?.[0];
        const rawX = sp ? sp.x : (p1.x + p2.x) / 2;
        const rawY = sp ? sp.y : (p1.y + p2.y) / 2;
        const fixed = resolveDropPoint?.(rawX, rawY) ?? { x: rawX, y: rawY };
        this.weapon.drop?.(fixed.x, fixed.y);
        return true;
    }

    /**
     * Regra de reconexão. Com a lâmina largada no chão, AMBOS os jogadores
     * precisam estar a até `pickupRadius` dela — só se aproximar um do outro
     * não basta. Armas sem estado de drop caem na regra antiga (distância
     * entre os jogadores).
     */
    _canReconnect(p1, p2, dist) {
        const w = this.weapon;
        if (!w.dropped) return dist < this.reconnectDistance;

        const r = this.pickupRadius;
        const d1 = Math.hypot(p1.x - w.dropX, p1.y - w.dropY);
        const d2 = Math.hypot(p2.x - w.dropX, p2.y - w.dropY);
        return d1 < r && d2 < r;
    }

    /**
     * Aplica o golpe da arma aos inimigos (só quando conectada). Para cada
     * inimigo atingido no miolo da corrente, chama onHit(enemy).
     */
    applyToEnemies(p1, p2, enemies, onHit) {
        if (!this.connected) return;

        const w = this.weapon;
        for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i];
            const d = Physics.distToSegment(e.x, e.y, p1.x, p1.y, p2.x, p2.y);
            const dP1 = Math.hypot(e.x - p1.x, e.y - p1.y);
            const dP2 = Math.hypot(e.x - p2.x, e.y - p2.y);
            const nearPlayer = dP1 < this.playerSafeZone || dP2 < this.playerSafeZone;

            if (e.state !== "dying" && !nearPlayer
                && d < w.hitThreshold + e.hitRadius) {
                onHit(e);
            }
        }
    }

    // Camada ao FUNDO da arma (corrente), sempre atrás das entidades. Só
    // quando conectada.
    drawChain(ctx, p1, p2) {
        if (this.connected) this.weapon.drawChain(ctx, p1, p2);
    }

    // Desenha a arma (disco) apenas quando conectada.
    draw(ctx, p1, p2) {
        if (this.connected) this.weapon.draw(ctx, p1, p2);
    }

    // Desenha a LÂMINA DROPADA (flutuando no chão) apenas quando desconectada.
    drawDropped(ctx) {
        if (!this.connected) this.weapon.drawDropped?.(ctx);
    }

    // Posição (mundo) da lâmina largada no chão, ou null se não estiver dropada.
    // O Game usa isto para registrar uma LUZ própria da lâmina (ela brilha).
    getDroppedLight() {
        if (this.connected || !this.weapon.dropped) return null;
        return { x: this.weapon.dropX, y: this.weapon.dropY, hover: this.weapon.dropHover ?? 0 };
    }
}
