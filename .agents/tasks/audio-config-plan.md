# Implementation Plan — AudioConfig.js (configuração de som por efeito)

Objetivo: criar um único `js/config/AudioConfig.js` editável à mão, onde cada som
tem `files` (lista de variações), `volume` (padrão), `rate` (fixo ou `[min,max]`
aleatório) e um `MASTER_VOLUME` global. O `AudioManager` passa a resolver os
padrões a partir do config; os call sites deixam de carregar números mágicos.

Fatos confirmados na exploração:
- `js/Game.js` é o ÚNICO importador de `AUDIO_CLIPS` (grep em `js/**/*.js`).
- `Game.js` vive em `js/`; importa `GameConfig` como `./config/GameConfig.js`,
  logo o novo import é `./config/AudioConfig.js`.
- Não existe `js/config/AudioConfig.js` ainda (sem conflito de nome).
- Projeto é ES modules no browser, sem bundler/npm, sem framework de teste.
  Verificação disponível: `node --check <arquivo>` (Node v24 presente) + grep.
- 7 call sites de `audio.play` confirmados: Game.js L409, CombatSystem.js
  L35/L40/L42/L43/L65, ParticleEffects.js L72.

Decisões de design (minhas, registradas aqui):
- `rate` como número OU `[min,max]` conforme o briefing; conversão
  `base + rand*span` -> `[base, base+span]`.
- `MASTER_VOLUME` é multiplicador global aplicado no `AudioManager.play`, com
  clamp final 0..1 no volume. Mantenho `setMasterVolume(v)` (nice-to-have barato).
- Precedência: `override.volume ?? config.volume`; `override.rate ?? resolve(config.rate)`.
  Isso preserva a capacidade de override por chamada exigida no briefing.
- Fallback do AudioManager quando um som não tem config/variantes: retorna em
  silêncio (igual ao comportamento atual com nome desconhecido).

Ordem é por dependência: criar o config (1) → reescrever o manager (2) →
religar o Game (3) → remover a fonte antiga (4) → limpar os call sites (5) →
verificação final (6). Após cada passo o código fica em estado carregável.

- [ ] 1. Criar `js/config/AudioConfig.js` com `MASTER_VOLUME` (default 1.0) e
      `AUDIO_CONFIG` keyed por nome de som. Cada entrada: `files` (mover as listas
      de paths do antigo `AUDIO_CLIPS`, mesmos caminhos exatos, mantendo os
      geradores `.map`), `volume` (valor do call site atual) e `rate`
      (número fixo ou `[min,max]`). Converter os `base + Math.random()*span`:
        - playerHurt: volume 0.75, rate [0.9, 1.1]
        - monsterHurt: volume 0.58, rate [0.85, 1.05]
        - playerStep: volume 0.35, rate [0.92, 1.08]
        - enemyStep: volume 0.32, rate [0.68, 0.76]
        - enemyAttack: volume 0.45, rate [0.85, 1.0]
        - enemyAttackVoice: volume 0.3, rate [0.85, 1.0]
        - pickup: volume 0.65, rate [0.95, 1.05]
      Incluir cabeçalho em Português explicando cada campo (files = trocar/
      adicionar/remover variações; volume = mais alto/baixo; rate = velocidade,
      número fixo ou [min,max] para variação aleatória; MASTER_VOLUME =
      multiplicador global). Estilo: 4 espaços, aspas duplas, comentários conciso.
      Files: js/config/AudioConfig.js
      Verify: `node --check js/config/AudioConfig.js` → sem erro de sintaxe
      (saída vazia, exit 0).

- [ ] 2. Reescrever `js/core/AudioManager.js`: construtor
      `constructor(config, masterVolume = 1)`. Pré-carregar `Audio` de cada
      `entry.files` (mesma lógica atual de `preload = "auto"`) e guardar por som
      `{ variants, volume, rate }`. Guardar `this.masterVolume = masterVolume`.
      `play(name, overrides = {})`: se o som é desconhecido ou sem variantes,
      retornar em silêncio. Resolver
      `vol = clamp((overrides.volume ?? cfg.volume) * this.masterVolume, 0, 1)`;
      `rate = overrides.rate ?? (Array.isArray(cfg.rate) ? rand(min,max) : cfg.rate)`.
      Manter EXATAMENTE o clone/overlap: `template.cloneNode()`, `currentTime = 0`,
      `this.active.add`, listener `ended` `{ once: true }` e `.catch` que remove do
      set. Adicionar `setMasterVolume(v)` que faz `this.masterVolume = clamp(v,0,1)`.
      Files: js/core/AudioManager.js
      Verify: `node --check js/core/AudioManager.js` → exit 0.

- [ ] 3. Religar `js/Game.js`: remover `AUDIO_CLIPS` do import de
      `./config/GameConfig.js` (L27) e adicionar
      `import { AUDIO_CONFIG, MASTER_VOLUME } from './config/AudioConfig.js';`.
      Trocar a construção para `this.audio = new AudioManager(AUDIO_CONFIG, MASTER_VOLUME);`
      (L84). Simplificar o pickup em `_updateHearts` (L409) para
      `this.audio.play("pickup");` (sem objeto de opções).
      Files: js/Game.js
      Verify: `node --check js/Game.js` → exit 0; e
      `grep -n AUDIO_CLIPS js/Game.js` não retorna nada.

- [ ] 4. Remover o export `AUDIO_CLIPS` e seu comentário "Áudio" agora obsoleto de
      `js/config/GameConfig.js` (bloco ~L117-129). Não tocar em mais nada do
      arquivo. (Já confirmado que Game.js era o único importador; nenhum outro
      arquivo precisa de ajuste.)
      Files: js/config/GameConfig.js
      Verify: `node --check js/config/GameConfig.js` → exit 0; e
      `grep -rn AUDIO_CLIPS js/` não retorna nenhuma linha.

- [ ] 5. Limpar os 6 call sites restantes para `this.audio.play("<name>")` sem o
      objeto de opções, preservando guardas e lógica em volta:
        - js/combat/CombatSystem.js L35 → `playerHurt` (manter `if (this.audio)` externo)
        - js/combat/CombatSystem.js L40 → `enemyStep` (dentro do `if (this.audio)`)
        - js/combat/CombatSystem.js L42 → `enemyAttack`
        - js/combat/CombatSystem.js L43 → `enemyAttackVoice`
        - js/combat/CombatSystem.js L65 → `monsterHurt` (manter `if (this.audio)`)
        - js/systems/ParticleEffects.js L72 → `playerStep` (manter o bloco de
          cooldown `footstepSoundCooldown` intacto; só remover o objeto de opções)
      Files: js/combat/CombatSystem.js, js/systems/ParticleEffects.js
      Verify: `node --check js/combat/CombatSystem.js` e
      `node --check js/systems/ParticleEffects.js` → ambos exit 0.

- [ ] 6. Verificação final de integração. Rodar `node --check` em todos os
      arquivos tocados e confirmar que não restou nenhum número mágico de áudio
      nos call sites.
      Files: (nenhuma alteração; só verificação)
      Verify:
        - `node --check js/config/AudioConfig.js js/core/AudioManager.js js/Game.js js/config/GameConfig.js js/combat/CombatSystem.js js/systems/ParticleEffects.js` → tudo exit 0.
        - `grep -rn "AUDIO_CLIPS" js/` → vazio.
        - `grep -rEn "audio\.play\([^)]*\{" js/` → vazio (nenhum play() ainda
          carrega objeto de opções inline).
      Nota: por ser browser/canvas sem test runner, não há suíte automatizada;
      a verificação de runtime é abrir `index.html` no navegador e confirmar que
      os sons tocam (fora do escopo deste plano automatizado).

## Lacunas / suposições
- Sem test framework no projeto; verificação limita-se a `node --check` + grep,
  conforme o briefing pediu. Teste de áudio real exige o navegador.
- Mantidos os caminhos de asset idênticos; nenhum arquivo de áudio renomeado.
- `enemyStep` e `playerStep` continuam apontando para os mesmos
  `footstep-stone-0{1..6}.ogg` (duplicação intencional preservada do original).
