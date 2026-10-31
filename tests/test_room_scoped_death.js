import { RoomEvents } from '../js/systems/RoomEvents.js';

let passed = 0;
let failed = 0;
function assert(condition, message) {
    if (condition) { console.log(`✅ PASSOU: ${message}`); passed++; }
    else { console.error(`❌ FALHOU: ${message}`); failed++; }
}

console.log("=== TESTE DA MORTE NA SALA (reset só da sala) ===");

// RoomEvents.resetRoom: limpa só o estado da sala dada (encontros concluídos, scripts, cordas, gaiolas, grades).
{
    const events = new RoomEvents({
        rooms: { current: null }, spawnSystem: {}, getPlayers: () => [], chain: {}
    });
    events.completed.add("1,1/salao");
    events.completed.add("2,0/arena");
    events._scripts.set("1,1", {});
    events._scripts.set("2,0", {});
    events._ropes.set("1,1", {});
    events._cages.set("1,1", []);
    events._bars.set("1,1", { down: true });
    events._bars.set("2,0", { down: true });

    events.resetRoom("1,1");

    assert(!events.completed.has("1,1/salao"), "encontro concluído da sala volta a valer");
    assert(events.completed.has("2,0/arena"), "encontro de outra sala permanece");
    assert(!events._scripts.has("1,1") && !events._ropes.has("1,1")
        && !events._cages.has("1,1") && !events._bars.has("1,1"), "estado da sala descartado");
    assert(events._scripts.has("2,0") && events._bars.has("2,0"), "estado de outras salas intacto");
}

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
