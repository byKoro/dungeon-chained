import { Player } from '../js/entities/Player.js';
import { Chain } from '../js/core/Chain.js';
import { DashTether, dashUnlocked } from '../js/systems/DashTether.js';
import { CHAIN } from '../js/config/ChainConfig.js';
import { TILE, PLAYER_DASH } from '../js/config/GameConfig.js';

let passed = 0;
let failed = 0;
function assert(condition, message) {
    if (condition) { console.log(`✅ PASSOU: ${message}`); passed++; }
    else { console.error(`❌ FALHOU: ${message}`); failed++; }
}

console.log("=== TESTE DO DASH COM A CORRENTE CONECTADA ===");

const CONTROLS = ['up', 'down', 'left', 'right', 'dash'];
const makeInput = () => {
    const held = new Set();
    return { held, isDown: (k) => held.has(k) };
};
const weaponStub = () => ({
    update() {}, setStrain() {}, setStretch() {}, drop() {}, pickup() {}, getSawPositions: () => null
});

// Mesma ordem do Game._step: players → DashTether → Chain.
function setup(p1x, p1y, p2x, p2y) {
    const chain = new Chain([weaponStub()], CHAIN);
    const tether = new DashTether({ chain });
    const p1 = new Player(p1x, p1y, '#f00', CONTROLS, null, 'P1');
    const p2 = new Player(p2x, p2y, '#00f', CONTROLS.map(k => k + '2'), null, 'P2');
    const in1 = makeInput(), in2 = makeInput();
    let snapped = false;
    const tick = () => {
        p1.update(in1, null, { canDash: true });
        p2.update(in2, null, { canDash: true });
        tether.apply(p1, p2);
        chain.update(p1, p2, { holdStrain: tether.holdsStrain(p1, p2), onSnap: () => { snapped = true; } });
    };
    return { chain, p1, p2, in1, in2, tick, snapped: () => snapped };
}
const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

// 1) Distância nova: 2,25 tiles.
assert(PLAYER_DASH.speed * PLAYER_DASH.durationSteps === 2.25 * TILE,
    `Dash percorre 2,25 tiles (${PLAYER_DASH.speed * PLAYER_DASH.durationSteps}px)`);
assert(PLAYER_DASH.connectedMaxDistance < CHAIN.breakDistance, "Freio do cabo fica abaixo da ruptura");

// 2) Dash para longe do parceiro: o cabo freia e não arrebenta durante o dash.
{
    const s = setup(0, 0, CHAIN.rest, 0);
    s.in1.held.add('left'); s.in1.held.add('dash');
    s.tick();
    s.in1.held.delete('dash');
    let maxDist = 0, endedVx = null;
    for (let i = 0; i < PLAYER_DASH.durationSteps + 2; i++) {
        if (s.p1.dashing) maxDist = Math.max(maxDist, dist(s.p1, s.p2));
        if (s.p1.justEndedDash) endedVx = s.p1.vx;
        s.tick();
    }
    assert(s.chain.isConnected && !s.snapped(), "Dash para longe com a corrente conectada não arrebenta o cabo");
    assert(maxDist <= PLAYER_DASH.connectedMaxDistance + 1e-6, `Distância no dash limitada a ${PLAYER_DASH.connectedMaxDistance}px (max=${maxDist.toFixed(1)})`);
    assert(endedVx !== null && endedVx >= -1e-6, `Saída do dash sem velocidade para fora (vx=${endedVx?.toFixed(2)})`);
}

// 3) Dash para o lado: distância cheia, sem freio.
{
    const s = setup(0, 0, CHAIN.rest, 0);
    s.in1.held.add('up'); s.in1.held.add('dash');
    s.tick();
    s.in1.held.clear();
    while (s.p1.dashing) s.tick();
    const traveled = -s.p1.y;
    const full = PLAYER_DASH.speed * PLAYER_DASH.durationSteps;
    assert(traveled >= full - PLAYER_DASH.speed, `Dash lateral anda a distância cheia (~${full}px, andou ${traveled.toFixed(1)})`);
    assert(s.chain.isConnected, "Dash lateral mantém a corrente");
}

// 4) Tensão congelada durante o dash.
{
    const s = setup(0, 0, 200, 0);
    s.chain.strain = 20;
    s.in1.held.add('up'); s.in1.held.add('dash');
    s.tick();
    s.in1.held.clear();
    let frozen = true;
    while (s.p1.dashing) { if (s.chain.strain !== 20) frozen = false; s.tick(); }
    assert(frozen, `Tensão não sobe nem zera durante o dash (strain=${s.chain.strain})`);
}

// 5) Os dois em dash para lados opostos: o cabo divide o freio e não arrebenta.
{
    const s = setup(0, 0, CHAIN.rest, 0);
    s.in1.held.add('left'); s.in1.held.add('dash');
    s.in2.held.add('right2'); s.in2.held.add('dash2');
    s.tick();
    s.in1.held.delete('dash'); s.in2.held.delete('dash2');
    let maxDist = 0;
    while (s.p1.dashing || s.p2.dashing) { maxDist = Math.max(maxDist, dist(s.p1, s.p2)); s.tick(); }
    assert(s.chain.isConnected && maxDist <= PLAYER_DASH.connectedMaxDistance + 1e-6,
        `Dash duplo oposto não arrebenta (max=${maxDist.toFixed(1)})`);
}

// 6) Sem corrente conectada, o freio não age.
{
    const s = setup(0, 0, CHAIN.rest, 0);
    s.chain.connected = false;
    s.chain.reconnectCooldown = 999;
    s.in1.held.add('left'); s.in1.held.add('dash');
    s.tick();
    s.in1.held.clear();
    while (s.p1.dashing) s.tick();
    assert(dist(s.p1, s.p2) > PLAYER_DASH.connectedMaxDistance, "Corrente arrebentada: dash livre, sem freio");
}

// 7) Desbloqueio: clássico sempre; demo só com o altar.
assert(dashUnlocked(false, null) === true, "Modo clássico: dash liberado");
assert(dashUnlocked(true, { dash: false }) === false, "Demo sem o altar: sem dash");
assert(dashUnlocked(true, { dash: true }) === true, "Demo com o altar: dash liberado");

console.log(`\nRESULTADO: ${passed}/${passed + failed} testes passaram.`);
if (failed > 0) process.exit(1);
