import { GameSimulation } from '../../../js/sim/GameSimulation.js';
import { SimulationEvents } from '../../../js/sim/events/SimulationEvents.js';
import assert from 'node:assert/strict';

const sim = new GameSimulation({
    spawnP1: { x: 100, y: 100 },
    spawnP2: { x: 200, y: 100 }
});

console.log('Running 1000 headless simulation ticks with fuzz inputs...');
for (let i = 0; i < 1000; i++) {
    const input = {
        players: [
            { moveX: Math.sin(i * 0.1), moveY: Math.cos(i * 0.1), dash: i % 50 === 0, interact: false },
            { moveX: -Math.cos(i * 0.1), moveY: Math.sin(i * 0.1), dash: i % 60 === 0, interact: false }
        ],
        menu: {},
        dt: 1 / 60
    };
    const events = sim.step(input);
    assert.ok(events instanceof SimulationEvents, 'Events must be an instance of SimulationEvents');
    assert.ok(Array.isArray(events.all()), 'events.all() must return an array');
    const snapshot = sim.getRenderSnapshot();
    assert.ok(snapshot.players.length === 2, 'Snapshot must contain 2 players');
    assert.ok(!Number.isNaN(snapshot.players[0].x), 'Player 1 x must not be NaN');
    assert.ok(!Number.isNaN(snapshot.players[1].x), 'Player 2 x must not be NaN');
}

console.log('1000 headless simulation ticks completed successfully with zero NaNs or errors.');
