import { sideOf, doorCells } from './MapConnections.js';

// Tocha de parede, nas bordas e nas paredes criadas pelo pincel. Mesma convenção do Renderer:
//   N/S: no próprio tile de parede (face virada para baixo / para cima);
//   W/E: no tile à frente da parede lateral (parede à esquerda / à direita).
// A face exposta pode ser piso ou buraco. Cantos, portas e paredes sem face exposta não aceitam.
const exposed = (room, c, r) => ['f', 'h'].includes(room.kinds?.[r]?.[c]);
const isWall = (room, c, r) => room.kinds?.[r]?.[c] === 'w';

function borderPlacement(room, col, row) {
    const lastCol = room.cols - 1, lastRow = room.rows - 1;
    if (row === 0 || row === lastRow) {
        if (col === 0 || col === lastCol) return null;
        return { col, row, side: row === 0 ? 'N' : 'S' };
    }
    if (col === 0) return { col: 1, row, side: 'W' };
    if (col === lastCol) return { col: lastCol - 1, row, side: 'E' };
    return undefined;
}

// Parede criada: a face exposta define o lado (abaixo primeiro, que é a face que aparece de frente).
function wallPlacement(room, col, row) {
    if (exposed(room, col, row + 1)) return { col, row, side: 'N' };
    if (exposed(room, col, row - 1)) return { col, row, side: 'S' };
    if (exposed(room, col + 1, row)) return { col: col + 1, row, side: 'W' };
    if (exposed(room, col - 1, row)) return { col: col - 1, row, side: 'E' };
    return null;
}

// Piso (ou buraco) clicado: vale a parede lateral encostada, como na moldura (col 1 e cols-2).
function floorPlacement(room, col, row) {
    const lastCol = room.cols - 1;
    if (col === 1 || isWall(room, col - 1, row)) return { col, row, side: 'W' };
    if (col === lastCol - 1 || isWall(room, col + 1, row)) return { col, row, side: 'E' };
    return null;
}

function onDoor(room, t) {
    return (room.doors || []).some(d => {
        const doorSide = sideOf(room, d);
        if (doorSide !== t.side) return false;
        return doorCells(room, d).some(p => (t.side === 'N' || t.side === 'S') ? p.col === t.col && p.row === t.row : p.row === t.row
            && Math.abs(p.col - t.col) === 1);
    });
}

export function torchPlacement(room, cell) {
    const { col, row } = cell, lastCol = room.cols - 1, lastRow = room.rows - 1;
    if (col < 0 || row < 0 || col > lastCol || row > lastRow) return null;

    let target = borderPlacement(room, col, row);
    if (target === undefined) target = isWall(room, col, row) ? wallPlacement(room, col, row)
        : exposed(room, col, row) ? floorPlacement(room, col, row) : null;
    if (!target) return null;

    // N/S ficam na parede; W/E precisam de parede atrás e de chão ou buraco onde a tocha fica.
    if (target.side === 'N' || target.side === 'S') {
        if (!isWall(room, target.col, target.row) && !(target.row === 0 || target.row === lastRow)) return null;
    } else {
        const behind = target.side === 'W' ? target.col - 1 : target.col + 1;
        const borderBehind = behind === 0 || behind === lastCol;
        if (!borderBehind && !isWall(room, behind, target.row)) return null;
        if (!exposed(room, target.col, target.row)) return null;
    }
    return onDoor(room, target) ? null : target;
}

// A tocha lateral só existe desenhada para a parede oeste; na leste o sprite é espelhado.
export const isMirroredTorch = (t) => (t.type || 'torch') === 'torch' && t.side === 'E';
