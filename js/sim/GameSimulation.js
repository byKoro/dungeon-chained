import { Vec2 } from './math/Vec2.js';
import { Rect2D } from './math/Rect2D.js';
import { PhysicsSim } from './math/PhysicsSim.js';
import { PlayerModel } from './models/PlayerModel.js';
import { TetherModel } from './models/TetherModel.js';
import { SawModel } from './models/SawModel.js';
import { EnemyModel } from './models/EnemyModel.js';
import { CombatSim } from './models/CombatSim.js';
import { DungeonSim } from './models/DungeonSim.js';
import { SimulationEvents } from './events/SimulationEvents.js';

/**
 * GameSimulation - Deterministic 60Hz step coordinator for Dungeon Chained.
 * Completely engine-agnostic: zero browser globals, zero DOM, zero Canvas 2D.
 * Directly portable to Unity C# class GameSimulation.
 */
export class GameSimulation {
    constructor(opts = {}) {
        this.dungeonSim = opts.dungeonSim || new DungeonSim(opts.dungeonConfig);

        const spawnP1 = opts.spawnP1 || { x: 384, y: 288 };
        const spawnP2 = opts.spawnP2 || { x: 448, y: 288 };

        this.players = [
            new PlayerModel(0, spawnP1.x, spawnP1.y),
            new PlayerModel(1, spawnP2.x, spawnP2.y)
        ];

        this.saw = new SawModel();
        this.tether = new TetherModel(opts.tetherConfig);
        this.combat = new CombatSim();
        this.events = new SimulationEvents();

        this.enemies = opts.enemies || [];
        this.pickups = opts.pickups || [];
        this.traps = opts.traps || [];

        this.tickCount = 0;
    }

    addEnemy(enemy) {
        if (!(enemy instanceof EnemyModel)) {
            enemy = EnemyModel.create(enemy.type || 'melee', enemy.x, enemy.y, enemy);
        }
        this.enemies.push(enemy);
        return enemy;
    }

    step(inputSnapshot) {
        const input = inputSnapshot || {};
        this.events.clear();

        const p1Input = input.players?.[0] || { moveX: 0, moveY: 0, dash: false };
        const p2Input = input.players?.[1] || { moveX: 0, moveY: 0, dash: false };

        const p1Hole = this.dungeonSim.feetInHole(this.players[0]);
        const p2Hole = this.dungeonSim.feetInHole(this.players[1]);
        const canDash = !this.tether.connected;

        // 1. Update player models with input
        this.players[0].update(p1Input, { canDash, feetInHole: p1Hole }, this.events);
        this.players[1].update(p2Input, { canDash, feetInHole: p2Hole }, this.events);

        // 2. Resolve wall collisions for players
        PhysicsSim.resolveBoxCollisions(this.players[0], this.dungeonSim.wallBounds);
        PhysicsSim.resolveBoxCollisions(this.players[1], this.dungeonSim.wallBounds);

        // 3. Check hole falls
        this.dungeonSim.checkHoleFalls(this.players, this.events);

        // 4. Update tether and saw dynamics
        this.tether.update(this.players[0], this.players[1], this.saw, this.events, this.dungeonSim);

        // 5. Update enemy AI and physics
        for (let i = 0; i < this.enemies.length; i++) {
            const enemy = this.enemies[i];
            enemy.update(this.players, this.dungeonSim, this.events);
            PhysicsSim.resolveBoxCollisions(enemy, this.dungeonSim.wallBounds);
        }

        // 6. Entity-to-entity collisions
        const activeEntities = [
            this.players[0],
            this.players[1],
            ...this.enemies.filter(e => !e.isDead)
        ];
        PhysicsSim.resolveEntityCollisions(activeEntities);

        // 7. Combat hit detection
        this.combat.resolveWeaponHits(this.saw, this.tether, this.enemies, this.players[0], this.players[1], this.events);
        this.combat.resolveLooseSawHits(this.saw, this.enemies, this.events);

        this.tickCount++;
        return this.events;
    }

    getRenderSnapshot() {
        return {
            tick: this.tickCount,
            room: this.dungeonSim.getRenderState(),
            players: this.players.map(p => p.getRenderState()),
            chain: this.tether.getRenderState(this.players[0], this.players[1], this.saw),
            saw: this.saw.getRenderState(this.players[0], this.players[1]),
            enemies: this.enemies.map(e => e.getRenderState()),
            pickups: this.pickups.map(p => ({ ...p })),
            traps: this.traps.map(t => ({ ...t }))
        };
    }
}
