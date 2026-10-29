import assert from 'node:assert/strict';
import { SpawnSystem } from '../js/systems/SpawnSystem.js';
import { ArautoIntroScene } from '../js/systems/ArautoIntroScene.js';
import { ArautoPhaseScene } from '../js/systems/ArautoPhaseScene.js';
import { HoldToSkip } from '../js/ui/HoldToSkip.js';
import { letterboxAmount, drawLetterbox } from '../js/ui/Letterbox.js';
import { PlayerFactory } from '../js/entities/PlayerFactory.js';
import { Game } from '../js/Game.js';
import { ARAUTO_INTRO } from '../js/config/ArautoIntroConfig.js';
import { LETTERBOX } from '../js/config/LetterboxConfig.js';
import { ARAUTO_FX } from '../js/config/ArautoEffectsConfig.js';
import { FLAME_GOLEM } from '../js/config/FlameGolemConfig.js';
import { SIM_HZ } from '../js/config/GameConfig.js';

const sheet = { complete: true, naturalWidth: 1200 };
const spawn = new SpawnSystem({ assets: { get: () => sheet }, bloodCanvas: { palette: [] } });
const create = () => spawn.createEnemy(0, 0, 1, 'flameGolem');
const DT = 1 / SIM_HZ;

// --- pose de cena: só o desenho ---
{
    const e = create();
    assert.equal(e.introPose, null);
    const walk = e._currentAnim();
    e.introPose = { row: 'death', frame: 5, glow: 0 };
    assert.equal(e._currentAnim(), e.sprite.rows.death);
    assert.equal(e._currentFrameIndex(e._currentAnim()), 5);
    const embers = [];
    e.emitEmbers({ triggerFlameBurst: () => embers.push(1) });
    for (let i = 0; i < SIM_HZ; i++) e.emitEmbers({ triggerFlameBurst: () => embers.push(1) });
    assert.equal(embers.length, 0, 'desmontado não solta brasas');
    assert.equal(e.lightInfo().strength, 0, 'desmontado fica sem luz');
    e.introPose = null;
    assert.equal(e._currentAnim(), walk);
}

// --- faixas no estilo da forja ---
{
    assert.equal(letterboxAmount(0, 0.45, 3, 4), 0);
    assert.equal(letterboxAmount(1, 0.45, 3, 4), 1);
    assert.equal(letterboxAmount(4, 0.45, 3, 4), 0);
    assert.ok(letterboxAmount(0.2, 0.45, 3, 4) > 0 && letterboxAmount(0.2, 0.45, 3, 4) < 1);
    const calls = [];
    const ctx = { save() {}, restore() {}, setTransform() {}, fillRect(...r) { calls.push(r); } };
    drawLetterbox(ctx, { width: 1600, height: 900 }, 1);
    const h = Math.round(900 * LETTERBOX.barRatio);
    assert.deepEqual(calls, [[0, 0, 1600, h], [0, 900 - h, 1600, h]]);
    calls.length = 0;
    drawLetterbox(ctx, { width: 1600, height: 900 }, 0);
    assert.equal(calls.length, 0);

    const renderer = { camX: 0, camY: 0, zoom: 1, triggerShake() {} };
    const phase = new ArautoPhaseScene({ renderer, hud: { onBossTransformation() {} },
        particleSystem: { triggerLavaDebris() {}, triggerFlameBurst() {} }, getPlayers: () => [] });
    const boss = create(); boss.hp = FLAME_GOLEM.secondPhaseHp; boss.state = 'chase';
    assert.ok(phase.tryStart([boss]));
    phase.update(1);
    assert.equal(phase.letterbox, 1, 'fase 2: faixas cheias no meio da cena');
    phase.update(ARAUTO_FX.scene.duration);
    assert.equal(phase.letterbox, 0);
}

// --- linha do tempo da apresentação ---
const memoryStorage = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const harness = (opts = {}) => {
    const log = { impacts: 0, slam: 0, cues: [], hud: [], frames: [] };
    const players = [{ x: 300, y: 0, expression: null, vx: 1, vy: 1 }, { x: 320, y: 0, expression: null, vx: 1, vy: 1 }];
    const camera = { focus: null };
    const scene = new ArautoIntroScene({
        camera, hud: { onBossTransformation: n => log.hud.push(n) },
        effects: { groundHit: (e, slam) => { log.impacts++; assert.equal(slam, true); } },
        arautoAudio: { groundHit: slam => { log.slam++; assert.equal(slam, true); } },
        audio: { play: cue => log.cues.push(cue) },
        particles: { triggerFlameBurst() {} },
        getPlayers: () => players, storage: opts.storage ?? memoryStorage(), forceFull: opts.forceFull ?? false
    });
    return { scene, log, players, camera };
};
const run = (scene, enemy, log, seconds = 10) => {
    for (let t = 0; t < seconds * SIM_HZ && scene.active; t++) {
        scene.update(DT);
        if (enemy.introPose) {
            const last = log.frames.at(-1), key = `${enemy.introPose.row}:${enemy.introPose.frame}`;
            if (last !== key) log.frames.push(key);
        }
    }
};
{
    const storage = memoryStorage();
    const { scene, log, players, camera } = harness({ storage });
    const e = create();
    assert.ok(scene.start(e));
    assert.deepEqual(e.introPose, { row: 'death', frame: e.sprite.rows.death.frames - 1, glow: 0 }, 'começa desmontado');
    assert.equal(players[0].vx, 0);
    scene.update(DT);
    assert.deepEqual(camera.focus, { x: e.x, y: e.y, zoom: ARAUTO_INTRO.zoom });
    assert.ok(scene.letterbox > 0);
    const impactAt = scene.impactAt;
    const expectedImpact = ARAUTO_INTRO.full.assembleAt
        + (e.sprite.rows.death.frames * e.sprite.rows.death.fps + e.sprite.rows.attack2.hitFrame * e.sprite.rows.attack2.fps) / SIM_HZ;
    assert.ok(Math.abs(impactAt - expectedImpact) < 1e-9, 'impacto derivado do config e do sprite');
    run(scene, e, log);
    const death = e.sprite.rows.death.frames, a2 = e.sprite.rows.attack2.frames;
    const expected = [...Array.from({ length: death }, (_, i) => `death:${death - 1 - i}`), ...Array.from({ length: a2 }, (_, i) => `attack2:${i}`)];
    assert.deepEqual(log.frames, expected, 'remonta 5→0 e depois o attack2 inteiro');
    assert.equal(log.cues.filter(c => c === ARAUTO_INTRO.assembleCue).length, death, 'um estalo por quadro da remontagem');
    assert.equal(log.impacts, 1); assert.equal(log.slam, 1);
    const ex = ARAUTO_INTRO.expressions;
    assert.deepEqual(log.hud, [ex.focus, ex.assemble, ex.raise, ex.ready, null]);
    assert.equal(scene.active, false);
    assert.equal(e.introPose, null);
    assert.equal(camera.focus, null);
    assert.equal(e.state, 'recover'); assert.equal(e.stateTimer, ARAUTO_INTRO.attackDelaySteps);
    assert.deepEqual(players.map(p => p.expression), [null, null], 'expressões voltam');

    // segunda vez na sessão: só o golpe
    const again = harness({ storage });
    const e2 = create();
    again.scene.start(e2);
    assert.equal(again.scene.short, true);
    run(again.scene, e2, again.log);
    assert.ok(!again.log.frames.some(f => f.startsWith('death')), 'curta não remonta');
    assert.equal(again.log.cues.length, 0);
    assert.equal(again.log.impacts, 1);
    assert.ok(Math.abs(again.scene.impactAt - (ARAUTO_INTRO.short.raiseAt + e2.sprite.rows.attack2.hitFrame * e2.sprite.rows.attack2.fps / SIM_HZ)) < 1e-9);

    // checkbox do editor: sempre completa
    const forced = harness({ storage, forceFull: true });
    forced.scene.start(create());
    assert.equal(forced.scene.short, false);
}
{
    // pular no meio da remontagem: estado final, sem impacto
    const { scene, log, players, camera } = harness();
    const e = create();
    scene.start(e);
    for (let i = 0; i < (ARAUTO_INTRO.full.assembleAt + 0.3) * SIM_HZ; i++) scene.update(DT);
    assert.ok(scene.skip());
    assert.equal(scene.skip(), false, 'pular duas vezes não quebra');
    assert.equal(log.impacts, 0);
    assert.equal(e.introPose, null); assert.equal(camera.focus, null);
    assert.equal(e.state, 'recover');
    assert.deepEqual(players.map(p => p.expression), [null, null]);
    assert.equal(scene.letterbox, 0);
}
{
    // durante a cena o golem não ataca; depois espera o atraso
    const { scene } = harness();
    const e = create();
    const ps = [{ x: 10, y: 0, lives: 3, hitRadius: 16, falling: false, takeDamage: () => assert.fail('sem dano') },
        { x: 12, y: 0, lives: 3, hitRadius: 16, falling: false, takeDamage: () => assert.fail('sem dano') }];
    scene.start(e);
    scene.skip();
    for (let i = 0; i < ARAUTO_INTRO.attackDelaySteps - 1; i++) e.update(ps, () => assert.fail('sem dano no atraso'));
    assert.equal(e.state, 'recover');
}

// --- segurar E para pular ---
{
    let held = true;
    const skip = new HoldToSkip({ isHeld: () => held });
    for (let i = 0; i < 2 * SIM_HZ; i++) skip.update(DT);
    assert.equal(skip.progress, 0, 'quem entrou segurando não pula');
    held = false; skip.update(DT);
    held = true;
    for (let i = 0; i < ARAUTO_INTRO.skip.holdSeconds * SIM_HZ * 0.5; i++) skip.update(DT);
    assert.ok(skip.progress > 0.4 && !skip.done);
    held = false;
    for (let i = 0; i < ARAUTO_INTRO.skip.drainSeconds * SIM_HZ + 1; i++) skip.update(DT);
    assert.equal(skip.progress, 0, 'soltar esvazia o anel');
    held = true;
    for (let i = 0; i < ARAUTO_INTRO.skip.holdSeconds * SIM_HZ + 1; i++) skip.update(DT);
    assert.equal(skip.done, true);
    const ops = [];
    const ctx = new Proxy({}, { get: (_, k) => (k in ops ? ops[k] : (...a) => ops.push(k)), set: () => true });
    skip.draw(ctx, { width: 1600, height: 900 }, 3, 108);
    assert.ok(ops.includes('arc') && ops.includes('fillRect'), 'desenha anel e tecla');
}

// --- Game: sala do golem abre a cena, não o intro genérico; E fica travado depois de pular ---
{
    const golem = create();
    const room = { hasPendingEnemies: true, _authoredEnemies: [{ type: 'flameGolem' }], spawnEnemies: () => [golem] };
    const { scene } = harness();
    let generic = 0;
    const keys = new Set(['e']);
    const game = Object.assign(Object.create(Game.prototype), {
        rooms: { current: room }, arautoIntro: scene,
        introSkip: new HoldToSkip({ isHeld: () => keys.has('e') }),
        _beginRoomIntro: () => generic++, players: [], p1: {}, p2: {},
        arautoEffects: { update() {} }, particleSystem: { update() {} }, _updateCameraToCurrentRoom() {},
        input: { keys, isDown: k => keys.has(k) }, _interactLatched: false
    });
    assert.equal(game._activateRoomEnemies(), true);
    assert.equal(generic, 0);
    assert.equal(scene.active, true);
    assert.equal(game._bossBarState(), null, 'sem barra de chefe na cena');
    keys.delete('e'); game._updateArautoIntro(DT);
    keys.add('e');
    for (let i = 0; i < ARAUTO_INTRO.skip.holdSeconds * SIM_HZ + 2 && scene.active; i++) game._updateArautoIntro(DT);
    assert.equal(scene.active, false, 'segurar E pula');
    assert.equal(golem.state, 'recover');
    game._maskLatchedInteract();
    assert.equal(keys.has('e'), false, 'E segurado fica fora do input');
    game._maskLatchedInteract();
    assert.equal(game._interactLatched, false, 'solto, o bloqueio acaba');
}

// --- expressões no boneco em campo ---
{
    const imgs = {};
    const assets = { get: k => (imgs[k] ??= { complete: true, naturalWidth: 64, key: k }), images: {} };
    const [p1] = new PlayerFactory({ assets, bloodCanvas: { palette: [] } }).create();
    assert.ok(p1.sprite.expressions?.raiva, 'sprite do jogo recebe as expressões');
    assert.equal(p1.sprite.expressions.raiva.img.key, 'player_01_expr_raiva');
}

console.log('Arauto intro: pose, faixas, remontagem, golpe, curta/completa, pular segurando E e expressões passaram.');
