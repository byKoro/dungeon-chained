import assert from 'node:assert/strict';
import { CinematicBars } from '../js/ui/CinematicBars.js';
import { TrailerPlayer } from '../js/trailer/TrailerPlayer.js';
const bars = new CinematicBars();
assert.ok(bars.hidden);
bars.show();
bars.update(0.2);
assert.ok(bars.amount > 0.5 && bars.amount < 1);
bars.update(0.2);
assert.equal(bars.amount, 1);
assert.equal(bars.inset(900), 90);
bars.hide();
bars.update(0.09);
assert.ok(bars.amount > 0 && bars.amount < 0.5);
bars.hide();
bars.update(0.09);
assert.ok(bars.hidden);
bars.show(); bars.update(0.1); bars.hide(); bars.update(0.18);
assert.ok(bars.hidden);
const calls = [];
const ctx = { save() {}, restore() {}, setTransform(...v) { calls.push(v); }, fillRect(...v) { calls.push(v); } };
bars.show(); bars.update(0.4); bars.draw(ctx, 1600, 900);
assert.deepEqual(calls, [[1,0,0,1,0,0], [0,0,1600,90], [0,810,1600,90]]);
console.log('Cinematic bars: timing, interruption, screen coordinates and resize passed.');

const player = Object.create(TrailerPlayer.prototype);
Object.assign(player, {
    stage: { bars: new CinematicBars(), _tickExpressions() {}, tickSpeech() {}, bloodScreen: {} },
    scenes: [{ update() {}, render() {} }], index: 0, time: 0, sceneTime: 0,
    impactT: -1, running: true, _last: 0, _paused: false,
    _pollPad() {}, render() {}
});
globalThis.requestAnimationFrame = () => 1;
player.stage.bars.show();
player._tick(50);
assert.ok(player.stage.bars.amount > 0);
player._paused = true;
const frozen = player.stage.bars.amount;
player._tick(100);
assert.equal(player.stage.bars.amount, frozen);
player._paused = false;
let released = false;
const finish = player.finish().then(() => { released = true; });
assert.equal(player.finish(), player._finishing);
player.update(0.09);
await Promise.resolve();
assert.equal(released, false);
player._paused = true;
const exiting = player.stage.bars.amount;
player._tick(150);
assert.equal(player.stage.bars.amount, exiting);
assert.equal(released, false);
player._paused = false;
player.update(0.09);
await finish;
assert.ok(player.stage.bars.hidden);
assert.ok(released);
console.log('Trailer integration: entry, paused tick and awaited exit passed.');
