import { Game } from './Game.js';
import { RoomCatalog } from './rooms/RoomCatalog.js';
import { AssetLoader } from './core/AssetLoader.js';
import { LoadingScreen } from './ui/LoadingScreen.js';
import { TrailerPlayer } from './trailer/TrailerPlayer.js';
import { PixelButton, pixelScale } from './ui/PixelButton.js';
import { playUi, preloadUi } from './ui/UiSound.js';

/**
 * main.js — ponto de entrada (index.html).
 *
 * Fluxo de abertura (ex.: itch.io):
 *   1. Tela de carregamento: texturas (jogo + trailer) e catálogo de salas.
 *   2. TRAILER no mesmo canvas. Botão PULAR a qualquer momento; no fim
 *      aparece COMEÇAR (o trailer segue em loop por baixo).
 *   3. COMEÇAR/PULAR: tela de carregamento curta (áudio + montagem do jogo) e
 *      o jogo começa já com tudo decodificado (sem travar no início).
 *
 * `?playtest=true` (editor) e `?skipTrailer` vão direto para o jogo.
 */
async function bootstrap() {
    const canvas = document.getElementById('gameCanvas');
    const params = new URLSearchParams(location.search);
    const skipTrailer = params.has('skipTrailer') || params.get('playtest') === 'true';

    const loading = new LoadingScreen();
    const assets = new AssetLoader();
    const roomCatalog = new RoomCatalog();

    // O trailer registra imagens próprias no loader: crie-o ANTES de esperar.
    let trailer = null;
    if (!skipTrailer) {
        document.body.classList.add('trailer-mode');
        // ?timer mostra o cronômetro do trailer (para revisar; fora do itch.io).
        // ?mute desliga o som do trailer (sem a tela "clique para começar").
        trailer = new TrailerPlayer(canvas, assets, {
            onEnd: () => ui.showStart(), showTimer: params.has('timer'), audio: !params.has('mute')
        });
    }

    await loading.run('Loading the dungeon…', [
        { weight: 4, task: (p) => assets.whenReady((d, t) => p(t ? d / t : 1)) },
        { weight: 1, task: () => roomCatalog.load() }
    ]);

    let started = false;
    const startGame = async () => {
        if (started) return;
        started = true;
        ui.hide();
        trailer?.stop();
        document.body.classList.remove('trailer-mode');

        let game = null;
        await loading.run('Preparing the dungeon…', [
            {
                weight: 1,
                task: async (p) => {
                    game = new Game(canvas, { roomCatalog, assets });
                    await game.audio.whenReady(4000, (d, t) => p(t ? d / t : 1));
                }
            }
        ]);
        game.start();
    };

    const ui = buildTrailerUI(startGame);
    if (skipTrailer) { startGame(); return; }
    trailer.play();
    ui.showSkip();
}

// Botões sobre o trailer: PULAR (canto) e COMEÇAR (no fim). Enter/Espaço
// também começam quando o COMEÇAR está na tela; Esc pula.
function buildTrailerUI(onStart) {
    const root = document.getElementById('trailer-overlay');
    const skip = document.getElementById('btn-skip');
    const start = document.getElementById('btn-start');
    if (!root) return { showSkip() {}, showStart() {}, hide() {} };

    // SKIP em pixel art (face amarela), um pouco menor que os botões de menu.
    const skipBtn = new PixelButton(skip, {
        label: 'SKIP ▶',
        ariaLabel: 'Skip trailer',
        face: 'gold',
        enabled: () => skip.classList.contains('visible'),
        onPress: onStart
    });
    const scaleSkip = () => {
        const s = Math.max(2, pixelScale() - 2);
        skipBtn.applyScale(s);
        skip.style.setProperty('--px', `${s}px`);
    };
    scaleSkip();
    window.addEventListener('resize', scaleSkip);
    // START (botão HTML simples) e atalhos de teclado não passam pelo
    // PixelButton: tocam o mesmo "uiConfirm" aqui. Uma vez só (onStart é
    // idempotente, mas o som não seria).
    let confirmed = false;
    const confirmStart = () => {
        if (!confirmed) playUi('uiConfirm');
        confirmed = true;
        onStart();
    };
    preloadUi();
    start.addEventListener('pointerenter', () => {
        if (start.classList.contains('visible')) playUi('uiMove');
    });
    start.addEventListener('click', confirmStart);
    const onKey = (e) => {
        if (e.key === 'Escape') confirmStart();
        else if ((e.key === 'Enter' || e.key === ' ') && start.classList.contains('visible')) {
            e.preventDefault();
            confirmStart();
        }
    };
    window.addEventListener('keydown', onKey);

    return {
        showSkip() {
            root.classList.remove('hidden');
            setTimeout(() => skip.classList.add('visible'), 1200);
        },
        showStart() {
            root.classList.remove('hidden');
            skip.classList.remove('visible');
            start.classList.add('visible');
            start.focus({ preventScroll: true });
        },
        hide() {
            window.removeEventListener('keydown', onKey);
            root.classList.add('hidden');
        }
    };
}

bootstrap();
