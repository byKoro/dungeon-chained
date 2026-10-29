import { t, setLanguage, getLanguage, LANGUAGES, DEFAULT_LANGUAGE } from '../js/i18n/I18n.js';

let passed = 0;
let failed = 0;
function assert(condition, message) {
    if (condition) { console.log(`✅ PASSOU: ${message}`); passed++; }
    else { console.error(`❌ FALHOU: ${message}`); failed++; }
}

console.log("=== TESTE DE IDIOMAS (t) ===");

assert(getLanguage() === "pt-BR" && DEFAULT_LANGUAGE === "pt-BR", "idioma padrão é pt-BR");
assert(t("talk.start.1") === "Que lugar é esse?", "traduz chave em pt-BR");
assert(t("chave.que.nao.existe") === "chave.que.nao.existe", "chave ausente devolve a própria chave");
assert(t("talk.debug", { who: "Azul" }) === "Teste de balão: Azul falando.", "interpola variáveis");
assert(t("talk.debug") === "Teste de balão: {who} falando.", "sem variáveis mantém o marcador");

assert(setLanguage("en") && t("talk.start.1") === "What is this place?", "troca para inglês");
assert(!setLanguage("xx") && getLanguage() === "en", "idioma desconhecido é recusado");

const fullEn = LANGUAGES.en;
LANGUAGES.en = { ...fullEn };
delete LANGUAGES.en["talk.rightDoor"];
assert(t("talk.rightDoor") === "Vamos pela direita.", "chave ausente no idioma cai no pt-BR");
LANGUAGES.en = fullEn;
setLanguage("pt-BR");

const missing = Object.keys(LANGUAGES["pt-BR"]).filter(k => !(k in fullEn));
assert(missing.length === 0, `en.js tem todas as chaves do pt-BR${missing.length ? ` (faltam: ${missing.join(", ")})` : ""}`);

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed ? 1 : 0);
