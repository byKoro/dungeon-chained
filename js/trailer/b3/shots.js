/**
 * Clipes do Bloco 3 ("O jogo na prática") do vídeo de apresentação
 * (pitch/04-video-apresentacao.md). Chave = número do clipe, na ordem da fala.
 *   0  abertura (a corrente estica, a sala se revela)
 *   1  buraco (o parceiro vacila, a corda arrasta, o P1 segura)
 *   2  espinhos e flechas (o desvio dele arrasta o P1 para os espinhos)
 *   3  botões co-op (cada um no seu, a corda no limite)
 *   4  sala trancada (portas batem, último inimigo, destranca)
 *   5  mapa novo (a sala padrão cresce em formas e cores; outra run)
 *   6  mesmo sofá (gameplay + dois controles na tela)
 *   ALL a sequência inteira (corte seco entre os clipes)
 */
import { OpenShot } from './OpenShot.js';
import { HoleShot } from './HoleShot.js';
import { SpikeShot } from './SpikeShot.js';
import { ButtonShot } from './ButtonShot.js';
import { LockShot } from './LockShot.js';
import { MapShot } from './MapShot.js';
import { CouchShot } from './CouchShot.js';

export const SHOTS = {
    0: OpenShot,
    1: HoleShot,
    2: SpikeShot,
    3: ButtonShot,
    4: LockShot,
    5: MapShot,
    6: CouchShot
};

/** Lista de classes do clipe `key` ('0'..'6' ou 'ALL'); null se não existir. */
export function shotList(key) {
    const k = String(key ?? 'ALL').toUpperCase();
    if (k === 'ALL') return Object.values(SHOTS);
    return SHOTS[k] ? [SHOTS[k]] : null;
}
