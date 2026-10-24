import { Game } from './Game.js';
import { RoomCatalog } from './rooms/RoomCatalog.js';
import { AssetLoader } from './core/AssetLoader.js';
import { LoadingScreen } from './ui/LoadingScreen.js';

async function bootstrap() {
    const canvas = document.getElementById('gameCanvas');
    const loading = new LoadingScreen();
    const assets = new AssetLoader();
    const roomCatalog = new RoomCatalog();

    await loading.run('Loading the dungeon…', [
        { weight: 4, task: (p) => assets.whenReady((d, t) => p(t ? d / t : 1)) },
        { weight: 1, task: () => roomCatalog.load() }
    ]);

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
}

bootstrap();
