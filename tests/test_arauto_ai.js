import assert from 'node:assert/strict';
import { SpawnSystem } from '../js/systems/SpawnSystem.js';
import { FLAME_GOLEM } from '../js/config/FlameGolemConfig.js';
import { TILE } from '../js/config/GameConfig.js';

// Critérios do spec .agents/tasks/2026-10-31-arauto-reactive-ai/ (numeração entre colchetes).
const spawn = new SpawnSystem({ assets: { get: () => ({ complete: true, naturalWidth: 1200 }) }, bloodCanvas: { palette: [] } });
const create = (x = 0, y = 0) => spawn.createEnemy(x, y, 1, 'flameGolem');
const dummy = (x, y = 0) => ({ x, y, lives: 3, hitRadius: 16, falling: false, hits: 0, takeDamage() { this.hits++; return true; } });
const toPhase2 = e => { e.hp = FLAME_GOLEM.secondPhaseHp; e._updatePhase(); };
const tick = (e, ps, n, each) => {
    for (let i = 0; i < n; i++) {
        e.update(ps, () => {});
        e.ensureOnWalkableTile();
        if (each?.(i) === false) return i;
    }
    return n;
};
const withMode = (mode, fn) => {
    const was = FLAME_GOLEM.ai.chainMode;
    FLAME_GOLEM.ai.chainMode = mode;
    try { fn(); } finally { FLAME_GOLEM.ai.chainMode = was; }
};

// Sala 14×9 (borda nas linhas/colunas 0 e última). Interior: x 0..768, y 0..448. col/row são índices do grid.
const room = (e, { walls = [], holes = [] } = {}) => {
    const floor = Array.from({ length: 9 }, () => Array(14).fill(17));
    for (const [col, row] of holes) floor[row][col] = -1;
    e.setNavigationFloor(floor, { minX: 0, minY: 0, maxX: 12 * TILE, maxY: 7 * TILE }, walls.map(([col, row]) => ({ col, row })));
    return e;
};
const Y = 160; // centro na linha 3; pés (y + 70) na linha 4
const MELEE = FLAME_GOLEM.attacks.attack.triggerRange;
const originalRandom = Math.random;
Math.random = () => 0;

// [1] Jogador perto → melee, mesmo com outro longe; nunca investe contra o distante enquanto alguém está perto.
{
    const e = create(), ps = [dummy(60), dummy(300)];
    e.update(ps, () => {});
    assert.equal(e.currentAttack, 'attack');
    assert.equal(e.plan.target, ps[0], 'mira o jogador perto');
    const started = [];
    tick(e, ps, 400, () => { if (e.justAttacked) started.push(e.currentAttack); });
    assert.ok(!started.includes('attack3'), `sem investida com alguém perto (${started})`);
}

// [6] Longe e acessível → investida. Parede no caminho: fase 1 contorna andando; fase 2 salta.
{
    const e = room(create(96, Y)), ps = [dummy(480, Y), dummy(480, Y)];
    e.update(ps, () => {});
    assert.equal(e.currentAttack, 'attack3', 'investida contra alvo distante acessível');
}
const wallColumn = [1, 2, 3, 4].map(row => [5, row]); // x 256..320, y 0..256; passagem por baixo (linhas 5..7)
{
    const e = room(create(96, Y), { walls: wallColumn }), ps = [dummy(480, Y), dummy(480, Y)];
    let jumped = false, maxY = e.y, passed = false;
    tick(e, ps, 1200, () => {
        if (e.slamMode) jumped = true;
        maxY = Math.max(maxY, e.y);
        if (e.x > 320) { passed = true; return false; }
    });
    assert.ok(!jumped, 'fase 1 nunca salta');
    assert.ok(maxY > 256, 'desce para contornar a parede');
    assert.ok(passed, 'passa para o outro lado da parede andando');
}
{
    const e = room(create(96, Y), { walls: wallColumn }), ps = [dummy(480, Y), dummy(480, Y)];
    toPhase2(e);
    e.update(ps, () => {});
    assert.equal(e.currentAttack, 'attack2');
    assert.ok(e.slamMode && e.slam?.mark, 'fase 2: salta por cima da parede');
    assert.ok(e._chargeFits(e.slam.mark.x, e.slam.mark.y), '[8] aterrissagem segura');
}

// [7][8] A investida cruza buraco quando termina em piso seguro; com término no buraco não começa.
{
    const holes = Array.from({ length: 7 }, (_, i) => [4, i + 1]); // x 192..256
    const e = room(create(96, Y), { holes }), ps = [dummy(300, Y), dummy(300, Y)];
    e.update(ps, () => {});
    assert.equal(e.currentAttack, 'attack3', 'buraco no caminho não invalida a investida');
    tick(e, ps, 200, () => e.state !== 'recover');
    assert.ok(e.x - e.hitRadius > 256 && e._chargeFits(e.x, e.y), `atravessa e para em piso seguro (x=${e.x})`);
}
{
    const holes = [];
    for (let col = 4; col <= 7; col++) for (let row = 1; row <= 7; row++) holes.push([col, row]); // x 192..448
    const e = room(create(96, Y), { holes }), ps = [dummy(560, Y), dummy(560, Y)];
    e.update(ps, () => {});
    assert.notEqual(e.state, 'windup', 'investida terminaria no buraco: fase 1 não ataca');
    const j = room(create(96, Y), { holes });
    toPhase2(j);
    j.update(ps, () => {});
    assert.ok(j.slamMode && j._chargeFits(j.slam.mark.x, j.slam.mark.y), 'fase 2 salta para piso seguro');
    // dentro da sala: nem a investida nem o salto saem do mapa
    const edge = room(create(96, Y)), far = [dummy(700, Y), dummy(700, Y)];
    edge.update(far, () => {});
    tick(edge, far, 200, () => edge.state !== 'recover');
    assert.ok(edge.x + edge.hitRadius <= 13 * TILE, 'investida para antes da parede da borda');
}

// [9] Parede ao lado não bloqueia o melee; parede entre golpe e jogador protege.
{
    const side = room(create(96, Y), { walls: [[2, 2]] }), ps = [dummy(166, Y), dummy(166, Y)]; // parede acima da linha
    side.update(ps, () => {});
    assert.equal(side.currentAttack, 'attack', 'parede ao lado não impede o melee');
    tick(side, ps, 200, () => !side.dealtHit);
    assert.ok(ps[0].hits + ps[1].hits >= 1, 'o golpe acerta');

    const blocked = room(create(96, Y), { walls: [[3, 3]] }); // x 128..192 na linha do jogador
    const behind = [dummy(200, Y), dummy(200, Y)];
    blocked.update(behind, () => {});
    assert.notEqual(blocked.currentAttack === 'attack' && blocked.state === 'windup', true, 'atrás da parede não conta como perto');
    const forced = room(create(96, Y), { walls: [[3, 3]] });
    forced.forceAttack('attack');
    forced.update(behind, () => {});
    tick(forced, behind, 200, () => !forced.dealtHit);
    assert.equal(behind[0].hits + behind[1].hits, 0, 'parede entre o golpe e o jogador protege');

    const slam = room(create(96, Y), { walls: [[3, 3]] });
    const mix = [dummy(96, Y + 60), dummy(200, Y)];
    slam.forceAttack('attack2');
    slam.update(mix, () => {});
    tick(slam, mix, 200, () => !slam.dealtHit);
    assert.equal(mix[0].hits, 1, 'pancada acerta quem está livre');
    assert.equal(mix[1].hits, 0, 'e poupa quem está atrás da parede');
}

// [10] Dupla parada junto a um bloco pequeno: o golem chega e ataca (antes ficava parado).
{
    const e = room(create(96, Y), { walls: [[6, 4]] }); // bloco x 320..384, y 192..256
    const ps = [dummy(420, Y + 64), dummy(430, Y + 70)];
    let attacked = false;
    tick(e, ps, 1500, () => { if (e.state === 'windup' && e.currentAttack !== 'attack3') { attacked = true; return false; } });
    assert.ok(attacked, `chega perto e ataca (x=${e.x.toFixed(0)}, y=${e.y.toFixed(0)})`);
}
// [10] Um alvo bloqueado e outro acessível: investe contra o acessível, mesmo mais longe.
{
    const e = room(create(96, Y), { walls: [[4, 3]] });
    const ps = [dummy(300, Y), dummy(96, 400)];
    e.update(ps, () => {});
    assert.equal(e.currentAttack, 'attack3');
    assert.equal(e.plan.target, ps[1], 'escolhe o jogador com trajeto válido');
}

// [11] Salto: destino fixo desde o aviso.
{
    const e = create(), ps = [dummy(200), dummy(300)];
    toPhase2(e);
    e.forceAttack('attack2');
    e.update(ps, () => {});
    ps[0].x = 260;
    e.update(ps, () => {});
    assert.equal(e.slam.mark.x, 200, 'no aviso o destino fica fixo');
    tick(e, ps, 200, () => !e.airborne);
    const fixed = e.slam.mark.x;
    ps[0].x = 100;
    e.update(ps, () => {});
    assert.equal(e.slam.mark.x, fixed, 'no ar o destino não muda');
}

// [12] Modo individual: 1 salto e reavalia; modo sequência: slam.count saltos.
for (const [mode, count] of [['single', 1], ['sequence', FLAME_GOLEM.slam.count]]) {
    withMode(mode, () => {
        const e = create(), ps = [dummy(30), dummy(-30)];
        toPhase2(e);
        e.forceAttack('attack2');
        let impacts = 0;
        e.update(ps, () => {});
        tick(e, ps, 900, () => { if (e.justSlammed) impacts++; return e.state !== 'recover'; });
        assert.equal(impacts, count, `${mode}: ${count} salto(s)`);
    });
}

// [13] Fora de 480 px: aproxima-se em vez de investir/saltar.
{
    for (const phase of [1, 2]) {
        const e = room(create(96, Y)), ps = [dummy(96 + 600, Y), dummy(96 + 600, Y)];
        if (phase === 2) toPhase2(e);
        const x0 = e.x;
        tick(e, ps, 60, () => assert.equal(e.state, 'chase'));
        assert.ok(e.x > x0, `fase ${phase}: anda até o alcance`);
    }
}

Math.random = originalRandom;
console.log('Arauto AI: melee priority, dash/jump validity, walls, holes, modes and range passed.');
