import { Game } from './Game.js';

/**
 * main.js — ponto de entrada. Apenas monta o jogo e o inicia; toda a lógica
 * vive nos módulos de ./Game.js e seus subsistemas (rooms, combat, systems...).
 */
const canvas = document.getElementById("gameCanvas");
const game = new Game(canvas);
game.start();
