# Kiro — evolução do Arauto das Brasas

Data: 2026-10-28
Projeto: Dungeon Chained
Tipo: instrução de implementação, não script de shell.

## Como executar

Abra este repositório no Kiro e envie:

> Leia AGENTS.md e execute a implementação descrita em .agents/design/demo/kiro-arauto-das-brasas.md. Preserve as alterações locais existentes e cumpra os critérios de aceitação. Implemente apenas este escopo.

Este arquivo autoriza a implementação pelo Kiro. Na sessão que criou este documento, somente o documento deve ser escrito; não aplicar estas mudanças ao jogo automaticamente.

## Objetivo e decisões aprovadas

Evoluir o flameGolem existente para o chefe **Arauto das Brasas**:
1. Receber dano sem stagger, interrupção, empurrão ou hit stop local.
2. Dobrar seu tamanho visual.
3. Ter 100 HP e uma barra de chefe na parte inferior da tela.
4. Na fase 2, substituir o golpe de área por três saltos consecutivos com slam, em direção aos jogadores.
5. Morrer apenas com a animação da spritesheet, mais lenta, sem desmembramento; manter os escombros.
6. Disponibilizar vida infinita para ambos os personagens no editor e no teste, preservando impactos e quedas.

Nome aprovado: **Arauto das Brasas**.
Os slams avançam em direção aos players, não acontecem todos no mesmo lugar.
Vida infinita não significa ignorar colisões, dano visual, empurrões ou quedas.

## Antes de editar

- Leia AGENTS.md, dungeon-chained-router e os documentos de arquitetura, convenções, status, players-and-chain, combat-and-entities, rendering e ui.
- Aplique game-ai e game-ui-ux com seus PROJECT-NOTES. Use o fluxo de tarefa e revisão do repositório.
- Inspecione git status e o diff atual. Há trabalho anterior sem commit de cinemáticas, golem e do mapa feito pelo usuário. Não descartar, sobrescrever nem incluir indiscriminadamente em commits.
- Consulte graphify conforme AGENTS.md. Se indisponível, use documentos e busca, registre a limitação.
- A sala do usuário foi encontrada em map/demo/demo_campaign.json, chave 0,0, com nome santuario_teste.json. Confirme o estado atual antes de usar: não é necessariamente um arquivo separado.
- Confira o desenho atual dos botões e HUD antes de implementar a barra.
- Complete um plan.md com arquivos afetados e verificações antes das alterações.

## Estado existente — conferir no checkout

- js/config/FlameGolemConfig.js centraliza sprite e ajustes.
- js/entities/FlameGolemEnemy.js estende MeleeEnemy; SpawnSystem cria a subclasse.
- Há golpe normal, área com empurrão e investida com marcação, atraso e tracking.
- A fase 1 tem uma investida; a fase 2 tem duas e acelera movimento/animações.
- A PNG assets/enemies/flame_golem.png tem flash na linha 1, caminhada na 2, ataques nas 3/4/5 e morte na 6. Índices zero-based: 0,1,2,3,4,5.
- Game chama drawAttackEffect no passe de chão. Player.takeDamage aceita knockback opcional.
- MeleeEnemy.takeHit com informação de impacto causa stagger. CombatSystem/Game também acionam feedback e congelamento local. Não basta alterar um único atributo para eliminar todas as interrupções.
- CombatSystem.resolveDeaths remove o inimigo e gera gibs após readyToGib.
- O editor 2.0 passa opções de teste por sessionStorage em ContentTools.playtest.
- Quedas retiram vidas diretamente em Game._resolveFall; proteger somente Player.takeDamage não basta.
- Referência de estilo existente: docs/references/santuario-style-reference.png, se disponível. docs/ é ignorado pelo Git; o código e os componentes atuais são a referência efetiva.

## Implementação por etapas

### 1. Resistência e escala

Concluir quando:
- O arauto perde HP e mantém o flash de acerto, mas não entra em hurt/stunned nem sofre empurrão ou hit stop local ao receber golpes.
- Dano durante windup, salto, slam e investida não cancela nem reinicia a habilidade.
- O congelamento usado no spawn e a pausa continuam funcionando.
- Outros inimigos preservam stagger, poise, empurrão e hit stop.
- O sprite inteiro e seus efeitos ficam com o dobro da escala visual atual. O drawHeight anterior era 123; ponto inicial: 246.
- Não dobrar automaticamente colisão, alcance e área. Manter ajustes separados e verificar o espaço real na arena de 6 × 6 tiles.

Prefira uma opção explícita por inimigo ou um ponto de extensão pequeno; não espalhe exceções por nome do chefe em vários sistemas. Inspecione também a chamada de freezeOnHit feita pelo orquestrador.

### 2. Vida e fases

- Configurar 100 HP.
- Usar 50 HP como limiar inicial da fase 2; é um valor provisório de balanceamento.
- A transição é permanente, ocorre uma única vez e não restaura HP.
- Preservar uma investida na fase 1 e duas na fase 2.
- Preservar os multiplicadores configuráveis de movimento, animações e investida.
- Definir transição segura durante uma habilidade: concluir a execução atual e aplicar a nova sequência na próxima oportunidade, sem teleportes, dano duplicado ou reinício inesperado.
- A morte sempre prevalece sobre qualquer transição.

### 3. Barra de chefe

- Texto: Arauto das Brasas, ao lado da barra.
- UI em coordenadas de tela, na parte inferior, respeitando os retratos e corações dos dois jogadores.
- Inspecionar e reutilizar a linguagem de PixelButton, PixelFont, FRAME/FACES, PauseScreen e TrailerOverlay: contorno pixelado, relevo, pedra/metal e preenchimento vermelho escuro.
- Não instanciar um botão interativo para representar a vida. Reutilizar estilos/primitivas de desenho quando adequado.
- Novo componente pequeno, construído por Game, sem comportamento em main.js.
- Mostrar durante o encontro ativo; atualizar corretamente com todo dano aceito, inclusive serra lançada.
- Pausa, resize e zoom não devem deslocar ou deformar a barra.
- Ao morrer, apresentar HP zero durante a animação de morte e ocultar ao final.
- Reinício e mudança de sala não podem deixar barra antiga.
- Não criar barra para os golems de cenas roteirizadas do trailer.
- Validar 16:9, janela menor e proporção estreita; texto e barra sem sobreposição com o HUD.

### 4. Três saltos com slam na fase 2

- Preservar o golpe de área único da fase 1.
- Na fase 2, o mesmo slot de habilidade passa a executar três saltos/impactos.
- Antes de cada salto, selecionar um jogador vivo e não caindo. Alternar entre os dois quando possível; se houver apenas um alvo válido, reutilizá-lo. Sem alvos, encerrar a sequência de forma segura.
- Cada impacto tem uma posição marcada e oportunidade de reação. Fixar a posição de aterrissagem antes da descida; não seguir continuamente o jogador ao aterrissar.
- O próximo salto pode selecionar uma nova posição. Não fixar todos os impactos na posição inicial.
- Só aterrissar em piso seguro, dentro da arena, fora de paredes e abismos. Usar consultas existentes e resolver posição próxima válida quando necessário.
- Separar posição física no chão de altura visual do salto: a marcação fica no chão e o sprite sobe/desce.
- Enquanto no ar, não causar dano de contato nem acertos de slam antecipados.
- Usar a animação existente de golpe de chão, sem gerar arte nova, coordenando o quadro de impacto com a aterrissagem.
- Cada slam causa dano de área e empurrão radial forte a ambos os jogadores alcançados, no máximo uma vez por jogador por impacto. Invulnerabilidade existente continua sendo respeitada.
- Depois do terceiro impacto, abrir uma recuperação maior antes da próxima habilidade.
- Expor quantidade de slams, windup, tempo e altura do salto, raio de impacto, knockback, velocidade da animação e recuperação final.
- Pausa congela trajetória e marcações; morte cancela a sequência; receber dano não a interrompe.
- Não alterar os atributos do Dash dos players.

### 5. Morte e escombros

- Sem explodeIntoGibs, fragmentos, lançamento de pedaços ou pacote de sangue de desmembramento para este chefe.
- Tocar todos os quadros da última linha da PNG. Não substituir por flash branco.
- Usar velocidade de morte própria, desacoplada da aceleração da fase 2. Sugestão inicial de tuning: 12 ticks por quadro; ajustar após inspeção.
- A partir de HP zero: sem ataques, marcações ofensivas, movimento, colisão ou novos acertos recebidos.
- Ao concluir a animação, manter o último quadro como escombros decorativos no mundo, com posição, escala, orientação e ordenação de profundidade corretas.
- Separar o cadáver da lista de inimigos vivos. Não manter a sala bloqueada pelo cadáver e não deixar o encontro sem conclusão.
- Não repetir recompensa, remoção, evento de morte ou limpeza a cada frame.
- Limpar os escombros no reinício. Pode limitar sua permanência à sala atual; não criar persistência em disco.
- Outros inimigos mantêm o fluxo de morte existente.

### 6. Toggle de vida infinita para testes

- Adicionar controle visível no editor 2.0 junto das opções de teste.
- Transportar a escolha ao abrir Testar sala ou Testar mapa.
- Disponibilizar também toggle dentro do modo de teste, para ligar/desligar sem reabrir o editor.
- Reutilizar o estilo e os mecanismos de foco/input existentes. Mostrar claramente ON/OFF.
- Aplicar aos dois players. Padrão desligado; não ativar no jogo normal por acidente.
- Ao sofrer um acerto: preservar flash, reação, invulnerabilidade e knockback, sem descontar vida.
- Player.takeDamage deve continuar indicando acerto aceito para permitir som, efeitos e controle de um acerto por habilidade.
- Ao cair: preservar a animação, queda da serra conforme regra atual e respawn seguro; não descontar vida.
- Não repor corações continuamente a cada frame como substituto da regra de dano.
- Desligar o toggle restaura dano normal; reiniciar o teste aplica o estado selecionado sem afetar partidas normais.
- Se houver suporte ao editor antigo, preservar seu fluxo; não quebrar sua inicialização ao adicionar controles exclusivos do editor 2.0.

## Verificação obrigatória

Acrescente testes comportamentais para:
- dano repetido reduz HP do chefe sem cancelar nenhum ataque; morte ainda funciona;
- outros inimigos mantêm reações antigas;
- 100 HP, transição uma vez em 50, uma/duas investidas e sequência de três slams só na fase 2;
- marca fixa por salto, desvio possível, aterrissagem segura, dano somente no impacto e uma vez por player;
- pausa e morte durante a sequência;
- morte lenta completa, nenhum gib, um cadáver decorativo e conclusão do encontro;
- vida infinita preserva acertos/empurrões e respawn de queda, sem perda de HP; OFF restaura perda de vidas;
- opção chega do editor aos testes e não vaza para jogo normal;
- dados da barra refletem HP atual/máximo e resetam no fim do encontro.

Valide no jogo real a sala do usuário: tamanho do chefe, espaço para desvio, três slams, empurrão causando queda, barra em diferentes resoluções, pausa e toggles. Não chame uma prancha de sprites de validação de partida.

Execute npm run check, atualize o grafo e faça revisão conforme AGENTS.md. Há duas falhas preexistentes documentadas (#4 e #5: peça fora do índice e Curva SE); compare com o estado inicial e não as atribua a esta tarefa. Registre tudo que não pôde verificar.

Atualize os documentos dos sistemas tocados, status e o planejamento do santuário, distinguindo o que foi aprovado, implementado e apenas sugerido. Entregue um resumo dos arquivos, ajustes disponíveis, comandos/resultados e limitações.

## Fora deste escopo

Não implementar ponte após vitória, altar, duas brasas, desbloqueio do Dash nem a cinemática de montagem. Não redesenhar tiles, players ou PNG do golem. Não substituir o mapa principal, recriar a sala nem alterar o layout salvo pelo usuário. Balanceamento dos números permanece iterativo.
