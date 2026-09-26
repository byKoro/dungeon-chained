import { InputHandler } from './core/InputHandler.js';
import { Physics } from './core/Physics.js';
import { Renderer } from './core/Renderer.js';
import { Player } from './entities/Player.js';
import { MeleeEnemy } from './entities/MeleeEnemy.js';
import { LaserWeapon } from './weapons/LaserWeapon.js';
import { SawWeapon } from './weapons/SawWeapon.js';
import { ParticleSystem } from './particles/ParticleSystem.js';
import { BloodCanvas } from './particles/BloodCanvas.js';

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

// Elementos HUD
const hudFloor = document.getElementById("hud-floor");
const hudP1 = document.getElementById("hud-p1");
const hudP2 = document.getElementById("hud-p2");
const btnWeapon = document.getElementById("btn-weapon");
const btnRestart = document.getElementById("btn-restart");

// Carregamento de Recursos (Assets)
const imgP1 = new Image();
imgP1.src = "assets/player_01/player_walk.png";

const imgP1Hurt = new Image();
imgP1Hurt.src = "assets/player_01/player_hurt.png";

const imgP1Scared = new Image();
imgP1Scared.src = "assets/player_01/player_walk_scared.png";

const imgP2 = new Image();
imgP2.src = "assets/player_02.png";

// Sprites de inimigos melee (grade 8 col x 6 linhas, célula 100x100)
const imgDemon = new Image();
imgDemon.src = "assets/enemies/demon.png";

const imgBloodMonster = new Image();
imgBloodMonster.src = "assets/enemies/blood_monster.png";

// Textura usada como paleta para o sangue procedural
const imgBlood = new Image();
imgBlood.src = "assets/particles/blood.png";

// ---- Controle das manchas de sangue nos fragmentos de corpo (gibs) ----
const BLOOD_STAIN_CONFIG = {
    // Manchas permanentes em cada fragmento de corpo (gib)
    gib: {
        count: 3,
        life: Infinity,
        sizeMin: 2,
        sizeMax: 4,
        alpha: 0.9
    }
};

// Configurações padronizadas dos inimigos melee. Todo inimigo melee reutiliza
// a mesma estrutura, só trocando a folha (img), o recorte e as linhas de
// animação. Para adicionar outro melee, basta acrescentar um item aqui.
function demonConfig() {
    return {
        img: imgDemon,
        cellSize: 100,
        // Recorte comum generoso que cobre walk/ataque/morte (braços esticados)
        cropX: 28, cropY: 34, cropW: 52, cropH: 26,
        drawHeight: 82,
        rows: {
            walk:    { row: 1, frames: 8, fps: 6 },
            // Ataque 01: dano no penúltimo frame (índice 5 de 0..6)
            attack:  { row: 2, frames: 7, fps: 5, hitFrame: 5 },
            // Ataque 02: dano no antepenúltimo frame (índice 4 de 0..6)
            attack2: { row: 3, frames: 7, fps: 5, hitFrame: 4 },
            death:   { row: 5, frames: 4, fps: 7 }
        },
        // Frame do demônio todo branco (usado no flash de morte): linha 0, col 6
        deathFlash: { row: 0, frame: 6 },
        // Picotamento em pedaços pequenos ao morrer (grade fina). 5x4 = 20 gibs.
        gib: { gridCols: 5, gridRows: 4 }
    };
}

function bloodMonsterConfig() {
    return {
        img: imgBloodMonster,
        cellSize: 100,
        // Recorte comum que cobre walk/ataque/morte (bbox máx x39-80, y32-57)
        cropX: 36, cropY: 30, cropW: 48, cropH: 30,
        drawHeight: 84,
        rows: {
            walk:    { row: 1, frames: 8, fps: 6 },
            // Ataque 01: 8 frames -> dano no penúltimo (índice 6)
            attack:  { row: 2, frames: 8, fps: 5, hitFrame: 6 },
            // Ataque 02: 8 frames -> dano no antepenúltimo (índice 5)
            attack2: { row: 3, frames: 8, fps: 5, hitFrame: 5 },
            death:   { row: 5, frames: 4, fps: 7 }
        },
        // Frame do monstro todo branco (flash de morte): linha 0, col 6
        deathFlash: { row: 0, frame: 6 },
        gib: { gridCols: 5, gridRows: 4 }
    };
}

const MELEE_ENEMY_CONFIGS = [demonConfig, bloodMonsterConfig];

function randomMeleeConfig() {
    const make = MELEE_ENEMY_CONFIGS[(Math.random() * MELEE_ENEMY_CONFIGS.length) | 0];
    return make();
}

// Instâncias Principais
const input = new InputHandler();
const renderer = new Renderer(canvas, ctx);
const bloodCanvas = new BloodCanvas(canvas.width, canvas.height, imgBlood);
const particleSystem = new ParticleSystem(bloodCanvas);

const weapons = [new LaserWeapon(), new SawWeapon()];
let currentWeaponIndex = 0;

let floor = 1;
let gameOver = false;
let p1, p2;
let enemies = [];
let gibs = [];      // fragmentos de corpos ATIVOS (arrastáveis pela física)
const MAX_ACTIVE_GIBS = 90; // teto para o pico simultâneo (o resto vai pro chão)
let boxes = [];
let trapdoor = { x: 880, y: 360, size: 54, open: false };

const arenaBounds = {
    minX: 140, maxX: canvas.width - 140,
    minY: 100, maxY: canvas.height - 100
};

function initLevel(resetAll = false) {
    if (resetAll) {
        floor = 1;
        p1 = new Player(470, 360, "#ffd166", ["w", "s", "a", "d"], imgP1, "Amarelo", {
            animated: true,
            frameCount: 8,   // player_walk.png: 800 / 100
            cellSize: 100,   // cada frame é 100x100
            // Recorte JUSTO em volta do boneco (bbox medida: x 43-57, y 39-58) + margem
            cropX: 41, cropY: 37, cropW: 17, cropH: 23,
            drawHeight: 73,  // altura de exibição na arena (30% maior que 56)
            hurt: {
                img: imgP1Hurt,
                frameCount: 5,   // player_hurt.png: 500 / 100
                hurtFrame: 2,    // frame índice 2 (o 3º) = dano recebido
                cellSize: 100,
                // bbox do hurt: x 44-57, y 40-58 + margem
                cropX: 42, cropY: 38, cropW: 16, cropH: 22
            },
            scared: {
                img: imgP1Scared,
                frameCount: 8,   // player_walk_scared.png: 800 / 100 (mesmo layout do walk)
                cellSize: 100,
                // mesma bbox do walk: x 43-57, y 39-58 + margem
                cropX: 41, cropY: 37, cropW: 17, cropH: 23
            }
        });
        p2 = new Player(530, 360, "#6bb4db", ["arrowup", "arrowdown", "arrowleft", "arrowright"], imgP2, "Azul", {
            animated: true,
            frameCount: 8,   // 800 / 100
            cellSize: 100,   // cada frame é 100x100
            // Recorte JUSTO em volta do boneco (bbox medida: x 41-57, y 37-57) + 2px de margem
            cropX: 39, cropY: 35, cropW: 21, cropH: 25,
            drawHeight: 73   // mesma altura de exibição do P1 (30% maior que 56)
        });
        // Paleta de sangue (da textura) + config central de manchas
        p1.bloodPalette = bloodCanvas.palette;
        p2.bloodPalette = bloodCanvas.palette;
        particleSystem.clear();
    } else {
        p1.x = 470; p1.y = 360; p1.vx = 0; p1.vy = 0;
        p2.x = 530; p2.y = 360; p2.vx = 0; p2.vy = 0;
        particleSystem.clear();
    }
    gameOver = false;

    // Gerar Caixas
    boxes = [];
    const boxCount = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < boxCount; i++) {
        boxes.push({
            x: 520 + (Math.random() - 0.5) * 360,
            y: 360 + (Math.random() - 0.5) * 260,
            w: 48,
            h: 48
        });
    }

    // Gerar Inimigos melee (tipo sorteado entre as configs disponíveis)
    enemies = [];
    gibs = [];
    const count = 4 + floor * 2;
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const radius = 280 + Math.random() * 120;
        const ex = 640 + Math.cos(angle) * radius;
        const ey = 360 + Math.sin(angle) * radius;

        const cfg = randomMeleeConfig();
        const foe = new MeleeEnemy(ex, ey, cfg.img, cfg, floor);
        foe.bloodPalette = bloodCanvas.palette;
        foe.gibStainConfig = BLOOD_STAIN_CONFIG.gib;
        enemies.push(foe);
    }

    trapdoor.x = 880;
    trapdoor.y = 360;
    trapdoor.open = false;

    updateHud();
}

function updateHud() {
    hudFloor.innerText = `CALABOUÇO: ANDAR ${floor}`;
    hudP1.innerText = `P1 (Amarelo): ${"❤️".repeat(Math.max(0, p1.lives))}`;
    hudP2.innerText = `P2 (Azul): ${"❤️".repeat(Math.max(0, p2.lives))}`;
}

btnWeapon.addEventListener("click", () => {
    currentWeaponIndex = (currentWeaponIndex + 1) % weapons.length;
    const w = weapons[currentWeaponIndex];
    btnWeapon.innerText = `ARMA: ${w.name}`;
    btnWeapon.style.background = w.name === "SERRAS" ? "#ff5470" : "#e53170";
});

btnRestart.addEventListener("click", () => {
    initLevel(true);
});

// Loop Principal
function gameLoop() {
    const currentWeapon = weapons[currentWeaponIndex];

    if (!gameOver) {
        // Atualiza Entidades
        p1.update(input, arenaBounds);
        p2.update(input, arenaBounds);

        // Física da corrente
        Physics.applyChainConstraint(p1, p2);

        // Colisões com caixas
        Physics.resolveBoxCollisions(p1, boxes);
        Physics.resolveBoxCollisions(p2, boxes);

        enemies.forEach(e => {
            e.update([p1, p2], (hitPlayer) => {
                renderer.triggerShake(14);
                // Sangue saltando do player que recebeu o golpe
                if (hitPlayer) {
                    particleSystem.triggerBlood(hitPlayer.x, hitPlayer.y, 16, 1.1);
                }
            });
            Physics.resolveBoxCollisions(e, boxes);
        });

        // Colisão/empurrão entre TODAS as entidades (players + inimigos).
        // Vertical rígido (não sobem em cima), horizontal com folga elástica.
        // Algumas iterações estabilizam empilhamentos de vários inimigos.
        // A lista 'gibs' só contém fragmentos ainda ativos (os assentados já
        // foram carimbados no chão e removidos), então todos entram na física.
        // Inimigos em "dying" ficam travados (fora da física de empurrão).
        const liveEnemies = enemies.filter(e => e.state !== "dying");
        const allEntities = [p1, p2, ...liveEnemies, ...gibs];
        for (let it = 0; it < 3; it++) {
            Physics.resolveEntityCollisions(allEntities);
        }

        // Reforça limites da arena após os empurrões (só das entidades vivas)
        [p1, p2, ...enemies].forEach(e => {
            e.x = Math.max(arenaBounds.minX + e.hitRadius, Math.min(arenaBounds.maxX - e.hitRadius, e.x));
            e.y = Math.max(arenaBounds.minY + e.hitRadius, Math.min(arenaBounds.maxY - e.hitRadius, e.y));
        });

        // Arma ativa
        currentWeapon.update();

        // Colisão da Arma com Inimigos (Morte instantânea)
        // Zona morta: a corrente só mata no MIOLO. Perto do corpo de cada player há uma
        // folga onde o inimigo consegue encostar e causar dano (senão nada dá dano).
        const PLAYER_SAFE_ZONE = 46; // raio em volta de cada player onde a arma NÃO mata
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            const d = Physics.distToSegment(enemy.x, enemy.y, p1.x, p1.y, p2.x, p2.y);
            const dP1 = Math.hypot(enemy.x - p1.x, enemy.y - p1.y);
            const dP2 = Math.hypot(enemy.x - p2.x, enemy.y - p2.y);
            const nearPlayer = dP1 < PLAYER_SAFE_ZONE || dP2 < PLAYER_SAFE_ZONE;

            if (enemy.state !== "dying" && !nearPlayer
                && d < currentWeapon.hitThreshold + enemy.hitRadius) {
                // Não explode na hora: entra na travada + flash branco (hit stop).
                // A explosão em gibs acontece quando esse estado termina.
                enemy.startDying();
                renderer.triggerShake(4);
            }
        }

        // Converte em gibs os inimigos que terminaram a travada de morte.
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            if (enemy.readyToGib) {
                // Sangue respingando + poça no chão + corpo picotado em gibs.
                particleSystem.triggerBlood(enemy.x, enemy.y, 26, 1.35);
                particleSystem.triggerBloodPool(enemy.x, enemy.y);
                gibs.push(...enemy.explodeIntoGibs());

                // Teto de segurança: se passar do limite de gibs ativos,
                // carimba os mais antigos no chão e os remove do loop.
                while (gibs.length > MAX_ACTIVE_GIBS) {
                    const old = gibs.shift();
                    bloodCanvas.stampGib(old);
                }

                enemies.splice(i, 1);
                renderer.triggerShake(7);
            }
        }

        // Atualiza os fragmentos de corpo. Quando um gib assenta, ele é
        // "carimbado" de vez no buffer de sangue e REMOVIDO da lista ativa,
        // saindo do loop de update/draw/física (grande ganho de FPS).
        for (let i = gibs.length - 1; i >= 0; i--) {
            const g = gibs[i];
            g.update(arenaBounds);
            if (g.settled) {
                bloodCanvas.stampGib(g);
                gibs.splice(i, 1);
            }
        }

        if (enemies.length === 0) {
            trapdoor.open = true;
        }

        // Atualiza partículas e detritos chutáveis
        particleSystem.update([p1, p2], arenaBounds);

        // Derrota
        if (p1.lives <= 0 || p2.lives <= 0) {
            gameOver = true;
        }

        // Avanço pelo alçapão
        if (trapdoor.open) {
            const d1 = Math.hypot(p1.x - trapdoor.x, p1.y - trapdoor.y);
            const d2 = Math.hypot(p2.x - trapdoor.x, p2.y - trapdoor.y);
            if (d1 < 36 && d2 < 36) {
                floor++;
                initLevel(false);
            }
        }

        updateHud();
    }

    // Renderização
    renderer.beginFrame();

    // 1. Cenário
    renderer.drawDungeon(boxes, trapdoor);

    // 2. Detritos e Sangue no chão
    particleSystem.drawFloor(ctx);

    // 2b. Fragmentos de corpo no chão (por baixo de tudo que está vivo)
    gibs.forEach(g => g.draw(ctx));

    // 3. Sombras circulares (só das entidades vivas)
    const p1Bounce = p1.speedMag > 0.15 ? Math.abs(Math.sin(p1.animTimer)) : 0;
    const p2Bounce = p2.speedMag > 0.15 ? Math.abs(Math.sin(p2.animTimer)) : 0;
    renderer.drawRoundShadow(p1.x, p1.y, 14, p1Bounce);
    renderer.drawRoundShadow(p2.x, p2.y, 14, p2Bounce);
    enemies.forEach(e => renderer.drawRoundShadow(e.x, e.y, 13, 0));

    // 4. Arma / Corrente
    currentWeapon.draw(ctx, p1, p2);

    // 5. Entidades vivas com ordenação por profundidade (y-sort): quem está
    //    mais "atrás" (menor y) é desenhado primeiro, então quem está à frente
    //    (maior y) cobre. Isso resolve o P2 ficar sempre por cima do P1.
    const drawables = [p1, p2, ...enemies].sort((a, b) => a.y - b.y);
    drawables.forEach(e => e.draw(ctx));

    // 6. Partículas no ar
    particleSystem.drawAir(ctx);

    renderer.endFrame();

    // Tela de Game Over
    if (gameOver) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "#e53170";
        ctx.font = "bold 44px monospace";
        ctx.textAlign = "center";
        ctx.fillText("FIM DE JOGO!", canvas.width / 2, canvas.height / 2 - 20);

        ctx.fillStyle = "#fffffe";
        ctx.font = "20px monospace";
        ctx.fillText(`Vocês sobreviveram até o Andar ${floor}`, canvas.width / 2, canvas.height / 2 + 25);
        ctx.fillText("Pressione 'REINICIAR' para tentar novamente", canvas.width / 2, canvas.height / 2 + 60);
        ctx.textAlign = "start";
    }

    requestAnimationFrame(gameLoop);
}

// Inicia
initLevel(true);
requestAnimationFrame(gameLoop);