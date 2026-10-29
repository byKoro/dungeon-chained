import { sideOf, doorCells } from './MapConnections.js';

// Tocha de parede: N/S ficam na própria borda; W/E ficam no piso à frente da parede lateral
// (col 1 e cols-2), como no editor 1.0 e no Renderer do jogo.
export function torchPlacement(room, cell) {
    const { col, row } = cell, lastCol = room.cols - 1, lastRow = room.rows - 1;
    if (col < 0 || row < 0 || col > lastCol || row > lastRow) return null;

    let side, target;
    if (row === 0 || row === lastRow) {
        if (col === 0 || col === lastCol) return null;
        side = row === 0 ? 'N' : 'S';
        target = { col, row };
    } else if (col <= 1) {
        side = 'W'; target = { col: 1, row };
    } else if (col >= lastCol - 1) {
        side = 'E'; target = { col: lastCol - 1, row };
    } else return null;

    if (room.kinds?.[target.row]?.[target.col] === 'h') return null;
    const onDoor = (room.doors || []).some(d => {
        const doorSide = sideOf(room, d);
        return doorSide === side && doorCells(room, d).some(p => (side === 'N' || side === 'S') ? p.col === target.col : p.row === target.row);
    });
    return onDoor ? null : { ...target, side };
}

// A tocha lateral só existe desenhada para a parede oeste; na leste o sprite é espelhado.
export const isMirroredTorch = (t) => (t.type || 'torch') === 'torch' && t.side === 'E';
