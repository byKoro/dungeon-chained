import { Physics } from './Physics.js';

/**
 * Chain — a corrente que une os dois jogadores e porta a arma ativa.
 *
 * Responsabilidades (antes espalhadas no main.js):
 *  - Manter a tensão elástica entre os jogadores.
 *  - Arrebentar quando eles insistem em se separar (empurrão elástico) e
 *    deixá-los DESARMADOS; reconectar ao se reaproximarem.
 *  - Portar a arma ativa (laser/serra), trocar entre elas e aplicar o dano
 *    aos inimigos apenas quando conectada.
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
     * @param {object} events callbacks opcionais { onSnap, onReconnect }
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
                events.onSnap?.();
            }
        } else if (this.reconnectCooldown <= 0 && dist < this.reconnectDistance) {
            // Desarmados: reconecta ao se reaproximarem
            this.connected = true;
            events.onReconnect?.();
        }

        // Mantém a animação da arma (ex.: giro das serras) rodando
        this.weapon.update();
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

    // Desenha a arma/corrente apenas quando conectada.
    draw(ctx, p1, p2) {
        if (this.connected) this.weapon.draw(ctx, p1, p2);
    }
}
