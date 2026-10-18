# Merge branch-rodrigo → main: portar Áudio + Drop de Vida para a arquitetura refatorada

## Contexto do merge (JÁ EM ANDAMENTO — não iniciar outro merge)

Um `git merge` de `branch-rodrigo` em `main` já está em curso no repositório
`c:\Users\Usuario\Desktop\dungeon-chained`. Estado:

- Base comum: `2665bbe` (main.js monolítico antigo).
- `main` (HEAD) REFATOROU o monólito em `js/Game.js` + subsistemas (tileset,
  iluminação, pós-processamento, corredores-desafio, queda em buracos,
  transição entre salas). O `js/main.js` virou um bootstrap de ~20 linhas.
- `branch-rodrigo` MANTEVE o monólito e adicionou features DENTRO dele:
  AudioManager, HeartPickup (drop de vida), configs de inimigos melee, ajustes
  de serra.
- O git auto-resolveu tudo LIMPO exceto **`js/main.js`** (conflito frontal
  bootstrap vs. monólito). Arquivos já staged pelo merge: `js/core/AudioManager.js`
  (novo), `js/entities/HeartPickup.js` (novo), `js/core/DungeonGraph.js` (mod),
  `js/entities/MeleeEnemy.js` (mod), `js/weapons/SawWeapon.js` (mod),
  `js/weapons/Weapon.js` (mod), e os assets de áudio em `assets/audio/`.

## Decisão do usuário

**Opção A:** manter a arquitetura refatorada (`Game.js` + subsistemas) E PORTAR
as features do rodrigo (áudio + drop de vida) para dentro do PADRÃO do projeto
(subsistemas, NÃO reintroduzir o monólito). "Atualizar o sistema de áudio com o
padrão do projeto."

NÃO reverter o refactor. NÃO deixar AudioManager/HeartPickup como código morto.

## Resolução do conflito em js/main.js

Resolver o conflito mantendo **o lado HEAD** (o bootstrap que importa `Game` e
`RoomCatalog`, chama `roomCatalog.load()` e `game.start()`). Descartar
totalmente o lado do branch-rodrigo (o monólito). O conteúdo correto final de
`js/main.js` é exatamente o bloco entre `<<<<<<< HEAD` e `=======`:

```js
import { Game } from './Game.js';
import { RoomCatalog } from './rooms/RoomCatalog.js';

/**
 * main.js — ponto de entrada. Carrega o catálogo de peças autorais (/map) e
 * então monta e inicia o jogo. Toda a lógica vive em ./Game.js e subsistemas.
 */
async function bootstrap() {
    const canvas = document.getElementById("gameCanvas");
    const roomCatalog = new RoomCatalog();
    await roomCatalog.load();
    const game = new Game(canvas, { roomCatalog });
    game.start();
}
bootstrap();
```

Remover TODOS os marcadores de conflito (`<<<<<<<`, `=======`, `>>>>>>>`).

## Porte 1 — AudioManager para o padrão do projeto

`js/core/AudioManager.js` já veio com o merge e NÃO precisa mudar de API:
`new AudioManager(clips)` e `audio.play(name, { volume, rate })`.

O padrão do projeto é: subsistemas instanciados no construtor de `js/Game.js`,
constantes de tuning em `js/config/GameConfig.js`, assets centralizados em
`js/core/AssetLoader.js`. Seguir esse padrão:

1. **Config de áudio em `js/config/GameConfig.js`**: adicionar um export
   `AUDIO_CLIPS` (ou similar) com o mapa de caminhos que o monólito do rodrigo
   usava. Valores exatos extraídos do main.js do branch-rodrigo:
   ```js
   export const AUDIO_CLIPS = {
       playerHurt: [1,2,3,4,5,6].map(i => `assets/audio/player-hurt-${String(i).padStart(2,"0")}.wav`),
       monsterHurt: [1,2,3].map(i => `assets/audio/monster-hurt-0${i}.ogg`),
       playerStep: [1,2,3,4,5,6].map(i => `assets/audio/footstep-stone-0${i}.ogg`),
       enemyStep:  [1,2,3,4,5,6].map(i => `assets/audio/footstep-stone-0${i}.ogg`),
       enemyAttack: [1,2,3].map(i => `assets/audio/enemy-attack-0${i}.wav`),
       enemyAttackVoice: [1,2,3].map(i => `assets/audio/monster-attack-0${i}.ogg`),
       pickup: ["assets/audio/item-pickup.flac"]
   };
   ```
   IMPORTANTE: confira os nomes/extensões reais em `assets/audio/` (listado no
   file tree): player-hurt-01..06.wav, monster-hurt-01..03.ogg,
   footstep-stone-01..06.ogg, enemy-attack-01..03.wav, monster-attack-01..03.ogg,
   item-pickup.flac. O padrão `0${i}` só funciona para i=1..9 (ok aqui).

2. **Instanciar em `js/Game.js`**: no construtor, `this.audio = new AudioManager(AUDIO_CLIPS)`
   (importar AUDIO_CLIPS do GameConfig e AudioManager de `./core/AudioManager.js`).
   Passar `this.audio` para os subsistemas que precisam dele (ver abaixo).

3. **Pontos onde o som toca** (no monólito do rodrigo, portar para os
   subsistemas correspondentes do refactor):

   - **playerStep**: tocado quando `player.justStepped`. Hoje
     `ParticleEffects.handleStep(player)` já reage a `player.justStepped`. Opção
     limpa: passar o `audio` ao `ParticleEffects` (via construtor) e tocar
     `playerStep` lá, OU tocar em `Game._updateGameplay` logo após
     `this.effects.processPlayer(pX)` checando `pX.justStepped`. Volume ~0.35,
     rate 0.92 + random*0.16. Respeitar o cooldown do rodrigo
     (`footstepSoundCooldown`): ele decrementava por frame e só tocava quando
     <= 0, setando 7 (correndo) ou 10. Replicar esse cooldown.

   - **playerHurt**: no monólito tocava dentro do callback de dano do inimigo:
     `e.update([p1,p2], (hitPlayer) => { ...; if (hitPlayer) audio.play("playerHurt", {volume:0.75, rate:0.9+random*0.2}); ... })`.
     No refactor isso vive em `js/combat/CombatSystem.js` → `updateEnemies`, no
     mesmo callback onde já faz `triggerShake(14)` e `triggerBlood`. Passar
     `audio` ao CombatSystem (construtor) e tocar `playerHurt` quando `hitPlayer`.

   - **monsterHurt**: tocado quando um inimigo começa a morrer. No refactor,
     `CombatSystem.resolveWeaponHits` chama `enemy.startDying()`. Tocar
     `monsterHurt` ali (volume ~0.58, rate 0.85 + random*0.2).

   - **enemyStep**: quando `e.justStepped` (volume ~0.32, rate 0.68 + random*0.08).
     Portar para `CombatSystem.updateEnemies` (itera os inimigos).

   - **enemyAttack** + **enemyAttackVoice**: quando `e.justAttacked`
     (enemyAttack volume ~0.45 rate 0.85+random*0.15; enemyAttackVoice volume
     ~0.3 mesmo rate). Também em `CombatSystem.updateEnemies`.

   - **pickup**: quando um player coleta um HeartPickup (ver Porte 2). Volume
     ~0.65, rate 0.95 + random*0.1.

   Valores exatos de volume/rate estão no main.js do branch-rodrigo
   (`git show MERGE_HEAD:js/main.js`). Preservá-los.

   NOTA autoplay: AudioManager cria `new Audio()` no construtor; o navegador só
   permite tocar após gesto do usuário. O jogo começa com clique/tecla, então ok;
   não adicionar lógica extra de desbloqueio a menos que detecte erro no teste.

## Porte 2 — Drop de vida (HeartPickup) para o padrão do projeto

`js/entities/HeartPickup.js` já veio com o merge (API: `new HeartPickup(x,y)`,
`.update()`, `.draw(ctx)`, `.radius`, campos x/y). `js/core/DungeonGraph.js` já
valida os campos autorais `heartCount` e `heartDropChance` (0..10 e 0..100).

No monólito do rodrigo o estado da sala guardava `hearts: []` e:
- Ao entrar numa sala de combate custom, criava `heartCount` corações
  espalhados: `new HeartPickup(cx + (rand-0.5)*180, cy + (rand-0.5)*120)`.
- Ao um inimigo explodir em gibs, com chance `heartDropChance/100` (default 40%)
  dropava `new HeartPickup(enemy.x, enemy.y)`.
- No loop: cada heart `.update()`, e qualquer player com `lives < 3` e distância
  <= `heart.radius + player.hitRadius` coleta: `collector.lives = min(3, +1)`,
  toca `pickup`, remove o heart.
- No render: desenhava os hearts no chão (sob as entidades).

Portar para o PADRÃO (o estado de sala vive em `js/rooms/Room.js`):

1. **`js/rooms/Room.js`**: adicionar `this.hearts = []` no construtor. Em
   `populate(...)`, após gerar inimigos, se `this.cell.heartCount` for inteiro
   (vem do editor via DungeonGraph), criar essa quantidade de HeartPickup
   espalhados pelo centro da sala (usar `this.bounds` para cx/cy). Expor um
   método `addHeart(x, y)` e/ou `removeHeartAt(i)`. Importar HeartPickup.
   O campo `heartDropChance` fica no `cell` (ex: `this.cell.heartDropChance`).

2. **Drop na morte**: em `js/combat/CombatSystem.js` → `resolveDeaths(room, gibs)`,
   quando um inimigo vira gib, calcular
   `const dropChance = Number.isFinite(room.cell.heartDropChance) ? room.cell.heartDropChance/100 : 0.40;`
   e com `Math.random() < dropChance` chamar `room.addHeart(enemy.x, enemy.y)`.
   (Checar como `room` expõe a cell; `Room` tem `this.cell`.)

3. **Coleta + update + render**: em `js/Game.js`:
   - `_updateGameplay`: iterar `room.hearts`, `.update()` cada um, detectar
     coleta pelos dois players (lives < 3, distância), aplicar cura, tocar
     `pickup` via `this.audio`, remover o heart coletado.
   - `_render`: desenhar `room.hearts.forEach(h => h.draw(ctx))` na camada de
     CHÃO (depois do `drawFloor`/effects, antes/junto dos props do desafio e
     ANTES das entidades/sombras). Seguir onde o rodrigo desenhava (sob as
     entidades, sobre o piso).

   Observação: no refactor, `room` = `this.rooms.current`. Pegar a sala atual
   uma vez por frame.

## Verificação (OBRIGATÓRIA antes de concluir)

Este é um jogo HTML/JS estático (sem build). Verificar assim:

1. **Sanidade de módulos**: garantir que não restou nenhum import de
   `./core/AudioManager.js` ou `./entities/HeartPickup.js` em `js/main.js`
   (eles NÃO pertencem ao bootstrap). Confirmar que `js/Game.js` importa ambos
   corretamente e que não há marcadores de conflito em nenhum arquivo
   (`grep -rn "<<<<<<<\|>>>>>>>\|=======" js/`).
2. **Lint/parse**: rodar `node --check` em cada arquivo JS modificado
   (`node --check js/Game.js`, `js/main.js`, `js/rooms/Room.js`,
   `js/combat/CombatSystem.js`, `js/config/GameConfig.js`,
   `js/systems/ParticleEffects.js` se tocado) para pegar erros de sintaxe.
   `node --check` NÃO resolve imports ESM, mas valida sintaxe — suficiente aqui.
3. **Verificação em runtime (navegador)**: se houver um servidor estático
   disponível, servir a pasta e abrir `index.html`. Confirmar no console que não
   há erro de módulo (404 de áudio, import quebrado). Verificar que:
   - o jogo carrega e roda (sala inicial renderiza);
   - sons de passo/dano/morte tocam (após o primeiro gesto);
   - uma sala com `heartCount` mostra corações no chão e colhê-los cura (lives
     não passa de 3);
   - inimigos ocasionalmente dropam coração ao morrer.
   Se não for viável abrir navegador no ambiente, documentar isso claramente e
   confiar nos passos 1–2 + leitura cuidadosa, SEM alegar que o runtime foi
   validado.

## NÃO fazer

- NÃO rodar `git commit` nem `git merge --abort`. Deixar o merge resolvido mas
  NÃO commitado — o orquestrador/usuário faz o commit final após revisão.
- NÃO reintroduzir o monólito do main.js.
- NÃO alterar a API pública de AudioManager/HeartPickup (vieram prontos).
- NÃO tocar nos arquivos de assets de áudio (já staged).
