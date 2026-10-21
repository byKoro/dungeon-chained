/**
 * matchcut.js — prévia dos clipes do match cut (matchcut.html).
 *
 * ?shot=A escolhe o plano (A..E, ver js/trailer/matchcut/shots.js), ?timer
 * mostra o cronômetro, ?mute desliga o som. Canvas fixo em 1920x1080 (o
 * mesmo do vídeo), ajustado à janela. Espaço/Enter repete; LOOP repete
 * sozinho no fim. Render do MP4 (depois de validado):
 *   node tools/trailer-render/render.mjs --set matchcut --shot A
 */
import { AssetLoader } from './core/AssetLoader.js';
import { LoadingScreen } from './ui/LoadingScreen.js';
import { TrailerPlayer } from './trailer/TrailerPlayer.js';
import { SHOTS, shotClass } from './trailer/matchcut/shots.js';

const W = 1920, H = 1080;

async function bootstrap() {
    const params = new URLSearchParams(location.search);
    const key = (params.get('shot') || 'A').toUpperCase();
    const Shot = shotClass(key) || SHOTS.A;
    const canvas = document.getElementById('matchCanvas');
    const assets = new AssetLoader();
    let loop = !params.has('noloop');

    const player = new TrailerPlayer(canvas, assets, {
        scenes: [Shot],
        letterbox: false,
        music: false,
        audio: !params.has('mute'),
        showTimer: params.has('timer'),
        setupStage: (stage) => {
            // Tamanho fixo (zoom da câmera = papel); o CSS ajusta à janela.
            stage.resize = () => {
                stage.canvas.width = W;
                stage.canvas.height = H;
                stage.ctx.imageSmoothingEnabled = false;
            };
            stage.resize();
        },
        onEnd: () => { if (loop) setTimeout(() => { if (loop) replay(); }, 700); }
    });
    window.matchcut = player;

    await new LoadingScreen().run('Loading…', [
        { task: (p) => assets.whenReady((d, t) => p(t ? d / t : 1)) }
    ]);

    // Botões dos planos existentes.
    const bar = document.getElementById('mc-shots');
    for (const k of Object.keys(SHOTS)) {
        const b = document.createElement('button');
        b.className = 't-btn';
        b.type = 'button';
        b.textContent = `PLANO ${k}`;
        b.setAttribute('aria-pressed', String(k === key));
        b.addEventListener('click', () => {
            params.set('shot', k);
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
