import { PT_BR } from './pt-BR.js';
import { EN } from './en.js';

export const DEFAULT_LANGUAGE = "pt-BR";
export const LANGUAGES = { "pt-BR": PT_BR, en: EN };

let current = DEFAULT_LANGUAGE;

export function setLanguage(lang) {
    if (!LANGUAGES[lang]) return false;
    current = lang;
    return true;
}

export function getLanguage() {
    return current;
}

// Chave ausente no idioma atual cai no padrão (pt-BR) e, por fim, na própria chave.
export function t(key, vars = null) {
    const text = LANGUAGES[current]?.[key] ?? LANGUAGES[DEFAULT_LANGUAGE][key] ?? key;
    if (!vars) return text;
    return text.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m));
}
