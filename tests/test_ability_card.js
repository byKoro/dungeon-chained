import assert from 'node:assert/strict';
import { AbilityCard } from '../js/ui/AbilityCard.js';

let passed = 0, failed = 0;
const ok = (c, m) => { if (c) { console.log(`✅ ${m}`); passed++; } else { console.error(`❌ ${m}`); failed++; } };

console.log('=== TESTE DA TELINHA DE HABILIDADE (dash) ===');

const makeCard = (device = "keyboard") => {
    let clock = 0;
    const card = new AbilityCard({ getDevice: () => device, now: () => clock });
    return { card, tick: ms => { clock += ms; }, at: () => clock };
};

// Começa inativa; show() ativa e escolhe o botão do dispositivo.
{
    const { card } = makeCard("keyboard");
    ok(!card.active, 'inativa no começo');
    card.show("ability.dash", 0);
    ok(card.active && card.btn === "Espaço", 'P1 teclado: Espaço');
    card.show("ability.dash", 1);
    ok(card.btn === "Enter", 'P2 teclado: Enter');
}
{
    const { card } = makeCard("xbox");
    card.show("ability.dash", 0);
    ok(card.btn === "A", 'Xbox: A');
}
{
    const { card } = makeCard("playstation");
    card.show("ability.dash", 0);
    ok(card.btn === "X", 'DualShock: X (glifo suportado pela fonte)');
}

// Some sozinha depois de ~4s + fade.
{
    const { card, tick } = makeCard();
    card.show("ability.dash", 0);
    tick(120); assert.ok(card._alpha() > 0.9, 'visível logo após abrir');
    tick(4000);           // passa o holdMs
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

// reset() zera.
{
    const { card } = makeCard();
    card.show("ability.dash", 0);
    card.reset();
    ok(!card.active, 'reset desativa');
}

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
