# Spec (cópia do documento do usuário, 30/10/2026)

Documento original: "Arauto das Brasas — comportamento e implementação", entregue no chat em 31/10/2026 com o pedido "execute o md em uma branch nova".

Resumo das regras aprovadas (ver o documento completo no histórico do chat):

- Sem ciclo fixo entre tipos de ataque; escolha pela situação nas duas fases.
- Jogador a até 110 px → melee (prioridade); na fase 1 a pressão pode superar.
- Fase 1, pressão: ao menos um jogador no alcance do melee por 2 s contínuos (sem contar hits). Conta também durante aviso/execução/recuperação. Zera quando os dois saem e depois da pancada. A pancada vem na próxima oportunidade, depois do ataque e da recuperação atuais.
- Fase 1, investida: os dois fora do melee, alvo até 480 px com trajeto válido; prefere o mais próximo com trajeto válido; pode passar por buraco; não atravessa parede nem sai do mapa; só com término seguro. Bloqueado → contorna andando. Sem salto na fase 1.
- Fase 2: sem pressão e sem pancada parada. Melee perto; investida longe; salto quando nenhuma investida é válida (até 480 px, aterrissagem segura). Sem alternância forçada.
- Aviso: investida acompanha a direção do alvo e o salto acompanha o destino; na execução ficam fixos (remove o rastreio durante a investida).
- Modos em config: individual (padrão; 1 investida ou 1 salto e reavalia) e sequência (fase 1: 1 investida; fase 2: dashCount investidas ou slam.count saltos).
- Navegação: continua perseguindo com jogadores parados; rota considera corpo e pés; paredes ao lado não bloqueiam melee/pancada; parede entre golpe e jogador protege.
- Descartado: pancada por número de hits, pontos de pressão, mudar a frequência de dano da serra, salto na fase 1, pancada na fase 2, pressão na fase 2, alternância obrigatória.

Critérios de verificação 1–14 do documento original são cobertos em `verification.md`.
