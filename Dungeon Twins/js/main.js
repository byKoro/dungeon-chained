import { InputHandler } from './core/InputHandler.js';
import { Physics } from './core/Physics.js';
import { Renderer } from './core/Renderer.js';
import { Player } from './entities/Player.js';
import { Enemy } from './entities/Enemy.js';
import { LaserWeapon } from './weapons/LaserWeapon.js';
import { SawWeapon } from './weapons/SawWeapon.js';
import { ParticleSystem } from './particles/ParticleSystem.js';

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
imgP1.src = "assets/player_01.png";

const imgP2 = new Image();
imgP2.src = "assets/npc_knight_green.png";

const enemySheet = new Image();
enemySheet.src = "assets/Dungeon_Character.png";
let enemyGridW = 16, enemyGridH = 16;
enemySheet.onload = () => {
    enemyGridW = enemySheet.naturalWidth / 7;
    enemyGridH = enemySheet.naturalHeight / 4;
};

// Instâncias Principais
const input = new InputHandler();
const renderer = new Renderer(canvas, ctx);
const particleSystem = new ParticleSystem();

const weapons = [new LaserWeapon(), new SawWeapon()];
let currentWeaponIndex = 0;

let floor = 1;
let gameOver = false;
let p1, p2;
let enemies = [];
let boxes = [];
let trapdoor = { x: 880, y: 360, size: 54, open: false };

const arenaBounds = {
    minX: 140, maxX: canvas.width - 140,
    minY: 100, maxY: canvas.height - 100
};

function initLevel(resetAll = false) {
    if (resetAll) {
        floor = 1;
        p1 = new Player(470, 360, "#ffd166", ["w", "s", "a", "d"], imgP1, "Amarelo");
        p2 = new Player(530, 360, "#6bb4db", ["arrowup", "arrowdown", "arrowleft", "arrowright"], imgP2, "Azul");
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

    // Gerar Inimigos
    enemies = [];
    const count = 4 + floor * 2;
    for (let i = 0; i < count; i++) {
        const isSkeleton = Math.random() > 0.5;
        const col = isSkeleton ? 4 : 1;
        const angle = (i / count) * Math.PI * 2;
        const radius = 280 + Math.random() * 120;
        const ex = 640 + Math.cos(angle) * radius;
        const ey = 360 + Math.sin(angle) * radius;

        enemies.push(new Enemy(ex, ey, col, 1, isSkeleton, enemySheet));
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
            e.update([p1, p2], () => renderer.triggerShake(14));
            Physics.resolveBoxCollisions(e, boxes);
        });

        // Arma ativa
        currentWeapon.update();

        // Colisão da Arma com Inimigos (Morte instantânea)
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            const d = Physics.distToSegment(enemy.x, enemy.y, p1.x, p1.y, p2.x, p2.y);

            if (d < currentWeapon.hitThreshold + enemy.hitRadius) {
                particleSystem.triggerExplosion(enemy.x, enemy.y, enemy.isSkeleton);
                enemies.splice(i, 1);
                renderer.triggerShake(7);
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

    // 3. Sombras circulares
    const p1Bounce = p1.speedMag > 0.15 ? Math.abs(Math.sin(p1.animTimer)) : 0;
    const p2Bounce = p2.speedMag > 0.15 ? Math.abs(Math.sin(p2.animTimer)) : 0;
    renderer.drawRoundShadow(p1.x, p1.y, 14, p1Bounce);
    renderer.drawRoundShadow(p2.x, p2.y, 14, p2Bounce);
    enemies.forEach(e => renderer.drawRoundShadow(e.x, e.y, 13, 0));

    // 4. Arma / Corrente
    currentWeapon.draw(ctx, p1, p2);

    // 5. Entidades
    p1.draw(ctx);
    p2.draw(ctx);
    enemies.forEach(e => e.draw(ctx, enemyGridW, enemyGridH));

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