import { SCRAP } from '../../config/ScrapConfig.js';
import { ScrapSystem } from '../../systems/ScrapSystem.js';
import { ScrapWallet } from '../../systems/ScrapWallet.js';
import { ScrapCounter } from '../../ui/ScrapCounter.js';

// Sucata do jogo dentro de uma arena do trailer: moedas que saltam, quicam e voam até a dupla,
// e o contador no topo da tela. O saldo fica no stage, então segue de uma cena para a outra.
export class TrailerScrap {
    constructor(stage) {
        this.stage = stage;
        const a = stage.assets;
        this.frames = SCRAP.frames.map((src, i) => a.get(`scrap${i + 1}`) || a.load(`scrap${i + 1}`, src));
        stage.scrapWallet ??= new ScrapWallet();
        this.counter = new ScrapCounter({ getAmount: () => stage.scrapWallet.amount, frames: this.frames });
        this.sys = null;
    }

    // `amount` = saldo no começo da cena (null = mantém o que veio da cena anterior).
    reset(A, amount = null) {
        this.A = A;
        const w = this.stage.scrapWallet;
        if (amount !== null) { w.reset(); w.add(amount); }
        this.sys = new ScrapSystem({
            frames: this.frames,
            audio: { play: (_n, o) => this.stage.audio?.play('pop', { vol: 0.28, rate: (o?.rateMultiplier ?? 1) * 1.1, cool: 0.02 }) }
        });
        this.sys.wallet = w;
        this.counter.reset();
    }

    burst(x, y, amount, opts) { return this.sys?.spawnBurst(x, y, amount, opts); }
    vacuum() { this.sys?.vacuum(); }
    get amount() { return this.stage.scrapWallet.amount; }

    update() { if (this.sys) this.sys.update([this.A.p1, this.A.p2], this.A.bounds); }
    drawFloor(ctx) { this.sys?.drawShadows(ctx); }
    drawOver(ctx) { this.sys?.drawOverlay(ctx); }

    // Contador no topo, em escala inteira, logo abaixo das barras de cinema. O ScrapCounter zera a
    // transformação ao desenhar, então ele vai para uma tela auxiliar que é posicionada aqui.
    drawHud(ctx, canvas) {
        const s = Math.max(3, Math.round(this.stage.refSize / 200));
        const c = this._hud ??= document.createElement('canvas');
        const h = s * 24;
        if (c.width !== canvas.width || c.height !== h) { c.width = canvas.width; c.height = h; }
        const g = c.getContext('2d');
        g.clearRect(0, 0, c.width, c.height);
        this.counter.draw(g, c.width, h, s);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(c, 0, Math.round(this.stage.barH));
        ctx.restore();
    }
}
