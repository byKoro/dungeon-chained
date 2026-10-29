# Cronograma — Demo Dungeon Chained v3 (até qui 29/10)

**Equipe:** 3 pessoas (A, B, C). **Janela:** sex 23/10 (tarde) → qua 28/10. Qui 29 = build final e ensaio, sem código novo.
**Capacidade:** 3 × ~8 h/dia × ~5,5 dias ≈ **130 h**. **P0 ≈ 104 h** → ~26 h de folga.

Mudanças desde a v2: **Magnetita removida**. O Abismo agora se resolve com **alavanca + ponte**. **Lançar Serra vem antes da chave** e é usado para pegá-la (**cortar a corda**).

O total de horas ficou parecido com a v2, porque a ponte e a corda entram no lugar da Magnetita. Mas são peças bem mais simples e com menos risco que a física de puxar a serra.

---

## 1. O mapa da demo (7 salas)

```
                         [7 BOSS]
                            │  portão do boss (trancado, visual diferente, abre com a chave)
 [2 DASH] ──────────── [1 HUB] ──── [3 ABISMO] ──── [4 ARENA] ──── [5 LANÇAR SERRA]
                            ▲                                             │
                            └────── atalho de mão única ── [6 CHAVE] ─────┘
```

| # | Sala | O que acontece | Inimigos |
|---|---|---|---|
| 1 | **Hub** | Início. Saídas: N = portão do boss (trancado), L = caminho "claro" (tochas, chama atenção), O = Dash. Ensina andar junto e a serra matar. | 2–3 comuns |
| 2 | **Santuário do Dash** | Combate + altar com **Dash**. Buraco pequeno para treinar: "arrebenta o cabo → Dash". | Assassino |
| 3 | **Abismo** | Buraco largo no meio. Sem Dash, o jogador volta. Com Dash: os dois arrebentam o cabo, cruzam com Dash, puxam a **alavanca** do outro lado → a **ponte** aparece → voltam pela ponte para buscar a serra. A ponte fica permanente (atalho). | — |
| 4 | **Arena** | Combate misto para usar o Dash em luta. **Primeira sala a cortar** se faltar tempo. | Tanque + Assassino + à distância |
| 5 | **Lançar Serra** | Altar com **Lançar Serra**. Inimigos atrás de obstáculos ensinam o ricochete. | Tanque, à distância |
| 6 | **Sala da Chave** | Chave pendurada por uma **corda**, fora do alcance. Lançar a serra na corda → a chave cai → os players pegam. Ao pegar: abre o atalho de volta para o Hub. | poucos, para não atrapalhar o puzzle |
| 7 | **Boss Caveira de Fogo** | Luta final. Ao vencer: **tela de agradecimento**. | Boss + invocações |

Salas limpas continuam limpas ao voltar (`Room.cleared` já persiste em `dungeon.cleared`), então o backtracking não ressuscita inimigos.

**Fluxo esperado:** Hub → Abismo (falha) → Hub → Dash → Hub → Abismo (ponte) → Arena → Lançar Serra → Chave → atalho → Hub → Boss → Agradecimento.

---

## 2. Divisão em 3 frentes

| Pessoa | Frente |
|---|---|
| **A** | Input, Dash, Lançar Serra, e as duas mecânicas que dependem da serra/Dash: **alavanca + ponte** e **corda + chave** |
| **B** | Inimigos (atributos + comportamentos) + Boss |
| **C** | Layout fixo, salas, portas/portão, altares, progresso, menu, tela final, sons |

---

## 3. Itens, prioridade e estimativa

| # | Item | Prio | Est. | Quem |
|---|---|---|---|---|
| 1 | Camada de ações de input por player (`e.code`; Dash no teclado e no controle) | P0 | 3 h | A |
| 2 | Remover reinício rápido (`R` global e A no game over) | P0 | 0,5 h | A |
| 3 | Dash (cambalhota, 1,5 tile, i-frames, cooldown, cruza buraco sem cair) | P0 | 6 h | A |
| 4 | Lançar Serra (estilingue, ricochete, desaceleração, dano em movimento) | P0 | 8 h | A |
| 5 | Alavanca + ponte (alavanca acionada por player; tiles de buraco viram ponte; permanente) | P0 | 4 h | A |
| 6 | Corda + chave (alvo que só a serra lançada corta; chave cai e é coletável) | P0 | 3 h | A |
| 7 | Atributos configuráveis de inimigo (`hp`, `speed`, `damage`, `attackCooldown`, `knockbackResist`) em `EntityConfig` + flash de dano | P0 | 4 h | B |
| 8 | Tanque e Assassino (comportamento por atributo, sprites prontos) | P0 | 4 h | B |
| 9 | Inimigo à distância (projétil + aviso) | P0 | 5 h | B |
| 10 | Inimigo voador (ignora buracos) | P1 | 4 h | B |
| 11 | Boss Caveira de Fogo (contato, teleporte L↔O, invocação, laser, HP, morte) | P0 | 16 h | B |
| 12 | Layout fixo da demo (substitui o `DungeonGraph`; `map/demo_layout.json` com células, salas e portas) | P0 | 5 h | C |
| 13 | Portas condicionais (habilidade, chave, mão única) + portão do boss com visual diferente e aviso "precisa da chave" | P0 | 5 h | C |
| 14 | Altares de habilidade + estado de progresso compartilhado (`{ dash, sawThrow, bossKey, bridges }`) + aviso na tela ao adquirir | P0 | 3 h | C |
| 15 | Montar as 7 salas no editor + `map/index.json` | P0 | 8 h | C |
| 16 | Menu inicial (Jogar / Controles / Volume) | P0 | 5 h | C (A ajuda) |
| 17 | Tela de agradecimento (texto + redes sociais + Steam, QR code) | P0 | 3 h | C |
| 18 | Sons: serra no inimigo, grunhido de dano (corrigir som duplicado, bug #9), Dash, lançamento, alavanca/ponte, chave, boss | P0 | 5 h | C |
| 19 | Playtest com 2 controles, balanceamento, correções | P0 | 12 h | todos |
| 20 | Build Electron (`npm run dist`) + teste na máquina do evento | P0 | 3 h | todos |
| 21 | Hot-swap / input independente do teclado | P2 | — | depois |
| 22 | Magnetita | P2 | — | depois |

**Carga P0:** A ≈ 24,5 h, B ≈ 29 h, C ≈ 34 h, conjunto ≈ 15 h. A termina antes e ajuda C no menu.

---

## 4. Sequência por dia

| Dia | A — habilidades e puzzles | B — inimigos/boss | C — mapa/fluxo | Entrega do dia |
|---|---|---|---|---|
| **Sex 23** | #1 input, #2 remover reinício | #7 atributos de inimigo | #12 layout fixo (esqueleto) | Bind do Dash lido; inimigos com HP |
| **Sáb 24** | #3 Dash | #8 Tanque/Assassino, #9 início | #12 fim, #13 portas | Dash jogável; Hub navegável |
| **Dom 25** | #4 Lançar Serra | #9 fim, #11 boss: estados, teleporte, contato | #14 altares e progresso, #15 início | Serra lançável; habilidades adquiríveis |
| **Seg 26** | #5 ponte, #6 corda/chave | #11 boss: laser + invocação | #15 montar as 7 salas | **Checkpoint:** demo jogável de ponta a ponta com placeholders. Decide P1. |
| **Ter 27** | #16 menu (com C) | #11 boss: HP, morte, tuning; P1 #10 | #17 tela final, #18 sons | **Feature freeze às 22h** |
| **Qua 28** | #19, #20 | #19, #20 | #19, #20 | `.exe` portátil testado em outra máquina |
| **Qui 29** | ensaio + backup | ensaio | ensaio | Sem código novo |

Cada frente no seu branch, merge pequeno e diário na `main`. Cada feature num subsistema próprio (ADR 0002).

---

## 5. Especificação técnica resumida

Todos os números em `js/config/` (ADR 0003).

**Input (#1, #2)**
- Os binds novos usam `e.code`, porque o `e.key` atual não distingue Ctrl esquerdo de direito.
- Dash: P1 `KeyF` / P2 `ControlRight` / controle **A (0)**. Controle 0 = P1, controle 1 = P2.
- Reinício: sai o `R` global e o A no game over. Ficam o RESTART do pause e o botão da tela de morte (Start ou clique), porque o pause não abre no game over.

**Dash (#3)** — `DASH = { distanceTiles: 1.5, durationFrames, iFrames, cooldownSeconds: 3 }`. Só com o cabo desconectado. Não cai em buraco durante o Dash, mas tem que **terminar em chão firme** (se o destino for buraco, encurta ou bloqueia). Não atravessa paredes. Animação procedural (pulo + rotação) se não houver sprite de cambalhota.

**Lançar Serra (#4)** — `SAW_THROW = { launchSpeed, friction, minSpeed, bounceDamping, damage }`. Disparado no `onSnap` do `Chain`; direção = movimento médio dos players ou última direção da serra. Ricochete em `room.wallBoxes`. Para em chão firme (se parar sobre buraco, volta para o ponto válido mais próximo, como o `resolveDropPoint` já faz).

**Alavanca + ponte (#5)** — reaproveita o padrão de botões do `ChallengeCorridor`. A peça de sala declara `bridge: { lever: {x,y}, tiles: [...] }`. Ao acionar, os tiles de buraco viram ponte no `DungeonTileQuery` (sem queda) e no render. O estado entra no progresso, então a ponte continua lá ao voltar.

**Corda + chave (#6)** — alvo com `hitRadius` que só reage à serra **em voo** (`thrown && speed > minSpeed`). Visual: chave pendurada no alto, com corda e sombra. Enquanto pendurada não é coletável; cortada, cai com uma animação curta e vira coletável. Coletar marca `bossKey = true`.

**Inimigos (#7)** — `ENEMY_TYPES[tipo] = { hp, speed, damage, attackCooldown, knockbackResist, hitRadius }`. Cada acerto tira `sawDamage`, com flash e i-frame curto.

**Boss (#11)** — `BOSS_SKULL = { hp, contactDamage, teleportInterval, laserWindup, laserDuration, laserThicknessTiles: 1.5, summonInterval, summonCount, summonPool, animSpeed }`. Estados: `idle → teleport → summon | laser (aviso antes) → idle`.

**Tela final (#17)** — overlay DOM como o `#death-screen`. Para o evento, **QR code** (imagem) funciona melhor que link. No Electron, links abrem com `shell.openExternal`.

---

## 6. Riscos e ordem de corte

| Risco | Mitigação |
|---|---|
| Boss atrasar | Se na segunda o laser não estiver pronto, o boss sai com teleporte + invocação. |
| Ricochete instável | `friction` alto; em último caso, sem ricochete. |
| Jogador não entender o Abismo | Placa com ícone de Dash no Abismo; no Santuário do Dash, um buraco pequeno ensinando "arrebenta → Dash". |
| Jogador não acertar a corda | Corda com área de acerto generosa; posicionar a chave alinhada com uma parede para o ricochete ajudar. |
| Controle do evento diferente | Testar na quarta com os controles que vão ao evento. |

**Ordem de corte:** #10 voador → sala 4 Arena → laser do boss → ricochete.

---

## 7. Decisões em aberto

1. Quem é A, B e C?
2. Horas reais por dia de cada um.
3. Links de redes sociais / Steam (placeholder até quarta).
4. Hardware do evento: quantos controles, de que tipo, PC Windows?
