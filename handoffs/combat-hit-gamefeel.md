# Implementação: game-feel ao acertar inimigos com a serra

## Objetivo

Fazer cada acerto da serra parecer claro, pesado e legível. O som e a reação do inimigo são os sinais principais; flash, partículas, dano flutuante e hit stop reforçam o contato.

Esta é a primeira parte do trabalho de game-feel. Trabalhe apenas na resposta dos inimigos a dano causado pela serra. O feedback de quando os jogadores recebem dano, Dash, lançamento da serra, câmera, mobs novos e mapas serão tratados em etapas separadas.

## Decisões de design

- Inimigos comuns morrem com um acerto.
- Inimigos fortes têm mais vida e precisam de vários acertos.
- Um acerto confirmado em inimigo forte interrompe sua ação, aplica um breve atordoamento e o empurra para longe do ponto de impacto.
- Inimigos fortes acumulam poise. Acertos normais causam stagger curto; romper a poise causa um atordoamento mais longo e vulnerabilidade temporária. Poise é invisível; a reação e a janela vulnerável comunicam a quebra.
- Todo acerto confirmado mostra um número de dano flutuante. O número sobe e desaparece rapidamente, em espaço de mundo.
- Usar um flash branco/vermelho curto, partículas direcionais de faísca e sangue/poeira no ponto de contato e tremor de câmera moderado. A morte mantém os efeitos atuais de sangue, gibs e gore.
- Hit stop deve durar entre 0,02 e 0,10 s (aproximadamente 2–6 frames a 60 Hz). A câmera continua renderizando durante a pausa.
- Não usar APIs de Unity/Godot como `Time.timeScale`: o jogo é JavaScript + Canvas, com simulação fixa a 60 Hz e `GameLoop` próprio.

## Estado atual relevante

- `CombatSystem.resolveWeaponHits()` identifica contatos entre inimigo, cabo e disco da serra. Hoje chama `takeHit()`, `monsterHurt`, tremor, sangue no centro do inimigo e o callback de abate.
- `MeleeEnemy.takeHit()` aplica dano, usa `hitTimer` e começa a morte quando a vida chega a zero; ainda não há reação de stagger/poise.
- `sawHit` já tem três variações e é o som principal de confirmação do golpe.
- `monsterHurt` está desativado e não tem arquivos de áudio. Não o habilite vazio nem substitua o som da serra por um arquivo sem relação. Se não houver um efeito adequado já no projeto, deixe registrado que falta um asset de ferimento e mantenha `sawHit` como confirmação sonora.
- Referência sonora desejada pelo usuário: a Whirligig Saw de *Bloodborne*. Use como direção para a sensação de uma serra pesada, giratória e áspera mordendo o alvo; não extraia nem inclua o áudio do jogo. Prefira uma fonte original ou um asset com licença documentada. A camada de contato deve soar mecânica e serrilhada, com peso grave e uma textura curta de corte no impacto, sem virar um whoosh de espada.
- Abates já acionam câmera lenta por `GameLoop.triggerHitSlowmo()`. O hit stop novo deve se compor com ela sem estender indefinidamente nem cancelar a pausa normal do jogo.
- `ParticleSystem` já oferece faíscas, flashes e sangue. Reaproveite essas APIs.

## Comportamento esperado

1. Em cada contato válido, aplique dano uma única vez, respeitando a invulnerabilidade/cooldown já existente. Não crie partículas, números ou sons repetidamente a cada frame enquanto a serra permanecer encostada.
2. Calcule um ponto de impacto coerente: use a posição do disco quando ele acerta; no cabo, use o ponto mais próximo do inimigo no segmento. Não altere as regras de colisão nesta tarefa.
3. No impacto, toque `sawHit`, provoque flash por 0,05–0,10 s, emita partículas direcionais e mostre o número real do dano.
4. Se o alvo sobreviver, interrompa imediatamente wind-up, ataque ou recuperação. Entre num estado de hurt/stagger, aplique knockback breve e depois retome a perseguição. O movimento não deve atravessar paredes nem empurrar o inimigo para fora da sala.
5. Em inimigos fortes, reduza poise a cada golpe aceito. Ao quebrar, reinicie a poise, aplique uma janela maior de stun/vulnerabilidade e uma reação visual/sonora mais forte. Evite barra de poise visível nesta etapa.
6. Se o golpe matar, a animação de morte prevalece sobre hurt/stagger. Preserve sangue, gibs, gore e câmera lenta de abate existentes; o hit stop deve acontecer antes/de forma compatível com essa câmera lenta.
7. O hit stop pausa apenas a simulação pelo tempo configurado em tempo real. `requestAnimationFrame` e renderização seguem ativos para a câmera e os efeitos visuais. Uma pausa do usuário continua pausada depois que o hit stop termina.

## Escopo técnico

Leia `AGENTS.md`, `combat-and-entities.md`, `weapons.md`, `visual-effects.md`, `audio.md` e as skills do projeto `game-feel`, `audio-design` e `game-ai`, incluindo seus `PROJECT-NOTES.md`.

Áreas prováveis de alteração:

- `js/combat/CombatSystem.js` — ponto de impacto, resposta de acerto e eventos de dano/abate.
- `js/entities/MeleeEnemy.js` — estados hurt/stagger, interrupção da ação, knockback e poise.
- `js/core/GameLoop.js` — pausa curta da simulação baseada em tempo real, sem parar renderização nem conflitar com pause/slow-mo.
- `js/Game.js` — conectar o evento de impacto ao hit stop e ao feedback já existente, se necessário.
- `js/config/*` — duração do flash, hit stop, knockback, poise e janelas de stagger; não espalhar números de ajuste pelo código.
- `js/particles/*` — adicionar o efeito de dano flutuante se não houver um subsistema adequado. Mantê-lo em espaço de mundo e limpá-lo junto com efeitos da sala/partida.
- `js/config/AudioConfig.js` — alterar apenas se houver um asset apropriado já disponível; não adicionar dependências de runtime.

Use classes/sistemas existentes sempre que possível. Mantenha `js/main.js` como bootstrap. Não adicione engine, bundler ou dependências de runtime.

## Fora do escopo

- Alterar os sprites ou a lista de mobs do editor. O tanque já foi escolhido como Cavaleiro Negro B, mas o restante do catálogo será decidido depois.
- Mudar HP, velocidade ou dano dos mobs além do necessário para expor poise de forma configurável.
- Ajustar o feedback de dano recebido pelos jogadores ou corrigir sons duplicados de dano do jogador; isso será a próxima etapa.
- Alterar as regras de colisão da serra, Dash, lançamento da serra, câmera, armadilhas, editor de sala, puzzles ou mapas.
- Extrair, copiar ou distribuir o áudio proprietário de *Bloodborne*. Se faltar um asset original/licenciado apropriado, registrar a dependência no relatório em vez de usar um rip.

## Critérios de aceitação

- Um inimigo comum recebe um único acerto, mostra feedback de contato e morre pelo fluxo atual.
- Um inimigo forte sobrevive aos primeiros acertos; cada acerto desconta a vida corretamente, interrompe sua ação, aplica atordoamento/empurrão e mostra o dano real.
- A poise acumulada quebra no limite configurado e produz um stun maior; o inimigo não fica preso permanentemente em hurt.
- Acertos repetidos não duplicam feedback durante o cooldown nem permitem dano durante a invulnerabilidade de hit.
- O ponto de impacto acompanha o disco ou o segmento do cabo de forma coerente.
- Hit stop fica no intervalo especificado, mantém câmera/renderização ativas e respeita pause e slow-mo de abate.
- Nenhum áudio vazio/desativado é tratado como se tivesse tocado; `sawHit` continua sendo a confirmação sonora.
- Sem erros novos no console e sem regressões visíveis na cadeia de combate.

## Validação e relatório

- Siga as instruções atuais de teste e definição de pronto em `AGENTS.md`; não tente corrigir falhas de base que já estejam registradas em `status.md`.
- Exercite no jogo pelo menos: um acerto que mata inimigo comum, vários acertos em inimigo forte, quebra de poise, morte durante hit stop, pause/resume e acertos rápidos em sequência.
- Informe os arquivos alterados, comandos executados, o que foi observado no jogo e qualquer som/assets que ainda faltem. Não afirme validação manual que não foi feita.
