import { Physics } from '../core/Physics.js';
import { PLAYER_SAFE_ZONE, MAX_ACTIVE_GIBS, HEART_DROP } from '../config/GameConfig.js';

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
     *
     * @param {boolean} connected quando false (corrente arrebentada), a arma
     *   está desarmada e NÃO causa dano. Default true para compatibilidade.
     */
    resolveWeaponHits(weapon, enemies, p1, p2, connected = true, onKill = null) {
        if (!connected) return;

        // Centro e raio do DISCO da serra (no meio da curva). O dano do disco
        // cobre todo o raio visual — encostar em qualquer parte dele mata.
        const sawPos = weapon.getSawPositions ? weapon.getSawPositions(p1, p2)[0] : null;
        const discR = (sawPos && weapon.discRadius) ? weapon.discRadius : 0;

        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            if (enemy.state === "dying") continue;

            const d = Physics.distToSegment(enemy.x, enemy.y, p1.x, p1.y, p2.x, p2.y);
            const dP1 = Math.hypot(enemy.x - p1.x, enemy.y - p1.y);
            const dP2 = Math.hypot(enemy.x - p2.x, enemy.y - p2.y);
            const nearPlayer = dP1 < PLAYER_SAFE_ZONE || dP2 < PLAYER_SAFE_ZONE;

            // Acerta se tocar o CORPO da corda (segmento) OU o DISCO da serra.
            const hitChain = !nearPlayer && d < weapon.hitThreshold + enemy.hitRadius;
            const hitDisc = discR > 0 &&
                Math.hypot(enemy.x - sawPos.x, enemy.y - sawPos.y) < discR + enemy.hitRadius;

            if (hitChain || hitDisc) {
                enemy.startDying();
                weapon.onHit?.();
                if (this.audio) this.audio.play("monsterHurt");
                // IMPACT: tremida seca e forte no momento do corte, com um
                // respingo de sangue extra no ponto de contato.
                this.renderer.triggerShake(10);
                this.particleSystem.triggerBlood(enemy.x, enemy.y, 10, 0.9);
                // Slow-motion: desacelera o gameplay por um instante no abate,
                // dando peso ao golpe. O Game controla a câmera lenta de fato.
                onKill?.(enemy);
            }
        }
    }

    /**
     * Converte inimigos no estado "pronto para explodir" em gibs + sangue,
     * removendo-os da sala. Devolve os novos gibs para o pool do chamador.
     * @param {Room} room    sala atual (dona da lista de inimigos)
     * @param {GibPiece[]} gibs  pool de gibs a ser alimentado (mutado)
     * @param {Function} [onKill]
     * @param {Player[]} [players] jogadores (decidem se um coração pode cair)
     */
    resolveDeaths(room, gibs, onKill = null, players = []) {
        const enemies = room.enemies;
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            if (!enemy.readyToGib) continue;

            this.particleSystem.triggerBlood(enemy.x, enemy.y, 26, 1.35);
            this.particleSystem.triggerBloodPool(enemy.x, enemy.y);
            gibs.push(...enemy.explodeIntoGibs());
            while (gibs.length > MAX_ACTIVE_GIBS) gibs.shift();

            // Chance de dropar um coração de cura no lugar do inimigo — só
            // quando alguém precisa (ver canDropHeart). Usa o campo autoral da
            // célula (0..100%); sem ele, HEART_DROP.chance.
            if (this.canDropHeart(room, players)) {
                const chanceField = room.cell.heartDropChance;
                const pct = Number.isFinite(chanceField) ? chanceField : HEART_DROP.chance;
                if (Math.random() < pct / 100) room.addHeart(enemy.x, enemy.y);
            }

            room.removeEnemyAt(i);
            this.renderer.triggerShake(7);
            // Feedback de tela (sangue voando + flash vermelho).
            onKill?.(enemy);
        }
    }

    /**
     * Um coração só pode cair se ALGUM jogador estiver sem vida cheia, e se
     * ainda houver vida faltando que os corações já no chão não cubram.
     */
    canDropHeart(room, players) {
        const missing = players.reduce(
            (sum, p) => sum + Math.max(0, HEART_DROP.maxLives - (p?.lives ?? HEART_DROP.maxLives)), 0
        );
        return missing > (room.hearts?.length ?? 0);
    }
}
