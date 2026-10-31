# Feeling da tensão da corrente

Status: done — implementação revisada após feedback do usuário; escuta humana e ajuste de feeling continuam pendentes.
Branch: feat/chain-tension-juice. Base: main41aace2. Date:2026-10-31.

## Objetivo e direção atual
Comunicar esforço e risco real de ruptura por som crescente, expressões originais e brilho vermelho evidente na corrente.

O usuário aprovou o planejamento em três rodadas de grilling e autorizou implementação. Na avaliação seguinte rejeitou as novas artes e considerou os efeitos fracos. A direção atual substitui a primeira versão: usar os assets existentes e reforçar a leitura da corrente com brilho de cor gradual.

## Design vigente
- Faixas leve, esforço e crítico com antecipação, histerese e alívio em aproximadamente150–250ms.
- Reutilizar raiva para esforço e furia para crítico, configuráveis e compartilhadas no personagem/avatar.
- Dano e cinematáticas preservam prioridade.
- Corrente recebe halo, corpo vermelho e núcleo luminoso acima da iluminação. A cor progride de vermelho escuro a vermelho quente; permanece visível entre pulsações e não cobre os discos.
- Vibração mais forte apenas no desenho; colisão/cabo físico continuam intactos.
- Rangido mais presente: ganho-24..-3dB com até+2dB de urgência, altura e abertura crescentes.
- Dash suspende urgência; serra dupla aberta considera risco por distância sem desgaste temporal congelado.
- Ruptura reaproveita sawSnap, encerra loop e mostra recuo nas conexões.
- Artes geradas rejeitadas, recortes e normalizador visual removidos na limpeza; só os sprites originais são usados.

## Etapas concluídas
- [x] Consultar AGENTS, arquitetura/convenções, sistemas, playbooks e skills de grilling, audio-design, create-game-assets e game-feel.
- [x] Integrar ChainTensionFeedback e ChainTensionConfig ao Game.
- [x] Usar expressões originais via EntityConfig/Player/VtuberHud e arquivar a experiência visual rejeitada.
- [x] Implementar halo vermelho e reforçar vibração/áudio.
- [x] Validar com11 testes focados e Game real em Electron oculto, capturas de esforço/crítico/ruptura e gravação com motor/ambiente/impactos.
- [x] Revisar nas duas dimensões com code-review; atualizar documentos e executar check/graph.

## Resultado de verificação
11/11 testes focados e runtime passaram. Último gate54/56: falhas antigas de ArautoEffects e Curva SE, além da peça de mapa não listada; testes chase/windup da base são intermitentes. Graphify indisponível. Commit local preparado; PR não solicitado. Detalhes e limites: review.md e verification.md.
