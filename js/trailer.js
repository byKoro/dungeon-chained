/**
 * trailer.js — página de edição do trailer (trailer.html).
 *
 * O trailer em si mora em js/trailer/:
 *   TrailerPlayer.js        sequência de cenas + loop
 *   TrailerStage.js         palco compartilhado (jogadores, serra, câmera, helpers)
 *   scenes/IntroScene.js    cena 1 (porta, serra nasce, falas, closes, tremor)
 *   scenes/TitleBloodScene.js  cartela + pisca vermelho + sangue enchendo a tela
 *   scenes/frenzy/*         frenesi (roteiro, IA da horda)
 *   fx/*                    efeitos de tela (sangue, respingos)
 *
 * Atalhos: ?cena=N começa na cena N (0 = intro, 1 = cartela, 2 = frenesi,
 * 3 = zigue-zague, 4 = corda arrebenta, 5 = tela dividida, 6 = geração de
 * mapas, 7 = chuva de flechas, 8 = buracos, 9 = botões, 10 = serra gigante,
 * 11 = boss parede de fogo); o número também
 * aparece no cronômetro discreto do rodapé.
 * botão/Espaço/Enter repete. `window.trailer` fica exposto para o console.
 */
import { AssetLoader } from './core/AssetLoader.js';
import { LoadingScreen } from './ui/LoadingScreen.js';
import { TrailerPlayer } from './trailer/TrailerPlayer.js';

async function bootstrap() {
    const canvas = document.getElementById('trailerCanvas');
    const assets = new AssetLoader();
    const trailer = new TrailerPlayer(canvas, assets);
    window.trailer = trailer;

    await new LoadingScreen().run('Carregando o trailer…', [
        { task: (p) => assets.whenReady((d, t) => p(t ? d / t : 1)) }
    ]);

    const from = parseInt(new URLSearchParams(location.search).get('cena') ?? '0', 10) || 0;
    const replay = () => trailer.play(from);
    document.getElementById('btn-replay')?.addEventListener('click', replay);
    window.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') replay();
    });
    replay();
}

bootstrap();
