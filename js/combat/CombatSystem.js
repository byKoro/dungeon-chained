import { Physics } from '../core/Physics.js';
import { PLAYER_SAFE_ZONE, MAX_ACTIVE_GIBS } from '../config/GameConfig.js';

/**
 * CombatSystem — centraliza a resolução de combate.
 *
 * Antes a lógica de dano estava dividida: o dano inimigo→player vivia dentro do
 * MeleeEnemy (continua lá, é da IA dele), mas o dano arma→inimigo e toda a
 * cadeia de morte→gib→sangue estava solta no gameLoop do main.js. Aqui ela fica
 * num só lugar, operando sobre a arma, os dois players e a lista de inimigos.
 */
export class CombatSystem {
    /**
     * @param {object} opts
     * @param {Renderer} opts.renderer         para o screen shake
     * @param {ParticleSystem} opts.particleSystem  para sangue/poças
     */
    constructor({ renderer, particleSystem, audio = null }) {
        this.renderer = renderer;
        this.particleSystem = particleSystem;
        this.audio = audio;
    }

    /**
     * Atualiza todos os inimigos (IA + dano no player via callback de feedback).
     * O dano em si é aplicado dentro do MeleeEnemy; aqui só reagimos ao impacto.
     * Também dispara os sons do inimigo (passo, ataque) e o som de dano no
     * player quando um golpe conecta.
     */
    updateEnemies(enemies, players) {
        for (const e of enemies) {
            e.update(players, (hitPlayer) => {
                this.renderer.triggerShake(14);
                if (hitPlayer) {
                    if (this.audio) this.audio.play("playerHurt");
                    this.particleSystem.triggerBlood(hitPlayer.x, hitPlayer.y, 16, 1.1);
                }
            });
            if (this.audio) {
                if (e.justStepped) this.audio.play("enemyStep");
                if (e.justAttacked) {
                    this.audio.play("enemyAttack");
                    this.audio.play("enemyAttackVoice");
                }
            }
        }
    }

    /**
     * A arma é o segmento entre os dois players. Qualquer inimigo que o segmento
     * toque (fora da zona morta perto dos players) começa a morrer.
     */
    resolveWeaponHits(weapon, enemies, p1, p2) {
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            if (enemy.state === "dying") continue;

            const d = Physics.distToSegment(enemy.x, enemy.y, p1.x, p1.y, p2.x, p2.y);
            const dP1 = Math.hypot(enemy.x - p1.x, enemy.y - p1.y);
            const dP2 = Math.hypot(enemy.x - p2.x, enemy.y - p2.y);
            const nearPlayer = dP1 < PLAYER_SAFE_ZONE || dP2 < PLAYER_SAFE_ZONE;

            if (!nearPlayer && d < weapon.hitThreshold + enemy.hitRadius) {
                if (enemy.startDying()) {
                    if (this.audio) this.audio.play("monsterHurt");
                    this.renderer.triggerShake(4);
                }
            }
        }
    }

    /**
     * Converte inimigos no estado "pronto para explodir" em gibs + sangue,
     * removendo-os da sala. Devolve os novos gibs para o pool do chamador.
     * @param {Room} room    sala atual (dona da lista de inimigos)
     * @param {GibPiece[]} gibs  pool de gibs a ser alimentado (mutado)
     */
    resolveDeaths(room, gibs) {
        const enemies = room.enemies;
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            if (!enemy.readyToGib) continue;

            this.particleSystem.triggerBlood(enemy.x, enemy.y, 26, 1.35);
            this.particleSystem.triggerBloodPool(enemy.x, enemy.y);
            gibs.push(...enemy.explodeIntoGibs());
            while (gibs.length > MAX_ACTIVE_GIBS) gibs.shift();

            // Chance de dropar um coração de cura no lugar do inimigo. Usa o
            // campo autoral da célula (0..100%); sem ele, 40% por padrão.
            const chanceField = room.cell.heartDropChance;
            const dropChance = Number.isFinite(chanceField) ? chanceField / 100 : 40 / 100;
            if (Math.random() < dropChance) room.addHeart(enemy.x, enemy.y);

            room.removeEnemyAt(i);
            this.renderer.triggerShake(7);
        }
    }
}
