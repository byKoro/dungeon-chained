// Apresentação do Arauto ao entrar na sala (segundos de simulação).
// A duração da remontagem e do golpe vem das linhas `death` e `attack2` do sprite; aqui ficam só os inícios e as pausas.
export const ARAUTO_INTRO = Object.freeze({
    sessionKey: 'dungeonChained.arautoIntroSeen',
    zoom: 1.25,
    // Ticks parado em `recover` depois da cena, antes do primeiro ataque.
    attackDelaySteps: 48,
    full: Object.freeze({
        // Barras + câmera até aqui; depois a morte toca ao contrário.
        assembleAt: 0.9,
        barsOutAfterImpact: 0.6,
        endAfterImpact: 1.1
    }),
    short: Object.freeze({
        raiseAt: 0.4,
        barsOutAfterImpact: 0.2,
        endAfterImpact: 0.6
    }),
    // Expressões dos jogadores (boneco e retrato) em cada trecho.
    expressions: Object.freeze({
        focus: 'desconfiado',
        assemble: 'espantado',
        raise: 'assustado',
        ready: 'raiva'
    }),
    readyAfterImpact: 0.25,
    assembleCue: 'arautoAssemble',
    skip: Object.freeze({
        holdSeconds: 1,
        drainSeconds: 0.3,
        // Medidas em pixels de arte (multiplicadas pela escala inteira do HUD).
        keySize: 11,
        ringRadius: 10,
        ringWidth: 2,
        margin: 6,
        idleAlpha: 0.55,
        ringBack: 'rgba(11, 9, 16, 0.75)',
        ringColor: '#f2cf5b',
        keyOutline: '#0b0910',
        keyFace: '#3a3446',
        keyLight: '#5a5370',
        keyDark: '#2b2735',
        keyText: '#efe3c2'
    })
});
