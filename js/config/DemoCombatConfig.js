export const DEMO_ENEMY_STATS = {
    assassin: { hp: 1, speed: 2.8, windupFrames: 26, recoverFrames: 22 },
    // poise > 0 = inimigo forte: acumula poise, tem stagger curto e stun longo ao romper (ver ENEMY_HIT).
    tank: { hp: 4, poise: 3, speed: 1.1, windupFrames: 65, recoverFrames: 40 }
};

export const FIRE_SKULL = {
    hp: 2, radius: 20, drawSize: 64, shotInterval: 110, shotWindup: 35,
    projectileSpeed: 3.2, projectileRadius: 8, projectileLife: 180,
    hitCooldown: 24, deathFrames: 12, frameTicks: 9,
    boss: { hp: 12, radius: 36, drawSize: 112, teleportInterval: 360,
        summonInterval: 480, summonCount: 2, maxMinions: 6,
        laserInterval: 270, laserWindup: 65, laserFrames: 50, laserWidth: 48 }
};
