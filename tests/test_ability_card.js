import assert from 'node:assert/strict';
import { AbilityCard, ABILITY_CARD_KEYS } from '../js/ui/AbilityCard.js';

let passed = 0, failed = 0;
const ok = (c, m) => { if (c) { console.log(`✅ ${m}`); passed++; } else { console.error(`❌ ${m}`); failed++; } };

console.log('=== TESTE DA TELINHA DE HABILIDADE (dash) ===');

const makeCard = (device = "keyboard") => {
    let clock = 0;
    const card = new AbilityCard({ getDevice: () => device, now: () => clock });
    return { card, tick: ms => { clock += ms; }, at: () => clock };
};

// Começa inativa; show() ativa; o botão segue o dispositivo de cada jogador.
{
    const { card } = makeCard("keyboard");
    ok(!card.active, 'inativa no começo');
    card.show("ability.dash");
    const items = card.prompts();
    ok(card.active && items.length === 2, 'teclado: um botão por jogador (teclas diferentes)');
    ok(items[0].player === 0 && items[0].prompt.icon === "key" && items[0].prompt.label === "ESPAÇO", 'P1 teclado: tecla ESPAÇO');
    ok(items[1].player === 1 && items[1].prompt.label === "ENTER", 'P2 teclado: tecla ENTER');
}
{
    const { card } = makeCard("xbox");
    card.show("ability.dash");
    const items = card.prompts();
    ok(items.length === 1 && items[0].player === null && items[0].prompt.icon === "xboxA", 'dois no Xbox: um só A, sem etiqueta');
}
{
    const { card } = makeCard("playstation");
    card.show("ability.dash");
    ok(card.prompts()[0].prompt.icon === "psCross", 'DualShock: ✕');
}
{
    let clock = 0;
    const devices = ["xbox", "keyboard"];
    const card = new AbilityCard({ getDevice: i => devices[i], now: () => clock });
    card.show("ability.dash");
    const items = card.prompts();
    ok(items.length === 2 && items[0].prompt.icon === "xboxA" && items[1].prompt.label === "ENTER", 'misto: A do P1 e ENTER do P2');
    devices[1] = "playstation";
    ok(card.prompts()[1].prompt.icon === "psCross", 'troca o ícone ao vivo quando o jogador muda de controle');
}

// Some sozinha depois de ~4s + fade.
{
    const { card, tick } = makeCard();
    card.show("ability.dash", 0);
    tick(120); assert.ok(card._alpha() > 0.9, 'visível logo após abrir');
    tick(10000);          // passa o hold (o card de vídeo fica mais tempo na tela)
    card._alpha();        // marca dismissedAt
    tick(300);            // passa o fade
    ok(card._alpha() === 0 && !card.active, 'auto-some após hold + fade');
}

// dismiss() (primeiro dash) fecha antes do tempo.
{
    const { card, tick } = makeCard();
    card.show("ability.dash", 0);
    tick(300);
    card.dismiss();
    ok(card.active, 'ainda desenha durante o fade');
    tick(300);
    ok(card._alpha() === 0 && !card.active, 'fecha no primeiro dash após o fade');
}

// notify(): cada card fecha só com o evento dele (o dash não fecha a telinha da Investida).
{
    const { card, tick } = makeCard();
    ok(ABILITY_CARD_KEYS.includes("ability.dash") && ABILITY_CARD_KEYS.includes("ability.tackle"), 'lista de telinhas tem dash e Investida');
    card.show("ability.tackle");
    ok(card.prompts().length === 2, 'Investida mostra o botão de dash de cada jogador');
    card.notify("dash");
    tick(300);
    ok(card.active && card._alpha() > 0.9, 'Investida: um dash comum não fecha');
    card.notify("tackle");
    tick(300);
    ok(card._alpha() === 0 && !card.active, 'Investida: fecha no primeiro tackle');
    card.show("ability.dash");
    card.notify("tackle");
    tick(300);
    ok(card.active, 'dash: tackle não fecha a telinha do dash');
    card.notify("dash");
    tick(300);
    ok(card._alpha() === 0 && !card.active, 'dash: fecha no primeiro dash');
}
// reset() zera.
{
    const { card } = makeCard();
    card.show("ability.dash", 0);
    card.reset();
    ok(!card.active, 'reset desativa');
}

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
