# Editor 2.0 — escopo consolidado da demo

Status: planned — decisões Q1–Q26 aceitas; consolidação aguardando revisão final do usuário. Implementação não iniciada.
Base inspecionada: main, ad62c18. Data: 26/10/2026. Horários: America/Cuiaba.

## Objetivo e entregas

Permitir criar, preencher, conectar e jogar mapas completos no Editor 2.0, com salas de tamanhos diferentes, ferramentas do editor antigo e os objetos necessários ao percurso da demo. Preservar a organização atual: visão do mapa → abrir sala → editar ferramentas.

1. Entrega A: editor e integração no jogo verificados com um mapa pequeno de teste.
2. Entrega B: montar e verificar as sete salas do cronograma com as ferramentas entregues.

A escolha da câmera para jogadores muito afastados será feita após comparação jogável de três opções. Essa avaliação faz parte do escopo; nenhuma das opções está aprovada como solução final para esse caso.

## Fontes e contexto consultados

- Entrevista grill-me/grilling, decisões Q1–Q26 nesta conversa; decisões explícitas do usuário prevalecem sobre o cronograma.
- `AGENTS.md`, `.agents/skills/grilling/SKILL.md`, `.agents/skills/dungeon-chained-router/SKILL.md`.
- `.agents/context/architecture.md`, `conventions.md`, `status.md`, `systems/room-editor.md` e `.agents/tasks/README.md`.
- Inspeção delegada de `editor2.html`, `js/editor2/`, editor antigo, integração de salas, câmera, traps, props, progressão e assets do portão.
- Planejamento anterior: `.agents/tasks/2026-10-26-editor-v2/`.
- Referência fornecida pelo usuário: cronograma Demo Dungeon Chained v3, preservado em `cronograma-v3-referencia.md`. É referência de escopo e sequência, não evidência de funcionalidades implementadas.
- Graphify indisponível na exploração: usada leitura de código e contexto. Executar `npm run doctor` para diagnosticar o ambiente antes da implementação.

## Situação encontrada no código

O Editor 2.0 já permite criar, mover e redimensionar salas, editar tiles/colisão/buracos, colocar portas e props animados, desfazer/refazer, salvar/abrir e importar/exportar. O jogo ainda não carrega seu mapa completo. O teste atual converte apenas uma sala 14×9 para o formato antigo e perde propriedades.

O editor antigo tem inimigos, traps, spawns de teste, decoração estática e tochas. Sua distribuição aleatória não combina com edição manual e pode diferir entre preview e jogo. As novas regras aprovadas abaixo substituem essas limitações.

Dash existe no jogo, disponível com a corrente rompida, sem desbloqueio por altar. Não foram encontrados no código local: progressão compartilhada de habilidades/chave/pontes, altares, alavanca/ponte funcional, corda/chave funcional, serra lançável, portas condicionais funcionais, boss final e gatilho de conclusão. Sprites animados de chaves existem, mas não implementam coleta.

Essas constatações vieram de leitura de código. O jogo não foi executado nesta etapa de planejamento. Trabalho em outras branches deve ser reavaliado antes de implementar cada dependência.

## Requisitos aprovados

### Mapa, salas e integração

- Carregar no jogo o mapa completo salvo pelo Editor 2.0, sem a conversão limitada à sala antiga.
- Suportar dimensões individuais de sala, mantendo inicialmente o intervalo do editor: 5×5 a 40×30 tiles. O tamanho permitido não garante que a sala seja jogável.
- Escolher um mapa salvo como mapa principal da demo, usado ao iniciar uma partida normal.
- Validar o espaço real para a dupla, spawns e entradas. Permitir salvar rascunhos com erros, mas impedir testes que não possam iniciar ou entrar na sala com segurança.
- Destacar portas sem conexão, referências inválidas e salas inacessíveis. Diferenciar problemas de teste isolado dos de percurso completo.
- Preservar salvamento, importação/exportação, autosave e desfazer/refazer para os novos dados.
- Manter o editor antigo e seu fluxo de teste funcionando durante a migração.

### Câmera

- Escala de referência: enquadramento atual de uma sala 14×9 na mesma janela. Uma sala maior não reduz automaticamente essa escala apenas por ser maior.
- A câmera acompanha suavemente o ponto médio da dupla, limitada às bordas da sala; salas pequenas ficam centralizadas sem zoom adicional.
- Comparar, em sala grande e com a corrente rompida: (A) zoom fixo e indicadores fora da tela; (B) zoom-out para manter a dupla visível; (C) tela dividida.
- Avaliar os mesmos cenários: dupla próxima, afastamento em direções opostas, combate, buracos, aproximação das bordas, reencontro e transição por portas.
- A variante A é somente candidata de comparação. O usuário rejeitou adotá-la de imediato e solicitou testar as três.
- Registrar legibilidade, orientação dos jogadores, campo de visão, efeitos/luzes/HUD e desempenho. Escolha final após teste com a dupla; não apresentar uma hipótese como validada.

### Portas e conexões

- Modo “Conectar portas” na visão do mapa: miniaturas das salas com portas, clique na origem e no destino, linha representando o vínculo, seleção da linha para remover.
- Distinguir visualmente portas livres, conectadas e conexão selecionada.
- Conectar portas de quaisquer duas salas, independentemente de proximidade ou orientação. A posição da sala na grade organiza o mapa, mas não determina a ligação.
- Cada porta tem um único destino. Duas salas podem ter vários pares distintos de portas entre si.
- Conexão bidirecional por padrão; permitir mão única como exceção explícita.
- Uma porta ocupa um trecho contínuo da borda, com largura configurável e padrão de dois tiles. Não tratar cada tile da mesma passagem como porta independente.
- Dois jogadores devem atravessar juntos a mesma porta. Na chegada, posicionar ambos em local seguro junto à porta específica de destino, inclusive em conexões entre lados diferentes.
- Regra de sala: sempre aberta, derrotar todos os inimigos ou resolver botões co-op. Essa regra controla as saídas da sala.
- Condições adicionais de conexão: possuir chave ou habilidade. Satisfazer a regra da sala não dispensa o requisito particular da porta.
- Portão do boss inicialmente na parede norte, passagem de dois tiles, com a arte de `assets/doors`. A porta de destino é escolhida normalmente.
- Usar os quatro quadros de `boss-gate-opening-sheet-v1.png`. O arquivo é um rascunho RGBA 1254×1254, grade 2×2; exige recorte, ancoragem e verificação na escala do jogo. A moldura visual não deve alterar a largura atravessável.

### Ferramentas de sala

| Ferramenta | Comportamento aprovado |
|---|---|
| Spawns | Marcar P1 e P2 individualmente, com aviso para posições inválidas. |
| Inimigos | Reaproveitar inicialmente catálogo e colocação do editor antigo. |
| Piso | Sortear variações ao criar a sala usando conjunto de tiles próprios de chão, selecionável pelo autor. “Sortear chão novamente” preserva paredes, bordas, buracos e objetos. |
| Props | Decoração em camada própria sobre o piso; não substituir o tile de chão. Catálogo estático e animado, colocação manual e distribuição aleatória por densidade. |
| Sorteio de props | Resultado visível e salvo exatamente; “Sortear novamente” renova a distribuição gerada e preserva objetos manuais. Permitir ajuste manual após gerar. |
| Tochas | Reaproveitar tochas animadas de parede e candlesticks, com montagem e iluminação adequadas. |
| Traps | Seleção por imagem de spikes, arrow trap e botão co-op. Manter ajustes existentes de ritmo/atraso, direção/quantidade das fileiras e orientação de flechas. |
| Botões co-op | Um par válido, ativado simultaneamente pela dupla, resolve permanentemente o desafio naquela partida. As traps continuam ativas. Avisar se faltar um par válido. |

Piso e props sorteados persistem como resultado autoral: abrir, testar e jogar reproduz a mesma distribuição, sem novo sorteio no carregamento.

Props comuns continuam decorativos. Interatividade fica na categoria específica abaixo; a aparência de moeda, baú ou lança-chamas de um prop não implica recompensa ou dano.

### Interativos e progressão

- Categoria “Interativos” separada de decoração.
- Altares de Dash e Lançar Serra: jogador próximo usa ação de interação, com indicação na tela. Qualquer jogador pode ativar; desbloqueio compartilhado.
- Alavanca: ação de interação por qualquer jogador. Ligar visualmente à área de ponte desenhada sobre buracos. A ponte altera aparência e travessia e permanece ao revisitar.
- Corda/chave: configurar alvo com chave pendurada. A serra lançada corta a corda; chave cai, torna-se coletável por contato e concede progresso compartilhado.
- A chave libera o portão do boss e o atalho conforme as condições configuradas.
- Partida normal começa conforme o progresso inicial da demo: aquisição de habilidades ocorre nos altares. Opções de teste não alteram esse início.
- Manter inimigos derrotados e puzzles resolvidos ao voltar a uma sala. Reiniciar a partida ou o teste restaura o estado inicial correspondente.
- Respawn de inimigos é possibilidade futura, dependente de balanceamento, e não entra nesta entrega.

### Modos de teste

- “Testar sala”: inicia na sala aberta, nos marcadores P1/P2, como teste isolado.
- “Testar mapa”: começa na sala inicial e permite percorrer as conexões.
- Configurar independentemente Dash, Lançar Serra e chave disponíveis no início do teste. Novo teste sempre começa no estado escolhido, não no progresso do teste anterior.
- Ao entrar por uma porta durante a exploração, usar posições seguras junto à porta de destino, não os marcadores de teste da sala.
- Manter o mapa autoral separado do estado da partida; voltar ao editor não deve gravar inimigos mortos ou ponte ativada como nova configuração inicial.

## Percurso da demo e dependências

| Sala | Conteúdo e papel | Dependência principal |
|---|---|---|
| 1 Hub | Início, 2–3 inimigos comuns, saída oeste para Dash, leste para Abismo e norte para boss. | Portão condicionado à chave. |
| 2 Santuário do Dash | Combate, altar de Dash, buraco pequeno para ensinar rompimento e travessia. | Progressão e Dash já existente adaptado ao desbloqueio. |
| 3 Abismo | Buraco largo, travessia com Dash, alavanca do outro lado, ponte permanente para recuperar a serra. | Alavanca/ponte e consultas de chão atualizáveis. |
| 4 Arena | Combate com tanque, assassino e inimigo à distância. | Dependências de inimigos; primeira sala candidata a corte conforme cronograma. |
| 5 Lançar Serra | Altar, obstáculos e inimigos para ensinar lançamento/ricochete. | Mecânica de serra lançável. |
| 6 Chave | Corda cortável, chave coletável, poucos inimigos, atalho de mão única para Hub liberado pela chave. | Serra lançável, corda/chave, progresso e conexão condicional. |
| 7 Boss | Caveira de Fogo; vitória leva à tela de agradecimento. | Boss e fluxo de conclusão, tratados como dependências da demo. |

Fluxo de referência: Hub → Abismo (tentativa sem Dash) → Hub → Dash → Hub → Abismo/ponte → Arena → Lançar Serra → Chave → atalho → Hub → Boss → agradecimento.

Os detalhes de combate, sons, menu e tela final permanecem no cronograma de referência. Esta entrevista não os redefine nem presume que estejam implementados.

## Blocos de trabalho aprovados

1. Editor e integração: dados, tamanhos, conexões, câmera, ferramentas, salvamento e testes.
2. Progressão e interativos: altares, desbloqueios, condições, ponte/alavanca e corda/chave.
3. Dependências de combate: serra lançável, inimigos e boss, seguindo as frentes do cronograma.

O bloco 1 pode ser demonstrado com um mapa de teste. A entrega das sete salas jogáveis depende dos blocos 2 e 3; disponibilizar ferramentas sem execução correspondente não conclui a demo.

## Sequência proposta de implementação

Os arquivos abaixo são áreas de impacto, não uma decisão antecipada sobre a estrutura final. Antes de editar, consultar os documentos dos sistemas, ADRs e branches existentes. Trabalhar em branch de feature a partir de main e evitar duplicar trabalho das outras frentes.

| Etapa | Trabalho / áreas de impacto | Verificação de saída |
|---|---|---|
| 1 | Definir contrato de mapa para portas identificáveis, vínculos, conteúdo, spawns e condições. `js/editor2/MapModel.js`, `js/config/MapEditorConfig.js`, `serve.py`. Definir leitura dos mapas antigos sem perder dados. | Testes de normalização, serialização, vínculos, larguras, referências inválidas e retorno salvar/abrir. |
| 2 | Carregar mapa completo e dimensões individuais. `js/core/Dungeon.js`, `RoomTiles.js`, `js/rooms/Room.js`, `RoomManager.js`, `DungeonTileQuery.js`, integração em `js/Game.js`. | Três salas de tamanhos distintos navegáveis; paredes, buracos e spawns consistentes. |
| 3 | Editor de conexões e transições por porta. `editor2.html`, `css/editor2.css`, `js/editor2/MapEditorApp.js`, modelo e gestão de salas. | Dois caminhos entre o mesmo par de salas, conexão N→L, mão única, exclusão de vínculo e chegada correta. |
| 4 | Câmera com escala de referência; comparar as três variantes. `js/core/Renderer.js`, `js/Game.js`, `js/config/`, subsistema próprio quando necessário. | Comparação jogável documentada e escolha do usuário; luzes/HUD/efeitos coerentes com cada viewport. |
| 5 | Spawns, inimigos, pisos e props; reaproveitar editor antigo com separação de decoração. `js/editor2/`, `js/config/PropConfig.js`, `js/systems/SpawnSystem.js`, renderização e serialização. | Piso intacto sob props, sorteios persistentes, ajustes manuais preservados, inimigos/spawns iguais no teste. |
| 6 | Tochas, traps e travas de sala. `js/editor2/`, `js/systems/ChallengeCorridor.js`, `LightingRenderer.js`, renderização, configurações de gameplay. | Animação/luz, ajustes das traps, simultaneidade dos botões, trava liberada e traps ainda funcionando. |
| 7 | Progresso compartilhado, condições e portão. Subsistemas novos em `js/systems/`, `js/config/`, integração no Game, `js/core/AssetLoader.js`, arte em `assets/doors`. | Limpar Hub sem chave não abre portão; chave abre condição; mão única funciona; animação não muda colisão indevidamente. |
| 8 | Interativos autorais e execução: altares, alavanca/ponte, corda/chave. Editor, modelo e subsistemas de interação/progresso; serra lançável como dependência externa explícita. | Ação próxima, benefícios compartilhados, ponte transitável e persistente, corte somente pela serra lançada, coleta da chave. |
| 9 | Teste de sala/mapa, estados iniciais de teste, mapa principal e validações. Editor, modelo, gestão da partida e configuração de carregamento. | Teste reinicia limpo, presets não afetam partida normal, mapa selecionado inicia no navegador e no Electron. |
| 10 | Montar sete salas e verificar progressão completa. `map/demo/` e referência de mapa principal; integração com combate/conclusão. | Percurso completo com dois controles, revisitas sem respawn, vitória e agradecimento quando dependências entregues. |

Etapas de ferramentas podem avançar em paralelo às dependências quando houver contrato de dados acordado. Não usar a estimativa antiga de cinco horas do layout como estimativa para todo este escopo ampliado.

## Critérios de aceite

- [ ] Salvar, fechar e abrir reproduz salas, pisos sorteados, props, entidades, portas, condições e spawns.
- [ ] O mapa completo roda no jogo com salas menores e maiores que 14×9.
- [ ] A escala de referência não depende do tamanho da sala; afastamento extremo segue a opção escolhida após comparação.
- [ ] Duas portas distintas ligam as mesmas salas sem ambiguidade; ligações entre lados diferentes usam a chegada correta.
- [ ] Atravessar exige a dupla na mesma porta; chegada deixa os dois em chão seguro.
- [ ] Mão única e requisitos de habilidade/chave são respeitados junto das regras de sala.
- [ ] Portão norte de dois tiles usa a arte existente e abertura coerente com o desbloqueio.
- [ ] Props não substituem piso; sorteios não mudam ao testar/reabrir e preservam colocação manual.
- [ ] Inimigos, tochas, candlesticks e traps autorais aparecem e funcionam no jogo.
- [ ] Botões simultâneos resolvem a sala, permanecem resolvidos e não desligam traps.
- [ ] Altares, ponte e chave alteram progresso compartilhado; revisitar preserva o resultado.
- [ ] Cada teste começa com o estado escolhido; partida normal não herda os atalhos de teste.
- [ ] Rascunhos podem ser salvos; erros impeditivos de spawn/entrada recebem diagnóstico e bloqueiam teste pertinente.
- [ ] Mapa principal selecionado funciona também no build Electron.
- [ ] Demo completa verificada com a dupla, incluindo dependências de combate e conclusão.

## Prazo, riscos e limites

Prazo confirmado: encerramento de funcionalidades em 27/10/2026 às 22h; 28/10 para integração, playtest, correções e build; 29/10 para build final/ensaio, sem novas funcionalidades. O documento de origem prevê equipes/frentes, mas a entrevista não atribuiu pessoas nem verificou capacidade disponível. O prazo é uma restrição, não uma promessa de viabilidade.

Reestimar após revisão técnica das etapas 1–3 e alinhamento das dependências. O escopo cresceu em relação ao cronograma original, especialmente pelas salas variáveis, conexões livres, interativos autorais e comparação de câmeras. Não declarar a demo pronta com dependências substituídas por elementos apenas decorativos.

Ordem de corte de referência: inimigo voador → Arena → laser do boss → ricochete. Registrar impacto e alinhar qualquer corte antes de alterar requisitos aprovados. Não cortar silenciosamente mecânicas essenciais ao percurso, como serra lançável ou chave.

Fora desta entrega: respawn de inimigos, portão do boss lateral/sul, interatividade genérica para todo prop, editor genérico de scripts, migração para outra engine/editor. Recursos de produtividade não pedidos, como prefabs e rotação de salas inteiras, não foram adicionados ao escopo.

Questão deliberadamente adiada: escolha da câmera de afastamento extremo, decidida pelo experimento aprovado. Ajustes de parâmetros, bindings compatíveis e organização interna dos módulos são decisões de implementação a validar, não novos requisitos já aprovados.

## Verificação e documentação durante implementação

- Testes de lógica para modelo, vínculos, spawn seguro, progressão e persistência; testes manuais para canvas, câmera, luzes, controles e percurso.
- Executar testes direcionados, `npm run validate:map`, `npm run graph` e `npm run check`. Confirmar baseline: status.md lista falhas pré-existentes de mapa não indexado e teste Curva SE; não assumir que permanecem sem executar.
- Estender a validação do novo formato: a validação atual de peças não cobre automaticamente `map/demo/`.
- Usar `code-review` na implementação e registrar resultados em `review.md`; registrar comandos/observações reais em `verification.md`.
- Atualizar os documentos de sistemas tocados, `status.md`, glossário se houver novos termos e ADR quando houver decisão estrutural. Não atualizar contexto como se o plano já estivesse implementado.
- Preservar bootstrap mínimo, subsistemas com dependências injetadas, parâmetros em config, arte nítida e ausência de dependências npm de runtime.

## Próximo passo

Revisão final desta consolidação pelo usuário. Após confirmação de entendimento compartilhado, iniciar a preparação técnica/implementação do escopo por etapas, respeitando as dependências e o prazo. A entrevista não autoriza tratar itens planejados como concluídos.
