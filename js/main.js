import { InputHandler } from './core/InputHandler.js';
import { Physics } from './core/Physics.js';
import { Renderer } from './core/Renderer.js';
import { Chain } from './core/Chain.js';
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

// ---- Cores do sangue (edite aqui para mudar o tom do sangue no jogo) ----
const BLOOD_COLORS = [
    "#5c0210",
    "#7a0404",
    "#960e11",
    "#a30808",
    "#c60f0e"
];



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
const bloodCanvas = new BloodCanvas(canvas.width, canvas.height, BLOOD_COLORS);
const particleSystem = new ParticleSystem(bloodCanvas);

// A corrente une os jogadores e porta a arma ativa. Ajuste os "dials" da
// mecânica (tensão, ruptura, reconexão) aqui.
const chain = new Chain([new LaserWeapon(), new SawWeapon()], {
    rest: 130,
    stiffness: 0.02,
    breakDistance: 240,
    strainDistance: 165,
    strainLimit: 30,
    reconnectDistance: 110,
    snapImpulse: 12,
    playerSafeZone: 46
});

let floor = 1;
let gameOver = false;
let p1, p2;
let enemies = [];
let gibs = [];      // fragmentos de corpos ATIVOS (arrastáveis pela física)
const MAX_ACTIVE_GIBS = 90; // teto para o pico simultâneo (o resto vai pro chão)
let footprints = []; // pegadas normais (com fade)
const MAX_FOOTPRINTS = 60;
const BLOOD_STEPS = 6; // quantos passos ensanguentados após pisar em sangue
let boxes = [];
let trapdoor = { x: 880, y: 360, size: 54, open: false };

// --- Estado da corrente/arma ---
// A corrente segura os jogadores com tensão elástica. Se insistirem em se
// separar além do limite de ruptura, ela ARREBENTA (empurrão elástico em
// direções opostas) e os jogadores ficam DESARMADOS. Ao se reaproximarem, a
// corrente/arma reconecta automaticamente. (Lógica na classe Chain.)

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

    // Corrente começa conectada a cada fase
    chain.reset();

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
    footprints = [];
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

    // Indica no botão quando a corrente arrebentou (jogadores desarmados)
    if (chain.isConnected) {
        btnWeapon.innerText = `ARMA: ${chain.name}`;
        btnWeapon.style.background = chain.name === "SERRAS" ? "#ff5470" : "#e53170";
    } else {
        btnWeapon.innerText = "ARMA QUEBRADA! APROXIMEM-SE";
        btnWeapon.style.background = "#555";
    }
}

btnWeapon.addEventListener("click", () => {
    const w = chain.cycleWeapon();
    btnWeapon.innerText = `ARMA: ${w.name}`;
    btnWeapon.style.background = w.name === "SERRAS" ? "#ff5470" : "#e53170";
});

btnRestart.addEventListener("click", () => {
    initLevel(true);
});

// Solta a poeira procedural aos pés do jogador, atrás dele em relação à
// direção da corrida (lado contrário ao movimento).
function spawnRunSmoke(player) {
    const mag = Math.hypot(player.vx, player.vy) || 1;
    const dirX = player.vx / mag;
    const dirY = player.vy / mag;
    const behind = 12;   // distância atrás do jogador
    const footY = 15;    // desloca para os pés
    const x = player.x - dirX * behind;
    const y = player.y + footY - dirY * behind * 0.4;
    particleSystem.triggerDust(x, y, dirX, dirY, 11);
}

// Poeira leve e contínua enquanto o jogador anda (bem menos intensa que o
// arranque). Emite poucas partículas em intervalos, proporcional à velocidade.
function spawnWalkDust(player) {
    if (player.walkDustCooldown === undefined) player.walkDustCooldown = 0;
    if (player.walkDustCooldown > 0) player.walkDustCooldown--;

    // Só quando realmente em movimento
    if (player.speedMag < player.speed * 0.25) return;
    if (player.walkDustCooldown > 0) return;

    const mag = Math.hypot(player.vx, player.vy) || 1;
    const dirX = player.vx / mag;
    const dirY = player.vy / mag;
    const behind = 11;
    const footY = 15;
    const x = player.x - dirX * behind;
    const y = player.y + footY - dirY * behind * 0.4;

    // Pouca poeira por emissão
    particleSystem.triggerDust(x, y, dirX, dirY, 2);

    // Intervalo entre emissões: mais rápido quanto mais veloz o jogador
    const fast = player.speedMag > player.speed * 0.6;
    player.walkDustCooldown = fast ? 7 : 12;
}

// Processa um passo do jogador: se ele está com "pé ensanguentado" ou pisou
// em sangue, deixa uma pegada de SANGUE fixa (carimbada, permanente) que vai
// secando a cada passo. Caso contrário, uma pegada normal com fade.
function handleStep(player) {
    if (!player.justStepped) return;

    const x = player.stepX, y = player.stepY, ang = player.stepAngle;

    // Pisou numa zona de sangue molhado? Recarrega os passos ensanguentados.
    // (Usa geometria, não leitura de pixel. Pegadas de sangue não criam zonas,
    //  então o jogador não re-detecta as próprias pegadas.)
    if (bloodCanvas.isBloodZone(x, y)) {
        player.bloodStepsLeft = BLOOD_STEPS;
    }

    if (player.bloodStepsLeft > 0) {
        // Pegada de sangue fixa; intensidade cai a cada passo (vai secando)
        const intensity = player.bloodStepsLeft / BLOOD_STEPS;
        bloodCanvas.stampFootprint(x, y, ang, intensity);
        player.bloodStepsLeft--;
    } else {
        // Pegada normal com fade
        footprints.push(new Footprint(x, y, ang));
        if (footprints.length > MAX_FOOTPRINTS) footprints.shift();
    }
}

// Loop Principal
function gameLoop() {
    if (!gameOver) {
        // Atualiza Entidades
        p1.update(input, arenaBounds);
        p2.update(input, arenaBounds);

        // Poeira: baforada forte ao arrancar + poeira leve contínua ao andar.
        if (p1.justStartedRunning) spawnRunSmoke(p1);
        if (p2.justStartedRunning) spawnRunSmoke(p2);
        spawnWalkDust(p1);
        spawnWalkDust(p2);

        // Pegadas (normais com fade; de sangue quando pisa em sangue)
        handleStep(p1);
        handleStep(p2);

        // Corrente: tensão, ruptura e reconexão (lógica encapsulada em Chain)
        chain.update(p1, p2, {
            onSnap: () => renderer.triggerShake(9),
            onReconnect: () => renderer.triggerShake(4)
        });

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
        // Empurrão entre players e inimigos. Os gibs agora voam para fora da
        // tela (não colidem), então não entram na física.
        // Inimigos em "dying" ficam travados (fora da física de empurrão).
        const liveEnemies = enemies.filter(e => e.state !== "dying");
        const allEntities = [p1, p2, ...liveEnemies];
        for (let it = 0; it < 3; it++) {
            Physics.resolveEntityCollisions(allEntities);
        }

        // Reforça limites da arena após os empurrões (só das entidades vivas)
        [p1, p2, ...enemies].forEach(e => {
            e.x = Math.max(arenaBounds.minX + e.hitRadius, Math.min(arenaBounds.maxX - e.hitRadius, e.x));
            e.y = Math.max(arenaBounds.minY + e.hitRadius, Math.min(arenaBounds.maxY - e.hitRadius, e.y));
        });

        // Golpe da corrente nos inimigos (só quando conectada). Ao atingir,
        // o inimigo entra na travada + flash branco (hit stop) antes de virar
        // gibs. A explosão em si acontece quando esse estado termina, abaixo.
        chain.applyToEnemies(p1, p2, enemies, (enemy) => {
            enemy.startDying();
            renderer.triggerShake(4);
        });

        // Converte em gibs os inimigos que terminaram a travada de morte.
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            if (enemy.readyToGib) {
                // Sangue respingando + poça no chão + corpo estilhaçado em
                // quadrados que voam para fora da tela.
                particleSystem.triggerBlood(enemy.x, enemy.y, 26, 1.35);
                particleSystem.triggerBloodPool(enemy.x, enemy.y);
                gibs.push(...enemy.explodeIntoGibs());

                // Teto de segurança: descarta os mais antigos se exceder.
                while (gibs.length > MAX_ACTIVE_GIBS) gibs.shift();

                enemies.splice(i, 1);
                renderer.triggerShake(7);
            }
        }

        // Atualiza os fragmentos de corpo (quadrados voando). Remove os que
        // saíram da tela.
        for (let i = gibs.length - 1; i >= 0; i--) {
            const g = gibs[i];
            g.update(arenaBounds);
            if (g.done) gibs.splice(i, 1);
        }

        // Atualiza pegadas normais (fade) e remove as que sumiram
        for (let i = footprints.length - 1; i >= 0; i--) {
            footprints[i].update();
            if (footprints[i].done) footprints.splice(i, 1);
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

    // 2. Detritos e Sangue no chão (inclui as pegadas de sangue carimbadas)
    particleSystem.drawFloor(ctx);

    // 2a. Pegadas normais (com fade), sobre o chão
    footprints.forEach(f => f.draw(ctx));

    // 2c. Poeira de corrida (aos pés, sob as entidades)
    particleSystem.drawSmoke(ctx);

    // 3. Sombras circulares (só das entidades vivas)
    const p1Bounce = p1.speedMag > 0.15 ? Math.abs(Math.sin(p1.animTimer)) : 0;
    const p2Bounce = p2.speedMag > 0.15 ? Math.abs(Math.sin(p2.animTimer)) : 0;
    renderer.drawRoundShadow(p1.x, p1.y, 14, p1Bounce);
    renderer.drawRoundShadow(p2.x, p2.y, 14, p2Bounce);
    enemies.forEach(e => renderer.drawRoundShadow(e.x, e.y, 13, 0));

    // 4. Arma / Corrente (só desenha quando conectada — Chain cuida disso)
    chain.draw(ctx, p1, p2);

    // 5. Entidades vivas com ordenação por profundidade (y-sort): quem está
    //    mais "atrás" (menor y) é desenhado primeiro, então quem está à frente
    //    (maior y) cobre. Isso resolve o P2 ficar sempre por cima do P1.
    const drawables = [p1, p2, ...enemies].sort((a, b) => a.y - b.y);
    drawables.forEach(e => e.draw(ctx));

    // 6. Estilhaços do corpo voando + partículas no ar (por cima de tudo)
    gibs.forEach(g => g.draw(ctx));
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