/**
 * AudioEventAdapter - Platform Audio Adapter.
 * Consumes pure SimulationEvents emitted by GameSimulation and translates them into
 * platform Web Audio cues via AudioManager and SawMotorAudio.
 */

export class AudioEventAdapter {
    constructor(opts = {}) {
        this.audio = opts.audio || null;
        this.sawMotor = opts.sawMotor || null;
    }

    setAudio(audio) {
        this.audio = audio;
    }

    setSawMotor(sawMotor) {
        this.sawMotor = sawMotor;
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
     * Dispatches an individual simulation event to the audio subsystem.
     * @param {Object} event Typed simulation event
     */
    handleEvent(event) {
        if (!event || !event.type) return;

        switch (event.type) {
            case 'SawSnapped':
                this.audio?.play?.('sawSnap');
                this.audio?.duck?.(-9, { attackMs: 10, holdMs: 250, releaseMs: 1100 });
                this.sawMotor?.onSnap?.();
                break;

            case 'SawReconnected':
                this.audio?.play?.('sawPickup');
                this.audio?.duck?.(-4, { attackMs: 20, holdMs: 120, releaseMs: 600 });
                break;

            case 'SawHit':
                this.sawMotor?.onHit?.();
                this.audio?.play?.('sawHit');
                break;

            case 'EntityDamaged':
                if (event.isPlayer) {
                    const rate = (event.remainingLives <= 1) ? 0.88 : 1.0;
                    this.audio?.play?.('playerHit', { rateMultiplier: rate });
                    this.audio?.duck?.(-6, { attackMs: 10, holdMs: 150, releaseMs: 700 });
                } else {
                    this.audio?.play?.('enemyHit');
                }
                break;

            case 'EntityDied':
                this.audio?.play?.('enemyDeath');
                break;

            case 'PlayerFootstep':
                this.audio?.play?.(event.inBlood ? 'playerStepBlood' : 'playerStep');
                break;

            case 'PlayerFell':
                this.audio?.play?.('playerFall');
                this.audio?.duck?.(-8, { attackMs: 30, holdMs: 500, releaseMs: 1200 });
                break;

            case 'PlayerDashed':
                this.audio?.play?.('playerDash');
                break;

            default:
                break;
        }
    }
}
