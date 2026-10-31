import { DungeonTileQuery } from '../js/rooms/DungeonTileQuery.js';
import { Player } from '../js/entities/Player.js';
import { TILE, HOLE_TILE, PLAYER_DASH, HOLE_FALL } from '../js/config/GameConfig.js';

let passed = 0;
let failed = 0;
function assert(condition, message) {
    if (condition) { console.log(`✅ PASSOU: ${message}`); passed++; }
    else { console.error(`❌ FALHOU: ${message}`); failed++; }
}

console.log("=== TESTE DO DASH INDIVIDUAL ===");

const CONTROLS = ['up', 'down', 'left', 'right', 'dash'];
const makeInput = () => {
    const held = new Set();
    return { held, isDown: (k) => held.has(k) };
};
const makePlayer = (x = 0, y = 0) => new Player(x, y, '#f00', CONTROLS, null, 'P');

const step = (p, input, canDash = true) => p.update(input, null, { canDash });
const press = (p, input, canDash = true) => {
    input.held.add('dash');
    step(p, input, canDash);
    input.held.delete('dash');
};

// 1) Bloqueado com canDash=false (ex.: sem o altar na demo); a tecla segurada não dispara depois.
{
    const p = makePlayer();
    const input = makeInput();
    input.held.add('dash');
    step(p, input, false);
    assert(!p.dashing, "canDash=false: dash não acontece");
    step(p, input, true);
    assert(!p.dashing, "Segurar a tecla não dispara quando o dash é liberado (só borda)");
    input.held.delete('dash');
    step(p, input);
    press(p, input);
    assert(p.dashing && p.justDashed, "Nova pressão com o dash liberado: dash começa");
}

// 2) Distância, duração e velocidade de saída.
{
    const p = makePlayer();
    const input = makeInput();
    input.held.add('right');
    press(p, input);
    let steps = 1;
    while (p.dashing && steps < 100) { step(p, input); steps++; }
    assert(steps === PLAYER_DASH.durationSteps + 1, `Dura ${PLAYER_DASH.durationSteps} steps (+1 de saída): ${steps}`);
    assert(p.justEndedDash, "Flag justEndedDash no step em que termina");
    const expected = PLAYER_DASH.durationSteps * PLAYER_DASH.speed;
    assert(p.x >= expected && p.x < expected + PLAYER_DASH.speed, `Percorre ~${expected}px (x=${p.x.toFixed(1)})`);
    assert(Math.abs(p.vx - PLAYER_DASH.exitSpeed) < 1e-9 && p.vy === 0, "Sai com a velocidade de corrida na mesma direção");
}

// 3) Direção: diagonal do input; sem input, última direção de movimento; sem controle durante o dash.
{
    const p = makePlayer();
    const input = makeInput();
    input.held.add('down'); input.held.add('left');
    press(p, input);
    assert(p.dashDirX < 0 && p.dashDirY > 0 && Math.abs(Math.hypot(p.dashDirX, p.dashDirY) - 1) < 1e-9,
        "Dash diagonal normalizado na direção do input");
    input.held.clear();
    input.held.add('right');
    step(p, input);
    assert(p.vx < 0, "Durante o dash o input não muda a direção");

    const q = makePlayer();
    const qi = makeInput();
    qi.held.add('up');
    for (let i = 0; i < 5; i++) step(q, qi);
    qi.held.clear();
    for (let i = 0; i < 30; i++) step(q, qi);
    press(q, qi);
    assert(q.dashDirX === 0 && q.dashDirY === -1, "Sem input: usa a última direção de movimento");
}

// 4) Cooldown de 1 carga, contado a partir do fim do dash.
{
    const p = makePlayer();
    const input = makeInput();
    press(p, input);
    while (p.dashing) step(p, input);
    assert(p.dashCharge === 0, "Logo após o dash a carga está vazia");
    press(p, input);
    assert(!p.dashing, "Durante o cooldown nada acontece");
    for (let i = 0; i < PLAYER_DASH.cooldownSteps; i++) step(p, input);
    assert(p.dashCharge === 1, `Recarrega após ${PLAYER_DASH.cooldownSteps} steps`);
    press(p, input);
    assert(p.dashing, "Com a carga cheia, dash de novo");
}

// 5) Invulnerável durante o dash, sem mexer no invulnerableTimer.
{
    const p = makePlayer();
    const input = makeInput();
    press(p, input);
    assert(p.takeDamage(10, 0) === false && p.lives === 3, "Durante o dash não toma dano");
    assert(p.invulnerableTimer === 0, "Dash não liga o piscar de invulnerabilidade");
    while (p.dashing) step(p, input);
    assert(p.takeDamage(10, 0) === true, "Depois do dash volta a tomar dano");
}

// 5b) Pausa: a tecla que fechou o menu (Enter/A) segue segurada e não dispara dash.
{
    const p = makePlayer();
    const input = makeInput();
    input.held.add('dash');
    p.latchDashKey();
    step(p, input);
    assert(!p.dashing, "Após latchDashKey, tecla já segurada não dispara");
    input.held.delete('dash');
    step(p, input);
    press(p, input);
    assert(p.dashing, "Soltou e apertou de novo: dispara");
}

// 6) Bloqueado durante o knockback e a queda.
{
    const p = makePlayer();
    const input = makeInput();
    p.takeDamage(10, 0);
    press(p, input);
    assert(!p.dashing, "Durante o knockback (hurtTimer) não dá dash");

    const q = makePlayer();
    q.startFalling(0, 0);
    press(q, makeInput());
    assert(!q.dashing, "Caindo não dá dash");
}

// 7) Resets: respawn zera o cooldown; cancelDash corta o dash e mantém o cooldown.
{
    const p = makePlayer();
    const input = makeInput();
    press(p, input);
    while (p.dashing) step(p, input);
    p.respawnAt(0, 0);
    assert(p.dashCharge === 1, "Morrer e voltar (respawnAt) recarrega o dash");

    const q = makePlayer();
    const qi = makeInput();
    press(q, qi);
    q.cancelDash();
    assert(!q.dashing && q.dashCharge === 0, "Troca de sala corta o dash e o cooldown continua");
}

// 8) Buracos: cruza vão de 1 tile; dash que termina dentro de um buraco largo cai na hora.
{
    const H = HOLE_TILE, F = 16, W = 2;
    const floor = [
        [W, W, W, W, W, W, W, W, W, W],
        [W, F, F, H, F, F, H, H, H, W],
        [W, F, F, H, F, F, H, H, H, W],
        [W, F, F, H, F, F, H, H, H, W],
        [W, W, W, W, W, W, W, W, W, W],
    ];
    const rooms = {
        currentTiles: { floor, cols: 10, rows: 5, walls: [] },
        cellRect: () => ({ x: 0, y: 0, w: 10 * TILE, h: 5 * TILE })
    };
    const query = new DungeonTileQuery({ rooms });
    const ROW_Y = 2 * TILE + TILE / 2 - HOLE_FALL.footOffset;
    const tick = (p, input) => { step(p, input); query.checkHoleFalls([p]); };

    const p = makePlayer(3 * TILE - 30, ROW_Y);
    const input = makeInput();
    input.held.add('right');
    input.held.add('dash');
    tick(p, input);
    input.held.clear();
    for (let i = 0; i < 40 && !p.falling; i++) tick(p, input);
    assert(!p.falling, "Dash a 30px da beirada cruza o vão de 1 tile");
    assert(p.x > 4 * TILE, `Chega do outro lado (x=${p.x.toFixed(1)} > ${4 * TILE})`);

    const q = makePlayer(6 * TILE - 20, ROW_Y);
    const qi = makeInput();
    qi.held.add('dash');
    qi.held.add('right');
    let fellAt = -1;
    for (let i = 1; i <= 40 && fellAt < 0; i++) {
        tick(q, qi);
        qi.held.delete('dash');
        if (q.falling) fellAt = i;
    }
    assert(fellAt === PLAYER_DASH.durationSteps + 1,
        `Dash que termina no meio de um buraco largo cai no step final (${fellAt})`);

    const floor2 = [
        [W, W, W, W, W, W, W, W],
        [W, F, F, H, H, F, F, W],
        [W, F, F, H, H, F, F, W],
        [W, F, F, H, H, F, F, W],
        [W, W, W, W, W, W, W, W],
    ];
    const query2 = new DungeonTileQuery({ rooms: {
        currentTiles: { floor: floor2, cols: 8, rows: 5, walls: [] },
        cellRect: () => ({ x: 0, y: 0, w: 8 * TILE, h: 5 * TILE })
    } });
    const dashAcross = (startX) => {
        const s = makePlayer(startX, ROW_Y);
        const si = makeInput();
        si.held.add('right'); si.held.add('dash');
        for (let i = 0; i < 40 && !s.falling; i++) {
            step(s, si); query2.checkHoleFalls([s]);
            si.held.clear();
        }
        return s;
    };
    const edge = dashAcross(3 * TILE);
    assert(!edge.falling && edge.x > 5 * TILE, `Vão de 2 tiles: saindo colado na beirada cruza (x=${edge.x.toFixed(1)})`);
    assert(dashAcross(3 * TILE - 40).falling, "Vão de 2 tiles: saindo 40px antes da beirada cai");

    const u = makePlayer(3 * TILE + HOLE_FALL.edgeMargin, ROW_Y);
    const ui = makeInput();
    ui.held.add('right'); ui.held.add('dash');
    u.update(ui, null, { canDash: true, feetInHole: query2.feetInHole(u) });
    assert(query2.feetInHole(u) && !u.dashing, "Com os pés dentro da beirada não começa dash (evita cruzar 2 tiles)");

    const r = makePlayer(3 * TILE + 20, ROW_Y);
    for (let i = 0; i < 3; i++) {
        r.dashing = true; r.dashTimer = 5;
        query.checkHoleFalls([r]);
    }
    assert(!r.falling && r.x === 3 * TILE + 20, "Em dash, o buraco não empurra nem derruba");
}

console.log(`\nRESULTADO: ${passed}/${passed + failed} testes passaram.`);
if (failed > 0) process.exit(1);
