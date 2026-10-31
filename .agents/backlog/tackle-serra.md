# Habilidade: tackle e lançamento da serra

Especificação consolidada da entrevista de design com o usuário. Documento para implementação posterior pelo Claude. Nenhum código do jogo foi alterado nesta discussão.

## Intenção

Com a corrente desconectada, um jogador usa dash para colidir com a serra solta. Ele interrompe o deslocamento, assume uma pose de tackle com quadro de impacto e uma pequena reação para trás. Um hit stop curto reforça o contato. A serra é lançada na direção do dash, com assistência moderada de mira e rastro de vento. Ao encontrar um inimigo, prende-se nele girando rapidamente e soltando faíscas, aplica vários acertos e depois continua seu percurso. Paredes produzem quiques de sinuca. A serra tenta terminar próxima do ponto de lançamento.

Este documento trata de uma habilidade do jogo, não de uma skill de instruções do Codex. O usuário pediu encerrar a entrevista e documentar. Os valores e detalhes ainda não definidos estão separados das decisões aprovadas.

## Ativação e tackle

- Corrente desconectada, serra presente e solta no chão: qualquer jogador pode ativar ao colidir com ela durante um dash.
- Não exige botão adicional.
- Durante o voo, a serra também aceita um novo tackle por colisão com um dash.
- Enquanto presa em um inimigo, não aceita tackle nem reconexão. Essa é a decisão final da Q19 e prevalece sobre qualquer proposta anterior.
- Cada dash só pode produzir um tackle, evitando repetição no mesmo contato.
- O jogador para seu avanço na colisão, fica próximo ao ponto de lançamento e sofre uma pequena reação para trás.
- Criar idealmente uma animação própria de tackle, com pose de contato e impact frame bem legíveis, distinta da animação comum de dash.
- Hit stop local inicial de aproximadamente 60 ms, ajustável: congela somente o jogador que colidiu e a serra. O parceiro e os inimigos continuam se movendo.
- Após o hit stop, a serra parte na direção registrada pelo dash.
- A duração da reação do jogador e o tratamento de sua invulnerabilidade após interromper o dash ainda não foram definidos; não presumir invulnerabilidade longa ou dash extra gratuito.

## Direção e aim assist

- Direção base: direção do dash individual que atingiu a serra.
- Corrigir moderadamente uma única vez por lançamento, em direção a um inimigo à frente, sem parede no caminho.
- Não selecionar alvos ao lado ou atrás de forma que descaracterize a direção escolhida pelo jogador.
- Sem perseguição automática do inimigo durante o voo de ataque.
- Novo tackle aplica novamente assistência de mira.
- Ângulo máximo, distância de busca, força de correção e desempate de alvos não receberam números aprovados. Expor em configuração e ajustar por testes, mantendo assistência mediana.

## Voo e quiques

- Rastro de vento comunica velocidade; rotação rápida comunica corte.
- Colisões com paredes refletem a direção como sinuca, mantendo o percurso.
- A serra pode atravessar buracos enquanto voa; ao cair precisa terminar em piso seguro.
- Não ultrapassar limites da sala/mapa nem atravessar paredes.
- O trajeto normal é baseado em quiques que acabam trazendo a serra perto da origem. Não usar como regra principal a proposta anterior de “atingir uma distância e então virar para voltar”; o usuário a substituiu pela ideia dos quiques.
- Após algum tempo, aplicar uma correção suave em direção à origem, sem apagar a sensação dos quiques.
- Ao passar perto da origem, encerrar o voo e soltar a serra no chão.
- Se obstáculos impedirem a volta, procurar contorno e manter resposta de quique ao colidir. Evitar insistir indefinidamente na mesma parede.
- Ter duração máxima; se não conseguir retornar, cair em piso seguro.
- Origem é o ponto fixo do lançamento, não a posição atual do jogador. Se o jogador sair dali, a origem não o acompanha.
- Velocidade, restituição, momento de iniciar correção, força de correção, raio de chegada e duração máxima devem ser configuráveis; valores finais não foram definidos.

## Prender e causar múltiplos hits

- Ao atingir um inimigo elegível, a serra prende no contato, gira rapidamente e solta faíscas.
- O inimigo continua seus movimentos e ataques; a serra acompanha o ponto de contato. Inimigos comuns mantêm as reações normais ao dano.
- Aplicar dano real, não apenas efeitos visuais.
- Quantidade configurável para testar explicitamente **5 ou 10 hits**.
- Intervalo inicial aprovado: **0,1 segundo entre acertos**, ajustável.
- Dano por acerto também configurável.
- Contar acertos efetivamente aceitos, não tentativas recusadas pelo cooldown do inimigo.
- Primeiro impacto versus primeiro tick ainda não recebeu uma regra separada: evitar dano extra silencioso além do total configurado.
- Se o inimigo morrer antes de completar a quantidade, soltar imediatamente e continuar o percurso.
- Depois dos hits, continuar na direção em que vinha, exceto pela regra especial do Arauto abaixo.
- Pode prender e aplicar a sequência em vários inimigos ao longo do trajeto, mas apenas uma vez por inimigo por lançamento, incluindo a volta.
- Um novo tackle começa um novo lançamento e permite atingir novamente inimigos já processados no lançamento anterior.
- Não alterar a frequência de dano das demais formas de usar a serra para viabilizar esta habilidade.

## Regra especial: Arauto das Brasas

- A serra pode atingir e ficar presa na superfície do Arauto, aplicando os hits sem atravessar seu corpo sólido.
- O Arauto continua agindo durante o contato; a serra acompanha a superfície.
- Após os hits, padrão: **retorno direto à origem**, sem procurar novos alvos e sem assistência de mira nessa volta.
- Respeitar paredes nessa volta. Se uma parede bloquear o retorno direto, quicar e usar o comportamento normal de retorno para tentar chegar à origem.
- Fornecer opção de configuração alternativa: **após os hits, cair no chão junto ao ponto de contato**, em posição segura, em vez de voltar.
- As duas opções são para comparação em testes; retorno direto é o padrão aprovado.
- Não aplicar dano novamente aos inimigos já processados no mesmo lançamento. O retorno especial não deve buscar novos alvos.
- Elegibilidade do Arauto durante salto/invulnerabilidade não foi redefinida; respeitar estados válidos do combate existente e documentar o tratamento.

## Ataques do Arauto lançam a serra solta

- Pancada parada (`attack2` na fase 1) e impacto de aterrissagem do salto na fase 2 lançam a serra se ela estiver solta no chão dentro da área do golpe.
- O lançamento ocorre no impacto, não no aviso.
- Direção radial, afastando-se do centro do impacto.
- Serra lançada pelo boss gira, cruza buracos e quica em paredes.
- Continua causando dano apenas em inimigos; não causa dano nos jogadores.
- Os jogadores podem interceptá-la em voo com tackle ou reconectá-la nas condições normais.
- A decisão só abrange serra solta no chão: não arrancar da corrente conectada nem interromper uma serra presa em inimigo por suposição.
- A origem/destino de retorno desse lançamento pelo boss não foi definido expressamente. O executor precisa explicitar a escolha: retornar ao ponto de onde a serra foi deslocada pode reduzir o efeito de afastá-la. Não atribuir ao usuário uma preferência que ele não declarou.
- Caso a serra esteja exatamente no centro do impacto, definir direção de fallback estável; sem vetor inválido ou comportamento aleatório não documentado.

## Reconexão e re-tackle

| Estado da serra | Reconexão | Tackle |
| --- | --- | --- |
| Solta no chão | Condições normais existentes | Sim, com dash |
| Em voo de ataque/quiques | Sim | Sim, com dash |
| Retornando em voo | Sim | Sim, com dash |
| Presa em inimigo aplicando hits | **Não** | **Não** |
| Conectada aos jogadores | Fluxo normal da corrente | Esta habilidade não ativa |

- Reconexão em voo exige a condição normal de proximidade dos dois jogadores com a serra.
- Ao reconectar, encerrar imediatamente o voo e retomar o comportamento normal da corrente.
- Se reconexão e tackle válido coincidirem, tackle tem prioridade.
- Re-tackle substitui a direção pela do novo dash, reaplica impacto/hit stop/assistência e registra nova origem no ponto da colisão.
- Reiniciar os registros de inimigos atingidos do lançamento anterior no re-tackle.
- A proposta de bloquear interações durante todo o voo foi rejeitada. A proposta de permitir interações enquanto presa também foi rejeitada.

## Máquina de estados sugerida para orientar a implementação

`solta → impacto do tackle → voo → presa aplicando hits → voo/retorno especial → solta`

Durante voo/retorno: pode reconectar ou receber novo tackle. Durante presa: aguarda completar hits ou morte/invalidação do alvo. Retorno e queda precisam garantir piso seguro. Esta divisão é orientação técnica, não exigência de nomes de classes ou estados.

## Configurações necessárias

- Quantidade de hits, com teste de 5 e 10.
- Intervalo de hits (início em 0,1 s) e dano por hit.
- Hit stop local (início em aproximadamente 60 ms).
- Aim assist: cone, alcance e força máxima.
- Voo: velocidade, quique/restituição, duração máxima.
- Retorno normal: início e intensidade da correção, raio de chegada.
- Arauto: retorno direto ou queda no local após hits; padrão retorno direto.
- Impulso recebido da pancada e do salto do Arauto.
- Ajustes visuais da reação, rastro, faíscas e sons, seguindo padrões do projeto.

## Base técnica verificada — somente leitura

Repositório: `C:\Users\RodrigoYamauchi\Documents\Github\dungeon-chained`.

- `DroppedSawPush` já trata empurrão na serra desconectada/solta. Dash forte dá um chute curto com feedback, mas não transforma a serra em ataque. A nova habilidade precisa substituir/coordenar essa resposta, sem aplicar impulso duplicado.
- `ThrownSaw` já existe para lançamento ao romper o cabo com melhoria `sawThrow`, usando a soma de velocidades dos jogadores. A habilidade proposta usa a direção do jogador que dá tackle; não confundir os gatilhos nem substituir silenciosamente o lançamento antigo.
- O lançamento atual já usa subpassos e quica em paredes/limites, atravessa buracos em voo e usa queda segura ao parar.
- Ainda não existe retorno à origem, aim assist ou etapa presa. O lançamento atual tenta dano apenas uma vez por inimigo.
- Arauto no chão atualmente rebate a serra por seu corpo sólido. A habilidade precisa de tratamento explícito para prender na superfície sem atravessar.
- Arauto tem cooldown de dano de 5 passos, aproximadamente 83 ms. Conferir a compatibilidade dos hits de 0,1 s e contar os realmente aceitos.
- Reconexão atualmente é bloqueada enquanto a serra está lançada; a nova regra exige permitir durante voo e bloquear somente na etapa presa.
- Jogador arrastando serra não pode dash. Não foi solicitado mudar esse impedimento.
- Não foi encontrada animação específica de tackle nos trechos examinados; não alegar que já existe arte pronta.

Esses fatos foram apurados por leitura de código, com apoio de um subagente de exploração conforme a skill de entrevista. Nenhum teste ou playtest da nova habilidade foi executado.

## Integração com o design do boss discutido antes

- Esta habilidade não deve reinstalar um contador de hits para ativar pancada do Arauto.
- No design anterior, pancada da fase 1 responde a 2 segundos contínuos de proximidade dos jogadores, independentemente de hits; fase 2 não tem sistema de pressão.
- Os ataques do boss continuam escolhidos pela situação, sem ciclo fixo entre tipos.
- A especificação completa anterior está no documento separado `arauto-comportamento-para-claude.md`.

## Pontos não fechados: finalizar com escolhas explícitas

O usuário pediu encerrar a entrevista. Estas lacunas não devem ser apresentadas como respostas já aprovadas:

1. Dano inicial por hit e números exatos do voo/assistência/retorno.
2. Origem e retorno da serra impulsionada pelo boss.
3. Cooldown próprio da habilidade ou somente cooldown normal do dash. **Desbloqueio revisto em 2026-10-31** (`.agents/tasks/2026-10-31-tackle-unlock/`): o tackle passou a ser a receita grátis "Investida" da bigorna da Penhasco; nos mapas do Editor 2.0 fica travado até pegar, com telinha de tutorial ao pegar. Ver `systems/weapons.md`.
4. Reação se os dois jogadores derem tackle simultaneamente: escolher uma regra determinística, sem dois lançamentos no mesmo passo.
5. Feedback para tentativa de tackle/reconexão durante a etapa presa.
6. Limite de espera quando o alvo não aceita mais dano, torna-se invulnerável ou inválido: não deixar a serra presa indefinidamente tentando completar hits.
7. Transições de sala, morte, pausa e reinício devem encerrar/limpar estados com segurança, seguindo o jogo existente.
8. Proteção do jogador na curta reação de tackle e cooldown após interromper o dash.
9. Arraste durante voo não foi explicitamente aprovado; manter restrito a serra no chão, salvo nova decisão.

## Critérios de aceitação e testes

- Dash normal sem tocar a serra permanece normal; contato caminhando não dispara a habilidade.
- Ambos os jogadores podem lançar serra solta com a direção do próprio dash.
- Um dash não gera vários tackles no mesmo contato.
- Hit stop local não pausa o parceiro nem os inimigos.
- Aim assist ajuda dentro do cone, não mira atrás e não atravessa paredes para escolher alvo.
- Movimento rápido usa detecção contínua/subpassos para não atravessar inimigos ou paredes sem colisão.
- Inimigo recebe exatamente o total configurado de acertos aceitos, salvo morte/invalidação; testar 5 e 10.
- Serra acompanha inimigo móvel; morte antecipada libera imediatamente.
- Vários inimigos podem receber a sequência, uma vez por lançamento; volta não repete alvos processados.
- Arauto recebe hits na superfície e retorna direto; alternativa cai em piso seguro junto ao contato.
- Pancada e aterrissagem do Arauto lançam serra no chão no impacto; não lançam durante o aviso e não ferem jogadores com a serra.
- Quiques preservam sensação de sinuca, com chegada perto da origem ou queda segura por limite de duração.
- Reconexão e re-tackle funcionam durante voo e retorno; tackle vence conflito com reconexão.
- Enquanto presa, ambos são bloqueados e não cortam os hits restantes.
- Re-tackle redefine origem/direção e libera novos hits contra alvos do lançamento anterior.
- Buracos podem ser cruzados em voo, nunca usados como posição final insegura.
- Testar quinas, corredores, vários quiques, dois tackles simultâneos, mudança de sala e inimigo que morre ou fica inválido.
- Validar visualmente animação de tackle, impact frame, rastro de vento, rotação e faíscas. Ajustar intensidade sem esconder os avisos dos inimigos.

## Instruções ao implementador

Ler `AGENTS.md`, `.agents/skills/dungeon-chained-router/SKILL.md` e os contextos de jogadores/corrente, armas, combate e efeitos visuais. Respeitar arquitetura, configurações centralizadas e workflow de verificação do repositório. Usar testes relevantes e playtest; não alegar comportamento observado apenas com leitura de código. Evitar alterar frequência de dano de outras formas de ataque ou implementar mecânicas extras não solicitadas.
