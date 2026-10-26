import { Game } from './Game.js';
import { RoomCatalog } from './rooms/RoomCatalog.js';
import { AssetLoader } from './core/AssetLoader.js';
import { LoadingScreen } from './ui/LoadingScreen.js';
import { TrailerPlayer } from './trailer/TrailerPlayer.js';
import { TrailerOverlay } from './ui/TrailerOverlay.js';

async function bootstrap() {
    const canvas = document.getElementById('gameCanvas');
    const params = new URLSearchParams(location.search);
    const skipTrailer = params.has('skipTrailer') || params.get('playtest') === 'true';
    const loading = new LoadingScreen();
    const assets = new AssetLoader();
    const roomCatalog = new RoomCatalog();

    let started = false;
    let overlay = null;
    // O stage do trailer registra imagens próprias no loader: precisa existir antes do whenReady.
    const trailer = skipTrailer ? null : new TrailerPlayer(canvas, assets, {
        onEnd: () => { if (!started) overlay?.showStart(); },
        onBegin: () => overlay?.showSkip(),
        showTimer: params.has('timer'),
        audio: !params.has('mute')
    });
    if (trailer) window.trailer = trailer;

    await loading.run('Loading the dungeon…', [
        { weight: 4, task: (p) => assets.whenReady((d, t) => p(t ? d / t : 1)) },
        { weight: 1, task: () => roomCatalog.load() }
    ]);

    const startGame = async () => {
        if (started) return;
        started = true;
        overlay?.hide();
        trailer?.stop();
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

    if (!trailer) { startGame(); return; }
    overlay = new TrailerOverlay({
        onStart: startGame,
        onPause: () => trailer.togglePause(),
        isTrailerPaused: () => trailer.paused
    });
    trailer.play();
}

bootstrap();
