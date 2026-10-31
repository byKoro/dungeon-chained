# Botas room: floating boots pickup grants dash + 5 anvil upgrades + entry cinematic + tutorial card

Status: done
Branch: feat/cage-visual-editor  Date: 2026-10-31

## Goal
Na sala "botas" (cel 0,1): uma bota flutua sobre a bigorna (visual da serra-na-bigorna).
Ao entrar, a câmera faz um tour (baús → bota) e volta. Chegar perto da bota (sem botão)
coleta: pop de game-feel, concede o dash (state.dash=true), some a bota, e salta uma
telinha curta ensinando o dash. A bigorna da botas passa a oferecer 5 melhorias novas de
dash/jogador (compradas com sucata, revertidas pela morte-na-sala; a bota volta no reset total).

## Decisões (grill, respondidas pelo usuário)
- 5 receitas novas em FORGE.recipes (ids em inglês, rótulos pt-BR i18n). Bigorna da botas lista só elas.
- Sem pré-requisito. Dash só funciona depois de pegar a bota (pegar a bota liga state.dash).
- moveSpeed "Passo veloz" 3 níveis 15/30/50 (+8%/nível, via speedScale compartilhado).
- dashPush "Impacto" 2 níveis 20/40 (knockback sem dano).
- coopHeal "Vínculo" 2 níveis 40/70 (cura 1 vida DOS DOIS após 6s/4s de proximidade; cd 8s; pausa se separar/tomar dano).
- dashCooldown "Fôlego" 2 níveis 20/40 (-25%/-45% em cooldownSteps).
- dashCharges "Pés ligeiros" 2 níveis 35/70 (+1 carga/nível; recarrega no cooldown; respeita o tether).
- Bota = item flutuante sobre a bigorna (não altar). Coleta por proximidade (~88px, um jogador, sem botão).
- Pop: flash/sparks/zoom-punch/shake + som reaproveitado; concede dash; abre menu. Uma vez por run via completed.
- Morte na sala (0 vidas) reseta a sala toda: a bota volta e o dash re-trava; a dupla volta ao início DA SALA (ADR 0014).
- BotasRoomScript novo (ROOM_SCRIPTS.botas) conduz tour de câmera (cameraFocus/clear) e o pickup.
- Telinha: card no canvas (estilo painel da forja), ícone de botão por dispositivo, some em ~4s/no 1º dash, sem pausar. Ensina só o dash.

## Steps
- [ ] 1. Config das 5 receitas (ForgeConfig) + i18n (pt-BR/en) rótulos e descrições + card text.
- [ ] 2. Efeitos no jogador: speedScale (moveSpeed), dash cooldown (dashCooldown), dash charges (dashCharges) em Player + PLAYER config; aplicar em _applyPlayerUpgrades (Game) a partir do ForgeState.
- [ ] 3. Empurrão do dash (dashPush): knockback sem dano quando jogador em dash encosta inimigo (Game/_updateGameplay).
- [ ] 4. Cura cooperativa (coopHeal): sistema pequeno (CoopHeal) atualizado no gameplay.
- [ ] 5. Prop boots + placeholder PNG (scripts/gen-boots.py); bota flutuante sobre a bigorna + coleta por proximidade + concessão do dash (BotasRoomScript + BootsPickup helper, modelado no DemoProgress._drawKey/_celebrateKey e no _sawOnAnvil).
- [ ] 6. Cinemática de entrada (BotasRoomScript): tour cameraFocus baús→bota→volta, uma vez por run.
- [ ] 7. Telinha de tutorial do dash (AbilityCard UI) + ícone por dispositivo (InteractPrompt sheet).
- [ ] 8. Map: inicial.json botas anvil recipes = 5 novas; adicionar prop boots sobre a bigorna.
- [ ] 9. Testes + Electron smoke + docs (weapons.md/players-and-chain.md/rooms-and-maps.md, status.md, ADR se estrutural).

## Docs
- [ ] systems/weapons.md (forja: nova categoria de upgrades de jogador), players-and-chain.md (dash charges/cooldown/speed/push, coopHeal), rooms-and-maps.md (sala botas: bota, cinemática, card)
- [ ] status.md ; ADR novo se a categoria "upgrades de jogador na forja" for estrutural o suficiente
