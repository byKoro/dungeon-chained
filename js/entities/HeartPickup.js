export class HeartPickup {

    static sheet = null;

    static PIXEL = 4;
    static ART = 12;

    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 24;
        this.age = 0;

        this.sweepPhase = Math.random() * Math.PI * 2;
    }

    update() {
        this.age++;
        this.sweepPhase += 0.035;
    }

    get _bob() { return Math.sin(this.age * 0.08) * 4; }
    get hover() { return (Math.sin(this.age * 0.08) + 1) / 2; }

    lightInfo() {
        return { x: this.x, y: this.y, hover: this.hover };
    }

    _ready() {
        const img = HeartPickup.sheet;
        return img && img.complete && img.naturalWidth > 0 ? img : null;
    }

    drawShadow(ctx) {
        const size = HeartPickup.ART * HeartPickup.PIXEL;
        const h = this.hover;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 0.4 - h * 0.15);
        ctx.fillStyle = "#000";
        ctx.beginPath();
        const s = 1 - h * 0.2;
        ctx.ellipse(this.x, this.y + size * 0.55, size * 0.36 * s, size * 0.12 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    drawOverlay(ctx) {
        const img = this._ready();
        if (!img) return;
        const A = HeartPickup.ART;

        const settle = 1 + Math.max(0, 1 - this.age / 15) * 0.3;
        const size = A * HeartPickup.PIXEL * settle;
        const cx = Math.round(this.x);
        const cy = Math.round(this.y - this._bob);

        const prevSmooth = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = false;

        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.16 + this.hover * 0.1;
        ctx.shadowColor = "#ff4d6d";
        ctx.shadowBlur = 14;
        ctx.fillStyle = "#ff4d6d";
        ctx.beginPath();
        ctx.arc(cx, cy, size * 0.32, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.drawImage(img, 0, 0, A, A, cx - size / 2, cy - size / 2, size, size);

        const beam = this._buildBeam(img);
        if (beam) {
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            ctx.drawImage(beam, cx - size / 2, cy - size / 2, size, size);
            ctx.restore();
        }

        ctx.imageSmoothingEnabled = prevSmooth;
    }

    _buildBeam(img) {
        const A = HeartPickup.ART;
        if (!HeartPickup._beam) {
            const c = document.createElement("canvas");
            c.width = A; c.height = A;
            HeartPickup._beam = c;
        }
        const bc = HeartPickup._beam;
        const bx = bc.getContext("2d");
        bx.globalCompositeOperation = "source-over";
        bx.clearRect(0, 0, A, A);

        const p = (Math.sin(this.sweepPhase) + 1) / 2;
        const travel = -A + p * (2.2 * A);
        const grad = bx.createLinearGradient(travel - A * 0.5, travel - A * 0.5, travel + A * 0.5, travel + A * 0.5);
        grad.addColorStop(0.0, "rgba(255,255,255,0)");
        grad.addColorStop(0.4, "rgba(255,255,255,0)");
        grad.addColorStop(0.5, "rgba(255,235,240,0.9)");
        grad.addColorStop(0.6, "rgba(255,255,255,0)");
        grad.addColorStop(1.0, "rgba(255,255,255,0)");
        bx.fillStyle = grad;
        bx.fillRect(0, 0, A, A);

        bx.globalCompositeOperation = "destination-in";
        bx.drawImage(this._mask(img), 0, 0);
        bx.globalCompositeOperation = "source-over";
        return bc;
    }

    _mask(img) {
        if (HeartPickup._maskCanvas) return HeartPickup._maskCanvas;
        const A = HeartPickup.ART;
        const c = document.createElement("canvas");
        c.width = A; c.height = A;
        const g = c.getContext("2d");
        g.drawImage(img, 0, 0, A, A, 0, 0, A, A);
        const data = g.getImageData(0, 0, A, A);
        for (let i = 3; i < data.data.length; i += 4) {
            data.data[i] = data.data[i] === 255 ? 255 : 0;
        }
        g.putImageData(data, 0, 0);
        HeartPickup._maskCanvas = c;
        return c;
    }
}
