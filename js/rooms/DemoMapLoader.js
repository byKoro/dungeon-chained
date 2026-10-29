import { DEMO } from '../config/DemoConfig.js';
import { normalizeMap } from './MapDocument.js';
import { identifyDoors, validatePlayable } from './MapConnections.js';

async function fetchJson(url) {
    // No Electron (app://) um arquivo ausente rejeita o fetch em vez de responder 404.
    try {
        const res = await fetch(url, { cache: 'no-store' });
        return res.ok ? await res.json() : null;
    } catch {
        return null;
    }
}

export class DemoMapLoader {
    // null = jogo clássico (dungeon procedural). Lança Error só quando um mapa foi pedido e é inválido.
    static async load() {
        const params = new URLSearchParams(location.search);
        if (params.get('editor2') === 'true') {
            const raw = sessionStorage.getItem(DEMO.sessionKey);
            if (!raw) throw new Error('O teste expirou. Abra o mapa no Editor 2.0 e clique em Testar de novo.');
            const session = JSON.parse(raw);
            const map = identifyDoors(normalizeMap(session.map));
            const errors = validatePlayable(map, { roomKey: session.isolated ? map.start : null });
            if (errors.length) throw new Error(errors.join('\n'));
            return { map, test: session };
        }
        if (params.get('playtest') === 'true' || params.get('classic') === 'true') return null;

        const manifest = await fetchJson(DEMO.manifest);
        if (!manifest) return null;
        if (!/^[A-Za-z0-9_-]+\.json$/.test(manifest.file || '')) throw new Error('map/demo/active.json aponta para um arquivo inválido.');
        const raw = await fetchJson(`map/demo/${manifest.file}`);
        if (!raw) throw new Error(`Mapa principal map/demo/${manifest.file} não encontrado.`);
        const map = identifyDoors(normalizeMap(raw));
        const errors = validatePlayable(map);
        if (errors.length) throw new Error(errors.join('\n'));
        return { map, test: null };
    }
}
