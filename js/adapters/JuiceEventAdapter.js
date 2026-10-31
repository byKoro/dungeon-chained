/**
 * JuiceEventAdapter - Platform Presentation Juice Adapter.
 * Consumes pure SimulationEvents emitted by GameSimulation and translates them into
 * camera shake, zoom punches, screen gore flashes, and particle bursts.
 */

export class JuiceEventAdapter {
    constructor(opts = {}) {
        this.renderer = opts.renderer || null;
        this.particleSystem = opts.particleSystem || null;
        this.screenGore = opts.screenGore || null;
    }

    setRenderer(renderer) {
        this.renderer = renderer;
    }

    setParticleSystem(particleSystem) {
        this.particleSystem = particleSystem;
    }

    setScreenGore(screenGore) {
        this.screenGore = screenGore;
    }

    /**
     * Process an iterable or array of simulation events.
     * @param {Iterable<Object>|Array<Object>} events
     * @returns {number} Count of dispatched events
     */
    process(events) {
        if (!events) return 0;

        let count = 0;
        const iterable = (typeof events.all === 'function') ? events.all() : events;

        for (const event of iterable) {
            this.handleEvent(event);
            count++;
        }

        return count;
    }

    /**
     * Dispatches an individual simulation event to juice/presentation systems.
     * @param {Object} event Typed simulation event
     */
    handleEvent(event) {
        if (!event || !event.type) return;

        const x = event.x ?? 0;
        const y = event.y ?? 0;

        switch (event.type) {
            case 'SawSnapped':
                this.renderer?.triggerShake?.(14);
                this.particleSystem?.triggerSparkBurst?.(x, y, 24, 12, 1.2);
                this.particleSystem?.triggerFlash?.(x, y, 12, 1);
                break;

            case 'SawReconnected':
                this.renderer?.triggerShake?.(4);
                break;

            case 'SawHit': {
                const shake = event.heavy ? 8 : 4;
                this.renderer?.triggerShake?.(shake);
                this.particleSystem?.triggerSparkBurst?.(x, y, 16, 6, 1);
                break;
            }

            case 'EntityDamaged':
                if (event.isPlayer) {
                    this.renderer?.triggerShake?.(10);
                    this.screenGore?.triggerFlash?.();
                } else {
                    this.renderer?.triggerShake?.(3);
                    this.particleSystem?.triggerBloodDroplets?.(x, y, 4, 0.8);
                }
                break;

            case 'EntityDied':
                this.renderer?.triggerShake?.(6);
                this.renderer?.triggerZoomPunch?.(0.02);
                this.screenGore?.triggerFlash?.();
                this.particleSystem?.triggerFlameBurst?.(x, y, [255, 100, 50], { amount: 20 });
                break;

            case 'PlayerFell':
                this.screenGore?.triggerFlash?.();
                this.particleSystem?.triggerFlash?.(x, y, 10, 0.8);
                break;

            case 'PlayerDashed': {
                this.renderer?.triggerShake?.(1.5);
                const dirX = event.dirX ?? 0;
                const dirY = event.dirY ?? 0;
                this.particleSystem?.triggerDust?.(x, y, dirX, dirY, 4);
                this.particleSystem?.triggerFlash?.(x, y, 4, 0.7);
                break;
            }

            case 'CameraShake':
                this.renderer?.triggerShake?.(event.intensity ?? 10);
                break;

            default:
                break;
        }
    }
}
