/**
 * SimulationEvents - Lightweight, pure event buffer.
 * Queues domain event structs during simulation steps for platform audio and juice adapters.
 * Zero DOM or engine dependencies. Directly portable to C# struct event queues.
 */
export class SimulationEvents {
    constructor() {
        this.queue = [];
    }

    clear() {
        this.queue.length = 0;
    }

    emit(type, payload = {}) {
        this.queue.push({ type, ...payload });
    }

    emitSawSnapped(x, y) {
        this.emit('SawSnapped', { x, y });
    }

    emitSawReconnected() {
        this.emit('SawReconnected', {});
    }

    emitSawHit(x, y, hitCount = 1, heavy = false) {
        this.emit('SawHit', { x, y, hitCount, heavy });
    }

    emitEntityDamaged(entityId, x, y, damage, isPlayer = false, remainingLives = 0) {
        this.emit('EntityDamaged', { entityId, x, y, damage, isPlayer, remainingLives });
    }

    emitEntityDied(entityId, x, y, enemyType = 'enemy') {
        this.emit('EntityDied', { entityId, x, y, enemyType });
    }

    emitPlayerFootstep(playerIndex, x, y, inBlood = false) {
        this.emit('PlayerFootstep', { playerIndex, x, y, inBlood });
    }

    emitPlayerFell(playerIndex, x, y) {
        this.emit('PlayerFell', { playerIndex, x, y });
    }

    emitPlayerDashed(playerIndex, dirX, dirY) {
        this.emit('PlayerDashed', { playerIndex, dirX, dirY });
    }

    emitCameraShake(intensity = 10) {
        this.emit('CameraShake', { intensity });
    }

    all() {
        return this.queue;
    }

    filter(type) {
        return this.queue.filter(e => e.type === type);
    }

    [Symbol.iterator]() {
        return this.queue[Symbol.iterator]();
    }

    get length() {
        return this.queue.length;
    }
}
