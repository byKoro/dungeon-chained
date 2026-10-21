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
 * Fluxo de abertura:
 *   1. Tela de carregamento: texturas (jogo + trailer) e catálogo de salas.
 *   2. TRAILER no mesmo canvas. Botão PULAR a qualquer momento; no fim
 *      aparece COMEÇAR (o trailer segue em loop por baixo).
 *   3. COMEÇAR/PULAR: começa o jogo (co-op local, dois jogadores na mesma
 *      máquina).
 *   4. Jogo: tela de carregamento curta (áudio + montagem do jogo) e o jogo
 *      começa já com tudo decodificado (sem travar no início).
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
        // ?timer mostra o cronômetro do trailer (para revisar).
        // ?mute desliga o som do trailer (sem a tela "clique para começar").
        trailer = new TrailerPlayer(canvas, assets, {
            // No fim do trailer, aparece o botão COMEÇAR.
            onEnd: () => { if (!started) ui.showStart(); },
            // SKIP só depois que o trailer começa de fato (não na tela de gesto).
            onBegin: () => ui.showSkip(),
            showTimer: params.has('timer'), audio: !params.has('mute')
        });
        window.trailer = trailer;   // depuração no console (como em trailer.html)
    }

    await loading.run('Loading the dungeon…', [
        { weight: 4, task: (p) => assets.whenReady((d, t) => p(t ? d / t : 1)) },
        { weight: 1, task: () => roomCatalog.load() }
    ]);

    let started = false;
    // Sai da abertura (trailer, botões) antes de o jogo assumir.
    const leaveOpening = () => {
        ui.hide();
        trailer?.stop();
        document.body.classList.remove('trailer-mode');
    };

    // Jogo co-op local (dois jogadores na mesma máquina).
    const startGame = async () => {
        if (started) return;
        started = true;
        leaveOpening();

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

    // START / SKIP começam o jogo direto (o trailer é parado em leaveOpening).
    const ui = buildTrailerUI(startGame, () => trailer?.togglePause(), () => !!trailer?.paused);
    if (skipTrailer) { startGame(); return; }
    trailer.play();
}

// Segundos de trailer antes de o SKIP aparecer.
const SKIP_DELAY_MS = 3000;

// Botões sobre o trailer: PULAR (canto) e COMEÇAR (no fim). Enter/Espaço
// também começam quando o COMEÇAR está na tela; Esc pausa (RESUME + volume).
function buildTrailerUI(onStart, onPause = null, trailerPaused = null) {
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
    // START em pixel art (face vermelha), igual aos botões das telas de morte
    // e pausa: o PixelButton cuida do hover ("uiMove"), do quadro apertado e
    // do "uiConfirm" no clique. Enter/Espaço (atalho global) passam por
    // confirmStart, que mostra o quadro apertado e toca o mesmo som. Uma vez
    // só (onStart é idempotente, mas o som não seria).
    let confirmed = false;
    const startBtn = new PixelButton(start, {
        label: 'START',
        ariaLabel: 'Start game',
        face: 'red',
        enabled: () => start.classList.contains('visible') && !confirmed,
        onPress: () => { confirmed = true; onStart(); }
    });
    const confirmStart = () => {
        if (!confirmed) { startBtn.showPressed(); playUi('uiConfirm'); }
        confirmed = true;
        onStart();
    };
    const scaleStart = () => {
        const s = pixelScale();
        startBtn.applyScale(s);
        start.style.setProperty('--px', `${s}px`);
    };
    scaleStart();
    window.addEventListener('resize', scaleStart);
    preloadUi();
    const onKey = (e) => {
        // Esc pausa o trailer (RESUME + volume), como no jogo; pular = SKIP.
        if (e.key === 'Escape') { if (!e.repeat) onPause?.(); }
        else if (trailerPaused?.()) return;          // pausado: o menu cuida das teclas
        else if ((e.key === 'Enter' || e.key === ' ') && start.classList.contains('visible')) {
            e.preventDefault();
            confirmStart();
        }
    };
    window.addEventListener('keydown', onKey);

    return {
        showSkip() {
            root.classList.remove('hidden');
            setTimeout(() => {
                // Já no fim (START na tela) ou o jogo já começou: não mostra.
                if (start.classList.contains('visible') || root.classList.contains('hidden')) return;
                skip.classList.add('visible');
            }, SKIP_DELAY_MS);
        },
        showStart() {
            root.classList.remove('hidden');
            skip.classList.remove('visible');
            skip.blur();   // foco automático no START não deve tocar "uiMove"
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
