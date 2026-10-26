import { DEMO } from '../config/DemoConfig.js';
import { normalizeMap } from '../editor2/MapModel.js';
import { identifyDoors, validatePlayable } from './MapConnections.js';

export class DemoMapLoader {
    static async load() {
        const params = new URLSearchParams(location.search);
        if (params.get('editor2') === 'true') {
            const raw = sessionStorage.getItem(DEMO.sessionKey);
            if (!raw) throw new Error('Teste expirou. Abra o mapa no Editor 2.0 novamente.');
            const session = JSON.parse(raw);
            const map = identifyDoors(normalizeMap(session.map));
            const errors = validatePlayable(map, { roomKey: session.isolated ? map.start : null });
            if (errors.length) throw new Error(errors.join('\n'));
            return { map, test: session };
        }
        if (params.get('playtest') === 'true') return null;
        const response = await fetch(DEMO.manifest, { cache: 'no-store' });
        if (response.status === 404) return null;
        if (!response.ok) throw new Error('Não foi possível carregar o mapa principal.');
        const manifest = await response.json();
        if (!/^[A-Za-z0-9_-]+\.json$/.test(manifest.file)) throw new Error('Arquivo de mapa principal inválido.');
        const data = await fetch(`map/demo/${manifest.file}`, { cache: 'no-store' });
        if (!data.ok) throw new Error('Mapa principal não encontrado.');
        const map = identifyDoors(normalizeMap(await data.json()));
        const errors = validatePlayable(map);
        if (errors.length) throw new Error(errors.join('\n'));
        return { map, test: null };
    }
}
