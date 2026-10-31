import { Physics } from '../core/Physics.js';
import { PLAYER_SAFE_ZONE, MAX_ACTIVE_GIBS, HEART_DROP } from '../config/GameConfig.js';
import { ENEMY_HIT, HIT_FEEL, DAMAGE_NUMBER } from '../config/CombatFeelConfig.js';
import { ARAUTO_FX } from '../config/ArautoEffectsConfig.js';

const HIT_COMBO_WINDOW_MS = 900;
const HIT_COMBO_PITCH_STEP = 0.035;
const HIT_COMBO_MAX_STEPS = 5;

export class CombatSystem {
    // `hitFeedback` liga o feedback novo de acerto (impacto, números, stagger). Desligado, o comportamento
    // é o antigo: os trailers usam o CombatSystem sem ele.
    constructor({ renderer, particleSystem, audio = null, hitFeedback = false, arautoEffects = null, arautoAudio = null }) {
        this.arautoAudio = arautoAudio;
        this.arautoEffects = arautoEffects;
        this.renderer = renderer;
        this.particleSystem = particleSystem;
        this.audio = audio;
        this.hitFeedback = hitFeedback;
        this._combo = 0;
        this._lastHitAt = -Infinity;
    }

    _now() {
        return globalThis.performance?.now?.() ?? Date.now();
    }

    _playSawHit(count, heavy = false) {
        if (!this.audio) return;
        const now = this._now();
        this._combo = now - this._lastHitAt < HIT_COMBO_WINDOW_MS ? this._combo + 1 : 0;
        this._lastHitAt = now;
        const step = Math.min(this._combo, HIT_COMBO_MAX_STEPS);
        const boost = heavy ? HIT_FEEL.poiseBreakAudio : null;
        this.audio.play("sawHit", {
            rateMultiplier: (1 + step * HIT_COMBO_PITCH_STEP) * (boost?.rateMultiplier ?? 1),
            volumeMultiplier: Math.min(1.35, 1 + (count - 1) * 0.15) * (boost?.volumeMultiplier ?? 1)
        });
        this.audio.duck?.(heavy ? -9 : -7, { attackMs: 10, holdMs: 90, releaseMs: 500 });
    }

    // Ponto de contato e direção do golpe (da fonte para o inimigo). Disco tem prioridade sobre o cabo.
    _impact(enemy, source) {
        let dirX = enemy.x - source.x;
        let dirY = enemy.y - source.y;
        const d = Math.hypot(dirX, dirY);
        if (d > 0.001) { dirX /= d; dirY /= d; }
        else if (source.fallbackDir) { dirX = source.fallbackDir.x; dirY = source.fallbackDir.y; }
        else { dirX = 0; dirY = -1; }
        const reach = source.radius ? Math.min(d, source.radius) : 0;
        return { x: source.x + dirX * reach, y: source.y + dirY * reach, dirX, dirY, source: source.kind };
    }

    updateEnemies(enemies, players) {
        for (const e of enemies) {
            e.update(players, (hitPlayer) => {
                this.renderer.triggerShake(e.effectMaterial === 'lavaStone' ? ARAUTO_FX.playerShake : 14);
                if (hitPlayer) {
                    if (e.effectMaterial !== 'lavaStone') this.audio?.play('playerHurt');
                    this.particleSystem.triggerBlood(hitPlayer.x, hitPlayer.y, 16, 1.1);
                }
            });
            if (this.audio) {
                if (e.justStepped) this.audio.play("enemyStep");
                if (e.justAttacked && !e.isGhostfire && e.effectMaterial !== 'lavaStone') {
                    this.audio.play("enemyAttack");
                    this.audio.play("enemyAttackVoice");
                }
            }
            if (e.justAttacked && e.effectMaterial === 'lavaStone') this.arautoEffects?.attack();
            if (e.justSlammed) {
                if (e.effectMaterial === 'lavaStone') {
                    this.arautoEffects?.groundHit(e, true);
                    this.arautoAudio?.groundHit(true);
                } else this._slamFeedback(e);
            } else if (e.justGroundHit) {
                this.arautoEffects?.groundHit(e);
                this.arautoAudio?.groundHit();
            }
            e.emitEmbers?.(this.particleSystem);
        }
    }

    // Impacto de aterrissagem do chefe: tremor forte e poeira em anel.
    _slamFeedback(enemy) {
        this.renderer.triggerShake(18);
        const n = 10;
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            const cx = Math.cos(a), cy = Math.sin(a);
            this.particleSystem.triggerDust?.(enemy.x + cx * 40, enemy.y + enemy.hitRadius * 0.6 + cy * 16, cx, cy, 3);
        }
        this.audio?.play("playerFall");
    }

    // `onKill(enemy)` roda só quando o golpe mata. `onHit(enemy, info)` roda em todo golpe aceito, com
    // info = { damage, killed, poiseBroken, staggered, x, y, dirX, dirY, hitStop }.
    resolveWeaponHits(weapon, enemies, p1, p2, connected = true, onKill = null, onHit = null) {
        if (!connected) return;

        const saws = weapon.getSawPositions ? weapon.getSawPositions(p1, p2) : [];
        const discR = (saws.length && weapon.discRadius) ? weapon.discRadius : 0;
        let hits = 0;
        let heavy = false;

        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            if (enemy.state === "dying") continue;

            const d = Physics.distToSegment(enemy.x, enemy.y, p1.x, p1.y, p2.x, p2.y);
            const dP1 = Math.hypot(enemy.x - p1.x, enemy.y - p1.y);
            const dP2 = Math.hypot(enemy.x - p2.x, enemy.y - p2.y);
            const nearPlayer = dP1 < PLAYER_SAFE_ZONE || dP2 < PLAYER_SAFE_ZONE;

            const contact = weapon.obstacleContacts?.get(enemy);
            const solidContact = enemy.immovable && !enemy.ignoresEntityCollisions && weapon.obstacleContacts;
            const hitChain = solidContact ? contact?.kind === 'chain'
                : !nearPlayer && d < weapon.hitThreshold + enemy.hitRadius;
            const sawPos = discR > 0
                ? saws.find(s => Math.hypot(enemy.x - s.x, enemy.y - s.y) < discR + enemy.hitRadius)
                : null;
            const hitDisc = solidContact ? contact?.kind === 'disc' : !!sawPos;

            if (hitChain || hitDisc) {
                if (!this.hitFeedback) {
                    if (enemy.takeHit) { if (!enemy.takeHit()) continue; }
                    else enemy.startDying();
                    weapon.onHit?.({ blood: enemy.effectMaterial !== 'lavaStone' });
                    if (enemy.effectMaterial !== 'lavaStone') hits++;
                    if (this.audio) this.audio.play("monsterHurt");
                    this.renderer.triggerShake(10);
                    if (enemy.effectMaterial === 'lavaStone') this._materialHit(enemy,
                        { x: enemy.x, y: enemy.y, dirX: 0, dirY: -1 });
                    else this.particleSystem.triggerBlood(enemy.x, enemy.y, 10, 0.9);
                    onKill?.(enemy);
                    continue;
                }

                const impact = contact
                    ? this._impact(enemy, { x: contact.x, y: contact.y, kind: contact.kind })
                    : hitDisc
                    ? this._impact(enemy, { x: sawPos.x, y: sawPos.y, radius: discR, kind: "disc" })
                    : this._impact(enemy, {
                        ...Physics.closestPointOnSegment(enemy.x, enemy.y, p1.x, p1.y, p2.x, p2.y),
                        kind: "chain",
                        fallbackDir: { x: -(p2.y - p1.y), y: p2.x - p1.x }
                    });

                let result = true;
                if (enemy.takeHit) {
                    result = enemy.takeHit(ENEMY_HIT.sawDamage, impact);
                    if (!result) continue;
                } else enemy.startDying();

                const info = this._hitInfo(enemy, result, impact);
                weapon.onHit?.({ blood: enemy.effectMaterial !== 'lavaStone' });
                if (enemy.effectMaterial !== 'lavaStone') hits++;
                heavy = heavy || info.poiseBroken;
                this._hitFeedback(enemy, info);
                onHit?.(enemy, info);
                if (info.killed) onKill?.(enemy);
            }
        }

        if (hits > 0) this._playSawHit(hits, heavy);
    }

    feedbackForHit(enemy, result, impact) {
        const info = this._hitInfo(enemy, result, impact);
        this._hitFeedback(enemy, info);
        if (enemy.effectMaterial !== 'lavaStone') this._playSawHit(1, info.poiseBroken);
        return info;
    }

    _hitInfo(enemy, result, impact) {
        const r = typeof result === "object" ? result : {};
        const killed = r.killed ?? (enemy.state === "dying");
        const poiseBroken = !!r.poiseBroken;
        const tier = killed ? "kill" : poiseBroken ? "poiseBreak" : "hit";
        return {
            damage: r.damage ?? ENEMY_HIT.sawDamage,
            killed,
            poiseBroken,
            staggered: !!r.staggered,
            tier,
            hitStop: HIT_FEEL.hitStop[tier],
            x: impact.x,
            y: impact.y,
            dirX: impact.dirX,
            dirY: impact.dirY
        };
    }

    // Efeitos do contato. O som é o sawHit tocado uma vez por chamada em _playSawHit (monsterHurt segue
    // desativado e sem arquivos: não conta como feedback).
    _hitFeedback(enemy, info) {
        const ps = this.particleSystem;
        const fx = HIT_FEEL;
        const { tier } = info;

        this.audio?.play("monsterHurt");
        this.renderer.triggerShake(fx.shake[tier]);

        ps.triggerHitSparks?.(info.x, info.y, info.dirX, info.dirY, fx.sparks[tier], fx.sparks.power, fx.sparks.cone);
        ps.triggerFlash?.(info.x, info.y, fx.glint.amount, fx.glint.power);
        if (enemy.effectMaterial === 'lavaStone') {
            this._materialHit(enemy, info);
        } else if (info.killed) {
            ps.triggerBlood(enemy.x, enemy.y, 10, 0.9);
        } else {
            ps.triggerHitBlood?.(info.x, info.y, info.dirX, info.dirY, fx.blood[tier], fx.blood.spread);
            ps.triggerDust?.(info.x, info.y, -info.dirX, -info.dirY, fx.dust[tier]);
        }

        const top = enemy.y - (enemy.drawHeight ?? 40) / 2 - 6;
        ps.triggerDamageNumber?.(enemy.x, top, info.damage, {
            color: info.killed ? DAMAGE_NUMBER.killColor : info.poiseBroken ? DAMAGE_NUMBER.breakColor : DAMAGE_NUMBER.color
        });
        ps.triggerDamageCombo?.(enemy, top, info.damage, { killed: info.killed });
    }

    _materialHit(enemy, info) {
        if (this.arautoEffects) this.arautoEffects.hit(enemy, info);
        else this.particleSystem.triggerLavaDebris?.(info.x, info.y, ARAUTO_FX.contactPieces,
            { dirX: -info.dirX, dirY: -info.dirY, groundY: enemy.footY });
    }

    resolveDeaths(room, gibs, onKill = null, players = []) {
        const enemies = room.enemies;
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            if (!enemy.readyToGib) continue;

            // Chefe com escombros: sem sangue de desmembramento nem gibs; fica como corpo decorativo.
            if (enemy.leavesCorpse) {
                enemy.becomeCorpse();
                (room.corpses ??= []).push(enemy);
            } else {
                this.particleSystem.triggerBlood(enemy.x, enemy.y, 26, 1.35);
                this.particleSystem.triggerBloodPool(enemy.x, enemy.y);
                gibs.push(...enemy.explodeIntoGibs());
                while (gibs.length > MAX_ACTIVE_GIBS) gibs.shift();
            }

            if (this.canDropHeart(room, players)) {
                const chanceField = room.cell.heartDropChance;
                const pct = Number.isFinite(chanceField) ? chanceField : HEART_DROP.chance;
                if (Math.random() < pct / 100) room.addHeart(enemy.x, enemy.y);
            }

            room.removeEnemyAt(i);
            this.renderer.triggerShake(7);
            onKill?.(enemy);
        }
    }

    canDropHeart(room, players) {
        const missing = players.reduce(
            (sum, p) => sum + Math.max(0, HEART_DROP.maxLives - (p?.lives ?? HEART_DROP.maxLives)), 0
        );
        return missing > (room.hearts?.length ?? 0);
    }
}
