export class Renderer {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.zoom = 1.50;
        this.screenShake = 0;
    }

    triggerShake(amount = 14) {
        this.screenShake = Math.max(this.screenShake, amount);
    }

    beginFrame() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();

        // Screen Shake
        if (this.screenShake > 0) {
            const sx = (Math.random() - 0.5) * this.screenShake;
            const sy = (Math.random() - 0.5) * this.screenShake;
            this.ctx.translate(sx, sy);
            this.screenShake *= 0.88;
            if (this.screenShake < 0.3) this.screenShake = 0;
        }

        // Câmera com Zoom centralizado
        this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.scale(this.zoom, this.zoom);
        this.ctx.translate(-this.canvas.width / 2, -canvas.height / 2);
    }

    endFrame() {
        this.ctx.restore();
    }

    drawRoundShadow(x, y, baseRadius, bounceFactor = 0) {
        this.ctx.save();
        const currentR = Math.max(6, baseRadius - bounceFactor * 1.5);
        this.ctx.translate(x, y + 17);

        const grad = this.ctx.createRadialGradient(0, 0, 1, 0, 0, currentR);
        grad.addColorStop(0, "rgba(0, 0, 0, 0.65)");
        grad.addColorStop(0.6, "rgba(0, 0, 0, 0.35)");
        grad.addColorStop(1, "rgba(0, 0, 0, 0)");

        this.ctx.beginPath();
        this.ctx.arc(0, 0, currentR, 0, Math.PI * 2);
        this.ctx.fillStyle = grad;
        this.ctx.fill();
        this.ctx.restore();
    }

    drawDungeon(boxes, trapdoor) {
        const c = this.ctx;

        // Fundo
        c.fillStyle = "#15141f";
        c.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Grade do chão
        c.strokeStyle = "#1e1d2d";
        c.lineWidth = 2;
        for (let x = 120; x < this.canvas.width - 120; x += 40) {
            c.beginPath();
            c.moveTo(x, 80);
            c.lineTo(x, this.canvas.height - 80);
            c.stroke();
        }
        for (let y = 80; y < this.canvas.height - 80; y += 40) {
            c.beginPath();
            c.moveTo(120, y);
            c.lineTo(this.canvas.width - 120, y);
            c.stroke();
        }

        // Paredes
        c.fillStyle = "#0a0910";
        c.fillRect(0, 0, this.canvas.width, 80);
        c.fillRect(0, this.canvas.height - 80, this.canvas.width, 80);
        c.fillRect(0, 0, 120, this.canvas.height);
        c.fillRect(this.canvas.width - 120, 0, 120, this.canvas.height);

        c.strokeStyle = "#2d2a3e";
        c.lineWidth = 4;
        c.strokeRect(120, 80, this.canvas.width - 240, this.canvas.height - 160);

        // Caixas
        boxes.forEach(b => {
            this.drawRoundShadow(b.x + b.w / 2, b.y + b.h / 2, 22, 0);

            c.fillStyle = "#4a3c2c";
            c.fillRect(b.x, b.y, b.w, b.h);
            c.strokeStyle = "#282016";
            c.lineWidth = 3;
            c.strokeRect(b.x, b.y, b.w, b.h);

            c.beginPath();
            c.moveTo(b.x, b.y);
            c.lineTo(b.x + b.w, b.y + b.h);
            c.moveTo(b.x + b.w, b.y);
            c.lineTo(b.x, b.y + b.h);
            c.stroke();
        });

        // Alçapão
        c.save();
        c.translate(trapdoor.x, trapdoor.y);
        c.fillStyle = trapdoor.open ? "#000" : "#2e2118";
        c.fillRect(-trapdoor.size / 2, -trapdoor.size / 2, trapdoor.size, trapdoor.size);
        c.strokeStyle = trapdoor.open ? "#00ebc7" : "#553b2a";
        c.lineWidth = 3;
        c.strokeRect(-trapdoor.size / 2, -trapdoor.size / 2, trapdoor.size, trapdoor.size);

        c.fillStyle = trapdoor.open ? "#00ebc7" : "#a7a9be";
        c.font = "bold 11px monospace";
        c.fillText(trapdoor.open ? "ABERTO" : "FECHADO", -23, 4);
        c.restore();
    }
}