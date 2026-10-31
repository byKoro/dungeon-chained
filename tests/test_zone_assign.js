import assert from 'node:assert/strict';
import { ownerZone, objectsOwnedByZone } from '../js/rooms/ZoneAssign.js';

let passed = 0, failed = 0;
const ok = (c, m) => { if (c) { console.log(`✅ ${m}`); passed++; } else { console.error(`❌ ${m}`); failed++; } };

console.log('=== TESTE DA ATRIBUIÇÃO DE ZONA (dedupe de sobreposição) ===');

// Zonas da sala botas: "combate" (menor) está dentro de "zona" (maior).
const zones = [
    { id: 'zona', col: 3, row: 4, w: 31, h: 20 },
    { id: 'combate', col: 16, row: 15, w: 16, h: 11 }
];

// Objeto dentro das duas zonas → dono é a menor ("combate").
{
    const o = { col: 20, row: 18 };
    ok(ownerZone(zones, o).id === 'combate', 'objeto na sobreposição pertence à menor zona');
}
// Objeto só na zona grande → dono é "zona".
{
    const o = { col: 5, row: 6 };
    ok(ownerZone(zones, o).id === 'zona', 'objeto só na zona grande pertence a ela');
}
// Objeto fora de todas → null.
{
    ok(ownerZone(zones, { col: 0, row: 0 }) === null, 'objeto fora de qualquer zona: null');
}

// objectsOwnedByZone reparte sem duplicar.
{
    const enemies = [
        { col: 19, row: 19 }, { col: 21, row: 23 }, { col: 27, row: 19 },
        { col: 28, row: 22 }, { col: 18, row: 16 }, { col: 17, row: 23 }
    ];
    const combate = objectsOwnedByZone(zones, enemies, 'combate');
    const zona = objectsOwnedByZone(zones, enemies, 'zona');
    ok(combate.length === 6 && zona.length === 0, 'os 6 inimigos da arena ficam só em "combate" (não duplicam em "zona")');
    ok(combate.length + zona.length === enemies.length, 'cada inimigo é atribuído a exatamente uma zona');
}

// Estacas: as da arena ficam em combate, as de fora em zona, sem interseção.
{
    const ropes = [
        { col: 24, row: 22 }, { col: 15, row: 18 }, { col: 10, row: 20 }, { col: 16, row: 5 },
        { col: 23, row: 5 }, { col: 4, row: 18 }, { col: 4, row: 22 }, { col: 32, row: 19 }
    ];
    const combate = objectsOwnedByZone(zones, ropes, 'combate');
    const zona = objectsOwnedByZone(zones, ropes, 'zona');
    const keys = new Set([...combate, ...zona].map(o => `${o.col},${o.row}`));
    ok(combate.length + zona.length === ropes.length && keys.size === ropes.length, 'cada estaca em exatamente uma zona, sem duplicar');
    ok(combate.some(o => o.col === 24 && o.row === 22), 'estaca da arena (24,22) é de "combate"');
    ok(zona.some(o => o.col === 16 && o.row === 5), 'estaca de fora (16,5) é de "zona"');
}

// Empate de área: fica com a primeira na ordem.
{
    const tie = [{ id: 'a', col: 0, row: 0, w: 4, h: 4 }, { id: 'b', col: 0, row: 0, w: 4, h: 4 }];
    ok(ownerZone(tie, { col: 1, row: 1 }).id === 'a', 'empate de área fica com a primeira zona');
}

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
