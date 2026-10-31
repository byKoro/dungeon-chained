import assert from 'node:assert/strict';
import { SawTackle } from '../js/systems/SawTackle.js';
import { SawWeapon } from '../js/weapons/SawWeapon.js';
import { DungeonTileQuery } from '../js/rooms/DungeonTileQuery.js';
import { TILE, HOLE_TILE } from '../js/config/GameConfig.js';
import { SAW_TACKLE } from '../js/config/SawTackleConfig.js';

const floor = Array.from({ length: 7 }, () => Array(9).fill(16));
const rooms = {
    currentTiles: { floor, cols: 9, rows: 7, walls: [] },
    cellRect: () => ({ x: 0, y: 0, w: 9 * TILE, h: 7 * TILE })
};
const query = new DungeonTileQuery({ rooms });
const seeds = [{ x: 2.5 * TILE, y: 2.5 * TILE }];
const setup = () => {
    const w = new SawWeapon({ complete: true, naturalWidth: 64 });
    w.drop(3.2 * TILE, 3.7 * TILE);
    w.dropT = 1; w.dropPhase = 1.2; w.rotation = 2.1;
    w._buildBeam = () => null;
    const tackle = new SawTackle({
        chain: { weapon: w, hasSaw: true, isConnected: false }, getPlayers: () => seeds, getRoom: () => ({ enemies: [] }),
        safeDrop: (x, y) => query.safeDropPoint(x, y, seeds),
        findLandingRoute: (x, y, blocked) => query.safeDropRoute(x, y, seeds, blocked),
        canLand: (x, y) => {
            const p=query.reachableDropPoint(x,y,seeds);
            return p.x===x && p.y===y;
        }
    });
    tackle.state = 'flight'; tackle.mode = 'tackle';
    return { w, tackle };
};
const rendered = w => {
    const calls = [];
    const ctx = new Proxy({}, { get: (_, name) => (...args) => {
        if (name === 'translate' || name === 'rotate' || name === 'drawImage') calls.push([name, ...args]);
    } });
    w.drawDropped(ctx);
    return calls;
};
let failures = 0;
function test(name, fn) {
    try { fn(); console.log(`PASS ${name}`); }
    catch (e) { failures++; console.error(`FAIL ${name}: ${e.message}`); }
}
test('pouso em piso seguro conserva coordenadas fora do centro do tile', () => {
    const { w, tackle } = setup();
    const point = { x: w.dropX, y: w.dropY };
    tackle._land(w);
    assert.deepEqual({ x: w.dropX, y: w.dropY }, point);
});
test('pouso conserva escala, fase, frame e rotação do sprite', () => {
    const { w, tackle } = setup();
    const before = rendered(w);
    tackle._land(w);
    assert.equal(w.dropT, 1, 'não reinicia o pop de queda');
    assert.deepEqual(rendered(w), before);
});
test('buracos e piso desconectado continuam usando fallback seguro', () => {
    floor[3][3] = HOLE_TILE;
    const point = query.safeDropPoint(3.2 * TILE, 3.7 * TILE, seeds);
    assert.notEqual(floor[Math.floor(point.y / TILE)][Math.floor(point.x / TILE)], HOLE_TILE);
    assert.ok(Math.abs(point.x / TILE % 1 - 0.5) < 1e-9);
    floor[3][3] = 16;
    for (let row = 1; row < 6; row++) floor[row][4] = HOLE_TILE;
    const otherSide = query.safeDropPoint(6.2 * TILE, 3.7 * TILE, seeds);
    assert.ok(otherSide.x < 4 * TILE, 'cai do lado alcançável pelos jogadores');
    for (let row = 1; row < 6; row++) floor[row][4] = 16;
});
test('ponto inseguro continua até piso seguro sem teleporte', () => {
    floor[3][3] = HOLE_TILE;
    try {
        const { w, tackle } = setup();
        const start = { x: w.dropX, y: w.dropY };
        tackle._land(w);
        assert.deepEqual({ x: w.dropX, y: w.dropY }, start, 'pedido de pouso não reposiciona');
        assert.equal(tackle.state, 'landing');
        let steps = 0;
        while (tackle.active && steps++ < 500) {
            const before = { x: w.dropX, y: w.dropY };
            tackle.update();
            assert.ok(Math.hypot(w.dropX-before.x,w.dropY-before.y) <= SAW_TACKLE.landingSpeed + 1e-8, 'deslocamento por passo limitado');
        }
        assert.equal(tackle.state, null, 'termina em piso seguro');
        assert.deepEqual(query.safeDropPoint(w.dropX,w.dropY,seeds), { x:w.dropX,y:w.dropY });
        assert.ok(steps > 1);
        assert.equal(w.dropT, 1);
    } finally { floor[3][3] = 16; }
});
test('percurso de pouso contorna parede e espera se a passagem fechar', () => {
    const saved = floor.map(row => [...row]);
    try {
        for (let r=1;r<6;r++) for (let c=5;c<8;c++) floor[r][c]=HOLE_TILE;
        rooms.currentTiles.walls = Array.from({length:5},(_,i)=>({col:4,row:i+1}));
        const { w,tackle }=setup();
        w.dropX=6.2*TILE; w.dropY=3.7*TILE;
        tackle.isSolid=(x,y)=>rooms.currentTiles.walls.some(wall=>Math.floor(x/TILE)===wall.col && Math.floor(y/TILE)===wall.row);
        let lands=0;
        tackle.audio={play:()=>lands++};
        const start={x:w.dropX,y:w.dropY};
        tackle._land(w);
        for(let i=0;i<40;i++) tackle.update();
        assert.deepEqual({x:w.dropX,y:w.dropY},start,'sem rota, espera sem teleporte');
        assert.equal(tackle.state,'landing');
        assert.equal(lands,0,'som de pouso só toca na chegada');
        rooms.currentTiles.walls.shift();
        let usedGap=false;
        for(let i=0;i<1000 && tackle.active;i++) {
            const before={x:w.dropX,y:w.dropY};
            tackle.update();
            assert.ok(Math.hypot(w.dropX-before.x,w.dropY-before.y)<=SAW_TACKLE.landingSpeed+1e-8);
            assert.ok(!tackle.isSolid(w.dropX,w.dropY),'não atravessa parede');
            if(w.dropY<2*TILE) usedGap=true;
        }
        assert.ok(usedGap,'contorna o fim da parede pela passagem');
        assert.equal(tackle.state,null);
        assert.equal(lands,1);
        assert.deepEqual(query.safeDropPoint(w.dropX,w.dropY,seeds),{x:w.dropX,y:w.dropY});
    } finally {
        rooms.currentTiles.walls=[];
        for(let r=0;r<floor.length;r++) floor[r]=saved[r];
    }
});
test('pousa em piso alcançável quando destinos afastados dos buracos estão bloqueados', () => {
    const saved=floor.map(row=>[...row]);
    try {
        for(let r=1;r<6;r++) for(let c=4;c<8;c++) floor[r][c]=HOLE_TILE;
        const {w,tackle}=setup();
        w.dropX=5.2*TILE; w.dropY=3.7*TILE;
        tackle.isSolid=x=>x<3*TILE;
        tackle._land(w);
        for(let i=0;i<500 && tackle.active;i++) tackle.update();
        assert.equal(tackle.state,null,'não fica replanejando o mesmo ponto de fallback');
        assert.deepEqual(query.reachableDropPoint(w.dropX,w.dropY,seeds),{x:w.dropX,y:w.dropY});
        assert.notDeepEqual(query.safeDropPoint(w.dropX,w.dropY,seeds),{x:w.dropX,y:w.dropY},'destino final usa fallback próximo a buraco');
    } finally {for(let r=0;r<floor.length;r++) floor[r]=saved[r];}
});
test('novo tackle e reconexão podem interromper a aproximação de pouso', () => {
    floor[3][3]=HOLE_TILE;
    try {
        const {w,tackle}=setup();
        tackle._land(w);
        assert.equal(tackle.state,'landing');
        tackle.chain.isConnected=true;
        tackle.update();
        assert.equal(tackle.state,null);
        assert.deepEqual(tackle.landingRoute,[]);
        const other=setup();
        other.tackle._land(other.w);
        other.tackle._tackle(other.w,{x:other.w.dropX-20,y:other.w.dropY,vx:10,vy:0,dashDirX:1,dashDirY:0},20);
        assert.equal(other.tackle.state,'impact');
        assert.deepEqual(other.tackle.landingRoute,[]);
    } finally {floor[3][3]=16;}
});
process.exitCode = failures ? 1 : 0;
