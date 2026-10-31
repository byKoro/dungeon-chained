# SawTackle: peso, brasas e corte

Status: done — implementação e verificação concluídas; avaliação artística humana pendente.
Branch: feat/saw-tackle-gamefeel. Base: main86b6f28. Date:2026-10-31.

## Direção aprovada
Máquina pesada triturando: lançamento explosivo e corte agressivo. Após a primeira revisão visual, o usuário pediu melhor acabamento no rastro, luz e brilho; depois restringiu a paleta a aço escuro, vermelho e amarelo, sem azul ou brilho central intenso. O ajuste seguinte pediu brilho maior no contato; a direção mais recente mantém luminosidade de serra solta e aquece gradualmente da cor original até o vermelho.

## Design final
- Impacto metálico grave, voo mecânico e corte contínuo distintos; quique/pouso próprios.
- Manter dano, mira, trajetória, retorno, cooldown, invulnerabilidade e hit stop local.
- Lâmina gira com corpo escuro e borda quente: shader de paleta em canvas16px cacheado a partir do sprite existente, sem nova arte.
- Duas fontes de brasas em bordas opostas giram com a lâmina. Histórico de posição/rotação produz segmentos de rastro e faíscas vermelhas/amarelas que desaparecem.
- Luz pontual acompanha as bordas com alcance/falloff da serra solta e cor original no início. Rastro, luz, borda e sprite aquecem juntos até vermelho em0.45s; esfriam no pouso. Brilho central intenso e fita azul permanente foram retirados.
- No corte: brasas laterais mais intensas, luz quente ligeiramente maior e pulso curto nos acertos aceitos.
- Faíscas e detritos respeitam material; pedra não recebe sangue. Nenhum hit stop global novo.
- Duas vozes contínuas reutilizadas; pausa, reconexão, morte/respawn e reset não deixam sons ou efeitos presos.
- Limites de transientes, texturas cacheadas e fontes de luz; preferência de movimento reduzido respeitada.

## Etapas
- [x] Consultar AGENTS, arquitetura/convenções/status, sistemas weapons/players/audio/FX/rendering e playbook add-sound; skills router/game-feel/audio-design. Graphify indisponível.
- [x] Integrar SawTackleFeedback e config ao Game, com eventos de contato/acerto/lançamento/quique/pouso emitidos pelo SawTackle.
- [x] Gerar sete WAVs de fontes existentes com script determinístico e origem registrada.
- [x] Implementar rotação/rastro de brasas, luzes e paleta de aço escuro; ajustar ganho repetido do sawHit só no tackle.
- [x] Testes físicos existentes e sete casos de feedback passaram; Game real/Electron exercitou carne/pedra, cinco hits, pausa, quique/pouso e reset.
- [x] Revisar Standards/Spec, registrar verificação e atualizar contexto.
- [x] Executar gate e registrar falhas preexistentes/limites.

## Verificação e limites
Capturas/gravação em _local/saw-tackle. Sem avaliação humana de timbre/fadiga/co-op ou de performance em GPU real. O teste usa Electron oculto com renderização por software; métricas não representam FPS de produção.
