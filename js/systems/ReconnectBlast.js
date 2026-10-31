// Melhoria Reconexão explosiva: reconectar a serra solta a onda do Estalo em volta dela (`blast(x, y, radius)`, do
// Game). No máximo uma a cada `cooldownSteps`; a primeira conexão (fim da cinemática da Serra) não conta.
export class ReconnectBlast {
    constructor({ getParams, blast }) {
        Object.assign(this, { getParams, blast });
        this.reset();
    }

    reset() {
        this.cooldown = 0;
    }

    update() {
        if (this.cooldown > 0) this.cooldown--;
    }

    onReconnect(x, y, { first = false } = {}) {
        const params = this.getParams();
        if (!params || first || this.cooldown > 0) return false;
        this.cooldown = params.cooldownSteps;
        this.blast(x, y, params.radius);
        return true;
    }
}
