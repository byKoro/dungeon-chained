import { InputHandler } from './core/InputHandler.js';
import { Physics } from './core/Physics.js';
import { Renderer } from './core/Renderer.js';
import { Dungeon } from './core/Dungeon.js';
import { Player } from './entities/Player.js';
import { MeleeEnemy } from './entities/MeleeEnemy.js';
import { LaserWeapon } from './weapons/LaserWeapon.js';
import { SawWeapon } from './weapons/SawWeapon.js';
import { ParticleSystem } from './particles/ParticleSystem.js';
import { BloodCanvas } from './particles/BloodCanvas.js';
import { Footprint } from './particles/Footprint.js';

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

// Elementos HUD
const hudFloor = document.getElementById("hud-floor");
const hudP1 = document.getElementById("hud-p1");
const hudP2 = document.getElementById("hud-p2");
const btnWeapon = document.getElementById("btn-weapon");
const btnRestart = document.getElementById("btn-restart");

// ---- Assets ----
const imgP1 = new Image();
imgP1.src = "assets/player_01/player_walk.png";
const imgP1Hurt = new Image();
imgP1Hurt.src = "assets/player_01/player_hurt.png";
const imgP1Scared = new Image();
imgP1Scared.src = "assets/player_01/player_walk_scared.png";
const imgP2 = new Image();
imgP2.src = "assets/player_02.png";

const imgDemon = new Image();
imgDemon.src = "assets/enemies/demon.png";
const imgBloodMonster = new Image();
imgBloodMonster.src = "assets/enemies/blood_monster.png";

// ---- Cores do sangue ----
const BLOOD_COLORS = ["#5c0210", "#7a0404", "#960e11", "#a30808", "#c60f0e"];
const BLOOD_STAIN_CONFIG = {
    gib: { count: 3, life: Infinity, sizeMin: 2, sizeMax: 4, alpha: 0.9 }
};

// ---- Configs de inimigos melee ----
function demonConfig() {
    return {
        img: imgDemon, cellSize: 100,
        cropX: 28, cropY: 34, cropW: 52, cropH: 26, drawHeight: 82,
        rows: {
            walk: { row: 1, frames: 8, fps: 6 },
            attack: { row: 2, frames: 7, fps: 5, hitFrame: 5 },
            attack2: { row: 3, frames: 7, fps: 5, hitFrame: 4 },
            death: { row: 5, frames: 4, fps: 7 }
        },
        deathFlash: { row: 0, frame: 6 },
        gib: { gridCols: 5, gridRows: 4 }
    };
}
function bloodMonsterConfig() {
    return {
        img: imgBloodMonster, cellSize: 100,
        cropX: 36, cropY: 30, cropW: 48, cropH: 30, drawHeight: 84,
        rows: {
            walk: { row: 1, frames: 8, fps: 6 },
            attack: { row: 2, frames: 8, fps: 5, hitFrame: 6 },
            attack2: { row: 3, frames: 8, fps: 5, hitFrame: 5 },
            death: { row: 5, frames: 4, fps: 7 }
        },
        deathFlash: { row: 0, frame: 6 },
        gib: { gridCols: 5, gridRows: 4 }
    };
}
const MELEE_ENEMY_CONFIGS = [demonConfig, bloodMonsterConfig];
function randomMeleeConfig() {
    return MELEE_ENEMY_CONFIGS[(Math.random() * MELEE_ENEMY_CONFIGS.length) | 0]();
}

// ---- Instâncias principais ----
const input = new InputHandler();
const renderer = new Renderer(canvas, ctx);
// O buffer de sangue cobre o mundo inteiro da dungeon (grade * célula).
const WORLD_W = 9 * 1100;
const WORLD_H = 7 * 680;
const bloodCanvas = new BloodCanvas(WORLD_W, WORLD_H, BLOOD_COLORS);
const particleSystem = new ParticleSystem(bloodCanvas);

const weapons = [new LaserWeapon(), new SawWeapon()];
let currentWeaponIndex = 0;

// ---- Estado global ----
let floor = 1;
let gameOver = false;
let p1, p2;
let dungeon;
let arenaBounds;            // bounds da sala atual (dinâmico)
let enemies = [];
let gibs = [];
const MAX_ACTIVE_GIBS = 90;
let footprints = [];
const MAX_FOOTPRINTS = 60;
const BLOOD_STEPS = 6;

// Estado das salas: por chave, guarda os inimigos/caixas gerados e se limpa.
// A sala só é "de combate" quando é room (corredores são livres).
let roomStates = new Map();

// Limite físico de afastamento entre os jogadores (a corrente é elástica, mas
// há um teto rígido para não separarem além do que a câmera comporta).
const MAX_PLAYER_SEPARATION = 620;

// Câmera / zoom dinâmico
const CAM_ZOOM_MIN = 1.05;   // afastados => zoom out
const CAM_ZOOM_MAX = 1.55;   // juntos => zoom in

function createPlayers() {
    p1 = new Player(0, 0, "#ffd166", ["w", "s", "a", "d"], imgP1, "Amarelo", {
        animated: true, frameCount: 8, cellSize: 100,
        cropX: 41, cropY: 37, cropW: 17, cropH: 23, drawHeight: 73,
        hurt: { img: imgP1Hurt, frameCount: 5, hurtFrame: 2, cellSize: 100, cropX: 42, cropY: 38, cropW: 16, cropH: 22 },
        scared: { img: imgP1Scared, frameCount: 8, cellSize: 100, cropX: 41, cropY: 37, cropW: 17, cropH: 23 }
    });
    p2 = new Player(0, 0, "#6bb4db", ["arrowup", "arrowdown", "arrowleft", "arrowright"], imgP2, "Azul", {
        animated: true, frameCount: 8, cellSize: 100,
        cropX: 39, cropY: 35, cropW: 21, cropH: 25, drawHeight: 73
    });
    p1.bloodPalette = bloodCanvas.palette;
    p2.bloodPalette = bloodCanvas.palette;
}

// Gera uma nova dungeon e posiciona os jogadores na sala inicial.
function newDungeon() {
    dungeon = new Dungeon({
        cols: 9, rows: 7, roomCount: 8,
        cellW: 1100, cellH: 680, wall: 70, doorHalf: 70
    });
    roomStates = new Map();
    gibs = [];
    footprints = [];
    particleSystem.clear();
    gameOver = false;

    const c = dungeon.current;
    const center = dungeon.cellCenter(c.gx, c.gy);
    p1.x = center.x - 30; p1.y = center.y; p1.vx = 0; p1.vy = 0;
    p2.x = center.x + 30; p2.y = center.y; p2.vx = 0; p2.vy = 0;

    // Câmera começa centrada nos jogadores
    renderer.camX = center.x;
    renderer.camY = center.y;

    enterRoom();
    updateHud();
}

// Prepara a sala atual: gera (uma vez) inimigos/caixas se for sala de combate.
function enterRoom() {
    arenaBounds = dungeon.currentBounds();
    const key = dungeon.currentKey;
    const cell = dungeon.current;

    let state = roomStates.get(key);
    if (!state) {
        state = { enemies: [], boxes: [], cleared: false };

        if (cell.kind === "room" && cell.type !== "start") {
            // Caixas
            const b = arenaBounds;
            const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
            const boxCount = 2 + Math.floor(Math.random() * 3);
            for (let i = 0; i < boxCount; i++) {
                state.boxes.push({
                    x: cx + (Math.random() - 0.5) * (b.maxX - b.minX) * 0.5,
                    y: cy + (Math.random() - 0.5) * (b.maxY - b.minY) * 0.5,
                    w: 48, h: 48
                });
            }
            // Inimigos
            const count = 3 + Math.floor(Math.random() * 3) + Math.floor(floor / 2);
            for (let i = 0; i < count; i++) {
                const angle = (i / count) * Math.PI * 2;
                const ex = cx + Math.cos(angle) * (b.maxX - b.minX) * 0.28;
                const ey = cy + Math.sin(angle) * (b.maxY - b.minY) * 0.28;
                const cfg = randomMeleeConfig();
                const foe = new MeleeEnemy(ex, ey, cfg.img, cfg, floor);
                foe.bloodPalette = bloodCanvas.palette;
                foe.gibStainConfig = BLOOD_STAIN_CONFIG.gib;
                state.enemies.push(foe);
            }
        } else {
            // start e corredores já nascem "limpos"
            state.cleared = true;
        }
        roomStates.set(key, state);
    }

    enemies = state.enemies;
    if (state.cleared) dungeon.cleared.add(key);
}

// A sala atual está "trancada" (portas fechadas) enquanto houver inimigos.
function roomLocked() {
    const state = roomStates.get(dungeon.currentKey);
    return state && !state.cleared && enemies.length > 0;
}

// Move para a sala vizinha através de uma porta, reposicionando os players
// logo do outro lado da porta correspondente.
function transitionThroughDoor(door) {
    dungeon.moveTo(door.gx, door.gy);
    enterRoom();

    const nb = arenaBounds;
    const cx = (nb.minX + nb.maxX) / 2, cy = (nb.minY + nb.maxY) / 2;
    // Entra pelo lado oposto ao da porta usada
    let ex = cx, ey = cy;
    const inset = 90;
    if (door.dir === "N") { ey = nb.maxY - inset; ex = cx; }        // saiu pelo N -> entra pelo S
    else if (door.dir === "S") { ey = nb.minY + inset; ex = cx; }
    else if (door.dir === "E") { ex = nb.minX + inset; ey = cy; }
    else if (door.dir === "W") { ex = nb.maxX - inset; ey = cy; }

    p1.x = ex - 24; p1.y = ey; p1.vx = 0; p1.vy = 0;
    p2.x = ex + 24; p2.y = ey; p2.vx = 0; p2.vy = 0;
    updateHud();
}

function updateHud() {
    const c = dungeon.current;
    const tag = c.kind === "corridor" ? "CORREDOR" : (c.type === "boss" ? "SALA DO CHEFE" : "SALA");
    hudFloor.innerText = `DUNGEON ${floor} — ${tag}`;
    hudP1.innerText = `P1 (Amarelo): ${"❤️".repeat(Math.max(0, p1.lives))}`;
    hudP2.innerText = `P2 (Azul): ${"❤️".repeat(Math.max(0, p2.lives))}`;
}

btnWeapon.addEventListener("click", () => {
    currentWeaponIndex = (currentWeaponIndex + 1) % weapons.length;
    const w = weapons[currentWeaponIndex];
    btnWeapon.innerText = `ARMA: ${w.name}`;
    btnWeapon.style.background = w.name === "SERRAS" ? "#ff5470" : "#e53170";
});
btnRestart.addEventListener("click", () => { floor = 1; createPlayers(); newDungeon(); });

// ---- Poeira / pegadas (inalterado, agora em coords de mundo) ----
function spawnRunSmoke(player) {
    const mag = Math.hypot(player.vx, player.vy) || 1;
    const dirX = player.vx / mag, dirY = player.vy / mag;
    const x = player.x - dirX * 12;
    const y = player.y + 15 - dirY * 12 * 0.4;
    particleSystem.triggerDust(x, y, dirX, dirY, 11);
}
function spawnWalkDust(player) {
    if (player.walkDustCooldown === undefined) player.walkDustCooldown = 0;
    if (player.walkDustCooldown > 0) player.walkDustCooldown--;
    if (player.speedMag < player.speed * 0.25) return;
    if (player.walkDustCooldown > 0) return;
    const mag = Math.hypot(player.vx, player.vy) || 1;
    const dirX = player.vx / mag, dirY = player.vy / mag;
    const x = player.x - dirX * 11;
    const y = player.y + 15 - dirY * 11 * 0.4;
    particleSystem.triggerDust(x, y, dirX, dirY, 2);
    player.walkDustCooldown = player.speedMag > player.speed * 0.6 ? 7 : 12;
}
function handleStep(player) {
    if (!player.justStepped) return;
    const x = player.stepX, y = player.stepY, ang = player.stepAngle;
    if (bloodCanvas.isBloodZone(x, y)) player.bloodStepsLeft = BLOOD_STEPS;
    if (player.bloodStepsLeft > 0) {
        const intensity = player.bloodStepsLeft / BLOOD_STEPS;
        bloodCanvas.stampFootprint(x, y, ang, intensity);
        player.bloodStepsLeft--;
    } else {
        footprints.push(new Footprint(x, y, ang));
        if (footprints.length > MAX_FOOTPRINTS) footprints.shift();
    }
}

// Mantém os jogadores dentro dos bounds da sala. Quando a sala está trancada,
// os vãos das portas também são parede. Quando aberta, a porta é passável e
// dispara a transição ao cruzá-la.
function clampToRoomAndDoors(entity, bounds) {
    entity.x = Math.max(bounds.minX + entity.hitRadius, Math.min(bounds.maxX - entity.hitRadius, entity.x));
    entity.y = Math.max(bounds.minY + entity.hitRadius, Math.min(bounds.maxY - entity.hitRadius, entity.y));
}

// Limite físico de afastamento entre os players (teto rígido).
function enforceSeparationLimit() {
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const dist = Math.hypot(dx, dy);
    if (dist > MAX_PLAYER_SEPARATION) {
        const over = dist - MAX_PLAYER_SEPARATION;
        const nx = dx / (dist || 1), ny = dy / (dist || 1);
        // Puxa cada um metade do excesso de volta e cancela a velocidade de
        // afastamento (para não "vibrar" contra o limite).
        p1.x += nx * over / 2; p1.y += ny * over / 2;
        p2.x -= nx * over / 2; p2.y -= ny * over / 2;
    }
}

// ---- Loop principal ----
function gameLoop() {
    const currentWeapon = weapons[currentWeaponIndex];

    if (!gameOver) {
        arenaBounds = dungeon.currentBounds();

        p1.update(input, arenaBounds);
        p2.update(input, arenaBounds);

        if (p1.justStartedRunning) spawnRunSmoke(p1);
        if (p2.justStartedRunning) spawnRunSmoke(p2);
        spawnWalkDust(p1); spawnWalkDust(p2);
        handleStep(p1); handleStep(p2);

        // Corrente elástica + teto rígido de afastamento
        Physics.applyChainConstraint(p1, p2);
        enforceSeparationLimit();

        const state = roomStates.get(dungeon.currentKey);
        const boxes = state ? state.boxes : [];
        Physics.resolveBoxCollisions(p1, boxes);
        Physics.resolveBoxCollisions(p2, boxes);

        enemies.forEach(e => {
            e.update([p1, p2], (hitPlayer) => {
                renderer.triggerShake(14);
                if (hitPlayer) particleSystem.triggerBlood(hitPlayer.x, hitPlayer.y, 16, 1.1);
            });
            Physics.resolveBoxCollisions(e, boxes);
        });

        const liveEnemies = enemies.filter(e => e.state !== "dying");
        const allEntities = [p1, p2, ...liveEnemies];
        for (let it = 0; it < 3; it++) Physics.resolveEntityCollisions(allEntities);

        // Limites da sala (inimigos sempre presos; players idem)
        [p1, p2, ...enemies].forEach(e => clampToRoomAndDoors(e, arenaBounds));

        currentWeapon.update();

        // Golpe da arma nos inimigos (zona morta perto dos players)
        const PLAYER_SAFE_ZONE = 46;
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            const d = Physics.distToSegment(enemy.x, enemy.y, p1.x, p1.y, p2.x, p2.y);
            const dP1 = Math.hypot(enemy.x - p1.x, enemy.y - p1.y);
            const dP2 = Math.hypot(enemy.x - p2.x, enemy.y - p2.y);
            const nearPlayer = dP1 < PLAYER_SAFE_ZONE || dP2 < PLAYER_SAFE_ZONE;
            if (enemy.state !== "dying" && !nearPlayer && d < currentWeapon.hitThreshold + enemy.hitRadius) {
                enemy.startDying();
                renderer.triggerShake(4);
            }
        }

        // Estilhaçamento em gibs
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            if (enemy.readyToGib) {
                particleSystem.triggerBlood(enemy.x, enemy.y, 26, 1.35);
                particleSystem.triggerBloodPool(enemy.x, enemy.y);
                gibs.push(...enemy.explodeIntoGibs());
                while (gibs.length > MAX_ACTIVE_GIBS) gibs.shift();
                enemies.splice(i, 1);
                renderer.triggerShake(7);
            }
        }

        for (let i = gibs.length - 1; i >= 0; i--) {
            gibs[i].update(arenaBounds);
            if (gibs[i].done) gibs.splice(i, 1);
        }
        for (let i = footprints.length - 1; i >= 0; i--) {
            footprints[i].update();
            if (footprints[i].done) footprints.splice(i, 1);
        }

        // Sala limpa quando não há mais inimigos vivos nem morrendo
        if (state && !state.cleared && enemies.length === 0) {
            state.cleared = true;
            dungeon.markCurrentCleared();
        }

        particleSystem.update([p1, p2], arenaBounds);

        if (p1.lives <= 0 || p2.lives <= 0) gameOver = true;

        // Transição por porta: só quando a sala está aberta (limpa/corredor) e
        // os DOIS players estão sobre o vão de uma porta.
        if (!roomLocked()) {
            const doors = dungeon.doorsOfCurrent();
            for (const door of doors) {
                if (playersAtDoor(door)) { transitionThroughDoor(door); break; }
            }
        }

        // Câmera: segue o ponto médio; zoom cai conforme a separação cresce
        const midX = (p1.x + p2.x) / 2, midY = (p1.y + p2.y) / 2;
        const sep = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const t = Math.min(1, sep / MAX_PLAYER_SEPARATION);
        const zoom = CAM_ZOOM_MAX + (CAM_ZOOM_MIN - CAM_ZOOM_MAX) * t;
        renderer.updateCamera({ x: midX, y: midY, zoom, bounds: arenaBounds });

        updateHud();
    }

    // ---- Renderização ----
    renderer.beginFrame();

    const c = dungeon.current;
    const rect = dungeon.cellRect(c.gx, c.gy);
    const doors = dungeon.doorsOfCurrent();
    const open = !roomLocked();
    const state = roomStates.get(dungeon.currentKey);
    renderer.drawRoom(rect, arenaBounds, doors, dungeon.doorHalfWidth, open, state ? state.boxes : []);

    particleSystem.drawFloor(ctx);
    footprints.forEach(f => f.draw(ctx));
    particleSystem.drawSmoke(ctx);

    const p1Bounce = p1.speedMag > 0.15 ? Math.abs(Math.sin(p1.animTimer)) : 0;
    const p2Bounce = p2.speedMag > 0.15 ? Math.abs(Math.sin(p2.animTimer)) : 0;
    renderer.drawRoundShadow(p1.x, p1.y, 14, p1Bounce);
    renderer.drawRoundShadow(p2.x, p2.y, 14, p2Bounce);
    enemies.forEach(e => renderer.drawRoundShadow(e.x, e.y, 13, 0));

    currentWeapon.draw(ctx, p1, p2);

    const drawables = [p1, p2, ...enemies].sort((a, b) => a.y - b.y);
    drawables.forEach(e => e.draw(ctx));

    gibs.forEach(g => g.draw(ctx));
    particleSystem.drawAir(ctx);

    renderer.endFrame();

    if (gameOver) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#e53170";
        ctx.font = "bold 44px monospace";
        ctx.textAlign = "center";
        ctx.fillText("FIM DE JOGO!", canvas.width / 2, canvas.height / 2 - 20);
        ctx.fillStyle = "#fffffe";
        ctx.font = "20px monospace";
        ctx.fillText(`Vocês exploraram a Dungeon ${floor}`, canvas.width / 2, canvas.height / 2 + 25);
        ctx.fillText("Pressione 'REINICIAR' para tentar novamente", canvas.width / 2, canvas.height / 2 + 60);
        ctx.textAlign = "start";
    }

    requestAnimationFrame(gameLoop);
}

// Os dois jogadores estão sobre o vão de uma porta?
function playersAtDoor(door) {
    const reach = dungeon.doorHalfWidth + 10;
    const near = (p) => Math.abs(p.x - door.x) < reach && Math.abs(p.y - door.y) < reach;
    return near(p1) && near(p2);
}

// Inicia
createPlayers();
newDungeon();
requestAnimationFrame(gameLoop);
