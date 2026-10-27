import { DEMO, INTERACTIVES } from '../config/DemoConfig.js';
import { TILE } from '../config/GameConfig.js';
import { Physics } from '../core/Physics.js';

export class DemoProgress {
    constructor({ rooms, input, getPlayers, getSaw, assets = null }) {
        Object.assign(this, { rooms, input, getPlayers, getSaw, assets });
        this.reset();
    }

    reset(initial = {}) {
        this.state = { dash: false, sawThrow: false, bossKey: false, ...initial };
        this.activated = new Set();
        this.cut = new Map();
        this.held = [false, false];
        this.message = '';
        this.messageTime = 0;
        if (this.rooms.dungeon.document) this.rooms.dungeon.progress = this.state;
    }

    update(dt) {
        if (!this.rooms.dungeon.document) return;
        this.messageTime = Math.max(0, this.messageTime - dt);
        const room = this.rooms.current, rect = this.rooms.cellRect(), players = this.getPlayers();
        const pressed = players.map((_, i) => this.input.isDown(i === 0 ? 'e' : 'shiftright'));
        const tapped = pressed.map((v, i) => v && !this.held[i]);
        this.held = pressed;
        this.prompt = '';
        for (const o of room.cell.authored.interactives || []) {
            const id = `${room.key}/${o.id}`;
            if (this.activated.has(id)) continue;
            const x = rect.x + (o.col + 0.5) * TILE, y = rect.y + (o.row + 0.5) * TILE;
            if (o.type === 'ropeKey') {
                const saw = this.getSaw();
                if (!this.cut.has(id) && saw?.thrown && Physics.distToSegment(x, y, saw.prevX, saw.prevY, saw.dropX, saw.dropY) < DEMO.ropeRadius) this.cut.set(id, 0);
                if (!this.cut.has(id)) continue;
                this.cut.set(id, this.cut.get(id) + dt);
                if (this.cut.get(id) < DEMO.keyDropSeconds) continue;
            }
            for (let i = 0; i < players.length; i++) {
                const p = players[i];
                if (p.falling || p.lives <= 0 || Math.hypot(p.x - x, p.y - y) > DEMO.interactionRadius) continue;
                const pickup = o.type === 'key' || o.type === 'ropeKey';
                // O primeiro jogador em alcance define a dica, senão P2 sobrescreve a de P1.
                if (!this.prompt) this.prompt = pickup ? 'Pegue a chave' : `Interagir: ${i === 0 ? 'P1 E' : 'P2 Shift direito'} / controle X`;
                if (!pickup && !tapped[i]) continue;
                this.activated.add(id);
                if (o.type === 'altarDash') this.state.dash = true;
                if (o.type === 'altarSaw') this.state.sawThrow = true;
                if (pickup) this.state.bossKey = true;
                if (o.type === 'lever') {
                    for (const cell of o.tiles || []) {
                        if (room.tiles.floor[cell.row]?.[cell.col] !== -1) continue;
                        room.tiles.floor[cell.row][cell.col] = 16;
                        const line = room.cell.authored.kinds[cell.row];
                        room.cell.authored.kinds[cell.row] = line.slice(0, cell.col) + 'f' + line.slice(cell.col + 1);
                    }
                }
                this.message = o.type === 'lever' ? 'Ponte ativada' : pickup ? 'Chave do boss adquirida' : `${INTERACTIVES[o.type]?.label} adquirido pela dupla`;
                this.messageTime = DEMO.messageSeconds;
                break;
            }
        }
    }

    draw(ctx) {
        if (!this.rooms.dungeon.document) return;
        const room = this.rooms.current, rect = this.rooms.cellRect();
        ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = 'bold 22px sans-serif';
        for (const o of room.cell.authored.interactives || []) {
            const id = `${room.key}/${o.id}`, def = INTERACTIVES[o.type];
            if (!def) continue;
            const active = this.activated.has(id);
            if (active && ['key', 'ropeKey'].includes(o.type)) continue;
            const x = rect.x + (o.col + 0.5) * TILE, y = rect.y + (o.row + 0.5) * TILE;
            if (o.type === 'key' || o.type === 'ropeKey') {
                const drop = o.type === 'key' ? 1 : Math.min(1, (this.cut.get(id) || 0) / DEMO.keyDropSeconds);
                const keyY = y - DEMO.keyHeight * (1 - drop * drop);
                if (o.type === 'ropeKey' && !this.cut.has(id)) {
                    ctx.strokeStyle = '#ccb787'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, y - DEMO.keyHeight - 36); ctx.lineTo(x, keyY); ctx.stroke();
                }
                const image = this.assets?.get(`demoKey${Math.floor(performance.now() / 150) % 4 + 1}`);
                ctx.fillStyle = '#0008'; ctx.fillRect(x - 12, y + 10, 24, 5);
                if (image?.complete && image.naturalWidth) ctx.drawImage(image, x - 20, keyY - 20, 40, 40);
                else { ctx.fillStyle = def.color; ctx.fillText('⚿', x, keyY); }
                continue;
            }
            ctx.fillStyle = '#322b42'; ctx.fillRect(x - 28, y + 10, 56, 16);
            ctx.fillStyle = '#655669'; ctx.fillRect(x - 24, y - 2, 48, 18);
            ctx.fillStyle = active ? '#53635a' : def.color;
            if (o.type === 'lever') {
                ctx.fillRect(x - 6, y - 24, 12, 28); ctx.fillRect(x + (active ? 0 : -18), y - 28, 18, 8);
            } else {
                ctx.fillRect(x - 18, y - 30, 36, 28); ctx.fillStyle = '#17131e'; ctx.fillText(active ? '✓' : def.symbol, x, y - 15);
            }
            if (o.type === 'lever' && active) for (const cell of o.tiles || []) {
                ctx.fillStyle = '#987247'; ctx.fillRect(rect.x + cell.col * TILE, rect.y + cell.row * TILE, TILE, TILE);
                ctx.strokeStyle = '#473326'; ctx.lineWidth = 3;
                for (let n = 0; n < 4; n++) ctx.strokeRect(rect.x + cell.col * TILE, rect.y + cell.row * TILE + n * 16, TILE, 16);
            }
        }
        ctx.restore();
    }
}
