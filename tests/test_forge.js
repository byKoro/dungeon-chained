import { Chain } from '../js/core/Chain.js';
import { SawWeapon } from '../js/weapons/SawWeapon.js';
import { CHAIN } from '../js/config/ChainConfig.js';
import { FORGE, anvilRecipes } from '../js/config/ForgeConfig.js';
import { ForgeState, mapOffersRecipe } from '../js/systems/ForgeState.js';
import { ScrapWallet } from '../js/systems/ScrapWallet.js';

let passed = 0;
let failed = 0;
function assert(condition, message) {
    if (condition) { console.log(`✅ PASSOU: ${message}`); passed++; }
    else { console.error(`❌ FALHOU: ${message}`); failed++; }
}

console.log("=== TESTE DA FORJA E DA SERRA AUSENTE ===");

const player = (x, y) => ({ x, y, vx: 0, vy: 0, speed: 4.2, speedMag: 0, hitRadius: 16 });

// Serra ausente: sem cabo, sem reconexão, mesmo com os dois juntos.
{
    const chain = new Chain([new SawWeapon()], CHAIN);
    chain.reset({ present: false });
    const p1 = player(0, 0), p2 = player(20, 0);
    let reconnected = 0;
    for (let i = 0; i < 60; i++) chain.update(p1, p2, { onReconnect: () => reconnected++ });
    assert(!chain.hasSaw && !chain.isConnected && reconnected === 0, "sem serra os jogadores juntos não conectam");
    p1.speedMag = p2.speedMag = 4.2;
    for (let i = 0; i < 60; i++) chain.update(p1, p2);
    assert(chain.weapon.spin === 0, "sem serra o giro fica zerado (motor mudo)");
    assert(!chain.forceDrop(p1, p2), "queda não larga uma serra que não existe");
    chain.reset();
    assert(!chain.isConnected, "reset sem argumento mantém a ausência (troca de sala)");

    chain.spawnSaw(500, 0);
    assert(chain.hasSaw && chain.weapon.dropped && chain.weapon.dropX === 500, "spawnSaw larga a serra no ponto");
    const a = player(470, 0), b = player(200, 0);
    for (let i = 0; i < 5; i++) chain.update(a, b, { onReconnect: () => reconnected++ });
    assert(!chain.isConnected, "um jogador perto não basta");
    b.x = 530;
    chain.update(a, b, { onReconnect: () => reconnected++ });
    assert(chain.isConnected && reconnected === 1 && !chain.weapon.dropped, "os dois perto conectam");

    chain.reset({ present: true });
    assert(chain.isConnected && chain.hasSaw, "reset com serra conecta");
}

// Catálogo e regras de compra.
{
    assert(anvilRecipes({ type: "anvil" }).join() === FORGE.defaultRecipes.join(), "bigorna sem receitas usa o catálogo padrão");
    assert(anvilRecipes({ type: "anvil", recipes: ["saw", "x"] }).join() === "saw", "receitas desconhecidas são ignoradas");
    assert(anvilRecipes({ type: "anvil", recipes: [] }).length === 0, "lista vazia não oferece nada");

    const map = { rooms: { "1,1": { props: [{ type: "anvil", col: 1, row: 1, recipes: ["size"] }] }, "2,1": { props: [{ type: "flag" }] } } };
    assert(!mapOffersRecipe(map, "saw") && mapOffersRecipe(map, "size"), "mapOffersRecipe olha as bigornas do mapa");
    assert(mapOffersRecipe({ rooms: { a: { props: [{ type: "anvil" }] } } }, "saw"), "bigorna padrão oferece a Serra");

    const forge = new ForgeState();
    const wallet = new ScrapWallet(9);
    assert(forge.status("size", wallet.amount) === "locked", "melhoria apagada sem a serra");
    assert(forge.status("saw", wallet.amount) === "poor" && !forge.buy("saw", wallet).ok && wallet.amount === 9, "falta sucata: não compra nem gasta");
    wallet.add(41);
    assert(forge.buy("saw", wallet).ok && forge.has("saw") && wallet.amount === 40, "compra a serra por 10");
    assert(forge.status("saw", wallet.amount) === "maxed", "serra comprada fica no máximo");
    assert(forge.nextCost("size") === 8 && forge.buy("size", wallet).ok && forge.nextCost("size") === 14, "Tamanho sobe de nível e o preço muda");
    forge.buy("size", wallet);
    assert(forge.level("size") === 2 && wallet.amount === 18, "dois níveis de Tamanho: 8 + 14");
    assert(forge.status("size", wallet.amount) === "poor", "nível 3 (22) falta sucata");
    wallet.add(100);
    forge.buy("size", wallet);
    assert(forge.status("size", wallet.amount) === "maxed" && !forge.buy("size", wallet).ok, "Tamanho para no nível 3");
    forge.reset({ items: ["saw"] });
    assert(forge.has("saw") && forge.level("size") === 0, "reset com a serra já liberada");
}

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
