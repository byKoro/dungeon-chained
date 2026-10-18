import {
    TILE, LIGHT_PIXEL_SCALE, PLAYER_LIGHT_RADIUS, TORCHES, DOOR_LIGHT
} from '../config/GameConfig.js';

// Perfis de luz AZUL-AÇO reutilizados pela lâmina (dropada e em uso): mesma cor
// e falloff, variando só o raio. Ficam no módulo porque não dependem de estado.
const BLADE_COLOR = "150, 196, 255";
const DROPPED_BLADE_PROFILE = {
    color: BLADE_COLOR,
    flickerBase: 1, flickerSine: 0.04, flickerNoise: 0.02,
    falloff: [
        { offset: 0.0, alpha: 0.95 },
        { offset: 0.3, alpha: 0.55 },
        { offset: 0.55, alpha: 0.28 },
        { offset: 0.78, alpha: 0.1 },
        { offset: 1.0, alpha: 0.0 }
    ]
};
const ACTIVE_BLADE_PROFILE = {
    color: BLADE_COLOR,
    flickerBase: 1, flickerSine: 0.05, flickerNoise: 0.02,
    falloff: [
        { offset: 0.0, alpha: 0.9 },
        { offset: 0.3, alpha: 0.5 },
        { offset: 0.55, alpha: 0.26 },
        { offset: 0.78, alpha: 0.1 },
        { offset: 1.0, alpha: 0.0 }
    ]
};
// Perfil neutro do feixe de PORTA: cor amarela + falloff próprio, sem flicker do
// PostProcessor (o pulso/fade vêm do alphaScale calculado por frame).
const DOOR_BEAM_PROFILE = {
    color: DOOR_LIGHT.color,
    flickerBase: 1, flickerSine: 0, flickerNoise: 0,
    falloff: [
        { offset: 0.0, alpha: 0.9 },
        { offset: 0.4, alpha: 0.5 },
        { offset: 0.7, alpha: 0.2 },
        { offset: 0.9, alpha: 0.06 },
        { offset: 1.0, alpha: 0.0 }
    ]
};

// Luz quente e contida dos botões de pressão (tom da tampa, dessaturado).
// A intensidade por frame é aplicada escalando os alphas do falloff.
const BUTTON_PROFILE = {
    color: "214, 120, 112",
    flickerBase: 1, flickerSine: 0, flickerNoise: 0,
    falloff: [
        { offset: 0.0, alpha: 0.7 },
        { offset: 0.35, alpha: 0.35 },
        { offset: 0.7, alpha: 0.1 },
        { offset: 1.0, alpha: 0.0 }
    ]
};

/**
 * LightingRenderer — monta todas as LUZES de tela do quadro no PostProcessor.
 *
 * Antes era um bloco gigante dentro de Game._render. Aqui vira um passo coeso:
 * recebe renderer + postProcessor fixos e, a cada frame, registra as luzes de
 * jogadores, da lâmina (dropada e em uso), o wash de parede, as tochas e o
 * flash temporário das portas. Lê o estado por parâmetro (não guarda estado de
 * jogo), então é puramente derivado da cena.
 */
export class LightingRenderer {
    /**
     * @param {object} opts
     * @param {Renderer} opts.renderer
     * @param {PostProcessor} opts.postProcessor
     */
    constructor({ renderer, postProcessor }) {
        this.renderer = renderer;
        this.postProcessor = postProcessor;
    }

    // Tamanho do "pixel de luz" chunky na tela, derivado do zoom e de uma escala.
    _lightPixel(zoom, scale = LIGHT_PIXEL_SCALE) {
        return Math.max(2, Math.round((TILE / 16) * zoom * scale));
    }

    /**
     * Registra todas as luzes do quadro. Deve ser chamado entre renderer.endFrame()
     * e postProcessor.draw().
     *
     * @param {object} scene
     * @param {Array} scene.players            jogadores vivos a iluminar
     * @param {Chain} scene.chain              corrente/arma (serra em uso + dropada)
     * @param {{x:number,y:number}|null} scene.sawPos posição da serra em uso (ou null)
     * @param {object|null} scene.arenaBounds  bounds da área jogável (wash)
     * @param {object} scene.tiles             tiles da sala (tochas)
     * @param {object} scene.rect              retângulo da célula (origem das tochas)
     * @param {Array} scene.doors              portas da sala atual
     * @param {number} scene.doorHalf          meia-largura do vão de porta
     * @param {boolean} scene.open             sala destravada (portas visíveis)
     * @param {number} scene.doorFlashT        segundos restantes do flash de porta
     */
    render({ players, chain, sawPos, arenaBounds, tiles, rect, doors, doorHalf, open, doorFlashT, buttons = [] }) {
        this._renderButtonLights(buttons);
        this._renderPlayerLights(players);
        this._renderDroppedBladeLight(chain);
        this._renderActiveBladeLight(chain, sawPos);
        this._renderWallWash(arenaBounds);
        this._renderTorches(tiles, rect);
        this._renderDoorFlash({ doors, doorHalf, open, doorFlashT });
    }

    // Luz quente dos BOTÕES de pressão: acende enquanto pressionado (glow
    // contínuo, raio pequeno) e dá um pico maior no instante do clique
    // (flash), reforçando o feedback de "ativou".
    _renderButtonLights(buttons) {
        for (const b of buttons) {
            const glow = b.glow ?? 0, flash = b.flash ?? 0;
            const strength = Math.max(glow * 0.7, flash);
            if (strength < 0.02) continue;
            const s = this.renderer.worldToScreen(b.x, b.y);
            const px = this._lightPixel(s.zoom);
            const radius = (55 + glow * 15 + flash * 55) * s.zoom;
            // flatten 0.6: luz achatada, "deitada" no chão em volta do botão.
            this.postProcessor.addLight(s.x, s.y, radius, px, 0.6, {
                ...BUTTON_PROFILE,
                falloff: BUTTON_PROFILE.falloff.map(f => ({ ...f, alpha: f.alpha * strength }))
            });
        }
    }

    // Luz de cada jogador. O raio em mundo (PLAYER_LIGHT_RADIUS) é convertido
    // para tela pelo zoom.
    _renderPlayerLights(players) {
        for (const p of players) {
            const s = this.renderer.worldToScreen(p.x, p.y);
            const pixel = this._lightPixel(s.zoom);
            this.postProcessor.addLight(s.x, s.y, PLAYER_LIGHT_RADIUS * s.zoom, pixel);
        }
    }

    // Luz da LÂMINA DROPADA: quando a corrente arrebenta, a serra largada no
    // chão brilha como item coletável (azul-aço), pulsando de leve ao flutuar.
    _renderDroppedBladeLight(chain) {
        const dropLight = chain.getDroppedLight?.();
        if (!dropLight) return;
        const s = this.renderer.worldToScreen(dropLight.x, dropLight.y);
        const px = this._lightPixel(s.zoom);
        const breathe = 0.85 + dropLight.hover * 0.15; // ~0.85..1.0 do raio base
        this.postProcessor.addLight(s.x, s.y, 150 * breathe * s.zoom, px, 1, DROPPED_BLADE_PROFILE);
    }

    // Luz azul-aço da SERRA EM USO: mesma luz fria da dropada, com raio MENOR,
    // acompanhando o disco enquanto a corrente está conectada. Pulsa de leve com
    // o giro.
    _renderActiveBladeLight(chain, sawPos) {
        if (!chain.isConnected || !sawPos) return;
        const weapon = chain.weapon;
        if (!weapon) return;
        const s = this.renderer.worldToScreen(sawPos.x, sawPos.y);
        const px = this._lightPixel(s.zoom);
        const spin = weapon.spinSpeed ?? 0;
        const bladeRadius = 60 + spin * 18; // "respiro" conforme o giro
        this.postProcessor.addLight(s.x, s.y, bladeRadius * s.zoom, px, 1, ACTIVE_BLADE_PROFILE);
    }

    // WASH de parede: banho de luz contínuo a partir das quatro bordas da sala,
    // esvaecendo para o interior (preenchimento do ambiente).
    _renderWallWash(arenaBounds) {
        if (!(TORCHES.enabled && TORCHES.light.wash?.enabled && arenaBounds)) return;
        const wash = TORCHES.light.wash;
        const wProfile = { ...TORCHES.light, falloff: wash.falloff };
        const b = arenaBounds;
        const tl0 = this.renderer.worldToScreen(b.minX, b.minY);
        const br0 = this.renderer.worldToScreen(b.maxX, b.maxY);
        const d = wash.depth * tl0.zoom; // profundidade em px de tela
        const left = tl0.x, top = tl0.y, right = br0.x, bottom = br0.y;
        const fullW = right - left, fullH = bottom - top;
        // Norte/Sul: faixas horizontais. Oeste/Leste: faixas verticais.
        this.postProcessor.addWash({ x: left, y: top, w: fullW, h: d }, "N", wProfile);
        this.postProcessor.addWash({ x: left, y: bottom - d, w: fullW, h: d }, "S", wProfile);
        this.postProcessor.addWash({ x: left, y: top, w: d, h: fullH }, "W", wProfile);
        this.postProcessor.addWash({ x: right - d, y: top, w: d, h: fullH }, "E", wProfile);
    }

    // Luzes das TOCHAS de parede. Cada tocha emite um HALO pequeno na chama e uma
    // ÁREA CIRCULAR (mancha difusa) empurrada para dentro da sala.
    _renderTorches(tiles, rect) {
        if (!(TORCHES.enabled && tiles.torches?.length)) return;
        const tl = TORCHES.light;
        const area = tl.area;
        for (const t of tiles.torches) {
            // Centro do tile da tocha + deslocamento para o lado de DENTRO da
            // sala, onde a chama de fato ilumina.
            let wx = rect.x + t.col * TILE + TILE / 2;
            let wy = rect.y + t.row * TILE + TILE / 2;
            // (areaDx, areaDy) empurra o CENTRO da mancha para dentro da sala,
            // conforme a parede em que a tocha está montada.
            let areaDx = 0, areaDy = 0;
            if (t.side === "N") { wy += tl.offsetY; areaDy = area.pushIn; }
            else if (t.side === "S") { wy -= tl.offsetY; areaDy = -area.pushIn; }
            else if (t.side === "W") { wx += tl.offsetX; areaDx = area.pushIn; }
            else if (t.side === "E") { wx -= tl.offsetX; areaDx = -area.pushIn; }

            const s = this.renderer.worldToScreen(wx, wy);
            const px = this._lightPixel(s.zoom, tl.pixelScale);

            // 1) Halo na fonte (chama brilhando no entorno imediato).
            const glowProfile = { ...tl, falloff: tl.glow.falloff };
            this.postProcessor.addLight(s.x, s.y, tl.glow.radius * s.zoom, px, tl.glow.flatten, glowProfile);

            // 2) Mancha CIRCULAR empurrada para dentro da sala: raio maior e
            // falloff bem suave, bordas dissolvidas (sem elipse direcional).
            const areaProfile = { ...tl, falloff: area.falloff };
            const ac = this.renderer.worldToScreen(wx + areaDx, wy + areaDy);
            this.postProcessor.addLight(ac.x, ac.y, area.radius * s.zoom, px, area.flatten, areaProfile);
        }
    }

    // Luz amarela TEMPORÁRIA das PORTAS: dispara ao abrir a porta, pulsa e
    // enfraquece até sumir. A GEOMETRIA do feixe fica FIXA o flash todo (não
    // encolhe); só a OPACIDADE decai, via alphaScale.
    _renderDoorFlash({ doors, doorHalf, open, doorFlashT }) {
        if (!(DOOR_LIGHT.enabled && doorFlashT > 0 && open && doors?.length)) return;
        const dl = DOOR_LIGHT;
        const prog = 1 - doorFlashT / dl.flashDuration;      // 0..1 do flash
        const fade = (1 - prog) ** dl.fadeExponent;          // envelope de queda
        const pulse = 1 + Math.sin(prog * dl.flashDuration * dl.pulseSpeed) * dl.pulseDepth;
        const alphaScale = Math.max(0, fade * pulse);

        for (const door of doors) {
            // Direção do feixe: para DENTRO da sala (contrária à parede).
            let dx = 0, dy = 0;
            if (door.dir === "N") dy = 1;
            else if (door.dir === "S") dy = -1;
            else if (door.dir === "W") dx = 1;
            else if (door.dir === "E") dx = -1;

            // Recuo do apex ATRÁS da porta derivado da LARGURA do vão, para a
            // boca do cone cobrir a porta de ponta a ponta.
            const apexBehind = doorHalf / Math.tan(dl.spread);
            const wx = door.x - dx * apexBehind;
            const wy = door.y - dy * apexBehind;

            const s = this.renderer.worldToScreen(wx, wy);
            const px = this._lightPixel(s.zoom, dl.pixelScale);
            // Geometria FIXA: comprimento = recuo atrás da porta + alcance dentro.
            const beamLen = (dl.length + apexBehind) * s.zoom;
            // O feixe só aparece a partir do plano da porta (recorta a ponta
            // atrás do vão), nascendo já com a largura do vão.
            const startDist = apexBehind * s.zoom;
            this.postProcessor.addSpotLight(
                s.x, s.y, dx, dy, beamLen, dl.spread, px, DOOR_BEAM_PROFILE, startDist, alphaScale, dl.startFade
            );
        }
    }
}
