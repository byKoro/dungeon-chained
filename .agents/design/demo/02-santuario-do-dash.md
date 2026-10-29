# Santuário do Dash
Registro de decisões — 2026-10-28. O Cronograma v3 é a base indicada pelo usuário, mas seu conteúdo não está neste checkout; não reconstruímos o cronograma.

## Confirmado para implementação futura
- Uma sala por vez. Dash atual preservado integralmente.
- Tiles padrão, paleta roxa/marrom, baixa densidade de pixels e detalhes.
- Arauto usa assets/enemies/flame_golem.png.
- Arena quadrada cercada de abismos, com ponte de entrada.
- Derrotar o arauto ergue uma ponte de pedra até o altar.
- Altar com DUAS BRASAS: pedras carbonizadas com fissuras incandescentes; não escudos nem brasões.
- Ember de Dark Souls orienta material e sensação, simplificados para a resolução do jogo.
- Entrada mostra o golem se montando. Reações usam expressões existentes dos dois players.
- Barras: inferior sobe, superior desce; 10% da altura cada; entrada desacelerando em 0,4 s; saída rápida e suave ao pular; pausa congela; coordenadas de tela; enquadramento na área visível; controle devolvido após saída.

## Existente antes desta tarefa
- Dash individual com corrente rompida; nenhuma alteração nesta tarefa.
- Trailer com pausa, skip, expressões e enquadramento; barras estáticas no TrailerStage.
- Intro genérica de sala com zoom e spawn congelado; não é a montagem do golem.

## Implementado nesta tarefa
- Componente CinematicBars e integração no trailer existente, com entrada animada e saída antes de iniciar o jogo.
- Reserva de 10% superior/inferior no enquadramento do TrailerStage.
- Nenhuma sala, altar, brasa, ponte ou cutscene do arauto implementada.

## Propostas e questões abertas
- Saída das barras em 0,18 s: tuning inicial, sujeito a avaliação visual.
- Integração futura em Game via _step/_render; reutilizar o componente, sem duplicar o trailer ou criar diretor genérico agora.
- Câmera de trás: atrás dos jogadores ou do golem?
- Balanceamento final dos atributos e habilidades do arauto (base implementada abaixo).
- Como ensinar Dash e recuperar a serra após o altar.
- Arte final de brasas, altar e ponte.

As referências direcao-de-arte.md e references/santuario-style-reference.png não foram encontradas. Este documento registra a solicitação atual; não substitui conteúdos anteriores indisponíveis.

## Flame Golem: base aprovada para teste (2026-10-28)
- Implementada a base corpo a corpo lenta e resistente, aprovada pelo usuário: 6 HP, velocidade 0,8, preparo 65 ticks, recuperação 48 ticks. Valores provisórios.
- Três ataques da spritesheet em ciclo e morte completa. Sem dano de área; reutiliza alcance e alvo do MeleeEnemy. Disponível nos dois editores.
- Não define o moveset final do arauto nem implementa sua montagem, sala, ponte ou altar.

## Habilidades e fases aprovadas (2026-10-28)
- PNG: linhas 3/4/5 correspondem aos ataques; linha 2 é caminhada, linha 1 flash.
- Golpe normal; ataque circular grande com forte empurrão nos dois players; investida com posições marcadas, aviso e tracking ajustável.
- Fase 1: uma investida mais lenta. Fase 2: duas investidas, movimento e animações mais rápidas. Limiar de vida configurável.
- Implementado em FlameGolemEnemy e FlameGolemConfig. Padrão provisório: fase 2 em 3 HP, movimento/animação x1,35 e investida x1,6.
- Empurrão até o abismo verificado com o Game real na sala criada pelo usuário, sem alterar seu mapa. Balanceamento cooperativo pendente.

## Estado do Arauto das Brasas (2026-10-28)
Implementado na branch `feat/flame-golem`: resistência sem stagger, 100 HP, escala 2×, três saltos com slam na fase 2, morte lenta com escombros, barra de chefe e vida infinita de teste. Ainda sugerido/provisório: números de balanceamento. Pendente (fora deste escopo): ponte após a vitória, altar, duas brasas, desbloqueio do Dash e cinemática de montagem. Veja `.agents/tasks/2026-10-28-arauto-das-brasas/verification.md`.
