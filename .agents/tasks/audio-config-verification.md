# Verification — AudioConfig.js (configuração de som por efeito)

## Alterações
- **Novo** `js/config/AudioConfig.js`: exporta `MASTER_VOLUME` (1.0) e `AUDIO_CONFIG`
  keyed por som; cada entrada tem `files`, `volume`, `rate` (número ou `[min,max]`).
  Cabeçalho em Português explicando cada campo.
- **Reescrito** `js/core/AudioManager.js`: `constructor(config, masterVolume = 1)`,
  pré-carrega os `Audio` de `entry.files`, guarda `{ variants, volume, rate }`.
  `play(name, overrides = {})` resolve `volume = clamp01((override ?? cfg) * master)`
  e `rate = override ?? (array ? rand[min,max] : número)`. Clone/overlap/`.catch` e
  nome desconhecido → silêncio mantidos iguais. Adicionado `setMasterVolume(v)`.
- **Game.js**: removido `AUDIO_CLIPS` do import de `./config/GameConfig.js`; adicionado
  `import { AUDIO_CONFIG, MASTER_VOLUME } from './config/AudioConfig.js';`.
  `new AudioManager(AUDIO_CONFIG, MASTER_VOLUME)`. Pickup → `this.audio.play("pickup")`.
- **GameConfig.js**: removido o export `AUDIO_CLIPS` e o comentário "Áudio" obsoleto.
- **CombatSystem.js / ParticleEffects.js**: 6 call sites simplificados para
  `this.audio.play("<name>")` sem objeto inline; guardas e cooldown preservados.

## Comandos e saída

`node --check` em cada arquivo (exit 0 em todos; `node --check` aceitou os
import/export, então nenhum temp .mjs foi necessário):

```
node --check js/config/AudioConfig.js        -> exit 0
node --check js/core/AudioManager.js         -> exit 0
node --check js/Game.js                      -> exit 0
node --check js/config/GameConfig.js         -> exit 0
node --check js/combat/CombatSystem.js       -> exit 0
node --check js/systems/ParticleEffects.js   -> exit 0
```

Grep de `AUDIO_CLIPS` em `js/`: **nenhuma ocorrência**.

Grep de objeto de opções inline `audio.play(... {`: **nenhuma ocorrência**.

## Call sites finais de `audio.play(`
- `js/Game.js:410` — `this.audio.play("pickup")`
- `js/combat/CombatSystem.js:35` — `this.audio.play("playerHurt")`
- `js/combat/CombatSystem.js:40` — `this.audio.play("enemyStep")`
- `js/combat/CombatSystem.js:42` — `this.audio.play("enemyAttack")`
- `js/combat/CombatSystem.js:43` — `this.audio.play("enemyAttackVoice")`
- `js/combat/CombatSystem.js:65` — `this.audio.play("monsterHurt")`
- `js/systems/ParticleEffects.js:72` — `this.audio.play("playerStep")`
- (`js/core/AudioManager.js:39` — `audio.play()` interno do HTMLAudioElement, não é call site de efeito)

## Notas
- Projeto é browser/canvas sem test runner: verificação é `node --check` + grep.
  Teste de áudio em runtime exige abrir `index.html` no navegador.
- Caminhos de asset idênticos; nenhum arquivo de áudio renomeado.
