/**
 * ChallengeLayouts — definições AUTORAIS dos corredores-desafio.
 *
 * Cada layout descreve, em COORDENADAS NORMALIZADAS, os perigos e botões de um
 * corredor. O sistema (ChallengeCorridor) converte essas coordenadas para o
 * mundo conforme a orientação real do corredor (N-S ou E-W), para o mesmo
 * layout funcionar em qualquer rotação.
 *
 * Sistema de coordenadas:
 *   u = posição AO LONGO do eixo principal do corredor (0 = entrada, 1 = saída)
 *   v = posição ATRAVÉS do corredor (0 = parede A, 0.5 = centro, 1 = parede B)
 *
 * Tipos de elemento:
 *   { type: "spike", u, v, phase }                espinho de chão (phase 0..1)
 *   { type: "spikeRow", u, count, phase, wave }   fileira de espinhos atravessando
 *   { type: "arrow", u, v, dir, phase }           atirador na parede (dir: "across+"|"across-"|"along+"|"along-")
 *   { type: "button", u, v }                      botão de pressão co-op
 *
 * Um corredor-desafio precisa de EXATAMENTE 2 botões (o puzzle co-op).
 */

export const CHALLENGE_LAYOUTS = [
    /* ---------------------------------------------------------------
     * A — "Corredor dos Espinhos"
     * Fileiras de espinhos em ONDA que os dois players atravessam com
     * tempo. No fim, dois botões lado a lado para abrir a saída.
     * ------------------------------------------------------------- */
    {
        name: "Espinhos",
        elements: [
            { type: "spikeRow", u: 0.28, count: 4, phase: 0.0,  wave: 0.12 },
            { type: "spikeRow", u: 0.42, count: 4, phase: 0.33, wave: 0.12 },
            { type: "spikeRow", u: 0.56, count: 4, phase: 0.66, wave: 0.12 },
            { type: "spikeRow", u: 0.70, count: 4, phase: 0.15, wave: 0.12 },
            // Dois botões próximos à saída (um de cada lado).
            { type: "button", u: 0.88, v: 0.34 },
            { type: "button", u: 0.88, v: 0.66 }
        ]
    },

    /* ---------------------------------------------------------------
     * B — "Fogo Cruzado"
     * Atiradores de flecha nas DUAS paredes disparam atravessando o
     * corredor em padrão alternado. Os botões ficam em lados OPOSTOS e
     * no fim, forçando os players a se separarem e cada um correr por um
     * lado sob o fogo cruzado.
     * ------------------------------------------------------------- */
    {
        name: "Fogo Cruzado",
        elements: [
            { type: "arrow", u: 0.30, v: 0.0, dir: "across+", phase: 0.0 },
            { type: "arrow", u: 0.45, v: 1.0, dir: "across-", phase: 0.5 },
            { type: "arrow", u: 0.60, v: 0.0, dir: "across+", phase: 0.25 },
            { type: "arrow", u: 0.75, v: 1.0, dir: "across-", phase: 0.75 },
            // Botões em cantos opostos da saída: obrigam a dividir.
            { type: "button", u: 0.90, v: 0.18 },
            { type: "button", u: 0.90, v: 0.82 }
        ]
    },

    /* ---------------------------------------------------------------
     * C — "Provação" (misto)
     * Espinhos no meio + atiradores que varrem o eixo, e os botões ficam
     * em pontos distantes: um antes de uma barreira de espinhos e outro
     * depois, exigindo coordenação (um segura enquanto o outro passa, e
     * então ambos pisam juntos ao fim).
     * ------------------------------------------------------------- */
    {
        name: "Provação",
        elements: [
            { type: "arrow", u: 0.22, v: 0.0, dir: "across+", phase: 0.0 },
            { type: "spike", u: 0.40, v: 0.35, phase: 0.0 },
            { type: "spike", u: 0.40, v: 0.65, phase: 0.5 },
            { type: "spike", u: 0.52, v: 0.5,  phase: 0.25 },
            { type: "arrow", u: 0.62, v: 1.0, dir: "across-", phase: 0.4 },
            { type: "spikeRow", u: 0.74, count: 5, phase: 0.0, wave: 0.1 },
            { type: "button", u: 0.90, v: 0.35 },
            { type: "button", u: 0.90, v: 0.65 }
        ]
    }
];

/** Escolhe um layout por índice (ciclando) — determinístico. */
export function layoutByIndex(i) {
    return CHALLENGE_LAYOUTS[((i % CHALLENGE_LAYOUTS.length) + CHALLENGE_LAYOUTS.length) % CHALLENGE_LAYOUTS.length];
}
