import assert from 'node:assert/strict';
import { SpawnSystem } from '../js/systems/SpawnSystem.js';
import { GhostfireSystem } from '../js/systems/GhostfireSystem.js';
import { GHOSTFIRE } from '../js/config/GhostfireConfig.js';
import { CombatSystem } from '../js/combat/CombatSystem.js';

const assets = {
  get: () => ({})
};

const spawner = new SpawnSystem({ assets, bloodCanvas: { palette: null } });
const foe = spawner.createEnemy(100, 200, 1, 'ghostfire');

assert.equal(foe.isBoss, true, 'ghostfire deve criar boss especial');
assert.equal(foe.health, GHOSTFIRE.health, 'boss deve usar a vida do Ghostfire do trailer');
assert.equal(foe.state, 'appear', 'boss deve entrar na arena antes de invocar');
assert.deepEqual(GHOSTFIRE.summonTypes, ['hellbat', 'demonessA', 'demonessB'], 'minions do summon devem seguir o trailer');

const ghostfireSystem = new GhostfireSystem({
  spawnSystem: { createEnemy: () => ({}) },
  particleSystem: { triggerFlameBurst() {} },
  renderer: { triggerShake() {} },
  audio: null
});

const minion = {
  isBoss: false,
  state: 'chase',
  frozen: false,
  x: 50,
  y: 0,
  hitRadius: 10,
  startDying() { this.state = 'dying'; }
};

const room = {
  enemies: [
    { isBoss: true, isGhostfire: true, frozen: false, state: 'beam', x: 0, y: 0, beam: { x: 0, y: 0, endX: 200, endY: 0 }, justSummoned: false, justAttacked: false, justTeleported: false, stateTimer: 0 },
    minion
  ],
  tiles: { floor: [[0]], walls: [] }
};

ghostfireSystem.update(room, []);
assert.equal(minion.state, 'dying', 'inimigo acertado pelo raio de fogo do boss deve morrer');

const floor = Array.from({ length: 9 }, () => Array(14).fill(16));
const bounds = { minX: 64, minY: 64, maxX: 832, maxY: 512 };
foe.setNavigationFloor(floor, bounds);
const firstX = foe.x;
assert.equal(foe.side, 'right');
const releaseBoss = spawner.createEnemy(700, 280, 1, 'ghostfire');
releaseBoss._enter('summon', GHOSTFIRE.summonFrames);
const releaseFrames = [];
for (let i = 1; i <= GHOSTFIRE.summonFrames; i++) {
    releaseBoss.update([]);
    if (releaseBoss.justSummoned) releaseFrames.push(i);
}
assert.deepEqual(releaseFrames, [GHOSTFIRE.summonReleaseFrame], 'cuspida lança uma única bola para a onda inteira');
const player = { x: 350, y: 300, lives: 3, hitRadius: 16, takeDamage() { this.lives--; return true; } };
const advance = frames => { for (let i = 0; i < frames; i++) foe.update([player]); };
advance(GHOSTFIRE.appearFrames + GHOSTFIRE.roarFrames + GHOSTFIRE.summonFrames + GHOSTFIRE.waitFrames);
assert.equal(foe.state, 'charge');
assert.equal(foe.justCharging, true);
advance(GHOSTFIRE.chargeFrames);
assert.equal(foe.state, 'indicator');
assert.equal(foe.beam.y, foe.beam.endY, 'raio horizontal como no trailer');
assert.equal(foe.beam.endX, bounds.minX);
assert.equal(foe.beam.x, foe.x - GHOSTFIRE.sprite.mouthOffset * GHOSTFIRE.sprite.scale, 'raio sai da boca');
const lockedY = foe.beam.y;
player.y = 430;
advance(GHOSTFIRE.indicatorFrames);
assert.equal(player.lives, 3, 'aviso não causa dano');
assert.equal(foe.beam.y, lockedY, 'mira deve travar antes do disparo');
assert.deepEqual(foe.visualFrame, { row: 3, frame: 4 }, 'disparo usa o frame do trailer');
player.y = lockedY;
advance(1);
assert.equal(player.lives, 2, 'feixe ativo causa dano');
player.y = 430;
advance(GHOSTFIRE.beamFrames - 1);
assert.equal(foe.state, 'fade');
advance(GHOSTFIRE.fadeFrames + GHOSTFIRE.recoverFrames + GHOSTFIRE.teleportFrames);
assert.equal(foe.side, 'left', 'boss troca de lado após o feixe');
assert(foe.x < firstX);
assert.equal(foe.state, 'appear');

advance(GHOSTFIRE.appearFrames);
let hits = 0;
const combat = new CombatSystem({
    renderer: { triggerShake() {} },
    particleSystem: { triggerBlood() {} }
});
const saw = { getSawPositions: () => [{ x: foe.x, y: foe.y }], discRadius: 30, hitThreshold: 8, onHit() { hits++; } };
const p1 = { x: foe.x - 100, y: foe.y }, p2 = { x: foe.x + 100, y: foe.y };
combat.resolveWeaponHits(saw, [foe], p1, p2);
assert.equal(foe.health, GHOSTFIRE.health - 1, 'serra respeita pontos de vida do boss');
assert.notEqual(foe.state, 'dying', 'um contato não mata o boss');
combat.resolveWeaponHits(saw, [foe], p1, p2);
assert.equal(hits, 1, 'contato contínuo respeita invulnerabilidade temporária');
for (let i = 1; i < GHOSTFIRE.health; i++) {
    foe.hitCooldown = 0;
    combat.resolveWeaponHits(saw, [foe], p1, p2);
}
assert.equal(foe.state, 'dying');
assert.equal(foe.beam, null);
advance(GHOSTFIRE.deathFrames - 1);
assert.equal(foe.readyToGib, false, 'animação de morte termina antes dos gibs');
advance(1);
assert.equal(foe.readyToGib, true);

const survivingMinion = { isBoss: false, state: 'chase', startDying() { this.state = 'dying'; } };
const aftermath = { enemies: [foe, survivingMinion] };
ghostfireSystem.update(aftermath, []);
assert.equal(survivingMinion.state, 'dying', 'explosão final limpa os minions como no trailer');

const feedbackBoss = spawner.createEnemy(400, 280, 1, 'ghostfire');
const feedbackCombat = new CombatSystem({
    renderer: { triggerShake() {} }, particleSystem: { triggerBlood() {} }, hitFeedback: true
});
const feedbackSaw = { getSawPositions: () => [{ x: 400, y: 280 }], discRadius: 30, hitThreshold: 8 };
const feedbackPlayers = [{ x: 300, y: 280 }, { x: 500, y: 280 }];
const acceptedHits = [], kills = [];
const strike = () => feedbackCombat.resolveWeaponHits(feedbackSaw, [feedbackBoss], ...feedbackPlayers, true,
    enemy => kills.push(enemy), (enemy, info) => acceptedHits.push(info));
strike();
assert.equal(feedbackBoss.health, GHOSTFIRE.health, 'feedback novo respeita imunidade na chegada');
feedbackBoss._enter('wait', GHOSTFIRE.waitFrames);
strike();
strike();
assert.equal(feedbackBoss.health, GHOSTFIRE.health - 1, 'feedback novo respeita vida e cooldown do Ghostfire');
assert.equal(acceptedHits.length, 1);
assert.equal(kills.length, 0, 'golpe não letal não dispara callback de morte');
feedbackBoss.freezeOnHit(1 / 60);
const timerBeforeHitStop = feedbackBoss.stateTimer;
feedbackBoss.update([]);
assert.equal(feedbackBoss.stateTimer, timerBeforeHitStop, 'hit stop local pausa o ciclo do boss');
for (let i = 1; i < GHOSTFIRE.health; i++) {
    feedbackBoss.hitCooldown = 0;
    strike();
}
assert.equal(kills.length, 1);
assert.equal(acceptedHits.at(-1).killed, true);

const fireSkullBoss = spawner.createEnemy(400, 280, 1, 'fireSkullBoss');
const untouchedMinion = { isBoss: false, state: 'chase', startDying() { this.state = 'dying'; } };
const otherBossRoom = { enemies: [fireSkullBoss, untouchedMinion] };
const attackSounds = [];
const audioCombat = new CombatSystem({
    renderer: {}, particleSystem: {}, audio: { play(cue) { attackSounds.push(cue); } }
});
fireSkullBoss.state = 'shotWarning';
fireSkullBoss.stateTimer = 1;
audioCombat.updateEnemies([fireSkullBoss], [{ x: 300, y: 280, lives: 3 }]);
assert(attackSounds.includes('enemyAttack'), 'FireSkull boss mantém áudio genérico de ataque');
attackSounds.length = 0;
const silentGhostfire = spawner.createEnemy(400, 280, 1, 'ghostfire');
silentGhostfire._enter('indicator', 1);
audioCombat.updateEnemies([silentGhostfire], []);
assert.equal(attackSounds.length, 0, 'Ghostfire usa apenas seu áudio dedicado');
ghostfireSystem.renderLights(otherBossRoom, { worldToScreen() { assert.fail('Ghostfire não ilumina outro boss'); } }, {});
fireSkullBoss.state = 'dying';
ghostfireSystem.update(otherBossRoom, []);
assert.equal(untouchedMinion.state, 'chase', 'morte de outro boss não dispara explosão do Ghostfire');
assert.equal(spawner.createEnemy(100, 200, 1, 'cultist').constructor.name, 'CultistEnemy');

console.log('PASS ghostfire boss test');
