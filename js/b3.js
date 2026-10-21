/**
 * b3.js — prévia dos clipes do Bloco 3 (b3.html).
 *
 * ?shot=0..6 escolhe o clipe (ver js/trailer/b3/shots.js); ?shot=all (padrão)
 * toca a sequência inteira com corte seco. ?labels mostra o lower-third de
 * cada clipe (só na prévia), ?timer o cronômetro, ?mute desliga o som,
 * ?noloop não repete. Canvas fixo em 1920x1080 (o do vídeo), ajustado à janela.
 * Render do MP4:
 *   node tools/trailer-render/render.mjs --set b3 --shot all   (ou --shot 1)
 */
import { AssetLoader } from './core/AssetLoader.js';
import { LoadingScreen } from './ui/LoadingScreen.js';
import { TrailerPlayer } from './trailer/TrailerPlayer.js';
import { SHOTS, shotList } from './trailer/b3/shots.js';

const W = 1920, H = 1080;

async function bootstrap() {
    const params = new URLSearchParams(location.search);
    let key = (params.get('shot') || 'all').toUpperCase();
    let scenes = shotList(key);
    if (!scenes) { key = 'ALL'; scenes = shotList(key); }
    const canvas = document.getElementById('b3Canvas');
    const assets = new AssetLoader();
    let loop = !params.has('noloop');

    const player = new TrailerPlayer(canvas, assets, {
        scenes,
        letterbox: false,
        music: false,
        audio: !params.has('mute'),
        showTimer: params.has('timer'),
        setupStage: (stage) => {
            stage.showLabels = params.has('labels');
            stage.resize = () => {
                stage.canvas.width = W;
                stage.canvas.height = H;
                stage.ctx.imageSmoothingEnabled = false;
            };
            stage.resize();
        },
        onEnd: () => { if (loop) setTimeout(() => { if (loop) replay(); }, 700); }
    });
    window.b3 = player;

    await new LoadingScreen().run('Loading…', [
        { task: (p) => assets.whenReady((d, t) => p(t ? d / t : 1)) }
    ]);

    // Botões: sequência inteira + cada clipe.
    const bar = document.getElementById('b3-shots');
    for (const k of ['ALL', ...Object.keys(SHOTS)]) {
        const b = document.createElement('button');
        b.className = 't-btn';
        b.type = 'button';
        b.textContent = k === 'ALL' ? 'TUDO' : `CLIPE ${k}`;
        b.setAttribute('aria-pressed', String(k === key));
        b.addEventListener('click', () => {
            params.set('shot', k.toLowerCase());
            location.search = params.toString();
        });
        bar.appendChild(b);
    }

    const replay = () => player.play(0);
    document.getElementById('btn-replay').addEventListener('click', replay);
    const loopBtn = document.getElementById('btn-loop');
    loopBtn.setAttribute('aria-pressed', String(loop));
    loopBtn.addEventListener('click', () => {
        loop = !loop;
        loopBtn.setAttribute('aria-pressed', String(loop));
    });
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { if (!e.repeat) player.togglePause(); return; }
        if (player.paused) return;
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); replay(); }
    });
    replay();
}

bootstrap();
