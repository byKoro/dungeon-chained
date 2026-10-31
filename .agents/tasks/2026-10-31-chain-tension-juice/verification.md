# Verification — Tensão da corrente

Date: 2026-10-31
Branch: feat/chain-tension-juice

## Ambiente

npm.cmd run doctor: Node24.22.1, Electron e Git disponíveis. Python não encontrado e graphify fora do PATH; gh ausente é opcional. O doctor retorna erro pelos dois problemas de ambiente.

npm.cmd run graph: não executa porque graphify está indisponível.

## Testes

- node tests/test_chain_tension.js: 11/11 aprovados. Cobrem antecipação, risco por distância/tempo, elasticidade, dash, serra dupla, alívio, curvas de áudio/brilho, histerese, voz/reset, geometria física e prioridade das expressões.
- Sintaxe de Game, ChainTensionFeedback, SawWeapon, VtuberHud e EntityConfig conferida com node --check.
- node scripts/build-chain-tension-audio.mjs: loop mono PCM16/44.1kHz, 1.6s, pico0.7, com extremos alinhados e DC removido.
- Último npm.cmd run check da implementação: 54/56 arquivos de teste aprovados; doc drift passou. ArautoEffects e Curva SE falham, além da peça de mapa não listada.

## Falhas da base

Conferidas antes desta limpeza em um git archive isolado de main41aace2:
- test_arauto_effects.js:43: telegraph.showMarks true/false.
- test_modular_grid.js:281: transformação Curva SE.
- test_arauto_das_brasas.js:34 e test_flame_golem.js:50: chase/windup intermitentes.
- map/corridor_vertical_ns_1.json não consta em map/index.json, conforme status#4.

A cópia temporária usada nessa comparação foi removida após a conferência.

## Jogo em execução

Game real em Electron33 oculto, servidor somente em127.0.0.1, posições controladas por script.
- raiva em esforço e furia em crítico, nos dois personagens e avatares.
- Dano e cinematática (espantado contra furia) mantêm prioridade.
- Proteção do dash zera urgência; alívio limpa expressão em250ms.
- Pausa silencia; ruptura em Game._updateGameplay toca sawSnap e inicia recuo.
- newDungeon encerra a voz anterior e limpa os rostos.
- Brilho vermelho e vibração conferidos nas capturas de esforço, crítico e ruptura.
- Console: 0 erros.
- Gravação com motor, ambiente e impactos: pico0.3603; 0 amostras saturadas.

Evidências locais preservadas em _local/tension: runtime-result.json, effort.png, critical.png, snap.png e game-audio.wav. O harness também foi preservado nesse diretório ignorado.

## Limpeza

Removidos os originais de geração rejeitados, recortes, normalizador visual, base temporária/ZIP e scripts auxiliares de edição de documentos. Código, áudio com origem registrada, gerador reproduzível, testes e documentação são os únicos arquivos da feature destinados ao commit.

## Não verificado

Escuta humana em fones/caixas, fadiga e feeling cooperativo; build desktop empacotado; navegação com controle; playthrough completo de split view/transições. Nenhuma avaliação humana é inferida das medições.
