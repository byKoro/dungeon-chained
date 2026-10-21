/**
 * Clipes do match cut (papel -> jogo) do vídeo de apresentação.
 * Chave = letra do plano em pitch/04-video-apresentacao.md.
 *   A  kill (Bloco 2)
 *   B  puxão (Bloco 2)
 *   C  corrente arrebenta (B2)
 *   D  plano aberto (B2)
 *   E  cartas / arremesso (B6)
 */
import { KillShot } from './KillShot.js';
import { PullShot } from './PullShot.js';
import { BreakShot } from './BreakShot.js';
import { WideShot } from './WideShot.js';
import { CardShot } from './CardShot.js';

export const SHOTS = {
    A: KillShot,
    B: PullShot,
    C: BreakShot,
    D: WideShot,
    E: CardShot
};

/** Classe do plano pela letra (maiúscula/minúscula); null se não existir. */
export function shotClass(key) {
    return SHOTS[String(key || '').toUpperCase()] ?? null;
}
