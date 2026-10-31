import { BUTTON_PROMPT } from '../config/ButtonPromptConfig.js';
import { drawText, measureText } from './PixelFont.js';
import { t } from '../i18n/I18n.js';

// Botão da ação para o dispositivo do jogador: { icon, label? } (label só nas teclas), ou null se a ação não existe.
export function promptFor(action, device, playerIndex = 0, cfg = BUTTON_PROMPT) {
    const a = cfg.actions[action];
    if (!a) return null;
    if (device === "xbox" || device === "playstation") return { icon: a[device] };
    return { icon: "key", label: t(a.keyboard[playerIndex] ?? a.keyboard[0]) };
}

export const samePrompt = (a, b) => a?.icon === b?.icon && a?.label === b?.label;

export function promptWidth(p, cfg = BUTTON_PROMPT) {
    if (p.icon !== "key") return cfg.icons[p.icon].w;
    return Math.max(cfg.icons.key.w, measureText(p.label) + 2 * cfg.keyPadX + 2);
}

// Desenha em `g` (canvas em px de arte) com o canto de cima à esquerda em x,y. Devolve a largura usada.
export function drawPrompt(g, sheet, p, x, y, pressed, cfg = BUTTON_PROMPT) {
    const cell = cfg.cell, sy = pressed ? cell : 0;
    const icon = cfg.icons[p.icon];
    const w = promptWidth(p, cfg);
    if (sheet?.complete !== false && sheet?.width) {
        const sx = icon.col * cell;
        if (p.icon === "key") {
            const e = cfg.keyEdge;
            g.drawImage(sheet, sx, sy, e, cell, x, y, e, cell);
            g.drawImage(sheet, sx + e, sy, 1, cell, x + e, y, w - 2 * e, cell);
            g.drawImage(sheet, sx + cell - e, sy, e, cell, x + w - e, y, e, cell);
        } else {
            g.drawImage(sheet, sx, sy, cell, cell, x, y, cell, cell);
        }
    }
    if (p.label) {
        const lx = x + Math.round((w - measureText(p.label)) / 2), ly = y + cfg.keyLabelY + (pressed ? 2 : 0);
        drawText(g, p.label, lx, ly + 1, "#0b0910");
        drawText(g, p.label, lx, ly, "#efe3c2");
    }
    return w;
}
