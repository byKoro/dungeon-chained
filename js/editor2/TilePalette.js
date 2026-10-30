// Paleta clicável do tileset. Clique escolhe 1 tile; arrastar escolhe um bloco retangular (carimbo).
export class TilePalette {
    constructor({ canvas, image, tileSize = 16, cols = 10, scale = 2, onChange = null }) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.image = image;
        this.tileSize = tileSize;
        this.cols = cols;
        this.scale = scale;
        this.onChange = onChange;

        this.rows = 0;
        this._transparentTiles = new Set();
        this.selection = { col: 6, row: 1, w: 1, h: 1 };
        this.hover = null;
        this._dragStart = null;

        canvas.addEventListener("mousedown", (e) => this._onDown(e));
        canvas.addEventListener("mousemove", (e) => this._onMove(e));
        window.addEventListener("mouseup", () => this._onUp());
        canvas.addEventListener("mouseleave", () => { this.hover = null; this.draw(); });
        this._resize();
    }

    get ready() {
        return this.image && this.image.complete && this.image.naturalWidth > 0;
    }

    _resize() {
        if (!this.ready) return;
        this.rows = Math.floor(this.image.naturalHeight / this.tileSize);
        const source = document.createElement("canvas");
        source.width = this.image.naturalWidth;
        source.height = this.image.naturalHeight;
        const ctx = source.getContext("2d");
        ctx.drawImage(this.image, 0, 0);
        const { data } = ctx.getImageData(0, 0, source.width, source.height);
        this._transparentTiles.clear();
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                let transparent = false;
                for (let y = 0; y < this.tileSize && !transparent; y++) {
                    for (let x = 0; x < this.tileSize; x++) {
                        const pixel = (r * this.tileSize + y) * source.width + c * this.tileSize + x;
                        if (data[pixel * 4 + 3] < 255) { transparent = true; break; }
                    }
                }
                if (transparent) this._transparentTiles.add(r * this.cols + c);
            }
        }
        this.canvas.width = this.cols * this.tileSize * this.scale;
        this.canvas.height = this.rows * this.tileSize * this.scale;
        this.draw();
    }

    // Índices do bloco selecionado, linha a linha.
    get stamp() {
        const { col, row, w, h } = this.selection;
        const out = [];
        for (let r = 0; r < h; r++) {
            const line = [];
            for (let c = 0; c < w; c++) line.push((row + r) * this.cols + (col + c));
            out.push(line);
        }
        return out;
    }

    get firstIndex() {
        return this.selection.row * this.cols + this.selection.col;
    }

    hasTransparency(index) {
        return this._transparentTiles.has(index);
    }

    selectIndex(index) {
        if (!Number.isInteger(index) || index < 0) return;
        this.selection = { col: index % this.cols, row: (index / this.cols) | 0, w: 1, h: 1 };
        this.draw();
        this.onChange?.(this);
    }

    _tileFromEvent(e) {
        const rect = this.canvas.getBoundingClientRect();
        const px = (e.clientX - rect.left) * (this.canvas.width / rect.width);
        const py = (e.clientY - rect.top) * (this.canvas.height / rect.height);
        const size = this.tileSize * this.scale;
        const col = Math.max(0, Math.min(this.cols - 1, Math.floor(px / size)));
        const row = Math.max(0, Math.min(this.rows - 1, Math.floor(py / size)));
        return { col, row };
    }

    _onDown(e) {
        if (e.button !== 0 || !this.ready) return;
        this._dragStart = this._tileFromEvent(e);
        this._selectRect(this._dragStart, this._dragStart);
    }

    _onMove(e) {
        if (!this.ready) return;
        this.hover = this._tileFromEvent(e);
        if (this._dragStart) this._selectRect(this._dragStart, this.hover);
        else this.draw();
    }

    _onUp() {
        if (!this._dragStart) return;
        this._dragStart = null;
        this.onChange?.(this);
    }

    _selectRect(a, b) {
        this.selection = {
            col: Math.min(a.col, b.col),
            row: Math.min(a.row, b.row),
            w: Math.abs(a.col - b.col) + 1,
            h: Math.abs(a.row - b.row) + 1
        };
        this.draw();
    }

    draw() {
        if (!this.ready) return;
        const ctx = this.ctx;
        const size = this.tileSize * this.scale;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.fillStyle = "#16131f";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.drawImage(this.image, 0, 0, this.canvas.width, this.canvas.height);

        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.lineWidth = 1;
        for (let c = 0; c <= this.cols; c++) {
            ctx.beginPath();
            ctx.moveTo(c * size + 0.5, 0);
            ctx.lineTo(c * size + 0.5, this.canvas.height);
            ctx.stroke();
        }
        for (let r = 0; r <= this.rows; r++) {
            ctx.beginPath();
            ctx.moveTo(0, r * size + 0.5);
            ctx.lineTo(this.canvas.width, r * size + 0.5);
            ctx.stroke();
        }

        if (this.hover && !this._dragStart) {
            ctx.strokeStyle = "rgba(255, 209, 102, 0.8)";
            ctx.strokeRect(this.hover.col * size + 1, this.hover.row * size + 1, size - 2, size - 2);
        }

        const s = this.selection;
        ctx.strokeStyle = "#7f5af0";
        ctx.lineWidth = 3;
        ctx.strokeRect(s.col * size + 1.5, s.row * size + 1.5, s.w * size - 3, s.h * size - 3);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1;
        ctx.strokeRect(s.col * size + 0.5, s.row * size + 0.5, s.w * size - 1, s.h * size - 1);
    }

    // Recalcula o tamanho quando a imagem termina de carregar depois do construtor.
    refresh() {
        this._resize();
    }
}
