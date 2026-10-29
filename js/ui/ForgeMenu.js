import { drawText, measureText } from './PixelFont.js';
import { FRAME, pixelScale } from './PixelButton.js';
import { t } from '../i18n/I18n.js';

const W = 156;
const ROW_H = 13;
const PAD = 6;
const HEAD_H = 18;
const FOOT_H = 24;
const COLORS = {
    text: "#efe3c2", dim: "#7a7184", gold: "#ffd166", red: "#e05f5f", ok: "#9fe08b",
    row: "#221d2b", rowSel: "#3b3248", shadow: "#000"
};

// Menu da bigorna desenhado no canvas (1 px de arte, escala inteira), no centro da tela.
export class ForgeMenu {
    constructor({ forgeSystem, getAmount, coin = null }) {
        Object.assign(this, { forgeSystem, getAmount, coin });
        this._canvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
        this._key = null;
    }

    _rows() {
        const fs = this.forgeSystem;
        return fs.recipes.map(id => {
            const status = fs.status(id);
            const level = fs.forge.level(id), max = fs.forge.maxLevel(id);
            return { id, status, level, max, cost: fs.forge.nextCost(id) };
        });
    }

    _render() {
        const fs = this.forgeSystem;
        const rows = this._rows();
        const amount = this.getAmount();
        const key = JSON.stringify([rows, amount, fs.cursor, fs.denyT > 0]);
        if (key === this._key) return this._canvas;
        this._key = key;

        const H = HEAD_H + Math.max(1, rows.length) * ROW_H + FOOT_H + PAD;
        const c = this._canvas;
        c.width = W + 1; c.height = H + 1;
        const g = c.getContext("2d");
        g.clearRect(0, 0, c.width, c.height);
        const rect = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
        const chamfer = (x, y, w, h, col) => { rect(x + 1, y, w - 2, h, col); rect(x, y + 1, w, h - 2, col); };
        const text = (s, x, y, col) => { drawText(g, s, x, y + 1, COLORS.shadow); drawText(g, s, x, y, col); };

        g.globalAlpha = 0.5; chamfer(1, 1, W, H, "#000"); g.globalAlpha = 1;
        chamfer(0, 0, W, H, FRAME.outline);
        chamfer(1, 1, W - 2, H - 2, FRAME.stone);
        rect(2, 1, W - 4, 1, FRAME.stoneLight);
        rect(2, H - 2, W - 4, 1, FRAME.stoneDark);
        rect(3, 3, W - 6, H - 6, FRAME.well);

        text(t("forge.title"), PAD, 7, COLORS.gold);
        const amountText = String(amount);
        const ax = W - PAD - measureText(amountText);
        text(amountText, ax, 7, COLORS.text);
        this._coin(g, ax - 12, 4);

        let y = HEAD_H;
        if (!rows.length) text(t("forge.empty"), PAD, y + 3, COLORS.dim);
        rows.forEach((r, i) => {
            const sel = i === fs.cursor;
            rect(4, y, W - 8, ROW_H - 2, sel ? (fs.denyT > 0 ? "#4a2630" : COLORS.rowSel) : COLORS.row);
            const usable = r.status === "ok" || r.status === "maxed";
            const col = r.status === "ok" ? COLORS.text : r.status === "maxed" ? COLORS.ok : COLORS.dim;
            if (sel) text("▶", 6, y + 3, COLORS.gold);
            text(t(`forge.${r.id}`), 13, y + 3, col);
            if (r.max > 1) for (let n = 0; n < r.max; n++) {
                rect(78 + n * 6, y + 4, 4, 4, n < r.level ? COLORS.gold : (usable ? FRAME.stoneDark : "#2b2735"));
            }
            const right = r.status === "maxed" ? t("forge.max") : String(r.cost);
            const rx = W - PAD - 2 - measureText(right);
            text(right, rx, y + 3, r.status === "poor" ? COLORS.red : col);
            if (r.status !== "maxed") this._coin(g, rx - 12, y, r.status !== "ok");
            y += ROW_H;
        });

        const sel = rows[fs.cursor];
        const info = !sel ? "" : sel.status === "locked" ? t("forge.locked") : sel.status === "poor" ? t("forge.poor") : t(`forge.desc.${sel.id}`);
        text(info, PAD, y + 3, sel?.status === "locked" || sel?.status === "poor" ? COLORS.red : COLORS.text);
        text(t("forge.hint"), PAD, y + 14, COLORS.dim);
        return c;
    }

    _coin(g, x, y, dim = false) {
        const img = this.coin;
        if (!img?.complete || !img.naturalWidth) return;
        g.globalAlpha = dim ? 0.45 : 1;
        g.drawImage(img, 3, 3, 10, 10, x, y, 10, 10);
        g.globalAlpha = 1;
    }

    draw(ctx, canvas) {
        if (!this.forgeSystem.open || !this._canvas) return;
        const art = this._render();
        const s = pixelScale();
        const dw = art.width * s, dh = art.height * s;
        const shake = this.forgeSystem.denyT > 0 ? Math.round(Math.sin(this.forgeSystem.denyT * 1.7) * 2) * s : 0;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = "rgba(8, 7, 14, 0.55)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(art, Math.round((canvas.width - dw) / 2) + shake, Math.round((canvas.height - dh) / 2), dw, dh);
        ctx.restore();
    }
}
