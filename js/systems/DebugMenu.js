import { DEBUG } from '../config/DebugConfig.js';
import { FORGE_RECIPE_IDS } from '../config/ForgeConfig.js';
import { t } from '../i18n/I18n.js';
import { ABILITY_CARD_KEYS } from '../ui/AbilityCard.js';

// Console de debug em jogo (F1): libera serra/melhorias/habilidades, spawna a serra, teleporta e cura, só na
// partida atual. Mexe em vários sistemas do `Game`, então recebe o próprio `Game` (getGame) em vez de getters soltos.
// Navega pelo teclado (setas/WASD, Enter, ←/→) por um listener próprio, como o F6/F7 do teste do editor.
export class DebugMenu {
    constructor({ getGame, cfg = DEBUG } = {}) {
        this.getGame = getGame;
        this.cfg = cfg;
        this.open = false;
        this.index = 0;
        this._card = 0;
        this._anvil = 0;
        this._nav = { up: false, down: false, left: false, right: false, enter: false };
        this._items = this._build();
        if (typeof window !== "undefined") {
            window.debug = this;
            window.addEventListener("keydown", e => this._onKey(e));
        }
    }

    get game() {
        return this.getGame?.() ?? null;
    }

    toggle() {
        this.open = !this.open;
        this.index = 0;
    }

    _onKey(e) {
        if (e.code === this.cfg.toggleCode) { e.preventDefault(); this.toggle(); return; }
        if (!this.open) return;
        const k = e.key.toLowerCase(), code = e.code.toLowerCase();
        const hit = {
            up: k === "arrowup" || code === "keyw",
            down: k === "arrowdown" || code === "keys",
            left: k === "arrowleft" || code === "keya",
            right: k === "arrowright" || code === "keyd",
            enter: k === "enter" || code === "keye" || k === " "
        };
        if (!Object.values(hit).some(Boolean)) return;
        e.preventDefault();
        e.stopPropagation();
        const items = this._visibleItems();
        const item = items[this.index];
        if (hit.up) this.index = (this.index - 1 + items.length) % items.length;
        else if (hit.down) this.index = (this.index + 1) % items.length;
        else if (hit.left) item?.left?.(this.game);
        else if (hit.enter && item?.enter) item.enter(this.game);
        else if (hit.right || hit.enter) item?.right?.(this.game);
    }

    // Enquanto o menu está aberto, as teclas de navegação não podem virar movimento/dash dos jogadores.
    maskInput(input) {
        if (!this.open || !input) return;
        for (const key of ["arrowup", "arrowdown", "arrowleft", "arrowright", "enter", "w", "a", "s", "d", "e", " "]) {
            input.keys.delete(key);
        }
    }

    _visibleItems() {
        return this._items.filter(it => !it.show || it.show(this.game));
    }

    _build() {
        const items = [];
        items.push({
            show: g => !!g?.scrap,
            label: g => `Moedas: ${g?.scrap?.amount ?? 0}  (±${this.cfg.coinStep})`,
            left: g => g && this._addCoins(g, -this.cfg.coinStep),
            right: g => g && this._addCoins(g, this.cfg.coinStep)
        });
        items.push({
            show: g => !!g?.scrap,
            label: () => `+${this.cfg.coinBulk} moedas`,
            right: g => g && this._addCoins(g, this.cfg.coinBulk)
        });
        items.push({
            show: g => !!g?.abilityCard,
            label: () => `Telinha ◂ ${t(`${this._cardKey()}.title`)} ▸  Enter mostra`,
            left: () => this._cycle("_card", -1, ABILITY_CARD_KEYS.length),
            right: () => this._cycle("_card", 1, ABILITY_CARD_KEYS.length),
            enter: g => g && this._showCard(g)
        });
        items.push({
            show: g => !!g?.forgeSystem && this._anvilList(g).length > 0,
            label: g => {
                const list = this._anvilList(g), a = list[this._anvil % list.length];
                return `Bigorna ◂ ${a ? this._roomName(g, a.roomKey) : "-"} ▸  Enter abre`;
            },
            left: g => this._cycle("_anvil", -1, this._anvilList(g).length),
            right: g => this._cycle("_anvil", 1, this._anvilList(g).length),
            enter: g => g && this._openAnvil(g)
        });
        items.push({
            label: g => `Serra: ${g?.chain?.hasSaw ? (g.chain.isConnected ? "conectada" : "largada") : "sem serra"}`,
            right: g => g && this._grantSaw(g)
        });
        items.push({
            label: () => "Spawnar serra nos jogadores",
            right: g => g && this._spawnSawAtPlayers(g)
        });
        for (const id of FORGE_RECIPE_IDS) {
            items.push({
                label: g => {
                    const lvl = g?.forge?.level(id) ?? 0, max = g?.forge?.maxLevel(id) ?? 0;
                    const name = t(`forge.${id}`);
                    return max > 1 ? `${name}: ${lvl}/${max}` : `${name}: ${lvl > 0 ? "sim" : "não"}`;
                },
                left: g => g && this._setRecipe(g, id, -1),
                right: g => g && this._setRecipe(g, id, +1)
            });
        }
        for (const [key, name] of [["dash", "Dash"], ["sawThrow", "Serra arremessada"], ["bossKey", "Chave do boss"]]) {
            items.push({
                show: g => !!g?.demoProgress,
                label: g => `${name}: ${g?.demoProgress?.state?.[key] ? "ON" : "OFF"}`,
                left: g => g && this._setAbility(g, key, false),
                right: g => g && this._setAbility(g, key, !g.demoProgress.state[key])
            });
        }
        items.push({
            label: g => `Vida infinita: ${g?.infiniteLives ? "ON" : "OFF"}`,
            left: g => g?.setInfiniteLives(false),
            right: g => g?.setInfiniteLives(!g.infiniteLives)
        });
        items.push({ label: () => "Encher vidas", right: g => g && this._healAll(g) });
        items.push({
            show: g => g?.rooms?.current?.enemies?.length > 0,
            label: g => `Matar inimigos da sala (${g?.rooms?.current?.enemies?.length ?? 0})`,
            right: g => g && this._killRoom(g)
        });
        for (const key of this._roomKeys()) {
            items.push({
                show: g => !!g?.mapData,
                label: g => `TP → sala ${this._roomName(g, key)}${this._isCurrent(g, key) ? " (aqui)" : ""}`,
                right: g => g && this._teleportRoom(g, key)
            });
        }
        return items;
    }

    _roomKeys() {
        const rooms = this.game?.mapData?.map?.rooms;
        return rooms ? Object.keys(rooms) : [];
    }

    _roomName(g, key) {
        const r = g?.mapData?.map?.rooms?.[key];
        return r?.name ? `${r.name} (${key})` : key;
    }

    _isCurrent(g, key) {
        return `${g?.rooms?.dungeon?.current?.gx},${g?.rooms?.dungeon?.current?.gy}` === key;
    }

    _cycle(field, dir, n) {
        if (n > 0) this[field] = (this[field] + dir + n) % n;
    }

    _cardKey() {
        return ABILITY_CARD_KEYS[this._card % ABILITY_CARD_KEYS.length];
    }

    // Todas as bigornas do mapa, na ordem das salas.
    _anvilList(g) {
        const out = [];
        for (const [roomKey, room] of Object.entries(g?.mapData?.map?.rooms || {})) {
            for (const prop of room.props || []) if (prop.type === "anvil") out.push({ roomKey, prop });
        }
        return out;
    }

    // ---------- cheats (chamam métodos existentes do Game) ----------

    _addCoins(g, n) {
        const w = g.scrap.wallet;
        if (n >= 0) w.add(n);
        else w.amount = Math.max(0, w.amount + n);
    }

    // Fecha o F1 para a ação aparecer; o Enter/Espaço apertado não pode virar dash no step seguinte.
    _closeForAction(g) {
        this.open = false;
        for (const p of [g.p1, g.p2]) p?.latchDashKey?.();
    }

    // Só mostra a telinha: não libera a habilidade.
    _showCard(g) {
        this._closeForAction(g);
        g.abilityCard.show(this._cardKey());
    }

    // Abre a forja da bigorna escolhida onde a dupla está. Na sala atual usa a bigorna de verdade; de outra sala,
    // o ponto da bigorna fica entre os dois (a cinemática da Serra acontece ali). Ignora inimigos vivos.
    _openAnvil(g) {
        if (g.transition || g.gameOver || g.sawCinematic?.active || g.forgeSystem.open) return;
        const list = this._anvilList(g), pick = list[this._anvil % list.length];
        if (!pick) return;
        const here = this._isCurrent(g, pick.roomKey)
            ? g.forgeSystem._anvils().find(a => a.prop.col === pick.prop.col && a.prop.row === pick.prop.row)
            : null;
        const x = (g.p1.x + g.p2.x) / 2, y = (g.p1.y + g.p2.y) / 2;
        const anvil = here ?? { prop: pick.prop, roomKey: pick.roomKey, x, y, topY: y - 32 };
        this._closeForAction(g);
        g.forgeSystem.openAt(anvil);
    }

    _grantSaw(g) {
        g.forge.levels.saw = 1;
        g.chain.reset({ present: true });
        g._applySawUpgrades();
    }

    _spawnSawAtPlayers(g) {
        g.forge.levels.saw = 1;
        g._applySawUpgrades?.();
        const x = (g.p1.x + g.p2.x) / 2, y = (g.p1.y + g.p2.y) / 2;
        g.chain.spawnSaw(x, y);
    }

    _setRecipe(g, id, dir) {
        const max = g.forge.maxLevel(id);
        const next = Math.max(0, Math.min(max, g.forge.level(id) + dir));
        g.forge.levels[id] = next;
        // Sem a serra não faz sentido manter melhorias ligadas; subir uma melhoria também libera a serra.
        if (id !== "saw" && next > 0 && !g.forge.has("saw")) { g.forge.levels.saw = 1; g.chain.reset({ present: true }); }
        if (id === "saw" && next === 0) g.chain.reset({ present: false });
        else if (id === "saw" && next > 0) g.chain.reset({ present: true });
        g._applySawUpgrades();
    }

    _setAbility(g, key, value) {
        g.demoProgress.state[key] = value;
        if (g.rooms?.dungeon) g.rooms.dungeon.progress = g.demoProgress.state;
    }

    _healAll(g) {
        for (const p of [g.p1, g.p2]) if (p) p.lives = p.maxLives;
    }

    _killRoom(g) {
        for (const e of g.rooms.current.enemies) {
            if (typeof e.startDying === "function") { e.hp = 0; e.startDying(); }
            else e.hp = 0;
        }
    }

    _teleportRoom(g, key) {
        const cell = g.rooms.dungeon.graph.cells.get(key);
        if (!cell) return;
        g.teleportToCell?.(cell.gx, cell.gy);
        this.open = false;
    }

    // ---------- desenho ----------

    draw(ctx, canvas) {
        if (!this.open) return;
        const g = this.game, c = this.cfg, col = c.colors;
        const items = this._visibleItems();
        const h = c.padding * 2 + 24 + items.length * c.rowHeight;
        const x = c.padding, y = Math.max(c.padding, (canvas.height - h) / 2);
        ctx.save();
        ctx.textBaseline = "middle";
        ctx.fillStyle = col.panel;
        ctx.fillRect(x, y, c.width, h);
        ctx.strokeStyle = col.border;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 0.5, y + 0.5, c.width, h);

        ctx.font = c.titleFont;
        ctx.fillStyle = col.title;
        ctx.textAlign = "left";
        ctx.fillText("DEBUG (F1) · setas/WASD · Enter", x + c.padding, y + c.padding + 8);

        const top = y + c.padding + 30;
        ctx.font = c.font;
        for (let i = 0; i < items.length; i++) {
            const ry = top + i * c.rowHeight;
            if (i === this.index) {
                ctx.fillStyle = col.selected;
                ctx.fillRect(x + 4, ry - c.rowHeight / 2 + 2, c.width - 8, c.rowHeight - 2);
            }
            ctx.fillStyle = i === this.index ? col.text : col.dim;
            ctx.fillText(items[i].label(g), x + c.padding, ry);
        }
        ctx.restore();
    }
}
