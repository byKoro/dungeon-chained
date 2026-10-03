import { Game } from './Game.js';
import { RoomCatalog } from './rooms/RoomCatalog.js';

/**
 * main.js — ponto de entrada. Carrega o catálogo de peças autorais (/map) e
 * então monta e inicia o jogo. Toda a lógica vive em ./Game.js e subsistemas.
 */
async function bootstrap() {
    const canvas = document.getElementById("gameCanvas");

    // Carrega as peças de sala desenhadas no editor (pasta /map). Se falhar,
    // o jogo cai no fallback procedural (sala lisa) automaticamente.
    const roomCatalog = new RoomCatalog();
    await roomCatalog.load();

    const game = new Game(canvas, { roomCatalog });
    game.start();
}

bootstrap();
